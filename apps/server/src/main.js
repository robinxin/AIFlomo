/**
 * Server startup entry point.
 *
 * This file is intentionally minimal — it only imports buildApp from index.js
 * and starts the HTTP server. All application logic lives in index.js so that
 * tests can import buildApp without triggering a real TCP listen.
 *
 * Usage:
 *   node src/main.js
 *   PORT=8080 node src/main.js
 */

import { buildApp } from './index.js';

const DEFAULT_PORT = 3000;
const DEFAULT_HOST = '0.0.0.0';

const port = Number(process.env.PORT) || DEFAULT_PORT;

const app = await buildApp({ logger: true });

try {
  await app.listen({ port, host: DEFAULT_HOST });
} catch (err) {
  app.log.error(err);
  process.exit(1);
}
