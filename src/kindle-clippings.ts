import type { KindleClipping, KindleClippingGroup, KindleClippingKind } from "./types";

export function parseKindleClippings(text: string): KindleClipping[] {
	const rawEntries = text
		.split(/==========\s*/g)
		.map((entry) => entry.trim())
		.filter(Boolean);

	const clippings: KindleClipping[] = [];
	for (const [index, rawEntry] of rawEntries.entries()) {
		const clipping = parseClippingEntry(rawEntry, index);
		if (clipping) {
			clippings.push(clipping);
		}
	}

	return clippings;
}

export function groupKindleClippingsByBook(clippings: KindleClipping[]): KindleClippingGroup[] {
	const groups = new Map<string, KindleClippingGroup>();

	for (const clipping of clippings) {
		const key = `${clipping.sourceTitle}\u001f${clipping.sourceAuthor ?? ""}`;
		const existing = groups.get(key);
		if (existing) {
			existing.clippings.push(clipping);
			continue;
		}

		groups.set(key, {
			sourceTitle: clipping.sourceTitle,
			sourceAuthor: clipping.sourceAuthor,
			clippings: [clipping],
		});
	}

	return [...groups.values()].map((group) => ({
		...group,
		clippings: [...group.clippings].sort((left, right) => left.order - right.order),
	}));
}

export function normalizeBookMatchTitle(title: string): string {
	return title
		.toLowerCase()
		.replace(/[“”‘’]/g, "")
		.replace(/[^a-z0-9]+/g, " ")
		.trim()
		.replace(/\s+/g, " ");
}

function parseClippingEntry(rawEntry: string, order: number): KindleClipping | null {
	const lines = rawEntry.split(/\r?\n/);
	if (lines.length < 2) {
		return null;
	}

	const headerLine = lines[0]?.trim();
	const metadataLine = lines[1]?.trim();
	if (!headerLine || !metadataLine) {
		return null;
	}

	const bookMeta = parseBookHeader(headerLine);
	const clippingMeta = parseMetadataLine(metadataLine);
	if (!clippingMeta) {
		return null;
	}

	const body = lines
		.slice(2)
		.join("\n")
		.trim()
		.split(/\r?\n+/)
		.map((line) => line.trim())
		.filter(Boolean)
		.join(" ");

	return {
		sourceTitle: bookMeta.title,
		sourceAuthor: bookMeta.author,
		kind: clippingMeta.kind,
		page: clippingMeta.page,
		locationStart: clippingMeta.locationStart,
		locationEnd: clippingMeta.locationEnd,
		addedAt: clippingMeta.addedAt,
		text: body,
		fingerprint: buildClippingFingerprint({
			sourceTitle: bookMeta.title,
			sourceAuthor: bookMeta.author,
			kind: clippingMeta.kind,
			page: clippingMeta.page,
			locationStart: clippingMeta.locationStart,
			locationEnd: clippingMeta.locationEnd,
			text: body,
		}),
		order,
	};
}

function parseBookHeader(headerLine: string): { title: string; author: string | null } {
	const match = /^(.*?)(?:\s+\(([^()]*)\))?$/.exec(headerLine.trim());
	if (!match) {
		return { title: headerLine.trim(), author: null };
	}

	const [, rawTitle, rawAuthor] = match;
	return {
		title: rawTitle.trim(),
		author: rawAuthor?.trim() || null,
	};
}

function parseMetadataLine(metadataLine: string): {
	kind: KindleClippingKind;
	page: number | null;
	locationStart: number | null;
	locationEnd: number | null;
	addedAt: string | null;
} | null {
	const kindMatch = /-\s*Your\s+(Highlight|Note|Bookmark)\s+on\s+/i.exec(metadataLine);
	if (!kindMatch) {
		return null;
	}

	const pageMatch = /page\s+(\d+)/i.exec(metadataLine);
	const locationMatch = /location\s+(\d+)(?:-(\d+))?/i.exec(metadataLine);
	const addedOnMatch = /\|\s*Added on\s+(.+)$/i.exec(metadataLine);

	return {
		kind: kindMatch[1].toLowerCase() as KindleClippingKind,
		page: pageMatch ? Number(pageMatch[1]) : null,
		locationStart: locationMatch ? Number(locationMatch[1]) : null,
		locationEnd: locationMatch ? Number(locationMatch[2] ?? locationMatch[1]) : null,
		addedAt: parseAddedAtDate(addedOnMatch?.[1] ?? null),
	};
}

function parseAddedAtDate(value: string | null): string | null {
	if (!value) {
		return null;
	}

	const parsed = new Date(value);
	if (Number.isNaN(parsed.getTime())) {
		return null;
	}

	const year = String(parsed.getFullYear());
	const month = String(parsed.getMonth() + 1).padStart(2, "0");
	const day = String(parsed.getDate()).padStart(2, "0");
	return `${year}-${month}-${day}`;
}

function buildClippingFingerprint(input: {
	sourceTitle: string;
	sourceAuthor: string | null;
	kind: KindleClippingKind;
	page: number | null;
	locationStart: number | null;
	locationEnd: number | null;
	text: string;
}): string {
	const raw = [
		normalizeBookMatchTitle(input.sourceTitle),
		(input.sourceAuthor ?? "").trim().toLowerCase(),
		input.kind,
		String(input.page ?? ""),
		String(input.locationStart ?? ""),
		String(input.locationEnd ?? ""),
		input.text.trim().replace(/\s+/g, " "),
	].join("\u001f");

	let hash = 2166136261;
	for (let index = 0; index < raw.length; index += 1) {
		hash ^= raw.charCodeAt(index);
		hash = Math.imul(hash, 16777619);
	}

	return `kc_${(hash >>> 0).toString(16).padStart(8, "0")}`;
}
