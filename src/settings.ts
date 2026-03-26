import { App, Notice, PluginSettingTab, Setting } from "obsidian";
import type ReadlogPlugin from "../main";
import {
	normalizeDailyFolderTemplate,
	normalizeDailyNameTemplate,
	normalizeMarkdownHeading,
} from "./utils";

export class ReadlogSettingTab extends PluginSettingTab {
	constructor(app: App, private readonly plugin: ReadlogPlugin) {
		super(app, plugin);
	}

	display(): void {
		const { containerEl } = this;
		containerEl.empty();

		containerEl.createEl("h2", { text: "Readlog settings" });

		new Setting(containerEl)
			.setName("Root folder")
			.addText((text) => {
				text.setValue(this.plugin.settings.rootFolder);
				text.onChange(async (value) => {
					this.plugin.settings.rootFolder = value.trim() || "Reading";
					await this.trySaveSettings();
				});
			});

		new Setting(containerEl)
			.setName("Books folder")
			.addText((text) => {
				text.setValue(this.plugin.settings.booksFolder);
				text.onChange(async (value) => {
					this.plugin.settings.booksFolder = value.trim() || "Books";
					await this.trySaveSettings();
				});
			});

		new Setting(containerEl)
			.setName("Reading log filename")
			.addText((text) => {
				text.setValue(this.plugin.settings.readingLogFilename);
				text.onChange(async (value) => {
					this.plugin.settings.readingLogFilename = value.trim() || "reading-log.md";
					await this.trySaveSettings();
				});
			});

		new Setting(containerEl)
			.setName("Daily notes folder template")
			.setDesc("Supports shortcodes like {year}-{month}")
			.addText((text) => {
				text.setValue(this.plugin.settings.dailyNotesFolderTemplate);
				text.onChange(async (value) => {
					this.plugin.settings.dailyNotesFolderTemplate = normalizeDailyFolderTemplate(value);
					await this.trySaveSettings();
				});
			});

		new Setting(containerEl)
			.setName("Daily note name template")
			.setDesc("Supports shortcodes like {year}-{month}-{day}_{weekday_short}")
			.addText((text) => {
				text.setValue(this.plugin.settings.dailyNoteNameTemplate);
				text.onChange(async (value) => {
					this.plugin.settings.dailyNoteNameTemplate = normalizeDailyNameTemplate(value);
					await this.trySaveSettings();
				});
			});

		new Setting(containerEl)
			.setName("Daily note heading line")
			.setDesc("Accepts full markdown, for example ## Reading or ##### *Reading*")
			.addText((text) => {
				text.setValue(this.plugin.settings.dailyNoteHeading);
				text.onChange(async (value) => {
					this.plugin.settings.dailyNoteHeading = normalizeMarkdownHeading(value);
					await this.trySaveSettings();
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
