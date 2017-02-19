var cp = require('child_process');
var exec = cp.exec;
var ps = require('ps-node');

// arg1 = Minimum Seconds of Continuous Motion
// arg2 = Total Motion Events Acceptable Before Alert
// arg3 = Minimum Time of Motion Before Alert
// arg3 = Cooloff Period Duration
var arg1 = 5
var arg2 = 1
var arg3 = 5
var arg4 = 20
var lCode2 = "python /home/morpheous/WORKSPACE/NODE/TenvisMotionNotifications/tenvisController.py";

var childPIDLookup = function() {

	ps.lookup(
		{
			command: 'python',

		},
		function( err , resultList ) {

			if (err) { throw new Error( err ); }

			var wResult = null;
		    resultList.forEach(function( process ){
		        if( process ){
		        	process.arguments.forEach(function(item){
		        		if ( item === "/home/morpheous/WORKSPACE/NODE/TenvisMotionNotifications/tenvisController.py" ) {
		            		wResult = process.pid;
		            		wChild.pid = wResult;
		            		console.log(wChild.pid);
		            	}
		        	});
		        }
		    });


		}
	);

};

var wState = false;
var wChild = null;
var startPYProcess = function() {
	wChild = exec( lCode2 , [ arg1 , arg2 , arg3 , arg4 ] );

	wChild.pid = childPIDLookup();
	
	wState = true;
	wChild.on( 'error' , function(code) {
		console.log(code);
	});
	wChild.on( 'exit' , function(code) {
		console.log(code);
	});

};

var restartPYProcess = function() {
	console.log("restarting")
	wChild.kill();
	process.kill(wChild.pid)
	wState = false;
	startPYProcess();
};

var express = require('express');
var bodyParser = require('body-parser');
var cors = require('cors');
var path = require('path');
var wPORT = 3000;
var app = express();
app.use(express.static( path.join(__dirname, '')));
app.use(cors({origin: 'http://localhost:' + wPORT.toString()}));
app.use(bodyParser.json());
app.use(bodyParser.urlencoded({
  extended: true
}));

app.get( '/' , function( req , res ) {
	res.sendFile('index.html');
});

app.get( '/state' , function( req , res ) {
	if (wState) { res.json( { "state" : "on" , "arg1": arg1 , "arg2": arg2 , "arg3": arg3, "arg4": arg4 }); }
	else { res.json( { "state" : "off" , "arg1": arg1 , "arg2": arg2 , "arg3": arg3, "arg4": arg4 }); }
});

app.get( '/restart' , function( req , res ) {
	restartPYProcess();
	res.json( { "state" : "on" });
});

app.get( '/turnon' , function( req , res ) {
	if ( wState ) {
		console.log("restarting")
		wChild.kill();
		process.kill(wChild.pid)
		wState = false;
		startPYProcess();
	}
	else {
		startPYProcess();
	}
	res.json( { "state" : "on" });
});

app.get( '/turnoff' , function( req , res ) {
	wChild.kill();
	process.kill( wChild.pid );
	wState = false;
	res.json( { "state" : "off" });
});

app.get( '/turnoff' , function( req , res ) {
	wChild.kill();
	process.kill( wChild.pid );
	wState = false;
	res.json( { "state" : "off" });
});

app.get( '/turnoff' , function( req , res ) {
	wChild.kill();
	process.kill( wChild.pid );
	wState = false;
	res.json( { "state" : "off" });
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
		"arg1" : arg1,
		"arg2" : arg2,
		"arg3" : arg3,
		"arg4" : arg4 
	});
});


var gracefulExit = function() {
	if ( wState ) {
		console.log("closing pyscript");
		process.kill( wChild.pid );
		wChild.kill();
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

app.listen( 3000 , function() {
	console.log("listening on localhost:3000");
});
