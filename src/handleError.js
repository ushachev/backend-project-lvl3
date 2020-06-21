const codeMapping = {
  400: (url) => `HTTP Error 400. The request URL '${url}' is invalid.`,
  401: (url) => `HTTP Error 401. Authentication required to get response from '${url}'.`,
  403: (url) => `HTTP Error 403. There are no acsess rights to '${url}'.`,
  404: (url) => `HTTP Error 404. The page with requested URL '${url}' not found.`,
  500: (url) => `HTTP Error 500. Internal Server Error while hanling '${url}'.`,
};

export default (err) => {
  if (err.isAxiosError) {
    const getDefaultMessage = (url) => `${err.message} while hanling '${url}'`;
    const getErrorMessage = codeMapping[err.response.status] || getDefaultMessage;

    throw new Error(getErrorMessage(err.response.config.url));
  }
  throw err;
};
