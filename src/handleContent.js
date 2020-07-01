import { extname, join, resolve } from 'path';
import cheerio from 'cheerio';
import debug from 'debug';

const logContent = debug('page-loader:content');

const tagsToHandle = [
  { tagName: 'script', attr: 'src' },
  { tagName: 'link', attr: 'href' },
  { tagName: 'img', attr: 'src' },
];

const isLocalSource = (source, sameDomainRegexp) => {
  if (!source || !extname(source).slice(1)) return false;
  if (sameDomainRegexp.test(source)) return true;
  const { href } = new URL(source, 'http://www');
  return source !== href;
};

const getAssetName = (path) => path.replace(/^\//, '').replace(/\//g, '-');

const getSource = (attrValue, origin) => {
  const { origin: originOfSource, pathname } = new URL(attrValue, origin);
  return originOfSource !== origin
    ? (assetsDir) => ({
      pathForLoad: attrValue,
      pathForLocalSave: join(assetsDir, getAssetName(pathname)),
    })
    : (assetsDir, pageRootDir) => {
      const rootSourcePath = resolve(pageRootDir, attrValue);
      const { href: pathForLoad } = new URL(rootSourcePath, origin);
      return {
        pathForLoad,
        pathForLocalSave: join(assetsDir, getAssetName(rootSourcePath)),
      };
    };
};

export default (content, url) => {
  const $ = cheerio.load(content);

  const { origin, hostname, pathname: pageRootDir } = new URL(url);
  const sameDomainRegexp = new RegExp(`.*\\.${hostname}|^${hostname}`);
  const pageNameBase = `${hostname}${pageRootDir}`.replace(/\W/g, '-');
  const assetsDir = `${pageNameBase}_files`;
  const assetSources = tagsToHandle.flatMap(({ tagName, attr }) => $(tagName)
    .filter((i, el) => {
      const attrValue = $(el).attr(attr);
      logContent(`<${tagName}> ${attr}='${attrValue}' found`);
      return isLocalSource(attrValue, sameDomainRegexp);
    })
    .map((i, el) => {
      const source = getSource($(el).attr(attr), origin)(assetsDir, pageRootDir);
      $(el).attr(attr, source.pathForLocalSave);
      logContent(`${source.pathForLoad} added to locally hosted resource list`);

      return source;
    })
    .get());

  const page = { name: `${pageNameBase}.html`, body: $.html() };
  const assets = { dir: assetsDir, sources: assetSources };

  return { page, assets };
};
