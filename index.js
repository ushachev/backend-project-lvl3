import { join, resolve } from 'path';
import { createWriteStream, promises as fs } from 'fs';
import axios from 'axios';
import debug from 'debug';
import axiosDebugLog from 'axios-debug-log';
import Listr from 'listr';
import getPageData from './src/handleContent.js';
import handleError from './src/handleError.js';

const logLoad = debug('page-loader:load');
const logAsset = debug('page-loader:assets');

axiosDebugLog({
  request(logAxios, config) {
    logAxios(`Request to ${config.url}`);
  },
  response(logAxios, response) {
    logAxios(`Response from ${response.config.url}`);
  },
  error(logAxios, error) {
    logAxios(`${error} when addressing '${error.config.url}'`);
  },
});

const mapSourceToTask = (source, output) => {
  const { pathForLoad, pathForLocalSave } = source;
  const pathForWrite = join(output, pathForLocalSave);

  return {
    title: `${pathForLoad}`,
    task: () => axios.get(pathForLoad, { responseType: 'stream' })
      .then(({ data }) => data.pipe(createWriteStream(pathForWrite)))
      .then(() => logAsset(`${pathForWrite} is written`))
      .catch((err) => handleError(err, source)),
  };
};

export default (url, output = '', renderer = 'silent') => {
  const outputPath = resolve(process.cwd(), output);
  const listrOptions = { concurrent: true, exitOnError: false, renderer };

  logLoad(`Start loading ${url} to ${outputPath}`);

  let pageName;

  return fs.access(outputPath)
    .then(() => axios.get(url))
    .then(({ data }) => getPageData(data, url))
    .then(({ page, assets }) => fs.writeFile(join(outputPath, page.name), page.body)
      .then(() => { pageName = page.name; })
      .then(() => logLoad(`Page body is written to ${join(outputPath, pageName)}`))
      .then(() => assets))
    .then(({ dir, sources }) => fs.mkdir(join(outputPath, dir), { recursive: true })
      .then(() => logLoad(`Page assets directory ${join(outputPath, dir)} created`))
      .then(() => sources.map((source) => mapSourceToTask(source, outputPath))))
    .then((sourceLoadingTasks) => new Listr(sourceLoadingTasks, listrOptions).run())
    .then(() => logLoad(`Loading ${url} done`))
    .then(() => ({ pageName, failedAssets: [] }))
    .catch((e) => {
      if (!e.errors) handleError(e);
      return {
        pageName,
        failedAssets: e.errors.map(({ message, source }) => ({ message, source })),
      };
    });
};
