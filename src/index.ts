#!/usr/bin/env node

import { Command } from 'commander';
import chalk from 'chalk';

import { createRenameCommand } from './commands/rename.js';
import { createRenameDiffCommand } from './commands/rename-diff.js';

const program = new Command();

program.name('vpm').description(chalk.cyan('Vue PascalCase Migrator')).version('1.0.0');

// Add commands
program.addCommand(createRenameCommand());
program.addCommand(createRenameDiffCommand());

program.parse();

// Show help if no command provided
if (process.argv.length <= 2) {
	console.log('');
	console.log(chalk.bold.cyan('  🐱 Vue PascalCase Migrator'));
	console.log(chalk.gray('  ─'.repeat(25)));
	console.log('');
	program.outputHelp();
}

