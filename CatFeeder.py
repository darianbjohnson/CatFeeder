#!/usr/bin/python
# Writen by Darian Johnson
# This python code runs on the raspberry pi and takes photos and controls the servo that dispenses food
# This project is part of the Automated Cat Feeder project


import paho.mqtt.client as paho
import os
import socket
import ssl
import uuid
import json
import time
import os
import tinys3

#update this topic with the code you received in the alexa app
topic = 'UPDATE WITH CODE PROVIDED IN ALEXA APP'

#initialize servo & pwm commands
os.system("gpio -g mode 18 pwm")
os.system("gpio pwm-ms")
os.system("gpio pwmc 192")
os.system("gpio pwmr 2000")

def on_connect(client, userdata, flags, rc):
    print("Connection returned result: " + str(rc) )
    # Subscribing in on_connect() means that if we lose the connection and
    # reconnect then subscriptions will be renewed.
    #client.subscribe("#" , 1 )
    client.subscribe(topic + "/#",1)

def on_message(client, userdata, msg):
    print("payload: " + msg.payload)
    parsed_json = json.loads(msg.payload)
    
    #Logic to take the photo
    if msg.topic ==topic + "/feed":
        try:
            runtime = parsed_json["amount"]
            t_end = time.time() + runtime

            while time.time() < t_end:
                os_string = "gpio -g pwm 18 200"
                os.system(os_string)
	        
            print("done spinning")
            os_string = "gpio -g pwm 18 150"
            os.system(os_string)

            
        except:
            print('did not publish')
    elif msg.topic == topic + "/photo": #logic to take the photo
        try:
            photo_name = parsed_json["photo"]
            #delete old photos
            os.system("rm Photos/*.jpg")
            
            #take a photo using the name passed to us from mqtt message
            photo  = "Photos/" + photo_name + ".jpg"
            os_string = "fswebcam --no-banner " + photo
            os.system(os_string)
            
            #use tinyS3 to upload the photo to AWS S3
            #Update the secret and access key with the keys you downloaded in the instructions zip
            S3_SECRET_KEY = 'UPDATE WITH KEY ID IN KEYS.TEXT FILE' 
            S3_ACCESS_KEY = 'UPDATE WITH ACCES KEY IN KEYS.TEXT FILE' 
            
            conn = tinys3.Connection(S3_ACCESS_KEY,S3_SECRET_KEY,tls=True)
            f = open(photo,'rb')
            conn.upload(photo,f,'catfeeder')
            
        except:
            print('did not publish')
            


mqttc = paho.Client()
mqttc.on_connect = on_connect
mqttc.on_message = on_message
#mqttc.on_log = on_log

#variables to connect to AWS IoT
#Note these certs allow access to send IoT messages
awshost = "data.iot.us-east-1.amazonaws.com"
awsport = 8883
clientId = "MyCatFeeder-" + str(uuid.uuid4())
thingName = "MyCatFeeder"
caPath = "/home/pi/certs/verisign-cert.pem"
certPath = "/home/pi/certs/CatFeeder.cert.pem"
keyPath = "/home/pi/certs/CatFeeder.private.key"

mqttc.tls_set(caPath, certfile=certPath, keyfile=keyPath, cert_reqs=ssl.CERT_REQUIRED, tls_version=ssl.PROTOCOL_TLSv1_2, ciphers=None)

mqttc.connect(awshost, awsport, keepalive=60)

mqttc.loop_forever() 


    
