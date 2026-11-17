/* AgentOS · 企业角色与功能权限、部门树 */
(function (root) {
  const AOS = root.AOS || (root.AOS = {});
  const PERMS = {
    ORG_MANAGE: 'org.manage',
    ROLE_MANAGE: 'role.manage',
    KB_CREATE: 'kb.create'
  };
  const SEED_DEPARTMENTS = [
    { id: 'dept-iron', name: '炼铁技术中心', parentId: null },
    { id: 'dept-bf', name: '高炉车间', parentId: 'dept-iron' },
    { id: 'dept-sinter', name: '烧结车间', parentId: 'dept-iron' },
    { id: 'dept-tech', name: '科技管理部', parentId: null },
    { id: 'dept-intel', name: '科技情报室', parentId: 'dept-tech' },
    { id: 'dept-it', name: '信息中心', parentId: null }
  ];
  const DATA_SCOPES = [
    { id: 'all', name: '全部' },
    { id: 'dept', name: '本部门' },
    { id: 'self', name: '仅本人' }
  ];
  const SEED_ROLES = [
    {
      id: 'role-admin', name: '企业管理员', description: '管理通讯录、角色，并可新建知识库',
      permissions: [PERMS.ORG_MANAGE, PERMS.ROLE_MANAGE, PERMS.KB_CREATE], dataScope: 'all'
    },
    {
      id: 'role-member', name: '普通成员', description: '使用平台与被授权的知识库',
      permissions: [], dataScope: 'dept'
    }
  ];

  function normId(id) { return id == null || id === '' ? null : id; }
  function roleById(roles, id) { return (roles || []).find(r => r.id === id); }
  function userDepts(user) {
    if (!user) return [];
    if (Array.isArray(user.depts) && user.depts.length) {
      return user.depts.map(s => String(s == null ? '' : s).trim()).filter(Boolean);
    }
    if (user.dept) return [String(user.dept).trim()].filter(Boolean);
    return [];
  }
  function syncUserDeptFields(user, depts) {
    const list = [];
    const seen = new Set();
    (depts || []).forEach(s => {
      const n = String(s == null ? '' : s).trim();
      if (!n || seen.has(n)) return;
      seen.add(n);
      list.push(n);
    });
    user.depts = list;
    user.dept = list[0] || '';
    return user;
  }
  function userDeptLabel(user) {
    const list = userDepts(user);
    return list.length ? list.join('、') : '';
  }
  function userBelongsToAny(user, names) {
    const set = names instanceof Set ? names : new Set(names || []);
    return userDepts(user).some(n => set.has(n));
  }
  function normalizeUser(user) {
    if (!user) return user;
    syncUserDeptFields(user, userDepts(user));
    return user;
  }
  function normDataScope(scope) {
    if (scope === 'dept' || scope === 'self' || scope === 'all') return scope;
    if (scope === 'enterprise') return 'all';
    return 'all';
  }
  function dataScopeLabel(scope) {
    const id = normDataScope(scope);
    const hit = DATA_SCOPES.find(s => s.id === id);
    return hit ? hit.name : '全部';
  }
  function userHasPerm(user, roles, perm) {
    const ids = (user && user.roleIds) || [];
    return ids.some(rid => {
      const r = roleById(roles, rid);
      return r && Array.isArray(r.permissions) && r.permissions.includes(perm);
    });
  }
  function byId(depts, id) { return (depts || []).find(d => d.id === id); }
  function childrenOf(depts, parentId) {
    const p = normId(parentId);
    return (depts || []).filter(d => normId(d.parentId) === p);
  }
  function descendantIds(depts, id) {
    const root = normId(id);
    if (root == null) return (depts || []).map(d => d.id);
    const out = [root];
    const queue = [root];
    while (queue.length) {
      const cur = queue.shift();
      childrenOf(depts, cur).forEach(c => { out.push(c.id); queue.push(c.id); });
    }
    return out;
  }
  function descendantNames(depts, id) {
    const ids = new Set(descendantIds(depts, id));
    return (depts || []).filter(d => ids.has(d.id)).map(d => d.name);
  }
  function pathDepts(depts, id) {
    const out = [];
    let cur = normId(id);
    const seen = new Set();
    while (cur && !seen.has(cur)) {
      seen.add(cur);
      const d = byId(depts, cur);
      if (!d) break;
      out.unshift(d);
      cur = normId(d.parentId);
    }
    return out;
  }
  function flatOptions(depts) {
    const walk = (parentId, depth) => {
      const rows = [];
      childrenOf(depts, parentId).forEach(d => {
        const pad = depth ? Array(depth + 1).join('　') : '';
        rows.push({ id: d.id, name: d.name, label: pad + d.name, depth: depth });
        rows.push.apply(rows, walk(d.id, depth + 1));
      });
      return rows;
    };
    return walk(null, 0);
  }
  function siblingNameTaken(depts, parentId, name, exceptId) {
    const n = String(name || '').trim();
    if (!n) return true;
    return childrenOf(depts, parentId).some(d => d.id !== exceptId && d.name.trim() === n);
  }
  function wouldCycle(depts, id, nextParentId) {
    const self = normId(id);
    const p = normId(nextParentId);
    if (self == null || p == null) return false;
    if (self === p) return true;
    return descendantIds(depts, self).indexOf(p) >= 0;
  }
  function normalizeDepartments(depts) {
    return (depts || []).map(d => Object.assign({}, d, { parentId: normId(d.parentId) }));
  }

  /** 存量扁平通讯录升级为树：尚无父子边时套用种子 parentId，并补齐缺失的种子部门。 */
  function upgradeDepartments(depts) {
    const list = normalizeDepartments(depts);
    const byIdMap = {};
    list.forEach(d => { if (d && d.id) byIdMap[d.id] = d; });
    const hasTree = list.some(d => normId(d.parentId) != null);
    if (!hasTree) {
      SEED_DEPARTMENTS.forEach(s => {
        const cur = byIdMap[s.id];
        if (cur) cur.parentId = normId(s.parentId);
      });
    }
    SEED_DEPARTMENTS.forEach(s => {
      if (byIdMap[s.id]) return;
      const row = Object.assign({}, s, { parentId: normId(s.parentId) });
      list.push(row);
      byIdMap[s.id] = row;
    });
    return list;
  }

  /** 模拟钉钉通讯录拉取结果（静态原型演示用）。 */
  const DINGTALK_MOCK = {
    departments: [
      { dingId: 'dd-iron', name: '炼铁技术中心', parentDingId: null },
      { dingId: 'dd-bf', name: '高炉车间', parentDingId: 'dd-iron' },
      { dingId: 'dd-sinter', name: '烧结车间', parentDingId: 'dd-iron' },
      { dingId: 'dd-tech', name: '科技管理部', parentDingId: null },
      { dingId: 'dd-intel', name: '科技情报室', parentDingId: 'dd-tech' },
      { dingId: 'dd-it', name: '信息中心', parentDingId: null },
      { dingId: 'dd-qa', name: '质量部', parentDingId: null },
      { dingId: 'dd-qc', name: '质检室', parentDingId: 'dd-qa' }
    ],
    users: [
      { dingId: 'dd-u-wang', name: '王建国', title: '高级工程师', deptDingId: 'dd-iron' },
      { dingId: 'dd-u-li', name: '李敏', title: '科研项目主管', deptDingId: 'dd-tech' },
      { dingId: 'dd-u-zhang', name: '张涛', title: '情报研究员', deptDingId: 'dd-intel' },
      { dingId: 'dd-u-chen', name: '陈晓', title: '平台管理员', deptDingId: 'dd-it' },
      { dingId: 'dd-u-zhao', name: '赵立新', title: '高炉工艺工程师', deptDingId: 'dd-bf' },
      { dingId: 'dd-u-sun', name: '孙海', title: '烧结工艺工程师', deptDingId: 'dd-sinter' },
      { dingId: 'dd-u-liu', name: '刘强', title: '炉况分析师', deptDingId: 'dd-iron' },
      { dingId: 'dd-u-ma', name: '马芳', title: '质检员', deptDingId: 'dd-qc' }
    ]
  };

  /**
   * 将钉钉部门/人员合并进本地通讯录：按 dingId 或同名匹配，不删除本地独有数据。
   * uidFn(prefix) 用于新建 id。
   */
  function applyDingTalkSync(depts, users, payload, uidFn) {
    const src = payload || DINGTALK_MOCK;
    const nextDepts = (depts || []).map(d => Object.assign({}, d, { parentId: normId(d.parentId) }));
    const nextUsers = (users || []).map(u => Object.assign({}, u, {
      roleIds: Array.isArray(u.roleIds) ? u.roleIds.slice() : []
    }));
    const uid = typeof uidFn === 'function' ? uidFn : (p => p + '-' + Math.random().toString(36).slice(2, 8));
    const stats = { addedDepts: 0, updatedDepts: 0, addedUsers: 0, updatedUsers: 0 };
    const dingToLocal = {};

    (src.departments || []).forEach(row => {
      let hit = nextDepts.find(d => d.dingId && d.dingId === row.dingId)
        || nextDepts.find(d => d.name === row.name);
      if (hit) {
        let changed = false;
        if (hit.name !== row.name) { hit.name = row.name; changed = true; }
        if (hit.dingId !== row.dingId) { hit.dingId = row.dingId; changed = true; }
        if (changed) stats.updatedDepts += 1;
      } else {
        hit = { id: uid('dept'), name: row.name, parentId: null, dingId: row.dingId };
        nextDepts.push(hit);
        stats.addedDepts += 1;
      }
      dingToLocal[row.dingId] = hit.id;
    });

    (src.departments || []).forEach(row => {
      const id = dingToLocal[row.dingId];
      const hit = nextDepts.find(d => d.id === id);
      if (!hit) return;
      const parentId = row.parentDingId ? (dingToLocal[row.parentDingId] || null) : null;
      if (normId(hit.parentId) !== normId(parentId)) {
        hit.parentId = parentId;
        stats.updatedDepts += 1;
      }
    });

    const deptNameByDing = {};
    (src.departments || []).forEach(row => { deptNameByDing[row.dingId] = row.name; });

    (src.users || []).forEach(row => {
      const deptName = deptNameByDing[row.deptDingId] || '';
      let hit = nextUsers.find(u => u.dingId && u.dingId === row.dingId)
        || nextUsers.find(u => u.name === row.name);
      if (hit) {
        let changed = false;
        if (hit.title !== (row.title || '')) { hit.title = row.title || ''; changed = true; }
        if (deptName) {
          const before = userDepts(hit).slice().sort().join('\0');
          const merged = userDepts(hit).slice();
          if (merged.indexOf(deptName) < 0) merged.push(deptName);
          syncUserDeptFields(hit, merged);
          const after = userDepts(hit).slice().sort().join('\0');
          if (before !== after) changed = true;
        }
        if (hit.dingId !== row.dingId) { hit.dingId = row.dingId; changed = true; }
        if (changed) stats.updatedUsers += 1;
      } else {
        const nu = {
          id: uid('u'),
          name: row.name,
          title: row.title || '',
          clearance: 'internal',
          roleIds: ['role-member'],
          dingId: row.dingId
        };
        syncUserDeptFields(nu, deptName ? [deptName] : []);
        nextUsers.push(nu);
        stats.addedUsers += 1;
      }
    });

    nextUsers.forEach(normalizeUser);
    return { departments: nextDepts, users: nextUsers, stats: stats };
  }

  AOS.org = {
    PERMS, DATA_SCOPES, SEED_ROLES, SEED_DEPARTMENTS, DINGTALK_MOCK, roleById, userHasPerm,
    userDepts, syncUserDeptFields, userDeptLabel, userBelongsToAny, normalizeUser,
    normDataScope, dataScopeLabel,
    normId, byId, childrenOf, descendantIds, descendantNames, pathDepts,
    flatOptions, siblingNameTaken, wouldCycle, normalizeDepartments, upgradeDepartments,
    applyDingTalkSync
  };
})(typeof window !== 'undefined' ? window : globalThis);
