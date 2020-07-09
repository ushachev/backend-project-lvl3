import { join } from 'path';
import os from 'os';
import { createReadStream, promises as fs } from 'fs';
import nock from 'nock';
import cheerio from 'cheerio';
import loadPage from '../index.js';

const getFixturePath = (filename) => join('__fixtures__', filename);

const host = 'https://hexlet.io';
const pathName = '/courses';
const pageName = 'hexlet-io-courses.html';
const assetsDir = 'hexlet-io-courses_files';
const expectedAssetsNames = [
  'styles-index.css',
  'scripts-index.js',
  'images-work7.jpeg',
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
  nock(host).get(pathName).reply(200, initialContent);
  nock(host).get(`${pathName}/scripts/index.js`).reply(200, scriptFile);
  nock(host).get(`${pathName}/styles/index.css`).reply(200, styleFile);
  nock(host).get(`${pathName}/images/work7.jpeg`)
    .reply(200, () => createReadStream(getFixturePath('images/work7.jpeg')));

  const { pageName: actualPageName } = await loadPage(`${host}${pathName}`, outputDir);
  expect(actualPageName).toBe(pageName);

  const actualContent = await fs.readFile(join(outputDir, pageName), 'utf-8');
  expect(actualContent).toBe(expectedContent);

  const loadedAssets = await fs.readdir(join(outputDir, assetsDir), { withFileTypes: true });
  const actualAssetsNames = loadedAssets.map(({ name }) => name);
  expect(actualAssetsNames.sort()).toEqual(expectedAssetsNames.sort());
});

test('must throw an error', async () => {
  nock(host).get(pathName).reply(404);

  await expect(loadPage(`${host}${pathName}`, outputDir))
    .rejects.toThrow('HTTP Error 404.');
  await expect(loadPage('https:/hexlet.io'))
    .rejects.toThrow();
  await expect(loadPage('https://hexlet.io', `${outputDir}/not/exist`))
    .rejects.toThrow('ENOENT:');
});

test('load and write page with failed asset', async () => {
  nock(host).get(pathName).reply(200, initialContent);
  nock(host).get(`${pathName}/scripts/index.js`).reply(200, scriptFile);
  nock(host).get(`${pathName}/styles/index.css`).reply(200, styleFile);
  nock(host).get(`${pathName}/images/work7.jpeg`).reply(404);

  const expectedFailedAssets = [
    {
      message: `HTTP Error 404. The requested URL '${host}${pathName}/images/work7.jpeg' not found.`,
      source: {
        pathForLoad: `${host}${pathName}/images/work7.jpeg`,
        pathForLocalSave: `${assetsDir}/images-work7.jpeg`,
      },
    },
  ];

  const { failedAssets: actualFailedAssets } = await loadPage(`${host}${pathName}`, outputDir);
  expect(actualFailedAssets).toEqual(expectedFailedAssets);
});
