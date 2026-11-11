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

// Tests exercise the same shared result drawer used by workshop and new AIOps.
const decode=value=>value.replace(/&quot;/g,'"').replace(/&#39;/g,"'").replace(/&amp;/g,'&').replace(/&lt;/g,'<').replace(/&gt;/g,'>');
const plain=value=>decode(value.replace(/<[^>]*>/g,' ')).replace(/\s+/g,' ').trim();
const overlay=()=>node('overlay').innerHTML;
const attributeElement=(markup,attribute,value)=>{
  const quoted=value.replace(/[.*+?^${}()|[\]\\]/g,'\\$&');
  const opening=new RegExp('<([a-z][a-z0-9-]*)\\b[^>]*\\b'+attribute+'="'+quoted+'"[^>]*>','i').exec(markup);
  if(!opening)return '';
  const tags=new RegExp('<\\/?'+opening[1]+'\\b[^>]*>','gi');tags.lastIndex=opening.index;
  let depth=0,tag;
  while((tag=tags.exec(markup))){depth+=tag[0].startsWith('</')?-1:1;if(!depth)return markup.slice(opening.index,tags.lastIndex);}
  throw Error('Unclosed review element: '+attribute+'="'+value+'"');
};
const hiddenValues=()=>Object.fromEntries([...overlay().matchAll(/<input\b[^>]*\btype="hidden"[^>]*>/g)].map(match=>[match[0].match(/\bname="([^"]*)"/)?.[1],decode(match[0].match(/\bvalue="([^"]*)"/)?.[1]||'')]).filter(([name])=>name));
const buttons=markup=>[...markup.matchAll(/<button\b([^>]*)>([\s\S]*?)<\/button>/g)].map(match=>({html:match[0],attributes:match[1],text:plain(match[2])}));
const click=button=>{assert(button,'expected an actionable button');const code=button.attributes.match(/\bonclick="([^"]*)"/)?.[1];assert(code,'button must be interactive');context.event={preventDefault(){},stopPropagation(){}};run(decode(code));};
const submit=(problemType,noteText,resultId,evaluatorId)=>{
  const form=node('ev-annotation-form');form.values={...(form.values||{}),...hiddenValues(),problemType,note:noteText};
  context.annotationEvent={target:form,currentTarget:form,preventDefault(){}};
  context.resultId=resultId;context.evaluatorId=evaluatorId;
  return run('evSaveExperimentResultAnnotation(annotationEvent,resultId,evaluatorId)');
};
const submitSavedForm=(fields,resultId,evaluatorId)=>{
  const form={values:{...fields}};context.annotationEvent={target:form,currentTarget:form,preventDefault(){}};
  context.resultId=resultId;context.evaluatorId=evaluatorId;
  return run('evSaveExperimentResultAnnotation(annotationEvent,resultId,evaluatorId)');
};
run("currentSection='studio';studio.scene='sales';evData();evExperimentStore()");
context.experiment=run('evExperimentStore().experiments[1]');
context.batch=context.experiment.runs[0];
context.result=context.batch.results.find(row=>row.evaluations.length>1);
assert(context.result,'seed covers several evaluators on one completed result');
run('evExperimentOpen(experiment.id,batch.id)');
run('evExperimentCaseDetail(result.id)');
let markup=overlay();handlers(markup);
assert(markup.includes('Agent 输出')&&markup.includes('输入'),'conversation includes the actual evaluation input and Agent output');
assert(markup.includes(decode(context.result.input).replace(/&/g,'&amp;'))||plain(markup).includes(context.result.input.replace(/\s+/g,' ')));
assert(plain(markup).includes(context.result.actual.replace(/\s+/g,' ')),'actual output is visible');
assert(buttons(markup).some(button=>button.text==='预期输出'),'expected output is a button');
assert(markup.includes('role="tooltip"')||buttons(markup).some(button=>button.text==='预期输出'&&button.attributes.includes('title=')),'expected output is available on hover or focus');
assert(markup.includes(context.result.expected.replace(/&/g,'&amp;').replace(/</g,'&lt;')),'expected output comes from the execution evidence');
assert(plain(markup).includes(context.result.status),'the selected result status is shown');
const initialOverview=attributeElement(markup,'aria-label','执行概览'),initialAssessment=attributeElement(markup,'aria-label','评估结果');
const resultHeader=attributeElement(markup,'class','ev-result-modal-header');
assert(initialOverview,'execution overview is a distinct top-level review region');
assert(initialAssessment,'evaluators have a separate assessment region');
assert(resultHeader.includes(initialOverview),'execution metadata is in the actual title bar, above the scrolling content');
assert.equal((markup.match(/<h2\b/g)||[]).length,1,'the case name is the only main title');
assert(!buttons(resultHeader).some(button=>['取消','关闭'].includes(button.text)),'read-only result review avoids duplicated default cancel/close actions');
const overallOutcome=[...markup.matchAll(/class="([^"]*)"/g)].filter(match=>match[1].split(/\s+/).includes('ev-result-outcome'));
assert.equal(overallOutcome.length,1,'the overall verdict has one clear home in the header');
assert(initialOverview.includes('ev-result-outcome')&&plain(initialOverview).includes(context.result.status),'the overall pass/fail judgment lives in the execution overview');
assert(!initialAssessment.includes('ev-result-outcome')&&!initialAssessment.includes('ev-result-verdict'),'the assessment column does not repeat the overall verdict');
for(const [label,value] of [['开始时间',context.result.startedAt],['结束时间',context.result.endedAt],['耗时',run('evExperimentDuration(result.durationMs)')],['Token消耗',Number(context.result.tokens).toLocaleString('zh-CN')]]){
  assert(plain(initialOverview).replace(/\s+/g,'').includes(label),'the top overview labels '+label);
  if(value)assert(plain(initialOverview).includes(String(value)),'the top overview uses saved '+label+' evidence');
}
const headingStart=markup.indexOf('ev-result-heading'),conversationStart=markup.indexOf('ev-result-columns');
assert(headingStart>=0&&headingStart<conversationStart,'the review title and summary precede the reading columns');
const headingMarkup=markup.slice(headingStart,conversationStart);
assert(headingMarkup.includes('<h2')&&plain(headingMarkup).includes(context.result.name)&&headingMarkup.includes(context.result.caseId),'main title and case identifier share the heading');
assert(plain(initialOverview).includes(context.result.version),'the saved case version is in the top overview');
const topText=plain(initialOverview).replace(/\s+/g,'');
assert(topText.includes('记录#'+context.batch.sequence),'the selected full evaluation record is explicit');assert(topText.includes('用例执行')&&topText.includes(String(context.result.attempt)),'the independent case attempt is explicit');assert(headingMarkup.includes(context.result.conversationId),'the exact independent conversation is addressable');assert(!topText.includes('批·轮·次'),'dialogue turns are not used as execution positioning');
assert(!buttons(markup).some(button=>button.text==='执行信息')&&!/<summary\b[^>]*>执行信息/.test(markup),'execution information is displayed in the header rather than a second disclosure');
assert(initialAssessment.includes('评估结果')&&!initialAssessment.includes('离线评估器评分'),'the renamed assessment section reflects multiple evaluators');
const defaultTurn=attributeElement(markup,'data-turn','1');
assert(defaultTurn&&plain(defaultTurn).includes(context.result.input.replace(/\s+/g,' '))&&plain(defaultTurn).includes(context.result.actual.replace(/\s+/g,' ')),'a default turn contains one input and its output');
const defaultTurnStats=attributeElement(defaultTurn,'aria-label','第 1 轮统计');
assert(defaultTurnStats.includes(run('evExperimentDuration(result.durationMs)'))&&defaultTurnStats.includes(Number(context.result.tokens).toLocaleString('zh-CN')),'a single turn shows its recorded token and elapsed totals');
for(const recordedTime of [context.result.startedAt,context.result.endedAt])if(recordedTime)assert(defaultTurn.includes('title="'+recordedTime+'"'),'the single-turn message headers expose their actual recorded times');
const traceButton=buttons(markup).find(button=>button.text==='Trace');
click(traceButton);markup=overlay();handlers(markup);
assert(buttons(markup).find(button=>button.text==='Trace')?.attributes.includes('aria-selected="true"'),'Trace tab becomes selected');
assert(/Trace|Span/.test(markup));
run("evExperimentCaseDetailTab(result.id,'conversation')");markup=overlay();
assert(plain(markup).includes(context.result.actual.replace(/\s+/g,' ')),'switching back restores the actual output');

// Tab focus and panels stay synchronized for mouse, keyboard and assistive technology.
const tabFocus=[];
for(const tab of ['conversation','trace'])node('ev-result-'+tab+'-tab').focus=()=>tabFocus.push(tab);
const assertSelectedTab=selected=>{
  const view=overlay(),tabs=buttons(view).filter(button=>/\brole="tab"/.test(button.attributes));
  assert.equal(tabs.length,2,'both review tabs exist');
  for(const tab of ['conversation','trace']){
    const control=tabs.find(button=>button.attributes.includes('id="ev-result-'+tab+'-tab"'));
    assert(control,'tab has a stable accessible ID');
    assert(control.attributes.includes('aria-selected="'+(tab===selected)+'"'));
    assert(control.attributes.includes('tabindex="'+(tab===selected?0:-1)+'"'),'only the selected tab participates in the tab order');
    const panel=view.match(new RegExp('<div\\b[^>]*\\bid="ev-result-'+tab+'-panel"[^>]*>'))?.[0];
    assert(panel,'aria-controls references a rendered panel');
    assert(panel.includes('aria-labelledby="ev-result-'+tab+'-tab"'),'panel labels reference the corresponding tab');
    assert.equal(/\bhidden\b/.test(panel),tab!==selected,'inactive panel is hidden');
  }
};
assertSelectedTab('conversation');
for(const [key,selected] of [['ArrowRight','trace'],['ArrowRight','conversation'],['ArrowLeft','trace'],['Home','conversation'],['End','trace']]){
  let prevented=0,stopped=0;
  context.reviewKeyEvent={key,preventDefault(){prevented++;},stopPropagation(){stopped++;}};
  run('evExperimentResultTabKey(reviewKeyEvent,result.id)');
  assertSelectedTab(selected);
  assert.equal(prevented,1,'navigation keys prevent page scrolling');
  assert.equal(stopped,1,'tab navigation does not propagate into the host page');
  assert.equal(tabFocus.at(-1),selected,'focus moves to the selected tab after rerendering');
}
context.reviewKeyEvent={key:'Escape',preventDefault(){throw Error('unhandled key must remain available to the containing drawer');}};
run('evExperimentResultTabKey(reviewKeyEvent,result.id)');assertSelectedTab('trace');
run("evExperimentCaseDetailTab(result.id,'conversation')");

// Scoring is intentionally a compact review surface, with standards in hover details.
const scoring=run('evExperimentScoringResults(result)');handlers(scoring);
const scoringCards=[...scoring.matchAll(/<article\b[^>]*class="ev-result-evaluation"/g)].map((match,index,all)=>scoring.slice(match.index,all[index+1]?.index||scoring.length));
const reviewStyles=fs.readFileSync('dist/workshop-evaluation.css','utf8');
assert(/\.ev-result-hover:is\([^)]*:hover[^)]*:focus-within[^)]*\)\s*>\s*\.ev-result-tooltip\s*\{[^}]*display:\s*block/.test(reviewStyles),'hover standards and expected outputs also open on keyboard focus');
for(const [evaluationIndex,evaluation] of context.result.evaluations.entries()){
  assert(scoring.includes(evaluation.name),'every evaluator is represented');
  assert(scoring.includes(Number(evaluation.score).toFixed(1)),'its score is visible');
  assert(scoring.includes(evaluation.reason),'its saved rationale is visible');
  const evaluatorButton=buttons(scoring).find(button=>button.text.includes(evaluation.name));
  assert(evaluatorButton&&/ev.*Evaluator|evEvaluatorDetail/.test(decode(evaluatorButton.attributes)),'evaluator name links to its detail');
  const criterionScores=attributeElement(scoringCards[evaluationIndex]||'','aria-label','评分项得分');
  assert(criterionScores,'every evaluator shows the individual criterion scores');
  assert(!/\bhidden\b/.test(criterionScores.match(/^<[^>]+>/)?.[0]||''),'criterion scores are visible without opening a tooltip or record');
  assert(scoringCards[evaluationIndex].indexOf('ev-result-score')<scoringCards[evaluationIndex].indexOf('评分项得分'),'criterion scores are presented below the evaluator total');
  for(const criterion of evaluation.criteria){
    assert(scoring.includes(criterion.description.replace(/&/g,'&amp;').replace(/</g,'&lt;')),'hover includes execution-time scoring standards');
    assert(scoring.includes(String(criterion.weight))&&scoring.includes(String(criterion.passScore)),'hover includes execution-time weight and threshold');
    assert(plain(criterionScores).includes(criterion.name)&&plain(criterionScores).includes(Number(criterion.score).toFixed(1)),'each visible criterion score comes from its own saved evaluation');
  }
}
const headings=[...scoring.matchAll(/<th\b[^>]*>([\s\S]*?)<\/th>/g)].map(match=>plain(match[1]));
assert(!headings.some(label=>['版本','评分项','评分标准','权重','通过分数','判定','逐项判定'].includes(label)),'standards and per-criterion judgments are not extra visible table columns');
const evaluatorAnnotationButtons=buttons(scoring).filter(button=>/evExperimentAnnotateResult\(/.test(decode(button.attributes)));
assert.equal(evaluatorAnnotationButtons.length,context.result.evaluations.length,'each evaluator result offers annotation');
for(const button of evaluatorAnnotationButtons){assert(button.html.includes('<svg')&&button.text===''&&/aria-label="[^"]*标注/.test(button.attributes),'annotation uses an accessible icon with no redundant visible text');}
context.evaluatorCalls=[];
run('const originalEvaluatorDetailForReview=evEvaluatorDetail;evEvaluatorDetail=function(...args){evaluatorCalls.push(args);}');
click(buttons(scoring).find(button=>button.text===context.result.evaluations[0].name));
assert.equal(context.evaluatorCalls[0]?.[0],context.result.evaluations[0].evaluatorId,'clicking an evaluator opens that evaluator, rather than only showing a decorative link');
run('evEvaluatorDetail=originalEvaluatorDetailForReview;evExperimentCaseDetail(result.id)');

// Actual multi-turn conversations render each saved input/output and each turn's own expectation.
context.result.messages=[
  {role:'user',content:'首轮输入 <库存> & 渠道'},
  {role:'assistant',content:'首轮输出 <方案一>',expected:'首轮预期 <明细>',durationMs:125,tokens:71},
  {role:'user',content:'第二轮追加约束'},
  {role:'assistant',content:'第二轮输出 <方案二>',expected:'第二轮预期 <确认>',durationMs:240,tokens:109}
];
run('evExperimentCaseDetail(result.id)');markup=overlay();handlers(markup);
for(const message of context.result.messages)assert(plain(markup).includes(message.content),'every saved conversation message is readable');
assert.equal(buttons(markup).filter(button=>button.text==='预期输出').length,2,'each Agent message has its own expected-output control');
assert(markup.includes('&lt;明细&gt;')&&markup.includes('&lt;确认&gt;'),'per-turn expected outputs are preserved and escaped');
assert(!markup.includes('<库存>')&&!markup.includes('<方案一>'),'conversation content is escaped');
for(const [index,elapsed,tokens] of [[1,'125 ms','71'],[2,'240 ms','109']]){
  const turn=attributeElement(markup,'data-turn',String(index)),statistics=attributeElement(turn,'aria-label','第 '+index+' 轮统计');
  assert(turn,'each question/answer pair is a distinct turn');
  assert(plain(turn).includes(context.result.messages[(index-1)*2].content)&&plain(turn).includes(context.result.messages[(index-1)*2+1].content),'each turn owns the matching user question and Agent answer');
  assert(!plain(turn).includes(context.result.messages[(2-index)*2].content),'another turn is not nested into this one');
  assert(plain(statistics).includes(elapsed)&&plain(statistics).includes(tokens),'turn metrics come from that answer instead of the overall execution');
}
const outputAnnotationButtons=buttons(markup).filter(button=>/evExperimentAnnotateOutput\(/.test(decode(button.attributes)));
assert.equal(outputAnnotationButtons.length,2,'each actual Agent answer has its own annotation entry');
for(const button of outputAnnotationButtons)assert(button.html.includes('<svg')&&button.text===''&&/aria-label="[^"]*标注/.test(button.attributes),'Agent-output annotations use the same accessible icon-only action');
const beforeOutputReviews=JSON.stringify(context.result),beforeOutputReport=JSON.stringify(context.batch.report);
run('evExperimentAnnotateOutput(result.id,1)');markup=overlay();handlers(markup);
assert(markup.includes('ev-annotation-dialog')&&markup.includes('name="problemType"')&&markup.includes('name="note"'),'Agent annotations use the shared problem-type dialog');
submit('内容不完整','第一轮输出需补充规则依据',context.result.id,'output:1');
assert.equal(run('evExperimentOutputAnnotation(result.id,1).note'),'第一轮输出需补充规则依据');
assert.equal(run('evExperimentOutputAnnotation(result.id,1).targetType'),'output');
assert.equal(run('evExperimentOutputAnnotation(result.id,1).turn'),1);
run('evExperimentAnnotateOutput(result.id,2)');
assert(!plain(overlay()).includes('第一轮输出需补充规则依据'),'output reviews do not bleed into another turn');
submit('约束未遵循','第二轮输出需重新核验约束',context.result.id,'output:2');
assert.equal(run('evExperimentOutputAnnotation(result.id,1).note'),'第一轮输出需补充规则依据');
assert.equal(run('evExperimentOutputAnnotation(result.id,2).note'),'第二轮输出需重新核验约束');
run('evExperimentAnnotateResult(result.id,result.evaluations[0].evaluatorId)');
assert(!plain(overlay()).includes('第一轮输出需补充规则依据')&&!plain(overlay()).includes('第二轮输出需重新核验约束'),'evaluator reviews are separate from Agent-message reviews');
assert.equal(JSON.stringify(context.result),beforeOutputReviews,'annotating a message preserves original input, output, costs and scores');
assert.equal(JSON.stringify(context.batch.report),beforeOutputReport,'annotating a message preserves the frozen report');
run('evExperimentCaseDetail(result.id)');
context.noMetricMessages=JSON.parse(JSON.stringify(context.result.messages));
for(const message of context.noMetricMessages){delete message.durationMs;delete message.tokens;}
context.result.messages=context.noMetricMessages;
run('evExperimentCaseDetail(result.id)');markup=overlay();
for(const index of [1,2]){
  const statistics=attributeElement(markup,'aria-label','第 '+index+' 轮统计');
  assert(statistics&&plain(statistics).includes('—'),'missing per-turn metrics are left unavailable');
  assert(!statistics.includes(run('evExperimentDuration(result.durationMs/2)'))&&!statistics.includes(String(context.result.tokens/2)),'aggregate metrics are not divided to invent turn measurements');
}
delete context.result.messages;
context.result.turns=[{input:'turns字段问题',output:'turns字段回答',expected:'turns字段预期',durationMs:0,tokens:0}];
run('evExperimentCaseDetail(result.id)');markup=overlay();
assert(plain(attributeElement(markup,'data-turn','1')).includes('turns字段问题')&&plain(attributeElement(markup,'data-turn','1')).includes('turns字段回答'),'explicit turn records use the same paired conversation layout');
const zeroTurnStats=attributeElement(markup,'aria-label','第 1 轮统计');
assert(plain(zeroTurnStats).includes('0 ms')&&!plain(zeroTurnStats).includes('—'),'recorded zero costs remain zero rather than unavailable');
delete context.result.turns;
// A missing answer remains an incomplete turn; observed time and zero-token measurements stay explicit.
context.result.messages=[
  {role:'user',content:'按时间核验第一问',timestamp:'2026-11-07T10:00:00.100+08:00'},
  {role:'assistant',content:'按时间核验第一答',timestamp:'2026-11-07T10:00:00.225+08:00',usage:{input_tokens:0,output_tokens:0}},
  {role:'user',content:'按时间核验第二问',created_at:'2026-11-07T10:00:01.000+08:00'},
  {role:'assistant',content:'按时间核验第二答',created_at:'2026-11-07T10:00:01.400+08:00',usage:{totalTokens:13}},
  {role:'user',content:'第三问尚无回复',timestamp:'2026-11-07T10:00:02.000+08:00'}
];
run('evExperimentCaseDetail(result.id)');markup=overlay();
const timestampTurns=snapshot('evExperimentResultTurns(result)');
assert.deepEqual(timestampTurns.map(turn=>[turn.durationMs,turn.tokens,turn.hasOutput]),[[125,0,true],[400,13,true],[null,null,false]],'per-turn timestamps and recorded token usage stay attached to their own question/answer pair');
const incompleteTurn=attributeElement(markup,'data-turn','3'),incompleteStatistics=attributeElement(incompleteTurn,'aria-label','第 3 轮统计');
assert(plain(incompleteTurn).includes('第三问尚无回复')&&plain(incompleteTurn).includes('等待 Agent 输出'),'an unanswered question is visible as an incomplete round');
assert(!plain(incompleteTurn).includes(context.result.actual.replace(/\s+/g,' ')),'the previous aggregate output is never reused as the missing answer');
assert(plain(incompleteStatistics).includes('—'),'missing turn measurements are not replaced by another round or aggregate costs');
assert(!buttons(incompleteTurn).some(button=>/evExperimentAnnotateOutput\(/.test(decode(button.attributes))),'an unanswered turn has no imaginary output to annotate');
assert.equal(run('evExperimentAnnotateOutput(result.id,3)'),false,'an invalid annotation request for an unanswered turn is rejected');
delete context.result.messages;
context.result.turns=[
  {input:'明确标记为未回复',hasOutput:false,output:'旧的输出内容不应展示',expected:'这一轮独立的预期输出',durationMs:125,tokens:0},
  {input:'已完成的另一问',output:'已完成的另一答',durationMs:230,tokens:25}
];
run('evExperimentCaseDetail(result.id)');markup=overlay();
const flaggedTurns=snapshot('evExperimentResultTurns(result)');
assert.equal(flaggedTurns[0].hasOutput,false,'hasOutput=false overrides any stale output field');
assert(!plain(attributeElement(markup,'data-turn','1')).includes('旧的输出内容不应展示'),'an explicitly missing answer cannot expose a stale message');
assert.deepEqual([flaggedTurns[0].durationMs,flaggedTurns[0].tokens],[125,0],'an unanswered round retains its own measured elapsed time and zero token usage');
assert.equal(flaggedTurns[0].expected,'这一轮独立的预期输出','an unanswered round keeps its own expected output for the hover control');
assert(plain(attributeElement(markup,'data-turn','1')).includes('这一轮独立的预期输出'),'the pending round hover does not borrow the aggregate expectation');
delete context.result.turns;
for(const invalidMetric of [true,false,{},[],null,undefined,'','   ',-1,Infinity]){
  context.invalidMetric=invalidMetric;
  assert.equal(run('evExperimentResultMetric(invalidMetric)'),null,'non-numeric or unavailable values are never interpreted as measured costs');
}
const originalFallback={actual:context.result.actual,status:context.result.status,durationMs:context.result.durationMs,tokens:context.result.tokens};
Object.assign(context.result,{actual:'',status:'运行失败',durationMs:333,tokens:0});
run('evExperimentCaseDetail(result.id)');markup=overlay();
const noOutputFallback=snapshot('evExperimentResultTurns(result)');
assert.equal(noOutputFallback.length,1);assert.equal(noOutputFallback[0].hasOutput,false,'a failed default result does not invent an assistant message');
assert(plain(attributeElement(markup,'data-turn','1')).includes('本次执行未产生输出'),'a runtime failure explains the missing output');
assert.deepEqual([noOutputFallback[0].durationMs,noOutputFallback[0].tokens],[333,0],'failed execution still keeps its actually measured cost');
Object.assign(context.result,originalFallback);
context.result.trace={spans:[
  {name:'库存查询 <工具>',status:'完成',durationMs:125,input:{sku:'<A>&B'},output:'库存结果 <24>'},
  {name:'生成分货方案',type:'model',status:'完成',durationMs:230,input:'受限渠道 & 约束',output:{decision:'<通过>'}}
]};
run("evExperimentCaseDetailTab(result.id,'trace')");markup=overlay();handlers(markup);
for(const span of context.result.trace.spans)assert(plain(markup).includes(span.name),'Trace shows each recorded span');
assert(!markup.includes('ev-review-trace-inspector-tabs')&&!markup.includes('Trace 记录显示方式'),'Trace exposes no inspector mode switch');
for(const control of buttons(attributeElement(markup,'aria-label','Trace 记录')))assert(control.attributes.includes('aria-expanded="false"'),'every Span starts collapsed');
run('evExperimentTraceToggle(result.id,0)');markup=overlay();handlers(markup);
assert(markup.includes('&lt;A&gt;&amp;B')&&markup.includes('&lt;24&gt;'),'selected Trace input/output content is escaped, including object values');
run('evExperimentTraceToggle(result.id,1)');markup=overlay();handlers(markup);
assert(markup.includes('&lt;通过&gt;')&&markup.includes('&lt;24&gt;'),'each Span independently expands its own raw JSON while other Spans remain open');
assert(!attributeElement(markup,'id','ev-review-trace-raw-0').match(/^<[^>]+\bhidden\b/)&&!attributeElement(markup,'id','ev-review-trace-raw-1').match(/^<[^>]+\bhidden\b/),'multiple raw records can remain expanded at once');
run("evExperimentCaseDetailTab(result.id,'conversation');evExperimentCaseDetailTab(result.id,'trace')");markup=overlay();
assert(markup.includes('&lt;24&gt;')&&markup.includes('&lt;通过&gt;'),'switching content tabs preserves the current result disclosure state');
run('evExperimentTraceToggle(result.id,0)');markup=overlay();
assert(/\bhidden\b/.test(attributeElement(markup,'id','ev-review-trace-raw-0').match(/^<[^>]+>/)?.[0]||'')&&!markup.includes('&lt;24&gt;'),'clicking the open Span collapses only its own raw record');
assert(!markup.includes('<工具>')&&!markup.includes('<24>'),'Trace content cannot inject markup');
assert(plain(markup).includes('125 ms')&&plain(markup).includes('230 ms'),'Trace durations come from recorded spans');
run("evExperimentCaseDetailTab(result.id,'conversation')");
const runStatusBefore=context.result.status;

// Review writes are independent from automatic evaluator evidence.
const evidenceBefore=JSON.stringify(context.result),reportBefore=JSON.stringify(context.batch.report),runCount=context.experiment.runs.length;
const firstEvaluator=context.result.evaluations[0],secondEvaluator=context.result.evaluations[1];
context.firstEvaluatorId=firstEvaluator.evaluatorId;
run('evExperimentAnnotateResult(result.id,firstEvaluatorId)');markup=overlay();handlers(markup);
assert(markup.includes('name="problemType"')&&markup.includes('name="note"'),'annotation form contains a problem type and content');
assert(!markup.includes('name="decision"'),'annotation no longer asks for an artificial pass/fail verdict');
assert(markup.includes('ev-annotation-dialog')&&markup.includes('role="dialog"'),'annotation opens as a dedicated dialog rather than a side drawer');
assert(buttons(markup).some(button=>button.text==='保存标注')&&buttons(markup).some(button=>button.text==='取消'),'annotation dialog exposes conventional save and cancel actions');
const annotationsBefore=run('JSON.stringify(Array.from(evExperimentResultAnnotations))');
submit('not-a-problem-type','无效',context.result.id,firstEvaluator.evaluatorId);
assert.equal(JSON.stringify(context.result),evidenceBefore,'invalid review cannot change evaluator evidence');
assert.equal(run('JSON.stringify(Array.from(evExperimentResultAnnotations))'),annotationsBefore,'invalid review cannot create a saved annotation');
assert.equal(submit('评分不合理','   ',context.result.id,firstEvaluator.evaluatorId),false,'annotation content is required');
assert.equal(submit('输出不准确','x'.repeat(4001),context.result.id,firstEvaluator.evaluatorId),false,'oversized review notes are rejected');
assert.equal(run('JSON.stringify(Array.from(evExperimentResultAnnotations))'),annotationsBefore,'rejected note length creates no saved annotation');
const reviewNote='人工复核：<script>不应执行</script> & 保留原始判断';
submit('评分不合理',reviewNote,context.result.id,firstEvaluator.evaluatorId);
assert.equal(JSON.stringify(context.result),evidenceBefore,'human review does not rewrite automatic status, scores, standards or reasons');
assert.equal(context.result.status,runStatusBefore,'review verdict does not replace the automatic pass/fail result');
assert.equal(context.experiment.runs.length,runCount,'annotation creates no execution batch');
assert.equal(JSON.stringify(context.batch.report),reportBefore,'human annotations preserve the frozen experiment report');
run('evExperimentCaseDetail(result.id)');markup=overlay();handlers(markup);
assert(!markup.includes('<script>不应执行</script>'),'annotation text is escaped');
assert(plain(markup).includes(reviewNote)||markup.includes('已标注'),'saved review is discoverable from the result');
run('evExperimentAnnotateResult(result.id,firstEvaluatorId)');markup=overlay();
assert(/<option[^>]*value="评分不合理"[^>]*selected/.test(markup)&&markup.includes('&lt;script&gt;不应执行&lt;/script&gt;'),'editing annotation restores the saved problem type and content');
context.secondEvaluatorId=secondEvaluator.evaluatorId;
run('evExperimentAnnotateResult(result.id,secondEvaluatorId)');markup=overlay();
assert(!plain(markup).includes(reviewNote),'different evaluators do not share annotations');
submit('输出不准确','第二个评估器独立标注',context.result.id,secondEvaluator.evaluatorId);
run('evExperimentAnnotateResult(result.id,firstEvaluatorId)');
assert(overlay().includes('&lt;script&gt;不应执行&lt;/script&gt;'),'annotating another evaluator preserves the first review');

const another=context.batch.results.find(row=>row.id!==context.result.id&&row.evaluations.some(evaluation=>evaluation.evaluatorId===firstEvaluator.evaluatorId));
assert(another,'seed includes another completed case with the same evaluator');
context.otherResultId=another.id;
run('evExperimentAnnotateResult(otherResultId,firstEvaluatorId)');
assert(!plain(overlay()).includes(reviewNote),'annotations are scoped by result, not just evaluator');

// A result archived by a same-batch rerun keeps a separate review from its replacement.
context.archived=JSON.parse(JSON.stringify(context.result));
context.archived.id+='-ARCHIVED';
context.batch.reexecutions=[...(context.batch.reexecutions||[]),{results:[context.archived]}];
run('evExperimentCaseDetail(archived.id)');markup=overlay();handlers(markup);
assert(plain(markup).includes('重跑前证据'),'archived evidence is visibly distinguished from the replacement result');
assert(!plain(markup).includes(reviewNote),'the replacement review is not attributed to archived evidence');
run('evExperimentAnnotateResult(archived.id,firstEvaluatorId)');
assert(!plain(overlay()).includes(reviewNote),'archived annotation editor starts separately');
const archivedBefore=JSON.stringify(context.archived);
submit('其他','重跑前证据独立复核',context.archived.id,firstEvaluator.evaluatorId);
assert.equal(JSON.stringify(context.archived),archivedBefore,'annotating archived evidence preserves its original scores and output');
run('evExperimentAnnotateResult(result.id,firstEvaluatorId)');
assert(overlay().includes('&lt;script&gt;不应执行&lt;/script&gt;')&&!plain(overlay()).includes('重跑前证据独立复核'),'archived review does not overwrite the replacement review');
run('evExperimentAnnotateResult(archived.id,firstEvaluatorId)');
assert(plain(overlay()).includes('重跑前证据独立复核'),'archived review can be reopened independently');
assert.equal(context.experiment.runs.length,runCount,'archived review also creates no execution batch');

// A stale editor cannot write into another result, evaluator, experiment or scene.
run('evExperimentAnnotateResult(result.id,firstEvaluatorId)');
const beforeStaleSubmit=run('JSON.stringify(Array.from(evExperimentResultAnnotations))');
assert.equal(submit('输出不准确','wrong evaluator',context.result.id,secondEvaluator.evaluatorId),false);
assert.equal(submit('输出不准确','wrong result',another.id,firstEvaluator.evaluatorId),false);
run('evExperimentOpen(evExperimentStore().experiments[2].id)');
assert.equal(submit('输出不准确','stale experiment',context.result.id,firstEvaluator.evaluatorId),false);
run("studio.scene='procurement';evData();evExperimentStore();evExperimentOpen(evExperimentStore().experiments[0].id)");
assert.equal(submit('输出不准确','stale scene',context.result.id,firstEvaluator.evaluatorId),false);
assert.equal(run('JSON.stringify(Array.from(evExperimentResultAnnotations))'),beforeStaleSubmit,'stale editors never create or replace reviews');
run("studio.scene='sales';evData();evExperimentOpen(experiment.id,batch.id)");

run('evExperimentAnnotateResult(result.id,firstEvaluatorId)');
const closedForm={...hiddenValues(),problemType:'输出不准确',note:'已关闭的旧表单'};
run('evCloseModal()');
assert.equal(submitSavedForm(closedForm,context.result.id,firstEvaluator.evaluatorId),false,'closing a review invalidates its form');
run('evExperimentAnnotateResult(result.id,firstEvaluatorId)');
const cancelledForm={...hiddenValues(),problemType:'输出不准确',note:'返回结果前的旧表单'};
run('evExperimentCaseDetail(result.id)');
assert.equal(submitSavedForm(cancelledForm,context.result.id,firstEvaluator.evaluatorId),false,'returning to case results invalidates the cancelled form');
run('evExperimentAnnotateResult(result.id,firstEvaluatorId)');
const oldTokenForm={...hiddenValues(),problemType:'输出不准确',note:'同一结果的旧表单'};
run('evExperimentAnnotateResult(result.id,firstEvaluatorId)');
assert.notEqual(hiddenValues().annotationToken,oldTokenForm.annotationToken,'reopening the same review produces a new form identity');
assert.equal(submitSavedForm(oldTokenForm,context.result.id,firstEvaluator.evaluatorId),false,'an old same-key form cannot overwrite a reopened review');
assert.equal(run('JSON.stringify(Array.from(evExperimentResultAnnotations))'),beforeStaleSubmit,'close, cancel and token rejection leave stored reviews unchanged');
assert(submit('其他','重新打开后的有效表单',context.result.id,firstEvaluator.evaluatorId),'rejecting the old form leaves the current form able to save');
assert.equal(run('evExperimentResultAnnotation(result.id,firstEvaluatorId).note'),'重新打开后的有效表单');

// Pending and execution failures stay readable without inventing evaluator scores.
context.pendingExperiment=run('evExperimentStore().experiments[2]');
run('evExperimentOpen(pendingExperiment.id)');
context.pendingId=run('evExperimentDisplayResults(pendingExperiment,null)[0].id');
run('evExperimentCaseDetail(pendingId)');markup=overlay();handlers(markup);
assert(markup.includes('输入')&&markup.includes('Trace'),'pending cases keep the same readable inspection structure');
assert(!buttons(markup).some(button=>/evExperimentAnnotate(?:Result|Output)\(/.test(decode(button.attributes))),'a pending case has no invented evaluator result or Agent output to annotate');
run('evExperimentOpen(experiment.id,batch.id)');
context.failed=context.batch.results.find(row=>row.status==='运行失败');
if(context.failed){run('evExperimentCaseDetail(failed.id)');markup=overlay();assert(plain(markup).includes('运行失败'));assert(!buttons(markup).some(button=>/evExperimentAnnotate(?:Result|Output)\(/.test(decode(button.attributes))));}

console.log('PASS shared paired conversations, evaluator sub-scores, accessible annotation dialogs and independent raw Trace disclosures');
