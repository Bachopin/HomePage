#!/bin/bash

# 智能开发服务器启动脚本
# 功能：端口检测、自动清理、健康检查、自动重试

set -e

# 配置
PORT=3001
MAX_RETRIES=3
HEALTH_CHECK_TIMEOUT=30

# 颜色定义
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
PURPLE='\033[0;35m'
NC='\033[0m'

# 日志函数
log_info() { echo -e "${BLUE}ℹ️  $1${NC}"; }
log_success() { echo -e "${GREEN}✅ $1${NC}"; }
log_warning() { echo -e "${YELLOW}⚠️  $1${NC}"; }
log_error() { echo -e "${RED}❌ $1${NC}"; }
log_step() { echo -e "${PURPLE}🔄 $1${NC}"; }

# 检查端口是否被占用
check_port() {
    local port=$1
    if lsof -Pi :$port -sTCP:LISTEN -t >/dev/null 2>&1; then
        return 0  # 端口被占用
    else
        return 1  # 端口空闲
    fi
}

# 强制关闭端口进程
kill_port_process() {
    local port=$1
    local pids=$(lsof -ti:$port 2>/dev/null || echo "")
    
    if [ ! -z "$pids" ]; then
        log_warning "发现端口 $port 被进程占用: $pids"
        echo "$pids" | xargs kill -9 2>/dev/null || true
        sleep 2
        
        # 再次检查
        if check_port $port; then
            log_error "无法关闭端口 $port 上的进程"
            return 1
        else
            log_success "端口 $port 已释放"
            return 0
        fi
    else
        log_success "端口 $port 空闲"
        return 0
    fi
}

# 清理开发环境
clean_dev_env() {
    log_step "清理开发环境..."
    
    # 清理构建文件
    [ -d ".next" ] && rm -rf .next && log_success "已删除 .next 目录"
    [ -d "node_modules/.cache" ] && rm -rf node_modules/.cache && log_success "已清理 node_modules 缓存"
    
    # 清理npm缓存
    npm cache clean --force >/dev/null 2>&1 && log_success "npm缓存已清理"
    
    # 清理临时文件
    find . -name "*.log" -type f -delete 2>/dev/null || true
    find . -name ".DS_Store" -type f -delete 2>/dev/null || true
}

# 健康检查
health_check() {
    local port=$1
    local timeout=$2
    local url="http://localhost:$port"
    
    log_step "等待服务启动 (超时: ${timeout}s)..."
    
    for i in $(seq 1 $timeout); do
        if curl -s -f "$url" >/dev/null 2>&1; then
            log_success "服务健康检查通过！"
            return 0
        fi
        
        if [ $((i % 5)) -eq 0 ]; then
            log_info "等待中... (${i}/${timeout}s)"
        fi
        
        sleep 1
    done
    
    log_error "健康检查超时"
    return 1
}

# 启动开发服务器
start_dev_server() {
    local retry_count=0
    
    while [ $retry_count -lt $MAX_RETRIES ]; do
        log_step "启动开发服务器 (尝试 $((retry_count + 1))/$MAX_RETRIES)..."
        
        # 检查并清理端口
        if check_port $PORT; then
            if ! kill_port_process $PORT; then
                log_error "无法释放端口 $PORT"
                return 1
            fi
        fi
        
        # 清理环境
        clean_dev_env
        
        # 启动服务器（后台运行用于健康检查）
        log_info "在端口 $PORT 启动 Next.js 开发服务器..."
        npm run dev &
        local dev_pid=$!
        
        # 健康检查
        if health_check $PORT $HEALTH_CHECK_TIMEOUT; then
            # 健康检查通过，杀掉后台进程，重新前台启动
            kill $dev_pid 2>/dev/null || true
            wait $dev_pid 2>/dev/null || true
            
            log_success "开发服务器准备就绪！"
            echo ""
            log_info "📍 访问地址:"
            echo -e "   ${GREEN}本地:${NC} http://localhost:$PORT"
            echo -e "   ${GREEN}网络:${NC} http://0.0.0.0:$PORT"
            echo ""
            log_info "💡 使用 Ctrl+C 停止服务器"
            echo ""
            
            # 前台启动
            exec npm run dev
        else
            # 健康检查失败，清理进程
            kill $dev_pid 2>/dev/null || true
            wait $dev_pid 2>/dev/null || true
            
            retry_count=$((retry_count + 1))
            if [ $retry_count -lt $MAX_RETRIES ]; then
                log_warning "启动失败，准备重试..."
                sleep 3
            fi
        fi
    done
    
    log_error "开发服务器启动失败，已达到最大重试次数"
    return 1
}

# 主函数
main() {
    echo -e "${PURPLE}🚀 智能开发服务器启动脚本${NC}"
    echo -e "${BLUE}================================================${NC}"
    
    # 检查依赖
    if ! command -v npm >/dev/null 2>&1; then
        log_error "npm 未安装"
        exit 1
    fi
    
    if ! command -v curl >/dev/null 2>&1; then
        log_warning "curl 未安装，将跳过健康检查"
        HEALTH_CHECK_TIMEOUT=5  # 减少等待时间
    fi
    
    # 检查package.json
    if [ ! -f "package.json" ]; then
        log_error "未找到 package.json 文件"
        exit 1
    fi
    
    # 启动服务器
    start_dev_server
}

# 信号处理
trap 'log_info "正在停止服务器..."; exit 0' INT TERM

# 运行主函数
main "$@"