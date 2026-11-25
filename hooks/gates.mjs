#!/usr/bin/env node
// Human gates of the Spring agentic workflow.
//
//   node gates.mjs pre-tool   (PreToolUse: gates, protected files, per-agent write scope)
//   node gates.mjs post-tool  (PostToolUse: marks the code as changed since the last checks)
//   node gates.mjs prompt     (UserPromptSubmit: /ticket and /approve typed by the developer)
//   node gates.mjs stop       (Stop: no hand-back while the last quality run is red or out of date)
//   node gates.mjs session    (SessionStart: puts the active ticket back in the context)
//   node gates.mjs status     (prints where the active ticket stands; used by the skills)
//
// Everything that says where a ticket stands is written by this script, never by Claude:
//   docs/tickets/.active            the active ticket, set when the developer types /ticket
//   docs/tickets/<ID>/approvals.json  written when the developer types /approve <gate>
//   docs/tickets/<ID>/state.json      derived from the approvals and the files present
//   docs/tickets/<ID>/.dirty, .snapshot  code changed since the last quality run
// 07-quality-gates.json is written only by skills/quality-gates/run.mjs.
//
// The shell checks are a guard rail, not a sandbox: they catch the usual ways of writing a file
// from a command line, and say so when they refuse.

import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

export const GATES = ['functional', 'technical', 'go', 'merge'];
const PLUGIN = 'spring-agentic-workflow';
const SHELL_TOOLS = new Set(['Bash', 'PowerShell']);

// File of the ticket folder -> gate that must be approved before Claude may write it.
const DOC_REQUIRES = [
  [/^03-/, 'functional'],
  [/^04-/, 'technical'],
  [/^0[6-9]-/, 'go'],
  [/^10-/, 'merge'],
];

// What must exist before the developer can approve each gate.
const GATE_NEEDS_FILE = {
  functional: '02-functional-questions.md',
  technical: '03-technical-plan.md',
  go: '04-implementation-plan.md',
  merge: '08-review.md',
};
const FAST_PLAN = '02-fast-plan.md';

// What each agent of this plugin may write. The agent files say the same thing in words;
// this table is what enforces it.
//   none   nothing inside the project
//   log    only its notes in docs/tickets/<ID>/06-log/
//   docs   docs/ and the project's specification folder
//   owned  the files its tasks own in 04-tasks.json, plus its notes in 06-log/
const AGENT_SCOPE = {
  analyst: 'none',
  architect: 'none',
  'technical-reviewer': 'log',
  'functional-reviewer': 'docs',
  developer: 'owned',
  'test-engineer': 'owned',
};

const APPROVE_RE = /^\s*\/(?:[\w.-]+:)?approve\s+([a-z]+)\b\s*(.*)$/is;
const TICKET_RE = /^\s*\/(?:[\w.-]+:)?ticket(?=\s|$)(?:\s+(\S+))?\s*(.*)$/is;
const TICKET_ID_RE = /^[A-Za-z0-9][\w.-]{0,63}$/;

const MSG_APPROVALS = 'approvals.json is written only when the developer types /approve. Ask the developer.';
const MSG_QUALITY = 'Quality results are written only by the quality-gates script. Run it instead.';
const MSG_SCRIPT = 'The gate script is run by the plugin hooks when the developer types /ticket or /approve. From the shell it can only be asked for the status.';
const MSG_STATE = 'The active ticket and state.json are written by the plugin when the developer types /ticket or /approve. Read them, do not write them.';

// ---------------------------------------------------------------------------------------------
// Paths and files
// ---------------------------------------------------------------------------------------------

export function ticketsDir(projectDir) {
  return path.join(projectDir, 'docs', 'tickets');
}

export function activeTicket(projectDir) {
  const f = path.join(ticketsDir(projectDir), '.active');
  if (!fs.existsSync(f)) return null;
  const id = fs.readFileSync(f, 'utf8').trim();
  return id || null;
}

function readJson(file, fallback) {
  try {
    return JSON.parse(fs.readFileSync(file, 'utf8'));
  } catch {
    return fallback;
  }
}

export function readApprovals(projectDir, id) {
  return readJson(path.join(ticketsDir(projectDir), id, 'approvals.json'), {});
}

export function loadSettings(projectDir) {
  const env = process.env;
  const fromUser = {};
  if (env.CLAUDE_PLUGIN_OPTION_SPECS_PATH) fromUser.specsPath = env.CLAUDE_PLUGIN_OPTION_SPECS_PATH;
  if (env.CLAUDE_PLUGIN_OPTION_KNOWLEDGE_PATH) fromUser.knowledgePath = env.CLAUDE_PLUGIN_OPTION_KNOWLEDGE_PATH;
  return { ...fromUser, ...readJson(path.join(projectDir, '.claude', `${PLUGIN}.json`), {}) };
}

function rel(projectDir, file) {
  return path.relative(path.resolve(projectDir), path.resolve(projectDir, file)).split(path.sep).join('/');
}

function isInside(relPath) {
  return relPath !== '' && !relPath.startsWith('../') && relPath !== '..' && !path.isAbsolute(relPath);
}

// Files only the plugin's scripts may write. Returns the refusal message, or null.
function protectedFile(relPath) {
  if (/(^|\/)docs\/tickets\/[^/]+\/approvals\.json$/.test(relPath)) return MSG_APPROVALS;
  if (/(^|\/)docs\/tickets\/[^/]+\/(07-quality-gates\.json|\.dirty|\.snapshot)$/.test(relPath)) return MSG_QUALITY;
  if (/(^|\/)docs\/tickets\/(\.active|[^/]+\/state\.json)$/.test(relPath)) return MSG_STATE;
  return null;
}

// ---------------------------------------------------------------------------------------------
// Agents and task ownership
// ---------------------------------------------------------------------------------------------

// "spring-agentic-workflow:developer" or "developer" -> "developer"; anything else -> null.
export function pluginAgent(agentType) {
  const s = String(agentType || '');
  if (!s) return null;
  const i = s.lastIndexOf(':');
  if (i >= 0 && s.slice(0, i) !== PLUGIN) return null;
  const name = i >= 0 ? s.slice(i + 1) : s;
  return Object.hasOwn(AGENT_SCOPE, name) ? name : null;
}

export function globToRegExp(glob) {
  let g = String(glob).replace(/\\/g, '/').replace(/^\.\//, '');
  if (g.endsWith('/')) g += '**';
  const esc = (s) => s.replace(/[.+^${}()|[\]\\?]/g, '\\$&');
  const body = g.split('**').map((part) => part.split('*').map(esc).join('[^/]*')).join('.*');
  return new RegExp(`^${body}$`);
}

// The globs an agent may write, from docs/tickets/<ID>/04-tasks.json, or null when there is no table.
export function ownedGlobs(projectDir, id, agent) {
  const table = readJson(path.join(ticketsDir(projectDir), id, '04-tasks.json'), null);
  if (!table || !Array.isArray(table.tasks)) return null;
  return table.tasks.filter((t) => t && t.agent === agent).flatMap((t) => (Array.isArray(t.owns) ? t.owns : []));
}

function agentWriteRefusal(projectDir, id, agent, r) {
  const scope = AGENT_SCOPE[agent];
  const logPrefix = `docs/tickets/${id}/06-log/`;
  if (scope === 'none') {
    return `The ${agent} agent is read-only: return your findings, the main session writes the file.`;
  }
  if (scope === 'log') {
    return r.startsWith(logPrefix) ? null : `The ${agent} agent only writes its findings under ${logPrefix}. It does not change code or other documents.`;
  }
  if (scope === 'docs') {
    const specs = String(loadSettings(projectDir).specsPath || '').replace(/\\/g, '/').replace(/^\.\//, '').replace(/\/$/, '');
    if (r.startsWith('docs/') || (specs && (r === specs || r.startsWith(`${specs}/`)))) return null;
    return `The ${agent} agent only writes documentation: docs/${specs ? ` and ${specs}/` : ''}. It does not change code.`;
  }
  if (r.startsWith(logPrefix)) return null;
  if (r.startsWith('docs/')) {
    return `The ${agent} agent writes code and its notes under ${logPrefix}, not other documents.`;
  }
  const globs = ownedGlobs(projectDir, id, agent);
  if (globs === null) return null; // no task table (fast path): the gates alone apply
  if (globs.some((g) => globToRegExp(g).test(r))) return null;
  return `${r} is not owned by a ${agent} task in 04-tasks.json. Write your question in ${logPrefix} and carry on with your own files.`;
}

// ---------------------------------------------------------------------------------------------
// Shell commands
// ---------------------------------------------------------------------------------------------

const FILE_COMMANDS = new Set(['rm', 'rmdir', 'mv', 'cp', 'mkdir', 'touch', 'truncate', 'ln', 'chmod', 'chown', 'install']);
const GIT_WRITES = new Set(['add', 'am', 'apply', 'checkout', 'cherry-pick', 'clean', 'commit', 'merge', 'mv', 'pull', 'push', 'rebase', 'reset', 'restore', 'revert', 'rm', 'stash', 'switch']);
const INLINE_INTERPRETERS = new Set(['node', 'python', 'python3', 'py', 'ruby', 'perl', 'php', 'deno', 'bun']);
const PS_WRITES = /\b(Set-Content|Add-Content|Out-File|New-Item|Remove-Item|Copy-Item|Move-Item|Rename-Item|Clear-Content|Tee-Object)\b/i;
const NULL_TARGETS = new Set(['/dev/null', 'nul', '$null', '/dev/stdout', '/dev/stderr']);

function unquote(t) {
  return t.replace(/^(["'])(.*)\1$/s, '$2');
}

// What a shell command writes, as far as its text shows:
//   { path }  a file or folder it creates, changes or removes
//   { what }  a write whose target cannot be read from the text (sed -i, git reset, node -e…)
export function shellWrites(command) {
  const cmd = String(command || '');
  const found = [];

  for (const m of cmd.matchAll(/(?<![<>&=\-\d])(?:\d|&)?>{1,2}\s*("[^"]*"|'[^']*'|[^\s;|&<>()]+)/g)) {
    found.push({ path: unquote(m[1]) });
  }
  const ps = PS_WRITES.exec(cmd);
  if (ps) found.push({ what: ps[1] });

  for (const segment of cmd.split(/&&|\|\||[;|\n]/)) {
    const tokens = (segment.match(/"[^"]*"|'[^']*'|\S+/g) || []).map(unquote);
    while (tokens.length && (/^[A-Za-z_]\w*=/.test(tokens[0]) || tokens[0] === 'sudo' || tokens[0] === 'command')) tokens.shift();
    if (!tokens.length) continue;
    const name = tokens[0].replace(/^.*[\\/]/, '').replace(/\.exe$/i, '').toLowerCase();
    const args = tokens.slice(1);
    const plain = args.filter((a) => !a.startsWith('-'));

    if (FILE_COMMANDS.has(name)) {
      for (const a of plain) found.push({ path: a });
    } else if (name === 'tee') {
      for (const a of plain) found.push({ path: a });
    } else if (name === 'git') {
      const sub = plain[0];
      if (GIT_WRITES.has(sub)) found.push({ what: `git ${sub}` });
    } else if (name === 'sed' && args.some((a) => /^-[a-zA-Z]*i/.test(a) || a.startsWith('--in-place'))) {
      found.push({ what: 'sed -i' });
    } else if (INLINE_INTERPRETERS.has(name) && args.some((a) => /^-[a-zA-Z]*[ce]$/.test(a) || a === '--eval')) {
      found.push({ what: `${name} with inline code` });
    } else if (name === 'perl' && args.some((a) => /^-[a-zA-Z]*i/.test(a))) {
      found.push({ what: 'perl -i' });
    } else if (name === 'patch' || name === 'dd') {
      found.push({ what: name });
    } else if (name === 'wget' || (name === 'curl' && args.some((a) => /^-[a-zA-Z]*[oO]$/.test(a) || a === '--output'))) {
      found.push({ what: `${name} download` });
    }
  }
  return found;
}

// Returns the first write of a shell command that is not allowed, as text, or null.
//   allowDocs: writes under docs/ are fine (the main session before "go", agents that write code with Edit)
function shellRefusal(projectDir, command, { allowDocs }) {
  for (const w of shellWrites(command)) {
    if (w.what) return w.what;
    const target = w.path;
    if (NULL_TARGETS.has(target.toLowerCase())) continue;
    if (/[$`]/.test(target) || target.startsWith('~')) return `a write to ${target}`;
    const r = rel(projectDir, target);
    if (!isInside(r)) continue; // scratch files outside the project
    if (allowDocs && r.startsWith('docs/') && !protectedFile(r)) continue;
    return `a write to ${r}`;
  }
  return null;
}

// ---------------------------------------------------------------------------------------------
// PreToolUse
// ---------------------------------------------------------------------------------------------

// The files only the plugin writes may be read from the shell (cat, jq, grep…), never written.
// Refused: a command whose target is one of them, and a write whose target cannot be read from
// the text (sed -i, an inline script…) in a command that names one of them.
function protectedShellRefusal(projectDir, cmd) {
  const writes = shellWrites(cmd);
  for (const w of writes) {
    if (!w.path) continue;
    const byPath = protectedFile(rel(projectDir, w.path));
    if (byPath) return byPath;
    const base = w.path.replace(/\\/g, '/').split('/').pop();
    if (base === 'approvals.json') return MSG_APPROVALS;
    if (base === '07-quality-gates.json') return MSG_QUALITY;
  }
  if (writes.some((w) => w.what)) {
    if (/approvals\.json/.test(cmd)) return MSG_APPROVALS;
    if (/07-quality-gates\.json|tickets[\\/][^ ]*\.(dirty|snapshot)\b/.test(cmd)) return MSG_QUALITY;
    if (/tickets[\\/](\.active|[^ ]*state\.json)/.test(cmd)) return MSG_STATE;
  }
  return null;
}

// Returns null when the tool call may go on, or the reason to refuse it.
export function checkToolUse(projectDir, toolName, toolInput = {}, context = {}) {
  const id = activeTicket(projectDir);
  const agent = pluginAgent(context.agentType);

  if (SHELL_TOOLS.has(toolName)) {
    const cmd = String(toolInput.command || '');
    if (/gates\.mjs/.test(cmd) && !/gates\.mjs["']?\s+status\s*$/.test(cmd.trim())) return MSG_SCRIPT;
    const locked = protectedShellRefusal(projectDir, cmd);
    if (locked) return locked;
    if (!id) return null;

    const approvals = readApprovals(projectDir, id);
    if (!approvals.go && /\bgit\s+(commit|push)\b/.test(cmd)) {
      return `Ticket ${id}: no commit or push before the developer approves the plan with /approve go.`;
    }
    if (agent) {
      const readOnly = AGENT_SCOPE[agent] === 'none' || AGENT_SCOPE[agent] === 'log';
      const why = shellRefusal(projectDir, cmd, { allowDocs: !readOnly });
      if (why) {
        return readOnly
          ? `The ${agent} agent is read-only and this command looks like ${why}. Use the shell only to read, build or run tests.`
          : `The ${agent} agent changes files with Edit or Write, where its task's files are checked, not from the shell: this command looks like ${why}.`;
      }
      return null;
    }
    if (!approvals.go) {
      const why = shellRefusal(projectDir, cmd, { allowDocs: true });
      if (why) {
        return `Ticket ${id}: code changes are locked until the developer approves the implementation plan with /approve go, and this command looks like ${why}. Only files under docs/ can change now.`;
      }
    }
    return null;
  }

  const file = toolInput.file_path || toolInput.notebook_path;
  if (!file) return null;
  const r = rel(projectDir, file);

  const locked = protectedFile(r);
  if (locked) return locked;
  if (!id || !isInside(r)) return null;

  if (agent) {
    const refusal = agentWriteRefusal(projectDir, id, agent, r);
    if (refusal) return refusal;
  }

  const approvals = readApprovals(projectDir, id);
  const ticketPrefix = `docs/tickets/${id}/`;

  if (r.startsWith(ticketPrefix)) {
    const name = r.slice(ticketPrefix.length);
    for (const [re, gate] of DOC_REQUIRES) {
      if (re.test(name) && !approvals[gate]) {
        return `Ticket ${id}: ${name} comes after the "${gate}" gate. Wait for the developer to type /approve ${gate}.`;
      }
    }
    if (/^08-/.test(name) && !fs.existsSync(path.join(ticketsDir(projectDir), id, '07-quality-report.md'))) {
      return `Ticket ${id}: write 07-quality-report.md (step 7) before ${name}. The review and the retro read it.`;
    }
    return null;
  }
  if (r.startsWith('docs/')) return null;
  if (!approvals.go) {
    return `Ticket ${id}: code changes are locked until the developer approves the implementation plan with /approve go. Only files under docs/ can change now.`;
  }
  return null;
}

// ---------------------------------------------------------------------------------------------
// State, derived from what the developer approved and what exists
// ---------------------------------------------------------------------------------------------

const NEXT = {
  1: 'run the understand-requirement skill; it ends with 01-understanding.md',
  2: 'the developer answers the functional questions, then types /approve functional (or /approve fast for a small ticket with 02-fast-plan.md)',
  3: 'build the technical plan with the developer (technical-plan skill); it ends when the developer types /approve technical',
  4: 'run the orchestrate skill; it ends with 04-implementation-plan.md and 04-tasks.json',
  5: 'the developer reads the implementation plan and types /approve go',
  6: 'run the implement skill, then the quality-gates skill',
  7: 'the last quality run is red or out of date: fix, then run the quality-gates script again',
  8: 'run the final-review skill; it ends with 08-review.md',
  9: 'the developer reviews the pull request and types /approve merge',
  10: 'run the retro skill; it ends with 10-retro.md',
  done: 'nothing: the ticket is closed',
};

export function deriveState(projectDir, id) {
  const dir = path.join(ticketsDir(projectDir), id);
  const has = (f) => fs.existsSync(path.join(dir, f));
  const approvals = readApprovals(projectDir, id);
  let step;
  if (approvals.merge) step = has('10-retro.md') ? 'done' : 10;
  else if (approvals.go) {
    const q = qualityState(projectDir, id);
    if (q.passed) step = has('08-review.md') ? 9 : 8;
    else step = has('07-quality-gates.json') ? 7 : 6;
  } else if (approvals.technical) step = has('04-implementation-plan.md') ? 5 : 4;
  else if (approvals.functional) step = 3;
  else step = has('01-understanding.md') ? 2 : 1;
  return {
    ticket: id,
    step,
    path: approvals.fast ? 'fast' : 'full',
    approved: [...GATES.filter((g) => approvals[g]), ...(approvals.fast ? ['fast'] : [])],
    changedSinceApproval: changedSinceApproval(dir, approvals),
    next: NEXT[step],
  };
}

// The document a gate approves. Its fingerprint is kept with the approval, so a later change shows.
const GATE_DOC = { functional: '02-functional-questions.md', technical: '03-technical-plan.md', go: '04-implementation-plan.md', fast: FAST_PLAN };

function fingerprint(file) {
  try {
    return crypto.createHash('sha256').update(fs.readFileSync(file, 'utf8').replace(/\r/g, '')).digest('hex').slice(0, 16);
  } catch {
    return null;
  }
}

function changedSinceApproval(dir, approvals) {
  const changed = [];
  for (const a of Object.values(approvals)) {
    if (a && a.doc && a.doc.sha && fingerprint(path.join(dir, a.doc.file)) !== a.doc.sha && !changed.includes(a.doc.file)) changed.push(a.doc.file);
  }
  return changed;
}

function writeState(projectDir, id) {
  const dir = path.join(ticketsDir(projectDir), id);
  if (!fs.existsSync(dir)) return null;
  const state = deriveState(projectDir, id);
  fs.writeFileSync(path.join(dir, 'state.json'), JSON.stringify(state, null, 2) + '\n');
  if (state.step === 'done') fs.writeFileSync(path.join(ticketsDir(projectDir), '.active'), '');
  return state;
}

export function describe(projectDir) {
  const id = activeTicket(projectDir);
  if (!id) return null;
  const s = deriveState(projectDir, id);
  const approved = s.approved.length ? s.approved.join(', ') : 'none';
  const changed = s.changedSinceApproval.length
    ? ` Changed since the developer approved it: ${s.changedSinceApproval.join(', ')}. Tell the developer what changed; they approve it again with the same /approve command if they agree.`
    : '';
  return `Spring agentic workflow: ticket ${id} is active (${s.path} path), step ${s.step}. Gates approved by the developer: ${approved}. Next: ${s.next}. Its documents are in docs/tickets/${id}/.${changed}`;
}

// ---------------------------------------------------------------------------------------------
// UserPromptSubmit: /ticket and /approve
// ---------------------------------------------------------------------------------------------

function handleTicket(projectDir, m) {
  const id = m[1];
  if (!id) return { ok: false, message: 'Usage: /ticket <TICKET-ID> [ticket text or path to a file], or /ticket --off to switch the gates off.' };
  const tickets = ticketsDir(projectDir);
  if (id === '--off') {
    if (fs.existsSync(tickets)) fs.writeFileSync(path.join(tickets, '.active'), '');
    return { ok: true, message: 'No ticket is active any more: the gates of the Spring agentic workflow are off.' };
  }
  if (!TICKET_ID_RE.test(id)) {
    return { ok: false, message: `"${id}" cannot be a ticket ID: use letters, digits, dots, dashes or underscores, for example PET-123.` };
  }
  const dir = path.join(tickets, id);
  const isNew = !fs.existsSync(dir);
  fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(path.join(tickets, '.active'), id + '\n');
  const state = writeState(projectDir, id);
  const where = state.step === 'done' ? 'It is already closed.' : `Next: ${state.next}.`;
  return {
    ok: true,
    message: `The developer ${isNew ? 'started' : 'resumed'} ticket ${id}. The plugin made it the active ticket and wrote docs/tickets/${id}/state.json (step ${state.step}, ${state.path} path). ${where}`,
  };
}

// Handles "/ticket <ID>" and "/approve <gate> [note]" typed by the developer.
// Returns { ok, message } or null when the prompt is neither.
export function handlePrompt(projectDir, prompt, now = new Date()) {
  const text = String(prompt || '');
  const t = TICKET_RE.exec(text);
  if (t) return handleTicket(projectDir, t);

  const m = APPROVE_RE.exec(text);
  if (!m) return null;
  const gate = m[1].toLowerCase();
  const note = m[2].trim();
  if (gate !== 'fast' && !GATES.includes(gate)) {
    return { ok: false, message: `Unknown gate "${gate}". Use one of: ${GATES.join(', ')}, or fast.` };
  }
  const id = activeTicket(projectDir);
  if (!id) return { ok: false, message: 'No active ticket. Start one with /ticket first.' };

  const dir = path.join(ticketsDir(projectDir), id);
  const approvals = readApprovals(projectDir, id);
  const stamp = { at: now.toISOString(), note };

  if (gate === 'fast') {
    if (approvals.functional && !approvals.fast) {
      return { ok: false, message: `Ticket ${id}: the fast path replaces the first three gates, and "functional" is already approved. Carry on with the normal gates.` };
    }
    for (const f of ['01-understanding.md', FAST_PLAN]) {
      if (!fs.existsSync(path.join(dir, f))) {
        return { ok: false, message: `Ticket ${id}: ${f} does not exist yet, nothing to approve.` };
      }
    }
    approvals.fast = { ...stamp, doc: { file: FAST_PLAN, sha: fingerprint(path.join(dir, FAST_PLAN)) } };
    for (const g of ['functional', 'technical', 'go']) approvals[g] = { ...stamp, via: 'fast' };
  } else {
    const previous = GATES[GATES.indexOf(gate) - 1];
    if (previous && !approvals[previous]) {
      return { ok: false, message: `Ticket ${id}: approve "${previous}" before "${gate}".` };
    }
    const needed = approvals.fast && gate !== 'merge' ? FAST_PLAN : GATE_NEEDS_FILE[gate];
    if (!fs.existsSync(path.join(dir, needed))) {
      return { ok: false, message: `Ticket ${id}: ${needed} does not exist yet, nothing to approve.` };
    }
    if (gate === 'merge') {
      const q = qualityState(projectDir, id);
      if (!q.passed) return { ok: false, message: `Ticket ${id}: ${q.reason} Run the quality gates before approving the merge.` };
    }
    approvals[gate] = GATE_DOC[gate] && !approvals.fast
      ? { ...stamp, doc: { file: GATE_DOC[gate], sha: fingerprint(path.join(dir, GATE_DOC[gate])) } }
      : stamp;
  }

  fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(path.join(dir, 'approvals.json'), JSON.stringify(approvals, null, 2) + '\n');
  if (approvals.go && !fs.existsSync(path.join(dir, '.snapshot'))) {
    const snap = codeSnapshot(projectDir);
    if (snap) fs.writeFileSync(path.join(dir, '.snapshot'), snap + '\n');
  }
  const state = writeState(projectDir, id);
  const what = gate === 'fast'
    ? `chose the fast path for ticket ${id}: the "functional", "technical" and "go" gates are approved together on ${FAST_PLAN}`
    : `approved the "${gate}" gate of ticket ${id}`;
  return {
    ok: true,
    message: `The developer ${what}${note ? `, with this note: ${note}` : ''}. The approval is recorded in docs/tickets/${id}/approvals.json. Next: ${state.next}.`,
  };
}

// ---------------------------------------------------------------------------------------------
// Quality state and the "code changed" mark
// ---------------------------------------------------------------------------------------------

// Whether the last quality run passed and no code changed since.
export function qualityState(projectDir, id) {
  const dir = path.join(ticketsDir(projectDir), id);
  const f = path.join(dir, '07-quality-gates.json');
  if (!fs.existsSync(f)) return { passed: false, reason: 'the quality gates have not run yet.' };
  const result = readJson(f, null);
  if (!result) return { passed: false, reason: '07-quality-gates.json cannot be read.' };
  if (!result.passed) return { passed: false, reason: 'the last quality run failed.' };
  if (fs.existsSync(path.join(dir, '.dirty'))) return { passed: false, reason: 'code changed after the last quality run.' };
  return { passed: true };
}

// PostToolUse on Edit / Write: any change outside docs/ after "go" means the checks must run again.
export function markDirty(projectDir, toolInput = {}) {
  const id = activeTicket(projectDir);
  const file = toolInput.file_path || toolInput.notebook_path;
  if (!id || !file) return false;
  const r = rel(projectDir, file);
  if (!isInside(r) || r.startsWith('docs/') || r.startsWith('.claude/')) return false;
  if (!readApprovals(projectDir, id).go) return false;
  fs.writeFileSync(path.join(ticketsDir(projectDir), id, '.dirty'), new Date().toISOString() + '\n');
  return true;
}

const NOT_CODE = [':(exclude)docs', ':(exclude).claude'];
const BUILD_DIRS = /^(target|build|out|dist|node_modules|\.gradle|\.mvn\/wrapper|\.angular|coverage)\//;

// A fingerprint of the code as git sees it (tracked changes and untracked files), without docs/ and build output.
// Returns null outside a git repository.
export function codeSnapshot(projectDir) {
  const git = (args) => execFileSync('git', args, {
    cwd: projectDir, encoding: 'utf8', maxBuffer: 256 * 1024 * 1024, timeout: 20000, stdio: ['ignore', 'pipe', 'ignore'],
  });
  try {
    let head = '';
    try {
      head = git(['rev-parse', 'HEAD']).trim();
    } catch {
      head = 'no-commit';
    }
    const diff = head === 'no-commit' ? '' : git(['diff', 'HEAD', '--', '.', ...NOT_CODE]);
    const untracked = git(['ls-files', '--others', '--exclude-standard', '--', '.', ...NOT_CODE])
      .split('\n').filter((f) => f && !BUILD_DIRS.test(f))
      .map((f) => {
        try {
          const s = fs.statSync(path.join(projectDir, f));
          return `${f}:${s.size}:${Math.floor(s.mtimeMs)}`;
        } catch {
          return f;
        }
      });
    return crypto.createHash('sha256').update(head).update(diff).update(untracked.join('\n')).digest('hex');
  } catch {
    return null;
  }
}

// PostToolUse on a shell command: after "go", compare the code with the last fingerprint.
// The quality script itself refreshes the fingerprint without marking the ticket dirty.
export function markDirtyAfterShell(projectDir, command = '') {
  const id = activeTicket(projectDir);
  if (!id || !readApprovals(projectDir, id).go) return false;
  const snap = codeSnapshot(projectDir);
  if (!snap) return false;
  const dir = path.join(ticketsDir(projectDir), id);
  const file = path.join(dir, '.snapshot');
  const before = fs.existsSync(file) ? fs.readFileSync(file, 'utf8').trim() : null;
  if (before === snap) return false;
  fs.writeFileSync(file, snap + '\n');
  if (before === null || /quality-gates[\\/]run\.mjs/.test(String(command))) return false;
  fs.writeFileSync(path.join(dir, '.dirty'), new Date().toISOString() + '\n');
  return true;
}

// Stop: once the quality gates have run, Claude may not hand back while they are red or out of date.
export function checkStop(projectDir, stopHookActive = false) {
  if (stopHookActive) return null;
  const id = activeTicket(projectDir);
  if (!id) return null;
  const approvals = readApprovals(projectDir, id);
  if (!approvals.go || approvals.merge) return null;
  if (!fs.existsSync(path.join(ticketsDir(projectDir), id, '07-quality-gates.json'))) return null;
  const q = qualityState(projectDir, id);
  if (q.passed) return null;
  return `Ticket ${id}: ${q.reason} Run the quality-gates skill, fix what fails, then continue. If the same check failed three times, explain the problem to the developer instead.`;
}

// ---------------------------------------------------------------------------------------------
// Hook entry point
// ---------------------------------------------------------------------------------------------

function readStdin() {
  try {
    return JSON.parse(fs.readFileSync(0, 'utf8') || '{}');
  } catch {
    return {};
  }
}

// The project a tool call belongs to: the nearest folder, going up from the file it touches (or from the
// folder a shell command starts in), that holds docs/tickets/. This covers a project opened from a parent
// folder, a monorepo, and agents working in another checkout. Falls back to the session's project.
export function resolveProjectDir(input = {}, fallback = process.cwd()) {
  const base = input.cwd || fallback;
  const tool = input.tool_input || {};
  let start = null;
  if (SHELL_TOOLS.has(input.tool_name)) {
    const cd = /^\s*(?:cd|pushd|Set-Location)\s+(?:"([^"]+)"|'([^']+)'|([^\s;&|]+))/i.exec(String(tool.command || ''));
    start = path.resolve(base, cd ? cd[1] || cd[2] || cd[3] : '.');
  } else if (tool.file_path || tool.notebook_path) {
    start = path.dirname(path.resolve(base, tool.file_path || tool.notebook_path));
  }
  for (let dir = start; dir; ) {
    if (fs.existsSync(path.join(dir, 'docs', 'tickets'))) return dir;
    const parent = path.dirname(dir);
    if (parent === dir) break;
    dir = parent;
  }
  return fallback;
}

function main() {
  const mode = process.argv[2];
  const input = mode === 'status' ? {} : readStdin();
  const sessionDir = process.env.CLAUDE_PROJECT_DIR || input.cwd || process.cwd();
  const projectDir = mode === 'pre-tool' || mode === 'post-tool' ? resolveProjectDir(input, sessionDir) : sessionDir;

  if (mode === 'pre-tool') {
    const reason = checkToolUse(projectDir, input.tool_name, input.tool_input, { agentType: input.agent_type });
    if (reason) {
      process.stdout.write(JSON.stringify({
        hookSpecificOutput: {
          hookEventName: 'PreToolUse',
          permissionDecision: 'deny',
          permissionDecisionReason: reason,
        },
      }));
    }
    process.exit(0);
  }

  if (mode === 'post-tool') {
    if (SHELL_TOOLS.has(input.tool_name)) markDirtyAfterShell(projectDir, input.tool_input && input.tool_input.command);
    else markDirty(projectDir, input.tool_input);
    const id = activeTicket(projectDir);
    if (id) writeState(projectDir, id);
    process.exit(0);
  }

  if (mode === 'stop') {
    const reason = checkStop(projectDir, input.stop_hook_active);
    if (reason) process.stdout.write(JSON.stringify({ decision: 'block', reason }));
    process.exit(0);
  }

  if (mode === 'prompt') {
    const result = handlePrompt(projectDir, input.prompt);
    if (!result) process.exit(0);
    if (!result.ok) {
      process.stderr.write(result.message + '\n');
      process.exit(2);
    }
    process.stdout.write(result.message + '\n');
    process.exit(0);
  }

  if (mode === 'session' || mode === 'status') {
    const id = activeTicket(projectDir);
    if (id) writeState(projectDir, id);
    const line = describe(projectDir);
    if (line) process.stdout.write(line + '\n');
    else if (mode === 'status') process.stdout.write('Spring agentic workflow: no ticket is active.\n');
    process.exit(0);
  }

  process.stderr.write(`gates.mjs: unknown mode "${mode}"\n`);
  process.exit(1);
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  main();
}
