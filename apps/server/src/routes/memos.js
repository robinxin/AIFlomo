/**
 * apps/server/src/routes/memos.js
 *
 * Memo routes plugin (Fastify).
 *
 * Registers:
 *   POST   /   — create memo
 *   GET    /   — list memos (paginated, filterable)
 *   DELETE /:id — delete memo
 *
 * The `db` instance is injected via plugin options so that tests can
 * supply a mock without touching the SQLite file.
 *
 * All routes require authentication via the requireAuth preHandler which
 * reads request.session.userId set by the session plugin.
 *
 * Validator note:
 *   Fastify 5 defaults to `removeAdditional: true` in its AJV configuration,
 *   meaning extra request properties are silently stripped rather than
 *   rejected with a 400. This plugin overrides the validator compiler with
 *   a strict AJV instance (`removeAdditional: false`) so that
 *   `additionalProperties: false` in our schemas causes a 400 error, which
 *   is the behaviour the API contract requires.
 */

import { createRequire } from 'module';
import { eq, and, inArray, sql } from 'drizzle-orm';
import { requireAuth } from '../plugins/auth.js';
import { NotFoundError } from '../lib/errors.js';
import { memos, tags, memoTags, memoImages } from '../db/schema.js';

// ─── Strict AJV instance ──────────────────────────────────────────────────────
//
// We resolve AJV (v8) through @fastify/ajv-compiler's own node_modules so we
// are guaranteed to use the same version Fastify itself relies on, without
// adding a new top-level dependency.
//
// Using createRequire here is safe because this module is loaded once at
// startup; the AJV instance is reused for all schema compilations in the
// plugin scope.

const _require = createRequire(import.meta.url);

/**
 * Build a strict AJV instance with ajv-formats registered.
 * Resolves AJV through @fastify/ajv-compiler to use the same version.
 *
 * @returns {import('ajv').Ajv}
 */
function buildStrictAjv() {
  // Resolve the path of @fastify/ajv-compiler so we can require sub-packages
  // that live in its own node_modules tree.
  const compilerPath = _require.resolve('@fastify/ajv-compiler');
  const compilerRequire = createRequire(compilerPath);

  const Ajv = compilerRequire('ajv').default;
  const addFormats = compilerRequire('ajv-formats');
  const fastUri = compilerRequire('fast-uri');

  const ajv = new Ajv({
    coerceTypes: 'array',  // coerce query-string integers from strings
    useDefaults: true,      // apply `default` values
    removeAdditional: false, // REJECT additional properties instead of stripping
    allErrors: false,
    uriResolver: fastUri,
  });

  // Register URI, email, date-time etc. formats so `format: 'uri'` works.
  addFormats(ajv);

  return ajv;
}

const strictAjv = buildStrictAjv();

// ─── JSON Schema definitions ──────────────────────────────────────────────────

const TAG_NAME_PATTERN = '^[\u4e00-\u9fa5a-zA-Z0-9_]+$';

// Validates that a URL uses the https scheme only.
// Rejects data:, javascript:, http:, and any other schemes.
// Security: prevents XSS via data: URIs and SSRF via internal http: endpoints.
const HTTPS_URL_PATTERN = '^https://';

const createMemoSchema = {
  body: {
    type: 'object',
    required: ['content'],
    additionalProperties: false,
    properties: {
      content: {
        type: 'string',
        minLength: 1,
        maxLength: 10000,
      },
      tagNames: {
        type: 'array',
        maxItems: 50,
        uniqueItems: true,
        items: {
          type: 'string',
          minLength: 2,
          maxLength: 20,
          pattern: TAG_NAME_PATTERN,
        },
      },
      imageUrls: {
        type: 'array',
        maxItems: 9,
        items: {
          type: 'string',
          format: 'uri',
          // Restrict to https:// only — prevents XSS (data:/javascript: URIs)
          // and SSRF (http:// to internal services).
          pattern: HTTPS_URL_PATTERN,
        },
      },
    },
  },
};

const listMemosSchema = {
  querystring: {
    type: 'object',
    additionalProperties: false,
    properties: {
      filter: {
        type: 'string',
        enum: ['all', 'tagged', 'with-images'],
        default: 'all',
      },
      tagId: {
        type: 'string',
      },
      page: {
        type: 'integer',
        minimum: 1,
        default: 1,
      },
      limit: {
        type: 'integer',
        minimum: 1,
        maximum: 100,
        default: 20,
      },
    },
  },
};

const deleteMemoSchema = {
  params: {
    type: 'object',
    required: ['id'],
    properties: {
      id: {
        type: 'string',
        minLength: 1,
      },
    },
  },
};

// ─── Route handler helpers ────────────────────────────────────────────────────

/**
 * Aggregate flat LEFT JOIN rows into memo objects with nested tags and images
 * arrays. This avoids the N+1 query problem by loading all data in one pass.
 *
 * Uses immutable accumulation — no in-place mutation of existing arrays.
 *
 * @param {Array<object>} rows - Flat rows from the LEFT JOIN query.
 * @returns {Array<object>} Aggregated memo objects.
 */
function aggregateRows(rows) {
  const memoMap = rows.reduce((acc, row) => {
    const existing = acc.get(row.id);

    const base = existing || {
      id: row.id,
      content: row.content,
      userId: row.userId,
      createdAt: row.createdAt,
      updatedAt: row.updatedAt,
      tags: [],
      images: [],
    };

    const updatedTags =
      row.tagId && !base.tags.some((t) => t.id === row.tagId)
        ? [...base.tags, { id: row.tagId, name: row.tagName }]
        : base.tags;

    const updatedImages =
      row.imageId && !base.images.some((img) => img.id === row.imageId)
        ? [...base.images, { id: row.imageId, url: row.imageUrl }]
        : base.images;

    return acc.set(row.id, { ...base, tags: updatedTags, images: updatedImages });
  }, new Map());

  return Array.from(memoMap.values());
}

/**
 * Build a WHERE condition for the count query that mirrors the data query's
 * JOIN and WHERE conditions for a given filter/tagId combination.
 *
 * Returns an object with:
 *   - countQuery: the Drizzle count query (not yet executed)
 *
 * @param {object} db - Drizzle db instance.
 * @param {string} userId - Authenticated user's ID.
 * @param {string|undefined} tagId - Optional tag ID filter.
 * @param {string} filter - One of 'all', 'tagged', 'with-images'.
 * @returns {object} Drizzle query builder for the count.
 */
function buildCountQuery(db, userId, tagId, filter) {
  if (tagId) {
    // INNER JOIN on memo_tags (same tag) + verify tag belongs to this user
    return db
      .select({ count: sql`COUNT(DISTINCT ${memos.id})` })
      .from(memos)
      .innerJoin(
        memoTags,
        and(eq(memoTags.memoId, memos.id), eq(memoTags.tagId, tagId))
      )
      .innerJoin(
        tags,
        and(eq(tags.id, memoTags.tagId), eq(tags.userId, userId))
      )
      .where(eq(memos.userId, userId));
  }

  if (filter === 'tagged') {
    return db
      .select({ count: sql`COUNT(DISTINCT ${memos.id})` })
      .from(memos)
      .innerJoin(memoTags, eq(memoTags.memoId, memos.id))
      .where(eq(memos.userId, userId));
  }

  if (filter === 'with-images') {
    return db
      .select({ count: sql`COUNT(DISTINCT ${memos.id})` })
      .from(memos)
      .innerJoin(memoImages, eq(memoImages.memoId, memos.id))
      .where(eq(memos.userId, userId));
  }

  // filter === 'all'
  return db
    .select({ count: sql`COUNT(DISTINCT ${memos.id})` })
    .from(memos)
    .where(eq(memos.userId, userId));
}

// ─── Plugin ───────────────────────────────────────────────────────────────────

/**
 * @param {import('fastify').FastifyInstance} fastify
 * @param {{ db: object }} opts
 */
async function memoRoutes(fastify, opts) {
  // Override the scoped validator compiler to use strict AJV (no removeAdditional).
  // This only affects schemas compiled within this plugin's scope.
  fastify.setValidatorCompiler(({ schema }) => strictAjv.compile(schema));

  // The `db` injected via options (allows test mocking).
  const db = opts.db;

  // ── POST / — create memo ──────────────────────────────────────────────────

  fastify.post('/', {
    schema: createMemoSchema,
    preHandler: [requireAuth],
    // Apply a stricter rate limit for memo creation to prevent spam.
    // Overrides the global 100 req/min limit set in index.js.
    config: {
      rateLimit: {
        max: 20,
        timeWindow: '1 minute',
      },
    },
    handler: async (request, reply) => {
      const { content, tagNames = [], imageUrls = [] } = request.body;
      const userId = request.session.userId;

      // 1. Insert the memo row.
      const [newMemo] = await db
        .insert(memos)
        .values({ content, userId })
        .execute();

      const resolvedTags = [];

      // 2. For each tag name: find existing or create new.
      for (const name of tagNames) {
        // SELECT tag by name + userId.
        const existingTags = await db
          .select()
          .from(tags)
          .where(and(eq(tags.name, name), eq(tags.userId, userId)))
          .execute();

        let tag;
        if (existingTags.length > 0) {
          tag = existingTags[0];
        } else {
          // INSERT new tag.
          const [insertedTag] = await db
            .insert(tags)
            .values({ name, userId })
            .execute();
          tag = insertedTag;
        }

        // INSERT memo_tags association.
        await db
          .insert(memoTags)
          .values({ memoId: newMemo.id, tagId: tag.id })
          .execute();

        resolvedTags.push(tag);
      }

      const resolvedImages = [];

      // 3. Insert image metadata rows.
      for (const url of imageUrls) {
        const [insertedImage] = await db
          .insert(memoImages)
          .values({
            memoId: newMemo.id,
            url,
            // fileSize and mimeType are not provided by this endpoint;
            // use 0 / empty string as placeholders. A dedicated upload
            // endpoint would supply real values.
            fileSize: 0,
            mimeType: '',
          })
          .execute();
        resolvedImages.push(insertedImage);
      }

      return reply.status(201).send({
        data: {
          id: newMemo.id,
          content: newMemo.content,
          userId: newMemo.userId,
          createdAt: newMemo.createdAt,
          updatedAt: newMemo.updatedAt,
          tags: resolvedTags,
          images: resolvedImages,
        },
        message: '创建成功',
      });
    },
  });

  // ── GET / — list memos ────────────────────────────────────────────────────

  fastify.get('/', {
    schema: listMemosSchema,
    preHandler: [requireAuth],
    handler: async (request, reply) => {
      const { filter = 'all', tagId, page = 1, limit = 20 } = request.query;
      const userId = request.session.userId;
      const offset = (page - 1) * limit;

      // Phase 1: paginate on memo IDs only to avoid JOIN row expansion.
      // Applying LIMIT/OFFSET to a JOIN query counts expanded rows (one row
      // per tag/image combination), not unique memos. The two-phase approach
      // first determines the correct page of memo IDs, then fetches full data.
      let memoIdRows;

      if (tagId) {
        // INNER JOIN on the specified tag; additionally verify the tag belongs
        // to the requesting user to prevent cross-user tag ID enumeration.
        memoIdRows = await db
          .select({ id: memos.id })
          .from(memos)
          .innerJoin(
            memoTags,
            and(eq(memoTags.memoId, memos.id), eq(memoTags.tagId, tagId))
          )
          .innerJoin(
            tags,
            and(eq(tags.id, memoTags.tagId), eq(tags.userId, userId))
          )
          .where(eq(memos.userId, userId))
          .orderBy(sql`${memos.createdAt} DESC`)
          .limit(limit)
          .offset(offset)
          .execute();
      } else if (filter === 'tagged') {
        memoIdRows = await db
          .select({ id: memos.id })
          .from(memos)
          .innerJoin(memoTags, eq(memoTags.memoId, memos.id))
          .where(eq(memos.userId, userId))
          .groupBy(memos.id)
          .orderBy(sql`${memos.createdAt} DESC`)
          .limit(limit)
          .offset(offset)
          .execute();
      } else if (filter === 'with-images') {
        memoIdRows = await db
          .select({ id: memos.id })
          .from(memos)
          .innerJoin(memoImages, eq(memoImages.memoId, memos.id))
          .where(eq(memos.userId, userId))
          .groupBy(memos.id)
          .orderBy(sql`${memos.createdAt} DESC`)
          .limit(limit)
          .offset(offset)
          .execute();
      } else {
        // filter === 'all'
        memoIdRows = await db
          .select({ id: memos.id })
          .from(memos)
          .where(eq(memos.userId, userId))
          .orderBy(sql`${memos.createdAt} DESC`)
          .limit(limit)
          .offset(offset)
          .execute();
      }

      // Phase 2: fetch full data (tags + images) for the paginated memo IDs.
      // If this page is empty, skip the second query entirely.
      const pageIds = memoIdRows.map((r) => r.id);

      let aggregatedMemos = [];

      if (pageIds.length > 0) {
        const rows = await db
          .select({
            id: memos.id,
            content: memos.content,
            userId: memos.userId,
            createdAt: memos.createdAt,
            updatedAt: memos.updatedAt,
            tagId: memoTags.tagId,
            tagName: tags.name,
            imageId: memoImages.id,
            imageUrl: memoImages.url,
          })
          .from(memos)
          .leftJoin(memoTags, eq(memoTags.memoId, memos.id))
          .leftJoin(tags, eq(tags.id, memoTags.tagId))
          .leftJoin(memoImages, eq(memoImages.memoId, memos.id))
          .where(inArray(memos.id, pageIds))
          .orderBy(sql`${memos.createdAt} DESC`)
          .execute();

        aggregatedMemos = aggregateRows(rows);
      }

      // Count query mirrors the same JOIN/WHERE conditions as the data query
      // so that `total` reflects the filtered result set, not all memos.
      const countQuery = buildCountQuery(db, userId, tagId, filter);
      const countRows = await countQuery.execute();
      const total = Number(countRows[0]?.count ?? 0);

      return reply.status(200).send({
        data: {
          memos: aggregatedMemos,
          total,
          page,
          limit,
        },
        message: 'ok',
      });
    },
  });

  // ── DELETE /:id — delete memo ─────────────────────────────────────────────

  fastify.delete('/:id', {
    schema: deleteMemoSchema,
    preHandler: [requireAuth],
    handler: async (request, reply) => {
      const { id } = request.params;
      const userId = request.session.userId;

      // Combine the existence check and ownership check into a single query.
      // This prevents memo ID enumeration: an attacker cannot distinguish
      // between "memo does not exist" and "memo belongs to another user"
      // because both cases return 404.
      const foundMemos = await db
        .select()
        .from(memos)
        .where(and(eq(memos.id, id), eq(memos.userId, userId)))
        .execute();

      if (foundMemos.length === 0) {
        throw new NotFoundError('Memo');
      }

      // Delete the memo. ON DELETE CASCADE handles memo_tags and memo_images.
      await db
        .delete(memos)
        .where(and(eq(memos.id, id), eq(memos.userId, userId)))
        .execute();

      return reply.status(204).send();
    },
  });
}

export default memoRoutes;
