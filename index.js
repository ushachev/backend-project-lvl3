import { extname, join, resolve } from 'path';
import { createWriteStream, promises as fs } from 'fs';
import axios from 'axios';
import cheerio from 'cheerio';

const isLocalSource = (source) => {
  const isFile = source && extname(source).slice(1);
  const { href } = new URL(source, 'http://www');
  return isFile && (source !== href);
};

const tagsToHandle = [
  { tagName: 'script', attr: 'src' },
  { tagName: 'img', attr: 'src' },
  { tagName: 'link', attr: 'href' },
];

const handleContent = (content, url) => {
  const { origin, hostname, pathname: pageRootDir } = new URL(url);
  const pageNameBase = `${hostname}${pageRootDir}`.replace(/\W/g, '-');
  const assets = { dir: `${pageNameBase}_files`, sources: [] };

  const $ = cheerio.load(content);

  tagsToHandle.forEach(({ tagName, attr }) => {
    const tagsWithLocalSource = $(tagName).filter((i, el) => isLocalSource($(el).attr(attr)));

    tagsWithLocalSource.each((i, el) => {
      const rootSourcePath = resolve(pageRootDir, $(el).attr(attr));
      const assetName = rootSourcePath.replace(/^\//, '').replace(/\//g, '-');
      const { href: pathForLoad } = new URL(rootSourcePath, origin);
      const locallySavedPath = join(assets.dir, assetName);

      $(el).attr(attr, locallySavedPath);
      assets.sources.push({ pathForLoad, locallySavedPath });
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
    process: ({ config }, pathForWrite) => axios.get(config.url, { responseType: 'stream' })
      .then(({ data }) => data.pipe(createWriteStream(pathForWrite))),
  },
];

const getSourceLoader = (absOutput) => ({ pathForLoad, locallySavedPath }) => axios
  .get(pathForLoad)
  .then((response) => {
    const contentType = response.headers['content-type'];
    const noop = { process: () => null };
    const { process } = contentAction.find(({ check }) => check(contentType)) || noop;
    return process(response, join(absOutput, locallySavedPath));
  });

const loadPage = (url, output = '') => {
  const absOutput = resolve(process.cwd(), output);

  let pageName;

  return fs.access(absOutput)
    .then(() => axios.get(url))
    .then(({ data }) => handleContent(data, url))
    .then(({ page, assets }) => {
      pageName = page.name;
      const pagePromises = [fs.writeFile(join(absOutput, pageName), page.body)];

      const { dir, sources } = assets;
      if (sources.length) {
        const assetsPromise = fs.mkdir(join(absOutput, dir), { recursive: true })
          .then(() => sources.map(getSourceLoader(absOutput)))
          .then((promises) => Promise.all(promises));
        pagePromises.push(assetsPromise);
      }

      return Promise.all(pagePromises);
    })
    .then(() => `Page was downloaded as '${pageName}'`)
    .catch((e) => `Error: ${e}`);
};

export default loadPage;
