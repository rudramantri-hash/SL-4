import { test as base, Page } from '@playwright/test';
import { MCP, Plan } from './core/mcp';

// Define the test plan
const testPlan: Plan = {
  steps: [
    {
      id: 'login',
      intent: 'authenticate user',
      targets: [
        { key: 'email', role: 'textbox', label: 'Email', placeholder: 'Enter your email' },
        { key: 'password', role: 'textbox', label: 'Password', placeholder: 'Enter your password' },
        { key: 'submit', role: 'button', name: 'Log in' }
      ]
    },
    {
      id: 'search',
      intent: 'search for products',
      targets: [
        { key: 'searchInput', role: 'searchbox', placeholder: 'Search products...' },
        { key: 'searchButton', role: 'button', name: 'Search' }
      ]
    },
    {
      id: 'addToCart',
      intent: 'add product to cart',
      targets: [
        { key: 'addToCartButton', role: 'button', name: 'Add to Cart' }
      ]
    }
  ]
};

// Create MCP instance
const mcp = new MCP({
  plan: testPlan,
  scoreThreshold: 0.8,
  enableAutoHeal: true,
});

export const test = base.extend<{
  mcp: MCP;
}>({
  mcp: async ({}, use) => {
    await mcp.loadPlan();
    await use(mcp);
  },
});

export { expect } from '@playwright/test';
export { testPlan };
