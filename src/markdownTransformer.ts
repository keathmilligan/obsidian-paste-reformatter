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
    
    // If we're not stripping line breaks, we need to handle the special markers
    if (preserveLineBreaks) {
        // Replace special line break markers with a unique placeholder that won't be affected by empty line removal
        const lineBreakPlaceholder = '___LINE_BREAK_PLACEHOLDER___';
        markdown = markdown.replace(/<p class="preserve-line-break"[^>]*>.*?<\/p>/g, lineBreakPlaceholder);
        markdown = markdown.replace(/<p data-preserve="true"[^>]*>.*?<\/p>/g, lineBreakPlaceholder);
        
        // Remove empty lines if enabled
        if (settings.removeEmptyLines) {
            // First, normalize line endings to ensure consistent processing
            markdown = markdown.replace(/\r\n/g, '\n');
            
            // Split the content into lines
            const lines = markdown.split('\n');
            
            // Filter out empty lines, but keep our placeholders
            const filteredLines = lines.filter(line => {
                return line.trim() !== '' || line.includes(lineBreakPlaceholder);
            });
            
            // Join the filtered lines back together
            const originalMarkdown = markdown;
            markdown = filteredLines.join('\n');
            appliedTransformations = (originalMarkdown !== markdown);
        }
        
        // Now replace our placeholders with actual line breaks
        markdown = markdown.replace(new RegExp(lineBreakPlaceholder, 'g'), '\n');
    } else {
        // If we're stripping line breaks, just remove empty lines normally
        if (settings.removeEmptyLines) {
            // First, normalize line endings to ensure consistent processing
            markdown = markdown.replace(/\r\n/g, '\n');
            
            // Split the content into lines
            const lines = markdown.split('\n');
            
            // Filter out all empty lines
            const filteredLines = lines.filter(line => line.trim() !== '');

            // Join the filtered lines back together
            const originalMarkdown = markdown;
            markdown = filteredLines.join('\n');
            appliedTransformations = (originalMarkdown !== markdown);
        }
    }
    
    return {
        markdown,
        appliedTransformations
    };
}
