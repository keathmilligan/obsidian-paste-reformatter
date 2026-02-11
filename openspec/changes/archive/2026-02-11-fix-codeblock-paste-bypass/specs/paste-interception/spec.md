## ADDED Requirements
### Requirement: Code block paste bypass
The plugin SHALL NOT reformat pasted content when the cursor is inside a fenced code block. When a fenced code block is detected, the plugin SHALL allow Obsidian's default paste behavior to proceed unmodified.

A fenced code block is detected by scanning backward from the cursor line to find an opening fence (a line starting with `` ``` `` or `~~~`, optionally followed by a language identifier) that has no corresponding closing fence before the cursor position.

#### Scenario: Paste inside an open fenced code block
- **WHEN** `pasteOverride` is enabled
- **AND** the cursor is positioned inside a fenced code block (between an opening `` ``` `` and before a closing `` ``` ``)
- **AND** the user pastes content
- **THEN** the plugin SHALL skip all transformations
- **AND** `event.preventDefault()` SHALL NOT be called
- **AND** Obsidian's default paste behavior SHALL proceed

#### Scenario: Paste outside a code block
- **WHEN** `pasteOverride` is enabled
- **AND** the cursor is NOT inside a fenced code block
- **AND** the user pastes content
- **THEN** the plugin SHALL process the paste as normal (applying configured transformations)

#### Scenario: Paste after a closed code block
- **WHEN** `pasteOverride` is enabled
- **AND** the document contains a fenced code block that has both opening and closing fences
- **AND** the cursor is positioned after the closing fence
- **THEN** the plugin SHALL process the paste as normal (the code block is closed, cursor is not inside it)

#### Scenario: Fenced code block with language specifier
- **WHEN** `pasteOverride` is enabled
- **AND** the cursor is inside a fenced code block that has a language specifier (e.g., `` ```javascript ``)
- **AND** the user pastes content
- **THEN** the plugin SHALL skip all transformations
- **AND** Obsidian's default paste behavior SHALL proceed

#### Scenario: Tilde-fenced code block
- **WHEN** `pasteOverride` is enabled
- **AND** the cursor is inside a tilde-fenced code block (opened with `~~~`)
- **AND** the user pastes content
- **THEN** the plugin SHALL skip all transformations
- **AND** Obsidian's default paste behavior SHALL proceed
