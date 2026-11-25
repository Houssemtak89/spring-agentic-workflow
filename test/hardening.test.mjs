import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawnSync, execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import {
  checkToolUse, handlePrompt, readApprovals, activeTicket, deriveState, shellWrites,
  pluginAgent, globToRegExp, markDirtyAfterShell, qualityState, describe,
} from '../hooks/gates.mjs';

const GATES_SCRIPT = path.join(path.dirname(fileURLToPath(import.meta.url)), '..', 'hooks', 'gates.mjs');
const FULL = ['01-understanding.md', '02-functional-questions.md', '03-technical-plan.md', '04-implementation-plan.md'];

function project({ files = [], approve = [], tasks = null, settings = null } = {}) {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'saw-'));
  assert.equal(handlePrompt(dir, '/ticket PET-1 Vets cannot be double booked').ok, true);
  const t = path.join(dir, 'docs', 'tickets', 'PET-1');
  for (const f of files) fs.writeFileSync(path.join(t, f), '# x\n');
  if (tasks) fs.writeFileSync(path.join(t, '04-tasks.json'), JSON.stringify({ tasks }));
  if (settings) {
    fs.mkdirSync(path.join(dir, '.claude'), { recursive: true });
    fs.writeFileSync(path.join(dir, '.claude', 'spring-agentic-workflow.json'), JSON.stringify(settings));
  }
  for (const g of approve) assert.equal(handlePrompt(dir, `/approve ${g}`).ok, true, g);
  return { dir, t };
}

const bash = (dir, command, agentType) => checkToolUse(dir, 'Bash', { command }, { agentType });
const write = (dir, file, agentType) => checkToolUse(dir, 'Write', { file_path: path.join(dir, file) }, { agentType });

test('/ticket is recorded by the hook: active ticket, folder and state', () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'saw-'));
  const r = handlePrompt(dir, '/spring-agentic-workflow:ticket PET-7 some text');
  assert.equal(r.ok, true);
  assert.match(r.message, /started ticket PET-7/);
  assert.equal(activeTicket(dir), 'PET-7');
  const state = JSON.parse(fs.readFileSync(path.join(dir, 'docs', 'tickets', 'PET-7', 'state.json'), 'utf8'));
  assert.equal(state.step, 1);
  assert.match(handlePrompt(dir, '/ticket PET-7').message, /resumed/);
  assert.equal(handlePrompt(dir, '/ticket ../../etc').ok, false);
  assert.equal(handlePrompt(dir, '/ticket').ok, false);
  assert.equal(handlePrompt(dir, '/ticket-status'), null);
  assert.equal(handlePrompt(dir, '/ticket --off').ok, true);
  assert.equal(activeTicket(dir), null);
});

test('Claude cannot write the active ticket or state.json', () => {
  const { dir } = project();
  assert.match(write(dir, 'docs/tickets/.active'), /written by the plugin/);
  assert.match(write(dir, 'docs/tickets/PET-1/state.json'), /written by the plugin/);
  assert.match(bash(dir, 'echo PET-2 > docs/tickets/.active'), /written by the plugin/);
  assert.equal(bash(dir, 'cat docs/tickets/PET-1/state.json'), null);
});

test('the step is derived from approvals and files, not from what Claude says', () => {
  const { dir, t } = project();
  assert.equal(deriveState(dir, 'PET-1').step, 1);
  fs.writeFileSync(path.join(t, '01-understanding.md'), 'x');
  assert.equal(deriveState(dir, 'PET-1').step, 2);
  fs.writeFileSync(path.join(t, '02-functional-questions.md'), 'x');
  handlePrompt(dir, '/approve functional');
  assert.equal(deriveState(dir, 'PET-1').step, 3);
  fs.writeFileSync(path.join(t, '03-technical-plan.md'), 'x');
  handlePrompt(dir, '/approve technical');
  assert.equal(deriveState(dir, 'PET-1').step, 4);
  fs.writeFileSync(path.join(t, '04-implementation-plan.md'), 'x');
  assert.equal(deriveState(dir, 'PET-1').step, 5);
  handlePrompt(dir, '/approve go');
  assert.equal(deriveState(dir, 'PET-1').step, 6);
  assert.match(describe(dir), /ticket PET-1 is active \(full path\), step 6/);
});

test('shell writes are recognised', () => {
  const found = (c) => shellWrites(c).map((w) => w.path || w.what);
  assert.deepEqual(found('./mvnw -q -DskipTests compile 2>&1 | tail -20'), []);
  assert.deepEqual(found('git log --oneline -5 && git diff main...HEAD'), []);
  assert.deepEqual(found('grep -rn "->" src 2>/dev/null'), ['/dev/null']);
  assert.deepEqual(found('echo x > src/A.java'), ['src/A.java']);
  assert.deepEqual(found('cat a | tee -a "src/B.java"'), ['src/B.java']);
  assert.deepEqual(found('rm -rf src/main && mkdir -p docs/x'), ['src/main', 'docs/x']);
  assert.deepEqual(found("sed -i 's/a/b/' src/A.java"), ['sed -i']);
  assert.deepEqual(found('git stash'), ['git stash']);
  assert.deepEqual(found('node -e "process.exit(0)"'), ['node with inline code']);
  assert.deepEqual(found('Set-Content -Path src/A.java -Value x'), ['Set-Content']);
});

test('before go, the shell cannot write code either', () => {
  const { dir } = project();
  assert.match(bash(dir, 'echo "class A {}" > src/main/java/A.java'), /locked until.*approve go/s);
  assert.match(bash(dir, "sed -i 's/a/b/' src/A.java"), /sed -i/);
  assert.match(bash(dir, 'git apply fix.patch'), /git apply/);
  assert.match(checkToolUse(dir, 'PowerShell', { command: 'Set-Content src/A.java x' }), /Set-Content/);
  assert.equal(bash(dir, './mvnw -q dependency:tree'), null);
  assert.equal(bash(dir, 'git log --oneline | head -5'), null);
  assert.equal(bash(dir, 'mkdir -p docs/adr && echo x > docs/adr/0004.md'), null);
  assert.equal(bash(dir, `echo x > ${path.join(os.tmpdir(), 'scratch.txt').replace(/\\/g, '/')}`), null);
});

test('after go, the main session may use the shell freely', () => {
  const { dir } = project({ files: FULL, approve: ['functional', 'technical', 'go'] });
  assert.equal(bash(dir, 'echo x > src/A.java'), null);
  assert.equal(bash(dir, 'git commit -m PET-1'), null);
});

test('agent names: plugin agents only', () => {
  assert.equal(pluginAgent('spring-agentic-workflow:developer'), 'developer');
  assert.equal(pluginAgent('developer'), 'developer');
  assert.equal(pluginAgent('other-plugin:developer'), null);
  assert.equal(pluginAgent('Explore'), null);
  assert.equal(pluginAgent(undefined), null);
});

test('read-only agents cannot write, by tool or by shell', () => {
  const { dir } = project({ files: FULL, approve: ['functional', 'technical', 'go'] });
  for (const a of ['spring-agentic-workflow:analyst', 'spring-agentic-workflow:architect']) {
    assert.match(write(dir, 'src/A.java', a), /read-only/);
    assert.match(write(dir, 'docs/tickets/PET-1/01-understanding.md', a), /read-only/);
    assert.match(bash(dir, 'echo x > docs/notes.md', a), /read-only/);
    assert.equal(bash(dir, 'git log -3 && ./mvnw -q dependency:tree', a), null);
  }
});

test('the technical reviewer writes only its findings', () => {
  const { dir } = project({ files: FULL, approve: ['functional', 'technical', 'go'] });
  const a = 'spring-agentic-workflow:technical-reviewer';
  assert.equal(write(dir, 'docs/tickets/PET-1/06-log/review-security.md', a), null);
  assert.match(write(dir, 'src/A.java', a), /only writes its findings/);
  assert.match(write(dir, 'docs/adr/0001.md', a), /only writes its findings/);
  assert.match(bash(dir, 'rm src/A.java', a), /read-only/);
});

test('the functional reviewer writes documentation, never code', () => {
  const { dir } = project({ files: FULL, approve: ['functional', 'technical', 'go'], settings: { specsPath: 'specs' } });
  const a = 'spring-agentic-workflow:functional-reviewer';
  assert.equal(write(dir, 'docs/functional/appointments.md', a), null);
  assert.equal(write(dir, 'specs/appointments.md', a), null);
  assert.match(write(dir, 'src/A.java', a), /does not change code/);
  assert.match(write(dir, 'docs/tickets/PET-1/approvals.json', a), /\/approve/);
});

test('developer and test engineer are held to the files their tasks own', () => {
  const tasks = [
    { id: 'T1', agent: 'developer', owns: ['src/main/java/app/domain/**', 'src/main/resources/db/migration/V7__slot.sql'] },
    { id: 'T2', agent: 'test-engineer', owns: ['src/test/java/app/'] },
  ];
  const { dir } = project({ files: FULL, approve: ['functional', 'technical', 'go'], tasks });
  const dev = 'spring-agentic-workflow:developer';
  const tst = 'spring-agentic-workflow:test-engineer';
  assert.equal(write(dir, 'src/main/java/app/domain/model/Slot.java', dev), null);
  assert.equal(write(dir, 'src/main/resources/db/migration/V7__slot.sql', dev), null);
  assert.match(write(dir, 'src/test/java/app/SlotTest.java', dev), /not owned by a developer task/);
  assert.match(write(dir, 'src/main/java/app/web/VetController.java', dev), /not owned/);
  assert.equal(write(dir, 'src/test/java/app/SlotTest.java', tst), null);
  assert.match(write(dir, 'src/main/java/app/domain/model/Slot.java', tst), /not owned/);
  assert.equal(write(dir, 'docs/tickets/PET-1/06-log/T1.md', dev), null);
  assert.match(write(dir, 'docs/tickets/PET-1/04-implementation-plan.md', dev), /not other documents/);
  assert.match(bash(dir, 'echo x > src/main/java/app/web/VetController.java', dev), /Edit or Write/);
  assert.equal(bash(dir, './mvnw -q -DskipTests compile', dev), null);
  // the main session is not an agent of the plugin: it writes the contracts (T0) and the fixes
  assert.equal(write(dir, 'src/main/java/app/web/VetController.java'), null);
});

test('without a task table (fast path) the agents follow the gates alone', () => {
  const { dir } = project({ files: FULL, approve: ['functional', 'technical', 'go'] });
  assert.equal(write(dir, 'src/A.java', 'spring-agentic-workflow:developer'), null);
  const before = project();
  assert.match(write(before.dir, 'src/A.java', 'spring-agentic-workflow:developer'), /approve go/);
});

test('globs', () => {
  assert.equal(globToRegExp('src/**').test('src/a/b/C.java'), true);
  assert.equal(globToRegExp('src/*.java').test('src/a/C.java'), false);
  assert.equal(globToRegExp('src/a/').test('src/a/b/C.java'), true);
  assert.equal(globToRegExp('src/A.java').test('src/AxJava'), false);
});

test('fast path: one approval for the first three gates, chosen by the developer', () => {
  const { dir, t } = project();
  assert.match(handlePrompt(dir, '/approve fast').message, /01-understanding\.md/);
  fs.writeFileSync(path.join(t, '01-understanding.md'), 'x');
  assert.match(handlePrompt(dir, '/approve fast').message, /02-fast-plan\.md/);
  assert.equal(write(dir, 'docs/tickets/PET-1/02-fast-plan.md'), null);
  fs.writeFileSync(path.join(t, '02-fast-plan.md'), 'x');
  assert.match(write(dir, 'src/A.java'), /approve go/);
  const r = handlePrompt(dir, '/approve fast small fix');
  assert.equal(r.ok, true);
  const a = readApprovals(dir, 'PET-1');
  assert.equal(a.go.via, 'fast');
  assert.equal(a.fast.note, 'small fix');
  assert.equal(write(dir, 'src/A.java'), null);
  const s = deriveState(dir, 'PET-1');
  assert.equal(s.path, 'fast');
  assert.equal(s.step, 6);
  assert.match(handlePrompt(dir, '/approve merge').message, /08-review\.md/);
});

test('fast path is refused once the normal gates have started', () => {
  const { dir, t } = project({ files: ['01-understanding.md', '02-functional-questions.md'], approve: ['functional'] });
  fs.writeFileSync(path.join(t, '02-fast-plan.md'), 'x');
  assert.equal(handlePrompt(dir, '/approve fast').ok, false);
});

test('after merge the retro is the last step, then the ticket closes', () => {
  const { dir, t } = project({ files: [...FULL, '08-review.md'], approve: ['functional', 'technical', 'go'] });
  assert.match(write(dir, 'docs/tickets/PET-1/10-retro.md'), /"merge"/);
  fs.writeFileSync(path.join(t, '07-quality-gates.json'), JSON.stringify({ passed: true }));
  assert.equal(handlePrompt(dir, '/approve merge').ok, true);
  assert.equal(deriveState(dir, 'PET-1').step, 10);
  assert.equal(write(dir, 'docs/tickets/PET-1/10-retro.md'), null);
  fs.writeFileSync(path.join(t, '10-retro.md'), 'x');
  const post = spawnSync('node', [GATES_SCRIPT, 'post-tool'], {
    input: JSON.stringify({ tool_name: 'Write', tool_input: { file_path: path.join(t, '10-retro.md') } }),
    env: { ...process.env, CLAUDE_PROJECT_DIR: dir }, encoding: 'utf8',
  });
  assert.equal(post.status, 0);
  assert.equal(activeTicket(dir), null);
  assert.equal(JSON.parse(fs.readFileSync(path.join(t, 'state.json'), 'utf8')).step, 'done');
});

test('a shell command that changes code after go marks the ticket dirty', () => {
  const { dir, t } = project({ files: FULL });
  const git = (...args) => execFileSync('git', args, { cwd: dir, stdio: 'ignore' });
  try {
    git('init', '-q');
    git('-c', 'user.email=t@t', '-c', 'user.name=t', 'commit', '-q', '--allow-empty', '-m', 'init');
  } catch {
    return; // git is not available here
  }
  fs.mkdirSync(path.join(dir, 'src'));
  fs.writeFileSync(path.join(dir, 'src', 'A.java'), 'class A {}\n');
  for (const g of ['functional', 'technical', 'go']) handlePrompt(dir, `/approve ${g}`);
  assert.equal(fs.existsSync(path.join(t, '.snapshot')), true);
  assert.equal(markDirtyAfterShell(dir, './mvnw test'), false);
  fs.writeFileSync(path.join(dir, 'docs', 'notes.md'), 'doc only\n');
  assert.equal(markDirtyAfterShell(dir, 'echo x > docs/notes.md'), false);
  fs.writeFileSync(path.join(dir, 'src', 'B.java'), 'class B {}\n');
  assert.equal(markDirtyAfterShell(dir, 'cp src/A.java src/B.java'), true);
  assert.equal(fs.existsSync(path.join(t, '.dirty')), true);
  // the quality script refreshes the fingerprint without marking the ticket dirty
  fs.rmSync(path.join(t, '.dirty'));
  fs.writeFileSync(path.join(dir, 'src', 'C.java'), 'class C {}\n');
  assert.equal(markDirtyAfterShell(dir, 'node "/plugin/skills/quality-gates/run.mjs"'), false);
  assert.equal(markDirtyAfterShell(dir, './mvnw test'), false);
  fs.writeFileSync(path.join(t, '07-quality-gates.json'), JSON.stringify({ passed: true }));
  assert.equal(qualityState(dir, 'PET-1').passed, true);
});

test('session start puts the active ticket back in the context', () => {
  const { dir } = project({ files: ['01-understanding.md'] });
  const env = { ...process.env, CLAUDE_PROJECT_DIR: dir };
  const s = spawnSync('node', [GATES_SCRIPT, 'session'], { input: JSON.stringify({ source: 'compact' }), env, encoding: 'utf8' });
  assert.equal(s.status, 0);
  assert.match(s.stdout, /ticket PET-1 is active \(full path\), step 2/);
  const none = fs.mkdtempSync(path.join(os.tmpdir(), 'saw-'));
  const quiet = spawnSync('node', [GATES_SCRIPT, 'session'], { input: '{}', env: { ...process.env, CLAUDE_PROJECT_DIR: none }, encoding: 'utf8' });
  assert.equal(quiet.stdout, '');
  const status = spawnSync('node', [GATES_SCRIPT, 'status'], { env: { ...process.env, CLAUDE_PROJECT_DIR: none }, encoding: 'utf8' });
  assert.match(status.stdout, /no ticket is active/);
});

test('hook protocol: the agent type of the caller is read from the input', () => {
  const { dir } = project({ files: FULL, approve: ['functional', 'technical', 'go'] });
  const pre = spawnSync('node', [GATES_SCRIPT, 'pre-tool'], {
    input: JSON.stringify({ tool_name: 'Write', tool_input: { file_path: path.join(dir, 'src', 'A.java') }, agent_type: 'spring-agentic-workflow:analyst' }),
    env: { ...process.env, CLAUDE_PROJECT_DIR: dir }, encoding: 'utf8',
  });
  assert.match(JSON.parse(pre.stdout).hookSpecificOutput.permissionDecisionReason, /read-only/);
});

test('Claude cannot run the gate script to approve for the developer', () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'saw-'));
  const self = `echo '{"prompt":"/approve go"}' | node "/plugins/saw/hooks/gates.mjs" prompt`;
  assert.match(bash(dir, self), /only be asked for the status/);
  assert.match(bash(dir, `node -e "import('/plugins/saw/hooks/gates.mjs')"`), /only be asked for the status/);
  assert.equal(bash(dir, 'node "/plugins/saw/hooks/gates.mjs" status'), null);
});
