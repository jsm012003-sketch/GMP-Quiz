#!/usr/bin/env python3
"""문제 JSON 검사기.

사용법:  python3 tools/validate_questions.py
- questions/index.json 에 적힌 파일을 모두 읽어 형식 오류, 중복 id,
  정답 번호 범위, 보기별 해설(choiceNotes) 개수 등을 확인한다.
- 서술형(format: "essay")은 보기 대신 modelAnswer(모범답안)와 keywords(채점 요소)를 확인한다.
- 단답형(format: "short")은 보기 대신 answers(정답 목록 — 영어·우리말 등 맞는 표기를 모두)를 확인한다.
- part(1~3, 시험지 PART)와 파트별 문항 수도 함께 보여 준다.
- questions/archive/ 의 걸러 낸 문항 id를 다시 쓰지 않았는지 확인한다.
- 오류가 있으면 종료 코드 1 을 돌려준다.
"""
import json
import sys
from collections import Counter
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
QDIR = ROOT / "questions"
TYPES = {"용어", "개념", "연결", "단답", "상황판단", "계산", "서술형"}
# 실제 시험(용어·원리 확인)에 나오지 않아 새로 출제하지 않는 유형 — 앱 호환용으로만 남김 (2026.10)
RETIRED_TYPES = {"계산", "서술형", "상황판단"}
DEFAULT_PART = {"용어": 1, "개념": 2, "연결": 2, "단답": 3, "계산": 2, "상황판단": 3, "서술형": 3}


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
        parts = Counter()
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
            qtype = q.get("type", "-")
            if qtype not in TYPES:
                warnings.append(f"{where}: type '{qtype}' 은(는) {sorted(TYPES)} 중 하나가 아닙니다")
            elif qtype in RETIRED_TYPES or q.get("format") == "essay":
                warnings.append(f"{where}: '{qtype}' 유형은 출제하지 않습니다(계산·서술형·상황판단 제외 — CLAUDE.md 출제 방향)")
            part = q.get("part", DEFAULT_PART.get(qtype, 2))
            if part not in (1, 2, 3):
                errors.append(f"{where}: part 는 1~3 이어야 합니다 (현재 {part!r})")
            parts[part] += 1
            if part == 3 and q.get("format") != "short":
                warnings.append(f"{where}: PART III는 단답형 전용입니다(2026.10.08) — 객관식은 part 1·2로")
            if q.get("format") == "short":
                ans = q.get("answers")
                if not isinstance(ans, list) or not ans or any(not str(a).strip() for a in ans):
                    errors.append(f"{where}: 단답형에 answers(정답 목록)가 없습니다")
                if part != 3:
                    errors.append(f"{where}: 단답형은 part 3(PART III 단답형)이어야 합니다")
                if not q.get("explanation"):
                    warnings.append(f"{where}: explanation(해설) 없음")
                if not q.get("source"):
                    warnings.append(f"{where}: source(출처) 없음")
                types[qtype] += 1
                continue
            if q.get("format") == "essay":
                if not str(q.get("modelAnswer", "")).strip():
                    errors.append(f"{where}: 서술형에 modelAnswer(모범답안)가 없습니다")
                if not isinstance(q.get("keywords"), list) or not q.get("keywords"):
                    warnings.append(f"{where}: 서술형에 keywords(채점 요소)가 없습니다")
                if not q.get("source"):
                    warnings.append(f"{where}: source(출처) 없음")
                types[qtype] += 1
                continue
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
            types[qtype] += 1
            if isinstance(ans, int):
                answers[ans] += 1
        total += len(qs)
        print(f"{name:20} {data.get('week', '-'):6} {len(qs):4}문항  PART {dict(sorted(parts.items()))}  유형 {dict(types)}  정답분포 {dict(sorted(answers.items()))}")
    # 걸러 낸 문항(questions/archive/)의 id는 영구 예약 — 출제 문항이 같은 id를 쓰면 안 된다
    archived = 0
    for path in sorted((QDIR / "archive").glob("*.json")):
        for q in json.loads(path.read_text(encoding="utf-8")).get("questions", []):
            archived += 1
            if q.get("id") in seen:
                errors.append(f"archive/{path.name}: 보관한 id {q['id']}를 {seen[q['id']]}에서 다시 쓰고 있습니다")
    print(f"\n총 {total}문항" + (f" (보관 {archived}문항 제외)" if archived else ""))
    for w in warnings:
        print("경고:", w)
    for e in errors:
        print("오류:", e)
    return 1 if errors else 0


if __name__ == "__main__":
    sys.exit(main())
