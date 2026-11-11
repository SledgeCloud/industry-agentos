/* Scenario-scoped business task authoring and local Agent trial. */
const evPromptFields = [
  ['description', '任务描述', '描述 Agent 需要完成的业务任务'],
  ['inScope', '范围 · 包含什么', '说明本任务包含的业务范围、数据与动作'],
  ['outScope', '范围 · 不包含什么', '说明任务不处理的事项与边界'],
  ['input', '输入', '说明输入资料、字段与格式'],
  ['completion', '完成标准', '说明任务完成必须满足的条件'],
  ['excellence', '优秀标准', '说明高质量结果的判断标准'],
  ['positive', '正例', '提供符合标准的输入与输出示例'],
  ['negative', '反例', '提供不符合标准的示例与原因']
];
let evTaskEditor = null;
let evTaskTest = null;

function evTaskPrompt(task) {
  const p = task?.prompt;
  if (typeof p === 'string') return p;
  if (!p || typeof p !== 'object') return '';
  return evPromptFields.filter(([key]) => p[key] != null && String(p[key]).length).map(([key, label]) => '【' + label + '】\n' + String(p[key])).join('\n\n');
}

function evTaskTemplate(description = '') {
  return '任务描述：' + (description || '请描述希望 Agent 完成的业务任务与目标。') + '\n\n' +
    '范围：\n包含什么：请说明本任务涉及的业务范围、对象与操作。\n不包含什么：请说明任务边界和无需处理的事项。\n\n' +
    '输入：请说明可提供的资料、字段或用户输入。\n\n' +
    '完成标准：请说明哪些结果代表任务已经完成。\n\n' +
    '优秀标准：请说明高质量结果应具备的特点。\n\n' +
    '正例：请提供一个符合预期的输入和结果示例。\n\n' +
    '反例：请提供一个不符合预期的示例及原因。';
}

function evApplyTaskTemplate() {
  const input = document.querySelector('#ev-form textarea[name="prompt"]');
  if (!input) return;
  const current = input.value || '', template = evTaskTemplate();
  if (current.includes(template) || (evTaskEditor?.templateApplied && current.trim())) { toast('模板已填入，可直接编辑'); return; }
  input.value = current.trim() ? current + (current.endsWith('\n\n') ? '' : '\n\n') + template : template;
  if (evTaskEditor) evTaskEditor.templateApplied = true;
  input.focus?.();
}

function evBuildTaskDraft(fields = {}) {
  const topic = studio.scene === 'procurement' ? '采购计划' : '销售分货';
  const agents = evAgents();
  const requestedAgent = fields.agentId || fields.agent;
  const agent = agents.find(a => a.id === requestedAgent || a.name === requestedAgent) || agents[0];
  const request = String(fields.request || '').trim();
  const description = String(fields.description || '').trim();
  let prompt;
  if (typeof fields.prompt === 'string') prompt = fields.prompt;
  else if (fields.prompt && typeof fields.prompt === 'object') prompt = evTaskPrompt({prompt: fields.prompt});
  else {
    const legacyFields = {};
    evPromptFields.forEach(([key]) => {
      if (fields[key] != null) legacyFields[key] = String(fields[key]);
      if (fields['prompt_' + key] != null) legacyFields[key] = String(fields['prompt_' + key]);
    });
    prompt = Object.keys(legacyFields).length > 1 ? evTaskPrompt({prompt: legacyFields}) : evTaskTemplate(request || description);
  }
  if (request && !prompt.includes(request)) prompt += '\n\n任务需求：' + request;
  if (description && !prompt.includes(description)) prompt += '\n\n任务描述：' + description;
  const instructions = String(fields.instructions || '').trim();
  if (instructions && !prompt.includes(instructions)) prompt += '\n\n补充要求：' + instructions;
  return {
    name: fields.name || topic + '方案质量评测',
    agentId: agent?.id || '',
    version: 'V1',
    prompt,
    dimensions: Array.isArray(fields.dimensions) ? fields.dimensions.map(d => ({name: String(d.name || ''), description: String(d.description || ''), values: Array.isArray(d.values) ? [...d.values] : []})) : []
  };
}

function evTaskRows(tasks, readonly = false) {
  return tasks.map(t => `<tr><td class="ev-id">${esc(t.id)}</td><td><button class="ont-link ev-link ev-name-link" onclick="evTaskDetail('${t.id}')">${esc(t.name)}</button></td><td>${esc(evAgentName(t.agentId))}</td><td>${evVersionBadge(t)}</td><td>${t.dimensions?.length ? wtChips(t.dimensions.map(d => d.name || '未命名维度')) : '—'}</td><td><div class="ev-actions"><button class="ont-link ev-link" onclick="evTaskDetail('${t.id}')">查看</button>${readonly?'':evMore([{label:'编辑',code:`evEditTask('${t.id}')`},{label:'发布',code:`evPublishResource('task','${t.id}')`},{label:'测试',code:`evTestTask('${t.id}')`},{label:'删除',code:`evDeleteTask('${t.id}')`,danger:true}])}</div></td></tr>`);
}

function evTasksView() {
  const q=evState.search.toLowerCase();
  const tasks = evFilteredTasks().filter(t=>evFilterMatch('task','agent',t.agentId)&&(!q||[t.id,t.name,evAgentName(t.agentId),...(t.dimensions||[]).map(d=>d.name)].join(' ').toLowerCase().includes(q)));
  const rows = evTaskRows(tasks);
  return '<div id="ev-task-results">'+evTable(['编号', '名称', evFilterHeader('所属 Agent','task','agent',evAgents()), '版本', '评估维度', '操作'], rows, '<div class="ev-empty"><h3>暂无业务任务</h3><p>新建业务任务，定义提示词与评估维度。</p><button class="ont-button strong" onclick="evEditTask()">＋ 新建业务任务</button></div>', `<label class="ont-search"><input aria-label="搜索业务任务" placeholder="搜索编号、名称或评估维度" value="${esc(evState.search)}" oninput="evState.search=this.value;evRefreshList('task')"><svg viewBox="0 0 18 18"><circle cx="7" cy="7" r="5"/><path d="m11 11 4 4"/></svg></label><div class="ont-head-actions">${evCreateMenu('task')}</div>`)+'</div>';
}

function evTaskDimensionHTML(d, index) {
  return `<section class="ont-execution ev-dimension-row" data-ev-dimension="${index}"><header class="ev-dimension-head"><b>维度 ${index + 1}</b><button type="button" class="ont-link ev-link danger" aria-label="删除维度 ${index + 1}" onclick="evTaskDimensionRemove(${index})">删除</button></header><div class="ont-grid ev-dimension-fields">${evField('维度名称', `<input data-dimension-name aria-label="维度 ${index + 1} 名称" maxlength="60" value="${esc(d.name || '')}" placeholder="如：业务正确性">`, '', false)}${evField('描述', `<input data-dimension-description aria-label="维度 ${index + 1} 描述" maxlength="500" value="${esc(d.description || '')}" placeholder="该维度用于评估什么">`, '', false)}${evField('枚举值', `<input data-dimension-values aria-label="维度 ${index + 1} 枚举值" maxlength="500" value="${esc((d.values || []).join('、'))}" placeholder="如：不符合、部分符合、符合">`, '多个值用逗号、顿号或换行分隔', false)}</div></section>`;
}

function evReadTaskDimensions() {
  return [...document.querySelectorAll('#ev-task-dimensions [data-ev-dimension]')].map(row => ({
    name: row.querySelector('[data-dimension-name]').value.trim(),
    description: row.querySelector('[data-dimension-description]').value.trim(),
    values: [...new Set(row.querySelector('[data-dimension-values]').value.split(/[、,，;；\n]+/).map(v => v.trim()).filter(Boolean))]
  }));
}

function evTaskDimensionAdd() {
  if (!evTaskEditor) return;
  evTaskEditor.dimensions = evReadTaskDimensions();
  evTaskEditor.dimensions.push({name: '', description: '', values: []});
  document.getElementById('ev-task-dimensions').innerHTML = evTaskEditor.dimensions.map(evTaskDimensionHTML).join('');
  document.querySelector('#ev-task-dimensions [data-ev-dimension]:last-child [data-dimension-name]')?.focus();
}

function evTaskDimensionRemove(index) {
  if (!evTaskEditor) return;
  evTaskEditor.dimensions = evReadTaskDimensions();
  evTaskEditor.dimensions.splice(index, 1);
  document.getElementById('ev-task-dimensions').innerHTML = evTaskEditor.dimensions.map(evTaskDimensionHTML).join('');
}

function evEditTask(id = '', draft = null) {
  const task = id ? evData().tasks.find(t => t.id === id) : draft;
  if (id && !task) return;
  const agents = evAgents();
  const prompt = evTaskPrompt(task);
  const fromCopilot = !id && !!draft && evState.copilot?.kind === 'task' && evState.copilot.phase === 'review' && evState.copilot.draft === draft;
  evTaskEditor = {scene: studio.scene, id, fromCopilot, copilotDraft: fromCopilot ? draft : null, dimensions: (task?.dimensions?.length ? task.dimensions : [{name: '', description: '', values: []}]).map(d => ({...d, values: [...(d.values || [])]}))};
  const options = ['', 'scene', 'application'].map(scope => scope === '' ? '<option value="">请选择 Agent</option>' : `<optgroup label="${scope === 'scene' ? '当前场景的 Agent' : '所属应用的 Agent'}">${agents.filter(a => a.scope === scope).map(a => `<option value="${esc(a.id)}" ${task?.agentId === a.id ? 'selected' : ''}>${esc(a.name)}</option>`).join('')}</optgroup>`).join('');
  const body = `<section class="ont-form-section ev-form-section"><h3>基本信息</h3><div class="ont-grid ev-form-grid">${evField('名称', `<input name="name" aria-label="业务任务名称" required maxlength="100" placeholder="输入业务任务名称" value="${esc(task?.name || '')}">`)}${evField('所属 Agent', `<select name="agentId" aria-label="业务任务所属 Agent" required>${options}</select>`, '可选择当前场景或场景所属应用的 Agent')}</div></section><section class="ont-form-section ev-form-section"><div class="ont-section-heading ev-section-heading"><h3>提示词</h3><button type="button" class="ont-button" onclick="evApplyTaskTemplate()">按模板填写</button></div>${evField('业务任务提示词', `<textarea name="prompt" aria-label="业务任务提示词" maxlength="40000" rows="12" placeholder="用自然语言描述希望 Agent 完成的任务。可以说明任务范围（包含什么、不包含什么）、输入、完成标准、优秀标准，并提供正例或反例；也可以点击“按模板填写”后自由修改。">${esc(prompt)}</textarea>`, '', false)}</section><section class="ont-form-section ev-form-section"><div class="ont-section-heading ev-section-heading"><h3>评估维度</h3><button type="button" class="ont-link ev-link" onclick="evTaskDimensionAdd()">＋ 新增维度</button></div><div id="ev-task-dimensions" class="ev-dimensions">${evTaskEditor.dimensions.map(evTaskDimensionHTML).join('')}</div></section>`;
  evModal(id ? '编辑业务任务' : '新建业务任务', body, '<button type="submit" class="ont-button" value="save">保存</button><button type="submit" class="ont-button strong ev-primary" value="publish">发布</button>', `evSaveTask(this,'${id}',event.submitter?.value==='publish')`, id?evVersionSwitcher('task',task,'current','edit'):'');
  document.querySelector('.ev-modal')?.classList.add('ev-task-modal');
}

function evSaveTask(form, id = '', publish = false) {
  if (!evTaskEditor || evTaskEditor.scene !== studio.scene) { toast('场景已变化，请重新打开业务任务'); return; }
  const data = evData();
  const values = new FormData(form);
  const name = String(values.get('name') || '').trim();
  const agentId = String(values.get('agentId') || '');
  const prompt = String(values.get('prompt') || '');
  const dimensions = evReadTaskDimensions().filter(d => d.name || d.description || d.values.length);
  if (!name || !evAgents().some(a => a.id === agentId)) { toast('请填写业务任务名称并选择所属 Agent'); return; }
  const existing = id ? data.tasks.find(t => t.id === id) : null;
  if (id && !existing) { toast('该业务任务已不存在'); return; }
  if (existing && existing.agentId !== agentId && data.suites.some(s => (s.taskIds || []).includes(id))) { toast('该业务任务已被评测集引用，请先解除关联后再更换 Agent'); return; }
  let savedTask = existing;
  if (existing) {if(!existing.createdAt)existing.createdAt=new Date().toISOString();evVersionPrepare(existing);Object.assign(existing, {name, agentId, prompt, dimensions});}
  else { savedTask = {id: evId('task'), name, agentId, prompt, dimensions, version: 'V1', createdAt: new Date().toISOString()}; data.tasks.unshift(savedTask); }
  evVersionSave(savedTask);if(publish)evVersionPublish(savedTask);
  if (!existing && evTaskEditor.fromCopilot && evState.copilot?.kind === 'task' && evState.copilot.phase === 'review' && evState.copilot.draft === evTaskEditor.copilotDraft && typeof evCopilotSaved === 'function') evCopilotSaved('task', savedTask);
  evTaskEditor = null;
  evCloseModal();
  evRender();
  toast(publish?'业务任务已发布 '+savedTask.version:'业务任务已保存，发布后生成版本');
  return true;
}

function evTaskDetail(id, selection = 'current', context = 'detail') {
  const record = evData().tasks.find(t => t.id === id);
  if (!record) return;
  const task = evVersionResolve(record, selection);
  if (!task) return;
  const readField = (label, value, multiline = false) => evField(label, multiline ? `<textarea readonly aria-label="${esc(label)}" rows="3">${esc(value || '—')}</textarea>` : `<input readonly aria-label="${esc(label)}" value="${esc(value || '—')}">`, '', false);
  const body = `<div class="ev-task-detail"><section class="ont-form-section ev-form-section"><h3>基本信息</h3><div class="ont-grid ev-form-grid">${readField('编号', task.id)}${readField('名称', task.name)}${readField('所属 Agent', evAgentName(task.agentId))}${readField('版本', task.version)}</div></section><section class="ont-form-section ev-form-section"><h3>提示词</h3>${readField('业务任务提示词', evTaskPrompt(task), true)}</section><section class="ont-form-section ev-form-section"><h3>评估维度</h3>${(task.dimensions || []).map((d, index) => `<article class="ont-execution ev-dimension-row"><header><b>维度 ${index + 1}</b></header><div class="ont-grid ev-dimension-fields">${readField('维度名称', d.name)}${readField('描述', d.description)}${readField('枚举值', (d.values || []).join('、'))}</div></article>`).join('') || '<p class="ont-message">暂未设置评估维度</p>'}</section></div>`;
  const actions = selection === 'current' ? `<button type="button" class="ont-button" onclick="evEditTask('${id}')">编辑</button><button type="button" class="ont-button strong" onclick="evPublishResource('task','${id}')">发布</button><button type="button" class="ont-button" onclick="evTestTask('${id}')">测试业务任务</button>` : `<button type="button" class="ont-button" onclick="evVersionSelect('task','${id}','current','${context}','${studio.scene}')">返回当前版本</button>`;
  evModal('业务任务详情', body, actions, '', evVersionSwitcher('task',record,selection,context));
  document.querySelector('.ev-modal')?.classList.add('ev-task-modal');
}

function evDeleteTask(id) {
  const data = evData();
  const task = data.tasks.find(t => t.id === id);
  if (!task) return;
  const references = data.suites.filter(s => (s.taskIds || []).includes(id));
  if (references.length) {
    evModal('业务任务仍被使用', `<p>「${esc(task.name)}」已关联到评测集，请先在评测集中取消关联。</p><p class="ev-reference-list">${references.map(s => esc(s.name)).join('、')}</p>`, '<button type="button" class="ont-button strong ev-primary" onclick="evCloseModal()">知道了</button>');
    return;
  }
  evModal('删除业务任务', `<p>确定删除「${esc(task.name)}」？此操作将移除该任务的提示词和评估维度。</p>`, `<button type="button" class="ont-button ev-danger" onclick="evConfirmDeleteTask('${id}','${data.scene}')">删除</button>`);
}

function evConfirmDeleteTask(id, scene) {
  if (studio.scene !== scene) { evCloseModal(); return; }
  const data = evData();
  if (data.suites.some(s => (s.taskIds || []).includes(id))) { toast('业务任务已被评测集引用，请先取消关联'); return; }
  data.tasks = data.tasks.filter(t => t.id !== id);
  evCloseModal();
  evRender();
  toast('业务任务已删除');
}

function evDisposeTaskTest() {
  if (!evTaskTest) return;
  if (evTaskTest.timer !== null) clearTimeout(evTaskTest.timer);
  evTaskTest.generation++;
  evTaskTest.busy = false;
  evTaskTest = null;
}

function evTestTask(id) {
  const task = evData().tasks.find(t => t.id === id);
  if (!task) return;
  if (!evAgents().some(a => a.id === task.agentId)) { toast('所属 Agent 已不可用，请编辑任务后重试'); return; }
  evDisposeTaskTest();
  // evModal may close a preceding modal, so initialize the trial after it mounts.
  evModal('测试业务任务', `<div class="ev-task-test"><div class="ev-test-agent"><span class="ev-agent-avatar">✦</span><div><b>${esc(evAgentName(task.agentId))}</b><small>业务任务：${esc(task.name)} · ${esc(task.version)}</small></div><span class="ev-mock-badge">Mock 运行</span></div><div class="ev-test-messages" id="ev-test-messages" aria-live="polite"><div class="ev-test-welcome"><h3>Agent 已就绪</h3><p>点击下方「测试业务任务」，将自动发送任务提示词并流式展示 Agent 的示例回复。</p></div></div><div class="ev-test-note">本地交互演示，未调用真实 Agent 服务。</div></div>`, '<button type="button" id="ev-test-run" class="ont-button strong ev-primary" onclick="evTestRun()">测试业务任务</button><button type="button" id="ev-test-stop" class="ont-button" hidden onclick="evTestStop()">停止生成</button>');
  document.querySelector('.ev-modal')?.classList.add('ev-test-modal');
  evTaskTest = {scene: studio.scene, task: JSON.parse(JSON.stringify(task)), busy: false, generation: 0, timer: null, progress: 0, messages: [], response: ''};
}

function evTestRenderMessages() {
  const state = evTaskTest;
  const host = document.getElementById('ev-test-messages');
  if (!state || !host) return;
  host.innerHTML = state.messages.map(m => `<article class="ev-test-message ${m.role}"${m.role === 'assistant' ? ` aria-busy="${state.busy}"` : ''}><div class="ev-test-message-label">${m.role === 'user' ? '任务提示词' : esc(evAgentName(state.task.agentId))}</div><div class="ev-test-message-content">${esc(m.text)}</div>${m.role === 'assistant' && state.busy ? '<span class="ev-stream-indicator">正在输出…</span>' : ''}</article>`).join('');
  host.scrollTop = host.scrollHeight;
}

function evTestRun() {
  const state = evTaskTest;
  if (!state || state.busy || state.scene !== studio.scene) return;
  const task = state.task;
  state.busy = true;
  state.generation++;
  state.progress = 0;
  state.messages.push({role: 'user', text: evTaskPrompt(task)}, {role: 'assistant', text: ''});
  const prompt = evTaskPrompt(task), dimensions = task.dimensions || [];
  const example = task.prompt && typeof task.prompt === 'object' ? task.prompt.positive : '';
  state.response = '已收到业务任务「' + task.name + '」。以下为当前 Agent 的 Mock 示例输出。\n\n' +
    '1. 收到的任务提示词\n' + (prompt || '尚未填写提示词，本次仅展示 Mock 运行状态。') + '\n\n' +
    '2. 示例回复\n' + (example || '我已读取这段任务定义。后续会根据提供的输入和约束组织结果，并按任务中约定的标准自检；信息不足时，会说明需要补充的内容。') + '\n\n' +
    '3. 评估维度\n' + (dimensions.length ? dimensions.map(d => '• ' + (d.name || '未命名维度') + (d.description ? '：' + d.description : '') + (d.values?.length ? '；可选等级为 ' + d.values.join(' / ') : '')).join('\n') : '当前未设置评估维度，可稍后补充。') + '\n\n' +
    '当前为本地演示回复，请检查任务定义与结果是否一致。正式评测需接入真实 Agent 后验证。';
  const run = document.getElementById('ev-test-run'), stop = document.getElementById('ev-test-stop');
  if (run) { run.disabled = true; run.textContent = '正在运行…'; }
  if (stop) stop.hidden = false;
  evTestRenderMessages();
  evTestTick(state.generation);
}

function evTestTick(generation) {
  const state = evTaskTest;
  if (!state || generation !== state.generation || !state.busy) return;
  if (state.scene !== studio.scene || !document.getElementById('ev-test-messages')) { evDisposeTaskTest(); return; }
  state.progress = Math.min(state.response.length, state.progress + 12);
  state.messages[state.messages.length - 1].text = state.response.slice(0, state.progress);
  if (state.progress >= state.response.length) {
    state.busy = false;
    state.timer = null;
    const run = document.getElementById('ev-test-run'), stop = document.getElementById('ev-test-stop');
    if (run) { run.disabled = false; run.textContent = '再次测试业务任务'; }
    if (stop) stop.hidden = true;
    evTestRenderMessages();
    return;
  }
  evTestRenderMessages();
  state.timer = setTimeout(() => evTestTick(generation), 30);
}

function evTestStop() {
  const state = evTaskTest;
  if (!state || !state.busy) return;
  if (state.timer !== null) clearTimeout(state.timer);
  state.timer = null;
  state.busy = false;
  state.generation++;
  const last = state.messages[state.messages.length - 1];
  if (last?.role === 'assistant') last.text += '\n\n[已停止生成]';
  const run = document.getElementById('ev-test-run'), stop = document.getElementById('ev-test-stop');
  if (run) { run.disabled = false; run.textContent = '再次测试业务任务'; }
  if (stop) stop.hidden = true;
  evTestRenderMessages();
}

function evCloseTaskTest() { evDisposeTaskTest(); evCloseModal(); }
