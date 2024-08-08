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

io.on('connection', socket => {
  console.log('Client connected');

  socket.on('disconnect', () => {
    console.log('Client disconnected');
    screenshots.forEach(screenshot => {
      if (screenshot.id === socket.id) {
        fs.unlinkSync(path.join(__dirname, 'screenshots', screenshot.name));
      }
    });
  });

  socket.on("crawl", async (url) => {
    const screenshotsDir = path.join(__dirname, 'screenshots');
    if (!fs.existsSync(screenshotsDir)) {
      fs.mkdirSync(screenshotsDir);
    }
    const browser = await puppeteer.launch({
      headless: true,
      executablePath: "C:\\Program Files\\BraveSoftware\\Brave-Browser\\Application\\brave.exe",
      //userDataDir: 'C:\\Users\\exelv\\AppData\Local\\BraveSoftware\\Brave-Browser\\User Data',
      defaultViewport: { width: 1920, height: 1080 }
  });
  socket.emit('loading', 'Loading page...');
    const page = await browser.newPage()
    await page.goto(url);

    await page.reload(); // Awoiding youtube cookies popup

    let time = new Date().getTime();

    let infos = {
      title: await page.title(),
      url: url,
      screenshots: []
    }

    for (let i = 0; i < 5; i++) {
      const screenshotPath = path.join(screenshotsDir, `${time}screenshot-${i}.png`);
      screenshots.push({ id: socket.id, name: `${time}screenshot-${i}.png` });
      await page.screenshot({ path: screenshotPath });
      console.log(`Screenshot saved: ${screenshotPath}`);
      infos.screenshots.push(`screenshots/${time}screenshot-${i}.png`);
      await new Promise(resolve => setTimeout(resolve, 500));
    }

    socket.emit('crawl', infos);

    await browser.close();
  });
})

server.listen(3000, () => {
  console.log(`Server running on port ${server.address().port}`);
});

