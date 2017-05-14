'use strict';

const cfenv = require('cfenv');
const dotenv = require('dotenv');
const express = require('express');
const CloudantDialogStore = require('./CloudantDialogStore');
const CloudantUserStore = require('./CloudantUserStore');
const HealthBot = require('./HealthBot');
const FacebookController = require('./FacebookController');
const WebSocketBotController = require('./WebSocketBotController');

const appEnv = cfenv.getAppEnv();
const app = express();
const http = require('http').Server(app);

app.use(express.static(__dirname + '/public'));

// set view engine and map views directory
app.set('views', __dirname + '/views');
app.set('view engine', 'ejs');

// map requests
app.get('/', function(req, res) {
    res.render('index.ejs', {
        webSocketProtocol: appEnv.url.indexOf('http://') == 0 ? 'ws://' : 'wss://'
    });
});

app.get('/webhook', function (req, res) {
    if (req.query['hub.verify_token'] === 'BADASS') {
        res.send(req.query['hub.challenge']);
    }
    res.send('Error, wrong validation token');
})

app.post('/webhook', function (req, res) {
    messaging_events = req.body.entry[0].messaging;
    for (i = 0; i < messaging_events.length; i++) {
        event = req.body.entry[0].messaging[i];
        sender = event.sender.id;
        if (event.message && event.message.text) {
            text = event.message.text;
            request("https://qr8rs-app.mybluemix.net/text=" + text, function (error, response, body) {
                sendMessage(sender, body);
            });
        }
    }
    res.sendStatus(200);
});


// start server on the specified port and binding host
http.listen(appEnv.port, appEnv.bind, () => {
    console.log("server starting on " + appEnv.url);

    // load environment variables and create an instance of the HealthBot
    dotenv.config();
    let healthBot = new HealthBot(
        new CloudantUserStore(process.env.CLOUDANT_URL, process.env.CLOUDANT_USER_DB_NAME),
        new CloudantDialogStore(process.env.CLOUDANT_URL, process.env.CLOUDANT_DIALOG_DB_NAME),
        process.env.CONVERSATION_USERNAME,
        process.env.CONVERSATION_PASSWORD,
        process.env.CONVERSATION_WORKSPACE_ID,
        process.env.FOURSQUARE_CLIENT_ID,
        process.env.FOURSQUARE_CLIENT_SECRET
    );
    // initialize the HealthBot
    healthBot.init()
        .then(() => {
            // create an instance of the WebSocketBotController to handle WebSocket connected clients
            let webSocketBotController = new WebSocketBotController(healthBot, http);
            webSocketBotController.start();
            // if a slack token is defined then create an instance of SlackBotController
            let slackToken = process.env.SLACK_BOT_TOKEN;
            if (slackToken) {
                let slackBotController = new SlackBotController(healthBot, slackToken);
                slackBotController.start();
            }
        })
        .catch((error) => {
            console.log(`Error: ${error}`);
            process.exit();
        });
});
