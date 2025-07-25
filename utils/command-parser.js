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
  '전체': 'all',
  'all': 'all'
};

/**
 * 모든 지원 매체 목록
 */
const ALL_PLATFORMS = ['facebook', 'google', 'tiktok'];

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
    raw: userInput,
    isValid: true,
    errors: []
  };

  try {
    // 키워드 추출
    const keywordMatch = userInput.match(/키워드:([^\s]+)/);
    if (keywordMatch) {
      command.keyword = keywordMatch[1];
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
  return command.isValid && command.keyword && command.startDate && command.endDate && command.platforms.length > 0;
}

/**
 * 명령어를 사용자 친화적인 문자열로 변환
 * @param {object} command - 파싱된 명령어 객체
 * @returns {string} 사용자 친화적인 설명
 */
export function formatCommandSummary(command) {
  if (!command.isValid) {
    return `❌ 명령어 오류: ${command.errors.join(', ')}`;
  }

  const platformNames = {
    facebook: 'Facebook',
    google: 'Google Ads',
    tiktok: 'TikTok Ads'
  };

  const platformList = command.platforms.map(p => platformNames[p]).join(', ');
  const dateRange = command.startDate === command.endDate 
    ? command.startDate 
    : `${command.startDate} ~ ${command.endDate}`;

  return `🔍 검색 조건\n- 키워드: "${command.keyword}"\n- 기간: ${dateRange}\n- 매체: ${platformList}`;
}

/**
 * 예시 명령어 목록 반환
 * @returns {Array} 예시 명령어 배열
 */
export function getExampleCommands() {
  return [
    '키워드:고병우 날짜:20250720-20250721 매체:구글,페이스북',
    '키워드:울산심플치과 날짜:어제 매체:틱톡',
    '키워드:치아교정 날짜:7일 매체:전체',
    '키워드:김영희 날짜:20250701-20250731 매체:페이스북',
    '키워드:성형외과 날짜:오늘 매체:구글'
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