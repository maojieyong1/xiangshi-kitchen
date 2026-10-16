#!/bin/bash
cd "$(dirname "$0")"

if [ ! -d node_modules ]; then
  echo "📦 首次运行,正在安装依赖..."
  npm install || { echo "❌ 依赖安装失败,请检查是否已安装 Node.js"; exit 1; }
fi

echo ""
echo "🚀 启动小厨房点餐系统..."
echo ""
node server/index.js
