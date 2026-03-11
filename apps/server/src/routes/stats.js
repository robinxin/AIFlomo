import { requireAuth } from '../plugins/auth.js';
import { db } from '../db/index.js';
import { memos, memoTags } from '../db/schema.js';
import { eq, and, isNull, isNotNull, count, countDistinct, sql } from 'drizzle-orm';

export async function statsRoutes(fastify) {
  fastify.get('/', { preHandler: [requireAuth] }, async (request, reply) => {
    const userId = request.session.userId;

    const ninetyDaysAgo = new Date();
    ninetyDaysAgo.setDate(ninetyDaysAgo.getDate() - 90);
    const ninetyDaysAgoStr = ninetyDaysAgo.toISOString().slice(0, 10);

    const [totalRow, taggedRow, daysRow, trashRow, heatmapRows] = await Promise.all([
      db
        .select({ total: count() })
        .from(memos)
        .where(and(eq(memos.userId, userId), isNull(memos.deletedAt)))
        .then((rows) => rows[0]),

      db
        .select({ tagged: countDistinct(memoTags.memoId) })
        .from(memoTags)
        .innerJoin(memos, eq(memoTags.memoId, memos.id))
        .where(and(eq(memos.userId, userId), isNull(memos.deletedAt)))
        .then((rows) => rows[0]),

      db
        .select({ days: countDistinct(sql`date(${memos.createdAt})`) })
        .from(memos)
        .where(and(eq(memos.userId, userId), isNull(memos.deletedAt)))
        .then((rows) => rows[0]),

      db
        .select({ trash: count() })
        .from(memos)
        .where(and(eq(memos.userId, userId), isNotNull(memos.deletedAt)))
        .then((rows) => rows[0]),

      db
        .select({
          day: sql`date(${memos.createdAt})`,
          count: count(),
        })
        .from(memos)
        .where(
          and(
            eq(memos.userId, userId),
            isNull(memos.deletedAt),
            sql`date(${memos.createdAt}) >= ${ninetyDaysAgoStr}`
          )
        )
        .groupBy(sql`date(${memos.createdAt})`)
        .orderBy(sql`date(${memos.createdAt})`),
    ]);

    return reply.send({
      data: {
        totalMemos: totalRow.total ?? 0,
        taggedMemos: taggedRow.tagged ?? 0,
        activeDays: daysRow.days ?? 0,
        trashCount: trashRow.trash ?? 0,
        heatmap: heatmapRows.map((row) => ({ day: row.day, count: row.count })),
      },
      message: 'ok',
    });
  });
}
