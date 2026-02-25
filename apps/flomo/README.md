# Flomo Clone (Next.js)

## 功能
- 注册/登录
- 创建/删除笔记
- 标签管理（自动聚合）
- 搜索过滤

## 快速开始

```bash
cd apps/flomo
cp .env.example .env
npm install
npm run db:generate
npm run db:migrate -- --name init
npm run dev
```

打开 http://localhost:3000
