// 旅行手帳 V1.0
const APP = 'trip-app-V1.0';   // 之後改版：這裡和 index.html 的 APP_VERSION 一起改（例如 V1.1）
const TILES = 'trip-tiles';    // 離線地圖，改版也不用動，地圖才不會被清掉
const FONTS = 'trip-fonts';

self.addEventListener('install', e => {
  e.waitUntil(caches.open(APP).then(c => c.addAll(['./', './index.html'])).catch(() => {}));
  self.skipWaiting();
});

self.addEventListener('activate', e => {
  e.waitUntil((async () => {
    for (const k of await caches.keys()) if (![APP, TILES, FONTS].includes(k)) await caches.delete(k);
    await self.clients.claim();
  })());
});

self.addEventListener('fetch', e => {
  const req = e.request;
  if (req.method !== 'GET') return;
  const url = new URL(req.url);
  if (url.hostname.endsWith('basemaps.cartocdn.com')) return e.respondWith(tile(req));
  if (url.hostname === 'fonts.googleapis.com' || url.hostname === 'fonts.gstatic.com') return e.respondWith(cacheFirst(req, FONTS));
  if (url.origin === location.origin) return e.respondWith(shell(e));
  // 其他（天氣 API 等）直接走網路，不存
});

// 地圖：先找存好的，沒有才上網抓並存起來
async function tile(req) {
  const c = await caches.open(TILES);
  const hit = await c.match(req.url);
  if (hit) return hit;
  try {
    const r = await fetch(req.url, { mode: 'cors', credentials: 'omit' });
    if (r.ok) c.put(req.url, r.clone());
    return r;
  } catch (err) {
    try {
      const r = await fetch(req.url, { mode: 'no-cors' });
      c.put(req.url, r.clone());
      return r;
    } catch (err2) {
      return new Response('', { status: 504 });
    }
  }
}

async function cacheFirst(req, name) {
  const c = await caches.open(name);
  const hit = await c.match(req);
  if (hit) return hit;
  try {
    const r = await fetch(req);
    if (r.ok || r.type === 'opaque') c.put(req, r.clone());
    return r;
  } catch (err) {
    return new Response('', { status: 504 });
  }
}

// 網頁本身：先用存好的（秒開、省網路），背景偷偷更新
async function shell(e) {
  const c = await caches.open(APP);
  const hit = await c.match(e.request, { ignoreSearch: true });
  const net = fetch(e.request).then(r => { if (r.ok) c.put(e.request, r.clone()); return r; }).catch(() => null);
  if (hit) { e.waitUntil(net); return hit; }
  return (await net) || new Response('目前離線，請先連網打開一次', { status: 503, headers: { 'Content-Type': 'text/plain; charset=utf-8' } });
}