import test from "node:test";
import assert from "node:assert/strict";
import {
	migrateLegacyDailyNoteNameTemplate,
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

test("serializeFrontmatter includes medium and device", () => {
	const output = serializeFrontmatter({
		type: "book",
		title: "Dune",
		author: "Frank Herbert",
		status: "reading",
		added: "2026-03-26",
		started: "2026-03-26",
		finished: null,
		rating: null,
		pages: 412,
		progress: 40,
		medium: "ebook",
		device: "Kindle Paperwhite",
		tags: ["fiction", "sci-fi"],
	});

	assert.match(output, /medium: ebook/);
	assert.match(output, /device: "Kindle Paperwhite"/);
});
