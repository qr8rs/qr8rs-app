'use strict';

const cfenv = require('cfenv');
const dotenv = require('dotenv');
const express = require('express');
const bodyParser = require('body-parser');

const appEnv = cfenv.getAppEnv();
const app = express();
const http = require('http').Server(app);
const crypto = require('crypto');

const APP_SECRET=//FILL ME IN

app.use(express.static(__dirname + '/public'));
app.use(bodyParser.json({ verify: verifyRequestSignature }));


// map requests

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

    var expectedHash = crypto.createHmac('sha1', APP_SECRET)
                        .update(buf)
                        .digest('hex');

    if (signatureHash != expectedHash) {
      throw new Error("Couldn't validate the request signature.");
    }
  }
}

app.get('/webhook', function(req, res) {
  if (req.query['hub.mode'] === 'subscribe' &&
      req.query['hub.verify_token'] === 'FILL ME IN') {
    console.log("Validating webhook");
    res.status(200).send(req.query['hub.challenge']);
  } else {
    console.error("Failed validation. Make sure the validation tokens match.");
    res.sendStatus(403);          
  }  
});


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
    });

    // Assume all went well.
    //
    // You must send back a 200, within 20 seconds, to let us know
    // you've successfully received the callback. Otherwise, the request
    // will time out and we will keep trying to resend.
    res.sendStatus(200);
  }
});
  
function receivedMessage(event) {
  // Putting a stub for now, we'll expand it in the following steps
  console.log("Message data: ", event.message);
}

app.get('/', function(req, res) {
    res.send({Hello: "World"});
});

app.post('/', function(req, res) {
    res.send('POST request to homepage');
});

app.listen(6001, "0.0.0.0", function(){
    console.log("Server is listening on 0.0.0.0:6001");
});
