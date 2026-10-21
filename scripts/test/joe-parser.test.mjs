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

test('reads JOE WP Viral Quiz embeds, including rounds and the answer key', () => {
  const answer = (id, text) =>
    `<div class="wpvq-answer" data-wpvq-answer="${id}"> <!-- Weight+multiplier ID --> <input type="radio" class="vq-css-checkbox" data-wpvq-answer="${id}"> <label class="vq-css-label" data-wpvq-answer="${id}"> ${text} </label> </div>`;
  const question = (qid, label, img, answers) =>
    `<div class="wpvq-question wpvq-line" data-pageAfter="false" data-questionId="${qid}"> <div class="wpvq-question-label">${label}</div>
     <div style="position:relative;"><img width="1180" src="${img}" class="wpvq-question-img" alt=""></div>
     ${answers.join(' ')} <div class="wpvq-clear"></div> <div class="wpvq-explaination"><div class="wpvq-true">Correct!</div><div class="wpvq-false">Wrong!</div></div></div>`;
  const html = `<html><head><title>JOE</title></head><body class="wpvq-embed">
    <script type="text/javascript"> /* JS debug. */ var wpvq_js_debug = false; var wpvq_ans89733 = {"a9374":{"70093":"0","70091":"1","70092":"0","70094":"1","70095":"0","70096":"0","70106":"0","70107":"1","70108":"0"}}; var other = 1;</script>
    <div id="wpvq-quiz-1282" class="wpvq TrueFalse columns-3">
    ${question(1, 'ROUND 1: General Knowledge<br> <br> Which of these iconic products hit shelves first?', 'https://assets.joe.ie/uploads/2026/10/1-1.webp', [answer(70093, "Hellmann's Mayonaise"), answer(70091, "Colman's Mustard"), answer(70092, 'Heinz Ketchup')])}
    ${question(2, 'What is the capital of Bulgaria?', 'https://assets.joe.ie/2.webp', [answer(70094, 'Sofia'), answer(70095, 'Budapest'), answer(70096, 'Bucharest')])}
    ${question(3, 'ROUND 2: Sport<br> <br> When Liverpool signed Andy Carroll in 2011, how much did he cost?', 'https://assets.joe.ie/6.webp', [answer(70107, '£20 million'), answer(70106, '£35 million'), answer(70108, '£25 million')])}
    </div></body></html>`;
  const result = parseQuizPage(html, 'https://www.joe.ie/wpvq-embed/1282/');
  assert.equal(result.strategy, 'wpvq');
  assert.equal(result.questions.length, 3);
  const [q1, q2, q3] = result.questions;
  assert.equal(q1.q, 'Which of these iconic products hit shelves first?');
  assert.equal(q1.category, 'ROUND 1: General Knowledge');
  assert.equal(q1.options[q1.answer].text, "Colman's Mustard");
  assert.equal(q1.image, 'https://assets.joe.ie/uploads/2026/10/1-1.webp');
  assert.equal(q2.category, 'ROUND 1: General Knowledge');
  assert.equal(q2.options[q2.answer].text, 'Sofia');
  assert.equal(q3.category, 'ROUND 2: Sport');
  assert.equal(q3.q, 'When Liverpool signed Andy Carroll in 2011, how much did he cost?');
  assert.equal(q3.options[q3.answer].text, '£20 million');
});
