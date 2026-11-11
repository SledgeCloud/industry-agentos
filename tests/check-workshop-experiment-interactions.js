const fs=require('fs'),vm=require('vm'),assert=require('assert/strict');
const html=fs.readFileSync('dist/index.html','utf8');
const nodes=new Map(),selectors=new Map(),lists=new Map(),events=new Map(),timers=new Map();
let clockMs=Date.parse('2026-11-01T12:00:00Z'),serial=0;
class TestDate extends Date { constructor(...args){super(...(args.length?args:[clockMs]));} static now(){return clockMs;} }
const node=key=>{
  if(!nodes.has(key))nodes.set(key,{innerHTML:'',textContent:'',value:'',hidden:false,disabled:false,dataset:{},style:{},scrollTop:0,scrollHeight:100,isConnected:true,
    focus(){},remove(){},click(){},setAttribute(){},removeAttribute(){},scrollIntoView(){},closest(){return null;},contains(){return true;},
    getBoundingClientRect(){return {left:700,top:60,right:1440,bottom:1000,width:740,height:940};},
    classList:{add(){},remove(){},toggle(){}},
    querySelector(selector){return selectors.get(key+' '+selector)||null;},querySelectorAll(selector){return lists.get(key+' '+selector)||[];}});
  return nodes.get(key);
};
class TestFormData {
  constructor(form){this.values=form.values||{};}
  get(key){const value=this.values[key];return Array.isArray(value)?value[0]??null:value??null;}
  getAll(key){const value=this.values[key];return value===undefined?[]:Array.isArray(value)?value:[value];}
  *[Symbol.iterator](){for(const key of Object.keys(this.values))for(const value of this.getAll(key))yield[key,value];}
}
const context={console,Date:TestDate,JSON,FormData:TestFormData,URL,URLSearchParams,Blob,
  addEventListener(type,handler){if(!events.has(type))events.set(type,[]);events.get(type).push(handler);},
  setTimeout(fn,delay=0){const id=++serial;timers.set(id,{id,fn,due:clockMs+Number(delay)});return id;},clearTimeout(id){timers.delete(id);},
  document:{body:node('body'),activeElement:node('active'),getElementById:node,
    querySelector:selector=>selectors.get(selector)||null,querySelectorAll:selector=>lists.get(selector)||[],createElement:tag=>node('created-'+tag),
    addEventListener(type,handler){if(!events.has(type))events.set(type,[]);events.get(type).push(handler);}},innerWidth:1440,innerHeight:1000};
context.window=context;
vm.createContext(context);
for(const match of html.matchAll(/<script>([\s\S]*?)<\/script>/g))vm.runInContext(match[1],context);
const modules=['workshop-evaluation-seed.js','workshop-evaluation.js','workshop-evaluation-versions.js','workshop-evaluation-dashboard.js','workshop-evaluation-tasks.js','workshop-evaluation-assets.js','workshop-evaluation-evaluators.js','workshop-evaluation-experiment-engine.js','workshop-evaluation-reports.js','workshop-evaluation-experiments.js','workshop-evaluation-issues.js','workshop-evaluation-copilot.js'];
const scriptTags=[...html.matchAll(/<script\b[^>]*\bsrc="([^"]+)"[^>]*>/g)];
let previousScriptIndex=-1;
for(const file of modules){
  const script=scriptTags.find(match=>match[1].split('?')[0]===file);
  assert(script,file+' must be loaded by index.html');
  assert(script.index>previousScriptIndex,'evaluation modules load in dependency order');
  previousScriptIndex=script.index;
  vm.runInContext(fs.readFileSync('dist/'+file,'utf8'),context,{filename:file});
}
const run=code=>vm.runInContext(code,context);
const snapshot=code=>JSON.parse(run('JSON.stringify('+code+')'));
const advance=()=>{
  const next=[...timers.values()].sort((a,b)=>a.due-b.due||a.id-b.id)[0];
  if(!next)return false;
  timers.delete(next.id);clockMs=Math.max(clockMs,next.due);next.fn();return true;
};
const drain=(limit=3000)=>{let count=0;while(timers.size){assert(++count<=limit,'run timers must finish');advance();}};
const until=(predicate,limit=3000)=>{let count=0;while(!predicate()){assert(++count<=limit&&advance(),'expected run progress must occur');}};
const handlers=markup=>{
  for(const match of markup.matchAll(/(?:onclick|onchange|onsubmit|oninput|onkeydown)="([^"]*)"/g)){
    const code=match[1].replace(/&quot;/g,'"').replace(/&#39;/g,"'").replace(/&amp;/g,'&').replace(/&lt;/g,'<').replace(/&gt;/g,'>');
    assert.doesNotThrow(()=>new Function('event',code),code);
  }
};
const primaryExperimentCount=markup=>{
  const nav=markup.match(/<nav\b[^>]*aria-label="评测页签"[^>]*>([\s\S]*?)<\/nav>/)?.[1]||'';
  return Number(nav.match(/>评测实验\s*<span\b[^>]*>(\d+)<\/span>/)?.[1]??NaN);
};
const detailTabNames=markup=>[...markup.matchAll(/<button\b[^>]*>([\s\S]*?)<\/button>/g)].map(m=>m[1].replace(/<span\b[^>]*>[\s\S]*?<\/span>/g,'').replace(/<[^>]*>/g,'').trim());
const resultRows=markup=>[...(markup.match(/<tbody>([\s\S]*?)<\/tbody>/)?.[1]||'').matchAll(/<tr>([\s\S]*?)<\/tr>/g)].map(m=>m[1]).filter(row=>row.includes('evExperimentCaseDetail('));
const resultIds=markup=>resultRows(markup).map(row=>row.match(/evExperimentCaseDetail\('([^']+)'\)/)?.[1]);


run("currentSection='studio';studio.scene='sales';evData();evExperimentStore()");
const exp=run('evExperimentStore().experiments[2]');context.exp=exp;
assert(!run('evScope()').includes('本体对象集'));
assert(!run('evScope()').includes('仅展示'));
assert(!run('evPrimaryTabs(evData())').includes('评测用例库'));
assert(run('evSuitesView()').includes("evTab('评测用例库')"));
assert(!run('evSuitesView()').includes('按评测集创建时间统计'));
assert(run('evCasesView()').includes('返回评测集'));
const list=run('evExperimentListTable(evExperimentStore().experiments)');handlers(list);
assert(!list.includes('<th>Agent 版本</th>'));
assert(list.includes('<th>最新评测记录</th>'));
assert(list.includes('evExperimentGoSuite('));
run('evExperimentOpen(exp.id)');assert.equal(run('evExperimentState.tab'),'用例结果');
assert.deepEqual(detailTabNames(run('evExperimentDetailTabs(exp)')),['用例结果','问题优化','实验报告','实验配置']);
context.r=run('evRunExperiment(exp.id)');
assert.equal(context.r.status,'运行中');
advance();const completedBefore=context.r.results.filter(r=>['通过','未通过','运行失败'].includes(r.status)).length;
const savedBefore=JSON.stringify(context.r.results.filter(r=>['通过','未通过','运行失败'].includes(r.status)));
run('evPauseExperiment(exp.id)');assert.equal(context.r.status,'已暂停');assert.equal(timers.size,0);
assert(context.r.results.some(r=>r.status==='待运行'));
assert(run('evExperimentHeaderControls(exp)').includes('继续执行'));
assert(!run('evExperimentHeaderControls(exp)').includes('全量重跑'));
assert.throws(()=>run('evUpdateExperiment(exp.id,{name:"不能修改暂停实验"})'));
assert.equal(run('evRunExperiment(exp.id).id'),context.r.id,'paused work cannot start a duplicate run');
run('evResumeExperiment(exp.id)');assert.equal(context.r.status,'运行中');
assert.equal(JSON.stringify(context.r.results.filter(r=>['通过','未通过','运行失败'].includes(r.status))),savedBefore,'resume preserves completed output');
drain();assert.equal(context.r.status,'部分失败');assert.equal(exp.status,'部分失败');assert.equal(exp.runs.length,2);
assert(context.r.results.filter(r=>['通过','未通过','运行失败'].includes(r.status)).length>=completedBefore);
const originalResults=JSON.stringify(context.r.results),failed=context.r.results.filter(r=>['未通过','运行失败'].includes(r.status)),passed=context.r.results.filter(r=>r.status==='通过');
const completedHeader=run('evExperimentHeaderControls(exp)');
assert(!completedHeader.includes('>编辑</button>')&&completedHeader.includes('重新执行')&&completedHeader.includes('失败用例')&&completedHeader.includes('全量'));
context.retry=run('evRunExperiment(exp.id,r)');assert.notEqual(context.retry.id,context.r.id);assert.equal(context.retry.sequence,1);assert.equal(context.retry.kind,'supplement');assert.equal(context.retry.parentRunId,context.r.id);assert.equal(exp.runs.length,2);
assert.equal(context.retry.results.length,failed.length);assert.equal(context.r.supplements[0],context.retry);
assert.equal(JSON.stringify(context.r.results),originalResults);assert(Object.isFrozen(context.r.initialFullResult.results));
assert(passed.every(result=>context.r.results.includes(result)),'passed attempts keep their saved output');drain();
assert.equal(JSON.stringify(context.r.results),originalResults,'supplement retains the original full-record evidence');
context.retry=run('evRunExperiment(exp.id)');assert.equal(context.retry.sequence,3);assert.equal(exp.runs.length,4);drain();
assert(Object.isFrozen(context.retry.snapshot));
run('evExperimentOpen(exp.id,r.id)');
let markup=run('evExperimentResultTable(exp,r)');handlers(markup);
assert(markup.includes('2 次结果 展开'));assert(markup.includes('ev-case-group'));
assert(!markup.includes('ev-attempt-row'));
context.groupKey=context.r.id+':'+context.r.results[0].caseId;
run('evExperimentToggleAttempts(groupKey)');markup=run('evExperimentResultTable(exp,r)');handlers(markup);
assert(markup.includes('ev-attempt-row'));assert(markup.includes('用例执行 2 / 2'));
run('evExperimentCaseDetail(r.results[0].id)');
assert(node('overlay').innerHTML.includes('选择用例执行结果'));assert(node('overlay').innerHTML.includes('evExperimentGoSuite'));
assert(node('overlay').innerHTML.includes('评估结果'));handlers(node('overlay').innerHTML);
const history=run('evExperimentRunSelector(exp,r)');handlers(history);
assert(history.includes('评测记录'));assert(history.includes('>记录 #1 · 部分失败</button>'));assert(history.includes('title="'+context.r.startedAt));
assert(!history.includes('统计时间范围'));
// A user selection must replace an open/focused history menu, unlike passive run refreshes.
let selectorMarkup=run('evExperimentRunSelector(exp,retry)'),selectorWrites=0,summaryFocusCalls=0;
const focusedHistoryButton={};
const historyShim={querySelector(selector){return selector==='details[open]'?{}:null;},contains(target){return target===focusedHistoryButton;},get outerHTML(){return selectorMarkup;},set outerHTML(value){selectorMarkup=value;selectorWrites++;}};
const replacementSummary={focus(){summaryFocusCalls++;context.document.activeElement=this;}};
selectors.set('#ev-experiment-dashboard .ev-run-history',historyShim);
selectors.set('#ev-experiment-dashboard .ev-run-history summary',replacementSummary);
context.document.activeElement=focusedHistoryButton;
run('evExperimentState.runId=retry.id;evExperimentRefreshHistorySelector(exp,r)');
assert.equal(selectorWrites,0,'background updates preserve an open/focused execution picker');
run('evExperimentSelectRun(r.id)');
assert.equal(run('evExperimentSelectedRun(exp).id'),context.r.id);
const selectedSummary=selectorMarkup.match(/<summary\b[^>]*>([\s\S]*?)<\/summary>/)?.[1]||'';
assert(selectedSummary.includes('记录 #'+context.r.sequence)&&!selectedSummary.includes('记录 #'+context.retry.sequence),'an explicit choice updates the visible picker label to the actual selected run');
assert(selectorWrites>0&&summaryFocusCalls===1,'forced user refresh returns focus to the new summary');
const selectedResults=run('evExperimentResultTable(exp,evExperimentSelectedRun(exp))');
assert(selectedResults.includes(context.r.id)&&!selectedResults.includes(context.retry.id),'the result rows and picker display the same execution');
selectors.delete('#ev-experiment-dashboard .ev-run-history');selectors.delete('#ev-experiment-dashboard .ev-run-history summary');
context.document.activeElement=node('active');

run('evExperimentState.tab="实验配置"');assert(run('evExperimentDetailTop(exp,r)').includes('ont-badge">V1'));
run('evDashboardSetRange("experiment:"+exp.id,"yesterday")');assert.equal(run('evExperimentSelectedRun(exp).id'),context.r.id,'detail selection is independent of time ranges');
run('evExperimentState.runId=""');assert.equal(run('evExperimentSelectedRun(exp).id'),exp.runs[0].id,'default selects newest complete record');
for(const status of ['已完成','部分失败','已暂停','运行中'])assert(run('evExperimentStatus('+JSON.stringify(status)+')').includes(status==='运行中'?'执行中':status));
console.log('PASS evaluation navigation, lifecycle, immutable retries, grouped attempts, history and version links');
