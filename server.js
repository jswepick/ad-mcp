#!/usr/bin/env node

import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { SSEServerTransport } from '@modelcontextprotocol/sdk/server/sse.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import {
  CallToolRequestSchema,
  ErrorCode,
  ListToolsRequestSchema,
  McpError,
} from '@modelcontextprotocol/sdk/types.js';
import express from 'express';
import cors from 'cors';
import 'dotenv/config';

// 서비스 임포트
import { FacebookAdsService } from './services/facebook-ads-service.js';
import { GoogleAdsService } from './services/google-ads-service.js';
import { TikTokAdsService } from './services/tiktok-ads-service.js';

// 환경 변수 확인
const PORT = process.env.PORT || 3000;

console.error('🚀 Multi-Platform Ads MCP Server 시작');
console.error('환경변수 확인:');

// Facebook 환경변수
const facebookEnabled = !!(process.env.META_ACCESS_TOKEN && process.env.META_AD_ACCOUNT_ID);
console.error('📘 Facebook Ads:', facebookEnabled ? '✅ 활성화' : '❌ 비활성화 (환경변수 누락)');

// Google 환경변수  
const googleEnabled = !!(process.env.GOOGLE_ADS_CLIENT_ID && process.env.GOOGLE_ADS_CUSTOMER_ID);
console.error('🔍 Google Ads:', googleEnabled ? '✅ 활성화' : '❌ 비활성화 (환경변수 누락)');

// TikTok 환경변수
const tiktokEnabled = !!(process.env.TIKTOK_ACCESS_TOKEN && process.env.TIKTOK_ADVERTISER_ID);
console.error('🎵 TikTok Ads:', tiktokEnabled ? '✅ 활성화' : '❌ 비활성화 (환경변수 누락)');

console.error('PORT:', PORT);

class MultiPlatformAdsServer {
  constructor() {
    this.server = new Server(
      {
        name: 'multi-platform-ads-server',
        version: '2.0.0',
      },
      {
        capabilities: {
          tools: {},
        },
      }
    );
    
    // 서비스 인스턴스 생성
    this.services = {};
    
    if (facebookEnabled) {
      this.services.facebook = new FacebookAdsService();
      console.error('📘 Facebook Ads 서비스 초기화 완료');
    }
    
    if (googleEnabled) {
      this.services.google = new GoogleAdsService();
      console.error('🔍 Google Ads 서비스 초기화 완료');
    }
    
    if (tiktokEnabled) {
      this.services.tiktok = new TikTokAdsService();
      console.error('🎵 TikTok Ads 서비스 초기화 완료');
    }
    
    this.setupToolHandlers();
    this.server.onerror = (error) => console.error('[MCP Error]', error);
  }

  /**
   * 모든 플랫폼의 도구들을 통합하여 반환
   */
  getAllTools() {
    const allTools = [];
    
    Object.entries(this.services).forEach(([platform, service]) => {
      const platformTools = service.getTools();
      allTools.push(...platformTools);
      console.error(`${platform} 플랫폼: ${platformTools.length}개 도구 로드됨`);
    });
    
    console.error(`총 ${allTools.length}개 도구가 로드되었습니다.`);
    return allTools;
  }

  /**
   * 도구명으로 해당 서비스 찾기
   */
  getServiceByToolName(toolName) {
    if (toolName.startsWith('facebook_')) {
      return this.services.facebook;
    } else if (toolName.startsWith('google_')) {
      return this.services.google;
    } else if (toolName.startsWith('tiktok_')) {
      return this.services.tiktok;
    } else {
      // 하위 호환성을 위해 facebook 도구들은 접두사 없이도 지원
      if (this.services.facebook) {
        const facebookTools = this.services.facebook.getTools();
        const foundTool = facebookTools.find(tool => tool.name === toolName);
        if (foundTool) {
          return this.services.facebook;
        }
      }
      return null;
    }
  }

  setupToolHandlers() {
    // 도구 목록 반환
    this.server.setRequestHandler(ListToolsRequestSchema, async () => {
      const tools = this.getAllTools();
      
      // 하위 호환성을 위해 기존 Facebook 도구들도 접두사 없이 추가
      if (this.services.facebook) {
        const facebookTools = this.services.facebook.getTools();
        const legacyTools = facebookTools.map(tool => ({
          ...tool,
          name: tool.name.replace('facebook_', ''),
          description: tool.description + ' (레거시 호환성)'
        }));
        tools.push(...legacyTools);
      }
      
      return { tools };
    });

    // 도구 호출 처리
    this.server.setRequestHandler(CallToolRequestSchema, async (request) => {
      try {
        const { name, arguments: args } = request.params;
        console.error(`🔧 도구 호출: ${name}`, args ? Object.keys(args) : 'no args');

        // 해당 서비스 찾기
        let service = this.getServiceByToolName(name);
        let actualToolName = name;

        // 레거시 도구명인 경우 Facebook 도구로 변환
        if (!service && this.services.facebook) {
          const facebookTools = this.services.facebook.getTools();
          const legacyTool = facebookTools.find(tool => 
            tool.name.replace('facebook_', '') === name
          );
          if (legacyTool) {
            service = this.services.facebook;
            actualToolName = legacyTool.name;
            console.error(`📘 레거시 도구 ${name} → ${actualToolName}로 변환`);
          }
        }

        if (!service) {
          throw new McpError(ErrorCode.MethodNotFound, `Unknown tool: ${name}`);
        }

        // 서비스에 도구 호출 위임
        const result = await service.handleToolCall(actualToolName, args || {});
        console.error(`✅ 도구 ${name} 실행 완료`);
        return result;

      } catch (error) {
        console.error(`❌ 도구 실행 실패: ${error.message}`);
        if (error instanceof McpError) {
          throw error;
        }
        throw new McpError(ErrorCode.InternalError, `Tool execution failed: ${error.message}`);
      }
    });
  }

  async run() {
    // 실행 모드 감지
    const isRenderMode = !!process.env.RENDER_EXTERNAL_URL;
    
    if (!isRenderMode) {
      // MCP stdio 모드 - HTTP 서버 없이 실행
      console.error('🔗 MCP stdio 모드로 실행 중...');
      console.error('MCP 서버가 준비되었습니다.');
      
      // Stdio transport로 MCP 서버 연결
      const transport = new StdioServerTransport();
      
      // Transport 이벤트 핸들러 설정
      transport.onclose = () => {
        console.error('❌ Transport 연결이 닫혔습니다.');
        process.exit(0);
      };
      
      transport.onerror = (error) => {
        console.error('❌ Transport 에러:', error);
        process.exit(1);
      };
      
      await this.server.connect(transport);
      console.error('✅ MCP 서버가 stdio로 연결되었습니다.');
      
      // 프로세스가 종료되지 않도록 stdin 활성화
      process.stdin.resume();
      return;
    }
    
    // Render용 HTTP 서버 모드
    const app = express();
    
    app.use(cors());
    app.use(express.json());

    // Health check endpoint
    app.get('/health', (req, res) => {
      const platformStatus = {};
      Object.keys(this.services).forEach(platform => {
        platformStatus[platform] = 'active';
      });

      res.json({ 
        status: 'healthy',
        timestamp: new Date().toISOString(),
        platforms: platformStatus,
        total_tools: this.getAllTools().length,
        port: PORT
      });
    });

    // MCP SSE endpoint
    app.get('/sse', async (req, res) => {
      const transport = new SSEServerTransport('/sse', res);
      await this.server.connect(transport);
    });

    // MCP POST endpoint
    app.post('/message', async (req, res) => {
      console.error('=== 요청 시작 ===');
      console.error('Request body:', JSON.stringify(req.body, null, 2));
      
      try {
        const { method, params } = req.body;
        console.error('Method:', method, 'Params:', params);
        
        if (method === 'initialize') {
          const response = {
            jsonrpc: "2.0",
            id: req.body.id,
            result: {
              protocolVersion: "2024-11-05",
              capabilities: { tools: {} },
              serverInfo: { 
                name: "multi-platform-ads-server", 
                version: "2.0.0",
                platforms: Object.keys(this.services)
              }
            }
          };
          res.json(response);
          return;
        }
        
        if (method === 'notifications/initialized') {
          res.status(200).end();
          return;
        }
        
        if (method === 'tools/list') {
          console.error('tools/list 호출 중...');
          
          const tools = this.getAllTools();
          
          // 하위 호환성을 위해 기존 Facebook 도구들도 접두사 없이 추가
          if (this.services.facebook) {
            const facebookTools = this.services.facebook.getTools();
            const legacyTools = facebookTools.map(tool => ({
              ...tool,
              name: tool.name.replace('facebook_', ''),
              description: tool.description + ' (레거시 호환성)'
            }));
            tools.push(...legacyTools);
          }
          
          const response = {
            jsonrpc: "2.0",
            id: req.body.id,
            result: { tools: tools }
          };
          
          console.error('tools/list 완료, 도구 개수:', tools.length);
          res.json(response);
          return;
        }
        
        if (method === 'tools/call') {
          const { name, arguments: args } = params;
          console.error('Tool name:', name, 'Args:', args);
          
          console.error(`=== ${name} 실행 시작 ===`);
          
          // 해당 서비스 찾기
          let service = this.getServiceByToolName(name);
          let actualToolName = name;

          // 레거시 도구명인 경우 Facebook 도구로 변환
          if (!service && this.services.facebook) {
            const facebookTools = this.services.facebook.getTools();
            const legacyTool = facebookTools.find(tool => 
              tool.name.replace('facebook_', '') === name
            );
            if (legacyTool) {
              service = this.services.facebook;
              actualToolName = legacyTool.name;
              console.error(`📘 레거시 도구 ${name} → ${actualToolName}로 변환`);
            }
          }

          if (!service) {
            throw new Error(`Unknown tool: ${name}`);
          }

          // 서비스에 도구 호출 위임
          const result = await service.handleToolCall(actualToolName, args || {});
          
          console.error('=== 응답 준비 중 ===');
          const response = {
            jsonrpc: "2.0",
            id: req.body.id,
            result: result
          };
          
          console.error('응답 크기:', JSON.stringify(response).length);
          res.json(response);
          console.error('=== 요청 완료 ===');
          return;
        }
        
        throw new Error(`Unknown method: ${method}`);
        
      } catch (error) {
        console.error('=== 에러 발생 ===');
        console.error('Error message:', error.message);
        console.error('Error stack:', error.stack);
        
        res.status(500).json({
          jsonrpc: "2.0",
          id: req.body.id || null,
          error: {
            code: -32603,
            message: error.message
          }
        });
      }
    });

    // Root endpoint with basic info
    app.get('/', (req, res) => {
      const platformInfo = {};
      Object.entries(this.services).forEach(([platform, service]) => {
        platformInfo[platform] = {
          enabled: true,
          tools_count: service.getTools().length
        };
      });

      res.json({
        name: 'Multi-Platform Ads MCP Server',
        version: '2.0.0',
        description: 'MCP Server for Facebook, Google, and TikTok Ads management',
        platforms: platformInfo,
        total_tools: this.getAllTools().length,
        endpoints: {
          health: '/health',
          sse: '/sse',
          message: '/message'
        }
      });
    });

    app.listen(PORT, '0.0.0.0', () => {
      console.error(`🚀 Multi-Platform Ads MCP Server running on port ${PORT}`);
      console.error(`📊 Health check: http://localhost:${PORT}/health`);
      console.error(`🔗 SSE endpoint: http://localhost:${PORT}/sse`);
      console.error(`💬 Message endpoint: http://localhost:${PORT}/message`);
      
      const enabledPlatforms = Object.keys(this.services);
      console.error(`🎯 활성화된 플랫폼: ${enabledPlatforms.join(', ') || '없음'}`);
    });
  }
}

// ====== 슬립 방지 코드 ======
if (process.env.RENDER_EXTERNAL_URL) {
  const keepAliveUrl = process.env.RENDER_EXTERNAL_URL + '/health';
  
  setInterval(async () => {
    try {
      const response = await fetch(keepAliveUrl);
      console.error('Keep alive ping:', response.status);
    } catch (error) {
      console.error('Keep alive failed:', error.message);
    }
  }, 10 * 60 * 1000); // 10분마다 자체 핑
}

const server = new MultiPlatformAdsServer();
server.run().catch(console.error);
