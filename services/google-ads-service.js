import axios from 'axios';
import { getGoogleDateRange, getPeriodText } from '../utils/date-utils.js';
import { formatNumber, formatCurrency, formatPercent, standardizeMetrics, formatPerformanceSummary } from '../utils/format-utils.js';

// Google Ads API 설정
const CLIENT_ID = process.env.GOOGLE_ADS_CLIENT_ID;
const CLIENT_SECRET = process.env.GOOGLE_ADS_CLIENT_SECRET;
const REFRESH_TOKEN = process.env.GOOGLE_ADS_REFRESH_TOKEN;
const DEVELOPER_TOKEN = process.env.GOOGLE_ADS_DEVELOPER_TOKEN;
const CUSTOMER_ID = process.env.GOOGLE_ADS_CUSTOMER_ID;

// Google Ads API URLs  
const GOOGLE_ADS_API_VERSION = 'v20';
const BASE_URL = `https://googleads.googleapis.com/${GOOGLE_ADS_API_VERSION}`;
const OAUTH_URL = 'https://oauth2.googleapis.com/token';

export class GoogleAdsService {
  constructor() {
    this.platform = 'google';
    this.accessToken = null;
    this.tokenExpiryTime = null;
  }

  /**
   * MCP 도구 목록 반환
   */
  getTools() {
    return [
      {
        name: 'google_get_campaign_performance',
        description: 'Google Ads 캠페인 성과를 조회합니다',
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
        name: 'google_get_campaign_list',
        description: 'Google Ads 캠페인 목록을 조회합니다',
        inputSchema: {
          type: 'object',
          properties: {
            status_filter: {
              type: 'string',
              enum: ['ENABLED', 'PAUSED', 'ALL'],
              default: 'ALL',
              description: '상태별 필터'
            }
          }
        }
      },
      {
        name: 'google_toggle_campaign_status',
        description: 'Google Ads 캠페인 상태를 변경합니다',
        inputSchema: {
          type: 'object',
          properties: {
            campaign_id: {
              type: 'string',
              description: '제어할 캠페인 ID'
            },
            status: {
              type: 'string',
              enum: ['ENABLED', 'PAUSED'],
              description: '설정할 상태'
            }
          },
          required: ['campaign_id', 'status']
        }
      },
      {
        name: 'google_get_keyword_performance',
        description: 'Google Ads 키워드 성과를 조회합니다',
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
              description: '특정 캠페인의 키워드만 조회 (선택사항)'
            }
          }
        }
      },
      {
        name: 'google_get_search_terms',
        description: 'Google Ads 검색어 리포트를 조회합니다',
        inputSchema: {
          type: 'object',
          properties: {
            days: {
              type: 'number',
              description: '조회할 일수',
              default: 7
            },
            min_impressions: {
              type: 'number',
              description: '최소 노출수 필터',
              default: 10
            }
          }
        }
      },
      {
        name: 'google_get_ad_group_list',
        description: 'Google Ads 광고그룹 목록을 조회합니다',
        inputSchema: {
          type: 'object',
          properties: {
            campaign_id: {
              type: 'string',
              description: '특정 캠페인의 광고그룹만 조회 (선택사항)'
            },
            status_filter: {
              type: 'string',
              enum: ['ENABLED', 'PAUSED', 'ALL'],
              default: 'ALL',
              description: '상태별 필터'
            }
          }
        }
      },
      {
        name: 'google_get_ad_group_performance',
        description: 'Google Ads 광고그룹 성과를 조회합니다',
        inputSchema: {
          type: 'object',
          properties: {
            days: {
              type: 'number',
              description: '조회할 일수',
              default: 7
            },
            ad_group_ids: {
              type: 'array',
              items: { type: 'string' },
              description: '특정 광고그룹 ID들 (선택사항)'
            },
            campaign_id: {
              type: 'string',
              description: '특정 캠페인의 광고그룹만 조회 (선택사항)'
            }
          }
        }
      },
      {
        name: 'google_toggle_ad_group_status',
        description: 'Google Ads 광고그룹 상태를 변경합니다',
        inputSchema: {
          type: 'object',
          properties: {
            ad_group_id: {
              type: 'string',
              description: '제어할 광고그룹 ID'
            },
            status: {
              type: 'string',
              enum: ['ENABLED', 'PAUSED'],
              description: '설정할 상태'
            }
          },
          required: ['ad_group_id', 'status']
        }
      },
      {
        name: 'google_bulk_toggle_ad_groups',
        description: 'Google Ads 광고그룹 상태를 일괄 변경합니다',
        inputSchema: {
          type: 'object',
          properties: {
            ad_group_ids: {
              type: 'array',
              items: { type: 'string' },
              description: '제어할 광고그룹 ID 배열'
            },
            status: {
              type: 'string',
              enum: ['ENABLED', 'PAUSED'],
              description: '설정할 상태'
            }
          },
          required: ['ad_group_ids', 'status']
        }
      },
      {
        name: 'google_get_ad_list',
        description: 'Google Ads 광고 목록을 조회합니다',
        inputSchema: {
          type: 'object',
          properties: {
            campaign_id: {
              type: 'string',
              description: '특정 캠페인의 광고만 조회 (선택사항)'
            },
            ad_group_id: {
              type: 'string',
              description: '특정 광고그룹의 광고만 조회 (선택사항)'
            },
            status_filter: {
              type: 'string',
              enum: ['ENABLED', 'PAUSED', 'ALL'],
              default: 'ALL',
              description: '상태별 필터'
            }
          }
        }
      },
      {
        name: 'google_get_ad_performance',
        description: 'Google Ads 광고 성과를 조회합니다',
        inputSchema: {
          type: 'object',
          properties: {
            days: {
              type: 'number',
              description: '조회할 일수',
              default: 7
            },
            ad_ids: {
              type: 'array',
              items: { type: 'string' },
              description: '특정 광고 ID들 (선택사항)'
            },
            campaign_id: {
              type: 'string',
              description: '특정 캠페인의 광고만 조회 (선택사항)'
            },
            ad_group_id: {
              type: 'string',
              description: '특정 광고그룹의 광고만 조회 (선택사항)'
            }
          }
        }
      },
      {
        name: 'google_toggle_ad_status',
        description: 'Google Ads 광고 상태를 변경합니다',
        inputSchema: {
          type: 'object',
          properties: {
            ad_id: {
              type: 'string',
              description: '제어할 광고 ID'
            },
            status: {
              type: 'string',
              enum: ['ENABLED', 'PAUSED'],
              description: '설정할 상태'
            }
          },
          required: ['ad_id', 'status']
        }
      },
      {
        name: 'google_bulk_toggle_ads',
        description: 'Google Ads 광고 상태를 일괄 변경합니다',
        inputSchema: {
          type: 'object',
          properties: {
            ad_ids: {
              type: 'array',
              items: { type: 'string' },
              description: '제어할 광고 ID 배열'
            },
            status: {
              type: 'string',
              enum: ['ENABLED', 'PAUSED'],
              description: '설정할 상태'
            }
          },
          required: ['ad_ids', 'status']
        }
      }
    ];
  }

  /**
   * 도구 호출 처리
   */
  async handleToolCall(toolName, args) {
    switch (toolName) {
      case 'google_get_campaign_performance':
        return await this.getCampaignPerformance(args.days || 7, args.campaign_ids);
      case 'google_get_campaign_list':
        return await this.getCampaignList(args.status_filter || 'ALL');
      case 'google_toggle_campaign_status':
        return await this.toggleCampaignStatus(args.campaign_id, args.status);
      case 'google_get_keyword_performance':
        return await this.getKeywordPerformance(args.days || 7, args.campaign_id);
      case 'google_get_search_terms':
        return await this.getSearchTerms(args.days || 7, args.min_impressions || 10);
      case 'google_get_ad_group_list':
        return await this.getAdGroupList(args.campaign_id, args.status_filter || 'ALL');
      case 'google_get_ad_group_performance':
        return await this.getAdGroupPerformance(args.days || 7, args.ad_group_ids, args.campaign_id);
      case 'google_toggle_ad_group_status':
        return await this.toggleAdGroupStatus(args.ad_group_id, args.status);
      case 'google_bulk_toggle_ad_groups':
        return await this.bulkToggleAdGroups(args.ad_group_ids, args.status);
      case 'google_get_ad_list':
        return await this.getAdList(args.campaign_id, args.ad_group_id, args.status_filter || 'ALL');
      case 'google_get_ad_performance':
        return await this.getAdPerformance(args.days || 7, args.ad_ids, args.campaign_id, args.ad_group_id);
      case 'google_toggle_ad_status':
        return await this.toggleAdStatus(args.ad_id, args.status);
      case 'google_bulk_toggle_ads':
        return await this.bulkToggleAds(args.ad_ids, args.status);
      case 'google_test_connection':
        return await this.testConnection();
      default:
        throw new Error(`Unknown Google tool: ${toolName}`);
    }
  }

  // === 캠페인 관련 메서드들 ===

  async getCampaignPerformance(days, campaignIds) {
    try {
      // console.error('📊 Google Ads 캠페인 성과 조회 중...');
      
      const { start_date, end_date } = getGoogleDateRange(days);
      
      // Google Ads Query Language (GAQL) 쿼리 작성
      let query = `
        SELECT 
          campaign.id,
          campaign.name,
          campaign.status,
          metrics.impressions,
          metrics.clicks,
          metrics.cost_micros,
          metrics.ctr,
          metrics.average_cpc,
          metrics.average_cpm,
          metrics.conversions,
          metrics.cost_per_conversion,
          metrics.conversions_from_interactions_rate
        FROM campaign
        WHERE segments.date BETWEEN '${start_date}' AND '${end_date}'
      `;

      // 특정 캠페인 ID 필터 추가
      if (campaignIds && campaignIds.length > 0) {
        const campaignIdList = campaignIds.map(id => `'${id}'`).join(',');
        query += ` AND campaign.id IN (${campaignIdList})`;
      }

      query += ` ORDER BY metrics.cost_micros DESC`;

      const response = await this.makeGoogleAdsRequest(query);
      
      return {
        content: [
          {
            type: 'text',
            text: this.formatCampaignPerformance(response.results || [], days)
          }
        ]
      };

    } catch (error) {
      // console.error('Google Ads 캠페인 성과 조회 실패:', error.message);
      const periodText = getPeriodText(days);
      return {
        content: [
          {
            type: 'text',
            text: `❌ **${periodText} Google Ads 성과 조회 실패**\n\n**오류**: ${error.message}\n\n**해결 방법:**\n- OAuth 토큰이 유효한지 확인\n- Developer Token 권한 확인\n- Customer ID가 올바른지 확인\n- 날짜 범위가 올바른지 확인`
          }
        ]
      };
    }
  }

  async getCampaignList(statusFilter) {
    try {
      // console.log('📋 Google Ads 캠페인 목록 조회 중...');

      // 간단한 GAQL 쿼리 작성
      let query = `SELECT campaign.id, campaign.name, campaign.status FROM campaign`;

      // 상태 필터 추가
      if (statusFilter !== 'ALL') {
        const googleStatus = statusFilter === 'ENABLED' ? 'ENABLED' : 'PAUSED';
        query += ` WHERE campaign.status = '${googleStatus}'`;
      }

      query += ` LIMIT 20`;

      console.log('GAQL Query:', query);

      // REST API로 Google Ads 호출
      const response = await this.makeGoogleAdsRequest(query);
      
      // console.log('✅ 캠페인 조회 성공');

      return {
        content: [
          {
            type: 'text',
            text: this.formatCampaignListSimple(response.results || [], statusFilter)
          }
        ]
      };

    } catch (error) {
      // console.error('❌ Google Ads 캠페인 목록 조회 실패:', error);
      
      return {
        content: [
          {
            type: 'text',
            text: `❌ **Google Ads 캠페인 목록 조회 실패**\n\n**오류**: ${error.message}\n\n**환경변수 확인:**\n- Customer ID: ${CUSTOMER_ID}\n- Developer Token: ${DEVELOPER_TOKEN ? '설정됨' : '❌ 없음'}\n- Refresh Token: ${REFRESH_TOKEN ? '설정됨' : '❌ 없음'}\n\n**해결 방법:**\n- Customer ID가 올바른지 확인\n- Developer Token이 승인되었는지 확인\n- OAuth 권한 확인`
          }
        ]
      };
    }
  }

  async toggleCampaignStatus(campaignId, status) {
    // TODO: Google Ads API 구현
    return {
      content: [
        {
          type: 'text',
          text: `🔧 **구현 예정**: Google Ads 캠페인 ${campaignId} 상태 변경 (${status})`
        }
      ]
    };
  }

  async getKeywordPerformance(days, campaignId) {
    try {
      // console.log('🔍 Google Ads 키워드 성과 조회 중...');
      
      const { start_date, end_date } = getGoogleDateRange(days);
      
      // Google Ads Query Language (GAQL) 쿼리 작성
      let query = `
        SELECT 
          campaign.id,
          campaign.name,
          ad_group.id,
          ad_group.name,
          ad_group_criterion.keyword.text,
          ad_group_criterion.keyword.match_type,
          metrics.impressions,
          metrics.clicks,
          metrics.cost_micros,
          metrics.ctr,
          metrics.average_cpc,
          metrics.conversions,
          metrics.cost_per_conversion,
          metrics.conversions_from_interactions_rate,
          metrics.quality_score
        FROM keyword_view
        WHERE segments.date BETWEEN '${start_date}' AND '${end_date}'
          AND ad_group_criterion.type = 'KEYWORD'
      `;

      // 특정 캠페인 필터 추가
      if (campaignId) {
        query += ` AND campaign.id = '${campaignId}'`;
      }

      query += ` ORDER BY metrics.cost_micros DESC LIMIT 50`;

      const response = await this.makeGoogleAdsRequest(query);
      
      return {
        content: [
          {
            type: 'text',
            text: this.formatKeywordPerformance(response.results || [], days)
          }
        ]
      };

    } catch (error) {
      // console.error('Google Ads 키워드 성과 조회 실패:', error.message);
      const periodText = getPeriodText(days);
      return {
        content: [
          {
            type: 'text',
            text: `❌ **${periodText} Google Ads 키워드 성과 조회 실패**\n\n**오류**: ${error.message}\n\n**해결 방법:**\n- 검색 광고 캠페인이 있는지 확인\n- 키워드가 설정되어 있는지 확인\n- 데이터 권한이 있는지 확인`
          }
        ]
      };
    }
  }

  async getSearchTerms(days, minImpressions) {
    // TODO: Google Ads API 구현
    const periodText = getPeriodText(days);
    
    return {
      content: [
        {
          type: 'text',
          text: `🔎 **${periodText} Google Ads 검색어 리포트**\n\n🔧 **구현 예정**: 검색어별 성과 분석 기능 (최소 노출수: ${minImpressions})`
        }
      ]
    };
  }

  async testConnection() {
    try {
      // console.log('🔧 Google Ads API 연결 테스트 시작...');
      
      // 1단계: OAuth 토큰 테스트
      const accessToken = await this.getAccessToken();
      // console.log('✅ OAuth 토큰 갱신 성공');
      
      // 2단계: Customer ID 정보 확인
      const customerId = CUSTOMER_ID.replace(/-/g, '');
      // console.log('📋 Customer ID:', customerId);
      
      // 3단계: 간단한 API 호출 테스트 (Customer 정보 조회)
      const customerUrl = `${BASE_URL}/customers/${customerId}`;
      
      // console.log('🔍 Customer 정보 요청:', customerUrl);
      
      const response = await axios.get(customerUrl, {
        headers: {
          'Authorization': `Bearer ${accessToken}`,
          'developer-token': DEVELOPER_TOKEN,
          'Content-Type': 'application/json'
        }
      });
      
      // console.log('✅ Customer 정보 조회 성공');
      
      return {
        content: [
          {
            type: 'text',
            text: `✅ **Google Ads API 연결 테스트 성공**\n\n` +
                  `🔑 **OAuth**: 토큰 갱신 성공\n` +
                  `🏢 **Customer ID**: ${CUSTOMER_ID} (${customerId})\n` +
                  `🔧 **Developer Token**: 설정됨\n` +
                  `📊 **API 버전**: ${GOOGLE_ADS_API_VERSION}\n` +
                  `🌐 **Base URL**: ${BASE_URL}\n\n` +
                  `**Customer 정보**:\n` +
                  `- ID: ${response.data.id || 'N/A'}\n` +
                  `- 이름: ${response.data.descriptiveName || 'N/A'}\n` +
                  `- 통화: ${response.data.currencyCode || 'N/A'}\n` +
                  `- 시간대: ${response.data.timeZone || 'N/A'}`
          }
        ]
      };
      
    } catch (error) {
      // console.error('❌ Google Ads API 연결 테스트 실패:', {
      //   message: error.message,
      //   status: error.response?.status,
      //   data: error.response?.data
      // });
      
      let diagnosis = '';
      if (error.response?.status === 401) {
        diagnosis = `\n🔍 **진단**: OAuth 토큰 문제\n- Refresh Token이 만료되었을 수 있습니다\n- 스코프에 'https://www.googleapis.com/auth/adwords'가 포함되어야 합니다`;
      } else if (error.response?.status === 403) {
        diagnosis = `\n🔍 **진단**: 권한 문제\n- Developer Token이 승인되지 않았을 수 있습니다\n- Customer ID에 대한 접근 권한이 없을 수 있습니다`;
      } else if (error.response?.status === 404) {
        diagnosis = `\n🔍 **진단**: Customer ID 문제\n- Customer ID '${CUSTOMER_ID}'가 존재하지 않거나 잘못되었습니다\n- MCC(매니저 계정) ID를 사용했을 수도 있습니다`;
      }
      
      return {
        content: [
          {
            type: 'text',
            text: `❌ **Google Ads API 연결 테스트 실패**\n\n` +
                  `**오류**: ${error.message}\n` +
                  `**상태 코드**: ${error.response?.status || 'N/A'}\n` +
                  `**설정 정보**:\n` +
                  `- Customer ID: ${CUSTOMER_ID}\n` +
                  `- API 버전: ${GOOGLE_ADS_API_VERSION}\n` +
                  `- Developer Token: ${DEVELOPER_TOKEN ? '설정됨' : '❌ 없음'}\n` +
                  `- Client ID: ${CLIENT_ID ? '설정됨' : '❌ 없음'}\n` +
                  `- Refresh Token: ${REFRESH_TOKEN ? '설정됨' : '❌ 없음'}` +
                  diagnosis
          }
        ]
      };
    }
  }

  // === Helper 메서드들 ===

  /**
   * OAuth 2.0 Access Token 갱신
   */
  async getAccessToken() {
    // 토큰이 유효하면 기존 토큰 사용
    if (this.accessToken && this.tokenExpiryTime && Date.now() < this.tokenExpiryTime) {
      return this.accessToken;
    }

    try {
      // console.log('🔄 Google Ads OAuth 토큰 갱신 중...');
      
      const params = new URLSearchParams({
        client_id: CLIENT_ID,
        client_secret: CLIENT_SECRET,
        refresh_token: REFRESH_TOKEN,
        grant_type: 'refresh_token'
      });

      const response = await axios.post(OAUTH_URL, params.toString(), {
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded'
        }
      });

      this.accessToken = response.data.access_token;
      // 토큰 만료 시간 설정 (응답에서 받은 expires_in - 5분 여유)
      this.tokenExpiryTime = Date.now() + (response.data.expires_in - 300) * 1000;
      
      // console.log('✅ Google Ads OAuth 토큰 갱신 완료');
      return this.accessToken;

    } catch (error) {
      // console.error('❌ Google Ads OAuth 토큰 갱신 실패:', error.response?.data || error.message);
      throw new Error(`Google Ads OAuth 인증 실패: ${error.response?.data?.error_description || error.message}`);
    }
  }

  /**
   * Google Ads API 공통 요청 메서드 (REST API)
   */
  async makeGoogleAdsRequest(query) {
    const accessToken = await this.getAccessToken();
    
    // Customer ID 처리 (하이픈 제거)
    const customerId = CUSTOMER_ID.replace(/-/g, '');
    
    // Google Ads REST API 엔드포인트
    const url = `${BASE_URL}/customers/${customerId}/googleAds:search`;
    
    try {
      // console.log('🔍 Google Ads API 요청:', {
      //   url,
      //   customerId,
      //   apiVersion: GOOGLE_ADS_API_VERSION
      // });

      const requestBody = {
        query: query.trim()
      };

      // console.log('요청 본문:', requestBody);

      const response = await axios.post(url, requestBody, {
        headers: {
          'Authorization': `Bearer ${accessToken}`,
          'developer-token': DEVELOPER_TOKEN,
          'Content-Type': 'application/json',
          'login-customer-id': customerId
        }
      });

      // console.log('✅ Google Ads API 응답:', {
      //   status: response.status,
      //   hasResults: !!response.data?.results
      // });

      return response.data;
    } catch (error) {
      // 상세한 에러 로깅
      const errorInfo = {
        status: error.response?.status,
        statusText: error.response?.statusText,
        data: error.response?.data,
        customerId,
        query: query.trim()
      };
      
      // console.error('❌ Google Ads API 요청 실패:', errorInfo);
      
      // 에러 메시지 생성
      let errorMessage = error.message;
      
      if (error.response?.data) {
        const errorData = error.response.data;
        if (errorData.error?.message) {
          errorMessage = errorData.error.message;
        } else if (errorData.error?.details) {
          errorMessage = errorData.error.details.map(d => d.message || d.reason).join(', ');
        }
      }
      
      // HTTP 상태별 특별 처리
      switch (error.response?.status) {
        case 400:
          errorMessage = `잘못된 GAQL 쿼리: ${errorMessage}`;
          break;
        case 401:
          errorMessage = `인증 실패: OAuth 토큰이 유효하지 않습니다.`;
          break;
        case 403:
          errorMessage = `권한 없음: Developer Token이 승인되지 않았거나 Customer ID 접근 권한이 없습니다.`;
          break;
        case 404:
          errorMessage = `Customer ID ${customerId}를 찾을 수 없습니다.`;
          break;
      }
      
      throw new Error(errorMessage);
    }
  }

  /**
   * Google Ads 날짜 형식으로 변환 (YYYY-MM-DD)
   */
  formatGoogleDate(date) {
    return date.toISOString().split('T')[0];
  }

  /**
   * Google Ads 캠페인 목록 포맷팅 (간단한 버전)
   */
  formatCampaignListSimple(campaigns, statusFilter) {
    let result = `📋 **Google Ads 캠페인 목록 (${statusFilter})**\n\n`;
    
    if (!campaigns || campaigns.length === 0) {
      result += `ℹ️ 조회된 캠페인이 없습니다.\n`;
      return result;
    }

    campaigns.forEach((row, index) => {
      const campaign = row.campaign;
      const status = campaign.status === 'ENABLED' ? '✅ 활성' : '⏸️ 일시정지';
      
      result += `${index + 1}. **${campaign.name}**\n`;
      result += `   📍 상태: ${status}\n`;
      result += `   🆔 ID: ${campaign.id}\n\n`;
    });

    return result;
  }

  /**
   * Google Ads 캠페인 목록 포맷팅 (새로운 API 응답용)
   */
  formatCampaignListNew(campaigns, statusFilter) {
    let result = `📋 **Google Ads 캠페인 목록 (${statusFilter})**\n\n`;
    
    if (!campaigns || campaigns.length === 0) {
      result += `ℹ️ 조회된 캠페인이 없습니다.\n`;
      return result;
    }

    campaigns.forEach((campaign, index) => {
      const status = campaign.campaign.status === 'ENABLED' ? '✅ 활성' : '⏸️ 일시정지';
      const channelType = this.getChannelTypeText(campaign.campaign.advertising_channel_type);
      
      result += `${index + 1}. **${campaign.campaign.name}**\n`;
      result += `   📍 상태: ${status}\n`;
      result += `   📺 채널: ${channelType}\n`;
      result += `   🆔 ID: ${campaign.campaign.id}\n\n`;
    });

    return result;
  }

  /**
   * Google Ads 캠페인 목록 포맷팅 (레거시)
   */
  formatCampaignList(campaigns, statusFilter) {
    let result = `📋 **Google Ads 캠페인 목록 (${statusFilter})**\n\n`;
    
    if (!campaigns || campaigns.length === 0) {
      result += `ℹ️ 조회된 캠페인이 없습니다.\n`;
      return result;
    }

    campaigns.forEach((row, index) => {
      const campaign = row.campaign;
      const status = campaign.status === 'ENABLED' ? '✅ 활성' : '⏸️ 일시정지';
      const channelType = this.getChannelTypeText(campaign.advertisingChannelType);
      
      result += `${index + 1}. **${campaign.name}**\n`;
      result += `   📍 상태: ${status}\n`;
      result += `   📺 채널: ${channelType}\n`;
      result += `   📅 시작일: ${campaign.startDate}\n`;
      if (campaign.endDate) {
        result += `   📅 종료일: ${campaign.endDate}\n`;
      }
      result += `   🆔 ID: ${campaign.id}\n\n`;
    });

    return result;
  }

  /**
   * Google Ads 캠페인 성과 포맷팅
   */
  formatCampaignPerformance(campaigns, days) {
    const periodText = getPeriodText(days);
    
    if (!campaigns || campaigns.length === 0) {
      return `📊 **${periodText} Google Ads 성과 분석**\n\nℹ️ 조회된 성과 데이터가 없습니다.`;
    }

    // 전체 성과 집계
    let totalSpend = 0;
    let totalImpressions = 0;
    let totalClicks = 0;
    let totalConversions = 0;

    campaigns.forEach(row => {
      const metrics = row.metrics;
      totalSpend += parseInt(metrics.costMicros || 0) / 1000000; // 마이크로 단위를 달러로 변환
      totalImpressions += parseInt(metrics.impressions || 0);
      totalClicks += parseInt(metrics.clicks || 0);
      totalConversions += parseFloat(metrics.conversions || 0);
    });

    const overallCTR = totalImpressions > 0 ? (totalClicks / totalImpressions * 100).toFixed(2) : 0;
    const overallCPC = totalClicks > 0 ? (totalSpend / totalClicks).toFixed(2) : 0;
    const overallCPM = totalImpressions > 0 ? (totalSpend / totalImpressions * 1000).toFixed(2) : 0;
    const overallConversionRate = totalClicks > 0 ? (totalConversions / totalClicks * 100).toFixed(2) : 0;

    let result = `📊 **${periodText} Google Ads 성과 분석**\n\n`;
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
      const campaign = row.campaign;
      const metrics = row.metrics;
      
      const spend = parseInt(metrics.costMicros || 0) / 1000000;
      const impressions = parseInt(metrics.impressions || 0);
      const clicks = parseInt(metrics.clicks || 0);
      const conversions = parseFloat(metrics.conversions || 0);
      const costPerConversion = parseInt(metrics.costPerConversion || 0) / 1000000;
      const conversionRate = parseFloat(metrics.conversionsFromInteractionsRate || 0) * 100;
      const ctr = parseFloat(metrics.ctr || 0).toFixed(2);
      const cpc = parseInt(metrics.averageCpc || 0) / 1000000;
      const cpm = parseInt(metrics.averageCpm || 0) / 1000000;

      result += `${index + 1}. **${campaign.name}**\n`;
      result += `   📍 상태: ${campaign.status === 'ENABLED' ? '✅ 활성' : '⏸️ 일시정지'}\n`;
      result += `   💰 지출: ${formatCurrency(spend)}\n`;
      result += `   👁️ 노출: ${formatNumber(impressions)}\n`;
      result += `   🖱️ 클릭: ${formatNumber(clicks)}\n`;
      result += `   🎯 전환: ${formatNumber(conversions)}\n`;
      result += `   💰 전환당비용: ${formatCurrency(costPerConversion)}\n`;
      result += `   📈 CTR: ${ctr}%\n`;
      result += `   🔄 전환율: ${conversionRate.toFixed(2)}%\n`;
      result += `   💵 CPC: ${formatCurrency(cpc)}\n`;
      result += `   📊 CPM: ${formatCurrency(cpm)}\n`;
      result += `\n`;
    });

    return result;
  }

  /**
   * Google Ads 키워드 성과 포맷팅
   */
  formatKeywordPerformance(keywords, days) {
    const periodText = getPeriodText(days);
    
    if (!keywords || keywords.length === 0) {
      return `🔍 **${periodText} Google Ads 키워드 성과**\n\nℹ️ 조회된 키워드 데이터가 없습니다.`;
    }

    // 전체 성과 집계
    let totalSpend = 0;
    let totalImpressions = 0;
    let totalClicks = 0;
    let totalConversions = 0;

    keywords.forEach(row => {
      const metrics = row.metrics;
      totalSpend += parseInt(metrics.costMicros || 0) / 1000000;
      totalImpressions += parseInt(metrics.impressions || 0);
      totalClicks += parseInt(metrics.clicks || 0);
      totalConversions += parseFloat(metrics.conversions || 0);
    });

    const overallCTR = totalImpressions > 0 ? (totalClicks / totalImpressions * 100).toFixed(2) : 0;
    const overallCPC = totalClicks > 0 ? (totalSpend / totalClicks).toFixed(2) : 0;

    let result = `🔍 **${periodText} Google Ads 키워드 성과**\n\n`;
    result += `🎯 **전체 키워드 성과**\n`;
    result += `💰 총 지출: ${formatCurrency(totalSpend)}\n`;
    result += `👁️ 노출수: ${formatNumber(totalImpressions)}\n`;
    result += `🖱️ 클릭수: ${formatNumber(totalClicks)}\n`;
    result += `🎯 전환수: ${formatNumber(totalConversions)}\n`;
    result += `📈 CTR: ${overallCTR}%\n`;
    result += `💵 평균 CPC: ${formatCurrency(overallCPC)}\n\n`;

    result += `📋 **키워드별 상세 성과 (상위 ${Math.min(keywords.length, 20)}개)**\n\n`;
    keywords.slice(0, 20).forEach((row, index) => {
      const campaign = row.campaign;
      const adGroup = row.ad_group;
      const keyword = row.ad_group_criterion.keyword;
      const metrics = row.metrics;
      
      const spend = parseInt(metrics.costMicros || 0) / 1000000;
      const impressions = parseInt(metrics.impressions || 0);
      const clicks = parseInt(metrics.clicks || 0);
      const conversions = parseFloat(metrics.conversions || 0);
      const ctr = parseFloat(metrics.ctr || 0).toFixed(2);
      const cpc = parseInt(metrics.averageCpc || 0) / 1000000;
      const qualityScore = metrics.qualityScore || 'N/A';
      const matchType = this.getMatchTypeText(keyword.matchType);

      result += `${index + 1}. **${keyword.text}** (${matchType})\n`;
      result += `   📢 캠페인: ${campaign.name}\n`;
      result += `   📁 광고그룹: ${adGroup.name}\n`;
      result += `   💰 지출: ${formatCurrency(spend)}\n`;
      result += `   👁️ 노출: ${formatNumber(impressions)}\n`;
      result += `   🖱️ 클릭: ${formatNumber(clicks)}\n`;
      result += `   🎯 전환: ${formatNumber(conversions)}\n`;
      result += `   📈 CTR: ${ctr}%\n`;
      result += `   💵 CPC: ${formatCurrency(cpc)}\n`;
      result += `   ⭐ 품질점수: ${qualityScore}\n`;
      result += `\n`;
    });

    return result;
  }

  /**
   * Google Ads 매치 타입 텍스트 반환
   */
  getMatchTypeText(matchType) {
    const matchMap = {
      'EXACT': '완전일치',
      'PHRASE': '구문일치', 
      'BROAD': '확장일치',
      'BROAD_MATCH_MODIFIER': '수정된 확장일치'
    };
    return matchMap[matchType] || matchType;
  }

  /**
   * Google Ads 채널 타입 텍스트 반환
   */
  getChannelTypeText(channelType) {
    const channelMap = {
      'SEARCH': '검색 광고',
      'DISPLAY': '디스플레이 광고',
      'SHOPPING': '쇼핑 광고',
      'VIDEO': '동영상 광고',
      'MULTI_CHANNEL': '다중 채널',
      'LOCAL': '로컬 광고',
      'SMART': '스마트 캠페인',
      'PERFORMANCE_MAX': '성과 최대화',
      'LOCAL_SERVICES': '로컬 서비스',
      'DISCOVERY': '디스커버리 광고'
    };
    return channelMap[channelType] || channelType;
  }

  /**
   * Google Ads 응답을 표준 형식으로 변환
   */
  formatGoogleMetrics(data) {
    return standardizeMetrics(data, 'google');
  }

  // === 광고그룹 관련 메서드들 ===

  async getAdGroupList(campaignId, statusFilter) {
    try {
      // console.log('📋 Google Ads 광고그룹 목록 조회 중...');
      
      await this.getAccessToken();
      
      let gaqlQuery = `
        SELECT 
          ad_group.id,
          ad_group.name,
          ad_group.status,
          ad_group.type,
          campaign.id,
          campaign.name
        FROM ad_group
      `;
      
      const conditions = [];
      
      if (statusFilter !== 'ALL') {
        conditions.push(`ad_group.status = '${statusFilter}'`);
      }
      
      if (campaignId) {
        conditions.push(`campaign.id = '${campaignId}'`);
      }
      
      if (conditions.length > 0) {
        gaqlQuery += ` WHERE ${conditions.join(' AND ')}`;
      }
      
      gaqlQuery += ' ORDER BY ad_group.name';
      
      const response = await this.makeGoogleAdsRequest(gaqlQuery);
      
      return {
        content: [
          {
            type: 'text',
            text: this.formatAdGroupList(response.results || [], statusFilter)
          }
        ]
      };
      
    } catch (error) {
      // console.error('Google Ads 광고그룹 목록 조회 실패:', error.message);
      
      return {
        content: [
          {
            type: 'text',
            text: `❌ **Google Ads 광고그룹 목록 조회 실패**\n\n**오류**: ${error.message}\n\n**해결 방법:**\n- OAuth 토큰이 유효한지 확인\n- Customer ID가 올바른지 확인\n- 캠페인 ID가 존재하는지 확인`
          }
        ]
      };
    }
  }

  async getAdGroupPerformance(days, adGroupIds, campaignId) {
    try {
      // console.log('📊 Google Ads 광고그룹 성과 조회 중...');
      
      await this.getAccessToken();
      
      const { start_date, end_date } = getGoogleDateRange(days);
      
      let gaqlQuery = `
        SELECT 
          ad_group.id,
          ad_group.name,
          ad_group.status,
          campaign.name,
          metrics.impressions,
          metrics.clicks,
          metrics.cost_micros,
          metrics.ctr,
          metrics.average_cpc,
          metrics.conversions,
          metrics.cost_per_conversion,
          metrics.conversions_from_interactions_rate
        FROM ad_group
        WHERE segments.date BETWEEN '${start_date}' AND '${end_date}'
          AND metrics.impressions > 0
      `;
      
      const conditions = [];
      
      if (adGroupIds && adGroupIds.length > 0) {
        const idList = adGroupIds.map(id => `'${id}'`).join(',');
        conditions.push(`ad_group.id IN (${idList})`);
      }
      
      if (campaignId) {
        conditions.push(`campaign.id = '${campaignId}'`);
      }
      
      if (conditions.length > 0) {
        gaqlQuery += ` AND ${conditions.join(' AND ')}`;
      }
      
      gaqlQuery += ' ORDER BY metrics.cost_micros DESC';
      
      const response = await this.makeGoogleAdsRequest(gaqlQuery);
      
      return {
        content: [
          {
            type: 'text',
            text: this.formatAdGroupPerformance(response.results || [], days)
          }
        ]
      };
      
    } catch (error) {
      // console.error('Google Ads 광고그룹 성과 조회 실패:', error.message);
      const periodText = getPeriodText(days);
      
      return {
        content: [
          {
            type: 'text',
            text: `❌ **${periodText} Google Ads 광고그룹 성과 조회 실패**\n\n**오류**: ${error.message}\n\n**해결 방법:**\n- 날짜 범위가 올바른지 확인\n- 광고그룹 ID가 존재하는지 확인\n- 리포팅 권한이 있는지 확인`
          }
        ]
      };
    }
  }

  async toggleAdGroupStatus(adGroupId, status) {
    try {
      // console.log(`🔄 Google Ads 광고그룹 ${adGroupId} 상태 변경: ${status}`);
      
      await this.getAccessToken();
      
      const requestBody = {
        operations: [
          {
            update: {
              resourceName: `customers/${CUSTOMER_ID}/adGroups/${adGroupId}`,
              status: status
            },
            updateMask: 'status'
          }
        ]
      };
      
      const response = await this.makeGoogleAdsMutateRequest('adGroups:mutate', requestBody);
      
      return {
        content: [
          {
            type: 'text',
            text: `✅ **Google Ads 광고그룹 상태 변경 완료**\n\n광고그룹 ID: ${adGroupId}\n새 상태: ${status === 'ENABLED' ? '✅ 활성' : '⏸️ 일시정지'}`
          }
        ]
      };
      
    } catch (error) {
      // console.error('Google Ads 광고그룹 상태 변경 실패:', error.message);
      return {
        content: [
          {
            type: 'text',
            text: `❌ **Google Ads 광고그룹 상태 변경 실패**\n\n**오류**: ${error.message}\n\n**해결 방법:**\n- 광고그룹 ID가 올바른지 확인\n- 광고그룹 수정 권한이 있는지 확인\n- 광고그룹이 이미 해당 상태인지 확인`
          }
        ]
      };
    }
  }

  async bulkToggleAdGroups(adGroupIds, status) {
    try {
      // console.log(`🔄 Google Ads 광고그룹 ${adGroupIds.length}개 일괄 상태 변경: ${status}`);
      
      await this.getAccessToken();
      
      const operations = adGroupIds.map(id => ({
        update: {
          resourceName: `customers/${CUSTOMER_ID}/adGroups/${id}`,
          status: status
        },
        updateMask: 'status'
      }));
      
      const requestBody = { operations };
      
      const response = await this.makeGoogleAdsMutateRequest('adGroups:mutate', requestBody);
      
      return {
        content: [
          {
            type: 'text',
            text: `✅ **Google Ads 광고그룹 일괄 상태 변경 완료**\n\n변경된 광고그룹 수: ${adGroupIds.length}개\n새 상태: ${status === 'ENABLED' ? '✅ 활성' : '⏸️ 일시정지'}`
          }
        ]
      };
      
    } catch (error) {
      // console.error('Google Ads 광고그룹 일괄 상태 변경 실패:', error.message);
      return {
        content: [
          {
            type: 'text',
            text: `❌ **Google Ads 광고그룹 일괄 상태 변경 실패**\n\n**오류**: ${error.message}\n\n**해결 방법:**\n- 광고그룹 ID들이 올바른지 확인\n- 광고그룹 수정 권한이 있는지 확인\n- 일부 광고그룹이 이미 해당 상태인지 확인`
          }
        ]
      };
    }
  }

  // === 광고 관련 메서드들 ===

  async getAdList(campaignId, adGroupId, statusFilter) {
    try {
      // console.log('📋 Google Ads 광고 목록 조회 중...');
      
      await this.getAccessToken();
      
      let gaqlQuery = `
        SELECT 
          ad_group_ad.ad.id,
          ad_group_ad.ad.name,
          ad_group_ad.status,
          ad_group_ad.ad.type,
          ad_group.id,
          ad_group.name,
          campaign.id,
          campaign.name
        FROM ad_group_ad
      `;
      
      const conditions = [];
      
      if (statusFilter !== 'ALL') {
        conditions.push(`ad_group_ad.status = '${statusFilter}'`);
      }
      
      if (campaignId) {
        conditions.push(`campaign.id = '${campaignId}'`);
      }
      
      if (adGroupId) {
        conditions.push(`ad_group.id = '${adGroupId}'`);
      }
      
      if (conditions.length > 0) {
        gaqlQuery += ` WHERE ${conditions.join(' AND ')}`;
      }
      
      gaqlQuery += ' ORDER BY ad_group_ad.ad.name';
      
      const response = await this.makeGoogleAdsRequest(gaqlQuery);
      
      return {
        content: [
          {
            type: 'text',
            text: this.formatAdList(response.results || [], statusFilter)
          }
        ]
      };
      
    } catch (error) {
      // console.error('Google Ads 광고 목록 조회 실패:', error.message);
      
      return {
        content: [
          {
            type: 'text',
            text: `❌ **Google Ads 광고 목록 조회 실패**\n\n**오류**: ${error.message}\n\n**해결 방법:**\n- OAuth 토큰이 유효한지 확인\n- Customer ID가 올바른지 확인\n- 캠페인/광고그룹 ID가 존재하는지 확인`
          }
        ]
      };
    }
  }

  async getAdPerformance(days, adIds, campaignId, adGroupId) {
    try {
      // console.log('📊 Google Ads 광고 성과 조회 중...');
      
      await this.getAccessToken();
      
      const { start_date, end_date } = getGoogleDateRange(days);
      
      let gaqlQuery = `
        SELECT 
          ad_group_ad.ad.id,
          ad_group_ad.ad.name,
          ad_group.name,
          campaign.name,
          metrics.impressions,
          metrics.clicks,
          metrics.cost_micros,
          metrics.ctr,
          metrics.average_cpc,
          metrics.conversions,
          metrics.cost_per_conversion,
          metrics.conversions_from_interactions_rate,
          ad_group_ad.status,
          ad_group_ad.ad.type
        FROM ad_group_ad
        WHERE segments.date BETWEEN '${start_date}' AND '${end_date}'
          AND metrics.impressions > 0
      `;
      
      const conditions = [];
      
      if (adIds && adIds.length > 0) {
        const idList = adIds.map(id => `'${id}'`).join(',');
        conditions.push(`ad_group_ad.ad.id IN (${idList})`);
      }
      
      if (campaignId) {
        conditions.push(`campaign.id = '${campaignId}'`);
      }
      
      if (adGroupId) {
        conditions.push(`ad_group.id = '${adGroupId}'`);
      }
      
      if (conditions.length > 0) {
        gaqlQuery += ` AND ${conditions.join(' AND ')}`;
      }
      
      gaqlQuery += ' ORDER BY metrics.cost_micros DESC';
      
      const response = await this.makeGoogleAdsRequest(gaqlQuery);
      
      return {
        content: [
          {
            type: 'text',
            text: this.formatAdPerformance(response.results || [], days)
          }
        ]
      };
      
    } catch (error) {
      // console.error('Google Ads 광고 성과 조회 실패:', error.message);
      const periodText = getPeriodText(days);
      
      return {
        content: [
          {
            type: 'text',
            text: `❌ **${periodText} Google Ads 광고 성과 조회 실패**\n\n**오류**: ${error.message}\n\n**해결 방법:**\n- 날짜 범위가 올바른지 확인\n- 광고 ID가 존재하는지 확인\n- 리포팅 권한이 있는지 확인`
          }
        ]
      };
    }
  }

  async toggleAdStatus(adId, status) {
    try {
      // console.log(`🔄 Google Ads 광고 ${adId} 상태 변경: ${status}`);
      
      await this.getAccessToken();
      
      const requestBody = {
        operations: [
          {
            update: {
              resourceName: `customers/${CUSTOMER_ID}/adGroupAds/${adId}`,
              status: status
            },
            updateMask: 'status'
          }
        ]
      };
      
      const response = await this.makeGoogleAdsMutateRequest('adGroupAds:mutate', requestBody);
      
      return {
        content: [
          {
            type: 'text',
            text: `✅ **Google Ads 광고 상태 변경 완료**\n\n광고 ID: ${adId}\n새 상태: ${status === 'ENABLED' ? '✅ 활성' : '⏸️ 일시정지'}`
          }
        ]
      };
      
    } catch (error) {
      // console.error('Google Ads 광고 상태 변경 실패:', error.message);
      return {
        content: [
          {
            type: 'text',
            text: `❌ **Google Ads 광고 상태 변경 실패**\n\n**오류**: ${error.message}\n\n**해결 방법:**\n- 광고 ID가 올바른지 확인\n- 광고 수정 권한이 있는지 확인\n- 광고가 이미 해당 상태인지 확인`
          }
        ]
      };
    }
  }

  async bulkToggleAds(adIds, status) {
    try {
      // console.log(`🔄 Google Ads 광고 ${adIds.length}개 일괄 상태 변경: ${status}`);
      
      await this.getAccessToken();
      
      const operations = adIds.map(id => ({
        update: {
          resourceName: `customers/${CUSTOMER_ID}/adGroupAds/${id}`,
          status: status
        },
        updateMask: 'status'
      }));
      
      const requestBody = { operations };
      
      const response = await this.makeGoogleAdsMutateRequest('adGroupAds:mutate', requestBody);
      
      return {
        content: [
          {
            type: 'text',
            text: `✅ **Google Ads 광고 일괄 상태 변경 완료**\n\n변경된 광고 수: ${adIds.length}개\n새 상태: ${status === 'ENABLED' ? '✅ 활성' : '⏸️ 일시정지'}`
          }
        ]
      };
      
    } catch (error) {
      // console.error('Google Ads 광고 일괄 상태 변경 실패:', error.message);
      return {
        content: [
          {
            type: 'text',
            text: `❌ **Google Ads 광고 일괄 상태 변경 실패**\n\n**오류**: ${error.message}\n\n**해결 방법:**\n- 광고 ID들이 올바른지 확인\n- 광고 수정 권한이 있는지 확인\n- 일부 광고가 이미 해당 상태인지 확인`
          }
        ]
      };
    }
  }

  // === 포맷팅 헬퍼 메서드들 ===

  formatAdGroupList(adGroups, statusFilter) {
    let result = `📋 **Google Ads 광고그룹 목록 (${statusFilter})**\n\n`;
    
    if (!adGroups || adGroups.length === 0) {
      result += `ℹ️ 조회된 광고그룹이 없습니다.\n`;
      return result;
    }

    adGroups.forEach((row, index) => {
      const adGroup = row.ad_group;
      const campaign = row.campaign;
      const status = adGroup.status === 'ENABLED' ? '✅ 활성' : '⏸️ 일시정지';
      
      result += `${index + 1}. **${adGroup.name}**\n`;
      result += `   📍 상태: ${status}\n`;
      result += `   📢 캠페인: ${campaign.name}\n`;
      result += `   🎯 타입: ${adGroup.type}\n`;
      result += `   🆔 ID: ${adGroup.id}\n\n`;
    });

    return result;
  }

  formatAdGroupPerformance(adGroups, days) {
    const periodText = getPeriodText(days);
    
    if (!adGroups || adGroups.length === 0) {
      return `📊 **${periodText} Google Ads 광고그룹 성과**\n\nℹ️ 조회된 광고그룹 데이터가 없습니다.`;
    }

    let result = `📊 **${periodText} Google Ads 광고그룹 성과**\n\n`;
    
    adGroups.slice(0, 20).forEach((row, index) => {
      const adGroup = row.ad_group || row.adGroup;
      const metrics = row.metrics;
      
      const cost = (parseInt(metrics.costMicros || 0) / 1000000).toFixed(2);
      const impressions = parseInt(metrics.impressions || 0);
      const clicks = parseInt(metrics.clicks || 0);
      const conversions = parseFloat(metrics.conversions || 0);
      const costPerConversion = (parseInt(metrics.costPerConversion || 0) / 1000000).toFixed(2);
      const conversionRate = (parseFloat(metrics.conversionsFromInteractionsRate || 0) * 100).toFixed(2);
      const ctr = parseFloat(metrics.ctr || 0).toFixed(2);
      const cpc = (parseInt(metrics.averageCpc || 0) / 1000000).toFixed(2);

      const status = adGroup?.status === 'ENABLED' ? '✅ 활성' : '⏸️ 일시정지';
      
      result += `${index + 1}. **${adGroup?.name || 'N/A'}**\n`;
      result += `   📍 상태: ${status}\n`;
      result += `   📢 캠페인: ${row.campaign?.name || 'N/A'}\n`;
      result += `   💰 비용: ₩${Math.round(cost)}\n`;
      result += `   👁️ 노출: ${formatNumber(impressions)}\n`;
      result += `   🖱️ 클릭: ${formatNumber(clicks)}\n`;
      result += `   📈 CTR: ${ctr}%\n`;
      result += `   💵 CPC: ₩${Math.round(cpc)}\n`;
      result += `   🎯 전환: ${formatNumber(conversions)}\n`;
      result += `   💰 전환당비용: ₩${Math.round(costPerConversion)}\n`;
      result += `   🔄 전환율: ${conversionRate}%\n`;
      result += `\n`;
    });

    return result;
  }

  formatAdList(ads, statusFilter) {
    let result = `📋 **Google Ads 광고 목록 (${statusFilter})**\n\n`;
    
    if (!ads || ads.length === 0) {
      result += `ℹ️ 조회된 광고가 없습니다.\n`;
      return result;
    }

    ads.forEach((row, index) => {
      const ad = row.ad_group_ad.ad;
      const adGroup = row.ad_group;
      const campaign = row.campaign;
      const status = row.ad_group_ad.status === 'ENABLED' ? '✅ 활성' : '⏸️ 일시정지';
      
      result += `${index + 1}. **${ad.name || 'Untitled Ad'}**\n`;
      result += `   📍 상태: ${status}\n`;
      result += `   📢 캠페인: ${campaign.name}\n`;
      result += `   📱 광고그룹: ${adGroup.name}\n`;
      result += `   🎯 타입: ${ad.type}\n`;
      result += `   🆔 ID: ${ad.id}\n\n`;
    });

    return result;
  }

  formatAdPerformance(ads, days) {
    const periodText = getPeriodText(days);
    
    if (!ads || ads.length === 0) {
      return `📊 **${periodText} Google Ads 광고 성과**\n\nℹ️ 조회된 광고 데이터가 없습니다.`;
    }

    let result = `📊 **${periodText} Google Ads 광고 성과**\n\n`;
    
    ads.slice(0, 15).forEach((row, index) => {
      const ad = row.ad_group_ad?.ad || row.adGroupAd?.ad;
      const adGroup = row.ad_group || row.adGroup;
      const adStatus = row.ad_group_ad?.status || row.adGroupAd?.status;
      const metrics = row.metrics;
      
      const cost = (parseInt(metrics.costMicros || 0) / 1000000).toFixed(2);
      const impressions = parseInt(metrics.impressions || 0);
      const clicks = parseInt(metrics.clicks || 0);
      const conversions = parseFloat(metrics.conversions || 0);
      const costPerConversion = (parseInt(metrics.costPerConversion || 0) / 1000000).toFixed(2);
      const conversionRate = (parseFloat(metrics.conversionsFromInteractionsRate || 0) * 100).toFixed(2);
      const ctr = parseFloat(metrics.ctr || 0).toFixed(2);
      const cpc = (parseInt(metrics.averageCpc || 0) / 1000000).toFixed(2);

      const displayStatus = adStatus === 'ENABLED' ? '✅ 활성' : '⏸️ 일시정지';
      
      result += `${index + 1}. **${ad?.name || ad?.id || 'Untitled Ad'}**\n`;
      result += `   📍 상태: ${displayStatus}\n`;
      result += `   🎯 타입: ${ad?.type || 'N/A'}\n`;
      result += `   📢 캠페인: ${row.campaign?.name || 'N/A'}\n`;
      result += `   📱 광고그룹: ${adGroup?.name || 'N/A'}\n`;
      result += `   💰 비용: ₩${Math.round(cost)}\n`;
      result += `   👁️ 노출: ${formatNumber(impressions)}\n`;
      result += `   🖱️ 클릭: ${formatNumber(clicks)}\n`;
      result += `   📈 CTR: ${ctr}%\n`;
      result += `   💵 CPC: ₩${Math.round(cpc)}\n`;
      result += `   🎯 전환: ${formatNumber(conversions)}\n`;
      result += `   💰 전환당비용: ₩${Math.round(costPerConversion)}\n`;
      result += `   🔄 전환율: ${conversionRate}%\n`;
      result += `\n`;
    });

    return result;
  }

  /**
   * Google Ads Mutate API 요청
   */
  async makeGoogleAdsMutateRequest(endpoint, requestBody) {
    const customerId = CUSTOMER_ID.replace(/-/g, '');
    const url = `https://googleads.googleapis.com/${GOOGLE_ADS_API_VERSION}/customers/${customerId}/${endpoint}`;
    
    const config = {
      method: 'POST',
      url,
      headers: {
        'Authorization': `Bearer ${this.accessToken}`,
        'developer-token': DEVELOPER_TOKEN,
        'Content-Type': 'application/json'
      },
      data: requestBody
    };
    
    try {
      const response = await axios(config);
      return response.data;
    } catch (error) {
      // console.error('Google Ads Mutate API 요청 실패:', {
      //   status: error.response?.status,
      //   statusText: error.response?.statusText,
      //   data: error.response?.data
      // });
      
      let errorMessage = error.message;
      if (error.response?.data?.error) {
        const errorData = error.response.data.error;
        if (errorData.message) {
          errorMessage = errorData.message;
        }
      }
      
      throw new Error(errorMessage);
    }
  }
}