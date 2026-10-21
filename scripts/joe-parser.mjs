// Turns a JOE Friday Pub Quiz web page into plain quiz JSON the app can play.
//
// JOE's markup isn't documented and changes from time to time, so this tries
// several strategies in turn and keeps the first that yields enough questions:
//   1. JSON embedded in the page (Next.js data, JSON-LD, inline state, data-* attrs)
//   2. schema.org Quiz / Question markup
//   3. Plain HTML with "question" / "answer" class names
import * as cheerio from 'cheerio';

const MIN_QUESTIONS = 3;

const TEXT_KEYS = /^(question|questiontext|question_text|questiontitle|title|text|prompt|heading|body|label|name|content)$/i;
const OPTION_KEYS = /^(answers|options|choices|answer_options|answeroptions|responses|possibleanswers|possible_answers)$/i;
const OPTION_TEXT_KEYS = /^(text|answer|answertext|answer_text|title|label|value|option|name|content|body)$/i;
const CORRECT_FLAG_KEYS = /^(correct|is_correct|iscorrect|right|isright|is_right|isanswer|is_answer|correctanswer|is_correct_answer|winner)$/i;
const CORRECT_REF_KEYS = /^(correct_?answer|correctanswer|answer|correct_?index|correct_?option|correct_?answer_?id|correctanswerid|correct_?answer_?index|solution)$/i;
const IMAGE_KEYS = /^(image|img|picture|photo|media|thumbnail|imageurl|image_url|src|featured_image|asset)$/i;

export function stripHtml(s) {
  if (typeof s !== 'string') return '';
  return decodeEntities(s.replace(/<br\s*\/?>/gi, ' ').replace(/<[^>]*>/g, ''))
    .replace(/\s+/g, ' ')
    .trim();
}

export function decodeEntities(s) {
  return s
    .replace(/&#(\d+);/g, (_, n) => String.fromCodePoint(+n))
    .replace(/&#x([0-9a-f]+);/gi, (_, n) => String.fromCodePoint(parseInt(n, 16)))
    .replace(/&quot;/g, '"')
    .replace(/&apos;|&#39;/g, "'")
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&nbsp;/g, ' ')
    .replace(/&rsquo;|&lsquo;/g, "'")
    .replace(/&rdquo;|&ldquo;/g, '"')
    .replace(/&ndash;/g, '–')
    .replace(/&mdash;/g, '—')
    .replace(/&hellip;/g, '…')
    .replace(/&amp;/g, '&');
}

function isTruthyFlag(v) {
  return v === true || v === 1 || v === '1' || v === 'true' || v === 'yes';
}

function findImage(obj, depth = 0) {
  if (!obj || depth > 3) return null;
  if (typeof obj === 'string') {
    return /^((https?:)?\/)?\/\S+\.(jpe?g|png|gif|webp|avif)(\?\S*)?$/i.test(obj) || /^https?:\/\/\S*(image|img|media|cdn)\S*$/i.test(obj)
      ? obj
      : null;
  }
  if (typeof obj !== 'object') return null;
  for (const [k, v] of Object.entries(obj)) {
    if (!IMAGE_KEYS.test(k) && !/^(url|src|href|original|large|medium)$/i.test(k)) continue;
    const found = findImage(v, depth + 1);
    if (found) return found;
  }
  return null;
}

function textOf(v) {
  if (typeof v === 'string') return stripHtml(v);
  if (typeof v === 'number') return String(v);
  if (v && typeof v === 'object') {
    for (const [k, val] of Object.entries(v)) {
      if (TEXT_KEYS.test(k) || OPTION_TEXT_KEYS.test(k)) {
        const t = textOf(val);
        if (t) return t;
      }
    }
  }
  return '';
}

function normaliseOption(o) {
  if (typeof o === 'string' || typeof o === 'number') return { text: stripHtml(String(o)), image: null, correct: false, id: null };
  if (!o || typeof o !== 'object') return null;
  let text = '';
  for (const [k, v] of Object.entries(o)) {
    if (OPTION_TEXT_KEYS.test(k) && (typeof v === 'string' || typeof v === 'number' || (v && typeof v === 'object' && !Array.isArray(v)))) {
      text = textOf(v);
      if (text) break;
    }
  }
  const correct = Object.entries(o).some(([k, v]) => CORRECT_FLAG_KEYS.test(k) && isTruthyFlag(v));
  const image = findImage(o);
  const id = o.id ?? o._id ?? o.key ?? o.uuid ?? null;
  if (!text && !image) return null;
  return { text, image, correct, id };
}

// Returns a normalised question if `o` looks like one, else null.
export function questionFromObject(o) {
  if (!o || typeof o !== 'object' || Array.isArray(o)) return null;

  // schema.org Question
  if (/question/i.test(o['@type'] || '') && (o.acceptedAnswer || o.suggestedAnswer)) {
    const accepted = [].concat(o.acceptedAnswer || []).map(normaliseOption).filter(Boolean);
    const wrong = [].concat(o.suggestedAnswer || []).map(normaliseOption).filter(Boolean);
    if (!accepted.length || !wrong.length) return null;
    const q = stripHtml(o.name || o.text || '');
    if (!q) return null;
    // Put the right answer at a stable, question-dependent position.
    const pos = [...q].reduce((a, c) => a + c.charCodeAt(0), 0) % (wrong.length + 1);
    const options = [...wrong];
    options.splice(pos, 0, accepted[0]);
    return { q, image: findImage(o), options: options.map(({ text, image }) => ({ text, image })), answer: pos };
  }

  const optKey = Object.keys(o).find((k) => OPTION_KEYS.test(k) && Array.isArray(o[k]));
  if (!optKey) return null;
  const rawOpts = o[optKey];
  if (rawOpts.length < 2 || rawOpts.length > 10) return null;
  const options = rawOpts.map(normaliseOption);
  if (options.some((x) => !x)) return null;

  let q = '';
  for (const [k, v] of Object.entries(o)) {
    if (k === optKey || !TEXT_KEYS.test(k)) continue;
    q = textOf(v);
    if (q) break;
  }
  const image = findImage(o);
  if (!q && !image) return null;

  let answer = options.findIndex((x) => x.correct);
  if (answer < 0) {
    for (const [k, v] of Object.entries(o)) {
      if (!CORRECT_REF_KEYS.test(k) || v == null) continue;
      if (typeof v === 'number' && Number.isInteger(v)) {
        // Could be 0-based index, 1-based index or an option id.
        const byId = options.findIndex((x) => x.id === v);
        if (byId >= 0) answer = byId;
        else if (v >= 0 && v < options.length) answer = v;
        else if (v === options.length) answer = v - 1;
      } else {
        const t = textOf(v).toLowerCase();
        answer = options.findIndex((x) => x.text.toLowerCase() === t || (x.id != null && String(x.id) === String(v)));
        if (answer < 0 && /^[a-j]$/i.test(t)) answer = t.charCodeAt(0) - 97;
      }
      if (answer >= 0) break;
    }
  }
  if (answer < 0 || answer >= options.length) return null;

  return { q: q || 'Picture question', image, options: options.map(({ text, image }) => ({ text, image })), answer };
}

// Depth-first walk collecting every question-shaped object, in document order.
export function collectQuestions(root) {
  const out = [];
  const seen = new Set();
  const stack = [root];
  const visited = new WeakSet();
  while (stack.length) {
    const node = stack.pop();
    if (!node || typeof node !== 'object' || visited.has(node)) continue;
    visited.add(node);
    const q = questionFromObject(node);
    if (q) {
      const key = q.q + '|' + q.options.map((o) => o.text).join('|');
      if (!seen.has(key)) {
        seen.add(key);
        out.push(q);
      }
      continue;
    }
    const children = Array.isArray(node) ? node : Object.values(node);
    for (let i = children.length - 1; i >= 0; i--) stack.push(children[i]);
  }
  return out;
}

// Finds JSON values inside arbitrary text (e.g. `window.__STATE__ = {...};`).
export function extractJsonValues(text, { hint = /answer|option|choice/i, budgetMs = 4000 } = {}) {
  const values = [];
  const start = Date.now();
  let i = 0;
  while (i < text.length) {
    if (Date.now() - start > budgetMs) break;
    const c = text[i];
    if (c !== '{' && c !== '[') {
      i++;
      continue;
    }
    const end = matchBracket(text, i);
    if (end < 0) {
      i++;
      continue;
    }
    const chunk = text.slice(i, end + 1);
    if (chunk.length > 40 && hint.test(chunk)) {
      try {
        values.push(JSON.parse(chunk));
        i = end + 1;
        continue;
      } catch {
        // Not JSON (probably a JS object literal); look inside it.
      }
    } else {
      i = end + 1;
      continue;
    }
    i++;
  }
  return values;
}

function matchBracket(text, from) {
  let depth = 0;
  let inStr = false;
  let quote = '';
  for (let j = from; j < text.length; j++) {
    const ch = text[j];
    if (inStr) {
      if (ch === '\\') j++;
      else if (ch === quote) inStr = false;
      continue;
    }
    if (ch === '"') {
      inStr = true;
      quote = ch;
    } else if (ch === '{' || ch === '[') depth++;
    else if (ch === '}' || ch === ']') {
      depth--;
      if (depth === 0) return j;
    }
  }
  return -1;
}

function jsonCandidates($) {
  const candidates = [];
  const tryParse = (s) => {
    try {
      candidates.push(JSON.parse(s));
      return true;
    } catch {
      return false;
    }
  };

  // Next.js app-router streams its data in self.__next_f.push([1,"..."]) calls.
  let flight = '';
  $('script').each((_, el) => {
    const body = $(el).html() || '';
    const type = ($(el).attr('type') || '').toLowerCase();
    if (type.includes('json')) {
      if (!tryParse(body.trim())) candidates.push(...extractJsonValues(body));
      return;
    }
    for (const m of body.matchAll(/self\.__next_f\.push\(\[\d+,\s*("(?:[^"\\]|\\.)*")\]\)/g)) {
      try {
        flight += JSON.parse(m[1]);
      } catch {}
    }
    if (/answer|option|choice/i.test(body)) candidates.push(...extractJsonValues(body));
  });
  if (flight) {
    for (const line of flight.split('\n')) {
      const payload = line.replace(/^[0-9a-z]+:/i, '');
      if (!tryParse(payload) && /answer|option|choice/i.test(payload)) candidates.push(...extractJsonValues(payload));
    }
  }

  // JSON tucked into data-* attributes, e.g. <div data-quiz="{&quot;questions&quot;:...}">
  $('*').each((_, el) => {
    for (const [name, value] of Object.entries(el.attribs || {})) {
      if (!name.startsWith('data-') && name !== 'props' && name !== ':props') continue;
      const v = (value || '').trim();
      if ((v.startsWith('{') || v.startsWith('[')) && /answer|option|choice/i.test(v)) tryParse(v);
    }
  });
  return candidates;
}

function questionsFromHtml($) {
  const out = [];
  const answerSel = '[class*="answer" i], [class*="option" i], [class*="choice" i], [data-answer], [data-correct]';
  const containers = $('[class*="question" i], [data-question], [data-question-id]').filter((_, el) => {
    // Keep the innermost containers that hold the answers.
    const answers = $(el).find(answerSel);
    return answers.length >= 2 && $(el).find('[class*="question" i]').filter((__, c) => $(c).find(answerSel).length >= 2).length === 0;
  });
  containers.each((_, el) => {
    const $el = $(el);
    let answers = $el.find(answerSel).filter((__, a) => $(a).find(answerSel).length === 0);
    if (answers.length < 2 || answers.length > 10) return;
    const options = [];
    let answer = -1;
    answers.each((i, a) => {
      const $a = $(a);
      const text = $a.text().replace(/\s+/g, ' ').trim();
      const img = $a.find('img').attr('src') || $a.find('img').attr('data-src') || null;
      options.push({ text, image: img });
      const cls = ($a.attr('class') || '').toLowerCase();
      const flags = [$a.attr('data-correct'), $a.attr('data-is-correct'), $a.attr('data-right'), $a.attr('data-answer')];
      if (/(^|[\s_-])(correct|right)([\s_-]|$)/.test(cls) && !/incorrect/.test(cls)) answer = i;
      if (flags.some((f) => f === 'true' || f === '1')) answer = i;
    });
    if (answer < 0) return;
    const heading = $el.find('[class*="title" i], [class*="text" i], h2, h3, h4, p').filter((__, h) => $(h).closest(answerSel).length === 0).first();
    const q = (heading.text() || '').replace(/\s+/g, ' ').trim();
    const image = $el.find('img').filter((__, im) => $(im).closest(answerSel).length === 0).first().attr('src') || null;
    if (!q && !image) return;
    out.push({ q: q || 'Picture question', image, options, answer });
  });
  return out;
}

export function parseQuizPage(html, url = '') {
  const $ = cheerio.load(html);
  const title = ($('meta[property="og:title"]').attr('content') || $('title').text() || '').trim();
  const published =
    $('meta[property="article:published_time"]').attr('content') ||
    $('time[datetime]').first().attr('datetime') ||
    null;
  const image = $('meta[property="og:image"]').attr('content') || null;
  const description = ($('meta[property="og:description"]').attr('content') || $('meta[name="description"]').attr('content') || '').trim();

  const strategies = [
    ['embedded-json', () => jsonCandidates($).flatMap((c) => collectQuestions(c))],
    ['html', () => questionsFromHtml($)],
  ];
  let questions = [];
  let strategy = null;
  for (const [name, run] of strategies) {
    const found = dedupe(run());
    if (found.length >= MIN_QUESTIONS && found.length > questions.length) {
      questions = found;
      strategy = name;
      break;
    }
  }

  const absolutise = (src) => {
    if (!src) return null;
    try {
      return new URL(src, url || undefined).href;
    } catch {
      return src;
    }
  };
  questions = questions.map((q) => ({
    q: q.q,
    image: absolutise(q.image),
    options: q.options.map((o) => ({ text: o.text, image: absolutise(o.image) })),
    answer: q.answer,
  }));

  return { title, description, image, publishedAt: published, strategy, questions };
}

function dedupe(list) {
  const seen = new Set();
  return list.filter((q) => {
    const key = q.q + '|' + q.options.map((o) => o.text).join('|');
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

// Finds links to weekly quizzes on a listing page, newest week first.
export function findWeeklyQuizLinks(html, baseUrl) {
  const re = /(?:https?:\/\/(?:www\.)?joe\.(?:co\.uk|ie))?\/quiz\/the-joe-friday-pub-quiz-week-(\d+)(?:-\d+)?\/?/gi;
  const byWeek = new Map();
  for (const m of html.matchAll(re)) {
    const week = Number(m[1]);
    const href = new URL(m[0], baseUrl).href;
    if (!byWeek.has(week)) byWeek.set(week, href);
  }
  return [...byWeek.entries()].sort((a, b) => b[0] - a[0]).map(([week, url]) => ({ week, url }));
}

export function weekFromUrl(url) {
  const m = /pub-quiz-week-(\d+)/i.exec(url || '');
  return m ? Number(m[1]) : null;
}
