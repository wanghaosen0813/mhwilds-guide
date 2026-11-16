# 荒野手记 · MHWILDS.NET

《怪物猎人：荒野》非官方中文攻略与资料站。纯静态生成，不需要数据库或第三方运行时依赖。

## 本地运行

需要 Node.js 22 或更新版本。

```powershell
node scripts/build.mjs
node scripts/check.mjs
node scripts/serve.mjs
```

浏览器打开 http://127.0.0.1:4174 。`dist/` 是完整部署产物。`src/content.mjs` 保存原创指南，`site.config.json` 配置站点名称、联系渠道和广告。游戏资料、图片来源和采集报告分别位于 `data/game.json`、`data/asset-sources.json`、`data/collection-report.json`。

## GitHub Pages

推送到 `main` 后，`.github/workflows/pages.yml` 构建、检查并部署。仓库 Settings → Pages 的 Source 选择 GitHub Actions，Custom domain 设为 `mhwilds.net`，证书签发后启用 Enforce HTTPS。

域名 DNS 的根域名 `@` 使用 GitHub Pages 官方的四个 A 记录：

| 类型 | 主机 | 值 |
|---|---|---|
| A | @ | 185.199.108.153 |
| A | @ | 185.199.109.153 |
| A | @ | 185.199.110.153 |
| A | @ | 185.199.111.153 |
| CNAME | www | 发布仓库所属账号.github.io |

如 GitHub 账号提供域名验证，请将其给出的唯一 TXT 记录添加到 DNS。不要猜测验证值。不要保留指向其他托管的冲突记录。`public/CNAME` 已设置域名。

## GA4 访问统计

2026-11-16 接入独立资源“荒野手记 · mhwilds.net”，北京时间统计。Web 数据流为“荒野手记 Web”（16348464909），衡量 ID 为 `G-RMXH273MTW`。`site.config.json` 中 `analytics.enabled` 可关闭整站统计入口和脚本。

[打开此站的 Google Analytics 后台](https://analytics.google.com/analytics/web/#/a416273129p564461073/reports/intelligenthome)。资源 ID：564461073；位于现有 GTA6CAMP 账号下，与该账号的其他网站分别统计。

- 首次访问需主动选择“允许统计”才加载 Google 标签；“仅必要”不发送 GA4 请求。每页页脚与隐私页均可重新选择或撤回。
- 选择保存 180 天；GA Cookie 单独配置为 180 天且不滚动延期。撤回会禁用标签、删除本站 GA Cookie 并刷新已加载标签的页面；其他打开的标签页通过 storage 事件同步。
- 仅在 HTTPS 的 mhwilds.net / www.mhwilds.net 发送。localhost 预览仍可检查选择界面，不污染报表。
- 关闭数据流的增强型衡量、Google signals 和广告个性化；发送页面地址时移除 query/hash，来源仅保留 origin。不采集收藏、规划和搜索词自定义事件。基本 page_view、session_start、first_visit、user_engagement 仍会产生。
- 统计从接入后开始，无法恢复旧流量；拒绝统计、浏览器拦截或 Google 服务不可达的访问不会计入。实时报告用于验证，常规报告需等待处理。测试访问应单独识别，不当作自然用户。

验证：`node scripts/check-analytics.mjs` 覆盖同意/拒绝、撤回、过期、多标签同步、加载竞态、查询参数清理与预览隔离。GA4 的增强型衡量应保持关闭，避免搜索页 history.replaceState 产生额外事件。

## AdSense 接入

当前广告关闭，网页不会请求 Google 广告脚本；`ads.txt` 不包含虚构发布商 ID。

正式接入前：

1. 完善 `site.config.json` 中的公开联系邮箱，检查关于、隐私、版权与联系页面。
2. 在 AdSense 添加 `mhwilds.net`，使用自己账号里的站点验证/发布商信息并提交审核。本站不保证审核通过。
3. 在 AdSense 的 Privacy & messaging 配置适用地区所需的 Google 认证 CMP 与同意信息。自制 Cookie 弹窗不替代认证 CMP。
4. 配置真实 `ads.publisherId`（`ca-pub-` 加 16 位数字）和 `ads.slots.article` / `ads.slots.listing` 广告单元编号。
5. 完成同意配置并测试后设置 `ads.cmpReady: true`、`ads.enabled: true`。构建会同步输出广告代码、隐私披露与真实 `ads.txt` 卖方记录。
6. 检查广告与导航不混淆，检查移动端和无填充状态。不要点击自己网站的广告。

如果仅验证 AdSense 站点且尚未投放，请按账号提供的具体方法独立配置；不要为通过检查而随意填充 ID。

## 内容边界

资料是 2026-11-13 的参考资料快照，不等同于游戏最新版本声明。怪物弱点是星级，不是肉质百分比。装备规划仅合计基础装备数据，不包含强化、装饰珠、护石、套装触发或伤害模拟。素材掉落有不同任务阶级与取得条件。

游戏资料参考 Gamertw，场景截图来自 CAPCOM 官方 Steam 页面。游戏名称、美术与图像归原权利人所有，本站不是 CAPCOM 官方服务。图片来源清单不等同于商业授权证明；运营者应遵守原权利人的使用要求，并处理合法的纠错或权利请求。

## 来源与规范

- https://mhwilds.gamertw.com/zh-CN
- https://store.steampowered.com/app/2246340/Monster_Hunter_Wilds/
- https://docs.github.com/en/pages/configuring-a-custom-domain-for-your-github-pages-site/managing-a-custom-domain-for-your-github-pages-site
- https://support.google.com/publisherpolicies/answer/10502938
- https://support.google.com/adsense/answer/13554116
- https://support.google.com/publisherpolicies/answer/11190248

资料更新可以运行 `node scripts/collect-data.mjs`。先检查变化与来源，再重新构建。采集缓存不会提交到仓库。
