const puppeteer = require('puppeteer');
const fs = require('fs');
const path = require('path');

const startCrawling = async () => {
    const url = 'https://youtu.be/dQw4w9WgXcQ';
    const screenshotsDir = path.join(__dirname, 'screenshots');
    if (!fs.existsSync(screenshotsDir)) {
        fs.mkdirSync(screenshotsDir);
    }

    const browser = await puppeteer.launch({
        headless: false,
        executablePath: "C:\\Program Files\\BraveSoftware\\Brave-Browser\\Application\\brave.exe",
        //userDataDir: 'C:\\Users\\exelv\\AppData\Local\\BraveSoftware\\Brave-Browser\\User Data',
        defaultViewport: { width: 1920, height: 1080 }
    });
    const page = await browser.newPage()
    await page.goto(url);


    await page.reload(); // Awoiding youtube cookies popup

    for (let i = 0; i < 5; i++) {
        const screenshotPath = path.join(screenshotsDir, `screenshot-${i}.png`);
        await page.screenshot({ path: screenshotPath });
        console.log(`Screenshot saved: ${screenshotPath}`);
        await new Promise(resolve => setTimeout(resolve, 500));
    }

    await browser.close();
};

startCrawling();
