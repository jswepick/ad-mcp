# 당근마켓 Google Sheets 연동 설정 가이드

## 1. Google Service Account 설정

### 1.1 Google Cloud Console에서 프로젝트 생성
1. [Google Cloud Console](https://console.cloud.google.com/) 접속
2. 새 프로젝트 생성 또는 기존 프로젝트 선택
3. 프로젝트 이름: `carrot-ads-integration` (예시)

### 1.2 Google Sheets API 활성화
1. 좌측 메뉴 > API 및 서비스 > 라이브러리
2. "Google Sheets API" 검색 후 선택
3. "사용" 버튼 클릭

### 1.3 Service Account 생성
1. 좌측 메뉴 > API 및 서비스 > 사용자 인증 정보
2. "사용자 인증 정보 만들기" > "서비스 계정" 선택
3. 서비스 계정 세부정보:
   - 서비스 계정 이름: `carrot-ads-reader`
   - 서비스 계정 ID: `carrot-ads-reader` (자동 생성)
   - 설명: `당근마켓 광고 성과 데이터 조회용`

### 1.4 Service Account 키 생성
1. 생성된 서비스 계정 클릭
2. "키" 탭 > "키 추가" > "새 키 만들기"
3. 키 유형: JSON 선택
4. 다운로드된 JSON 파일 보관 (중요!)

## 2. Google Sheets 설정

### 2.1 스프레드시트 준비
1. Google Sheets에서 새 스프레드시트 생성
2. 시트명: `성과데이터` (또는 원하는 이름)
3. 헤더 행(첫 번째 행) 설정:
   ```
   A1: 날짜
   B1: 매체  
   C1: 캠페인명
   D1: 캠페인ID
   E1: 광고세트명
   F1: 광고세트ID
   G1: 광고소재명
   H1: 광고소재ID
   I1: 광고비
   J1: 노출
   K1: 클릭
   L1: 부가세
   M1: 잠재고객 수집 수
   ```

### 2.2 스프레드시트 공유
1. 생성된 스프레드시트에서 "공유" 버튼 클릭
2. Service Account 이메일 주소 추가 (JSON 파일의 client_email 값)
3. 권한: "뷰어" 설정
4. 스프레드시트 ID 복사 (URL에서 `/d/` 뒤의 긴 문자열)

## 3. 환경변수 설정

### 3.1 필수 환경변수
`.env` 파일에 다음 변수들을 추가하세요:

```bash
# 당근마켓 Google Sheets 연동
GOOGLE_SHEETS_SERVICE_ACCOUNT_KEY='{"type":"service_account","project_id":"your-project-id",...}'
CARROT_SPREADSHEET_ID="1ABC123def456GHI789jkl"
CARROT_SHEET_NAME="성과데이터"
CARROT_SHEET_RANGE="A:M"
```

### 3.2 환경변수 설명
- `GOOGLE_SHEETS_SERVICE_ACCOUNT_KEY`: 다운로드한 JSON 키 파일의 전체 내용 (문자열로)
- `CARROT_SPREADSHEET_ID`: Google Sheets URL의 스프레드시트 ID 부분
- `CARROT_SHEET_NAME`: 데이터가 있는 시트 이름 (기본값: "성과데이터")
- `CARROT_SHEET_RANGE`: 조회할 범위 (기본값: "A:M")

### 3.3 JSON 키 설정 방법
다운로드한 JSON 파일 내용을 한 줄로 변환하여 환경변수로 설정:

**방법 1: 온라인 툴 사용**
1. JSON Minifier 도구 사용 (예: jsonformatter.curiousconcept.com)
2. JSON 내용을 복사하여 minify
3. 결과를 따옴표로 감싸서 환경변수로 설정

**방법 2: 명령어 사용**
```bash
# Linux/Mac
export GOOGLE_SHEETS_SERVICE_ACCOUNT_KEY="$(cat path/to/service-account-key.json | tr -d '\n')"

# Windows PowerShell  
$env:GOOGLE_SHEETS_SERVICE_ACCOUNT_KEY = (Get-Content path\to\service-account-key.json -Raw) -replace '\s',''
```

## 4. 데이터 형식 예시

### 4.1 스프레드시트 데이터 예시
```
날짜        매체    캠페인명           캠페인ID  광고세트명    광고세트ID  광고소재명       광고소재ID  광고비   노출   클릭  부가세  잠재고객 수집 수
2025-07-21  당근    울산치과모집       CAR001    기본광고세트   AS001      치과광고소재1    AD001      50000   1000   50   5000    5
2025-07-21  당근    부산펜션예약       CAR002    여름시즌      AS002      펜션광고소재1    AD002      80000   1500   75   8000    8
2025-07-22  당근    울산치과모집       CAR001    기본광고세트   AS001      치과광고소재1    AD001      55000   1100   60   5500    6
```

### 4.2 주의사항
- 날짜는 YYYY-MM-DD 형식 또는 Excel 날짜 형식 사용
- 숫자 필드에 쉼표(,) 포함 가능 (자동으로 제거됨)
- 빈 셀은 0으로 처리됨
- 매체 필드는 "당근" 고정값 권장

## 5. 테스트 및 확인

### 5.1 연동 테스트
```bash
# 서버 실행
npm start

# 테스트 명령어 (MCP 클라이언트에서)
키워드:치과 날짜:2025-07-21-2025-07-22 매체:당근마켓
```

### 5.2 오류 해결
- **인증 오류**: Service Account 키와 스프레드시트 공유 설정 확인
- **데이터 없음**: 스프레드시트 ID와 시트명 확인
- **파싱 오류**: 데이터 형식과 헤더 순서 확인

## 6. 보안 주의사항

### 6.1 Service Account 키 보안
- JSON 키 파일을 Git에 커밋하지 마세요
- 환경변수로만 관리하고 안전한 곳에 백업
- 정기적으로 키를 회전(갱신)하세요

### 6.2 스프레드시트 권한
- Service Account에는 최소 권한(뷰어)만 부여
- 불필요한 사용자와 공유하지 마세요
- 스프레드시트 URL을 공개하지 마세요

---

설정 완료 후 당근마켓 데이터가 Facebook, Google, TikTok과 함께 통합 리포트에서 조회 가능합니다!