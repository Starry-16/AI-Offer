/* 秋招助手插件 - 后台 service worker：代理访问本地秋招助手 API（避免 CORS 问题） */

const API_BASE = "http://127.0.0.1:8000";

/* 长等待期间保活：AI 接口是非流式的，响应生成期间没有字节流动，浏览器会误判
   service worker 空闲并将其回收（消息通道中断）。每 20s 调一次 chrome API 重置空闲计时器。 */
function startKeepAlive() {
  const timer = setInterval(() => {
    try { chrome.runtime.getPlatformInfo(() => void chrome.runtime.lastError); } catch (e) {}
  }, 20000);
  return () => clearInterval(timer);
}

/* 页面文本 → AI 解析 → 同步导入（新增/更新进度），返回 {count, updated, skipped} */
async function doSyncText(text) {
  const parseResp = await fetch(`${API_BASE}/api/applications/import/parse`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ text }),
  });
  const parsed = await parseResp.json().catch(() => ({}));
  if (!parseResp.ok) throw new Error(parsed.detail || `解析失败（HTTP ${parseResp.status}）`);
  if (parsed.need_manual || !parsed.records || !parsed.records.length) {
    throw new Error(parsed.message || "未能从页面识别出投递记录");
  }
  const records = parsed.records.map((r) => ({
    company: r.company || "待确认",
    position: r.position || "待确认",
    category: r.category || "秋招",
    status: r.status || "applied",
    apply_date: r.apply_date || "",
    note: r.note || "",
    location: "", channel: "", stage: "", link: "", events: [],
  }));
  const impResp = await fetch(`${API_BASE}/api/applications/import`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ records }),
  });
  const imp = await impResp.json().catch(() => ({}));
  if (!impResp.ok) throw new Error(imp.detail || `导入失败（HTTP ${impResp.status}）`);
  return imp;
}

chrome.runtime.onMessage.addListener((msg, _sender, sendResponse) => {
  const stopKeepAlive = startKeepAlive();
  (async () => {
    try {
      if (msg.type === "listResumes") {
        const resp = await fetch(`${API_BASE}/api/resumes`);
        if (!resp.ok) throw new Error(`HTTP ${resp.status}`);
        sendResponse({ ok: true, data: await resp.json() });
      } else if (msg.type === "fillForm") {
        const resp = await fetch(`${API_BASE}/api/ai/fill-form`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(msg.payload),
        });
        const data = await resp.json().catch(() => ({}));
        if (!resp.ok) {
          // 服务在线但处理失败（如 AI 报错）：直接透传后端原因，不包装成“无法连接”
          sendResponse({ ok: false, error: data.detail || `服务返回错误（HTTP ${resp.status}）` });
          return;
        }
        sendResponse({ ok: true, data });
      } else if (msg.type === "syncProgress") {
        try {
          const data = await doSyncText(String(msg.payload.text || "").slice(0, 15000));
          sendResponse({ ok: true, data });
        } catch (e) {
          if (e instanceof TypeError) throw e; // 网络错误交给外层统一提示“无法连接”
          sendResponse({ ok: false, error: e.message });
        }
      } else if (msg.type === "getAttachment") {
        // 取简历附件并转成 base64 回传给 content script（注入官网文件框）
        const resp = await fetch(`${API_BASE}/api/resumes/${encodeURIComponent(msg.payload.resume_id)}/attachment`);
        if (!resp.ok) { sendResponse({ ok: false, error: "该简历未上传附件" }); return; }
        const bytes = new Uint8Array(await resp.arrayBuffer());
        let bin = "";
        for (let i = 0; i < bytes.length; i += 32768) bin += String.fromCharCode(...bytes.subarray(i, i + 32768));
        const cd = resp.headers.get("Content-Disposition") || "";
        const m = cd.match(/filename\*?=(?:UTF-8'')?"?([^";]+)/i);
        sendResponse({ ok: true, data: { b64: btoa(bin), name: m ? decodeURIComponent(m[1]) : "resume.pdf", type: resp.headers.get("Content-Type") || "application/pdf" } });
      } else if (msg.type === "getPhoto") {
        // 取证件照并转成 base64 回传给 content script（注入官网照片上传框）
        const resp = await fetch(`${API_BASE}/api/resumes/${encodeURIComponent(msg.payload.resume_id)}/photo`);
        if (!resp.ok) { sendResponse({ ok: false, error: "该简历未上传证件照" }); return; }
        const bytes = new Uint8Array(await resp.arrayBuffer());
        let bin = "";
        for (let i = 0; i < bytes.length; i += 32768) bin += String.fromCharCode(...bytes.subarray(i, i + 32768));
        const cd = resp.headers.get("Content-Disposition") || "";
        const m = cd.match(/filename\*?=(?:UTF-8'')?"?([^";]+)/i);
        sendResponse({ ok: true, data: { b64: btoa(bin), name: m ? decodeURIComponent(m[1]) : "photo.jpg", type: resp.headers.get("Content-Type") || "image/jpeg" } });
      } else if (msg.type === "clearBadge") {
        try { chrome.action.setBadgeText({ text: "" }); } catch (e) {}
        sendResponse({ ok: true, data: null });
      } else if (msg.type === "ping") {
        const resp = await fetch(`${API_BASE}/api/stats`);
        sendResponse({ ok: resp.ok });
      }
    } catch (e) {
      // 只有 fetch 本身失败（服务没启动/网络断）才报“无法连接”
      sendResponse({
        ok: false,
        error: `无法连接本地秋招助手服务（${API_BASE}），请确认服务已启动（${e.message || "网络错误"}）`,
      });
    } finally {
      stopKeepAlive();
    }
  })();
  return true; // 异步 sendResponse
});

/* ================= 每日自动同步投递进度 ================= */
const SYNC_ALARM = "qzfDailySync";

async function ensureSyncAlarm() {
  const a = await chrome.alarms.get(SYNC_ALARM);
  if (!a) chrome.alarms.create(SYNC_ALARM, { periodInMinutes: 720 }); // 每 12 小时
}
chrome.runtime.onInstalled.addListener(ensureSyncAlarm);
chrome.runtime.onStartup.addListener(ensureSyncAlarm);
chrome.alarms.onAlarm.addListener(async (a) => {
  if (a.name !== SYNC_ALARM) return;
  const stopKeepAlive = startKeepAlive(); // 多站点抓取可能跑几分钟，期间保持 SW 存活
  try { await runAutoSync(); } finally { stopKeepAlive(); }
});

function waitTabComplete(tabId) {
  return new Promise((resolve) => {
    const timer = setTimeout(resolve, 25000); // 超时兜底
    chrome.tabs.onUpdated.addListener(function listener(id, info) {
      if (id === tabId && info.status === "complete") {
        clearTimeout(timer);
        chrome.tabs.onUpdated.removeListener(listener);
        resolve();
      }
    });
  });
}

async function runAutoSync() {
  const { qzf_sites: sites } = await chrome.storage.local.get("qzf_sites");
  if (!sites || !sites.length) return;
  const total = { count: 0, updated: 0, skipped: 0 };
  for (const site of sites) {
    let tab = null;
    try {
      tab = await chrome.tabs.create({ url: site.url, active: false }); // 后台标签页，不打扰当前浏览
      await waitTabComplete(tab.id);
      await new Promise((r) => setTimeout(r, 4500)); // 等 SPA 渲染出记录列表
      const resp = await chrome.tabs.sendMessage(tab.id, { type: "qzfScrape" });
      const text = resp && resp.text ? resp.text : "";
      if (text.trim().length > 50) {
        const r = await doSyncText(text);
        total.count += r.count || 0;
        total.updated += r.updated || 0;
        total.skipped += r.skipped || 0;
      }
    } catch (e) { /* 未登录或单站失败不影响其他站点 */ }
    if (tab) { try { await chrome.tabs.remove(tab.id); } catch (e) {} }
  }
  await chrome.storage.local.set({ qzf_last_sync: { at: Date.now(), sites: sites.length, ...total } });
  try {
    chrome.action.setBadgeBackgroundColor({ color: "#4f46e5" });
    chrome.action.setBadgeText({ text: total.updated ? String(total.updated) : "" });
  } catch (e) {}
}
