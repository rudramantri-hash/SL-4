import { Page, Locator, expect } from '@playwright/test';

export interface Target {
  key: string;
  role?: string;
  label?: string;
  name?: string;
  placeholder?: string;
  testId?: string;
  fallback?: string;
}

export interface Step {
  id: string;
  intent: string;
  targets: Target[];
}

export interface Plan {
  steps: Step[];
}

export interface SelectorCandidate {
  selector: string;
  method: string;
  score: number;
  locator: Locator;
}

export class MCP {
  private plan: Plan;
  private scoreThreshold: number;
  private selectorCache: Map<string, SelectorCandidate[]> = new Map();
  private failureSignatures: Map<string, string[]> = new Map();

  constructor(options: {
    plan: Plan;
    scoreThreshold?: number;
  }) {
    this.plan = options.plan;
    this.scoreThreshold = options.scoreThreshold || 0.8;
  }

  async loadPlan(): Promise<void> {
    console.log(`MCP: Loaded plan with ${this.plan.steps.length} steps`);
  }

  getStep(stepId: string): Step | undefined {
    return this.plan.steps.find(step => step.id === stepId);
  }

  async ground(page: Page, target: Target): Promise<Locator> {
    const candidates = await this.generateSelectorCandidates(page, target);
    const bestCandidate = candidates.find(c => c.score >= this.scoreThreshold);
    
    if (!bestCandidate) {
      throw new Error(
        `No selector candidate meets threshold ${this.scoreThreshold} for target ${target.key}. ` +
        `Best score: ${candidates[0]?.score || 0}`
      );
    }

    console.log(`MCP: Grounded ${target.key} to ${bestCandidate.method} (score: ${bestCandidate.score})`);
    return bestCandidate.locator;
  }

  async validate(locator: Locator): Promise<void> {
    // Check uniqueness
    const count = await locator.count();
    if (count !== 1) {
      throw new Error(`Selector matches ${count} elements, expected exactly 1`);
    }

    // Check visibility
    await expect(locator).toBeVisible();

    // Check enabled state
    await expect(locator).toBeEnabled();

    // Check ARIA compliance
    const role = await locator.getAttribute('role');
    const ariaLabel = await locator.getAttribute('aria-label');
    
    console.log(`MCP: Validated selector - unique: ✓, visible: ✓, enabled: ✓, role: ${role}, aria-label: ${ariaLabel}`);
  }

  async safeClick(locator: Locator, context?: string): Promise<void> {
    try {
      await this.validate(locator);
      await locator.click();
      console.log(`MCP: Safe click executed for ${context || 'element'}`);
    } catch (error) {
      throw error;
    }
  }

  async safeFill(locator: Locator, value: string, context?: string): Promise<void> {
    try {
      await this.validate(locator);
      await locator.fill(value);
      console.log(`MCP: Safe fill executed for ${context || 'element'}`);
    } catch (error) {
      throw error;
    }
  }

  async safeExpect(locator: Locator, matcher: any, context?: string): Promise<void> {
    try {
      await this.validate(locator);
      await expect(locator).toHaveText(matcher);
      console.log(`MCP: Safe expect executed for ${context || 'element'}`);
    } catch (error) {
      throw error;
    }
  }

  private async generateSelectorCandidates(page: Page, target: Target): Promise<SelectorCandidate[]> {
    const candidates: SelectorCandidate[] = [];
    
    // Try different selector strategies
    const strategies = [
      { method: 'testId', selector: `[data-testid="${target.testId}"]` },
      { method: 'role', selector: `[role="${target.role}"]` },
      { method: 'label', selector: `[aria-label="${target.label}"]` },
      { method: 'name', selector: `[name="${target.name}"]` },
      { method: 'placeholder', selector: `[placeholder="${target.placeholder}"]` },
      { method: 'fallback', selector: target.fallback || '' }
    ];

    for (const strategy of strategies) {
      if (strategy.selector) {
        try {
          const locator = page.locator(strategy.selector);
          const count = await locator.count();
          
          if (count > 0) {
            const score = this.calculateSelectorScore(strategy, count, target);
            candidates.push({
              selector: strategy.selector,
              method: strategy.method,
              score,
              locator
            });
          }
        } catch (error) {
          // Skip invalid selectors
        }
      }
    }

    // Sort by score (highest first)
    return candidates.sort((a, b) => b.score - a.score);
  }

  private calculateSelectorScore(strategy: any, count: number, target: Target): number {
    let score = 1.0;

    // Penalize multiple matches
    if (count > 1) {
      score -= (count - 1) * 0.1;
    }

    // Prefer more specific selectors
    switch (strategy.method) {
      case 'testId':
        score += 0.2;
        break;
      case 'role':
        score += 0.1;
        break;
      case 'label':
        score += 0.15;
        break;
      case 'name':
        score += 0.05;
        break;
      case 'placeholder':
        score += 0.05;
        break;
      case 'fallback':
        score -= 0.1;
        break;
    }

    return Math.max(0, Math.min(1, score));
  }
}
