// 포맷팅 관련 공통 유틸리티 함수들

/**
 * 숫자를 천 단위 구분자와 함께 포맷팅
 * @param {number} num - 포맷팅할 숫자
 * @returns {string} 포맷팅된 숫자
 */
export function formatNumber(num) {
  return parseInt(num || 0).toLocaleString();
}

/**
 * 통화 포맷팅 ($123.45)
 * @param {number} amount - 금액
 * @returns {string} 포맷팅된 통화
 */
export function formatCurrency(amount) {
  return `$${parseFloat(amount || 0).toFixed(2)}`;
}

/**
 * 퍼센트 포맷팅 (12.34%)
 * @param {number} rate - 비율 (0.1234 -> 12.34%)
 * @param {number} decimals - 소수점 자리수 (기본값: 2)
 * @returns {string} 포맷팅된 퍼센트
 */
export function formatPercent(rate, decimals = 2) {
  return `${parseFloat(rate || 0).toFixed(decimals)}%`;
}

/**
 * 전환으로 인정할 액션 타입들
 */
export const CONVERSION_ACTIONS = [
  'lead',
  'purchase', 
  'complete_registration',
  'submit_application',
  'subscribe',
  'start_trial'
];

/**
 * 커스텀 전환 액션 타입 패턴들 (정규식 매칭용)
 */
export const CUSTOM_CONVERSION_PATTERNS = [
  /^offsite_conversion\.fb_pixel_custom\./,  // Facebook Pixel 커스텀 이벤트
  /^app_custom_event\./,                     // 앱 커스텀 이벤트
  /^onsite_conversion\./,                    // 온사이트 전환
  /^custom_/                                 // 기타 커스텀 액션
];

/**
 * Facebook Actions 데이터 파싱 (개선된 버전)
 * @param {Array} actions - Facebook actions 배열
 * @returns {Object} 파싱된 액션 데이터
 */
export function parseActions(actions) {
  if (!actions || !Array.isArray(actions)) {
    return {
      lead: 0,
      link_click: 0,
      landing_page_view: 0,
      purchase: 0,
      add_to_cart: 0,
      complete_registration: 0,
      submit_application: 0,
      subscribe: 0,
      start_trial: 0,
      total_actions: 0,
      total_conversions: 0
    };
  }
  
  const actionMap = {};
  
  // 안전한 데이터 파싱
  actions.forEach(action => {
    if (action && typeof action === 'object' && action.action_type && action.value !== undefined) {
      const actionType = action.action_type;
      const value = parseInt(action.value);
      
      // 숫자가 아닌 경우 0으로 처리
      if (!isNaN(value) && value >= 0) {
        actionMap[actionType] = value;
      }
    }
  });
  
  const parsedActions = {
    lead: actionMap.lead || 0,
    link_click: actionMap.link_click || 0,
    landing_page_view: actionMap.landing_page_view || 0,
    purchase: actionMap.purchase || 0,
    add_to_cart: actionMap.add_to_cart || 0,
    complete_registration: actionMap.complete_registration || 0,
    submit_application: actionMap.submit_application || 0,
    subscribe: actionMap.subscribe || 0,
    start_trial: actionMap.start_trial || 0,
    total_actions: Object.values(actionMap).reduce((sum, val) => sum + val, 0)
  };
  
  // 전환 액션들의 합계 계산 (표준 + 커스텀)
  parsedActions.total_conversions = CONVERSION_ACTIONS.reduce((sum, actionType) => {
    return sum + (parsedActions[actionType] || 0);
  }, 0);
  
  // 커스텀 전환 액션들도 포함
  Object.keys(actionMap).forEach(actionType => {
    const isCustomConversion = CUSTOM_CONVERSION_PATTERNS.some(pattern => 
      pattern.test(actionType)
    );
    
    if (isCustomConversion) {
      parsedActions.total_conversions += actionMap[actionType] || 0;
    }
  });
  
  return parsedActions;
}

/**
 * 표준화된 성과 데이터 형식으로 변환
 * @param {Object} rawData - 원본 플랫폼 데이터
 * @param {string} platform - 플랫폼명 ('facebook', 'google', 'tiktok')
 * @returns {Object} 표준화된 성과 데이터
 */
export function standardizeMetrics(rawData, platform) {
  const base = {
    platform,
    spend: parseFloat(rawData.spend || 0),
    impressions: parseInt(rawData.impressions || 0),
    clicks: parseInt(rawData.clicks || 0),
    conversions: parseInt(rawData.conversions || 0)
  };

  // 계산된 지표들
  base.ctr = base.impressions > 0 ? (base.clicks / base.impressions * 100) : 0;
  base.cpc = base.clicks > 0 ? (base.spend / base.clicks) : 0;
  base.cpm = base.impressions > 0 ? (base.spend / base.impressions * 1000) : 0;
  base.conversion_rate = base.clicks > 0 ? (base.conversions / base.clicks * 100) : 0;

  return base;
}

/**
 * 성과 요약 텍스트 생성
 * @param {Object} metrics - 표준화된 성과 데이터
 * @param {string} periodText - 기간 텍스트
 * @returns {string} 포맷팅된 성과 요약
 */
export function formatPerformanceSummary(metrics, periodText) {
  return `🎯 **${periodText} 성과 요약**
💰 총 지출: ${formatCurrency(metrics.spend)}
👁️ 노출수: ${formatNumber(metrics.impressions)}
🖱️ 클릭수: ${formatNumber(metrics.clicks)}
🎯 전환수: ${formatNumber(metrics.conversions)}
📈 CTR: ${formatPercent(metrics.ctr)}
💵 CPC: ${formatCurrency(metrics.cpc)}
📊 CPM: ${formatCurrency(metrics.cpm)}
🔄 전환율: ${formatPercent(metrics.conversion_rate)}`;
}