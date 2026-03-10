import { requireAuth } from '../plugins/auth.js';
import { db } from '../db/index.js';
import { memos, tags, memoTags, memoAttachments } from '../db/schema.js';
import { eq, desc, and, isNull, isNotNull, like, inArray, notInArray, sql } from 'drizzle-orm';
import { AppError, NotFoundError } from '../lib/errors.js';

const MAX_TAGS_PER_MEMO = 10;
const TAG_NAME_REGEX = /^[\u4e00-\u9fa5a-zA-Z0-9_]+$/;
const MAX_TAG_NAME_LENGTH = 20;

const createMemoSchema = {
  body: {
    type: 'object',
    required: ['content'],
    properties: {
      content: { type: 'string', minLength: 1, maxLength: 10000 },
      attachments: {
        type: 'array',
        maxItems: 20,
        items: {
          type: 'object',
          required: ['type', 'url'],
          properties: {
            type: { type: 'string', enum: ['image', 'link'] },
            url: { type: 'string', minLength: 1, format: 'uri' },
          },
        },
      },
    },
  },
};

const updateMemoSchema = {
  params: {
    type: 'object',
    required: ['id'],
    properties: {
      id: { type: 'string' },
    },
  },
  body: {
    type: 'object',
    required: ['content'],
    properties: {
      content: { type: 'string', minLength: 1, maxLength: 10000 },
      attachments: {
        type: 'array',
        maxItems: 20,
        items: {
          type: 'object',
          required: ['type', 'url'],
          properties: {
            type: { type: 'string', enum: ['image', 'link'] },
            url: { type: 'string', minLength: 1, format: 'uri' },
          },
        },
      },
    },
  },
};

const memoParamsSchema = {
  params: {
    type: 'object',
    required: ['id'],
    properties: {
      id: { type: 'string' },
    },
  },
};

const listMemosSchema = {
  querystring: {
    type: 'object',
    properties: {
      type: { type: 'string', enum: ['tagged', 'untagged', 'image', 'link'] },
      tagId: { type: 'string', minLength: 1 },
      q: { type: 'string', maxLength: 200 },
      page: { type: 'integer', minimum: 1 },
      limit: { type: 'integer', minimum: 1, maximum: 100 },
    },
    additionalProperties: false,
  },
};

const listTrashSchema = {
  querystring: {
    type: 'object',
    properties: {
      page: { type: 'integer', minimum: 1 },
      limit: { type: 'integer', minimum: 1, maximum: 100 },
    },
    additionalProperties: false,
  },
};

function extractTagNames(content) {
  const matches = content.match(/#([\u4e00-\u9fa5a-zA-Z0-9_]+)/g) ?? [];
  const names = matches.map((m) => m.slice(1)).filter((name) => {
    return name.length <= MAX_TAG_NAME_LENGTH && TAG_NAME_REGEX.test(name);
  });
  return [...new Set(names)];
}

async function upsertTags(userId, tagNames, tx) {
  if (tagNames.length === 0) return [];

  const runner = tx ?? db;

  const existingRows = await runner
    .select({ id: tags.id, name: tags.name })
    .from(tags)
    .where(and(eq(tags.userId, userId), inArray(tags.name, tagNames)));

  const existingMap = new Map(existingRows.map((t) => [t.name, t]));
  const missingNames = tagNames.filter((name) => !existingMap.has(name));

  if (missingNames.length > 0) {
    const created = await runner
      .insert(tags)
      .values(missingNames.map((name) => ({ name, userId })))
      .returning({ id: tags.id, name: tags.name });
    for (const t of created) {
      existingMap.set(t.name, t);
    }
  }

  return tagNames.map((name) => existingMap.get(name));
}

async function getMemoWithDetails(memoId, userId) {
  const [memo] = await db
    .select()
    .from(memos)
    .where(and(eq(memos.id, memoId), eq(memos.userId, userId)))
    .limit(1);
  return memo ?? null;
}

async function attachTagsAndAttachments(memoRows) {
  if (memoRows.length === 0) return [];

  const memoIds = memoRows.map((m) => m.id);

  const tagRows = await db
    .select({
      memoId: memoTags.memoId,
      tagId: tags.id,
      tagName: tags.name,
    })
    .from(memoTags)
    .innerJoin(tags, eq(memoTags.tagId, tags.id))
    .where(inArray(memoTags.memoId, memoIds));

  const attachmentRows = await db
    .select()
    .from(memoAttachments)
    .where(inArray(memoAttachments.memoId, memoIds));

  const tagsByMemo = {};
  for (const row of tagRows) {
    if (!tagsByMemo[row.memoId]) tagsByMemo[row.memoId] = [];
    tagsByMemo[row.memoId].push({ id: row.tagId, name: row.tagName });
  }

  const attachmentsByMemo = {};
  for (const row of attachmentRows) {
    if (!attachmentsByMemo[row.memoId]) attachmentsByMemo[row.memoId] = [];
    attachmentsByMemo[row.memoId].push(row);
  }

  return memoRows.map((m) => ({
    ...m,
    tags: tagsByMemo[m.id] ?? [],
    attachments: attachmentsByMemo[m.id] ?? [],
  }));
}

export async function memoRoutes(fastify) {
  fastify.get('/', { preHandler: [requireAuth], schema: listMemosSchema }, async (request, reply) => {
    const userId = request.session.userId;
    const { type, tagId, q, page, limit } = request.query;

    const pageNum = Math.max(1, parseInt(page) || 1);
    const limitNum = Math.min(100, Math.max(1, parseInt(limit) || 20));
    const offset = (pageNum - 1) * limitNum;

    let conditions = [eq(memos.userId, userId), isNull(memos.deletedAt)];

    if (type === 'tagged') {
      const taggedSubquery = db
        .selectDistinct({ id: memoTags.memoId })
        .from(memoTags)
        .innerJoin(memos, eq(memoTags.memoId, memos.id))
        .where(and(eq(memos.userId, userId), isNull(memos.deletedAt)));
      conditions.push(inArray(memos.id, taggedSubquery));
    } else if (type === 'untagged') {
      const taggedSubquery = db
        .selectDistinct({ id: memoTags.memoId })
        .from(memoTags)
        .innerJoin(memos, eq(memoTags.memoId, memos.id))
        .where(and(eq(memos.userId, userId), isNull(memos.deletedAt)));
      conditions.push(notInArray(memos.id, taggedSubquery));
    } else if (type === 'image') {
      conditions.push(eq(memos.hasImage, 1));
    } else if (type === 'link') {
      conditions.push(eq(memos.hasLink, 1));
    }

    if (tagId) {
      const tagMemoSubquery = db
        .select({ id: memoTags.memoId })
        .from(memoTags)
        .innerJoin(tags, eq(memoTags.tagId, tags.id))
        .where(and(eq(memoTags.tagId, tagId), eq(tags.userId, userId)));
      conditions.push(inArray(memos.id, tagMemoSubquery));
    }

    if (q && q.trim()) {
      const escapedQ = q.trim().replace(/[%_\\]/g, '\\$&');
      conditions.push(sql`${memos.content} LIKE ${'%' + escapedQ + '%'} ESCAPE '\\'`);
    }

    const rows = await db
      .select()
      .from(memos)
      .where(and(...conditions))
      .orderBy(desc(memos.createdAt))
      .limit(limitNum)
      .offset(offset);

    const enriched = await attachTagsAndAttachments(rows);

    return reply.send({ data: enriched, message: 'ok' });
  });

  fastify.post('/', { preHandler: [requireAuth], schema: createMemoSchema }, async (request, reply) => {
    const userId = request.session.userId;
    const { content, attachments = [] } = request.body;

    for (const a of attachments) {
      if (!/^https?:\/\//i.test(a.url)) {
        throw new AppError(400, '附件 URL 必须使用 http 或 https 协议', 'INVALID_ATTACHMENT_URL');
      }
    }

    const tagNames = extractTagNames(content);
    if (tagNames.length > MAX_TAGS_PER_MEMO) {
      throw new AppError(400, `每条笔记最多 ${MAX_TAGS_PER_MEMO} 个标签`, 'TOO_MANY_TAGS');
    }

    const hasImage = attachments.some((a) => a.type === 'image') ? 1 : 0;
    const hasLink =
      attachments.some((a) => a.type === 'link') ||
      /https?:\/\/[^\s]+/.test(content)
        ? 1
        : 0;

    const memo = await db.transaction(async (tx) => {
      const tagRecords = await upsertTags(userId, tagNames, tx);

      const [inserted] = await tx
        .insert(memos)
        .values({ content, userId, hasImage, hasLink })
        .returning();

      if (tagRecords.length > 0) {
        await tx
          .insert(memoTags)
          .values(tagRecords.map((tag) => ({ memoId: inserted.id, tagId: tag.id })))
          .onConflictDoNothing();
      }

      if (attachments.length > 0) {
        await tx.insert(memoAttachments).values(
          attachments.map((a) => ({ memoId: inserted.id, type: a.type, url: a.url }))
        );
      }

      return inserted;
    });

    const [enriched] = await attachTagsAndAttachments([memo]);

    return reply.status(201).send({ data: enriched, message: '创建成功' });
  });

  fastify.put('/:id', { preHandler: [requireAuth], schema: updateMemoSchema }, async (request, reply) => {
    const userId = request.session.userId;
    const { id } = request.params;
    const { content, attachments } = request.body;

    const existing = await getMemoWithDetails(id, userId);
    if (!existing) throw new NotFoundError('Memo');
    if (existing.deletedAt !== null) throw new AppError(400, '笔记已在回收站', 'MEMO_IN_TRASH');

    if (attachments !== undefined) {
      for (const a of attachments) {
        if (!/^https?:\/\//i.test(a.url)) {
          throw new AppError(400, '附件 URL 必须使用 http 或 https 协议', 'INVALID_ATTACHMENT_URL');
        }
      }
    }

    const tagNames = extractTagNames(content);
    if (tagNames.length > MAX_TAGS_PER_MEMO) {
      throw new AppError(400, `每条笔记最多 ${MAX_TAGS_PER_MEMO} 个标签`, 'TOO_MANY_TAGS');
    }

    let hasImage = existing.hasImage;
    let hasLink = existing.hasLink;

    if (attachments !== undefined) {
      hasImage = attachments.some((a) => a.type === 'image') ? 1 : 0;
      hasLink =
        attachments.some((a) => a.type === 'link') ||
        /https?:\/\/[^\s]+/.test(content)
          ? 1
          : 0;
    } else {
      hasLink = /https?:\/\/[^\s]+/.test(content) ? 1 : hasLink;
    }

    const updatedAt = new Date().toISOString();

    await db.transaction(async (tx) => {
      const tagRecords = await upsertTags(userId, tagNames, tx);

      await tx
        .update(memos)
        .set({ content, hasImage, hasLink, updatedAt })
        .where(and(eq(memos.id, id), eq(memos.userId, userId)));

      await tx.delete(memoTags).where(eq(memoTags.memoId, id));

      if (tagRecords.length > 0) {
        await tx
          .insert(memoTags)
          .values(tagRecords.map((tag) => ({ memoId: id, tagId: tag.id })))
          .onConflictDoNothing();
      }

      if (attachments !== undefined) {
        await tx.delete(memoAttachments).where(eq(memoAttachments.memoId, id));
        if (attachments.length > 0) {
          await tx.insert(memoAttachments).values(
            attachments.map((a) => ({ memoId: id, type: a.type, url: a.url }))
          );
        }
      }
    });

    const [updatedMemo] = await db
      .select()
      .from(memos)
      .where(and(eq(memos.id, id), eq(memos.userId, userId)))
      .limit(1);

    const [enriched] = await attachTagsAndAttachments([updatedMemo]);

    return reply.send({ data: enriched, message: '更新成功' });
  });

  fastify.delete('/:id', { preHandler: [requireAuth], schema: memoParamsSchema }, async (request, reply) => {
    const userId = request.session.userId;
    const { id } = request.params;

    const existing = await getMemoWithDetails(id, userId);
    if (!existing) throw new NotFoundError('Memo');
    if (existing.deletedAt !== null) throw new AppError(400, '笔记已在回收站', 'MEMO_IN_TRASH');

    const deletedAt = new Date().toISOString();
    await db
      .update(memos)
      .set({ deletedAt })
      .where(and(eq(memos.id, id), eq(memos.userId, userId)));

    return reply.send({ data: null, message: '笔记已移入回收站' });
  });

  fastify.get('/trash', { preHandler: [requireAuth], schema: listTrashSchema }, async (request, reply) => {
    const userId = request.session.userId;
    const { page, limit } = request.query;

    const pageNum = Math.max(1, parseInt(page) || 1);
    const limitNum = Math.min(100, Math.max(1, parseInt(limit) || 20));
    const offset = (pageNum - 1) * limitNum;

    const rows = await db
      .select()
      .from(memos)
      .where(and(eq(memos.userId, userId), isNotNull(memos.deletedAt)))
      .orderBy(desc(memos.deletedAt))
      .limit(limitNum)
      .offset(offset);

    const enriched = await attachTagsAndAttachments(rows);

    return reply.send({ data: enriched, message: 'ok' });
  });

  fastify.post('/:id/restore', { preHandler: [requireAuth], schema: memoParamsSchema }, async (request, reply) => {
    const userId = request.session.userId;
    const { id } = request.params;

    const existing = await getMemoWithDetails(id, userId);
    if (!existing) throw new NotFoundError('Memo');
    if (existing.deletedAt === null) throw new AppError(400, '笔记不在回收站', 'MEMO_NOT_IN_TRASH');

    await db
      .update(memos)
      .set({ deletedAt: null })
      .where(and(eq(memos.id, id), eq(memos.userId, userId)));

    const [restoredMemo] = await db
      .select()
      .from(memos)
      .where(and(eq(memos.id, id), eq(memos.userId, userId)))
      .limit(1);

    const [enriched] = await attachTagsAndAttachments([restoredMemo]);

    return reply.send({ data: enriched, message: '笔记已恢复' });
  });

  fastify.delete('/:id/permanent', { preHandler: [requireAuth], schema: memoParamsSchema }, async (request, reply) => {
    const userId = request.session.userId;
    const { id } = request.params;

    const existing = await getMemoWithDetails(id, userId);
    if (!existing) throw new NotFoundError('Memo');
    if (existing.deletedAt === null) throw new AppError(400, '笔记不在回收站，无法永久删除', 'MEMO_NOT_IN_TRASH');

    await db
      .delete(memos)
      .where(and(eq(memos.id, id), eq(memos.userId, userId)));

    return reply.send({ data: null, message: '笔记已永久删除' });
  });
}
