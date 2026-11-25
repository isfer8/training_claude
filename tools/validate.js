#!/usr/bin/env node
/* Validates the data files: run `node tools/validate.js` from the repo root.
 * Checks question structure, duplicate IDs, answer indexes, domains and bilingual fields.
 */
const fs = require('fs');
const path = require('path');
const vm = require('vm');

const root = path.join(__dirname, '..');
const ctx = { window: {} };
vm.createContext(ctx);
const load = f => vm.runInContext(fs.readFileSync(path.join(root, f), 'utf8'), ctx, { filename: f });

load('data/domains.js');
load('data/glossary.js');
const qdir = path.join(root, 'data/questions');
fs.readdirSync(qdir).filter(f => f.endsWith('.js')).sort().forEach(f => load('data/questions/' + f));

const domains = ctx.window.DOMAINS;
const questions = ctx.window.QUESTIONS;
const errors = [];
const warn = [];
const domainIds = new Set(domains.map(d => d.id));
const isPair = v => typeof v === 'string' || (Array.isArray(v) && v.length === 2 && v.every(s => typeof s === 'string' && s.trim()));

// Every question file must be referenced in index.html
const html = fs.readFileSync(path.join(root, 'index.html'), 'utf8');
fs.readdirSync(qdir).filter(f => f.endsWith('.js')).forEach(f => {
  if (!html.includes('data/questions/' + f)) errors.push(`index.html does not load data/questions/${f}`);
});

const weightSum = domains.reduce((s, d) => s + d.weight, 0);
if (Math.abs(weightSum - 100) > 0.5) errors.push(`Domain weights add up to ${weightSum}, expected ~100`);

const seen = new Set();
const posCount = {};
questions.forEach((q, i) => {
  const tag = q.id || `#${i}`;
  if (!q.id) errors.push(`${tag}: missing id`);
  if (seen.has(q.id)) errors.push(`${tag}: duplicate id`);
  seen.add(q.id);
  if (!domainIds.has(q.d)) errors.push(`${tag}: unknown domain "${q.d}"`);
  if (!['s', 'm'].includes(q.t)) errors.push(`${tag}: t must be "s" or "m"`);
  if (![1, 2, 3].includes(q.lvl)) errors.push(`${tag}: lvl must be 1, 2 or 3`);
  if (!isPair(q.q)) errors.push(`${tag}: q must be [en, es]`);
  if (!isPair(q.x)) errors.push(`${tag}: x (explanation) must be [en, es]`);
  if (!Array.isArray(q.o) || q.o.length < 3 || q.o.length > 6) errors.push(`${tag}: needs 3-6 options`);
  else q.o.forEach((o, j) => { if (!isPair(o)) errors.push(`${tag}: option ${j} must be [en, es] or a string`); });
  if (!Array.isArray(q.a) || !q.a.length) errors.push(`${tag}: a must be a non-empty array`);
  else {
    q.a.forEach(k => { if (!(k >= 0 && k < (q.o || []).length)) errors.push(`${tag}: answer index ${k} out of range`); });
    if (new Set(q.a).size !== q.a.length) errors.push(`${tag}: duplicate answer index`);
    if (q.t === 's' && q.a.length !== 1) errors.push(`${tag}: single-answer question must have exactly 1 answer`);
    if (q.t === 'm' && q.a.length < 2) errors.push(`${tag}: multi-answer question needs 2+ answers`);
    if (q.t === 'm' && !/select (two|three|\d)/i.test(Array.isArray(q.q) ? q.q[0] : q.q)) warn.push(`${tag}: multi question should say "Select TWO" etc.`);
    if (q.t === 's') posCount[q.a[0]] = (posCount[q.a[0]] || 0) + 1;
  }
  if (q.ref && !/^https:\/\//.test(q.ref)) errors.push(`${tag}: ref must be an https URL`);
  // basic HTML balance check for <code>
  const all = JSON.stringify([q.q, q.o, q.x]);
  const open = (all.match(/<code>/g) || []).length, close = (all.match(/<\/code>/g) || []).length;
  if (open !== close) errors.push(`${tag}: unbalanced <code> tags`);
});

console.log(`Domains: ${domains.length} (weights sum ${weightSum.toFixed(1)}%)`);
console.log(`Glossary: ${ctx.window.GLOSSARY.terms.length} terms, ${ctx.window.GLOSSARY.phrases.length} phrases`);
console.log(`Questions: ${questions.length} (${questions.filter(q => q.t === 'm').length} multi-answer)`);
domains.forEach(d => {
  const n = questions.filter(q => q.d === d.id).length;
  console.log(`  ${d.id.padEnd(11)} ${String(n).padStart(3)} questions  (${d.weight}% → ~${Math.round(d.weight / 100 * 53)} in a 53-question mock)`);
});
console.log('Correct-option position (single-answer, before shuffling):', posCount, '— options are shuffled at runtime.');
warn.forEach(w => console.log('WARN ', w));
if (errors.length) {
  errors.forEach(e => console.error('ERROR', e));
  process.exit(1);
}
console.log('OK — no errors.');
