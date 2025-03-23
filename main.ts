// Paste Reformatter - A plugin that re-formats pasted HTML text in Obsidian.
// Copyright (C) 2025 by Keath Milligan.

import { App, MarkdownView, Plugin, PluginSettingTab, Setting, htmlToMarkdown, Notice } from 'obsidian';

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
	
	/**
	 * Transforms the HTML content before converting it to Markdown
	 * @param html The HTML content to transform
	 * @returns The transformed HTML content
	 */
	transformHTML(html: string): string {
		// Apply regex replacements first
		if (this.settings.htmlRegexReplacements && this.settings.htmlRegexReplacements.length > 0) {
			for (const replacement of this.settings.htmlRegexReplacements) {
				try {
					const regex = new RegExp(replacement.pattern, 'g');
					html = html.replace(regex, replacement.replacement);
				} catch (error) {
					console.error(`Error applying regex replacement: ${error}`);
				}
			}
		}
		
		// Create a temporary DOM element to parse the HTML
		const parser = new DOMParser();
		const doc = parser.parseFromString(html, 'text/html');
		
		// Process line breaks if strip line breaks is enabled
		if (this.settings.stripLineBreaks) {
			// Find all <br> elements and remove them
			const brElements = doc.querySelectorAll('br');
			brElements.forEach(br => {
				br.remove();
			});
		} else {
			// If we're not stripping line breaks, convert them to special paragraph tags
			// that will be preserved even if empty elements are removed
			const brElements = doc.querySelectorAll('br');
			brElements.forEach(br => {
				// Create a special paragraph with a class that marks it as a line break
				const lineBreakP = doc.createElement('p');
				lineBreakP.className = 'preserve-line-break';
				lineBreakP.setAttribute('data-preserve', 'true');
				
				// Add a non-breaking space as placeholder content
				// This ensures the paragraph isn't considered empty when Remove Empty Lines is enabled
				// The unicode character will be invisible but ensures the line isn't empty
				lineBreakP.innerHTML = '&#8203;'; // Zero-width space
				
				// Replace the <br> with our special paragraph
				br.parentNode?.replaceChild(lineBreakP, br);
			});
		}
		
		// Remove empty elements if enabled
		if (this.settings.removeEmptyElements) {
			// Function to check if an element is empty (no text content and no meaningful children)
			const isElementEmpty = (element: Element): boolean => {
				// Skip certain elements that are meaningful even when empty
				if (['img', 'hr', 'br', 'input', 'iframe'].includes(element.tagName.toLowerCase())) {
					return false;
				}
				
				// Skip our special line break paragraphs
				if (element.hasAttribute('data-preserve')) {
					return false;
				}
				
				// Check if it has any text content (excluding whitespace)
				if (element.textContent && element.textContent.trim().length > 0) {
					return false;
				}
				
				// Check if it has any non-empty children
				for (let i = 0; i < element.children.length; i++) {
					if (!isElementEmpty(element.children[i])) {
						return false;
					}
				}
				
				return true;
			};
			
			// Find and remove empty elements
			// We need to use a while loop because the DOM changes as we remove elements
			let emptyElementsFound = true;
			while (emptyElementsFound) {
				emptyElementsFound = false;
				
				// Target common empty elements
				const potentialEmptyElements = doc.querySelectorAll('p:not([data-preserve]), div, span, li, ul, ol, table, tr, td, th');
				potentialEmptyElements.forEach(element => {
					if (isElementEmpty(element)) {
						element.remove();
						emptyElementsFound = true;
					}
				});
				
				// If no more empty elements are found, exit the loop
				if (!emptyElementsFound) {
					break;
				}
			}
		}
		
		// Return the modified HTML
		return doc.body.innerHTML;
	}
	
	/**
	 * Transforms the markdown content based on the plugin settings
	 * @param markdown The markdown content to transform
	 * @param contextLevel The current heading level for contextual cascade (0 if not in a heading section)
	 * @returns The transformed markdown content
	 */
	transformMarkdown(markdown: string, contextLevel: number = 0): string {
		// Apply regex replacements if defined
		if (this.settings.markdownRegexReplacements && this.settings.markdownRegexReplacements.length > 0) {
			for (const replacement of this.settings.markdownRegexReplacements) {
				try {
					const regex = new RegExp(replacement.pattern, 'g');
					markdown = markdown.replace(regex, replacement.replacement);
				} catch (error) {
					console.error(`Error applying markdown regex replacement: ${error}`);
				}
			}
		}
		
		// Find all heading lines
		const headingRegex = /^(#{1,6})\s/gm;
		
		// Process headings based on settings
		if (this.settings.contextualCascade && contextLevel > 0) {
			// Contextual cascade is enabled and we have a context level
			markdown = markdown.replace(headingRegex, (match, hashes) => {
				const currentLevel = hashes.length;
				let newLevel;
				
				// Start headings one level deeper than the context
				const baseLevel = contextLevel + 1;
				
				if (this.settings.cascadeHeadingLevels) {
					// Preserve the hierarchy with an offset from the context level
					const offset = currentLevel - 1; // H1 becomes level+0, H2 becomes level+1, etc.
					newLevel = Math.min(baseLevel + offset, 6);
				} else {
					// Just use the base level for all headings
					newLevel = Math.min(baseLevel, 6);
				}
				
				// Return the new heading with the adjusted level
				return '#'.repeat(newLevel) + ' ';
			});
		} else if (this.settings.maxHeadingLevel > 1) {
			// Only process max heading level if contextual cascade is not active
			markdown = markdown.replace(headingRegex, (match, hashes) => {
				const currentLevel = hashes.length;
				let newLevel = currentLevel;
				
				if (this.settings.cascadeHeadingLevels) {
					// When cascade is enabled, preserve the heading hierarchy
					// For example, if max level is 2:
					// H1 -> H2 (max level)
					// H2 -> H3 (max level + 1)
					// H3 -> H4 (max level + 2)
					
					// Calculate the offset from the original level
					const offset = currentLevel - 1;
					// Apply the offset to the max level, ensuring we don't exceed H6
					newLevel = Math.min(this.settings.maxHeadingLevel + offset, 6);
				} else {
					// Only max heading level is enabled, cascade is disabled
					if (currentLevel < this.settings.maxHeadingLevel) {
						// If heading level is less than max, increase it to max level
						newLevel = this.settings.maxHeadingLevel;
					} else {
						// Keep headings at their original level if they're already at or deeper than max
						newLevel = currentLevel;
					}
				}
				
				// Return the new heading with the adjusted level
				return '#'.repeat(newLevel) + ' ';
			});
		}
		
		// First handle the special line break markers
		let preserveLineBreaks = !this.settings.stripLineBreaks;
		
		// If we're not stripping line breaks, we need to handle the special markers
		if (preserveLineBreaks) {
			// Replace special line break markers with a unique placeholder that won't be affected by empty line removal
			const lineBreakPlaceholder = '___LINE_BREAK_PLACEHOLDER___';
			markdown = markdown.replace(/<p class="preserve-line-break"[^>]*>.*?<\/p>/g, lineBreakPlaceholder);
			markdown = markdown.replace(/<p data-preserve="true"[^>]*>.*?<\/p>/g, lineBreakPlaceholder);
			
			// Remove empty lines if enabled
			if (this.settings.removeEmptyLines) {
				// First, normalize line endings to ensure consistent processing
				markdown = markdown.replace(/\r\n/g, '\n');
				
				// Split the content into lines
				const lines = markdown.split('\n');
				
				// Filter out empty lines, but keep our placeholders
				const filteredLines = lines.filter(line => {
					return line.trim() !== '' || line.includes(lineBreakPlaceholder);
				});
				
				// Join the filtered lines back together
				markdown = filteredLines.join('\n');
			}
			
			// Now replace our placeholders with actual line breaks
			markdown = markdown.replace(new RegExp(lineBreakPlaceholder, 'g'), '\n');
		} else {
			// If we're stripping line breaks, just remove empty lines normally
			if (this.settings.removeEmptyLines) {
				// First, normalize line endings to ensure consistent processing
				markdown = markdown.replace(/\r\n/g, '\n');
				
				// Split the content into lines
				const lines = markdown.split('\n');
				
				// Filter out all empty lines
				const filteredLines = lines.filter(line => line.trim() !== '');
				
				// Join the filtered lines back together
				markdown = filteredLines.join('\n');
			}
		}
		
		return markdown;
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
				
				// Transform HTML before converting to Markdown
				const transformedHTML = this.transformHTML(html);
				
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
			markdown = this.transformMarkdown(markdown, contextLevel);
			
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
		
		containerEl.createEl('h3', {text: 'HTML Transformations'});
		containerEl.createEl('p', {
			text: 'These settings control how the HTML content is processed before being converted to Markdown.'
		}).addClass('setting-item-description');
				
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
			.setName('HTML Regex Replacements')
			.setDesc('Apply regular expression replacements to the HTML content before converting to Markdown. You can use $1, $2, etc. to reference capture groups.')
			.addButton(button => {
				button
					.setButtonText('Add Replacement')
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
		const regexContainer = containerEl.createDiv('regex-replacements-container');
		regexContainer.style.marginLeft = '40px';
		regexContainer.style.marginBottom = '20px';
		
		// Create a table for the regex replacements
		const table = regexContainer.createEl('table');
		table.style.width = '100%';
		table.style.borderCollapse = 'collapse';
		
		// Create the header row
		const thead = table.createEl('thead');
		const headerRow = thead.createEl('tr');
		
		// Pattern header
		const patternHeader = headerRow.createEl('th');
		patternHeader.setText('Pattern');
		patternHeader.style.textAlign = 'left';
		patternHeader.style.padding = '5px';
		patternHeader.style.width = '40%';
		
		// Replacement header
		const replacementHeader = headerRow.createEl('th');
		replacementHeader.setText('Replacement');
		replacementHeader.style.textAlign = 'left';
		replacementHeader.style.padding = '5px';
		replacementHeader.style.width = '40%';
		
		// Actions header
		const actionsHeader = headerRow.createEl('th');
		actionsHeader.style.width = '20%';
		actionsHeader.style.padding = '5px';
		
		// Create the table body
		const tbody = table.createEl('tbody');
		
		// Add a row for each replacement
		this.plugin.settings.htmlRegexReplacements.forEach((replacement, index) => {
			const row = tbody.createEl('tr');
			
			// Pattern cell
			const patternCell = row.createEl('td');
			patternCell.style.padding = '5px';
			
			// Pattern input
			const patternInput = document.createElement('input');
			patternInput.type = 'text';
			patternInput.value = replacement.pattern;
			patternInput.placeholder = 'Regular expression pattern';
			patternInput.style.width = '100%';
			patternInput.addEventListener('change', async () => {
				this.plugin.settings.htmlRegexReplacements[index].pattern = patternInput.value;
				await this.plugin.saveSettings();
			});
			patternCell.appendChild(patternInput);
			
			// Replacement cell
			const replacementCell = row.createEl('td');
			replacementCell.style.padding = '5px';
			
			// Replacement input
			const replacementInput = document.createElement('input');
			replacementInput.type = 'text';
			replacementInput.value = replacement.replacement;
			replacementInput.placeholder = 'Replacement value (can use $1, $2, etc.)';
			replacementInput.style.width = '100%';
			replacementInput.addEventListener('change', async () => {
				this.plugin.settings.htmlRegexReplacements[index].replacement = replacementInput.value;
				await this.plugin.saveSettings();
			});
			replacementCell.appendChild(replacementInput);
			
			// Actions cell
			const actionsCell = row.createEl('td');
			actionsCell.style.padding = '5px';
			actionsCell.style.textAlign = 'center';
			
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
			emptyCell.style.textAlign = 'center';
			emptyCell.style.padding = '10px';
			emptyCell.style.fontStyle = 'italic';
			emptyCell.style.color = 'var(--text-faint)';
			emptyCell.style.opacity = '0.7';
			emptyCell.setText('No replacements defined. Click "Add Replacement" to add one.');
		}
		
		containerEl.createEl('h3', {text: 'Markdown Transformations'});
		containerEl.createEl('p', {
			text: 'These settings control how the Markdown content is adjusted after HTML conversion or when pasted as plain text.'
		}).addClass('setting-item-description');
				
		new Setting(containerEl)
			.setName('Max Heading Level')
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
			.setName('Markdown Regex Replacements')
			.setDesc('Apply regular expression replacements to the Markdown content after HTML conversion. You can use $1, $2, etc. to reference capture groups.')
			.addButton(button => {
				button
					.setButtonText('Add Replacement')
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
		const markdownRegexContainer = containerEl.createDiv('markdown-regex-replacements-container');
		markdownRegexContainer.style.marginLeft = '40px';
		markdownRegexContainer.style.marginBottom = '20px';
		
		// Create a table for the regex replacements
		const markdownRegexTable = markdownRegexContainer.createEl('table');
		markdownRegexTable.style.width = '100%';
		markdownRegexTable.style.borderCollapse = 'collapse';
		
		// Create the header row
		const markdownRegexThead = markdownRegexTable.createEl('thead');
		const markdownRegexHeaderRow = markdownRegexThead.createEl('tr');
		
		// Pattern header
		const markdownRegexPatternHeader = markdownRegexHeaderRow.createEl('th');
		markdownRegexPatternHeader.setText('Pattern');
		markdownRegexPatternHeader.style.textAlign = 'left';
		markdownRegexPatternHeader.style.padding = '5px';
		markdownRegexPatternHeader.style.width = '40%';
		
		// Replacement header
		const markdownRegexReplacementHeader = markdownRegexHeaderRow.createEl('th');
		markdownRegexReplacementHeader.setText('Replacement');
		markdownRegexReplacementHeader.style.textAlign = 'left';
		markdownRegexReplacementHeader.style.padding = '5px';
		markdownRegexReplacementHeader.style.width = '40%';
		
		// Actions header
		const markdownRegexActionsHeader = markdownRegexHeaderRow.createEl('th');
		markdownRegexActionsHeader.style.width = '20%';
		markdownRegexActionsHeader.style.padding = '5px';
		
		// Create the table body
		const markdownRegexTbody = markdownRegexTable.createEl('tbody');
		
		// Add a row for each replacement
		this.plugin.settings.markdownRegexReplacements.forEach((replacement, index) => {
			const row = markdownRegexTbody.createEl('tr');
			
			// Pattern cell
			const patternCell = row.createEl('td');
			patternCell.style.padding = '5px';
			
			// Pattern input
			const patternInput = document.createElement('input');
			patternInput.type = 'text';
			patternInput.value = replacement.pattern;
			patternInput.placeholder = 'Regular expression pattern';
			patternInput.style.width = '100%';
			patternInput.addEventListener('change', async () => {
				this.plugin.settings.markdownRegexReplacements[index].pattern = patternInput.value;
				await this.plugin.saveSettings();
			});
			patternCell.appendChild(patternInput);
			
			// Replacement cell
			const replacementCell = row.createEl('td');
			replacementCell.style.padding = '5px';
			
			// Replacement input
			const replacementInput = document.createElement('input');
			replacementInput.type = 'text';
			replacementInput.value = replacement.replacement;
			replacementInput.placeholder = 'Replacement value (can use $1, $2, etc.)';
			replacementInput.style.width = '100%';
			replacementInput.addEventListener('change', async () => {
				this.plugin.settings.markdownRegexReplacements[index].replacement = replacementInput.value;
				await this.plugin.saveSettings();
			});
			replacementCell.appendChild(replacementInput);
			
			// Actions cell
			const actionsCell = row.createEl('td');
			actionsCell.style.padding = '5px';
			actionsCell.style.textAlign = 'center';
			
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
			emptyCell.style.textAlign = 'center';
			emptyCell.style.padding = '10px';
			emptyCell.style.fontStyle = 'italic';
			emptyCell.style.color = 'var(--text-faint)';
			emptyCell.style.opacity = '0.7';
			emptyCell.setText('No replacements defined. Click "Add Replacement" to add one.');
		}
	}

}
