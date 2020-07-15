import LoaderError from './LoaderError.js';

const codeMapping = {
  400: (url) => `HTTP Error 400. The request URL '${url}' is invalid.`,
  401: (url) => `HTTP Error 401. Authentication required to get response from '${url}'.`,
  403: (url) => `HTTP Error 403. There are no acsess rights to '${url}'.`,
  404: (url) => `HTTP Error 404. The requested URL '${url}' not found.`,
  500: (url) => `HTTP Error 500. Internal Server Error while hanling '${url}'.`,
};

const getErrorMessage = (err) => {
  if (!err.isAxiosError || !err.response) return err.message;

  const { message, response: { status: code, config: { url } } } = err;
  return codeMapping[code]
    ? codeMapping[code](url)
    : `${message} while handling '${url}'`;
};

export default (err, source = null) => {
  const message = getErrorMessage(err);
  if (source) {
    throw new LoaderError(message, source);
  }
  throw new Error(message);
};
