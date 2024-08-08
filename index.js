require('dotenv').config();
const puppeteer = require('puppeteer');
const express = require('express');
const bodyParser = require('body-parser');
const http = require('http');
const logger = require('morgan');
const path = require('path');
const socketIo = require('socket.io');
const fs = require('fs');
const { url } = require('inspector');

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
async function cookieAccept(page) {
  if (page.url().includes('youtube')) {
    // aria-label="Accetta l'utilizzo dei cookie e di altri dati per le finalità descritte"
    await page.waitForSelector('button[aria-label="Accetta l\'utilizzo dei cookie e di altri dati per le finalità descritte"]').catch(() => console.log('Cookie button not found')).then(async () => {
      await page.click('button[aria-label="Accetta l\'utilizzo dei cookie e di altri dati per le finalità descritte"]')
    });
  }

}

var closed = false;

io.on('connection', socket => {
  console.log('Client connected');

  socket.on('disconnect', () => {
    console.log('Client disconnected');
    if (!closed) screenshots.forEach(screenshot => {
      if (screenshot.id === socket.id) {
        screenshots = screenshots.filter(s => s !== screenshot);
        console.log(`Removing screenshot: ${screenshot.name}`);
        fs.unlinkSync(path.join(__dirname, 'screenshots', screenshot.name));
      }
    });
  });

  socket.on("crawl", async (data) => {
    let { url, method } = data;
    const screenshotsDir = path.join(__dirname, 'screenshots');
    if (!fs.existsSync(screenshotsDir)) {
      fs.mkdirSync(screenshotsDir);
    }
    const browser = await puppeteer.launch({
      headless: true,
      executablePath: "C:\\Program Files\\BraveSoftware\\Brave-Browser\\Application\\brave.exe",
      //userDataDir: 'C:\\Users\\exelv\\AppData\Local\\BraveSoftware\\Brave-Browser\\User Data',
      defaultViewport: method === 'mobile' ? { width: 375, height: 667 } : { width: 1920, height: 1080 }
    });

  
    
    socket.emit('loading', 'Loading page...');
    const page = await browser.newPage()
    await page.goto(url);

    if (method == "mobile") {
      await page.emulate(puppeteer.KnownDevices['iPhone 15 Pro Max']);      
    }

    socket.emit('progress', 33);

    // await page.reload();


    await page.waitForSelector('body');

    socket.emit('progress', 66);
    await cookieAccept(page);

    socket.emit('progress', 100);


    let time = new Date().getTime();

    let infos = {
      title: await page.title(),
      url: url,
      screenshots: []
    }

    for (let i = 0; i < 10; i++) {
      const screenshotPath = path.join(screenshotsDir, `${time}screenshot-${i}.png`);
      screenshots.push({ id: socket.id, name: `${time}screenshot-${i}.png` });
      await page.screenshot({ path: screenshotPath });
      console.log(`Screenshot saved: ${screenshotPath}`);
      infos.screenshots.push(`screenshots/${time}screenshot-${i}.png`);
      socket.emit('progress', i * 10);
      await new Promise(resolve => setTimeout(resolve, 500));
    }

    socket.emit('progress', 100);
    socket.emit('crawl', infos);

    await browser.close();
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

