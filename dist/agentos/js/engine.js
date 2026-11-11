/* AgentOS · Mock 对话引擎：根据智能体配置、模型与资料范围生成工具调用、引用和回答（纯函数） */
(function (root) {
  const AOS = root.AOS || (root.AOS = {});
  const P = AOS.policy;

  const hash = s => { let h = 2166136261; for (const ch of String(s)) { h ^= ch.codePointAt(0); h = Math.imul(h, 16777619); } return h >>> 0; };
  const rand = (seed, i) => (hash(seed + ':' + i) % 1000) / 1000;
  const score = (words, text) => (words || []).reduce((n, w) => n + (text.includes(w) ? 1 : 0), 0);
  const uniq = list => Array.from(new Set(list));
  const stripNo = h => h.replace(/^[一二三四五六七八九十]+、/, '');
  const NUM = ['一', '二', '三', '四', '五', '六', '七', '八', '九', '十'];

  const TYPE_LABEL = { pdf: 'PDF', word: 'Word', cad: 'CAD 图纸', code: '代码', db: '数据表' };

  const OUTLINES = {
    survey: ['研究背景与目的', '国内外技术现状', '主要技术路线对比', '典型工程案例', '发展趋势与挑战', '对本厂的启示与建议'],
    'proposal-writer': ['项目背景与必要性', '国内外研究现状', '研究内容与技术路线', '预期目标与考核指标', '进度安排与经费预算', '已有工作基础'],
    'closure-acceptance': ['任务书指标核对', '主要研究成果', '经济效益', '存在问题与后续计划'],
    'experiment-design': ['试验目的', '试验条件与参数范围', '检测项目', '进度安排', '安全注意事项'],
    'patent-disclosure': ['可申请专利的技术点', '现有技术检索', '区别与创新点', '技术交底书正文'],
    'award-application': ['成果简介', '主要创新点', '经济与社会效益', '推广应用情况'],
    'tech-summary': ['摘要', '引言', '研究方法', '结果与讨论', '结论']
  };

  function prevMonthRange(now) {
    const d = now ? new Date(now) : new Date();
    const start = new Date(d.getFullYear(), d.getMonth() - 1, 1);
    const end = new Date(d.getFullYear(), d.getMonth(), 0);
    const f = x => x.getFullYear() + '-' + String(x.getMonth() + 1).padStart(2, '0') + '-' + String(x.getDate()).padStart(2, '0');
    return { from: f(start), to: f(end), label: start.getFullYear() + ' 年 ' + (start.getMonth() + 1) + ' 月' };
  }

  function makeCtx(ctx) {
    const c = Object.assign({ mode: 'chat', phase: 1, state: null }, ctx);
    c.org = c.user.dept;
    c.available = P.effectiveTools(c.agent, c.scope, c.phase, c.toolsCatalog);
    c.has = id => c.available.includes(id);
    c.ticked = id => (c.agent.tools || []).includes(id);
    c.toolDef = id => c.toolsCatalog.find(t => t.id === id) || { id, name: id, icon: 'wrench' };
    c.param = (id, key) => {
      const own = c.agent.toolParams && c.agent.toolParams[id] && c.agent.toolParams[id][key];
      if (own !== undefined && own !== '') return own;
      const p = (c.toolDef(id).params || []).find(x => x.key === key);
      return p ? p.default : undefined;
    };
    c.seedKey = c.text + '|' + c.agent.id + '|' + c.zone + '|' + c.scope;
    c.out = { steps: [], blocks: [], citations: [], blocked: [], filteredAcl: 0, sentOut: [], actions: [], notices: [], audit: [] };
    return c;
  }

  function unavailableReason(c, id) {
    const tool = c.toolDef(id);
    if (!c.ticked(id)) return null;
    if (tool.phase > c.phase) return tool.name + '将在' + ['', '一', '二', '三'][tool.phase] + '期提供';
    if (tool.group === 'internal' && c.scope === 'public') return '当前资料范围为“公开资料”，' + tool.name + '不可用';
    if (tool.group === 'public' && c.scope === 'internal') return '当前资料范围为“厂内资料”，' + tool.name + '不可用';
    return null;
  }

  function addStep(c, id, params, status, summary, results) {
    const tool = c.toolDef(id);
    const step = { tool: id, name: tool.name, icon: tool.icon, params, status, summary, results: results || [], durationMs: 300 + Math.round(rand(c.seedKey, c.out.steps.length) * 1400) };
    c.out.steps.push(step);
    return step;
  }

  function cite(c, item, kind, loc) {
    const key = kind + ':' + item.id + ':' + (loc || '');
    let found = c.out.citations.find(x => x.key === key);
    if (found) return found.n;
    found = kind === 'web'
      ? { key, n: c.out.citations.length + 1, kind, refId: item.id, title: item.title, loc: item.source + ' · ' + item.date, url: item.url, level: 'public', origin: '公开来源', credibility: item.credibility }
      : { key, n: c.out.citations.length + 1, kind: 'doc', refId: item.id, title: item.title, loc: loc || TYPE_LABEL[item.type], level: item.level, origin: '厂内资料', docType: item.type };
    c.out.citations.push(found);
    return found.n;
  }

  /* ---------- 工具：厂内资料 ---------- */
  function searchDocs(c, id, types, text, opts) {
    const reason = unavailableReason(c, id);
    if (!c.has(id)) { if (reason) c.out.notices.push({ tone: 'info', text: reason }); return []; }
    const library = (opts && opts.library) || c.param(id, 'library') || '全部资料库';
    const topK = Number(c.param(id, 'topK') || 5);
    const pool = c.docs.filter(d => types.includes(d.type) && d.status === 'parsed' && (library === '全部资料库' || !library || d.library === library || (opts && opts.anyLibrary)));
    const scored = pool.map(d => ({ d, s: score(d.keywords, text) + score([d.process, d.topic], text) }));
    const top = Math.max(0, ...scored.map(x => x.s));
    const ranked = scored.filter(x => x.s > 0 && x.s >= Math.max(top > 2 ? 2 : 1, top * 0.6)).sort((a, b) => b.s - a.s || b.d.year - a.d.year);
    const visible = ranked.filter(x => P.canView(c.user, x.d));
    const hidden = ranked.length - visible.length;
    c.out.filteredAcl += hidden;
    const hits = visible.slice(0, topK).map(x => x.d);
    const split = P.partitionForModel(hits, c.zone, c.org, c.policy);
    split.blocked.forEach(d => { if (!c.out.blocked.find(b => b.id === d.id)) c.out.blocked.push({ id: d.id, title: d.title, level: d.level }); });
    if (c.zone === 'external') split.allowed.forEach(d => { if (!c.out.sentOut.find(s => s.id === d.id)) c.out.sentOut.push({ id: d.id, title: d.title, level: d.level }); });
    const params = { query: keywordsOf(c, text).join(' '), topK };
    if (id === 'doc_search') params.library = library;
    const summary = hits.length ? '命中 ' + hits.length + ' 份' + (hidden ? '，按权限过滤 ' + hidden + ' 份' : '') + (split.blocked.length ? '，' + split.blocked.length + ' 份因密级未发送给外网模型' : '') : '未找到相关资料' + (hidden ? '（按权限过滤 ' + hidden + ' 份）' : '');
    addStep(c, id, params, hits.length ? 'ok' : 'empty', summary, hits.map(d => ({ title: d.title, loc: (d.snippets && d.snippets[0] ? d.snippets[0].loc : TYPE_LABEL[d.type]), level: d.level, blocked: split.blocked.includes(d) })));
    return split.allowed;
  }

  function keywordsOf(c, text) {
    const vocab = uniq([].concat(...c.docs.map(d => d.keywords || []), ...c.web.map(w => w.tags || [])));
    const found = vocab.filter(w => w.length >= 2 && text.includes(w)).sort((a, b) => b.length - a.length);
    const picked = [];
    found.forEach(w => { if (!picked.some(p => p.includes(w))) picked.push(w); });
    return picked.length ? picked.slice(0, 6) : [text.replace(/[，。？！、\s]/g, '').slice(0, 12)];
  }

  /* ---------- 工具：互联网 ---------- */
  function searchWeb(c, text, opts) {
    if (!c.has('web_search')) { const r = unavailableReason(c, 'web_search'); if (r) c.out.notices.push({ tone: 'info', text: r }); return []; }
    const words = keywordsOf(c, text);
    const query = words.join(' ');
    const hit = P.findSensitive(query + ' ' + text, c.policy.sensitiveWords);
    if (hit) {
      addStep(c, 'web_search', { query }, 'blocked', '出口网关拦截：检索内容包含受限词「' + hit + '」');
      c.out.audit.push({ kind: '联网搜索', target: '搜索引擎', content: query, docs: [], result: '拦截', reason: '命中敏感词「' + hit + '」' });
      c.out.notices.push({ tone: 'warn', text: '联网搜索被出口网关拦截：检索内容包含受限词「' + hit + '」。' });
      return [];
    }
    const topK = Number(c.param('web_search', 'topK') || 6);
    let pool = c.web.slice();
    if (opts && opts.range) pool = pool.filter(w => w.date >= opts.range.from && w.date <= opts.range.to);
    const scored = pool.map(w => ({ w, s: score(w.tags, text) + score(w.tags, words.join('')) }));
    const top = Math.max(0, ...scored.map(x => x.s));
    const ranked = scored.filter(x => x.s > 0 && (opts && opts.loose ? true : x.s >= top * 0.4)).sort((a, b) => b.s - a.s || (a.w.date < b.w.date ? 1 : -1));
    const items = ranked.slice(0, topK).map(x => x.w);
    const params = { query, topK };
    if (opts && opts.range) params.timeRange = opts.range.from + ' 至 ' + opts.range.to;
    addStep(c, 'web_search', params, items.length ? 'ok' : 'empty', items.length ? '返回 ' + items.length + ' 条网页结果' : '未检索到相关网页', items.map(w => ({ title: w.title, loc: w.source + ' · ' + w.date, level: 'public' })));
    c.out.audit.push({ kind: '联网搜索', target: '搜索引擎', content: query, docs: [], result: '放行', reason: '仅发送检索关键词' });
    if (items.length && c.has('web_fetch')) {
      const n = Math.min(items.length, Number(c.param('web_fetch', 'maxPages') || 4));
      addStep(c, 'web_fetch', { urls: items.slice(0, n).map(w => w.url) }, 'ok', '已提取 ' + n + ' 个网页正文', items.slice(0, n).map(w => ({ title: w.title, loc: w.url, level: 'public' })));
    }
    return items;
  }

  /* ---------- 工具：数据 ---------- */
  function queryData(c, text) {
    if (!c.has('db_query')) { const r = unavailableReason(c, 'db_query'); if (r) c.out.notices.push({ tone: 'info', text: r }); return null; }
    const project = /课题|项目|指标|验收|经费/.test(text);
    const db = c.docs.find(d => d.id === (project ? 'b02' : 'b01'));
    if (!db || !P.canView(c.user, db)) { addStep(c, 'db_query', {}, 'empty', '无权访问相关数据表'); return null; }
    let result;
    if (project) {
      const sql = "SELECT project_no, name, owner, status, budget FROM project WHERE name LIKE '%炉温%' LIMIT " + c.param('db_query', 'maxRows');
      result = { sql, head: ['课题编号', '课题名称', '负责人', '状态', '经费（万元）'], rows: [['KJ-2025-07', '高炉炉温智能预测模型研究', '刘强', '执行中', '180']] };
    } else {
      const fieldsMap = [['焦比', 'coke_rate', 'kg/t', 352, 6], ['煤比', 'coal_rate', 'kg/t', 168, 5], ['硅', 'hm_si', '%', 0.34, 0.05], ['利用系数', 'productivity', 't/(m³·d)', 2.46, 0.06], ['温度', 'hm_temp', '℃', 1502, 8]];
      let picked = fieldsMap.filter(f => text.includes(f[0]));
      if (!picked.length) picked = fieldsMap.slice(0, 2);
      const days = /三天|3 天/.test(text) ? 3 : 7;
      const rows = [];
      for (let i = days - 1; i >= 0; i--) {
        const day = new Date(Date.UTC(2026, 10, 10 - i));
        const date = day.toISOString().slice(0, 10);
        rows.push([date].concat(picked.map((f, j) => {
          const val = f[3] + (rand(c.seedKey + date, j) - 0.4) * f[4] * 2;
          return f[2] === '%' ? val.toFixed(2) : f[2] === 't/(m³·d)' ? val.toFixed(2) : String(Math.round(val));
        })));
      }
      const sql = 'SELECT prod_date, ' + picked.map(f => f[1]).join(', ') + ' FROM bf_daily WHERE bf_no = 2 AND prod_date >= DATE \'' + rows[0][0] + '\' ORDER BY prod_date LIMIT ' + c.param('db_query', 'maxRows');
      result = { sql, head: ['日期'].concat(picked.map(f => f[0] === '硅' ? '铁水硅含量（%）' : f[0] + '（' + f[2] + '）')), rows, fields: picked };
    }
    addStep(c, 'db_query', { sql: result.sql }, 'ok', 'SQL 校验通过（只读），返回 ' + result.rows.length + ' 行', [{ title: db.title, loc: result.rows.length + ' 行', level: db.level }]);
    if (c.zone === 'external') {
      const split = P.partitionForModel([db], c.zone, c.org, c.policy);
      if (split.blocked.length) { c.out.blocked.push({ id: db.id, title: db.title + ' 的查询结果', level: db.level }); result.blockedForModel = true; }
      else c.out.sentOut.push({ id: db.id, title: db.title + ' 的查询结果', level: db.level });
    }
    result.db = db;
    return result;
  }

  function analyze(c, data) {
    if (!data || !data.fields || !c.has('data_analysis')) return null;
    const series = data.fields.map((f, j) => ({ name: data.head[j + 1], points: data.rows.map(r => Number(r[j + 1])) }));
    const stats = series.map(s => { const avg = s.points.reduce((a, b) => a + b, 0) / s.points.length; const diff = s.points[s.points.length - 1] - s.points[0]; return { name: s.name, avg, diff }; });
    addStep(c, 'data_analysis', { code: 'df.describe(); df.plot(x="prod_date")' }, 'ok', '沙箱执行完成，生成 1 张趋势图', []);
    return { series, labels: data.rows.map(r => r[0].slice(5)), stats };
  }

  /* ---------- 通用组装 ---------- */
  function finish(c) {
    const o = c.out;
    if (o.blocked.length && !o.allBlocked) o.notices.push({ tone: 'warn', text: '部分资料因密级限制未使用（' + o.blocked.length + ' 份），切换到内网模型可使用全部资料。' });
    if (o.filteredAcl) o.notices.push({ tone: 'info', text: '已按你的部门权限和密级过滤 ' + o.filteredAcl + ' 份资料。' });
    if (c.zone === 'external' && !o.intercepted) o.audit.push({ kind: '模型调用', target: c.modelName || '外网模型', content: (c.auditText || c.text).slice(0, 60), docs: o.sentOut.map(s => s.title), result: '放行', reason: o.blocked.length ? '已剔除 ' + o.blocked.length + ' 份受限资料' : '未包含受限资料' });
    const textLen = JSON.stringify(o.blocks).length;
    o.tokens = 800 + Math.round(textLen * 0.9) + o.steps.length * 260;
    o.durationMs = o.steps.reduce((a, s) => a + s.durationMs, 0) + 1800 + Math.round(textLen * 2);
    o.model = c.modelName;
    return o;
  }

  function gatewayCheck(c) {
    if (c.zone !== 'external') return false;
    const hit = P.findSensitive(c.text, c.policy.sensitiveWords);
    if (!hit) return false;
    c.out.blocks.push({ t: 'alert', tone: 'warn', text: '请求包含受限内容「' + hit + '」，已被出口网关拦截，未发送给外网模型。可以切换到内网模型后重新提问。' });
    c.out.audit.push({ kind: '模型调用', target: c.modelName || '外网模型', content: c.text.slice(0, 60), docs: [], result: '拦截', reason: '命中敏感词「' + hit + '」' });
    c.out.actions.push({ type: 'switch-internal', label: '切换到内网模型' });
    c.out.intercepted = true;
    return true;
  }

  /* ---------- 问答类 ---------- */
  function qa(c) {
    const t = c.text;
    const wantCad = /图纸|图号|DWG|DXF|布置图|结构图|流程图|总图/.test(t);
    const wantCode = /代码|程序|函数|仓库|源码/.test(t);
    const wantData = /数据|变化|趋势|平均|统计|近一个月|近三天|近 ?\d+ ?天|焦比|煤比|利用系数/.test(t) && c.ticked('db_query');
    const blocks = c.out.blocks;
    let used = 0;

    if (c.mode === 'files') {
      const files = searchDocs(c, 'doc_search', ['pdf', 'word'], t, { library: '全部资料库' }).concat(searchDocs(c, 'cad_search', ['cad'], t));
      if (!files.length) return noResult(c);
      blocks.push({ t: 'p', text: '找到 ' + files.length + ' 份相关资料：' });
      blocks.push({ t: 'files', items: files.map(d => ({ id: d.id, n: cite(c, d, 'doc'), title: d.title, type: TYPE_LABEL[d.type], process: d.process, year: d.year, level: d.level, summary: d.summary, cad: d.cad })) });
      return;
    }

    const items = [];
    if (wantCad) {
      const dwgs = searchDocs(c, 'cad_search', ['cad'], t);
      if (dwgs.length) {
        used += dwgs.length;
        blocks.push({ t: 'p', text: '找到以下图纸（只提供文件与标题栏信息，不解读图纸内容）：' });
        blocks.push({ t: 'files', items: dwgs.map(d => ({ id: d.id, n: cite(c, d, 'doc', '图号 ' + (d.cad.drawingNo || '待补录')), title: d.title, type: d.cad.format, process: d.process, year: d.year, level: d.level, summary: '图号 ' + (d.cad.drawingNo || '待补录') + ' · 版本 ' + (d.cad.version || '—') + ' · 设计 ' + (d.cad.designer || '—'), cad: d.cad })) });
      }
    }
    if (wantCode) {
      const repos = searchDocs(c, 'code_search', ['code'], t);
      repos.forEach(d => {
        used++;
        const s = d.snippets[0];
        blocks.push({ t: 'p', text: d.title + '：' + d.summary + ' [' + cite(c, d, 'doc', s.loc) + ']' });
        blocks.push({ t: 'code', loc: s.loc, text: s.text });
      });
    }
    let data = null;
    if (wantData) {
      data = queryData(c, t);
      if (data) {
        used++;
        const n = cite(c, data.db, 'doc', data.db.db.tables[0].name);
        if (data.blockedForModel) blocks.push({ t: 'alert', tone: 'warn', text: '查询结果属于内部资料，按出网策略未发送给外网模型，以下表格仅在本地展示。' });
        blocks.push({ t: 'p', text: '数据来自' + data.db.title + ' [' + n + ']，执行的只读 SQL 见工具调用记录：' });
        blocks.push({ t: 'table', head: data.head, rows: data.rows });
        const chart = analyze(c, data);
        if (chart) {
          blocks.push({ t: 'chart', labels: chart.labels, series: chart.series });
          blocks.push({ t: 'ul', items: chart.stats.map(s => s.name + '：区间均值 ' + s.avg.toFixed(2) + '，首尾变化 ' + (s.diff >= 0 ? '+' : '') + s.diff.toFixed(2)) });
        } else if (data.fields) {
          data.fields.forEach((f, j) => {
            const vals = data.rows.map(r => Number(r[j + 1]));
            const avg = vals.reduce((a, b) => a + b, 0) / vals.length;
            items.push(data.head[j + 1] + '区间均值约 ' + (f[2] === '%' || f[2] === 't/(m³·d)' ? avg.toFixed(2) : Math.round(avg)) + '，最近一天为 ' + vals[vals.length - 1] + ' [' + n + ']');
          });
        }
      }
    }
    if (!wantCad && !wantCode) {
      const docs = searchDocs(c, 'doc_search', ['pdf', 'word'], t);
      docs.forEach(d => {
        used++;
        const s = d.snippets && d.snippets[0];
        items.push(d.summary + ' [' + cite(c, d, 'doc', s ? s.loc : '') + ']');
        if (s && s.text.length > 8 && !s.text.includes('机密内容')) items.push(s.text + ' [' + cite(c, d, 'doc', s.loc) + ']');
      });
    }
    if (c.scope !== 'internal') {
      const pages = searchWeb(c, t);
      pages.filter(w => w.credibility !== '低').slice(0, 3).forEach(w => { used++; items.push('公开资料显示：' + w.summary + ' [' + cite(c, w, 'web') + ']'); });
    }
    if (!used) return noResult(c);
    if (items.length) {
      blocks.push({ t: 'p', text: '根据检索到的资料，要点如下：' });
      blocks.push({ t: 'ul', items: uniq(items).slice(0, 8) });
    }
    if (c.agent.constraint === 'diagnosis') blocks.push({ t: 'alert', tone: 'info', text: '以上为排查思路和历史依据，不构成操作指令，需由工艺人员确认后执行。' });
    if (c.ticked('report_export')) c.out.actions.push({ type: 'export', format: 'word', label: '导出 Word' });
  }

  function noResult(c) {
    if (c.out.blocked.length) {
      c.out.allBlocked = true;
      c.out.blocks.push({ t: 'p', text: '检索到 ' + c.out.blocked.length + ' 份相关厂内资料，但都因密级限制未发送给外网模型，无法据此回答。' });
      c.out.blocks.push({ t: 'ul', items: c.out.blocked.map(b => '《' + b.title + '》（' + P.levelLabel(b.level) + '）') });
      if (c.agent.allowedModels && c.agent.allowedModels.includes('internal')) c.out.actions.push({ type: 'switch-internal', label: '切换到内网模型重新回答' });
      return;
    }
    c.out.blocks.push({ t: 'p', text: '未找到相关资料。' });
    c.out.blocks.push({ t: 'ul', items: ['换用更具体的关键词，例如工序名称、课题名称或高炉编号', c.scope === 'internal' ? '把资料范围切换为“全部”，同时检索公开资料' : '把资料范围切换为“全部”，同时检索厂内资料', '确认资料已入库且解析完成'] });
  }

  /* ---------- 报告类：大纲 → 撰写 ---------- */
  function outlineFor(c, topic) {
    return (OUTLINES[c.agent.id] || OUTLINES.survey).map((h, i) => NUM[i] + '、' + h);
  }

  function topicOf(text) {
    return text.replace(/^(请|帮我)?(调研|撰写|写一份|写|跟踪|设计|整理|核对|为|从)/, '').replace(/[，,].*$/, '').replace(/[。.]$/, '').trim() || text.slice(0, 20);
  }

  function reportFlow(c) {
    const st = c.state || {};
    const t = c.text;
    if (t !== '#confirm' && t !== '#include-low') {
      if (st.stage === 'outline' || st.stage === 'done') {
        if (st.stage === 'outline' && /增加|补充|加入|添加/.test(t)) {
          const extra = t.replace(/^.*?(增加|补充|加入|添加)(一章|一节|章节)?/, '').replace(/[。.]$/, '') || '补充内容';
          st.outline = st.outline.concat(NUM[st.outline.length] + '、' + extra);
          return showOutline(c, st, '已在大纲末尾增加“' + extra + '”，请确认：');
        }
        if (st.stage === 'outline') {
          return showOutline(c, st, '已记录修改意见，请确认调整后的大纲：');
        }
      }
      const topic = topicOf(t);
      const s = { stage: 'outline', topic, request: t, outline: outlineFor(c, topic), includeLow: false };
      return showOutline(c, s, '已根据主题生成报告大纲，请确认，或直接回复修改意见（例如“增加一章投资估算”）：');
    }
    if (t === '#include-low') st.includeLow = true;
    return writeReport(c, st);
  }

  function showOutline(c, st, lead) {
    c.out.blocks.push({ t: 'p', text: lead });
    c.out.blocks.push({ t: 'outline', items: st.outline });
    c.out.actions.push({ type: 'confirm', label: '确认大纲，开始撰写' });
    c.state = st;
  }

  function writeReport(c, st) {
    const text = st.request || st.topic;
    c.auditText = text;
    const pages = c.scope !== 'internal' ? searchWeb(c, text, { loose: true }) : [];
    const docs = c.scope !== 'public' ? searchDocs(c, 'doc_search', ['pdf', 'word'], text, { library: '全部资料库' }) : [];
    const low = pages.filter(w => w.credibility === '低');
    const usable = pages.filter(w => w.credibility !== '低' || st.includeLow);
    const sections = [];
    const srcs = usable.map(w => ({ kind: 'web', item: w })).concat(docs.map(d => ({ kind: 'doc', item: d })));
    st.outline.forEach((h, i) => {
      const title = stripNo(h);
      const paras = [];
      if (i === 0) paras.push('本报告围绕“' + st.topic + '”展开，用于' + (/论证|路线/.test(text) ? '技术路线论证' : '内部技术决策参考') + '。资料来源包括' + (usable.length ? '公开网页与文献 ' + usable.length + ' 篇' : '') + (usable.length && docs.length ? '、' : '') + (docs.length ? '厂内资料 ' + docs.length + ' 份' : '') + '。');
      const span = Math.max(1, st.outline.length - 1);
      let mine = i === 0 ? [] : srcs.filter((_, j) => j % span === i - 1);
      if (i > 0 && !mine.length && srcs.length) mine = [srcs[(i - 1) % srcs.length]];
      mine.slice(0, 2).forEach(s => {
        const n = s.kind === 'web' ? cite(c, s.item, 'web') : cite(c, s.item, 'doc', s.item.snippets && s.item.snippets[0] ? s.item.snippets[0].loc : '');
        const lead = s.kind === 'web' ? (s.item.source + '指出') : '厂内资料显示';
        paras.push(title + '方面，' + lead + '：' + s.item.summary.replace(/。$/, '') + ' [' + n + ']。');
      });
      if (paras.length === 0) paras.push(title + '：暂无检索依据，建议补充资料后完善。');
      if (/建议|启示/.test(title)) paras.push('建议结合本厂高炉条件，分阶段开展技术验证，并在试点前完成经济性测算。');
      sections.push({ heading: h, paras });
    });
    if (low.length && !st.includeLow) {
      c.out.notices.push({ tone: 'warn', text: '有 ' + low.length + ' 条低可信来源未写入正文：' + low.map(w => '《' + w.title + '》（' + w.source + '）').join('、') + '。' });
      c.out.actions.push({ type: 'include-low', label: '采用低可信来源并重新生成' });
    }
    const level = maxLevel(c.out.citations);
    c.out.blocks.push({ t: 'report', title: st.topic + (c.agent.id === 'survey-report' ? '调研报告' : ''), level, sections });
    c.out.actions.push({ type: 'export', format: 'word', label: '导出 Word' }, { type: 'export', format: 'md', label: '导出 Markdown' });
    st.stage = 'done';
    c.state = st;
  }

  function maxLevel(citations) {
    let best = 'public';
    citations.forEach(x => { if (P.levelRank(x.level) > P.levelRank(best)) best = x.level; });
    return best;
  }

  /* ---------- 立项查新 ---------- */
  const POINT_RULES = [
    [/机器学习|深度学习|神经网络|模型|预测/, '采用机器学习模型预测高炉炉温（铁水硅含量）', ['炉温', '预测', '模型', '机器学习', '硅含量']],
    [/球团/, '高比例球团矿条件下的炉料结构与冶炼制度', ['球团', '球团矿', '软熔带']],
    [/低碳|碳排放|减排/, '以降低吨铁碳排放为目标的工艺优化', ['低碳', '碳排放']],
    [/氢|富氢|喷吹/, '高炉富氢气体喷吹工艺', ['氢', '富氢', '喷吹']],
    [/炉缸|长寿|侵蚀/, '炉缸侵蚀监测与长寿技术', ['炉缸', '侵蚀', '长寿']],
    [/烧结|烟气/, '烧结工序工艺与烟气治理', ['烧结', '烟气']]
  ];

  function noveltyFlow(c) {
    const st = c.state || {};
    if (c.text !== '#confirm') {
      const text = c.text.replace(/^拟立项[:：]?/, '');
      const points = [], kws = [];
      POINT_RULES.forEach(([re, p, k]) => { if (re.test(text)) { points.push(p); kws.push(...k); } });
      const metric = text.match(/(误差|命中率|精度|降低|提高)[^，。,]*?\d+(\.\d+)?\s*(%|kg\/t|个百分点)/);
      if (metric) points.push('关键指标：' + metric[0]);
      if (!points.length) points.push(text.split(/[，。,]/)[0]);
      points.push('在本厂高炉上的工程化应用');
      const topic = text.split(/[，,。]/)[0];
      const s = { stage: 'points', topic, request: text, points, keywords: uniq(kws.concat(['高炉'])).slice(0, 8) };
      c.out.blocks.push({ t: 'p', text: '已提炼 ' + points.length + ' 个查新要点和检索关键词，请确认后开始检索（可直接回复修改意见）：' });
      c.out.blocks.push({ t: 'table', head: ['查新要点', '检索关键词'], rows: points.map((p, i) => [p, i === 0 ? s.keywords.join('、') : '']) });
      c.out.blocks.push({ t: 'alert', tone: 'info', text: '拟立项内容属于未公开信息：联网检索只发送你确认过的关键词。' });
      c.out.actions.push({ type: 'confirm', label: '确认要点，开始检索' });
      c.state = s;
      return;
    }
    const query = st.keywords.join(' ') + ' ' + st.request;
    c.auditText = st.request;
    const docs = c.scope !== 'public' ? searchDocs(c, 'doc_search', ['pdf', 'word'], query, { anyLibrary: true }) : [];
    if (c.scope === 'public') c.out.notices.push({ tone: 'info', text: '当前资料范围为“公开资料”，未做厂内查重。' });
    const pages = c.scope !== 'internal' ? searchWeb(c, query) : [];
    const verdicts = st.points.map(p => {
      const words = (POINT_RULES.find(r => r[1] === p) || [null, null, p.replace(/[^\u4e00-\u9fa5]/g, '').match(/.{2}/g) || []])[2];
      const inDoc = docs.find(d => score(d.keywords, words.join('')) + score(words, d.keywords.join('')) >= 2);
      const inWeb = pages.find(w => score(w.tags, words.join('')) + score(words, w.tags.join('')) >= 2);
      if (inDoc) return [p, '厂内已有', '《' + inDoc.title + '》 [' + cite(c, inDoc, 'doc', inDoc.snippets && inDoc.snippets[0] ? inDoc.snippets[0].loc : '') + ']'];
      if (inWeb) return [p, '外部已有', '《' + inWeb.title + '》 [' + cite(c, inWeb, 'web') + ']'];
      return [p, '未发现相同成果', '—'];
    });
    const inHouse = verdicts.filter(v => v[1] === '厂内已有').length;
    const outside = verdicts.filter(v => v[1] === '外部已有').length;
    const conclusion = inHouse >= Math.ceil(st.points.length / 2) ? '存在重复' : (inHouse + outside) > 0 ? '建议调整研究内容' : '建议立项';
    const conclusionText = { '存在重复': '多数查新要点在厂内已有课题或成果覆盖，存在重复立项风险，建议与已有课题合并或明确差异化目标。', '建议调整研究内容': '部分要点已有厂内或外部成果，建议在已有基础上调整研究重点，突出差异化创新。', '建议立项': '未发现与查新要点相同的厂内课题和公开成果，建议立项。' }[conclusion];
    const sections = [
      { heading: '一、查新目的', paras: ['判断拟立项课题“' + st.topic + '”是否与厂内已有课题或外部公开成果重复，为立项评审提供参考。'] },
      { heading: '二、查新要点', paras: st.points.map((p, i) => (i + 1) + '. ' + p) },
      { heading: '三、检索范围与关键词', paras: ['厂内：' + (c.scope !== 'public' ? '课题库、科研报告库' : '未检索') + '；外部：' + (c.scope !== 'internal' ? '公开论文、专利、标准与行业报道' : '未检索') + '。', '关键词：' + st.keywords.join('、') + '。'] },
      { heading: '四、厂内查重结果', paras: docs.length ? [] : ['未发现相似的厂内课题或资料。'], table: docs.length ? { head: ['课题 / 资料', '年份', '承担部门', '相似点'], rows: docs.map(d => [d.title + ' [' + cite(c, d, 'doc', d.snippets && d.snippets[0] ? d.snippets[0].loc : '') + ']', String(d.year), d.dept, d.summary]) } : null },
      { heading: '五、外部查新结果', paras: pages.length ? [] : ['未检索到相关公开成果。'], table: pages.length ? { head: ['标题', '来源', '发布时间', '摘要'], rows: pages.map(w => [w.title + ' [' + cite(c, w, 'web') + ']', w.source, w.date, w.summary]) } : null },
      { heading: '六、逐要点对比', paras: [], table: { head: ['查新要点', '结论', '依据'], rows: verdicts } },
      { heading: '七、查新结论：' + conclusion, paras: [conclusionText, '本结论仅作为内部立项参考，不替代正式科技查新机构出具的查新报告。'] }
    ];
    c.out.blocks.push({ t: 'report', title: st.topic + ' 立项查新报告', level: maxLevel(c.out.citations), verdict: conclusion, sections });
    c.out.actions.push({ type: 'export', format: 'word', label: '导出 Word' });
    st.stage = 'done';
    c.state = st;
  }

  /* ---------- 技术情报简报 ---------- */
  function intelFlow(c) {
    const st = c.state || {};
    if (c.text !== '#confirm') {
      const range = prevMonthRange(c.now);
      const topic = topicOf(c.text).replace(/^上月/, '').replace(/技术动态$/, '') || c.text;
      const words = keywordsOf(c, c.text);
      const s = { stage: 'plan', topic, request: c.text, range, objects: '同行企业、科研院所', words };
      c.out.blocks.push({ t: 'p', text: '检索计划如下，确认后开始生成简报：' });
      c.out.blocks.push({ t: 'table', head: ['项目', '内容'], rows: [['跟踪主题', topic], ['关注对象', s.objects], ['时间范围', range.from + ' 至 ' + range.to + '（上一个自然月）'], ['检索词组', ['技术动态', '专利', '论文', '政策标准'].map(k => words.join(' ') + ' ' + k).join('；')]] });
      c.out.actions.push({ type: 'confirm', label: '确认计划，生成简报' });
      c.state = s;
      return;
    }
    c.auditText = st.request;
    const all = searchWeb(c, st.request, { range: st.range });
    const outOfRange = c.web.filter(w => score(w.tags, st.request) > 0 && (w.date < st.range.from || w.date > st.range.to)).length;
    if (outOfRange) c.out.notices.push({ tone: 'info', text: '已剔除超出时间范围的内容 ' + outOfRange + ' 条。' });
    if (!all.length) { c.out.blocks.push({ t: 'p', text: '本期未检索到符合时间范围的情报。可以放宽时间范围或调整主题后重试。' }); st.stage = 'done'; c.state = st; return; }
    const focus = ['高炉', '富氢', '球团', '烧结', '低碳', '氢'];
    const cat = w => w.tags.includes('专利') ? '专利' : /期刊|学报/.test(w.source) ? '论文' : w.tags.includes('政策') ? '政策标准' : /协会|研究院/.test(w.source) ? '行业事件' : '技术动态';
    const attention = w => { const s = score(focus, w.tags.join('')); return s >= 3 ? '高' : s >= 2 ? '中' : '低'; };
    const items = all.map(w => ({ w, cat: cat(w), att: attention(w) }));
    const order = ['技术动态', '专利', '论文', '政策标准', '行业事件'];
    const sections = [{ heading: '本期要点', paras: items.slice().sort((a, b) => '高中低'.indexOf(a.att) - '高中低'.indexOf(b.att)).slice(0, 4).map((x, i) => (i + 1) + '. ' + x.w.summary.replace(/。$/, '') + ' [' + cite(c, x.w, 'web') + ']') }];
    order.forEach(k => {
      const rows = items.filter(x => x.cat === k).map(x => [x.w.title + ' [' + cite(c, x.w, 'web') + ']', x.w.source, x.w.date, x.w.summary, x.att]);
      if (rows.length) sections.push({ heading: k, paras: [], table: { head: ['标题', '来源', '发布时间', '摘要', '关注度'], rows } });
    });
    c.out.blocks.push({ t: 'report', title: '技术情报简报（' + st.range.label + '）· ' + st.topic, level: 'public', sections });
    c.out.actions.push({ type: 'export', format: 'word', label: '导出 Word' });
    st.stage = 'done';
    c.state = st;
  }

  /* ---------- 专家经验整理 ---------- */
  function expertFlow(c) {
    if (c.text.length < 40) return qa(c);
    const sentences = c.text.split(/[。；;\n]/).map(s => s.trim()).filter(Boolean);
    c.out.blocks.push({ t: 'p', text: '已整理为知识条目，标注“待确认”的内容需专家本人或指定审核人确认后才能入库：' });
    c.out.blocks.push({ t: 'table', head: ['现象', '判断', '处置', '注意事项'], rows: [[sentences[0] || '—', sentences[1] || '待确认', sentences[2] || '待确认', sentences[3] || '待确认']] });
    c.out.actions.push({ type: 'export', format: 'word', label: '导出 Word' });
  }

  function respond(ctx) {
    const c = makeCtx(ctx);
    if (!c.modelName) {
      c.out.blocks.push({ t: 'alert', tone: 'warn', text: P.zoneLabel(c.zone) + '暂不可用。' + (c.zone === 'external' ? '可以切换到内网模型继续。' : '请稍后重试。') });
      if (c.zone === 'external') c.out.actions.push({ type: 'switch-internal', label: '切换到内网模型' });
      return { turn: finish(c), state: c.state };
    }
    if (!gatewayCheck(c)) {
      const flow = c.agent.flow || (c.agent.template === 'report' ? 'report' : 'qa');
      if (flow === 'survey' || flow === 'report') reportFlow(c);
      else if (flow === 'novelty') noveltyFlow(c);
      else if (flow === 'intel') intelFlow(c);
      else if (c.agent.id === 'expert-knowledge') expertFlow(c);
      else qa(c);
    }
    return { turn: finish(c), state: c.state };
  }

  /* ---------- 导出 ---------- */
  const strip = s => String(s).replace(/\s*\[(\d+)\]/g, '[$1]');
  const esc = s => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

  function toMarkdown(doc) {
    const lines = ['# ' + doc.title, ''];
    if (doc.level && doc.level !== 'public') lines.push('> 密级：' + P.levelLabel(doc.level), '');
    lines.push('> 生成：' + doc.agentName + ' · ' + doc.time, '');
    doc.blocks.forEach(b => {
      if (b.t === 'p' || b.t === 'alert') lines.push(strip(b.text), '');
      if (b.t === 'ul' || b.t === 'outline') { b.items.forEach(x => lines.push('- ' + strip(x))); lines.push(''); }
      if (b.t === 'table') lines.push(mdTable(b.head, b.rows), '');
      if (b.t === 'report') b.sections.forEach(s => { lines.push('## ' + s.heading, ''); s.paras.forEach(p => lines.push(strip(p), '')); if (s.table) lines.push(mdTable(s.table.head, s.table.rows), ''); });
      if (b.t === 'files') { b.items.forEach(x => lines.push('- ' + x.title + '（' + x.type + '，' + x.year + '）')); lines.push(''); }
    });
    if (doc.citations.length) { lines.push('## 参考来源', ''); doc.citations.forEach(x => lines.push('[' + x.n + '] ' + x.title + ' · ' + x.loc + ' · ' + x.origin + (x.url ? ' · ' + x.url : ''))); }
    return lines.join('\n');
  }
  const mdTable = (head, rows) => ['| ' + head.join(' | ') + ' |', '|' + head.map(() => '---').join('|') + '|'].concat(rows.map(r => '| ' + r.map(x => strip(x).replace(/\|/g, '/')).join(' | ') + ' |')).join('\n');

  function toWordHtml(doc) {
    const tbl = (head, rows) => '<table><tr>' + head.map(h => '<th>' + esc(h) + '</th>').join('') + '</tr>' + rows.map(r => '<tr>' + r.map(x => '<td>' + esc(strip(x)) + '</td>').join('') + '</tr>').join('') + '</table>';
    let body = '';
    if (doc.level && doc.level !== 'public') body += '<p class="level">密级：' + P.levelLabel(doc.level) + '</p>';
    body += '<h1>' + esc(doc.title) + '</h1><p class="meta">生成：' + esc(doc.agentName) + ' · ' + esc(doc.time) + '</p>';
    doc.blocks.forEach(b => {
      if (b.t === 'p' || b.t === 'alert') body += '<p>' + esc(strip(b.text)) + '</p>';
      if (b.t === 'ul' || b.t === 'outline') body += '<ul>' + b.items.map(x => '<li>' + esc(strip(x)) + '</li>').join('') + '</ul>';
      if (b.t === 'table') body += tbl(b.head, b.rows);
      if (b.t === 'report') b.sections.forEach(s => { body += '<h2>' + esc(s.heading) + '</h2>' + s.paras.map(p => '<p>' + esc(strip(p)) + '</p>').join(''); if (s.table) body += tbl(s.table.head, s.table.rows); });
      if (b.t === 'files') body += '<ul>' + b.items.map(x => '<li>' + esc(x.title) + '（' + esc(x.type) + '，' + x.year + '）</li>').join('') + '</ul>';
    });
    if (doc.citations.length) body += '<h2>参考来源</h2>' + doc.citations.map(x => '<p class="ref">[' + x.n + '] ' + esc(x.title) + ' · ' + esc(x.loc) + ' · ' + x.origin + (x.url ? ' · ' + esc(x.url) : '') + '</p>').join('');
    return '<html xmlns:o="urn:schemas-microsoft-com:office:office" xmlns:w="urn:schemas-microsoft-com:office:word"><head><meta charset="utf-8"><title>' + esc(doc.title) + '</title><style>body{font-family:"Microsoft YaHei","PingFang SC",sans-serif;font-size:10.5pt;line-height:1.6}h1{font-size:18pt}h2{font-size:13pt;margin-top:14pt}table{border-collapse:collapse;width:100%;margin:6pt 0}th,td{border:1px solid #999;padding:4pt 6pt;font-size:9pt;vertical-align:top}th{background:#eee}.level{color:#c0392b;font-weight:bold;text-align:right}.meta{color:#888;font-size:9pt}.ref{font-size:9pt;color:#555}</style></head><body>' + body + '</body></html>';
  }

  AOS.engine = { respond, toMarkdown, toWordHtml, prevMonthRange, hash, TYPE_LABEL };
})(typeof window !== 'undefined' ? window : globalThis);
