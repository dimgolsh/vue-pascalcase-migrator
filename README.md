# vue-pascalcase-migrator

> CLI tool and API to rename Vue component files from `kebab-case` to `PascalCase` and automatically update all imports across your codebase.

[![npm version](https://img.shields.io/npm/v/vue-pascalcase-migrator.svg)](https://www.npmjs.com/package/vue-pascalcase-migrator)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)

## ✨ Features

- 🔄 **Automatic Renaming** — Converts `my-component.vue` → `MyComponent.vue`
- 🔗 **Import Updates** — Finds and updates all static imports, dynamic imports, and re-exports
- 🎯 **Alias Support** — Handles path aliases like `@/components/my-component.vue`
- 🌿 **Git-Aware** — Uses `git mv` to preserve file history
- 📊 **HTML Reports** — Generates beautiful reports with Tailwind CSS styling
- 🔍 **Dry Run Mode** — Preview changes before applying them
- 🎯 **Git Diff Mode** — Rename only files changed in your branch
- 📦 **Programmatic API** — Use as a library in your own tools

## 📦 Installation

```bash
# Global installation (recommended for CLI usage)
npm install -g vue-pascalcase-migrator

# Local installation (for API usage)
npm install vue-pascalcase-migrator
```

## 🚀 CLI Usage

After global installation, you can use either `vue-pascalcase-migrator` or the shorter `vpm` alias.

### Rename Command

Rename all kebab-case Vue files in a directory:

```bash
# Preview changes (dry run)
vpm rename -d ./src/components --dry-run

# Apply changes
vpm rename -d ./src/components

# Generate HTML report
vpm rename -d ./src/components --report
```

**Options:**

| Option | Description |
|--------|-------------|
| `-d, --dir <directory>` | Target directory to scan for Vue files (required) |
| `--dry-run` | Preview changes without applying them |
| `-r, --report` | Generate HTML report after renaming |

### Rename Diff Command

Rename only Vue files that changed in your Git branch:

```bash
# Preview changes from current branch vs main
vpm rename:diff --dry-run

# Rename files changed vs specific branch
vpm rename:diff -b develop

# Only staged files
vpm rename:diff --staged

# Include untracked files
vpm rename:diff --untracked

# Generate report
vpm rename:diff --report
```

**Options:**

| Option | Description |
|--------|-------------|
| `-b, --branch <branch>` | Compare against branch (default: `main`) |
| `-s, --staged` | Include only staged files |
| `-u, --untracked` | Include untracked files |
| `--dry-run` | Preview changes without applying them |
| `-r, --report` | Generate HTML report after renaming |

## 📚 Programmatic API

You can use this package as a library in your own tools:

```typescript
import { renameVueFiles, findKebabCaseFiles } from 'vue-pascalcase-migrator';

// Full rename operation
const result = await renameVueFiles({
  targetDir: './src/components',
  dryRun: true, // Preview without making changes
  onProgress: (message, current, total) => {
    console.log(message, current, total);
  },
});

console.log(`Found ${result.summary.totalFiles} files to rename`);
console.log(`Found ${result.summary.totalImports} imports to update`);

// Just find files without renaming
const mappings = await findKebabCaseFiles({
  targetDir: './src/components',
});

for (const mapping of mappings) {
  console.log(`${mapping.oldName} → ${mapping.newName}`);
}
```

### API Reference

#### `renameVueFiles(options): Promise<RenameResult>`

Main function to rename Vue files and update imports.

**Options:**

| Property | Type | Default | Description |
|----------|------|---------|-------------|
| `targetDir` | `string` | — | Directory to scan for Vue files (required) |
| `cwd` | `string` | `process.cwd()` | Working directory |
| `importScanDir` | `string` | `targetDir` | Directory to scan for imports |
| `extensions` | `string[]` | `['ts', 'vue', 'tsx', 'js', 'jsx']` | File extensions to scan |
| `ignore` | `string[]` | `['**/node_modules/**', ...]` | Glob patterns to ignore |
| `dryRun` | `boolean` | `false` | Preview without making changes |
| `useGitMv` | `boolean` | `true` | Use git mv to preserve history |
| `aliases` | `PathAliases` | auto-detect | Path aliases for import resolution |
| `autoDetectAliases` | `boolean` | `true` | Auto-detect aliases from vite.config |
| `onProgress` | `function` | — | Progress callback |

**Returns:** `RenameResult`

```typescript
interface RenameResult {
  mappings: RenameMapping[];      // Files renamed
  fileStats: FileStats[];         // File statistics
  importUpdates: ImportUpdate[];  // Imports updated
  summary: {
    totalFiles: number;
    totalLines: number;
    totalSize: number;
    totalImports: number;
  };
  dryRun: boolean;
}
```

#### `findKebabCaseFiles(options): Promise<RenameMapping[]>`

Find all Vue files with kebab-case names.

```typescript
const mappings = await findKebabCaseFiles({
  targetDir: './src',
  ignore: ['**/node_modules/**'],
});
```

#### `createMappingsFromFiles(files): RenameMapping[]`

Create rename mappings from a list of file paths.

```typescript
const files = ['./src/my-component.vue', './src/user-card.vue'];
const mappings = createMappingsFromFiles(files);
```

#### `loadProject(options): Promise<Project>`

Load a ts-morph project for import analysis.

```typescript
const project = await loadProject({
  scanDir: './src',
  extensions: ['ts', 'vue'],
});
```

#### Utility Functions

```typescript
import {
  toPascalCase,       // 'my-component.vue' → 'MyComponent.vue'
  isKebabCase,        // Check if filename is kebab-case
  findImportUpdates,  // Find imports to update
  applyImportUpdates, // Apply import updates to project
  generateHtmlReport, // Generate HTML report string
  saveReport,         // Save report to file
  DEFAULT_ALIASES,    // Default path aliases: { '@': 'src', '~': 'src' }
  loadViteAliases,    // Load aliases from vite.config
  findViteConfig,     // Find vite.config file (recursive parent search)
  findProjectRoot,    // Find project root by locating vite.config
  getProjectAliases,  // Get aliases (auto-detect + defaults)
} from 'vue-pascalcase-migrator';
```

### Automatic Project Root Detection

The tool **automatically finds your project root** by searching for `vite.config.ts` or `vite.config.js` up the directory tree. This means you can run the command from any subdirectory:

```bash
# Running from a deep subdirectory
cd /project/frontend/src/components/deep/folder
vpm rename -d .

# The tool will find vite.config.ts in /project/frontend/
# and use that as the project root for resolving imports
```

### Path Aliases

The tool **automatically detects** path aliases from your `vite.config.ts` or `vite.config.js` file. No configuration needed!

Supported patterns in vite.config:

```typescript
// vite.config.ts
export default defineConfig({
  resolve: {
    alias: {
      '@': path.resolve(__dirname, 'src'),
      '@components': path.resolve(__dirname, 'src/components'),
    },
  },
});
```

If no vite.config is found, it falls back to defaults:

- `@/` → `src/`
- `~/` → `src/`

You can also customize aliases manually in the API:

```typescript
const result = await renameVueFiles({
  targetDir: './src/components',
  aliases: {
    '@': 'src',
    '@components': 'src/components',
  },
  autoDetectAliases: false, // Disable auto-detection
});
```

This allows the tool to correctly find and update imports like:

```typescript
// Before
import MyCard from '@/components/my-card.vue';

// After
import MyCard from '@/components/MyCard.vue';
```

## 📋 Example Output

```
🔍 Vue Component Rename Tool
   kebab-case → PascalCase
══════════════════════════════════════════════════

⚡ DRY RUN MODE - No changes will be made

✔ Found 5 files to rename
✔ Collected stats: 1,234 lines, 45.2 KB
✔ Loaded 892 source files
✔ Found 23 imports to update

Files to rename:
  user-card.vue → UserCard.vue (156 lines)
  nav-menu.vue → NavMenu.vue (89 lines)
  ...

──────────────────────────────────────────────────
   📁 5 files | 📝 1,234 lines | 🔗 23 imports
──────────────────────────────────────────────────

💡 Run without --dry-run to apply changes.
```

## 🔧 How It Works

1. **Scans** the target directory for `.vue` files with kebab-case names
2. **Analyzes** the entire frontend codebase using [ts-morph](https://ts-morph.com/)
3. **Finds** all imports referencing the files to be renamed:
   - Static imports (`import Component from './my-component.vue'`)
   - Dynamic imports (`import('./my-component.vue')`)
   - Re-exports (`export * from './my-component.vue'`)
4. **Updates** all import paths to use new PascalCase filenames
5. **Renames** files using `git mv` to preserve history
6. **Generates** an HTML report (optional)

## 📁 Project Structure

```
src/
├── index.ts              # CLI entry point
├── api.ts                # Programmatic API
├── commands/
│   ├── rename.ts         # rename command
│   └── rename-diff.ts    # rename:diff command
└── utils/
    ├── files.ts          # File utilities
    ├── imports.ts        # Import finding & updating
    ├── naming.ts         # kebab-case to PascalCase conversion
    ├── paths.ts          # Path constants
    └── report.ts         # HTML report generation
```

## 🛠 Development

```bash
# Clone the repository
git clone https://github.com/dimgolsh/vue-pascalcase-migrator.git
cd vue-pascalcase-migrator

# Install dependencies
npm install

# Run in development mode
npm run dev

# Run rename command directly
npm run rename -- -d ./src/components --dry-run

# Build for production
npm run build
```

## 📄 License

MIT © [Dmitriy](https://github.com/dimgolsh)
