#!/usr/bin/env node

import commander from 'commander';
import Page from '../src/Page.js';

const { program } = commander;

program
  .version('0.0.1')
  .description('Downloads a web page for local viewing.')
  .option('-o, --output [dir]', 'output directory (default: current directory)')
  .arguments('<url>')
  .action((url) => {
    const page = new Page(url, program.output);
    page.load()
      .then(() => console.log(`Page was downloaded as '${page.name}'`))
      .catch((err) => console.error(err.message))
      .then(() => process.exit(1));
  })
  .parse(process.argv);
