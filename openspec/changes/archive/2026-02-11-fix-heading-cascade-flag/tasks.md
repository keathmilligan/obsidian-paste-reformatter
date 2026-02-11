## 1. Fix appliedTransformations flag

- [x] 1.1 In `src/markdownTransformer.ts` line 81, change `appliedTransformations = (newLevel !== currentLevel)` to `appliedTransformations = appliedTransformations || (newLevel !== currentLevel)`
- [x] 1.2 In `src/markdownTransformer.ts` line 112, apply the same accumulation fix

## 2. Validation

- [x] 2.1 Run `npm run build` to verify TypeScript compilation
- [ ] 2.2 Manual test: paste content with headings (e.g. `# Title\n## Section`) with contextual cascade enabled under an existing heading -- verify single paste with correct heading levels
- [ ] 2.3 Manual test: paste same content via Command Palette "Reformat and Paste" -- verify unchanged behavior
- [ ] 2.4 Manual test: paste content with headings using maxHeadingLevel cascade (contextual cascade off) -- verify single paste with correct heading levels
- [ ] 2.5 Manual test: paste content with no headings -- verify default paste behavior is unaffected
