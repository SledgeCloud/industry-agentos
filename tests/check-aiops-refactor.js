const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const assert = require('node:assert/strict');

// A deployable entry must include every stylesheet, script, image, and font it loads.
const visited = new Set();
function checkAssets(file) {
  file = path.resolve(file);
  if (visited.has(file)) return;
  visited.add(file);
  assert(fs.existsSync(file), `Missing runtime asset: ${file}`);
  const ext = path.extname(file);
  if (!['.html', '.css', '.js'].includes(ext)) return;
  const source = fs.readFileSync(file, 'utf8');
  if (ext === '.js') new vm.Script(source, { filename: file });
  const markup = source.replace(/(<script\b[^>]*>)[\s\S]*?<\/script>/g, '$1</script>');
  const refs = ext === '.html' ? [...markup.matchAll(/(?:src|href)="([^"]+)"/g)].map(m => m[1])
    : ext === '.css' ? [...source.matchAll(/url\(["']?([^"')]+)["']?\)/g)].map(m => m[1]) : [];
  for (const ref of refs) {
    if (/^(?:https?:|data:|#)/.test(ref)) continue;
    assert(!ref.startsWith('file:'), 'No source-machine file URLs in deployable output');
    checkAssets(path.resolve(path.dirname(file), ref.split('?')[0]));
  }
}
checkAssets('dist/new-aiops.html');
checkAssets('dist/aiops-extensions.html');
for (const file of fs.readdirSync('dist/aiops').filter(f => f.endsWith('.js'))) checkAssets('dist/aiops/' + file);

// The preserved operations document runs inline, without cross-file frames or postMessage.
function integrationFixture(origin) {
  const listeners = {}, elements = [], routed = [], changes = [];
  function element() {
    return { style: {}, inert: false, hidden: false, events: {}, classList: { toggle() {} },
      getBoundingClientRect: () => ({ left: 256, top: 0, width: 1024, height: 720 }),
      setAttribute() {}, focus() {}, remove() { this.removed = true; },
      addEventListener(type, fn) { this.events[type] = fn; }, contentWindow: {} };
  }
  const root = element(), user = element(), account = element(), status = element();
  elements.push(root, user, account);
  const baseURI = origin === 'null' ? 'file:///workspace/dist/new-aiops.html' : origin + '/new-aiops.html';
  const host = { URL, location: { origin }, document: { baseURI,
    getElementById: id => ({ pageRoot: root, userBtn: user, acctMenu: account })[id],
    querySelector: () => status,
    createElement: element, body: { children: elements, appendChild: e => elements.push(e) },
    addEventListener: (type, fn) => { listeners['document:' + type] = fn; }
  }, ResizeObserver: class { observe() {} }, addEventListener: (type, fn) => { listeners[type] = fn; },
    AIOpsApp: { navigate: page => routed.push(page) } };
  host.window = host;
  vm.createContext(host);
  for (const file of ['operations-document.js', 'integration.js']) vm.runInContext(fs.readFileSync('dist/aiops/' + file, 'utf8'), host);
  return { host, listeners, elements, routed, changes, root, status };
}
for (const origin of ['http://localhost:8088', 'null']) {
  const { host, listeners, elements, changes, root, status } = integrationFixture(origin);
  host.AIOpsExtensions.afterRender('本体知识运营');
  const frame = elements.at(-1);
  assert.equal(frame.src, undefined, 'No file:// iframe navigation');
  assert(frame.srcdoc.includes('data-operations-page="' + encodeURIComponent('本体知识运营') + '"'));
  assert(!/<script\b[^>]*\bsrc=/.test(frame.srcdoc));
  assert.equal(frame.hidden, true);
  assert.equal(listeners.message, undefined, 'No readiness message handshake');
  // A click during loading must open the newest requested module.
  host.AIOpsExtensions.afterRender('自定义看板');
  assert.equal(elements.at(-1), frame);
  frame.contentWindow.AIOpsOperations = { navigate: page => { changes.push(page); return page; } };
  frame.events.load();
  assert.equal(frame.hidden, false);
  assert.equal(changes.at(-1), '自定义看板');
  host.AIOpsExtensions.beforeRender();
  host.AIOpsExtensions.afterRender('工作台');
  assert.equal(frame.hidden, true);
  frame.events.load();
  assert.equal(frame.hidden, true, 'A late load cannot cover a different page');
  host.AIOpsExtensions.afterRender('本体知识运营');
  assert.equal(elements.at(-1), frame, 'Preserve the same live operations document and edits');
  assert.equal(changes.at(-1), '本体知识运营');
  assert.equal(frame.hidden, false);
  const navigate = frame.contentWindow.AIOpsOperations.navigate;
  frame.contentWindow.AIOpsOperations.navigate = () => { throw new Error('load failure'); };
  host.AIOpsExtensions.afterRender('自定义看板');
  assert.equal(frame.hidden, true);
  assert(status.textContent.includes('页面加载失败'), 'A failure must not remain an endless loading indicator');
  frame.contentWindow.AIOpsOperations.navigate = navigate;
  host.AIOpsExtensions.afterRender('自定义看板');
  assert.equal(frame.hidden, false);
  listeners['document:click']({ target: { closest: () => ({ getAttribute: () => 'enterprise-space.html', textContent: '企业空间' }) }, preventDefault() {}, stopImmediatePropagation() {} });
  const admin = elements.at(-1);
  assert.equal(admin.src, 'enterprise-space.html?from=new-aiops.html&returnDepth=1');
  assert.equal(root.inert, true);
  host.EnterpriseProfile.closeAdministration();
  assert.equal(admin.removed, true);
  assert.equal(root.inert, false);
}

// srcdoc has no URL query. Its body configuration must initialize the correct module.
const legacy = fs.readFileSync('dist/aiops-extensions.html', 'utf8');
const bootstrap = legacy.match(/function initialOperationsPage\(\)\{[\s\S]*?\n\}/)[0];
for (const origin of ['http://localhost:8088', 'null']) {
  for (const page of ['本体知识运营', '消息通知', '自定义看板']) {
    const navigation = [], outerNavigation = [], classes = new Set();
    const parent = { AIOpsApp: { navigate: next => outerNavigation.push(next) }, postMessage() { throw new Error('Must not depend on postMessage'); } };
    const child = { URLSearchParams, location: { origin, search: '' },
      document: { body: { dataset: { operationsEmbedded: '1', operationsPage: encodeURIComponent(page) }, classList: { add: name => classes.add(name) } } }, parent };
    child.window = child;
    vm.createContext(child);
    vm.runInContext(bootstrap + ';var state={page:initialOperationsPage()};function go(page){state.page=page;}', child);
    assert.equal(child.state.page, page);
    assert(classes.has('embedded-operations'));
    child.go = next => { navigation.push(next); child.state.page = next; };
    vm.runInContext(fs.readFileSync('dist/aiops/extensions-host.js', 'utf8'), child);
    assert.equal(child.AIOpsOperations.navigate('消息通知'), '消息通知');
    const calls = navigation.length;
    child.AIOpsOperations.navigate('消息通知');
    assert.equal(navigation.length, calls, 'Unchanged routes retain editing state');
    assert.throws(() => child.AIOpsOperations.navigate('unknown'));
    child.go('工作区');
    assert.deepEqual(outerNavigation, ['分析任务']);
  }
}

// Exercise the actual migrated analysis runtime, including scope and period changes.
const data = { console, document: { addEventListener() {} }, addEventListener() {} };
data.window = data;
vm.createContext(data);
vm.runInContext(fs.readFileSync('dist/aiops/workspace-nav.js', 'utf8'), data);
let range = 7;
let selected = data.AIOpsWorkspaces.scopeCatalog().flatMap(scene => scene.items.map(item => item.id));
data.AIOpsResources = { scopeIds: () => selected, scopeTrigger: () => '' };
vm.runInContext(fs.readFileSync('dist/aiops/analysis-boards.js', 'utf8'), data);
data.AIOpsBoards.configure({ getRange: () => range });
assert.equal(data.AIOpsBoards.metricSummary('total')[0], '95.4M');
assert.equal(data.AIOpsBoards.metricSummary('sessions')[0], '328');
for (const page of ['costPage', 'healthPage', 'behaviorPage']) assert(data.AIOpsBoards[page]().includes('<svg'));
selected = [selected.find(id => id.includes('agents'))];
assert(parseFloat(data.AIOpsBoards.metricSummary('total')[0]) < 95.4);
selected = [];
assert.equal(data.AIOpsBoards.metricSummary('total')[0], '0');
assert.equal(data.AIOpsBoards.metricSummary('sessions')[0], '0');
range = 1;
assert.equal(data.AIOpsBoards.metricSummary('warningEvents')[0], '0');

console.log(`Passed: ${visited.size} runtime assets; script syntax; self-contained srcdoc initialization; direct navigation for HTTP/local files; loading-race handling and error recovery; administration return; migrated analysis render, scopes, empty selections, and periods.`);
