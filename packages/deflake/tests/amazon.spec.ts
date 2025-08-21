import { test, expect } from '../src/test-setup';

test.describe('Amazon Website Tests with MCP Auto-Healing', () => {
  test('search for products on Amazon', async ({ page, mcp }) => {
    await page.goto('https://www.amazon.com', { waitUntil: 'domcontentloaded' });
    
    // Wait for page to load
    await page.waitForLoadState('networkidle');
    
    // Search for a product using MCP
    const searchInput = page.locator('#twotabsearchtextbox');
    await expect(searchInput).toBeVisible();
    await searchInput.fill('laptop');
    
    // Click search button
    const searchButton = page.locator('#nav-search-submit-button');
    await expect(searchButton).toBeVisible();
    await searchButton.click();
    
    // Wait for search results
    await expect(page.locator('[data-component-type="s-search-results"]')).toBeVisible();
    
    // Verify we have results
    const results = page.locator('[data-component-type="s-search-results"] .s-result-item');
    await expect(results.first()).toBeVisible();
  });

  test('add item to cart on Amazon', async ({ page, mcp }) => {
    await page.goto('https://www.amazon.com/s?k=laptop', { waitUntil: 'domcontentloaded' });
    
    // Wait for results to load
    await page.waitForLoadState('networkidle');
    
    // Click on first product
    const firstProduct = page.locator('[data-component-type="s-search-results"] .s-result-item h2 a').first();
    await expect(firstProduct).toBeVisible();
    await firstProduct.click();
    
    // Wait for product page to load
    await page.waitForLoadState('networkidle');
    
    // Try to add to cart (handle different button variations)
    const addToCartButton = page.locator('#add-to-cart-button, #addToCart, [data-feature-id="addToCart"]').first();
    if (await addToCartButton.isVisible()) {
      await addToCartButton.click();
      
      // Wait for confirmation
      await expect(page.locator('#attachDisplayAddBaseAlert, #attach-added-to-cart-alert')).toBeVisible();
    } else {
      console.log('Add to cart button not found - product may be out of stock or have different layout');
    }
  });

  test('navigate Amazon categories', async ({ page, mcp }) => {
    await page.goto('https://www.amazon.com', { waitUntil: 'domcontentloaded' });
    
    // Click on a category (e.g., Electronics)
    const electronicsLink = page.locator('a:has-text("Electronics"), [data-nav-role="navigation"] a:has-text("Electronics")');
    if (await electronicsLink.isVisible()) {
      await electronicsLink.click();
      
      // Wait for category page to load
      await page.waitForLoadState('networkidle');
      
      // Verify we're on electronics page
      await expect(page.locator('h1:has-text("Electronics"), .category-page-title')).toBeVisible();
    } else {
      console.log('Electronics category link not found');
    }
  });

  test('Amazon login form interaction', async ({ page, mcp }) => {
    await page.goto('https://www.amazon.com', { waitUntil: 'domcontentloaded' });
    
    // Click on sign in
    const signInButton = page.locator('#nav-link-accountList, #nav-signin-tooltip a, .nav-action-button');
    await expect(signInButton).toBeVisible();
    await signInButton.click();
    
    // Wait for login form
    await page.waitForLoadState('networkidle');
    
    // Fill email (but don't submit for security)
    const emailInput = page.locator('#ap_email, #email');
    if (await emailInput.isVisible()) {
      await emailInput.fill('test@example.com');
      console.log('Email field filled successfully');
    } else {
      console.log('Email input not found');
    }
  });
});
