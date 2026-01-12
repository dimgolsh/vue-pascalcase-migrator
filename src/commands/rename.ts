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
import { RenameMapping, ImportUpdate, DEFAULT_ALIASES, findImportUpdates, applyImportUpdates, updateImportsInRenamedFiles } from '../utils/imports.js';
import { countFileLines, getFileSize, formatBytes } from '../utils/files.js';
import { FileStats, ReportData, saveReport } from '../utils/report.js';
import { getProjectAliases, findViteConfig, findProjectRoot } from '../utils/vite-config.js';

/**
 * Find all .vue files with kebab-case names in target directory
 */
async function findKebabCaseFiles(absoluteTargetDir: string): Promise<RenameMapping[]> {
	const vueFiles = await glob('**/*.vue', {
		cwd: absoluteTargetDir,
		absolute: true,
		ignore: ['**/node_modules/**', '**/dist/**', '**/.git/**'],
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
function renameFiles(mappings: RenameMapping[], dryRun: boolean): void {
	for (const mapping of mappings) {
		const relativeOld = path.relative(process.cwd(), mapping.oldPath);
		const relativeNew = path.relative(process.cwd(), mapping.newPath);

		if (dryRun) {
			console.log(chalk.gray(`  ${relativeOld} ${chalk.yellow('→')} ${relativeNew}`));
		} else {
			try {
				execSync(`git mv "${mapping.oldPath}" "${mapping.newPath}"`, {
					stdio: 'pipe',
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

interface RenameOptions {
	dir: string;
	dryRun: boolean;
	report: boolean;
}

/**
 * Execute rename command
 */
async function executeRename(options: RenameOptions): Promise<void> {
	const { dir: targetDir, dryRun, report: generateReport } = options;

	// Find project root by looking for vite.config up the directory tree
	const absoluteTargetDir = path.resolve(process.cwd(), targetDir);
	const projectRoot = findProjectRoot(absoluteTargetDir);
	const frontendDir = projectRoot;

	console.log('');
	console.log(chalk.bold.cyan('🔍 Vue Component Rename Tool'));
	console.log(chalk.cyan('   kebab-case → PascalCase'));
	console.log(chalk.gray('═'.repeat(50)));
	console.log('');
	console.log(chalk.gray(`   Project root: ${projectRoot}`));
	console.log(chalk.gray(`   Target dir:   ${absoluteTargetDir}`));
	console.log('');

	if (dryRun) {
		console.log(chalk.yellow.bold('⚡ DRY RUN MODE - No changes will be made'));
		console.log('');
	}

	// Step 1: Find kebab-case Vue files
	const scanSpinner = ora({
		text: `Scanning ${chalk.white(targetDir)}...`,
		color: 'cyan',
	}).start();

	const mappings = await findKebabCaseFiles(absoluteTargetDir);

	if (mappings.length === 0) {
		scanSpinner.succeed(chalk.green('No kebab-case Vue files found. Nothing to rename.'));
		console.log('');
		return;
	}

	scanSpinner.succeed(`Found ${chalk.bold.green(mappings.length)} files to rename`);

	// Step 2: Collect file statistics
	const statsSpinner = ora({
		text: 'Collecting file statistics...',
		color: 'cyan',
	}).start();

	const fileStats = collectFileStats(mappings);
	const totalLines = fileStats.reduce((sum, f) => sum + f.lines, 0);
	const totalSize = fileStats.reduce((sum, f) => sum + f.size, 0);

	statsSpinner.succeed(
		`Collected stats: ${chalk.cyan(totalLines.toLocaleString())} lines, ${chalk.magenta(formatBytes(totalSize))}`,
	);

	// Print file list
	console.log('');
	console.log(chalk.white('Files to rename:'));
	for (const stat of fileStats) {
		console.log(
			chalk.gray(
				`  ${stat.oldName} ${chalk.yellow('→')} ${chalk.green(stat.newName)} ${chalk.dim(`(${stat.lines} lines)`)}`,
			),
		);
	}

	// Step 3: Initialize ts-morph project
	console.log('');
	const loadSpinner = ora({
		text: 'Loading project files...',
		color: 'cyan',
	}).start();

	const project = await loadProject(loadSpinner, frontendDir);
	loadSpinner.succeed(`Loaded ${chalk.gray(project.getSourceFiles().length)} source files`);

	// Step 4: Find all import updates
	const importSpinner = ora({
		text: 'Finding import references...',
		color: 'cyan',
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
		printImportUpdates(importUpdates, dryRun, frontendDir);
	}

	// Step 5: Apply changes
	if (!dryRun) {
		console.log('');
		const updateSpinner = ora({
			text: 'Updating imports...',
			color: 'green',
		}).start();

		applyImportUpdates(project, importUpdates);
		await project.save();
		updateSpinner.succeed('Imports updated in non-Vue files');

		console.log('');
		console.log(chalk.blue('📝 Renaming files...'));
		renameFiles(mappings, false);

		// Second pass: update imports in ALL files (including renamed .vue files)
		const secondPassSpinner = ora({
			text: 'Updating imports in renamed files...',
			color: 'green',
		}).start();

		const secondPassUpdates = await updateImportsInRenamedFiles(mappings, frontendDir);
		const additionalUpdates = secondPassUpdates.length;

		if (additionalUpdates > 0) {
			secondPassSpinner.succeed(`Updated imports in ${chalk.bold.green(additionalUpdates)} additional files`);
		} else {
			secondPassSpinner.succeed('No additional imports to update');
		}

		// Generate report
		if (generateReport) {
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
		console.log(chalk.bold.green('✅ Done! All files renamed and imports updated.'));

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
		renameFiles(mappings, true);

		// Generate dry-run report if requested
		if (generateReport) {
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

export function createRenameCommand(): Command {
	return new Command('rename')
		.description('Rename Vue component files from kebab-case to PascalCase')
		.requiredOption('-d, --dir <directory>', 'Target directory to scan for Vue files')
		.option('--dry-run', 'Preview changes without applying them', false)
		.option('-r, --report', 'Generate HTML report after renaming', false)
		.action(async (options) => {
			try {
				await executeRename(options);
			} catch (error) {
				console.error(chalk.red('Error:'), error);
				process.exit(1);
			}
		});
}

