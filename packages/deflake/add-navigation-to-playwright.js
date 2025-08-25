const fs = require('fs');
const path = require('path');

function addNavigationToPlaywrightReport() {
    const playwrightReportPath = path.join(__dirname, 'playwright-report', 'index.html');
    if (!fs.existsSync(playwrightReportPath)) {
        console.log('❌ Playwright report not found. Run tests first to generate it.');
        return;
    }

    try {
        let html = fs.readFileSync(playwrightReportPath, 'utf8');
        
        // Check if navigation is already present
        if (html.includes('<!-- DEFLAKE Navigation Bar -->')) {
            console.log('ℹ️ Navigation bar already exists in Playwright report');
            return;
        }

        // Create navigation bar HTML
        const navigationBar = `
        <!-- DEFLAKE Navigation Bar -->
        <div class="deflake-navigation" style="background: #2d3748; padding: 15px; border-radius: 8px; margin: 20px; text-align: center; box-shadow: 0 4px 6px rgba(0, 0, 0, 0.1);">
            <h3 style="color: #4ecdc4; margin-bottom: 15px; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;">🧭 DEFLAKE Navigation</h3>
            <div style="display: flex; gap: 15px; justify-content: center; flex-wrap: wrap;">
                <a href="../reports/dynamic-flakiness-report.html" class="nav-button" style="background: #718096; color: white; padding: 10px 20px; border-radius: 6px; text-decoration: none; font-weight: 600; transition: all 0.2s ease;">
                    📊 DEFLAKE Report
                </a>
                <a href="../reports/screenshots-gallery.html" class="nav-button" style="background: #718096; color: white; padding: 10px 20px; border-radius: 6px; text-decoration: none; font-weight: 600; transition: all 0.2s ease;">
                    🖼️ Screenshots Gallery
                </a>
            </div>
        </div>
        <style>
            .deflake-navigation .nav-button:hover {
                background: #4a5568 !important;
                transform: translateY(-2px);
                box-shadow: 0 6px 12px rgba(0, 0, 0, 0.15);
            }
        </style>`;

        // Insert navigation bar after the opening body tag
        const bodyTagIndex = html.indexOf('<body');
        if (bodyTagIndex !== -1) {
            const insertIndex = html.indexOf('>', bodyTagIndex) + 1;
            html = html.slice(0, insertIndex) + navigationBar + html.slice(insertIndex);
            
            fs.writeFileSync(playwrightReportPath, html, 'utf8');
            console.log('✅ Navigation bar added to Playwright report successfully!');
            console.log('📍 Report location: playwright-report/index.html');
        } else {
            console.log('❌ Could not find body tag in Playwright report');
        }
    } catch (error) {
        console.error('❌ Error adding navigation to Playwright report:', error.message);
    }
}

addNavigationToPlaywrightReport();
