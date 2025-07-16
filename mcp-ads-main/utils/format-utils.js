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
 * Facebook Actions 데이터 파싱
 * @param {Array} actions - Facebook actions 배열
 * @returns {Object} 파싱된 액션 데이터
 */
export function parseActions(actions) {
  if (!actions || !Array.isArray(actions)) return {};
  
  const actionMap = {};
  actions.forEach(action => {
    actionMap[action.action_type] = parseInt(action.value || 0);
  });
  
  return {
    lead: actionMap.lead || 0,
    link_click: actionMap.link_click || 0,
    landing_page_view: actionMap.landing_page_view || 0,
    purchase: actionMap.purchase || 0,
    add_to_cart: actionMap.add_to_cart || 0,
    complete_registration: actionMap.complete_registration || 0,
    total_actions: Object.values(actionMap).reduce((sum, val) => sum + val, 0)
  };
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