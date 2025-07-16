// 날짜 관련 공통 유틸리티 함수들

/**
 * 날짜 범위 계산 (Facebook 방식 기준)
 * @param {number} days - 조회할 일수 (1=어제, 7=최근 일주일)
 * @returns {Object} {since: 'YYYY-MM-DD', until: 'YYYY-MM-DD'}
 */
export function getDateRange(days) {
  const endDate = new Date();
  endDate.setDate(endDate.getDate() - 1); // 어제까지
  
  const startDate = new Date(endDate);
  startDate.setDate(startDate.getDate() - (days - 1));
  
  return {
    since: startDate.toISOString().split('T')[0],
    until: endDate.toISOString().split('T')[0]
  };
}

/**
 * 기간 텍스트 생성
 * @param {number} days - 일수
 * @returns {string} "어제" 또는 "최근 N일"
 */
export function getPeriodText(days) {
  return days === 1 ? '어제' : `최근 ${days}일`;
}

/**
 * Google Ads 형식의 날짜 범위 생성
 * @param {number} days - 조회할 일수
 * @returns {Object} Google Ads API 형식
 */
export function getGoogleDateRange(days) {
  const { since, until } = getDateRange(days);
  return {
    start_date: since,
    end_date: until
  };
}

/**
 * TikTok 형식의 날짜 범위 생성
 * @param {number} days - 조회할 일수
 * @returns {Object} TikTok API 형식
 */
export function getTikTokDateRange(days) {
  const { since, until } = getDateRange(days);
  return {
    start_date: since,
    end_date: until
  };
}