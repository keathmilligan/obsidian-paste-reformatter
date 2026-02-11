# paste-interception Specification

## Purpose
TBD - created by archiving change fix-heading-cascade-flag. Update Purpose after archive.
## Requirements
### Requirement: Heading cascade transformation flag accumulation
The heading cascade logic in `transformMarkdown` SHALL accumulate the `appliedTransformations` flag across all headings processed, so that if any heading's level is changed, the flag remains `true` for the entire paste operation.

#### Scenario: Multiple headings where only the first is changed
- **WHEN** contextual cascade is enabled
- **AND** the cursor is under an H2 heading
- **AND** the pasted content contains `# Title` followed by `### Detail`
- **THEN** the `appliedTransformations` flag SHALL be `true` after processing all headings
- **AND** `doPaste()` SHALL return `true`
- **AND** `event.preventDefault()` SHALL be called to suppress Obsidian's default paste

#### Scenario: Multiple headings where the last does not need adjustment
- **WHEN** contextual cascade is enabled
- **AND** the cursor is under an H2 heading
- **AND** the pasted content ends with a heading that already matches the target level
- **THEN** the `appliedTransformations` flag SHALL remain `true` from earlier heading changes
- **AND** the content SHALL be pasted exactly once with corrected heading levels

#### Scenario: No headings need adjustment
- **WHEN** contextual cascade is enabled
- **AND** no headings in the pasted content require level changes
- **THEN** the `appliedTransformations` flag SHALL be `false`
- **AND** `doPaste()` SHALL return `false` (unless other transformations applied)
- **AND** Obsidian's default paste behavior SHALL proceed

#### Scenario: maxHeadingLevel cascade flag accumulation
- **WHEN** contextual cascade is disabled
- **AND** `maxHeadingLevel` is set above 1
- **AND** `cascadeHeadingLevels` is enabled
- **AND** pasted content contains multiple headings where at least one is changed
- **THEN** the `appliedTransformations` flag SHALL remain `true` after processing all headings

