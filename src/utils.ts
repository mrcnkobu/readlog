import type { BookFrontmatter, BookProgressUnit } from "./types";

const LEGACY_NAME_TOKEN_MAP: Array<[string, string]> = [
	["YYYY", "{year}"],
	["MM", "{month}"],
	["DD", "{day}"],
	["dddd", "{weekday_long}"],
	["ddd", "{weekday_short}"],
];

const SHORT_WEEKDAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"] as const;
const LONG_WEEKDAYS = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"] as const;
const DAILY_TEMPLATE_TOKENS = [
	"{year}",
	"{month}",
	"{day}",
	"{weekday_short}",
	"{weekday_long}",
] as const;

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
		migrated = replaceAllText(migrated, legacyToken, shortcode);
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

export function normalizeSessionDate(value: string, today: string): string {
	const trimmed = value.trim();
	if (!trimmed) {
		return today;
	}

	parseIsoDate(trimmed);
	const currentDate = parseIsoDate(today);
	const sessionDate = parseIsoDate(trimmed);
	if (sessionDate.getTime() > currentDate.getTime()) {
		throw new Error("Session date cannot be in the future.");
	}
	return trimmed;
}

export function normalizeSessionTime(value: string, now: string): string {
	const trimmed = value.trim();
	if (!trimmed) {
		return now;
	}

	if (!/^([01]\d|2[0-3]):[0-5]\d$/.test(trimmed)) {
		throw new Error("Session time must use HH:mm format.");
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
	for (const token of DAILY_TEMPLATE_TOKENS) {
		output = replaceAllText(output, token, replacements[token]);
	}
	return output;
}

export function normalizeBookProgress(input: {
	unit: BookProgressUnit;
	current: number;
	total: number | null;
}): { unit: BookProgressUnit; current: number; total: number | null; percent: number | null } {
	if (!Number.isFinite(input.current) || input.current < 0) {
		throw new Error("Progress cannot be negative.");
	}

	const normalizedTotal = normalizeProgressTotal(input.unit, input.total);
	if (normalizedTotal !== null && input.current > normalizedTotal) {
		throw new Error("Current progress cannot exceed the total progress.");
	}

	const percent = computeProgressPercent(input.unit, input.current, normalizedTotal);
	return {
		unit: input.unit,
		current: input.current,
		total: normalizedTotal,
		percent,
	};
}

export function normalizeBookProgressFrontmatter(
	frontmatter: Record<string, unknown>
): { unit: BookProgressUnit; current: number; total: number | null; percent: number | null } {
	const hasModernProgress = frontmatter.progress_unit !== undefined
		|| frontmatter.progress_current !== undefined
		|| frontmatter.progress_total !== undefined;
	const unit = hasModernProgress ? readBookProgressUnit(frontmatter.progress_unit) : "page";
	const current = readFrontmatterNumber(frontmatter.progress_current)
		?? readFrontmatterNumber(frontmatter.progress)
		?? 0;
	const total = readFrontmatterNumber(frontmatter.progress_total)
		?? readFrontmatterNumber(frontmatter.pages);
	const percent = readFrontmatterNumber(frontmatter.progress_percent)
		?? computeProgressPercent(unit, current, total);

	return { unit, current, total, percent };
}

export function normalizeProgressTotal(unit: BookProgressUnit, total: number | null): number | null {
	if (unit === "percent") {
		return 100;
	}

	if (total === null) {
		return null;
	}

	if (!Number.isFinite(total) || total <= 0) {
		throw new Error("Progress total must be greater than zero.");
	}

	return total;
}

export function computeProgressPercent(unit: BookProgressUnit, current: number, total: number | null): number | null {
	if (unit === "percent") {
		return clampPercent(current);
	}

	if (total === null) {
		return null;
	}

	return clampPercent((current / total) * 100);
}

export function formatProgressPercent(value: number | null): string | null {
	return value === null ? null : `${value}%`;
}

export function progressUnitLabel(unit: BookProgressUnit): string {
	switch (unit) {
		case "page":
			return "pages";
		case "loc":
			return "locations";
		case "percent":
			return "percent";
	}
}

export function progressDeltaLabel(unit: BookProgressUnit, delta: number): string {
	switch (unit) {
		case "page":
			return `${delta} pages`;
		case "loc":
			return `${delta} loc`;
		case "percent":
			return `${delta} percentage points`;
	}
}

export function progressInputLabel(unit: BookProgressUnit): string {
	switch (unit) {
		case "page":
			return "page";
		case "loc":
			return "location";
		case "percent":
			return "percent";
	}
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
		`progress_unit: ${book.progress_unit}`,
		`progress_current: ${book.progress_current}`,
		`progress_total: ${book.progress_total ?? ""}`,
		`progress_percent: ${book.progress_percent ?? ""}`,
		`medium: ${book.medium ?? ""}`,
		`device: ${book.device ? escapeYamlString(book.device) : ""}`,
		`tags: [${book.tags.map((tag) => escapeInlineYaml(tag)).join(", ")}]`,
		"---",
	];

	return lines.join("\n");
}

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
	const parsed = new Date(Number(year), Number(month) - 1, Number(day));
	if (
		parsed.getFullYear() !== Number(year)
		|| parsed.getMonth() !== Number(month) - 1
		|| parsed.getDate() !== Number(day)
	) {
		throw new Error(`Invalid ISO date: ${value}`);
	}
	return parsed;
}

function pad2(value: number): string {
	return String(value).padStart(2, "0");
}

function replaceAllText(value: string, search: string, replacement: string): string {
	return value.split(search).join(replacement);
}

function clampPercent(value: number): number {
	return Math.max(0, Math.min(100, Math.round(value)));
}

function readFrontmatterNumber(value: unknown): number | null {
	return typeof value === "number" ? value : null;
}

function readBookProgressUnit(value: unknown): BookProgressUnit {
	return value === "page" || value === "loc" || value === "percent" ? value : "page";
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
