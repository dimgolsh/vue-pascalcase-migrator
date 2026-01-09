import { Command } from 'commander';
import { Project } from 'ts-morph';
import { glob } from 'glob';
import * as path from 'path';
import * as fs from 'fs';
import { execSync } from 'child_process';
import chalk from 'chalk';
import ora, { type Ora } from 'ora';

import { FILE_EXTENSIONS } from '../utils/paths.js';
import { toPascalCase, isKebabCase } from '../utils/naming.js';
import { RenameMapping, ImportUpdate, DEFAULT_ALIASES, findImportUpdates, applyImportUpdates } from '../utils/imports.js';
import { countFileLines, getFileSize, formatBytes } from '../utils/files.js';
import { FileStats, ReportData, saveReport } from '../utils/report.js';
import { getProjectAliases, findViteConfig, findProjectRoot } from '../utils/vite-config.js';

/**
 * Get list of changed .vue files from git diff
 */
function getGitDiffFiles(baseBranch: string, projectRoot: string): string[] {
	try {
		const output = execSync(`git diff --name-only ${baseBranch}...HEAD`, {
			cwd: projectRoot,
			encoding: 'utf-8',
			stdio: ['pipe', 'pipe', 'pipe'],
		});

		return output
			.split('\n')
			.filter((file) => file.endsWith('.vue'))
			.map((file) => path.resolve(projectRoot, file));
	} catch {
		try {
			const output = execSync('git diff --name-only HEAD', {
				cwd: projectRoot,
				encoding: 'utf-8',
				stdio: ['pipe', 'pipe', 'pipe'],
			});

			return output
				.split('\n')
				.filter((file) => file.endsWith('.vue'))
				.map((file) => path.resolve(projectRoot, file));
		} catch {
			return [];
		}
	}
}

/**
 * Get list of staged files
 */
function getStagedFiles(projectRoot: string): string[] {
	try {
		const output = execSync('git diff --name-only --cached', {
			cwd: projectRoot,
			encoding: 'utf-8',
			stdio: ['pipe', 'pipe', 'pipe'],
		});

		return output
			.split('\n')
			.filter((file) => file.endsWith('.vue'))
			.map((file) => path.resolve(projectRoot, file));
	} catch {
		return [];
	}
}

/**
 * Get list of untracked files
 */
function getUntrackedFiles(projectRoot: string): string[] {
	try {
		const output = execSync('git ls-files --others --exclude-standard', {
			cwd: projectRoot,
			encoding: 'utf-8',
			stdio: ['pipe', 'pipe', 'pipe'],
		});

		return output
			.split('\n')
			.filter((file) => file.endsWith('.vue'))
			.map((file) => path.resolve(projectRoot, file));
	} catch {
		return [];
	}
}

/**
 * Filter files to kebab-case and create mappings
 */
function createMappingsFromFiles(files: string[]): RenameMapping[] {
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
function collectFileStats(mappings: RenameMapping[]): FileStats[] {
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
 * Rename files using git mv
 */
function renameFiles(mappings: RenameMapping[], dryRun: boolean, projectRoot: string): void {
	for (const mapping of mappings) {
		const relativeOld = path.relative(projectRoot, mapping.oldPath);
		const relativeNew = path.relative(projectRoot, mapping.newPath);

		if (dryRun) {
			console.log(chalk.gray(`  ${relativeOld} ${chalk.yellow('→')} ${relativeNew}`));
		} else {
			try {
				execSync(`git mv "${mapping.oldPath}" "${mapping.newPath}"`, {
					stdio: 'pipe',
					cwd: projectRoot,
				});
				console.log(chalk.green(`  ✓ ${relativeOld} → ${relativeNew}`));
			} catch {
				console.warn(chalk.yellow(`  ⚠ git mv failed, using fs.rename: ${relativeOld}`));
				fs.renameSync(mapping.oldPath, mapping.newPath);
				console.log(chalk.green(`  ✓ ${relativeOld} → ${relativeNew}`));
			}
		}
	}
}

/**
 * Load ts-morph project with all frontend source files
 */
async function loadProject(spinner: Ora, frontendDir: string): Promise<Project> {
	const project = new Project({
		skipAddingFilesFromTsConfig: true,
	});

	const sourceFiles = await glob(`**/*.{${FILE_EXTENSIONS.join(',')}}`, {
		cwd: frontendDir,
		absolute: true,
		ignore: ['**/node_modules/**', '**/dist/**', '**/.git/**'],
	});

	let count = 0;
	for (const file of sourceFiles) {
		try {
			project.addSourceFileAtPath(file);
			count++;
			if (count % 500 === 0) {
				spinner.text = `Loading project files... ${chalk.gray(`(${count}/${sourceFiles.length})`)}`;
			}
		} catch {
			// Skip files that can't be parsed
		}
	}

	return project;
}

/**
 * Print import updates
 */
function printImportUpdates(updates: ImportUpdate[], dryRun: boolean, frontendDir: string, limit: number = 20): void {
	const displayUpdates = updates.slice(0, limit);
	for (const update of displayUpdates) {
		const relPath = path.relative(frontendDir, update.file);
		if (dryRun) {
			console.log(chalk.gray(`  ${relPath}:${update.line}`));
			console.log(chalk.gray(`    ${update.oldImport} ${chalk.yellow('→')} ${update.newImport}`));
		} else {
			console.log(chalk.green(`  ✓ ${relPath}:${update.line}`));
		}
	}
	if (updates.length > limit) {
		console.log(chalk.gray(`  ... and ${updates.length - limit} more`));
	}
}

interface DiffOptions {
	branch?: string;
	staged?: boolean;
	untracked?: boolean;
	dryRun?: boolean;
	report?: boolean;
}

/**
 * Execute rename:diff command
 */
async function executeRenameDiff(options: DiffOptions): Promise<void> {
	// Find project root by looking for vite.config up the directory tree
	const projectRoot = findProjectRoot(process.cwd());
	const frontendDir = projectRoot;

	console.log('');
	console.log(chalk.bold.magenta('🔀 Vue Component Rename (Git Diff)'));
	console.log(chalk.magenta('   Rename only changed files'));
	console.log(chalk.gray('═'.repeat(50)));
	console.log('');
	console.log(chalk.gray(`   Project root: ${projectRoot}`));
	console.log('');

	if (options.dryRun) {
		console.log(chalk.yellow.bold('⚡ DRY RUN MODE - No changes will be made'));
		console.log('');
	}

	// Collect files based on options
	const diffSpinner = ora({
		text: 'Collecting files from git...',
		color: 'magenta',
	}).start();

	let files: string[] = [];
	const sources: string[] = [];

	if (options.staged) {
		const stagedFiles = getStagedFiles(projectRoot);
		files = [...files, ...stagedFiles];
		sources.push(`staged (${stagedFiles.length})`);
	}

	if (options.untracked) {
		const untrackedFiles = getUntrackedFiles(projectRoot);
		files = [...files, ...untrackedFiles];
		sources.push(`untracked (${untrackedFiles.length})`);
	}

	if (options.branch) {
		const diffFiles = getGitDiffFiles(options.branch, projectRoot);
		files = [...files, ...diffFiles];
		sources.push(`diff vs ${options.branch} (${diffFiles.length})`);
	}

	// Default: get all changes if no specific option
	if (!options.staged && !options.untracked && !options.branch) {
		const diffFiles = getGitDiffFiles('main', projectRoot);
		files = [...files, ...diffFiles];
		sources.push(`diff vs main (${diffFiles.length})`);
	}

	// Remove duplicates
	files = [...new Set(files)];

	diffSpinner.succeed(`Sources: ${chalk.white(sources.join(', '))}`);
	console.log(chalk.gray(`   Found ${files.length} .vue files in diff`));

	// Create mappings from diff files
	const mappings = createMappingsFromFiles(files);

	if (mappings.length === 0) {
		console.log('');
		console.log(chalk.green('✅ No kebab-case Vue files found in diff. Nothing to rename.'));
		console.log('');
		return;
	}

	// Collect file statistics
	const statsSpinner = ora({
		text: 'Collecting file statistics...',
		color: 'magenta',
	}).start();

	const fileStats = collectFileStats(mappings);
	const totalLines = fileStats.reduce((sum, f) => sum + f.lines, 0);
	const totalSize = fileStats.reduce((sum, f) => sum + f.size, 0);

	statsSpinner.succeed(
		`Found ${chalk.bold.green(mappings.length)} files: ${chalk.cyan(totalLines.toLocaleString())} lines, ${chalk.magenta(formatBytes(totalSize))}`,
	);

	// Print file list
	console.log('');
	console.log(chalk.white('Files to rename:'));
	for (const stat of fileStats) {
		const relPath = path.relative(projectRoot, stat.oldPath);
		console.log(chalk.gray(`  ${relPath}`));
		console.log(
			chalk.gray(
				`    ${stat.oldName} ${chalk.yellow('→')} ${chalk.green(stat.newName)} ${chalk.dim(`(${stat.lines} lines)`)}`,
			),
		);
	}

	// Load project and find imports
	console.log('');
	const loadSpinner = ora({
		text: 'Loading project files...',
		color: 'magenta',
	}).start();

	const project = await loadProject(loadSpinner, frontendDir);
	loadSpinner.succeed(`Loaded ${chalk.gray(project.getSourceFiles().length)} source files`);

	const importSpinner = ora({
		text: 'Finding import references...',
		color: 'magenta',
	}).start();

	// Load aliases from vite.config if available
	const aliases = getProjectAliases(projectRoot, DEFAULT_ALIASES);
	const viteConfigPath = findViteConfig(projectRoot);

	const importUpdates = findImportUpdates(project, mappings, { projectRoot, aliases });

	if (viteConfigPath) {
		const aliasKeys = Object.keys(aliases).join(', ');
		importSpinner.succeed(`Found ${chalk.bold.magenta(importUpdates.length)} imports to update ${chalk.gray(`(aliases: ${aliasKeys})`)}`);
	} else {
		importSpinner.succeed(`Found ${chalk.bold.magenta(importUpdates.length)} imports to update`);
	}

	if (importUpdates.length > 0) {
		console.log('');
		printImportUpdates(importUpdates, options.dryRun ?? false, frontendDir);
	}

	// Determine target dir for report
	const targetDir = sources.join(', ');

	// Apply changes
	if (!options.dryRun) {
		console.log('');
		const updateSpinner = ora({
			text: 'Updating imports...',
			color: 'green',
		}).start();

		applyImportUpdates(project, importUpdates);
		await project.save();
		updateSpinner.succeed('Imports updated');

		console.log('');
		console.log(chalk.blue('📝 Renaming files...'));
		renameFiles(mappings, false, projectRoot);

		// Generate report
		if (options.report) {
			console.log('');
			const reportSpinner = ora({
				text: 'Generating HTML report...',
				color: 'magenta',
			}).start();

			const reportData: ReportData = {
				timestamp: new Date(),
				targetDir,
				files: fileStats,
				imports: importUpdates,
				totalFiles: mappings.length,
				totalLines,
				totalSize,
				totalImports: importUpdates.length,
				dryRun: false,
			};

			const reportPath = saveReport(reportData);
			const relReportPath = path.relative(process.cwd(), reportPath);
			reportSpinner.succeed(`Report saved: ${chalk.cyan(relReportPath)}`);
		}

		console.log('');
		console.log(chalk.bold.green('✅ Done! Changed files renamed and imports updated.'));

		// Summary
		console.log('');
		console.log(chalk.gray('─'.repeat(50)));
		console.log(
			chalk.white(
				`   📁 ${chalk.green(mappings.length)} files renamed | ` +
					`📝 ${chalk.cyan(totalLines.toLocaleString())} lines | ` +
					`🔗 ${chalk.magenta(importUpdates.length)} imports`,
			),
		);
		console.log(chalk.gray('─'.repeat(50)));
	} else {
		console.log('');
		console.log(chalk.blue('📝 Files to rename:'));
		renameFiles(mappings, true, projectRoot);

		// Generate dry-run report if requested
		if (options.report) {
			console.log('');
			const reportSpinner = ora({
				text: 'Generating HTML report (preview)...',
				color: 'magenta',
			}).start();

			const reportData: ReportData = {
				timestamp: new Date(),
				targetDir,
				files: fileStats,
				imports: importUpdates,
				totalFiles: mappings.length,
				totalLines,
				totalSize,
				totalImports: importUpdates.length,
				dryRun: true,
			};

			const reportPath = saveReport(reportData);
			const relReportPath = path.relative(process.cwd(), reportPath);
			reportSpinner.succeed(`Preview report saved: ${chalk.cyan(relReportPath)}`);
		}

		console.log('');
		console.log(chalk.gray('─'.repeat(50)));
		console.log(
			chalk.white(
				`   📁 ${chalk.green(mappings.length)} files | ` +
					`📝 ${chalk.cyan(totalLines.toLocaleString())} lines | ` +
					`🔗 ${chalk.magenta(importUpdates.length)} imports`,
			),
		);
		console.log(chalk.gray('─'.repeat(50)));
		console.log('');
		console.log(chalk.yellow('💡 Run without --dry-run to apply changes.'));
	}
	console.log('');
}

export function createRenameDiffCommand(): Command {
	return new Command('rename:diff')
		.description('Rename Vue files from git diff (kebab-case to PascalCase)')
		.option('-b, --branch <branch>', 'Compare against branch (default: main)', 'main')
		.option('-s, --staged', 'Include only staged files', false)
		.option('-u, --untracked', 'Include untracked files', false)
		.option('--dry-run', 'Preview changes without applying them', false)
		.option('-r, --report', 'Generate HTML report after renaming', false)
		.action(async (options) => {
			try {
				await executeRenameDiff(options);
			} catch (error) {
				console.error(chalk.red('Error:'), error);
				process.exit(1);
			}
		});
}

