import { db } from '../db/index.js';
import { attachments, memos } from '../db/schema.js';
import { eq, and, isNull } from 'drizzle-orm';
import { requireAuth } from '../plugins/auth.js';
import { NotFoundError } from '../lib/errors.js';
import { writeFile, mkdir } from 'fs/promises';
import { join, extname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = fileURLToPath(new URL('.', import.meta.url));
const UPLOADS_DIR = join(__dirname, '../../../../uploads');

const ALLOWED_MIME = new Set(['image/jpeg', 'image/png', 'image/gif', 'image/webp']);
const MAX_SIZE = 5 * 1024 * 1024; // 5MB

const MIME_TO_EXT = {
  'image/jpeg': '.jpg',
  'image/png': '.png',
  'image/gif': '.gif',
  'image/webp': '.webp',
};

async function attachmentsRoutes(fastify) {
  // POST /api/attachments/upload
  fastify.post('/upload', { preHandler: [requireAuth] }, async (request, reply) => {
    const userId = request.session.userId;

    const data = await request.file();
    if (!data) {
      return reply.status(400).send({ data: null, error: 'NO_FILE', message: '请上传文件' });
    }

    const mimeType = data.mimetype;
    if (!ALLOWED_MIME.has(mimeType)) {
      return reply.status(400).send({ data: null, error: 'INVALID_TYPE', message: '不支持的文件类型' });
    }

    // 读取文件内容并校验大小
    const chunks = [];
    for await (const chunk of data.file) {
      chunks.push(chunk);
    }
    const buffer = Buffer.concat(chunks);

    if (buffer.length > MAX_SIZE) {
      return reply.status(400).send({ data: null, error: 'FILE_TOO_LARGE', message: '文件大小超过 5MB 限制' });
    }

    // 获取 memoId 字段（fields 已在 file 之前或之后）
    const memoId = data.fields?.memoId?.value ?? null;

    // 验证 memoId 归属
    if (memoId) {
      const [memo] = await db
        .select({ id: memos.id })
        .from(memos)
        .where(and(eq(memos.id, memoId), eq(memos.userId, userId), isNull(memos.deletedAt)))
        .limit(1);
      if (!memo) throw new NotFoundError('关联笔记不存在');
    }

    // 生成唯一文件名
    const ext = MIME_TO_EXT[mimeType] || extname(data.filename);
    const filename = `${crypto.randomUUID()}${ext}`;
    const filePath = join(UPLOADS_DIR, filename);

    await mkdir(UPLOADS_DIR, { recursive: true });
    await writeFile(filePath, buffer);

    const url = `/uploads/${filename}`;

    const [attachment] = await db
      .insert(attachments)
      .values({
        memoId: memoId || crypto.randomUUID(), // 临时 id（无关联时），后续可关联
        userId,
        type: 'image',
        url,
        filename: data.filename,
        size: buffer.length,
      })
      .returning();

    // 更新 memo.has_image
    if (memoId) {
      await db.update(memos).set({ hasImage: true }).where(eq(memos.id, memoId));
    }

    return reply.status(201).send({
      data: {
        id: attachment.id,
        url: attachment.url,
        filename: attachment.filename,
        size: attachment.size,
      },
      message: '图片上传成功',
    });
  });
}

export { attachmentsRoutes };
