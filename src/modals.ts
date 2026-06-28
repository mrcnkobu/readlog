import {
	App,
	DropdownComponent,
	FuzzySuggestModal,
	Modal,
	Notice,
	Setting,
	TextAreaComponent,
	TextComponent,
} from "obsidian";
import {
	formatProgressPercent,
	progressInputLabel,
	progressUnitLabel,
} from "./utils";
import type {
	AddBookValues,
	AddEntryType,
	AddEntryValues,
	BookMedium,
	BookProgressUnit,
	BookRecord,
	BookStatus,
	EditBookValues,
	LogReadingSessionValues,
} from "./types";

export class BookSuggestModal extends FuzzySuggestModal<BookRecord> {
	constructor(
		app: App,
		private readonly books: BookRecord[],
		private readonly onChooseBook: (book: BookRecord) => void
	) {
		super(app);
		this.setPlaceholder("Select a book");
	}

	getItems(): BookRecord[] {
		return this.books;
	}

	getItemText(item: BookRecord): string {
		return `${item.title} (${item.status})`;
	}

	onChooseItem(item: BookRecord): void {
		this.onChooseBook(item);
	}
}

export class AddBookModal extends Modal {
	private titleValue = "";
	private authorValue = "";
	private progressUnitValue: BookProgressUnit = "page";
	private progressTotalValue = "";
	private tagsValue = "";
	private statusValue: BookStatus = "to-read";
	private mediumValue: BookMedium | null = null;
	private deviceValue = "";

	constructor(app: App, private readonly onSubmit: (values: AddBookValues) => Promise<void>) {
		super(app);
	}

	onOpen() {
		const { contentEl } = this;
		contentEl.empty();
		contentEl.createEl("h2", { text: "Add book" });

		new Setting(contentEl)
			.setName("Title")
			.addText((text) => {
				text.setPlaceholder("The Pragmatic Programmer");
				text.onChange((value) => {
					this.titleValue = value.trim();
				});
			});

		new Setting(contentEl)
			.setName("Author")
			.addText((text) => {
				text.setPlaceholder("David Thomas, Andrew Hunt");
				text.onChange((value) => {
					this.authorValue = value.trim();
				});
			});

		new Setting(contentEl)
			.setName("Medium")
			.addDropdown((dropdown) => {
				addBookMediumOptions(dropdown);
				dropdown.setValue(this.mediumValue ?? "");
				dropdown.onChange((value) => {
					this.mediumValue = value === "print" || value === "ebook" ? value : null;
				});
			});

		createTextSetting(contentEl, "Device", this.deviceValue, (value) => {
			this.deviceValue = value.trim();
		}, "Optional, for example Kindle Paperwhite");

		new Setting(contentEl)
			.setName("Progress unit")
			.addDropdown((dropdown) => {
				addProgressUnitOptions(dropdown);
				dropdown.setValue(this.progressUnitValue);
				dropdown.onChange((value) => {
					this.progressUnitValue = value as BookProgressUnit;
				});
			});

		createNumericSetting(contentEl, "Progress total", this.progressTotalValue, (value) => {
			this.progressTotalValue = value.trim();
		}, "Optional for pages and locations. Percent books use 100.");

		new Setting(contentEl)
			.setName("Tags")
			.setDesc("Comma-separated")
			.addText((text) => {
				text.setPlaceholder("programming, craftsmanship");
				text.onChange((value) => {
					this.tagsValue = value;
				});
			});

		new Setting(contentEl)
			.setName("Initial status")
			.addDropdown((dropdown) => {
				addBookStatusOptions(dropdown);
				dropdown.setValue(this.statusValue);
				dropdown.onChange((value: BookStatus) => {
					this.statusValue = value;
				});
			});

		new Setting(contentEl)
			.addButton((button) => {
				button.setButtonText("Create").setCta().onClick(() => {
					void this.submit();
				});
			})
			.addExtraButton((button) => {
				button.setIcon("x").setTooltip("Cancel").onClick(() => this.close());
			});
	}

	private async submit() {
		await submitWithNotice(async () => {
			if (!this.titleValue) {
				throw new Error("Enter a book title.");
			}

			await this.onSubmit({
				title: this.titleValue,
				author: this.authorValue,
				progressUnit: this.progressUnitValue,
				progressTotal: toOptionalNumber(this.progressTotalValue, "progress total"),
				tags: parseTags(this.tagsValue),
				status: this.statusValue,
				medium: this.mediumValue,
				device: this.deviceValue || null,
			});
			this.close();
		});
	}
}

export class EditBookModal extends Modal {
	private titleValue: string;
	private authorValue: string;
	private progressUnitValue: BookProgressUnit;
	private progressCurrentValue: string;
	private progressTotalValue: string;
	private tagsValue: string;
	private statusValue: BookStatus;
	private mediumValue: BookMedium | null;
	private deviceValue: string;
	private startedValue: string;
	private finishedValue: string;
	private ratingValue: string;

	constructor(
		app: App,
		private readonly book: BookRecord,
		private readonly onSubmit: (values: EditBookValues) => Promise<void>,
		private readonly onDelete: () => Promise<void>
	) {
		super(app);
		this.titleValue = book.title;
		this.authorValue = book.author;
		this.progressUnitValue = book.progress_unit;
		this.progressCurrentValue = String(book.progress_current);
		this.progressTotalValue = book.progress_total === null ? "" : String(book.progress_total);
		this.tagsValue = book.tags.join(", ");
		this.statusValue = book.status;
		this.mediumValue = book.medium;
		this.deviceValue = book.device ?? "";
		this.startedValue = book.started ?? "";
		this.finishedValue = book.finished ?? "";
		this.ratingValue = book.rating ? String(book.rating) : "";
	}

	onOpen() {
		const { contentEl } = this;
		contentEl.empty();
		contentEl.createEl("h2", { text: `Edit ${this.book.title}` });

		createTextSetting(contentEl, "Title", this.titleValue, (value) => {
			this.titleValue = value.trim();
		});

		createTextSetting(contentEl, "Author", this.authorValue, (value) => {
			this.authorValue = value.trim();
		});

		new Setting(contentEl)
			.setName("Medium")
			.addDropdown((dropdown) => {
				addBookMediumOptions(dropdown);
				dropdown.setValue(this.mediumValue ?? "");
				dropdown.onChange((value) => {
					this.mediumValue = value === "print" || value === "ebook" ? value : null;
				});
			});

		createTextSetting(contentEl, "Device", this.deviceValue, (value) => {
			this.deviceValue = value.trim();
		}, "Optional, for example Kindle Paperwhite");

		new Setting(contentEl)
			.setName("Progress unit")
			.addDropdown((dropdown) => {
				addProgressUnitOptions(dropdown);
				dropdown.setValue(this.progressUnitValue);
				dropdown.onChange((value) => {
					this.progressUnitValue = value as BookProgressUnit;
				});
			});

		createNumericSetting(contentEl, "Current progress", this.progressCurrentValue, (value) => {
			this.progressCurrentValue = value.trim();
		});

		createNumericSetting(contentEl, "Progress total", this.progressTotalValue, (value) => {
			this.progressTotalValue = value.trim();
		}, "Optional for pages and locations. Percent books use 100.");

		createTextSetting(contentEl, "Tags", this.tagsValue, (value) => {
			this.tagsValue = value;
		}, "Comma-separated");

		new Setting(contentEl)
			.setName("Status")
			.addDropdown((dropdown) => {
				addBookStatusOptions(dropdown);
				dropdown.setValue(this.statusValue);
				dropdown.onChange((value: BookStatus) => {
					this.statusValue = value;
				});
			});

		if (this.book.progress_percent !== null) {
			new Setting(contentEl)
				.setName("Progress percent")
				.setDesc(`${this.book.progress_percent}%`);
		}

		createTextSetting(contentEl, "Started", this.startedValue, (value) => {
			this.startedValue = value.trim();
		}, "YYYY-MM-DD");

		createTextSetting(contentEl, "Finished", this.finishedValue, (value) => {
			this.finishedValue = value.trim();
		}, "YYYY-MM-DD");

		createNumericSetting(contentEl, "Rating", this.ratingValue, (value) => {
			this.ratingValue = value.trim();
		});

		new Setting(contentEl)
			.addButton((button) => {
				button.setButtonText("Save").setCta().onClick(() => {
					void this.submit();
				});
			})
			.addButton((button) => {
				button.setButtonText("Delete").setWarning().onClick(() => {
					void this.deleteBook();
				});
			})
			.addExtraButton((button) => {
				button.setIcon("x").setTooltip("Cancel").onClick(() => this.close());
			});
	}

	private async submit() {
		await submitWithNotice(async () => {
			if (!this.titleValue) {
				throw new Error("Enter a book title.");
			}

			await this.onSubmit({
				title: this.titleValue,
				author: this.authorValue,
				progressUnit: this.progressUnitValue,
				progressCurrent: toRequiredNumber(this.progressCurrentValue, "current progress"),
				progressTotal: toOptionalNumber(this.progressTotalValue, "progress total"),
				medium: this.mediumValue,
				device: this.deviceValue || null,
				tags: parseTags(this.tagsValue),
				status: this.statusValue,
				started: this.startedValue || null,
				finished: this.finishedValue || null,
				rating: toOptionalNumber(this.ratingValue, "rating"),
			});
			this.close();
		});
	}

	private async deleteBook() {
		if (!window.confirm(`Delete "${this.book.title}"? Existing reading-log and daily-note entries will be kept.`)) {
			return;
		}

		await submitWithNotice(async () => {
			await this.onDelete();
			this.close();
		});
	}
}

export class LogReadingSessionModal extends Modal {
	private newProgressCurrentValue: string;
	private minutesSpentValue = "";
	private noteValue = "";

	constructor(
		app: App,
		private readonly book: BookRecord,
		private readonly onSubmit: (values: LogReadingSessionValues) => Promise<void>
	) {
		super(app);
		this.newProgressCurrentValue = String(book.progress_current);
	}

	onOpen() {
		const { contentEl } = this;
		contentEl.empty();
		contentEl.createEl("h2", { text: `Log session for ${this.book.title}` });

		const currentSummary = this.describeCurrentProgress(this.book);
		new Setting(contentEl)
			.setName(`New current ${progressInputLabel(this.book.progress_unit)}`)
			.setDesc(currentSummary)
			.addText((text) => {
				text.inputEl.type = "number";
				text.setValue(this.newProgressCurrentValue);
				text.onChange((value) => {
					this.newProgressCurrentValue = value.trim();
				});
			});

		new Setting(contentEl)
			.setName("Minutes spent")
			.setDesc("Optional")
			.addText((text) => {
				text.inputEl.type = "number";
				text.setPlaceholder("35");
				text.onChange((value) => {
					this.minutesSpentValue = value.trim();
				});
			});

		const noteContainer = contentEl.createDiv({ cls: "readlog-modal-textarea" });
		noteContainer.createEl("label", { text: "Session note" });
		const noteArea = new TextAreaComponent(noteContainer);
		noteArea.setPlaceholder("Optional session note");
		noteArea.onChange((value) => {
			this.noteValue = value.trim();
		});
		noteArea.inputEl.rows = 4;

		new Setting(contentEl)
			.addButton((button) => {
				button.setButtonText("Log session").setCta().onClick(() => {
					void this.submit();
				});
			})
			.addExtraButton((button) => {
				button.setIcon("x").setTooltip("Cancel").onClick(() => this.close());
			});
	}

	private describeCurrentProgress(book: BookRecord): string {
		const totalPart = book.progress_total === null ? "" : ` / ${book.progress_total}`;
		const percentPart = formatProgressPercent(book.progress_percent);
		return `Current ${progressUnitLabel(book.progress_unit)}: ${book.progress_current}${totalPart}${percentPart ? ` (${percentPart})` : ""}`;
	}

	private async submit() {
		await submitWithNotice(async () => {
			await this.onSubmit({
				newProgressCurrent: toRequiredNumber(this.newProgressCurrentValue, "new current progress"),
				minutesSpent: toOptionalNumber(this.minutesSpentValue, "minutes spent"),
				note: this.noteValue || null,
			});
			this.close();
		});
	}
}

export class AddEntryModal extends Modal {
	private typeValue: AddEntryType = "note";
	private textValue = "";
	private locatorValue = "";

	constructor(app: App, private readonly onSubmit: (values: AddEntryValues) => Promise<void>) {
		super(app);
	}

	onOpen() {
		const { contentEl } = this;
		contentEl.empty();
		contentEl.createEl("h2", { text: "Add entry" });

		new Setting(contentEl)
			.setName("Entry type")
			.addDropdown((dropdown) => {
				dropdown.addOption("note", "Note");
				dropdown.addOption("citation", "Citation");
				dropdown.setValue(this.typeValue);
				dropdown.onChange((value: AddEntryType) => {
					this.typeValue = value;
				});
			});

		const textContainer = contentEl.createDiv({ cls: "readlog-modal-textarea" });
		textContainer.createEl("label", { text: "Text" });
		const textArea = new TextAreaComponent(textContainer);
		textArea.setPlaceholder("Write your note or citation");
		textArea.onChange((value) => {
			this.textValue = value.trim();
		});
		textArea.inputEl.rows = 6;

		createTextSetting(contentEl, "Locator", this.locatorValue, (value) => {
			this.locatorValue = value.trim();
		}, "Optional, e.g. p.42 or loc.1845-1848");

		new Setting(contentEl)
			.addButton((button) => {
				button.setButtonText("Add").setCta().onClick(() => {
					void this.submit();
				});
			})
			.addExtraButton((button) => {
				button.setIcon("x").setTooltip("Cancel").onClick(() => this.close());
			});
	}

	private async submit() {
		await submitWithNotice(async () => {
			if (!this.textValue) {
				throw new Error("Enter note or citation text.");
			}

			await this.onSubmit({
				type: this.typeValue,
				text: this.textValue,
				locator: this.locatorValue || null,
			});
			this.close();
		});
	}
}

function addBookStatusOptions(dropdown: DropdownComponent) {
	dropdown.addOption("to-read", "to-read");
	dropdown.addOption("reading", "reading");
	dropdown.addOption("done", "done");
	dropdown.addOption("abandoned", "abandoned");
}

function addBookMediumOptions(dropdown: DropdownComponent) {
	dropdown.addOption("", "-");
	dropdown.addOption("print", "print");
	dropdown.addOption("ebook", "ebook");
}

function addProgressUnitOptions(dropdown: DropdownComponent) {
	dropdown.addOption("page", "page");
	dropdown.addOption("loc", "loc");
	dropdown.addOption("percent", "percent");
}

function createTextSetting(
	container: HTMLElement,
	name: string,
	value: string,
	onChange: (value: string) => void,
	description?: string
) {
	new Setting(container)
		.setName(name)
		.setDesc(description ?? "")
		.addText((text) => {
			text.setValue(value);
			text.onChange(onChange);
		});
}

function createNumericSetting(
	container: HTMLElement,
	name: string,
	value: string,
	onChange: (value: string) => void,
	description?: string
) {
	new Setting(container)
		.setName(name)
		.setDesc(description ?? "")
		.addText((text: TextComponent) => {
			text.inputEl.type = "number";
			text.setValue(value);
			text.onChange(onChange);
		});
}

function parseTags(value: string): string[] {
	return value
		.split(",")
		.map((tag) => tag.trim())
		.filter(Boolean);
}

async function submitWithNotice(action: () => Promise<void>): Promise<void> {
	try {
		await action();
	} catch (error) {
		new Notice(error instanceof Error ? error.message : "Readlog command failed");
	}
}

function toOptionalNumber(value: string, label: string): number | null {
	if (!value) {
		return null;
	}

	const parsed = Number(value);
	if (!Number.isFinite(parsed)) {
		throw new Error(`Enter a valid ${label}.`);
	}
	return parsed;
}

function toRequiredNumber(value: string, label: string): number {
	if (!value) {
		throw new Error(`Enter ${label}.`);
	}

	const parsed = Number(value);
	if (!Number.isFinite(parsed)) {
		throw new Error(`Enter a valid ${label}.`);
	}
	return parsed;
}
