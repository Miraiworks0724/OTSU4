/* 学習記録（ブラウザの localStorage に保存） */
(function () {
  'use strict';
  const O = window.OTSU;
  const KEY = 'otsu4-trainer-v1';
  const blank = () => ({
    v: 1,
    total: { n: 0, c: 0 },
    topics: {},
    wrong: [],
    history: [],
    exam: null,
    settings: { subject: 'all', weak: true, minFreq: 1, srcPractice: [], srcExam: [] },
  });

  function load() {
    try {
      const raw = window.localStorage.getItem(KEY);
      if (!raw) return blank();
      const d = Object.assign(blank(), JSON.parse(raw));
      d.settings = Object.assign(blank().settings, d.settings);
      return d;
    } catch (e) {
      return blank();
    }
  }

  O.store = {
    data: load(),
    save() {
      try {
        window.localStorage.setItem(KEY, JSON.stringify(this.data));
      } catch (e) {
        /* 保存できない環境（プライベートモード等）ではメモリ上だけで動く */
      }
    },
    /** 1問の結果を記録 */
    record(q, correct, opts) {
      const d = this.data;
      d.total.n++;
      if (correct) d.total.c++;
      const t = (d.topics[q.topic] = d.topics[q.topic] || { n: 0, c: 0 });
      t.n++;
      if (correct) t.c++;
      const idx = d.wrong.findIndex((w) => w.sig === q.sig);
      if (!correct && idx < 0) {
        d.wrong.push(Object.assign({}, q, { addedAt: Date.now() }));
        if (d.wrong.length > 200) d.wrong.shift();
      } else if (correct && idx >= 0 && opts && opts.review) {
        d.wrong.splice(idx, 1);
      }
      if (!opts || !opts.deferSave) this.save();
    },
    reset() {
      this.data = blank();
      this.save();
    },
  };
})();
