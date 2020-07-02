import { join, resolve } from 'path';
import { createWriteStream, promises as fs } from 'fs';
import axios from 'axios';
import debug from 'debug';
import axiosDebugLog from 'axios-debug-log';
import urlRegex from 'url-regex';
import handleContent from './src/handleContent.js';
import handleError from './src/handleError.js';

const logLoad = debug('page-loader:load');
const logAsset = debug('page-loader:assets');

axiosDebugLog({
  request(logAxios, config) {
    logAxios(`Request to ${config.url}`);
  },
  response(logAxios, response) {
    logAxios(`Response with '${
      response.headers['content-type']
    }' 'content-type' header from ${response.config.url}`);
  },
  error(logAxios, error) {
    logAxios(`${error} when addressing '${error.config.url}'`);
  },
});

const checkUrl = (url) => {
  if (!urlRegex({ exact: true }).test(url)) {
    throw new Error(`URL '${url}' is invalid.`);
  }
};

const loadAssets = (assets, output) => {
  const assetsPath = join(output, assets.dir);
  return fs.mkdir(assetsPath, { recursive: true })
    .then(() => logLoad(`Page assets directory ${assetsPath} created`))
    .then(() => assets.sources.map((source) => {
      const { pathForLoad, pathForLocalSave } = source;
      const pathForWrite = join(output, pathForLocalSave);

      return axios.get(pathForLoad, { responseType: 'stream' })
        .then(({ data }) => data.pipe(createWriteStream(pathForWrite)))
        .then(() => logAsset(`${pathForWrite} is written`))
        .catch((err) => handleError(err, source));
    }))
    .then((promises) => Promise.allSettled(promises))
    .then((results) => results
      .filter(({ status }) => status === 'rejected')
      .map(({ reason }) => ({ message: reason.message, source: reason.source })));
};

export default (url, output = '') => {
  const outputPath = resolve(process.cwd(), output);
  let pageData;

  logLoad(`Start loading ${url} to ${outputPath}`);

  return fs.access(outputPath)
    .then(() => checkUrl(url))
    .then(() => axios.get(url))
    .then(({ data }) => handleContent(data, url))
    .then((content) => { pageData = content; })
    .then(() => fs.writeFile(join(outputPath, pageData.page.name), pageData.page.body))
    .then(() => logLoad(`Page body is written to ${join(outputPath, pageData.page.name)}`))
    .then(() => (pageData.assets.sources.length ? loadAssets(pageData.assets, outputPath) : []))
    .then((failedAssets) => {
      logLoad(`Loading ${url} done`);
      return { pageName: pageData.page.name, failedAssets };
    })
    .catch(handleError);
};
