import type { TFile } from "obsidian";

export type BookStatus = "to-read" | "reading" | "done" | "abandoned";
export type AddEntryType = "note" | "citation";
export type BookMedium = "print" | "ebook";
export type BookProgressUnit = "page" | "loc" | "percent";
export type KindleClippingKind = "highlight" | "note" | "bookmark";

export interface ReadlogSettings {
	rootFolder: string;
	booksFolder: string;
	readingLogFilename: string;
	dailyNotesFolderTemplate: string;
	dailyNoteNameTemplate: string;
	dailyNoteHeading: string;
}

export const DEFAULT_SETTINGS: ReadlogSettings = {
	rootFolder: "Reading",
	booksFolder: "Books",
	readingLogFilename: "reading-log.md",
	dailyNotesFolderTemplate: "Daily",
	dailyNoteNameTemplate: "{year}-{month}-{day}",
	dailyNoteHeading: "## Reading",
};

export interface BookFrontmatter {
	type: "book";
	title: string;
	author: string;
	status: BookStatus;
	added: string;
	started: string | null;
	finished: string | null;
	rating: number | null;
	progress_unit: BookProgressUnit;
	progress_current: number;
	progress_total: number | null;
	progress_percent: number | null;
	medium: BookMedium | null;
	device: string | null;
	tags: string[];
}

export interface BookRecord extends BookFrontmatter {
	file: TFile;
}

export interface AddBookValues {
	title: string;
	author: string;
	progressUnit: BookProgressUnit;
	progressTotal: number | null;
	tags: string[];
	status: BookStatus;
	medium: BookMedium | null;
	device: string | null;
}

export interface EditBookValues {
	title: string;
	author: string;
	status: BookStatus;
	progressUnit: BookProgressUnit;
	progressCurrent: number;
	progressTotal: number | null;
	medium: BookMedium | null;
	device: string | null;
	tags: string[];
	started: string | null;
	finished: string | null;
	rating: number | null;
}

export interface LogReadingSessionValues {
	sessionDate: string;
	newProgressCurrent: number;
	minutesSpent: number | null;
	note: string | null;
}

export interface LogReadingSessionResult {
	reachedEnd: boolean;
}

export interface AddEntryValues {
	type: AddEntryType;
	text: string;
	locator: string | null;
}

export interface KindleClipping {
	sourceTitle: string;
	sourceAuthor: string | null;
	kind: KindleClippingKind;
	page: number | null;
	locationStart: number | null;
	locationEnd: number | null;
	addedAt: string | null;
	text: string;
	fingerprint: string;
	order: number;
}

export interface KindleClippingGroup {
	sourceTitle: string;
	sourceAuthor: string | null;
	clippings: KindleClipping[];
}

export interface KindleImportPlanItem {
	sourceTitle: string;
	sourceAuthor: string | null;
	entries: KindleClipping[];
	matchedBook: BookRecord | null;
	isAmbiguousMatch: boolean;
}

export interface KindleImportPlan {
	books: KindleImportPlanItem[];
	matchedBooks: number;
	creatableBooks: number;
	ambiguousBooks: number;
	highlightsToImport: number;
	notesToImport: number;
	duplicatesSkipped: number;
	bookmarksSkipped: number;
	emptyEntriesSkipped: number;
}

export interface KindleImportResult {
	importedBooks: number;
	createdBooks: number;
	importedHighlights: number;
	importedNotes: number;
	skippedBooks: number;
	importedFingerprints: string[];
}
