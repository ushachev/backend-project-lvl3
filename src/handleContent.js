import { extname, join } from 'path';
import cheerio from 'cheerio';
import debug from 'debug';

const logContent = debug('page-loader:content');

const tagsToHandle = [
  { tagName: 'script', attr: 'src' },
  { tagName: 'link', attr: 'href' },
  { tagName: 'img', attr: 'src' },
];

export default (content, url) => {
  const $ = cheerio.load(content);

  const { hostname: pageHostname, pathname: pageRootDir } = new URL(url);
  const pageNameBase = `${pageHostname}${pageRootDir}`.replace(/\W/g, '-');
  const assetsDir = `${pageNameBase}_files`;

  const mapElementToSource = (el, tagName, attr) => {
    const attrValue = $(el).attr(attr);
    logContent(`<${tagName}> ${attr}='${attrValue}' found`);
    if (!attrValue || !extname(attrValue).slice(1)) return null;

    const { href: pathForLoad, hostname, pathname } = new URL(attrValue, `${url}/`);
    if (hostname !== pageHostname) return null;

    const assetName = pathname.replace(pageRootDir, '').replace(/^\//, '').replace(/\//g, '-');
    const pathForLocalSave = join(assetsDir, assetName);
    $(el).attr(attr, pathForLocalSave);

    logContent(`${pathForLoad} added to locally hosted resource list`);
    return { pathForLoad, pathForLocalSave };
  };

  const assetSources = tagsToHandle.flatMap(({ tagName, attr }) => $(tagName)
    .map((i, el) => mapElementToSource(el, tagName, attr))
    .get());

  return {
    page: { name: `${pageNameBase}.html`, body: $.html() },
    assets: { dir: assetsDir, sources: assetSources },
  };
};
