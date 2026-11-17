/* AgentOS · 知识库 grants 与可见性纯逻辑 */
(function (root) {
  const AOS = root.AOS || (root.AOS = {});
  const ROLE_RANK = { read: 1, edit: 2, manage: 3 };
  function chenManage() { return { type: 'user', id: 'u-chen', role: 'manage' }; }

  const SEED_LIBRARIES = [
    {
      id: 'lib-report', name: '科研报告库', level: 'internal',
      description: '科研总结、试验报告与技术攻关资料',
      grants: [
        { type: 'dept', id: '炼铁技术中心', role: 'edit' },
        { type: 'dept', id: '科技管理部', role: 'read' },
        chenManage()
      ]
    },
    {
      id: 'lib-topic', name: '课题库', level: 'internal',
      description: '课题立项、过程与结题资料',
      grants: [
        { type: 'dept', id: '科技管理部', role: 'edit' },
        { type: 'dept', id: '炼铁技术中心', role: 'read' },
        chenManage()
      ]
    },
    {
      id: 'lib-drawing', name: '图纸库', level: 'internal',
      description: '工艺与设备图纸',
      grants: [
        { type: 'dept', id: '炼铁技术中心', role: 'edit' },
        chenManage()
      ]
    },
    {
      id: 'lib-std', name: '标准库', level: 'internal',
      description: '厂内与行业标准规范',
      grants: [
        { type: 'dept', id: '科技管理部', role: 'edit' },
        { type: 'dept', id: '炼铁技术中心', role: 'read' },
        chenManage()
      ]
    },
    {
      id: 'lib-expert', name: '专家经验库', level: 'internal',
      description: '专家经验与现场处置记录',
      grants: [
        { type: 'dept', id: '科技管理部', role: 'edit' },
        { type: 'dept', id: '炼铁技术中心', role: 'read' },
        chenManage()
      ]
    },
    {
      id: 'lib-code', name: '代码库', level: 'internal',
      description: '模型、脚本与计算代码',
      grants: [
        { type: 'dept', id: '信息中心', role: 'edit' },
        { type: 'dept', id: '炼铁技术中心', role: 'read' },
        chenManage()
      ]
    },
    {
      id: 'lib-db', name: '数据库', level: 'internal',
      description: '数据字典与库表说明',
      grants: [
        { type: 'dept', id: '信息中心', role: 'edit' },
        { type: 'dept', id: '科技管理部', role: 'read' },
        chenManage()
      ]
    }
  ];

  const LEGACY_TOP_TO_LIB = {
    'f-report': 'lib-report',
    '科研报告': 'lib-report',
    '科研报告库': 'lib-report',
    'f-topic': 'lib-topic',
    '课题库': 'lib-topic',
    'f-drawing': 'lib-drawing',
    '图纸库': 'lib-drawing',
    'f-std': 'lib-std',
    '标准库': 'lib-std',
    'f-expert': 'lib-expert',
    '专家经验': 'lib-expert',
    '专家经验库': 'lib-expert',
    'f-code': 'lib-code',
    '代码库': 'lib-code',
    'f-db': 'lib-db',
    '数据库': 'lib-db'
  };

  function byId(libraries, id) {
    return (libraries || []).find(l => l.id === id);
  }

  function effectiveRole(library, user) {
    if (!library || !user) return null;
    const grants = library.grants || [];
    let best = 0;
    let role = null;
    grants.forEach(g => {
      if (!g) return;
      const depts = (AOS.org && AOS.org.userDepts) ? AOS.org.userDepts(user) : (user.dept ? [user.dept] : []);
      const match = (g.type === 'user' && g.id === user.id) ||
        (g.type === 'dept' && depts.indexOf(g.id) >= 0);
      if (!match) return;
      const rank = ROLE_RANK[g.role] || 0;
      if (rank > best) {
        best = rank;
        role = g.role;
      }
    });
    return role;
  }

  function canRead(library, user) {
    return (ROLE_RANK[effectiveRole(library, user)] || 0) >= ROLE_RANK.read;
  }
  function canEdit(library, user) {
    return (ROLE_RANK[effectiveRole(library, user)] || 0) >= ROLE_RANK.edit;
  }
  function canManage(library, user) {
    return (ROLE_RANK[effectiveRole(library, user)] || 0) >= ROLE_RANK.manage;
  }

  function visibleLibraries(libraries, user, levelRankFn) {
    const rank = typeof levelRankFn === 'function' ? levelRankFn : function () { return 0; };
    return (libraries || []).filter(lib =>
      rank(user && user.clearance) >= rank(lib.level) && canRead(lib, user)
    );
  }

  function syncDocFromLibrary(doc, library) {
    const out = doc || {};
    out.level = library ? library.level : out.level;
    out.libraryId = library ? library.id : out.libraryId;
    if (Array.isArray(out.acl)) out.acl.length = 0;
    else out.acl = [];
    return out;
  }

  function isLibraryEmpty(libraryId, folders, docs) {
    const hasFolder = (folders || []).some(f => f && f.libraryId === libraryId);
    const hasDoc = (docs || []).some(d => d && d.libraryId === libraryId);
    return !hasFolder && !hasDoc;
  }

  function mapLegacyTopFolderToLibraryId(folderIdOrName) {
    if (folderIdOrName == null || folderIdOrName === '') return null;
    return LEGACY_TOP_TO_LIB[folderIdOrName] || null;
  }

  AOS.libraries = {
    ROLE_RANK, SEED_LIBRARIES, byId, effectiveRole,
    canRead, canEdit, canManage, visibleLibraries,
    syncDocFromLibrary, isLibraryEmpty, mapLegacyTopFolderToLibraryId
  };
})(typeof window !== 'undefined' ? window : globalThis);
