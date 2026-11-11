/* Shared identity and two independent administration destinations, all local Mock. */
(() => {
  const KEY = 'agentos-enterprise-demo-v1';
  const memory = {};
  const store = {
    get(name, fallback) { try { return JSON.parse(sessionStorage.getItem(KEY + ':' + name)) ?? fallback; } catch { return memory[name] ?? fallback; } },
    set(name, value) { memory[name] = value; try { sessionStorage.setItem(KEY + ':' + name, JSON.stringify(value)); } catch {} }
  };
  let menu = null, trigger = null, administration = null;
  let savedOverflow = '', inertElements = [], returnFocus = null;
  function close(focus = false) {
    menu?.remove(); menu = null;
    trigger?.setAttribute('aria-expanded', 'false');
    if (focus) trigger?.focus();
  }
  function captureWorkshop() {
    // Only a local snapshot is passed to administration; the workshop remains the authoring surface.
    if (typeof wiAllAgents !== 'function' || typeof wiAllObjects !== 'function') return;
    try {
      const objects = wiAllObjects();
      const catalog = wiAllAgents().map(a => ({id: 'workshop-' + a.id, name: a.name,
        groups: [
          {id:'ontology', name:'本体', items: objects.filter(o => o.scene === a.scene).map((o,i) => {
            const data = typeof ontStores !== 'undefined' && ontStores[a.scene+':'+o.id];
            const rows = data?.objects || (typeof woCatalog !== 'undefined' ? woCatalog[a.scene]?.objects : []) || [];
            return {id:'objectset-'+(o.id||i), name:o.name, objects:rows.map((row,index)=>typeof row==='string'?{id:'obj-'+index,name:row,description:row+'业务对象。'}:{id:row.id,name:row.name,description:row.description||row.name+'业务对象。'})};
          })},
          {id:'skill', name:'技能（Skill）', items:assetSkills.filter(s=>s.agent===a.scene||s.agent==='shared').map((s,i)=>({id:'skill-'+i,name:s.name}))},
          {id:'mcp', name:'工具（MCP）', items:assetMcps.filter(s=>s.agent===a.scene||s.agent==='shared').map((s,i)=>({id:'mcp-'+i,name:s.name}))},
          {id:'knowledge', name:'知识库', items:(typeof kbScenes!=='undefined'&&kbScenes[a.scene]?.libraries||[]).map((s,i)=>({id:'kb-'+(s.id||i),name:s.name}))}
        ].filter(g=>g.items.length)}));
      store.set('workshop', catalog);
    } catch (e) { console.warn('Mock 资产快照未更新', e.message); }
  }
  function destination(file) {
    const current = location.pathname.split('/').pop();
    const params = new URLSearchParams(location.search);
    const fromApp = ['index.html','new-aiops.html'].includes(current);
    const from = fromApp ? current : params.get('from');
    const depth = Number(params.get('returnDepth'));
    const returnDepth = fromApp ? 1 : Number.isInteger(depth) && depth > 0 && depth < 100 ? depth + 1 : 0;
    return file + '?from=' + (from === 'new-aiops.html' ? from : 'index.html') + (returnDepth?'&returnDepth='+returnDepth:'');
  }
  function openAdministration(url) {
    // A separate document keeps both administration surfaces isolated and preserves live Ops/workshop drafts.
    close(); returnFocus=trigger; savedOverflow=document.body.style.overflow;
    inertElements=[...document.body.children].map(el=>[el,el.inert]);
    inertElements.forEach(([el])=>el.inert=true);
    document.body.style.overflow='hidden';
    administration=document.createElement('iframe');
    administration.title='企业管理';administration.className='ep-administration';
    administration.src=url;document.body.append(administration);administration.focus();
  }
  function closeAdministration() {
    administration?.remove();administration=null;
    document.body.style.overflow=savedOverflow;
    inertElements.forEach(([el,wasInert])=>el.inert=wasInert);inertElements=[];
    returnFocus?.isConnected&&returnFocus.focus();
  }
  function open(button) {
    if (menu && trigger === button) { close(); return; }
    close(); trigger = button; captureWorkshop();
    button.setAttribute('aria-expanded','true');
    menu = document.createElement('div'); menu.className = 'ep-menu'; menu.setAttribute('role','menu'); menu.setAttribute('aria-label','用户菜单');
    menu.innerHTML = `<div class="ep-identity"><span class="ep-avatar">F</span><div>Feng Zhu<small>feng.zhu@inspiregroup.com</small></div></div><a role="menuitem" href="${destination('enterprise-space.html')}"><svg viewBox="0 0 24 24"><rect x="4" y="4" width="16" height="16" rx="2"/><path d="M4 9h16M9 9v11"/></svg>企业空间</a><a role="menuitem" href="${destination('enterprise-organization.html')}"><svg viewBox="0 0 24 24"><path d="m12 3 9 5v9l-9 5-9-5V8zM3 8l9 5 9-5M12 13v9"/></svg>企业组织运营</a>`;
    document.body.append(menu);
    if (!document.body.dataset.enterprisePage) menu.querySelectorAll('a').forEach(a=>a.addEventListener('click',e=>{
      e.preventDefault();openAdministration(a.getAttribute('href'));
    }));
    const rect = button.getBoundingClientRect();
    menu.style.top = Math.min(rect.bottom + 7, innerHeight - 185) + 'px';
    menu.style.left = Math.max(8, Math.min(rect.right - 218, innerWidth - 226)) + 'px';
  }
  function mount() {
    document.querySelectorAll('[data-enterprise-profile]:not([data-profile-ready])').forEach(el => {
      el.dataset.profileReady = 'true';
      el.innerHTML = '<button class="ep-trigger" type="button" aria-label="Feng Zhu 用户菜单" aria-haspopup="menu" aria-expanded="false"><span class="ep-avatar">F</span><span>Feng Zhu</span><svg class="ep-chevron" viewBox="0 0 12 12"><path d="m3 4 3 3 3-3"/></svg></button>';
      el.querySelector('button').addEventListener('click', e => {e.stopPropagation();open(e.currentTarget)});
      el.querySelector('button').addEventListener('keydown', e => {if(e.key==='ArrowDown'){e.preventDefault();open(e.currentTarget);menu?.querySelector('a')?.focus()}});
    });
  }
  window.EnterpriseProfile = {store, mount, close, captureWorkshop, closeAdministration};
  document.addEventListener('click', e => {if(!e.target.closest('.ep-menu'))close()});
  document.addEventListener('keydown', e => {
    if (!menu) return;
    if (e.key === 'Escape') {e.preventDefault();close(true)}
    if (['ArrowDown','ArrowUp'].includes(e.key)) {
      e.preventDefault();const links=[...menu.querySelectorAll('a')];const i=links.indexOf(document.activeElement);
      links[(i+(e.key==='ArrowDown'?1:-1)+links.length)%links.length].focus();
    }
    if (e.key==='Tab') close();
  });
  window.addEventListener('resize',()=>close());
  mount();new MutationObserver(mount).observe(document.body,{childList:true,subtree:true});
})();
