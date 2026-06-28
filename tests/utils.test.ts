import test from "node:test";
import assert from "node:assert/strict";
import {
	formatProgressPercent,
	migrateLegacyDailyNoteNameTemplate,
	normalizeBookProgress,
	normalizeBookProgressFrontmatter,
	normalizeDailyFolderTemplate,
	normalizeDailyNameTemplate,
	resolveDailyTemplate,
	serializeFrontmatter,
} from "../src/utils";

test("migrateLegacyDailyNoteNameTemplate converts legacy tokens", () => {
	assert.equal(
		migrateLegacyDailyNoteNameTemplate("YYYY-MM-DD_ddd"),
		"{year}-{month}-{day}_{weekday_short}"
	);
});

test("normalizeDailyFolderTemplate keeps nested folder templates", () => {
	assert.equal(normalizeDailyFolderTemplate("  {year}-{month}/Journal  "), "{year}-{month}/Journal");
});

test("normalizeDailyNameTemplate rejects path separators", () => {
	assert.throws(
		() => normalizeDailyNameTemplate("{year}/{month}-{day}"),
		/contain path separators/
	);
	assert.throws(
		() => normalizeDailyNameTemplate("{year}\\{month}-{day}"),
		/contain path separators/
	);
});

test("resolveDailyTemplate expands supported shortcodes", () => {
	assert.equal(
		resolveDailyTemplate("{year}-{month}/{year}-{month}-{day}_{weekday_short}", "2025-01-06"),
		"2025-01/2025-01-06_Mon"
	);
});

test("normalizeBookProgress computes percent for loc progress", () => {
	const output = normalizeBookProgress({
		unit: "loc",
		current: 1500,
		total: 3000,
	});

	assert.deepEqual(output, {
		unit: "loc",
		current: 1500,
		total: 3000,
		percent: 50,
	});
	assert.equal(formatProgressPercent(output.percent), "50%");
});

test("normalizeBookProgress allows page progress without a known total", () => {
	const output = normalizeBookProgress({
		unit: "page",
		current: 42,
		total: null,
	});

	assert.deepEqual(output, {
		unit: "page",
		current: 42,
		total: null,
		percent: null,
	});
});

test("normalizeBookProgress keeps percent books on a 100-point total", () => {
	const output = normalizeBookProgress({
		unit: "percent",
		current: 42,
		total: null,
	});

	assert.deepEqual(output, {
		unit: "percent",
		current: 42,
		total: 100,
		percent: 42,
	});
});

test("normalizeBookProgressFrontmatter reads legacy page frontmatter", () => {
	const output = normalizeBookProgressFrontmatter({
		pages: 320,
		progress: 80,
	});

	assert.deepEqual(output, {
		unit: "page",
		current: 80,
		total: 320,
		percent: 25,
	});
});

test("normalizeBookProgressFrontmatter prefers modern progress fields over legacy fields", () => {
	const output = normalizeBookProgressFrontmatter({
		progress_unit: "loc",
		progress_current: 1500,
		progress_total: 3000,
		progress_percent: 50,
		pages: 320,
		progress: 80,
	});

	assert.deepEqual(output, {
		unit: "loc",
		current: 1500,
		total: 3000,
		percent: 50,
	});
});

test("serializeFrontmatter includes the new progress fields", () => {
	const output = serializeFrontmatter({
		type: "book",
		title: "Dune",
		author: "Frank Herbert",
		status: "reading",
		added: "2026-03-26",
		started: "2026-03-26",
		finished: null,
		rating: null,
		progress_unit: "loc",
		progress_current: 1845,
		progress_total: 3200,
		progress_percent: 58,
		medium: "ebook",
		device: "Kindle Paperwhite",
		tags: ["fiction", "sci-fi"],
	});

	assert.match(output, /progress_unit: loc/);
	assert.match(output, /progress_current: 1845/);
	assert.match(output, /progress_total: 3200/);
	assert.match(output, /progress_percent: 58/);
	assert.match(output, /device: "Kindle Paperwhite"/);
});
