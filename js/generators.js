/*
 * 問題ジェネレーター
 *  過去の出題パターン（正誤選択・組合せ・該当するもの・計算・並べ替え）ごとに、
 *  データから毎回ちがう問題を作る「プロバイダー」を登録する。
 *  プロバイダー: { id, topic, w(重み), make() → 問題 }
 */
(function () {
  'use strict';
  const O = window.OTSU;
  const { pick, shuffle, sample, ri } = O;
  const P = (O.PROVIDERS = []);
  const reg = (p) => P.push(Object.assign({ w: 1 }, p));
  const fmtL = (n) => n.toLocaleString('ja-JP') + 'L';

  /* ───────── 問題オブジェクトを組み立てる ───────── */
  function build(p, o) {
    let choices = o.choices.map((c) => ({ t: String(c.t), ok: !!c.ok, mk: c.mk || '', why: c.why || '', v: c.v }));
    if (o.order === 'num') choices.sort((a, b) => a.v - b.v);
    else if (o.order !== 'fixed') choices = shuffle(choices);
    choices.forEach((c) => delete c.v);
    const okCount = choices.filter((c) => c.ok).length;
    if (choices.length !== 5 || okCount !== 1) throw new Error(`invalid question from ${p.id}: ${choices.length} choices, ${okCount} correct`);
    const topic = O.TOPICS[p.topic];
    const q = {
      pid: p.id,
      topic: p.topic,
      subject: topic.subject,
      stem: o.stem,
      list: o.list || null,
      choices,
      answer: choices.findIndex((c) => c.ok),
      exp: o.exp || '',
      notes: O.uniq([p.topic].concat(o.notes || [])),
    };
    q.sig = O.hash(q.stem + '|' + (q.list ? q.list.map((x) => x.t).join('|') : '') + '|' + choices.map((c) => c.t).sort().join('|'));
    return q;
  }
  O.buildQuestion = build;

  /* キーが重ならないように正しい記述 nT 個・誤った記述 nF 個を選ぶ */
  function selectStatements(items, nT, nF) {
    for (let attempt = 0; attempt < 12; attempt++) {
      const keys = new Set();
      const take = (pool, n) => {
        const out = [];
        for (const it of shuffle(pool)) {
          if (out.length >= n) break;
          if (it.k && keys.has(it.k)) continue;
          if (it.k) keys.add(it.k);
          out.push(it);
        }
        return out;
      };
      // 少ない方から選ぶと成功しやすい
      let ts, fs;
      if (nF <= nT) {
        fs = take(items.filter((x) => !x.ok), nF);
        ts = take(items.filter((x) => x.ok), nT);
      } else {
        ts = take(items.filter((x) => x.ok), nT);
        fs = take(items.filter((x) => !x.ok), nF);
      }
      if (ts.length === nT && fs.length === nF) return shuffle(ts.concat(fs));
    }
    return null;
  }

  const stmtWhy = (s) => (s.ok ? '正しい記述' : '誤り。正しくは → ' + s.fix);

  /** 正誤問題（誤っているもの／正しいもの／いくつあるか） */
  function statementQuestion(p, items, stemHead, mode, extraNotes, exp) {
    if (mode === 'combo') {
      // 本試験の「A〜Dのうち、誤っているもののみをすべて掲げているものはどれか」形式
      const askFalse = Math.random() < 0.6;
      const labels = ['A', 'B', 'C', 'D'];
      const key = (arr) => arr.join('、');
      for (const nTarget of shuffle([1, 2, 2, 3])) {
        const nT = askFalse ? 4 - nTarget : nTarget;
        const sel = selectStatements(items, nT, 4 - nT);
        if (!sel) continue;
        const list = sel.map((s, i) => ({ label: labels[i], t: s.t, ok: s.ok, fix: s.fix || '' }));
        const target = list.filter((x) => (askFalse ? !x.ok : x.ok)).map((x) => x.label);
        const subsets = [];
        for (let m = 1; m < 16; m++) subsets.push(labels.filter((_, i) => m & (1 << i)));
        const others = shuffle(subsets.filter((a) => key(a) !== key(target))).sort((a, b) => Math.abs(a.length - target.length) - Math.abs(b.length - target.length));
        const opts = [target].concat(others.slice(0, 4)).sort((a, b) => (key(a) < key(b) ? -1 : 1));
        const word = askFalse ? '誤っているもの' : '正しいもの';
        return build(p, {
          stem: `${stemHead}、次のA〜Dのうち、${word}のみをすべて掲げているものはどれか。`,
          list,
          order: 'fixed',
          choices: opts.map((a) => ({ t: key(a), ok: key(a) === key(target) })),
          exp: `${word}は ${key(target)}。` + (exp ? '\n' + exp : ''),
          notes: extraNotes,
        });
      }
      mode = 'neg';
    }
    if (mode === 'count') {
      const askTrue = Math.random() < 0.6;
      for (const k of shuffle([1, 2, 3, 4])) {
        const nTrue = askTrue ? k : 5 - k;
        const sel = selectStatements(items, nTrue, 5 - nTrue);
        if (!sel) continue;
        const labels = ['A', 'B', 'C', 'D', 'E'];
        const list = sel.map((s, i) => ({ label: labels[i], t: s.t, ok: s.ok, fix: s.fix || '' }));
        const ans = askTrue ? nTrue : 5 - nTrue;
        return build(p, {
          stem: `${stemHead}、次のA〜Eのうち、${askTrue ? '正しいもの' : '誤っているもの'}はいくつあるか。`,
          list,
          order: 'fixed',
          choices: [1, 2, 3, 4, 5].map((n) => ({ t: `${n}つ`, ok: n === ans })),
          exp: `${askTrue ? '正しいもの' : '誤っているもの'}は ${list.filter((x) => x.ok === askTrue).map((x) => x.label).join('・')} の${ans}つ。` + (exp ? '\n' + exp : ''),
          notes: extraNotes,
        });
      }
      mode = 'neg';
    }
    const neg = mode === 'neg';
    const sel = selectStatements(items, neg ? 4 : 1, neg ? 1 : 4);
    if (!sel) throw new Error('not enough statements: ' + p.id);
    return build(p, {
      stem: `${stemHead}、次のうち${neg ? '誤っているもの' : '正しいもの'}はどれか。`,
      choices: sel.map((s) => ({ t: s.t, ok: neg ? !s.ok : s.ok, mk: s.ok ? '○' : '×', why: stmtWhy(s) })),
      notes: extraNotes,
      exp,
    });
  }

  function feasibleModes(items) {
    const ok = (nT, nF) => !!selectStatements(items, nT, nF);
    const m = [];
    if (ok(4, 1)) m.push(['neg', 5]);
    if (ok(1, 4)) m.push(['pos', 3]);
    if (items.length >= 6 && (ok(2, 3) || ok(3, 2))) m.push(['count', 1.5]);
    if (items.length >= 6 && (ok(2, 2) || ok(3, 1) || ok(1, 3))) m.push(['combo', 1.5]);
    return m;
  }
  const chooseMode = (modes) => O.weightedPick(modes, (m) => m[1])[0];

  /* ───────── 1. 正誤問題バンク ───────── */
  O.BANKS.forEach((b) => {
    const modes = feasibleModes(b.items);
    const pre = b.pre != null ? b.pre : '法令上、';
    reg({ id: b.id, topic: b.topic, w: 4, make() { return statementQuestion(this, b.items, pre + b.stem, chooseMode(modes)); } });
  });

  /* ───────── 2. 物品ごとの性状問題（物品データから自動生成） ───────── */
  const GROUP_ADJ = { tokushu: ['dai1'], dai1: ['tokushu', 'dai2', 'alcohol'], alcohol: ['dai1', 'dai2'], dai2: ['dai1', 'dai3'], dai3: ['dai2', 'dai4'], dai4: ['dai3', 'doshoku'], doshoku: ['dai4'] };
  O.substanceStatements = function (s) {
    const g = O.GROUPS[s.g];
    const items = [];
    s.facts.forEach((x) => items.push(Array.isArray(x) ? { ok: true, t: x[0], k: x[1] } : { ok: true, t: x }));
    s.myths.forEach((m) => items.push({ ok: false, t: m[0], fix: m[1], k: m[2] }));
    if (s.sol === 'yes') {
      items.push({ ok: true, t: '水によく溶ける', k: 'sol' }, { ok: false, t: '水に溶けない', fix: '水によく溶ける（水溶性）', k: 'sol' });
    } else if (s.sol === 'no') {
      items.push({ ok: true, t: '水に溶けない', k: 'sol' }, { ok: false, t: '水によく溶ける', fix: '水に溶けない（非水溶性）', k: 'sol' });
    }
    if (s.sg && s.sg[1] < 1) {
      items.push({ ok: true, t: `液比重は${s.sgT}で、水より軽い`, k: 'sg' }, { ok: false, t: '液比重は1より大きく、水より重い', fix: `比重${s.sgT}で水より軽い`, k: 'sg' });
    } else if (s.sg && s.sg[0] > 1) {
      items.push({ ok: true, t: `液比重は${s.sgT}で、水より重い`, k: 'sg' }, { ok: false, t: '液比重は1より小さく、水より軽い', fix: `比重${s.sgT}で水より重い`, k: 'sg' });
    }
    if (s.fp && s.fp[1] < 20) {
      items.push({ ok: true, t: `引火点は${s.fpT}で、常温（20℃）より低い`, k: 'fp' }, { ok: false, t: '引火点は常温（20℃）より高いので、常温では引火しない', fix: `引火点は${s.fpT}で常温より低く、常温で引火する危険がある`, k: 'fp' });
    } else if (s.fp && s.fp[0] > 20) {
      items.push({ ok: true, t: `引火点は${s.fpT}で、常温（20℃）より高い`, k: 'fp' }, { ok: false, t: '引火点は常温（20℃）より低く、常温で容易に引火する', fix: `引火点は${s.fpT}`, k: 'fp' });
    }
    items.push({ ok: true, t: '蒸気は空気より重い', k: 'vap' }, { ok: false, t: '蒸気は空気より軽く、高所に滞留しやすい', fix: '第4類の蒸気はすべて空気より重い', k: 'vap' });
    const wrongG = O.GROUPS[pick(GROUP_ADJ[s.g])].name;
    items.push({ ok: true, t: `消防法上、${g.name}に該当する`, k: 'grp' }, { ok: false, t: `消防法上、${wrongG}に該当する`, fix: `${g.name}に該当する`, k: 'grp' });
    if (s.ignT && s.ign) items.push({ ok: true, t: `発火点は${s.ignT}である`, k: 'ign' });
    if (s.rangeT) items.push({ ok: true, t: `燃焼範囲は${s.rangeT}である`, k: 'range' });
    // 同じ数値に触れる記述は同じ問題に並べない（答えが透けるのを防ぐ）
    const seen = new Set();
    return items.filter((it) => {
      if (seen.has(it.t)) return false;
      seen.add(it.t);
      if (!it.k) it.k = /発火点/.test(it.t) ? 'ign' : /燃焼範囲/.test(it.t) ? 'range' : /引火点/.test(it.t) ? 'fp' : undefined;
      return true;
    });
  };

  const SUB_TOPICS = ['s_tokushu', 's_dai1', 's_alcohol', 's_dai2', 's_dai3'];
  SUB_TOPICS.forEach((topic) => {
    const subs = O.SUBSTANCES.filter((s) => O.GROUPS[s.g].topic === topic);
    reg({
      id: 'sub_' + topic,
      topic,
      w: 16, // 公式問題では性消10問のうち約半数が「〇〇の性状について」形式
      make() {
        const s = pick(subs);
        const items = O.substanceStatements(s);
        const modes = feasibleModes(items).filter((m) => m[0] !== 'count');
        return statementQuestion(this, items, `${s.name}の性状について`, chooseMode(modes), ['sub_' + s.id]);
      },
    });
  });

  /* ───────── 3.「該当するもの／しないもの」問題 ───────── */
  function regSet(d) {
    reg({
      id: d.id,
      topic: d.topic,
      w: d.w || 2,
      make() {
        const yes = (typeof d.yes === 'function' ? d.yes() : d.yes).map((x) => (Array.isArray(x) ? x : [x, '']));
        const no = (typeof d.no === 'function' ? d.no() : d.no).map((x) => (Array.isArray(x) ? x : [x, '']));
        const modes = [];
        if (d.stemPos && yes.length >= 1 && no.length >= 4) modes.push('pos');
        if (d.stemNeg && no.length >= 1 && yes.length >= 4) modes.push('neg');
        const mode = pick(modes);
        const pos = mode === 'pos';
        const sel = pos ? sample(yes, 1).concat(sample(no, 4)) : sample(no, 1).concat(sample(yes, 4));
        const yesSet = new Set(yes.map((x) => x[0]));
        return build(this, {
          stem: pos ? d.stemPos : d.stemNeg,
          choices: sel.map(([t, why]) => {
            const isYes = yesSet.has(t);
            return { t, ok: pos ? isYes : !isYes, mk: isYes ? '○' : '×', why: (isYes ? d.yesLabel : d.noLabel) + (why ? '（' + why + '）' : '') };
          }),
          exp: d.exp,
          notes: typeof d.notes === 'function' ? d.notes(sel) : d.notes,
        });
      },
    });
  }

  /* ───────── 4.「組合せ」問題 ───────── */
  function regPair(d) {
    reg({
      id: d.id,
      topic: d.topic,
      w: d.w || 2,
      make() {
        const pairs = typeof d.pairs === 'function' ? d.pairs() : d.pairs;
        const domain = O.uniq(pairs.map((x) => x[1]));
        const neg = Math.random() < 0.6;
        const chosen = sample(pairs, 5);
        const wrongIdx = neg ? [ri(0, 4)] : sample([0, 1, 2, 3, 4], 4);
        const sep = d.sep || '―';
        const choices = chosen.map((pr, i) => {
          const isWrong = wrongIdx.includes(i);
          let b = pr[1];
          if (isWrong) b = pick(domain.filter((x) => x !== pr[1] && !(pr[2] || []).includes(x)));
          return {
            t: `${pr[0]}${sep}${b}`,
            ok: neg ? isWrong : !isWrong,
            mk: isWrong ? '×' : '○',
            why: isWrong ? `誤り。正しくは「${pr[1]}」` : '正しい組合せ',
          };
        });
        return build(this, {
          stem: `${d.stem}、次のうち${neg ? '誤っているもの' : '正しいもの'}はどれか。`,
          choices,
          exp: d.exp,
          notes: d.notes,
        });
      },
    });
  }

  /* ───────── 5. 並べ替え（最も高い／低い）問題 ───────── */
  function regOrder(d) {
    reg({
      id: d.id,
      topic: d.topic,
      w: d.w || 2,
      make() {
        const cands = O.SUBSTANCES.filter((s) => s[d.prop]);
        for (let attempt = 0; attempt < 40; attempt++) {
          const chosen = [];
          for (const s of shuffle(cands)) {
            const [lo, hi] = s[d.prop];
            if (chosen.every((c) => lo > c[d.prop][1] + d.gap || hi < c[d.prop][0] - d.gap)) chosen.push(s);
            if (chosen.length === 5) break;
          }
          if (chosen.length < 5) continue;
          const low = Math.random() < 0.6;
          const sorted = chosen.slice().sort((a, b) => a[d.prop][0] - b[d.prop][0]);
          const ans = low ? sorted[0] : sorted[4];
          return build(this, {
            stem: `次の危険物のうち、${d.label}が最も${low ? '低い' : '高い'}ものはどれか。`,
            choices: chosen.map((s) => ({ t: s.name, ok: s === ans, mk: s === ans ? '○' : '', why: `${d.label} ${s[d.prop + 'T']}` })),
            exp: `${d.label}の低い順: ` + sorted.map((s) => `${s.name}（${s[d.prop + 'T']}）`).join(' ＜ '),
            notes: chosen.map((s) => 'sub_' + s.id),
          });
        }
        throw new Error('order: could not choose');
      },
    });
  }

  /* 数値の選択肢を作る（正解＋誤答候補から重複なく4つ） */
  function numChoices(correct, wrongs, fmt, digits = 2) {
    const r = (x) => Math.round(x * Math.pow(10, digits)) / Math.pow(10, digits);
    const c = r(correct);
    const used = new Set([c]);
    const out = [{ t: fmt(c), ok: true, v: c }];
    for (const w of wrongs) {
      const v = r(w);
      if (out.length >= 5) break;
      if (!(v > 0) || used.has(v)) continue;
      used.add(v);
      out.push({ t: fmt(v), ok: false, v });
    }
    let k = 1;
    while (out.length < 5) {
      const v = r(c * (1 + 0.5 * k));
      if (!used.has(v)) {
        used.add(v);
        out.push({ t: fmt(v), ok: false, v });
      }
      k++;
    }
    return out;
  }

  /* ───────── 6.「すべて該当する組合せ」問題（本試験の「〜のみの組合せとして正しいもの」形式） ───────── */
  function regCombo(d) {
    reg({
      id: d.id,
      topic: d.topic,
      w: d.w || 2,
      make() {
        const norm = (x) => (Array.isArray(x) ? x : [x, '']);
        const yes = d.yes.map(norm);
        const no = d.no.map(norm);
        const k = d.k;
        const keyOf = (arr) => arr.map((x) => x[0]).sort().join('|');
        const correct = sample(yes, k);
        const seen = new Set([keyOf(correct)]);
        const opts = [{ items: correct, ok: true }];
        for (let i = 0; opts.length < 5 && i < 50; i++) {
          const c = shuffle(sample(yes, k - 1).concat(sample(no, 1)));
          if (seen.has(keyOf(c))) continue;
          seen.add(keyOf(c));
          opts.push({ items: c, ok: false });
        }
        return build(this, {
          stem: d.stem,
          choices: opts.map((o) => ({
            t: o.items.map((x) => x[0]).join('　'),
            ok: o.ok,
            mk: o.ok ? '○' : '×',
            why: o.ok ? 'すべて' + d.yesLabel : o.items.filter((x) => no.includes(x)).map((x) => `「${x[0]}」は${d.noLabel}${x[1] ? '（' + x[1] + '）' : ''}`).join('、'),
          })),
          exp: d.exp,
        });
      },
    });
  }

  /* ═════════════ 公式公開問題の分析から追加した出題 ═════════════ */
  regSet({
    id: 'set_4rui_hinmei', topic: 'h_hinmei', w: 2,
    stemNeg: '法別表第一に掲げる第4類の危険物の品名に該当しないものは、次のうちどれか。',
    stemPos: '次のうち、第4類の危険物の品名に該当するものはどれか。',
    yesLabel: '第4類の品名', noLabel: '第4類の品名ではない',
    yes: ['特殊引火物', '第1石油類', 'アルコール類', '第2石油類', '第3石油類', '第4石油類', '動植物油類'],
    no: [['アルキルアルミニウム', '第3類'], ['硝酸エステル類', '第5類'], ['過塩素酸塩類', '第1類'], ['硫化りん', '第2類'], ['有機過酸化物', '第5類'], ['金属粉', '第2類'], ['黄りん', '第3類'], ['塩素酸塩類', '第1類']],
  });
  regCombo({
    id: 'combo_okugai', topic: 'h_shisetsu', k: 3, w: 3,
    stem: '法令上、屋外貯蔵所に貯蔵できる危険物のみの組合せとして、次のうち正しいものはどれか。',
    yesLabel: '屋外貯蔵所に貯蔵できる', noLabel: '屋外貯蔵所に貯蔵できない',
    yes: ['トルエン', '重油', 'アルコール類', '硫黄', '軽油', '灯油', '動植物油類', 'ギヤー油', 'シリンダー油', 'クレオソート油', '引火性固体（引火点0℃以上のもの）', '酢酸'],
    no: [['ジエチルエーテル', '特殊引火物'], ['二硫化炭素', '特殊引火物'], ['アセトン', '引火点0℃未満の第1石油類'], ['ガソリン', '引火点0℃未満の第1石油類'], ['ベンゼン', '引火点0℃未満の第1石油類'], ['アセトアルデヒド', '特殊引火物'], ['ナトリウム', '第3類']],
  });
  regCombo({
    id: 'combo_kyori', topic: 'h_kyori', k: 2, w: 3,
    stem: '法令上、学校・病院等の建築物等から一定の距離（保安距離）を保たなければならない施設の組合せとして、次のうち正しいものはどれか。',
    yesLabel: '保安距離が必要', noLabel: '保安距離は不要',
    yes: ['製造所', '屋内貯蔵所', '屋外タンク貯蔵所', '屋外貯蔵所', '一般取扱所'],
    no: ['屋内タンク貯蔵所', '地下タンク貯蔵所', '移動タンク貯蔵所', '給油取扱所', '第1種販売取扱所', '第2種販売取扱所', '簡易タンク貯蔵所'],
  });
  regSet({
    id: 'set_5shu_all', topic: 'h_shoka', w: 2,
    stemPos: '法令上、第5種の消火設備のうち、すべての類の危険物の消火に適応するものはどれか。',
    yesLabel: 'すべての類に適応', noLabel: '適応しない類がある',
    yes: ['乾燥砂', '膨張ひる石', '膨張真珠岩'],
    no: ['りん酸塩類等の粉末を放射する消火器', '霧状の強化液を放射する消火器', '泡を放射する消火器', 'ハロゲン化物を放射する消火器', '二酸化炭素を放射する消火器', '水バケツ'],
  });
  reg({
    id: 'g_menjo_shinsei', topic: 'h_menjo', w: 3,
    make() {
      const KA = ['交付した知事、または居住地もしくは勤務地を管轄する知事', '居住地を管轄する知事', '交付した知事', '居住地または勤務地を管轄する知事', '交付した知事または居住地を管轄する知事'];
      const SA = ['交付した知事、または書換えをした知事', '交付した知事または居住地を管轄する知事', '交付した知事、または居住地もしくは勤務地を管轄する知事', '居住地または勤務地を管轄する知事', '書換えをした知事、または居住地を管轄する知事'];
      const opts = [[0, 0]];
      const seen = new Set(['0-0']);
      while (opts.length < 5) {
        const c = [ri(0, 4), ri(0, 4)];
        if (!seen.has(c.join('-'))) {
          seen.add(c.join('-'));
          opts.push(c);
        }
      }
      return build(this, {
        stem: '法令上、免状の書換えの申請先と再交付の申請先の組合せとして、次のうち正しいものはどれか。',
        choices: opts.map(([a, b]) => ({ t: `書換え：${KA[a]}／再交付：${SA[b]}`, ok: a === 0 && b === 0 })),
        exp: `書換え → ${KA[0]}\n再交付 → ${SA[0]}（亡失した免状を発見したら10日以内に再交付を受けた知事へ提出）`,
      });
    },
  });
  regSet({
    id: 'set_tenken_kiroku', topic: 'h_tenken', w: 2,
    stemNeg: '法令に定める定期点検の点検記録に記載しなければならない事項として、定められていないものはどれか。',
    yesLabel: '記載が必要', noLabel: '記載事項ではない',
    yes: ['点検をした製造所等の名称', '点検の方法及び結果', '点検年月日', '点検を行った危険物取扱者等または点検に立ち会った危険物取扱者の氏名'],
    no: ['点検を実施したことを市町村長等へ報告した年月日', '点検に要した費用', '製造所等の所有者の住所', '危険物保安監督者の免状番号'],
  });
  regSet({
    id: 'set_hoankensa', topic: 'h_tenken', w: 2,
    stemPos: '法令上、政令で定める規模以上のものが市町村長等の行う保安検査を受けなければならない製造所等はどれか。',
    yesLabel: '保安検査の対象', noLabel: '保安検査の対象ではない',
    yes: ['屋外タンク貯蔵所', '移送取扱所'],
    no: ['地下タンク貯蔵所', '給油取扱所', '製造所', '移動タンク貯蔵所', '屋内貯蔵所', '一般取扱所'],
  });
  regPair({
    id: 'pair_unpan_chui', topic: 'h_unpan', stem: '法令上、運搬容器の外部に表示する注意事項について、危険物の類との組合せとして', w: 3, sep: '…',
    pairs: [
      ['第1類（アルカリ金属の過酸化物等を除く）', '「火気・衝撃注意」「可燃物接触注意」'],
      ['第2類（鉄粉・金属粉・マグネシウム・引火性固体を除く）', '「火気注意」'],
      ['第3類の禁水性物品', '「禁水」'],
      ['第4類', '「火気厳禁」', ['「火気厳禁」「衝撃注意」']],
      ['第5類', '「火気厳禁」「衝撃注意」', ['「火気厳禁」']],
      ['第6類', '「可燃物接触注意」', ['「火気・衝撃注意」「可燃物接触注意」']],
    ],
  });
  reg({
    id: 'g_self_color', topic: 'h_kyuyu', w: 2,
    make() {
      const C = [['ハイオクガソリン', '黄色'], ['レギュラーガソリン', '赤色'], ['軽油', '緑色'], ['灯油', '青色']];
      const [fuel, color] = pick(C);
      const what = fuel === '灯油' ? '灯油を取り扱うために顧客が使用する顧客用固定注油設備' : `${fuel}を取り扱うために顧客が使用する顧客用固定給油設備`;
      return build(this, {
        stem: `法令上、顧客に自ら給油等をさせる給油取扱所において、${what}に彩色を施す場合の色として、次のうち正しいものはどれか。`,
        choices: ['赤色', '青色', '白色', '黄色', '緑色'].map((c) => ({ t: c, ok: c === color })),
        order: 'fixed',
        exp: 'ハイオク＝黄色、レギュラー＝赤色、軽油＝緑色、灯油＝青色',
      });
    },
  });
  reg({
    id: 'g_nensho_jouken', topic: 'b_nensho', w: 3,
    make() {
      const BURN = [['静電気火花', '水素', '空気'], ['ライターの炎', 'プロパン', '空気'], ['電気火花', '一酸化炭素', '空気'], ['衝撃火花', '二硫化炭素', '酸素'], ['マッチの炎', 'メタン', '空気'], ['静電気火花', 'ガソリンの蒸気', '空気'], ['酸化熱', '天ぷらの揚げかす', '酸素'], ['電気火花', 'アセチレン', '酸素'], ['ライターの炎', '木材', '空気']];
      const NONFUEL = ['ヘリウム', '窒素', '二酸化炭素', 'アルゴン', '水蒸気'];
      const NONOX = ['窒素', '二酸化炭素', 'ヘリウム'];
      const spoil = (tr) => {
        const r = ri(0, 2);
        if (r === 0 && tr[0] !== '酸化熱') return [[pick(['気化熱', '融解熱']), tr[1], tr[2]], '気化熱・融解熱は点火源にならない'];
        if (r === 1) return [[tr[0], pick(NONFUEL), tr[2]], 'この物質は燃えない（可燃物がない）'];
        return [[tr[0], tr[1], pick(NONOX)], '酸素供給源がない'];
      };
      const notBurn = Math.random() < 0.65;
      const base = sample(BURN, 5);
      const seen = new Set(base.map((tr) => tr.join(' … ')));
      const choices = base.map((tr, i) => {
        const odd = notBurn ? i === 0 : i !== 0;
        if (!odd) return { t: tr.join(' … '), ok: i === 0, mk: '○', why: '燃焼の三要素がそろっている' };
        let t2, why;
        do [t2, why] = spoil(tr);
        while (seen.has(t2.join(' … ')));
        seen.add(t2.join(' … '));
        return { t: t2.join(' … '), ok: i === 0, mk: '×', why };
      });
      return build(this, {
        stem: `次の「点火源 … 可燃物 … 酸素供給源」の組合せのうち、燃焼が${notBurn ? '起こらない' : '起こる'}ものはどれか。`,
        choices,
        exp: '燃焼には可燃物・酸素供給源・点火源の3つが同時に必要。ヘリウム・窒素・二酸化炭素などは燃えず、酸素供給源にもならない。',
      });
    },
  });
  reg({
    id: 'g_seiseinetsu', topic: 'b_kagaku', w: 2,
    make() {
      const H = 286, C = 394;
      const [name, f, nc, nh, comb, eq] = pick([
        ['プロパン', 'C₃H₈', 3, 4, 2219, 'C₃H₈ ＋ 5O₂ → 3CO₂ ＋ 4H₂O'],
        ['メタン', 'CH₄', 1, 2, 890, 'CH₄ ＋ 2O₂ → CO₂ ＋ 2H₂O'],
        ['エタン', 'C₂H₆', 2, 3, 1560, '2C₂H₆ ＋ 7O₂ → 4CO₂ ＋ 6H₂O'],
        ['ブタン', 'C₄H₁₀', 4, 5, 2878, '2C₄H₁₀ ＋ 13O₂ → 8CO₂ ＋ 10H₂O'],
      ]);
      const ans = nc * C + nh * H - comb;
      return build(this, {
        stem: `水素（H₂）、炭素（C）、${name}（${f}）の燃焼熱がそれぞれ${H}kJ/mol、${C}kJ/mol、${comb.toLocaleString()}kJ/molであるとき、${name}の生成熱として正しいものはどれか。\nなお、完全燃焼の反応式は 2H₂ ＋ O₂ → 2H₂O、C ＋ O₂ → CO₂、${eq} である。`,
        choices: numChoices(ans, shuffle([nc * C + nh * H + comb, comb - C - H, comb - ans, H + C + comb, ans * 2, nc * C + nh * H]), (v) => O.num(v, 0) + 'kJ/mol', 0),
        order: 'num',
        exp: `${name}を成分の単体から作る反応（${nc}C ＋ ${nh}H₂ → ${f}）の熱を、燃焼熱から求める（ヘスの法則）。\n生成熱 ＝ （炭素の燃焼熱 × ${nc} ＋ 水素の燃焼熱 × ${nh}）− ${name}の燃焼熱\n＝ (${C} × ${nc} ＋ ${H} × ${nh}) − ${comb} ＝ ${ans}kJ/mol`,
      });
    },
  });
  regPair({
    id: 'pair_kannoki', topic: 'b_kagaku', stem: '次の有機化合物とそれに含まれる官能基との組合せとして', w: 3, sep: '　…　',
    pairs: [
      ['C₆H₅NH₂（アニリン）', 'アミノ基'],
      ['C₂H₅OH（エタノール）', 'ヒドロキシ基'],
      ['C₃H₇OH（プロパノール）', 'ヒドロキシ基'],
      ['C₆H₅NO₂（ニトロベンゼン）', 'ニトロ基'],
      ['CH₃COCH₃（アセトン）', 'カルボニル基（ケトン基）', ['アルデヒド基（ホルミル基）']],
      ['CH₃COOH（酢酸）', 'カルボキシ基', ['カルボニル基（ケトン基）']],
      ['CH₃CHO（アセトアルデヒド）', 'アルデヒド基（ホルミル基）', ['カルボニル基（ケトン基）']],
      ['C₆H₅SO₃H（ベンゼンスルホン酸）', 'スルホ基'],
    ],
  });

  /* ═════════════ 市販参考書の演習問題の分析から追加した出題形式 ═════════════ */

  /* 「次のうち〜ものはいくつあるか」（物品名を並べて数える形式） */
  function regCountList(d) {
    reg({
      id: d.id,
      topic: d.topic,
      w: d.w || 2,
      make() {
        const yes = O.uniq(typeof d.yes === 'function' ? d.yes() : d.yes);
        const no = O.uniq((typeof d.no === 'function' ? d.no() : d.no).filter((x) => !yes.includes(x)));
        for (let i = 0; i < 20; i++) {
          const total = Math.min(ri(8, 10), yes.length + no.length);
          const kMin = Math.max(1, total - no.length);
          const kMax = Math.min(5, yes.length, total);
          if (kMin > kMax) continue;
          const k = ri(kMin, kMax);
          const picked = shuffle(sample(yes, k).concat(sample(no, total - k)));
          return build(this, {
            stem: `${d.stem}\n${picked.join('・')}`,
            order: 'fixed',
            choices: [1, 2, 3, 4, 5].map((n) => ({ t: `${n}つ`, ok: n === k })),
            exp: `${d.label}もの: ${picked.filter((x) => yes.includes(x)).join('・')}（${k}つ）` + (d.exp ? '\n' + d.exp : ''),
            notes: d.notes,
          });
        }
        throw new Error('countList: could not choose ' + d.id);
      },
    });
  }

  /* 「次の文の【①】〜【③】に当てはまる語句の組合せ」（穴埋め形式） */
  function regBlank(d) {
    reg({
      id: d.id,
      topic: d.topic,
      w: d.w || 2,
      make() {
        const n = d.slots.length;
        const marks = ['①', '②', '③', '④'];
        const correct = d.slots.map(() => 0);
        const seen = new Set([correct.join()]);
        const opts = [correct];
        while (opts.length < 5) {
          const c = correct.slice();
          const changes = ri(1, n);
          sample([...Array(n).keys()], changes).forEach((j) => (c[j] = ri(1, d.slots[j].length - 1)));
          if (!seen.has(c.join())) {
            seen.add(c.join());
            opts.push(c);
          }
        }
        const text = (c) => c.map((v, j) => `${marks[j]}${d.slots[j][v]}`).join('　');
        return build(this, {
          stem: `${d.stem}\n「${d.template}」`,
          choices: opts.map((c) => ({ t: text(c), ok: c === correct })),
          exp: '正しい文: ' + d.template.replace(/【([①②③④])】/g, (_, m) => '「' + d.slots[marks.indexOf(m)][0] + '」'),
        });
      },
    });
  }

  /* 「低いものから高いものへ並べられているもの」（3物品の並び順） */
  reg({
    id: 'ord_seq_fp', topic: 's_kyotsu', w: 2,
    make() {
      const cands = O.SUBSTANCES.filter((s) => s.fp);
      const sep = (a, b) => a.fp[1] + 2 < b.fp[0] || b.fp[1] + 2 < a.fp[0];
      const triple = () => {
        for (let i = 0; i < 50; i++) {
          const t = sample(cands, 3);
          if (sep(t[0], t[1]) && sep(t[1], t[2]) && sep(t[0], t[2])) return t;
        }
        return null;
      };
      const asc = (t) => t.slice().sort((a, b) => a.fp[0] - b.fp[0]);
      const opts = [];
      const seen = new Set();
      let guard = 0;
      while (opts.length < 5 && guard++ < 200) {
        const t = triple();
        if (!t) continue;
        const sorted = asc(t);
        const isFirst = opts.length === 0;
        let order = sorted;
        if (!isFirst) {
          const perms = [[0, 2, 1], [1, 0, 2], [1, 2, 0], [2, 0, 1], [2, 1, 0]];
          const pm = pick(perms);
          order = pm.map((k) => sorted[k]);
        }
        const key = order.map((x) => x.id).join();
        if (seen.has(key)) continue;
        seen.add(key);
        opts.push({ order, ok: isFirst });
      }
      return build(this, {
        stem: '次の危険物を引火点の低いものから高いものの順に並べたとき、正しく並んでいるものはどれか。',
        choices: opts.map((o) => ({
          t: o.order.map((x) => x.name).join(' → '),
          ok: o.ok,
          mk: o.ok ? '○' : '×',
          why: o.order.map((x) => `${x.name} ${x.fpT}`).join('、'),
        })),
        exp: '目安: 特殊引火物 ＜ 第1石油類 ＜ アルコール類 ＜ 第2石油類 ＜ 第3石油類 ＜ 第4石油類 の順に引火点が高くなる。',
      });
    },
  });

  const KIKEN_YES = ['灯油', '軽油', '酢酸', 'アセトン', 'ベンゼン', 'ギヤー油', 'ナタネ油', 'アマニ油', 'キリ油', 'ガソリン', '硫黄', '硝酸', '過酸化水素', '赤りん', 'ナトリウム'];
  const KIKEN_NO = ['水素', '酸素', 'プロパン', 'アセチレン', '硫酸', '塩酸', '液体酸素', '窒素', '一酸化炭素', '消石灰'];
  regCountList({
    id: 'cnt_kiken', topic: 's_rui', w: 2, label: '危険物ではない',
    stem: '次のうち、消防法上の危険物ではないものはいくつあるか。',
    yes: KIKEN_NO, no: KIKEN_YES,
    exp: '気体（水素・酸素・プロパンなど）や、硫酸・塩酸・消石灰は危険物ではない。動植物油（ナタネ油・アマニ油など）は第4類の危険物。',
  });
  const subName = (f) => () => O.SUBSTANCES.filter(f).map((s) => s.name);
  regCountList({
    id: 'cnt_omoi', topic: 's_kyotsu', w: 2, label: '液比重が1より大きい',
    stem: '次の危険物のうち、液比重が1より大きいものはいくつあるか。',
    yes: subName((s) => s.sg && s.sg[0] > 1), no: subName((s) => s.sg && s.sg[1] < 1),
    exp: '水より重い第4類は少数なので、二硫化炭素・酢酸・グリセリンなどを個別に覚える。',
  });
  regCountList({
    id: 'cnt_suiyo', topic: 's_kyotsu', w: 2, label: '水によく溶ける',
    stem: '次の危険物のうち、水によく溶けるものはいくつあるか。',
    yes: subName((s) => s.sol === 'yes'), no: subName((s) => s.sol === 'no'),
  });
  regCountList({
    id: 'cnt_jouon', topic: 's_kyotsu', w: 2, label: '常温（20℃）で引火する',
    stem: '次の危険物のうち、常温（20℃）で引火するものはいくつあるか。',
    yes: subName((s) => s.fp && s.fp[1] < 20), no: () => subName((s) => s.fp && s.fp[0] > 20)().concat(['タービン油', 'モーター油', 'シリンダー油']),
    exp: '目安: 特殊引火物・第1石油類・アルコール類は引火点が20℃より低く常温で引火する。第2石油類以降は常温では引火しない（ピリジンは引火点20℃）。',
  });

  regBlank({
    id: 'blank_hani', topic: 'b_inka', w: 2,
    stem: '燃焼範囲の説明として、次の文の【①】〜【③】に当てはまる語句の組合せで正しいものはどれか。',
    template: '燃焼範囲とは、【①】において【②】することができる【③】の濃度範囲のことをいう。',
    slots: [['空気中', '水中', '真空中', '液体中'], ['燃焼', '分解', '凝縮', '蒸発'], ['可燃性蒸気', '酸素', '水蒸気', '二酸化炭素']],
  });
  regBlank({
    id: 'blank_inka', topic: 'b_inka', w: 2,
    stem: '引火点の説明として、次の文の【①】〜【③】に当てはまる語句の組合せで正しいものはどれか。',
    template: '引火点とは、【①】が空気中で引火するのに十分な濃度の蒸気を【②】に発生するときの【③】をいう。',
    slots: [['可燃性液体', '不燃性液体', '可燃性気体'], ['液面上', '液体の内部', '容器の底部'], ['最低の液温', '最高の液温', '平均の液温']],
  });
  regBlank({
    id: 'blank_hakka', topic: 'b_inka', w: 2,
    stem: '発火点の説明として、次の文の【①】〜【③】に当てはまる語句の組合せで正しいものはどれか。',
    template: '発火点とは、空気中で可燃物を【①】した場合、【②】を近づけなくても自ら燃えだすときの【③】をいう。',
    slots: [['加熱', '冷却', '点火'], ['炎や火花などの点火源', '酸素', '空気'], ['最低の温度', '最高の温度', '平均の温度']],
  });
  regBlank({
    id: 'blank_nensho', topic: 'b_nensho', w: 1,
    stem: '燃焼の説明として、次の文の【①】【②】に当てはまる語句の組合せで正しいものはどれか。',
    template: '燃焼とは、【①】の発生を伴う急激な【②】反応である。',
    slots: [['熱と光', '熱と音', '光と煙', '音と煙'], ['酸化', '還元', '分解', '中和', '重合']],
  });
  regCombo({
    id: 'combo_abura_denki', topic: 'b_shoka', k: 3, w: 2,
    stem: '油火災と電気火災の両方に適応する消火剤のみの組合せとして、次のうち正しいものはどれか。',
    yesLabel: '油火災・電気火災の両方に適応', noLabel: 'どちらかに適応しない',
    yes: ['ハロゲン化物', '二酸化炭素', '霧状の強化液', 'りん酸塩類の粉末', '炭酸水素塩類の粉末'],
    no: [['泡', '電気火災に不適（感電）'], ['棒状の強化液', '油・電気火災に不適'], ['棒状の水', '油・電気火災に不適'], ['霧状の水', '油火災に不適']],
  });
  regSet({
    id: 'set_kanseiyu', topic: 's_dai3', w: 2,
    stemPos: '次の動植物油のうち、乾性油に該当するものはどれか。',
    stemNeg: '次の動植物油のうち、乾性油に該当しないものはどれか。',
    yesLabel: '乾性油（ヨウ素価130以上）', noLabel: '乾性油ではない',
    yes: O.OIL_DRYING.乾性油,
    no: O.OIL_DRYING.半乾性油.map((x) => [x, '半乾性油']).concat(O.OIL_DRYING.不乾性油.map((x) => [x, '不乾性油'])),
  });
  regSet({
    id: 'set_dai4', topic: 's_dai3', w: 2,
    stemPos: '次のうち、第4石油類に該当するものはどれか。',
    stemNeg: '次のうち、第4石油類に該当しないものはどれか。',
    yesLabel: '第4石油類', noLabel: '第4石油類ではない',
    yes: ['ギヤー油', 'シリンダー油', 'タービン油', 'モーター油'],
    no: [['ツバキ油', '動植物油類'], ['アマニ油', '動植物油類'], ['ヒマシ油', '動植物油類'], ['クレオソート油', '第3石油類'], ['重油', '第3石油類'], ['ナタネ油', '動植物油類']],
  });

  /* ═════════════ 法令 ═════════════ */
  regSet({
    id: 'set_kiken', topic: 'h_def',
    stemPos: '法令上、次のうち危険物に該当するものはどれか。',
    stemNeg: '法令上、次のうち危険物に該当しないものはどれか。',
    yesLabel: '危険物', noLabel: '危険物ではない',
    yes: [['ガソリン', '第4類'], ['灯油', '第4類'], ['硝酸', '第6類'], ['過酸化水素', '第6類'], ['硫黄', '第2類'], ['赤りん', '第2類'], ['ナトリウム', '第3類'], ['黄りん', '第3類'], ['ニトログリセリン', '第5類'], ['塩素酸カリウム', '第1類'], ['アセトン', '第4類'], ['重油', '第4類']],
    no: [['プロパン', '気体'], ['水素', '気体'], ['アセチレン', '気体'], ['硫酸', '危険物に指定されていない'], ['塩酸', '危険物に指定されていない'], ['液体酸素', '危険物に指定されていない'], ['消石灰', '危険物に指定されていない'], ['一酸化炭素', '気体']],
  });
  regPair({
    id: 'pair_rui', topic: 'h_def', stem: '法令上、危険物の類とその性質の組合せとして',
    pairs: [['第1類', '酸化性固体'], ['第2類', '可燃性固体'], ['第3類', '自然発火性物質及び禁水性物質'], ['第4類', '引火性液体'], ['第5類', '自己反応性物質'], ['第6類', '酸化性液体']],
  });
  regPair({
    id: 'pair_hinmei', topic: 'h_hinmei', stem: '法令上、危険物の物品名とその品名の組合せとして', w: 3,
    pairs: () => O.SUBSTANCES.map((s) => [s.name, O.GROUPS[s.g].name]).concat(O.EXTRA_HINMEI.map(([n, g]) => [n, O.GROUPS[g].name])),
  });
  regPair({
    id: 'pair_hinmei_def', topic: 'h_hinmei', stem: '法令上、第4類の品名とその定義（1気圧における引火点）の組合せとして',
    pairs: [['第1石油類', '引火点21℃未満'], ['第2石油類', '引火点21℃以上70℃未満'], ['第3石油類', '引火点70℃以上200℃未満'], ['第4石油類', '引火点200℃以上250℃未満'], ['アルコール類', '炭素数1〜3の飽和1価アルコール'], ['特殊引火物', '発火点100℃以下、または引火点-20℃以下かつ沸点40℃以下']],
  });
  regSet({
    id: 'set_hinmei_d1', topic: 'h_hinmei',
    stemPos: '法令上、次の危険物のうち、第1石油類に該当するものはどれか。',
    yesLabel: '第1石油類', noLabel: '第1石油類ではない',
    yes: () => O.SUBSTANCES.filter((s) => s.g === 'dai1').map((s) => [s.name, '']),
    no: () => O.SUBSTANCES.filter((s) => s.g !== 'dai1').map((s) => [s.name, O.GROUPS[s.g].name]),
  });
  regSet({
    id: 'set_hinmei_d2', topic: 'h_hinmei',
    stemPos: '法令上、次の危険物のうち、第2石油類に該当するものはどれか。',
    yesLabel: '第2石油類', noLabel: '第2石油類ではない',
    yes: () => O.SUBSTANCES.filter((s) => s.g === 'dai2').map((s) => [s.name, '']),
    no: () => O.SUBSTANCES.filter((s) => s.g !== 'dai2').map((s) => [s.name, O.GROUPS[s.g].name]),
  });
  regPair({
    id: 'pair_shitei', topic: 'h_shitei', stem: '法令上、危険物の物品名と指定数量の組合せとして',
    pairs: () => O.SUBSTANCES.map((s) => [s.name, fmtL(O.shiteiOf(s))]),
  });

  /* 指定数量の倍数計算 */
  reg({
    id: 'g_baisu', topic: 'h_shitei', w: 5,
    make() {
      const pool = ['gasoline', 'benzene', 'toluene', 'acetone', 'methanol', 'ethanol', 'kerosene', 'diesel', 'aceticacid', 'heavyoil', 'creosote', 'glycerin', 'eg', 'gearoil', 'ether', 'cs2', 'linseed', 'xylene'].map((id) => O.SUB[id]);
      const n = pick([2, 3, 3, 4, 4]);
      const subs = sample(pool, n);
      const items = subs.map((s) => {
        const k = pick([0.5, 1, 1.5, 2, 2.5, 3, 4, 5]);
        return { s, k, q: O.shiteiOf(s) * k };
      });
      const total = items.reduce((a, x) => a + x.k, 0);
      const alt = (fn) => items.reduce((a, x) => a + x.q / fn(x.s), 0);
      const wrongs = [
        alt((s) => O.GROUPS[s.g].shitei[0]), // 水溶性を区別しない
        alt((s) => O.GROUPS[s.g].shitei[1]), // すべて水溶性扱い
        alt((s) => O.GROUPS[s.g].shitei[s.ws ? 0 : 1]),
        total + 0.5, total - 0.5, total + 1, total * 2, total - 1, total + 1.5,
      ];
      return build(this, {
        stem: `法令上、同一の場所で次の危険物を貯蔵する場合、指定数量の倍数の合計はいくつか。\n` + items.map((x) => `・${x.s.name}　${fmtL(x.q)}`).join('\n'),
        choices: numChoices(total, shuffle(wrongs.slice(0, 3)).concat(shuffle(wrongs.slice(3))), (v) => O.num(v)),
        order: 'num',
        exp: items.map((x) => `${x.s.name}（${O.GROUPS[x.s.g].name}${O.GROUPS[x.s.g].shitei[0] !== O.GROUPS[x.s.g].shitei[1] ? (x.s.ws ? '・水溶性' : '・非水溶性') : ''}、指定数量${fmtL(O.shiteiOf(x.s))}）: ${fmtL(x.q)} ÷ ${fmtL(O.shiteiOf(x.s))} ＝ ${O.num(x.k)}`).join('\n') + `\n合計 ＝ ${O.num(total)} 倍`,
        notes: items.map((x) => 'sub_' + x.s.id),
      });
    },
  });

  regSet({
    id: 'set_okugai', topic: 'h_shisetsu',
    stemPos: '法令上、屋外貯蔵所で貯蔵し、または取り扱うことができない危険物はどれか。',
    stemNeg: '法令上、次の危険物のうち、屋外貯蔵所で貯蔵し、または取り扱うことができるものはどれか。',
    yesLabel: '屋外貯蔵所で貯蔵できない', noLabel: '屋外貯蔵所で貯蔵できる',
    yes: [['ナトリウム', '第3類'], ['ガソリン', '引火点0℃未満の第1石油類'], ['ジエチルエーテル', '特殊引火物'], ['二硫化炭素', '特殊引火物'], ['アセトン', '引火点-20℃の第1石油類'], ['ベンゼン', '引火点-11℃の第1石油類'], ['アセトアルデヒド', '特殊引火物'], ['酢酸エチル', '引火点-4℃の第1石油類']],
    no: [['灯油', '第2石油類'], ['軽油', '第2石油類'], ['重油', '第3石油類'], ['エタノール', 'アルコール類'], ['メタノール', 'アルコール類'], ['ギヤー油', '第4石油類'], ['動植物油類', ''], ['トルエン', '引火点4℃で0℃以上の第1石油類'], ['酢酸', '第2石油類'], ['クレオソート油', '第3石油類']],
  });
  regPair({
    id: 'pair_tetsuzuki', topic: 'h_tetsuzuki', stem: '法令上、手続きが必要な事項と、その手続きの組合せとして', w: 3, sep: '…',
    pairs: [
      ['製造所等を設置するとき', '市町村長等の許可'],
      ['製造所等の位置・構造・設備を変更するとき', '市町村長等の許可'],
      ['変更工事中に、工事に係る部分以外の部分を仮に使用するとき', '市町村長等の承認'],
      ['指定数量以上の危険物を10日以内の期間、仮に貯蔵するとき', '所轄消防長または消防署長の承認'],
      ['予防規程を定めるとき', '市町村長等の認可'],
      ['危険物の品名・数量・指定数量の倍数を変更するとき', '変更しようとする日の10日前までに市町村長等へ届出'],
      ['製造所等の譲渡・引渡しを受けたとき', '遅滞なく市町村長等へ届出'],
      ['製造所等の用途を廃止したとき', '遅滞なく市町村長等へ届出'],
      ['危険物保安監督者を選任したとき', '遅滞なく市町村長等へ届出'],
    ],
  });
  regSet({
    id: 'set_heishu', topic: 'h_menjo',
    stemPos: '法令上、丙種危険物取扱者が取り扱うことのできる危険物はどれか。',
    stemNeg: '法令上、丙種危険物取扱者が取り扱うことのできない危険物はどれか。',
    yesLabel: '丙種で取り扱える', noLabel: '丙種では取り扱えない',
    yes: [['ガソリン', ''], ['灯油', ''], ['軽油', ''], ['重油', '第3石油類'], ['ギヤー油', '第4石油類'], ['シリンダー油', '第4石油類'], ['動植物油類', ''], ['グリセリン', '引火点130℃以上の第3石油類']],
    no: [['ベンゼン', '第1石油類'], ['トルエン', '第1石油類'], ['アセトン', '第1石油類'], ['メタノール', 'アルコール類'], ['エタノール', 'アルコール類'], ['ジエチルエーテル', '特殊引火物'], ['二硫化炭素', '特殊引火物'], ['酢酸', '第2石油類'], ['キシレン', '第2石油類'], ['クレオソート油', '引火点130℃未満の第3石油類']],
  });

  /* 保安講習の受講期限 */
  const wareki = (d) => `令和${d.getFullYear() - 2018}年${d.getMonth() + 1}月${d.getDate()}日`;
  const nextApril1 = (d) => new Date(d.getMonth() >= 3 ? d.getFullYear() + 1 : d.getFullYear(), 3, 1);
  const deadline = (april, years) => new Date(april.getFullYear() + years, 2, 31);
  reg({
    id: 'g_koshu', topic: 'h_koshu', w: 3,
    make() {
      if (Math.random() < 0.55) {
        let d;
        do d = new Date(ri(2023, 2027), ri(0, 11), ri(1, 28));
        while (d.getMonth() === 3 && d.getDate() === 1);
        const a = nextApril1(d);
        const correct = deadline(a, 3);
        const plus = (y) => new Date(d.getFullYear() + y, d.getMonth(), d.getDate() - 1);
        const cand = [correct, plus(3), plus(1), deadline(a, 1), deadline(a, 5), plus(5), deadline(a, 2), deadline(a, 4), plus(2)];
        const seen = new Set();
        const opts = [];
        cand.forEach((x, i) => {
          const s = wareki(x) + 'まで';
          if (!seen.has(s) && opts.length < 5) {
            seen.add(s);
            opts.push({ t: s, ok: i === 0, v: x.getTime() });
          }
        });
        return build(this, {
          stem: `製造所等で危険物の取扱作業に従事している危険物取扱者が、${wareki(d)}に保安講習を受講した。法令上、次回の受講期限として正しいものはどれか。`,
          choices: opts,
          order: 'num',
          exp: `受講日以後における最初の4月1日は${wareki(a)}。その日から3年以内なので、期限は${wareki(correct)}。`,
        });
      }
      const gap = pick([6, 12, 18, 30, 36, 48, 60]);
      const within = gap < 24;
      const opts = [
        ['従事することとなった日から1年以内', !within],
        ['従事することとなった日から3年以内', false],
        ['免状の交付を受けた日から1年以内', false],
        ['免状の交付を受けた日以後における最初の4月1日から3年以内', within],
        ['受講する義務はない', false],
      ];
      const y = gap >= 12 ? `${Math.floor(gap / 12)}年${gap % 12 ? gap % 12 + 'か月' : ''}` : `${gap}か月`;
      return build(this, {
        stem: `危険物取扱者の免状の交付を受けてから${y}後に、初めて製造所等で危険物の取扱作業に従事することとなった者がいる。この者の保安講習の受講時期として、法令上、正しいものはどれか。`,
        choices: opts.map(([t, ok]) => ({ t, ok })),
        exp: within
          ? '従事することとなった日前2年以内に免状の交付を受けているので、交付日以後の最初の4月1日から3年以内に受講すればよい。'
          : '免状の交付から2年を超えているので、原則どおり従事することとなった日から1年以内に受講する。',
      });
    },
  });

  regSet({
    id: 'set_kantoku', topic: 'h_hoan', w: 3,
    stemPos: '法令上、危険物保安監督者を定めなければならない製造所等に該当するものはどれか。',
    stemNeg: '法令上、危険物保安監督者を定めなくてもよい製造所等はどれか。',
    yesLabel: '保安監督者が必要', noLabel: '保安監督者は不要',
    yes: ['製造所', '屋外タンク貯蔵所', '給油取扱所', '移送取扱所', '指定数量の倍数が30を超える屋外貯蔵所', '指定数量の倍数が30を超える危険物を容器に詰め替える一般取扱所', 'ガソリンを貯蔵する屋内タンク貯蔵所'],
    no: [['移動タンク貯蔵所', 'どんな場合も不要'], ['指定数量の倍数が30の屋外貯蔵所', '30を超えなければ不要'], ['引火点40℃以上の第4類の危険物のみを貯蔵する屋内タンク貯蔵所', ''], ['指定数量の倍数が30を超える、引火点40℃以上の第4類の危険物のみを取り扱う販売取扱所', ''], ['引火点40℃以上の第4類の危険物のみを指定数量の30倍以下貯蔵する屋内貯蔵所', ''], ['引火点40℃以上の第4類の危険物のみを貯蔵する簡易タンク貯蔵所', '']],
  });

  regSet({
    id: 'set_yobo', topic: 'h_yobo',
    stemPos: '法令上、次の製造所等のうち、予防規程を定めなければならないものはどれか。',
    stemNeg: '法令上、次の製造所等のうち、予防規程を定める必要がないものはどれか。',
    yesLabel: '予防規程が必要', noLabel: '予防規程は不要',
    yes: ['給油取扱所', '移送取扱所', '指定数量の倍数が10以上の製造所', '指定数量の倍数が150以上の屋内貯蔵所', '指定数量の倍数が200以上の屋外タンク貯蔵所', '指定数量の倍数が100以上の屋外貯蔵所', '指定数量の倍数が10以上の一般取扱所'],
    no: ['屋内タンク貯蔵所', '地下タンク貯蔵所', '簡易タンク貯蔵所', '移動タンク貯蔵所', '販売取扱所', '指定数量の倍数が100の屋内貯蔵所', '指定数量の倍数が150の屋外タンク貯蔵所'],
  });
  regSet({
    id: 'set_tenken', topic: 'h_tenken',
    stemPos: '法令上、次の製造所等のうち、定期点検を行わなければならないものはどれか。',
    stemNeg: '法令上、次の製造所等のうち、定期点検を行う必要がないものはどれか。',
    yesLabel: '定期点検が必要', noLabel: '定期点検は不要',
    yes: ['地下タンク貯蔵所', '移動タンク貯蔵所', '移送取扱所', '地下タンクを有する給油取扱所', '指定数量の倍数が10以上の製造所', '指定数量の倍数が150以上の屋内貯蔵所', '指定数量の倍数が200以上の屋外タンク貯蔵所', '指定数量の倍数が100以上の屋外貯蔵所'],
    no: ['屋内タンク貯蔵所', '簡易タンク貯蔵所', '販売取扱所', '地下タンクを有しない指定数量の倍数が5の製造所', '指定数量の倍数が100の屋外タンク貯蔵所'],
  });
  regPair({
    id: 'pair_kyori', topic: 'h_kyori', stem: '法令上、製造所の外壁等から保安対象物までの保安距離の組合せとして', w: 3,
    pairs: [['一般住居（同一敷地外）', '10m以上'], ['小学校', '30m以上'], ['病院', '30m以上'], ['劇場（300人以上収容）', '30m以上'], ['重要文化財に指定された建造物', '50m以上'], ['高圧ガスの施設', '20m以上'], ['7,000Vを超え35,000V以下の特別高圧架空電線', '水平距離3m以上'], ['35,000Vを超える特別高圧架空電線', '水平距離5m以上']],
  });
  regSet({
    id: 'set_kyori', topic: 'h_kyori',
    stemPos: '法令上、次の製造所等のうち、保安距離を保たなければならないものはどれか。',
    stemNeg: '法令上、次の製造所等のうち、保安距離を保つ必要がないものはどれか。',
    yesLabel: '保安距離が必要', noLabel: '保安距離は不要',
    yes: ['製造所', '屋内貯蔵所', '屋外タンク貯蔵所', '屋外貯蔵所', '一般取扱所'],
    no: ['屋内タンク貯蔵所', '地下タンク貯蔵所', '簡易タンク貯蔵所', '移動タンク貯蔵所', '給油取扱所', '販売取扱所'],
  });
  regSet({
    id: 'set_kuchi', topic: 'h_kyori',
    stemPos: '法令上、次の製造所等のうち、周囲に保有空地を保有しなければならないものはどれか。',
    stemNeg: '法令上、次の製造所等のうち、周囲に保有空地を保有する必要がないものはどれか。',
    yesLabel: '保有空地が必要', noLabel: '保有空地は不要',
    yes: ['製造所', '屋内貯蔵所', '屋外タンク貯蔵所', '屋外貯蔵所', '一般取扱所', '屋外に設ける簡易タンク貯蔵所'],
    no: ['屋内タンク貯蔵所', '地下タンク貯蔵所', '移動タンク貯蔵所', '給油取扱所', '販売取扱所'],
  });

  /* 防油堤の容量 */
  reg({
    id: 'g_boyutei', topic: 'h_kijun', w: 2,
    make() {
      const n = pick([2, 3]);
      const caps = sample([100, 200, 300, 400, 500, 600, 800, 1000], n).sort((a, b) => b - a);
      const oil = pick(['ガソリン', '灯油', '重油', '軽油']);
      const max = caps[0];
      const sum = caps.reduce((a, b) => a + b, 0);
      return build(this, {
        stem: `法令上、同一の防油堤内に、${oil}を貯蔵する屋外貯蔵タンクが${n}基（${caps.map((c, i) => 'ABC'[i] + ': ' + c.toLocaleString() + 'kL').join('、')}）設置されている。この防油堤に必要な最小の容量はどれか。`,
        choices: numChoices(max * 1.1, [sum * 1.1, max, sum, max * 1.5, max * 1.2], (v) => O.num(v, 0) + 'kL', 0),
        order: 'num',
        exp: `防油堤の容量は、最大のタンク（${max.toLocaleString()}kL）の110%以上 → ${max.toLocaleString()} × 1.1 ＝ ${O.num(max * 1.1, 0)}kL`,
      });
    },
  });
  regSet({
    id: 'set_kyuyu', topic: 'h_kyuyu',
    stemPos: '法令上、給油取扱所に設けることができない建築物等はどれか。',
    stemNeg: '法令上、給油取扱所に設けることができる建築物等はどれか。',
    yesLabel: '設けることができない', noLabel: '設けることができる',
    yes: ['遊技場', '診療所', '病院', '共同住宅'],
    no: ['給油・灯油の詰替えのための作業場', '給油取扱所の業務を行うための事務所', '自動車等の点検・整備を行う作業場', '自動車等の洗浄を行う作業場', '店舗・飲食店・展示場', '給油取扱所の所有者等が居住する住居'],
  });
  regPair({
    id: 'pair_shoka', topic: 'h_shoka', stem: '法令上、消火設備とその区分の組合せとして', w: 3,
    pairs: [['屋内消火栓設備', '第1種'], ['屋外消火栓設備', '第1種'], ['スプリンクラー設備', '第2種'], ['泡消火設備', '第3種'], ['不活性ガス消火設備', '第3種'], ['粉末消火設備', '第3種'], ['水噴霧消火設備', '第3種'], ['大型消火器', '第4種'], ['小型消火器', '第5種'], ['乾燥砂', '第5種'], ['膨張ひる石', '第5種'], ['水バケツ', '第5種']],
  });
  regSet({
    id: 'set_5shu', topic: 'h_shoka',
    stemPos: '法令上、第5種の消火設備に該当するものはどれか。',
    stemNeg: '法令上、第5種の消火設備に該当しないものはどれか。',
    yesLabel: '第5種', noLabel: '第5種ではない',
    yes: ['小型消火器', '泡を放射する小型の消火器', '乾燥砂', '膨張ひる石', '膨張真珠岩', '水バケツ', '水槽'],
    no: [['大型消火器', '第4種'], ['泡を放射する大型の消火器', '第4種'], ['ハロゲン化物消火設備', '第3種'], ['スプリンクラー設備', '第2種'], ['屋内消火栓設備', '第1種'], ['泡消火設備', '第3種'], ['粉末消火設備', '第3種'], ['屋外消火栓設備', '第1種']],
  });
  regSet({
    id: 'set_keiho', topic: 'h_shoka',
    stemNeg: '法令上、指定数量の10倍以上の危険物を貯蔵する製造所等に設ける警報設備に該当しないものはどれか。',
    stemPos: '法令上、製造所等に設ける警報設備に該当するものはどれか。',
    yesLabel: '警報設備', noLabel: '警報設備ではない',
    yes: ['自動火災報知設備', '消防機関に報知ができる電話', '非常ベル装置', '拡声装置', '警鐘'],
    no: ['ガス漏れ火災警報設備', '発煙筒', '赤色の回転灯', '誘導灯'],
  });
  regPair({
    id: 'pair_hyoshiki', topic: 'h_hyoshiki', stem: '法令上、製造所等の標識・掲示板とその色の組合せとして', w: 3,
    pairs: [['「火気厳禁」の掲示板', '地赤色・文字白色'], ['「給油中エンジン停止」の掲示板', '地黄色・文字黒色'], ['製造所等である旨を示す標識', '地白色・文字黒色'], ['移動タンク貯蔵所の「危」の標識', '地黒色・文字黄色（反射塗料）'], ['「禁水」の掲示板', '地青色・文字白色'], ['「火気注意」の掲示板', '地赤色・文字白色']],
  });
  regSet({
    id: 'set_konsai', topic: 'h_unpan',
    stemPos: '法令上、指定数量の1/10を超える危険物を車両で運搬する場合、混載することが認められている組合せはどれか。',
    stemNeg: '法令上、指定数量の1/10を超える危険物を車両で運搬する場合、混載することが認められていない組合せはどれか。',
    yesLabel: '混載できる', noLabel: '混載できない',
    yes: ['第1類と第6類', '第2類と第4類', '第2類と第5類', '第3類と第4類', '第4類と第5類'],
    no: ['第1類と第4類', '第4類と第6類', '第1類と第2類', '第1類と第3類', '第2類と第3類', '第2類と第6類', '第3類と第5類', '第5類と第6類'],
  });
  regSet({
    id: 'set_hyoji', topic: 'h_unpan',
    stemNeg: '法令上、第4類の水溶性の危険物を収納した運搬容器の外部に表示しなければならない事項に該当しないものはどれか。',
    stemPos: '法令上、第4類の水溶性の危険物を収納した運搬容器の外部に表示しなければならない事項はどれか。',
    yesLabel: '表示が必要', noLabel: '表示は不要',
    yes: ['品名・危険等級・化学名', '数量', '「水溶性」', '注意事項「火気厳禁」'],
    no: ['危険物取扱者の氏名', '注意事項「禁水」', '指定数量の倍数', '運搬経路', '消火方法'],
  });
  regPair({
    id: 'pair_tokyu', topic: 'h_unpan', stem: '法令上、運搬容器に表示する危険等級と危険物の組合せとして', sep: '…危険等級',
    pairs: [['特殊引火物', 'Ⅰ'], ['ガソリン', 'Ⅱ'], ['アルコール類', 'Ⅱ'], ['アセトン', 'Ⅱ'], ['灯油', 'Ⅲ'], ['重油', 'Ⅲ'], ['ギヤー油', 'Ⅲ'], ['動植物油類', 'Ⅲ']],
  });
  regSet({
    id: 'set_bihin', topic: 'h_iso',
    stemNeg: '法令上、移動タンク貯蔵所に備え付けておかなければならない書類に該当しないものはどれか。',
    stemPos: '法令上、移動タンク貯蔵所に備え付けておかなければならない書類はどれか。',
    yesLabel: '備え付けが必要', noLabel: '備え付け不要',
    yes: ['完成検査済証', '定期点検記録', '譲渡・引渡しの届出書', '品名・数量・指定数量の倍数の変更の届出書'],
    no: ['予防規程', '危険物保安監督者の選任届出書', '危険物取扱者全員の名簿', '保安講習の受講証明書', '設置許可申請書の写し'],
  });
  regSet({
    id: 'set_torikeshi', topic: 'h_meirei',
    stemPos: '法令上、市町村長等から製造所等の許可の取消しを受けることがある事由に該当するものはどれか。',
    stemNeg: '法令上、市町村長等から製造所等の許可の取消しを受けることがある事由に該当しないものはどれか。',
    yesLabel: '許可の取消し（又は使用停止）の事由', noLabel: '許可の取消しの事由ではない',
    yes: ['位置・構造・設備を無許可で変更した', '完成検査済証の交付前に製造所等を使用した', '位置・構造・設備の修理・改造・移転命令に違反した', '定期点検を実施しなかった', '定期点検の記録を作成しなかった'],
    no: [['危険物保安監督者を選任しなかった', '使用停止命令の事由'], ['危険物の貯蔵・取扱基準の遵守命令に違反した', '使用停止命令の事由'], ['危険物保安監督者の解任命令に違反した', '使用停止命令の事由'], ['危険物保安統括管理者を選任しなかった', '使用停止命令の事由'], ['危険物取扱者が保安講習を受講しなかった', '免状返納命令の対象']],
  });

  /* ═════════════ 物理・化学 ═════════════ */
  const TANTAI = ['酸素', '水素', '窒素', 'オゾン', '硫黄', '鉄', '黒鉛', 'ナトリウム', 'アルミニウム'];
  const KAGOU = ['水', '二酸化炭素', 'エタノール', 'メタン', '塩化ナトリウム', 'ベンゼン', 'アンモニア', '一酸化炭素'];
  const KONGOU = ['空気', 'ガソリン', '灯油', '軽油', '海水', '食塩水', '牛乳', '重油'];
  const cls = (x) => (TANTAI.includes(x) ? '単体' : KAGOU.includes(x) ? '化合物' : '混合物');
  [['単体', TANTAI], ['化合物', KAGOU], ['混合物', KONGOU]].forEach(([name, list]) => {
    regSet({
      id: 'set_bunrui_' + name, topic: 'b_busshitsu', w: 1,
      stemPos: `次の物質のうち、${name}に該当するものはどれか。`,
      yesLabel: name, noLabel: `${name}ではない`,
      yes: list,
      no: () => TANTAI.concat(KAGOU, KONGOU).filter((x) => !list.includes(x)).map((x) => [x, cls(x)]),
    });
  });
  const PHYS = ['氷が融けて水になる', 'ドライアイスが気体の二酸化炭素になる', 'ニクロム線に電流を流すと赤熱する', '砂糖が水に溶ける', 'ガソリンが蒸発する', '水が凍って氷になる', 'ナフタレンが昇華する', '原油を分留してガソリンを得る'];
  const CHEM = ['鉄がさびる', '木炭が燃える', '紙が燃えて灰になる', '水を電気分解すると水素と酸素が発生する', '亜鉛に塩酸を加えると水素が発生する', '酸と塩基が中和する', 'ガソリンが燃焼する', '牛乳からヨーグルトができる'];
  regSet({ id: 'set_kagaku_henka', topic: 'b_busshitsu', stemPos: '次のうち、化学変化に該当するものはどれか。', stemNeg: '次のうち、化学変化に該当しないものはどれか。', yesLabel: '化学変化', noLabel: '物理変化', yes: CHEM, no: PHYS });
  regSet({ id: 'set_butsuri_henka', topic: 'b_busshitsu', stemPos: '次のうち、物理変化に該当するものはどれか。', stemNeg: '次のうち、物理変化に該当しないものはどれか。', yesLabel: '物理変化', noLabel: '化学変化', yes: PHYS, no: CHEM });

  /* 熱量の計算 */
  reg({
    id: 'g_netsuryo', topic: 'b_netsu', w: 3,
    make() {
      const m = pick([50, 100, 200, 500]);
      const c = pick([0.5, 1.0, 1.5, 2.0, 2.5]);
      const t1 = pick([10, 15, 20]);
      const dt = pick([10, 20, 30, 40, 50]);
      const t2 = t1 + dt;
      const kj = (m * c * dt) / 1000;
      return build(this, {
        stem: `比熱が${O.num(c, 1)}J/(g·K)の液体${m}gの温度を、${t1}℃から${t2}℃まで上昇させるのに必要な熱量はどれか。`,
        choices: numChoices(kj, shuffle([(m * c * t2) / 1000, (m * dt) / c / 1000, kj * 10, kj / 10, kj * 2]), (v) => O.num(v) + 'kJ'),
        order: 'num',
        exp: `熱量 Q ＝ 質量 × 比熱 × 温度差 ＝ ${m} × ${O.num(c, 1)} × (${t2} − ${t1}) ＝ ${m * c * dt}J ＝ ${O.num(kj)}kJ`,
      });
    },
  });
  /* 体膨張の計算 */
  reg({
    id: 'g_bocho', topic: 'b_netsu', w: 2,
    make() {
      const V = pick([100, 200, 500, 1000, 2000]);
      const t1 = pick([5, 10, 15]);
      const dt = pick([10, 20, 30]);
      const dV = V * 1.35e-3 * dt;
      return build(this, {
        stem: `${t1}℃のガソリン${fmtL(V)}を${t1 + dt}℃まで温めると、体積は何L増加するか。ただし、ガソリンの体膨張率を1.35×10⁻³ K⁻¹とし、蒸発は考えないものとする。`,
        choices: numChoices(dV, shuffle([V * 1.35e-3, dV * 10, dV / 10, V * 1.35e-3 * (t1 + dt)]), (v) => O.num(v) + 'L'),
        order: 'num',
        exp: `増加量 ＝ 元の体積 × 体膨張率 × 温度差 ＝ ${V} × 1.35×10⁻³ × ${dt} ＝ ${O.num(dV)}L`,
      });
    },
  });
  /* 比重と質量 */
  reg({
    id: 'g_hiju', topic: 'b_jotai', w: 2,
    make() {
      const [name, sg] = pick([['ガソリン', 0.7], ['灯油', 0.8], ['軽油', 0.85], ['重油', 0.9], ['エタノール', 0.8], ['二硫化炭素', 1.26], ['グリセリン', 1.26]]);
      const V = pick([100, 200, 500, 1000, 2000]);
      const mass = sg * V;
      return build(this, {
        stem: `液比重${sg}の${name}${fmtL(V)}の質量はおよそ何kgか。`,
        choices: numChoices(mass, shuffle([V / sg, mass * 10, mass / 10, V, V * (2 - sg)]), (v) => O.num(v, 1) + 'kg', 1),
        order: 'num',
        exp: `水1L＝1kg。質量 ＝ 比重 × 体積 ＝ ${sg} × ${V} ＝ ${O.num(mass, 1)}kg`,
      });
    },
  });

  /* 燃焼に必要な酸素量 */
  const COMB = [
    { n: 'メタン', f: 'CH₄', M: 16, o2: 2, eq: 'CH₄ ＋ 2O₂ → CO₂ ＋ 2H₂O' },
    { n: 'エタノール', f: 'C₂H₅OH', M: 46, o2: 3, eq: 'C₂H₅OH ＋ 3O₂ → 2CO₂ ＋ 3H₂O' },
    { n: 'メタノール', f: 'CH₃OH', M: 32, o2: 1.5, eq: '2CH₃OH ＋ 3O₂ → 2CO₂ ＋ 4H₂O' },
    { n: 'プロパン', f: 'C₃H₈', M: 44, o2: 5, eq: 'C₃H₈ ＋ 5O₂ → 3CO₂ ＋ 4H₂O' },
    { n: 'アセトン', f: 'CH₃COCH₃', M: 58, o2: 4, eq: 'CH₃COCH₃ ＋ 4O₂ → 3CO₂ ＋ 3H₂O' },
    { n: 'エタン', f: 'C₂H₆', M: 30, o2: 3.5, eq: '2C₂H₆ ＋ 7O₂ → 4CO₂ ＋ 6H₂O' },
  ];
  reg({
    id: 'g_mol', topic: 'b_kagaku', w: 2,
    make() {
      const c = pick(COMB);
      const k = pick([1, 2, 3]);
      const mass = c.M * k;
      const mol = c.o2 * k;
      const asL = Math.random() < 0.4;
      const val = asL ? mol * 22.4 : mol;
      const fmt = (v) => (asL ? O.num(v, 1) + 'L' : O.num(v, 1) + 'mol');
      return build(this, {
        stem: `${c.n}（${c.f}）${mass}gを完全燃焼させるのに必要な酸素の量は${asL ? '、0℃・1気圧で何Lか' : '何molか'}。ただし、原子量はH＝1、C＝12、O＝16とする。`,
        choices: numChoices(val, shuffle([val * 2, val / 2, (asL ? 22.4 : 1) * k, val * 1.5, val + (asL ? 22.4 : 1)]), fmt, 1),
        order: 'num',
        exp: `${c.eq}\n${c.n}の分子量は${c.M}なので ${mass}g ＝ ${k}mol。${c.n}1molに酸素${c.o2}molが必要 → ${O.num(mol, 1)}mol${asL ? ` × 22.4L ＝ ${O.num(val, 1)}L` : ''}`,
      });
    },
  });

  const NENSHO = { 蒸発燃焼: ['ガソリン', '灯油', '重油', 'エタノール', '硫黄', 'ナフタレン'], 表面燃焼: ['木炭', 'コークス'], 分解燃焼: ['木材', '石炭', '紙', 'プラスチック'], '内部（自己）燃焼': ['セルロイド', 'ニトロセルロース'] };
  regPair({
    id: 'pair_nensho', topic: 'b_nensho', stem: '可燃物とその燃焼の仕方の組合せとして', w: 3,
    pairs: () => Object.keys(NENSHO).flatMap((k) => NENSHO[k].map((x) => [x, k])),
  });
  regPair({
    id: 'pair_shizen', topic: 'b_shizen', stem: '自然発火の原因となる熱とその物質の組合せとして', w: 3, sep: '…',
    pairs: [['乾性油', '酸化熱'], ['石炭', '酸化熱'], ['ゴム粉', '酸化熱'], ['原綿', '酸化熱'], ['セルロイド', '分解熱'], ['ニトロセルロース', '分解熱'], ['活性炭', '吸着熱'], ['木炭粉末', '吸着熱'], ['たい肥', '微生物による発酵熱'], ['ごみ', '微生物による発酵熱']],
  });
  regPair({
    id: 'pair_kouka', topic: 'b_shoka', stem: '消火の方法とその主な消火効果の組合せとして', w: 3, sep: '…',
    pairs: [['ガスの元栓を閉めて火を消す', '除去効果'], ['ろうそくの炎を吹き消す', '除去効果'], ['森林火災で延焼方向の木を伐採する', '除去効果'], ['燃えている油を泡で覆う', '窒息効果'], ['二酸化炭素消火剤で消火する', '窒息効果'], ['アルコールランプにふたをかぶせる', '窒息効果'], ['乾燥砂で覆う', '窒息効果'], ['燃えている木材に注水する', '冷却効果'], ['ハロゲン化物消火剤で消火する', '抑制効果']],
  });
  regSet({
    id: 'set_denki', topic: 'b_shoka',
    stemNeg: '次の消火剤のうち、電気設備の火災に適応しないものはどれか。',
    stemPos: '次の消火剤のうち、電気設備の火災に適応するものはどれか。',
    yesLabel: '電気火災に適応', noLabel: '電気火災に不適',
    yes: ['霧状の水', '霧状の強化液', '二酸化炭素', 'ハロゲン化物', 'リン酸塩類の粉末', '炭酸水素塩類の粉末'],
    no: [['棒状の水', '感電の危険'], ['棒状の強化液', '感電の危険'], ['泡', '感電の危険']],
  });
  regSet({
    id: 'set_abura', topic: 'b_shoka',
    stemNeg: '次の消火剤のうち、油火災に適応しないものはどれか。',
    stemPos: '次の消火剤のうち、油火災に適応するものはどれか。',
    yesLabel: '油火災に適応', noLabel: '油火災に不適',
    yes: ['泡', '二酸化炭素', 'ハロゲン化物', '霧状の強化液', 'リン酸塩類の粉末', '炭酸水素塩類の粉末'],
    no: [['棒状の水', '油が浮いて拡大'], ['霧状の水', '油が浮いて拡大'], ['棒状の強化液', '油が飛散・拡大']],
  });

  /* 燃焼範囲と混合気体 */
  reg({
    id: 'g_hani', topic: 'b_inka', w: 3,
    make() {
      const R = [['ガソリン', 1.4, 7.6], ['灯油', 1.1, 6.0], ['エタノール', 3.3, 19], ['メタノール', 6.0, 36], ['アセトン', 2.15, 13], ['ジエチルエーテル', 1.9, 36], ['ベンゼン', 1.2, 7.8], ['トルエン', 1.1, 7.1]];
      const [name, L, U] = pick(R);
      const mix = (v, total) => ({ v, a: total - v, p: (v / total) * 100 });
      const inside = [];
      for (let p = Math.ceil(L + 0.5); p <= Math.floor(U - 0.5) && p <= 30; p++) inside.push(mix(p, 100));
      const outside = [mix(1, 200)];
      if (L >= 1.4) outside.push(mix(1, 100));
      if (L >= 2.5) outside.push(mix(2, 100), mix(1, 50));
      for (let p = Math.ceil(U + 1); p <= Math.min(U + 25, 60); p += pick([1, 2, 3])) outside.push(mix(p, 100));
      const pos = inside.length < 4 || Math.random() < 0.65;
      const sel = pos ? sample(inside, 1).concat(sample(outside, 4)) : sample(outside, 1).concat(sample(inside, 4));
      const insideSet = new Set(inside);
      return build(this, {
        stem: `${name}の燃焼範囲を${L}〜${U}vol%とする。${name}の蒸気と空気の混合気体のうち、点火したとき${pos ? '燃焼するもの' : '燃焼しないもの'}はどれか。`,
        choices: sel.map((m) => ({ t: `${name}の蒸気${m.v}L と 空気${m.a}L`, ok: pos ? insideSet.has(m) : !insideSet.has(m), mk: insideSet.has(m) ? '○' : '×', why: `濃度 ${O.num(m.p)}vol% → ${insideSet.has(m) ? '燃焼範囲内' : '燃焼範囲外'}` })),
        exp: '蒸気濃度(vol%) ＝ 蒸気 ÷ (蒸気＋空気) × 100 で計算し、燃焼範囲に入っているかを確かめる。',
      });
    },
  });
  /* 「ある引火性液体」の性質（引火点・発火点・燃焼範囲の意味） */
  reg({
    id: 'g_aru', topic: 'b_inka', w: 3,
    make() {
      const a = pick([-30, -20, -10, -5, 5, 10, 15, 25, 30, 40, 50]);
      const b = pick([210, 220, 250, 280, 300, 350, 400, 450]);
      const L = pick([1.0, 1.2, 1.4, 2.0, 3.0]);
      const U = pick([6, 7, 8, 10, 13, 19]);
      const mid = Math.round((L + U) / 2);
      const hi = U + pick([2, 4, 10]);
      const items = [
        { ok: true, t: `液温が${a}℃のとき、液面付近には燃焼範囲の下限値の濃度の蒸気が発生している`, k: 'fpdef' },
        { ok: true, t: `${b}℃まで加熱すると、点火源がなくても自ら燃え出す`, k: 'ign' },
        { ok: true, t: `蒸気濃度が${mid}vol%の空気との混合気体は、点火すると燃焼する`, k: 'mid' },
        { ok: true, t: `蒸気濃度が${hi}vol%の空気との混合気体は、点火しても燃焼しない`, k: 'hi' },
        { ok: true, t: `液温が${a - 5}℃のときは、液面付近の蒸気濃度は燃焼範囲の下限値に達していない`, k: 'below' },
        { ok: false, t: `液温が${a - 5}℃のときでも、点火源があれば液面付近の蒸気に引火する`, fix: `引火点（${a}℃）より低い液温では、液面付近の蒸気は下限値に達しておらず通常は引火しない`, k: 'below' },
        { ok: false, t: `液温が${b}℃に達するまでは、点火源を近づけても燃焼しない`, fix: `液温が引火点${a}℃以上なら点火源で引火する`, k: 'ign' },
        { ok: false, t: `蒸気濃度が${hi}vol%の空気との混合気体は、点火すると燃焼する`, fix: `上限値${U}vol%を超えているので燃焼しない`, k: 'hi' },
        { ok: false, t: `液温が${b}℃になると、液面付近に燃焼範囲の下限値の濃度の蒸気が発生する`, fix: `それは引火点（${a}℃）の説明`, k: 'fpdef' },
        { ok: false, t: `引火点${a}℃とは、液面付近の蒸気濃度が燃焼範囲の上限値に達する液温である`, fix: '引火点は燃焼範囲の下限値の濃度の蒸気を発生する液温', k: 'upper' },
      ];
      if (L >= 1.4) items.push({ ok: false, t: `蒸気濃度が${O.num(L - 0.4, 1)}vol%の空気との混合気体は、点火すると燃焼する`, fix: `下限値${L}vol%未満なので燃焼しない`, k: 'low' });
      return statementQuestion(this, items, `引火点${a}℃、発火点${b}℃、燃焼範囲${L}〜${U}vol%の引火性液体について`, Math.random() < 0.5 ? 'pos' : 'neg');
    },
  });

  /* ═════════════ 性質・消火 ═════════════ */
  regPair({
    id: 'pair_rui2', topic: 's_rui', stem: '危険物の類とその性状の組合せとして', w: 2,
    pairs: [['第1類', '酸化性固体'], ['第2類', '可燃性固体'], ['第3類', '自然発火性物質及び禁水性物質'], ['第4類', '引火性液体'], ['第5類', '自己反応性物質'], ['第6類', '酸化性液体']],
  });
  regOrder({ id: 'ord_fp', topic: 's_kyotsu', prop: 'fp', label: '引火点', gap: 2, w: 2 });
  regOrder({ id: 'ord_ign', topic: 's_kyotsu', prop: 'ign', label: '発火点', gap: 10, w: 1 });
  regSet({
    id: 'set_omoi', topic: 's_kyotsu',
    stemPos: '次の危険物のうち、液比重が1より大きい（水より重い）ものはどれか。',
    stemNeg: '次の危険物のうち、液比重が1より小さい（水より軽い）ものはどれか。',
    yesLabel: '水より重い', noLabel: '水より軽い',
    yes: () => O.SUBSTANCES.filter((s) => s.sg && s.sg[0] > 1).map((s) => [s.name, '比重' + s.sgT]),
    no: () => O.SUBSTANCES.filter((s) => s.sg && s.sg[1] < 1).map((s) => [s.name, '比重' + s.sgT]),
    notes: (sel) => sel.map(([t]) => 'sub_' + O.SUBSTANCES.find((s) => s.name === t).id),
  });
  regSet({
    id: 'set_suiyo', topic: 's_kyotsu',
    stemPos: '次の危険物のうち、水によく溶けるものはどれか。',
    stemNeg: '次の危険物のうち、水に溶けないものはどれか。',
    yesLabel: '水によく溶ける', noLabel: '水に溶けない',
    yes: () => O.SUBSTANCES.filter((s) => s.sol === 'yes').map((s) => s.name),
    no: () => O.SUBSTANCES.filter((s) => s.sol === 'no').map((s) => s.name),
    notes: (sel) => sel.map(([t]) => 'sub_' + O.SUBSTANCES.find((s) => s.name === t).id),
  });
  regSet({
    id: 'set_awa', topic: 's_shoka', w: 3,
    stemPos: '次の危険物の火災のうち、消火に水溶性液体用泡消火剤（耐アルコール泡）を用いなければならないものはどれか。',
    stemNeg: '次の危険物の火災のうち、一般の泡消火剤で消火できるものはどれか。',
    yesLabel: '水溶性（耐アルコール泡が必要）', noLabel: '非水溶性（一般の泡で消火できる）',
    yes: () => O.SUBSTANCES.filter((s) => s.sol === 'yes').map((s) => s.name),
    no: () => O.SUBSTANCES.filter((s) => s.sol === 'no').map((s) => s.name),
  });
  regSet({
    id: 'set_shoka4', topic: 's_shoka',
    stemNeg: '第4類の危険物の火災の消火方法として、適切でないものはどれか。',
    stemPos: '第4類の危険物の火災の消火方法として、適切なものはどれか。',
    yesLabel: '適切', noLabel: '不適切',
    yes: ['泡消火剤を放射する', '二酸化炭素消火剤を放射する', 'ハロゲン化物消火剤を放射する', '粉末消火剤を放射する', '霧状の強化液を放射する'],
    no: [['棒状の水を放射する', '水に浮いて火面が拡大'], ['棒状の強化液を放射する', '油が飛散する'], ['霧状の水を放射する', '水に浮いて火面が拡大'], ['スプリンクラー設備で散水する', '第4類に適応しない']],
  });
  regSet({
    id: 'set_jouon', topic: 's_kyotsu',
    stemPos: '次の危険物のうち、引火点が常温（20℃）より高いものはどれか。',
    stemNeg: '次の危険物のうち、引火点が常温（20℃）より低いものはどれか。',
    yesLabel: '引火点が20℃より高い', noLabel: '引火点が20℃より低い',
    yes: () => O.SUBSTANCES.filter((s) => s.fp && s.fp[0] > 20).map((s) => [s.name, '引火点' + s.fpT]),
    no: () => O.SUBSTANCES.filter((s) => s.fp && s.fp[1] < 20).map((s) => [s.name, '引火点' + s.fpT]),
  });
  /* 物理・化学（参考書の演習問題IIの分析から追加） */
  [['単体', TANTAI], ['化合物', KAGOU], ['混合物', KONGOU]].forEach(([name, list]) => {
    regCountList({
      id: 'cnt_bunrui_' + name, topic: 'b_busshitsu', w: 1, label: name + 'である',
      stem: `次の物質のうち、${name}はいくつあるか。`,
      yes: list, no: () => TANTAI.concat(KAGOU, KONGOU).filter((x) => !list.includes(x)),
      exp: '単体＝1種類の元素（酸素・水素など）／化合物＝2種類以上の元素が結合（水・二酸化炭素・エタノールなど）／混合物＝複数の物質が混ざったもの（空気・食塩水・灯油・軽油・重油など）',
    });
  });
  regSet({
    id: 'set_dosotai', topic: 'b_busshitsu', w: 2,
    stemPos: '次の組合せのうち、互いに同素体であるものはどれか。',
    stemNeg: '次の組合せのうち、互いに同素体でないものはどれか。',
    yesLabel: '同素体', noLabel: '同素体ではない',
    yes: ['酸素とオゾン', 'O₂とO₃', '黒鉛とダイヤモンド', '黄りんと赤りん', '斜方硫黄と単斜硫黄'],
    no: [['濃硫酸と希硫酸', '濃度が違うだけの同じ物質'], ['水と過酸化水素', '別の化合物'], ['エタノールとジメチルエーテル', '異性体'], ['水素と重水素', '同位体'], ['一酸化炭素と二酸化炭素', '別の化合物']],
  });
  regPair({
    id: 'pair_jotai', topic: 'b_jotai', stem: '物質の状態変化とその名称の組合せとして', w: 2, sep: '…',
    pairs: [['液体から固体になる変化', '凝固'], ['固体から液体になる変化', '融解'], ['液体から気体になる変化', '蒸発（気化）'], ['気体から液体になる変化', '凝縮'], ['固体から直接気体になる変化', '昇華'], ['気体から直接固体になる変化', '昇華']],
  });
  regBlank({
    id: 'blank_futten', topic: 'b_jotai', w: 2,
    stem: '沸点の説明として、次の文の【①】〜【④】に当てはまる語句の組合せで正しいものはどれか。',
    template: '沸点とは、液体の【①】と【②】とが等しくなるときの液温をいう。また、沸点は加圧すると【③】なり、減圧すると【④】なる。',
    slots: [['飽和蒸気圧', '最高蒸気圧', '最低蒸気圧'], ['外圧', '内圧'], ['高く', '低く'], ['低く', '高く']],
  });

  /* 法令（参考書の演習問題IVの分析から追加） */
  const FAC_KYORI = ['製造所', '屋内貯蔵所', '屋外タンク貯蔵所', '屋外貯蔵所', '一般取扱所'];
  const FAC_OTHER = ['屋内タンク貯蔵所', '地下タンク貯蔵所', '簡易タンク貯蔵所', '移動タンク貯蔵所', '給油取扱所', '第1種販売取扱所', '第2種販売取扱所'];
  regCountList({
    id: 'cnt_kyori', topic: 'h_kyori', w: 2, label: '保安距離が必要でない',
    stem: '法令上、次の製造所等のうち、保安距離が必要でないものはいくつあるか。',
    yes: FAC_OTHER, no: FAC_KYORI,
    exp: '保安距離が必要なのは、製造所・屋内貯蔵所・屋外タンク貯蔵所・屋外貯蔵所・一般取扱所の5つだけ。',
  });
  regCountList({
    id: 'cnt_kuchi', topic: 'h_kyori', w: 1, label: '保有空地が必要な',
    stem: '法令上、次の製造所等のうち、周囲に保有空地が必要なものはいくつあるか。',
    yes: FAC_KYORI.concat(['屋外に設ける簡易タンク貯蔵所']), no: ['屋内タンク貯蔵所', '地下タンク貯蔵所', '移動タンク貯蔵所', '給油取扱所', '第1種販売取扱所', '第2種販売取扱所'],
    exp: '保有空地が必要なのは、保安距離が必要な5施設＋屋外に設ける簡易タンク貯蔵所（地上の移送取扱所も）。',
  });
  /* 性質・消火（参考書「必須問題130選」の分析から追加） */
  regPair({
    id: 'pair_rui_buppin', topic: 's_rui', stem: '危険物とその類の組合せとして', w: 2, sep: '…',
    pairs: [['塩素酸塩類', '第1類'], ['過塩素酸塩類', '第1類'], ['無機過酸化物', '第1類'], ['亜塩素酸塩類', '第1類'], ['硫化りん', '第2類'], ['赤りん', '第2類'], ['硫黄', '第2類'], ['鉄粉', '第2類'], ['マグネシウム', '第2類'], ['カリウム', '第3類'], ['ナトリウム', '第3類'], ['アルキルアルミニウム', '第3類'], ['黄りん', '第3類'], ['ガソリン', '第4類'], ['酢酸', '第4類'], ['有機過酸化物', '第5類'], ['硝酸エステル類', '第5類'], ['ニトロ化合物', '第5類'], ['過塩素酸', '第6類'], ['過酸化水素', '第6類'], ['硝酸', '第6類']],
  });
  reg({
    id: 'g_inka_temp', topic: 's_kyotsu', w: 2,
    make() {
      for (let i = 0; i < 40; i++) {
        const T = pick([0, 10, 20, 30, 50]);
        const lo = O.SUBSTANCES.filter((x) => x.fp && x.fp[1] < T - 2);
        const hi = O.SUBSTANCES.filter((x) => x.fp && x.fp[0] > T + 2);
        if (!lo.length || hi.length < 4) continue;
        const ans = pick(lo);
        const others = sample(hi, 4);
        return build(this, {
          stem: `液温を${T}℃にした次の危険物にマッチの炎を近づけたところ、1つだけ引火した。その危険物はどれか。`,
          choices: [ans].concat(others).map((x) => ({ t: x.name, ok: x === ans, mk: x === ans ? '○' : '×', why: `引火点 ${x.fpT}` + (x === ans ? `（${T}℃より低い）` : `（${T}℃より高い）`) })),
          exp: `液温が引火点以上なら、液面付近に燃焼範囲の下限値以上の蒸気があり引火する。引火点が${T}℃より低いものを選ぶ。`,
          notes: [ans].concat(others).map((x) => 'sub_' + x.id),
        });
      }
      throw new Error('g_inka_temp');
    },
  });
  reg({
    id: 'g_inka_hani2', topic: 'b_inka', w: 2,
    make() {
      const T = pick([20, 25, 30, 35, 40]);
      const C = pick([5, 6, 7, 8, 9, 10]);
      const fpOk = () => T - pick([5, 10, 15, 20]);
      const fpNg = () => T + pick([5, 10, 15]);
      const lOk = () => Math.max(1, C - pick([1, 2, 3, 5]));
      const lNg = () => C + pick([1, 2, 3]);
      const seen = new Set();
      const opts = [];
      const push = (fp, l, ok) => {
        const k = fp + '/' + l;
        if (seen.has(k)) return false;
        seen.add(k);
        opts.push({ fp, l, ok });
        return true;
      };
      while (!push(fpOk(), lOk(), true));
      const kinds = shuffle([[fpNg, lOk], [fpOk, lNg], [fpNg, lNg], [fpNg, lOk], [fpOk, lNg], [fpNg, lNg]]);
      for (const [a, b] of kinds) {
        if (opts.length >= 5) break;
        for (let t = 0; t < 10 && !push(a(), b(), false); t++);
      }
      return build(this, {
        stem: `「ある引火性液体は、液温${T}℃で液面付近に濃度${C}vol%の可燃性蒸気を発生した。この状態でマッチの炎を近づけたところ引火した。」この液体の引火点及び燃焼範囲の下限値の組合せとして、考えられるものはどれか。`,
        choices: opts.map((o) => ({
          t: `引火点 ${o.fp}℃　下限値 ${o.l}vol%`,
          ok: o.ok,
          mk: o.ok ? '○' : '×',
          why: o.ok ? `引火点が${T}℃以下、下限値が${C}vol%以下で条件に合う` : [o.fp > T ? `引火点が${T}℃より高い` : '', o.l > C ? `下限値が${C}vol%より高い` : ''].filter(Boolean).join('、'),
        })),
        exp: `${T}℃で引火した → 引火点は${T}℃以下。${C}vol%で燃えた → 燃焼範囲の下限値は${C}vol%以下。`,
      });
    },
  });
  regSet({
    id: 'set_kiken_small', topic: 'b_inka', w: 2,
    stemPos: '可燃性液体の危険性について、その数値が小さいほど危険性が大きいものはどれか。',
    stemNeg: '可燃性液体の危険性について、その数値が大きいほど危険性が大きいものはどれか。',
    yesLabel: '小さいほど危険', noLabel: '大きいほど危険',
    yes: ['最小着火エネルギー', '引火点', '発火点', '燃焼範囲の下限値', '沸点'],
    no: ['火炎伝播速度', '燃焼速度', '燃焼範囲の上限値', '燃焼熱', '蒸気圧'],
  });
  regBlank({
    id: 'blank_shizen', topic: 'b_shizen', w: 2,
    stem: '自然発火の説明として、次の文の【①】〜【③】に当てはまる語句の組合せで正しいものはどれか。',
    template: '自然発火とは、物質に点火源を与えないで、物質が常温において【①】し、その熱が長時間【②】し、【③】に達して自ら燃焼する現象である。',
    slots: [['発熱', '吸熱'], ['蓄積', '放出'], ['発火点', '引火点', '沸点']],
  });
  regBlank({
    id: 'blank_youso', topic: 's_dai3', w: 2,
    stem: '動植物油類について、次の文の【①】〜【③】に当てはまる語句の組合せで正しいものはどれか。',
    template: '動植物油類のうち【①】はヨウ素価が【②】ので空気中の酸素と反応しやすく、この反応で発生した熱が蓄積すると【③】を起こすことがある。',
    slots: [['乾性油', '半乾性油', '不乾性油'], ['高い', '低い'], ['自然発火', '自己燃焼', '爆発燃焼']],
  });
  regBlank({
    id: 'blank_youso2', topic: 's_dai3', w: 1,
    stem: '動植物油類について、次の文の【①】〜【③】に当てはまる語句の組合せで正しいものはどれか。',
    template: '動植物油類は【①】され、ぼろ布等にしみ込ませると、熱が蓄積【②】。これはヨウ素価が高いためであり、ヨウ素価とは油脂【③】に吸収されるヨウ素のグラム数を表したものである。',
    slots: [['酸化', '還元'], ['されやすい', 'されにくい'], ['100g', '10g', '1g']],
  });
  regBlank({
    id: 'blank_mizu', topic: 'b_shoka', w: 2,
    stem: '水による消火作用について、次の文の【①】〜【③】に当てはまる語句の組合せで正しいものはどれか。',
    template: '水による消火は、燃焼に必要な熱エネルギーを取り去る【①】効果が大きい。これは水が大きな【②】熱と比熱を有するからである。また、水が蒸発して多量の蒸気を発生し、空気中の酸素と可燃性ガスを【③】する作用もある。',
    slots: [['冷却', '除去', '窒息'], ['蒸発', '凝縮', '融解'], ['希釈', '抑制', '冷却']],
  });
  regCombo({
    id: 'combo_denki', topic: 'b_shoka', k: 2, w: 2,
    stem: '電気設備の火災に適応する消火器のみの組合せとして、次のうち正しいものはどれか。',
    yesLabel: '電気火災に適応', noLabel: '電気火災に不適',
    yes: ['二酸化炭素消火器', '粉末消火器', 'ハロゲン化物消火器', '霧状の強化液を放射する消火器', '霧状の水を放射する消火器'],
    no: [['化学泡消火器', '感電の危険'], ['機械泡消火器', '感電の危険'], ['棒状の水を放射する消火器', '感電の危険'], ['棒状の強化液を放射する消火器', '感電の危険']],
  });
  /* 物理・化学／法令（参考書「必須問題130選」II・IIIの分析から追加） */
  reg({
    id: 'g_jotai_temp', topic: 'b_jotai', w: 2,
    make() {
      const S = [['エタノール', -114.5, 78], ['メタノール', -98, 64], ['水', 0, 100], ['ベンゼン', 5.5, 80], ['酢酸', 17, 118], ['ジエチルエーテル', -116, 35]];
      const [n, mp, bp] = pick(S);
      const st = (t) => (t < mp ? '固体' : t < bp ? '液体' : '気体');
      const temps = [pick([mp - 20, mp - 5, (mp + bp) / 2 | 0]), pick([bp + 10, bp - 8, mp + 3])].map((x) => Math.round(x));
      if (temps[0] === temps[1]) temps[1] += 15;
      const [t1, t2] = temps.sort((a, b) => a - b);
      const correct = st(t1) + '・' + st(t2);
      const all = [['固体', '固体'], ['固体', '液体'], ['液体', '液体'], ['液体', '気体'], ['気体', '気体'], ['固体', '気体']].map((x) => x.join('・'));
      const opts = O.uniq([correct].concat(shuffle(all.filter((x) => x !== correct)))).slice(0, 5);
      return build(this, {
        stem: `融点が${mp}℃、沸点が${bp}℃の物質（${n}）がある。温度が${t1}℃と${t2}℃のときの状態の組合せ（${t1}℃・${t2}℃の順）として、正しいものはどれか。`,
        choices: opts.map((t) => ({ t, ok: t === correct })),
        exp: `融点より低いと固体、融点〜沸点は液体、沸点以上は気体。${t1}℃→${st(t1)}、${t2}℃→${st(t2)}`,
      });
    },
  });
  reg({
    id: 'g_kitai_hiju', topic: 'b_jotai', w: 2,
    make() {
      const G = [['水素', 'H₂', 2], ['メタン', 'CH₄', 16], ['アセチレン', 'C₂H₂', 26], ['窒素', 'N₂', 28], ['酸素', 'O₂', 32], ['二酸化炭素', 'CO₂', 44], ['プロパン', 'C₃H₈', 44], ['ブタン', 'C₄H₁₀', 58], ['一酸化炭素', 'CO', 28], ['アンモニア', 'NH₃', 17]];
      for (let i = 0; i < 20; i++) {
        const sel = sample(G, 5);
        const big = Math.random() < 0.7;
        const sorted = sel.slice().sort((a, b) => a[2] - b[2]);
        const ans = big ? sorted[4] : sorted[0];
        if (sorted.filter((x) => x[2] === ans[2]).length > 1) continue;
        return build(this, {
          stem: `次の気体のうち、最も比重の${big ? '大きい' : '小さい'}ものはどれか。ただし、原子量は H＝1、C＝12、N＝14、O＝16 とする。`,
          choices: sel.map((g) => ({ t: `${g[0]}（${g[1]}）`, ok: g === ans, mk: g === ans ? '○' : '', why: `分子量 ${g[2]}` })),
          exp: '気体の比重は分子量に比例する。分子量を計算して比べる（空気の平均分子量は約29）。',
        });
      }
      throw new Error('g_kitai_hiju');
    },
  });
  reg({
    id: 'g_netsukagaku', topic: 'b_kagaku', w: 2,
    make() {
      const [n, f, M, q, eq] = pick([['メタン', 'CH₄', 16, 56, 'CH₄ ＋ 2O₂ ＝ CO₂ ＋ 2H₂O ＋ x [kJ]'], ['プロパン', 'C₃H₈', 44, 50, 'C₃H₈ ＋ 5O₂ ＝ 3CO₂ ＋ 4H₂O ＋ x [kJ]'], ['エタノール', 'C₂H₅OH', 46, 30, 'C₂H₅OH ＋ 3O₂ ＝ 2CO₂ ＋ 3H₂O ＋ x [kJ]'], ['メタノール', 'CH₃OH', 32, 23, 'CH₃OH ＋ 3/2O₂ ＝ CO₂ ＋ 2H₂O ＋ x [kJ]']]);
      const x = q * M;
      return build(this, {
        stem: `${n}1gが完全燃焼すると${q}kJの熱が発生するものとする。次の熱化学方程式のxに最も近い値はどれか。ただし、${n}の分子量は${M}とする。\n${eq}`,
        choices: numChoices(x, shuffle([q, q * M / 2, q * M * 2, q * (M + 16), q * 32]), (v) => O.num(v, 0), 0),
        order: 'num',
        exp: `熱化学方程式は1mol（${M}g）あたりの熱量。x ＝ ${q} × ${M} ＝ ${x}kJ`,
      });
    },
  });
  reg({
    id: 'g_bocho_temp', topic: 'b_netsu', w: 2,
    make() {
      const V = pick([1000, 2000, 5000, 10000]);
      const t1 = pick([10, 15, 20]);
      const dT = pick([10, 15, 20]);
      const dV = Math.round(V * 0.00135 * dT);
      const ans = t1 + dT;
      return build(this, {
        stem: `液温${t1}℃のガソリン${fmtL(V)}を温めたら、${fmtL(V + dV)}になった。このときの液温に最も近いものはどれか。ただし、ガソリンの体膨張率を0.00135 K⁻¹とする。`,
        choices: [-10, -5, 0, 5, 10].map((d) => ({ t: `${ans + d}℃`, ok: d === 0 })),
        order: 'fixed',
        exp: `増加量 ＝ 体積 × 体膨張率 × 温度差 → ${dV} ＝ ${V} × 0.00135 × Δt → Δt ≒ ${O.num(dV / (V * 0.00135), 1)}℃。液温は約${ans}℃`,
      });
    },
  });
  regSet({
    id: 'set_ph', topic: 'b_kagaku', w: 1,
    stemPos: '次のうち、中性に最も近いものはどれか。',
    yesLabel: '中性に最も近い', noLabel: '中性から遠い',
    yes: ['pH7.1'],
    no: [['pH2.0', '強い酸性'], ['pH5.1', '酸性'], ['pH11.3', 'アルカリ性'], ['pH12.5', '強いアルカリ性'], ['pH4.0', '酸性'], ['pH9.2', 'アルカリ性']],
  });
  regSet({
    id: 'set_ensan', topic: 'b_kagaku', w: 1,
    stemPos: '金属には塩酸に溶けて水素を発生するものが多いが、次のうち塩酸に溶けないものはどれか。',
    yesLabel: '塩酸に溶けない（水素よりイオン化傾向が小さい）', noLabel: '塩酸に溶ける',
    yes: ['白金', '金', '銀', '銅'],
    no: ['カリウム', 'アルミニウム', 'スズ', '鉄', '亜鉛', 'マグネシウム', 'ニッケル'],
  });
  regCountList({
    id: 'cnt_boshoku', topic: 'b_kagaku', w: 1, label: '防食効果がある',
    stem: '地中に埋設された鋼製の危険物配管を電気化学的な腐食から守るため、配管に異種金属を接続する。次のうち防食効果のあるものはいくつあるか。',
    yes: ['アルミニウム', 'マグネシウム', '亜鉛'], no: ['銅', 'ニッケル', 'スズ', '鉛', '銀'],
    exp: '鉄よりイオン化傾向の大きい金属（Mg・Al・Zn）が先に溶けて鉄を守る。',
  });
  reg({
    id: 'g_moeyasui', topic: 'b_nensho', w: 2,
    make() {
      const keys = [['発熱量', '大きい', '小さい'], ['酸化されやすさ', 'されやすい', 'されにくい'], ['周囲の温度', '高い', '低い'], ['熱伝導率', '小さい', '大きい'], ['空気との接触面積', '大きい', '小さい']];
      const use = sample(keys, 4);
      const correct = use.map((k) => 1);
      const seen = new Set([correct.join()]);
      const opts = [correct];
      while (opts.length < 5) {
        const c = use.map(() => (Math.random() < 0.5 ? 1 : 2));
        if (!seen.has(c.join())) {
          seen.add(c.join());
          opts.push(c);
        }
      }
      return build(this, {
        stem: `次の組合せ（${use.map((k) => k[0]).join('／')}）のうち、一般的に最も可燃物が燃焼しやすい条件はどれか。`,
        choices: opts.map((c) => ({ t: c.map((v, i) => use[i][v]).join('／'), ok: c === correct })),
        exp: '燃えやすい条件: 発熱量が大きい・酸化されやすい・周囲の温度が高い・熱伝導率が小さい・空気との接触面積が大きい',
      });
    },
  });
  reg({
    id: 'g_baisu_drum', topic: 'h_shitei', w: 2,
    make() {
      const C = [['重油', 200, 2000], ['軽油', 200, 1000], ['灯油', 200, 1000], ['ガソリン', 18, 200], ['ガソリン', 20, 200], ['ギヤー油', 200, 6000], ['メタノール', 18, 400]];
      const sel = sample(C, 3).filter((x, i, a) => a.findIndex((y) => y[0] === x[0]) === i);
      const items = sel.map(([n, can, sh]) => {
        let k;
        for (let t = 0; t < 30; t++) {
          k = ri(5, 60) * 5;
          if (((can * k) / sh) * 2 === Math.round(((can * k) / sh) * 2)) break;
        }
        return { n, can, k, sh, b: (can * k) / sh };
      });
      const total = items.reduce((a, x) => a + x.b, 0);
      return build(this, {
        stem: '次の危険物を同一の場所に貯蔵する場合、指定数量の何倍か。\n' + items.map((x) => `・${x.n} ${x.can}Lの金属${x.can >= 200 ? 'ドラム' : ''}缶 ${x.k}本`).join('\n'),
        choices: numChoices(total, shuffle([total + 2.5, total - 2.5, total + 5, total * 1.1, total - 4, total + 3]), (v) => O.num(v) + '倍'),
        order: 'num',
        exp: items.map((x) => `${x.n}: ${x.can}L × ${x.k}本 ÷ ${fmtL(x.sh)} ＝ ${O.num(x.b)}`).join('\n') + `\n合計 ${O.num(total)}倍`,
      });
    },
  });
  reg({
    id: 'g_baisu_add', topic: 'h_shitei', w: 2,
    make() {
      const base = pick([['灯油', 200, 1000], ['軽油', 400, 1000], ['重油', 1000, 2000], ['ガソリン', 100, 200]]);
      const left = 1 - base[1] / base[2];
      const C = [['ガソリン', 200], ['重油', 2000], ['軽油', 1000], ['灯油', 1000], ['ギヤー油', 6000], ['ジエチルエーテル', 50], ['メタノール', 400], ['アセトン', 400]].filter((x) => x[0] !== base[0]);
      for (let tries = 0; tries < 50; tries++) {
        const sel = sample(C, 5);
        const opts = sel.map(([n, sh], i) => {
          const r = i === 0 ? pick([left, left + 0.1, left + 0.2]) : pick([0.1, 0.2, 0.25, 0.3, 0.4, 0.5, 0.6]).toFixed(2) * 1;
          return { n, sh, q: Math.round(sh * r), ok: i === 0 };
        });
        if (opts.some((o, i) => i > 0 && o.q / o.sh >= left - 1e-9)) continue;
        if (opts.some((o) => o.q <= 0)) continue;
        return build(this, {
          stem: `${base[0]}${fmtL(base[1])}と一緒に貯蔵すると、法令上、指定数量以上になるものは次のうちどれか。`,
          choices: opts.map((o) => ({ t: `${o.n} ${fmtL(o.q)}`, ok: o.ok, mk: o.ok ? '○' : '×', why: `${fmtL(o.q)} ÷ ${fmtL(o.sh)} ＝ ${O.num(o.q / o.sh)}倍` })),
          exp: `${base[0]}は ${base[1]} ÷ ${base[2]} ＝ ${O.num(base[1] / base[2])}倍。あと${O.num(left)}倍以上で合計1倍以上（指定数量以上）になる。`,
        });
      }
      throw new Error('g_baisu_add');
    },
  });
  regSet({
    id: 'set_tokatsu', topic: 'h_hoan', w: 2,
    stemPos: '法令上、第4類の危険物を指定数量の3,000倍以上取り扱う場合に、危険物保安統括管理者を定めなければならないものはどれか。',
    yesLabel: '統括管理者が必要', noLabel: '統括管理者は不要',
    yes: ['製造所', '一般取扱所'],
    no: ['給油取扱所', '屋外タンク貯蔵所', '第2種販売取扱所', '屋内貯蔵所', '地下タンク貯蔵所', '屋外貯蔵所'],
  });
  regSet({
    id: 'set_10ka', topic: 'h_tetsuzuki', w: 2,
    stemPos: '法令上、変更しようとする日の10日前までに届け出なければならないものはどれか。',
    yesLabel: '10日前までに届出', noLabel: '10日前の届出ではない',
    yes: ['貯蔵する危険物の品名・数量・指定数量の倍数の変更'],
    no: [['仮貯蔵', '消防長・消防署長の承認'], ['仮使用', '市町村長等の承認'], ['製造所等の譲渡・引渡し', '遅滞なく届出'], ['予防規程の作成', '市町村長等の認可'], ['製造所等の用途の廃止', '遅滞なく届出'], ['危険物保安監督者の選任', '遅滞なく届出']],
  });
  regSet({
    id: 'set_meirei_shurui', topic: 'h_meirei', w: 1,
    stemPos: '次のうち、市町村長等が行う命令として適当でないものはどれか。',
    yesLabel: '市町村長等の命令ではない', noLabel: '市町村長等の命令',
    yes: [['免状の返納命令', '都道府県知事が行う']],
    no: ['危険物の貯蔵・取扱基準の遵守命令', '製造所等の使用停止命令', '位置・構造・設備の修理・改造・移転命令', '危険物保安監督者の解任命令', '予防規程の変更命令', '応急措置命令'],
  });
  regSet({
    id: 'set_yobo_naiyo', topic: 'h_yobo', w: 1,
    stemPos: '予防規程に定めなければならない事項に該当しないものはどれか。',
    yesLabel: '予防規程に定めない', noLabel: '予防規程に定める',
    yes: ['事故等の調査に関すること', '危険物取扱者の給与に関すること'],
    no: ['危険物施設の運転・操作に関すること', '補修に関すること', '地震等のときの措置に関すること', '安全管理（保安）に関すること', '保安教育に関すること', '危険物保安監督者が職務を行えないときの代行者に関すること'],
  });
  /* 法令（参考書「必須問題130選」IVの分析から追加） */
  regCombo({
    id: 'combo_kuchi', topic: 'h_kyori', k: 3, w: 2,
    stem: '法令上、周囲に保有空地を設けなければならない製造所等のみの組合せとして、次のうち正しいものはどれか。',
    yesLabel: '保有空地が必要', noLabel: '保有空地は不要',
    yes: ['製造所', '屋内貯蔵所', '屋外タンク貯蔵所', '屋外貯蔵所', '一般取扱所', '簡易タンク貯蔵所（屋外）'],
    no: ['屋内タンク貯蔵所', '地下タンク貯蔵所', '移動タンク貯蔵所', '給油取扱所', '販売取扱所'],
  });
  regSet({
    id: 'set_teishi_40', topic: 'h_chozo', w: 1,
    stemPos: '法令上、移動貯蔵タンクから危険物を他のタンクに注入するとき、移動タンク貯蔵所の原動機を停止させなければならないのは、引火点が何℃の危険物を注入する場合か。',
    yesLabel: '原動機の停止が必要', noLabel: '基準の値ではない',
    yes: ['引火点40℃未満'],
    no: ['引火点0℃未満', '引火点が常温（20℃）以上', '引火点が常温（20℃）未満', '引火点60℃以上', '引火点21℃未満'],
  });
  regSet({
    id: 'set_shoyo', topic: 'h_shoka', w: 2,
    stemPos: '法令上、消火設備の所要単位について、次のうち正しいものはどれか。',
    stemNeg: '法令上、消火設備の所要単位について、次のうち誤っているものはどれか。',
    yesLabel: '正しい', noLabel: '誤り',
    yes: ['外壁が耐火構造の製造所は、延べ面積100m²を1所要単位とする', '外壁が耐火構造でない製造所は、延べ面積50m²を1所要単位とする', '外壁が耐火構造の貯蔵所は、延べ面積150m²を1所要単位とする', '外壁が耐火構造でない貯蔵所は、延べ面積75m²を1所要単位とする', '危険物は、指定数量の10倍を1所要単位とする'],
    no: [['外壁が耐火構造の貯蔵所は、延べ面積50m²を1所要単位とする', '150m²'], ['外壁が耐火構造でない製造所は、延べ面積150m²を1所要単位とする', '50m²'], ['外壁が耐火構造の製造所は、延べ面積75m²を1所要単位とする', '100m²'], ['危険物は、指定数量の100倍を1所要単位とする', '10倍']],
  });
})();
