export function appendToHeadingLine(content: string, headingLine: string, entry: string): string {
	const normalizedContent = normalizeNewlines(content);
	const normalizedHeading = headingLine.trim();
	const normalizedEntry = entry.trim();
	const lines = normalizedContent.split("\n");
	const headingIndex = lines.findIndex((line) => line.trim() === normalizedHeading);

	if (headingIndex === -1) {
		const trimmed = normalizedContent.trimEnd();
		return trimmed.length > 0
			? `${trimmed}\n\n${normalizedHeading}\n\n${normalizedEntry}\n`
			: `${normalizedHeading}\n\n${normalizedEntry}\n`;
	}

	let insertIndex = lines.length;
	for (let index = headingIndex + 1; index < lines.length; index += 1) {
		if (/^#{1,6}\s+/.test(lines[index])) {
			insertIndex = index;
			break;
		}
	}

	const before = lines.slice(0, insertIndex).join("\n").trimEnd();
	const after = lines.slice(insertIndex).join("\n").trimStart();
	const middle = before.endsWith(normalizedHeading)
		? `${before}\n\n${normalizedEntry}`
		: `${before}\n${normalizedEntry}`;

	return after.length > 0 ? `${middle}\n\n${after}\n` : `${middle}\n`;
}

export function appendToNamedSection(content: string, heading: string, entry: string): string {
	return appendToHeadingLine(content, `## ${heading}`, entry);
}

export function appendReadingLogEntry(content: string, date: string, entry: string): string {
	const normalizedContent = normalizeNewlines(content).trimEnd();
	const normalizedEntry = entry.trim();

	if (normalizedContent.length === 0) {
		return `# Reading Log\n\n## ${date}\n${normalizedEntry}\n`;
	}

	const headings = [...normalizedContent.matchAll(/^##\s+(.+)$/gm)];
	const lastHeading = headings.at(-1)?.[1]?.trim();

	if (lastHeading === date) {
		return `${normalizedContent}\n${normalizedEntry}\n`;
	}

	return `${normalizedContent}\n\n## ${date}\n${normalizedEntry}\n`;
}

export function formatBookNoteContent(frontmatter: string): string {
	return `${frontmatter}\n\n## Cover\n\n## Notes\n\n## Citations\n\n## Highlights\n\n## Log\n`;
}

function normalizeNewlines(value: string): string {
	return value.replace(/\r\n/g, "\n");
}
