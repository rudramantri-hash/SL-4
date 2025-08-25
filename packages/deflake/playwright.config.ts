import { defineConfig, devices } from '@playwright/test';

export default defineConfig({
  testDir: './tests',
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  
  // Enhanced retry configuration for flakiness detection
  retries: process.env.CI ? 3 : 2,
  workers: process.env.CI ? 1 : undefined,
  
  // Comprehensive reporter configuration for flakiness analysis
  reporter: [
    ['html', { 
      outputFolder: 'playwright-report',
      open: 'never'
    }],
    ['json', { 
      outputFile: 'test-results.json' 
    }],
    ['./src/reporters/mcpReporter.ts', { 
      outputFile: 'flakiness-report.json',
      enableFlakinessDetection: true,
      enableRootCauseAnalysis: true,
      enableSelectorStability: true,
      enablePatternDetection: true,
      enableTrendAnalysis: true
    }],
    ['list'] // Console output for immediate feedback
  ],
  
  // Enhanced test execution settings for flakiness detection
  use: {
    // Remove hardcoded baseURL - tests should specify full URLs
    trace: 'on-first-retry',
    screenshot: 'only-on-failure',  // Capture screenshots specifically when tests fail
    video: 'retain-on-failure',     // Record video only when tests fail
    headless: false,   // Run tests in headed mode to see browser windows
    
    // Additional settings for better flakiness detection
    actionTimeout: 10000,        // 10 seconds for actions
    navigationTimeout: 30000,    // 30 seconds for navigation
    
    // Enhanced logging for debugging flakiness
    launchOptions: {
      args: [
        '--disable-background-timer-throttling',
        '--disable-backgrounding-occluded-windows',
        '--disable-renderer-backgrounding'
      ]
    }
  },
  
  // Test timeout configuration
  timeout: 60000,                // 60 seconds per test
  expect: {
    timeout: 10000,              // 10 seconds for assertions
    toMatchSnapshot: {
      maxDiffPixels: 10,         // Allow minor visual differences
    },
  },
  
  // Global setup and teardown for flakiness detection
  globalSetup: './src/setup/global-setup.ts',
  globalTeardown: './src/setup/global-teardown.ts',
  
  // Multiple browser configurations for cross-browser flakiness detection
  projects: [
    {
      name: 'chromium',
      use: { 
        ...devices['Desktop Chrome'],
        // Additional Chrome-specific settings
        launchOptions: {
          args: [
            '--disable-background-timer-throttling',
            '--disable-backgrounding-occluded-windows',
            '--disable-renderer-backgrounding',
            '--disable-features=VizDisplayCompositor'
          ]
        }
      },
    },
    {
      name: 'firefox',
      use: { 
        ...devices['Desktop Firefox'],
        // Additional Firefox-specific settings
        launchOptions: {
          args: [
            '--disable-background-timer-throttling'
          ]
        }
      },
    },
    {
      name: 'webkit',
      use: { 
        ...devices['Desktop Safari'],
        // Additional Safari-specific settings
        launchOptions: {
          args: [
            '--disable-background-timer-throttling'
          ]
        }
      },
    },
  ],
  
  // Remove web server configuration - tests should target real websites
  
  // Environment-specific configurations
  ...(process.env.CI && {
    // CI-specific settings for more reliable execution
    retries: 3,
    workers: 1,
    use: {
      ...devices['Desktop Chrome'],
      launchOptions: {
        args: [
          '--disable-background-timer-throttling',
          '--disable-backgrounding-occluded-windows',
          '--disable-renderer-backgrounding',
          '--no-sandbox',
          '--disable-setuid-sandbox'
        ]
      }
    }
  }),
  
  // Flakiness detection specific configuration
  metadata: {
    flakinessDetection: {
      enabled: true,
      patternDetection: true,
      rootCauseAnalysis: true,
      selectorStability: true,
      trendAnalysis: true,
      correlationAnalysis: true,
      mlPatternDetection: true
    }
  }
});
