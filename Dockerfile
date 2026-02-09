# ============================================
# OpenCode WebUI - Multi-stage Dockerfile
# ============================================
# 单容器部署：Nginx (前端) + OpenCode (后端)

# ---- Stage 1: 前端构建 ----
FROM node:22-alpine AS frontend-builder

WORKDIR /app

# 依赖缓存层
COPY package.json package-lock.json ./
RUN npm ci

# 构建前端 - API 地址指向同源 /api 前缀
COPY . .
ENV VITE_API_BASE_URL=/api
RUN npm run build

# ---- Stage 2: 运行时 ----
FROM ubuntu:24.04

# 避免交互式安装
ENV DEBIAN_FRONTEND=noninteractive

# 安装运行时依赖
RUN apt-get update && apt-get install -y --no-install-recommends \
    nginx \
    curl \
    ca-certificates \
    git \
    unzip \
    gnupg \
    sudo \
    && rm -rf /var/lib/apt/lists/*

# 安装 OpenCode
RUN curl -fsSL https://opencode.ai/install | bash

# 确认安装
RUN opencode --version || echo "opencode installed"

# 复制前端构建产物
COPY --from=frontend-builder /app/dist /usr/share/nginx/html

# 复制 nginx 配置
RUN rm -f /etc/nginx/sites-enabled/default
COPY docker/nginx.conf /etc/nginx/conf.d/opencode.conf

# 复制启动脚本
COPY docker/entrypoint.sh /entrypoint.sh
RUN chmod +x /entrypoint.sh

# 创建工作目录
RUN mkdir -p /workspace

# ---- 环境变量 ----
# LLM Provider API Keys - 用户在 docker-compose 中配置
# ANTHROPIC_API_KEY, OPENAI_API_KEY 等

# OpenCode 服务器配置
ENV OPENCODE_DISABLE_AUTOUPDATE=true
ENV OPENCODE_DISABLE_TERMINAL_TITLE=true

# 工作目录
ENV WORKSPACE=/workspace

# 暴露端口
EXPOSE 80

WORKDIR /workspace

ENTRYPOINT ["/entrypoint.sh"]
