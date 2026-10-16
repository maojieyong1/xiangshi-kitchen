@echo off
chcp 65001 >nul
cd /d "%~dp0"

if not exist node_modules (
  echo 📦 首次运行,正在安装依赖...
  call npm install
  if errorlevel 1 (
    echo ❌ 依赖安装失败,请检查是否已安装 Node.js (https://nodejs.org)
    pause
    exit /b 1
  )
)

echo.
echo 🚀 启动小厨房点餐系统...
echo.
node server/index.js
pause
