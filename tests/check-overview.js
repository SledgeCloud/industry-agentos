const fs=require('fs'),vm=require('vm'),assert=require('assert');
const html=fs.readFileSync('dist/index.html','utf8');
const nodes={};const sandbox={document:{getElementById:id=>nodes[id]||(nodes[id]={innerHTML:''}),querySelectorAll:()=>[],addEventListener(){}},setTimeout(){},clearTimeout(){},console};
vm.createContext(sandbox);vm.runInContext(html.match(/<script>([\s\S]*?)<\/script>/)[1],sandbox);
const run=code=>vm.runInContext(code,sandbox);
const summary=()=>JSON.parse(run('JSON.stringify(overviewValues(overviewAggregate(overviewRows())))'));
const allToday=summary();assert(allToday[0]>0);assert(allToday[1]>0&&allToday[1]<100);assert(allToday[2]>0);assert(allToday[4]>0);assert(allToday[6]>0);
run("overviewState.scopeSelection=overviewScopes[0].items.map(x=>x.id)");const sales=summary();
run("overviewState.scopeSelection=overviewScopes[1].items.map(x=>x.id)");const procurement=summary();
assert.notEqual(sales[0],procurement[0]);assert.equal(sales[0]+procurement[0],allToday[0]);assert.equal(sales[2]+procurement[2],allToday[2]);
run("overviewScopeBulk(true);overviewState.range='14 天'");const fourteen=summary();assert(fourteen[0]>allToday[0]);assert.equal(run('overviewDates().length'),14);assert.equal(run("overviewTrend('health').length"),14);assert.equal(run("overviewWindow(true).end"),'2026-09-27');
run("overviewState.range='7 天'");const seven=summary();assert(seven[0]>allToday[0]&&seven[0]<fourteen[0]);
assert(run("overviewTrend('health').every(v=>v.every(n=>n>=0&&n<=100))"));assert(run("new Set(overviewTrend('cost').map(v=>v[0])).size>1"));
assert(run("(()=>{let d=overviewAggregate(overviewRows());return overviewValues(d)[3]===d.tokens/d.volume&&d.ruleSuccess<=d.rules&&d.actionSuccess<=d.actions&&d.confirmed<=d.interventions})()"));
run("overviewState.scopeSelection=['sales-leads'];render()");assert(!nodes.app.innerHTML.includes('本体运行'));const agent=summary();
run("overviewState.scopeSelection=['sales-customers'];render()");assert(nodes.app.innerHTML.includes('本体运行'));assert.notDeepEqual(summary(),agent);assert(run('overviewOntologyValues(overviewAggregate(overviewRows()))[0]>0'));
const fixed=summary();run("overviewState.menu='scope';render();overviewState.menu='';render()");assert.deepEqual(summary(),fixed);
run("overviewScopeBulk(false);render()");assert(summary().every(v=>v===0));assert(run("overviewTrend('cost').every(v=>v.every(n=>n===0))"));assert(nodes.app.innerHTML.includes('暂无匹配警告'));assert(!nodes.app.innerHTML.includes('NaN'));assert(!nodes.app.innerHTML.includes('Infinity'));
run("overviewScopeBulk(true);overviewState.range='今日';render()");assert.equal(run('overviewOntologyValues(overviewAggregate(overviewRows())).length'),8);assert(run('overviewAggregate(overviewRows()).reads>0&&overviewAggregate(overviewRows()).writes>0'));assert(!nodes.app.innerHTML.includes('ov-ontology-bar-panel'));
for(const range of ['7 天','14 天']){run(`overviewState.range='${range}';render()`);assert.equal((nodes.app.innerHTML.match(/class="ov-ontology-bar-panel"/g)||[]).length,2);assert.equal(run("overviewOntologyDaily('rules').length"),range==='7 天'?7:14);for(const kind of ['rules','actions'])assert(run(`(()=>{let data=overviewOntologyDaily('${kind}'),d=overviewAggregate(overviewRows());return data.every(x=>x.success+x.failure===x.total&&x.failure>=0)&&data.reduce((n,x)=>n+x.total,0)===d.${kind}})()`));}
run("overviewState.scopeSelection=['sales-leads'];render()");assert(!nodes.app.innerHTML.includes('ov-ontology-bar-panel'));
console.log('Passed: mock data, scene and asset filters, 1/7/14-day windows, equal prior window, weighted ratios, variable trends, ontology visibility, stable rerenders, empty selection.');
run("overviewScopeBulk(true);overviewState.knowledgeLibrary='all';overviewState.knowledgeRange='7 天'");
const stock=run('overviewKnowledgeSummary().stock');
for(const range of ['今日','7 天','14 天']){run(`overviewState.knowledgeRange='${range}'`);assert.equal(run('overviewKnowledgeSummary().stock'),stock);assert.equal(run('overviewKnowledgeDaily().length'),range==='今日'?1:range==='7 天'?7:14);for(const key of ['added','modified','deleted','referenced','denied'])assert(run(`overviewKnowledgeDaily().reduce((n,d)=>n+d.${key},0)===overviewKnowledgeSummary().${key}`));}
run("overviewState.scopeSelection=['sales-leads','sales-orders'];overviewState.knowledgeLibrary='all'");assert.equal(run('overviewKnowledgeSelected().length'),1);
run("overviewState.knowledgeLibrary='supplier-kb'");assert.equal(run('overviewKnowledgeSummary().stock'),0);
run("overviewScopeBulk(true);overviewState.knowledgeLibrary='all';dashboardTab='knowledge';overviewSet('range','14 天')");assert.equal(run('overviewState.knowledgeRange'),'14 天');assert.equal((nodes.app.innerHTML.match(/data-knowledge-chart=/g)||[]).length,2);
run("overviewToggle('knowledge-','added')");assert(!run("overviewKnowledgeChart('change')").includes('data-series="added"'));
console.log('Passed: knowledge stock invariance, daily totals, library/Agent intersection and deduplication, global time linkage, legend toggles.');

run("dashboardTab='overview';render()");assert(nodes.topnav.innerHTML.includes('数据看板'));assert(!nodes.app.innerHTML.includes('data-knowledge-chart='));assert(nodes.app.innerHTML.includes('本体运行'));
run("dashboardTab='knowledge';render()");assert(!nodes.app.innerHTML.includes('本体运行'));assert.equal((nodes.app.innerHTML.match(/class="ov-card"/g)||[]).length,6);assert(!run("overviewKnowledgeChart('change')").includes('柱状图'));
run("overviewKnowledgeSelect('change',2)");assert.equal(run("overviewKnowledgeVisible('change').length"),1);assert.equal(run("overviewKnowledgeVisible('change')[0][0]"),'modified');assert(run("overviewKnowledgeChart('change')").includes('data-series="modified"'));assert(!run("overviewKnowledgeChart('change')").includes('data-series="added"'));
run("overviewKnowledgeSelect('usage',2)");assert.equal(run("overviewKnowledgeVisible('usage')[0][0]"),'denied');
console.log('Passed: dashboard parent and sibling tabs, knowledge separation, six cards, line charts, metric selection.');

run("dashboardTab='knowledge';overviewScopeBulk(true);overviewState.knowledgeRange='今日';overviewState.knowledgeLibrary='all'");assert.equal(run('overviewKnowledgeTrend().length'),12);for(const key of ['added','modified','deleted','referenced','denied'])assert(run(`overviewKnowledgeTrend().reduce((n,d)=>n+d.${key},0)===overviewKnowledgeSummary().${key}`));assert(run("overviewKnowledgeChart('change')").includes('07:00'));run("overviewState.menu='scope';overviewState.scopeScene='sales'");assert(run("overviewScopePicker()").includes('选择 知识库 销售政策知识库'));
run("overviewScopeBulk(false);overviewScopeToggle(['sales-policy'])");assert.equal(run('overviewKnowledgeSelected().length'),1);assert(run('overviewKnowledgeSummary().stock>0'));run("overviewScopeBulk(false)");assert.equal(run('overviewKnowledgeSummary().stock'),0);
console.log('Passed: knowledge library multiselect, library-only and empty filters, 12 hourly points and hourly/headline reconciliation.');
