// Where quiz questions come from. Tries The Trivia API first, then Open Trivia DB,
// then the built-in offline bank, so a quiz always starts.
import { OFFLINE_QUESTIONS } from './offline-questions.js';

export const GENERAL_CATEGORIES = [
  { id: 'general_knowledge', label: 'General Knowledge', icon: '🧠', otdb: 9 },
  { id: 'history', label: 'History', icon: '🏛️', otdb: 23 },
  { id: 'geography', label: 'Geography', icon: '🌍', otdb: 22 },
  { id: 'science', label: 'Science & Nature', icon: '🔬', otdb: 17 },
  { id: 'film_and_tv', label: 'Film & TV', icon: '🎬', otdb: 11 },
  { id: 'music', label: 'Music', icon: '🎵', otdb: 12 },
  { id: 'arts_and_literature', label: 'Arts & Literature', icon: '📚', otdb: 10 },
  { id: 'food_and_drink', label: 'Food & Drink', icon: '🍔', otdb: 9 },
  { id: 'society_and_culture', label: 'Society & Culture', icon: '🗳️', otdb: 9 },
];

// `tags` are The Trivia API tags for each sport.
export const SPORTS = [
  { id: 'football', label: 'Football', icon: '⚽', tags: ['football', 'soccer', 'premier_league', 'world_cup'] },
  { id: 'rugby', label: 'Rugby', icon: '🏉', tags: ['rugby', 'rugby_union', 'rugby_league'] },
  { id: 'gaa', label: 'GAA', icon: '🏑', tags: ['gaelic_football', 'hurling', 'gaa'] },
  { id: 'cricket', label: 'Cricket', icon: '🏏', tags: ['cricket'] },
  { id: 'tennis', label: 'Tennis', icon: '🎾', tags: ['tennis'] },
  { id: 'golf', label: 'Golf', icon: '⛳', tags: ['golf'] },
  { id: 'formula_one', label: 'Formula 1', icon: '🏎️', tags: ['formula_one', 'motor_racing', 'motorsport'] },
  { id: 'boxing', label: 'Boxing & MMA', icon: '🥊', tags: ['boxing', 'mma', 'martial_arts'] },
  { id: 'olympics', label: 'Olympics', icon: '🏅', tags: ['olympics', 'olympic_games'] },
  { id: 'athletics', label: 'Athletics', icon: '🏃', tags: ['athletics'] },
  { id: 'basketball', label: 'Basketball', icon: '🏀', tags: ['basketball', 'nba'] },
  { id: 'american_football', label: 'NFL', icon: '🏈', tags: ['american_football', 'nfl'] },
  { id: 'snooker', label: 'Snooker & Darts', icon: '🎱', tags: ['snooker', 'darts'] },
  { id: 'horse_racing', label: 'Horse Racing', icon: '🏇', tags: ['horse_racing'] },
  { id: 'cycling', label: 'Cycling', icon: '🚴', tags: ['cycling'] },
];

// The Trivia API tags some NFL questions as "football", so check the wording as well.
const AMERICAN_FOOTBALL = /\b(NFL|Super ?Bowl|touchdowns?|quarterbacks?|gridiron|Heisman|American football|Lombardi Trophy|Patriots|Cowboys|Packers|Steelers|49ers|Seahawks|Broncos|Raiders)\b/i;

function isAmericanFootball(q) {
  if (q.tags?.some((t) => /american_football|nfl|super_bowl/i.test(t))) return true;
  return AMERICAN_FOOTBALL.test([q.q, ...q.options.map((o) => o.text)].join(' '));
}

export function shuffle(list) {
  const a = [...list];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

// Every question in the app: { q, image, options: [{text, image}], answer, category, difficulty }
function makeQuestion(q, correct, wrong, extra = {}) {
  const options = shuffle([correct, ...wrong]);
  return {
    q,
    image: null,
    options: options.map((text) => ({ text, image: null })),
    answer: options.indexOf(correct),
    ...extra,
  };
}

async function fetchJson(url, timeoutMs = 8000) {
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), timeoutMs);
  try {
    const res = await fetch(url, { signal: ctrl.signal, cache: 'no-store' });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    return await res.json();
  } finally {
    clearTimeout(timer);
  }
}

async function fromTriviaApi({ amount, categories, tags, difficulty }) {
  const params = new URLSearchParams({ limit: String(Math.min(amount, 50)) });
  if (categories?.length) params.set('categories', categories.join(','));
  if (tags?.length) params.set('tags', tags.join(','));
  if (difficulty && difficulty !== 'any') params.set('difficulties', difficulty);
  const data = await fetchJson(`https://the-trivia-api.com/v2/questions?${params}`);
  if (!Array.isArray(data)) throw new Error('Unexpected response');
  return data.map((d) =>
    makeQuestion(d.question?.text ?? d.question, d.correctAnswer, d.incorrectAnswers, {
      category: d.category,
      difficulty: d.difficulty,
      tags: d.tags || [],
    }),
  );
}

async function fromOpenTdb({ amount, otdbCategory, difficulty }) {
  const params = new URLSearchParams({ amount: String(Math.min(amount, 50)), type: 'multiple', encode: 'url3986' });
  if (otdbCategory) params.set('category', String(otdbCategory));
  if (difficulty && difficulty !== 'any') params.set('difficulty', difficulty);
  const data = await fetchJson(`https://opentdb.com/api.php?${params}`);
  if (data.response_code !== 0 || !data.results?.length) throw new Error(`Open Trivia DB code ${data.response_code}`);
  const dec = decodeURIComponent;
  return data.results.map((r) =>
    makeQuestion(dec(r.question), dec(r.correct_answer), r.incorrect_answers.map(dec), {
      category: dec(r.category),
      difficulty: r.difficulty,
    }),
  );
}

function fromOffline({ amount, categories, sportIds }) {
  let pool = OFFLINE_QUESTIONS;
  if (sportIds?.length) pool = pool.filter((x) => x.category === 'sport_and_leisure' && (sportIds.includes(x.tag) || (sportIds.includes('snooker') && x.tag === 'darts')));
  else {
    const general = pool.filter((x) => x.category !== 'sport_and_leisure');
    const matching = general.filter((x) => categories?.includes(x.category));
    pool = matching.length ? matching : general;
  }
  return shuffle(pool)
    .slice(0, amount)
    .map((x) => makeQuestion(x.q, x.options[x.answer], x.options.filter((_, i) => i !== x.answer), { category: x.category, difficulty: x.difficulty }));
}

function dedupe(list) {
  const seen = new Set();
  return list.filter((q) => (seen.has(q.q) ? false : (seen.add(q.q), true)));
}

/**
 * Builds a quiz. Returns { questions, source, note }.
 * kind: 'general' | 'sports'
 * selection: category ids (general) or sport ids (sports); empty means "any".
 */
export async function buildQuiz({ kind, selection = [], amount = 10, difficulty = 'any' }) {
  const notes = [];
  let questions = [];
  let source = 'The Trivia API';

  if (kind === 'sports') {
    const tags = SPORTS.filter((s) => selection.includes(s.id)).flatMap((s) => s.tags);
    // Leave out NFL questions when specific sports are picked and NFL isn't one of them.
    const keep = (q) => !selection.length || selection.includes('american_football') || !isAmericanFootball(q);
    // Ask for extra so there are still enough after filtering.
    const ask = Math.min(amount * 2, 50);
    try {
      questions = (await fromTriviaApi({ amount: ask, categories: ['sport_and_leisure'], tags, difficulty })).filter(keep);
      if (tags.length && questions.length < amount) {
        const more = await fromTriviaApi({ amount: ask, categories: ['sport_and_leisure'], difficulty });
        questions = dedupe([...questions, ...more.filter(keep)]);
        notes.push('Not enough questions for those sports, so we added some general sport ones.');
      }
    } catch {
      try {
        source = 'Open Trivia DB';
        questions = (await fromOpenTdb({ amount: ask, otdbCategory: 21, difficulty })).filter(keep);
        if (tags.length) notes.push('Showing general sports questions (sport filters need The Trivia API, which is unavailable).');
      } catch {
        source = 'offline';
      }
    }
    if (source === 'offline' || !questions.length) {
      source = 'offline';
      questions = fromOffline({ amount, sportIds: selection });
      if (questions.length < amount) questions = dedupe([...questions, ...fromOffline({ amount, sportIds: SPORTS.map((s) => s.id) })]);
      notes.push("You're offline, so this quiz uses the built-in question bank.");
    }
  } else {
    const cats = selection.length ? selection : [];
    try {
      questions = await fromTriviaApi({ amount, categories: cats, difficulty });
    } catch {
      try {
        source = 'Open Trivia DB';
        const pick = GENERAL_CATEGORIES.filter((c) => cats.includes(c.id));
        const otdbCategory = pick.length ? pick[Math.floor(Math.random() * pick.length)].otdb : null;
        questions = await fromOpenTdb({ amount, otdbCategory, difficulty });
      } catch {
        source = 'offline';
        questions = fromOffline({ amount, categories: cats });
        notes.push("You're offline, so this quiz uses the built-in question bank.");
      }
    }
  }

  return { questions: questions.slice(0, amount), source, note: notes.join(' ') };
}
