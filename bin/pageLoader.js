#!/usr/bin/env node

import commander from 'commander';
import getPageLoader from '../src/loadPage.js';
import { loadAssetsInVisualMode } from '../src/loadAssets.js';

const { program } = commander;
const loadPage = getPageLoader(loadAssetsInVisualMode);

program
  .version('0.2.0')
  .description('Downloads a web page for local viewing.')
  .option('-o, --output [dir]', 'output directory (default: current directory)')
  .arguments('<url>')
  .action((url) => loadPage(url, program.output)
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
