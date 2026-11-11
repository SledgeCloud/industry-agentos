/* Native resource pages with in-context experiment result and issue drawers. */
(function (global) {
  'use strict';
  const sourceModal=evModal,sourceClose=evCloseModal,sourceRestoreEditor=evVersionRestoreEditor;
  const sources={task:evTaskDetail,evaluator:evEvaluatorDetail,case:evCaseDetail,result:evExperimentCaseDetail,validation:evExperimentCaseDetail,scoring:evExperimentScoringSnapshot,issue:evExperimentIssueDetail,reportEvidence:evExperimentReportEvidence};
  const creationDialogs={'新建业务任务':'task','新建评测集':'suite','确认 Copilot 评测集草案':'suite','新建评测实验':'experiment','新建离线评估器':'evaluator','新建评测用例':'case','从问题新增用例':'case','优化关联用例':'case'};
  let detail=null,capture=null,pendingScroll=null,focusHeading=false,editorReturn=null,preserveNavigation=false,drawerMounted=false,navigationContext=null;
  const isDrawer=entry=>!!entry&&['result','validation','issue'].includes(entry.kind);
  function refreshPage() { global.AIOpsApp.refresh(pendingScroll===null?{}:{scrollTop:pendingScroll}); }
  function stateSnapshot() {
    return {state:{...evState,agentIds:[...evState.agentIds],objectIds:[...evState.objectIds]},experiment:{...evExperimentState},filters:evVersionClone(evListFilters)};
  }
  function restoreState(saved) {
    if(!saved)return;
    Object.assign(evState,saved.state);Object.assign(evExperimentState,saved.experiment);
    evClearFilters();Object.assign(evListFilters,saved.filters);
  }
  function reset() { if(drawerMounted)sourceClose();detail=null;editorReturn=null;pendingScroll=null;focusHeading=false;drawerMounted=false; }
  function rememberIssueDraft() {
    if(drawerMounted&&detail)detail.drawerScroll=document.querySelector('.aev-experiment-detail-drawer .ev-modal-body')?.scrollTop||0;
    if(detail?.kind!=='issue')return;
    const form=document.getElementById('ev-form'),draft={};
    for(const key of ['status','owner','note']){const field=form?.querySelector('[name="'+key+'"]');if(field)draft[key]=field.value;}
    if(Object.keys(draft).length)detail.draft=draft;
  }
  function generate(kind,args) {
    const previous=capture;capture={output:null};
    try{sources[kind](...args);const output=capture.output;if(output&&['result','validation'].includes(kind))output.body=resultBody(output.body);return output;}finally{capture=previous;}
  }
  function resultBody(body) {
    const markup=String(body||''),tabsPattern=/<nav\b[^>]*\bclass="ev-result-tabs"[^>]*>[\s\S]*?<\/nav>/,ranges=[],opening=/<div\b[^>]*\bclass="([^"]*)"[^>]*>/g;let match;
    if(!tabsPattern.test(markup))return markup;
    while((match=opening.exec(markup))){
      if(!match[1].split(/\s+/).includes('ev-result-hover'))continue;
      const tags=/<\/?div\b[^>]*>/g;tags.lastIndex=opening.lastIndex;let depth=1,part;
      while(depth&&(part=tags.exec(markup)))depth+=part[0].startsWith('</')?-1:1;
      if(depth)continue;
      const content=markup.slice(match.index,tags.lastIndex);
      if(!/<button\b[^>]*\bclass="[^"]*\bev-expected-output\b/.test(content))continue;
      ranges.push({start:match.index,end:tags.lastIndex,content});opening.lastIndex=tags.lastIndex;
    }
    let cursor=0,result='';
    for(const range of ranges){result+=markup.slice(cursor,range.start);cursor=range.end;}result+=markup.slice(cursor);
    result=result.replace(/(<button\b[^>]*\bid="ev-result-conversation-tab"[^>]*>)输入与输出(<\/button>)/,'$1实际结果$2').replace(/<div class="ev-result-conversation-heading">[\s\S]*?<\/div>/,'');
    const actions=ranges.map((range,index)=>{
      if(ranges.length===1)return range.content;
      const turn=/预期输出 · 第 (\d+) 轮/.exec(range.content)?.[1]||String(index+1);
      return range.content.replace(/>预期输出(<\/button>)/,'>第 '+turn+' 轮预期输出$1');
    }).join('');
    return result.replace(tabsPattern,tabs=>`<div class="aev-result-toolbar">${tabs}${actions?'<div class="aev-result-expected-actions" aria-label="预期输出">'+actions+'</div>':''}</div>`);
  }
  evModal=function(title,body,footer='',onsubmit='',headingExtra='') {
    if(capture){capture.output={title,body,footer,onsubmit,headingExtra};return;}
    rememberIssueDraft();drawerMounted=false;
    const result=sourceModal(title,body,footer,onsubmit,headingExtra),kind=creationDialogs[title];
    if(kind){
      const modal=document.querySelector('.ev-modal'),backdrop=document.querySelector('.ev-backdrop');
      modal?.classList.add('aev-create-modal');modal?.setAttribute('data-aev-create-kind',kind);
      backdrop?.classList.add('aev-create-backdrop');
      // Preserve the shared form nodes, bindings and validation while placing
      // creation actions in the conventional centered-dialog footer.
      const actions=modal?.querySelector('.ont-head-actions');
      if(actions){const controls=document.createElement('footer');controls.className='aev-create-footer';actions.querySelectorAll('button:not(.ont-close)').forEach(button=>controls.appendChild(button));modal.appendChild(controls);}
      evReleaseDrawer();
      (modal?.querySelector('input:not([type=hidden]):not(:disabled),textarea:not(:disabled),select:not(:disabled)')||modal?.querySelector('.ont-close'))?.focus();
    }
    return result;
  };
  evCloseModal=function() {
    if(drawerMounted&&!preserveNavigation)return back();
    const restored=sourceClose();drawerMounted=false;
    if(restored==='annotation-restored'&&isDrawer(detail)&&!preserveNavigation){drawerMounted=true;return;}
    if(isDrawer(detail)&&!preserveNavigation)mountDrawer();
  };
  function resourceTitle(kind,args,fallback) {
    if(kind==='result'||kind==='validation'){
      if(typeof evExperimentCaseDetailContext==='function'){const context=evExperimentCaseDetailContext(args[0]);if(context?.result)return context.result.name;}
      const current=evExperimentCurrent(),run=current&&evExperimentSelectedRun(current),evidence=current&&evExperimentEvidence(current,run),result=(evidence?evExperimentDisplayResults(evidence,run):[]).find(row=>row.id===args[0]||row.caseId===args[0]);
      if(result)return result.name;
    }
    const record=kind==='task'?evData().tasks.find(row=>row.id===args[0]):kind==='evaluator'?evEvaluatorStore().evaluators.find(row=>row.id===args[0]):kind==='case'?evData().cases.find(row=>row.id===args[0]):null;
    const selection=kind==='case'?args[2]:args[1];
    return record?evVersionResolve(record,selection||'current').name:fallback;
  }
  function detailKey(kind,args) {
    // Switching attempts belongs to the same case result page.
    if(kind==='result'||kind==='validation'){
      if(typeof evExperimentCaseDetailContext==='function'){const context=evExperimentCaseDetailContext(args[0]);if(context?.result)return [kind,context.current?.id||context.experiment?.id,context.run?.id,context.result.caseId].join(':');}
      const current=evExperimentCurrent(),run=current&&evExperimentSelectedRun(current),evidence=current&&evExperimentEvidence(current,run),result=(evidence?evExperimentDisplayResults(evidence,run):[]).find(row=>row.id===args[0]);
      return [kind,current?.id,run?.id,result?.caseId||args[0]].join(':');
    }
    return [kind,args[0]||'',kind==='case'?args[1]||'':''].join(':');
  }
  function show(kind,args) {
    if(!global.AIOpsEvaluation.isPage(global.AIOpsApp.page()))return sources[kind](...args);
    rememberIssueDraft();
    const parentContext=navigationContext||stateSnapshot(),parentScroll=document.getElementById('pageRoot')?.scrollTop||0,originFocus=document.activeElement;
    if(evVersionSwitching&&evVersionSuspendedEditor&&!editorReturn)editorReturn={detail};
    const restored=sourceClose();if(restored==='annotation-restored')document.getElementById('overlay').innerHTML='';drawerMounted=false;
    const output=generate(kind,args);if(!output)return false;
    const key=detailKey(kind,args),same=detail?.key===key;
    detail={kind,args:[...args],key,scene:studio.scene,title:resourceTitle(kind,args,output.title),output,draft:same?detail.draft:null,drawerScroll:same?detail.drawerScroll:0,
      parentDetail:same?detail.parentDetail:detail,parentContext:same?detail.parentContext:parentContext,parentScroll:same?detail.parentScroll:parentScroll};
    pendingScroll=isDrawer(detail)||same?parentScroll:0;focusHeading=!same||restored==='annotation-restored';
    if(isDrawer(detail)&&!detail.parentDetail)evModalReturnFocus=originFocus;
    refreshPage();return true;
  }
  evTaskDetail=function(...args){return show('task',args);};
  evEvaluatorDetail=function(...args){return show('evaluator',args);};
  evCaseDetail=function(...args){return show('case',args);};
  evExperimentCaseDetail=function(...args){return show(evExperimentCaseDetailContext(args[0])?.validation?'validation':'result',args);};
  evExperimentScoringSnapshot=function(...args){return show('scoring',args);};
  evExperimentIssueDetail=function(...args){return show('issue',args);};
  evExperimentReportEvidence=function(...args){return show('reportEvidence',args);};
  function parentLabel(entry) {
    if(entry.parentDetail)return entry.parentDetail.title;
    const saved=entry.parentContext;
    if(saved?.state.suiteId)return evData().suites.find(row=>row.id===saved.state.suiteId)?.name||'评测集详情';
    if(saved?.experiment.id&&saved.state.tab==='评测实验')return evExperimentGet(saved.experiment.id)?.name||'评测实验详情';
    return (saved?.state.tab||global.AIOpsApp.page())+(saved?.state.tab==='评测用例库'?'':'列表');
  }
  function render(page) {
    if(!detail||detail.scene!==studio.scene){reset();return '';}
    const output=generate(detail.kind,detail.args);
    if(!output){detail.output={title:'详情已不可用',body:'<div class="ont-empty">该资源已移除，请返回列表。</div>',footer:'',onsubmit:'',headingExtra:''};}
    else{detail.output=output;detail.title=resourceTitle(detail.kind,detail.args,output.title);}
    const view=detail.output,formId=detail.kind==='issue'?'ev-form':'aev-detail-form';
    const actions=(view.footer||'').replace(/<button\b/g,'<button form="'+formId+'"').replace(/evCloseModal\(\)/g,'AIOpsEvaluation.backDetail()');
    return `<section id="app" class="aiops-evaluation aev-detail-page"><div id="studio-panel-gui" class="aiops-evaluation-main"><nav class="aev-detail-breadcrumb" aria-label="详情路径"><button type="button" onclick="evTab('${page}')">${esc(page)}</button><span>/</span>${parentLabel(detail)!==page+'列表'?`<button type="button" onclick="AIOpsEvaluation.backDetail()">${esc(parentLabel(detail))}</button><span>/</span>`:''}<span>${esc(detail.title)}</span></nav><header class="page-heading aev-detail-header"><button type="button" class="aev-detail-back" aria-label="返回${esc(parentLabel(detail))}" onclick="AIOpsEvaluation.backDetail()">‹</button><h1 tabindex="-1">${esc(detail.title)}</h1><span class="ont-badge">${esc(view.title)}</span>${view.headingExtra}<div class="aev-detail-actions">${actions}</div></header><form id="${formId}" onsubmit="event.preventDefault();${view.onsubmit}"><div class="aev-detail-layout"><nav class="aev-detail-nav" aria-label="详情分区" hidden></nav><div class="aev-detail-body">${view.body}</div></div></form></div></section>`;
  }
  function mountDrawer() {
    if(!isDrawer(detail)||detail.scene!==studio.scene)return;
    const output=generate(detail.kind,detail.args);
    if(output){detail.output=output;detail.title=resourceTitle(detail.kind,detail.args,output.title);}
    const view=detail.output,resultHeading=['result','validation','issue'].includes(detail.kind)&&/\bclass="[^"]*\bev-result-heading\b/.test(view.headingExtra||''),actions=resultHeading?'':(view.footer||'').replace(/<button\b/g,'<button form="ev-form"');
    const backAction=detail.parentDetail?`<button type="button" class="ont-button" onclick="AIOpsEvaluation.backDetail()" aria-label="返回${esc(parentLabel(detail))}">返回</button>`:'';
    document.getElementById('overlay').innerHTML=`<div class="ont-backdrop ev-backdrop aev-experiment-detail-backdrop" onclick="if(event.target===this)evCloseModal()"><section class="ont-drawer ev-modal aev-experiment-detail-drawer ${['result','validation'].includes(detail.kind)?'ev-experiment-case':detail.kind==='issue'?'ev-experiment-issue':''}" data-aev-detail-kind="${detail.kind}" role="dialog" aria-modal="true" aria-label="${esc(view.title)}"><header${resultHeading?' class="ev-result-modal-header"':''}><div class="ev-modal-title">${resultHeading?'':`<h2 tabindex="-1">${esc(detail.title)}</h2>`}${view.headingExtra||''}</div><div class="ont-head-actions">${backAction}${actions}<button type="button" class="ont-close" aria-label="关闭详情" onclick="evCloseModal()">×</button></div></header><form id="ev-form" onsubmit="event.preventDefault();${view.onsubmit||''}"><div class="ont-drawer-layout"><div class="ont-drawer-scroll ev-modal-body">${view.body}</div></div></form></section></div>`;
    drawerMounted=true;evObserveDrawer();
    const body=document.querySelector('.aev-experiment-detail-drawer .ev-modal-body');if(body)body.scrollTop=detail.drawerScroll||0;
    if(['result','validation'].includes(detail.kind)&&typeof evAnnotationRestoreResultView==='function')evAnnotationRestoreResultView();
    if(detail.kind==='issue'&&detail.draft){const form=document.getElementById('ev-form');for(const [key,value] of Object.entries(detail.draft)){const field=form?.querySelector('[name="'+key+'"]');if(field)field.value=value;}}
    // Start on a tabbable action so the shared modal trap also contains Shift+Tab.
    if(focusHeading){document.querySelector('.aev-experiment-detail-drawer .ont-head-actions button')?.focus({preventScroll:true});focusHeading=false;}
  }
  function section(index) {
    document.querySelectorAll('.aev-detail-nav button').forEach((node,i)=>node.classList.toggle('active',i===index));
    document.getElementById('aev-detail-section-'+index)?.scrollIntoView({behavior:'smooth',block:'start'});
  }
  function afterRender() {
    if(pendingScroll!==null){const root=document.getElementById('pageRoot');if(root)root.scrollTop=pendingScroll;pendingScroll=null;}
    if(!detail)return;
    if(isDrawer(detail)){
      // A temporary operation such as annotation owns its form until it closes.
      if(drawerMounted||!document.querySelector('.ev-modal')){if(drawerMounted)rememberIssueDraft();mountDrawer();}
      return;
    }
    if(detail.kind==='issue'&&detail.draft){const form=document.getElementById('ev-form');for(const [key,value] of Object.entries(detail.draft)){const field=form?.querySelector('[name="'+key+'"]');if(field)field.value=value;}}
    const nav=document.querySelector('.aev-detail-nav'),sections=[...document.querySelectorAll('.aev-detail-body .ont-form-section')].filter(node=>node.querySelector('h3'));
    if(nav&&sections.length){nav.hidden=false;nav.innerHTML=sections.map((node,index)=>{node.id='aev-detail-section-'+index;return `<button type="button" class="${index===0?'active':''}" onclick="AIOpsEvaluation.detailSection(${index})">${esc(node.querySelector('h3').textContent)}</button>`;}).join('');}
    if(focusHeading){document.querySelector('.aev-detail-header h1')?.focus({preventScroll:true});focusHeading=false;}
  }
  function back() {
    if(!detail)return false;
    if(editorReturn&&evVersionSuspendedEditor){
      const saved=evVersionSuspendedEditor;
      evVersionSetSelection(saved.kind,saved.id,'current','edit');
      if(sourceRestoreEditor(saved.kind,saved.id)){detail=editorReturn.detail;editorReturn=null;refreshPage();return true;}
    }
    const previous=detail;
    sourceClose();drawerMounted=false;detail=previous.parentDetail;restoreState(previous.parentContext);
    pendingScroll=previous.parentScroll;focusHeading=!!detail;
    refreshPage();return true;
  }
  evVersionRestoreEditor=function(kind,id) {
    const restored=sourceRestoreEditor(kind,id);
    if(restored&&editorReturn){detail=editorReturn.detail;editorReturn=null;refreshPage();}
    return restored;
  };
  // Main resource navigation exits the secondary detail. Evidence links retain
  // their issue parent so Back returns to the originating processing page.
  const sourceOpenSuite=evOpenSuite,sourceSuiteBack=evSuiteBack,sourceOpenExperiment=evExperimentOpen,sourceExperimentBack=evExperimentBack;
  evOpenSuite=function(...args){if(!preserveNavigation){global.AIOpsPageTabs?.captureCurrent();reset();}return sourceOpenSuite(...args);};
  evSuiteBack=function(...args){reset();return sourceSuiteBack(...args);};
  evExperimentOpen=function(...args){if(!preserveNavigation){global.AIOpsPageTabs?.captureCurrent();reset();}return sourceOpenExperiment(...args);};
  evExperimentBack=function(...args){reset();return sourceExperimentBack(...args);};
  const sourceOpenValidation=evExperimentIssueValidationDetail,sourceOpenEvidence=evExperimentIssueOpenEvidence,sourceSaveIssue=evSaveExperimentIssue,sourceExperimentRefresh=evExperimentRefresh;
  evExperimentIssueValidationDetail=function(...args){rememberIssueDraft();navigationContext=stateSnapshot();preserveNavigation=true;try{return sourceOpenValidation(...args);}finally{preserveNavigation=false;navigationContext=null;}};
  evExperimentIssueOpenEvidence=function(...args){rememberIssueDraft();navigationContext=stateSnapshot();if(!args[2])reset();preserveNavigation=true;try{return sourceOpenEvidence(...args);}finally{preserveNavigation=false;navigationContext=null;}};
  evSaveExperimentIssue=function(...args){const saved=sourceSaveIssue(...args);if(saved&&detail?.kind==='issue')back();return saved;};
  evExperimentRefresh=function(scene,id,runId){
    sourceExperimentRefresh(scene,id,runId);
    if(['result','validation','issue'].includes(detail?.kind)&&scene===studio.scene&&currentSection==='studio'&&evExperimentState.id===id&&(detail.kind==='issue'||detail.kind==='validation'&&evExperimentCaseDetailContext(detail.args[0])?.run?.id===runId||!runId||evExperimentSelectedRun(evExperimentCurrent())?.id===runId))global.AIOpsApp.refresh();
  };
  global.AIOpsEvaluationDetails={hasDetail:()=>!!detail,hasPageDetail:()=>!!detail&&!isDrawer(detail),current:()=>detail,render,afterRender,section,back,reset,
    captureView:()=>{rememberIssueDraft();return detail;},
    restoreView:saved=>{detail=saved?.scene===studio.scene?saved:null;editorReturn=null;pendingScroll=null;focusHeading=false;drawerMounted=false;}
  };
})(window);
