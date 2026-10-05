/* =========================================================
   GMP 바이오공정 문제집
   - 빌드 도구 없는 정적 앱 (GitHub Pages 배포용)
   - 문제: questions/index.json 에 적힌 JSON 파일들을 불러옴
   - 기록: localStorage (오답 노트, 문항별 이력, 회차 기록, 설정, 진행 중 세션)
   ========================================================= */
(() => {
  'use strict';

  // ---------------------------------------------------------------- 설정
  const CONFIG = {
    course: 'GMP 바이오공정',
    courseEn: 'Bioprocess & GMP',
    questionsDir: 'questions/',
    minutesPerQuestion: 2,     // 시험지 제한 시간 = 문항 수 × 2분
    storagePrefix: 'gmpquiz.v1.',
    historyLimit: 300,
  };
  const CIRCLED = ['①', '②', '③', '④', '⑤', '⑥', '⑦', '⑧', '⑨', '⑩'];
  const COUNT_OPTIONS = [5, 10, 20, 30, 40];
  const MODES = {
    study: { label: '단원별 학습', icon: '📖', kind: 'study', desc: '고르는 즉시 정답·해설·출처 확인' },
    unitExam: { label: '단원별 시험', icon: '📝', kind: 'exam', desc: '시험지로 끝까지 풀고 한꺼번에 채점' },
    mock: { label: '전범위 모의고사', icon: '🎓', kind: 'exam', desc: '전 단원에서 고르게 출제되는 실전 시험지' },
    review: { label: '오답 다시 풀기', icon: '🔁', kind: 'study', desc: '' },
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
    warnings: [],
    loadError: null,
    view: 'loading',
    session: null,      // 진행 중 풀이
    result: null,       // 마지막 결과 {session, entry}
    wrong: store.get('wrong', {}),     // {id: {n, last}}
    qstats: store.get('qstats', {}),   // {id: {a, c, last}}
    history: store.get('history', []), // [{ts, mode, ...}]
    prefs: Object.assign({
      theme: 'auto', mode: 'study', units: null, count: 10,
      shuffleQ: true, shuffleC: true, timer: true, name: '',
    }, store.get('prefs', {})),
    akFilter: 'all',
    timerId: null,
    observer: null,
  };
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
  const qMeta = (id) => S.qstats[id] || { a: 0, c: 0, last: 0 };
  const wrongIdsInBank = () => Object.keys(S.wrong).filter((id) => S.qById.has(id));

  function persist() {
    store.set('wrong', S.wrong);
    store.set('qstats', S.qstats);
    store.set('history', S.history);
  }
  const savePrefs = () => store.set('prefs', S.prefs);
  function saveActive() {
    if (S.session && !S.session.finished) store.set('active', S.session);
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
        const notes = Array.isArray(q.choiceNotes) && q.choiceNotes.length === q.choices.length ? q.choiceNotes : null;
        if (q.choiceNotes && !notes) S.warnings.push(`${file} / ${q.id}: choiceNotes 개수가 보기 개수와 달라 보기별 해설을 숨겼습니다.`);
        const item = {
          id: q.id,
          unit: key,
          type: q.type || '',
          question: q.question,
          box: Array.isArray(q.box) ? q.box.filter((b) => typeof b === 'string') : null,
          choices: q.choices,
          answer: q.answer,
          explanation: q.explanation || '',
          notes,
          source: q.source || '',
        };
        unit.questions.push(item);
        S.qById.set(item.id, item);
      });
    });
    S.units = S.units.filter((u) => u.questions.length);
    if (!S.units.length) throw new Error('불러온 문항이 없습니다. questions 폴더의 JSON 파일을 확인하세요.');
  }

  // ---------------------------------------------------------------- 출제(문항 선택)
  // 미출제(한 번도 안 푼) 문항 → 오답 노트 문항 → 오래전에 푼 문항 순으로 우선 출제
  function prioritized(pool) {
    const unseen = shuffle(pool.filter((q) => !qMeta(q.id).a));
    const wrongSeen = shuffle(pool.filter((q) => qMeta(q.id).a && S.wrong[q.id]));
    const SIX_HOURS = 6 * 3600 * 1000;
    const rest = pool.filter((q) => qMeta(q.id).a && !S.wrong[q.id])
      .map((q) => [q, qMeta(q.id).last + Math.random() * SIX_HOURS])
      .sort((a, b) => a[1] - b[1])
      .map((x) => x[0]);
    return [...unseen, ...wrongSeen, ...rest];
  }

  // 전범위 모의고사: 단원 크기에 비례해 문항 수 배분(각 단원 최소 1문항)
  function allocate(units, n) {
    const sizes = units.map((u) => u.questions.length);
    const total = sizes.reduce((a, b) => a + b, 0);
    if (n >= total) return sizes.slice();
    if (n < units.length) {
      const pickIdx = new Set(shuffle(range(units.length)).slice(0, n));
      return sizes.map((_, i) => (pickIdx.has(i) ? 1 : 0));
    }
    const exact = sizes.map((s) => (n * s) / total);
    const q = exact.map((x, i) => Math.min(sizes[i], Math.max(1, Math.floor(x))));
    let sum = q.reduce((a, b) => a + b, 0);
    const byFrac = range(units.length).sort((a, b) => (exact[b] - Math.floor(exact[b])) - (exact[a] - Math.floor(exact[a])));
    let guard = 0;
    while (sum < n && guard++ < 1000) {
      for (const i of byFrac) { if (sum >= n) break; if (q[i] < sizes[i]) { q[i]++; sum++; } }
    }
    while (sum > n && guard++ < 2000) {
      const i = range(units.length).filter((k) => q[k] > 1).sort((a, b) => q[b] - q[a])[0];
      if (i == null) break;
      q[i]--; sum--;
    }
    return q;
  }

  function buildSession(mode, unitKeys, count) {
    const p = S.prefs;
    const kind = MODES[mode].kind;
    let picked = [];
    let poolSize = 0;
    let unseenInPool = 0;

    if (mode === 'review') {
      const pool = wrongIdsInBank().map((id) => S.qById.get(id));
      poolSize = pool.length;
      picked = shuffle(pool);
    } else if (mode === 'mock') {
      const units = S.units;
      const quotas = allocate(units, count);
      units.forEach((u, i) => {
        poolSize += u.questions.length;
        unseenInPool += u.questions.filter((q) => !qMeta(q.id).a).length;
        picked.push(...prioritized(u.questions).slice(0, quotas[i]));
      });
    } else {
      const pool = S.units.filter((u) => unitKeys.includes(u.key)).flatMap((u) => u.questions);
      poolSize = pool.length;
      unseenInPool = pool.filter((q) => !qMeta(q.id).a).length;
      picked = prioritized(pool).slice(0, count);
    }

    const unitOrder = S.units.map((u) => u.key);
    if (p.shuffleQ || mode === 'review') picked = shuffle(picked);
    else picked.sort((a, b) => unitOrder.indexOf(a.unit) - unitOrder.indexOf(b.unit));

    const items = picked.map((q) => ({
      id: q.id,
      order: p.shuffleC ? shuffle(range(q.choices.length)) : range(q.choices.length),
      pick: null,
      isNew: !qMeta(q.id).a,
    }));
    const usedUnits = unitOrder.filter((k) => picked.some((q) => q.unit === k));
    return {
      v: 1,
      mode,
      kind,
      units: usedUnits,
      items,
      idx: 0,
      startedAt: Date.now(),
      timeLimitSec: kind === 'exam' && p.timer ? items.length * CONFIG.minutesPerQuestion * 60 : 0,
      newCount: items.filter((it) => it.isNew).length,
      poolSize,
      unseenInPool,
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

  function isCorrect(item) {
    const q = S.qById.get(item.id);
    return item.pick != null && item.pick === q.answer - 1;
  }

  function finishSession() {
    const s = S.session;
    if (!s) return;
    const now = Date.now();
    if (s.kind === 'exam') {
      s.items.forEach((it) => { it.graded = true; recordAnswer(it.id, isCorrect(it), now); });
    }
    const counted = s.kind === 'exam' ? s.items : s.items.filter((it) => it.pick != null);
    const byUnit = {};
    counted.forEach((it) => {
      const u = S.qById.get(it.id).unit;
      byUnit[u] = byUnit[u] || { c: 0, t: 0 };
      byUnit[u].t += 1;
      if (isCorrect(it)) byUnit[u].c += 1;
    });
    const correct = counted.filter(isCorrect).length;
    const entry = {
      ts: now,
      mode: s.mode,
      units: s.units,
      total: counted.length,
      correct,
      score: pct(correct, counted.length),
      durationSec: Math.round((now - s.startedAt) / 1000),
      newCount: s.newCount,
      byUnit,
    };
    s.finished = true;
    s.finishedAt = now;
    if (counted.length) {
      S.history.push(entry);
      if (S.history.length > CONFIG.historyLimit) S.history = S.history.slice(-CONFIG.historyLimit);
    }
    persist();
    store.del('active');
    S.result = { session: s, entry };
    S.session = null;
    S.akFilter = 'all';
    go('result');
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

  // ---------------------------------------------------------------- 화면 전환
  function stopTimers() {
    if (S.timerId) { clearInterval(S.timerId); S.timerId = null; }
    if (S.observer) { S.observer.disconnect(); S.observer = null; }
  }

  function go(view, push = true) {
    stopTimers();
    S.view = view;
    if (push && view !== 'home') history.pushState({ view }, '');
    render();
    window.scrollTo(0, 0);
  }

  function render() {
    stopTimers();
    switch (S.view) {
      case 'home': renderHome(); break;
      case 'study': renderStudy(); break;
      case 'exam': renderExam(); break;
      case 'result': renderResult(); break;
      case 'history': renderHistory(); break;
      case 'error': renderError(); break;
      default: break;
    }
  }

  window.addEventListener('popstate', () => {
    if ((S.view === 'study' || S.view === 'exam') && S.session && !S.session.finished) {
      if (!confirm('풀이를 잠시 멈추고 처음 화면으로 갈까요?\n진행 상황은 저장되어 이어서 풀 수 있습니다.')) {
        history.pushState({ view: S.view }, '');
        return;
      }
      saveActive();
      S.session = null;
    }
    go('home', false);
  });

  // ---------------------------------------------------------------- 홈
  function selectedUnitKeys() {
    const all = S.units.map((u) => u.key);
    const sel = Array.isArray(S.prefs.units) ? S.prefs.units.filter((k) => all.includes(k)) : all;
    return sel;
  }

  function poolFor(mode) {
    if (mode === 'mock') return S.units.flatMap((u) => u.questions);
    if (mode === 'review') return wrongIdsInBank().map((id) => S.qById.get(id));
    const keys = selectedUnitKeys();
    return S.units.filter((u) => keys.includes(u.key)).flatMap((u) => u.questions);
  }

  function renderHome() {
    const p = S.prefs;
    if (!MODES[p.mode] || p.mode === 'review') p.mode = 'study';
    const mode = p.mode;
    const keys = selectedUnitKeys();
    const pool = poolFor(mode);
    const poolN = pool.length;
    const count = p.count === 'all' ? poolN : Math.min(p.count, poolN);
    const unseen = pool.filter((q) => !qMeta(q.id).a).length;
    const totalQ = S.units.reduce((a, u) => a + u.questions.length, 0);
    const seenAll = S.units.reduce((a, u) => a + u.questions.filter((q) => qMeta(q.id).a).length, 0);
    const wrongN = wrongIdsInBank().length;
    const active = store.get('active', null);
    const activeOk = active && Array.isArray(active.items) && active.items.length &&
      active.items.every((it) => S.qById.has(it.id));
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

    const minutes = count * CONFIG.minutesPerQuestion;
    const summary = poolN
      ? `${MODES[mode].label} · ${count}문항${MODES[mode].kind === 'exam' && p.timer ? ` · 제한 ${minutes}분` : ''} · ${unseen ? `미출제 우선 출제 (범위 내 미출제 ${unseen}문항)` : '범위 내 모든 문항 출제됨 → 오답·오래된 문항 우선'}`
      : '범위를 하나 이상 선택하세요';

    $view.innerHTML = `
      <div class="wrap">
        <section class="hero">
          <h1>복습 문제집</h1>
          <p>강의 PDF를 바탕으로 만든 5지선다 문항입니다. 단원별로 공부하거나 전범위 모의고사로 실전 연습을 하세요.</p>
        </section>

        ${S.warnings.length ? `
        <details class="notice warnings">
          <summary>⚠️ 문제 파일 확인 필요 (${S.warnings.length}건)</summary>
          <ul>${S.warnings.map((w) => `<li>${esc(w)}</li>`).join('')}</ul>
        </details>` : ''}

        ${activeOk ? `
        <div class="resume">
          <p>진행 중인 ${esc(MODES[active.mode] ? MODES[active.mode].label : '풀이')}가 있습니다
            (${active.items.filter((it) => it.pick != null).length} / ${active.items.length} 답함)</p>
          <div class="btn-row">
            <button class="btn btn-primary" type="button" data-action="resume">이어서 풀기</button>
            <button class="btn btn-ghost" type="button" data-action="discard">버리기</button>
          </div>
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
            출제 현황: 전체 ${totalQ}문항 중 <b>${seenAll}</b>문항 출제됨 · 남은 미출제 ${totalQ - seenAll}문항
            <div class="coverage-bar" role="img" aria-label="출제 비율 ${fmtNum(pct(seenAll, totalQ))}%"><span style="width:${pct(seenAll, totalQ)}%"></span></div>
            ${totalQ && seenAll === totalQ ? '<span class="muted small">모든 문항이 한 번 이상 출제되었습니다. 이제 오답·오래된 문항 위주로 구성됩니다.</span>' : ''}
          </div>
        </section>

        <section class="card">
          <div class="card-head"><h2>3. 문제 수</h2><span class="muted small">선택 범위 ${poolN}문항</span></div>
          <div class="chip-row" role="group" aria-label="문제 수">${poolN ? countChips : '<span class="muted">선택된 범위에 문항이 없습니다.</span>'}</div>
        </section>

        <section class="card">
          <div class="card-head"><h2>4. 옵션</h2></div>
          ${switchRow('shuffleQ', '문제 순서 섞기', '매번 다른 순서로 출제')}
          ${switchRow('shuffleC', '보기 순서 섞기', '보기를 섞어도 정답 판정은 정확히 유지')}
          ${MODES[mode].kind === 'exam' ? switchRow('timer', '제한 시간 표시', `문항당 ${CONFIG.minutesPerQuestion}분 (시간이 지나도 계속 풀 수 있음)`) : ''}
        </section>

        <section class="card">
          <div class="card-head"><h2>오답 노트</h2><span class="muted small">${wrongN}문항</span></div>
          <p class="muted small" style="margin:0 0 12px">틀린 문제는 자동으로 저장되고, 다시 맞히면 오답 노트에서 빠집니다.</p>
          <button class="btn btn-block" type="button" data-action="review" ${wrongN ? '' : 'disabled'}>🔁 오답만 다시 풀기 (${wrongN})</button>
        </section>

        <div class="start-bar">
          <p class="start-summary">${esc(summary)}</p>
          <button class="btn btn-primary btn-block" type="button" data-action="start" ${poolN ? '' : 'disabled'}>시작하기</button>
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
    const pool = poolFor(mode);
    if (!pool.length) return;
    const count = mode === 'review' ? pool.length
      : (S.prefs.count === 'all' ? pool.length : Math.min(S.prefs.count, pool.length));
    store.del('active');
    S.session = buildSession(mode, selectedUnitKeys(), count);
    saveActive();
    go(S.session.kind === 'exam' ? 'exam' : 'study');
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
      ${q.type ? `<span class="tag">${esc(q.type)}</span>` : ''}
      ${item && item.isNew ? '<span class="tag tag-new">미출제</span>' : ''}`;
  }
  // 섞인 표시 순서 기준으로 보기별 해설과 정답 번호를 만든다
  function notesHTML(q, item) {
    if (!q.notes) return '';
    return `<ul class="notes">${item.order.map((orig, disp) => `
      <li class="${orig === q.answer - 1 ? 'is-answer' : ''}"><span class="nnum">${CIRCLED[disp]}</span><span>${rich(q.notes[orig])}</span></li>`).join('')}</ul>`;
  }
  const dispOf = (item, orig) => item.order.indexOf(orig);
  function sourceHTML(q) {
    return q.source ? `<p class="source"><b>📄 출처</b><span>${esc(q.source)}</span></p>` : '';
  }

  // ---------------------------------------------------------------- 학습 모드
  function renderStudy() {
    const s = S.session;
    if (!s) { go('home', false); return; }
    const item = s.items[s.idx];
    const q = S.qById.get(item.id);
    const n = s.items.length;
    const answered = s.items.filter((it) => it.pick != null).length;
    const correctN = s.items.filter((it) => it.pick != null && isCorrect(it)).length;
    const done = item.pick != null;
    const ok = done && isCorrect(item);
    const ansDisp = dispOf(item, q.answer - 1);

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

    const last = s.idx === n - 1;
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
          <ol class="choices">${choices}</ol>
          ${done ? `
          <section class="feedback ${ok ? 'ok' : 'bad'}" aria-live="polite">
            <p class="fb-title">${ok ? '✓ 정답입니다' : `✗ 오답입니다 — 정답은 ${CIRCLED[ansDisp]}`}</p>
            <p class="fb-exp">${rich(q.explanation)}</p>
            ${notesHTML(q, item)}
            ${sourceHTML(q)}
          </section>` : ''}
        </article>
        <div class="study-actions">
          ${done ? `<button class="btn btn-primary btn-block" type="button" data-action="next">${last ? '결과 보기' : '다음 문제 →'}</button>` : ''}
          ${s.idx > 0 ? `<button class="btn btn-ghost btn-block" type="button" data-action="prev" style="margin-top:8px">← 이전 문제 보기</button>` : ''}
          <p class="kbd-hint">PC: 숫자키 1–${q.choices.length}로 선택, Enter로 다음</p>
        </div>
      </div>`;
    if (done) {
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

  function studyNext() {
    const s = S.session;
    if (s.items[s.idx].pick == null) return;
    if (s.idx >= s.items.length - 1) { finishSession(); return; }
    s.idx += 1;
    saveActive();
    renderStudy();
    window.scrollTo(0, 0);
  }

  // ---------------------------------------------------------------- 시험 모드 (시험지)
  function examTitle(mode) {
    return mode === 'mock' ? '전범위 모의고사 / Full-Range Mock Exam' : '단원 평가 / Unit Exam';
  }

  function renderExam() {
    const s = S.session;
    if (!s) { go('home', false); return; }
    const n = s.items.length;
    const per = 100 / n;
    const perTxt = fmtNum(Math.round(per * 10) / 10);
    const answered = s.items.filter((it) => it.pick != null).length;
    const unitsTxt = s.units.map(unitLabel).join(' · ');
    const minutes = Math.round(s.timeLimitSec / 60);

    const qs = s.items.map((item, i) => {
      const q = S.qById.get(item.id);
      return `
        <div class="pq" id="pq-${i}" data-i="${i}">
          <p class="pq-stem">${i + 1}. ${rich(q.question)} <span class="pq-tag">(${esc(unitLabel(q.unit))}${q.type ? ` · ${esc(q.type)}` : ''} · ${perTxt}점)</span></p>
          ${boxHTML(q)}
          <ol class="pq-choices">
            ${item.order.map((orig, disp) => `
              <li><button type="button" class="pchoice" data-action="mark" data-i="${i}" data-disp="${disp}" aria-pressed="${item.pick === orig}"
                   aria-label="${i + 1}번 문항 ${disp + 1}번 보기">
                <span class="cnum" aria-hidden="true">${CIRCLED[disp]}</span><span>${rich(q.choices[orig])}</span>
              </button></li>`).join('')}
          </ol>
        </div>`;
    }).join('');

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
              <button class="btn" type="button" data-action="omr">답안지</button>
              <button class="btn btn-primary" type="button" data-action="submit">제출</button>
            </span>
          </div>
        </div>
      </div>
      <div class="wrap-wide">
        <article class="paper" aria-label="시험지">
          <header class="paper-head">
            <p class="paper-course">${esc(CONFIG.course)} <span style="font-weight:600">${esc(CONFIG.courseEn)}</span></p>
            <p class="paper-title">${examTitle(s.mode)}</p>
            <p class="paper-info">${esc(unitsTxt)} &nbsp;|&nbsp; ${s.timeLimitSec ? `Time: ${minutes}분 &nbsp;|&nbsp; ` : ''}${n}문항 &nbsp;|&nbsp; 100점</p>
            <table class="paper-id">
              <tr>
                <th scope="row">이름</th><td><input type="text" data-action="name" value="${esc(S.prefs.name)}" aria-label="이름" autocomplete="name"></td>
                <th scope="row">응시일</th><td>${fmtDate(s.startedAt, false)}</td>
                <th scope="row">점수</th><td>&nbsp;</td>
              </tr>
            </table>
            <p class="paper-inst"><b>Instructions:</b> 모든 문항은 5지선다형이며 가장 적절한 답 하나를 고르시오. 각 문항의 배점은 ( ) 안에 표시되어 있습니다.
              「&lt;보기&gt;에서 있는 대로 고른 것」 문항은 옳은 진술을 빠짐없이 포함한 선지만 정답입니다. 정답과 해설(문항별 PDF 출처 포함)은 제출 후 시험지 끝에 첨부됩니다.
              ${s.newCount ? `<br><b>이번 시험지에는 미출제 신규 문항 ${s.newCount}개가 포함되어 있습니다.</b>` : ''}</p>
          </header>
          <section class="paper-part">
            <h3 class="part-title">PART I. 객관식 (${Number.isInteger(per) ? `${n} × ${per} = 100점` : `${n}문항 · 100점 만점, 문항당 약 ${perTxt}점`})</h3>
            <p class="part-note">Choose the BEST answer. 공정 전체의 흐름(원인 → 공정 변수 → 품질 영향 → 조치)을 따라 판단하시오.</p>
            <div class="paper-cols">${qs}</div>
            <p class="paper-end">— 끝 —</p>
          </section>
        </article>
        <div class="btn-row no-print" style="margin-top:16px">
          <button class="btn" type="button" data-action="print">🖨 시험지 인쇄</button>
          <button class="btn" type="button" data-action="quit">나가기 (저장됨)</button>
          <button class="btn btn-primary" type="button" data-action="submit">제출하고 채점하기</button>
        </div>
      </div>
      <div class="omr" id="omr" hidden>
        <div class="omr-head"><h3>답안지 (번호를 누르면 이동)</h3><button class="btn" type="button" data-action="omr">닫기</button></div>
        <div class="omr-grid" id="omrGrid"></div>
      </div>`;
    updateOmr();
    startExamTimer();
    observeQuestions();
  }

  function updateOmr() {
    const s = S.session;
    const grid = document.getElementById('omrGrid');
    if (!grid || !s) return;
    grid.innerHTML = s.items.map((it, i) => {
      const disp = it.pick != null ? dispOf(it, it.pick) : -1;
      return `<button type="button" class="omr-cell ${disp >= 0 ? 'is-answered' : ''}" data-action="jump" data-i="${i}">
        ${i + 1}<small>${disp >= 0 ? CIRCLED[disp] : '·'}</small></button>`;
    }).join('');
  }

  function examMark(i, disp) {
    const s = S.session;
    const item = s.items[i];
    const orig = item.order[disp];
    item.pick = item.pick === orig ? null : orig; // 같은 보기를 다시 누르면 선택 취소
    saveActive();
    const block = document.getElementById(`pq-${i}`);
    if (block) {
      block.querySelectorAll('.pchoice').forEach((b) => {
        b.setAttribute('aria-pressed', String(item.order[Number(b.dataset.disp)] === item.pick));
      });
    }
    const answered = s.items.filter((it) => it.pick != null).length;
    const bar = document.getElementById('examBar');
    if (bar) bar.style.width = `${(answered / s.items.length) * 100}%`;
    const ac = document.getElementById('ansCount');
    if (ac) ac.textContent = answered;
    updateOmr();
  }

  function startExamTimer() {
    const s = S.session;
    const el = document.getElementById('timer');
    if (!s || !s.timeLimitSec || !el) return;
    const tick = () => {
      const left = s.timeLimitSec - (Date.now() - s.startedAt) / 1000;
      if (left >= 0) { el.textContent = `남은 ${fmtDur(left)}`; el.classList.remove('is-over'); }
      else { el.textContent = `시간 초과 +${fmtDur(-left)}`; el.classList.add('is-over'); }
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
    const left = s.items.filter((it) => it.pick == null).length;
    const msg = left
      ? `아직 답하지 않은 문항이 ${left}개 있습니다. 미응답은 오답으로 처리됩니다.\n제출하고 채점할까요?`
      : '답안을 제출하고 채점할까요?';
    if (!confirm(msg)) return;
    finishSession();
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
              <td class="num"><b>${fmtNum(h.score)}</b></td>
            </tr>`).join('')}</tbody>
        </table>
      </div>`;
  }

  function answerKeyHTML(session) {
    const items = session.items.map((it, i) => ({ it, i })).filter(({ it }) =>
      session.kind === 'exam' || it.pick != null);
    const shown = S.akFilter === 'wrong' ? items.filter(({ it }) => !isCorrect(it)) : items;
    return `
      <section class="card answer-key">
        <div class="ak-head">
          <h2 class="ak-title">ANSWER KEY &amp; EXPLANATIONS · 정답 및 해설</h2>
          <div class="chip-row no-print">
            <button class="chip" type="button" data-action="akfilter" data-value="all" aria-pressed="${S.akFilter === 'all'}">전체 ${items.length}</button>
            <button class="chip" type="button" data-action="akfilter" data-value="wrong" aria-pressed="${S.akFilter === 'wrong'}">틀린 문제 ${items.filter(({ it }) => !isCorrect(it)).length}</button>
          </div>
        </div>
        <div class="ak-list">
          ${shown.length ? shown.map(({ it, i }) => {
            const q = S.qById.get(it.id);
            const ok = isCorrect(it);
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

  function renderResult() {
    const r = S.result;
    if (!r) { go('home', false); return; }
    const { session, entry } = r;
    const cum = cumulativeByUnit();
    const wrongN = wrongIdsInBank().length;
    const rows = Object.keys(entry.byUnit).sort((a, b) =>
      S.units.findIndex((u) => u.key === a) - S.units.findIndex((u) => u.key === b)).map((k) => {
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
            <button class="btn btn-primary" type="button" data-action="review" ${wrongN ? '' : 'disabled'}>🔁 오답만 다시 풀기 (${wrongN})</button>
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
              <ul class="small">${list.map((q) => `<li>${esc(q.question.length > 80 ? `${q.question.slice(0, 80)}…` : q.question)}
                <span class="muted">(틀린 횟수 ${S.wrong[q.id].n})</span></li>`).join('')}</ul>
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
  document.addEventListener('click', (e) => {
    const el = e.target.closest('[data-action]');
    if (!el || el.disabled) return;
    const a = el.dataset.action;
    const p = S.prefs;
    switch (a) {
      case 'home':
        if ((S.view === 'study' || S.view === 'exam') && S.session && !S.session.finished) {
          if (!confirm('풀이를 잠시 멈추고 처음 화면으로 갈까요?\n진행 상황은 저장되어 이어서 풀 수 있습니다.')) return;
          saveActive();
          S.session = null;
        }
        go('home', false);
        break;
      case 'history':
        if ((S.view === 'study' || S.view === 'exam') && S.session && !S.session.finished) {
          if (!confirm('풀이를 잠시 멈추고 기록 화면으로 갈까요? (진행 상황은 저장됩니다)')) return;
          saveActive();
          S.session = null;
        }
        go('history');
        break;
      case 'theme': cycleTheme(); break;
      case 'mode':
        p.mode = el.dataset.value;
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
        if (!act) { renderHome(); return; }
        S.session = act;
        go(act.kind === 'exam' ? 'exam' : 'study');
        break;
      }
      case 'discard':
        if (confirm('진행 중인 풀이를 버릴까요? (이미 채점된 학습 모드 답안 기록은 남습니다)')) { store.del('active'); renderHome(); }
        break;
      case 'pick': studyPick(Number(el.dataset.disp)); break;
      case 'next': studyNext(); break;
      case 'prev':
        if (S.session.idx > 0) { S.session.idx -= 1; saveActive(); renderStudy(); window.scrollTo(0, 0); }
        break;
      case 'quit': {
        const s = S.session;
        if (s.kind === 'study') {
          const answered = s.items.filter((it) => it.pick != null).length;
          if (answered && confirm(`학습을 끝내고 지금까지 푼 ${answered}문항의 결과를 볼까요?\n(취소를 누르면 그대로 계속 풉니다)`)) finishSession();
          else if (!answered && confirm('학습을 끝내고 처음 화면으로 갈까요?')) { store.del('active'); S.session = null; go('home', false); }
        } else if (confirm('시험지를 저장하고 나갈까요? 처음 화면에서 "이어서 풀기"로 돌아올 수 있습니다.')) {
          saveActive(); S.session = null; go('home', false);
        }
        break;
      }
      case 'mark': examMark(Number(el.dataset.i), Number(el.dataset.disp)); break;
      case 'submit': submitExam(); break;
      case 'omr': {
        const o = document.getElementById('omr');
        if (o) o.hidden = !o.hidden;
        break;
      }
      case 'jump': {
        const t = document.getElementById(`pq-${el.dataset.i}`);
        document.getElementById('omr').hidden = true;
        if (t) t.scrollIntoView({ behavior: 'smooth', block: 'start' });
        break;
      }
      case 'print': window.print(); break;
      case 'akfilter': S.akFilter = el.dataset.value; renderResult(); break;
      case 'reset':
        if (el.dataset.what === 'wrong') {
          if (!confirm('오답 노트를 모두 비울까요?')) return;
          S.wrong = {};
        } else {
          if (!confirm('오답 노트, 문항별 출제 이력, 회차 기록을 모두 삭제할까요?')) return;
          S.wrong = {}; S.qstats = {}; S.history = []; store.del('active');
        }
        persist();
        renderHistory();
        break;
      default: break;
    }
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
    } else if (el.dataset.action === 'opt') {
      p[el.dataset.key] = el.checked;
      savePrefs();
      renderHome();
    }
  });

  document.addEventListener('input', (e) => {
    if (e.target.dataset && e.target.dataset.action === 'name') {
      S.prefs.name = e.target.value.slice(0, 40);
      savePrefs();
    }
  });

  document.addEventListener('keydown', (e) => {
    if (S.view !== 'study' || !S.session || e.altKey || e.ctrlKey || e.metaKey) return;
    if (e.target && /input|textarea|select/i.test(e.target.tagName)) return;
    const s = S.session;
    const item = s.items[s.idx];
    const q = S.qById.get(item.id);
    if (/^[1-9]$/.test(e.key) && item.pick == null) {
      const d = Number(e.key) - 1;
      if (d < q.choices.length) { e.preventDefault(); studyPick(d); }
    } else if ((e.key === 'Enter' || e.key === 'ArrowRight') && item.pick != null) {
      if (e.target && e.target.tagName === 'BUTTON' && e.key === 'Enter') return;
      e.preventDefault();
      studyNext();
    }
  });

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
      S.view = 'home';
    } catch (err) {
      S.loadError = err.message;
      S.view = 'error';
    }
    render();
  }
  init();
})();
