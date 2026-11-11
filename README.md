# 插件看板 · Plugin Dashboard

给「自己在 DeepSeek Harness 里发布的所有插件」做一块数据看板：npm 下载、GitHub 星标、市场收录状态、X 上的反馈，每天汇总一次并提出迭代建议。

**它只观察和提建议，永远不自己改代码、不自己发版。** 每条建议都要你在面板上点一次「同意」，才进入人工执行。

## 面板长什么样

- 侧边栏左下角，「皮肤与壁纸」「精选市场」后面多一个 **看板** 按钮，带未读反馈数
- 点开是一块与 Harness 同源材质的毛玻璃面板（`--dsw-specific-sidebar-fill` × 40% + `blur(40px) saturate(150%)`）
- 顶部按插件分页：**一个插件一块板**，切一下 tab 就是另一份数据
- 每块板上六个 **胶囊**：周下载 / 月下载 / ★ / 发布下载 / 市场是否已关联 / 当前版本
- 点面板外任意位置、按 `Esc`、或点右上角 × 都能关闭
- X 区：账号、关注者、被监控帖子的回复数，可以**直接贴一条帖子链接**加进监控
- 「今天可以做的事」：当天反馈里提炼出的建议，带「同意 / 先不做」

## 新插件怎么自动进看板

不用手工登记。每次采集前会扫一遍 `~/Desktop/deepseekharness`（可用 `DSH_DASHBOARD_SCAN` 改，多个路径用冒号分隔），凡是满足下面几条的包都会自动多一块板：

1. `package.json` 里有 `dsh.bundle`
2. 不是 `private`，也不在 `@local/*` 下
3. `repository` 指向你自己的 GitHub 账号（默认 `ghostmss86-afk`，在 `registry.json` 的 `owner` 改）

同一个仓库被扫到两次（目录改名之类）只留一块板。`registry.json` 里的条目仍然可以覆盖显示名、分类和图标。

## 数据从哪来

| 来源 | 取什么 | 频率 |
| --- | --- | --- |
| `api.npmjs.org` | 周下载、月下载、最新版本 | 每次采集 |
| GitHub API | ★ / fork / issue / release 下载量 | 每次采集 |
| `awesome-dsh-plugin.com/catalog.json` | 市场收录、是否关联 npm | 每次采集 |
| X | 关注者、被监控帖子的回复/赞/转/浏览 | 每次采集 |

采集节奏：插件启动后 8 秒跑一次，之后每 **15 分钟** 一次；GitHub Actions 每天 09:17 再跑一次并把快照提交回仓库，所以没有 App 也留得下历史。

### 关于 X 的边界（先说清楚）

X 官方 API 需要付费层，本看板用的是公开镜像 `api.fxtwitter.com`，它只能读**单条帖子**，不能列你最近发了什么。所以：

- 「谁回复了你哪条帖子」需要你把帖子链接贴进来（面板里有输入框，一次贴一条）
- 抓到的是**回复数变化**，不是回复正文；正文你看到后可以粘进反馈
- 想要真正的实时提及，只能接 X 官方 API（把 token 放进环境变量后可换源）

## 目录

数据默认写在 **`~/.dsh/plugin-dashboard/`**（不在 `node_modules` 里，重装插件不丢历史）：

```
registry.json            插件清单（npm 包名 / GitHub 仓库 / 市场 slug / 显示名）
plugins.json             自动发现的结果（扫描工作区里带 dsh.bundle 的包）
latest.json              面板直接读的那份
history/YYYY-MM-DD.json  每天一份，用来算增量
reports/YYYY-MM-DD.md    每天一份可读日报
suggestions.json         建议 + 你的决定
feedback.jsonl           追加式反馈事件（X 新增回复、GitHub issue 变化、手动粘贴）
```

仓库里的 `data/registry.json` 只是首次运行的种子；GitHub Actions 用 `DSH_DASHBOARD_DATA=$GITHUB_WORKSPACE/data` 把 CI 的采集结果提交回仓库，所以远端也留得住历史。

## 加一个新插件

编辑 `data/registry.json`：

```json
{
  "id": "my-plugin",
  "name": { "en": "My Plugin", "zh": "我的插件" },
  "npm": "dsh-plugin-my-plugin",
  "repo": "owner/my-plugin",
  "market": "owner/my-plugin",
  "xPosts": []
}
```

删掉 `data/latest.json` 重跑 `node scripts/collect.mjs` 即可。

## 安装

```sh
dsh plugin --profile web add github:ghostmss86-afk/plugin-dashboard
```

本地开发：在 profile 的 `package.json` 里加 `"dsh-plugin-dashboard": "link:/path/to/plugin-dashboard"`，并把 `dsh-plugin-dashboard` 加进 `dsh.profile.bundles`，重启 App。

## 许可

MIT
