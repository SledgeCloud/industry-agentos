const fs=require('node:fs'),vm=require('node:vm'),assert=require('node:assert/strict');
const html=fs.readFileSync('dist/aiops-extensions.html','utf8'),source=html.match(/<script>([\s\S]*?)<\/script>/)[1];new Function(source);
class FixedDate extends Date{constructor(...args){super(...(args.length?args:['2026-10-23T04:00:00Z']))}static now(){return new Date('2026-10-23T04:00:00Z').getTime()}}
const context=vm.createContext({Date:FixedDate,console,setTimeout(){},clearTimeout(){}});
vm.runInContext(source.slice(0,source.lastIndexOf('\nstate.composerSkill=null;')),context);
const run=code=>vm.runInContext(code,context),json=code=>JSON.parse(run(`JSON.stringify(${code})`));run('render=()=>{}');
const setDays=days=>run(`state.range='custom';state.customDates={start:operationsDate(operationsDayNumber('2026-10-23')-${days}+1),end:'2026-10-23'}`);

// These are actual plotted buckets, not just fewer visible axis labels.
for(const [days,key,count] of [[1,'hour',24],[7,'day',7],[14,'day',14],[15,'two-days',8],[29,'two-days',15],[30,'two-days',15],[31,'week',5],[180,'week',26],[181,'month',7],[365,'month',13]]){
 setDays(days);const buckets=json('analysisTrendBuckets()');assert.equal(buckets.length,count,days);assert(buckets.every(b=>b.granularity===key));
 assert.equal(buckets[0].start,run('analysisPeriod().start'));assert.equal(buckets.at(-1).end,'2026-10-23');
 if(days!==1){
  const covered=buckets.flatMap(b=>Array.from({length:(Date.parse(b.end)-Date.parse(b.start))/86400000+1},(_,i)=>new Date(Date.parse(b.start)+i*86400000).toISOString().slice(0,10)));
  assert.deepEqual(covered,json('analysisPeriod().dates'),'Every selected day must appear exactly once');
 }
 const svg=run('costChart(costData().buckets)');assert.equal((svg.match(/class="cost-chart-point"/g)||[]).length,count);
 if(days>1){const svg=run("behaviorChartSVG(behaviorData().buckets,'sessions')");assert.equal((svg.match(/class="behavior-mark"/g)||[]).length,count)}
}

// Summation and weighted averages must use all records inside each two-day/week/month bucket.
for(const days of [30,45,181]){
 setDays(days);
 const cost=json('costData()'),behavior=json('behaviorData()');
 assert.equal(cost.totals.total,cost.buckets.reduce((sum,b)=>sum+b.total,0));
 for(const bucket of cost.buckets){assert.equal(bucket.total,bucket.input+bucket.output);assert.equal(bucket.perTurn,bucket.total/bucket.turns);assert.equal(bucket.perSession,bucket.total/bucket.sessions)}
 for(const bucket of behavior.buckets){
  const daily=behavior.days.filter(d=>d.date>=bucket.start&&d.date<=bucket.end);
  assert.equal(bucket.sessions,daily.reduce((sum,d)=>sum+d.sessions,0));
  assert.equal(bucket.likes,daily.reduce((sum,d)=>sum+d.likes,0));assert.equal(bucket.dislikes,daily.reduce((sum,d)=>sum+d.dislikes,0));
  assert.equal(bucket.users,new Set(daily.flatMap(d=>d.userIds)).size);
 }
 assert(behavior.buckets.some(b=>b.users<behavior.days.filter(d=>d.date>=b.start&&d.date<=b.end).reduce((sum,d)=>sum+d.users,0)),'Users are deduplicated across every multi-day bucket');
 assert(run(`(()=>{const d=healthData();return d.buckets.every(b=>{const sessions=d.sessions.filter(s=>s.date>=b.start&&s.date<=b.end),alerts=d.alerts.filter(a=>a.date>=b.start&&a.date<=b.end),expected=healthAggregate(sessions,alerts);return b.slowRate===expected.slowRate&&b.sessionAvgMs===expected.sessionAvgMs&&b.affectedUsers===expected.affectedUsers&&b.turns===expected.turns})})()`));
 const costPage=run('costPage()'),healthPage=run('healthPage()'),behaviorPage=run('behaviorPage()');
 for(const page of [costPage,healthPage,behaviorPage]){assert(page.includes(run('analysisTrendGranularity().description')));assert(!/NaN|Infinity|undefined/.test(page))}
 assert(costPage.includes(cost.buckets[0].start+' — '+cost.buckets[0].end));
}

// Natural months, including leap day, plus clipped first/last months across a year boundary.
run("state.customDates={start:'2023-12-20',end:'2024-07-03'}");
const months=json('analysisTrendBuckets()');assert.equal(months.length,8);
assert.equal(months[0].start,'2023-12-20');assert.equal(months.at(-1).end,'2024-07-03');
assert.deepEqual(months.find(b=>b.label==='2024-02'),{date:'2024-02-01',start:'2024-02-01',end:'2024-02-29',label:'2024-02',granularity:'month'});

// Custom timeline charts share the same cadence; categorical charts and detail tables retain their grouping.
run(`arts.push({id:'trend-fixture',name:'时间序列',kind:'table',updatedAt:'2026-10-23 10:00',cols:['日期','客户','金额'],data:Array.from({length:365},(_,i)=>[operationsDate(operationsDayNumber('2026-10-23')-364+i),i%2?'A':'B',i+1])});globalThis.metric={...dashboardNewMetric(),sourceId:'artifact:trend-fixture',type:'chart',x:'日期',agg:'sum',y:'金额'}`);
for(const days of [7,14,30,45,181,365]){
 setDays(days);const result=json('dashboardCompute(metric)'),expected=json('analysisTrendBuckets(state.range,false,false)');
 assert.equal(result.groups.length,expected.length);assert.equal(result.groups.reduce((sum,g)=>sum+g.value,0),result.value);
 for(const [i,bucket] of result.groups.entries()){assert.equal(bucket.start,expected[i].start);assert.equal(bucket.end,expected[i].end)}
 assert.equal(run("dashboardCompute({...metric,x:'客户'}).groups.length"),2);
 assert.equal(run("dashboardCompute({...metric,type:'table',columns:['日期','金额']}).rows.length"),days);
 assert(run(`(()=>{const r=dashboardCompute({...metric,agg:'avg'}),s=dashboardSource(metric.sourceId);return r.groups.every(g=>{const values=r.rows.filter(row=>row[0]>=g.start&&row[0]<=g.end).map(row=>row[2]);return g.value===values.reduce((a,b)=>a+b,0)/values.length})})()`));
 assert(run("dashboardChartSVG(metric,dashboardCompute(metric).groups)").includes(expected[0].start+(expected[0].start===expected[0].end?'':' — '+expected[0].end)));
}
setDays(30);run('analysisScopeState.scopeSelection=[]');
for(const fn of ['costData','healthData','behaviorData'])assert(run(`${fn}().buckets.every(b=>b.sessions===0)`));
console.log('PASS: actual day/2-day/week/month point counts, 14/15/30/31/180/181-day boundaries, no skipped days, weighted bucket aggregation, per-bucket user deduplication, natural months/leap days, custom timelines, categorical/detail preservation and zero scopes.');
