# 🚀 DEFLAKE Test Selector

The Test Selector is an interactive tool that allows you to choose which specific tests to run, which browsers to test on, and provides a customized testing experience.

## 🎯 Features

- **Test File Selection**: Choose between Amazon tests or MCP demo tests
- **Execution Mode Selection**: Multiple ways to run tests
- **Granular Test Selection**: For Amazon tests, select specific test functions
- **First 10 Tests Option**: Quick validation with limited test set
- **Custom Range Selection**: Specify test ranges (e.g., tests 1-5)
- **Browser Selection**: Run tests on Chromium, Firefox, Webkit, or all browsers
- **Custom Test Files**: Automatically creates temporary test files with only selected tests
- **Interactive Interface**: User-friendly command-line interface

## 🚀 Usage

### Method 1: Using npm script
```bash
npm run test:select
```

### Method 2: Direct execution
```bash
node test-selector.js
```

### Method 3: Make executable and run
```bash
chmod +x test-selector.js
./test-selector.js
```

## 📋 Selection Process

### Step 1: Choose Test File
```
📁 AVAILABLE TEST FILES:
------------------------
1. Amazon Website Tests
   Tests for Amazon website functionality (search, cart, login)
   File: tests/amazon.spec.ts

2. MCP Demo Tests
   Demo tests showcasing MCP auto-healing capabilities
   File: tests/mcp-demo.spec.ts
```

### Step 2: Select Execution Mode
```
🎯 EXECUTION MODES:
-------------------
1. Run All Tests
   Execute all tests in the selected file

2. Select Specific Tests
   Choose which individual tests to run

3. First 10 Tests Only
   Run only the first 10 tests (useful for quick validation)

4. Custom Range
   Specify a custom range of tests (e.g., tests 1-5)
```

### Step 3: Select Test Functions (Amazon tests only)
```
🧪 AMAZON TEST FUNCTIONS:
------------------------
1. search for products on Amazon
   Search functionality and product listing

2. add item to cart on Amazon
   Product selection and cart functionality

3. navigate Amazon categories
   Category navigation and browsing

4. Amazon login form interaction
   Login form and authentication
```

**Options for Specific Tests:**
- Enter numbers separated by commas (e.g., `1,3`)
- Type `all` to run all tests

**Options for Custom Range:**
- Enter range format: `start-end` (e.g., `1-5`, `2-8`, `1-3`)

### Step 4: Choose Browser
```
🌐 AVAILABLE BROWSERS:
----------------------
1. chromium
2. firefox
3. webkit
4. all
```

### Step 5: Confirm and Execute
```
🚀 READY TO EXECUTE TESTS
==========================
Test File: tests/amazon-custom-1234567890.spec.ts
Execution Mode: First 10 Tests Only
Selected Tests: search for products on Amazon, add item to cart on Amazon, navigate Amazon categories, Amazon login form interaction
Browser: chromium
Command: npx playwright test tests/amazon-custom-1234567890.spec.ts --project=chromium

Proceed with test execution? (y/n):
```

## 🔧 How It Works

1. **Test File Creation**: Creates a temporary custom test file with only selected tests
2. **Test Execution**: Runs Playwright with the custom test file and selected browser
3. **Cleanup**: Automatically removes temporary test files after execution
4. **Report Generation**: After tests complete, generate reports with `node generate-report.js`

## 💡 Examples

### Run First 10 Tests on Firefox
```
Select test file: 1 (Amazon Website Tests)
Select execution mode: 3 (First 10 Tests Only)
Select browser: 2 (firefox)
```

### Run Custom Range (Tests 1-3) on All Browsers
```
Select test file: 1 (Amazon Website Tests)
Select execution mode: 4 (Custom Range)
Enter range: 1-3
Select browser: 4 (all)
```

### Run Only Search and Cart Tests on Chromium
```
Select test file: 1 (Amazon Website Tests)
Select execution mode: 2 (Select Specific Tests)
Select test functions: 1,2 (search, cart)
Select browser: 1 (chromium)
```

### Run All Amazon Tests on All Browsers
```
Select test file: 1 (Amazon Website Tests)
Select execution mode: 1 (Run All Tests)
Select browser: 4 (all)
```

### Run MCP Demo Tests on Chromium
```
Select test file: 2 (MCP Demo Tests)
Select execution mode: 1 (Run All Tests)
Select browser: 1 (chromium)
```

## 🎉 Benefits

- **Faster Testing**: Run only the tests you need
- **Quick Validation**: Use "First 10 Tests" for rapid feedback
- **Focused Debugging**: Isolate specific functionality
- **Browser-Specific Testing**: Test on specific browsers
- **Time Saving**: Skip tests that aren't relevant to your current work
- **Custom Workflows**: Create testing scenarios tailored to your needs
- **Range Testing**: Test specific ranges of functionality

## 📊 After Test Execution

Once tests complete, you can:

1. **Generate Flakiness Report**: `node generate-report.js`
2. **Generate Screenshots Gallery**: `node generate-screenshots-gallery.js`
3. **View Playwright Report**: `npx playwright show-report`

## 🚨 Notes

- Temporary test files are automatically cleaned up after execution
- The selector validates all inputs to prevent errors
- You can cancel execution at any time by pressing Ctrl+C
- All test results are saved to the standard Playwright output directories
- The "First 10 Tests" option is perfect for quick validation during development
- Custom ranges allow you to focus on specific test sequences
