/**
 * Plugin dashboard — host side.
 *
 * Reads the collector's snapshot and exposes it to the panel. The collector
 * only observes (npm, GitHub, market, X); nothing here can publish a release
 * or edit another plugin, which is what keeps "每天给建议" from turning into
 * "自动改代码".
 *
 * Routes (all under /api/plugin-dashboard):
 *   GET  /summary   latest snapshot + feedback events + suggestions
 *   POST /refresh   run the collector now
 *   POST /decide    record approve/reject on one suggestion (no side effects)
 *   POST /feedback  attach a manual note (link + text) to the log
 *   GET  /icon      the plugin icon from its source folder (one board per icon)
 */
import { dirname, join } from 'node:path';
import { homedir } from 'node:os';
import { fileURLToPath } from 'node:url';
import { copyFile } from 'node:fs/promises';
import { readFile, writeFile, appendFile, mkdir } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import { spawn } from 'node:child_process';

const HERE = dirname(fileURLToPath(import.meta.url));
// Same rule as scripts/collect.mjs: user data under ~/.dsh, never inside the
// installed package (node_modules can be read-only).
const DATA = process.env.DSH_DASHBOARD_DATA || join(homedir(), '.dsh', 'plugin-dashboard');
const ROUTE_PREFIX = '/api/plugin-dashboard';
const POLL_MS = 15 * 60 * 1000;

function json(body, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'content-type': 'application/json; charset=utf-8', 'cache-control': 'no-store' }
  });
}

async function readJson(path, fallback) {
  try { return JSON.parse(await readFile(path, 'utf8')); } catch { return fallback; }
}

let collecting = false;

function collect() {
  if (collecting) return Promise.resolve({ ok: false, reason: 'busy' });
  collecting = true;
  return new Promise((resolve) => {
    const child = spawn(process.execPath, [join(HERE, 'scripts', 'collect.mjs')], { stdio: ['ignore', 'pipe', 'pipe'] });
    let output = '';
    child.stdout.on('data', (chunk) => { output += chunk; });
    child.stderr.on('data', (chunk) => { output += chunk; });
    child.on('close', (code) => {
      collecting = false;
      resolve({ ok: code === 0, code, output: output.slice(0, 2000) });
    });
    child.on('error', (error) => {
      collecting = false;
      resolve({ ok: false, code: -1, output: String(error && error.message) });
    });
  });
}

async function pluginIcon(id) {
  const registry = await readJson(join(DATA, 'registry.json'), {});
  const discovered = await readJson(join(DATA, 'plugins.json'), {});
  const catalogue = [...(discovered.plugins ?? []), ...(registry.plugins ?? [])];
  const entry = catalogue.find((item) => item.id === id);
  const icon = entry && entry.icon;
  if (!icon) return null;
  try {
    return { bytes: new Uint8Array(await readFile(icon)), type: icon.endsWith('.svg') ? 'image/svg+xml' : 'image/png' };
  } catch {
    return null;
  }
}

async function seedRegistry() {
  const target = join(DATA, 'registry.json');
  if (existsSync(target)) return;
  try {
    await mkdir(DATA, { recursive: true });
    await copyFile(join(HERE, 'data', 'registry.json'), target);
  } catch {}
}

async function handle(request) {
  const url = new URL(request.url);
  const suffix = url.pathname.slice(ROUTE_PREFIX.length) || '/summary';

  if (suffix === '/icon' && (request.method === 'GET' || request.method === 'HEAD')) {
    const icon = await pluginIcon(url.searchParams.get('id') ?? '');
    if (!icon) return new Response('no icon', { status: 404 });
    return new Response(request.method === 'HEAD' ? null : icon.bytes, {
      headers: { 'content-type': icon.type, 'cache-control': 'private, max-age=300' }
    });
  }

  if (suffix === '/summary' && (request.method === 'GET' || request.method === 'HEAD')) {
    const latest = await readJson(join(DATA, 'latest.json'), null);
    const registry = await readJson(join(DATA, 'registry.json'), { plugins: [], x: {} });
    if (!latest) return json({ ok: false, reason: 'no-snapshot', registry });
    return json({ ok: true, ...latest, registry });
  }

  if (suffix === '/refresh' && request.method === 'POST') {
    const result = await collect();
    const latest = await readJson(join(DATA, 'latest.json'), null);
    return json({ ok: result.ok, result, latest });
  }

  if (suffix === '/decide' && request.method === 'POST') {
    const body = await request.json().catch(() => null);
    const id = body?.id;
    const status = body?.status === 'approved' ? 'approved' : body?.status === 'rejected' ? 'rejected' : null;
    if (!id || !status) return json({ ok: false, reason: 'bad-request' }, 400);
    const file = join(DATA, 'suggestions.json');
    const store = await readJson(file, { items: [] });
    const items = (store.items ?? []).map((item) => item.id === id ? { ...item, status, decidedAt: new Date().toISOString() } : item);
    await writeFile(file, `${JSON.stringify({ ...store, items }, null, 2)}\n`);
    const latestFile = join(DATA, 'latest.json');
    const latest = await readJson(latestFile, null);
    if (latest) {
      latest.suggestions = items;
      await writeFile(latestFile, `${JSON.stringify(latest, null, 2)}\n`);
    }
    return json({ ok: true, items });
  }

  if (suffix === '/watch' && request.method === 'POST') {
    const body = await request.json().catch(() => null);
    const url = (body?.url ?? '').toString().trim();
    const id = /(?:status|statuses)\/(\d{5,25})/.exec(url)?.[1];
    if (!id) return json({ ok: false, reason: 'not-a-post-url' }, 400);
    const file = join(DATA, 'registry.json');
    const registry = await readJson(file, { x: { handle: '', posts: [] }, plugins: [] });
    registry.x = registry.x ?? { handle: '', posts: [] };
    const posts = new Set(registry.x.posts ?? []);
    posts.add(`https://x.com/${registry.x.handle || 'i'}/status/${id}`);
    registry.x.posts = [...posts].slice(-24);
    await writeFile(file, `${JSON.stringify(registry, null, 2)}\n`);
    await collect();
    const latest = await readJson(join(DATA, 'latest.json'), null);
    return json({ ok: true, latest });
  }

  if (suffix === '/feedback' && request.method === 'POST') {
    const body = await request.json().catch(() => null);
    const text = (body?.text ?? '').toString().trim();
    if (!text) return json({ ok: false, reason: 'empty' }, 400);
    const event = {
      at: new Date().toISOString(),
      source: body?.source === 'x' ? 'x' : 'manual',
      plugin: body?.plugin ?? 'dsh-skin-studio',
      kind: 'note',
      text: text.slice(0, 600),
      url: (body?.url ?? '').toString().slice(0, 500) || null
    };
    await appendFile(join(DATA, 'feedback.jsonl'), `${JSON.stringify(event)}\n`);
    const latestFile = join(DATA, 'latest.json');
    const latest = await readJson(latestFile, null);
    if (latest) {
      latest.events = [event, ...(latest.events ?? [])].slice(0, 200);
      await writeFile(latestFile, `${JSON.stringify(latest, null, 2)}\n`);
    }
    return json({ ok: true, event });
  }

  return json({ ok: false, reason: 'not-found' }, 404);
}

export function apply(ctx) {
  // Resolved up front: an early `return` inside the injection branch once left
  // this undefined and every route answered 500 (the same TDZ trap that broke
  // skin-studio's media routes in 1.0.34).
  let webServer;
  try {
    webServer = typeof ctx.get === 'function' ? ctx.get('webServer') : ctx.webServer;
  } catch {
    webServer = undefined;
  }

  const ROUTES = [
    ['/summary', ['GET', 'HEAD', 'OPTIONS']],
    ['/refresh', ['POST', 'OPTIONS']],
    ['/decide', ['POST', 'OPTIONS']],
    ['/watch', ['POST', 'OPTIONS']],
    ['/feedback', ['POST', 'OPTIONS']],
    ['/icon', ['GET', 'HEAD', 'OPTIONS']]
  ];

  const resource = (request) => handle(request);

  const registerWith = (register, effect) => {
    let count = 0;
    for (const [suffix, methods] of ROUTES) {
      const path = ROUTE_PREFIX + suffix;
      try {
        effect(() => register({ path, methods, requestBody: 'buffered', fetch: resource }), 'plugin-dashboard: ' + path);
        count += 1;
      } catch (error) {
        console.warn('[plugin-dashboard] route registration failed', path, error && error.message);
      }
    }
    console.log('[plugin-dashboard] routes registered', count, 'of', ROUTES.length);
  };

  if (typeof ctx.inject === 'function') {
    try {
      ctx.inject(['connection'], (scope) => {
        const fetch = scope.connection && scope.connection.fetch;
        if (!fetch || typeof fetch.register !== 'function') {
          console.warn('[plugin-dashboard] connection.fetch unavailable');
          return;
        }
        registerWith(fetch.register, (fn, label) => ctx.effect(fn, label));
      });
    } catch (error) {
      console.warn('[plugin-dashboard] connection.inject failed', error && error.message);
    }
  } else if (webServer && typeof webServer.register === 'function') {
    registerWith(webServer.register, (fn, label) => ctx.effect(fn, label));
  }

  // Daily-ish refresh: one immediate pass, then every 15 minutes. The panel
  // reads whatever the last pass wrote, so the button and the timer share one
  // code path.
  seedRegistry().catch(() => {});
  const tick = () => { collect().catch(() => {}); };
  ctx.effect(() => {
    const first = setTimeout(tick, 8000);
    const timer = setInterval(tick, POLL_MS);
    return () => { clearTimeout(first); clearInterval(timer); };
  }, 'plugin-dashboard: collector timer');
}

export const inject = [];
