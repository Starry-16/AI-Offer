/* ================= 秋招助手前端逻辑 ================= */

/* ---------- 常量 ---------- */
const STATUS = {
  applied:      { label: '已投递', color: '#3b82f6' },
  written_test: { label: '笔试中', color: '#8b5cf6' },
  interview:    { label: '面试中', color: '#f59e0b' },
  offer:        { label: '已 Offer', color: '#10b981' },
  rejected:     { label: '未通过', color: '#ef4444' },
  declined:     { label: '已放弃', color: '#94a3b8' },
};

const CATEGORIES = ['算法', '计算机网络', '操作系统', '数据库', 'Java', '场景设计', '项目经历', '其他'];

const DIFFICULTY = { easy: '简单', medium: '中等', hard: '困难' };

const EVENT_TYPES = ['投递', '笔试', '一面', '二面', '三面', 'HR 面', 'Offer', '感谢信', '其他'];

/* 网申补充信息字段（随简历保存，插件自动填写时优先采用）：[key, 中文名, placeholder] */
const PROFILE_FIELDS = [
  ['gender', '性别', '男 / 女'],
  ['birth', '出生年月', '如 2002-03'],
  ['ethnicity', '民族', '如 汉族'],
  ['native_place', '籍贯（精确到市）', '如 山东青岛'],
  ['current_city', '现居住地', '如 北京'],
  ['id_number', '身份证号', '18 位号码'],
  ['college', '学院名称', '如 计算机学院'],
  ['ranking', '成绩排名', '如 前10% / 5/120'],
  ['cultivation', '培养方式', '如 全日制统招'],
  ['computer_skill', '计算机能力', '如 计算机二级'],
  ['languages', '编程语言', '如 Python、C++'],
  ['proficiency', '熟练度', '如 熟练 / 精通'],
  ['relative_in_company', '有无内部亲属关系', '一般填：无'],
  ['self_eval', '自我评价', '100 字以内'],
  ['height', '身高（厘米）', '如 175'],
  ['weight', '体重（公斤）', '如 65'],
  ['referral_source', '招聘信息来源', '如 官网 / 内推 / 牛客'],
  ['english_cert', '英语四六级成绩', '如 CET-6 520'],
  ['lab_name', '实验室名称', '如 智能计算实验室'],
  ['lab_level', '实验室级别', '如 国家级 / 省部级'],
  ['advisor', '导师姓名', ''],
  ['wechat', '微信号', ''],
  ['qq', 'QQ号', ''],
  ['work_department', '工作部门', '如 算法部'],
];

/* SVG 图标库 */
const ICONS = {
  inbox: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><path d="M22 12h-6l-2 3h-4l-2-3H2"/><path d="M5.45 5.11L2 12v6a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2v-6l-3.45-6.89A2 2 0 0 0 16.76 4H7.24a2 2 0 0 0-1.79 1.11z"/></svg>',
  send: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M22 2L11 13M22 2l-7 20-4-9-9-4 20-7z"/></svg>',
  calendar: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="3" y="4" width="18" height="18" rx="2"/><path d="M16 2v4M8 2v4M3 10h18"/></svg>',
  award: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="8" r="6"/><path d="M15.5 13.5L17 22l-5-3-5 3 1.5-8.5"/></svg>',
  book: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M2 3h6a4 4 0 0 1 4 4v14a3 3 0 0 0-3-3H2zM22 3h-6a4 4 0 0 0-4 4v14a3 3 0 0 1 3-3h7z"/></svg>',
};

/* ---------- 全局状态 ---------- */
const state = {
  applications: [],
  resumes: [],
  questions: [],
  appFilter: 'all',
  appCategory: '',
  appSearch: '',
  importQueue: [],     // 后台导入队列（串行执行）
    importRunning: false,
  qFilters: { category: '', mastery: '', wrong: false, keyword: '' },
  companies: [],
  companyFilters: { category: '', position: '', keyword: '' },
  positionTypes: [],    // 岗位分类规范选项（来自 /api/companies/meta）
  matchResults: null,   // 最近一次岗位匹配结果
  chat: [],
  chatModel: localStorage.getItem('chatModel') || '',  // 聊天选中的模型
  appEvents: [],       // 投递编辑弹窗中的时间线事件
  appExpanded: new Set(), // 投递列表中展开详情的行 id
  practice: null,      // 练习模式 {list, index, revealed}
};

/* ---------- 工具函数 ---------- */
const $ = (sel, root = document) => root.querySelector(sel);
const $$ = (sel, root = document) => [...root.querySelectorAll(sel)];

function esc(s) {
  return String(s ?? '').replace(/[&<>"']/g, c => (
    { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]
  ));
}

function toast(msg, type = 'success') {
  const el = document.createElement('div');
  el.className = `toast toast-${type}`;
  el.textContent = msg;
  $('#toast-root').appendChild(el);
  setTimeout(() => el.remove(), 2800);
}

async function api(path, opts = {}) {
  const resp = await fetch(path, {
    headers: { 'Content-Type': 'application/json' },
    ...opts,
    body: opts.body !== undefined && typeof opts.body !== 'string'
      ? JSON.stringify(opts.body) : opts.body,
  });
  if (!resp.ok) {
    let detail = `请求失败（${resp.status}）`;
    try { detail = (await resp.json()).detail || detail; } catch (e) { /* ignore */ }
    throw new Error(detail);
  }
  return resp.json();
}

function today() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

/* 统一空状态（图标 + 文案） */
function emptyHtml(text) {
  return `<div class="empty"><div class="empty-icon">${ICONS.inbox}</div><div>${text}</div></div>`;
}

/* ---------- 弹窗 ---------- */
function openModal(html) {
  $('#modal-root').innerHTML = `
    <div class="modal-overlay" data-close-on-click="1">
      <div class="modal">${html}</div>
    </div>`;
  $('#modal-root .modal-overlay').addEventListener('click', e => {
    if (e.target.dataset.closeOnClick) closeModal();
  });
  $$('#modal-root [data-close]').forEach(b => b.addEventListener('click', closeModal));
}

function closeModal() { $('#modal-root').innerHTML = ''; }

/* ---------- Tab 切换 ---------- */
const TAB_LOADERS = {
  dashboard: loadDashboard,
  applications: loadApplications,
  resumes: loadResumes,
  questions: loadQuestions,
  companies: loadCompanies,
  match: loadMatch,
  ai: loadAiTab,
  settings: loadSettings,
};

function switchTab(name) {
  $$('.sidebar nav a').forEach(a => a.classList.toggle('active', a.dataset.tab === name));
  $$('.tab').forEach(s => s.classList.toggle('active', s.id === `tab-${name}`));
  TAB_LOADERS[name]?.();
}

$$('.sidebar nav a').forEach(a => a.addEventListener('click', e => {
  e.preventDefault();
  switchTab(a.dataset.tab);
}));

/* ================= 概览页 ================= */
async function loadDashboard() {
  const s = await api('/api/stats');
  const offers = s.status_counts.offer || 0;
  const interviewing = s.status_counts.interview || 0;
  const total = s.total_applications;

  const activeHtml = s.active_processes.length
    ? s.active_processes.map(a => `
        <div class="timeline-item">
          <div class="timeline-dot" style="background:${STATUS[a.status].color}"></div>
          <div>
            <strong>${esc(a.company)}</strong> · ${esc(a.position)}
            <span class="badge ${(a.category === '实习') ? 'badge-intern' : 'badge-autumn'}" style="margin-left:6px">${esc(a.category || '秋招')}</span><br>
            <span class="td-sub">${STATUS[a.status].label}${a.stage ? ' · ' + esc(a.stage) : ''}</span>
          </div>
        </div>`).join('')
    : emptyHtml('暂无进行中的流程，去投递页看看');

  const recentHtml = s.recent_events.length
    ? s.recent_events.map(ev => `
        <div class="timeline-item">
          <div class="timeline-dot"></div>
          <div>
            <strong>${esc(ev.company)}</strong> · ${esc(ev.type)}
            ${ev.note ? '<br><span class="td-sub">' + esc(ev.note) + '</span>' : ''}
          </div>
          <div class="timeline-date">${esc(ev.date)}</div>
        </div>`).join('')
    : emptyHtml('近 7 天暂无新动态');

  const statValues = {
    total: total,
    interviewing,
    offers,
    weak: s.weak_questions_count,
  };
  const statCards = [
    { key: 'total', label: '累计投递', icon: ICONS.send, color: '#4f46e5', soft: '#eef2ff', goto: { tab: 'applications', filter: 'all' } },
    { key: 'interviewing', label: '面试进行中', icon: ICONS.calendar, color: '#f59e0b', soft: '#fffbeb', goto: { tab: 'applications', filter: 'interview' } },
    { key: 'offers', label: '已拿 Offer', icon: ICONS.award, color: '#10b981', soft: '#ecfdf5', goto: { tab: 'applications', filter: 'offer' } },
    { key: 'weak', label: '待巩固题目（≤2 星）', icon: ICONS.book, color: '#64748b', soft: '#f1f5f9', goto: { tab: 'questions', mastery: '2' } },
  ];

  $('#tab-dashboard').innerHTML = `
    <div class="tab-head">
      <div>
        <h1>秋招概览</h1>
        <p class="sub">掌握全局进度，稳步推进</p>
      </div>
      <div class="head-actions">
        <button class="btn" data-quick="practice">开始练习</button>
        <button class="btn btn-primary" data-quick="new-application">+ 新增投递</button>
      </div>
    </div>
    <div class="stat-cards">
      ${statCards.map((c, i) => `
        <div class="card stat-card" data-goto="${i}" title="点击查看明细" style="--accent:${c.color};--accent-soft:${c.soft}">
          <div class="stat-icon">${c.icon}</div>
          <div><div class="num">${statValues[c.key]}</div><div class="label">${c.label}</div></div>
        </div>`).join('')}
    </div>
    <div class="dash-grid">
      <div class="card">
        <div class="dash-section-title">进行中的流程</div>
        ${activeHtml}
      </div>
      <div class="card">
        <div class="dash-section-title">投递状态分布</div>
        ${total ? donutHtml(s.status_counts, total) : emptyHtml('还没有投递记录，点击右上角「新增投递」开始')}
      </div>
      <div class="card full">
        <div class="dash-section-title">近 7 天动态</div>
        ${recentHtml}
      </div>
    </div>`;

  $$('#tab-dashboard [data-quick]').forEach(btn => btn.addEventListener('click', () => {
    const action = btn.dataset.quick;
    if (action === 'new-application') { switchTab('applications'); openApplicationModal(); }
    if (action === 'practice') { switchTab('questions'); startPractice(); }
  }));
  // 统计卡片点击跳转对应页面并带上筛选
  $$('#tab-dashboard [data-goto]').forEach(card => card.addEventListener('click', () => {
    const target = statCards[Number(card.dataset.goto)].goto;
    if (target.tab === 'applications') state.appFilter = target.filter;
    if (target.tab === 'questions') {
      state.qFilters.mastery = target.mastery;
      $('#question-mastery').value = target.mastery;
    }
    switchTab(target.tab);
  }));
}

/* 状态分布环形图（纯 CSS conic-gradient） */
function donutHtml(statusCounts, total) {
  let acc = 0;
  const segs = [];
  const legend = Object.entries(STATUS).map(([k, meta]) => {
    const n = statusCounts[k] || 0;
    const start = (acc / total) * 360;
    acc += n;
    const end = (acc / total) * 360;
    if (n > 0) segs.push(`${meta.color} ${start}deg ${end}deg`);
    const pct = ((n / total) * 100).toFixed(0);
    return `
      <div class="legend-item">
        <span class="legend-dot" style="background:${meta.color}"></span>
        <span class="legend-label">${meta.label}</span>
        <span class="legend-count">${n}</span>
        <span class="legend-pct">${pct}%</span>
      </div>`;
  }).join('');
  const bg = segs.length ? `conic-gradient(${segs.join(',')})` : '#f1f5f9';
  return `
    <div class="donut-wrap">
      <div class="donut" style="background:${bg}">
        <div class="donut-hole"><div class="donut-num">${total}</div><div class="donut-label">总投递</div></div>
      </div>
      <div class="donut-legend">${legend}</div>
    </div>`;
}

/* ================= 投递管理 ================= */
function renderStatusChips() {
  const chips = [['all', '全部'], ...Object.entries(STATUS).map(([k, v]) => [k, v.label])];
  $('#application-status-chips').innerHTML = chips.map(([key, label]) =>
    `<span class="chip ${state.appFilter === key ? 'active' : ''}" data-chip="${key}">${label}</span>`
  ).join('');
  $$('#application-status-chips .chip').forEach(c => c.addEventListener('click', () => {
    state.appFilter = c.dataset.chip;
    renderStatusChips();
    renderApplicationTable();
  }));
}

async function loadApplications() {
  state.applications = await api('/api/applications');
  renderStatusChips();
  renderApplicationTable();
}

function renderApplicationTable() {
  const kw = state.appSearch.trim().toLowerCase();
  const items = state.applications.filter(a =>
    (state.appFilter === 'all' || a.status === state.appFilter) &&
    (!state.appCategory || (a.category || '秋招') === state.appCategory) &&
    (!kw || `${a.company}${a.position}`.toLowerCase().includes(kw))
  );

  if (!items.length) {
    $('#application-list').innerHTML = '<div class="table-wrap">' + emptyHtml('暂无符合条件的投递记录') + '</div>';
    return;
  }

  $('#application-list').innerHTML = `
    <table>
      <thead><tr>
        <th>公司 / 岗位</th><th>状态</th><th>投递日期</th><th>当前进展</th><th>操作</th>
      </tr></thead>
      <tbody>
        ${items.map(a => {
          const meta = STATUS[a.status] || STATUS.applied;
          const latest = [...(a.events || [])].sort((x, y) => (y.date || '').localeCompare(x.date || ''))[0];
          const expanded = state.appExpanded.has(a.id);
          return `
          <tr class="app-row ${expanded ? 'expanded' : ''}" data-app-row="${a.id}" title="点击展开时间线详情">
            <td>
              <div class="td-company">
                ${esc(a.company)}
                <span class="badge ${(a.category === '实习') ? 'badge-intern' : 'badge-autumn'}" style="margin-left:6px">${esc(a.category || '秋招')}</span>
              </div>
              <div class="td-sub">${esc(a.position)}${a.location ? ' · ' + esc(a.location) : ''}${a.channel ? ' · ' + esc(a.channel) : ''}</div>
            </td>
            <td><span class="badge" style="background:${meta.color}1a;color:${meta.color}">${meta.label}</span></td>
            <td>${esc(a.apply_date || '—')}</td>
            <td>
              <div>${esc(a.stage || '—')}</div>
              ${latest && latest.date ? `<div class="td-sub">最近：${esc(latest.date)} ${esc(latest.type)}</div>` : ''}
            </td>
            <td class="td-actions">
              <button class="btn btn-sm" data-edit-app="${a.id}">编辑</button>
              <button class="btn btn-sm btn-danger" data-del-app="${a.id}">删除</button>
              <span class="chevron">▾</span>
            </td>
          </tr>
          ${expanded ? `<tr class="detail-row"><td colspan="5">${appDetailHtml(a)}</td></tr>` : ''}`;
        }).join('')}
      </tbody>
    </table>`;

  $$('#application-list .app-row').forEach(row => row.addEventListener('click', e => {
    if (e.target.closest('button') || e.target.closest('a')) return;
    const id = row.dataset.appRow;
    state.appExpanded.has(id) ? state.appExpanded.delete(id) : state.appExpanded.add(id);
    renderApplicationTable();
  }));

  $$('#application-list [data-edit-app]').forEach(b => b.addEventListener('click', () => {
    const app = state.applications.find(x => x.id === b.dataset.editApp);
    openApplicationModal(app);
  }));
  $$('#application-list [data-del-app]').forEach(b => b.addEventListener('click', async () => {
    if (!confirm('确认删除这条投递记录？')) return;
    await api(`/api/applications/${b.dataset.delApp}`, { method: 'DELETE' });
    toast('已删除');
    loadApplications();
  }));
}

/* 投递行展开详情：竖向时间线 + 更多信息 */
function appDetailHtml(a) {
  const events = [...(a.events || [])].sort((x, y) => (x.date || '').localeCompare(y.date || ''));
  const tl = events.length
    ? `<div class="tl">${events.map(ev => `
        <div class="tl-item">
          <span class="tl-date">${esc(ev.date)}</span><span class="tl-type">${esc(ev.type)}</span>
          ${ev.note ? `<span class="tl-note">${esc(ev.note)}</span>` : ''}
        </div>`).join('')}</div>`
    : '<div class="td-sub">暂无时间线事件</div>';
  const kvs = [
    a.channel ? `<div><span class="k">投递渠道</span>${esc(a.channel)}</div>` : '',
    a.location ? `<div><span class="k">工作地点</span>${esc(a.location)}</div>` : '',
    a.link ? `<div><span class="k">职位链接</span><a href="${esc(a.link)}" target="_blank" rel="noopener">${esc(a.link)}</a></div>` : '',
    a.note ? `<div><span class="k">备注</span>${esc(a.note)}</div>` : '',
  ].filter(Boolean).join('');
  return `
    <div class="app-detail">
      <div class="app-detail-grid">
        <div><h4>时间线</h4>${tl}</div>
        <div>
          <h4>更多信息</h4>
          <div class="detail-kv">${kvs || '<span class="td-sub">暂无补充信息</span>'}</div>
        </div>
      </div>
    </div>`;
}

function openApplicationModal(app = null) {
  state.appEvents = app?.events?.length
    ? app.events.map(e => ({ ...e }))
    : [{ date: today(), type: '投递', note: '' }];

  openModal(`
    <h2>${app ? '编辑投递' : '新增投递'}</h2>
    <div class="form-row">
      <div>
        <label class="field-label">公司 *</label>
        <input class="input" id="app-company" value="${esc(app?.company)}" placeholder="如：字节跳动">
      </div>
      <div>
        <label class="field-label">岗位 *</label>
        <input class="input" id="app-position" value="${esc(app?.position)}" placeholder="如：后端开发工程师">
      </div>
      <div>
        <label class="field-label">地点</label>
        <input class="input" id="app-location" value="${esc(app?.location)}" placeholder="如：北京">
      </div>
      <div>
        <label class="field-label">投递渠道</label>
        <input class="input" id="app-channel" value="${esc(app?.channel)}" placeholder="如：官网 / Boss 直聘">
      </div>
      <div>
        <label class="field-label">类型</label>
        <select class="input select" id="app-category">
          <option value="秋招" ${app?.category !== '实习' ? 'selected' : ''}>秋招</option>
          <option value="实习" ${app?.category === '实习' ? 'selected' : ''}>实习</option>
        </select>
      </div>
      <div>
        <label class="field-label">当前状态</label>
        <select class="input select" id="app-status">
          ${Object.entries(STATUS).map(([k, v]) => `<option value="${k}" ${app?.status === k ? 'selected' : ''}>${v.label}</option>`).join('')}
        </select>
      </div>
      <div>
        <label class="field-label">投递日期</label>
        <input class="input" type="date" id="app-apply-date" value="${esc(app?.apply_date || today())}">
      </div>
    </div>
    <label class="field-label">当前进展（如：等待二面通知）</label>
    <input class="input" id="app-stage" value="${esc(app?.stage)}" placeholder="一句话描述当前所处阶段">
    <label class="field-label">职位链接</label>
    <input class="input" id="app-link" value="${esc(app?.link)}" placeholder="https://…">
    <label class="field-label">时间线</label>
    <div id="event-rows">${renderEventRows()}</div>
    <button class="btn btn-sm" id="btn-add-event">+ 添加事件</button>
    <label class="field-label">备注</label>
    <textarea class="input" id="app-note" rows="3" placeholder="其他想记录的信息…">${esc(app?.note)}</textarea>
    <div class="modal-actions">
      <button class="btn" data-close="1">取消</button>
      <button class="btn btn-primary" id="btn-save-app">保存</button>
    </div>`);

  $('#btn-add-event').addEventListener('click', () => {
    state.appEvents.push({ date: today(), type: '其他', note: '' });
    $('#event-rows').innerHTML = renderEventRows();
  });

  $('#event-rows').addEventListener('click', e => {
    const btn = e.target.closest('[data-del-ev]');
    if (btn) {
      state.appEvents.splice(Number(btn.dataset.delEv), 1);
      $('#event-rows').innerHTML = renderEventRows();
    }
  });
  $('#event-rows').addEventListener('change', e => {
    const f = e.target.dataset.f;
    if (!f) return;
    state.appEvents[Number(e.target.dataset.ev)][f] = e.target.value;
  });

  $('#btn-save-app').addEventListener('click', async () => {
    const body = {
      company: $('#app-company').value.trim(),
      position: $('#app-position').value.trim(),
      location: $('#app-location').value.trim(),
      channel: $('#app-channel').value.trim(),
      category: $('#app-category').value,
      status: $('#app-status').value,
      stage: $('#app-stage').value.trim(),
      apply_date: $('#app-apply-date').value,
      link: $('#app-link').value.trim(),
      note: $('#app-note').value.trim(),
      events: state.appEvents.filter(e => e.date || e.note).map(e => ({ ...e, note: e.note.trim() })),
    };
    if (!body.company || !body.position) { toast('请填写公司与岗位', 'error'); return; }
    try {
      if (app) await api(`/api/applications/${app.id}`, { method: 'PUT', body });
      else await api('/api/applications', { method: 'POST', body });
      toast('已保存');
      closeModal();
      loadApplications();
    } catch (e) { toast(e.message, 'error'); }
  });
}

function renderEventRows() {
  return state.appEvents.map((ev, i) => `
    <div class="event-row">
      <input class="input" type="date" value="${esc(ev.date)}" data-ev="${i}" data-f="date">
      <select class="input select" data-ev="${i}" data-f="type">
        ${EVENT_TYPES.map(t => `<option ${ev.type === t ? 'selected' : ''}>${t}</option>`).join('')}
      </select>
      <input class="input" value="${esc(ev.note)}" placeholder="备注（如：一面通过）" data-ev="${i}" data-f="note">
      <button class="btn btn-danger btn-sm" data-del-ev="${i}">×</button>
    </div>`).join('');
}

/* ================= 智能导入（后台队列，串行执行） ================= */
function openImportModal() {
  openModal(`
    <h2>智能导入投递记录</h2>
    <div class="import-tip">
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"/><line x1="12" y1="16" x2="12" y2="12"/><line x1="12" y1="8" x2="12.01" y2="8"/></svg>
      <div>
        招聘网站的投递记录页通常需要登录，无法直接抓链接。<strong>推荐做法</strong>：在浏览器打开你的投递记录页，<code>Ctrl+A</code> 全选 → <code>Ctrl+C</code> 复制 → 粘贴到下方。<br>
        提交后在后台自动解析导入，你可以继续其他操作或接着导入下一份，多个任务排队串行执行，完成后会弹出提示。
      </div>
    </div>
    <textarea class="input import-textarea" id="import-text" placeholder="粘贴投递记录页面的文本，或粘贴链接…"></textarea>
    <div class="import-parse-row">
      <span class="hint">AI 已配置时用智能解析，否则用基础解析</span>
      <span class="spacer"></span>
      <button class="btn" data-close="1">取消</button>
      <button class="btn btn-primary" id="btn-do-import">开始后台导入</button>
    </div>`);

  $('#btn-do-import').addEventListener('click', () => {
    const text = $('#import-text').value.trim();
    if (!text) { toast('请先粘贴内容或链接', 'error'); return; }
    enqueueImport(text);
    closeModal();
  });
}

function enqueueImport(text) {
  state.importQueue.push(text);
  const pos = state.importQueue.length + (state.importRunning ? 1 : 0);
  toast(pos > 1 ? `已加入后台导入队列（第 ${pos} 位）` : '已加入后台导入队列', 'info');
  updateImportIndicator();
  processImportQueue();
}

async function processImportQueue() {
  if (state.importRunning) return; // 保证串行，已在执行时直接返回
  state.importRunning = true;
  while (state.importQueue.length) {
    const text = state.importQueue.shift();
    updateImportIndicator();
    try {
      const r = await api('/api/applications/import/parse', { method: 'POST', body: { text } });
      if (r.need_manual) throw new Error(r.message || '内容需要手动整理后再导入');
      if (!r.records || !r.records.length) throw new Error('未能解析出投递记录，请检查粘贴的内容');
      const records = r.records.map(rec => ({
        company: rec.company || '待确认',
        position: rec.position || '待确认',
        category: rec.category || '秋招',
        status: rec.status || 'applied',
        apply_date: rec.apply_date || '',
        note: rec.note || '',
        location: '', channel: '', stage: '', link: '', events: [],
      }));
      const ir = await api('/api/applications/import', { method: 'POST', body: { records } });
      const parts = [];
      if (ir.count) parts.push(`新增 ${ir.count} 条`);
      if (ir.updated) parts.push(`更新 ${ir.updated} 条进度`);
      if (ir.skipped) parts.push(`${ir.skipped} 条无变化`);
      const hasChange = ir.count > 0 || ir.updated > 0;
      toast(parts.length ? `后台导入完成：${parts.join('，')}` : '后台导入完成：没有识别到记录', hasChange ? 'success' : 'info');
      if (hasChange) loadApplications();
    } catch (e) {
      toast(`后台导入失败：${e.message}`, 'error');
    }
  }
  state.importRunning = false;
  updateImportIndicator();
}

/* 左下角浮动进度指示 */
function updateImportIndicator() {
  let el = $('#import-indicator');
  const pending = state.importQueue.length + (state.importRunning ? 1 : 0);
  if (!pending) { if (el) el.remove(); return; }
  if (!el) {
    el = document.createElement('div');
    el.id = 'import-indicator';
    document.body.appendChild(el);
  }
  el.textContent = `后台导入中…剩余 ${pending} 项`;
}

/* ================= 企业库 ================= */
async function loadCompanies() {
  // 首次进入时加载岗位类型规范选项
  if (!state.positionTypes.length) {
    try {
      const meta = await api('/api/companies/meta');
      state.positionTypes = meta.position_types || [];
      $('#company-position').innerHTML = '<option value="">全部岗位</option>' +
        state.positionTypes.map(p => `<option value="${esc(p)}">${esc(p)}</option>`).join('');
    } catch (e) { /* 忽略，下拉里后续再试 */ }
  }
  const f = state.companyFilters;
  const params = new URLSearchParams();
  if (f.category) params.set('category', f.category);
  if (f.position) params.set('position', f.position);
  if (f.keyword) params.set('keyword', f.keyword);
  state.companies = await api('/api/companies?' + params.toString());
  renderCompanyChips();
  renderCompanyTable();
}

function renderCompanyChips() {
  // 分类 chips 基于当前已加载公司动态生成
  const cats = [...new Set(state.companies.map(c => c.category).filter(Boolean))];
  const all = ['', ...cats];
  $('#company-category-chips').innerHTML = all.map(c =>
    `<button class="chip ${state.companyFilters.category === c ? 'active' : ''}" data-cat="${esc(c)}">${c ? esc(c) : '全部'}</button>`).join('');
  $$('#company-category-chips .chip').forEach(b => b.addEventListener('click', () => {
    state.companyFilters.category = b.dataset.cat;
    loadCompanies();
  }));
}

function renderCompanyTable() {
  if (!state.companies.length) {
    $('#company-list').innerHTML = emptyHtml('企业库为空，点击右上角「导入内置库」获取互联网 / 金融企业清单');
    return;
  }
  $('#company-list').innerHTML = `
    <table>
      <thead><tr>
        <th>公司名称</th><th>企业分类</th><th>岗位分类</th><th>投递链接</th><th>操作</th>
      </tr></thead>
      <tbody>
        ${state.companies.map(c => `
          <tr>
            <td><strong>${esc(c.name)}</strong></td>
            <td><span class="badge badge-autumn">${esc(c.category || '')}</span></td>
            <td>${(c.positions || []).map(p => `<span class="pos-tag">${esc(p)}</span>`).join('')}</td>
            <td>${c.url ? `<a class="btn btn-sm link-btn" href="${esc(c.url)}" target="_blank" rel="noopener">去投递 ↗</a>` : '<span class="td-sub">未填写</span>'}</td>
            <td class="actions">
              <button class="btn btn-sm" data-edit-company="${c.id}">编辑</button>
              <button class="btn btn-sm btn-danger" data-del-company="${c.id}">删除</button>
            </td>
          </tr>`).join('')}
      </tbody>
    </table>`;
  $$('#company-list [data-edit-company]').forEach(b => b.addEventListener('click', () =>
    openCompanyModal(state.companies.find(c => c.id === b.dataset.editCompany))));
  $$('#company-list [data-del-company]').forEach(b => b.addEventListener('click', () => deleteCompany(b.dataset.delCompany)));
}

function openCompanyModal(c = null) {
  const cats = ['互联网', '科技', '银行', '券商基金', '保险', '金融科技'];
  const positions = c ? (c.positions || []) : [];
  openModal(`
    <h3>${c ? '编辑企业' : '新增企业'}</h3>
    <label class="field-label">公司名称 *</label>
    <input class="input" id="f-c-name" value="${c ? esc(c.name) : ''}" placeholder="如：腾讯">
    <label class="field-label">企业分类</label>
    <select class="input" id="f-c-category">
      ${cats.map(x => `<option ${c && c.category === x ? 'selected' : ''}>${x}</option>`).join('')}
    </select>
    <label class="field-label">岗位分类（可多选）</label>
    <div class="pos-checks" id="f-c-positions">
      ${state.positionTypes.map(p => `
        <label class="pos-check"><input type="checkbox" value="${esc(p)}" ${positions.includes(p) ? 'checked' : ''}><span>${esc(p)}</span></label>`).join('')}
    </div>
    <label class="field-label">投递链接</label>
    <input class="input" id="f-c-url" value="${c ? esc(c.url || '') : ''}" placeholder="https://…">
    <div class="modal-actions">
      <button class="btn" data-close>取消</button>
      <button class="btn btn-primary" id="f-c-save">保存</button>
    </div>`);
  $('#f-c-save').addEventListener('click', async () => {
    const body = {
      name: $('#f-c-name').value.trim(),
      category: $('#f-c-category').value,
      positions: $$('#f-c-positions input:checked').map(i => i.value),
      url: $('#f-c-url').value.trim(),
    };
    if (!body.name) { toast('请填写公司名称', 'error'); return; }
    try {
      if (c) await api(`/api/companies/${c.id}`, { method: 'PUT', body });
      else await api('/api/companies', { method: 'POST', body });
      toast('已保存');
      closeModal();
      loadCompanies();
    } catch (e) { toast(e.message, 'error'); }
  });
}

async function deleteCompany(id) {
  if (!confirm('确定删除这家企业吗？')) return;
  try {
    await api(`/api/companies/${id}`, { method: 'DELETE' });
    toast('已删除');
    loadCompanies();
  } catch (e) { toast(e.message, 'error'); }
}

async function seedCompanies() {
  try {
    const r = await api('/api/companies/seed', { method: 'POST' });
    const parts = [];
    if (r.added) parts.push(`新增 ${r.added} 家`);
    if (r.updated) parts.push(`更新 ${r.updated} 家`);
    toast(parts.length ? `内置库同步完成：${parts.join('，')}（共 ${r.total} 家）` : '内置库已是最新，无变动');
    loadCompanies();
  } catch (e) { toast(e.message, 'error'); }
}

/* ================= 岗位匹配 ================= */
async function loadMatch() {
  // 简历下拉
  if (!state.resumes.length) {
    try { state.resumes = await api('/api/resumes'); } catch (e) { /* 忽略 */ }
  }
  $('#match-resume').innerHTML = state.resumes.length
    ? state.resumes.map(r => `<option value="${r.id}">${esc(r.name)}${r.target ? `（${esc(r.target)}）` : ''}</option>`).join('')
    : '<option value="">暂无简历，请先到「简历库」创建</option>';
  // 岗位类型下拉
  if (!state.positionTypes.length) {
    try {
      const meta = await api('/api/companies/meta');
      state.positionTypes = meta.position_types || [];
    } catch (e) { /* 忽略 */ }
  }
  $('#match-position').innerHTML = '<option value="">全部岗位类型</option>' +
    state.positionTypes.map(p => `<option value="${esc(p)}">${esc(p)}</option>`).join('');
  if (!state.matchResults) {
    $('#match-result').innerHTML = emptyHtml('选择简历和岗位类型，点击「开始匹配」');
  } else {
    renderMatchResults();
  }
}

async function doMatch() {
  const resumeId = $('#match-resume').value;
  if (!resumeId) { toast('请先选择一份简历', 'error'); return; }
  const position = $('#match-position').value;
  const btn = $('#btn-do-match');
  btn.disabled = true; btn.textContent = '匹配中…';
  try {
    const params = new URLSearchParams({ resume_id: resumeId });
    if (position) params.set('position', position);
    state.matchResults = await api('/api/companies/match?' + params.toString());
    renderMatchResults();
  } catch (e) { toast(e.message, 'error'); }
  finally { btn.disabled = false; btn.textContent = '开始匹配'; }
}

function renderMatchResults() {
  const data = state.matchResults;
  const box = $('#match-result');
  if (!data || !data.results.length) {
    box.innerHTML = emptyHtml('没有匹配到合适的企业，试试补充简历内容或更换岗位类型');
    return;
  }
  box.innerHTML = `
    <p class="sub match-summary">简历「${esc(data.resume_name)}」共匹配到 ${data.total} 家企业，按匹配度从高到低排列</p>
    ${data.results.map(r => `
      <div class="card match-row">
        <div class="match-main">
          <div class="match-title">
            <strong>${esc(r.name)}</strong>
            <span class="badge badge-autumn">${esc(r.category || '')}</span>
            <span class="badge badge-intern">${esc(r.matched_position)}岗</span>
          </div>
          <div class="td-sub">命中关键词：${r.hits.length ? r.hits.map(esc).join('、') : '—'}</div>
        </div>
        <div class="match-score">
          <div class="score-bar"><div class="score-fill" style="width:${r.score}%"></div></div>
          <span class="score-num">${r.score}%</span>
        </div>
        ${r.url ? `<a class="btn btn-primary btn-sm" href="${esc(r.url)}" target="_blank" rel="noopener">去投递 ↗</a>` : ''}
      </div>`).join('')}`;
}

/* ================= 简历库 ================= */
async function loadResumes() {
  state.resumes = await api('/api/resumes');
  const grid = $('#resume-grid');
  if (!state.resumes.length) {
    grid.innerHTML = emptyHtml('还没有简历，点击右上角「新建简历」，或直接粘贴现有简历内容');
    return;
  }
  grid.innerHTML = state.resumes.map(r => `
    <div class="card resume-card">
      <div class="resume-head">
        <div>
          <h3>${esc(r.name)}</h3>
          <div class="resume-target">${esc(r.target || '未指定目标岗位')}</div>
        </div>
        <div class="td-actions">
          <button class="btn btn-sm" data-edit-resume="${r.id}">编辑</button>
          <button class="btn btn-sm btn-danger" data-del-resume="${r.id}">删除</button>
        </div>
      </div>
      <div class="resume-preview">${esc(r.content || '（暂无内容）')}</div>
      <div class="resume-meta">
        <span>${esc(r.updated_at || '')}</span>
        ${r.attachment ? `<a class="attach-link" href="/api/resumes/${r.id}/attachment" target="_blank" rel="noopener">附件：${esc(r.attachment)}</a>` : ''}
                ${r.photo ? `<a class="attach-link" href="/api/resumes/${r.id}/photo" target="_blank" rel="noopener">证件照</a>` : ''}
        <span>${(r.tags || []).map(t => `<span class="badge badge-category">${esc(t)}</span>`).join(' ')}</span>
        ${r.profile && Object.keys(r.profile).length ? `<span class="badge badge-category">网申信息 ${Object.keys(r.profile).length} 项</span>` : ''}
        ${r.experiences && r.experiences.length ? `<span class="badge badge-category">经历 ${r.experiences.length} 段</span>` : ''}
        ${r.projects && r.projects.length ? `<span class="badge badge-category">项目 ${r.projects.length} 段</span>` : ''}
      </div>
    </div>`).join('');

  $$('#resume-grid [data-edit-resume]').forEach(b => b.addEventListener('click', () => {
    openResumeModal(state.resumes.find(x => x.id === b.dataset.editResume));
  }));
  $$('#resume-grid [data-del-resume]').forEach(b => b.addEventListener('click', async () => {
    if (!confirm('确认删除这份简历？')) return;
    await api(`/api/resumes/${b.dataset.delResume}`, { method: 'DELETE' });
    toast('已删除');
    loadResumes();
  }));
}

function openResumeModal(resume = null) {
  openModal(`
    <h2>${resume ? '编辑简历' : '新建简历'}</h2>
    <div class="form-row">
      <div>
        <label class="field-label">简历名称 *</label>
        <input class="input" id="resume-name" value="${esc(resume?.name)}" placeholder="如：后端开发-通用版">
      </div>
      <div>
        <label class="field-label">目标岗位</label>
        <input class="input" id="resume-target" value="${esc(resume?.target)}" placeholder="如：后端开发工程师">
      </div>
    </div>
    <label class="field-label">标签（逗号分隔）</label>
    <input class="input" id="resume-tags" value="${esc((resume?.tags || []).join(', '))}" placeholder="如：Java, 实习, 应届">
    <label class="field-label">简历内容 *</label>
    <textarea class="input" id="resume-content" rows="14" placeholder="粘贴你的简历文本…">${esc(resume?.content)}</textarea>
    <div class="polish-actions">
      <button class="btn" id="btn-polish">AI 润色</button>
      <span class="hint" style="align-self:center">针对目标岗位优化表达（需配置 AI）</span>
    </div>
    <div id="polish-preview" hidden></div>
    <label class="field-label">备注</label>
    <textarea class="input" id="resume-note" rows="2" placeholder="这份简历的使用场景、投递对象…">${esc(resume?.note)}</textarea>
    <details class="profile-box" ${(resume?.profile && Object.keys(resume.profile).length) ? 'open' : ''}>
      <summary>网申补充信息（性别 / 身份证号 / 籍贯等，插件自动填写时优先使用）</summary>
      <div class="profile-actions">
        <button class="btn btn-sm" id="btn-extract-profile" type="button">AI 从简历内容提取</button>
        <span class="hint">只填充空白项；身份证号等简历里没有的请手动填</span>
      </div>
      <div class="profile-grid">
        ${PROFILE_FIELDS.map(([k, label, ph]) => k === 'self_eval'
          ? `<div class="profile-full"><label class="field-label">${label}</label><textarea class="input" id="pf-${k}" rows="2" placeholder="${ph}">${esc(resume?.profile?.[k])}</textarea></div>`
          : `<div><label class="field-label">${label}</label><input class="input" id="pf-${k}" value="${esc(resume?.profile?.[k])}" placeholder="${ph}"></div>`).join('')}
      </div>
      <div class="exp-head">
        <span class="field-label">实习 / 工作经历（插件按顺序填表，建议按时间倒序）</span>
        <button class="btn btn-sm" id="btn-add-exp" type="button">+ 添加经历</button>
      </div>
      <div id="exp-list"></div>
      <div class="exp-head">
        <span class="field-label">项目经历（插件按顺序填表，建议按时间倒序）</span>
        <button class="btn btn-sm" id="btn-add-proj" type="button">+ 添加项目</button>
      </div>
      <div id="proj-list"></div>
    </details>
    <label class="field-label">附件（PDF / Word / TXT，≤10MB）</label>
    <div class="attach-row">
      <input type="file" id="resume-attach" accept=".pdf,.doc,.docx,.md,.txt" hidden>
      <button class="btn btn-sm" id="btn-pick-attach" type="button">选择文件</button>
      <span class="hint" id="attach-name">${resume?.attachment ? `当前附件：${esc(resume.attachment)}` : '未选择文件'}</span>
      ${resume?.attachment ? `<a class="btn btn-sm" href="/api/resumes/${resume.id}/attachment" target="_blank" rel="noopener">下载</a>
      <button class="btn btn-sm btn-danger" id="btn-del-attach" type="button">删除附件</button>` : ''}
    </div>
<label class="field-label">证件照（JPG / PNG，≤5MB，自动填写时注入官网的照片上传框）</label>
    <div class="attach-row">
      <input type="file" id="resume-photo" accept=".jpg,.jpeg,.png,.webp" hidden>
      <button class="btn btn-sm" id="btn-pick-photo" type="button">选择照片</button>
<span class="hint" id="photo-name">${resume?.photo ? `当前照片：${esc(resume.photo)}` : '未选择照片'}</span>
${resume?.photo ? `<a class="btn btn-sm" href="/api/resumes/${resume.id}/photo" target="_blank" rel="noopener">查看</a>
<button class="btn btn-sm btn-danger" id="btn-del-photo" type="button">删除照片</button>` : ''}
    </div>
    <div class="modal-actions">
      <button class="btn" data-close="1">取消</button>
      <button class="btn btn-primary" id="btn-save-resume">保存</button>
    </div>`);

  // 实习/工作 + 项目经历编辑器（通用结构：标量字段进网格，长文本字段整行）
  const EXP_FIELDS = [
    ['company', '公司名称', '如：理想汽车'], ['position', '职位名称', '如：算法实习生'],
    ['department', '所在部门', '如：算法部'], ['work_type', '工作性质', '实习 / 全职'],
    ['start', '开始时间', 'YYYY-MM'], ['end', '结束时间', 'YYYY-MM 或 至今'],
    ['responsibility', '项目职责 / 主要工作', '一句话概述职责', true],
    ['description', '工作描述', '做了什么、量化成果…', true],
  ];
  const PROJ_FIELDS = [
    ['name', '项目名称', ''], ['start', '开始时间', 'YYYY-MM'], ['end', '结束时间', 'YYYY-MM 或 至今'],
    ['responsibility', '项目职责', '一句话概述职责', true],
    ['description', '项目描述', '背景、方案、量化成果…', true],
  ];
  const addGroupRow = (listSel, fields, item = {}) => {
    const row = document.createElement('div');
    row.className = 'exp-row';
    row.innerHTML = `
      <div class="exp-grid">
        ${fields.filter(([, , , long]) => !long).map(([k, label, ph]) =>
          `<div><label class="field-label">${label}</label><input class="input" data-k="${k}" value="${esc(item[k])}" placeholder="${ph}"></div>`).join('')}
      </div>
      ${fields.filter(([, , , long]) => long).map(([k, label, ph]) =>
        `<label class="field-label">${label}</label><textarea class="input" data-k="${k}" rows="2" placeholder="${ph}">${esc(item[k])}</textarea>`).join('')}
      <button class="btn btn-sm btn-danger exp-del" type="button">删除本段</button>`;
    row.querySelector('.exp-del').addEventListener('click', () => row.remove());
    $(listSel).appendChild(row);
  };
  const addExpRow = (exp = {}) => addGroupRow('#exp-list', EXP_FIELDS, exp);
  const addProjRow = (p = {}) => addGroupRow('#proj-list', PROJ_FIELDS, p);
  (resume?.experiences || []).forEach(addExpRow);
  (resume?.projects || []).forEach(addProjRow);
  $('#btn-add-exp').addEventListener('click', () => addExpRow());
  $('#btn-add-proj').addEventListener('click', () => addProjRow());

  // 附件：选择 / 删除
  $('#btn-pick-attach').addEventListener('click', () => $('#resume-attach').click());
  $('#resume-attach').addEventListener('change', e => {
    const f = e.target.files[0];
    $('#attach-name').textContent = f ? `待上传：${f.name}（保存后生效）` : '未选择文件';
  });
  const delAttachBtn = $('#btn-del-attach');
  if (delAttachBtn) delAttachBtn.addEventListener('click', async () => {
    try {
      await api(`/api/resumes/${resume.id}/attachment`, { method: 'DELETE' });
      toast('附件已删除');
      closeModal();
      loadResumes();
    } catch (e) { toast(e.message, 'error'); }
  });

  // 证件照：选择 / 删除
  $('#btn-pick-photo').addEventListener('click', () => $('#resume-photo').click());
  $('#resume-photo').addEventListener('change', e => {
    const f = e.target.files[0];
    $('#photo-name').textContent = f ? `待上传：${f.name}（保存后生效）` : '未选择照片';
  });
  const delPhotoBtn = $('#btn-del-photo');
  if (delPhotoBtn) delPhotoBtn.addEventListener('click', async () => {
    try {
      await api(`/api/resumes/${resume.id}/photo`, { method: 'DELETE' });
      toast('证件照已删除');
      closeModal();
      loadResumes();
    } catch (e) { toast(e.message, 'error'); }
  });

  $('#btn-save-resume').addEventListener('click', async () => {
    const body = {
      name: $('#resume-name').value.trim(),
      target: $('#resume-target').value.trim(),
      content: $('#resume-content').value.trim(),
      note: $('#resume-note').value.trim(),
      tags: $('#resume-tags').value.split(/[,，]/).map(s => s.trim()).filter(Boolean),
      profile: Object.fromEntries(PROFILE_FIELDS.map(([k]) => {
        const el = $('#pf-' + k);
        return [k, el ? el.value.trim() : ''];
      }).filter(([, v]) => v)),
      experiences: [...document.querySelectorAll('#exp-list .exp-row')].map(row =>
        Object.fromEntries(EXP_FIELDS.map(([k]) => [k, row.querySelector(`[data-k="${k}"]`).value.trim()]))
      ).filter(e => e.company || e.position),
      projects: [...document.querySelectorAll('#proj-list .exp-row')].map(row =>
        Object.fromEntries(PROJ_FIELDS.map(([k]) => [k, row.querySelector(`[data-k="${k}"]`).value.trim()]))
      ).filter(p => p.name),
    };
    if (!body.name || !body.content) { toast('请填写名称与内容', 'error'); return; }
    try {
      const saved = resume
        ? await api(`/api/resumes/${resume.id}`, { method: 'PUT', body })
        : await api('/api/resumes', { method: 'POST', body });
      const file = $('#resume-attach').files[0];
      if (file) {
        const fd = new FormData();
        fd.append('file', file);
        const resp = await fetch(`/api/resumes/${saved.id}/attachment`, { method: 'POST', body: fd });
        const data = await resp.json();
        if (!resp.ok) throw new Error(data.detail || '附件上传失败');
      }
      const photoFile = $('#resume-photo').files[0];
      if (photoFile) {
        const pfd = new FormData();
        pfd.append('file', photoFile);
        const presp = await fetch(`/api/resumes/${saved.id}/photo`, { method: 'POST', body: pfd });
        const pdata = await presp.json();
        if (!presp.ok) throw new Error(pdata.detail || '证件照上传失败');
      }
      toast('已保存');
      closeModal();
      loadResumes();
    } catch (e) { toast(e.message, 'error'); }
  });

  $('#btn-extract-profile').addEventListener('click', async () => {
    const content = $('#resume-content').value.trim();
    if (!content) { toast('请先填写简历内容', 'error'); return; }
    const btn = $('#btn-extract-profile');
    btn.disabled = true; btn.textContent = '提取中…';
    try {
      const r = await api('/api/ai/extract-profile', { method: 'POST', body: { content } });
      let n = 0;
      for (const [k, v] of Object.entries(r.profile || {})) {
        const el = $('#pf-' + k);
        if (el && !el.value.trim()) { el.value = v; n++; }
      }
      // 经历只补充新公司/新项目，不覆盖已填的
      const existing = new Set([...document.querySelectorAll('#exp-list [data-k="company"]')].map(i => i.value.trim()).filter(Boolean));
      let en = 0;
      for (const e of r.experiences || []) {
        if (e.company && existing.has(e.company)) continue;
        addExpRow(e); en++;
      }
      const existingProj = new Set([...document.querySelectorAll('#proj-list [data-k="name"]')].map(i => i.value.trim()).filter(Boolean));
      let pn = 0;
      for (const p of r.projects || []) {
        if (p.name && existingProj.has(p.name)) continue;
        addProjRow(p); pn++;
      }
      const parts = [];
      if (n) parts.push(`补充信息 ${n} 项`);
      if (en) parts.push(`经历 ${en} 段`);
      if (pn) parts.push(`项目 ${pn} 段`);
      toast(parts.length ? `已提取${parts.join('、')}，请核对后保存` : '可提取的字段都已有值，未覆盖');
    } catch (e) {
      toast(e.message, 'error');
      if (e.message.includes('API Key')) switchTabHint('settings');
    } finally {
      btn.disabled = false; btn.textContent = 'AI 从简历内容提取';
    }
  });

  $('#btn-polish').addEventListener('click', async () => {
    const content = $('#resume-content').value.trim();
    if (!content) { toast('请先填写简历内容', 'error'); return; }
    const btn = $('#btn-polish');
    btn.disabled = true; btn.textContent = '润色中…';
    try {
      const r = await api('/api/ai/polish', {
        method: 'POST',
        body: { content, target: $('#resume-target').value.trim() },
      });
      $('#polish-preview').hidden = false;
      $('#polish-preview').innerHTML = `
        <div class="polish-preview">${esc(r.reply)}</div>
        <div class="polish-actions">
          <button class="btn btn-primary btn-sm" id="btn-apply-polish">应用润色结果</button>
          <button class="btn btn-sm" id="btn-discard-polish">放弃</button>
        </div>`;
      $('#btn-apply-polish').addEventListener('click', () => {
        $('#resume-content').value = r.reply;
        $('#polish-preview').hidden = true;
        toast('已应用润色结果，可继续手动调整');
      });
      $('#btn-discard-polish').addEventListener('click', () => { $('#polish-preview').hidden = true; });
      toast('润色完成');
    } catch (e) {
      toast(e.message, 'error');
      if (e.message.includes('API Key')) switchTabHint('settings');
    } finally {
      btn.disabled = false; btn.textContent = 'AI 润色';
    }
  });
}

function switchTabHint(name) {
  toast('请先在「设置」中配置 AI 接口', 'info');
  setTimeout(() => switchTab(name), 600);
}

/* ================= 题库 ================= */
function renderCategoryOptions() {
  $('#question-category').innerHTML = '<option value="">全部分类</option>' +
    CATEGORIES.map(c => `<option ${state.qFilters.category === c ? 'selected' : ''}>${c}</option>`).join('');
}

async function loadQuestions() {
  state.questions = await api('/api/questions');
  renderCategoryOptions();
  renderQuestionList();
}

function starsHtml(mastery, id) {
  return `<span class="stars" data-stars="${id}">${[0, 1, 2, 3, 4]
    .map(i => `<span class="star ${i < mastery ? 'on' : ''}" data-val="${i + 1}">★</span>`).join('')}</span>`;
}

function renderQuestionList() {
  const kw = state.qFilters.keyword.trim().toLowerCase();
  const items = state.questions.filter(q =>
    (!state.qFilters.category || q.category === state.qFilters.category) &&
    (!state.qFilters.mastery || q.mastery <= Number(state.qFilters.mastery)) &&
    (!state.qFilters.wrong || q.is_wrong) &&
    (!kw || `${q.title}${q.answer}`.toLowerCase().includes(kw))
  );

  const list = $('#question-list');
  if (!items.length) {
    list.innerHTML = emptyHtml('暂无符合条件的题目，点击「新增题目」开始积累');
    return;
  }

  list.innerHTML = items.map(q => `
    <div class="card question-card">
      <div class="q-top">
        <span class="badge badge-category">${esc(q.category)}</span>
        <span class="badge badge-difficulty-${esc(q.difficulty)}">${DIFFICULTY[q.difficulty] || '中等'}</span>
        ${q.is_wrong ? '<span class="badge badge-wrong">错题本</span>' : ''}
        <span class="q-title">${esc(q.title)}</span>
        ${starsHtml(q.mastery || 0, q.id)}
      </div>
      <div class="q-answer collapsed" id="ans-${q.id}">${esc(q.answer || '（暂无答案笔记）')}</div>
      <div class="q-foot">
        <button class="btn btn-sm" data-toggle-ans="${q.id}">查看答案</button>
        <button class="btn btn-sm" data-ai-ans="${q.id}">AI 解答</button>
        <button class="btn btn-sm" data-edit-q="${q.id}">编辑</button>
        <button class="btn btn-sm btn-danger" data-del-q="${q.id}">删除</button>
        <span class="td-sub" style="margin-left:auto">${esc(q.source ? '来源：' + q.source : '')} ${esc(q.updated_at || '')}</span>
      </div>
    </div>`).join('');

  $$('#question-list [data-toggle-ans]').forEach(b => b.addEventListener('click', () => {
    $('#ans-' + b.dataset.toggleAns).classList.toggle('collapsed');
    b.textContent = $('#ans-' + b.dataset.toggleAns).classList.contains('collapsed') ? '查看答案' : '收起答案';
  }));

  $$('#question-list [data-stars]').forEach(span => span.addEventListener('click', async e => {
    const val = Number(e.target.dataset.val);
    const q = state.questions.find(x => x.id === span.dataset.stars);
    if (!q) return;
    q.mastery = val;
    await api(`/api/questions/${q.id}`, { method: 'PUT', body: q });
    renderQuestionList();
  }));

  $$('#question-list [data-ai-ans]').forEach(b => b.addEventListener('click', async () => {
    const q = state.questions.find(x => x.id === b.dataset.aiAns);
    openModal(`<h2>AI 解答</h2><p class="sub" style="margin-bottom:12px">${esc(q.title)}</p><div class="polish-preview">正在思考…</div>
      <div class="modal-actions"><button class="btn" data-close="1">关闭</button></div>`);
    try {
      const r = await api('/api/ai/answer', { method: 'POST', body: { question: q.title } });
      $('.polish-preview').textContent = r.reply;
    } catch (e) {
      $('.polish-preview').textContent = e.message;
      if (e.message.includes('API Key')) switchTabHint('settings');
    }
  }));

  $$('#question-list [data-edit-q]').forEach(b => b.addEventListener('click', () => {
    openQuestionModal(state.questions.find(x => x.id === b.dataset.editQ));
  }));
  $$('#question-list [data-del-q]').forEach(b => b.addEventListener('click', async () => {
    if (!confirm('确认删除这道题？')) return;
    await api(`/api/questions/${b.dataset.delQ}`, { method: 'DELETE' });
    toast('已删除');
    loadQuestions();
  }));
}

function openQuestionModal(q = null) {
  openModal(`
    <h2>${q ? '编辑题目' : '新增题目'}</h2>
    <label class="field-label">题目 *</label>
    <input class="input" id="q-title" value="${esc(q?.title)}" placeholder="如：TCP 三次握手的过程？">
    <div class="form-row">
      <div>
        <label class="field-label">分类</label>
        <select class="input select" id="q-category">
          ${CATEGORIES.map(c => `<option ${q?.category === c ? 'selected' : ''}>${c}</option>`).join('')}
        </select>
      </div>
      <div>
        <label class="field-label">难度</label>
        <select class="input select" id="q-difficulty">
          ${Object.entries(DIFFICULTY).map(([k, v]) => `<option value="${k}" ${q?.difficulty === k ? 'selected' : ''}>${v}</option>`).join('')}
        </select>
      </div>
      <div>
        <label class="field-label">掌握程度</label>
        <select class="input select" id="q-mastery">
          ${[0, 1, 2, 3, 4, 5].map(i => `<option value="${i}" ${(q?.mastery ?? 0) === i ? 'selected' : ''}>${'★'.repeat(i) || '未开始'}</option>`).join('')}
        </select>
      </div>
      <div>
        <label class="field-label">来源</label>
        <input class="input" id="q-source" value="${esc(q?.source)}" placeholder="如：字节一面">
      </div>
    </div>
    <label class="field-label checkbox" style="margin-top:12px">
      <input type="checkbox" id="q-wrong" ${q?.is_wrong ? 'checked' : ''}> 加入错题本
    </label>
    <label class="field-label">答案 / 笔记</label>
    <textarea class="input" id="q-answer" rows="10" placeholder="记录答案要点，练习时先自己回答再看">${esc(q?.answer)}</textarea>
    <div class="modal-actions">
      <button class="btn" data-close="1">取消</button>
      <button class="btn btn-primary" id="btn-save-q">保存</button>
    </div>`);

  $('#btn-save-q').addEventListener('click', async () => {
    const body = {
      title: $('#q-title').value.trim(),
      category: $('#q-category').value,
      difficulty: $('#q-difficulty').value,
      mastery: Number($('#q-mastery').value),
      is_wrong: $('#q-wrong').checked,
      source: $('#q-source').value.trim(),
      answer: $('#q-answer').value.trim(),
    };
    if (!body.title) { toast('请填写题目', 'error'); return; }
    try {
      if (q) await api(`/api/questions/${q.id}`, { method: 'PUT', body });
      else await api('/api/questions', { method: 'POST', body });
      toast('已保存');
      closeModal();
      loadQuestions();
    } catch (e) { toast(e.message, 'error'); }
  });
}

/* ---------- 练习模式 ---------- */
async function startPractice() {
  // 从概览页跳转时题库可能尚未加载，先确保数据就绪
  if (!state.questions.length) await loadQuestions();
  const pool = [...state.questions].sort((a, b) => (a.mastery || 0) - (b.mastery || 0));
  if (!pool.length) { toast('题库还是空的，先添加一些题目吧', 'info'); return; }
  state.practice = { list: pool, index: 0, revealed: false };
  renderPractice();
}

function renderPractice() {
  const p = state.practice;
  const q = p.list[p.index];
  $('#practice-root').innerHTML = `
    <div class="practice-overlay">
      <div class="practice-box">
        <div style="display:flex;justify-content:space-between;align-items:center">
          <h2>刷题练习</h2>
          <span class="td-sub">第 ${p.index + 1} / ${p.list.length} 题</span>
        </div>
        <div style="margin-top:10px">
          <span class="badge badge-category">${esc(q.category)}</span>
          <span class="badge badge-difficulty-${esc(q.difficulty)}">${DIFFICULTY[q.difficulty] || '中等'}</span>
        </div>
        <div class="practice-question">${esc(q.title)}</div>
        <div class="practice-answer ${p.revealed ? 'show' : ''}">${esc(q.answer || '（暂无答案笔记）')}</div>
        <div class="practice-actions">
          <button class="btn" id="btn-reveal">${p.revealed ? '隐藏答案' : '显示答案'}</button>
          <button class="btn" id="btn-next">下一题</button>
          <span class="spacer"></span>
          <span class="td-sub">答完后自评掌握度：</span>
          ${[1, 2, 3, 4, 5].map(i => `<button class="btn btn-sm" data-rate="${i}">${'★'.repeat(i)}</button>`).join('')}
          <button class="btn btn-sm btn-danger" id="btn-exit">退出</button>
        </div>
      </div>
    </div>`;

  $('#btn-reveal').addEventListener('click', () => {
    p.revealed = !p.revealed;
    renderPractice();
  });
  $('#btn-next').addEventListener('click', () => {
    p.index = (p.index + 1) % p.list.length;
    p.revealed = false;
    renderPractice();
  });
  $('#btn-exit').addEventListener('click', () => {
    state.practice = null;
    $('#practice-root').innerHTML = '';
  });
  $$('#practice-root [data-rate]').forEach(b => b.addEventListener('click', async () => {
    const qCurrent = p.list[p.index];
    const full = state.questions.find(x => x.id === qCurrent.id);
    full.mastery = Number(b.dataset.rate);
    await api(`/api/questions/${full.id}`, { method: 'PUT', body: full });
    toast(`已标记为 ${b.dataset.rate} 星`);
    $('#practice-root').innerHTML = '';
    state.practice = null;
    renderQuestionList();
  }));
}

/* ================= AI 助手 ================= */
function renderChat() {
  const box = $('#chat-messages');
  if (!state.chat.length) {
    box.innerHTML = `
      <div class="chat-msg assistant"><div class="chat-welcome-title">你好，我是你的秋招 AI 助手</div>
      · 模拟面试出题（右侧「模拟面试出题」）<br>
      · 面试题详解（输入题目后点「面试题详解」）<br>
      · 简历润色（到「简历库」编辑简历时使用）<br>
      · 直接提问任何秋招相关问题
      <br><br>使用前请先在「设置」中配置 AI 接口。</div>`;
    return;
  }
  box.innerHTML = state.chat.map(m => {
    if (m.role === 'user') return `<div class="chat-msg user">${esc(m.content)}</div>`;
    if (m.error) return `<div class="chat-msg error">${esc(m.content)}</div>`;
    return `<div class="chat-msg assistant">${esc(m.content)}</div>`;
  }).join('');
  box.scrollTop = box.scrollHeight;
}

// 进入 AI 助手页：加载可选模型并渲染聊天
async function loadAiTab() {
  renderChat();
  try {
    const cfg = await api('/api/config');
    const models = cfg.ai.models || [];
    const sel = $('#chat-model');
    sel.innerHTML = models.length
      ? models.map(m => `<option value="${esc(m)}">${esc(m)}</option>`).join('')
      : '<option value="">未配置模型</option>';
    if (models.includes(state.chatModel)) sel.value = state.chatModel;
    else if (models.length) { sel.value = models[0]; state.chatModel = models[0]; }
  } catch (e) { /* 配置加载失败不阻塞聊天界面 */ }
}

async function sendChat(text) {
  if (!text.trim()) return;
  state.chat.push({ role: 'user', content: text });
  renderChat();
  $('#chat-input').value = '';
  const history = state.chat.filter(m => !m.error).map(m => ({ role: m.role, content: m.content }));
  try {
    const r = await api('/api/ai/chat', { method: 'POST', body: { messages: history, model: state.chatModel } });
    state.chat.push({ role: 'assistant', content: r.reply });
  } catch (e) {
    state.chat.push({ role: 'assistant', content: e.message, error: true });
    if (e.message.includes('API Key')) switchTabHint('settings');
  }
  renderChat();
}

function setupChat() {
  $('#btn-chat-send').addEventListener('click', () => sendChat($('#chat-input').value));
  $('#chat-input').addEventListener('keydown', e => {
    if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) sendChat($('#chat-input').value);
  });
  $('#chat-model').addEventListener('change', e => {
    state.chatModel = e.target.value;
    localStorage.setItem('chatModel', state.chatModel);
    toast(`已切换模型：${state.chatModel}`);
  });

  $('#btn-mock-interview').addEventListener('click', () => {
    const wrap = $('#mock-form-wrap');
    wrap.hidden = !wrap.hidden;
  });
  $('#btn-mock-generate').addEventListener('click', async () => {
    const body = {
      position: $('#mock-position').value.trim() || '后端开发工程师',
      category: $('#mock-category').value,
      count: Number($('#mock-count').value),
    };
    const btn = $('#btn-mock-generate');
    btn.disabled = true; btn.textContent = '生成中…';
    try {
      const r = await api('/api/ai/mock-interview', { method: 'POST', body });
      state.chat.push({
        role: 'assistant',
        content: `【模拟面试】岗位：${body.position}，方向：${body.category}\n\n${r.reply}\n\n可以把你对某道题的回答发给我，让我帮你点评。`,
      });
      $('#mock-form-wrap').hidden = true;
      renderChat();
    } catch (e) {
      toast(e.message, 'error');
      if (e.message.includes('API Key')) switchTabHint('settings');
    } finally {
      btn.disabled = false; btn.textContent = '生成题目';
    }
  });
  $('#btn-practice-answer').addEventListener('click', async () => {
    const text = $('#chat-input').value.trim();
    if (!text) { toast('请先在输入框写下题目', 'info'); return; }
    sendChat(`请详解这道面试题：\n${text}`);
  });
}

/* ================= 设置 ================= */
let aiPresets = {};  // 后端下发的服务商预设

// 收集当前表单为保存请求体
function collectConfigBody() {
  const provider = $('#cfg-provider').value;
  const body = { provider, api_key: $('#cfg-api-key').value.trim() };
  if (provider === 'custom') {
    body.base_url = $('#cfg-base-url').value.trim();
    body.models = $('#cfg-models').value.trim();
  }
  return body;
}

// 根据选中的服务商刷新界面（显示自动填充信息 / 自定义输入框 / 获取 key 链接）
function onProviderChange() {
  const pid = $('#cfg-provider').value;
  const p = aiPresets[pid] || {};
  const isCustom = pid === 'custom';
  $('#cfg-custom-fields').style.display = isCustom ? '' : 'none';
  $('#cfg-auto-info').style.display = isCustom ? 'none' : '';
  if (!isCustom) {
    $('#cfg-auto-url').textContent = p.base_url || '';
    $('#cfg-auto-model').textContent = (p.models && p.models.length ? p.models : [p.model]).filter(Boolean).join(' / ');
  }
  const link = $('#cfg-key-link');
  if (p.key_url) { link.href = p.key_url; link.style.display = ''; }
  else link.style.display = 'none';
  if (isCustom) {
    const saved = window._savedCustom || {};
    $('#cfg-base-url').value = saved.base_url || '';
    $('#cfg-models').value = (saved.models || []).join(', ');
  }
}

async function loadSettings() {
  try {
    const cfg = await api('/api/config');
    aiPresets = cfg.presets || {};
    const sel = $('#cfg-provider');
    sel.innerHTML = Object.entries(aiPresets).map(([pid, p]) =>
      `<option value="${esc(pid)}">${esc(p.name)}${p.note ? `（${esc(p.note)}）` : ''}</option>`).join('');
    const provider = cfg.ai.provider || 'custom';
    sel.value = aiPresets[provider] ? provider : 'custom';
    window._savedCustom = { base_url: cfg.ai.base_url, models: cfg.ai.models || [] };
    onProviderChange();
    $('#cfg-api-key').placeholder = cfg.ai.api_key_set ? `已配置（${cfg.ai.api_key_hint}），留空保持不变` : '粘贴你的 API Key';
  } catch (e) { toast(e.message, 'error'); }
  loadEmailSettings();
}

/* ================= 邮箱进度同步设置 ================= */
let emailPresets = {};

async function loadEmailSettings() {
  try {
    const cfg = await api('/api/email/config');
    emailPresets = cfg.presets || {};
    const sel = $('#em-preset');
    sel.innerHTML = Object.entries(emailPresets).map(([pid, p]) =>
      `<option value="${esc(pid)}">${esc(p.name)}</option>`).join('');
    const pid = Object.keys(emailPresets).find(k => emailPresets[k].host === cfg.host) || 'qq';
    sel.value = pid;
    onEmailPresetChange();
    $('#em-user').value = cfg.user || '';
    $('#em-days').value = cfg.since_days || 14;
    $('#em-enabled').checked = !!cfg.enabled;
    $('#em-pass').placeholder = cfg.has_password ? '已保存，留空保持不变' : '粘贴授权码';
    renderEmailLastRun(cfg.last_run);
  } catch (e) { /* 邮箱配置加载失败不影响设置页其他部分 */ }
}

function onEmailPresetChange() {
  const p = emailPresets[$('#em-preset').value];
  if (!p) return;
  $('#em-host-view').textContent = `${p.host}:${p.port}`;
  $('#em-help').textContent = p.help || '';
}

function renderEmailLastRun(lr) {
  const el = $('#em-last-run');
  if (!lr || lr.ok === false) { el.textContent = ''; return; }
  el.textContent = `上次同步 ${lr.at}：扫描 ${lr.scanned} 封邮件，识别通知 ${lr.relevant} 封，更新进度 ${lr.updated} 条，新收录 ${lr.imported || 0} 条`
    + (lr.details && lr.details.length ? `\n${lr.details.join('\n')}` : '');
}

function collectEmailBody(forceEnabled = null) {
  const p = emailPresets[$('#em-preset').value] || {};
  return {
    enabled: forceEnabled === null ? $('#em-enabled').checked : forceEnabled,
    host: p.host || '', port: p.port || 993,
    user: $('#em-user').value.trim(),
    password: $('#em-pass').value.trim(),
    since_days: Number($('#em-days').value) || 14,
  };
}

function setupSettings() {
  $('#cfg-provider').addEventListener('change', onProviderChange);
  $('#btn-save-config').addEventListener('click', async () => {
    try {
      await api('/api/config', { method: 'PUT', body: collectConfigBody() });
      toast('配置已保存');
      $('#cfg-api-key').value = '';
      loadSettings();
    } catch (e) { toast(e.message, 'error'); }
  });
  $('#btn-test-config').addEventListener('click', async () => {
    const btn = $('#btn-test-config');
    btn.disabled = true; btn.textContent = '测试中…';
    try {
      // 若有新 key 先保存再测试
      if ($('#cfg-api-key').value.trim()) {
        await api('/api/config', { method: 'PUT', body: collectConfigBody() });
      }
      const r = await api('/api/ai/chat', { method: 'POST', body: { messages: [{ role: 'user', content: '回复“连接成功”四个字' }] } });
      toast(`连接成功：${r.reply.slice(0, 40)}`);
    } catch (e) { toast(e.message, 'error'); }
    finally { btn.disabled = false; btn.textContent = '测试连接'; }
  });
  $('#em-preset').addEventListener('change', onEmailPresetChange);
  $('#btn-save-email').addEventListener('click', async () => {
    try {
      await api('/api/email/config', { method: 'PUT', body: collectEmailBody() });
      toast('邮箱配置已保存');
      $('#em-pass').value = '';
      loadEmailSettings();
    } catch (e) { toast(e.message, 'error'); }
  });
  $('#btn-email-sync').addEventListener('click', async () => {
    const btn = $('#btn-email-sync');
    btn.disabled = true; btn.textContent = '同步中…';
    try {
      // 先保存当前配置（强制启用）再跑一轮
      await api('/api/email/config', { method: 'PUT', body: collectEmailBody(true) });
      const r = await api('/api/email/sync', { method: 'POST' });
      toast(`邮箱同步完成：扫描 ${r.scanned} 封，识别通知 ${r.relevant} 封，更新进度 ${r.updated} 条，新收录 ${r.imported || 0} 条`);
      loadEmailSettings();
      loadApplications();
    } catch (e) { toast(e.message, 'error'); }
    finally { btn.disabled = false; btn.textContent = '立即同步一次'; }
  });
}

/* ================= 事件绑定与初始化 ================= */
function bindGlobalEvents() {
  $('#btn-new-application').addEventListener('click', () => openApplicationModal());
  $('#btn-new-resume').addEventListener('click', () => openResumeModal());
  $('#btn-new-question').addEventListener('click', () => openQuestionModal());
  $('#btn-new-company').addEventListener('click', () => openCompanyModal());
  $('#btn-seed-companies').addEventListener('click', seedCompanies);
  $('#company-position').addEventListener('change', e => {
    state.companyFilters.position = e.target.value;
    loadCompanies();
  });
  $('#company-search').addEventListener('input', e => {
    state.companyFilters.keyword = e.target.value.trim();
    loadCompanies();
  });
  $('#btn-do-match').addEventListener('click', doMatch);
  $('#btn-practice').addEventListener('click', startPractice);

  $('#application-search').addEventListener('input', e => {
    state.appSearch = e.target.value;
    renderApplicationTable();
  });
  $('#application-category').addEventListener('change', e => {
    state.appCategory = e.target.value;
    renderApplicationTable();
  });
  $('#btn-import-application').addEventListener('click', openImportModal);

  $('#question-category').addEventListener('change', e => {
    state.qFilters.category = e.target.value;
    renderQuestionList();
  });
  $('#question-mastery').addEventListener('change', e => {
    state.qFilters.mastery = e.target.value;
    renderQuestionList();
  });
  $('#question-wrong').addEventListener('change', e => {
    state.qFilters.wrong = e.target.checked;
    renderQuestionList();
  });
  $('#question-search').addEventListener('input', e => {
    state.qFilters.keyword = e.target.value;
    renderQuestionList();
  });

  setupChat();
  setupSettings();
}

bindGlobalEvents();
switchTab('dashboard');
