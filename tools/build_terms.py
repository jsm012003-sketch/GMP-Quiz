#!/usr/bin/env python3
"""용어집(glossary/*.json) → 용어 정리 문항(questions/terms-*.json) 생성기.

한 용어당 한 문항(아래 d 또는 r 중 하나)과, 같은 묶음(group) 용어 4개씩 짝짓기 문항을 만든다.
방향(2026.10, 문항 수 절반으로): 약어·기호 용어(MCB, TMP, LRV, kLa …)는 r — 약어를 보고 뜻을 떠올리는 연습,
낱말 용어(Clarification, Grade A, 최종멸균법 …)는 d — 설명을 보고 이름을 떠올리는 연습. 용어에 "drill": "d"|"r"로 직접 정할 수 있다.
  <prefix>d-<no>  정의 → 용어   ("다음 설명에 해당하는 용어는?")
  <prefix>r-<no>  용어 → 정의   ("「용어」에 대한 설명으로 옳은 것은?")
  <prefix>m-<no>-<no>-<no>-<no>  용어 (가)~(라) ↔ 설명 A~D 짝짓기
  <prefix>s-<no>  단답형 — 설명을 보고 용어를 직접 쓴다("short": true 인 핵심 용어만, PART III, 2026.10.08)
     정답 목록은 용어 이름에서 만든다: 'MCB (Master Cell Bank)' → MCB · Master Cell Bank · 전체 표기.
     괄호가 다른 이름이 아니라 설명일 때('Grade A (충전 지점)')는 "answers"로 정답 목록을 직접 주고,
     덧붙일 표기는 "answersExtra"에 넣는다.

id는 용어 번호(no)로만 정해지므로 용어를 추가해도 기존 id는 바뀌지 않는다.
(짝짓기 묶음은 남는 용어를 다음 묶음으로 채우므로, 기존 용어집 끝에 용어를 덧붙일 때는
 용어집 머리에 "matchSealed": <덧붙이기 전 마지막 no>를 적어 기존 짝짓기 id를 그대로 둔다.)
지엽적이라 걸러 낸 용어는 지우지 말고 "drop": true 를 붙인다 — 번호(no)는 그대로 예약되고 문항·오답 선지에서 빠진다.
오답 선지는 같은 group(헷갈리기 쉬운 묶음)에서 2개, 같은 단원의 다른 group에서 2개를
고른다. 선지 선택·정답 위치는 id로 시드를 정해 매번 같은 결과가 나온다.

사용법: python3 tools/build_terms.py   (저장소 루트에서)
"""
import hashlib
import re
import json
import random
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
GLOSSARY = ROOT / 'glossary'
QDIR = ROOT / 'questions'
LABELS = ['(가)', '(나)', '(다)', '(라)']
LETTERS = ['A', 'B', 'C', 'D']


def rng_for(key):
    return random.Random(int(hashlib.md5(key.encode('utf-8')).hexdigest()[:12], 16))


def drill_kind(t):
    """이 용어에서 만들 문항 방향: 'd'(정의 → 용어) 또는 'r'(용어 → 정의)."""
    name = short(t['term'])
    acronym = re.search(r'[A-Z]{2,}', name) or re.fullmatch(r'[A-Za-z0-9/₂ .-]{1,6}', name)
    return t.get('drill') or ('r' if acronym else 'd')


def short(term):
    """'MCB (Master Cell Bank)' → 'MCB' : 해설·개념 키용 짧은 이름."""
    return term.split(' (')[0].strip()


def concept_key(label):
    return ''.join(ch for ch in short(label).lower() if ch.isalnum())


SAME_GROUP = 2   # 오답 선지 4개 중 같은 묶음(헷갈리는 용어)에서 고를 개수 — 나머지는 다른 묶음에서


def pick_distractors(term, terms, rng, k=4):
    """오답 선지: 같은 group에서 SAME_GROUP개, 나머지는 다른 group에서 고른다.
    (모두 같은 묶음에서 고르면 너무 어려워서, 2026.10 난이도 조정 때 절반으로 줄였다)"""
    same = [t for t in terms if t['group'] == term['group'] and t['no'] != term['no']]
    other = [t for t in terms if t['group'] != term['group']]
    rng.shuffle(same)
    rng.shuffle(other)
    ok = lambda t: short(t['term']) != short(term['term']) and t['def'] != term['def']
    out = [t for t in same if ok(t)][:SAME_GROUP]
    for t in other + same:
        if len(out) >= k:
            break
        if t not in out and ok(t):
            out.append(t)
    return out


class Spreader:
    """정답 위치가 한쪽으로 몰리지 않도록 1..5를 고르게 돌려 쓴다."""

    def __init__(self, seed):
        self.rng = random.Random(seed)
        self.bag = []

    def next(self, n):
        if not self.bag:
            self.bag = list(range(n))
            self.rng.shuffle(self.bag)
        return self.bag.pop()


def place(correct, wrongs, pos):
    choices = wrongs[:]
    choices.insert(pos, correct)
    return choices


def build_def_to_term(t, terms, g, spread):
    qid = f"{g['prefix']}d-{t['no']:03d}"
    rng = rng_for(qid)
    ds = pick_distractors(t, terms, rng)
    pos = spread.next(len(ds) + 1)
    items = place(t, ds, pos)
    expl = f"**{t['term']}** — {t['def']}"
    if t.get('note'):
        expl += f"\n{t['note']}"
    notes = []
    for x in items:
        if x is t:
            notes.append(f"정답 — {t['def']}")
        else:
            notes.append(f"틀리다 — {x['term']}: {x['def']}")
    return {
        'id': qid, 'type': '용어', 'part': 1,
        'question': '다음 설명에 해당하는 용어는?',
        'box': [t['def']],
        'choices': [x['term'] for x in items],
        'answer': pos + 1,
        'explanation': expl,
        'choiceNotes': notes,
        'source': t['src'],
        'concepts': [short(t['term'])],
        'tags': ['용어', short(t['term'])],
    }


def build_term_to_def(t, terms, g, spread):
    qid = f"{g['prefix']}r-{t['no']:03d}"
    rng = rng_for(qid)
    ds = pick_distractors(t, terms, rng)
    pos = spread.next(len(ds) + 1)
    items = place(t, ds, pos)
    expl = f"**{t['term']}** — {t['def']}"
    if t.get('note'):
        expl += f"\n{t['note']}"
    notes = []
    for x in items:
        if x is t:
            notes.append('정답 — 이 용어의 정의다.')
        else:
            notes.append(f"틀리다 — {x['term']}의 설명이다.")
    return {
        'id': qid, 'type': '용어', 'part': 1,
        'question': f"「{t['term']}」에 대한 설명으로 옳은 것은?",
        'choices': [x['def'] for x in items],
        'answer': pos + 1,
        'explanation': expl,
        'choiceNotes': notes,
        'source': t['src'],
        'concepts': [short(t['term'])],
        'tags': ['용어', short(t['term'])],
    }


SUFFIXES = [' culture', ' chromatography', ' mode', ' test', ' 배양', ' 크로마토그래피', ' 모드', ' 시험', ' 세포']


def norm_answer(a):
    return re.sub(r"[\s.,·•()\[\]{}'\"`/\\:;~!?^_\-–—−=+*&%]", '', a.lower())


def short_answers(t):
    """단답형 정답 목록(영어·우리말·약어 표기). 띄어쓰기·대소문자·문장부호는 앱이 무시하고 비교한다."""
    name = t['term']
    if t.get('answers'):
        cands = list(t['answers'])
    else:
        cands = []
        m = re.match(r'^(.*?)\s*\((.*)\)\s*(.*)$', name)
        if m:
            main, par, tail = (x.strip() for x in m.groups())
            pars = [x.strip() for x in re.split(r',\s*', par) if x.strip()]
            if tail:  # 'Orthogonal (직교) 전략'
                cands += [f"{main} {tail}", main] + [f"{x} {tail}" for x in pars] + pars
            else:
                cands += [main] + pars
        else:
            main = name
            cands.append(name)
        for part in re.split(r'\s+/\s+', main):
            if part != main:
                cands.append(part)
        cands.append(name)
    cands += t.get('answersExtra', [])
    more = []
    for c in cands:
        for suf in SUFFIXES:
            if c.endswith(suf) and len(c) > len(suf) + 1:
                more.append(c[: -len(suf)])
    out, seen = [], set()
    for c in cands + more:
        k = norm_answer(c)
        if k and k not in seen:
            seen.add(k)
            out.append(c.strip())
    return out


def build_short(t, g):
    qid = f"{g['prefix']}s-{t['no']:03d}"
    answers = short_answers(t)
    expl = f"**{t['term']}** — {t['def']}"
    if t.get('note'):
        expl += f"\n{t['note']}"
    expl += "\n정답으로 인정하는 표기: " + ' · '.join(answers[:5]) + " (띄어쓰기·대소문자 무시)"
    return {
        'id': qid, 'type': '단답', 'part': 3, 'format': 'short',
        'question': '다음 설명에 해당하는 용어를 쓰시오.',
        'box': [t['def']],
        'answers': answers,
        'explanation': expl,
        'source': t['src'],
        'concepts': [short(t['term'])],
        'tags': ['용어', short(t['term'])],
    }


def matching_sets(terms, sealed=0):
    """group 순서대로 4개씩 묶는다. 4개가 안 되는 나머지는 다음(없으면 이전) 묶음 용어로 채운다.

    sealed(용어집의 "matchSealed"): 이 번호까지의 용어는 그 용어들끼리만 예전 그대로 묶고,
    뒤에 추가한 용어는 따로 묶는다 — 용어를 덧붙여도 이미 배포된 짝짓기 id가 바뀌지 않게 한다.
    """
    if sealed:
        old = [t for t in terms if t['no'] <= sealed]
        new = [t for t in terms if t['no'] > sealed]
        # 새 용어 묶음만 고른다(나머지를 채울 때는 새 묶음 → 예전 용어 순으로 쓴다)
        return matching_sets(old) + [ch for ch in matching_sets(new + old) if ch[0]['no'] > sealed]
    groups = []
    for t in terms:
        if not groups or groups[-1][0] != t['group']:
            groups.append((t['group'], []))
        groups[-1][1].append(t)
    sets = []
    for gi, (_, members) in enumerate(groups):
        chunks = [members[i:i + 4] for i in range(0, len(members), 4)]
        for ch in chunks:
            if len(ch) < 4:
                pool = []
                for gj in list(range(gi + 1, len(groups))) + list(range(gi - 1, -1, -1)):
                    pool += [x for x in groups[gj][1] if x not in ch]
                ch = ch + pool[:4 - len(ch)]
            if len(ch) == 4:
                sets.append(ch)
    return sets


def build_matching(ch, g, spread):
    nos = '-'.join(f"{t['no']:03d}" for t in ch)
    qid = f"{g['prefix']}m-{nos}"
    rng = rng_for(qid)
    # 설명 A~D 순서를 섞고, (가)~(라) 용어가 어느 설명에 대응하는지 정답 순열을 만든다
    defs_order = ch[:]
    rng.shuffle(defs_order)
    correct = [defs_order.index(t) for t in ch]           # (가)→A.. 의 문자 인덱스
    swaps = [(i, j) for i in range(4) for j in range(i + 1, 4)]
    rng.shuffle(swaps)
    wrong_perms = []
    for i, j in swaps:
        p = correct[:]
        p[i], p[j] = p[j], p[i]
        wrong_perms.append(p)
        if len(wrong_perms) == 3:
            break
    # 두 쌍이 동시에 틀린 순열 하나를 더해 5지선다를 만든다
    wrong_perms.append([correct[1], correct[0], correct[3], correct[2]])
    pos = spread.next(5)
    perms = wrong_perms[:4]
    perms.insert(pos, correct)

    def fmt(p):
        return '  '.join(f"{LABELS[i]}-{LETTERS[p[i]]}" for i in range(4))

    notes = []
    for p in perms:
        if p == correct:
            notes.append('정답 — 네 쌍 모두 옳다.')
        else:
            bad = [f"{LABELS[i]} {short(ch[i]['term'])}의 설명은 {LETTERS[correct[i]]}" for i in range(4) if p[i] != correct[i]]
            notes.append('틀리다 — ' + ', '.join(bad))
    lines = [f"{LABELS[i]} {ch[i]['term']}" for i in range(4)]
    expl = '**용어와 설명의 짝**\n' + '\n'.join(
        f"{LABELS[i]} **{ch[i]['term']}** → {LETTERS[correct[i]]}. {ch[i]['def']}" for i in range(4))
    srcs = []
    for t in ch:
        for part in t['src'].split(' · '):
            if part not in srcs:
                srcs.append(part)
    return {
        'id': qid, 'type': '용어', 'part': 1,
        'question': '다음 용어와 <보기>의 설명을 바르게 짝지은 것은?\n' + '\n'.join(lines),
        'box': [f"{LETTERS[k]}. {defs_order[k]['def']}" for k in range(4)],
        'choices': [fmt(p) for p in perms],
        'answer': pos + 1,
        'explanation': expl,
        'choiceNotes': notes,
        'source': ' · '.join(srcs),
        'concepts': [short(t['term']) for t in ch],
        'tags': ['용어', '짝짓기'],
    }


def leak_warnings(g):
    out = []
    for t in g['terms']:
        key = short(t['term'])
        if len(key) >= 3 and key.lower() in t['def'].lower():
            out.append(f"{g['prefix']} {t['no']}: 정의에 용어 '{key}'가 그대로 들어 있음")
    return out


def main():
    files = sorted(GLOSSARY.glob('*.json'))
    if not files:
        print('glossary/*.json 이 없습니다.')
        return 1
    produced = []
    warns = []
    total = 0
    for f in files:
        g = json.loads(f.read_text(encoding='utf-8'))
        terms = sorted(g['terms'], key=lambda t: t['no'])
        nos = [t['no'] for t in terms]
        if len(nos) != len(set(nos)):
            print(f'{f.name}: 용어 번호(no)가 중복됩니다.')
            return 1
        terms = [t for t in terms if not t.get('drop')]  # 걸러 낸 용어: no는 예약, 문항은 안 만듦
        warns += leak_warnings(g)
        spread = Spreader(g['prefix'])
        qs = []
        for t in terms:
            if drill_kind(t) == 'd':
                qs.append(build_def_to_term(t, terms, g, spread))
        for t in terms:
            if drill_kind(t) == 'r':
                qs.append(build_term_to_def(t, terms, g, spread))
        for ch in matching_sets(terms, g.get('matchSealed', 0)):
            qs.append(build_matching(ch, g, spread))
        for t in terms:
            if t.get('short'):
                qs.append(build_short(t, g))
        out = {
            'week': g['week'],
            'title': f"{g['week']} 용어 정리",
            'lecture': f"{g['lecture']} 용어 정리 (자동 생성: tools/build_terms.py — 직접 고치지 말고 glossary/{f.name}를 고칠 것)",
            'questions': qs,
        }
        name = f"terms-{f.stem}.json"
        (QDIR / name).write_text(json.dumps(out, ensure_ascii=False, indent=1) + '\n', encoding='utf-8')
        produced.append(name)
        total += len(qs)
        print(f"{name:20s} 용어 {len(terms):3d}개 → {len(qs):4d}문항")
    for w in warns:
        print('경고:', w)
    print(f"총 {total}문항 생성")
    return 0


if __name__ == '__main__':
    sys.exit(main())
