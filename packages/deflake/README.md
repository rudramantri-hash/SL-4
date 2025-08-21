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

### 🧪 **Test Isolation & Data Seeding**
- Fresh browser context per test
- Seeded test data for consistent state
- Network control and third-party blocking

## 🏗️ Architecture

```
packages/deflake/
├── src/
│   ├── core/
│   │   └── mcp.ts              # Core MCP framework
│   ├── reporters/
│   │   └── mcpReporter.ts      # Custom reporter with auto-healing stats
│   ├── test-setup.ts           # Playwright fixtures with MCP integration
│   ├── cli/
│   │   └── index.ts            # CLI interface
│   └── index.ts                # Main exports
├── tests/
│   └── mcp-demo.spec.ts        # Demo tests showcasing MCP
├── playwright.config.ts        # Playwright config with MCP reporter
└── package.json
```

## 🚀 Quick Start

### 1. Install Dependencies
```bash
cd packages/deflake
npm install
```

### 2. Start Backend Server
```bash
cd ../backend
npm install
npm start
```

### 3. Run Tests with MCP
```bash
cd ../deflake
npx playwright test tests/mcp-demo.spec.ts
```

### 4. Use CLI Commands
```bash
# Show test plan
npx deflake plan

# Validate selectors against URL
npx deflake validate --url http://localhost:3000/login

# Run tests with auto-healing
npx deflake run --spec tests/*.spec.ts --headed --retries 2
```

## 📝 Writing Tests with MCP

### Define Your Test Plan
```typescript
const testPlan: Plan = {
  steps: [
    {
      id: 'login',
      intent: 'authenticate user',
      targets: [
        { key: 'email', role: 'textbox', label: 'Email' },
        { key: 'password', role: 'textbox', label: 'Password' },
        { key: 'submit', role: 'button', name: 'Log in' }
      ]
    }
  ]
};
```

### Use MCP in Tests
```typescript
import { test, expect } from './test-setup';

test('login flow with MCP auto-healing', async ({ page, mcp }) => {
  await page.goto('/login');
  
  const loginStep = mcp.getStep('login');
  
  // Ground: Generate best selector
  const emailLocator = await mcp.ground(page, loginStep.targets[0]);
  
  // Validate: Check uniqueness, visibility, enabled
  await mcp.validate(emailLocator);
  
  // Action: Safe fill with auto-healing
  await mcp.safeFill(emailLocator, 'test@example.com', 'email input');
});
```

## 🔧 Configuration

### Playwright Config
```typescript
// playwright.config.ts
export default defineConfig({
  reporter: [
    ['html', { outputFolder: 'playwright-report' }],
    ['./src/reporters/mcpReporter.ts', { outputFile: 'mcp-report.json' }]
  ],
  use: {
    baseURL: 'http://localhost:3000',
    trace: 'on-first-retry',
    screenshot: 'only-on-failure'
  }
});
```

### MCP Options
```typescript
const mcp = new MCP({
  plan: testPlan,
  scoreThreshold: 0.8,        // Minimum selector score
  enableAutoHeal: true        // Enable auto-healing
});
```

## 📊 MCP Reporter

The custom reporter generates detailed reports including:
- **Auto-healing statistics**: Success/failure rates
- **Selector scores**: Performance metrics for each selector method
- **Flakiness detection**: Browser vs test-level issues
- **Recommendations**: Actionable improvements

### Sample Report
```json
{
  "summary": {
    "totalTests": 3,
    "passed": 3,
    "failed": 0,
    "autoHealed": 1,
    "averageSelectorScore": 0.92
  },
  "autoHealing": {
    "totalAttempts": 1,
    "successful": 1,
    "failed": 0
  },
  "recommendations": [
    "All tests passed successfully",
    "Auto-healing resolved 1 selector issue"
  ]
}
```

## 🎯 Best Practices

### 1. **Selector Priority**
1. **Accessibility-first**: `getByRole`, `getByLabel`, `getByPlaceholder`
2. **Test IDs**: `[data-testid="..."]`
3. **Scoped CSS**: `:has()` with stable neighbors
4. **Structural CSS**: Last resort only

### 2. **Wait Strategies**
```typescript
// ✅ Good: Element-driven waits
await expect(locator).toBeVisible();
await expect(locator).toBeEnabled();

// ❌ Bad: Fixed timeouts
await page.waitForTimeout(2000);
```

### 3. **Test Isolation**
```typescript
// Fresh context per test
test.beforeEach(async ({ page }) => {
  await page.goto('/');
  // Clear any existing state
});
```

## 🚨 CI Guardrails

MCP enforces automated rules in CI:
- **Selector score threshold**: ≥ 0.8
- **Zero raw sleeps**: Pipeline fails if `waitForTimeout` found
- **Retry budget**: Respect configured retry limits
- **Flake rate monitoring**: < 5% over consecutive runs

## 🔍 Troubleshooting

### Common Issues

1. **Selector Score Too Low**
   - Add more specific attributes (role, name, label)
   - Use `data-testid` for critical elements
   - Avoid deep CSS selectors

2. **Auto-Healing Failing**
   - Check element visibility and enabled state
   - Verify frame/shadow root context
   - Review fallback selector strategies

3. **High Flakiness**
   - Review test isolation
   - Check for shared state between tests
   - Verify wait strategies

### Debug Mode
```typescript
// Enable verbose logging
const mcp = new MCP({
  plan: testPlan,
  scoreThreshold: 0.8,
  enableAutoHeal: true,
  debug: true  // Enable detailed logging
});
```

## 📚 Learn More

- [Playwright Best Practices](https://playwright.dev/docs/best-practices)
- [Accessibility Testing](https://playwright.dev/docs/accessibility-testing)
- [Test Isolation](https://playwright.dev/docs/test-isolation)

## 🤝 Contributing

1. Fork the repository
2. Create a feature branch
3. Add tests for new functionality
4. Ensure all tests pass
5. Submit a pull request

## 📄 License

MIT License - see LICENSE file for details.

---

**Built with ❤️ for reliable testing**
