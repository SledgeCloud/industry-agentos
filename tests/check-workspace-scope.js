const fs=require('fs'),vm=require('vm'),assert=require('assert/strict');
const html=fs.readFileSync('dist/aiops-extensions.html','utf8'),script=html.match(/<script>([\s\S]*?)<\/script>/)[1];
const start=script.indexOf('const workspaceScenes=['),end=script.indexOf('function pop(e,items)',start),nodes=new Map();
const node=key=>{if(!nodes.has(key))nodes.set(key,{innerHTML:'',textContent:'',value:'',disabled:false,focus(){},classList:{add(){}}});return nodes.get(key)};
const sandbox={state:{folders:{workspace:['关账审核智能体']}},DEFAULT_WORKSPACE:'默认工作区',$:node,esc:s=>String(s).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c])),icon:()=>'',document:{querySelectorAll:()=>[]},modal(title,body,footer){node('#overlay').innerHTML=body+footer},closeModal(){node('#overlay').innerHTML=''},nav(){},toast(message){sandbox.lastToast=message}};
vm.createContext(sandbox);vm.runInContext(script.slice(start,end),sandbox);
const run=code=>vm.runInContext(code,sandbox),read=code=>JSON.parse(run(`JSON.stringify(${code})`));
run("addFolder('workspace')");assert(node('#workspaceCreate').disabled);assert.equal(node('#workspaceSelectionCount').textContent,'已选 0 个场景 · 0 个 Agent · 0 个本体对象集');
for(const [scene,objects] of [['sales',['客户对象集','销售订单对象集']],['procurement',['供应商对象集','采购订单对象集']],['finance',['财务报表对象集','会计凭证对象集']]]){
 run(`state.workspaceDraft.scene='${scene}';renderWorkspaceScope()`);for(const label of objects)assert(node('#workspaceScope').innerHTML.includes('选择 本体对象集 '+label));assert(node('#workspaceScope').innerHTML.includes('选择 Agent '));
}
run("toggleWorkspaceAssets('sales-customers')");assert(!node('#workspaceCreate').disabled);assert.equal(node('#workspaceSelectionCount').textContent,'已选 1 个场景 · 0 个 Agent · 1 个本体对象集');assert.deepEqual(read('state.workspaceDraft.agentIds'),[]);
run("state.workspaceDraft.scene='sales';renderWorkspaceScope()");assert(node('#workspaceScope').innerHTML.includes('aria-label="选择场景 销售"  data-partial="true"'));assert(node('#workspaceScope').innerHTML.includes('aria-label="选择 本体对象集 客户对象集" checked'));
run("toggleWorkspaceAssets('procurement-plan')");assert.equal(node('#workspaceSelectionCount').textContent,'已选 2 个场景 · 1 个 Agent · 1 个本体对象集');
run("toggleWorkspaceAssets(workspaceSceneItems(workspaceScenes[0]).map(item=>item.id).join(','))");assert.equal(run('state.workspaceDraft.agentIds.length'),4);assert.equal(run('state.workspaceDraft.ontologyIds.length'),2);
run("toggleWorkspaceAssets(workspaceSceneItems(workspaceScenes[0]).map(item=>item.id).join(','))");assert.deepEqual(read('state.workspaceDraft.agentIds'),['procurement-plan']);assert.deepEqual(read('state.workspaceDraft.ontologyIds'),[]);
run('workspaceScopeBulk(true)');assert.equal(node('#workspaceSelectionCount').textContent,'已选 3 个场景 · 7 个 Agent · 6 个本体对象集');assert.equal(run('new Set(workspaceChosenIds()).size'),13);run('workspaceScopeBulk(false)');assert(node('#workspaceCreate').disabled);
node('#workspaceName').value='空选择';run("saveFolder('workspace')");assert.equal(sandbox.lastToast,'请选择 Agent 或本体对象集');assert.equal(run('state.folders.workspace.length'),1);
run("toggleWorkspaceAssets('finance-vouchers')");node('#workspaceName').value='  财务凭证工作区  ';run("saveFolder('workspace')");assert.deepEqual(read('state.workspaceConfigs[0]'),{name:'财务凭证工作区',sceneIds:['finance'],agentIds:[],ontologyIds:['finance-vouchers']});assert.equal(node('#overlay').innerHTML,'');
run("addFolder('workspace');toggleWorkspaceAssets('sales-customers,procurement-plan,procurement-supplier-set')");node('#workspaceName').value='跨场景工作区';run("saveFolder('workspace')");assert.deepEqual(read('state.workspaceConfigs[1]'),{name:'跨场景工作区',sceneIds:['sales','procurement'],agentIds:['procurement-plan'],ontologyIds:['sales-customers','procurement-supplier-set']});
run("addFolder('workspace');toggleWorkspaceAssets('finance-review')");node('#workspaceName').value='Agent工作区';run("saveFolder('workspace')");assert.deepEqual(read('state.workspaceConfigs[2].ontologyIds'),[]);assert.deepEqual(read('state.workspaceConfigs[2].agentIds'),['finance-review']);
run("addFolder('workspace');toggleWorkspaceAssets('finance-statements')");node('#workspaceName').value='跨场景工作区';run("saveFolder('workspace')");assert.equal(sandbox.lastToast,'工作区名称已存在');assert.equal(run('state.workspaceConfigs.length'),3);
run("addFolder('workspace');toggleWorkspaceAssets('invalid-id')");assert.deepEqual(read('workspaceChosenIds()'),[]);assert(node('#workspaceCreate').disabled);
console.log('Passed: ontology sets in all three scenes; mixed and ontology-only selection; scene all/partial states; cross-scene selection persistence; full select/clear; separate Agent/object-set counts; saved sceneIds, agentIds and ontologyIds; existing Agent-only flow and validation.');
