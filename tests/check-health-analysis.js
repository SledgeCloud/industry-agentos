const fs=require('fs'),vm=require('vm'),assert=require('node:assert/strict');
const html=fs.readFileSync('dist/aiops-extensions.html','utf8'),source=html.match(/<script>([\s\S]*?)<\/script>/)[1];
new Function(source);
const context=vm.createContext({console,setTimeout(){},clearTimeout(){}});
vm.runInContext(source.slice(0,source.lastIndexOf('\nstate.composerSkill=null;')),context);
const run=code=>vm.runInContext(code,context),read=code=>JSON.parse(run(`JSON.stringify(${code})`));
run("render=()=>{};state.page='健康度分析'");

// A slow successful turn is divided by ALL turns, while final errors count each affected session once.
const fixture=read(`healthAggregate([
 {durationMs:6000,turns:[{status:'success',slow:true,ttftMs:3000,tool:{status:'success',durationMs:1000},modelMs:3000,toolMs:1000,retrievalMs:1000,ontologyMs:1000},{status:'failed',slow:false,ttftMs:1000,tool:{status:'failed',durationMs:2000},modelMs:1000,toolMs:2000,retrievalMs:0,ontologyMs:0}]},
 {durationMs:3000,turns:[{status:'success',slow:false,ttftMs:500,tool:{status:'success',durationMs:500},modelMs:500,toolMs:500,retrievalMs:1000,ontologyMs:1000}]}
 ],[{userId:'same-user'},{userId:'same-user'}])`);
assert.equal(fixture.anomalousRate,50);
assert(Math.abs(fixture.turnErrorRate-100/3)<1e-10);
assert(Math.abs(fixture.slowRate-100/3)<1e-10);
assert.equal(fixture.warningEvents,2);assert.equal(fixture.affectedUsers,1);
assert.equal(fixture.sessionAvgMs,4500);assert.equal(fixture.toolAvgMs,750);

for(const range of [1,7,14]){
 run(`state.range=${range};state.healthAlertSeverity='all'`);
 const data=read('healthData()'),page=run('healthPage()');
 assert.equal(data.buckets.length,range===1?24:range);
 assert.equal((page.match(/class="compact-stat"/g)||[]).length,9);
 assert.equal((page.match(/data-health-alert-type=/g)||[]).length,4);
 assert.equal((page.match(/data-health-slow-series/g)||[]).length,1);
 for(const removed of ['Agent 执行失败率','错误会话率','重试发生率','工具超时率','错误类型分布','P95','分步骤','慢工具调用率','待配置'])assert(!page.includes(removed),removed);
 for(const name of ['异常会话率','工具调用失败率','轮次错误率','警告事件数','警告影响用户数','会话平均耗时','慢响应轮次率','工具平均耗时','首 token 延迟（TTFT）','耗时分布','警告分布','实时警告'])assert(page.includes(name),name);
 for(const key of ['sessions','turns','errorSessions','errorTurns','slowTurns','warningEvents','tools','failedTools'])assert.equal(data.buckets.reduce((sum,bucket)=>sum+bucket[key],0),data.totals[key],`${range}: ${key}`);
 assert.equal(data.alerts.length,data.totals.warningEvents);
 assert.equal(new Set(data.alerts.map(alert=>alert.userId)).size,data.totals.affectedUsers);
 assert.equal(data.totals.slowRate,data.totals.slowTurns/data.totals.turns*100);
 for(const bucket of data.buckets)for(const key of ['anomalousRate','turnErrorRate','toolFailureRate','slowRate'])assert(bucket[key]>=0&&bucket[key]<=100);
 assert.equal((run('healthAlertList(healthData())').match(/class="health-alert-item"/g)||[]).length,20);
 for(const severity of ['severe','warning']){
  run(`state.healthAlertSeverity='${severity}'`);
  const list=run('healthAlertList(healthData())');
  assert(!list.includes(`health-alert-badge ${severity==='severe'?'warning':'severe'}`));
  const expected=data.alerts.filter(alert=>alert.severity===severity).length;
  assert(list.includes(`共 ${expected} 条`));
 }
 assert.equal(data.buckets[0].label,range===1?'00:00':data.dates[0].slice(5));
 assert.equal(data.buckets.at(-1).label,range===1?'23:00':data.dates.at(-1).slice(5));
}
run("state.range=7;analysisScopeState.scopeSelection=['sales-leads']");
const oneAgent=read('healthData()');assert(oneAgent.totals.sessions>0);assert(oneAgent.sessions.every(session=>session.agent==='sales-leads'));assert(oneAgent.alerts.every(alert=>alert.agent==='sales-leads'));
run("analysisScopeState.scopeSelection=['procurement-plan']");assert.notEqual(read('healthData().totals.warningEvents'),oneAgent.totals.warningEvents);
for(const selection of [[],['sales-customers']]){
 run(`analysisScopeState.scopeSelection=${JSON.stringify(selection)}`);
 const data=read('healthData()'),page=run('healthPage()');
 for(const key of ['sessions','turns','warningEvents','affectedUsers','slowRate','sessionAvgMs','toolAvgMs','ttftAvgMs'])assert.equal(data.totals[key],0);
 assert(!/NaN|Infinity/.test(page));assert(page.includes('所选范围暂无对话轮次数据'));assert(page.includes('共 0 条'));
}
console.log('Passed: 5 error metrics, 4 performance metrics, final session/turn outcomes, all-turn slow-rate denominator, deduplicated warning users, weighted durations, 24/7/14 trend buckets, severity filters, scope linkage and empty states.');
