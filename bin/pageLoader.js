#!/usr/bin/env node

import commander from 'commander';
import loadPage from '../index.js';

const { program } = commander;

program
  .version('0.1.1')
  .description('Downloads a web page for local viewing.')
  .option('-o, --output [dir]', 'output directory (default: current directory)')
  .arguments('<url>')
  .action((url) => loadPage(url, program.output, { renderer: 'default' })
    .then(({ pageName, failedAssets }) => {
      const message = failedAssets.length === 0
        ? `Page was downloaded as '${pageName}'.`
        : `Page was downloaded as '${pageName}' with some failed asset downloads.`;
      console.log(message);
    })
    .catch((err) => {
      console.error(`page-loader: ${err.message}`);
      process.exit(1);
    }))
  .parse(process.argv);
