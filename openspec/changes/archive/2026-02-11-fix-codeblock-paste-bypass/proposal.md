# Change: Skip reformatting when pasting into a code block

## Why
When a user pastes content into a fenced code block (`` ``` ``), the plugin reformats the pasted text (HTML-to-Markdown conversion, heading cascade, regex replacements, etc.). This destroys the raw content the user intended to paste as code. The plugin should detect code block context and let Obsidian's default paste proceed. (GitHub issue #14)

## What Changes
- Add a code block detection function that scans backward from the cursor to determine if the cursor is inside a fenced code block
- Add an early-return guard in `onPaste()` that skips reformatting when the cursor is inside a code block

## Impact
- Affected specs: `paste-interception`
- Affected code: `src/main.ts` (`onPaste` method, new helper function)
