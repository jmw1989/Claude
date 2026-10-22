import { test } from 'node:test';
import assert from 'node:assert/strict';
import { parseBbcArticle, parseBbcTopic } from '../bbc-parser.mjs';

test('lists quiz articles from the BBC topic page, newest first', () => {
  const html = `<main>
    <a href="/news/articles/cmx2qpj72znwo"><h2>Weekly quiz: How long did Katie Zacharia last as White House press secretary?</h2><p>How much attention did you pay?</p></a>
    <a href="/news/articles/cmx2qpj72znwo"><img alt=""></a>
    <a href="/news/articles/c3gr85dl78y4o"><h2>Weekly quiz: Which star is lending his voice to Gromit?</h2></a>
    <a href="/news/articles/cabc123"><h2>Storm warning issued</h2></a>
  </main>`;
  assert.deepEqual(parseBbcTopic(html), [
    { id: 'cmx2qpj72znwo', url: 'https://www.bbc.co.uk/news/articles/cmx2qpj72znwo', title: 'Weekly quiz: How long did Katie Zacharia last as White House press secretary?' },
    { id: 'c3gr85dl78y4o', url: 'https://www.bbc.co.uk/news/articles/c3gr85dl78y4o', title: 'Weekly quiz: Which star is lending his voice to Gromit?' },
  ]);
});

test('reads a BBC quiz article', () => {
  const html = `<html><head>
    <meta property="og:title" content="Weekly quiz: Which star is lending his voice to Gromit?">
    <meta property="og:description" content="How much attention did you pay to what happened in the world over the past seven days?">
    <meta property="og:image" content="https://ichef.bbci.co.uk/news/1024/quiz.jpg">
    <script type="application/ld+json">{"@type":"ReportageNewsArticle","datePublished":"2026-10-16T17:00:00.000Z"}</script>
    </head><body><h1>Weekly quiz</h1><iframe src="https://www.riddle.com/embed/a/EI2j9RqT"></iframe></body></html>`;
  assert.deepEqual(parseBbcArticle(html), {
    title: 'Weekly quiz: Which star is lending his voice to Gromit?',
    description: 'How much attention did you pay to what happened in the world over the past seven days?',
    image: 'https://ichef.bbci.co.uk/news/1024/quiz.jpg',
    publishedAt: '2026-10-16T17:00:00.000Z',
    hasRiddle: true,
  });
});
