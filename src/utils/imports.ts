import { Project } from 'ts-morph';
import * as path from 'path';

export interface RenameMapping {
	oldPath: string;
	newPath: string;
	oldName: string;
	newName: string;
}

export interface ImportUpdate {
	file: string;
	oldImport: string;
	newImport: string;
	line: number;
}

/**
 * Path alias configuration
 * Maps alias prefixes to their resolved paths
 */
export interface PathAliases {
	[alias: string]: string;
}

/**
 * Default aliases commonly used in Vue projects
 */
export const DEFAULT_ALIASES: PathAliases = {
	'@': 'src',
	'~': 'src',
};

/**
 * Resolve an alias import to an absolute path
 */
function resolveAliasImport(
	moduleSpecifier: string,
	aliases: PathAliases,
	projectRoot: string,
): string | null {
	for (const [alias, aliasPath] of Object.entries(aliases)) {
		const aliasPrefix = alias.endsWith('/') ? alias : alias + '/';
		if (moduleSpecifier.startsWith(aliasPrefix) || moduleSpecifier === alias) {
			const relativePath = moduleSpecifier.startsWith(aliasPrefix)
				? moduleSpecifier.slice(aliasPrefix.length)
				: '';
			return path.resolve(projectRoot, aliasPath, relativePath);
		}
	}
	return null;
}

/**
 * Check if an import matches a rename mapping
 */
function matchesImport(
	importingFile: string,
	moduleSpecifier: string,
	mapping: RenameMapping,
	aliases: PathAliases,
	projectRoot: string,
): boolean {
	// Check if the import ends with the old filename
	if (
		!moduleSpecifier.endsWith('/' + mapping.oldName) &&
		moduleSpecifier !== './' + mapping.oldName &&
		moduleSpecifier !== mapping.oldName
	) {
		return false;
	}

	// Try to resolve as alias import first
	const aliasResolved = resolveAliasImport(moduleSpecifier, aliases, projectRoot);
	if (aliasResolved) {
		return aliasResolved === mapping.oldPath;
	}

	// Fall back to relative path resolution
	if (moduleSpecifier.startsWith('.')) {
		const resolvedPath = path.resolve(path.dirname(importingFile), moduleSpecifier);
		return resolvedPath === mapping.oldPath;
	}

	return false;
}

/**
 * Replace old filename with new filename in import path
 */
function replaceImportPath(moduleSpecifier: string, oldName: string, newName: string): string {
	const lastIndex = moduleSpecifier.lastIndexOf(oldName);
	if (lastIndex !== -1) {
		return moduleSpecifier.substring(0, lastIndex) + newName + moduleSpecifier.substring(lastIndex + oldName.length);
	}
	return moduleSpecifier;
}

export interface FindImportUpdatesOptions {
	/** Path aliases (e.g., { '@': 'src' }) */
	aliases?: PathAliases;
	/** Project root directory for resolving aliases */
	projectRoot?: string;
}

/**
 * Find all import updates needed across the codebase
 */
export function findImportUpdates(
	project: Project,
	mappings: RenameMapping[],
	options: FindImportUpdatesOptions = {},
): ImportUpdate[] {
	const { aliases = DEFAULT_ALIASES, projectRoot = process.cwd() } = options;
	const updates: ImportUpdate[] = [];

	for (const sourceFile of project.getSourceFiles()) {
		const filePath = sourceFile.getFilePath();

		// Check static imports
		for (const importDecl of sourceFile.getImportDeclarations()) {
			const moduleSpecifier = importDecl.getModuleSpecifierValue();

			for (const mapping of mappings) {
				if (matchesImport(filePath, moduleSpecifier, mapping, aliases, projectRoot)) {
					const newModuleSpecifier = replaceImportPath(moduleSpecifier, mapping.oldName, mapping.newName);
					updates.push({
						file: filePath,
						oldImport: moduleSpecifier,
						newImport: newModuleSpecifier,
						line: importDecl.getStartLineNumber(),
					});
				}
			}
		}

		// Check dynamic imports: import('./component.vue')
		const callExpressions = sourceFile.getDescendantsOfKind(/* SyntaxKind.CallExpression */ 213);

		for (const callExpr of callExpressions) {
			const expression = callExpr.getExpression();
			if (expression.getText() === 'import') {
				const args = callExpr.getArguments();
				if (args.length > 0) {
					const arg = args[0];
					const argText = arg.getText();
					const moduleSpecifier = argText.slice(1, -1);

					for (const mapping of mappings) {
						if (matchesImport(filePath, moduleSpecifier, mapping, aliases, projectRoot)) {
							const newModuleSpecifier = replaceImportPath(moduleSpecifier, mapping.oldName, mapping.newName);
							updates.push({
								file: filePath,
								oldImport: moduleSpecifier,
								newImport: newModuleSpecifier,
								line: callExpr.getStartLineNumber(),
							});
						}
					}
				}
			}
		}

		// Check re-exports: export * from './component.vue'
		for (const exportDecl of sourceFile.getExportDeclarations()) {
			const moduleSpecifier = exportDecl.getModuleSpecifierValue();
			if (moduleSpecifier) {
				for (const mapping of mappings) {
					if (matchesImport(filePath, moduleSpecifier, mapping, aliases, projectRoot)) {
						const newModuleSpecifier = replaceImportPath(moduleSpecifier, mapping.oldName, mapping.newName);
						updates.push({
							file: filePath,
							oldImport: moduleSpecifier,
							newImport: newModuleSpecifier,
							line: exportDecl.getStartLineNumber(),
						});
					}
				}
			}
		}
	}

	return updates;
}

/**
 * Apply import updates to source files
 */
export function applyImportUpdates(project: Project, updates: ImportUpdate[]): void {
	const updatesByFile = new Map<string, ImportUpdate[]>();
	for (const update of updates) {
		const existing = updatesByFile.get(update.file) || [];
		existing.push(update);
		updatesByFile.set(update.file, existing);
	}

	for (const [filePath, fileUpdates] of updatesByFile) {
		const sourceFile = project.getSourceFile(filePath);
		if (!sourceFile) continue;

		// Apply updates to static imports
		for (const importDecl of sourceFile.getImportDeclarations()) {
			const moduleSpecifier = importDecl.getModuleSpecifierValue();
			const update = fileUpdates.find((u) => u.oldImport === moduleSpecifier);
			if (update) {
				importDecl.setModuleSpecifier(update.newImport);
			}
		}

		// Apply updates to dynamic imports
		const callExpressions = sourceFile.getDescendantsOfKind(213);
		for (const callExpr of callExpressions) {
			const expression = callExpr.getExpression();
			if (expression.getText() === 'import') {
				const args = callExpr.getArguments();
				if (args.length > 0) {
					const arg = args[0];
					const argText = arg.getText();
					const moduleSpecifier = argText.slice(1, -1);
					const update = fileUpdates.find((u) => u.oldImport === moduleSpecifier);
					if (update) {
						const quoteChar = argText[0];
						arg.replaceWithText(`${quoteChar}${update.newImport}${quoteChar}`);
					}
				}
			}
		}

		// Apply updates to re-exports
		for (const exportDecl of sourceFile.getExportDeclarations()) {
			const moduleSpecifier = exportDecl.getModuleSpecifierValue();
			if (moduleSpecifier) {
				const update = fileUpdates.find((u) => u.oldImport === moduleSpecifier);
				if (update) {
					exportDecl.setModuleSpecifier(update.newImport);
				}
			}
		}
	}
}
