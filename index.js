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

  logLoad(`Start loading ${url} to ${outputPath}`);

  let pageName;

  return fs.access(outputPath)
    .then(() => axios.get(url))
    .then(({ data }) => {
      const { name, body, assets: { dir, sources } } = getPageData(data, url);
      pageName = name;

      const writeBodyPromise = fs.writeFile(join(outputPath, name), body)
        .then(() => logLoad(`Page body is written to ${join(outputPath, name)}`));
      const loadAssetsPromise = fs.mkdir(join(outputPath, dir), { recursive: true })
        .then(() => logLoad(`Page assets directory ${join(outputPath, dir)} created`))
        .then(() => {
          const tasks = sources.map((source) => mapSourceToTask(source, outputPath));
          return new Listr(tasks, { concurrent: true, exitOnError: false, renderer }).run();
        });

      return Promise.all([writeBodyPromise, loadAssetsPromise]);
    }).then(() => {
      logLoad(`Loading ${url} done`);
      return { pageName, failedAssets: [] };
    })
    .catch((e) => {
      if (!e.errors) handleError(e);
      return {
        pageName,
        failedAssets: e.errors.map(({ message, source }) => ({ message, source })),
      };
    });
};
