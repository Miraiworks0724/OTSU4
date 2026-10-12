/* 科目・出題分野・本試験の出題構成 */
(function () {
  'use strict';
  const O = window.OTSU;

  O.SUBJECTS = {
    houki: { name: '危険物に関する法令', short: '法令', n: 15, pass: 9 },
    butsuka: { name: '基礎的な物理学及び基礎的な化学', short: '物理・化学', n: 10, pass: 6 },
    seishou: { name: '危険物の性質並びにその火災予防及び消火の方法', short: '性質・消火', n: 10, pass: 6 },
  };
  O.SUBJECT_ORDER = ['houki', 'butsuka', 'seishou'];
  O.EXAM_MINUTES = 120;

  /*
   * 分野: [科目, 名称, 出題頻度]
   * 出題頻度（★1〜5）: 過去の出題傾向から見た「本試験での出やすさ」
   *   ★5 ほぼ毎回出る / ★4 よく出る / ★3 ときどき出る / ★2 たまに出る / ★1 まれ
   */
  const T = {
    h_def: ['houki', '危険物の定義・類別', 3],
    h_hinmei: ['houki', '第4類の品名', 4],
    h_shitei: ['houki', '指定数量・倍数計算', 5],
    h_shisetsu: ['houki', '製造所等の区分', 4],
    h_tetsuzuki: ['houki', '許可・届出等の手続き', 5],
    h_menjo: ['houki', '危険物取扱者・免状', 5],
    h_koshu: ['houki', '保安講習', 3],
    h_hoan: ['houki', '保安監督者・統括管理者・施設保安員', 4],
    h_yobo: ['houki', '予防規程', 3],
    h_tenken: ['houki', '定期点検', 4],
    h_kyori: ['houki', '保安距離・保有空地', 4],
    h_kijun: ['houki', '位置・構造・設備の基準', 4],
    h_kyuyu: ['houki', '給油取扱所', 4],
    h_shoka: ['houki', '消火設備・警報設備', 4],
    h_hyoshiki: ['houki', '標識・掲示板', 2],
    h_chozo: ['houki', '貯蔵・取扱いの基準', 4],
    h_unpan: ['houki', '運搬の基準', 5],
    h_iso: ['houki', '移送の基準', 4],
    h_meirei: ['houki', '措置命令・許可の取消し等', 4],

    b_busshitsu: ['butsuka', '物質の変化と分類', 3],
    b_netsu: ['butsuka', '熱（比熱・熱の移動・膨張）', 3],
    b_jotai: ['butsuka', '沸点・蒸気圧・比重', 3],
    b_seidenki: ['butsuka', '静電気', 5],
    b_kagaku: ['butsuka', '化学の基礎（酸化還元・酸塩基・金属・有機）', 4],
    b_nensho: ['butsuka', '燃焼の基礎', 5],
    b_inka: ['butsuka', '引火点・発火点・燃焼範囲', 5],
    b_shizen: ['butsuka', '自然発火・粉じん爆発', 4],
    b_shoka: ['butsuka', '消火の理論・消火剤', 5],

    s_rui: ['seishou', '第1類〜第6類の性質', 5],
    s_kyotsu: ['seishou', '第4類に共通する性状', 4],
    s_yobo: ['seishou', '第4類の火災予防', 5],
    s_shoka: ['seishou', '第4類の消火方法', 5],
    s_tokushu: ['seishou', '特殊引火物', 4],
    s_dai1: ['seishou', '第1石油類', 5],
    s_alcohol: ['seishou', 'アルコール類', 4],
    s_dai2: ['seishou', '第2石油類', 4],
    s_dai3: ['seishou', '第3・第4石油類・動植物油類', 4],
    s_jiko: ['seishou', '事故事例と防止対策', 3],
  };
  O.TOPICS = {};
  Object.keys(T).forEach((k) => (O.TOPICS[k] = { id: k, subject: T[k][0], name: T[k][1], freq: T[k][2] }));
  O.FREQ_LABELS = { 5: 'ほぼ毎回出る', 4: 'よく出る', 3: 'ときどき出る', 2: 'たまに出る', 1: 'まれ' };
  O.stars = (n) => '★'.repeat(n) + '☆'.repeat(5 - n);

  /*
   * 本試験の出題構成
   * 消防試験研究センターが公開している乙4の過去問（35問）の分野配分を基本に、
   * 一般的な出題傾向を加えて各枠の候補分野を決めている。各枠につき候補の中から1分野を出題する。
   */
  O.EXAM_BLUEPRINT = {
    houki: [
      ['h_hinmei', 'h_def'],
      ['h_shisetsu'],
      ['h_shitei'],
      ['h_kyori'],
      ['h_shoka'],
      ['h_kijun'],
      ['h_tetsuzuki'],
      ['h_meirei'],
      ['h_tenken', 'h_yobo'],
      ['h_menjo'],
      ['h_hoan'],
      ['h_iso'],
      ['h_koshu', 'h_chozo', 'h_hyoshiki'],
      ['h_unpan'],
      ['h_kyuyu'],
    ],
    butsuka: [
      ['b_nensho'],
      ['b_nensho', 'b_netsu'],
      ['b_inka'],
      ['b_shoka'],
      ['b_shizen'],
      ['b_seidenki'],
      ['b_kagaku'],
      ['b_busshitsu'],
      ['b_kagaku', 'b_netsu'],
      ['b_jotai', 'b_netsu'],
    ],
    seishou: [
      ['s_rui'],
      ['s_yobo', 's_kyotsu'],
      ['s_shoka'],
      ['s_yobo', 's_jiko'],
      ['s_shoka', 's_kyotsu'],
      ['s_dai1'],
      ['s_dai2', 's_alcohol'],
      ['s_dai3'],
      ['s_tokushu'],
      ['s_dai1', 's_alcohol', 's_dai2'],
    ],
  };
})();
