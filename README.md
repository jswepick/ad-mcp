# Multi-Platform Ads MCP Server

멀티 플랫폼 광고 관리를 위한 MCP (Model Context Protocol) 서버입니다.

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

## 환경 변수

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

### 기타
```bash
PORT=3000
```

## 도구 목록

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

## 개발 로드맵

1. ✅ **Phase 1**: Facebook Ads 완전 구현 및 구조화
2. 🔧 **Phase 2**: Google Ads API 연동 및 구현
3. 🔧 **Phase 3**: TikTok Ads API 연동 및 구현
4. 🔧 **Phase 4**: 플랫폼 간 비교 및 통합 분석 기능
5. 🔧 **Phase 5**: 자동화 및 최적화 기능

## 기여 방법

각 플랫폼별로 독립적인 개발이 가능합니다:
- `services/facebook-ads-service.js` - Facebook 관련 기능
- `services/google-ads-service.js` - Google 관련 기능  
- `services/tiktok-ads-service.js` - TikTok 관련 기능
- `utils/` - 공통 유틸리티 함수들