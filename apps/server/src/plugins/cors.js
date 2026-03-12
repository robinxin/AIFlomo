/**
 * CORS plugin.
 *
 * Reads the CORS_ORIGIN environment variable (comma-separated list of
 * allowed origins) and configures @fastify/cors to enforce a strict
 * origin whitelist.  Credentials (cookies) are always allowed so that
 * the session cookie can travel with cross-origin requests from the
 * Expo Web frontend.
 *
 * If CORS_ORIGIN is not set the plugin throws immediately so the server
 * fails to start with a clear error rather than silently permitting all
 * origins or crashing at the first real request.
 *
 * Example environment variable:
 *   CORS_ORIGIN=http://localhost:8082,https://aiflomo.example.com
 */

import fp from 'fastify-plugin';
import cors from '@fastify/cors';

/**
 * @param {import('fastify').FastifyInstance} fastify
 */
async function corsPlugin(fastify) {
  const corsOriginEnv = process.env.CORS_ORIGIN;

  if (!corsOriginEnv) {
    throw new Error('CORS_ORIGIN environment variable is required');
  }

  // Support multiple origins separated by commas, trimming whitespace from each.
  const allowedOrigins = corsOriginEnv.split(',').map((o) => o.trim()).filter(Boolean);

  await fastify.register(cors, {
    /**
     * Dynamic origin validation: return the request origin when it matches
     * the whitelist, otherwise return false (which omits the ACAO header).
     *
     * @param {string} origin
     * @param {Function} callback
     */
    origin(origin, callback) {
      // Requests without an Origin header are intentionally allowed.
      //
      // Browsers always send an Origin header on cross-origin requests, so
      // the absence of the header means the request was made by a non-browser
      // client: health-check probes, server-to-server calls, curl, Postman, or
      // internal tooling.  These clients are not subject to the Same-Origin
      // Policy and do not need CORS protection, so allowing them is safe and
      // does not weaken browser-level CORS enforcement.
      //
      // If this service is ever exposed to untrusted server-side callers, add
      // an explicit API-key or mTLS layer rather than tightening CORS, which
      // is a browser security mechanism and not a general authentication tool.
      if (!origin || allowedOrigins.includes(origin)) {
        callback(null, origin || true);
      } else {
        callback(null, false);
      }
    },
    credentials: true,
  });
}

export default fp(corsPlugin, {
  name: 'cors-plugin',
  fastify: '5.x',
});
