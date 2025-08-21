import { test, expect } from '../src/test-setup';

test.describe('MCP Auto-Healing Demo', () => {
  test('login flow with MCP auto-healing', async ({ page, mcp }) => {
    await page.goto('/login', { waitUntil: 'domcontentloaded' });
    
    // Get the login step from our plan
    const loginStep = mcp.getStep('login');
    if (!loginStep) throw new Error('Login step not found in plan');

    // Execute each target with MCP grounding and validation
    for (const target of loginStep.targets) {
      console.log(`Processing target: ${target.key}`);
      
      // Ground: Generate best selector
      const locator = await mcp.ground(page, target);
      
      // Validate: Check uniqueness, visibility, enabled state
      await mcp.validate(locator);
      
      // Action: Fill or click based on target type
      if (target.key === 'email') {
        await mcp.safeFill(locator, 'test@example.com', 'email input');
      } else if (target.key === 'password') {
        await mcp.safeFill(locator, 'password123', 'password input');
      } else if (target.key === 'submit') {
        await mcp.safeClick(locator, 'login button');
      }
    }

    // Wait for successful login
    await mcp.waitFor(page, { role: 'heading', name: 'Welcome' });
    
    // Verify we're logged in
    await expect(page).toHaveURL(/\/dashboard/);
  });

  test('search functionality with MCP', async ({ page, mcp }) => {
    await page.goto('/search', { waitUntil: 'domcontentloaded' });
    
    const searchStep = mcp.getStep('search');
    if (!searchStep) throw new Error('Search step not found in plan');

    // Search for a product
    const searchInput = await mcp.ground(page, searchStep.targets[0]);
    await mcp.safeFill(searchInput, 'laptop', 'search input');
    
    const searchButton = await mcp.ground(page, searchStep.targets[1]);
    await mcp.safeClick(searchButton, 'search button');
    
    // Wait for search results
    await expect(page.locator('[data-testid="search-results"]')).toBeVisible();
  });

  test('add to cart with MCP', async ({ page, mcp }) => {
    await page.goto('/products', { waitUntil: 'domcontentloaded' });
    
    const addToCartStep = mcp.getStep('addToCart');
    if (!addToCartStep) throw new Error('Add to cart step not found in plan');

    // Find and click add to cart button
    const addToCartButton = await mcp.ground(page, addToCartStep.targets[0]);
    await mcp.safeClick(addToCartButton, 'add to cart button');
    
    // Verify item was added
    await expect(page.locator('[data-testid="cart-count"]')).toHaveText('1');
  });
});
