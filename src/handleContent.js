import { extname, join, resolve } from 'path';
import cheerio from 'cheerio';
import debug from 'debug';

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
