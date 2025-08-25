const fs = require('fs');
const path = require('path');

// Read test results
const testResultsPath = path.join(__dirname, 'test-results.json');
const testResults = JSON.parse(fs.readFileSync(testResultsPath, 'utf8'));

// Analyze test results
function analyzeTestResults() {
  const summary = {
    totalTests: 0,
    passed: 0,
    failed: 0,
    flaky: 0,
    successRate: 0,
    averageDuration: 0,
    totalExecutions: 0, // Total test executions including retries and browsers
    uniqueTests: 0, // Number of unique test functions
    manualTiming: {
      trial1: 15.56,
      trial2: 16.5,
      trial3: 18.2,
      average: 0
    },
    automatedTiming: {
      total: 0,
      average: 0
    }
  };

  const testResultsList = [];
  let totalDuration = 0;
  let testCount = 0;
  const testMap = new Map(); // Track consolidated test results by name
  const executionMap = new Map(); // Track all test executions

  // Process each test suite
  testResults.suites?.forEach(suite => {
    // Handle nested suites (like amazon.spec.ts -> Amazon Website Tests)
    if (suite.suites && suite.suites.length > 0) {
      suite.suites.forEach(nestedSuite => {
        // Handle specs within nested suites
        nestedSuite.specs?.forEach(spec => {
          spec.tests?.forEach(test => {
            // Add spec title to test object for proper naming
            test.specTitle = spec.title;
            
            // Count all test executions (including retries and browsers)
            if (test.results && test.results.length > 0) {
              test.results.forEach((result, index) => {
                const executionKey = `${test.specTitle}-${test.name}-${result.status}-${index}`;
                executionMap.set(executionKey, {
                  testName: test.name,
                  specTitle: test.specTitle,
                  status: result.status,
                  duration: result.duration,
                  error: result.error,
                  retryIndex: index,
                  browser: test.projectName || 'unknown'
                });
              });
            }
            
            const testResult = processTest(test);
            if (testResult) {
              // Consolidate test results by name (merge browser executions)
              if (!testMap.has(testResult.name)) {
                testMap.set(testResult.name, testResult);
              } else {
                // Merge screenshots from different browser executions
                const existing = testMap.get(testResult.name);
                existing.screenshots = [...existing.screenshots, ...testResult.screenshots];
                
                // Use the worst status (failed > flaky > passed)
                // But if ANY browser execution is flaky, mark the consolidated test as flaky
                if (testResult.status === 'flaky' || existing.status === 'flaky') {
                  existing.status = 'flaky';
                } else if (testResult.status === 'failed' || existing.status === 'failed') {
                  existing.status = 'failed';
                } else if (testResult.status === 'passed' && existing.status === 'passed') {
                  existing.status = 'passed';
                }
              }
              
              // Calculate total duration from all test results (including retries)
              let testTotalDuration = 0;
              if (test.results && test.results.length > 0) {
                test.results.forEach(result => {
                  testTotalDuration += result.duration || 0;
                });
              }
              totalDuration += testTotalDuration;
              testCount++;
            }
          });
        });
      });
    } else {
      // Handle direct specs
      suite.specs?.forEach(spec => {
        spec.tests?.forEach(test => {
          // Add spec title to test object for proper naming
          test.specTitle = spec.title;
          
          // Count all test executions (including retries and browsers)
          if (test.results && test.results.length > 0) {
            test.results.forEach((result, index) => {
              const executionKey = `${test.specTitle}-${test.name}-${result.status}-${index}`;
              executionMap.set(executionKey, {
                testName: test.name,
                specTitle: test.specTitle,
                status: result.status,
                duration: result.duration,
                error: result.error,
                retryIndex: index,
                browser: test.projectName || 'unknown'
              });
            });
          }
          
          const testResult = processTest(test);
          if (testResult) {
            // Consolidate test results by name (merge browser executions)
            if (!testMap.has(testResult.name)) {
              testMap.set(testResult.name, testResult);
            } else {
              // Merge screenshots from different browser executions
              const existing = testMap.get(testResult.name);
              existing.screenshots = [...existing.screenshots, ...testResult.screenshots];
              
              // Use the worst status (failed > flaky > passed)
              if (testResult.status === 'failed') {
                existing.status = 'failed';
              } else if (testResult.status === 'flaky' && existing.status !== 'failed') {
                existing.status = 'flaky';
              }
            }
            
            // Calculate total duration from all test results (including retries)
            let testTotalDuration = 0;
            if (test.results && test.results.length > 0) {
              test.results.forEach(result => {
                testTotalDuration += result.duration || 0;
              });
            }
            totalDuration += testTotalDuration;
            testCount++;
          }
        });
      });
    }
  });

  // Convert testMap to array and calculate summary
  testResultsList.push(...testMap.values());
  
  // Calculate summary from consolidated tests
  summary.uniqueTests = testResultsList.length;
  summary.totalExecutions = executionMap.size;
  
  testResultsList.forEach(test => {
    if (test.status === 'passed') summary.passed++;
    else if (test.status === 'failed') summary.failed++;
    else if (test.status === 'flaky') summary.flaky++;
  });
  
  summary.totalTests = summary.uniqueTests;
  
  if (summary.totalTests > 0) {
    summary.successRate = parseFloat(((summary.passed / summary.totalTests) * 100).toFixed(1));
  }
  
  if (totalDuration > 0) {
    summary.averageDuration = (totalDuration / testCount / 1000).toFixed(2);
    summary.automatedTiming.total = (totalDuration / 1000).toFixed(2);
    summary.automatedTiming.average = (totalDuration / testCount / 1000).toFixed(2);
  }
  
  summary.manualTiming.average = ((summary.manualTiming.trial1 + summary.manualTiming.trial2 + summary.manualTiming.trial3) / 3).toFixed(2);
  
  return { summary, testResultsList, executionMap };
}

function processTest(test) {
  if (!test.results || test.results.length === 0) return null;

  const firstResult = test.results[0];
  const lastResult = test.results[test.results.length - 1];
  
  const duration = lastResult.duration || 0;
  const retries = test.results.length - 1;
  
  // Determine final status and flakiness based on Playwright's actual status values
  let finalStatus = 'unknown';
  let isFlaky = false;
  
  // Check if any result has status "flaky" (this is what Playwright sets for flaky tests)
  const hasFlakyStatus = test.results.some(result => result.status === 'flaky');
  
  if (hasFlakyStatus) {
    finalStatus = 'flaky';
    isFlaky = true;
  } else if (retries > 0) {
    // If there are retries, determine if it's flaky or failed
    const firstStatus = firstResult.status;
    const lastStatus = lastResult.status;
    
    if (firstStatus === 'failed' && lastStatus === 'passed') {
      finalStatus = 'flaky';
      isFlaky = true;
    } else if (firstStatus === 'failed' && lastStatus === 'failed') {
      finalStatus = 'failed';
      isFlaky = false;
    } else if (lastStatus === 'passed' || lastStatus === 'expected') {
      finalStatus = 'passed';
      isFlaky = false;
    } else if (lastStatus === 'failed' || lastStatus === 'unexpected') {
      finalStatus = 'failed';
      isFlaky = false;
    } else {
      finalStatus = lastStatus;
      isFlaky = false;
    }
  } else {
    // No retries, use the single result status
    const status = lastResult.status;
    if (status === 'passed' || status === 'expected') {
      finalStatus = 'passed';
    } else if (status === 'failed' || status === 'unexpected') {
      finalStatus = 'failed';
    } else {
      finalStatus = status;
    }
    isFlaky = false;
  }

  // Calculate selector score
  const selectorScore = calculateSelectorScore(test, lastResult, isFlaky);
  
  // Determine consistency
  const consistency = determineConsistency(test, lastResult, isFlaky);

  // Get error message if failed
  const errorMessage = lastResult.errors?.[0]?.message;
  
  // Get screenshot information if available
  const screenshots = [];
  if (test.results && test.results.length > 0) {
    test.results.forEach((result, index) => {
      if (result.attachments && result.attachments.length > 0) {
        result.attachments.forEach(attachment => {
          if (attachment.name === 'screenshot') {
            screenshots.push({
              path: attachment.path,
              retry: index,
              browser: result.projectName || 'Unknown Browser',
              status: result.status || 'unknown'
            });
          }
        });
      }
    });
  }
  
  // Ensure we have a proper test name - never show "Unknown Test"
  // The test.title is actually the spec title, we need to get it from the parent spec
  const testName = test.specTitle || test.title || `Test ${test.id || 'ID'}`;
  const testDescription = generateDescription(testName);
  
  // Generate random test ID
  const testId = generateRandomTestId();
  
  return {
    id: testId,
    name: testName,
    description: testDescription,
    status: finalStatus,
    duration: formatDuration(duration),
    browsers: countBrowsers(test),
    selectorScore,
    consistency,
    retries,
    errorMessage,
    isFlaky,
    screenshots
  };
}

function calculateSelectorScore(test, result, isFlaky) {
  // Try to get real selector score from MCP report first
  try {
    const mcpReportPath = path.join(__dirname, 'flakiness-report.json');
    if (fs.existsSync(mcpReportPath)) {
      const mcpReport = JSON.parse(fs.readFileSync(mcpReportPath, 'utf8'));
      
      // Find matching test in MCP report
      const mcpTest = mcpReport.tests.find(t => t.title === test.title);
      if (mcpTest && mcpTest.selectorScores && mcpTest.selectorScores.length > 0) {
        // Use the average of all selector scores for this test
        const avgScore = mcpTest.selectorScores.reduce((sum, s) => sum + s.score, 0) / mcpTest.selectorScores.length;
        return Math.max(0, Math.min(10, avgScore));
      }
    }
  } catch (error) {
    // Fall back to manual calculation if MCP report reading fails
    console.log(`Warning: Could not read MCP report for selector score: ${error.message}`);
  }
  
  // Fallback to manual calculation if no MCP data available
  let score = 10;
  
  // Deduct points for failures
  if (result.status === 'failed') {
    score -= 3;
  }
  
  // Deduct points for flakiness (more severe than just failures)
  if (isFlaky) {
    score -= 2;
  }
  
  // Deduct points for retries (indicates instability)
  if (test.results && test.results.length > 1) {
    score -= (test.results.length - 1) * 1;
  }
  
  // Deduct points for complex selectors
  if (test.title && (test.title.toLowerCase().includes('search') || test.title.toLowerCase().includes('cart'))) {
    score -= 1;
  }
  
  return Math.max(0, Math.round(score * 10) / 10);
}

function determineConsistency(test, result, isFlaky) {
  if (test.results && test.results.length === 1 && result.status === 'passed') {
    return '✅ Consistent';
  } else if (isFlaky) {
    return '⚠️ Flaky (Failed then Passed)';
  } else if (result.status === 'failed') {
    return '❌ Consistently Failed';
  } else {
    return '❓ Unknown';
  }
}

function countBrowsers(test) {
  const browserCount = test.results ? test.results.length : 0;
  return `${browserCount} browser${browserCount !== 1 ? 's' : ''}`;
}

function formatDuration(duration) {
  if (duration < 1000) {
    return `${Math.round(duration)}ms`;
  } else {
    return `${(duration / 1000).toFixed(1)}s`;
  }
}

function generateRandomTestId() {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
  let result = '';
  for (let i = 0; i < 6; i++) {
    result += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return result;
}

function generateDescription(title) {
  const descriptions = {
    'search for products on amazon': '🔍 Product Search',
    'add item to cart on amazon': '🛒 Add to Cart',
    'navigate amazon categories': '📂 Category Navigation',
    'amazon login form interaction': '🔐 Login Form',
    'search': 'Product Search',
    'cart': 'Add to Cart',
    'navigate': 'Category Navigation',
    'login': 'Login Form',
    'category': 'Category Navigation',
    'product': 'Product Interaction',
    'amazon': 'Amazon Functionality',
    'mcp': 'MCP Functionality'
  };

  // First try exact match for Amazon tests
  const exactMatch = descriptions[title.toLowerCase()];
  if (exactMatch) {
    return exactMatch;
  }

  // Then try partial matches
  for (const [key, desc] of Object.entries(descriptions)) {
    if (title.toLowerCase().includes(key)) {
      return desc;
    }
  }
  
  return 'Test Function';
}

function generateFlakinessAnalysis(testResultsList) {
  const analysis = [];
  
  testResultsList.forEach(test => {
    // Only analyze tests that are actually flaky (failed first, passed on retry)
    if (!test.isFlaky) {
      return;
    }

    let flakinessType = 'Intermittent Failure';
    let rootCause = 'Test passes sometimes, fails others';
    let severity = analyzeFlakinessSeverity(test);
    let recommendedAction = 'Investigate root cause and improve test stability';

    // Analyze the specific flakiness pattern
    if (test.errorMessage?.includes('selector') || test.errorMessage?.includes('locator')) {
      rootCause = 'Selector instability - elements appear/disappear';
      recommendedAction = 'Use more robust selectors and add proper waits';
    } else if (test.errorMessage?.includes('timeout')) {
      rootCause = 'Timing instability - elements load at different speeds';
      recommendedAction = 'Add proper waits and increase timeouts';
    } else if (test.errorMessage?.includes('network')) {
      rootCause = 'Network instability - API responses vary';
      recommendedAction = 'Add network state waits and retry logic';
    } else if (test.errorMessage?.includes('strict mode violation')) {
      rootCause = 'Multiple elements found - page structure varies';
      recommendedAction = 'Use more specific selectors or first()/nth() methods';
    } else {
      rootCause = 'Test behavior varies between runs';
      recommendedAction = 'Investigate test logic and add proper isolation';
    }

    analysis.push({
      testName: test.name,
      flakinessType,
      rootCause,
      severity,
      recommendedAction
    });
  });

  return analysis;
}

function analyzeFlakinessSeverity(test) {
  let severityScore = 0;
  
  // Factor 1: Number of retries (more retries = higher severity)
  if (test.retries === 1) {
    severityScore += 1;  // Low severity
  } else if (test.retries === 2) {
    severityScore += 2;  // Medium severity
  } else if (test.retries >= 3) {
    severityScore += 3;  // High severity
  }
  
  // Factor 2: Selector score (lower score = higher severity)
  if (test.selectorScore >= 8) {
    severityScore += 1;  // Low severity
  } else if (test.selectorScore >= 5) {
    severityScore += 2;  // Medium severity
  } else {
    severityScore += 3;  // High severity
  }
  
  // Factor 3: Error type analysis
  if (test.errorMessage?.includes('strict mode violation')) {
    severityScore += 2;  // High severity - multiple elements found
  } else if (test.errorMessage?.includes('timeout')) {
    severityScore += 2;  // High severity - timing issues
  } else if (test.errorMessage?.includes('selector') || test.errorMessage?.includes('locator')) {
    severityScore += 1;  // Medium severity - selector issues
  }
  
  // Factor 4: Test duration variance (if available)
  if (test.duration && test.duration.includes('s')) {
    const duration = parseFloat(test.duration);
    if (duration > 10) {
      severityScore += 1;  // High severity - slow execution
    }
  }
  
  // Determine final severity based on score
  if (severityScore <= 3) {
    return 'Low';
  } else if (severityScore <= 6) {
    return 'Medium';
  } else {
    return 'High';
  }
}

function generateRecommendations(summary, testResultsList) {
  const recommendations = [];

  if (summary.successRate < 50) {
    recommendations.push('Critical: Test suite has high failure rate. Review test environment and selectors.');
  } else if (summary.successRate < 80) {
    recommendations.push('Warning: Test suite has moderate failure rate. Consider improving test stability.');
  }

  if (summary.flaky > 0) {
    recommendations.push('Flaky tests detected. Implement retry mechanisms and investigate root causes.');
  }

  if (summary.averageDuration > 10000) {
    recommendations.push('Tests are running slowly. Optimize test performance and reduce unnecessary waits.');
  }

  if (testResultsList.some(t => t.selectorScore < 5)) {
    recommendations.push('Low selector scores detected. Improve selector quality and stability.');
  }

  // Check for browser installation issues
  if (testResultsList.some(t => t.errorMessage?.includes('browserType.launch'))) {
    recommendations.push('Browser installation issue detected. Run "npx playwright install" to fix.');
  }

  if (recommendations.length === 0) {
    recommendations.push('Test suite is performing well. Continue monitoring for any degradation.');
  }

  return recommendations;
}

// Generate the report
const { summary, testResultsList, executionMap } = analyzeTestResults();
const flakinessAnalysis = generateFlakinessAnalysis(testResultsList);
const recommendations = generateRecommendations(summary, testResultsList);

// Generate HTML
const html = generateHTML(summary, testResultsList, flakinessAnalysis, recommendations, executionMap);

// Write the report
const outputPath = path.join(__dirname, 'reports', 'dynamic-flakiness-report.html');
fs.writeFileSync(outputPath, html, 'utf8');

console.log(`✅ Dynamic flakiness report generated: ${outputPath}`);
console.log(`📊 Summary: ${summary.totalTests} tests, ${summary.successRate.toFixed(1)}% success rate`);

function generateHTML(summary, testResultsList, flakinessAnalysis, recommendations, executionMap) {
  const statusBadge = (status) => {
    const statusClass = (status === 'passed' || status === 'expected') ? 'status-passed' : 
                       status === 'flaky' ? 'status-flaky' : 'status-failed';
    const statusText = (status === 'passed' || status === 'expected') ? 'Passed' : 
                      status === 'flaky' ? 'Flaky' : 'Failed';
    return `<span class="status-badge ${statusClass}">${statusText}</span>`;
  };

  const selectorScoreBadge = (score) => {
    let className = 'excellent';
    if (score < 5) className = 'poor';
    else if (score < 8) className = 'good';
    
    return `<span class="selector-score ${className}">${score}/10</span>`;
  };

  const severityColor = (severity) => {
    switch (severity.toLowerCase()) {
      case 'critical': return '#dc3545';
      case 'high': return '#fd7e14';
      case 'medium': return '#ffc107';
      default: return '#28a745';
    }
  };

  return `<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Dynamic Flakiness Report - Generated Analysis</title>
    <style>
        * {
            margin: 0;
            padding: 0;
            box-sizing: border-box;
        }

        body {
            font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;
            background: #ffffff;
            color: #333333;
            line-height: 1.6;
        }

        .container {
            max-width: 1400px;
            margin: 0 auto;
            padding: 20px;
        }

        .header {
            text-align: center;
            margin-bottom: 40px;
            padding: 30px;
            background: linear-gradient(135deg, #f8f9fa 0%, #e9ecef 100%);
            border-radius: 15px;
            border: 2px solid #007bff;
        }
        
        /* 🔗 Quick Links Styling */
        .quick-links {
            display: flex;
            gap: 20px;
            margin: 25px 0;
            flex-wrap: wrap;
            justify-content: center;
        }
        
        .quick-link {
            display: flex;
            flex-direction: column;
            align-items: center;
            padding: 15px 25px;
            border-radius: 12px;
            text-decoration: none;
            transition: all 0.3s ease;
            min-width: 200px;
            text-align: center;
            position: relative;
            overflow: hidden;
        }
        
        .quick-link::before {
            content: '';
            position: absolute;
            top: 0;
            left: -100%;
            width: 100%;
            height: 100%;
            background: linear-gradient(90deg, transparent, rgba(255,255,255,0.2), transparent);
            transition: left 0.5s ease;
        }
        
        .quick-link:hover::before {
            left: 100%;
        }
        
        .mcp-report-link {
            background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
            color: white;
            box-shadow: 0 4px 15px rgba(102, 126, 234, 0.3);
        }
        
        .mcp-report-link:hover {
            transform: translateY(-3px);
            box-shadow: 0 8px 25px rgba(102, 126, 234, 0.4);
        }
        
        .screenshots-link {
            background: linear-gradient(135deg, #f093fb 0%, #f5576c 100%);
            color: white;
            box-shadow: 0 4px 15px rgba(240, 147, 251, 0.3);
        }
        
        .screenshots-link:hover {
            transform: translateY(-3px);
            box-shadow: 0 8px 25px rgba(240, 147, 251, 0.4);
        }
        
        .quick-link strong {
            font-size: 1.1rem;
            font-weight: 600;
            margin-bottom: 5px;
        }
        
        .link-description {
            font-size: 0.85rem;
            opacity: 0.9;
            line-height: 1.3;
        }

        .header h1 {
            font-size: 3rem;
            margin-bottom: 10px;
            background: linear-gradient(45deg, #007bff, #0056b3);
            -webkit-background-clip: text;
            -webkit-text-fill-color: transparent;
            background-clip: text;
        }

        .header p {
            font-size: 1.2rem;
            color: #6c757d;
        }

        .summary-stats {
            display: grid;
            grid-template-columns: repeat(auto-fit, minmax(250px, 1fr));
            gap: 20px;
            margin-bottom: 40px;
        }

        .stat-card {
            background: #f8f9fa;
            padding: 25px;
            border-radius: 12px;
            border: 1px solid #dee2e6;
            text-align: center;
            transition: transform 0.3s ease, box-shadow 0.3s ease;
        }

        .stat-card:hover {
            transform: translateY(-5px);
            box-shadow: 0 10px 25px rgba(0, 0, 0, 0.1);
        }

        .stat-number {
            font-size: 2.5rem;
            font-weight: bold;
            margin-bottom: 10px;
        }

        .stat-label {
            color: #6c757d;
            font-size: 1rem;
        }

        .passed { color: #28a745; }
        .failed { color: #dc3545; }
        .flaky { color: #fd7e14; }
        .total { color: #007bff; }

        .test-results {
            background: #f8f9fa;
            border-radius: 12px;
            padding: 30px;
            margin-bottom: 40px;
            border: 1px solid #dee2e6;
        }

        .test-results h2 {
            color: #495057;
            margin-bottom: 25px;
            font-size: 1.8rem;
        }

        .test-table {
            width: 100%;
            border-collapse: collapse;
            margin-top: 20px;
        }

        .test-table th,
        .test-table td {
            padding: 15px;
            text-align: left;
            border-bottom: 1px solid #dee2e6;
        }

        .test-table th {
            background: #e9ecef;
            color: #495057;
            font-weight: 600;
        }

        .test-table tr:hover {
            background: #e9ecef;
        }

        .status-badge {
            padding: 6px 12px;
            border-radius: 20px;
            font-size: 0.85rem;
            font-weight: 600;
            text-transform: uppercase;
        }

        .status-passed {
            background: #d4edda;
            color: #155724;
        }

        .status-failed {
            background: #f8d7da;
            color: #721c24;
        }

        .status-flaky {
            background: #fff3cd;
            color: #856404;
        }

        .selector-score {
            padding: 6px 12px;
            border-radius: 20px;
            font-size: 0.85rem;
            font-weight: 600;
            text-transform: uppercase;
        }

        .selector-score.excellent {
            background: #d4edda;
            color: #155724;
        }

        .selector-score.good {
            background: #fff3cd;
            color: #856404;
        }

        .selector-score.poor {
            background: #f8d7da;
            color: #721c24;
        }

        .flakiness-reasons {
            background: #f8f9fa;
            border-radius: 12px;
            padding: 30px;
            margin-bottom: 40px;
            border: 1px solid #dee2e6;
        }

        .flakiness-reasons h2 {
            color: #495057;
            margin-bottom: 25px;
            font-size: 1.8rem;
        }

        .no-flakiness-message {
            background: linear-gradient(135deg, #d4edda 0%, #c3e6cb 100%);
            color: #155724;
            padding: 30px;
            border-radius: 12px;
            text-align: center;
            margin-bottom: 40px;
            border: 2px solid #28a745;
        }

        .no-flakiness-message h3 {
            font-size: 1.8rem;
            margin-bottom: 15px;
            color: #155724;
        }

        .no-flakiness-message p {
            font-size: 1.1rem;
            margin-bottom: 10px;
            opacity: 0.9;
        }

        .reason-table {
            width: 100%;
            border-collapse: collapse;
        }

        .reason-table th,
        .reason-table td {
            padding: 15px;
            text-align: left;
            border-bottom: 1px solid #dee2e6;
        }

        .reason-table th {
            background: #e9ecef;
            color: #495057;
            font-weight: 600;
        }

        .recommendations {
            background: #f8f9fa;
            border-radius: 12px;
            padding: 30px;
            margin-bottom: 40px;
            border: 1px solid #dee2e6;
        }

        .recommendations h2 {
            color: #495057;
            margin-bottom: 25px;
            font-size: 1.8rem;
        }

        .recommendation-item {
            background: #ffffff;
            padding: 20px;
            margin: 15px 0;
            border-radius: 8px;
            border-left: 4px solid #007bff;
        }

        .recommendation-item h4 {
            color: #007bff;
            margin-bottom: 10px;
        }

        .recommendation-item p {
            color: #6c757d;
        }

        .screenshots-section {
            background: #f8f9fa;
            border-radius: 12px;
            padding: 30px;
            margin-bottom: 40px;
            border: 1px solid #dee2e6;
        }

        .screenshots-section h2 {
            color: #495057;
            margin-bottom: 25px;
            font-size: 1.8rem;
        }

        .screenshots-grid {
            display: grid;
            gap: 30px;
        }

        .screenshot-test {
            background: #ffffff;
            padding: 20px;
            border-radius: 8px;
            border: 1px solid #dee2e6;
        }

        .screenshot-test h4 {
            color: #495057;
            margin-bottom: 20px;
            font-size: 1.2rem;
        }

        .screenshot-browser-group {
            display: grid;
            grid-template-columns: repeat(auto-fit, minmax(300px, 1fr));
            gap: 20px;
        }

        .screenshot-item {
            background: #f8f9fa;
            padding: 15px;
            border-radius: 8px;
            border: 1px solid #dee2e6;
        }

        .screenshot-header {
            display: flex;
            justify-content: space-between;
            margin-bottom: 15px;
        }

        .browser-badge {
            background: #007bff;
            color: white;
            padding: 4px 12px;
            border-radius: 20px;
            font-size: 0.85rem;
            font-weight: 600;
        }

        .retry-badge {
            background: #6c757d;
            color: white;
            padding: 4px 12px;
            border-radius: 20px;
            font-size: 0.85rem;
            font-weight: 600;
        }

        .status-badge {
            padding: 4px 12px;
            border-radius: 20px;
            font-size: 0.85rem;
            font-weight: 600;
            text-transform: uppercase;
        }

        .status-badge.status-passed {
            background: #28a745;
            color: white;
        }

        .status-badge.status-failed {
            background: #dc3545;
            color: white;
        }

        .status-badge.status-flaky {
            background: #fd7e14;
            color: white;
        }

        .screenshot-image {
            text-align: center;
        }

        .no-screenshots-message {
            text-align: center;
            padding: 40px;
            color: #6c757d;
            font-style: italic;
        }

        /* Screenshot Modal */
        .screenshot-modal {
            display: none;
            position: fixed;
            z-index: 1000;
            left: 0;
            top: 0;
            width: 100%;
            height: 100%;
            background-color: rgba(0, 0, 0, 0.8);
        }

        .screenshot-modal-content {
            background-color: #fefefe;
            margin: 5% auto;
            padding: 20px;
            border-radius: 8px;
            width: 90%;
            max-width: 800px;
            text-align: center;
        }

        .screenshot-modal img {
            max-width: 100%;
            height: auto;
            border-radius: 8px;
        }

        .close-modal {
            color: #aaa;
            float: right;
            font-size: 28px;
            font-weight: bold;
            cursor: pointer;
            margin-bottom: 10px;
        }

        .close-modal:hover {
            color: #000;
        }

        .footer {
            text-align: center;
            padding: 30px;
            color: #6c757d;
            border-top: 1px solid #dee2e6;
            margin-top: 40px;
        }

        .export-section {
            text-align: center;
            margin: 30px 0;
        }

        .export-btn {
            background: linear-gradient(45deg, #007bff, #0056b3);
            color: white;
            border: none;
            padding: 15px 30px;
            border-radius: 8px;
            font-size: 1.1rem;
            cursor: pointer;
            transition: transform 0.3s ease;
        }

        .export-btn:hover {
            transform: translateY(-2px);
        }

        .timing-comparison {
            background: #f8f9fa;
            border-radius: 12px;
            padding: 30px;
            margin-bottom: 40px;
            border: 1px solid #dee2e6;
        }

        .timing-comparison h2 {
            color: #495057;
            margin-bottom: 25px;
            font-size: 1.8rem;
            text-align: center;
        }

        .timing-grid {
            display: grid;
            grid-template-columns: repeat(auto-fit, minmax(300px, 1fr));
            gap: 20px;
        }

        .timing-card {
            background: white;
            padding: 25px;
            border-radius: 12px;
            border: 1px solid #dee2e6;
            box-shadow: 0 4px 6px rgba(0, 0, 0, 0.1);
            transition: transform 0.3s ease, box-shadow 0.3s ease;
        }

        .timing-card:hover {
            transform: translateY(-5px);
            box-shadow: 0 8px 15px rgba(0, 0, 0, 0.15);
        }

        .timing-card h3 {
            color: #495057;
            margin-bottom: 20px;
            font-size: 1.3rem;
            text-align: center;
            border-bottom: 2px solid #dee2e6;
            padding-bottom: 10px;
        }

        .timing-card.manual h3 {
            border-bottom-color: #007bff;
        }

        .timing-card.automated h3 {
            border-bottom-color: #28a745;
        }

        .timing-card.efficiency h3 {
            border-bottom-color: #fd7e14;
        }

        .timing-details {
            display: flex;
            flex-direction: column;
            gap: 15px;
        }

        .timing-item {
            display: flex;
            justify-content: space-between;
            align-items: center;
            padding: 10px 0;
            border-bottom: 1px solid #f1f3f4;
        }

        .timing-item:last-child {
            border-bottom: none;
        }

        .timing-item.average {
            background: #f8f9fa;
            padding: 12px;
            border-radius: 8px;
            font-weight: 600;
            border: 2px solid #dee2e6;
        }

        .timing-item .label {
            color: #6c757d;
            font-weight: 500;
        }

        .timing-item .value {
            font-weight: 600;
            color: #495057;
        }

        .timing-item .value.positive {
            color: #28a745;
        }

        .timing-item .value.negative {
            color: #dc3545;
        }

        .generation-info {
            background: #e9ecef;
            padding: 20px;
            border-radius: 8px;
            margin-bottom: 30px;
            border: 1px solid #dee2e6;
        }

        .generation-info h3 {
            color: #495057;
            margin-bottom: 15px;
        }

        .generation-info p {
            color: #6c757d;
            margin-bottom: 5px;
        }

        /* Navigation Bar Styling */
        .navigation-bar {
            background: #2d3748;
            padding: 15px;
            border-radius: 8px;
            margin-bottom: 30px;
            text-align: center;
        }

        .navigation-bar h3 {
            color: #4ecdc4;
            margin-bottom: 15px;
        }

        .nav-button {
            background: #718096;
            color: white;
            padding: 10px 20px;
            border-radius: 6px;
            text-decoration: none;
            font-weight: 600;
            transition: background-color 0.3s ease;
        }

        .nav-button:hover {
            background: #5a677a;
        }

        .nav-button.active {
            background: #4ecdc4;
        }

        @media (max-width: 768px) {
            .container {
                padding: 10px;
            }
            
            .header h1 {
                font-size: 2rem;
            }
            
            .test-table {
                font-size: 0.9rem;
            }
        }
    </style>
</head>
<body>
    <div class="container">
        <div class="header">
            <h1>🔍 Dynamic Flakiness Report</h1>
            <p>Automatically Generated from Test Results - Real-Time Analysis</p>
            <p>Generated on: <span id="generation-time"></span></p>
        </div>

        <!-- Navigation Bar -->
        <div class="navigation-bar">
            <h3>🧭 Navigation</h3>
            <div style="display: flex; gap: 15px; justify-content: center; flex-wrap: wrap;">
                <a href="screenshots-gallery.html" class="nav-button" style="background: #718096; color: white; padding: 10px 20px; border-radius: 6px; text-decoration: none; font-weight: 600;">
                    🖼️ Screenshots Gallery
                </a>
                <a href="../playwright-report/index.html" class="nav-button" style="background: #718096; color: white; padding: 10px 20px; border-radius: 6px; text-decoration: none; font-weight: 600;">
                    🎭 Playwright Report
                </a>
            </div>
        </div>

        <div class="generation-info">
            <h3>📊 Report Generation Details</h3>
            <p><strong>Source File:</strong> test-results.json</p>
            <p><strong>Analysis Type:</strong> Dynamic Flakiness Detection</p>
            <p><strong>Total Test Executions:</strong> ${summary.totalExecutions}</p>
            <p><strong>Success Rate:</strong> ${summary.successRate}%</p>
            <p><strong>Manual Timing Data:</strong> Estimated based on typical human test execution times</p>
            <p><strong>Automated Timing Data:</strong> Extracted from actual Playwright test execution logs</p>
        </div>

        <div class="summary-stats">
            <div class="stat-card">
                <div class="stat-number total">${summary.totalTests}</div>
                <div class="stat-label">Total Test Executions</div>
                <small style="color: #6c757d;">(4 tests × 3 browsers)</small>
            </div>
            <div class="stat-card">
                <div class="stat-number passed">${summary.passed}</div>
                <div class="stat-label">Passed Executions</div>
                <small style="color: #6c757d;">(${summary.successRate}% success rate)</small>
            </div>
            <div class="stat-card">
                <div class="stat-number failed">${summary.failed}</div>
                <div class="stat-label">Failed Executions</div>
                <small style="color: #6c757d;">(${summary.failed} failures)</small>
            </div>
            <div class="stat-card">
                <div class="stat-number flaky">${summary.flaky}</div>
                <div class="stat-label">Flaky Tests</div>
                <small style="color: #6c757d;">(${summary.flaky} flaky)</small>
            </div>
        </div>

        <div style="background: #2d3748; padding: 20px; border-radius: 8px; margin-bottom: 30px; border: 1px solid #4a5568;">
            <h3 style="color: #4ecdc4; margin-bottom: 15px;">📊 Test Execution Breakdown</h3>
            <p style="color: #a0aec0; margin-bottom: 10px;">
                <strong>4 Test Functions</strong> × <strong>3 Browsers</strong> = <strong>${summary.totalExecutions} Total Executions</strong>
            </p>
            <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(200px, 1fr)); gap: 15px; margin-top: 15px;">
                <div style="background: #f7fafc; padding: 15px; border-radius: 8px; border: 1px solid #e2e8f0;">
                    <div style="font-size: 1.5em; font-weight: bold; color: #2d3748;">${summary.uniqueTests}</div>
                    <div style="color: #4a5568; font-size: 0.9em;">Unique Test Functions</div>
                 </div>
                 <div style="background: #f7fafc; padding: 15px; border-radius: 8px; border: 1px solid #e2e8f0;">
                    <div style="font-size: 1.5em; font-weight: bold; color: #2d3748;">${summary.totalExecutions}</div>
                    <div style="color: #4a5568; font-size: 0.9em;">Total Test Executions</div>
                    <small style="color: #718096;">(Including retries & browsers)</small>
                 </div>
                 <div style="background: #f7fafc; padding: 15px; border-radius: 8px; border: 1px solid #e2e8f0;">
                    <div style="font-size: 1.5em; font-weight: bold; color: #2d3748;">3</div>
                    <div style="color: #4a5568; font-size: 0.9em;">Browsers Tested</div>
                    <small style="color: #718096;">(Chromium, Firefox, WebKit)</small>
                 </div>
                 <div style="background: #f7fafc; padding: 15px; border-radius: 8px; border: 1px solid #e2e8f0;">
                    <div style="font-size: 1.5em; font-weight: bold; color: #2d3748;">${summary.averageDuration}s</div>
                    <div style="color: #4a5568; font-size: 0.9em;">Average Duration</div>
                    <small style="color: #718096;">(Per execution)</small>
                 </div>
              </div>
              
              <!-- Detailed Execution Breakdown -->
              <div style="margin-top: 20px; background: #f7fafc; padding: 20px; border-radius: 8px; border: 1px solid #e2e8f0;">
                 <h4 style="color: #2d3748; margin-bottom: 15px;">🔍 Detailed Test Execution Breakdown</h4>
                 <div style="overflow-x: auto;">
                    <table style="width: 100%; border-collapse: collapse; font-size: 0.9em;">
                       <thead>
                          <tr style="background: #edf2f7; border-bottom: 2px solid #cbd5e0;">
                             <th style="padding: 10px; text-align: left; border-bottom: 1px solid #cbd5e0;">Test Function</th>
                             <th style="padding: 10px; text-align: left; border-bottom: 1px solid #cbd5e0;">Browser</th>
                             <th style="padding: 10px; text-align: left; border-bottom: 1px solid #cbd5e0;">Status</th>
                             <th style="padding: 10px; text-align: left; border-bottom: 1px solid #cbd5e0;">Duration</th>
                             <th style="padding: 10px; text-align: left; border-bottom: 1px solid #cbd5e0;">Retry</th>
                          </tr>
                       </thead>
                       <tbody>
                          ${Array.from(executionMap.values()).map(execution => `
                             <tr style="border-bottom: 1px solid #e2e8f0;">
                                <td style="padding: 10px;">${execution.testName}</td>
                                <td style="padding: 10px;">
                                   <span style="padding: 2px 6px; border-radius: 4px; font-size: 0.8em; font-weight: 600; 
                                   ${execution.browser === 'chromium' ? 'background: #4299e1; color: white;' : 
                                     execution.browser === 'firefox' ? 'background: #ed8936; color: white;' : 
                                     execution.browser === 'webkit' ? 'background: #38a169; color: white;' : 
                                     'background: #718096; color: white;'}">${execution.browser}</span>
                                </td>
                                <td style="padding: 10px;">
                                   <span class="status-badge ${execution.status}">${execution.status.toUpperCase()}</span>
                                </td>
                                <td style="padding: 10px;">${(execution.duration / 1000).toFixed(2)}s</td>
                                <td style="padding: 10px;">
                                   ${execution.retryIndex === 0 ? 'Initial' : `Retry #${execution.retryIndex}`}
                                </td>
                             </tr>
                          `).join('')}
                       </tbody>
                    </table>
                 </div>
              </div>
        </div>

        <div class="timing-comparison">
            <h2>⏱️ Manual vs Automated Timing Comparison</h2>
            <p style="color: #6c757d; margin-bottom: 20px; font-style: italic; text-align: center;">
                <strong>Automated timing</strong> represents the total time required to calculate and execute all tests across 3 browsers in parallel.<br>
                <strong>Efficiency metrics</strong> compare manual execution of 4 tests vs automated execution of all test runs.
            </p>
            <div class="timing-grid">
                <div class="timing-card manual">
                    <h3>👤 Manual Test Execution</h3>
                    <div class="timing-details">
                        <div class="timing-item">
                            <span class="label">Manual Trial 1:</span>
                            <span class="value">${summary.manualTiming.trial1} secs</span>
                        </div>
                        <div class="timing-item">
                            <span class="label">Manual Trial 2:</span>
                            <span class="value">${summary.manualTiming.trial2} secs</span>
                        </div>
                        <div class="timing-item">
                            <span class="label">Manual Trial 3:</span>
                            <span class="value">${summary.manualTiming.trial3} secs</span>
                        </div>
                        <div class="timing-item average">
                            <span class="label">Average Manual Time:</span>
                            <span class="value">${summary.manualTiming.average} secs</span>
                        </div>
                    </div>
                </div>
                
                <div class="timing-card automated">
                    <h3>🤖 Automated Test Execution</h3>
                    <div class="timing-details">
                        <div class="timing-item">
                            <span class="label">Total Time to Calculate All Tests:</span>
                            <span class="value">${summary.automatedTiming.total} secs</span>
                        </div>
                        <div class="timing-item">
                            <span class="label">Average Per Test Execution:</span>
                            <span class="value">${summary.automatedTiming.average} secs</span>
                        </div>
                        <div class="timing-item">
                            <span class="label">Parallel Execution:</span>
                            <span class="value">3 browsers simultaneously</span>
                        </div>
                    </div>
                </div>
                

            </div>
        </div>

        <div class="test-results">
            <h2>📊 Test Results Analysis</h2>
            <table class="test-table">
                <thead>
                    <tr>
                        <th>Test ID</th>
                        <th>Test Name</th>
                        <th>Description</th>
                        <th>Status</th>
                        <th>Duration</th>
                        <th>Browsers</th>
                        <th>Selector Score</th>
                        <th>Consistency</th>
                        <th>Retries</th>
                    </tr>
                </thead>
                <tbody>
                    ${testResultsList.map(test => `
                        <tr>
                            <td><code style="background: #e9ecef; padding: 4px 8px; border-radius: 4px; font-family: 'Courier New', monospace;">${test.id}</code></td>
                            <td>${test.name}</td>
                            <td>${test.description}</td>
                            <td>${statusBadge(test.status)}</td>
                            <td>${test.duration}</td>
                            <td>${test.browsers}</td>
                            <td>${selectorScoreBadge(test.selectorScore)}</td>
                            <td>${test.consistency}</td>
                            <td>${test.retries}</td>
                        </tr>
                    `).join('')}
                </tbody>
            </table>
        </div>

        <!-- Detailed Selector Analysis Section -->
        <div class="selector-analysis" style="margin-top: 30px; background: #f8f9fa; padding: 25px; border-radius: 12px; border: 1px solid #dee2e6;">
            <h2>🎯 Selector Analysis & Quality Assessment</h2>
            <p style="color: #6c757d; margin-bottom: 20px; font-style: italic;">
                Based on real selector data extracted from Playwright test execution results.
            </p>
            
            ${(() => {
                try {
                    const mcpReportPath = path.join(__dirname, 'flakiness-report.json');
                    if (fs.existsSync(mcpReportPath)) {
                        const mcpReport = JSON.parse(fs.readFileSync(mcpReportPath, 'utf8'));
                        const testsWithSelectors = mcpReport.tests.filter(t => t.selectorScores && t.selectorScores.length > 0);
                        
                        if (testsWithSelectors.length > 0) {
                            return `
                                <div style="background: #ffffff; padding: 20px; border-radius: 8px; border: 1px solid #e9ecef;">
                                    <h3 style="color: #495057; margin-bottom: 15px;">📊 Selector Quality Breakdown</h3>
                                    <div style="display: grid; gap: 15px;">
                                        ${testsWithSelectors.map(test => `
                                            <div style="background: #f8f9fa; padding: 15px; border-radius: 6px; border: 1px solid #dee2e6;">
                                                <h4 style="color: #495057; margin-bottom: 10px;">${test.title}</h4>
                                                <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(200px, 1fr)); gap: 10px;">
                                                    ${test.selectorScores.map(selector => `
                                                        <div style="background: #ffffff; padding: 10px; border-radius: 4px; border: 1px solid #dee2e6;">
                                                            <div style="font-weight: 600; color: #495057;">Selector: <code style="background: #e9ecef; padding: 2px 4px; border-radius: 2px; font-size: 0.9em;">${selector.target}</code></div>
                                                            <div style="color: #6c757d; font-size: 0.9em;">Method: ${selector.method}</div>
                                                            <div style="color: ${selector.score >= 8 ? '#28a745' : selector.score >= 5 ? '#ffc107' : '#dc3545'}; font-weight: 600;">
                                                                Score: ${selector.score.toFixed(1)}/10
                                                            </div>
                                                        </div>
                                                    `).join('')}
                                                </div>
                                            </div>
                                        `).join('')}
                                    </div>
                                </div>
                            `;
                        } else {
                            return `
                                <div style="background: #fff3cd; padding: 20px; border-radius: 8px; border: 1px solid #ffeaa7;">
                                    <h3 style="color: #856404; margin-bottom: 15px;">⚠️ No Selector Data Available</h3>
                                    <p style="color: #856404; margin-bottom: 10px;">
                                        <strong>Current Status:</strong> Selector information is being calculated manually.
                                    </p>
                                    <p style="color: #856404; margin-bottom: 10px;">
                                        <strong>Recommendation:</strong> Run tests with enhanced selector logging to get real selector quality data.
                                    </p>
                                </div>
                            `;
                        }
                    } else {
                        return `
                            <div style="background: #f8d7da; padding: 20px; border-radius: 8px; border: 1px solid #f5c6cb;">
                                <h3 style="color: #721c24; margin-bottom: 15px;">❌ MCP Report Not Found</h3>
                                <p style="color: #721c24; margin-bottom: 10px;">
                                    <strong>Issue:</strong> The flakiness report (flakiness-report.json) was not found.
                                </p>
                                <p style="color: #721c24; margin-bottom: 10px;">
                                    <strong>Solution:</strong> Ensure tests are run with the MCP reporter enabled.
                                </p>
                            </div>
                        `;
                    }
                } catch (error) {
                    return `
                        <div style="background: #f8d7da; padding: 20px; border-radius: 8px; border: 1px solid #f5c6cb;">
                            <h3 style="color: #721c24; margin-bottom: 15px;">❌ Error Reading Selector Data</h3>
                            <p style="color: #721c24; margin-bottom: 10px;">
                                <strong>Error:</strong> ${error.message}
                            </p>
                            <p style="color: #721c24; margin-bottom: 10px;">
                                <strong>Fallback:</strong> Using manual selector score calculations.
                            </p>
                        </div>
                    `;
                }
            })()}
        </div>

        <!-- Screenshots Section -->
        <div style="margin-top: 30px; background: #fff5f5; padding: 20px; border-radius: 8px; border: 1px solid #fed7d7;">
           <h3 style="color: #c53030; margin-bottom: 15px;">📸 Test Screenshots & Visual Evidence</h3>
           <p style="color: #742a2a; margin-bottom: 15px;">
              <strong>${testResultsList.filter(t => t.screenshots && t.screenshots.length > 0).length} tests have screenshots available</strong> for detailed analysis.
           </p>
           <div style="background: #fed7d7; padding: 15px; border-radius: 6px; border: 1px solid #feb2b2;">
              <p style="color: #742a2a; margin: 0; font-weight: 600;">
                 🔗 <a href="screenshots-gallery.html" style="color: #c53030; text-decoration: underline;">Click here to view all screenshots with browser names and error messages</a>
              </p>
              <p style="color: #742a2a; margin: 5px 0 0 0; font-size: 0.9em;">
                 The screenshots gallery shows detailed information including browser names, error messages, and test context for each failed test execution.
              </p>
           </div>
        </div>

        ${flakinessAnalysis.length > 0 ? `
        <div class="flakiness-reasons">
            <h2>🚨 Flakiness Analysis & Root Causes</h2>
            <p style="color: #6c757d; margin-bottom: 20px; font-style: italic;">
                Only tests that failed first and then passed on retry are shown below (true flakiness).
            </p>
            <table class="reason-table">
                <thead>
                    <tr>
                        <th>Test Name</th>
                        <th>Flakiness Type</th>
                        <th>Root Cause</th>
                        <th>Severity</th>
                        <th>Recommended Action</th>
                    </tr>
                </thead>
                <tbody>
                    ${flakinessAnalysis.map(analysis => `
                        <tr>
                            <td>${analysis.testName}</td>
                            <td>${analysis.flakinessType}</td>
                            <td>${analysis.rootCause}</td>
                            <td style="color: ${severityColor(analysis.severity)};">${analysis.severity}</td>
                            <td>${analysis.recommendedAction}</td>
                        </tr>
                    `).join('')}
                </tbody>
            </table>
        </div>
        ` : `
        <div class="no-flakiness-message">
            <h3>🎯 No Flaky Tests Detected</h3>
            <p><strong>Excellent news!</strong> All tests are running consistently and reliably.</p>
            <p><strong>What this means:</strong> Your test suite is stable and well-designed.</p>
            <p><strong>Recommendation:</strong> Continue with your current testing practices.</p>
        </div>
        `}

        <div class="recommendations">
            <h2>💡 Recommendations</h2>
            ${recommendations.map(rec => `
                <div class="recommendation-item">
                    <h4>💡 Recommendation</h4>
                    <p>${rec}</p>
                </div>
            `).join('')}
        </div>

        <div class="export-section">
            <button class="export-btn" onclick="exportToPDF()">📄 Export to PDF</button>
        </div>

        <div class="footer">
            <p>Generated by Dynamic Flakiness Analyzer</p>
            <p>Real-Time Test Results Analysis</p>
        </div>
    </div>

    <!-- Screenshot Modal -->
    <div id="screenshotModal" class="screenshot-modal">
        <div class="screenshot-modal-content">
            <span class="close-modal" onclick="closeScreenshotModal()">&times;</span>
            <h3 id="modalTitle">Screenshot</h3>
            <img id="modalImage" src="" alt="Screenshot">
        </div>
    </div>

    <script>
        // Set generation time
        document.getElementById('generation-time').textContent = new Date().toLocaleString();

        // Export to PDF functionality
        function exportToPDF() {
            window.print();
        }

        // Screenshot modal functionality
        function openScreenshotModal(imageSrc, title) {
            document.getElementById('modalImage').src = imageSrc;
            document.getElementById('modalTitle').textContent = title;
            document.getElementById('screenshotModal').style.display = 'block';
        }

        function closeScreenshotModal() {
            document.getElementById('screenshotModal').style.display = 'none';
        }

        // Close modal when clicking outside of it
        window.onclick = function(event) {
            const modal = document.getElementById('screenshotModal');
            if (event.target === modal) {
                closeScreenshotModal();
            }
        }

        // Add interactive features
        document.addEventListener('DOMContentLoaded', function() {
            // Add click handlers for test rows
            const testRows = document.querySelectorAll('tbody tr');
            testRows.forEach(row => {
                row.addEventListener('click', function() {
                    // Toggle selection
                    this.classList.toggle('selected');
                });
            });

            // Add hover effects
            const statCards = document.querySelectorAll('.stat-card');
            statCards.forEach(card => {
                card.addEventListener('mouseenter', function() {
                    this.style.transform = 'translateY(-5px) scale(1.02)';
                });
                card.addEventListener('mouseleave', function() {
                    this.style.transform = 'translateY(0) scale(1)';
                });
            });
        });
    </script>
</body>
</html>`;
}
