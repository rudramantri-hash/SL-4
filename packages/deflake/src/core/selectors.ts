import { Page, Locator, expect } from '@playwright/test';

export interface SelectorOptions {
  timeout?: number;
  retries?: number;
  fallbackSelectors?: string[];
  waitForState?: 'visible' | 'attached' | 'enabled';
}

export interface SelectorScore {
  selector: string;
  score: number;
  method: string;
  reason: string;
}

/**
 * Advanced selector management utilities for Playwright tests.
 * 
 * This module provides intelligent selector generation, validation, and scoring
 * to improve test reliability and reduce flakiness.
 * 
 * Features:
 * - Smart selector generation with multiple strategies
 * - Selector scoring and validation
 * - Fallback selector mechanisms
 * - Selector caching and optimization
 */
export class SelectorUtils {
  private static readonly DEFAULT_TIMEOUT = 10000;
  private static readonly DEFAULT_RETRIES = 2;

  /**
   * Click on an element with multiple selector fallbacks
   */
  static async clickStable(
    page: Page, 
    selectors: string[], 
    options: SelectorOptions = {}
  ): Promise<void> {
    const { timeout = this.DEFAULT_TIMEOUT, retries = this.DEFAULT_RETRIES } = options;
    
    for (let attempt = 0; attempt <= retries; attempt++) {
      try {
        const locator = await this.findBestSelector(page, selectors, options);
        await this.waitForElementState(locator, options.waitForState || 'visible');
        await locator.click();
        console.log(`✅ Click successful on attempt ${attempt + 1}`);
        return;
      } catch (error) {
        console.log(`❌ Click attempt ${attempt + 1} failed: ${error instanceof Error ? error.message : String(error)}`);
        if (attempt === retries) {
          throw new Error(`Failed to click after ${retries + 1} attempts. Selectors: ${selectors.join(', ')}`);
        }
        await page.waitForTimeout(1000); // Wait before retry
      }
    }
  }

  /**
   * Fill a form field with multiple selector fallbacks
   */
  static async fillStable(
    page: Page, 
    selectors: string[], 
    value: string, 
    options: SelectorOptions = {}
  ): Promise<void> {
    const { timeout = this.DEFAULT_TIMEOUT, retries = this.DEFAULT_RETRIES } = options;
    
    for (let attempt = 0; attempt <= retries; attempt++) {
      try {
        const locator = await this.findBestSelector(page, selectors, options);
        await this.waitForElementState(locator, options.waitForState || 'visible');
        await locator.fill(value);
        console.log(`✅ Fill successful on attempt ${attempt + 1}`);
        return;
      } catch (error) {
        console.log(`❌ Fill attempt ${attempt + 1} failed: ${error instanceof Error ? error.message : String(error)}`);
        if (attempt === retries) {
          throw new Error(`Failed to fill after ${retries + 1} attempts. Selectors: ${selectors.join(', ')}`);
        }
        await page.waitForTimeout(1000); // Wait before retry
      }
    }
  }

  /**
   * Wait for an element with multiple selector fallbacks
   */
  static async expectStable(
    page: Page, 
    selectors: string[], 
    options: SelectorOptions = {}
  ): Promise<Locator> {
    const { timeout = this.DEFAULT_TIMEOUT, retries = this.DEFAULT_RETRIES } = options;
    
    for (let attempt = 0; attempt <= retries; attempt++) {
      try {
        const locator = await this.findBestSelector(page, selectors, options);
        await this.waitForElementState(locator, options.waitForState || 'visible');
        console.log(`✅ Element found on attempt ${attempt + 1}`);
        return locator;
      } catch (error) {
        console.log(`❌ Element not found on attempt ${attempt + 1}: ${error instanceof Error ? error.message : String(error)}`);
        if (attempt === retries) {
          throw new Error(`Element not found after ${retries + 1} attempts. Selectors: ${selectors.join(', ')}`);
        }
        await page.waitForTimeout(1000); // Wait before retry
      }
    }
    throw new Error('Unexpected error in expectStable');
  }

  /**
   * Find the best working selector from a list of alternatives
   */
  private static async findBestSelector(
    page: Page, 
    selectors: string[], 
    options: SelectorOptions
  ): Promise<Locator> {
    const scoredSelectors = await this.scoreSelectors(page, selectors);
    const bestSelector = scoredSelectors.find(s => s.score > 0.5);
    
    if (!bestSelector) {
      throw new Error(`No working selectors found. All selectors scored below 0.5`);
    }
    
    console.log(`🎯 Using selector: ${bestSelector.selector} (score: ${bestSelector.score})`);
    return page.locator(bestSelector.selector);
  }

  /**
   * Score selectors based on reliability and uniqueness
   */
  private static async scoreSelectors(page: Page, selectors: string[]): Promise<SelectorScore[]> {
    const scores: SelectorScore[] = [];
    
    for (const selector of selectors) {
      try {
        const locator = page.locator(selector);
        const count = await locator.count();
        
        if (count === 0) {
          scores.push({ selector, score: 0, method: 'not-found', reason: 'Element not found' });
          continue;
        }
        
        if (count > 1) {
          scores.push({ selector, score: 0.3, method: 'multiple-elements', reason: `Found ${count} elements` });
          continue;
        }
        
        // Check if element is visible and enabled
        const isVisible = await locator.isVisible();
        const isEnabled = await locator.isEnabled();
        
        let score = 1.0;
        let method = 'excellent';
        let reason = 'Perfect match';
        
        if (!isVisible) {
          score -= 0.3;
          method = 'not-visible';
          reason = 'Element not visible';
        }
        
        if (!isEnabled) {
          score -= 0.2;
          method = 'not-enabled';
          reason = 'Element not enabled';
        }
        
        // Bonus for semantic selectors
        if (selector.includes('getByRole') || selector.includes('getByLabel')) {
          score += 0.1;
          method = 'semantic';
          reason = 'Semantic selector (bonus)';
        }
        
        scores.push({ selector, score: Math.max(0, score), method, reason });
        
      } catch (error) {
        scores.push({ selector, score: 0, method: 'error', reason: error instanceof Error ? error.message : String(error) });
      }
    }
    
    // Sort by score (highest first)
    return scores.sort((a, b) => b.score - a.score);
  }

  /**
   * Wait for element to reach desired state
   */
  private static async waitForElementState(
    locator: Locator, 
    state: 'visible' | 'attached' | 'enabled'
  ): Promise<void> {
    switch (state) {
      case 'visible':
        await expect(locator).toBeVisible();
        break;
      case 'attached':
        await expect(locator).toBeAttached();
        break;
      case 'enabled':
        await expect(locator).toBeEnabled();
        break;
    }
  }

  /**
   * Generate stable selectors for common elements
   */
  static generateStableSelectors(element: {
    role?: string;
    name?: string;
    label?: string;
    placeholder?: string;
    testId?: string;
  }): string[] {
    const selectors: string[] = [];
    
    // Priority 1: Role + name (most stable)
    if (element.role && element.name) {
      selectors.push(`getByRole('${element.role}', { name: '${element.name}' })`);
    }
    
    // Priority 2: Label-based
    if (element.label) {
      selectors.push(`getByLabel('${element.label}')`);
    }
    
    // Priority 3: Placeholder-based
    if (element.placeholder) {
      selectors.push(`getByPlaceholder('${element.placeholder}')`);
    }
    
    // Priority 4: Test ID
    if (element.testId) {
      selectors.push(`[data-testid="${element.testId}"]`);
    }
    
    // Priority 5: Fallback CSS
    if (element.role) {
      selectors.push(`${element.role}:has-text("${element.name || element.label || ''}")`);
    }
    
    return selectors;
  }
}

// Export convenience functions
export const clickStable = SelectorUtils.clickStable.bind(SelectorUtils);
export const fillStable = SelectorUtils.fillStable.bind(SelectorUtils);
export const expectStable = SelectorUtils.expectStable.bind(SelectorUtils);
export const generateStableSelectors = SelectorUtils.generateStableSelectors.bind(SelectorUtils);
