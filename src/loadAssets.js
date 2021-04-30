import Listr from 'listr';

const loadAssetsInSilentMode = (tasks) => Promise.allSettled(tasks.map(({ task }) => task()))
  .then((results) => results
    .filter(({ status }) => status === 'rejected')
    .map(({ reason: { message, source } }) => ({ message, source })));

const loadAssetsInVisualMode = (tasks) => new Listr(tasks, {
  concurrent: true,
  exitOnError: false,
})
  .run([])
  .catch((e) => {
    if (e.name === 'ListrError') {
      return e.errors.map(({ message, source }) => ({ message, source }));
    }
    throw e;
  });

export { loadAssetsInSilentMode, loadAssetsInVisualMode };
