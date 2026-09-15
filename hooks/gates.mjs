#!/usr/bin/env node
// Human gates of the Spring agentic workflow.
//
//   node gates.mjs pre-tool   (PreToolUse hook)
//   node gates.mjs post-tool  (PostToolUse hook: marks the code as changed since the last checks)
//   node gates.mjs prompt     (UserPromptSubmit hook)
//   node gates.mjs stop       (Stop hook: no hand-back at steps 7-9 while checks are missing or red)
//
// Approvals live in docs/tickets/<ID>/approvals.json. Only this script writes that file,
// when the developer types /approve <gate>. Claude cannot write it: the pre-tool hook refuses.
// The same goes for 07-quality-gates.json, written only by skills/quality-gates/run.mjs.

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

export const GATES = ['functional', 'technical', 'go', 'merge'];

// File of the ticket folder -> gate that must be approved before Claude may write it.
const DOC_REQUIRES = [
  [/^03-/, 'functional'],
  [/^04-/, 'technical'],
  [/^0[6-9]-/, 'go'],
];

// What must exist before the developer can approve each gate.
const GATE_NEEDS_FILE = {
  functional: '02-functional-questions.md',
  technical: '03-technical-plan.md',
  go: '04-implementation-plan.md',
  merge: '08-review.md',
};

const APPROVE_RE = /^\s*\/(?:[\w.-]+:)?approve\s+([a-z]+)\b\s*(.*)$/is;

export function ticketsDir(projectDir) {
  return path.join(projectDir, 'docs', 'tickets');
}

export function activeTicket(projectDir) {
  const f = path.join(ticketsDir(projectDir), '.active');
  if (!fs.existsSync(f)) return null;
  const id = fs.readFileSync(f, 'utf8').trim();
  return id || null;
}

export function readApprovals(projectDir, id) {
  const f = path.join(ticketsDir(projectDir), id, 'approvals.json');
  if (!fs.existsSync(f)) return {};
  try {
    return JSON.parse(fs.readFileSync(f, 'utf8'));
  } catch {
    return {};
  }
}

function rel(projectDir, file) {
  return path.relative(path.resolve(projectDir), path.resolve(projectDir, file)).split(path.sep).join('/');
}

function isInside(relPath) {
  return relPath !== '' && !relPath.startsWith('../') && relPath !== '..' && !path.isAbsolute(relPath);
}

// Returns null when the tool call may go on, or the reason to refuse it.
export function checkToolUse(projectDir, toolName, toolInput = {}) {
  const id = activeTicket(projectDir);

  if (toolName === 'Bash') {
    const cmd = String(toolInput.command || '');
    if (/approvals\.json/.test(cmd)) {
      return 'approvals.json is written only when the developer types /approve. Ask the developer.';
    }
    if (/07-quality-gates\.json|tickets\/[^ ]*\.dirty/.test(cmd)) {
      return 'Quality results are written only by the quality-gates script. Run it instead.';
    }
    if (!id) return null;
    const approvals = readApprovals(projectDir, id);
    if (!approvals.go && /\bgit\s+(commit|push)\b/.test(cmd)) {
      return `Ticket ${id}: no commit or push before the developer approves the plan with /approve go.`;
    }
    return null;
  }

  const file = toolInput.file_path || toolInput.notebook_path;
  if (!file) return null;
  const r = rel(projectDir, file);

  if (/(^|\/)docs\/tickets\/[^/]+\/approvals\.json$/.test(r)) {
    return 'approvals.json is written only when the developer types /approve. Ask the developer.';
  }
  if (/(^|\/)docs\/tickets\/[^/]+\/(07-quality-gates\.json|\.dirty)$/.test(r)) {
    return 'Quality results are written only by the quality-gates script. Run it instead.';
  }
  if (!id || !isInside(r)) return null;

  const approvals = readApprovals(projectDir, id);
  const ticketPrefix = `docs/tickets/${id}/`;

  if (r.startsWith(ticketPrefix)) {
    const name = r.slice(ticketPrefix.length);
    for (const [re, gate] of DOC_REQUIRES) {
      if (re.test(name) && !approvals[gate]) {
        return `Ticket ${id}: ${name} comes after the "${gate}" gate. Wait for the developer to type /approve ${gate}.`;
      }
    }
    return null;
  }
  if (r.startsWith('docs/')) return null;
  if (!approvals.go) {
    return `Ticket ${id}: code changes are locked until the developer approves the implementation plan with /approve go. Only files under docs/ can change now.`;
  }
  return null;
}

// Handles "/approve <gate> [note]" typed by the developer.
// Returns { ok, message } or null when the prompt is not an approval.
export function handlePrompt(projectDir, prompt, now = new Date()) {
  const m = APPROVE_RE.exec(String(prompt || ''));
  if (!m) return null;
  const gate = m[1].toLowerCase();
  const note = m[2].trim();
  if (!GATES.includes(gate)) {
    return { ok: false, message: `Unknown gate "${gate}". Use one of: ${GATES.join(', ')}.` };
  }
  const id = activeTicket(projectDir);
  if (!id) return { ok: false, message: 'No active ticket. Start one with /ticket first.' };

  const dir = path.join(ticketsDir(projectDir), id);
  const approvals = readApprovals(projectDir, id);
  const previous = GATES[GATES.indexOf(gate) - 1];
  if (previous && !approvals[previous]) {
    return { ok: false, message: `Ticket ${id}: approve "${previous}" before "${gate}".` };
  }
  const needed = GATE_NEEDS_FILE[gate];
  if (!fs.existsSync(path.join(dir, needed))) {
    return { ok: false, message: `Ticket ${id}: ${needed} does not exist yet, nothing to approve.` };
  }
  if (gate === 'merge') {
    const q = qualityState(projectDir, id);
    if (!q.passed) return { ok: false, message: `Ticket ${id}: ${q.reason} Run the quality gates before approving the merge.` };
  }

  approvals[gate] = { at: now.toISOString(), note };
  fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(path.join(dir, 'approvals.json'), JSON.stringify(approvals, null, 2) + '\n');
  return {
    ok: true,
    message: `The developer approved the "${gate}" gate of ticket ${id}${note ? ` with this note: ${note}` : ''}. The approval is recorded in docs/tickets/${id}/approvals.json.`,
  };
}

// Whether the last quality run passed and no code changed since.
export function qualityState(projectDir, id) {
  const dir = path.join(ticketsDir(projectDir), id);
  const f = path.join(dir, '07-quality-gates.json');
  if (!fs.existsSync(f)) return { passed: false, reason: 'the quality gates have not run yet.' };
  let result;
  try {
    result = JSON.parse(fs.readFileSync(f, 'utf8'));
  } catch {
    return { passed: false, reason: '07-quality-gates.json cannot be read.' };
  }
  if (!result.passed) return { passed: false, reason: 'the last quality run failed.' };
  if (fs.existsSync(path.join(dir, '.dirty'))) return { passed: false, reason: 'code changed after the last quality run.' };
  return { passed: true };
}

// PostToolUse: any change outside docs/ after "go" means the checks must run again.
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

function readState(projectDir, id) {
  try {
    return JSON.parse(fs.readFileSync(path.join(ticketsDir(projectDir), id, 'state.json'), 'utf8'));
  } catch {
    return {};
  }
}

// Stop: from step 7 on, Claude may not hand back while the checks are missing, red or out of date.
export function checkStop(projectDir, stopHookActive = false) {
  if (stopHookActive) return null;
  const id = activeTicket(projectDir);
  if (!id) return null;
  const approvals = readApprovals(projectDir, id);
  if (!approvals.go || approvals.merge) return null;
  const step = Number(readState(projectDir, id).step);
  if (!(step >= 7)) return null;
  const q = qualityState(projectDir, id);
  if (q.passed) return null;
  return `Ticket ${id} is at step ${step}: ${q.reason} Run the quality-gates skill, fix what fails, then continue.`;
}

function readStdin() {
  try {
    return JSON.parse(fs.readFileSync(0, 'utf8') || '{}');
  } catch {
    return {};
  }
}

function main() {
  const mode = process.argv[2];
  const input = readStdin();
  const projectDir = process.env.CLAUDE_PROJECT_DIR || input.cwd || process.cwd();

  if (mode === 'pre-tool') {
    const reason = checkToolUse(projectDir, input.tool_name, input.tool_input);
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
    markDirty(projectDir, input.tool_input);
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

  process.stderr.write(`gates.mjs: unknown mode "${mode}"\n`);
  process.exit(1);
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  main();
}
