// Paste Reformatter - A plugin that re-formats pasted HTML text in Obsidian.
// Copyright (C) 2025 by Keath Milligan.

import { App, MarkdownView, Plugin, PluginSettingTab, Setting, htmlToMarkdown, Notice } from 'obsidian';
import { transformHTML } from './htmlTransformer';
import { transformMarkdown } from './markdownTransformer';

interface RegexReplacement {
	pattern: string;
	replacement: string;
}

interface PasteReformmatterSettings {
	maxHeadingLevel: number;
	removeEmptyElements: boolean;
	cascadeHeadingLevels: boolean;
	contextualCascade: boolean;
	stripLineBreaks: boolean;
	removeEmptyLines: boolean;
	htmlRegexReplacements: RegexReplacement[];
	markdownRegexReplacements: RegexReplacement[];
}

const DEFAULT_SETTINGS: PasteReformmatterSettings = {
	maxHeadingLevel: 1,
	removeEmptyElements: false,
	cascadeHeadingLevels: true,
	contextualCascade: true,
	stripLineBreaks: false,
	removeEmptyLines: false,
	htmlRegexReplacements: [],
	markdownRegexReplacements: []
}

export default class PasteReformatter extends Plugin {
	settings: PasteReformmatterSettings;

	async onload() {
		await this.loadSettings();

		// This adds a settings tab so the user can configure various aspects of the plugin
		this.addSettingTab(new PasteReformmatterSettingsTab(this.app, this));

		// Register paste event
		this.registerEvent(this.app.workspace.on("editor-paste", event => this.onPaste(event)));
	}

	onunload() {
	}

	async loadSettings() {
		this.settings = Object.assign({}, DEFAULT_SETTINGS, await this.loadData());
	}

	async saveSettings() {
		await this.saveData(this.settings);
	}

	onPaste(event: ClipboardEvent) {
		// Check if there's content in the clipboard
		const clipboardData = event.clipboardData;
		if (!clipboardData) {
			return;
		}
		
		// Get the active editor using non-deprecated API
		const activeView = this.app.workspace.getActiveViewOfType(MarkdownView);
		if (!activeView) {
			return;
		}
		
		const editor = activeView.editor;
		if (!editor) {
			return;
		}
		
		try {
			let markdown = '';
			let contentType = '';
			
			// Check if HTML format is available
			if (clipboardData.types.includes('text/html')) {
				// Process as HTML
				const html = clipboardData.getData('text/html');

				// console.log("HTML content:", html);
				
				// Transform HTML before converting to Markdown
				const transformedHTML = transformHTML(html, this.settings);
				
				// Use Obsidian's built-in htmlToMarkdown function
				markdown = htmlToMarkdown(transformedHTML);

				contentType = 'HTML';
			} else if (clipboardData.types.includes('text/plain')) {
				// Process as plain text - treat it as already being Markdown
				markdown = clipboardData.getData('text/plain');
				contentType = 'plain text';
			} else {
				// No supported format found
				return;
			}
			
			// Get the current context for contextual cascade
			let contextLevel = 0;
			if (this.settings.contextualCascade) {
				contextLevel = this.getCurrentHeadingLevel(editor);
			}
			
			// Apply settings to transform the markdown
			markdown = transformMarkdown(markdown, this.settings, contextLevel);
			
			// Replace the current selection with the converted markdown
			editor.replaceSelection(markdown);
			
			// Prevent the default paste behavior
			event.preventDefault();
			
			// Show notification
			new Notice(`Reformatted ${contentType} content`);
		} catch (error) {
			console.error("Error processing paste content:", error);
			new Notice("Error processing paste content");
		}
	}

	/**
	 * Determines the current heading level at the cursor position
	 * @param editor The editor instance
	 * @returns The heading level (1-6) or 0 if not in a heading section
	 */
	getCurrentHeadingLevel(editor: any): number {
		// Get the current cursor position
		const cursor = editor.getCursor();
		const currentLine = cursor.line;
		
		// Look backward from the current line to find the nearest heading
		for (let line = currentLine; line >= 0; line--) {
			const lineText = editor.getLine(line);
			const headingMatch = lineText.match(/^(#{1,6})\s/);
			
			if (headingMatch) {
				// Return the heading level (number of # characters)
				return headingMatch[1].length;
			}
		}
		
		// No heading found above the cursor
		return 0;
	}
}

class PasteReformmatterSettingsTab extends PluginSettingTab {
	plugin: PasteReformatter;

	constructor(app: App, plugin: PasteReformatter) {
		super(app, plugin);
		this.plugin = plugin;
	}

	display(): void {
		const {containerEl} = this;

		containerEl.empty();
		
		// HTML Transformations
		new Setting(containerEl)
			.setName('HTML transformations')
			.setHeading()
			.setDesc('Control how the HTML content is processed before being converted to Markdown.');
				
		new Setting(containerEl)
			.setName('Remove empty elements')
			.setDesc('Remove empty elements when reformatting pasted content')
			.addToggle(toggle => toggle
				.setValue(this.plugin.settings.removeEmptyElements)
				.onChange(async (value) => {
					this.plugin.settings.removeEmptyElements = value;
					await this.plugin.saveSettings();
				}));
				
		new Setting(containerEl)
			.setName('Strip hard line breaks')
			.setDesc('Remove line breaks (br tags) when reformatting pasted content')
			.addToggle(toggle => toggle
				.setValue(this.plugin.settings.stripLineBreaks)
				.onChange(async (value) => {
					this.plugin.settings.stripLineBreaks = value;
					await this.plugin.saveSettings();
				}));
		
		new Setting(containerEl)
			.setName('HTML regex replacements')
			.setDesc('Apply regular expression replacements to the HTML content before converting to Markdown. You can use $1, $2, etc. to reference capture groups.')
			.addButton(button => {
				button
					.setButtonText('Add replacement')
					.setCta()
					.onClick(() => {
						// Check if there's already an empty row
						const hasEmptyRow = this.plugin.settings.htmlRegexReplacements.some(
							replacement => replacement.pattern === '' && replacement.replacement === ''
						);
						
						// Only add a new row if there isn't already an empty one
						if (!hasEmptyRow) {
							// Add a new empty replacement
							this.plugin.settings.htmlRegexReplacements.push({
								pattern: '',
								replacement: ''
							});
							// Save settings and refresh display
							this.plugin.saveSettings().then(() => {
								this.display();
							});
						}
					});
			});
		
		// Create a container for the regex replacement rows
		const regexContainer = containerEl.createDiv();
		regexContainer.addClass('regex-replacements-container');
		
		// Create a table for the regex replacements
		const table = regexContainer.createEl('table');
		table.addClass('regex-table');
		
		// Create the header row
		const thead = table.createEl('thead');
		const headerRow = thead.createEl('tr');
		
		// Pattern header
		const patternHeader = headerRow.createEl('th');
		patternHeader.setText('Pattern');
		patternHeader.addClass('regex-th');
		patternHeader.addClass('regex-th-pattern');
		
		// Replacement header
		const replacementHeader = headerRow.createEl('th');
		replacementHeader.setText('Replacement');
		replacementHeader.addClass('regex-th');
		replacementHeader.addClass('regex-th-replacement');
		
		// Actions header
		const actionsHeader = headerRow.createEl('th');
		actionsHeader.addClass('regex-th');
		actionsHeader.addClass('regex-th-actions');
		
		// Create the table body
		const tbody = table.createEl('tbody');
		
		// Add a row for each replacement
		this.plugin.settings.htmlRegexReplacements.forEach((replacement, index) => {
			const row = tbody.createEl('tr');
			
			// Pattern cell
			const patternCell = row.createEl('td');
			patternCell.addClass('regex-td');
			
			// Pattern input
			const patternInput = document.createElement('input');
			patternInput.type = 'text';
			patternInput.value = replacement.pattern;
			patternInput.placeholder = 'Regular expression pattern';
			patternInput.addClass('regex-input');
			patternInput.addEventListener('change', async () => {
				this.plugin.settings.htmlRegexReplacements[index].pattern = patternInput.value;
				await this.plugin.saveSettings();
			});
			patternCell.appendChild(patternInput);
			
			// Replacement cell
			const replacementCell = row.createEl('td');
			replacementCell.addClass('regex-td');
			
			// Replacement input
			const replacementInput = document.createElement('input');
			replacementInput.type = 'text';
			replacementInput.value = replacement.replacement;
			replacementInput.placeholder = 'Replacement value (can use $1, $2, etc.)';
			replacementInput.addClass('regex-input');
			replacementInput.addEventListener('change', async () => {
				this.plugin.settings.htmlRegexReplacements[index].replacement = replacementInput.value;
				await this.plugin.saveSettings();
			});
			replacementCell.appendChild(replacementInput);
			
			// Actions cell
			const actionsCell = row.createEl('td');
			actionsCell.addClass('regex-td');
			actionsCell.addClass('regex-td-actions');
			
			// Remove button
			const removeButton = document.createElement('button');
			removeButton.textContent = 'Remove';
			removeButton.addEventListener('click', async () => {
				this.plugin.settings.htmlRegexReplacements.splice(index, 1);
				await this.plugin.saveSettings();
				this.display(); // Refresh the display
			});
			actionsCell.appendChild(removeButton);
		});
		
		// Add a message if no replacements are defined
		if (this.plugin.settings.htmlRegexReplacements.length === 0) {
			const emptyRow = tbody.createEl('tr');
			const emptyCell = emptyRow.createEl('td');
			emptyCell.colSpan = 3;
			emptyCell.addClass('regex-empty-message');
			emptyCell.setText('No replacements defined. Click "Add replacement" to add one.');
		}
		
		new Setting(containerEl)
			.setName('Markdown transformations')
			.setDesc('Control how the Markdown content is adjusted after HTML conversion or when pasted as plain text.')
			.setHeading();
		
		new Setting(containerEl)
			.setName('Max heading level')
			.setDesc('The maximum heading level to allow when reformatting pasted content (H1 is treated as disabled)')
			.addDropdown(dropdown => dropdown
				.addOptions({
					'1': 'Disabled (H1)',
					'2': 'H2',
					'3': 'H3',
					'4': 'H4',
					'5': 'H5',
					'6': 'H6'
				})
				.setValue(this.plugin.settings.maxHeadingLevel.toString())
				.onChange(async (value) => {
					this.plugin.settings.maxHeadingLevel = parseInt(value);
					await this.plugin.saveSettings();
					
					// Always refresh the display to update the cascade heading levels toggle visibility
					this.display();
				}));
		
		// Only show cascade heading levels setting if max heading level is not H1 (disabled)
		if (this.plugin.settings.maxHeadingLevel > 1) {
			new Setting(containerEl)
				.setName('Cascade heading levels')
				.setDesc('Preserve the heading hierarchy by cascading levels (e.g., H1→H2→H3 becomes H2→H3→H4 when max level is H2)')
				.addToggle(toggle => toggle
					.setValue(this.plugin.settings.cascadeHeadingLevels)
					.onChange(async (value) => {
						this.plugin.settings.cascadeHeadingLevels = value;
						await this.plugin.saveSettings();
					}));
		}
		
		new Setting(containerEl)
			.setName('Contextual cascade')
			.setDesc('Cascade headings based on the current context (e.g., if cursor is in an H2 section, headings will start from H3)')
			.addToggle(toggle => toggle
				.setValue(this.plugin.settings.contextualCascade)
				.onChange(async (value) => {
					this.plugin.settings.contextualCascade = value;
					await this.plugin.saveSettings();
				}));
		
		new Setting(containerEl)
			.setName('Remove empty lines')
			.setDesc('Remove blank lines in the Markdown output')
			.addToggle(toggle => toggle
				.setValue(this.plugin.settings.removeEmptyLines)
				.onChange(async (value) => {
					this.plugin.settings.removeEmptyLines = value;
					await this.plugin.saveSettings();
				}));
		
		new Setting(containerEl)
			.setName('Markdown regex replacements')
			.setDesc('Apply regular expression replacements to the Markdown content after HTML conversion. You can use $1, $2, etc. to reference capture groups.')
			.addButton(button => {
				button
					.setButtonText('Add replacement')
					.setCta()
					.onClick(() => {
						// Check if there's already an empty row
						const hasEmptyRow = this.plugin.settings.markdownRegexReplacements.some(
							replacement => replacement.pattern === '' && replacement.replacement === ''
						);
						
						// Only add a new row if there isn't already an empty one
						if (!hasEmptyRow) {
							// Add a new empty replacement
							this.plugin.settings.markdownRegexReplacements.push({
								pattern: '',
								replacement: ''
							});
							// Save settings and refresh display
							this.plugin.saveSettings().then(() => {
								this.display();
							});
						}
					});
			});
		
		// Create a container for the regex replacement rows
		const markdownRegexContainer = containerEl.createDiv();
		markdownRegexContainer.addClass('regex-replacements-container');
		
		// Create a table for the regex replacements
		const markdownRegexTable = markdownRegexContainer.createEl('table');
		markdownRegexTable.addClass('regex-table');
		
		// Create the header row
		const markdownRegexThead = markdownRegexTable.createEl('thead');
		const markdownRegexHeaderRow = markdownRegexThead.createEl('tr');
		
		// Pattern header
		const markdownRegexPatternHeader = markdownRegexHeaderRow.createEl('th');
		markdownRegexPatternHeader.setText('Pattern');
		markdownRegexPatternHeader.addClass('regex-th');
		markdownRegexPatternHeader.addClass('regex-th-pattern');
		
		// Replacement header
		const markdownRegexReplacementHeader = markdownRegexHeaderRow.createEl('th');
		markdownRegexReplacementHeader.setText('Replacement');
		markdownRegexReplacementHeader.addClass('regex-th');
		markdownRegexReplacementHeader.addClass('regex-th-replacement');
		
		// Actions header
		const markdownRegexActionsHeader = markdownRegexHeaderRow.createEl('th');
		markdownRegexActionsHeader.addClass('regex-th');
		markdownRegexActionsHeader.addClass('regex-th-actions');
		
		// Create the table body
		const markdownRegexTbody = markdownRegexTable.createEl('tbody');
		
		// Add a row for each replacement
		this.plugin.settings.markdownRegexReplacements.forEach((replacement, index) => {
			const row = markdownRegexTbody.createEl('tr');
			
			// Pattern cell
			const patternCell = row.createEl('td');
			patternCell.addClass('regex-td');
			
			// Pattern input
			const patternInput = document.createElement('input');
			patternInput.type = 'text';
			patternInput.value = replacement.pattern;
			patternInput.placeholder = 'Regular expression pattern';
			patternInput.addClass('regex-input');
			patternInput.addEventListener('change', async () => {
				this.plugin.settings.markdownRegexReplacements[index].pattern = patternInput.value;
				await this.plugin.saveSettings();
			});
			patternCell.appendChild(patternInput);
			
			// Replacement cell
			const replacementCell = row.createEl('td');
			replacementCell.addClass('regex-td');
			
			// Replacement input
			const replacementInput = document.createElement('input');
			replacementInput.type = 'text';
			replacementInput.value = replacement.replacement;
			replacementInput.placeholder = 'Replacement value (can use $1, $2, etc.)';
			replacementInput.addClass('regex-input');
			replacementInput.addEventListener('change', async () => {
				this.plugin.settings.markdownRegexReplacements[index].replacement = replacementInput.value;
				await this.plugin.saveSettings();
			});
			replacementCell.appendChild(replacementInput);
			
			// Actions cell
			const actionsCell = row.createEl('td');
			actionsCell.addClass('regex-td');
			actionsCell.addClass('regex-td-actions');
			
			// Remove button
			const removeButton = document.createElement('button');
			removeButton.textContent = 'Remove';
			removeButton.addEventListener('click', async () => {
				this.plugin.settings.markdownRegexReplacements.splice(index, 1);
				await this.plugin.saveSettings();
				this.display(); // Refresh the display
			});
			actionsCell.appendChild(removeButton);
		});
		
		// Add a message if no replacements are defined
		if (this.plugin.settings.markdownRegexReplacements.length === 0) {
			const emptyRow = markdownRegexTbody.createEl('tr');
			const emptyCell = emptyRow.createEl('td');
			emptyCell.colSpan = 3;
			emptyCell.addClass('regex-empty-message');
			emptyCell.setText('No replacements defined. Click "Add replacement" to add one.');
		}
	}

}
