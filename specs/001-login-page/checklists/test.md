# Requirements Quality Checklist: 账号密码登录

**Purpose**: 验证 spec.md 需求文档的完整性、清晰度和可测试性
**Created**: 2026-03-04
**Feature**: 001-login-page
**Depth**: Standard
**Audience**: PR Reviewer / QA
**Sources**: spec.md · contracts/auth-api.md · CLAUDE.md

---

## Requirement Completeness（需求完整性）

- [ ] CHK001 - 是否定义了 Session 过期时间（TTL）要求？[Gap]
- [ ] CHK002 - 是否定义了登录失败次数上限或防暴力破解要求？[Gap]
- [ ] CHK003 - 是否为登录表单定义了无障碍（a11y）要求？[Gap]
- [ ] CHK004 - 是否定义了登出成功后的跳转目标页面？[Completeness, Spec §3.1]
- [ ] CHK005 - 是否定义了后端服务不可用（5xx）时前端的降级处理要求？[Gap]
- [ ] CHK006 - 是否为 `/api/auth/logout` 接口定义了已登录态的前提校验要求？[Completeness, contracts/auth-api.md]

## Requirement Clarity（需求清晰度）

- [ ] CHK007 - "简洁风格" 是否以可测量的视觉属性（字号、间距、组件尺寸）定义？[Ambiguity, Spec §2.3]
- [ ] CHK008 - 加载中"禁止重复提交"的状态恢复条件（请求成功/失败后按钮何时再次可用）是否明确？[Ambiguity, Spec §2.3]
- [ ] CHK009 - "前端校验错误"的具体触发规则（空字段之外是否有其他规则）是否明确定义？[Ambiguity, Spec §2.3]
- [ ] CHK010 - "主应用占位页"的内容边界是否明确（需要展示什么、不需要展示什么）？[Ambiguity, Spec §2.1]
- [ ] CHK011 - 错误提示的展示位置（字段级别 vs 全局提示）是否在需求中指定？[Ambiguity, Spec §2.3]
- [ ] CHK012 - API Schema 中 `password` 字段是否定义了 `maxLength` 约束？[Clarity, contracts/auth-api.md]

## Requirement Consistency（需求一致性）

- [ ] CHK013 - CLAUDE.md 安全红线（`httpOnly`、`sameSite`、生产环境 `secure`）与 contracts/auth-api.md 中 Set-Cookie 示例是否一致？[Consistency, CLAUDE.md §Security, contracts/auth-api.md]
- [ ] CHK014 - contracts/auth-api.md 中所有接口响应格式是否与 CLAUDE.md 统一 API 响应格式 `{ data, message }` / `{ data: null, error, message }` 一致？[Consistency, CLAUDE.md §API格式]
- [ ] CHK015 - Spec §2.3 中"前端校验 + 后端返回"的错误提示是否在 contracts/auth-api.md 的 400/401 响应中均有对应定义？[Consistency, Spec §2.3, contracts/auth-api.md]

## Acceptance Criteria Quality（验收标准质量）

- [ ] CHK016 - 验收标准 AC #4（"刷新页面后保持登录状态"）是否定义了可客观验证的判断依据（如 Cookie 有效期、`/api/auth/me` 返回 200）？[Measurability, Spec §4]
- [ ] CHK017 - 验收标准 AC #5（"访问 `/login` 时已登录用户自动跳转"）是否明确指定了跳转目标路径？[Clarity, Spec §4]
- [ ] CHK018 - 验收标准 AC #6（"访问受保护路由时未登录用户跳转 `/login`"）是否定义了哪些路由属于"受保护路由"？[Clarity, Spec §4]
- [ ] CHK019 - 是否建立了验收标准与需求条目之间的可追溯映射（如 AC # → Spec §X.X）？[Traceability, Spec §4]

## Scenario Coverage（场景覆盖）

- [ ] CHK020 - 是否定义了网络超时或请求无响应时登录表单的行为要求？[Coverage, Gap]
- [ ] CHK021 - 是否定义了用户在请求进行中关闭/刷新页面的处理要求？[Coverage, Gap]
- [ ] CHK022 - 是否定义了多标签页同时登录同一账号的行为要求？[Coverage, Gap]
- [ ] CHK023 - `GET /api/auth/me` 返回 401 时"静默处理、不显示 Toast"的要求是否在 spec.md 中也有记录（目前仅在 contracts 中）？[Coverage, contracts/auth-api.md]

## Edge Case Coverage（边界场景覆盖）

- [ ] CHK024 - 是否定义了超长用户名或密码输入（超过 `maxLength`）时的前端交互行为？[Edge Case, Gap]
- [ ] CHK025 - 是否定义了用户名/密码包含特殊字符时的处理要求（前后端均需考虑）？[Edge Case, Gap]
- [ ] CHK026 - 是否定义了 Session 在使用过程中意外失效时的用户体验要求？[Edge Case, Gap]
- [ ] CHK027 - 是否定义了数据库种子（seed user）不存在时的降级行为？[Edge Case, Assumption, Spec §2.2]

## Non-Functional Requirements（非功能需求）

- [ ] CHK028 - 是否定义了登录接口的响应时间要求（如 P95 延迟）？[Gap, Performance]
- [ ] CHK029 - 是否定义了 CORS 白名单域名的具体值或管理规则？[Gap, Security, CLAUDE.md §Security]
- [ ] CHK030 - 是否定义了密码字段的最小长度要求（目前 spec §2.2 仅给出预置密码示例）？[Gap, Security]
- [ ] CHK031 - 是否为各平台（Web / Android / iOS）分别定义了响应式布局或适配要求？[Gap, UX]

## Dependencies & Assumptions（依赖与假设）

- [ ] CHK032 - "MVP 阶段内存 Session Store"的重启后 Session 丢失影响是否在 spec 中明确记录为已知限制？[Assumption, Spec §3.2]
- [ ] CHK033 - Expo Router 路由保护（`_layout.jsx`）依赖 `AuthContext` 状态的时序假设是否在 spec 或 plan 中明确？[Assumption, Spec §2.1]
- [ ] CHK034 - 是否记录了前端 API Client 的 `BASE_URL` 来源（环境变量 vs 硬编码），以及不同环境下的配置要求？[Dependency, Gap]
