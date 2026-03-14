import 'dotenv/config';
import Fastify from 'fastify';
import fastifyCors from '@fastify/cors';
import sessionPlugin from './plugins/session.js';
import authRoutes from './routes/auth.js';

const PORT = parseInt(process.env.PORT || '3000', 10);
const HOST = process.env.HOST || '0.0.0.0';

const fastify = Fastify({
  logger: true,
});

// ─── Plugin Registration Order ──────────────────────────────────────────────
// 1. CORS — must be registered first so every request gets CORS headers
// 2. Session — must precede any route that accesses request.session
// 3. Routes (auth)

// Step 1: CORS plugin
// Allowed origins are read from CORS_ALLOWED_ORIGINS (comma-separated) env var.
// In development mode, localhost origins for the Expo web server (8082 / 8081)
// and Vite (5173) are added automatically so no manual .env changes are needed
// during local development.
await fastify.register(fastifyCors, {
  origin: (origin, callback) => {
    const isProduction = process.env.NODE_ENV === 'production';

    // Build the allowed origins list from the environment variable
    const envOrigins = process.env.CORS_ALLOWED_ORIGINS
      ? process.env.CORS_ALLOWED_ORIGINS.split(',').map((o) => o.trim()).filter(Boolean)
      : [];

    const allowedOrigins = [...envOrigins];

    // Automatically allow common local development origins in non-production
    if (!isProduction) {
      allowedOrigins.push(
        'http://localhost:8081', // Expo default web port
        'http://localhost:8082', // CI / scripts/ci/frontend-url.sh port
        'http://localhost:5173', // Vite / Expo web alternate
        'http://127.0.0.1:8081',
        'http://127.0.0.1:8082',
        'http://127.0.0.1:5173',
      );
    }

    // Allow requests with no Origin header (mobile app, curl, server-to-server)
    if (!origin) {
      return callback(null, true);
    }

    if (allowedOrigins.includes(origin)) {
      return callback(null, true);
    }

    callback(new Error('Not allowed by CORS'), false);
  },
  methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization', 'X-Request-ID'],
  exposedHeaders: ['X-Request-ID'],
  credentials: true,       // Required for session cookie transport
  maxAge: 86400,           // Cache preflight for 24 hours (86400 seconds)
  preflight: true,
  strictPreflight: false,  // Allow preflight for unregistered routes too
});

// Step 2: Session plugin (must precede any route that reads request.session)
// Uses fp() internally so session decorator is shared to all scopes.
await fastify.register(sessionPlugin);

// Step 3: Auth routes
// authRoutes uses fastify-plugin (fp) which bypasses Fastify v5 encapsulation,
// causing prefix passed to register() to be ignored.  Wrapping in a plain async
// function restores the encapsulation scope so the /api/auth prefix is applied
// correctly, while the session decorator (registered globally above) remains
// accessible inside the scoped plugin.
await fastify.register(async function authScope(scopedFastify) {
  scopedFastify.register(authRoutes);
}, { prefix: '/api/auth' });

// Health check (public, no auth required)
fastify.get('/health', async () => {
  return { status: 'ok', timestamp: Date.now() };
});

// Start server
try {
  await fastify.listen({ port: PORT, host: HOST });
  console.log(`Server listening on http://${HOST}:${PORT}`);
} catch (err) {
  fastify.log.error(err);
  process.exit(1);
}
