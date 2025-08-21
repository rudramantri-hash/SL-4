import { Reporter, TestCase, TestResult } from '@playwright/test/reporter';
import * as fs from 'fs';
import * as path from 'path';

interface MCPReport {
  summary: {
    totalTests: number;
    passed: number;
    failed: number;
    flaky: number;
    autoHealed: number;
    averageSelectorScore: number;
  };
  tests: Array<{
    title: string;
    status: string;
    retries: number;
    autoHealed: boolean;
    selectorScores: Array<{
      target: string;
      method: string;
      score: number;
      fallbackUsed: boolean;
    }>;
    failureReason?: string;
    duration: number;
  }>;
  autoHealing: {
    totalAttempts: number;
    successful: number;
    failed: number;
    commonIssues: string[];
  };
  recommendations: string[];
}

class MCPReporter implements Reporter {
  private report: MCPReport;
  private outputFile: string;

  constructor(options: { outputFile?: string } = {}) {
    this.outputFile = options.outputFile || 'mcp-report.json';
    this.report = {
      summary: {
        totalTests: 0,
        passed: 0,
        failed: 0,
        flaky: 0,
        autoHealed: 0,
        averageSelectorScore: 0
      },
      tests: [],
      autoHealing: {
        totalAttempts: 0,
        successful: 0,
        failed: 0,
        commonIssues: []
      },
      recommendations: []
    };
  }

  onTestEnd(test: TestCase, result: TestResult) {
    const testInfo = {
      title: test.title,
      status: result.status,
      retries: result.retry || 0,
      autoHealed: this.detectAutoHealing(result),
      selectorScores: this.extractSelectorScores(result),
      failureReason: result.errors?.[0]?.message,
      duration: result.duration || 0
    };

    this.report.tests.push(testInfo);

    // Update summary
    this.report.summary.totalTests++;
    if (result.status === 'passed') {
      this.report.summary.passed++;
    } else if (result.status === 'failed') {
      this.report.summary.failed++;
    }

    if (result.retry && result.retry > 0) {
      this.report.summary.flaky++;
    }

    if (testInfo.autoHealed) {
      this.report.summary.autoHealed++;
    }
  }

  onEnd() {
    this.calculateSummary();
    this.generateRecommendations();
    this.writeReport();
    this.printSummary();
  }

  private detectAutoHealing(result: TestResult): boolean {
    // Look for MCP auto-healing indicators in console logs or errors
    const logs = result.stdout || '';
    return logs.includes('MCP: Auto-healing') || logs.includes('MCP: Auto-heal successful');
  }

  private extractSelectorScores(result: TestResult): Array<{
    target: string;
    method: string;
    score: number;
    fallbackUsed: boolean;
  }> {
    // Extract selector information from test output
    const logs = result.stdout || '';
    const selectorInfo: Array<{
      target: string;
      method: string;
      score: number;
      fallbackUsed: boolean;
    }> = [];

    // Parse MCP logs for selector information
    const mcpLogs = logs.match(/MCP: Grounded (\w+) to (\w+) \(score: ([\d.]+)\)/g);
    if (mcpLogs) {
      mcpLogs.forEach(log => {
        const match = log.match(/MCP: Grounded (\w+) to (\w+) \(score: ([\d.]+)\)/);
        if (match) {
          selectorInfo.push({
            target: match[1],
            method: match[2],
            score: parseFloat(match[3]),
            fallbackUsed: false
          });
        }
      });
    }

    return selectorInfo;
  }

  private calculateSummary() {
    if (this.report.tests.length === 0) return;

    // Calculate average selector score
    const allScores = this.report.tests.flatMap(t => t.selectorScores.map(s => s.score));
    this.report.summary.averageSelectorScore = allScores.length > 0 
      ? allScores.reduce((a, b) => a + b, 0) / allScores.length 
      : 0;

    // Calculate auto-healing stats
    this.report.autoHealing.totalAttempts = this.report.tests.filter(t => t.autoHealed).length;
    this.report.autoHealing.successful = this.report.tests.filter(t => t.autoHealed && t.status === 'passed').length;
    this.report.autoHealing.failed = this.report.autoHealing.totalAttempts - this.report.autoHealing.successful;
  }

  private generateRecommendations() {
    const recommendations: string[] = [];

    if (this.report.summary.averageSelectorScore < 0.8) {
      recommendations.push('Consider improving selector quality - current average score is below 0.8');
    }

    if (this.report.summary.flaky > this.report.summary.totalTests * 0.1) {
      recommendations.push('High flakiness detected - review test isolation and wait strategies');
    }

    if (this.report.autoHealing.failed > 0) {
      recommendations.push('Some auto-healing attempts failed - review fallback selector strategies');
    }

    if (this.report.summary.failed > 0) {
      recommendations.push('Failed tests detected - review error messages and selector strategies');
    }

    this.report.recommendations = recommendations;
  }

  private writeReport() {
    const outputDir = path.dirname(this.outputFile);
    if (!fs.existsSync(outputDir)) {
      fs.mkdirSync(outputDir, { recursive: true });
    }

    fs.writeFileSync(this.outputFile, JSON.stringify(this.report, null, 2));
    console.log(`\n📊 MCP Report written to: ${this.outputFile}`);
  }

  private printSummary() {
    console.log('\n🔍 MCP Auto-Healing Summary:');
    console.log(`Total Tests: ${this.report.summary.totalTests}`);
    console.log(`Passed: ${this.report.summary.passed}`);
    console.log(`Failed: ${this.report.summary.failed}`);
    console.log(`Flaky: ${this.report.summary.flaky}`);
    console.log(`Auto-Healed: ${this.report.summary.autoHealed}`);
    console.log(`Average Selector Score: ${this.report.summary.averageSelectorScore.toFixed(2)}`);
    
    if (this.report.recommendations.length > 0) {
      console.log('\n💡 Recommendations:');
      this.report.recommendations.forEach(rec => console.log(`- ${rec}`));
    }
  }
}

export default MCPReporter;
