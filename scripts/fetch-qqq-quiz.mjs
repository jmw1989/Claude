// Saves this week's QuizQuizQuiz Friday Quiz questions to ../data/qqq so the app can show them.
// Run by .github/workflows/joe-quiz.yml.
import { mkdir, writeFile } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describePage } from './describe-page.mjs';
import { get, readJson } from './fetch-page.mjs';
import { parseQqqPage } from './qqq-parser.mjs';

const HERE = dirname(fileURLToPath(import.meta.url));
const DATA_DIR = join(HERE, '..', 'data', 'qqq');
const PAGE_URL = 'https://quizquizquiz.com/friday/';

async function main() {
  await mkdir(DATA_DIR, { recursive: true });
  const { html, via } = await get(PAGE_URL);
  const parsed = parseQqqPage(html, PAGE_URL);
  if (!parsed?.quizId || !parsed.questions.length) {
    console.log(`::group::Page outline (via ${via})\n${describePage(html)}\n::endgroup::`);
    throw new Error('Could not find the quiz questions on the QuizQuizQuiz page.');
  }

  const indexPath = join(DATA_DIR, 'index.json');
  const index = await readJson(indexPath, { quizzes: [] });
  if (index.quizzes.some((q) => q.quizId === parsed.quizId)) {
    console.log(`Quiz ${parsed.quizId} (${parsed.title}) is already saved. Nothing to do.`);
    return;
  }

  const quiz = { source: 'QuizQuizQuiz', url: PAGE_URL, fetchedAt: new Date().toISOString(), fetchedVia: via, ...parsed };
  const file = `quiz-${parsed.quizId}.json`;
  await writeFile(join(DATA_DIR, file), JSON.stringify(quiz, null, 2) + '\n');
  await writeFile(join(DATA_DIR, 'latest.json'), JSON.stringify(quiz, null, 2) + '\n');
  index.quizzes = [{ quizId: parsed.quizId, title: parsed.title, file, count: parsed.questions.length }, ...index.quizzes];
  index.updatedAt = quiz.fetchedAt;
  await writeFile(indexPath, JSON.stringify(index, null, 2) + '\n');
  console.log(`Saved ${parsed.title}: ${parsed.questions.length} questions (quiz ${parsed.quizId}).`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
