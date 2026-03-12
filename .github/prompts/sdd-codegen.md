/tdd 读取 Spec 文件（`${SPEC_FILES}`）、技术方案文档（`${DESIGN_FILE}`），按 TDD 流程实现 Task ${TASK_INDEX} of ${TASK_COUNT}: **${TASK_NAME}**。

${TASK_DESC}

## 进度与结果输出要求

每进入新阶段前，先输出一行进度；每个阶段结束后，输出该阶段结果。格式如下：

**阶段进度（进入前输出）：**
- `▶ [Task ${TASK_INDEX}/${TASK_COUNT}] RED — 写测试文件`
- `▶ [Task ${TASK_INDEX}/${TASK_COUNT}] GREEN — 实现代码`
- `▶ [Task ${TASK_INDEX}/${TASK_COUNT}] DONE — 完成`

**阶段结果（完成后输出）：**
- 写完每个文件后：`WRITTEN: <文件路径>`

## 测试覆盖要求

测试用例须包含安全场景：SQL 注入、XSS、未授权访问、输入边界（空值、超长、特殊字符）。所有测试通过且覆盖率 ≥ 80% 后方可停止。

## 严禁事项
- **禁止向用户提问或等待确认** — 全程自主运行，遇到歧义以 spec 和技术方案为准
- 已完成任务写入的文件，严禁修改
${ALREADY}