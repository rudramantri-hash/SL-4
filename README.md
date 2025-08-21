# 🚀 Deflake - Test Reliability Toolkit

A comprehensive test reliability toolkit built around Playwright with **Model Context Protocol (MCP)** integration for automatic test healing and flakiness prevention.

## ✨ Features

- **MCP Auto-Healing**: Automatic fallback to alternative selectors when primary fails
- **Smart Selector Scoring**: Intelligent selector selection based on stability and accessibility
- **Flakiness Detection**: Comprehensive analysis and reporting of test reliability
- **Test Isolation**: Fresh browser contexts and data seeding for consistent results
- **Beautiful Reports**: Professional HTML reports with timing comparisons and analysis

## 🏗️ Project Structure

```
de-flake-tests/
├── packages/
│   ├── deflake/          # Main MCP framework
│   │   ├── src/         # Source code
│   │   ├── tests/       # Test files
│   │   ├── reports/     # Generated reports
│   │   └── docs/        # Documentation
│   └── backend/         # Test backend server
├── .github/             # GitHub Actions workflows
└── README.md            # This file
```

## 🚀 Quick Start

### 1. Clone the Repository
```bash
git clone <your-github-repo-url>
cd de-flake-tests
```

### 2. Install Dependencies
```bash
cd packages/deflake
npm install

cd ../backend
npm install
```

### 3. Start Backend Server
```bash
cd packages/backend
npm start
```

### 4. Run Tests with MCP
```bash
cd packages/deflake
npx playwright test tests/amazon.spec.ts
```

### 5. View Reports
```bash
open reports/flakiness-detector.html
```

## 📊 Sample Report

The toolkit generates beautiful HTML reports showing:
- Test execution summary
- Manual vs automated timing comparison
- Flakiness analysis
- Detailed test results
- PDF download capability

## 🔧 CLI Commands

```bash
# Show test plan
npx deflake plan

# Validate selectors
npx deflake validate --url http://localhost:3000/login

# Run tests with auto-healing
npx deflake run --spec tests/*.spec.ts --headed --retries 2
```

## 🤝 Contributing

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Add tests for new functionality
5. Submit a pull request

## 📄 License

MIT License - see LICENSE file for details.

---

**Built with ❤️ for reliable testing**
