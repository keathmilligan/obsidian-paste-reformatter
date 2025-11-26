# markdown-transformations Specification

## Purpose
TBD - created by archiving change add-single-spacing-transformer. Update Purpose after archive.
## Requirements
### Requirement: Single-spacing transformation
The system SHALL provide an option to collapse multiple consecutive blank lines into a single blank line in the markdown output.

#### Scenario: Multiple blank lines collapsed to single
- **WHEN** `convertToSingleSpaced` is enabled (true)
- **AND** the markdown content contains 2 or more consecutive blank lines
- **THEN** the consecutive blank lines SHALL be replaced with exactly 1 blank line
- **AND** the `appliedTransformations` flag SHALL be set to true

#### Scenario: Single blank lines preserved
- **WHEN** `convertToSingleSpaced` is enabled (true)
- **AND** the markdown content contains single blank lines (not consecutive)
- **THEN** those single blank lines SHALL be preserved as-is
- **AND** no transformation is applied to those lines

#### Scenario: Non-blank lines unaffected
- **WHEN** `convertToSingleSpaced` is enabled (true)
- **THEN** all non-blank lines SHALL remain unchanged

#### Scenario: Feature disabled preserves original behavior
- **WHEN** `convertToSingleSpaced` is disabled (false)
- **THEN** all blank lines SHALL remain unchanged regardless of how many are consecutive
- **AND** the `appliedTransformations` flag SHALL NOT be set based on spacing

#### Scenario: Interaction with removeEmptyLines
- **WHEN** `removeEmptyLines` is enabled (true)
- **THEN** the single-spacing transformer SHALL be skipped (not applied)
- **AND** the empty line removal logic SHALL be applied instead

### Requirement: Single-spacing configuration
The system SHALL provide a setting to enable or disable the single-spacing transformation.

#### Scenario: Setting defaults to disabled
- **WHEN** the plugin is initialized with no prior settings
- **THEN** the `convertToSingleSpaced` setting SHALL default to false

#### Scenario: Setting persists across sessions
- **WHEN** a user enables or disables the `convertToSingleSpaced` setting
- **AND** the settings are saved
- **THEN** the setting value SHALL be persisted and restored on plugin reload

### Requirement: Single-spacing UI control
The system SHALL provide a user interface control for the single-spacing transformation setting.

#### Scenario: Toggle positioned above "Remove empty lines"
- **WHEN** the settings UI is displayed
- **THEN** the "Convert to single-spaced" toggle SHALL appear in the Markdown transformations section
- **AND** it SHALL be positioned above the "Remove empty lines" toggle

#### Scenario: Toggle description
- **WHEN** the "Convert to single-spaced" toggle is displayed
- **THEN** the description SHALL read "Collapse multiple consecutive blank lines into a single blank line"

#### Scenario: Toggle disabled when removeEmptyLines is enabled
- **WHEN** the "Remove empty lines" setting is enabled (true)
- **THEN** the "Convert to single-spaced" toggle SHALL be disabled (non-interactive)
- **AND** it SHALL be visually indicated as disabled (grayed out or similar)

#### Scenario: Toggle enabled when removeEmptyLines is disabled
- **WHEN** the "Remove empty lines" setting is disabled (false)
- **THEN** the "Convert to single-spaced" toggle SHALL be enabled (interactive)
- **AND** users SHALL be able to toggle it on or off

#### Scenario: UI updates when removeEmptyLines changes
- **WHEN** the "Remove empty lines" setting is toggled
- **THEN** the disabled/enabled state of the "Convert to single-spaced" toggle SHALL update accordingly

### Requirement: Transform pipeline order
The system SHALL apply transformations in a defined order to ensure consistent behavior.

#### Scenario: Single-spacing before empty line removal
- **WHEN** both `convertToSingleSpaced` and `removeEmptyLines` are configured (regardless of values)
- **THEN** the single-spacing transformation logic SHALL be evaluated before the empty line removal logic in the code
- **AND** if `removeEmptyLines` is true, single-spacing SHALL be skipped as an optimization

