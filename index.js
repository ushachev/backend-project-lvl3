import { join, resolve } from 'path';
import { createWriteStream, promises as fs } from 'fs';
import axios from 'axios';
import debug from 'debug';
import axiosDebugLog from 'axios-debug-log';
import urlRegex from 'url-regex';
import handleContent from './src/handleContent.js';
import handleError from './src/handleError.js';

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
    throw new Error(`page-loader: URL '${url}' is invalid.`);
  }
};

const contentActions = [
  {
    check: (contentType) => /javascript/.test(contentType) || /^text\/css/.test(contentType),
    process: ({ data }, pathForWrite) => fs.writeFile(pathForWrite, data),
  },
  {
    check: (contentType) => /^image/.test(contentType),
    process: ({ config }, pathForWrite) => axios
      .get(config.url, { responseType: 'stream' })
      .then(({ data }) => data.pipe(createWriteStream(pathForWrite))),
  },
];

const getSourceLoader = (absOutput) => ({ pathForLoad, pathForLocalSave }) => {
  const logAsset = debug('page-loader: assets');
  const pathForWrite = join(absOutput, pathForLocalSave);

  return axios.get(pathForLoad)
    .then((response) => {
      const contentType = response.headers['content-type'];
      const noop = { process: () => Promise.resolve() };
      const { process } = contentActions.find(({ check }) => check(contentType)) || noop;

      return process(response, pathForWrite);
    })
    .then(() => logAsset(`${pathForWrite} is written`));
};

const loadPage = (url, output = '') => {
  const logLoad = debug('page-loader: load');
  const absOutput = resolve(process.cwd(), output);

  logLoad(`Start loading ${url} to ${absOutput}`);

  let pageName;

  return fs.access(absOutput)
    .then(() => checkUrl(url))
    .then(() => axios.get(url))
    .then(({ data }) => handleContent(data, url))
    .then(({ page, assets }) => {
      pageName = page.name;
      const pagePath = join(absOutput, pageName);
      const pagePromises = [fs.writeFile(pagePath, page.body)
        .then(() => logLoad(`Page body is written to ${pagePath}`))];

      const { dir, sources } = assets;
      if (sources.length) {
        const assetsPath = join(absOutput, dir);
        pagePromises.push(fs.mkdir(assetsPath, { recursive: true })
          .then(() => logLoad(`Page assets directory ${assetsPath} created`))
          .then(() => sources.map(getSourceLoader(absOutput)))
          .then((promises) => Promise.allSettled(promises)));
      }

      return Promise.all(pagePromises).then(() => logLoad(`Loading ${url} done`));
    })
    .then(() => `Page was downloaded as '${pageName}'`)
    .catch((err) => handleError(err));
};

export default loadPage;
