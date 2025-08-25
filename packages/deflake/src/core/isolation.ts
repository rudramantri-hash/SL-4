import { BrowserContext, Page, Browser } from '@playwright/test';
import * as fs from 'fs';
import * as path from 'path';

export interface IsolationOptions {
  clearStorage?: boolean;
  clearCookies?: boolean;
  clearLocalStorage?: boolean;
  clearSessionStorage?: boolean;
  userAgent?: string;
  viewport?: { width: number; height: number };
  locale?: string;
  timezoneId?: string;
  permissions?: string[];
  extraHTTPHeaders?: Record<string, string>;
  allowedDomains?: string[]; // New option for allowed domains
}

export interface TestContext {
  context: BrowserContext;
  page: Page;
  testId: string;
  startTime: number;
}

/**
 * Test isolation utilities for preventing cross-test contamination
 * Ensures each test runs in a clean, isolated environment
 */
export class IsolationUtils {
  private static readonly STORAGE_STATE_DIR = './test-storage-states';
  private static readonly ISOLATION_DATA_DIR = './test-isolation-data';

  /**
   * Create a fresh browser context with isolation settings
   */
  static async createIsolatedContext(
    browser: Browser,
    options: IsolationOptions = {}
  ): Promise<TestContext> {
    const testId = this.generateTestId();
    const startTime = Date.now();

    // Create context with isolation settings
    const context = await browser.newContext({
      userAgent: options.userAgent,
      viewport: options.viewport || { width: 1280, height: 720 },
      locale: options.locale || 'en-US',
      timezoneId: options.timezoneId || 'America/New_York',
      permissions: options.permissions || [],
      extraHTTPHeaders: options.extraHTTPHeaders || {},
      
      // Isolation settings
      acceptDownloads: false,
      ignoreHTTPSErrors: true,
      bypassCSP: true,
      
      // Storage isolation
      storageState: undefined, // Start with clean storage
    });

    // Create a new page
    const page = await context.newPage();

    // Set up isolation
    await this.setupContextIsolation(context, page, options);

    console.log(`🔒 Created isolated context for test: ${testId}`);

    return {
      context,
      page,
      testId,
      startTime
    };
  }

  /**
   * Set up context isolation to prevent cross-test contamination
   */
  private static async setupContextIsolation(
    context: BrowserContext,
    page: Page,
    options: IsolationOptions
  ): Promise<void> {
    // Clear all storage if requested
    if (options.clearStorage !== false) {
      await this.clearAllStorage(context, page);
    }

    // Clear cookies if requested
    if (options.clearCookies !== false) {
      await context.clearCookies();
    }

    // Clear localStorage if requested
    if (options.clearLocalStorage !== false) {
      await page.evaluate(() => {
        localStorage.clear();
        sessionStorage.clear();
      });
    }

    // Set up storage event listeners to prevent cross-tab communication
    await page.addInitScript(() => {
      // Override storage methods to prevent cross-tab communication
      const originalSetItem = localStorage.setItem;
      const originalRemoveItem = localStorage.removeItem;
      const originalClear = localStorage.clear;

      localStorage.setItem = function(key: string, value: string) {
        // Only allow storage operations from the current test context
        if (window.testContextId === window.currentTestId) {
          return originalSetItem.call(this, key, value);
        }
        return;
      };

      localStorage.removeItem = function(key: string) {
        if (window.testContextId === window.currentTestId) {
          return originalRemoveItem.call(this, key);
        }
        return;
      };

      localStorage.clear = function() {
        if (window.testContextId === window.currentTestId) {
          return originalClear.call(this);
        }
        return;
      };

      // Set current test context ID
      window.currentTestId = Date.now().toString();
      window.testContextId = window.currentTestId;
    });

    // Block third-party requests that could cause cross-test contamination
    await page.route('**/*', (route) => {
      const url = route.request().url();
      const urlObj = new URL(url);
      const currentDomain = urlObj.hostname;
      
      // Allow requests from allowed domains or current page domain
      const allowedDomains = options.allowedDomains || [];
      const isAllowedDomain = allowedDomains.some(domain => 
        currentDomain === domain || currentDomain.endsWith(`.${domain}`)
      );
      
      if (isAllowedDomain) {
        route.continue();
        return;
      }
      
      // Block external requests that could cause flakiness
      if (url.includes('analytics') || url.includes('tracking') || url.includes('ads')) {
        route.abort();
        return;
      }
      
      // Continue with other requests
      route.continue();
    });

    console.log(`🔒 Context isolation setup complete`);
  }

  /**
   * Clear all storage types to ensure clean state
   */
  private static async clearAllStorage(context: BrowserContext, page: Page): Promise<void> {
    // Clear cookies
    await context.clearCookies();

    // Clear localStorage and sessionStorage
    await page.evaluate(() => {
      localStorage.clear();
      sessionStorage.clear();
      
      // Clear IndexedDB
      if ('indexedDB' in window) {
        indexedDB.databases().then(databases => {
          databases.forEach(db => {
            if (db.name) {
              indexedDB.deleteDatabase(db.name);
            }
          });
        });
      }
      
      // Clear service worker registrations
      if ('serviceWorker' in navigator) {
        navigator.serviceWorker.getRegistrations().then(registrations => {
          registrations.forEach(registration => {
            registration.unregister();
          });
        });
      }
    });

    // Clear cache storage
    await page.evaluate(async () => {
      if ('caches' in window) {
        const cacheNames = await caches.keys();
        await Promise.all(cacheNames.map(name => caches.delete(name)));
      }
    });

    console.log(`🧹 All storage cleared for isolation`);
  }

  /**
   * Save storage state for debugging or reuse
   */
  static async saveStorageState(context: BrowserContext, testId: string): Promise<void> {
    const storageState = await context.storageState();
    const filePath = path.join(this.STORAGE_STATE_DIR, `${testId}-storage.json`);
    
    // Ensure directory exists
    if (!fs.existsSync(this.STORAGE_STATE_DIR)) {
      fs.mkdirSync(this.STORAGE_STATE_DIR, { recursive: true });
    }
    
    fs.writeFileSync(filePath, JSON.stringify(storageState, null, 2));
    console.log(`💾 Storage state saved: ${filePath}`);
  }

  /**
   * Load storage state for debugging or reuse
   */
  static async loadStorageState(context: BrowserContext, testId: string): Promise<void> {
    const filePath = path.join(this.STORAGE_STATE_DIR, `${testId}-storage.json`);
    
    if (fs.existsSync(filePath)) {
      const storageState = JSON.parse(fs.readFileSync(filePath, 'utf8'));
      await context.addInitScript((state) => {
        // Restore storage state
        Object.entries(state.localStorage).forEach(([key, value]) => {
          localStorage.setItem(key, value as string);
        });
        
        Object.entries(state.sessionStorage).forEach(([key, value]) => {
          sessionStorage.setItem(key, value as string);
        });
        
        // Restore cookies
        document.cookie = state.cookies.map((cookie: any) => 
          `${cookie.name}=${cookie.value}; path=${cookie.path}; domain=${cookie.domain}`
        ).join('; ');
      }, storageState);
      
      console.log(`📂 Storage state loaded: ${filePath}`);
    }
  }

  /**
   * Clean up isolated context and resources
   */
  static async cleanupContext(testContext: TestContext): Promise<void> {
    const { context, page, testId, startTime } = testContext;
    const duration = Date.now() - startTime;

    try {
      // Close page and context
      await page.close();
      await context.close();
      
      console.log(`🧹 Cleaned up context for test: ${testId} (duration: ${duration}ms)`);
    } catch (error) {
      console.error(`❌ Error cleaning up context for test: ${testId}:`, error);
    }
  }

  /**
   * Generate unique test identifier
   */
  private static generateTestId(): string {
    const timestamp = Date.now();
    const random = Math.random().toString(36).substring(2, 8);
    return `test-${timestamp}-${random}`;
  }

  /**
   * Create isolated test data directory
   */
  static createIsolatedDataDir(testId: string): string {
    const dataDir = path.join(this.ISOLATION_DATA_DIR, testId);
    
    if (!fs.existsSync(dataDir)) {
      fs.mkdirSync(dataDir, { recursive: true });
    }
    
    return dataDir;
  }

  /**
   * Clean up isolated test data
   */
  static cleanupIsolatedData(testId: string): void {
    const dataDir = path.join(this.ISOLATION_DATA_DIR, testId);
    
    if (fs.existsSync(dataDir)) {
      fs.rmSync(dataDir, { recursive: true, force: true });
      console.log(`🗑️ Cleaned up isolated data for test: ${testId}`);
    }
  }

  /**
   * Reset all test isolation data
   */
  static resetAllIsolationData(): void {
    if (fs.existsSync(this.ISOLATION_DATA_DIR)) {
      fs.rmSync(this.ISOLATION_DATA_DIR, { recursive: true, force: true });
      console.log(`🗑️ Reset all test isolation data`);
    }
    
    if (fs.existsSync(this.STORAGE_STATE_DIR)) {
      fs.rmSync(this.STORAGE_STATE_DIR, { recursive: true, force: true });
      console.log(`🗑️ Reset all storage states`);
    }
  }

  /**
   * Get isolation statistics
   */
  static getIsolationStats(): {
    activeContexts: number;
    storageStates: number;
    isolationDataDirs: number;
  } {
    const storageStates = fs.existsSync(this.STORAGE_STATE_DIR) 
      ? fs.readdirSync(this.STORAGE_STATE_DIR).length 
      : 0;
    
    const isolationDataDirs = fs.existsSync(this.ISOLATION_DATA_DIR)
      ? fs.readdirSync(this.ISOLATION_DATA_DIR).length
      : 0;

    return {
      activeContexts: 0, // This would need to be tracked globally
      storageStates,
      isolationDataDirs
    };
  }
}

// Export convenience functions
export const createIsolatedContext = IsolationUtils.createIsolatedContext.bind(IsolationUtils);
export const cleanupContext = IsolationUtils.cleanupContext.bind(IsolationUtils);
export const saveStorageState = IsolationUtils.saveStorageState.bind(IsolationUtils);
export const loadStorageState = IsolationUtils.loadStorageState.bind(IsolationUtils);
export const resetAllIsolationData = IsolationUtils.resetAllIsolationData.bind(IsolationUtils);
export const getIsolationStats = IsolationUtils.getIsolationStats.bind(IsolationUtils);
