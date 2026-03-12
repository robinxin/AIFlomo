#!/bin/bash

# 配置变量（请根据实际情况修改或导出环境变量）
: "${TASKS_FILE:="tasks.md"}"
: "${MODEL:="claude-sonnet-4-5-20250929"}"

# 获取任务总数
TASK_COUNT=$(python3 -c "
import re
content = open('$TASKS_FILE').read()
print(len(re.findall(r'^- \[.\] T\d+', content, re.MULTILINE)))
" 2>/dev/null || echo "1")

echo "Total tasks: $TASK_COUNT"

for i in $(seq 1 "$TASK_COUNT"); do
  IDX=$((i - 1))

  # 1. 提取任务名称和状态
  TASK_INFO=$(python3 -c "
import re
content = open('$TASKS_FILE').read()
marks = re.findall(r'^- \[(.)\] T\d+ (.+)$', content, re.MULTILINE)
if $IDX < len(marks):
    status = 'completed' if marks[$IDX][0] == 'x' else 'pending'
    name = re.sub(r'\x60[^\x60]+\x60', '', marks[$IDX][1]).strip()[:80]
    print(f'{status}|{name}')
")

  STATUS=$(echo "$TASK_INFO" | cut -d'|' -f1)
  NAME=$(echo "$TASK_INFO" | cut -d'|' -f2)

  if [ "$STATUS" = "completed" ]; then
    echo "[$i/$TASK_COUNT] Skipping: $NAME (Already done)"
    continue
  fi

  echo "[$i/$TASK_COUNT] Running: $NAME"

  # 2. 准备 Prompt (假设环境中有对应的 envsubst.py)
  export TASK_INDEX="$i"
  export TASK_NAME="$NAME"
  PROMPT_TEXT=$(python3 .github/scripts/envsubst.py < .github/prompts/sdd-codegen.md)

  # 3. 执行任务并记录 JSON 流日志
  echo "--- Task $i: $NAME ---" >> log.txt
  
  claude \
    --print --dangerously-skip-permissions   \
    --verbose \
    --output-format stream-json \
    --dangerously-skip-permissions \
    --allowedTools "Read,Write,Edit,Task,Bash(ls:*),Bash(find:*),Bash(mkdir:*),Bash(pnpm:*)" \
    --model "$MODEL" \
    "$PROMPT_TEXT" >> log.txt 2>&1

  # 4. 更新任务状态为完成 (本地更新 tasks.md)
  python3 -c "
import re
with open('$TASKS_FILE', 'r') as f:
    content = f.read()
tids = re.findall(r'^- \[.\] (T\d+)', content, re.MULTILINE)
if $IDX < len(tids):
    tid = re.escape(tids[$IDX])
    content = re.sub(r'^(- )\[.\]( ' + tid + r')', r'\1[x]\2', content, count=1, flags=re.MULTILINE)
    with open('$TASKS_FILE', 'w') as f:
        f.write(content)
"
done
