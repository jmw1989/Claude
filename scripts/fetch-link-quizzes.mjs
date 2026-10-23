// Saves the latest BBC News, BBC Sport, The Week and The National weekly quizzes (links and
// details, not questions) to ../data/<source>. Run by .github/workflows/joe-quiz.yml.
// Usage: node fetch-link-quizzes.mjs [source ...]
import { mkdir, writeFile } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { get, readJson } from './fetch-page.mjs';
import { LINK_SOURCES, listQuizLinks, parseArticleMeta } from './link-quizzes.mjs';

const HERE = dirname(fileURLToPath(import.meta.url));
const KEEP = 20;

async function update(key, source) {
  const dir = join(HERE, '..', 'data', key);
  await mkdir(dir, { recursive: true });
  const indexPath = join(dir, 'index.json');
  const index = await readJson(indexPath, { quizzes: [] });
  const known = new Map(index.quizzes.map((q) => [q.id, q]));

  const { html, finalUrl } = await get(source.listUrl);
  const listed = listQuizLinks(html, finalUrl, source).slice(0, KEEP);
  if (!listed.length) throw new Error(`No quizzes found on ${source.listUrl}`);

  const quizzes = [];
  for (const item of listed) {
    if (known.has(item.id)) {
      quizzes.push(known.get(item.id));
      continue;
    }
    let details = {};
    try {
      const page = (await get(item.url)).html;
      details = parseArticleMeta(page);
      if (source.embed) details.embedUrl = source.embed(page);
    } catch (err) {
      console.warn(`Couldn't read ${item.url}: ${err.message}`);
    }
    quizzes.push({ ...item, ...details, title: details.title || item.title });
    console.log(`[${key}] new quiz: ${quizzes.at(-1).title}`);
  }
  // Keep older saved quizzes that have dropped off the listing page.
  for (const q of index.quizzes) if (!quizzes.some((x) => x.id === q.id)) quizzes.push(q);
  quizzes.sort((a, b) => (b.publishedAt || '').localeCompare(a.publishedAt || ''));
  await writeFile(indexPath, JSON.stringify({ updatedAt: new Date().toISOString(), quizzes: quizzes.slice(0, KEEP) }, null, 2) + '\n');
  console.log(`[${key}] latest: ${quizzes[0].title} (${quizzes[0].publishedAt})`);
}

const wanted = process.argv.slice(2);
let failed = 0;
for (const [key, source] of Object.entries(LINK_SOURCES)) {
  if (wanted.length && !wanted.includes(key)) continue;
  try {
    await update(key, source);
  } catch (err) {
    failed++;
    console.error(`::warning::[${key}] ${err.message}`);
  }
}
process.exit(failed ? 1 : 0);
