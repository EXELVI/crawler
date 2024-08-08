require('dotenv').config();
const puppeteer = require('puppeteer');
const express = require('express');
const bodyParser = require('body-parser');
const http = require('http');
const logger = require('morgan');
const path = require('path');
const socketIo = require('socket.io');
const fs = require('fs');
const fetch = require('node-fetch');
var Convert = require('ansi-to-html');
var convert = new Convert();

const app = express();
const server = http.createServer(app);
const io = socketIo(server);

app.use(logger('dev'));
app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: false }));
app.use(express.static(path.join(__dirname, 'public')));
app.use("/screenshots", express.static(path.join(__dirname, 'screenshots')));
app.set('view engine', 'ejs');

app.get('/', (req, res) => {
  const screenshotsDir = path.join(__dirname, 'screenshots');
  const screenshots = fs.readdirSync(screenshotsDir).map(file => `screenshots/${file}`);
  res.render('index', { screenshots });
});

let screenshots = [];

/**
 * 
 * @param {puppeteer.Page} page  
 */
async function cookieAccept(page, waitCookies) {
  await page.waitForNavigation({ waitUntil: 'domcontentloaded' }).then(async () => {
    if (new URL(page.url()).hostname.includes('youtube')) {
      // aria-label="Accetta l'utilizzo dei cookie e di altri dati per le finalità descritte"
      if (waitCookies) await page.waitForSelector('button[aria-label="Accetta l\'utilizzo dei cookie e di altri dati per le finalità descritte"]');
      if (await page.$('button[aria-label="Accetta l\'utilizzo dei cookie e di altri dati per le finalità descritte"]')) {
        await page.click('button[aria-label="Accetta l\'utilizzo dei cookie e di altri dati per le finalità descritte"]');
      }
    } else if (new URL(page.url()).hostname.includes('google')) {
      const [button] = await page.$x("//button[contains(., 'Accetta tutto')]");
      if (waitCookies) {
        if (!button) {
          setTimeout(async () => {
            await page.waitForSelector('xpath///a[contains(text(), "Accetta tutto")]');
            let [button] = page.$x("//button[contains(., 'Accetta tutto')]");
            if (button) await button.click();
          },1000)
        }
            }
      if (button) await button.click();
    }
  }).catch(() => { });

}

/**
 * 
 * @param {puppeteer.Page} page
 * @returns {boolean}
 *  
 * */
async function getRickRoll(page) {
  return page.url().includes('youtu.be/dQw4w9WgXcQ') || page.url().includes('watch?v=dQw4w9WgXcQ') || await page.evaluate(() => {
    const title = document.title.toLowerCase();
    return title.includes('rick roll') || title.includes('never gonna give you up') || title.includes('rickroll') || title.includes('rick astley');
  }) || await page.evaluate(() => {
    const title = document.querySelector('.slim-video-information-title .yt-core-attributed-string')?.textContent?.toLowerCase();
    if (!title) return false;
    return title.includes('rick roll') || title.includes('never gonna give you up') || title.includes('rickroll') || title.includes('rick astley');
  });
}

var closed = false;

io.on('connection', socket => {
  console.log('Client connected');

  socket.on('disconnect', () => {
    console.log('Client disconnected');
    if (!closed) screenshots.forEach(screenshot => {
      if (screenshot.id === socket.id) {
        if (fs.existsSync(path.join(__dirname, 'screenshots', screenshot.folder))) {
          fs.rmSync(path.join(__dirname, 'screenshots', screenshot.folder), { recursive: true });
          console.log(`Screenshots deleted: ${screenshot.folder}`);
        }
      }
    });
  });

  socket.on("crawl", async (data) => {
    let { url, method, waitCookies } = data;
    if (method === 'desktop' || method === 'mobile') {
      const screenshotsDir = path.join(__dirname, 'screenshots');
      if (!fs.existsSync(screenshotsDir)) {
        fs.mkdirSync(screenshotsDir);
      }
      const browser = await puppeteer.launch({
        headless: true,
        executablePath: "C:\\Program Files\\BraveSoftware\\Brave-Browser\\Application\\brave.exe",
        //userDataDir: 'C:\\Users\\exelv\\AppData\Local\\BraveSoftware\\Brave-Browser\\User Data',
        defaultViewport: method === 'mobile' ? null : { width: 1920, height: 1080 }
      });



      socket.emit('loading', 'Loading page...');
      const page = await browser.newPage()
      if (!url.startsWith('http')) {
        url = `http://${url}`;
      }
      await page.goto(url);

      await page.reload()

      if (method == "mobile") {
        await page.setUserAgent('Mozilla/5.0 (iPhone; CPU iPhone OS 15_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/15.0 Mobile/15E148 Safari/604.1');
        await page.emulate(puppeteer.KnownDevices['iPhone 15 Pro Max']);

      }

      socket.emit('progress', 33);

      await page.waitForSelector('body');

      socket.emit('progress', 66);

      if (waitCookies) {
        await cookieAccept(page);
      } else {
        cookieAccept(page);
      }

      socket.emit('progress', 100);


      let time = new Date().getTime();

      let infos = {
        method: method,
        title: await page.title(),
        url: page.url(),
        screenshots: [],
        rickroll: await getRickRoll(page)
      }

      for (let i = 0; i < 10; i++) {
        const screenshotPath = path.join(screenshotsDir, time.toString(), `screenshot-${i}.png`);
        if (!fs.existsSync(path.join(screenshotsDir, time.toString()))) {
          fs.mkdirSync(path.join(screenshotsDir, time.toString()));
        }
        screenshots.push({ id: socket.id, folder: time.toString(), name: `screenshot-${i}.png` });
        await page.screenshot({ path: screenshotPath });
        console.log(`Screenshot saved: ${screenshotPath}`);
        infos.screenshots.push(`screenshots/${time}/screenshot-${i}.png`);
        socket.emit('progress', i * 10);
        await new Promise(resolve => setTimeout(resolve, 500));
      }

      socket.emit('progress', 100);
      socket.emit('crawl', infos);
      //  await browser.close();


    } else if (method == "curl") {
      if (!url.startsWith('http')) {
        url = `http://${url}`;
      }
      socket.emit('loading', 'Loading page...');
      socket.emit('progress', 33);
      fetch(url, {
        headers: {
          "User-Agent": "curl/7.68.0"
        }
      })
        .then(response => response.text())
        .then(text => {
          socket.emit('progress', 100);
          socket.emit('crawl', { method: 'curl', title: url, url: url, text: convert.toHtml(text) });
        })

    }
  });
})

server.listen(3000, () => {
  console.log(`Server running on port ${server.address().port}`);
});

process.on("SIGINT", () => {
  closed = true;
  server.close(() => {
    console.log("Server closed");
  });
  console.log("Cleaning up...");
  fs.rmSync(path.join(__dirname, 'screenshots'), { recursive: true })
  console.log("Screenshots deleted");
  fs.mkdirSync(path.join(__dirname, 'screenshots'));
  console.log("Screenshots directory created");
  process.exit(0);
});

