## 1. Implementation
- [x] 1.1 Add `isCursorInCodeBlock(editor)` helper to `src/main.ts` that scans lines backward from the cursor to detect unclosed fenced code blocks (triple-backtick or triple-tilde)
- [x] 1.2 Add early-return guard in `onPaste()` that calls `isCursorInCodeBlock()` and skips reformatting when inside a code block
- [x] 1.3 Add debug log message when paste is skipped due to code block context

## 2. Verification
- [x] 2.1 Build with `npm run build` to confirm no compilation errors
- [ ] 2.2 Manual test: paste HTML content into a fenced code block and verify raw text is pasted (no reformatting)
- [ ] 2.3 Manual test: paste HTML content outside a code block and verify reformatting still works
- [ ] 2.4 Manual test: paste into a code block with a language specifier (e.g., ```js) and verify raw text is pasted
- [ ] 2.5 Manual test: paste into an indented code block (4 spaces) -- note: this change only targets fenced blocks
