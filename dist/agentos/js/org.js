/* AgentOS · 企业角色与功能权限 */
(function (root) {
  const AOS = root.AOS || (root.AOS = {});
  const PERMS = {
    ORG_MANAGE: 'org.manage',
    ROLE_MANAGE: 'role.manage',
    KB_CREATE: 'kb.create'
  };
  const SEED_DEPARTMENTS = [
    { id: 'dept-iron', name: '炼铁技术中心' },
    { id: 'dept-tech', name: '科技管理部' },
    { id: 'dept-intel', name: '科技情报室' },
    { id: 'dept-it', name: '信息中心' },
    { id: 'dept-bf', name: '高炉车间' },
    { id: 'dept-sinter', name: '烧结车间' }
  ];
  const SEED_ROLES = [
    {
      id: 'role-admin', name: '企业管理员', description: '管理通讯录、角色，并可新建知识库',
      permissions: [PERMS.ORG_MANAGE, PERMS.ROLE_MANAGE, PERMS.KB_CREATE], dataScope: 'enterprise'
    },
    {
      id: 'role-member', name: '普通成员', description: '使用平台与被授权的知识库',
      permissions: [], dataScope: 'enterprise'
    }
  ];
  function roleById(roles, id) { return (roles || []).find(r => r.id === id); }
  function userHasPerm(user, roles, perm) {
    const ids = (user && user.roleIds) || [];
    return ids.some(rid => {
      const r = roleById(roles, rid);
      return r && Array.isArray(r.permissions) && r.permissions.includes(perm);
    });
  }
  AOS.org = { PERMS, SEED_ROLES, SEED_DEPARTMENTS, roleById, userHasPerm };
})(typeof window !== 'undefined' ? window : globalThis);
