/* AgentOS · 知识库文件夹纯逻辑 */
(function (root) {
  const AOS = root.AOS || (root.AOS = {});
  const SEED_FOLDERS = [
    { id: 'f-report', name: '科研报告', parentId: null, libraryId: 'lib-report' },
    { id: 'f-report-bf', name: '高炉', parentId: 'f-report', libraryId: 'lib-report' },
    { id: 'f-report-sinter', name: '烧结', parentId: 'f-report', libraryId: 'lib-report' },
    { id: 'f-topic', name: '课题库', parentId: null, libraryId: 'lib-topic' },
    { id: 'f-drawing', name: '图纸库', parentId: null, libraryId: 'lib-drawing' },
    { id: 'f-drawing-bf', name: '高炉', parentId: 'f-drawing', libraryId: 'lib-drawing' },
    { id: 'f-std', name: '标准库', parentId: null, libraryId: 'lib-std' },
    { id: 'f-expert', name: '专家经验', parentId: null, libraryId: 'lib-expert' }
  ];

  function normId(id) { return id == null || id === '' ? null : id; }
  function inLib(item, libraryId) {
    const lib = normId(libraryId);
    return !lib || (item && item.libraryId === lib);
  }
  function childrenOf(folders, parentId, libraryId) {
    const p = normId(parentId);
    return (folders || []).filter(f => normId(f.parentId) === p && inLib(f, libraryId));
  }
  function docsIn(docs, folderId, libraryId) {
    const p = normId(folderId);
    return (docs || []).filter(d => normId(d.folderId) === p && inLib(d, libraryId));
  }
  function byId(folders, id) { return (folders || []).find(f => f.id === id); }
  function pathFolders(folders, id, libraryId) {
    const out = [];
    let cur = normId(id);
    const seen = new Set();
    while (cur && !seen.has(cur)) {
      seen.add(cur);
      const f = byId(folders, cur);
      if (!f || !inLib(f, libraryId)) break;
      out.unshift(f);
      cur = normId(f.parentId);
    }
    return out;
  }
  function pathLabel(folders, id, libraryId) {
    const scoped = !!normId(libraryId);
    if (normId(id) == null) return scoped ? '库根目录' : '全部资料';
    const parts = pathFolders(folders, id, libraryId).map(f => f.name);
    return parts.length ? parts.join(' / ') : (scoped ? '库根目录' : '全部资料');
  }
  function flatOptions(folders, libraryId) {
    const roots = childrenOf(folders, null, libraryId);
    const walk = (list, prefix) => {
      const rows = [];
      list.forEach(f => {
        const label = prefix ? prefix + ' / ' + f.name : f.name;
        rows.push({ id: f.id, label });
        rows.push.apply(rows, walk(childrenOf(folders, f.id, libraryId), label));
      });
      return rows;
    };
    const root = { id: null, label: normId(libraryId) ? '库根目录' : '全部资料' };
    return [root].concat(walk(roots, ''));
  }
  function siblingNameTaken(folders, parentId, name, exceptId, libraryId) {
    const n = String(name || '').trim();
    if (!n) return true;
    return childrenOf(folders, parentId, libraryId).some(f => f.id !== exceptId && f.name.trim() === n);
  }
  function isEmpty(folders, docs, folderId, libraryId) {
    const id = normId(folderId);
    if (id == null && !normId(libraryId)) return false;
    return childrenOf(folders, id, libraryId).length === 0 && docsIn(docs, id, libraryId).length === 0;
  }
  function descendantFolderIds(folders, folderId, libraryId) {
    const id = normId(folderId);
    if (id == null) return (folders || []).filter(f => inLib(f, libraryId)).map(f => f.id);
    const start = byId(folders, id);
    if (normId(libraryId) && (!start || !inLib(start, libraryId))) return [];
    const out = [id];
    const queue = [id];
    while (queue.length) {
      const cur = queue.shift();
      childrenOf(folders, cur, libraryId).forEach(c => { out.push(c.id); queue.push(c.id); });
    }
    return out;
  }
  function descendantDocIds(folders, docs, folderId, libraryId) {
    const ids = new Set(descendantFolderIds(folders, folderId, libraryId));
    const root = normId(folderId) == null;
    return (docs || []).filter(d => {
      if (!inLib(d, libraryId)) return false;
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
