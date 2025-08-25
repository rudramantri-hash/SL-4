# 🚀 Deflake - MCP Auto-Healing Test Framework

A comprehensive test reliability toolkit built around Playwright with **Model Context Protocol (MCP)** integration for automatic test healing and flakiness prevention.

## ✨ Key Features

### 🔍 **Plan → Ground → Validate (Pre-run Hardening)**
- **Plan**: Define test steps in human terms, not CSS selectors
- **Ground**: MCP inspects DOM and generates robust selector candidates
- **Validate**: Probe each candidate before execution (uniqueness, visibility, enabled state)

### 🩹 **Auto-Healing on Failure**
- Automatic fallback to alternative selectors when primary fails
- Intelligent selector scoring and threshold-based selection
- Fallback ladder: `getByRole` → `getByLabel` → `data-testid` → scoped CSS

### 📊 **Smart Selector Scoring**
- **Uniqueness (30%)**: One match beats many
- **Semantics (25%)**: Role + name exact > regex name > role-only
- **Stability (20%)**: Stable attributes beat hashed classes/IDs
- **Visible/Enabled (10%)**: Must be interactable
- **Scope fidelity (5%)**: Correct frame/shadow, shallow depth better

### 🚫 **Deterministic Waits (No Sleeps)**
- Replace `waitForTimeout` with element-driven waits
- Auto-wait for element conditions (`toBeVisible`, `toBeEnabled`)
- Network state monitoring and UI stability checks

### �� **Test Isolation & Real Webpage Testing**
- Fresh browser context per test
- **Real website testing only** - no mock backends
- Network control and third-party blocking
- Cross-browser compatibility testing

## 🏗️ Architecture

```
packages/deflake/
├── src/
│   ├── core/
│   │   ├── mcp.ts              # Core MCP framework
│   │   ├── selectors.ts         # Smart selector utilities
│   │   ├── isolation.ts         # Test isolation utilities
│   │   ├── waits.ts             # Intelligent wait strategies
│   │   └── dataSeeder.ts        # Test data management
│   ├── reporters/
│   │   └── mcpReporter.ts      # Custom reporter with auto-healing stats
│   ├── setup/
│   │   ├── global-setup.ts     # Global test setup
│   │   └── global-teardown.ts  # Global test cleanup
│   ├── cli/
│   │   └── index.ts            # CLI interface
│   └── index.ts                # Main exports
├── tests/
│   ├── amazon.spec.ts          # Real Amazon website tests
│   └── mcp-demo.spec.ts        # Demo tests with real websites
├── playwright.config.ts        # Playwright config with MCP reporter
└── package.json
```

## 🚀 Quick Start

### 1. Install Dependencies
```bash
cd packages/deflake
npm install
```

### 2. Run Tests on Real Websites
```bash
# Test Amazon website functionality
npx playwright test tests/amazon.spec.ts

# Run MCP demo tests
npx playwright test tests/mcp-demo.spec.ts

# Run all tests
npx playwright test
```

### 3. Use CLI Commands
```bash
# Show test plan
npx deflake plan

# Validate selectors against real URL
npx deflake validate --url https://www.amazon.com

# Run tests with auto-healing
npx deflake run --spec tests/*.spec.ts --headed --retries 2
```

## 📝 Writing Tests with MCP

### Define Your Test Plan
```typescript
const testPlan: Plan = {
  steps: [
    {
      id: 'search',
      intent: 'search for products',
      targets: [
        { key: 'search-input', role: 'searchbox', name: 'Search' },
        { key: 'search-button', role: 'button', name: 'Search' }
      ]
    }
  ]
};
```

### Use MCP in Tests
```typescript
import { test } from '@playwright/test';
import { MCP, Plan } from '../src/core/mcp';

test('Amazon product search', async ({ page }) => {
  const mcp = new MCP({ plan: testPlan });
  
  // Navigate to real website
  await page.goto('https://www.amazon.com');
  
  // Use MCP to find and interact with elements
  const searchInput = await mcp.ground(page, { key: 'search-input', role: 'searchbox' });
  await mcp.safeFill(searchInput, 'laptop');
  
  const searchButton = await mcp.ground(page, { key: 'search-button', role: 'button' });
  await mcp.safeClick(searchButton);
});
```

## 🌐 Real Website Testing

### Supported Websites
- **Amazon** - E-commerce functionality testing
- **Any public website** - Configurable domain testing
- **Cross-browser compatibility** - Chrome, Firefox, Safari

### Test Isolation
- **Fresh browser context** per test
- **No cross-test contamination**
- **Real network conditions**
- **Production-like environment**

### Network Control
- **Third-party blocking** for analytics/tracking
- **Domain allowlisting** for specific websites
- **Request monitoring** for stability

## 🔧 Configuration

### Playwright Configuration
```typescript
// playwright.config.ts
export default defineConfig({
  testDir: './tests',
  retries: process.env.CI ? 3 : 2,
  projects: [
    { name: 'chromium', use: { ...devices['Desktop Chrome'] } },
    { name: 'firefox', use: { ...devices['Desktop Firefox'] } },
    { name: 'webkit', use: { ...devices['Desktop Safari'] } }
  ]
});
```

### MCP Configuration
```typescript
const mcp = new MCP({
  plan: testPlan,
  scoreThreshold: 0.8,        // Minimum selector score
  enableAutoHeal: true        // Enable auto-healing
});
```

## 📊 Flakiness Detection

### Built-in Analysis
- **Selector stability scoring**
- **Auto-healing statistics**
- **Cross-browser consistency**
- **Performance metrics**

### Custom Reporter
```typescript
reporter: [
  ['./src/reporters/mcpReporter.ts', {
    outputFile: 'flakiness-report.json',
    enableFlakinessDetection: true,
    enableRootCauseAnalysis: true
  }]
]
```

## 🚫 What We Don't Support

- ❌ **Mock backends** - Only real websites
- ❌ **Local development servers** - Production-like testing
- ❌ **Hardcoded test data** - Dynamic, real-world scenarios
- ❌ **Arbitrary timeouts** - Intelligent waiting strategies

## 🎯 Best Practices

### 1. **Use Real URLs**
```typescript
// ✅ Good - Real website
await page.goto('https://www.amazon.com');

// ❌ Bad - Local development
await page.goto('http://localhost:3000');
```

### 2. **Leverage MCP Auto-Healing**
```typescript
// ✅ Good - MCP handles selector failures
const element = await mcp.ground(page, target);
await mcp.safeClick(element);

// ❌ Bad - Brittle selectors
await page.click('#specific-id');
```

### 3. **Test Isolation**
```typescript
// ✅ Good - Fresh context per test
const testContext = await createIsolatedContext(browser);

// ❌ Bad - Shared state
await page.goto('/login');
```

## 🔍 Troubleshooting

### Common Issues
1. **Network connectivity** - Ensure internet access
2. **Website changes** - MCP auto-healing handles most cases
3. **Rate limiting** - Add delays between tests if needed

### Debug Mode
```bash
# Run with headed mode for debugging
npx playwright test --headed

# Enable trace recording
npx playwright test --trace on
```

## 📈 Performance

### Test Execution
- **Parallel execution** across browsers
- **Smart waiting** reduces unnecessary delays
- **Selector caching** improves performance
- **Auto-healing** reduces test failures

### Resource Usage
- **Minimal memory footprint**
- **Efficient DOM traversal**
- **Optimized network monitoring**

## 🤝 Contributing

1. **Fork the repository**
2. **Create feature branch**
3. **Write tests for real websites**
4. **Submit pull request**

## 📄 License

MIT License - see LICENSE file for details.

---

**Built with ❤️ for reliable, flake-free test automation on real websites.**
