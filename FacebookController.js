'use strict';

const FBMessenger = require('fb-messenger');

class FBMessengerController {

    /**
     * Creates a new instance of FBMessengerController.
     * @param {object} healthBot - Instance of the HealthBot
     * @param {string} messengerToken - The token for the FBMessenger registered in Slack
     */
    constructor(healthBot, messengerToken) {
        this.healthBot = healthBot;
        this.messengerToken = messengerToken;
    }

    /**
     * Starts the Slack Bot
     */
    start() {
        const messenger = new FBMessenger({
            token: this.messengerToken,
            name: 'bot'
        });
        messenger.on('start', () => {
            console.log('messenger running.')
        });
        messenger.on('message', (data) => {
            if (data.type == 'message' && data.channel.startsWith('D')) {
                if (!data.bot_id) {
                    let messageSender = data.user;
                    let message = data.text;
                    this.healthBot.processMessage(messageSender, message)
                        .then((reply) => {
                            messenger.postMessage(data.channel, reply.text, {});
                        });
                }
                else {
                    // ignore messages from the bot (messages we sent)
                }
            }
        });
    }
   receivedMessage(event) {
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
 sendGenericMessage(recipientId, messageText) {
  console.log(receipientId, messageText);
  // To be expanded in later sections
}

 sendTextMessage(recipientId, messageText) {
  var messageData = {
    recipient: {
      id: recipientId
    },
    message: {
      text: messageText
    }
  };

  callSendAPI(messageData);
}


 callSendAPI(messageData) {
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
}

module.exports = FBMessengerController;

