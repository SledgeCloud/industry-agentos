const fs = require('node:fs');
const vm = require('node:vm');
const assert = require('node:assert/strict');
const CONFIG = 'aiops.online-evaluators.v1', LEDGER = 'aiops.online-evaluation-ledger.v1';
const copy = value => JSON.parse(JSON.stringify(value));
function shared(at = '2026-11-05T00:59:58.000Z') {
  const saved = new Map(), clock = { value: Date.parse(at) }, faults = { config: false, ledger: false };
  const storage = { getItem: key => saved.get(key) || null, setItem(key, value) { if (key === CONFIG && faults.config || key === LEDGER && faults.ledger) throw new Error('quota'); saved.set(key, value); } };
  let queue = Promise.resolve();
  const locks = { request(name, options, work) { assert.equal(name, 'aiops.online-evaluation-ledger.execution.v1'); assert.equal(options.mode, 'exclusive'); const result = queue.then(work); queue = result.catch(() => {}); return result; } };
  return { saved, clock, faults, storage, locks };
}
function tab(state = shared()) {
  const events = {}, timers = new Map(), automated = [], errors = []; let serial = 0;
  class Clock extends Date { constructor(...args) { super(...(args.length ? args : [state.clock.value])); } static now() { return state.clock.value; } }
  const context = { console, Date: Clock, localStorage: state.storage, navigator: { locks: state.locks }, document: { addEventListener(type, fn) { events[type] = fn; } }, addEventListener(type, fn) { events[type] = fn; }, setInterval(fn, delay) { assert.equal(delay, 1000); const id = ++serial; timers.set(id, fn); return id; }, clearInterval(id) { timers.delete(id); } };
  context.window = context; vm.createContext(context);
  for (const file of ['workspace-nav.js', 'resource-ui.js', 'online-evaluators-data.js', 'online-evaluators-runtime.js', 'online-evaluators-scheduler.js']) vm.runInContext(fs.readFileSync('dist/aiops/' + file, 'utf8'), context, { filename: file });
  const D = context.AIOpsOnlineEvaluatorData, R = context.AIOpsOnlineEvaluatorRuntime, S = context.AIOpsOnlineEvaluatorScheduler, store = D.createStore(state.storage);
  S.configure({ storage: state.storage, sessions: () => [], now: () => state.clock.value, onRun: run => automated.push(run), onError: message => errors.push(message) });
  function create(schedule = {}) { const draft = D.defaults('audit'); Object.assign(draft, { name: '在线巡检', description: '根据已配置频次评估会话', tags: ['调度'], agentId: 'audit:agents:0', filterLogic: '全部正式用户会话', prompt: '依据正式用户会话进行评估。' }); Object.assign(draft.schedule, schedule); const result = store.save(draft); assert.equal(result.ok, true, JSON.stringify(result)); return result.record; }
  return { state, context, D, R, S, store, create, events, timers, automated, errors, advance(ms) { state.clock.value += ms; }, at(value) { state.clock.value = Date.parse(value); } };
}

(async () => {
  const t = tab(), daily = t.create(); assert.equal(daily.enabled, true); assert.equal(daily.armedAt, '2026-11-05T00:59:58.000Z'); assert.equal(daily.scheduleRevision, 1);
  assert.equal(t.S.nextRunAt(daily), '2026-11-05T01:00:00.000Z');
  await t.S.start(); assert.equal(t.timers.size, 1); t.advance(2000); assert.equal((await t.S.tick()).ok, true);
  assert.equal(t.R.runs(daily.id).length, 1); assert.equal(t.automated.length, 1); assert.equal(t.R.runs(daily.id)[0].trigger, 'scheduled');
  assert.equal(t.R.runs(daily.id)[0].scheduledAt, '2026-11-05T01:00:00.000Z');
  await t.S.tick(); assert.equal(t.R.runs(daily.id).length, 1);
  const oldSlot = t.R.runs(daily.id)[0], oldOptions = { trigger: 'scheduled', scheduledAt: oldSlot.scheduledAt, scheduleRevision: oldSlot.scheduleRevision, armedAt: daily.armedAt, scheduleKey: t.D.scheduleKey(daily.schedule), slotKey: oldSlot.slotKey };
  const duplicate = t.R.run(daily, oldOptions); assert.equal(duplicate.ok, true); assert.equal(duplicate.skipped, true);
  const beforeDisable = t.state.saved.get(LEDGER), disabled = t.store.setEnabled(daily.id, false); assert.equal(disabled.ok, true); assert.equal(disabled.record.enabled, false); assert.equal(t.S.nextRunAt(disabled.record), null);
  assert.equal(t.R.run(daily).code, 'disabled'); assert.equal((await t.S.runNow(Object.assign({}, daily, { enabled: true }))).code, 'disabled'); assert.equal(t.state.saved.get(LEDGER), beforeDisable);
  const changed = copy(daily); changed.name = '编辑后仍停用'; changed.enabled = true; const edited = t.store.save(changed, daily.id); assert.equal(edited.ok, true); assert.equal(edited.record.enabled, false);
  t.advance(1000); const resumed = t.store.setEnabled(daily.id, true).record; assert.equal(resumed.armedAt, '2026-11-05T01:00:01.000Z'); assert(resumed.scheduleRevision > daily.scheduleRevision); await t.S.tick(); assert.equal(t.R.runs(daily.id).length, 1);
  assert.equal(t.S.nextRunAt(resumed), '2026-11-06T01:00:00.000Z');
  assert.equal(t.R.run(daily, oldOptions).code, 'stale-schedule');
  const freshOptions = Object.assign({}, oldOptions, { scheduleRevision: resumed.scheduleRevision, slotKey: JSON.stringify([daily.id, resumed.scheduleRevision, oldSlot.scheduledAt]) });
  assert.equal(t.R.run(daily, freshOptions).code, 'stale-schedule', 'An old activation cannot use a coincidentally identical schedule revision');

  // Calendar schedules use Shanghai dates; nonexistent month dates are skipped.
  const reference = '2026-11-05T01:00:00.000Z', base = Object.assign({}, resumed, { armedAt: '2026-11-01T00:00:00.000Z' });
  assert.equal(t.S.nextRunAt(Object.assign({}, base, { schedule: Object.assign({}, base.schedule, { repeat: 'weekly', weekdays: [1, 3], time: '09:00' }) }), reference), '2026-11-09T01:00:00.000Z');
  assert.equal(t.S.nextRunAt(Object.assign({}, base, { schedule: Object.assign({}, base.schedule, { repeat: 'monthly', monthdays: [31], time: '09:00' }) }), reference), '2026-12-31T01:00:00.000Z');
  assert.equal(t.S.nextRunAt(Object.assign({}, base, { schedule: Object.assign({}, base.schedule, { repeat: 'monthly', monthdays: [29], time: '09:00' }) }), '2028-02-28T01:00:00.000Z'), '2028-02-29T01:00:00.000Z');
  const intervalTab = tab(shared('2026-11-05T00:00:00.000Z')), interval = intervalTab.create({ repeat: 'interval', intervalHours: 1 });
  assert.equal(intervalTab.S.nextRunAt(interval), '2026-11-05T01:00:00.000Z'); intervalTab.advance(60000);
  const intervalEdit = copy(interval); intervalEdit.schedule.intervalHours = 2; const newInterval = intervalTab.store.save(intervalEdit, interval.id).record;
  assert.equal(newInterval.armedAt, '2026-11-05T00:01:00.000Z'); assert.equal(intervalTab.S.nextRunAt(newInterval), '2026-11-05T02:01:00.000Z');
  const nameOnly = copy(newInterval); nameOnly.description = '仅修改描述'; intervalTab.advance(60000); const noReanchor = intervalTab.store.save(nameOnly, interval.id).record; assert.equal(noReanchor.armedAt, newInterval.armedAt); assert.equal(noReanchor.scheduleRevision, newInterval.scheduleRevision);

  // A one-time record remains executable at/after its slot, even though the editor now considers the date past.
  const one = tab(), once = one.create({ repeat: 'once', onceAt: '2026-11-05T09:00' }); await one.S.start(); one.advance(2000);
  assert(one.D.validate(once).some(error => error.field === 'schedule.onceAt')); assert.equal((await one.S.tick()).ok, true); assert.equal(one.R.runs(once.id).length, 1); assert.equal(one.S.nextRunAt(once), null);
  assert.equal(one.store.setEnabled(once.id, false).ok, true); assert.equal(one.store.setEnabled(once.id, true).ok, true); assert.equal(one.R.run(once).ok, true, 'Enabled expired single-run configurations still permit an explicit manual evaluation');

  // Legacy configurations are armed on first scheduler activation, without replaying their old schedules.
  const legacy = tab(), original = legacy.create({ repeat: 'interval', intervalHours: 1 }); const raw = JSON.parse(legacy.state.saved.get(CONFIG)); delete raw[0].enabled; delete raw[0].armedAt; delete raw[0].enabledAt; delete raw[0].scheduleRevision; legacy.state.saved.set(CONFIG, JSON.stringify(raw));
  assert.equal(legacy.store.list()[0].enabled, true); legacy.at('2026-11-06T00:00:00.000Z'); await legacy.S.start(); const armedLegacy = legacy.store.list()[0]; assert.equal(armedLegacy.armedAt, '2026-11-06T00:00:00.000Z'); assert.equal(legacy.R.runs(original.id).length, 0); assert.equal(legacy.S.nextRunAt(armedLegacy), '2026-11-06T01:00:00.000Z');
  const refreshState = shared(), firstTab = tab(refreshState), refreshRecord = firstTab.create(); await firstTab.S.start(); firstTab.S.stop(); refreshState.clock.value += 2000; const reloaded = tab(refreshState); await reloaded.S.start(); assert.equal(reloaded.R.runs(refreshRecord.id).length, 0, 'A refresh after the slot does not backfill');
  const sleep = tab(), sleepRecord = sleep.create(); await sleep.S.start(); sleep.advance(20000); await sleep.S.tick(); assert.equal(sleep.R.runs(sleepRecord.id).length, 0, 'A suspended timer does not catch up');
  const visibility = tab(), visibilityRecord = visibility.create(); await visibility.S.start(); visibility.advance(2000); visibility.events.visibilitychange(); await visibility.S.tick(); assert.equal(visibility.R.runs(visibilityRecord.id).length, 0, 'Visibility recovery plans future slots');

  // Both tabs share one global execution lock and the same persisted slot identity.
  const sameOrigin = shared(), left = tab(sameOrigin), sharedRecord = left.create(), right = tab(sameOrigin); await Promise.all([left.S.start(), right.S.start()]); sameOrigin.clock.value += 2000;
  await Promise.all([left.S.tick(), right.S.tick()]); assert.equal(left.R.runs(sharedRecord.id).length, 1); assert.equal(left.automated.length + right.automated.length, 1);
  await Promise.all([left.S.runNow(sharedRecord), right.S.runNow(sharedRecord)]); assert.equal(left.R.runs(sharedRecord.id).length, 3, 'Manual and scheduled writes use the same cross-tab ledger lock');
  for (const field of ['activation', 'schedule']) {
    const collision = tab(), original = collision.create(), stored = JSON.parse(collision.state.saved.get(CONFIG));
    const options = { trigger: 'scheduled', scheduledAt: '2026-11-05T01:00:00.000Z', scheduleRevision: original.scheduleRevision, armedAt: original.armedAt, scheduleKey: collision.D.scheduleKey(original.schedule), slotKey: JSON.stringify([original.id, original.scheduleRevision, '2026-11-05T01:00:00.000Z']) };
    if (field === 'activation') stored[0].armedAt = '2026-11-05T00:59:59.000Z'; else stored[0].schedule.time = '10:00';
    collision.state.saved.set(CONFIG, JSON.stringify(stored)); collision.advance(2000);
    assert.equal(collision.R.run(original, options).code, 'stale-schedule', 'Revision collisions cannot reuse an old ' + field); assert.equal(collision.R.runs(original.id).length, 0);
  }

  // A failed write neither changes enabled state nor consumes a scheduled slot.
  const failing = tab(), failingRecord = failing.create(); const originalConfig = failing.state.saved.get(CONFIG); failing.state.faults.config = true;
  assert.equal(failing.store.setEnabled(failingRecord.id, false).ok, false); assert.equal(failing.state.saved.get(CONFIG), originalConfig); failing.state.faults.config = false;
  await failing.S.start(); failing.advance(2000); failing.state.faults.ledger = true; assert.equal((await failing.S.tick()).ok, false); assert.equal(failing.R.runs(failingRecord.id).length, 0); assert.equal(failing.state.saved.has(LEDGER), false);
  failing.state.faults.ledger = false; failing.advance(1000); assert.equal((await failing.S.tick()).ok, true); assert.equal(failing.R.runs(failingRecord.id).length, 1); assert.equal(failing.R.runs(failingRecord.id)[0].scheduledAt, '2026-11-05T01:00:00.000Z');
  for (const instance of [t, intervalTab, one, legacy, firstTab, reloaded, sleep, visibility, left, right, failing]) instance.S.stop();
  assert.equal(t.timers.size, 0);
  const afterStop = t.state.saved.get(LEDGER); t.advance(86400000); t.events.storage({ key: CONFIG }); t.events.focus(); await Promise.resolve(); assert.equal(t.state.saved.get(LEDGER), afterStop, 'Stopping prevents passive storage/focus events from restarting evaluation');
  console.log('Passed: enabled defaults/migration and atomic state changes; preserved disabled edits/history; Shanghai daily/weekly/monthly/interval/once slots; expired once execution; activation and schedule anchors; no offline/refresh/visibility catch-up; stale-state protection; same-slot cross-tab deduplication; shared manual/scheduled lock; failed writes without phantom state or consumed slots.');
})().catch(error => { console.error(error); process.exitCode = 1; });
