window.__ModuleLoader__.load({
  id: 'dsh-plugin-dashboard',
  factory(require) {
    const React = require('react');
    const h = React.createElement;
    let createPortal = null;
    try { createPortal = require('react-dom').createPortal; } catch (error) { createPortal = null; }
    const { useEffect, useState } = React;

    const API = '/api/plugin-dashboard';

    const TEXT = {
      zh: {
        'nav.label': '看板',
        'panel.title': '插件看板',
        'panel.sub': '下载 · 市场 · 反馈 · 迭代建议',
        'panel.updated': '更新于',
        'panel.refresh': '刷新数据',
        'panel.refreshing': '正在收集…',
        'panel.metrics': '每个插件',
        'panel.feedback': '最新反馈',
        'panel.suggestions': '今天可以做的事',
        'panel.agree': '同意',
        'panel.reject': '先不做',
        'panel.agreed': '已记下：按这条走',
        'panel.rejected': '已记下：这次不做',
        'panel.gate': '所有改动都等你点头。看板只提建议，不会自己改代码、发版。',
        'panel.empty': '还没有数据，点「刷新数据」跑一次收集。',
        'panel.x': 'X 渠道',
        'panel.followers': '关注者',
        'panel.watch': '监控帖子',
        'panel.week': '周下载',
        'panel.month': '月下载',
        'panel.stars': '星标',
        'panel.release': '发布下载',
        'panel.market': '市场',
        'panel.linked': '已关联',
        'panel.unlinked': '等抓取',
        'panel.newFeedback': '新反馈',
        'panel.none': '暂无',
        'panel.watchHint': '贴一条你发的插件帖子链接，之后每 15 分钟抓一次它的回复数',
        'panel.watchAdd': '添加',
        'panel.note': '每天收一次反馈，提一次建议；你同意才动。'
      },
      en: {
        'nav.label': 'Board',
        'panel.title': 'Plugin board',
        'panel.sub': 'Downloads · market · feedback · next steps',
        'panel.updated': 'updated',
        'panel.refresh': 'Refresh',
        'panel.refreshing': 'Collecting…',
        'panel.metrics': 'Each plugin',
        'panel.feedback': 'Recent feedback',
        'panel.suggestions': 'What to do today',
        'panel.agree': 'Do it',
        'panel.reject': 'Not now',
        'panel.agreed': 'Noted: go ahead',
        'panel.rejected': 'Noted: skip this one',
        'panel.gate': 'Nothing ships without your yes. The board only proposes — it never edits code or publishes.',
        'panel.empty': 'No data yet. Hit Refresh to run a collection.',
        'panel.x': 'X channel',
        'panel.followers': 'followers',
        'panel.watch': 'posts watched',
        'panel.week': 'week',
        'panel.month': 'month',
        'panel.stars': 'stars',
        'panel.release': 'release dl',
        'panel.market': 'market',
        'panel.linked': 'linked',
        'panel.unlinked': 'pending crawl',
        'panel.newFeedback': 'new',
        'panel.none': 'none',
        'panel.watchHint': 'Paste a link to one of your plugin posts; its reply count is polled every 15 min',
        'panel.watchAdd': 'Add',
        'panel.note': 'One collection and one proposal a day; nothing moves without your say.'
      }
    };

    const CSS = `
.dsh-dash-pill{display:flex;align-items:center;gap:8px;width:100%;padding:8px 10px;border-radius:10px;background:transparent;border:0;color:var(--dsw-alias-label-primary,#e6e7ea);font:inherit;font-size:13px;cursor:pointer;text-align:left;}
.dsh-dash-pill:hover{background:color-mix(in srgb,var(--dsw-alias-label-primary,#e6e7ea) 8%,transparent);}
.dsh-dash-pill svg{flex:none;opacity:.85;}
.dsh-dash-pill .dsh-dash-label{flex:1 1 auto;min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;}
.dsh-dash-dot{flex:none;min-width:18px;height:18px;padding:0 5px;border-radius:9px;display:inline-flex;align-items:center;justify-content:center;font-size:10px;font-variant-numeric:tabular-nums;color:#fff;background:var(--dsh-skin-accent,#4d6bfe);}
.dsh-dash-panel{position:fixed;left:16px;bottom:84px;width:min(720px,calc(100vw - 32px));max-height:min(70vh,640px);display:flex;flex-direction:column;border-radius:18px;overflow:hidden;
  background:color-mix(in srgb,var(--dsw-specific-sidebar-fill,#2b2c30) 40%,transparent);
  -webkit-backdrop-filter:var(--dsw-menu-backdrop-filter,blur(40px) saturate(150%));
  backdrop-filter:var(--dsw-menu-backdrop-filter,blur(40px) saturate(150%));
  border:1px solid color-mix(in srgb,var(--dsw-alias-label-primary,#fff) 12%,transparent);
  box-shadow:0 18px 48px rgba(0,0,0,.28);
  color:var(--dsw-alias-label-primary,#e6e7ea);
  font-size:13px;z-index:2147482000;}
@supports not ((backdrop-filter:blur(1px)) or (-webkit-backdrop-filter:blur(1px))){
  .dsh-dash-panel{background:var(--dsw-specific-menu,var(--dsw-alias-bg-overlay,#24272d));}
}
.dsh-dash-head{display:flex;align-items:baseline;gap:10px;padding:16px 18px 10px;}
.dsh-dash-title{font-size:15px;font-weight:600;}
.dsh-dash-sub{flex:1 1 auto;opacity:.55;font-size:11.5px;}
.dsh-dash-close{border:0;background:transparent;color:inherit;opacity:.5;cursor:pointer;font-size:16px;line-height:1;padding:2px 4px;}
.dsh-dash-close:hover{opacity:.9;}
.dsh-dash-body{overflow:auto;padding:0 18px 16px;}
.dsh-dash-section{margin-top:6px;padding-top:12px;border-top:1px solid color-mix(in srgb,var(--dsw-alias-label-primary,#fff) 9%,transparent);}
.dsh-dash-section:first-child{border-top:0;padding-top:2px;}
.dsh-dash-h{font-size:11px;letter-spacing:.04em;text-transform:uppercase;opacity:.45;margin:4px 0 8px;}
.dsh-dash-row{display:flex;align-items:center;gap:8px;flex-wrap:wrap;margin-bottom:8px;}
.dsh-dash-name{font-weight:600;margin-right:2px;}
.dsh-dash-cap{display:inline-flex;align-items:baseline;gap:5px;padding:4px 10px;border-radius:999px;font-size:11.5px;line-height:1.2;
  background:color-mix(in srgb,var(--dsw-alias-label-primary,#fff) 7%,transparent);
  border:1px solid color-mix(in srgb,var(--dsw-alias-label-primary,#fff) 10%,transparent);}
.dsh-dash-cap b{font-weight:600;font-variant-numeric:tabular-nums;}
.dsh-dash-cap span{opacity:.55;}
.dsh-dash-cap.is-up b{color:#4ade80;}
.dsh-dash-item{padding:9px 0;border-bottom:1px solid color-mix(in srgb,var(--dsw-alias-label-primary,#fff) 7%,transparent);}
.dsh-dash-item:last-child{border-bottom:0;}
.dsh-dash-item p{margin:0 0 4px;line-height:1.45;}
.dsh-dash-why{opacity:.6;font-size:11.5px;}
.dsh-dash-samples{margin:6px 0 0;padding-left:14px;opacity:.6;font-size:11.5px;}
.dsh-dash-actions{display:flex;gap:8px;margin-top:8px;}
.dsh-dash-btn{border-radius:999px;padding:5px 14px;font-size:12px;cursor:pointer;border:1px solid color-mix(in srgb,var(--dsw-alias-label-primary,#fff) 16%,transparent);background:transparent;color:inherit;}
.dsh-dash-btn.primary{border-color:transparent;background:var(--dsh-skin-accent,#4d6bfe);color:#fff;}
.dsh-dash-btn:disabled{opacity:.45;cursor:default;}
.dsh-dash-foot{display:flex;align-items:center;gap:10px;padding:10px 18px 14px;border-top:1px solid color-mix(in srgb,var(--dsw-alias-label-primary,#fff) 9%,transparent);}
.dsh-dash-gate{flex:1 1 auto;font-size:11px;opacity:.5;line-height:1.4;}
.dsh-dash-empty{opacity:.55;padding:14px 0;}
.dsh-dash-feed{font-size:12px;}
.dsh-dash-feed a{color:inherit;}
`;

    function localeOf(ctx) {
      try {
        const snapshot = ctx.locale.getSnapshot();
        const tag = snapshot?.locale || snapshot?.language || 'zh';
        return String(tag).toLowerCase().startsWith('en') ? 'en' : 'zh';
      } catch { return 'zh'; }
    }

    function IconBoard(props) {
      const size = (props && props.size) || 16;
      return h('svg', { width: size, height: size, viewBox: '0 0 16 16', fill: 'none', stroke: 'currentColor', strokeWidth: 1.35, strokeLinecap: 'round', strokeLinejoin: 'round' },
        h('rect', { x: 2, y: 2.5, width: 12, height: 11, rx: 2 }),
        h('path', { d: 'M2 6.2h12' }),
        h('path', { d: 'M5.4 9.2v2.4M8 8.2v3.4M10.6 9.8v1.8' }));
    }

    function fmt(value) {
      if (value == null) return '—';
      if (typeof value !== 'number') return String(value);
      if (value >= 10000) return `${(value / 1000).toFixed(1)}k`;
      return String(value);
    }

    function ago(iso) {
      if (!iso) return '—';
      const then = new Date(iso).getTime();
      if (!Number.isFinite(then)) return '—';
      const minutes = Math.max(0, Math.round((Date.now() - then) / 60000));
      if (minutes < 1) return '刚刚';
      if (minutes < 60) return `${minutes} 分钟前`;
      const hours = Math.round(minutes / 60);
      if (hours < 24) return `${hours} 小时前`;
      return `${Math.round(hours / 24)} 天前`;
    }

    function Capsule(props) {
      return h('span', { className: `dsh-dash-cap${props.up ? ' is-up' : ''}` },
        h('b', null, fmt(props.value)),
        h('span', null, props.label));
    }

    return {
      inject: ['slots', 'locale'],
      apply(ctx) {
        const lang = localeOf(ctx);
        const t = (key) => TEXT[lang][key] ?? key;
        const openState = { current: false };
        const listeners = new Set();
        const setOpen = (next) => {
          openState.current = next;
          for (const listener of listeners) listener(next);
        };
        const useOpen = () => {
          const [, force] = useState(0);
          useEffect(() => {
            const listener = () => force((value) => value + 1);
            listeners.add(listener);
            return () => listeners.delete(listener);
          }, []);
          return openState.current;
        };

        function QuickAction() {
          const open = useOpen();
          const [badge, setBadge] = useState(0);
          useEffect(() => {
            let alive = true;
            const load = () => {
              fetch(`${API}/summary`, { headers: { accept: 'application/json' } })
                .then((response) => response.json())
                .then((data) => {
                  if (!alive || !data?.ok) return;
                  const events = (data.events ?? []).filter((event) => Date.now() - new Date(event.at).getTime() < 86400000);
                  setBadge(events.length);
                })
                .catch(() => {});
            };
            load();
            const timer = setInterval(load, 120000);
            return () => { alive = false; clearInterval(timer); };
          }, []);
          return h('button', {
            className: 'dsh-dash-pill',
            title: t('panel.title'),
            onClick: () => setOpen(!open)
          },
            h(IconBoard, { size: 16 }),
            h('span', { className: 'dsh-dash-label' }, t('nav.label')),
            badge > 0 ? h('span', { className: 'dsh-dash-dot' }, badge > 99 ? '99+' : String(badge)) : null);
        }

        function Panel() {
          const open = useOpen();
          const [data, setData] = useState(null);
          const [busy, setBusy] = useState(false);
          const [note, setNote] = useState('');
          const [postUrl, setPostUrl] = useState('');

          const load = () => fetch(`${API}/summary`, { headers: { accept: 'application/json' } })
            .then((response) => response.json())
            .then((payload) => setData(payload))
            .catch(() => setData({ ok: false }));

          useEffect(() => {
            if (!open) return undefined;
            load();
            const timer = setInterval(load, 60000);
            return () => clearInterval(timer);
          }, [open]);

          if (!open) return null;

          const refresh = () => {
            setBusy(true);
            fetch(`${API}/refresh`, { method: 'POST', headers: { 'content-type': 'application/json' }, body: '{}' })
              .then((response) => response.json())
              .then(() => load())
              .catch(() => {})
              .finally(() => setBusy(false));
          };

          const watch = () => {
            const url = postUrl.trim();
            if (!url) return;
            setBusy(true);
            fetch(`${API}/watch`, {
              method: 'POST',
              headers: { 'content-type': 'application/json' },
              body: JSON.stringify({ url })
            })
              .then((response) => response.json())
              .then(() => { setPostUrl(''); load(); })
              .catch(() => {})
              .finally(() => setBusy(false));
          };

          const decide = (id, status) => {
            setNote(status === 'approved' ? t('panel.agreed') : t('panel.rejected'));
            fetch(`${API}/decide`, {
              method: 'POST',
              headers: { 'content-type': 'application/json' },
              body: JSON.stringify({ id, status })
            }).then(() => load()).catch(() => {});
          };

          const snapshot = data?.snapshot ?? null;
          const plugins = snapshot?.plugins ?? [];
          const events = (data?.events ?? []).slice(0, 6);
          const suggestions = (data?.suggestions ?? []).filter((item) => item.status === 'pending');

          const child = h('div', { className: 'dsh-dash-panel', role: 'dialog', 'aria-label': t('panel.title') },
            h('style', null, CSS),
            h('div', { className: 'dsh-dash-head' },
              h('span', { className: 'dsh-dash-title' }, t('panel.title')),
              h('span', { className: 'dsh-dash-sub' }, `${t('panel.sub')} · ${t('panel.updated')} ${ago(snapshot?.at)}`),
              h('button', { className: 'dsh-dash-close', onClick: () => setOpen(false), 'aria-label': 'close' }, '×')),
            h('div', { className: 'dsh-dash-body' },
              !data || data.ok === false
                ? h('div', { className: 'dsh-dash-empty' }, t('panel.empty'))
                : null,

              plugins.length
                ? h('div', { className: 'dsh-dash-section' },
                    h('div', { className: 'dsh-dash-h' }, t('panel.metrics')),
                    plugins.map((plugin) => h('div', { key: plugin.id, className: 'dsh-dash-row' },
                      h('span', { className: 'dsh-dash-name' }, (plugin.name && (plugin.name[lang] || plugin.name.en)) || plugin.id),
                      h(Capsule, { label: t('panel.week'), value: plugin.npm?.week, up: (plugin.delta?.week ?? 0) > 0 }),
                      h(Capsule, { label: t('panel.month'), value: plugin.npm?.month }),
                      h(Capsule, { label: t('panel.stars'), value: plugin.github?.stars, up: (plugin.delta?.stars ?? 0) > 0 }),
                      h(Capsule, { label: t('panel.release'), value: plugin.github?.releaseDownloads }),
                      h(Capsule, { label: t('panel.market'), value: plugin.market ? (plugin.market.npmLinked ? t('panel.linked') : t('panel.unlinked')) : '—' }),
                      h(Capsule, { label: 'v', value: plugin.npm?.version ?? '—' }))))
                : null,

              snapshot?.x
                ? h('div', { className: 'dsh-dash-section' },
                    h('div', { className: 'dsh-dash-h' }, t('panel.x')),
                    h('div', { className: 'dsh-dash-row' },
                      h('span', { className: 'dsh-dash-name' }, `@${snapshot.x.handle}`),
                      h(Capsule, { label: t('panel.followers'), value: snapshot.x.followers }),
                      h(Capsule, { label: t('panel.watch'), value: (snapshot.x.posts ?? []).length }),
                      (snapshot.x.posts ?? []).slice(0, 3).map((post) => h(Capsule, { key: post.id, label: t('panel.newFeedback'), value: post.replies }))),
                    h('div', { className: 'dsh-dash-row' },
                      h('input', {
                        className: 'dsh-dash-btn',
                        style: { flex: '1 1 260px', minWidth: 0, cursor: 'text', padding: '6px 12px' },
                        placeholder: t('panel.watchHint'),
                        value: postUrl,
                        onChange: (event) => setPostUrl(event.target.value),
                        onKeyDown: (event) => { if (event.key === 'Enter') watch(); }
                      }),
                      h('button', { className: 'dsh-dash-btn primary', disabled: busy || !postUrl.trim(), onClick: watch }, t('panel.watchAdd'))))
                : null,

              suggestions.length
                ? h('div', { className: 'dsh-dash-section' },
                    h('div', { className: 'dsh-dash-h' }, t('panel.suggestions')),
                    suggestions.map((item) => h('div', { key: item.id, className: 'dsh-dash-item' },
                      h('p', null, item.title),
                      h('div', { className: 'dsh-dash-why' }, `${item.why} — ${item.action}`),
                      (item.samples ?? []).length
                        ? h('ul', { className: 'dsh-dash-samples' }, item.samples.map((sample, index) => h('li', { key: index }, sample.text)))
                        : null,
                      h('div', { className: 'dsh-dash-actions' },
                        h('button', { className: 'dsh-dash-btn primary', onClick: () => decide(item.id, 'approved') }, t('panel.agree')),
                        h('button', { className: 'dsh-dash-btn', onClick: () => decide(item.id, 'rejected') }, t('panel.reject'))))))
                : null,

              events.length
                ? h('div', { className: 'dsh-dash-section' },
                    h('div', { className: 'dsh-dash-h' }, t('panel.feedback')),
                    events.map((event, index) => h('div', { key: index, className: 'dsh-dash-item dsh-dash-feed' },
                      h('p', null, event.url ? h('a', { href: event.url, target: '_blank', rel: 'noreferrer' }, event.text) : event.text),
                      h('div', { className: 'dsh-dash-why' }, `${event.source} · ${ago(event.at)}`))))
                : null),

            h('div', { className: 'dsh-dash-foot' },
              h('span', { className: 'dsh-dash-gate' }, note || t('panel.gate')),
              h('button', { className: 'dsh-dash-btn primary', disabled: busy, onClick: refresh }, busy ? t('panel.refreshing') : t('panel.refresh'))));

          return createPortal ? createPortal(child, document.body) : child;
        }

        ctx.slots.inject('sidebar.footer.action', () => ctx.slots.register({
          name: 'sidebar.footer.action',
          id: 'plugin-dashboard-quick',
          order: 7,
          label: () => t('nav.label')
        }, QuickAction));

        ctx.slots.inject('shell.overlay', () => ctx.slots.register({
          name: 'shell.overlay',
          id: 'plugin-dashboard-panel',
          order: 61
        }, Panel));
      }
    };
  }
});
