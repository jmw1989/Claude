// Turns the QuizQuizQuiz Friday Quiz page (https://quizquizquiz.com/friday/) into JSON.
// Questions are numbered <b> paragraphs, each followed by one or more text boxes.
// The answers aren't on the page: they're shown after the form is submitted.
import * as cheerio from 'cheerio';

const clean = (s) => (s || '').replace(/\s+/g, ' ').trim();

export function parseQqqPage(html, pageUrl) {
  const $ = cheerio.load(html);
  const form = $('form#quiz-form').first();
  if (!form.length) return null;

  const title = clean($('.online-quiz h1').first().text()) || clean($('title').text());
  const hidden = {};
  form.find('input[type=hidden]').each((_, el) => {
    hidden[$(el).attr('name')] = $(el).attr('value') || '';
  });

  const questions = [];
  let current = null;
  // Walk the form in document order so text boxes attach to the question above them.
  form.find('b, strong, input[type=text], img').each((_, el) => {
    const $el = $(el);
    if (el.tagName === 'input') {
      const name = $el.attr('name');
      if (!current || !/^answer-/.test(name || '')) return;
      const prev = el.prev && el.prev.type === 'text' ? clean(el.prev.data) : '';
      current.fields.push({ name, label: prev.replace(/:$/, '') });
    } else if (el.tagName === 'img') {
      if (current && !current.image) current.image = new URL($el.attr('src'), pageUrl).href;
    } else {
      const m = /^(\d+)\.\s*([\s\S]+)$/.exec(clean($el.text()));
      if (!m || $el.closest('.confirmation').length) return;
      current = { number: Number(m[1]), q: m[2], image: null, fields: [] };
      questions.push(current);
    }
  });

  return {
    title,
    quizId: hidden.quiz_id || null,
    submitUrl: new URL(form.attr('action') || 'submit', pageUrl).href,
    hidden,
    questions: questions.filter((q) => q.fields.length),
  };
}
