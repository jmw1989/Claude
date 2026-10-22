// Reads the BBC's "Quizzes of the Week" topic page and quiz articles. The quiz itself is
// a Riddle embed that only runs on the BBC's own site, so the app links to it instead.
import * as cheerio from 'cheerio';

export const BBC_TOPIC_URL = 'https://www.bbc.co.uk/news/topics/crxd18199v9t';

const clean = (s) => (s || '').replace(/\s+/g, ' ').trim();

// Quiz articles listed on the topic page, in page order (newest first).
export function parseBbcTopic(html, baseUrl = BBC_TOPIC_URL) {
  const $ = cheerio.load(html);
  const seen = new Map();
  $('a[href*="/news/articles/"]').each((_, el) => {
    const href = $(el).attr('href');
    const m = /\/news\/articles\/([a-z0-9]+)/.exec(href || '');
    if (!m || seen.has(m[1])) return;
    const heading = $(el).find('h2, h3, p, span').first();
    const title = clean(heading.length ? heading.text() : $(el).text());
    if (!/quiz/i.test(title)) return;
    seen.set(m[1], { id: m[1], url: new URL(`/news/articles/${m[1]}`, baseUrl).href, title });
  });
  return [...seen.values()];
}

// Details for one quiz article: title, intro, picture and when it was published.
export function parseBbcArticle(html) {
  const $ = cheerio.load(html);
  const meta = (p) => $(`meta[property="${p}"], meta[name="${p}"]`).attr('content') || null;
  let publishedAt = null;
  $('script[type="application/ld+json"]').each((_, el) => {
    try {
      publishedAt ||= JSON.parse($(el).html()).datePublished || null;
    } catch {}
  });
  return {
    title: clean(meta('og:title') || $('h1').first().text()),
    description: clean(meta('og:description') || meta('description')),
    image: meta('og:image'),
    publishedAt: publishedAt || $('time[datetime]').first().attr('datetime') || null,
    hasRiddle: /riddle\.com\/embed/.test(html),
  };
}
