#!/bin/bash
# 验证 Bug #40: 注册接口不再返回 500（数据库表已自动创建）

# 假设后端运行在 http://localhost:3000
API_URL="${API_URL:-http://localhost:3000}"

# 生成随机测试邮箱避免冲突
TEST_EMAIL="test_$(date +%s)@example.com"

# 调用注册接口
RESPONSE=$(curl -s -w "\n%{http_code}" -X POST "${API_URL}/api/auth/register" \
  -H "Content-Type: application/json" \
  -d "{\"email\":\"${TEST_EMAIL}\",\"nickname\":\"Test User\",\"password\":\"123456\",\"agreePolicy\":true}")

# 提取状态码（最后一行）
HTTP_CODE=$(echo "$RESPONSE" | tail -n1)
BODY=$(echo "$RESPONSE" | head -n-1)

# 验证：应该返回 201（成功）或 409（邮箱已存在），而不是 500（内部错误）
if [ "$HTTP_CODE" = "201" ]; then
  echo "✓ 注册成功，返回 201"
  exit 0
elif [ "$HTTP_CODE" = "409" ]; then
  echo "✓ 邮箱已存在，返回 409（符合预期）"
  exit 0
elif [ "$HTTP_CODE" = "500" ]; then
  echo "✗ 注册失败，返回 500（数据库表未创建）"
  echo "响应内容: $BODY"
  exit 1
else
  echo "✗ 预期外的状态码: $HTTP_CODE"
  echo "响应内容: $BODY"
  exit 1
fi
