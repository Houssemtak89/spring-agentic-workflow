#!/usr/bin/env node
// Step 7 checks: build and tests, JaCoCo line coverage, optional SonarCloud / SonarQube quality gate.
// Writes docs/tickets/<ID>/07-quality-gates.json and removes the ".dirty" marker when everything passes.
//
//   node run.mjs [--project <dir>]
//
// Settings, all optional, in <project>/.claude/spring-agentic-workflow.json:
//   { "coverageThreshold": 80, "buildCommand": "./mvnw -B verify", "sonar": true }

import fs from 'node:fs';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

export const DEFAULTS = { coverageThreshold: 80, buildCommand: null, sonar: false };

export function loadSettings(projectDir) {
  const f = path.join(projectDir, '.claude', 'spring-agentic-workflow.json');
  if (!fs.existsSync(f)) return { ...DEFAULTS };
  return { ...DEFAULTS, ...JSON.parse(fs.readFileSync(f, 'utf8')) };
}

export function detectBuild(projectDir, settings) {
  if (settings.buildCommand) return { tool: 'custom', command: settings.buildCommand };
  const win = process.platform === 'win32';
  const has = (f) => fs.existsSync(path.join(projectDir, f));
  if (has('pom.xml')) {
    const mvn = has('mvnw') ? (win ? 'mvnw.cmd' : './mvnw') : 'mvn';
    return { tool: 'maven', command: `${mvn} -B verify` };
  }
  if (has('build.gradle') || has('build.gradle.kts')) {
    const gradle = has('gradlew') ? (win ? 'gradlew.bat' : './gradlew') : 'gradle';
    return { tool: 'gradle', command: `${gradle} check jacocoTestReport` };
  }
  return null;
}

export function sonarCommand(build) {
  if (build.tool === 'maven') return build.command.replace(/ verify$/, ' sonar:sonar -Dsonar.qualitygate.wait=true');
  if (build.tool === 'gradle') return build.command.replace(/ check jacocoTestReport$/, ' sonar -Dsonar.qualitygate.wait=true');
  return null;
}

const JACOCO_REPORTS = [
  'target/site/jacoco/jacoco.csv',
  'build/reports/jacoco/test/jacocoTestReport.csv',
];

// Line coverage in percent from a JaCoCo CSV report, or null when the report is empty.
export function parseJacocoCsv(text) {
  const lines = text.trim().split(/\r?\n/);
  const header = lines.shift().split(',');
  const missedCol = header.indexOf('LINE_MISSED');
  const coveredCol = header.indexOf('LINE_COVERED');
  let missed = 0;
  let covered = 0;
  for (const line of lines) {
    const cells = line.split(',');
    missed += Number(cells[missedCol]) || 0;
    covered += Number(cells[coveredCol]) || 0;
  }
  const total = missed + covered;
  return total === 0 ? null : Math.round((covered / total) * 1000) / 10;
}

export function findCoverage(projectDir) {
  for (const rel of JACOCO_REPORTS) {
    const f = path.join(projectDir, rel);
    if (fs.existsSync(f)) return { report: rel, coverage: parseJacocoCsv(fs.readFileSync(f, 'utf8')) };
  }
  return { report: null, coverage: null };
}

function sh(command, cwd) {
  const r = spawnSync(command, { cwd, shell: true, encoding: 'utf8', maxBuffer: 64 * 1024 * 1024 });
  const out = `${r.stdout || ''}${r.stderr || ''}`;
  return { ok: r.status === 0, tail: out.split(/\r?\n/).slice(-40).join('\n') };
}

export function runQualityGates(projectDir, now = new Date()) {
  const id = (fs.readFileSync(path.join(projectDir, 'docs', 'tickets', '.active'), 'utf8') || '').trim();
  if (!id) throw new Error('No active ticket in docs/tickets/.active');
  const ticketDir = path.join(projectDir, 'docs', 'tickets', id);
  const settings = loadSettings(projectDir);
  const build = detectBuild(projectDir, settings);
  const checks = [];

  if (!build) {
    checks.push({ name: 'build', passed: false, detail: 'No pom.xml or build.gradle found, and no buildCommand set.' });
  } else {
    const b = sh(build.command, projectDir);
    checks.push({ name: 'build and tests', command: build.command, passed: b.ok, detail: b.ok ? 'ok' : b.tail });

    const { report, coverage } = findCoverage(projectDir);
    if (coverage === null) {
      checks.push({ name: 'coverage', passed: false, detail: 'No JaCoCo CSV report found. Add the JaCoCo plugin (templates/jacoco).' });
    } else {
      checks.push({
        name: 'coverage',
        passed: coverage >= settings.coverageThreshold,
        detail: `${coverage}% of lines covered (threshold ${settings.coverageThreshold}%), from ${report}`,
      });
    }

    if (settings.sonar) {
      const cmd = sonarCommand(build);
      if (!process.env.SONAR_TOKEN || !cmd) {
        checks.push({ name: 'sonar', passed: false, detail: 'sonar is on but SONAR_TOKEN is not set, or the build tool is custom.' });
      } else {
        const s = sh(cmd, projectDir);
        checks.push({ name: 'sonar quality gate', command: cmd, passed: s.ok, detail: s.ok ? 'quality gate passed' : s.tail });
      }
    }
  }

  const passed = checks.every((c) => c.passed);
  const result = { ticket: id, at: now.toISOString(), passed, checks };
  fs.mkdirSync(ticketDir, { recursive: true });
  fs.writeFileSync(path.join(ticketDir, '07-quality-gates.json'), JSON.stringify(result, null, 2) + '\n');
  if (passed) fs.rmSync(path.join(ticketDir, '.dirty'), { force: true });
  return result;
}

function main() {
  const i = process.argv.indexOf('--project');
  const projectDir = i > 0 ? process.argv[i + 1] : (process.env.CLAUDE_PROJECT_DIR || process.cwd());
  const result = runQualityGates(projectDir);
  for (const c of result.checks) {
    process.stdout.write(`${c.passed ? 'PASS' : 'FAIL'}  ${c.name}: ${c.passed ? c.detail : ''}\n`);
    if (!c.passed) process.stdout.write(c.detail.replace(/^/gm, '      ') + '\n');
  }
  process.stdout.write(result.passed ? 'All quality gates passed.\n' : 'Quality gates failed. Fix and run again.\n');
  process.exit(result.passed ? 0 : 1);
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  main();
}
