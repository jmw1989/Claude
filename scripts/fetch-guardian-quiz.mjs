// Saves the Guardian's Saturday quizzes (questions and answers) to ../data/guardian.
// Run by .github/workflows/joe-quiz.yml.
import { mkdir, writeFile } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { get, readJson } from './fetch-page.mjs';
import { GUARDIAN_SERIES_URL, listGuardianQuizzes, parseGuardianQuiz } from './guardian-parser.mjs';

const HERE = dirname(fileURLToPath(import.meta.url));
const DATA_DIR = join(HERE, '..', 'data', 'guardian');
const KEEP = 20;

async function main() {
  await mkdir(DATA_DIR, { recursive: true });
  const indexPath = join(DATA_DIR, 'index.json');
  const index = await readJson(indexPath, { quizzes: [] });
  const known = new Set(index.quizzes.map((q) => q.id));

  const listed = listGuardianQuizzes((await get(GUARDIAN_SERIES_URL)).html).slice(0, 4);
  if (!listed.length) throw new Error('No quizzes found on the Guardian series page.');
  for (const item of listed) {
    if (known.has(item.id)) continue;
    const quiz = { ...item, ...parseGuardianQuiz((await get(item.url)).html) };
    if (quiz.questions.length < 5) {
      console.warn(`::warning::Only found ${quiz.questions.length} questions in ${item.url}; skipping it.`);
      continue;
    }
    index.quizzes.push(quiz);
    console.log(`Saved ${quiz.title}: ${quiz.questions.length} questions`);
  }
  index.quizzes.sort((a, b) => (b.publishedAt || '').localeCompare(a.publishedAt || ''));
  index.quizzes = index.quizzes.slice(0, KEEP);
  index.updatedAt = new Date().toISOString();
  await writeFile(indexPath, JSON.stringify(index, null, 2) + '\n');
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
