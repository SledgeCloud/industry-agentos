'use strict';
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const assert = require('node:assert/strict');
const native = fs.readFileSync('dist/new-aiops.html', 'utf8');
const workshop = fs.readFileSync('dist/index.html', 'utf8');
const app = fs.readFileSync('dist/aiops/aiops.js', 'utf8');
const moduleFiles = ['unified-evaluation-data.js', 'unified-evaluation-bridge.js', 'unified-evaluation.js', 'evaluation-demo-catalog.js', 'evaluation-demo-runtime.js', 'evaluation-demo-online.js'];
for (const file of moduleFiles) {
  assert(native.includes('aiops/' + file), 'new AIOps loads ' + file);
  assert(!workshop.includes(file), 'workshop does not load ' + file);
  new vm.Script(fs.readFileSync(path.join('dist/aiops', file), 'utf8'), { filename: file });
}
for (const file of ['workshop-evaluation-evaluators.js', 'aiops/online-evaluators-data.js', 'aiops/online-evaluators-runtime.js', 'aiops/online-evaluators-scheduler.js', 'aiops/online-evaluators.js']) {
  assert(native.includes(file), 'original evaluator implementation remains loaded: ' + file);
}
assert(native.indexOf('aiops/unified-evaluation-data.js') < native.indexOf('aiops/unified-evaluation-bridge.js'));
assert(native.indexOf('aiops/evaluation-details.js') < native.indexOf('aiops/unified-evaluation-bridge.js'));
assert(native.indexOf('aiops/unified-evaluation.js') < native.indexOf('aiops/aiops.js'));
assert(native.indexOf('aiops/evaluation-demo-catalog.js') < native.indexOf('aiops/evaluation-demo-runtime.js'));
assert(native.indexOf('aiops/evaluation-demo-online.js') < native.indexOf('aiops/aiops.js'));
// New traffic is opt-in for the new host; the backup runtime keeps the original source rows.
const sessionSource=app.match(/function sessionRows\([^)]*\) \{[\s\S]*?\n  \}(?=\n\n  function sessionTokenLabel)/);
assert(sessionSource);
const isolated={state:{sessionMarks:{}}};isolated.window=isolated;vm.createContext(isolated);vm.runInContext(sessionSource[0],isolated);
const originalIds=JSON.stringify(isolated.sessionRows().map(row=>row.id));
isolated.AIOpsEvaluationDemoOnline={sessions:rows=>rows.concat({id:'INTEGRATION-DEMO-SOURCE'})};
assert.equal(JSON.stringify(isolated.sessionRows(false).map(row=>row.id)),originalIds);
assert.equal(isolated.sessionRows().at(-1).id,'INTEGRATION-DEMO-SOURCE');
assert.match(app,/legacyEvaluationSessions = function \(\) \{ return sessionRows\(false\); \}/);
assert.match(app,/AIOpsBusinessTasks\.configure\(\{[^\n]*sessions: legacyEvaluationSessions/);
assert.match(app,/AIOpsOnlineEvaluators\.configure\(\{[^\n]*sessions: legacyEvaluationSessions/);
assert(app.includes("zh: '离线评估器（备份）'"));
assert(app.includes("zh: '在线评估器（备份）'"));
for (const page of ['统一评估器', '评测任务']) {
  assert(app.includes("{ id: '" + page + "'"), page + ' has a sidebar entry');
  assert(app.includes("page('" + page + "')"), page + ' has a functional route');
  assert(fs.readFileSync('dist/aiops/page-tabs.js', 'utf8').includes("'" + page + "'"));
}
for (const asset of Array.from(native.matchAll(/(?:src|href)="([^"?#]+)(?:\?[^\"]*)?"/g), match => match[1])) {
  if (/^(?:https?:|data:|#)/.test(asset)) continue;
  assert(fs.existsSync(path.resolve('dist', asset)), 'native asset exists: ' + asset);
}
console.log('PASS unified evaluation integration: native-only loading, original backup implementations, navigation/tabs, module order, and asset closure');
