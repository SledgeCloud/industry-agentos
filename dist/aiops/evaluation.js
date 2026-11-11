/* Native AIOps routes over the exact same evaluation runtime as the workshop. */
(function (global) {
  'use strict';
  const pages=['评测实验','评测集','业务任务','离线评估器'];
  const scenes=['sales','procurement'];
  let activePage=null, lastPage=null, lastScope=null, toastTimer;
  function isPage(page) { return pages.includes(page); }
  function routeForTab(tab) { return tab==='评测用例库'?'评测集':tab; }
  function resetPage(page) {
    global.AIOpsEvaluationDetails?.reset();
    evState.tab=page;evState.suiteId=null;evState.suiteTab='评测用例';evState.search='';
    if(page==='评测实验')Object.assign(evExperimentUI(),{id:null,runId:'',supplementId:'',tab:'用例结果',resultSearch:''});
  }
  function closeEditors() {
    global.AIOpsEvaluationDetails?.reset();
    evCloseModal();if(typeof evExperimentAssistantClose==='function')evExperimentAssistantClose();evState.copilot=null;evState.scopeOpen=false;evCloseMoreMenu();
    evTaskEditor=null;evSuiteEditor=null;evEvaluatorEditor=null;evExperimentEditor=null;
    document.querySelectorAll(evPopoverSelector).forEach(owner=>owner.removeAttribute('open'));
  }
  function availableScenes() {
    const id=global.AIOpsResources.sceneId();
    return scenes.filter(scene=>id==='all'||id===scene||id===scene+'-app');
  }
  function syncScope() {
    const id=global.AIOpsResources.sceneId(), available=availableScenes();
    if(id!==lastScope) { closeEditors();lastScope=id;lastPage=null; }
    if(available.length&&!available.includes(studio.scene))studio.scene=available[0];
    if(available.length)evData();
    return available;
  }
  function sceneSelect(available) {
    return `<label class="aev-scene-select"><span>评测场景</span><select aria-label="评测场景" onchange="AIOpsEvaluation.selectScene(this.value)">${available.map(id=>`<option value="${id}" ${studio.scene===id?'selected':''}>${esc(studioSceneData[id].name)}</option>`).join('')}</select></label>`;
  }
  function screen(page, available) {
    if(global.AIOpsEvaluationDetails?.hasPageDetail())return global.AIOpsEvaluationDetails.render(page).replace(/>离线评估器</g,'>离线评估器（备份）<').replace(/>离线评估器列表</g,'>离线评估器（备份）列表<');
    const d=evData(),suiteRecord=evState.tab==='评测集'?d.suites.find(s=>s.id===evState.suiteId):null;
    const suite=suiteRecord?evVersionResolve(suiteRecord,evVersionSelection('suite',suiteRecord.id)):null;
    const experiment=evState.tab==='评测实验'?evExperimentCurrent():null,detail=suite||experiment;
    const kind=suite?'评测集':'评测实验';
    const heading=detail?
      `<div class="aev-breadcrumb"><button type="button" onclick="evTab('${kind}')">${kind}</button><span>/</span><span>${esc(detail.name)}</span></div>`+evDetailHeader(detail.name,kind,suite?'evSuiteBack()':'evExperimentBack()',suite?evSuiteDetailActions(suite):evExperimentDetailActions(experiment),suite?evVersionSwitcher('suite',suiteRecord,evVersionSelection('suite',suiteRecord.id),evVersionContext('suite',suiteRecord.id)):''):
      `<header class="page-heading aev-heading"><h1>${esc(evState.tab==='评测用例库'?'评测用例库':page==='离线评估器'?'离线评估器（备份）':page)}</h1><div class="aev-page-actions">${sceneSelect(available)}${evScope()}${evPageTimeControl()}</div></header>`;
    const tabs=suite?evSuiteDetailTabs(suite):experiment?evExperimentDetailTabs(experiment):'';
    const content=suite?evSuiteView(suite):experiment?evExperimentDetail(experiment):evState.tab==='业务任务'?evTasksView():evState.tab==='评测集'?evSuitesView():evState.tab==='评测用例库'?evCasesView():evState.tab==='评测实验'?evExperimentsView():evEvaluatorsView();
    const assistant=typeof evExperimentAssistantState==='function'&&evExperimentAssistantState();
    const copilot=assistant?`<aside class="aev-copilot aev-optimization-assistant" aria-label="评测助手">${evExperimentAssistantChat()}</aside>`:evState.copilot?.scene===studio.scene?`<aside class="aev-copilot" aria-label="评测 Copilot">${evCopilotChat()}</aside>`:'';
    return `<section id="app" class="aiops-evaluation ${copilot?'has-copilot':''}"><div class="aiops-evaluation-layout"><div id="studio-panel-gui" class="aiops-evaluation-main">${heading}${tabs}<div class="ont-body ev-content">${content}</div></div>${copilot}</div></section>`;
  }
  function page(name) {
    if(!isPage(name))return '';
    const available=syncScope();
    activePage=name;wtState.open=!!available.length;currentSection=available.length?'studio':'';
    if(!available.length)return `<section class="aiops-evaluation"><header class="page-heading"><h1>${esc(name)}</h1></header><div class="aev-scope-empty"><i data-lucide="flask-conical"></i><h2>当前场景暂无评测资源</h2><p>选择销售或采购场景，管理业务任务、评测集、评测实验与离线评估器。</p><div class="ev-actions"><button class="ont-button strong" onclick="AIOpsResources.selectScene('sales')">打开销售场景</button><button class="ont-button" onclick="AIOpsResources.selectScene('procurement')">打开采购场景</button></div></div></section>`;
    if(lastPage!==name){resetPage(name);lastPage=name;}
    return screen(name,available);
  }
  function beforeRender(next) {
    if(activePage&&activePage!==next){closeEditors();lastPage=null;}
    activePage=isPage(next)?next:null;
    if(!activePage){wtState.open=false;currentSection='';}
    document.body.classList.toggle('aiops-evaluation-active',!!activePage);
  }
  function afterRender(name) { document.body.classList.toggle('aiops-evaluation-active',isPage(name));if(isPage(name))global.AIOpsEvaluationDetails?.afterRender(); }
  function onSceneChange() { closeEditors();lastPage=null;lastScope=null; }
  function resetView(page) {
    if(activePage===page){closeEditors();lastPage=null;evState.search='';}
    if(page==='评测集'){evAssetState.suiteSearch='';evAssetState.caseSearch='';evAssetState.caseTag='';evAssetState.caseStatus='active';evClearFilters('suite');evClearFilters('case');}
    if(page==='离线评估器'){evEvaluatorState.search='';evEvaluatorState.status='全部状态';evClearFilters('evaluator');}
    if(page==='业务任务')evClearFilters('task');
    if(page==='评测实验'){Object.assign(evExperimentState,{id:null,runId:'',supplementId:'',tab:'用例结果',search:'',resultSearch:''});evClearFilters('experiment');evClearFilters('experimentResult');}
  }
  function captureView(page) {
    return {scope:global.AIOpsResources.sceneId(),scene:studio.scene,page,
      state:{...evState,agentIds:[...evState.agentIds],objectIds:[...evState.objectIds]},
      assets:{...evAssetState,picker:null,import:null},evaluator:{...evEvaluatorState},experiment:{...evExperimentState},filters:evVersionClone(evListFilters),
      detail:global.AIOpsEvaluationDetails?.captureView()||null};
  }
  function restoreView(saved,page) {
    if(!saved||saved.scope!==global.AIOpsResources.sceneId())return false;
    closeEditors();studio.scene=saved.scene;evData();
    Object.assign(evState,saved.state);Object.assign(evAssetState,saved.assets);Object.assign(evEvaluatorState,saved.evaluator);Object.assign(evExperimentState,saved.experiment);
    evClearFilters();Object.assign(evListFilters,saved.filters);global.AIOpsEvaluationDetails?.restoreView(saved.detail);
    activePage=page;lastPage=page;lastScope=saved.scope;return true;
  }
  function selectScene(scene) {
    if(!availableScenes().includes(scene))return false;
    closeEditors();studio.scene=scene;evData();lastPage=null;global.AIOpsApp.refresh();return true;
  }
  function nativeRender() {
    const destination=routeForTab(evState.tab),current=global.AIOpsApp?.page();
    if(!isPage(current))return;
    // Shared detail/back/Copilot actions may choose another resource. Preserve
    // the chosen detail instead of treating it as a fresh sidebar navigation.
    if(isPage(destination)&&destination!==current){lastPage=destination;activePage=destination;global.AIOpsApp.navigate(destination,{pageTabNewLocation:true});}
    else global.AIOpsApp.refresh();
  }
  function taskCatalog() {
    const allowed=global.AIOpsResources.scopeCatalog().map(scene=>scene.id);
    return scenes.filter(scene=>allowed.includes(scene)).flatMap(scene=>{
      const data=evCatalog[scene]||(evCatalog[scene]=evSeedScene(scene));
      const app=evWorkspace.applications.find(a=>a.sceneIds.includes(scene));
      return data.tasks.map(task=>{
        const application=task.agentId===app.agent.id,index=application?1:0;
        const agent=application?app.agent:waCatalog[scene].find(a=>a.id===task.agentId);
        return {...evVersionClone(task),scene,agentId:scene+':agents:'+index,sourceAgentId:task.agentId,agent:agent?.name||'',description:evTaskPrompt(task),input:'',output:'',completion:evTaskPrompt(task),criteria:task.dimensions.map(d=>d.description)};
      });
    });
  }
  global.AIOpsWorkspaces.registerEvaluationScenes([
    {id:'sales-app',name:'销售管理',scene:{id:'sales',name:'销售',agents:['销售智能分货助手','销售管理应用 Agent'],objects:['销售业务本体']}},
    {id:'procurement-app',name:'采购管理',scene:{id:'procurement',name:'采购',agents:['采购协同助手','采购管理应用 Agent'],objects:['采购业务本体']}}
  ]);
  global.AIOpsEvaluation={pages,isPage,page,beforeRender,afterRender,onSceneChange,resetView,captureView,restoreView,selectScene,taskCatalog,taskDefinition:id=>taskCatalog().find(task=>task.id===id)||null,
    backDetail:()=>global.AIOpsEvaluationDetails?.back(),
    leaveDetail:()=>{global.AIOpsEvaluationDetails?.reset();global.AIOpsApp.refresh();},
    detailSection:index=>global.AIOpsEvaluationDetails?.section(index),
    toast(message) {
      const node=document.getElementById('evaluation-toast');if(!node)return;
      clearTimeout(toastTimer);node.textContent=message;node.hidden=false;
      toastTimer=setTimeout(()=>{node.hidden=true;},2800);
    }
  };
  evRender=function(){if(typeof evExperimentCloseOutput==='function')evExperimentCloseOutput();evCloseMoreMenu();nativeRender();};
  // View navigation comes from the left sidebar, including links from details.
  evTab=function(name){global.AIOpsPageTabs?.captureCurrent();resetPage(name);evClearFilters('experimentResult');evRender();};
})(window);
