// Finds the latest JOE Friday Pub Quiz, converts it to JSON and saves it in
// ../data/joe so the app can play it. Run by .github/workflows/joe-quiz.yml.
//
// Usage: node fetch-joe-quiz.mjs [--url <quiz page url>] [--force]
import { mkdir, writeFile } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describePage } from './describe-page.mjs';
import { ROUTES, fetchText, get, readJson } from './fetch-page.mjs';
import { findQuizEmbeds, findWeeklyQuizLinks, parseQuizPage, weekFromUrl } from './joe-parser.mjs';

const HERE = dirname(fileURLToPath(import.meta.url));
const DATA_DIR = join(HERE, '..', 'data', 'joe');
const DEBUG_DIR = join(HERE, 'debug');

const LISTING_PAGES = [
  'https://www.joe.co.uk/quiz',
  'https://www.joe.ie/quiz',
  'https://www.joe.co.uk/',
  'https://www.joe.ie/',
];

// Search engines, used to discover the newest quiz link when JOE's own pages can't be read.
const SEARCHES = [
  'https://html.duckduckgo.com/html/?q=%22JOE+Friday+Pub+Quiz%22+week+site%3Ajoe.co.uk',
  'https://www.bing.com/search?q=%22The+JOE+Friday+Pub+Quiz%22+week+site%3Ajoe.co.uk&count=30',
];

function parseArgs(argv) {
  const args = { url: null, force: false };
  for (let i = 0; i < argv.length; i++) {
    if (argv[i] === '--url') args.url = argv[++i] || null;
    else if (argv[i] === '--force') args.force = true;
  }
  return args;
}

async function findLatest() {
  let best = null;
  const consider = (links, from) => {
    console.log(`${from}: found ${links.length} weekly quiz link(s)${links[0] ? `, newest week ${links[0].week}` : ''}`);
    if (links[0] && (!best || links[0].week > best.week)) best = links[0];
  };

  // The archive's copy of a listing page may be old, so it's only used as a last resort below.
  const liveRoutes = ROUTES.filter(([name]) => name !== 'wayback');
  for (const page of LISTING_PAGES) {
    try {
      const { html, finalUrl, via } = await get(page, { routes: liveRoutes });
      consider(findWeeklyQuizLinks(html, finalUrl), `${page} (via ${via})`);
      if (best && page.includes('/quiz')) return best; // the quiz hub is authoritative
    } catch (err) {
      console.warn(err.message);
    }
  }

  for (const search of SEARCHES) {
    try {
      const html = (await fetchText(search)).replace(/%2F/gi, '/').replace(/%3A/gi, ':');
      consider(findWeeklyQuizLinks(html, 'https://www.joe.co.uk/'), new URL(search).host);
    } catch (err) {
      console.warn(`Search ${new URL(search).host} failed: ${err.message}`);
    }
  }

  if (!best) {
    try {
      const { html } = await get(LISTING_PAGES[0], { routes: ROUTES.filter(([name]) => name === 'wayback') });
      consider(findWeeklyQuizLinks(html, LISTING_PAGES[0]), 'Internet Archive copy of the quiz hub');
    } catch (err) {
      console.warn(err.message);
    }
  }
  if (!best) throw new Error('No JOE Friday Pub Quiz link found (see the log above).');
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
  const { html, finalUrl, via } = await get(target.url);
  const parsed = parseQuizPage(html, finalUrl);
  const debugPages = [[`week-${target.week}`, html, via]];
  if (!parsed.questions.length) {
    for (const embedUrl of findQuizEmbeds(html, finalUrl)) {
      console.log(`Questions not in the article; trying embedded quiz ${embedUrl}`);
      try {
        const embed = await get(embedUrl);
        const fromEmbed = parseQuizPage(embed.html, embedUrl);
        if (fromEmbed.questions.length) {
          parsed.questions = fromEmbed.questions;
          parsed.strategy = `embed/${fromEmbed.strategy}`;
          break;
        }
        debugPages.push([`week-${target.week}-embed`, embed.html, embed.via]);
      } catch (err) {
        console.warn(err.message);
      }
    }
  }
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
    fetchedVia: via,
    questions: parsed.questions,
  };

  if (!ok) {
    // Keep the page so the parser can be fixed; the app still links to JOE.
    await mkdir(DEBUG_DIR, { recursive: true });
    for (const [name, page, pageVia] of debugPages) {
      await writeFile(join(DEBUG_DIR, `${name}.html`), page);
      console.log(`::group::Outline of ${name} (via ${pageVia})\n${describePage(page)}\n::endgroup::`);
    }
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
