/* Small host contract for the shared workshop evaluation modules.
   The workshop entry and its implementation remain independent and unchanged. */
'use strict';
const studio = {scene: 'sales', panels: {gui: true, chat: false}, weights: {gui: 100}};
const studioSceneData = {sales: {name: '销售'}, procurement: {name: '采购'}};
const waCatalog = {
  sales: [{id: 'sales-agent-1', name: '销售智能分货助手'}],
  procurement: [{id: 'procurement-agent-1', name: '采购协同助手'}]
};
const assetMcps = [
  {name:'Sales Demand Reader',agent:'sales',description:'读取经销商需求与销售订单，为销售 Agent 提供需求汇总和明细查询。',version:'V2.0',tags:['sales','data-reader']},
  {name:'Inventory Query',agent:'sales',description:'查询商品库存、可供给量与在途信息，支持销售分货的供给盘点。',version:'V1.2',tags:['sales','inventory']},
  {name:'Allocation Calculator',agent:'sales',description:'根据需求、供给与分货规则计算分配草案，返回明细和约束校验结果。',version:'V2.0',tags:['sales','allocation']},
  {name:'Supplier Catalog',agent:'procurement',description:'查询候选供应商、资质与供货范围，支持采购寻源与供应商评估。',version:'V1.0',tags:['procurement','supplier']},
  {name:'Purchase Order Reader',agent:'procurement',description:'读取采购需求和采购订单，返回物料、数量、交期与执行状态。',version:'V1.2',tags:['procurement','data-reader']},
  {name:'Supplier Performance',agent:'procurement',description:'汇总供应商交付、质量和成本数据，为采购份额分析提供绩效依据。',version:'V1.0',tags:['procurement','performance']},
  {name:'Ontology Action Executor',agent:'shared',description:'为销售和采购 Agent 提供本体动作模拟入口，展示参数校验与业务确认状态。',version:'V3.0',tags:['sales','procurement','ontology']},
  {name:'Document Processor',agent:'shared',description:'解析销售需求与采购资料，提取表格字段和文档内容，供两个 Agent 分析使用。',version:'V2.0',tags:['sales','procurement','document']}
];
function wiObjects() { return [{id: studio.scene+'-ontology', name: studioSceneData[studio.scene].name+'业务本体'}]; }
function esc(value) { return String(value ?? '').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;').replace(/'/g,'&#39;'); }
function toast(message) { window.AIOpsEvaluation?.toast(message); }
function wtChips(values) { return values.map(value=>`<span class="wt-chip">${esc(value)}</span>`).join(' '); }
function wtModal(title, body, footer='', formCode='') {
  document.getElementById('overlay').innerHTML=`<div class="backdrop wt-backdrop" onclick="if(event.target===this)dismiss()"><section class="wt-modal" role="dialog" aria-modal="true" aria-label="${esc(title)}"><header><b>${esc(title)}</b><button type="button" aria-label="关闭" onclick="dismiss()">×</button></header><form id="wt-form" onsubmit="event.preventDefault();${formCode}"><div class="wt-modal-body">${body}</div><footer><button type="button" onclick="dismiss()">取消</button>${footer||'<button type="button" class="wt-dark" onclick="dismiss()">确定</button>'}</footer></form></section></div>`;
}
function dismiss() { document.getElementById('overlay').innerHTML=''; }
function render() { window.AIOpsApp?.refresh(); }
// Shared modules wrap the workshop routing functions when loaded. Native routes
// use AIOpsEvaluation below; these hooks only supply that loading contract.
const workbenchPages=['测试'], waState={}, woState={}, wtState={open: false};
let currentSection='';
function workbenchHeader() { return ''; }
function workbenchData() { return {active:'评测'}; }
function workbenchRegister() {}
function workbenchOpen() {}
function studioGui() { return ''; }
function studioChat() { return ''; }
function sendStudioMessage() {}
let openWorkshopTests, wtScreen;
