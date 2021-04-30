import getPageLoader from './src/loadPage.js';
import { loadAssetsInSilentMode } from './src/loadAssets.js';

const loadPage = getPageLoader(loadAssetsInSilentMode);

export default loadPage;
