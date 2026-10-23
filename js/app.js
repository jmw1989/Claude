import { GENERAL_CATEGORIES, SPORTS, buildQuiz } from './sources.js';

const $ = (sel) => document.querySelector(sel);
const $$ = (sel) => [...document.querySelectorAll(sel)];

// ---------- Storage (wrapped: private browsing can throw) ----------
const store = {
  get(key, fallback) {
    try {
      const v = localStorage.getItem(`quiznight.${key}`);
      return v == null ? fallback : JSON.parse(v);
    } catch {
      return fallback;
    }
  },
  set(key, value) {
    try {
      localStorage.setItem(`quiznight.${key}`, JSON.stringify(value));
    } catch {}
  },
};

const state = {
  kind: 'general',
  selection: { general: store.get('sel.general', []), sports: store.get('sel.sports', []) },
  amount: store.get('amount', 10),
  difficulty: store.get('difficulty', 'any'),
  quiz: null,
  joe: { index: null, latest: null },
  qqq: { index: null, latest: null, shown: null },
};

// ---------- Navigation ----------
const TITLES = {
  home: 'Quiz Night',
  setup: 'New quiz',
  joe: 'JOE Friday Pub Quiz',
  qqq: 'QuizQuizQuiz Friday Quiz',
  weekly: 'Weekly quiz',
  loading: 'Loading',
  play: 'Quiz',
  results: 'Results',
};
let current = 'home';

function show(name, { push = true } = {}) {
  $$('.screen').forEach((s) => (s.hidden = s.id !== `screen-${name}`));
  $('#screen-title').textContent = name === 'setup' ? (state.kind === 'sports' ? 'Sports quiz' : 'General knowledge') : TITLES[name];
  $('#back-btn').hidden = name === 'home';
  if (push && name !== current && name !== 'loading') history.pushState({ screen: name }, '');
  current = name;
  window.scrollTo(0, 0);
  if (name === 'home') renderHome();
}

window.addEventListener('popstate', (e) => {
  const target = e.state?.screen || 'home';
  if (current === 'play' && !confirm('Leave this quiz? Your progress will be lost.')) {
    history.pushState({ screen: 'play' }, '');
    return;
  }
  show(target === 'play' || target === 'loading' ? 'home' : target, { push: false });
});

$('#back-btn').addEventListener('click', () => history.back());

function toast(msg) {
  const t = $('#toast');
  t.textContent = msg;
  t.hidden = false;
  clearTimeout(toast.timer);
  toast.timer = setTimeout(() => (t.hidden = true), 2600);
}

// ---------- Home ----------
function renderHome() {
  const past = store.get('history', []);
  const played = past.length;
  const correct = past.reduce((a, h) => a + h.score, 0);
  const total = past.reduce((a, h) => a + h.total, 0);
  const best = past.reduce((a, h) => Math.max(a, h.total ? h.score / h.total : 0), 0);
  $('#stats').innerHTML = `
    <div><b>${played}</b><span>Quizzes</span></div>
    <div><b>${total ? Math.round((correct / total) * 100) : 0}%</b><span>Correct</span></div>
    <div><b>${Math.round(best * 100)}%</b><span>Best</span></div>`;
  $('#history').innerHTML = past
    .slice(0, 5)
    .map((h) => `<li><span>${escapeHtml(h.title)}</span><b>${h.score}/${h.total}</b></li>`)
    .join('');
  renderTopScores();
  renderJoeCard();
  renderQqqCard();
  renderWeeklyCards();
}

// Best five scores, highest percentage first; ties go to the higher score, then the earlier date.
function topFive(entries) {
  return entries
    .filter((e) => e.total > 0)
    .sort((a, b) => b.score / b.total - a.score / a.total || b.score - a.score || a.date.localeCompare(b.date))
    .slice(0, 5);
}

const shortDate = (iso) => new Date(iso).toLocaleDateString(undefined, { day: 'numeric', month: 'short', year: 'numeric' });

function renderTopList(el, entries, emptyText) {
  el.innerHTML = entries.length
    ? entries
        .map(
          (e) => `<li><span class="top-label">${escapeHtml(e.label)}</span>
            <b>${e.score}/${e.total}</b><small>${escapeHtml(shortDate(e.date))}</small></li>`,
        )
        .join('')
    : `<li class="empty">${emptyText}</li>`;
}

function renderTopScores() {
  const joe = Object.entries(joeResults()).map(([week, r]) => ({ ...r, label: `Week ${week}` }));
  renderTopList($('#top-joe'), topFive(joe), 'Play a JOE quiz to get on the board.');
  const qqq = Object.values(store.get('qqq.scores', {})).map((r) => ({ ...r, label: `${qqqShortTitle(r.title).replace(/,?\s*\d{4}$/, '')} quiz` }));
  renderTopList($('#top-qqq'), topFive(qqq), 'Enter your QuizQuizQuiz score to get on the board.');
}

$$('.card[data-kind]').forEach((btn) =>
  btn.addEventListener('click', () => {
    state.kind = btn.dataset.kind;
    renderSetup();
    show('setup');
  }),
);

// ---------- Setup ----------
function renderSetup() {
  const isSports = state.kind === 'sports';
  const items = isSports ? SPORTS : GENERAL_CATEGORIES;
  const selected = new Set(state.selection[state.kind]);
  $('#setup-label').textContent = isSports ? 'Sports' : 'Categories';
  $('#setup-hint').textContent = isSports ? 'Pick your sports, or leave blank for all sports.' : 'Pick one or more, or leave blank for a mix.';
  $('#category-chips').innerHTML = items
    .map((c) => `<button class="chip${selected.has(c.id) ? ' on' : ''}" data-id="${c.id}"><span>${c.icon}</span>${c.label}</button>`)
    .join('');
  setSegment('#amount-seg', String(state.amount));
  setSegment('#difficulty-seg', state.difficulty);
}

$('#category-chips').addEventListener('click', (e) => {
  const chip = e.target.closest('.chip');
  if (!chip) return;
  chip.classList.toggle('on');
  state.selection[state.kind] = $$('#category-chips .chip.on').map((c) => c.dataset.id);
  store.set(`sel.${state.kind}`, state.selection[state.kind]);
});

function setSegment(sel, value) {
  $$(`${sel} button`).forEach((b) => b.classList.toggle('on', b.dataset.value === value));
}

$('#amount-seg').addEventListener('click', (e) => {
  const b = e.target.closest('button');
  if (!b) return;
  state.amount = Number(b.dataset.value);
  store.set('amount', state.amount);
  setSegment('#amount-seg', b.dataset.value);
});

$('#difficulty-seg').addEventListener('click', (e) => {
  const b = e.target.closest('button');
  if (!b) return;
  state.difficulty = b.dataset.value;
  store.set('difficulty', state.difficulty);
  setSegment('#difficulty-seg', b.dataset.value);
});

$('#start-btn').addEventListener('click', startGeneratedQuiz);

async function startGeneratedQuiz() {
  show('loading');
  const selection = state.selection[state.kind];
  const result = await buildQuiz({ kind: state.kind, selection, amount: state.amount, difficulty: state.difficulty });
  if (!result.questions.length) {
    show('setup', { push: false });
    toast('No questions found — try fewer filters.');
    return;
  }
  const items = state.kind === 'sports' ? SPORTS : GENERAL_CATEGORIES;
  const names = items.filter((c) => selection.includes(c.id)).map((c) => c.label);
  const label = state.kind === 'sports' ? 'Sports' : 'General Knowledge';
  startQuiz({
    title: names.length ? `${label}: ${names.slice(0, 3).join(', ')}${names.length > 3 ? '…' : ''}` : `${label} mix`,
    questions: result.questions,
    note: result.note,
    replay: startGeneratedQuiz,
  });
}

// ---------- JOE Friday Pub Quiz ----------
async function loadJoe() {
  const bust = `?t=${Math.floor(Date.now() / 60000)}`;
  try {
    const res = await fetch(`data/joe/index.json${bust}`, { cache: 'no-store' });
    state.joe.index = res.ok ? await res.json() : { quizzes: [] };
  } catch {
    state.joe.index = state.joe.index || { quizzes: [] };
  }
  const latest = state.joe.index.quizzes?.[0];
  state.joe.latest = latest ? await loadJoeWeek(latest) : null;
  renderJoeCard();
  if (current === 'joe') renderJoe();
}

async function loadJoeWeek(entry) {
  try {
    const res = await fetch(`data/joe/${entry.file}`, { cache: 'no-cache' });
    if (res.ok) return await res.json();
  } catch {}
  return { ...entry, questions: [] };
}

function joeResults() {
  return store.get('joe', {});
}

function renderJoeCard() {
  const sub = $('#joe-card-sub');
  const badge = $('#joe-badge');
  const latest = state.joe.latest;
  if (!state.joe.index) return;
  if (!latest) {
    sub.textContent = 'A new quiz lands here every Friday.';
    badge.hidden = true;
    return;
  }
  const done = joeResults()[latest.week];
  const playable = latest.status === 'ok' && latest.questions?.length;
  sub.textContent = done
    ? `Week ${latest.week} · you scored ${done.score}/${done.total}`
    : playable
      ? `Week ${latest.week} · ${latest.questions.length} questions · tap to play`
      : `Week ${latest.week} is out · tap to open`;
  badge.hidden = Boolean(done);
}

$('#joe-card').addEventListener('click', () => {
  renderJoe();
  show('joe');
});

function renderJoe() {
  const latest = state.joe.latest;
  const results = joeResults();
  const hero = $('#joe-hero');
  if (!latest) {
    hero.innerHTML = `
      <h2>No quiz yet</h2>
      <p>The JOE Friday Pub Quiz is fetched automatically every Friday. Check back then!</p>`;
  } else {
    const done = results[latest.week];
    const playable = latest.status === 'ok' && latest.questions?.length;
    const date = latest.publishedAt ? new Date(latest.publishedAt).toLocaleDateString(undefined, { weekday: 'long', day: 'numeric', month: 'long' }) : '';
    hero.innerHTML = `
      ${latest.image ? `<img src="${escapeAttr(latest.image)}" alt="" class="joe-img" referrerpolicy="no-referrer">` : ''}
      <p class="eyebrow">This week · Week ${latest.week}${date ? ` · ${date}` : ''}</p>
      <h2>${escapeHtml(latest.title)}</h2>
      ${latest.description ? `<p>${escapeHtml(latest.description)}</p>` : ''}
      ${done ? `<p class="done">You scored <b>${done.score}/${done.total}</b></p>` : ''}
      ${
        playable
          ? `<button class="primary-btn" data-play-week="${latest.week}">${done ? 'Play again' : `Play ${latest.questions.length} questions`}</button>`
          : `<p class="hint">We couldn't import this week's questions into the app, but you can play it on JOE.</p>`
      }
      <a class="secondary-btn full" href="${escapeAttr(latest.url)}" target="_blank" rel="noopener">Open on JOE ↗</a>`;
  }

  const older = (state.joe.index?.quizzes || []).slice(1);
  $('#joe-list').innerHTML = older.length
    ? older
        .map((q) => {
          const r = results[q.week];
          const action =
            q.status === 'ok' && q.count
              ? `<button class="small-btn" data-play-week="${q.week}">${r ? `${r.score}/${r.total}` : 'Play'}</button>`
              : `<a class="small-btn" href="${escapeAttr(q.url)}" target="_blank" rel="noopener">JOE ↗</a>`;
          return `<li><span><b>Week ${q.week}</b><small>${q.count ? `${q.count} questions` : 'Link only'}</small></span>${action}</li>`;
        })
        .join('')
    : '<li class="empty">Past quizzes will build up here each week.</li>';
}

$('#screen-joe').addEventListener('click', async (e) => {
  const btn = e.target.closest('[data-play-week]');
  if (!btn) return;
  const week = Number(btn.dataset.playWeek);
  let quiz = state.joe.latest?.week === week ? state.joe.latest : null;
  if (!quiz) {
    const entry = state.joe.index.quizzes.find((q) => q.week === week);
    show('loading');
    quiz = await loadJoeWeek(entry);
  }
  if (!quiz.questions?.length) {
    show('joe', { push: false });
    toast("Couldn't load that quiz.");
    return;
  }
  const play = () => startQuiz({ title: `JOE Pub Quiz · Week ${quiz.week}`, questions: quiz.questions, joeWeek: quiz.week, replay: play });
  play();
});

// ---------- QuizQuizQuiz Friday Quiz ----------
// Answers are typed in and sent to QuizQuizQuiz, which marks them and shows the
// correct answers. Their page has no answers in it, so the app can't mark it itself.
async function loadQqq() {
  try {
    const res = await fetch(`data/qqq/index.json?t=${Math.floor(Date.now() / 60000)}`, { cache: 'no-store' });
    state.qqq.index = res.ok ? await res.json() : { quizzes: [] };
  } catch {
    state.qqq.index = state.qqq.index || { quizzes: [] };
  }
  const latest = state.qqq.index.quizzes?.[0];
  state.qqq.latest = latest ? await loadQqqQuiz(latest) : null;
  renderQqqCard();
  if (current === 'qqq' && !state.qqq.shown) renderQqq(state.qqq.latest);
}

async function loadQqqQuiz(entry) {
  try {
    const res = await fetch(`data/qqq/${entry.file}`, { cache: 'no-cache' });
    if (res.ok) return await res.json();
  } catch {}
  return null;
}

function renderQqqCard() {
  const sub = $('#qqq-card-sub');
  const latest = state.qqq.latest;
  if (!state.qqq.index) return;
  const done = latest && store.get('qqq.done', {})[latest.quizId];
  const score = latest && store.get('qqq.scores', {})[latest.quizId];
  sub.textContent = !latest
    ? 'A new quiz lands here every Friday.'
    : `${qqqShortTitle(latest.title)} · ${score ? `you scored ${score.score}/${score.total}` : done ? 'answers submitted' : `${latest.questions.length} questions · tap to play`}`;
  $('#qqq-badge').hidden = !latest || Boolean(done || score);
}

$('#qqq-card').addEventListener('click', () => {
  renderQqq(state.qqq.latest);
  show('qqq');
});

function renderQqq(quiz) {
  state.qqq.shown = quiz;
  const body = $('#qqq-body');
  if (!quiz) {
    body.innerHTML = `<div class="joe-hero"><h2>No quiz yet</h2><p>The QuizQuizQuiz Friday Quiz is fetched automatically every Friday. Check back then!</p>
      <a class="secondary-btn full" href="https://quizquizquiz.com/friday/" target="_blank" rel="noopener">Open on QuizQuizQuiz ↗</a></div>`;
  } else {
    const draft = store.get(`qqq.draft.${quiz.quizId}`, {});
    const done = store.get('qqq.done', {})[quiz.quizId];
    body.innerHTML = `
      <div class="joe-hero qqq-hero">
        <p class="eyebrow">${quiz === state.qqq.latest ? 'This week' : 'Previous week'}</p>
        <h2>${escapeHtml(quiz.title)}</h2>
        <p>Type your answers, then submit them to QuizQuizQuiz. It marks them and shows you the correct answers.</p>
        ${done ? '<p class="done">You submitted answers for this quiz.</p>' : ''}
      </div>
      <form id="qqq-form" class="qqq-form" autocomplete="off">
        ${quiz.questions
          .map(
            (q) => `<div class="question-card qqq-question">
              <p class="q-category">Question ${q.number}</p>
              ${q.image ? `<img class="q-image" src="${escapeAttr(q.image)}" alt="" referrerpolicy="no-referrer">` : ''}
              <h3 class="q-text">${escapeHtml(q.q)}</h3>
              ${q.fields
                .map(
                  (f) => `<label class="qqq-field">${f.label ? `<span>${escapeHtml(f.label)}</span>` : ''}
                    <input type="text" name="${escapeHtml(f.name)}" value="${escapeHtml(draft[f.name] || '')}" placeholder="Your answer" autocapitalize="sentences"></label>`,
                )
                .join('')}
            </div>`,
          )
          .join('')}
        <button class="primary-btn" type="submit">Submit &amp; see answers</button>
        <p class="hint qqq-hint">QuizQuizQuiz marks your answers and shows the correct ones below. As on their site, you can only submit once.</p>
      </form>
      <section class="qqq-results" id="qqq-results" hidden>
        <h2 class="section-label">Your results from QuizQuizQuiz</h2>
        <iframe name="qqq-results-frame" title="QuizQuizQuiz results"></iframe>
        <p class="hint">The results stay here until you leave this screen, so take a screenshot if you want to keep them.
          Nothing showing? <button class="link-btn" id="qqq-open-browser" type="button">Open the results in your browser</button></p>
      </section>
      ${qqqScoreHtml(quiz)}
      <a class="secondary-btn full" href="${escapeAttr(quiz.url)}" target="_blank" rel="noopener">Play on QuizQuizQuiz instead ↗</a>`;
  }

  const older = (state.qqq.index?.quizzes || []).filter((q) => q.quizId !== quiz?.quizId);
  const scores = store.get('qqq.scores', {});
  $('#qqq-list').innerHTML = older.length
    ? older
        .map((q) => `<li><span><b>${escapeHtml(qqqShortTitle(q.title))}</b><small>${scores[q.quizId] ? `You scored ${scores[q.quizId].score}/${scores[q.quizId].total}` : `${q.count} questions`}</small></span><button class="small-btn" data-qqq="${escapeHtml(q.quizId)}">Open</button></li>`)
        .join('')
    : '<li class="empty">Past quizzes will build up here each week.</li>';
  state.qqq.startedAt = Date.now();
  state.qqq.submitted = null;
}

const qqqShortTitle = (title) => (title || '').replace(/^The QuizQuizQuiz Friday Quiz,?\s*/i, '') || 'QuizQuizQuiz';

// One mark per answer box, which is how QuizQuizQuiz scores the Friday Quiz.
const qqqMaxScore = (quiz) => quiz.questions.reduce((n, q) => n + q.fields.length, 0);

function qqqScoreHtml(quiz) {
  const saved = store.get('qqq.scores', {})[quiz.quizId];
  return `<section class="panel qqq-score">
      <h2>Your score</h2>
      <p class="hint">Once QuizQuizQuiz has marked your answers, enter your score here to add it to your top scores.</p>
      <form id="qqq-score-form" class="qqq-score-form">
        <input type="number" name="score" min="0" max="99" inputmode="numeric" required aria-label="Your score" value="${saved ? saved.score : ''}">
        <span>out of</span>
        <input type="number" name="total" min="1" max="99" inputmode="numeric" required aria-label="Out of" value="${saved ? saved.total : qqqMaxScore(quiz)}">
        <button class="small-btn" type="submit">${saved ? 'Update' : 'Save'}</button>
      </form>
      ${saved ? `<p class="done">Saved: <b>${saved.score}/${saved.total}</b> on ${escapeHtml(shortDate(saved.date))}</p>` : ''}
    </section>`;
}

function saveQqqScore(form) {
  const quiz = state.qqq.shown;
  const score = Number(form.score.value);
  const total = Number(form.total.value);
  if (!Number.isInteger(score) || !Number.isInteger(total) || total < 1 || score < 0 || score > total) {
    return toast('Enter a score between 0 and the total.');
  }
  const scores = store.get('qqq.scores', {});
  scores[quiz.quizId] = { score, total, date: new Date().toISOString(), title: quiz.title };
  store.set('qqq.scores', scores);
  form.closest('.qqq-score').outerHTML = qqqScoreHtml(quiz);
  toast('Score saved');
}

$('#screen-qqq').addEventListener('input', (e) => {
  const quiz = state.qqq.shown;
  if (!quiz || !e.target.name || !e.target.closest('#qqq-form')) return;
  const draft = store.get(`qqq.draft.${quiz.quizId}`, {});
  draft[e.target.name] = e.target.value;
  store.set(`qqq.draft.${quiz.quizId}`, draft);
});

$('#screen-qqq').addEventListener('click', async (e) => {
  if (e.target.id === 'qqq-open-browser' && state.qqq.submitted) {
    postToQqq(state.qqq.shown.submitUrl, state.qqq.submitted, '_blank');
    return;
  }
  const btn = e.target.closest('[data-qqq]');
  if (!btn) return;
  const entry = state.qqq.index.quizzes.find((q) => q.quizId === btn.dataset.qqq);
  const quiz = entry && (await loadQqqQuiz(entry));
  if (!quiz) return toast("Couldn't load that quiz.");
  renderQqq(quiz);
  window.scrollTo(0, 0);
});

$('#screen-qqq').addEventListener('submit', (e) => {
  e.preventDefault();
  if (e.target.id === 'qqq-score-form') return saveQqqScore(e.target);
  const quiz = state.qqq.shown;
  const answers = Object.fromEntries(new FormData(e.target));
  if (!Object.values(answers).some((v) => v.trim())) return toast('Type at least one answer first.');
  if (!confirm('Submit your answers to QuizQuizQuiz? You can only do this once.')) return;

  state.qqq.submitted = { ...quiz.hidden, ...answers, 'time-taken': String(Math.round((Date.now() - state.qqq.startedAt) / 1000)) };
  // The app can't read another site's pages, so QuizQuizQuiz's results page is shown in a frame.
  postToQqq(quiz.submitUrl, state.qqq.submitted, 'qqq-results-frame');
  e.target.querySelectorAll('input, button').forEach((el) => (el.disabled = true));
  $('#qqq-results').hidden = false;
  $('#qqq-results').scrollIntoView({ behavior: 'smooth' });

  const done = store.get('qqq.done', {});
  done[quiz.quizId] = new Date().toISOString();
  store.set('qqq.done', done);
  renderQqqCard();
});

// A normal form post, exactly like the one on QuizQuizQuiz's own page.
function postToQqq(url, fields, target) {
  const form = document.createElement('form');
  form.method = 'post';
  form.action = url;
  form.target = target;
  form.acceptCharset = 'UTF-8';
  for (const [name, value] of Object.entries(fields)) {
    const input = document.createElement('input');
    input.type = 'hidden';
    input.name = name;
    input.value = value;
    form.appendChild(input);
  }
  document.body.appendChild(form);
  form.submit();
  form.remove();
}

// ---------- Other weekly quizzes ----------
// mode 'play': questions and answers are imported, so the quiz is played in the app.
// mode 'link': the quiz only runs on the publisher's own site, so the app links to it.
const WEEKLY = {
  guardian: {
    name: 'Guardian Saturday Quiz', icon: '📘', bg: '#052962', fg: '#ffffff', mode: 'play',
    about: 'Fifteen questions from Thomas Eaton, ending with a “What links” round. Think of your answer, reveal it, then mark yourself.',
    prefix: /\s*[-–|:]?\s*the saturday quiz\s*$/i,
  },
  theweek: {
    name: 'The Week: Quiz of the Week', icon: '🗞️', bg: '#1d1d1b', fg: '#ffffff', mode: 'link', site: 'The Week',
    prefix: /^quiz of the week:\s*/i,
  },
  bbc: {
    name: 'BBC News Quiz of the Week', icon: '📰', bg: '#b80000', fg: '#ffffff', mode: 'link', site: 'the BBC',
    prefix: /^(bbc news )?(weekly quiz|quiz of the week):\s*/i,
  },
  bbcsport: {
    name: 'BBC Sport Weekly Quiz', icon: '🏆', bg: '#ffd230', fg: '#1a1a1a', mode: 'link', site: 'BBC Sport',
    prefix: /^(bbc sport )?weekly sports? quiz:\s*/i,
  },
  national: {
    name: 'The National: Sport Quiz of the Week', icon: '🏅', bg: '#004e79', fg: '#ffffff', mode: 'link', site: 'The National',
    prefix: /^sport quiz of the week:\s*/i,
  },
};
state.weekly = {};

const weeklyHeadline = (key, title) => (title || '').replace(WEEKLY[key].prefix, '').trim() || title;
const weeklyDate = (q) => (q.publishedAt ? new Date(q.publishedAt).toLocaleDateString(undefined, { weekday: 'long', day: 'numeric', month: 'long' }) : '');
const weeklyDone = (key) => store.get(`${key}.opened`, {});
const guardianResults = () => store.get('guardian', {});

// In the installed app, a same-window link opens in the app's built-in browser (iPhone: a
// sheet with Done; Android: a bar with ✕), so you come straight back here. In an ordinary
// browser tab it opens a new tab instead, leaving the app where it was.
const externalLinkAttrs = () => (isStandalone() ? '' : ' target="_blank" rel="noopener"');

$('#weekly-cards').innerHTML = Object.entries(WEEKLY)
  .map(
    ([key, w]) => `<button class="card card-weekly" data-weekly="${key}" style="--card-bg:${w.bg};--card-fg:${w.fg}">
        <span class="card-icon">${w.icon}</span>
        <span class="card-body">
          <span class="card-title">${escapeHtml(w.name)}</span>
          <span class="card-sub">Checking for this week's quiz…</span>
        </span>
        <span class="badge" hidden>NEW</span>
      </button>`,
  )
  .join('');

async function loadWeekly() {
  await Promise.all(
    Object.keys(WEEKLY).map(async (key) => {
      try {
        const res = await fetch(`data/${key}/index.json?t=${Math.floor(Date.now() / 60000)}`, { cache: 'no-store' });
        state.weekly[key] = res.ok ? await res.json() : { quizzes: [] };
      } catch {
        state.weekly[key] ||= { quizzes: [] };
      }
    }),
  );
  renderWeeklyCards();
  if (current === 'weekly') renderWeekly(state.weekly.key, state.weekly.shownId);
}

function renderWeeklyCards() {
  for (const [key, w] of Object.entries(WEEKLY)) {
    const card = $(`.card-weekly[data-weekly="${key}"]`);
    const data = state.weekly[key];
    if (!card || !data) continue;
    const latest = data.quizzes[0];
    const score = latest && w.mode === 'play' && guardianResults()[latest.id];
    const done = latest && (score || weeklyDone(key)[latest.id]);
    const action = w.mode === 'link' ? `tap to play on ${w.site}` : `${latest?.questions?.length || ''} questions · tap to play`;
    card.querySelector('.card-sub').textContent = !latest
      ? 'A new quiz lands here every week.'
      : `${weeklyHeadline(key, latest.title)} · ${score ? `you scored ${score.score}/${score.total}` : done ? 'played' : action}`;
    card.querySelector('.badge').hidden = !latest || Boolean(done);
  }
}

$('#weekly-cards').addEventListener('click', (e) => {
  const card = e.target.closest('[data-weekly]');
  if (!card) return;
  renderWeekly(card.dataset.weekly);
  TITLES.weekly = WEEKLY[card.dataset.weekly].name;
  show('weekly');
});

function markWeeklyPlayed(key, id) {
  const done = weeklyDone(key);
  done[id] = new Date().toISOString();
  store.set(`${key}.opened`, done);
  renderWeeklyCards();
}

function renderWeekly(key, shownId = null) {
  const w = WEEKLY[key];
  const quizzes = state.weekly[key]?.quizzes || [];
  const quiz = quizzes.find((q) => q.id === shownId) || quizzes[0];
  Object.assign(state.weekly, { key, shownId: quiz?.id || null });
  const body = $('#weekly-body');
  body.style.setProperty('--card-bg', w.bg);
  body.style.setProperty('--card-fg', w.fg);
  if (!quiz) {
    body.innerHTML = `<div class="joe-hero weekly-hero"><h2>No quiz yet</h2><p>This week's quiz will appear here as soon as it's published.</p></div>`;
  } else {
    const isLatest = quiz === quizzes[0];
    const score = guardianResults()[quiz.id];
    let action = '';
    if (w.mode === 'play') {
      action = `${score ? `<p class="done">You scored <b>${score.score}/${score.total}</b></p>` : ''}
        <button class="primary-btn" data-weekly-play="${escapeHtml(quiz.id)}">${score ? 'Play again' : `Play ${quiz.questions.length} questions`}</button>
        <a class="secondary-btn full" href="${escapeAttr(quiz.url)}" target="_blank" rel="noopener">Read it on the Guardian ↗</a>`;
    } else {
      action = `<a class="primary-btn" href="${escapeAttr(quiz.url)}"${externalLinkAttrs()} data-weekly-open="${escapeHtml(quiz.id)}">Play the quiz</a>
        <p class="hint">${
          isStandalone()
            ? 'Opens in the app’s built-in browser. Tap Done (or ✕) to come back.'
            : `${escapeHtml(w.site)} only lets this quiz run on its own website, so it opens in a new tab. Add Quiz Night to your home screen to play it inside the app.`
        }</p>`;
    }
    body.innerHTML = `<div class="joe-hero weekly-hero">
        ${quiz.image ? `<img src="${escapeAttr(quiz.image)}" alt="" class="joe-img" referrerpolicy="no-referrer">` : ''}
        <p class="eyebrow">${isLatest ? 'This week' : 'Previous week'}${weeklyDate(quiz) ? ` · ${weeklyDate(quiz)}` : ''}</p>
        <h2>${escapeHtml(quiz.title)}</h2>
        ${w.about ? `<p>${escapeHtml(w.about)}</p>` : quiz.description ? `<p>${escapeHtml(quiz.description)}</p>` : ''}
        ${action}
      </div>`;
  }
  const others = quizzes.filter((q) => q !== quiz);
  const results = guardianResults();
  const played = weeklyDone(key);
  $('#weekly-list').innerHTML = others.length
    ? others
        .map((q) => {
          const label = results[q.id] ? `${results[q.id].score}/${results[q.id].total}` : played[q.id] ? 'Again' : 'Play';
          const button =
            w.mode === 'link'
              ? `<a class="small-btn" href="${escapeAttr(q.url)}"${externalLinkAttrs()} data-weekly-open="${escapeHtml(q.id)}">${label}</a>`
              : `<button class="small-btn" data-weekly-show="${escapeHtml(q.id)}">${label}</button>`;
          return `<li><span><b>${escapeHtml(weeklyHeadline(key, q.title))}</b><small>${escapeHtml(weeklyDate(q))}</small></span>${button}</li>`;
        })
        .join('')
    : '<li class="empty">Past quizzes will build up here each week.</li>';
}

$('#screen-weekly').addEventListener('click', (e) => {
  const { key } = state.weekly;
  const el = e.target.closest('[data-weekly-open], [data-weekly-show], [data-weekly-play]');
  if (!el) return;
  if (el.dataset.weeklyOpen) {
    markWeeklyPlayed(key, el.dataset.weeklyOpen);
    setTimeout(() => renderWeekly(key, state.weekly.shownId), 300);
  } else if (el.dataset.weeklyShow) {
    renderWeekly(key, el.dataset.weeklyShow);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  } else if (el.dataset.weeklyPlay) {
    playGuardian(state.weekly[key].quizzes.find((q) => q.id === el.dataset.weeklyPlay));
  }
});

function playGuardian(quiz) {
  const play = () =>
    startQuiz({
      title: `Guardian Saturday Quiz · ${weeklyDate(quiz)}`,
      questions: quiz.questions.map((q) => ({ q: q.q, answerText: q.answer, category: q.category || `Question ${q.number}` })),
      replay: play,
      onFinish: (score, total) => {
        const results = guardianResults();
        if (!results[quiz.id] || score > results[quiz.id].score) results[quiz.id] = { score, total, date: new Date().toISOString(), title: quiz.title };
        store.set('guardian', results);
        renderWeeklyCards();
      },
    });
  play();
}

// ---------- Playing ----------
// Questions are multiple choice ({options, answer}) or, for quizzes with written answers,
// reveal-and-mark-yourself ({answerText}).
function startQuiz({ title, questions, note = '', joeWeek = null, replay = null, onFinish = null }) {
  state.quiz = { title, questions, note, joeWeek, replay, onFinish, idx: 0, score: 0, picks: [] };
  const n = $('#quiz-note');
  n.textContent = note;
  n.hidden = !note;
  renderQuestion();
  show('play');
}

function renderQuestion() {
  const qz = state.quiz;
  const q = qz.questions[qz.idx];
  $('#q-count').textContent = `Question ${qz.idx + 1} of ${qz.questions.length}`;
  $('#q-score').textContent = `Score ${qz.score}`;
  $('#progress-bar').style.width = `${(qz.idx / qz.questions.length) * 100}%`;
  $('#q-category').textContent = prettyCategory(q.category);
  $('#q-text').textContent = q.q;
  const img = $('#q-image');
  img.hidden = !q.image;
  if (q.image) img.src = q.image;
  else img.removeAttribute('src');
  $('#next-btn').hidden = true;
  if (qz.idx > 0) $('#quiz-note').hidden = true;
  if (q.answerText != null) {
    $('#options').className = 'options reveal-options';
    $('#options').innerHTML = `<div class="answer-box"><span>Answer</span>${escapeHtml(q.answerText)}</div>
      <div class="mark-row">
        <button class="option mark" data-mark="1">✓ Got it</button>
        <button class="option mark" data-mark="0">✗ Missed it</button>
      </div>`;
    $('#options').hidden = true;
    $('#reveal-btn').textContent = 'Show the answer';
    $('#reveal-btn').hidden = false;
    return;
  }
  const hasImageOptions = q.options.some((o) => o.image);
  $('#options').className = `options${hasImageOptions ? ' image-options' : ''}`;
  $('#options').innerHTML = q.options
    .map(
      (o, i) => `<button class="option" data-i="${i}">
        <span class="letter">${'ABCDEFGHIJ'[i]}</span>
        ${o.image ? `<img src="${escapeAttr(o.image)}" alt="" referrerpolicy="no-referrer">` : ''}
        <span class="opt-text">${escapeHtml(o.text)}</span>
      </button>`,
    )
    .join('');
  // JOE quizzes play like a pub quiz: think of your answer, then reveal the options.
  const hideOptions = qz.joeWeek != null;
  $('#options').hidden = hideOptions;
  $('#reveal-btn').textContent = 'Reveal the options';
  $('#reveal-btn').hidden = !hideOptions;
}

$('#reveal-btn').addEventListener('click', () => {
  $('#reveal-btn').hidden = true;
  $('#options').hidden = false;
});

$('#options').addEventListener('click', (e) => {
  const btn = e.target.closest('.option');
  const qz = state.quiz;
  if (!btn || !qz || qz.picks.length > qz.idx) return;
  const q = qz.questions[qz.idx];
  let right;
  if (btn.dataset.mark != null) {
    right = btn.dataset.mark === '1';
    qz.picks.push(right);
    $$('#options .option').forEach((b) => (b.disabled = true));
    btn.classList.add(right ? 'correct' : 'wrong');
  } else {
    const pick = Number(btn.dataset.i);
    qz.picks.push(pick);
    right = pick === q.answer;
    $$('#options .option').forEach((b, i) => {
      b.disabled = true;
      if (i === q.answer) b.classList.add('correct');
      else if (i === pick) b.classList.add('wrong');
    });
  }
  if (right) qz.score++;
  else navigator.vibrate?.(120);
  $('#q-score').textContent = `Score ${qz.score}`;
  $('#progress-bar').style.width = `${((qz.idx + 1) / qz.questions.length) * 100}%`;
  const next = $('#next-btn');
  next.textContent = qz.idx + 1 < qz.questions.length ? 'Next question' : 'See results';
  next.hidden = false;
  next.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
});

$('#next-btn').addEventListener('click', () => {
  const qz = state.quiz;
  qz.idx++;
  if (qz.idx < qz.questions.length) {
    renderQuestion();
    window.scrollTo({ top: 0, behavior: 'smooth' });
  } else finishQuiz();
});

function finishQuiz() {
  const qz = state.quiz;
  const total = qz.questions.length;
  const pct = qz.score / total;
  $('#result-score').textContent = `${qz.score}/${total}`;
  $('#result-msg').textContent =
    pct === 1 ? 'Perfect score! Drinks are on you. 🏆' : pct >= 0.8 ? 'Superb — quiz team captain material.' : pct >= 0.5 ? 'Solid effort! 🍻' : pct >= 0.25 ? 'Not bad — there\'s always next week.' : 'Ouch. Maybe stick to the crisps. 🥔';
  $('#review').innerHTML = qz.questions
    .map((q, i) => {
      if (q.answerText != null) {
        const ok = qz.picks[i] === true;
        return `<li class="${ok ? 'ok' : 'bad'}">
          <p>${escapeHtml(q.q)}</p>
          <small>${ok ? '✓ Got it' : '✗ Missed it'} · Answer: <b>${escapeHtml(q.answerText)}</b></small>
        </li>`;
      }
      const ok = qz.picks[i] === q.answer;
      return `<li class="${ok ? 'ok' : 'bad'}">
        <p>${escapeHtml(q.q)}</p>
        <small>${ok ? '✓' : `✗ You said: ${escapeHtml(q.options[qz.picks[i]]?.text || '—')} ·`} Answer: <b>${escapeHtml(q.options[q.answer].text || 'picture ' + 'ABCDEFGHIJ'[q.answer])}</b></small>
      </li>`;
    })
    .join('');

  const past = store.get('history', []);
  past.unshift({ title: qz.title, score: qz.score, total, date: new Date().toISOString() });
  store.set('history', past.slice(0, 50));
  if (qz.joeWeek != null) {
    const joe = joeResults();
    const prev = joe[qz.joeWeek];
    if (!prev || qz.score > prev.score) joe[qz.joeWeek] = { score: qz.score, total, date: new Date().toISOString() };
    store.set('joe', joe);
  }
  qz.onFinish?.(qz.score, total);
  $('#again-btn').hidden = !qz.replay;
  show('results');
}

$('#again-btn').addEventListener('click', () => state.quiz?.replay?.());
$('#home-btn').addEventListener('click', () => show('home'));
$('#share-btn').addEventListener('click', async () => {
  const qz = state.quiz;
  const text = `I scored ${qz.score}/${qz.questions.length} on "${qz.title}" in Quiz Night!`;
  try {
    if (navigator.share) await navigator.share({ text, url: location.href.split('#')[0] });
    else {
      await navigator.clipboard.writeText(text);
      toast('Copied to clipboard');
    }
  } catch {}
});

// ---------- Helpers ----------
function prettyCategory(c) {
  if (!c) return '';
  const known = GENERAL_CATEGORIES.find((x) => x.id === c);
  if (known) return known.label;
  if (c === 'sport_and_leisure') return 'Sport';
  return c.replace(/_/g, ' ').replace(/\b\w/g, (m) => m.toUpperCase());
}

function escapeHtml(s) {
  return String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);
}

function escapeAttr(s) {
  const v = String(s ?? '');
  return /^(https?:|\/|data\/)/i.test(v) ? escapeHtml(v) : '#';
}

// ---------- Install hint & offline support ----------
function isStandalone() {
  return matchMedia('(display-mode: standalone)').matches || navigator.standalone === true;
}

function showInstallHint() {
  if (isStandalone() || store.get('hideInstall', false)) return;
  const ios = /iphone|ipad|ipod/i.test(navigator.userAgent);
  const el = $('#install-hint');
  el.innerHTML = `📲 Add Quiz Night to your home screen: ${ios ? 'tap <b>Share</b> then <b>Add to Home Screen</b>' : 'open the browser menu and tap <b>Install app</b> / <b>Add to Home screen</b>'}. <button class="link-btn" id="hide-install">Dismiss</button>`;
  el.hidden = false;
  $('#hide-install').addEventListener('click', () => {
    store.set('hideInstall', true);
    el.hidden = true;
  });
}

if ('serviceWorker' in navigator) {
  navigator.serviceWorker.register('sw.js', { updateViaCache: 'none' }).catch(() => {});
}

history.replaceState({ screen: 'home' }, '');
show('home', { push: false });
showInstallHint();
loadJoe();
loadQqq();
loadWeekly();
