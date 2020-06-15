import { extname, join, resolve } from 'path';
import { createWriteStream, promises as fs } from 'fs';
import axios from 'axios';
import cheerio from 'cheerio';
import debug from 'debug';
import axiosDebugLog from 'axios-debug-log';
import errorHandler from './src/errorHandler.js';

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

const isLocalSource = (source) => {
  const isFile = source && extname(source).slice(1);
  const { href } = new URL(source, 'http://www');
  return isFile && (source !== href);
};

const tagsToHandle = [
  { tagName: 'script', attr: 'src' },
  { tagName: 'link', attr: 'href' },
  { tagName: 'img', attr: 'src' },
];

const handleContent = (content, url) => {
  const logContent = debug('page-loader: content');

  const { origin, hostname, pathname: pageRootDir } = new URL(url);
  const pageNameBase = `${hostname}${pageRootDir}`.replace(/\W/g, '-');
  const assets = { dir: `${pageNameBase}_files`, sources: [] };

  const $ = cheerio.load(content);

  tagsToHandle.forEach(({ tagName, attr }) => {
    const tagsWithLocalSource = $(tagName).filter((i, el) => {
      const attrValue = $(el).attr(attr);
      logContent(`<${tagName}> ${attr}='${attrValue}' found`);
      return isLocalSource(attrValue);
    });

    tagsWithLocalSource.each((i, el) => {
      const rootSourcePath = resolve(pageRootDir, $(el).attr(attr));
      const assetName = rootSourcePath.replace(/^\//, '').replace(/\//g, '-');
      const { href: pathForLoad } = new URL(rootSourcePath, origin);
      const pathForLocalSave = join(assets.dir, assetName);

      $(el).attr(attr, pathForLocalSave);
      assets.sources.push({ pathForLoad, pathForLocalSave });
      logContent(`${pathForLoad} added to locally hosted resource list`);
    });
  });

  const page = { name: `${pageNameBase}.html`, body: $.html() };

  return { page, assets };
};

const contentAction = [
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
      const { process } = contentAction.find(({ check }) => check(contentType)) || noop;

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
    .catch((err) => errorHandler(err));
};

export default loadPage;
