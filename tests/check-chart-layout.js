const fs=require('fs'),vm=require('vm'),assert=require('node:assert/strict');
const html=fs.readFileSync('dist/aiops-extensions.html','utf8'),source=html.match(/<script>([\s\S]*?)<\/script>/)[1];
new Function(source);
const context=vm.createContext({console,setTimeout(){},clearTimeout(){}});
vm.runInContext(source.slice(0,source.lastIndexOf('\nstate.composerSkill=null;')),context);
const run=code=>vm.runInContext(code,context);
run('render=()=>{}');
const cases=[
 'costChart(costData().buckets,WIDTH,HEIGHT)',
 "costChart(costData().buckets,WIDTH,HEIGHT,'average')",
 'healthAlertChartSVG(healthData(),WIDTH,HEIGHT)',
 'healthSlowChartSVG(healthData(),WIDTH,HEIGHT)',
 "behaviorChartSVG(behaviorData().buckets,'sessions',WIDTH,HEIGHT)",
 "behaviorChartSVG(behaviorData().buckets,'users',WIDTH,HEIGHT)",
 "behaviorChartSVG(behaviorData().buckets,'feedback',WIDTH,HEIGHT)"
];
for(const range of [1,7,14,30]){
 run(`state.range=${range}`);
 for(const expression of cases)for(const width of [280,436,659,1539])for(const height of [238,280]){
  const svg=run(expression.replace('WIDTH',width).replace('HEIGHT',height));
  assert(svg.startsWith('<svg '));assert(svg.endsWith('</svg>'));
  const root=svg.slice(0,svg.indexOf('>'));
  assert(root.includes(`width="${width}"`));assert(root.includes(`height="${height}"`));
  assert(!/viewBox|preserveAspectRatio/.test(root),'Root coordinates must be CSS pixels, without viewBox scaling');
  assert(!/NaN|Infinity/.test(svg));
  for(const match of svg.matchAll(/\s(?:x|x1|x2|cx)="(-?[\d.]+)"/g))assert(+match[1]>=0&&+match[1]<=width,`${width}: x=${match[1]}`);
  for(const match of svg.matchAll(/\s(?:y|y1|y2|cy)="(-?[\d.]+)"/g))assert(+match[1]>=0&&+match[1]<=height,`${height}: y=${match[1]}`);
 }
 const narrow=run('costChart(costData().buckets,280,260)'),wide=run('costChart(costData().buckets,1539,280)');
 assert.notEqual(narrow.match(/data-cost-series="total" d="([^"]+)"/)[1],wide.match(/data-cost-series="total" d="([^"]+)"/)[1]);
 assert.equal((narrow.match(/class="cost-chart-point"/g)||[]).length,range===1?24:range===30?15:range);
 for(const [group,keys] of [['total',['total','input','output']],['average',['perTurn','perSession']]]){
  const svg=run(`costChart(costData().buckets,659,280,'${group}')`);
  assert.deepEqual([...svg.matchAll(/data-cost-series="([^"]+)"/g)].map(match=>match[1]),keys);
  assert(!svg.includes('模型调用次数'));
  assert.equal((svg.match(/class="cost-chart-point"/g)||[]).length,range===1?24:range===30?15:range);
 }
 const page=run('costPage()');
 assert.equal((page.match(/class="panel cost-trend-panel"/g)||[]).length,2);
 assert(page.includes('data-analysis-chart="cost-total"'));
 assert(page.includes('data-analysis-chart="cost-average"'));
 assert(!page.includes('选择成本趋势指标'));
}
for(const count of [7,14,24]){
 const narrow=run(`Array.from(analysisTickIndices(${count},200))`),wide=run(`Array.from(analysisTickIndices(${count},1400))`);
 assert.equal(narrow[0],0);assert.equal(narrow.at(-1),count-1);
 assert(narrow.length<wide.length);assert(wide.length<=count);
}
run('state.range=14;analysisScopeState.scopeSelection=[]');
for(const expression of cases)assert(!/NaN|Infinity/.test(run(expression.replace('WIDTH',436).replace('HEIGHT',280))));
console.log('Passed: 7 chart types x 4 periods x 4 widths x 2 heights, two cost groups without call counts, CSS-pixel SVG coordinates, bounded geometry, responsive paths, adaptive tick density, retained points and zero states.');
