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

// Trace records remain actual evidence: no generated spans or invented timing.
const overlay=()=>node('overlay').innerHTML;
const decode=value=>value.replace(/&quot;/g,'"').replace(/&#39;/g,"'").replace(/&amp;/g,'&').replace(/&lt;/g,'<').replace(/&gt;/g,'>');
const click=markup=>{const code=markup.match(/onclick="([^"]*)"/)?.[1];assert(code);run(decode(code));};
run("currentSection='studio';studio.scene='sales';evData();evExperimentStore()");
context.experiment=run('evExperimentStore().experiments[1]');
context.batch=context.experiment.runs[0];context.result=context.batch.results.find(result=>result.evaluations.length);
run('evExperimentOpen(experiment.id,batch.id)');
const mockTrace=JSON.parse(JSON.stringify(context.result.trace)),originalStatus=context.result.status,originalActual=context.result.actual,originalScores=JSON.stringify(context.result.evaluations);
assert.equal(mockTrace.mock,true,'completed Mock examples have an explicitly labeled local trace');
assert(mockTrace.notice.includes('模拟轨迹')&&mockTrace.notice.includes('耗时为演示值'));
assert(mockTrace.spans.every(span=>span.mock===true&&span.timing==='simulated'));
assert(!mockTrace.spans.some(span=>['tool','model'].includes(span.type)),'the local trace never invents remote model or tool calls');
assert.equal(mockTrace.spans.filter(span=>span.evaluatorId).length,context.result.evaluations.length,'every actual local evaluation has its own record');
for(const evaluation of context.result.evaluations)assert.deepEqual(mockTrace.spans.find(span=>span.evaluatorId===evaluation.evaluatorId).output,JSON.parse(JSON.stringify(evaluation)),'local scoring records preserve the exact evaluator evidence');
assert.equal(mockTrace.spans.filter(span=>span.parentId!==null).reduce((sum,span)=>sum+span.durationMs,0),context.result.durationMs,'simulated local phase durations partition the saved demo duration');
assert.equal(mockTrace.spans.find(span=>span.type==='user').input,context.result.input);
assert.equal(mockTrace.spans.find(span=>span.name==='生成 Mock Agent 输出').output,context.result.actual);
assert.equal(mockTrace.spans.find(span=>span.name==='生成 Mock Agent 输出').tokens,context.result.tokens);
assert.equal(context.result.status,originalStatus);assert.equal(context.result.actual,originalActual);assert.equal(JSON.stringify(context.result.evaluations),originalScores,'trace generation cannot alter judgments or output');
let mockMarkup=run('evExperimentResultTrace(evExperimentCaseDetailContext(result.id))');assert(mockMarkup.includes('本地 Mock · 模拟轨迹，耗时为演示值'),'the visible trace discloses simulated timing');
context.failedMock=run('evExperimentStore().experiments[0].runs[0].results.find(result=>result.status==="运行失败")');
assert(context.failedMock.trace.mock&&context.failedMock.trace.spans.some(span=>span.status==='error'&&span.error===context.failedMock.reason));
assert(!context.failedMock.trace.spans.some(span=>span.evaluatorId),'runtime failures have no fabricated scoring records');
assert.equal(run('evExperimentMockTrace(experiment,{status:"待运行"})'),null,'pending execution has no completed trace');
delete context.result.trace;
let markup=run('evExperimentResultTrace(evExperimentCaseDetailContext(result.id))');
assert(markup.includes('暂无 Trace 记录')&&markup.includes('未记录真实模型或工具调用 Trace'));
for(const label of ['<dt>开始时间</dt>','<dt>结束时间</dt>','<dt>耗时</dt>','<dt>Tokens</dt>'])assert(!markup.includes(label),'the empty Trace does not repeat the title metrics');
const stamp=Date.parse('2026-11-01T12:00:00Z');
context.result.trace={spans:[
 {id:'agent',name:'分货 Agent <运行>',type:'agent',status:'completed',startedAtMs:stamp,durationMs:400,input:'Agent输入 <全部>',output:'Agent最终结果'},
 {span_id:'model',parent_span_id:'agent',name:'推理模型',type:'llm',status:'success',startTimeMs:stamp+20,duration_ms:250,input:{prompt:'模型输入 <库存>'},output:'模型方案 <分配>',tokens:120,round:1},
 {id:'query',parentId:'model',name:'查询 <工具>',type:'tool',status:'error',startedAtMs:stamp+35,durationMs:100,input:'工具输入 <仓库>',output:null,error:'错误 <超时>'}
]};
const evidence=JSON.stringify(context.result.trace);
run("evExperimentCaseDetailTab(result.id,'trace')");markup=overlay();handlers(markup);
assert(markup.includes('role="tree"')&&markup.includes('aria-level="3"'),'parent IDs form a tree');
assert(markup.includes('is-agent')&&markup.includes('is-model')&&markup.includes('is-tool'),'record types have separate badges and tracks');
assert(markup.includes('执行时间线')&&markup.includes('left:5.000%;width:62.500%'),'absolute saved timestamps determine timeline position and saved duration determines width');
assert.equal((markup.match(/aria-expanded="false"/g)||[]).length,3,'every span starts collapsed');
assert(!markup.includes('Agent输入 &lt;全部&gt;')&&!markup.includes('模型输入 &lt;库存&gt;'),'collapsed spans do not expose their raw records');
assert(!markup.includes('ev-review-trace-inspector')&&!markup.includes('Trace 记录显示方式'),'the display-mode tabs and separate inspector are removed');
assert(!markup.includes('<运行>')&&!markup.includes('<工具>'),'record names are escaped');
run('evExperimentTraceToggle(result.id,1)');markup=overlay();handlers(markup);
assert(markup.includes('模型输入 &lt;库存&gt;')&&markup.includes('模型方案 &lt;分配&gt;')&&markup.includes('&quot;parent_span_id&quot;'),'expanding a span shows only its complete original JSON');
assert(!markup.includes('Agent输入 &lt;全部&gt;')&&!markup.includes('工具输入 &lt;仓库&gt;'),'other spans stay closed');
assert.equal(run("evExperimentResultDetailTabs.get(evExperimentResultReviewKey(evExperimentCaseDetailContext(result.id)))"),'trace','expansion keeps the Trace tab open');
run('evExperimentTraceToggle(result.id,0)');markup=overlay();
assert(markup.includes('Agent输入 &lt;全部&gt;')&&markup.includes('模型输入 &lt;库存&gt;'),'several spans can be expanded independently');
assert.equal((markup.match(/aria-expanded="true"/g)||[]).length,2);
run('evExperimentTraceToggle(result.id,1)');markup=overlay();
assert(markup.includes('Agent输入 &lt;全部&gt;')&&!markup.includes('模型输入 &lt;库存&gt;'),'clicking the same span closes only its own raw record');
run("evExperimentCaseDetailTab(result.id,'conversation');evExperimentCaseDetailTab(result.id,'trace')");markup=overlay();
assert(markup.includes('Agent输入 &lt;全部&gt;')&&!markup.includes('模型输入 &lt;库存&gt;'),'switching content tabs preserves each span expansion state');
run('evExperimentTraceToggle(result.id,2)');markup=overlay();
assert(markup.includes('工具输入 &lt;仓库&gt;')&&markup.includes('错误 &lt;超时&gt;')&&markup.includes('&quot;output&quot;: null'),'the original record preserves error and null output fields');
assert.equal(JSON.stringify(context.result.trace),evidence,'review and expansion never mutate evidence');
const expandedBeforeNavigation=run('JSON.stringify(evExperimentTraceView(evExperimentCaseDetailContext(result.id)).expanded)');
for(const [key,index] of [['ArrowLeft',1],['ArrowRight',2],['Home',0],['End',2],['ArrowUp',1],['ArrowDown',2]]){
 context.keyEvent={key,prevented:false,stopped:false,preventDefault(){this.prevented=true;},stopPropagation(){this.stopped=true;}};
 run('evExperimentTraceKey(keyEvent,result.id,evExperimentTraceView(evExperimentCaseDetailContext(result.id)).index)');
 assert(context.keyEvent.prevented&&context.keyEvent.stopped);
 assert.equal(run('evExperimentTraceView(evExperimentCaseDetailContext(result.id)).index'),index,'keyboard focus follows tree ordering');
 assert.equal(run('JSON.stringify(evExperimentTraceView(evExperimentCaseDetailContext(result.id)).expanded)'),expandedBeforeNavigation,'navigation does not toggle raw records');
}
for(const key of ['Enter',' ']){context.keyEvent={key,preventDefault(){throw Error('native activation must remain available');}};run('evExperimentTraceKey(keyEvent,result.id,0)');}
const before=run('JSON.stringify(Array.from(evExperimentTraceViews))');assert.equal(run('evExperimentTraceSelect(result.id,99)'),false);
assert.equal(run('evExperimentTraceToggle(result.id,99)'),false);assert.equal(run('JSON.stringify(Array.from(evExperimentTraceViews))'),before,'invalid span IDs do not mutate expansion or focus');
assert.equal(run('typeof evExperimentTraceInspectorTab'),'undefined','the obsolete inspector-mode action is removed');
context.other=context.batch.results.find(result=>result.id!==context.result.id);context.other.trace={spans:[{id:'other',name:'独立记录',input:'另一结果输入',durationMs:0},{id:'other2',name:'独立记录2',input:'另一结果输入2'}]};
markup=run('evExperimentResultTrace(evExperimentCaseDetailContext(other.id))');assert.equal((markup.match(/aria-expanded="false"/g)||[]).length,2,'another execution starts with all spans collapsed');
run('evExperimentTraceToggle(other.id,1)');assert.equal(run('evExperimentTraceView(evExperimentCaseDetailContext(result.id)).index'),2,'each execution result preserves its own focus');
assert.equal(run('JSON.stringify(evExperimentTraceView(evExperimentCaseDetailContext(result.id)).expanded)'),expandedBeforeNavigation,'another execution does not alter expansion state');
run('evExperimentCaseDetail(result.id)');assert(overlay().includes('工具输入 &lt;仓库&gt;')&&overlay().includes('Agent输入 &lt;全部&gt;'),'returning restores expanded spans');
context.result.trace=[{id:'a',parentId:'b',name:'循环父',durationMs:25},{id:'b',parentId:'a',name:'循环子',durationMs:50},{id:'c',name:'未知耗时',durationMs:-1}];
markup=run('evExperimentResultTrace(evExperimentCaseDetailContext(result.id))');handlers(markup);
assert.equal((markup.match(/data-trace-index=/g)||[]).length,3,'malformed cycles cannot drop records or recurse indefinitely');
assert(markup.includes('记录耗时')&&markup.includes('仅比较各记录耗时'),'missing starts use an explicitly labeled duration comparison');
assert(!markup.includes('NaN')&&!markup.includes('Infinity')&&!markup.includes('width:-'),'unknown/invalid duration does not create fabricated timing');
context.result.trace={spans:[{name:'零时长',startOffsetMs:0,durationMs:0},{name:'偏移',startOffsetMs:10,durationMs:30}]};
markup=run('evExperimentResultTrace(evExperimentCaseDetailContext(result.id))');assert(markup.includes('left:25.000%;width:75.000%'),'explicit relative offsets define real timeline placement');
assert(markup.includes('0 ms'),'zero duration is shown as recorded zero');
assert.equal(JSON.stringify(context.result.trace),JSON.stringify({spans:[{name:'零时长',startOffsetMs:0,durationMs:0},{name:'偏移',startOffsetMs:10,durationMs:30}]}));
context.freshExperiment=run('evExperimentStore().experiments[2]');context.freshRun=run('evRunExperiment(freshExperiment.id)');
assert(context.freshRun.results.every(result=>!result.trace),'new pending attempts do not present old traces');drain();
for(const result of context.freshRun.results.filter(result=>['通过','未通过','运行失败'].includes(result.status))){assert(result.trace.mock);assert(result.trace.spans.every(span=>span.id.startsWith(result.id+'-mock-trace')),'completed traces belong to the exact newly executed result');}
const preserved=JSON.stringify(context.freshRun.results.filter(result=>['未通过','运行失败'].includes(result.status)).map(result=>result.trace));
context.retried=run('evRunExperiment(freshExperiment.id,freshRun)');assert(context.retried.results.every(result=>!result.trace),'supplements clear stale traces while pending');drain();
assert.equal(JSON.stringify(context.freshRun.results.filter(result=>['未通过','运行失败'].includes(result.status)).map(result=>result.trace)),preserved,'archived traces preserve the previous execution');
assert(context.retried.results.every(result=>result.trace?.mock),'newly completed retries regenerate their own local trace');
console.log('PASS result Trace: span hierarchy/timing, independent raw-record folds, keyboard focus, scope isolation, empty states and escaped evidence');
