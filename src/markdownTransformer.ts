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
        markdownRegexReplacements: Array<{ pattern: string, replacement: string }>,
        contextualCascade: boolean,
        maxHeadingLevel: number,
        cascadeHeadingLevels: boolean,
        stripLineBreaks: boolean,
        convertToSingleSpaced: boolean,
        removeEmptyLines: boolean
    },
    contextLevel: number = 0,
    escapeMarkdown: boolean = false
): { markdown: string, appliedTransformations: boolean } {
    let appliedTransformations = false;

    console.log(`original: ${markdown}`);

    // Apply regex replacements if defined
    if (settings.markdownRegexReplacements && settings.markdownRegexReplacements.length > 0) {
        for (const regex_replacement of settings.markdownRegexReplacements) {
            try {
                const regex = new RegExp(regex_replacement.pattern, 'g');
                const replacement = regex_replacement.replacement
                    .replace(/\\r\\n/g, '\r\n')
                    .replace(/\\n/g, '\n')
                    .replace(/\\r/g, '\r')
                    .replace(/\\t/g, '\t')
                    .replace(/\\'/g, "'")
                    .replace(/\\"/g, '"')
                    .replace(/\\\\/g, '\\');
                const originalMarkdown = markdown;
                // console.log(`applying ${JSON.stringify(regex_replacement.pattern)} replacement ${JSON.stringify(replacement)}`); console.log(JSON.stringify(markdown));
                markdown = markdown.replace(regex, replacement);
                if (originalMarkdown !== markdown) {
                    appliedTransformations = true;
                    console.log(`regex replacements: ${markdown}`);
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
                    console.log(`*** contextual cascade initiated: delta: ${delta}`);
                } // else nothing to do

                console.log(`result: current level: ${currentLevel}, new level: ${newLevel}`);

                appliedTransformations = appliedTransformations || (newLevel !== currentLevel);
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

                appliedTransformations = appliedTransformations || (newLevel !== currentLevel);

                // Return the new heading with the adjusted level
                return '#'.repeat(newLevel) + ' ';
            });
        }

        const artifactCleanupResult = normalizePastedMarkdownArtifacts(markdown);
        markdown = artifactCleanupResult.markdown;
        appliedTransformations = appliedTransformations || artifactCleanupResult.appliedTransformations;
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

    console.log(`processed: ${markdown}`);

    // First handle the special line break markers
    let preserveLineBreaks = !settings.stripLineBreaks;

    // Convert multiple consecutive blank lines to single blank line if enabled
    // Skip this if removeEmptyLines is enabled (optimization - lines will be removed anyway)
    if (settings.convertToSingleSpaced && !settings.removeEmptyLines) {
        // Normalize line endings to ensure consistent processing
        markdown = markdown.replace(/\r\n/g, '\n');

        // Replace 2 or more consecutive newlines with exactly 2 newlines (1 blank line)
        const originalMarkdown = markdown;
        markdown = markdown.replace(/\n{3,}/g, '\n\n');

        if (originalMarkdown !== markdown) {
            appliedTransformations = true;
        }
    }

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

    console.log(`final: ${markdown}`);
    return {
        markdown,
        appliedTransformations
    };
}

function normalizePastedMarkdownArtifacts(markdown: string): { markdown: string, appliedTransformations: boolean } {
    const originalMarkdown = markdown;

    // Some rich-text sources, notably WeChat articles, use visual bullet glyphs
    // inside real list items. Obsidian's converter then produces "- • item".
    markdown = markdown
        .replace(/^(\s*)[-*+]\s+[•·●]\s+/gm, '$1- ')
        .replace(/^(\s*)[•·●]\s+/gm, '$1- ')
        .replace(/^(\s*\d+\.)\s+\d+\.\s+/gm, '$1 ');

    markdown = markdown.replace(/`([^`\n]+)`/g, (match, content) => {
        const code = stripWechatLineNumberGutter(content);
        if (!code) {
            return match;
        }

        const fence = code.includes('```') ? '~~~' : '```';
        return `${fence}\n${code}\n${fence}`;
    });

    return {
        markdown,
        appliedTransformations: originalMarkdown !== markdown
    };
}

function stripWechatLineNumberGutter(content: string): string | null {
    const normalized = content
        .replace(/[\u00a0\u2007\u202f]/g, ' ')
        .replace(/[\u200b\u200c\u200d\ufeff]/g, '\n');

    const normalizedLines = normalized
        .split(/\n+/)
        .map(line => line.replace(/[ \t]+$/g, ''))
        .filter(line => line.length > 0);

    if (normalizedLines.length > 1 && isLineNumberGutter(normalizedLines[0].trim())) {
        return stripCommonIndent(normalizedLines.slice(1)).join('\n');
    }

    if (!/^\s{2,}\d+\s+/.test(normalized)) {
        return null;
    }

    let rest = normalized.trimStart();
    let expectedLineNumber = 1;
    let consumedLineNumbers = 0;

    while (true) {
        const lineNumberPattern = new RegExp(`^${expectedLineNumber}\\b\\s+`);
        const lineNumberMatch = rest.match(lineNumberPattern);

        if (!lineNumberMatch) {
            break;
        }

        rest = rest.slice(lineNumberMatch[0].length);
        expectedLineNumber++;
        consumedLineNumbers++;
    }

    rest = rest.trim();

    if (consumedLineNumbers === 0 || rest.length === 0) {
        return null;
    }

    if (consumedLineNumbers > 1) {
        const lines = rest
            .split(/[ \t]{3,}/)
            .map(line => line.trim())
            .filter(line => line.length > 0);

        if (lines.length > 1) {
            return lines.join('\n');
        }
    }

    return rest;
}

function isLineNumberGutter(line: string): boolean {
    const lineNumbers = line.match(/\d+/g);

    if (!lineNumbers || lineNumbers.length === 0) {
        return false;
    }

    if (!/^(?:\d+\s*)+$/.test(line)) {
        return false;
    }

    return lineNumbers.every((lineNumber, index) => Number(lineNumber) === index + 1);
}

function stripCommonIndent(lines: string[]): string[] {
    const nonEmptyLines = lines.filter(line => line.trim().length > 0);

    if (nonEmptyLines.length === 0) {
        return lines;
    }

    const commonIndent = Math.min(
        ...nonEmptyLines.map(line => {
            const indentMatch = line.match(/^[ \t]*/);
            return indentMatch ? indentMatch[0].length : 0;
        })
    );

    if (commonIndent === 0) {
        return lines;
    }

    return lines.map(line => line.slice(commonIndent));
}
