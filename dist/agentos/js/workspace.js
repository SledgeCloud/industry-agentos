/* AgentOS · 智能体空间：会话素材与成果物 */
(function (root) {
  const AOS = root.AOS || (root.AOS = {});

  const SEED_MATERIAL_FOLDERS = [
    { id: 'asf-upload', name: '会话上传', parentId: null },
    { id: 'asf-trial', name: '试验数据', parentId: null },
    { id: 'asf-param', name: '工艺参数', parentId: null },
    { id: 'asf-ref', name: '参考资料', parentId: null },
    { id: 'asf-inbox', name: 'upload', parentId: null }
  ];

  const SEED_MATERIALS = [
    { id: 'asm-1', name: '2号高炉近7日焦比煤比明细.xlsx', folderId: 'asf-trial', date: '2026-11-12', agentName: '科研资料助手', ownerId: 'u-wang', type: 'xlsx', size: '186 KB' },
    { id: 'asm-2', name: '炉凉判断访谈录音转写.txt', folderId: 'asf-upload', date: '2026-11-10', agentName: '专家经验沉淀助手', ownerId: 'u-wang', type: 'txt', size: '42 KB' },
    { id: 'asm-3', name: '烧结矿转鼓强度波动原始记录.pdf', folderId: 'asf-trial', date: '2026-11-08', agentName: '工艺问题诊断助手', ownerId: 'u-li', type: 'pdf', size: '1.2 MB' },
    { id: 'asm-4', name: '富氢喷吹试验边界条件.docx', folderId: 'asf-param', date: '2026-11-06', agentName: '试验方案设计助手', ownerId: 'u-wang', type: 'docx', size: '68 KB' },
    { id: 'asm-5', name: '同行氢冶金公开综述摘录.md', folderId: 'asf-ref', date: '2026-11-03', agentName: '调研报告助手', ownerId: 'u-zhang', type: 'md', size: '24 KB' },
    { id: 'asm-6', name: '临时粘贴-炉温预测指标.txt', folderId: 'asf-inbox', date: '2026-11-14', agentName: '立项查新助手', ownerId: 'u-li', type: 'txt', size: '3 KB' }
  ];

  const SEED_DELIVERABLES = [
    { id: 'asd-1', name: '氢冶金技术进展调研报告_王建国.md', date: '2026-11-12', agentName: '调研报告助手', ownerId: 'u-wang', type: 'md', summary: '覆盖富氢喷吹与氢基竖炉两条路线，附厂内可借鉴点。' },
    { id: 'asd-2', name: '2026年10月高炉低碳技术情报简报.md', date: '2026-11-01', agentName: '技术情报简报助手', ownerId: 'u-zhang', type: 'md', summary: '按技术动态、专利、论文分类，标注对本厂关注度。' },
    { id: 'asd-3', name: '高炉炉温智能预测立项查新报告.docx', date: '2026-10-28', agentName: '立项查新助手', ownerId: 'u-li', type: 'docx', summary: '厂内课题与公开文献查重结果及差异说明。' },
    { id: 'asd-4', name: '2号高炉低硅冶炼资料检索摘要.pdf', date: '2026-10-22', agentName: '科研资料助手', ownerId: 'u-wang', type: 'pdf', summary: '整理低硅冶炼相关报告要点与出处。' },
    { id: 'asd-5', name: '烧结烟气治理试验方案草案.md', date: '2026-10-18', agentName: '试验方案设计助手', ownerId: 'u-li', type: 'md', summary: '目标指标、工况组合与采样计划草案。' }
  ];

  function normId(id) { return id == null || id === '' ? null : id; }

  function childrenOf(folders, parentId) {
    const p = normId(parentId);
    return (folders || []).filter(f => normId(f.parentId) === p);
  }

  function materialsIn(list, folderId) {
    const id = normId(folderId);
    return (list || []).filter(m => normId(m.folderId) === id);
  }

  function forUser(list, userId, all) {
    if (all) return (list || []).slice();
    return (list || []).filter(x => !x.ownerId || x.ownerId === userId);
  }

  function ensureShape(state) {
    if (!state.agentSpace) state.agentSpace = {};
    const ws = state.agentSpace;
    if (!Array.isArray(ws.materialFolders) || !ws.materialFolders.length) {
      ws.materialFolders = SEED_MATERIAL_FOLDERS.map(f => Object.assign({}, f));
    }
    if (!Array.isArray(ws.materials) || !ws.materials.length) {
      ws.materials = SEED_MATERIALS.map(m => Object.assign({}, m));
    }
    if (!Array.isArray(ws.deliverables) || !ws.deliverables.length) {
      ws.deliverables = SEED_DELIVERABLES.map(d => Object.assign({}, d));
    }
    return ws;
  }

  function typeIcon(type) {
    if (type === 'pdf') return 'file-text';
    if (type === 'docx' || type === 'doc') return 'file-pen-line';
    if (type === 'xlsx' || type === 'xls') return 'file-spreadsheet';
    if (type === 'md') return 'file-code';
    if (type === 'txt') return 'file';
    return 'file';
  }

  AOS.workspace = {
    SEED_MATERIAL_FOLDERS, SEED_MATERIALS, SEED_DELIVERABLES,
    normId, childrenOf, materialsIn, forUser, ensureShape, typeIcon
  };
})(typeof window !== 'undefined' ? window : globalThis);
