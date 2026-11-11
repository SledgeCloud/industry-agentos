/* Explicit local draft / publication lifecycle shared by evaluation assets. */
'use strict';
function evVersionClone(value){return JSON.parse(JSON.stringify(value));}
function evVersionFreeze(value){if(value&&typeof value==='object'&&!Object.isFrozen(value)){Object.values(value).forEach(evVersionFreeze);Object.freeze(value);}return value;}
function evVersionSnapshot(record){const omitted=new Set(['history','publishedSnapshot','publicationStatus','savedAt']);return evVersionFreeze(evVersionClone(Object.fromEntries(Object.entries(record).filter(([key])=>!omitted.has(key)))));}
function evVersionExperimentSnapshot(record){
  const snapshot=evVersionClone(record),version=record.version||'V1';
  snapshot.sourceVersion=version;
  snapshot.version=record.publicationStatus==='draft'?version+(record.publishedSnapshot?' 修改稿':' 未发布'):version;
  return snapshot;
}
function evVersionPrepare(record){
  if(!record)return record;
  if(!/^V[1-9]\d*$/.test(record.version||''))record.version='V1';
  if(!record.publicationStatus){record.publicationStatus='published';record.publishedSnapshot=evVersionSnapshot(record);}
  if(!Array.isArray(record.history))record.history=[];
  return record;
}
function evVersionSave(record){
  if(!/^V[1-9]\d*$/.test(record.version||''))record.version='V1';
  record.publicationStatus='draft';record.savedAt=new Date().toISOString();
  if(!Array.isArray(record.history))record.history=[];
  return record;
}
function evVersionNext(record){return record?.publishedSnapshot||record&&!record.publicationStatus?'V'+((Number(String(record.version||'V1').slice(1))||1)+1):record?.version||'V1';}
function evVersionPublish(record){
  if(!record.publicationStatus)evVersionPrepare(record);
  const previous=record.publishedSnapshot;
  record.version=evVersionNext(record);
  if(previous){record.history=[...(record.history||[]).filter(h=>h.version!==previous.version),evVersionFreeze(evVersionClone(previous))];}
  record.publicationStatus='published';record.publishedAt=new Date().toISOString();
  record.publishedSnapshot=evVersionSnapshot(record);
  return record;
}
function evVersionBadge(record){return `<span class="ev-version-badge"><span class="ont-badge">${esc(record.version||'V1')}</span> <span class="ont-enabled ${record.publicationStatus==='draft'?'draft':''}">${record.publicationStatus==='draft'?'已保存 · 待发布':'已发布'}</span></span>`;}
// Kept as no-op compatibility hooks: versions live in the title switcher.
function evVersionEditorNote(){return '';}
function evVersionHistory(){return '';}

const evVersionSelections=Object.create(null),evVersionContexts=Object.create(null);
let evVersionSuspendedEditor=null,evVersionSwitching=false;
function evVersionClearEditor(){if(!evVersionSwitching)evVersionSuspendedEditor=null;}
function evVersionKey(kind,id,scene=studio.scene){return scene+':'+kind+':'+id;}
function evVersionSelection(kind,id){return evVersionSelections[evVersionKey(kind,id)]||'current';}
function evVersionContext(kind,id){return evVersionContexts[evVersionKey(kind,id)]||'detail';}
function evVersionSetSelection(kind,id,selection='current',context='detail'){const key=evVersionKey(kind,id);evVersionSelections[key]=selection;evVersionContexts[key]=context;return selection;}
function evVersionResource(kind,id){
  const data=evData(),records=kind==='evaluator'?evEvaluatorStore().evaluators:({task:data.tasks,suite:data.suites,case:data.cases}[kind]||[]);
  return records.find(record=>record.id===id&&!record.archived)||null;
}
function evVersionOptions(record){
  if(!record)return [];
  const draft=record.publicationStatus==='draft',current={key:'current',record,status:draft?'draft':'published',history:false},seen=new Set(),snapshots=[];
  for(const snapshot of [...(record.publishedSnapshot?[record.publishedSnapshot]:[]),...(record.history||[])]){
    if(!snapshot?.version||seen.has(snapshot.version)||(!draft&&snapshot.version===record.version))continue;
    seen.add(snapshot.version);snapshots.push({key:snapshot.version,record:snapshot,status:snapshot.version===record.publishedSnapshot?.version?'published':'history',history:true});
  }
  snapshots.sort((a,b)=>(Number(b.record.version.slice(1))||0)-(Number(a.record.version.slice(1))||0));
  return [current,...snapshots];
}
function evVersionResolve(record,selection='current'){
  if(!record||selection==='current')return record;
  const snapshot=evVersionOptions(record).find(option=>option.key===selection)?.record;
  return snapshot?evVersionFreeze(evVersionClone(snapshot)):record;
}
function evVersionTime(record){
  const raw=record.publicationStatus==='draft'?(record.savedAt||record.updatedAt||record.publishedAt):(record.publishedAt||record.updatedAt||record.savedAt);
  if(!raw)return '—';
  const date=new Date(raw);
  if(Number.isNaN(date.getTime()))return String(raw);
  return new Intl.DateTimeFormat('sv-SE',{timeZone:'Asia/Shanghai',year:'numeric',month:'2-digit',day:'2-digit',hour:'2-digit',minute:'2-digit',hour12:false}).format(date);
}
function evVersionStatus(option){return option.status==='draft'?'草稿':option.status==='history'?'历史':'已发布';}
function evVersionPill(option,arrow=false){return `<span class="ev-version-pill is-${option.status}"><span>${evVersionStatus(option)}</span><i aria-hidden="true">|</i><span>${esc(option.record.version||'V1')}</span>${arrow?evDropdownArrow():''}</span>`;}
function evVersionSwitcher(kind,record,selection='current',context='detail',suiteId=''){
  if(!record?.id)return '';
  const options=evVersionOptions(record),selected=options.find(option=>option.key===selection)||options[0],label={task:'业务任务',suite:'评测集',case:'评测用例',evaluator:'离线评估器'}[kind]||'资源';
  return `<details class="ev-version-switcher" data-ev-version-kind="${esc(kind)}" data-ev-version-id="${esc(record.id)}" data-ev-version-selection="${esc(selected.key)}" data-ev-version-context="${esc(context)}" onkeydown="evVersionMenuKey(event,this)"><summary aria-label="切换${label}版本">${evVersionPill(selected,true)}</summary><div class="ev-version-menu" data-ev-popover role="group" aria-label="${label}版本历史"><h3>版本历史 <span>(${options.length})</span></h3><div class="ev-version-options">${options.map(option=>`<button type="button" class="ev-version-option ${option.key===selected.key?'selected':''}" aria-pressed="${option.key===selected.key}" aria-label="${option.key==='current'?'当前版本':evVersionStatus(option)+'版本'} ${esc(option.record.version||'V1')}" onclick="evVersionSelect(${[kind,record.id,option.key,context,studio.scene,suiteId].map(value=>esc(JSON.stringify(value))).join(',')})">${evVersionPill(option)}<span class="ev-version-option-name" title="${esc(option.record.name||'—')}">${esc(option.record.name||'—')}${option.key==='current'?'<small>当前'+(option.status==='draft'?'修改稿':'版本')+'</small>':''}</span><time>${esc(evVersionTime(option.record))}</time></button>`).join('')}</div></div></details>`;
}
function evVersionMenuKey(event,menu){
  if(!menu.open||!['ArrowDown','ArrowUp','Home','End'].includes(event.key))return;
  const buttons=[...menu.querySelectorAll('.ev-version-option')];if(!buttons.length)return;
  const index=buttons.indexOf(document.activeElement),next=event.key==='Home'?0:event.key==='End'?buttons.length-1:event.key==='ArrowDown'?(index+1)%buttons.length:index<0?buttons.length-1:(index-1+buttons.length)%buttons.length;
  event.preventDefault();buttons[next].focus();
}
function evVersionCaptureEditor(kind,id,suiteId=''){
  const overlay=document.getElementById('overlay'),switcher=overlay?.querySelector?.('.ev-version-switcher[data-ev-version-context="edit"][data-ev-version-selection="current"]');
  if(!switcher||!overlay.childNodes?.length)return;
  evVersionSuspendedEditor={kind,id,suiteId,scene:studio.scene,nodes:[...overlay.childNodes],task:typeof evTaskEditor==='undefined'?null:evTaskEditor,suite:typeof evSuiteEditor==='undefined'?null:evSuiteEditor,evaluator:typeof evEvaluatorEditor==='undefined'?null:evEvaluatorEditor};
}
function evVersionRestoreEditor(kind,id){
  const saved=evVersionSuspendedEditor,overlay=document.getElementById('overlay');
  if(!saved||saved.kind!==kind||saved.id!==id||saved.scene!==studio.scene||!overlay?.replaceChildren)return false;
  overlay.replaceChildren(...saved.nodes);
  if(typeof evTaskEditor!=='undefined')evTaskEditor=saved.task;
  if(typeof evSuiteEditor!=='undefined')evSuiteEditor=saved.suite;
  if(typeof evEvaluatorEditor!=='undefined')evEvaluatorEditor=saved.evaluator;
  evVersionSuspendedEditor=null;
  if(kind==='case'&&typeof evBindCaseInput==='function'){
    let attachments=[];try{attachments=JSON.parse(document.getElementById('ev-case-attachment-values')?.value||'[]');}catch(error){}
    let referenceAttachments=[];try{referenceAttachments=JSON.parse(document.getElementById('ev-case-reference-attachment-values')?.value||'[]');}catch(error){}
    evBindCaseInput(id,saved.suiteId,{inputAttachments:attachments,referenceAttachments});
  }
  evObserveDrawer();
  overlay.querySelector('input:not([type=hidden]),textarea,select')?.focus();
  return true;
}
function evVersionSelect(kind,id,selection='current',context='detail',scene=studio.scene,suiteId=''){
  if(scene!==studio.scene)return false;
  const record=evVersionResource(kind,id);if(!record||!evVersionOptions(record).some(option=>option.key===selection))return false;
  document.querySelectorAll?.('.ev-version-switcher[open]').forEach(menu=>menu.removeAttribute('open'));
  evVersionSwitching=true;
  try{
  if(context==='edit'){
    if(kind==='case'&&typeof evCaseInputEditor!=='undefined'&&evCaseInputEditor?.loading){toast('附件正在读取，请稍后切换版本');return false;}
    evVersionCaptureEditor(kind,id,suiteId);
    if(selection==='current'){
      evVersionSetSelection(kind,id,'current',context);
      if(evVersionRestoreEditor(kind,id)){if(kind==='suite')evRender();return true;}
      if(kind==='task')evEditTask(id);else if(kind==='suite')evEditSuite(id);else if(kind==='case')evEditCase(id,suiteId);else if(kind==='evaluator')evEditEvaluator(id);
      return true;
    }
  }
  evVersionSetSelection(kind,id,selection,context);
  if(kind==='task')evTaskDetail(id,selection,context);
  else if(kind==='case')evCaseDetail(id,suiteId,selection,context);
  else if(kind==='evaluator')evEvaluatorDetail(id,selection,context);
  else if(kind==='suite'){
    evCloseModal();evState.suiteId=id;evState.tab='评测集';evRender();
  }
  return true;
  }finally{evVersionSwitching=false;}
}
function evPublishResource(kind,id){const store={task:evData().tasks,suite:evData().suites,case:evData().cases},record=store[kind]?.find(item=>item.id===id&&!item.archived);if(!record)return false;evVersionPublish(record);evCloseModal();evRender();toast(({task:'业务任务',suite:'评测集',case:'评测用例'}[kind]||'资源')+'已发布 '+record.version);return true;}
