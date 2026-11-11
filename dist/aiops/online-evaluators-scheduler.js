/* Browser-local evaluator scheduling. Web Locks serialize every UI/scheduled ledger mutation across tabs. */
(function (global) {
  'use strict';
  var host = {}, timer = null, pending = null, lastTick = null, planned = Object.create(null), errorKey = '', listening = false, generation = 0;
  var LOCK = 'aiops.online-evaluation-ledger.execution.v1', MAX_GAP = 15000, MAX_LATENESS = 5000;
  function clock() { return new Date(typeof host.now === 'function' ? host.now() : host.now == null ? Date.now() : host.now).getTime(); }
  function stamp(at) { return new Date(at).toISOString(); }
  function store() { return global.AIOpsOnlineEvaluatorData.createStore(host.storage || global.localStorage, { now: clock }); }
  function notifyError(message) { if (message !== errorKey) { errorKey = message; if (host.onError) host.onError(message); } }
  function reset() { lastTick = null; planned = Object.create(null); }
  function withLock(work) {
    var locks = global.navigator && global.navigator.locks;
    if (!locks || typeof locks.request !== 'function') return Promise.resolve({ ok: false, error: '当前浏览器不支持跨标签页安全调度，请使用支持 Web Locks 的浏览器。' });
    return locks.request(LOCK, { mode: 'exclusive' }, work);
  }
  function nextRunAt(record, at) {
    if (!record || record.enabled === false) return null;
    var after = at == null ? clock() : new Date(at).getTime(), anchor = Date.parse(record.armedAt), schedule = record.schedule || {};
    if (!Number.isFinite(after) || schedule.timezone !== 'Asia/Shanghai') return null;
    if (!Number.isFinite(anchor)) anchor = after;
    after = Math.max(after, anchor);
    if (schedule.repeat === 'interval') {
      var period = Number(schedule.intervalHours) * 3600000;
      if (!Number.isInteger(Number(schedule.intervalHours)) || period <= 0) return null;
      return stamp(anchor + (Math.floor((after - anchor) / period) + 1) * period);
    }
    if (schedule.repeat === 'once') {
      var once = global.AIOpsOnlineEvaluatorData.onceTimestamp(schedule.onceAt);
      return Number.isFinite(once) && once > after ? stamp(once) : null;
    }
    var match = String(schedule.time || '').match(/^([01]\d|2[0-3]):([0-5]\d)$/);
    if (!match || ['daily', 'weekly', 'monthly'].indexOf(schedule.repeat) < 0) return null;
    var local = new Date(after + 8 * 3600000), start = Date.UTC(local.getUTCFullYear(), local.getUTCMonth(), local.getUTCDate());
    for (var offset = 0; offset <= 370; offset++) {
      var date = new Date(start + offset * 86400000), weekday = date.getUTCDay() || 7;
      if (schedule.repeat === 'weekly' && (!Array.isArray(schedule.weekdays) || schedule.weekdays.indexOf(weekday) < 0)) continue;
      if (schedule.repeat === 'monthly' && (!Array.isArray(schedule.monthdays) || schedule.monthdays.indexOf(date.getUTCDate()) < 0)) continue;
      var slot = date.getTime() + (Number(match[1]) * 60 + Number(match[2])) * 60000 - 8 * 3600000;
      if (slot > after) return stamp(slot);
    }
    return null;
  }
  function plan(record, at) {
    return { signature: JSON.stringify([record.scheduleRevision, record.armedAt, global.AIOpsOnlineEvaluatorData.scheduleKey(record.schedule)]), nextAt: nextRunAt(record, at) };
  }
  function performTick() {
    var at = clock(), discontinuity = lastTick == null || at < lastTick || at - lastTick > MAX_GAP;
    lastTick = at;
    var armed = store().armSchedules(stamp(at)); if (!armed.ok) { notifyError(armed.error); return armed; }
    var records = store().list(), alive = Object.create(null), completed = [], failure = null;
    records.forEach(function (record) {
      alive[record.id] = true;
      if (record.enabled === false) { delete planned[record.id]; return; }
      var current = planned[record.id], next = plan(record, at);
      if (discontinuity || !current || current.signature !== next.signature) { planned[record.id] = next; return; }
      if (!current.nextAt || Date.parse(current.nextAt) > at) return;
      if (at - Date.parse(current.nextAt) > MAX_LATENESS) { planned[record.id] = next; return; }
      var scheduledAt = current.nextAt, result = global.AIOpsOnlineEvaluatorRuntime.run(record, { trigger: 'scheduled', scheduledAt: scheduledAt, scheduleRevision: record.scheduleRevision, armedAt: record.armedAt, scheduleKey: global.AIOpsOnlineEvaluatorData.scheduleKey(record.schedule), slotKey: JSON.stringify([record.id, record.scheduleRevision, scheduledAt]) });
      if (result.ok || result.skipped || result.code === 'disabled') {
        planned[record.id] = next;
        if (result.ok && !result.skipped) { completed.push(result.run); if (host.onRun) host.onRun(result.run); }
      } else { failure = result; notifyError(result.error || '自动评估失败，请检查评估器配置。'); }
    });
    Object.keys(planned).forEach(function (id) { if (!alive[id]) delete planned[id]; });
    if (!failure) errorKey = '';
    return failure || { ok: true, runs: completed };
  }
  function tick() {
    if (pending) return pending;
    var token = generation;
    pending = withLock(function () { return token === generation ? performTick() : { ok: true, skipped: true }; }).then(function (result) { if (!result.ok && result.error) notifyError(result.error); return result; }).catch(function () { var result = { ok: false, error: '自动调度发生异常，请查看评估记录后重试。' }; notifyError(result.error); return result; }).finally(function () { pending = null; });
    return pending;
  }
  function stop() { generation++; if (timer != null) { global.clearInterval(timer); timer = null; } reset(); }
  function resume() { reset(); if (timer != null) tick(); }
  function start() {
    if (timer != null) return tick();
    if (!listening) {
      if (global.document && global.document.addEventListener) global.document.addEventListener('visibilitychange', resume);
      if (global.addEventListener) { global.addEventListener('focus', resume); global.addEventListener('storage', function (event) { if (timer != null && event.key === 'aiops.online-evaluators.v1') tick(); }); }
      listening = true;
    }
    reset(); timer = global.setInterval(function () { tick(); }, 1000); return tick();
  }
  global.AIOpsOnlineEvaluatorScheduler = {
    configure: function (next) { stop(); host = next || {}; errorKey = ''; global.AIOpsOnlineEvaluatorRuntime.configure({ storage: host.storage || global.localStorage, sessions: host.sessions, now: clock }); },
    start: start, stop: stop, tick: tick, nextRunAt: nextRunAt,
    runNow: function (evaluator) { return withLock(function () { return global.AIOpsOnlineEvaluatorRuntime.run(evaluator); }).catch(function () { return { ok: false, error: '评估启动失败，请重试。' }; }); }
  };
})(window);
