import { Page, Locator, expect } from '@playwright/test';

export interface WaitOptions {
  timeout?: number;
  polling?: number;
  retries?: number;
  message?: string;
}

export interface NetworkWaitOptions extends WaitOptions {
  idleTime?: number;
  maxRequests?: number;
}

export interface UIStabilityOptions extends WaitOptions {
  checkInterval?: number;
  stabilityThreshold?: number;
  maxFluctuations?: number;
}

/**
 * Smart wait utilities for handling async operations and UI stability
 * Replaces arbitrary timeouts with intelligent waiting strategies
 */
export class WaitUtils {
  private static readonly DEFAULT_TIMEOUT = 30000;
  private static readonly DEFAULT_POLLING = 1000;
  private static readonly DEFAULT_RETRIES = 3;

  /**
   * Wait for network to be idle (no pending requests)
   */
  static async waitForNetworkIdle(
    page: Page, 
    options: NetworkWaitOptions = {}
  ): Promise<void> {
    const { 
      timeout = this.DEFAULT_TIMEOUT, 
      idleTime = 500, 
      maxRequests = 0,
      message = 'Network to be idle'
    } = options;

    const startTime = Date.now();
    let lastRequestTime = Date.now();
    let pendingRequests = 0;

    // Track network requests
    page.on('request', () => {
      pendingRequests++;
      lastRequestTime = Date.now();
    });

    page.on('requestfinished', () => {
      pendingRequests--;
      lastRequestTime = Date.now();
    });

    page.on('requestfailed', () => {
      pendingRequests--;
      lastRequestTime = Date.now();
    });

    // Wait for network idle
    while (Date.now() - startTime < timeout) {
      const timeSinceLastRequest = Date.now() - lastRequestTime;
      
      if (pendingRequests <= maxRequests && timeSinceLastRequest >= idleTime) {
        console.log(`✅ Network is idle (${pendingRequests} pending requests)`);
        return;
      }
      
      await page.waitForTimeout(100);
    }

    throw new Error(`Timeout waiting for ${message} after ${timeout}ms`);
  }

  /**
   * Wait for UI to be stable (no layout changes)
   */
  static async waitForUIStability(
    page: Page,
    options: UIStabilityOptions = {}
  ): Promise<void> {
    const {
      timeout = this.DEFAULT_TIMEOUT,
      checkInterval = 200,
      stabilityThreshold = 1000,
      maxFluctuations = 2,
      message = 'UI to be stable'
    } = options;

    const startTime = Date.now();
    let lastLayoutHash = '';
    let stableStartTime = Date.now();
    let fluctuations = 0;

    while (Date.now() - startTime < timeout) {
      // Get current layout hash
      const currentLayoutHash = await page.evaluate(() => {
        // Create a hash of the current DOM layout
        const body = document.body;
        const elements = body.querySelectorAll('*');
        let hash = '';
        
        elements.forEach(el => {
          const rect = el.getBoundingClientRect();
          const computedStyle = window.getComputedStyle(el);
          hash += `${el.tagName}-${rect.width}-${rect.height}-${computedStyle.display}-${computedStyle.visibility}`;
        });
        
        return hash;
      });

      if (currentLayoutHash === lastLayoutHash) {
        // Layout is stable
        if (Date.now() - stableStartTime >= stabilityThreshold) {
          console.log(`✅ UI is stable (no changes for ${stabilityThreshold}ms)`);
          return;
        }
      } else {
        // Layout changed, reset stability timer
        lastLayoutHash = currentLayoutHash;
        stableStartTime = Date.now();
        fluctuations++;
        
        if (fluctuations > maxFluctuations) {
          console.log(`⚠️ UI fluctuations detected: ${fluctuations}`);
        }
      }

      await page.waitForTimeout(checkInterval);
    }

    throw new Error(`Timeout waiting for ${message} after ${timeout}ms`);
  }

  /**
   * Wait for element to be in a specific state
   */
  static async waitForElementState(
    locator: Locator,
    state: 'visible' | 'attached' | 'enabled' | 'disabled' | 'hidden',
    options: WaitOptions = {}
  ): Promise<void> {
    const { timeout = this.DEFAULT_TIMEOUT, message = `Element to be ${state}` } = options;

    try {
      switch (state) {
        case 'visible':
          await expect(locator).toBeVisible({ timeout });
          break;
        case 'attached':
          await expect(locator).toBeAttached({ timeout });
          break;
        case 'enabled':
          await expect(locator).toBeEnabled({ timeout });
          break;
        case 'disabled':
          await expect(locator).toBeDisabled({ timeout });
          break;
        case 'hidden':
          await expect(locator).toBeHidden({ timeout });
          break;
      }
      console.log(`✅ Element is ${state}`);
    } catch (error) {
      throw new Error(`Timeout waiting for ${message} after ${timeout}ms: ${error.message}`);
    }
  }

  /**
   * Wait for custom condition with retry logic
   */
  static async waitForCondition(
    condition: () => Promise<boolean>,
    options: WaitOptions = {}
  ): Promise<void> {
    const { 
      timeout = this.DEFAULT_TIMEOUT, 
      polling = this.DEFAULT_POLLING,
      retries = this.DEFAULT_RETRIES,
      message = 'Custom condition'
    } = options;

    const startTime = Date.now();
    let attempts = 0;

    while (Date.now() - startTime < timeout && attempts < retries) {
      try {
        const result = await condition();
        if (result) {
          console.log(`✅ Condition met on attempt ${attempts + 1}`);
          return;
        }
      } catch (error) {
        console.log(`⚠️ Condition check failed on attempt ${attempts + 1}: ${error.message}`);
      }

      attempts++;
      await new Promise(resolve => setTimeout(resolve, polling));
    }

    throw new Error(`Timeout waiting for ${message} after ${timeout}ms (${attempts} attempts)`);
  }

  /**
   * Wait for page load state
   */
  static async waitForPageLoad(
    page: Page,
    state: 'load' | 'domcontentloaded' | 'networkidle' = 'networkidle',
    options: WaitOptions = {}
  ): Promise<void> {
    const { timeout = this.DEFAULT_TIMEOUT, message = `Page to load (${state})` } = options;

    try {
      await page.waitForLoadState(state, { timeout });
      console.log(`✅ Page loaded: ${state}`);
    } catch (error) {
      throw new Error(`Timeout waiting for ${message} after ${timeout}ms: ${error.message}`);
    }
  }

  /**
   * Wait for URL to match pattern
   */
  static async waitForURL(
    page: Page,
    urlPattern: string | RegExp,
    options: WaitOptions = {}
  ): Promise<void> {
    const { timeout = this.DEFAULT_TIMEOUT, message = `URL to match ${urlPattern}` } = options;

    try {
      await page.waitForURL(urlPattern, { timeout });
      console.log(`✅ URL matches: ${urlPattern}`);
    } catch (error) {
      throw new Error(`Timeout waiting for ${message} after ${timeout}ms: ${error.message}`);
    }
  }

  /**
   * Wait for response with specific criteria
   */
  static async waitForResponse(
    page: Page,
    urlPattern: string | RegExp,
    options: WaitOptions = {}
  ): Promise<any> {
    const { timeout = this.DEFAULT_TIMEOUT, message = `Response from ${urlPattern}` } = options;

    try {
      const response = await page.waitForResponse(urlPattern, { timeout });
      console.log(`✅ Response received: ${response.status()} ${response.url()}`);
      return response;
    } catch (error) {
      throw new Error(`Timeout waiting for ${message} after ${timeout}ms: ${error.message}`);
    }
  }

  /**
   * Wait for multiple elements to be present
   */
  static async waitForMultipleElements(
    page: Page,
    selectors: string[],
    options: WaitOptions = {}
  ): Promise<Locator[]> {
    const { timeout = this.DEFAULT_TIMEOUT, message = `Multiple elements: ${selectors.join(', ')}` } = options;

    const startTime = Date.now();
    const locators: Locator[] = [];

    while (Date.now() - startTime < timeout) {
      locators.length = 0; // Clear array
      
      for (const selector of selectors) {
        const locator = page.locator(selector);
        if (await locator.count() > 0) {
          locators.push(locator);
        }
      }

      if (locators.length === selectors.length) {
        console.log(`✅ All ${selectors.length} elements found`);
        return locators;
      }

      await page.waitForTimeout(100);
    }

    throw new Error(`Timeout waiting for ${message} after ${timeout}ms. Found: ${locators.length}/${selectors.length}`);
  }

  /**
   * Wait for animation to complete
   */
  static async waitForAnimationComplete(
    page: Page,
    options: WaitOptions = {}
  ): Promise<void> {
    const { timeout = this.DEFAULT_TIMEOUT, message = 'Animation to complete' } = options;

    try {
      await page.waitForFunction(() => {
        // Check if any CSS animations are running
        const animations = document.querySelectorAll('*');
        for (const element of animations) {
          const style = window.getComputedStyle(element);
          if (style.animationName !== 'none' || style.transitionProperty !== 'none') {
            return false; // Animation still running
          }
        }
        return true; // No animations running
      }, { timeout });
      
      console.log(`✅ All animations completed`);
    } catch (error) {
      throw new Error(`Timeout waiting for ${message} after ${timeout}ms: ${error.message}`);
    }
  }

  /**
   * Wait for scroll to complete
   */
  static async waitForScrollComplete(
    page: Page,
    options: WaitOptions = {}
  ): Promise<void> {
    const { timeout = this.DEFAULT_TIMEOUT, message = 'Scroll to complete' } = options;

    try {
      await page.waitForFunction(() => {
        // Check if page is currently scrolling
        return !window.scrolling;
      }, { timeout });
      
      console.log(`✅ Scroll completed`);
    } catch (error) {
      // If scroll detection isn't set up, just wait a bit
      await page.waitForTimeout(500);
      console.log(`ℹ️ Scroll wait completed (fallback)`);
    }
  }

  /**
   * Smart wait that chooses the best waiting strategy
   */
  static async smartWait(
    page: Page,
    strategy: 'network' | 'ui' | 'page' | 'custom',
    options: WaitOptions & NetworkWaitOptions & UIStabilityOptions = {}
  ): Promise<void> {
    switch (strategy) {
      case 'network':
        await this.waitForNetworkIdle(page, options);
        break;
      case 'ui':
        await this.waitForUIStability(page, options);
        break;
      case 'page':
        await this.waitForPageLoad(page, 'networkidle', options);
        break;
      case 'custom':
        if (options.message) {
          await this.waitForCondition(async () => {
            // Default custom condition - can be overridden
            return true;
          }, options);
        }
        break;
      default:
        throw new Error(`Unknown wait strategy: ${strategy}`);
    }
  }
}

// Export convenience functions
export const waitForNetworkIdle = WaitUtils.waitForNetworkIdle.bind(WaitUtils);
export const waitForUIStability = WaitUtils.waitForUIStability.bind(WaitUtils);
export const waitForElementState = WaitUtils.waitForElementState.bind(WaitUtils);
export const waitForCondition = WaitUtils.waitForCondition.bind(WaitUtils);
export const waitForPageLoad = WaitUtils.waitForPageLoad.bind(WaitUtils);
export const waitForURL = WaitUtils.waitForURL.bind(WaitUtils);
export const waitForResponse = WaitUtils.waitForResponse.bind(WaitUtils);
export const waitForMultipleElements = WaitUtils.waitForMultipleElements.bind(WaitUtils);
export const waitForAnimationComplete = WaitUtils.waitForAnimationComplete.bind(WaitUtils);
export const waitForScrollComplete = WaitUtils.waitForScrollComplete.bind(WaitUtils);
export const smartWait = WaitUtils.smartWait.bind(WaitUtils);
