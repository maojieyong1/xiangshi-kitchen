// 数据存储 - 基于 JSON 文件,零配置零编译
const fs = require('fs');
const path = require('path');

const DATA_DIR = path.join(__dirname, '..', 'data');
const DISHES_FILE = path.join(DATA_DIR, 'dishes.json');
const ORDERS_FILE = path.join(DATA_DIR, 'orders.json');
const SETTINGS_FILE = path.join(DATA_DIR, 'settings.json');

// 默认数据
const DEFAULT_DISHES = [
  { id: 'd1', name: '番茄炒蛋', category: '家常菜', price: 12, desc: '酸酸甜甜,家的味道', image: '🍳', available: true, recommend: true },
  { id: 'd2', name: '红烧肉', category: '家常菜', price: 28, desc: '入口即化,肥而不腻', image: '🥩', available: true, recommend: true },
  { id: 'd3', name: '宫保鸡丁', category: '家常菜', price: 22, desc: '麻辣鲜香,下饭神器', image: '🍗', available: true, recommend: false },
  { id: 'd4', name: '蛋炒饭', category: '主食', price: 10, desc: '粒粒分明,简单美味', image: '🍚', available: true, recommend: true },
  { id: 'd5', name: '番茄鸡蛋面', category: '主食', price: 12, desc: '暖胃首选', image: '🍜', available: true, recommend: false },
  { id: 'd6', name: '可乐', category: '饮料', price: 4, desc: '冰镇可乐', image: '🥤', available: true, recommend: false },
  { id: 'd7', name: '柠檬茶', category: '饮料', price: 8, desc: '自制柠檬茶', image: '🧋', available: true, recommend: true },
  { id: 'd8', name: '草莓蛋糕', category: '甜点', price: 18, desc: '相诗的最爱', image: '🍰', available: true, recommend: true },
  { id: 'd9', name: '冰淇淋', category: '甜点', price: 8, desc: '香草口味', image: '🍦', available: true, recommend: false }
];

const DEFAULT_SETTINGS = {
  shopName: '相诗的小厨房',
  shopSubtitle: '想吃什么,我做给你呀',
  adminPassword: 'love123',
  banner: '💗',
  notice: '相诗宝贝,今天想吃点什么?看上哪个直接点就好啦~',
  notifyWebhook: ''
};

function ensureData() {
  if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR, { recursive: true });
  if (!fs.existsSync(DISHES_FILE)) fs.writeFileSync(DISHES_FILE, JSON.stringify(DEFAULT_DISHES, null, 2));
  if (!fs.existsSync(ORDERS_FILE)) fs.writeFileSync(ORDERS_FILE, JSON.stringify([], null, 2));
  if (!fs.existsSync(SETTINGS_FILE)) fs.writeFileSync(SETTINGS_FILE, JSON.stringify(DEFAULT_SETTINGS, null, 2));
}

function readJSON(file) {
  try { return JSON.parse(fs.readFileSync(file, 'utf-8') || '[]'); }
  catch { return []; }
}

function writeJSON(file, data) {
  fs.writeFileSync(file, JSON.stringify(data, null, 2));
}

module.exports = {
  ensureData,
  getDishes: () => readJSON(DISHES_FILE),
  saveDishes: (d) => writeJSON(DISHES_FILE, d),
  getOrders: () => readJSON(ORDERS_FILE),
  saveOrders: (o) => writeJSON(ORDERS_FILE, o),
  getSettings: () => readJSON(SETTINGS_FILE).length === 0 ? DEFAULT_SETTINGS : readJSON(SETTINGS_FILE),
  saveSettings: (s) => writeJSON(SETTINGS_FILE, s)
};
