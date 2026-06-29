import {
	App,
	DropdownComponent,
	FuzzySuggestModal,
	Modal,
	Notice,
	Setting,
	TextAreaComponent,
	TextComponent,
	moment,
} from "obsidian";
import {
	formatProgressPercent,
	normalizeSessionDate,
	normalizeSessionTime,
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
		const author = item.author ? ` — ${item.author}` : "";
		return `${item.title}${author} (${item.status})`;
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
		addModalHeading(contentEl, "Add book");

		let titleInput: TextComponent | undefined;
		new Setting(contentEl)
			.setName("Title")
			.addText((text) => {
				titleInput = text;
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

		this.scope.register([], "Enter", (evt) => {
			if (isTextAreaActive()) return;
			evt.preventDefault();
			void this.submit();
		});

		titleInput?.inputEl.focus();
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
	private deleteConfirmState = false;
	private buttonRowEl!: HTMLElement;

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
		addModalHeading(contentEl, `Edit ${this.book.title}`);

		let titleInput: TextComponent | undefined;
		createTextSetting(contentEl, "Title", this.titleValue, (value) => {
			this.titleValue = value.trim();
		}, undefined, (text) => { titleInput = text; });

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

		const progressDesc = this.book.progress_percent !== null
			? `Currently at ${this.book.progress_percent}%`
			: undefined;
		createNumericSetting(contentEl, "Current progress", this.progressCurrentValue, (value) => {
			this.progressCurrentValue = value.trim();
		}, progressDesc);

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

		createTextSetting(contentEl, "Started", this.startedValue, (value) => {
			this.startedValue = value.trim();
		}, "YYYY-MM-DD");

		createTextSetting(contentEl, "Finished", this.finishedValue, (value) => {
			this.finishedValue = value.trim();
		}, "YYYY-MM-DD");

		createNumericSetting(contentEl, "Rating", this.ratingValue, (value) => {
			this.ratingValue = value.trim();
		}, "1–5");

		this.buttonRowEl = contentEl.createDiv();
		this.renderButtons();

		this.scope.register([], "Enter", (evt) => {
			if (isTextAreaActive()) return;
			evt.preventDefault();
			void this.submit();
		});

		titleInput?.inputEl.focus();
	}

	private renderButtons() {
		this.buttonRowEl.empty();
		if (!this.deleteConfirmState) {
			new Setting(this.buttonRowEl)
				.addButton((btn) => btn.setButtonText("Save").setCta().onClick(() => void this.submit()))
				.addButton((btn) => btn.setButtonText("Delete").onClick(() => {
					this.deleteConfirmState = true;
					this.renderButtons();
				}))
				.addExtraButton((btn) => btn.setIcon("x").setTooltip("Cancel").onClick(() => this.close()));
		} else {
			new Setting(this.buttonRowEl)
				.setName("Delete this book?")
				.setDesc("The note file will be trashed. Log entries will be kept.")
				.addButton((btn) => btn.setButtonText("Confirm delete").onClick(() => void this.deleteBook()))
				.addButton((btn) => btn.setButtonText("Cancel").onClick(() => {
					this.deleteConfirmState = false;
					this.renderButtons();
				}));
		}
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
		await submitWithNotice(async () => {
			await this.onDelete();
			this.close();
		});
	}
}

export class LogReadingSessionModal extends Modal {
	private sessionDateValue = moment().format("YYYY-MM-DD");
	private sessionTimeValue = moment().format("HH:mm");
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
		addModalHeading(contentEl, `Log session for ${this.book.title}`);

		createDateSetting(contentEl, "Session date", this.sessionDateValue, moment().format("YYYY-MM-DD"), (value) => {
			this.sessionDateValue = value.trim();
		}, "YYYY-MM-DD");

		createTimeSetting(contentEl, "Session time", this.sessionTimeValue, (value) => {
			this.sessionTimeValue = value.trim();
		}, "HH:mm");

		const currentSummary = this.describeCurrentProgress(this.book);
		let progressInput: TextComponent | undefined;
		new Setting(contentEl)
			.setName(`New current ${progressInputLabel(this.book.progress_unit)}`)
			.setDesc(currentSummary)
			.addText((text) => {
				progressInput = text;
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

		this.scope.register([], "Enter", (evt) => {
			if (isTextAreaActive()) return;
			evt.preventDefault();
			void this.submit();
		});

		if (progressInput) {
			progressInput.inputEl.focus();
			progressInput.inputEl.select();
		}
	}

	private describeCurrentProgress(book: BookRecord): string {
		if (book.progress_unit === "percent") {
			return `Currently at ${book.progress_current}%`;
		}
		const totalPart = book.progress_total === null ? "" : ` / ${book.progress_total}`;
		const percentPart = formatProgressPercent(book.progress_percent);
		return `Current ${progressUnitLabel(book.progress_unit)}: ${book.progress_current}${totalPart}${percentPart ? ` (${percentPart})` : ""}`;
	}

	private async submit() {
		await submitWithNotice(async () => {
			await this.onSubmit({
				sessionDate: normalizeSessionDate(this.sessionDateValue, moment().format("YYYY-MM-DD")),
				sessionTime: normalizeSessionTime(this.sessionTimeValue, moment().format("HH:mm")),
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
		addModalHeading(contentEl, "Add entry");

		const textContainer = contentEl.createDiv({ cls: "readlog-modal-textarea" });
		textContainer.createEl("label", { text: "Text" });
		const textArea = new TextAreaComponent(textContainer);
		textArea.setPlaceholder("Write your note or citation");
		textArea.onChange((value) => {
			this.textValue = value.trim();
		});
		textArea.inputEl.rows = 6;

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

		this.scope.register([], "Enter", (evt) => {
			if (isTextAreaActive()) return;
			evt.preventDefault();
			void this.submit();
		});

		textArea.inputEl.focus();
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

export class ConfirmModal extends Modal {
	private settled = false;

	constructor(
		app: App,
		private readonly title: string,
		private readonly body: string,
		private readonly resolve: (confirmed: boolean) => void,
		private readonly confirmLabel = "Confirm",
		private readonly cancelLabel = "Cancel"
	) {
		super(app);
	}

	static prompt(
		app: App,
		title: string,
		body: string,
		options?: { confirmLabel?: string; cancelLabel?: string }
	): Promise<boolean> {
		return new Promise((resolve) => {
			new ConfirmModal(app, title, body, resolve, options?.confirmLabel, options?.cancelLabel).open();
		});
	}

	onOpen() {
		const { contentEl } = this;
		addModalHeading(contentEl, this.title);
		for (const paragraph of this.body.split("\n\n")) {
			contentEl.createEl("p", { text: paragraph });
		}

		new Setting(contentEl)
			.addButton((btn) => {
				btn.setButtonText(this.confirmLabel).setCta().onClick(() => {
					this.settled = true;
					this.resolve(true);
					this.close();
				});
			})
			.addButton((btn) => {
				btn.setButtonText(this.cancelLabel).onClick(() => {
					this.settled = true;
					this.resolve(false);
					this.close();
				});
			});

		this.scope.register([], "Enter", () => {
			this.settled = true;
			this.resolve(true);
			this.close();
		});
	}

	onClose() {
		if (!this.settled) {
			this.resolve(false);
		}
		this.contentEl.empty();
	}
}

export class InfoModal extends Modal {
	constructor(app: App, private readonly title: string, private readonly body: string) {
		super(app);
	}

	onOpen() {
		const { contentEl } = this;
		addModalHeading(contentEl, this.title);
		for (const paragraph of this.body.split("\n\n")) {
			contentEl.createEl("p", { text: paragraph });
		}
		new Setting(contentEl)
			.addButton((btn) => btn.setButtonText("OK").setCta().onClick(() => this.close()));
		this.scope.register([], "Enter", () => this.close());
	}

	onClose() {
		this.contentEl.empty();
	}
}

function addBookStatusOptions(dropdown: DropdownComponent) {
	dropdown.addOption("to-read", "Want to read");
	dropdown.addOption("reading", "Reading");
	dropdown.addOption("done", "Finished");
	dropdown.addOption("abandoned", "Abandoned");
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

function addModalHeading(container: HTMLElement, title: string) {
	new Setting(container)
		.setName(title)
		.setHeading();
}

function isTextAreaActive(): boolean {
	return getActiveDocument().activeElement?.tagName === "TEXTAREA";
}

function getActiveDocument(): Document {
	return window.activeDocument;
}

function createTextSetting(
	container: HTMLElement,
	name: string,
	value: string,
	onChange: (value: string) => void,
	description?: string,
	onComponent?: (text: TextComponent) => void
) {
	new Setting(container)
		.setName(name)
		.setDesc(description ?? "")
		.addText((text) => {
			text.setValue(value);
			text.onChange(onChange);
			onComponent?.(text);
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

function createDateSetting(
	container: HTMLElement,
	name: string,
	value: string,
	max: string,
	onChange: (value: string) => void,
	description?: string
) {
	new Setting(container)
		.setName(name)
		.setDesc(description ?? "")
		.addText((text: TextComponent) => {
			text.inputEl.type = "date";
			text.inputEl.max = max;
			text.setValue(value);
			text.onChange(onChange);
		});
}

function createTimeSetting(
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
			text.inputEl.type = "time";
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
