# Change: Add single-spacing transformer for markdown

## Why

Users may want to collapse multiple consecutive blank lines in pasted content into single blank lines without removing all blank lines entirely. This provides a middle-ground option between preserving all blank lines as-is and removing them completely.

## What Changes

- Add a new markdown transformer that collapses multiple consecutive blank lines (2+) into a single blank line
- Add a new setting "Convert to single-spaced" that appears above "Remove empty lines" in the Markdown transformations section
- The setting defaults to Off (false) to preserve existing behavior
- When "Remove empty lines" is enabled, the "Convert to single-spaced" option is disabled (not applicable) since all blank lines are removed anyway
- The transformer is applied in the markdown transformation pipeline before empty line removal

## Impact

- Affected specs: `markdown-transformations`
- Affected code:
  - `src/markdownTransformer.ts` - Add single-spacing logic
  - `src/main.ts` - Add `convertToSingleSpaced` setting and UI toggle with conditional disabling
- No breaking changes
- Backward compatible: defaults to Off, existing behavior unchanged
