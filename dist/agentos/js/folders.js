/* AgentOS · 知识库文件夹纯逻辑 */
(function (root) {
  const AOS = root.AOS || (root.AOS = {});
  const SEED_FOLDERS = [
    { id: 'f-report', name: '科研报告', parentId: null },
    { id: 'f-report-bf', name: '高炉', parentId: 'f-report' },
    { id: 'f-report-sinter', name: '烧结', parentId: 'f-report' },
    { id: 'f-topic', name: '课题库', parentId: null },
    { id: 'f-drawing', name: '图纸库', parentId: null },
    { id: 'f-drawing-bf', name: '高炉', parentId: 'f-drawing' },
    { id: 'f-std', name: '标准库', parentId: null },
    { id: 'f-expert', name: '专家经验', parentId: null }
  ];

  function normId(id) { return id == null || id === '' ? null : id; }
  function childrenOf(folders, parentId) {
    const p = normId(parentId);
    return (folders || []).filter(f => normId(f.parentId) === p);
  }
  function docsIn(docs, folderId) {
    const p = normId(folderId);
    return (docs || []).filter(d => normId(d.folderId) === p);
  }
  function byId(folders, id) { return (folders || []).find(f => f.id === id); }
  function pathFolders(folders, id) {
    const out = [];
    let cur = normId(id);
    const seen = new Set();
    while (cur && !seen.has(cur)) {
      seen.add(cur);
      const f = byId(folders, cur);
      if (!f) break;
      out.unshift(f);
      cur = normId(f.parentId);
    }
    return out;
  }
  function pathLabel(folders, id) {
    if (normId(id) == null) return '全部资料';
    const parts = pathFolders(folders, id).map(f => f.name);
    return parts.length ? parts.join(' / ') : '全部资料';
  }
  function flatOptions(folders) {
    const roots = childrenOf(folders, null);
    const walk = (list, prefix) => {
      const rows = [];
      list.forEach(f => {
        const label = prefix ? prefix + ' / ' + f.name : f.name;
        rows.push({ id: f.id, label });
        rows.push.apply(rows, walk(childrenOf(folders, f.id), label));
      });
      return rows;
    };
    return [{ id: null, label: '全部资料' }].concat(walk(roots, ''));
  }
  function siblingNameTaken(folders, parentId, name, exceptId) {
    const n = String(name || '').trim();
    if (!n) return true;
    return childrenOf(folders, parentId).some(f => f.id !== exceptId && f.name.trim() === n);
  }
  function isEmpty(folders, docs, folderId) {
    const id = normId(folderId);
    if (id == null) return false;
    return childrenOf(folders, id).length === 0 && docsIn(docs, id).length === 0;
  }
  function descendantFolderIds(folders, folderId) {
    const id = normId(folderId);
    if (id == null) return (folders || []).map(f => f.id);
    const out = [id];
    const queue = [id];
    while (queue.length) {
      const cur = queue.shift();
      childrenOf(folders, cur).forEach(c => { out.push(c.id); queue.push(c.id); });
    }
    return out;
  }
  function descendantDocIds(folders, docs, folderId) {
    const ids = new Set(descendantFolderIds(folders, folderId));
    const root = normId(folderId) == null;
    return (docs || []).filter(d => {
      const fid = normId(d.folderId);
      if (root) return true;
      return fid && ids.has(fid);
    }).map(d => d.id);
  }
  function defaultFolderId(doc) {
    const lib = doc.library || '';
    const proc = doc.process || '';
    if (lib === '科研报告库') {
      if (proc === '高炉') return 'f-report-bf';
      if (proc === '烧结') return 'f-report-sinter';
      return 'f-report';
    }
    if (lib === '课题库') return 'f-topic';
    if (lib === '图纸库') return proc === '高炉' ? 'f-drawing-bf' : 'f-drawing';
    if (lib === '标准库') return 'f-std';
    if (lib === '专家经验库') return 'f-expert';
    return null;
  }

  AOS.folders = {
    SEED_FOLDERS, defaultFolderId, childrenOf, docsIn, pathFolders, pathLabel,
    flatOptions, siblingNameTaken, isEmpty, descendantDocIds, descendantFolderIds, normId
  };
})(typeof window !== 'undefined' ? window : globalThis);
