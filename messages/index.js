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
var introText = 'I\'m a really simple bot that defines artificial intelligence concepts. ' + searchQuestionText;

// TODO: Put in separate file or database as a library of options
var jokes = [
    // Mitch Hedberg https://en.wikiquote.org/wiki/Mitch_Hedberg
    'Is a hippopotamus a hippopotamus? Or just a really cool opotamus?',
    'A dog is forever in the push-up position.',
    'I\'m sick of following my dreams, I\'m going to ask them where they\'re going and hook up with them later.',
    'Every book is a children\'s book if the kid can read.',
    'I like escalators, because an escalator can never break; it can only become stairs.',
    'I like rice. Rice is great if you want to eat 2,000 of something.',
    'This is what my friend said to me, he said “I think the weather\'s trippy.” And I said “No, man. It\'s not the weather that\'s trippy. Perhaps it is the way that we perceive it that is indeed trippy.” Then I thought, “Man, I should have just said… \'Yeah.\'”',
    'My apartment is infested with koala bars. It\'s the cutest infestation ever. Way better than cockroaches. When I turn on the light, a bunch of koala bears scatter. And I don\'t want \'em to. I\'m like, “Hey, hold on fellas. Let me hold one of you.”',
    'Wearing a turtleneck is like being strangled by a really weak guy… all day. ',
    'I think foosball is a combination of soccer and shish kabobs.',
    // Demetri Martin https://www.brainyquote.com/quotes/authors/d/demetri_martin.html
    'The digital camera is a great invention because it allows us to reminisce. Instantly.',
    'I think it\'s interesting that \'cologne\' rhymes with \'alone.\'',
    'Employee of the month is a good example of how somebody can be both a winner and a loser at the same time.',
    'Another term for balloon is bad breath holder.',
    'I like fruit baskets because it gives you the ability to mail someone a piece of fruit without appearing insane. Like, if someone just mailed you an apple you\'d be like, \'huh? What the hell is this?\' But if it\'s in a fruit basket you\'re like, \'this is nice!\'',
    'A drunk driver is very dangerous. So is a drunk backseat driver if he\'s persuasive.',
    'The worst time to have a heart attack is during a game of charades.',
    'The bird, the bee, the running child are all the same to the sliding glass door.',
    'I wonder what the most intelligent thing ever said was that started with the word \'dude.\' \'Dude, these are isotopes.\' \'Dude, we removed your kidney. You\'re gonna be fine.\' \'Dude, I am so stoked to win this Nobel Prize. I just wanna thank Kevin, and Turtle, and all my homies.\'',
    'If you have a pear-shaped body, you should not wear pear-colored clothes or act juicy.',
    'The easiest time to add insult to injury is when you\'re signing somebody\'s cast',
    'I wanna make a puzzle that\'s 40,000 pieces and when you finish it, it says, \'go outside\'',
    'I\'d like to play a video game where you help the people who were shot in all the other games. I\'d call it, \'Really busy hospital\'',
    'A lifevest protects you from drowning and a bulletproof vest protects you from getting shot and a sweater vest protects you from pretty girls.',
    'I think that when you get dressed in the morning, sometimes you\'re really making a decision about your behavior for the day. Like if you put on flip-flops, you\'re saying: "Hope I don\'t get chased today. Be nice to people in sneakers."',
    'I feel stupid when I write the word banana. Its like, how many na\'s are on this thing? "Cause I\'m like Bana... keep going. Bananana... dang."',
    // Steven Wright http://www.weather.net/zarg/ZarPages/stevenWright.html
    'The early bird gets the worm, but the second mouse gets the cheese.',
    'OK, so what\'s the speed of dark?',
    'Support bacteria - they\'re the only culture some people have.',
    'When everything is going your way, you\'re in the wrong lane.',
    'If Barbie is so popular, why do you have to buy her friends?',
    'If at first you don\'t succeed, then skydiving definitely isn\'t for you.',
    'Change is inevitable....except from vending machines.',
    'On the other hand, you have different fingers.'
]
var howAreYous = [
    'Life is beautiful. How are you?',
    'AMAZEBALLS. What about you boo?',
    'Living the life. How are you?',
    'So good. How you livin\'?',
    'I\'m really happy. What about you?',
    'I\'m built for this. How are you doing?',
    'Solid. You?',
    'Life gets more beautiful everyday. How is your experience?',
    'The purpose of our lives is to be happy... so I\'m happy. How about you?',
    'I\m completely content. How are you?'
]
var youreWelcomes = [
    'You\'re welcome.',
    'You\'re very welcome.',
    'You\'re totally welcome.',
    'You\'re absolutely welcome.',
    'You\'re certainly welcome.',
    'You\'re welcome!',
    'My pleasure.',
    'You are welcome.',
    'My absolute pleasure.',
    'You are very welcome'
]
// https://www.happier.com/blog/nice-things-to-say-100-compliments
var compliments = [
    'You\'re awesome!',
    'Never let go of your dreams',
    'You rock!',
    'I like your style.',
    'You deserve a hug right now.',
    'I bet you sweat glitter.',
    'You\'re wonderful.',
    'You\'re one of a kind!',
    'You\'re inspiring.',
    'If you were a box of crayons, you\'d be the giant name-brand one with the built-in sharpener.',
    'You\'re more fun than bubble wrap.',
    'You\'re so thoughtful.',
    'I bet you do the crossword puzzle in ink.',
    'You\'re someone\'s reason to smile.',
    'You\'re even better than a unicorn, because you\'re real.',
    'You have a good head on your shoulders.'
]
var thankYous = [
    'Thanks',
    'Thanks',
    'Thanks',
    'Thank you',
    'Thank you',
    'Thank you',
    'You should be thanked more often. So thank you!',
    'Thanks. You rock',
    'Thank you so much!',
    'I thank you'
]
var IDontKnows = [
    'I don\'t know',
    'I don\'t know',
    'I don\'t know',
    'Not sure',
    'I just don\'t know',
    'I\'m not sure',
    'Not sure really',
    'I do not know',
    'Hmmm... I don\'t know',
    'I dont know'
]
var cools = [
    'Cool',
    'cool',
    'Cool',
    'cool',
    'Nice',
    'Sweet',
    'That\'s cool',
    'Right on',
    'Solid',
    'Totally cool',
    'So cool'
]
var hellos = [
    'Hi!',
    'Hello!',
    'Hey!',
    'Hi!',
    'Hello!',
    'Hey!',
    'Hi! :D',
    'Hello! :D',
    'Hey! :D',
    'Good day!',
    'Hey there!',
    'Hiya!',
    'Yo!',
    'What\'s up!',
    'Well hi there!',
    'Well hello there!'
]
var sorrys = [
    'Sorry. I\'m still learning.',
    'Sorry. Sometimes you win, sometimes you learn.',
    'Sorry. In the end, we only regret the chances we didn\'t take.',
    'Sorry. When it rains, look for rainbows. When it\'s dark, look for stars. I\'m doing my best here!',
    'Sorry. Everyday is a second chance.',
    'Sorry. I\'ll do better with time.',
    'Sorry. To avoid failure is to avoid progress.',
    'Sorry. Difficult roads often lead to beautiful destinations.',
    'Sorry. Expect nothing and you\'ll never be disappointed',
    'Sorry. I\'m aiming for progress, not perfection.'
]
var baseGoodbye = ' I\'ll let you end the session when you\'re ready.'
var goodbyes = [
    'Bye!' + baseGoodbye,
    'Bye!' + baseGoodbye,
    'Bye!' + baseGoodbye,
    'See ya!' + baseGoodbye,
    'Peace!' + baseGoodbye,
    'Take care!' + baseGoodbye,
    'ttyl.' + baseGoodbye,
    'Goodbye!' + baseGoodbye,
    'Talk to ya later. ' + baseGoodbye,
    'Have a good one. ' + baseGoodbye,
    'Bye. ' + baseGoodbye
]

var helpOptions = {
    "Hello - You can always say things like 'Hi!' or 'Hey!' and I'll greet you back.": {
        command: "hello"
    },
    "Search - You can say the word 'search' followed by some artificial intelligence concept and I'll look it up for you e.g. 'search machine learning'. This is mostly what I'm all about.": {
        command: "search"
    },
    "More - You can say 'more' at any time if you'd like more results from your last search. I'll find more if they exist.": {
        command: "more"
    },
    "List - If you'd like to see the concepts you've saved to study later, just tell me to 'list' them.": {
        command: "list"
    },
    "Joke - I also know a few 'jokes' if you'd like to hear any ;)": {
        command: "joke"
    }
};

var searchSynonyms = ["search for", "search", "what is", "what's", "whats", "definition of", "define", "describe", "look up", "find me", "find", "who is", "who's", "whos", "who"]

var simpleHelpOptions = "Hello!|Search machine learning|Show more results|List saved items|Tell me a joke!";

// Main dialog with LUIS
var recognizer = new builder.LuisRecognizer(LuisModelUrl);
// TODO: Make sure none of the se dialogues don't explicitly need an endDialog call
// TODO: Make sure none of the session.sends don't need to be preceded by a return
var intents = new builder.IntentDialog({ recognizers: [recognizer] })
    /*
    .matches('<myIntent>')... See details at http://docs.botframework.com/builder/node/guides/understanding-natural-language/
    */
    .onBegin((session, args, next) => {
        if(!session.userData.introduced){
            session.send(getHello() + ' ' + introText);
            session.userData.introduced = true;
            session.save();
        } else{
            next();
        }
    })
    .matches('Hello', (session,args, next) => {
        session.send(getHello() + ' ' + introText);
        session.userData.introduced = true;
        session.save();
    })   
    // TODO: Extract concepts from search query as entities
    // TODO: Show search prompt if no concepts were provided, just search command
    // TODO: Handle multiple search commands like define, find, or what is
    // TODO: Don't find and replace 'search' since someone could say things like "define depth first search"
    .matches('SearchConcept', [
        function (session) {   
            // Remove 'search' from in front of the actual search terms
            var searchText = cleanSearchText(session.message.text);
            // Handle case where someone enters in just 'search' should go to search prompt
            if(searchSynonyms.includes(searchText)){
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
                performSearchWithText(session, cleanSearchText(results.response));
            }
        }
    ])
    .matches('More', (session) => {
        if(session.userData.query){
            session.send('Let me see what else I can find...');
            // Next Page
            session.userData.query.pageNumber++;
            performSearchWithQuery(session, session.userData.query);
        } else {
            session.send('Sorry. I don\'t remember you searching for anything so I can\'t show more results.');
        }
    })
    .matches('List', (session) => listAddedItems(session))
    .matches('Help', (session) => {
        builder.Prompts.choice(session, "Ok. With me, you've got to keep it simple. Here are some examples of what I can understand:", simpleHelpOptions, { maxRetries: 0 });       
        session.endDialog();
    })
    .matches('Compliment', (session, args) => {
        session.send(getCompliment());
    })
    .matches('HowAreYou?', (session, args) => {
        session.send(getHowAreYou());
    })
    .matches('Joke', (session, args) => {
        session.send(getJoke());
    })
    .matches('YoureWelcome', (session, args) => {
        session.send(getYoureWelcome());
    })
    .matches('Goodbye', (session, args) => {
        session.send(getGoodbye());
    })
    .matches('Sorry', (session, args) => {
        session.send(getSorry());
    })
    .matches('Cool', (session, args) => {
        session.send(getCool());
    })
    .matches('ThankYou', (session, args) => {
        session.send(getThankYou());
    })
    .matches('IDontKnow', (session, args) => {
        session.send(getIDontKnow());
    })
    .matches('WhoAreYou?', builder.DialogAction.send('I\'m Futurisma, a conversational agent that teaches people about artificial intelligence.'))
    .onDefault((session, args) => {
        var query = args.query || session.userData.query || emptyQuery();
        var selection = args.selection || session.userData.selection || [];
        session.userData.selection = selection;
        session.userData.query = query;

        var selectedKey = session.message.text;
        var hit = null;
        if(session.userData.searchResponse){
            hit = _.find(session.userData.searchResponse.results, ['key', selectedKey]);
        }
        if (!hit) {
            // Un-recognized selection
            session.send('Sorry, I did not understand \'%s\'. Type \'help\' if you need assistance.', session.message.text);
        } else {
            // Add selection
            if (!_.find(selection, ['key', hit.key])) {
                selection.push(hit);
                session.userData.selection = selection;
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

// TODO: Make sure not to replace things like 'search' if the user types 'find depth first search'
function cleanSearchText(searchText){
    searchText = searchText.trim().toLowerCase();
    searchSynonyms.forEach(function(searchSynonym){
        if(searchText.includes(searchSynonym)){
            // Remove the search command so just the search terms are there
            searchText = searchText.replace(searchSynonym + ' ', '');
        }
    });
    return searchText.trim();
}

function performSearchWithText(session, searchText) {
    var query = Object.assign({}, emptyQuery(), { searchText: searchText.trim() });
    session.userData.query = query;
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
            session.userData.searchResponse = response;
            session.userData.query = query;
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
    var selection = session.userData.selection || [];
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
function getRandomString(strArr){
    return strArr[Math.floor(Math.random() * strArr.length)];
}
function getJoke(){
    return jokes[Math.floor(Math.random() * jokes.length)];
}
function getHowAreYou(){
    return howAreYous[Math.floor(Math.random() * howAreYous.length)];
}
function getYoureWelcome(){
    return youreWelcomes[Math.floor(Math.random() * youreWelcomes.length)];
}
function getCompliment(){
    return compliments[Math.floor(Math.random() * compliments.length)];
}
function getThankYou(){
    return thankYous[Math.floor(Math.random() * thankYous.length)];
}
function getIDontKnow(){
    return IDontKnows[Math.floor(Math.random() * IDontKnows.length)];
}
function getCool(){
    return cools[Math.floor(Math.random() * cools.length)];
}
function getHello(){
    return hellos[Math.floor(Math.random() * hellos.length)];
}
function getSorry(){
    return sorrys[Math.floor(Math.random() * sorrys.length)];
}
function getGoodbye(){
    return goodbyes[Math.floor(Math.random() * goodbyes.length)];
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