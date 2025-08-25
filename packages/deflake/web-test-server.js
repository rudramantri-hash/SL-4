#!/usr/bin/env node

const express = require('express');
const { execSync, spawn } = require('child_process');
const fs = require('fs');
const path = require('path');
const cors = require('cors');
const http = require('http');
const WebSocket = require('ws');

const app = express();
const server = http.createServer(app);
const wss = new WebSocket.Server({ server });

const PORT = 3001;

// Middleware
app.use(cors());
app.use(express.json());
app.use(express.static('.'));

// Store current test execution state
let currentExecution = {
    isRunning: false,
    progress: 0,
    logs: [],
    results: null,
    startTime: null,
    endTime: null,
    currentTest: null,
    browser: null
};

// WebSocket connection management
const clients = new Set();

wss.on('connection', (ws) => {
    clients.add(ws);
    console.log('🔌 New WebSocket client connected');
    
    // Send current execution status to new client
    ws.send(JSON.stringify({
        type: 'status',
        data: currentExecution
    }));
    
    ws.on('close', () => {
        clients.delete(ws);
        console.log('🔌 WebSocket client disconnected');
    });
});

// Broadcast to all connected clients
function broadcast(message) {
    clients.forEach(client => {
        if (client.readyState === WebSocket.OPEN) {
            client.send(JSON.stringify(message));
        }
    });
}

// Routes
app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'web-test-selector.html'));
});

app.post('/api/execute-tests', async (req, res) => {
    const { testFiles, executionMode, testFunctions, browser } = req.body;
    
    if (currentExecution.isRunning) {
        return res.status(400).json({ error: 'Tests are already running' });
    }
    
    try {
        currentExecution = {
            isRunning: true,
            progress: 0,
            logs: [],
            results: null,
            startTime: new Date(),
            endTime: null,
            currentTest: null,
            browser: browser || 'all'
        };
        
        // Broadcast status update
        broadcast({
            type: 'status',
            data: currentExecution
        });
        
        // Start test execution in background
        executeTestsInBackground(testFiles, executionMode, testFunctions, browser);
        
        res.json({ message: 'Test execution started', executionId: Date.now() });
    } catch (error) {
        currentExecution.isRunning = false;
        broadcast({
            type: 'status',
            data: currentExecution
        });
        res.status(500).json({ error: error.message });
    }
});

app.get('/api/execution-status', (req, res) => {
    res.json(currentExecution);
});

app.post('/api/stop-execution', (req, res) => {
    if (currentExecution.isRunning) {
        currentExecution.isRunning = false;
        currentExecution.endTime = new Date();
        currentExecution.logs.push(`${new Date().toLocaleTimeString()} - Test execution stopped by user`);
        
        broadcast({
            type: 'status',
            data: currentExecution
        });
        
        res.json({ message: 'Test execution stopped' });
    } else {
        res.status(400).json({ error: 'No tests are currently running' });
    }
});

app.post('/api/generate-report', (req, res) => {
    try {
        execSync('node generate-report.js', { stdio: 'pipe' });
        res.json({ message: 'Report generated successfully' });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

app.post('/api/generate-screenshots', (req, res) => {
    try {
        execSync('node generate-screenshots-gallery.js', { stdio: 'pipe' });
        res.json({ message: 'Screenshots gallery generated successfully' });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

app.get('/api/playwright-report', (req, res) => {
    try {
        const reportPath = path.join(__dirname, 'playwright-report', 'index.html');
        if (fs.existsSync(reportPath)) {
            res.sendFile(reportPath);
        } else {
            res.status(404).json({ error: 'Playwright report not found' });
        }
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

app.get('/api/test-files', (req, res) => {
    try {
        const testDir = path.join(__dirname, 'tests');
        const files = fs.readdirSync(testDir)
            .filter(file => file.endsWith('.spec.ts'))
            .map(file => ({
                name: file,
                path: `tests/${file}`,
                displayName: file.replace('.spec.ts', '').replace(/-/g, ' ').replace(/\b\w/g, l => l.toUpperCase())
            }));
        res.json(files);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

app.get('/api/browsers', (req, res) => {
    res.json([
        { id: 'all', name: 'All Browsers', description: 'Run tests on Chrome, Firefox, and Safari' },
        { id: 'chromium', name: 'Chrome', description: 'Run tests on Chrome browser only' },
        { id: 'firefox', name: 'Firefox', description: 'Run tests on Firefox browser only' },
        { id: 'webkit', name: 'Safari', description: 'Run tests on Safari browser only' }
    ]);
});

app.get('/api/test-functions/:filename', (req, res) => {
    try {
        const filename = req.params.filename;
        const filePath = path.join(__dirname, 'tests', filename);
        
        if (!fs.existsSync(filePath)) {
            return res.status(404).json({ error: 'Test file not found' });
        }
        
        const content = fs.readFileSync(filePath, 'utf8');
        const testFunctions = [];
        
        // Parse test functions from the file content
        const testRegex = /test\s*\(\s*['"`]([^'"`]+)['"`]/g;
        let match;
        
        while ((match = testRegex.exec(content)) !== null) {
            testFunctions.push(match[1]);
        }
        
        res.json(testFunctions);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

app.get('/api/health', (req, res) => {
    res.json({ 
        status: 'healthy', 
        timestamp: new Date().toISOString(),
        server: 'DEFLAKE Web Test Server',
        version: '1.0.0'
    });
});

async function executeTestsInBackground(testFiles, executionMode, testFunctions, browser) {
    try {
        currentExecution.logs.push(`${new Date().toLocaleTimeString()} - 🚀 Starting test execution...`);
        currentExecution.progress = 5;
        broadcast({ type: 'status', data: currentExecution });
        
        // Step 1: Build Playwright command for multiple files
        const command = buildPlaywrightCommand(testFiles, browser);
        currentExecution.logs.push(`${new Date().toLocaleTimeString()} - ⚡ Executing: ${command}`);
        currentExecution.progress = 25;
        broadcast({ type: 'status', data: currentExecution });
        
        // Step 2: Execute tests
        await executePlaywrightTests(command);
        currentExecution.progress = 85;
        broadcast({ type: 'status', data: currentExecution });
        
        // Step 3: Parse results
        await parseTestResults();
        currentExecution.progress = 100;
        currentExecution.endTime = new Date();
        currentExecution.isRunning = false;
        
        currentExecution.logs.push(`${new Date().toLocaleTimeString()} - ✅ Test execution completed successfully`);
        currentExecution.logs.push(`${new Date().toLocaleTimeString()} - ⏱️ Total execution time: ${getExecutionTime()}`);
        
        broadcast({ type: 'status', data: currentExecution });
        broadcast({ type: 'execution-complete', data: currentExecution });
        
    } catch (error) {
        currentExecution.logs.push(`${new Date().toLocaleTimeString()} - ❌ ERROR: ${error.message}`);
        currentExecution.isRunning = false;
        currentExecution.progress = 0;
        currentExecution.endTime = new Date();
        
        broadcast({ type: 'status', data: currentExecution });
        broadcast({ type: 'execution-error', data: { error: error.message } });
    }
}

function getExecutionTime() {
    if (currentExecution.startTime && currentExecution.endTime) {
        const duration = currentExecution.endTime - currentExecution.startTime;
        const minutes = Math.floor(duration / 60000);
        const seconds = Math.floor((duration % 60000) / 1000);
        return `${minutes}m ${seconds}s`;
    }
    return 'Unknown';
}

// Custom test file creation removed - now using direct file execution

function buildPlaywrightCommand(testFiles, browser) {
    let command = `npx playwright test ${testFiles.join(' ')}`;
    
    if (browser !== 'all') {
        command += ` --project=${browser}`;
    }
    
    return command;
}

async function executePlaywrightTests(command) {
    return new Promise((resolve, reject) => {
        const [cmd, ...args] = command.split(' ');
        
        const child = spawn(cmd, args, {
            stdio: ['pipe', 'pipe', 'pipe'],
            shell: true
        });
        
        let stdout = '';
        let stderr = '';
        
        child.stdout.on('data', (data) => {
            const output = data.toString();
            stdout += output;
            currentExecution.logs.push(`${new Date().toLocaleTimeString()} - ${output.trim()}`);
            broadcast({ type: 'log', data: { message: output.trim() } });
        });
        
        child.stderr.on('data', (data) => {
            const output = data.toString();
            stderr += output;
            currentExecution.logs.push(`${new Date().toLocaleTimeString()} - ERROR: ${output.trim()}`);
            broadcast({ type: 'log', data: { message: `ERROR: ${output.trim()}` } });
        });
        
        child.on('close', (code) => {
            if (code === 0) {
                currentExecution.logs.push(`${new Date().toLocaleTimeString()} - Playwright tests completed with exit code ${code}`);
                resolve(stdout);
            } else {
                currentExecution.logs.push(`${new Date().toLocaleTimeString()} - Playwright tests failed with exit code ${code}`);
                reject(new Error(`Playwright tests failed with exit code ${code}`));
            }
        });
        
        child.on('error', (error) => {
            currentExecution.logs.push(`${new Date().toLocaleTimeString()} - Failed to start Playwright: ${error.message}`);
            reject(error);
        });
    });
}

async function parseTestResults() {
    try {
        // Check if test-results.json exists in the current directory
        const resultsPath = path.join(__dirname, 'test-results.json');
        if (fs.existsSync(resultsPath)) {
            const results = JSON.parse(fs.readFileSync(resultsPath, 'utf8'));
            
            // Parse results to get summary
            const summary = analyzeTestResults(results);
            currentExecution.results = summary;
            
            currentExecution.logs.push(`${new Date().toLocaleTimeString()} - Results parsed: ${summary.totalTests} tests, ${summary.passed} passed, ${summary.failed} failed, ${summary.flaky} flaky`);
        } else {
            // If no test-results.json, try to analyze from the test execution logs
            const summary = analyzeFromLogs();
            currentExecution.results = summary;
            
            currentExecution.logs.push(`${new Date().toLocaleTimeString()} - Results analyzed from logs: ${summary.totalTests} tests, ${summary.passed} passed, ${summary.failed} failed, ${summary.flaky} flaky`);
        }
    } catch (error) {
        currentExecution.logs.push(`${new Date().toLocaleTimeString()} - Error parsing results: ${error.message}`);
        // Provide default results if parsing fails
        currentExecution.results = {
            totalTests: 0,
            passed: 0,
            failed: 0,
            flaky: 0,
            successRate: 0
        };
    }
}

function analyzeFromLogs() {
    const summary = {
        totalTests: 0,
        passed: 0,
        failed: 0,
        flaky: 0,
        successRate: 0
    };
    
    // Analyze logs to extract test results
    const logs = currentExecution.logs.join(' ');
    
    // Count test executions from logs
    const testExecutions = logs.match(/> tests\/[^>]+ > [^—]+ —/g) || [];
    summary.totalTests = testExecutions.length;
    
    // Count passed tests
    const passedMatches = logs.match(/(\d+) passed/g) || [];
    if (passedMatches.length > 0) {
        const passedStr = passedMatches[0];
        summary.passed = parseInt(passedStr.match(/\d+/)[0]);
    }
    
    // Count failed tests
    const failedMatches = logs.match(/(\d+) failed/g) || [];
    if (failedMatches.length > 0) {
        const failedStr = failedMatches[0];
        summary.failed = parseInt(failedStr.match(/\d+/)[0]);
    }
    
    // Count flaky tests (tests with retries)
    const retryMatches = logs.match(/retry #\d+/g) || [];
    summary.flaky = retryMatches.length;
    
    // Calculate success rate
    if (summary.totalTests > 0) {
        summary.successRate = ((summary.passed / summary.totalTests) * 100).toFixed(1);
    }
    
    return summary;
}

function analyzeTestResults(testResults) {
    const summary = {
        totalTests: 0,
        passed: 0,
        failed: 0,
        flaky: 0,
        successRate: 0
    };
    
    const testMap = new Map();
    
    // Process test results (simplified version)
    if (testResults.suites) {
        testResults.suites.forEach(suite => {
            if (suite.suites) {
                suite.suites.forEach(nestedSuite => {
                    nestedSuite.specs?.forEach(spec => {
                        spec.tests?.forEach(test => {
                            const testName = spec.title;
                            if (!testMap.has(testName)) {
                                testMap.set(testName, { name: testName, status: 'unknown' });
                            }
                            
                            // Determine status from test results
                            if (test.results && test.results.length > 0) {
                                const hasFlaky = test.results.some(result => result.status === 'flaky');
                                const hasFailed = test.results.some(result => result.status === 'failed' || result.status === 'unexpected');
                                const hasPassed = test.results.some(result => result.status === 'passed' || result.status === 'expected');
                                
                                if (hasFlaky) {
                                    testMap.get(testName).status = 'flaky';
                                } else if (hasFailed) {
                                    testMap.get(testName).status = 'failed';
                                } else if (hasPassed) {
                                    testMap.get(testName).status = 'passed';
                                }
                            }
                        });
                    });
                });
            }
        });
    }
    
    // Count statuses
    testMap.forEach((testResult) => {
        summary.totalTests++;
        if (testResult.status === 'passed') summary.passed++;
        else if (testResult.status === 'failed') summary.failed++;
        else if (testResult.status === 'flaky') summary.flaky++;
    });
    
    if (summary.totalTests > 0) {
        summary.successRate = ((summary.passed / summary.totalTests) * 100).toFixed(1);
    }
    
    return summary;
}

// Start server
server.listen(PORT, () => {
    console.log(`🚀 DEFLAKE Web Test Selector running on http://localhost:${PORT}`);
    console.log(`📁 Open http://localhost:${PORT} in your browser to use the interface`);
    console.log(`🔌 WebSocket server ready for real-time updates`);
});

module.exports = app;
