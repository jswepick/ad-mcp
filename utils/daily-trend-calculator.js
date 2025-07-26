/**
 * 일별 성과 추이 계산 유틸리티
 * 일별 데이터를 분석하여 전일 대비 증감률과 추이를 계산
 */

/**
 * 일별 데이터에서 전일 대비 증감률 계산
 * @param {Array} dailyData - 일별 성과 데이터 배열 [{date, spend, impressions, clicks, conversions}, ...]
 * @returns {Array} 증감률이 포함된 일별 데이터 배열
 */
export function calculateDailyTrends(dailyData) {
  if (!dailyData || dailyData.length === 0) {
    return [];
  }

  // 날짜순으로 정렬 (오름차순)
  const sortedData = [...dailyData].sort((a, b) => a.date.localeCompare(b.date));
  
  return sortedData.map((currentDay, index) => {
    if (index === 0) {
      // 첫 번째 날은 비교할 전일 데이터가 없음
      return {
        ...currentDay,
        trends: {
          spend: { change: 0, changePercent: 0 },
          impressions: { change: 0, changePercent: 0 },
          clicks: { change: 0, changePercent: 0 },
          conversions: { change: 0, changePercent: 0 }
        }
      };
    }

    const previousDay = sortedData[index - 1];
    
    return {
      ...currentDay,
      trends: {
        spend: calculateChange(previousDay.spend, currentDay.spend),
        impressions: calculateChange(previousDay.impressions, currentDay.impressions),
        clicks: calculateChange(previousDay.clicks, currentDay.clicks),
        conversions: calculateChange(previousDay.conversions, currentDay.conversions)
      }
    };
  });
}

/**
 * 두 값 사이의 증감을 계산
 * @param {number} previousValue - 이전 값
 * @param {number} currentValue - 현재 값
 * @returns {object} {change: 절대값 변화, changePercent: 퍼센트 변화}
 */
function calculateChange(previousValue, currentValue) {
  const prev = parseFloat(previousValue) || 0;
  const curr = parseFloat(currentValue) || 0;
  
  const change = curr - prev;
  const changePercent = prev > 0 ? (change / prev * 100) : (curr > 0 ? 100 : 0);
  
  return {
    change: parseFloat(change.toFixed(2)),
    changePercent: parseFloat(changePercent.toFixed(2))
  };
}

/**
 * 일별 추이를 텍스트로 포맷팅
 * @param {object} trends - calculateDailyTrends 결과의 trends 객체
 * @param {string} metric - 지표명 (spend, impressions, clicks, conversions)
 * @returns {string} 포맷된 추이 텍스트
 */
export function formatTrendText(trends, metric) {
  if (!trends || !trends[metric]) {
    return '';
  }

  const { change, changePercent } = trends[metric];
  
  if (change === 0) {
    return '변화없음';
  }

  const direction = change > 0 ? '↗️' : '↘️';
  const changeStr = change > 0 ? `+${Math.abs(change)}` : `-${Math.abs(change)}`;
  const percentStr = changePercent > 0 ? `+${changePercent}%` : `${changePercent}%`;
  
  return `${direction} ${changeStr} (${percentStr})`;
}

/**
 * 전체 기간의 성과 요약 계산
 * @param {Array} dailyData - 일별 성과 데이터 배열
 * @returns {object} 전체 기간 요약 데이터
 */
export function calculatePeriodSummary(dailyData) {
  if (!dailyData || dailyData.length === 0) {
    return {
      totalSpend: 0,
      totalImpressions: 0,
      totalClicks: 0,
      totalConversions: 0,
      avgSpend: 0,
      avgImpressions: 0,
      avgClicks: 0,
      avgConversions: 0,
      days: 0
    };
  }

  const totals = dailyData.reduce((acc, day) => ({
    spend: acc.spend + parseFloat(day.spend || 0),
    impressions: acc.impressions + parseInt(day.impressions || 0),
    clicks: acc.clicks + parseInt(day.clicks || 0),
    conversions: acc.conversions + parseFloat(day.conversions || 0)
  }), { spend: 0, impressions: 0, clicks: 0, conversions: 0 });

  const days = dailyData.length;

  return {
    totalSpend: parseFloat(totals.spend.toFixed(2)),
    totalImpressions: totals.impressions,
    totalClicks: totals.clicks,
    totalConversions: parseFloat(totals.conversions.toFixed(2)),
    avgSpend: parseFloat((totals.spend / days).toFixed(2)),
    avgImpressions: Math.round(totals.impressions / days),
    avgClicks: Math.round(totals.clicks / days),
    avgConversions: parseFloat((totals.conversions / days).toFixed(2)),
    days: days
  };
}

/**
 * 최고/최저 성과일 찾기
 * @param {Array} dailyData - 일별 성과 데이터 배열
 * @param {string} metric - 비교할 지표 (spend, impressions, clicks, conversions)
 * @returns {object} {best: 최고 성과일, worst: 최저 성과일}
 */
export function findBestWorstDays(dailyData, metric = 'spend') {
  if (!dailyData || dailyData.length === 0) {
    return { best: null, worst: null };
  }

  const sortedByMetric = [...dailyData].sort((a, b) => {
    const aValue = parseFloat(a[metric] || 0);
    const bValue = parseFloat(b[metric] || 0);
    return bValue - aValue; // 내림차순
  });

  return {
    best: sortedByMetric[0],
    worst: sortedByMetric[sortedByMetric.length - 1]
  };
}

/**
 * 요일별 성과 패턴 분석
 * @param {Array} dailyData - 일별 성과 데이터 배열
 * @returns {object} 요일별 평균 성과
 */
export function analyzeDayOfWeekPatterns(dailyData) {
  if (!dailyData || dailyData.length === 0) {
    return {};
  }

  const dayNames = ['일', '월', '화', '수', '목', '금', '토'];
  const dayPatterns = {};

  // 요일별 데이터 그룹화
  dailyData.forEach(day => {
    const date = new Date(day.date);
    const dayOfWeek = dayNames[date.getDay()];
    
    if (!dayPatterns[dayOfWeek]) {
      dayPatterns[dayOfWeek] = {
        days: [],
        totalSpend: 0,
        totalImpressions: 0,
        totalClicks: 0,
        totalConversions: 0
      };
    }
    
    dayPatterns[dayOfWeek].days.push(day);
    dayPatterns[dayOfWeek].totalSpend += parseFloat(day.spend || 0);
    dayPatterns[dayOfWeek].totalImpressions += parseInt(day.impressions || 0);
    dayPatterns[dayOfWeek].totalClicks += parseInt(day.clicks || 0);
    dayPatterns[dayOfWeek].totalConversions += parseFloat(day.conversions || 0);
  });

  // 요일별 평균 계산
  Object.keys(dayPatterns).forEach(dayOfWeek => {
    const pattern = dayPatterns[dayOfWeek];
    const count = pattern.days.length;
    
    pattern.avgSpend = parseFloat((pattern.totalSpend / count).toFixed(2));
    pattern.avgImpressions = Math.round(pattern.totalImpressions / count);
    pattern.avgClicks = Math.round(pattern.totalClicks / count);
    pattern.avgConversions = parseFloat((pattern.totalConversions / count).toFixed(2));
  });

  return dayPatterns;
}