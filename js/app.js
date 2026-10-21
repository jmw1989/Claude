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
  renderJoeCard();
  renderQqqCard();
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
  sub.textContent = !latest
    ? 'A new quiz lands here every Friday.'
    : `${latest.title.replace(/^The QuizQuizQuiz Friday Quiz,?\s*/i, '')} · ${done ? 'answers submitted' : `${latest.questions.length} questions · tap to play`}`;
  $('#qqq-badge').hidden = !latest || Boolean(done);
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
      <a class="secondary-btn full" href="${escapeAttr(quiz.url)}" target="_blank" rel="noopener">Play on QuizQuizQuiz instead ↗</a>`;
  }

  const older = (state.qqq.index?.quizzes || []).filter((q) => q.quizId !== quiz?.quizId);
  $('#qqq-list').innerHTML = older.length
    ? older
        .map((q) => `<li><span><b>${escapeHtml(q.title.replace(/^The QuizQuizQuiz Friday Quiz,?\s*/i, ''))}</b><small>${q.count} questions</small></span><button class="small-btn" data-qqq="${escapeHtml(q.quizId)}">Open</button></li>`)
        .join('')
    : '<li class="empty">Past quizzes will build up here each week.</li>';
  state.qqq.startedAt = Date.now();
  state.qqq.submitted = null;
}

$('#screen-qqq').addEventListener('input', (e) => {
  const quiz = state.qqq.shown;
  if (!quiz || !e.target.name) return;
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

// ---------- Playing ----------
function startQuiz({ title, questions, note = '', joeWeek = null, replay = null }) {
  state.quiz = { title, questions, note, joeWeek, replay, idx: 0, score: 0, picks: [] };
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
  $('#reveal-btn').hidden = !hideOptions;
  $('#next-btn').hidden = true;
  if (qz.idx > 0) $('#quiz-note').hidden = true;
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
  const pick = Number(btn.dataset.i);
  qz.picks.push(pick);
  const right = pick === q.answer;
  if (right) qz.score++;
  else navigator.vibrate?.(120);
  $$('#options .option').forEach((b, i) => {
    b.disabled = true;
    if (i === q.answer) b.classList.add('correct');
    else if (i === pick) b.classList.add('wrong');
  });
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
function showInstallHint() {
  const standalone = matchMedia('(display-mode: standalone)').matches || navigator.standalone;
  if (standalone || store.get('hideInstall', false)) return;
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
