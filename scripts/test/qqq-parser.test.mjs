import { test } from 'node:test';
import assert from 'node:assert/strict';
import { parseQqqPage } from '../qqq-parser.mjs';

// Trimmed from the real page (16 October 2026).
const html = `<html><head><title>Friday Quiz | QuizQuizQuiz</title></head><body>
<div class="online-quiz"><h1>The QuizQuizQuiz Friday Quiz, 16th October 2026</h1>
<form method="post" action="submit" accept-charset="UTF-8" id="quiz-form">
<div class="quiz-page visible"><p>If you enjoy our free Friday quiz, please consider buying one of our Quiz books: </p>
<p><b>The Daily Quiz Book</b></p><p class="buttons"><a href="#" class="jump next">Next</a></p></div>
<div class="quiz-page">
<p><b>1. Moyer, damson and greengage are types of which fruit?</b></p>
<p><input name="answer-1-0" type="text"><br></p><hr><p><b>2. What profession links Hannah Spencer and Rob Kenyon?</b></p>
<p><input name="answer-2-0" type="text"><br></p><hr><p><b>5. Name five of the ten cities with the world's oldest metro systems.
</b></p>
<p>Metro system 1: &#160; <input name="answer-5-0" type="text"><br>Metro system 2: &#160; <input name="answer-5-1" type="text"><br></p><hr>
<input type="hidden" name="quiz_id" value="1303">
<input type="hidden" name="email" value="">
<input type="hidden" name="key" value="">
<input type="hidden" name="time-taken" id="time-taken" value="0">
<p class="confirmation"><input id="confirm" type="checkbox"><label for="confirm"><strong>Please tick this box to confirm that you are ready to submit your answers.</strong></label></p>
<p class="buttons"><input type="submit" disabled id="quiz-submit" value="Done - show answers!"></p>
</div></form></div></body></html>`;

test('reads the QuizQuizQuiz Friday Quiz form', () => {
  const quiz = parseQqqPage(html, 'https://quizquizquiz.com/friday/');
  assert.equal(quiz.title, 'The QuizQuizQuiz Friday Quiz, 16th October 2026');
  assert.equal(quiz.quizId, '1303');
  assert.equal(quiz.submitUrl, 'https://quizquizquiz.com/friday/submit');
  assert.deepEqual(quiz.hidden, { quiz_id: '1303', email: '', key: '', 'time-taken': '0' });
  assert.deepEqual(
    quiz.questions.map((q) => [q.number, q.q, q.fields]),
    [
      [1, 'Moyer, damson and greengage are types of which fruit?', [{ name: 'answer-1-0', label: '' }]],
      [2, 'What profession links Hannah Spencer and Rob Kenyon?', [{ name: 'answer-2-0', label: '' }]],
      [
        5,
        "Name five of the ten cities with the world's oldest metro systems.",
        [
          { name: 'answer-5-0', label: 'Metro system 1' },
          { name: 'answer-5-1', label: 'Metro system 2' },
        ],
      ],
    ],
  );
});

test('returns null when there is no quiz form', () => {
  assert.equal(parseQqqPage('<html><body>Just a moment...</body></html>', 'https://quizquizquiz.com/friday/'), null);
});
