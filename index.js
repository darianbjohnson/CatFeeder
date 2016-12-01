/**
 *  Cat Feeder Skill code
 *  written by Darian Johnson
 *  @darianbjohnson (twitter)
 * Built on template provide by Amazon 
   
    Copyright 2014-2015 Amazon.com, Inc. or its affiliates. All Rights Reserved.
    Licensed under the Apache License, Version 2.0 (the "License"). You may not use this file except in compliance with the License. A copy of the License is located at
        http://aws.amazon.com/apache2.0/
    or in the "license" file accompanying this file. This file is distributed on an "AS IS" BASIS, WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied. See the License for the specific language governing permissions and limitations under the License.
*/


/**
 * App ID for the skill
 */
var APP_ID = undefined; //replace with 'amzn1.echo-sdk-ams.app.[your-unique-value-here]';


var AWS = require('aws-sdk'); 
var ddb = new AWS.DynamoDB();
var iotdata = new AWS.IotData({endpoint: 'a2i6a7wz34e2k1.iot.us-east-1.amazonaws.com'});

var uuid = require('uuid');
var request = require('request');

/**
 * The AlexaSkill Module that has the AlexaSkill prototype and helper functions
 */
var AlexaSkill = require('./AlexaSkill');

//Global variables
var topic_id = "";
var zipcode = "notset";


/**
 * CatFeeder is a child of AlexaSkill.
 * To read more about inheritance in JavaScript, see the link below.
 *
 * @see https://developer.mozilla.org/en-US/docs/Web/JavaScript/Introduction_to_Object-Oriented_JavaScript#Inheritance
 */
var CatFeeder = function() {
    AlexaSkill.call(this, APP_ID);
};

// Extend AlexaSkill
CatFeeder.prototype = Object.create(AlexaSkill.prototype);
CatFeeder.prototype.constructor = CatFeeder;

//Global arrays
var sessionAttributes = {}; 
var monthNames = ["January", "February", "March", "April", "May", "June",
                      "July", "August", "September", "October", "November", "December"
    ];
	
var monthNums = ["01", "02", "03", "04", "05", "06",
                      "07", "08", "09", "10", "11", "12"];

var catJokes = [
	"Cats are like potato chips.<p>You can never have just one.</p>",
	"Why is it so hard for a leopard to hide?<p>Because he’s always spotted.</p>",
	"What do you use to comb a cat?<p>A catacomb.</p>",
	"What is the name of the unauthorized autobiography of the cat?<p>Hiss and Tell</p>",
	"Why are cats better than babies?<p>Because you only have to change a litter box once a day.</p>",
	"What is the difference between a cat and a comma?<p>One has the paws before the claws and the other has the clause before the pause.</p>",
	"Did you hear about the cat who swallowed a ball of wool?<p>She had mittens</p>",
	"Did you hear about the cat who drank five bowls of water?<p>He set a new lap record</p>",
	"If lights run on electricity and cars run on gas, what do cats run on?<p>Their paws</p>",
	"What does a cat like to eat on a hot day?<p>A mice cream cone.</p>",
	"How do cats end a fight?<p>They hiss and make up.</p>",
	"How many cats can you put into an empty box?<p>Only one. After that, the box isn’t empty.</p>",
	"Why did the cat run from the tree?<p>Because it was afraid of the bark!</p>",
	"What do cats like to eat for breakfast?<p>Mice Krispies.</p>",
	"What do you call the cat that was caught by the police?<p>The purr petrator</p>",
	"Why don’t cats play poker in the jungle?<p>Too many cheetahs.</p>"
];

CatFeeder.prototype.eventHandlers.onSessionStarted = function (sessionStartedRequest, session) {
    console.log("CatFeeder onSessionStarted requestId: " + sessionStartedRequest.requestId
        + ", sessionId: " + session.sessionId);
	
    // any session init logic would go here
};

CatFeeder.prototype.eventHandlers.onLaunch = function (launchRequest, session, response) {
    console.log("CatFeeder onLaunch requestId: " + launchRequest.requestId + ", sessionId: " + session.sessionId);
    getWelcomeResponse(response);
};

CatFeeder.prototype.eventHandlers.onSessionEnded = function (sessionEndedRequest, session) {
    console.log("onSessionEnded requestId: " + sessionEndedRequest.requestId
        + ", sessionId: " + session.sessionId);

    // any session cleanup logic would go here
};


/**********************************************************************************
 *  INTERPRET INTENTS AND ROUTE APPROPRIATELY
 *  This section routes the user to the correct intent
 */

CatFeeder.prototype.intentHandlers = {
	//Called when user asks to feed the cat
	"FeedCat": function (intent, session, response) {

		getTopic(session.user.userId, function(value){

			topic_id = value;

			if (topic_id === 'notset'){	
				firstTimeConfig(intent, session, response);
			}else{	
				feedCat(intent, session, response);
			}
		});
		
    },

	//called when user asks to configre their system (receive a new code)
	"Configure": function (intent, session, response) {
		
			reConfigure(intent, session, response);
		
    },

	//called when the user requests a photo of the pet food bowl
	"Picture": function (intent, session, response) {
		getTopic(session.user.userId, function(value){

			topic_id = value;

			if (topic_id === 'notset'){
				firstTimeConfig(intent, session, response);
			}else{
				getPicture(intent, session, response);
			}
		});
	
    },

	//called to get the last time Alexa attempted to dispense food
	"GetLastFeedingTime": function (intent, session, response) {
		
		getTopic(session.user.userId, function(value){

			topic_id = value;

			if (topic_id === 'notset'){	
				firstTimeConfig(intent, session, response);
			}else{
				getLastFeedingTime(intent, session, response);
			}
		});
		
    },

	//called to determine if the food hopper needs to be refilled
	"GetCatFeederStatus": function (intent, session, response) {

		getTopic(session.user.userId, function(value){

			topic_id = value;

			if (topic_id === 'notset'){	
				firstTimeConfig(intent, session, response);
			}else{
				getCatFeederStatus(intent, session, response);
			}
		});
		
    },

	//called to change the user's zip code (zip code is used in conjustion with the CatFeederStatus logic)
	"ChangeZipCode": function (intent, session, response) {

		sessionAttributes.intent_from = "zipcode";
		session.attributes = sessionAttributes;

		var speechOutput = {
			speech: "O.K. Tell me your zip code.",
			type: AlexaSkill.speechOutputType.PLAIN_TEXT
		};
		response.ask(speechOutput);
		return;

	},

	//routes the user appropriately if they respond with a number (could be for feeding can or zip code)
	"HandleNumber": function (intent, session, response){

		getTopic(session.user.userId, function(value){

			topic_id = value;

			if (topic_id === 'notset'){	
				firstTimeConfig(intent, session, response);
			}else{	
				if (typeof session.attributes.intent_from !== 'undefined'){
					if (session.attributes.intent_from === 'zipcode'){
						updateZipCode(intent, session, response);
					}
				}else{
					feedCat(intent, session, response);
				}
			}
		});

	},

	//called when the user asks to receive a link to the instrcutions
	"SendMeInstructions": function (intent, session, response) {
        var speechOutput = {
                speech: "Ok, I've send you the instructions. Check you Alexa app.",
                type: AlexaSkill.speechOutputType.PLAIN_TEXT
        };

		var cardTitle = "Instructions";

		var cardContent = "Here is the link to the instructions on building the cat feeder: https://goo.gl/73uAW8\n" +
						 "Typical commands include:\n"+
						 "- Feed my cat\n" +
						 "- Feed my cat four ounces\n" +
						 "- When did I last feed the cat?\n" +
						 "- Does my cat need food? \n" +
						 "- Do I need to fill my feeder? \n" +
						 "- Configure"
							
        response.tellWithCard(speechOutput, cardTitle, cardContent);
    },

	//called when the user requests a cat joke
	"CatJokes": function (intent, session, response){

		var jokeIndex = Math.floor(Math.random() * catJokes.length);
		var randomJoke = catJokes[jokeIndex];

		var speechOutput = {
            speech: "<speak>" + randomJoke + "</speak>",
           // type: AlexaSkill.speechOutputType.PLAIN_TEXT
		   type: AlexaSkill.speechOutputType.SSML
        };
        response.tell(speechOutput);

	},

    "AMAZON.HelpIntent": function (intent, session, response) {
        var speechText = "Ok. Here's how I can help. I can feed your cat up to 4 ounces at a time. I work with a do it yourself Raspberry Pi cat feeder. " +
	       "You can ask me " +
		   "to feed the cat, " +
		   "When did I last feed the cat, " +
		   "Does the cat feed food, " +
		   "and, Do I need to fill the feeder. " +
		   "Check the Alexa App for a link to instructions on how to build the cat feeder and link it to this skill. "
		   "So, how can I help you?"
        var repromptText = "Ask me to feed the cat.";
        var speechOutput = {
            speech: speechText,
            type: AlexaSkill.speechOutputType.PLAIN_TEXT
        };
        var repromptOutput = {
            speech: repromptText,
            type: AlexaSkill.speechOutputType.PLAIN_TEXT
        };

		var cardTitle = "Help";

		var cardContent = "Here is the link to the instructions on building the cat feeder: https://goo.gl/73uAW8\n" +
						 "Typical commands include:\n"+
						 "- Feed my cat\n" +
						 "- Feed my cat four ounces\n" +
						 "- When did I last feed the cat?\n" +
						 "- Does my cat need food? \n" +
						 "- Do I need to fill my feeder?"
							
        response.askWithCard(speechOutput, repromptOutput, cardTitle, cardContent);
    },

    "AMAZON.StopIntent": function (intent, session, response) {
        var speechOutput = {
                speech: "Goodbye",
                type: AlexaSkill.speechOutputType.PLAIN_TEXT
        };
        response.tell(speechOutput);
    },

    "AMAZON.CancelIntent": function (intent, session, response) {
        var speechOutput = {
                speech: "Goodbye",
                type: AlexaSkill.speechOutputType.PLAIN_TEXT
        };
        response.tell(speechOutput);
    },

    "AMAZON.YesIntent": function (intent, session, response) {

		if (typeof session.attributes.intent_from !== 'undefined'){
			if (session.attributes.intent_from === 'zipcode'){

				sessionAttributes.intent_from = "zipcode";
				session.attributes = sessionAttributes;

				var speechOutput = {
					speech: "O.K. Tell me your zip code.",
					type: AlexaSkill.speechOutputType.PLAIN_TEXT
				};
				response.ask(speechOutput);
				return;
			}
		}

		if (typeof session.attributes.override !== 'undefined'){

			if (session.attributes.override === true){
				feedCat(intent, session, response);
				//return;
			}

		}else{
			var speechOutput = {
				speech: "I'm sorry, I didn't understand your request. Goodbye.",
				type: AlexaSkill.speechOutputType.PLAIN_TEXT
			};
			response.tell(speechOutput);
		}
    },

	"AMAZON.NoIntent": function (intent, session, response) {

		if (typeof session.attributes.intent_from !== 'undefined'){
			if (session.attributes.intent_from === 'zipcode'){

				var speechOutput = {
				speech: "O.K. I won't take your zipcode at this time. You can add your zip code at any time by saying 'Change Zip Code'. Goodbye.",
				type: AlexaSkill.speechOutputType.PLAIN_TEXT
				};
				response.tell(speechOutput);
				return;
			}
		}

		if (typeof session.attributes.override !== 'undefined'){

			var speechOutput = {
				speech: "O.K. I won't feed your cat at this time. Goodbye.",
				type: AlexaSkill.speechOutputType.PLAIN_TEXT
			};
			response.tell(speechOutput);
			return;

		}else{
			var speechOutput = {
				speech: "I'm sorry, I didn't understand your request. Goodbye.",
				type: AlexaSkill.speechOutputType.PLAIN_TEXT
			};
			response.tell(speechOutput);
			return;
		}
    },

	//called when the user gives a random or unrelated request
	"CatchAllIntent": function (intent, session, response) {

		session.attributes = sessionAttributes;

		var speechOutput = {
			speech: "I'm sorry, but I did not understand your request. Can you please restate your request. If you need help, say 'help.",
			type: AlexaSkill.speechOutputType.PLAIN_TEXT
		};
		response.ask(speechOutput);
		return;
		
	}


};

/**********************************************************************************
 *  FORMAT AND HANDLE RESPONSES
 *  This section houses the functions responsible for returning a response to the user
 */

//provides a response on lauch w/o an intent supplied
function getWelcomeResponse(response) {
    // If we wanted to initialize the session to have some attributes we could add those here.
    var cardTitle = "The Cat Feeder";
    var speechText = "The Cat Feeder skill allows you to use a raspberry pi cat feeder to dispense food to your cat, or dog, using Alexa commands. " +
	"I've sent more information about the do-it-yourself feeder to your Alexa App. To get started, tell me to 'feed the cat'.";

	var repromptText = "Are you there? If you need help, say help.";

    var cardOutput = "The Cat Feeder skill works with a Raspberry Pi do it yourself Cat Feeder. Check the following site for more details: https://goo.gl/73uAW8.";

    var speechOutput = {
        speech: "<speak>" + speechText + "</speak>",
        type: AlexaSkill.speechOutputType.SSML
    };
    var repromptOutput = {
        speech: repromptText,
        type: AlexaSkill.speechOutputType.PLAIN_TEXT
    };
    response.askWithCard(speechOutput, repromptOutput, cardTitle, cardOutput);
}

//main call to feed cat
function feedCat(intent, session, response){
    var speechText = "";
    var repromptText = "";
    var speechOutput = "";
    var repromptOutput = "";
	var amount = 0;
	var ounces = 0;
	var payload ="";

	var topic = topic_id + '/feed' ; //used to route message to correct MQTT topic
	sessionAttributes.intent_from='feedCat'; //used to route intents if the user needs to provide the amout of food (size slot)

	if (typeof session.attributes.ounces !== 'undefined'){
		amount = session.attributes.amount;
		ounces = session.attributes.ounces;

	}else{
		if (intent.name === 'AMAZON.YesIntent'){ //if the user responds yes if Alexa asks if the user wishes to feed the cat
			speechText = "How much food do you want me to give the cat? Tell me either one, two, three, or four ounces."
			speechOutput = {
				speech: "<speak>" + speechText + "</speak>",
				type: AlexaSkill.speechOutputType.SSML
			};

			response.ask(speechOutput);
			return;
		}

		if (typeof intent.slots.size.value === 'undefined'){ //amount of food not provided

			speechText = "How much food do you want me to give the cat? Tell me either one, two, three, or four ounces."

			speechOutput = {
				speech: "<speak>" + speechText + "</speak>",
				type: AlexaSkill.speechOutputType.SSML
			};

		response.ask(speechOutput);
		return;
				
		}else if (isNumeric(intent.slots.size.value)){
			if (intent.slots.size.value >=1  && intent.slots.size.value <=4) {	//amount of food provided within range			
				ounces = Math.round(intent.slots.size.value);
				switch(ounces){
					case 1:
						amount = 2; //the number of seconds to run the servo
						break;
					case 2:
						amount = 4;
						break;
					case 3:
						amount = 6;
						break;
					case 4:
						amount = 8;
						break;
				}
			}
			else{ //amount of food not provided withing 1-4 ounce range
				speechText = "You didn't tell me a valid amount. Tell me either one, two, three, or four ounces."
				speechOutput = {
					speech: "<speak>" + speechText + "</speak>",
					type: AlexaSkill.speechOutputType.SSML
				};
				response.ask(speechOutput);
			}
		}
	}

	sessionAttributes.amount = amount;
	sessionAttributes.ounces = ounces;
		
	getLastFeeding(session.user.userId, function(lastfeeding){

		if (session.attributes.override === true){//override any additional prompts to the user. Typically if user looks a photo of cat bowl and wishes to feed cat less than 4 hours from last feeding
			lastfeeding = 10000;
		}

		if (lastfeeding < 240){ //last feeding was less than 4 hours; validate that the user wants to feed the pets; send a photo of the bowl
			topic = topic_id + '/photo' ;
			photo_name = uuid(); 
			payload = JSON.stringify({'photo': photo_name});	

			publishMessage(topic, payload, function (result){
				lastfeeding = Math.round(lastfeeding / 60); //convert to hours

				if (lastfeeding === 0){
					lastfeeding_str = "less than an hour"
				}else if (lastfeeding === 1){
					lastfeeding_str = "about an hour";
				}else{
					lastfeeding_str = lastfeeding.toString() + " hours";
				}

				sessionAttributes.override = true;
				session.attributes = sessionAttributes;

				var smImage = 'https://s3.amazonaws.com/catfeeder/Photos/' + photo_name + '.jpg';
				var lgImage = smImage;

				speechText = "It's been " + lastfeeding_str + " since I last fed the cat. I've just put a picture of your cat's food bowl in the Alexa App. " +
							"Are you sure you want me to give the cat food?" ;
				repromptText = "Do you want me to feed the cat?"

				speechOutput = {
					speech: "<speak>" + speechText + "</speak>",
					type: AlexaSkill.speechOutputType.SSML
				};

				repromptOutput = {
					speech: repromptText,
					type: AlexaSkill.speechOutputType.PLAIN_TEXT
				};

				var cardTitle = "Your Cat Bowl";
				var cardContent = "Here is an image of your cat bowl."

				response.askWithImageCard(speechOutput, repromptOutput, cardTitle, cardContent, smImage, lgImage);

			});

		}else{ //last feeding was more than 4 hours ago
			topic = topic_id + '/feed' ;
			payload = JSON.stringify({'amount': amount});	

			publishMessage(topic, payload, function (result){
				ounces_str = ounces.toString();

				updateLastFeeding(session.user.userId, function(results){

					getCatFeederStatusAPI(session.user.userId, function(value){

						var speechText_add = ""

						if (value === 0){
							speechText_add = " By the way, I believe you need more food in your feeder."
						}
						speechText = "O.K. I've dispensed " + ounces_str + " oz to the cat food bowl." + speechText_add;
						speechOutput = {
							speech: "<speak>" + speechText + "</speak>",
							type: AlexaSkill.speechOutputType.SSML
						};
						response.tell(speechOutput);
					});
				});
			});
		}
	});
}

//main call when the user first attempts to use the skill (if the user does not have a code)
function firstTimeConfig(intent, session, response){

	configureCatFeeder(session.user.userId, function(topic_id){

	speechText = "You haven't configured this skill to use your Raspberry Pi Catfeeder yet. " +
	"I've sent instructions to your Alexa App. Follow these steps and come back after you've finished your configuration."

	speechOutput = {
		speech: "<speak>" + speechText + "</speak>",
		type: AlexaSkill.speechOutputType.SSML
	};

	var cardTitle = "Configure Your CatFeeder";
			var cardContent = "Your topic id is '" + topic_id + "'. You will update your scripts using this code and the authentication files located here (https://s3.amazonaws.com/catfeeder/CatFeederAuth.zip). Please download the authentication files and "+
						" follow the instructions here: https://goo.gl/73uAW8\n" +
						" You can reset your configuration at any time by asking me to 'setup my feeder'.";
					
	response.tellWithCard(speechOutput, cardTitle, cardContent);
				
	});


}

//main call when the user asks to recieve a new code
function reConfigure(intent, session, response){

	configureCatFeeder(session.user.userId, function(topic_id){

		speechText = "O.K. I've sent instructions to your Alexa App. Follow these steps and come back after you've finished your configuration."

		speechOutput = {
			speech: "<speak>" + speechText + "</speak>",
			type: AlexaSkill.speechOutputType.SSML
		};
		var cardTitle = "Configure Your CatFeeder";
		var cardContent = "Your topic id is '" + topic_id + "'. You will update your scripts using this code and the authentication files located here (https://s3.amazonaws.com/catfeeder/CatFeederAuth.zip). Please download the authentication files and "+
						" follow the instructions here: https://goo.gl/73uAW8\n" +
						" You can reset your configuration at any time by asking me to 'setup my feeder'.";
					
		response.tellWithCard(speechOutput, cardTitle, cardContent);
	});

}

//main call when the user wishes to know if the pet has food in his dish
function getPicture(intent, session, response){
	sessionAttributes = {};
	topic = topic_id + '/photo';
			
	var speechText = "I've sent a photo to your Alexa App. Do you want me to feed the cat?"
	var repromptText = "Do you want me to feed the cat?"

	var speechOutput = {
		speech: "<speak>" + speechText + "</speak>",
		type: AlexaSkill.speechOutputType.SSML
	};

	var repromptOutput = {
		speech: repromptText,
		type: AlexaSkill.speechOutputType.PLAIN_TEXT
	};
			
	var cardTitle = "Your Cat Bowl";
	var cardContent = "Here is an image of your cat bowl.";

	var photo_name = uuid(); //get a unique name for the picture. Pass this name to camera so that the image is named the same before upload to s3
	var payload = JSON.stringify({'photo': photo_name});	

	var smImage = 'https://s3.amazonaws.com/catfeeder/Photos/' + photo_name + '.jpg';
	var lgImage = smImage;

	sessionAttributes.override = true; //set overide if the user wishes to feed to cat regardless of the time of the last feeding
	session.attributes = sessionAttributes;

	publishMessage(topic, payload, function (result){
		response.askWithImageCard(speechOutput, repromptOutput, cardTitle, cardContent, smImage, lgImage);
	});

}

//main call when the user wishes to know if the food hopper needs to be refilled
function getCatFeederStatus(intent, session, response){
	sessionAttributes = {};
	getCatFeederStatusAPI(session.user.userId, function(value){

		if (value === -2){
			speechText = "I can do a better job determining your feeder status if I know your zip code. Would you like to provide it?"

			speechOutput = {
				speech: "<speak>" + speechText + "</speak>",
				type: AlexaSkill.speechOutputType.SSML
			};
        
			sessionAttributes.intent_from = "zipcode";
			sessionAttributes.return_feeder_status = true;
			session.attributes = sessionAttributes;
			response.ask(speechOutput);
			return;

		}

		switch (value){//handle the users response based on the combination of the light sensor and the zip code (day or night)
			case -1:
				speechText = "I am unable to determine the amount of food in your feeder at this time. Please try again later."
				break; 
			case 0:
				speechText = "You are running low on food. You need to refill your feeder."
				break; 
			case 1:
				speechText = "At this time, you have adequate food in your feeder."
				break;
			default:
				speechText = "I think you have enough food in your feeder, but I'm not sure. I believe it is night time in your location. As a result, " +
							"I might be inaccurately measuring the amount of food you have in your feeder."
		}

		speechOutput = {
			speech: "<speak>" + speechText + "</speak>",
			type: AlexaSkill.speechOutputType.SSML
		};
        
		response.tell(speechOutput);
	});

}

//main call when the user wishes to know the last time Alexa attempted to feed the pet
function getLastFeedingTime(intent, session, response){
	sessionAttributes = {};
	sessionAttributes.override = true;
	session.attributes = sessionAttributes;

	getLastFeeding(session.user.userId, function(minutes_since_last_fed){

		console.log(minutes_since_last_fed);

		if (minutes_since_last_fed < 90 ){

			speechText = "It's been " + minutes_since_last_fed + " minutes since I last fed the cats."

			speechOutput = {
				speech: "<speak>" + speechText + "</speak>",
				type: AlexaSkill.speechOutputType.SSML
			};

			response.tell(speechOutput);
			return;

		}else if (minutes_since_last_fed < 1440 ){

			speechText = "It's been " + Math.round(minutes_since_last_fed/60) + " hours since I last fed the cats. Would you like me to feed your cat now?"
			speechOutput = {
				speech: "<speak>" + speechText + "</speak>",
				type: AlexaSkill.speechOutputType.SSML
			};
			response.ask(speechOutput);
			return;

		}else if (minutes_since_last_fed < 86400 ){

			speechText = "It's been " + Math.round(minutes_since_last_fed/60/24) + " days since I last fed the cats. Would you like me to feed your cat now?"
			speechOutput = {
				speech: "<speak>" + speechText + "</speak>",
				type: AlexaSkill.speechOutputType.SSML
			};
			response.ask(speechOutput);
			return;

		}else{

			speechText = "I don't think you've ever asked me to feed your cat. Would you like me to feed your cat now?"
			speechOutput = {
				speech: "<speak>" + speechText + "</speak>",
				type: AlexaSkill.speechOutputType.SSML
			};
			response.ask(speechOutput);
			return;

		}
	});
}

//main call when the user wishes to update his/her Zip Code
function updateZipCode(intent, session, response){

	if (session.attributes.intent_from === 'zipcode'){

		sessionAttributes.intent_from = "zipcode";

		if (typeof intent.slots.size.value === 'undefined'){

			speechText = "You didn't give me a valid zip code. Please try again."

			speechOutput = {
				speech: "<speak>" + speechText + "</speak>",
				type: AlexaSkill.speechOutputType.SSML
			};

			session.attributes = sessionAttributes;
			response.ask(speechOutput);
			return;
		}


		if (isNumeric(intent.slots.size.value)){

			saveZipCode(session.user.userId, intent.slots.size.value, function (ret_val){//handle response from weather api (to validate zip code)

				if (ret_val === "error1"){

					speechText = "I am unable to validate your zip code at this time. Please try again."
					speechOutput = {
						speech: "<speak>" + speechText + "</speak>",
						type: AlexaSkill.speechOutputType.SSML
					};

					session.attributes = sessionAttributes;
					response.ask(speechOutput);
					return;

				}else if (ret_val === "error2"){

					speechText = "That does not seem to be a valid zip code. Please try again."
					speechOutput = {
						speech: "<speak>" + speechText + "</speak>",
						type: AlexaSkill.speechOutputType.SSML
					};

					session.attributes = sessionAttributes;
					response.ask(speechOutput);
					return;
				} else {

					console.log ("am I here?");
					console.log ("retrn status:" + session.attributes.return_feeder_status);

					if (typeof session.attributes.return_feeder_status !== 'undefined'){
						console.log ("am I here too?")

						getCatFeederStatus(intent, session, response);
						return;

					}

					speechText = "Thank you for providing your zip code. This will help be better determine if you need to refill your feeder. You can change your zip code at anytime by saying 'change zip code'."

					speechOutput = {
						speech: "<speak>" + speechText + "</speak>",
						type: AlexaSkill.speechOutputType.SSML
					};

					response.tell(speechOutput);
					return;
				}
			});
			return;
		}else{

			sessionAttributes.intent_from = "zipcode";
			session.attributes = sessionAttributes;

			speechText = "You didn't give me a valid zip code. Please try again."

			speechOutput = {
				speech: "<speak>" + speechText + "</speak>",
				type: AlexaSkill.speechOutputType.SSML
			};

			response.ask(speechOutput);
			return;
		}
			
	}	

}



/**********************************************************************************
 *  INTERFACE WITH API/DBs/ETC
 *  This section interfaces with apis, DBs, etc, formats the APi call response 
 *  and returns the needed information to the main functions
 */

//DB call to update the topic (code) for a user
function configureCatFeeder(userID, eventCallback){

	var docClient = new AWS.DynamoDB.DocumentClient();
	var topic_id = uuid(); 

	params = {
		TableName:"Cat_Feeder_Config",
			Item:{
				"UserId": userID,
				"Topic_ID": topic_id,
				"Last_Feeding": 1,
			}
	};

	docClient.put(params, function(err, data) {

		if (err) {
			console.log(err);
			console.log(err.stack);
			eventCallback('error');
			return;
		} else{
			console.log(data);
			eventCallback(topic_id);
		}
	});

}

//DB call to get the topic (code) for a user
function getTopic(userID, eventCallback){

	var docClient = new AWS.DynamoDB.DocumentClient();
	var topic_id;
	
	var params = {
		TableName: "Cat_Feeder_Config",
		KeyConditionExpression: "UserId = :userID",
		ExpressionAttributeValues: {
			":userID": userID
		},
		ScanIndexForward: false
	};

	docClient.query(params, function(err, data) {
		if (err)
			console.log(JSON.stringify(err, null, 2));
		else
			var recordcount = data.Items.length;

			if (recordcount>0){
				data.Items.forEach(function(item) {
					topic_id = item.Topic_ID;

					if (typeof item.ZipCode !== 'undefined'){
						zipcode = item.ZipCode;
					}

				});				
			}else{
                topic_id = 'notset';
            }

			eventCallback(topic_id);
	});


}

//AWS IOT Call to publish a message on a provided topic
function publishMessage(topic, payload, eventCallback){

	var params = {
		topic: topic, /* required */
		//payload: new Buffer('...') || payload,
		payload: payload,
		qos: 1
	};
		iotdata.publish(params, function(err, data) {
		if (err) console.log(err, err.stack); // an error occurred
		else     console.log(data);  
		
		eventCallback(data);         
	});


}

//AWS IOT Call to get the device status for the cat feeder hopper (does it need to be refilled)
//This section also calls an weather API to determine if the location is day or night
function getCatFeederStatusAPI(userID, eventCallback){

	var params = {
		thingName: topic_id /* required */
	};

	iotdata.getThingShadow(params, function(err, body) {
		if (err) {
			console.log(err, err.stack); // an error occurred
			eventCallback(-1);
		}else{
			console.log("Zip Code: " + zipcode);
			console.log(body);
			payload = JSON.parse(body.payload);
			var property_value = payload.state.desired.property;
			console.log("Value:" + property_value);

			//check to see if light (0 = which means empty) or dark (1 = which means full) If full, confirm sunsure/sunset
			if (property_value === 0) {
				eventCallback(property_value);
			}else{ //call weather api

				if (zipcode !== 'notset'){

					request.get({
						url: "http://api.apixu.com/v1/current.json?key=<DEVELOPERKEY>&q=" + zipcode
						}, function(err, response, body) {

						if (body){
							try{
								body = JSON.parse(body);
							}catch(e){
								eventCallback(property_value);
								return;
							}
						}	

						if (typeof body.error !== 'undefined'){
							eventCallback(-1);
							return;

						}

						if (body.current.is_day === 0) { //then it is night time and maybe our sensor is off, so inform the user
							eventCallback(2)
						}
						eventCallback(property_value);

					}).on('err', function (e) {
						eventCallback(property_value);
					});
					
				}else{
					eventCallback(-2);
				}

			}
			
		}            
	});
}

//DB Call to update the last feeding time
function updateLastFeeding(userID, eventCallback){

	var date = new Date();
	var DateString = date.getFullYear() + "/" + monthNums[date.getMonth()] + "/" + date.getDate() + " " + date.getHours() + ":" + date.getMinutes();;
	var standardizeDate = new Date (date.getFullYear(), date.getMonth(), date.getDate());
	var getTime = date.getTime();
	
	
	var docClient = new AWS.DynamoDB.DocumentClient();

	var params = {
		TableName: "Cat_Feeder_Config",
		KeyConditionExpression: "UserId = :userID",
		ExpressionAttributeValues: {
			":userID": userID
		},
		ScanIndexForward: false
	};

	docClient.query(params, function(err, data) {
		if (err){
			console.log(JSON.stringify(err, null, 2));
		}else

			var recordcount = data.Items.length;

			if (recordcount<1){//no entry; need to add

				params = {
					TableName:"Cat_Feeder_Config",
					Item:{
						"UserId": userID,
						"Last_Feeding": getTime
					}
				};

				docClient.put(params, function(err, data) {

					if (err) {
						console.log(err);
						console.log(err.stack);
						return;
					} else{
						console.log(data);
						eventCallback('new entry');
					}
				});

			}else{//need to update the last feeding time

				params = {
					TableName: "Cat_Feeder_Config",
					Key:{
						"UserId": userID
					},
					UpdateExpression: 'SET Last_Feeding = :feedting_time',			
					ExpressionAttributeValues: { 
						":feedting_time": getTime
					},
					ReturnValues: "UPDATED_NEW"
					};

				docClient = new AWS.DynamoDB.DocumentClient();

				docClient.update(params, function(err, data) {
					if (err) console.log(err);
					else eventCallback(getTime);
				});



			}

	});
	
}

//DB Call to validate and save the users zip code
function saveZipCode(userID, ZipCode, eventCallback){

	request.get({
		url: "http://api.apixu.com/v1/current.json?key=<DEVELOPERKEY>&q=" + ZipCode
		}, function(err, response, body) {

			if (body){
				try{
					body = JSON.parse(body);
				}catch(e){
					eventCallback('error1');//there was an error calling the API
					return;
				}
			}	

			if (typeof body.error !== 'undefined') { //the provided zip is invalid

				eventCallback('error2');
				//return;
			}else{//the provided zip is OK

				var docClient = new AWS.DynamoDB.DocumentClient();

				params = {
					TableName: "Cat_Feeder_Config",
					Key:{
						"UserId": userID
					},
					UpdateExpression: 'SET ZipCode = :zip',			
						ExpressionAttributeValues: { 
							":zip": ZipCode
						},
						ReturnValues: "UPDATED_NEW"
				};

				docClient.update(params, function(err, data) {
					if (err) console.log(err);
					else eventCallback(ZipCode);
				});


			}

		}).on('err', function (e) {
			eventCallback(property_value);
	});


	
}

//DB Call to get the last time Alexa attempted to dispense food
function getLastFeeding(userID, eventCallback){


	var minutes = 1000 * 60;
	var hours = minutes * 60;
	var days = hours * 24;
	var years = days * 365;
	var d = new Date();
	var t = d.getTime();

	var current_minutes = Math.round(t / minutes);

    console.log("userid: " + userID)
	var last_feeding = 0;
	var docClient = new AWS.DynamoDB.DocumentClient();
	
	var params = {
		TableName: "Cat_Feeder_Config",
		KeyConditionExpression: "UserId = :userID",
		ExpressionAttributeValues: {
			":userID": userID
		},
		ScanIndexForward: false
	};

	docClient.query(params, function(err, data) {
		if (err)
			console.log(JSON.stringify(err, null, 2));
		else
			var recordcount = data.Items.length;

			if (recordcount>0){//get the minutes since the last feeding
				data.Items.forEach(function(item) {
					last_feeding = parseInt(item.Last_Feeding);
					last_feeding = Math.round(last_feeding / minutes);
					last_feeding = current_minutes - last_feeding;
				});				
			}else{//we've never fed the pet. provide an outrageously high number'
                last_feeding = 10000000;
            }

			eventCallback(last_feeding);
	});
	
	
}


/**********************************************************************************
 *  ADMINISTRATIVE & HELPER FUNCTIONS
 */

//Validates is a value is a number; used to validate slots
function isNumeric(n) {
  return !isNaN(parseFloat(n)) && isFinite(n);
}


// Create the handler that responds to the Alexa Request.
exports.handler = function (event, context) {
    // Create an instance of the HistoryBuff Skill.
    var skill = new CatFeeder();
    skill.execute(event, context);
};
