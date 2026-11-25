#!/usr/bin/env node
// Builds docs/workflow.svg, the diagram shown at the top of the README.
//   node docs/build-workflow-diagram.mjs
// Edit the data below and run it again; do not edit the SVG by hand.

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const W = 1420;
const H = 1290;
const out = [];
const esc = (s) => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

const rect = (x, y, w, h, cls, rx = 10) => out.push(`<rect x="${x}" y="${y}" width="${w}" height="${h}" rx="${rx}" class="${cls}"/>`);
const text = (x, y, lines, cls, anchor = 'middle', lh = 14) => {
  const ls = [].concat(lines);
  out.push(`<text x="${x}" y="${y}" class="${cls}" text-anchor="${anchor}">${ls.map((l, i) => `<tspan x="${x}" dy="${i ? lh : 0}">${esc(l)}</tspan>`).join('')}</text>`);
};
const line = (d, cls, marker) => out.push(`<path d="${d}" class="${cls}"${marker ? ` marker-end="url(#${marker})"` : ''}/>`);

// Columns: one per step of the workflow.
const X0 = 160;
const CW = 134;
const bx = (i) => X0 + CW * i + 6;
const cx = (i) => X0 + CW * i + CW / 2;
const BW = CW - 12;
const edge = (i) => X0 + CW * i; // boundary before column i

const STEPS = [
  { n: '1', title: 'Understand', sub: 'the requirement', dev: null, docs: ['00-ticket.md', '01-understanding.md'] },
  { n: '2', title: 'Functional', sub: 'questions', dev: ['answers the', 'business questions'], docs: ['02-functional-', 'questions.md'] },
  { n: '3', title: 'Technical plan', sub: 'decision by decision', dev: ['picks each option', 'test-first or not?'], docs: ['03-technical-', 'plan.md', '+ ADR if needed'] },
  { n: '4-5', title: 'Orchestrate', sub: 'tasks and owners', dev: ['reads the plan'], docs: ['04-implementation-', 'plan.md', '04-tasks.json'] },
  { n: '6', title: 'Implement', sub: 'parallel agents', dev: ['can stop between', 'groups of tasks'], docs: ['code + tests', '06-log/<task>.md'] },
  { n: '7', title: 'Quality gates', sub: 'tests · coverage', dev: null, docs: ['07-quality-', 'report.md'] },
  { n: '8', title: 'Final review', sub: 'rules, docs, team', dev: null, docs: ['08-review.md', 'docs/functional/'] },
  { n: '9', title: 'Human review', sub: 'pull request', dev: ['reviews the', 'pull request'], docs: ['pull request'] },
  { n: '10', title: 'Retro', sub: 'what did we learn?', dev: ['validates what', 'the project keeps'], docs: ['10-retro.md'] },
];

const LANES = [
  { key: 'dev', y: 120, h: 150, label: ['Developer', 'decides'] },
  { key: 'main', y: 280, h: 144, label: ['Main session', 'one skill per step'] },
  { key: 'agent', y: 434, h: 130, label: ['Agents', 'isolated context'] },
  { key: 'doc', y: 574, h: 96, label: ['Documents', 'docs/tickets/<ID>/'] },
  { key: 'hook', y: 680, h: 110, label: ['Plugin hooks', 'enforce, not ask'] },
];
const lane = Object.fromEntries(LANES.map((l) => [l.key, l]));

// ---------------------------------------------------------------------------------------------
// Header
// ---------------------------------------------------------------------------------------------
rect(0, 0, W, H, 'bg', 18);
text(24, 50, 'Spring agentic workflow', 'h1', 'start');
text(24, 78, 'From ticket to merge on a Java / Spring project. AI agents analyse, plan, implement and review; the developer decides at four gates,', 'lead', 'start');
text(24, 96, 'the plugin’s hooks hold everyone to it, and every ticket teaches the project’s own knowledge base.', 'lead', 'start');
rect(W - 24 - 64, 30, 64, 24, 'tag', 12);
text(W - 24 - 32, 46, 'v0.3.0', 'tagtext');

// ---------------------------------------------------------------------------------------------
// Lanes
// ---------------------------------------------------------------------------------------------
for (const l of LANES) {
  rect(24, l.y, 122, l.h, `lab lab-${l.key}`, 12);
  text(85, l.y + l.h / 2 - 4, l.label[0], `labt t-${l.key}`);
  text(85, l.y + l.h / 2 + 13, l.label[1], 'labs');
  rect(X0, l.y, CW * 9 + 6, l.h, `lane lane-${l.key}`, 12);
}

// Gates: only the developer passes them.
const GATES = [
  { at: edge(2), name: 'functional' },
  { at: edge(3), name: 'technical' },
  { at: edge(4), name: 'go' },
  { at: edge(8), name: 'merge' },
];
for (const g of GATES) line(`M${g.at} 252 V${lane.doc.y + lane.doc.h - 6}`, 'gateline');

// ---------------------------------------------------------------------------------------------
// Developer lane
// ---------------------------------------------------------------------------------------------
// Fast path bracket
line(`M${edge(1) + 8} 170 V156 H${edge(4) - 8} V170`, 'fast', 'a-gate');
text((edge(1) + edge(4)) / 2, 146, 'Small ticket:  /approve fast  — one page (02-fast-plan.md) stands for these three gates', 'fasttext');

rect(cx(0) - 50, 208, 100, 42, 'start', 21);
text(cx(0), 226, '/ticket', 'gatecmd');
text(cx(0), 241, 'PET-123', 'gatename');

STEPS.forEach((s, i) => {
  if (s.dev) text(cx(i), s.dev.length === 1 ? 190 : 183, s.dev, 'devnote', 'middle', 13);
});
for (const g of GATES) {
  rect(g.at - 50, 208, 100, 42, 'gate', 21);
  text(g.at, 226, '/approve', 'gatecmd');
  text(g.at, 241, g.name, 'gatename');
}

// ---------------------------------------------------------------------------------------------
// Main session lane
// ---------------------------------------------------------------------------------------------
line(`M${bx(0)} 354 H${bx(8) + BW}`, 'flow');
STEPS.forEach((s, i) => {
  rect(bx(i), 322, BW, 64, 'step', 10);
  rect(bx(i) + 8, 314, s.n.length > 1 ? 34 : 22, 18, 'num', 9);
  text(bx(i) + 8 + (s.n.length > 1 ? 17 : 11), 327, s.n, 'numt');
  text(cx(i), 352, s.title, 'steptitle');
  text(cx(i), 369, s.sub, 'stepsub');
});
// Loops back
line(`M${cx(5)} 322 C${cx(5)} 300, ${cx(4) + 30} 300, ${cx(4) + 30} 319`, 'loop', 'a-loop');
text((cx(5) + cx(4) + 30) / 2, 299, 'red: fix, run again', 'looptext');
line(`M${cx(7) - 20} 386 C${cx(7) - 20} 412, ${cx(4) + 36} 412, ${cx(4) + 36} 389`, 'loop', 'a-loop');
text((cx(7) + cx(4)) / 2 + 8, 419, 'changes requested: back to step 6, then 7 and 8 again', 'looptext');

// ---------------------------------------------------------------------------------------------
// Agents lane
// ---------------------------------------------------------------------------------------------
const agentCard = (x, y, w, h, name, sub) => {
  rect(x, y, w, h, 'agent', 9);
  if (sub) {
    text(x + w / 2, y + h / 2 - 3, name, 'agentname');
    text(x + w / 2, y + h / 2 + 12, sub, 'agentsub');
  } else text(x + w / 2, y + h / 2 + 4, name, 'agentname');
};
agentCard(bx(0), 448, BW, 64, 'analyst', 'reads, never writes');
agentCard(bx(2), 448, BW, 64, 'architect', 'reads, never writes');
agentCard(bx(4), 448, BW, 30, 'developer  × N');
agentCard(bx(4), 482, BW, 30, 'test-engineer');
agentCard(bx(6), 448, BW, 64, 'functional-reviewer', 'writes docs only');
agentCard(bx(4), 520, CW * 3 - 12, 32, 'technical-reviewer  —  one lens per instance, in parallel');
// Remote reviewers: optional, another model hosted elsewhere, asked at step 8
rect(bx(7), 448, BW, 64, 'remote', 9);
text(cx(7), 468, 'remote reviewers', 'remotename');
text(cx(7), 483, 'optional · over MCP', 'agentsub');
text(cx(7), 497, 'asked at step 8', 'agentsub');

// ---------------------------------------------------------------------------------------------
// Documents lane
// ---------------------------------------------------------------------------------------------
STEPS.forEach((s, i) => {
  rect(bx(i), 588, BW, 68, 'doc', 8);
  const n = s.docs.length;
  text(cx(i), 588 + 34 - (n - 1) * 7 + 4, s.docs, 'doctext', 'middle', 14);
});

// ---------------------------------------------------------------------------------------------
// Hooks lane
// ---------------------------------------------------------------------------------------------
const bar = (x1, x2, y, h, a, b) => {
  rect(x1, y, x2 - x1, h, 'hookbar', 8);
  if (b) {
    text((x1 + x2) / 2, y + h / 2 - 3, a, 'hooktitle');
    text((x1 + x2) / 2, y + h / 2 + 12, b, 'hooksub');
  } else text((x1 + x2) / 2, y + h / 2 + 4, a, 'hooksub');
};
bar(bx(0), bx(3) + BW, 692, 42, 'Code is locked until /approve go (or fast)', 'only docs/ can change, whether by Edit, Write or a shell command');
bar(bx(4), bx(4) + BW, 692, 42, 'Each agent held', 'to its own files');
bar(bx(5), bx(7) + BW, 692, 42, 'No hand-back and no merge', 'until the last quality run is green and the code unchanged since');
bar(bx(8), bx(8) + BW, 692, 42, 'Ticket closes', 'once retro is written');
bar(bx(0), bx(8) + BW, 744, 32, 'Approvals, the active ticket and its state are written only by the hooks, when the developer types /ticket or /approve — never by Claude');

// ---------------------------------------------------------------------------------------------
// The learning loop
// ---------------------------------------------------------------------------------------------
const KY = 822;
rect(470, KY, 480, 70, 'know', 14);
text(710, KY + 24, 'Project knowledge base', 'knowtitle');
text(710, KY + 42, '.claude/skills/project-knowledge/', 'knowmono');
text(710, KY + 59, 'starts empty · grows with every ticket · committed with the code', 'knowsub');
line(`M${bx(8) + BW} 354 H1396 V${KY + 35} H956`, 'learn', 'a-learn');
text(1176, KY + 27, 'lessons the developer validated', 'learntext');
line(`M470 ${KY + 35} H153 V354 H${bx(0) - 3}`, 'learn', 'a-learn');
text(312, KY + 27, 'read first by every agent, on the next ticket', 'learntext');

// ---------------------------------------------------------------------------------------------
// The six agents
// ---------------------------------------------------------------------------------------------
text(24, 946, 'Six agents, each with its own context and its own limits', 'h2', 'start');
text(W - 24, 946, '+ optional remote reviewers: another model hosted elsewhere, reached over MCP (for example a Hugging Face Space)', 'remotenote', 'end');
const AGENTS = [
  ['analyst', ['Maps the ticket to the code,', 'the ADRs and what the project', 'knows. Every claim cites a file.'], 'nothing', 'ro'],
  ['architect', ['Lists the real decisions, with', 'options, cost, and what the', 'project has already settled.'], 'nothing', 'ro'],
  ['developer', ['Implements one task: domain,', 'adapters, migration, front-end.', 'Several run in parallel.'], 'only the files its task owns', 'rw'],
  ['test-engineer', ['Proves each rule F1, F2… from', 'the contracts, not from the code.', 'Test-first when you choose it.'], 'only its own test files', 'rw'],
  ['technical-reviewer', ['One lens per instance: security,', 'performance, data protection,', 'conventions, past team reviews.'], 'only its findings', 'ro'],
  ['functional-reviewer', ['Checks each rule against the', 'behaviour and its tests, then', 'updates the functional docs.'], 'only documentation', 'ro'],
];
AGENTS.forEach(([name, role, writes, kind], i) => {
  const x = 24 + i * 230;
  rect(x, 962, 218, 138, 'card', 12);
  text(x + 16, 988, name, 'cardname', 'start');
  text(x + 16, 1010, role, 'cardrole', 'start', 16);
  rect(x + 12, 1064, 194, 26, `scope scope-${kind}`, 8);
  text(x + 109, 1081, `can write: ${writes}`, `scopetext scopetext-${kind}`);
});

// ---------------------------------------------------------------------------------------------
// Commands and guarantees
// ---------------------------------------------------------------------------------------------
rect(24, 1122, 680, 146, 'panel', 12);
text(40, 1148, 'What you type', 'h3', 'start');
const CMDS = [
  ['/ticket PET-123 <text>', 'start or resume a ticket'],
  ['/approve functional | technical | go | merge', 'pass a gate — only you can'],
  ['/approve fast', 'small ticket: one approval instead of three'],
  ['/ticket-status', 'where the ticket stands, what comes next'],
  ['/setup  ·  /review-lenses security', 'prepare a project · review outside a ticket'],
];
CMDS.forEach(([c, d], i) => {
  text(40, 1172 + i * 20, c, 'cmd', 'start');
  text(368, 1172 + i * 20, d, 'cmddesc', 'start');
});

rect(716, 1122, 680, 146, 'panel', 12);
text(732, 1148, 'What stays true on every ticket', 'h3', 'start');
const TRUE = [
  'No code is written before you approve the plan.',
  'Every business rule F1, F2… is traced to a test that proves it.',
  'Test-first is your call, asked again on each ticket.',
  'The functional documentation is updated before the human review.',
  'Code leaves your machine only if you list a remote reviewer, and only the code the ticket changed.',
];
TRUE.forEach((t, i) => {
  out.push(`<circle cx="738" cy="${1168 + i * 20}" r="3" class="dot"/>`);
  text(750, 1172 + i * 20, t, 'cmddesc', 'start');
});

// ---------------------------------------------------------------------------------------------
// Assemble
// ---------------------------------------------------------------------------------------------
const marker = (id, cls) => `<marker id="${id}" viewBox="0 0 10 10" refX="8" refY="5" markerWidth="7" markerHeight="7" orient="auto-start-reverse"><path d="M0 0L10 5L0 10z" class="${cls}"/></marker>`;

const css = `
  :root {
    --bg:#ffffff; --ink:#1f2328; --muted:#59636e; --line:#d1d9e0; --panel:#f6f8fa;
    --dev:#9a3412; --dev-bg:#fff7ed; --dev-fill:#ffedd5; --dev-line:#f59e0b;
    --main:#1d4ed8; --main-bg:#eff6ff; --main-fill:#ffffff; --main-line:#93c5fd;
    --agent:#0f766e; --agent-bg:#f0fdfa; --agent-fill:#ccfbf1; --agent-line:#5eead4;
    --doc:#475569; --doc-bg:#f8fafc; --doc-fill:#ffffff; --doc-line:#cbd5e1;
    --hook:#be123c; --hook-bg:#fff1f2; --hook-fill:#ffe4e6; --hook-line:#fda4af;
    --know:#6d28d9; --know-fill:#ede9fe; --know-line:#a78bfa;
  }
  @media (prefers-color-scheme: dark) {
    :root {
      --bg:#0d1117; --ink:#e6edf3; --muted:#9198a1; --line:#30363d; --panel:#161b22;
      --dev:#fdba74; --dev-bg:#1f1508; --dev-fill:#3b2409; --dev-line:#b45309;
      --main:#93c5fd; --main-bg:#0c1626; --main-fill:#13233d; --main-line:#1d4ed8;
      --agent:#5eead4; --agent-bg:#071a18; --agent-fill:#0f2e2a; --agent-line:#0f766e;
      --doc:#cbd5e1; --doc-bg:#11161d; --doc-fill:#1a212b; --doc-line:#3b4654;
      --hook:#fda4af; --hook-bg:#1f0a10; --hook-fill:#3a1220; --hook-line:#9f1239;
      --know:#c4b5fd; --know-fill:#221a3d; --know-line:#6d28d9;
    }
  }
  text { font-family: -apple-system, 'Segoe UI', Helvetica, Arial, sans-serif; fill: var(--ink); }
  .mono, .gatecmd, .gatename, .doctext, .knowmono, .cmd { font-family: ui-monospace, SFMono-Regular, Consolas, 'Liberation Mono', monospace; }
  .bg { fill: var(--bg); stroke: var(--line); }
  .h1 { font-size: 28px; font-weight: 700; }
  .h2 { font-size: 17px; font-weight: 700; }
  .h3 { font-size: 14px; font-weight: 700; }
  .lead { font-size: 13.5px; fill: var(--muted); }
  .tag { fill: var(--panel); stroke: var(--line); } .tagtext { font-size: 12px; fill: var(--muted); font-weight: 600; }
  .lab { stroke-width: 1; } .labt { font-size: 14px; font-weight: 700; } .labs { font-size: 10.5px; fill: var(--muted); }
  .lane { stroke-width: 1; }
  .lab-dev, .lane-dev { fill: var(--dev-bg); stroke: var(--dev-line); } .t-dev { fill: var(--dev); }
  .lab-main, .lane-main { fill: var(--main-bg); stroke: var(--main-line); } .t-main { fill: var(--main); }
  .lab-agent, .lane-agent { fill: var(--agent-bg); stroke: var(--agent-line); } .t-agent { fill: var(--agent); }
  .lab-doc, .lane-doc { fill: var(--doc-bg); stroke: var(--doc-line); } .t-doc { fill: var(--doc); }
  .lab-hook, .lane-hook { fill: var(--hook-bg); stroke: var(--hook-line); } .t-hook { fill: var(--hook); }
  .gateline { stroke: var(--dev-line); stroke-width: 1.5; stroke-dasharray: 4 4; fill: none; }
  .gate { fill: var(--dev-fill); stroke: var(--dev-line); stroke-width: 1.5; }
  .start { fill: var(--bg); stroke: var(--dev-line); stroke-width: 1.5; }
  .gatecmd { font-size: 11px; fill: var(--dev); } .gatename { font-size: 12px; font-weight: 700; fill: var(--dev); }
  .devnote { font-size: 11px; fill: var(--muted); }
  .fast { stroke: var(--dev-line); stroke-width: 1.5; fill: none; stroke-dasharray: 6 4; }
  .fasttext { font-size: 12px; font-weight: 600; fill: var(--dev); }
  .flow { stroke: var(--main-line); stroke-width: 2; fill: none; }
  .step { fill: var(--main-fill); stroke: var(--main-line); stroke-width: 1.5; }
  .num { fill: var(--main); } .numt { font-size: 11px; font-weight: 700; fill: var(--bg); }
  .steptitle { font-size: 13px; font-weight: 700; } .stepsub { font-size: 11px; fill: var(--muted); }
  .loop { stroke: var(--main); stroke-width: 1.5; fill: none; stroke-dasharray: 5 3; } .looptext { font-size: 11px; fill: var(--main); font-weight: 600; }
  .agent { fill: var(--agent-fill); stroke: var(--agent-line); stroke-width: 1.5; }
  .remote { fill: var(--know-fill); stroke: var(--know-line); stroke-width: 1.5; stroke-dasharray: 5 3; }
  .remotename { font-size: 11.5px; font-weight: 700; fill: var(--know); } .remotenote { font-size: 12px; fill: var(--know); font-weight: 600; }
  .agentname { font-size: 11.5px; font-weight: 700; fill: var(--agent); } .agentsub { font-size: 10.5px; fill: var(--muted); }
  .doc { fill: var(--doc-fill); stroke: var(--doc-line); } .doctext { font-size: 10px; fill: var(--doc); }
  .hookbar { fill: var(--hook-fill); stroke: var(--hook-line); }
  .hooktitle { font-size: 11.5px; font-weight: 700; fill: var(--hook); } .hooksub { font-size: 11px; fill: var(--ink); }
  .know { fill: var(--know-fill); stroke: var(--know-line); stroke-width: 2; }
  .knowtitle { font-size: 15px; font-weight: 700; fill: var(--know); } .knowmono { font-size: 11.5px; fill: var(--ink); } .knowsub { font-size: 11px; fill: var(--muted); }
  .learn { stroke: var(--know-line); stroke-width: 2.5; fill: none; } .learntext { font-size: 12px; font-weight: 600; fill: var(--know); }
  .card, .panel { fill: var(--panel); stroke: var(--line); }
  .cardname { font-size: 14.5px; font-weight: 700; fill: var(--agent); } .cardrole { font-size: 12px; fill: var(--ink); }
  .scope-ro { fill: var(--hook-fill); stroke: var(--hook-line); } .scope-rw { fill: var(--agent-fill); stroke: var(--agent-line); }
  .scopetext { font-size: 11px; font-weight: 600; } .scopetext-ro { fill: var(--hook); } .scopetext-rw { fill: var(--agent); }
  .cmd { font-size: 12px; fill: var(--main); font-weight: 600; } .cmddesc { font-size: 12.5px; fill: var(--ink); }
  .dot { fill: var(--agent); }
  .m-gate { fill: var(--dev-line); } .m-loop { fill: var(--main); } .m-learn { fill: var(--know-line); }
`;

const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${W} ${H}" width="${W}" height="${H}" role="img" aria-labelledby="t d">
<title id="t">Spring agentic workflow</title>
<desc id="d">Ten steps from ticket to merge in five lanes: the developer and the four gates, the main session, the six agents and the optional remote reviewers, the documents written, and what the plugin's hooks enforce. A fast path replaces the first three gates for small tickets. After the merge, a retro writes validated lessons into the project's knowledge base, which every agent reads on the next ticket.</desc>
<style>${css}</style>
<defs>${marker('a-gate', 'm-gate')}${marker('a-loop', 'm-loop')}${marker('a-learn', 'm-learn')}</defs>
${out.join('\n')}
</svg>
`;

const file = path.join(path.dirname(fileURLToPath(import.meta.url)), 'workflow.svg');
fs.writeFileSync(file, svg);
process.stdout.write(`${file} written (${svg.length} bytes)\n`);
