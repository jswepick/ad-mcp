/**
 * 한국수출입은행 환율 API 서비스
 * Facebook 달러 → 원화 환산을 위한 환율 정보 제공
 */

import axios from 'axios';
import fs from 'fs';
import path from 'path';
import 'dotenv/config';

const API_KEY = process.env.KOREAEXIM_API_KEY;
const API_URL = 'https://oapi.koreaexim.go.kr/site/program/financial/exchangeJSON';
const CACHE_FILE_PATH = path.join(process.cwd(), 'exchange-rate-cache.json');

/**
 * 환율 캐시 데이터 구조
 * {
 *   date: '2025-07-30',
 *   usdRate: 1056.23,
 *   lastUpdated: '2025-07-30T12:00:00.000Z'
 * }
 */

export class ExchangeRateService {
  constructor() {
    this.cache = null;
    this.dateRateCache = new Map(); // 날짜별 환율 캐시
    this.loadCache();
  }

  /**
   * 캐시 파일에서 환율 정보 로드
   */
  loadCache() {
    try {
      if (fs.existsSync(CACHE_FILE_PATH)) {
        const data = fs.readFileSync(CACHE_FILE_PATH, 'utf8');
        this.cache = JSON.parse(data);
        console.error('환율 캐시 로드됨:', this.cache);
      }
    } catch (error) {
      console.error('환율 캐시 로드 실패:', error.message);
      this.cache = null;
    }
  }

  /**
   * 캐시 파일에 환율 정보 저장
   */
  saveCache(data) {
    try {
      fs.writeFileSync(CACHE_FILE_PATH, JSON.stringify(data, null, 2));
      this.cache = data;
      console.error('환율 캐시 저장됨:', data);
    } catch (error) {
      console.error('환율 캐시 저장 실패:', error.message);
    }
  }

  /**
   * 캐시된 환율이 유효한지 확인 (당일 12시 이후 데이터인지)
   */
  isCacheValid() {
    if (!this.cache) return false;

    const now = new Date();
    const today = now.toISOString().split('T')[0];
    const cacheDate = this.cache.date;
    
    // 캐시 날짜가 오늘이 아니면 무효
    if (cacheDate !== today) return false;

    // 오늘 12시 이전이면 어제 환율 사용 (은행 업데이트 시간 고려)
    const noon = new Date();
    noon.setHours(12, 0, 0, 0);
    
    if (now < noon) {
      // 12시 이전이면 어제 환율이 유효
      const yesterday = new Date(now);
      yesterday.setDate(yesterday.getDate() - 1);
      const yesterdayStr = yesterday.toISOString().split('T')[0];
      return cacheDate === yesterdayStr;
    }

    return true;
  }

  /**
   * 한국수출입은행 API에서 환율 정보 조회
   */
  async fetchExchangeRate(date = null) {
    if (!API_KEY) {
      throw new Error('KOREAEXIM_API_KEY 환경변수가 설정되지 않았습니다');
    }

    try {
      const searchDate = date || new Date().toISOString().split('T')[0].replace(/-/g, '');
      const url = `${API_URL}?authkey=${API_KEY}&searchdate=${searchDate}&data=AP01`;
      
      console.error('환율 API 호출:', url.replace(API_KEY, '***'));
      
      const response = await axios.get(url, {
        timeout: 10000,
        headers: {
          'User-Agent': 'MCP-Ads-Service/1.0'
        }
      });

      const data = response.data;
      
      // 응답이 배열이 아닌 경우 (오류 응답)
      if (!Array.isArray(data)) {
        if (data.result && data.result !== 1) {
          const errorMessages = {
            2: 'DATA코드 오류',
            3: '인증코드 오류', 
            4: '일일제한횟수 마감'
          };
          throw new Error(`API 오류 (코드 ${data.result}): ${errorMessages[data.result] || '알 수 없는 오류'}`);
        }
        throw new Error('예상하지 못한 API 응답 형식');
      }

      // USD 환율 찾기
      const usdData = data.find(item => item.cur_unit === 'USD');
      if (!usdData) {
        throw new Error('USD 환율 정보를 찾을 수 없습니다');
      }

      if (usdData.result !== 1) {
        throw new Error('USD 환율 데이터 조회 실패');
      }

      // TTB(전신환 받으실때) 환율 파싱
      const ttbStr = usdData.ttb;
      if (!ttbStr || ttbStr === '0') {
        throw new Error('유효하지 않은 TTB 환율 데이터');
      }

      const usdRate = parseFloat(ttbStr.replace(/,/g, ''));
      if (isNaN(usdRate) || usdRate <= 0) {
        throw new Error('TTB 환율 파싱 실패');
      }

      const cacheData = {
        date: searchDate.slice(0, 4) + '-' + searchDate.slice(4, 6) + '-' + searchDate.slice(6, 8),
        usdRate: usdRate,
        lastUpdated: new Date().toISOString(),
        source: 'koreaexim_api'
      };

      this.saveCache(cacheData);
      return usdRate;

    } catch (error) {
      console.error('환율 API 호출 실패:', error.message);
      throw error;
    }
  }

  /**
   * USD를 KRW로 환산
   */
  async convertUsdToKrw(usdAmount) {
    try {
      const rate = await this.getUsdRate();
      return usdAmount * rate;
    } catch (error) {
      console.error('USD → KRW 환산 실패:', error.message);
      throw error;
    }
  }

  /**
   * USD 환율 조회 (캐시 우선, 실패시 API 호출)
   */
  async getUsdRate() {
    // 1. 캐시 확인
    if (this.isCacheValid()) {
      console.error('캐시된 환율 사용:', this.cache.usdRate);
      return this.cache.usdRate;
    }

    // 2. 현재 날짜로 API 호출
    try {
      console.error('현재 날짜 환율 API 호출 시도');
      return await this.fetchExchangeRate();
    } catch (error) {
      console.error('현재 날짜 환율 조회 실패:', error.message);
      
      // 3. 어제 날짜로 재시도
      try {
        const yesterday = new Date();
        yesterday.setDate(yesterday.getDate() - 1);
        const yesterdayStr = yesterday.toISOString().split('T')[0].replace(/-/g, '');
        
        console.error('어제 날짜 환율 API 호출 시도:', yesterdayStr);
        return await this.fetchExchangeRate(yesterdayStr);
      } catch (yesterdayError) {
        console.error('어제 환율 조회도 실패:', yesterdayError.message);
        
        // 4. 캐시된 환율이라도 있으면 사용
        if (this.cache && this.cache.usdRate) {
          console.error('오래된 캐시 환율 사용 (최후 수단):', this.cache);
          return this.cache.usdRate;
        }
        
        // 5. 모든 방법이 실패하면 기본값 사용
        const defaultRate = 1300;
        console.error(`환율 조회 완전 실패, 기본값 사용: ${defaultRate}`);
        return defaultRate;
      }
    }
  }

  /**
   * 현재 사용 중인 환율 정보 반환
   */
  async getExchangeInfo() {
    try {
      const rate = await this.getUsdRate();
      return {
        rate: rate,
        date: this.cache?.date || new Date().toISOString().split('T')[0],
        source: this.cache?.source || 'default',
        lastUpdated: this.cache?.lastUpdated || new Date().toISOString()
      };
    } catch (error) {
      return {
        rate: 1300,
        date: new Date().toISOString().split('T')[0],
        source: 'default',
        lastUpdated: new Date().toISOString(),
        error: error.message
      };
    }
  }

  /**
   * 특정 날짜의 환율 조회 (캐시 우선)
   * @param {string} date - YYYY-MM-DD 형식의 날짜
   * @returns {Promise<number>} USD 환율
   */
  async getUsdRateForDate(date) {
    // 캐시에서 확인
    if (this.dateRateCache.has(date)) {
      const rate = this.dateRateCache.get(date);
      console.error(`💱 ${date} 환율: ₩${rate.toLocaleString()}/USD (캐시 사용)`);
      return rate;
    }

    try {
      // API에서 해당 날짜 환율 조회
      const dateStr = date.replace(/-/g, ''); // YYYYMMDD 형식으로 변환
      console.error(`💱 ${date} 환율 API 조회 중...`);
      const rate = await this.fetchExchangeRate(dateStr);
      
      // 캐시에 저장
      this.dateRateCache.set(date, rate);
      console.error(`💱 ${date} 환율: ₩${rate.toLocaleString()}/USD (캐시 저장)`);
      
      return rate;
    } catch (error) {
      console.error(`${date} 환율 조회 실패:`, error.message);
      
      // 실패시 현재 캐시된 환율 사용
      if (this.cache && this.cache.usdRate) {
        console.error(`${date} 환율 대신 현재 캐시 환율 사용:`, this.cache.usdRate);
        return this.cache.usdRate;
      }
      
      // 최후 수단: 기본값
      const defaultRate = 1300;
      console.error(`${date} 환율 조회 완전 실패, 기본값 사용: ${defaultRate}`);
      return defaultRate;
    }
  }

  /**
   * 여러 날짜의 환율을 배치로 조회
   * @param {string[]} dates - YYYY-MM-DD 형식의 날짜 배열
   * @returns {Promise<Map<string, number>>} 날짜별 환율 맵
   */
  async getBatchUsdRates(dates) {
    const rateMap = new Map();
    
    console.error(`💱 배치 환율 조회 시작: ${dates.length}개 날짜 (${dates[0]} ~ ${dates[dates.length-1]})`);
    
    // 병렬로 환율 조회
    const promises = dates.map(async (date) => {
      try {
        const rate = await this.getUsdRateForDate(date);
        return { date, rate };
      } catch (error) {
        console.error(`${date} 환율 조회 중 오류:`, error.message);
        return { date, rate: 1300 }; // 기본값
      }
    });

    const results = await Promise.all(promises);
    
    // 결과를 맵에 저장
    results.forEach(({ date, rate }) => {
      rateMap.set(date, rate);
    });

    console.error(`💱 배치 환율 조회 완료: ${results.length}개 날짜 환율 적용 준비`);
    return rateMap;
  }

  /**
   * 특정 날짜의 USD를 KRW로 환산
   * @param {number} usdAmount - USD 금액
   * @param {string} date - YYYY-MM-DD 형식의 날짜
   * @returns {Promise<number>} KRW 금액
   */
  async convertUsdToKrwForDate(usdAmount, date) {
    try {
      const rate = await this.getUsdRateForDate(date);
      return usdAmount * rate;
    } catch (error) {
      console.error(`${date} USD → KRW 환산 실패:`, error.message);
      throw error;
    }
  }
}

// 싱글톤 인스턴스
export const exchangeRateService = new ExchangeRateService();