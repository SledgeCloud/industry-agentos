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

  function canView(user, doc) {
    if (levelRank(doc.level) > levelRank(user.clearance)) return false;
    return !doc.acl || doc.acl.length === 0 || doc.acl.includes(user.dept);
  }

  function egressAllowed(level, org, policy) {
    if (level === 'public') return true;
    if (level === 'internal') return Boolean(policy && policy.internalToExternal && policy.internalToExternal[org] === true);
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
    return (agent.tools || []).filter(id => {
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

  function dataFlow(zone, scope, org, policy) {
    const usesInternal = scope === 'internal' || scope === 'all';
    const usesPublic = scope === 'public' || scope === 'all';
    const internalOut = egressAllowed('internal', org, policy);
    if (zone === 'internal') {
      return {
        tone: 'internal', egress: usesPublic, needsConfirm: false,
        source: scopeLabel(scope), target: '内网模型',
        note: usesPublic ? '资料由内网模型处理；联网检索只发送关键词' : '全程在厂内网络处理，不出网'
      };
    }
    if (!usesInternal) {
      return { tone: 'external', egress: true, needsConfirm: false, source: scopeLabel(scope), target: '外网模型', note: '经出口网关访问外网模型，全量审计' };
    }
    return {
      tone: 'warn', egress: true, needsConfirm: true, source: scopeLabel(scope), target: '外网模型',
      note: internalOut ? '公开、内部资料可发送；秘密及以上资料会被拦截' : '只发送公开资料；内部及以上资料会被拦截'
    };
  }

  AOS.policy = { LEVELS, SCOPES, ZONES, levelRank, levelLabel, scopeLabel, zoneLabel, canView, egressAllowed, partitionForModel, effectiveTools, isLocked, findSensitive, dataFlow };
})(typeof window !== 'undefined' ? window : globalThis);
