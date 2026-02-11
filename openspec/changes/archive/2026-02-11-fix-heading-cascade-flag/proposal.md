# Change: Fix heading cascade appliedTransformations flag overwrite

Fixes: GitHub Issue #16 - "Text is pasted twice"

## Why

When pasting content containing headings via default paste (Ctrl+V / context menu) with "Contextual cascade" enabled, the `appliedTransformations` flag in the heading cascade logic is overwritten on each heading iteration instead of being accumulated. If the last heading processed does not require a level change, the flag is reset to `false`, causing `doPaste()` to return `false`. This means `event.preventDefault()` is never called, so Obsidian's default paste fires on content that the plugin already transformed and inserted -- or, more commonly, the plugin fails to insert its transformed content at all and the user gets untransformed output when they expected heading adjustments.

The same bug exists in both the contextual cascade path and the standard `maxHeadingLevel` cascade path.

## What Changes

- Fix `appliedTransformations` assignment in `src/markdownTransformer.ts` line 81 (contextual cascade) to accumulate instead of overwrite
- Fix `appliedTransformations` assignment in `src/markdownTransformer.ts` line 112 (maxHeadingLevel cascade) to accumulate instead of overwrite

## Impact

- Affected specs: `paste-interception` (new -- no existing spec covers this behavior)
- Affected code: `src/markdownTransformer.ts` (lines 81, 112)
