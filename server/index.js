const express = require('express');
const path = require('path');
const fs = require('fs');
const http = require('http');
const https = require('https');
const multer = require('multer');
const { nanoid } = require('nanoid');
const db = require('./db');

const app = express();
const PORT = process.env.PORT || 3000;

app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// 静态文件:点餐端
app.use(express.static(path.join(__dirname, '..', 'public')));
// 静态文件:管理后台
app.use('/admin', express.static(path.join(__dirname, '..', 'admin')));

// 上传目录
const UPLOAD_DIR = process.env.VERCEL ? path.join('/tmp', 'uploads') : path.join(__dirname, '..', 'public', 'uploads');
if (!fs.existsSync(UPLOAD_DIR)) fs.mkdirSync(UPLOAD_DIR, { recursive: true });

// multer 配置:菜品图片上传
const storage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, UPLOAD_DIR),
  filename: (req, file, cb) => {
    const ext = path.extname(file.originalname) || '.jpg';
    cb(null, 'dish-' + Date.now() + '-' + Math.random().toString(36).slice(2, 8) + ext);
  }
});
const upload = multer({
  storage,
  limits: { fileSize: 5 * 1024 * 1024 },
  fileFilter: (req, file, cb) => {
    const ok = /^image\/(jpe?g|png|gif|webp)$/.test(file.mimetype);
    cb(ok ? null : new Error('只支持 jpg/png/gif/webp 图片'), ok);
  }
});

// ============ 菜品 API ============
app.get('/api/dishes', (req, res) => {
  const dishes = db.getDishes();
  const { category } = req.query;
  let result = dishes;
  if (category && category !== '全部') {
    result = dishes.filter(d => d.category === category);
  }
  res.json({ code: 0, data: result });
});

app.get('/api/dishes/categories', (req, res) => {
  const dishes = db.getDishes();
  const categories = [...new Set(dishes.map(d => d.category))];
  res.json({ code: 0, data: ['全部', ...categories] });
});

app.get('/api/dishes/recommend', (req, res) => {
  const dishes = db.getDishes().filter(d => d.recommend && d.available);
  res.json({ code: 0, data: dishes });
});

// ============ 订单 API ============
app.post('/api/orders', (req, res) => {
  const { customerName, tableNo, items, remark, total } = req.body;
  if (!items || !items.length) {
    return res.json({ code: 1, msg: '购物车是空的哦~' });
  }
  const orders = db.getOrders();
  const order = {
    id: nanoid(8),
    customerName: customerName || '宝贝',
    tableNo: tableNo || '家里',
    items: items.map(it => ({
      id: it.id,
      name: it.name,
      price: it.price,
      qty: it.qty,
      image: it.image
    })),
    remark: remark || '',
    total: total || items.reduce((s, it) => s + it.price * it.qty, 0),
    status: 'pending', // pending / cooking / done / cancelled
    createdAt: new Date().toISOString()
  };
  orders.unshift(order);
  // 只保留最近 200 条订单
  db.saveOrders(orders.slice(0, 200));

  // 微信通知(异步发送,不阻塞响应)
  const settings = db.getSettings();
  if (settings.notifyWebhook) {
    const summary = order.items.map(it => `${it.image || ''} ${it.name} x${it.qty}`).join('\n');
    const content = `下单人: ${order.customerName}\n位置: ${order.tableNo}\n明细:\n${summary}\n合计: ${order.total}元${order.remark ? '\n备注: ' + order.remark : ''}`;
    sendNotify(settings.notifyWebhook, `新订单 ${order.total}元`, content);
  }

  res.json({ code: 0, data: order, msg: '相诗下单成功!马上给你做好吃的~' });
});

app.get('/api/orders', (req, res) => {
  const orders = db.getOrders();
  const { customerName, recent } = req.query;
  let result = orders;
  if (customerName) {
    result = orders.filter(o => o.customerName === customerName);
  }
  if (recent === '1') {
    result = orders.slice(0, 20);
  }
  res.json({ code: 0, data: result });
});

app.get('/api/orders/:id', (req, res) => {
  const order = db.getOrders().find(o => o.id === req.params.id);
  if (!order) return res.json({ code: 1, msg: '订单不存在' });
  res.json({ code: 0, data: order });
});

// ============ 设置 API ============
app.get('/api/settings', (req, res) => {
  res.json({ code: 0, data: db.getSettings() });
});

// ============ 管理后台 API (需要密码) ============
const ADMIN_TOKEN = 'couple-admin-' + nanoid(6);

function auth(req) {
  const token = req.headers['x-admin-token'] || req.query.token;
  return token === ADMIN_TOKEN;
}

app.post('/api/admin/login', (req, res) => {
  const { password } = req.body;
  const settings = db.getSettings();
  if (password === settings.adminPassword) {
    res.json({ code: 0, data: { token: ADMIN_TOKEN } });
  } else {
    res.json({ code: 1, msg: '密码不对哦~' });
  }
});

app.get('/api/admin/info', (req, res) => {
  const settings = db.getSettings();
  res.json({
    code: 0,
    data: {
      shopName: settings.shopName,
      shopSubtitle: settings.shopSubtitle,
      adminToken: ADMIN_TOKEN
    }
  });
});

// 菜品管理
app.post('/api/admin/dishes', (req, res) => {
  if (!auth(req)) return res.json({ code: 401, msg: '请先登录' });
  const dishes = db.getDishes();
  const { name, category, price, desc, image, available, recommend } = req.body;
  if (!name || price == null) return res.json({ code: 1, msg: '菜名和价格必填' });
  const dish = {
    id: 'd' + nanoid(6),
    name, category: category || '其他', price: Number(price),
    desc: desc || '', image: image || '🍽️',
    available: available !== false, recommend: recommend === true
  };
  dishes.push(dish);
  db.saveDishes(dishes);
  res.json({ code: 0, data: dish });
});

app.put('/api/admin/dishes/:id', (req, res) => {
  if (!auth(req)) return res.json({ code: 401, msg: '请先登录' });
  const dishes = db.getDishes();
  const idx = dishes.findIndex(d => d.id === req.params.id);
  if (idx < 0) return res.json({ code: 1, msg: '菜品不存在' });
  const update = { ...dishes[idx], ...req.body, id: dishes[idx].id };
  dishes[idx] = update;
  db.saveDishes(dishes);
  res.json({ code: 0, data: update });
});

app.delete('/api/admin/dishes/:id', (req, res) => {
  if (!auth(req)) return res.json({ code: 401, msg: '请先登录' });
  const dishes = db.getDishes().filter(d => d.id !== req.params.id);
  db.saveDishes(dishes);
  res.json({ code: 0, msg: '已删除' });
});

// 通用图片上传(返回路径,不绑定菜品)
app.post('/api/admin/upload', (req, res) => {
  if (!auth(req)) return res.json({ code: 401, msg: '请先登录' });
  upload.single('file')(req, res, (err) => {
    if (err) return res.json({ code: 1, msg: err.message || '上传失败' });
    if (!req.file) return res.json({ code: 1, msg: '请选择图片' });
    res.json({ code: 0, data: { image: '/uploads/' + req.file.filename } });
  });
});

// 订单管理
app.put('/api/admin/orders/:id/status', (req, res) => {
  if (!auth(req)) return res.json({ code: 401, msg: '请先登录' });
  const { status } = req.body;
  const orders = db.getOrders();
  const order = orders.find(o => o.id === req.params.id);
  if (!order) return res.json({ code: 1, msg: '订单不存在' });
  order.status = status;
  db.saveOrders(orders);
  res.json({ code: 0, data: order });
});

app.get('/api/admin/orders', (req, res) => {
  if (!auth(req)) return res.json({ code: 401, msg: '请先登录' });
  res.json({ code: 0, data: db.getOrders() });
});

app.delete('/api/admin/orders/:id', (req, res) => {
  if (!auth(req)) return res.json({ code: 401, msg: '请先登录' });
  const orders = db.getOrders().filter(o => o.id !== req.params.id);
  db.saveOrders(orders);
  res.json({ code: 0, msg: '已删除' });
});

// 设置管理
app.put('/api/admin/settings', (req, res) => {
  if (!auth(req)) return res.json({ code: 401, msg: '请先登录' });
  const settings = { ...db.getSettings(), ...req.body };
  db.saveSettings(settings);
  res.json({ code: 0, data: settings });
});

// 测试通知
app.post('/api/admin/settings/test-notify', (req, res) => {
  if (!auth(req)) return res.json({ code: 401, msg: '请先登录' });
  const settings = db.getSettings();
  if (!settings.notifyWebhook) return res.json({ code: 1, msg: '请先填写通知 Webhook' });
  sendNotify(settings.notifyWebhook, '测试通知', '这是来自小厨房的测试通知~收到说明配置成功!').then(ok => {
    res.json({ code: ok ? 0 : 1, msg: ok ? '已发送测试通知' : '发送失败,请检查 Webhook 地址' });
  });
});

// 统计
app.get('/api/admin/stats', (req, res) => {
  if (!auth(req)) return res.json({ code: 401, msg: '请先登录' });
  const orders = db.getOrders();
  const todayStr = new Date().toDateString();
  const todayOrders = orders.filter(o => new Date(o.createdAt).toDateString() === todayStr);

  const validOrders = orders.filter(o => o.status !== 'cancelled');
  const todayValid = todayOrders.filter(o => o.status !== 'cancelled');

  // 菜品销量
  const dishSales = {};
  validOrders.forEach(o => {
    o.items.forEach(it => {
      if (!dishSales[it.id]) dishSales[it.id] = { id: it.id, name: it.name, image: it.image, qty: 0, revenue: 0 };
      dishSales[it.id].qty += it.qty;
      dishSales[it.id].revenue += it.price * it.qty;
    });
  });
  const topDishes = Object.values(dishSales).sort((a, b) => b.qty - a.qty).slice(0, 10);

  // 状态统计
  const statusCount = { pending: 0, cooking: 0, done: 0, cancelled: 0 };
  orders.forEach(o => { if (statusCount[o.status] !== undefined) statusCount[o.status]++; });

  res.json({
    code: 0,
    data: {
      totalOrders: orders.length,
      totalRevenue: validOrders.reduce((s, o) => s + o.total, 0),
      todayOrders: todayOrders.length,
      todayRevenue: todayValid.reduce((s, o) => s + o.total, 0),
      statusCount,
      topDishes
    }
  });
});

// ============ 微信通知推送 ============
// 支持 Server酱 (https://sctapi.ftqq.com/{key}.send) 和 企业微信机器人
function sendNotify(webhook, title, content) {
  return new Promise((resolve) => {
    let url, body;
    try {
      url = new URL(webhook);
      if (webhook.includes('ftqq.com') || webhook.includes('sctapi')) {
        // Server酱格式
        body = JSON.stringify({ text: title, desp: content });
      } else {
        // 企业微信机器人格式
        body = JSON.stringify({ msgtype: 'text', text: { content: title + '\n\n' + content } });
      }
    } catch {
      resolve(false);
      return;
    }
    const mod = url.protocol === 'https:' ? https : http;
    const req = mod.request({
      hostname: url.hostname,
      port: url.port || (url.protocol === 'https:' ? 443 : 80),
      path: url.pathname + url.search,
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Content-Length': Buffer.byteLength(body) }
    }, (resp) => {
      let d = '';
      resp.on('data', c => d += c);
      resp.on('end', () => resolve(resp.statusCode >= 200 && resp.statusCode < 300));
    });
    req.on('error', () => resolve(false));
    req.write(body);
    req.end();
  });
}

// ============ 启动服务 ============
db.ensureData();

// 导出 app 供 Vercel serverless 使用
module.exports = app;

// 本地开发时启动服务
if (!process.env.VERCEL) {
  app.listen(PORT, '0.0.0.0', () => {
    const settings = db.getSettings();
    console.log('');
    console.log('  💗 ' + settings.shopName + ' 已开张!');
    console.log('  📝 ' + settings.shopSubtitle);
    console.log('');
    console.log('  📱 点餐端:    http://localhost:' + PORT);
    console.log('  🔧 管理后台:  http://localhost:' + PORT + '/admin');
    console.log('  🔑 默认管理密码: ' + settings.adminPassword);
    console.log('');
    console.log('  💡 提示: 手机扫码访问 http://你电脑IP:' + PORT);
    console.log('     电脑 IP 查询: ipconfig (Windows) / ifconfig (Mac/Linux)');
    console.log('');
  });
}
