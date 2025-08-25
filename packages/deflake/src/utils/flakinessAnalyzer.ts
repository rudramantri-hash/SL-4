import * as fs from 'fs';
import * as path from 'path';

interface TestResult {
  status: string;
  duration: number;
  retry?: number;
  errors?: Array<{
    message: string;
    location?: {
      file: string;
      line: number;
      column: number;
    };
  }>;
}

interface TestCase {
  title: string;
  file: string;
  line: number;
  column: number;
  results: TestResult[];
}

interface FlakinessReport {
  summary: {
    totalTests: number;
    passed: number;
    failed: number;
    flaky: number;
    successRate: number;
    averageDuration: number;
  };
  testResults: Array<{
    name: string;
    description: string;
    status: string;
    duration: string;
    browsers: string;
    selectorScore: number;
    consistency: string;
    retries: number;
    errorMessage?: string;
  }>;
  flakinessAnalysis: Array<{
    testName: string;
    flakinessType: string;
    rootCause: string;
    severity: string;
    recommendedAction: string;
  }>;
  recommendations: string[];
}

export class FlakinessAnalyzer {
  private testResults: any;
  private report: FlakinessReport;

  constructor() {
    this.report = {
      summary: {
        totalTests: 0,
        passed: 0,
        failed: 0,
        flaky: 0,
        successRate: 0,
        averageDuration: 0
      },
      testResults: [],
      flakinessAnalysis: [],
      recommendations: []
    };
  }

  async analyzeTestResults(filePath: string): Promise<FlakinessReport> {
    try {
      const data = fs.readFileSync(filePath, 'utf8');
      this.testResults = JSON.parse(data);
      
      this.analyzeResults();
      this.generateFlakinessAnalysis();
      this.generateRecommendations();
      
      return this.report;
    } catch (error) {
      console.error('Error reading test results:', error);
      throw error;
    }
  }

  private analyzeResults() {
    let totalDuration = 0;
    let testCount = 0;

    // Process each test suite
    this.testResults.suites?.forEach((suite: any) => {
      suite.specs?.forEach((spec: any) => {
        spec.tests?.forEach((test: any) => {
          const testResult = this.processTest(test);
          if (testResult) {
            this.report.testResults.push(testResult);
            
            // Update summary
            this.report.summary.totalTests++;
            totalDuration += testResult.duration;
            testCount++;
            
            if (testResult.status === 'passed') {
              this.report.summary.passed++;
            } else {
              this.report.summary.failed++;
            }
            
            if (testResult.retries > 0) {
              this.report.summary.flaky++;
            }
          }
        });
      });
    });

    // Calculate averages
    if (testCount > 0) {
      this.report.summary.averageDuration = totalDuration / testCount;
      this.report.summary.successRate = (this.report.summary.passed / this.report.summary.totalTests) * 100;
    }
  }

  private processTest(test: any) {
    if (!test.tests || test.tests.length === 0) return null;

    const firstResult = test.tests[0];
    const lastResult = test.tests[test.tests.length - 1];
    
    const status = lastResult.results?.[0]?.status || 'unknown';
    const duration = lastResult.results?.[0]?.duration || 0;
    const retries = test.tests.length - 1;
    
    // Determine if test is flaky
    let finalStatus = status;
    if (retries > 0 && status === 'passed') {
      finalStatus = 'flaky';
    }

    // Calculate selector score based on test complexity and stability
    const selectorScore = this.calculateSelectorScore(test, lastResult);
    
    // Determine consistency
    const consistency = this.determineConsistency(test, lastResult);

    // Get error message if failed
    const errorMessage = lastResult.results?.[0]?.errors?.[0]?.message;

    return {
      name: test.title,
      description: this.generateDescription(test.title),
      status: finalStatus,
      duration: this.formatDuration(duration),
      browsers: this.countBrowsers(test),
      selectorScore,
      consistency,
      retries,
      errorMessage
    };
  }

  private calculateSelectorScore(test: any, result: any): number {
    let score = 10; // Start with perfect score
    
    // Deduct points for failures
    if (result.results?.[0]?.status === 'failed') {
      score -= 3;
    }
    
    // Deduct points for retries (flakiness)
    if (test.tests.length > 1) {
      score -= (test.tests.length - 1) * 1.5;
    }
    
    // Deduct points for complex selectors (estimated)
    if (test.title.toLowerCase().includes('search') || test.title.toLowerCase().includes('cart')) {
      score -= 1; // These typically use complex selectors
    }
    
    return Math.max(0, Math.round(score * 10) / 10);
  }

  private determineConsistency(test: any, result: any): string {
    if (test.tests.length === 1 && result.results?.[0]?.status === 'passed') {
      return '✅ Consistent';
    } else if (test.tests.length > 1 && result.results?.[0]?.status === 'passed') {
      return '⚠️ Flaky but Passed';
    } else if (result.results?.[0]?.status === 'failed') {
      return '❌ Broken';
    } else {
      return '❓ Unknown';
    }
  }

  private countBrowsers(test: any): string {
    const browserCount = test.tests.length;
    return `${browserCount} browser${browserCount !== 1 ? 's' : ''}`;
  }

  private formatDuration(duration: number): string {
    if (duration < 1000) {
      return `${Math.round(duration)}ms`;
    } else {
      return `${(duration / 1000).toFixed(1)}s`;
    }
  }

  private generateDescription(title: string): string {
    const descriptions: { [key: string]: string } = {
      'search': 'Search for products',
      'cart': 'Add item to cart',
      'navigate': 'Navigate categories',
      'login': 'User authentication',
      'category': 'Category navigation',
      'product': 'Product interaction',
      'amazon': 'Amazon website functionality'
    };

    for (const [key, desc] of Object.entries(descriptions)) {
      if (title.toLowerCase().includes(key)) {
        return desc;
      }
    }
    
    return 'Test functionality';
  }

  private generateFlakinessAnalysis() {
    this.report.testResults.forEach(test => {
      const analysis = this.analyzeFlakiness(test);
      if (analysis) {
        this.report.flakinessAnalysis.push(analysis);
      }
    });
  }

  private analyzeFlakiness(test: any) {
    if (test.status === 'passed' && test.retries === 0) {
      return null; // No flakiness to analyze
    }

    let flakinessType = 'Unknown';
    let rootCause = 'Unknown issue';
    let severity = 'Low';
    let recommendedAction = 'Investigate further';

    if (test.status === 'failed') {
      flakinessType = 'Test Failure';
      severity = 'Critical';
      
      if (test.errorMessage?.includes('selector') || test.errorMessage?.includes('locator')) {
        rootCause = 'Selector not found or changed';
        recommendedAction = 'Update selectors or use more robust locators';
      } else if (test.errorMessage?.includes('timeout')) {
        rootCause = 'Element timeout or slow loading';
        recommendedAction = 'Increase timeouts or add proper waits';
      } else if (test.errorMessage?.includes('network')) {
        rootCause = 'Network issues or API failures';
        recommendedAction = 'Check network stability and API endpoints';
      } else {
        rootCause = 'Test logic or environment issue';
        recommendedAction = 'Review test logic and check test environment';
      }
    } else if (test.status === 'flaky') {
      flakinessType = 'Intermittent Failure';
      severity = 'Medium';
      rootCause = 'Test passes sometimes, fails others';
      recommendedAction = 'Add retry logic or investigate root cause';
    }

    return {
      testName: test.name,
      flakinessType,
      rootCause,
      severity,
      recommendedAction
    };
  }

  private generateRecommendations() {
    const recommendations = [];

    if (this.report.summary.successRate < 50) {
      recommendations.push('Critical: Test suite has high failure rate. Review test environment and selectors.');
    } else if (this.report.summary.successRate < 80) {
      recommendations.push('Warning: Test suite has moderate failure rate. Consider improving test stability.');
    }

    if (this.report.summary.flaky > 0) {
      recommendations.push('Flaky tests detected. Implement retry mechanisms and investigate root causes.');
    }

    if (this.report.summary.averageDuration > 10000) {
      recommendations.push('Tests are running slowly. Optimize test performance and reduce unnecessary waits.');
    }

    if (this.report.testResults.some(t => t.selectorScore < 5)) {
      recommendations.push('Low selector scores detected. Improve selector quality and stability.');
    }

    if (recommendations.length === 0) {
      recommendations.push('Test suite is performing well. Continue monitoring for any degradation.');
    }

    this.report.recommendations = recommendations;
  }

  async generateHTMLReport(outputPath: string): Promise<void> {
    const html = this.generateHTML();
    fs.writeFileSync(outputPath, html, 'utf8');
  }

  private generateHTML(): string {
    const statusBadge = (status: string) => {
      const statusClass = status === 'passed' ? 'status-passed' : 
                         status === 'flaky' ? 'status-flaky' : 'status-failed';
      const statusText = status === 'passed' ? 'Passed' : 
                        status === 'flaky' ? 'Flaky' : 'Failed';
      return `<span class="status-badge ${statusClass}">${statusText}</span>`;
    };

    const selectorScoreBadge = (score: number) => {
      let className = 'excellent';
      if (score < 5) className = 'poor';
      else if (score < 8) className = 'good';
      
      return `<span class="selector-score ${className}">${score}/10</span>`;
    };

    const severityColor = (severity: string) => {
      switch (severity.toLowerCase()) {
        case 'critical': return '#dc3545';
        case 'high': return '#fd7e14';
        case 'medium': return '#ffc107';
        default: return '#28a745';
      }
    };

    return `<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Dynamic Flakiness Report - Generated Analysis</title>
    <style>
        * {
            margin: 0;
            padding: 0;
            box-sizing: border-box;
        }

        body {
            font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;
            background: #ffffff;
            color: #333333;
            line-height: 1.6;
        }

        .container {
            max-width: 1400px;
            margin: 0 auto;
            padding: 20px;
        }

        .header {
            text-align: center;
            margin-bottom: 40px;
            padding: 30px;
            background: linear-gradient(135deg, #f8f9fa 0%, #e9ecef 100%);
            border-radius: 15px;
            border: 2px solid #007bff;
        }

        .header h1 {
            font-size: 3rem;
            margin-bottom: 10px;
            background: linear-gradient(45deg, #007bff, #0056b3);
            -webkit-background-clip: text;
            -webkit-text-fill-color: transparent;
            background-clip: text;
        }

        .header p {
            font-size: 1.2rem;
            color: #6c757d;
        }

        .summary-stats {
            display: grid;
            grid-template-columns: repeat(auto-fit, minmax(250px, 1fr));
            gap: 20px;
            margin-bottom: 40px;
        }

        .stat-card {
            background: #f8f9fa;
            padding: 25px;
            border-radius: 12px;
            border: 1px solid #dee2e6;
            text-align: center;
            transition: transform 0.3s ease, box-shadow 0.3s ease;
        }

        .stat-card:hover {
            transform: translateY(-5px);
            box-shadow: 0 10px 25px rgba(0, 0, 0, 0.1);
        }

        .stat-number {
            font-size: 2.5rem;
            font-weight: bold;
            margin-bottom: 10px;
        }

        .stat-label {
            color: #6c757d;
            font-size: 1rem;
        }

        .passed { color: #28a745; }
        .failed { color: #dc3545; }
        .flaky { color: #fd7e14; }
        .total { color: #007bff; }

        .test-results {
            background: #f8f9fa;
            border-radius: 12px;
            padding: 30px;
            margin-bottom: 40px;
            border: 1px solid #dee2e6;
        }

        .test-results h2 {
            color: #495057;
            margin-bottom: 25px;
            font-size: 1.8rem;
        }

        .test-table {
            width: 100%;
            border-collapse: collapse;
            margin-top: 20px;
        }

        .test-table th,
        .test-table td {
            padding: 15px;
            text-align: left;
            border-bottom: 1px solid #dee2e6;
        }

        .test-table th {
            background: #e9ecef;
            color: #495057;
            font-weight: 600;
        }

        .test-table tr:hover {
            background: #e9ecef;
        }

        .status-badge {
            padding: 6px 12px;
            border-radius: 20px;
            font-size: 0.85rem;
            font-weight: 600;
            text-transform: uppercase;
        }

        .status-passed {
            background: #d4edda;
            color: #155724;
        }

        .status-failed {
            background: #f8d7da;
            color: #721c24;
        }

        .status-flaky {
            background: #fff3cd;
            color: #856404;
        }

        .selector-score {
            padding: 6px 12px;
            border-radius: 20px;
            font-size: 0.85rem;
            font-weight: 600;
            text-transform: uppercase;
        }

        .selector-score.excellent {
            background: #d4edda;
            color: #155724;
        }

        .selector-score.good {
            background: #fff3cd;
            color: #856404;
        }

        .selector-score.poor {
            background: #f8d7da;
            color: #721c24;
        }

        .flakiness-reasons {
            background: #f8f9fa;
            border-radius: 12px;
            padding: 30px;
            margin-bottom: 40px;
            border: 1px solid #dee2e6;
        }

        .flakiness-reasons h2 {
            color: #495057;
            margin-bottom: 25px;
            font-size: 1.8rem;
        }

        .reason-table {
            width: 100%;
            border-collapse: collapse;
        }

        .reason-table th,
        .reason-table td {
            padding: 15px;
            text-align: left;
            border-bottom: 1px solid #dee2e6;
        }

        .reason-table th {
            background: #e9ecef;
            color: #495057;
            font-weight: 600;
        }

        .recommendations {
            background: #f8f9fa;
            border-radius: 12px;
            padding: 30px;
            margin-bottom: 40px;
            border: 1px solid #dee2e6;
        }

        .recommendations h2 {
            color: #495057;
            margin-bottom: 25px;
            font-size: 1.8rem;
        }

        .recommendation-item {
            background: #ffffff;
            padding: 20px;
            margin: 15px 0;
            border-radius: 8px;
            border-left: 4px solid #007bff;
        }

        .recommendation-item h4 {
            color: #007bff;
            margin-bottom: 10px;
        }

        .recommendation-item p {
            color: #6c757d;
        }

        .footer {
            text-align: center;
            padding: 30px;
            color: #6c757d;
            border-top: 1px solid #dee2e6;
            margin-top: 40px;
        }

        .export-section {
            text-align: center;
            margin: 30px 0;
        }

        .export-btn {
            background: linear-gradient(45deg, #007bff, #0056b3);
            color: white;
            border: none;
            padding: 15px 30px;
            border-radius: 8px;
            font-size: 1.1rem;
            cursor: pointer;
            transition: transform 0.3s ease;
        }

        .export-btn:hover {
            transform: translateY(-2px);
        }

        .generation-info {
            background: #e9ecef;
            padding: 20px;
            border-radius: 8px;
            margin-bottom: 30px;
            border: 1px solid #dee2e6;
        }

        .generation-info h3 {
            color: #495057;
            margin-bottom: 15px;
        }

        .generation-info p {
            color: #6c757d;
            margin-bottom: 5px;
        }

        @media (max-width: 768px) {
            .container {
                padding: 10px;
            }
            
            .header h1 {
                font-size: 2rem;
            }
            
            .test-table {
                font-size: 0.9rem;
            }
        }
    </style>
</head>
<body>
    <div class="container">
        <div class="header">
            <h1>🔍 Dynamic Flakiness Report</h1>
            <p>Automatically Generated from Test Results - Real-Time Analysis</p>
            <p>Generated on: <span id="generation-time"></span></p>
        </div>

        <div class="generation-info">
            <h3>📊 Report Generation Details</h3>
            <p><strong>Source File:</strong> test-results.json</p>
            <p><strong>Analysis Type:</strong> Dynamic Flakiness Detection</p>
            <p><strong>Total Test Executions:</strong> ${this.report.summary.totalTests}</p>
            <p><strong>Success Rate:</strong> ${this.report.summary.successRate.toFixed(1)}%</p>
        </div>

        <div class="summary-stats">
            <div class="stat-card">
                <div class="stat-number total">${this.report.summary.totalTests}</div>
                <div class="stat-label">Total Tests</div>
                <small style="color: #6c757d;">(All executions)</small>
            </div>
            <div class="stat-card">
                <div class="stat-number passed">${this.report.summary.passed}</div>
                <div class="stat-label">Passed Tests</div>
                <small style="color: #6c757d;">(${this.report.summary.successRate.toFixed(1)}% success rate)</small>
            </div>
            <div class="stat-card">
                <div class="stat-number failed">${this.report.summary.failed}</div>
                <div class="stat-label">Failed Tests</div>
                <small style="color: #6c757d;">(${this.report.summary.failed} failures)</small>
            </div>
            <div class="stat-card">
                <div class="stat-number flaky">${this.report.summary.flaky}</div>
                <div class="stat-label">Flaky Tests</div>
                <small style="color: #6c757d;">(${this.report.summary.flaky} flaky)</small>
            </div>
        </div>

        <div class="test-results">
            <h2>📊 Test Results Analysis</h2>
            <table class="test-table">
                <thead>
                    <tr>
                        <th>Test Name</th>
                        <th>Description</th>
                        <th>Status</th>
                        <th>Duration</th>
                        <th>Browsers</th>
                        <th>Selector Score</th>
                        <th>Consistency</th>
                        <th>Retries</th>
                    </tr>
                </thead>
                <tbody>
                    ${this.report.testResults.map(test => `
                        <tr>
                            <td>${test.name}</td>
                            <td>${test.description}</td>
                            <td>${statusBadge(test.status)}</td>
                            <td>${test.duration}</td>
                            <td>${test.browsers}</td>
                            <td>${selectorScoreBadge(test.selectorScore)}</td>
                            <td>${test.consistency}</td>
                            <td>${test.retries}</td>
                        </tr>
                    `).join('')}
                </tbody>
            </table>
        </div>

        ${this.report.flakinessAnalysis.length > 0 ? `
        <div class="flakiness-reasons">
            <h2>🚨 Flakiness Analysis & Root Causes</h2>
            <table class="reason-table">
                <thead>
                    <tr>
                        <th>Test Name</th>
                        <th>Flakiness Type</th>
                        <th>Root Cause</th>
                        <th>Severity</th>
                        <th>Recommended Action</th>
                    </tr>
                </thead>
                <tbody>
                    ${this.report.flakinessAnalysis.map(analysis => `
                        <tr>
                            <td>${analysis.testName}</td>
                            <td>${analysis.flakinessType}</td>
                            <td>${analysis.rootCause}</td>
                            <td style="color: ${severityColor(analysis.severity)};">${analysis.severity}</td>
                            <td>${analysis.recommendedAction}</td>
                        </tr>
                    `).join('')}
                </tbody>
            </table>
        </div>
        ` : ''}

        <div class="recommendations">
            <h2>💡 Recommendations</h2>
            ${this.report.recommendations.map(rec => `
                <div class="recommendation-item">
                    <h4>💡 Recommendation</h4>
                    <p>${rec}</p>
                </div>
            `).join('')}
        </div>

        <div class="export-section">
            <button class="export-btn" onclick="exportToPDF()">📄 Export to PDF</button>
        </div>

        <div class="footer">
            <p>Generated by Dynamic Flakiness Analyzer</p>
            <p>Real-Time Test Results Analysis</p>
        </div>
    </div>

    <script>
        // Set generation time
        document.getElementById('generation-time').textContent = new Date().toLocaleString();

        // Export to PDF functionality
        function exportToPDF() {
            window.print();
        }

        // Add interactive features
        document.addEventListener('DOMContentLoaded', function() {
            // Add click handlers for test rows
            const testRows = document.querySelectorAll('tbody tr');
            testRows.forEach(row => {
                row.addEventListener('click', function() {
                    // Toggle selection
                    this.classList.toggle('selected');
                });
            });

            // Add hover effects
            const statCards = document.querySelectorAll('.stat-card');
            statCards.forEach(card => {
                card.addEventListener('mouseenter', function() {
                    this.style.transform = 'translateY(-5px) scale(1.02)';
                });
                card.addEventListener('mouseleave', function() {
                    this.style.transform = 'translateY(0) scale(1)';
                });
            });
        });
    </script>
</body>
</html>`;
  }
}
