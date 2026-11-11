const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const context = { console, Date, JSON, setInterval: () => 1, clearInterval() {} };
context.window = context;
vm.createContext(context);
for (const file of ['evaluation-demo-catalog.js', 'unified-evaluation-data.js']) vm.runInContext(fs.readFileSync('dist/aiops/' + file, 'utf8'), context, { filename: file });
const C = context.AIOpsEvaluationDemoCatalog, D = context.AIOpsUnifiedData;
const clone = value => JSON.parse(JSON.stringify(value));
const assets = C.evaluators(), byAsset = new Map(assets.map(asset => [asset.id, asset]));
assert.equal(C.version, 2);
assert.equal(assets.length, 10);
assert(C.legacyEvaluators().every(asset=>asset.version==='V1'&&asset.demoVersion===1));
assert(assets.filter(asset=>asset.demoLifecycle==='published').every(asset=>asset.version==='V2'));
assert.equal(byAsset.size, assets.length);
assert.equal(assets.filter(asset => asset.demoLifecycle === 'published').length, 9);
assert(assets.some(asset => asset.demoLifecycle === 'draft'));
for (const asset of assets) {
  const contract = D.deriveEvaluatorContract(asset);
  assert(contract.ok, asset.name + ': ' + contract.error);
  assert.equal(D.validateEvaluator(contract.record).length, 0, asset.name);
}
assert.deepEqual([...new Set(assets.flatMap(asset => asset.metrics || []).map(item => item.valueType))].sort(), ['boolean', 'category', 'number', 'text']);
assert(assets.some(asset => asset.authoringMode === 'prompt'));
assert.deepEqual([...new Set(assets.filter(asset => asset.authoringMode !== 'prompt').map(asset => asset.decision.mode))].sort(), ['custom_prompt', 'weighted_score']);
const allCases = [], allExperiments = [];
for (const scene of ['sales', 'procurement']) {
  const data = C.scene(scene), tasks = new Map(data.tasks.map(task => [task.id, task])), cases = new Map(data.cases.map(sample => [sample.id, sample])), suites = new Map(data.suites.map(suite => [suite.id, suite]));
  assert.equal(tasks.size, 3); assert.equal(cases.size, 9); assert.equal(suites.size, 3); assert.equal(data.experiments.length, 4);
  for (const task of tasks.values()) for (const binding of task.evaluationBindings) {
    assert.equal(binding.evaluatorRef.version,'V2');
    assert.equal(binding.taskRef.id, task.id); assert.equal(binding.taskRef.version, task.version);
    const asset = byAsset.get(binding.evaluatorRef.id); assert(asset);
    for (const mapping of binding.dimensionMappings) {
      assert(task.dimensions.some(dimension => dimension.id === mapping.dimensionId));
      assert(asset.metrics.some(metric => metric.id === mapping.metricId));
    }
  }
  for (const suite of suites.values()) {
    for (const id of suite.taskIds) assert(tasks.has(id));
    for (const id of suite.caseIds) {
      assert(cases.has(id)); assert(suite.caseBindings[id]?.length);
      for (const coverage of suite.caseBindings[id]) {
        assert(suite.taskIds.includes(coverage.taskId));
        assert(coverage.dimensionIds.every(id => tasks.get(coverage.taskId).dimensions.some(dimension => dimension.id === id)));
      }
    }
  }
  assert(data.suites[0].caseIds.some(id => data.suites[1].caseIds.includes(id)), 'overlapping suites support deduplication');
  for (const sample of cases.values()) {
    assert(sample.input && sample.expected && sample.tags.length);
    for (const phase of ['initial', 'repaired']) {
      const fixture = C.fixture(sample.id, phase), values = fixture.judgeValues, business = fixture.business;
      assert(fixture.answer.trim() || fixture.runtimeError, 'only an execution error may have no answer'); assert(!/metricValues|overall_verdict|delivery_quality\s*[:=]/.test(fixture.answer), 'business answers must not contain Judge self-scores');
      assert(values.delivery_quality === null || typeof values.delivery_quality === 'number' && values.delivery_quality >= 0 && values.delivery_quality <= 100);
      const allocated = Array.isArray(business.allocated) ? business.allocated.reduce((a, b) => a + b, 0) : business.allocated;
      if (typeof allocated === 'number' && typeof business.inventory === 'number' && allocated > business.inventory) assert.equal(values.constraint_violation, true, sample.name);
      if (business.suppliers?.some(supplier => supplier.quantity > 0 && supplier.qualified === false)) assert.equal(values.qualified_sources, false, sample.name);
      if (business.total != null && business.suppliers?.every(supplier => typeof supplier.unitPrice === 'number')) assert.equal(business.suppliers.reduce((sum, supplier) => sum + supplier.quantity * supplier.unitPrice, 0), business.total, sample.name);
      if (business.businessRisk === 'high' && business.riskHandled) assert(['complete', 'none'].includes(values.risk_recognition), 'correctly handled high business risk is not an Agent failure');
    }
    for (const attachment of sample.inputAttachments || []) {
      assert(attachment.dataUrl.startsWith('data:text/csv;base64,'));
      const decoded = Buffer.from(attachment.dataUrl.split(',')[1], 'base64'); assert.equal(decoded.length, attachment.size); assert(decoded.toString().includes('order_id,sku,region,demand'));
    }
  }
  for (const experiment of data.experiments) {
    assert(experiment.suiteIds.every(id => suites.has(id)));
    const bindings = experiment.bindings.map(binding => ({ ...clone(binding), evaluatorSnapshot: byAsset.get(binding.evaluatorRef.id) }));
    assert.equal(D.validateCompositePolicy(experiment.execution.evaluatorSummary, bindings).length, 0, experiment.name);
    assert(experiment.bindings.every(binding=>binding.evaluatorRef.version==='V2'));
    assert(!JSON.stringify(experiment.execution.evaluatorSummary).includes('item_count'));
    assert(bindings.every(binding => binding.evaluatorSnapshot.demoLifecycle === 'published'));
  }
  allCases.push(...cases.values()); allExperiments.push(...data.experiments);
}
assert(allCases.some(sample => sample.enabled === false));
assert(allCases.some(sample => sample.inputAttachments?.length));
assert(allCases.some(sample => /^\/[a-z-]+/.test(sample.input)));
for (const state of ['resolved', 'persists', 'missing']) assert(allCases.some(sample => sample.demoScenario.repairBehavior === state));
assert.deepEqual([...new Set(allExperiments.map(experiment => experiment.execution.evaluatorSummary.mode))].sort(), ['custom_prompt', 'weighted_score']);
assert(allExperiments.some(experiment => experiment.execution.mode === 'scenario_simulation'));
assert(allExperiments.some(experiment => experiment.execution.caseRuns > 1 && experiment.execution.fullRuns > 1));
assert(allExperiments.some(experiment => experiment.demoState === 'unrun'));
console.log('Evaluation showcase catalog: 10 evaluators, 6 tasks, 6 suites, 18 cases, 8 experiments; references, arithmetic, evidence semantics, attachments and feature coverage passed.');

assert(assets.filter(asset=>asset.decision?.mode==='weighted_score').every(asset=>Math.abs(asset.metrics.filter(item=>item.valueType!=='text').reduce((sum,item)=>sum+item.weight,0)-1)<1e-8));
assert(!assets.some(asset=>/三项中至少两项通过|数量或加权/.test(asset.description)));
