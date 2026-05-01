# Design Principles — Mingyu Lee personal site

이 문서는 다음 작업을 이어받는 사람(또는 LLM)을 위한 **디자인 시스템 설명서**다. 새 페이지를 추가하거나 기존 컴포넌트를 변형할 때, 이 문서의 규칙을 지키면 사이트 전체 톤이 일관되게 유지된다.

---

## 1. 컨셉 한 줄

> **"Princeton/Stanford CS 랩 홈페이지처럼, 종이 위에 잉크로 인쇄된 학술 페이퍼" 톤의 개인 사이트.**

수식어로 표현하자면: *quiet, paper-like, editorial, serif-led, monochrome with one warm tint*.

피해야 할 것:
- 컬러풀한 그라데이션 / glassmorphism / 네온 / SaaS 랜딩 페이지 스타일
- 둥근 cards에 짙은 shadow + accent border
- 이모지, 일러스트 SVG 슬롭, 아이콘 폭격
- "Hero · Features · Testimonials · CTA" 같은 마케팅 사이트 레이아웃
- Inter / Roboto / system-ui 일변도

목표 톤은 **편집 디자인(editorial)**이다. 책·저널·전시 카탈로그에 가깝고, 웹앱이 아니다.

---

## 2. 디자인 토큰 (`styles/tokens.css`)

모든 시각 결정은 토큰을 거친다. 새 컴포넌트를 만들 때 **하드코딩된 색·사이즈·간격을 절대 쓰지 말 것**. 토큰을 쓰면 사이트 전체를 한 번에 톤 조절할 수 있다.

### 2.1 컬러

| 토큰 | 역할 |
|---|---|
| `--paper` | 메인 배경. 살짝 크림빛 종이색 |
| `--paper-2` | 보조 배경. mentoring 박스 등 살짝 강조 영역 |
| `--bg-2` | 미디어/이미지 placeholder 배경 |
| `--ink` | 본문 텍스트 — 잉크 블랙 (순흑이 아니라 따뜻한 검정) |
| `--ink-2` | 본문 보조 — 한 단계 옅음 |
| `--ink-3` | 메타 텍스트 (날짜, eyebrow 라벨 등) |
| `--rule` | 모든 라인 구분선 |

**색은 이게 전부다.** Accent color, brand color, success/warning 같은 시스템 컬러는 없다. 강조가 필요할 땐 *italic serif*, *uppercase eyebrow*, 또는 *border line*으로 처리한다.

### 2.2 타이포그래피

세 패밀리만:
- `--serif` — 헤드라인, 본문 lede, 인용. **사이트의 목소리.**
- `--sans` — UI 라벨(nav, eyebrow, 메타데이터, 버튼). 정보 전달용.
- `--mono` — 코드, 식별자(파일명, 프로젝트 코드명).

쓰는 비율: serif 70%, sans 25%, mono 5%. **항상 이 비율을 유지.** sans-serif가 본문에 들어가면 톤이 무너진다.

폰트 사이즈 스케일: `--fs-xs / sm / md / lg / xl / 2xl / 3xl`. 임의 px 금지.

### 2.3 Spacing

`--s-1` (4px) ~ `--s-10` (96px) 까지 10단계. 모든 padding/margin/gap에 사용. **임의 px 금지.** 두 토큰 사이 값이 필요하면 토큰을 추가하지 말고 인접 토큰 중 하나로 결정.

### 2.4 라인 두께

선은 `1px solid var(--rule)` 한 종류만. 굵은 선이 필요한 부분(hero·contact-card 등)은 `1px solid var(--ink)`. **2px+, dashed, dotted 모두 금지.**

---

## 3. 레이아웃 원칙

### 3.1 컨테이너

모든 페이지 본문은 `.container`로 감싸 max-width로 제한된다. 풀블리드 레이아웃은 사용하지 않는다 — 페이퍼 페이지의 메타포가 깨지기 때문.

### 3.2 그리드 vs 인라인

UI 요소들이 옆으로 나열되는 곳은 **반드시 flex/grid + gap**. 인라인 흐름·연속된 margin-right로 spacing을 만들지 말 것.

### 3.3 헤더와 hero

- `<header class="site-header">`는 모든 페이지에서 **글자 그대로 동일**해야 한다. 브랜드는 항상 `Mingyu Lee` (글리프·subtitle 없음). nav 항목은 Research / Publications / Projects & Demos / Teaching / CV 5개 고정 순서.
- 각 페이지에선 현재 페이지의 nav 링크에 `class="is-current"`를 추가.
- 홈에만 `<section class="hero">` (큰 이름 + 인사말 + 우측 원형 사진 + Elsewhere sidecard)가 있다. 다른 페이지는 `<section>` + `<div class="eyebrow">` + `<h1>` + `<p class="lede">` 패턴.

### 3.4 섹션 구조 (홈)

홈의 §01–§04 섹션은 `<details class="section section--collapsible">`로 접힌다. summary에는 `§NN / 라벨` (sans, uppercase) + 큰 serif 제목 + 짧은 lede가 들어간다. 본문은 `<div class="section__body">`로 감싸야 JS 슬라이드 애니메이션이 작동한다. §05 Contact는 collapsible이 아니라 항상 보이는 일반 section.

새 섹션을 추가할 땐:
```html
<details class="section section--collapsible">
  <summary class="section__summary"><div class="section__head-inner">
    <div class="section__num">§NN / Topic</div>
    <h2 class="section__title">Section title</h2>
    <p class="section__lede">한 줄로 짧게.</p>
  </div></summary>
  <div class="section__body">
    ...content...
  </div>
</details>
```
페이지 하단의 `<script>`가 자동으로 처리한다.

---

## 4. 카피라이팅 원칙

이 사이트는 **한 줄로 끝나는** 게 기본이다.

- 모든 lede는 한 문장. 가능하면 12 단어 이내.
- "I'm passionate about…", "exploring the intersection of…", "leveraging…" 같은 부풀린 표현 금지.
- "Always happy to talk about anything!" 처럼 짧고 사람다운 문장이 이 사이트의 톤이다.
- 학술적 정확성이 필요한 곳(Research thread 본문, Publications abstract)에서만 길어져도 된다 — 그 외엔 절제.
- 대시는 `—` (em-dash, 사이 공백 있음). hyphen `-`은 합성어에만.
- 숫자/날짜는 `2026 · 04` 처럼 가운뎃점으로 분리.

---

## 5. 컴포넌트 카탈로그

`styles/components.css`에 다음 컴포넌트가 정의되어 있다. 새 페이지를 만들 때는 이 컴포넌트들을 **재조합**해서 만들고, 새 컴포넌트를 함부로 추가하지 않는다.

| 컴포넌트 | 용도 |
|---|---|
| `.eyebrow` | 작은 sans-serif 라벨 (uppercase, letter-spacing). h1 위에 |
| `.lede` | h1 아래의 한 줄 요약 (serif, ink-2) |
| `.btn`, `.btn--primary`, `.btn--ghost` | 사각 1px 보더 버튼. 둥근 모서리·shadow 없음 |
| `.hero`, `.hero__id`, `.hero__thesis`, `.hero__interests`, `.hero__portrait-lg`, `.hero__sidecard` | 홈 hero 전용 |
| `.section`, `.section--collapsible`, `.section__summary`, `.section__body` | 접히는 섹션 |
| `.themes` + `.theme` | 연구 thread 카드 그리드 (홈 §01) |
| `.projects` + `.project` | 프로젝트 카드 그리드 |
| `.notes` + `.note` | 글/업데이트 리스트 (날짜·제목·요약·카테고리) |
| `.update` | 짧은 timeline 항목 |
| `.contact-card` | 1px ink 보더 박스. lede + 우측 주소 |
| `.site-footer` + `.colophon` | 푸터 |
| `.thread` (research.html) | research 페이지의 한 thread 블록 |
| `.pub` (publications.html) | 한 publication entry |
| `.cv-block` (cv.html) | CV 한 섹션 (Education/Experience/Awards…) |

---

## 6. 인터랙션·애니메이션 원칙

- 호버 효과는 **거의 없음**. 링크는 `border-bottom`으로 표시되고, 호버 시 `color: var(--ink)`로 살짝 진해지는 정도.
- 클릭 가능한 카드 호버 시 백그라운드 살짝 (rgba 0,0,0,0.02). transform·shadow 사용 금지.
- 화면 진입 애니메이션, scroll-triggered fade-in 같은 것 절대 금지. 페이지는 즉시 종이처럼 그 자리에 있다.
- 유일하게 정성스러운 애니메이션은 **§01–§04 섹션의 슬라이드 토글** — 320ms cubic-bezier(0.22, 0.8, 0.36, 1), height + opacity. 이 곡선을 새 애니메이션에도 그대로 쓸 것.

---

## 7. 이미지 처리

- 인물 사진: 원형 마스크 (`border-radius: 50%`)로 자른다. 정사각 비율 유지.
- 사진은 `filter: saturate(0.94) contrast(1.02)` 약간 적용 — 페이퍼 톤에 맞추기 위함.
- 일러스트는 사용하지 않는다. 시각 요소가 필요하면 1px 보더 박스 + serif 타이포 + 숫자 라벨 (e.g. `01`, `02`)로 충분.
- 차트나 다이어그램이 들어갈 자리에는 회색 박스(placeholder) + 캡션. 실제 자료가 준비되기 전까진 placeholder가 더 정직하다.

---

## 8. 반응형

`@media (max-width: 720px)`에서 한 번만 적용. 주요 변환:
- hero 1.9fr 1fr → 1fr (사진이 본문 위로)
- 모든 그리드 → 1fr
- nav가 wrap

별도의 mobile.html(`pages/home-mobile.html`)이 존재하지만, GitHub Pages 운영 시엔 **버리고 데스크톱 페이지의 미디어쿼리만 다듬는 것**을 권장.

---

## 9. 새 페이지·섹션 추가 워크플로

1. 가장 가까운 기존 페이지를 복사한다 (예: 새 단독 페이지 → `teaching.html` 복사).
2. `<header>`의 nav 항목을 새 페이지에도 맞게 추가하고, **모든 다른 페이지의 nav에도** 같은 항목을 추가한다.
3. 본문은 기존 컴포넌트(`.eyebrow + h1 + .lede`, `.themes`, `.notes`, `.projects` 등)로 조립한다.
4. 새 컴포넌트가 정말 필요하면 `components.css`의 적절한 섹션 끝에 추가하고, 토큰만 사용한다.
5. 텍스트는 §4 원칙대로 한 줄.

## 10. 자주 하는 실수 체크리스트

- [ ] 텍스트가 두 문장 이상 늘어났다 → 한 문장으로 줄여라.
- [ ] 색을 추가하고 싶다 → 추가하지 말고 italic / eyebrow / border로 강조해라.
- [ ] hover에 transform이나 shadow가 들어갔다 → 빼라.
- [ ] 둥근 모서리가 들어갔다 → 빼라 (사진 원형 제외).
- [ ] sans-serif가 본문에 들어갔다 → serif로 돌려라.
- [ ] 새 폰트 패밀리를 추가했다 → 추가하지 마라.
- [ ] hardcoded px가 들어갔다 → 토큰으로 바꿔라.

---

이 원칙들만 지키면 새 페이지·새 섹션·새 콘텐츠가 들어와도 사이트가 한 사람의 작업으로 보인다. 톤을 깨고 싶을 땐 **빼는 방향**으로 깨라 — 더하는 게 아니라.
