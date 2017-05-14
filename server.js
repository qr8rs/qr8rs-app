'use strict';

const cfenv = require('cfenv');
const dotenv = require('dotenv');
const express = require('express');
const bodyParser = require('body-parser');
const appEnv = cfenv.getAppEnv();
const app = express();
const http = require('http').Server(app);
const crypto = require('crypto');
const request = require('request');
const CloudantDialogStore = require('./CloudantDialogStore');
const CloudantUserStore = require('./CloudantUserStore');
const HealthBot = require('./HealthBot');
const FacebookController = require('./FacebookController');
const WebSocketBotController = require('./WebSocketBotController');

app.use(express.static(__dirname + '/public'));
app.use(bodyParser.json({ verify: verifyRequestSignature }));
// set view engine and map views directory
app.set('views', __dirname + '/views');
app.set('view engine', 'ejs');


function verifyRequestSignature(req, res, buf) {
  var signature = req.headers["x-hub-signature"];

  if (!signature) {
    // For testing, let's log an error. In production, you should throw an
    // error.
    console.error("Couldn't validate the signature.");
  } else {
    var elements = signature.split('=');
    var method = elements[0];
    var signatureHash = elements[1];

    var expectedHash = crypto.createHmac('sha1', process.env.MESSENGER_APP_SECRET)
                        .update(buf)
                        .digest('hex');

    if (signatureHash != expectedHash) {
      throw new Error("Couldn't validate the request signature.");
    }
  }
}

// map requests
app.get('/', function(req, res) {
    res.render('index.ejs', {
        webSocketProtocol: appEnv.url.indexOf('http://') == 0 ? 'ws://' : 'wss://'
    });
});

app.get('/webhook', function (req, res) {
    if (req.query['hub.verify_token'] === process.env.MESSENGER_VERIFY_TOKEN) {
        res.send(req.query['hub.challenge']);
    }
    res.send('Error, wrong validation token');
})

app.post('/webhook', function (req, res) {
  console.log("req.body", req.body);
  var data = req.body;

  // Make sure this is a page subscription
  if (data.object === 'page') {

    // Iterate over each entry - there may be multiple if batched
    data.entry.forEach(function(entry) {
      var pageID = entry.id;
      var timeOfEvent = entry.time;

      // Iterate over each messaging event
      entry.messaging.forEach(function(event) {
        if (event.message) {
          receivedMessage(event);
        } else {
          console.log("Webhook received unknown event: ", event);
        }
      });
    })
    res.sendStatus(200)
  }
})

function receivedMessage(event) {
  var senderID = event.sender.id;
  var recipientID = event.recipient.id;
  var timeOfMessage = event.timestamp;
  var message = event.message;

  console.log("Received message for user %d and page %d at %d with message:",
    senderID, recipientID, timeOfMessage);
  console.log(JSON.stringify(message));

  var messageId = message.mid;

  var messageText = message.text;
  var messageAttachments = message.attachments;

  if (messageText) {

    // If we receive a text message, check to see if it matches a keyword
    // and send back the example. Otherwise, just echo the text we received.
    switch (messageText) {
      case 'generic':
        sendGenericMessage(senderID);
        break;

      default:
        sendTextMessage(senderID, messageText);
    }
  } else if (messageAttachments) {
    sendTextMessage(senderID, "Message with attachment received");
  }
}

function sendGenericMessage(recipientId, messageText) {
  console.log(receipientId, messageText);
  // To be expanded in later sections
}

function sendTextMessage(recipientId, messageText) {
  healthBot.processMessage(recipientId, messageText).then((reply) => {
  var messageData = {
    recipient: {
      id: recipientId
    },
    message: {
      text: reply.text
    }
  };
  callSendAPI(messageData);
  })
}


 // this.healthBot.processMessage(messageSender, message)
 //  .then((reply) => {
 //      slackBot.postMessage(data.channel, reply.text, {});
 //  });


function callSendAPI(messageData) {
  request({
    uri: 'https://graph.facebook.com/v2.6/me/messages',
    qs: { access_token: process.env.MESSENGER_PAGE_TOKEN },
    method: 'POST',
    json: messageData

  }, function (error, response, body) {
    if (!error && response.statusCode == 200) {
      var recipientId = body.recipient_id;
      var messageId = body.message_id;

      console.log("Successfully sent generic message with id %s to recipient %s",
        messageId, recipientId);
    } else {
      console.error("Unable to send message.");
      console.error(response);
      console.error(error);
    }
  });
}




dotenv.config();

var healthBot = new HealthBot(
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
//   .then(() => {
//             // create an instance of the WebSocketBotController to handle WebSocket connected clients
//             let webSocketBotController = new WebSocketBotController(healthBot, http);
//             webSocketBotController.start();
//             // if a slack token is defined then create an instance of SlackBotController
//             let messengerToken = process.env.MESSENGER_PAGE_TOKEN;
//             if (messengerToken) {
//                 // let FBMessengerController = new FBMessengerController(healthBot, messengerToken);
//                 // FBMessengerController.start();
//                 // receivedMessage()
//             }
//         })
//         .catch((error) => {
//             console.log(`Error: ${error}`);
//             process.exit();
// });

// start server on the specified port and binding host
http.listen(appEnv.port, appEnv.bind, () => {
    console.log("server starting on " + appEnv.url);
});
    // load environment variables and create an instance of the HealthBot
    // dotenv.config();
    // let healthBot = new HealthBot(
    //     new CloudantUserStore(process.env.CLOUDANT_URL, process.env.CLOUDANT_USER_DB_NAME),
    //     new CloudantDialogStore(process.env.CLOUDANT_URL, process.env.CLOUDANT_DIALOG_DB_NAME),
    //     process.env.CONVERSATION_USERNAME,
    //     process.env.CONVERSATION_PASSWORD,
    //     process.env.CONVERSATION_WORKSPACE_ID,
    //     process.env.FOURSQUARE_CLIENT_ID,
    //     process.env.FOURSQUARE_CLIENT_SECRET
    // );
    // // initialize the HealthBot
    // healthBot.init()
    //     .then(() => {
    //         // create an instance of the WebSocketBotController to handle WebSocket connected clients
    //         let webSocketBotController = new WebSocketBotController(healthBot, http);
    //         webSocketBotController.start();
    //         // if a slack token is defined then create an instance of SlackBotController
    //         let messengerToken = process.env.MESSENGER_PAGE_TOKEN;
    //         if (messengerToken) {
    //             // let FBMessengerController = new FBMessengerController(healthBot, messengerToken);
    //             // FBMessengerController.start();
    //             // receivedMessage()
    //         }
    //     })
    //     .catch((error) => {
    //         console.log(`Error: ${error}`);
    //         process.exit();
    //     });
// });


