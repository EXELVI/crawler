require('dotenv').config();
const puppeteer = require('puppeteer');
const express = require('express');
const bodyParser = require('body-parser');
const http = require('http');
const logger = require('morgan');
const path = require('path');
const socketIo = require('socket.io');
const fs = require('fs');

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

io.on('connection', socket => {
    console.log('Client connected');

    socket.on('disconnect', () => {
        console.log('Client disconnected');
    });
})

server.listen(3000, () => {
    console.log(`Server running on port ${server.address().port}`);
});

 