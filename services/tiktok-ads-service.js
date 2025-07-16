import axios from 'axios';
import { getTikTokDateRange, getPeriodText } from '../utils/date-utils.js';
import { formatNumber, formatCurrency, formatPercent, standardizeMetrics, formatPerformanceSummary } from '../utils/format-utils.js';

// TikTok Ads API 설정
const ACCESS_TOKEN = process.env.TIKTOK_ACCESS_TOKEN;
const ADVERTISER_ID = process.env.TIKTOK_ADVERTISER_ID;
const APP_ID = process.env.TIKTOK_APP_ID;
const SECRET = process.env.TIKTOK_SECRET;
const BASE_URL = 'https://business-api.tiktok.com/open_api/v1.3';

export class TikTokAdsService {
  constructor() {
    this.platform = 'tiktok';
    this.accessToken = ACCESS_TOKEN;
  }

  /**
   * MCP 도구 목록 반환
   */
  getTools() {
    return [
      {
        name: 'tiktok_get_campaign_performance',
        description: 'TikTok Ads 캠페인 성과를 조회합니다',
        inputSchema: {
          type: 'object',
          properties: {
            days: {
              type: 'number',
              description: '조회할 일수 (1=어제, 7=최근 일주일, 30=최근 한달)',
              default: 7
            },
            campaign_ids: {
              type: 'array',
              items: { type: 'string' },
              description: '특정 캠페인 ID들 (선택사항)'
            }
          }
        }
      },
      {
        name: 'tiktok_get_campaign_list',
        description: 'TikTok Ads 캠페인 목록을 조회합니다',
        inputSchema: {
          type: 'object',
          properties: {
            status_filter: {
              type: 'string',
              enum: ['ENABLE', 'DISABLE', 'ALL'],
              default: 'ALL',
              description: '상태별 필터'
            }
          }
        }
      },
      {
        name: 'tiktok_toggle_campaign_status',
        description: 'TikTok Ads 캠페인 상태를 변경합니다',
        inputSchema: {
          type: 'object',
          properties: {
            campaign_id: {
              type: 'string',
              description: '제어할 캠페인 ID'
            },
            status: {
              type: 'string',
              enum: ['ENABLE', 'DISABLE'],
              description: '설정할 상태'
            }
          },
          required: ['campaign_id', 'status']
        }
      },
      {
        name: 'tiktok_get_ad_group_performance',
        description: 'TikTok Ads 광고그룹 성과를 조회합니다',
        inputSchema: {
          type: 'object',
          properties: {
            days: {
              type: 'number',
              description: '조회할 일수',
              default: 7
            },
            campaign_id: {
              type: 'string',
              description: '특정 캠페인의 광고그룹만 조회 (선택사항)'
            }
          }
        }
      },
      {
        name: 'tiktok_get_creative_performance',
        description: 'TikTok Ads 광고 소재별 성과를 조회합니다',
        inputSchema: {
          type: 'object',
          properties: {
            days: {
              type: 'number',
              description: '조회할 일수',
              default: 7
            },
            ad_group_id: {
              type: 'string',
              description: '특정 광고그룹의 소재만 조회 (선택사항)'
            }
          }
        }
      }
    ];
  }

  /**
   * 도구 호출 처리
   */
  async handleToolCall(toolName, args) {
    switch (toolName) {
      case 'tiktok_get_campaign_performance':
        return await this.getCampaignPerformance(args.days || 7, args.campaign_ids);
      case 'tiktok_get_campaign_list':
        return await this.getCampaignList(args.status_filter || 'ALL');
      case 'tiktok_toggle_campaign_status':
        return await this.toggleCampaignStatus(args.campaign_id, args.status);
      case 'tiktok_get_ad_group_performance':
        return await this.getAdGroupPerformance(args.days || 7, args.campaign_id);
      case 'tiktok_get_creative_performance':
        return await this.getCreativePerformance(args.days || 7, args.ad_group_id);
      case 'tiktok_test_connection':
        return await this.testConnection();
      default:
        throw new Error(`Unknown TikTok tool: ${toolName}`);
    }
  }

  // === 캠페인 관련 메서드들 ===

  async getCampaignPerformance(days, campaignIds) {
    try {
      console.log('📊 TikTok Ads 캠페인 성과 조회 중...');
      
      const { start_date, end_date } = getTikTokDateRange(days);
      
      const params = {
        advertiser_id: ADVERTISER_ID,
        start_date,
        end_date,
        group_by: 'STAT_GROUP_BY_CAMPAIGN_ID',
        metrics: [
          'campaign_name',
          'spend',
          'impressions', 
          'clicks',
          'ctr',
          'cpc',
          'cpm',
          'conversions',
          'conversion_rate',
          'cost_per_conversion'
        ].join(',')
      };

      // 특정 캠페인 ID 필터 추가
      if (campaignIds && campaignIds.length > 0) {
        params.campaign_ids = JSON.stringify(campaignIds);
      }

      const response = await this.makeTikTokRequest('/report/integrated/get/', params);
      
      return {
        content: [
          {
            type: 'text',
            text: this.formatCampaignPerformance(response.data?.list || [], days)
          }
        ]
      };

    } catch (error) {
      console.error('TikTok Ads 캠페인 성과 조회 실패:', error.message);
      const periodText = getPeriodText(days);
      return {
        content: [
          {
            type: 'text',
            text: `❌ **${periodText} TikTok Ads 성과 조회 실패**\n\n**오류**: ${error.message}\n\n**해결 방법:**\n- Access Token이 유효한지 확인\n- Advertiser ID가 올바른지 확인\n- API 권한 확인\n- 날짜 범위가 올바른지 확인`
          }
        ]
      };
    }
  }

  async getCampaignList(statusFilter) {
    try {
      console.log('📋 TikTok Ads 캠페인 목록 조회 중...');

      const params = {
        advertiser_id: ADVERTISER_ID,
        fields: [
          'campaign_id',
          'campaign_name', 
          'status',
          'objective_type',
          'budget',
          'budget_mode',
          'create_time',
          'modify_time'
        ]
      };

      // 상태 필터 추가
      if (statusFilter !== 'ALL') {
        params.primary_status = statusFilter;
      }

      const response = await this.makeTikTokRequest('/campaign/get/', params);
      
      console.log('✅ TikTok 캠페인 조회 성공');

      return {
        content: [
          {
            type: 'text',
            text: this.formatCampaignList(response.data?.list || [], statusFilter)
          }
        ]
      };

    } catch (error) {
      console.error('❌ TikTok Ads 캠페인 목록 조회 실패:', error);
      
      return {
        content: [
          {
            type: 'text',
            text: `❌ **TikTok Ads 캠페인 목록 조회 실패**\n\n**오류**: ${error.message}\n\n**환경변수 확인:**\n- Advertiser ID: ${ADVERTISER_ID}\n- Access Token: ${ACCESS_TOKEN ? '설정됨' : '❌ 없음'}\n- App ID: ${APP_ID ? '설정됨' : '❌ 없음'}\n\n**해결 방법:**\n- Advertiser ID가 올바른지 확인\n- Access Token이 유효한지 확인\n- API 권한 확인`
          }
        ]
      };
    }
  }

  async toggleCampaignStatus(campaignId, status) {
    try {
      console.log(`🔄 TikTok 캠페인 ${campaignId} 상태 변경: ${status}`);

      const params = {
        advertiser_id: ADVERTISER_ID,
        campaign_ids: JSON.stringify([campaignId]),
        operation_status: status
      };

      const response = await this.makeTikTokRequest('/campaign/status/update/', params, 'POST');
      
      return {
        content: [
          {
            type: 'text',
            text: `✅ **TikTok 캠페인 상태 변경 완료**\n\n캠페인 ID: ${campaignId}\n새 상태: ${status === 'ENABLE' ? '✅ 활성' : '⏸️ 일시정지'}\n\n${response.data?.errors?.length ? `⚠️ 경고: ${response.data.errors.map(e => e.message).join(', ')}` : ''}`
          }
        ]
      };

    } catch (error) {
      console.error('TikTok 캠페인 상태 변경 실패:', error.message);
      return {
        content: [
          {
            type: 'text',
            text: `❌ **TikTok 캠페인 상태 변경 실패**\n\n**오류**: ${error.message}\n\n**해결 방법:**\n- 캠페인 ID가 올바른지 확인\n- 계정에 캠페인 제어 권한이 있는지 확인\n- 캠페인이 이미 해당 상태인지 확인`
          }
        ]
      };
    }
  }

  async getAdGroupPerformance(days, campaignId) {
    try {
      console.log('🎯 TikTok Ads 광고그룹 성과 조회 중...');
      
      const { start_date, end_date } = getTikTokDateRange(days);
      
      const params = {
        advertiser_id: ADVERTISER_ID,
        start_date,
        end_date,
        group_by: 'STAT_GROUP_BY_ADGROUP_ID',
        metrics: [
          'adgroup_name',
          'spend',
          'impressions',
          'clicks', 
          'ctr',
          'cpc',
          'cpm',
          'conversions',
          'conversion_rate'
        ].join(',')
      };

      // 특정 캠페인 필터 추가
      if (campaignId) {
        params.campaign_ids = JSON.stringify([campaignId]);
      }

      const response = await this.makeTikTokRequest('/report/integrated/get/', params);
      
      return {
        content: [
          {
            type: 'text',
            text: this.formatAdGroupPerformance(response.data?.list || [], days)
          }
        ]
      };

    } catch (error) {
      console.error('TikTok Ads 광고그룹 성과 조회 실패:', error.message);
      const periodText = getPeriodText(days);
      return {
        content: [
          {
            type: 'text',
            text: `❌ **${periodText} TikTok Ads 광고그룹 성과 조회 실패**\n\n**오류**: ${error.message}\n\n**해결 방법:**\n- 광고그룹이 존재하는지 확인\n- 리포팅 권한이 있는지 확인\n- 날짜 범위 확인`
          }
        ]
      };
    }
  }

  async getCreativePerformance(days, adGroupId) {
    try {
      console.log('🎨 TikTok Ads 소재 성과 조회 중...');
      
      const { start_date, end_date } = getTikTokDateRange(days);
      
      const params = {
        advertiser_id: ADVERTISER_ID,
        start_date,
        end_date,
        group_by: 'STAT_GROUP_BY_AD_ID',
        metrics: [
          'ad_name',
          'spend',
          'impressions',
          'clicks',
          'ctr',
          'cpc',
          'cpm',
          'conversions',
          'conversion_rate',
          'video_play_actions',
          'video_watched_2s',
          'video_watched_6s'
        ].join(',')
      };

      // 특정 광고그룹 필터 추가
      if (adGroupId) {
        params.adgroup_ids = JSON.stringify([adGroupId]);
      }

      const response = await this.makeTikTokRequest('/report/integrated/get/', params);
      
      return {
        content: [
          {
            type: 'text',
            text: this.formatCreativePerformance(response.data?.list || [], days)
          }
        ]
      };

    } catch (error) {
      console.error('TikTok Ads 소재 성과 조회 실패:', error.message);
      const periodText = getPeriodText(days);
      return {
        content: [
          {
            type: 'text',
            text: `❌ **${periodText} TikTok Ads 소재 성과 조회 실패**\n\n**오류**: ${error.message}\n\n**해결 방법:**\n- 광고 소재가 존재하는지 확인\n- 리포팅 권한이 있는지 확인\n- 날짜 범위 확인`
          }
        ]
      };
    }
  }

  // === Helper 메서드들 ===

  async testConnection() {
    try {
      console.log('🔧 TikTok Ads API 연결 테스트 시작...');
      
      // 1단계: Advertiser 정보 확인
      console.log('📋 Advertiser 정보 확인...');
      
      const params = {
        advertiser_ids: `["${ADVERTISER_ID}"]`,
        fields: ['advertiser_id', 'advertiser_name', 'status', 'currency', 'timezone']
      };

      const response = await this.makeTikTokRequest('/advertiser/info/', params);
      
      if (!response.data?.list?.length) {
        throw new Error('Advertiser 정보를 찾을 수 없습니다');
      }

      const advertiser = response.data.list[0];
      
      console.log('✅ TikTok Ads API 연결 성공');
      
      return {
        content: [
          {
            type: 'text',
            text: `✅ **TikTok Ads API 연결 테스트 성공**\n\n` +
                  `🔑 **Access Token**: 설정됨\n` +
                  `🏢 **Advertiser ID**: ${ADVERTISER_ID}\n` +
                  `📱 **App ID**: ${APP_ID || 'N/A'}\n` +
                  `🌐 **Base URL**: ${BASE_URL}\n\n` +
                  `**Advertiser 정보**:\n` +
                  `- ID: ${advertiser.advertiser_id}\n` +
                  `- 이름: ${advertiser.advertiser_name || 'N/A'}\n` +
                  `- 상태: ${advertiser.status || 'N/A'}\n` +
                  `- 통화: ${advertiser.currency || 'N/A'}\n` +
                  `- 시간대: ${advertiser.timezone || 'N/A'}`
          }
        ]
      };
      
    } catch (error) {
      console.error('❌ TikTok Ads API 연결 테스트 실패:', {
        message: error.message,
        status: error.response?.status,
        data: error.response?.data
      });
      
      let diagnosis = '';
      if (error.response?.status === 40001) {
        diagnosis = `\n🔍 **진단**: Access Token 문제\n- Access Token이 만료되었거나 유효하지 않습니다\n- 새로운 토큰을 발급받아야 합니다`;
      } else if (error.response?.status === 40002) {
        diagnosis = `\n🔍 **진단**: 권한 문제\n- Advertiser ID에 대한 접근 권한이 없습니다\n- App이 해당 Advertiser에 대한 권한을 받았는지 확인하세요`;
      } else if (error.response?.status === 40003) {
        diagnosis = `\n🔍 **진단**: Advertiser ID 문제\n- Advertiser ID '${ADVERTISER_ID}'가 존재하지 않거나 잘못되었습니다`;
      }
      
      return {
        content: [
          {
            type: 'text',
            text: `❌ **TikTok Ads API 연결 테스트 실패**\n\n` +
                  `**오류**: ${error.message}\n` +
                  `**상태 코드**: ${error.response?.status || 'N/A'}\n` +
                  `**설정 정보**:\n` +
                  `- Advertiser ID: ${ADVERTISER_ID}\n` +
                  `- Access Token: ${ACCESS_TOKEN ? '설정됨' : '❌ 없음'}\n` +
                  `- App ID: ${APP_ID ? '설정됨' : '❌ 없음'}\n` +
                  `- Secret: ${SECRET ? '설정됨' : '❌ 없음'}` +
                  diagnosis
          }
        ]
      };
    }
  }

  /**
   * TikTok Ads API 공통 요청 메서드
   */
  async makeTikTokRequest(endpoint, params = {}, method = 'GET') {
    const url = `${BASE_URL}${endpoint}`;
    
    try {
      console.log('🔍 TikTok Ads API 요청:', {
        url,
        method,
        advertiser_id: ADVERTISER_ID
      });

      const config = {
        method,
        url,
        headers: {
          'Access-Token': this.accessToken,
          'Content-Type': 'application/json'
        }
      };

      if (method === 'GET') {
        config.params = params;
      } else {
        config.data = params;
      }

      const response = await axios(config);

      console.log('✅ TikTok Ads API 응답:', {
        status: response.status,
        hasData: !!response.data?.data
      });

      // TikTok API 응답 구조 확인
      if (response.data?.code !== 0) {
        throw new Error(response.data?.message || 'TikTok API 오류');
      }

      return response.data;
    } catch (error) {
      // 상세한 에러 로깅
      const errorInfo = {
        status: error.response?.status,
        statusText: error.response?.statusText,
        data: error.response?.data,
        advertiser_id: ADVERTISER_ID,
        endpoint
      };
      
      console.error('❌ TikTok Ads API 요청 실패:', errorInfo);
      
      // 에러 메시지 생성
      let errorMessage = error.message;
      
      if (error.response?.data) {
        const errorData = error.response.data;
        if (errorData.message) {
          errorMessage = errorData.message;
        } else if (errorData.error?.message) {
          errorMessage = errorData.error.message;
        }
      }
      
      // HTTP 상태별 특별 처리
      switch (error.response?.status) {
        case 400:
          errorMessage = `잘못된 요청: ${errorMessage}`;
          break;
        case 401:
          errorMessage = `인증 실패: Access Token이 유효하지 않습니다.`;
          break;
        case 403:
          errorMessage = `권한 없음: Advertiser ID 접근 권한이 없습니다.`;
          break;
        case 404:
          errorMessage = `리소스를 찾을 수 없습니다: ${errorMessage}`;
          break;
      }
      
      throw new Error(errorMessage);
    }
  }

  /**
   * TikTok Ads 캠페인 목록 포맷팅
   */
  formatCampaignList(campaigns, statusFilter) {
    let result = `📋 **TikTok Ads 캠페인 목록 (${statusFilter})**\n\n`;
    
    if (!campaigns || campaigns.length === 0) {
      result += `ℹ️ 조회된 캠페인이 없습니다.\n`;
      return result;
    }

    campaigns.forEach((campaign, index) => {
      const status = campaign.status === 'ENABLE' ? '✅ 활성' : '⏸️ 일시정지';
      const objective = this.getObjectiveText(campaign.objective_type);
      const budget = campaign.budget ? formatCurrency(campaign.budget) : 'N/A';
      
      result += `${index + 1}. **${campaign.campaign_name}**\n`;
      result += `   📍 상태: ${status}\n`;
      result += `   🎯 목표: ${objective}\n`;
      result += `   💰 예산: ${budget} (${campaign.budget_mode || 'N/A'})\n`;
      result += `   🆔 ID: ${campaign.campaign_id}\n\n`;
    });

    return result;
  }

  /**
   * TikTok Ads 캠페인 성과 포맷팅
   */
  formatCampaignPerformance(campaigns, days) {
    const periodText = getPeriodText(days);
    
    if (!campaigns || campaigns.length === 0) {
      return `📊 **${periodText} TikTok Ads 성과 분석**\n\nℹ️ 조회된 성과 데이터가 없습니다.`;
    }

    // 전체 성과 집계
    let totalSpend = 0;
    let totalImpressions = 0;
    let totalClicks = 0;
    let totalConversions = 0;

    campaigns.forEach(row => {
      const metrics = row.metrics;
      totalSpend += parseFloat(metrics.spend || 0);
      totalImpressions += parseInt(metrics.impressions || 0);
      totalClicks += parseInt(metrics.clicks || 0);
      totalConversions += parseFloat(metrics.conversions || 0);
    });

    const overallCTR = totalImpressions > 0 ? (totalClicks / totalImpressions * 100).toFixed(2) : 0;
    const overallCPC = totalClicks > 0 ? (totalSpend / totalClicks).toFixed(2) : 0;
    const overallCPM = totalImpressions > 0 ? (totalSpend / totalImpressions * 1000).toFixed(2) : 0;
    const overallConversionRate = totalClicks > 0 ? (totalConversions / totalClicks * 100).toFixed(2) : 0;

    let result = `📊 **${periodText} TikTok Ads 성과 분석**\n\n`;
    result += `🎯 **전체 성과 요약**\n`;
    result += `💰 총 지출: ${formatCurrency(totalSpend)}\n`;
    result += `👁️ 노출수: ${formatNumber(totalImpressions)}\n`;
    result += `🖱️ 클릭수: ${formatNumber(totalClicks)}\n`;
    result += `🎯 전환수: ${formatNumber(totalConversions)}\n`;
    result += `📈 CTR: ${overallCTR}%\n`;
    result += `💵 CPC: ${formatCurrency(overallCPC)}\n`;
    result += `📊 CPM: ${formatCurrency(overallCPM)}\n`;
    result += `🔄 전환율: ${overallConversionRate}%\n\n`;

    result += `📋 **캠페인별 상세 성과**\n\n`;
    campaigns.forEach((row, index) => {
      const dimensions = row.dimensions;
      const metrics = row.metrics;
      
      const spend = parseFloat(metrics.spend || 0);
      const impressions = parseInt(metrics.impressions || 0);
      const clicks = parseInt(metrics.clicks || 0);
      const conversions = parseFloat(metrics.conversions || 0);
      const ctr = parseFloat(metrics.ctr || 0).toFixed(2);
      const cpc = parseFloat(metrics.cpc || 0).toFixed(2);
      const cpm = parseFloat(metrics.cpm || 0).toFixed(2);

      result += `${index + 1}. **${metrics.campaign_name || dimensions.campaign_name}**\n`;
      result += `   💰 지출: ${formatCurrency(spend)}\n`;
      result += `   👁️ 노출: ${formatNumber(impressions)}\n`;
      result += `   🖱️ 클릭: ${formatNumber(clicks)}\n`;
      result += `   🎯 전환: ${formatNumber(conversions)}\n`;
      result += `   📈 CTR: ${ctr}%\n`;
      result += `   💵 CPC: ${formatCurrency(cpc)}\n`;
      result += `   📊 CPM: ${formatCurrency(cpm)}\n`;
      result += `\n`;
    });

    return result;
  }

  /**
   * TikTok Ads 광고그룹 성과 포맷팅
   */
  formatAdGroupPerformance(adGroups, days) {
    const periodText = getPeriodText(days);
    
    if (!adGroups || adGroups.length === 0) {
      return `🎯 **${periodText} TikTok Ads 광고그룹 성과**\n\nℹ️ 조회된 광고그룹 데이터가 없습니다.`;
    }

    let result = `🎯 **${periodText} TikTok Ads 광고그룹 성과**\n\n`;
    
    adGroups.slice(0, 20).forEach((row, index) => {
      const metrics = row.metrics;
      
      const spend = parseFloat(metrics.spend || 0);
      const impressions = parseInt(metrics.impressions || 0);
      const clicks = parseInt(metrics.clicks || 0);
      const conversions = parseFloat(metrics.conversions || 0);
      const ctr = parseFloat(metrics.ctr || 0).toFixed(2);
      const cpc = parseFloat(metrics.cpc || 0).toFixed(2);

      result += `${index + 1}. **${metrics.adgroup_name}**\n`;
      result += `   💰 지출: ${formatCurrency(spend)}\n`;
      result += `   👁️ 노출: ${formatNumber(impressions)}\n`;
      result += `   🖱️ 클릭: ${formatNumber(clicks)}\n`;
      result += `   🎯 전환: ${formatNumber(conversions)}\n`;
      result += `   📈 CTR: ${ctr}%\n`;
      result += `   💵 CPC: ${formatCurrency(cpc)}\n`;
      result += `\n`;
    });

    return result;
  }

  /**
   * TikTok Ads 소재 성과 포맷팅
   */
  formatCreativePerformance(ads, days) {
    const periodText = getPeriodText(days);
    
    if (!ads || ads.length === 0) {
      return `🎨 **${periodText} TikTok Ads 소재 성과**\n\nℹ️ 조회된 소재 데이터가 없습니다.`;
    }

    let result = `🎨 **${periodText} TikTok Ads 소재 성과**\n\n`;
    
    ads.slice(0, 15).forEach((row, index) => {
      const metrics = row.metrics;
      
      const spend = parseFloat(metrics.spend || 0);
      const impressions = parseInt(metrics.impressions || 0);
      const clicks = parseInt(metrics.clicks || 0);
      const conversions = parseFloat(metrics.conversions || 0);
      const ctr = parseFloat(metrics.ctr || 0).toFixed(2);
      const cpc = parseFloat(metrics.cpc || 0).toFixed(2);
      const videoPlays = parseInt(metrics.video_play_actions || 0);
      const video2s = parseInt(metrics.video_watched_2s || 0);
      const video6s = parseInt(metrics.video_watched_6s || 0);

      result += `${index + 1}. **${metrics.ad_name}**\n`;
      result += `   💰 지출: ${formatCurrency(spend)}\n`;
      result += `   👁️ 노출: ${formatNumber(impressions)}\n`;
      result += `   🖱️ 클릭: ${formatNumber(clicks)}\n`;
      result += `   🎯 전환: ${formatNumber(conversions)}\n`;
      result += `   📈 CTR: ${ctr}%\n`;
      result += `   💵 CPC: ${formatCurrency(cpc)}\n`;
      result += `   ▶️ 영상 재생: ${formatNumber(videoPlays)}\n`;
      result += `   ⏱️ 2초 시청: ${formatNumber(video2s)}\n`;
      result += `   ⏱️ 6초 시청: ${formatNumber(video6s)}\n`;
      result += `\n`;
    });

    return result;
  }

  /**
   * TikTok Ads 목표 타입 텍스트 반환
   */
  getObjectiveText(objectiveType) {
    const objectiveMap = {
      'REACH': '도달',
      'TRAFFIC': '트래픽',
      'APP_INSTALL': '앱 설치',
      'CONVERSIONS': '전환',
      'RF_REACH': 'RF 도달',
      'RF_TRAFFIC': 'RF 트래픽',
      'RF_APP_INSTALL': 'RF 앱 설치',
      'RF_CONVERSIONS': 'RF 전환',
      'LEAD_GENERATION': '리드 생성',
      'VIDEO_VIEWS': '동영상 조회수',
      'CATALOG_SALES': '카탈로그 판매'
    };
    return objectiveMap[objectiveType] || objectiveType;
  }

  /**
   * TikTok Ads 응답을 표준 형식으로 변환
   */
  formatTikTokMetrics(data) {
    return standardizeMetrics(data, 'tiktok');
  }
}