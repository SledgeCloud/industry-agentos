const fs=require('node:fs'),vm=require('node:vm'),assert=require('node:assert/strict');
const html=fs.readFileSync('dist/aiops-extensions.html','utf8'),script=html.match(/<script>([\s\S]*?)<\/script>/)[1];
const nodes=new Map(),node=selector=>{if(!nodes.has(selector))nodes.set(selector,{value:'',innerHTML:'',textContent:'',classList:{add(){},remove(){}}});return nodes.get(selector)};
// UTC is still October 22, while Shanghai's natural day is already October 23.
class FixedDate extends Date{constructor(...args){super(...(args.length?args:['2026-10-22T17:05:00Z']))}static now(){return new Date('2026-10-22T17:05:00Z').getTime()}}
const ctx=vm.createContext({Date:FixedDate,console,setTimeout(){},clearTimeout(){},document:{querySelector:node,querySelectorAll(){return []}}});
vm.runInContext(script.slice(0,script.lastIndexOf('\nstate.composerSkill=null;')),ctx);
const run=code=>vm.runInContext(code,ctx),json=code=>JSON.parse(run(`JSON.stringify(${code})`));
run('render=()=>{};closeModal=()=>{}');
assert.equal(run('operationsToday()'),'2026-10-23');
assert(Number.isNaN(run("operationsDayNumber('2026-02-30')")));
assert.equal(run("dashboardDateValue('2026-10-23T99:00:00Z')"),null);
assert.equal(run("dashboardDateValue('12-31','2025-12-31 10:00')"),'2025-12-31');

for(const range of [1,7,14,30]){
 run(`operationsSetRange(${range})`);
 const period=json('analysisPeriod()'),prior=json('analysisPeriod(state.range,true)');
 assert.equal(period.days,range);assert.equal(period.end,'2026-10-23');
 assert.equal(Date.parse(period.start)-Date.parse(prior.start),range*86400000);
 assert.equal(Date.parse(period.start)-Date.parse(prior.end),86400000);
 for(const page of ['costPage()','healthPage()','behaviorPage()']){
  const markup=run(page);assert(!/NaN|undefined|Infinity/.test(markup));
  assert.equal((markup.match(/aria-label="看板时间周期"/g)||[]).length,1);
  assert(markup.includes(range===1?'日环比':range+' 天环比'));
 }
 const cost=json('costData()'),health=json('healthData()'),behavior=json('behaviorData()');
 assert.equal(cost.buckets.length,range===1?24:range===30?15:range);assert.equal(health.buckets.length,range===1?24:range===30?15:range);assert.equal(behavior.days.length,range);
 for(const key of ['total','input','output','calls','turns','sessions'])assert.equal(cost.totals[key],cost.buckets.reduce((sum,b)=>sum+b[key],0));
 assert.equal(cost.totals.perTurn,cost.totals.total/cost.totals.turns);
 assert.equal(cost.totals.perSession,cost.totals.total/cost.totals.sessions);
 for(const key of ['turns','slowTurns','errorTurns','warningEvents'])assert.equal(health.totals[key],health.buckets.reduce((sum,b)=>sum+b[key],0));
 assert.equal(health.totals.slowRate,health.totals.slowTurns/health.totals.turns*100);
 assert.equal(health.totals.affectedUsers,new Set(health.alerts.map(a=>a.userId)).size);
 assert.equal(behavior.totals.sessions,behavior.days.reduce((sum,d)=>sum+d.sessions,0));
}

// Applying a 10-day interval keeps all 10 days, not the closest preset; endpoints included.
node('#dateFrom').value='2026-09-29';node('#dateTo').value='2026-10-08';run('applyDates()');
assert.equal(run('state.range'),'custom');assert.equal(run('analysisPeriod().days'),10);
assert.deepEqual(json('costData().dates'),Array.from({length:10},(_,i)=>new Date(Date.UTC(2026,8,29+i)).toISOString().slice(0,10)));
assert.equal(run('costPage().includes("10 天环比")'),true);
assert.equal(run('analysisPeriod(state.range,true).end'),'2026-09-28');
const customCost=json('costData()'),dayTotals=json('analysisPeriod().dates.map(date=>costAggregate(costDailyRecords(date)))');
assert.equal(customCost.totals.total,dayTotals.reduce((sum,d)=>sum+d.total,0));
const before=json('[state.range,state.customDates]');
for(const [from,to,error] of [['2026-10-10','2026-10-01','早于'],['','2026-10-01','有效'],['2026-10-01','2026-10-24','晚于']]){
 node('#dateFrom').value=from;node('#dateTo').value=to;run('applyDates()');assert(node('#dateRangeError').textContent.includes(error));assert.deepEqual(json('[state.range,state.customDates]'),before);
}
node('#dateFrom').value=node('#dateTo').value='2026-10-05';run('applyDates()');
assert.equal(run('costData().buckets.length'),24);assert.equal(run('healthData().buckets.length'),24);
assert(!run('behaviorPage()').includes('behavior-trends'));assert(!run('behaviorPage()').includes('今日累计'));
const stable=json('healthData().sessions');run('operationsSetRange(30)');
assert.deepEqual(json("healthData().sessions.filter(s=>s.date==='2026-10-05')"),stable,'Changing ranges must not regenerate a different history for the same day');
run("state.range='custom';state.customDates={start:'2024-02-28',end:'2024-03-01'}");assert.equal(run('analysisPeriod().days'),3);
run("state.customDates={start:'1969-12-31',end:'1970-01-01'}");assert(run('healthData().totals.sessions>0'));

// All custom visual forms filter before aggregation and before categorical filtering.
run(`arts.push({id:'period-fixture',name:'周期数据',kind:'table',updatedAt:'2026-10-22 10:00',cols:['业务日期','入库时间','客户','金额'],data:[
 ['2026-10-16','2026-10-23 10:00','A',100],['2026-10-17','2026-10-23 10:00','A',200],
 ['2026-10-23','2026-10-23 10:00','B',500],['2026-10-24','2026-10-23 10:00','B',900],
 ['2026-10-22T17:00:00Z','2026-10-23 10:00','B',300],['','2026-10-23 10:00','B',700]
 ]});globalThis.metric={...dashboardNewMetric(),sourceId:'artifact:period-fixture',x:'客户',y:'金额',agg:'sum'};operationsSetRange(7)`);
assert.equal(run('dashboardCompute(metric).value'),1000);
assert.equal(run("dashboardCompute({...metric,agg:'avg'}).value"),1000/3);
assert.equal(run("dashboardCompute({...metric,agg:'distinct',y:'客户'}).value"),2);
assert.deepEqual(json('dashboardCompute(metric).groups'),[{label:'A',value:200},{label:'B',value:800}]);
assert.equal(run("dashboardCompute({...metric,filterField:'客户',filterValue:'B'}).value"),800);
for(const type of ['number','chart','table'])assert(run(`dashboardMetricCard({...metric,type:'${type}',columns:['业务日期','金额']})`).includes('按 业务日期'));
run('operationsSetRange(1)');assert.equal(run('dashboardCompute(metric).value'),800);
assert.equal(run("dashboardCompute({...metric,timeField:'入库时间'}).value"),2700);
assert(run("dashboardCompute({...metric,timeField:'已删除日期'}).error").includes('时间字段'));
run("arts.push({id:'snapshot-fixture',name:'无日期快照',kind:'table',updatedAt:'2026-10-22 10:00',cols:['数量'],data:[[2],[3]]})");
assert.equal(run("dashboardCompute({...metric,sourceId:'artifact:snapshot-fixture',y:'数量'}).value"),null);
run('operationsSetRange(7)');assert.equal(run("dashboardCompute({...metric,sourceId:'artifact:snapshot-fixture',y:'数量'}).value"),5);

// Lifecycle flow cards use the interval, and stock uses the selected end of day.
run("ontologyKnowledgeInit();state.range='custom';state.customDates={start:'2026-10-14',end:'2026-10-15'}");
assert.deepEqual(json('ontologyKnowledgeStats(ontologyKnowledgeTab())'),{total:10,added:5,modified:2,discarded:0});
run("state.customDates={start:'2026-09-01',end:'2026-09-30'}");
assert.deepEqual(json('ontologyKnowledgeStats(ontologyKnowledgeTab())'),{total:1,added:1,modified:0,discarded:0});
run('dashboardInit();state.dashboardId="closing-dashboard"');
for(const page of ['ontologyKnowledgePage()','dashboardDetailPage()'])assert(run(page).includes('aria-label="看板时间周期"'));
run('operationsSetRange(30);analysisScopeState.scopeSelection=[]');
for(const fn of ['costData','healthData','behaviorData'])assert.equal(run(fn+'().totals.sessions'),0);
assert.equal(run('state.observedRange'),undefined,'Operations range must not change the independent online-session period');
console.log('PASS: five calendar choices, Shanghai today, inclusive custom dates, equal previous periods, all analysis cards/trends, stable history, weighted rates and averages, source date/snapshot filtering, knowledge lifecycle and isolated session filters.');
