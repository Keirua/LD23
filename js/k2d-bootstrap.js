///////////////////////////////////////////////////////////////////////////////
// K2D-Bootstrap.js: Small bootstrapping library for javascript game development
// Only features basic fonctionnalities :
//  - A game structure
//  - A ressource cache for images -> loading screen
//  - Small management of effects (example is shown with fade-in/fade-out)
//  - Sprite animations
//  - Easy keyboard/mouse management
//  - Viewport. Well, sort of
//  - Easy drawing/writing with the screen class
//  - A Timer class for dealing with time management
///////////////////////////////////////////////////////////////////////////////

///////////////////////////////////////////////////////////////////////////////
// Keyboard constants
///////////////////////////////////////////////////////////////////////////////
const KB_UP = 38;
const KB_DOWN = 40;
const KB_LEFT = 37;
const KB_RIGHT = 39;
const KB_ESCAPE = 27;
const KB_ENTER = 13;

///////////////////////////////////////////////////////////////////////////////
// A bunch of drawing utilities. See usage
// Yep, its not pretty clean.
///////////////////////////////////////////////////////////////////////////////
Screen = function (engine){
	this.context = engine.context;
}

Screen.prototype.drawRect = function (px, py, sizex, sizey, col){
	this.context.fillStyle = col;
	this.context.beginPath();
	this.context.rect(px, py, sizex, sizey);
	this.context.closePath();
	this.context.fill();
}

Screen.prototype.drawText = function (text, x, y, color, font){
	this.context.fillStyle = color;
	this.context.font = font;
	this.context.textAlign = "left";
	this.context.fillText(text, x, y);
}

// Draw a centered text around the x position
Screen.prototype.drawCenterText = function (text, x, y, color, font){
	this.context.fillStyle = color;
	this.context.font = font;
	this.context.textAlign = "center";
	this.context.textBaseline = "top";
	this.context.fillText(text, x, y);
}

Screen.prototype.clear = function(color){
	this.drawRect(0,0, GAME_WIDTH, GAME_HEIGHT, color);
}

///////////////////////////////////////////////////////////////////////////////
// Datacache: Basic management of a resource cache.
// Allow the loading of ressources during a loading screen, where
// a progress bar can be displayed
///////////////////////////////////////////////////////////////////////////////
DataCache = function ()
{
	this.queue = [];
	this.nbDone = 0;
	this.imageCache = {};
	// this.that = this;
}

DataCache.prototype.done = function (){
	return this.nbDone == this.queue.length;
};

// Computes the percentage of what has been downloaded
DataCache.prototype.Percentage = function (){
	var res = 1.0;
	if (this.queue.length != 0)
		res = this.nbDone/this.queue.length;
		
	return res; 
}

DataCache.prototype.getImage = function(img){
	return this.imageCache[img];
}

DataCache.prototype.load = function (){
	for (i = 0; i < this.queue.length; i++)
	{
		var src = "images/" + this.queue[i] + ".png";
		var img = new Image ();
		img.src = src;
		var that = this;
		img.addEventListener("load", function() {
			that.nbDone += 1;
		}, false);
		this.imageCache[this.queue[i]] = img;
	}
}


///////////////////////////////////////////////////////////////////////////////
// SpriteSheet: handles sprite animations
///////////////////////////////////////////////////////////////////////////////
var SpriteSheet = function (nbStates, nbImagesPerAnimation, stepDuration, textureName){
	this.nbStates = nbStates;
	this.nbImages = nbImagesPerAnimation;
	this.stepDuration = stepDuration;
	this.textureName = textureName;
	
	this.loopAnimation = true; // Dit s'il faut recommencer l'animtion une fois terminé ou non
	
	this.currState = 0;
	this.currAnimation = 0;
	
	this.IsAnimated = true;
	this.TimerStart = Date.now();
}

SpriteSheet.prototype.Draw  = function(datacache, viewport, x, y){
	var image = datacache.getImage(this.textureName);
	var sizeX = image.width/this.nbImages;
	var sizeY = image.height/this.nbStates;

	// 1st parameter : the image to display
	// the next 2 : position in the image to start displaying from
	// the next 2 : number of pixels to display
	// the next 2 : position where to draw in the canvas
	// the last 2 : size of the image in the canvas
	viewport.context.drawImage(image, this.currAnimation*sizeX, this.currState*sizeY, sizeX, sizeY, x-viewport.x, y-viewport.y, sizeX, sizeY);
}

SpriteSheet.prototype.SetAnimated = function(b){
	if (this.IsAnimated && b){
		// Rien a faire 
	}
	else if (b){
		this.IsAnimated = true;
		this.TimerStart = Date.now();
	}
	else
	{
		this.IsAnimated = false;
	}
}

SpriteSheet.prototype.SetAnimation = function(a){
	this.currAnimation = a;
}

SpriteSheet.prototype.SetState = function(s){
	this.currState = s;
}

SpriteSheet.prototype.Animate = function(){
	duration = Date.now() - this.TimerStart;
	if (this.IsAnimated)
	{
		var idx = Math.floor(duration / this.stepDuration) % this.nbImages;
		if (idx > this.nbImages){
			idx = idx % this.nbImages;
		}
		this.currAnimation = idx;
	}
}

///////////////////////////////////////////////////////////////////////////////
// FadeEffect: handles how to display and animate fade-in and fade-out effects
///////////////////////////////////////////////////////////////////////////////
var FadeEffect = function (color, duration, fadeIn){
	this.color = color;
	this.duration = duration;
	this.elapsed = 0;
	this.fadeIn = fadeIn;
	
	this.done = false;
	
	this.Update = function (dt){
		this.elapsed += dt;
		if (this.elapsed > this.duration){
			this.done = true;
		}
	}
	
	this.Draw = function (ctx){
		ctx.fillStyle= this.color;
		if (this.fadeIn)
			ctx.globalAlpha=this.elapsed/this.duration;
		else
			ctx.globalAlpha=1-this.elapsed/this.duration;
		ctx.fillRect(0,0,GAME_WIDTH,GAME_HEIGHT);
		ctx.globalAlpha=1;
	}
}

///////////////////////////////////////////////////////////////////////////////
// Viewport management class
///////////////////////////////////////////////////////////////////////////////
Viewport = function(engine){
	this.context = engine.context;
}

Viewport.prototype = {
	x : 0, 
	y : 0
}

Viewport.prototype.DrawSprite = function (name, x, y, w, h)
{
	this.context.drawImage(g_DataCache.getImage(name), x - this.x, y-this.y, w, h);
}

///////////////////////////////////////////////////////////////////////////////
// Timer class
///////////////////////////////////////////////////////////////////////////////
Timer = function(){
}

Timer.prototype = {
	t0 : 0,
	tf : 0
}

Timer.prototype.Start = function ()
{
	this.t0 = Date.now();
}

// Returns the elapsed's duration (in ms) since last "Start"'s call
Timer.prototype.Elapsed = function ()
{
	var now = Date.now();
	var dt = (now-this.t0);
	return dt;
}

// Returns true if the duration (in ms) is elapsed since last "Start"'s call
Timer.prototype.IsElapsed = function (duration)
{
	var dt = this.Elapsed();
	return (duration < dt);
}

// Converts the elapsed duration in a string
Timer.prototype.ChronoString = function ()
{
	var tot_s = (this.Elapsed()*0.001); // Converts in seconds
	var nb_min = tot_s > 59 ? Math.floor(tot_s/60) : 0;
	var str_minutes = nb_min < 10 ? "0" + nb_min : nb_min;
	var nb_s = ((tot_s)%60);
	return str_minutes + ":" + nb_s.toFixed(2); // 2 digits for the milliseconds
}



///////////////////////////////////////////////////////////////////////////////
// Engine class, the entry point of the application
///////////////////////////////////////////////////////////////////////////////
K2DEngine = function(params){
	this.currState = "loading";
	
	this.datacache = params.datacache || {};	
	this.states = params.states || {};
	this.width = params.width || 320;		// todo: replace with default value
	this.height = params.height || 200;		// todo: replace with default value
	this.stateAfterLoading = params.stateAfterLoading ||  "menu"
	that = this;
	
	this.canvas = document.createElement("canvas");
	this.context = this.canvas.getContext("2d");
	
	this.screen = new Screen (this);
}

K2DEngine.prototype = {
	currState : "loading",
	stateAfterLoading : "",
	dataCache: {},
	keysDown: {},
	effects : [],
	canvas : {},
	context : {},
}

K2DEngine.prototype.AddState = function (name, state){
	this.states[name] = state;
}

K2DEngine.prototype.ChangeState = function (state){
	this.currState = state;
}

K2DEngine.prototype.Init = function (options){
	// Creates the drawing area
	this.canvas.width = this.width; 
	this.canvas.height = this.height;

	document.body.appendChild(this.canvas);
	
	addEventListener("keydown", function (e) {
		that.keysDown[e.keyCode] = true;
	}, false);

	addEventListener("keyup", function (e) {
		delete that.keysDown[e.keyCode];
	}, false);
	
	window.onkeydown = that.KeyPress;
	
	// Initializes the game
	prevDate = Date.now();
	gameState.Reset();
	
	this.datacache.load();
	
	setInterval(this.GameLoop, 1);
}

K2DEngine.prototype.Update = function (modifier){
	if (this.currState == "loading")
	{
		if (this.datacache.done() == true)
			this.currState = this.stateAfterLoading;
	}
	else
		this.states[this.currState].Update(modifier);
		
	this.UpdateEffects(modifier);
}

// Drawing method. 
K2DEngine.prototype.Draw = function(){
	if (this.currState == "loading")
		that.RenderLoadingScreen();
	else
		this.states[this.currState].Draw();
	
	// Display the effects ()
	for (i = 0; i < that.effects.length; i++){
		that.effects[i].Draw (that.context);
	}
}
	
// The main game loop
K2DEngine.prototype.GameLoop = function () {
	var now = Date.now();
	var delta = now - prevDate;

	that.screen.clear("rgb(0,0,0)");
	that.Update(delta / 1000);
	that.Draw();

	prevDate = now;
};

// Handles the keypress events, and delegates to the current state (if necessary)
K2DEngine.prototype.KeyPress = function (event) {
	// If the current states implements a method "HandleEvent", we call this method
	if (that.currState != "loading"){
		var st = that.states[that.currState];
		if (st.HandleEvent)
		{
			st.HandleEvent(event);
		}
	}
}

K2DEngine.prototype.UpdateEffects = function(dt){
	for (i = 0; i < this.effects.length; i++){
		this.effects[i].Update(dt);
		if (this.effects[i].done){
			this.effects.splice (i,1);
		}
	}
}


K2DEngine.prototype.RenderLoadingScreen = function(){
	that.screen.drawRect (0,0, GAME_WIDTH, GAME_HEIGHT, "#d0e7f9");
	that.screen.drawCenterText ("" + that.datacache.Percentage()*100 + " %", GAME_WIDTH/2, GAME_HEIGHT/2, "red", "30pt Calibri");
}
