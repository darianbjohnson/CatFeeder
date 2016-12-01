#!/usr/bin/python
# Writen by Darian Johnson, leveraging example code provided by Amazon

# This python code udpdate the device state for our light sensor
# this code is part of the Automated Cat Feeder Project

from AWSIoTPythonSDK.MQTTLib import AWSIoTMQTTShadowClient
from gpiozero import LightSensor

import sched
import sys
import logging
import time
import json
import getopt

#update this topic with the code you received in the alexa app
topic = '6e147add-791e-42a1-85f2-17b89fbccfcc'

s = sched.scheduler(time.time, time.sleep)
ldr = LightSensor(4)  # alter if using a different pin
time_delay_in_secs = 30 # seconds between updating thingshadow
light_threshold = 0.7 # 0 = light, .99 = dark; use this to determine light versus dark. Anything less than the threshold means that there is no food (e.g - light is visible)

# Shadow JSON schema:
#
# Name: <Topic>
# {
#	"state": {
#		"desired":{
#			"property":<INT VALUE>
#		}
#	}
#}

# Custom Shadow callback
def customShadowCallback_Update(payload, responseStatus, token):
	# payload is a JSON string ready to be parsed using json.loads(...)
	# in both Py2.x and Py3.x
	if responseStatus == "timeout":
		print("Update request " + token + " time out!")
	if responseStatus == "accepted":
		payloadDict = json.loads(payload)
		print("~~~~~~~~~~~~~~~~~~~~~~~")
		print("Update request with token: " + token + " accepted!")
		print("property: " + str(payloadDict["state"]["desired"]["property"]))
		print("~~~~~~~~~~~~~~~~~~~~~~~\n\n")
	if responseStatus == "rejected":
		print("Update request " + token + " rejected!")

def customShadowCallback_Delete(payload, responseStatus, token):
	if responseStatus == "timeout":
		print("Delete request " + token + " time out!")
	if responseStatus == "accepted":
		print("~~~~~~~~~~~~~~~~~~~~~~~")
		print("Delete request with token: " + token + " accepted!")
		print("~~~~~~~~~~~~~~~~~~~~~~~\n\n")
	if responseStatus == "rejected":
		print("Delete request " + token + " rejected!")


# Parameters
host = "data.iot.us-east-1.amazonaws.com"
rootCAPath = "/home/pi/certs/verisign-cert.pem"
certificatePath = "/home/pi/certs/CatFeeder.cert.pem"
privateKeyPath = "/home/pi/certs/CatFeeder.private.key"


# Configure logging
logger = logging.getLogger("AWSIoTPythonSDK.core")
logger.setLevel(logging.ERROR)
streamHandler = logging.StreamHandler()
formatter = logging.Formatter('%(asctime)s - %(name)s - %(levelname)s - %(message)s')
streamHandler.setFormatter(formatter)
logger.addHandler(streamHandler)

# Init AWSIoTMQTTShadowClient
myAWSIoTMQTTShadowClient = AWSIoTMQTTShadowClient("basicShadowUpdater")
myAWSIoTMQTTShadowClient.configureEndpoint(host, 8883)
myAWSIoTMQTTShadowClient.configureCredentials(rootCAPath, privateKeyPath, certificatePath)

# AWSIoTMQTTShadowClient configuration
myAWSIoTMQTTShadowClient.configureAutoReconnectBackoffTime(1, 32, 20)
myAWSIoTMQTTShadowClient.configureConnectDisconnectTimeout(10)  # 10 sec
myAWSIoTMQTTShadowClient.configureMQTTOperationTimeout(5)  # 5 sec

# Connect to AWS IoT
myAWSIoTMQTTShadowClient.connect()

# Create a deviceShadow with persistent subscription
Bot = myAWSIoTMQTTShadowClient.createShadowHandlerWithName(topic, True)

# Delete shadow JSON doc
Bot.shadowDelete(customShadowCallback_Delete, 5)

# Update shadow in a loop

def do_something(sc):
    print(ldr.value)
    if ldr.value < light_threshold:
        print('light')
        state = '0'
    else:
        print('dark')
        state = '1'
    #JSONPayload = '{"state":{"desired":{"property":' + '1' + '}}}'
    JSONPayload = '{"state":{"desired":{"property":' +  state + '}}}'
    Bot.shadowUpdate(JSONPayload, customShadowCallback_Update, 5)
    # do your stuff
    s.enter(time_delay_in_secs, 1, do_something, (sc,))

s.enter(time_delay_in_secs, 1, do_something, (s,))
s.run()
   