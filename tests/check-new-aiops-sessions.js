// Request-level execution contracts: turns, steps, containers and internal events are distinct.
const fs=require('fs'),vm=require('vm'),assert=require('assert');
const html=fs.readFileSync('dist/aiops-extensions.html','utf8');
const source=html.match(/<script>([\s\S]*?)<\/script>/)[1];
const context=vm.createContext({console,setTimeout(){},clearTimeout(){}});
vm.runInContext(source.slice(0,source.lastIndexOf('\nstate.composerSkill=null;')),context);
const read=code=>JSON.parse(vm.runInContext(`JSON.stringify(${code})`,context));
const sessions=read('observedSessions'),allIds=new Set();
for(const session of sessions){
 const record=read(`observedRecord(observedSessions.find(s=>s.id==='${session.id}'))`),execution=record.execution;
 assert.equal(record.messages.length,session.messages);assert.equal(record.turns.length,Math.floor(session.messages/2));assert.equal(record.timezone,'+08:00');
 assert.equal(execution.scope,'session');assert.equal(execution.duration_ms,parseFloat(session.duration)*1000);assert.equal(execution.tokens,Math.round(parseFloat(session.tokens)*1e6));
 assert.equal(execution.steps.length,record.turns.length*8+session.errors);
 assert.equal(execution.steps.filter(s=>s.type==='ontology').length,record.turns.length*2);
 assert.equal(execution.steps.filter(s=>s.type==='llm').length,record.turns.length*2);
 assert.equal(execution.steps.filter(s=>s.type==='output').length,record.turns.length);
 assert.equal(execution.steps.filter(s=>s.status==='error').length,session.errors);assert.equal(execution.steps.filter(s=>s.status==='warning').length,session.warnings);
 assert.equal(record.traces.reduce((n,t)=>n+t.duration_ms,0),execution.duration_ms);
 assert.equal(execution.steps.filter(s=>s.type==='llm').reduce((n,s)=>n+s.input_tokens+s.output_tokens,0),execution.tokens);
 assert(execution.steps.reduce((n,s)=>n+s.duration_ms,0)<=execution.duration_ms,'Do not double-count parent container durations');
 for(const message of record.messages){assert(message.content);assert(!allIds.has(message.id));allIds.add(message.id)}
 for(const [index,step] of execution.steps.entries()){
  assert.equal(step.number,index+1);assert.equal(step.kind,'request');assert(!allIds.has(step.request_id));allIds.add(step.request_id);
  assert.equal(step.request.id,step.request_id);assert(step.duration_ms>0);assert(step.session_start_ms>=0);assert(step.session_start_ms+step.duration_ms<=execution.duration_ms);
  if(index)assert(step.session_start_ms>=execution.steps[index-1].session_start_ms);
  const turn=record.turns[step.turn-1];assert(turn.request_ids.includes(step.request_id));assert.equal(turn.input.role,'user');assert.equal(turn.output.role,'assistant');
  const sourceTrace=record.traces.find(t=>t.id===step.trace_id),parent=sourceTrace.spans.find(s=>s.span_id===step.parent_span_id);
  assert(parent);assert.equal(parent.kind,'container');assert(step.start_ms+step.duration_ms<=parent.duration_ms);
  assert(step.events.length>=3);assert.equal(step.events[0].offset_ms,0);assert.equal(step.events.at(-1).offset_ms,step.duration_ms);
  assert(step.events.every(e=>e.offset_ms>=0&&e.offset_ms<=step.duration_ms));
  if(step.ontology){assert.equal(step.type,'ontology');assert(step.ontology.object_type);assert(step.ontology.relation);assert(step.ontology.schema_version);if(step.key==='object_action'){assert.equal(step.output.persisted,false);assert.equal(step.input.dry_run,true)}}
  if(step.type==='llm')assert(step.model&&step.input&&step.output);
  if(step.type==='output'){assert.equal(step.output.message_id,turn.output.id);assert.equal(step.input.content,turn.output.content);assert.equal(step.input_tokens+step.output_tokens,0)}
  if(step.status==='error'){const retry=execution.steps.find(s=>s.retry_of===step.request_id);assert(retry);assert.notEqual(retry.request_id,step.request_id);assert.equal(retry.status,'success');assert.equal(retry.request.attempt,2)}
 }
 assert.equal(record.turns.flatMap(t=>t.request_ids).length,execution.steps.length);
 const io=read(`sessionPayload(observedSessions.find(s=>s.id==='${session.id}'),'io')`);assert.deepEqual(io.messages,record.messages);
 const full=read(`sessionPayload(observedSessions.find(s=>s.id==='${session.id}'),'trace')`);assert.deepEqual(full.trace,execution);
 vm.runInContext(`state.observedDetail={index:${sessions.indexOf(session)},turn:0,step:'',query:'',type:'all',issues:false,stepTab:'io',distribution:'count'}`,context);
 const summary=read('sdTypeSummary()');assert.equal(summary.reduce((n,x)=>n+x.count,0),execution.steps.length);assert(Math.abs(summary.reduce((n,x)=>n+x.countShare,0)-1)<1e-10);assert(Math.abs(summary.reduce((n,x)=>n+x.timeShare,0)-1)<1e-10);
 assert.equal(read('sdVisibleSpans().length'),execution.steps.length);
 vm.runInContext('state.observedDetail.turn=3',context);assert.equal(read('sdVisibleSpans().length'),execution.steps.length,'Changing conversation turn must not limit execution view');
}
vm.runInContext("state.observedDetail={index:0,turn:0,step:'',query:'',type:'ontology',issues:false,stepTab:'io',distribution:'count'}",context);
assert.equal(read('sdVisibleSpans().length'),42);assert(read("sdVisibleSpans().every(s=>s.type==='ontology')"));
vm.runInContext("state.observedDetail.type='all';state.observedDetail.issues=true",context);assert.equal(read('sdVisibleSpans().length'),3);
vm.runInContext("state.observedDetail.query='GATEWAY_TIMEOUT'",context);assert.equal(read('sdVisibleSpans()[0].key'),'report');
vm.runInContext("state.observedDetail.query='no-matching-request'",context);assert.equal(read('sdVisibleSpans().length'),0);
vm.runInContext("state.observedDetail.query='';state.observedDetail.issues=false",context);
const markup=read('sdTrace()');assert(!markup.includes('选择 Trace 轮次'));assert(markup.includes('整个会话'));assert(markup.includes('本体'));assert(!markup.includes('执行轮次'));
console.log('Passed: all 8 sessions; turn/message identity; session-wide step view; unique request IDs; internal events excluded from step counts; separate ontology operations; retry identity; type count/time shares; time/token reconciliation; shared MCP payload; cross-turn filters and empty states.');

// Harness-style record projection keeps messages/context separate from request steps.
for(let index=0;index<sessions.length;index++){
 vm.runInContext(`state.observedDetail={index:${index},turn:0,step:'',query:'',type:'all',recordType:'all',issues:false,recordTab:'overview',inspectorOpen:true}`,context);
 const records=read('shRecords()'),record=read('sdCurrent().record');
 assert.equal(records.length,record.execution.steps.length+record.turns.length+3);
 assert.equal(new Set(records.map(r=>r.id)).size,records.length);
 assert.equal(records.filter(r=>r.step).length,record.execution.steps.length);
 assert.deepEqual(records.filter(r=>r.step).map(r=>r.step),record.execution.steps);
 assert.equal(records.filter(r=>r.type==='context').length,2);
 for(const message of record.messages.filter(m=>m.role==='user'))assert.equal(records.find(r=>r.id===message.id).content,message.content);
 for(const turn of record.turns){const output=records.find(r=>r.type==='output'&&r.turn===turn.number);assert.equal(output.content,turn.output.content);assert.equal(output.step.input.message_id,turn.output.id)}
 assert(records.filter(r=>!r.step).every(r=>r.raw.content===r.content));
 vm.runInContext("state.observedDetail.recordType='requests';state.observedDetail.turn=3",context);
 assert.equal(read('shFilteredRecords().length'),record.execution.steps.length);
 vm.runInContext("state.observedDetail.recordType='user'",context);assert.equal(read('shFilteredRecords().length'),record.turns.length);assert(read('shFilteredRecords().every(r=>!r.step)'));
 vm.runInContext("state.observedDetail.recordType='ontology'",context);assert.equal(read('shFilteredRecords().length'),record.turns.length*2);
 const toolTabs=read("shTabs(shRecords().find(r=>r.type==='tool'))").map(x=>x[1]);assert.deepEqual(toolTabs,['输入输出','详情','原始记录']);
 assert(read("shTabs(shRecords().find(r=>r.type==='ontology')).some(t=>t[1]==='Schema')"));
 assert.deepEqual(read("shTabs(shRecords().find(r=>r.type==='user')).map(t=>t[1])"),['输入输出','详情','原始记录']);
}
vm.runInContext("state.observedDetail={index:0,turn:0,step:'',query:'',recordType:'all',issues:true,recordTab:'overview'}",context);assert.equal(read('shFilteredRecords().length'),3);
vm.runInContext("state.observedDetail.query='GATEWAY_TIMEOUT'",context);assert.equal(read('shFilteredRecords().length'),1);
vm.runInContext("state.observedDetail.query='no-matching-record'",context);assert.equal(read('shFilteredRecords().length'),0);
vm.runInContext("state.observedDetail.query='';state.observedDetail.issues=false",context);
const mapMarkup=read('shMap()');assert.equal((mapMarkup.match(/data-marker-id=/g)||[]).length,193);
assert(!read("shJson({text:'<script>untrusted</script>'})").includes('<script>'));
assert(!read("shJson({text:'</pre><img src=x onerror=alert(1)>'})").includes('<img'));
assert.equal(read("shTabs({type:'tool',step:{input:{sample:'value'}},raw:{}}).length"),3,'A sample input must not become a declared Schema');
assert.equal(read("shTabs({type:'tool',step:{inputSchema:{type:'object',required:['name'],properties:{name:{type:'string'}}}},raw:{}}).at(-1)[1]"),'Schema');
assert.deepEqual(read("shRecordedSchema({step:{inputSchema:{type:'object',required:['name'],properties:{name:{type:'string'}}}},raw:{}}).input"),{type:'object',required:['name'],properties:{name:{type:'string'}}});
console.log('Passed: Harness record/step distinction; complete message/request projection; one map marker per record; source fidelity; compact inspector tabs; cross-turn filters; recorded Schema only and escaped JSON.');

const expectedKinds=['用户','模型','工具','本体','Agent','安全围栏','记忆','其他'];
assert.deepEqual(read('Object.values(shKinds).map(x=>x.label)'),expectedKinds);
for(let index=0;index<sessions.length;index++){
 vm.runInContext(`state.observedDetail={index:${index},turn:0,recordType:'all',query:'',issues:false,recordTab:'io'}`,context);
 const records=read('shRecords()'),summary=read('shTypeSummary()');
 assert.equal(summary.reduce((n,x)=>n+x.count,0),records.length);
 assert.equal(summary.reduce((n,x)=>n+x.steps,0),records.filter(r=>r.step).length);
 assert.equal(read("shCategory(shRecords().find(r=>r.type==='retriever'))"),'tool');
 assert.equal(read("shCategory(shRecords().find(r=>r.type==='output'))"),'llm');
 assert.equal(read("shCategory(shRecords().find(r=>r.type==='system'))"),'other');
 for(const category of summary){
  vm.runInContext(`state.observedDetail.recordType='${category.type}'`,context);
  assert.equal(read('shFilteredRecords().length'),category.count);
 }
 vm.runInContext("state.observedDetail.recordType='all'",context);
 assert(!read("shRow(shRecords().find(r=>r.type==='llm'))").includes('<i></i>'));
 for(const row of records){
  vm.runInContext(`state.observedDetail.entry='${row.id}';state.observedDetail.recordTab='io'`,context);
  const tabs=read('shTabs(shCurrent().entry)');
  assert.deepEqual(tabs.slice(0,3).map(x=>x[1]),['输入输出','详情','原始记录']);
  assert(tabs.length===3||tabs.length===4&&tabs[3][1]==='Schema');
  const io=read('shInspectorBody()');assert(io.includes('输入'));assert(!io.includes('内部事件'));
  if(row.step)assert(io.includes('输出'));
  if(row.status==='error')assert(io.includes(row.step.error.code));
  vm.runInContext("state.observedDetail.recordTab='details'",context);
  const details=read('shInspectorBody()');assert(!details.includes('内部事件'));assert(details.includes('来源'));
  if(row.step)assert(details.includes('请求计时'));else assert(!details.includes('0 毫秒'));
  if(row.step?.attributes)assert(details.includes('其他'));
  if(row.step?.ontology)assert(details.includes('本体信息'));
  if(row.step?.retry_of)assert(details.includes(row.step.retry_of));
  vm.runInContext("state.observedDetail.recordTab='raw'",context);
  assert.equal(read('shInspectorBody()'),read("shSection('原始记录',shJson(shCurrent().entry.raw))"));
  if(tabs.length===4){vm.runInContext("state.observedDetail.recordTab='schema'",context);assert(read('shInspectorBody()').includes('Schema'))}
 }
}
console.log('Passed: eight categories; model dots removed; three default tabs for every record; complete I/O and raw record; detail source/timing/ontology/retry/other sections; conditional Schema; no internal-event sections or invented message duration.');

// Turn selection changes the reading position, never the rendered message scope.
for(let index=0;index<sessions.length;index++){
 vm.runInContext(`state.observedDetail={index:${index},turn:3,format:'readable'}`,context);
 const record=read('sdCurrent().record'),conversation=read('sdMessages()');
 assert.equal((conversation.match(/class="sd-conversation-turn"/g)||[]).length,record.turns.length);
 assert.equal((conversation.match(/class="sd-message-card input"/g)||[]).length,record.turns.length);
 assert.equal((conversation.match(/class="sd-message-card output"/g)||[]).length,record.turns.length);
 for(const [turnIndex,turn] of record.turns.entries()){
  assert(conversation.includes(`aria-controls="sd-conversation-turn-${turnIndex}"`));
  assert(conversation.includes(turn.input.id));assert(conversation.includes(turn.output.id));
  assert(conversation.includes(`sdCopy('input',${turnIndex})`));assert(conversation.includes(`sdCopy('output',${turnIndex})`));
 }
 assert(!conversation.includes('一轮对话 ='));assert(!conversation.includes('上一轮'));assert(!conversation.includes('下一轮'));
 vm.runInContext("state.observedDetail.format='json'",context);
 const jsonConversation=read('sdMessages()');
 assert.equal((jsonConversation.match(/class="sd-conversation-turn"/g)||[]).length,record.turns.length);
 for(const message of record.messages)assert(jsonConversation.includes(message.id));
}
console.log('Passed: all turns remain in readable/JSON views across 8 sessions; complete original messages; per-message copy targets; turn anchors; definition prose removed.');

let copiedText;
context.navigator={clipboard:{async writeText(text){copiedText=text}}};
vm.runInContext("toast=()=>{};state.observedDetail={index:0,turn:0,format:'readable'}",context);
(async()=>{
 for(const kind of ['input','output']){
  await vm.runInContext(`sdCopy('${kind}',12)`,context);
  assert.equal(copiedText,read(`sdCurrent().record.turns[12].${kind}.content`),'Copy must target the clicked message even when another turn is active');
 }
 console.log('Passed: copying a message from an inactive turn preserves the clicked input/output.');
})().catch(error=>{console.error(error);process.exitCode=1});
