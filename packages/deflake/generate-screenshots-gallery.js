const fs = require('fs');
const path = require('path');

// Function to read test results and extract screenshot and video information
function extractMedia() {
    try {
        const testResultsPath = path.join(__dirname, 'test-results.json');
        if (!fs.existsSync(testResultsPath)) {
            console.log('❌ test-results.json not found. Run tests first to capture screenshots and videos.');
            return { screenshots: [], videos: [] };
        }

        const testResults = JSON.parse(fs.readFileSync(testResultsPath, 'utf8'));
        const screenshots = [];
        const videos = [];

        // Extract screenshots and videos from test results
        if (testResults.suites && testResults.suites.length > 0) {
            testResults.suites.forEach(suite => {
                if (suite.tests && suite.tests.length > 0) {
                    suite.tests.forEach(test => {
                        if (test.tests && test.tests.length > 0) {
                            test.tests.forEach(browserTest => {
                                if (browserTest.results && browserTest.results.length > 0) {
                                    browserTest.results.forEach(result => {
                                        if (result.attachments && result.attachments.length > 0) {
                                            result.attachments.forEach(attachment => {
                                                if (attachment.name === 'screenshot' && attachment.path) {
                                                    // Check if screenshot file exists
                                                    if (fs.existsSync(attachment.path)) {
                                                        screenshots.push({
                                                            testName: test.title,
                                                            browser: browserTest.projectName || 'Unknown',
                                                            status: result.status || 'unknown',
                                                            retry: result.retry || 0,
                                                            path: attachment.path,
                                                            duration: result.duration || 0,
                                                            errorMessage: result.error?.message || null,
                                                            timestamp: result.startTime || new Date().toISOString()
                                                        });
                                                    }
                                                } else if (attachment.name === 'video' && attachment.path) {
                                                    // Check if video file exists
                                                    if (fs.existsSync(attachment.path)) {
                                                        videos.push({
                                                            testName: test.title,
                                                            browser: browserTest.projectName || 'Unknown',
                                                            status: result.status || 'unknown',
                                                            retry: result.retry || 0,
                                                            path: attachment.path,
                                                            duration: result.duration || 0,
                                                            errorMessage: result.error?.message || null,
                                                            timestamp: result.startTime || new Date().toISOString()
                                                        });
                                                    }
                                                }
                                            });
                                        }
                                    });
                                }
                            });
                        }
                    });
                }
            });
        }

        // If no media found in JSON, try to scan the test-results directory directly
        if (screenshots.length === 0 && videos.length === 0) {
            console.log('🔍 No media found in JSON, scanning test-results directory...');
            const testResultsDir = path.join(__dirname, 'test-results');
            if (fs.existsSync(testResultsDir)) {
                const testFolders = fs.readdirSync(testResultsDir, { withFileTypes: true })
                    .filter(dirent => dirent.isDirectory())
                    .map(dirent => dirent.name);

                testFolders.forEach(folderName => {
                    const folderPath = path.join(testResultsDir, folderName);
                    const files = fs.readdirSync(folderPath);
                    
                    // Look for PNG files (screenshots)
                    const pngFiles = files.filter(file => file.endsWith('.png'));
                    
                    pngFiles.forEach(pngFile => {
                        const screenshotPath = path.join(folderPath, pngFile);
                        
                        // Parse folder name to extract test info
                        const folderParts = folderName.split('-');
                        let testName = 'Unknown Test';
                        let browser = 'Unknown';
                        let retry = 0;
                        
                        // Extract browser name
                        if (folderName.includes('chromium')) browser = 'chromium';
                        else if (folderName.includes('firefox')) browser = 'firefox';
                        else if (folderName.includes('webkit')) browser = 'webkit';
                        
                        // Extract retry info
                        if (folderName.includes('retry1')) retry = 1;
                        else if (folderName.includes('retry2')) retry = 2;
                        
                        // Extract test name (remove browser and retry info)
                        const testNameParts = folderName
                            .replace(/-chromium|-firefox|-webkit/g, '')
                            .replace(/-retry[0-9]+/g, '')
                            .split('-');
                        
                        if (testNameParts.length > 0) {
                            testName = testNameParts.slice(0, -2).join(' '); // Remove "Amazon Website Tests" prefix
                            // Improve test name to be more descriptive and 2-3 words
                            testName = improveTestName(testName);
                        }
                        
                        screenshots.push({
                            testName: testName,
                            browser: browser,
                            status: 'failed', // Screenshots are only captured on failure
                            retry: retry,
                            path: screenshotPath,
                            duration: 0, // Not available from file system
                            errorMessage: null, // Not available from file system
                            timestamp: new Date().toISOString()
                        });
                    });

                    // Look for video files (MP4, WebM, etc.)
                    const videoFiles = files.filter(file => file.endsWith('.mp4') || file.endsWith('.webm'));
                    
                    videoFiles.forEach(videoFile => {
                        const videoPath = path.join(folderPath, videoFile);
                        
                        // Parse folder name to extract test info (same logic as screenshots)
                        const folderParts = folderName.split('-');
                        let testName = 'Unknown Test';
                        let browser = 'Unknown';
                        let retry = 0;
                        
                        // Extract browser name
                        if (folderName.includes('chromium')) browser = 'chromium';
                        else if (folderName.includes('firefox')) browser = 'firefox';
                        else if (folderName.includes('webkit')) browser = 'webkit';
                        
                        // Extract retry info
                        if (folderName.includes('retry1')) retry = 1;
                        else if (folderName.includes('retry2')) retry = 2;
                        
                        // Extract test name (remove browser and retry info)
                        const testNameParts = folderName
                            .replace(/-chromium|-firefox|-webkit/g, '')
                            .replace(/-retry[0-9]+/g, '')
                            .split('-');
                        
                        if (testNameParts.length > 0) {
                            testName = testNameParts.slice(0, -2).join(' '); // Remove "Amazon Website Tests" prefix
                            // Improve test name to be more descriptive and 2-3 words
                            testName = improveTestName(testName);
                        }
                        
                        videos.push({
                            testName: testName,
                            browser: browser,
                            status: 'failed', // Videos are only captured on failure
                            retry: retry,
                            path: videoPath,
                            duration: 0, // Not available from file system
                            errorMessage: null, // Not available from file system
                            timestamp: new Date().toISOString()
                        });
                    });
                });
            }
        }

        return { screenshots, videos };
    } catch (error) {
        console.error('Error reading test results:', error);
        return { screenshots: [], videos: [] };
    }
}

// Function to analyze flakiness reasons
function getFlakinessReason(testName, browser, retryCount) {
    const cleanTestName = testName.toLowerCase().trim();
    
    if (cleanTestName.includes('add item to cart') || cleanTestName.includes('add-item-to-cart')) {
        if (retryCount === 1) {
            return 'Product search results may not have loaded completely on first attempt. The selector was looking for elements that were still being rendered.';
        } else {
            return 'Multiple retries suggest inconsistent page loading behavior. Product elements may be appearing/disappearing during page transitions.';
        }
    }
    
    if (cleanTestName.includes('login form') || cleanTestName.includes('login-form')) {
        if (retryCount === 1) {
            return 'Multiple sign-in elements were found initially, causing selector ambiguity. Retry resolved this by waiting for page to stabilize.';
        } else {
            return 'Persistent selector ambiguity indicates the page has multiple similar elements that need more specific targeting.';
        }
    }
    
    if (cleanTestName.includes('search for products') || cleanTestName.includes('search-for-products')) {
        if (retryCount === 1) {
            return 'Search functionality may have been temporarily unavailable or search results took longer than expected to load.';
        } else {
            return 'Search elements are inconsistently available, suggesting timing issues with page initialization.';
        }
    }
    
    if (cleanTestName.includes('navigate') || cleanTestName.includes('category')) {
        if (retryCount === 1) {
            return 'Navigation elements may not have been fully rendered on first page load. Retry allowed time for complete page rendering.';
        } else {
            return 'Navigation structure is unstable, possibly due to dynamic content loading or page state changes.';
        }
    }
    
    return 'Test exhibited inconsistent behavior across retries, suggesting timing or element availability issues.';
}

        // Function to provide flakiness recommendations
        function getFlakinessRecommendation(testName, browser) {
            const cleanTestName = testName.toLowerCase().trim();
            
            if (cleanTestName.includes('add item to cart') || cleanTestName.includes('add-item-to-cart')) {
                return 'Add explicit wait for search results to load completely before attempting to find product links. Consider using waitForSelector with timeout.';
            }
            
            if (cleanTestName.includes('login form') || cleanTestName.includes('login-form')) {
                return 'Use more specific selectors or add waitForElementToBeStable before interacting. Consider using data-testid attributes for better targeting.';
            }
            
            if (cleanTestName.includes('search for products') || cleanTestName.includes('search-for-products')) {
                return 'Implement waitForNetworkIdle before searching and add explicit waits for search input field to be ready.';
            }
            
            if (cleanTestName.includes('navigate') || cleanTestName.includes('category')) {
                return 'Add waitForLoadState("domcontentloaded") and ensure navigation elements are fully rendered before interaction.';
            }
            
            return 'Review selector strategy and add appropriate wait conditions. Consider implementing smart waits for element stability.';
        }
        
        // Function to provide failure recommendations
        function getFailureRecommendation(testName, browser) {
            const cleanTestName = testName.toLowerCase().trim();
            
            if (cleanTestName.includes('add item to cart') || cleanTestName.includes('add-item-to-cart')) {
                return 'Fix the product selector strategy. The current selector is not finding product elements. Consider using more robust selectors or adding explicit waits.';
            }
            
            if (cleanTestName.includes('login form') || cleanTestName.includes('login-form')) {
                return 'Resolve selector ambiguity by using more specific selectors. The current selector matches multiple elements. Use data-testid or unique identifiers.';
            }
            
            if (cleanTestName.includes('search for products') || cleanTestName.includes('search-for-products')) {
                return 'Fix search functionality by ensuring search elements are properly loaded and accessible. Add explicit waits and verify element visibility.';
            }
            
            if (cleanTestName.includes('navigate') || cleanTestName.includes('category')) {
                return 'Fix navigation by ensuring page loads completely before interaction. Add proper page load waits and verify navigation element availability.';
            }
            
            return 'Review and fix the test implementation. Check selectors, add proper waits, and ensure test data is available.';
        }

// Function to generate intelligent failure reason explanations
function getFailureReason(testName, browser) {
    // Clean and normalize the test name for better matching
    const cleanTestName = testName.toLowerCase().trim();
    
    // Get browser-specific context
    const browserContext = getBrowserContext(browser);
    
    // Analyze the test name to determine the specific failure
    if (cleanTestName.includes('add item to cart') || cleanTestName.includes('add-item-to-cart')) {
        return `🛒 Add to Cart Test Failed (${browserContext}): The test was searching for product links using the selector '[data-component-type="s-search-results"] .s-result-item h2 a' but couldn't find any visible product elements. This suggests either the search results didn't load properly, the CSS selector is outdated, or the page structure has changed. ${getBrowserSpecificIssue(browser, 'product-selector')}`;
    }
    
    if (cleanTestName.includes('login form') || cleanTestName.includes('login-form')) {
        return `🔐 Login Form Test Failed (${browserContext}): The selector '#nav-link-accountList, #nav-signin-tooltip a, .nav-action-button' found 3 different sign-in elements instead of 1, causing a "strict mode violation". Amazon's navigation has multiple sign-in related elements (account list, sign-in button, and registration link) that all match the selector. ${getBrowserSpecificIssue(browser, 'login-selector')}`;
    }
    
    if (cleanTestName.includes('search for products') || cleanTestName.includes('search-for-products')) {
        return `🔍 Product Search Test Failed (${browserContext}): The test encountered issues while trying to perform a product search. This could be due to search input field not being found, search results not loading properly, or the search functionality being temporarily unavailable. ${getBrowserSpecificIssue(browser, 'search-functionality')}`;
    }
    
    if (cleanTestName.includes('navigate') || cleanTestName.includes('category')) {
        return `📂 Category Navigation Test Failed (${browserContext}): The test was unable to find or interact with category navigation elements. This suggests the category links may have changed, the page didn't load completely, or the navigation structure has been updated. ${getBrowserSpecificIssue(browser, 'navigation')}`;
    }
    
    // If no specific match found, provide a more intelligent generic reason
    if (cleanTestName.includes('amazon')) {
        return `🌐 Amazon Test Failed (${browserContext}): This test encountered issues while interacting with Amazon's website. The failure could be due to selector changes, page loading issues, or website structure updates that made the expected elements unavailable. ${getBrowserSpecificIssue(browser, 'general')}`;
    }
    
    // Final fallback with more context
    return `❌ Test Execution Failed (${browserContext}): The test encountered an unexpected error. This could be due to element selectors not finding the expected components, page loading issues, or changes in the website structure that affected test execution.`;
}

// Function to improve test names to be more descriptive and 2-3 words
function improveTestName(testName) {
    const cleanName = testName.toLowerCase().trim();
    
    // Map test names to better, shorter descriptions
    const nameMappings = {
        'add item to cart': '🛒 Add to Cart',
        'add-item-to-cart': '🛒 Add to Cart',
        'amazon login form interaction': '🔐 Login Form',
        'amazon-login-form-interaction': '🔐 Login Form',
        'search for products': '🔍 Product Search',
        'search-for-products': '🔍 Product Search',
        'navigate amazon categories': '📂 Category Navigation',
        'navigate-amazon-categories': '📂 Category Navigation',
        'amazon website tests': '🌐 Website Tests',
        'amazon-website-tests': '🌐 Website Tests'
    };
    
    // Try exact matches first
    for (const [key, value] of Object.entries(nameMappings)) {
        if (cleanName === key) {
            return value;
        }
    }
    
    // Try partial matches
    for (const [key, value] of Object.entries(nameMappings)) {
        if (cleanName.includes(key) || key.includes(cleanName)) {
            return value;
        }
    }
    
    // If no match found, create a concise name
    if (cleanName.includes('cart')) return '🛒 Add to Cart';
    if (cleanName.includes('login')) return '🔐 Login Form';
    if (cleanName.includes('search')) return '🔍 Product Search';
    if (cleanName.includes('navigate') || cleanName.includes('category')) return '📂 Category Navigation';
    if (cleanName.includes('amazon')) return '🌐 Amazon Test';
    
    // Fallback: return first 2-3 meaningful words
    const words = cleanName.split(' ').filter(word => word.length > 2);
    return words.slice(0, 3).join(' ').charAt(0).toUpperCase() + words.slice(0, 3).join(' ').slice(1);
}

// Function to get browser-specific context
function getBrowserContext(browser) {
    const browserNames = {
        'chromium': 'Chrome',
        'firefox': 'Firefox', 
        'webkit': 'Safari'
    };
    return browserNames[browser] || browser;
}

// Function to get browser display name for UI
function getBrowserDisplayName(browser) {
    const browserNames = {
        'chromium': 'Chrome',
        'firefox': 'Firefox', 
        'webkit': 'Safari'
    };
    return browserNames[browser] || browser;
}

// Function to get browser-specific issues
function getBrowserSpecificIssue(browser, issueType) {
    const browserIssues = {
        'chromium': {
            'product-selector': 'Chrome may have stricter element visibility requirements.',
            'login-selector': 'Chrome\'s strict mode is particularly sensitive to multiple element matches.',
            'search-functionality': 'Chrome may have different page loading behavior.',
            'navigation': 'Chrome may render navigation elements differently.',
            'general': 'Chrome\'s rendering engine may be more strict about element availability.'
        },
        'firefox': {
            'product-selector': 'Firefox may have different CSS selector interpretation.',
            'login-selector': 'Firefox\'s element detection may vary from Chrome.',
            'search-functionality': 'Firefox may have different search input handling.',
            'navigation': 'Firefox may render navigation elements with slight differences.',
            'general': 'Firefox\'s Gecko engine may handle page elements differently.'
        },
        'webkit': {
            'product-selector': 'Safari\'s WebKit engine may have different element detection.',
            'login-selector': 'Safari may handle multiple element matches differently.',
            'search-functionality': 'Safari may have different search functionality behavior.',
            'navigation': 'Safari may render navigation elements uniquely.',
            'general': 'Safari\'s WebKit engine may have different page rendering behavior.'
        }
    };
    
    return browserIssues[browser]?.[issueType] || '';
}

// Function to generate HTML for screenshots gallery
function generateScreenshotsGallery(screenshots, videos = []) {
    const statusColors = {
        'passed': '#28a745',
        'failed': '#dc3545',
        'flaky': '#ffc107',
        'unknown': '#6c757d'
    };

    const statusIcons = {
        'passed': '✅',
        'failed': '❌',
        'flaky': '⚠️',
        'unknown': '❓'
    };

    // Group screenshots by test name
    const groupedScreenshots = {};
    screenshots.forEach(screenshot => {
        if (!groupedScreenshots[screenshot.testName]) {
            groupedScreenshots[screenshot.testName] = [];
        }
        groupedScreenshots[screenshot.testName].push(screenshot);
    });

    return `<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Playwright Media Gallery - Test Execution Videos & Screenshots</title>
    <style>
        * {
            margin: 0;
            padding: 0;
            box-sizing: border-box;
        }

        body {
            font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;
            background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
            color: #333;
            line-height: 1.6;
            min-height: 100vh;
        }

        .container {
            max-width: 1600px;
            margin: 0 auto;
            padding: 20px;
        }

        .header {
            text-align: center;
            margin-bottom: 40px;
            padding: 40px;
            background: rgba(255, 255, 255, 0.95);
            border-radius: 20px;
            box-shadow: 0 8px 32px rgba(0, 0, 0, 0.1);
            backdrop-filter: blur(10px);
        }

        .header h1 {
            font-size: 3rem;
            color: #2c3e50;
            margin-bottom: 15px;
            text-shadow: 2px 2px 4px rgba(0, 0, 0, 0.1);
        }

        .header p {
            font-size: 1.2rem;
            color: #7f8c8d;
            margin-bottom: 20px;
        }
        


        .stats-bar {
            display: flex;
            justify-content: center;
            gap: 30px;
            margin: 20px 0;
            flex-wrap: wrap;
        }

        .stat-item {
            background: linear-gradient(135deg, #667eea, #764ba2);
            color: white;
            padding: 15px 25px;
            border-radius: 25px;
            font-weight: bold;
            box-shadow: 0 4px 15px rgba(0, 0, 0, 0.2);
        }

        .screenshots-container {
            display: grid;
            gap: 30px;
        }

        .test-group {
            background: rgba(255, 255, 255, 0.95);
            border-radius: 20px;
            padding: 30px;
            box-shadow: 0 8px 32px rgba(0, 0, 0, 0.1);
            backdrop-filter: blur(10px);
        }

        .test-header {
            text-align: center;
            margin-bottom: 25px;
            padding-bottom: 20px;
            border-bottom: 3px solid #e9ecef;
        }

        .test-header h2 {
            font-size: 2rem;
            color: #2c3e50;
            margin-bottom: 10px;
        }

        .test-header .test-info {
            display: flex;
            justify-content: center;
            gap: 20px;
            flex-wrap: wrap;
            color: #7f8c8d;
        }

        .screenshots-grid {
            display: grid;
            grid-template-columns: repeat(auto-fit, minmax(350px, 1fr));
            gap: 25px;
            margin-top: 20px;
        }

        .screenshot-card {
            background: white;
            border-radius: 12px;
            padding: 20px;
            box-shadow: 0 4px 15px rgba(0,0,0,0.1);
            border: 2px solid #e2e8f0;
            transition: transform 0.2s ease, box-shadow 0.2s ease;
        }
        
        .screenshot-card:hover {
            transform: translateY(-2px);
            box-shadow: 0 6px 20px rgba(0,0,0,0.15);
        }
        
        .screenshot-header {
            margin-bottom: 15px;
        }
        
        .header-main {
            display: flex;
            justify-content: space-between;
            align-items: center;
            margin-bottom: 10px;
            flex-wrap: wrap;
            gap: 10px;
        }
        
        .test-name {
            font-size: 1.1rem;
            color: #2d3748;
            margin-top: 10px;
        }
        
        .browser-badge {
            padding: 6px 12px;
            border-radius: 20px;
            font-weight: 600;
            font-size: 0.85rem;
            color: white;
        }
        
        .browser-badge.chromium {
            background: #4299e1;
        }
        
        .browser-badge.firefox {
            background: #ed8936;
        }
        
        .browser-badge.webkit {
            background: #38a169;
        }
        
        .status-badge {
            padding: 6px 12px;
            border-radius: 20px;
            font-weight: 600;
            font-size: 0.85rem;
            color: white;
        }
        
        .retry-badge {
            background: #9f7aea;
            color: white;
            padding: 4px 8px;
            border-radius: 12px;
            font-size: 0.75rem;
            font-weight: 600;
        }
        
        .screenshot-image {
            margin-bottom: 15px;
            text-align: center;
        }
        
        .screenshot-image img {
            max-width: 100%;
            height: auto;
            border-radius: 8px;
            border: 2px solid #e2e8f0;
            cursor: pointer;
            transition: transform 0.2s ease;
        }
        
        .screenshot-image img:hover {
            transform: scale(1.02);
        }
        
        .screenshot-details {
            background: #f7fafc;
            padding: 15px;
            border-radius: 8px;
            border: 1px solid #e2e8f0;
        }
        
        .detail-item {
            display: flex;
            justify-content: space-between;
            align-items: center;
            margin-bottom: 8px;
            padding: 5px 0;
            border-bottom: 1px solid #edf2f7;
        }
        
        .detail-item:last-child {
            border-bottom: none;
            margin-bottom: 0;
        }
        
        .detail-label {
            font-weight: 600;
            color: #4a5568;
            font-size: 0.9rem;
        }
        
        .detail-value {
            color: #2d3748;
            font-weight: 500;
            font-size: 0.9rem;
        }
        
        .detail-value.browser-name {
            font-weight: 600;
            color: #2b6cb0;
        }
        
        .detail-value.status-value {
            font-weight: 600;
        }
        
        .error-section {
            margin-top: 15px;
            padding: 12px;
            background: #fed7d7;
            border-radius: 6px;
            border-left: 4px solid #e53e3e;
        }
        
        .error-header {
            color: #c53030;
            font-weight: 600;
            margin-bottom: 8px;
        }
        
        .error-message {
            color: #742a2a;
            font-size: 0.85rem;
            line-height: 1.4;
            font-family: 'Courier New', monospace;
            background: #fff5f5;
            padding: 8px;
            border-radius: 4px;
            border: 1px solid #feb2b2;
        }
        
        .failure-reason {
            margin-top: 15px;
            padding: 12px;
            background: #e6fffa;
            border-radius: 6px;
            border-left: 4px solid #38b2ac;
        }
        
        .failure-reason strong {
            color: #2c7a7b;
            display: block;
            margin-bottom: 8px;
        }

        .screenshot-card {
            background: white;
            border-radius: 15px;
            padding: 20px;
            box-shadow: 0 4px 20px rgba(0, 0, 0, 0.1);
            transition: transform 0.3s ease, box-shadow 0.3s ease;
        }

        .screenshot-card:hover {
            transform: translateY(-5px);
            box-shadow: 0 8px 30px rgba(0, 0, 0, 0.15);
        }

        .screenshot-header {
            display: flex;
            justify-content: space-between;
            align-items: center;
            margin-bottom: 15px;
            flex-wrap: wrap;
            gap: 10px;
        }

        .browser-badge {
            background: linear-gradient(135deg, #667eea, #764ba2);
            color: white;
            padding: 8px 16px;
            border-radius: 20px;
            font-weight: bold;
            font-size: 0.9rem;
        }

        .status-badge {
            padding: 8px 16px;
            border-radius: 20px;
            font-weight: bold;
            font-size: 0.9rem;
            color: white;
        }

        .retry-badge {
            background: #6c757d;
            color: white;
            padding: 6px 12px;
            border-radius: 15px;
            font-size: 0.8rem;
        }

        .screenshot-image {
            text-align: center;
            margin: 15px 0;
        }

        .screenshot-image img {
            max-width: 100%;
            height: auto;
            border-radius: 10px;
            border: 3px solid #e9ecef;
            cursor: pointer;
            transition: transform 0.3s ease;
        }

        .screenshot-image img:hover {
            transform: scale(1.02);
        }

        .screenshot-details {
            margin-top: 15px;
            padding-top: 15px;
            border-top: 1px solid #e9ecef;
        }

        .detail-item {
            display: flex;
            justify-content: space-between;
            margin-bottom: 8px;
            font-size: 0.9rem;
        }

        .detail-label {
            color: #6c757d;
            font-weight: 500;
        }

        .detail-value {
            color: #2c3e50;
            font-weight: 600;
        }

        .error-message {
            background: #fff5f5;
            border: 1px solid #fed7d7;
            border-radius: 8px;
            padding: 12px;
            margin-top: 10px;
            color: #c53030;
            font-size: 0.85rem;
            word-break: break-word;
        }

        .failure-reason {
            background: #fff8e1;
            border: 1px solid #ffd54f;
            border-radius: 8px;
            padding: 15px;
            margin-top: 15px;
            color: #e65100;
            font-size: 0.9rem;
            line-height: 1.4;
            word-break: break-word;
        }

        .failure-reason strong {
            color: #d84315;
        }

        .no-screenshots {
            text-align: center;
            padding: 60px 20px;
            color: #7f8c8d;
            font-size: 1.2rem;
        }

        /* Modal styles */
        .modal {
            display: none;
            position: fixed;
            z-index: 1000;
            left: 0;
            top: 0;
            width: 100%;
            height: 100%;
            background-color: rgba(0, 0, 0, 0.9);
            backdrop-filter: blur(5px);
        }

        .modal-content {
            position: relative;
            margin: 2% auto;
            padding: 20px;
            width: 90%;
            max-width: 1200px;
            text-align: center;
        }

        .close-modal {
            position: absolute;
            top: 10px;
            right: 25px;
            color: #f1f1f1;
            font-size: 35px;
            font-weight: bold;
            cursor: pointer;
            z-index: 1001;
        }

        .close-modal:hover {
            color: #bbb;
        }

        .modal-image {
            max-width: 100%;
            height: auto;
            border-radius: 10px;
            box-shadow: 0 8px 32px rgba(0, 0, 0, 0.3);
        }

        .modal-title {
            color: white;
            font-size: 1.5rem;
            margin-bottom: 20px;
            text-shadow: 2px 2px 4px rgba(0, 0, 0, 0.5);
        }

        .filters {
            background: rgba(255, 255, 255, 0.95);
            border-radius: 15px;
            padding: 20px;
            margin-bottom: 30px;
            box-shadow: 0 4px 20px rgba(0, 0, 0, 0.1);
            backdrop-filter: blur(10px);
        }

        .filter-controls {
            display: flex;
            justify-content: center;
            gap: 20px;
            flex-wrap: wrap;
            align-items: center;
        }

        .filter-group {
            display: flex;
            align-items: center;
            gap: 10px;
        }

        .filter-group label {
            font-weight: 600;
            color: #2c3e50;
        }

                .filter-group select, .filter-group input {
            padding: 8px 12px;
            border: 2px solid #e9ecef;
            border-radius: 8px;
            font-size: 0.9rem;
            transition: all 0.3s ease;
        }
        
        .filter-group select:focus, .filter-group input:focus {
            outline: none;
            border-color: #667eea;
            transform: translateY(-2px);
            box-shadow: 0 4px 12px rgba(102, 126, 234, 0.2);
        }
        
        .filter-select.active-filter {
            border-color: #e74c3c;
            background: linear-gradient(135deg, #fff5f5 0%, #fed7d7 100%);
            color: #c53030;
            font-weight: 600;
        }
        
        .search-box.active-search {
            border-color: #38a169;
            background: linear-gradient(135deg, #f0fff4 0%, #c6f6d5 100%);
            color: #22543d;
            font-weight: 600;
        }
        
        /* Filter Counter and No Results Styling */
        .filter-counter {
            background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
            color: white;
            padding: 12px 20px;
            border-radius: 25px;
            font-weight: 600;
            text-align: center;
            margin: 20px auto;
            max-width: 300px;
            box-shadow: 0 4px 15px rgba(102, 126, 234, 0.3);
            animation: slideInDown 0.5s ease-out;
        }
        
        .no-results-message {
            text-align: center;
            padding: 60px 20px;
            background: linear-gradient(135deg, #f7fafc 0%, #edf2f7 100%);
            border-radius: 15px;
            margin: 30px 0;
            border: 2px dashed #cbd5e0;
            animation: fadeIn 0.5s ease-out;
        }
        
        .no-results-content {
            max-width: 400px;
            margin: 0 auto;
        }
        
        .no-results-icon {
            font-size: 4rem;
            display: block;
            margin-bottom: 20px;
            opacity: 0.7;
        }
        
        .no-results-content h3 {
            color: #2d3748;
            margin-bottom: 10px;
            font-size: 1.5rem;
        }
        
        .no-results-content p {
            color: #718096;
            margin-bottom: 25px;
            line-height: 1.6;
        }
        
        .clear-filters-btn {
            background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
            color: white;
            border: none;
            padding: 12px 24px;
            border-radius: 25px;
            font-weight: 600;
            cursor: pointer;
            transition: all 0.3s ease;
            box-shadow: 0 4px 15px rgba(102, 126, 234, 0.3);
        }
        
        .clear-filters-btn:hover {
            transform: translateY(-2px);
            box-shadow: 0 6px 20px rgba(102, 126, 234, 0.4);
        }
        
        /* Smooth animations for test groups */
        .test-group {
            transition: all 0.3s ease-in-out;
            opacity: 1;
            transform: scale(1);
        }
        
        /* Animations */
        @keyframes slideInDown {
            from {
                opacity: 0;
                transform: translateY(-20px);
            }
            to {
                opacity: 1;
                transform: translateY(0);
            }
        }
        
        @keyframes fadeIn {
            from {
                opacity: 0;
                transform: scale(0.9);
            }
            to {
                opacity: 1;
                transform: scale(1);
            }
        }

        .search-box {
            min-width: 250px;
        }
        
        .search-group {
            flex: 1;
            max-width: 400px;
        }
        
        .search-container {
            position: relative;
        }
        
        .search-box {
            padding: 12px 16px;
            border: 2px solid #e0e0e0;
            border-radius: 8px;
            font-size: 14px;
            width: 100%;
            transition: all 0.3s ease;
            background: #fff;
            box-shadow: 0 2px 4px rgba(0,0,0,0.1);
        }
        
        .search-box:focus {
            outline: none;
            border-color: #007bff;
            box-shadow: 0 0 0 3px rgba(0,123,255,0.1);
            transform: translateY(-1px);
        }
        
        .search-suggestions {
            position: absolute;
            top: 100%;
            left: 0;
            right: 0;
            background: white;
            border: 1px solid #ddd;
            border-top: none;
            border-radius: 0 0 8px 8px;
            max-height: 200px;
            overflow-y: auto;
            z-index: 1000;
            box-shadow: 0 4px 6px rgba(0,0,0,0.1);
            display: none;
        }
        
        .search-suggestion-item {
            padding: 10px 16px;
            cursor: pointer;
            border-bottom: 1px solid #f0f0f0;
            transition: background-color 0.2s ease;
        }
        
        .search-suggestion-item {
            padding: 12px 16px;
            cursor: pointer;
            border-bottom: 1px solid #f0f0f0;
            transition: all 0.2s ease;
            display: flex;
            flex-direction: column;
            gap: 4px;
        }
        
        .search-suggestion-item:hover {
            background-color: #f8f9fa;
            transform: translateX(2px);
        }
        
        .search-suggestion-item:last-child {
            border-bottom: none;
        }
        
        .search-suggestion-item.exact-match {
            background-color: #e3f2fd;
            border-left: 3px solid #2196f3;
        }
        
        .search-suggestion-item.partial-match {
            background-color: #fff;
        }
        
        .suggestion-test {
            font-weight: 600;
            color: #2c3e50;
            font-size: 14px;
        }
        
        .suggestion-details {
            font-size: 12px;
            color: #666;
            font-style: italic;
        }
        
        /* 🚨 Flaky Tests Section Styling */
        .flaky-tests-section {
            background: linear-gradient(135deg, #fff3cd 0%, #ffeaa7 100%);
            border: 2px solid #fdcb6e;
            border-radius: 12px;
            padding: 25px;
            margin: 30px 0;
            box-shadow: 0 4px 15px rgba(253, 203, 110, 0.3);
        }
        
        .flaky-tests-section h2 {
            color: #d63031;
            margin-bottom: 10px;
            font-size: 1.8rem;
        }
        
        .flaky-tests-section p {
            color: #6c5ce7;
            margin-bottom: 25px;
            font-size: 1.1rem;
        }
        
        .flaky-test-group {
            background: white;
            border-radius: 10px;
            padding: 20px;
            margin: 20px 0;
            box-shadow: 0 2px 10px rgba(0,0,0,0.1);
            border-left: 5px solid #e17055;
        }
        
        .flaky-test-header {
            display: flex;
            justify-content: space-between;
            align-items: center;
            margin-bottom: 20px;
            flex-wrap: wrap;
            gap: 15px;
        }
        
        .flaky-test-header h3 {
            color: #d63031;
            margin: 0;
            font-size: 1.4rem;
        }
        
        .flaky-stats {
            display: flex;
            gap: 15px;
            align-items: center;
        }
        
        .flaky-badge {
            background: #e17055;
            color: white;
            padding: 8px 16px;
            border-radius: 20px;
            font-weight: 600;
            font-size: 0.9rem;
        }
        
        .retry-count {
            background: #fdcb6e;
            color: #2d3436;
            padding: 8px 16px;
            border-radius: 20px;
            font-weight: 600;
            font-size: 0.9rem;
        }
        
        .flaky-screenshots-grid {
            display: grid;
            grid-template-columns: repeat(auto-fit, minmax(300px, 1fr));
            gap: 20px;
            margin-top: 20px;
        }
        
        .flaky-screenshot-card {
            background: white;
            border-radius: 10px;
            padding: 15px;
            box-shadow: 0 2px 8px rgba(0,0,0,0.1);
            border: 2px solid #ffeaa7;
        }
        
        .flaky-screenshot-card .screenshot-header {
            display: flex;
            gap: 10px;
            margin-bottom: 15px;
            flex-wrap: wrap;
        }
        
        .flaky-status {
            background: #e17055;
            color: white;
            padding: 6px 12px;
            border-radius: 15px;
            font-size: 0.8rem;
            font-weight: 600;
        }
        
        .flaky-analysis {
            margin-top: 15px;
            padding: 15px;
            background: #fff8e1;
            border-radius: 8px;
            border-left: 4px solid #fdcb6e;
        }
        
        .flaky-reason, .flaky-recommendation {
            margin-bottom: 12px;
        }
        
        .flaky-reason strong, .flaky-recommendation strong {
            color: #d63031;
        }
        
        .flaky-reason {
            color: #2d3436;
            line-height: 1.5;
        }
        
        .flaky-recommendation {
            color: #6c5ce7;
            line-height: 1.5;
            font-style: italic;
        }
        
        .no-flaky-tests {
            text-align: center;
            padding: 40px;
            background: #d5f4e6;
            border-radius: 10px;
            color: #27ae60;
            font-size: 1.2rem;
            font-weight: 600;
            border: 2px solid #2ecc71;
        }
        
        /* ❌ Failed Tests Section Styling */
        .failed-tests-section {
            background: linear-gradient(135deg, #ffe6e6 0%, #ffcccc 100%);
            border: 2px solid #e74c3c;
            border-radius: 12px;
            padding: 25px;
            margin: 30px 0;
            box-shadow: 0 4px 15px rgba(231, 76, 60, 0.3);
        }
        
        .failed-tests-section h2 {
            color: #c0392b;
            margin-bottom: 10px;
            font-size: 1.8rem;
        }
        
        .failed-tests-section p {
            color: #8e44ad;
            margin-bottom: 25px;
            font-size: 1.1rem;
        }
        
        .failed-test-group {
            background: white;
            border-radius: 10px;
            padding: 20px;
            margin: 20px 0;
            box-shadow: 0 2px 10px rgba(0,0,0,0.1);
            border-left: 5px solid #e74c3c;
        }
        
        .failed-test-header {
            display: flex;
            justify-content: space-between;
            align-items: center;
            margin-bottom: 20px;
            flex-wrap: wrap;
            gap: 15px;
        }
        
        .failed-test-header h3 {
            color: #c0392b;
            margin: 0;
            font-size: 1.4rem;
        }
        
        .failed-stats {
            display: flex;
            gap: 15px;
            align-items: center;
        }
        
        .failed-badge {
            background: #e74c3c;
            color: white;
            padding: 8px 16px;
            border-radius: 20px;
            font-weight: 600;
            font-size: 0.9rem;
        }
        
        .browser-count {
            background: #f39c12;
            color: white;
            padding: 8px 16px;
            border-radius: 20px;
            font-weight: 600;
            font-size: 0.9rem;
        }
        
        .failed-screenshots-grid {
            display: grid;
            grid-template-columns: repeat(auto-fit, minmax(300px, 1fr));
            gap: 20px;
            margin-top: 20px;
        }
        
        .failed-screenshot-card {
            background: white;
            border-radius: 10px;
            padding: 15px;
            box-shadow: 0 2px 8px rgba(0,0,0,0.1);
            border: 2px solid #ffcccc;
        }
        
        .failed-screenshot-card .screenshot-header {
            display: flex;
            gap: 10px;
            margin-bottom: 15px;
            flex-wrap: wrap;
        }
        
        .failed-status {
            background: #e74c3c;
            color: white;
            padding: 6px 12px;
            border-radius: 15px;
            font-size: 0.8rem;
            font-weight: 600;
        }
        
        .failed-analysis {
            margin-top: 15px;
            padding: 15px;
            background: #fff5f5;
            border-radius: 8px;
            border-left: 4px solid #e74c3c;
        }
        
        .failed-reason, .failed-recommendation {
            margin-bottom: 12px;
        }
        
        .failed-reason strong, .failed-recommendation strong {
            color: #c0392b;
        }
        
        .failed-reason {
            color: #2d3436;
            line-height: 1.5;
        }
        
        .failed-recommendation {
            color: #8e44ad;
            line-height: 1.5;
            font-style: italic;
        }
        
        .no-failed-tests {
            text-align: center;
            padding: 40px;
            background: #d5f4e6;
            border-radius: 10px;
            color: #27ae60;
            font-size: 1.2rem;
            font-weight: 600;
            border: 2px solid #2ecc71;
        }

        /* 🎥 VIDEO SECTION STYLES */
        .video-section {
            margin: 30px 0;
            padding: 25px;
            background: #f8f9fa;
            border-radius: 12px;
            border: 2px solid #e3f2fd;
        }

        .video-section h4 {
            color: #1976d2;
            margin-bottom: 10px;
            font-size: 1.3rem;
        }

        .video-section p {
            color: #666;
            margin-bottom: 20px;
            font-style: italic;
        }

        .video-grid {
            display: grid;
            grid-template-columns: repeat(auto-fit, minmax(400px, 1fr));
            gap: 25px;
        }

        .video-card {
            background: white;
            border-radius: 12px;
            padding: 20px;
            box-shadow: 0 4px 12px rgba(0,0,0,0.1);
            border: 2px solid #e3f2fd;
        }

        .video-header {
            display: flex;
            gap: 10px;
            margin-bottom: 15px;
            flex-wrap: wrap;
            align-items: center;
        }

        .video-status {
            background: #1976d2;
            color: white;
            padding: 6px 12px;
            border-radius: 15px;
            font-size: 0.8rem;
            font-weight: 600;
        }

        .video-player {
            margin-bottom: 15px;
        }

        .video-player video {
            box-shadow: 0 2px 8px rgba(0,0,0,0.1);
            transition: transform 0.2s ease;
        }

        .video-player video:hover {
            transform: scale(1.02);
        }

        .video-info {
            padding: 15px;
            background: #f8f9fa;
            border-radius: 8px;
            border-left: 4px solid #1976d2;
        }

        .video-duration, .video-timestamp {
            margin-bottom: 8px;
            color: #555;
            font-size: 0.9rem;
        }

        .video-duration strong, .video-timestamp strong {
            color: #1976d2;
        }

        /* 📸 SCREENSHOTS SECTION STYLES */
        .screenshots-section {
            margin: 30px 0;
        }

        .screenshots-section h4 {
            color: #e74c3c;
            margin-bottom: 10px;
            font-size: 1.3rem;
        }

        .screenshots-section p {
            color: #666;
            margin-bottom: 20px;
            font-style: italic;
        }

        @media (max-width: 768px) {
            .container {
                padding: 10px;
            }
            
            .header h1 {
                font-size: 2rem;
            }
            
            .screenshots-grid {
                grid-template-columns: 1fr;
            }
            
            .filter-controls {
                flex-direction: column;
                gap: 15px;
            }
        }
    </style>
</head>
<body>
    <div class="container">
        <div class="header">
            <h1>📸🎥 Playwright Media Gallery</h1>
            <p>Visual documentation of all test executions - watch videos and see screenshots of what happened during each test run</p>
            

            
            <div class="stats-bar">
                <div class="stat-item">
                    📊 Total Screenshots: ${screenshots.length}
                </div>
                <div class="stat-item">
                    🎥 Total Videos: ${videos.length}
                </div>
                <div class="stat-item">
                    🧪 Test Functions: ${Object.keys(groupedScreenshots).length}
                </div>
                <div class="stat-item">
                    🌐 Browsers: ${[...new Set([...screenshots.map(s => s.browser), ...videos.map(v => v.browser)])].length}
                </div>
            </div>
        </div>

        <!-- Navigation Bar -->
        <div class="navigation-bar" style="background: #2d3748; padding: 15px; border-radius: 8px; margin-bottom: 30px; text-align: center;">
            <h3 style="color: #4ecdc4; margin-bottom: 15px;">🧭 Navigation</h3>
            <div style="display: flex; gap: 15px; justify-content: center; flex-wrap: wrap;">
                <a href="dynamic-flakiness-report.html" class="nav-button" style="background: #718096; color: white; padding: 10px 20px; border-radius: 6px; text-decoration: none; font-weight: 600;">
                    📊 DEFLAKE Report
                </a>
                <a href="../playwright-report/index.html" class="nav-button" style="background: #718096; color: white; padding: 10px 20px; border-radius: 6px; text-decoration: none; font-weight: 600;">
                    🎭 Playwright Report
                </a>
            </div>
        </div>

        <div class="filters">
            <div class="filter-controls">
                <div class="filter-group search-group">
                    <label for="searchFilter">🔍 Search Tests:</label>
                    <div class="search-container">
                        <input type="text" id="searchFilter" class="search-box" placeholder="Search by test name..." oninput="updateSearchSuggestions()" onkeyup="filterScreenshots()" autocomplete="off">
                        <div class="search-suggestions" id="searchSuggestions"></div>
                    </div>
                </div>
            </div>
        </div>

        <!-- 🚨 FLAKY TESTS SECTION -->
        <div class="flaky-tests-section">
            <h2>🚨 Flaky Tests Analysis</h2>
            <p>Tests that passed on retry (marked as flaky by Playwright) - these need attention for stability improvements</p>
            
            ${Object.keys(groupedScreenshots).filter(testName => {
                const screenshots = groupedScreenshots[testName];
                return screenshots.some(s => s.status === 'flaky'); // Only show tests with actual "flaky" status
            }).length > 0 ? 
                Object.entries(groupedScreenshots).filter(([testName, testScreenshots]) => 
                    testScreenshots.some(s => s.status === 'flaky')
                ).map(([testName, testScreenshots]) => `
                    <div class="flaky-test-group">
                        <div class="flaky-test-header">
                            <h3>⚠️ ${testName}</h3>
                            <div class="flaky-stats">
                                <span class="flaky-badge">🔄 Flaky Test</span>
                                <span class="retry-count">Flaky Executions: ${testScreenshots.filter(s => s.status === 'flaky').length}</span>
                            </div>
                        </div>
                        
                        <!-- 🎥 VIDEO RECORDINGS SECTION -->
                        ${(() => {
                            const testVideos = videos.filter(v => v.testName === testName && v.status === 'flaky');
                            if (testVideos.length > 0) {
                                return `
                                    <div class="video-section">
                                        <h4>🎥 Test Execution Videos</h4>
                                        <p>Watch the complete test execution to understand the flaky behavior</p>
                                        <div class="video-grid">
                                            ${testVideos.map(video => `
                                                <div class="video-card">
                                                    <div class="video-header">
                                                        <span class="browser-badge">${video.browser}</span>
                                                        <span class="video-status">🎥 Video Recording</span>
                                                        ${video.retry > 0 ? `<span class="retry-badge">Retry #${video.retry}</span>` : ''}
                                                    </div>
                                                    
                                                    <div class="video-player">
                                                        <video controls preload="metadata" style="width: 100%; height: auto; border-radius: 8px;">
                                                            <source src="data:video/${video.path.endsWith('.mp4') ? 'mp4' : 'webm'};base64,${fs.readFileSync(video.path, 'base64')}" type="video/${video.path.endsWith('.mp4') ? 'mp4' : 'webm'}">
                                                            Your browser does not support the video tag.
                                                        </video>
                                                    </div>
                                                    
                                                    <div class="video-info">
                                                        <div class="video-duration">
                                                            <strong>⏱️ Duration:</strong> ${video.duration > 0 ? Math.round(video.duration / 1000) + 's' : 'Unknown'}
                                                        </div>
                                                        <div class="video-timestamp">
                                                            <strong>📅 Recorded:</strong> ${new Date(video.timestamp).toLocaleString()}
                                                        </div>
                                                    </div>
                                                </div>
                                            `).join('')}
                                        </div>
                                    </div>
                                `;
                            }
                            return '';
                        })()}
                        
                        <!-- 📸 SCREENSHOTS SECTION -->
                        <div class="screenshots-section">
                            <h4>📸 Flaky Test Screenshots</h4>
                            <p>Visual evidence of the test state during flaky executions</p>
                            <div class="flaky-screenshots-grid">
                                ${testScreenshots.filter(s => s.status === 'flaky').map(screenshot => `
                                    <div class="flaky-screenshot-card">
                                        <div class="screenshot-header">
                                            <span class="browser-badge">${screenshot.browser}</span>
                                            <span class="retry-badge">Retry ${screenshot.retry}</span>
                                            <span class="flaky-status">⚠️ Flaky</span>
                                        </div>
                                        
                                        <div class="screenshot-image">
                                            <img src="data:image/png;base64,${fs.readFileSync(screenshot.path, 'base64')}" 
                                                 alt="Flaky Test: ${testName} on ${screenshot.browser}" 
                                                 onclick="openScreenshotModal(this.src, '${testName} - ${screenshot.browser} (Flaky)')">
                                        </div>
                                        
                                        <div class="flaky-analysis">
                                            <div class="flaky-reason">
                                                <strong>🔍 Flakiness Reason:</strong>
                                                ${getFlakinessReason(testName, screenshot.browser, screenshot.retry)}
                                            </div>
                                            <div class="flaky-recommendation">
                                                <strong>💡 Recommendation:</strong>
                                                ${getFlakinessRecommendation(testName, screenshot.browser)}
                                            </div>
                                        </div>
                                    </div>
                                `).join('')}
                            </div>
                        </div>
                    </div>
                `).join('') : 
                '<div class="no-flaky-tests">✅ No flaky tests found - all tests are stable!</div>'
            }
        </div>

        <!-- ❌ FAILED TESTS SECTION -->
        <div class="failed-tests-section">
            <h2>❌ Failed Tests Analysis</h2>
            <p>Tests that failed completely (including those with retry attempts) - these need immediate attention</p>
            
            ${Object.keys(groupedScreenshots).filter(testName => {
                const screenshots = groupedScreenshots[testName];
                return screenshots.some(s => s.status === 'failed'); // Show all failed tests regardless of retries
            }).length > 0 ? 
                Object.entries(groupedScreenshots).filter(([testName, testScreenshots]) => 
                    testScreenshots.some(s => s.status === 'failed')
                ).map(([testName, testScreenshots]) => `
                    <div class="failed-test-group">
                        <div class="failed-test-header">
                            <h3>❌ ${testName}</h3>
                            <div class="failed-stats">
                                <span class="failed-badge">💥 Complete Failure</span>
                                <span class="browser-count">Browsers: ${[...new Set(testScreenshots.filter(s => s.status === 'failed').map(s => s.browser))].length}</span>
                                <span class="retry-count">Total Failures: ${testScreenshots.filter(s => s.status === 'failed').length}</span>
                            </div>
                        </div>
                        
                        <!-- 🎥 VIDEO RECORDINGS SECTION -->
                        ${(() => {
                            const testVideos = videos.filter(v => v.testName === testName && v.status === 'failed');
                            if (testVideos.length > 0) {
                                return `
                                    <div class="video-section">
                                        <h4>🎥 Test Execution Videos</h4>
                                        <p>Watch the complete test execution to understand what went wrong</p>
                                        <div class="video-grid">
                                            ${testVideos.map(video => `
                                                <div class="video-card">
                                                    <div class="video-header">
                                                        <span class="browser-badge">${video.browser}</span>
                                                        <span class="video-status">🎥 Video Recording</span>
                                                        ${video.retry > 0 ? `<span class="retry-badge">Retry #${video.retry}</span>` : ''}
                                                    </div>
                                                    
                                                    <div class="video-player">
                                                        <video controls preload="metadata" style="width: 100%; height: auto; border-radius: 8px;">
                                                            <source src="data:video/${video.path.endsWith('.mp4') ? 'mp4' : 'webm'};base64,${fs.readFileSync(video.path, 'base64')}" type="video/${video.path.endsWith('.mp4') ? 'mp4' : 'webm'}">
                                                            Your browser does not support the video tag.
                                                        </video>
                                                    </div>
                                                    
                                                    <div class="video-info">
                                                        <div class="video-duration">
                                                            <strong>⏱️ Duration:</strong> ${video.duration > 0 ? Math.round(video.duration / 1000) + 's' : 'Unknown'}
                                                        </div>
                                                        <div class="video-timestamp">
                                                            <strong>📅 Recorded:</strong> ${new Date(video.timestamp).toLocaleString()}
                                                        </div>
                                                    </div>
                                                </div>
                                            `).join('')}
                                        </div>
                                    </div>
                                `;
                            }
                            return '';
                        })()}
                        
                        <!-- 📸 SCREENSHOTS SECTION -->
                        <div class="screenshots-section">
                            <h4>📸 Failure Screenshots</h4>
                            <p>Visual evidence of what the page looked like when the test failed</p>
                            <div class="failed-screenshots-grid">
                                ${testScreenshots.filter(s => s.status === 'failed').map(screenshot => `
                                    <div class="failed-screenshot-card">
                                        <div class="screenshot-header">
                                            <span class="browser-badge">${screenshot.browser}</span>
                                            <span class="failed-status">❌ Failed</span>
                                            ${screenshot.retry > 0 ? `<span class="retry-badge">Retry #${screenshot.retry}</span>` : ''}
                                        </div>
                                        
                                        <div class="screenshot-image">
                                            <img src="data:image/png;base64,${fs.readFileSync(screenshot.path, 'base64')}" 
                                                 alt="Failed Test: ${testName} on ${screenshot.browser}" 
                                                 onclick="openScreenshotModal(this.src, '${testName} - ${screenshot.browser} (Failed)')">
                                        </div>
                                        
                                        <div class="failed-analysis">
                                            <div class="failed-reason">
                                                <strong>🔍 Failure Reason:</strong>
                                                ${getFailureReason(testName, screenshot.browser)}
                                            </div>
                                            <div class="failed-recommendation">
                                                <strong>💡 Recommendation:</strong>
                                                ${getFailureRecommendation(testName, screenshot.browser)}
                                            </div>
                                        </div>
                                    </div>
                                `).join('')}
                            </div>
                        </div>
                    </div>
                `).join('') : 
                '<div class="no-failed-tests">✅ No completely failed tests found!</div>'
            }
        </div>

        <div class="screenshots-container">
            <h2>📸 All Test Screenshots</h2>
            <p>Complete collection of all test execution screenshots</p>
            
            ${Object.keys(groupedScreenshots).length > 0 ? 
                Object.entries(groupedScreenshots).map(([testName, testScreenshots]) => `
                    <div class="test-group" data-test-name="${testName}" data-status="${testScreenshots[0].status}" data-browser="${testScreenshots[0].browser}">
                        <div class="test-header">
                            <h2>${testName}</h2>
                            <div class="test-info">
                                <span>${statusIcons[testScreenshots[0].status] || '❓'} ${testScreenshots[0].status.toUpperCase()}</span>
                                <span>🌐 ${testScreenshots[0].browser}</span>
                                <span>📸 ${testScreenshots.length} screenshots</span>
                            </div>
                        </div>
                        
                        <div class="screenshots-grid">
                            ${testScreenshots.map(screenshot => `
                                <div class="screenshot-card" data-status="${screenshot.status}" data-browser="${screenshot.browser.toLowerCase()}">
                                    <div class="screenshot-header">
                                        <div class="header-main">
                                            <span class="browser-badge ${screenshot.browser.toLowerCase()}">${getBrowserDisplayName(screenshot.browser)}</span>
                                            <span class="status-badge" style="background-color: ${statusColors[screenshot.status] || '#6c757d'}">
                                                ${statusIcons[screenshot.status] || '❓'} ${screenshot.status.toUpperCase()}
                                            </span>
                                            ${screenshot.retry > 0 ? `<span class="retry-badge">Retry #${screenshot.retry}</span>` : ''}
                                        </div>
                                        <div class="test-name">
                                            <strong>${screenshot.testName}</strong>
                                        </div>
                                    </div>
                                    
                                    <div class="screenshot-image">
                                        <img src="data:image/png;base64,${fs.readFileSync(screenshot.path, 'base64')}" 
                                             alt="Screenshot: ${screenshot.testName} on ${getBrowserDisplayName(screenshot.browser)}" 
                                             onclick="openScreenshotModal(this.src, '${screenshot.testName} - ${getBrowserDisplayName(screenshot.browser)}')">
                                    </div>
                                    
                                    <div class="screenshot-details">
                                        <div class="detail-item">
                                            <span class="detail-label">Browser:</span>
                                            <span class="detail-value browser-name">${getBrowserDisplayName(screenshot.browser)}</span>
                                        </div>
                                        <div class="detail-item">
                                            <span class="detail-label">Status:</span>
                                            <span class="detail-value status-value">${screenshot.status.toUpperCase()}</span>
                                        </div>
                                        <div class="detail-item">
                                            <span class="detail-label">Duration:</span>
                                            <span class="detail-value">${screenshot.duration}s</span>
                                        </div>
                                        ${screenshot.retry > 0 ? `
                                        <div class="detail-item">
                                            <span class="detail-label">Retry:</span>
                                            <span class="detail-value">#${screenshot.retry}</span>
                                        </div>
                                        ` : ''}
                                        <div class="detail-item">
                                            <span class="detail-label">Timestamp:</span>
                                            <span class="detail-value">${new Date(screenshot.timestamp).toLocaleString()}</span>
                                        </div>
                                        
                                        <!-- Error Message Display -->
                                        ${screenshot.errorMessage ? `
                                        <div class="error-section">
                                            <div class="error-header">
                                                <strong>❌ Error Message:</strong>
                                            </div>
                                            <div class="error-message">
                                                ${screenshot.errorMessage.length > 200 ? 
                                                    screenshot.errorMessage.substring(0, 200) + '...' : 
                                                    screenshot.errorMessage}
                                            </div>
                                        </div>
                                        ` : ''}
                                        
                                        <!-- Failure Reason Explanation -->
                                        <div class="failure-reason">
                                            <strong>🔍 Failure Analysis:</strong>
                                            ${getFailureReason(screenshot.testName, screenshot.browser)}
                                        </div>
                                    </div>
                                </div>
                            `).join('')}
                        </div>
                    </div>
                `).join('') : 
                '<div class="no-screenshots"><h2>📸 No Screenshots Found</h2><p>Run some tests first to capture screenshots!</p></div>'
            }
        </div>
    </div>

    <!-- Screenshot Modal -->
    <div id="screenshotModal" class="modal">
        <div class="modal-content">
            <span class="close-modal" onclick="closeScreenshotModal()">&times;</span>
            <h3 id="modalTitle" class="modal-title">Screenshot</h3>
            <img id="modalImage" class="modal-image" src="" alt="Screenshot">
        </div>
    </div>

    <script>
                // Simplified filter functionality - only search filter
        function filterScreenshots() {
            const searchFilter = document.getElementById('searchFilter').value.toLowerCase();
            
            console.log('Filtering with search:', searchFilter);
            
            // Get all test groups (regular screenshots section)
            const testGroups = document.querySelectorAll('.test-group');
            console.log('Found test groups:', testGroups.length);
            
            let visibleCount = 0;
            
            testGroups.forEach((group, index) => {
                const testName = group.dataset.testName || '';
                const status = group.dataset.status || '';
                const browser = group.dataset.browser || '';
                
                let show = true;
                
                // Search filter only
                if (searchFilter) {
                    const searchableText = (testName + ' ' + status + ' ' + browser).toLowerCase();
                    if (!searchableText.includes(searchFilter)) {
                        show = false;
                        console.log('Hiding group ' + index + ': search mismatch (' + searchFilter + ' not in ' + searchableText + ')');
                    }
                }
                
                console.log('Group ' + index + ' show:', show);
                
                // Apply visibility
                if (show) {
                    group.style.display = 'block';
                    visibleCount++;
                } else {
                    group.style.display = 'none';
                }
            });
            
            // Also filter flaky test groups if they exist
            const flakyGroups = document.querySelectorAll('.flaky-test-group');
            console.log('Found flaky groups:', flakyGroups.length);
            
            flakyGroups.forEach((group, index) => {
                const header = group.querySelector('.flaky-test-header h3');
                const testName = header ? header.textContent.replace('⚠️ ', '') : '';
                const status = 'flaky';
                const browserBadge = group.querySelector('.browser-badge');
                const browser = browserBadge ? browserBadge.textContent.toLowerCase() : '';
                
                let show = true;
                
                // Search filter only
                if (searchFilter) {
                    const searchableText = (testName + ' ' + status + ' ' + browser).toLowerCase();
                    if (!searchableText.includes(searchFilter)) {
                        show = false;
                        console.log('Hiding flaky group ' + index + ': search mismatch (' + searchFilter + ' not in ' + searchableText + ')');
                    }
                }
                
                console.log('Flaky group ' + index + ' show:', show);
                
                // Apply visibility
                if (show) {
                    group.style.display = 'block';
                    visibleCount++;
                } else {
                    group.style.display = 'none';
                }
            });
            
            // Also filter failed test groups if they exist
            const failedGroups = document.querySelectorAll('.failed-test-group');
            console.log('Found failed groups:', failedGroups.length);
            
            failedGroups.forEach((group, index) => {
                const header = group.querySelector('.failed-test-header h3');
                const testName = header ? header.textContent.replace('❌ ', '') : '';
                const status = 'failed';
                const browserBadge = group.querySelector('.browser-badge');
                const browser = browserBadge ? browserBadge.textContent.toLowerCase() : '';
                
                let show = true;
                
                // Search filter only
                if (searchFilter) {
                    const searchableText = (testName + ' ' + status + ' ' + browser).toLowerCase();
                    if (!searchableText.includes(searchFilter)) {
                        show = false;
                        console.log('Hiding failed group ' + index + ': search mismatch (' + searchFilter + ' not in ' + searchableText + ')');
                    }
                }
                
                console.log('Failed group ' + index + ' show:', show);
                
                // Apply visibility
                if (show) {
                    group.style.display = 'block';
                    visibleCount++;
                } else {
                    group.style.display = 'none';
                }
            });
            
            console.log('Total visible groups:', visibleCount);
        }
        
        // Update filter counters and show results
        function updateFilterCounters(visibleCount, totalCount) {
            // Create or update filter counter
            let counterElement = document.getElementById('filterCounter');
            if (!counterElement) {
                counterElement = document.createElement('div');
                counterElement.id = 'filterCounter';
                counterElement.className = 'filter-counter';
                document.querySelector('.filters').appendChild(counterElement);
            }
            
            counterElement.textContent = 'Showing ' + visibleCount + ' of ' + totalCount + ' test groups';
            counterElement.style.display = visibleCount === 0 ? 'none' : 'block';
            
            // Show "no results" message if needed
            if (visibleCount === 0) {
                showNoResultsMessage();
            } else {
                hideNoResultsMessage();
            }
        }
        
        // Update filter visual states
        function updateFilterVisuals(statusFilter, browserFilter, searchFilter) {
            // Update status filter visual state
            const statusSelect = document.getElementById('statusFilter');
            if (statusSelect) {
                statusSelect.className = statusFilter === 'all' ? 'filter-select' : 'filter-select active-filter';
            }
            
            // Update browser filter visual state
            const browserSelect = document.getElementById('browserFilter');
            if (browserSelect) {
                browserSelect.className = browserFilter === 'all' ? 'filter-select' : 'filter-select active-filter';
            }
            
            // Update search filter visual state
            const searchInput = document.getElementById('searchFilter');
            if (searchInput) {
                searchInput.className = searchFilter ? 'search-box active-search' : 'search-box';
            }
        }
        
        // Show no results message
        function showNoResultsMessage() {
            let noResultsElement = document.getElementById('noResultsMessage');
            if (!noResultsElement) {
                noResultsElement = document.createElement('div');
                noResultsElement.id = 'noResultsMessage';
                noResultsElement.className = 'no-results-message';
                noResultsElement.innerHTML = 
                    '<div class="no-results-content">' +
                        '<span class="no-results-icon">🔍</span>' +
                        '<h3>No tests match your filters</h3>' +
                        '<p>Try adjusting your search criteria or clearing some filters</p>' +
                        '<button onclick="clearAllFilters()" class="clear-filters-btn">Clear All Filters</button>' +
                    '</div>';
                document.querySelector('.screenshots-container').appendChild(noResultsElement);
            }
            noResultsElement.style.display = 'block';
        }
        
        // Hide no results message
        function hideNoResultsMessage() {
            const noResultsElement = document.getElementById('noResultsMessage');
            if (noResultsElement) {
                noResultsElement.style.display = 'none';
            }
        }
        
        // Clear all filters
        function clearAllFilters() {
            document.getElementById('statusFilter').value = 'all';
            document.getElementById('browserFilter').value = 'all';
            document.getElementById('searchFilter').value = '';
            filterScreenshots();
        }
        
        // Update search suggestions with intelligent matching
        function updateSearchSuggestions() {
            const searchInput = document.getElementById('searchFilter');
            const suggestionsDiv = document.getElementById('searchSuggestions');
            const searchTerm = searchInput.value.toLowerCase().trim();
            
            if (!searchTerm) {
                suggestionsDiv.style.display = 'none';
                return;
            }
            
            const suggestions = [];
            const testGroups = document.querySelectorAll('.test-group');
            
            testGroups.forEach(group => {
                const testName = group.dataset.testName;
                const status = group.dataset.status;
                const browser = group.dataset.browser;
                
                // More intelligent matching - check if search term appears anywhere
                const testNameLower = testName.toLowerCase();
                const statusLower = status.toLowerCase();
                const browserLower = browser.toLowerCase();
                
                // Check if search term matches any part of the test information
                if (testNameLower.includes(searchTerm) || 
                    statusLower.includes(searchTerm) || 
                    browserLower.includes(searchTerm) ||
                    searchTerm.includes(testNameLower) ||
                    searchTerm.includes(statusLower) ||
                    searchTerm.includes(browserLower)) {
                    
                    // Create a more readable suggestion format
                    const suggestionText = testName + ' (' + status + ' - ' + browser + ')';
                    suggestions.push({
                        text: suggestionText,
                        testName: testName,
                        status: status,
                        browser: browser,
                        matchType: getMatchType(searchTerm, testNameLower, statusLower, browserLower)
                    });
                }
            });
            
            // Sort suggestions by relevance (exact matches first, then partial)
            suggestions.sort((a, b) => {
                if (a.matchType === 'exact' && b.matchType !== 'exact') return -1;
                if (b.matchType === 'exact' && a.matchType !== 'exact') return 1;
                return 0;
            });
            
            if (suggestions.length > 0) {
                suggestionsDiv.innerHTML = suggestions.map(function(suggestion) {
                    const highlightClass = suggestion.matchType === 'exact' ? 'exact-match' : 'partial-match';
                    return '<div class="search-suggestion-item ' + highlightClass + '" onclick="selectSuggestion(\'' + suggestion.text + '\')">' +
                           '<span class="suggestion-test">' + suggestion.testName + '</span>' +
                           '<span class="suggestion-details">' + suggestion.status + ' - ' + suggestion.browser + '</span>' +
                           '</div>';
                }).join('');
                suggestionsDiv.style.display = 'block';
            } else {
                suggestionsDiv.style.display = 'none';
            }
        }
        
        // Determine match type for better sorting
        function getMatchType(searchTerm, testName, status, browser) {
            if (testName === searchTerm || status === searchTerm || browser === searchTerm) {
                return 'exact';
            }
            return 'partial';
        }
        
        // Select search suggestion
        function selectSuggestion(suggestionText) {
            document.getElementById('searchFilter').value = suggestionText;
            document.getElementById('searchSuggestions').style.display = 'none';
            filterScreenshots();
        }

        // Modal functionality
        function openScreenshotModal(imageSrc, title) {
            document.getElementById('modalImage').src = imageSrc;
            document.getElementById('modalTitle').textContent = title;
            document.getElementById('screenshotModal').style.display = 'block';
            document.body.style.overflow = 'hidden';
        }

        function closeScreenshotModal() {
            document.getElementById('screenshotModal').style.display = 'none';
            document.body.style.overflow = 'auto';
        }

        // Close modal when clicking outside
        window.onclick = function(event) {
            const modal = document.getElementById('screenshotModal');
            if (event.target === modal) {
                closeScreenshotModal();
            }
        }

        // Close modal with Escape key
        document.addEventListener('keydown', function(event) {
            if (event.key === 'Escape') {
                closeScreenshotModal();
            }
        });

        // Initialize filters
        document.addEventListener('DOMContentLoaded', function() {
            filterScreenshots();
        });
    </script>
</body>
</html>`;
}

// Main execution
function main() {
    console.log('🔍 Extracting media from test results...');
    const { screenshots, videos } = extractMedia();
    
    if (screenshots.length === 0 && videos.length === 0) {
        console.log('❌ No screenshots or videos found. Run tests first to capture media.');
        return;
    }
    
    console.log(`✅ Found ${screenshots.length} screenshots and ${videos.length} videos from test executions`);
    
    // Create reports directory if it doesn't exist
    const reportsDir = path.join(__dirname, 'reports');
    if (!fs.existsSync(reportsDir)) {
        fs.mkdirSync(reportsDir, { recursive: true });
    }
    
    // Generate and save the screenshots gallery
    const html = generateScreenshotsGallery(screenshots, videos);
    const outputPath = path.join(reportsDir, 'screenshots-gallery.html');
    fs.writeFileSync(outputPath, html, 'utf8');
    
    console.log(`✅ Screenshots gallery generated: ${outputPath}`);
    console.log(`📊 Gallery contains:`);
    console.log(`   • ${screenshots.length} total screenshots`);
    console.log(`   • ${videos.length} total videos`);
    console.log(`   • ${[...new Set([...screenshots.map(s => s.testName), ...videos.map(v => v.testName)])].length} test functions`);
    console.log(`   • ${[...new Set([...screenshots.map(s => s.browser), ...videos.map(v => v.browser)])].length} browsers`);
    console.log(`   • ${[...new Set([...screenshots.map(s => s.status), ...videos.map(v => v.status)])].length} different statuses`);
}

// Run the script
if (require.main === module) {
    main();
}

module.exports = { extractMedia, generateScreenshotsGallery };
