export function analyticsMarkup(config) {
  const enabled = config.analytics?.enabled === true;
  const id = config.analytics?.measurementId || '';
  if (enabled && !/^G-[A-Z0-9]{6,}$/.test(id)) throw Error('Analytics requires a real GA4 measurement ID.');
  if (!enabled) return { head: '', footer: '', panel: '', privacy: '' };
  const host = new URL(config.url).hostname;
  return {
    head: `<script src="/assets/analytics.js?v=20261116" data-measurement-id="${id}" data-host="${host}" defer></script>`,
    footer: '<button type="button" class="analytics-settings" data-analytics-settings aria-controls="analytics-consent" hidden>统计设置</button>',
    panel: `<section id="analytics-consent" class="analytics-consent" aria-labelledby="analytics-consent-title" hidden><div><span class="eyebrow">YOUR PRIVACY</span><h2 id="analytics-consent-title">让手记更好用，由你选择</h2><p>允许 Google Analytics 统计浏览量、访问来源和基本使用情况，帮助我们改善攻略。选择“仅必要”也可完整使用本站。你可以随时在页脚更改选择。<a href="/privacy/">隐私政策</a></p><p class="analytics-status" data-analytics-status role="status"></p></div><div class="analytics-actions"><button type="button" class="button outline" data-analytics-deny>仅必要</button><button type="button" class="button outline" data-analytics-allow>允许统计</button><button type="button" class="text-button" data-analytics-close hidden>关闭设置</button></div></section>`,
    privacy: `<h2>可选的访问统计</h2><p>只有你选择“允许统计”后，本站才加载 Google Analytics 4（GA4），用于了解页面浏览、访问来源、会话与基本参与情况。Google 会处理浏览器与设备信息、近似地区以及 Cookie 标识符等数据。网络连接会向 Google 提供 IP 地址；相关处理方式请参阅 <a href="https://policies.google.com/privacy" rel="noopener noreferrer" target="_blank">Google 隐私政策</a>。</p><p>本站向 GA4 设置的页面地址不含查询参数和片段，来源地址仅保留网站来源；不主动上传搜索关键词、收藏、装备计划或联系邮件内容。已关闭增强型衡量、Google signals 和广告个性化功能。</p><p>同意或拒绝选择使用 localStorage 在当前浏览器保存 180 天。允许后，GA4 使用 <code>_ga</code> 和 <code>_ga_${id.slice(2)}</code> Cookie 区分浏览器与会话，配置的有效期为 180 天且不随每次访问延长；浏览器可能提前清除它们。未选择或拒绝时，本站不加载 GA4，也不发送无 Cookie 的统计请求。</p><p>你可通过下方或页脚的“统计设置”撤回同意。撤回会停止后续统计、删除本站 GA4 Cookie，并可能刷新当前页面；已经发送的数据不会因此自动删除。选择到期后会重新征询。不同浏览器和设备需要分别设置。有关已发送数据的隐私请求，请通过本页邮箱联系我们。</p><p data-analytics-status role="status"></p><button type="button" class="button outline" data-analytics-settings aria-controls="analytics-consent" hidden>统计设置</button>`
  };
}
