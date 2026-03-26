import { Notice, Plugin } from "obsidian";
import { AddBookModal, AddEntryModal, BookSuggestModal, EditBookModal, LogReadingSessionModal } from "./src/modals";
import { ReadlogSettingTab } from "./src/settings";
import { DEFAULT_SETTINGS, type BookRecord, type ReadlogSettings } from "./src/types";
import {
	migrateLegacyDailyNoteNameTemplate,
	normalizeDailyFolderTemplate,
	normalizeDailyNameTemplate,
	normalizeMarkdownHeading,
} from "./src/utils";
import { ReadlogService } from "./src/readlog-service";

type PersistedReadlogSettings = Partial<ReadlogSettings> & {
	dailyNotesFolder?: string;
	dailyNoteFormat?: string;
};

export default class ReadlogPlugin extends Plugin {
	settings!: ReadlogSettings;
	private service!: ReadlogService;

	async onload() {
		await this.loadSettings();
		this.service = new ReadlogService(this.app, () => this.settings);

		this.addSettingTab(new ReadlogSettingTab(this.app, this));

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
								? `Logged session for ${book.title}. Book reached its total pages; consider marking it done.`
								: `Logged session for ${book.title}`
						);
					}).open();
				}, { preferReading: true });
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
				});
			},
		});
	}

	onunload() {
		// Nothing to clean up.
	}

	async loadSettings() {
		const loaded = (await this.loadData() ?? {}) as PersistedReadlogSettings;
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
	}

	async saveSettings() {
		this.settings.dailyNotesFolderTemplate = normalizeDailyFolderTemplate(this.settings.dailyNotesFolderTemplate);
		this.settings.dailyNoteNameTemplate = normalizeDailyNameTemplate(this.settings.dailyNoteNameTemplate);
		this.settings.dailyNoteHeading = normalizeMarkdownHeading(this.settings.dailyNoteHeading);
		await this.saveData(this.settings);
	}

	private async runForBook(
		callback: (book: BookRecord) => Promise<void>,
		options?: { preferReading?: boolean }
	) {
		try {
			const activeBook = await this.service.getActiveBook();
			if (activeBook) {
				await callback(activeBook);
				return;
			}

			const books = await this.service.listBooks();
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
				void callback(book);
			}).open();
		} catch (error) {
			new Notice(error instanceof Error ? error.message : "Readlog command failed");
		}
	}
}
