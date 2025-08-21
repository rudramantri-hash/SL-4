export { MCP } from './core/mcp';
export type { Plan, Step, Target, SelectorCandidate } from './core/mcp';
export { MCPReporter } from './reporters/mcpReporter';

// Main API functions
export async function runDeflakeAPI(options: {
  spec: string;
  headed?: boolean;
  retries?: number;
  threshold?: number;
}) {
  console.log('🚀 Running Deflake API with MCP auto-healing...');
  console.log('Options:', options);
  
  // This would integrate with Playwright test runner
  return {
    success: true,
    message: 'Tests completed with MCP auto-healing',
    options
  };
}

export async function launchDeflakeUI() {
  console.log('🌐 Launching Deflake UI...');
  // This would launch a web interface for the MCP framework
  return {
    success: true,
    message: 'Deflake UI launched',
    url: 'http://localhost:3000'
  };
}

// CLI entry point
if (require.main === module) {
  console.log('🔧 Deflake MCP Framework');
  console.log('Use the CLI: npx deflake --help');
}
