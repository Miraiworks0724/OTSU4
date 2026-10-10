/* 出題エンジン（準備モードの出題選択・試験モードの組立て・採点） */
(function () {
  'use strict';
  const O = window.OTSU;

  O.byTopic = {};
  O.PROVIDERS.forEach((p) => (O.byTopic[p.topic] = O.byTopic[p.topic] || []).push(p));

  /** 分野から1問作る（avoid に含まれるプロバイダーはできるだけ避ける） */
  O.makeFromTopic = function (topic, avoid) {
    const all = O.byTopic[topic] || [];
    let pool = all.filter((p) => !avoid || !avoid.has(p.id));
    if (!pool.length) pool = all;
    for (let i = 0; i < 8; i++) {
      const p = O.weightedPick(pool, (x) => x.w);
      try {
        return p.make();
      } catch (e) {
        if (window.console) console.warn(e);
      }
    }
    return null;
  };

  /** 準備モード: 次の問題 */
  O.nextPractice = function (opts) {
    const { subject, weak, recentPids, recentSigs } = opts;
    const minFreq = opts.minFreq || 1;
    let topics = Object.values(O.TOPICS).filter((t) => (subject === 'all' || t.subject === subject) && O.byTopic[t.id]);
    const byFreq = topics.filter((t) => t.freq >= minFreq);
    if (byFreq.length) topics = byFreq;
    const perSubject = {};
    topics.forEach((t) => (perSubject[t.subject] = (perSubject[t.subject] || 0) + 1));
    const stats = O.store.data.topics;
    const weight = (t) => {
      let w = subject === 'all' ? O.SUBJECTS[t.subject].n / perSubject[t.subject] : 1;
      if (weak) {
        const s = stats[t.id] || { n: 0, c: 0 };
        const err = (s.n - s.c + 1) / (s.n + 2); // 未回答は0.5
        w *= 0.4 + 3 * err;
      }
      return w;
    };
    for (let i = 0; i < 12; i++) {
      const t = O.weightedPick(topics, weight);
      const q = O.makeFromTopic(t.id, new Set(recentPids));
      if (q && !recentSigs.includes(q.sig)) return q;
    }
    return O.makeFromTopic(O.pick(topics).id);
  };

  /** 試験モード: 本番と同じ構成で35問 */
  O.buildExam = function () {
    const qs = [];
    const usedP = new Set();
    const usedSig = new Set();
    const usedStem = new Set();
    O.SUBJECT_ORDER.forEach((subj) => {
      O.EXAM_BLUEPRINT[subj].forEach((slot) => {
        let q = null;
        for (let i = 0; i < 25 && !q; i++) {
          const c = O.makeFromTopic(O.pick(slot), usedP);
          if (!c) continue;
          const stemKey = c.stem.split('、次の')[0];
          if (usedSig.has(c.sig) || (i < 15 && usedStem.has(stemKey))) continue;
          q = c;
        }
        if (!q) q = O.makeFromTopic(slot[0]);
        usedP.add(q.pid);
        usedSig.add(q.sig);
        usedStem.add(q.stem.split('、次の')[0]);
        qs.push(q);
      });
    });
    return qs;
  };

  /** 採点 */
  O.gradeExam = function (exam) {
    const res = {};
    O.SUBJECT_ORDER.forEach((s) => (res[s] = { n: 0, c: 0 }));
    exam.qs.forEach((q, i) => {
      res[q.subject].n++;
      if (exam.answers[i] === q.answer) res[q.subject].c++;
    });
    let pass = true;
    O.SUBJECT_ORDER.forEach((s) => {
      const r = res[s];
      r.rate = r.n ? r.c / r.n : 0;
      r.pass = r.c >= Math.ceil(r.n * 0.6);
      if (!r.pass) pass = false;
    });
    const total = O.SUBJECT_ORDER.reduce((a, s) => a + res[s].c, 0);
    return { subjects: res, pass, total, n: exam.qs.length };
  };
})();
