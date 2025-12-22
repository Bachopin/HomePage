#!/bin/bash

# 颜色定义
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

PORT=3456

echo -e "${YELLOW}🔄 开始重启服务...${NC}\n"

# 1. 查找并清理占用端口的进程
echo -e "${YELLOW}📡 检查端口 ${PORT} 占用情况...${NC}"
PID=$(lsof -ti:${PORT})

if [ ! -z "$PID" ]; then
    echo -e "${RED}发现进程 ${PID} 占用端口 ${PORT}${NC}"
    echo -e "${YELLOW}正在终止进程...${NC}"
    kill -9 $PID
    sleep 1
    echo -e "${GREEN}✓ 端口已清理${NC}\n"
else
    echo -e "${GREEN}✓ 端口 ${PORT} 未被占用${NC}\n"
fi

# 2. 清理 Next.js 缓存
echo -e "${YELLOW}🧹 清理 Next.js 缓存...${NC}"
if [ -d ".next" ]; then
    rm -rf .next
    echo -e "${GREEN}✓ .next 目录已清理${NC}\n"
else
    echo -e "${GREEN}✓ 无需清理缓存${NC}\n"
fi

# 3. 重启开发服务器
echo -e "${GREEN}🚀 启动开发服务器 (端口: ${PORT})...${NC}\n"
echo -e "${YELLOW}================================================${NC}"
npm run dev
