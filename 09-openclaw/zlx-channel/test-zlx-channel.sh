#!/bin/bash
# test-zlx-channel.sh - 测试 zlx-channel 集成

set -e

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
PACKAGE_DIR="$SCRIPT_DIR"
SERVER_PORT=3000
OPENCLAW_PORT=18789

echo "=== 测试 zlx-channel ==="

# 1. 先启动 Hono server（后台）
echo "[1/4] 启动 Hono server..."
cd "$PACKAGE_DIR"
pnpm dev &
SERVER_PID=$!
sleep 2

# 2. 检查 server 是否启动
if ! curl -s http://localhost:$SERVER_PORT/health > /dev/null; then
  echo "ERROR: Hono server 启动失败"
  kill $SERVER_PID 2>/dev/null || true
  exit 1
fi
echo "  Hono server 已启动 (PID: $SERVER_PID)"

# 3. 测试 webhook
echo "[2/4] 测试 webhook 接口..."
curl -s -X POST "http://localhost:$SERVER_PORT/webhook" \
  -H "Content-Type: application/json" \
  -d '{
    "text": "Hello from test",
    "conversation": {"id": "test-conv-1"},
    "senderId": "test-user",
    "senderName": "Test User"
  }' | jq .

# 4. 获取消息
echo "[3/4] 获取会话消息..."
curl -s "http://localhost:$SERVER_PORT/messages/test-conv-1" | jq .

# 5. 启动 openclaw（如果已安装）
echo "[4/4] 测试 openclaw 集成..."
if command -v openclaw &> /dev/null; then
  echo "  openclaw 已安装: $(openclaw --version)"
  echo "  启动 openclaw gateway..."
  openclaw gateway start --detach || true
  sleep 3
  echo "  检查 openclaw 状态..."
  curl -s "http://localhost:$OPENCLAW_PORT/health" | jq . || echo "  openclaw gateway 可能未响应"
else
  echo "  openclaw 未安装，跳过集成测试"
fi

echo ""
echo "=== 测试完成 ==="
echo "Hono server 仍在运行 (PID: $SERVER_PID)"
echo "停止 server: kill $SERVER_PID"

# 保持 server 运行，按 Ctrl+C 退出时关闭
wait $SERVER_PID