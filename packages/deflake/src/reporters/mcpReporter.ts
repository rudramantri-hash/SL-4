import { Reporter, TestCase, TestResult } from '@playwright/test/reporter';
import * as fs from 'fs';
import * as path from 'path';

interface MCPReport {
  summary: {
    totalTests: number;
    passed: number;
    failed: number;
    flaky: number;
    averageSelectorScore: number;
  };
  tests: Array<{
    title: string;
    status: string;
    retries: number;
    selectorScores: Array<{
      target: string;
      method: string;
      score: number;
      fallbackUsed: boolean;
    }>;
    failureReason?: string;
    duration: number;
  }>;
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
        averageSelectorScore: 0
      },
      tests: [],
      recommendations: []
    };
  }

  onTestEnd(test: TestCase, result: TestResult) {
    const testInfo = {
      title: test.title,
      status: result.status,
      retries: result.retry || 0,
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
  }

  onEnd() {
    this.calculateSummary();
    this.generateRecommendations();
    this.writeReport();
    this.printSummary();
  }

  private extractSelectorScores(result: TestResult): Array<{
    target: string;
    method: string;
    score: number;
    fallbackUsed: boolean;
  }> {
    const selectorInfo: Array<{
      target: string;
      method: string;
      score: number;
      fallbackUsed: boolean;
    }> = [];

    // Extract selector information from error messages
    if (result.errors && result.errors.length > 0) {
      result.errors.forEach(error => {
        if (error.message) {
          // Extract selector from error message - handle both formats
          let selectorMatch = error.message.match(/Locator:\s*locator\(['"`]([^'"`]+)['"`]\)/);
          
          if (!selectorMatch) {
            // Try alternative format: "locator('[selector]')" - this handles square brackets
            selectorMatch = error.message.match(/locator\(['"`]([^'"`]+)['"`]\)/);
          }
          
          if (selectorMatch) {
            const selector = selectorMatch[1];
            const score = this.calculateSelectorScoreFromSelector(selector, result.status);
            
            selectorInfo.push({
              target: selector,
              method: this.determineSelectorMethod(selector),
              score: score,
              fallbackUsed: false
            });
          }
        }
      });
    }

    // If no selectors found in errors, try to extract from stdout
    if (selectorInfo.length === 0 && result.stdout) {
      const logs = String(result.stdout);
      const selectorMatches = logs.match(/locator\(['"`]([^'"`]+)['"`]\)/g);
      
      if (selectorMatches) {
        selectorMatches.forEach(match => {
          const selector = match.replace(/locator\(['"`]/, '').replace(/['"`]\)/, '');
          const score = this.calculateSelectorScoreFromSelector(selector, result.status);
          
          selectorInfo.push({
            target: selector,
            method: this.determineSelectorMethod(selector),
            score: score,
            fallbackUsed: false
          });
        });
      }
    }

    return selectorInfo;
  }

  private calculateSelectorScoreFromSelector(selector: string, status: string): number {
    let score = 10; // Start with perfect score
    
    // Deduct points for failed tests
    if (status === 'failed') {
      score -= 3;
    }
    
    // Deduct points for complex selectors
    if (selector.includes(' ')) {
      score -= 1; // Compound selectors are less reliable
    }
    
    if (selector.includes('>')) {
      score -= 1; // Direct child selectors can be fragile
    }
    
    if (selector.includes('[') && selector.includes(']')) {
      score -= 0.5; // Attribute selectors can be less stable
    }
    
    // Deduct points for very long selectors
    if (selector.length > 100) {
      score -= 1;
    }
    
    // Bonus points for good selector practices
    if (selector.includes('data-testid')) {
      score += 1; // Test IDs are very reliable
    }
    
    if (selector.includes('id=')) {
      score += 0.5; // IDs are generally stable
    }
    
    // Ensure score is between 0 and 10
    return Math.max(0, Math.min(10, score));
  }

  private determineSelectorMethod(selector: string): string {
    if (selector.includes('data-testid')) return 'data-testid';
    if (selector.includes('id=')) return 'id';
    if (selector.includes('class=')) return 'class';
    if (selector.includes('[') && selector.includes(']')) return 'attribute';
    if (selector.includes('>')) return 'direct-child';
    if (selector.includes(' ')) return 'descendant';
    if (selector.includes('::')) return 'pseudo-element';
    if (selector.includes(':')) return 'pseudo-class';
    return 'element';
  }

  private calculateSummary() {
    if (this.report.tests.length === 0) return;

    // Calculate average selector score
    const allScores = this.report.tests.flatMap(t => t.selectorScores.map(s => s.score));
    this.report.summary.averageSelectorScore = allScores.length > 0 
      ? allScores.reduce((a, b) => a + b, 0) / allScores.length 
      : 0;
  }

  private generateRecommendations() {
    const recommendations: string[] = [];

    if (this.report.summary.averageSelectorScore < 0.8) {
      recommendations.push('Consider improving selector quality - current average score is below 0.8');
    }

    if (this.report.summary.flaky > this.report.summary.totalTests * 0.1) {
      recommendations.push('High flakiness detected - review test isolation and wait strategies');
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
    console.log('\n🔍 MCP Summary:');
    console.log(`Total Tests: ${this.report.summary.totalTests}`);
    console.log(`Passed: ${this.report.summary.passed}`);
    console.log(`Failed: ${this.report.summary.failed}`);
    console.log(`Flaky: ${this.report.summary.flaky}`);
    console.log(`Average Selector Score: ${this.report.summary.averageSelectorScore.toFixed(2)}`);
    
    if (this.report.recommendations.length > 0) {
      console.log('\n💡 Recommendations:');
      this.report.recommendations.forEach(rec => console.log(`- ${rec}`));
    }
  }
}

export default MCPReporter;
