/**
 * Vue PascalCase Migrator - Programmatic API
 *
 * @example
 * ```ts
 * import { renameVueFiles, findKebabCaseFiles } from 'vue-pascalcase-migrator';
 *
 * // Find files to rename
 * const result = await renameVueFiles({
 *   targetDir: './src/components',
 *   dryRun: true,
 * });
 *
 * console.log(result.mappings); // Files that would be renamed
 * console.log(result.importUpdates); // Imports that would be updated
 * ```
 */

import { Project } from 'ts-morph';
import { glob } from 'glob';
import * as path from 'path';
import * as fs from 'fs';
import { execSync } from 'child_process';

import { toPascalCase, isKebabCase } from './utils/naming.js';
import { RenameMapping, ImportUpdate, PathAliases, DEFAULT_ALIASES, findImportUpdates, applyImportUpdates } from './utils/imports.js';
import { countFileLines, getFileSize } from './utils/files.js';
import { FileStats, ReportData, generateHtmlReport, saveReport } from './utils/report.js';
import { loadViteAliases, findViteConfig, getProjectAliases } from './utils/vite-config.js';

// Re-export types
export type { RenameMapping, ImportUpdate, FileStats, ReportData, PathAliases };

// Re-export utilities
export { toPascalCase, isKebabCase } from './utils/naming.js';
export { findImportUpdates, applyImportUpdates, DEFAULT_ALIASES } from './utils/imports.js';
export { countFileLines, getFileSize, formatBytes } from './utils/files.js';
export { generateHtmlReport, saveReport } from './utils/report.js';
export { loadViteAliases, findViteConfig, getProjectAliases, findProjectRoot } from './utils/vite-config.js';

/**
 * Default file extensions to scan for imports
 */
export const DEFAULT_EXTENSIONS = ['ts', 'vue', 'tsx', 'js', 'jsx'];

/**
 * Default patterns to ignore when scanning
 */
export const DEFAULT_IGNORE = ['**/node_modules/**', '**/dist/**', '**/.git/**'];

/**
 * Options for finding kebab-case Vue files
 */
export interface FindFilesOptions {
	/** Directory to scan for Vue files */
	targetDir: string;
	/** Working directory (defaults to process.cwd()) */
	cwd?: string;
	/** Glob patterns to ignore */
	ignore?: string[];
}

/**
 * Options for renaming Vue files
 */
export interface RenameOptions {
	/** Directory to scan for Vue files */
	targetDir: string;
	/** Working directory (defaults to process.cwd()) */
	cwd?: string;
	/** Directory to scan for imports (defaults to targetDir) */
	importScanDir?: string;
	/** File extensions to scan for imports */
	extensions?: string[];
	/** Glob patterns to ignore */
	ignore?: string[];
	/** Preview changes without applying them */
	dryRun?: boolean;
	/** Use git mv to preserve history (defaults to true) */
	useGitMv?: boolean;
	/** 
	 * Path aliases for import resolution (e.g., { '@': 'src' })
	 * If not provided, will auto-detect from vite.config.ts/js
	 * Falls back to { '@': 'src', '~': 'src' }
	 */
	aliases?: PathAliases;
	/**
	 * Auto-detect aliases from vite.config.ts/js (defaults to true)
	 */
	autoDetectAliases?: boolean;
	/** Progress callback */
	onProgress?: (message: string, current?: number, total?: number) => void;
}

/**
 * Result of rename operation
 */
export interface RenameResult {
	/** Files that were/would be renamed */
	mappings: RenameMapping[];
	/** File statistics */
	fileStats: FileStats[];
	/** Import updates that were/would be applied */
	importUpdates: ImportUpdate[];
	/** Summary statistics */
	summary: {
		totalFiles: number;
		totalLines: number;
		totalSize: number;
		totalImports: number;
	};
	/** Whether this was a dry run */
	dryRun: boolean;
}

/**
 * Find all Vue files with kebab-case names in a directory
 */
export async function findKebabCaseFiles(options: FindFilesOptions): Promise<RenameMapping[]> {
	const { targetDir, cwd = process.cwd(), ignore = DEFAULT_IGNORE } = options;

	const absoluteTargetDir = path.resolve(cwd, targetDir);
	const vueFiles = await glob('**/*.vue', {
		cwd: absoluteTargetDir,
		absolute: true,
		ignore,
	});

	const mappings: RenameMapping[] = [];

	for (const filePath of vueFiles) {
		const fileName = path.basename(filePath);
		if (isKebabCase(fileName)) {
			const newName = toPascalCase(fileName);
			const newPath = path.join(path.dirname(filePath), newName);
			mappings.push({
				oldPath: filePath,
				newPath: newPath,
				oldName: fileName,
				newName: newName,
			});
		}
	}

	return mappings;
}

/**
 * Create rename mappings from a list of file paths
 */
export function createMappingsFromFiles(files: string[]): RenameMapping[] {
	const mappings: RenameMapping[] = [];

	for (const filePath of files) {
		if (!fs.existsSync(filePath)) continue;

		const fileName = path.basename(filePath);
		if (isKebabCase(fileName)) {
			const newName = toPascalCase(fileName);
			const newPath = path.join(path.dirname(filePath), newName);
			mappings.push({
				oldPath: filePath,
				newPath: newPath,
				oldName: fileName,
				newName: newName,
			});
		}
	}

	return mappings;
}

/**
 * Collect file statistics for mappings
 */
export function collectFileStats(mappings: RenameMapping[]): FileStats[] {
	return mappings.map((mapping) => ({
		oldPath: mapping.oldPath,
		newPath: mapping.newPath,
		oldName: mapping.oldName,
		newName: mapping.newName,
		lines: countFileLines(mapping.oldPath),
		size: getFileSize(mapping.oldPath),
	}));
}

/**
 * Load a ts-morph project with source files
 */
export async function loadProject(options: {
	/** Directory to scan */
	scanDir: string;
	/** File extensions to include */
	extensions?: string[];
	/** Patterns to ignore */
	ignore?: string[];
	/** Progress callback */
	onProgress?: (message: string, current?: number, total?: number) => void;
}): Promise<Project> {
	const { scanDir, extensions = DEFAULT_EXTENSIONS, ignore = DEFAULT_IGNORE, onProgress } = options;

	const project = new Project({
		skipAddingFilesFromTsConfig: true,
	});

	const sourceFiles = await glob(`**/*.{${extensions.join(',')}}`, {
		cwd: scanDir,
		absolute: true,
		ignore,
	});

	let count = 0;
	for (const file of sourceFiles) {
		try {
			project.addSourceFileAtPath(file);
			count++;
			if (onProgress && count % 500 === 0) {
				onProgress('Loading project files...', count, sourceFiles.length);
			}
		} catch {
			// Skip files that can't be parsed
		}
	}

	return project;
}

/**
 * Rename a single file using git mv or fs.rename
 */
export function renameFile(oldPath: string, newPath: string, useGitMv = true): void {
	if (useGitMv) {
		try {
			execSync(`git mv "${oldPath}" "${newPath}"`, { stdio: 'pipe' });
			return;
		} catch {
			// Fall back to fs.rename
		}
	}
	fs.renameSync(oldPath, newPath);
}

/**
 * Rename Vue files from kebab-case to PascalCase
 *
 * This is the main API function that:
 * 1. Finds all kebab-case Vue files in the target directory
 * 2. Loads the project and finds all imports referencing those files
 * 3. Updates all imports to use the new PascalCase names
 * 4. Renames the files (unless dryRun is true)
 */
export async function renameVueFiles(options: RenameOptions): Promise<RenameResult> {
	const {
		targetDir,
		cwd = process.cwd(),
		importScanDir,
		extensions = DEFAULT_EXTENSIONS,
		ignore = DEFAULT_IGNORE,
		dryRun = false,
		useGitMv = true,
		aliases: providedAliases,
		autoDetectAliases = true,
		onProgress,
	} = options;

	const absoluteTargetDir = path.resolve(cwd, targetDir);
	const absoluteScanDir = importScanDir ? path.resolve(cwd, importScanDir) : absoluteTargetDir;
	const projectRoot = cwd;

	// Determine aliases: use provided, auto-detect from vite.config, or fall back to defaults
	let aliases: PathAliases;
	if (providedAliases) {
		aliases = providedAliases;
	} else if (autoDetectAliases) {
		aliases = getProjectAliases(projectRoot, DEFAULT_ALIASES);
	} else {
		aliases = DEFAULT_ALIASES;
	}

	// Step 1: Find kebab-case Vue files
	onProgress?.('Scanning for Vue files...');
	const mappings = await findKebabCaseFiles({
		targetDir: absoluteTargetDir,
		cwd: '/',
		ignore,
	});

	if (mappings.length === 0) {
		return {
			mappings: [],
			fileStats: [],
			importUpdates: [],
			summary: { totalFiles: 0, totalLines: 0, totalSize: 0, totalImports: 0 },
			dryRun,
		};
	}

	// Step 2: Collect file statistics
	onProgress?.('Collecting file statistics...');
	const fileStats = collectFileStats(mappings);
	const totalLines = fileStats.reduce((sum, f) => sum + f.lines, 0);
	const totalSize = fileStats.reduce((sum, f) => sum + f.size, 0);

	// Step 3: Load project and find imports
	const project = await loadProject({
		scanDir: absoluteScanDir,
		extensions,
		ignore,
		onProgress,
	});

	onProgress?.('Finding import references...');
	const importUpdates = findImportUpdates(project, mappings, { aliases, projectRoot });

	// Step 4: Apply changes if not dry run
	if (!dryRun) {
		onProgress?.('Updating imports...');
		applyImportUpdates(project, importUpdates);
		await project.save();

		onProgress?.('Renaming files...');
		for (const mapping of mappings) {
			renameFile(mapping.oldPath, mapping.newPath, useGitMv);
		}
	}

	return {
		mappings,
		fileStats,
		importUpdates,
		summary: {
			totalFiles: mappings.length,
			totalLines,
			totalSize,
			totalImports: importUpdates.length,
		},
		dryRun,
	};
}

/**
 * Generate a report from rename results
 */
export function generateReport(
	result: RenameResult,
	options: {
		targetDir: string;
		outputDir?: string;
	},
): string {
	const reportData: ReportData = {
		timestamp: new Date(),
		targetDir: options.targetDir,
		files: result.fileStats,
		imports: result.importUpdates,
		totalFiles: result.summary.totalFiles,
		totalLines: result.summary.totalLines,
		totalSize: result.summary.totalSize,
		totalImports: result.summary.totalImports,
		dryRun: result.dryRun,
	};

	if (options.outputDir) {
		return saveReport(reportData, options.outputDir);
	}

	return generateHtmlReport(reportData);
}
