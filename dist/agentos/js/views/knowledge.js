/* AgentOS · 知识库与资料管理 */
(function (root) {
  const AOS = root.AOS;
  const { ui, svc, store, policy: P } = AOS;
  const F = AOS.folders;
  const L = AOS.libraries;
  const { esc, icon } = ui;
  const TABS = [
    { id: '', name: '全部' }, { id: 'doc', name: '文档', types: ['pdf', 'word'] }, { id: 'cad', name: '图纸', types: ['cad'] },
    { id: 'code', name: '代码', types: ['code'] }, { id: 'db', name: '数据表', types: ['db'] }
  ];
  const LIBS = ['科研报告库', '课题库', '标准库', '专家经验库', '图纸库', '代码库', '数据库'];
  const PROCESSES = ['高炉', '烧结', '焦化', '球团', '综合'];
  const ROLE_LABEL = { read: '阅读', edit: '编辑', manage: '管理' };
  const f = { tab: '', q: '', process: '', level: '', status: '' };
  const active = new Set();
  let currentLibraryId = null;
  let currentFolderId = null;
  let redraw = null;

  const TITLE_BLOCK = { auto: ['自动识别', 'ok'], manual: ['人工补录', 'info'], missing: ['未识别，待补录', 'warn'] };

  function statusCell(d) {
    if (d.status === 'parsing') return '<span class="row small"><span class="progress"><i style="width:' + (d.progress || 10) + '%"></i></span>解析中</span>';
    if (d.status === 'failed') return '<span class="badge danger">' + icon('circle-alert') + '解析失败</span><div class="small muted">' + esc(d.failReason || '') + '</div>';
    if (d.type === 'cad' && d.cad && d.cad.titleBlock === 'missing') return '<span class="badge warn">标题栏待补录</span>';
    return '<span class="badge ok">' + icon('check') + (d.type === 'db' ? '字典已登记' : d.type === 'code' ? '已同步' : '已解析') + '</span>';
  }

  function matchDoc(d) {
    const tab = TABS.find(t => t.id === f.tab);
    return (!tab.types || tab.types.includes(d.type)) && (!f.process || d.process === f.process) && (!f.status || d.status === f.status) && (!f.q || (d.title + d.topic + d.author + (d.cad ? d.cad.drawingNo : '')).includes(f.q));
  }

  function matchLib(lib) {
    if (f.level && lib.level !== f.level) return false;
    if (!f.q) return true;
    return ((lib.name || '') + (lib.description || '')).includes(f.q);
  }

  function libraryMetaOptions(currentName) {
    const base = LIBS.slice(0, 5);
    const opts = currentName && base.indexOf(currentName) < 0 ? base.concat([currentName]) : base.slice();
    return opts.map(l => '<option' + (l === currentName ? ' selected' : '') + '>' + esc(l) + '</option>').join('');
  }

  function folderOptionsHtml(selected, libraryId) {
    const sel = F.normId(selected);
    return F.flatOptions(store.state.folders, libraryId).map(o => {
      const id = F.normId(o.id);
      const val = id == null ? '' : id;
      return '<option value="' + esc(val) + '"' + (id === sel ? ' selected' : '') + '>' + esc(o.label) + '</option>';
    }).join('');
  }

  function folderCount(folderId, visibleDocs, libraryId) {
    return F.childrenOf(store.state.folders, folderId, libraryId).length + F.docsIn(visibleDocs, folderId, libraryId).length;
  }

  function peopleOptions(type, selected) {
    if (type === 'user') {
      const users = svc.users().slice();
      if (selected && !users.some(u => u.id === selected)) users.unshift({ id: selected, name: selected, dept: '' });
      if (!users.length) return '<option value="">暂无用户</option>';
      return users.map(u => '<option value="' + esc(u.id) + '"' + (u.id === selected ? ' selected' : '') + '>' + esc(u.name + (u.dept ? ' · ' + u.dept : '')) + '</option>').join('');
    }
    const names = ((store.state && store.state.departments) || []).map(d => d && d.name).filter(Boolean);
    if (!names.length && AOS.data && AOS.data.orgs) AOS.data.orgs.forEach(n => { if (names.indexOf(n) < 0) names.push(n); });
    if (selected && names.indexOf(selected) < 0) names.unshift(selected);
    if (!names.length) return '<option value="">暂无部门</option>';
    return names.map(n => '<option value="' + esc(n) + '"' + (n === selected ? ' selected' : '') + '>' + esc(n) + '</option>').join('');
  }

  function grantRowHtml(g) {
    const type = g && g.type === 'user' ? 'user' : 'dept';
    const id = g && g.id ? g.id : '';
    const role = g && ROLE_LABEL[g.role] ? g.role : 'read';
    return '<div class="kb-grant-row">' +
      '<select class="select g-type" aria-label="授权类型"><option value="dept"' + (type === 'dept' ? ' selected' : '') + '>部门</option><option value="user"' + (type === 'user' ? ' selected' : '') + '>用户</option></select>' +
      '<select class="select g-id" aria-label="授权对象">' + peopleOptions(type, id) + '</select>' +
      '<select class="select g-role" aria-label="权限等级">' +
      ['read', 'edit', 'manage'].map(r => '<option value="' + r + '"' + (r === role ? ' selected' : '') + '>' + ROLE_LABEL[r] + '</option>').join('') +
      '</select><button type="button" class="btn ghost icon sm g-rm" aria-label="移除这条授权">' + icon('x') + '</button></div>';
  }

  function readGrants(box) {
    const rank = L.ROLE_RANK || { read: 1, edit: 2, manage: 3 };
    const best = new Map();
    box.querySelectorAll('.kb-grant-row').forEach(row => {
      const type = row.querySelector('.g-type').value;
      const id = row.querySelector('.g-id').value;
      const role = row.querySelector('.g-role').value;
      if (!id || !rank[role]) return;
      const key = type + '\0' + id;
      const prev = best.get(key);
      if (!prev || rank[role] > rank[prev.role]) best.set(key, { type: type, id: id, role: role });
    });
    return Array.from(best.values());
  }

  function ensureCreatorManage(grants, user) {
    const next = grants.slice();
    const i = next.findIndex(g => g.type === 'user' && g.id === user.id);
    if (i >= 0) next[i] = { type: 'user', id: user.id, role: 'manage' };
    else next.unshift({ type: 'user', id: user.id, role: 'manage' });
    return next;
  }

  function bindGrantEditor(box) {
    box.addEventListener('click', e => {
      const rm = e.target.closest('.g-rm');
      if (rm) {
        const row = rm.closest('.kb-grant-row');
        if (row) row.remove();
        return;
      }
      if (e.target.closest('[data-add-grant]')) {
        box.querySelector('.kb-grant-list').insertAdjacentHTML('beforeend', grantRowHtml({ type: 'dept', role: 'read' }));
        ui.icons();
      }
    });
    box.addEventListener('change', e => {
      if (!e.target.classList.contains('g-type')) return;
      const row = e.target.closest('.kb-grant-row');
      row.querySelector('.g-id').innerHTML = peopleOptions(e.target.value, '');
    });
  }

  function clearQuery(el) {
    f.q = '';
    const qInput = el.querySelector('#kQ');
    if (qInput) qInput.value = '';
  }

  AOS.views.knowledge = function (el) {
    AOS.setCrumbs([{ name: '知识库' }]);
    const user = svc.currentUser();

    function canCreateLib() {
      return !!(AOS.org && svc.userHasPerm(AOS.org.PERMS.KB_CREATE));
    }
    function visibleLibs() {
      return L.visibleLibraries(store.state.libraries || [], user, P.levelRank);
    }
    function resolveLib() {
      if (!currentLibraryId) return null;
      const lib = visibleLibs().find(x => x.id === currentLibraryId);
      if (!lib) { currentLibraryId = null; currentFolderId = null; return null; }
      if (currentFolderId) {
        const cur = store.state.folders.find(x => x.id === currentFolderId);
        if (!cur || cur.libraryId !== lib.id) currentFolderId = null;
      }
      return lib;
    }

    function draw() {
      const lib = resolveLib();
      const folders = store.state.folders;
      const visible = store.state.docs.filter(d => P.canView(user, d, store.state.libraries));
      const searching = !!f.q;
      const canEdit = !!(lib && L.canEdit(lib, user));
      const canManage = !!(lib && L.canManage(lib, user));

      const lead = el.querySelector('#kLead');
      if (!lib) lead.textContent = '根目录只列出知识库。进入后管理文件夹与资料；资料密级和可见范围继承所属知识库。';
      else lead.textContent = (lib.description ? lib.description + '。' : '') + '密级' + P.levelLabel(lib.level) + '，你的权限：' + (ROLE_LABEL[L.effectiveRole(lib, user)] || '—') + '。';
      el.querySelector('#newLibBtn').hidden = !!lib || !canCreateLib();
      el.querySelector('#newFolderBtn').hidden = !lib || !canEdit;
      el.querySelector('#uploadBtn').hidden = !lib || !canEdit;
      el.querySelector('#kProc').hidden = !lib;
      el.querySelector('#kStatus').hidden = !lib;
      el.querySelector('#kLevel').hidden = !!lib;
      const qInput = el.querySelector('#kQ');
      if (qInput) qInput.placeholder = lib ? '搜索名称、课题、作者或图号' : '搜索知识库名称或描述';

      const tabs = el.querySelector('#kTabs');
      tabs.hidden = !lib;
      if (lib) {
        const inLibDocs = visible.filter(d => d.libraryId === lib.id);
        tabs.innerHTML = TABS.map(t => '<button class="' + (f.tab === t.id ? 'on' : '') + '" data-tab="' + t.id + '">' + t.name + '<span class="count">' + inLibDocs.filter(d => !t.types || t.types.includes(d.type)).length + '</span></button>').join('');
      }

      const allLibs = store.state.libraries || [];
      const libs = visibleLibs();
      const hiddenN = allLibs.length - libs.length;
      el.querySelector('#kHidden').innerHTML = (!lib && hiddenN)
        ? '<div class="note" style="margin-bottom:12px">' + icon('eye-off') + '<span>已按你的密级（' + P.levelLabel(user.clearance) + '级）和知识库授权隐藏 ' + hiddenN + ' 个知识库。</span></div>'
        : '';

      const path = lib ? F.pathFolders(folders, currentFolderId, lib.id) : [];
      const canGoUp = searching || !!lib;
      let trail = (!lib && !searching) ? '<strong>知识库</strong>' : '<a href="#/knowledge" data-nav="root">知识库</a>';
      if (lib) {
        const atLib = !currentFolderId && !searching;
        trail += '<span class="sep">/</span>' + (atLib
          ? '<strong>' + esc(lib.name) + '</strong>'
          : '<a href="#/knowledge" data-nav="lib" data-id="' + esc(lib.id) + '">' + esc(lib.name) + '</a>');
        path.forEach((p, i) => {
          const last = i === path.length - 1 && !searching;
          trail += '<span class="sep">/</span>' + (last
            ? '<strong>' + esc(p.name) + '</strong>'
            : '<a href="#/knowledge" data-nav="folder" data-id="' + esc(p.id) + '">' + esc(p.name) + '</a>');
        });
      }
      if (searching) trail += '<span class="sep">/</span><strong>搜索结果</strong>';
      el.querySelector('#kPath').innerHTML =
        (canGoUp
          ? '<button type="button" class="btn icon sm kb-path-back" id="kBack" title="返回上一级" aria-label="返回上一级">' + icon('arrow-left') + '</button>'
          : '') +
        '<div class="kb-path-trail">' + trail + '</div>';

      const body = [];
      if (!lib) {
        el.querySelector('#kHead').innerHTML = '<tr><th>名称</th><th>密级</th><th>你的权限</th><th>更新时间</th><th></th></tr>';
        libs.filter(matchLib).forEach(item => {
          const role = L.effectiveRole(item, user);
          const manage = L.canManage(item, user);
          const when = item.updatedAt || item.createdAt || '—';
          body.push(
            '<tr class="clickable library-row" data-lib-id="' + esc(item.id) + '">' +
            '<td><div class="folder-title"><span class="type-ico">' + icon('library') + '</span><div><div class="t">' + esc(item.name) + '</div>' +
            (item.description ? '<div class="small muted kb-lib-desc">' + esc(item.description) + '</div>' : '') + '</div></div></td>' +
            '<td class="nowrap">' + ui.lv(item.level) + '</td>' +
            '<td class="nowrap">' + esc(ROLE_LABEL[role] || '—') + '</td>' +
            '<td class="nowrap muted">' + esc(when) + '</td>' +
            '<td class="nowrap"><div class="kb-row-actions"><button type="button" class="btn sm" data-enter="' + esc(item.id) + '">进入</button>' +
            (manage
              ? '<details class="card-more"><summary class="card-more-btn" aria-label="更多操作">' + icon('ellipsis') + '</summary><div class="card-more-menu" role="menu">' +
                '<button type="button" role="menuitem" data-lib-settings="' + esc(item.id) + '">' + icon('pencil') + '设置</button>' +
                '<button type="button" role="menuitem" class="danger" data-lib-delete="' + esc(item.id) + '">' + icon('trash-2') + '删除</button>' +
                '</div></details>'
              : '') +
            '</div></td></tr>'
          );
        });
        el.querySelector('#kBody').innerHTML = body.length
          ? body.join('')
          : '<tr><td colspan="5"><div class="empty">' + icon('library') + (f.q || f.level ? '没有符合条件的知识库。' : (canCreateLib() ? '还没有你可以访问的知识库。可新建知识库。' : '还没有你可以访问的知识库。')) + '</div></td></tr>';
      } else {
        el.querySelector('#kHead').innerHTML = '<tr><th>资料</th><th>资料库</th><th>工序</th><th>年份</th><th>作者 / 部门</th><th>密级</th><th>可见范围</th><th>状态</th><th></th></tr>';
        let folderRows = [];
        let docRows = [];
        if (searching) {
          const allowed = new Set(F.descendantDocIds(folders, visible, currentFolderId, lib.id));
          docRows = visible.filter(d => allowed.has(d.id) && matchDoc(d));
        } else {
          folderRows = F.childrenOf(folders, currentFolderId, lib.id);
          docRows = F.docsIn(visible, currentFolderId, lib.id).filter(matchDoc);
        }
        if (!searching) {
          folderRows.forEach(folder => {
            const n = folderCount(folder.id, visible, lib.id);
            const menu = (canEdit ? '<button type="button" role="menuitem" data-rename="' + esc(folder.id) + '">' + icon('pencil') + '重命名</button>' : '') +
              (canManage ? '<button type="button" role="menuitem" class="danger" data-delfolder="' + esc(folder.id) + '">' + icon('trash-2') + '删除</button>' : '');
            body.push(
              '<tr class="clickable folder-row" data-folder-id="' + esc(folder.id) + '">' +
              '<td><div class="folder-title"><span class="type-ico">' + icon('folder') + '</span><div><div class="t">' + esc(folder.name) + '</div><div class="small muted">' + n + ' 项</div></div></div></td>' +
              '<td class="nowrap muted">文件夹</td><td></td><td></td><td></td><td></td><td></td><td></td>' +
              '<td class="nowrap">' + (menu
                ? '<details class="card-more"><summary class="card-more-btn" aria-label="更多操作">' + icon('ellipsis') + '</summary><div class="card-more-menu" role="menu">' + menu + '</div></details>'
                : '') + '</td></tr>'
            );
          });
        }
        docRows.forEach(d => {
          const pathHint = searching ? '<div class="small muted">' + esc(F.pathLabel(folders, d.folderId, lib.id)) + '</div>' : '';
          const docLib = L.byId(store.state.libraries, d.libraryId) || lib;
          const editDoc = L.canEdit(docLib, user);
          const manageDoc = L.canManage(docLib, user);
          body.push(
            '<tr class="clickable" data-id="' + esc(d.id) + '"><td><div class="doc-title">' + ui.typeIcon(d.type) + '<div><div class="t">' + esc(d.title) + '</div><div class="small muted">' + esc(AOS.engine.TYPE_LABEL[d.type]) + (d.cad && d.cad.drawingNo ? ' · 图号 ' + esc(d.cad.drawingNo) : '') + (d.code ? ' · ' + esc(d.code.lang) : '') + (d.pages ? ' · ' + d.pages + ' 页' : '') + '</div>' + pathHint + '</div></div></td>' +
            '<td class="nowrap">' + esc(d.library) + '</td><td>' + esc(d.process) + '</td><td>' + d.year + '</td><td class="nowrap">' + esc(d.author || '—') + '<div class="small muted">' + esc(d.dept) + '</div></td><td>' + ui.lv(d.level) + '</td><td class="nowrap small muted">继承知识库</td><td>' + statusCell(d) + '</td>' +
            '<td class="nowrap"><details class="card-more"><summary class="card-more-btn" aria-label="更多操作">' + icon('ellipsis') + '</summary>' +
            '<div class="card-more-menu" role="menu">' +
            (d.status === 'failed' && editDoc ? '<button type="button" role="menuitem" data-retry="' + esc(d.id) + '">' + icon('rotate-ccw') + '重试</button>' : '') +
            '<button type="button" role="menuitem" data-detail="' + esc(d.id) + '">' + icon('file-text') + '详情</button>' +
            (manageDoc ? '<button type="button" role="menuitem" class="danger" data-deldoc="' + esc(d.id) + '">' + icon('trash-2') + '删除</button>' : '') +
            '</div></details></td></tr>'
          );
        });
        el.querySelector('#kBody').innerHTML = body.length
          ? body.join('')
          : '<tr><td colspan="9"><div class="empty">' + icon('search-x') + (searching ? '没有符合条件的资料。' : (canEdit ? '当前文件夹为空。可新建文件夹或上传资料。' : '当前文件夹为空。')) + '</div></td></tr>';
      }
      el.querySelectorAll('#kBody .card-more').forEach(d => {
        d.addEventListener('toggle', () => {
          if (!d.open) { ui.pinCardMore(d); return; }
          el.querySelectorAll('#kBody .card-more[open]').forEach(o => {
            if (o === d) return;
            o.open = false;
            ui.pinCardMore(o);
          });
          ui.pinCardMore(d);
        });
      });
      ui.icons();
    }

    function goUp() {
      if (f.q) { clearQuery(el); draw(); return; }
      if (currentLibraryId && currentFolderId) {
        const cur = store.state.folders.find(x => x.id === currentFolderId);
        currentFolderId = F.normId(cur && cur.parentId);
        draw();
        return;
      }
      if (currentLibraryId) { currentLibraryId = null; currentFolderId = null; draw(); }
    }

    function enterLibrary(id) {
      currentLibraryId = id;
      currentFolderId = null;
      clearQuery(el);
      draw();
    }

    el.innerHTML = '<div class="page"><div class="page-head"><div><h1>知识库</h1><p id="kLead">根目录只列出知识库。进入后管理文件夹与资料；资料密级和可见范围继承所属知识库。</p></div>' +
      '<div class="row"><button class="btn" type="button" id="newLibBtn" hidden>' + icon('library') + '新建知识库</button><button class="btn" type="button" id="newFolderBtn" hidden>' + icon('folder-plus') + '新建文件夹</button><button class="btn primary" type="button" id="uploadBtn" hidden>' + icon('upload') + '上传资料</button></div></div>' +
      '<nav class="kb-path" id="kPath" aria-label="知识库路径"></nav>' +
      '<div class="tabs" id="kTabs" role="tablist" hidden></div><div id="kHidden"></div>' +
      '<div class="toolbar"><label class="search"><span class="sr-only">搜索</span>' + icon('search') + '<input class="input" id="kQ" placeholder="搜索知识库名称或描述" value="' + esc(f.q) + '"></label>' +
      '<select class="select" id="kProc" aria-label="工序" hidden><option value="">全部工序</option>' + PROCESSES.map(p => '<option' + (f.process === p ? ' selected' : '') + '>' + p + '</option>').join('') + '</select>' +
      '<select class="select" id="kLevel" aria-label="密级"><option value="">全部密级</option>' + P.LEVELS.map(l => '<option value="' + l.id + '"' + (f.level === l.id ? ' selected' : '') + '>' + l.label + '</option>').join('') + '</select>' +
      '<select class="select" id="kStatus" aria-label="状态" hidden><option value="">全部状态</option><option value="parsed">已解析</option><option value="parsing">解析中</option><option value="failed">解析失败</option></select></div>' +
      '<div class="panel table-wrap"><table class="tbl"><thead id="kHead"></thead><tbody id="kBody"></tbody></table></div></div>';

    el.querySelector('#kStatus').value = f.status;
    el.querySelector('#kTabs').addEventListener('click', e => { const b = e.target.closest('[data-tab]'); if (b) { f.tab = b.dataset.tab; draw(); } });
    el.querySelector('#kQ').addEventListener('input', e => { f.q = e.target.value.trim(); draw(); });
    el.querySelector('#kProc').addEventListener('change', e => { f.process = e.target.value; draw(); });
    el.querySelector('#kLevel').addEventListener('change', e => { f.level = e.target.value; draw(); });
    el.querySelector('#kStatus').addEventListener('change', e => { f.status = e.target.value; draw(); });
    el.querySelector('#kPath').addEventListener('click', e => {
      const back = e.target.closest('#kBack');
      if (back) { e.preventDefault(); if (!back.disabled) goUp(); return; }
      const a = e.target.closest('[data-nav]');
      if (!a) return;
      e.preventDefault();
      clearQuery(el);
      if (a.dataset.nav === 'root') { currentLibraryId = null; currentFolderId = null; }
      else if (a.dataset.nav === 'lib') { currentLibraryId = a.dataset.id || null; currentFolderId = null; }
      else if (a.dataset.nav === 'folder') currentFolderId = a.dataset.id || null;
      draw();
    });
    el.querySelector('#kBody').addEventListener('click', e => {
      const enter = e.target.closest('[data-enter]');
      if (enter) { e.preventDefault(); enterLibrary(enter.dataset.enter); return; }
      const settings = e.target.closest('[data-lib-settings]');
      if (settings) { e.preventDefault(); openLibrary(settings.dataset.libSettings); return; }
      const delLib = e.target.closest('[data-lib-delete]');
      if (delLib) { e.preventDefault(); deleteLibrary(delLib.dataset.libDelete); return; }
      const rename = e.target.closest('[data-rename]');
      if (rename) { e.preventDefault(); renameFolder(rename.dataset.rename); return; }
      const del = e.target.closest('[data-delfolder]');
      if (del) { e.preventDefault(); deleteFolder(del.dataset.delfolder); return; }
      const detail = e.target.closest('[data-detail]');
      if (detail) { e.preventDefault(); openEditor(detail.dataset.detail); return; }
      const deldoc = e.target.closest('[data-deldoc]');
      if (deldoc) { e.preventDefault(); deleteDoc(deldoc.dataset.deldoc); return; }
      const retry = e.target.closest('[data-retry]');
      if (retry) { e.preventDefault(); const d = store.state.docs.find(x => x.id === retry.dataset.retry); if (d) startParse(d, false); return; }
      if (e.target.closest('.card-more')) return;
      const lr = e.target.closest('tr[data-lib-id]');
      if (lr) { enterLibrary(lr.dataset.libId); return; }
      const fr = e.target.closest('tr[data-folder-id]');
      if (fr) { currentFolderId = fr.dataset.folderId; clearQuery(el); draw(); return; }
      const tr = e.target.closest('tr[data-id]');
      if (tr) openEditor(tr.dataset.id);
    });
    el.querySelector('#uploadBtn').addEventListener('click', upload);
    el.querySelector('#newFolderBtn').addEventListener('click', createFolder);
    el.querySelector('#newLibBtn').addEventListener('click', () => openLibrary(null));

    function levelOptions(selected) {
      const list = P.LEVELS.filter(l => P.levelRank(l.id) <= P.levelRank(user.clearance) || l.id === selected);
      const sel = selected && list.some(l => l.id === selected) ? selected : (list.some(l => l.id === 'internal') ? 'internal' : (list[0] ? list[0].id : 'public'));
      return list.map(l => '<option value="' + l.id + '"' + (l.id === sel ? ' selected' : '') + '>' + l.label + '</option>').join('');
    }

    function openLibrary(id) {
      const existing = id ? L.byId(store.state.libraries, id) : null;
      if (existing) { if (!L.canManage(existing, user)) return; }
      else if (!canCreateLib()) return;
      const grants = existing && existing.grants && existing.grants.length ? existing.grants : [{ type: 'user', id: user.id, role: 'manage' }];
      ui.modal({
        title: existing ? '知识库设置' : '新建知识库', okText: existing ? '保存' : '创建', size: 'lg',
        body: '<div class="stack" id="libForm"><div class="field"><label for="libName">名称</label><input class="input" id="libName" value="' + esc(existing ? existing.name : '') + '" placeholder="知识库名称" autofocus></div>' +
          '<div class="grid-2"><div class="field"><label for="libLevel">密级</label><select class="select" id="libLevel">' + levelOptions(existing && existing.level) + '</select><span class="hint">不能高于你本人的密级。库内资料一律继承。</span></div>' +
          '<div class="field"><label for="libDesc">描述</label><input class="input" id="libDesc" value="' + esc(existing && existing.description || '') + '" placeholder="可选"></div></div>' +
          '<div class="field"><span class="field-label">成员权限</span><div class="kb-grant-list">' + grants.map(grantRowHtml).join('') + '</div>' +
          '<button type="button" class="btn sm" data-add-grant>' + icon('plus') + '添加授权</button>' +
          '<span class="hint">' + (existing ? '部门或用户可授予阅读、编辑或管理。同一对象保留较高权限。' : '部门或用户可授予阅读、编辑或管理。创建者自动获得管理权限。') + '</span></div>' +
          '<span class="err" id="libErr" hidden></span></div>',
        onMount(m, close) {
          const form = m.querySelector('#libForm');
          bindGrantEditor(form);
          const nameInput = m.querySelector('#libName');
          nameInput.focus();
          if (existing) nameInput.select();
          m.querySelector('[data-ok]').addEventListener('click', () => {
            const name = nameInput.value.trim();
            const err = m.querySelector('#libErr');
            const show = msg => { err.hidden = false; err.textContent = msg; };
            if (!name) { show('请输入名称'); return; }
            const taken = (store.state.libraries || []).some(x => x !== existing && x.name && x.name.trim() === name);
            if (taken) { show('已有同名知识库'); return; }
            const level = m.querySelector('#libLevel').value;
            if (!level || P.levelRank(level) > P.levelRank(user.clearance)) { show('请选择不超过你本人密级的密级'); return; }
            let grantsOut = readGrants(form);
            if (!existing) grantsOut = ensureCreatorManage(grantsOut, user);
            if (!grantsOut.length) { show('请至少添加一条成员权限'); return; }
            if (!grantsOut.some(g => g && g.role === 'manage')) { show('请至少保留一条管理权限'); return; }
            const desc = m.querySelector('#libDesc').value.trim();
            const now = svc.now();
            if (!Array.isArray(store.state.libraries)) store.state.libraries = [];
            if (existing) {
              existing.name = name;
              existing.level = level;
              existing.description = desc;
              existing.grants = grantsOut;
              existing.updatedAt = now;
              store.state.docs.forEach(d => { if (d && d.libraryId === existing.id) L.syncDocFromLibrary(d, existing); });
            } else {
              store.state.libraries.unshift({
                id: store.uid('lib'), name: name, level: level, description: desc, grants: grantsOut,
                createdBy: user.id, createdAt: now, updatedAt: now
              });
            }
            store.save();
            close();
            draw();
            ui.toast(existing ? '已保存知识库设置' : '已创建知识库');
          });
        }
      });
    }

    function deleteLibrary(id) {
      const lib = L.byId(store.state.libraries, id);
      if (!lib || !L.canManage(lib, user)) return;
      if (!L.isLibraryEmpty(id, store.state.folders, store.state.docs)) {
        ui.toast('知识库非空，无法删除', 'warn');
        return;
      }
      ui.modal({
        title: '删除知识库', okText: '确认删除',
        body: '<p>将删除空知识库「' + esc(lib.name) + '」。</p>',
        onMount(m, close) {
          m.querySelector('[data-ok]').addEventListener('click', () => {
            store.state.libraries = (store.state.libraries || []).filter(x => x.id !== id);
            if (currentLibraryId === id) { currentLibraryId = null; currentFolderId = null; }
            store.save();
            close();
            draw();
            ui.toast('已删除知识库');
          });
        }
      });
    }

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

    function createFolder() {
      const lib = resolveLib();
      if (!lib || !L.canEdit(lib, user)) return;
      ui.modal({
        title: '新建文件夹', okText: '创建',
        body: '<div class="stack"><div class="field"><label for="nfName">名称</label><input class="input" id="nfName" placeholder="文件夹名称" autofocus><span class="err" id="nfErr" hidden></span></div>' +
          '<div class="muted small">将创建在：' + esc(lib.name + ' / ' + F.pathLabel(store.state.folders, currentFolderId, lib.id)) + '</div></div>',
        onMount(m, close) {
          const input = m.querySelector('#nfName');
          input.focus();
          m.querySelector('[data-ok]').addEventListener('click', () => {
            const name = input.value.trim();
            const err = m.querySelector('#nfErr');
            if (!name) { err.hidden = false; err.textContent = '请输入名称'; return; }
            if (F.siblingNameTaken(store.state.folders, currentFolderId, name, null, lib.id)) { err.hidden = false; err.textContent = '同级已有同名文件夹'; return; }
            store.state.folders.push({ id: store.uid('f'), name: name, parentId: currentFolderId, libraryId: lib.id });
            store.save(); close(); draw(); ui.toast('已创建文件夹');
          });
        }
      });
    }

    function renameFolder(id) {
      const folder = store.state.folders.find(x => x.id === id);
      const lib = folder && L.byId(store.state.libraries, folder.libraryId);
      if (!folder || !lib || !L.canEdit(lib, user)) return;
      ui.modal({
        title: '重命名文件夹', okText: '保存',
        body: '<div class="field"><label for="rfName">名称</label><input class="input" id="rfName" value="' + esc(folder.name) + '"><span class="err" id="rfErr" hidden></span></div>',
        onMount(m, close) {
          const input = m.querySelector('#rfName');
          input.focus(); input.select();
          m.querySelector('[data-ok]').addEventListener('click', () => {
            const name = input.value.trim();
            const err = m.querySelector('#rfErr');
            if (!name) { err.hidden = false; err.textContent = '请输入名称'; return; }
            if (F.siblingNameTaken(store.state.folders, folder.parentId, name, folder.id, folder.libraryId)) { err.hidden = false; err.textContent = '同级已有同名文件夹'; return; }
            folder.name = name;
            store.save(); close(); draw(); ui.toast('已重命名');
          });
        }
      });
    }

    function deleteFolder(id) {
      const folder = store.state.folders.find(x => x.id === id);
      const lib = folder && L.byId(store.state.libraries, folder.libraryId);
      if (!folder || !lib || !L.canManage(lib, user)) return;
      if (!F.isEmpty(store.state.folders, store.state.docs, id, folder.libraryId)) {
        ui.toast('文件夹非空，无法删除', 'warn');
        return;
      }
      store.state.folders = store.state.folders.filter(x => x.id !== id);
      if (currentFolderId === id) currentFolderId = F.normId(folder.parentId);
      store.save(); draw(); ui.toast('已删除文件夹');
    }

    function deleteDoc(id) {
      const d = store.state.docs.find(x => x.id === id);
      const lib = d && L.byId(store.state.libraries, d.libraryId);
      if (!d || !lib || !L.canManage(lib, user)) return;
      ui.modal({
        title: '删除资料',
        okText: '确认删除',
        body: '<p>将永久删除“' + esc(d.title) + '”。删除后智能体将无法再检索到该资料。</p>',
        onMount(m, close) {
          m.querySelector('[data-ok]').addEventListener('click', () => {
            store.state.docs = store.state.docs.filter(x => x.id !== id);
            active.delete(id);
            store.save();
            close();
            draw();
            ui.toast('已删除“' + d.title + '”');
          });
        }
      });
    }

    function upload() {
      const lib = resolveLib();
      if (!lib || !L.canEdit(lib, user)) return;
      ui.modal({
        title: '上传资料', okText: '上传并解析',
        body: '<div class="stack"><div class="field"><label for="upFiles">选择文件</label><input class="input" type="file" id="upFiles" multiple accept=".pdf,.doc,.docx,.dwg,.dxf" style="padding:5px"><span class="hint">支持 PDF、Word、DWG、DXF。代码仓库和数据库通过管理员接入，不在此上传。</span></div>' +
          '<div class="field"><label for="upFolder">文件夹</label><select class="select" id="upFolder">' + folderOptionsHtml(currentFolderId, lib.id) + '</select></div>' +
          '<div class="grid-2"><div class="field"><label for="upLib">资料库</label><select class="select" id="upLib">' + libraryMetaOptions(lib.name) + '</select></div><div class="field"><label for="upProc">工序</label><select class="select" id="upProc">' + PROCESSES.map(p => '<option>' + p + '</option>').join('') + '</select></div></div>' +
          '<div class="field"><label for="upTopic">课题</label><input class="input" id="upTopic" placeholder="可选"></div>' +
          '<span class="err" id="upErr" hidden>请选择至少一个文件</span><div class="note">' + icon('info') + '<span>密级与可见范围继承当前知识库（' + esc(P.levelLabel(lib.level)) + '）。演示环境不会读取文件内容，只模拟解析过程。文件名包含“扫描件”或“损坏”时会模拟一次解析失败。</span></div></div>',
        onMount(m, close) {
          m.querySelector('[data-ok]').addEventListener('click', () => {
            const files = Array.from(m.querySelector('#upFiles').files || []);
            if (!files.length) { m.querySelector('#upErr').hidden = false; return; }
            const folderId = F.normId(m.querySelector('#upFolder').value);
            files.forEach(file => {
              const ext = file.name.split('.').pop().toLowerCase();
              const type = ext === 'pdf' ? 'pdf' : ext === 'dwg' || ext === 'dxf' ? 'cad' : 'word';
              const title = file.name.replace(/\.[^.]+$/, '');
              const recognized = type === 'cad' && !/草图|未命名/.test(title);
              const d = {
                id: store.uid('u'), type: type, title: title, folderId: folderId, libraryId: lib.id, library: m.querySelector('#upLib').value, process: m.querySelector('#upProc').value, topic: m.querySelector('#upTopic').value.trim() || '未分类', year: new Date().getFullYear(),
                author: user.name, dept: user.dept, level: lib.level, acl: [], pages: type === 'cad' ? undefined : Math.max(1, Math.round(file.size / 40000)),
                keywords: title.split(/[\s_\-（）()]+/).filter(w => w.length >= 2), summary: type === 'cad' ? ext.toUpperCase() + ' · 新上传' : '新上传资料，摘要将在解析后生成', snippets: [], status: 'parsing', updatedAt: svc.now().slice(0, 10),
                cad: type === 'cad' ? { format: ext.toUpperCase(), drawingNo: recognized ? 'NEW-' + String(Date.now()).slice(-4) : '', version: recognized ? 'A' : '', designer: recognized ? user.name : '', date: recognized ? svc.now().slice(0, 7) : '', titleBlock: recognized ? 'auto' : 'missing' } : undefined
              };
              L.syncDocFromLibrary(d, lib);
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
      if (!d || !P.canView(user, d, store.state.libraries)) return;
      const docLib = L.byId(store.state.libraries, d.libraryId) || resolveLib();
      const canEdit = !!(docLib && L.canEdit(docLib, user));
      const tb = d.cad ? TITLE_BLOCK[d.cad.titleBlock] : null;
      const libChoices = LIBS.indexOf(d.library) >= 0 ? LIBS : LIBS.concat([d.library]);
      const body = '<div class="stack">' +
        (d.type === 'cad' ? ui.cadThumb(d, 520, 300) + '<div class="row"><span class="field-label">标题栏</span><span class="badge ' + tb[1] + '">' + tb[0] + '</span><span class="muted small">只管理文件与标题栏信息，不解读图纸内容</span></div>' +
          '<div class="grid-2">' + [['drawingNo', '图号'], ['version', '版本'], ['designer', '设计人'], ['date', '日期']].map(([k, l]) => '<div class="field"><label for="cad-' + k + '">' + l + '</label><input class="input" id="cad-' + k + '" data-cad="' + k + '" value="' + esc(d.cad[k]) + '"' + (canEdit ? '' : ' disabled') + '></div>').join('') + '</div>' : '') +
        '<div class="grid-2"><div class="field"><label for="eTitle">名称</label><input class="input" id="eTitle" value="' + esc(d.title) + '"' + (canEdit ? '' : ' disabled') + '></div><div class="field"><label for="eLib">资料库</label><select class="select" id="eLib"' + (canEdit ? '' : ' disabled') + '>' + libChoices.map(l => '<option' + (l === d.library ? ' selected' : '') + '>' + esc(l) + '</option>').join('') + '</select></div></div>' +
        '<div class="field"><label for="eFolder">文件夹</label><select class="select" id="eFolder"' + (canEdit ? '' : ' disabled') + '>' + folderOptionsHtml(d.folderId, docLib && docLib.id) + '</select></div>' +
        '<div class="grid-2"><div class="field"><label for="eProc">工序</label><select class="select" id="eProc"' + (canEdit ? '' : ' disabled') + '>' + PROCESSES.map(p => '<option' + (p === d.process ? ' selected' : '') + '>' + p + '</option>').join('') + '</select></div><div class="field"><label for="eTopic">课题</label><input class="input" id="eTopic" value="' + esc(d.topic) + '"' + (canEdit ? '' : ' disabled') + '></div></div>' +
        '<div class="note">' + icon(canEdit ? 'info' : 'lock') + '<span>' + (canEdit ? '密级与可见范围继承所属知识库，保存时自动同步。' : '你对这个知识库没有编辑权限，不能修改资料。') + '</span></div>' +
        '<hr style="border:0;border-top:1px solid var(--line-soft);margin:4px 0">' + ui.docDetailHtml(d) + '</div>';
      ui.drawer({
        title: d.title, body: body, foot: canEdit ? '<button class="btn" data-close>取消</button><button class="btn primary" id="eSave">保存</button>' : '<button class="btn" data-close>关闭</button>',
        onMount(dr, close) {
          const save = dr.querySelector('#eSave');
          if (!save) return;
          save.addEventListener('click', () => {
            d.title = dr.querySelector('#eTitle').value.trim() || d.title;
            d.library = dr.querySelector('#eLib').value;
            d.process = dr.querySelector('#eProc').value;
            d.topic = dr.querySelector('#eTopic').value.trim();
            d.folderId = F.normId(dr.querySelector('#eFolder').value);
            if (docLib) L.syncDocFromLibrary(d, docLib);
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
