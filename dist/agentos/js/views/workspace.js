/* AgentOS · 智能体右侧工作台：工作区 + 知识库 */
(function (root) {
  const AOS = root.AOS;
  const { ui, svc, store, policy: P } = AOS;
  const { esc, icon } = ui;
  const W = AOS.workspace;
  const L = AOS.libraries;
  const F = AOS.folders;

  function mountAgentWorkspace(host, opts) {
    opts = opts || {};
    const user = svc.currentUser();
    let menu = 'workspace'; // workspace | knowledge（固定菜单）
    let active = 'menu'; // menu | docTabKey
    let docTabs = []; // { key, kind, id, title }
    let folderId = '';
    let selectedId = '';
    const openFolders = new Set(['asf-upload', 'asf-trial']);
    let kbLibId = '';
    let kbFolderId = '';
    const openKbFolders = new Set();
    let fullscreen = !!opts.fullscreen;

    function ws() { return W.ensureShape(store.state); }
    function materials() { return W.forUser(ws().materials, user.id, false); }
    function deliverables() { return W.forUser(ws().deliverables, user.id, false); }
    function visibleLibs() {
      if (!L || !L.visibleLibraries) return store.state.libraries || [];
      return L.visibleLibraries(store.state.libraries || [], user, P.levelRank);
    }
    function visibleDocs() {
      return (store.state.docs || []).filter(d => P.canView(user, d, store.state.libraries));
    }

    function folderCount(id) {
      return W.materialsIn(materials(), id).length;
    }

    function workspaceBodyHtml() {
      const folders = ws().materialFolders;
      const mats = materials();
      const dels = deliverables();

      const folderRows = W.childrenOf(folders, null).map(f => {
        const open = openFolders.has(f.id);
        const n = folderCount(f.id);
        const files = W.materialsIn(mats, f.id);
        const twist = '<button type="button" class="as-twist' + (open ? ' open' : '') + '" data-as-twist="' + esc(f.id) + '" aria-expanded="' + (open ? 'true' : 'false') + '" aria-label="' + (open ? '收起' : '展开') + '">' + icon('chevron-right', 'chev') + '</button>';
        const citeFolder = opts.onCite
          ? '<button type="button" class="btn ghost sm icon as-cite" data-as-cite-folder="' + esc(f.id) + '" aria-label="引用到对话" title="引用到对话">' + icon('quote') + '</button>'
          : '';
        let html = '<div class="as-row' + (folderId === f.id ? ' on' : '') + '">' + twist +
          '<button type="button" class="as-pick" data-as-folder="' + esc(f.id) + '">' +
          icon('folder') + '<span class="grow">' + esc(f.name) + '</span><span class="muted">' + n + '</span></button>' +
          citeFolder +
          '<button type="button" class="btn ghost sm icon as-more" data-as-folder-more="' + esc(f.id) + '" aria-label="更多">' + icon('ellipsis') + '</button></div>';
        if (open) {
          html += files.length
            ? files.map(m => {
              const citeMat = opts.onCite
                ? '<button type="button" class="btn ghost sm icon as-cite" data-as-cite-mat="' + esc(m.id) + '" aria-label="引用到对话" title="引用到对话">' + icon('quote') + '</button>'
                : '';
              return '<div class="as-row nested' + (selectedId === m.id ? ' on' : '') + '"><span class="as-twist-gap"></span>' +
                '<button type="button" class="as-pick as-file" data-as-mat="' + esc(m.id) + '">' +
                icon(W.typeIcon(m.type)) + '<span class="grow"><span class="as-name">' + esc(m.name) + '</span>' +
                '<span class="muted small">' + esc(m.date) + '</span></span></button>' +
                citeMat +
                '<button type="button" class="btn ghost sm icon as-more" data-as-mat-more="' + esc(m.id) + '" aria-label="更多">' + icon('ellipsis') + '</button></div>';
            }).join('')
            : '<div class="as-empty nested muted small">暂无文件</div>';
        }
        return html;
      }).join('');

      const delRows = dels.slice().sort((a, b) => (a.date < b.date ? 1 : -1)).map(d => {
        const on = selectedId === d.id;
        const citeDel = opts.onCite
          ? '<button type="button" class="btn ghost sm icon as-cite" data-as-cite-del="' + esc(d.id) + '" aria-label="引用到对话" title="引用到对话">' + icon('quote') + '</button>'
          : '';
        return '<div class="as-row' + (on ? ' on' : '') + '">' +
          '<button type="button" class="as-pick as-file" data-as-del="' + esc(d.id) + '">' +
          icon(W.typeIcon(d.type)) + '<span class="grow"><span class="as-name">' + esc(d.name) + '</span>' +
          '<span class="muted small">' + esc(d.date) + '</span></span></button>' +
          citeDel +
          '<button type="button" class="btn ghost sm icon as-more" data-as-del-more="' + esc(d.id) + '" aria-label="更多">' + icon('ellipsis') + '</button></div>';
      }).join('');

      return '<div class="as-sec"><div class="as-sec-head"><span>素材 <span class="muted">' + mats.length + '</span></span>' +
        '<span class="as-sec-actions"><button type="button" class="btn ghost sm icon" data-as-upload title="上传素材" aria-label="上传素材">' + icon('upload') + '</button>' +
        '<button type="button" class="btn ghost sm icon" data-as-new-folder title="新建文件夹" aria-label="新建文件夹">' + icon('circle-plus') + '</button></span></div>' +
        '<div class="as-sec-body">' + (folderRows || '<div class="muted small" style="padding:8px 12px">暂无文件夹</div>') + '</div></div>' +
        '<div class="as-sec"><div class="as-sec-head"><span>交付物 <span class="muted">' + dels.length + '</span></span>' +
        '<span class="as-sec-actions"><button type="button" class="btn ghost sm icon" data-as-new-del title="登记成果" aria-label="登记成果">' + icon('circle-plus') + '</button></span></div>' +
        '<div class="as-sec-body">' + (delRows || '<div class="muted small" style="padding:8px 12px">暂无交付物</div>') + '</div></div>';
    }

    function knowledgeBodyHtml() {
      const libs = visibleLibs();
      const folders = store.state.folders || [];
      const docs = visibleDocs();
      if (!kbLibId) {
        if (!libs.length) {
          return '<div class="muted small" style="padding:14px 12px">当前账号暂无可见知识库。</div>';
        }
        return '<div class="as-sec"><div class="as-sec-head"><span>知识库 <span class="muted">' + libs.length + '</span></span></div>' +
          '<div class="as-sec-body">' + libs.map(lib => {
            const cite = opts.onCite
              ? '<button type="button" class="btn ghost sm icon as-cite" data-kb-cite-lib="' + esc(lib.id) + '" aria-label="引用到对话" title="引用到对话">' + icon('quote') + '</button>'
              : '';
            return '<div class="as-row">' +
              '<button type="button" class="as-pick" data-kb-enter="' + esc(lib.id) + '">' +
              icon('library') + '<span class="grow"><span class="as-name">' + esc(lib.name) + '</span>' +
              '<span class="muted small">' + esc(P.levelLabel(lib.level)) + '</span></span></button>' +
              cite + '</div>';
          }).join('') + '</div></div>';
      }

      const lib = libs.find(x => x.id === kbLibId) || (store.state.libraries || []).find(x => x.id === kbLibId);
      if (!lib) {
        kbLibId = '';
        kbFolderId = '';
        return knowledgeBodyHtml();
      }
      if (kbFolderId) {
        const cur = folders.find(f => f.id === kbFolderId);
        if (!cur || cur.libraryId !== lib.id) kbFolderId = '';
      }
      const childFolders = F.childrenOf(folders, kbFolderId || null, lib.id);
      const childDocs = F.docsIn(docs, kbFolderId || null, lib.id);
      const path = F.pathFolders(folders, kbFolderId, lib.id);
      const trail = '<button type="button" class="as-crumb" data-kb-root>' + esc(lib.name) + '</button>' +
        path.map((p, i) => {
          const last = i === path.length - 1;
          return '<span class="as-crumb-sep">/</span>' + (last
            ? '<strong>' + esc(p.name) + '</strong>'
            : '<button type="button" class="as-crumb" data-kb-folder="' + esc(p.id) + '">' + esc(p.name) + '</button>');
        }).join('');

      const folderRows = childFolders.map(f => {
        const open = openKbFolders.has(f.id);
        const subFolders = F.childrenOf(folders, f.id, lib.id);
        const subDocs = F.docsIn(docs, f.id, lib.id);
        const n = subFolders.length + subDocs.length;
        const cite = opts.onCite
          ? '<button type="button" class="btn ghost sm icon as-cite" data-kb-cite-folder="' + esc(f.id) + '" aria-label="引用到对话" title="引用到对话">' + icon('quote') + '</button>'
          : '';
        const twist = (subFolders.length || subDocs.length)
          ? '<button type="button" class="as-twist' + (open ? ' open' : '') + '" data-kb-twist="' + esc(f.id) + '">' + icon('chevron-right', 'chev') + '</button>'
          : '<span class="as-twist-gap"></span>';
        let html = '<div class="as-row">' + twist +
          '<button type="button" class="as-pick" data-kb-folder="' + esc(f.id) + '">' +
          icon('folder') + '<span class="grow">' + esc(f.name) + '</span><span class="muted">' + n + '</span></button>' +
          cite + '</div>';
        if (open) {
          html += subDocs.slice(0, 8).map(d => {
            const citeDoc = opts.onCite
              ? '<button type="button" class="btn ghost sm icon as-cite" data-kb-cite-doc="' + esc(d.id) + '" aria-label="引用到对话" title="引用到对话">' + icon('quote') + '</button>'
              : '';
            return '<div class="as-row nested"><span class="as-twist-gap"></span>' +
              '<button type="button" class="as-pick as-file" data-kb-doc="' + esc(d.id) + '">' +
              icon('file-text') + '<span class="grow"><span class="as-name">' + esc(d.title) + '</span>' +
              '<span class="muted small">' + esc(d.year || '') + '</span></span></button>' + citeDoc + '</div>';
          }).join('');
          if (subDocs.length > 8) html += '<div class="as-empty nested muted small">另有 ' + (subDocs.length - 8) + ' 份资料，进入文件夹查看</div>';
          if (!subDocs.length && !subFolders.length) html += '<div class="as-empty nested muted small">空文件夹</div>';
        }
        return html;
      }).join('');

      const docRows = childDocs.map(d => {
        const cite = opts.onCite
          ? '<button type="button" class="btn ghost sm icon as-cite" data-kb-cite-doc="' + esc(d.id) + '" aria-label="引用到对话" title="引用到对话">' + icon('quote') + '</button>'
          : '';
        return '<div class="as-row">' +
          '<button type="button" class="as-pick as-file" data-kb-doc="' + esc(d.id) + '">' +
          icon('file-text') + '<span class="grow"><span class="as-name">' + esc(d.title) + '</span>' +
          '<span class="muted small">' + esc(d.process || '') + (d.year ? ' · ' + d.year : '') + '</span></span></button>' +
          cite + '</div>';
      }).join('');

      const citeLib = opts.onCite
        ? '<button type="button" class="btn ghost sm icon" data-kb-cite-lib="' + esc(lib.id) + '" title="引用本库">' + icon('quote') + '</button>'
        : '';

      return '<div class="as-kb-nav"><button type="button" class="btn ghost sm icon" data-kb-back aria-label="返回">' + icon('arrow-left') + '</button>' +
        '<div class="as-kb-trail grow">' + trail + '</div>' + citeLib + '</div>' +
        '<div class="as-sec-body" style="padding-top:4px">' +
        (folderRows || '') + (docRows || '') +
        ((!folderRows && !docRows) ? '<div class="muted small" style="padding:10px 12px">此目录暂无内容</div>' : '') +
        '</div>';
    }

    function openFileTab(item) {
      if (!item || !item.id) return;
      const key = (item.kind || 'doc') + ':' + item.id;
      if (!docTabs.some(t => t.key === key)) {
        docTabs.push({
          key,
          kind: item.kind || 'doc',
          id: item.id,
          title: item.title || item.name || '未命名'
        });
      }
      active = key;
      draw();
    }

    function closeFileTab(key) {
      const i = docTabs.findIndex(t => t.key === key);
      if (i < 0) return;
      docTabs.splice(i, 1);
      if (active === key) {
        active = docTabs[i] ? docTabs[i].key : (docTabs[i - 1] ? docTabs[i - 1].key : 'menu');
      }
      draw();
    }

    function gotoMenu(next) {
      menu = next === 'knowledge' ? 'knowledge' : 'workspace';
      active = 'menu';
      draw();
    }

    function stripHtml() {
      const menuTabs =
        '<button type="button" class="aws-nav-tab' + (active === 'menu' && menu === 'workspace' ? ' on' : '') + '" data-aws-goto="workspace">' +
        icon('folder-open') + '工作区</button>' +
        '<button type="button" class="aws-nav-tab' + (active === 'menu' && menu === 'knowledge' ? ' on' : '') + '" data-aws-goto="knowledge">' +
        icon('library') + '知识库</button>';
      const pills = docTabs.map(t => {
        const on = active === t.key;
        return '<button type="button" class="aws-doc-tab' + (on ? ' on' : '') + '" data-aws-tab="' + esc(t.key) + '" title="' + esc(t.title) + '">' +
          icon('file-text') +
          '<span class="aws-doc-tab-name">' + esc(t.title) + '</span>' +
          '<span class="aws-doc-tab-x" data-aws-close="' + esc(t.key) + '" role="button" aria-label="关闭" title="关闭">' + icon('x') + '</span>' +
          '</button>';
      }).join('');
      return '<div class="aws-strip">' +
        '<div class="aws-nav-tabs">' + menuTabs + '</div>' +
        (pills ? '<div class="aws-strip-sep" aria-hidden="true"></div>' : '') +
        '<div class="aws-doc-tabs">' + pills + '</div></div>';
    }

    function fileTabBodyHtml() {
      const t = docTabs.find(x => x.key === active);
      if (!t) return '<div class="muted small" style="padding:14px 12px">页签不存在</div>';
      if (t.kind === 'doc') {
        const doc = visibleDocs().find(d => d.id === t.id) || (store.state.docs || []).find(d => d.id === t.id);
        if (!doc) return '<div class="muted small" style="padding:14px 12px">资料不存在或已删除</div>';
        if (!P.canView(user, doc, store.state.libraries)) {
          return '<div class="muted small" style="padding:14px 12px">你没有权限查看这份资料</div>';
        }
        return '<div class="aws-doc-view"><div class="aws-doc-title">' + esc(doc.title) + '</div>' +
          ui.docFullContentHtml(doc) + '</div>';
      }
      if (t.kind === 'material') {
        const m = materials().find(x => x.id === t.id) || (ws().materials || []).find(x => x.id === t.id);
        if (!m) return '<div class="muted small" style="padding:14px 12px">素材不存在或已删除</div>';
        return '<div class="aws-doc-view"><div class="aws-doc-title">' + esc(m.name) + '</div>' +
          '<div class="aws-doc-meta"><div class="muted small">' + esc(m.agentName || '—') + ' · ' + esc(m.date || '') +
          (m.size ? ' · ' + esc(m.size) : '') + '</div></div>' +
          '<div class="aws-doc-article"><h3>文件内容</h3>' +
          '<p>本文件为对话过程中上传的素材「' + esc(m.name) + '」。演示环境按文本预览展示，不解析真实二进制内容。</p>' +
          '<p>来源智能体：' + esc(m.agentName || '—') + '。可用于引用到左侧对话，辅助当前问题分析。</p>' +
          '<pre class="aws-doc-pre"><code># ' + esc(m.name) + '\n\n上传日期：' + esc(m.date || '—') +
          '\n文件类型：' + esc((m.type || '').toUpperCase() || '—') +
          '\n\n（演示全文预览）\n此处展示素材的可读文本内容。正式环境将按文件类型渲染 PDF / Office / 图片等原文。</code></pre>' +
          '</div><div class="aws-doc-actions"><button type="button" class="btn sm" data-aws-rm-mat="' + esc(m.id) + '">删除素材</button></div></div>';
      }
      if (t.kind === 'deliverable') {
        const d = deliverables().find(x => x.id === t.id) || (ws().deliverables || []).find(x => x.id === t.id);
        if (!d) return '<div class="muted small" style="padding:14px 12px">交付物不存在或已删除</div>';
        return '<div class="aws-doc-view"><div class="aws-doc-title">' + esc(d.name) + '</div>' +
          '<div class="aws-doc-meta"><div class="muted small">' + esc(d.agentName || '—') + ' · ' + esc(d.date || '') +
          ' · ' + esc((d.type || '').toUpperCase() || '—') + '</div></div>' +
          '<div class="aws-doc-article"><h3>正文</h3>' +
          '<p>' + esc(d.summary || '（无摘要）') + '</p>' +
          '<h3>详细内容</h3>' +
          '<p>本交付物由「' + esc(d.agentName || '当前对话') + '」生成并登记。以下为演示全文：</p>' +
          '<pre class="aws-doc-pre"><code># ' + esc(d.name) + '\n\n' + esc(d.summary || d.name) +
          '\n\n## 说明\n正式环境将展示交付物完整正文、图表与附件列表。</code></pre>' +
          '</div><div class="aws-doc-actions">' +
          '<button type="button" class="btn sm" data-aws-dl-del="' + esc(d.id) + '">下载</button>' +
          '<button type="button" class="btn sm" data-aws-rm-del="' + esc(d.id) + '">删除</button></div></div>';
      }
      return '<div class="muted small" style="padding:14px 12px">无法预览</div>';
    }

    function bodyHtml() {
      if (active !== 'menu') return fileTabBodyHtml();
      return menu === 'knowledge' ? knowledgeBodyHtml() : workspaceBodyHtml();
    }

    function draw() {
      const headActions =
        (opts.onToggleFullscreen
          ? '<button type="button" class="btn ghost sm icon" data-as-fullscreen aria-label="' +
            (fullscreen ? '退出全屏' : '全屏工作台') + '" title="' + (fullscreen ? '退出全屏' : '全屏工作台') + '">' +
            icon(fullscreen ? 'minimize-2' : 'maximize-2') + '</button>'
          : '') +
        (opts.onCollapse
          ? '<button type="button" class="btn ghost sm icon" data-as-collapse aria-label="收起工作台" title="收起工作台">' + icon('panel-right-close') + '</button>'
          : '');
      host.innerHTML = '<div class="agent-ws-inner">' +
        '<div class="agent-ws-head"><div class="grow"><strong>智能体工作台</strong></div>' +
        (headActions ? '<div class="agent-ws-actions">' + headActions + '</div>' : '') +
        '</div>' +
        stripHtml() +
        '<div class="agent-ws-body">' + bodyHtml() + '</div></div>';

      bind();
      ui.icons();
    }

    function bind() {
      const fsBtn = host.querySelector('[data-as-fullscreen]');
      if (fsBtn && opts.onToggleFullscreen) {
        fsBtn.addEventListener('click', e => {
          e.stopPropagation();
          opts.onToggleFullscreen();
        });
      }
      const collapseBtn = host.querySelector('[data-as-collapse]');
      if (collapseBtn && opts.onCollapse) {
        collapseBtn.addEventListener('click', e => {
          e.stopPropagation();
          opts.onCollapse();
        });
      }
      host.querySelectorAll('[data-aws-goto]').forEach(b => b.addEventListener('click', () => {
        gotoMenu(b.dataset.awsGoto);
      }));
      host.querySelectorAll('[data-aws-tab]').forEach(b => b.addEventListener('click', e => {
        if (e.target.closest('[data-aws-close]')) return;
        active = b.dataset.awsTab;
        draw();
      }));
      host.querySelectorAll('[data-aws-close]').forEach(b => b.addEventListener('click', e => {
        e.stopPropagation();
        closeFileTab(b.dataset.awsClose);
      }));
      host.querySelectorAll('[data-aws-rm-mat]').forEach(b => b.addEventListener('click', async () => {
        const m = materials().find(x => x.id === b.dataset.awsRmMat);
        if (m) await confirmDeleteMaterial(m);
      }));
      host.querySelectorAll('[data-aws-rm-del]').forEach(b => b.addEventListener('click', async () => {
        const d = deliverables().find(x => x.id === b.dataset.awsRmDel);
        if (d) await confirmDeleteDeliverable(d);
      }));
      host.querySelectorAll('[data-aws-dl-del]').forEach(b => b.addEventListener('click', () => {
        const d = deliverables().find(x => x.id === b.dataset.awsDlDel);
        if (!d) return;
        ui.download(d.name, '# AgentOS 演示导出\n\n' + (d.summary || d.name) + '\n', 'text/markdown;charset=utf-8');
        ui.toast('已开始下载（演示）');
      }));
      if (active !== 'menu') return;
      if (menu === 'knowledge') {
        bindKnowledge();
        return;
      }
      host.querySelectorAll('[data-as-twist]').forEach(b => b.addEventListener('click', e => {
        e.stopPropagation();
        const id = b.dataset.asTwist;
        if (openFolders.has(id)) openFolders.delete(id); else openFolders.add(id);
        draw();
      }));
      host.querySelectorAll('[data-as-folder]').forEach(b => b.addEventListener('click', () => {
        folderId = b.dataset.asFolder;
        openFolders.add(folderId);
        selectedId = '';
        draw();
      }));
      host.querySelectorAll('[data-as-mat]').forEach(b => b.addEventListener('click', () => {
        selectedId = b.dataset.asMat;
        const m = materials().find(x => x.id === selectedId);
        if (m) openFileTab({ kind: 'material', id: m.id, title: m.name });
        else draw();
      }));
      host.querySelectorAll('[data-as-del]').forEach(b => b.addEventListener('click', () => {
        selectedId = b.dataset.asDel;
        const d = deliverables().find(x => x.id === selectedId);
        if (d) openFileTab({ kind: 'deliverable', id: d.id, title: d.name });
        else draw();
      }));
      host.querySelectorAll('[data-as-cite-folder]').forEach(b => b.addEventListener('click', e => {
        e.stopPropagation();
        const f = ws().materialFolders.find(x => x.id === b.dataset.asCiteFolder);
        if (!f || !opts.onCite) return;
        const n = folderCount(f.id);
        opts.onCite({ kind: 'folder', id: f.id, name: f.name, hint: n ? ('含 ' + n + ' 个文件') : '空文件夹' });
      }));
      host.querySelectorAll('[data-as-cite-mat]').forEach(b => b.addEventListener('click', e => {
        e.stopPropagation();
        const m = materials().find(x => x.id === b.dataset.asCiteMat);
        if (!m || !opts.onCite) return;
        opts.onCite({
          kind: 'material', id: m.id, name: m.name,
          hint: [m.agentName, m.date].filter(Boolean).join(' · ')
        });
      }));
      host.querySelectorAll('[data-as-cite-del]').forEach(b => b.addEventListener('click', e => {
        e.stopPropagation();
        const d = deliverables().find(x => x.id === b.dataset.asCiteDel);
        if (!d || !opts.onCite) return;
        opts.onCite({
          kind: 'deliverable', id: d.id, name: d.name,
          hint: [d.agentName, d.date].filter(Boolean).join(' · ')
        });
      }));
      const up = host.querySelector('[data-as-upload]');
      if (up) up.addEventListener('click', uploadMaterial);
      const nf = host.querySelector('[data-as-new-folder]');
      if (nf) nf.addEventListener('click', newFolder);
      const nd = host.querySelector('[data-as-new-del]');
      if (nd) nd.addEventListener('click', newDeliverable);
      host.querySelectorAll('[data-as-folder-more],[data-as-mat-more],[data-as-del-more]').forEach(b => b.addEventListener('click', e => {
        e.stopPropagation();
        const folderMore = b.dataset.asFolderMore;
        const matId = b.dataset.asMatMore;
        const delId = b.dataset.asDelMore;
        if (folderMore) {
          const f = ws().materialFolders.find(x => x.id === folderMore);
          if (!f) return;
          openCiteOrDelete({
            title: f.name,
            onCite: opts.onCite ? () => opts.onCite({
              kind: 'folder', id: f.id, name: f.name,
              hint: folderCount(f.id) ? ('含 ' + folderCount(f.id) + ' 个文件') : '空文件夹'
            }) : null,
            onDelete: null
          });
          return;
        }
        if (matId) {
          const m = materials().find(x => x.id === matId);
          if (!m) return;
          openCiteOrDelete({
            title: m.name,
            onCite: opts.onCite ? () => opts.onCite({
              kind: 'material', id: m.id, name: m.name,
              hint: [m.agentName, m.date].filter(Boolean).join(' · ')
            }) : null,
            onDelete: () => confirmDeleteMaterial(m)
          });
          return;
        }
        if (delId) {
          const d = deliverables().find(x => x.id === delId);
          if (!d) return;
          openCiteOrDelete({
            title: d.name,
            onCite: opts.onCite ? () => opts.onCite({
              kind: 'deliverable', id: d.id, name: d.name,
              hint: [d.agentName, d.date].filter(Boolean).join(' · ')
            }) : null,
            onDelete: () => confirmDeleteDeliverable(d)
          });
        }
      }));
    }

    function bindKnowledge() {
      host.querySelectorAll('[data-kb-enter]').forEach(b => b.addEventListener('click', () => {
        kbLibId = b.dataset.kbEnter;
        kbFolderId = '';
        draw();
      }));
      const back = host.querySelector('[data-kb-back]');
      if (back) back.addEventListener('click', () => {
        if (kbFolderId) {
          const cur = (store.state.folders || []).find(f => f.id === kbFolderId);
          kbFolderId = cur && cur.parentId ? cur.parentId : '';
        } else {
          kbLibId = '';
        }
        draw();
      });
      const root = host.querySelector('[data-kb-root]');
      if (root) root.addEventListener('click', () => { kbFolderId = ''; draw(); });
      host.querySelectorAll('[data-kb-folder]').forEach(b => b.addEventListener('click', () => {
        kbFolderId = b.dataset.kbFolder;
        openKbFolders.add(kbFolderId);
        draw();
      }));
      host.querySelectorAll('[data-kb-twist]').forEach(b => b.addEventListener('click', e => {
        e.stopPropagation();
        const id = b.dataset.kbTwist;
        if (openKbFolders.has(id)) openKbFolders.delete(id); else openKbFolders.add(id);
        draw();
      }));
      host.querySelectorAll('[data-kb-doc]').forEach(b => b.addEventListener('click', () => {
        const d = visibleDocs().find(x => x.id === b.dataset.kbDoc);
        if (d) openFileTab({ kind: 'doc', id: d.id, title: d.title });
      }));
      host.querySelectorAll('[data-kb-cite-lib]').forEach(b => b.addEventListener('click', e => {
        e.stopPropagation();
        const lib = visibleLibs().find(x => x.id === b.dataset.kbCiteLib) ||
          (store.state.libraries || []).find(x => x.id === b.dataset.kbCiteLib);
        if (!lib || !opts.onCite) return;
        opts.onCite({ kind: 'library', id: lib.id, name: lib.name, hint: P.levelLabel(lib.level) });
      }));
      host.querySelectorAll('[data-kb-cite-folder]').forEach(b => b.addEventListener('click', e => {
        e.stopPropagation();
        const f = (store.state.folders || []).find(x => x.id === b.dataset.kbCiteFolder);
        if (!f || !opts.onCite) return;
        const n = F.childrenOf(store.state.folders, f.id, f.libraryId).length + F.docsIn(visibleDocs(), f.id, f.libraryId).length;
        opts.onCite({ kind: 'kbFolder', id: f.id, name: f.name, hint: n ? ('含 ' + n + ' 项') : '空文件夹' });
      }));
      host.querySelectorAll('[data-kb-cite-doc]').forEach(b => b.addEventListener('click', e => {
        e.stopPropagation();
        const d = visibleDocs().find(x => x.id === b.dataset.kbCiteDoc);
        if (!d || !opts.onCite) return;
        opts.onCite({
          kind: 'doc', id: d.id, name: d.title,
          hint: [d.library, d.process, d.year].filter(Boolean).join(' · ')
        });
      }));
    }

    function openCiteOrDelete(o) {
      const actions = [];
      if (o.onCite) actions.push('<button type="button" class="btn primary" data-act-cite>' + icon('quote') + '引用到对话</button>');
      if (o.onDelete) actions.push('<button type="button" class="btn danger" data-act-del>删除</button>');
      actions.push('<button type="button" class="btn" data-ok>取消</button>');
      ui.modal({
        title: o.title,
        foot: actions.join(''),
        body: '<p class="muted small">可将该条目引用到左侧对话输入栏，随问题一并发送。</p>',
        onMount(box, close) {
          const citeBtn = box.querySelector('[data-act-cite]');
          if (citeBtn) citeBtn.addEventListener('click', () => { o.onCite(); close(); });
          const delBtn = box.querySelector('[data-act-del]');
          if (delBtn) delBtn.addEventListener('click', async () => { close(); await o.onDelete(); });
          const ok = box.querySelector('[data-ok]');
          if (ok) ok.addEventListener('click', close);
        }
      });
    }

    async function confirmDeleteMaterial(m) {
      const ok = await ui.confirm({ title: '删除素材', okText: '删除', body: '<p>删除「' + esc(m.name) + '」？</p>' });
      if (!ok) return;
      const i = ws().materials.findIndex(x => x.id === m.id);
      if (i >= 0) ws().materials.splice(i, 1);
      if (selectedId === m.id) selectedId = '';
      const key = 'material:' + m.id;
      const ti = docTabs.findIndex(t => t.key === key);
      if (ti >= 0) {
        docTabs.splice(ti, 1);
        if (active === key) active = 'menu';
      }
      store.save();
      draw();
      ui.toast('已删除素材');
    }

    async function confirmDeleteDeliverable(d) {
      const ok = await ui.confirm({ title: '删除交付物', okText: '删除', body: '<p>删除「' + esc(d.name) + '」？</p>' });
      if (!ok) return;
      const i = ws().deliverables.findIndex(x => x.id === d.id);
      if (i >= 0) ws().deliverables.splice(i, 1);
      if (selectedId === d.id) selectedId = '';
      const key = 'deliverable:' + d.id;
      const ti = docTabs.findIndex(t => t.key === key);
      if (ti >= 0) {
        docTabs.splice(ti, 1);
        if (active === key) active = 'menu';
      }
      store.save();
      draw();
      ui.toast('已删除交付物');
    }

    function uploadMaterial() {
      const target = folderId || (ws().materialFolders[0] && ws().materialFolders[0].id) || '';
      ui.modal({
        title: '上传素材',
        okText: '添加',
        body: '<div class="stack"><div class="field"><label for="asName">文件名</label><input class="input" id="asName" placeholder="例如：炉况参数摘录.xlsx"></div>' +
          '<div class="field"><label for="asAgent">来源智能体</label><input class="input" id="asAgent" value="' + esc((opts.agentName) || '当前对话') + '"></div>' +
          '<span class="err" id="asErr" hidden></span></div>',
        onMount(box, close) {
          box.querySelector('[data-ok]').addEventListener('click', () => {
            const name = box.querySelector('#asName').value.trim();
            const err = box.querySelector('#asErr');
            if (!name) { err.hidden = false; err.textContent = '请输入文件名'; return; }
            const ext = (name.split('.').pop() || 'txt').toLowerCase();
            const fid = target || null;
            ws().materials.unshift({
              id: store.uid('asm'), name, folderId: fid,
              date: new Date().toISOString().slice(0, 10),
              agentName: box.querySelector('#asAgent').value.trim() || '手动上传',
              ownerId: user.id, type: ext, size: '—'
            });
            if (fid) openFolders.add(fid);
            folderId = fid || folderId;
            store.save();
            close();
            draw();
            ui.toast('已加入素材');
          });
        }
      });
    }

    function newFolder() {
      ui.modal({
        title: '新建素材文件夹',
        okText: '创建',
        body: '<div class="stack"><div class="field"><label for="asFolder">名称</label><input class="input" id="asFolder" placeholder="例如：临时附件"></div>' +
          '<span class="err" id="asErr" hidden></span></div>',
        onMount(box, close) {
          box.querySelector('[data-ok]').addEventListener('click', () => {
            const name = box.querySelector('#asFolder').value.trim();
            const err = box.querySelector('#asErr');
            if (!name) { err.hidden = false; err.textContent = '请输入名称'; return; }
            if (ws().materialFolders.some(f => f.name === name && !f.parentId)) {
              err.hidden = false; err.textContent = '已有同名文件夹'; return;
            }
            const id = store.uid('asf');
            ws().materialFolders.push({ id, name, parentId: null });
            folderId = id;
            openFolders.add(id);
            store.save();
            close();
            draw();
            ui.toast('已创建文件夹');
          });
        }
      });
    }

    function newDeliverable() {
      ui.modal({
        title: '登记成果物',
        okText: '添加',
        body: '<div class="stack"><div class="field"><label for="asDelName">名称</label><input class="input" id="asDelName" placeholder="例如：炉况诊断摘要.md"></div>' +
          '<div class="field"><label for="asDelSum">摘要</label><textarea class="textarea" id="asDelSum" style="min-height:72px" placeholder="一句话说明成果内容"></textarea></div>' +
          '<span class="err" id="asErr" hidden></span></div>',
        onMount(box, close) {
          box.querySelector('[data-ok]').addEventListener('click', () => {
            const name = box.querySelector('#asDelName').value.trim();
            const err = box.querySelector('#asErr');
            if (!name) { err.hidden = false; err.textContent = '请输入名称'; return; }
            const ext = (name.split('.').pop() || 'md').toLowerCase();
            const id = store.uid('asd');
            ws().deliverables.unshift({
              id, name,
              date: new Date().toISOString().slice(0, 10),
              agentName: opts.agentName || '当前对话',
              ownerId: user.id, type: ext,
              summary: box.querySelector('#asDelSum').value.trim()
            });
            selectedId = id;
            store.save();
            close();
            draw();
            ui.toast('已登记交付物');
          });
        }
      });
    }

    draw();
    return {
      destroy() { host.innerHTML = ''; },
      redraw: draw,
      setFullscreen(v) { fullscreen = !!v; draw(); },
      openDoc(id) {
        const doc = visibleDocs().find(d => d.id === id) || (store.state.docs || []).find(d => d.id === id);
        if (!doc) return;
        if (!P.canView(user, doc, store.state.libraries)) {
          ui.toast('你没有权限查看这份资料', 'warn');
          return;
        }
        openFileTab({ kind: 'doc', id: doc.id, title: doc.title });
      }
    };
  }

  AOS.mountAgentWorkspace = mountAgentWorkspace;

  /* 旧独立页入口：跳转到智能体广场 */
  AOS.views.workspace = function () {
    location.hash = '#/';
    ui.toast('智能体工作台已移至对话窗口右侧');
  };
})(window);
