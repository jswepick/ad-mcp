/**
 * 당근마켓 광고 성과 서비스 - Google Sheets 연동
 * Google Sheets API를 통해 당근마켓 광고 성과 데이터를 조회
 */

import { google } from 'googleapis';
import 'dotenv/config';

// 환경변수
const SERVICE_ACCOUNT_KEY = process.env.GOOGLE_SHEETS_SERVICE_ACCOUNT_KEY;
const SPREADSHEET_ID = process.env.CARROT_SPREADSHEET_ID;
const SHEET_NAME = process.env.CARROT_SHEET_NAME || '성과데이터';
const SHEET_RANGE = process.env.CARROT_SHEET_RANGE || 'A:M';

export class CarrotAdsService {
  constructor() {
    this.platform = 'carrot';
    this.sheetsApi = null;
    this.auth = null;
  }

  /**
   * Google Sheets API 인증 및 초기화
   */
  async initialize() {
    try {
      if (!SERVICE_ACCOUNT_KEY) {
        throw new Error('GOOGLE_SHEETS_SERVICE_ACCOUNT_KEY 환경변수가 설정되지 않았습니다');
      }

      if (!SPREADSHEET_ID) {
        throw new Error('CARROT_SPREADSHEET_ID 환경변수가 설정되지 않았습니다');
      }

      // Service Account 인증
      const credentials = JSON.parse(SERVICE_ACCOUNT_KEY);
      this.auth = new google.auth.GoogleAuth({
        credentials: credentials,
        scopes: ['https://www.googleapis.com/auth/spreadsheets.readonly']
      });

      // Sheets API 클라이언트 생성
      this.sheetsApi = google.sheets({ version: 'v4', auth: this.auth });
      
      console.error('[Carrot] Google Sheets API 초기화 완료');
      return true;
    } catch (error) {
      console.error('[Carrot] Google Sheets API 초기화 실패:', error.message);
      throw error;
    }
  }

  /**
   * 스프레드시트에서 데이터 조회
   */
  async fetchSheetData() {
    try {
      if (!this.sheetsApi) {
        await this.initialize();
      }

      const response = await this.sheetsApi.spreadsheets.values.get({
        spreadsheetId: SPREADSHEET_ID,
        range: `${SHEET_NAME}!${SHEET_RANGE}`,
      });

      const rows = response.data.values;
      if (!rows || rows.length === 0) {
        console.error('[Carrot] 스프레드시트에 데이터가 없습니다');
        return [];
      }

      console.error(`[Carrot] 스프레드시트에서 ${rows.length}개 행 조회`);
      return rows;
    } catch (error) {
      console.error('[Carrot] 스프레드시트 데이터 조회 실패:', error.message);
      throw error;
    }
  }

  /**
   * 원시 데이터를 표준 형식으로 변환
   * 데이터 구조: 날짜, 매체, 캠페인명, 캠페인ID, 광고세트명, 광고세트ID, 광고소재명, 광고소재ID, 광고비, 노출, 클릭, 부가세, 잠재고객 수집 수
   */
  parseRowData(rows) {
    if (!rows || rows.length === 0) return [];

    // 첫 번째 행을 헤더로 가정
    const headers = rows[0];
    const dataRows = rows.slice(1);

    console.error(`[Carrot] 헤더: ${headers.join(', ')}`);
    console.error(`[Carrot] 데이터 행 수: ${dataRows.length}`);

    const parsedData = [];

    dataRows.forEach((row, index) => {
      try {
        // 빈 행 건너뛰기
        if (!row || row.length === 0 || !row[0]) return;

        const data = {
          date: this.parseDate(row[0]), // 날짜
          platform: 'carrot', // 매체 (고정값)
          campaign_name: row[2] || '', // 캠페인명
          campaign_id: row[3] || '', // 캠페인ID
          adset_name: row[4] || '', // 광고세트명
          adset_id: row[5] || '', // 광고세트ID
          ad_name: row[6] || '', // 광고소재명
          ad_id: row[7] || '', // 광고소재ID
          spend: this.parseNumber(row[8]), // 광고비 (KRW)
          impressions: this.parseNumber(row[9]), // 노출
          clicks: this.parseNumber(row[10]), // 클릭
          tax: this.parseNumber(row[11]), // 부가세
          conversions: this.parseNumber(row[12]) // 잠재고객 수집 수
        };

        // 필수 필드 검증
        if (data.date && data.campaign_name) {
          parsedData.push(data);
        }
      } catch (error) {
        console.warn(`[Carrot] 행 ${index + 2} 파싱 실패:`, error.message);
      }
    });

    console.error(`[Carrot] 파싱 완료: ${parsedData.length}개 유효 데이터`);
    return parsedData;
  }

  /**
   * 날짜 문자열 파싱 (YYYY-MM-DD 형식으로 변환)
   */
  parseDate(dateStr) {
    if (!dateStr) return null;

    try {
      // 다양한 날짜 형식 지원
      const date = new Date(dateStr);
      if (isNaN(date.getTime())) return null;

      return date.toISOString().split('T')[0]; // YYYY-MM-DD
    } catch (error) {
      console.warn(`[Carrot] 날짜 파싱 실패: ${dateStr}`);
      return null;
    }
  }

  /**
   * 숫자 문자열 파싱
   */
  parseNumber(numStr) {
    if (!numStr || numStr === '') return 0;
    
    // 쉼표 제거 후 숫자 변환
    const cleaned = numStr.toString().replace(/,/g, '');
    const num = parseFloat(cleaned);
    
    return isNaN(num) ? 0 : num;
  }

  /**
   * 날짜 필터링된 캠페인 목록 조회 (통합 인터페이스)
   */
  async getCampaignListWithDateFilter(startDate, endDate) {
    try {
      console.error(`[Carrot] 캠페인 조회: ${startDate} ~ ${endDate}`);

      // 스프레드시트 데이터 조회
      const rawData = await this.fetchSheetData();
      const parsedData = this.parseRowData(rawData);

      // 날짜 필터링
      const filteredData = parsedData.filter(row => {
        return row.date >= startDate && row.date <= endDate;
      });

      console.error(`[Carrot] 날짜 필터링 후: ${filteredData.length}개 데이터`);

      // 캠페인별 집계
      const campaignMap = new Map();

      filteredData.forEach(row => {
        const campaignId = row.campaign_id;
        
        if (!campaignMap.has(campaignId)) {
          campaignMap.set(campaignId, {
            campaign_id: campaignId,
            campaign_name: row.campaign_name,
            name: row.campaign_name, // 호환성을 위한 별칭
            platform: 'carrot',
            totalSpend: 0,
            totalImpressions: 0,
            totalClicks: 0,
            totalConversions: 0,
            totalTax: 0
          });
        }

        const campaign = campaignMap.get(campaignId);
        campaign.totalSpend += row.spend;
        campaign.totalImpressions += row.impressions;
        campaign.totalClicks += row.clicks;
        campaign.totalConversions += row.conversions;
        campaign.totalTax += row.tax;
      });

      // 최종 캠페인 목록 생성
      const campaigns = Array.from(campaignMap.values()).map(campaign => ({
        ...campaign,
        spend: campaign.totalSpend,
        impressions: campaign.totalImpressions,
        clicks: campaign.totalClicks,
        conversions: campaign.totalConversions,
        tax: campaign.totalTax,
        ctr: campaign.totalImpressions > 0 ? (campaign.totalClicks / campaign.totalImpressions * 100).toFixed(2) : 0,
        cpc: campaign.totalClicks > 0 ? (campaign.totalSpend / campaign.totalClicks).toFixed(0) : 0,
        cpm: campaign.totalImpressions > 0 ? (campaign.totalSpend / campaign.totalImpressions * 1000).toFixed(0) : 0,
        conversion_rate: campaign.totalClicks > 0 ? (campaign.totalConversions / campaign.totalClicks * 100).toFixed(2) : 0,
        cost_per_conversion: campaign.totalConversions > 0 ? (campaign.totalSpend / campaign.totalConversions).toFixed(0) : 0
      }))
      .sort((a, b) => b.spend - a.spend); // 지출 순 정렬

      console.error(`[Carrot] 캠페인 집계 완료: ${campaigns.length}개 캠페인`);
      const totalSpend = campaigns.reduce((sum, c) => sum + c.spend, 0);
      console.error(`[Carrot] 총 지출: ₩${totalSpend.toLocaleString()}`);

      return campaigns;
    } catch (error) {
      console.error(`[Carrot] 캠페인 목록 조회 실패: ${error.message}`);
      throw error;
    }
  }

  /**
   * 특정 캠페인들의 광고별 상세 성과 조회
   */
  async getAdLevelPerformance(campaignIds, startDate, endDate) {
    try {
      console.error(`[Carrot] 광고 성과 조회: ${campaignIds.length}개 캠페인, ${startDate} ~ ${endDate}`);

      // 스프레드시트 데이터 조회
      const rawData = await this.fetchSheetData();
      const parsedData = this.parseRowData(rawData);

      // 날짜 및 캠페인 필터링
      const filteredData = parsedData.filter(row => {
        return row.date >= startDate && 
               row.date <= endDate && 
               campaignIds.includes(row.campaign_id);
      });

      console.error(`[Carrot] 필터링 후: ${filteredData.length}개 광고 데이터`);

      // 광고별 집계
      const adMap = new Map();

      filteredData.forEach(row => {
        const adId = row.ad_id;
        
        if (!adMap.has(adId)) {
          adMap.set(adId, {
            ad_id: adId,
            ad_name: row.ad_name,
            name: row.ad_name, // 호환성을 위한 별칭
            campaign_id: row.campaign_id,
            campaign_name: row.campaign_name,
            adset_id: row.adset_id,
            adset_name: row.adset_name,
            platform: 'carrot',
            dailyData: [],
            totalSpend: 0,
            totalImpressions: 0,
            totalClicks: 0,
            totalConversions: 0,
            totalTax: 0
          });
        }

        const ad = adMap.get(adId);
        
        // 일별 데이터 추가
        ad.dailyData.push({
          date: row.date,
          spend: row.spend,
          impressions: row.impressions,
          clicks: row.clicks,
          conversions: row.conversions,
          tax: row.tax
        });

        // 총합 계산
        ad.totalSpend += row.spend;
        ad.totalImpressions += row.impressions;
        ad.totalClicks += row.clicks;
        ad.totalConversions += row.conversions;
        ad.totalTax += row.tax;
      });

      // 최종 광고 목록 생성
      const ads = Array.from(adMap.values()).map(ad => ({
        ...ad,
        spend: ad.totalSpend,
        impressions: ad.totalImpressions,
        clicks: ad.totalClicks,
        conversions: ad.totalConversions,
        tax: ad.totalTax,
        ctr: ad.totalImpressions > 0 ? (ad.totalClicks / ad.totalImpressions * 100).toFixed(2) : 0,
        cpc: ad.totalClicks > 0 ? (ad.totalSpend / ad.totalClicks).toFixed(0) : 0,
        cpm: ad.totalImpressions > 0 ? (ad.totalSpend / ad.totalImpressions * 1000).toFixed(0) : 0,
        conversion_rate: ad.totalClicks > 0 ? (ad.totalConversions / ad.totalClicks * 100).toFixed(2) : 0,
        cost_per_conversion: ad.totalConversions > 0 ? (ad.totalSpend / ad.totalConversions).toFixed(0) : 0
      }))
      .sort((a, b) => b.spend - a.spend); // 지출 순 정렬

      console.error(`[Carrot] 광고 집계 완료: ${ads.length}개 광고`);
      return ads;
    } catch (error) {
      console.error(`[Carrot] 광고 성과 조회 실패: ${error.message}`);
      throw error;
    }
  }

  /**
   * 키워드 매칭 함수 (통합 인터페이스)
   */
  matchesKeywords(name, keywordString) {
    if (!keywordString || keywordString.trim() === '') {
      return true; // 키워드가 없으면 모든 항목 매칭
    }
    
    const lowerName = name.toLowerCase();
    
    if (!keywordString.includes(',')) {
      // 단일 키워드
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
        name: 'carrot_get_campaign_list_with_date_filter',
        description: '특정 날짜 범위에서 활동한 당근마켓 캠페인 목록을 성과 데이터와 함께 조회합니다',
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
      }
    ];
  }

  /**
   * MCP 도구 실행 핸들러
   */
  async handleToolCall(toolName, args) {
    try {
      switch (toolName) {
        case 'carrot_get_campaign_list_with_date_filter':
          const campaigns = await this.getCampaignListWithDateFilter(args.start_date, args.end_date);
          return {
            content: [
              {
                type: 'text',
                text: this.formatCampaignList(campaigns, args.start_date, args.end_date)
              }
            ]
          };
        default:
          throw new Error(`Unknown tool: ${toolName}`);
      }
    } catch (error) {
      return {
        content: [
          {
            type: 'text',
            text: `❌ **당근마켓 도구 실행 실패**\n\n**오류**: ${error.message}`
          }
        ]
      };
    }
  }

  /**
   * 캠페인 목록 포맷팅
   */
  formatCampaignList(campaigns, startDate, endDate) {
    if (!campaigns || campaigns.length === 0) {
      return `📋 **당근마켓 캠페인 목록** (${startDate} ~ ${endDate})\n\n해당 기간에 성과가 있는 캠페인이 없습니다.`;
    }

    const totalSpend = campaigns.reduce((sum, c) => sum + c.spend, 0);
    
    let result = `📋 **당근마켓 캠페인 목록** (${startDate} ~ ${endDate})\n\n`;
    result += `💰 **총 지출**: ₩${totalSpend.toLocaleString()}\n`;
    result += `📊 **캠페인 수**: ${campaigns.length}개\n\n`;

    campaigns.forEach((campaign, index) => {
      result += `**${index + 1}. ${campaign.campaign_name}**\n`;
      result += `├ 지출: ₩${campaign.spend.toLocaleString()}\n`;
      result += `├ 노출: ${campaign.impressions.toLocaleString()}\n`;
      result += `├ 클릭: ${campaign.clicks.toLocaleString()}\n`;
      result += `├ CTR: ${campaign.ctr}%\n`;
      result += `├ CPC: ₩${campaign.cpc}\n`;
      result += `├ 전환: ${campaign.conversions.toLocaleString()}\n`;
      result += `└ 전환율: ${campaign.conversion_rate}%\n\n`;
    });

    return result;
  }
}