import { pathToFileURL } from 'node:url';

export * from './constants.js';
export * from './errors.js';
export * from './rc-client.js';
export * from './server.js';
export * from './tool-registry.js';
export * from './types.js';

import { startServer } from './server.js';

const entryPoint = process.argv[1];

if (entryPoint && import.meta.url === pathToFileURL(entryPoint).href) {
  void startServer();
}
