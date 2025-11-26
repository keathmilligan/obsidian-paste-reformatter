# Implementation Tasks

## 1. Update settings interface and defaults
- [x] 1.1 Add `convertToSingleSpaced: boolean` property to `PasteReformmatterSettings` interface in `src/main.ts`
- [x] 1.2 Add `convertToSingleSpaced: false` to `DEFAULT_SETTINGS` in `src/main.ts`

## 2. Implement single-spacing transformer
- [x] 2.1 Add `convertToSingleSpaced` parameter to `transformMarkdown` function signature in `src/markdownTransformer.ts`
- [x] 2.2 Implement single-spacing logic that collapses 2+ consecutive blank lines into 1 blank line
- [x] 2.3 Apply transformer before the `removeEmptyLines` logic in the transformation pipeline
- [x] 2.4 Skip single-spacing transformer if `removeEmptyLines` is enabled (optimization - no point processing if lines will be removed)
- [x] 2.5 Set `appliedTransformations` flag when single-spacing makes changes

## 3. Add settings UI
- [x] 3.1 Add "Convert to single-spaced" toggle in settings UI, positioned above "Remove empty lines" setting
- [x] 3.2 Set description text: "Collapse multiple consecutive blank lines into a single blank line"
- [x] 3.3 Implement conditional disabling: when `removeEmptyLines` is true, disable the toggle and show it as disabled/grayed
- [x] 3.4 Update onChange handler to save settings
- [x] 3.5 When `removeEmptyLines` changes, refresh display to update disabled state of "Convert to single-spaced" toggle

## 4. Integration
- [x] 4.1 Pass `convertToSingleSpaced` setting to `transformMarkdown` call in `src/main.ts:doPaste()`
- [x] 4.2 Verify backward compatibility with existing settings (defaults to false)

## 5. Testing
- [x] 5.1 Build project: `npm run build`
- [x] 5.2 Test single-spacing with text containing 2+ consecutive blank lines
- [x] 5.3 Test that single-spacing is skipped when "Remove empty lines" is enabled
- [x] 5.4 Test UI toggle behavior and disabled state interaction
- [x] 5.5 Test that existing behavior is preserved when feature is disabled (default)
