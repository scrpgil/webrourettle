# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Common Commands

### Development
- `npm start` or `ng serve` - Start development server on http://localhost:4200
- `npm run build` - Build for production
- `npm run watch` - Build in watch mode for development
- `npm test` or `ng test` - Run unit tests with Karma/Jasmine

### Code Generation
- `ng generate component component-name` - Generate new component
- `ng generate --help` - List available schematics

## Architecture

This is an Angular 20+ standalone application using:
- **Standalone Components**: Uses `imports` array instead of NgModules
- **Application Config**: Bootstrap configuration in `src/app/app.config.ts`
- **Routing**: Router configuration in `src/app/app.routes.ts` (currently empty)
- **Strict TypeScript**: Enabled with comprehensive type checking

### Key Files
- `src/main.ts` - Application bootstrap entry point
- `src/app/app.ts` - Root component (App class, not AppComponent)
- `src/app/app.config.ts` - Application providers configuration
- `src/app/app.routes.ts` - Route definitions

### Component Structure
Components follow the pattern:
- Separate files for template (.html), styles (.css), and logic (.ts)
- Use `imports` array for dependencies instead of NgModules
- Protected properties convention (e.g., `protected title`)

### Build Configuration
- Uses new Angular `@angular/build:application` builder
- TypeScript project references structure with separate configs for app and spec
- Strict compilation settings enabled