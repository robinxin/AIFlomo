import { sqliteTable, text, integer, uniqueIndex, index, primaryKey, check } from 'drizzle-orm/sqlite-core';
import { sql, relations } from 'drizzle-orm';

export const users = sqliteTable('users', {
  id: text('id')
    .primaryKey()
    .$defaultFn(() => crypto.randomUUID()),

  email: text('email').notNull().unique(),

  nickname: text('nickname').notNull().default(''),

  passwordHash: text('password_hash').notNull(),

  createdAt: text('created_at')
    .notNull()
    .default(sql`(strftime('%Y-%m-%dT%H:%M:%SZ', 'now'))`),
});

export const memos = sqliteTable(
  'memos',
  {
    id: text('id')
      .primaryKey()
      .$defaultFn(() => crypto.randomUUID()),

    content: text('content').notNull(),

    userId: text('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),

    hasImage: integer('has_image').notNull().default(0),

    hasLink: integer('has_link').notNull().default(0),

    deletedAt: text('deleted_at').default(null),

    createdAt: text('created_at')
      .notNull()
      .default(sql`(strftime('%Y-%m-%dT%H:%M:%SZ', 'now'))`),

    updatedAt: text('updated_at')
      .notNull()
      .default(sql`(strftime('%Y-%m-%dT%H:%M:%SZ', 'now'))`),
  },
  (table) => ({
    userIdIdx: index('memos_user_id_idx').on(table.userId),
    createdAtIdx: index('memos_created_at_idx').on(table.createdAt),
  })
);

export const tags = sqliteTable(
  'tags',
  {
    id: text('id')
      .primaryKey()
      .$defaultFn(() => crypto.randomUUID()),

    name: text('name').notNull(),

    userId: text('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),

    createdAt: text('created_at')
      .notNull()
      .default(sql`(strftime('%Y-%m-%dT%H:%M:%SZ', 'now'))`),
  },
  (table) => ({
    nameUserUnique: uniqueIndex('tags_name_user_idx').on(table.name, table.userId),
  })
);

export const memoTags = sqliteTable(
  'memo_tags',
  {
    memoId: text('memo_id')
      .notNull()
      .references(() => memos.id, { onDelete: 'cascade' }),

    tagId: text('tag_id')
      .notNull()
      .references(() => tags.id, { onDelete: 'cascade' }),
  },
  (table) => ({
    pk: primaryKey({ columns: [table.memoId, table.tagId] }),
  })
);

export const memoAttachments = sqliteTable(
  'memo_attachments',
  {
    id: text('id')
      .primaryKey()
      .$defaultFn(() => crypto.randomUUID()),

    memoId: text('memo_id')
      .notNull()
      .references(() => memos.id, { onDelete: 'cascade' }),

    type: text('type').notNull(),

    url: text('url').notNull(),

    createdAt: text('created_at')
      .notNull()
      .default(sql`(strftime('%Y-%m-%dT%H:%M:%SZ', 'now'))`),
  },
  (table) => ({
    typeCheck: check('memo_attachments_type_check', sql`${table.type} IN ('image', 'link')`),
  })
);

export const sessions = sqliteTable('sessions', {
  sid: text('sid').primaryKey(),
  sess: text('sess').notNull(),
  expired: text('expired').notNull(),
});

export const memosRelations = relations(memos, ({ many }) => ({
  memoTags: many(memoTags),
  attachments: many(memoAttachments),
}));

export const memoTagsRelations = relations(memoTags, ({ one }) => ({
  memo: one(memos, { fields: [memoTags.memoId], references: [memos.id] }),
  tag: one(tags, { fields: [memoTags.tagId], references: [tags.id] }),
}));

export const tagsRelations = relations(tags, ({ many }) => ({
  memoTags: many(memoTags),
}));

export const memoAttachmentsRelations = relations(memoAttachments, ({ one }) => ({
  memo: one(memos, { fields: [memoAttachments.memoId], references: [memos.id] }),
}));
