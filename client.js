window.__ModuleLoader__.load({
  id: 'dsh-plugin-dashboard',
  factory(require) {
    const React = require('react');
    const h = React.createElement;
    let createPortal = null;
    try { createPortal = require('react-dom').createPortal; } catch (error) { createPortal = null; }
    const { useEffect, useRef, useState } = React;

    const API = '/api/plugin-dashboard';

    const TEXT = {
      zh: {
        'nav.label': '看板',
        'panel.title': '插件看板',
        'panel.sub': '一个插件一块板：下载 · 市场 · 反馈 · 下一步',
        'panel.updated': '更新于',
        'panel.refresh': '刷新',
        'panel.refreshing': '收集中…',
        'panel.week': '周下载',
        'panel.month': '月下载',
        'panel.stars': '星标',
        'panel.release': '发布下载',
        'panel.market': '市场',
        'panel.linked': '已关联',
        'panel.unlinked': '等抓取',
        'panel.feedback': '最新反馈',
        'panel.suggestions': '下一步',
        'panel.agree': '同意',
        'panel.reject': '先不做',
        'panel.agreed': '已记下：按这条走',
        'panel.rejected': '已记下：这次不做',
        'panel.gate': '看板只提建议，不会自己改代码、发版；动手前一定问你。',
        'panel.empty': '还没有数据。点「刷新」跑一次收集。',
        'panel.none': '这一轮没有新反馈',
        'panel.noSug': '暂时没有要做的事',
        'panel.x': 'X 渠道',
        'panel.followers': '关注者',
        'panel.watch': '监控帖',
        'panel.watchHint': '贴一条帖子的链接，之后每 15 分钟看一次它的回复数',
        'panel.watchAdd': '添加',
        'panel.version': '版本',
        'panel.local': '本机插件',
        'panel.esc': '点空白处或按 Esc 关闭'
      },
      en: {
        'nav.label': 'Board',
        'panel.title': 'Plugin board',
        'panel.sub': 'One board per plugin: downloads · market · feedback · next step',
        'panel.updated': 'updated',
        'panel.refresh': 'Refresh',
        'panel.refreshing': 'Collecting…',
        'panel.week': 'Week',
        'panel.month': 'Month',
        'panel.stars': 'Stars',
        'panel.release': 'Release DL',
        'panel.market': 'Market',
        'panel.linked': 'linked',
        'panel.unlinked': 'pending',
        'panel.feedback': 'Recent feedback',
        'panel.suggestions': 'Next step',
        'panel.agree': 'Do it',
        'panel.reject': 'Not now',
        'panel.agreed': 'Noted: go ahead',
        'panel.rejected': 'Noted: skip this one',
        'panel.gate': 'The board only proposes. It never edits code or publishes — it asks you first.',
        'panel.empty': 'No data yet. Hit Refresh to run a collection.',
        'panel.none': 'No new feedback this round',
        'panel.noSug': 'Nothing queued',
        'panel.x': 'X channel',
        'panel.followers': 'followers',
        'panel.watch': 'Watched',
        'panel.watchHint': 'Paste a post link; its reply count is checked every 15 minutes',
        'panel.watchAdd': 'Add',
        'panel.version': 'Version',
        'panel.local': 'Local plugin',
        'panel.esc': 'Click outside or press Esc to close'
      }
    };

    function useLocale() {
      const [locale, setLocale] = useState('zh');
      useEffect(() => {
        const read = () => {
          const raw = (document.documentElement.lang || navigator.language || 'zh').toLowerCase();
          setLocale(raw.startsWith('en') ? 'en' : 'zh');
        };
        read();
        const observer = new MutationObserver(read);
        observer.observe(document.documentElement, { attributes: true, attributeFilter: ['lang'] });
        return () => observer.disconnect();
      }, []);
      return locale;
    }

    const nf = (value) => {
      if (value === null || value === undefined) return '—';
      if (value >= 10000) return `${(value / 1000).toFixed(1)}k`;
      return String(value);
    };

    // A real icon file would be nicer, but the panel renders inside the app
    // origin where every extra fetch is one more quiet failure (it fell back to
    // letters twice). Draw the mark from the category instead: no request, no
    // broken-image state, same footprint as the app's own glyphs.
    function glyph(category) {
      const stroke = {
        fill: 'none',
        stroke: 'currentColor',
        strokeWidth: 1.4,
        strokeLinecap: 'round',
        strokeLinejoin: 'round'
      };
      if (category === 'market') {
        return h('svg', { viewBox: '0 0 16 16', width: 12, height: 12, 'aria-hidden': 'true' },
          h('rect', { x: 2.2, y: 2.2, width: 5, height: 5, rx: 1.4, ...stroke }),
          h('rect', { x: 8.8, y: 2.2, width: 5, height: 5, rx: 1.4, ...stroke }),
          h('rect', { x: 2.2, y: 8.8, width: 5, height: 5, rx: 1.4, ...stroke }),
          h('rect', { x: 8.8, y: 8.8, width: 5, height: 5, rx: 1.4, ...stroke }));
      }
      if (category === 'theme') {
        return h('svg', { viewBox: '0 0 16 16', width: 12, height: 12, 'aria-hidden': 'true' },
          h('path', { d: 'M8 2.6c2.1 2.3 3.4 3.9 3.4 5.6a3.4 3.4 0 0 1-6.8 0c0-1.7 1.3-3.3 3.4-5.6Z', ...stroke }),
          h('path', { d: 'M6.6 9.4a1.6 1.6 0 0 0 1.6 1.6', ...stroke }));
      }
      return h('svg', { viewBox: '0 0 16 16', width: 12, height: 12, 'aria-hidden': 'true' },
        h('path', { d: 'M8 2.4v11.2M2.4 8h11.2', ...stroke }));
    }

    function Avatar({ plugin, size = 22 }) {
      const [broken, setBroken] = useState(false);
      const label = (plugin.name?.zh || plugin.name?.en || plugin.id || '?').trim().slice(0, 1);
      const style = { width: size, height: size, borderRadius: Math.round(size / 3.4) };
      const src = plugin.iconData || (plugin.icon ? `${API}/icon?id=${encodeURIComponent(plugin.id)}` : '');
      if (src && !broken) {
        return h('span', { className: 'dsh-dash-av', style },
          h('img', {
            src,
            alt: '',
            onError: () => setBroken(true),
            draggable: false
          }));
      }
      return h('span', { className: `dsh-dash-av is-mark is-${plugin.category || 'other'}`, style },
        glyph(plugin.category),
        h('b', null, label));
    }

    function Cap({ label, value, tone }) {
      return h('div', { className: `dsh-dash-cap${tone ? ` is-${tone}` : ''}` },
        h('span', { className: 'k' }, label),
        h('b', { className: 'v' }, value));
    }

    function Board({ plugin, events, suggestions, t, onDecide }) {
      const npm = plugin.npm || {};
      const github = plugin.github || {};
      const releases = (github.releases || []).reduce((sum, item) => sum + (item.dl || 0), 0);
      const linked = Boolean(plugin.market && Number(plugin.market.npm) > 0);
      const mine = (suggestions || []).filter((item) => item.plugin === plugin.id && item.status === 'pending');
      const feedback = (events || []).filter((item) => item.plugin === plugin.id).slice(0, 4);

      return h('div', { className: 'dsh-dash-board' },
        h('div', { className: 'dsh-dash-caps' },
          h(Cap, { label: t('panel.week'), value: nf(npm.week) }),
          h(Cap, { label: t('panel.month'), value: nf(npm.month) }),
          h(Cap, { label: t('panel.stars'), value: nf(github.stars) }),
          h(Cap, { label: t('panel.release'), value: nf(releases || null) }),
          h(Cap, {
            label: t('panel.market'),
            value: linked ? t('panel.linked') : t('panel.unlinked'),
            tone: linked ? 'ok' : 'wait'
          }),
          h(Cap, { label: t('panel.version'), value: npm.version || '—' })
        ),
        h('div', { className: 'dsh-dash-cols' },
          h('section', { className: 'dsh-dash-sec' },
            h('h4', null, t('panel.feedback')),
            feedback.length
              ? feedback.map((item, index) => h('div', { key: `${item.source}-${index}`, className: 'dsh-dash-feed' },
                  h('span', { className: `dsh-dash-src is-${item.source}` }, item.source.toUpperCase()),
                  h('p', null, item.title || item.text || item.kind),
                  h('time', null, (item.at || '').slice(5, 16).replace('T', ' '))))
              : h('p', { className: 'dsh-dash-hint' }, t('panel.none'))),
          h('section', { className: 'dsh-dash-sec' },
            h('h4', null, t('panel.suggestions')),
            mine.length
              ? mine.slice(0, 2).map((item) => h('div', { key: item.id, className: 'dsh-dash-sug' },
                  h('b', null, item.title),
                  h('p', null, item.why),
                  h('em', null, item.action),
                  h('div', { className: 'dsh-dash-acts' },
                    h('button', { type: 'button', className: 'is-yes', onClick: () => onDecide(item.id, 'approved') }, t('panel.agree')),
                    h('button', { type: 'button', onClick: () => onDecide(item.id, 'rejected') }, t('panel.reject')))))
              : h('p', { className: 'dsh-dash-hint' }, t('panel.noSug')))
        )
      );
    }

    function Panel({ onClose }) {
      const [data, setData] = useState(null);
      const [tab, setTab] = useState(null);
      const [busy, setBusy] = useState(false);
      const [note, setNote] = useState('');
      const [draft, setDraft] = useState('');
      const panelRef = useRef(null);
      const locale = useLocale();
      const t = (key) => TEXT[locale][key] ?? key;

      const load = async () => {
        try {
          const reply = await fetch(`${API}/summary`);
          const body = await reply.json();
          setData(body);
        } catch { /* the panel stays on the empty state */ }
      };

      useEffect(() => { load(); }, []);

      // Clicking anywhere outside the sheet closes it, the same way the other
      // sidebar panels behave. Capture phase so a stopPropagation inside the
      // chat composer cannot swallow it.
      useEffect(() => {
        const onDown = (event) => {
          const sheet = panelRef.current;
          if (sheet && sheet.contains(event.target)) return;
          if (event.target && event.target.closest && event.target.closest('.dsh-dash-quick')) return;
          onClose();
        };
        const onKey = (event) => { if (event.key === 'Escape') onClose(); };
        document.addEventListener('pointerdown', onDown, true);
        document.addEventListener('keydown', onKey);
        return () => {
          document.removeEventListener('pointerdown', onDown, true);
          document.removeEventListener('keydown', onKey);
        };
      }, [onClose]);

      const refresh = async () => {
        setBusy(true);
        try {
          const reply = await fetch(`${API}/refresh`, { method: 'POST' });
          const body = await reply.json();
          if (body.latest) setData((current) => ({ ...(current || {}), ...body.latest, registry: current?.registry }));
          else await load();
        } catch { await load(); }
        setBusy(false);
      };

      const decide = async (id, decision) => {
        setNote(t(decision === 'approved' ? 'panel.agreed' : 'panel.rejected'));
        await fetch(`${API}/decide`, {
          method: 'POST',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify({ id, decision })
        }).catch(() => {});
        await load();
        setTimeout(() => setNote(''), 2400);
      };

      const watch = async () => {
        if (!draft.trim()) return;
        await fetch(`${API}/watch`, {
          method: 'POST',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify({ url: draft.trim() })
        }).catch(() => {});
        setDraft('');
        await load();
      };

      const registry = data?.registry || {};
      const snapshot = data?.snapshot || {};
      const plugins = data?.ok === false ? (registry.plugins || []) : (snapshot.plugins || registry.plugins || []);
      const active = plugins.find((item) => item.id === tab) || plugins[0] || null;
      const pending = (data?.suggestions || []).filter((item) => item.status === 'pending').length;
      const x = snapshot.x || registry.x || {};

      return h('div', { className: 'dsh-dash-mask', role: 'dialog', 'aria-modal': 'true' },
        h('section', { className: 'dsh-dash-panel', ref: panelRef },
          h('header', { className: 'dsh-dash-head' },
            h('div', null,
              h('h3', null, t('panel.title'), pending ? h('i', { className: 'dsh-dash-badge' }, pending) : null),
              h('p', null, t('panel.sub'))),
            h('div', { className: 'dsh-dash-head-acts' },
              h('small', null, data?.snapshot ? `${t('panel.updated')} ${(data.snapshot.at || '').slice(11, 16)}` : ''),
              h('button', { type: 'button', className: 'is-ghost', onClick: refresh, disabled: busy },
                busy ? t('panel.refreshing') : t('panel.refresh')),
              h('button', { type: 'button', className: 'dsh-dash-x', onClick: onClose, 'aria-label': 'close' }, '×'))),
          plugins.length
            ? h('nav', { className: 'dsh-dash-tabs' },
                plugins.map((plugin) => h('button', {
                  key: plugin.id,
                  type: 'button',
                  className: `dsh-dash-tab${active && active.id === plugin.id ? ' is-on' : ''}`,
                  onClick: () => setTab(plugin.id)
                },
                  h(Avatar, { plugin, size: 20 }),
                  h('span', null, plugin.name?.[locale] || plugin.name?.zh || plugin.id))))
            : null,
          h('div', { className: 'dsh-dash-body' },
            data === null
              ? h('p', { className: 'dsh-dash-hint' }, t('panel.empty'))
              : active
                ? h(Board, { plugin: active, events: data.events || [], suggestions: data.suggestions || [], t, onDecide: decide })
                : h('p', { className: 'dsh-dash-hint' }, t('panel.empty'))),
          h('footer', { className: 'dsh-dash-foot' },
            h('div', { className: 'dsh-dash-x-card' },
              h('b', null, t('panel.x')),
              h('span', null, `@${x.handle || 'mixinhub'}`),
              h('span', null, `${x.followers ?? '—'} ${t('panel.followers')}`),
              h('span', null, `${(x.posts || []).length} ${t('panel.watch')}`),
              h('div', { className: 'dsh-dash-watch' },
                h('input', {
                  value: draft,
                  placeholder: t('panel.watchHint'),
                  onChange: (event) => setDraft(event.target.value),
                  onKeyDown: (event) => { if (event.key === 'Enter') watch(); }
                }),
                h('button', { type: 'button', onClick: watch }, t('panel.watchAdd')))),
            h('p', { className: 'dsh-dash-gate' }, note || t('panel.gate')))
        ));
    }

    function Quick({ open, setOpen, pending }) {
      const ref = useRef(null);
      const label = TEXT[useLocale()]['nav.label'];
      return h('button', {
        type: 'button',
        ref,
        className: `dsh-dash-quick${open ? ' is-open' : ''}`,
        'aria-label': label,
        'aria-expanded': open ? 'true' : 'false',
        onClick: () => setOpen(!open)
      },
        h('svg', { viewBox: '0 0 20 20', width: 16, height: 16, 'aria-hidden': 'true' },
          h('rect', { x: 2.4, y: 3.2, width: 15.2, height: 4.1, rx: 2.05 }),
          h('rect', { x: 2.4, y: 8.6, width: 9.6, height: 4.1, rx: 2.05 }),
          h('rect', { x: 2.4, y: 14, width: 6.2, height: 3.4, rx: 1.7 })),
        h('span', null, label),
        pending ? h('i', null, pending) : null);
    }

    function Shell() {
      const [open, setOpen] = useState(false);
      const [pending, setPending] = useState(0);
      useEffect(() => {
        let alive = true;
        const tick = async () => {
          try {
            const reply = await fetch(`${API}/summary`);
            const body = await reply.json();
            if (!alive) return;
            setPending((body.suggestions || []).filter((item) => item.status === 'pending').length);
          } catch {}
        };
        tick();
        const timer = setInterval(tick, 120000);
        return () => { alive = false; clearInterval(timer); };
      }, [open]);
      return h(React.Fragment, null,
        h(Quick, { open, setOpen, pending }),
        open && createPortal
          ? createPortal(h(Panel, { onClose: () => setOpen(false) }), document.body)
          : null);
    }

    const CSS = `
      .dsh-dash-quick{display:inline-flex;align-items:center;gap:7px;height:34px;padding:0 11px 0 9px;margin:2px 6px;border-radius:10px;border:1px solid transparent;background:transparent;color:var(--dsw-alias-label-secondary,#9aa3ad);font:inherit;font-size:12.5px;cursor:pointer;transition:background .16s ease,color .16s ease,border-color .16s ease;}
      .dsh-dash-quick:hover,.dsh-dash-quick.is-open{background:color-mix(in srgb,var(--dsw-alias-bg-layer-2,#2a2b2f) 72%,transparent);border-color:color-mix(in srgb,var(--dsw-alias-brand-primary,#4d6bfe) 26%,transparent);color:var(--dsw-alias-label-primary,#e8ecf1);}
      .dsh-dash-quick svg{fill:currentColor;opacity:.85}
      .dsh-dash-quick.is-open svg{opacity:1;fill:var(--dsw-alias-brand-primary,#4d6bfe)}
      .dsh-dash-quick i{display:inline-flex;align-items:center;justify-content:center;min-width:16px;height:16px;padding:0 4px;border-radius:8px;background:var(--dsw-alias-brand-primary,#4d6bfe);color:#fff;font-size:10px;font-style:normal;font-weight:600;}
      .dsh-dash-mask{position:fixed;inset:0;z-index:5200;display:flex;align-items:center;justify-content:center;padding:40px 24px 84px;background:transparent;}
      .dsh-dash-panel{width:min(820px,calc(100vw - 48px));max-height:min(72vh,660px);display:flex;flex-direction:column;overflow:hidden;border-radius:18px;padding:2px;
        background:color-mix(in srgb,var(--dsw-specific-sidebar-fill,#2b2c30) 40%,transparent);
        -webkit-backdrop-filter:var(--dsw-menu-backdrop-filter,blur(40px) saturate(150%));backdrop-filter:var(--dsw-menu-backdrop-filter,blur(40px) saturate(150%));
        border:1px solid color-mix(in srgb,var(--dsw-alias-label-primary,#fff) 9%,transparent);
        box-shadow:0 24px 60px -24px rgba(0,0,0,.55),inset 0 1px 0 color-mix(in srgb,var(--dsw-alias-label-primary,#fff) 7%,transparent);}
      @supports not ((backdrop-filter:blur(1px)) or (-webkit-backdrop-filter:blur(1px))){.dsh-dash-panel{background:var(--dsw-specific-menu,var(--dsw-alias-bg-overlay,#1b1c1f));}}
      .dsh-dash-head{display:flex;align-items:flex-start;justify-content:space-between;gap:16px;padding:16px 16px 10px;}
      .dsh-dash-head h3{margin:0;display:flex;align-items:center;gap:8px;font-size:15px;font-weight:600;color:var(--dsw-alias-label-primary,#f2f5f8);}
      .dsh-dash-badge{display:inline-flex;align-items:center;justify-content:center;min-width:18px;height:18px;padding:0 5px;border-radius:9px;background:color-mix(in srgb,var(--dsw-alias-brand-primary,#4d6bfe) 88%,transparent);color:#fff;font-size:10.5px;font-style:normal;}
      .dsh-dash-head p{margin:4px 0 0;font-size:11.5px;color:var(--dsw-alias-label-tertiary,#8b949e);}
      .dsh-dash-head-acts{display:flex;align-items:center;gap:8px;}
      .dsh-dash-head-acts small{font-size:11px;color:var(--dsw-alias-label-tertiary,#8b949e);}
      .dsh-dash-head-acts button{height:28px;padding:0 10px;border-radius:8px;border:1px solid color-mix(in srgb,var(--dsw-alias-label-primary,#fff) 12%,transparent);background:transparent;color:var(--dsw-alias-label-secondary,#c3cad3);font:inherit;font-size:11.5px;cursor:pointer;}
      .dsh-dash-head-acts button:hover{border-color:color-mix(in srgb,var(--dsw-alias-brand-primary,#4d6bfe) 45%,transparent);color:var(--dsw-alias-label-primary,#fff);}
      .dsh-dash-x{width:28px;padding:0!important;font-size:16px!important;line-height:1;}
      .dsh-dash-tabs{display:flex;gap:6px;padding:0 16px 10px;overflow-x:auto;scrollbar-width:none;}
      .dsh-dash-tabs::-webkit-scrollbar{display:none}
      .dsh-dash-tab{display:inline-flex;align-items:center;gap:7px;flex:none;height:30px;padding:0 10px 0 6px;border-radius:9px;border:1px solid transparent;background:color-mix(in srgb,var(--dsw-alias-bg-layer-2,#2a2b2f) 40%,transparent);color:var(--dsw-alias-label-secondary,#aeb6c0);font:inherit;font-size:12px;cursor:pointer;}
      .dsh-dash-tab:hover{color:var(--dsw-alias-label-primary,#fff);}
      .dsh-dash-tab.is-on{background:color-mix(in srgb,var(--dsw-alias-bg-layer-1,#232324) 66%,transparent);border-color:color-mix(in srgb,var(--dsw-alias-brand-primary,#4d6bfe) 40%,transparent);color:var(--dsw-alias-label-primary,#fff);}
      .dsh-dash-av{display:inline-flex;align-items:center;justify-content:center;overflow:hidden;flex:none;background:color-mix(in srgb,var(--dsw-alias-brand-primary,#4d6bfe) 12%,transparent);}
      .dsh-dash-av.is-mark{gap:0;position:relative;color:color-mix(in srgb,var(--dsw-alias-brand-primary,#4d6bfe) 62%,var(--dsw-alias-label-primary,#fff));}
      .dsh-dash-av.is-mark b{position:absolute;right:-1px;bottom:-2px;font-size:8px;font-weight:700;line-height:1;padding:1px 2px;border-radius:4px;background:color-mix(in srgb,var(--dsw-alias-bg-layer-1,#232324) 86%,transparent);color:var(--dsw-alias-label-secondary,#c3cad3);}
      .dsh-dash-av.is-mark svg{opacity:.92}
      .dsh-dash-av img{width:100%;height:100%;object-fit:cover;display:block;}
      .dsh-dash-av.is-letter b{color:var(--dsw-alias-brand-primary,#8fa6ff);font-weight:600;line-height:1}
      .dsh-dash-body{padding:4px 16px 12px;overflow-y:auto;}
      .dsh-dash-caps{display:grid;grid-template-columns:repeat(auto-fit,minmax(104px,1fr));gap:8px;}
      .dsh-dash-cap{display:flex;flex-direction:column;gap:3px;padding:9px 11px;border-radius:11px;background:color-mix(in srgb,var(--dsw-alias-bg-layer-2,#26272b) 46%,transparent);border:1px solid color-mix(in srgb,var(--dsw-alias-label-primary,#fff) 6%,transparent);}
      .dsh-dash-cap .k{font-size:10.5px;color:var(--dsw-alias-label-tertiary,#8b949e);}
      .dsh-dash-cap .v{font-size:16px;font-weight:600;letter-spacing:-.01em;color:var(--dsw-alias-label-primary,#f2f5f8);}
      .dsh-dash-cap.is-ok .v{color:color-mix(in srgb,var(--dsw-alias-brand-primary,#4d6bfe) 40%,#8ff0c0);font-size:13px;}
      .dsh-dash-cap.is-wait .v{font-size:13px;color:var(--dsw-alias-label-tertiary,#9aa3ad);}
      .dsh-dash-cols{display:grid;grid-template-columns:1fr 1fr;gap:14px;margin-top:14px;}
      @media (max-width:720px){.dsh-dash-cols{grid-template-columns:1fr}}
      .dsh-dash-sec h4{margin:0 0 8px;font-size:11px;font-weight:600;letter-spacing:.04em;text-transform:uppercase;color:var(--dsw-alias-label-tertiary,#8b949e);}
      .dsh-dash-hint{margin:0;font-size:12px;color:var(--dsw-alias-label-tertiary,#8b949e);}
      .dsh-dash-feed{display:grid;grid-template-columns:auto 1fr;grid-template-areas:'src text' 'src meta';gap:2px 8px;padding:7px 0;border-bottom:1px solid color-mix(in srgb,var(--dsw-alias-label-primary,#fff) 5%,transparent);}
      .dsh-dash-feed:last-child{border-bottom:0}
      .dsh-dash-src{grid-area:src;align-self:start;margin-top:1px;padding:1px 5px;border-radius:5px;font-size:9.5px;letter-spacing:.04em;background:color-mix(in srgb,var(--dsw-alias-label-primary,#fff) 8%,transparent);color:var(--dsw-alias-label-secondary,#c3cad3);}
      .dsh-dash-feed p{grid-area:text;margin:0;font-size:12px;line-height:1.45;color:var(--dsw-alias-label-primary,#e6eaf0);}
      .dsh-dash-feed time{grid-area:meta;font-size:10.5px;color:var(--dsw-alias-label-tertiary,#8b949e);}
      .dsh-dash-sug{padding:10px 11px;border-radius:11px;background:color-mix(in srgb,var(--dsw-alias-bg-layer-2,#26272b) 46%,transparent);border:1px solid color-mix(in srgb,var(--dsw-alias-label-primary,#fff) 6%,transparent);margin-bottom:8px;}
      .dsh-dash-sug b{display:block;font-size:12.5px;color:var(--dsw-alias-label-primary,#f2f5f8);}
      .dsh-dash-sug p{margin:4px 0 2px;font-size:11.5px;line-height:1.45;color:var(--dsw-alias-label-secondary,#aeb6c0);}
      .dsh-dash-sug em{font-style:normal;font-size:11.5px;color:var(--dsw-alias-label-primary,#dfe5ec);}
      .dsh-dash-acts{display:flex;gap:6px;margin-top:8px;}
      .dsh-dash-acts button{height:26px;padding:0 10px;border-radius:7px;border:1px solid color-mix(in srgb,var(--dsw-alias-label-primary,#fff) 12%,transparent);background:transparent;color:var(--dsw-alias-label-secondary,#c3cad3);font:inherit;font-size:11px;cursor:pointer;}
      .dsh-dash-acts .is-yes{background:color-mix(in srgb,var(--dsw-alias-brand-primary,#4d6bfe) 88%,transparent);border-color:transparent;color:#fff;}
      .dsh-dash-foot{padding:10px 16px 14px;border-top:1px solid color-mix(in srgb,var(--dsw-alias-label-primary,#fff) 6%,transparent);}
      .dsh-dash-x-card{display:flex;align-items:center;flex-wrap:wrap;gap:10px;font-size:11.5px;color:var(--dsw-alias-label-tertiary,#8b949e);}
      .dsh-dash-x-card b{font-size:11px;letter-spacing:.04em;text-transform:uppercase;color:var(--dsw-alias-label-tertiary,#8b949e);}
      .dsh-dash-watch{display:flex;gap:6px;flex:1 1 260px;}
      .dsh-dash-watch input{flex:1;height:26px;border-radius:7px;border:1px solid color-mix(in srgb,var(--dsw-alias-label-primary,#fff) 10%,transparent);background:color-mix(in srgb,var(--dsw-alias-bg-layer-2,#26272b) 60%,transparent);color:var(--dsw-alias-label-primary,#e6eaf0);font:inherit;font-size:11px;padding:0 8px;outline:none;}
      .dsh-dash-watch input:focus{border-color:color-mix(in srgb,var(--dsw-alias-brand-primary,#4d6bfe) 55%,transparent);}
      .dsh-dash-watch button{height:26px;padding:0 10px;border-radius:7px;border:1px solid color-mix(in srgb,var(--dsw-alias-label-primary,#fff) 12%,transparent);background:transparent;color:var(--dsw-alias-label-secondary,#c3cad3);font:inherit;font-size:11px;cursor:pointer;}
      .dsh-dash-gate{margin:8px 0 0;font-size:11px;color:var(--dsw-alias-label-tertiary,#8b949e);}
      @media (prefers-reduced-motion:reduce){.dsh-dash-quick,.dsh-dash-tab{transition:none}}
    `;

    return {
      inject: ['slots', 'locale'],
      apply(ctx) {
        const style = document.createElement('style');
        style.setAttribute('data-dsh-plugin-dashboard', '');
        style.textContent = CSS;
        document.head.appendChild(style);

        ctx.slots.inject('sidebar.footer.action', () => ctx.slots.register({
          name: 'sidebar.footer.action',
          id: 'plugin-dashboard-quick',
          order: 7
        }, Shell));

        ctx.slots.inject('shell.overlay', () => ctx.slots.register({
          name: 'shell.overlay',
          id: 'plugin-dashboard-panel',
          order: 61
        }, () => null));
      }
    };
  }
});
