import sys
import cv2
import imutils
import smtplib
from datetime import datetime , timedelta

import securityDetails

# arg1 = Minimum Seconds of Continuous Motion
# arg2 = Total Motion Events Acceptable Before Alert
# arg3 = Minimum Time of Motion Before Alert
# arg3 = Cooloff Period Duration

class TenvisVideo():

	def __init__( self ):
		
		w_IP = securityDetails.w_R_IP
		w_Port = securityDetails.w_PORT
		w_UN = securityDetails.w_USER
		w_Pass = securityDetails.w_PASS

		self.feed_url = "http://" + w_IP + ":" + w_Port + "/vjpeg.v?user=" + w_UN + "&pwd=" + w_Pass
		print self.feed_url

		self.startMotionTime = None
		self.currentMotionTime = None
		self.cachedMotionEvent = None

		try:
			self.minMotionSeconds = int(sys.argv[1])
		except:
			self.minMotionSeconds = 5
		try:
			self.totalMotionAcceptable = int(sys.argv[2])
		except:
			self.totalMotionAcceptable = 1
		try:
			self.totalTimeAcceptable = int(sys.argv[3])
		except:
			self.totalTimeAcceptable = 5
		try:
			self.totalTimeAcceptableCoolOff = int(sys.argv[4])
		except:
			self.totalTimeAcceptableCoolOff = 30
		
		print "starting with " + str(self.minMotionSeconds) + " " + str(self.totalMotionAcceptable) + " " + str(self.totalTimeAcceptable) + " " + str(self.totalTimeAcceptableCoolOff)

		self.coolOffTime = 3
		self.elapsedTime = 0
		self.totalMotion = 0
				
		self.w_Capture = cv2.VideoCapture(self.feed_url)
		self.motionTracking()

	def sendEmail( self , alertLevel , msg ):

        	FROM = securityDetails.fromEmail 
        	TO = securityDetails.toEmail

	        message = """From: %s\nTo: %s\nSubject: %s\n\n%s """ % (FROM, ", ".join(TO) , alertLevel , msg )

        	try:
                	server = smtplib.SMTP( "smtp.gmail.com" , 587 )
                	server.ehlo()
                	server.starttls()
                	server.login( FROM , securityDetails.emailPass  )
                	server.sendmail( FROM , TO , msg )
                	server.close()
                	print('sent email')
        	except:
                	print('failed to send email')

	def cleanup(self):
		self.w_Capture.release()
		cv2.destroyAllWindows()

	def motionTracking( self ):

		avg = None
		firstFrame = None

		min_area = 500
		delta_thresh = 5

		motionCounter = 0
		min_motion_frames = 8

		while True:

			( grabbed , frame ) = self.w_Capture.read()
			text = "No Motion"

			if not grabbed:
				break

			frame = imutils.resize( frame , width = 500 )
			gray = cv2.cvtColor( frame , cv2.COLOR_BGR2GRAY )
			gray = cv2.GaussianBlur( gray , ( 21 , 21 ) , 0 )

			if firstFrame is None:
				firstFrame = gray
				continue

			if avg is None:
				avg = gray.copy().astype("float")
				continue

			cv2.accumulateWeighted( gray , avg , 0.5 )
			frameDelta = cv2.absdiff( gray , cv2.convertScaleAbs(avg) )

			thresh = cv2.threshold( frameDelta , delta_thresh , 255 , cv2.THRESH_BINARY )[1]
			thresh = cv2.dilate( thresh , None , iterations=2 )
			
			try:
				# New api call is different
				( image , cnts , _ ) = cv2.findContours( thresh.copy() , cv2.RETR_EXTERNAL , cv2.CHAIN_APPROX_SIMPLE )
			except:
				(cnts, _) = cv2.findContours( thresh.copy() , cv2.RETR_EXTERNAL , cv2.CHAIN_APPROX_SIMPLE )

			for c in cnts:

				if cv2.contourArea( c ) < min_area:
					continue

				text = "Motion"
				
				if self.startMotionTime is None:
					print "setting new motion record"
					self.startMotionTime = datetime.now()

			if text == "Motion":

				motionCounter += 1

				if motionCounter >= min_motion_frames:

					self.currentMotionTime = datetime.now()
					self.elapsedTime =  self.currentMotionTime - self.startMotionTime
					self.elapsedTime = int(self.elapsedTime.total_seconds())

					motionCounter = 0
					
			else:
				motionCounter = 0


			if self.elapsedTime >= self.coolOffTime:
				self.cachedMotionEvent = self.startMotionTime
				self.totalMotion = self.totalMotion + 1
				self.startMotionTime = None
				self.elapsedTime = 0

			if self.totalMotion >= self.totalMotionAcceptable:
				now = datetime.now()
				eT = now - self.cachedMotionEvent
				eS = int( eT.total_seconds() )
				if eS >= self.totalTimeAcceptable and eS <= self.totalTimeAcceptableCoolOff:
					#print eS
					#print "we need to alert"
					self.cachedMotionEvent = None
					self.totalMotion = 0
					self.sendEmail( self.totalMotion , "Haley is Moving" )
				elif eS >= self.totalTimeAcceptableCoolOff:
					print "event outside of cooldown window .... reseting .... " 
					self.cachedMotionEvent = None
					self.totalMotion = 0
			

			
			

		self.cleanup()





TenvisVideo()