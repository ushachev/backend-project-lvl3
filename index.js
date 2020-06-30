import { join, resolve } from 'path';
import { createWriteStream, promises as fs } from 'fs';
import axios from 'axios';
import debug from 'debug';
import axiosDebugLog from 'axios-debug-log';
import urlRegex from 'url-regex';
import Listr from 'listr';
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

const loadAsset = ({ pathForLoad, pathForLocalSave }, output) => {
  const pathForWrite = join(output, pathForLocalSave);
  return axios.get(pathForLoad)
    .then((response) => {
      const contentType = response.headers['content-type'];
      const noop = { process: () => Promise.resolve() };
      const { process } = contentActions.find(({ check }) => check(contentType)) || noop;

      return process(response, pathForWrite);
    })
    .then(() => logAsset(`${pathForWrite} is written`));
};

const composeTasks = (url, output, options) => new Listr([
  {
    title: 'Loading page content',
    task: (ctx) => axios.get(url)
      .then(({ data }) => handleContent(data, url))
      .then(({ page, assets }) => {
        ctx.areThereSources = assets.sources.length !== 0;
        ctx.pageName = page.name;
        ctx.assets = assets;

        return fs.writeFile(join(output, page.name), page.body);
      })
      .then(() => logLoad(`Page body is written to ${join(output, ctx.pageName)}`))
      .catch(handleError),
  },
  {
    title: 'Loading page assets',
    enabled: (ctx) => ctx.areThereSources,
    task: (ctx) => fs.mkdir(join(output, ctx.assets.dir), { recursive: true })
      .then(() => logLoad(`Page assets directory ${join(output, ctx.assets.dir)} created`))
      .then(() => new Listr(ctx.assets.sources.map((source) => ({
        title: `${source.pathForLoad}`,
        task: () => loadAsset(source, output).catch((err) => handleError(err, source)),
      })), { concurrent: true, exitOnError: false })),
  },
], options);

export default (url, output = '', options = {}) => {
  const absOutput = resolve(process.cwd(), output);
  const { collapse, renderer } = { collapse: false, renderer: 'silent', ...options };

  logLoad(`Start loading ${url} to ${absOutput}`);

  return fs.access(absOutput)
    .then(() => {
      if (!urlRegex({ exact: true }).test(url)) {
        throw new Error(`URL '${url}' is invalid.`);
      }
    })
    .then(() => composeTasks(url, absOutput, { collapse, renderer }))
    .then((tasks) => tasks.run())
    .then(({ pageName }) => ({ pageName, failedAssets: [] }))
    .catch((err) => {
      if (!err.context || !err.context.pageName) {
        throw err;
      }
      const failedAssets = err.errors.map(({ message, source }) => ({ message, source }));

      return { pageName: err.context.pageName, failedAssets };
    });
};
