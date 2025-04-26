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
	pasteOverride: boolean; // Whether to override the default paste behavior
	maxHeadingLevel: number; // The maximum heading level to allow (1-6, where 1 is disabled)
	removeEmptyElements: boolean; // Whether to remove empty elements when reformatting pasted content
	cascadeHeadingLevels: boolean; // Whether to cascade heading levels (e.g., H1→H2→H3 becomes H2→H3→H4 when max level is H2)
	contextualCascade: boolean; // Whether to cascade headings based on the current context (e.g., if cursor is in an H2 section, headings will start from H3)
	stripLineBreaks: boolean; // Whether to strip hard line breaks (br tags) when reformatting pasted content
	removeEmptyLines: boolean; // Whether to remove blank lines in the Markdown output
	htmlRegexReplacements: RegexReplacement[]; // Regular expression replacements to apply to the HTML content before converting to Markdown
	markdownRegexReplacements: RegexReplacement[]; // Regular expression replacements to apply to the Markdown content after HTML conversion
}

const DEFAULT_SETTINGS: PasteReformmatterSettings = {
	pasteOverride: true,
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

		// Register discrete command for paste reformatting
		this.addCommand({
            id: 'reformat-and-paste',
            name: 'Reformat and Paste',
            callback: async () => {
                try {
                    // Get clipboard data using navigator API
                    const clipboardItems = await navigator.clipboard.read();
                    
                    // Create a DataTransfer object
                    const dataTransfer = new DataTransfer();
                    
                    // Process clipboard items
                    for (const item of clipboardItems) {
                        // Check for HTML content
                        if (item.types.includes('text/html')) {
                            const blob = await item.getType('text/html');
                            const html = await blob.text();
                            dataTransfer.setData('text/html', html);
                        }
                        
                        // Check for plain text content
                        if (item.types.includes('text/plain')) {
                            const blob = await item.getType('text/plain');
                            const text = await blob.text();
                            dataTransfer.setData('text/plain', text);
                        }
                    }
                    
                    // Process the clipboard data
					if (dataTransfer.types.includes('text/html') && dataTransfer.types.includes('text/plain')) {
						this.doPaste(dataTransfer);
					} else {
                        new Notice("Clipboard does not contain HTML or plain text content.");
					}
                    
                } catch (error) {
                    console.error("Error accessing clipboard:", error);
                    new Notice("Error accessing clipboard. Try using regular paste instead.");
                }
            }
        });
	}

	onunload() {
	}

	async loadSettings() {
		this.settings = Object.assign({}, DEFAULT_SETTINGS, await this.loadData());
	}

	async saveSettings() {
		await this.saveData(this.settings);
	}

	doPaste(clipboardData: DataTransfer): boolean {
		// Get the active editor using non-deprecated API
		const activeView = this.app.workspace.getActiveViewOfType(MarkdownView);
		if (!activeView) {
			return false;
		}
		
		const editor = activeView.editor;
		if (!editor) {
			return false;
		}
		
		try {
			let originalMarkdown = '';
			let appliedHTMLTransformations = false;
			let appliedMarkdownTransformations = false;
			
			// Check if HTML format is available
			if (clipboardData.types.includes('text/html')) {
				// Process as HTML
				const html = clipboardData.getData('text/html');
				
				// Transform HTML before converting to Markdown
				const result = transformHTML(html, this.settings);
				console.debug(`Original HTML: ${html}`);
				console.debug(`Transformed HTML: ${result.html}`);
				
				// Use Obsidian's built-in htmlToMarkdown function
				originalMarkdown = htmlToMarkdown(result.html);

				appliedHTMLTransformations = result.appliedTransformations;
			} else if (clipboardData.types.includes('text/plain')) {
				// Process as plain text - treat it as already being Markdown
				originalMarkdown = clipboardData.getData('text/plain');
			} else {
				// No supported format found
				console.debug("No HTML or plain text content found in clipboard");
				return false;
			}
			
			// Get the current context for contextual cascade
			let contextLevel = 0;
			if (this.settings.contextualCascade) {
				contextLevel = this.getCurrentHeadingLevel(editor);
			}
			
			// Apply settings to transform the markdown
			const markdownResult = transformMarkdown(originalMarkdown, this.settings, contextLevel);
			appliedMarkdownTransformations = markdownResult.appliedTransformations;
			
			// Show notification
			if (appliedHTMLTransformations || appliedMarkdownTransformations) {
				// Replace the current selection with the converted markdown
				editor.replaceSelection(markdownResult.markdown);
				new Notice(`Reformatted pasted content`);
				return true;
			} else {
				return false;
			}
		} catch (error) {
			console.error("Error processing paste content:", error);
			new Notice("Error processing paste content");
			return false
		}
	}

	onPaste(event: ClipboardEvent) {
		if (this.settings.pasteOverride) {
			// Check if there's content in the clipboard
			const clipboardData = event.clipboardData;
			if (!clipboardData) {
				return;
			}
			
			// Process the clipboard data
			if (this.doPaste(clipboardData)) {
				// Prevent the default paste behavior
				console.debug("Default paste behavior overridden by Paste Reformatter plugin");
				event.preventDefault();
			} else {
				// If the plugin didn't handle the paste, allow the default behavior
				console.debug("Paste Reformatter plugin did not handle paste, allowing default behavior");
			}
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
		
		new Setting(containerEl)
			.setName('Override default paste behavior')
			.setDesc('Alter the behavior of the default paste action to reformat pasted content.')
			.addToggle(toggle => toggle
				.setValue(this.plugin.settings.pasteOverride)
				.onChange(async (value) => {
					this.plugin.settings.pasteOverride = value;
					await this.plugin.saveSettings();
				}));
				
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
