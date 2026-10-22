// Saves the latest BBC News weekly quizzes (links and details, not questions) to ../data/bbc.
// Run by .github/workflows/joe-quiz.yml.
import { mkdir, writeFile } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { BBC_TOPIC_URL, parseBbcArticle, parseBbcTopic } from './bbc-parser.mjs';
import { get, readJson } from './fetch-page.mjs';

const HERE = dirname(fileURLToPath(import.meta.url));
const DATA_DIR = join(HERE, '..', 'data', 'bbc');
const KEEP = 20;

async function main() {
  await mkdir(DATA_DIR, { recursive: true });
  const indexPath = join(DATA_DIR, 'index.json');
  const index = await readJson(indexPath, { quizzes: [] });
  const known = new Map(index.quizzes.map((q) => [q.id, q]));

  const listed = parseBbcTopic((await get(BBC_TOPIC_URL)).html).slice(0, KEEP);
  if (!listed.length) throw new Error('No quizzes found on the BBC Quizzes of the Week page.');

  const quizzes = [];
  for (const item of listed) {
    if (known.has(item.id)) {
      quizzes.push(known.get(item.id));
      continue;
    }
    let details = {};
    try {
      details = parseBbcArticle((await get(item.url)).html);
    } catch (err) {
      console.warn(`Couldn't read ${item.url}: ${err.message}`);
    }
    quizzes.push({ ...item, ...details, title: details.title || item.title });
    console.log(`New BBC quiz: ${quizzes.at(-1).title}`);
  }
  // Keep older saved quizzes that have dropped off the topic page.
  for (const q of index.quizzes) if (!quizzes.some((x) => x.id === q.id)) quizzes.push(q);
  quizzes.sort((a, b) => (b.publishedAt || '').localeCompare(a.publishedAt || ''));

  await writeFile(indexPath, JSON.stringify({ updatedAt: new Date().toISOString(), quizzes: quizzes.slice(0, KEEP) }, null, 2) + '\n');
  console.log(`Latest BBC quiz: ${quizzes[0].title} (${quizzes[0].publishedAt})`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
