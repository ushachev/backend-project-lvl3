import { extname, join, resolve } from 'path';
import cheerio from 'cheerio';
import debug from 'debug';

const logContent = debug('page-loader:content');

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

export default (content, url) => {
  const $ = cheerio.load(content);

  const { origin, hostname, pathname: pageRootDir } = new URL(url);
  const pageNameBase = `${hostname}${pageRootDir}`.replace(/\W/g, '-');
  const assetsDir = `${pageNameBase}_files`;
  const assetSources = tagsToHandle.flatMap(({ tagName, attr }) => $(tagName)
    .filter((i, el) => {
      const attrValue = $(el).attr(attr);
      logContent(`<${tagName}> ${attr}='${attrValue}' found`);
      return isLocalSource(attrValue);
    })
    .map((i, el) => {
      const rootSourcePath = resolve(pageRootDir, $(el).attr(attr));
      const assetName = rootSourcePath.replace(/^\//, '').replace(/\//g, '-');
      const pathForLocalSave = join(assetsDir, assetName);
      const { href: pathForLoad } = new URL(rootSourcePath, origin);

      $(el).attr(attr, pathForLocalSave);
      logContent(`${pathForLoad} added to locally hosted resource list`);

      return { pathForLoad, pathForLocalSave };
    })
    .get());

  const page = { name: `${pageNameBase}.html`, body: $.html() };
  const assets = { dir: assetsDir, sources: assetSources };

  return { page, assets };
};
