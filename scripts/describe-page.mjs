// Prints a short outline of a page's structure to the log, so the parser can be
// adapted when JOE changes how its quizzes are built.
import * as cheerio from 'cheerio';

export function describePage(html) {
  const $ = cheerio.load(html);
  const lines = [`Page length: ${html.length}`];

  $('script').each((i, el) => {
    const body = $(el).html() || '';
    const attrs = Object.entries(el.attribs || {}).map(([k, v]) => `${k}=${v.slice(0, 80)}`).join(' ');
    if (body.length > 200 || /json/i.test(attrs)) lines.push(`script[${i}] ${attrs} len=${body.length}: ${body.slice(0, 160).replace(/\s+/g, ' ')}`);
  });
  $('iframe').each((_, el) => lines.push(`iframe src=${$(el).attr('src') || $(el).attr('data-src')}`));

  const classes = new Map();
  $('[class]').each((_, el) => {
    for (const c of ($(el).attr('class') || '').split(/\s+/)) {
      if (/quiz|question|answer|option|choice|correct|round|result/i.test(c)) classes.set(c, (classes.get(c) || 0) + 1);
    }
  });
  lines.push(`Quiz-like classes: ${[...classes].map(([c, n]) => `${c}×${n}`).join(', ') || 'none'}`);

  const dataAttrs = new Map();
  $('*').each((_, el) => {
    for (const k of Object.keys(el.attribs || {})) if (k.startsWith('data-')) dataAttrs.set(k, (dataAttrs.get(k) || 0) + 1);
  });
  lines.push(`data-* attributes: ${[...dataAttrs].sort((a, b) => b[1] - a[1]).slice(0, 40).map(([k, n]) => `${k}×${n}`).join(', ')}`);

  let shown = 0;
  for (const m of html.matchAll(/answer|correct|question/gi)) {
    if (shown++ >= 25) break;
    lines.push(`…${html.slice(Math.max(0, m.index - 150), m.index + 200).replace(/\s+/g, ' ')}…`);
  }
  const text = $('body').text().replace(/\s+/g, ' ');
  const q = text.search(/\?\s/);
  lines.push(`Body text sample: ${text.slice(Math.max(0, q - 600), q + 1200)}`);
  return lines.join('\n');
}
