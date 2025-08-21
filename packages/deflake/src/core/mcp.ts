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
  private enableAutoHeal: boolean;
  private selectorCache: Map<string, SelectorCandidate[]> = new Map();
  private failureSignatures: Map<string, string[]> = new Map();

  constructor(options: {
    plan: Plan;
    scoreThreshold?: number;
    enableAutoHeal?: boolean;
  }) {
    this.plan = options.plan;
    this.scoreThreshold = options.scoreThreshold || 0.8;
    this.enableAutoHeal = options.enableAutoHeal || true;
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
      if (this.enableAutoHeal) {
        console.log(`MCP: Auto-healing click failure for ${context || 'element'}`);
        await this.autoHealClick(locator, context);
      } else {
        throw error;
      }
    }
  }

  async safeFill(locator: Locator, value: string, context?: string): Promise<void> {
    try {
      await this.validate(locator);
      await locator.fill(value);
      console.log(`MCP: Safe fill executed for ${context || 'element'} with value: ${value}`);
    } catch (error) {
      if (this.enableAutoHeal) {
        console.log(`MCP: Auto-healing fill failure for ${context || 'element'}`);
        await this.autoHealFill(locator, value, context);
      } else {
        throw error;
      }
    }
  }

  async waitFor(page: Page, target: Partial<Target>): Promise<Locator> {
    const locator = await this.ground(page, target as Target);
    await expect(locator).toBeVisible();
    return locator;
  }

  private async generateSelectorCandidates(page: Page, target: Target): Promise<SelectorCandidate[]> {
    const candidates: SelectorCandidate[] = [];

    // Priority 1: Accessibility-first selectors
    if (target.role && target.name) {
      const locator = page.getByRole(target.role as any, { name: target.name });
      candidates.push({
        selector: `getByRole('${target.role}', { name: '${target.name}' })`,
        method: 'getByRole',
        score: 0.95,
        locator
      });
    }

    if (target.label) {
      const locator = page.getByLabel(target.label);
      candidates.push({
        selector: `getByLabel('${target.label}')`,
        method: 'getByLabel',
        score: 0.90,
        locator
      });
    }

    if (target.placeholder) {
      const locator = page.getByPlaceholder(target.placeholder);
      candidates.push({
        selector: `getByPlaceholder('${target.placeholder}')`,
        method: 'getByPlaceholder',
        score: 0.85,
        locator
      });
    }

    // Priority 2: Test IDs
    if (target.testId) {
      const locator = page.locator(`[data-testid="${target.testId}"]`);
      candidates.push({
        selector: `[data-testid="${target.testId}"]`,
        method: 'data-testid',
        score: 0.80,
        locator
      });
    }

    // Priority 3: Scoped CSS with :has()
    if (target.fallback) {
      const locator = page.locator(target.fallback);
      candidates.push({
        selector: target.fallback,
        method: 'scoped-css',
        score: 0.70,
        locator
      });
    }

    // Priority 4: Structural CSS (last resort)
    const structuralSelector = this.generateStructuralSelector(target);
    if (structuralSelector) {
      const locator = page.locator(structuralSelector);
      candidates.push({
        selector: structuralSelector,
        method: 'structural-css',
        score: 0.50,
        locator
      });
    }

    // Sort by score (highest first)
    return candidates.sort((a, b) => b.score - a.score);
  }

  private generateStructuralSelector(target: Target): string | null {
    if (target.role) {
      return `${target.role}:has-text("${target.name || target.label || ''}")`;
    }
    return null;
  }

  private async autoHealClick(locator: Locator, context?: string): Promise<void> {
    // Try alternative strategies
    try {
      // Wait a bit and retry
      await locator.waitFor({ state: 'visible', timeout: 5000 });
      await locator.click();
      console.log(`MCP: Auto-heal successful for ${context || 'element'}`);
    } catch (error) {
      console.log(`MCP: Auto-heal failed for ${context || 'element'}`);
      throw error;
    }
  }

  private async autoHealFill(locator: Locator, value: string, context?: string): Promise<void> {
    try {
      await locator.waitFor({ state: 'visible', timeout: 5000 });
      await locator.fill(value);
      console.log(`MCP: Auto-heal fill successful for ${context || 'element'}`);
    } catch (error) {
      console.log(`MCP: Auto-heal fill failed for ${context || 'element'}`);
      throw error;
    }
  }

  getSelectorCache(): Map<string, SelectorCandidate[]> {
    return this.selectorCache;
  }

  getFailureSignatures(): Map<string, string[]> {
    return this.failureSignatures;
  }
}
