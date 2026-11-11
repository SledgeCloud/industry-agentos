/* Scene-scoped evaluation workspace. Local interactive Mock; no model/API calls. */
'use strict';
const evState={scene:'sales',tab:'评测实验',suiteId:null,suiteTab:'评测用例',search:'',agentIds:[],objectIds:[],scopeOpen:false,copilot:null};
const evWorkspace={id:'public',name:'公共空间',applications:[
  {id:'sales-app',name:'销售管理',sceneIds:['sales'],agent:{id:'sales-app-agent',name:'销售管理应用 Agent'}},
  {id:'procurement-app',name:'采购管理',sceneIds:['procurement'],agent:{id:'procurement-app-agent',name:'采购管理应用 Agent'}}
]};
const evCatalog={};
function evData(){
  if(evState.scene!==studio.scene){if(typeof evDisposeTaskTest==='function')evDisposeTaskTest();evState.scene=studio.scene;evState.tab='评测实验';evState.suiteId=null;evState.suiteTab='评测用例';evState.search='';evState.agentIds=[];evState.objectIds=[];evState.scopeOpen=false;evState.copilot=null;evClearFilters();if(typeof evAssetState!=='undefined')Object.assign(evAssetState,{suiteSearch:'',caseSearch:'',caseTag:'',caseStatus:'active',picker:null,import:null});}
  return evCatalog[studio.scene]||(evCatalog[studio.scene]=evSeedScene(studio.scene));
}
function evApplication(){return evWorkspace.applications.find(a=>a.sceneIds.includes(studio.scene));}
function evAgents(){let app=evApplication();return [...(waCatalog[studio.scene]||[]).map(a=>({...a,scene:studio.scene,scope:'scene',application:app.id})),{...app.agent,scene:studio.scene,scope:'application',application:app.id}];}
function evAgentName(id){return evAgents().find(a=>a.id===id)?.name||'Agent 已移除';}
function evObjects(){return wiObjects().map(o=>({...o,agentIds:evAgents().map(a=>a.id)}));}
function evId(kind){let d=evData();return d.prefix+'-'+({task:'BT',suite:'ES',case:'EC'}[kind])+'-'+String(++d.sequence[kind]).padStart(3,'0');}
function evFilteredTasks(){let d=evData(),allowed=new Set(evAgents().map(a=>a.id));if(evState.objectIds.length){let sets=evObjects().filter(o=>evState.objectIds.includes(o.id));allowed=new Set(sets.flatMap(o=>o.agentIds));}return d.tasks.filter(t=>allowed.has(t.agentId)&&(!evState.agentIds.length||evState.agentIds.includes(t.agentId)));}
function evRender(){if(typeof evExperimentCloseOutput==='function')evExperimentCloseOutput();evCloseMoreMenu();render();if(typeof evExperimentRefreshIssueDrawer==='function')evExperimentRefreshIssueDrawer();}
function evField(label,control,hint='',required=true){const tag=control.includes('class="ev-multiselect' )?'div':'label';return `<${tag} class="ont-field ev-field"><span>${label}${required?'<i class="ont-required">*</i>':''}</span>${control}${hint?`<small>${hint}</small>`:''}</${tag}>`;}
// Shared list filters stay separate from scene resource data.
const evListFilters={};
function evClearFilters(kind){if(kind)evListFilters[kind]={};else Object.keys(evListFilters).forEach(k=>delete evListFilters[k]);}
function evFilterMatch(kind,key,value){const selected=evListFilters[kind]?.[key]||[];return !selected.length||(Array.isArray(value)?value:[value]).some(v=>selected.includes(String(v)));}
function evFilterChange(kind,key,value,checked){const state=evListFilters[kind]||(evListFilters[kind]={}),prior=state[key]||[];state[key]=checked?[...new Set([...prior,String(value)])]:prior.filter(v=>v!==String(value));evRefreshList(kind);}
function evFilterReset(kind,key,node){if(evListFilters[kind])delete evListFilters[kind][key];node.closest('details')?.querySelectorAll('input').forEach(i=>i.checked=false);evRefreshList(kind);}
function evFilterHeader(label,kind,key,options){const selected=evListFilters[kind]?.[key]||[];return `<details class="ev-column-filter"><summary aria-label="筛选${esc(label)}">${esc(label)}<svg viewBox="0 0 16 16" width="12" height="12" aria-hidden="true"><path d="M2 3h12L9 9v4l-2-1V9z"/></svg></summary><div class="ev-choice-popover" data-ev-popover role="group" aria-label="${esc(label)}筛选选项"><header><b>${esc(label)}</b><button type="button" class="ont-link" onclick="evFilterReset('${kind}','${key}',this)">清空</button></header>${options.map(o=>`<label><input type="checkbox" aria-label="筛选${esc(label)}：${esc(o.name)}" ${selected.includes(String(o.id))?'checked':''} onchange="evFilterChange('${kind}','${key}',${esc(JSON.stringify(String(o.id)))},this.checked)"><span>${esc(o.name)}</span></label>`).join('')||'<p class="muted">暂无可选项</p>'}</div></details>`;}
function evRefreshList(kind){evCloseMoreMenu();if(kind==='experimentIssue'){evExperimentIssuesRefresh();return;}if(kind==='experimentResult'){evExperimentRefreshResults();return;}const views={task:()=>evTasksView(),suite:()=>evSuitesView(),case:()=>evCasesView(),experiment:()=>evExperimentsView(),evaluator:()=>evEvaluatorsView()},ids={task:'ev-task-results',suite:'ev-suite-results',case:'ev-case-results',experiment:'ev-experiment-list',evaluator:'ev-evaluator-list'};const root=document.getElementById(ids[kind])||document.querySelector?.('.ev-content'),current=root?.querySelector?.('.ev-table-content');if(!current||!document.createElement){evRender();return;}const staging=document.createElement('div');staging.innerHTML=views[kind]();const next=staging.querySelector('.ev-table-content'),oldBody=current.querySelector('tbody'),newBody=next?.querySelector('tbody');if(!oldBody||!newBody){evRender();return;}oldBody.innerHTML=newBody.innerHTML;root.querySelectorAll('[data-ev-dashboard-scope]').forEach(old=>{const nextDashboard=[...staging.querySelectorAll('[data-ev-dashboard-scope]')].find(item=>item.dataset.evDashboardScope===old.dataset.evDashboardScope);if(nextDashboard)old.outerHTML=nextDashboard.outerHTML;});const oldFooter=current.querySelector('.ev-table-footer'),newFooter=next.querySelector('.ev-table-footer');if(oldFooter&&newFooter)oldFooter.innerHTML=newFooter.innerHTML;if(kind==='experiment'&&typeof evExperimentRefreshDashboard==='function')evExperimentRefreshDashboard();}
function evMultiSelect({name,label,options=[],selected=[],onchange='',searchable=false,searchPlaceholder=''}){
  const searchLabel='搜索'+label.replace(/^请选择|^选择/,'');
  const search=searchable?`<div class="ev-multiselect-search"><label class="ont-search"><input type="search" aria-label="${esc(searchLabel)}" placeholder="${esc(searchPlaceholder||searchLabel)}" oninput="evMultiSelectSearch(this)"><svg viewBox="0 0 18 18"><circle cx="7" cy="7" r="5"/><path d="m11 11 4 4"/></svg></label></div>`:'';
  return `<details class="ev-multiselect"><summary class="ev-multiselect-trigger" aria-label="${esc(label)}"><span data-ev-selected-label>${esc(selected.length?options.filter(o=>selected.includes(o.id)).map(o=>o.name).join('、'):/^请|^选择/.test(label)?label:'请选择'+label)}</span>${evDropdownArrow()}</summary><div class="ev-choice-popover" data-ev-popover role="group" aria-label="${esc(label)}选项">${search}${options.map(o=>`<label class="${o.disabled?'disabled':''}" data-ev-option data-ev-search-text="${esc([o.id,o.name,o.description||''].join(' ').toLowerCase())}"><input type="checkbox" name="${esc(name)}" value="${esc(o.id)}" aria-label="${esc(label)}：${esc(o.name)}" ${selected.includes(o.id)?'checked':''} ${o.disabled?'disabled':''} onchange="evMultiSelectChanged(this);${onchange}"><span>${esc(o.name)}${o.description?`<small>${esc(o.description)}</small>`:''}</span></label>`).join('')||'<p class="muted">暂无可选项</p>'}${searchable?`<p class="muted ev-multiselect-empty" data-ev-search-empty hidden>暂无匹配的${esc(label.replace(/^请选择|^选择/,''))}</p>`:''}</div></details>`;
}
function evMultiSelectSearch(input){
  const menu=input.closest('.ev-multiselect');if(!menu)return;const q=input.value.trim().toLowerCase();let count=0;
  menu.querySelectorAll('[data-ev-option]').forEach(option=>{const match=!q||(option.getAttribute('data-ev-search-text')||'').includes(q);option.hidden=!match;if(match)count++;});
  const empty=menu.querySelector('[data-ev-search-empty]');if(empty)empty.hidden=!!count;
  evPositionPopover(menu);
}

function evMultiSelectChanged(node){const menu=node.closest('.ev-multiselect'),label=menu?.querySelector('[data-ev-selected-label]');if(label){const checked=[...menu.querySelectorAll('input:checked')];label.textContent=checked.length?checked.map(i=>i.parentElement.querySelector('span')?.firstChild?.textContent||i.value).join('、'):menu.querySelector('summary').getAttribute('aria-label');}}
let evDrawerObserver=null,evDrawerTreeObserver=null,evDrawerPanel=null;
function evReleaseDrawer(){evDrawerObserver?.disconnect();evDrawerTreeObserver?.disconnect();evDrawerObserver=null;evDrawerTreeObserver=null;evDrawerPanel=null;}
function evSyncDrawerBounds(){const panel=document.getElementById('studio-panel-gui'),backdrop=document.querySelector('.ev-backdrop');if(!panel||!backdrop||!panel.getBoundingClientRect)return;if(evDrawerObserver&&panel!==evDrawerPanel){evDrawerObserver.disconnect();evDrawerObserver.observe(panel);evDrawerPanel=panel;}const rect=panel.getBoundingClientRect();Object.entries({'--ev-panel-left':rect.left+'px','--ev-panel-top':rect.top+'px','--ev-panel-width':rect.width+'px','--ev-panel-height':rect.height+'px'}).forEach(([k,v])=>backdrop.style.setProperty(k,v));}
function evObserveDrawer(){evReleaseDrawer();const panel=document.getElementById('studio-panel-gui'),app=document.getElementById('app');if(typeof ResizeObserver!=='undefined'&&panel){evDrawerObserver=new ResizeObserver(evSyncDrawerBounds);evDrawerObserver.observe(panel);evDrawerPanel=panel;}if(typeof MutationObserver!=='undefined'&&app){evDrawerTreeObserver=new MutationObserver(evSyncDrawerBounds);evDrawerTreeObserver.observe(app,{childList:true,subtree:true});}evSyncDrawerBounds();}
let evModalReturnFocus=null;
let evAnnotationUnderlay=null,evAnnotationReturnView=null;
function evAnnotationIcon(){return '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M12.586 2.586A2 2 0 0 0 11.172 2H4a2 2 0 0 0-2 2v7.172a2 2 0 0 0 .586 1.414l8.704 8.704a2.426 2.426 0 0 0 3.42 0l6.58-6.58a2.426 2.426 0 0 0 0-3.42z"/><circle cx="7.5" cy="7.5" r=".5" fill="currentColor"/></svg>';}
function evAnnotationButton(action,label='标注',marked=false){return `<button type="button" class="ev-annotation-trigger${marked?' is-marked':''}" title="${esc(label)}" aria-label="${esc(label)}" aria-haspopup="dialog" onclick="${esc(action)}">${evAnnotationIcon()}</button>`;}
function evAnnotationReleaseUnderlay(){
 const saved=evAnnotationUnderlay;if(!saved)return null;evAnnotationUnderlay=null;
 for(const item of saved.nodes){if(item.inert===null)item.node.removeAttribute('inert');else item.node.setAttribute('inert',item.inert);if(item.hidden===null)item.node.removeAttribute('aria-hidden');else item.node.setAttribute('aria-hidden',item.hidden);}
 return saved;
}
function evAnnotationRestoreResultView(){
 if(!evAnnotationReturnView)return;
 const saved=evAnnotationReturnView;evAnnotationReturnView=null;
 const resultId=document.querySelector('.ev-result-detail')?.getAttribute?.('data-result-id');if(saved.resultId&&resultId&&resultId!==saved.resultId)return;
 saved.scrolls.forEach(item=>{const node=document.querySelector(item.selector);if(node){node.scrollTop=item.top;node.scrollLeft=item.left;}});
}
function evAnnotationModal(title,body,footer,onsubmit){
 const overlay=document.getElementById('overlay'),focus=document.activeElement;
 const previous=evAnnotationReleaseUnderlay();previous?.backdrop?.remove();
 evAnnotationReturnView={resultId:typeof evExperimentAnnotationEditor!=='undefined'?evExperimentAnnotationEditor?.resultId:'',scrolls:['.ev-result-conversation-content:not([hidden])','.ev-result-assessment','.aev-experiment-detail-drawer .ev-modal-body'].map(selector=>{const node=document.querySelector(selector);return {selector,top:node?.scrollTop||0,left:node?.scrollLeft||0};})};
 const nodes=[...(overlay.children||[])].map(node=>({node,inert:node.getAttribute('inert'),hidden:node.getAttribute('aria-hidden')}));
 nodes.forEach(item=>{item.node.setAttribute('inert','');item.node.setAttribute('aria-hidden','true');});
 const actions=(footer||'').replace(/<button\b/g,'<button form="ev-annotation-form"');
 const markup=`<div class="ont-backdrop ev-backdrop ev-annotation-backdrop" onclick="if(event.target===this)evCloseModal()"><section class="ev-modal ev-annotation-dialog" role="dialog" aria-modal="true" aria-label="${esc(title)}"><header><h2>${esc(title)}</h2><button type="button" class="ont-close" aria-label="关闭标注" onclick="evCloseModal()">×</button></header><form id="ev-annotation-form" onsubmit="event.preventDefault();${onsubmit||''}"><div class="ev-annotation-body">${body}</div></form><footer><button type="button" class="ont-button" onclick="evCloseModal()">取消</button>${actions}</footer></section></div>`;
 if(overlay.insertAdjacentHTML)overlay.insertAdjacentHTML('afterbegin',markup);else overlay.innerHTML=markup;
 evAnnotationUnderlay={nodes,focus,backdrop:document.querySelector('.ev-annotation-backdrop')};
 evReleaseDrawer();
 document.querySelector('.ev-annotation-dialog select,.ev-annotation-dialog textarea,.ev-annotation-dialog .ont-close')?.focus();
}
function evModal(title,body,footer='',onsubmit='',headingExtra=''){
  const annotation=/^标注(?:评估结果|Agent输出)$/.test(title);
  if(!annotation&&typeof evExperimentAnnotationEditor!=='undefined')evExperimentAnnotationEditor=null;
  if(typeof evVersionClearEditor==='function')evVersionClearEditor();
  if(typeof evDisposeTaskTest==='function')evDisposeTaskTest();
  if(typeof evDisposeCaseInput==='function')evDisposeCaseInput();
  evCloseMoreMenu();
  document.querySelectorAll?.('.ev-create[open],.ev-more[open],.ev-add-menu[open],.ev-column-filter[open],.ev-multiselect[open],.ev-version-switcher[open],.ev-period-selector[open]').forEach(el=>el.removeAttribute('open'));
  if(!document.querySelector('.ev-modal')&&!(typeof evVersionSwitching!=='undefined'&&evVersionSwitching))evModalReturnFocus=document.activeElement;
  if(annotation)return evAnnotationModal(title,body,footer,onsubmit);
  evAnnotationReleaseUnderlay();
  if(/删除|归档|仍被使用/.test(title)){
    wtModal(title,body,footer,onsubmit);
    document.querySelector('.wt-modal')?.classList.add('ev-modal','ev-confirmation');
    document.querySelector('.wt-modal')?.parentElement?.classList.add('ev-backdrop');
    evObserveDrawer();
    document.querySelector('.wt-modal footer button')?.focus();
    return;
  }
  const resultHeading=/\bclass="[^"]*\bev-result-heading\b/.test(headingExtra);
  const actions=resultHeading?'':(footer||'<button type="button" class="ont-button strong" onclick="evCloseModal()">关闭</button>').replace(/<button\b/g,'<button form="ev-form"');
  document.getElementById('overlay').innerHTML=`<div class="ont-backdrop ev-backdrop" onclick="if(event.target===this)evCloseModal()"><section class="ont-drawer ev-modal${resultHeading?' ev-experiment-case':''}" role="dialog" aria-modal="true" aria-label="${esc(title)}"><header${resultHeading?' class="ev-result-modal-header"':''}><div class="ev-modal-title">${resultHeading?'':`<h2>${esc(title)}</h2>`}${headingExtra}</div><div class="ont-head-actions">${resultHeading?'':'<button type="button" class="ont-button" onclick="evCloseModal()">取消</button>'}${actions}<button type="button" class="ont-close" aria-label="关闭弹窗" onclick="evCloseModal()">×</button></div></header><form id="ev-form" onsubmit="event.preventDefault();${onsubmit}"><div class="ont-drawer-layout"><nav class="ont-drawer-nav ev-form-nav" aria-label="表单分区" hidden></nav><div class="ont-drawer-scroll ev-modal-body">${body}</div></div></form></section></div>`;
  evObserveDrawer();
  const nav=document.querySelector('.ev-form-nav'),sections=[...document.querySelectorAll('.ev-modal-body .ont-form-section')].filter(el=>el.querySelector('h3'));
  if(!resultHeading&&nav&&sections.length){sections.forEach((el,i)=>el.id='ev-section-'+i);nav.hidden=false;nav.innerHTML=sections.map((el,i)=>`<button type="button" class="${i===0?'active':''}" onclick="evFormSection(${i})">${esc(el.querySelector('h3').textContent.replace(/\s*\*\s*$/,''))}</button>`).join('');}
  document.querySelectorAll('.ev-binding-cascader').forEach(evBindingSync);
  if(resultHeading)evAnnotationRestoreResultView();
  document.querySelector(resultHeading?'.ev-modal .ont-head-actions button':'.ev-modal-body input:not([type=hidden]), .ev-modal-body textarea, .ev-modal-body select, .ev-modal .ont-head-actions button')?.focus();
}
function evFormSection(index){document.querySelectorAll('.ev-form-nav button').forEach((el,i)=>el.classList.toggle('active',i===index));document.getElementById('ev-section-'+index)?.scrollIntoView({behavior:'smooth',block:'start'});}
function evCloseModal(){const canceledAnnotation=typeof evExperimentAnnotationEditor!=='undefined'&&!!evExperimentAnnotationEditor;if(typeof evExperimentAnnotationEditor!=='undefined')evExperimentAnnotationEditor=null;if(typeof evVersionClearEditor==='function')evVersionClearEditor();if(typeof evDisposeCaseInput==='function')evDisposeCaseInput();evCloseMoreMenu();evReleaseDrawer();if(typeof evDisposeTaskTest==='function')evDisposeTaskTest();if(typeof evAssetState!=='undefined'){evAssetState.picker=null;evAssetState.import=null;}const annotation=evAnnotationReleaseUnderlay();if(canceledAnnotation&&annotation)evAnnotationReturnView=null;if(annotation?.nodes.length&&annotation.backdrop?.isConnected){annotation.backdrop.remove();evObserveDrawer();annotation.focus?.isConnected&&annotation.focus.focus();return 'annotation-restored';}document.getElementById('overlay').innerHTML='';evModalReturnFocus?.isConnected&&evModalReturnFocus.focus();}
let evMoreSequence=0,evActiveMore=null,evMoreObserver=null;
function evMore(items){const id='ev-more-menu-'+(++evMoreSequence);return `<details class="ev-more"><summary class="ont-link" role="button" aria-label="更多操作" aria-haspopup="menu" aria-expanded="false" aria-controls="${id}">更多</summary><div id="${id}" class="wi-card-menu ev-more-menu" role="menu" aria-label="更多操作菜单">${items.map(i=>`<button type="button" role="menuitem" class="${i.danger?'wi-delete danger':''}" ${i.disabled?'disabled aria-disabled="true"':''} ${i.title?`title="${esc(i.title)}"`:''} ${i.ariaLabel?`aria-label="${esc(i.ariaLabel)}"`:''} onclick="evCloseMoreMenu(true);${i.code}">${esc(i.label)}</button>`).join('')}</div></details>`;}
function evCloseMoreMenu(restoreFocus=false){
  const active=evActiveMore;if(!active)return;evActiveMore=null;evMoreObserver?.disconnect();evMoreObserver=null;
  active.summary.setAttribute('aria-expanded','false');active.owner.removeAttribute('open');
  if(active.owner.isConnected)active.owner.appendChild(active.panel);else active.panel.remove();
  if(restoreFocus&&active.summary.isConnected)active.summary.focus();
}
function evOpenMoreMenu(owner){
  if(evActiveMore?.owner===owner){evPositionPopover(owner);return;}
  evCloseMoreMenu();const panel=owner.querySelector('[role=menu]'),summary=owner.querySelector('summary');if(!panel||!summary)return;
  evActiveMore={owner,panel,summary};summary.setAttribute('aria-expanded','true');document.body.appendChild(panel);evPositionPopover(owner);
  const app=document.getElementById('app');if(typeof MutationObserver!=='undefined'&&app){evMoreObserver=new MutationObserver(()=>{if(evActiveMore&&!evActiveMore.owner.isConnected)evCloseMoreMenu();});evMoreObserver.observe(app,{childList:true,subtree:true});}
}
function evClosePopover(owner,restoreFocus=false){if(evActiveMore?.owner===owner){evCloseMoreMenu(restoreFocus);return;}owner.removeAttribute('open');if(restoreFocus)owner.querySelector('summary')?.focus();}

function evDropdownArrow(){return '<svg class="ev-dropdown-arrow" viewBox="0 0 12 12" width="12" height="12" aria-hidden="true" focusable="false"><path d="m3 4.5 3 3 3-3"/></svg>';}
function evCreateMenu(kind){let label={task:'业务任务',suite:'评测集',case:'评测用例',evaluator:'评估器',experiment:'实验'}[kind],code={task:'evEditTask()',suite:'evEditSuite()',case:'evEditCase()',evaluator:'evEditEvaluator()',experiment:'evNewExperiment()'}[kind];return `<details class="ev-create"><summary class="ont-button strong">＋ 新建${label} ${evDropdownArrow()}</summary><div class="wi-card-menu" role="menu"><button type="button" role="menuitem" onclick="${code}">${['evaluator','experiment'].includes(kind)?'新建':'新建'+label}</button><button type="button" role="menuitem" onclick="evCopilot('${kind}')">通过 Copilot 新建</button></div></details>`;}
function evTableContent(headers,rows,emptyHTML=''){return `<div class="ont-table-scroll ev-table-scroll"><table class="ont-table ev-table ${/编号/.test(headers[0])?'ev-fixed-id':''}"><thead><tr>${headers.map(h=>`<th>${h}</th>`).join('')}</tr></thead><tbody>${rows.join('')||`<tr><td colspan="${headers.length}">${emptyHTML||'<div class="ont-empty ev-empty">暂无数据</div>'}</td></tr>`}</tbody></table></div><footer class="ont-pagination ev-table-footer"><span class="ev-total">共 ${rows.length} 条</span><button type="button" aria-label="上一页" disabled>‹</button><button type="button" class="active" aria-label="第1页">1</button><button type="button" aria-label="下一页" disabled>›</button></footer>`;}
function evTable(headers,rows,emptyHTML='',toolbar=''){return `<section class="ont-box ev-table-box">${toolbar?`<div class="ont-toolbar ev-toolbar">${toolbar}</div>`:''}<div class="ev-table-content">${evTableContent(headers,rows,emptyHTML)}</div></section>`;}
function evScope(){const agents=evAgents(),count=evState.agentIds.length;return `<div class="ev-scope"><button class="ont-button ev-scope-trigger ${count?'selected':''}" aria-expanded="${evState.scopeOpen}" onclick="evState.scopeOpen=!evState.scopeOpen;evRender()">${count?'已选 '+count+' 个 Agent':'所有 Agent'} ${evDropdownArrow()}</button>${evState.scopeOpen?`<div class="ev-scope-menu" role="dialog" aria-label="Agent 筛选"><header><b>选择 Agent</b><button class="ont-link" onclick="evState.agentIds=[];evState.objectIds=[];evRender()">清空</button></header>${agents.map(a=>`<label><input type="checkbox" ${evState.agentIds.includes(a.id)?'checked':''} onchange="evScopeToggle('agentIds','${a.id}',this.checked)"><span>${esc(a.name)}</span></label>`).join('')}<footer><button class="ont-button strong" onclick="evState.scopeOpen=false;evRender()">完成</button></footer></div>`:''}</div>`;}
function evPageTimeControl(){const scope={'评测实验':'experiment-list'}[evState.tab];return scope?evDashboardTimeControl(scope):'';}

function evScopeToggle(key,id,checked){let allowed=(key==='agentIds'?evAgents():evObjects()).some(x=>x.id===id);if(!allowed)return;evState[key]=checked?[...new Set([...evState[key],id])]:evState[key].filter(x=>x!==id);evState.suiteId=null;evRender();}
function evTab(name){evState.tab=name;evState.suiteId=null;evState.suiteTab='评测用例';evState.search='';if(name==='评测实验')Object.assign(evExperimentUI(),{id:null,runId:'',supplementId:'',tab:'用例结果',resultSearch:''});if(name==='评测实验')evClearFilters('experimentResult');evRender();}
function evDetailHeader(name,kind,backCode,actions='',versionControl=''){return `<header class="ont-head ev-page-heading ev-detail-heading"><button type="button" class="ont-back" aria-label="返回${kind}" onclick="${backCode}">‹</button><h2 title="${esc(name)}">${esc(name)}</h2><span class="ont-badge">${kind}</span>${versionControl}<div class="ont-head-actions">${actions}</div></header>`;}
function evPrimaryTabs(d){const counts={'评测实验':evExperimentStore(d.scene).experiments.length,'评测集':d.suites.length,'业务任务':evFilteredTasks().length,'离线评估器':evEvaluatorStore(d.scene).evaluators.length};return `<nav class="ont-tabs ev-tabs" aria-label="评测页签">${Object.entries(counts).map(([t,n])=>`<button class="${(evState.tab===t||(t==='评测集'&&evState.tab==='评测用例库'))?'active':''}" onclick="evTab('${t}')">${t}<span class="ont-count">${n}</span></button>`).join('')}</nav>`;}
function evScreen(){
  const d=evData(),suiteRecord=evState.tab==='评测集'?d.suites.find(s=>s.id===evState.suiteId):null,suite=suiteRecord?evVersionResolve(suiteRecord,evVersionSelection('suite',suiteRecord.id)):null,experiment=evState.tab==='评测实验'?evExperimentCurrent():null,detail=suite||experiment,kind=suite?'评测集':'评测实验';
  if(evState.suiteId&&!suite)evState.suiteId=null;
  const crumb=`<div class="ont-crumb">首页 / <span>${esc(studioSceneData[studio.scene].name)}场景 / ${detail?`<button type="button" class="ev-crumb-link" onclick="evTab('${kind}')">评测 / ${kind}</button> / ${esc(detail.name)}`:'评测'}</span></div>`;
  const header=detail?evDetailHeader(detail.name,kind,suite?'evSuiteBack()':'evExperimentBack()',suite?evSuiteDetailActions(suite):evExperimentDetailActions(experiment),suite?evVersionSwitcher('suite',suiteRecord,evVersionSelection('suite',suiteRecord.id),evVersionContext('suite',suiteRecord.id)):''):`<header class="ont-head ev-page-heading"><h2>评测</h2><span class="ont-badge">${esc(studioSceneData[studio.scene].name)}场景</span><div class="ont-head-actions">${evScope()}${evPageTimeControl()}</div></header>`;
  const tabs=suite?evSuiteDetailTabs(suite):experiment?evExperimentDetailTabs(experiment):evPrimaryTabs(d),content=suite?evSuiteView(suite):experiment?evExperimentDetail(experiment):evState.tab==='业务任务'?evTasksView():evState.tab==='评测集'?evSuitesView():evState.tab==='评测用例库'?evCasesView():evState.tab==='评测实验'?evExperimentsView():evEvaluatorsView();
  return workbenchHeader()+`<section class="ont-screen ev-screen ${detail?'ev-detail-screen':''}">${crumb}${header}${tabs}<div class="ont-body ev-content">${content}</div></section>`;
}

// Keep the workshop routing contract while renaming the visible destination.
workbenchPages[workbenchPages.indexOf('测试')]='评测';
const evOriginalWorkbenchOpen=workbenchOpen,evOriginalStudioGui=studioGui,evOriginalStudioChat=studioChat,evOriginalSendStudioMessage=sendStudioMessage,evOriginalDismiss=dismiss;
workbenchOpen=function(name){if(name==='测试'||name==='评测'){dismiss();openWorkshopTests();return;}return evOriginalWorkbenchOpen(name);};
studioGui=function(){if(workbenchData().active==='评测'&&wtState.open)return evScreen();return evOriginalStudioGui();};
openWorkshopTests=function(){workbenchRegister('评测');waState.open=false;waState.pinned=false;waState.ontologyTab=false;woState.open=false;if(!wtState.open)wtState.weights={...studio.weights};wtState.open=true;studio.weights={docs:12,chat:30,gui:58};studio.panels.gui=true;evData();evState.tab='评测实验';evState.suiteId=null;evState.agentIds=[];evState.objectIds=[];evState.scopeOpen=false;render();};
wtScreen=evScreen;
dismiss=function(){evAnnotationReleaseUnderlay();evAnnotationReturnView=null;if(typeof evExperimentAnnotationEditor!=='undefined')evExperimentAnnotationEditor=null;if(typeof evVersionClearEditor==='function')evVersionClearEditor();if(typeof evDisposeCaseInput==='function')evDisposeCaseInput();evCloseMoreMenu();evReleaseDrawer();if(typeof evDisposeTaskTest==='function')evDisposeTaskTest();if(typeof evAssetState!=='undefined'){evAssetState.picker=null;evAssetState.import=null;}return evOriginalDismiss();};

const evPopoverSelector='.ev-create[open],.ev-more[open],.ev-add-menu[open],.ev-column-filter[open],.ev-multiselect[open],.ev-version-switcher[open],.ev-period-selector[open]';
document.addEventListener('click',e=>{if(evState.scopeOpen&&!e.target.closest?.('.ev-scope')){evState.scopeOpen=false;document.querySelector('.ev-scope-menu')?.remove();document.querySelector('.ev-scope-trigger')?.setAttribute('aria-expanded','false');}document.querySelectorAll(evPopoverSelector).forEach(owner=>{if(!owner.contains(e.target)&&!(evActiveMore?.owner===owner&&evActiveMore.panel.contains(e.target)))evClosePopover(owner);});});
function evPositionPopover(menu){
  const panel=evActiveMore?.owner===menu?evActiveMore.panel:menu.querySelector('[role=menu],[data-ev-popover]'),trigger=menu.querySelector('summary');if(!panel||!trigger)return;
  const rect=trigger.getBoundingClientRect(),bounds=(menu.closest('.ev-modal')||menu.closest('#studio-panel-gui'))?.getBoundingClientRect()||{left:0,right:innerWidth,top:0,bottom:innerHeight},left=Math.max(8,bounds.left+8),right=Math.min(innerWidth-8,bounds.right-8),top=Math.max(8,(bounds.top||0)+8),bottom=Math.min(innerHeight-8,bounds.bottom||innerHeight-8);
  panel.style.position='fixed';panel.style.right='auto';panel.style.maxWidth=Math.max(0,right-left)+'px';panel.style.maxHeight=Math.max(0,bottom-top)+'px';
  panel.style.left=Math.max(left,Math.min(menu.matches('.ev-multiselect,.ev-column-filter,.ev-version-switcher,.ev-period-selector')?rect.left:rect.right-panel.offsetWidth,right-panel.offsetWidth))+'px';
  panel.style.top=(rect.bottom+panel.offsetHeight+6<=bottom?rect.bottom+6:Math.max(top,rect.top-panel.offsetHeight-6))+'px';
}
document.addEventListener('toggle',e=>{const menu=e.target;if(!menu.matches?.('.ev-more,.ev-create,.ev-add-menu,.ev-column-filter,.ev-multiselect,.ev-version-switcher,.ev-period-selector'))return;if(menu.matches('.ev-more')){if(menu.open)evOpenMoreMenu(menu);else if(evActiveMore?.owner===menu)evCloseMoreMenu();return;}if(menu.matches('.ev-period-selector'))menu.querySelector('summary')?.setAttribute('aria-expanded',String(menu.open));if(menu.open)evPositionPopover(menu);},true);
document.addEventListener('scroll',e=>{if(e.target.closest?.('[data-ev-popover],[role=menu]'))return;document.querySelectorAll(evPopoverSelector).forEach(owner=>{if(owner.matches('.ev-column-filter,.ev-multiselect,.ev-version-switcher,.ev-period-selector'))evPositionPopover(owner);else evClosePopover(owner);});},true);
if(typeof window!=='undefined'&&window.addEventListener)window.addEventListener('resize',()=>{evCloseMoreMenu();evSyncDrawerBounds();document.querySelectorAll('.ev-period-selector[open]').forEach(evPositionPopover);});
document.addEventListener('keydown',e=>{
  if(evActiveMore&&['ArrowDown','ArrowUp','Home','End'].includes(e.key)&&(evActiveMore.owner.contains(e.target)||evActiveMore.panel.contains(e.target))){const buttons=[...evActiveMore.panel.querySelectorAll('button:not(:disabled)')],current=buttons.indexOf(document.activeElement),next=e.key==='Home'?0:e.key==='End'?buttons.length-1:e.key==='ArrowDown'?(current+1)%buttons.length:current<0?buttons.length-1:(current-1+buttons.length)%buttons.length;e.preventDefault();buttons[next]?.focus();return;}
  let modal=document.querySelector('.ev-modal');if(e.key==='Escape'){const open=document.querySelectorAll(evPopoverSelector);if(open.length){open.forEach(owner=>evClosePopover(owner,true));e.preventDefault();return;}if(modal){e.preventDefault();evCloseModal();return;}if(evState.scopeOpen){evState.scopeOpen=false;evRender();}}
  if(e.key==='Tab'&&modal){let list=[...modal.querySelectorAll('button,input,textarea,select,summary,a[href],[tabindex="0"]')].filter(x=>!x.disabled&&!x.closest('[hidden]')&&(!x.closest('details:not([open])')||x.matches('summary'))),first=list[0],last=list.at(-1);if(e.shiftKey&&document.activeElement===first){e.preventDefault();last?.focus();}else if(!e.shiftKey&&document.activeElement===last){e.preventDefault();first?.focus();}}
});
