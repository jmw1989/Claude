import { test } from 'node:test';
import assert from 'node:assert/strict';
import { findWeeklyQuizLinks, parseQuizPage, weekFromUrl } from '../joe-parser.mjs';

const page = (body, head = '') =>
  `<!doctype html><html><head><title>The JOE Friday Pub Quiz: week 525</title>
  <meta property="og:title" content="The JOE Friday Pub Quiz: week 525">
  <meta property="article:published_time" content="2026-10-16T08:00:00Z">${head}</head><body>${body}</body></html>`;

const sample = [
  { q: 'What is the capital of Australia?', options: ['Sydney', 'Canberra', 'Melbourne', 'Perth'], answer: 1 },
  { q: 'Who won the 2022 FIFA World Cup?', options: ['France', 'Brazil', 'Argentina', 'Croatia'], answer: 2 },
  { q: 'How many players in a rugby union team?', options: ['13', '15', '11', '7'], answer: 1 },
  { q: 'Which planet is known as the Red Planet?', options: ['Mars', 'Venus', 'Jupiter', 'Saturn'], answer: 0 },
];

function assertSample(result) {
  assert.equal(result.questions.length, sample.length);
  result.questions.forEach((q, i) => {
    assert.equal(q.q, sample[i].q);
    assert.deepEqual(q.options.map((o) => o.text), sample[i].options);
    assert.equal(q.answer, sample[i].answer);
  });
}

test('reads __NEXT_DATA__ with per-answer correct flags', () => {
  const data = {
    props: {
      pageProps: {
        article: {
          blocks: [
            { type: 'paragraph', html: '<p>Welcome!</p>' },
            {
              type: 'quiz',
              questions: sample.map((s, i) => ({
                id: i,
                title: s.q,
                answers: s.options.map((o, j) => ({ id: 100 + j, text: o, is_correct: j === s.answer })),
              })),
            },
          ],
        },
      },
    },
  };
  const html = page(`<script id="__NEXT_DATA__" type="application/json">${JSON.stringify(data)}</script>`);
  const result = parseQuizPage(html, 'https://www.joe.co.uk/quiz/the-joe-friday-pub-quiz-week-525-551000');
  assert.equal(result.strategy, 'embedded-json');
  assert.equal(result.publishedAt, '2026-10-16T08:00:00Z');
  assertSample(result);
});

test('reads a correctAnswer reference and question images', () => {
  const data = {
    quiz: {
      items: sample.map((s) => ({
        question: { text: s.q },
        image: { url: '/media/pic.jpg' },
        options: s.options,
        correctAnswer: s.options[s.answer],
      })),
    },
  };
  const html = page(`<script>window.__INITIAL_STATE__ = ${JSON.stringify(data)};</script>`);
  const result = parseQuizPage(html, 'https://www.joe.co.uk/quiz/x');
  assertSample(result);
  assert.equal(result.questions[0].image, 'https://www.joe.co.uk/media/pic.jpg');
});

test('reads Next.js flight (self.__next_f) payloads', () => {
  const block = { questions: sample.map((s) => ({ questionText: s.q, choices: s.options.map((o, j) => ({ label: o, correct: j === s.answer })) })) };
  const flight = `0:["$","div",null,{}]\n1a:["$","$L2",null,${JSON.stringify(block)}]\n`;
  const html = page(`<script>self.__next_f.push([1,${JSON.stringify(flight)}])</script>`);
  assertSample(parseQuizPage(html));
});

test('reads data-* attribute JSON', () => {
  const data = sample.map((s) => ({ text: s.q, answers: s.options.map((o, j) => ({ answer: o, isCorrect: j === s.answer })) }));
  const attr = JSON.stringify(data).replace(/"/g, '&quot;');
  assertSample(parseQuizPage(page(`<div data-quiz="${attr}"></div>`)));
});

test('reads schema.org Question markup', () => {
  const ld = {
    '@type': 'Quiz',
    hasPart: sample.map((s) => ({
      '@type': 'Question',
      name: s.q,
      acceptedAnswer: { '@type': 'Answer', text: s.options[s.answer] },
      suggestedAnswer: s.options.filter((_, j) => j !== s.answer).map((o) => ({ '@type': 'Answer', text: o })),
    })),
  };
  const result = parseQuizPage(page('', `<script type="application/ld+json">${JSON.stringify(ld)}</script>`));
  assert.equal(result.questions.length, sample.length);
  result.questions.forEach((q, i) => {
    assert.equal(q.options[q.answer].text, sample[i].options[sample[i].answer]);
    assert.equal(q.options.length, 4);
  });
});

test('falls back to HTML class names', () => {
  const body = sample
    .map(
      (s) => `<div class="quiz-question"><h3 class="quiz-question__title">${s.q}</h3><ul>${s.options
        .map((o, j) => `<li class="quiz-answer${j === s.answer ? ' quiz-answer--correct' : ''}">${o}</li>`)
        .join('')}</ul></div>`,
    )
    .join('');
  const result = parseQuizPage(page(`<main class="quiz">${body}</main>`));
  assert.equal(result.strategy, 'html');
  assertSample(result);
});

test('returns no questions for a page without a quiz', () => {
  const result = parseQuizPage(page('<p>Nothing to see here</p>'));
  assert.equal(result.questions.length, 0);
  assert.equal(result.title, 'The JOE Friday Pub Quiz: week 525');
});

test('finds weekly links newest first', () => {
  const html = `
    <a href="/quiz/the-joe-friday-pub-quiz-week-523-549987">523</a>
    <a href="https://www.joe.co.uk/quiz/the-joe-friday-pub-quiz-week-525-551234">525</a>
    <a href="/quiz/the-joe-friday-pub-quiz-week-524-550910">524</a>
    <a href="/quiz/some-other-quiz-123">other</a>`;
  const links = findWeeklyQuizLinks(html, 'https://www.joe.co.uk/quiz');
  assert.deepEqual(links.map((l) => l.week), [525, 524, 523]);
  assert.equal(links[0].url, 'https://www.joe.co.uk/quiz/the-joe-friday-pub-quiz-week-525-551234');
  assert.equal(links[1].url, 'https://www.joe.co.uk/quiz/the-joe-friday-pub-quiz-week-524-550910');
  assert.equal(weekFromUrl(links[2].url), 523);
});
