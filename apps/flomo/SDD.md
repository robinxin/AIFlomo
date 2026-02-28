# Software Design Document — Flomo Clone

## 1. 目标
- 复刻 flomo 核心体验：快速记录、标签组织、搜索
- 最小功能：注册/登录、笔记 CRUD、标签、搜索
- 单体全栈：Next.js App Router + Prisma + SQLite

## 2. 架构
- 前端：Next.js（App Router）
- 后端：Next.js Route Handlers (API)
- 数据：SQLite + Prisma
- 认证：Session Cookie

## 3. 数据模型
- User(id, email, passwordHash, createdAt)
- Session(id, userId, token, expiresAt)
- Note(id, userId, title?, content, createdAt, updatedAt)
- Tag(id, userId, name)
- NoteTag(noteId, tagId)

## 4. API 契约
- POST /api/auth/register {email, password}
- POST /api/auth/login {email, password}
- POST /api/auth/logout
- GET /api/notes
- POST /api/notes {title?, content, tags[]}
- GET /api/notes/:id
- PATCH /api/notes/:id
- DELETE /api/notes/:id
- GET /api/tags
- GET /api/search?q=keyword

## 5. 页面
- /login
- /register
- /notes

## 6. 关键流程
- 登录后设置 session cookie
- 所有 /api/notes /api/tags /api/search 校验 session
- 标签自动 connectOrCreate

## 7. 风险与约束
- SQLite 仅用于单机开发，生产建议 Postgres
- Session 存储在数据库，过期清理按请求触发

## 8. 测试建议
- API：注册/登录/创建笔记/搜索
- UI：创建笔记、筛选标签、删除笔记
