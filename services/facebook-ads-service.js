import axios from 'axios';
import { getDateRange, getPeriodText } from '../utils/date-utils.js';
import { formatNumber, formatCurrency, formatPercent, parseActions, standardizeMetrics, formatPerformanceSummary } from '../utils/format-utils.js';

const ACCESS_TOKEN = process.env.META_ACCESS_TOKEN;
const AD_ACCOUNT_ID = process.env.META_AD_ACCOUNT_ID;
const BASE_URL = 'https://graph.facebook.com/v22.0';

export class FacebookAdsService {
  constructor() {
    this.platform = 'facebook';
  }

  /**
   * MCP 도구 목록 반환
   */
  getTools() {
    return [
      {
        name: 'facebook_get_campaign_performance',
        description: '지정된 기간의 캠페인 성과를 조회합니다',
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
              description: '특정 캠페인 ID들 (선택사항, 비어있으면 모든 캠페인)'
            }
          }
        }
      },
      {
        name: 'facebook_toggle_campaign_status',
        description: '캠페인의 상태를 켜거나 끕니다',
        inputSchema: {
          type: 'object',
          properties: {
            campaign_id: {
              type: 'string',
              description: '제어할 캠페인 ID'
            },
            status: {
              type: 'string',
              enum: ['ACTIVE', 'PAUSED'],
              description: '설정할 상태'
            }
          },
          required: ['campaign_id', 'status']
        }
      },
      {
        name: 'facebook_get_campaign_list',
        description: '현재 계정의 모든 캠페인 목록을 조회합니다',
        inputSchema: {
          type: 'object',
          properties: {
            status_filter: {
              type: 'string',
              enum: ['ACTIVE', 'PAUSED', 'ALL'],
              default: 'ALL',
              description: '상태별 필터 (ACTIVE, PAUSED, ALL)'
            }
          }
        }
      },
      {
        name: 'facebook_bulk_toggle_campaigns',
        description: '여러 캠페인의 상태를 일괄 변경합니다',
        inputSchema: {
          type: 'object',
          properties: {
            campaign_ids: {
              type: 'array',
              items: { type: 'string' },
              description: '제어할 캠페인 ID 배열'
            },
            status: {
              type: 'string',
              enum: ['ACTIVE', 'PAUSED'],
              description: '설정할 상태'
            }
          },
          required: ['campaign_ids', 'status']
        }
      },
      {
        name: 'facebook_get_adset_list',
        description: '광고세트 목록을 조회합니다',
        inputSchema: {
          type: 'object',
          properties: {
            campaign_id: {
              type: 'string',
              description: '특정 캠페인의 광고세트만 조회 (선택사항)'
            },
            status_filter: {
              type: 'string',
              enum: ['ACTIVE', 'PAUSED', 'ALL'],
              default: 'ALL',
              description: '상태별 필터'
            }
          }
        }
      },
      {
        name: 'facebook_get_adset_performance',
        description: '지정된 기간의 광고세트 성과를 조회합니다',
        inputSchema: {
          type: 'object',
          properties: {
            days: {
              type: 'number',
              description: '조회할 일수 (1=어제, 7=최근 일주일, 30=최근 한달)',
              default: 7
            },
            adset_ids: {
              type: 'array',
              items: { type: 'string' },
              description: '특정 광고세트 ID들 (선택사항)'
            },
            campaign_id: {
              type: 'string',
              description: '특정 캠페인의 광고세트만 조회 (선택사항)'
            }
          }
        }
      },
      {
        name: 'facebook_toggle_adset_status',
        description: '광고세트의 상태를 변경합니다',
        inputSchema: {
          type: 'object',
          properties: {
            adset_id: {
              type: 'string',
              description: '제어할 광고세트 ID'
            },
            status: {
              type: 'string',
              enum: ['ACTIVE', 'PAUSED'],
              description: '설정할 상태'
            }
          },
          required: ['adset_id', 'status']
        }
      },
      {
        name: 'facebook_get_ad_list',
        description: '광고 목록을 조회합니다',
        inputSchema: {
          type: 'object',
          properties: {
            campaign_id: {
              type: 'string',
              description: '특정 캠페인의 광고만 조회 (선택사항)'
            },
            adset_id: {
              type: 'string',
              description: '특정 광고세트의 광고만 조회 (선택사항)'
            },
            status_filter: {
              type: 'string',
              enum: ['ACTIVE', 'PAUSED', 'ALL'],
              default: 'ALL',
              description: '상태별 필터'
            }
          }
        }
      },
      {
        name: 'facebook_get_ad_performance',
        description: '지정된 기간의 광고 성과를 조회합니다',
        inputSchema: {
          type: 'object',
          properties: {
            days: {
              type: 'number',
              description: '조회할 일수 (1=어제, 7=최근 일주일, 30=최근 한달)',
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
            adset_id: {
              type: 'string',
              description: '특정 광고세트의 광고만 조회 (선택사항)'
            },
            include_images: {
              type: 'boolean',
              description: '광고 이미지도 함께 가져올지 여부',
              default: false
            }
          }
        }
      },
      {
        name: 'facebook_toggle_ad_status',
        description: '광고의 상태를 변경합니다',
        inputSchema: {
          type: 'object',
          properties: {
            ad_id: {
              type: 'string',
              description: '제어할 광고 ID'
            },
            status: {
              type: 'string',
              enum: ['ACTIVE', 'PAUSED'],
              description: '설정할 상태'
            }
          },
          required: ['ad_id', 'status']
        }
      },
      {
        name: 'facebook_bulk_toggle_adsets',
        description: '여러 광고세트의 상태를 일괄 변경합니다',
        inputSchema: {
          type: 'object',
          properties: {
            adset_ids: {
              type: 'array',
              items: { type: 'string' },
              description: '제어할 광고세트 ID 배열'
            },
            status: {
              type: 'string',
              enum: ['ACTIVE', 'PAUSED'],
              description: '설정할 상태'
            }
          },
          required: ['adset_ids', 'status']
        }
      },
      {
        name: 'facebook_bulk_toggle_ads',
        description: '여러 광고의 상태를 일괄 변경합니다',
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
              enum: ['ACTIVE', 'PAUSED'],
              description: '설정할 상태'
            }
          },
          required: ['ad_ids', 'status']
        }
      },
      {
        name: 'facebook_get_ad_images',
        description: '특정 광고들의 크리에이티브 이미지를 가져옵니다',
        inputSchema: {
          type: 'object',
          properties: {
            ad_ids: {
              type: 'array',
              items: { type: 'string' },
              description: '이미지를 가져올 광고 ID들'
            }
          },
          required: ['ad_ids']
        }
      },
      {
        name: 'facebook_get_ad_creative_details',
        description: '광고의 크리에이티브 상세 정보를 가져옵니다 (이미지, 텍스트, 링크 등)',
        inputSchema: {
          type: 'object',
          properties: {
            ad_id: {
              type: 'string',
              description: '조회할 광고 ID'
            }
          },
          required: ['ad_id']
        }
      }
    ];
  }

  /**
   * 도구 호출 처리
   */
  async handleToolCall(toolName, args) {
    switch (toolName) {
      case 'facebook_get_campaign_performance':
        return await this.getCampaignPerformance(args.days || 7, args.campaign_ids);
      case 'facebook_toggle_campaign_status':
        return await this.toggleCampaignStatus(args.campaign_id, args.status);
      case 'facebook_get_campaign_list':
        return await this.getCampaignList(args.status_filter || 'ALL');
      case 'facebook_bulk_toggle_campaigns':
        return await this.bulkToggleCampaigns(args.campaign_ids, args.status);
      case 'facebook_get_adset_list':
        return await this.getAdsetList(args.campaign_id, args.status_filter || 'ALL');
      case 'facebook_get_adset_performance':
        return await this.getAdsetPerformance(args.days || 7, args.adset_ids, args.campaign_id);
      case 'facebook_toggle_adset_status':
        return await this.toggleAdsetStatus(args.adset_id, args.status);
      case 'facebook_bulk_toggle_adsets':
        return await this.bulkToggleAdsets(args.adset_ids, args.status);
      case 'facebook_get_ad_list':
        return await this.getAdList(args.campaign_id, args.adset_id, args.status_filter || 'ALL');
      case 'facebook_get_ad_performance':
        return await this.getAdPerformance(
          args.days || 7, 
          args.ad_ids, 
          args.campaign_id, 
          args.adset_id,
          args.include_images || false
        );
      case 'facebook_toggle_ad_status':
        return await this.toggleAdStatus(args.ad_id, args.status);
      case 'facebook_bulk_toggle_ads':
        return await this.bulkToggleAds(args.ad_ids, args.status);
      case 'facebook_get_ad_images':
        return await this.getAdImages(args.ad_ids);
      case 'facebook_get_ad_creative_details':
        return await this.getAdCreativeDetails(args.ad_id);
      default:
        throw new Error(`Unknown Facebook tool: ${toolName}`);
    }
  }

  // === 캠페인 관련 메서드들 ===

  async getCampaignPerformance(days, campaignIds) {
    const { since, until } = getDateRange(days);
    
    let url = `${BASE_URL}/${AD_ACCOUNT_ID}/insights`;
    const params = {
      access_token: ACCESS_TOKEN,
      level: 'campaign',
      time_range: JSON.stringify({ since, until }),
      fields: 'campaign_id,campaign_name,impressions,clicks,spend,ctr,cpc,cpp,cpm,conversions,conversion_rate_ranking,actions'
    };

    if (campaignIds && campaignIds.length > 0) {
      params.filtering = JSON.stringify([{
        field: 'campaign.id',
        operator: 'IN',
        value: campaignIds
      }]);
    }

    const response = await axios.get(url, { params });
    
    return {
      content: [
        {
          type: 'text',
          text: this.formatCampaignPerformance(response.data.data, days)
        }
      ]
    };
  }

  formatCampaignPerformance(data, days) {
    const periodText = getPeriodText(days);
    
    const totalSpend = data.reduce((sum, item) => sum + parseFloat(item.spend || 0), 0);
    const totalImpressions = data.reduce((sum, item) => sum + parseInt(item.impressions || 0), 0);
    const totalClicks = data.reduce((sum, item) => sum + parseInt(item.clicks || 0), 0);
    const totalConversions = data.reduce((sum, item) => sum + parseInt(item.conversions || 0), 0);
    
    // actions 데이터 집계
    const totalActions = {
      lead: 0,
      link_click: 0,
      landing_page_view: 0,
      purchase: 0,
      add_to_cart: 0,
      complete_registration: 0,
      total_actions: 0
    };
    
    data.forEach(item => {
      const actions = parseActions(item.actions);
      totalActions.lead += actions.lead;
      totalActions.link_click += actions.link_click;
      totalActions.landing_page_view += actions.landing_page_view;
      totalActions.purchase += actions.purchase;
      totalActions.add_to_cart += actions.add_to_cart;
      totalActions.complete_registration += actions.complete_registration;
      totalActions.total_actions += actions.total_actions;
    });
    
    const overallCTR = totalImpressions > 0 ? (totalClicks / totalImpressions * 100).toFixed(2) : 0;
    const overallCPC = totalClicks > 0 ? (totalSpend / totalClicks).toFixed(2) : 0;
    const overallCPM = totalImpressions > 0 ? (totalSpend / totalImpressions * 1000).toFixed(2) : 0;
    const overallConversionRate = totalClicks > 0 ? (totalConversions / totalClicks * 100).toFixed(2) : 'NaN';

    let result = `📊 **${periodText} Facebook 광고 성과 분석**\n\n`;
    result += `🎯 **전체 성과 요약**\n`;
    result += `💰 총 지출: ${formatCurrency(totalSpend)}\n`;
    result += `👁️ 노출수: ${formatNumber(totalImpressions)}\n`;
    result += `🖱️ 클릭수: ${formatNumber(totalClicks)}\n`;
    result += `🎯 전환수: ${totalConversions || 'NaN'}\n`;
    result += `📈 CTR: ${overallCTR}%\n`;
    result += `💵 CPC: ${formatCurrency(overallCPC)}\n`;
    result += `📊 CPM: ${formatCurrency(overallCPM)}\n`;
    result += `🔄 전환율: ${overallConversionRate}%\n`;
    result += `📊 **Actions 상세:**\n`;
    result += `   🎯 리드: ${totalActions.lead}\n`;
    result += `   🔗 링크클릭: ${totalActions.link_click}\n`;
    result += `   📄 랜딩페이지뷰: ${totalActions.landing_page_view}\n`;
    result += `   🛒 구매: ${totalActions.purchase}\n`;
    result += `   🛍️ 장바구니: ${totalActions.add_to_cart}\n`;
    result += `   📝 가입완료: ${totalActions.complete_registration}\n`;
    result += `   📊 총 액션: ${totalActions.total_actions}\n\n`;

    result += `📋 **캠페인별 상세 성과**\n\n`;
    data.forEach((campaign, index) => {
      const spend = parseFloat(campaign.spend || 0);
      const impressions = parseInt(campaign.impressions || 0);
      const clicks = parseInt(campaign.clicks || 0);
      const ctr = campaign.ctr ? parseFloat(campaign.ctr).toFixed(2) : '0.00';
      const cpc = campaign.cpc ? parseFloat(campaign.cpc).toFixed(2) : '0.00';
      const actions = parseActions(campaign.actions);

      result += `${index + 1}. **${campaign.campaign_name}**\n`;
      result += `   💰 지출: ${formatCurrency(spend)}\n`;
      result += `   👁️ 노출: ${formatNumber(impressions)}\n`;
      result += `   🖱️ 클릭: ${formatNumber(clicks)}\n`;
      result += `   📈 CTR: ${ctr}%\n`;
      result += `   💵 CPC: ${formatCurrency(cpc)}\n`;
      if (actions.total_actions > 0) {
        result += `   🎯 액션 상세:\n`;
        result += `      리드: ${actions.lead}\n`;
        result += `      링크클릭: ${actions.link_click}\n`;
        result += `      랜딩페이지뷰: ${actions.landing_page_view}\n`;
        result += `      구매: ${actions.purchase}\n`;
        result += `      장바구니: ${actions.add_to_cart}\n`;
        result += `      가입완료: ${actions.complete_registration}\n`;
        result += `      총 액션: ${actions.total_actions}\n`;
      }
      result += `\n`;
    });

    return result;
  }

  async toggleCampaignStatus(campaignId, status) {
    const url = `${BASE_URL}/${campaignId}`;
    const data = {
      access_token: ACCESS_TOKEN,
      status: status
    };

    await axios.post(url, data);
    
    return {
      content: [
        {
          type: 'text',
          text: `✅ Facebook 캠페인 ${campaignId}의 상태가 ${status}로 변경되었습니다.`
        }
      ]
    };
  }

  async getCampaignList(statusFilter) {
    const url = `${BASE_URL}/${AD_ACCOUNT_ID}/campaigns`;
    const params = {
      access_token: ACCESS_TOKEN,
      limit: 100,
      fields: 'id,name,status,objective,created_time,updated_time'
    };

    if (statusFilter !== 'ALL') {
      params.filtering = JSON.stringify([{
        field: 'campaign.status',
        operator: 'IN',
        value: [statusFilter]
      }]);
    }

    const response = await axios.get(url, { params });
    
    let result = `📋 **Facebook 캠페인 목록 (${statusFilter})**\n\n`;
    response.data.data.forEach((campaign, index) => {
      const status = campaign.status === 'ACTIVE' ? '✅ 활성' : '⏸️ 일시정지';
      result += `${index + 1}. **${campaign.name}**\n`;
      result += `   📍 상태: ${status}\n`;
      result += `   🎯 목표: ${campaign.objective}\n`;
      result += `   🆔 ID: ${campaign.id}\n\n`;
    });

    return {
      content: [
        {
          type: 'text',
          text: result
        }
      ]
    };
  }

  async bulkToggleCampaigns(campaignIds, status) {
    const promises = campaignIds.map(id => this.toggleCampaignStatus(id, status));
    await Promise.all(promises);
    
    return {
      content: [
        {
          type: 'text',
          text: `✅ ${campaignIds.length}개 Facebook 캠페인의 상태가 ${status}로 변경되었습니다.`
        }
      ]
    };
  }

  // === 광고세트 관련 메서드들 ===

  async getAdsetList(campaignId, statusFilter) {
    let url = `${BASE_URL}/${AD_ACCOUNT_ID}/adsets`;
    const params = {
      access_token: ACCESS_TOKEN,
      fields: 'id,name,status,campaign_id,campaign{name},optimization_goal,billing_event,created_time'
    };

    const filters = [];
    if (statusFilter !== 'ALL') {
      filters.push({
        field: 'adset.status',
        operator: 'IN',
        value: [statusFilter]
      });
    }
    if (campaignId) {
      filters.push({
        field: 'adset.campaign_id',
        operator: 'IN',
        value: [campaignId]
      });
    }
    if (filters.length > 0) {
      params.filtering = JSON.stringify(filters);
    }

    const response = await axios.get(url, { params });
    
    let result = `📋 **Facebook 광고세트 목록**\n\n`;
    response.data.data.forEach((adset, index) => {
      const status = adset.status === 'ACTIVE' ? '✅ 활성' : '⏸️ 일시정지';
      result += `${index + 1}. **${adset.name}**\n`;
      result += `   📍 상태: ${status}\n`;
      result += `   📢 캠페인: ${adset.campaign?.name || 'N/A'}\n`;
      result += `   🎯 최적화 목표: ${adset.optimization_goal}\n`;
      result += `   🆔 ID: ${adset.id}\n\n`;
    });

    return {
      content: [
        {
          type: 'text',
          text: result
        }
      ]
    };
  }

  async getAdsetPerformance(days, adsetIds, campaignId) {
    const { since, until } = getDateRange(days);
    
    const url = `${BASE_URL}/${AD_ACCOUNT_ID}/insights`;
    const params = {
      access_token: ACCESS_TOKEN,
      level: 'adset',
      time_range: JSON.stringify({ since, until }),
      fields: 'adset_id,adset_name,campaign_name,impressions,clicks,spend,ctr,cpc,cpp,cpm,conversions,actions'
    };

    const filters = [];
    if (adsetIds && adsetIds.length > 0) {
      filters.push({
        field: 'adset.id',
        operator: 'IN',
        value: adsetIds
      });
    }
    if (campaignId) {
      filters.push({
        field: 'campaign.id',
        operator: 'IN',
        value: [campaignId]
      });
    }
    if (filters.length > 0) {
      params.filtering = JSON.stringify(filters);
    }

    const response = await axios.get(url, { params });
    
    return {
      content: [
        {
          type: 'text',
          text: this.formatAdsetPerformance(response.data.data, days)
        }
      ]
    };
  }

  formatAdsetPerformance(data, days) {
    const periodText = getPeriodText(days);
    
    const totalSpend = data.reduce((sum, item) => sum + parseFloat(item.spend || 0), 0);
    const totalImpressions = data.reduce((sum, item) => sum + parseInt(item.impressions || 0), 0);
    const totalClicks = data.reduce((sum, item) => sum + parseInt(item.clicks || 0), 0);
    
    // actions 데이터 집계
    const totalActions = {
      lead: 0,
      link_click: 0,
      landing_page_view: 0,
      purchase: 0,
      add_to_cart: 0,
      complete_registration: 0,
      total_actions: 0
    };
    
    data.forEach(item => {
      const actions = parseActions(item.actions);
      totalActions.lead += actions.lead;
      totalActions.link_click += actions.link_click;
      totalActions.landing_page_view += actions.landing_page_view;
      totalActions.purchase += actions.purchase;
      totalActions.add_to_cart += actions.add_to_cart;
      totalActions.complete_registration += actions.complete_registration;
      totalActions.total_actions += actions.total_actions;
    });
    
    const overallCTR = totalImpressions > 0 ? (totalClicks / totalImpressions * 100).toFixed(2) : 0;
    const overallCPC = totalClicks > 0 ? (totalSpend / totalClicks).toFixed(2) : 0;

    let result = `📊 **${periodText} Facebook 광고세트 성과 분석**\n\n`;
    result += `🎯 **전체 성과 요약**\n`;
    result += `💰 총 지출: ${formatCurrency(totalSpend)}\n`;
    result += `👁️ 노출수: ${formatNumber(totalImpressions)}\n`;
    result += `🖱️ 클릭수: ${formatNumber(totalClicks)}\n`;
    result += `📈 CTR: ${overallCTR}%\n`;
    result += `💵 CPC: ${formatCurrency(overallCPC)}\n`;
    result += `📊 **Actions 상세:**\n`;
    result += `   🎯 리드: ${totalActions.lead}\n`;
    result += `   🔗 링크클릭: ${totalActions.link_click}\n`;
    result += `   📄 랜딩페이지뷰: ${totalActions.landing_page_view}\n`;
    result += `   🛒 구매: ${totalActions.purchase}\n`;
    result += `   🛍️ 장바구니: ${totalActions.add_to_cart}\n`;
    result += `   📝 가입완료: ${totalActions.complete_registration}\n`;
    result += `   📊 총 액션: ${totalActions.total_actions}\n\n`;

    result += `📋 **광고세트별 상세 성과**\n\n`;
    data.forEach((adset, index) => {
      const spend = parseFloat(adset.spend || 0);
      const impressions = parseInt(adset.impressions || 0);
      const clicks = parseInt(adset.clicks || 0);
      const ctr = adset.ctr ? parseFloat(adset.ctr).toFixed(2) : '0.00';
      const cpc = adset.cpc ? parseFloat(adset.cpc).toFixed(2) : '0.00';
      const actions = parseActions(adset.actions);

      result += `${index + 1}. **${adset.adset_name}**\n`;
      result += `   📢 캠페인: ${adset.campaign_name}\n`;
      result += `   💰 지출: ${formatCurrency(spend)}\n`;
      result += `   👁️ 노출: ${formatNumber(impressions)}\n`;
      result += `   🖱️ 클릭: ${formatNumber(clicks)}\n`;
      result += `   📈 CTR: ${ctr}%\n`;
      result += `   💵 CPC: ${formatCurrency(cpc)}\n`;
      if (actions.total_actions > 0) {
        result += `   🎯 액션 상세:\n`;
        result += `      리드: ${actions.lead}\n`;
        result += `      링크클릭: ${actions.link_click}\n`;
        result += `      랜딩페이지뷰: ${actions.landing_page_view}\n`;
        result += `      구매: ${actions.purchase}\n`;
        result += `      장바구니: ${actions.add_to_cart}\n`;
        result += `      가입완료: ${actions.complete_registration}\n`;
        result += `      총 액션: ${actions.total_actions}\n`;
      }
      result += `\n`;
    });

    return result;
  }

  async toggleAdsetStatus(adsetId, status) {
    const url = `${BASE_URL}/${adsetId}`;
    const data = {
      access_token: ACCESS_TOKEN,
      status: status
    };

    await axios.post(url, data);
    
    return {
      content: [
        {
          type: 'text',
          text: `✅ Facebook 광고세트 ${adsetId}의 상태가 ${status}로 변경되었습니다.`
        }
      ]
    };
  }

  async bulkToggleAdsets(adsetIds, status) {
    const promises = adsetIds.map(id => this.toggleAdsetStatus(id, status));
    await Promise.all(promises);
    
    return {
      content: [
        {
          type: 'text',
          text: `✅ ${adsetIds.length}개 Facebook 광고세트의 상태가 ${status}로 변경되었습니다.`
        }
      ]
    };
  }

  // === 광고 관련 메서드들 ===

  async getAdList(campaignId, adsetId, statusFilter) {
    const url = `${BASE_URL}/${AD_ACCOUNT_ID}/ads`;
    const baseParams = {
      access_token: ACCESS_TOKEN,
      limit: 100,
      fields: 'id,name,status,campaign_id,adset_id,campaign{name},adset{name},creative{title,body},created_time'
    };

    const filters = [];
    if (statusFilter !== 'ALL') {
      filters.push({
        field: 'ad.status',
        operator: 'IN',
        value: [statusFilter]
      });
    }
    if (campaignId) {
      filters.push({
        field: 'ad.campaign_id',
        operator: 'IN',
        value: [campaignId]
      });
    }
    if (adsetId) {
      filters.push({
        field: 'ad.adset_id',
        operator: 'IN',
        value: [adsetId]
      });
    }
    if (filters.length > 0) {
      baseParams.filtering = JSON.stringify(filters);
    }

    // 페이징으로 모든 데이터 가져오기
    let allData = [];
    let after = null;
    
    do {
      const params = { ...baseParams };
      if (after) params.after = after;
      
      const response = await axios.get(url, { params });
      allData = allData.concat(response.data.data);
      
      after = response.data.paging?.cursors?.after;
    } while (after);

    let result = `📋 **Facebook 광고 목록 (${statusFilter})**\n\n`;
    allData.forEach((ad, index) => {
      const status = ad.status === 'ACTIVE' ? '✅ 활성' : '⏸️ 일시정지';
      result += `${index + 1}. **${ad.name}**\n`;
      result += `   📍 상태: ${status}\n`;
      result += `   📢 캠페인: ${ad.campaign?.name || 'N/A'}\n`;
      result += `   📱 광고세트: ${ad.adset?.name || 'N/A'}\n`;
      if (ad.creative?.title) {
        result += `   📝 제목: ${ad.creative.title}\n`;
      }
      result += `   🆔 ID: ${ad.id}\n\n`;
    });

    return {
      content: [
        {
          type: 'text',
          text: result
        }
      ]
    };
  }

  async getAdPerformance(days, adIds, campaignId, adsetId, includeImages = false) {
    const { since, until } = getDateRange(days);
    
    const url = `${BASE_URL}/${AD_ACCOUNT_ID}/insights`;
    const baseParams = {
      access_token: ACCESS_TOKEN,
      level: 'ad',
      limit: 100,
      time_range: JSON.stringify({ since, until }),
      fields: 'ad_id,ad_name,campaign_name,adset_name,impressions,clicks,spend,ctr,cpc,cpp,cpm,conversions,actions'
    };

    const filters = [];
    if (adIds && adIds.length > 0) {
      filters.push({
        field: 'ad.id',
        operator: 'IN',
        value: adIds
      });
    }
    if (campaignId) {
      filters.push({
        field: 'campaign.id',
        operator: 'IN',
        value: [campaignId]
      });
    }
    if (adsetId) {
      filters.push({
        field: 'adset.id',
        operator: 'IN',
        value: [adsetId]
      });
    }
    if (filters.length > 0) {
      baseParams.filtering = JSON.stringify(filters);
    }

    // 페이징으로 모든 데이터 가져오기
    let allData = [];
    let after = null;
    
    do {
      const params = { ...baseParams };
      if (after) params.after = after;
      
      const response = await axios.get(url, { params });
      allData = allData.concat(response.data.data);
      
      after = response.data.paging?.cursors?.after;
    } while (after);

    // 이미지도 함께 가져오기
    let imageData = {};
    if (includeImages && allData.length > 0) {
      const adIdsForImages = allData.map(ad => ad.ad_id);
      try {
        const imageResults = {};
        for (const adId of adIdsForImages) {
          const url = `${BASE_URL}/${adId}`;
          const params = {
            access_token: ACCESS_TOKEN,
            fields: 'creative{image_url,object_story_spec}'
          };
          
          const response = await axios.get(url, { params });
          const data = response.data;
          
          const images = [];
          if (data.creative) {
            if (data.creative.image_url) {
              images.push({
                type: 'main_image',
                url: data.creative.image_url
              });
            }
            
            if (data.creative.object_story_spec && data.creative.object_story_spec.link_data && data.creative.object_story_spec.link_data.image_hash) {
              const imageUrl = await this.getImageUrlFromHash(data.creative.object_story_spec.link_data.image_hash);
              if (imageUrl) {
                images.push({
                  type: 'link_image',
                  url: imageUrl
                });
              }
            }
          }
          
          imageResults[adId] = images;
        }
        imageData = imageResults;
      } catch (error) {
        console.error('이미지 가져오기 실패:', error.message);
      }
    }
    
    return {
      content: [
        {
          type: 'text',
          text: this.formatAdPerformance(allData, days, imageData, includeImages)
        }
      ]
    };
  }

  formatAdPerformance(data, days, imageData = {}, includeImages = false) {
    const periodText = getPeriodText(days);
    
    const totalSpend = data.reduce((sum, item) => sum + parseFloat(item.spend || 0), 0);
    const totalImpressions = data.reduce((sum, item) => sum + parseInt(item.impressions || 0), 0);
    const totalClicks = data.reduce((sum, item) => sum + parseInt(item.clicks || 0), 0);
    const totalConversions = data.reduce((sum, item) => sum + parseInt(item.conversions || 0), 0);
    
    // actions 데이터 집계
    const totalActions = {
      lead: 0,
      link_click: 0,
      landing_page_view: 0,
      purchase: 0,
      add_to_cart: 0,
      complete_registration: 0,
      total_actions: 0
    };
    
    data.forEach(item => {
      const actions = parseActions(item.actions);
      totalActions.lead += actions.lead;
      totalActions.link_click += actions.link_click;
      totalActions.landing_page_view += actions.landing_page_view;
      totalActions.purchase += actions.purchase;
      totalActions.add_to_cart += actions.add_to_cart;
      totalActions.complete_registration += actions.complete_registration;
      totalActions.total_actions += actions.total_actions;
    });
    
    const overallCTR = totalImpressions > 0 ? (totalClicks / totalImpressions * 100).toFixed(2) : 0;
    const overallCPC = totalClicks > 0 ? (totalSpend / totalClicks).toFixed(2) : 0;
    const overallCPM = totalImpressions > 0 ? (totalSpend / totalImpressions * 1000).toFixed(2) : 0;

    let result = `📊 **${periodText} Facebook 광고 성과 분석**\n\n`;
    result += `🎯 **전체 성과 요약**\n`;
    result += `💰 총 지출: ${formatCurrency(totalSpend)}\n`;
    result += `👁️ 노출수: ${formatNumber(totalImpressions)}\n`;
    result += `🖱️ 클릭수: ${formatNumber(totalClicks)}\n`;
    result += `🎯 전환수: ${totalConversions || 'NaN'}\n`;
    result += `📈 CTR: ${overallCTR}%\n`;
    result += `💵 CPC: ${formatCurrency(overallCPC)}\n`;
    result += `📊 CPM: ${formatCurrency(overallCPM)}\n`;
    result += `🔄 전환율: NaN%\n`;
    result += `📊 **Actions 상세:**\n`;
    result += `   🎯 리드: ${totalActions.lead}\n`;
    result += `   🔗 링크클릭: ${totalActions.link_click}\n`;
    result += `   📄 랜딩페이지뷰: ${totalActions.landing_page_view}\n`;
    result += `   🛒 구매: ${totalActions.purchase}\n`;
    result += `   🛍️ 장바구니: ${totalActions.add_to_cart}\n`;
    result += `   📝 가입완료: ${totalActions.complete_registration}\n`;
    result += `   📊 총 액션: ${totalActions.total_actions}\n\n`;

    result += `📋 **광고별 상세 성과**\n\n`;
    data.forEach((ad, index) => {
      const spend = parseFloat(ad.spend || 0);
      const impressions = parseInt(ad.impressions || 0);
      const clicks = parseInt(ad.clicks || 0);
      const conversions = parseInt(ad.conversions || 0);
      const ctr = ad.ctr ? parseFloat(ad.ctr).toFixed(2) : '0.00';
      const cpc = ad.cpc ? parseFloat(ad.cpc).toFixed(2) : '0.00';
      const cpm = ad.cpm ? parseFloat(ad.cpm).toFixed(2) : '0.00';
      const actions = parseActions(ad.actions);

      result += `${index + 1}. **${ad.ad_name}** (ID: ${ad.ad_id})\n`;
      result += `   📢 캠페인: ${ad.campaign_name}\n`;
      result += `   📱 광고세트: ${ad.adset_name}\n`;
      result += `   💰 지출: ${formatCurrency(spend)}\n`;
      result += `   👁️ 노출: ${formatNumber(impressions)}\n`;
      result += `   🖱️ 클릭: ${formatNumber(clicks)}\n`;
      result += `   🎯 전환: ${conversions}\n`;
      result += `   📈 CTR: ${ctr}%\n`;
      result += `   💵 CPC: ${formatCurrency(cpc)}\n`;
      result += `   📊 CPM: ${formatCurrency(cpm)}\n`;
      if (actions.total_actions > 0) {
        result += `   🎯 액션 상세:\n`;
        result += `      리드: ${actions.lead}\n`;
        result += `      링크클릭: ${actions.link_click}\n`;
        result += `      랜딩페이지뷰: ${actions.landing_page_view}\n`;
        result += `      구매: ${actions.purchase}\n`;
        result += `      장바구니: ${actions.add_to_cart}\n`;
        result += `      가입완료: ${actions.complete_registration}\n`;
        result += `      총 액션: ${actions.total_actions}\n`;
      }
      
      // 이미지 정보 추가
      if (includeImages && imageData[ad.ad_id] && imageData[ad.ad_id].length > 0) {
        result += `   🖼️ 소재 이미지:\n`;
        imageData[ad.ad_id].forEach((image, imgIndex) => {
          result += `      ${imgIndex + 1}. ${image.type}: ${image.url}\n`;
        });
      }
      
      result += `\n`;
    });

    return result;
  }

  async toggleAdStatus(adId, status) {
    const url = `${BASE_URL}/${adId}`;
    const data = {
      access_token: ACCESS_TOKEN,
      status: status
    };

    await axios.post(url, data);
    
    return {
      content: [
        {
          type: 'text',
          text: `✅ Facebook 광고 ${adId}의 상태가 ${status}로 변경되었습니다.`
        }
      ]
    };
  }

  async bulkToggleAds(adIds, status) {
    const promises = adIds.map(id => this.toggleAdStatus(id, status));
    await Promise.all(promises);
    
    return {
      content: [
        {
          type: 'text',
          text: `✅ ${adIds.length}개 Facebook 광고의 상태가 ${status}로 변경되었습니다.`
        }
      ]
    };
  }

  // === 크리에이티브 관련 메서드들 ===

  async getAdImages(adIds) {
    const results = {};

    for (const adId of adIds) {
      try {
        // 광고 → 크리에이티브 ID 조회
        const adUrl = `${BASE_URL}/${adId}`;
        const adParams = {
          access_token: ACCESS_TOKEN,
          fields: 'creative{id}'
        };

        const adResponse = await axios.get(adUrl, { params: adParams });
        const creative = adResponse.data?.creative;

        const images = [];

        if (!creative || !creative.id) {
          console.warn(`광고 ${adId}의 크리에이티브 ID를 찾을 수 없습니다.`);
          results[adId] = [];
          continue;
        }

        // 크리에이티브 ID → object_story_spec 조회
        const creativeUrl = `https://graph.facebook.com/v22.0/${creative.id}`;
        const creativeParams = {
          access_token: ACCESS_TOKEN,
          fields: 'object_story_spec'
        };

        const creativeDetailResp = await axios.get(creativeUrl, { params: creativeParams });
        const storySpec = creativeDetailResp.data?.object_story_spec;

        if (!storySpec) {
          results[adId] = [];
          continue;
        }

        const imageHashes = this.extractImageHashes(storySpec);

        for (const { hash, source } of imageHashes) {
          const imageUrl = await this.getImageUrlFromHash(hash);
          if (imageUrl) {
            images.push({
              type: source,
              url: imageUrl,
              image_hash: hash,
              source
            });
          }
        }

        results[adId] = images;

      } catch (error) {
        console.error(`광고 ${adId} 이미지 가져오기 실패:`, error.message);
        console.error('Error details:', error.response?.data);
        results[adId] = [];
      }
    }

    return {
      content: [
        {
          type: 'text',
          text: this.formatAdImages(results)
        }
      ]
    };
  }

  async getImageUrlFromHash(imageHash) {
    try {
      const url = `https://graph.facebook.com/v22.0/act_774129430431823/adimages`;
      const params = {
        access_token: ACCESS_TOKEN,
        fields: 'url,name,hash',
        hashes: JSON.stringify([imageHash])
      };
      
      const response = await axios.get(url, { params });
      
      // 응답에서 해당 해시의 URL 찾기
      const adImages = response.data.data;
      if (adImages && adImages.length > 0) {
        const targetImage = adImages.find(img => img.hash === imageHash);
        return targetImage ? targetImage.url : null;
      }
      
      return null;
    } catch (error) {
      console.error('Image hash 조회 실패:', error.response?.data || error);
      return null;
    }
  }

  formatAdImages(results) {
    let output = `🖼️ **Facebook 광고 이미지 조회 결과**\n\n`;
    
    for (const [adId, images] of Object.entries(results)) {
      output += `📱 **광고 ID**: ${adId}\n`;
      output += `🖼️ **이미지 개수**: ${images.length}개\n`;
      
      if (images.length > 0) {
        images.forEach((image, index) => {
          output += `   ${index + 1}. **${image.type}** (${image.source})\n`;
          output += `      📎 URL: ${image.url}\n`;
          if (image.image_hash) {
            output += `      #️⃣ 해시: ${image.image_hash}\n`;
          }
        });
      } else {
        output += `   ❌ 이미지를 찾을 수 없습니다.\n`;
        output += `   💡 디버깅을 위해 광고의 크리에이티브 상세 정보를 확인해보세요.\n`;
      }
      
      output += `\n`;
    }
    
    return output;
  }

  async getAdCreativeDetails(adId) {
    try {
      // 1단계: 광고에서 크리에이티브 ID 조회
      const adUrl = `${BASE_URL}/${adId}`;
      const adParams = {
        access_token: ACCESS_TOKEN,
        fields: 'name,status,creative{id}'
      };
      
      const adResponse = await axios.get(adUrl, { params: adParams });
      const adData = adResponse.data;
      
      let result = `🎨 **Facebook 광고 크리에이티브 상세 정보**\n\n`;
      result += `📢 **광고명**: ${adData.name}\n`;
      result += `📍 **상태**: ${adData.status}\n\n`;
      
      if (!adData.creative || !adData.creative.id) {
        result += `❌ 크리에이티브 정보를 찾을 수 없습니다.\n`;
        return {
          content: [
            {
              type: 'text',
              text: result
            }
          ]
        };
      }
      
      // 2단계: 크리에이티브 상세 정보 조회 (id, object_story_spec만)
      const creativeId = adData.creative.id;
      const creativeUrl = `https://graph.facebook.com/v22.0/${creativeId}`;
      const creativeParams = {
        access_token: ACCESS_TOKEN,
        fields: 'id,object_story_spec'
      };
      
      const creativeResponse = await axios.get(creativeUrl, { params: creativeParams });
      const creative = creativeResponse.data;
      
      result += `🆔 **크리에이티브 ID**: ${creative.id}\n\n`;
      
      // Object Story Spec 정보 표시
      if (creative.object_story_spec) {
        result += `📎 **Object Story Spec**:\n`;
        result += `\`\`\`json\n${JSON.stringify(creative.object_story_spec, null, 2)}\n\`\`\`\n\n`;
        
        // Image Hash 추출 및 표시
        const imageHashes = this.extractImageHashes(creative.object_story_spec);
        if (imageHashes.length > 0) {
          result += `🔍 **발견된 Image Hash들**:\n`;
          imageHashes.forEach((hash, index) => {
            result += `   ${index + 1}. ${hash.source}: \`${hash.hash}\`\n`;
          });
          result += `\n💡 **Ad Images API 호출 예시**:\n`;
          const hashArray = imageHashes.map(h => `"${h.hash}"`).join(',');
          result += `\`act_774129430431823/adimages?fields=url,name,hash&hashes=[${hashArray}]\`\n`;
        } else {
          result += `❌ **Image Hash를 찾을 수 없습니다**\n`;
        }
      } else {
        result += `❌ **Object Story Spec을 찾을 수 없습니다**\n`;
      }
      
      return {
        content: [
          {
            type: 'text',
            text: result
          }
        ]
      };
      
    } catch (error) {
      console.error('크리에이티브 조회 상세 오류:', error.response?.data || error);
      
      let errorDetails = '';
      if (error.response && error.response.data) {
        errorDetails = JSON.stringify(error.response.data, null, 2);
      }
      
      throw new Error(`크리에이티브 조회 실패: ${error.message}\n디버깅 정보: ${errorDetails}`);
    }
  }

  extractImageHashes(storySpec) {
    const hashes = [];

    if (storySpec.link_data?.image_hash) {
      hashes.push({ hash: storySpec.link_data.image_hash, source: 'link_data' });
    }

    if (storySpec.video_data?.image_hash) {
      hashes.push({ hash: storySpec.video_data.image_hash, source: 'video_data' });
    }

    if (storySpec.photo_data?.image_hash) {
      hashes.push({ hash: storySpec.photo_data.image_hash, source: 'photo_data' });
    }

    return hashes;
  }
}