# 💗 我们的小厨房 - 情侣点餐系统

给情侣用的轻量点餐系统:扫码即用、零配置、单命令启动。

## 🌟 特点

- **零配置**: 不需要数据库、不需要 Docker,一个 Node.js 就够
- **扫码即用**: 手机扫电脑二维码直接点餐
- **秒启动**: 1 秒开服务,JSON 文件存储,数据持久
- **双端**: 点餐页 + 管理后台,一个端口搞定
- **粉色系**: 给女朋友用,UI 必须好看
- **可分享**: 启动后给链接,女朋友扫码即可下单

## 📁 项目结构

```
couple-restaurant/
├── server/
│   ├── index.js      # Express 服务 + API 路由
│   └── db.js         # JSON 文件数据存储
├── public/
│   └── index.html    # 点餐端 (Vue3 CDN + Tailwind)
├── admin/
│   └── index.html    # 管理后台 (Vue3 CDN + Tailwind)
├── data/             # 自动生成的数据目录 (JSON)
├── package.json
├── start.bat         # Windows 启动
└── start.sh          # Mac/Linux 启动
```

## 🚀 三步启动

### 1. 确认环境

只需 [Node.js 14+](https://nodejs.org),无需数据库。

### 2. 启动服务

**Windows**: 双击 `start.bat`
**Mac/Linux**: `bash start.sh`
**手动**: `npm install && npm start`

### 3. 访问

启动后终端会打印地址,通常是:
- 点餐端: http://localhost:3000
- 管理后台: http://localhost:3000/admin
- 管理密码: `love123`

## 📱 让女朋友用上

### 方法 1: 同一 WiFi 下扫码

1. 电脑和女朋友手机连同一个 WiFi
2. 电脑上运行 `ipconfig` (Windows) 或 `ifconfig` (Mac),找到 IPv4 地址,例如 `192.168.1.100`
3. 手机浏览器输入 `http://192.168.1.100:3000` 即可点餐

### 方法 2: 用二维码工具

启动后访问点餐页,用微信扫一扫把链接发给女朋友即可。

### 方法 3: 内网穿透(异地恋)

如果不在同一网络,可以用 [cpolar](https://www.cpolar.com/)、[frp](https://github.com/fatedier/frp) 或 [ngrok](https://ngrok.com/) 把本地 3000 端口暴露到公网:

```bash
# 示例: 用 ngrok
ngrok http 3000
# 会得到一个公网链接,发给女朋友就行
```

## 🍔 功能列表

### 点餐端

- 今日推荐
- 分类筛选
- 加减购物车
- 下单(用餐人/桌号/备注)
- 查看订单状态

### 管理后台

- 订单列表: 查看、改状态(已下单 → 制作中 → 已完成)
- 菜品管理: 增删改查、上下架、推荐位
- 店铺设置: 店名、副标题、Logo emoji、公告、管理密码

## 🍳 内置示例菜品

启动后会自动生成 9 道示例菜(番茄炒蛋、红烧肉、宫保鸡丁、蛋炒饭、番茄鸡蛋面、可乐、柠檬茶、草莓蛋糕、冰淇淋),进管理后台可以改自己喜欢的。

## 🎨 定制建议

进后台「设置」页可以改:

- **店名**: 比如「老公的小厨房」
- **副标题**: 比如「想吃啥告诉我」
- **Logo emoji**: 🍳 🥘 🍰 💕 任选
- **公告**: 「今天的菜都是爱的味道」

## 📝 数据说明

- 所有数据存在项目根目录 `data/` 下,纯 JSON 文本
- 可以直接打开 `dishes.json`、`orders.json`、`settings.json` 编辑
- 想清空订单:删除 `data/orders.json`,重启服务即可

## ❓ 常见问题

**Q: 启动报错 `Cannot find module 'express'`?**
A: 先运行 `npm install` 安装依赖。

**Q: 手机打不开?**
A: 确认电脑和手机在同一个 WiFi,关闭电脑防火墙或开放 3000 端口。

**Q: 想部署到云端让异地女友用?**
A: 推荐 [Railway](https://railway.app) 或 [Render](https://render.com),上传代码一键部署。

## 📄 License

MIT - 拿去随便改,做给爱的人吃 💕
