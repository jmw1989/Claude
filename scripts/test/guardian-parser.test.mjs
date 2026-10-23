import { test } from 'node:test';
import assert from 'node:assert/strict';
import { listGuardianQuizzes, parseGuardianQuiz } from '../guardian-parser.mjs';

test('lists Saturday quizzes from the series page', () => {
  const html = `<a href="/games/2026/oct/17/which-coffee-chain-was-founded-in-london-in-1971-the-saturday-quiz">a</a>
    <a href="https://www.theguardian.com/lifeandstyle/2026/oct/10/what-links-toothpaste-the-saturday-quiz">b</a>
    <a href="/info/2018/sep/17/guardian-us-morning-briefing">c</a>`;
  assert.deepEqual(listGuardianQuizzes(html), [
    { id: '2026-oct-17', url: 'https://www.theguardian.com/games/2026/oct/17/which-coffee-chain-was-founded-in-london-in-1971-the-saturday-quiz' },
    { id: '2026-oct-10', url: 'https://www.theguardian.com/lifeandstyle/2026/oct/10/what-links-toothpaste-the-saturday-quiz' },
  ]);
});

test('pairs questions with answers, including the "What links" round', () => {
  // Trimmed from the 17 October 2026 quiz.
  const html = `<html><head>
    <meta property="og:title" content="Which coffee chain was founded in London in 1971? The Saturday quiz">
    <meta property="article:published_time" content="2026-10-17T06:00:24.000Z"></head><body>
    <div data-gu-name="body">
    <p>From Divine, Frank Fiegel and Helen Kane, test your knowledge with the Saturday quiz</p>
    <h2>The questions</h2>
    <p><strong>1</strong> Which classic of political theory was dedicated to Lorenzo de Medici?<br>
    <strong>2</strong> What is the only jazz act to win the Mercury Music prize?<br>
    <strong>What links:</strong><br>
    <strong>9</strong> Divine; Frank Fiegel; Helen Kane?</p>
    <h2>The answers</h2>
    <p><strong>1</strong> The Prince by Niccolò Machiavelli.<br>
    <strong>2</strong> Ezra Collective.<br>
    <strong>9</strong> Inspired cartoon characters: Ursula; Popeye; Betty Boop.</p>
    </div></body></html>`;
  const quiz = parseGuardianQuiz(html);
  assert.equal(quiz.title, 'Which coffee chain was founded in London in 1971? The Saturday quiz');
  assert.equal(quiz.publishedAt, '2026-10-17T06:00:24.000Z');
  assert.deepEqual(quiz.questions, [
    { number: 1, q: 'Which classic of political theory was dedicated to Lorenzo de Medici?', answer: 'The Prince by Niccolò Machiavelli.', category: null },
    { number: 2, q: 'What is the only jazz act to win the Mercury Music prize?', answer: 'Ezra Collective.', category: null },
    { number: 9, q: 'Divine; Frank Fiegel; Helen Kane?', answer: 'Inspired cartoon characters: Ursula; Popeye; Betty Boop.', category: 'What links' },
  ]);
});
