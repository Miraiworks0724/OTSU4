/* 共通ユーティリティ */
(function () {
  'use strict';
  const O = (window.OTSU = window.OTSU || {});

  O.ri = (a, b) => a + Math.floor(Math.random() * (b - a + 1));
  O.pick = (arr) => arr[Math.floor(Math.random() * arr.length)];
  O.shuffle = (arr) => {
    const a = arr.slice();
    for (let i = a.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [a[i], a[j]] = [a[j], a[i]];
    }
    return a;
  };
  O.sample = (arr, n) => O.shuffle(arr).slice(0, n);
  O.uniq = (arr) => Array.from(new Set(arr));

  /** items と重み関数から1つ選ぶ */
  O.weightedPick = (items, wfn) => {
    const ws = items.map((x) => Math.max(0, wfn(x)));
    const sum = ws.reduce((s, w) => s + w, 0);
    if (sum <= 0) return O.pick(items);
    let r = Math.random() * sum;
    for (let i = 0; i < items.length; i++) {
      r -= ws[i];
      if (r < 0) return items[i];
    }
    return items[items.length - 1];
  };

  O.esc = (s) =>
    String(s == null ? '' : s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

  /** **太字** だけを許可する簡易マークアップ */
  O.md = (s) => O.esc(s).replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>');

  /** 数値を見やすく（最大 digits 桁の小数） */
  O.num = (n, digits = 2) => {
    const p = Math.pow(10, digits);
    const v = Math.round(n * p) / p;
    return v.toLocaleString('ja-JP', { maximumFractionDigits: digits });
  };

  /** 文字列から簡易ハッシュ */
  O.hash = (s) => {
    let h = 2166136261;
    for (let i = 0; i < s.length; i++) {
      h ^= s.charCodeAt(i);
      h = Math.imul(h, 16777619);
    }
    return (h >>> 0).toString(36);
  };
})();
