import { join, resolve } from 'path';
import { createWriteStream, promises as fs } from 'fs';
import axios from 'axios';
import debug from 'debug';
import axiosDebugLog from 'axios-debug-log';
import getPageData from './handleContent.js';
import handleError from './handleError.js';

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

export default (loadAssets) => (url, output = '') => {
  const outputPath = resolve(process.cwd(), output);

  logLoad(`Start loading ${url} to ${outputPath}`);

  return fs.access(outputPath)
    .then(() => axios.get(url))
    .then(({ data }) => {
      const { page, assets } = getPageData(data, url);
      const pagePath = join(outputPath, page.name);
      const assetsDirPath = join(outputPath, assets.dir);

      const writeBodyPromise = fs.writeFile(pagePath, page.body)
        .then(() => logLoad(`Page body is written to ${pagePath}`));
      const loadAssetsPromise = fs.mkdir(assetsDirPath, { recursive: true })
        .then(() => {
          logLoad(`Page assets directory ${assetsDirPath} created`);
          const tasks = assets.sources.map((source) => mapSourceToTask(source, outputPath));
          return loadAssets(tasks);
        });

      return Promise.all([page.name, loadAssetsPromise, writeBodyPromise]);
    })
    .then(([pageName, failedAssets]) => {
      logLoad(`Loading ${url} done`);
      return { pageName, failedAssets };
    })
    .catch(handleError);
};
