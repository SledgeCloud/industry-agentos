/* Shared project capability catalog — Workbench cards and AIOps references. */
window.WorkbenchAtomicCatalog = {
  agent: [
    {
      name: 'Supplier discovery assistant',
      role: 'From T1 sourcing strategy, generate search plans, run S0→P3 parallel search across 16+ public sources, aggregate and dedupe with L0–L3 tags for CS review.',
      model: 'qwen3.7-max', caps: ['Single agent', 'Autonomous planning'],
      status: 'Live', state: 'live', runs: '1.2k runs', color: '#0d8ae6', letter: 'S'
    },
    {
      name: 'Sourcing strategy assistant',
      role: 'Take parsed sourcing needs, blend category knowledge (materials, regions, cases, thresholds, channels), and draft structured strategy with keywords and exclusions.',
      model: 'deepseek-v4-pro', caps: ['Single agent', 'Autonomous planning'],
      status: 'Ready', state: 'ready', runs: '84 runs', color: '#6a54f0', letter: 'P'
    },
    {
      name: 'Supplier profile assistant',
      role: 'From CS-confirmed strategy and demand context, draft a 6-dimension target profile with weights (K5) and hard thresholds (K6).',
      model: 'qwen3.7-max', caps: ['Single agent', 'Workflow'],
      status: 'Draft', state: 'draft', runs: 'Not published', color: '#0f766e', letter: 'F'
    },
    {
      name: 'Supplier deep-research assistant',
      role: 'Enrich T2 candidates (~60% complete) via registry checks, multi-source collection, cross-validation, 6-dimension fusion and 4 risk labels to ≥85% completeness.',
      model: 'deepseek-v4-pro', caps: ['Multi-agent', 'Autonomous planning'],
      status: 'Live', state: 'live', runs: '320 runs', color: '#c2410c', letter: 'R'
    },
    {
      name: 'Task — long-list report',
      role: 'Final T4 screening step: format compliance → threshold → scored results into a structured long-list evaluation report for CS. Pure formatting, no ontology queries.',
      model: 'glm-5.3-flash', caps: ['Single agent', 'Workflow'],
      status: 'Ready', state: 'ready', runs: '12 runs', color: '#64748b', letter: 'T'
    },
    {
      name: 'Screening & long-list assistant',
      role: 'CS uploads a candidate list and demand ID; agent runs compliance → threshold screening, then the rule engine (R0→R2) builds the compliance pool and scoring.',
      model: 'qwen3.7-max', caps: ['Multi-agent', 'Workflow'],
      status: 'Draft', state: 'draft', runs: 'Not published', color: '#1d4ed8', letter: 'L'
    }
  ],
  knowledge: [
    { name: 'Product handbook', source: 'PDF', chunks: '128 chunks', sync: 'Synced 1h ago', ok: true },
    { name: 'Support playbooks', source: 'Notion', chunks: '64 chunks', sync: 'Synced 4h ago', ok: true },
    { name: 'Retail KPI glossary', source: 'Web', chunks: 'Indexing…', sync: 'Last crawl today', ok: false },
    { name: 'Vendor FAQ', source: 'Confluence', chunks: '42 chunks', sync: 'Synced yesterday', ok: true },
    { name: 'Battle cards', source: 'Drive', chunks: '31 chunks', sync: 'Synced 2d ago', ok: true },
    { name: 'SRE runbooks', source: 'Git', chunks: '89 chunks', sync: 'Synced 6h ago', ok: true },
    { name: 'Interview scorecards', source: 'Notion', chunks: '18 chunks', sync: 'Synced 3d ago', ok: true },
    { name: 'Policy & compliance', source: 'PDF', chunks: 'Index queued', sync: 'Waiting on upload', ok: false }
  ],
  ontology: [
    {
      name: 'Supplier discovery object set',
      desc: 'T2 supplier discovery — search strategy and CS confirmation chain for supplier candidates.',
      scenario: 'T2 Supplier discovery',
      author: 'ke wang', updated: '2026-07-30 13:40',
      status: 'Draft', statusKey: 'draft', versions: 2, theme: 'violet'
    },
    {
      name: 'Supplier deep-research object set',
      desc: 'T3 deep research on T2 candidates — multi-source collection, cross-check, and fusion into 6-dimension profiles with 4 risk labels.',
      scenario: 'T3 Supplier deep research',
      author: 'Feng Zhu', updated: '2026-06-21 19:06',
      status: 'Draft', statusKey: 'draft', versions: 2, theme: 'blue'
    },
    {
      name: 'Support ticket object set',
      desc: 'Shared support ontology — tickets, channels, intents, escalation paths, and knowledge links for triage and resolution.',
      scenario: 'Customer support operations',
      author: 'ke wang', updated: '2026-08-12 10:22',
      status: 'Published', statusKey: 'published', versions: 4, theme: 'slate'
    },
    {
      name: 'Retail allocation object set',
      desc: 'Store allocation ontology — demand signals, inventory snapshots, allocation rules, and override decisions.',
      scenario: 'Rule-based allocation',
      author: 'Lin Chen', updated: '2026-09-18 16:45',
      status: 'Draft', statusKey: 'draft', versions: 3, theme: 'blue'
    },
    {
      name: 'Incident response object set',
      desc: 'Operational incident ontology — alerts, services, impact levels, responders, and remediation actions.',
      scenario: 'Alert intake',
      author: 'Alex Wu', updated: '2026-10-06 09:30',
      status: 'Published', statusKey: 'published', versions: 5, theme: 'violet'
    }
  ],
  mcp: [
    {
      name: 'Ontology Action Executor', letter: 'O', color: '#6366f1', tag: 'ontology',
      updated: '2026-10-09 18:56',
      desc: 'Discover and run published ontology actions for the current object set. Agents must plan the sequence, analyze business impact, and wait for user confirmation before execution.'
    },
    {
      name: 'Builtin-OSS', letter: 'O', color: '#0f766e', tag: 'ontology',
      updated: '2026-08-28 15:08',
      desc: 'Built-in Alibaba Cloud OSS pre-signed URL tools (reuses mcp.proxy.minio config; AK/SK are server-side only). Supports oss_presign_get and upload pre-sign.'
    },
    {
      name: 'Ontology Rules Actions', letter: 'R', color: '#1d4ed8', tag: 'ontology',
      updated: '2026-07-23 14:47',
      desc: 'Ontology execution engine — rules and action configuration query endpoints'
    },
    {
      name: 'Ontology Execution Logs', letter: 'L', color: '#64748b', tag: 'ontology',
      updated: '2026-07-23 14:47',
      desc: 'Ontology execution engine log query'
    },
    {
      name: 'MinIO', letter: 'M', color: '#c2410c', tag: 'minio',
      updated: '2026-05-18 02:54',
      desc: 'Built-in object storage (legacy Builtin-MinIO; switch MinIO or Azure Blob via mcp.proxy.object-storage.provider). Agents use server-side refs without exposing credentials.'
    },
    {
      name: 'Ontology Graph Operator', letter: 'G', color: '#7c3aed', tag: 'ontology',
      updated: '2026-07-29 20:00',
      desc: 'Object set retrieval, object instance retrieval, object relationship graph query, L3 debug simulate-event and sandbox cleanup'
    }
  ]
};
