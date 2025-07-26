import axios from 'axios';
import { getTikTokDateRange, getPeriodText } from '../utils/date-utils.js';
import { formatNumber, formatCurrency, formatPercent, standardizeMetrics, formatPerformanceSummary } from '../utils/format-utils.js';

// TikTok Ads API 설정
const ACCESS_TOKEN = process.env.TIKTOK_ACCESS_TOKEN;
const ADVERTISER_ID = process.env.TIKTOK_ADVERTISER_ID;
const APP_ID = process.env.TIKTOK_APP_ID;
const SECRET = process.env.TIKTOK_SECRET;
const BASE_URL = 'https://business-api.tiktok.com/open_api/v1.3';

// API 버전별 엔드포인트 매핑
const API_ENDPOINTS = {
  ADVERTISER_INFO: '/advertiser/info/',
  CAMPAIGN_GET: '/campaign/get/',
  CAMPAIGN_UPDATE_STATUS: '/campaign/status/update/',
  ADGROUP_GET: '/adgroup/get/',
  AD_GET: '/ad/get/',
  REPORT_INTEGRATED: '/report/integrated/get/',
  OAUTH_ACCESS_TOKEN: '/oauth2/access_token/',
  ADVERTISER_CREATE: '/advertiser/create/',
  CAMPAIGN_CREATE: '/campaign/create/',
  ADGROUP_CREATE: '/adgroup/create/',
  AD_CREATE: '/ad/create/'
};

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
        name: 'tiktok_get_campaign_list_with_date_filter',
        description: '특정 날짜 범위에서 활동한 캠페인 목록을 성과 데이터와 함께 조회합니다',
        inputSchema: {
          type: 'object',
          properties: {
            start_date: {
              type: 'string',
              description: '시작일 (YYYY-MM-DD 형식)'
            },
            end_date: {
              type: 'string',
              description: '종료일 (YYYY-MM-DD 형식)'
            }
          },
          required: ['start_date', 'end_date']
        }
      },
      {
        name: 'tiktok_get_ad_level_performance',
        description: '특정 캠페인들의 광고별 상세 성과를 조회합니다',
        inputSchema: {
          type: 'object',
          properties: {
            campaign_ids: {
              type: 'array',
              items: { type: 'string' },
              description: '캠페인 ID 배열'
            },
            start_date: {
              type: 'string',
              description: '시작일 (YYYY-MM-DD 형식)'
            },
            end_date: {
              type: 'string',
              description: '종료일 (YYYY-MM-DD 형식)'
            }
          },
          required: ['campaign_ids', 'start_date', 'end_date']
        }
      },
      {
        name: 'tiktok_test_connection',
        description: 'TikTok Ads API 연결 상태를 테스트합니다',
        inputSchema: {
          type: 'object',
          properties: {}
        }
      },
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
    try {
      // 필수 환경변수 검증
      if (!this.validateEnvironmentVariables()) {
        return this.createErrorResponse('TikTok Ads API 환경변수가 올바르게 설정되지 않았습니다');
      }

      switch (toolName) {
        case 'tiktok_get_campaign_list_with_date_filter':
          return await this.getCampaignListWithDateFilter(args.start_date, args.end_date);
        case 'tiktok_get_ad_level_performance':
          return await this.getAdLevelPerformance(args.campaign_ids, args.start_date, args.end_date);
        case 'tiktok_test_connection':
          return await this.testConnection();
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
        default:
          throw new Error(`Unknown TikTok tool: ${toolName}`);
      }
    } catch (error) {
      console.error(`TikTok tool error [${toolName}]:`, error.message);
      return this.createErrorResponse(`도구 실행 실패: ${error.message}`);
    }
  }

  /**
   * 환경변수 검증
   */
  validateEnvironmentVariables() {
    const required = [ACCESS_TOKEN, ADVERTISER_ID];
    return required.every(val => val && val.trim() !== '');
  }

  /**
   * 에러 응답 생성
   */
  createErrorResponse(message) {
    return {
      content: [
        {
          type: 'text',
          text: `❌ **TikTok Ads API 오류**\n\n${message}\n\n**환경변수 확인:**\n- TIKTOK_ACCESS_TOKEN: ${ACCESS_TOKEN ? '✅ 설정됨' : '❌ 필요'}\n- TIKTOK_ADVERTISER_ID: ${ADVERTISER_ID ? '✅ 설정됨' : '❌ 필요'}\n- TIKTOK_APP_ID: ${APP_ID ? '✅ 설정됨' : '선택사항'}\n- TIKTOK_SECRET: ${SECRET ? '✅ 설정됨' : '선택사항'}`
        }
      ]
    };
  }

  // === 캠페인 관련 메서드들 ===

  async getCampaignPerformance(days, campaignIds) {
    try {
      
      const { start_date, end_date } = getTikTokDateRange(days);
      
      const params = {
        advertiser_id: ADVERTISER_ID,
        service_type: "AUCTION",
        report_type: "BASIC",
        data_level: "AUCTION_CAMPAIGN",
        dimensions: JSON.stringify(["campaign_id", "stat_time_day"]),
        metrics: JSON.stringify([
          "campaign_name",
          "spend",
          "impressions", 
          "clicks",
          "ctr",
          "cpc",
          "cpm",
          "conversions",
          "conversion_rate",
          "cost_per_conversion"
        ]),
        start_date,
        end_date,
        page: 1,
        page_size: 1000
      };

      // 특정 캠페인 ID 필터 추가
      if (campaignIds && campaignIds.length > 0) {
        params.filtering = JSON.stringify([
          {
            "field_name": "campaign_ids",
            "filter_type": "IN",
            "filter_value": JSON.stringify(campaignIds)
          }
        ]);
      }

      const response = await this.makeTikTokRequest(API_ENDPOINTS.REPORT_INTEGRATED, params);
      
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

      const response = await this.makeTikTokRequest(API_ENDPOINTS.CAMPAIGN_GET, params);
      

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

      const params = {
        advertiser_id: ADVERTISER_ID,
        campaign_ids: JSON.stringify([campaignId]),
        operation_status: status
      };

      const response = await this.makeTikTokRequest(API_ENDPOINTS.CAMPAIGN_UPDATE_STATUS, params, 'POST');
      
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
      
      const { start_date, end_date } = getTikTokDateRange(days);
      
      const params = {
        advertiser_id: ADVERTISER_ID,
        service_type: "AUCTION",
        report_type: "BASIC",
        data_level: "AUCTION_ADGROUP",
        dimensions: JSON.stringify(["adgroup_id", "stat_time_day"]),
        metrics: JSON.stringify([
          "adgroup_name",
          "spend",
          "impressions",
          "clicks", 
          "ctr",
          "cpc",
          "cpm",
          "conversions",
          "conversion_rate"
        ]),
        start_date,
        end_date,
        page: 1,
        page_size: 1000
      };

      // 특정 캠페인 필터 추가
      if (campaignId) {
        params.filtering = JSON.stringify([
          {
            "field_name": "campaign_ids",
            "filter_type": "IN",
            "filter_value": JSON.stringify([campaignId])
          }
        ]);
      }

      const response = await this.makeTikTokRequest(API_ENDPOINTS.REPORT_INTEGRATED, params);
      
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
      
      const { start_date, end_date } = getTikTokDateRange(days);
      
      const params = {
        advertiser_id: ADVERTISER_ID,
        service_type: "AUCTION",
        report_type: "BASIC",
        data_level: "AUCTION_AD",
        dimensions: JSON.stringify(["ad_id", "stat_time_day"]),
        metrics: JSON.stringify([
          "ad_name",
          "spend",
          "impressions",
          "clicks",
          "ctr",
          "cpc",
          "cpm",
          "conversions",
          "conversion_rate",
          "video_play_actions",
          "video_watched_2s",
          "video_watched_6s"
        ]),
        start_date,
        end_date,
        page: 1,
        page_size: 1000
      };

      // 특정 광고그룹 필터 추가
      if (adGroupId) {
        params.filtering = JSON.stringify([
          {
            "field_name": "adgroup_ids",
            "filter_type": "IN",
            "filter_value": JSON.stringify([adGroupId])
          }
        ]);
      }

      const response = await this.makeTikTokRequest(API_ENDPOINTS.REPORT_INTEGRATED, params);
      
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
      
      const params = {
        advertiser_ids: `["${ADVERTISER_ID}"]`,
        fields: ['advertiser_id', 'advertiser_name', 'status', 'currency', 'timezone']
      };

      const response = await this.makeTikTokRequest(API_ENDPOINTS.ADVERTISER_INFO, params);
      
      if (!response.data?.list?.length) {
        throw new Error('Advertiser 정보를 찾을 수 없습니다');
      }

      const advertiser = response.data.list[0];
      
      
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
      console.log(`TikTok API Request: ${method} ${url}`);
      console.log('Params:', JSON.stringify(params, null, 2));

      const config = {
        method,
        url,
        headers: {
          'Access-Token': this.accessToken,
          'Content-Type': 'application/json',
          'User-Agent': 'TikTok-MCP-Server/1.0'
        },
        timeout: 30000 // 30초 타임아웃
      };

      if (method === 'GET') {
        config.params = params;
      } else {
        config.data = params;
      }

      const response = await axios(config);
      console.log(`TikTok API Response: ${response.status}`);

      // TikTok API 응답 구조 확인
      if (response.data?.code !== 0) {
        const errorMsg = response.data?.message || 'TikTok API 오류';
        const errorCode = response.data?.code || 'UNKNOWN';
        throw new Error(`[${errorCode}] ${errorMsg}`);
      }

      return response.data;
    } catch (error) {
      console.error('TikTok API Error:', error.message);
      
      // 에러 메시지 생성
      let errorMessage = error.message;
      
      if (error.response?.data) {
        const errorData = error.response.data;
        
        // TikTok API 에러 응답 구조에 맞춤
        if (errorData.code && errorData.message) {
          errorMessage = `[${errorData.code}] ${errorData.message}`;
        } else if (errorData.message) {
          errorMessage = errorData.message;
        } else if (errorData.error?.message) {
          errorMessage = errorData.error.message;
        }
        
        // 일반적인 TikTok API 에러 코드 해석
        if (errorData.code === 40001) {
          errorMessage = '인증 토큰이 유효하지 않거나 만료되었습니다';
        } else if (errorData.code === 40002) {
          errorMessage = 'Advertiser에 대한 접근 권한이 없습니다';
        } else if (errorData.code === 40003) {
          errorMessage = 'Advertiser ID가 존재하지 않거나 올바르지 않습니다';
        } else if (errorData.code === 40004) {
          errorMessage = '요청 파라미터가 잘못되었습니다';
        }
      }
      
      // HTTP 상태별 특별 처리
      switch (error.response?.status) {
        case 400:
          errorMessage = `잘못된 요청: ${errorMessage}`;
          break;
        case 401:
          errorMessage = `인증 실패: ${errorMessage}`;
          break;
        case 403:
          errorMessage = `권한 없음: ${errorMessage}`;
          break;
        case 404:
          errorMessage = `리소스를 찾을 수 없습니다: ${errorMessage}`;
          break;
        case 429:
          errorMessage = `API 요청 한도 초과: ${errorMessage}`;
          break;
        case 500:
          errorMessage = `서버 내부 오류: ${errorMessage}`;
          break;
        default:
          if (error.code === 'ECONNABORTED') {
            errorMessage = 'API 요청 시간 초과';
          } else if (error.code === 'ENOTFOUND') {
            errorMessage = 'TikTok API 서버에 연결할 수 없습니다';
          }
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

    // TikTok API v1.3 응답 구조에 맞춰 데이터 집계
    const campaignMap = new Map();
    
    campaigns.forEach(row => {
      const dimensions = row.dimensions || {};
      const metrics = row.metrics || {};
      const campaignId = dimensions.campaign_id;
      
      if (!campaignMap.has(campaignId)) {
        campaignMap.set(campaignId, {
          campaign_name: metrics.campaign_name || 'Unknown Campaign',
          spend: 0,
          impressions: 0,
          clicks: 0,
          conversions: 0
        });
      }
      
      const campaign = campaignMap.get(campaignId);
      campaign.spend += parseFloat(metrics.spend || 0);
      campaign.impressions += parseInt(metrics.impressions || 0);
      campaign.clicks += parseInt(metrics.clicks || 0);
      campaign.conversions += parseFloat(metrics.conversions || 0);
      
      // 전체 집계
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
    
    // 집계된 캠페인 데이터 출력
    let index = 1;
    campaignMap.forEach((campaign, campaignId) => {
      const spend = campaign.spend;
      const impressions = campaign.impressions;
      const clicks = campaign.clicks;
      const conversions = campaign.conversions;
      const ctr = impressions > 0 ? (clicks / impressions * 100).toFixed(2) : 0;
      const cpc = clicks > 0 ? (spend / clicks).toFixed(2) : 0;
      const cpm = impressions > 0 ? (spend / impressions * 1000).toFixed(2) : 0;

      result += `${index}. **${campaign.campaign_name}**\n`;
      result += `   💰 지출: ${formatCurrency(spend)}\n`;
      result += `   👁️ 노출: ${formatNumber(impressions)}\n`;
      result += `   🖱️ 클릭: ${formatNumber(clicks)}\n`;
      result += `   🎯 전환: ${formatNumber(conversions)}\n`;
      result += `   📈 CTR: ${ctr}%\n`;
      result += `   💵 CPC: ${formatCurrency(cpc)}\n`;
      result += `   📊 CPM: ${formatCurrency(cpm)}\n`;
      result += `   🆔 ID: ${campaignId}\n`;
      result += `\n`;
      index++;
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
    
    // TikTok API v1.3 응답 구조에 맞춰 광고그룹 데이터 집계
    const adGroupMap = new Map();
    
    adGroups.forEach(row => {
      const dimensions = row.dimensions || {};
      const metrics = row.metrics || {};
      const adGroupId = dimensions.adgroup_id;
      
      if (!adGroupMap.has(adGroupId)) {
        adGroupMap.set(adGroupId, {
          adgroup_name: metrics.adgroup_name || 'Unknown AdGroup',
          spend: 0,
          impressions: 0,
          clicks: 0,
          conversions: 0
        });
      }
      
      const adGroup = adGroupMap.get(adGroupId);
      adGroup.spend += parseFloat(metrics.spend || 0);
      adGroup.impressions += parseInt(metrics.impressions || 0);
      adGroup.clicks += parseInt(metrics.clicks || 0);
      adGroup.conversions += parseFloat(metrics.conversions || 0);
    });

    // 상위 20개만 표시
    let index = 1;
    let count = 0;
    adGroupMap.forEach((adGroup, adGroupId) => {
      if (count >= 20) return;
      
      const spend = adGroup.spend;
      const impressions = adGroup.impressions;
      const clicks = adGroup.clicks;
      const conversions = adGroup.conversions;
      const ctr = impressions > 0 ? (clicks / impressions * 100).toFixed(2) : 0;
      const cpc = clicks > 0 ? (spend / clicks).toFixed(2) : 0;

      result += `${index}. **${adGroup.adgroup_name}**\n`;
      result += `   💰 지출: ${formatCurrency(spend)}\n`;
      result += `   👁️ 노출: ${formatNumber(impressions)}\n`;
      result += `   🖱️ 클릭: ${formatNumber(clicks)}\n`;
      result += `   🎯 전환: ${formatNumber(conversions)}\n`;
      result += `   📈 CTR: ${ctr}%\n`;
      result += `   💵 CPC: ${formatCurrency(cpc)}\n`;
      result += `   🆔 ID: ${adGroupId}\n`;
      result += `\n`;
      index++;
      count++;
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
    
    // TikTok API v1.3 응답 구조에 맞춰 광고 소재 데이터 집계
    const adMap = new Map();
    
    ads.forEach(row => {
      const dimensions = row.dimensions || {};
      const metrics = row.metrics || {};
      const adId = dimensions.ad_id;
      
      if (!adMap.has(adId)) {
        adMap.set(adId, {
          ad_name: metrics.ad_name || 'Unknown Ad',
          spend: 0,
          impressions: 0,
          clicks: 0,
          conversions: 0,
          video_play_actions: 0,
          video_watched_2s: 0,
          video_watched_6s: 0
        });
      }
      
      const ad = adMap.get(adId);
      ad.spend += parseFloat(metrics.spend || 0);
      ad.impressions += parseInt(metrics.impressions || 0);
      ad.clicks += parseInt(metrics.clicks || 0);
      ad.conversions += parseFloat(metrics.conversions || 0);
      ad.video_play_actions += parseInt(metrics.video_play_actions || 0);
      ad.video_watched_2s += parseInt(metrics.video_watched_2s || 0);
      ad.video_watched_6s += parseInt(metrics.video_watched_6s || 0);
    });

    // 상위 15개만 표시
    let index = 1;
    let count = 0;
    adMap.forEach((ad, adId) => {
      if (count >= 15) return;
      
      const spend = ad.spend;
      const impressions = ad.impressions;
      const clicks = ad.clicks;
      const conversions = ad.conversions;
      const ctr = impressions > 0 ? (clicks / impressions * 100).toFixed(2) : 0;
      const cpc = clicks > 0 ? (spend / clicks).toFixed(2) : 0;
      const videoPlays = ad.video_play_actions;
      const video2s = ad.video_watched_2s;
      const video6s = ad.video_watched_6s;

      result += `${index}. **${ad.ad_name}**\n`;
      result += `   💰 지출: ${formatCurrency(spend)}\n`;
      result += `   👁️ 노출: ${formatNumber(impressions)}\n`;
      result += `   🖱️ 클릭: ${formatNumber(clicks)}\n`;
      result += `   🎯 전환: ${formatNumber(conversions)}\n`;
      result += `   📈 CTR: ${ctr}%\n`;
      result += `   💵 CPC: ${formatCurrency(cpc)}\n`;
      result += `   ▶️ 영상 재생: ${formatNumber(videoPlays)}\n`;
      result += `   ⏱️ 2초 시청: ${formatNumber(video2s)}\n`;
      result += `   ⏱️ 6초 시청: ${formatNumber(video6s)}\n`;
      result += `   🆔 ID: ${adId}\n`;
      result += `\n`;
      index++;
      count++;
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

  // === 키워드 매칭 함수 (단일/다중 키워드 지원) ===
  
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

  // === 통합 검색을 위한 새로운 메서드들 ===

  /**
   * 특정 날짜 범위에서 활동한 캠페인 목록을 성과 데이터와 함께 조회
   */
  async getCampaignListWithDateFilter(startDate, endDate) {
    try {
      const params = {
        advertiser_id: ADVERTISER_ID,
        start_date: startDate,
        end_date: endDate,
        data_level: 'AUCTION_CAMPAIGN',
        report_type: 'BASIC',
        dimensions: JSON.stringify(['campaign_id']),
        metrics: JSON.stringify([
          'campaign_name',
          'spend'
        ]),
        page_size: 1000
      };

      const response = await this.makeTikTokRequest(API_ENDPOINTS.REPORT_INTEGRATED, params);
      
      // TikTok API 응답을 표준 형식으로 변환
      const campaigns = response.data?.list || [];
      const campaignMap = new Map();
      
      // 중복 캠페인 데이터 집계 (일별 데이터를 캠페인별로 합산)
      campaigns.forEach(row => {
        const dimensions = row.dimensions || {};
        const metrics = row.metrics || {};
        const campaignId = dimensions.campaign_id;
        
        if (!campaignMap.has(campaignId)) {
          campaignMap.set(campaignId, {
            campaign_id: campaignId,
            campaign_name: metrics.campaign_name || 'Unknown Campaign',
            name: metrics.campaign_name || 'Unknown Campaign', // 호환성을 위한 별칭
            spend: 0
          });
        }
        
        const campaign = campaignMap.get(campaignId);
        campaign.spend += parseFloat(metrics.spend || 0);
      });

      // Map을 배열로 변환하고 지출액 > 0인 캠페인만 필터링 후 지출순으로 정렬
      return Array.from(campaignMap.values())
        .filter(campaign => campaign.spend > 0)
        .map(campaign => ({
          ...campaign,
          spend: campaign.spend.toFixed(2)
        }))
        .sort((a, b) => parseFloat(b.spend) - parseFloat(a.spend));

    } catch (error) {
      console.error('TikTok 캠페인 목록 조회 실패:', error.message);
      throw new Error(`TikTok 캠페인 목록 조회 실패: ${error.message}`);
    }
  }

  /**
   * 특정 캠페인들의 광고별 상세 성과 조회
   */
  async getAdLevelPerformance(campaignIds, startDate, endDate) {
    try {
      const params = {
        advertiser_id: ADVERTISER_ID,
        service_type: "AUCTION",
        report_type: "BASIC",
        data_level: "AUCTION_AD",
        dimensions: JSON.stringify(["ad_id", "stat_time_day"]),
        metrics: JSON.stringify([
          "ad_name",
          "campaign_id",
          "spend",
          "impressions",
          "clicks",
          "ctr", 
          "cpc",
          "cpm",
          "conversion",
          "conversion_rate_v2",
          "cost_per_conversion"
        ]),
        start_date: startDate,
        end_date: endDate,
        filtering: JSON.stringify([
          {
            "field_name": "campaign_ids",
            "filter_type": "IN",
            "filter_value": JSON.stringify(campaignIds)
          }
        ]),
        page: 1,
        page_size: 1000
      };

      const response = await this.makeTikTokRequest(API_ENDPOINTS.REPORT_INTEGRATED, params);
      
      // TikTok API 응답을 표준 형식으로 변환
      const ads = response.data?.list || [];
      const adMap = new Map();
      
      // 일별 데이터를 광고별로 그룹화 및 집계
      ads.forEach(row => {
        const dimensions = row.dimensions || {};
        const metrics = row.metrics || {};
        const adId = dimensions.ad_id;
        const date = dimensions.stat_time_day; // 일별 날짜 정보
        
        if (!adMap.has(adId)) {
          adMap.set(adId, {
            ad_id: adId,
            ad_name: metrics.ad_name || `Ad ${adId}`,
            name: metrics.ad_name || `Ad ${adId}`,
            campaign_id: metrics.campaign_id,
            dailyData: [],
            totalSpend: 0,
            totalImpressions: 0,
            totalClicks: 0,
            totalConversions: 0
          });
        }
        
        const ad = adMap.get(adId);
        const spend = parseFloat(metrics.spend || 0);
        const impressions = parseInt(metrics.impressions || 0);
        const clicks = parseInt(metrics.clicks || 0);
        const conversions = parseFloat(metrics.conversion || 0);
        
        // 일별 데이터 추가
        ad.dailyData.push({
          date: date,
          spend: spend,
          impressions: impressions,
          clicks: clicks,
          conversions: conversions
        });
        
        // 총합 계산
        ad.totalSpend += spend;
        ad.totalImpressions += impressions;
        ad.totalClicks += clicks;
        ad.totalConversions += conversions;
      });

      // Map을 배열로 변환하고 요청한 캠페인 ID에 속하는 광고만 필터링 후 지출순으로 정렬
      const campaignIdSet = new Set(campaignIds.map(id => id.toString()));
      
      // 최종 결과 생성 (비율 지표 재계산)
      return Array.from(adMap.values())
        .filter(ad => campaignIdSet.has(ad.campaign_id?.toString()))
        .map(ad => ({
          ad_id: ad.ad_id,
          ad_name: ad.ad_name,
          name: ad.name,
          campaign_id: ad.campaign_id,
          spend: ad.totalSpend.toFixed(2),
          impressions: ad.totalImpressions.toString(),
          clicks: ad.totalClicks.toString(),
          conversions: ad.totalConversions.toString(),
          ctr: ad.totalImpressions > 0 ? (ad.totalClicks / ad.totalImpressions * 100).toFixed(2) : '0.00',
          cpc: ad.totalClicks > 0 ? (ad.totalSpend / ad.totalClicks).toFixed(2) : '0.00',
          cpm: ad.totalImpressions > 0 ? (ad.totalSpend / ad.totalImpressions * 1000).toFixed(2) : '0.00',
          cost_per_conversion: ad.totalConversions > 0 ? (ad.totalSpend / ad.totalConversions).toFixed(2) : '0.00',
          costPerConversion: ad.totalConversions > 0 ? (ad.totalSpend / ad.totalConversions).toFixed(2) : '0.00',
          conversion_rate: ad.totalClicks > 0 ? (ad.totalConversions / ad.totalClicks * 100).toFixed(2) : '0.00',
          dailyData: ad.dailyData.sort((a, b) => a.date.localeCompare(b.date))
        }))
        .sort((a, b) => parseFloat(b.spend) - parseFloat(a.spend));

    } catch (error) {
      console.error('TikTok 광고별 성과 조회 실패:', error.message);
      throw new Error(`TikTok 광고별 성과 조회 실패: ${error.message}`);
    }
  }
}