<!-- OPENSPEC:START -->
# OpenSpec Instructions

These instructions are for AI assistants working in this project.

Always open `@/openspec/AGENTS.md` when the request:
- Mentions planning or proposals (words like proposal, spec, change, plan)
- Introduces new capabilities, breaking changes, architecture shifts, or big performance/security work
- Sounds ambiguous and you need the authoritative spec before coding

Use `@/openspec/AGENTS.md` to learn:
- How to create and apply change proposals
- Spec format and conventions
- Project structure and guidelines

Keep this managed block so 'openspec update' can refresh the instructions.

<!-- OPENSPEC:END -->

# Obsidian Plugin Development Guidelines

This is an Obsidian plugin project. Follow these guidelines when working with the codebase.

## Reference Documentation

- Official guide: https://docs.obsidian.md/Plugins/Getting+started/Build+a+plugin
- API reference: https://docs.obsidian.md/Reference/TypeScript+API/Plugin
- TypeScript API: Use `obsidian` module types

## Project Structure

- `main.ts` - Main plugin entry point (extends `Plugin` class)
- `manifest.json` - Plugin metadata (id, name, version, minAppVersion)
- `styles.css` - Plugin styles (optional)
- `src/` - Additional source files and modules

## Best Practices

### Security & DOM Manipulation
- **Never** use `innerHTML` or `outerHTML` (security risk)
- Use DOM APIs (`createElement`, `appendChild`, etc.) or Obsidian helper functions
- Sanitize user input before rendering
- Prefer `createEl()` and `createDiv()` methods from Obsidian API

### Styling
- Avoid assigning styles via JavaScript or inline HTML
- Move all styles to CSS files for better theme compatibility
- Use CSS variables for colors and spacing when possible
- Follow Obsidian's design language
- Use `app.workspace.containerEl.win` to access the window object for styles

### Settings
- Use the `Setting` API for all settings components
- Include proper headings and dividers using the Settings API
- Use sentence case for all UI text and headings
- Organize settings logically into sections
- Store settings in a dedicated settings object
- Call `saveData()` after settings changes

### Code Organization
- Keep main plugin file lean, delegate to separate modules
- Use TypeScript for better type safety
- Follow async/await patterns for asynchronous operations
- Clean up resources in `onunload()` method
- Use `addCommand()` for command palette integration
- Use `registerEvent()` for event listeners to ensure cleanup

### Plugin Lifecycle
- `onload()` - Initialize plugin, register events, commands, settings
- `onunload()` - Clean up resources, remove event listeners
- Use `this.register()` to register cleanup callbacks
- Use `this.registerEvent()` for automatic event cleanup

### Common Patterns
- Access app: `this.app`
- Access vault: `this.app.vault`
- Access workspace: `this.app.workspace`
- Read files: `this.app.vault.read(file)`
- Modify files: `this.app.vault.modify(file, content)`
- Create notices: `new Notice("message")`

### Development Workflow
- Use `npm run dev` to watch and rebuild on changes
- Hot reload: Copy built `main.js` to vault's `.obsidian/plugins/` folder
- Test in actual Obsidian vault for best results
- Check console for errors: View > Toggle Developer Tools

### Performance
- Avoid blocking the main thread
- Use debouncing for frequent operations
- Be mindful of large vault operations
- Cache expensive computations when appropriate