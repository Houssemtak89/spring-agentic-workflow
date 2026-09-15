import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { checkToolUse, checkStop, handlePrompt, markDirty, qualityState } from '../hooks/gates.mjs';
import { parseJacocoCsv, runQualityGates, sonarCommand, detectBuild, DEFAULTS } from '../skills/quality-gates/run.mjs';
import { normalise, themeOf, toMarkdown } from '../skills/final-review/build-review-kb.mjs';

const ALL_DOCS = ['02-functional-questions.md', '03-technical-plan.md', '04-implementation-plan.md', '08-review.md'];

function project({ step = 7, approve = ['functional', 'technical', 'go'] } = {}) {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'saw-'));
  const t = path.join(dir, 'docs', 'tickets', 'PET-1');
  fs.mkdirSync(t, { recursive: true });
  fs.writeFileSync(path.join(dir, 'docs', 'tickets', '.active'), 'PET-1\n');
  for (const f of ALL_DOCS) fs.writeFileSync(path.join(t, f), '# x\n');
  fs.writeFileSync(path.join(t, 'state.json'), JSON.stringify({ ticket: 'PET-1', step }));
  for (const g of approve) assert.equal(handlePrompt(dir, `/approve ${g}`).ok, true, g);
  return { dir, t };
}

const JACOCO = [
  'GROUP,PACKAGE,CLASS,INSTRUCTION_MISSED,INSTRUCTION_COVERED,BRANCH_MISSED,BRANCH_COVERED,LINE_MISSED,LINE_COVERED,COMPLEXITY_MISSED,COMPLEXITY_COVERED,METHOD_MISSED,METHOD_COVERED',
  'app,org.x,Vet,10,90,0,4,3,27,0,5,0,4',
  'app,org.x,Visit,0,50,0,0,2,18,0,3,0,3',
].join('\n');

function writeQualityProject(dir, coverageCsv, settings) {
  fs.mkdirSync(path.join(dir, 'target', 'site', 'jacoco'), { recursive: true });
  fs.writeFileSync(path.join(dir, 'target', 'site', 'jacoco', 'jacoco.csv'), coverageCsv);
  fs.mkdirSync(path.join(dir, '.claude'), { recursive: true });
  fs.writeFileSync(path.join(dir, '.claude', 'spring-agentic-workflow.json'), JSON.stringify(settings));
}

test('JaCoCo line coverage is read from the CSV report', () => {
  assert.equal(parseJacocoCsv(JACOCO), 90); // 45 covered lines out of 50
  assert.equal(parseJacocoCsv(JACOCO.split('\n')[0]), null);
});

test('build detection and the Sonar command', () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'saw-'));
  assert.equal(detectBuild(dir, DEFAULTS), null);
  fs.writeFileSync(path.join(dir, 'pom.xml'), '<project/>');
  const b = detectBuild(dir, DEFAULTS);
  assert.equal(b.tool, 'maven');
  assert.match(sonarCommand(b), /sonar:sonar -Dsonar.qualitygate.wait=true$/);
});

test('quality run: passes above the threshold and clears the dirty mark', () => {
  const { dir, t } = project();
  writeQualityProject(dir, JACOCO, { buildCommand: 'node -e "process.exit(0)"', coverageThreshold: 80 });
  fs.writeFileSync(path.join(t, '.dirty'), 'x');
  const r = runQualityGates(dir);
  assert.equal(r.passed, true);
  assert.equal(fs.existsSync(path.join(t, '.dirty')), false);
  assert.equal(qualityState(dir, 'PET-1').passed, true);
});

test('quality run: fails under the threshold or when the build fails', () => {
  const { dir } = project();
  writeQualityProject(dir, JACOCO, { buildCommand: 'node -e "process.exit(0)"', coverageThreshold: 95 });
  assert.equal(runQualityGates(dir).passed, false);
  writeQualityProject(dir, JACOCO, { buildCommand: 'node -e "process.exit(3)"', coverageThreshold: 50 });
  const r = runQualityGates(dir);
  assert.equal(r.passed, false);
  assert.equal(r.checks[0].passed, false);
});

test('Claude cannot write the quality results itself', () => {
  const { dir, t } = project();
  assert.match(checkToolUse(dir, 'Write', { file_path: path.join(t, '07-quality-gates.json') }), /quality-gates script/);
  assert.match(checkToolUse(dir, 'Bash', { command: 'echo {} > docs/tickets/PET-1/07-quality-gates.json' }), /quality-gates script/);
  assert.match(checkToolUse(dir, 'Bash', { command: 'rm docs/tickets/PET-1/.dirty' }), /quality-gates script/);
});

test('a code change after go marks the ticket dirty, a doc change does not', () => {
  const { dir, t } = project();
  assert.equal(markDirty(dir, { file_path: path.join(dir, 'docs', 'tickets', 'PET-1', '06-agents-log.md') }), false);
  assert.equal(markDirty(dir, { file_path: path.join(dir, 'src', 'main', 'java', 'Vet.java') }), true);
  assert.equal(fs.existsSync(path.join(t, '.dirty')), true);
});

test('no dirty mark before go', () => {
  const { dir } = project({ step: 4, approve: ['functional', 'technical'] });
  assert.equal(markDirty(dir, { file_path: path.join(dir, 'src', 'Vet.java') }), false);
});

test('stop is blocked from step 7 while checks are missing, red or out of date', () => {
  const { dir, t } = project({ step: 7 });
  assert.match(checkStop(dir), /not run yet/);
  assert.equal(checkStop(dir, true), null); // never loop
  writeQualityProject(dir, JACOCO, { buildCommand: 'node -e "process.exit(0)"' });
  runQualityGates(dir);
  assert.equal(checkStop(dir), null);
  fs.writeFileSync(path.join(t, '.dirty'), 'x');
  assert.match(checkStop(dir), /code changed/);
});

test('stop is free during implementation (step 6) and before go', () => {
  assert.equal(checkStop(project({ step: 6 }).dir), null);
  assert.equal(checkStop(project({ step: 3, approve: ['functional'] }).dir), null);
});

test('merge needs a green quality run with no change since', () => {
  const { dir, t } = project({ step: 9 });
  assert.match(handlePrompt(dir, '/approve merge').message, /not run yet/);
  writeQualityProject(dir, JACOCO, { buildCommand: 'node -e "process.exit(0)"' });
  runQualityGates(dir);
  fs.writeFileSync(path.join(t, '.dirty'), 'x');
  assert.equal(handlePrompt(dir, '/approve merge').ok, false);
  runQualityGates(dir);
  assert.equal(handlePrompt(dir, '/approve merge').ok, true);
});

test('review knowledge base: themes, no author names, noise dropped', () => {
  assert.equal(themeOf('This loop triggers an N+1 query on visits'), 'JPA and SQL');
  assert.equal(themeOf('Please rename this, the name is unclear'), 'Naming and readability');
  assert.equal(normalise({ body: 'LGTM' }), null);
  const e = normalise({ body: '@alice this catch swallows the exception', path: 'src/Vet.java', created_at: '2026-01-02T00:00:00Z' });
  assert.equal(e.theme, 'Errors and exceptions');
  assert.equal(e.file, '.java');
  assert.doesNotMatch(e.remark, /alice/);
  const md = toMarkdown([e], 'owner/repo');
  assert.match(md, /## Errors and exceptions/);
  assert.doesNotMatch(md, /alice/);
});
