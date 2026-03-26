import type { BookFrontmatter } from "./types";

const LEGACY_NAME_TOKEN_MAP: Array<[string, string]> = [
	["YYYY", "{year}"],
	["MM", "{month}"],
	["DD", "{day}"],
	["dddd", "{weekday_long}"],
	["ddd", "{weekday_short}"],
];

export function sanitizeFilename(value: string): string {
	return value
		.replace(/[\\/:*?"<>|]/g, "")
		.replace(/\s+/g, " ")
		.trim();
}

export function normalizeMarkdownHeading(value: string): string {
	const trimmed = value.trim();
	if (!trimmed) {
		return "## Reading";
	}

	return /^#{1,6}\s+/.test(trimmed) ? trimmed : `## ${trimmed}`;
}

export function migrateLegacyDailyNoteNameTemplate(value: string | undefined): string {
	const trimmed = value?.trim();
	if (!trimmed) {
		return "{year}-{month}-{day}";
	}

	if (trimmed.includes("{")) {
		return trimmed;
	}

	let migrated = trimmed;
	for (const [legacyToken, shortcode] of LEGACY_NAME_TOKEN_MAP) {
		migrated = migrated.replaceAll(legacyToken, shortcode);
	}
	return migrated;
}

export function normalizeDailyFolderTemplate(value: string): string {
	return normalizeVaultPath(value.trim() || "Daily");
}

export function normalizeDailyNameTemplate(value: string): string {
	const trimmed = value.trim() || "{year}-{month}-{day}";
	if (/[\\/]/.test(trimmed)) {
		throw new Error("Daily note name template cannot contain path separators.");
	}
	return trimmed;
}

export function resolveDailyTemplate(template: string, date: string): string {
	const resolvedDate = parseIsoDate(date);
	const replacements: Record<string, string> = {
		"{year}": String(resolvedDate.getFullYear()),
		"{month}": pad2(resolvedDate.getMonth() + 1),
		"{day}": pad2(resolvedDate.getDate()),
		"{weekday_short}": SHORT_WEEKDAYS[resolvedDate.getDay()],
		"{weekday_long}": LONG_WEEKDAYS[resolvedDate.getDay()],
	};

	let output = template;
	for (const [token, tokenValue] of Object.entries(replacements)) {
		output = output.replaceAll(token, tokenValue);
	}
	return output;
}

export function serializeFrontmatter(book: BookFrontmatter): string {
	const lines = [
		"---",
		"type: book",
		`title: ${escapeYamlString(book.title)}`,
		`author: ${escapeYamlString(book.author)}`,
		`status: ${book.status}`,
		`added: ${book.added}`,
		`started: ${book.started ?? ""}`,
		`finished: ${book.finished ?? ""}`,
		`rating: ${book.rating ?? ""}`,
		`pages: ${book.pages ?? ""}`,
		`progress: ${book.progress}`,
		`medium: ${book.medium ?? ""}`,
		`device: ${book.device ? escapeYamlString(book.device) : ""}`,
		`tags: [${book.tags.map((tag) => escapeInlineYaml(tag)).join(", ")}]`,
		"---",
	];

	return lines.join("\n");
}

const SHORT_WEEKDAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"] as const;
const LONG_WEEKDAYS = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"] as const;

function normalizeVaultPath(value: string): string {
	return value
		.replace(/\\/g, "/")
		.replace(/\/+/g, "/")
		.replace(/^\.\//, "")
		.replace(/\/$/, "");
}

function parseIsoDate(value: string): Date {
	const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value);
	if (!match) {
		throw new Error(`Invalid ISO date: ${value}`);
	}

	const [, year, month, day] = match;
	return new Date(Number(year), Number(month) - 1, Number(day));
}

function pad2(value: number): string {
	return String(value).padStart(2, "0");
}

function escapeYamlString(value: string): string {
	if (!value) {
		return '""';
	}

	return `"${value.replace(/"/g, '\\"')}"`;
}

function escapeInlineYaml(value: string): string {
	const trimmed = value.trim();
	return /^[a-zA-Z0-9_-]+$/.test(trimmed) ? trimmed : `"${trimmed.replace(/"/g, '\\"')}"`;
}
