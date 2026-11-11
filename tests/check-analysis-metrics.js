const fs=require('fs'),vm=require('vm'),assert=require('node:assert/strict');
const html=fs.readFileSync('dist/aiops-extensions.html','utf8'),source=html.match(/<script>([\s\S]*?)<\/script>/)[1];
new Function(source);
const context=vm.createContext({console,setTimeout(){},clearTimeout(){}});
vm.runInContext(source.slice(0,source.lastIndexOf('\nstate.composerSkill=null;')),context);
const run=code=>vm.runInContext(code,context),read=code=>JSON.parse(run(`JSON.stringify(${code})`));
run('render=()=>{}');

for(const range of [1,7,14,30]){
 run(`state.range=${range}`);
 const current=read('analysisWindowRows()'),previous=read('analysisWindowRows(state.range,true)');
 assert.equal(current.length,range);assert.equal(previous.length,range);
 assert(previous.at(-1)[0]<current[0][0]);
 assert.equal((Date.parse(current[0][0])-Date.parse(previous[0][0]))/86400000,range);
 assert.equal(current.at(-1)[0],run('operationsToday()'));
 assert.equal(previous[0][0],new Date(Date.parse(current.at(-1)[0])-(range*2-1)*86400000).toISOString().slice(0,10));
 for(const [page,fn,cards,comparisons] of [['成本分析','costPage',6,6],['健康度分析','healthPage',9,9],['用户行为分析','behaviorPage',5,6]]){
  run(`state.page='${page}'`);const output=run(fn+'()');
  assert.equal((output.match(/class="compact-stat"/g)||[]).length,cards);
  assert.equal((output.match(/class="metric-symbol"/g)||[]).length,cards);
  assert.equal((output.match(/class="metric-comparison"/g)||[]).length,comparisons);
  assert(output.includes(range===1?'日环比':range+' 天环比'));
  assert(!/NaN|Infinity|undefined/.test(output));
  const meanings=page==='成本分析'?Array(6).fill('neutral'):page==='健康度分析'?Array(9).fill('lower'):['neutral','neutral','neutral','neutral','higher','lower'];
  [...output.matchAll(/class="metric-change ([^"]+)">([^<]+)</g)].forEach(([,tone,text],index)=>{
   const meaning=meanings[index];
   if(meaning==='neutral'||text==='0%')assert.equal(tone,'neutral',`${page}: ${text} must stay neutral`);
   else if(meaning==='higher')assert.equal(tone,text.startsWith('−')?'worsened':'improved',`${page}: likes improve when they rise`);
   else assert.equal(tone,text.startsWith('−')?'improved':'worsened',`${page}: errors, delays and dislikes improve when they fall`);
  });
 }
 for(const fn of ['costData','healthData','behaviorData']){
  const currentData=read(`${fn}()`),previousData=read(`${fn}(state.range,true)`);
  assert(currentData.totals.sessions>0);assert(previousData.totals.sessions>0);
  const dates=data=>data.dates||data.days.map(day=>day.date);
  assert.deepEqual(dates(previousData),previous.map(row=>row[0]));
 }
 const cost=read('costData(state.range,true).totals');assert.equal(cost.total,cost.input+cost.output);assert.equal(cost.perSession,cost.total/cost.sessions);
 const health=read('healthData(state.range,true)');assert.equal(health.totals.affectedUsers,new Set(health.alerts.map(alert=>alert.userId)).size);
}
// Compare rates by relative change, not percentage points; handle a zero baseline without division by zero.
assert(run('analysisComparison(8,4)').includes('metric-change neutral">+100%</span>'));
assert(run('analysisComparison(3,4)').includes('metric-change neutral">−25%'));
assert(run("analysisComparison(8,4,'lower')").includes('metric-change worsened">+100%</span>'));
assert(run("analysisComparison(3,4,'lower')").includes('metric-change improved">−25%'));
assert(run("analysisComparison(8,4,'higher')").includes('metric-change improved">+100%</span>'));
assert(run("analysisComparison(3,4,'higher')").includes('metric-change worsened">−25%'));
assert(run('analysisComparison(0,0)').includes('metric-change neutral">0%</span>'));
assert(run('analysisComparison(1,0)').includes('metric-change neutral">新增</span>'));
assert(run("analysisComparison(1,0,'lower')").includes('metric-change worsened">新增</span>'));
assert(run("analysisComparison(1,0,'higher')").includes('metric-change improved">新增</span>'));
for(const direction of ['lower','higher'])assert(run(`analysisComparison(4,4,'${direction}')`).includes('metric-change neutral">0%</span>'));
assert(!/NaN|Infinity/.test(run('analysisComparison(1,0)')));
const perUser=read("analysisMetricOptions('人均会话数',{sessions:10,users:3},{sessions:3,users:2})");assert.equal(perUser.current,10/3);assert.equal(perUser.previous,1.5);
const turns=read("analysisMetricOptions('平均会话轮次',{turns:23,sessions:6},{turns:7,sessions:2})");assert.equal(turns.current,23/6);

run("state.range=14;analysisScopeState.scopeSelection=['sales-leads']");
for(const fn of ['costData','healthData','behaviorData'])assert(read(`${fn}(state.range,true).totals.sessions>0`));
run('analysisScopeState.scopeSelection=[]');
for(const fn of ['costPage','healthPage','behaviorPage']){
 const output=run(fn+'()');assert(!/NaN|Infinity|undefined/.test(output));
 assert([...output.matchAll(/data-current="([^"]+)" data-previous="([^"]+)"/g)].every(match=>match[1]==='0'&&match[2]==='0'));
}
assert(source.includes('tabindex="0" aria-label="${esc(name)}计算口径"'));
assert(html.includes('.metric-help:hover .metric-tooltip,.metric-help:focus .metric-tooltip'));
assert(html.includes('.metric-change.worsened{color:#d36b63}'));
assert(html.includes('.metric-change.improved{color:#23ad57}'));
console.log('Passed: shared cards and icons, all metric comparisons, equal prior windows, unchanged hover triggers, relative rates, raw average ratios, neutral usage metrics, green improvements and red regressions including opposite like/dislike meanings, zero baselines, scope linkage and empty comparisons.');
