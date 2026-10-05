#!/usr/bin/env python3
"""용어집(glossary/*.json) → 용어 정리 문항(questions/terms-*.json) 생성기.

한 용어당 두 문항과, 같은 묶음(group) 용어 4개씩 짝짓기 문항을 만든다.
  <prefix>d-<no>  정의 → 용어   ("다음 설명에 해당하는 용어는?")
  <prefix>r-<no>  용어 → 정의   ("「용어」에 대한 설명으로 옳은 것은?")
  <prefix>m-<no>-<no>-<no>-<no>  용어 (가)~(라) ↔ 설명 A~D 짝짓기

id는 용어 번호(no)로만 정해지므로 용어를 추가해도 기존 id는 바뀌지 않는다.
오답 선지는 같은 group(헷갈리기 쉬운 묶음)에서 먼저 고르고, 모자라면 같은 단원의
다른 용어에서 채운다. 선지 선택·정답 위치는 id로 시드를 정해 매번 같은 결과가 나온다.

사용법: python3 tools/build_terms.py   (저장소 루트에서)
"""
import hashlib
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


def short(term):
    """'MCB (Master Cell Bank)' → 'MCB' : 해설·개념 키용 짧은 이름."""
    return term.split(' (')[0].strip()


def concept_key(label):
    return ''.join(ch for ch in short(label).lower() if ch.isalnum())


def pick_distractors(term, terms, rng, k=4):
    same = [t for t in terms if t['group'] == term['group'] and t['no'] != term['no']]
    other = [t for t in terms if t['group'] != term['group']]
    rng.shuffle(same)
    rng.shuffle(other)
    out = []
    for t in same + other:
        if len(out) >= k:
            break
        if short(t['term']) == short(term['term']) or t['def'] == term['def']:
            continue
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


def matching_sets(terms):
    """group 순서대로 4개씩 묶는다. 4개가 안 되는 나머지는 다음(없으면 이전) 묶음 용어로 채운다."""
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
        warns += leak_warnings(g)
        spread = Spreader(g['prefix'])
        qs = []
        for t in terms:
            qs.append(build_def_to_term(t, terms, g, spread))
        for t in terms:
            qs.append(build_term_to_def(t, terms, g, spread))
        for ch in matching_sets(terms):
            qs.append(build_matching(ch, g, spread))
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
