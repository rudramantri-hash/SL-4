// Flakiness analysis utilities
export { FlakinessAnalyzer } from './utils/flakinessAnalyzer';

// Custom reporter
export { default as MCPReporter } from './reporters/mcpReporter';

// Main API functions
export async function runDeflakeAPI(options: {
  spec: string;
  headed?: boolean;
  retries?: number;
}) {
  console.log('🚀 Running Deflake API...');
  console.log('Options:', options);
  
  // This would integrate with Playwright test runner
  return {
    success: true,
    message: 'Tests completed',
    options
  };
}

// CLI entry point
if (require.main === module) {
  console.log('🔧 Deflake Framework');
  console.log('Use the CLI: npx deflake --help');
}
