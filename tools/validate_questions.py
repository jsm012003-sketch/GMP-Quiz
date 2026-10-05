#!/usr/bin/env python3
"""문제 JSON 검사기.

사용법:  python3 tools/validate_questions.py
- questions/index.json 에 적힌 파일을 모두 읽어 형식 오류, 중복 id,
  정답 번호 범위, 보기별 해설(choiceNotes) 개수 등을 확인한다.
- 오류가 있으면 종료 코드 1 을 돌려준다.
"""
import json
import sys
from collections import Counter
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
QDIR = ROOT / "questions"


def main() -> int:
    errors, warnings = [], []
    index = json.loads((QDIR / "index.json").read_text(encoding="utf-8"))
    files = index if isinstance(index, list) else index.get("files", [])
    seen = {}
    total = 0
    for name in files:
        path = QDIR / name
        if not path.exists():
            errors.append(f"{name}: 파일이 없습니다 (index.json 확인)")
            continue
        try:
            data = json.loads(path.read_text(encoding="utf-8"))
        except json.JSONDecodeError as e:
            errors.append(f"{name}: JSON 문법 오류 — {e}")
            continue
        if not data.get("week"):
            warnings.append(f"{name}: week 값이 없습니다 (파일명이 단원 이름으로 쓰입니다)")
        qs = data.get("questions", [])
        types = Counter()
        answers = Counter()
        for i, q in enumerate(qs, 1):
            where = f"{name} #{i} ({q.get('id', '?')})"
            qid = q.get("id")
            if not qid:
                errors.append(f"{where}: id 없음")
            elif qid in seen:
                errors.append(f"{where}: id 중복 (먼저 나온 곳: {seen[qid]})")
            else:
                seen[qid] = name
            if not str(q.get("question", "")).strip():
                errors.append(f"{where}: question 없음")
            choices = q.get("choices")
            if not isinstance(choices, list) or not 2 <= len(choices) <= 10:
                errors.append(f"{where}: choices 는 2~10개 배열이어야 합니다")
                continue
            if any(not str(c).strip() for c in choices):
                errors.append(f"{where}: 빈 보기가 있습니다")
            ans = q.get("answer")
            if not isinstance(ans, int) or not 1 <= ans <= len(choices):
                errors.append(f"{where}: answer 는 1~{len(choices)} 정수여야 합니다 (현재 {ans!r})")
            notes = q.get("choiceNotes")
            if notes is not None and (not isinstance(notes, list) or len(notes) != len(choices)):
                errors.append(f"{where}: choiceNotes 개수가 보기 개수와 다릅니다")
            if len(set(map(str, choices))) != len(choices):
                errors.append(f"{where}: 같은 보기가 중복됩니다")
            if not q.get("explanation"):
                warnings.append(f"{where}: explanation(해설) 없음")
            if not q.get("source"):
                warnings.append(f"{where}: source(출처) 없음")
            if len(choices) != 5:
                warnings.append(f"{where}: 5지선다가 아닙니다 ({len(choices)}개)")
            for mark in ("①", "②", "③", "④", "⑤"):
                if mark in str(q.get("explanation", "")):
                    warnings.append(f"{where}: 해설에 보기 번호({mark})가 있습니다 — 보기를 섞으면 번호가 바뀝니다")
                    break
            types[q.get("type", "-")] += 1
            if isinstance(ans, int):
                answers[ans] += 1
        total += len(qs)
        print(f"{name:18} {data.get('week', '-'):8} {len(qs):3}문항  유형 {dict(types)}  정답분포 {dict(sorted(answers.items()))}")
    print(f"\n총 {total}문항")
    for w in warnings:
        print("경고:", w)
    for e in errors:
        print("오류:", e)
    return 1 if errors else 0


if __name__ == "__main__":
    sys.exit(main())
