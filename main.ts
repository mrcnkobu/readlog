import { Notice, Plugin } from "obsidian";
import { parseKindleClippings } from "./src/kindle-clippings";
import { AddBookModal, AddEntryModal, BookSuggestModal, ConfirmModal, EditBookModal, InfoModal, LogReadingSessionModal } from "./src/modals";
import { ReadlogService } from "./src/readlog-service";
import { ReadlogSettingTab } from "./src/settings";
import {
	DEFAULT_SETTINGS,
	type BookRecord,
	type KindleImportPlan,
	type KindleImportResult,
	type ReadlogSettings,
} from "./src/types";
import {
	migrateLegacyDailyNoteNameTemplate,
	normalizeDailyFolderTemplate,
	normalizeDailyNameTemplate,
	normalizeMarkdownHeading,
} from "./src/utils";

type PersistedReadlogData = Partial<ReadlogSettings> & {
	dailyNotesFolder?: string;
	dailyNoteFormat?: string;
	importedClippingFingerprints?: string[];
};

type PickerWindow = Window & {
	showOpenFilePicker?: (options?: {
		multiple?: boolean;
		excludeAcceptAllOption?: boolean;
		types?: Array<{ description?: string; accept: Record<string, string[]> }>;
	}) => Promise<Array<{ getFile: () => Promise<File> }>>;
};

const READLOG_HIDDEN_FILE_INPUT_CLASS = "readlog-hidden-file-input";

export default class ReadlogPlugin extends Plugin {
	settings!: ReadlogSettings;
	private service!: ReadlogService;
	private importedClippingFingerprints = new Set<string>();

	async onload() {
		await this.loadSettings();
		this.service = new ReadlogService(this.app, () => this.settings);

		this.addSettingTab(new ReadlogSettingTab(this.app, this));

		this.addRibbonIcon("book-open", "Log reading session", () => {
			void this.runForBook(async (book) => {
				new LogReadingSessionModal(this.app, book, async (values) => {
					const result = await this.service.logReadingSession(book.file, values);
					new Notice(
						result.reachedEnd
							? `Logged session for ${book.title}. Book reached 100% progress; consider marking it done.`
							: `Logged session for ${book.title}`
					);
				}).open();
			}, { preferReading: true, excludeAbandoned: true });
		});

		this.addCommand({
			id: "add-book",
			name: "Add book",
			callback: () => {
				new AddBookModal(this.app, async (values) => {
					const file = await this.service.createBook(values);
					new Notice(`Created ${file.basename}`);
					await this.app.workspace.getLeaf(true).openFile(file);
				}).open();
			},
		});

		this.addCommand({
			id: "edit-book",
			name: "Edit book",
			callback: () => {
				void this.runForBook(async (book) => {
					new EditBookModal(
						this.app,
						book,
						async (values) => {
							const updated = await this.service.updateBook(book.file, values);
							new Notice(`Updated ${updated.title}`);
						},
						async () => {
							await this.service.deleteBook(book.file);
							new Notice(`Deleted ${book.title}`);
						}
					).open();
				});
			},
		});

		this.addCommand({
			id: "log-reading-session",
			name: "Log reading session",
			callback: () => {
				void this.runForBook(async (book) => {
					new LogReadingSessionModal(this.app, book, async (values) => {
						const result = await this.service.logReadingSession(book.file, values);
						new Notice(
							result.reachedEnd
								? `Logged session for ${book.title}. Book reached 100% progress; consider marking it done.`
								: `Logged session for ${book.title}`
						);
					}).open();
				}, { preferReading: true, excludeAbandoned: true });
			},
		});

		this.addCommand({
			id: "add-entry",
			name: "Add entry",
			callback: () => {
				void this.runForBook(async (book) => {
					new AddEntryModal(this.app, async (values) => {
						await this.service.addEntry(book.file, values);
						new Notice(`Added ${values.type} to ${book.title}`);
					}).open();
				}, { preferReading: true, excludeAbandoned: true });
			},
		});

		this.addCommand({
			id: "mark-done",
			name: "Mark book as done",
			callback: () => {
				void this.runForBook(async (book) => {
					if (book.status === "done") {
						new Notice(`${book.title} is already marked as done.`);
						return;
					}
					const updated = await this.service.updateBook(book.file, {
						title: book.title,
						author: book.author,
						status: "done",
						progressUnit: book.progress_unit,
						progressCurrent: book.progress_current,
						progressTotal: book.progress_total,
						medium: book.medium,
						device: book.device,
						tags: book.tags,
						started: book.started,
						finished: book.finished,
						rating: book.rating,
					});
					new Notice(`Marked "${updated.title}" as done.`);
				}, { preferReading: true, excludeAbandoned: true });
			},
		});

		this.addCommand({
			id: "open-reading-log",
			name: "Open reading log",
			callback: () => {
				void this.openReadingLog();
			},
		});

		this.addCommand({
			id: "import-kindle-clippings",
			name: "Import Kindle Clippings",
			callback: () => {
				void this.importKindleClippings();
			},
		});
	}

	onunload() {
		// Nothing to clean up.
	}

	async loadSettings() {
		const loaded = (await this.loadData() ?? {}) as PersistedReadlogData;
		this.settings = {
			...DEFAULT_SETTINGS,
			...loaded,
			dailyNotesFolderTemplate: normalizeDailyFolderTemplate(
				loaded.dailyNotesFolderTemplate ?? loaded.dailyNotesFolder ?? DEFAULT_SETTINGS.dailyNotesFolderTemplate
			),
			dailyNoteNameTemplate: normalizeDailyNameTemplate(
				migrateLegacyDailyNoteNameTemplate(
					loaded.dailyNoteNameTemplate ?? loaded.dailyNoteFormat ?? DEFAULT_SETTINGS.dailyNoteNameTemplate
				)
			),
			dailyNoteHeading: normalizeMarkdownHeading(loaded.dailyNoteHeading ?? DEFAULT_SETTINGS.dailyNoteHeading),
		};
		this.importedClippingFingerprints = new Set(
			Array.isArray(loaded.importedClippingFingerprints)
				? loaded.importedClippingFingerprints.filter((value): value is string => typeof value === "string")
				: []
		);
	}

	async saveSettings() {
		this.settings.dailyNotesFolderTemplate = normalizeDailyFolderTemplate(this.settings.dailyNotesFolderTemplate);
		this.settings.dailyNoteNameTemplate = normalizeDailyNameTemplate(this.settings.dailyNoteNameTemplate);
		this.settings.dailyNoteHeading = normalizeMarkdownHeading(this.settings.dailyNoteHeading);
		await this.savePluginData();
	}

	private async savePluginData() {
		await this.saveData({
			...this.settings,
			importedClippingFingerprints: [...this.importedClippingFingerprints],
		});
	}

	private async importKindleClippings() {
		try {
			const selectedFile = await this.pickTextFile();
			if (!selectedFile) {
				return;
			}

			const clippings = parseKindleClippings(selectedFile.text);
			if (clippings.length === 0) {
				new Notice(`No Kindle clippings found in ${selectedFile.name}`);
				return;
			}

			const plan = await this.service.planKindleImport(clippings, this.importedClippingFingerprints);
			if (plan.highlightsToImport === 0 && plan.notesToImport === 0) {
				new Notice(this.describeNoOpImport(selectedFile.name, plan), 12000);
				return;
			}

			const createMissingBooks = plan.creatableBooks > 0
				? await ConfirmModal.prompt(
					this.app,
					`Import from ${selectedFile.name}`,
					[
						`${plan.highlightsToImport} highlights and ${plan.notesToImport} notes ready to import.`,
						`Confirm to also create ${plan.creatableBooks} new book note(s) for unmatched titles.`,
						`Cancel to import only into existing matched books.`,
					].join("\n\n"),
					{ confirmLabel: "Import and create", cancelLabel: "Import existing only" }
				)
				: true;

			const result = await this.service.applyKindleImport(plan, { createMissingBooks });
			for (const fingerprint of result.importedFingerprints) {
				this.importedClippingFingerprints.add(fingerprint);
			}
			await this.savePluginData();

			new InfoModal(this.app, "Import complete", this.describeImportResult(selectedFile.name, plan, result)).open();
		} catch (error) {
			new Notice(error instanceof Error ? error.message : "Kindle import failed");
		}
	}

	private describeNoOpImport(fileName: string, plan: KindleImportPlan): string {
		const parts = [`No new Kindle entries were imported from ${fileName}.`];
		if (plan.duplicatesSkipped > 0) {
			parts.push(`${plan.duplicatesSkipped} duplicate clipping(s) skipped.`);
		}
		if (plan.bookmarksSkipped > 0) {
			parts.push(`${plan.bookmarksSkipped} bookmark clipping(s) skipped.`);
		}
		if (plan.emptyEntriesSkipped > 0) {
			parts.push(`${plan.emptyEntriesSkipped} empty clipping(s) skipped.`);
		}
		return parts.join(" ");
	}

	private describeImportResult(fileName: string, plan: KindleImportPlan, result: KindleImportResult): string {
		const parts = [
			`Imported ${result.importedHighlights} highlights and ${result.importedNotes} notes from ${fileName}.`,
			`${result.importedBooks} book note(s) updated.`,
		];
		if (result.createdBooks > 0) {
			parts.push(`${result.createdBooks} new book note(s) created.`);
		}
		if (result.skippedBooks > 0) {
			parts.push(`${result.skippedBooks} book group(s) skipped.`);
		}
		if (plan.duplicatesSkipped > 0) {
			parts.push(`${plan.duplicatesSkipped} duplicate clipping(s) skipped.`);
		}
		if (plan.bookmarksSkipped > 0) {
			parts.push(`${plan.bookmarksSkipped} bookmark clipping(s) skipped.`);
		}
		if (plan.emptyEntriesSkipped > 0) {
			parts.push(`${plan.emptyEntriesSkipped} empty clipping(s) skipped.`);
		}
		if (plan.ambiguousBooks > 0) {
			parts.push(`${plan.ambiguousBooks} ambiguous title match(es) need manual review.`);
		}
		return parts.join("\n\n");
	}

	private async pickTextFile(): Promise<{ name: string; text: string } | null> {
		const pickerWindow = window as PickerWindow;
		if (typeof pickerWindow.showOpenFilePicker === "function") {
			try {
				const [handle] = await pickerWindow.showOpenFilePicker({
					multiple: false,
					excludeAcceptAllOption: true,
					types: [
						{
							description: "Text files",
							accept: { "text/plain": [".txt"] },
						},
					],
				});
				const file = await handle.getFile();
				return {
					name: file.name,
					text: await file.text(),
				};
			} catch (error) {
				if (isAbortError(error)) {
					return null;
				}
				throw error;
			}
		}

		return await new Promise((resolve, reject) => {
			const pickerDocument = getActiveDocument();
			const input = pickerDocument.createElement("input");
			input.type = "file";
			input.accept = ".txt,text/plain";
			input.classList.add(READLOG_HIDDEN_FILE_INPUT_CLASS);

			let settled = false;
			const finish = (value: { name: string; text: string } | null) => {
				if (settled) {
					return;
				}
				settled = true;
				window.removeEventListener("focus", handleFocus);
				input.remove();
				resolve(value);
			};

			const handleFocus = () => {
				window.setTimeout(() => {
					if (!settled && !input.files?.length) {
						finish(null);
					}
				}, 300);
			};

			input.addEventListener("cancel", () => finish(null), { once: true });
			input.addEventListener("change", () => {
				const file = input.files?.item(0);
				if (!file) {
					finish(null);
					return;
				}

				void file.text().then((text) => {
					finish({ name: file.name, text });
					}).catch(() => {
						if (!settled) {
							settled = true;
							window.removeEventListener("focus", handleFocus);
							input.remove();
							reject(new Error("Could not read the selected file."));
						}
					});
			}, { once: true });

			window.addEventListener("focus", handleFocus, { once: true });
			pickerDocument.body.appendChild(input);
			input.click();
		});
	}

	private async openReadingLog() {
		try {
			const file = await this.service.ensureReadingLog();
			await this.app.workspace.getLeaf(false).openFile(file);
		} catch (error) {
			new Notice(error instanceof Error ? error.message : "Could not open reading log");
		}
	}

	private async runForBook(
		callback: (book: BookRecord) => Promise<void>,
		options?: { preferReading?: boolean; excludeAbandoned?: boolean }
	) {
		try {
			const activeBook = await this.service.getActiveBook();
			if (activeBook) {
				await callback(activeBook);
				return;
			}

			const allBooks = await this.service.listBooks();
			const books = options?.excludeAbandoned && allBooks.some((b) => b.status !== "abandoned")
				? allBooks.filter((b) => b.status !== "abandoned")
				: allBooks;

			const selectable = options?.preferReading
				? [...books].sort((left, right) => {
					if (left.status === right.status) {
						return left.title.localeCompare(right.title);
					}
					if (left.status === "reading") {
						return -1;
					}
					if (right.status === "reading") {
						return 1;
					}
					return left.title.localeCompare(right.title);
				})
				: books;

			if (selectable.length === 0) {
				new Notice("No books found");
				return;
			}

			new BookSuggestModal(this.app, selectable, (book) => {
				void callback(book).catch((error) => {
					new Notice(error instanceof Error ? error.message : "Readlog command failed");
				});
			}).open();
		} catch (error) {
			new Notice(error instanceof Error ? error.message : "Readlog command failed");
		}
	}
}

function isAbortError(error: unknown): boolean {
	return error instanceof DOMException && error.name === "AbortError";
}

function getActiveDocument(): Document {
	return window.activeDocument;
}
