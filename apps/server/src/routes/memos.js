import { db } from '../db/index.js';
import { memos, tags, memoTags } from '../db/schema.js';
import { eq, and, isNull, isNotNull, sql, inArray } from 'drizzle-orm';
import { requireAuth } from '../plugins/auth.js';
import { NotFoundError, ForbiddenError } from '../lib/errors.js';

const TAG_REGEX = /#([a-zA-Z0-9\u4e00-\u9fa5_]+)/g;
const URL_REGEX = /https?:\/\//i;
const TAG_NAME_REGEX = /^[a-zA-Z0-9\u4e00-\u9fa5_]+$/;

const createMemoSchema = {
  body: {
    type: 'object',
    required: ['content'],
    properties: {
      content: { type: 'string', minLength: 1, maxLength: 10000 },
    },
  },
};

const listMemosSchema = {
  querystring: {
    type: 'object',
    properties: {
      page: { type: 'integer', minimum: 1, default: 1 },
      limit: { type: 'integer', minimum: 1, maximum: 100, default: 20 },
      tag: { type: 'string', maxLength: 100 },
      type: { type: 'string', enum: ['no_tag', 'has_image', 'has_link'] },
      keyword: { type: 'string', maxLength: 200 },
    },
  },
};

const deleteMemoSchema = {
  params: {
    type: 'object',
    required: ['id'],
    properties: {
      id: { type: 'string', minLength: 1, maxLength: 36 },
    },
  },
};

const trashSchema = {
  querystring: {
    type: 'object',
    properties: {
      page: { type: 'integer', minimum: 1, default: 1 },
      limit: { type: 'integer', minimum: 1, maximum: 100, default: 20 },
    },
  },
};

/**
 * 将 raw SQL 结果的 snake_case 字段转为 camelCase memo 对象
 */
function normalizeMemo(row) {
  return {
    id: row.id,
    userId: row.user_id ?? row.userId,
    content: row.content,
    hasImage: Boolean(row.has_image ?? row.hasImage),
    hasLink: Boolean(row.has_link ?? row.hasLink),
    deletedAt: row.deleted_at ?? row.deletedAt ?? null,
    createdAt: row.created_at ?? row.createdAt,
    updatedAt: row.updated_at ?? row.updatedAt,
  };
}

/**
 * 从 memo 列表中批量查询关联标签
 */
async function fetchTagsForMemos(memoIds) {
  if (memoIds.length === 0) return {};
  const rows = await db
    .select({
      memoId: memoTags.memoId,
      tagId: tags.id,
      tagName: tags.name,
    })
    .from(memoTags)
    .innerJoin(tags, eq(memoTags.tagId, tags.id))
    .where(inArray(memoTags.memoId, memoIds));

  const map = {};
  for (const row of rows) {
    if (!map[row.memoId]) map[row.memoId] = [];
    map[row.memoId].push({ id: row.tagId, name: row.tagName });
  }
  return map;
}

/**
 * 解析内容中的标签名（去重），并验证合法性
 */
function parseTagNames(content) {
  const names = new Set();
  for (const match of content.matchAll(TAG_REGEX)) {
    const name = match[1];
    if (TAG_NAME_REGEX.test(name)) names.add(name);
  }
  return [...names];
}

/**
 * 确保标签存在，返回 tagId（不存在则创建）
 */
async function upsertTag(userId, name) {
  const existing = await db
    .select({ id: tags.id })
    .from(tags)
    .where(and(eq(tags.userId, userId), eq(tags.name, name)))
    .limit(1);

  if (existing.length > 0) return existing[0].id;

  const [created] = await db
    .insert(tags)
    .values({ userId, name })
    .returning({ id: tags.id });
  return created.id;
}

async function memosRoutes(fastify) {
  // 静态路径必须在 /:id 前注册

  // GET /api/memos/stats
  fastify.get('/stats', { preHandler: [requireAuth] }, async (request) => {
    const userId = request.session.userId;

    const [row] = await db.all(sql`
      SELECT
        (SELECT COUNT(*) FROM memos WHERE user_id = ${userId} AND deleted_at IS NULL) AS totalMemos,
        (SELECT COUNT(DISTINCT mt.memo_id) FROM memo_tags mt
          JOIN memos m ON m.id = mt.memo_id
          WHERE m.user_id = ${userId} AND m.deleted_at IS NULL) AS taggedMemos,
        (SELECT COUNT(DISTINCT DATE(created_at)) FROM memos WHERE user_id = ${userId} AND deleted_at IS NULL) AS activeDays,
        (SELECT COUNT(*) FROM memos WHERE user_id = ${userId} AND deleted_at IS NOT NULL) AS trashCount
    `);

    return {
      data: {
        totalMemos: Number(row.totalMemos),
        taggedMemos: Number(row.taggedMemos),
        activeDays: Number(row.activeDays),
        trashCount: Number(row.trashCount),
      },
      message: '获取成功',
    };
  });

  // GET /api/memos/heatmap
  fastify.get('/heatmap', { preHandler: [requireAuth] }, async (request) => {
    const userId = request.session.userId;

    const rows = await db.all(sql`
      SELECT DATE(created_at) as date, COUNT(*) as count
      FROM memos
      WHERE user_id = ${userId} AND deleted_at IS NULL
        AND created_at >= date('now', '-90 days')
      GROUP BY DATE(created_at)
      ORDER BY date ASC
    `);

    return {
      data: rows.map((r) => ({ date: r.date, count: Number(r.count) })),
      message: '获取成功',
    };
  });

  // GET /api/memos/trash
  fastify.get('/trash', { preHandler: [requireAuth], schema: trashSchema }, async (request) => {
    const userId = request.session.userId;
    const { page = 1, limit = 20 } = request.query;
    const offset = (page - 1) * limit;

    const [countRow] = await db.all(sql`
      SELECT COUNT(*) as total FROM memos
      WHERE user_id = ${userId} AND deleted_at IS NOT NULL
    `);
    const total = Number(countRow.total);

    const items = await db
      .select()
      .from(memos)
      .where(and(eq(memos.userId, userId), isNotNull(memos.deletedAt)))
      .orderBy(sql`${memos.deletedAt} DESC`)
      .limit(limit)
      .offset(offset);

    const tagsMap = await fetchTagsForMemos(items.map((m) => m.id));

    return {
      data: {
        items: items.map((m) => ({ ...m, tags: tagsMap[m.id] ?? [] })),
        total,
        page,
        limit,
      },
      message: '获取成功',
    };
  });

  // GET /api/memos
  fastify.get('/', { preHandler: [requireAuth], schema: listMemosSchema }, async (request) => {
    const userId = request.session.userId;
    const { page = 1, limit = 20, tag, type, keyword } = request.query;
    const offset = (page - 1) * limit;

    // 构建基础查询：非删除 + 当前用户
    let baseWhere = sql`m.user_id = ${userId} AND m.deleted_at IS NULL`;

    if (type === 'has_image') {
      baseWhere = sql`${baseWhere} AND m.has_image = 1`;
    } else if (type === 'has_link') {
      baseWhere = sql`${baseWhere} AND m.has_link = 1`;
    } else if (type === 'no_tag') {
      baseWhere = sql`${baseWhere} AND NOT EXISTS (SELECT 1 FROM memo_tags mt WHERE mt.memo_id = m.id)`;
    }

    if (tag) {
      baseWhere = sql`${baseWhere} AND EXISTS (
        SELECT 1 FROM memo_tags mt JOIN tags t ON t.id = mt.tag_id
        WHERE mt.memo_id = m.id AND t.name = ${tag} AND t.user_id = ${userId}
      )`;
    }

    if (keyword) {
      const likeKeyword = `%${keyword}%`;
      baseWhere = sql`${baseWhere} AND m.content LIKE ${likeKeyword}`;
    }

    const [countRow] = await db.all(
      sql`SELECT COUNT(*) as total FROM memos m WHERE ${baseWhere}`,
    );
    const total = Number(countRow.total);

    const items = await db.all(
      sql`SELECT m.* FROM memos m WHERE ${baseWhere}
          ORDER BY m.created_at DESC
          LIMIT ${limit} OFFSET ${offset}`,
    );

    const normalized = items.map(normalizeMemo);
    const tagsMap = await fetchTagsForMemos(normalized.map((m) => m.id));

    return {
      data: {
        items: normalized.map((m) => ({ ...m, tags: tagsMap[m.id] ?? [] })),
        total,
        page,
        limit,
      },
      message: '获取成功',
    };
  });

  // POST /api/memos
  fastify.post('/', { preHandler: [requireAuth], schema: createMemoSchema }, async (request, reply) => {
    const userId = request.session.userId;
    const { content } = request.body;

    const hasLink = URL_REGEX.test(content);
    const tagNames = parseTagNames(content);

    const [memo] = await db
      .insert(memos)
      .values({ userId, content, hasLink })
      .returning();

    const memoTagList = [];
    for (const name of tagNames) {
      const tagId = await upsertTag(userId, name);
      await db
        .insert(memoTags)
        .values({ memoId: memo.id, tagId })
        .onConflictDoNothing();
      memoTagList.push({ id: tagId, name });
    }

    return reply.status(201).send({
      data: { ...memo, tags: memoTagList },
      message: '笔记已创建',
    });
  });

  // DELETE /api/memos/:id
  fastify.delete('/:id', { preHandler: [requireAuth], schema: deleteMemoSchema }, async (request, reply) => {
    const userId = request.session.userId;
    const { id } = request.params;

    const [memo] = await db
      .select()
      .from(memos)
      .where(and(eq(memos.id, id), isNull(memos.deletedAt)))
      .limit(1);

    if (!memo) throw new NotFoundError('笔记不存在');
    if (memo.userId !== userId) throw new ForbiddenError('无权操作此笔记');

    await db
      .update(memos)
      .set({ deletedAt: sql`(CURRENT_TIMESTAMP)` })
      .where(eq(memos.id, id));

    return reply.send({ data: null, message: '笔记已移入回收站' });
  });
}

export { memosRoutes };
