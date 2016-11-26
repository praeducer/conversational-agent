/*-----------------------------------------------------------------------------
See package.json.

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

// PowerShell $env:NODE_ENV="development"
var useEmulator = (process.env.NODE_ENV == 'development');

var connector = useEmulator ? new builder.ChatConnector() : new botbuilder_azure.BotServiceConnector({
    appId: process.env['MicrosoftAppId'],
    appPassword: process.env['MicrosoftAppPassword'],
    stateEndpoint: process.env['BotStateEndpoint'],
    openIdMetadata: process.env['BotOpenIdMetadata']
});

var bot = new builder.UniversalBot(connector);

// TODO: Make sure you add code to validate these fields
var luisAppId = process.env.LuisAppId || process.env['LuisAppId'];
var luisAPIKey = process.env.LuisAPIKey || process.env['LuisAPIKey'];
var luisAPIHostName = process.env.LuisAPIHostName || 'api.projectoxford.ai';

const LuisModelUrl = 'https://' + luisAPIHostName + '/luis/v1/application?id=' + luisAppId + '&subscription-key=' + luisAPIKey;

var searchQuestionText = 'You can say *search* followed by the A.I. concept you\'re interested in and I\'ll start the search process.';
var hiText = 'Hi! I\'m a really simple bot that defines artificial intelligence concepts. ' + searchQuestionText;
var firstHello = true;
var jokes = [
    'Is a hippopotamus a hippopotamus? Or just a really cool opotamus?',
    'A dog is forever in the push-up position.',
    'I\'m sick of following my dreams, I\'m going to ask them where they\'re going and hook up with them later.',
    'Every book is a children\'s book if the kid can read.',
    'I like escalators, because an escalator can never break; it can only become stairs.',
    'I like rice. Rice is great if you want to eat 2,000 of something.',
    'This is what my friend said to me, he said “I think the weather\'s trippy.” And I said “No, man. It\'s not the weather that\'s trippy. Perhaps it is the way that we perceive it that is indeed trippy.” Then I thought, “Man, I should have just said… \'Yeah.\'”',
    'My apartment is infested with koala bars. It\'s the cutest infestation ever. Way better than cockroaches. When I turn on the light, a bunch of koala bears scatter. And I don\'t want \'em to. I\'m like, “Hey, hold on fellas. Let me hold one of you.”',
    'Wearing a turtleneck is like being strangled by a really weak guy… all day. ',
    'I think foosball is a combination of soccer and shish kabobs.'
]

// Main dialog with LUIS
var recognizer = new builder.LuisRecognizer(LuisModelUrl);
var intents = new builder.IntentDialog({ recognizers: [recognizer] })
    /*
    .matches('<yourIntent>')... See details at http://docs.botframework.com/builder/node/guides/understanding-natural-language/
    */
    .onBegin((session,args, next) => {
        if(firstHello){
            session.send(hiText);
            firstHello = false;
        } else{
            next();
        }
    })
    .matches('SearchConcept', (session) => {
        session.beginDialog('concepts:/', { response: session.message.text.replace(/search/i,'')});
    })
    .matches(/search/ig, (session) => {
        session.beginDialog('concepts:/', { response: session.message.text.replace(/search/i,'')});
    })
    .matches('Hello', builder.DialogAction.send(hiText))
    .matches('Compliment', builder.DialogAction.send('You\'re awesome!'))
    .matches('HowAreYou?', builder.DialogAction.send('Life is beautiful. How are you?'))
    .matches('Joke', (session,args, next) => {
        session.send(getJoke());
    })
    .matches('YoureWelcome', builder.DialogAction.send('You\'re welcome.'))
    .matches('Goodbye', builder.DialogAction.send('Bye! I\'ll let you end the session when you\'re ready.'))
    .matches('Help', builder.DialogAction.send(hiText))
    .matches('Sorry', builder.DialogAction.send('Sorry. I\'m still learning.'))
    .matches('Cool', builder.DialogAction.send('Cool'))
    .matches('Thanks', builder.DialogAction.send('Thanks'))
    .matches('IDontKnow', builder.DialogAction.send('I don\'t know'))
    .onDefault((session) => {
        session.send('Sorry, I did not understand \'%s\'. Type \'help\' if you need assistance.', session.message.text);
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
    multipleSelection: true,
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
function getJoke(){
    return jokes[Math.floor(Math.random() * jokes.length)];
}

if (useEmulator) {
    var emulatorServer = restify.createServer();
    emulatorServer.listen(3978, function() {
        console.log('using LUIS at ' + LuisModelUrl);
        console.log('test bot endpoint at http://localhost:3978/api/messages');
    });
    emulatorServer.post('/api/messages', connector.listen());    
} else {
    module.exports = { default: connector.listen() }
}

