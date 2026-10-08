# 출제 현황 (Coverage)

강의별로 **이미 출제한 주제**와 **아직 출제하지 않은 주제(다음 업데이트 후보)** 를 정리한다.
새 자료를 반영할 때마다 이 표를 갱신하고, 미출제 후보부터 문항을 만든다.

> 앱 자체도 사용자가 아직 풀지 않은 문항을 먼저 출제하고, 개념 단위로 아직 안 다룬 개념을 보여 준다(시작 화면의 「출제 현황」).
> 아래 표는 **본문 문항**(PART I 개념 확인·PART II 헷갈리는 개념 구분) 기준이다. 용어 정리 문항은 맨 아래 「용어 정리」 절 참고.
>
> 2026.10 난이도 재조정: 실제 시험이 쉬운 오픈북이라 고난도(상황 대응) 문항을 모두 쉬운 말의 개념 확인·개념 구분 문항으로 다시 쓰고(같은 id), 용어집의 헷갈리는 짝으로 PART II 문항 33개를 더했다.
>
> **대표 문항 위주로 정리(2026.10, 사용자 요청 — "지엽적인 문제는 빼고, 문제가 너무 많다")**: 제품·회사명, 특정 사례·현장 일화, 세부 수치·규격, 장비 부품·펌프, 규정 문서 번호, 데이터 분석 도구 세부, 같은 포인트의 반복 문항을 걸러 냈다. 본문은 `questions/archive/`로 옮겨 출제되지 않고(id는 영구 예약), 용어는 용어집에 `"drop": true`로 표시해 문항을 만들지 않는다. 아래 표의 id 중 걸러 낸 것은 맨 아래 「걸러 낸 문항」 절에 모아 두었다. 각 단원의 「미출제 후보」도 대표 개념만 남겼고, 제품명·세부 수치 같은 지엽적 항목은 새로 출제하지 않는다.
>
> 강의 녹음본(2026.10 반영): 09.16(WK03, 슬라이드 없음)·09.23(WK04)·09.30(GMP03)·10.07(WK06) 녹음에서 슬라이드에 없는 강조점·예시를 문항으로 만들었다. 출처는 `<단원> 강의 녹음 mm:ss`. 녹음은 자동 받아쓰기라 잘못 받아쓴 곳이 많아, 뜻이 분명한 부분만 근거로 썼다.

## OT — Introduction to Design Project (2026.09.07) — **시험 범위 제외(2026.10.07)**

1주차(OT)는 시험에 나오지 않는다고 해서 단원 전체를 뺐다. 본문 ot-001~008(ot-006은 예전에 지운 서술형)은 `questions/archive/ot.json`, 용어집은 `glossary/archive/ot.json`(용어 정리 `terms-ot.json` 삭제, `tot*` id는 용어집 번호로 예약)으로 옮겼고, OT 사례(BluejayTech mRNA 전환)에 기댄 통합 문항 int-002도 보관했다. 되살리려면 원래 자리로 옮기고 `index.json`에 다시 넣는다. OT를 함께 인용한 WK02 문항(wk02-002, wk02-057)과 int-001은 WK02 근거로 그대로 둔다.

## WK02 — Upstream Process 1 (2026.09.09)

| 출제됨 | 문항 |
|---|---|
| Cell banking(RCB·MCB·WCB·EPC), GMP 첫 적용 | wk02-001 |
| 배지 준비 3단계·0.2/0.1 µm 여과 | wk02-002, int-003 |
| Temperature shift(37→32 ℃) | wk02-003 |
| Batch / Fed-batch / Perfusion 비교 | wk02-004 |
| DoE(Ambr 15 24 vessel)로 조건 탐색 | wk02-005 |
| pH 저하 시 접근(원인 → 샘플링·IPC 확인) | wk02-006, int-008 |
| Design space set point·hypercube | wk02-007, int-005 |
| QbD 첫 단계(QTPP)와 흐름 | wk02-008 |
| CPP vs CQA(Bioprocessing 4.0) | wk02-009 |
| N-1 perfusion high inoculum fed-batch | wk02-010, int-010 |
| Concentrated FB(UF) vs Dynamic perfusion(MF) | wk02-011, int-003 |
| COGS 구성·공정 강화 효과 | wk02-012, wk02-013 |
| Growth curve 4단계 | wk02-014 |
| kLa·OTR/OUR 개념 | wk02-015 |
| Tip speed의 의미(shear) | wk02-016 |
| P/V 일정 scale-up 원리 | wk02-017 |
| kLa 높이는 방법, 교반·통기 범위 이탈 문제 | wk02-018, wk02-019 |
| Superficial gas velocity 영향 | wk02-020 |
| Scale-down model 전제 | wk02-021 |
| Spent media 아미노산 역할 | wk02-022 |
| Data analytics 4단계 | wk02-023 |
| Perfusion PAT(BioPAT Trace·ViaMass, cell bleed) | wk02-024 |
| Sampling·IPC 항목 | wk02-025, int-007 |
| Modality(AAV·CAR-T·mRNA·Adeno·MSC) | wk02-026 |
| 해동 직후 세포 상태와 계대배양 | wk02-027 |
| VIP vs Coefficient plot | wk02-028 |
| HEK293T AAV 최적화(pH·stirring CPP) | wk02-029 |
| Upstream hybrid models | wk02-030 |
| USP/DSP/DP 흐름 | wk02-031, int-009 |
| Torque·shear | wk02-032, int-004 |

| **(녹음본)** CLD 클론 선별(batch 배양) | wk02-033 |
| 연속식 vs perfusion 구분, perfusion 고밀도 유지 이유 | wk02-034, wk02-035 |
| Seed 단계 무균 작업, 계단식 배양기 배치 | wk02-036, wk02-037 |
| 센서 vs 오프라인 분석 항목, pH·DO 제어 로직, 센서 이중화 | wk02-038, wk02-039, wk02-040 |
| 거품·vent filter 대응, 일상 점검 | wk02-041, wk02-042 |
| Temperature shift와 품질, 생산 시기·VCD 전략 | wk02-043, wk02-044 |
| 산업 현실(fed-batch 주류), ATF 비용·원리 | wk02-045, wk02-046, wk02-047 |
| N-1 perfusion의 허가 측면 장점, concentrated FB 운영 | wk02-048, wk02-049 |
| Scale-up 현실(MSAT)·대규모 난점(foam·CO₂) | wk02-050, wk02-051 |
| 프로세스 모델링과 규제, Biopharma 4.0 다섯 요소 | wk02-052, wk02-053 |
| 부착 세포 한계(microcarrier), 아미노산 배지 설계 | wk02-054, wk02-055 |
| AAV(HEK293) 회수, mRNA·LNP 흐름 | wk02-056, wk02-057 |
| 데이터 분석·문제 해결 역량, design space의 '공간', SDM 활용 | wk02-058, wk02-059, wk02-060 |
| **(개념 구분)** Basal medium vs supplement, lactate vs ammonium 출처, micro vs ring sparger | wk02-065, wk02-066, wk02-067 |
| Screening vs optimization design, DS vs DP, VCD vs viability | wk02-068, wk02-069, wk02-070 |
| 교반·통기 지표(P/V·tip speed·mixing time·VVM·kLa), 줄기세포(MSC·iPSC·HSC) | wk02-071, wk02-072 |

미출제 후보: 포도당 호기 대사 vs 혐기 해당(lactate 생성)의 차이.

## WK03 — Downstream Process 1: 크로마토그래피 (2026.09.16, 녹음 기반)

슬라이드(PDF)는 아직 없고 녹음본(약 1시간, 레진 회사 강사)만으로 만들었다. 출처: `WK03 강의 녹음 mm:ss`.

| 출제됨 | 문항 |
|---|---|
| 분리 원리(머무는 시간 차이), 분석용(HPLC) vs 생산용 비드, 비드 크기와 분리능·압력 | wk03-001 ~ wk03-003 |
| IEX 염 농도 용출 순서, 첫 단계 친화(Protein A), Capture–Intermediate–Polishing, Capture에 큰 비드 | wk03-004 ~ wk03-007 |
| Bind-elute vs Flow-through, flow-through가 유리한 경우, 레진(리간드) 양은 넉넉히 | wk03-008 ~ wk03-010 |
| 결합 안 하는 SEC, linear gradient vs step elution, 개발 초기 분획 모두 분석 | wk03-011 ~ wk03-013 |
| 시스템 모니터(UV 280/260·전도도), 압력 상승 시 정지, 정제 후 분석법 | wk03-014 ~ wk03-016 |
| 탈염(IEX 전 컨디셔닝)·group separation(G-25), V0 vs Vt, SEC는 마지막 polishing | wk03-017 ~ wk03-020 |
| 레진 공급 다변화(납기 18개월), Superdex Increase vs prep grade, Sephacryl S-100 vs S-400, 팽윤 | wk03-021 ~ wk03-024 |

미출제 후보: 슬라이드가 오면 그 대표 내용을 같은 파일에 이어 붙인다(HIC·MMC 원리 등).

## WK04 — Downstream Process 2: 여과 및 기타 공정 (2026.09.23)

PDF가 두 파일(1–80쪽, 81–160쪽)로 왔으며, `source`의 쪽 번호는 슬라이드 하단 번호와 같은 **전체 160쪽 기준**이다. 손필기는 없고, 녹음본은 아래 「WK04 강의 녹음」 절에 따로 정리했다.

| 출제됨 | 문항 |
|---|---|
| 여과 정의·구동 원리, 바이오 vs 화학 분리 방법 | wk04-001, wk04-002 |
| 공정 유래 vs 제품 유래 불순물 | wk04-003 |
| 침전, 봉입체(인슐린) 세척·재접힘, 분비 vs 세포 안 산물 회수 | wk04-004, wk04-005, wk04-006 |
| 혈장 단백질 역할 | wk04-007 |
| 항체 정제 흐름에서 UF/DF, 완제 농축 필요성, F&F 구성 | wk04-008, wk04-009, wk04-010 |
| 배지 오염 저감(mitigation), 배양 방식과 COGs | wk04-011, wk04-012 |
| 필터 용도·정화의 뜻 | wk04-013, wk04-014 |
| 제균 필터 정의(BCT 10⁷/cm²), B. diminuta worst case | wk04-015, wk04-016 |
| DEF vs CFF, MF→UF→NF→RO 크기·압력, MWCO | wk04-017 ~ wk04-020 |
| 멤브레인 vs 깊이 필터, 조합 필터, 재질, 비대칭 막 | wk04-021 ~ wk04-024 |
| Absolute 등급, β값 | wk04-025, wk04-026 |
| 탱크 vent·이중 vent·가열 하우징·PTFE | wk04-027 ~ wk04-030 |
| 기체 포집 기전, MPPS, 기체에서 실제 보유력, 제균 기체 vs HEPA | wk04-031 ~ wk04-034 |
| 필터 막힘 영향, sizing test, Vmax vs Pmax·Tmax, flux vs capacity, scale-up | wk04-035 ~ wk04-039 |
| 카트리지 vs 캡슐, 클램프 규격, SS 316L, 펌프, 가압 이송, 필터 선정 고려 | wk04-040 ~ wk04-045 |
| TFF 구성(retentate), TMP vs ΔP, 겔층, TMP 최적화, 모듈 | wk04-046 ~ wk04-050 |
| TFF 용도별 회수 위치, MF-TFF 빠른 flux, 농축 vs DF, 연속 vs 회분 DF | wk04-051 ~ wk04-054 |
| TFF 운전 순서, 카세트 오염 기전, CWF vs NWP, 막 수명 | wk04-055 ~ wk04-058 |
| 무결성 시험 이유, 파괴 vs 비파괴, IT limit | wk04-059 ~ wk04-061 |
| 기포점 원리, 기포점 vs 확산, 확산값 조건, pressure drop | wk04-062 ~ wk04-066 |
| 적심 액, WIT(원리·장점·조건), 방법 선택, Min vs Max BP | wk04-067 ~ wk04-072 |
| 불합격 시 조치(PDA TR 26), redundant filtration, PUPSIT | wk04-073 ~ wk04-076, int-023 |

미출제 후보: 원심분리(회분 vs 연속) 비교.

### WK04 강의 녹음 (09.23 — ① 여과 도입 31분, ② 바이오공정 전체 흐름 약 3시간)

같은 강사가 슬라이드(여과 5개 기준)에 들어가기 전에 바이오공정 전체 흐름을 설명한 내용이다. 출처: `WK04 강의 녹음① mm:ss`, `WK04 강의 녹음② mm:ss`.

| 출제됨 | 문항 |
|---|---|
| 혼합물 종류별 분리 기술, 여과가 크로마토그래피보다 훨씬 자주 쓰임 | wk04-077, wk04-078 |
| 모달리티, 혈장 유래 의약품의 오염 위험, 숙주세포와 세포벽 | wk04-079 ~ wk04-081 |
| 단일 세포 선별(Beacon), 세포주 특성 분석, MCB 문제 = 프로젝트 위기, WCB를 따로 만드는 이유, EOPCB, 셀뱅크 정기 시험 | wk04-082 ~ wk04-087 |
| 배양 목적(VCD·titer), 시드 트레인 단계 확대, CHO 배가 시간, batch vs fed-batch 시작, 관류와 시드 트레인 위험, 증식 조건 vs 생산 조건 | wk04-088 ~ wk04-093 |
| Cell harvest vs Clarification, 꼭 외울 크기, 원심분리 vs depth filter(규모), 원심분리 뒤 depth filter | wk04-094 ~ wk04-097 |
| Affinity(네잎) vs IEX(세잎), Protein A 용출(낮은 pH), 낮은 pH 바이러스 불활화·응집 처리, VCS, 불순물 4총사 | wk04-098 ~ wk04-103 |
| CEX pH 5~6, CEX(bind-elute) vs AEX(flow-through), 높은 전도도(mS/cm), 희석 vs UF/DF, VF 추가 이유, LRV | wk04-104 ~ wk04-109 |
| 수율 vs 순도, 농축과 안정제, 약전, 제형 | wk04-110 ~ wk04-113 |
| 무균 의약품 제조 3방법, 정제는 비무균, WFI는 무균 아님, 배지 여과 멸균, sparger vs vent 필터 | wk04-114 ~ wk04-118 |

미출제 후보: 없음(진로·시장 이야기는 출제하지 않는다).

## GMP01 — 완제 의약품 제조 공정의 이해 (2026.09.30)

| 출제됨 | 문항 |
|---|---|
| 완제의약품 정의·제형 분류 | gmp01-001 |
| 최종멸균 vs 무균조작, SAL 10⁻⁶의 의미 | gmp01-002, gmp01-003 |
| 부형제 조건 | gmp01-004 |
| 교반·과교반·단백질 변성 | gmp01-005, int-004 |
| Hold time | gmp01-006 |
| 혼합 단위공정 흐름 | gmp01-007 |
| 필터 완전성 시험(사용 전·후) | gmp01-008, int-003 |
| 용기별 충전 순서·동결건조 | gmp01-009 |
| CCI·전수검사 | gmp01-010 |
| 혼합 vs 충전 비교표 | gmp01-011 |
| 점도와 충전량 IPC | gmp01-012 |
| 무균 충전 환경(Grade A/B, EM, 미디어필, 갱의) | gmp01-013 |
| 전체 제조 흐름 01~05·공통 관리 | gmp01-014 |
| **(개념 구분)** 부형제 역할, 용기별 밀봉, IPC 중량검사 vs 전수검사 | gmp01-017, gmp01-018, gmp01-019 |

미출제 후보: 액상 vs 동결건조 원료 형태, 컨테이너 세부 구성(PFS: 바늘 보호 캡·바늘·유리용기·피스톤), 칭량 단계 원료 확인·투입 순서.

## GMP02 — RABS 시스템과 무균공정시뮬레이션 (2026.09.30)

| 출제됨 | 문항 |
|---|---|
| RABS(막는 설계) vs APS(증명) | gmp02-001 |
| RABS 구조·요건 | gmp02-002 |
| Open vs Closed RABS | gmp02-003 |
| 클린룸·RABS·아이솔레이터 비교 | gmp02-004, int-010 |
| 배지·2단계 배양 조건 | gmp02-005 |
| APS 실패 조치·원인 불명 시 3회 연속 | gmp02-006, gmp02-007 |
| APS 파라미터(빈도·수량·충전량·속도) | gmp02-008 |
| Inherent vs Corrective 간섭 | gmp02-009 |
| Intervention 사례 (1)·(3)·(4) | gmp02-010, gmp02-012, gmp02-011 |
| Intervention 관리 원칙(즉흥 금지) | gmp02-013 |
| Worst case를 쓰는 이유 | gmp02-014 |
| Initial APS 전략(N₂ 단계 → air) | gmp02-015 |
| 신규 작업자 자격 판정 | gmp02-016 |
| Holistic approach(PDA TR22)·스모크 스터디 선행 | gmp02-017 |
| 대상 선택·GPT·육안검사 | gmp02-018, int-006 |
| **(개념 구분)** PDA TR22·Annex 1·ISO 13408-1·CCS, Initial vs Routine APS | gmp02-022, gmp02-023 |
| 실패 조치(근본원인·시정조치·재자격·균 동정), viable vs non-viable | gmp02-024, gmp02-025 |

미출제 후보: RABS 구성요소 5가지(도어·글러브 무결성 주기·스모크 스터디·RTP/알파-베타 포트·VHP 사전 소독과 잔류물), Intervention 사례 (2) EM 배지 교체(settle plate 4시간, 기록 항목), Study design 요소(장비 조립·해제, 교대·휴식 중단, 공정 확인 항목), APS 재검증 계기(설비 변경·중대 일탈·장기 미가동 → 변경관리).

## GMP03 — Isolator & Qualification (2026.09.30)

| 출제됨 | 문항 |
|---|---|
| Isolator 4원리·기밀성 전제 | gmp03-001 |
| 압력 계위 | gmp03-002 |
| Chamber 구성(Incoming/Main/Outgoing) | gmp03-003 |
| VHP cycle 4단계 | gmp03-004 |
| 성공 조건(농도·분포·시간) | gmp03-005 |
| ·OH 사멸 원리·아포 | gmp03-006 |
| Occluded surface | gmp03-007 |
| SLR 6-log·BI 10⁶ 요구 이유 | gmp03-008 |
| BI·CI·EI 비교 | gmp03-009 |
| BI 담체(steel disk) | gmp03-010 |
| Qualification(URS/DQ→IQ→OQ→CD→MBQ→PRQ) | gmp03-011 |
| Total kill time·fractional | gmp03-012 |
| 적재 변경 판단 | gmp03-013 |
| Aeration·잔류 H₂O₂ | gmp03-014, int-006 |
| Glove integrity(육안·pressure decay) | gmp03-015, gmp03-016 |
| Test location 범주 | gmp03-017 |
| 클린룸 vs 아이솔레이터(사람 → 설비 성능) | gmp03-018 |
| **(개념 구분)** Maximum vs Minimum/Empty load, 온도·습도 vs CI mapping, D-value·SLR·Population | gmp03-022, gmp03-023, gmp03-024 |
| (녹음) 바이럴 벡터 제품 반출 자재 VHP, 준비 단계 습도를 낮추는 이유 | gmp03-025, gmp03-026 |
| (녹음) 소독 vs 멸균(3 log vs 6 log), 스팀 vs VHP(침투 vs 표면) | gmp03-027, gmp03-028 |
| (녹음) CI를 함께 쓰는 이유(BI는 일주일 이상), BI 형태별 멸균 방식 | gmp03-029, gmp03-030 |
| (녹음) SOP와 가이드라인 정렬, 기록 없으면 안 한 것(GDP), 아이솔레이터 개입도 APS로 검증, 글러브 시험은 작업 전·후 | gmp03-031 ~ gmp03-034 |

녹음 출처: `03 Isolator & Qualification 강의 녹음 mm:ss`(09.30, 앞부분 RABS 설명은 녹음에 없음).

미출제 후보: Aeration 기준(< 1.0 ppm)의 의미.

## WK06 — 항체치료제 공정 설계·정제(DSP)·바이러스 안전성

| 출제됨 | 문항 |
|---|---|
| DSP 플랫폼 단계와 목적, Protein A 플랫폼 | wk06-001, wk06-019 |
| 임상 단계별 바이러스 안전성 계획, ICH Q5A 원칙 | wk06-002, wk06-005 |
| 모델 바이러스 선정·특성, Case B 세포(MuLV) | wk06-003, wk06-004, wk06-009 |
| 불활화·제거 기술과 효과 범위, 비외피 소형 바이러스 보강 | wk06-006, wk06-007 |
| Orthogonal 전략, low pH 조건 이탈 대응 | wk06-008, wk06-024 |
| DSP 소모품 원가(Amgen 사례) | wk06-010 |
| Protein A 공정 시간·레진 부피/cycle, titer 상승의 하류 영향 | wk06-011, wk06-012, wk06-013, int-012 |
| 낮은 층고·WFI 제약에서 SU 선택 | wk06-014 |
| PW/WFI 계통 | wk06-015, int-013 |
| Intensified 공정(고밀도 세포은행·perfusion seed), 연속 USP 비교 | wk06-016, wk06-017 |
| 연속 정제(ASAP·4-column PCC), DSP 발전 방향 | wk06-018, wk06-022 |
| 상업 정제 공정 비교(플랫폼 + 제품별 조정) | wk06-020 |
| 공정 시뮬레이션 흐름도, 버퍼·hold 탱크 공간 | wk06-021, wk06-023 |
| Cohn 혈장 분획 | wk06-025 |
| **(개념 구분)** CEX·AEX·HIC·SEC 원리, HCP vs 응집체 | wk06-029, wk06-030 |
| UF/DF 용어(retentate·DF buffer·single-pass), 모델 바이러스(BVDV·PRV·MVM·MuLV) | wk06-031, wk06-032 |

미출제 후보: 모델 바이러스 표의 나머지 특성(SV-40·Reo-3·HBV 등 크기·저항성), 혈장 분획 각 fraction의 산물.

## WK07 — GMP Engineering (시설 설계·건설·프로젝트 관리)

| 출제됨 | 문항 |
|---|---|
| 식당 비유(운영 요소 ↔ 제조 요소) | wk07-001 |
| GMP 시설 설계 4원칙, 21 CFR 211.42 | wk07-002, wk07-003 |
| 제품 특성(고활성·광·습도·온도·인화성)과 설계 | wk07-004, wk07-005, wk07-006 |
| 설계 요소(Process 중심), BFD·PFD | wk07-007, wk07-008 |
| 물질수지(design titer +15 %)와 산정 항목 | wk07-009, wk07-010, int-012 |
| 장비 배치(palletank)·MU vs SU 선택·자동화 | wk07-011, wk07-012, wk07-013 |
| Building & site | wk07-014 |
| 청정 등급(작업별, at rest vs operational), 마감 | wk07-015, wk07-016, wk07-017 |
| Material·personnel airlock | wk07-018, wk07-019 |
| Pre/post-viral 분리, GMP flow | wk07-020, wk07-021 |
| Clean vs black utility, Q&V 범위 | wk07-022, wk07-023, wk07-024, int-013 |
| HVAC 기능, 전력(UPS·디젤) | wk07-025, wk07-026 |
| Q&V 흐름, FAT 결함 대응, OQ 미완료 시 PV | wk07-027, wk07-028, int-014 |
| 프로젝트 단계, 통합(Q&V 동시 참여) | wk07-029, wk07-030 |
| Ballroom·single-use 밀폐 | wk07-031, wk07-032, int-011 |
| 임상 개발 단계 | wk07-033 |
| **(개념 구분)** FAT vs SAT, 다목적 vs 전용 시설, PAL vs MAL | wk07-037, wk07-038, wk07-039 |
| Pure·clean·black steam, 변경 관리·재적격성평가·재교정 | wk07-040, wk07-041 |
| PV·CV·CSV, PLC/SCADA vs MES/EBR | wk07-042, wk07-043 |

미출제 후보: HVAC 차압 계단(pressure cascade), 폐기물(waste) 흐름, Commissioning and Start-Up, Cost Control and Scheduling.

### WK06 강의 녹음 (10.07 — 약 3시간, 김영태)

공정 흐름 복습(앞 30분, WK04 녹음과 같은 포인트라 새로 내지 않음) 뒤 CFF(UF/DF) 실무, 재사용 소모품 관리, 크로마토그래피 조합·scale-up, Protein A 공정 설계 사례를 설명했다. 사용자 요청(2026.10.07)대로 **녹음 내용 위주로 내고, 사례·수치는 WK06 PDF(케이스 스터디 p.20–24, PW/WFI p.27)와 WK04 PDF(CFF p.86–87, p.103)로 보충**했다. 출처: `WK06 강의 녹음 mm:ss`.

| 출제됨 | 문항 |
|---|---|
| 기본 배지 vs 피드 배지(맥주 효모 비유, N-1 vs N 단계) | wk06-033 |
| CFF 원리(우유통·신장·투석기 비유), 농축 다음 DF인 이유(면접 기출), CEX→AEX 사이 UF/DF | wk06-034 ~ wk06-036 |
| 재사용 소모품(레진·카세트), CIP→SIP 순서, SIP에 습열을 쓰는 이유 | wk06-037 ~ wk06-039 |
| NWP(온도 보정 물 투과도), 보관 용액·소독, 과농축 후 헹굼 회수 | wk06-040 ~ wk06-042 |
| 재사용 횟수 판단(공정·품질), E&L, leached Protein A | wk06-043 ~ wk06-045 |
| 안전 여유(양에는 여유, 농도에는 없음) | wk06-046 |
| CEX→AEX vs AEX→CEX, 다량체에 HIC | wk06-047, wk06-048 |
| Scale-up(선속도·bed height 유지), 선속도가 너무 느릴 때, 결합 용량 vs DBC | wk06-049 ~ wk06-051 |
| 생산 현장 물 등급(PW vs WFI) 쓰임 | wk06-052 |
| (보관에서 복원) Protein A 전 CFF 농축, Protein A multi-cycle 비용·시간 | wk06-011, wk06-012 |

용어집 추가(no 57~68, `matchSealed` 56): Feed medium, Cassette filter, NWP, Storage solution, Sanitization, Over-concentration, SIP, E&L, Leached Protein A, Lifecycle study, Linear velocity, Bed height.

출제하지 않음: 공정 흐름 복습(wk04-077~113과 같은 포인트), 세포치료제에 제균 여과를 못 쓰는 이유(wk04-114와 같은 포인트), 컬럼 부피·Protein A 레진 양·공정 시간 계산 실습, 현업 시나리오 1·2(사이클 수 선택), 유리 컬럼 제품(XK·HiScale), SuperPro Designer·Gantt chart 같은 도구, 진로·면접 일화.

미출제 후보: 없음(녹음의 대표 포인트는 모두 냈다).

## 단답형 (PART III, 2026.10.08 — 실제 시험 형식: 4지선다 + 단답형, 50문항)

"외워야 할 Major한 것" 위주로 두 갈래를 만들었다. 강의 구석의 세부 수치·제품명은 단답형으로도 내지 않는다.

1. **핵심 용어 쓰기**(용어집 `"short": true` → `terms-*.json`의 `<prefix>s-<no>`, 164문항): 설명을 보고 용어를 쓴다. 단원별 — WK02 32, WK03 13, WK04 36, GMP01 13, GMP02 12, GMP03 12, WK06 21, WK07 25.
2. **핵심 사실 쓰기**(본문 파일, 47문항):

| 단원 | 문항 | 묻는 것 |
|---|---|---|
| WK02 | wk02-073 ~ wk02-080 | 세포은행 순서(MCB), 생산 시작 은행(WCB), temperature shift 32 ℃, QbD 순서(CQA), 항체 생산 시기(정지기), OTR ≥ OUR, 암모늄 출처(글루타민), scale-up 기준(P/V) |
| WK03 | wk03-025 ~ wk03-027 | 정제 3단계(Intermediate), 단백질 UV 280 nm, IEX 용출(염 농도) |
| WK04 | wk04-119 ~ wk04-128 | 제균 필터 0.2 µm, MF→UF→NF→RO, Protein A 용출 pH 3~3.5, CEX pH 5~6, 불순물 4총사(바이러스), 비외피 바이러스 20 nm, 친수성 필터 적심 액(물), 무균 의약품 3방법(무균 공정), AEX flow-through, 미생물 vs 동물세포(세포벽) |
| GMP01 | gmp01-020 ~ gmp01-023 | SAL 10⁻⁶, 동결건조 반마개, 바이알 알루미늄 캡, 완제 흐름(혼합·조제) |
| GMP02 | gmp02-026 ~ gmp02-030 | APS 배양 14일, Initial APS 연속 3회, Routine APS 6개월, RABS 주변 Grade B, First air |
| GMP03 | gmp03-035 ~ gmp03-039 | 압력 계위(에어락), VHP 6 log, ·OH 라디칼, 소독 3 log, IQ → OQ → PQ |
| WK06 | wk06-053 ~ wk06-058 | DSP 소모품 최대 비용(Protein A 레진), PW → 증류 → WFI, 직교 전략 최소 2단계, 농축 먼저(UF), CIP 먼저, NaOH 세척·소독 |
| WK07 | wk07-044 ~ wk07-049 | BFD → PFD → P&ID, Q&V 순서(PQ), Grade C 작업, 작업 중에도 같은 기준(Grade A), Pure steam, 임상 1상 |

미출제 후보(단답형): 새 자료가 오면 그 단원의 순서·핵심 값·핵심 용어를 함께 만든다.

## 통합(공정 연결) 문항

int-001 ~ int-010: 스케줄링, (int-002 mRNA 전환은 OT 제외로 보관), 여과 체인, shear·기포, worst case 논리, 잔류 H₂O₂–GPT, 공정별 IPC, 삼투압, DS→DP 전체 흐름, 설비·배양·경제성 trade-off.

int-011 ~ int-015: Ballroom 밀폐 붕괴 대응, titer 상승 → 하류·시설·변경관리, WFI 이상 대응, Q&V 순서(OQ → PV), QbD CPP → URS → Q&V.

int-019 ~ int-020(개념 구분): CIP·SIP·VHP, bracketing·worst case·design space.

int-021 ~ int-024(WK04 연결): 단계별 필터 종류, vent 필터 젖음 방지(배양기 vs WFI 탱크), 제균 필터 무결성 시험 시점(GMP01 + WK04), ATF·TFF의 retentate/permeate.

## 용어 정리 (PART I + 단답형 PART III, 자동 생성)

`glossary/<단원>.json` → `python3 tools/build_terms.py` → `questions/terms-<단원>.json`. 용어 1개당 1문항 — 약어·기호(MCB, TMP …)는 용어→정의(`r`), 낱말(Clarification, 최종멸균법 …)은 정의→용어(`d`) (2026.10, 절반으로 줄임; 용어에 `"drill"`로 직접 지정 가능), 같은 묶음 4개씩 짝짓기(`m`) 1문항. 기존 용어집에 덧붙인 용어는 `matchSealed` 뒤 번호로 따로 묶여, 이미 있던 짝짓기 id는 그대로다(WK04·GMP03 녹음 용어).

| 단원 | 용어 수 | 문항 수 | 주요 묶음(group) |
|---|---|---|---|
| WK02 | 90 | 152 (단답 32) | modality, 백신 플랫폼, 숙주·세포은행, 공정 흐름, 배양 방식·공정 강화, 관류 장치, 성장곡선, 배지·대사, 배양기·제어, QbD, scale-up, 교반·통기, 데이터 분석, 원가 |
| WK03 | 35 | 59 (단답 13) | 크로마토그래피 기본, 정제 단계, 레진 종류, 운전 모드·용출, 시스템 구성, 정제 후 분석, SEC·탈염, 레진 준비·공급 (녹음 기반) |
| WK04 | 89 | 154 (단답 36) | DSP 방법·불순물, 여과 기본·용도, 여과 방식·크기(MF·UF·NF·RO), 필터 재질·구조, 기공 등급, 기체 여과·vent, 필터 크기 산정, 필터 형태·펌프, TFF, 무결성 시험, (녹음) 공정 흐름·세포·정제·무균 |
| GMP01 | 41 | 68 (단답 13) | 제형, 멸균·무균, 조제, 부형제, 충전·용기, 품질 검사, 무균 환경, GMP 공통 |
| GMP02 | 30 | 53 (단답 12) | 차단 방식, RABS 구성, 규정(Annex 1·ISO 13408-1·PDA TR22), APS, 간섭, worst case, 실패 조치, EM |
| GMP03 | 34 | 59 (단답 12) | 아이솔레이터 원리·챔버, VHP cycle·조건, 사멸 원리, 적재, BI·CI·EI, cycle development, qualification, test location, glove, (녹음) 멸균 방식·BI 형태, 운영(SOP·GDP·개입) |
| WK06 | 38 | 74 (단답 21) | DSP 단계, UF/DF, 불순물, 크로마토그래피 설계, 바이러스 제거·규정·모델 바이러스, 혈장 분획, DSP 트렌드, PW/WFI, (녹음) 배지, CFF 운영, 세척·재사용, scale-up |
| WK07 | 47 | 92 (단답 25) | 식당 비유, 규정, 제품·제품 특성, 설계 요소·도면, 자동화, 부지, 청정 등급, 마감·airlock·흐름, clean/black utility, HVAC·전력, Q&V, 프로젝트 단계, 시설 트렌드, 임상 단계 |

용어집 미수록 후보: WK02 개별 아미노산 역할(Tyr·Phe·Ser 등), WK06 혈장 모델 바이러스(HAV·DHBV) 개별 항목, WK07 P&ID 기호·ISO 등급별 수치.

## 걸러 낸 문항·용어 (보관, 2026.10)

지엽적이라 출제하지 않는 문항은 `questions/archive/<단원>.json`에 그대로 보관한다(index.json에 없어 앱이 읽지 않음). 되살리려면 원래 파일로 옮기면 된다. 용어는 `glossary/<단원>.json`에서 `"drop": true`인 것.

| 단원 | 걸러 낸 본문 문항 | 걸러 낸 용어 |
|---|---|---|
| OT (단원 전체 제외) | 7개 — ot-{001, 002, 003, 004, 005, 007, 008} (+ int-002) | 6개 — Patent expiration, Market share, Equipment list, Utility consumption, 감가상각, Milestone |
| WK02 | 35개 — wk02-{005, 006, 007, 011, 013, 016, 019, 020, 022, 024, 026, 027, 028, 029, 030, 033, 036, 037, 040, 041, 042, 043, 045, 046, 048, 049, 051, 052, 053, 055, 056, 058, 060, 068, 071} | 43개 — PBT, VBT, TIL / NK 세포치료제, Recombinant protein platform, Virus platform, Bolus feed, Concentrated fed-batch, Dynamic perfusion, CRD, Hollow fiber membrane, Cell bleed, Permeate, Direct capture, Peak VCD, Inoculation density, Spent media analysis, pCO₂, Sampling port, Offline analysis, Exhaust cooler, Screening design, Optimization design, Ambr 15, Geometrical similarity, MSAT, Mixing time, Torque, VVM, Superficial gas velocity, Gassing-out method, Foam / Flooding, MVDA, PCA, VIP plot, Coefficient plot, Hybrid model, Soft sensor, Golden batch, Biopharma 4.0, Digital twin, Capital charge, Footprint, Major change |
| WK03 | 7개 — wk03-{007, 013, 015, 021, 022, 023, 024} | 14개 — Gradient mixer, Air trap, Pressure sensor, Fraction collector, Sephadex G-25, Fine fractionation, Superdex Increase, Superdex prep grade, Sephacryl S-100, Sephacryl S-400, Swelling, Packing, Scale-up, Supply diversification |
| WK04 | 57개 — wk04-{002, 004, 007, 009, 011, 012, 013, 019, 022, 023, 024, 026, 027, 028, 029, 031, 032, 033, 034, 035, 037, 038, 039, 041, 042, 043, 044, 045, 049, 050, 051, 052, 054, 055, 056, 057, 058, 061, 064, 065, 066, 069, 070, 071, 072, 073, 074, 078, 080, 084, 087, 090, 092, 093, 101, 106, 107} | 67개 — BFS, Media mitigation, Driving pressure difference, Combination filter, PES, Cellulose acetate, PP, Glass fiber, Diatomaceous earth, Asymmetric membrane, Membrane casting, Retention rate, Beta ratio, Tank collapse, Double vent system, Heated vent housing, Sieve effect, Impaction, Interception, Diffusion, Electrostatic interaction, MPPS, HEPA filter grade, Aerosol challenge test, Vmax, Pmax, Tmax, Pleated membrane, Sanitary clamp / Ferrule, SS 316L, Peristaltic pump, Diaphragm pump, Rotary lobe pump, Self-priming, Pressurized transfer, Gravity transfer, Crossflow rate, Optimum TMP, Continuous diafiltration, Batch diafiltration, Cassette, Hollow fiber module, Spiral-wound module, CWF, NWP, Membrane life cycle, System hold-up volume, Pressure drop test, Wetting angle, Surface tension, Min. bubble point, Max. bubble point, IT test limit, Reference wetting fluid, PDA TR 26, Plasma-derived product, Upstream process, Downstream process, Biosimilar, Beacon, Doubling time, Feeding strategy, Process development, High conductivity, mS/cm, Dilution, Utility |
| GMP01 | 4개 — gmp01-{004, 007, 011, 012} | 1개 — pH 조절제 |
| GMP02 | 11개 — gmp02-{007, 008, 010, 012, 013, 015, 016, 017, 018, 022, 024} | 12개 — RTP, ISO 13408-1, PDA TR22, 100 % 육안 검사, APS Holistic approach, Line speed, H/D 비, APS 충전량, 반복 APS, 재자격, 균 동정, 오버스필 |
| GMP03 | 12개 — gmp03-{003, 013, 016, 017, 022, 023, 025, 026, 029, 030, 031, 033} | 27개 — Dwell time, Distribution, Dosing rate, Maximum load, Minimum / Empty load, 흡착성 재질, Geobacillus stearothermophilus, Steel disk carrier, Fractional study, Temperature & humidity mapping, CI mapping, Edges of enclosure, Airflow challenging areas, Process critical positions, Leak rate, Audit trail, 잔류 H₂O₂ 허용 기준, Sterility testing isolator, Paper strip BI, Ampoule BI, Rogue BI, SOP, Glove port, Inherent intervention, C&Q, Chamber leak test, Bracketing |
| WK06 | 13개 — wk06-{004, 005, 009, 014, 016, 017, 018, 019, 021, 023, 024, 025, 032} | 30개 — Membrane adsorber, Diafiltration buffer, Continuous, Bulk drug substance, Linear flow rate, Resin cycling, Safety factor, Heat inactivation, EMEA 임상시험용 의약품 바이러스 가이드라인, Case B cell, MuLV, MVM, PPV, SV-40, PRV, Reo-3, BVDV, Cohn cold ethanol fractionation, IVIG, Body feed, PCC, Sanofi ASAP concept, Semi-continuous → Continuous DSP, Intensified seed, RO, Softener, Distribution loop, SuperPro Designer, Pool / Hold tank, Multi trains |
| WK07 | 19개 — wk07-{001, 003, 005, 006, 007, 009, 010, 011, 013, 014, 018, 019, 023, 024, 026, 028, 029, 030, 032} | 43개 — Facility, Starting material, Active substance, Recipe = Process, Direct / Indirect equipment, 21 CFR 211.42, Production forecast, Working shift model, Ex-proof, Process, GMP Facility Design, Building & Building Services, Bubble diagram, Design titer, Equipment sizing, Buffer palletank, Room layout, ISA-S88, Site master plan, Spine concept, Campus concept, ISO 14644-1, Coved corner, Sealed light fixture, Separation line, Step-over bench, Black steam, Chilled water, Recirculation air system, Diesel generator, VMP, Conceptual design, Basic / Detail engineering, Authority engineering, Tender, Commissioning & Start-up, Turnkey project, Technical facility management, Recalibration, Project integration, CNC, Aseptic connector / Tube welder, Modular construction |
| 통합 | 11개 — int-{002, 005, 006, 008, 010, 011, 012, 013, 015, 022, 024} | 0개 |
