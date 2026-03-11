/plan 读取 Spec 文件（`${SPEC_FILES}`）和技术方案文档（`${DESIGN_FILE}`），将功能拆分为有序的原子性实现任务，生成 Markdown 任务清单，使用 Write 工具写入 `${TASKS_FILE}`。
## 严禁事项
- **禁止生成 GitHub Actions / CI-CD 配置相关任务**（如修改 .yml workflow 文件等）
- **禁止生成 E2E 测试任务**（E2E 测试由独立的 testcase 流水线生成，与本环节无关）
- **禁止生成单元测试任务**（单元测试由 codegen 阶段自行处理）
- **禁止生成 git 提交、创建 PR、代码合并相关任务**（这是 workflow 基础设施的职责）
- **禁止生成部署、服务器配置、Nginx、pm2 相关任务**
- **禁止使用 TypeScript**
- **禁止新增 npm 包**