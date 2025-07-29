/**
 * 통합 검색 서비스
 * 정형화된 명령어를 처리하여 다중 매체에서 캠페인 검색 및 성과 조회
 */

import { parseUserCommand, validateCommand, formatCommandSummary } from '../utils/command-parser.js';
import { formatNumber, formatCurrency, formatPercent } from '../utils/format-utils.js';
import { calculateDailyTrends, formatTrendText, calculatePeriodSummary, calculateDerivedMetrics } from '../utils/daily-trend-calculator.js';
import fs from 'fs';
import path from 'path';

export class UnifiedSearchService {
  constructor(services) {
    this.services = services; // { facebook: FacebookAdsService, google: GoogleAdsService, tiktok: TikTokAdsService }
  }

  /**
   * 키워드 매칭 함수 - 단일/다중 키워드 자동 판단
   * @param {string} name - 캠페인명 또는 광고명
   * @param {string} keywordString - 키워드 문자열 ("고병우" 또는 "고병우,다이즐")
   * @returns {boolean} - 매칭 여부
   */
  matchesKeywords(name, keywordString) {
    if (!keywordString || keywordString.trim() === '') {
      return true; // 키워드가 없으면 모든 항목 매칭
    }
    
    const lowerName = name.toLowerCase();
    
    if (!keywordString.includes(',')) {
      // 단일 키워드 (기존 방식)
      return lowerName.includes(keywordString.toLowerCase().trim());
    } else {
      // 다중 키워드 AND 조건
      const keywords = keywordString.split(',')
        .map(k => k.trim())
        .filter(k => k.length > 0);
      
      return keywords.every(keyword => 
        lowerName.includes(keyword.toLowerCase())
      );
    }
  }

  /**
   * MCP 도구 목록 반환
   */
  getTools() {
    return [
      {
        name: 'structured_campaign_search',
        description: '정형화된 명령어로 캠페인을 검색하고 광고별 성과를 조회합니다',
        inputSchema: {
          type: 'object',
          properties: {
            command: {
              type: 'string',
              description: '검색 명령어 (예: "키워드:고병우 날짜:20250720-20250721 매체:구글,페이스북")'
            },
            output_format: {
              type: 'string',
              enum: ['text', 'html'],
              default: 'text',
              description: '출력 형식 - text: 텍스트 형식(기본값), html: HTML 테이블 형식'
            }
          },
          required: ['command']
        }
      },
      {
        name: 'search_help',
        description: '정형화된 검색 명령어 사용법과 예시를 제공합니다',
        inputSchema: {
          type: 'object',
          properties: {}
        }
      },
      {
        name: 'test_html_output',
        description: 'HTML 출력 렌더링 테스트용 도구입니다',
        inputSchema: {
          type: 'object',
          properties: {}
        }
      },
      {
        name: 'generate_html_file',
        description: '캠페인 성과를 HTML 파일로 생성하여 로컬에 저장합니다',
        inputSchema: {
          type: 'object',
          properties: {
            command: {
              type: 'string',
              description: '검색 명령어 (예: "키워드:고병우 날짜:20250721-20250724 매체:facebook,google")'
            },
            filename: {
              type: 'string',
              description: '저장할 파일명 (선택, 기본값: 자동생성)'
            }
          },
          required: ['command']
        }
      }
    ];
  }

  /**
   * 도구 호출 처리
   */
  async handleToolCall(toolName, args) {
    try {
      switch (toolName) {
        case 'structured_campaign_search':
          return await this.executeStructuredSearch(args.command, args.output_format);
        case 'search_help':
          return this.getSearchHelp();
        case 'test_html_output':
          return this.testHtmlOutput();
        case 'generate_html_file':
          return await this.generateHtmlFile(args.command, args.filename);
        default:
          throw new Error(`Unknown unified search tool: ${toolName}`);
      }
    } catch (error) {
      console.error(`Unified search tool error [${toolName}]:`, error.message);
      return this.createErrorResponse(`도구 실행 실패: ${error.message}`);
    }
  }

  /**
   * 정형화된 검색 실행
   */
  async executeStructuredSearch(commandString, outputFormat = 'text') {
    try {
      // 1단계: 명령어 파싱
      const command = parseUserCommand(commandString);
      
      if (!validateCommand(command)) {
        return {
          content: [
            {
              type: 'text',
              text: `**명령어 오류**\n\n${command.errors.join('\n')}\n\n**올바른 형식:**\n키워드:[검색어] 날짜:[시작일-종료일] 매체:[매체1,매체2,...]\n\n**예시:**\n키워드:고병우 날짜:20250720-20250721 매체:구글,페이스북`
            }
          ]
        };
      }

      // 2단계: 지정된 매체에서 캠페인 + 성과 조회 (병렬)
      const platformResults = await this.fetchCampaignData(command);
      
      // 3단계: 키워드 필터링
      const filteredResults = this.filterByKeyword(platformResults, command.keyword);
      
      // 4단계: 광고별 성과 조회
      const detailedResults = await this.fetchAdLevelData(filteredResults, command);
      
      // 5단계: 결과 포맷팅
      return this.formatSearchResults(detailedResults, command, outputFormat);

    } catch (error) {
      console.error('Structured search execution error:', error.message);
      return this.createErrorResponse(`검색 실행 중 오류가 발생했습니다: ${error.message}`);
    }
  }

  /**
   * 지정된 매체에서 캠페인 데이터 조회 (병렬)
   */
  async fetchCampaignData(command) {
    const results = {};
    
    // 병렬로 매체별 데이터 조회
    const promises = command.platforms.map(async (platform) => {
      try {
        const service = this.services[platform];
        if (!service) {
          console.warn(`Service not available for platform: ${platform}`);
          return { platform, data: [], error: `${platform} 서비스가 설정되지 않았습니다` };
        }

        // 날짜 필터링된 캠페인 목록 조회
        const campaignData = await service.getCampaignListWithDateFilter(
          command.startDate,
          command.endDate
        );
        
        return { platform, data: campaignData, error: null };
      } catch (error) {
        console.error(`Error fetching data from ${platform}:`, error.message);
        return { platform, data: [], error: error.message };
      }
    });

    const platformResults = await Promise.all(promises);
    
    // 결과 정리
    platformResults.forEach(({ platform, data, error }) => {
      results[platform] = {
        campaigns: data || [],
        error: error
      };
    });

    return results;
  }

  /**
   * 키워드로 캠페인 필터링
   */
  filterByKeyword(platformResults, keyword) {
    const filteredResults = {};
    
    Object.entries(platformResults).forEach(([platform, { campaigns, error }]) => {
      if (error) {
        filteredResults[platform] = { campaigns: [], error };
        return;
      }

      const matchedCampaigns = campaigns.filter(campaign => {
        const campaignName = campaign.campaign_name || campaign.name || '';
        return this.matchesKeywords(campaignName, keyword);
      });

      if (matchedCampaigns.length > 0) {
        filteredResults[platform] = {
          campaigns: matchedCampaigns,
          error: null
        };
      }
    });

    return filteredResults;
  }

  /**
   * 광고별 상세 성과 조회
   */
  async fetchAdLevelData(filteredResults, command) {
    const detailedResults = {};
    
    for (const [platform, { campaigns, error }] of Object.entries(filteredResults)) {
      if (error || campaigns.length === 0) {
        detailedResults[platform] = { campaigns, ads: [], error };
        continue;
      }

      try {
        const service = this.services[platform];
        const campaignIds = campaigns.map(c => c.campaign_id || c.id);
        
        // 광고별 성과 조회
        const adPerformance = await service.getAdLevelPerformance(
          campaignIds,
          command.startDate,
          command.endDate
        );

        detailedResults[platform] = {
          campaigns,
          ads: adPerformance || [],
          error: null
        };
      } catch (error) {
        console.error(`Error fetching ad-level data from ${platform}:`, error.message);
        detailedResults[platform] = {
          campaigns,
          ads: [],
          error: `광고별 성과 조회 실패: ${error.message}`
        };
      }
    }

    return detailedResults;
  }

  /**
   * CSS 스타일 생성
   */
  generateCssStyles() {
    return `
    <style>
      body { 
        font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; 
        margin: 20px; 
        background-color: #f8f9fa;
        color: #333;
      }
      .container { 
        max-width: 1200px; 
        margin: 0 auto; 
        background: white; 
        padding: 30px; 
        border-radius: 10px; 
        box-shadow: 0 2px 10px rgba(0,0,0,0.1);
      }
      h1 { 
        color: #2c3e50; 
        text-align: center; 
        margin-bottom: 30px;
        border-bottom: 3px solid #3498db;
        padding-bottom: 15px;
      }
      h2 { 
        color: #34495e; 
        margin-top: 40px; 
        margin-bottom: 20px;
        padding: 10px 0;
        border-left: 4px solid #3498db;
        padding-left: 15px;
      }
      .search-info {
        background: #ecf0f1;
        padding: 15px;
        border-radius: 5px;
        margin-bottom: 30px;
      }
      .search-info strong { color: #2c3e50; }
      table { 
        border-collapse: collapse; 
        width: 100%; 
        margin: 20px 0; 
        background: white;
      }
      th, td { 
        border: 1px solid #ddd; 
        padding: 12px 8px; 
        text-align: left; 
        font-size: 14px;
      }
      th { 
        background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
        color: white;
        font-weight: bold; 
        text-align: center;
      }
      tr:nth-child(even) { background-color: #f8f9fa; }
      tr:hover { background-color: #e3f2fd; }
      .increase { 
        color: #27ae60; 
        font-weight: bold; 
      }
      .decrease { 
        color: #e74c3c; 
        font-weight: bold; 
      }
      .neutral { 
        color: #7f8c8d; 
      }
      .platform-section {
        margin: 30px 0;
        border: 1px solid #e0e0e0;
        border-radius: 8px;
        overflow: hidden;
      }
      .platform-header {
        background: linear-gradient(135deg, #3498db 0%, #2980b9 100%);
        color: white;
        padding: 15px 20px;
        font-size: 18px;
        font-weight: bold;
      }
      .campaign-name { 
        font-weight: bold; 
        color: #2c3e50; 
        margin: 30px 0 20px 0;
        padding: 15px;
        background: linear-gradient(135deg, #f8f9fa 0%, #e9ecef 100%);
        border-left: 5px solid #3498db;
        border-radius: 5px;
      }
      .campaign-summary, .campaign-daily, .ads-summary, .ads-daily {
        margin: 25px 0;
        padding: 20px;
        background: #fafbfc;
        border-radius: 8px;
        border: 1px solid #e1e8ed;
      }
      .campaign-summary h4, .campaign-daily h4, .ads-summary h4, .ads-daily h4 {
        margin-top: 0;
        margin-bottom: 15px;
        color: #2c3e50;
        border-bottom: 2px solid #3498db;
        padding-bottom: 10px;
      }
      .summary-box {
        background: linear-gradient(135deg, #a855f7 0%, #3b82f6 100%);
        color: white;
        padding: 20px;
        border-radius: 8px;
        margin: 20px 0;
        text-align: center;
      }
      .summary-box h3 { 
        margin-top: 0; 
        margin-bottom: 15px;
      }
      .metric-value {
        font-size: 16px;
        font-weight: bold;
      }
      .daily-trends {
        background: #f8f9fa;
        padding: 15px;
        border-radius: 5px;
        margin: 15px 0;
      }
      .no-data {
        text-align: center;
        color: #95a5a6;
        font-style: italic;
        padding: 40px;
      }
      .date-filter {
        background: #f8f9fa;
        padding: 15px 20px;
        border-radius: 8px;
        margin: 20px 0;
        border: 1px solid #e9ecef;
        display: flex;
        align-items: center;
        gap: 10px;
      }
      .date-filter label {
        font-weight: bold;
        color: #2c3e50;
        margin-right: 10px;
      }
      .date-filter select {
        padding: 8px 12px;
        border: 1px solid #ced4da;
        border-radius: 4px;
        background: white;
        color: #495057;
        font-size: 14px;
        min-width: 150px;
      }
      .date-filter select:focus {
        outline: none;
        border-color: #3498db;
        box-shadow: 0 0 0 2px rgba(52, 152, 219, 0.2);
      }
      #selectedDateInfo {
        font-size: 12px;
        color: #6c757d;
        font-style: italic;
      }
    </style>`;
  }

  /**
   * 캠페인별 일별 데이터 집계
   */
  aggregateCampaignDailyData(campaignAds) {
    const campaignDailyMap = {};
    
    campaignAds.forEach(ad => {
      if (ad.dailyData && ad.dailyData.length > 0) {
        ad.dailyData.forEach(dayData => {
          if (!campaignDailyMap[dayData.date]) {
            campaignDailyMap[dayData.date] = {
              date: dayData.date,
              spend: 0,
              impressions: 0,
              clicks: 0,
              conversions: 0
            };
          }
          campaignDailyMap[dayData.date].spend += parseFloat(dayData.spend || 0);
          campaignDailyMap[dayData.date].impressions += parseInt(dayData.impressions || 0);
          campaignDailyMap[dayData.date].clicks += parseInt(dayData.clicks || 0);
          campaignDailyMap[dayData.date].conversions += parseFloat(dayData.conversions || 0);
        });
      }
    });
    
    return Object.values(campaignDailyMap).sort((a, b) => a.date.localeCompare(b.date));
  }

  /**
   * 캠페인 합산 성과 HTML 생성
   */
  formatCampaignSummaryHtml(campaign, campaignAds, dateRange) {
    // 전체 합산 계산
    let totalSpend = 0;
    let totalImpressions = 0;
    let totalClicks = 0;
    let totalConversions = 0;

    campaignAds.forEach(ad => {
      totalSpend += parseFloat(ad.spend || 0);
      totalImpressions += parseInt(ad.impressions || 0);
      totalClicks += parseInt(ad.clicks || 0);
      
      // 전환수 계산 (Facebook Actions 포함)
      let conversions = parseInt(ad.conversions || 0);
      if (conversions === 0 && ad.actions && Array.isArray(ad.actions)) {
        const actions = ad.actions;
        const leadActions = actions.find(action => action.action_type === 'lead')?.value || 0;
        const purchaseActions = actions.find(action => action.action_type === 'purchase')?.value || 0;
        const registrationActions = actions.find(action => action.action_type === 'complete_registration')?.value || 0;
        conversions = parseInt(leadActions) + parseInt(purchaseActions) + parseInt(registrationActions);
      }
      totalConversions += conversions;
    });

    const avgCtr = totalImpressions > 0 ? (totalClicks / totalImpressions * 100).toFixed(2) : '0.00';
    const avgCpc = totalClicks > 0 ? (totalSpend / totalClicks).toFixed(2) : '0.00';
    const avgCpm = totalImpressions > 0 ? (totalSpend / totalImpressions * 1000).toFixed(2) : '0.00';
    const conversionRate = totalClicks > 0 ? (totalConversions / totalClicks * 100).toFixed(2) : '0.00';
    const costPerConversion = totalConversions > 0 ? (totalSpend / totalConversions).toFixed(2) : '0.00';

    return `
    <div class="campaign-summary">
      <h4>📊 캠페인 합산 성과 (${dateRange})</h4>
      <table>
        <thead>
          <tr>
            <th>총 광고비</th>
            <th>총 노출수</th>
            <th>총 클릭수</th>
            <th>평균 CTR</th>
            <th>평균 CPC</th>
            <th>평균 CPM</th>
            <th>총 전환수</th>
            <th>전환율</th>
            <th>전환단가</th>
          </tr>
        </thead>
        <tbody>
          <tr>
            <td class="metric-value">₩${totalSpend.toLocaleString()}</td>
            <td class="metric-value">${totalImpressions.toLocaleString()}</td>
            <td class="metric-value">${totalClicks.toLocaleString()}</td>
            <td class="metric-value">${avgCtr}%</td>
            <td class="metric-value">₩${parseFloat(avgCpc).toLocaleString()}</td>
            <td class="metric-value">₩${parseFloat(avgCpm).toLocaleString()}</td>
            <td class="metric-value">${totalConversions > 0 ? totalConversions.toLocaleString() : '-'}</td>
            <td class="metric-value">${totalConversions > 0 ? conversionRate + '%' : '-'}</td>
            <td class="metric-value">${totalConversions > 0 ? '₩' + parseFloat(costPerConversion).toLocaleString() : '-'}</td>
          </tr>
        </tbody>
      </table>
    </div>`;
  }

  /**
   * 캠페인 일별 성과 HTML 생성
   */
  formatCampaignDailyHtml(campaignDailyData) {
    if (!campaignDailyData || campaignDailyData.length === 0) {
      return '<p class="no-data">일별 데이터가 없습니다.</p>';
    }

    const trendsData = calculateDailyTrends(campaignDailyData);
    
    let html = `
    <div class="campaign-daily">
      <h4>📈 캠페인 일별 성과</h4>
      <table>
        <thead>
          <tr>
            <th>날짜</th>
            <th>광고비</th>
            <th>노출수</th>
            <th>클릭수</th>
            <th>CTR</th>
            <th>CPM</th>
            <th>CPC</th>
            <th>전일 대비 변화</th>
          </tr>
        </thead>
        <tbody>`;

    trendsData.forEach(dayData => {
      const { derivedMetrics, trends } = dayData;
      
      const formatTrend = (metric) => {
        const trend = trends[metric];
        if (trend.change === 0) return '<span class="neutral">변화없음</span>';
        const direction = trend.change > 0 ? '▲' : '▼';
        const cssClass = trend.change > 0 ? 'increase' : 'decrease';
        return `<span class="${cssClass}">${direction} ${Math.abs(trend.change).toLocaleString()} (${trend.changePercent}%)</span>`;
      };

      html += `
      <tr data-date="${dayData.date}" 
          data-spend="${dayData.spend}" 
          data-impressions="${dayData.impressions}" 
          data-clicks="${dayData.clicks}">
        <td>${dayData.date}</td>
        <td class="metric-value">₩${parseFloat(dayData.spend).toLocaleString()}</td>
        <td class="metric-value">${parseInt(dayData.impressions).toLocaleString()}</td>
        <td class="metric-value">${parseInt(dayData.clicks).toLocaleString()}</td>
        <td class="metric-value">${derivedMetrics.ctr}%</td>
        <td class="metric-value">₩${derivedMetrics.cpm.toLocaleString()}</td>
        <td class="metric-value">₩${derivedMetrics.cpc.toLocaleString()}</td>
        <td>${formatTrend('spend')}</td>
      </tr>`;
    });

    html += '</tbody></table></div>';
    return html;
  }

  /**
   * 광고별 일별 성과 HTML 생성
   */
  formatAdsDailyHtml(campaignAds) {
    if (!campaignAds || campaignAds.length === 0) {
      return '';
    }

    let html = `
    <div class="ads-daily">
      <h4>📅 광고별 일별 성과</h4>`;

    campaignAds.forEach(ad => {
      if (!ad.dailyData || ad.dailyData.length === 0) {
        return;
      }

      const trendsData = calculateDailyTrends(ad.dailyData);
      
      html += `
      <div style="margin: 20px 0;">
        <h5 style="color: #2c3e50; margin-bottom: 10px;">🎯 ${ad.ad_name || ad.name}</h5>
        <table style="font-size: 13px;">
          <thead>
            <tr>
              <th>날짜</th>
              <th>광고비</th>
              <th>노출수</th>
              <th>클릭수</th>
              <th>CTR</th>
              <th>CPC</th>
              <th>변화</th>
            </tr>
          </thead>
          <tbody>`;

      trendsData.forEach(dayData => {
        const { derivedMetrics, trends } = dayData;
        
        const formatTrend = (metric) => {
          const trend = trends[metric];
          if (trend.change === 0) return '<span class="neutral">-</span>';
          const direction = trend.change > 0 ? '▲' : '▼';
          const cssClass = trend.change > 0 ? 'increase' : 'decrease';
          return `<span class="${cssClass}">${direction} ${Math.abs(trend.change).toLocaleString()}</span>`;
        };

        html += `
        <tr>
          <td>${dayData.date}</td>
          <td>₩${parseFloat(dayData.spend).toLocaleString()}</td>
          <td>${parseInt(dayData.impressions).toLocaleString()}</td>
          <td>${parseInt(dayData.clicks).toLocaleString()}</td>
          <td>${derivedMetrics.ctr}%</td>
          <td>₩${derivedMetrics.cpc.toLocaleString()}</td>
          <td>${formatTrend('spend')}</td>
        </tr>`;
      });

      html += '</tbody></table></div>';
    });

    html += '</div>';
    return html;
  }

  /**
   * 매체별 캠페인 테이블 HTML 생성
   */
  formatCampaignTableHtml(campaigns, ads, platform) {
    if (campaigns.length === 0) {
      return '<p class="no-data">매칭되는 캠페인이 없습니다.</p>';
    }

    const campaignGroups = this.groupAdsByCampaign(campaigns, ads);
    let html = '';

    campaignGroups.forEach(({ campaign, campaignAds }) => {
      const dateRange = `${campaignAds[0]?.dailyData?.[0]?.date || ''} ~ ${campaignAds[0]?.dailyData?.[campaignAds[0]?.dailyData?.length - 1]?.date || ''}`;
      
      html += `
      <h3 class="campaign-name">📋 ${campaign.campaign_name || campaign.name}</h3>`;

      // 1. 캠페인 합산 성과
      html += this.formatCampaignSummaryHtml(campaign, campaignAds, dateRange);

      // 2. 캠페인 일별 성과
      const campaignDailyData = this.aggregateCampaignDailyData(campaignAds);
      html += this.formatCampaignDailyHtml(campaignDailyData);

      // 3. 광고별 합산 성과 테이블
      html += `
      <div class="ads-summary">
        <h4>🎯 광고별 합산 성과</h4>
        <table>
          <thead>
            <tr>
              <th>광고명</th>
              <th>광고비</th>
              <th>노출수</th>
              <th>클릭수</th>
              <th>CTR</th>
              <th>CPM</th>
              <th>CPC</th>
              <th>전환수</th>
              <th>전환율</th>
              <th>전환단가</th>
            </tr>
          </thead>
          <tbody>`;

      if (campaignAds.length === 0) {
        html += '<tr><td colspan="10" class="no-data">광고 데이터가 없습니다.</td></tr>';
      } else {
        campaignAds.forEach(ad => {
          const spend = parseFloat(ad.spend || 0);
          const impressions = parseInt(ad.impressions || 0);
          const clicks = parseInt(ad.clicks || 0);
          let conversions = parseInt(ad.conversions || 0);
          const ctr = impressions > 0 ? (clicks / impressions * 100).toFixed(2) : '0.00';
          const cpm = impressions > 0 ? (spend / impressions * 1000).toFixed(2) : '0.00';
          const cpc = clicks > 0 ? (spend / clicks).toFixed(2) : '0.00';
          let costPerConversion = parseFloat(ad.cost_per_conversion || ad.costPerConversion || 0);

          // Facebook Actions 데이터 처리
          if (conversions === 0 && ad.actions && Array.isArray(ad.actions)) {
            const actions = ad.actions;
            const leadActions = actions.find(action => action.action_type === 'lead')?.value || 0;
            const purchaseActions = actions.find(action => action.action_type === 'purchase')?.value || 0;
            const registrationActions = actions.find(action => action.action_type === 'complete_registration')?.value || 0;
            conversions = parseInt(leadActions) + parseInt(purchaseActions) + parseInt(registrationActions);
            
            if (conversions > 0 && costPerConversion === 0) {
              costPerConversion = spend / conversions;
            }
          }

          const conversionRate = clicks > 0 ? (conversions / clicks * 100).toFixed(2) : '0.00';

          html += `
          <tr>
            <td>${ad.ad_name || ad.name}</td>
            <td class="metric-value">₩${spend.toLocaleString()}</td>
            <td class="metric-value">${impressions.toLocaleString()}</td>
            <td class="metric-value">${clicks.toLocaleString()}</td>
            <td class="metric-value">${ctr}%</td>
            <td class="metric-value">₩${parseFloat(cpm).toLocaleString()}</td>
            <td class="metric-value">₩${parseFloat(cpc).toLocaleString()}</td>
            <td class="metric-value">${conversions > 0 ? conversions.toLocaleString() : '-'}</td>
            <td class="metric-value">${conversions > 0 ? conversionRate + '%' : '-'}</td>
            <td class="metric-value">${costPerConversion > 0 ? '₩' + costPerConversion.toLocaleString() : '-'}</td>
          </tr>`;
        });
      }

      html += '</tbody></table></div>';

      // 4. 광고별 일별 성과
      html += this.formatAdsDailyHtml(campaignAds);
    });

    return html;
  }

  /**
   * 일별 성과 추이 HTML 생성
   */
  formatDailyTrendsHtml(dailyData) {
    const trendsData = calculateDailyTrends(dailyData);
    
    let html = `
    <div class="daily-trends">
      <h4>📈 일별 성과 추이</h4>
      <table>
        <thead>
          <tr>
            <th>날짜</th>
            <th>광고비</th>
            <th>노출수</th>
            <th>클릭수</th>
            <th>CTR</th>
            <th>CPM</th>
            <th>CPC</th>
          </tr>
        </thead>
        <tbody>`;

    trendsData.forEach(dayData => {
      const { derivedMetrics, trends } = dayData;
      
      const formatTrend = (metric) => {
        const trend = trends[metric];
        if (trend.change === 0) return '<span class="neutral">변화없음</span>';
        const direction = trend.change > 0 ? '▲' : '▼';
        const cssClass = trend.change > 0 ? 'increase' : 'decrease';
        return `<span class="${cssClass}">${direction} ${Math.abs(trend.change).toLocaleString()} (${trend.changePercent}%)</span>`;
      };

      html += `
      <tr data-date="${dayData.date}" 
          data-spend="${dayData.spend}" 
          data-impressions="${dayData.impressions}" 
          data-clicks="${dayData.clicks}">
        <td>${dayData.date}</td>
        <td>₩${parseFloat(dayData.spend).toLocaleString()}<br><small>${formatTrend('spend')}</small></td>
        <td>${parseInt(dayData.impressions).toLocaleString()}<br><small>${formatTrend('impressions')}</small></td>
        <td>${parseInt(dayData.clicks).toLocaleString()}<br><small>${formatTrend('clicks')}</small></td>
        <td>${derivedMetrics.ctr}%<br><small>${formatTrend('ctr')}</small></td>
        <td>₩${derivedMetrics.cpm.toLocaleString()}<br><small>${formatTrend('cpm')}</small></td>
        <td>₩${derivedMetrics.cpc.toLocaleString()}<br><small>${formatTrend('cpc')}</small></td>
      </tr>`;
    });

    html += '</tbody></table></div>';
    return html;
  }

  /**
   * HTML 리포트 생성
   */
  generateHtmlReport(detailedResults, command) {
    const summary = formatCommandSummary(command);
    const platformNames = {
      facebook: 'Facebook Ads',
      google: 'Google Ads',  
      tiktok: 'TikTok Ads'
    };

    let totalCampaigns = 0;
    let totalAds = 0;
    let totalSpend = 0;
    let totalImpressions = 0;
    let totalClicks = 0;

    let bodyHtml = '';

    // 매체별 결과 처리
    Object.entries(detailedResults).forEach(([platform, { campaigns, ads, error }]) => {
      const platformName = platformNames[platform] || platform;
      
      bodyHtml += `
      <div class="platform-section">
        <div class="platform-header">
          ${platformName} ${error ? '- 오류 발생' : `(${campaigns.length}개 캠페인, ${ads.length}개 광고)`}
        </div>
        <div style="padding: 20px;">`;

      if (error) {
        bodyHtml += `<p style="color: #e74c3c; font-weight: bold;">❌ ${error}</p>`;
      } else if (campaigns.length === 0) {
        bodyHtml += '<p class="no-data">매칭되는 캠페인이 없습니다.</p>';
      } else {
        bodyHtml += this.formatCampaignTableHtml(campaigns, ads, platform);
        
        // 집계 업데이트
        totalCampaigns += campaigns.length;
        totalAds += ads.length;
        ads.forEach(ad => {
          totalSpend += parseFloat(ad.spend || 0);
          totalImpressions += parseInt(ad.impressions || 0);
          totalClicks += parseInt(ad.clicks || 0);
        });
      }

      bodyHtml += '</div></div>';
    });

    // 전체 요약
    const overallCTR = totalImpressions > 0 ? (totalClicks / totalImpressions * 100).toFixed(2) : '0.00';
    
    const summaryHtml = totalCampaigns > 0 ? `
    <div class="summary-box">
      <h3>📊 전체 요약</h3>
      <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(200px, 1fr)); gap: 15px;">
        <div>
          <div>총 캠페인: <span class="metric-value">${totalCampaigns}개</span></div>
          <div>총 광고: <span class="metric-value">${totalAds}개</span></div>
        </div>
        <div>
          <div>총 광고비: <span class="metric-value">₩${totalSpend.toLocaleString()}</span></div>
          <div>총 노출수: <span class="metric-value">${totalImpressions.toLocaleString()}</span></div>
        </div>
        <div>
          <div>총 클릭수: <span class="metric-value">${totalClicks.toLocaleString()}</span></div>
          <div>전체 CTR: <span class="metric-value">${overallCTR}%</span></div>
        </div>
      </div>
    </div>` : '<p class="no-data">조건에 맞는 캠페인을 찾을 수 없습니다.</p>';

    // 날짜 범위 수집 (날짜 필터용)
    const dateRange = this.getDateRangeFromCommand(command);
    const dateFilterOptions = this.generateDateFilterOptions(dateRange);

    const htmlContent = `<!DOCTYPE html>
<html lang="ko">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>캠페인 성과 리포트</title>
  ${this.generateCssStyles()}
</head>
<body>
  <div class="container">
    <h1>캠페인 성과 리포트</h1>
    
    <div class="search-info">
      <strong>검색 조건:</strong><br>
      ${summary.replace(/\n/g, '<br>')}
    </div>

    <div class="date-filter">
      <label for="dateFilter">날짜 필터:</label>
      <select id="dateFilter" onchange="filterByDate(this.value)">
        <option value="all">전체 기간</option>
        ${dateFilterOptions}
      </select>
      <span id="selectedDateInfo" style="margin-left: 10px; color: #666;"></span>
    </div>

    ${bodyHtml}
    
    ${summaryHtml}
    
    <div style="text-align: center; margin-top: 30px; color: #7f8c8d; font-size: 12px;">
      리포트 생성 시간: ${new Date().toLocaleString('ko-KR')}
    </div>
  </div>

  <script>
    ${this.generateJavaScriptCode()}
  </script>
</body>
</html>`;

    return {
      content: [
        {
          type: 'text',
          text: htmlContent
        }
      ]
    };
  }

  /**
   * 검색 결과 포맷팅
   */
  formatSearchResults(detailedResults, command, outputFormat = 'text') {
    if (outputFormat === 'html') {
      return this.generateHtmlReport(detailedResults, command);
    }

    // 기존 텍스트 출력 로직
    const summary = formatCommandSummary(command);
    let result = `${summary}\n\n`;

    const platformNames = {
      facebook: '**Facebook Ads**',
      google: '**Google Ads**',
      tiktok: '**TikTok Ads**'
    };

    let totalCampaigns = 0;
    let totalAds = 0;
    let totalSpend = 0;
    let totalImpressions = 0;
    let totalClicks = 0;

    // 매체별 결과 출력
    Object.entries(detailedResults).forEach(([platform, { campaigns, ads, error }]) => {
      const platformName = platformNames[platform] || platform;
      
      if (error) {
        result += `${platformName} - Error: ${error}\n\n`;
        return;
      }

      if (campaigns.length === 0) {
        result += `${platformName} - No matching campaigns\n\n`;
        return;
      }

      result += `${platformName} (${campaigns.length} campaigns, ${ads.length} ads)\n\n`;
      
      // 캠페인별로 그룹화된 광고들 표시
      const campaignGroups = this.groupAdsByCampaign(campaigns, ads);
      
      campaignGroups.forEach(({ campaign, campaignAds }) => {
        result += `**Campaign**: ${campaign.campaign_name || campaign.name}\n`;
        
        if (campaignAds.length === 0) {
          result += `└── No ad data available\n\n`;
          return;
        }

        campaignAds.forEach((ad, index) => {
          const isLast = index === campaignAds.length - 1;
          const prefix = isLast ? '└──' : '├──';
          
          const spend = parseFloat(ad.spend || 0);
          const impressions = parseInt(ad.impressions || 0);
          const clicks = parseInt(ad.clicks || 0);
          let conversions = parseInt(ad.conversions || 0);
          const ctr = impressions > 0 ? (clicks / impressions * 100).toFixed(2) : '0.00';
          let costPerConversion = parseFloat(ad.cost_per_conversion || ad.costPerConversion || 0);
          
          // Facebook Actions 데이터에서 전환 정보 추출
          if (conversions === 0 && ad.actions && Array.isArray(ad.actions)) {
            const actions = ad.actions;
            const leadActions = actions.find(action => action.action_type === 'lead')?.value || 0;
            const purchaseActions = actions.find(action => action.action_type === 'purchase')?.value || 0;
            const registrationActions = actions.find(action => action.action_type === 'complete_registration')?.value || 0;
            
            // 주요 전환 액션 합계
            conversions = parseInt(leadActions) + parseInt(purchaseActions) + parseInt(registrationActions);
            
            // Actions가 있으면 CPA 계산
            if (conversions > 0 && costPerConversion === 0) {
              costPerConversion = spend / conversions;
            }
          }
          
          const conversionRate = clicks > 0 ? (conversions / clicks * 100).toFixed(2) : '0.00';
          
          // CPM, CPC 계산
          const cpm = impressions > 0 ? (spend / impressions * 1000).toFixed(2) : '0.00';
          const cpc = clicks > 0 ? (spend / clicks).toFixed(2) : '0.00';
          
          result += `${prefix} **${ad.ad_name || ad.name}**\n`;
          result += `    광고비: ${formatCurrency(spend)} | 노출수: ${formatNumber(impressions)} | 클릭수: ${formatNumber(clicks)} | ctr: ${ctr}% | cpm: ${formatCurrency(cpm)} | cpc: ${formatCurrency(cpc)}\n`;
          
          // 전환 관련 지표 추가
          if (conversions > 0 || costPerConversion > 0) {
            result += `    전환수: ${formatNumber(conversions)} | 전환율: ${conversionRate}% | 전환단가: ${formatCurrency(costPerConversion)}\n`;
          }
          
          // 일별 성과 추이 표시 (dailyData가 있는 경우)
          if (ad.dailyData && ad.dailyData.length > 1) {
            result += `    **일별 성과 추이:**\n`;
            const trendsData = calculateDailyTrends(ad.dailyData);
            
            trendsData.forEach(dayData => {
              const { derivedMetrics, trends } = dayData;
              
              // 기본 추이 데이터
              const trendSpend = formatTrendText(trends, 'spend');
              const trendImpressions = formatTrendText(trends, 'impressions');
              const trendClicks = formatTrendText(trends, 'clicks');
              
              // 파생 지표 추이 데이터
              const trendCtr = formatTrendText(trends, 'ctr');
              const trendCpm = formatTrendText(trends, 'cpm');
              const trendCpc = formatTrendText(trends, 'cpc');
              
              result += `      ${dayData.date}:\n`;
              result += `        광고비: ${formatCurrency(dayData.spend)} ${trendSpend} | 노출수: ${formatNumber(dayData.impressions)} ${trendImpressions} | 클릭수: ${formatNumber(dayData.clicks)} ${trendClicks}\n`;
              result += `        CTR: ${derivedMetrics.ctr}% ${trendCtr} | CPM: ${formatCurrency(derivedMetrics.cpm)} ${trendCpm} | CPC: ${formatCurrency(derivedMetrics.cpc)} ${trendCpc}\n`;
              
              // 전환 관련 지표 (있는 경우)
              const dayConversions = parseFloat(dayData.conversions || 0);
              if (dayConversions > 0) {
                const trendConversions = formatTrendText(trends, 'conversions');
                const trendConversionRate = formatTrendText(trends, 'conversion_rate');
                const trendCostPerConversion = formatTrendText(trends, 'cost_per_conversion');
                
                result += `        전환수: ${formatNumber(dayConversions)} ${trendConversions} | 전환율: ${derivedMetrics.conversion_rate}% ${trendConversionRate} | 전환단가: ${formatCurrency(derivedMetrics.cost_per_conversion)} ${trendCostPerConversion}\n`;
              }
            });
            
            // 기간 요약
            const summary = calculatePeriodSummary(ad.dailyData);
            result += `      **기간 요약**: ${summary.days}일간 평균 - 광고비: ${formatCurrency(summary.avgSpend)}, 노출수: ${formatNumber(summary.avgImpressions)}, 클릭수: ${formatNumber(summary.avgClicks)}\n`;
            if (summary.avgConversions > 0) {
              result += `        평균 전환수: ${formatNumber(summary.avgConversions)}\n`;
            }
          }
          
          // 전체 집계
          totalSpend += spend;
          totalImpressions += impressions;
          totalClicks += clicks;
        });
        
        result += '\n';
      });

      totalCampaigns += campaigns.length;
      totalAds += ads.length;
    });

    // 전체 요약
    if (totalCampaigns > 0) {
      const overallCTR = totalImpressions > 0 ? (totalClicks / totalImpressions * 100).toFixed(2) : '0.00';
      
      result += `**Summary**\n`;
      result += `- total_campaigns: ${totalCampaigns}, total_ads: ${totalAds}\n`;
      result += `- total_spend: ${formatCurrency(totalSpend)}\n`;
      result += `- total_impressions: ${formatNumber(totalImpressions)}\n`;
      result += `- total_clicks: ${formatNumber(totalClicks)}\n`;
      result += `- overall_ctr: ${overallCTR}%`;
    } else {
      result += `No campaigns found matching the specified criteria.`;
    }

    return {
      content: [
        {
          type: 'text',
          text: result
        }
      ]
    };
  }

  /**
   * 광고를 캠페인별로 그룹화
   */
  groupAdsByCampaign(campaigns, ads) {
    return campaigns.map(campaign => {
      const campaignId = campaign.campaign_id || campaign.id;
      const campaignAds = ads.filter(ad => {
        const adCampaignId = ad.campaign_id || ad.parent_id;
        return adCampaignId === campaignId;
      });
      
      return {
        campaign,
        campaignAds
      };
    });
  }

  /**
   * 검색 도움말 반환
   */
  getSearchHelp() {
    const helpText = `**정형화된 캠페인 검색 도구 사용법**

**기본 형식:**
\`키워드:[검색어] 날짜:[날짜범위] 매체:[매체목록]\`

**파라미터 설명:**

**키워드** (필수)
- 캠페인명에서 검색할 키워드
- 예: \`키워드:고병우\`, \`키워드:치아교정\`

**날짜** (선택, 기본값: 어제)
- \`20250720-20250721\`: 특정 기간
- \`어제\`: 어제 하루
- \`오늘\`: 오늘 하루  
- \`7일\`: 최근 7일

**매체** (선택, 기본값: 전체)
- \`페이스북\`, \`facebook\`, \`fb\`
- \`구글\`, \`google\`, \`구글광고\`
- \`틱톡\`, \`tiktok\`
- \`전체\`, \`all\`: 모든 매체
- 여러 매체: \`구글,페이스북\`

**사용 예시:**
1. \`키워드:고병우 날짜:20250720-20250721 매체:구글,페이스북\`
2. \`키워드:울산심플치과 날짜:어제 매체:틱톡\`
3. \`키워드:치아교정 날짜:7일 매체:전체\`
4. \`키워드:김영희 날짜:20250701-20250731 매체:페이스북\`

**결과 형태:**
- 매체별로 매칭된 캠페인 목록
- 각 캠페인 내 광고별 상세 성과
- 지출, 노출, 클릭, CTR 등 주요 지표
- 전체 요약 통계

**주의사항:**
- 조회 기간은 최대 90일까지 가능
- 키워드는 대소문자 구분하지 않음
- 매체가 설정되지 않은 경우 해당 매체는 제외됨`;

    return {
      content: [
        {
          type: 'text',
          text: helpText
        }
      ]
    };
  }

  /**
   * HTML 출력 테스트
   */
  testHtmlOutput() {
    const htmlContent = `<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <title>HTML 출력 테스트</title>
  <style>
    body { font-family: Arial, sans-serif; margin: 20px; }
    h1 { color: #333; }
    table { border-collapse: collapse; width: 100%; margin: 20px 0; }
    th, td { border: 1px solid #ddd; padding: 12px; text-align: left; }
    th { background-color: #f2f2f2; font-weight: bold; }
    .increase { color: #28a745; font-weight: bold; }
    .decrease { color: #dc3545; font-weight: bold; }
    .neutral { color: #6c757d; }
    .metric-row:hover { background-color: #f8f9fa; }
  </style>
</head>
<body>
  <h1>📊 HTML 출력 렌더링 테스트</h1>
  
  <h2>기본 테이블 테스트</h2>
  <table>
    <thead>
      <tr>
        <th>날짜</th>
        <th>광고비</th>
        <th>노출수</th>
        <th>클릭수</th>
        <th>CTR</th>
        <th>변화</th>
      </tr>
    </thead>
    <tbody>
      <tr class="metric-row">
        <td>2025-07-21</td>
        <td>₩50,000</td>
        <td>10,500</td>
        <td>120</td>
        <td>1.14%</td>
        <td class="increase">▲ +5,000 (+11.1%)</td>
      </tr>
      <tr class="metric-row">
        <td>2025-07-22</td>
        <td>₩45,000</td>
        <td>9,800</td>
        <td>115</td>
        <td>1.17%</td>
        <td class="decrease">▼ -5,000 (-10.0%)</td>
      </tr>
      <tr class="metric-row">
        <td>2025-07-23</td>
        <td>₩45,000</td>
        <td>9,800</td>
        <td>115</td>
        <td>1.17%</td>
        <td class="neutral">변화없음</td>
      </tr>
    </tbody>
  </table>

  <h2>스타일 테스트</h2>
  <p>이 테스트는 다음을 확인합니다:</p>
  <ul>
    <li><strong>HTML 태그 렌더링</strong>: 테이블, 제목, 리스트 등</li>
    <li><strong>CSS 스타일 적용</strong>: 색상, 폰트, 호버 효과 등</li>
    <li><strong>한글 및 특수문자</strong>: ₩, ▲, ▼, % 등</li>
    <li><strong>반응형 요소</strong>: 테이블 호버 효과</li>
  </ul>

  <div style="background-color: #e7f3ff; padding: 15px; border-radius: 5px; margin: 20px 0;">
    <strong>💡 참고:</strong> 이 HTML이 제대로 렌더링되면 실제 광고 성과 리포트를 HTML 형식으로 제공할 수 있습니다.
  </div>
</body>
</html>`;

    return {
      content: [
        {
          type: 'text',
          text: htmlContent
        }
      ]
    };
  }

  /**
   * HTML 파일 생성 및 로컬 저장
   */
  async generateHtmlFile(commandString, filename) {
    try {
      console.error(`HTML 파일 생성 시작: ${commandString}`);
      
      // 로컬 MCP 모드에서는 Render API 호출
      if (!process.env.RENDER_EXTERNAL_URL) {
        return await this.generateHtmlViaRenderAPI(commandString, filename);
      }

      // Render 서버에서 직접 실행하는 경우 (기존 로직)
      // 1. 명령어 파싱
      const command = parseUserCommand(commandString);
      
      if (!validateCommand(command)) {
        return this.createErrorResponse(`명령어 오류: ${command.errors.join(', ')}`);
      }

      // 2. 데이터 수집 (기존 로직 재사용)
      const platformResults = await this.fetchCampaignData(command);
      const filteredResults = this.filterByKeyword(platformResults, command.keyword);
      const detailedResults = await this.fetchAdLevelData(filteredResults, command);
      
      // 3. HTML 생성
      const htmlReport = this.generateHtmlReport(detailedResults, command);
      const htmlContent = htmlReport.content[0].text;
      
      // 4. 파일명 생성
      const timestamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19);
      const keyword = command.keyword.replace(/[^a-zA-Z0-9ㄱ-ㅎㅏ-ㅣ가-힣]/g, '');
      const dateRange = `${command.startDate}-${command.endDate}`;
      const defaultName = `campaign-report-${keyword}-${dateRange}-${timestamp}.html`;
      const fileName = filename || defaultName;
      
      // 5. 임시 폴더에 저장
      const tempDir = '/tmp/mcp-html-reports';
      
      // 디렉토리가 없으면 생성
      if (!fs.existsSync(tempDir)) {
        fs.mkdirSync(tempDir, { recursive: true });
      }
      
      const filePath = path.join(tempDir, fileName);
      fs.writeFileSync(filePath, htmlContent, 'utf8');
      
      // 6. 통계 계산
      const totalCampaigns = Object.values(detailedResults).reduce((sum, {campaigns}) => sum + (campaigns?.length || 0), 0);
      const totalAds = Object.values(detailedResults).reduce((sum, {ads}) => sum + (ads?.length || 0), 0);
      const fileSizeKB = Math.round(htmlContent.length / 1024);
      
      // 7. 다운로드 URL 생성
      const downloadUrl = `https://mcp-ads.onrender.com/download/${fileName}`;
      
      console.error(`HTML 파일 생성 완료: ${filePath}`);
      console.error(`다운로드 URL: ${downloadUrl}`);
      
      return {
        content: [
          {
            type: 'text',
            text: `HTML 리포트가 생성되었습니다!

캠페인 수: ${totalCampaigns}개
광고 수: ${totalAds}개  
기간: ${command.startDate} ~ ${command.endDate}
키워드: ${command.keyword || '전체'}
파일 크기: ${fileSizeKB}KB
매체: ${command.platforms.map(p => {
  const names = { facebook: 'Facebook', google: 'Google Ads', tiktok: 'TikTok Ads' };
  return names[p] || p;
}).join(', ')}

다운로드 링크: ${downloadUrl}

위 링크를 클릭하거나 브라우저에 붙여넣기하여 HTML 파일을 다운로드하세요.
링크는 30분 후 만료됩니다.`
          }
        ]
      };

    } catch (error) {
      console.error('HTML 파일 생성 실패:', error.message);
      return this.createErrorResponse(`HTML 파일 생성 실패: ${error.message}`);
    }
  }

  /**
   * Render API를 통해 HTML 파일 생성 (로컬 MCP용)
   */
  async generateHtmlViaRenderAPI(commandString, filename) {
    try {
      console.error('Render API를 통해 HTML 생성 중...');
      
      // API 키 수집
      const apiKeys = {};
      
      if (process.env.META_ACCESS_TOKEN && process.env.META_AD_ACCOUNT_ID) {
        apiKeys.facebook = {
          access_token: process.env.META_ACCESS_TOKEN,
          ad_account_id: process.env.META_AD_ACCOUNT_ID
        };
      }
      
      if (process.env.GOOGLE_ADS_CUSTOMER_ID) {
        apiKeys.google = {
          customer_id: process.env.GOOGLE_ADS_CUSTOMER_ID
        };
      }
      
      if (process.env.TIKTOK_ACCESS_TOKEN && process.env.TIKTOK_ADVERTISER_ID) {
        apiKeys.tiktok = {
          access_token: process.env.TIKTOK_ACCESS_TOKEN,
          advertiser_id: process.env.TIKTOK_ADVERTISER_ID
        };
      }

      // Render API 호출
      const response = await fetch('https://mcp-ads.onrender.com/api/generate-html', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          command: commandString,
          api_keys: apiKeys,
          filename: filename
        })
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || `HTTP ${response.status}`);
      }

      const result = await response.json();
      
      if (result.success) {
        console.error(`Render API 호출 성공: ${result.download_url}`);
        
        return {
          content: [
            {
              type: 'text',
              text: `HTML 리포트가 생성되었습니다!

다운로드 링크: ${result.download_url}

위 링크를 클릭하거나 브라우저에 붙여넣기하여 HTML 파일을 다운로드하세요.
링크는 30분 후 만료됩니다.

모든 MCP 사용자가 중앙 서버에서 생성된 파일에 접근할 수 있습니다.`
            }
          ]
        };
      } else {
        throw new Error(result.error || '알 수 없는 오류');
      }

    } catch (error) {
      console.error('Render API 호출 실패:', error.message);
      return this.createErrorResponse(`중앙 서버 HTML 생성 실패: ${error.message}`);
    }
  }

  /**
   * 날짜 범위 추출
   */
  getDateRangeFromCommand(command) {
    const startDate = new Date(command.startDate);
    const endDate = new Date(command.endDate);
    const dates = [];
    
    for (let d = new Date(startDate); d <= endDate; d.setDate(d.getDate() + 1)) {
      dates.push(new Date(d).toISOString().split('T')[0]);
    }
    
    return dates;
  }

  /**
   * 날짜 필터 옵션 생성
   */
  generateDateFilterOptions(dateRange) {
    return dateRange.map(date => 
      `<option value="${date}">${date}</option>`
    ).join('');
  }

  /**
   * JavaScript 코드 생성
   */
  generateJavaScriptCode() {
    return `
    function filterByDate(selectedDate) {
      const rows = document.querySelectorAll('[data-date]');
      const summaryEl = document.getElementById('selectedDateInfo');
      
      if (selectedDate === 'all') {
        // 모든 행 표시
        rows.forEach(row => {
          row.style.display = '';
        });
        summaryEl.textContent = '';
        updateSummary();
      } else {
        // 선택된 날짜만 표시
        rows.forEach(row => {
          const rowDate = row.getAttribute('data-date');
          row.style.display = rowDate === selectedDate ? '' : 'none';
        });
        summaryEl.textContent = '(선택된 날짜: ' + selectedDate + ')';
        updateSummary(selectedDate);
      }
    }

    function updateSummary(filterDate = null) {
      let totalSpend = 0;
      let totalImpressions = 0;
      let totalClicks = 0;
      
      const rows = document.querySelectorAll('[data-date]');
      rows.forEach(row => {
        if (filterDate && row.getAttribute('data-date') !== filterDate) return;
        if (row.style.display === 'none') return;
        
        const spend = parseFloat(row.getAttribute('data-spend') || 0);
        const impressions = parseInt(row.getAttribute('data-impressions') || 0);
        const clicks = parseInt(row.getAttribute('data-clicks') || 0);
        
        totalSpend += spend;
        totalImpressions += impressions;
        totalClicks += clicks;
      });
      
      // 요약 정보 업데이트
      const summaryBox = document.querySelector('.summary-box');
      if (summaryBox && filterDate) {
        const ctr = totalImpressions > 0 ? (totalClicks / totalImpressions * 100).toFixed(2) : '0.00';
        summaryBox.innerHTML = '<h3>선택된 날짜 요약 (' + filterDate + ')</h3>' +
          '<div>총 광고비: <span class="metric-value">₩' + totalSpend.toLocaleString() + '</span></div>' +
          '<div>총 노출수: <span class="metric-value">' + totalImpressions.toLocaleString() + '</span></div>' +
          '<div>총 클릭수: <span class="metric-value">' + totalClicks.toLocaleString() + '</span></div>' +
          '<div>전체 CTR: <span class="metric-value">' + ctr + '%</span></div>';
      }
    }
    `;
  }

  /**
   * 에러 응답 생성
   */
  createErrorResponse(message) {
    return {
      content: [
        {
          type: 'text',
          text: `**통합 검색 오류**\n\n${message}\n\n도움말을 보려면 \`search_help\` 도구를 사용하세요.`
        }
      ]
    };
  }
}