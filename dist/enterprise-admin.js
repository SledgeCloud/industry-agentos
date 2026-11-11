/* Screenshot-led enterprise administration. Session-scoped Mock data; no service calls. */
(() => {
  'use strict';
  const $ = s => document.querySelector(s);
  const esc = v => String(v ?? '').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const clone = v => JSON.parse(JSON.stringify(v));
  const uid = () => 'mock-' + Date.now().toString(36) + '-' + Math.random().toString(36).slice(2,7);
  const store = EnterpriseProfile.store;
  const isSpace = document.body.dataset.enterprisePage === 'space';
  const userIcon = '<svg class="ea-user-icon" viewBox="0 0 20 20" aria-hidden="true"><circle cx="10" cy="5.5" r="3"/><path d="M3.5 17v-2.5a3 3 0 0 1 3-3h7a3 3 0 0 1 3 3V17z"/></svg>';
  const cube = '<svg viewBox="0 0 20 20" aria-hidden="true"><path d="m10 2 7 4v8l-7 4-7-4V6zM3 6l7 4 7-4M10 10v8"/></svg>';
  const folder = '<svg viewBox="0 0 20 20" aria-hidden="true"><rect x="3" y="4" width="14" height="12" rx="1"/><path d="M3 8h14M7 11h6"/></svg>';
  const warning = '<span class="ea-warning" title="包含成员单独调整的权限" aria-label="包含成员单独调整的权限">!</span>';
  const people = [
    ['feng','Feng Zhu','feng.zhu@inspiregroup.com','空间管理员'],['qian','Qian Yan','qian.yan@inspiregroup.com','空间所有者'],
    ['zhenyu','Zhenyu Su','zhenyu.su@inspiregroup.com','空间管理员'],['lu','Lu Li','lu.li@inspiregroup.com','空间管理员'],
    ['renyong','Renyong Wang','renyong.wang@inspiregroup.com','空间管理员'],['xiaochen','Xiaochen Yu','xiaochen.yu@inspiregroup.com','空间管理员'],
    ['jianxin','Jianxin Zhong','jxzhong@inspiregroup.com','空间管理员'],['hao','Hao Zhang','hao.zhang1@inspiregroup.com','空间管理员'],
    ['qianyi','Qianyi Xu','qianyi.xu@inspiregroup.com','空间管理员'],['yadu','雅迪 杜','yddu@inspiregroup.com','空间成员'],['kai','kai wang','kai.wang@inspiregroup.com','空间成员']
  ].map(([id,name,email,role],i)=>({id,name,email,role,color:i%3}));
  const space = store.get('space', {members:people,admins:[]});
  const objectNames = ['营销活动','顾客','经销商','库存记录','订单','订单明细','付款记录','商品','地区','销售人员','售后工单'];
  const objectDescriptions = [
    '围绕新品上市、节庆销售、区域促销和经销商激励开展的营销活动，可能面向不同顾客群体。',
    '购买或使用集团商品的个人或组织，是需求和服务关系的主体，可能直接向集团购买。',
    '与集团签约并在一定地区或渠道内经营商品、服务客户的合作组织，包括区域经销商。',
    '某个商品在某个仓库中的可用、占用库存及补货背景，随采购到货、销售出库而变化。',
    '客户或经销商发起的交易事实，是销售与履约过程的业务主线，连接顾客、商品和交付。',
    '订单中涉及的具体商品及交易数量，是订单与商品之间的业务连接；同一订单可有多条。',
    '与订单相关的收款或结算事实；付款可能由客户直接完成，也可能由经销商代付。',
    '集团可采购、销售、库存、交付和提供售后服务的具体可经营商品，来自多个产品线。',
    '集团进行市场覆盖、经销授权、客户归属、仓储服务和经营分析的地理范围。',
    '负责区域、经销商、重点客户或销售机会的集团员工，归属区域团队，承担销售目标。',
    '客户在订单交付后针对商品或服务提出的问题及处理过程，覆盖退货、换货和维修。'
  ];
  const item = (id,name,objects) => ({id,name,...(objects?{objects}: {})});
  const catalog = [
    {id:'tt',name:'tt又mm',groups:[]}, {id:'mm',name:'mm又tt',groups:[]},
    {id:'marketing',name:'华岚智配集团营销管理智能体',groups:[
      {id:'ontology',name:'本体',items:[item('huatlan','华岚智配集团经营本体对象集',objectNames.map((name,i)=>({id:'obj-'+i,name,description:objectDescriptions[i]})))]},
      {id:'mcp',name:'工具（MCP）',items:[item('graph','Ontology Graph Operator'),item('logs','Ontology Execution Logs'),item('rules','Ontology Rules Actions')]},
      {id:'knowledge',name:'知识库',items:[item('marketing-kb','集团营销知识库')]}
    ]},
    {id:'draft',name:'测试不发布的agent',groups:[]},
    {id:'modeling',name:'本体建模智能体',groups:[
      {id:'skill',name:'技能（Skill）',items:[item('object-build','ontology-object-build'),item('mcp-guide','ontology-mcp-guide'),item('rule-build','ontology-rule-build'),item('ontology-build','ontology-build')]},
      {id:'mcp',name:'工具（MCP）',items:[item('copilot','本体Copilot助手')]}
    ]},
    {id:'replenish',name:'分仓智能补货Agent',groups:[
      {id:'ontology',name:'本体',items:[item('stock','库存与补货本体对象集',[{id:'warehouse',name:'仓库',description:'库存所属仓库及服务区域。'},{id:'inventory',name:'库存',description:'商品的可用库存及在途数量。'}])]},
      {id:'skill',name:'技能（Skill）',items:[item('restock-plan','智能补货计划')]},
      {id:'mcp',name:'工具（MCP）',items:[item('stock-query','Inventory Query')]},
      {id:'knowledge',name:'知识库',items:[item('stock-policy','补货策略知识库')]}
    ]},
    ...store.get('workshop',[])
  ];
  const keyOf = (a,g,i) => a.id + '/' + g.id + '/' + i.id;
  const resources = a => a.groups.flatMap(g=>g.items.map(i=>({agent:a,group:g,item:i,key:keyOf(a,g,i)})));
  const allResources = () => catalog.flatMap(resources);
  const objectPermissions = [{key:'read',label:'读取'},{key:'write',label:'写入'},{key:'approve',label:'审批'}];
  const freshGrant = i => ({enabled:true,...(i.objects?.length?{objects:Object.fromEntries(i.objects.map(o=>[o.id,Object.fromEntries(objectPermissions.map(p=>[p.key,true]))]))}:{})});
  const grantAll = a => Object.fromEntries(resources(a).map(r=>[r.key,freshGrant(r.item)]));
  const reviewer = {...grantAll(catalog[2]),...grantAll(catalog[4])};
  delete reviewer['marketing/knowledge/marketing-kb'];
  const initialRoles = ['企业管理员','kk','Nex-销售','营销策划','客服管理员','Nex-订单审核员','业务分析师'].map((name,i)=>({id:['admin','kk','sales','marketing-role','service','reviewer','analyst'][i],name,system:i===0,grants:i===0?{}:i===5?clone(reviewer):i===3?grantAll(catalog[2]):i===4?grantAll(catalog[5]):{}}));
  const initialMembers = [
    {id:'feng',name:'Feng Zhu',email:'feng.zhu@inspiregroup.com',roleId:'admin'},
    {id:'jinggg',name:'jinggg prx',email:'jinggg@prx.com',roleId:'marketing-role'},
    {id:'simon',name:'simon edg',email:'simon@edg.com',roleId:'marketing-role'},
    {id:'forsaken',name:'forsaken prx',email:'forsaken@prx.com',roleId:'service',overrides:{'replenish/knowledge/stock-policy':null}},
    {id:'d4v41',name:'d4v41 prx',email:'d4v41@prx.com',roleId:'analyst',overrides:{'marketing/mcp/graph':{enabled:true}}},
    {id:'suiyu',name:'隋 玉',email:'nex.suiyu@nex.com',roleId:'reviewer'},
    {id:'nex-admin',name:'Nex Administrator',email:'nex.admin@example.test',roleId:'reviewer'},
    {id:'lilu',name:'Lu Li',email:'lilu@nex.com',roleId:'sales',overrides:{'marketing/mcp/logs':{enabled:true}}}
  ].map((m,i)=>({...m,color:i%3,overrides:m.overrides||{}}));
  const org = store.get('organization',{roles:initialRoles,members:initialMembers,security:{}});
  // Administrator selection is the only handoff from enterprise space to organization.
  for (const admin of space.admins) {
    const existing=org.members.find(m=>m.id===admin.id);
    if(existing){existing.roleId='admin';existing.overrides={}}else org.members.push({...admin,roleId:'admin',overrides:{}});
  }
  const state = {page:isSpace?'fde':'members',query:'',role:'reviewer',tab:'permissions',collapsed:{},editing:null,securityAgent:'tt',securityDraft:null};
  let activeModal=null, modalReturnFocus=null, drop=null, toastTimer;
  const roleById = id => org.roles.find(r=>r.id===id);
  const memberById = id => org.members.find(m=>m.id===id);
  function saveSpace(){store.set('space',space)}
  function saveOrg(){store.set('organization',org)}
  function effective(m){const role=roleById(m.roleId);if(role?.system)return Object.fromEntries(allResources().map(r=>[r.key,freshGrant(r.item)]));const grants=clone(role?.grants||{});for(const [k,v] of Object.entries(m.overrides||{})){if(v===null)delete grants[k];else grants[k]=clone(v)}return grants}
  function grantsForRole(r){return r.system?Object.fromEntries(allResources().map(a=>[a.key,freshGrant(a.item)])):r.grants}
  const hasOverrides = m => Object.keys(m.overrides||{}).length>0;
  function toast(msg){clearTimeout(toastTimer);$('#ea-toast').textContent=msg;toastTimer=setTimeout(()=>$('#ea-toast').textContent='',2800)}
  function button(text,act,primary=false,other=''){return `<button type="button" class="ea-btn${primary?' primary':''}" onclick="EA.${act}" ${other}>${text}</button>`}
  function search(placeholder){return `<div class="ea-search"><input aria-label="${placeholder}" placeholder="${placeholder}" value="${esc(state.query)}" oninput="EA.search(this.value)"><svg viewBox="0 0 20 20"><circle cx="8.5" cy="8.5" r="5.5"/><path d="m13 13 4 4"/></svg></div>`}
  function empty(label,large=false){return `<div class="ea-empty${large?' long':''}"><svg viewBox="0 0 48 48" aria-hidden="true"><path d="m11 17 5-7h16l5 7 6 14v9H5v-9zM5 31h12l3 5h8l3-5h12M21 3v5M32 4l-3 5M13 4l4 5"/></svg><span>${esc(label)}</span></div>`}
  function person(m,i,actions=''){return `<div class="ea-member" data-member-id="${esc(m.id)}"><span class="ea-initial c${m.color??i%3}">${esc(m.name[0].toUpperCase())}</span><div><div class="ea-person">${esc(m.name)}${m.id==='feng'?'<span class="ea-self">（我）</span>':''}</div><div class="ea-email">${esc(m.email)}</div></div><div class="ea-member-actions">${actions}</div></div>`}
  function navItem(id,name,disabled=false){return `<button class="ea-nav-item${state.page===id?' active':''}" ${disabled?'disabled title="数据权限暂不做"':`onclick="EA.navigate('${id}')"`}>${name}</button>`}
  function sidebar(){
    if(isSpace)return `<button class="ea-nav-group open" aria-expanded="true" onclick="EA.toggleGroup(this)">${folder}FDE成员管理<span class="ea-caret"></span></button><div>${navItem('fde','FDE成员')}</div><button class="ea-nav-group${state.page==='admins'?' open':''}" aria-expanded="true" onclick="EA.toggleGroup(this)">${cube}企业组织管理<span class="ea-caret"></span></button><div>${navItem('admins','企业管理员')}</div>`;
    return `<button class="ea-nav-group open" aria-expanded="true" onclick="EA.toggleGroup(this)">${cube}组织管理<span class="ea-caret"></span></button><div>${navItem('members','成员管理')}${navItem('roles','角色管理')}${navItem('permissions','权限管理')}${navItem('data','数据管理',true)}${navItem('security','安全管理')}</div>`;
  }
  function breadcrumb(){
    const names={fde:['FDE成员管理','FDE成员'],admins:['企业组织管理','企业管理员'],members:['组织管理','成员管理'],roles:['组织管理','角色管理'],permissions:['组织管理','权限管理'],security:['组织管理','安全管理']};
    const n=names[state.page];let suffix='';
    if(state.editing)suffix=' / 编辑'+esc(state.editing.name)+'权限';
    if(state.page==='security'&&state.securityDraft)suffix=' / 编辑安全管控';
    return `${n[0]} / <b>${n[1]}${suffix}</b>`;
  }
  function render(){
    closeDropdown();$('#ea-sidebar').innerHTML=sidebar();$('#ea-breadcrumb').innerHTML=breadcrumb();
    $('#ea-content').innerHTML=state.editing?editPage():state.page==='permissions'?permissionsPage():state.page==='security'?securityPage():listPage();
    syncChecks();
  }
  function listBody(){
    const q=state.query.toLowerCase();
    if(state.page==='roles')return org.roles.filter(r=>r.name.toLowerCase().includes(q)).map(r=>`<div class="ea-role-row"><span class="ea-role-name">${userIcon}${esc(r.name)}</span>${r.system?'':`<div class="ea-actions"><button class="ea-text" onclick="EA.roleDialog('${r.id}')">编辑</button><button class="ea-text red" onclick="EA.deleteRole('${r.id}')">删除</button></div>`}</div>`).join('')||empty('暂无匹配的角色');
    const list=(state.page==='fde'?space.members:state.page==='admins'?space.admins:org.members).filter(m=>(m.name+' '+m.email+' '+(m.phone||'')).toLowerCase().includes(q));
    if(!list.length)return empty(q?'暂无匹配的成员':state.page==='admins'?'暂无企业管理员':'暂无成员');
    return list.map((m,i)=>{
      let actions='';
      if(state.page==='fde')actions=`<button class="ea-text" ${m.role==='空间所有者'?'disabled':`onclick="EA.memberMenu('${m.id}',this)"`}>${esc(m.role)}${m.role==='空间所有者'?'':'<span class="ea-down"></span>'}</button>`;
      else if(state.page==='admins')actions=`<span class="ea-text">企业管理员</span><button class="ea-text red" onclick="EA.removeAdmin('${m.id}')">移除</button>`;
      else {const role=roleById(m.roleId);actions=`<button class="ea-text" ${role?.system?'disabled':`onclick="EA.memberMenu('${m.id}',this)"`}>${hasOverrides(m)?warning:''}${esc(role?.name||'未分配角色')}${role?.system?'':'<span class="ea-down"></span>'}</button>`}
      return person(m,i,actions);
    }).join('');
  }
  function listPage(){
    const roles=state.page==='roles',admins=state.page==='admins';
    const count=roles?org.roles.length:state.page==='fde'?space.members.length:admins?space.admins.length:org.members.length;
    return `<section class="ea-surface"><div class="ea-toolbar"><strong>${roles?'角色列表':admins?'企业管理员列表':'成员列表'}<span class="ea-count">共 ${count} ${roles?'个':'人'}</span></strong><div class="ea-actions">${search(roles?'搜索角色名称':'搜索姓名、手机号或邮箱')}${button(`<span class="ea-plus">＋</span>${roles?'新建角色':admins?'邀请管理员':'邀请成员'}`,roles?'roleDialog()':'invite()',true)}</div></div><div class="ea-list" id="ea-list-body">${listBody()}</div></section>`;
  }
  function summary(grants){
    const cards=catalog.map(a=>{
      const enabled=resources(a).filter(r=>grants[r.key]?.enabled);
      if(!enabled.length&&!grants['agent:'+a.id]?.enabled)return '';
      return `<article class="ea-agent-card${state.collapsed[a.id]?' collapsed':''}"><div class="ea-agent-title"><button aria-label="${state.collapsed[a.id]?'展开':'收起'}${esc(a.name)}" aria-expanded="${!state.collapsed[a.id]}" onclick="EA.collapse('${a.id}')">${state.collapsed[a.id]?'▶':'▼'}</button>${esc(a.name)}</div>${a.groups.map(g=>{const items=g.items.filter(i=>grants[keyOf(a,g,i)]?.enabled);return items.length?`<div class="ea-resource-group"><h3>${g.name}</h3><div class="ea-pills">${items.map(i=>{const grant=grants[keyOf(a,g,i)];const counts=i.objects?.length?i.objects.reduce((n,o)=>n+objectPermissions.filter(p=>grant.objects?.[o.id]?.[p.key]).length,0):null;return `<span class="ea-pill" title="${counts===null?'已授权':`对象读取/写入/审批授权 ${counts} 项`}">${esc(i.name)}</span>`}).join('')}</div></div>`:''}).join('')}</article>`;
    }).join('');
    return cards||empty('暂无权限，请点击“编辑权限”配置',true);
  }
  function roleMembers(){const members=org.members.filter(m=>m.roleId===state.role);return `<div class="ea-list">${members.map((m,i)=>person(m,i,`${hasOverrides(m)?'<span class="ea-note">已单独调整</span>':'<span class="ea-inherit">继承角色权限</span>'}<button class="ea-text" onclick="EA.editMember('${m.id}')">调整权限</button>`)).join('')||empty('该角色暂无成员')}</div>`}
  function permissionsPage(){
    const roles=org.roles.filter(r=>!r.system);if(!roles.some(r=>r.id===state.role))state.role=roles[0]?.id;
    const role=roleById(state.role);
    return `<section class="ea-surface ea-permissions"><aside class="ea-role-nav" aria-label="选择权限角色">${roles.map(r=>`<button class="ea-role-choice${r.id===state.role?' active':''}" onclick="EA.selectRole('${r.id}')">${userIcon}<span>${esc(r.name)}</span>${org.members.some(m=>m.roleId===r.id&&hasOverrides(m))?warning:''}</button>`).join('')}</aside><div class="ea-permission-main"><div class="ea-tabs" role="tablist"><button role="tab" aria-selected="${state.tab==='permissions'}" class="${state.tab==='permissions'?'active':''}" onclick="EA.tab('permissions')">角色权限配置</button><button role="tab" aria-selected="${state.tab==='people'}" class="${state.tab==='people'?'active':''}" onclick="EA.tab('people')">角色包含人员</button></div><div class="ea-permission-body">${role?`<div class="ea-toolbar"><h2>${esc(role.name)}</h2>${state.tab==='permissions'?button('编辑权限',`editRole('${role.id}')`,true):''}</div>${state.tab==='people'?roleMembers():summary(grantsForRole(role))}`:empty('请先创建角色',true)}</div></div></section>`;
  }
  function agentStats(a,grants){
    const rs=resources(a),count=rs.filter(r=>grants[r.key]?.enabled).length;
    const partialObjects=rs.some(r=>{const v=grants[r.key];return v?.enabled&&r.item.objects?.length&&r.item.objects.some(o=>objectPermissions.some(p=>!v.objects?.[o.id]?.[p.key]))});
    const total=rs.length;
    if(!total)return {count:grants['agent:'+a.id]?.enabled?1:0,total:0,status:grants['agent:'+a.id]?.enabled?'full':'none'};
    return {count,total,status:!count?'none':count===total&&!partialObjects?'full':'partial'};
  }
  function editPage(){
    const e=state.editing,a=catalog.find(a=>a.id===e.agent)||catalog[0];
    return `<section class="ea-surface ea-edit-surface"><div class="ea-edit-head"><h1>编辑权限 - ${esc(e.name)}</h1><div class="ea-actions">${button('取消','cancelEdit()')}${button('完成','saveEdit()',true)}</div></div><div class="ea-edit-grid"><aside class="ea-agent-nav"><div class="ea-column-label">Agent 配置</div>${catalog.map(agent=>{const st=agentStats(agent,e.grants);return `<div class="ea-agent-option${agent.id===a.id?' active':''}" role="button" tabindex="0" aria-label="配置 ${esc(agent.name)}" onclick="EA.selectAgent('${agent.id}')" onkeydown="if(event.key==='Enter'||event.key===' '){event.preventDefault();EA.selectAgent('${agent.id}')}"><input type="checkbox" aria-label="授权 ${esc(agent.name)}" data-agent-check="${agent.id}" ${st.status==='full'?'checked':''} onclick="event.stopPropagation()" onkeydown="event.stopPropagation()" onchange="EA.toggleAgent('${agent.id}',this.checked)"><div><strong>${esc(agent.name)}</strong>${st.count&&st.total?`<div class="ea-agent-meta">已选 ${st.count} 项 / 共 ${st.total} 项</div>`:''}<div class="ea-agent-status ${st.status}">${st.status==='full'?'全部授权':st.status==='partial'?'部分授权':'未授权'}</div></div></div>`}).join('')}</aside><div class="ea-resource-editor"><div class="ea-column-label">权限配置 - ${esc(a.name)}</div>${e.kind==='member'?`<div class="ea-override-note"><span>默认继承「${esc(roleById(memberById(e.id).roleId).name)}」的权限；本次仅调整 ${esc(e.name)}。</span><button class="ea-text" onclick="EA.resetInheritance()">恢复角色权限</button></div>`:''}${!a.groups.length?`<div class="ea-empty long">${esc(a.name)}无任何可配置权限项</div>`:a.groups.map(g=>`<div class="ea-resource-group"><label class="ea-check-title"><input type="checkbox" aria-label="授权全部${g.name}" data-group-check="${g.id}" ${g.items.every(i=>e.grants[keyOf(a,g,i)]?.enabled)?'checked':''} onchange="EA.toggleGroupResources('${a.id}','${g.id}',this.checked)">${g.name}</label>${g.items.map(i=>{const k=keyOf(a,g,i),checked=e.grants[k]?.enabled;return `<div class="ea-check-pill"><label><input type="checkbox" aria-label="授权 ${esc(i.name)}" ${checked?'checked':''} onchange="EA.toggleResource('${k}',this.checked)"> ${esc(i.name)}</label>${i.objects?.length?`<button ${checked?'':'disabled'} onclick="EA.objectDialog('${k}')">详细配置</button>`:''}</div>`}).join('')}</div>`).join('')}</div></div></section>`;
  }
  function syncChecks(){
    if(!state.editing)return;
    document.querySelectorAll('[data-agent-check]').forEach(el=>el.indeterminate=agentStats(catalog.find(a=>a.id===el.dataset.agentCheck),state.editing.grants).status==='partial');
    const a=catalog.find(a=>a.id===state.editing.agent);
    document.querySelectorAll('[data-group-check]').forEach(el=>{const g=a.groups.find(g=>g.id===el.dataset.groupCheck),n=g.items.filter(i=>state.editing.grants[keyOf(a,g,i)]?.enabled).length;el.indeterminate=n>0&&n<g.items.length});
  }
  const defaultSecurity=()=>({input:true,output:true,injection:true,token:true,maxToken:8192,upload:true});
  function securityCurrent(){return (state.securityDraft||org.security)[state.securityAgent]||defaultSecurity()}
  function securitySwitch(k,label){const s=securityCurrent();return `<div class="ea-security-field"><label>${label}<span class="ea-info" title="${label}的 Mock 安全管控配置">ⓘ</span></label><button type="button" class="ea-switch" role="switch" aria-label="${label}" aria-checked="${s[k]}" ${state.securityDraft?`onclick="EA.securityToggle('${k}')"`:'disabled'}>${s[k]?'已开启':'已关闭'}<i></i></button></div>`}
  function securityPage(){return `<section class="ea-surface ea-edit-surface"><div class="ea-edit-head"><h2>${state.securityDraft?'编辑安全管控':'安全管控'}</h2><div class="ea-actions">${state.securityDraft?button('取消','securityCancel()')+button('完成','securitySave()',true):button('编辑安全管控','securityEdit()',true)}</div></div><div class="ea-security-grid"><aside class="ea-security-nav" aria-label="选择安全管控 Agent">${catalog.map(a=>`<button title="${esc(a.name)}" class="${state.securityAgent===a.id?'active':''}" onclick="EA.securitySelect('${a.id}')">${esc(a.name)}</button>`).join('')}</aside><div class="ea-security-content"><div class="ea-security-card"><h3>输入输出安全检测</h3><div class="ea-security-fields">${securitySwitch('input','输入通用检测')}${securitySwitch('output','输出通用检测')}${securitySwitch('injection','提示词注入')}<div></div>${securitySwitch('token','Token 限制')}<div class="ea-security-field"><label for="ea-max-token">最大 Token 数量</label><input id="ea-max-token" type="number" min="1" max="2000000" step="1" value="${securityCurrent().maxToken}" ${!state.securityDraft||!securityCurrent().token?'disabled':''} onchange="EA.securityToken(this.value)"></div></div></div><div class="ea-security-card upload"><h3>文件上传审查</h3>${securitySwitch('upload','基础校验')}</div></div></div></section>`}
  function modal(title,body,footer,wide=false){
    if(!activeModal)modalReturnFocus=document.activeElement;
    activeModal={title};EnterpriseProfile.close();closeDropdown();
    $('#ea-overlay').innerHTML=`<div class="ea-modal-backdrop" onclick="if(event.target===this)EA.closeModal()"><section class="ea-modal${wide?' wide':''}" role="dialog" aria-modal="true" aria-labelledby="ea-modal-title"><div class="ea-modal-head"><h2 id="ea-modal-title">${esc(title)}</h2><button class="ea-modal-close" aria-label="关闭弹窗" onclick="EA.closeModal()">×</button></div><div class="ea-modal-body">${body}</div><div class="ea-modal-foot">${footer}</div></section></div>`;
    $('#ea-overlay input:not(:disabled),#ea-overlay button')?.focus();
  }
  function closeModal(){activeModal=null;$('#ea-overlay').innerHTML='';modalReturnFocus?.isConnected&&modalReturnFocus.focus();modalReturnFocus=null}
  function error(msg){let el=$('#ea-modal-error');if(!el){el=document.createElement('div');el.id='ea-modal-error';el.className='ea-field-error';el.setAttribute('role','alert');$('.ea-modal-body').append(el)}el.textContent=msg}
  function closeDropdown(){drop?.remove();drop=null}
  function dropdown(anchor,body){closeDropdown();drop=document.createElement('div');drop.className='ea-dropdown';drop.setAttribute('role','menu');drop.innerHTML=body;document.body.append(drop);const rect=anchor.getBoundingClientRect();drop.style.right=Math.max(8,innerWidth-rect.right)+'px';drop.style.top=Math.min(rect.bottom+4,innerHeight-drop.offsetHeight-10)+'px';drop.querySelector('button')?.focus()}
  let invitation=null, objectDraft=null;
  function invite(){
    invitation={mode:state.page,selected:[],query:''};
    modal(state.page==='admins'?'邀请企业管理员':'邀请成员',`<div class="ea-search"><input id="ea-invite-query" autocomplete="off" aria-label="输入姓名、手机号或邮箱" placeholder="输入姓名、手机号或邮箱" oninput="EA.inviteSearch(this.value)"><svg viewBox="0 0 20 20"><circle cx="8.5" cy="8.5" r="5.5"/><path d="m13 13 4 4"/></svg></div><div class="ea-candidates" id="ea-candidates"></div>${state.page==='members'?`<div class="ea-field" style="margin-top:14px"><label for="ea-invite-role">分配角色</label><select id="ea-invite-role">${org.roles.filter(r=>!r.system).map(r=>`<option value="${r.id}">${esc(r.name)}</option>`).join('')}</select></div>`:''}`,button('邀请','confirmInvite()',true,'id="ea-invite-submit" disabled'));
    $('#ea-invite-query').focus();
  }
  function inviteResults(){
    const q=invitation.query.toLowerCase().trim();
    const pool=invitation.mode==='members'?[...space.members,...initialMembers.filter(m=>!space.members.some(p=>p.id===m.id))]:space.members;
    const existing=invitation.mode==='admins'?space.admins:invitation.mode==='members'?org.members:space.members;
    let matches=pool.filter(m=>!existing.some(e=>e.id===m.id||e.email.toLowerCase()===m.email.toLowerCase())&&(m.name+' '+m.email+' '+(m.phone||'')).toLowerCase().includes(q));
    if(!q)matches=[];
    if(!matches.length&&q&&invitation.mode!=='admins'&&/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(q)&&!existing.some(m=>m.email.toLowerCase()===q))matches=[{id:'invite-email',name:invitation.query.split('@')[0],email:invitation.query,color:1}];
    invitation.matches=matches;
    $('#ea-candidates').innerHTML=matches.map((m,i)=>`<label class="ea-candidate"><span class="ea-initial c${m.color??i%3}">${esc(m.name[0].toUpperCase())}</span><span>${esc(m.name)}<span class="ea-email" style="display:block">${esc(m.email)}</span></span><input type="checkbox" aria-label="选择 ${esc(m.name)}" ${invitation.selected.includes(m.id)?'checked':''} onchange="EA.inviteSelect('${m.id}',this.checked)"></label>`).join('')||(q?`<p class="ea-note">${invitation.mode==='admins'?'未找到可邀请成员，请搜索空间内成员。':'未找到可邀请成员，可输入新成员邮箱。'}</p>`:'');
    $('#ea-invite-submit').disabled=!invitation.selected.length;
  }
  function roleDialog(id){
    const role=roleById(id);if(role?.system)return;
    modal(role?'编辑角色':'新建角色',`<div class="ea-field"><label for="ea-role-name">角色名称</label><input id="ea-role-name" placeholder="请输入角色名称" maxlength="40" value="${esc(role?.name||'')}"></div>`,button('取消','closeModal()')+button('确定',`saveRole('${id||''}')`,true));$('#ea-role-name').focus();
  }
  function edit(kind,id){const target=kind==='role'?roleById(id):memberById(id);if(!target||target.system||kind==='member'&&roleById(target.roleId)?.system)return;state.page='permissions';state.editing={kind,id,name:target.name,grants:clone(kind==='role'?target.grants:effective(target)),agent:catalog[0].id};render()}
  function toggleResource(key,checked){const r=allResources().find(r=>r.key===key);if(!r)return;if(checked)state.editing.grants[key]=state.editing.grants[key]||freshGrant(r.item);else delete state.editing.grants[key]}
  function securityEnsure(){if(!state.securityDraft[state.securityAgent])state.securityDraft[state.securityAgent]=defaultSecurity();return state.securityDraft[state.securityAgent]}
  function objectTable(){
    const rs=allResources().find(r=>r.key===objectDraft.key);
    return `<p class="ea-note ea-object-help">审批：可审批该对象类型实例数据的新增、修改。</p><div class="ea-table-box"><table class="ea-object-table"><thead><tr><th>对象名称</th><th>对象描述</th>${objectPermissions.map(({key,label})=>`<th scope="col" class="ea-permission-column"><label><input type="checkbox" aria-label="全部${label}" data-object-all="${key}" ${rs.item.objects.every(o=>objectDraft.values[o.id]?.[key])?'checked':''} onchange="EA.objectAll('${key}',this.checked)"><span>${label}</span></label></th>`).join('')}</tr></thead><tbody>${rs.item.objects.map(o=>`<tr><td>${esc(o.name)}</td><td title="${esc(o.description)}">${esc(o.description)}</td>${objectPermissions.map(({key,label})=>`<td class="ea-permission-column"><input type="checkbox" aria-label="${esc(o.name)}${label}" data-object-row="${o.id}" data-object-permission="${key}" ${objectDraft.values[o.id]?.[key]?'checked':''} onchange="EA.objectChange('${o.id}','${key}',this.checked)"></td>`).join('')}</tr>`).join('')}</tbody></table></div>`;
  }
  function syncObjectChecks(){for(const {key} of objectPermissions){const el=$(`[data-object-all="${key}"]`),values=Object.values(objectDraft.values),count=values.filter(v=>v[key]).length;el.checked=count===values.length;el.indeterminate=count>0&&count<values.length}document.querySelectorAll('[data-object-row]').forEach(el=>el.checked=objectDraft.values[el.dataset.objectRow][el.dataset.objectPermission])}
  const API={
    render,closeModal,invite,roleDialog,
    toggleGroup(button){const expanded=button.getAttribute('aria-expanded')==='true';button.setAttribute('aria-expanded',String(!expanded));button.nextElementSibling.hidden=expanded},
    navigate(page){if(isSpace&&!['fde','admins'].includes(page)||!isSpace&&!['members','roles','permissions','security'].includes(page))return;state.page=page;state.query='';state.editing=null;state.securityDraft=null;render()},
    search(query){state.query=query;$('#ea-list-body').innerHTML=listBody()},
    collapse(id){state.collapsed[id]=!state.collapsed[id];render()},
    selectRole(id){state.role=id;render()},tab(tab){state.tab=tab;render()},
    inviteSearch(query){invitation.query=query;invitation.selected=[];inviteResults()},
    inviteSelect(id,checked){invitation.selected=invitation.selected.filter(i=>i!==id);if(checked)invitation.selected.push(id);$('#ea-invite-submit').disabled=!invitation.selected.length},
    confirmInvite(){
      const picks=invitation.matches.filter(m=>invitation.selected.includes(m.id));if(!picks.length)return error('请选择需要邀请的成员');
      if(invitation.mode==='members'&&!roleById($('#ea-invite-role').value))return error('请先创建并选择角色');
      for(const pick of picks){const m={...pick,id:pick.id==='invite-email'?uid():pick.id};
        if(invitation.mode==='admins'){space.admins.push(m);const current=memberById(m.id);if(current){current.roleId='admin';current.overrides={}}else org.members.push({...m,roleId:'admin',overrides:{}})}
        else if(invitation.mode==='fde')space.members.push({...m,role:'空间成员'});
        else org.members.push({...m,roleId:$('#ea-invite-role').value,overrides:{}});
      }
      saveSpace();saveOrg();closeModal();render();toast('已邀请 '+picks.length+' 位'+(invitation.mode==='admins'?'企业管理员':'成员')+'（Mock）');
    },
    memberMenu(id,anchor){
      if(isSpace){const m=space.members.find(m=>m.id===id);if(m.role==='空间所有者')return;dropdown(anchor,['空间管理员','空间成员'].map(role=>`<button class="${m.role===role?'active':''}" onclick="EA.setSpaceRole('${id}','${role}')">${role}</button>`).join(''));return}
      const m=memberById(id);if(roleById(m.roleId)?.system)return;
      dropdown(anchor,org.roles.filter(r=>!r.system).map(r=>`<button class="${m.roleId===r.id?'active':''}" onclick="EA.setMemberRole('${id}','${r.id}')">${esc(r.name)}</button>`).join('')+`<hr><button onclick="EA.editMember('${id}')">单独调整权限</button>${hasOverrides(m)?`<button onclick="EA.clearMemberOverride('${id}')">恢复角色权限</button>`:''}`);
    },
    setSpaceRole(id,role){const m=space.members.find(m=>m.id===id);if(m&&m.role!=='空间所有者'){m.role=role;saveSpace();render();toast('已更新空间角色（Mock）')}},
    setMemberRole(id,roleId){const m=memberById(id);if(!m||roleById(m.roleId)?.system||roleById(roleId)?.system)return;if(m.roleId===roleId){closeDropdown();return}m.roleId=roleId;m.overrides={};saveOrg();render();toast('已变更角色，成员继承新角色权限（Mock）')},
    removeAdmin(id){const m=space.admins.find(m=>m.id===id);if(!m)return;modal('移除企业管理员',`<p>确认移除 ${esc(m.name)} 的企业管理员身份？</p>`,button('取消','closeModal()')+button('确定',`confirmRemoveAdmin('${id}')`,true))},
    confirmRemoveAdmin(id){space.admins=space.admins.filter(m=>m.id!==id);const m=memberById(id);if(m&&id!=='feng'){m.roleId=org.roles.find(r=>!r.system)?.id||'';m.overrides={}}saveSpace();saveOrg();closeModal();render();toast('已移除企业管理员（Mock）')},
    saveRole(id){const name=$('#ea-role-name').value.trim();if(!name)return error('请输入角色名称');if(org.roles.some(r=>r.id!==id&&r.name.toLowerCase()===name.toLowerCase()))return error('角色名称已存在');const r=roleById(id);if(r?.system)return;if(r)r.name=name;else org.roles.push({id:uid(),name,system:false,grants:{}});saveOrg();closeModal();render();toast('已保存角色（Mock）')},
    deleteRole(id){const role=roleById(id);if(!role||role.system)return;const n=org.members.filter(m=>m.roleId===id).length;modal('删除角色',`<p>${n?`该角色包含 ${n} 位成员，请先调整这些成员的角色后再删除。`:`确认删除角色「${esc(role.name)}」？`}</p>`,n?button('知道了','closeModal()',true):button('取消','closeModal()')+button('删除',`confirmDeleteRole('${id}')`,true))},
    confirmDeleteRole(id){if(roleById(id)?.system||org.members.some(m=>m.roleId===id))return;org.roles=org.roles.filter(r=>r.id!==id);saveOrg();closeModal();render();toast('已删除角色（Mock）')},
    editRole(id){edit('role',id)},editMember(id){edit('member',id)},
    cancelEdit(){state.editing=null;render()},
    saveEdit(){const e=state.editing;if(e.kind==='role')roleById(e.id).grants=clone(e.grants);else{const m=memberById(e.id),base=grantsForRole(roleById(m.roleId)),diff={};for(const k of new Set([...Object.keys(base),...Object.keys(e.grants)])){if(JSON.stringify(base[k])!==JSON.stringify(e.grants[k]))diff[k]=e.grants[k]?clone(e.grants[k]):null}m.overrides=diff;state.role=m.roleId;state.tab='people'}saveOrg();state.editing=null;render();toast('已保存权限（Mock）')},
    selectAgent(id){state.editing.agent=id;render()},
    toggleAgent(id,checked){const a=catalog.find(a=>a.id===id);state.editing.agent=id;if(!resources(a).length){if(checked)state.editing.grants['agent:'+id]={enabled:true};else delete state.editing.grants['agent:'+id]}else resources(a).forEach(r=>{if(checked)state.editing.grants[r.key]=freshGrant(r.item);else delete state.editing.grants[r.key]});render()},
    toggleGroupResources(aid,gid,checked){const a=catalog.find(a=>a.id===aid),g=a.groups.find(g=>g.id===gid);g.items.forEach(i=>{const k=keyOf(a,g,i);if(checked)state.editing.grants[k]=freshGrant(i);else delete state.editing.grants[k]});render()},
    toggleResource(key,checked){toggleResource(key,checked);render()},
    resetInheritance(){const m=memberById(state.editing.id);state.editing.grants=clone(grantsForRole(roleById(m.roleId)));render();toast('已恢复角色权限，点击完成后生效')},
    clearMemberOverride(id){memberById(id).overrides={};saveOrg();render();toast('已恢复角色权限（Mock）')},
    objectDialog(key){const rs=allResources().find(r=>r.key===key);if(!rs||!state.editing.grants[key]?.enabled)return;const values=state.editing.grants[key].objects||{};objectDraft={key,values:Object.fromEntries(rs.item.objects.map(o=>[o.id,{read:false,write:false,approve:false,...clone(values[o.id]||{})}]))};modal(rs.item.name+' 详细配置',objectTable(),button('取消','closeModal()')+button('确定','objectSave()',true),true);syncObjectChecks()},
    objectChange(id,k,checked){objectDraft.values[id][k]=checked;if(k==='write'&&checked)objectDraft.values[id].read=true;if(k==='read'&&!checked)objectDraft.values[id].write=false;syncObjectChecks()},
    objectAll(k,checked){for(const v of Object.values(objectDraft.values)){v[k]=checked;if(k==='write'&&checked)v.read=true;if(k==='read'&&!checked)v.write=false}syncObjectChecks()},
    objectSave(){state.editing.grants[objectDraft.key].objects=clone(objectDraft.values);closeModal();render()},
    securitySelect(id){state.securityAgent=id;render()},
    securityEdit(){state.securityDraft=clone(org.security);render()},
    securityCancel(){state.securityDraft=null;render()},
    securityToggle(k){const s=securityEnsure();s[k]=!s[k];render()},
    securityToken(value){securityEnsure().maxToken=Number(value)},
    securitySave(){for(const config of Object.values(state.securityDraft)){if(!Number.isInteger(config.maxToken)||config.maxToken<1||config.maxToken>2000000){toast('最大 Token 数量须为 1 至 2000000 的整数');return}}org.security=clone(state.securityDraft);saveOrg();state.securityDraft=null;render();toast('已保存安全管控（Mock）')},
    // Narrow model projection used by the contract check; does not call external services.
    model:{catalog,space,org,state,effective,agentStats,resources,allResources,grantsForRole}
  };
  window.EA=API;
  document.addEventListener('click',e=>{if(drop&&!e.target.closest('.ea-dropdown')&&!e.target.closest('.ea-member-actions'))closeDropdown()});
  document.addEventListener('keydown',e=>{
    if(e.key==='Escape'){if(activeModal)closeModal();else closeDropdown()}
    if(e.key==='Enter'&&activeModal&&e.target.id==='ea-role-name'){e.preventDefault();$('.ea-modal-foot .primary').click()}
    if(e.key==='Tab'&&activeModal){const els=[...document.querySelectorAll('.ea-modal button:not(:disabled),.ea-modal input:not(:disabled),.ea-modal select:not(:disabled)')],first=els[0],last=els.at(-1);if(e.shiftKey&&document.activeElement===first){e.preventDefault();last.focus()}else if(!e.shiftKey&&document.activeElement===last){e.preventDefault();first.focus()}}
  });
  window.addEventListener('resize',closeDropdown);
  $('#ea-back').href=new URLSearchParams(location.search).get('from')==='new-aiops.html'?'new-aiops.html':'index.html';
  $('#ea-back').onclick=e=>{
    if(window.parent!==window&&window.parent.EnterpriseProfile?.closeAdministration){e.preventDefault();window.parent.EnterpriseProfile.closeAdministration();return}
    const depth=Number(new URLSearchParams(location.search).get('returnDepth'));
    if(Number.isInteger(depth)&&depth>0&&depth<101&&window.history.length>depth){e.preventDefault();window.history.go(-depth)}
  };
  render();
})();
