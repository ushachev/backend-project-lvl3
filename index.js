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

const loadAssets = (assets, output, renderer) => {
  if (assets.sources.length === 0) return [];
  const assetsPath = join(output, assets.dir);
  const listrOptions = { concurrent: true, exitOnError: false, renderer };

  const mapSourceToTask = (source) => {
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

  return fs.mkdir(assetsPath, { recursive: true })
    .then(() => logLoad(`Page assets directory ${assetsPath} created`))
    .then(() => new Listr(assets.sources.map(mapSourceToTask), listrOptions))
    .then((tasks) => tasks.run())
    .then(() => [])
    .catch((e) => {
      if (!e.errors) { throw e; }
      return e.errors.map(({ message, source }) => ({ message, source }));
    });
};

export default (url, output = '', renderer = 'silent') => {
  const outputPath = resolve(process.cwd(), output);
  let pageData;

  logLoad(`Start loading ${url} to ${outputPath}`);

  return fs.access(outputPath)
    .then(() => axios.get(url))
    .then(({ data }) => { pageData = getPageData(data, url); })
    .then(() => fs.writeFile(join(outputPath, pageData.page.name), pageData.page.body))
    .then(() => logLoad(`Page body is written to ${join(outputPath, pageData.page.name)}`))
    .then(() => loadAssets(pageData.assets, outputPath, renderer))
    .then((failedAssets) => {
      logLoad(`Loading ${url} done`);
      return { pageName: pageData.page.name, failedAssets };
    })
    .catch(handleError);
};
