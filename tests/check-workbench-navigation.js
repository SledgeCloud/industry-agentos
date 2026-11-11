const fs=require('fs'),vm=require('vm'),assert=require('assert'),nodes={};
const sandbox={document:{getElementById:id=>nodes[id]||(nodes[id]={innerHTML:''}),querySelectorAll:()=>[],addEventListener(){}},setTimeout(){},clearTimeout(){},console};
vm.createContext(sandbox);
// Knowledge management lives in a second inline script, as it does in the browser.
for(const match of fs.readFileSync('dist/index.html','utf8').matchAll(/<script>([\s\S]*?)<\/script>/g))vm.runInContext(match[1],sandbox);
const run=code=>vm.runInContext(code,sandbox);
run("studio.scene='sales';workshopHome()");assert(!run('studioGui().includes("<details")'));
assert(run('workbenchPages.every(name=>studioGui().includes("workbenchOpen(\x27"+name+"\x27)"))'));
for(const name of ['本体','智能体','测试','技能','MCP','数据源','知识库','打造场景']){
 run(`workbenchOpen('${name}')`);assert.equal(run('workbenchData().active'),name);
 assert(run(`studioGui().includes('关闭${name}页签')`));
 const before=run('JSON.stringify(workbenchData().tabs)');run('workshopHome()');assert.equal(run('JSON.stringify(workbenchData().tabs)'),before);assert.equal(run('workbenchData().active'),null);assert(run('studioGui().includes("使用指南")'));assert.equal(nodes.overlay.innerHTML,'');
 run(`workbenchOpen('${name}')`);assert.equal(run(`workbenchData().tabs.filter(t=>t==='${name}').length`),1);
}
assert.equal(run('workbenchData().tabs.length'),8);
run("workbenchOpen('测试');wtTab('评估器');workshopHome();workbenchOpen('测试')");assert.equal(run('wtState.tab'),'评估器');
run("workbenchOpen('本体');woTab('关系');workshopHome();workbenchOpen('本体')");assert.equal(run('woState.tab'),'关系');
for(const name of ['技能','MCP','数据源','打造场景']){
 run(`workbenchOpen('${name}')`);assert(run('studioGui().includes("wb-resource-cards")'));assert(run('workbenchResources(workbenchData().active).length>0'));
 run(`workbenchResourceDetail('${name}',0)`);const expected=run(`workbenchResources('${name}')[0].name`);assert(run('studioGui()').includes(expected));assert(run('studioGui().includes("wb-resource-detail")'));
 run(`workshopHome();workbenchOpen('${name}')`);assert(run('studioGui().includes("wb-resource-detail")'));assert.equal(nodes.overlay.innerHTML,'');
 for(const m of run('studioGui()').matchAll(/(?:onclick|onchange|onsubmit|oninput)="([^"]*)"/g))new Function(m[1].replace(/&quot;/g,'"').replace(/&#39;/g,"'").replace(/&amp;/g,'&'));
}
// Knowledge libraries have their own list/detail UI rather than generic resource cards.
run("workbenchOpen('知识库')");assert(run('studioGui().includes("kb-screen")'));assert(run('studioGui().includes("kb-card")'));
const libraryId=run('kbData().libraries[0].id'),libraryName=run('kbData().libraries[0].name');
run(`kbOpen('${libraryId}')`);assert(run('studioGui()').includes(libraryName));assert(run('studioGui().includes("原始文件")'));
run("workshopHome();workbenchOpen('知识库')");assert.equal(run('kbData().detail'),libraryId);assert.equal(nodes.overlay.innerHTML,'');
run("workshopHome();workbenchClose('技能')");assert.equal(run('workbenchData().active'),null);assert(!run('workbenchData().tabs.includes("技能")'));assert.equal(run('workbenchData().tabs.length'),7);
run("workbenchOpen('数据源');workbenchClose('数据源')");assert.equal(run('workbenchData().active'),'打造场景');assert(!run('workbenchData().tabs.includes("数据源")'));
const saleTabs=run('JSON.stringify(workbenchData().tabs)');run("studio.selection='procurement';enterStudioScene()");assert.equal(run('workbenchData().tabs.length'),0);assert(run('studioGui().includes("使用指南")'));
run("workbenchOpen('技能')");assert(run('studioGui().includes("采购份额优化")'));assert(!run('studioGui().includes("销售分货方案分析")'));
run("studio.selection='sales';enterStudioScene()");assert.equal(run('JSON.stringify(workbenchData().tabs)'),saleTabs);assert.equal(run('workbenchData().active'),'打造场景');
run('workbenchData().tabs.slice().forEach(workbenchClose)');assert.equal(run('workbenchData().tabs.length'),0);assert(run('studioGui().includes("使用指南")'));
console.log('Passed: eight page entries without accordions, retained tabs/subpage state, no duplicate tabs, inline resource details, individual/active/last tab close, and scene isolation.');
