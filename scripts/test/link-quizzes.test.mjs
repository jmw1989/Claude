import { test } from 'node:test';
import assert from 'node:assert/strict';
import { LINK_SOURCES, listQuizLinks, parseArticleMeta } from '../link-quizzes.mjs';

test('lists BBC News quizzes from the topic page, newest first', () => {
  const html = `<main>
    <a href="/news/articles/cmx2qpj72znwo"><h2>Weekly quiz: How long did Katie Zacharia last as White House press secretary?</h2><p>How much attention did you pay?</p></a>
    <a href="/news/articles/cmx2qpj72znwo"><img alt=""></a>
    <a href="/news/articles/c3gr85dl78y4o"><h2>Weekly quiz: Which star is lending his voice to Gromit?</h2></a>
    <a href="/news/articles/cabc123"><h2>Storm warning issued</h2></a>
  </main>`;
  assert.deepEqual(listQuizLinks(html, 'https://www.bbc.co.uk/news/topics/crxd18199v9t', LINK_SOURCES.bbc), [
    { id: 'cmx2qpj72znwo', url: 'https://www.bbc.co.uk/news/articles/cmx2qpj72znwo', title: 'Weekly quiz: How long did Katie Zacharia last as White House press secretary?' },
    { id: 'c3gr85dl78y4o', url: 'https://www.bbc.co.uk/news/articles/c3gr85dl78y4o', title: 'Weekly quiz: Which star is lending his voice to Gromit?' },
  ]);
});

test('lists only the weekly BBC Sport quiz', () => {
  const html = `<a href="/sport/articles/cqvgr7530085o"><p><span>Quiz: Do you remember the big names?</span></p></a>
    <a href="/sport/articles/c6vg0d4g051eo"><p><span>Weekly sports quiz: How much is the cheapest Fury v Joshua ticket?</span></p></a>`;
  assert.deepEqual(listQuizLinks(html, 'https://www.bbc.co.uk/sport/quizzes', LINK_SOURCES.bbcsport).map((q) => q.id), ['c6vg0d4g051eo']);
});

test('finds The Week and The National quiz links', () => {
  const week = `<a href="https://theweek.com/puzzles/quiz-of-the-week-10-16-october">Quiz of The Week</a><a href="https://theweek.com/puzzles/sudoku">x</a>`;
  assert.deepEqual(listQuizLinks(week, 'https://theweek.com/tag/quiz-of-the-week', LINK_SOURCES.theweek).map((q) => q.id), ['quiz-of-the-week-10-16-october']);
  const national = `<a href="/sport/2026/10/19/sport-quiz-of-the-week-october-19-2026/">Sport quiz of the week</a>`;
  const [q] = listQuizLinks(national, 'https://www.thenationalnews.com/sport/', LINK_SOURCES.national);
  assert.equal(q.url, 'https://www.thenationalnews.com/sport/2026/10/19/sport-quiz-of-the-week-october-19-2026/');
  assert.equal(q.id, 'sport-quiz-of-the-week-october-19-2026');
});


test('reads article details from meta tags and JSON-LD', () => {
  const html = `<html><head>
    <meta property="og:title" content="Weekly quiz: Which star is lending his voice to Gromit?">
    <meta property="og:description" content="How much attention did you pay?">
    <meta property="og:image" content="https://ichef.bbci.co.uk/news/1024/quiz.jpg">
    <script type="application/ld+json">{"@type":"ReportageNewsArticle","datePublished":"2026-10-16T17:00:00.000Z"}</script>
    </head><body><h1>Weekly quiz</h1></body></html>`;
  assert.deepEqual(parseArticleMeta(html), {
    title: 'Weekly quiz: Which star is lending his voice to Gromit?',
    description: 'How much attention did you pay?',
    image: 'https://ichef.bbci.co.uk/news/1024/quiz.jpg',
    publishedAt: '2026-10-16T17:00:00.000Z',
  });
});
