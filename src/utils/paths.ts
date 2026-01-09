import { findProjectRoot, findViteConfig } from './vite-config.js';

/**
 * Get the project root by finding vite.config up the directory tree
 * Falls back to cwd if not found
 */
export function getProjectRoot(startDir: string = process.cwd()): string {
	return findProjectRoot(startDir);
}

/**
 * Get the frontend directory (directory containing vite.config)
 */
export function getFrontendDir(startDir: string = process.cwd()): string {
	return findProjectRoot(startDir);
}

/**
 * Check if we found a valid project (has vite.config)
 */
export function hasViteConfig(startDir: string = process.cwd()): boolean {
	return findViteConfig(startDir) !== null;
}

/**
 * File extensions to scan for imports
 */
export const FILE_EXTENSIONS = ['ts', 'vue', 'tsx', 'js', 'jsx'];
