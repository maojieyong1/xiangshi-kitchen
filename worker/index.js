// 相诗的小厨房 - Cloudflare Worker
// 永久免费部署,数据存储在 KV 中

// ============ 默认数据 ============
const DEFAULT_DISHES = [
  { id: 'd1', name: '番茄炒蛋', category: '家常菜', price: 12, desc: '酸酸甜甜,家的味道', image: '🍳', available: true, recommend: true },
  { id: 'd2', name: '红烧肉', category: '家常菜', price: 28, desc: '入口即化,肥而不腻', image: '🥩', available: true, recommend: true },
  { id: 'd3', name: '宫保鸡丁', category: '家常菜', price: 22, desc: '麻辣鲜香,下饭神器', image: '🍗', available: true, recommend: false },
  { id: 'd4', name: '蛋炒饭', category: '主食', price: 10, desc: '粒粒分明,简单美味', image: '🍚', available: true, recommend: true },
  { id: 'd5', name: '番茄鸡蛋面', category: '主食', price: 12, desc: '暖胃首选', image: '🍜', available: true, recommend: false },
  { id: 'd6', name: '可乐', category: '饮料', price: 4, desc: '冰镇可乐', image: '🥤', available: true, recommend: false },
  { id: 'd7', name: '柠檬茶', category: '饮料', price: 8, desc: '自制柠檬茶', image: '🧋', available: true, recommend: true },
  { id: 'd8', name: '草莓蛋糕', category: '甜点', price: 18, desc: '女朋友最爱', image: '🍰', available: true, recommend: true },
  { id: 'd9', name: '冰淇淋', category: '甜点', price: 8, desc: '香草口味', image: '🍦', available: true, recommend: false }
];

const DEFAULT_SETTINGS = {
  shopName: '相诗的小厨房',
  shopSubtitle: '宝贝点你爱吃的,我去做',
  adminPassword: 'love123',
  banner: '💗',
  notice: '欢迎光临!今天也要好好吃饭哦~',
  notifyWebhook: ''
};

// ============ KV 存储助手 ============
async function getKV(env, key, defaultValue) {
  const value = await env.DATA.get(key);
  if (value) return JSON.parse(value);
  return defaultValue;
}

async function setKV(env, key, value) {
  await env.DATA.put(key, JSON.stringify(value));
}

async function ensureData(env) {
  if (!await env.DATA.get('dishes')) await setKV(env, 'dishes', DEFAULT_DISHES);
  if (!await env.DATA.get('orders')) await setKV(env, 'orders', []);
  if (!await env.DATA.get('settings')) await setKV(env, 'settings', DEFAULT_SETTINGS);
}

// ============ 工具函数 ============
function json(data, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: {
      'Content-Type': 'application/json; charset=utf-8',
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type, x-admin-token'
    }
  });
}

function genId(len = 8) {
  return Math.random().toString(36).slice(2, 2 + len);
}

function checkAuth(request, settings) {
  const token = request.headers.get('x-admin-token') || new URL(request.url).searchParams.get('token');
  return token === settings.adminPassword;
}

// ============ 微信通知 ============
async function sendNotification(order, settings) {
  if (!settings.notifyWebhook) return;
  const itemsText = order.items.map(it => `${it.name} ×${it.qty}`).join('\n');
  const content = `💗 相诗的小厨房 - 新订单!\n\n👤 下单人: ${order.customerName}\n📍 位置: ${order.tableNo}\n\n📋 菜品:\n${itemsText}\n\n💰 合计: ¥${order.total}\n📝 备注: ${order.remark || '无'}\n\n⏰ ${new Date(order.createdAt).toLocaleString('zh-CN')}`;

  const isServerChan = settings.notifyWebhook.includes('ftqq.com');
  const body = isServerChan
    ? JSON.stringify({ text: '新订单来了!', desp: content })
    : JSON.stringify({ msgtype: 'text', text: { content } });

  try {
    await fetch(settings.notifyWebhook, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body
    });
  } catch (e) {
    console.error('通知发送失败:', e);
  }
}

// ============ 主 Worker ============
export default {
  async fetch(request, env, ctx) {
    const url = new URL(request.url);
    const path = url.pathname;
    const method = request.method;

    // CORS 预检
    if (method === 'OPTIONS') {
      return new Response(null, {
        headers: {
          'Access-Control-Allow-Origin': '*',
          'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
          'Access-Control-Allow-Headers': 'Content-Type, x-admin-token'
        }
      });
    }

    // 确保数据存在
    await ensureData(env);

    // ========== 菜品 API ==========
    if (path === '/api/dishes' && method === 'GET') {
      const dishes = await getKV(env, 'dishes', DEFAULT_DISHES);
      const { category } = Object.fromEntries(url.searchParams);
      let result = dishes;
      if (category && category !== '全部') {
        result = dishes.filter(d => d.category === category);
      }
      return json({ code: 0, data: result });
    }

    if (path === '/api/dishes/categories' && method === 'GET') {
      const dishes = await getKV(env, 'dishes', DEFAULT_DISHES);
      const categories = [...new Set(dishes.map(d => d.category))];
      return json({ code: 0, data: ['全部', ...categories] });
    }

    if (path === '/api/dishes/recommend' && method === 'GET') {
      const dishes = await getKV(env, 'dishes', DEFAULT_DISHES);
      return json({ code: 0, data: dishes.filter(d => d.recommend && d.available) });
    }

    // ========== 订单 API ==========
    if (path === '/api/orders' && method === 'POST') {
      const body = await request.json();
      const { customerName, tableNo, items, remark, total } = body;
      if (!items || !items.length) {
        return json({ code: 1, msg: '购物车是空的哦~' });
      }
      const orders = await getKV(env, 'orders', []);
      const order = {
        id: genId(8),
        customerName: customerName || '宝贝',
        tableNo: tableNo || '家里',
        items: items.map(it => ({
          id: it.id, name: it.name, price: it.price, qty: it.qty, image: it.image
        })),
        remark: remark || '',
        total: total || items.reduce((s, it) => s + it.price * it.qty, 0),
        status: 'pending',
        createdAt: new Date().toISOString()
      };
      orders.unshift(order);
      await setKV(env, 'orders', orders.slice(0, 200));

      // 异步发送通知
      const settings = await getKV(env, 'settings', DEFAULT_SETTINGS);
      ctx.waitUntil(sendNotification(order, settings));

      return json({ code: 0, data: order, msg: '下单成功!等我把好吃的端上来~' });
    }

    if (path === '/api/orders' && method === 'GET') {
      const orders = await getKV(env, 'orders', []);
      const { customerName, recent } = Object.fromEntries(url.searchParams);
      let result = orders;
      if (customerName) result = orders.filter(o => o.customerName === customerName);
      if (recent === '1') result = orders.slice(0, 20);
      return json({ code: 0, data: result });
    }

    const orderMatch = path.match(/^\/api\/orders\/(.+)$/);
    if (orderMatch && method === 'GET') {
      const orders = await getKV(env, 'orders', []);
      const order = orders.find(o => o.id === orderMatch[1]);
      if (!order) return json({ code: 1, msg: '订单不存在' });
      return json({ code: 0, data: order });
    }

    // ========== 设置 API ==========
    if (path === '/api/settings' && method === 'GET') {
      const settings = await getKV(env, 'settings', DEFAULT_SETTINGS);
      // 不返回密码
      const { adminPassword, notifyWebhook, ...publicSettings } = settings;
      return json({ code: 0, data: publicSettings });
    }

    // ========== 管理后台 API ==========
    if (path === '/api/admin/login' && method === 'POST') {
      const body = await request.json();
      const settings = await getKV(env, 'settings', DEFAULT_SETTINGS);
      if (body.password === settings.adminPassword) {
        return json({ code: 0, data: { token: settings.adminPassword } });
      }
      return json({ code: 1, msg: '密码不对哦~' });
    }

    // 以下接口需要鉴权
    const settings = await getKV(env, 'settings', DEFAULT_SETTINGS);
    if (!checkAuth(request, settings)) {
      // 检查是否是管理接口
      if (path.startsWith('/api/admin/')) {
        return json({ code: 401, msg: '请先登录' });
      }
    }

    // 菜品管理
    if (path === '/api/admin/dishes' && method === 'POST') {
      const body = await request.json();
      const dishes = await getKV(env, 'dishes', DEFAULT_DISHES);
      const { name, category, price, desc, image, available, recommend } = body;
      if (!name || price == null) return json({ code: 1, msg: '菜名和价格必填' });
      const dish = {
        id: 'd' + genId(6), name, category: category || '其他', price: Number(price),
        desc: desc || '', image: image || '🍽️',
        available: available !== false, recommend: recommend === true
      };
      dishes.push(dish);
      await setKV(env, 'dishes', dishes);
      return json({ code: 0, data: dish });
    }

    const dishMatch = path.match(/^\/api\/admin\/dishes\/(.+)$/);
    if (dishMatch && method === 'PUT') {
      const dishes = await getKV(env, 'dishes', DEFAULT_DISHES);
      const idx = dishes.findIndex(d => d.id === dishMatch[1]);
      if (idx < 0) return json({ code: 1, msg: '菜品不存在' });
      const body = await request.json();
      dishes[idx] = { ...dishes[idx], ...body, id: dishes[idx].id };
      await setKV(env, 'dishes', dishes);
      return json({ code: 0, data: dishes[idx] });
    }

    if (dishMatch && method === 'DELETE') {
      const dishes = await getKV(env, 'dishes', DEFAULT_DISHES);
      await setKV(env, 'dishes', dishes.filter(d => d.id !== dishMatch[1]));
      return json({ code: 0, msg: '已删除' });
    }

    // 订单管理
    const statusMatch = path.match(/^\/api\/admin\/orders\/([^/]+)\/status$/);
    if (statusMatch && method === 'PUT') {
      const orders = await getKV(env, 'orders', []);
      const order = orders.find(o => o.id === statusMatch[1]);
      if (!order) return json({ code: 1, msg: '订单不存在' });
      const body = await request.json();
      order.status = body.status;
      await setKV(env, 'orders', orders);
      return json({ code: 0, data: order });
    }

    if (path === '/api/admin/orders' && method === 'GET') {
      const orders = await getKV(env, 'orders', []);
      return json({ code: 0, data: orders });
    }

    const delOrderMatch = path.match(/^\/api\/admin\/orders\/([^/]+)$/);
    if (delOrderMatch && method === 'DELETE') {
      const orders = await getKV(env, 'orders', []);
      await setKV(env, 'orders', orders.filter(o => o.id !== delOrderMatch[1]));
      return json({ code: 0, msg: '已删除' });
    }

    // 设置管理
    if (path === '/api/admin/settings' && method === 'PUT') {
      const body = await request.json();
      const newSettings = { ...settings, ...body };
      await setKV(env, 'settings', newSettings);
      return json({ code: 0, data: newSettings });
    }

    // 统计
    if (path === '/api/admin/stats' && method === 'GET') {
      const orders = await getKV(env, 'orders', []);
      const today = new Date().toLocaleDateString('zh-CN', { timeZone: 'Asia/Shanghai' });
      const todayOrders = orders.filter(o => {
        const d = new Date(o.createdAt);
        return d.toLocaleDateString('zh-CN', { timeZone: 'Asia/Shanghai' }) === today;
      });
      const validOrders = orders.filter(o => o.status !== 'cancelled');
      const dishSales = {};
      validOrders.forEach(o => {
        o.items.forEach(it => {
          dishSales[it.name] = (dishSales[it.name] || 0) + it.qty;
        });
      });
      const topDishes = Object.entries(dishSales)
        .sort((a, b) => b[1] - a[1])
        .slice(0, 10)
        .map(([name, count]) => ({ name, count }));
      const statusCount = { pending: 0, cooking: 0, done: 0, cancelled: 0 };
      orders.forEach(o => { statusCount[o.status] = (statusCount[o.status] || 0) + 1; });
      return json({
        code: 0,
        data: {
          totalOrders: orders.length,
          totalRevenue: validOrders.reduce((s, o) => s + o.total, 0),
          todayOrders: todayOrders.length,
          todayRevenue: todayOrders.filter(o => o.status !== 'cancelled').reduce((s, o) => s + o.total, 0),
          statusCount,
          topDishes
        }
      });
    }

    // 测试通知
    if (path === '/api/admin/test-notify' && method === 'POST') {
      if (!settings.notifyWebhook) {
        return json({ code: 1, msg: '请先在设置里填写通知 Webhook' });
      }
      const testOrder = {
        customerName: '测试', tableNo: '测试',
        items: [{ name: '测试菜品', qty: 1 }],
        total: 0, remark: '这是一条测试通知', createdAt: new Date().toISOString()
      };
      await sendNotification(testOrder, settings);
      return json({ code: 0, msg: '通知已发送,请检查微信' });
    }

    return json({ code: 404, msg: '接口不存在' }, 404);
  }
};
