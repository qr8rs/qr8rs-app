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
}

module.exports = FBMessengerController;
