const { defineConfig, devices } = require('@playwright/test');

// Set PW_CHROMIUM_PATH to use a preinstalled Chromium instead of the one downloaded by `playwright install`.
const executablePath = process.env.PW_CHROMIUM_PATH;

module.exports = defineConfig({
    testDir: 'e2e',
    fullyParallel: true,
    forbidOnly: Boolean(process.env.CI),
    retries: 0,
    reporter: process.env.CI ? 'github' : 'list',
    use: {
        baseURL: 'http://localhost:4173',
        serviceWorkers: 'block',
        launchOptions: executablePath ? { executablePath } : {}
    },
    projects: [
        { name: 'mobile', use: { ...devices['Pixel 5'] } },
        { name: 'desktop', use: { viewport: { width: 1280, height: 800 } } }
    ],
    webServer: {
        command: 'python3 -m http.server 4173',
        url: 'http://localhost:4173',
        reuseExistingServer: !process.env.CI
    }
});
