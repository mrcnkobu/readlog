import type { TFile } from "obsidian";

export type BookStatus = "to-read" | "reading" | "done" | "abandoned";
export type AddEntryType = "note" | "citation";
export type BookMedium = "print" | "ebook";

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
	pages: number | null;
	progress: number;
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
	pages: number | null;
	tags: string[];
	status: BookStatus;
	medium: BookMedium | null;
	device: string | null;
}

export interface EditBookValues {
	title: string;
	author: string;
	status: BookStatus;
	pages: number | null;
	progress: number;
	medium: BookMedium | null;
	device: string | null;
	tags: string[];
	started: string | null;
	finished: string | null;
	rating: number | null;
}

export interface LogReadingSessionValues {
	newPage: number;
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
