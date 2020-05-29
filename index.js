import path from 'path';
import { promises as fs } from 'fs';
import axios from 'axios';

const loadPage = (url, output) => {
  const pageName = 'hexlet-io-courses.html';
  const filepath = path.join(output, pageName);
  const fullPath = path.resolve(process.cwd(), filepath);

  return axios.get(url)
    .then(({ data }) => fs.writeFile(fullPath, data))
    .catch((error) => console.log('error', error));
};

export default loadPage;
