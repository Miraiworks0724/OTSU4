/* 画面（ホーム／準備モード／試験モード／結果／暗記ノート／成績） */
(function () {
  'use strict';
  const O = window.OTSU;
  const esc = O.esc;
  const md = O.md;
  const app = document.getElementById('app');
  const store = O.store;
  const S = { screen: 'home', practice: null, exam: null, result: null, notesFilter: '' };
  let timer = null;

  const SUBJ_KEYS = ['all', 'houki', 'butsuka', 'seishou'];
  const subjLabel = (k) => (k === 'all' ? '全科目' : O.SUBJECTS[k].short);
  const freqLabel = (f) => (f <= 1 ? 'すべて' : f === 5 ? '★5のみ' : `★${f}以上`);
  /** 現在の出題範囲（科目×出題頻度）に入る分野の数 */
  const topicCount = (subject, minFreq) => Object.values(O.TOPICS).filter((t) => (subject === 'all' || t.subject === subject) && t.freq >= minFreq).length;
  const pct = (c, n) => (n ? Math.round((c / n) * 100) : 0);

  function go(screen) {
    if (S.screen === 'exam' && screen !== 'exam') pauseClock();
    S.screen = screen;
    if (screen !== 'exam') stopTimer();
    render();
    window.scrollTo(0, 0);
  }

  /* ───────── 暗記ノートの描画 ───────── */
  function renderBody(body) {
    let html = '';
    let table = null;
    let list = null;
    const flushTable = () => {
      if (!table) return;
      const [head, ...rows] = table;
      html += `<div class="tbl-wrap"><table><thead><tr>${head.map((c) => `<th>${md(c)}</th>`).join('')}</tr></thead><tbody>${rows
        .map((r) => `<tr>${r.map((c) => `<td>${md(c)}</td>`).join('')}</tr>`)
        .join('')}</tbody></table></div>`;
      table = null;
    };
    const flushList = () => {
      if (!list) return;
      html += `<ul>${list.map((x) => `<li>${md(x)}</li>`).join('')}</ul>`;
      list = null;
    };
    body.forEach((item) => {
      if (typeof item === 'object' && item.subs) {
        flushTable();
        flushList();
        html += substanceTable(item.subs);
      } else if (item.startsWith('|')) {
        flushList();
        (table = table || []).push(item.slice(1, -1).split('|'));
      } else if (item.startsWith('# ')) {
        flushTable();
        flushList();
        html += `<h4>${md(item.slice(2))}</h4>`;
      } else {
        flushTable();
        (list = list || []).push(item);
      }
    });
    flushTable();
    flushList();
    return html;
  }
  function substanceTable(group) {
    const subs = O.SUBSTANCES.filter((s) => s.g === group);
    return `<div class="tbl-wrap"><table class="subs"><thead><tr><th>物品</th><th>水溶性</th><th>引火点</th><th>発火点</th><th>沸点</th><th>比重</th><th>燃焼範囲</th></tr></thead><tbody>${subs
      .map(
        (s) =>
          `<tr><td><strong>${esc(s.name)}</strong></td><td>${{ yes: '○', no: '×', slight: 'わずか' }[s.sol]}</td><td>${esc(s.fpT)}</td><td>${esc(s.ignT || '—')}</td><td>${esc(s.bpT || '—')}</td><td>${esc(s.sgT || '—')}</td><td>${esc(
            s.rangeT || '—'
          )}</td></tr>`
      )
      .join('')}</tbody></table></div>`;
  }
  const noteCard = (id) => {
    const n = O.NOTES[id];
    if (!n) return '';
    return `<section class="note"><h3>${esc(n.title)}</h3>${renderBody(n.body)}</section>`;
  };

  /* ───────── 解説ブロック（準備モード・結果画面で共通） ───────── */
  function explanation(q, chosen) {
    const ok = chosen === q.answer;
    const unanswered = chosen == null;
    let html = `<div class="verdict ${ok ? 'ok' : 'ng'}"><span class="mark">${ok ? '○' : '×'}</span><div><b>${ok ? '正解！' : unanswered ? '未回答' : '不正解'}</b><small>正解は ${q.answer + 1}${
      !ok && !unanswered ? `（あなたの回答: ${chosen + 1}）` : ''
    }</small></div></div>`;
    if (q.list) {
      html += `<h4>各記述の正誤</h4><ul class="whys">${q.list
        .map((s) => `<li class="${s.ok ? 'is-ok' : 'is-ng'}"><span class="mk">${s.ok ? '○' : '×'}</span><div><b>${s.label}</b> ${esc(s.t)}${s.ok ? '' : `<div class="fix">正しくは → ${esc(s.fix)}</div>`}</div></li>`)
        .join('')}</ul>`;
    } else if (q.choices.some((c) => c.why)) {
      html += `<h4>選択肢ごとの解説</h4><ul class="whys">${q.choices
        .map(
          (c, i) =>
            `<li class="${c.mk === '×' ? 'is-ng' : c.mk === '○' ? 'is-ok' : ''} ${i === q.answer ? 'is-answer' : ''}"><span class="mk">${c.mk || i + 1}</span><div><b>${i + 1}.</b> ${esc(c.t)}${
              c.why ? `<div class="fix">${esc(c.why)}</div>` : ''
            }</div></li>`
        )
        .join('')}</ul>`;
    }
    if (q.exp) html += `<div class="exp">${esc(q.exp).replace(/\n/g, '<br>')}</div>`;
    html += `<details class="memo" ${ok ? '' : 'open'}><summary>${ok ? '暗記ポイントを見る' : 'この問題で暗記すべき内容'}</summary>${q.notes.map(noteCard).join('')}</details>`;
    return html;
  }

  function questionBody(q) {
    const topic = O.TOPICS[q.topic];
    let html = `<div class="badges"><span class="badge ${q.subject}">${esc(O.SUBJECTS[q.subject].short)}</span><span class="badge ghost">${esc(topic.name)}</span><span class="badge freq" title="出題頻度: ${O.FREQ_LABELS[topic.freq]}">${O.stars(topic.freq)}</span></div>`;
    html += `<p class="stem">${esc(q.stem)}</p>`;
    if (q.list) html += `<ol class="stmts">${q.list.map((s) => `<li><b>${s.label}</b><span>${esc(s.t)}</span></li>`).join('')}</ol>`;
    return html;
  }

  /* ───────── ホーム ───────── */
  function renderHome() {
    const d = store.data;
    const last = d.history[0];
    const ex = d.exam;
    const exAnswered = ex ? ex.answers.filter((a) => a != null).length : 0;
    app.innerHTML = `
      <header class="hero">
        <div class="logo" aria-hidden="true">危</div>
        <div><h1>乙4 合格トレーナー</h1><p>危険物取扱者 乙種第4類 試験対策</p></div>
      </header>
      <main class="wrap">
        <section class="strip">
          <div><b>${d.total.n}</b><span>累計回答</span></div>
          <div><b>${d.total.n ? pct(d.total.c, d.total.n) + '%' : '—'}</b><span>正答率</span></div>
          <div><b class="${last ? (last.pass ? 'txt-ok' : 'txt-ng') : ''}">${last ? (last.pass ? '合格' : '不合格') : '—'}</b><span>直近の模試</span></div>
        </section>

        <section class="card">
          <div class="card-h"><span class="pill">準備モード</span><h2>エンドレス演習</h2></div>
          <p class="muted">出題 → 回答 → 解説をくり返します。間違えると、その問題で覚えるべき内容をすべて表示します。</p>
          <div class="seg" role="radiogroup" aria-label="出題範囲">
            ${SUBJ_KEYS.map((k) => `<button role="radio" aria-checked="${d.settings.subject === k}" class="${d.settings.subject === k ? 'on' : ''}" data-act="subject" data-k="${k}">${subjLabel(k)}</button>`).join('')}
          </div>
          <div class="field-h">出題頻度で絞り込む <span class="muted small">（${topicCount(d.settings.subject, d.settings.minFreq)}分野から出題）</span></div>
          <div class="seg freq-seg" role="radiogroup" aria-label="出題頻度">
            ${[1, 2, 3, 4, 5].map((f) => `<button role="radio" aria-checked="${d.settings.minFreq === f}" class="${d.settings.minFreq === f ? 'on' : ''}" data-act="freq" data-f="${f}">${freqLabel(f)}</button>`).join('')}
          </div>
          <p class="muted small freq-help">★5 ほぼ毎回出る ／ ★4 よく出る ／ ★3 ときどき出る ／ ★2 たまに出る</p>
          <label class="toggle"><input type="checkbox" data-act="weak" ${d.settings.weak ? 'checked' : ''}><span></span>苦手な分野を優先して出題する</label>
          <button class="btn primary" data-act="start-practice">準備モードを始める</button>
        </section>

        <section class="card">
          <div class="card-h"><span class="pill exam">試験モード</span><h2>本番形式の模擬試験</h2></div>
          <ul class="facts">
            <li><b>35問</b>（法令15・物理化学10・性質消火10）／五肢択一</li>
            <li>制限時間 <b>2時間</b>（途中で採点もできます）</li>
            <li>合格基準: <b>各科目60%以上</b>（法令9問・物化6問・性消6問以上）</li>
          </ul>
          ${ex ? `<button class="btn" data-act="resume-exam">中断した試験を再開（${exAnswered}/35 回答済み）</button>` : ''}
          <button class="btn primary exam" data-act="start-exam">${ex ? '新しく試験を始める' : '試験を開始する'}</button>
        </section>

        <section class="tiles">
          <button class="tile" data-act="start-review" ${d.wrong.length ? '' : 'disabled'}><b>復習</b><span>間違えた問題 ${d.wrong.length}問</span></button>
          <button class="tile" data-act="notes"><b>暗記ノート</b><span>分野別まとめ</span></button>
          <button class="tile" data-act="stats"><b>成績</b><span>分野別の正答率</span></button>
        </section>

        <p class="fine">問題は過去の出題傾向（頻出テーマ・出題形式）をもとに作成したオリジナル問題です。実際の試験問題は公開されていないため、本番と同一の問題ではありません。</p>
      </main>`;
  }

  /* ───────── 準備モード／復習モード ───────── */
  function startPractice(review) {
    S.practice = { review, n: 0, c: 0, recentPids: [], recentSigs: [], q: null, chosen: null, queue: review ? O.shuffle(store.data.wrong) : null };
    nextQuestion();
    go('practice');
  }
  function nextQuestion() {
    const p = S.practice;
    p.chosen = null;
    if (p.review) {
      if (!p.queue.length) {
        p.q = null;
        return;
      }
      p.q = p.queue.shift();
      return;
    }
    p.q = O.nextPractice({ subject: store.data.settings.subject, weak: store.data.settings.weak, minFreq: store.data.settings.minFreq, recentPids: p.recentPids, recentSigs: p.recentSigs });
    p.recentPids.push(p.q.pid);
    if (p.recentPids.length > 5) p.recentPids.shift();
    p.recentSigs.push(p.q.sig);
    if (p.recentSigs.length > 60) p.recentSigs.shift();
  }
  function renderPractice() {
    const p = S.practice;
    const st = store.data.settings;
    const title = p.review ? '復習モード' : `準備モード・${subjLabel(st.subject)}${st.minFreq > 1 ? '・' + freqLabel(st.minFreq) : ''}`;
    const head = `<header class="bar"><button class="icon-btn" data-act="home" aria-label="終了">✕</button><div class="bar-title">${title}</div><div class="bar-score">${p.c}/${p.n}${p.n ? `<small>${pct(p.c, p.n)}%</small>` : ''}</div></header>`;
    if (!p.q) {
      app.innerHTML = `${head}<main class="wrap"><section class="card center"><h2>復習完了</h2><p class="muted">間違えた問題をすべて解き終わりました（正解した問題は復習リストから外れます）。</p><button class="btn primary" data-act="home">ホームへ</button></section></main>`;
      return;
    }
    const q = p.q;
    const answered = p.chosen != null;
    app.innerHTML = `${head}
      <main class="wrap">
        <section class="card q">
          ${questionBody(q)}
          <div class="choices">
            ${q.choices
              .map((c, i) => {
                let cls = '';
                if (answered) cls = i === q.answer ? 'right' : i === p.chosen ? 'wrong' : 'dim';
                return `<button class="choice ${cls}" data-act="answer" data-i="${i}" ${answered ? 'disabled' : ''}><span class="num">${i + 1}</span><span class="txt">${esc(c.t)}</span></button>`;
              })
              .join('')}
          </div>
        </section>
        ${answered ? `<section class="card explain">${explanation(q, p.chosen)}</section>` : ''}
      </main>
      ${answered ? `<div class="dock"><button class="btn primary" data-act="next">${p.review && !p.queue.length ? '結果を見る' : '次の問題へ'} →</button></div>` : ''}`;
    if (answered) {
      const ex = app.querySelector('.explain');
      if (ex) ex.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }
  }
  function answerPractice(i) {
    const p = S.practice;
    if (p.chosen != null) return;
    p.chosen = i;
    const ok = i === p.q.answer;
    p.n++;
    if (ok) p.c++;
    store.record(p.q, ok, { review: p.review });
    render();
  }

  /* ───────── 試験モード ───────── */
  function startExam() {
    if (store.data.exam && !window.confirm('中断中の試験は破棄されます。新しい試験を始めますか？')) return;
    store.data.exam = { qs: O.buildExam(), answers: Array(35).fill(null), flags: Array(35).fill(false), idx: 0, elapsed: 0, resumedAt: Date.now(), limit: O.EXAM_MINUTES * 60 * 1000 };
    store.save();
    S.grid = false;
    go('exam');
  }
  /* 経過時間は試験画面を開いている間だけ進める（中断・アプリを閉じている間は止まる） */
  const elapsed = (ex) => ex.elapsed + (ex.resumedAt ? Date.now() - ex.resumedAt : 0);
  const remaining = () => store.data.exam.limit - elapsed(store.data.exam);
  function pauseClock() {
    const ex = store.data.exam;
    if (!ex || !ex.resumedAt) return;
    ex.elapsed = elapsed(ex);
    ex.resumedAt = null;
    store.save();
  }
  function resumeClock() {
    const ex = store.data.exam;
    if (!ex || ex.resumedAt) return;
    ex.resumedAt = Date.now();
    store.save();
  }
  const fmtTime = (ms) => {
    const s = Math.max(0, Math.floor(ms / 1000));
    return `${Math.floor(s / 3600)}:${String(Math.floor((s % 3600) / 60)).padStart(2, '0')}:${String(s % 60).padStart(2, '0')}`;
  };
  function startTimer() {
    stopTimer();
    timer = setInterval(() => {
      const el = document.getElementById('timer');
      const r = remaining();
      if (el) {
        el.textContent = fmtTime(r);
        el.classList.toggle('warn', r < 10 * 60 * 1000);
      }
      if (r <= 0) return finishExam(true);
      // 15秒ごとに経過時間を保存（突然閉じても大きくずれないように）
      const ex = store.data.exam;
      if (ex && ex.resumedAt && Date.now() - ex.resumedAt > 15000) {
        ex.elapsed = elapsed(ex);
        ex.resumedAt = Date.now();
        store.save();
      }
    }, 1000);
  }
  function stopTimer() {
    if (timer) clearInterval(timer);
    timer = null;
  }
  function renderExam() {
    const ex = store.data.exam;
    resumeClock();
    const q = ex.qs[ex.idx];
    const done = ex.answers.filter((a) => a != null).length;
    let subjStart = 0;
    const subjInfo = O.SUBJECT_ORDER.map((s) => {
      const n = O.SUBJECTS[s].n;
      const r = { s, from: subjStart, to: subjStart + n };
      subjStart += n;
      return r;
    });
    const grid = `<div class="grid-panel ${S.grid ? 'open' : ''}">${subjInfo
      .map(
        (si) =>
          `<div class="grid-sub"><div class="grid-h">${O.SUBJECTS[si.s].short}</div><div class="grid">${ex.qs
            .slice(si.from, si.to)
            .map((_, k) => {
              const i = si.from + k;
              return `<button class="cell ${ex.answers[i] != null ? 'done' : ''} ${ex.flags[i] ? 'flag' : ''} ${i === ex.idx ? 'cur' : ''}" data-act="jump" data-i="${i}">${i + 1}</button>`;
            })
            .join('')}</div></div>`
      )
      .join('')}<p class="muted small">■ 回答済み　<span class="flag-key">▲</span> 見直し</p></div>`;
    app.innerHTML = `
      <header class="bar exam-bar">
        <button class="icon-btn" data-act="exam-pause" aria-label="中断">‖</button>
        <div class="bar-title"><span id="timer">${fmtTime(remaining())}</span><small>残り時間</small></div>
        <button class="btn small" data-act="grid">${done}/35</button>
        <button class="btn small primary exam" data-act="submit">採点</button>
      </header>
      ${grid}
      <main class="wrap">
        <section class="card q">
          <div class="qno">問${ex.idx + 1}<small> / 35</small>${ex.flags[ex.idx] ? '<span class="flag-key">▲ 見直し</span>' : ''}</div>
          ${questionBody(q)}
          <div class="choices">
            ${q.choices
              .map((c, i) => `<button class="choice ${ex.answers[ex.idx] === i ? 'picked' : ''}" data-act="pick" data-i="${i}"><span class="num">${i + 1}</span><span class="txt">${esc(c.t)}</span></button>`)
              .join('')}
          </div>
        </section>
      </main>
      <div class="dock three">
        <button class="btn" data-act="prev" ${ex.idx === 0 ? 'disabled' : ''}>← 前</button>
        <button class="btn ${ex.flags[ex.idx] ? 'flagged' : ''}" data-act="flag">▲ 見直し</button>
        <button class="btn" data-act="nextq" ${ex.idx === 34 ? 'disabled' : ''}>次 →</button>
      </div>`;
    startTimer();
  }
  function finishExam(timeout) {
    const ex = store.data.exam;
    if (!ex) return;
    stopTimer();
    const g = O.gradeExam(ex);
    const used = Math.min(elapsed(ex), ex.limit);
    ex.qs.forEach((q, i) => store.record(q, ex.answers[i] === q.answer, { deferSave: true }));
    store.data.history.unshift({ at: Date.now(), pass: g.pass, total: g.total, subjects: g.subjects, used });
    store.data.history = store.data.history.slice(0, 50);
    store.data.exam = null;
    store.save();
    S.result = { ex, g, used, timeout, open: {} };
    go('result');
  }
  function renderResult() {
    const { ex, g, used, timeout } = S.result;
    app.innerHTML = `
      <header class="bar"><button class="icon-btn" data-act="home" aria-label="ホームへ">✕</button><div class="bar-title">試験結果</div><div></div></header>
      <main class="wrap">
        <section class="card result ${g.pass ? 'pass' : 'fail'}">
          ${timeout ? '<p class="muted small">制限時間になったため自動採点しました。</p>' : ''}
          <div class="big">${g.pass ? '合格' : '不合格'}</div>
          <p class="muted">総得点 ${g.total}/35（${pct(g.total, 35)}%）・所要時間 ${fmtTime(used)}</p>
          <div class="bars">
            ${O.SUBJECT_ORDER.map((s) => {
              const r = g.subjects[s];
              return `<div class="bar-row"><div class="bar-l"><b>${O.SUBJECTS[s].short}</b><span>${r.c}/${r.n}</span></div><div class="meter"><i style="width:${pct(r.c, r.n)}%" class="${r.pass ? 'ok' : 'ng'}"></i><em style="left:60%"></em></div><span class="tag ${r.pass ? 'ok' : 'ng'}">${r.pass ? '合格' : '不足'}</span></div>`;
            }).join('')}
          </div>
          <p class="muted small">各科目60%（縦線）以上で合格。間違えた問題は「復習」に追加されました。</p>
        </section>
        <h3 class="sec-h">問題ごとの結果</h3>
        <section class="review">
          ${ex.qs
            .map((q, i) => {
              const ok = ex.answers[i] === q.answer;
              return `<details class="rv ${ok ? 'ok' : 'ng'}"><summary><span class="mk">${ok ? '○' : '×'}</span><span class="no">問${i + 1}</span><span class="badge ${q.subject}">${O.SUBJECTS[q.subject].short}</span><span class="sum">${esc(q.stem.split('\n')[0])}</span></summary><div class="rv-body">${questionBody(q)}<ol class="rv-choices">${q.choices
                .map((c, k) => `<li class="${k === q.answer ? 'right' : k === ex.answers[i] ? 'wrong' : ''}">${esc(c.t)}</li>`)
                .join('')}</ol>${explanation(q, ex.answers[i])}</div></details>`;
            })
            .join('')}
        </section>
        <div class="row"><button class="btn" data-act="home">ホームへ</button><button class="btn primary" data-act="start-review" ${store.data.wrong.length ? '' : 'disabled'}>間違えた問題を復習</button></div>
      </main>`;
  }

  /* ───────── 暗記ノート ───────── */
  function renderNotes() {
    const f = S.notesFilter.trim();
    const match = (id) => {
      if (!f) return true;
      const n = O.NOTES[id];
      return (n.title + JSON.stringify(n.body)).includes(f);
    };
    const sections = O.SUBJECT_ORDER.map((s) => {
      const ids = Object.keys(O.TOPICS).filter((t) => O.TOPICS[t].subject === s && match(t));
      if (!ids.length) return '';
      return `<h3 class="sec-h">${esc(O.SUBJECTS[s].name)}</h3>${ids
        .map((id) => `<details class="nt" ${f ? 'open' : ''}><summary>${esc(O.NOTES[id].title)} <span class="stars" title="出題頻度: ${O.FREQ_LABELS[O.TOPICS[id].freq]}">${O.stars(O.TOPICS[id].freq)}</span></summary>${renderBody(O.NOTES[id].body)}</details>`)
        .join('')}`;
    }).join('');
    const subIds = O.SUBSTANCES.map((s) => 'sub_' + s.id).filter(match);
    app.innerHTML = `
      <header class="bar"><button class="icon-btn" data-act="home" aria-label="戻る">←</button><div class="bar-title">暗記ノート</div><div></div></header>
      <main class="wrap">
        <input class="search" type="search" placeholder="キーワードで絞り込み（例: 引火点、移動タンク）" value="${esc(S.notesFilter)}" data-act="filter">
        ${sections}
        ${subIds.length ? `<h3 class="sec-h">物品カード</h3>${subIds.map((id) => `<details class="nt" ${f ? 'open' : ''}><summary>${esc(O.NOTES[id].title)}</summary>${renderBody(O.NOTES[id].body)}</details>`).join('')}` : ''}
        ${!sections && !subIds.length ? '<p class="muted center">該当する項目がありません。</p>' : ''}
      </main>`;
  }

  /* ───────── 成績 ───────── */
  function renderStats() {
    const d = store.data;
    const subj = {};
    O.SUBJECT_ORDER.forEach((s) => (subj[s] = { n: 0, c: 0 }));
    Object.keys(d.topics).forEach((t) => {
      if (!O.TOPICS[t]) return;
      const s = subj[O.TOPICS[t].subject];
      s.n += d.topics[t].n;
      s.c += d.topics[t].c;
    });
    const rows = Object.keys(O.TOPICS)
      .map((t) => ({ t, s: d.topics[t] || { n: 0, c: 0 } }))
      .sort((a, b) => (a.s.n ? a.s.c / a.s.n : 2) - (b.s.n ? b.s.c / b.s.n : 2));
    app.innerHTML = `
      <header class="bar"><button class="icon-btn" data-act="home" aria-label="戻る">←</button><div class="bar-title">成績</div><div></div></header>
      <main class="wrap">
        <section class="card">
          <h2>科目別の正答率</h2>
          <div class="bars">
            ${O.SUBJECT_ORDER.map((s) => {
              const r = subj[s];
              return `<div class="bar-row"><div class="bar-l"><b>${O.SUBJECTS[s].short}</b><span>${r.c}/${r.n}</span></div><div class="meter"><i style="width:${pct(r.c, r.n)}%" class="${pct(r.c, r.n) >= 60 ? 'ok' : 'ng'}"></i><em style="left:60%"></em></div><span class="tag">${r.n ? pct(r.c, r.n) + '%' : '—'}</span></div>`;
            }).join('')}
          </div>
        </section>
        <section class="card">
          <h2>分野別（苦手な順）</h2>
          <div class="tbl-wrap"><table class="stats"><thead><tr><th>分野</th><th>頻度</th><th>回答</th><th>正答率</th></tr></thead><tbody>
            ${rows
              .map(({ t, s }) => `<tr><td><span class="dot ${O.TOPICS[t].subject}"></span>${esc(O.TOPICS[t].name)}</td><td class="stars">${O.stars(O.TOPICS[t].freq)}</td><td>${s.n}</td><td class="${s.n ? (pct(s.c, s.n) >= 60 ? 'txt-ok' : 'txt-ng') : 'muted'}">${s.n ? pct(s.c, s.n) + '%' : '未'}</td></tr>`)
              .join('')}
          </tbody></table></div>
        </section>
        <section class="card">
          <h2>模擬試験の履歴</h2>
          ${
            d.history.length
              ? `<ul class="hist">${d.history
                  .map((h) => {
                    const dt = new Date(h.at);
                    return `<li><span class="tag ${h.pass ? 'ok' : 'ng'}">${h.pass ? '合格' : '不合格'}</span><span>${dt.getMonth() + 1}/${dt.getDate()} ${String(dt.getHours()).padStart(2, '0')}:${String(dt.getMinutes()).padStart(2, '0')}</span><span class="muted">${O.SUBJECT_ORDER.map((s) => `${O.SUBJECTS[s].short} ${h.subjects[s].c}/${h.subjects[s].n}`).join('・')}</span></li>`;
                  })
                  .join('')}</ul>`
              : '<p class="muted">まだ受験していません。</p>'
          }
        </section>
        <button class="btn danger" data-act="reset">学習記録をすべて消去</button>
      </main>`;
  }

  /* ───────── 描画とイベント ───────── */
  function render() {
    if (S.screen === 'exam' && !store.data.exam) S.screen = 'home';
    ({ home: renderHome, practice: renderPractice, exam: renderExam, result: renderResult, notes: renderNotes, stats: renderStats }[S.screen] || renderHome)();
  }

  const actions = {
    home: () => go('home'),
    subject: (el) => {
      store.data.settings.subject = el.dataset.k;
      store.save();
      render();
    },
    freq: (el) => {
      store.data.settings.minFreq = Number(el.dataset.f);
      store.save();
      render();
    },
    'start-practice': () => startPractice(false),
    'start-review': () => startPractice(true),
    answer: (el) => answerPractice(Number(el.dataset.i)),
    next: () => {
      nextQuestion();
      render();
      window.scrollTo(0, 0);
    },
    'start-exam': startExam,
    'resume-exam': () => {
      S.grid = false;
      go('exam');
    },
    pick: (el) => {
      const ex = store.data.exam;
      const i = Number(el.dataset.i);
      ex.answers[ex.idx] = ex.answers[ex.idx] === i ? null : i;
      store.save();
      render();
    },
    prev: () => moveExam(-1),
    nextq: () => moveExam(1),
    jump: (el) => {
      store.data.exam.idx = Number(el.dataset.i);
      S.grid = false;
      store.save();
      render();
      window.scrollTo(0, 0);
    },
    flag: () => {
      const ex = store.data.exam;
      ex.flags[ex.idx] = !ex.flags[ex.idx];
      store.save();
      render();
    },
    grid: () => {
      S.grid = !S.grid;
      render();
    },
    'exam-pause': () => go('home'),
    submit: () => {
      const ex = store.data.exam;
      const left = ex.answers.filter((a) => a == null).length;
      const flagged = ex.flags.filter(Boolean).length;
      const msg = (left ? `未回答が${left}問あります。` : '') + (flagged ? `見直しマークが${flagged}問あります。` : '') + '採点しますか？';
      if (window.confirm(msg)) finishExam(false);
    },
    notes: () => {
      S.notesFilter = '';
      go('notes');
    },
    stats: () => go('stats'),
    reset: () => {
      if (window.confirm('回答履歴・復習リスト・模試の履歴をすべて消去します。よろしいですか？')) {
        store.reset();
        go('home');
      }
    },
  };
  function moveExam(d) {
    const ex = store.data.exam;
    ex.idx = Math.max(0, Math.min(34, ex.idx + d));
    store.save();
    render();
    window.scrollTo(0, 0);
  }

  app.addEventListener('click', (e) => {
    const el = e.target.closest('[data-act]');
    if (!el || el.disabled || el.tagName === 'INPUT') return;
    const fn = actions[el.dataset.act];
    if (fn) fn(el);
  });
  app.addEventListener('change', (e) => {
    if (e.target.dataset.act === 'weak') {
      store.data.settings.weak = e.target.checked;
      store.save();
    }
  });
  app.addEventListener('input', (e) => {
    if (e.target.dataset.act === 'filter') {
      S.notesFilter = e.target.value;
      const pos = e.target.selectionStart;
      renderNotes();
      const inp = app.querySelector('.search');
      inp.focus();
      inp.setSelectionRange(pos, pos);
    }
  });
  document.addEventListener('keydown', (e) => {
    if (e.target.tagName === 'INPUT' || e.metaKey || e.ctrlKey || e.altKey) return;
    const n = Number(e.key);
    if (S.screen === 'practice' && S.practice && S.practice.q) {
      if (S.practice.chosen == null && n >= 1 && n <= 5) answerPractice(n - 1);
      else if (S.practice.chosen != null && (e.key === 'Enter' || e.key === 'ArrowRight')) {
        e.preventDefault();
        actions.next();
      }
    } else if (S.screen === 'exam' && store.data.exam) {
      if (n >= 1 && n <= 5) actions.pick({ dataset: { i: n - 1 } });
      else if (e.key === 'ArrowRight') moveExam(1);
      else if (e.key === 'ArrowLeft') moveExam(-1);
    }
  });

  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'hidden') pauseClock();
    else if (S.screen === 'exam' && store.data.exam) resumeClock();
  });
  window.addEventListener('pagehide', pauseClock);

  // 前回の最終保存以降（アプリを閉じていた時間）は経過時間に含めない
  if (store.data.exam && store.data.exam.resumedAt) {
    store.data.exam.resumedAt = null;
    store.save();
  }
  render();

  if ('serviceWorker' in navigator && (location.protocol === 'https:' || location.hostname === 'localhost')) {
    navigator.serviceWorker.register('sw.js').catch(() => {});
  }
})();
