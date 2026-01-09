import * as path from 'path';

/**
 * Convert kebab-case filename to PascalCase
 * simple-card.vue -> SimpleCard.vue
 */
export function toPascalCase(kebabName: string): string {
	const ext = path.extname(kebabName);
	const baseName = path.basename(kebabName, ext);

	const pascalName = baseName
		.split('-')
		.map((word) => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
		.join('');

	return pascalName + ext;
}

/**
 * Check if filename is kebab-case (contains hyphens)
 */
export function isKebabCase(filename: string): boolean {
	const baseName = path.basename(filename, path.extname(filename));
	return /^[a-z][a-z0-9]*(-[a-z0-9]+)+$/.test(baseName);
}

