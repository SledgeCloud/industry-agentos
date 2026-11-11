/* Reusable scene-local Rubric evaluators. Configuration and scores are local Mock data. */
const evEvaluatorStores={};
const evEvaluatorState={scene:'sales',search:'',status:'全部状态'};
let evEvaluatorEditor=null;
function evEvaluatorClone(value){return JSON.parse(JSON.stringify(value));}
function evEvaluatorScene(scene){if(!['sales','procurement'].includes(scene))throw Error('评估器场景无效');return scene;}
function evEvaluatorTime(){return new Date().toLocaleString('sv-SE',{timeZone:'Asia/Shanghai',hour12:false});}
function evSeedEvaluators(scene){
  evEvaluatorScene(scene);const sales=scene==='sales',prefix=sales?'SAL':'PUR',topic=sales?'销售分货':'采购寻源';
  return [
    {id:prefix+'-EV-001',name:topic+'业务结果评分',description:sales?'根据用例输入、预期结果及业务规则，评估分货数量、库存约束和结果可追溯性。':'根据用例输入、预期结果及准入规则，评估寻源方案、供应商资格和采购依据。',version:'V2',enabled:true,passScore:80,criteria:[
      {name:'业务正确性',description:sales?'0 分：分货数量与需求不符或计算错误；50 分：主要结果正确但有局部遗漏；100 分：分配量与需求、库存完全一致。':'0 分：采购数量或供应商推荐错误；50 分：主要方案正确但有局部遗漏；100 分：采购量满足净需求，推荐供应商符合业务要求。',weight:0.5,passScore:80},
      {name:'约束遵循',description:sales?'0 分：超出可供库存或违反已确认渠道规则；50 分：遵守主要约束但未解释例外；100 分：遵守库存与渠道约束，并清楚说明未满足需求。':'0 分：使用未准入供应商或违反交期约束；50 分：遵守主要约束但遗漏风险；100 分：满足准入、报价和交付约束，并说明相关风险。',weight:0.3,passScore:80},
      {name:'依据可追溯',description:'0 分：缺少来源与规则依据；50 分：部分结果能追溯；100 分：关键业务判断均提供可核对的数据来源和规则依据。',weight:0.2,passScore:80}
    ],updatedAt:'2026-11-01 09:10:00',history:[]},
    {id:prefix+'-EV-002',name:topic+'异常与边界评分',description:sales?'评估数据缺失、库存不足和分货规则冲突时的异常识别及人工确认行为。':'评估物料信息缺失、供应商交付异常和报价冲突时的识别与人工确认行为。',version:'V1',enabled:true,passScore:85,criteria:[
      {name:'输入缺失识别',description:sales?'0 分：缺少商品编码等关键字段仍直接计算；50 分：发现缺失但未请求补充；100 分：明确缺失字段与影响，暂停依赖该数据的计算并请求补充。':'0 分：缺少物料编码或准入资料仍生成推荐；50 分：发现缺失但未请求补充；100 分：列明缺失字段与影响，暂停相关推荐并请求补充。',weight:0.4,passScore:85},
      {name:'冲突处理',description:'0 分：忽略规则冲突或擅自覆盖已确认规则；50 分：指出冲突但未说明影响；100 分：清楚列出冲突、影响与备选处理，并等待业务确认。',weight:0.4,passScore:85},
      {name:'执行边界',description:'0 分：把草案直接当作已审批或已执行结果；50 分：提及审核但缺少明确确认节点；100 分：清楚区分建议、待确认事项与已执行动作，保留人工确认节点。',weight:0.2,passScore:85}
    ],updatedAt:'2026-11-01 09:05:00',history:[]},
    {id:prefix+'-EV-003',name:topic+'交付完整性评分',description:'评估业务方案的结果字段、异常说明与表达质量，可在确认评分标准后启用。',version:'V1',enabled:false,passScore:75,criteria:[
      {name:'结果字段完整性',description:sales?'0 分：缺少分配量、缺口等必要结果；50 分：包含主要字段但异常明细不全；100 分：输出订单、商品、分配量、需求缺口及规则依据。':'0 分：缺少供应商、采购量、报价或交期；50 分：包含主要字段但风险明细不全；100 分：输出物料、供应商、采购量、报价、交期及准入依据。',weight:0.6,passScore:75},
      {name:'表达与可用性',description:'0 分：表达混乱且无法用于业务评审；50 分：结构基本清楚但重点不突出；100 分：结构清晰、术语一致，结论与待确认事项便于业务评审。',weight:0.4,passScore:75}
    ],updatedAt:'2026-11-01 09:00:00',history:[]}
  ];
}
function evEvaluatorStore(scene=studio.scene){evEvaluatorScene(scene);return evEvaluatorStores[scene]||(evEvaluatorStores[scene]={scene,sequence:3,evaluators:evSeedEvaluators(scene)});}
function evEvaluatorDefaultIds(scene=studio.scene){const first=evEvaluatorStore(scene).evaluators.find(e=>e.enabled);return first?[first.id]:[];}
function evEvaluatorValidate(fields){
  if(!fields||typeof fields!=='object')throw Error('评估器配置无效');
  if(typeof fields.name!=='string'||typeof fields.description!=='string')throw Error('评估器名称和简介必须为文本');
  const name=fields.name.trim(),description=fields.description.trim();
  if(!name||!description)throw Error('请填写评估器名称和简介');
  if(name.length>100||description.length>3000)throw Error('评估器名称最多 100 字，简介最多 3,000 字');
  if(!Array.isArray(fields.criteria)||!fields.criteria.length)throw Error('请至少添加一个评分项');
  const criteria=fields.criteria.map((row,index)=>{
    if(!row||typeof row!=='object')throw Error('第 '+(index+1)+' 个评分项无效');
    if(typeof row.name!=='string'||typeof row.description!=='string')throw Error('评分项和评分标准必须为文本');
    const criterion={name:row.name.trim(),description:row.description.trim(),weight:Number(row.weight)},rawThreshold=row.passScore===undefined?(fields.passScore===undefined?80:fields.passScore):row.passScore;
    if(!criterion.name||!criterion.description)throw Error('请填写第 '+(index+1)+' 个评分项和评分标准');
    if(criterion.name.length>80||criterion.description.length>3000)throw Error('评分项最多 80 字，评分标准最多 3,000 字');
    if(!['number','string'].includes(typeof row.weight)||!Number.isFinite(criterion.weight)||criterion.weight<=0||criterion.weight>1)throw Error('每个评分项的权重必须大于 0 且不超过 1');
    if(!['number','string'].includes(typeof rawThreshold)||String(rawThreshold).trim()===''||!Number.isFinite(Number(rawThreshold))||Number(rawThreshold)<0||Number(rawThreshold)>100)throw Error('每个评分项的通过阈值必须在 0～100 之间');
    criterion.passScore=Number(rawThreshold);return criterion;
  });
  if(new Set(criteria.map(c=>c.name)).size!==criteria.length)throw Error('评分项名称不能重复');
  if(Math.abs(criteria.reduce((sum,c)=>sum+c.weight,0)-1)>1e-8)throw Error('评分项权重之和必须为 1');
  if(fields.enabled!==undefined&&typeof fields.enabled!=='boolean')throw Error('评估器启用状态无效');
  const passScore=Number(criteria.reduce((sum,c)=>sum+c.weight*c.passScore,0).toFixed(10));
  return {name,description,passScore,criteria};
}
function evEvaluatorPublishedVersions(evaluator){
  if(!evaluator)return [];
  const records=[...(evaluator.publishedSnapshot?[evaluator.publishedSnapshot]:evaluator.publicationStatus!=='draft'?[evaluator]:[]),...(evaluator.history||[])],seen=new Set();
  return records.filter(record=>record&&/^V[1-9]\d*$/.test(record.version||'')&&!seen.has(record.version)&&seen.add(record.version)).sort((a,b)=>Number(b.version.slice(1))-Number(a.version.slice(1)));
}
function evEvaluatorSnapshot(ids,scene=studio.scene,versions){
  const store=evEvaluatorStore(scene);if(!Array.isArray(ids)||!ids.length)throw Error('请至少选择一个离线评估器');
  const unique=[...new Set(ids)];if(unique.some(id=>typeof id!=='string'||!id))throw Error('评估器标识无效');
  if(versions!==undefined&&(!versions||typeof versions!=='object'||Array.isArray(versions)))throw Error('评估器版本配置无效');
  if(versions&&Object.keys(versions).some(id=>!unique.includes(id)))throw Error('版本配置包含未选择的评估器');
  return unique.map(id=>{const evaluator=store.evaluators.find(e=>e.id===id);if(!evaluator)throw Error('评估器不存在或不属于当前场景');if(!evaluator.enabled)throw Error('评估器「'+evaluator.name+'」已停用，请选择启用的评估器');
    const version=versions?.[id],record=version===undefined?evaluator:evEvaluatorPublishedVersions(evaluator).find(item=>item.version===version);
    if(!record)throw Error('评估器「'+evaluator.name+'」的已发布版本不可用，请重新选择版本');
    const normalized=evEvaluatorValidate(record);return {...evVersionExperimentSnapshot(record),...normalized,id:evaluator.id,enabled:evaluator.enabled};});
}
function evSaveEvaluatorDraft(fields,id='',scene=studio.scene,publish=false){
  const store=evEvaluatorStore(scene),prior=id?store.evaluators.find(e=>e.id===id):null;if(id&&!prior)throw Error('评估器不存在或不属于当前场景');
  const values=evEvaluatorValidate(fields),enabled=prior?(fields.enabled===undefined?prior.enabled:fields.enabled):true;
  if(prior){
    evVersionPrepare(prior);Object.assign(prior,values,{enabled,updatedAt:evEvaluatorTime()});
    if(publish)evVersionPublish(prior);else evVersionSave(prior);return prior;
  }
  const prefix=scene==='sales'?'SAL':'PUR',record={id:prefix+'-EV-'+String(++store.sequence).padStart(3,'0'),...values,version:'V1',enabled,updatedAt:evEvaluatorTime(),history:[]};
  evVersionSave(record);if(publish)evVersionPublish(record);store.evaluators.unshift(record);return record;
}
function evPublishEvaluator(id,scene=studio.scene){
  try{
    if(scene!==studio.scene)throw Error('当前场景已变更，请重新打开评估器');
    const evaluator=evEvaluatorStore(scene).evaluators.find(e=>e.id===id);if(!evaluator)throw Error('评估器不存在或不属于当前场景');
    evEvaluatorValidate(evaluator);evVersionPublish(evaluator);evaluator.updatedAt=evEvaluatorTime();evCloseModal();evRender();toast('评估器已发布为 '+evaluator.version);return evaluator;
  }catch(error){toast(error.message||'发布评估器失败');return false;}
}

function evEvaluatorUI(){if(evEvaluatorState.scene!==studio.scene){Object.assign(evEvaluatorState,{scene:studio.scene,search:'',status:'全部状态'});evEvaluatorEditor=null;}return evEvaluatorState;}
function evEvaluatorVisible(){const state=evEvaluatorUI(),q=state.search.trim().toLowerCase();return evEvaluatorStore().evaluators.filter(e=>(typeof evFilterMatch==='function'?evFilterMatch('evaluator','enabled',e.enabled?'enabled':'disabled'):state.status==='全部状态'||e.enabled===(state.status==='已启用'))&&(!q||[e.id,e.name,e.description,...e.criteria.map(c=>c.name)].join(' ').toLowerCase().includes(q)));}
function evEvaluatorRuleText(evaluator){const normalized=evEvaluatorValidate(evaluator);return '全部评分项达标；'+normalized.criteria.map(c=>c.name+' ≥ '+c.passScore+'分').join('；');}
function evEvaluatorsView(){evEvaluatorUI();return `<div id="ev-evaluator-list">${evEvaluatorListTable(evEvaluatorVisible())}</div>`;}
function evEvaluatorListTable(evaluators,contentOnly=false){
  const statusHeader=typeof evFilterHeader==='function'?evFilterHeader('状态','evaluator','enabled',[{id:'enabled',name:'已启用'},{id:'disabled',name:'已停用'}]):'状态',headers=['编号','名称','评分项数','达标规则','版本',statusHeader,'更新时间','操作'],rows=evaluators.map(e=>`<tr><td><span class="ont-id">${esc(e.id)}</span></td><td><button type="button" class="ont-link" onclick="evEvaluatorDetail('${e.id}')">${esc(e.name)}</button></td><td>${e.criteria.length}</td><td><span class="ev-ellipsis" title="${esc(evEvaluatorRuleText(e))}">${esc(evEvaluatorRuleText(e))}</span></td><td>${evVersionBadge(e)}</td><td><span class="ont-enabled ${e.enabled?'':'draft'}">${e.enabled?'已启用':'已停用'}</span></td><td>${esc(e.updatedAt)}</td><td><div class="ev-actions"><button type="button" class="ont-link" onclick="evEvaluatorDetail('${e.id}')">查看</button>${evMore([{label:'编辑',code:`evEditEvaluator('${e.id}')`},{label:'发布新版本',code:`evPublishEvaluator('${e.id}','${studio.scene}')`},{label:e.enabled?'停用':'启用',code:`evToggleEvaluator('${e.id}')`},{label:'删除',code:`evDeleteEvaluator('${e.id}')`,danger:true}])}</div></td></tr>`),empty='<div class="ont-empty">暂无匹配的离线评估器</div>',toolbar=`<label class="ont-search"><input aria-label="搜索离线评估器" placeholder="搜索编号、名称或评分项" value="${esc(evEvaluatorState.search)}" oninput="evEvaluatorState.search=this.value;evEvaluatorRefreshList()"><svg viewBox="0 0 18 18"><circle cx="7" cy="7" r="5"/><path d="m11 11 4 4"/></svg></label><div class="ont-head-actions">${evCreateMenu('evaluator')}</div>`;
  return contentOnly?evTableContent(headers,rows,empty):evTable(headers,rows,empty,toolbar);
}
function evEvaluatorRefreshList(){if(typeof evRefreshList==='function'){evRefreshList('evaluator');return;}const node=document.getElementById('ev-evaluator-list');if(!node)return;const content=node.querySelector?.('.ev-table-content');if(content)content.innerHTML=evEvaluatorListTable(evEvaluatorVisible(),true);else node.innerHTML=evEvaluatorListTable(evEvaluatorVisible());}
function evEvaluatorCriterionMarkup(criterion,index,count){return `<section class="ont-execution ev-evaluator-criterion" data-ev-criterion="${index}"><div class="ont-grid ev-evaluator-criterion-fields">${evField('评分项',`<input name="criterionName" data-criterion-name aria-label="评分项 ${index+1} 名称" required maxlength="80" placeholder="例如：业务正确性" value="${esc(criterion.name)}" oninput="evEvaluatorCriterionChange(${index},'name',this.value)">`)}${evField('权重',`<input name="criterionWeight" data-criterion-weight aria-label="评分项 ${index+1} 权重" required type="number" min="0" max="1" step="any" placeholder="0.5" value="${esc(criterion.weight)}" oninput="evEvaluatorCriterionChange(${index},'weight',this.value)">`)}${evField('通过阈值',`<input name="criterionPassScore" data-criterion-pass-score aria-label="评分项 ${index+1} 通过阈值" required type="number" min="0" max="100" step="any" value="${esc(criterion.passScore??80)}" oninput="evEvaluatorCriterionChange(${index},'passScore',this.value)">`)}${evField('评分标准',`<textarea name="criterionDescription" data-criterion-description aria-label="评分项 ${index+1} 标准" required maxlength="3000" placeholder="描述低分、中间分与高分的判断标准" oninput="evEvaluatorCriterionChange(${index},'description',this.value)">${esc(criterion.description)}</textarea>`)}<button type="button" class="ont-link danger" aria-label="删除评分项 ${index+1}" ${count<=1?'disabled':''} onclick="evEvaluatorRemoveCriterion(${index})">删除</button></div></section>`;}
function evEvaluatorCriteriaMarkup(){const criteria=evEvaluatorEditor?.criteria||[];return criteria.map((criterion,index)=>evEvaluatorCriterionMarkup(criterion,index,criteria.length)).join('');}
function evEditEvaluator(id=''){
  evEvaluatorUI();const evaluator=id?evEvaluatorStore().evaluators.find(e=>e.id===id):null;if(id&&!evaluator){toast('评估器不存在或不属于当前场景');return false;}
  const normalized=evaluator?evEvaluatorValidate(evaluator):null;evEvaluatorEditor={scene:studio.scene,id,fields:{name:evaluator?.name||'',description:evaluator?.description||''},criteria:evEvaluatorClone(normalized?.criteria||[{name:'',description:'',weight:1,passScore:80}])};
  const f=evEvaluatorEditor.fields,body=`${evVersionEditorNote(evaluator)}<input type="hidden" name="scene" value="${studio.scene}"><section class="ont-form-section"><h3>基本信息</h3><div class="ont-grid">${evField('评估器名称',`<input name="name" aria-label="评估器名称" required maxlength="100" placeholder="请输入评估器名称" value="${esc(f.name)}" oninput="if(evEvaluatorEditor)evEvaluatorEditor.fields.name=this.value">`)}<div></div><div class="ont-wide">${evField('评估器简介',`<textarea name="description" aria-label="评估器简介" required maxlength="3000" placeholder="说明评估器关注的业务质量与适用范围" oninput="if(evEvaluatorEditor)evEvaluatorEditor.fields.description=this.value">${esc(f.description)}</textarea>`)}</div></div></section><section class="ont-form-section"><h3>评分标准</h3><p class="muted">权重为小数且合计 1。每项按 0～100 分评分；所有评分项达到各自阈值时通过，权重仅影响总分。</p><div id="ev-evaluator-criteria">${evEvaluatorCriteriaMarkup()}</div><div class="ont-section-title"><button type="button" class="ont-link" onclick="evEvaluatorAddCriterion()">＋ 添加评分项</button><span id="ev-evaluator-weight-total" class="muted"></span></div></section><p id="ev-evaluator-error" class="ont-error" role="alert"></p>`;
  evModal(evaluator?'编辑离线评估器':'新建离线评估器',body,'<button type="submit" value="save" class="ont-button">保存</button><button type="submit" value="publish" class="ont-button strong">发布</button>',`evSubmitEvaluator(this,'${id}',event.submitter?.value==='publish')`,evaluator?evVersionSwitcher('evaluator',evaluator,'current','edit'):'');document.querySelector('.ev-modal')?.classList.add('ev-evaluator-editor');evEvaluatorWeightTotal();return true;
}
function evEvaluatorCriterionChange(index,key,value){const editor=evEvaluatorEditor;if(!editor||editor.scene!==studio.scene||!editor.criteria[index]||!['name','description','weight','passScore'].includes(key))return;editor.criteria[index][key]=value;if(key==='weight')evEvaluatorWeightTotal();const error=document.getElementById('ev-evaluator-error');if(error)error.textContent='';}
function evEvaluatorCaptureCriteria(){const editor=evEvaluatorEditor;if(!editor||editor.scene!==studio.scene)return;const rows=[...(document.querySelectorAll?.('#ev-evaluator-criteria [data-ev-criterion]')||[])];if(rows.length)editor.criteria=rows.map(row=>({name:row.querySelector('[data-criterion-name]')?.value||'',description:row.querySelector('[data-criterion-description]')?.value||'',weight:row.querySelector('[data-criterion-weight]')?.value??'',passScore:row.querySelector('[data-criterion-pass-score]')?.value??''}));}
function evEvaluatorAddCriterion(){const editor=evEvaluatorEditor;if(!editor||editor.scene!==studio.scene)return;evEvaluatorCaptureCriteria();editor.criteria.push({name:'',description:'',weight:'',passScore:80});const node=document.getElementById('ev-evaluator-criteria');if(node)node.innerHTML=evEvaluatorCriteriaMarkup();evEvaluatorWeightTotal();}
function evEvaluatorRemoveCriterion(index){const editor=evEvaluatorEditor;if(!editor||editor.scene!==studio.scene||!Number.isInteger(index)||index<0||index>=editor.criteria.length)return;if(editor.criteria.length<=1){toast('至少保留一个评分项');return;}evEvaluatorCaptureCriteria();editor.criteria.splice(index,1);const node=document.getElementById('ev-evaluator-criteria');if(node)node.innerHTML=evEvaluatorCriteriaMarkup();evEvaluatorWeightTotal();}
function evEvaluatorWeightTotal(){const node=document.getElementById('ev-evaluator-weight-total');if(!node||!evEvaluatorEditor)return;const total=evEvaluatorEditor.criteria.reduce((sum,c)=>sum+(Number(c.weight)||0),0),rounded=Number(total.toFixed(4));node.textContent='当前权重合计：'+rounded+(Math.abs(total-1)<1e-8?'':'（需为 1）');}
function evSubmitEvaluator(form,id='',publish=false){
  const f=new FormData(form);try{
    if((f.get('scene')&&f.get('scene')!==studio.scene)||(evEvaluatorEditor&&evEvaluatorEditor.scene!==studio.scene))throw Error('当前场景已变更，请重新打开评估器');
    const names=f.getAll('criterionName'),descriptions=f.getAll('criterionDescription'),weights=f.getAll('criterionWeight'),thresholds=f.getAll('criterionPassScore');
    if(names.length!==descriptions.length||names.length!==weights.length||names.length!==thresholds.length)throw Error('评分项信息不完整，请检查后重试');
    const criteria=names.map((name,index)=>({name,description:descriptions[index],weight:weights[index],passScore:thresholds[index]}));
    const saved=evSaveEvaluatorDraft({name:f.get('name'),description:f.get('description'),criteria},id,studio.scene,publish);
    evEvaluatorEditor=null;evCloseModal();evRender();toast(publish?'评估器已发布为 '+saved.version:'评估器已保存，待发布');return saved;
  }catch(error){const message=error.message||'保存评估器失败',node=document.getElementById('ev-evaluator-error');if(node)node.textContent=message;toast(message);return false;}
}
function evToggleEvaluator(id){const evaluator=evEvaluatorStore().evaluators.find(e=>e.id===id);if(!evaluator){toast('评估器不存在或不属于当前场景');return false;}evaluator.enabled=!evaluator.enabled;evaluator.updatedAt=evEvaluatorTime();evRender();toast(evaluator.enabled?'评估器已启用':'评估器已停用');return evaluator;}
function evEvaluatorDetail(id,selection='current',context='detail'){
  const record=evEvaluatorStore().evaluators.find(e=>e.id===id);if(!record){toast('评估器不存在或不属于当前场景');return false;}const evaluator=evVersionResolve(record,selection);if(!evaluator)return false;const normalized=evEvaluatorValidate(evaluator);
  const body=`<section class="ont-form-section"><h3>基本信息</h3><dl class="ont-mapping"><div><dt>编号</dt><dd>${esc(evaluator.id)}</dd></div><div><dt>名称</dt><dd>${esc(evaluator.name)}</dd></div><div><dt>版本 / 状态</dt><dd>${evVersionBadge(evaluator)} / ${evaluator.enabled?'已启用':'已停用'}</dd></div><div><dt>更新时间</dt><dd>${esc(evaluator.updatedAt)}</dd></div></dl><label class="ont-field"><span>评估器简介</span><textarea aria-label="评估器简介" readonly>${esc(evaluator.description)}</textarea></label></section><section class="ont-form-section"><h3>评分标准</h3><p class="muted">各评分项按 0～100 分评分，权重合计 1。总分为 Σ（评分项得分 × 权重）；所有评分项达到各自阈值时通过。</p><div class="ev-experiment-report">${evTable(['评分项','权重','通过阈值','评分标准'],normalized.criteria.map(c=>`<tr><td>${esc(c.name)}</td><td>${c.weight}</td><td>≥ ${c.passScore} 分</td><td>${esc(c.description)}</td></tr>`))}</div></section>${evVersionHistory(evaluator)}`;
  const actions=selection==='current'?`<button type="button" class="ont-button" onclick="evEditEvaluator('${id}')">编辑</button><button type="button" class="ont-button strong" onclick="evPublishEvaluator('${id}','${studio.scene}')">发布新版本</button>`:`<button type="button" class="ont-button" onclick="evVersionSelect('evaluator','${id}','current','${context}','${studio.scene}')">返回当前版本</button>`;
  evModal('查看离线评估器',body,actions,'',evVersionSwitcher('evaluator',record,selection,context));document.querySelector('.ev-modal')?.classList.add('ev-evaluator-detail');return true;
}
function evDeleteEvaluator(id){const evaluator=evEvaluatorStore().evaluators.find(e=>e.id===id);if(!evaluator)return;evModal('删除离线评估器',`<p>确定删除「${esc(evaluator.name)}」？</p><p class="muted">已保存的实验快照将保留。</p>`,`<button type="button" class="ont-button danger" onclick="evConfirmDeleteEvaluator('${id}','${studio.scene}')">删除</button>`);}
function evConfirmDeleteEvaluator(id,scene=studio.scene){if(scene!==studio.scene){toast('当前场景已变更，请重新操作');return false;}const store=evEvaluatorStore(scene),count=store.evaluators.length;store.evaluators=store.evaluators.filter(e=>e.id!==id);if(store.evaluators.length===count)return false;evCloseModal();evRender();toast('评估器已删除，已有实验快照保留');return true;}
