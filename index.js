import path from 'path';
import { promises as fs } from 'fs';
import axios from 'axios';

const loadPage = (url, output = '') => {
  const absOutput = path.resolve(process.cwd(), output);
  const pageName = `${url.replace(/.*\/\//, '').replace(/\W/g, '-')}.html`;

  return fs.access(absOutput)
    .then(() => axios.get(url))
    .then(({ data }) => fs.writeFile(path.join(absOutput, pageName), data))
    .then(() => `Page was downloaded as '${pageName}'`)
    .catch((e) => e.message);
};

export default loadPage;
