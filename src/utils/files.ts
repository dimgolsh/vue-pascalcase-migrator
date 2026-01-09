import * as fs from 'fs';

/**
 * Count lines in a file
 */
export function countFileLines(filePath: string): number {
	try {
		const content = fs.readFileSync(filePath, 'utf-8');
		return content.split('\n').length;
	} catch {
		return 0;
	}
}

/**
 * Get file size in bytes
 */
export function getFileSize(filePath: string): number {
	try {
		const stats = fs.statSync(filePath);
		return stats.size;
	} catch {
		return 0;
	}
}

/**
 * Format bytes to human readable
 */
export function formatBytes(bytes: number): string {
	if (bytes === 0) return '0 B';
	const k = 1024;
	const sizes = ['B', 'KB', 'MB'];
	const i = Math.floor(Math.log(bytes) / Math.log(k));
	return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + ' ' + sizes[i];
}

