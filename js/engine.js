/* 出題エンジン（準備モードの出題選択・試験モードの組立て・採点） */
(function () {
  'use strict';
  const O = window.OTSU;

  O.byTopic = {};
  O.PROVIDERS.forEach((p) => (O.byTopic[p.topic] = O.byTopic[p.topic] || []).push(p));

  /** 分野から1問作る（avoid に含まれるプロバイダーはできるだけ避ける） */
  O.makeFromTopic = function (topic, avoid) {
    const all = (O.byTopic[topic] || []).filter(O.providerAvailable);
    if (!all.length) return null;
    let pool = all.filter((p) => !avoid || !avoid.has(p.id));
    if (!pool.length) pool = all;
    for (let i = 0; i < 8; i++) {
      O.pickStyle();
      const p = O.weightedPick(pool, O.providerWeight);
      try {
        return p.make();
      } catch (e) {
        if (window.console) console.warn(e);
      }
    }
    return null;
  };

  /** 現在の出典設定で、この分野から出題できるか */
  O.topicAvailable = (topic) => (O.byTopic[topic] || []).some(O.providerAvailable);
  /** 現在の出典設定で出題できる分野の一覧 */
  O.availableTopics = (subject) => Object.values(O.TOPICS).filter((t) => (!subject || subject === 'all' || t.subject === subject) && O.topicAvailable(t.id));

  /** 準備モード: 次の問題 */
  O.nextPractice = function (opts) {
    const { subject, weak, recentPids, recentSigs } = opts;
    const minFreq = opts.minFreq || 1;
    let topics = O.availableTopics(subject);
    if (!topics.length) return null;
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
    for (let i = 0; i < 10; i++) {
      const q = O.makeFromTopic(O.pick(topics).id);
      if (q) return q;
    }
    return null;
  };

  /**
   * 試験モード: 本番と同じ構成で35問
   *  1. 科目ごとに、出題構成表の各枠へ「まだ使っていない分野」を優先して割り当てる（同じ分野の重複を最小に）
   *  2. 各分野では「この試験でまだ使っていない出題パターン」を優先し、同じ問いかけ文の問題も避ける
   *  3. どうしても足りないとき（出題パターンの少ない媒体だけを選んだときなど）だけ、使用回数の少ないものから再利用する
   */
  O.buildExam = function () {
    const qs = [];
    const usedSig = new Set();
    const usedStem = new Set();
    const pUse = {};
    const stemKey = (q) => q.stem.split('\n')[0].split('、次の')[0];
    O.SUBJECT_ORDER.forEach((subj) => {
      const avail = O.availableTopics(subj).map((t) => t.id);
      if (!avail.length) throw new Error('no-topic:' + subj);
      const tUse = {};
      const minBy = (list, use) => {
        const m = Math.min(...list.map((x) => use[x] || 0));
        return list.filter((x) => (use[x] || 0) === m);
      };
      O.EXAM_BLUEPRINT[subj].forEach((slot) => {
        // 分野の決定: 枠の候補のうち未使用のもの → 科目内の未使用の分野 → 使用回数の少ない分野
        let cands = slot.filter((t) => avail.includes(t) && !tUse[t]);
        if (!cands.length) cands = avail.filter((t) => !tUse[t]);
        if (!cands.length) cands = minBy(avail, tUse);
        let q = null;
        for (let pass = 0; pass < 4 && !q; pass++) {
          // 最後の手段では科目内のどの分野からでも選ぶ
          const topicOrder = O.shuffle(pass < 3 ? cands : avail);
          for (const topic of topicOrder) {
            const provs = (O.byTopic[topic] || []).filter(O.providerAvailable);
            if (!provs.length) continue;
            // 出題パターンの決定: この試験での使用回数が最も少ないものから（pass 2 以降は制限をゆるめる）
            const pool = pass === 0 ? provs.filter((p) => !pUse[p.id]) : minBy(provs.map((p) => p.id), pUse).map((id) => provs.find((p) => p.id === id));
            for (let i = 0; i < 12 && pool.length && !q; i++) {
              O.pickStyle();
              const p = O.weightedPick(pool, O.providerWeight);
              let c;
              try {
                c = p.make();
              } catch (e) {
                continue;
              }
              if (pass < 3 && usedSig.has(c.sig)) continue;
              if (pass < 2 && usedStem.has(stemKey(c))) continue;
              q = c;
            }
            if (q) {
              tUse[topic] = (tUse[topic] || 0) + 1;
              break;
            }
          }
        }
        if (!q) throw new Error('no-question:' + subj);
        pUse[q.pid] = (pUse[q.pid] || 0) + 1;
        usedSig.add(q.sig);
        usedStem.add(stemKey(q));
        qs.push(q);
      });
    });
    return qs;
  };

  /** 現在の媒体設定で、試験の各科目に使える出題パターンの数（重複なしで組めるかの目安） */
  O.examCoverage = function () {
    return O.SUBJECT_ORDER.map((subj) => {
      const provs = O.PROVIDERS.filter((p) => O.TOPICS[p.topic].subject === subj && O.providerAvailable(p));
      return { subj, patterns: provs.length, topics: O.availableTopics(subj).length, need: O.SUBJECTS[subj].n };
    });
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
