/* AgentOS · 出网策略与资料范围（纯函数，不访问浏览器环境） */
(function (root) {
  const AOS = root.AOS || (root.AOS = {});

  const LEVELS = [
    { id: 'public', label: '公开', rank: 0 },
    { id: 'internal', label: '内部', rank: 1 },
    { id: 'secret', label: '秘密', rank: 2 },
    { id: 'confidential', label: '机密', rank: 3 }
  ];
  const SCOPES = [
    { id: 'public', label: '公开资料' },
    { id: 'internal', label: '厂内资料' },
    { id: 'all', label: '全部' }
  ];
  const ZONES = [
    { id: 'internal', label: '内网模型' },
    { id: 'external', label: '外网模型' }
  ];
  const SCOPE_GROUPS = { public: ['public'], internal: ['internal'], all: ['public', 'internal'] };

  const levelOf = id => LEVELS.find(l => l.id === id) || LEVELS[0];
  const levelRank = id => levelOf(id).rank;
  const levelLabel = id => levelOf(id).label;
  const scopeLabel = id => (SCOPES.find(s => s.id === id) || SCOPES[0]).label;
  const zoneLabel = id => (ZONES.find(z => z.id === id) || ZONES[0]).label;

  function canViewLegacy(user, doc) {
    if (levelRank(doc.level) > levelRank(user.clearance)) return false;
    if (!doc.acl || doc.acl.length === 0) return true;
    const depts = (AOS.org && AOS.org.userDepts) ? AOS.org.userDepts(user) : (user.dept ? [user.dept] : []);
    return doc.acl.some(n => depts.indexOf(n) >= 0);
  }

  function librariesFromStore() {
    const store = AOS.store;
    return store && store.state && store.state.libraries;
  }

  function canView(user, doc, libraries) {
    if (!user || !doc) return false;
    const libs = libraries == null ? librariesFromStore() : libraries;
    const L = AOS.libraries;
    if (doc.libraryId && libs && L && typeof L.byId === 'function') {
      const library = L.byId(libs, doc.libraryId);
      if (library) {
        if (levelRank(user.clearance) < levelRank(library.level)) return false;
        return !!(L.canRead && L.canRead(library, user));
      }
    }
    return canViewLegacy(user, doc);
  }

  function flagOrLegacy(policy, key, legacyObjectAnyTrue, defaultValue) {
    if (!policy) return defaultValue;
    const v = policy[key];
    if (typeof v === 'boolean') return v;
    if (v && typeof v === 'object') return Object.keys(v).some(k => v[k] === true) || legacyObjectAnyTrue;
    return defaultValue;
  }

  function publicEgressAllowed(policy) {
    return flagOrLegacy(policy, 'publicToExternal', false, true);
  }

  function internalEgressAllowed(policy) {
    return flagOrLegacy(policy, 'internalToExternal', false, false);
  }

  function egressAllowed(level, org, policy) {
    if (level === 'public') return publicEgressAllowed(policy);
    if (level === 'internal') return internalEgressAllowed(policy);
    return false;
  }

  function partitionForModel(docs, zone, org, policy) {
    if (zone === 'internal') return { allowed: docs.slice(), blocked: [] };
    const allowed = [], blocked = [];
    docs.forEach(doc => (egressAllowed(doc.level, org, policy) ? allowed : blocked).push(doc));
    return { allowed, blocked };
  }

  function effectiveTools(agent, scope, phase, catalog) {
    const groups = SCOPE_GROUPS[scope] || [];
    const disabled = new Set(agent.toolDisabled || []);
    return (agent.tools || []).filter(id => {
      if (disabled.has(id)) return false;
      const tool = catalog.find(t => t.id === id);
      if (!tool || tool.phase > phase) return false;
      return tool.group === 'none' || groups.includes(tool.group);
    });
  }

  const isLocked = agent => Array.isArray(agent.allowedModels) && agent.allowedModels.length === 1 && agent.allowedModels[0] === 'internal';

  function findSensitive(text, words) {
    const hit = (words || []).find(w => w && String(text || '').includes(w));
    return hit || null;
  }

  function egressNote(policy) {
    const pub = publicEgressAllowed(policy);
    const inn = internalEgressAllowed(policy);
    if (pub && inn) return '公开、内部资料可发送；秘密及以上资料会被拦截';
    if (pub) return '只发送公开资料；内部及以上资料会被拦截';
    if (inn) return '只发送内部资料；公开与秘密及以上资料会被拦截';
    return '公开与内部资料均禁止发送；秘密及以上资料也会被拦截';
  }

  function dataFlow(zone, scope, org, policy) {
    const usesInternal = scope === 'internal' || scope === 'all';
    const usesPublic = scope === 'public' || scope === 'all';
    if (zone === 'internal') {
      return {
        tone: 'internal', egress: usesPublic, needsConfirm: false,
        source: scopeLabel(scope), target: '内网模型',
        note: usesPublic ? '资料由内网模型处理；联网检索只发送关键词' : '全程在厂内网络处理，不出网'
      };
    }
    if (!usesInternal) {
      return {
        tone: 'external', egress: true, needsConfirm: false, source: scopeLabel(scope), target: '外网模型',
        note: publicEgressAllowed(policy) ? '经出口网关访问外网模型，全量审计' : '公开资料按策略禁止发给外网模型；联网检索仍经出口网关'
      };
    }
    return {
      tone: 'warn', egress: true, needsConfirm: true, source: scopeLabel(scope), target: '外网模型',
      note: egressNote(policy)
    };
  }

  AOS.policy = { LEVELS, SCOPES, ZONES, levelRank, levelLabel, scopeLabel, zoneLabel, canView, publicEgressAllowed, internalEgressAllowed, egressAllowed, partitionForModel, effectiveTools, isLocked, findSensitive, dataFlow };
})(typeof window !== 'undefined' ? window : globalThis);
