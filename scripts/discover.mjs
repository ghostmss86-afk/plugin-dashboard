/**
 * Discover the plugins this machine builds.
 *
 * The board used to need `data/registry.json` edited by hand every time a new
 * plugin existed. That does not scale: a plugin you forgot to register simply
 * never appears. This walks the workspace instead and treats any package with a
 * `dsh.bundle` manifest as a plugin worth a board.
 *
 * Output: data/plugins.json (discovered) — the collector merges it with the
 * manual overrides in data/registry.json.
 */
import { readdir, readFile, writeFile, mkdir } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import { join, basename, dirname } from 'node:path';
import { homedir } from 'node:os';
import { fileURLToPath } from 'node:url';

const HERE = dirname(fileURLToPath(import.meta.url));
const PKG = join(HERE, '..');
const DATA = process.env.DSH_DASHBOARD_DATA || join(homedir(), '.dsh', 'plugin-dashboard');

function repoOf(pkg) {
  const raw = typeof pkg.repository === 'string' ? pkg.repository : pkg.repository?.url;
  if (!raw) return null;
  const match = /github\.com[/:]([\w.-]+)\/([\w.-]+?)(?:\.git)?$/.exec(raw.replace(/^git\+/, ''));
  return match ? `${match[1]}/${match[2]}` : null;
}

function slugOf(pkg, dirName) {
  const repo = repoOf(pkg);
  if (repo) return repo;
  if (pkg.homepage) {
    const match = /github\.com\/([\w.-]+)\/([\w.-]+)/.exec(pkg.homepage);
    if (match) return `${match[1]}/${match[2]}`;
  }
  return dirName;
}

async function readPackage(dir) {
  try { return JSON.parse(await readFile(join(dir, 'package.json'), 'utf8')); } catch { return null; }
}

function iconOf(dir) {
  for (const name of ['icon-180.png', 'icon.svg', 'icon.png']) {
    if (existsSync(join(dir, name))) return join(dir, name);
  }
  return null;
}

async function scanRoot(root, owner) {
  const found = [];
  let entries = [];
  try { entries = await readdir(root, { withFileTypes: true }); } catch { return found; }
  for (const entry of entries) {
    if (!entry.isDirectory() || entry.name.startsWith('.')) continue;
    const dir = join(root, entry.name);
    const pkg = await readPackage(dir);
    if (!pkg || !pkg.dsh?.bundle) continue;
    // A board is for plugins you publish, not for every bundle-shaped folder
    // on the machine: private packages and repos under someone else's account
    // would just add noise (and a wrong download number).
    if (pkg.private) continue;
    if (String(pkg.name).startsWith('@local/')) continue;
    const candidate = pkgToEntry(pkg, dir, entry.name);
    if (!candidate.repo) continue;
    if (owner && !candidate.repo.toLowerCase().startsWith(`${owner.toLowerCase()}/`)) continue;
    found.push(candidate);
  }
  return found;
}

function pkgToEntry(pkg, dir, dirName) {
  const repo = repoOf(pkg);
  return {
    id: pkg.name,
    dir,
    npm: pkg.private ? null : pkg.name,
    version: pkg.version ?? null,
    category: pkg.dashboard?.category ?? pkg.dsh?.category ?? 'other',
    name: { zh: pkg.dashboard?.zh ?? pkg.description ?? pkg.name, en: pkg.dashboard?.en ?? pkg.description ?? pkg.name },
    repo,
    market: repo,
    icon: iconOf(dir),
    source: 'auto'
  };
}

async function main() {
  const registry = await readJson(join(DATA, 'registry.json'), {});
  const roots = process.env.DSH_DASHBOARD_SCAN
    ? process.env.DSH_DASHBOARD_SCAN.split(':')
    : [join(homedir(), 'Desktop', 'deepseekharness')];

  const owner = registry.owner ?? 'ghostmss86-afk';
  const found = [];
  for (const root of roots) found.push(...await scanRoot(root, owner));

  // The board itself is a plugin too — it just does not need a board about its
  // own downloads, so it is filtered by id.
  // Two folders can point at the same repo (a rename, or a manual entry with a
  // different id). Keep one board per repo, preferring the npm-named package.
  const unique = new Map();
  for (const entry of found.filter((item) => item.id !== pkgNameSelf())) {
    const key = (entry.repo ?? entry.id).toLowerCase();
    const previous = unique.get(key);
    if (!previous || (!previous.npm && entry.npm)) unique.set(key, entry);
  }
  const plugins = [...unique.values()];
  for (const override of registry.plugins ?? []) {
    const index = plugins.findIndex((entry) => entry.id === override.id);
    if (index >= 0) plugins[index] = { ...plugins[index], ...override, source: 'auto' };
    else plugins.push({ ...override, source: 'manual' });
  }

  await mkdir(DATA, { recursive: true });
  await writeFile(join(DATA, 'plugins.json'), `${JSON.stringify({ at: new Date().toISOString(), roots, plugins }, null, 2)}\n`);
  console.log(JSON.stringify({ discovered: plugins.map((plugin) => plugin.id) }));
}

async function readJson(path, fallback) {
  try { return JSON.parse(await readFile(path, 'utf8')); } catch { return fallback; }
}

function pkgNameSelf() {
  return 'dsh-plugin-dashboard';
}

main().catch((error) => { console.error('[dashboard] discover failed', error && error.message); process.exitCode = 1; });
