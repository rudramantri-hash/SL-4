import { chromium, FullConfig } from '@playwright/test';

async function globalSetup(config: FullConfig) {
  console.log('🚀 Global setup for flakiness detection...');
  
  // Initialize flakiness detection environment
  const browser = await chromium.launch();
  const context = await browser.newContext();
  
  // Set up test environment variables
  process.env.FLAKINESS_DETECTION_ENABLED = 'true';
  process.env.PATTERN_DETECTION_ENABLED = 'true';
  process.env.ROOT_CAUSE_ANALYSIS_ENABLED = 'true';
  
  // Verify test environment is ready
  try {
    const page = await context.newPage();
    // Test with a real website to verify connectivity
    await page.goto('https://httpbin.org/status/200');
    await page.waitForLoadState('networkidle');
    console.log('✅ Test environment is ready and can access external websites');
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    console.warn('⚠️ Test environment connectivity check failed:', errorMessage);
  }
  
  await context.close();
  await browser.close();
  
  console.log('✅ Global setup complete');
}

export default globalSetup;
