/**
 * CORS plugin for AIFlomo.
 *
 * Registers @fastify/cors with a strict origin whitelist read from the
 * ALLOWED_ORIGINS environment variable. Only requests from whitelisted origins
 * will receive Access-Control-Allow-Origin and Access-Control-Allow-Credentials
 * headers, satisfying the security constraints documented in CLAUDE.md.
 *
 * Environment variables:
 *   ALLOWED_ORIGINS — Comma-separated list of allowed origins.
 *                     Example: "http://localhost:8082,https://aiflomo.example.com"
 *                     Leading/trailing whitespace around each entry is trimmed.
 *                     Required — plugin throws if absent or blank.
 */

import fp from 'fastify-plugin';
import cors from '@fastify/cors';

// ---------------------------------------------------------------------------
// Plugin
// ---------------------------------------------------------------------------

/**
 * @param {import('fastify').FastifyInstance} fastify
 * @param {object} _options
 */
async function corsPlugin(fastify, _options) {
  // -------------------------------------------------------------------------
  // 1. Validate and parse ALLOWED_ORIGINS.
  //
  //    Fail fast at startup: an absent or blank value would cause us to either
  //    block all cross-origin requests (breaking the frontend) or accidentally
  //    allow all origins (security hole). Neither outcome is acceptable.
  // -------------------------------------------------------------------------
  const rawOrigins = process.env.ALLOWED_ORIGINS;

  if (!rawOrigins || !rawOrigins.trim()) {
    throw new Error('ALLOWED_ORIGINS 环境变量未设置');
  }

  const allowedOrigins = rawOrigins
    .split(',')
    .map((o) => o.trim())
    .filter((o) => o.length > 0);

  // -------------------------------------------------------------------------
  // 2. Register @fastify/cors.
  //
  //    Using an `origin` function gives us precise per-request control:
  //    - Allowed origins receive the reflected origin value (required when
  //      credentials: true — the wildcard '*' is forbidden in that mode).
  //    - Non-matching origins receive `false`, which instructs @fastify/cors
  //      to omit both Access-Control-Allow-Origin and
  //      Access-Control-Allow-Credentials headers, preventing the browser from
  //      exposing the response to the requesting script.
  // -------------------------------------------------------------------------
  await fastify.register(cors, {
    origin(requestOrigin, callback) {
      if (!requestOrigin) {
        // Same-origin or non-browser request — allow without CORS headers.
        callback(null, false);
        return;
      }

      if (allowedOrigins.includes(requestOrigin)) {
        callback(null, requestOrigin);
      } else {
        callback(null, false);
      }
    },
    credentials: true,
  });
}

export default fp(corsPlugin, {
  name: 'cors',
});
