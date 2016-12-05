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

var luisAppId = process.env.LuisAppId || process.env['LuisAppId'];
var luisAPIKey = process.env.LuisAPIKey || process.env['LuisAPIKey'];
var luisAPIHostName = process.env.LuisAPIHostName || 'api.projectoxford.ai';
const LuisModelUrl = 'https://' + luisAPIHostName + '/luis/v1/application?id=' + luisAppId + '&subscription-key=' + luisAPIKey;

var searchQuestionText = 'You can say *search* followed by the A.I. concept you\'re interested in and I\'ll see what I can find.';
var hiText = 'Hi! I\'m a really simple bot that defines artificial intelligence concepts. ' + searchQuestionText;
var firstHello = true;
// TODO: Put in separate file or database as a library of options
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
// TODO: Make sure none of the se dialogues don't explicitly need an endDialog call
// TODO: Make sure none of the session.sends don't need to be preceded by a return
var intents = new builder.IntentDialog({ recognizers: [recognizer] })
    /*
    .matches('<myIntent>')... See details at http://docs.botframework.com/builder/node/guides/understanding-natural-language/
    */
    .onBegin((session, args, next) => {
        if(firstHello){
            session.send(hiText);
            firstHello = false;
        } else{
            next();
        }
    })
    // TODO: Extract concepts from search query as entities
    // TODO: Show search prompt if no concepts were provided, just search command
    // TODO: Handle multiple search commands like define, find, or what is
    // TODO: Don't find and replace 'search' since someone could say things like "define depth first search"
    .matches('SearchConcept', [
        function (session) {   
            // Remove 'search' from in front of the actual search terms
            var searchText = session.message.text.replace(/search /i,'').trim().toLowerCase();
            // Handle case where someone enters in just 'search' should go to search prompt
            if(searchText === 'search'){
                searchPrompt(session);
            // If anything greater than a single character is left after replacements 
            } else if(searchText && searchText.length > 1){
                performSearchWithText(session, searchText);
            } else {
                // No valid terms were given so ask for an exact string
                searchPrompt(session);
            }
        },
        function (session, results) {
            if(results && results.response){
                performSearchWithText(session, results.response);
            }
        }
    ])
    .matches('More', (session) => {
        if(session.dialogData.query){
            session.send('Let me see what else I can find...');
            // Next Page
            session.dialogData.query.pageNumber++;
            performSearchWithQuery(session, session.dialogData.query);
        } else {
            session.send('Sorry. I don\'t remember you searching for anything so I can\'t show more results.');
        }
    })
    .matches('List', (session) => listAddedItems(session))
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
    .matches('ThankYou', builder.DialogAction.send('Thanks'))
    .matches('IDontKnow', builder.DialogAction.send('I don\'t know'))
    .matches('WhoAreYou?', builder.DialogAction.send('I\'m Futurisma, a conversational agent that teaches people about artificial intelligence.'))
    .onDefault((session, args) => {
        var query = args.query || session.dialogData.query || emptyQuery();
        var selection = args.selection || session.dialogData.selection || [];
        session.dialogData.selection = selection;
        session.dialogData.query = query;

        var selectedKey = session.message.text;
        var hit = null;
        if(session.dialogData.searchResponse){
            hit = _.find(session.dialogData.searchResponse.results, ['key', selectedKey]);
        }
        if (!hit) {
            // Un-recognized selection
            session.send('Sorry, I did not understand \'%s\'. Type \'help\' if you need assistance.', session.message.text);
        } else {
            // Add selection
            if (!_.find(selection, ['key', hit.key])) {
                selection.push(hit);
                session.dialogData.selection = selection;
                // TODO: Test that this persists no matter what dialogues are called.
                session.save();
            }

            // Multi-select -> Continue?
            session.send('%s was added to your list!', hit.title);
        }
});

bot.dialog('/', intents);

// Search
// TODO: Store keys in env variables
var AzureSearch = require('./SearchProviders/azure-search');
var AzureSearchClient = AzureSearch.create('futurisma', 'AB6A49BC44C7E4DD94615981EC60DB64', 'aiconcept');
var AzureSearchHelper = require('./SearchProviders/azure-search-helper');

var conceptsResultsMapper = AzureSearchHelper.defaultResultsMapper(conceptToSearchHit);
var searchSettings = {
    pageSize: 5,
    search: (query) => AzureSearchClient.search(query).then(conceptsResultsMapper)
};

function emptyQuery() {
    return { pageNumber: 1, pageSize: searchSettings.pageSize, filters: [] };
}

function performSearchWithText(session, searchText) {
    var query = Object.assign({}, emptyQuery(), { searchText: searchText.trim() });
    session.dialogData.query = query;
    session.save();
    performSearchWithQuery(session, query);
}   

function performSearchWithQuery(session, query) {
    searchSettings.search(query).then((response) => {
        if (response.results.length === 0) {
            // No Results
            session.send('Sorry, I didn\'t find any matches.');
        } else {
            // Save state
            session.dialogData.searchResponse = response;
            session.dialogData.query = query;
            session.save();

            // Display results
            var results = response.results;
            var reply = new builder.Message(session)
                .text('Here are a few good options I found:')
                .attachmentLayout(builder.AttachmentLayout.carousel)
                .attachments(results.map(searchHitAsCard.bind(null, true)));
            session.send(reply);
            session.send('You can select one or more to add to your list to study later, *list* what you\'ve selected so far, see *more* results, or *search* again.');
        }
    });
}

function searchPrompt(session) {
    var prompt = 'What concept would you like to search for?';
    builder.Prompts.text(session, prompt);
}

function listAddedItems(session) {
    var selection = session.dialogData.selection || [];
    if (selection.length === 0) {
        session.send('You have not added anything yet.');
    } else {
        var actions = selection.map((hit) => builder.CardAction.imBack(session, hit.title));
        var message = new builder.Message(session)
            .text('Here\'s what you\'ve added to your list so far:')
            .attachments(selection.map(searchHitAsCard.bind(null, false)))
            .attachmentLayout(builder.AttachmentLayout.list);
        session.send(message);
    }
}

function searchHitAsCard(showSave, searchHit) {
    var buttons = showSave
        ? [new builder.CardAction().type('imBack').title('Save').value(searchHit.key)]
        : [];

    var card = new builder.HeroCard()
        .title(searchHit.title)
        .buttons(buttons);

    if (searchHit.description) {
        card.subtitle(searchHit.description);
    }

    if (searchHit.imageUrl) {
        card.images([new builder.CardImage().url(searchHit.imageUrl)])
    }

    return card;
}

// Maps the AzureSearch Job Document into a SearchHit that the Search Library can use
function conceptToSearchHit(concept) {
    return {
        key: concept.id,
        title: concept.title,
        description: concept.extract
    };
}

// Other Helpers
function getJoke(){
    return jokes[Math.floor(Math.random() * jokes.length)];
}

// Testing
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

