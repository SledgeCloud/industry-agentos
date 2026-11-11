/* AgentOS · 知识库与资料管理 */
(function (root) {
  const AOS = root.AOS;
  const { ui, svc, store, policy: P } = AOS;
  const { esc, icon } = ui;
  const TABS = [
    { id: '', name: '全部' }, { id: 'doc', name: '文档', types: ['pdf', 'word'] }, { id: 'cad', name: '图纸', types: ['cad'] },
    { id: 'code', name: '代码', types: ['code'] }, { id: 'db', name: '数据表', types: ['db'] }
  ];
  const LIBS = ['科研报告库', '课题库', '标准库', '专家经验库', '图纸库', '代码库', '数据库'];
  const PROCESSES = ['高炉', '烧结', '焦化', '球团', '综合'];
  const f = { tab: '', q: '', process: '', level: '', status: '' };
  const active = new Set();
  let redraw = null;

  const TITLE_BLOCK = { auto: ['自动识别', 'ok'], manual: ['人工补录', 'info'], missing: ['未识别，待补录', 'warn'] };

  function statusCell(d) {
    if (d.status === 'parsing') return '<span class="row small"><span class="progress"><i style="width:' + (d.progress || 10) + '%"></i></span>解析中</span>';
    if (d.status === 'failed') return '<span class="badge danger">' + icon('circle-alert') + '解析失败</span><div class="small muted">' + esc(d.failReason || '') + '</div>';
    if (d.type === 'cad' && d.cad && d.cad.titleBlock === 'missing') return '<span class="badge warn">标题栏待补录</span>';
    return '<span class="badge ok">' + icon('check') + (d.type === 'db' ? '字典已登记' : d.type === 'code' ? '已同步' : '已解析') + '</span>';
  }

  AOS.views.knowledge = function (el) {
    AOS.setCrumbs([{ name: '知识库' }]);
    const user = svc.currentUser();

    function list() {
      const tab = TABS.find(t => t.id === f.tab);
      return store.state.docs.filter(d => P.canView(user, d) && (!tab.types || tab.types.includes(d.type)) && (!f.process || d.process === f.process) && (!f.level || d.level === f.level) && (!f.status || d.status === f.status) && (!f.q || (d.title + d.topic + d.author + (d.cad ? d.cad.drawingNo : '')).includes(f.q)));
    }

    function draw() {
      const visible = store.state.docs.filter(d => P.canView(user, d));
      const hidden = store.state.docs.length - visible.length;
      const rows = list();
      el.querySelector('#kTabs').innerHTML = TABS.map(t => '<button class="' + (f.tab === t.id ? 'on' : '') + '" data-tab="' + t.id + '">' + t.name + '<span class="count">' + visible.filter(d => !t.types || t.types.includes(d.type)).length + '</span></button>').join('');
      el.querySelector('#kHidden').innerHTML = hidden ? '<div class="note" style="margin-bottom:12px">' + icon('eye-off') + '<span>已按你的部门权限和密级（' + P.levelLabel(user.clearance) + '级）隐藏 ' + hidden + ' 份资料。切换为平台管理员可查看全部。</span></div>' : '';
      el.querySelector('#kBody').innerHTML = rows.length ? rows.map(d => '<tr class="clickable" data-id="' + d.id + '"><td><div class="doc-title">' + ui.typeIcon(d.type) + '<div><div class="t">' + esc(d.title) + '</div><div class="small muted">' + esc(AOS.engine.TYPE_LABEL[d.type]) + (d.cad && d.cad.drawingNo ? ' · 图号 ' + esc(d.cad.drawingNo) : '') + (d.code ? ' · ' + esc(d.code.lang) : '') + (d.pages ? ' · ' + d.pages + ' 页' : '') + '</div></div></div></td><td class="nowrap">' + esc(d.library) + '</td><td>' + esc(d.process) + '</td><td>' + d.year + '</td><td class="nowrap">' + esc(d.author || '—') + '<div class="small muted">' + esc(d.dept) + '</div></td><td>' + ui.lv(d.level) + '</td><td class="nowrap small">' + (d.acl && d.acl.length ? esc(d.acl.join('、')) : '全部部门') + '</td><td>' + statusCell(d) + '</td><td class="nowrap">' + (d.status === 'failed' ? '<button class="btn sm" data-retry="' + d.id + '">' + icon('rotate-ccw') + '重试</button>' : '<button class="btn sm ghost">详情</button>') + '</td></tr>').join('') : '<tr><td colspan="9"><div class="empty">' + icon('search-x') + '没有符合条件的资料。调整筛选条件，或上传新资料。</div></td></tr>';
      ui.icons();
    }

    el.innerHTML = '<div class="page"><div class="page-head"><div><h1>知识库</h1><p>资料入库后由对应内置工具自动解析和索引；智能体只能通过内置工具检索，并按权限和密级过滤。</p></div><button class="btn primary" id="uploadBtn">' + icon('upload') + '上传资料</button></div>' +
      '<div class="tabs" id="kTabs" role="tablist"></div><div id="kHidden"></div>' +
      '<div class="toolbar"><label class="search"><span class="sr-only">搜索资料</span>' + icon('search') + '<input class="input" id="kQ" placeholder="搜索名称、课题、作者或图号" value="' + esc(f.q) + '"></label>' +
      '<select class="select" id="kProc" aria-label="工序"><option value="">全部工序</option>' + PROCESSES.map(p => '<option' + (f.process === p ? ' selected' : '') + '>' + p + '</option>').join('') + '</select>' +
      '<select class="select" id="kLevel" aria-label="密级"><option value="">全部密级</option>' + P.LEVELS.map(l => '<option value="' + l.id + '"' + (f.level === l.id ? ' selected' : '') + '>' + l.label + '</option>').join('') + '</select>' +
      '<select class="select" id="kStatus" aria-label="状态"><option value="">全部状态</option><option value="parsed">已解析</option><option value="parsing">解析中</option><option value="failed">解析失败</option></select></div>' +
      '<div class="panel table-wrap"><table class="tbl"><thead><tr><th>资料</th><th>资料库</th><th>工序</th><th>年份</th><th>作者 / 部门</th><th>密级</th><th>可见范围</th><th>状态</th><th></th></tr></thead><tbody id="kBody"></tbody></table></div></div>';

    el.querySelector('#kStatus').value = f.status;
    el.querySelector('#kTabs').addEventListener('click', e => { const b = e.target.closest('[data-tab]'); if (b) { f.tab = b.dataset.tab; draw(); } });
    el.querySelector('#kQ').addEventListener('input', e => { f.q = e.target.value.trim(); draw(); });
    el.querySelector('#kProc').addEventListener('change', e => { f.process = e.target.value; draw(); });
    el.querySelector('#kLevel').addEventListener('change', e => { f.level = e.target.value; draw(); });
    el.querySelector('#kStatus').addEventListener('change', e => { f.status = e.target.value; draw(); });
    el.querySelector('#kBody').addEventListener('click', e => {
      const r = e.target.closest('[data-retry]');
      if (r) { const d = store.state.docs.find(x => x.id === r.dataset.retry); startParse(d, false); return; }
      const tr = e.target.closest('tr[data-id]');
      if (tr) openEditor(tr.dataset.id);
    });
    el.querySelector('#uploadBtn').addEventListener('click', upload);

    function startParse(d, mayFail, resume) {
      if (active.has(d.id)) return;
      active.add(d.id);
      if (!resume) { d.status = 'parsing'; d.progress = 8; d.failReason = ''; }
      store.save(); draw();
      const failing = mayFail && /损坏|扫描件/.test(d.title);
      const step = () => {
        d.progress = Math.min(100, (d.progress || 8) + 23);
        if (d.progress >= 100) {
          if (failing && !d.retried) { d.status = 'failed'; d.failReason = '版面解析超时，可重试'; d.retried = true; }
          else { d.status = 'parsed'; delete d.progress; }
          active.delete(d.id);
          store.save(); if (redraw) redraw();
          if (d.status === 'parsed') ui.toast('《' + d.title + '》' + (d.type === 'cad' ? (d.cad.titleBlock === 'missing' ? '已入库，标题栏未识别，请补录' : '已入库，标题栏已自动识别') : '解析完成，可被检索'));
          return;
        }
        if (redraw) redraw();
        setTimeout(step, 520);
      };
      setTimeout(step, 520);
    }

    function upload() {
      ui.modal({
        title: '上传资料', okText: '上传并解析',
        body: '<div class="stack"><div class="field"><label for="upFiles">选择文件</label><input class="input" type="file" id="upFiles" multiple accept=".pdf,.doc,.docx,.dwg,.dxf" style="padding:5px"><span class="hint">支持 PDF、Word、DWG、DXF。代码仓库和数据库通过管理员接入，不在此上传。</span></div>' +
          '<div class="grid-2"><div class="field"><label for="upLib">资料库</label><select class="select" id="upLib">' + LIBS.slice(0, 5).map(l => '<option>' + l + '</option>').join('') + '</select></div><div class="field"><label for="upProc">工序</label><select class="select" id="upProc">' + PROCESSES.map(p => '<option>' + p + '</option>').join('') + '</select></div></div>' +
          '<div class="grid-2"><div class="field"><label for="upLevel">密级</label><select class="select" id="upLevel">' + P.LEVELS.filter(l => P.levelRank(l.id) <= P.levelRank(user.clearance)).map(l => '<option value="' + l.id + '"' + (l.id === 'internal' ? ' selected' : '') + '>' + l.label + '</option>').join('') + '</select><span class="hint">不能高于你本人的密级</span></div><div class="field"><label for="upTopic">课题</label><input class="input" id="upTopic" placeholder="可选"></div></div>' +
          '<div class="field"><span class="field-label">可见部门</span><div class="row wrap"><label class="check"><input type="checkbox" id="upAll" checked>全部部门</label>' + AOS.data.orgs.map(o => '<label class="check"><input type="checkbox" class="upOrg" value="' + esc(o) + '" disabled>' + esc(o) + '</label>').join('') + '</div></div>' +
          '<span class="err" id="upErr" hidden>请选择至少一个文件</span><div class="note">' + icon('info') + '<span>演示环境不会读取文件内容，只模拟解析过程。文件名包含“扫描件”或“损坏”时会模拟一次解析失败。</span></div></div>',
        onMount(m, close) {
          const all = m.querySelector('#upAll');
          all.addEventListener('change', () => m.querySelectorAll('.upOrg').forEach(c => { c.disabled = all.checked; if (all.checked) c.checked = false; }));
          m.querySelector('[data-ok]').addEventListener('click', () => {
            const files = Array.from(m.querySelector('#upFiles').files || []);
            if (!files.length) { m.querySelector('#upErr').hidden = false; return; }
            const acl = all.checked ? [] : Array.from(m.querySelectorAll('.upOrg:checked')).map(c => c.value);
            files.forEach(file => {
              const ext = file.name.split('.').pop().toLowerCase();
              const type = ext === 'pdf' ? 'pdf' : ext === 'dwg' || ext === 'dxf' ? 'cad' : 'word';
              const title = file.name.replace(/\.[^.]+$/, '');
              const recognized = type === 'cad' && !/草图|未命名/.test(title);
              const d = {
                id: store.uid('u'), type, title, library: type === 'cad' ? '图纸库' : m.querySelector('#upLib').value, process: m.querySelector('#upProc').value, topic: m.querySelector('#upTopic').value.trim() || '未分类', year: new Date().getFullYear(),
                author: user.name, dept: user.dept, level: m.querySelector('#upLevel').value, acl, pages: type === 'cad' ? undefined : Math.max(1, Math.round(file.size / 40000)),
                keywords: title.split(/[\s_\-（）()]+/).filter(w => w.length >= 2), summary: type === 'cad' ? ext.toUpperCase() + ' · 新上传' : '新上传资料，摘要将在解析后生成', snippets: [], status: 'parsing', updatedAt: svc.now().slice(0, 10),
                cad: type === 'cad' ? { format: ext.toUpperCase(), drawingNo: recognized ? 'NEW-' + String(Date.now()).slice(-4) : '', version: recognized ? 'A' : '', designer: recognized ? user.name : '', date: recognized ? svc.now().slice(0, 7) : '', titleBlock: recognized ? 'auto' : 'missing' } : undefined
              };
              store.state.docs.unshift(d);
              startParse(d, true);
            });
            close(); ui.toast('已上传 ' + files.length + ' 个文件，正在解析');
          });
        }
      });
    }

    function openEditor(id) {
      const d = store.state.docs.find(x => x.id === id);
      const canEdit = user.id === 'u-chen' || d.dept === user.dept;
      const tb = d.cad ? TITLE_BLOCK[d.cad.titleBlock] : null;
      const body = '<div class="stack">' +
        (d.type === 'cad' ? ui.cadThumb(d, 520, 300) + '<div class="row"><span class="field-label">标题栏</span><span class="badge ' + tb[1] + '">' + tb[0] + '</span><span class="muted small">只管理文件与标题栏信息，不解读图纸内容</span></div>' +
          '<div class="grid-2">' + [['drawingNo', '图号'], ['version', '版本'], ['designer', '设计人'], ['date', '日期']].map(([k, l]) => '<div class="field"><label for="cad-' + k + '">' + l + '</label><input class="input" id="cad-' + k + '" data-cad="' + k + '" value="' + esc(d.cad[k]) + '"' + (canEdit ? '' : ' disabled') + '></div>').join('') + '</div>' : '') +
        '<div class="grid-2"><div class="field"><label for="eTitle">名称</label><input class="input" id="eTitle" value="' + esc(d.title) + '"' + (canEdit ? '' : ' disabled') + '></div><div class="field"><label for="eLib">资料库</label><select class="select" id="eLib"' + (canEdit ? '' : ' disabled') + '>' + LIBS.map(l => '<option' + (l === d.library ? ' selected' : '') + '>' + l + '</option>').join('') + '</select></div></div>' +
        '<div class="grid-3"><div class="field"><label for="eProc">工序</label><select class="select" id="eProc"' + (canEdit ? '' : ' disabled') + '>' + PROCESSES.map(p => '<option' + (p === d.process ? ' selected' : '') + '>' + p + '</option>').join('') + '</select></div><div class="field"><label for="eTopic">课题</label><input class="input" id="eTopic" value="' + esc(d.topic) + '"' + (canEdit ? '' : ' disabled') + '></div><div class="field"><label for="eLevel">密级</label><select class="select" id="eLevel"' + (canEdit ? '' : ' disabled') + '>' + P.LEVELS.filter(l => P.levelRank(l.id) <= P.levelRank(user.clearance)).map(l => '<option value="' + l.id + '"' + (l.id === d.level ? ' selected' : '') + '>' + l.label + '</option>').join('') + '</select></div></div>' +
        '<div class="field"><span class="field-label">可见部门</span><div class="row wrap"><label class="check"><input type="checkbox" id="eAll"' + (!d.acl || !d.acl.length ? ' checked' : '') + (canEdit ? '' : ' disabled') + '>全部部门</label>' + AOS.data.orgs.map(o => '<label class="check"><input type="checkbox" class="eOrg" value="' + esc(o) + '"' + ((d.acl || []).includes(o) ? ' checked' : '') + (!canEdit || !d.acl || !d.acl.length ? ' disabled' : '') + '>' + esc(o) + '</label>').join('') + '</div></div>' +
        (canEdit ? '' : '<div class="note">' + icon('lock') + '<span>只有资料所属部门或平台管理员可以修改。</span></div>') +
        '<hr style="border:0;border-top:1px solid var(--line-soft);margin:4px 0">' + ui.docDetailHtml(d) + '</div>';
      ui.drawer({
        title: d.title, body, foot: canEdit ? '<button class="btn" data-close>取消</button><button class="btn primary" id="eSave">保存</button>' : '<button class="btn" data-close>关闭</button>',
        onMount(dr, close) {
          const all = dr.querySelector('#eAll');
          if (all) all.addEventListener('change', () => dr.querySelectorAll('.eOrg').forEach(c => { c.disabled = all.checked; if (all.checked) c.checked = false; }));
          const save = dr.querySelector('#eSave');
          if (!save) return;
          save.addEventListener('click', () => {
            d.title = dr.querySelector('#eTitle').value.trim() || d.title;
            d.library = dr.querySelector('#eLib').value; d.process = dr.querySelector('#eProc').value; d.topic = dr.querySelector('#eTopic').value.trim();
            d.level = dr.querySelector('#eLevel').value;
            d.acl = all.checked ? [] : Array.from(dr.querySelectorAll('.eOrg:checked')).map(c => c.value);
            if (d.cad) {
              const before = JSON.stringify(d.cad);
              dr.querySelectorAll('[data-cad]').forEach(i => { d.cad[i.dataset.cad] = i.value.trim(); });
              if (JSON.stringify(d.cad) !== before) d.cad.titleBlock = d.cad.drawingNo ? 'manual' : 'missing';
              d.keywords = Array.from(new Set((d.keywords || []).concat([d.cad.drawingNo]).filter(Boolean)));
              d.summary = d.cad.format + ' · ' + TITLE_BLOCK[d.cad.titleBlock][0];
            }
            d.updatedAt = svc.now().slice(0, 10);
            store.save(); close(); draw(); ui.toast('已保存资料信息');
          });
        }
      });
    }

    redraw = draw;
    draw();
    store.state.docs.filter(d => d.status === 'parsing').forEach(d => startParse(d, true, true));
    return () => { redraw = null; };
  };
})(window);
