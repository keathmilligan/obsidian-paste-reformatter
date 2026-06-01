// Paste Reformatter - A plugin that re-formats pasted HTML text in Obsidian.
// Copyright (C) 2025 by Keath Milligan.

/**
 * Transforms the HTML content before converting it to Markdown
 * @param html The HTML content to transform
 * @param settings The settings to use for transformation
 * @returns An object containing the transformed HTML content and whether any transformations were applied
 */
export function transformHTML(
    html: string,
    settings: {
        htmlRegexReplacements: Array<{ pattern: string, replacement: string }>,
        stripLineBreaks: boolean,
        removeEmptyElements: boolean
    }
): { html: string, appliedTransformations: boolean } {
    let appliedTransformations = false;

    // Apply regex replacements first
    if (settings.htmlRegexReplacements && settings.htmlRegexReplacements.length > 0) {
        for (const replacement of settings.htmlRegexReplacements) {
            try {
                const regex = new RegExp(replacement.pattern, 'g');
                const originalHtml = html;
                html = html.replace(regex, replacement.replacement);
                if (originalHtml !== html) {
                    appliedTransformations = true;
                }
            } catch (error) {
                console.error(`Error applying regex replacement: ${error}`);
            }
        }
    }

    // Create a temporary DOM element to parse the HTML
    const parser = new DOMParser();
    const doc = parser.parseFromString(html, 'text/html');

    // Process line breaks if strip line breaks is enabled
    if (settings.stripLineBreaks) {
        // Find all <br> elements and remove them
        const brElements = doc.querySelectorAll('br');
        brElements.forEach(br => {
            br.remove();
        });
        appliedTransformations = true;
    }

    // Remove empty elements if enabled
    if (settings.removeEmptyElements) {
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

            // Check if it has any text content (include whitespace)
            if (element.textContent && element.textContent.length > 0) {
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
            const potentialEmptyElements = doc.querySelectorAll('p, div, span, li, ul, ol, table, tr, td, th');
            potentialEmptyElements.forEach(element => {
                if (isElementEmpty(element)) {
                    element.remove();
                    emptyElementsFound = true;
                    appliedTransformations = true;
                }
            });

            // If no more empty elements are found, exit the loop
            if (!emptyElementsFound) {
                break;
            }
        }
    }

    // Return the modified HTML and transformation status
    const serializer = new XMLSerializer();
    return {
        html: serializer.serializeToString(doc.body),
        appliedTransformations
    };
}
