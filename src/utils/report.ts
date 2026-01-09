import * as fs from 'fs';
import * as path from 'path';
import { RenameMapping, ImportUpdate } from './imports.js';
import { findProjectRoot } from './vite-config.js';

export interface FileStats {
	oldPath: string;
	newPath: string;
	oldName: string;
	newName: string;
	lines: number;
	size: number;
}

export interface ReportData {
	timestamp: Date;
	targetDir: string;
	files: FileStats[];
	imports: ImportUpdate[];
	totalFiles: number;
	totalLines: number;
	totalSize: number;
	totalImports: number;
	dryRun: boolean;
}

/**
 * Generate HTML report with Tailwind CSS
 */
export function generateHtmlReport(data: ReportData, projectRoot?: string): string {
	const root = projectRoot ?? findProjectRoot(process.cwd());
	const formatDate = (date: Date) => date.toLocaleString();
	const formatBytes = (bytes: number) => {
		if (bytes === 0) return '0 B';
		const k = 1024;
		const sizes = ['B', 'KB', 'MB'];
		const i = Math.floor(Math.log(bytes) / Math.log(k));
		return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + ' ' + sizes[i];
	};

	const relativePath = (p: string) => path.relative(root, p);

	return `<!DOCTYPE html>
<html lang="en">
<head>
	<meta charset="UTF-8">
	<meta name="viewport" content="width=device-width, initial-scale=1.0">
	<title>Vue Component Rename Report</title>
	<script src="https://cdn.tailwindcss.com"></script>
	<style>
		@import url('https://fonts.googleapis.com/css2?family=JetBrains+Mono:wght@400;500;600&family=Inter:wght@400;500;600;700&display=swap');
		body { font-family: 'Inter', sans-serif; }
		code, .mono { font-family: 'JetBrains Mono', monospace; }
	</style>
</head>
<body class="bg-slate-950 text-slate-100 min-h-screen">
	<div class="max-w-6xl mx-auto px-6 py-12">
		<!-- Header -->
		<header class="mb-12">
			<div class="flex items-center gap-4 mb-4">
				<div class="w-12 h-12 bg-gradient-to-br from-emerald-400 to-cyan-500 rounded-xl flex items-center justify-center">
					<svg class="w-6 h-6 text-slate-950" fill="none" stroke="currentColor" viewBox="0 0 24 24">
						<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15"></path>
					</svg>
				</div>
				<div>
					<h1 class="text-3xl font-bold bg-gradient-to-r from-emerald-400 to-cyan-400 bg-clip-text text-transparent">
						Vue Component Rename Report
					</h1>
					<p class="text-slate-400">kebab-case → PascalCase</p>
				</div>
			</div>
			${data.dryRun ? '<div class="inline-flex items-center gap-2 px-4 py-2 bg-amber-500/20 border border-amber-500/30 rounded-lg text-amber-400"><svg class="w-4 h-4" fill="currentColor" viewBox="0 0 20 20"><path fill-rule="evenodd" d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z" clip-rule="evenodd"></path></svg><span class="font-medium">Dry Run Mode</span> - No changes were made</div>' : ''}
		</header>

		<!-- Stats Cards -->
		<div class="grid grid-cols-2 md:grid-cols-4 gap-4 mb-12">
			<div class="bg-slate-900/50 border border-slate-800 rounded-2xl p-6">
				<div class="text-3xl font-bold text-emerald-400 mb-1">${data.totalFiles}</div>
				<div class="text-slate-400 text-sm">Files Renamed</div>
			</div>
			<div class="bg-slate-900/50 border border-slate-800 rounded-2xl p-6">
				<div class="text-3xl font-bold text-cyan-400 mb-1">${data.totalLines.toLocaleString()}</div>
				<div class="text-slate-400 text-sm">Total Lines</div>
			</div>
			<div class="bg-slate-900/50 border border-slate-800 rounded-2xl p-6">
				<div class="text-3xl font-bold text-purple-400 mb-1">${data.totalImports}</div>
				<div class="text-slate-400 text-sm">Imports Updated</div>
			</div>
			<div class="bg-slate-900/50 border border-slate-800 rounded-2xl p-6">
				<div class="text-3xl font-bold text-pink-400 mb-1">${formatBytes(data.totalSize)}</div>
				<div class="text-slate-400 text-sm">Total Size</div>
			</div>
		</div>

		<!-- Meta Info -->
		<div class="bg-slate-900/30 border border-slate-800 rounded-xl p-4 mb-8 flex flex-wrap gap-6 text-sm">
			<div><span class="text-slate-500">Generated:</span> <span class="text-slate-300">${formatDate(data.timestamp)}</span></div>
			<div><span class="text-slate-500">Directory:</span> <code class="text-emerald-400">${data.targetDir}</code></div>
		</div>

		<!-- Renamed Files Table -->
		<section class="mb-12">
			<h2 class="text-xl font-semibold mb-4 flex items-center gap-2">
				<svg class="w-5 h-5 text-emerald-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
					<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"></path>
				</svg>
				Renamed Files
			</h2>
			<div class="bg-slate-900/50 border border-slate-800 rounded-xl overflow-hidden">
				<table class="w-full text-sm">
					<thead>
						<tr class="border-b border-slate-800 text-slate-400">
							<th class="text-left p-4 font-medium">#</th>
							<th class="text-left p-4 font-medium">Old Name</th>
							<th class="text-left p-4 font-medium">New Name</th>
							<th class="text-right p-4 font-medium">Lines</th>
							<th class="text-right p-4 font-medium">Size</th>
						</tr>
					</thead>
					<tbody>
						${data.files
							.map(
								(file, i) => `
						<tr class="border-b border-slate-800/50 hover:bg-slate-800/30 transition-colors">
							<td class="p-4 text-slate-500">${i + 1}</td>
							<td class="p-4">
								<code class="text-red-400/80 line-through">${file.oldName}</code>
								<div class="text-xs text-slate-600 mt-1 mono">${relativePath(file.oldPath).replace(file.oldName, '')}</div>
							</td>
							<td class="p-4">
								<code class="text-emerald-400">${file.newName}</code>
							</td>
							<td class="p-4 text-right text-slate-400 mono">${file.lines.toLocaleString()}</td>
							<td class="p-4 text-right text-slate-400 mono">${formatBytes(file.size)}</td>
						</tr>`,
							)
							.join('')}
					</tbody>
					<tfoot>
						<tr class="bg-slate-800/30 font-medium">
							<td class="p-4" colspan="3">Total</td>
							<td class="p-4 text-right text-cyan-400 mono">${data.totalLines.toLocaleString()}</td>
							<td class="p-4 text-right text-pink-400 mono">${formatBytes(data.totalSize)}</td>
						</tr>
					</tfoot>
				</table>
			</div>
		</section>

		<!-- Import Updates -->
		<section>
			<h2 class="text-xl font-semibold mb-4 flex items-center gap-2">
				<svg class="w-5 h-5 text-purple-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
					<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M13.828 10.172a4 4 0 00-5.656 0l-4 4a4 4 0 105.656 5.656l1.102-1.101m-.758-4.899a4 4 0 005.656 0l4-4a4 4 0 00-5.656-5.656l-1.1 1.1"></path>
				</svg>
				Import Updates
			</h2>
			<div class="bg-slate-900/50 border border-slate-800 rounded-xl overflow-hidden">
				<div class="max-h-96 overflow-y-auto">
					<table class="w-full text-sm">
						<thead class="sticky top-0 bg-slate-900">
							<tr class="border-b border-slate-800 text-slate-400">
								<th class="text-left p-4 font-medium">File</th>
								<th class="text-right p-4 font-medium">Line</th>
								<th class="text-left p-4 font-medium">Old Import</th>
								<th class="text-left p-4 font-medium">New Import</th>
							</tr>
						</thead>
						<tbody>
							${data.imports
								.map(
									(imp) => `
							<tr class="border-b border-slate-800/50 hover:bg-slate-800/30 transition-colors">
								<td class="p-4 text-slate-300 mono text-xs">${relativePath(imp.file)}</td>
								<td class="p-4 text-right text-slate-500 mono">${imp.line}</td>
								<td class="p-4"><code class="text-red-400/80 text-xs">${imp.oldImport}</code></td>
								<td class="p-4"><code class="text-emerald-400 text-xs">${imp.newImport}</code></td>
							</tr>`,
								)
								.join('')}
						</tbody>
					</table>
				</div>
			</div>
		</section>

		<!-- Footer -->
		<footer class="mt-12 pt-8 border-t border-slate-800 text-center text-slate-500 text-sm">
			<p>Generated by <span class="text-emerald-400">@smartcat/cli</span></p>
		</footer>
	</div>
</body>
</html>`;
}

/**
 * Save report to file
 */
export function saveReport(data: ReportData, outputDir?: string): string {
	const root = outputDir ?? findProjectRoot(process.cwd());
	const timestamp = data.timestamp.toISOString().replace(/[:.]/g, '-').slice(0, 19);
	const filename = `rename-report-${timestamp}.html`;
	const filePath = path.join(root, filename);

	const html = generateHtmlReport(data, root);
	fs.writeFileSync(filePath, html, 'utf-8');

	return filePath;
}

