var spawn = require('child_process').spawn;
var ps = require('ps-node');
var schedule = require('node-schedule');
var path = require('path');

var arg1 = 5 	// = Minimum Seconds of Continuous Motion
var arg2 = 1 	// = Total Motion Events Acceptable Before Alert
var arg3 = 5 	// = Minimum Time of Motion Before Alert
var arg4 = 20 	// = Cooloff Period Duration
var lCode1 = path.join( __dirname , 'tenvisController.py' );
var wState = false;
var wChild = null;
var wPIDResultSet = [];

var startTime = new schedule.RecurrenceRule();
startTime.dayOfWeek = [ new schedule.Range( 0 , 6 ) ];
startTime.hour = 23;
startTime.minute = 00;
var stopTime = new schedule.RecurrenceRule();
stopTime.dayOfWeek = [ new schedule.Range( 0 , 6 ) ];
stopTime.hour = 7;
stopTime.minute = 30;

var startEvent = null;
var stopEvent = null;


var childPIDLookup = function() {

	ps.lookup({ command: 'python' },
		function( err , resultList ) {
			if (err) { throw new Error( err ); }
			resultList.forEach(function( process ){
		        	if( process ){
		        		process.arguments.forEach(function(item){
		        			if ( item === lCode1 ) {
							wPIDResultSet.push(process.pid);
		            				console.log( "python PID = " + process.pid.toString() );
		            			}
		        		});
		        	}
		    	});
		}
	);

};

var startPYProcess = function() {
	
	wChild = spawn( 'python' , [ lCode1 , arg1 , arg2 , arg3 , arg4 ] );
	console.log("launched pyscript");
	childPIDLookup();
	
	wState = true;
	wChild.on( 'error' , function(code) {
		console.log(code);
	});
	wChild.on( 'exit' , function(code) {
		console.log(code);
	});

};

var killAllPYProcess = function() {
	wPIDResultSet.forEach(function( item , index ) {
		try {
			ps.kill( item , function(err){
				if (err) { console.log(err); }
				else { 
					wState = false;
					console.log("killed PID: " + item.toString() );
					wPIDResultSet.splice( index , 1 );
				}
			});
		}
		catch(err){
			console.log(err);
		}
		
	});
};

var restartPYProcess = function() {
	console.log("restarting")
	killAllPYProcess();
	wState = false;
	setTimeout(function(){
		startPYProcess();
	}, 5000 );
};


var express = require('express');
var bodyParser = require('body-parser');
var cors = require('cors');
var wPORT = 8080;
var app = express();
app.use(express.static( path.join(__dirname, '')));
app.use(cors({origin: 'http://localhost:' + wPORT.toString()}));
app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: true }));

app.get( '/' , function( req , res ) {
	res.sendFile('index.html');
});

app.get( '/state' , function( req , res ) {
	res.json({ 
		"state" : wState , "arg1": arg1 , "arg2": arg2 , "arg3": arg3, "arg4": arg4, 
		"sHour" : startTime.hour, "sMinute": startTime.minute, "eHour" : stopTime.hour, "eMinute": stopTime.minute
	});
});

app.get( '/restart' , function( req , res ) {
	restartPYProcess();
	res.json( { "state" : wState });
});

app.get( '/turnon' , function( req , res ) {
	if ( wState ) {
		console.log("restarting")
		restartPYProcess();
	}
	else {
		startPYProcess();
	}
	res.json( { "state" : wState });
});

app.get( '/turnoff' , function( req , res ) {
	killAllPYProcess();
	wState = false;
	res.json( { "state" : wState });
});

app.post( '/setargs/' , function( req , res ) {
	if (req.body.arg1.length >= 1) { arg1 = req.body.arg1; }
	if (req.body.arg2.length >= 1) { arg2 = req.body.arg2; }
	if (req.body.arg3.length >= 1) { arg3 = req.body.arg3; }
	if (req.body.arg4.length >= 1) { arg4 = req.body.arg4; }
	console.log( "new args = " + arg1 + " " + arg2 + " " + arg3 + " " + arg4  );
	if (wState) {
		restartPYProcess();
	}
	res.json({
		"state" : wState,
		"arg1" : arg1,
		"arg2" : arg2,
		"arg3" : arg3,
		"arg4" : arg4 
	});
});

/*
app.post( '/settime/' , function( req , res ) {
	if (req.body.sHour.length >= 1) { startTime.hour = req.body.sHour; }
	if (req.body.sMinute.length >= 1) { startTime.minute = req.body.sMinute; }
	if (req.body.eHour.length >= 1) { stopTime.hour = req.body.sHour; }
	if (req.body.eMinute.length >= 1) { stopTime.minute = req.body.sMinute; }
	console.log( "new times: START= " + startTime.hour + ":" + startTime.minute + " STOP= " + stopTime.hour + ":" + stopTime.minute  );
	res.json({
		"sHour" : startTime.hour,
		"sMinute": startTime.minute,
		"eHour" : stopTime.hour,
		"eMinute": stopTime.minute
	});
	setStartTimeEvent();
	setStopTimeEvent();
});
*/


var gracefulExit = function() {
	if ( wState ) {
		console.log("closing pyscript");
		killAllPYProcess();
		console.log("pyscript closed");
	}
	console.log("exiting");
	process.exit();
};


process.on( 'SIGINT' , function() {
	gracefulExit();
});
process.on( 'SIGTERM' , function() {
	gracefulExit();
});


startEvent = schedule.scheduleJob( startTime , function(){
	console.log('scheduled start');
	if ( !wState ) { startPYProcess(); } 
	else { restartPYProcess(); }
});

stopEvent = schedule.scheduleJob( stopTime , function(){
	console.log('scheduled stop');
	killAllPYProcess();
});


app.listen( wPORT , function() {
	console.log("listening on localhost:" + wPORT.toString() );
});
