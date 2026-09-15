import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { checkToolUse, handlePrompt, readApprovals } from '../hooks/gates.mjs';

const GATES_SCRIPT = path.join(path.dirname(fileURLToPath(import.meta.url)), '..', 'hooks', 'gates.mjs');

function project({ active = 'PET-1', files = [] } = {}) {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'saw-'));
  const tickets = path.join(dir, 'docs', 'tickets');
  fs.mkdirSync(path.join(tickets, 'PET-1'), { recursive: true });
  if (active) fs.writeFileSync(path.join(tickets, '.active'), active + '\n');
  for (const f of files) fs.writeFileSync(path.join(tickets, 'PET-1', f), '# x\n');
  return dir;
}

const src = (dir) => ({ file_path: path.join(dir, 'src', 'main', 'java', 'Vet.java') });
const doc = (dir, name) => ({ file_path: path.join(dir, 'docs', 'tickets', 'PET-1', name) });

test('no active ticket: nothing is blocked', () => {
  const dir = project({ active: null });
  assert.equal(checkToolUse(dir, 'Write', src(dir)), null);
});

test('code is locked before /approve go, docs are not', () => {
  const dir = project();
  assert.match(checkToolUse(dir, 'Edit', src(dir)), /approve go/);
  assert.equal(checkToolUse(dir, 'Write', doc(dir, '01-understanding.md')), null);
  assert.equal(checkToolUse(dir, 'Write', { file_path: path.join(dir, 'docs', 'adr', '0004-x.md') }), null);
});

test('files outside the project are never blocked', () => {
  const dir = project();
  assert.equal(checkToolUse(dir, 'Write', { file_path: path.join(os.tmpdir(), 'scratch.txt') }), null);
});

test('ticket documents follow the gates', () => {
  const dir = project({ files: ['02-functional-questions.md'] });
  assert.match(checkToolUse(dir, 'Write', doc(dir, '03-technical-plan.md')), /functional/);
  handlePrompt(dir, '/approve functional');
  assert.equal(checkToolUse(dir, 'Write', doc(dir, '03-technical-plan.md')), null);
  assert.match(checkToolUse(dir, 'Write', doc(dir, '04-implementation-plan.md')), /technical/);
  assert.match(checkToolUse(dir, 'Write', doc(dir, '06-agents-log.md')), /"go"/);
});

test('Claude can never write approvals.json, by tool or by shell', () => {
  const dir = project();
  assert.match(checkToolUse(dir, 'Write', doc(dir, 'approvals.json')), /\/approve/);
  assert.match(checkToolUse(dir, 'Bash', { command: 'echo {} > docs/tickets/PET-1/approvals.json' }), /\/approve/);
});

test('no commit before go', () => {
  const dir = project();
  assert.match(checkToolUse(dir, 'Bash', { command: 'git commit -m x' }), /approve go/);
  assert.equal(checkToolUse(dir, 'Bash', { command: './mvnw test' }), null);
});

test('approvals must come in order and need their document', () => {
  const dir = project({ files: ['02-functional-questions.md', '03-technical-plan.md'] });
  assert.equal(handlePrompt(dir, '/spring-agentic-workflow:approve technical').ok, false);
  assert.equal(handlePrompt(dir, '/spring-agentic-workflow:approve functional ok for F1-F3').ok, true);
  assert.equal(handlePrompt(dir, '/approve technical').ok, true);
  const go = handlePrompt(dir, '/approve go');
  assert.equal(go.ok, false);
  assert.match(go.message, /04-implementation-plan\.md/);
  assert.equal(readApprovals(dir, 'PET-1').functional.note, 'ok for F1-F3');
});

test('after go, code can change and commits are allowed', () => {
  const dir = project({ files: ['02-functional-questions.md', '03-technical-plan.md', '04-implementation-plan.md'] });
  for (const g of ['functional', 'technical', 'go']) assert.equal(handlePrompt(dir, `/approve ${g}`).ok, true);
  assert.equal(checkToolUse(dir, 'Edit', src(dir)), null);
  assert.equal(checkToolUse(dir, 'Bash', { command: 'git commit -m "PET-1"' }), null);
});

test('other prompts and unknown gates', () => {
  const dir = project();
  assert.equal(handlePrompt(dir, 'please approve the plan'), null);
  assert.equal(handlePrompt(dir, '/approve everything').ok, false);
});

test('hook protocol: deny JSON on stdout, exit 2 on a refused approval', () => {
  const dir = project();
  const env = { ...process.env, CLAUDE_PROJECT_DIR: dir };
  const pre = spawnSync('node', [GATES_SCRIPT, 'pre-tool'], {
    input: JSON.stringify({ tool_name: 'Write', tool_input: src(dir) }), env, encoding: 'utf8',
  });
  assert.equal(pre.status, 0);
  assert.equal(JSON.parse(pre.stdout).hookSpecificOutput.permissionDecision, 'deny');

  const refused = spawnSync('node', [GATES_SCRIPT, 'prompt'], {
    input: JSON.stringify({ prompt: '/approve go' }), env, encoding: 'utf8',
  });
  assert.equal(refused.status, 2);
  assert.match(refused.stderr, /approve "technical" before "go"/);

  const other = spawnSync('node', [GATES_SCRIPT, 'prompt'], {
    input: JSON.stringify({ prompt: 'hello' }), env, encoding: 'utf8',
  });
  assert.equal(other.status, 0);
  assert.equal(other.stdout, '');
});
