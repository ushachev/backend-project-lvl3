import { join } from 'path';
import os from 'os';
import { createReadStream, promises as fs } from 'fs';
import nock from 'nock';
import cheerio from 'cheerio';
import debug from 'debug';
import loadPage from '../index.js';

const getFixturePath = (filename) => join('__fixtures__', filename);

const logNock = debug('nock');
const host = 'https://hexlet.io';
const pathName = '/courses';
const pageName = 'hexlet-io-courses.html';
const assetsDir = 'hexlet-io-courses_files';
const expectedAssetsNames = [
  'courses-styles-index.css',
  'courses-scripts-index.js',
  'courses-images-work7.jpeg',
];

let initialContent;
let expectedContent;
let scriptFile;
let styleFile;
let outputDir;

beforeAll(async () => {
  initialContent = await fs.readFile(getFixturePath('index.html'), 'utf-8');
  const content = await fs.readFile(getFixturePath('loaded.html'), 'utf-8');
  expectedContent = cheerio.load(content).html();
  scriptFile = await fs.readFile(getFixturePath('scripts/index.js'), 'utf-8');
  styleFile = await fs.readFile(getFixturePath('styles/index.css'), 'utf-8');
});

beforeEach(async () => {
  outputDir = await fs.mkdtemp(join(os.tmpdir(), 'page-loader-'));
});

test('load and write page', async () => {
  nock(host).log(logNock).get(pathName).reply(200, initialContent);
  nock(host).log(logNock).get(`${pathName}/scripts/index.js`)
    .reply(200, scriptFile, { 'content-type': 'application/javascript; charset=utf-8' });
  nock(host).log(logNock).get(`${pathName}/styles/index.css`)
    .reply(200, styleFile, { 'content-type': 'text/css; charset=utf-8' });
  const imagePath = getFixturePath('images/work7.jpeg');
  nock(host).log(logNock).get(`${pathName}/images/work7.jpeg`).twice()
    .reply(200, () => createReadStream(imagePath), { 'content-type': 'image/jpeg' });

  const msg = await loadPage(`${host}${pathName}`, outputDir);
  expect(msg).toBe(`Page was downloaded as '${pageName}'`);

  const actualContent = await fs.readFile(join(outputDir, pageName), 'utf-8');
  expect(actualContent).toBe(expectedContent);

  const loadedAssets = await fs.readdir(join(outputDir, assetsDir), { withFileTypes: true });
  const actualAssetsNames = loadedAssets.map(({ name }) => name);
  expect(actualAssetsNames.sort()).toEqual(expectedAssetsNames.sort());
});

test('must throw an error', async () => {
  nock(host).log(logNock).get(pathName).reply(404);

  await expect(loadPage(`${host}${pathName}`, outputDir))
    .rejects.toThrow('page-loader: HTTP Error 404.');
  await expect(loadPage('https;//www.google.com'))
    .rejects.toThrow('page-loader: HTTP Error 400.');
  await expect(loadPage('https://www.google.com', `${outputDir}/not/exist`))
    .rejects.toThrow('ENOENT:');
});
