/**
 * File-type icons — Seti / VS Code–adjacent style
 * Reference: sales_allocation_agent tree (csv teal grid · py snakes · md green M↓ · sh $_ )
 * Exposes: window.FileTypeIcons = { svg(type), forName(name), types }
 */
(function () {
  'use strict';

  /* 16×16 · self-colored · readable at 14–16px */
  var ICONS = {
    /* Teal document + white table grid (csv / xls / xlsx) */
    csv:
      '<svg viewBox="0 0 16 16" fill="none" aria-hidden="true">' +
      '<rect x="2.4" y="1.6" width="11.2" height="12.8" rx="1.6" fill="#3ecfcd"/>' +
      '<path d="M4.4 4.3h7.2M4.4 6.9h7.2M4.4 9.5h7.2M4.4 12.1h7.2M6.7 4.3v7.8M9.3 4.3v7.8" stroke="#fff" stroke-width="1.05" stroke-linecap="round"/>' +
      '</svg>',
    xls:
      '<svg viewBox="0 0 16 16" fill="none" aria-hidden="true">' +
      '<rect x="2.4" y="1.6" width="11.2" height="12.8" rx="1.6" fill="#39b7bc"/>' +
      '<path d="M4.4 4.3h7.2M4.4 6.9h7.2M4.4 9.5h7.2M4.4 12.1h7.2M6.7 4.3v7.8M9.3 4.3v7.8" stroke="#fff" stroke-width="1.05" stroke-linecap="round"/>' +
      '</svg>',

    /* Python logo — blue / yellow interlocking */
    py:
      '<svg viewBox="0 0 16 16" fill="none" aria-hidden="true">' +
      '<path d="M7.95 1.4c-2.05 0-1.92 0.9-1.92 0.9l.02 0.93h1.96v.28H4.55S2.4 3.35 2.4 6.05c0 2.7 1.72 2.6 1.72 2.6h1.03V7.5s-.05-1.55 1.52-1.55h2.62s1.47.02 1.47-1.42V2.85S11.52 1.4 7.95 1.4Zm-.95 1.55a.7.7 0 1 1 0 1.4.7.7 0 0 1 0-1.4Z" fill="#3776ab"/>' +
      '<path d="M8.05 14.6c2.05 0 1.92-.9 1.92-.9l-.02-.93H7.99v-.28h3.46s2.15.16 2.15-2.54c0-2.7-1.72-2.6-1.72-2.6H10.85v1.15s.05 1.55-1.52 1.55H6.71s-1.47-.02-1.47 1.42v1.68S4.48 14.6 8.05 14.6Zm.95-1.55a.7.7 0 1 1 0-1.4.7.7 0 0 1 0 1.4Z" fill="#ffd343"/>' +
      '</svg>',

    /* Markdown — green face + white M↓ */
    md:
      '<svg viewBox="0 0 16 16" fill="none" aria-hidden="true">' +
      '<rect x="1.4" y="2.6" width="13.2" height="10.8" rx="2" fill="#66bb6a"/>' +
      '<path d="M3.6 5.1v5.8h1.55V7.55l1.35 2.35h.9L8.75 7.55V10.9h1.55V5.1H8.55L7.15 7.7 5.75 5.1H3.6Z" fill="#fff"/>' +
      '<path d="M11.05 5.9v2.55h-1.05l1.7 2.45 1.7-2.45h-1.05V5.9h-1.3Z" fill="#fff"/>' +
      '</svg>',

    /* Shell — soft green pill + $_ */
    sh:
      '<svg viewBox="0 0 16 16" fill="none" aria-hidden="true">' +
      '<rect x="1.2" y="2.8" width="13.6" height="10.4" rx="5.2" fill="#9ccc65"/>' +
      '<path d="M4.6 6.1 6.35 8 4.6 9.9" stroke="#fff" stroke-width="1.35" stroke-linecap="round" stroke-linejoin="round"/>' +
      '<path d="M7.7 10.2h3.7" stroke="#fff" stroke-width="1.35" stroke-linecap="round"/>' +
      '</svg>',

    /* JSON — mustard braces */
    json:
      '<svg viewBox="0 0 16 16" fill="none" aria-hidden="true">' +
      '<rect x="1.5" y="1.5" width="13" height="13" rx="3" fill="#cbcb41"/>' +
      '<path d="M6.1 4.4c-.85 0-1.35.55-1.35 1.35v1.05c0 .45-.2.7-.7.85.5.15.7.4.7.85v1.05c0 .8.5 1.35 1.35 1.35" stroke="#333" stroke-width="1.25" stroke-linecap="round"/>' +
      '<path d="M9.9 4.4c.85 0 1.35.55 1.35 1.35v1.05c0 .45.2.7.7.85-.5.15-.7.4-.7.85v1.05c0 .8-.5 1.35-1.35 1.35" stroke="#333" stroke-width="1.25" stroke-linecap="round"/>' +
      '</svg>',

    /* HTML — orange brackets */
    html:
      '<svg viewBox="0 0 16 16" fill="none" aria-hidden="true">' +
      '<rect x="1.5" y="1.5" width="13" height="13" rx="3" fill="#e67a2e"/>' +
      '<path d="M5.5 5.1 3.4 8l2.1 2.9M10.5 5.1 12.6 8l-2.1 2.9" stroke="#fff" stroke-width="1.45" stroke-linecap="round" stroke-linejoin="round"/>' +
      '</svg>',

    /* Word / doc — blue A */
    doc:
      '<svg viewBox="0 0 16 16" fill="none" aria-hidden="true">' +
      '<rect x="1.5" y="1.5" width="13" height="13" rx="3" fill="#2f6fed"/>' +
      '<path d="M5.05 11.2 7.2 4.7h1.6l2.15 6.5H9.55l-.4-1.3H6.85l-.4 1.3H5.05Zm2-2.45h1.7L8 6.15h-.1l-.1 2.6Z" fill="#fff"/>' +
      '</svg>',

    /* PPT — deep orange P */
    ppt:
      '<svg viewBox="0 0 16 16" fill="none" aria-hidden="true">' +
      '<rect x="1.5" y="1.5" width="13" height="13" rx="3" fill="#c45c2a"/>' +
      '<path d="M5.2 11.3V4.7h2.85c1.45 0 2.4.85 2.4 2.15 0 1.25-.9 2.1-2.3 2.1H6.45v2.35H5.2Zm1.25-3.5h1.35c.7 0 1.1-.38 1.1-1s-.4-1-1.1-1H6.45v2Z" fill="#fff"/>' +
      '</svg>',

    /* Image — violet landscape */
    img:
      '<svg viewBox="0 0 16 16" fill="none" aria-hidden="true">' +
      '<rect x="1.5" y="1.5" width="13" height="13" rx="3" fill="#a78bfa"/>' +
      '<path d="M3.5 11.2 6 7.9l1.55 1.85 2.15-2.85 2.8 4.3H3.5Z" fill="#fff" fill-opacity=".95"/>' +
      '<circle cx="5.45" cy="5.35" r="1.1" fill="#fff"/>' +
      '</svg>',

    /* Plain text */
    txt:
      '<svg viewBox="0 0 16 16" fill="none" aria-hidden="true">' +
      '<rect x="2" y="1.6" width="12" height="12.8" rx="1.8" fill="#f0f1f4" stroke="#d5d8df"/>' +
      '<path d="M4.6 5h6.8M4.6 8h6.8M4.6 11h4.4" stroke="#7b8494" stroke-width="1.35" stroke-linecap="round"/>' +
      '</svg>',

    /* Generic file */
    file:
      '<svg viewBox="0 0 16 16" fill="none" aria-hidden="true">' +
      '<path d="M4.2 1.8h5.1L12 4.6v9.2a.8.8 0 0 1-.8.8H4.2a.8.8 0 0 1-.8-.8V2.6a.8.8 0 0 1 .8-.8Z" fill="#e8eaef" stroke="#b0b6c0" stroke-width="1"/>' +
      '<path d="M9.2 1.8v2.9H12" stroke="#b0b6c0" stroke-width="1" stroke-linejoin="round"/>' +
      '</svg>',

    /* Agent demo — Seti tile shaped after #ws-agent (nav asset) */
    agent:
      '<svg viewBox="0 0 16 16" fill="none" aria-hidden="true">' +
      '<rect x="1.5" y="1.5" width="13" height="13" rx="3" fill="#5b7cfa"/>' +
      '<rect x="3.6" y="6.4" width="8.8" height="5.8" rx="1.7" fill="#fff"/>' +
      '<path d="M8 6.4V4.6" stroke="#fff" stroke-width="1.25" stroke-linecap="round"/>' +
      '<circle cx="8" cy="4" r="0.85" fill="#fff"/>' +
      '<path d="M6.15 9.1v1M9.85 9.1v1" stroke="#5b7cfa" stroke-width="1.25" stroke-linecap="round"/>' +
      '</svg>',
  };

  /* aliases */
  ICONS.xlsx = ICONS.xls;
  ICONS.csv = ICONS.csv;
  ICONS.markdown = ICONS.md;
  ICONS.js = ICONS.json; /* placeholder if needed — prefer distinct later */
  ICONS.ts = ICONS.json;
  ICONS.bash = ICONS.sh;
  ICONS.zsh = ICONS.sh;

  function extOf(name) {
    var i = String(name).lastIndexOf('.');
    return i >= 0 ? String(name).slice(i + 1).toLowerCase() : '';
  }

  var figmaIconBase = new URL('../assets/figma-icons/', document.currentScript.src).href;
  var figmaTypes={file:'asset',agent:'asset',xls:'excel',csv:'csv',md:'md',pdf:'pdf',doc:'word',ppt:'ppt',txt:'txt',json:'json',xml:'xml',html:'html',py:'code',sh:'code',code:'code',img:'image',video:'video',audio:'audio',zip:'zip','enterprise-documents':'documents','enterprise-landscape':'landscape','enterprise-planning':'planning','enterprise-canvas':'canvas'};
  Object.keys(figmaTypes).forEach(function(type){ICONS[type]='<img src="'+figmaIconBase+'file-'+figmaTypes[type]+'.svg" width="16" height="16" alt="" />';});

  function typeOf(name) {
    var raw = String(name || '');
    var enterpriseName=raw.replace(/\.[^.]+$/, '').toLowerCase();
    if(enterpriseName==='enterprise documents')return 'enterprise-documents';
    if(enterpriseName==='business landscape')return 'enterprise-landscape';
    if(enterpriseName==='scenario planning')return 'enterprise-planning';
    var base = raw.replace(/\.[^.]+$/, '');
    var compact = base.replace(/\s+/g, '');
    /* Agent / 机器人 — Agent demo · Agent v3 · Agentv4 · *.agent */
    if (/^agent(\s*demo)?$/i.test(base) ||
        /^agent\s*v?\d+$/i.test(base) ||
        /^agentv\d+$/i.test(compact) ||
        /\.agent$/i.test(raw)) {
      return 'agent';
    }
    var e = extOf(name);
    if(/scenario definition canvas/i.test(base))return 'enterprise-canvas';
    if(e==='pdf')return 'pdf';
    if(e==='xml')return 'xml';
    if(/^(zip|tar|gz|rar|7z)$/.test(e))return 'zip';
    if(/^(mp4|mov|webm)$/.test(e))return 'video';
    if(/^(mp3|wav|m4a|ogg)$/.test(e))return 'audio';
    if (e === 'csv') return 'csv';
    if (e === 'xlsx' || e === 'xls') return 'xls';
    if (e === 'py') return 'py';
    if (e === 'md' || e === 'markdown') return 'md';
    if (e === 'sh' || e === 'bash' || e === 'zsh' || e === 'command') return 'sh';
    if (e === 'json') return 'json';
    if (e === 'html' || e === 'htm') return 'html';
    if (e === 'docx' || e === 'doc') return 'doc';
    if (e === 'pptx' || e === 'ppt') return 'ppt';
    if (e === 'png' || e === 'jpg' || e === 'jpeg' || e === 'gif' || e === 'webp' || e === 'svg') return 'img';
    if (e === 'txt' || e === 'log') return 'txt';
    if (e === 'agent') return 'agent';
    /* Extensionless journey deliverables → green MD tile (画布 / 方案 / Skill / 对象集 …) */
    if (!e && base &&
        /(画布|方案设计|原型设计|规则方案|测试用例|^Skill|^技能|知识库|对象集|架构方案|本体方案|^MCP)/i.test(base)) {
      return 'md';
    }
    return 'file';
  }

  function svg(type) {
    return ICONS[type] || ICONS.file;
  }

  function forName(name) {
    return svg(typeOf(name));
  }

  /** Wrapped span for tree / body lists */
  function markup(name, size) {
    size = size || 16;
    var type = typeOf(name);
    return (
      '<span class="ft-type-icon ft-type-icon--' + type + '" style="width:' + size + 'px;height:' + size + 'px" aria-hidden="true">' +
      svg(type) +
      '</span>'
    );
  }

  window.FileTypeIcons = {
    icons: ICONS,
    types: Object.keys(ICONS),
    extOf: extOf,
    typeOf: typeOf,
    svg: svg,
    forName: forName,
    markup: markup,
  };
})();
