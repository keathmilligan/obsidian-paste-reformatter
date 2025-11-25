# Project Context

## Purpose

Paste Reformatter is an Obsidian plugin that gives users precise control over how pasted HTML and plain text content is transformed when pasted into notes. The plugin automatically processes clipboard content to:

- Transform HTML content before converting to Markdown for better formatting results
- Apply customizable regex transformations to both HTML and Markdown
- Automatically adjust heading levels to match document context
- Clean up unwanted formatting (empty elements, hard line breaks, blank lines)
- Escape markdown syntax when needed

## Tech Stack

- **TypeScript 4.7.4** - Primary language (ES6 target)
- **Obsidian API** - Plugin framework and editor integration
- **esbuild 0.17.3** - Build tool and bundler
- **DOM APIs** - HTML parsing and manipulation
- **Obsidian's htmlToMarkdown** - Built-in HTML to Markdown conversion

## Project Conventions

### Code Style

- TypeScript with strict null checks enabled
- ES6+ syntax with ESNext module format
- 4-space tabs for indentation
- Camel case for variables and functions, PascalCase for classes/interfaces
- Comprehensive JSDoc comments for public functions
- Descriptive variable names (e.g., `appliedTransformations`, `contextLevel`)

### Architecture Patterns

The codebase follows a modular architecture with clear separation of concerns:

**Core Plugin Structure (`src/main.ts`)**:
- `PasteReformatter` class extends Obsidian's `Plugin` class
- Registers clipboard event handlers and commands
- Manages settings persistence via `loadData()`/`saveData()`
- Delegates transformation logic to specialized modules

**HTML Transformation Module (`src/htmlTransformer.ts`)**:
- Pure function: `transformHTML(html, settings) => {html, appliedTransformations}`
- Uses DOMParser for safe HTML manipulation (never uses innerHTML)
- Applies transformations in sequence: regex → line breaks → empty elements
- Returns transformation status to determine if paste should be intercepted

**Markdown Transformation Module (`src/markdownTransformer.ts`)**:
- Pure function: `transformMarkdown(markdown, settings, contextLevel, escapeMarkdown) => {markdown, appliedTransformations}`
- Handles heading level adjustments with three modes:
  - Contextual cascade (based on cursor position)
  - Standard cascade (based on max heading level)
  - Simple capping (no cascade)
- Applies regex replacements and empty line removal
- Supports markdown escaping for special paste mode

**Settings Management**:
- `PasteReformmatterSettings` interface defines all configuration
- `DEFAULT_SETTINGS` constant for initialization
- Custom settings tab with rich UI (tables, icons, accessibility features)
- Settings UI built entirely with DOM APIs (no innerHTML)

**Key Design Patterns**:
- **Transformation Pipeline**: HTML → Markdown → Final transformations
- **Non-invasive Override**: Only prevents default paste if transformations were applied
- **Safe DOM Manipulation**: Exclusively uses createElement/appendChild patterns
- **Accessibility First**: All UI elements include ARIA labels and keyboard support

### Testing Strategy

Currently, the project does not have automated tests. Testing is performed manually:

- Use `npm run build` to verify TypeScript compilation
- Manual testing in Obsidian vault with various paste scenarios
- Test different content sources (web pages, Google Docs, Word, plain text)
- Verify heading cascade behavior with cascade-rules.md examples
- Check settings UI behavior and persistence

When adding tests, prioritize:
1. Transformation logic (htmlTransformer, markdownTransformer)
2. Heading cascade algorithms (all three modes)
3. Regex replacement handling and error cases
4. Settings persistence and migration

### Git Workflow

- **Main branch**: Production-ready code
- **Commit style**: Conventional commits format
  - `feat:` - New features
  - `fix:` - Bug fixes
  - `refactor:` - Code improvements without behavior change
  - `chore:` - Maintenance tasks (version bumps, dependencies)
  - `docs:` - Documentation updates
- **Version bumping**: Automated via `version-bump.mjs` script
- **Release process**: GitHub Actions workflow (`.github/workflows/release.yml`)

## Domain Context

### Obsidian Plugin Ecosystem

- Plugins extend Obsidian's markdown editor functionality
- Must work across desktop and mobile (this plugin works on both)
- Need to respect user themes and CSS variables
- Should integrate cleanly with other plugins (non-invasive event handling)

### Clipboard Data Handling

The plugin processes clipboard data in this order of priority:
1. **HTML format** (`text/html`) - Preferred for rich content from web/apps
2. **Plain text** (`text/plain`) - Treated as already being Markdown

### Heading Cascade Logic

Three distinct modes with different behaviors (see `cascade-rules.md`):

1. **No Cascade** (maxHeadingLevel=1 OR cascadeHeadingLevels=false):
   - Simple capping: H1→H3, H2→H3 if max is H3

2. **Standard Cascade** (cascadeHeadingLevels=true, contextualCascade=false):
   - Preserves hierarchy: H1→H3, H2→H4, H3→H5 if max is H3
   - Caps at H6

3. **Contextual Cascade** (contextualCascade=true):
   - Overrides other settings
   - Adjusts based on cursor's current heading section
   - In H2 section: H1→H3, H2→H4, H3→H5, etc.

### Special Markers

- `data-preserve="true"` attribute marks line breaks to preserve during empty element removal
- Zero-width space (`\u200B`) used as placeholder to prevent paragraph collapse

## Important Constraints

### Security

- **Never use innerHTML or outerHTML** - XSS vulnerability risk
- Always use DOMParser, createElement, appendChild patterns
- Sanitize user-provided regex patterns with try-catch blocks

### Obsidian API Compatibility

- Minimum supported version: 0.15.0 (defined in manifest.json)
- Must use current (non-deprecated) API methods
- Use `app.workspace.getActiveViewOfType(MarkdownView)` not deprecated alternatives
- Register events with `registerEvent()` for automatic cleanup

### Performance

- Transformations must be fast (paste should feel instant)
- Regex replacements loop through array - keep replacement lists reasonable
- DOM parsing happens on every paste when enabled - keep HTML clean

### Browser Compatibility

- Must work in Electron (Chromium-based)
- Uses modern APIs: DOMParser, XMLSerializer, navigator.clipboard
- Targets ES2018 in build output

## External Dependencies

### Runtime Dependencies

- **Obsidian API** (`obsidian` module) - Provides:
  - `Plugin` base class
  - `MarkdownView` for editor access
  - `Setting` for settings UI
  - `htmlToMarkdown()` conversion function
  - `Notice` for user notifications
  - `setIcon()` for UI icons

### Development Dependencies

- **esbuild** - Fast TypeScript bundler
- **TypeScript** - Type checking and compilation
- **@types/node** - Node.js type definitions
- **tslib** - TypeScript runtime helpers
- **builtin-modules** - List of Node.js built-in modules to exclude from bundle

### Build Process

1. TypeScript compilation check (`tsc -noEmit -skipLibCheck`)
2. esbuild bundles `src/main.ts` → `dist/main.js`
3. Styles copied from `styles.css` to dist
4. External dependencies (obsidian, electron, codemirror) marked as external
5. Production builds are minified, dev builds include inline sourcemaps

### Distribution

- Main files: `dist/main.js`, `manifest.json`, `styles.css`
- Distributed via Obsidian Community Plugins marketplace
- GitHub releases include ZIP with required files
- Version managed in: `manifest.json`, `package.json`, `versions.json`
