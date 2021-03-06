'use strict';

const ConversationV1 = require('watson-developer-cloud/conversation/v1');
const Foursquare = require('foursquarevenues');

class HealthBot {

    /**
     * Creates a new instance of HealthBot.
     * @param {object} userStore - Instance of CloudantUserStore used to store and retrieve users from Cloudant
     * @param {string} dialogStore - Instance of CloudantDialogStore used to store conversation history
     * @param {string} conversationUsername - The Watson Conversation username
     * @param {string} conversationPassword - The Watson Converation password
     * @param {string} conversationWorkspaceId - The Watson Conversation workspace ID
     * @param {string} foursquareClientId - The Foursquare Client ID
     * @param {string} foursquareClientSecret - The Foursquare Client Secret
     */
    constructor(userStore, dialogStore, conversationUsername, conversationPassword, conversationWorkspaceId, foursquareClientId, foursquareClientSecret) {
        this.userStore = userStore;
        this.dialogStore = dialogStore;
        this.dialogQueue = [];
        this.conversationService = new ConversationV1({
            username: conversationUsername,
            password: conversationPassword,
            version_date: '2017-04-21'
        });
        this.conversationWorkspaceId = conversationWorkspaceId;
        if (foursquareClientId && foursquareClientSecret) {
            this.foursquareClient = Foursquare(foursquareClientId, foursquareClientSecret);
        }
    }

     /**
     * Initializes the bot, including the required datastores.
     */
    init() {
        return Promise.all([
            this.userStore.init(),
            this.dialogStore.init()
        ]);
    }

    /**
     * Process the message entered by the user.
     * @param {string} message - The message entered by the user
     * @returns {Promise.<string|Error>} - The reply to be sent to the user if fulfilled, or an error if rejected
     */
    processMessage(messageSender, message) {
        let user = null;
        let conversationResponse = null;
        let reply = null;
        return this.getOrCreateUser(messageSender)
            .then((u) => {
                user = u;
                return this.sendRequestToWatsonConversation(message, user.conversationContext);
            })
            .then((response) => {
                conversationResponse = response;
                return this.handleResponseFromWatsonConversation(message, user, conversationResponse);
            })
            .then((replyText) => {
                reply = replyText;
                return this.updateUserWithWatsonConversationContext(user, conversationResponse.context);
            })
            .then((u) => {
                return Promise.resolve({conversationResponse: conversationResponse, text:reply});
            })
            .catch((error) => {
                console.log(`Error: ${JSON.stringify(error,null,2)}`);
                let reply = "Sorry, something went wrong!";
                return Promise.resolve({conversationResponse: conversationResponse, text:reply});
            });
    }

    /**
     * Sends the message entered by the user to Watson Conversation
     * along with the active Watson Conversation context that is used to keep track of the conversation.
     * @param {string} message - The message entered by the user
     * @param {object} conversationContext - The active Watson Conversation context
     * @returns {Promise.<object|error>} - The response from Watson Conversation if fulfilled, or an error if rejected
     */
    sendRequestToWatsonConversation(message, conversationContext) {
        return new Promise((resolve, reject) => {
            var conversationRequest = {
                input: {text: message},
                context: conversationContext,
                workspace_id: this.conversationWorkspaceId,
            };
            this.conversationService.message(conversationRequest, (error, response) => {
                if (error) {
                    reject(error);
                }
                else {
                    resolve(response);
                }
            });

        });
    }

    /**
     * Takes the response from Watson Conversation, performs any additional steps
     * that may be required, and returns the reply that should be sent to the user.
     * @param {string} message - The message sent by the user
     * @param {object} user - The active user stored in Cloudant
     * @param {object} conversationResponse - The response from Watson Conversation
     * @returns {Promise.<string|error>} - The reply to send to the user if fulfilled, or an error if rejected
     */
    handleResponseFromWatsonConversation(message, user, conversationResponse) {
      const action = conversationResponse.context.action;
      console.log('handleResponseFromWatsonConversation()', action);
                if (action == "getBudget") {
                    return this.handleSearchQuery(conversationResponse);
                }
                else {
                    return this.handleDefaultMessage(conversationResponse);
                }
            }


    /**
     * The default handler for any message from Watson Conversation that requires no additional steps.
     * Returns the reply that was configured in the Watson Conversation dialog.
     * @param {object} conversationResponse - The response from Watson Conversation
     * @returns {Promise.<string|error>} - The reply to send to the user if fulfilled, or an error if rejected
     */
    handleDefaultMessage(conversationResponse) {
        let reply = '';
        for (let i = 0; i < conversationResponse.output.text.length; i++) {
            reply += conversationResponse.output.text[i] + '\n';
        }
        return Promise.resolve(reply);
    }

    /**
     * The handler for the findDoctorBycity action defined in the Watson Conversation dialog.
     * Queries Foursquare for doctors based on the speciality identified by Watson Conversation
     * and the city entered by the user.
     * @param {object} conversationResponse - The response from Watson Conversation
     * @returns {Promise.<string|error>} - The reply to send to the user if fulfilled, or an error if rejected
     */
    handleSearchQuery(conversationResponse) {
        console.log("handleSearchQuery()");
        if (! this.foursquareClient) {
            return Promise.resolve('Please configure Foursquare.');
        }
        // Get the city from the context to be used in the query to Foursquare

        let query = '';
        console.log(conversationResponse.context);
        console.log('whatCity', conversationResponse.context.whatCity);
        console.log(JSON.stringify(conversationResponse.context));
        if (conversationResponse.context.activities == "Sights") {
            query = 'museum';
        } else if (conversationResponse.context.activities == "Sounds") {
            query = 'amphitheater';
        } else if (conversationResponse.context.activities == "Tastes") {
            query = 'food';
        } else {

        }

        // if (conversationResponse.context.city) {
        //     query += conversationResponse.context.city + ' ';
        // }

        // Get the city entered by the user to be used in the query
        let city = '';

        return new Promise((resolve, reject) => {
            let params = {
                "query": query,
                "near": conversationResponse.context.city,
                "radius": 5000
            };
            console.log(params)
            this.foursquareClient.getVenues(params, function(error, venues) {
                let reply = '';
                if (error) {
                    console.log(error);
                    reply = 'Sorry, I couldn\'t find any doctors near you.';
                }
                else {
                    reply = 'Here is what I found:\n';

                    var max_results = venues.response.venues.length;
                    if (max_results > 5) {
                        max_results = 5;
                    }
                    
                    for (var i=0; i<max_results; i++) {
                        console.log(JSON.stringify(venues.response.venues[i], null, 2))
                        if (reply.length > 0) {
                            reply += '\n';
                        }
                        reply += '* ' + venues.response.venues[i].name;
                    }
                }
                console.log("reply = ", reply);
                resolve(reply);
            });
        });
    }

    /**
     * Retrieves the user doc stored in the Cloudant database associated with the current user interacting with the bot.
     * First checks if the user is stored in Cloudant. If not, a new user is created in Cloudant.
     * @param {string} messageSender - The User ID from the messaging platform (Slack ID, or unique ID associated with the WebSocket client)
     * @returns {Promise.<object|error>} - The user that was retrieved or created if fulfilled, or an error if rejected
     */
    getOrCreateUser(messageSender) {
        return this.userStore.addUser(messageSender);
    }

    /**
     * Updates the user doc in Cloudant with the latest Watson Conversation context.
     * @param {object} user - The user doc associated with the active user
     * @param {context} context - The Watson Conversation context
     * @returns {Promise.<object|error>} - The user that was updated if fulfilled, or an error if rejected
     */
    updateUserWithWatsonConversationContext(user, context) {
        return this.userStore.updateUser(user, context);
    }

    /**
     * Retrieves the ID of the active conversation doc in the Cloudant conversation log database for the current user.
     * If this is the start of a new converation then a new document is created in Cloudant,
     * and the ID of the document is associated with the Watson Conversation context.
     * @param {string} user - The user doc associated with the active user
     * @param {object} conversationResponse - The response from Watson Conversation
     * @returns {Promise.<string|error>} - The ID of the active conversation doc in Cloudant if fulfilled, or an error if rejected
     */
    getOrCreateActiveConversationId(user, conversationResponse) {
        const newConversation = conversationResponse.context.newConversation;
        if (newConversation) {
            conversationResponse.context.newConversation = false;
            return this.dialogStore.addConversation(user._id)
                .then((conversationDoc) => {
                    conversationResponse.context.conversationDocId = conversationDoc._id;
                    return Promise.resolve(conversationDoc._id);
                });
        }
        else {
            return Promise.resolve(conversationResponse.context.conversationDocId);
        }
    }

    /**
     * Logs the dialog traversed in Watson Conversation by the current user to the Cloudant log database.
     * @param {string} conversationDocId - The ID of the active conversation doc in Cloudant
     * @param {string} name - The name of the dialog (action)
     * @param {string} message - The message sent by the user
     * @param {string} reply - The reply sent to the user
     */
    logDialog(conversationDocId, name, message, reply) {
        if (! conversationDocId) {
            return;
        }
        // queue up dialog to be saved asynchronously
        this.dialogQueue.push({conversationDocId: conversationDocId, name: name, message: message, reply: reply, date: Date.now()});
        if (this.dialogQueue.length > 1) {
            return;
        }
        else {
            setTimeout( () => {
                this.saveQueuedDialog();
            }, 1);
        }
    }

    /**
     * Saves any queued up dialogs.
     */
    saveQueuedDialog() {
        let dialog = this.dialogQueue.shift();
        let dialogDoc = {name:dialog.name, message:dialog.message, reply:dialog.reply, date:dialog.date};
        this.dialogStore.addDialog(dialog.conversationDocId, dialogDoc)
            .then(() => {
                if (this.dialogQueue.length > 0) {
                    this.saveQueuedDialog(state);
                }
            });
    }
}

module.exports = HealthBot;
