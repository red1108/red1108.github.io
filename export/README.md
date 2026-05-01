# Mingyu Lee — Personal Site

GitHub Pages용 정적 사이트. 빌드 도구 없이 HTML/CSS만으로 동작.

## 폴더 구조

```
export/
├── index.html              ← 홈 (데스크톱). GitHub Pages 진입점
├── mobile.html             ← 모바일 전용 레이아웃 (선택)
├── research.html           ← Research
├── publications.html       ← Publications
├── projects.html           ← Projects 리스트
├── projects/
│   └── autovqe.html        ← Project 상세 (템플릿)
├── teaching.html           ← Teaching
├── cv.html                 ← CV
├── styles/
│   ├── tokens.css          ← 디자인 토큰 (색·폰트·spacing 변수)
│   └── components.css      ← 모든 컴포넌트 스타일
└── assets/
    ├── profile.png         ← 원본 인물 사진
    ├── profile-avatar.png  ← 정사각 얼굴 crop (작은 ID용 — 현재 미사용)
    └── profile-wide.png    ← zoom-out 버전 (홈 hero 우측 사진에 사용)
```

## 실제 사용 중인 파일

홈에서 진입 → 다음 파일들이 서로 링크되어 있음:
- `index.html`, `research.html`, `publications.html`, `projects.html`, `projects/autovqe.html`, `teaching.html`, `cv.html`
- 공유 스타일: `styles/tokens.css` + `styles/components.css`
- 홈 hero 사진: `assets/profile-wide.png`

`mobile.html`은 별도 모바일 레이아웃 — GitHub Pages에선 굳이 안 써도 되고, 데스크톱 페이지에 미디어쿼리만 다듬으면 충분함.

## 어떻게 수정하나

### 1. 색 / 폰트 / spacing 바꾸기
`styles/tokens.css`에 변수가 모여 있음:
- `--paper`, `--paper-2`: 배경 (warm cream)
- `--ink`, `--ink-2`, `--ink-3`: 텍스트 (진→연)
- `--rule`: 라인 구분선
- `--serif`, `--sans`, `--mono`: 폰트 패밀리
- `--fs-xs … --fs-3xl`: 폰트 사이즈 스케일
- `--s-1 … --s-10`: spacing 스케일

이 값만 바꿔도 사이트 전체 톤이 일관되게 따라 바뀜.

### 2. 컴포넌트 모양 바꾸기
`styles/components.css`. 섹션별로 주석으로 나뉘어 있음:
- `Site header / nav`
- `Hero` — 홈 첫 화면 (좌측 텍스트 + 우측 원형 사진 + sidecard)
- `Section` — `§01/02…` 접히는 섹션 (`details.section--collapsible`)
- `Themes / Projects / Notes / Updates / Contact / Footer`

### 3. 콘텐츠 바꾸기
각 HTML 파일 안에 직접 텍스트가 있음 — 빌드 없음, 그냥 텍스트 편집.
- 홈 자기소개: `index.html`의 `<section class="hero">` 안 `.hero__role` / `.hero__id-aff` / `.hero__name` / `.hero__thesis` / `.hero__interests`
- Elsewhere 링크: 같은 hero 안 `.hero__sidecard` (GitHub / Scholar / LinkedIn / Email)
- 홈 §01–§04 접히는 섹션: `<details class="section section--collapsible">`. 각 섹션 안의 카드 텍스트만 바꾸면 됨.
- 사진 교체: `assets/profile-wide.png`를 같은 이름으로 덮어쓰기 (또는 `index.html`에서 `<img src="...">` 경로 변경).

### 4. 슬라이드 토글 동작
`index.html` 맨 아래 `<script>`. `<details class="section--collapsible">`의 default toggle을 막고 height 트윈으로 부드럽게 여닫음. 새 섹션을 추가해도 같은 클래스만 붙이면 자동 적용.

### 5. 헤더 / 네비게이션
모든 페이지 상단에 동일한 `<header class="site-header">` — 브랜드는 "Mingyu Lee", nav 5개 항목 (Research / Publications / Projects & Demos / Teaching / CV). 새 페이지를 추가하면 모든 페이지의 `<nav>`에 같은 항목을 추가해야 함 (지루하지만 정적 사이트의 한계).

## GitHub Pages에 올리기

1. 새 repo 만들기 (예: `red1108.github.io` 또는 임의 이름).
2. `export/` 안의 모든 파일을 repo 루트에 그대로 push.
3. Repo Settings → Pages → Source를 `main` 브랜치 / `/` (root)로 설정.
4. 1–2분 후 `https://<username>.github.io/<repo>/` 에서 접속 가능.

빌드 단계 없음. Jekyll도 안 씀 (필요하면 root에 `.nojekyll` 빈 파일 추가).

## 알아두면 좋은 점

- 모든 페이지가 인라인 텍스트 + 공유 CSS 구조라 LLM/에디터로 수정하기 쉬움.
- 텍스트는 영문 + serif 헤드라인 톤 (Source Serif 4 / EB Garamond 계열, sans는 Inter Tight). 폰트는 Google Fonts CDN으로 로드됨 — 오프라인 사용 시 `tokens.css`의 `@import` 부분 확인.
- 홈에서 §01–§04는 클릭으로 접히고, §05 Contact는 항상 펼쳐져 있음.
- `home-alt-asym.html`, `home-alt-titlepage.html`, `home-mobile.html` 같은 변형은 export에서 뺐음 — 필요하면 원본 프로젝트에서 가져다 쓰면 됨.
