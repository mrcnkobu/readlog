import { App, Notice, PluginSettingTab, Setting } from "obsidian";
import type ReadlogPlugin from "../main";
import {
	normalizeDailyFolderTemplate,
	normalizeDailyNameTemplate,
	normalizeMarkdownHeading,
} from "./utils";

export class ReadlogSettingTab extends PluginSettingTab {
	private readonly debouncedSave = debounce(() => void this.trySaveSettings(), 400);

	constructor(app: App, private readonly plugin: ReadlogPlugin) {
		super(app, plugin);
	}

	display(): void {
		const { containerEl } = this;
		containerEl.empty();

		new Setting(containerEl)
			.setName("Readlog settings")
			.setHeading();

		new Setting(containerEl)
			.setName("Root folder")
			.addText((text) => {
				text.setValue(this.plugin.settings.rootFolder);
				text.onChange((value) => {
					this.plugin.settings.rootFolder = value.trim() || "Reading";
					this.debouncedSave();
				});
			});

		new Setting(containerEl)
			.setName("Books folder")
			.addText((text) => {
				text.setValue(this.plugin.settings.booksFolder);
				text.onChange((value) => {
					this.plugin.settings.booksFolder = value.trim() || "Books";
					this.debouncedSave();
				});
			});

		new Setting(containerEl)
			.setName("Reading log filename")
			.addText((text) => {
				text.setValue(this.plugin.settings.readingLogFilename);
				text.onChange((value) => {
					this.plugin.settings.readingLogFilename = value.trim() || "reading-log.md";
					this.debouncedSave();
				});
			});

		new Setting(containerEl)
			.setName("Daily notes folder template")
			.setDesc("Supports shortcodes like {year}-{month}")
			.addText((text) => {
				text.setValue(this.plugin.settings.dailyNotesFolderTemplate);
				text.onChange((value) => {
					this.plugin.settings.dailyNotesFolderTemplate = normalizeDailyFolderTemplate(value);
					this.debouncedSave();
				});
			});

		new Setting(containerEl)
			.setName("Daily note name template")
			.setDesc("Supports shortcodes like {year}-{month}-{day}_{weekday_short}")
			.addText((text) => {
				text.setValue(this.plugin.settings.dailyNoteNameTemplate);
				text.onChange((value) => {
					this.plugin.settings.dailyNoteNameTemplate = normalizeDailyNameTemplate(value);
					this.debouncedSave();
				});
			});

		new Setting(containerEl)
			.setName("Daily note heading line")
			.setDesc("Accepts full markdown, for example ## Reading or ##### *Reading*")
			.addText((text) => {
				text.setValue(this.plugin.settings.dailyNoteHeading);
				text.onChange((value) => {
					this.plugin.settings.dailyNoteHeading = normalizeMarkdownHeading(value);
					this.debouncedSave();
				});
			});
	}

	private async trySaveSettings() {
		try {
			await this.plugin.saveSettings();
		} catch (error) {
			new Notice(error instanceof Error ? error.message : "Failed to save settings");
		}
	}
}

function debounce(fn: () => void, delay: number): () => void {
	let timer: ReturnType<typeof setTimeout> | undefined;
	return () => {
		window.clearTimeout(timer);
		timer = window.setTimeout(fn, delay);
	};
}
