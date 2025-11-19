// Paste Reformatter - A plugin that re-formats pasted HTML text in Obsidian.
// Copyright (C) 2025 by Keath Milligan.

/**
 * Transforms the markdown content based on the plugin settings
 * @param markdown The markdown content to transform
 * @param settings The settings to use for transformation
 * @param contextLevel The current heading level for contextual cascade (0 if not in a heading section)
 * @returns An object containing the transformed markdown content and whether any transformations were applied
 */
export function transformMarkdown(
    markdown: string,
    settings: {
        markdownRegexReplacements: Array<{pattern: string, replacement: string}>,
        contextualCascade: boolean,
        maxHeadingLevel: number,
        cascadeHeadingLevels: boolean,
        stripLineBreaks: boolean,
        removeEmptyLines: boolean
    },
    contextLevel: number = 0,
    escapeMarkdown: boolean = false
): { markdown: string, appliedTransformations: boolean } {
    let appliedTransformations = false;

    // Apply regex replacements if defined
    if (settings.markdownRegexReplacements && settings.markdownRegexReplacements.length > 0) {
        for (const replacement of settings.markdownRegexReplacements) {
            try {
                const regex = new RegExp(replacement.pattern, 'g');
                const originalMarkdown = markdown;
                markdown = markdown.replace(regex, replacement.replacement);
                if (originalMarkdown !== markdown) {
                    appliedTransformations = true;
                }
            } catch (error) {
                console.error(`Error applying markdown regex replacement: ${error}`);
            }
        }
    }
    
    if (!escapeMarkdown) {
        // Find all heading lines
        const headingRegex = /^(#{1,6})\s/gm;
        
        // Process headings based on settings
        if (settings.contextualCascade && contextLevel > 0) {
            let delta = -1;
            let cascading = false;

            // Contextual cascade is enabled and we have a context level
            markdown = markdown.replace(headingRegex, (match, hashes) => {
                const currentLevel = hashes.length;
                let newLevel = currentLevel;

                if (cascading) {
                    // Cascade subsequent levels below the context level
                    newLevel = Math.min(currentLevel + delta, 6);
                    console.log(`contextual cascade: delta ${delta}`);
                } else if (currentLevel <= contextLevel) {
                    // Intiate contextual cascading
                    newLevel = Math.min(contextLevel + 1, 6);
                    delta = newLevel - currentLevel;
                    cascading = true;
                    console.log(`contextual cascade initiated: delta: ${delta}`);
                } // else nothing to do

                console.log(`result: current level: ${currentLevel}, new level: ${newLevel}`);
                
                appliedTransformations = (newLevel !== currentLevel);
                // Return the new heading with the adjusted level
                return '#'.repeat(newLevel) + ' ';
            });
        } else if (settings.maxHeadingLevel > 1) {
            let delta = -1;
            let cascading = false;

            markdown = markdown.replace(headingRegex, (match, hashes) => {
                const currentLevel = hashes.length;
                let newLevel = currentLevel;
                
                if (settings.cascadeHeadingLevels) {
                    // If cascading is enabled, start cascading subsequent headings down if needed
                    if (cascading) {
                        // Cascade subsequent headers down, don't go deeper than H6
                        newLevel = Math.min(currentLevel + delta, 6);
                        console.log(`cascading: delta: ${delta}`);
                    } else if (currentLevel < settings.maxHeadingLevel) {
                        newLevel = settings.maxHeadingLevel;
                        delta = newLevel - currentLevel;
                        cascading = true;  // we need to cascade
                        console.log(`cascade initiated: delta: ${delta}`);
                    } // else nothing to do, heading is good as is
                } else {
                    // Cascading not enabled, just cap heading levels at max
                    newLevel = Math.max(currentLevel, settings.maxHeadingLevel)
                }
                
                console.log(`result: current level: ${currentLevel}, new level: ${newLevel}`);

                appliedTransformations = (newLevel !== currentLevel);

                // Return the new heading with the adjusted level
                return '#'.repeat(newLevel) + ' ';
            });
        }
    } else {
        // If escaping markdown, we don't want to change headings
        // Just escape the markdown content
        const originalMarkdown = markdown;
        
        // Escape all Markdown syntax that Obsidian recognizes
        // Headings, bold/italic, lists, links, images, code blocks, blockquotes, etc.
        markdown = markdown
            // Escape headings
            .replace(/^(#{1,6}\s)/gm, '\\$1')
            // Escape bold/italic
            .replace(/(\*\*|__|\*|_)/g, '\\$1')
            // Escape lists
            .replace(/^(\s*[-+*]\s)/gm, '\\$1')
            // Escape numbered lists
            .replace(/^(\s*\d+\.\s)/gm, '\\$1')
            // Escape links and images
            .replace(/(!?\[)/g, '\\$1')
            // Escape code blocks and inline code
            .replace(/(`{1,3})/g, '\\$1')
            // Escape blockquotes
            .replace(/^(\s*>\s)/gm, '\\$1')
            // Escape horizontal rules
            .replace(/^(\s*[-*_]{3,}\s*)$/gm, '\\$1')
            // Escape table syntax
            .replace(/(\|)/g, '\\$1')
            // Escape task lists
            .replace(/^(\s*- \[ \])/gm, '\\$1')
            // Escape HTML tags that might be interpreted, but only if they're not already inside backticks
            .replace(/(`.*?`)|(<\/?[a-z][^>]*>)/gi, (match, codeContent, htmlTag) => {
                // If this is a code block (first capture group), return it unchanged
                if (codeContent) return codeContent;
                // Otherwise it's an HTML tag that needs escaping
                return htmlTag ? '`' + htmlTag + '`' : match;
            });
            
        appliedTransformations = (originalMarkdown !== markdown);
    }

    // First handle the special line break markers
    let preserveLineBreaks = !settings.stripLineBreaks;
    
    // Process empty lines with a sliding window approach
    if (settings.removeEmptyLines) {
        // First, normalize line endings to ensure consistent processing
        markdown = markdown.replace(/\r\n/g, '\n');
        
        // Split the content into lines
        const lines = markdown.split('\n');
        const filteredLines: string[] = [];
        
        // Sliding window processing with peek capability
        for (let i = 0; i < lines.length; i++) {
            const currentLine = lines[i];
            const nextLine = i + 1 < lines.length ? lines[i + 1] : null;
            const isCurrentLineEmpty = currentLine.trim() === '';
            
            // Rule 1: Preserve line breaks - check for special markers
            if (preserveLineBreaks) {
                const hasPreserveMarker = 
                    /<p class="preserve-line-break"[^>]*>.*?<\/p>/.test(currentLine) ||
                    /<p data-preserve="true"[^>]*>.*?<\/p>/.test(currentLine);
                
                if (hasPreserveMarker) {
                    // Insert an empty line instead of the marker
                    filteredLines.push('');
                    continue;
                }
            }
            
            // Rule 2: Keep empty line if next line is a horizontal rule (3+ dashes)
            if (isCurrentLineEmpty && nextLine !== null && /^\s*-{3,}\s*$/.test(nextLine)) {
                filteredLines.push(currentLine);
                continue;
            }
            
            // Rule 3: Keep empty line if next line is the beginning of a table
            if (isCurrentLineEmpty && nextLine !== null && /^\s*\|.*\|/.test(nextLine)) {
                filteredLines.push(currentLine);
                continue;
            }
            
            // Default: Remove empty lines unless they meet the above criteria
            if (!isCurrentLineEmpty) {
                filteredLines.push(currentLine);
            }
        }
        
        // Join the filtered lines back together
        const originalMarkdown = markdown;
        markdown = filteredLines.join('\n');
        appliedTransformations = appliedTransformations || (originalMarkdown !== markdown);
    }
    
    return {
        markdown,
        appliedTransformations
    };
}
