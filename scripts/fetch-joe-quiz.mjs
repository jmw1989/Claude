// Finds the latest JOE Friday Pub Quiz, converts it to JSON and saves it in
// ../data/joe so the app can play it. Run by .github/workflows/joe-quiz.yml.
//
// Usage: node fetch-joe-quiz.mjs [--url <quiz page url>] [--force]
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { findWeeklyQuizLinks, parseQuizPage, weekFromUrl } from './joe-parser.mjs';

const HERE = dirname(fileURLToPath(import.meta.url));
const DATA_DIR = join(HERE, '..', 'data', 'joe');
const DEBUG_DIR = join(HERE, 'debug');

const LISTING_PAGES = [
  'https://www.joe.co.uk/quiz',
  'https://www.joe.ie/quiz',
  'https://www.joe.co.uk/',
  'https://www.joe.ie/',
];

const HEADERS = {
  'User-Agent':
    'Mozilla/5.0 (iPhone; CPU iPhone OS 17_5 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.5 Mobile/15E148 Safari/604.1',
  Accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
  'Accept-Language': 'en-GB,en;q=0.9',
};

function parseArgs(argv) {
  const args = { url: null, force: false };
  for (let i = 0; i < argv.length; i++) {
    if (argv[i] === '--url') args.url = argv[++i] || null;
    else if (argv[i] === '--force') args.force = true;
  }
  return args;
}

async function get(url) {
  const res = await fetch(url, { headers: HEADERS, redirect: 'follow' });
  if (!res.ok) throw new Error(`${url} -> HTTP ${res.status}`);
  return { html: await res.text(), finalUrl: res.url || url };
}

async function readJson(path, fallback) {
  try {
    return JSON.parse(await readFile(path, 'utf8'));
  } catch {
    return fallback;
  }
}

async function findLatest() {
  const errors = [];
  let best = null;
  for (const page of LISTING_PAGES) {
    try {
      const { html, finalUrl } = await get(page);
      const links = findWeeklyQuizLinks(html, finalUrl);
      console.log(`${page}: found ${links.length} weekly quiz link(s)${links[0] ? `, newest week ${links[0].week}` : ''}`);
      if (links[0] && (!best || links[0].week > best.week)) best = links[0];
      if (best && page.includes('/quiz')) break; // the quiz hub is authoritative
    } catch (err) {
      errors.push(err.message);
      console.warn(`Could not read ${page}: ${err.message}`);
    }
  }
  if (!best) throw new Error(`No JOE Friday Pub Quiz link found. ${errors.join('; ')}`);
  return best;
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  await mkdir(DATA_DIR, { recursive: true });

  const target = args.url ? { url: args.url, week: weekFromUrl(args.url) } : await findLatest();
  const indexPath = join(DATA_DIR, 'index.json');
  const index = await readJson(indexPath, { quizzes: [] });
  const existing = index.quizzes.find((q) => q.week === target.week);
  if (existing && existing.status === 'ok' && !args.force) {
    console.log(`Week ${target.week} is already saved (${existing.count} questions). Nothing to do.`);
    return;
  }

  console.log(`Fetching week ${target.week ?? '?'}: ${target.url}`);
  const { html, finalUrl } = await get(target.url);
  const parsed = parseQuizPage(html, finalUrl);
  const week = target.week ?? weekFromUrl(finalUrl) ?? weekFromUrl(parsed.title);
  const ok = parsed.questions.length > 0;

  const quiz = {
    source: 'JOE',
    week,
    title: parsed.title || `The JOE Friday Pub Quiz: week ${week}`,
    description: parsed.description,
    url: finalUrl,
    image: parsed.image,
    publishedAt: parsed.publishedAt,
    fetchedAt: new Date().toISOString(),
    status: ok ? 'ok' : 'link-only',
    parser: parsed.strategy,
    questions: parsed.questions,
  };

  if (!ok) {
    // Keep the page so the parser can be fixed; the app still links to JOE.
    await mkdir(DEBUG_DIR, { recursive: true });
    await writeFile(join(DEBUG_DIR, `week-${week}.html`), html);
    console.warn(`::warning::Found week ${week} but could not read its questions. The app will link to the quiz on JOE instead.`);
  } else {
    console.log(`Parsed ${quiz.questions.length} questions using the ${parsed.strategy} strategy.`);
  }

  const file = `week-${week}.json`;
  await writeFile(join(DATA_DIR, file), JSON.stringify(quiz, null, 2) + '\n');
  await writeFile(join(DATA_DIR, 'latest.json'), JSON.stringify(quiz, null, 2) + '\n');

  const entry = { week, title: quiz.title, file, status: quiz.status, count: quiz.questions.length, publishedAt: quiz.publishedAt, url: quiz.url };
  index.quizzes = [entry, ...index.quizzes.filter((q) => q.week !== week)].sort((a, b) => b.week - a.week);
  index.updatedAt = quiz.fetchedAt;
  await writeFile(indexPath, JSON.stringify(index, null, 2) + '\n');
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
