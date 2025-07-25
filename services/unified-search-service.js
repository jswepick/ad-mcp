/**
 * 통합 검색 서비스
 * 정형화된 명령어를 처리하여 다중 매체에서 캠페인 검색 및 성과 조회
 */

import { parseUserCommand, validateCommand, formatCommandSummary } from '../utils/command-parser.js';
import { formatNumber, formatCurrency, formatPercent } from '../utils/format-utils.js';

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
          return await this.executeStructuredSearch(args.command);
        case 'search_help':
          return this.getSearchHelp();
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
  async executeStructuredSearch(commandString) {
    try {
      // 1단계: 명령어 파싱
      const command = parseUserCommand(commandString);
      
      if (!validateCommand(command)) {
        return {
          content: [
            {
              type: 'text',
              text: `❌ **명령어 오류**\n\n${command.errors.join('\n')}\n\n**올바른 형식:**\n키워드:[검색어] 날짜:[시작일-종료일] 매체:[매체1,매체2,...]\n\n**예시:**\n키워드:고병우 날짜:20250720-20250721 매체:구글,페이스북`
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
      return this.formatSearchResults(detailedResults, command);

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
   * 검색 결과 포맷팅
   */
  formatSearchResults(detailedResults, command) {
    const summary = formatCommandSummary(command);
    let result = `${summary}\n\n`;

    const platformNames = {
      facebook: '📱 **Facebook Ads**',
      google: '🔍 **Google Ads**',
      tiktok: '📱 **TikTok Ads**'
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
        result += `${platformName} - ❌ 오류: ${error}\n\n`;
        return;
      }

      if (campaigns.length === 0) {
        result += `${platformName} - 매칭된 캠페인 없음\n\n`;
        return;
      }

      result += `${platformName} (${campaigns.length}개 캠페인, ${ads.length}개 광고)\n\n`;
      
      // 캠페인별로 그룹화된 광고들 표시
      const campaignGroups = this.groupAdsByCampaign(campaigns, ads);
      
      campaignGroups.forEach(({ campaign, campaignAds }) => {
        result += `**캠페인**: ${campaign.campaign_name || campaign.name}\n`;
        
        if (campaignAds.length === 0) {
          result += `└── 광고 데이터 없음\n\n`;
          return;
        }

        campaignAds.forEach((ad, index) => {
          const isLast = index === campaignAds.length - 1;
          const prefix = isLast ? '└──' : '├──';
          
          const spend = parseFloat(ad.spend || 0);
          const impressions = parseInt(ad.impressions || 0);
          const clicks = parseInt(ad.clicks || 0);
          const ctr = impressions > 0 ? (clicks / impressions * 100).toFixed(2) : '0.00';
          
          result += `${prefix} **${ad.ad_name || ad.name}**\n`;
          result += `    💰 ${formatCurrency(spend)} | 👁️ ${formatNumber(impressions)} | 🖱️ ${formatNumber(clicks)} | 📈 CTR ${ctr}%\n`;
          
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
      
      result += `📊 **전체 요약**\n`;
      result += `- 총 ${totalCampaigns}개 캠페인, ${totalAds}개 광고\n`;
      result += `- 총 지출: ${formatCurrency(totalSpend)}\n`;
      result += `- 총 노출: ${formatNumber(totalImpressions)}\n`;
      result += `- 총 클릭: ${formatNumber(totalClicks)}\n`;
      result += `- 전체 CTR: ${overallCTR}%`;
    } else {
      result += `ℹ️ 지정된 조건에 맞는 캠페인을 찾을 수 없습니다.`;
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
    const helpText = `🔍 **정형화된 캠페인 검색 도구 사용법**

**기본 형식:**
\`키워드:[검색어] 날짜:[날짜범위] 매체:[매체목록]\`

**파라미터 설명:**

📝 **키워드** (필수)
- 캠페인명에서 검색할 키워드
- 예: \`키워드:고병우\`, \`키워드:치아교정\`

📅 **날짜** (선택, 기본값: 어제)
- \`20250720-20250721\`: 특정 기간
- \`어제\`: 어제 하루
- \`오늘\`: 오늘 하루  
- \`7일\`: 최근 7일

📱 **매체** (선택, 기본값: 전체)
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
   * 에러 응답 생성
   */
  createErrorResponse(message) {
    return {
      content: [
        {
          type: 'text',
          text: `❌ **통합 검색 오류**\n\n${message}\n\n도움말을 보려면 \`search_help\` 도구를 사용하세요.`
        }
      ]
    };
  }
}