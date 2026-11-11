const fs=require('fs'),vm=require('vm'),assert=require('assert/strict');
const html=fs.readFileSync('dist/index.html','utf8');
const nodes=new Map(),selectors=new Map(),lists=new Map();
const node=key=>{
  if(!nodes.has(key))nodes.set(key,{innerHTML:'',textContent:'',value:'',hidden:false,disabled:false,dataset:{},style:{},isConnected:true,
    focus(){},remove(){},setAttribute(){},removeAttribute(){},scrollIntoView(){},closest(){return null;},contains(){return true;},
    getBoundingClientRect(){return {left:700,top:60,right:1440,bottom:1000,width:740,height:940};},
    classList:{add(){},remove(){},toggle(){}},
    querySelector:s=>selectors.get(key+' '+s)||null,querySelectorAll:s=>lists.get(key+' '+s)||[]});
  return nodes.get(key);
};
class FormDataMock {
  constructor(form){this.values=form.values||{};}
  get(key){const v=this.values[key];return Array.isArray(v)?v[0]??null:v??null;}
  getAll(key){const v=this.values[key];return v===undefined?[]:Array.isArray(v)?v:[v];}
  *[Symbol.iterator](){for(const key of Object.keys(this.values))for(const v of this.getAll(key))yield[key,v];}
}
class FileReaderMock {
  readAsDataURL(file){file.arrayBuffer().then(buffer=>{this.result='data:'+(file.type||'application/octet-stream')+';base64,'+Buffer.from(buffer).toString('base64');this.onload?.({target:this});},error=>{this.error=error;this.onerror?.({target:this});});}
}
const context={console,Date,JSON,URL,URLSearchParams,Blob,File,FileReader:FileReaderMock,FormData:FormDataMock,
  setTimeout,clearTimeout,addEventListener(){},innerWidth:1440,innerHeight:1000,
  document:{body:node('body'),activeElement:node('active'),getElementById:node,querySelector:s=>selectors.get(s)||null,querySelectorAll:s=>lists.get(s)||[],createElement:t=>node('created-'+t),addEventListener(){}}};
context.window=context;vm.createContext(context);
for(const m of html.matchAll(/<script>([\s\S]*?)<\/script>/g))vm.runInContext(m[1],context);
const modules=['workshop-evaluation-seed.js','workshop-evaluation.js','workshop-evaluation-versions.js','workshop-evaluation-dashboard.js','workshop-evaluation-tasks.js','workshop-evaluation-assets.js','workshop-evaluation-evaluators.js','workshop-evaluation-experiment-engine.js','workshop-evaluation-reports.js','workshop-evaluation-experiments.js','workshop-evaluation-issues.js','workshop-evaluation-copilot.js'];
for(const file of modules){assert(html.includes('src="'+file),'real entry point loads '+file);vm.runInContext(fs.readFileSync('dist/'+file,'utf8'),context,{filename:file});}
const run=code=>vm.runInContext(code,context),clone=value=>JSON.parse(JSON.stringify(value)),snapshot=code=>clone(run(code));
const overlay=()=>node('overlay').innerHTML;
const assertHandlers=markup=>{
  for(const m of markup.matchAll(/(?:onclick|onchange|onsubmit|oninput|onkeydown|ondrop|ondragover)="([^"]*)"/g)){
    const code=m[1].replace(/&quot;/g,'"').replace(/&#39;/g,"'").replace(/&amp;/g,'&').replace(/&lt;/g,'<').replace(/&gt;/g,'>');
    assert.doesNotThrow(()=>new Function('event',code),code);
  }
};
run("currentSection='studio';studio.scene='sales';workbenchOpen('评测')");
assert.equal(run('evState.tab'),'评测实验');
const tabMarkup=run('evPrimaryTabs(evData())');
const tabs=[...tabMarkup.matchAll(/<button\b[^>]*>([\s\S]*?)<\/button>/g)].map(m=>m[1].replace(/<span\b[\s\S]*/,''));
assert.deepEqual(tabs,['评测实验','评测集','业务任务','离线评估器']);

// Version selectors render a finite list of immutable snapshots, without mutating resources.
context.versionRecord={id:'TEST',name:'第一版',version:'V1',input:'输入一',inputAttachments:[{id:'old',name:'旧附件.txt',size:3,type:'text/plain',dataUrl:'data:text/plain;base64,b2xk'}]};
run('evVersionPrepare(versionRecord)');
run("versionRecord.name='第二版';versionRecord.input='输入二';versionRecord.inputAttachments[0].name='新附件.txt';evVersionSave(versionRecord);evVersionPublish(versionRecord)");
const published=snapshot('versionRecord');
assert.equal(run('evVersionResolve(versionRecord,"V1").input'),'输入一');
assert.equal(run('evVersionResolve(versionRecord,"V1").inputAttachments[0].name'),'旧附件.txt');
assert(run('Object.isFrozen(evVersionResolve(versionRecord,"V1"))&&Object.isFrozen(evVersionResolve(versionRecord,"V1").inputAttachments)'));
assert.equal(run('evVersionResolve(versionRecord)'),context.versionRecord);
assert.equal(run('evVersionEditorNote(versionRecord)'),'');assert.equal(run('evVersionHistory(versionRecord)'),'');
const versionMarkup=run('evVersionSwitcher("case",versionRecord)');assertHandlers(versionMarkup);
assert(versionMarkup.includes('V1')&&versionMarkup.includes('V2'));assert(!versionMarkup.includes('版本记录')&&!versionMarkup.includes('保存保留当前版本'));
assert.deepEqual(snapshot('versionRecord'),published,'opening the version menu leaves all saved content unchanged');
run("versionRecord.input='尚未发布输入';evVersionSave(versionRecord)");
assert.equal(run('evVersionResolve(versionRecord,"V2").input'),'输入二');
assert.equal(run('evVersionResolve(versionRecord,"current").input'),'尚未发布输入','returning to current restores the draft, not the last publication');
assert.deepEqual(snapshot('evVersionOptions(versionRecord).map(o=>o.key)'),['current','V2','V1']);

// Every versioned resource switches actual displayed content, with read-only historical actions.
const resources=[
  {kind:'task',record:'evData().tasks[0]',detail:'evTaskDetail',field:'prompt',old:'第一版任务提示词',new:'第二版任务提示词'},
  {kind:'case',record:'evData().cases[0]',detail:'evCaseDetail',field:'input',old:'第一版用例输入',new:'第二版用例输入'},
  {kind:'evaluator',record:'evEvaluatorStore().evaluators[0]',detail:'evEvaluatorDetail',field:'description',old:'第一版评分简介',new:'第二版评分简介'}
];
for(const resource of resources){
  context.activeResource=run(resource.record);context.activeResource.version='V1';context.activeResource[resource.field]=resource.old;
  run('evVersionPrepare(activeResource)');context.activeResource[resource.field]=resource.new;run('evVersionSave(activeResource);evVersionPublish(activeResource)');
  const before=clone(context.activeResource),id=context.activeResource.id;
  run(resource.detail+'('+JSON.stringify(id)+')');assert(overlay().includes(resource.new));assertHandlers(overlay());
  assert.equal(run('evVersionSelect('+[resource.kind,id,'V1','detail','sales'].map(JSON.stringify).join(',')+')'),true);
  assert(overlay().includes(resource.old),'historical '+resource.kind+' body displays its own snapshot');
  assert(!overlay().includes(resource.new),'historical '+resource.kind+' body excludes current content');
  assert(!/onclick="(?:evEditTask|evEditCase|evEditEvaluator|evPublishResource|evPublishEvaluator)\(/.test(overlay()),'historical '+resource.kind+' does not offer mutation actions');
  assertHandlers(overlay());
  run('evVersionSelect('+[resource.kind,id,'current','detail','sales'].map(JSON.stringify).join(',')+')');
  assert(overlay().includes(resource.new));assert.deepEqual(clone(context.activeResource),before,'view switching leaves '+resource.kind+' current/history unchanged');
  assert.equal(run('evVersionSelect('+[resource.kind,id,'V999','detail','sales'].map(JSON.stringify).join(',')+')'),false);
  assert.equal(run('evVersionSelect('+[resource.kind,id,'V1','detail','procurement'].map(JSON.stringify).join(',')+')'),false);
}

// A suite retains its overview/tab contents while switching historical definitions.
context.activeSuite=run('evData().suites[0]');context.activeSuite.version='V1';context.activeSuite.target='第一版测试目标';
run('evVersionPrepare(activeSuite)');context.activeSuite.target='第二版测试目标';run('evVersionSave(activeSuite);evVersionPublish(activeSuite);evOpenSuite(activeSuite.id);evSuiteSelectTab("评测集配置")');
const suiteBefore=clone(context.activeSuite);
assert(run('evScreen()').includes('第二版测试目标'));
assert.equal(run('evVersionSelect("suite",activeSuite.id,"V1","detail","sales")'),true);
assert.equal(run('evVersionSelection("suite",activeSuite.id)'),'V1');
const historicalSuite=run('evScreen()');assertHandlers(historicalSuite);
assert(historicalSuite.includes('第一版测试目标')&&!historicalSuite.includes('第二版测试目标'));
assert(!/onclick="(?:evEditSuite|evPublishResource|evDeleteSuite)\(/.test(historicalSuite),'historical suites expose no edit/publish/delete action');
for(const tab of ['评测用例','评测集配置']){
  run('evSuiteSelectTab('+JSON.stringify(tab)+')');const readonlyTab=run('evScreen()');assertHandlers(readonlyTab);
  assert(!/onclick="(?:evEdit|evPublish|evToggle|evRemoveSuiteCase|evArchiveCase|evOpenCasePicker|evImportCases)/.test(readonlyTab),'historical suite '+tab+' tab exposes no mutation action');
}
run('evSuiteSelectTab("概览")');
run('evVersionSelect("suite",activeSuite.id,"current","detail","sales")');assert(run('evScreen()').includes('第二版测试目标'));
assert.deepEqual(clone(context.activeSuite),suiteBefore,'suite version browsing does not rewrite the live suite');

// Nested detail/edit/history transitions retain the external modal opener for keyboard return.
let openerFocusCalls=0;
context.modalOpener={isConnected:true,focus(){openerFocusCalls++;}};
context.document.activeElement=context.modalOpener;
selectors.delete('.ev-modal');
run('evModal("初次打开评测详情","<p>详情</p>")');
assert.equal(run('evModalReturnFocus'),context.modalOpener);
selectors.set('.ev-modal',node('existing-modal'));
context.document.activeElement=node('nested-edit-button');
run('evModal("编辑评测资源","<p>编辑</p>")');
assert.equal(run('evModalReturnFocus'),context.modalOpener,'detail-to-edit keeps the external opener');
selectors.delete('.ev-modal');
context.document.activeElement=node('historical-version-button');
run('evVersionSwitching=true;evModal("历史评测版本","<p>历史</p>");evVersionSwitching=false');
assert.equal(run('evModalReturnFocus'),context.modalOpener,'version switching does not replace the opener with a soon-removed menu button');
run('evCloseModal()');assert.equal(openerFocusCalls,1,'closing after version browsing returns focus to the original opener');
context.document.activeElement=node('active');

(async()=>{
  assert(html.includes('aiops/shared/composer-slash-skills.js'),'workshop loads the shared interactive Skill selector');
  assert(html.includes('workshop-evaluation-case-input.css'),'workshop loads the case input styles');
  for(const [value,query,from] of [['/','',0],['/skill','',0],['请执行 /skill data','data',4],['请执行 /data','data',4]]){
    context.triggerInput={value,selectionStart:value.length};
    const result=snapshot('evCaseSkillTrigger(triggerInput)');assert.equal(result.query,query);assert.equal(result.from,from);assert.equal(result.to,value.length);
  }
  context.triggerInput={value:'https://example.com',selectionStart:19};assert.equal(run('evCaseSkillTrigger(triggerInput)'),null);
  const field=node('ev-case-input');
  field.value='前文 /skill data 后文';field.selectionStart=14;field.selectionEnd=14;
  field.setRangeText=function(text,from,to){this.value=this.value.slice(0,from)+text+this.value.slice(to);this.selectionStart=this.selectionEnd=from+text.length;};
  let paletteOptions,paletteDestroyed=0,paletteCreated=0;
  context.ComposerSlashSkills={create(options){paletteCreated++;paletteOptions=options;return{destroy(){paletteDestroyed++;}};}};
  run('evBindCaseInput("","",{inputAttachments:[]})');assert(paletteOptions&&paletteOptions.trigger===context.evCaseSkillTrigger);
  assert.equal(paletteCreated,1);assert.equal(paletteDestroyed,0);
  run('evBindCaseInput("","",{inputAttachments:[]})');
  assert.equal(paletteCreated,2);assert.equal(paletteDestroyed,1,'rebinding a restored/current editor destroys its previous palette and listeners');
  paletteOptions.insertMany(field,[{id:'data-analysis'}],{from:3,to:14});
  assert.equal(field.value,'前文 /data-analysis  后文','selecting a Skill replaces the command range and preserves surrounding input');
  context.uploadFiles=[new File(['订单,数量\nA,10'], '需求清单.csv', {type:'text/csv',lastModified:1234})];
  assert.equal(await run('evReadCaseAttachments(uploadFiles)'),true);
  const uploaded=snapshot('evCaseInputEditor.attachments');assert.equal(uploaded.length,1);assert.equal(uploaded[0].name,'需求清单.csv');
  assert.equal(uploaded[0].dataUrl,'data:text/csv;base64,'+Buffer.from('订单,数量\nA,10').toString('base64'),'file upload retains actual bytes');
  assert.deepEqual(JSON.parse(node('ev-case-attachment-values').value),uploaded);
  assert.equal(field.required,false,'attachments may supply input without text');
  context.tooLarge=[{name:'大文件.bin',size:10*1024*1024+1}];assert.equal(await run('evReadCaseAttachments(tooLarge)'),false);
  assert.deepEqual(snapshot('evCaseInputEditor.attachments'),uploaded,'rejected files leave existing attachments intact');
  context.testForm={values:{name:'含 Skill 与附件的评测',input:'/data-analysis 请分析需求清单',expected:'列出总需求与依据',tags:'附件',inputAttachments:JSON.stringify(uploaded)}};
  assert.equal(run('evSaveCase(testForm,"","",true)'),true);
  context.attachmentCase=run('evData().cases[0]');const id=context.attachmentCase.id;
  assert.equal(context.attachmentCase.input,'/data-analysis 请分析需求清单');assert.deepEqual(clone(context.attachmentCase.inputAttachments),uploaded);
  assert.deepEqual(clone(context.attachmentCase.publishedSnapshot.inputAttachments),uploaded);
  run('evEditCase(attachmentCase.id)');assertHandlers(overlay());
  assert(overlay().includes('需求清单.csv')&&overlay().includes('/data-analysis 请分析需求清单'));
  assert.deepEqual(snapshot('evCaseInputEditor.attachments'),uploaded,'reopening an editor restores the uploaded attachments');
  run('evRemoveCaseAttachment(evCaseInputEditor.attachments[0].id)');assert.equal(node('ev-case-attachment-values').value,'[]');assert.equal(field.required,true);
  assert.deepEqual(clone(context.attachmentCase.inputAttachments),uploaded,'removing files from an unsaved editor leaves the saved case untouched');
  context.testForm.values.inputAttachments=node('ev-case-attachment-values').value;
  assert.equal(run('evSaveCase(testForm,attachmentCase.id,"",true)'),true);
  assert.equal(context.attachmentCase.version,'V2');assert.equal(context.attachmentCase.inputAttachments.length,0);
  run('evCaseDetail(attachmentCase.id,"","V1")');assert(overlay().includes('需求清单.csv')&&overlay().includes('下载附件'));
  assert(!overlay().includes('移除附件'),'published input attachments are read-only');
  assert.deepEqual(clone(context.attachmentCase.history[0].inputAttachments),uploaded,'later removal preserves the historical attachment content');
  const beforeInvalid=clone(context.attachmentCase);
  context.testForm.values.inputAttachments=JSON.stringify([{...uploaded[0],size:uploaded[0].size+1}]);
  assert.equal(run('evSaveCase(testForm,attachmentCase.id)'),false);
  assert.deepEqual(clone(context.attachmentCase),beforeInvalid,'invalid serialized file data cannot mutate an existing case');
  context.testForm.values.input='';context.testForm.values.name='仅附件输入';context.testForm.values.inputAttachments=JSON.stringify(uploaded);
  assert.equal(run('evSaveCase(testForm)'),true,'an attachment is a valid standalone input');
  run('evEditCase(evData().cases[0].id)');const beforeLegacySave=snapshot('evData().cases[0].inputAttachments');
  delete context.testForm.values.inputAttachments;assert.equal(run('evSaveCase(testForm,evData().cases[0].id)'),true);
  assert.deepEqual(snapshot('evData().cases[0].inputAttachments'),beforeLegacySave,'legacy callers without an attachment field preserve current files');
  let finishRead;
  context.delayedFile={name:'延迟附件.txt',size:1,type:'text/plain',arrayBuffer:()=>new Promise(resolve=>{finishRead=resolve;})};
  run('evBindCaseInput("","",{inputAttachments:[]})');const pending=run('evReadCaseAttachments([delayedFile])');
  assert.equal(run('evCaseInputEditor.loading'),true);run('evDisposeCaseInput()');finishRead(new Uint8Array([65]).buffer);
  assert.equal(await pending,false,'a completed file read cannot resurrect a closed editor');
  assert.equal(run('evCaseInputEditor'),null);assert(paletteDestroyed>0,'closing an input editor disposes its Skill palette');
  // The native host adds an independent reference uploader; the workshop keeps its existing fields.
  assert(run('evCaseInputControl({})').includes('ev-case-skill-button'));
  assert.equal(run('evCaseExpectedExtras({})'),'');
  context.AIOpsEvaluation={};
  run('evBindCaseInput("","",{inputAttachments:[]})');
  assert.equal(await run('evReadCaseAttachments(uploadFiles,"reference")'),true);
  assert.equal(field.required,true,'reference attachments do not satisfy the required Agent input');
  assert.equal(run('evCaseInputEditor.attachments.length'),0);
  const references=snapshot('evCaseInputEditor.referenceAttachments');
  assert.deepEqual(references.map(f=>f.dataUrl),uploaded.map(f=>f.dataUrl),'reference upload retains actual bytes');
  assert.deepEqual(JSON.parse(node('ev-case-reference-attachment-values').value),references);
  assert.equal(await run('evReadCaseAttachments(tooLarge,"reference")'),false);
  assert.deepEqual(snapshot('evCaseInputEditor.referenceAttachments'),references);
  context.referenceId=references[0].id;run('evRemoveCaseAttachment(referenceId,"reference")');
  assert.equal(node('ev-case-reference-attachment-values').value,'[]');
  run('evDisposeCaseInput()');
  console.log('Passed: evaluation tab order/default; immutable version switching and scene guards for tasks/suites/cases/evaluators; Skill insertion, real attachment bytes, validation, save/reopen/history and stale upload cancellation.');
})().catch(error=>{console.error(error);process.exitCode=1;});
