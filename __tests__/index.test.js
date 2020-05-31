import path from 'path';
import os from 'os';
import { promises as fs } from 'fs';
import nock from 'nock';
import loadPage from '../index.js';

const getFixturePath = (filename) => path.join('__fixtures__', filename);

const host = 'https://hexlet.io';
const pathName = '/courses';
const pageName = 'hexlet-io-courses.html';

let pageContent;
let output;

beforeAll(async () => {
  const html = await fs.readFile(getFixturePath('data.html'), 'utf-8');
  pageContent = html.trim();
});

beforeEach(async () => {
  output = await fs.mkdtemp(path.join(os.tmpdir(), 'page-loader-'));
});

afterEach(() => { nock.restore(); });

test('load and write page', async () => {
  nock(host).get(pathName).reply(200, pageContent);

  const msg = await loadPage(`${host}${pathName}`, output);

  const filepath = path.join(output, pageName);
  const loadedContent = await fs.readFile(filepath, 'utf-8');

  expect(msg).toBe(`Page was downloaded as '${pageName}'`);
  expect(loadedContent).toBe(pageContent);
});

test('load with error', async () => {
  const msg = await loadPage('invalid/url');
  expect(msg).toBe('Request failed with status code 400');

  const msg2 = await loadPage(`${host}${pathName}`, `${output}/not/exist`);
  expect(msg2).toMatch(/ENOENT/);
});
