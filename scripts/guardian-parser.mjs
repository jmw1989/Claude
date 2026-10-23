// Reads the Guardian's Saturday quiz (Thomas Eaton). Each article lists the questions under
// "The questions" and the answers under "The answers", as numbered lines split by <br>.
import * as cheerio from 'cheerio';

export const GUARDIAN_SERIES_URL = 'https://www.theguardian.com/theguardian/series/the-quiz-thomas-eaton';

const clean = (s) => (s || '').replace(/\s+/g, ' ').trim();

// Quiz articles on the series page, newest first.
export function listGuardianQuizzes(html) {
  const urls = [...html.matchAll(/href="((?:https:\/\/www\.theguardian\.com)?\/[a-z-]+\/\d{4}\/[a-z]{3}\/\d{2}\/[^"#?]+)"/g)]
    .map((m) => new URL(m[1], 'https://www.theguardian.com').href)
    .filter((u) => /quiz/.test(u));
  return [...new Set(urls)].map((url) => ({ id: url.replace(/^.*\/(\d{4}\/[a-z]{3}\/\d{2})\/.*$/, '$1').replace(/\//g, '-'), url }));
}

// Splits a section into numbered lines; a bold line without a number (e.g. "What links:")
// becomes the heading for the numbered lines after it.
function numberedLines($, startHeading, endHeading) {
  const lines = [];
  let inSection = false;
  let heading = null;
  $('h2, p').each((_, el) => {
    const $el = $(el);
    if (el.tagName === 'h2') {
      const text = clean($el.text()).toLowerCase();
      if (text === startHeading) inSection = true;
      else if (inSection && (!endHeading || text === endHeading)) inSection = false;
      return;
    }
    if (!inSection) return;
    for (const part of ($el.html() || '').split(/<br\s*\/?>/i)) {
      const $part = cheerio.load(`<div>${part}</div>`)('div');
      const text = clean($part.text());
      if (!text) continue;
      const m = /^(\d{1,2})[.)]?\s+([\s\S]+)$/.exec(text);
      if (m) lines.push({ number: Number(m[1]), text: m[2], heading });
      else heading = text.replace(/:$/, '');
    }
  });
  return lines;
}

export function parseGuardianQuiz(html) {
  const $ = cheerio.load(html);
  const questions = numberedLines($, 'the questions', 'the answers');
  const answers = new Map(numberedLines($, 'the answers', null).map((a) => [a.number, a.text]));
  return {
    title: clean($('meta[property="og:title"]').attr('content') || $('h1').first().text()),
    description: clean($('meta[property="og:description"]').attr('content')),
    image: $('meta[property="og:image"]').attr('content') || null,
    publishedAt: $('meta[property="article:published_time"]').attr('content') || null,
    questions: questions
      .filter((q) => answers.has(q.number))
      .map((q) => ({ number: q.number, q: q.text, answer: answers.get(q.number), category: q.heading })),
  };
}
