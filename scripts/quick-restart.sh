#!/bin/bash

# 快速重启脚本 - 只清理端口并重启
PORT=3456

echo "🔄 快速重启服务..."

# 清理端口
PID=$(lsof -ti:${PORT} 2>/dev/null)
if [ ! -z "$PID" ]; then
    echo "终止进程 $PID..."
    kill -9 $PID
    sleep 1
fi

echo "🚀 启动服务 (端口: ${PORT})..."
npm run dev