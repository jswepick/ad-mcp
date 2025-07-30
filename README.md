# Multi-Platform Ads MCP Server

멀티 플랫폼 광고 관리를 위한 MCP (Model Context Protocol) 서버입니다.

## 🚀 빠른 시작

### 1. 설치 및 실행
```bash
git clone https://github.com/jswepick/ad-mcp
cd ad-mcp
npm install
node server.js
```

### 2. 기본 사용법
```
키워드:고병우 날짜:20250720-20250721 매체:페이스북
```

### 3. HTML 리포트 생성
```
키워드:임동규 날짜:20250721-20250724 매체:전체 html 파일 생성
```

## 📋 핵심 기능

### 🎯 정형화된 명령어 시스템
- **키워드 기반 검색**: 캠페인명이나 광고명으로 필터링
- **날짜 범위 지정**: 특정 기간의 성과 데이터 조회
- **매체별 필터링**: Facebook, Google, TikTok 개별 또는 통합 조회
- **리포트 타입**: 광고주용(제한된 지표) vs 내부용(전체 지표)
- **커스텀 제목**: 리포트 제목 개인화

### 📊 HTML 리포트 생성
- **중앙화된 파일 관리**: 모든 사용자가 Render 서버에서 다운로드
- **인터랙티브 필터링**: 날짜, 캠페인명, 매체별 동적 필터
- **환율 자동 환산**: Facebook 달러 → 원화 실시간 환산
- **반응형 디자인**: 모바일 및 데스크톱 최적화

### 💱 환율 기능
- **한국수출입은행 API**: 실시간 USD/KRW 환율 조회
- **자동 캐싱**: 일 1회 환율 업데이트 (매일 12시 기준)
- **Facebook 전용**: USD로 받는 Facebook 데이터를 KRW로 통일
- **오류 처리**: API 실패시 이전 환율 또는 기본값 사용

## 📖 사용법 가이드

### 명령어 문법
```
키워드:[검색어] 날짜:[기간] 매체:[플랫폼] 리포트:[타입] 제목:[제목]
```

### 매개변수 설명

#### 1. 키워드 (필수)
```bash
키워드:고병우           # 단일 키워드
키워드:고병우,치과      # 다중 키워드 (AND 조건)
키워드:                # 빈 키워드 (전체 조회)
```

#### 2. 날짜 (선택, 기본값: 어제)
```bash
날짜:20250720          # 단일 날짜
날짜:20250720-20250721 # 날짜 범위
날짜:어제              # 어제
날짜:오늘              # 오늘
날짜:7일               # 최근 7일
```

#### 3. 매체 (선택, 기본값: 전체)
```bash
매체:페이스북          # Facebook만
매체:구글             # Google Ads만
매체:틱톡             # TikTok Ads만
매체:facebook         # 영문도 지원
매체:페이스북,구글     # 복수 선택
매체:전체             # 모든 매체
```

#### 4. 리포트 타입 (선택, 기본값: 내부)
```bash
리포트:내부           # 모든 지표 (광고비, CPC, CPM 등)
리포트:광고주         # 제한된 지표 (노출수, 클릭수, CTR, 전환수, 전환율)
```

#### 5. 커스텀 제목 (선택)
```bash
제목:2024년 4분기 치과 캠페인 성과
제목:모모성형외과 일일 성과 리포트
```

### 사용 예시

#### 기본 조회
```bash
키워드:고병우 날짜:20250720-20250721 매체:페이스북
```

#### 광고주용 리포트
```bash
키워드:치과 날짜:7일 매체:전체 리포트:광고주
```

#### 커스텀 제목 리포트
```bash
키워드:성형외과 날짜:오늘 매체:구글 리포트:광고주 제목:모모성형외과 일일 성과 리포트
```

#### HTML 파일 생성
```bash
키워드:임동규 날짜:20250721-20250724 매체:전체 html 파일 생성
```

## 지원 플랫폼

### ✅ Facebook Ads (완전 구현)
- 캠페인 성과 조회 및 관리
- 광고세트 성과 조회 및 관리  
- 광고 성과 조회 및 관리
- 크리에이티브 상세 정보 조회
- 일괄 상태 변경 기능

### 🔧 Google Ads (구현 예정)
- 캠페인 성과 조회
- 키워드 성과 분석
- 검색어 리포트
- 광고그룹 관리

### 🔧 TikTok Ads (구현 예정)
- 캠페인 성과 조회
- 동영상 광고 성과 분석
- 오디언스 인사이트
- 참여율 분석

## 프로젝트 구조

```
new-mcp/
├── server.js                       # 메인 서버 (라우팅 중심)
├── package.json
├── Dockerfile
├── README.md
├── services/                       # 플랫폼별 서비스
│   ├── facebook-ads-service.js     # Facebook Ads 로직
│   ├── google-ads-service.js       # Google Ads 로직 (기본 구조)
│   └── tiktok-ads-service.js       # TikTok Ads 로직 (기본 구조)
└── utils/                          # 공통 유틸리티
    ├── date-utils.js               # 날짜 계산 함수
    └── format-utils.js             # 포맷팅 함수
```

## ⚙️ 환경 변수 설정

### Facebook Ads (필수)
```bash
META_ACCESS_TOKEN=your_facebook_access_token
META_AD_ACCOUNT_ID=your_ad_account_id
```

### Google Ads (선택)
```bash
GOOGLE_ADS_CLIENT_ID=your_client_id
GOOGLE_ADS_CLIENT_SECRET=your_client_secret
GOOGLE_ADS_REFRESH_TOKEN=your_refresh_token
GOOGLE_ADS_DEVELOPER_TOKEN=your_developer_token
GOOGLE_ADS_CUSTOMER_ID=your_customer_id
```

### TikTok Ads (선택)
```bash
TIKTOK_ACCESS_TOKEN=your_access_token
TIKTOK_ADVERTISER_ID=your_advertiser_id
TIKTOK_APP_ID=your_app_id
TIKTOK_SECRET=your_secret
```

### 환율 API (권장)
```bash
# 한국수출입은행 환율 API 키 (Facebook 달러→원화 환산용)
KOREAEXIM_API_KEY=your_koreaexim_api_key
```
> 💡 **환율 API 키 발급**: [한국수출입은행 오픈API](https://oapi.koreaexim.go.kr/)에서 무료 발급 (일 1000회 제한)

### 서버 설정
```bash
PORT=3000
NODE_ENV=development
```

## 🛠️ MCP 도구 목록

### 📊 통합 검색 도구 (주요)
- `structured_campaign_search` - 정형화된 명령어로 캠페인 검색 및 성과 조회
- `generate_html_file` - HTML 리포트 파일 생성 및 다운로드 링크 제공
- `search_help` - 명령어 사용법 및 예시 제공
- `test_html_output` - HTML 출력 렌더링 테스트

### Facebook Ads 도구들
- `facebook_get_campaign_performance` - 캠페인 성과 조회
- `facebook_get_campaign_list` - 캠페인 목록 조회
- `facebook_toggle_campaign_status` - 캠페인 상태 변경
- `facebook_bulk_toggle_campaigns` - 캠페인 일괄 상태 변경
- `facebook_get_adset_list` - 광고세트 목록 조회
- `facebook_get_adset_performance` - 광고세트 성과 조회
- `facebook_toggle_adset_status` - 광고세트 상태 변경
- `facebook_bulk_toggle_adsets` - 광고세트 일괄 상태 변경
- `facebook_get_ad_list` - 광고 목록 조회
- `facebook_get_ad_performance` - 광고 성과 조회
- `facebook_toggle_ad_status` - 광고 상태 변경
- `facebook_bulk_toggle_ads` - 광고 일괄 상태 변경
- `facebook_get_ad_images` - 광고 이미지 조회
- `facebook_get_ad_creative_details` - 크리에이티브 상세 정보

### Google Ads 도구들 (구현 예정)
- `google_get_campaign_performance` - 캠페인 성과 조회
- `google_get_campaign_list` - 캠페인 목록 조회
- `google_toggle_campaign_status` - 캠페인 상태 변경
- `google_get_keyword_performance` - 키워드 성과 조회
- `google_get_search_terms` - 검색어 리포트

### TikTok Ads 도구들 (구현 예정)
- `tiktok_get_campaign_performance` - 캠페인 성과 조회
- `tiktok_get_campaign_list` - 캠페인 목록 조회
- `tiktok_toggle_campaign_status` - 캠페인 상태 변경
- `tiktok_get_video_performance` - 동영상 성과 조회
- `tiktok_get_audience_insights` - 오디언스 인사이트

## 💻 Claude Desktop 사용법

### 1. MCP 서버 설정
1. 프로젝트를 로컬에서 실행: `node server.js`
2. Claude Desktop에서 MCP 서버 연결
3. 자연어로 요청하면 자동으로 적절한 도구 선택

### 2. 자연어 요청 예시
```
# 기본 검색
"키워드 임동규로 7월 21일부터 24일까지 전체 매체 성과를 조회해줘"

# HTML 리포트 생성
"키워드 고병우로 페이스북 어제 성과를 HTML 파일로 만들어줘"

# 광고주용 리포트
"치과 캠페인 최근 7일 성과를 광고주용 리포트로 생성해줘"

# 커스텀 제목 리포트
"성형외과 캠페인을 모모성형외과 리포트 제목으로 HTML 만들어줘"
```

### 3. 직접 명령어 사용
```
키워드:임동규 날짜:20250721-20250724 매체:전체 HTML 파일 생성
```

### 레거시 지원
하위 호환성을 위해 기존 Facebook 도구들은 접두사 없이도 사용 가능합니다:
- `get_campaign_performance` → `facebook_get_campaign_performance`
- `toggle_campaign_status` → `facebook_toggle_campaign_status`
- 등등...

## 실행 방법

### 개발 환경
```bash
npm install
npm run dev
```

### 프로덕션 환경
```bash
npm install --production
npm start
```

### Docker
```bash
docker build -t multi-platform-ads-mcp .
docker run -p 3000:3000 --env-file .env multi-platform-ads-mcp
```

## 엔드포인트

- `GET /` - 서버 정보 및 활성화된 플랫폼 확인
- `GET /health` - 헬스체크 및 상태 확인
- `GET /sse` - Server-Sent Events (MCP 연결)
- `POST /message` - MCP 메시지 처리

## 특징

### 🔧 모듈화된 구조
- 플랫폼별로 독립적인 서비스 파일
- 공통 기능은 utils로 분리
- 확장성과 유지보수성 향상

### 🔄 하위 호환성
- 기존 Facebook 도구들은 접두사 없이도 동작
- 점진적 마이그레이션 지원

### 🚀 성능 최적화
- 플랫폼별 조건부 로딩
- 환경변수 기반 서비스 활성화

### 📊 통합 관리
- 여러 플랫폼의 광고를 하나의 서버에서 관리
- 일관된 API 인터페이스 제공

## 📈 개발 로드맵

### 완료된 기능 ✅
- **Facebook Ads 완전 구현**: 캠페인, 광고세트, 광고 관리
- **Google Ads 기본 구현**: 캠페인 성과 조회 및 관리
- **TikTok Ads 기본 구현**: 캠페인 성과 조회
- **정형화된 명령어 시스템**: 키워드 기반 통합 검색
- **HTML 리포트 생성**: 인터랙티브 필터링 및 중앙화된 파일 관리
- **환율 자동 환산**: Facebook USD → KRW 실시간 환산
- **리포트 타입 구분**: 광고주용 vs 내부용 리포트
- **커스텀 제목**: 리포트 개인화 기능

### 개발 예정 🔧
1. **Phase 2**: Google Ads 고급 기능 (키워드 분석, 검색어 리포트)
2. **Phase 3**: TikTok Ads 고급 기능 (동영상 성과, 오디언스 인사이트)
3. **Phase 4**: 플랫폼 간 비교 및 통합 분석 대시보드
4. **Phase 5**: 자동화 및 최적화 기능 (자동 입찰, 예산 배분)
5. **Phase 6**: 실시간 알림 및 모니터링 시스템

## 기여 방법

각 플랫폼별로 독립적인 개발이 가능합니다:
- `services/facebook-ads-service.js` - Facebook 관련 기능
- `services/google-ads-service.js` - Google 관련 기능  
- `services/tiktok-ads-service.js` - TikTok 관련 기능
- `utils/` - 공통 유틸리티 함수들