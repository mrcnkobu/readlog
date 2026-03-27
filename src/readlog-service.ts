import { App, TFile, moment, normalizePath, type FrontMatterCache } from "obsidian";
import { appendReadingLogEntry, appendToHeadingLine, appendToNamedSection, formatBookNoteContent } from "./markdown";
import { groupKindleClippingsByBook, normalizeBookMatchTitle } from "./kindle-clippings";
import type {
	AddBookValues,
	AddEntryValues,
	BookFrontmatter,
	BookMedium,
	BookRecord,
	BookStatus,
	EditBookValues,
	KindleClipping,
	KindleImportPlan,
	KindleImportPlanItem,
	KindleImportResult,
	LogReadingSessionResult,
	LogReadingSessionValues,
	ReadlogSettings,
} from "./types";
import {
	normalizeMarkdownHeading,
	resolveDailyTemplate,
	sanitizeFilename,
	serializeFrontmatter,
} from "./utils";

export class ReadlogService {
	constructor(
		private readonly app: App,
		private readonly getSettings: () => ReadlogSettings
	) {}

	async createBook(values: AddBookValues): Promise<TFile> {
		const settings = this.getSettings();
		await this.ensureFolder(this.booksFolderPath(settings));
		this.validateProgress(0, values.pages);

		const date = this.currentDate();
		const book: BookFrontmatter = {
			type: "book",
			title: values.title,
			author: values.author || "",
			status: values.status,
			added: date,
			started: values.status === "reading" ? date : null,
			finished: null,
			rating: null,
			pages: values.pages,
			progress: 0,
			medium: values.medium,
			device: values.device,
			tags: values.tags,
		};

		const frontmatter = serializeFrontmatter(book);
		const path = await this.getUniqueBookPath(values.title);
		return await this.app.vault.create(path, formatBookNoteContent(frontmatter));
	}

	async updateBook(file: TFile, values: EditBookValues): Promise<BookRecord> {
		const current = await this.requireBook(file);
		this.validateProgress(values.progress, values.pages);

		const nextStarted = values.status === "reading" && !values.started ? this.currentDate() : values.started;
		const nextFinished = values.status === "done" && !values.finished ? this.currentDate() : values.finished;

		await this.app.fileManager.processFrontMatter(file, (frontmatter) => {
			frontmatter.type = "book";
			frontmatter.title = values.title;
			frontmatter.author = values.author;
			frontmatter.status = values.status;
			frontmatter.added = current.added;
			setNumericOrEmpty(frontmatter, "pages", values.pages);
			frontmatter.progress = values.progress;
			setStringOrEmpty(frontmatter, "medium", values.medium);
			setStringOrEmpty(frontmatter, "device", values.device);
			frontmatter.tags = values.tags;
			setStringOrEmpty(frontmatter, "started", nextStarted);
			setStringOrEmpty(frontmatter, "finished", nextFinished);
			setNumericOrEmpty(frontmatter, "rating", values.rating);
		});

		let targetFile = file;
		if (values.title !== current.title) {
			const renamedPath = await this.getUniqueBookPath(values.title, file);
			if (renamedPath !== file.path) {
				await this.app.fileManager.renameFile(file, renamedPath);
				const renamed = this.app.vault.getAbstractFileByPath(renamedPath);
				if (renamed instanceof TFile) {
					targetFile = renamed;
				}
			}
		}

		return await this.requireBook(targetFile);
	}

	async deleteBook(file: TFile): Promise<void> {
		await this.requireBook(file);
		await this.app.vault.trash(file, false);
	}

	async logReadingSession(file: TFile, values: LogReadingSessionValues): Promise<LogReadingSessionResult> {
		const book = await this.requireBook(file);
		const totalPages = book.pages;

		if (!totalPages || totalPages <= 0) {
			throw new Error("Set the book page count before logging a session.");
		}

		if (values.newPage < book.progress) {
			throw new Error("New current page cannot be lower than current progress.");
		}

		if (values.newPage > totalPages) {
			throw new Error("New current page cannot exceed total pages.");
		}

		if (values.minutesSpent !== null && values.minutesSpent < 0) {
			throw new Error("Minutes spent cannot be negative.");
		}

		await this.app.fileManager.processFrontMatter(file, (frontmatter) => {
			frontmatter.status = "reading";
			frontmatter.progress = values.newPage;
			if (!frontmatter.started) {
				frontmatter.started = this.currentDate();
			}
		});

		const date = this.currentDate();
		const time = this.currentTime();
		const delta = values.newPage - book.progress;
		const logEntry = this.buildReadingLogEntry(
			book.title,
			book.progress,
			values.newPage,
			delta,
			time,
			values.minutesSpent,
			values.note
		);
		await this.appendReadingLog(date, logEntry);
		await this.appendDailyNote(
			date,
			this.buildDailyNoteEntry(book.file.basename, book.progress, values.newPage, time, values.minutesSpent)
		);

		return {
			reachedEnd: values.newPage === totalPages,
		};
	}

	async addEntry(file: TFile, values: AddEntryValues): Promise<void> {
		await this.requireBook(file);
		const content = await this.app.vault.read(file);
		const date = this.currentDate();
		const entry = values.type === "citation"
			? this.buildCitationEntry(values.text, values.locator)
			: this.buildNoteEntry(date, values.text, values.locator);
		const section = values.type === "citation" ? "Citations" : "Notes";
		const updated = appendToNamedSection(content, section, entry);
		await this.app.vault.modify(file, updated);
	}

	async planKindleImport(clippings: KindleClipping[], importedFingerprints: Iterable<string>): Promise<KindleImportPlan> {
		const books = await this.listBooks();
		const knownFingerprints = new Set(importedFingerprints);
		const pendingFingerprints = new Set<string>();
		const groups = groupKindleClippingsByBook(clippings);

		const planItems: KindleImportPlanItem[] = [];
		let matchedBooks = 0;
		let creatableBooks = 0;
		let ambiguousBooks = 0;
		let highlightsToImport = 0;
		let notesToImport = 0;
		let duplicatesSkipped = 0;
		let bookmarksSkipped = 0;
		let emptyEntriesSkipped = 0;

		for (const group of groups) {
			const entries: KindleClipping[] = [];
			for (const clipping of group.clippings) {
				if (clipping.kind === "bookmark") {
					bookmarksSkipped += 1;
					continue;
				}

				if (!clipping.text) {
					emptyEntriesSkipped += 1;
					continue;
				}

				if (knownFingerprints.has(clipping.fingerprint) || pendingFingerprints.has(clipping.fingerprint)) {
					duplicatesSkipped += 1;
					continue;
				}

				pendingFingerprints.add(clipping.fingerprint);
				entries.push(clipping);
				if (clipping.kind === "highlight") {
					highlightsToImport += 1;
				} else if (clipping.kind === "note") {
					notesToImport += 1;
				}
			}

			if (entries.length === 0) {
				continue;
			}

			const matches = this.findMatchingBooks(group.sourceTitle, books);
			const isAmbiguousMatch = matches.length > 1;
			const matchedBook = matches.length === 1 ? matches[0] : null;

			if (isAmbiguousMatch) {
				ambiguousBooks += 1;
			} else if (matchedBook) {
				matchedBooks += 1;
			} else {
				creatableBooks += 1;
			}

			planItems.push({
				sourceTitle: group.sourceTitle,
				sourceAuthor: group.sourceAuthor,
				entries,
				matchedBook,
				isAmbiguousMatch,
			});
		}

		return {
			books: planItems,
			matchedBooks,
			creatableBooks,
			ambiguousBooks,
			highlightsToImport,
			notesToImport,
			duplicatesSkipped,
			bookmarksSkipped,
			emptyEntriesSkipped,
		};
	}

	async applyKindleImport(
		plan: KindleImportPlan,
		options: { createMissingBooks: boolean }
	): Promise<KindleImportResult> {
		let importedBooks = 0;
		let createdBooks = 0;
		let importedHighlights = 0;
		let importedNotes = 0;
		let skippedBooks = 0;
		const importedFingerprints: string[] = [];

		for (const item of plan.books) {
			if (item.isAmbiguousMatch) {
				skippedBooks += 1;
				continue;
			}

			let targetBook = item.matchedBook;
			if (!targetBook) {
				if (!options.createMissingBooks) {
					skippedBooks += 1;
					continue;
				}

				targetBook = await this.createBookFromKindleImport(item.sourceTitle, item.sourceAuthor);
				createdBooks += 1;
			}

			await this.appendKindleClippingsToBook(targetBook.file, item.entries);
			importedBooks += 1;
			for (const entry of item.entries) {
				importedFingerprints.push(entry.fingerprint);
				if (entry.kind === "highlight") {
					importedHighlights += 1;
				} else if (entry.kind === "note") {
					importedNotes += 1;
				}
			}
		}

		return {
			importedBooks,
			createdBooks,
			importedHighlights,
			importedNotes,
			skippedBooks,
			importedFingerprints,
		};
	}

	async listBooks(): Promise<BookRecord[]> {
		const settings = this.getSettings();
		const folderPath = `${this.booksFolderPath(settings)}/`;
		const files = this.app.vault
			.getMarkdownFiles()
			.filter((file) => file.path.startsWith(folderPath));

		const books: BookRecord[] = [];
		for (const file of files) {
			const record = await this.loadBookRecord(file);
			if (record) {
				books.push(record);
			}
		}

		return books.sort((left, right) => left.title.localeCompare(right.title));
	}

	async getActiveBook(): Promise<BookRecord | null> {
		const activeFile = this.app.workspace.getActiveFile();
		if (!activeFile) {
			return null;
		}

		const settings = this.getSettings();
		if (!activeFile.path.startsWith(`${this.booksFolderPath(settings)}/`)) {
			return null;
		}

		return await this.loadBookRecord(activeFile);
	}

	private async createBookFromKindleImport(title: string, author: string | null): Promise<BookRecord> {
		const file = await this.createBook({
			title,
			author: author ?? "",
			pages: null,
			tags: [],
			status: "to-read",
			medium: "ebook",
			device: "Kindle",
		});
		return await this.requireBook(file);
	}

	private async appendKindleClippingsToBook(file: TFile, entries: KindleClipping[]): Promise<void> {
		let content = await this.app.vault.read(file);
		for (const entry of entries) {
			const locator = this.formatKindleLocator(entry);
			if (entry.kind === "highlight") {
				content = appendToNamedSection(content, "Citations", this.buildCitationEntry(entry.text, locator));
			} else if (entry.kind === "note") {
				content = appendToNamedSection(
					content,
					"Notes",
					this.buildImportedKindleNoteEntry(entry.addedAt ?? this.currentDate(), entry.text, locator)
				);
			}
		}

		await this.app.vault.modify(file, content);
	}

	private findMatchingBooks(title: string, books: BookRecord[]): BookRecord[] {
		const trimmed = title.trim();
		const exactMatches = books.filter((book) => book.title.trim().toLowerCase() === trimmed.toLowerCase());
		if (exactMatches.length > 0) {
			return exactMatches;
		}

		const normalized = normalizeBookMatchTitle(trimmed);
		return books.filter((book) => normalizeBookMatchTitle(book.title) === normalized);
	}

	private async appendReadingLog(date: string, entry: string): Promise<void> {
		const settings = this.getSettings();
		await this.ensureFolder(this.rootFolderPath(settings));

		const path = this.readingLogPath(settings);
		const existing = await this.readOrCreate(path, "# Reading Log\n");
		const updated = appendReadingLogEntry(existing, date, entry);
		await this.app.vault.adapter.write(path, updated);
	}

	private async appendDailyNote(date: string, entry: string): Promise<void> {
		const settings = this.getSettings();
		const resolvedFolder = resolveDailyTemplate(settings.dailyNotesFolderTemplate, date);
		await this.ensureFolder(resolvedFolder);

		const resolvedName = resolveDailyTemplate(settings.dailyNoteNameTemplate, date);
		const path = normalizePath(`${resolvedFolder}/${resolvedName}.md`);
		const existing = await this.readOrCreate(path, "");
		const updated = appendToHeadingLine(existing, normalizeMarkdownHeading(settings.dailyNoteHeading), entry);
		await this.app.vault.adapter.write(path, updated);
	}

	private buildDailyNoteEntry(
		bookBasename: string,
		previousPage: number,
		newPage: number,
		time: string,
		minutesSpent: number | null
	): string {
		const meta = [`*${time}*`];
		if (minutesSpent !== null) {
			meta.push(`*${minutesSpent} min*`);
		}

		return `- [[${bookBasename}]] - *pages* ${previousPage}-${newPage} (${meta.join(", ")})`;
	}

	private buildReadingLogEntry(
		title: string,
		previousPage: number,
		newPage: number,
		delta: number,
		time: string,
		minutesSpent: number | null,
		note: string | null
	): string {
		const meta = [`*${delta} pages*`, `*${time}*`];
		if (minutesSpent !== null) {
			meta.splice(1, 0, `*${minutesSpent} min*`);
		}

		const lines = [`- **${title}** - *pages* ${previousPage}-${newPage} (${meta.join(", ")})`];
		if (note) {
			lines.push(`  > ${note}`);
		}
		return lines.join("\n");
	}

	private buildNoteEntry(date: string, text: string, locator: string | null): string {
		const suffix = locator ? ` (${locator})` : "";
		return `**${date}** - ${text}${suffix}`;
	}

	private buildImportedKindleNoteEntry(date: string, text: string, locator: string | null): string {
		const suffix = locator ? ` (${locator})` : "";
		return `**${date}** - Imported from Kindle: ${text}${suffix}`;
	}

	private buildCitationEntry(text: string, locator: string | null): string {
		const suffix = locator ? ` - ${locator}` : "";
		return `> "${text}"${suffix}`;
	}

	private formatKindleLocator(entry: KindleClipping): string | null {
		const parts: string[] = [];
		if (entry.page !== null) {
			parts.push(`p. ${entry.page}`);
		}
		if (entry.locationStart !== null) {
			const locationEnd = entry.locationEnd ?? entry.locationStart;
			parts.push(
				entry.locationStart === locationEnd
					? `loc. ${entry.locationStart}`
					: `loc. ${entry.locationStart}-${locationEnd}`
			);
		}
		return parts.length > 0 ? parts.join("; ") : null;
	}

	private currentDate(): string {
		return moment().format("YYYY-MM-DD");
	}

	private currentTime(): string {
		return moment().format("HH:mm");
	}

	private async requireBook(file: TFile): Promise<BookRecord> {
		const book = await this.loadBookRecord(file);
		if (!book) {
			throw new Error("Selected file is not a valid Readlog book.");
		}
		return book;
	}

	private async loadBookRecord(file: TFile): Promise<BookRecord | null> {
		const frontmatter = this.readFrontmatter(file);
		if (!frontmatter || frontmatter.type !== "book") {
			return null;
		}

		const title = readString(frontmatter, "title") ?? file.basename;
		const author = readString(frontmatter, "author") ?? "";
		const status = readBookStatus(frontmatter.status);
		const added = readString(frontmatter, "added") ?? this.currentDate();
		const started = readNullableString(frontmatter, "started");
		const finished = readNullableString(frontmatter, "finished");
		const rating = readNullableNumber(frontmatter, "rating");
		const pages = readNullableNumber(frontmatter, "pages");
		const progress = readNullableNumber(frontmatter, "progress") ?? 0;
		const medium = readBookMedium(frontmatter.medium);
		const device = readNullableString(frontmatter, "device");
		const tags = readStringArray(frontmatter, "tags");

		return {
			file,
			title,
			author,
			status,
			added,
			started,
			finished,
			rating,
			pages,
			progress,
			medium,
			device,
			tags,
		};
	}

	private readFrontmatter(file: TFile): FrontMatterCache | null {
		return this.app.metadataCache.getFileCache(file)?.frontmatter ?? null;
	}

	private async ensureFolder(path: string): Promise<void> {
		if (!path) {
			return;
		}

		const normalized = normalizePath(path);
		if (this.app.vault.getAbstractFileByPath(normalized)) {
			return;
		}

		const parts = normalized.split("/");
		for (let index = 1; index <= parts.length; index += 1) {
			const folderPath = parts.slice(0, index).join("/");
			if (!folderPath) {
				continue;
			}

			if (!this.app.vault.getAbstractFileByPath(folderPath)) {
				await this.app.vault.createFolder(folderPath);
			}
		}
	}

	private async readOrCreate(path: string, initialContent: string): Promise<string> {
		if (await this.app.vault.adapter.exists(path)) {
			return await this.app.vault.adapter.read(path);
		}

		await this.app.vault.adapter.write(path, initialContent);
		return initialContent;
	}

	private async getUniqueBookPath(title: string, currentFile?: TFile): Promise<string> {
		const settings = this.getSettings();
		const baseFolder = this.booksFolderPath(settings);
		const safeBase = sanitizeFilename(title) || "Untitled";
		let suffix = 0;

		while (true) {
			const candidateName = suffix === 0 ? safeBase : `${safeBase} ${suffix + 1}`;
			const candidatePath = normalizePath(`${baseFolder}/${candidateName}.md`);
			if (currentFile && candidatePath === currentFile.path) {
				return candidatePath;
			}

			if (!(await this.app.vault.adapter.exists(candidatePath))) {
				return candidatePath;
			}

			suffix += 1;
		}
	}

	private validateProgress(progress: number, pages: number | null) {
		if (progress < 0) {
			throw new Error("Progress cannot be negative.");
		}

		if (pages !== null && pages < 0) {
			throw new Error("Pages cannot be negative.");
		}

		if (pages !== null && progress > pages) {
			throw new Error("Progress cannot exceed total pages.");
		}
	}

	private rootFolderPath(settings: ReadlogSettings): string {
		return normalizePath(settings.rootFolder);
	}

	private booksFolderPath(settings: ReadlogSettings): string {
		return normalizePath(`${settings.rootFolder}/${settings.booksFolder}`);
	}

	private readingLogPath(settings: ReadlogSettings): string {
		return normalizePath(`${settings.rootFolder}/${settings.readingLogFilename}`);
	}
}

function readString(frontmatter: FrontMatterCache, key: string): string | null {
	const value = frontmatter[key];
	return typeof value === "string" ? value : null;
}

function readNullableString(frontmatter: FrontMatterCache, key: string): string | null {
	const value = frontmatter[key];
	if (typeof value === "string" && value.length > 0) {
		return value;
	}
	return null;
}

function readNullableNumber(frontmatter: FrontMatterCache, key: string): number | null {
	const value = frontmatter[key];
	return typeof value === "number" ? value : null;
}

function readStringArray(frontmatter: FrontMatterCache, key: string): string[] {
	const value = frontmatter[key];
	return Array.isArray(value) ? value.filter((item): item is string => typeof item === "string") : [];
}

function readBookStatus(value: unknown): BookStatus {
	return value === "reading" || value === "done" || value === "abandoned" || value === "to-read"
		? value
		: "to-read";
}

function readBookMedium(value: unknown): BookMedium | null {
	return value === "print" || value === "ebook" ? value : null;
}

function setStringOrEmpty(frontmatter: Record<string, unknown>, key: string, value: string | null) {
	frontmatter[key] = value ?? "";
}

function setNumericOrEmpty(frontmatter: Record<string, unknown>, key: string, value: number | null) {
	frontmatter[key] = value ?? "";
}
