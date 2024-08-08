const puppeteer = require('puppeteer');
const fs = require('fs');
const path = require('path');

const startCrawling = async () => {
    const url = 'https://exelvi.github.io';
    const screenshotsDir = path.join(__dirname, 'screenshots');
    if (!fs.existsSync(screenshotsDir)) {
        fs.mkdirSync(screenshotsDir);
    }

    const browser = await puppeteer.launch({
        headless: true,
        executablePath: "C:\\Program Files\\BraveSoftware\\Brave-Browser\\Application\\brave.exe",
    });
    const page = await browser.newPage();
    await page.goto(url);

    for (let i = 0; i < 5; i++) {
        const screenshotPath = path.join(screenshotsDir, `screenshot-${i}.png`);
        await page.screenshot({ path: screenshotPath });
        console.log(`Screenshot saved: ${screenshotPath}`);
        await new Promise(resolve => setTimeout(resolve, 500));
    }

    await browser.close();
};

startCrawling();
