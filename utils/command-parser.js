/**
 * 정형화된 사용자 명령어 파싱 유틸리티
 * 
 * 지원 형식:
 * 키워드:[검색어] 날짜:[시작일-종료일] 매체:[매체1,매체2,...]
 * 
 * 예시:
 * - 키워드:고병우 날짜:20250720-20250721 매체:구글,페이스북
 * - 키워드:울산심플치과 날짜:어제 매체:전체
 */

/**
 * 날짜 문자열을 표준 형식으로 변환
 * @param {string} dateStr - YYYYMMDD 형식의 날짜 문자열
 * @returns {string} YYYY-MM-DD 형식의 날짜 문자열
 */
function formatDate(dateStr) {
  if (dateStr.length === 8) {
    // YYYYMMDD -> YYYY-MM-DD
    return `${dateStr.slice(0, 4)}-${dateStr.slice(4, 6)}-${dateStr.slice(6, 8)}`;
  }
  return dateStr;
}

/**
 * 어제 날짜를 반환
 * @returns {string} YYYY-MM-DD 형식의 어제 날짜
 */
function getYesterday() {
  const yesterday = new Date();
  yesterday.setDate(yesterday.getDate() - 1);
  return yesterday.toISOString().split('T')[0];
}

/**
 * 오늘 날짜를 반환
 * @returns {string} YYYY-MM-DD 형식의 오늘 날짜
 */
function getToday() {
  const today = new Date();
  return today.toISOString().split('T')[0];
}

/**
 * 최근 N일 날짜 범위를 반환
 * @param {number} days - 일수
 * @returns {object} {startDate, endDate} 형식의 날짜 범위
 */
function getRecentDays(days) {
  const endDate = new Date();
  endDate.setDate(endDate.getDate() - 1); // 어제까지
  
  const startDate = new Date(endDate);
  startDate.setDate(startDate.getDate() - (days - 1));
  
  return {
    startDate: startDate.toISOString().split('T')[0],
    endDate: endDate.toISOString().split('T')[0]
  };
}

/**
 * 매체명을 내부 코드로 매핑
 */
const PLATFORM_MAP = {
  '페이스북': 'facebook',
  'facebook': 'facebook',
  'fb': 'facebook',
  '구글': 'google',
  'google': 'google',
  '구글광고': 'google',
  '틱톡': 'tiktok',
  'tiktok': 'tiktok',
  '당근마켓': 'carrot',
  '당근': 'carrot',
  'carrot': 'carrot',
  '전체': 'all',
  'all': 'all'
};

/**
 * 모든 지원 매체 목록
 */
const ALL_PLATFORMS = ['facebook', 'google', 'tiktok', 'carrot'];

/**
 * 사용자 명령어를 파싱하여 구조화된 객체로 반환
 * @param {string} userInput - 사용자 입력 문자열
 * @returns {object} 파싱된 명령어 객체
 */
export function parseUserCommand(userInput) {
  const command = {
    keyword: null,
    startDate: null,
    endDate: null,
    platforms: [],
    reportType: 'internal', // 기본값: 내부용
    customTitle: null, // 기본값: null (자동 제목 사용)
    raw: userInput,
    isValid: true,
    errors: []
  };

  try {
    // 키워드 추출 (빈 키워드도 허용)
    const keywordMatch = userInput.match(/키워드:([^\s]*)/);
    if (keywordMatch) {
      command.keyword = keywordMatch[1] || ''; // 빈 문자열도 허용
    } else {
      command.errors.push('키워드가 지정되지 않았습니다');
      command.isValid = false;
    }

    // 날짜 추출 및 처리
    const dateMatch = userInput.match(/날짜:([^\s]+)/);
    if (dateMatch) {
      const dateStr = dateMatch[1];
      
      if (dateStr.includes('-')) {
        // 날짜 범위 (예: 20250720-20250721)
        const [start, end] = dateStr.split('-');
        command.startDate = formatDate(start);
        command.endDate = formatDate(end);
      } else if (dateStr === '어제') {
        const yesterday = getYesterday();
        command.startDate = yesterday;
        command.endDate = yesterday;
      } else if (dateStr === '오늘') {
        const today = getToday();
        command.startDate = today;
        command.endDate = today;
      } else if (dateStr.match(/^\d+일$/)) {
        // N일 (예: 7일)
        const days = parseInt(dateStr.replace('일', ''));
        const range = getRecentDays(days);
        command.startDate = range.startDate;
        command.endDate = range.endDate;
      } else {
        // 단일 날짜
        const formattedDate = formatDate(dateStr);
        command.startDate = formattedDate;
        command.endDate = formattedDate;
      }
    } else {
      // 날짜 지정 안됨 - 기본값은 어제
      const yesterday = getYesterday();
      command.startDate = yesterday;
      command.endDate = yesterday;
    }

    // 매체 추출 및 처리
    const platformMatch = userInput.match(/매체:([^\s]+)/);
    if (platformMatch) {
      const platformStr = platformMatch[1].toLowerCase();
      
      if (platformStr === '전체' || platformStr === 'all') {
        command.platforms = [...ALL_PLATFORMS];
      } else {
        const requestedPlatforms = platformStr.split(',');
        const mappedPlatforms = requestedPlatforms
          .map(p => PLATFORM_MAP[p.trim()])
          .filter(Boolean);
        
        if (mappedPlatforms.length === 0) {
          command.errors.push('유효하지 않은 매체가 지정되었습니다');
          command.isValid = false;
        } else {
          command.platforms = [...new Set(mappedPlatforms)]; // 중복 제거
        }
      }
    } else {
      // 매체 지정 안됨 - 기본값은 전체
      command.platforms = [...ALL_PLATFORMS];
    }

    // 리포트 타입 추출
    const reportMatch = userInput.match(/리포트:([^\s]+)/);
    if (reportMatch) {
      const reportStr = reportMatch[1].toLowerCase();
      if (reportStr === '광고주' || reportStr === 'client') {
        command.reportType = 'client';
      } else if (reportStr === '내부' || reportStr === 'internal') {
        command.reportType = 'internal';
      } else {
        command.errors.push('유효하지 않은 리포트 타입입니다 (광고주 또는 내부만 가능)');
        command.isValid = false;
      }
    }

    // 타입 추출 (A, B, client)
    const typeMatch = userInput.match(/타입:([^\s]+)/);
    if (typeMatch) {
      const typeStr = typeMatch[1].toUpperCase();
      if (typeStr === 'A' || typeStr === 'B') {
        command.reportType = typeStr;
      } else if (typeStr === 'CLIENT') {
        command.reportType = 'client';
      } else {
        command.errors.push('유효하지 않은 타입입니다 (A, B, client만 가능)');
        command.isValid = false;
      }
    }

    // 표시 단위 추출 (캠페인/광고)
    const unitMatch = userInput.match(/단위:([^\s]+)/);
    if (unitMatch) {
      const unitStr = unitMatch[1].toLowerCase();
      if (unitStr === '캠페인' || unitStr === 'campaign') {
        command.displayUnit = 'campaign';
      } else if (unitStr === '광고' || unitStr === 'ad') {
        command.displayUnit = 'ad';
      } else {
        command.errors.push('유효하지 않은 단위입니다 (캠페인 또는 광고만 가능)');
        command.isValid = false;
      }
    } else {
      // 기본값: 광고 단위까지 표시
      command.displayUnit = 'ad';
    }

    // 커스텀 제목 추출
    const titleMatch = userInput.match(/제목:([^]+)/);
    if (titleMatch) {
      let title = titleMatch[1].trim();
      // 다른 파라미터 제거 (제목 뒤에 다른 파라미터가 올 경우)
      title = title.split(/\s+(?=\w+:)/)[0];
      
      // 제목 길이 제한 및 안전성 검사
      if (title.length > 100) {
        command.errors.push('제목은 100자를 초과할 수 없습니다');
        command.isValid = false;
      } else if (title.length > 0) {
        // HTML 특수문자 기본 이스케이프
        command.customTitle = title
          .replace(/&/g, '&amp;')
          .replace(/</g, '&lt;')
          .replace(/>/g, '&gt;')
          .replace(/"/g, '&quot;')
          .replace(/'/g, '&#39;');
      }
    }

    // 날짜 유효성 검사
    if (command.startDate && command.endDate) {
      const start = new Date(command.startDate);
      const end = new Date(command.endDate);
      
      if (start > end) {
        command.errors.push('시작일이 종료일보다 늦습니다');
        command.isValid = false;
      }
      
      // 너무 긴 기간 체크 (90일 제한)
      const diffDays = (end - start) / (1000 * 60 * 60 * 24);
      if (diffDays > 90) {
        command.errors.push('조회 기간이 90일을 초과할 수 없습니다');
        command.isValid = false;
      }
    }

  } catch (error) {
    command.errors.push(`파싱 오류: ${error.message}`);
    command.isValid = false;
  }

  return command;
}

/**
 * 명령어 유효성 검사
 * @param {object} command - 파싱된 명령어 객체
 * @returns {boolean} 유효성 여부
 */
export function validateCommand(command) {
  return command.isValid && command.keyword !== undefined && command.startDate && command.endDate && command.platforms.length > 0;
}

/**
 * 명령어를 사용자 친화적인 문자열로 변환
 * @param {object} command - 파싱된 명령어 객체
 * @returns {string} 사용자 친화적인 설명
 */
export function formatCommandSummary(command) {
  if (!command.isValid) {
    return `명령어 오류: ${command.errors.join(', ')}`;
  }

  const platformNames = {
    facebook: 'Facebook',
    google: 'Google Ads',
    tiktok: 'TikTok Ads',
    carrot: '당근마켓'
  };

  const platformList = command.platforms.map(p => platformNames[p]).join(', ');
  const dateRange = command.startDate === command.endDate 
    ? command.startDate 
    : `${command.startDate} ~ ${command.endDate}`;

  const reportTypeText = (command.reportType === 'A' || command.reportType === 'B' || command.reportType === 'client') ? '광고주용' : '내부용';
  
  let summary = `검색 조건\n- 키워드: "${command.keyword}"\n- 기간: ${dateRange}\n- 매체: ${platformList}\n- 리포트: ${reportTypeText}`;
  
  if (command.customTitle) {
    summary += `\n- 제목: "${command.customTitle}"`;
  }
  
  return summary;
}

/**
 * 예시 명령어 목록 반환
 * @returns {Array} 예시 명령어 배열
 */
export function getExampleCommands() {
  return [
    '키워드:고병우 날짜:20250720-20250721 매체:구글,페이스북',
    '키워드:울산심플치과 날짜:어제 매체:틱톡 리포트:광고주',
    '키워드:치아교정 날짜:7일 매체:전체 제목:2024년 4분기 치아교정 캠페인 성과',
    '키워드:김영희 날짜:20250701-20250731 매체:페이스북 리포트:내부',
    '키워드:성형외과 날짜:오늘 매체:구글 리포트:광고주 제목:모모성형외과 일일 성과 리포트'
  ];
}

/**
 * 지원되는 매체 목록 반환
 * @returns {Array} 매체 정보 배열
 */
export function getSupportedPlatforms() {
  return [
    { code: 'facebook', name: 'Facebook Ads', aliases: ['페이스북', 'fb'] },
    { code: 'google', name: 'Google Ads', aliases: ['구글', '구글광고'] },
    { code: 'tiktok', name: 'TikTok Ads', aliases: ['틱톡'] },
    { code: 'all', name: '전체', aliases: ['전체', 'all'] }
  ];
}