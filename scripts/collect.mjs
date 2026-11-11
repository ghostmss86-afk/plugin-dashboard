#!/usr/bin/env node
/**
 * Collect one snapshot: npm downloads, GitHub repo health, market placement and
 * X feedback for every plugin in data/registry.json.
 *
 * Everything is written under data/:
 *   latest.json            what the panel renders
 *   history/<date>.json    one file per calendar day (deltas come from here)
 *   feedback.jsonl         append-only event log (new replies, issues, manual notes)
 *   suggestions.json       proposals waiting for the owner's decision
 *
 * The collector never edits a plugin. It only observes and proposes.
 */
import { execFile } from 'node:child_process';
import { mkdir, readFile, writeFile, appendFile } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { homedir } from 'node:os';
import { fileURLToPath } from 'node:url';
import { copyFile } from 'node:fs/promises';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
// Snapshots live outside the package: an npm install puts this directory in a
// read-only node_modules tree, and a board's history is user data, not code.
const DATA = process.env.DSH_DASHBOARD_DATA || join(homedir(), '.dsh', 'plugin-dashboard');
const HISTORY = join(DATA, 'history');
const MARKET_CATALOG = 'https://awesome-dsh-plugin.com/catalog.json';
const X_MIRROR = 'https://api.fxtwitter.com';

const today = () => new Date().toISOString().slice(0, 10);
const now = () => new Date().toISOString();

async function readJson(path, fallback) {
  try { return JSON.parse(await readFile(path, 'utf8')); } catch { return fallback; }
}

function run(command, args) {
  return new Promise((resolve) => {
    execFile(command, args, { maxBuffer: 8 * 1024 * 1024 }, (error, stdout) => {
      resolve(error ? null : stdout);
    });
  });
}

async function getJson(url, headers = {}) {
  try {
    const response = await fetch(url, { headers: { 'user-agent': 'dsh-plugin-dashboard', ...headers }, signal: AbortSignal.timeout(20000) });
    if (!response.ok) return null;
    return await response.json();
  } catch { return null; }
}

async function npmStats(pkg) {
  if (!pkg) return null;
  const [week, month] = await Promise.all([
    getJson(`https://api.npmjs.org/downloads/point/last-week/${pkg}`),
    getJson(`https://api.npmjs.org/downloads/point/last-month/${pkg}`)
  ]);
  const meta = await getJson(`https://registry.npmjs.org/${pkg}`);
  return {
    package: pkg,
    week: week?.downloads ?? null,
    month: month?.downloads ?? null,
    version: meta?.['dist-tags']?.latest ?? null,
    published: meta?.time ? meta.time[meta['dist-tags']?.latest] ?? null : null
  };
}

async function githubStats(repo) {
  if (!repo) return null;
  const raw = await run('gh', ['api', `repos/${repo}`, '--jq', '{stars:.stargazers_count,forks:.forks_count,watchers:.subscribers_count,issues:.open_issues_count,pushed:.pushed_at}']);
  let base = null;
  if (raw) { try { base = JSON.parse(raw); } catch { base = null; } }
  if (!base) base = await getJson(`https://api.github.com/repos/${repo}`);
  const releasesRaw = await run('gh', ['api', `repos/${repo}/releases`, '--jq', '[.[]|{tag:.tag_name,at:.published_at,dl:([.assets[].download_count]|add // 0)}]']);
  let releases = null;
  if (releasesRaw) { try { releases = JSON.parse(releasesRaw); } catch { releases = null; } }
  if (!releases) releases = (await getJson(`https://api.github.com/repos/${repo}/releases`)) ?? [];
  const downloads = (releases ?? []).reduce((sum, item) => sum + (item.dl ?? 0), 0);
  return {
    repo,
    stars: base?.stars ?? base?.stargazers_count ?? null,
    forks: base?.forks ?? base?.forks_count ?? null,
    watchers: base?.watchers ?? base?.subscribers_count ?? null,
    openIssues: base?.issues ?? base?.open_issues_count ?? null,
    pushedAt: base?.pushed ?? base?.pushed_at ?? null,
    releases: (releases ?? []).slice(0, 8),
    releaseDownloads: downloads
  };
}

async function marketIndex() {
  const catalog = await getJson(MARKET_CATALOG);
  const items = catalog?.items ?? catalog ?? [];
  const map = new Map();
  for (const item of items) {
    if (item?.slug) map.set(item.slug, item);
  }
  return map;
}

function tweetId(url) {
  const match = /(?:status|statuses)\/(\d+)/.exec(url ?? '');
  return match ? match[1] : null;
}

async function xSnapshot(handle, posts = []) {
  if (!handle) return null;
  const profile = await getJson(`${X_MIRROR}/${handle}`);
  const user = profile?.user ?? null;
  const watched = [];
  for (const url of posts) {
    const id = tweetId(url);
    if (!id) continue;
    const tweet = await getJson(`${X_MIRROR}/${handle}/status/${id}`);
    const data = tweet?.tweet ?? null;
    if (!data) continue;
    watched.push({
      id,
      url,
      text: (data.text ?? '').slice(0, 280),
      at: data.created_at ?? null,
      replies: data.replies ?? null,
      likes: data.likes ?? null,
      reposts: data.reposts ?? null,
      views: data.views ?? null
    });
  }
  return {
    handle,
    followers: user?.followers ?? null,
    tweets: user?.tweets ?? null,
    posts: watched
  };
}

function diffPlugins(previous, current) {
  const before = new Map((previous?.plugins ?? []).map((item) => [item.id, item]));
  for (const plugin of current) {
    const old = before.get(plugin.id);
    plugin.delta = {
      week: old?.npm?.week != null && plugin.npm?.week != null ? plugin.npm.week - old.npm.week : null,
      month: old?.npm?.month != null && plugin.npm?.month != null ? plugin.npm.month - old.npm.month : null,
      stars: old?.github?.stars != null && plugin.github?.stars != null ? plugin.github.stars - old.github.stars : null,
      releaseDownloads: old?.github?.releaseDownloads != null && plugin.github?.releaseDownloads != null ? plugin.github.releaseDownloads - old.github.releaseDownloads : null
    };
  }
}

const SIGNALS = [
  { id: 'bug', words: ['崩溃', '闪退', '报错', '错误', 'bug', 'crash', 'error', '不能用', '失效', '没反应'], title: '有人在报故障', action: '先确认可复现路径，再决定是否进下一版' },
  { id: 'audio', words: ['没声音', '无声', '音轨', '音频', 'audio', 'muted'], title: '音频相关的反馈', action: '核对侧车生成与 ffmpeg 依赖提示' },
  { id: 'seek', words: ['进度', '拖动', '跳回', '回到开头', 'seek', '拖不动'], title: '进度/拖拽相关反馈', action: '对照 1.0.34 的 seekable 修复是否覆盖这个场景' },
  { id: 'look', words: ['好看', '喜欢', '漂亮', '赞', 'nice', 'love', 'great'], title: '正面评价，可以引用', action: '可进 README 的「用户怎么说」，或做转发素材' },
  { id: 'want', words: ['希望', '能不能', '建议', 'would be', 'feature', '支持'], title: '功能请求', action: '先判断是否是你想做的方向，再排优先级' },
  { id: 'market', words: ['市场', '下载', 'market', 'install', '安装', '装不上'], title: '安装/市场分发相关', action: '检查 npm 版本与市场条目是否同步' }
];

function buildSuggestions(events, snapshot) {
  const groups = new Map();
  for (const event of events) {
    const text = `${event.text ?? ''}`.toLowerCase();
    for (const signal of SIGNALS) {
      if (!signal.words.some((word) => text.includes(word.toLowerCase()))) continue;
      const key2 = `${event.plugin ?? 'all'}:${signal.id}`;
      const bucket = groups.get(key2) ?? { id: `sig-${event.plugin ?? 'all'}-${signal.id}`, plugin: event.plugin ?? 'all', title: signal.title, action: signal.action, count: 0, samples: [] };
      bucket.count += 1;
      if (bucket.samples.length < 3) bucket.samples.push({ text: (event.text ?? '').slice(0, 160), url: event.url ?? null, at: event.at ?? null });
      groups.set(key, bucket);
    }
  }
  const items = [];
  for (const bucket of groups.values()) {
    items.push({
      id: bucket.id,
      plugin: bucket.plugin,
      title: bucket.title,
      why: `${bucket.count} 条反馈命中「${bucket.id}」`,
      action: bucket.action,
      samples: bucket.samples,
      status: 'pending',
      at: now()
    });
  }
  for (const plugin of snapshot?.plugins ?? []) {
    if (groups.size) break;
    items.push({
      id: `sig-${plugin.id}-quiet`,
      plugin: plugin.id,
      title: '这一轮没有新的负面反馈',
      why: `近 7 天 npm 下载 ${plugin.npm?.week ?? '—'}，GitHub ★ ${plugin.github?.stars ?? '—'}，新增反馈 0 条`,
      action: '可以按自己的节奏做功能，不必赶修',
      samples: [],
      status: 'pending',
      at: now()
    });
  }
  return items;
}

async function main() {
  await mkdir(HISTORY, { recursive: true });
  // First run on a machine: seed the registry from the package default.
  const registryPath = join(DATA, 'registry.json');
  if (!existsSync(registryPath)) {
    try { await copyFile(join(ROOT, 'data', 'registry.json'), registryPath); } catch {}
  }
  const registry = await readJson(registryPath, { plugins: [], x: {} });
  const discovered = await readJson(join(DATA, 'plugins.json'), null);
  const previous = await readJson(join(DATA, 'latest.json'), null);
  const market = await marketIndex();

  // Discovery wins: a plugin that exists on disk gets a board without anyone
  // remembering to register it. Manual entries fill in what a package.json
  // cannot say (a Chinese display name, an X post list).
  const catalogue = (discovered?.plugins ?? []).map((entry) => ({ ...entry }));
  for (const entry of registry.plugins ?? []) {
    const index = catalogue.findIndex((item) => item.id === entry.id || (entry.repo && item.repo === entry.repo));
    if (index >= 0) catalogue[index] = { ...catalogue[index], ...entry };
    else if (entry.repo) catalogue.push({ ...entry, source: 'manual' });
  }

  const plugins = [];
  for (const entry of catalogue) {
    const [npm, github] = await Promise.all([npmStats(entry.npm), githubStats(entry.repo)]);
    const marketItem = entry.market ? market.get(entry.market) ?? null : null;
    plugins.push({
      id: entry.id,
      name: entry.name ?? { en: entry.id, zh: entry.id },
      category: entry.category ?? 'other',
      icon: entry.icon ?? null,
      source: entry.source ?? 'manual',
      npm,
      github,
      market: marketItem
        ? { dl: marketItem.dl ?? null, stars: marketItem.stars ?? null, npmLinked: Boolean(marketItem.npm), added: marketItem.added ?? null, url: `https://awesome-dsh-plugin.com/p/${marketItem.slug}/` }
        : null
    });
  }

  const xPosts = (registry.x?.posts ?? []).map((post) => (typeof post === 'string' ? { url: post, plugin: null } : post));
  const x = await xSnapshot(registry.x?.handle, xPosts.map((post) => post.url));
  (x?.posts ?? []).forEach((post, index) => { post.plugin = xPosts[index]?.plugin ?? null; });
  const snapshot = { at: now(), x, plugins };
  diffPlugins(previous?.snapshot ?? previous, plugins);

  const prevPosts = new Map((previous?.x?.posts ?? []).map((post) => [post.id, post]));
  const events = [];
  for (const post of x?.posts ?? []) {
    const old = prevPosts.get(post.id);
    if (old && post.replies != null && old.replies != null && post.replies > old.replies) {
      events.push({
        at: now(),
        source: 'x',
        plugin: post.plugin ?? plugins[0]?.id ?? 'unknown',
        kind: 'reply',
        text: `「${post.text.slice(0, 60)}」新增 ${post.replies - old.replies} 条回复（共 ${post.replies}）`,
        url: post.url
      });
    }
  }
  const prevIssues = new Map((previous?.plugins ?? []).map((plugin) => [plugin.id, plugin.github?.openIssues ?? null]));
  for (const plugin of plugins) {
    const before = prevIssues.get(plugin.id);
    const after = plugin.github?.openIssues ?? null;
    if (before == null || after == null || before === after) continue;
    events.push({
      at: now(),
      source: 'github',
      plugin: plugin.id,
      kind: after > before ? 'issue-open' : 'issue-close',
      text: after > before ? `GitHub 新增 issue（现存 ${after}）` : `GitHub issue 减少（现存 ${after}）`,
      url: `https://github.com/${plugin.github.repo}/issues`
    });
  }

  const history = await readJson(join(HISTORY, `${today()}.json`), { events: [] });
  if (events.length) {
    for (const event of events) await appendFile(join(DATA, 'feedback.jsonl'), `${JSON.stringify(event)}\n`);
  }
  const allEvents = [...(history.events ?? []), ...events];
  await writeFile(join(HISTORY, `${today()}.json`), `${JSON.stringify({ snapshot, events: allEvents }, null, 2)}\n`);

  const previousSuggestions = await readJson(join(DATA, 'suggestions.json'), { items: [] });
  const decided = new Map((previousSuggestions.items ?? []).map((item) => [item.id, item.status]));
  const fresh = buildSuggestions(allEvents, snapshot);
  const merged = fresh.map((item) => ({ ...item, status: decided.get(item.id) ?? 'pending' }));
  const decisions = (previousSuggestions.items ?? []).filter((item) => item.status !== 'pending' && !merged.some((next) => next.id === item.id));

  await writeFile(join(DATA, 'suggestions.json'), `${JSON.stringify({ at: now(), items: [...merged, ...decisions] }, null, 2)}\n`);
  await writeFile(join(DATA, 'latest.json'), `${JSON.stringify({ snapshot, events: allEvents, suggestions: [...merged, ...decisions] }, null, 2)}\n`);

  const reportLines = [
    `# 插件看板 · ${today()}`,
    '',
    `采集时间：${snapshot.at}`,
    '',
    '| 插件 | npm 周下载 | npm 月下载 | GitHub ★ | 发布下载 | 最新版本 | 市场 |',
    '| --- | --- | --- | --- | --- | --- | --- |'
  ];
  for (const plugin of plugins) {
    const market = plugin.market ? (plugin.market.npmLinked ? '已关联' : '等抓取') : '—';
    reportLines.push(`| ${plugin.name?.zh ?? plugin.id} | ${plugin.npm?.week ?? '—'} | ${plugin.npm?.month ?? '—'} | ${plugin.github?.stars ?? '—'} | ${plugin.github?.releaseDownloads ?? '—'} | ${plugin.npm?.version ?? '—'} | ${market} |`);
  }
  reportLines.push('', `## 反馈（今天新增 ${events.length} 条）`, '');
  if (events.length) {
    for (const event of events) reportLines.push(`- [${event.source}] ${event.text}${event.url ? ` — ${event.url}` : ''}`);
  } else {
    reportLines.push('- 今天没有新增反馈。');
  }
  reportLines.push('', '## 建议（等你确认，确认前不动代码）', '');
  for (const item of merged) {
    reportLines.push(`- **${item.title}** — ${item.why}；建议：${item.action}（状态：${item.status}）`);
  }
  reportLines.push('', `X：@${x?.handle ?? registry.x?.handle ?? '—'} · 关注者 ${x?.followers ?? '—'} · 监控帖子 ${(x?.posts ?? []).length} 条`, '');
  await mkdir(join(DATA, 'reports'), { recursive: true });
  await writeFile(join(DATA, 'reports', `${today()}.md`), reportLines.join('\n'));

  const summary = {
    at: snapshot.at,
    plugins: plugins.map((plugin) => ({
      id: plugin.id,
      npmWeek: plugin.npm?.week ?? null,
      stars: plugin.github?.stars ?? null,
      newFeedback: events.length
    })),
    x: x ? { handle: x.handle, followers: x.followers } : null
  };
  console.log(JSON.stringify(summary));
}

main().catch((error) => {
  console.error('[dashboard] collect failed', error && error.stack);
  process.exitCode = 1;
});
