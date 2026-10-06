/* =========================================================
   GMP 바이오공정 문제집
   - 빌드 도구 없는 정적 앱 (GitHub Pages 배포용)
   - 문제: questions/index.json 에 적힌 JSON 파일들을 불러옴
   - 기록: localStorage (오답 노트, 문항별 이력, 회차 기록, 설정, 진행 중 세션, 마지막 결과)
   ========================================================= */
(() => {
  'use strict';

  // ---------------------------------------------------------------- 설정
  const CONFIG = {
    course: 'GMP 바이오공정',
    courseEn: 'Bioprocess & GMP',
    questionsDir: 'questions/',
    minutesPer100: 90,          // 시험지 제한 시간: 100점 = 90분 비율
    storagePrefix: 'gmpquiz.v1.',
    historyLimit: 300,
    // 만든 사람(주인) 확인용: 주인 링크 …#owner=<코드> 의 SHA-256. 코드 자체는 저장소에 두지 않는다.
    ownerHash: '620a09ea0faa2b46033fb566dbd53b4bc7b8ba7040c380470c8a8944462bc6f9',
  };
  // 주인이 아닌 사람(공유 링크로 들어온 사람)이 볼 수 있는 화면
  const GUEST_VIEWS = new Set(['shared', 'exam', 'result', 'print', 'locked', 'error']);
  // 시험지 PART 구성 (실전 비율: I 40 % · II 40~50 % · III 10~20 % 중 쉬운 쪽 — 2026.10 난이도 조정)
  const PARTS = {
    1: { roman: 'I', name: '용어 정의 및 개념 확인', note: '용어의 정의와 기본 개념을 정확히 알고 있는지 확인한다.', ratio: 0.40, points: 2 },
    2: { roman: 'II', name: '개념 간 변별 (중간 난이도)', note: '서로 헷갈리기 쉬운 개념을 구별해 옳고 그름을 판단한다.', ratio: 0.50, points: 3 },
    3: { roman: 'III', name: '개념 이해와 대응 (고난도)', note: '공정 전체를 이해하고 상황에 맞게 대응한다.', ratio: 0.10, points: 4 },
  };
  const ESSAY_POINTS = 5;
  const DEFAULT_PART = { 용어: 1, 개념: 2, 연결: 2, 계산: 2, 상황판단: 3, 서술형: 3 };
  const STRATEGIES = {
    fresh: { label: '미출제 우선', review: 0.2, desc: '복습 20%' },
    balance: { label: '균형', review: 0.4, desc: '복습 40%' },
    weak: { label: '약점 집중', review: 0.7, desc: '복습 70%' },
  };
  const CIRCLED = ['①', '②', '③', '④', '⑤', '⑥', '⑦', '⑧', '⑨', '⑩'];
  const COUNT_OPTIONS = [10, 20, 30, 40, 50];
  const MODES = {
    study: { label: '단원별 학습', icon: '📖', kind: 'study', desc: '고르는 즉시 정답·해설·출처 확인' },
    unitExam: { label: '실전 시험지', icon: '📝', kind: 'exam', desc: '선택한 범위로 표지·PART I~III·OMR·타이머가 있는 시험' },
    mock: { label: '전범위 모의고사', icon: '🎓', kind: 'exam', desc: '전 단원에서 문항 비율대로 출제되는 실전 시험' },
    review: { label: '오답 다시 풀기', icon: '🔁', kind: 'study', desc: '' },
    shared: { label: '공유 시험지', icon: '🔗', kind: 'exam', desc: '' },
  };

  // ---------------------------------------------------------------- 저장소
  const store = {
    get(key, fallback) {
      try {
        const raw = localStorage.getItem(CONFIG.storagePrefix + key);
        return raw == null ? fallback : JSON.parse(raw);
      } catch (e) { return fallback; }
    },
    set(key, value) {
      try { localStorage.setItem(CONFIG.storagePrefix + key, JSON.stringify(value)); return true; }
      catch (e) { return false; }
    },
    del(key) {
      try { localStorage.removeItem(CONFIG.storagePrefix + key); } catch (e) { /* 무시 */ }
    },
  };

  // ---------------------------------------------------------------- 상태
  const S = {
    units: [],          // [{key, week, title, files, questions}]
    qById: new Map(),
    concepts: new Map(), // key -> {label, units:Set, qids:[]}
    warnings: [],
    loadError: null,
    view: 'loading',
    session: null,      // 진행 중 풀이
    result: null,       // 마지막 결과 {session, entry}
    wrong: store.get('wrong', {}),     // {id: {n, last}}
    qstats: store.get('qstats', {}),   // {id: {a, c, last}}
    history: store.get('history', []), // [{ts, mode, ...}]
    prefs: Object.assign({
      theme: 'auto', mode: 'study', units: null, count: 20, strategy: 'fresh',
      shuffleQ: true, shuffleC: true, timer: true, name: '',
    }, store.get('prefs', {})),
    owner: !!store.get('owner', false),
    akFilter: 'all',
    timerId: null,
    observer: null,
  };
  if (!STRATEGIES[S.prefs.strategy]) S.prefs.strategy = 'fresh';
  const $view = document.getElementById('view');

  // ---------------------------------------------------------------- 유틸
  const esc = (s) => String(s == null ? '' : s)
    .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;').replace(/'/g, '&#39;');
  // **굵게** 와 줄바꿈만 지원하는 안전한 서식
  const rich = (s) => esc(s).replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>').replace(/\n/g, '<br>');
  const range = (n) => Array.from({ length: n }, (_, i) => i);
  function shuffle(arr) {
    const a = arr.slice();
    for (let i = a.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [a[i], a[j]] = [a[j], a[i]];
    }
    return a;
  }
  const pct = (c, t) => (t ? Math.round((c / t) * 1000) / 10 : 0);
  const fmtNum = (n) => (Number.isInteger(n) ? String(n) : n.toFixed(1));
  function fmtDur(sec) {
    sec = Math.max(0, Math.round(sec));
    const h = Math.floor(sec / 3600), m = Math.floor((sec % 3600) / 60), s = sec % 60;
    const mm = String(m).padStart(2, '0'), ss = String(s).padStart(2, '0');
    return h ? `${h}:${mm}:${ss}` : `${m}:${ss}`;
  }
  function fmtDate(ts, withTime = true) {
    const d = new Date(ts);
    const p = (n) => String(n).padStart(2, '0');
    const date = `${d.getFullYear()}.${p(d.getMonth() + 1)}.${p(d.getDate())}`;
    return withTime ? `${date} ${p(d.getHours())}:${p(d.getMinutes())}` : date;
  }
  const unitOf = (key) => S.units.find((u) => u.key === key);
  const unitLabel = (key) => {
    const u = unitOf(key);
    return u ? u.week : key;
  };
  const unitIndex = (key) => S.units.findIndex((u) => u.key === key);
  const qMeta = (id) => S.qstats[id] || { a: 0, c: 0, last: 0 };
  const wrongIdsInBank = () => Object.keys(S.wrong).filter((id) => S.qById.has(id));
  const conceptKey = (label) => String(label).split(' (')[0].toLowerCase().replace(/[^0-9a-z가-힣]/g, '');
  const isEssay = (q) => q.format === 'essay';
  const pointsOf = (q) => (isEssay(q) ? ESSAY_POINTS : PARTS[q.part].points);

  function persist() {
    store.set('wrong', S.wrong);
    store.set('qstats', S.qstats);
    store.set('history', S.history);
  }
  const savePrefs = () => store.set('prefs', S.prefs);
  function saveActive() {
    if (S.session && !S.session.finished) store.set('active', S.session);
  }
  function saveResult() {
    if (S.result) store.set('result', S.result);
  }

  // ---------------------------------------------------------------- 테마
  const THEMES = { auto: ['🌓', '자동'], light: ['☀️', '라이트'], dark: ['🌙', '다크'] };
  function applyTheme() {
    const t = S.prefs.theme;
    if (t === 'auto') document.documentElement.removeAttribute('data-theme');
    else document.documentElement.setAttribute('data-theme', t);
    const [icon, label] = THEMES[t] || THEMES.auto;
    document.getElementById('themeIcon').textContent = icon;
    document.getElementById('themeLabel').textContent = label;
  }
  function cycleTheme() {
    const order = ['auto', 'light', 'dark'];
    S.prefs.theme = order[(order.indexOf(S.prefs.theme) + 1) % order.length];
    savePrefs();
    applyTheme();
  }

  // ---------------------------------------------------------------- 문제 불러오기
  function validateQuestion(q, file, seen) {
    const where = `${file}${q && q.id ? ` / ${q.id}` : ''}`;
    if (!q || typeof q !== 'object') return `${file}: 문항 형식이 객체가 아닙니다.`;
    if (typeof q.id !== 'string' || !q.id.trim()) return `${where}: id가 없습니다.`;
    if (seen.has(q.id)) return `${where}: 중복된 id라서 제외했습니다.`;
    if (typeof q.question !== 'string' || !q.question.trim()) return `${where}: question(문제 본문)이 없습니다.`;
    if (q.format === 'essay') {
      if (typeof q.modelAnswer !== 'string' || !q.modelAnswer.trim()) return `${where}: 서술형에 modelAnswer(모범답안)가 없습니다.`;
      return null;
    }
    if (!Array.isArray(q.choices) || q.choices.length < 2 || q.choices.length > CIRCLED.length) {
      return `${where}: choices는 2~${CIRCLED.length}개의 보기 배열이어야 합니다.`;
    }
    if (q.choices.some((c) => typeof c !== 'string' || !c.trim())) return `${where}: 비어 있는 보기가 있습니다.`;
    if (!Number.isInteger(q.answer) || q.answer < 1 || q.answer > q.choices.length) {
      return `${where}: answer는 1~${q.choices.length} 사이의 정수여야 합니다(1부터 시작).`;
    }
    return null;
  }

  async function fetchJSON(path) {
    const res = await fetch(path, { cache: 'no-cache' });
    if (!res.ok) throw new Error(`${path} 를 불러오지 못했습니다 (HTTP ${res.status}).`);
    try { return await res.json(); }
    catch (e) { throw new Error(`${path} 의 JSON 형식이 올바르지 않습니다: ${e.message}`); }
  }

  async function loadBank() {
    const index = await fetchJSON(CONFIG.questionsDir + 'index.json');
    const files = (Array.isArray(index) ? index : (index && index.files) || [])
      .filter((f) => typeof f === 'string' && f.trim());
    if (!files.length) throw new Error('questions/index.json 에 문제 파일이 하나도 없습니다.');

    const settled = await Promise.allSettled(files.map((f) => fetchJSON(CONFIG.questionsDir + f)));
    const seen = new Set();
    settled.forEach((r, i) => {
      const file = files[i];
      if (r.status === 'rejected') { S.warnings.push(r.reason.message); return; }
      const data = r.value || {};
      const list = Array.isArray(data.questions) ? data.questions : [];
      const key = String(data.week || file.replace(/\.json$/i, '')).trim();
      let unit = S.units.find((u) => u.key === key);
      if (!unit) {
        unit = { key, week: key, title: data.title || '', files: [], questions: [] };
        S.units.push(unit);
      }
      unit.files.push(file);
      if (!unit.title && data.title) unit.title = data.title;
      list.forEach((q) => {
        const err = validateQuestion(q, file, seen);
        if (err) { S.warnings.push(err); return; }
        seen.add(q.id);
        const essay = q.format === 'essay';
        const notes = !essay && Array.isArray(q.choiceNotes) && q.choiceNotes.length === q.choices.length ? q.choiceNotes : null;
        if (!essay && q.choiceNotes && !notes) S.warnings.push(`${file} / ${q.id}: choiceNotes 개수가 보기 개수와 달라 보기별 해설을 숨겼습니다.`);
        const type = q.type || (essay ? '서술형' : '');
        let part = Number(q.part);
        if (![1, 2, 3].includes(part)) part = DEFAULT_PART[type] || 2;
        const labels = (Array.isArray(q.concepts) && q.concepts.length ? q.concepts
          : (Array.isArray(q.tags) ? q.tags : [])).filter((t) => typeof t === 'string' && t.trim() && t !== '용어');
        const item = {
          id: q.id,
          unit: key,
          type,
          part,
          format: essay ? 'essay' : 'mc',
          question: q.question,
          box: Array.isArray(q.box) ? q.box.filter((b) => typeof b === 'string') : null,
          choices: essay ? [] : q.choices,
          answer: essay ? 0 : q.answer,
          modelAnswer: essay ? q.modelAnswer : '',
          keywords: essay && Array.isArray(q.keywords) ? q.keywords : [],
          explanation: q.explanation || '',
          notes,
          source: q.source || '',
          ckeys: [],
        };
        labels.forEach((label) => {
          const k = conceptKey(label);
          if (!k || item.ckeys.includes(k)) return;
          item.ckeys.push(k);
          let c = S.concepts.get(k);
          if (!c) { c = { key: k, label: String(label).split(' (')[0], units: new Set(), qids: [] }; S.concepts.set(k, c); }
          c.units.add(key);
          c.qids.push(item.id);
        });
        unit.questions.push(item);
        S.qById.set(item.id, item);
      });
    });
    S.units = S.units.filter((u) => u.questions.length);
    if (!S.units.length) throw new Error('불러온 문항이 없습니다. questions 폴더의 JSON 파일을 확인하세요.');
  }

  // ---------------------------------------------------------------- 출제 현황
  // 개념은 그 개념을 담은 문항이 한 번이라도 출제(채점)되면 '다룬 개념'이 된다
  function coveredConceptKeys() {
    const set = new Set();
    S.qById.forEach((q) => { if (qMeta(q.id).a) q.ckeys.forEach((k) => set.add(k)); });
    return set;
  }
  function coverageFor(pool) {
    const covered = coveredConceptKeys();
    const keys = new Set();
    pool.forEach((q) => q.ckeys.forEach((k) => keys.add(k)));
    const served = pool.filter((q) => qMeta(q.id).a).length;
    const minA = pool.length ? Math.min(...pool.map((q) => qMeta(q.id).a)) : 0;
    const inRound = pool.filter((q) => qMeta(q.id).a === minA).length;
    return {
      total: pool.length,
      served,
      conceptTotal: keys.size,
      conceptCovered: [...keys].filter((k) => covered.has(k)).length,
      uncovered: [...keys].filter((k) => !covered.has(k)),
      round: minA + 1,
      leftInRound: inRound,
    };
  }

  // ---------------------------------------------------------------- 출제 알고리즘
  // 단원 크기에 비례해 n개를 나눈다(각 단원 최소 1개, 여유 없으면 큰 나머지 순)
  function allocateBy(sizes, n) {
    const total = sizes.reduce((a, b) => a + b, 0);
    if (!total) return sizes.map(() => 0);
    if (n >= total) return sizes.slice();
    const exact = sizes.map((s) => (n * s) / total);
    const q = exact.map((x, i) => Math.min(sizes[i], Math.max(n >= sizes.length ? 1 : 0, Math.floor(x))));
    let sum = q.reduce((a, b) => a + b, 0);
    const byFrac = range(sizes.length).sort((a, b) => (exact[b] - Math.floor(exact[b])) - (exact[a] - Math.floor(exact[a])));
    let guard = 0;
    while (sum < n && guard++ < 1000) {
      for (const i of byFrac) { if (sum >= n) break; if (q[i] < sizes[i]) { q[i]++; sum++; } }
    }
    while (sum > n && guard++ < 2000) {
      const i = range(sizes.length).filter((k) => q[k] > 1).sort((a, b) => q[b] - q[a])[0];
      if (i == null) break;
      q[i]--; sum--;
    }
    return q;
  }

  function partQuotas(n) {
    let p3 = n >= 4 ? Math.max(1, Math.round(n * PARTS[3].ratio)) : 0;
    let p1 = Math.round(n * PARTS[1].ratio);
    let p2 = n - p1 - p3;
    if (p2 < 0) { p1 += p2; p2 = 0; }
    return { 1: p1, 2: p2, 3: p3 };
  }

  // 정답률이 낮거나 오답 노트에 있는 문항일수록 큰 값
  function weakness(q) {
    const m = qMeta(q.id);
    if (!m.a) return 0;
    const w = S.wrong[q.id];
    return (w ? 2 + Math.min(w.n || 1, 3) : 0) + (1 - m.c / m.a) * 2;
  }

  /*
   * 문항 묶음 구성
   *  1) 복습 칸: 전략 비율만큼 오답·약점 문항에서 먼저 고른다.
   *  2) 나머지: 범위 안에서 출제 횟수가 가장 적은 '이번 바퀴' 문항만 후보로 삼는다
   *     → 범위의 모든 문항이 한 번씩 나오기 전에는 같은 문항이 다시 나오지 않는다.
   *  3) 후보 점수: PART 비율·주차 비율이 모자란 쪽 가점, 처음 다루는 개념 가점,
   *     이미 시험지에 들어간 개념과 겹치면 감점, 약간의 무작위(매번 새 구성).
   */
  function compose(pool, n, strategy) {
    n = Math.min(n, pool.length);
    if (!n) return { picked: [], review: new Set() };
    // PART 할당량 — 범위에 없는 PART 몫은 다른 PART로 넘긴다
    const quota = partQuotas(n);
    const avail = { 1: 0, 2: 0, 3: 0 };
    pool.forEach((q) => { avail[q.part] += 1; });
    let spare = 0;
    [1, 2, 3].forEach((p) => { if (quota[p] > avail[p]) { spare += quota[p] - avail[p]; quota[p] = avail[p]; } });
    for (const p of [2, 1, 3]) {
      const add = Math.min(spare, avail[p] - quota[p]);
      if (add > 0) { quota[p] += add; spare -= add; }
    }
    const essayCap = quota[3] >= 2 ? Math.max(1, Math.floor(quota[3] / 3)) : (quota[3] === 1 && n <= 3 ? 1 : 0);
    // 주차 할당량 — 범위 문항 수 비율
    const unitKeys = S.units.map((u) => u.key).filter((k) => pool.some((q) => q.unit === k));
    const sizes = unitKeys.map((k) => pool.filter((q) => q.unit === k).length);
    const uq = {};
    allocateBy(sizes, n).forEach((v, i) => { uq[unitKeys[i]] = v; });

    const covered = coveredConceptKeys();
    const picked = [];
    const pickedIds = new Set();
    const review = new Set();
    const partCnt = { 1: 0, 2: 0, 3: 0 };
    const unitCnt = {};
    const inPaper = new Set();
    let essays = 0;

    const allowed = (q) => !pickedIds.has(q.id) && (!isEssay(q) || essays < essayCap);
    function score(q, isReview) {
      let s = Math.random() * 6;
      s += partCnt[q.part] < quota[q.part] ? 40 : -40;
      s += (unitCnt[q.unit] || 0) < (uq[q.unit] || 0) ? 25 : -25;
      let fresh = 0, dup = 0;
      q.ckeys.forEach((k) => { if (inPaper.has(k)) dup += 1; else if (!covered.has(k)) fresh += 1; });
      s += Math.min(fresh, 2) * 8 - dup * 18;
      if (isReview) s += weakness(q) * 10;
      if (isEssay(q) && essays === 0 && quota[3] >= 3) s += 35; // 20문항 이상이면 서술형 1개는 넣는다
      return s;
    }
    function take(cands, isReview) {
      let best = null, bestS = -Infinity;
      cands.forEach((q) => {
        if (!allowed(q)) return;
        const s = score(q, isReview);
        if (s > bestS) { bestS = s; best = q; }
      });
      if (!best) return false;
      picked.push(best);
      pickedIds.add(best.id);
      partCnt[best.part] += 1;
      unitCnt[best.unit] = (unitCnt[best.unit] || 0) + 1;
      best.ckeys.forEach((k) => inPaper.add(k));
      if (isEssay(best)) essays += 1;
      if (isReview) review.add(best.id);
      return true;
    }

    const weak = pool.filter((q) => weakness(q) > 0);
    const nReview = Math.min(Math.round(n * (STRATEGIES[strategy] || STRATEGIES.fresh).review), weak.length);
    for (let i = 0; i < nReview; i++) if (!take(weak, true)) break;

    let guard = 0;
    while (picked.length < n && guard++ < n * 4) {
      const rest = pool.filter(allowed);
      if (!rest.length) break;
      const low = Math.min(...rest.map((q) => qMeta(q.id).a));
      if (!take(rest.filter((q) => qMeta(q.id).a === low), false)) break;
    }
    return { picked, review };
  }

  function orderPicked(picked, kind) {
    const p = S.prefs;
    if (kind === 'study') {
      return p.shuffleQ ? shuffle(picked) : picked.slice().sort((a, b) => a.part - b.part || unitIndex(a.unit) - unitIndex(b.unit));
    }
    const base = p.shuffleQ ? shuffle(picked) : picked.slice().sort((a, b) => unitIndex(a.unit) - unitIndex(b.unit));
    // 시험지: PART I → II → III, PART III 안에서는 객관식 다음 서술형
    return base.sort((a, b) => a.part - b.part || (isEssay(a) - isEssay(b)));
  }

  function buildSession(mode, pool, count) {
    const kind = MODES[mode].kind;
    const p = S.prefs;
    let picked;
    let review = new Set();
    if (mode === 'review') {
      picked = shuffle(pool);
    } else if (count >= pool.length) {
      picked = pool.slice();
    } else {
      ({ picked, review } = compose(pool, count, p.strategy));
    }
    picked = mode === 'review' ? picked : orderPicked(picked, kind);
    return sessionFrom(mode, picked, { review, poolSize: pool.length });
  }

  // 고른 문항 목록으로 세션을 만든다(orders: 문항별 보기 순서를 정해 줄 때 — 공유 시험지)
  function sessionFrom(mode, picked, { review = new Set(), orders = null, poolSize = 0 } = {}) {
    const kind = MODES[mode].kind;
    const p = S.prefs;
    const covered = coveredConceptKeys();
    const newConcepts = [];
    const seenNew = new Set();
    picked.forEach((q) => q.ckeys.forEach((k) => {
      if (!covered.has(k) && !seenNew.has(k)) { seenNew.add(k); newConcepts.push(S.concepts.get(k).label); }
    }));
    const unitDist = {};
    const partDist = { 1: 0, 2: 0, 3: 0 };
    let totalPoints = 0;
    picked.forEach((q) => {
      unitDist[q.unit] = (unitDist[q.unit] || 0) + 1;
      partDist[q.part] += 1;
      totalPoints += pointsOf(q);
    });

    const items = picked.map((q, i) => ({
      id: q.id,
      order: isEssay(q) ? [] : (orders && orders[i] ? orders[i].slice() : (p.shuffleC ? shuffle(range(q.choices.length)) : range(q.choices.length))),
      pick: null,
      text: '',
      self: null,
      shown: false,
      isNew: !qMeta(q.id).a,
      review: review.has(q.id),
    }));
    const usedUnits = S.units.map((u) => u.key).filter((k) => unitDist[k]);
    return {
      v: 2,
      mode,
      kind,
      strategy: p.strategy,
      units: usedUnits,
      items,
      idx: 0,
      createdAt: Date.now(),
      started: kind !== 'exam',
      startedAt: kind !== 'exam' ? Date.now() : 0,
      elapsedSec: 0,
      totalPoints,
      timeLimitSec: kind === 'exam' && p.timer ? Math.round(totalPoints * CONFIG.minutesPer100 * 60 / 100) : 0,
      report: {
        newCount: items.filter((it) => it.isNew).length,
        newConcepts,
        unitDist,
        partDist,
        reviewCount: items.filter((it) => it.review).length,
        poolSize,
      },
      finished: false,
    };
  }

  // ---------------------------------------------------------------- 채점/기록
  function recordAnswer(id, correct, ts) {
    const m = Object.assign({ a: 0, c: 0, last: 0 }, S.qstats[id]);
    m.a += 1;
    if (correct) m.c += 1;
    m.last = ts;
    S.qstats[id] = m;
    if (correct) delete S.wrong[id];
    else S.wrong[id] = { n: ((S.wrong[id] && S.wrong[id].n) || 0) + 1, last: ts };
  }
  // 이미 채점한 서술형의 ○/✗를 바꿀 때: 출제 횟수는 그대로, 정답 수·오답 노트만 고친다
  function regrade(id, correct, ts) {
    const m = Object.assign({ a: 1, c: 0, last: ts }, S.qstats[id]);
    m.c = Math.max(0, Math.min(m.a, m.c + (correct ? 1 : -1)));
    S.qstats[id] = m;
    if (correct) delete S.wrong[id];
    else S.wrong[id] = { n: ((S.wrong[id] && S.wrong[id].n) || 0) + 1, last: ts };
  }

  function isCorrect(item) {
    const q = S.qById.get(item.id);
    if (isEssay(q)) return item.self === true;
    return item.pick != null && item.pick === q.answer - 1;
  }
  // 학습 모드: 채점까지 끝났는지 / 시험 모드: 답을 적었는지
  function isDone(item) {
    const q = S.qById.get(item.id);
    return isEssay(q) ? item.self != null : item.pick != null;
  }
  function isAnswered(item) {
    const q = S.qById.get(item.id);
    return isEssay(q) ? !!(item.text || '').trim() : item.pick != null;
  }

  // 결과 요약(점수·파트별·단원별)을 세션 상태로부터 다시 계산한다
  function summarize(session) {
    const counted = session.kind === 'exam' ? session.items : session.items.filter(isDone);
    const byUnit = {};
    const byPart = {};
    let earned = 0, total = 0, correct = 0, pending = 0;
    counted.forEach((it) => {
      const q = S.qById.get(it.id);
      if (!q) return;
      const pts = pointsOf(q);
      total += pts;
      const bp = byPart[q.part] || (byPart[q.part] = { c: 0, t: 0, e: 0, p: 0 });
      bp.t += 1; bp.p += pts;
      const pend = isEssay(q) && it.self == null;
      if (pend) { pending += 1; return; }
      const ok = isCorrect(it);
      byUnit[q.unit] = byUnit[q.unit] || { c: 0, t: 0 };
      byUnit[q.unit].t += 1;
      if (ok) { byUnit[q.unit].c += 1; correct += 1; earned += pts; bp.c += 1; bp.e += pts; }
    });
    return { total: counted.length, correct, earned, points: total, pending, byUnit, byPart, score: pct(earned, total) };
  }

  function finishSession(opts = {}) {
    const s = S.session;
    if (!s) return;
    const now = Date.now();
    flushElapsed();
    if (s.kind === 'exam') {
      s.items.forEach((it) => {
        const q = S.qById.get(it.id);
        if (!q) return;
        if (isEssay(q)) {
          if (!(it.text || '').trim()) { it.self = false; recordAnswer(it.id, false, now); }
        } else {
          recordAnswer(it.id, isCorrect(it), now);
        }
      });
    }
    const sum = summarize(s);
    const entry = {
      ts: now,
      mode: s.mode,
      units: s.units,
      total: sum.total,
      correct: sum.correct,
      score: sum.score,
      earned: sum.earned,
      points: sum.points,
      pending: sum.pending,
      durationSec: Math.round(s.kind === 'exam' ? s.elapsedSec : (now - s.startedAt) / 1000),
      newCount: s.report ? s.report.newCount : 0,
      byUnit: sum.byUnit,
      byPart: sum.byPart,
      auto: !!opts.auto,
    };
    s.finished = true;
    s.finishedAt = now;
    if (sum.total) {
      S.history.push(entry);
      if (S.history.length > CONFIG.historyLimit) S.history = S.history.slice(-CONFIG.historyLimit);
    }
    persist();
    store.del('active');
    S.result = { session: s, entry };
    saveResult();
    S.session = null;
    S.akFilter = 'all';
    go('result');
  }

  // 서술형 자가 채점(결과 화면) — 점수와 기록을 함께 고친다
  function gradeEssayInResult(i, val) {
    const r = S.result;
    if (!r) return;
    const it = r.session.items[i];
    const now = Date.now();
    if (it.self == null) recordAnswer(it.id, val, now);
    else if (it.self !== val) regrade(it.id, val, now);
    else return;
    it.self = val;
    const sum = summarize(r.session);
    Object.assign(r.entry, {
      correct: sum.correct, score: sum.score, earned: sum.earned, points: sum.points,
      pending: sum.pending, byUnit: sum.byUnit, byPart: sum.byPart, total: sum.total,
    });
    const h = S.history.find((x) => x.ts === r.entry.ts);
    if (h) Object.assign(h, r.entry);
    persist();
    saveResult();
    const y = window.scrollY;
    renderResult();
    window.scrollTo(0, y);
  }

  function cumulativeByUnit() {
    const acc = {};
    S.history.forEach((h) => {
      Object.entries(h.byUnit || {}).forEach(([k, v]) => {
        acc[k] = acc[k] || { c: 0, t: 0 };
        acc[k].c += v.c;
        acc[k].t += v.t;
      });
    });
    return acc;
  }
  function cumulativeByPart() {
    const acc = {};
    S.history.forEach((h) => {
      Object.entries(h.byPart || {}).forEach(([k, v]) => {
        acc[k] = acc[k] || { c: 0, t: 0 };
        acc[k].c += v.c;
        acc[k].t += v.t;
      });
    });
    return acc;
  }

  // ---------------------------------------------------------------- 화면 전환
  function stopTimers() {
    if (S.timerId) { clearInterval(S.timerId); S.timerId = null; }
    if (S.observer) { S.observer.disconnect(); S.observer = null; }
  }

  function go(view, push = true) {
    if (S.view === 'exam') flushElapsed();
    stopTimers();
    if (!S.owner && !GUEST_VIEWS.has(view)) view = 'locked';
    S.view = view;
    if (push && view !== 'home') history.pushState({ view }, '');
    render();
    window.scrollTo(0, 0);
  }

  function render() {
    stopTimers();
    if (!S.owner && !GUEST_VIEWS.has(S.view)) S.view = 'locked';
    document.body.classList.toggle('is-guest', !S.owner);
    document.body.classList.toggle('is-exam', S.view === 'exam');
    switch (S.view) {
      case 'home': renderHome(); break;
      case 'coverage': renderCoverage(); break;
      case 'study': renderStudy(); break;
      case 'exam': renderExam(); break;
      case 'result': renderResult(); break;
      case 'history': renderHistory(); break;
      case 'print': renderPrint(); break;
      case 'shared': renderShared(); break;
      case 'locked': renderLocked(); break;
      case 'error': renderError(); break;
      default: break;
    }
  }

  function leaveSession() {
    if ((S.view === 'study' || S.view === 'exam') && S.session && !S.session.finished) {
      flushElapsed();
      saveActive();
      S.session = null;
    }
  }

  window.addEventListener('popstate', () => {
    if ((S.view === 'study' || S.view === 'exam') && S.session && !S.session.finished) {
      if (!confirm('풀이를 잠시 멈추고 처음 화면으로 갈까요?\n진행 상황은 저장되어 이어서 풀 수 있습니다.')) {
        history.pushState({ view: S.view }, '');
        return;
      }
      leaveSession();
    }
    go('home', false);
  });

  // ---------------------------------------------------------------- 홈
  function selectedUnitKeys() {
    const all = S.units.map((u) => u.key);
    return Array.isArray(S.prefs.units) ? S.prefs.units.filter((k) => all.includes(k)) : all;
  }

  function poolFor(mode) {
    if (mode === 'mock') return S.units.flatMap((u) => u.questions);
    if (mode === 'review') return wrongIdsInBank().map((id) => S.qById.get(id));
    const keys = selectedUnitKeys();
    return S.units.filter((u) => keys.includes(u.key)).flatMap((u) => u.questions);
  }

  function estimatePoints(n) {
    const q = partQuotas(n);
    return q[1] * PARTS[1].points + q[2] * PARTS[2].points + q[3] * PARTS[3].points;
  }

  function renderHome() {
    const p = S.prefs;
    if (!MODES[p.mode] || p.mode === 'review') p.mode = 'study';
    const mode = p.mode;
    const kind = MODES[mode].kind;
    const keys = selectedUnitKeys();
    const pool = poolFor(mode);
    const poolN = pool.length;
    const count = p.count === 'all' ? poolN : Math.min(p.count, poolN);
    const cov = coverageFor(pool);
    const wrongN = wrongIdsInBank().length;
    const active = store.get('active', null);
    const activeOk = active && active.v === 2 && Array.isArray(active.items) && active.items.length &&
      active.items.every((it) => S.qById.has(it.id));
    if (active && !activeOk) store.del('active');
    const last = store.get('result', null);
    const lastOk = last && last.session && last.entry && Array.isArray(last.session.items) &&
      last.session.items.every((it) => S.qById.has(it.id));
    const cum = cumulativeByUnit();
    const isMock = mode === 'mock';

    const unitRows = S.units.map((u) => {
      const checked = isMock || keys.includes(u.key);
      const seenN = u.questions.filter((q) => qMeta(q.id).a).length;
      const c = cum[u.key];
      return `
        <label class="unit-item${isMock ? ' is-locked' : ''}">
          <input type="checkbox" data-action="unit" value="${esc(u.key)}" ${checked ? 'checked' : ''} ${isMock ? 'disabled' : ''}>
          <span class="unit-name">${esc(u.week)}<small>${esc(u.title)}</small></span>
          <span class="unit-meta">${u.questions.length}문항 · 출제 ${seenN}<br>${c && c.t ? `정답률 ${fmtNum(pct(c.c, c.t))}%` : '기록 없음'}</span>
        </label>`;
    }).join('');

    const countChips = COUNT_OPTIONS.filter((n) => n < poolN).map((n) => `
      <button type="button" class="chip" data-action="count" data-value="${n}" aria-pressed="${p.count === n}">${n}</button>`).join('') +
      `<button type="button" class="chip" data-action="count" data-value="all" aria-pressed="${p.count === 'all' || p.count >= poolN}">전체 ${poolN}</button>`;

    const estPts = estimatePoints(count);
    const minutes = Math.round(estPts * CONFIG.minutesPer100 / 100);
    const quota = partQuotas(count);
    const summary = poolN
      ? `${MODES[mode].label} · ${count}문항${kind === 'exam' ? ` · 약 ${estPts}점${p.timer ? ` · 약 ${minutes}분` : ''}` : ''} · ${STRATEGIES[p.strategy].label}(${STRATEGIES[p.strategy].desc})`
      : '범위를 하나 이상 선택하세요';

    $view.innerHTML = `
      <div class="wrap">
        <section class="hero">
          <h1>복습 문제집</h1>
          <p>강의 PDF·녹음을 바탕으로 만든 문항입니다. 용어 정리(PART I)부터 개념 변별(II), 상황 대응(III)까지 시험지 형식으로 연습하세요.</p>
        </section>

        ${inAppNoticeHTML('인쇄·PDF 저장')}
        ${S.warnings.length ? `
        <details class="notice warnings">
          <summary>⚠️ 문제 파일 확인 필요 (${S.warnings.length}건)</summary>
          <ul>${S.warnings.map((w) => `<li>${esc(w)}</li>`).join('')}</ul>
        </details>` : ''}

        ${activeOk ? `
        <div class="resume">
          <p>진행 중인 ${esc(MODES[active.mode] ? MODES[active.mode].label : '풀이')}가 있습니다
            (${active.items.filter((it) => (active.kind === 'exam' ? isAnswered(it) : isDone(it))).length} / ${active.items.length} 답함${active.kind === 'exam' && active.timeLimitSec ? ` · 남은 시간 ${fmtDur(active.timeLimitSec - (active.elapsedSec || 0))}` : ''})</p>
          <div class="btn-row">
            <button class="btn btn-primary" type="button" data-action="resume">이어서 풀기</button>
            <button class="btn btn-ghost" type="button" data-action="discard">버리기</button>
          </div>
        </div>` : ''}

        ${lastOk ? `
        <div class="last-result">
          <span>📋 지난 결과 · ${esc(MODES[last.entry.mode] ? MODES[last.entry.mode].label : '')} ${fmtNum(last.entry.score)}점${last.entry.pending ? ` · 서술형 채점 대기 ${last.entry.pending}` : ''}</span>
          <button class="btn" type="button" data-action="last-result">채점지 보기</button>
        </div>` : ''}

        <section class="card">
          <div class="card-head"><h2>1. 모드 선택</h2></div>
          <div class="mode-grid" role="group" aria-label="모드">
            ${['study', 'unitExam', 'mock'].map((m) => `
              <button type="button" class="mode-card" data-action="mode" data-value="${m}" aria-pressed="${mode === m}">
                <span class="mode-icon" aria-hidden="true">${MODES[m].icon}</span>
                <span class="mode-name">${MODES[m].label}</span>
                <span class="mode-desc">${MODES[m].desc}</span>
              </button>`).join('')}
          </div>
        </section>

        <section class="card">
          <div class="card-head">
            <h2>2. 범위 선택</h2>
            <span class="muted small">${isMock ? '전범위 자동 포함' : `${keys.length} / ${S.units.length} 단원`}</span>
          </div>
          <div class="unit-list">${unitRows}</div>
          ${isMock ? '' : `
          <div class="unit-tools">
            <button type="button" class="chip" data-action="units-all">전체 선택</button>
            <button type="button" class="chip" data-action="units-none">선택 해제</button>
          </div>`}
          <div class="coverage" style="margin-top:14px">
            <div class="cov-line"><span>출제된 문항</span><b>${cov.served} / ${cov.total}</b></div>
            <div class="coverage-bar" role="img" aria-label="문항 출제 비율 ${fmtNum(pct(cov.served, cov.total))}%"><span style="width:${pct(cov.served, cov.total)}%"></span></div>
            <div class="cov-line"><span>다룬 개념</span><b>${cov.conceptCovered} / ${cov.conceptTotal}</b></div>
            <div class="coverage-bar" role="img" aria-label="개념 출제 비율 ${fmtNum(pct(cov.conceptCovered, cov.conceptTotal))}%"><span style="width:${pct(cov.conceptCovered, cov.conceptTotal)}%"></span></div>
            <p class="muted small" style="margin:6px 0 0">${cov.total ? `지금 ${cov.round}바퀴째 — 이번 바퀴에 아직 안 나온 문항 ${cov.leftInRound}개. 범위의 모든 문항이 한 번씩 나오기 전에는 같은 문항을 다시 내지 않습니다(복습 칸 제외).` : ''}</p>
            <button type="button" class="btn btn-block" data-action="coverage" style="margin-top:10px">🗺 출제 현황 · 안 다룬 개념 ${cov.uncovered.length}개 보기</button>
          </div>
        </section>

        <section class="card">
          <div class="card-head"><h2>3. 문제 수</h2><span class="muted small">선택 범위 ${poolN}문항</span></div>
          <div class="chip-row" role="group" aria-label="문제 수">${poolN ? countChips : '<span class="muted">선택된 범위에 문항이 없습니다.</span>'}</div>
          ${poolN ? `<p class="muted small" style="margin:10px 0 0">구성(실전 비율): PART I ${quota[1]} · II ${quota[2]} · III ${quota[3]}문항${kind === 'exam' ? ` → 약 ${estPts}점, ${p.timer ? `제한 ${minutes}분 (100점 = 90분)` : '시간 제한 없음'}` : ''}</p>` : ''}
        </section>

        <section class="card">
          <div class="card-head"><h2>4. 출제 전략</h2></div>
          <div class="chip-row" role="group" aria-label="출제 전략">
            ${Object.entries(STRATEGIES).map(([k, v]) => `
              <button type="button" class="chip chip-2line" data-action="strategy" data-value="${k}" aria-pressed="${p.strategy === k}">${v.label}<small>${v.desc}</small></button>`).join('')}
          </div>
          <p class="muted small" style="margin:10px 0 0">복습 칸은 오답 노트·정답률 낮은 문항에서 채우고, 나머지는 아직 안 나온 문항(처음 다루는 개념 우선)으로 새로 구성합니다.</p>
        </section>

        <section class="card">
          <div class="card-head"><h2>5. 옵션</h2></div>
          ${switchRow('shuffleQ', '문제 순서 섞기', kind === 'exam' ? 'PART 안에서 순서를 섞음' : '매번 다른 순서로 출제')}
          ${switchRow('shuffleC', '보기 순서 섞기', '보기를 섞어도 정답 판정은 정확히 유지')}
          ${kind === 'exam' ? switchRow('timer', '제한 시간', '100점 = 90분 비율, 시간이 끝나면 자동 제출') : ''}
        </section>

        <section class="card">
          <div class="card-head"><h2>오답 노트</h2><span class="muted small">${wrongN}문항</span></div>
          <p class="muted small" style="margin:0 0 12px">틀린 문제는 자동으로 저장되고, 다시 맞히면 오답 노트에서 빠집니다.</p>
          <button class="btn btn-block" type="button" data-action="review" ${wrongN ? '' : 'disabled'}>🔁 오답만 다시 풀기 (${wrongN})</button>
        </section>

        <section class="card">
          <div class="card-head"><h2>🖨 인쇄·공유용 시험지</h2></div>
          <p class="muted small" style="margin:0 0 12px">위에서 고른 범위·문제 수로 시험지를 만들어 <b>인쇄(PDF 저장)</b>하거나, <b>링크</b>를 보내 다른 사람이 같은 시험지를 풀게 합니다. 답안지(OMR)·정답표·해설을 함께 붙일 수 있고, 만들기만 해서는 내 기록에 남지 않습니다.</p>
          <div class="btn-row">
            <button class="btn btn-block" type="button" data-action="make-print" ${poolN ? '' : 'disabled'}>🖨 인쇄·공유용 시험지 만들기 (${count}문항)</button>
            ${store.get('print', null) ? '<button class="btn btn-ghost btn-block" type="button" data-action="open-print">지난 인쇄용 시험지 다시 보기</button>' : ''}
          </div>
        </section>

        <div class="start-bar">
          <p class="start-summary">${esc(summary)}</p>
          <button class="btn btn-primary btn-block" type="button" data-action="start" ${poolN ? '' : 'disabled'}>${kind === 'exam' ? '시험지 만들기' : '시작하기'}</button>
        </div>
      </div>`;
  }

  function switchRow(key, label, hint) {
    const id = `opt-${key}`;
    return `
      <div class="option-row">
        <label for="${id}">${esc(label)}<span class="hint">${esc(hint)}</span></label>
        <span class="switch"><input type="checkbox" id="${id}" data-action="opt" data-key="${key}" ${S.prefs[key] ? 'checked' : ''}><span></span></span>
      </div>`;
  }

  function startSession(mode) {
    if (!S.owner) return;
    const pool = poolFor(mode);
    if (!pool.length) return;
    const count = mode === 'review' ? pool.length
      : (S.prefs.count === 'all' ? pool.length : Math.min(S.prefs.count, pool.length));
    store.del('active');
    S.session = buildSession(mode, pool, count);
    saveActive();
    go(S.session.kind === 'exam' ? 'exam' : 'study');
  }

  // ---------------------------------------------------------------- 출제 현황 화면
  function renderCoverage() {
    const mode = S.prefs.mode === 'mock' ? 'mock' : S.prefs.mode;
    const scopeKeys = mode === 'mock' ? S.units.map((u) => u.key) : selectedUnitKeys();
    const covered = coveredConceptKeys();
    const pool = S.units.filter((u) => scopeKeys.includes(u.key)).flatMap((u) => u.questions);
    const all = coverageFor(pool);
    const rows = S.units.filter((u) => scopeKeys.includes(u.key)).map((u) => {
      const c = coverageFor(u.questions);
      const keys = new Set();
      u.questions.forEach((q) => q.ckeys.forEach((k) => keys.add(k)));
      const unc = [...keys].filter((k) => !covered.has(k)).map((k) => S.concepts.get(k).label)
        .sort((a, b) => a.localeCompare(b, 'ko'));
      const byPart = [1, 2, 3].map((pp) => {
        const list = u.questions.filter((q) => q.part === pp);
        return `${PARTS[pp].roman} ${list.filter((q) => qMeta(q.id).a).length}/${list.length}`;
      }).join(' · ');
      return `
        <details class="cov-unit" ${unc.length && unc.length < 40 ? 'open' : ''}>
          <summary>
            <span class="cov-unit-name"><b>${esc(u.week)}</b> ${esc(u.title)}</span>
            <span class="cov-unit-meta">문항 ${c.served}/${c.total} · 개념 ${c.conceptCovered}/${c.conceptTotal}</span>
          </summary>
          <p class="muted small" style="margin:6px 0">PART별 출제 ${byPart} · ${c.round}바퀴째(남은 ${c.leftInRound})</p>
          ${unc.length ? `<div class="concept-chips">${unc.map((l) => `<span class="cchip">${esc(l)}</span>`).join('')}</div>`
            : '<p class="empty" style="padding:8px 0">이 단원의 개념을 모두 다뤘습니다.</p>'}
        </details>`;
    }).join('');
    $view.innerHTML = `
      <div class="wrap">
        <section class="card">
          <h2>출제 현황</h2>
          <p class="muted small" style="margin-top:0">범위: ${mode === 'mock' ? '전범위' : esc(scopeKeys.map(unitLabel).join(', ') || '선택 없음')}</p>
          <div class="stat-tiles">
            <div class="stat-tile"><div class="stat-label">출제된 문항</div><div class="stat-value">${all.served}<small> / ${all.total}</small></div></div>
            <div class="stat-tile"><div class="stat-label">다룬 개념</div><div class="stat-value">${all.conceptCovered}<small> / ${all.conceptTotal}</small></div></div>
            <div class="stat-tile"><div class="stat-label">현재 바퀴</div><div class="stat-value">${all.round}<small>바퀴</small></div></div>
          </div>
          <p class="muted small" style="margin:12px 0 0">아래는 <b>아직 한 번도 출제되지 않은 개념</b>입니다. 다음 시험지는 이 개념을 담은 문항에 가점을 주어 먼저 구성합니다.</p>
        </section>
        <section class="card">
          <h2>단원별 안 다룬 개념</h2>
          ${rows || '<p class="empty">범위를 선택하세요.</p>'}
        </section>
        <div class="btn-row"><button class="btn btn-block" type="button" data-action="home">처음으로</button></div>
      </div>`;
  }

  // ---------------------------------------------------------------- 공통 조각
  function boxHTML(q) {
    if (!q.box || !q.box.length) return '';
    return `<div class="qbox"><span class="qbox-title">&lt;보 기&gt;</span>${q.box.map((b) => `<p>${rich(b)}</p>`).join('')}</div>`;
  }
  function tagsHTML(q, item) {
    const u = unitOf(q.unit);
    return `
      <span class="tag tag-unit">${esc(u ? u.week : q.unit)}</span>
      <span class="tag">PART ${PARTS[q.part].roman}</span>
      ${q.type ? `<span class="tag">${esc(q.type)}</span>` : ''}
      ${item && item.isNew ? '<span class="tag tag-new">미출제</span>' : ''}
      ${item && item.review ? '<span class="tag tag-review">복습</span>' : ''}`;
  }
  // 섞인 표시 순서 기준으로 보기별 해설을 만든다
  function notesHTML(q, item) {
    if (!q.notes) return '';
    return `<ul class="notes">${item.order.map((orig, disp) => `
      <li class="${orig === q.answer - 1 ? 'is-answer' : ''}"><span class="nnum">${CIRCLED[disp]}</span><span>${rich(q.notes[orig])}</span></li>`).join('')}</ul>`;
  }
  const dispOf = (item, orig) => item.order.indexOf(orig);
  function sourceHTML(q) {
    return q.source ? `<p class="source"><b>📄 출처</b><span>${esc(q.source)}</span></p>` : '';
  }
  function modelAnswerHTML(q) {
    return `
      <div class="model-answer">
        <p class="ma-title">모범답안</p>
        <p>${rich(q.modelAnswer)}</p>
        ${q.keywords.length ? `<p class="ma-title">채점 요소 (핵심어)</p><ul class="kw">${q.keywords.map((k) => `<li>${esc(k)}</li>`).join('')}</ul>` : ''}
      </div>`;
  }

  // ---------------------------------------------------------------- 학습 모드
  function renderStudy() {
    const s = S.session;
    if (!s) { go('home', false); return; }
    const item = s.items[s.idx];
    const q = S.qById.get(item.id);
    const n = s.items.length;
    const done = isDone(item);
    const answered = s.items.filter(isDone).length;
    const correctN = s.items.filter((it) => isDone(it) && isCorrect(it)).length;
    const last = s.idx === n - 1;
    let body;

    if (isEssay(q)) {
      body = `
        <textarea class="essay-input" data-action="study-essay" rows="6" placeholder="답안을 적어 보세요 (적지 않고 모범답안을 봐도 됩니다)" ${item.shown ? 'readonly' : ''}>${esc(item.text)}</textarea>
        ${item.shown ? `
          <section class="feedback ${done ? (item.self ? 'ok' : 'bad') : ''}" aria-live="polite">
            ${modelAnswerHTML(q)}
            <p class="fb-exp">${rich(q.explanation)}</p>
            ${sourceHTML(q)}
            <div class="self-grade">
              <span>내 답안을 모범답안과 비교해 채점하세요</span>
              <div class="btn-row">
                <button type="button" class="btn grade-o" data-action="study-grade" data-value="1" aria-pressed="${item.self === true}">○ 맞음</button>
                <button type="button" class="btn grade-x" data-action="study-grade" data-value="0" aria-pressed="${item.self === false}">✗ 틀림</button>
              </div>
            </div>
          </section>` : `<button class="btn btn-block" type="button" data-action="show-model" style="margin-top:10px">모범답안과 비교하기</button>`}`;
    } else {
      const ansDisp = dispOf(item, q.answer - 1);
      const ok = done && isCorrect(item);
      const choices = item.order.map((orig, disp) => {
        let cls = '';
        let flag = '';
        if (done) {
          if (orig === q.answer - 1) { cls = 'is-correct'; flag = '<span class="cflag">✓ 정답</span>'; }
          else if (orig === item.pick) { cls = 'is-wrong'; flag = '<span class="cflag">✗ 내 답</span>'; }
          else cls = 'is-dim';
        }
        return `
          <li><button type="button" class="choice ${cls}" data-action="pick" data-disp="${disp}" ${done ? 'disabled' : ''}
               aria-label="${disp + 1}번 보기">
            <span class="cnum" aria-hidden="true">${CIRCLED[disp]}</span>
            <span class="ctext">${rich(q.choices[orig])}${flag}</span>
          </button></li>`;
      }).join('');
      body = `
        <ol class="choices">${choices}</ol>
        ${done ? `
        <section class="feedback ${ok ? 'ok' : 'bad'}" aria-live="polite">
          <p class="fb-title">${ok ? '✓ 정답입니다' : `✗ 오답입니다 — 정답은 ${CIRCLED[ansDisp]}`}</p>
          <p class="fb-exp">${rich(q.explanation)}</p>
          ${notesHTML(q, item)}
          ${sourceHTML(q)}
        </section>` : ''}`;
    }

    $view.innerHTML = `
      <div class="progress-head">
        <div class="progress-inner">
          <div class="pbar" role="progressbar" aria-valuemin="0" aria-valuemax="${n}" aria-valuenow="${answered}" aria-label="진행률">
            <span style="width:${(answered / n) * 100}%"></span>
          </div>
          <div class="prow">
            <span class="pcount">${s.idx + 1} <small>/ ${n}</small></span>
            <span class="pstat">정답 ${correctN} · 오답 ${answered - correctN}</span>
            <span class="ptools"><button class="btn" type="button" data-action="quit">그만하기</button></span>
          </div>
        </div>
      </div>
      <div class="wrap">
        <article class="qcard card">
          <div class="qmeta">${tagsHTML(q, item)}</div>
          <h2 class="qstem"><span class="qnum">${s.idx + 1}.</span>${rich(q.question)}</h2>
          ${boxHTML(q)}
          ${body}
        </article>
        <div class="study-actions">
          ${done ? `<button class="btn btn-primary btn-block" type="button" data-action="next">${last ? '결과 보기' : '다음 문제 →'}</button>` : ''}
          ${s.idx > 0 ? `<button class="btn btn-ghost btn-block" type="button" data-action="prev" style="margin-top:8px">← 이전 문제 보기</button>` : ''}
          ${isEssay(q) ? '' : `<p class="kbd-hint">PC: 숫자키 1–${q.choices.length}로 선택, Enter로 다음</p>`}
        </div>
      </div>`;
    if (done || item.shown) {
      const fb = $view.querySelector('.feedback');
      if (fb && fb.getBoundingClientRect().top > window.innerHeight * 0.75) fb.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
    }
  }

  function studyPick(disp) {
    const s = S.session;
    const item = s.items[s.idx];
    if (item.pick != null) return;
    item.pick = item.order[disp];
    recordAnswer(item.id, isCorrect(item), Date.now());
    persist();
    saveActive();
    renderStudy();
  }

  function studyGrade(val) {
    const s = S.session;
    const item = s.items[s.idx];
    const now = Date.now();
    if (item.self == null) recordAnswer(item.id, val, now);
    else if (item.self !== val) regrade(item.id, val, now);
    item.self = val;
    persist();
    saveActive();
    renderStudy();
  }

  function studyNext() {
    const s = S.session;
    if (!isDone(s.items[s.idx])) return;
    if (s.idx >= s.items.length - 1) { finishSession(); return; }
    s.idx += 1;
    saveActive();
    renderStudy();
    window.scrollTo(0, 0);
  }

  // ---------------------------------------------------------------- 시험 모드
  function examTitle(mode, title) {
    if (title) return `${esc(title)} / Practice Exam`;
    if (mode === 'shared') return '공유 시험지 / Shared Exam';
    return mode === 'mock' ? '전범위 모의고사 / Full-Range Mock Exam' : '실전 평가 / Practice Exam';
  }
  function partGroups(session) {
    const groups = { 1: [], 2: [], 3: [] };
    session.items.forEach((it, i) => {
      const q = S.qById.get(it.id);
      if (q) groups[q.part].push({ it, i, q });
    });
    return groups;
  }
  function partTitleHTML(p, list, graded) {
    if (!list.length) return '';
    const mc = list.filter(({ q }) => !isEssay(q));
    const es = list.filter(({ q }) => isEssay(q));
    const pts = list.reduce((a, { q }) => a + pointsOf(q), 0);
    const parts = [];
    if (mc.length) parts.push(`${mc.length} × ${PARTS[p].points}`);
    if (es.length) parts.push(`서술 ${es.length} × ${ESSAY_POINTS}`);
    let gradeTxt = '';
    if (graded) {
      const earned = list.reduce((a, { it, q }) => a + (isCorrect(it) ? pointsOf(q) : 0), 0);
      gradeTxt = `<span class="part-score">${earned} / ${pts}점</span>`;
    }
    return `<h3 class="part-title">PART ${PARTS[p].roman}. ${PARTS[p].name} <span class="part-pts">(${parts.join(' + ')} = ${pts}점)</span>${gradeTxt}</h3>
      <p class="part-note">${esc(PARTS[p].note)}</p>`;
  }
  function paperHeadHTML(s, scoreHTML, blank = false) {
    const n = s.items.length;
    const minutes = Math.round(s.timeLimitSec / 60);
    return `
      <header class="paper-head">
        <p class="paper-course">${esc(CONFIG.course)} <span style="font-weight:600">${esc(CONFIG.courseEn)}</span></p>
        <p class="paper-title">${examTitle(s.mode, s.title)}</p>
        <p class="paper-info">${esc(s.units.map(unitLabel).join(' · '))} &nbsp;|&nbsp; ${s.timeLimitSec ? `Time: ${minutes}분 &nbsp;|&nbsp; ` : ''}${n}문항 &nbsp;|&nbsp; ${s.totalPoints}점</p>
        <table class="paper-id">
          <tr>
            <th scope="row">이름</th><td>${blank ? '&nbsp;' : `<input type="text" data-action="name" value="${esc(S.prefs.name)}" aria-label="이름" autocomplete="name">`}</td>
            <th scope="row">응시일</th><td>${blank ? '&nbsp;' : fmtDate(s.startedAt || s.createdAt, false)}</td>
            <th scope="row">점수</th><td class="score-cell">${scoreHTML || '&nbsp;'}</td>
          </tr>
        </table>
      </header>`;
  }

  function reportHTML(s) {
    const r = s.report;
    const units = s.units.map((k) => `<tr><th scope="row">${esc(unitLabel(k))}</th><td>${r.unitDist[k]}문항</td><td class="num">${fmtNum(pct(r.unitDist[k], s.items.length))}%</td></tr>`).join('');
    const shown = r.newConcepts.slice(0, 18);
    return `
      <section class="report">
        <h3>출제 리포트</h3>
        <div class="report-grid">
          <div class="report-tile"><span>새 문항(미출제)</span><b>${r.newCount}<small> / ${s.items.length}</small></b></div>
          <div class="report-tile"><span>처음 다루는 개념</span><b>${r.newConcepts.length}<small>개</small></b></div>
          <div class="report-tile"><span>복습 문항</span><b>${r.reviewCount}<small>개 · ${esc(STRATEGIES[s.strategy] ? STRATEGIES[s.strategy].label : '')}</small></b></div>
        </div>
        ${shown.length ? `<p class="report-label">처음 다루는 개념</p><div class="concept-chips">${shown.map((l) => `<span class="cchip">${esc(l)}</span>`).join('')}${r.newConcepts.length > shown.length ? `<span class="cchip more">외 ${r.newConcepts.length - shown.length}개</span>` : ''}</div>` : ''}
        <div class="report-cols">
          <div>
            <p class="report-label">주차 배분</p>
            <table class="data mini"><tbody>${units}</tbody></table>
          </div>
          <div>
            <p class="report-label">PART 구성</p>
            <table class="data mini"><tbody>${[1, 2, 3].map((p) => `<tr><th scope="row">PART ${PARTS[p].roman}</th><td>${r.partDist[p]}문항</td><td class="num">${fmtNum(pct(r.partDist[p], s.items.length))}%</td></tr>`).join('')}</tbody></table>
          </div>
        </div>
      </section>`;
  }

  function renderCover() {
    const s = S.session;
    const minutes = Math.round(s.timeLimitSec / 60);
    $view.innerHTML = `
      <div class="wrap-wide">
        <article class="paper cover" aria-label="시험지 표지">
          ${paperHeadHTML(s, '')}
          <div class="paper-inst">
            <p><b>Instructions</b></p>
            <ul>
              <li>객관식은 가장 적절한 답 하나를 고르시오. 시험지의 보기를 누르면 <span class="pen-blue">파란 펜</span>으로 표시되고 답안지(OMR)에 바로 옮겨집니다.</li>
              <li>배점: PART I 문항당 ${PARTS[1].points}점 · PART II ${PARTS[2].points}점 · PART III ${PARTS[3].points}점${s.items.some((it) => isEssay(S.qById.get(it.id))) ? ` · 서술형 ${ESSAY_POINTS}점` : ''}. 총 ${s.totalPoints}점${s.timeLimitSec ? `, 제한 시간 ${minutes}분(100점 = 90분). 시간이 끝나면 자동 제출됩니다` : ''}.</li>
              <li>짝짓기 문항은 네 쌍이 모두 맞아야 정답입니다.</li>
              <li>창을 닫아도 처음 화면의 「이어서 풀기」로 남은 시간 그대로 이어 풀 수 있습니다.</li>
            </ul>
          </div>
          ${reportHTML(s)}
          <div class="btn-row cover-actions">
            <button class="btn" type="button" data-action="quit">나가기 (저장됨)</button>
            <button class="btn btn-primary" type="button" data-action="begin">시험 시작${s.timeLimitSec ? ` · ${minutes}분` : ''}</button>
          </div>
        </article>
      </div>`;
  }

  function examQuestionHTML(it, i, q) {
    const pts = pointsOf(q);
    const stem = `<p class="pq-stem"><span class="pq-no">${i + 1}.</span> ${rich(q.question)} <span class="pq-tag">(${esc(unitLabel(q.unit))} · ${pts}점)</span></p>`;
    if (isEssay(q)) {
      return `
        <div class="pq" id="pq-${i}" data-i="${i}">
          ${stem}
          ${boxHTML(q)}
          <textarea class="essay-input" data-action="essay" data-i="${i}" rows="7" placeholder="답안을 작성하시오 (핵심어를 넣어 간결하게)">${esc(it.text)}</textarea>
        </div>`;
    }
    return `
      <div class="pq" id="pq-${i}" data-i="${i}">
        ${stem}
        ${boxHTML(q)}
        <ol class="pq-choices">
          ${it.order.map((orig, disp) => `
            <li><button type="button" class="pchoice" data-action="mark" data-i="${i}" data-disp="${disp}" aria-pressed="${it.pick === orig}"
                 aria-label="${i + 1}번 문항 ${disp + 1}번 보기">
              <span class="cnum" aria-hidden="true">${CIRCLED[disp]}</span><span>${rich(q.choices[orig])}</span>
            </button></li>`).join('')}
        </ol>
      </div>`;
  }

  function omrHTML(s) {
    const groups = partGroups(s);
    const answered = s.items.filter(isAnswered).length;
    return `
      <div class="omr-head">
        <h3>답안지 <small>OMR</small></h3>
        <span class="omr-count"><b id="omrCount">${answered}</b> / ${s.items.length}</span>
        <button class="btn omr-close" type="button" data-action="omr">닫기</button>
      </div>
      <div class="omr-body">
        ${[1, 2, 3].filter((p) => groups[p].length).map((p) => `
          <p class="omr-part">PART ${PARTS[p].roman}</p>
          ${groups[p].map(({ it, i, q }) => `
            <div class="omr-row" id="omr-${i}">
              <button type="button" class="omr-no" data-action="jump" data-i="${i}" aria-label="${i + 1}번 문항으로 이동">${i + 1}</button>
              ${isEssay(q)
                ? `<button type="button" class="omr-essay ${isAnswered(it) ? 'is-on' : ''}" data-action="jump" data-i="${i}">서술형 ${isAnswered(it) ? '작성함' : '미작성'}</button>`
                : it.order.map((orig, disp) => `<button type="button" class="omr-b" data-action="mark" data-i="${i}" data-disp="${disp}" aria-pressed="${it.pick === orig}" aria-label="${i + 1}번 ${disp + 1}">${disp + 1}</button>`).join('')}
            </div>`).join('')}`).join('')}
      </div>
      <button class="btn btn-primary btn-block omr-submit" type="button" data-action="submit">제출하고 채점하기</button>`;
  }

  function renderExam() {
    const s = S.session;
    if (!s) { go('home', false); return; }
    if (!s.started) { renderCover(); return; }
    const n = s.items.length;
    const answered = s.items.filter(isAnswered).length;
    const groups = partGroups(s);

    $view.innerHTML = `
      <div class="progress-head progress-wide">
        <div class="progress-inner">
          <div class="pbar" role="progressbar" aria-valuemin="0" aria-valuemax="${n}" aria-valuenow="${answered}" aria-label="답안 작성 진행률">
            <span id="examBar" style="width:${(answered / n) * 100}%"></span>
          </div>
          <div class="prow">
            <span class="pcount"><span id="curQ">1</span> <small>/ ${n}번</small></span>
            <span class="pstat">답안 <b id="ansCount">${answered}</b>/${n}${s.timeLimitSec ? ` · <span class="timer" id="timer">--:--</span>` : ''}</span>
            <span class="ptools">
              <button class="btn omr-toggle" type="button" data-action="omr">답안지</button>
              <button class="btn btn-primary" type="button" data-action="submit">제출</button>
            </span>
          </div>
        </div>
      </div>
      <div class="exam-layout">
        <article class="paper" aria-label="시험지">
          ${paperHeadHTML(s, '')}
          ${[1, 2, 3].map((p) => groups[p].length ? `
          <section class="paper-part">
            ${partTitleHTML(p, groups[p], false)}
            <div class="paper-cols">${groups[p].map(({ it, i, q }) => examQuestionHTML(it, i, q)).join('')}</div>
          </section>` : '').join('')}
          <p class="paper-end">— 끝 —</p>
          <div class="btn-row no-print" style="margin-top:16px">
            <button class="btn" type="button" data-action="print">🖨 시험지 인쇄</button>
            <button class="btn" type="button" data-action="quit">나가기 (저장됨)</button>
            <button class="btn btn-primary" type="button" data-action="submit">제출하고 채점하기</button>
          </div>
        </article>
        <aside class="omr-panel" id="omrPanel" aria-label="답안지">${omrHTML(s)}</aside>
      </div>
      <button class="omr-fab" type="button" data-action="omr" aria-label="답안지 열기">🗒 답안지 <b id="fabCount">${answered}/${n}</b></button>`;
    startExamTimer();
    observeQuestions();
  }

  function updateAnswerCounts() {
    const s = S.session;
    const answered = s.items.filter(isAnswered).length;
    const n = s.items.length;
    const bar = document.getElementById('examBar');
    if (bar) bar.style.width = `${(answered / n) * 100}%`;
    ['ansCount', 'omrCount'].forEach((id) => { const el = document.getElementById(id); if (el) el.textContent = answered; });
    const fab = document.getElementById('fabCount');
    if (fab) fab.textContent = `${answered}/${n}`;
  }

  function examMark(i, disp) {
    const s = S.session;
    const item = s.items[i];
    const orig = item.order[disp];
    item.pick = item.pick === orig ? null : orig; // 같은 보기를 다시 누르면 선택 취소
    saveActive();
    const sync = (sel) => document.querySelectorAll(sel).forEach((b) => {
      b.setAttribute('aria-pressed', String(item.order[Number(b.dataset.disp)] === item.pick));
    });
    sync(`#pq-${i} .pchoice`);
    sync(`#omr-${i} .omr-b`);
    updateAnswerCounts();
  }

  function examEssayInput(i, value) {
    const s = S.session;
    const it = s.items[i];
    const before = isAnswered(it);
    it.text = value.slice(0, 4000);
    saveActive();
    if (before !== isAnswered(it)) {
      const b = document.querySelector(`#omr-${i} .omr-essay`);
      if (b) { b.classList.toggle('is-on', isAnswered(it)); b.textContent = `서술형 ${isAnswered(it) ? '작성함' : '미작성'}`; }
      updateAnswerCounts();
    }
  }

  // 경과 시간: 실제로 시험지를 보고 있던 시간만 센다(창을 닫으면 멈춤)
  function currentElapsed(s) {
    return (s.elapsedSec || 0) + (s.runningSince ? (Date.now() - s.runningSince) / 1000 : 0);
  }
  function flushElapsed() {
    const s = S.session;
    if (!s || s.kind !== 'exam' || !s.started || !s.runningSince) return;
    s.elapsedSec = currentElapsed(s);
    s.runningSince = Date.now();
    if (S.view !== 'exam') s.runningSince = 0;
    saveActive();
  }

  function startExamTimer() {
    const s = S.session;
    if (!s || !s.started) return;
    s.runningSince = Date.now();
    const el = document.getElementById('timer');
    let lastSave = Date.now();
    const tick = () => {
      const elapsed = currentElapsed(s);
      if (Date.now() - lastSave > 10000) { s.elapsedSec = elapsed; s.runningSince = Date.now(); saveActive(); lastSave = Date.now(); }
      if (!s.timeLimitSec || !el) return;
      const left = s.timeLimitSec - elapsed;
      el.textContent = `남은 ${fmtDur(left)}`;
      el.classList.toggle('is-warn', left <= 300);
      if (left <= 0) {
        stopTimers();
        s.elapsedSec = s.timeLimitSec;
        s.runningSince = 0;
        alert('시험 시간이 끝났습니다. 답안을 자동으로 제출합니다.');
        finishSession({ auto: true });
      }
    };
    tick();
    S.timerId = setInterval(tick, 1000);
  }

  // 화면 가운데에 걸친 문항 번호를 "몇 번 / 전체"로 표시
  function observeQuestions() {
    if (!('IntersectionObserver' in window)) return;
    const visible = new Set();
    const cur = document.getElementById('curQ');
    S.observer = new IntersectionObserver((entries) => {
      entries.forEach((e) => {
        const i = Number(e.target.dataset.i);
        if (e.isIntersecting) visible.add(i); else visible.delete(i);
      });
      if (visible.size && cur) cur.textContent = Math.min(...visible) + 1;
    }, { rootMargin: '-35% 0px -55% 0px' });
    document.querySelectorAll('.pq').forEach((el) => S.observer.observe(el));
  }

  function submitExam() {
    const s = S.session;
    const left = s.items.filter((it) => !isAnswered(it)).length;
    const msg = left
      ? `아직 답하지 않은 문항이 ${left}개 있습니다. 미응답은 오답으로 처리됩니다.\n제출하고 채점할까요?`
      : '답안을 제출하고 채점할까요?';
    if (!confirm(msg)) return;
    finishSession();
  }

  // ---------------------------------------------------------------- 인쇄·공유용 시험지
  // 앱 안 브라우저(카카오톡·인스타그램 등)는 인쇄(window.print)를 막아 둔 경우가 많다
  function inAppBrowser() {
    const ua = navigator.userAgent || '';
    if (/KAKAOTALK/i.test(ua)) return 'kakao';
    if (/Instagram|FBAN|FBAV|FB_IAB|NAVER\(inapp|Line\/|DaumApps|everytimeApp|Whale\/.*inapp|; wv\)/i.test(ua)) return 'other';
    return null;
  }
  function externalOpenHref() {
    const url = location.href;
    const ua = navigator.userAgent || '';
    if (inAppBrowser() === 'kakao') return `kakaotalk://web/openExternal?url=${encodeURIComponent(url)}`;
    if (/Android/i.test(ua)) return `intent://${url.replace(/^https?:\/\//, '')}#Intent;scheme=https;package=com.android.chrome;end`;
    return '';
  }
  function inAppNoticeHTML(what) {
    if (!inAppBrowser()) return '';
    const href = externalOpenHref();
    return `
      <div class="notice inapp-notice no-print">
        <p><b>앱 안 브라우저에서는 ${esc(what)}이 막혀 있을 수 있습니다.</b> Chrome·Safari 같은 기본 브라우저로 열어 주세요.</p>
        ${href ? `<a class="btn btn-block" href="${esc(href)}">🌐 기본 브라우저로 열기</a>`
          : '<p class="small" style="margin:6px 0 0">오른쪽 위·아래의 ⋯ 또는 공유 버튼 → 「Safari로 열기」(또는 「다른 브라우저로 열기」)를 누르세요.</p>'}
      </div>`;
  }
  function doPrint() {
    if (inAppBrowser() || typeof window.print !== 'function') {
      const href = externalOpenHref();
      if (href && confirm('이 앱 안 브라우저에서는 인쇄가 막혀 있을 수 있습니다.\n기본 브라우저(Chrome·Safari)로 열까요?')) { location.href = href; return; }
      if (!href) { alert('이 앱 안 브라우저에서는 인쇄가 막혀 있을 수 있습니다.\n⋯ 메뉴에서 「Safari로 열기」(또는 「다른 브라우저로 열기」)를 누른 뒤 다시 인쇄하세요.'); return; }
    }
    try { window.print(); } catch (e) { alert('이 브라우저에서는 인쇄를 할 수 없습니다. Chrome·Safari로 열어 주세요.'); }
  }
  function toast(msg) {
    const el = document.createElement('div');
    el.className = 'toast';
    el.setAttribute('role', 'status');
    el.textContent = msg;
    document.body.appendChild(el);
    setTimeout(() => el.classList.add('is-on'), 10);
    setTimeout(() => { el.classList.remove('is-on'); setTimeout(() => el.remove(), 300); }, 2600);
  }

  // 공유 링크: #set=<id.id.…>&o=<문항별 보기 순서 숫자를 이어 붙인 것>&t=<제목>
  function encodeSet(set) {
    const ids = set.items.map((it) => it.id).join('.');
    const o = set.items.map((it) => it.order.join('')).join('');
    return `set=${ids}&o=${o}${set.title ? `&t=${encodeURIComponent(set.title)}` : ''}`;
  }
  function shareURL(set) {
    return `${location.origin}${location.pathname}#${encodeSet(set)}`;
  }
  function decodeSet(hash) {
    const params = new URLSearchParams(hash.replace(/^#/, ''));
    const ids = (params.get('set') || '').split('.').filter(Boolean);
    const o = params.get('o') || '';
    const title = (params.get('t') || '').slice(0, 60);
    const items = [];
    let missing = 0;
    let pos = 0;
    ids.forEach((id) => {
      const q = S.qById.get(id);
      if (!q) { missing += 1; return; }
      const n = isEssay(q) ? 0 : q.choices.length;
      const digits = o.slice(pos, pos + n).split('').map(Number);
      pos += n;
      const valid = digits.length === n && new Set(digits).size === n && digits.every((d) => d >= 0 && d < n);
      items.push({ id, order: isEssay(q) ? [] : (valid ? digits : shuffle(range(n))) });
    });
    return { items, missing, title, createdAt: Date.now() };
  }
  function setMeta(set) {
    const qs = set.items.map((it) => S.qById.get(it.id));
    const unitDist = {};
    const partDist = { 1: 0, 2: 0, 3: 0 };
    let totalPoints = 0;
    qs.forEach((q) => { unitDist[q.unit] = (unitDist[q.unit] || 0) + 1; partDist[q.part] += 1; totalPoints += pointsOf(q); });
    return {
      units: S.units.map((u) => u.key).filter((k) => unitDist[k]),
      unitDist, partDist, totalPoints,
      minutes: Math.round(totalPoints * CONFIG.minutesPer100 / 100),
    };
  }

  function makePrintSet() {
    if (!S.owner) return;
    const p = S.prefs;
    const pool = poolFor(p.mode === 'mock' ? 'mock' : 'study');
    if (!pool.length) return;
    const count = p.count === 'all' ? pool.length : Math.min(p.count, pool.length);
    let picked = count >= pool.length ? pool.slice() : compose(pool, count, 'fresh').picked;
    picked = orderPicked(picked, 'exam');
    const prev = store.get('print', null);
    S.print = {
      title: (prev && prev.title) || '',
      opts: Object.assign({ omr: true, key: true, exp: true }, prev && prev.opts),
      items: picked.map((q) => ({ id: q.id, order: isEssay(q) ? [] : (p.shuffleC ? shuffle(range(q.choices.length)) : range(q.choices.length)) })),
      createdAt: Date.now(),
    };
    store.set('print', S.print);
  }

  function printPaperSession(set) {
    const m = setMeta(set);
    return { mode: 'shared', title: set.title, units: m.units, items: set.items, totalPoints: m.totalPoints, timeLimitSec: m.minutes * 60, createdAt: set.createdAt };
  }

  function printQuestionHTML(it, i, q) {
    return `
      <div class="pq">
        <p class="pq-stem"><span class="pq-no">${i + 1}.</span> ${rich(q.question)} <span class="pq-tag">(${esc(unitLabel(q.unit))} · ${pointsOf(q)}점)</span></p>
        ${boxHTML(q)}
        ${isEssay(q) ? '<div class="print-lines"></div>' : `<ol class="pq-choices print-choices">${it.order.map((orig, disp) => `
          <li><span class="cnum">${CIRCLED[disp]}</span><span>${rich(q.choices[orig])}</span></li>`).join('')}</ol>`}
      </div>`;
  }

  function renderPrint() {
    if (!S.print) S.print = store.get('print', null);
    const set = S.print;
    if (!set || !set.items || !set.items.length || !set.items.every((it) => S.qById.has(it.id))) { go('home', false); return; }
    const opts = set.opts || { omr: true, key: true, exp: true };
    const ps = printPaperSession(set);
    const m = setMeta(set);
    const groups = partGroups(ps);
    const n = set.items.length;
    const omrRows = set.items.map((it, i) => {
      const q = S.qById.get(it.id);
      return `<div class="pomr-row"><span class="pomr-no">${i + 1}</span>${isEssay(q) ? '<span class="pomr-essay">서술</span>' : it.order.map((_, d) => `<span class="pomr-b">${d + 1}</span>`).join('')}</div>`;
    }).join('');
    const keyCells = set.items.map((it, i) => {
      const q = S.qById.get(it.id);
      return `<div class="pkey-cell"><span>${i + 1}</span><b>${isEssay(q) ? '서술' : CIRCLED[it.order.indexOf(q.answer - 1)]}</b></div>`;
    }).join('');
    const expList = set.items.map((it, i) => {
      const q = S.qById.get(it.id);
      const ans = isEssay(q) ? '' : CIRCLED[it.order.indexOf(q.answer - 1)];
      return `<div class="pexp"><p><b>${i + 1}. 정답 ${ans}</b> <span class="muted small">(${esc(unitLabel(q.unit))})</span></p><p>${rich(q.explanation)}</p>${q.source ? `<p class="source"><b>📄</b><span>${esc(q.source)}</span></p>` : ''}</div>`;
    }).join('');

    $view.innerHTML = `
      <div class="wrap no-print">
        <section class="card print-tools">
          <h2>🖨 인쇄·공유용 시험지</h2>
          ${inAppNoticeHTML('인쇄·PDF 저장')}
          <p class="muted small" style="margin-top:0">${n}문항 · ${m.totalPoints}점 · 권장 시간 ${m.minutes}분 · 범위 ${esc(m.units.map(unitLabel).join(', '))} · PART I ${m.partDist[1]} / II ${m.partDist[2]} / III ${m.partDist[3]}</p>
          <label class="field">시험지 제목 <input type="text" data-action="print-title" maxlength="40" placeholder="예: 중간고사 대비 1회" value="${esc(set.title || '')}"></label>
          <div class="check-row">
            <label><input type="checkbox" data-action="print-opt" data-key="omr" ${opts.omr ? 'checked' : ''}> 답안지(OMR)</label>
            <label><input type="checkbox" data-action="print-opt" data-key="key" ${opts.key ? 'checked' : ''}> 정답표</label>
            <label><input type="checkbox" data-action="print-opt" data-key="exp" ${opts.exp ? 'checked' : ''}> 해설</label>
          </div>
          <div class="btn-row">
            <button class="btn btn-primary" type="button" data-action="do-print">🖨 인쇄 / PDF 저장</button>
            <button class="btn" type="button" data-action="download-pdf">📄 PDF 파일로 받기</button>
            ${S.owner ? '<button class="btn" type="button" data-action="share-link">🔗 링크로 공유</button>' : ''}
          </div>
          <p class="small pdf-status" id="pdfStatus" role="status"></p>
          <div class="btn-row" style="margin-top:10px">
            <button class="btn" type="button" data-action="solve-print">✍️ 이 시험지 직접 풀기</button>
            ${S.owner ? '<button class="btn" type="button" data-action="make-print">🔄 다른 문제로 다시 만들기</button>' : ''}
          </div>
          <div id="shareBox"></div>
          <p class="muted small" style="margin:12px 0 0">인쇄 창에 「인쇄 미리보기에 실패했습니다」가 뜨면 대상(프린터)을 <b>「PDF로 저장」</b>으로 바꾸거나, 인쇄 창 없이 바로 만드는 <b>「📄 PDF 파일로 받기」</b>를 쓰세요.${S.owner ? ' 링크를 받은 사람은 이 시험지만 풀거나 인쇄할 수 있고, 문제집의 다른 화면에는 들어갈 수 없습니다.' : ''}</p>
        </section>
      </div>
      <div class="wrap-wide">
        <article class="paper print-paper" aria-label="인쇄용 시험지">
          ${paperHeadHTML(ps, '', true)}
          <p class="paper-inst"><b>Instructions:</b> 각 문항에서 가장 적절한 답 하나를 고르시오. 「&lt;보기&gt;」가 있는 짝짓기 문항은 네 쌍이 모두 맞아야 정답입니다. 배점은 ( ) 안에 있습니다.${opts.omr ? ' 답은 답안지(OMR)에 표시하시오.' : ''}</p>
          ${[1, 2, 3].map((pp) => groups[pp].length ? `
          <section class="paper-part">
            ${partTitleHTML(pp, groups[pp], false)}
            <div class="paper-cols">${groups[pp].map(({ it, i, q }) => printQuestionHTML(it, i, q)).join('')}</div>
          </section>` : '').join('')}
          <p class="paper-end">— 끝 —</p>
        </article>
        ${opts.omr ? `
        <section class="paper print-sheet page-break" aria-label="답안지">
          <h3 class="sheet-title">답안지 (OMR) — ${esc(set.title || 'GMP 바이오공정')}</h3>
          <table class="paper-id"><tr><th scope="row">이름</th><td>&nbsp;</td><th scope="row">학번</th><td>&nbsp;</td><th scope="row">점수</th><td>&nbsp;</td></tr></table>
          <div class="pomr-grid">${omrRows}</div>
        </section>` : ''}
        ${opts.key || opts.exp ? `
        <section class="paper print-sheet page-break" aria-label="정답과 해설">
          <h3 class="sheet-title">정답${opts.exp ? ' 및 해설' : ''} — ${esc(set.title || 'GMP 바이오공정')}</h3>
          ${opts.key ? `<div class="pkey-grid">${keyCells}</div>` : ''}
          ${opts.exp ? `<div class="pexp-list">${expList}</div>` : ''}
        </section>` : ''}
      </div>`;
  }

  async function shareLink() {
    const set = S.print;
    if (!set) return;
    const url = shareURL(set);
    const box = document.getElementById('shareBox');
    if (navigator.share && /Android|iPhone|iPad|iPod/i.test(navigator.userAgent || '')) {
      try { await navigator.share({ title: set.title || 'GMP 바이오공정 시험지', text: `${set.title || 'GMP 바이오공정 시험지'} (${set.items.length}문항)`, url }); return; }
      catch (e) { /* 취소하면 아래 복사로 */ }
    }
    let copied = false;
    try { await navigator.clipboard.writeText(url); copied = true; } catch (e) { copied = false; }
    if (box) {
      box.innerHTML = `<div class="share-box"><p class="small" style="margin:0 0 6px">${copied ? '링크를 복사했습니다. 메신저에 붙여 넣어 보내세요.' : '아래 링크를 길게 눌러 복사해 보내세요.'}</p><input type="text" readonly value="${esc(url)}" aria-label="공유 링크"></div>`;
      const inp = box.querySelector('input');
      if (inp) { inp.focus(); inp.select(); }
    }
    if (copied) toast('공유 링크를 복사했습니다');
  }

  // 공유 링크로 들어온 사람에게 보여 주는 첫 화면
  function renderShared() {
    const set = S.shared;
    if (!set || !set.items.length) {
      $view.innerHTML = `<div class="wrap"><div class="notice notice-error"><p><b>공유 시험지를 열 수 없습니다.</b> 링크가 잘렸거나 문항이 바뀌었습니다.</p></div><button class="btn btn-block" type="button" data-action="home">처음 화면으로</button></div>`;
      return;
    }
    const m = setMeta(set);
    $view.innerHTML = `
      <div class="wrap">
        <section class="card result-hero">
          <p class="muted" style="margin:0">🔗 공유받은 시험지</p>
          <h1 style="margin:6px 0">${esc(set.title || 'GMP 바이오공정 시험지')}</h1>
          <p class="score-sub">${set.items.length}문항 · ${m.totalPoints}점 · 권장 시간 ${m.minutes}분<br>범위 ${esc(m.units.map(unitLabel).join(', '))} · PART I ${m.partDist[1]} / II ${m.partDist[2]} / III ${m.partDist[3]}</p>
          ${set.missing ? `<p class="notice">문제집이 업데이트되어 ${set.missing}문항은 빠졌습니다.</p>` : ''}
          <div class="btn-row">
            <button class="btn btn-primary" type="button" data-action="solve-shared">✍️ 온라인으로 풀기</button>
            <button class="btn" type="button" data-action="print-shared">🖨 인쇄용으로 보기</button>
          </div>
          <p class="muted small" style="margin:12px 0 0">풀이 기록은 이 기기에만 저장됩니다.</p>
          ${S.owner ? '<button class="btn btn-ghost btn-block" type="button" data-action="home" style="margin-top:8px">처음 화면으로</button>' : ''}
        </section>
      </div>`;
  }

  function startFromSet(set) {
    const active = store.get('active', null);
    if (active && active.v === 2 && !confirm('진행 중인 풀이가 있습니다. 버리고 이 시험지를 시작할까요?')) return;
    const picked = set.items.map((it) => S.qById.get(it.id));
    store.del('active');
    S.session = sessionFrom('shared', picked, { orders: set.items.map((it) => it.order), poolSize: picked.length });
    S.session.title = set.title || '';
    saveActive();
    clearHash();
    go('exam');
  }
  function clearHash() {
    if (location.hash) history.replaceState(history.state, '', location.pathname + location.search);
  }

  // ---------------------------------------------------------------- 주인 확인 · 잠금 화면
  async function sha256Hex(text) {
    if (!(window.crypto && crypto.subtle)) return '';
    const buf = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(text));
    return [...new Uint8Array(buf)].map((b) => b.toString(16).padStart(2, '0')).join('');
  }
  async function tryOwnerCode(code) {
    const ok = !!code && (await sha256Hex(code.trim())) === CONFIG.ownerHash;
    if (ok) { S.owner = true; store.set('owner', true); }
    return ok;
  }
  async function checkOwner() {
    const m = location.hash.match(/^#owner=([^&]+)/);
    if (m) {
      const ok = await tryOwnerCode(decodeURIComponent(m[1]));
      clearHash();
      if (ok) setTimeout(() => toast('이 기기를 만든 사람(주인)으로 등록했습니다'), 300);
    }
    // 잠금 기능 이전부터 이 기기에서 문제집을 쓰던 사람은 주인으로 본다
    if (!S.owner && S.history.some((h) => h.mode && h.mode !== 'shared')) { S.owner = true; store.set('owner', true); }
  }

  function renderLocked() {
    const last = store.get('sharedLast', null);
    const lastOk = last && Array.isArray(last.items) && last.items.length && last.items.every((it) => S.qById.has(it.id));
    const active = store.get('active', null);
    const activeOk = active && active.v === 2 && active.mode === 'shared' && active.items.every((it) => S.qById.has(it.id));
    const res = store.get('result', null);
    const resOk = res && res.session && res.session.mode === 'shared' && res.session.items.every((it) => S.qById.has(it.id));
    $view.innerHTML = `
      <div class="wrap">
        <section class="card locked">
          <p class="lock-icon" aria-hidden="true">🔒</p>
          <h1>공유받은 시험지만 열 수 있습니다</h1>
          <p class="muted">이 문제집은 만든 사람만 전체를 쓸 수 있습니다. 받은 시험지 링크로 들어오면 그 시험지를 풀거나 인쇄할 수 있습니다.</p>
          ${activeOk ? `<div class="resume"><p>풀던 시험지가 있습니다 (${active.items.filter(isAnswered).length} / ${active.items.length} 답함)</p><div class="btn-row"><button class="btn btn-primary" type="button" data-action="resume">이어서 풀기</button></div></div>` : ''}
          ${lastOk ? `
          <div class="locked-set">
            <p><b>받은 시험지</b> · ${esc(last.title || 'GMP 바이오공정 시험지')} (${last.items.length}문항)</p>
            <div class="btn-row">
              <button class="btn" type="button" data-action="open-shared-last">✍️ 다시 풀기 / 🖨 인쇄</button>
              ${resOk ? '<button class="btn" type="button" data-action="last-result">📋 내 채점지 보기</button>' : ''}
            </div>
          </div>` : ''}
        </section>
        <details class="card owner-unlock">
          <summary>만든 사람이신가요?</summary>
          <p class="muted small">주인 링크로 한 번 열거나 주인 코드를 넣으면 이 기기(브라우저)에서 전체 문제집이 열립니다.</p>
          <form class="owner-form" data-action="owner-form">
            <input type="password" name="code" autocomplete="current-password" placeholder="주인 코드" aria-label="주인 코드">
            <button class="btn btn-primary" type="submit">열기</button>
          </form>
        </details>
      </div>`;
  }

  // ---------------------------------------------------------------- PDF 파일 만들기(인쇄 창 없이)
  function loadScript(src) {
    return new Promise((resolve, reject) => {
      const el = document.createElement('script');
      el.src = src;
      el.onload = resolve;
      el.onerror = () => reject(new Error(`${src} 를 불러오지 못했습니다.`));
      document.head.appendChild(el);
    });
  }
  async function ensurePdfLibs() {
    if (!(window.jspdf && window.jspdf.jsPDF)) await loadScript('js/vendor/jspdf-2.5.2.umd.min.js');
    if (!window.html2canvas) await loadScript('js/vendor/html2canvas-1.4.1.min.js');
  }

  async function downloadPdf(btn) {
    const set = S.print;
    if (!set || S.pdfBusy) return;
    const status = document.getElementById('pdfStatus');
    const say = (t) => { if (status) status.textContent = t; };
    S.pdfBusy = true;
    if (btn) btn.disabled = true;
    const host = document.createElement('div');
    host.className = 'pdf-host';
    document.body.appendChild(host);
    try {
      say('PDF 도구를 불러오는 중…');
      await ensurePdfLibs();
      const opts = set.opts || { omr: true, key: true, exp: true };
      const ps = printPaperSession(set);
      const groups = partGroups(ps);
      const titleTxt = set.title || 'GMP 바이오공정';
      // A4 세로, 여백 12 mm, 2단(단 사이 6 mm)
      const PW = 210, PH = 297, M = 12, GAP = 6, FW = PW - 2 * M, CW = (FW - GAP) / 2, SP = 2.5;
      const FULLPX = 840, COLPX = Math.round(FULLPX * CW / FW);
      const { jsPDF } = window.jspdf;
      const doc = new jsPDF({ unit: 'mm', format: 'a4', compress: true });
      let y = M;
      let total = 0, done = 0;
      const count = () => { total += 1; };
      const snap = async (html, widthPx) => {
        host.innerHTML = `<div class="pdf-block" style="width:${widthPx}px">${html}</div>`;
        const canvas = await window.html2canvas(host.firstElementChild, { scale: 1.5, backgroundColor: '#ffffff', logging: false, useCORS: true });
        done += 1;
        say(`PDF 만드는 중… ${Math.min(done, total)} / ${total}`);
        return canvas;
      };
      const add = (canvas, x, top, w, h) => doc.addImage(canvas.toDataURL('image/jpeg', 0.8), 'JPEG', x, top, w, h, undefined, 'FAST');
      const newPage = () => { doc.addPage(); y = M; };
      const full = async (html, { breakBefore = false } = {}) => {
        const c = await snap(html, FULLPX);
        let h = c.height * FW / c.width;
        if (breakBefore && y > M) newPage();
        if (y + h > PH - M && y > M) newPage();
        if (h > PH - 2 * M) h = PH - 2 * M;
        add(c, M, y, FW, h);
        y += h + SP;
      };
      // 2단 구역: 왼쪽 단을 먼저 채우고 오른쪽 단으로, 마지막 쪽은 양쪽 높이를 맞춘다
      const band = async (htmlList) => {
        const blocks = [];
        for (const html of htmlList) {
          const c = await snap(html, COLPX);
          blocks.push({ c, h: c.height * CW / c.width });
        }
        let i = 0;
        while (i < blocks.length) {
          let avail = PH - M - y;
          if (avail < Math.min(40, blocks[i].h)) { newPage(); avail = PH - M - y; }
          const fill = (start) => {
            let k = start, sum = 0;
            while (k < blocks.length && (sum + blocks[k].h <= avail || k === start)) { sum += Math.min(blocks[k].h, avail) + SP; k += 1; }
            return k;
          };
          const lEnd = fill(i);
          let rEnd = lEnd < blocks.length ? fill(lEnd) : lEnd;
          let split = lEnd;
          if (rEnd >= blocks.length) {
            // 이 쪽에서 구역이 끝나면 두 단 높이가 비슷해지도록 나눈다
            const pageBlocks = blocks.slice(i, rEnd);
            const heights = pageBlocks.map((b) => Math.min(b.h, avail) + SP);
            const totalH = heights.reduce((a, b) => a + b, 0);
            let best = lEnd, bestDiff = Infinity, acc = 0;
            for (let k = i; k < rEnd; k += 1) {
              acc += heights[k - i];
              const left = acc, right = totalH - acc;
              if (left <= avail + 0.01 && right <= avail + 0.01) {
                const diff = Math.abs(left - right) + (right > left ? 0.5 : 0);
                if (diff < bestDiff) { bestDiff = diff; best = k + 1; }
              }
            }
            split = best;
            rEnd = blocks.length;
          }
          let ly = y, ry = y;
          for (let k = i; k < split; k += 1) { const h = Math.min(blocks[k].h, avail); add(blocks[k].c, M, ly, CW, h); ly += h + SP; }
          for (let k = split; k < rEnd; k += 1) { const h = Math.min(blocks[k].h, avail); add(blocks[k].c, M + CW + GAP, ry, CW, h); ry += h + SP; }
          i = rEnd;
          if (i < blocks.length) newPage();
          else y = Math.max(ly, ry) + 1;
        }
      };

      // 블록 수(진행 표시용)
      count(); count();
      [1, 2, 3].forEach((p) => { if (groups[p].length) { count(); groups[p].forEach(count); } });
      if (opts.omr) count();
      if (opts.key) count();
      if (opts.exp) set.items.forEach(count);

      await full(paperHeadHTML(ps, '', true));
      await full(`<p class="paper-inst"><b>Instructions:</b> 각 문항에서 가장 적절한 답 하나를 고르시오. 「&lt;보기&gt;」가 있는 짝짓기 문항은 네 쌍이 모두 맞아야 정답입니다. 배점은 ( ) 안에 있습니다.${opts.omr ? ' 답은 답안지(OMR)에 표시하시오.' : ''}</p>`);
      for (const p of [1, 2, 3]) {
        if (!groups[p].length) continue;
        await full(`<section class="paper-part">${partTitleHTML(p, groups[p], false)}</section>`);
        await band(groups[p].map(({ it, i, q }) => printQuestionHTML(it, i, q)));
      }
      if (opts.omr) {
        const rows = set.items.map((it, i) => {
          const q = S.qById.get(it.id);
          return `<div class="pomr-row"><span class="pomr-no">${i + 1}</span>${isEssay(q) ? '<span class="pomr-essay">서술</span>' : it.order.map((_, d) => `<span class="pomr-b">${d + 1}</span>`).join('')}</div>`;
        });
        const per = Math.ceil(rows.length / 3);
        const cols = [0, 1, 2].map((c) => `<div class="pdf-omr-col">${rows.slice(c * per, (c + 1) * per).join('')}</div>`).join('');
        await full(`<h3 class="sheet-title">답안지 (OMR) — ${esc(titleTxt)}</h3>
          <table class="paper-id"><tr><th scope="row">이름</th><td>&nbsp;</td><th scope="row">학번</th><td>&nbsp;</td><th scope="row">점수</th><td>&nbsp;</td></tr></table>
          <div class="pdf-omr">${cols}</div>`, { breakBefore: true });
      }
      if (opts.key || opts.exp) {
        const keyCells = set.items.map((it, i) => {
          const q = S.qById.get(it.id);
          return `<div class="pkey-cell"><span>${i + 1}</span><b>${isEssay(q) ? '서술' : CIRCLED[it.order.indexOf(q.answer - 1)]}</b></div>`;
        }).join('');
        await full(`<h3 class="sheet-title">정답${opts.exp ? ' 및 해설' : ''} — ${esc(titleTxt)}</h3>${opts.key ? `<div class="pkey-grid">${keyCells}</div>` : ''}`, { breakBefore: true });
        if (opts.exp) {
          await band(set.items.map((it, i) => {
            const q = S.qById.get(it.id);
            const ans = isEssay(q) ? '' : CIRCLED[it.order.indexOf(q.answer - 1)];
            return `<div class="pexp"><p><b>${i + 1}. 정답 ${ans}</b> <span class="muted small">(${esc(unitLabel(q.unit))})</span></p><p>${rich(q.explanation)}</p>${q.source ? `<p class="source"><b>📄</b><span>${esc(q.source)}</span></p>` : ''}</div>`;
          }));
        }
      }
      const pages = doc.getNumberOfPages();
      for (let k = 1; k <= pages; k += 1) {
        doc.setPage(k);
        doc.setFontSize(8);
        doc.setTextColor(120);
        doc.text(`${k} / ${pages}`, PW / 2, PH - 5, { align: 'center' });
      }
      const fname = `${titleTxt.replace(/[\\/:*?"<>|]+/g, '').trim() || 'GMP시험지'}_${set.items.length}문항.pdf`;
      const blob = doc.output('blob');
      const a = document.createElement('a');
      a.href = URL.createObjectURL(blob);
      a.download = fname;
      document.body.appendChild(a);
      a.click();
      setTimeout(() => { URL.revokeObjectURL(a.href); a.remove(); }, 60000);
      say(`PDF 파일을 만들었습니다 (${pages}쪽). 다운로드가 시작되지 않으면 기본 브라우저(Chrome·Safari)에서 다시 눌러 주세요.`);
    } catch (e) {
      say(`PDF를 만들지 못했습니다: ${e.message}`);
    } finally {
      host.remove();
      S.pdfBusy = false;
      if (btn) btn.disabled = false;
    }
  }

  // ---------------------------------------------------------------- 결과
  function hbarsHTML(rows) {
    if (!rows.length) return '<p class="empty">표시할 기록이 없습니다.</p>';
    return `<div class="hbars">${rows.map((r) => `
      <div class="hbar-row">
        <div class="hbar-label">${esc(r.label)}<small>${esc(r.sub || '')}</small></div>
        <div class="hbar-stack">
          ${r.bars.map((b) => `
          <div class="hbar" title="${esc(b.name)} ${fmtNum(b.p)}% (${b.c}/${b.t})">
            <div class="hbar-track"><div class="hbar-fill ${b.cls}" style="width:${b.p}%"></div></div>
            <span class="hbar-val">${fmtNum(b.p)}% <span class="muted">(${b.c}/${b.t})</span></span>
          </div>`).join('')}
        </div>
      </div>`).join('')}</div>`;
  }

  function scoreChartHTML(list) {
    const last = list.slice(-15);
    if (!last.length) return '<p class="empty">아직 기록이 없습니다.</p>';
    const grid = [0, 50, 100].map((v) => `<span style="bottom:${v}%"><em>${v}</em></span>`).join('');
    const startNo = list.length - last.length + 1;
    return `
      <div class="colchart" role="img" aria-label="최근 ${last.length}회 점수 막대 그래프">
        <div class="colchart-grid">${grid}</div>
        ${last.map((h, i) => `
          <div class="col" tabindex="0">
            <div class="col-bar" style="height:${Math.max(1, h.score)}%"></div>
            <span class="col-tip">${startNo + i}회 · ${fmtNum(h.score)}점 · ${esc(MODES[h.mode] ? MODES[h.mode].label : h.mode)}</span>
            ${(i === 0 || i === last.length - 1 || last.length <= 8) ? `<span class="col-x">${startNo + i}회</span>` : ''}
          </div>`).join('')}
      </div>`;
  }

  function historyTableHTML(list, limit) {
    const rows = list.slice(-limit).reverse();
    if (!rows.length) return '';
    const total = list.length;
    return `
      <div class="table-wrap">
        <table class="data">
          <thead><tr><th>회차</th><th>일시</th><th>모드</th><th>범위</th><th class="num">정답</th><th class="num">점수</th></tr></thead>
          <tbody>${rows.map((h, i) => `
            <tr>
              <td>${total - i}회</td>
              <td>${fmtDate(h.ts)}</td>
              <td>${esc(MODES[h.mode] ? MODES[h.mode].label : h.mode)}</td>
              <td>${esc((h.units || []).map(unitLabel).join(', '))}</td>
              <td class="num">${h.correct}/${h.total}</td>
              <td class="num"><b>${fmtNum(h.score)}</b>${h.pending ? ' <span class="muted">(채점 대기)</span>' : ''}</td>
            </tr>`).join('')}</tbody>
        </table>
      </div>`;
  }

  // 학습 모드 결과: 정답 및 해설 목록
  function answerKeyHTML(session) {
    const items = session.items.map((it, i) => ({ it, i })).filter(({ it }) => isDone(it));
    const shown = S.akFilter === 'wrong' ? items.filter(({ it }) => !isCorrect(it)) : items;
    return `
      <section class="card answer-key">
        <div class="ak-head">
          <h2 class="ak-title">ANSWER KEY &amp; EXPLANATIONS · 정답 및 해설</h2>
          <div class="chip-row no-print">
            <button class="chip" type="button" data-action="akfilter" data-value="all" aria-pressed="${S.akFilter === 'all'}">전체 ${items.length}</button>
            <button class="chip" type="button" data-action="akfilter" data-value="wrong" aria-pressed="${S.akFilter === 'wrong'}">틀린 문제만 ${items.filter(({ it }) => !isCorrect(it)).length}</button>
          </div>
        </div>
        <div class="ak-list">
          ${shown.length ? shown.map(({ it, i }) => {
            const q = S.qById.get(it.id);
            const ok = isCorrect(it);
            if (isEssay(q)) {
              return `
              <div class="ak-item ${ok ? 'ok' : 'bad'}">
                <div class="ak-top"><span class="ak-num">${i + 1}.</span><span class="ak-mark">${ok ? '○ 맞음' : '✗ 틀림'}</span>${tagsHTML(q, null)}</div>
                <p class="ak-q">${rich(q.question)}</p>
                ${it.text ? `<div class="my-answer"><p class="ma-title">내 답안</p><p>${rich(it.text)}</p></div>` : ''}
                ${modelAnswerHTML(q)}
                <p class="ak-exp">${rich(q.explanation)}</p>
                ${sourceHTML(q)}
              </div>`;
            }
            const ans = dispOf(it, q.answer - 1);
            const mine = it.pick != null ? dispOf(it, it.pick) : -1;
            return `
            <div class="ak-item ${ok ? 'ok' : 'bad'}">
              <div class="ak-top">
                <span class="ak-num">${i + 1}.</span>
                <span class="ak-ans">정답 ${CIRCLED[ans]}</span>
                <span class="ak-mark">${ok ? '✓ 맞음' : (mine >= 0 ? `✗ 내 답 ${CIRCLED[mine]}` : '✗ 미응답')}</span>
                ${tagsHTML(q, null)}
              </div>
              <details ${ok ? '' : 'open'}>
                <summary>문제 다시 보기</summary>
                <p class="ak-q">${rich(q.question)}</p>
                ${boxHTML(q)}
                <ol class="ak-choices">${it.order.map((orig, disp) => `
                  <li class="${orig === q.answer - 1 ? 'is-correct' : (orig === it.pick ? 'is-wrong' : '')}">
                    <span>${CIRCLED[disp]}</span><span>${rich(q.choices[orig])}</span></li>`).join('')}</ol>
              </details>
              <p class="ak-exp">${rich(q.explanation)}</p>
              ${notesHTML(q, it)}
              ${sourceHTML(q)}
            </div>`;
          }).join('') : '<p class="empty">틀린 문제가 없습니다. 👏</p>'}
        </div>
      </section>`;
  }

  // 시험 결과: 빨간 펜으로 채점한 시험지
  function gradedQuestionHTML(it, i, q) {
    const ok = isCorrect(it);
    const pending = isEssay(q) && it.self == null;
    const mark = pending ? '<span class="red-mark mark-wait" aria-label="채점 대기">?</span>'
      : (ok ? '<span class="red-mark mark-o" aria-label="맞음"></span>' : '<span class="red-mark mark-slash" aria-label="틀림"></span>');
    const stem = `<p class="pq-stem"><span class="pq-no">${mark}${i + 1}.</span> ${rich(q.question)} <span class="pq-tag">(${esc(unitLabel(q.unit))} · ${pointsOf(q)}점)</span></p>`;
    if (isEssay(q)) {
      return `
        <div class="pq graded ${pending ? 'is-pending' : (ok ? 'is-ok' : 'is-bad')}" id="pq-${i}">
          ${stem}
          ${boxHTML(q)}
          <div class="my-answer handwrite-blue"><p class="ma-title">내 답안</p><p>${it.text ? rich(it.text) : '<span class="muted">(작성하지 않음)</span>'}</p></div>
          <div class="pq-exp">
            ${modelAnswerHTML(q)}
            <p>${rich(q.explanation)}</p>
            ${sourceHTML(q)}
            ${(it.text || '').trim() ? `
            <div class="self-grade no-print">
              <span>${pending ? '모범답안과 비교해 채점하세요 →' : '채점 결과 (바꿀 수 있음)'}</span>
              <div class="btn-row">
                <button type="button" class="btn grade-o" data-action="grade-essay" data-i="${i}" data-value="1" aria-pressed="${it.self === true}">○ 맞음 (+${pointsOf(q)}점)</button>
                <button type="button" class="btn grade-x" data-action="grade-essay" data-i="${i}" data-value="0" aria-pressed="${it.self === false}">✗ 틀림</button>
              </div>
            </div>` : '<p class="muted small">작성하지 않은 답안은 0점 처리되었습니다.</p>'}
          </div>
        </div>`;
    }
    const ansDisp = dispOf(it, q.answer - 1);
    const mine = it.pick != null ? dispOf(it, it.pick) : -1;
    return `
      <div class="pq graded ${ok ? 'is-ok' : 'is-bad'}" id="pq-${i}">
        ${stem}
        ${boxHTML(q)}
        <ol class="pq-choices">
          ${it.order.map((orig, disp) => `
            <li><div class="pchoice ${orig === q.answer - 1 ? 'is-key' : ''} ${orig === it.pick ? 'is-picked' : ''}">
              <span class="cnum">${CIRCLED[disp]}</span><span>${rich(q.choices[orig])}</span>
            </div></li>`).join('')}
        </ol>
        <details class="pq-exp" ${ok ? '' : 'open'}>
          <summary><b class="key-red">정답 ${CIRCLED[ansDisp]}</b> · ${ok ? '맞음' : (mine >= 0 ? `내 답 ${CIRCLED[mine]}` : '미응답')} — 해설 ${ok ? '보기' : ''}</summary>
          <p>${rich(q.explanation)}</p>
          ${notesHTML(q, it)}
          ${sourceHTML(q)}
        </details>
      </div>`;
  }

  function renderExamResult(r) {
    const { session: s, entry } = r;
    const groups = partGroups(s);
    const cum = cumulativeByUnit();
    const wrongN = wrongIdsInBank().length;
    const wrongInPaper = s.items.filter((it) => !isCorrect(it) && !(isEssay(S.qById.get(it.id)) && it.self == null)).length;
    const unitRows = Object.keys(entry.byUnit).sort((a, b) => unitIndex(a) - unitIndex(b)).map((k) => {
      const now = entry.byUnit[k];
      const c = cum[k] || now;
      const u = unitOf(k);
      return {
        label: u ? u.week : k,
        sub: u ? u.title : '',
        bars: [
          { name: '이번 회차', cls: 'is-now', p: pct(now.c, now.t), c: now.c, t: now.t },
          { name: '누적', cls: 'is-cum', p: pct(c.c, c.t), c: c.c, t: c.t },
        ],
      };
    });
    const partRows = [1, 2, 3].filter((p) => entry.byPart[p]).map((p) => {
      const v = entry.byPart[p];
      return `<tr><th scope="row">PART ${PARTS[p].roman}</th><td>${esc(PARTS[p].name)}</td><td class="num">${v.c}/${v.t}문항</td><td class="num"><b>${v.e}</b> / ${v.p}점</td><td class="num">${fmtNum(pct(v.e, v.p))}%</td></tr>`;
    }).join('');
    const filter = S.akFilter;
    const visible = (it) => filter !== 'wrong' || !isCorrect(it);
    const scoreHand = `<span class="hand-score">${fmtNum(entry.score)}</span>`;

    $view.innerHTML = `
      <div class="wrap">
        <section class="card result-hero">
          <p class="muted" style="margin:0">${esc(MODES[entry.mode] ? MODES[entry.mode].label : '')} 결과 · ${fmtDate(entry.ts)}${entry.auto ? ' · 시간 종료 자동 제출' : ''}</p>
          <div class="hand-big">${fmtNum(entry.score)}<small>점</small></div>
          <p class="score-sub">100점 환산 · 득점 ${entry.earned} / ${entry.points}점 · ${entry.total}문항 중 <b>${entry.correct}</b>문항 정답 · 소요 ${fmtDur(entry.durationSec)}${entry.newCount ? ` · 신규 ${entry.newCount}문항` : ''}</p>
          ${entry.pending ? `<p class="notice" style="margin:12px 0 0">서술형 ${entry.pending}문항이 채점 대기 중입니다. 아래 시험지에서 모범답안과 비교해 ○/✗를 누르면 점수에 반영됩니다.</p>` : ''}
          <div class="btn-row">
            ${S.owner ? `<button class="btn btn-primary" type="button" data-action="review" ${wrongN ? '' : 'disabled'}>🔁 오답만 다시 풀기 (${wrongN})</button>` : ''}
            <button class="btn" type="button" data-action="home">처음으로</button>
            <button class="btn" type="button" data-action="print">🖨 인쇄</button>
          </div>
        </section>

        <section class="card">
          <h2>파트별 점수</h2>
          <div class="table-wrap"><table class="data"><thead><tr><th>파트</th><th>구성</th><th class="num">정답</th><th class="num">득점</th><th class="num">득점률</th></tr></thead><tbody>${partRows}</tbody></table></div>
        </section>

        <section class="card">
          <h2>주차(단원)별 정답률</h2>
          <div class="hbar-key"><span><i></i>이번 회차</span><span><i class="cum"></i>누적(전체 기록)</span></div>
          ${hbarsHTML(unitRows)}
        </section>
      </div>
      <div class="wrap-wide">
        <div class="graded-tools no-print">
          <div class="chip-row">
            <button class="chip" type="button" data-action="akfilter" data-value="all" aria-pressed="${filter === 'all'}">전체 ${s.items.length}</button>
            <button class="chip" type="button" data-action="akfilter" data-value="wrong" aria-pressed="${filter === 'wrong'}">틀린 문제만 보기 ${wrongInPaper}</button>
          </div>
        </div>
        <article class="paper graded-paper" aria-label="채점된 시험지">
          ${paperHeadHTML(s, scoreHand)}
          ${[1, 2, 3].map((p) => {
            const list = groups[p];
            if (!list.length) return '';
            const shown = list.filter(({ it }) => visible(it));
            return `
            <section class="paper-part">
              ${partTitleHTML(p, list, true)}
              ${shown.length ? `<div class="paper-cols">${shown.map(({ it, i, q }) => gradedQuestionHTML(it, i, q)).join('')}</div>` : '<p class="empty">이 파트는 모두 맞았습니다. 👏</p>'}
            </section>`;
          }).join('')}
          <p class="paper-end">— 끝 —</p>
        </article>
      </div>`;
  }

  function renderResult() {
    const r = S.result;
    if (!r) { go('home', false); return; }
    if (r.session.kind === 'exam') { renderExamResult(r); return; }
    const { session, entry } = r;
    const cum = cumulativeByUnit();
    const wrongN = wrongIdsInBank().length;
    const rows = Object.keys(entry.byUnit).sort((a, b) => unitIndex(a) - unitIndex(b)).map((k) => {
      const now = entry.byUnit[k];
      const c = cum[k] || now;
      const u = unitOf(k);
      return {
        label: u ? u.week : k,
        sub: u ? u.title : '',
        bars: [
          { name: '이번 회차', cls: 'is-now', p: pct(now.c, now.t), c: now.c, t: now.t },
          { name: '누적', cls: 'is-cum', p: pct(c.c, c.t), c: c.c, t: c.t },
        ],
      };
    });

    $view.innerHTML = `
      <div class="wrap">
        <section class="card result-hero">
          <p class="muted" style="margin:0">${esc(MODES[entry.mode] ? MODES[entry.mode].label : '')} 결과 · ${fmtDate(entry.ts)}</p>
          ${entry.total ? `
          <div class="score-big">${fmtNum(entry.score)}<small>점</small></div>
          <p class="score-sub">${entry.total}문항 중 <b>${entry.correct}</b>문항 정답 · 소요 ${fmtDur(entry.durationSec)}${entry.newCount ? ` · 미출제 신규 ${entry.newCount}문항 포함` : ''}</p>`
          : '<p class="empty">푼 문항이 없어 점수를 계산하지 않았습니다.</p>'}
          <div class="btn-row">
            ${S.owner ? `<button class="btn btn-primary" type="button" data-action="review" ${wrongN ? '' : 'disabled'}>🔁 오답만 다시 풀기 (${wrongN})</button>` : ''}
            <button class="btn" type="button" data-action="home">처음으로</button>
            <button class="btn" type="button" data-action="print">🖨 인쇄</button>
          </div>
        </section>

        <section class="card">
          <h2>주차(단원)별 정답률</h2>
          <div class="hbar-key"><span><i></i>이번 회차</span><span><i class="cum"></i>누적(전체 기록)</span></div>
          ${hbarsHTML(rows)}
        </section>

        <section class="card">
          <div class="card-head"><h2>회차별 점수</h2><span class="muted small">최근 ${Math.min(15, S.history.length)}회</span></div>
          ${scoreChartHTML(S.history)}
          ${historyTableHTML(S.history, 10)}
        </section>

        ${answerKeyHTML(session)}
      </div>`;
  }

  // ---------------------------------------------------------------- 기록 화면
  function renderHistory() {
    const cum = cumulativeByUnit();
    const cumP = cumulativeByPart();
    const h = S.history;
    const avg = h.length ? h.reduce((a, x) => a + x.score, 0) / h.length : 0;
    const best = h.length ? Math.max(...h.map((x) => x.score)) : 0;
    const wrongIds = wrongIdsInBank();
    const rows = S.units.map((u) => {
      const c = cum[u.key] || { c: 0, t: 0 };
      const seenN = u.questions.filter((q) => qMeta(q.id).a).length;
      return {
        label: u.week,
        sub: `${u.title} · 출제 ${seenN}/${u.questions.length}`,
        bars: [{ name: '누적 정답률', cls: 'is-now', p: pct(c.c, c.t), c: c.c, t: c.t }],
      };
    });
    const partRows = [1, 2, 3].map((p) => {
      const c = cumP[p] || { c: 0, t: 0 };
      return { label: `PART ${PARTS[p].roman}`, sub: PARTS[p].name, bars: [{ name: '누적 정답률', cls: 'is-now', p: pct(c.c, c.t), c: c.c, t: c.t }] };
    }).filter((r) => r.bars[0].t);
    const wrongByUnit = S.units.map((u) => ({
      u, list: u.questions.filter((q) => wrongIds.includes(q.id)),
    })).filter((x) => x.list.length);

    $view.innerHTML = `
      <div class="wrap">
        <section class="card">
          <h2>학습 기록</h2>
          <div class="stat-tiles">
            <div class="stat-tile"><div class="stat-label">응시 회차</div><div class="stat-value">${h.length}</div></div>
            <div class="stat-tile"><div class="stat-label">평균 점수</div><div class="stat-value">${fmtNum(Math.round(avg * 10) / 10)}</div></div>
            <div class="stat-tile"><div class="stat-label">최고 점수</div><div class="stat-value">${fmtNum(best)}</div></div>
          </div>
        </section>

        <section class="card">
          <h2>주차(단원)별 누적 정답률</h2>
          ${hbarsHTML(rows)}
        </section>

        ${partRows.length ? `
        <section class="card">
          <h2>PART별 누적 정답률</h2>
          ${hbarsHTML(partRows)}
        </section>` : ''}

        <section class="card">
          <div class="card-head"><h2>회차별 점수</h2><span class="muted small">전체 ${h.length}회</span></div>
          ${scoreChartHTML(h)}
          ${historyTableHTML(h, 100)}
        </section>

        <section class="card">
          <div class="card-head"><h2>오답 노트</h2><span class="muted small">${wrongIds.length}문항</span></div>
          ${wrongByUnit.length ? wrongByUnit.map(({ u, list }) => `
            <details>
              <summary><b>${esc(u.week)}</b> ${esc(u.title)} — ${list.length}문항</summary>
              <ul class="small">${list.map((q) => {
                const text = q.box && q.type === '용어' && q.question.startsWith('다음 설명') ? q.box[0] : q.question;
                return `<li>${esc(text.length > 80 ? `${text.slice(0, 80)}…` : text)}
                <span class="muted">(틀린 횟수 ${S.wrong[q.id].n})</span></li>`;
              }).join('')}</ul>
            </details>`).join('') : '<p class="empty">오답 노트가 비어 있습니다.</p>'}
          <div class="btn-row" style="margin-top:12px">
            <button class="btn btn-primary" type="button" data-action="review" ${wrongIds.length ? '' : 'disabled'}>🔁 오답만 다시 풀기</button>
          </div>
        </section>

        <section class="card">
          <h2>초기화</h2>
          <p class="muted small" style="margin-top:0">이 기기(브라우저)에만 저장된 기록입니다. 지우면 되돌릴 수 없습니다.</p>
          <div class="btn-row">
            <button class="btn btn-danger" type="button" data-action="reset" data-what="wrong">오답 노트 비우기</button>
            <button class="btn btn-danger" type="button" data-action="reset" data-what="all">모든 기록 삭제</button>
          </div>
        </section>
        <div class="btn-row"><button class="btn btn-block" type="button" data-action="home">처음으로</button></div>
      </div>`;
  }

  function renderError() {
    const local = location.protocol === 'file:';
    $view.innerHTML = `
      <div class="wrap">
        <div class="notice notice-error">
          <p><b>문제를 불러오지 못했습니다.</b></p>
          <p>${esc(S.loadError || '')}</p>
          ${local ? `<p>파일을 더블클릭해서 열면(file://) 브라우저 보안 정책 때문에 JSON을 읽을 수 없습니다.
            GitHub Pages 주소로 접속하거나, 폴더에서 <code>python3 -m http.server</code> 실행 후
            <code>http://localhost:8000</code> 으로 여세요.</p>` : ''}
          ${S.warnings.length ? `<ul>${S.warnings.map((w) => `<li>${esc(w)}</li>`).join('')}</ul>` : ''}
        </div>
        <button class="btn btn-block" type="button" onclick="location.reload()">다시 시도</button>
      </div>`;
  }

  // ---------------------------------------------------------------- 이벤트
  function toggleOmr(force) {
    const panel = document.getElementById('omrPanel');
    if (!panel) return;
    const open = force != null ? force : !panel.classList.contains('is-open');
    panel.classList.toggle('is-open', open);
    document.body.classList.toggle('omr-open', open);
  }

  document.addEventListener('click', (e) => {
    const el = e.target.closest('[data-action]');
    if (!el || el.disabled) return;
    const a = el.dataset.action;
    const p = S.prefs;
    switch (a) {
      case 'home':
        if ((S.view === 'study' || S.view === 'exam') && S.session && !S.session.finished) {
          if (!confirm('풀이를 잠시 멈추고 처음 화면으로 갈까요?\n진행 상황은 저장되어 이어서 풀 수 있습니다.')) return;
          leaveSession();
        }
        clearHash();
        go('home', false);
        break;
      case 'history':
        if ((S.view === 'study' || S.view === 'exam') && S.session && !S.session.finished) {
          if (!confirm('풀이를 잠시 멈추고 기록 화면으로 갈까요? (진행 상황은 저장됩니다)')) return;
          leaveSession();
        }
        go('history');
        break;
      case 'coverage': go('coverage'); break;
      case 'theme': cycleTheme(); break;
      case 'mode':
        p.mode = el.dataset.value;
        savePrefs();
        renderHome();
        break;
      case 'strategy':
        p.strategy = el.dataset.value;
        savePrefs();
        renderHome();
        break;
      case 'units-all': p.units = S.units.map((u) => u.key); savePrefs(); renderHome(); break;
      case 'units-none': p.units = []; savePrefs(); renderHome(); break;
      case 'count':
        p.count = el.dataset.value === 'all' ? 'all' : Number(el.dataset.value);
        savePrefs();
        renderHome();
        break;
      case 'start': startSession(p.mode); break;
      case 'review': startSession('review'); break;
      case 'resume': {
        const act = store.get('active', null);
        if (!act || act.v !== 2) { renderHome(); return; }
        S.session = act;
        S.session.runningSince = 0;
        go(act.kind === 'exam' ? 'exam' : 'study');
        break;
      }
      case 'discard':
        if (confirm('진행 중인 풀이를 버릴까요? (이미 채점된 학습 모드 답안 기록은 남습니다)')) { store.del('active'); renderHome(); }
        break;
      case 'last-result': {
        const last = store.get('result', null);
        if (!last || (!S.owner && last.session.mode !== 'shared')) { render(); return; }
        S.result = last;
        S.akFilter = 'all';
        go('result');
        break;
      }
      case 'begin': {
        const s = S.session;
        s.started = true;
        s.startedAt = Date.now();
        s.elapsedSec = 0;
        saveActive();
        render();
        window.scrollTo(0, 0);
        break;
      }
      case 'pick': studyPick(Number(el.dataset.disp)); break;
      case 'show-model': {
        const it = S.session.items[S.session.idx];
        const ta = document.querySelector('.essay-input');
        if (ta) it.text = ta.value.slice(0, 4000);
        it.shown = true;
        saveActive();
        renderStudy();
        break;
      }
      case 'study-grade': studyGrade(el.dataset.value === '1'); break;
      case 'grade-essay': gradeEssayInResult(Number(el.dataset.i), el.dataset.value === '1'); break;
      case 'next': studyNext(); break;
      case 'prev':
        if (S.session.idx > 0) { S.session.idx -= 1; saveActive(); renderStudy(); window.scrollTo(0, 0); }
        break;
      case 'quit': {
        const s = S.session;
        if (s.kind === 'study') {
          const answered = s.items.filter(isDone).length;
          if (answered && confirm(`학습을 끝내고 지금까지 푼 ${answered}문항의 결과를 볼까요?\n(취소를 누르면 그대로 계속 풉니다)`)) finishSession();
          else if (!answered && confirm('학습을 끝내고 처음 화면으로 갈까요?')) { store.del('active'); S.session = null; go('home', false); }
        } else if (confirm('시험지를 저장하고 나갈까요? 처음 화면에서 "이어서 풀기"로 남은 시간 그대로 돌아올 수 있습니다.')) {
          leaveSession();
          go('home', false);
        }
        break;
      }
      case 'mark': examMark(Number(el.dataset.i), Number(el.dataset.disp)); break;
      case 'submit': submitExam(); break;
      case 'omr': toggleOmr(); break;
      case 'jump': {
        const t = document.getElementById(`pq-${el.dataset.i}`);
        if (window.matchMedia('(max-width: 1099px)').matches) toggleOmr(false);
        if (t) {
          t.scrollIntoView({ behavior: 'smooth', block: 'start' });
          const ta = t.querySelector('textarea');
          if (ta) setTimeout(() => ta.focus({ preventScroll: true }), 350);
        }
        break;
      }
      case 'print': doPrint(); break;
      case 'do-print': doPrint(); break;
      case 'make-print': makePrintSet(); go('print'); break;
      case 'open-print': S.print = store.get('print', null); go('print'); break;
      case 'share-link': shareLink(); break;
      case 'download-pdf': downloadPdf(el); break;
      case 'open-shared-last': {
        const last = store.get('sharedLast', null);
        if (last) { S.shared = Object.assign({ missing: 0 }, last); go('shared'); }
        break;
      }
      case 'solve-print': if (S.print) startFromSet(S.print); break;
      case 'solve-shared': if (S.shared) startFromSet(S.shared); break;
      case 'print-shared':
        if (S.shared) {
          S.print = { title: S.shared.title, opts: { omr: true, key: true, exp: true }, items: S.shared.items, createdAt: Date.now() };
          store.set('print', S.print);
          clearHash();
          go('print');
        }
        break;
      case 'akfilter': {
        S.akFilter = el.dataset.value;
        const y = window.scrollY;
        renderResult();
        window.scrollTo(0, y);
        break;
      }
      case 'reset':
        if (el.dataset.what === 'wrong') {
          if (!confirm('오답 노트를 모두 비울까요?')) return;
          S.wrong = {};
        } else {
          if (!confirm('오답 노트, 문항별 출제 이력, 회차 기록을 모두 삭제할까요?')) return;
          S.wrong = {}; S.qstats = {}; S.history = []; store.del('active'); store.del('result');
        }
        persist();
        renderHistory();
        break;
      default: break;
    }
  });

  document.addEventListener('submit', async (e) => {
    const form = e.target.closest('[data-action="owner-form"]');
    if (!form) return;
    e.preventDefault();
    const code = form.querySelector('input').value;
    if (await tryOwnerCode(code)) { toast('전체 문제집을 열었습니다'); go('home', false); }
    else { toast('코드가 맞지 않습니다'); }
  });

  document.addEventListener('change', (e) => {
    const el = e.target;
    if (!el.dataset || !el.dataset.action) return;
    const p = S.prefs;
    if (el.dataset.action === 'unit') {
      const keys = new Set(selectedUnitKeys());
      if (el.checked) keys.add(el.value); else keys.delete(el.value);
      p.units = S.units.map((u) => u.key).filter((k) => keys.has(k));
      savePrefs();
      renderHome();
    } else if (el.dataset.action === 'print-opt' && S.print) {
      S.print.opts = Object.assign({}, S.print.opts, { [el.dataset.key]: el.checked });
      store.set('print', S.print);
      const y = window.scrollY;
      renderPrint();
      window.scrollTo(0, y);
    } else if (el.dataset.action === 'opt') {
      p[el.dataset.key] = el.checked;
      savePrefs();
      renderHome();
    }
  });

  document.addEventListener('input', (e) => {
    const t = e.target;
    if (!t.dataset) return;
    if (t.dataset.action === 'print-title' && S.print) {
      S.print.title = t.value.slice(0, 40);
      store.set('print', S.print);
      const title = document.querySelector('.print-paper .paper-title');
      if (title) title.innerHTML = examTitle('shared', S.print.title);
      document.querySelectorAll('.sheet-title').forEach((h) => { h.textContent = h.textContent.replace(/— .*$/, `— ${S.print.title || 'GMP 바이오공정'}`); });
    } else if (t.dataset.action === 'name') {
      S.prefs.name = t.value.slice(0, 40);
      savePrefs();
    } else if (t.dataset.action === 'essay' && S.session) {
      examEssayInput(Number(t.dataset.i), t.value);
    } else if (t.dataset.action === 'study-essay' && S.session) {
      S.session.items[S.session.idx].text = t.value.slice(0, 4000);
      saveActive();
    }
  });

  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && document.body.classList.contains('omr-open')) { toggleOmr(false); return; }
    if (S.view !== 'study' || !S.session || e.altKey || e.ctrlKey || e.metaKey) return;
    if (e.target && /input|textarea|select/i.test(e.target.tagName)) return;
    const s = S.session;
    const item = s.items[s.idx];
    const q = S.qById.get(item.id);
    if (!isEssay(q) && /^[1-9]$/.test(e.key) && item.pick == null) {
      const d = Number(e.key) - 1;
      if (d < q.choices.length) { e.preventDefault(); studyPick(d); }
    } else if ((e.key === 'Enter' || e.key === 'ArrowRight') && isDone(item)) {
      if (e.target && e.target.tagName === 'BUTTON' && e.key === 'Enter') return;
      e.preventDefault();
      studyNext();
    }
  });

  // 창을 닫거나 다른 앱으로 갈 때 경과 시간을 저장(돌아오면 이어서 셈)
  const pause = () => {
    const s = S.session;
    if (S.view !== 'exam' || !s || !s.started || !s.runningSince) return;
    s.elapsedSec = currentElapsed(s);
    s.runningSince = document.visibilityState === 'hidden' ? 0 : Date.now();
    saveActive();
  };
  document.addEventListener('visibilitychange', () => {
    const s = S.session;
    if (document.visibilityState === 'hidden') pause();
    else if (S.view === 'exam' && s && s.started && !s.runningSince) s.runningSince = Date.now();
  });
  window.addEventListener('pagehide', pause);

  window.addEventListener('beforeprint', () => {
    document.querySelectorAll('details').forEach((d) => { d.dataset.wasOpen = d.open ? '1' : ''; d.open = true; });
  });
  window.addEventListener('afterprint', () => {
    document.querySelectorAll('details').forEach((d) => { if (d.dataset.wasOpen === '') d.open = false; });
  });

  // ---------------------------------------------------------------- 시작
  async function init() {
    applyTheme();
    history.replaceState({ view: 'home' }, '');
    try {
      await loadBank();
      await checkOwner();
      S.view = 'home';
      if (/^#set=/.test(location.hash)) {
        S.shared = decodeSet(location.hash);
        if (S.shared.items.length) store.set('sharedLast', { items: S.shared.items, title: S.shared.title, missing: 0, createdAt: S.shared.createdAt });
        S.view = 'shared';
      }
    } catch (err) {
      S.loadError = err.message;
      S.view = 'error';
    }
    render();
  }
  init();
})();
