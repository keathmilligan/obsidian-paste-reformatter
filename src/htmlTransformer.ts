// Paste Reformatter - A plugin that re-formats pasted HTML text in Obsidian.
// Copyright (C) 2025 by Keath Milligan.

/**
 * Transforms the HTML content before converting it to Markdown
 * @param html The HTML content to transform
 * @param settings The settings to use for transformation
 * @returns The transformed HTML content
 */
export function transformHTML(
    html: string, 
    settings: { 
        htmlRegexReplacements: Array<{pattern: string, replacement: string}>, 
        stripLineBreaks: boolean, 
        removeEmptyElements: boolean 
    }
): string {
    // Apply regex replacements first
    if (settings.htmlRegexReplacements && settings.htmlRegexReplacements.length > 0) {
        for (const replacement of settings.htmlRegexReplacements) {
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
    if (settings.stripLineBreaks) {
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
            lineBreakP.textContent = '\u200B'; // Zero-width space
            
            // Replace the <br> with our special paragraph
            br.parentNode?.replaceChild(lineBreakP, br);
        });
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
    const serializer = new XMLSerializer();
    return serializer.serializeToString(doc.body);
}
