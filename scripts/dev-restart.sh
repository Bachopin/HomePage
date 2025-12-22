#!/bin/bash

# 开发环境重启脚本
# 功能：关闭3001端口服务，清理缓存，重启开发服务器

set -e  # 遇到错误立即退出

echo "🚀 开始重启开发环境..."

# 颜色定义
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# 1. 关闭3001端口的进程
echo -e "${YELLOW}📡 检查并关闭3001端口进程...${NC}"
PID=$(lsof -ti:3001 2>/dev/null || echo "")
if [ ! -z "$PID" ]; then
    echo -e "${RED}🔪 发现3001端口进程 (PID: $PID)，正在关闭...${NC}"
    kill -9 $PID 2>/dev/null || true
    sleep 2
    echo -e "${GREEN}✅ 3001端口进程已关闭${NC}"
else
    echo -e "${GREEN}✅ 3001端口无活跃进程${NC}"
fi

# 2. 关闭其他可能的Node.js开发服务器
echo -e "${YELLOW}🔍 检查其他Node.js开发进程...${NC}"
NODE_PIDS=$(pgrep -f "next dev" 2>/dev/null || echo "")
if [ ! -z "$NODE_PIDS" ]; then
    echo -e "${RED}🔪 发现Next.js开发进程，正在关闭...${NC}"
    echo "$NODE_PIDS" | xargs kill -9 2>/dev/null || true
    sleep 2
    echo -e "${GREEN}✅ Next.js开发进程已关闭${NC}"
else
    echo -e "${GREEN}✅ 无其他Next.js开发进程${NC}"
fi

# 3. 清理Next.js缓存和构建文件
echo -e "${YELLOW}🧹 清理缓存和构建文件...${NC}"
if [ -d ".next" ]; then
    rm -rf .next
    echo -e "${GREEN}✅ 已删除 .next 目录${NC}"
fi

if [ -d "node_modules/.cache" ]; then
    rm -rf node_modules/.cache
    echo -e "${GREEN}✅ 已清理 node_modules 缓存${NC}"
fi

# 4. 清理npm缓存（可选）
echo -e "${YELLOW}🗑️  清理npm缓存...${NC}"
npm cache clean --force 2>/dev/null || true
echo -e "${GREEN}✅ npm缓存已清理${NC}"

# 5. 检查依赖是否需要更新
echo -e "${YELLOW}📦 检查依赖状态...${NC}"
if [ ! -d "node_modules" ] || [ ! -f "node_modules/.package-lock.json" ]; then
    echo -e "${BLUE}📥 安装依赖...${NC}"
    npm install
    echo -e "${GREEN}✅ 依赖安装完成${NC}"
else
    echo -e "${GREEN}✅ 依赖状态正常${NC}"
fi

# 6. 等待端口完全释放
echo -e "${YELLOW}⏳ 等待端口完全释放...${NC}"
sleep 3

# 7. 启动开发服务器
echo -e "${BLUE}🚀 启动开发服务器...${NC}"
echo -e "${GREEN}📍 服务将在以下地址启动:${NC}"
echo -e "   ${BLUE}本地:${NC} http://localhost:3001"
echo -e "   ${BLUE}网络:${NC} http://0.0.0.0:3001"
echo ""
echo -e "${YELLOW}💡 提示: 使用 Ctrl+C 停止服务器${NC}"
echo ""

# 启动开发服务器
npm run dev