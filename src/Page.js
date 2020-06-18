import { join, resolve } from 'path';
import { createWriteStream, promises as fs } from 'fs';
import axios from 'axios';
import debug from 'debug';
import axiosDebugLog from 'axios-debug-log';
import urlRegex from 'url-regex';
import handleContent from './handleContent.js';
import handleError from './handleError.js';

const logLoad = debug('page-loader: load');
const logAsset = debug('page-loader: assets');

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

export default class Page {
  constructor(url, output = '') {
    this.url = url;
    this.output = resolve(process.cwd(), output);
    this.handleError = handleError;
  }

  getPageContent() {
    logLoad(`Start loading ${this.url} to ${this.output}`);
    return fs.access(this.output)
      .then(() => {
        if (!urlRegex({ exact: true }).test(this.url)) {
          throw new Error(`page-loader: URL '${this.url}' is invalid.`);
        }
      })
      .then(() => axios.get(this.url))
      .then(({ data }) => { this.content = data; });
  }

  handleContent() {
    const { page, assets } = handleContent(this.content, this.url);
    this.name = page.name;
    this.body = page.body;
    this.assets = assets;
  }

  writeBody() {
    const pagePath = join(this.output, this.name);
    return fs.writeFile(pagePath, this.body)
      .then(() => logLoad(`Page body is written to ${pagePath}`));
  }

  makeAssetsDir() {
    const assetsPath = join(this.output, this.assets.dir);
    return fs.mkdir(assetsPath, { recursive: true })
      .then(() => logLoad(`Page assets directory ${assetsPath} created`));
  }

  loadAsset({ pathForLoad, pathForLocalSave }) {
    const pathForWrite = join(this.output, pathForLocalSave);
    return axios.get(pathForLoad)
      .then((response) => {
        const contentType = response.headers['content-type'];
        const noop = { process: () => Promise.resolve() };
        const { process } = contentActions.find(({ check }) => check(contentType)) || noop;

        return process(response, pathForWrite);
      })
      .then(() => logAsset(`${pathForWrite} is written`));
  }

  load() {
    return this.getPageContent()
      .then(() => this.handleContent())
      .then(() => {
        const pagePromises = [this.writeBody()];
        const { sources } = this.assets;
        if (sources.length) {
          pagePromises.push(this.makeAssetsDir()
            .then(() => sources.map(this.loadAsset.bind(this)))
            .then((promises) => Promise.allSettled(promises)));
        }
        return pagePromises;
      })
      .then((promises) => Promise.all(promises))
      .then(() => logLoad(`Loading ${this.url} done`))
      .catch((err) => this.handleError(err));
  }
}
