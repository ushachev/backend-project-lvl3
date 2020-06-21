#!/usr/bin/env node

import commander from 'commander';
import Listr from 'listr';
import Page from '../src/Page.js';

const { program } = commander;

program
  .version('0.1.0')
  .description('Downloads a web page for local viewing.')
  .option('-o, --output [dir]', 'output directory (default: current directory)')
  .arguments('<url>')
  .action((url) => {
    const page = new Page(url, program.output);

    const tasks = new Listr([
      {
        title: 'Loading page content',
        task: (ctx) => page.getPageContent()
          .then(() => page.handleContent())
          .then(() => page.writeBody())
          .then(() => {
            ctx.areThereSources = page.assets.sources.length !== 0;
            ctx.result = `Page was downloaded as '${page.name}'.`;
          })
          .catch((err) => page.handleError(err)),
      },
      {
        title: 'Loading page assets',
        enabled: (ctx) => ctx.areThereSources,
        task: () => page.makeAssetsDir()
          .then(() => new Listr(page.assets.sources.map((source) => ({
            title: `${source.pathForLoad}`,
            task: () => page.loadAsset(source).catch((err) => page.handleError(err)),
          })), { concurrent: true, exitOnError: false })),
      },
    ], { collapse: false });

    tasks.run()
      .then(({ result }) => console.log(result))
      .catch((err) => {
        if (err.context.result) {
          console.log(`${err.context.result} with some failed asset downloads.`);
          return 0;
        }
        console.error(`page-loader: ${err.message}`);
        return 1;
      })
      .then((exitCode) => process.exit(exitCode));
  })
  .parse(process.argv);
