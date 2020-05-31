#!/usr/bin/env node

import commander from 'commander';
import loadPage from '../index.js';

const { program } = commander;

program
  .version('0.0.1')
  .description('Downloads a web page for local viewing.')
  .option('-o, --output [dir]', 'output directory (default: current directory)')
  .arguments('<url>')
  .action((url) => loadPage(url, program.output).then(console.log))
  .parse(process.argv);
