#!/usr/bin/env node
// Builds the review knowledge base from past pull request review comments.
//
//   node build-review-kb.mjs [owner/repo] [--limit 1000] [--project <dir>]
//
// Reads the inline review comments of the repository with the GitHub CLI (`gh api`), drops author
// names, groups the comments by theme and writes docs/review-kb/review-comments.md and .json.
// The step 8 reviewer reads these files to check new code against what the team already asked for.

import fs from 'node:fs';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

// First matching theme wins, so the most specific ones come first.
export const THEMES = [
  ['Transactions and concurrency', /transaction|@transactional|rollback|lock|concurren|race|idempot/i],
  ['JPA and SQL', /\bjpa\b|hibernate|n\+1|lazy|fetch|query|index|repository|\bsql\b/i],
  ['Security', /secur|auth|permission|role|inject|xss|csrf|secret|token|password/i],
  ['Personal data', /gdpr|rgpd|personal data|pii|anonymi|mask|email address|phone/i],
  ['Performance', /perf|slow|cache|n\^2|memory|stream|batch size|pagina/i],
  ['Errors and exceptions', /exception|error|catch|throw|optional|null/i],
  ['Logging', /\blog\b|logger|logging|log level/i],
  ['Tests', /test|assert|mock|coverage|testcontainers|junit/i],
  ['API contract', /endpoint|api|dto|status code|http|backward|breaking/i],
  ['Architecture', /domain|port|adapter|hexagonal|layer|depend|package|coupling/i],
  ['Naming and readability', /name|naming|rename|readab|clear|comment|duplicat|simplif|extract/i],
];

export function themeOf(body) {
  for (const [theme, re] of THEMES) if (re.test(body)) return theme;
  return 'Other';
}

// Keeps what helps a reviewer: the remark, the file type, the code it was about. No author.
export function normalise(comment) {
  const body = String(comment.body || '').replace(/\r/g, '').trim();
  if (body.length < 15) return null;
  if (/^(lgtm|\+1|thanks|ok|nit:?\s*$)/i.test(body)) return null;
  const hunk = String(comment.diff_hunk || '').split('\n').slice(-6).join('\n');
  return {
    theme: themeOf(body),
    file: path.extname(String(comment.path || '')) || 'other',
    remark: body.replace(/@[\w-]+/g, '@someone'),
    code: hunk,
    at: (comment.created_at || '').slice(0, 10),
  };
}

export function toMarkdown(entries, repo) {
  const byTheme = new Map();
  for (const e of entries) {
    if (!byTheme.has(e.theme)) byTheme.set(e.theme, []);
    byTheme.get(e.theme).push(e);
  }
  const themes = [...byTheme.keys()].sort((a, b) => byTheme.get(b).length - byTheme.get(a).length);
  let md = `# Review knowledge base\n\nBuilt from ${entries.length} review comments of ${repo}. Author names removed.\n`;
  md += `Rebuild it with \`node build-review-kb.mjs\` from the final-review skill.\n\n`;
  md += themes.map((t) => `- ${t}: ${byTheme.get(t).length}`).join('\n') + '\n';
  for (const t of themes) {
    md += `\n## ${t}\n`;
    for (const e of byTheme.get(t)) {
      md += `\n- (${e.file}, ${e.at}) ${e.remark.replace(/\n+/g, ' ')}\n`;
      if (e.code) md += '\n  ```\n' + e.code.replace(/^/gm, '  ') + '\n  ```\n';
    }
  }
  return md;
}

function currentRepo(projectDir) {
  return execFileSync('gh', ['repo', 'view', '--json', 'nameWithOwner', '-q', '.nameWithOwner'], {
    cwd: projectDir, encoding: 'utf8',
  }).trim();
}

function fetchComments(repo, limit, projectDir) {
  const out = execFileSync('gh', ['api', '--paginate', `repos/${repo}/pulls/comments?per_page=100`], {
    cwd: projectDir, encoding: 'utf8', maxBuffer: 256 * 1024 * 1024,
  });
  // --paginate concatenates JSON arrays: "][" between pages.
  const comments = JSON.parse(`[${out.trim().replace(/\]\s*\[/g, ',').replace(/^\[|\]$/g, '')}]`);
  return comments.slice(-limit);
}

function main() {
  const args = process.argv.slice(2);
  const opt = (name, dflt) => {
    const i = args.indexOf(name);
    return i >= 0 ? args.splice(i, 2)[1] : dflt;
  };
  const projectDir = opt('--project', process.env.CLAUDE_PROJECT_DIR || process.cwd());
  const limit = Number(opt('--limit', 1000));
  const repo = args[0] || currentRepo(projectDir);

  const entries = fetchComments(repo, limit, projectDir).map(normalise).filter(Boolean);
  const outDir = path.join(projectDir, 'docs', 'review-kb');
  fs.mkdirSync(outDir, { recursive: true });
  fs.writeFileSync(path.join(outDir, 'review-comments.json'), JSON.stringify(entries, null, 2) + '\n');
  fs.writeFileSync(path.join(outDir, 'review-comments.md'), toMarkdown(entries, repo));
  process.stdout.write(`${entries.length} review comments from ${repo} written to docs/review-kb/.\n`);
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  main();
}
