#!/bin/bash
# 相诗的小厨房 - 一键部署脚本
# 用法: bash setup.sh
set -e

echo "🚀 开始部署相诗的小厨房..."

# 安装 Node.js
if ! command -v node &> /dev/null; then
  echo "📦 安装 Node.js 18..."
  if command -v apt &> /dev/null; then
    curl -fsSL https://deb.nodesource.com/setup_18.x | bash -
    apt install -y nodejs
  elif command -v yum &> /dev/null; then
    curl -fsSL https://rpm.nodesource.com/setup_18.x | bash -
    yum install -y nodejs
  else
    echo "❌ 不支持的系统,请手动安装 Node.js 16+"
    exit 1
  fi
fi

# 安装 git
if ! command -v git &> /dev/null; then
  if command -v apt &> /dev/null; then apt install -y git; fi
  if command -v yum &> /dev/null; then yum install -y git; fi
fi

# 克隆项目
INSTALL_DIR="/opt/xiangshi-kitchen"
if [ ! -d "$INSTALL_DIR" ]; then
  echo "📥 克隆代码..."
  git clone https://github.com/maojieyong1/xiangshi-kitchen.git "$INSTALL_DIR"
fi

cd "$INSTALL_DIR"
echo "📦 安装依赖..."
npm install --registry https://registry.npmmirror.com

# 安装 pm2 进程守护
npm install -g pm2 --registry https://registry.npmmirror.com 2>/dev/null || true

# 停止旧进程
pm2 delete xiangshi-kitchen 2>/dev/null || true

# 启动服务
pm2 start server/index.js --name xiangshi-kitchen
pm2 save
pm2 startup 2>/dev/null || true

SERVER_IP=$(curl -s ifconfig.me 2>/dev/null || echo "服务器IP")

echo ""
echo "✅ 部署完成!"
echo "📱 点餐端:    http://$SERVER_IP:3000"
echo "🔧 管理后台:  http://$SERVER_IP:3000/admin"
echo "🔑 管理密码:  love123"
echo ""
echo "💡 如需用 80 端口访问(不带 :3000),需要配置 nginx 反向代理"
