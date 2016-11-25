/*-----------------------------------------------------------------------------

Inspired By:
+ http://docs.botframework.com/builder/node/guides/understanding-natural-language/
+ https://github.com/Microsoft/BotBuilder-Samples/tree/master/Node/demo-Search
-----------------------------------------------------------------------------*/
"use strict";
var util = require('util');
var _ = require('lodash');
var builder = require("botbuilder");
var botbuilder_azure = require("botbuilder-azure");
var restify = require('restify');

var useEmulator = (process.env.NODE_ENV == 'development');

var connector = useEmulator ? new builder.ChatConnector() : new botbuilder_azure.BotServiceConnector({
    appId: process.env['MicrosoftAppId'],
    appPassword: process.env['MicrosoftAppPassword'],
    stateEndpoint: process.env['BotStateEndpoint'],
    openIdMetadata: process.env['BotOpenIdMetadata']
});

var bot = new builder.UniversalBot(connector);

// Make sure you add code to validate these fields
var luisAppId = process.env.LuisAppId;
var luisAPIKey = process.env.LuisAPIKey;
var luisAPIHostName = process.env.LuisAPIHostName || 'api.projectoxford.ai';

const LuisModelUrl = 'https://' + luisAPIHostName + '/luis/v1/application?id=' + luisAppId + '&subscription-key=' + luisAPIKey;

// Main dialog with LUIS
var recognizer = new builder.LuisRecognizer(LuisModelUrl);
var intents = new builder.IntentDialog({ recognizers: [recognizer] })
/*
.matches('<yourIntent>')... See details at http://docs.botframework.com/builder/node/guides/understanding-natural-language/
*/
.matches('Define', (session, args) => {
    session.send('Hello! I\'ll search my knowledge-base for the concept: \'%s\'.', session.message.text);
    // trigger Search dialog root
    var query = session.message.text;
    session.beginDialog('concepts:/', { query });
})
.onDefault((session) => {
    session.send('Sorry, I did not understand \'%s\'.', session.message.text);
});

bot.dialog('/', intents);    

// Azure Search provider
// TODO: Store keys in env variables
var AzureSearch = require('./SearchProviders/azure-search');
var azureSearchClient = AzureSearch.create('futurisma', 'AB6A49BC44C7E4DD94615981EC60DB64', 'aiconcept');

/// <reference path="../SearchDialogLibrary/index.d.ts" />
var SearchDialogLibrary = require('./SearchDialogLibrary');

// Jobs Listing Search
var conceptsResultsMapper = SearchDialogLibrary.defaultResultsMapper(conceptToSearchHit);
var concept = SearchDialogLibrary.create('concepts', {
    search: (query) => azureSearchClient.search(query).then(conceptsResultsMapper)
});

bot.library(concept);

// Maps the AzureSearch Job Document into a SearchHit that the Search Library can use
function conceptToSearchHit(concept) {
    return {
        key: concept.id,
        title: concept.title,
        description: concept.extract
    };
}

if (useEmulator) {
    var emulatorServer = restify.createServer();
    emulatorServer.listen(3978, function() {
        console.log('test bot endpoint at http://localhost:3978/api/messages');
    });
    emulatorServer.post('/api/messages', connector.listen());    
} else {
    module.exports = { default: connector.listen() }
}

