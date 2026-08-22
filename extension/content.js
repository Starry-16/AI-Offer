/* 秋招助手插件 - 内容脚本：注入悬浮按钮与填写面板，扫描并自动填写招聘网站表单
   适配：原生控件 + 自定义下拉（北森/Moka 等 ATS 的 div 模拟组件）+ SPA 重渲染容错 */
(function () {
  "use strict";
  if (window.top !== window.self) return; // 只在顶层框架注入
  if (["127.0.0.1", "localhost"].includes(location.hostname)) return; // 跳过本地秋招助手自身
  if (document.getElementById("tab-dashboard")) return; // 秋招助手页面（公网隧道访问时）

  /* ---------- 样式 ---------- */
  const css = `
    #qzf-btn { position: fixed; right: 18px; bottom: 96px; z-index: 2147483646; width: 46px; height: 46px;
      border-radius: 50%; background: #4f46e5; color: #fff; border: none; cursor: pointer;
      font-size: 17px; font-weight: 700; box-shadow: 0 6px 20px rgba(79,70,229,.45); opacity: .88; }
    #qzf-btn:hover { opacity: 1; transform: scale(1.06); }
    #qzf-panel { position: fixed; right: 18px; bottom: 152px; z-index: 2147483647; width: 292px;
      background: #fff; border-radius: 14px; box-shadow: 0 12px 40px rgba(15,23,42,.22);
      font: 13px/1.6 -apple-system, "Segoe UI", "Microsoft YaHei", sans-serif; color: #1e293b;
      padding: 14px 16px; display: none; }
    #qzf-panel.open { display: block; }
    #qzf-panel .qzf-title { font-size: 14px; font-weight: 700; display: flex; justify-content: space-between; align-items: center; }
    #qzf-panel .qzf-close { cursor: pointer; color: #94a3b8; font-size: 16px; border: none; background: none; }
    #qzf-panel select { width: 100%; margin: 10px 0 8px; padding: 7px 8px; border: 1px solid #e2e8f0; border-radius: 8px;
      font-size: 13px; background: #fff; color: #1e293b; }
    #qzf-panel .qzf-fill { width: 100%; padding: 8px 0; border: none; border-radius: 8px; background: #4f46e5;
      color: #fff; font-size: 13px; font-weight: 600; cursor: pointer; }
    #qzf-panel .qzf-fill:disabled { background: #a5b4fc; cursor: not-allowed; }
    #qzf-panel .qzf-sync { width: 100%; margin-top: 6px; padding: 7px 0; border: 1px solid #c7d2fe; border-radius: 8px;
      background: #fff; color: #4f46e5; font-size: 13px; font-weight: 600; cursor: pointer; }
    #qzf-panel .qzf-sync:hover { background: #eef2ff; }
    #qzf-panel .qzf-sync:disabled { color: #a5b4fc; border-color: #e2e8f0; cursor: not-allowed; background: #fff; }
    #qzf-panel .qzf-auto { display: flex; align-items: center; gap: 6px; margin-top: 8px; font-size: 12px; color: #64748b; cursor: pointer; }
    #qzf-panel .qzf-auto input { accent-color: #4f46e5; margin: 0; }
    #qzf-panel .qzf-lastsync { margin-top: 6px; font-size: 11px; color: #94a3b8; }
    #qzf-panel .qzf-status { margin-top: 8px; font-size: 12px; color: #64748b; max-height: 110px; overflow: auto; white-space: pre-wrap; }
    .qzf-filled { outline: 2px solid #34d399 !important; outline-offset: 1px; background: #ecfdf5 !important; }
  `;
  const style = document.createElement("style");
  style.textContent = css;
  document.documentElement.appendChild(style);

  /* ---------- 悬浮按钮与面板 ---------- */
  const btn = document.createElement("button");
  btn.id = "qzf-btn";
  btn.textContent = "秋";
  btn.title = "秋招助手 · 简历自动填写";
  document.documentElement.appendChild(btn);

  const panel = document.createElement("div");
  panel.id = "qzf-panel";
  panel.innerHTML = `
    <div class="qzf-title">秋招助手 · 自动填写<button class="qzf-close">×</button></div>
    <select id="qzf-resume"><option value="">加载简历中…</option></select>
    <button class="qzf-fill">自动填写本页表单</button>
    <button class="qzf-sync">同步本页投递进度</button>
    <label class="qzf-auto"><input type="checkbox" id="qzf-auto-cb"> 每天自动同步本页进度</label>
    <div class="qzf-lastsync"></div>
    <div class="qzf-status"></div>`;
  document.documentElement.appendChild(panel);

  const resumeSel = panel.querySelector("#qzf-resume");
  const fillBtn = panel.querySelector(".qzf-fill");
  const statusEl = panel.querySelector(".qzf-status");
  const setStatus = (t) => { statusEl.textContent = t; };

  btn.addEventListener("click", () => panel.classList.toggle("open"));
  panel.querySelector(".qzf-close").addEventListener("click", () => panel.classList.remove("open"));

  /* 安全地重建简历下拉框（不用 innerHTML 拼接接口数据，防注入） */
  function renderResumeOptions(resumes) {
    resumeSel.textContent = "";
    const add = (value, text) => {
      const opt = document.createElement("option");
      opt.value = value;
      opt.textContent = text;
      resumeSel.appendChild(opt);
    };
    if (!resumes || !resumes.length) {
      add("", "本地暂无简历，请先在秋招助手中创建");
      return false;
    }
    resumes.forEach((r) => add(r.id, r.name));
    return true;
  }

  function sendMsg(msg, retried = false) {
    return new Promise((resolve, reject) => {
      // 把浏览器原始报错翻译成可操作的提示
      const fail = (m) => {
        if (/Extension context invalidated/i.test(m)) m = "插件刚更新过，请刷新本页面（F5）后重试";
        else if (/message channel closed|receiving end does not exist/i.test(m)) m = "插件后台进程被浏览器回收，请刷新本页面重试；若反复出现，请到 edge://extensions 重新加载插件";
        reject(new Error(m));
      };
      try {
        chrome.runtime.sendMessage(msg, (resp) => {
          const err = chrome.runtime.lastError;
          if (err) {
            // SW 中途被回收导致通道中断：唤醒后自动重试一次（fill/查询类操作幂等）
            if (!retried && /message channel closed|receiving end does not exist/i.test(err.message || "")) {
              setTimeout(() => sendMsg(msg, true).then(resolve, reject), 800);
              return;
            }
            fail(err.message || "未知错误");
          }
          else if (!resp || !resp.ok) reject(new Error((resp && resp.error) || "未知错误"));
          else resolve(resp.data);
        });
      } catch (e) {
        // 插件重载后页面未刷新时，这里会同步抛 Extension context invalidated
        fail((e && e.message) || String(e));
      }
    });
  }

  const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

  /* 各简历的经历条数缓存：决定「添加经历」按钮要凑出几组 */
  const resumeCounts = {};

  /* 打开面板时加载简历列表 */
  btn.addEventListener("click", async () => {
    if (!panel.classList.contains("open") || resumeSel.dataset.loaded) return;
    try {
      const resumes = await sendMsg({ type: "listResumes" });
      resumes.forEach((r) => {
        resumeCounts[r.id] = {
          work: (r.experiences || []).filter((e) => e.company || e.position).length,
          proj: (r.projects || []).filter((p) => p.name).length,
        };
      });
      if (!renderResumeOptions(resumes)) return;
      const saved = await chrome.storage.local.get("qzf_resume");
      if (saved.qzf_resume && resumes.some((r) => r.id === saved.qzf_resume)) {
        resumeSel.value = saved.qzf_resume;
      }
      resumeSel.dataset.loaded = "1";
    } catch (e) {
      renderResumeOptions([]);
      resumeSel.options[0].textContent = "连接失败";
      setStatus(e.message);
    }
  });
  resumeSel.addEventListener("change", () => chrome.storage.local.set({ qzf_resume: resumeSel.value }));

  /* 同步本页投递进度：抓取页面文本 → AI 解析 → 本地同步（新增/更新进度/无变化） */
  const syncBtn = panel.querySelector(".qzf-sync");
  syncBtn.addEventListener("click", async () => {
    const text = (document.body.innerText || "").slice(0, 15000);
    if (text.trim().length < 20) { setStatus("未读取到页面内容"); return; }
    syncBtn.disabled = true;
    setStatus("正在识别本页投递记录并同步进度…");
    try {
      const d = await sendMsg({ type: "syncProgress", payload: { text } });
      const parts = [];
      if (d.count) parts.push(`新增 ${d.count} 条`);
      if (d.updated) parts.push(`更新 ${d.updated} 条进度`);
      if (d.skipped) parts.push(`${d.skipped} 条无变化`);
      setStatus(`同步完成：${parts.join("，") || "没有识别到记录"}`);
    } catch (e) {
      setStatus(`同步失败：${e.message}`);
    } finally {
      syncBtn.disabled = false;
    }
  });

  /* 每日自动同步：把本页（投递记录页）加入定时任务 */
  const autoCb = panel.querySelector("#qzf-auto-cb");
  const lastSyncEl = panel.querySelector(".qzf-lastsync");
  const pageKey = location.origin + location.pathname;
  btn.addEventListener("click", async () => {
    const { qzf_sites = [] } = await chrome.storage.local.get("qzf_sites");
    autoCb.checked = qzf_sites.some((s) => s.url === pageKey);
    const { qzf_last_sync } = await chrome.storage.local.get("qzf_last_sync");
    if (qzf_last_sync) {
      const t = new Date(qzf_last_sync.at);
      const hh = String(t.getHours()).padStart(2, "0"), mm = String(t.getMinutes()).padStart(2, "0");
      lastSyncEl.textContent = `上次自动同步 ${t.getMonth() + 1}/${t.getDate()} ${hh}:${mm} · 新增${qzf_last_sync.count} 更新${qzf_last_sync.updated} 无变化${qzf_last_sync.skipped}`;
      sendMsg({ type: "clearBadge" }).catch(() => {});
    }
  });
  autoCb.addEventListener("change", async () => {
    const { qzf_sites = [] } = await chrome.storage.local.get("qzf_sites");
    const next = autoCb.checked
      ? [...qzf_sites.filter((s) => s.url !== pageKey), { url: pageKey, title: document.title.slice(0, 30) }]
      : qzf_sites.filter((s) => s.url !== pageKey);
    await chrome.storage.local.set({ qzf_sites: next });
    setStatus(autoCb.checked ? `已加入每日自动同步（共 ${next.length} 页，浏览器开启时每 12 小时执行）` : "已取消本页的每日自动同步");
  });

  /* 响应后台定时任务的页面文本抓取 */
  chrome.runtime.onMessage.addListener((msg, _s, sendResponse) => {
    if (msg && msg.type === "qzfScrape") {
      sendResponse({ text: (document.body.innerText || "").slice(0, 15000) });
    }
  });

  /* ---------- 表单扫描 ---------- */
  function isVisible(el) {
    const r = el.getBoundingClientRect();
    const s = getComputedStyle(el);
    return r.width > 0 && r.height > 0 && s.visibility !== "hidden" && s.display !== "none";
  }

  function cleanText(t) {
    return (t || "").replace(/[*：:]/g, "").split("\n")[0].trim().slice(0, 60);
  }

  /* 标签元素选择器：兼容原生 label、Element/Antd 以及北森的 .field-label 等写法 */
  const LABEL_SELECTOR = 'label, [class*="label"], [class*="Label"], [class*="field-name"], [class*="item-name"], .title, .name, .required';

  function fieldLabel(el) {
    if (el.id) {
      const l = document.querySelector(`label[for="${CSS.escape(el.id)}"]`);
      if (l && cleanText(l.innerText)) return cleanText(l.innerText);
    }
    const aria = el.getAttribute("aria-label");
    if (aria) return cleanText(aria);
    if (el.tagName !== "INPUT" || el.type !== "radio") {
      const wrap = el.closest("label");
      if (wrap && cleanText(wrap.innerText)) return cleanText(wrap.innerText);
    }
    // 向上逐层找：前面的兄弟短文本（标签常在控件左边/上边）或祖先容器内的标签元素
    let node = el;
    for (let depth = 0; depth < 5 && node && !/^(BODY|FORM)$/.test(node.tagName); depth++) {
      const sib = node.previousElementSibling;
      if (sib && !sib.contains(el) && !sib.querySelector("input,textarea,select")) {
        const t = cleanText(sib.innerText);
        if (t && t.length <= 30) return t;
      }
      node = node.parentElement;
      if (!node) break;
      for (const cand of node.querySelectorAll(LABEL_SELECTOR)) {
        if (cand.contains(el) || cand.querySelector("input,textarea,select")) continue;
        const t = cleanText(cand.innerText);
        if (t && t.length <= 30) return t;
      }
    }
    return "";
  }

  /* 找字段所在区块标题（如 实习经历 / 教育经历），给 AI 提供上下文 */
  function fieldSection(el) {
    const HEAD_SEL = 'h1,h2,h3,h4,h5,legend,[class*="title"],[class*="Title"],[class*="header"]';
    let node = el.parentElement;
    for (let depth = 0; depth < 8 && node && node.tagName !== "BODY"; depth++, node = node.parentElement) {
      for (const head of node.querySelectorAll(HEAD_SEL)) {
        if (head.contains(el)) continue;
        const t = cleanText(head.innerText);
        if (t && t.length <= 20 && /经历|经验|信息|教育|实习|工作|项目|奖励|证书|语言|家庭|其他|情况|作品|附件|意向/.test(t)) return t;
      }
    }
    return "";
  }

  function scanFields() {
    const fields = [];
    let n = 0;
    const nextId = () => `f${++n}`;

    // 原生文本类输入框
    document.querySelectorAll("input, textarea").forEach((el) => {
      const type = (el.getAttribute("type") || "text").toLowerCase();
      if (el.tagName === "INPUT" && !["text", "email", "tel", "number", "url", "date", "month", "search"].includes(type)) return;
      if (el.disabled || el.readOnly || !isVisible(el)) return;
      if (el.closest("#qzf-panel")) return;
      const id = el.dataset.qzfId || nextId();
      el.dataset.qzfId = id;
      const kind = el.tagName === "TEXTAREA" ? "textarea" : (["date", "month", "number"].includes(type) ? type : "text");
      fields.push({
        id, kind,
        label: fieldLabel(el),
        name: el.name || "",
        placeholder: cleanText(el.placeholder),
        section: fieldSection(el),
      });
    });

    // 原生下拉选择
    document.querySelectorAll("select").forEach((el) => {
      if (el.disabled || !isVisible(el) || el.closest("#qzf-panel")) return;
      const id = el.dataset.qzfId || nextId();
      el.dataset.qzfId = id;
      const options = [...el.options].map((o) => o.text.trim()).filter((t) => t && !/请选择|^-/.test(t)).slice(0, 40);
      fields.push({ id, kind: "select", label: fieldLabel(el), name: el.name || "", options, section: fieldSection(el) });
    });

    // 单选组（按 name 分组）
    const groups = new Map();
    document.querySelectorAll('input[type="radio"]').forEach((el) => {
      if (el.disabled || !isVisible(el)) return;
      const key = el.name || el.id;
      if (!groups.has(key)) groups.set(key, []);
      groups.get(key).push(el);
    });
    groups.forEach((els) => {
      const first = els[0];
      const id = first.dataset.qzfGroup || nextId();
      let label = "";
      const box = first.closest("div, td, li, .form-item, .el-form-item, [class*='field'], [class*='form']");
      if (box) {
        for (const cand of box.querySelectorAll(LABEL_SELECTOR)) {
          if (cand.contains(first) || cand.querySelector("input,textarea,select")) continue; // 跳过选项本身的包裹 label
          const t = cleanText(cand.innerText);
          if (t && t.length <= 30) { label = t; break; }
        }
      }
      const options = els.map((el) => {
        el.dataset.qzfGroup = id;
        if (el.id) {
          const l = document.querySelector(`label[for="${CSS.escape(el.id)}"]`);
          if (l && cleanText(l.innerText)) return cleanText(l.innerText);
        }
        const wrap = el.closest("label");
        return cleanText(wrap ? wrap.innerText : "") || el.value;
      });
      fields.push({ id, kind: "radio", label, name: first.name || "", options, section: fieldSection(first) });
    });

    // 自定义下拉（div 模拟 select，北森/Moka 等 ATS 常见）
    document.querySelectorAll('[role="combobox"], [aria-haspopup="listbox"], [class*="select"], [class*="dropdown"], [class*="cascader"]').forEach((el) => {
      if (["INPUT", "SELECT", "TEXTAREA", "UL", "LI"].includes(el.tagName)) return; // 原生控件与选项列表不重复处理
      if (!isVisible(el) || el.closest("#qzf-panel")) return;
      if (el.querySelector("select")) return;
      const text = cleanText(el.innerText);
      if (text.length > 24) return; // 容器太大，不是单个字段
      if (el.dataset.qzfId) return;
      // 只收像个字段的：带占位提示文字，或位于表单项容器内
      const looksLikeField = /请选择|请选择\.\.\.|select|未选择/i.test(text)
        || el.closest(".form-item, .el-form-item, [class*='form']");
      if (!looksLikeField) return;
      const id = nextId();
      el.dataset.qzfId = id;
      fields.push({
        id, kind: "custom-select",
        label: fieldLabel(el),
        placeholder: text,
        section: fieldSection(el),
      });
    });

    return fields.slice(0, 100);
  }

  /* ---------- 填写 ---------- */
  function setNativeValue(el, value) {
    const proto = el.tagName === "TEXTAREA" ? HTMLTextAreaElement.prototype : HTMLInputElement.prototype;
    const setter = Object.getOwnPropertyDescriptor(proto, "value").set;
    setter.call(el, value);
    el.dispatchEvent(new Event("input", { bubbles: true }));
    el.dispatchEvent(new Event("change", { bubbles: true }));
  }

  function markFilled(el) {
    el.classList.add("qzf-filled");
  }

  function findFieldElement(f) {
    if (f.kind === "radio") {
      return document.querySelector(`input[type="radio"][data-qzf-group="${f.id}"]`);
    }
    return document.querySelector(`[data-qzf-id="${f.id}"]`);
  }

  /* 「至今」：勾选字段附近文本为「至今」的复选框/可点元素（逐级扩大容器范围） */
  function tryCheckUntilNow(el) {
    let box = el.closest("div, li, td, tr, [class*='item'], [class*='field']") || el.parentElement;
    for (let level = 0; level < 3 && box; level++) {
      const cand = [...box.querySelectorAll("input[type='checkbox'], label, span")].find((x) => {
        const t = cleanText(x.tagName === "INPUT" && x.parentElement ? x.parentElement.innerText : x.innerText);
        return t === "至今";
      });
      if (cand) { cand.click(); markFilled(cand); return true; }
      box = box.parentElement;
    }
    return false;
  }

  /* 日历/月份弹层尽量自动点选：年 → 月 → 日。只操作当前弹出的日期层，失败返回 false */
  async function fillCalendar(v) {
    const m = String(v).match(/^(\d{4})[-/.年](\d{1,2})(?:[-/.月](\d{1,2}))?/);
    if (!m) return false;
    const year = m[1], month = parseInt(m[2], 10), day = m[3] ? parseInt(m[3], 10) : 0;
    // 当前激活的日期弹层：可见、含日期格子、DOM 中最后出现的一个（组件库一般把激活弹层挂在 body 末尾）
    const layer = () => {
      const ls = [...document.querySelectorAll('[class*="picker"], [class*="calendar"], [role="dialog"]')]
        .filter((x) => isVisible(x) && !x.closest("#qzf-panel") && x.querySelector("td, li"));
      return ls[ls.length - 1] || null;
    };
    const cells = () => {
      const l = layer();
      if (!l) return [];
      return [...l.querySelectorAll("td, li, span, div")]
        .filter((x) => isVisible(x) && x.childElementCount === 0 && !/disabled|prev|next/.test(x.className) && cleanText(x.innerText).length <= 8);
    };
    const clickCell = async (test) => {
      const c = cells().find((x) => test(cleanText(x.innerText)));
      if (!c) return false;
      c.click();
      await sleep(250);
      return true;
    };
    // ① 若当前不是年视图，点弹层头部含年份的标签切换（最多试 2 次）
    for (let t = 0; t < 2 && !cells().some((x) => /^\d{4}$/.test(cleanText(x.innerText))); t++) {
      const l = layer();
      if (!l) break;
      const head = [...l.querySelectorAll("button, span, a")]
        .filter((x) => isVisible(x) && x.childElementCount === 0)
        .find((x) => /^\d{4}\s*年?$/.test(cleanText(x.innerText)));
      if (!head) break;
      head.click();
      await sleep(250);
    }
    // ② 年视图：点目标年（之后一般进入月视图）
    if (cells().some((x) => /^\d{4}$/.test(cleanText(x.innerText)))) {
      if (!(await clickCell((t) => t === year))) return false;
    }
    // ③ 月视图：点目标月
    if (cells().some((x) => /月$/.test(cleanText(x.innerText)))) {
      if (!(await clickCell((t) => new RegExp(`^0?${month}\\s*月$`).test(t)))) return false;
    }
    // ④ 日视图：需要具体日期时点日
    if (day && !(await clickCell((t) => t === String(day)))) return false;
    // 有的弹层需要点「确定」才生效（只找弹层内部的按钮，绝不点页面上的）
    const l = layer();
    const okBtn = l && [...l.querySelectorAll("button, a")].filter(isVisible)
      .find((x) => /^(确定|确认|OK)$/i.test(cleanText(x.innerText)));
    if (okBtn) { okBtn.click(); await sleep(150); }
    return true;
  }

  /* 日期类字段填完后的校验：字段文本或内部 input 应包含目标年月 */
  function dateFilled(el, v) {
    const ym = String(v).slice(0, 7); // YYYY-MM
    if (cleanText(el.innerText).includes(ym)) return true;
    const inner = el.matches("input") ? el : el.querySelector("input");
    return !!(inner && inner.value && inner.value.includes(ym));
  }

  function fieldSignature(f) {
    return [f.kind, f.name || "", f.label || "", f.placeholder || ""].join("|");
  }

  /* 自定义下拉：触发鼠标事件展开 → 在弹层中按文本匹配选项 → 点击；日期值直接走日历弹层 */
  async function fillCustomSelect(el, value) {
    const v = String(value).trim();
    const isDate = /^\d{4}[-/.年]\d{1,2}/.test(v);
    el.scrollIntoView({ block: "center" });
    // 依次发 mousedown/mouseup/click，兼容只监听鼠标事件的组件库（北森等）
    for (const type of ["mousedown", "mouseup", "click"]) {
      el.dispatchEvent(new MouseEvent(type, { bubbles: true, cancelable: true, view: window }));
    }
    await sleep(700);
    if (!isDate) {
      const candidates = [...document.querySelectorAll(
        '[role="option"], .el-select-dropdown__item, .ant-select-item-option, [role="listbox"] li, [role="treeitem"], [class*="dropdown"] li, [class*="option"] li, [class*="popper"] li, [class*="select"] li, [class*="cascader"] li'
      )].filter((o) => isVisible(o) && !o.closest("#qzf-panel") && cleanText(o.innerText) && cleanText(o.innerText).length <= 30);
      const hit = candidates.find((o) => cleanText(o.innerText) === v)
        || candidates.find((o) => cleanText(o.innerText).includes(v))
        || candidates.find((o) => v.includes(cleanText(o.innerText)));
      if (hit) {
        const hitText = cleanText(hit.innerText);
        hit.click();
        await sleep(250);
        // 验证选中值真的显示到了字段上（防止点到其他弹层的选项造成“假成功”）；
        // 用压缩空白后的全文本比对，容忍「标签+值」多行排版；字段父容器也查一次
        const squash = (s) => (s || "").replace(/[\s*：:]/g, "");
        const full = squash(el.innerText);
        const around = squash(el.parentElement ? el.parentElement.innerText : "");
        if (full && !/请选择|未选择/.test(full) && (full.includes(v) || v.includes(full) || full.includes(hitText))) return true;
        if (around.includes(v) && !/请选择|未选择/.test(around)) return true;
        const inner0 = el.querySelector("input");
        if (inner0 && inner0.value && (inner0.value.includes(v) || v.includes(inner0.value))) return true;
      }
      document.body.click(); // 没匹配到或验证失败则收起弹层
      await sleep(150);
      return false;
    }
    // 日期/时间类：先驱动日历弹层点选，失败再写内部 input，最后都校验（日历格子不是选项，跳过候选匹配）
    if (await fillCalendar(v)) {
      await sleep(250);
      if (dateFilled(el, v)) return true;
    }
    const inner = el.matches("input") ? el : el.querySelector("input");
    if (inner && !inner.disabled) {
      inner.removeAttribute("readonly");
      inner.focus();
      setNativeValue(inner, v);
      inner.dispatchEvent(new Event("blur", { bubbles: true }));
      await sleep(400);
      if (dateFilled(el, v)) return true;
    }
    document.body.click(); // 收起弹层
    await sleep(150);
    return false;
  }

  async function applyMapping(fields, mapping) {
    // SPA 容错：AI 返回期间页面可能重渲染，按签名把值迁移到重新定位的元素上
    if (fields.some((f) => !findFieldElement(f))) {
      const bySig = new Map(scanFields().map((f) => [fieldSignature(f), f]));
      const newMapping = {};
      fields = fields.map((old) => {
        if (findFieldElement(old)) {
          newMapping[old.id] = mapping[old.id];
          return old;
        }
        const fresh = bySig.get(fieldSignature(old));
        if (fresh) {
          newMapping[fresh.id] = mapping[old.id];
          return fresh;
        }
        newMapping[old.id] = mapping[old.id];
        return old;
      });
      mapping = newMapping;
    }

    let filled = 0, already = 0;
    const unfilled = [];
    for (const f of fields) {
      const v = String(mapping[f.id] || "").trim();
      if (!v) continue;
      // AI 偶尔会把占位提示/字段名原样返回（多出的空经历组），直接跳过
      if (v === String(f.placeholder || "").trim() || v === String(f.label || "").trim()) continue;
      let ok = false;
      if (f.kind === "radio") {
        const radios = [...document.querySelectorAll(`input[type="radio"][data-qzf-group="${f.id}"]`)];
        const hitRadio = radios.find((el) => {
          const wrap = el.closest("label");
          const l = el.id && document.querySelector(`label[for="${CSS.escape(el.id)}"]`);
          const text = cleanText(l ? l.innerText : "") || cleanText(wrap ? wrap.innerText : "") || el.value;
          return text === v || text.includes(v) || v.includes(text);
        });
        if (hitRadio) {
          if (hitRadio.checked) { ok = true; already++; }
          else { hitRadio.click(); markFilled(hitRadio); ok = true; }
        } else if (radios.length) {
          // 自定义单选（div/span 模拟）：在字段容器内找文本完全匹配的叶子元素点击
          const box = radios[0].closest("li, td, [class*='field'], [class*='item'], form") || radios[0].parentElement;
          const cand = box && [...box.querySelectorAll("span, div, label, a")]
            .filter((x) => isVisible(x) && !x.children.length)
            .find((x) => cleanText(x.innerText) === v);
          if (cand) { cand.click(); markFilled(cand); ok = true; }
        }
      } else if (f.kind === "custom-select") {
        const el = findFieldElement(f);
        if (el) {
          if (cleanText(el.innerText) === v) { ok = true; already++; } // 网站解析已填好同值
          else if (/至今/.test(v) && /结束|截止/.test(f.label || "") && tryCheckUntilNow(el)) { ok = true; }
          else {
            ok = await fillCustomSelect(el, v);
            if (ok) markFilled(el);
          }
        }
      } else {
        const el = findFieldElement(f);
        if (el) {
          if (f.kind === "select") {
            const opts = [...el.options];
            const hitOpt = opts.find((o) => o.text.trim() === v)
              || opts.find((o) => o.value === v)
              || opts.find((o) => (o.text.trim() && (o.text.trim().includes(v) || v.includes(o.text.trim()))));
            if (hitOpt && hitOpt.value !== el.value) {
              el.value = hitOpt.value;
              el.dispatchEvent(new Event("change", { bubbles: true }));
              ok = true;
            } else if (hitOpt) { ok = true; already++; } // 网站解析已选中同值
          } else if (/至今/.test(v) && /结束|截止/.test(f.label || "") && tryCheckUntilNow(el)) {
            ok = true; // 在职经历：勾选「至今」而不是写日期
          } else if (el.value !== v) {
            setNativeValue(el, v);
            ok = true;
            // 只读输入框（日历控件）的值可能被组件回滚，延迟验证，回滚则报未填入
            if (el.readOnly) { await sleep(150); ok = el.value === v; }
          } else { ok = true; already++; } // 网站解析已填好同值
          if (ok) markFilled(el);
        }
      }
      if (ok) filled++;
      else unfilled.push(f.label || f.placeholder || f.name || f.id);
    }
    return { filled, unfilled, already };
  }

  /* 查找页面上的「上传简历」文件框 */
  function findResumeFileInput() {
    for (const el of document.querySelectorAll('input[type="file"]')) {
      if (el.dataset.qzfDone) continue;
      const box = el.closest("div, li, td, form");
      const ctx = [el.accept, el.name, fieldLabel(el), fieldSection(el), box ? cleanText(box.innerText) : ""].join(" ");
      if (/简历|resume|cv\b|附件|attachment/i.test(ctx)) return el;
    }
    return null;
  }

  /* 把选中的简历附件注入文件框，触发官网自带的简历解析 */
  async function tryUploadResume(resumeId) {
    const input = findResumeFileInput();
    if (!input) return false;
    try {
      const att = await sendMsg({ type: "getAttachment", payload: { resume_id: resumeId } });
      if (!att || !att.b64) return false;
      const bin = atob(att.b64);
      const bytes = new Uint8Array(bin.length);
      for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
      const file = new File([bytes], att.name || "resume.pdf", { type: att.type || "application/pdf" });
      const dt = new DataTransfer();
      dt.items.add(file);
      input.files = dt.files;
      input.dataset.qzfDone = "1";
      input.dispatchEvent(new Event("input", { bubbles: true }));
      input.dispatchEvent(new Event("change", { bubbles: true }));
      // 部分站点还需点击邻近的「上传」按钮才真正提交
      const box = input.closest("div, li, td, form");
      const upBtn = box && [...box.querySelectorAll("button, a, [role='button']")]
        .find((b) => isVisible(b) && /^(上传|确认上传|开始上传|上传简历|立即上传)$/.test(cleanText(b.innerText)));
      if (upBtn) upBtn.click();
      return true;
    } catch (e) {
      return false; // 无附件或注入失败时静默跳过，走纯 AI 填写
    }
  }

  /* 查找页面上的「证件照」文件框（排除简历/附件框） */
  function findPhotoFileInput() {
    for (const el of document.querySelectorAll('input[type="file"]')) {
      if (el.dataset.qzfPhotoDone) continue;
      const box = el.closest("div, li, td, form");
      const ctx = [el.accept, el.name, fieldLabel(el), fieldSection(el), box ? cleanText(box.innerText) : ""].join(" ");
      if (/简历|resume|cv\b|附件|attachment/i.test(ctx)) continue; // 简历框不重复处理
      // 站点已传过照片（显示重新上传/已上传）则不覆盖
      if (box && /重新上传|已上传/.test(cleanText(box.innerText))) { el.dataset.qzfPhotoDone = "1"; continue; }
      if (/证件照|照片|头像|个人照|photo|avatar/i.test(ctx)) return el;
    }
    return null;
  }

  /* 把证件照注入照片上传框 */
  async function tryUploadPhoto(resumeId) {
    const input = findPhotoFileInput();
    if (!input) return false;
    try {
      const att = await sendMsg({ type: "getPhoto", payload: { resume_id: resumeId } });
      if (!att || !att.b64) return false;
      const bin = atob(att.b64);
      const bytes = new Uint8Array(bin.length);
      for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
      const file = new File([bytes], att.name || "photo.jpg", { type: att.type || "image/jpeg" });
      const dt = new DataTransfer();
      dt.items.add(file);
      input.files = dt.files;
      input.dataset.qzfPhotoDone = "1";
      input.dispatchEvent(new Event("input", { bubbles: true }));
      input.dispatchEvent(new Event("change", { bubbles: true }));
      return true;
    } catch (e) {
      return false; // 未上传证件照或注入失败时静默跳过
    }
  }

  /* 点击「添加一段经历」类按钮展开多段区块：按简历里的经历条数决定点几次（字段数不再增长则停） */
  async function expandRepeatBlocks(resumeId) {
    let clicked = 0;
    const counts = resumeCounts[resumeId] || {};
    const countFields = () => document.querySelectorAll("input, textarea, select").length;
    const doClick = (el) => {
      for (const type of ["mousedown", "mouseup", "click"]) {
        el.dispatchEvent(new MouseEvent(type, { bubbles: true, cancelable: true, view: window }));
      }
    };
    const cands = [...document.querySelectorAll("button, a, [role='button'], [class*='add'], [class*='Add'], span, div")];
    for (const b of cands) {
      if (!isVisible(b) || b.dataset.qzfDone) continue;
      if (b.closest("#qzf-panel, nav, header, [class*='nav'], [class*='menu'], [class*='Menu']")) continue; // 导航/菜单/自身面板里的不点
      if (b.childElementCount > 3) continue; // 按钮不会嵌套太深，跳过大容器（也避免整页 innerText 开销）
      if (b.tagName === "A" && !/^(javascript:|#|$)/.test(b.getAttribute("href") || "")) continue; // 真链接不点，防跳走
      const t = cleanText(b.innerText);
      if (!t || t.length > 16) continue;
      const buttonLike = /^(BUTTON|A)$/.test(b.tagName) || b.getAttribute("role") === "button" || /add/i.test(String(b.className));
      // 非按钮类元素（span/div）要求文本形如「+ 添加xx经历」（动词开头、区块名词结尾），避免误点页面其它区域
      const matched = buttonLike
        ? /添加|新增|加一|继续添加/.test(t) && /经历|项目|教育|工作|实习|经验|奖励|证书|语言|作品/.test(t)
        : /^(?:[＋+]\s*)?(?:添加|新增|继续添加|加一)/.test(t) && /(?:经历|项目|教育|工作|实习|经验|奖励|证书|语言|作品)$/.test(t);
      if (!matched) continue;
      // 只取最内层元素，避免父容器与子按钮文本相同而重复点击
      if ([...b.children].some((c) => cleanText(c.innerText) === t)) continue;
      b.dataset.qzfDone = "1";
      // 该按钮要凑出几组：项目按简历项目数，工作/实习按经历数，其余默认 2 组
      let groups = 2;
      if (/项目/.test(t) && counts.proj) groups = Math.min(counts.proj, 4);
      else if (/工作|实习|经验/.test(t) && counts.work) groups = Math.min(counts.work, 4);
      // 估算已有几组：优先数区块内的标志字段（公司/单位、项目名称），数不到再数「删除」按钮
      const secBox = b.closest("section, fieldset, form, [class*='section'], [class*='module'], [class*='block']") || b.parentElement;
      let existing = 0;
      if (secBox) {
        const landmark = /项目/.test(t) ? /项目名称/ : (/工作|实习|经验/.test(t) ? /公司|单位/ : null);
        if (landmark) {
          existing = [...secBox.querySelectorAll("input, textarea")]
            .filter((el) => landmark.test((el.placeholder || "") + " " + fieldLabel(el))).length;
        }
        if (!existing) {
          existing = [...secBox.querySelectorAll("button, a, span, div")]
            .filter((x) => !x.children.length && cleanText(x.innerText) === "删除").length;
        }
      }
      for (let i = Math.max(existing, 1); i < groups; i++) {
        const before = countFields();
        doClick(b);
        clicked++;
        // 轮询等新区块渲染（最多 2 秒），不增长说明到上限
        let grew = false;
        for (let w = 0; w < 8; w++) {
          await sleep(250);
          if (countFields() > before) { grew = true; break; }
        }
        if (!grew) break;
      }
    }
    return clicked;
  }

  /* ---------- 主流程 ---------- */
  fillBtn.addEventListener("click", async () => {
    const resumeId = resumeSel.value;
    if (!resumeId) { setStatus("请先选择一份简历"); return; }
    fillBtn.disabled = true;
    // ① 页面有「上传简历」入口时，先自动注入简历附件，让官网自己解析一轮
    if (await tryUploadResume(resumeId)) {
      setStatus("已自动上传简历附件，等待网站解析（约 8 秒）…");
      await sleep(8000);
    }
    // ② 页面有「证件照」上传框且未传过照片时，自动注入证件照
    await tryUploadPhoto(resumeId);
    // ③ 展开「添加经历」类按钮，按简历经历条数凑出多段区块
    if (await expandRepeatBlocks(resumeId) > 0) await sleep(900);
    const fields = scanFields();
    if (!fields.length) { setStatus("本页未找到可填写的表单字段"); fillBtn.disabled = false; return; }
    setStatus(`已识别 ${fields.length} 个字段，AI 正在生成填写内容（约 10~30 秒，期间请勿操作页面）…`);
    try {
      const result = await sendMsg({
        type: "fillForm",
        payload: { resume_id: resumeId, page_url: location.href, fields },
      });
      const { filled, unfilled, already } = await applyMapping(fields, result.mapping || {});
      let msg = `识别 ${fields.length} 个字段 · AI 生成 ${result.filled || 0} 个值 · 本次填入 ${filled} 个（绿色高亮）`;
      if (already) msg += ` · ${already} 个已有相同值无需改动`;
      if (unfilled.length) {
        msg += `\n未填入：${unfilled.slice(0, 6).join("、")}${unfilled.length > 6 ? " 等" : ""}（可能需手动选择）`;
      }
      msg += "\n请检查标绿内容后再自行提交。";
      setStatus(msg);
    } catch (e) {
      setStatus(`填写失败：${e.message}`);
    } finally {
      fillBtn.disabled = false;
    }
  });
})();
