import test from "node:test";
import assert from "node:assert/strict";
import { groupKindleClippingsByBook, normalizeBookMatchTitle, parseKindleClippings } from "../src/kindle-clippings";

const SAMPLE_CLIPPINGS = [
	"The Pragmatic Programmer (David Thomas, Andrew Hunt)",
	"- Your Highlight on page 12 | Location 345-346 | Added on Thursday, January 2, 2025 10:00:00 AM",
	"",
	"Care about your craft.",
	"==========",
	"The Pragmatic Programmer (David Thomas, Andrew Hunt)",
	"- Your Note on Location 400 | Added on Thursday, January 2, 2025 10:05:00 AM",
	"",
	"Revisit the chapter on orthogonality.",
	"==========",
	"Deep Work (Cal Newport)",
	"- Your Bookmark on page 5 | Location 88 | Added on Friday, January 3, 2025 11:00:00 AM",
	"",
	"",
	"==========",
].join("\n");

test("parseKindleClippings parses highlights, notes, and bookmarks", () => {
	const clippings = parseKindleClippings(SAMPLE_CLIPPINGS);

	assert.equal(clippings.length, 3);
	assert.equal(clippings[0]?.sourceTitle, "The Pragmatic Programmer");
	assert.equal(clippings[0]?.sourceAuthor, "David Thomas, Andrew Hunt");
	assert.equal(clippings[0]?.kind, "highlight");
	assert.equal(clippings[0]?.page, 12);
	assert.equal(clippings[0]?.locationStart, 345);
	assert.equal(clippings[0]?.locationEnd, 346);
	assert.equal(clippings[0]?.addedAt, "2025-01-02");
	assert.equal(clippings[0]?.text, "Care about your craft.");
	assert.match(clippings[0]?.fingerprint ?? "", /^kc_[0-9a-f]{8}$/);

	assert.equal(clippings[1]?.kind, "note");
	assert.equal(clippings[1]?.page, null);
	assert.equal(clippings[1]?.locationStart, 400);
	assert.equal(clippings[1]?.text, "Revisit the chapter on orthogonality.");

	assert.equal(clippings[2]?.kind, "bookmark");
	assert.equal(clippings[2]?.sourceTitle, "Deep Work");
});

test("groupKindleClippingsByBook preserves parse order within each book", () => {
	const clippings = parseKindleClippings(SAMPLE_CLIPPINGS);
	const groups = groupKindleClippingsByBook(clippings);

	assert.equal(groups.length, 2);
	assert.equal(groups[0]?.sourceTitle, "The Pragmatic Programmer");
	assert.equal(groups[0]?.clippings.length, 2);
	assert.equal(groups[0]?.clippings[0]?.kind, "highlight");
	assert.equal(groups[0]?.clippings[1]?.kind, "note");
});

test("normalizeBookMatchTitle removes punctuation and normalizes spacing", () => {
	assert.equal(normalizeBookMatchTitle(" Deep Work: Rules for Focused Success "), "deep work rules for focused success");
	assert.equal(normalizeBookMatchTitle("The Pragmatic Programmer"), "the pragmatic programmer");
});
