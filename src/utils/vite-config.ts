import * as fs from 'fs';
import * as path from 'path';
import { PathAliases } from './imports.js';

/**
 * Vite config file names to search for
 */
const VITE_CONFIG_NAMES = [
	'vite.config.ts',
	'vite.config.js',
	'vite.config.mts',
	'vite.config.mjs',
];

/**
 * Find vite.config file in a specific directory (non-recursive)
 */
function findViteConfigInDir(dir: string): string | null {
	for (const name of VITE_CONFIG_NAMES) {
		const configPath = path.join(dir, name);
		if (fs.existsSync(configPath)) {
			return configPath;
		}
	}
	return null;
}

/**
 * Find vite.config file by searching up the directory tree
 * Starts from startDir and walks up until it finds vite.config or reaches root
 */
export function findViteConfig(startDir: string): string | null {
	let currentDir = path.resolve(startDir);
	const root = path.parse(currentDir).root;

	while (currentDir !== root) {
		const configPath = findViteConfigInDir(currentDir);
		if (configPath) {
			return configPath;
		}
		currentDir = path.dirname(currentDir);
	}

	// Check root as well
	return findViteConfigInDir(root);
}

/**
 * Find project root by locating vite.config file
 * Returns the directory containing vite.config, or startDir if not found
 */
export function findProjectRoot(startDir: string): string {
	const configPath = findViteConfig(startDir);
	if (configPath) {
		return path.dirname(configPath);
	}
	// Fallback to start directory if no vite.config found
	return path.resolve(startDir);
}

/**
 * Parse aliases from vite.config file content
 * Supports common patterns:
 * - resolve.alias: { '@': path.resolve(...) }
 * - resolve.alias: [{ find: '@', replacement: '...' }]
 */
export function parseAliasesFromConfig(configContent: string, projectRoot: string): PathAliases {
	const aliases: PathAliases = {};

	// Pattern 1: Object style - '@': path.resolve(__dirname, 'src')
	// Match: '@': path.resolve(__dirname, 'src') or '@': resolve(__dirname, 'src')
	const objectPattern = /['"](@|~|@\w+)['"]\s*:\s*(?:path\.)?resolve\s*\(\s*(?:__dirname|import\.meta\.dirname)\s*,\s*['"]([^'"]+)['"]\s*\)/g;
	let match;

	while ((match = objectPattern.exec(configContent)) !== null) {
		const alias = match[1];
		const relativePath = match[2];
		aliases[alias] = relativePath;
	}

	// Pattern 2: Simple string value - '@': './src'
	const simplePattern = /['"](@|~|@\w+)['"]\s*:\s*['"]\.?\/?(src[^'"]*)['"]/g;

	while ((match = simplePattern.exec(configContent)) !== null) {
		const alias = match[1];
		const relativePath = match[2];
		if (!aliases[alias]) {
			aliases[alias] = relativePath;
		}
	}

	// Pattern 3: Array style - { find: '@', replacement: path.resolve(...) }
	const arrayPattern = /find\s*:\s*['"](@|~|@\w+)['"]\s*,\s*replacement\s*:\s*(?:path\.)?resolve\s*\(\s*(?:__dirname|import\.meta\.dirname)\s*,\s*['"]([^'"]+)['"]\s*\)/g;

	while ((match = arrayPattern.exec(configContent)) !== null) {
		const alias = match[1];
		const relativePath = match[2];
		if (!aliases[alias]) {
			aliases[alias] = relativePath;
		}
	}

	// Pattern 4: fileURLToPath pattern - '@': fileURLToPath(new URL('./src', import.meta.url))
	const fileUrlPattern = /['"](@|~|@\w+)['"]\s*:\s*fileURLToPath\s*\(\s*new\s+URL\s*\(\s*['"]\.?\/?(src[^'"]*)['"]/g;

	while ((match = fileUrlPattern.exec(configContent)) !== null) {
		const alias = match[1];
		const relativePath = match[2];
		if (!aliases[alias]) {
			aliases[alias] = relativePath;
		}
	}

	return aliases;
}

/**
 * Load aliases from vite.config file
 */
export function loadViteAliases(projectRoot: string): PathAliases | null {
	const configPath = findViteConfig(projectRoot);
	if (!configPath) {
		return null;
	}

	try {
		const content = fs.readFileSync(configPath, 'utf-8');
		const aliases = parseAliasesFromConfig(content, projectRoot);

		// Return null if no aliases found
		if (Object.keys(aliases).length === 0) {
			return null;
		}

		return aliases;
	} catch {
		return null;
	}
}

/**
 * Get aliases - try vite.config first, fall back to defaults
 */
export function getProjectAliases(projectRoot: string, defaultAliases: PathAliases): PathAliases {
	const viteAliases = loadViteAliases(projectRoot);
	if (viteAliases) {
		// Merge with defaults, vite config takes precedence
		return { ...defaultAliases, ...viteAliases };
	}
	return defaultAliases;
}
