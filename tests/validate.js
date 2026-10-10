/*
 * データと問題ジェネレーターの検証
 *   node tests/validate.js
 * すべてのプロバイダーで大量に問題を生成し、5択・正解1つ・重複なし・参照ノートの存在などを確認する。
 */
'use strict';
const fs = require('fs');
const path = require('path');
const vm = require('vm');

const root = path.join(__dirname, '..');
const files = ['js/util.js', 'js/data/topics.js', 'js/data/notes.js', 'js/data/substances.js', 'js/data/statements.js', 'js/generators.js', 'js/storage.js', 'js/engine.js'];

const mem = {};
const ctx = { console, Math, Date, JSON, Set, Map, Object, Array, String, Number, Error };
ctx.window = ctx;
ctx.localStorage = { getItem: (k) => mem[k] || null, setItem: (k, v) => (mem[k] = v) };
vm.createContext(ctx);
files.forEach((f) => vm.runInContext(fs.readFileSync(path.join(root, f), 'utf8'), ctx, { filename: f }));
const O = ctx.OTSU;

let errors = 0;
const fail = (msg) => {
  errors++;
  if (errors < 40) console.error('NG:', msg);
};

// 1. 正誤バンクの記述が重複していないか
const seen = new Map();
O.BANKS.forEach((b) => {
  if (!O.TOPICS[b.topic]) fail(`${b.id}: unknown topic ${b.topic}`);
  b.items.forEach((it) => {
    if (!it.ok && !it.fix) fail(`${b.id}: false statement without fix: ${it.t}`);
    const k = b.id + it.t;
    if (seen.has(k)) fail(`${b.id}: duplicate statement ${it.t}`);
    seen.set(k, true);
  });
});

// 2. 全分野にプロバイダーがあるか
Object.keys(O.TOPICS).forEach((t) => {
  if (!O.byTopic[t] || !O.byTopic[t].length) fail(`topic ${t} has no provider`);
  if (!O.NOTES[t]) fail(`topic ${t} has no note`);
});

// 3. 各プロバイダーで大量生成
const N = Number(process.env.N || 300);
const counts = {};
O.PROVIDERS.forEach((p) => {
  const sigs = new Set();
  for (let i = 0; i < N; i++) {
    let q;
    try {
      q = p.make();
    } catch (e) {
      fail(`${p.id}: ${e.message}`);
      continue;
    }
    if (q.choices.length !== 5) fail(`${p.id}: choices ${q.choices.length}`);
    if (q.choices.filter((c) => c.ok).length !== 1) fail(`${p.id}: correct count`);
    if (q.answer < 0 || !q.choices[q.answer].ok) fail(`${p.id}: answer index`);
    const texts = q.choices.map((c) => c.t);
    if (new Set(texts).size !== 5) fail(`${p.id}: duplicate choices ${JSON.stringify(texts)}`);
    if (q.list && new Set(q.list.map((x) => x.t)).size !== q.list.length) fail(`${p.id}: duplicate list`);
    q.notes.forEach((n) => {
      if (!O.NOTES[n]) fail(`${p.id}: missing note ${n}`);
    });
    if (!q.stem || /undefined|NaN/.test(q.stem + texts.join() + q.exp + q.choices.map((c) => c.why).join())) fail(`${p.id}: bad text ${q.stem} / ${texts}`);
    sigs.add(q.sig);
  }
  counts[p.id] = sigs.size;
});

// 4. 試験の組立てと採点
for (let i = 0; i < 200; i++) {
  const qs = O.buildExam();
  if (qs.length !== 35) fail(`exam length ${qs.length}`);
  const bySub = {};
  qs.forEach((q) => (bySub[q.subject] = (bySub[q.subject] || 0) + 1));
  if (bySub.houki !== 15 || bySub.butsuka !== 10 || bySub.seishou !== 10) fail(`exam composition ${JSON.stringify(bySub)}`);
  if (new Set(qs.map((q) => q.sig)).size !== 35) fail('exam duplicate question');
  const allRight = O.gradeExam({ qs, answers: qs.map((q) => q.answer) });
  if (!allRight.pass || allRight.total !== 35) fail('grading all-correct');
  // 法令9・物化6・性消6 ちょうどで合格、どれか1つ欠けると不合格
  const need = { houki: 9, butsuka: 6, seishou: 6 };
  const ans = (miss) => {
    const left = Object.assign({}, need);
    if (miss) left[miss]--;
    return qs.map((q) => (left[q.subject]-- > 0 ? q.answer : (q.answer + 1) % 5));
  };
  if (!O.gradeExam({ qs, answers: ans(null) }).pass) fail('grading boundary pass');
  ['houki', 'butsuka', 'seishou'].forEach((s) => {
    if (O.gradeExam({ qs, answers: ans(s) }).pass) fail(`grading boundary fail ${s}`);
  });
}

// 5. 準備モード
O.store.data.topics = {};
for (let i = 0; i < 500; i++) {
  const q = O.nextPractice({ subject: ['all', 'houki', 'butsuka', 'seishou'][i % 4], weak: i % 2 === 0, recentPids: [], recentSigs: [] });
  if (!q) fail('practice returned null');
  O.store.record(q, Math.random() < 0.5);
}

// 6. 出題頻度の絞り込み
Object.values(O.TOPICS).forEach((t) => {
  if (!(t.freq >= 1 && t.freq <= 5)) fail(`topic ${t.id} has invalid freq ${t.freq}`);
});
['all', 'houki', 'butsuka', 'seishou'].forEach((subject) => {
  for (let f = 1; f <= 5; f++) {
    for (let i = 0; i < 60; i++) {
      const q = O.nextPractice({ subject, weak: i % 2 === 0, minFreq: f, recentPids: [], recentSigs: [] });
      if (O.TOPICS[q.topic].freq < f) fail(`minFreq ${f}: got ${q.topic}`);
      if (subject !== 'all' && q.subject !== subject) fail(`subject ${subject}: got ${q.subject}`);
    }
  }
});

const totalVariants = Object.values(counts).reduce((a, b) => a + b, 0);
console.log(`providers: ${O.PROVIDERS.length}, banks: ${O.BANKS.length}, statements: ${O.BANKS.reduce((a, b) => a + b.items.length, 0)}, substances: ${O.SUBSTANCES.length}`);
console.log(`distinct questions seen in ${N} draws/provider: ${totalVariants}`);
Object.keys(O.TOPICS).forEach((t) => {
  const ps = O.byTopic[t] || [];
  console.log(`  ${t.padEnd(12)} ${String(ps.length).padStart(2)} providers  ${ps.map((p) => `${p.id}(${counts[p.id]})`).join(' ')}`);
});
if (errors) {
  console.error(`\n${errors} error(s)`);
  process.exit(1);
}
console.log('\nOK');
