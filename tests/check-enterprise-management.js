// Behavioral contracts for the local enterprise Mock, independent of the old/new Ops state.
const fs=require('fs'),vm=require('vm'),assert=require('assert');
const source=fs.readFileSync('dist/enterprise-admin.js','utf8');
const plain=v=>JSON.parse(JSON.stringify(v));
function fixture(page='organization',saved={}){
 const nodes=new Map();
 const node=key=>{if(!nodes.has(key))nodes.set(key,{innerHTML:'',textContent:'',value:'',disabled:false,isConnected:true,dataset:{},focus(){},remove(){},append(){},querySelector(){return node('child')},querySelectorAll(){return []},getBoundingClientRect(){return {right:1100,bottom:100}},setAttribute(){}});return nodes.get(key)};
 const document={body:{dataset:{enterprisePage:page},append(){}},activeElement:node('focus'),querySelector:node,querySelectorAll(){return []},addEventListener(){},createElement:()=>node('created')};
 const context=vm.createContext({console,document,window:{addEventListener(){}},EnterpriseProfile:{store:{get:(k,d)=>saved[k]?plain(saved[k]):plain(d),set:(k,v)=>saved[k]=plain(v)},close(){}},URLSearchParams,location:{search:'?from=new-aiops.html'},innerHeight:900,innerWidth:1280,setTimeout(){},clearTimeout(){}});
 vm.runInContext(source,context);
 const api=context.window.EA;return {api,m:api.model,n:node,saved};
}
const f=fixture(),{api,m,n}=f;
assert.equal(m.org.members.length,8);assert.equal(m.org.roles.length,7);
assert.equal(m.catalog.length,6);assert(n('#ea-content').innerHTML.includes('共 8 人'));
assert.equal(n('#ea-back').href,'new-aiops.html');
assert(n('#ea-sidebar').innerHTML.includes('disabled title="数据权限暂不做"'));
api.navigate('admins');assert.equal(m.state.page,'members','Organization cannot route to enterprise-space admin screens');
api.navigate('permissions');
assert.equal(m.agentStats(m.catalog[2],m.org.roles.find(r=>r.id==='reviewer').grants).status,'partial');
assert.equal(m.agentStats(m.catalog[4],m.org.roles.find(r=>r.id==='reviewer').grants).status,'full');

const reviewer=m.org.roles.find(r=>r.id==='reviewer'),member=m.org.members.find(m=>m.id==='suiyu'),other=m.org.members.find(m=>m.id==='nex-admin');
const initial=plain(reviewer.grants);
api.editRole('reviewer');api.toggleAgent('replenish',true);
assert.equal(m.agentStats(m.catalog[5],m.state.editing.grants).status,'full');
api.cancelEdit();assert.deepEqual(plain(reviewer.grants),initial,'Cancel must discard all role changes');

api.editRole('reviewer');api.toggleResource('marketing/knowledge/marketing-kb',true);api.saveEdit();
assert(m.effective(member)['marketing/knowledge/marketing-kb']);
assert(m.effective(other)['marketing/knowledge/marketing-kb'],'Role changes propagate to all inherited members');
api.editMember(member.id);api.toggleResource('marketing/knowledge/marketing-kb',false);api.saveEdit();
assert.equal(member.overrides['marketing/knowledge/marketing-kb'],null);
assert(!m.effective(member)['marketing/knowledge/marketing-kb']);
assert(m.effective(other)['marketing/knowledge/marketing-kb'],'Member adjustments cannot mutate peers');
assert(reviewer.grants['marketing/knowledge/marketing-kb'],'Member adjustments cannot mutate their role');
api.editRole('reviewer');api.toggleResource('modeling/skill/object-build',false);api.saveEdit();
assert(!m.effective(member)['modeling/skill/object-build'],'Non-overridden resources keep inheriting role updates');
assert(!m.effective(member)['marketing/knowledge/marketing-kb'],'Explicit member overrides survive role changes');
api.clearMemberOverride(member.id);assert(m.effective(member)['marketing/knowledge/marketing-kb']);assert.deepEqual(plain(member.overrides),{});

// Object detail edits are staged independently; writing requires reading.
api.editRole('reviewer');api.selectAgent('marketing');
const ontologyKey='marketing/ontology/huatlan';
api.objectDialog(ontologyKey);api.objectChange('obj-0','read',false);api.closeModal();
assert(m.state.editing.grants[ontologyKey].objects['obj-0'].read,'Cancel object modal must preserve staged role permissions');
api.objectDialog(ontologyKey);api.objectChange('obj-0','read',false);api.objectSave();
assert.equal(m.state.editing.grants[ontologyKey].objects['obj-0'].write,false);
assert.equal(m.agentStats(m.catalog[2],m.state.editing.grants).status,'partial');
api.objectDialog(ontologyKey);api.objectChange('obj-0','write',true);api.objectSave();
assert.equal(m.state.editing.grants[ontologyKey].objects['obj-0'].read,true);
api.toggleGroupResources('marketing','mcp',false);assert(!m.state.editing.grants['marketing/mcp/graph']);
api.toggleGroupResources('marketing','mcp',true);assert(m.state.editing.grants['marketing/mcp/graph']);
api.toggleAgent('tt',true);assert.equal(m.agentStats(m.catalog[0],m.state.editing.grants).status,'full');
api.cancelEdit();

// Approval is per object type, independent of instance writing, inherited and persisted.
const approval=fixture(),ap=approval.api,am=approval.m;
const approvalRole=am.org.roles.find(r=>r.id==='reviewer'),approvalMember=am.org.members.find(m=>m.id==='suiyu');
ap.editRole('reviewer');ap.objectDialog(ontologyKey);
assert(approval.n('#ea-overlay').innerHTML.includes('全部审批'));
assert(!approval.n('#ea-overlay').innerHTML.includes('<br>'),'Permission labels must remain horizontal');
ap.objectAll('approve',false);ap.objectChange('obj-0','approve',true);
assert.equal(approval.n('[data-object-all="approve"]').indeterminate,true);
ap.objectSave();ap.saveEdit();
assert.equal(approvalRole.grants[ontologyKey].objects['obj-0'].approve,true);
assert.equal(approvalRole.grants[ontologyKey].objects['obj-1'].approve,false);
assert.equal(approvalRole.grants[ontologyKey].objects['obj-1'].write,true,'Removing approval cannot revoke writing');
assert.equal(am.effective(approvalMember)[ontologyKey].objects['obj-0'].approve,true);
ap.editMember(approvalMember.id);ap.objectDialog(ontologyKey);ap.objectChange('obj-1','approve',true);ap.objectSave();ap.saveEdit();
assert.equal(am.effective(approvalMember)[ontologyKey].objects['obj-1'].approve,true);
assert.equal(approvalRole.grants[ontologyKey].objects['obj-1'].approve,false,'Member approval cannot change role approval');
assert.equal(am.effective(am.org.members.find(m=>m.id==='nex-admin'))[ontologyKey].objects['obj-1'].approve,false);
ap.editRole('reviewer');ap.objectDialog(ontologyKey);ap.objectAll('approve',true);ap.closeModal();ap.saveEdit();
assert.equal(approvalRole.grants[ontologyKey].objects['obj-1'].approve,false,'Cancel approval modal discards changes');
const approvalReload=fixture('organization',approval.saved);
assert.equal(approvalReload.m.effective(approvalReload.m.org.members.find(m=>m.id==='suiyu'))[ontologyKey].objects['obj-1'].approve,true);
ap.clearMemberOverride(approvalMember.id);assert.equal(am.effective(approvalMember)[ontologyKey].objects['obj-1'].approve,false);
ap.editRole('reviewer');ap.toggleAgent('replenish',true);
assert.equal(am.state.editing.grants['replenish/ontology/stock'].objects.warehouse.approve,true,'Agent all-grant includes approval');

// Previously saved read/write settings do not acquire approval implicitly.
const legacyOrg=plain(am.org);for(const r of legacyOrg.roles)for(const g of Object.values(r.grants))for(const o of Object.values(g.objects||{}))delete o.approve;
const legacy=fixture('organization',{organization:legacyOrg});legacy.api.editRole('reviewer');legacy.api.objectDialog(ontologyKey);legacy.api.objectSave();
assert.equal(legacy.m.state.editing.grants[ontologyKey].objects['obj-0'].approve,false);
assert.equal(legacy.m.state.editing.grants[ontologyKey].objects['obj-0'].read,true);

// Names, protected roles and in-use role deletion.
api.navigate('roles');n('#ea-role-name').value='  测试角色  ';api.saveRole('');
const created=m.org.roles.find(r=>r.name==='测试角色');assert(created);
n('#ea-role-name').value='测试角色';const roleCount=m.org.roles.length;api.saveRole('');assert.equal(m.org.roles.length,roleCount);
api.confirmDeleteRole('reviewer');assert(m.org.roles.some(r=>r.id==='reviewer'),'Cannot delete a role with members');
api.confirmDeleteRole('admin');assert(m.org.roles.some(r=>r.id==='admin'),'System administrator role is protected');
api.confirmDeleteRole(created.id);assert(!m.org.roles.some(r=>r.id===created.id));
api.editRole('admin');assert.equal(m.state.editing,null);

// Role reassignment resets member differences and leaves the old role and peers alone.
api.setMemberRole('lilu','reviewer');assert.equal(m.org.members.find(m=>m.id==='lilu').roleId,'reviewer');
assert.deepEqual(plain(m.org.members.find(m=>m.id==='lilu').overrides),{});
api.setMemberRole('feng','reviewer');assert.equal(m.org.members[0].roleId,'admin');

// Safety configuration drafts remain per-Agent and support cancel/save.
api.navigate('security');api.securityEdit();api.securityToggle('input');api.securityToken('4096');api.securitySelect('mm');api.securityToggle('output');api.securitySave();
assert.equal(m.org.security.tt.input,false);assert.equal(m.org.security.tt.maxToken,4096);assert.equal(m.org.security.mm.output,false);
api.securityEdit();api.securityToggle('output');api.securityCancel();assert.equal(m.org.security.mm.output,false);
api.securityEdit();api.securityToken('0');api.securitySave();assert(m.state.securityDraft,'Invalid Token values cannot be saved');api.securityCancel();

// Separate screens share only the administrator handoff and workshop Mock catalog.
const s=fixture('space'),sa=s.api,sm=s.m;
assert.equal(sm.space.members.length,11);assert.equal(sm.space.admins.length,0);
assert(!s.n('#ea-sidebar').innerHTML.includes('权限管理'));
sa.navigate('permissions');assert.equal(sm.state.page,'fde');
sa.navigate('admins');sa.invite();sa.inviteSearch('Qian Yan');sa.inviteSelect('qian',true);sa.confirmInvite();
assert.equal(sm.space.admins.length,1);assert.equal(sm.org.members.find(m=>m.id==='qian').roleId,'admin');
const o=fixture('organization',s.saved);assert.equal(o.m.org.members.find(m=>m.id==='qian').roleId,'admin');
assert(!o.n('#ea-sidebar').innerHTML.includes('FDE成员管理'));
sa.confirmRemoveAdmin('qian');assert.equal(sm.space.admins.length,0);assert.notEqual(sm.org.members.find(m=>m.id==='qian').roleId,'admin');
sa.navigate('fde');sa.setSpaceRole('kai','空间管理员');assert.equal(sm.space.members.find(m=>m.id==='kai').role,'空间管理员');
sa.setSpaceRole('qian','空间成员');assert.equal(sm.space.members.find(m=>m.id==='qian').role,'空间所有者');
sa.invite();sa.inviteSearch('new.fde@example.test');sa.inviteSelect('invite-email',true);sa.confirmInvite();assert(sm.space.members.some(m=>m.email==='new.fde@example.test'));
const imported=fixture('organization',{workshop:[{id:'workshop-custom',name:'新打造Agent',groups:[{id:'ontology',name:'本体',items:[{id:'o',name:'新本体对象集',objects:[]}]}]}]});
assert(imported.m.catalog.some(a=>a.name==='新打造Agent'));
imported.api.editRole('reviewer');imported.api.toggleAgent('workshop-custom',true);imported.api.saveEdit();assert(imported.m.org.roles.find(r=>r.id==='reviewer').grants['workshop-custom/ontology/o']);

for(const file of ['index.html','aiops-extensions.html']){
 const html=fs.readFileSync('dist/'+file,'utf8');assert(html.includes('data-enterprise-profile'));assert(html.includes('enterprise-profile.js'));assert(html.includes('enterprise-profile.css'));
 for(const script of html.matchAll(/<script>([\s\S]*?)<\/script>/g))new vm.Script(script[1]);
}
const entry=fs.readFileSync('dist/new-aiops.html','utf8');
for(const target of ['enterprise-space.html','enterprise-organization.html'])assert(entry.includes('data-admin="'+target+'"'));
assert(entry.includes('aiops/integration.js'));
console.log('Passed: isolated space/org navigation; shared identity entrypoints; roles and guarded CRUD; Agent/resource authorization; inherited roles with per-member differences; horizontal object read/write/approval columns; per-object approval, column selection, inheritance, member isolation, persistence, cancellation and legacy compatibility; per-Agent security drafts; administrator invitation/removal handoff; workshop asset snapshot; old/new inline script syntax.');
