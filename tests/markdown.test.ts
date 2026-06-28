import test from "node:test";
import assert from "node:assert/strict";
import { appendReadingLogEntry, appendToHeadingLine, appendToNamedSection, formatBookNoteContent } from "../src/markdown";

test("appendToNamedSection appends under an existing section", () => {
	const input = [
		"# Title",
		"",
		"## Notes",
		"",
		"Existing note.",
		"",
		"## Citations",
		"",
	].join("\n");

	const output = appendToNamedSection(input, "Notes", "**2026-03-26** - New note.");

	assert.equal(
		output,
		[
			"# Title",
			"",
			"## Notes",
			"",
			"Existing note.",
			"**2026-03-26** - New note.",
			"",
			"## Citations",
			"",
			"",
		].join("\n")
	);
});

test("appendToNamedSection creates a missing section", () => {
	const output = appendToNamedSection("# Title\n", "Notes", "**2026-03-26** - New note.");

	assert.equal(
		output,
		[
			"# Title",
			"",
			"## Notes",
			"",
			"**2026-03-26** - New note.",
			"",
		].join("\n")
	);
});

test("appendToHeadingLine supports custom markdown headings", () => {
	const input = [
		"# Day",
		"",
		"##### *Reading*",
		"",
		"- [[Book A]] - *locations* 10-20 (*25%-50%*, *21:10*)",
		"",
		"## Other",
		"",
	].join("\n");

	const output = appendToHeadingLine(input, "##### *Reading*", "- [[Book B]] - *pages* 20-30 (*40%-60%*, *21:40*, *30 min*)");

	assert.equal(
		output,
		[
			"# Day",
			"",
			"##### *Reading*",
			"",
			"- [[Book A]] - *locations* 10-20 (*25%-50%*, *21:10*)",
			"- [[Book B]] - *pages* 20-30 (*40%-60%*, *21:40*, *30 min*)",
			"",
			"## Other",
			"",
			"",
		].join("\n")
	);
});

test("appendReadingLogEntry appends to an existing date section", () => {
	const input = [
		"# Reading Log",
		"",
		"## 2026-03-26",
		"- **Book A** - *pages* 1-10 (*9 pages*, *10%-20%*, *20:10*)",
	].join("\n");

	const output = appendReadingLogEntry(input, "2026-03-26", "- **Book B** - *locations* 10-20 (*10 loc*, *30%-40%*, *20:40*)");

	assert.equal(
		output,
		[
			"# Reading Log",
			"",
			"## 2026-03-26",
			"- **Book A** - *pages* 1-10 (*9 pages*, *10%-20%*, *20:10*)",
			"- **Book B** - *locations* 10-20 (*10 loc*, *30%-40%*, *20:40*)",
			"",
		].join("\n")
	);
});

test("appendReadingLogEntry creates a new date section at the end", () => {
	const input = [
		"# Reading Log",
		"",
		"## 2026-03-24",
		"- **Book A** - *pages* 1-10 (*9 pages*, *10%-20%*, *20:10*)",
	].join("\n");

	const output = appendReadingLogEntry(input, "2026-03-26", "- **Book B** - *pages* 10-20 (*10 pages*, *20%-30%*, *20:40*)");

	assert.equal(
		output,
		[
			"# Reading Log",
			"",
			"## 2026-03-24",
			"- **Book A** - *pages* 1-10 (*9 pages*, *10%-20%*, *20:10*)",
			"",
			"## 2026-03-26",
			"- **Book B** - *pages* 10-20 (*10 pages*, *20%-30%*, *20:40*)",
			"",
		].join("\n")
	);
});

test("formatBookNoteContent provides the standard note body", () => {
	const output = formatBookNoteContent("---\ntitle: Test\n---");

	assert.equal(
		output,
		[
			"---",
			"title: Test",
			"---",
			"",
			"## Cover",
			"",
			"## Notes",
			"",
			"## Citations",
			"",
			"## Highlights",
			"",
			"## Log",
			"",
		].join("\n")
	);
});
