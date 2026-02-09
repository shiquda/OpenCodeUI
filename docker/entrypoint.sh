#!/bin/bash
set -e

# ============================================
# OpenCode WebUI - Docker Entrypoint
# ============================================
# 在一个容器中同时运行：
# 1. OpenCode 后端 (opencode serve)
# 2. Nginx 前端静态文件 + 反向代理

echo "============================================"
echo "  OpenCode WebUI - Starting..."
echo "============================================"

# ---- 工作目录 ----
WORKSPACE="${WORKSPACE:-/workspace}"
mkdir -p "$WORKSPACE"

# ---- OpenCode 认证 ----
# 如果有密码保护，设置 OpenCode Server 密码
if [ -n "$OPENCODE_SERVER_PASSWORD" ]; then
    echo "[entrypoint] Server password protection enabled"
fi

# ---- 启动 OpenCode 后端 ----
echo "[entrypoint] Starting OpenCode backend on port 4096..."
cd "$WORKSPACE"

# 等待 opencode 可用
if ! command -v opencode &> /dev/null; then
    echo "[entrypoint] ERROR: opencode not found in PATH"
    exit 1
fi

echo "[entrypoint] OpenCode version: $(opencode --version 2>/dev/null || echo 'unknown')"

# 后台启动 opencode serve
opencode serve \
    --port 4096 \
    --hostname 0.0.0.0 \
    --cors "http://localhost:80" \
    --cors "http://127.0.0.1:80" \
    &

OPENCODE_PID=$!
echo "[entrypoint] OpenCode backend started (PID: $OPENCODE_PID)"

# 等待后端就绪
echo "[entrypoint] Waiting for OpenCode backend..."
for i in $(seq 1 30); do
    if curl -sf http://127.0.0.1:4096/global/health > /dev/null 2>&1; then
        echo "[entrypoint] OpenCode backend is ready!"
        break
    fi
    if [ $i -eq 30 ]; then
        echo "[entrypoint] WARNING: OpenCode backend did not become ready in 30s, starting nginx anyway"
    fi
    sleep 1
done

# ---- 启动 Nginx ----
echo "[entrypoint] Starting Nginx..."
nginx -g "daemon off;" &
NGINX_PID=$!
echo "[entrypoint] Nginx started (PID: $NGINX_PID)"

echo "============================================"
echo "  OpenCode WebUI is running!"
echo "  Web UI:  http://localhost:80"
echo "  API:     http://localhost:4096"
echo "============================================"

# ---- 信号处理 ----
cleanup() {
    echo "[entrypoint] Shutting down..."
    kill $NGINX_PID 2>/dev/null || true
    kill $OPENCODE_PID 2>/dev/null || true
    wait
    echo "[entrypoint] Shutdown complete"
    exit 0
}

trap cleanup SIGTERM SIGINT SIGQUIT

# 等待任一进程退出
wait -n $OPENCODE_PID $NGINX_PID
EXIT_CODE=$?

echo "[entrypoint] A process exited with code $EXIT_CODE, shutting down..."
cleanup
