#!/usr/bin/env node

import fs from 'fs';

// 테스트용 하드코딩된 데이터
const testData = {
  reportDate: '2025-07-20',
  summary: {
    totalSpend: 5130.52,
    totalImpressions: 9129207,
    totalClicks: 91999,
    totalConversions: 0,
    overallCTR: 1.01,
    overallCPC: 0.06,
    overallCPM: 0.56,
    actions: {
      lead: 44,
      link_click: 81187,
      landing_page_view: 1426,
      purchase: 7,
      add_to_cart: 0,
      complete_registration: 140,
      total_actions: 11416332
    }
  },
  campaigns: [
    {
      campaign_id: "120212054453700358",
      campaign_name: "#CPA #노블리에 #결혼정보 #김효경 #01 노블리에규칙용",
      spend: 129.08,
      impressions: 3499,
      clicks: 99,
      ctr: 2.83,
      cpc: 1.30,
      actions: { lead: 19, link_click: 76, landing_page_view: 0, purchase: 0, add_to_cart: 0, complete_registration: 0, total_actions: 272 }
    },
    {
      campaign_id: "120213988499820358",
      campaign_name: "#CPA #노블리에 #결혼정보 #김효경#02 노블리에규칙용",
      spend: 91.94,
      impressions: 3230,
      clicks: 75,
      ctr: 2.32,
      cpc: 1.23,
      actions: { lead: 9, link_click: 61, landing_page_view: 1, purchase: 0, add_to_cart: 0, complete_registration: 0, total_actions: 218 }
    },
    {
      campaign_id: "120216426275460358",
      campaign_name: "#CPR+ #강남밝은미소안과 #스마일라식 #김단아 #숏폼 #5 *랜딩2",
      spend: 109.38,
      impressions: 13703,
      clicks: 81,
      ctr: 0.59,
      cpc: 1.35,
      actions: { lead: 0, link_click: 71, landing_page_view: 64, purchase: 0, add_to_cart: 0, complete_registration: 12, total_actions: 7751 }
    },
    {
      campaign_id: "120217823522820358",
      campaign_name: "#CPR+ #GS안과 #스마일라식 #이소민 #숏폼 #5",
      spend: 102.91,
      impressions: 11131,
      clicks: 82,
      ctr: 0.74,
      cpc: 1.25,
      actions: { lead: 0, link_click: 64, landing_page_view: 52, purchase: 0, add_to_cart: 0, complete_registration: 4, total_actions: 2945 }
    },
    {
      campaign_id: "120224549975770358",
      campaign_name: "#CPR+ #원치과 #임플란트 #김단아 #20만원 #01 원치과규칙용",
      spend: 100.11,
      impressions: 2137,
      clicks: 70,
      ctr: 3.28,
      cpc: 1.43,
      actions: { lead: 0, link_click: 64, landing_page_view: 45, purchase: 0, add_to_cart: 0, complete_registration: 9, total_actions: 3267 }
    },
    {
      campaign_id: "120224988312820358",
      campaign_name: "#CPR+ #원치과 #임플란트 #김단아 #20만원 #02 원치과규칙용",
      spend: 76.53,
      impressions: 1882,
      clicks: 66,
      ctr: 3.51,
      cpc: 1.16,
      actions: { lead: 0, link_click: 62, landing_page_view: 49, purchase: 0, add_to_cart: 0, complete_registration: 6, total_actions: 2492 }
    },
    {
      campaign_id: "120225248550730358",
      campaign_name: "#CPA #모모성형외과 #모발이식 #김단아 #지역통합서울점전용 #06 *AI모발이식",
      spend: 91.91,
      impressions: 1552,
      clicks: 39,
      ctr: 2.51,
      cpc: 2.36,
      actions: { lead: 0, link_click: 42, landing_page_view: 30, purchase: 0, add_to_cart: 0, complete_registration: 1, total_actions: 3261 }
    },
    {
      campaign_id: "120225582492800358",
      campaign_name: "#CPA #모모성형외과 #모발이식 #김단아 #지역통합 #08 #지원자모집우수소재",
      spend: 93.89,
      impressions: 1854,
      clicks: 55,
      ctr: 2.97,
      cpc: 1.71,
      actions: { lead: 0, link_click: 53, landing_page_view: 23, purchase: 0, add_to_cart: 0, complete_registration: 5, total_actions: 4063 }
    },
    {
      campaign_id: "120226037177080358",
      campaign_name: "#CPR+ #강남밝은미소안과 #스마일라식 #김단아 #숏폼 #6 *랜딩2",
      spend: 163.03,
      impressions: 17107,
      clicks: 162,
      ctr: 0.95,
      cpc: 1.01,
      actions: { lead: 0, link_click: 139, landing_page_view: 127, purchase: 0, add_to_cart: 0, complete_registration: 17, total_actions: 10656 }
    },
    {
      campaign_id: "120226365543980358",
      campaign_name: "#CPA #노블리에 #결혼정보 #김효경 #03 *서울, 인천(일7) 노블리에규칙용",
      spend: 72.03,
      impressions: 1476,
      clicks: 34,
      ctr: 2.30,
      cpc: 2.12,
      actions: { lead: 3, link_click: 20, landing_page_view: 0, purchase: 0, add_to_cart: 0, complete_registration: 0, total_actions: 78 }
    }
  ]
};

function generateHTMLReport(data) {
  const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
  
  const html = `<!DOCTYPE html>
<html lang="ko">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Facebook 광고 성과 리포트 - ${data.reportDate}</title>
    <link href="https://cdn.jsdelivr.net/npm/bootstrap@5.1.3/dist/css/bootstrap.min.css" rel="stylesheet">
    <script src="https://cdn.jsdelivr.net/npm/chart.js"></script>
    <style>
        .metric-card {
            background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
            color: white;
            border-radius: 15px;
            padding: 20px;
            margin-bottom: 20px;
        }
        .metric-value {
            font-size: 2rem;
            font-weight: bold;
            margin-bottom: 5px;
        }
        .metric-label {
            font-size: 0.9rem;
            opacity: 0.9;
        }
        .chart-container {
            background: white;
            border-radius: 15px;
            padding: 20px;
            margin-bottom: 30px;
            box-shadow: 0 4px 6px rgba(0, 0, 0, 0.1);
        }
        .campaign-table {
            font-size: 0.9rem;
        }
        .campaign-name {
            max-width: 300px;
            white-space: nowrap;
            overflow: hidden;
            text-overflow: ellipsis;
        }
        @media print {
            .chart-container { page-break-inside: avoid; }
        }
        body {
            background-color: #f8f9fa;
        }
        .header-section {
            background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
            color: white;
            padding: 30px 0;
            margin-bottom: 30px;
        }
    </style>
</head>
<body>
    <div class="header-section">
        <div class="container">
            <h1 class="mb-3">📊 Facebook 광고 성과 리포트</h1>
            <p class="mb-0">
                📅 조회일: ${data.reportDate} | 
                🕐 생성시간: ${new Date().toLocaleString('ko-KR')} |
                📈 캠페인 수: ${data.campaigns.length}개
            </p>
        </div>
    </div>

    <div class="container">
        <!-- 전체 성과 요약 -->
        <div class="row mb-4">
            <div class="col-12">
                <h2 class="mb-4">🎯 전체 성과 요약</h2>
            </div>
            <div class="col-md-3 col-sm-6">
                <div class="metric-card">
                    <div class="metric-value">$${data.summary.totalSpend.toLocaleString()}</div>
                    <div class="metric-label">총 지출</div>
                </div>
            </div>
            <div class="col-md-3 col-sm-6">
                <div class="metric-card">
                    <div class="metric-value">${data.summary.totalImpressions.toLocaleString()}</div>
                    <div class="metric-label">총 노출수</div>
                </div>
            </div>
            <div class="col-md-3 col-sm-6">
                <div class="metric-card">
                    <div class="metric-value">${data.summary.totalClicks.toLocaleString()}</div>
                    <div class="metric-label">총 클릭수</div>
                </div>
            </div>
            <div class="col-md-3 col-sm-6">
                <div class="metric-card">
                    <div class="metric-value">${data.summary.overallCTR}%</div>
                    <div class="metric-label">평균 CTR</div>
                </div>
            </div>
        </div>

        <!-- 액션 요약 -->
        <div class="row mb-4">
            <div class="col-md-2 col-sm-4">
                <div class="metric-card">
                    <div class="metric-value">${data.summary.actions.lead}</div>
                    <div class="metric-label">🎯 리드</div>
                </div>
            </div>
            <div class="col-md-2 col-sm-4">
                <div class="metric-card">
                    <div class="metric-value">${data.summary.actions.link_click.toLocaleString()}</div>
                    <div class="metric-label">🔗 링크클릭</div>
                </div>
            </div>
            <div class="col-md-2 col-sm-4">
                <div class="metric-card">
                    <div class="metric-value">${data.summary.actions.landing_page_view}</div>
                    <div class="metric-label">📄 랜딩페이지뷰</div>
                </div>
            </div>
            <div class="col-md-2 col-sm-4">
                <div class="metric-card">
                    <div class="metric-value">${data.summary.actions.purchase}</div>
                    <div class="metric-label">🛒 구매</div>
                </div>
            </div>
            <div class="col-md-2 col-sm-4">
                <div class="metric-card">
                    <div class="metric-value">${data.summary.actions.complete_registration}</div>
                    <div class="metric-label">📝 가입완료</div>
                </div>
            </div>
            <div class="col-md-2 col-sm-4">
                <div class="metric-card">
                    <div class="metric-value">$${data.summary.overallCPC}</div>
                    <div class="metric-label">💵 평균 CPC</div>
                </div>
            </div>
        </div>

        <!-- 차트 섹션 -->
        <div class="row mb-4">
            <div class="col-md-6">
                <div class="chart-container">
                    <h4>📊 상위 10개 캠페인 지출</h4>
                    <canvas id="spendChart" width="400" height="300"></canvas>
                </div>
            </div>
            <div class="col-md-6">
                <div class="chart-container">
                    <h4>📈 CTR vs 지출 분포</h4>
                    <canvas id="ctrScatterChart" width="400" height="300"></canvas>
                </div>
            </div>
        </div>

        <div class="row mb-4">
            <div class="col-md-6">
                <div class="chart-container">
                    <h4>🎯 액션 타입별 분포</h4>
                    <canvas id="actionsPieChart" width="400" height="300"></canvas>
                </div>
            </div>
            <div class="col-md-6">
                <div class="chart-container">
                    <h4>💰 CPC 분포</h4>
                    <canvas id="cpcHistogram" width="400" height="300"></canvas>
                </div>
            </div>
        </div>

        <!-- 캠페인 상세 테이블 -->
        <div class="chart-container">
            <h4>📋 캠페인 상세 성과</h4>
            <div class="table-responsive">
                <table class="table table-hover campaign-table">
                    <thead class="table-dark">
                        <tr>
                            <th>캠페인명</th>
                            <th>지출</th>
                            <th>노출수</th>
                            <th>클릭수</th>
                            <th>CTR</th>
                            <th>CPC</th>
                            <th>리드</th>
                            <th>가입완료</th>
                        </tr>
                    </thead>
                    <tbody>
                        ${data.campaigns.map(campaign => `
                            <tr>
                                <td class="campaign-name" title="${campaign.campaign_name}">${campaign.campaign_name}</td>
                                <td>$${campaign.spend.toFixed(2)}</td>
                                <td>${campaign.impressions.toLocaleString()}</td>
                                <td>${campaign.clicks}</td>
                                <td>${campaign.ctr.toFixed(2)}%</td>
                                <td>$${campaign.cpc.toFixed(2)}</td>
                                <td>${campaign.actions.lead}</td>
                                <td>${campaign.actions.complete_registration}</td>
                            </tr>
                        `).join('')}
                    </tbody>
                </table>
            </div>
        </div>

        <div class="text-center mt-4 mb-4">
            <small class="text-muted">
                리포트 생성시간: ${new Date().toLocaleString('ko-KR')} | 
                총 ${data.campaigns.length}개 캠페인 분석 완료
            </small>
        </div>
    </div>

    <script>
        const campaignData = ${JSON.stringify(data.campaigns)};
        const summaryData = ${JSON.stringify(data.summary)};

        // 상위 10개 캠페인 지출 차트
        const top10Campaigns = campaignData
            .sort((a, b) => b.spend - a.spend)
            .slice(0, 10);

        new Chart(document.getElementById('spendChart'), {
            type: 'bar',
            data: {
                labels: top10Campaigns.map(c => c.campaign_name.slice(0, 30) + '...'),
                datasets: [{
                    label: '지출 ($)',
                    data: top10Campaigns.map(c => c.spend),
                    backgroundColor: 'rgba(102, 126, 234, 0.8)',
                    borderColor: 'rgba(102, 126, 234, 1)',
                    borderWidth: 1
                }]
            },
            options: {
                responsive: true,
                plugins: {
                    legend: { display: false }
                },
                scales: {
                    y: { beginAtZero: true }
                }
            }
        });

        // CTR vs 지출 스캐터 플롯
        new Chart(document.getElementById('ctrScatterChart'), {
            type: 'scatter',
            data: {
                datasets: [{
                    label: 'CTR vs 지출',
                    data: campaignData.map(c => ({ x: c.spend, y: c.ctr })),
                    backgroundColor: 'rgba(118, 75, 162, 0.6)',
                    borderColor: 'rgba(118, 75, 162, 1)',
                }]
            },
            options: {
                responsive: true,
                scales: {
                    x: { 
                        title: { display: true, text: '지출 ($)' }
                    },
                    y: { 
                        title: { display: true, text: 'CTR (%)' }
                    }
                }
            }
        });

        // 액션 타입별 파이 차트
        new Chart(document.getElementById('actionsPieChart'), {
            type: 'pie',
            data: {
                labels: ['리드', '링크클릭', '랜딩페이지뷰', '구매', '가입완료'],
                datasets: [{
                    data: [
                        summaryData.actions.lead,
                        summaryData.actions.link_click,
                        summaryData.actions.landing_page_view,
                        summaryData.actions.purchase,
                        summaryData.actions.complete_registration
                    ],
                    backgroundColor: [
                        'rgba(255, 99, 132, 0.8)',
                        'rgba(54, 162, 235, 0.8)',
                        'rgba(255, 205, 86, 0.8)',
                        'rgba(75, 192, 192, 0.8)',
                        'rgba(153, 102, 255, 0.8)'
                    ]
                }]
            },
            options: {
                responsive: true
            }
        });

        // CPC 히스토그램
        const cpcRanges = ['$0-0.5', '$0.5-1', '$1-1.5', '$1.5-2', '$2+'];
        const cpcCounts = [0, 0, 0, 0, 0];
        
        campaignData.forEach(c => {
            if (c.cpc <= 0.5) cpcCounts[0]++;
            else if (c.cpc <= 1) cpcCounts[1]++;
            else if (c.cpc <= 1.5) cpcCounts[2]++;
            else if (c.cpc <= 2) cpcCounts[3]++;
            else cpcCounts[4]++;
        });

        new Chart(document.getElementById('cpcHistogram'), {
            type: 'bar',
            data: {
                labels: cpcRanges,
                datasets: [{
                    label: '캠페인 수',
                    data: cpcCounts,
                    backgroundColor: 'rgba(255, 159, 64, 0.8)',
                    borderColor: 'rgba(255, 159, 64, 1)',
                    borderWidth: 1
                }]
            },
            options: {
                responsive: true,
                plugins: {
                    legend: { display: false }
                },
                scales: {
                    y: { 
                        beginAtZero: true,
                        title: { display: true, text: '캠페인 수' }
                    },
                    x: {
                        title: { display: true, text: 'CPC 범위' }
                    }
                }
            }
        });
    </script>
</body>
</html>`;

  return html;
}

function saveHTMLReport() {
  console.log('📊 Facebook 광고 성과 HTML 리포트 생성 중...\n');
  
  const timestamp = new Date().toISOString().slice(0, 16).replace(/[:.]/g, '-');
  const filename = `facebook-report-test-${timestamp}.html`;
  
  const html = generateHTMLReport(testData);
  
  try {
    fs.writeFileSync(filename, html, 'utf8');
    
    console.log('✅ HTML 리포트 생성 완료!\n');
    console.log(`📁 파일 위치: ${process.cwd()}/${filename}`);
    console.log(`📊 캠페인 수: ${testData.campaigns.length}개`);
    console.log(`💰 총 지출: $${testData.summary.totalSpend.toLocaleString()}`);
    console.log(`👁️ 총 노출: ${testData.summary.totalImpressions.toLocaleString()}`);
    console.log(`🖱️ 총 클릭: ${testData.summary.totalClicks.toLocaleString()}\n`);
    
    console.log('🔗 사용 방법:');
    console.log(`1. 브라우저에서 파일 열기: ${filename}`);
    console.log('2. 다른 사람과 공유: 파일을 이메일이나 메신저로 전송');
    console.log('3. 클라우드 업로드: Google Drive, Dropbox 등에 업로드 후 링크 공유');
    console.log('\n📝 참고: 인터넷 연결이 있으면 차트가 정상 표시됩니다.');
    
  } catch (error) {
    console.error('❌ HTML 리포트 생성 실패:', error.message);
  }
}

// 리포트 생성 실행
saveHTMLReport();