// Weekly quizzes the app links to rather than importing: their quiz tools only run on the
// publisher's own site (BBC Riddle, The Week's Kwizly and The National's PuzzleMe players all
// restrict where they can be embedded). We save each quiz's title, intro, picture and date.
import * as cheerio from 'cheerio';

export const LINK_SOURCES = {
  bbc: {
    listUrl: 'https://www.bbc.co.uk/news/topics/crxd18199v9t', // "Quizzes of the Week"
    linkRe: /\/news\/articles\/[a-z0-9]+/,
    titleRe: /quiz/i,
  },
  bbcsport: {
    listUrl: 'https://www.bbc.co.uk/sport/quizzes',
    linkRe: /\/sport\/articles\/[a-z0-9]+/,
    titleRe: /weekly sports? quiz/i,
  },
  theweek: {
    listUrl: 'https://theweek.com/tag/quiz-of-the-week',
    linkRe: /\/puzzles\/quiz-of-the-week-[a-z0-9-]+/,
  },
  national: {
    listUrl: 'https://www.thenationalnews.com/sport/',
    linkRe: /\/sport\/\d{4}\/\d{2}\/\d{2}\/sport-quiz-of-the-week[a-z0-9-]*\/?/,
  },
};

const clean = (s) => (s || '').replace(/\s+/g, ' ').trim();

// Article links on a listing page, in page order, with their link text as a fallback title.
export function listQuizLinks(html, baseUrl, { linkRe, titleRe }) {
  const $ = cheerio.load(html);
  const found = new Map();
  $('a[href]').each((_, el) => {
    const m = linkRe.exec($(el).attr('href'));
    if (!m) return;
    const url = new URL(m[0], baseUrl).href;
    const heading = $(el).find('h2, h3, p, span').first();
    const title = clean(heading.length ? heading.text() : $(el).text());
    if (titleRe && !titleRe.test(title)) return;
    if (!found.has(url) || (!found.get(url).title && title)) found.set(url, { url, title });
  });
  return [...found.values()].map((x) => ({ id: x.url.replace(/\/$/, '').split('/').pop(), ...x }));
}

// Title, intro, picture and publish date from an article's meta tags and JSON-LD.
export function parseArticleMeta(html) {
  const $ = cheerio.load(html);
  const meta = (p) => $(`meta[property="${p}"], meta[name="${p}"]`).attr('content') || null;
  let publishedAt = meta('article:published_time');
  $('script[type="application/ld+json"]').each((_, el) => {
    try {
      const data = JSON.parse($(el).html());
      for (const d of [].concat(data['@graph'] || data)) publishedAt ||= d.datePublished || null;
    } catch {}
  });
  return {
    // Some sites add their name to og:title, e.g. "Sport quiz of the week | The National".
    title: clean(meta('og:title') || $('h1').first().text()).replace(/\s+\|\s+The National$/i, ''),
    description: clean(meta('og:description') || meta('description')),
    image: meta('og:image'),
    publishedAt: publishedAt || $('time[datetime]').first().attr('datetime') || null,
  };
}
