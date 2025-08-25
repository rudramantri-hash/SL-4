import { FullConfig } from '@playwright/test';

async function globalTeardown(config: FullConfig) {
  console.log('🧹 Global teardown for flakiness detection...');
  
  // Clean up test environment variables
  delete process.env.FLAKINESS_DETECTION_ENABLED;
  delete process.env.PATTERN_DETECTION_ENABLED;
  delete process.env.ROOT_CAUSE_ANALYSIS_ENABLED;
  
  // Generate final flakiness summary if reports exist
  try {
    const fs = require('fs');
    const path = require('path');
    
    const reportPath = path.join(process.cwd(), 'flakiness-report.json');
    if (fs.existsSync(reportPath)) {
      const report = JSON.parse(fs.readFileSync(reportPath, 'utf8'));
      console.log('📊 Final Flakiness Summary:');
      console.log(`   Total Tests: ${report.summary.totalTests}`);
      console.log(`   Flakiness Rate: ${(report.summary.flakinessRate * 100).toFixed(2)}%`);
      console.log(`   Stability Trend: ${report.summary.stabilityTrend}`);
      
      if (report.summary.flakinessRate > 0.1) {
        console.log('⚠️  High flakiness detected - review test stability');
      } else {
        console.log('✅ Test suite appears stable');
      }
    }
  } catch (error) {
    console.log('ℹ️  No flakiness report found for summary');
  }
  
  console.log('✅ Global teardown complete');
}

export default globalTeardown;
