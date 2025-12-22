@echo off
chcp 65001 >nul
setlocal enabledelayedexpansion

echo 🚀 开始重启开发环境...
echo.

REM 1. 关闭3001端口的进程
echo 📡 检查并关闭3001端口进程...
for /f "tokens=5" %%a in ('netstat -aon ^| findstr :3001 ^| findstr LISTENING') do (
    echo 🔪 发现3001端口进程 (PID: %%a)，正在关闭...
    taskkill /F /PID %%a >nul 2>&1
    echo ✅ 3001端口进程已关闭
    goto :port_closed
)
echo ✅ 3001端口无活跃进程
:port_closed

REM 2. 关闭Node.js进程
echo 🔍 检查Node.js开发进程...
tasklist /FI "IMAGENAME eq node.exe" /FO CSV | findstr "node.exe" >nul
if !errorlevel! == 0 (
    echo 🔪 发现Node.js进程，正在关闭...
    taskkill /F /IM node.exe >nul 2>&1
    echo ✅ Node.js进程已关闭
) else (
    echo ✅ 无Node.js进程运行
)

REM 3. 清理缓存和构建文件
echo 🧹 清理缓存和构建文件...
if exist ".next" (
    rmdir /S /Q ".next" >nul 2>&1
    echo ✅ 已删除 .next 目录
)

if exist "node_modules\.cache" (
    rmdir /S /Q "node_modules\.cache" >nul 2>&1
    echo ✅ 已清理 node_modules 缓存
)

REM 4. 清理npm缓存
echo 🗑️ 清理npm缓存...
npm cache clean --force >nul 2>&1
echo ✅ npm缓存已清理

REM 5. 等待端口完全释放
echo ⏳ 等待端口完全释放...
timeout /t 3 /nobreak >nul

REM 6. 启动开发服务器
echo.
echo 🚀 启动开发服务器...
echo 📍 服务将在以下地址启动:
echo    本地: http://localhost:3001
echo    网络: http://0.0.0.0:3001
echo.
echo 💡 提示: 使用 Ctrl+C 停止服务器
echo.

npm run dev