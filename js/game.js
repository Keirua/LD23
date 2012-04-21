// Heavily based on http://www.lostdecadegames.com/how-to-make-a-simple-html5-canvas-game/
var GAME_WIDTH = 600;
var GAME_HEIGHT = 480;

// var WORLD_WIDTH = 4000;
// var WORLD_HEIGHT = 4000;

var WORLD_WIDTH = GAME_WIDTH;
var WORLD_HEIGHT = GAME_HEIGHT;

//Create a sound 
// /!\ Does not work in firefox
var bullet_sound = new Audio("sound/bullet.mp3");

g_DataCache = new DataCache();

var objToLoad = [
	"monster",
	"hero",
	// "background",
	"tree"
];

g_DataCache.queue = objToLoad;

// Handles the mouse events
document.onmousemove = function (event){
}

///////////////////////////////////////////////////////////////////////////////
// Game state
///////////////////////////////////////////////////////////////////////////////
GameState = function(){
	this.viewport = new Viewport(gameEngine);
	this.context = gameEngine.context;
	this.runTimer = new Timer();
	this.waitTimer = new Timer();
	this.obstacles = {};
}

GameState.prototype = {
	hero : {
		defaultSpeed: 128,
		speed: 128, // movement in pixels per second
		run: true,
		isRunning:false,
		canRun: true
	},
	scrollingRatio:0.3,
	monster : {},
	monstersCaught : 0,
	runDuration: 2000, // How long one can run
	runWaitingTime: 2000, // when you are done running, how long you have to wait before being able to run again
	viewport:{},
	obstacles:{}, // stuff blocking the payer
	nbObstacles:6,
	target:{}		// where the player is supposed to go to
}

var rnd = function (mini, maxi){
	return mini + Math.floor(Math.random()*(maxi-mini));
}

// We want a spritesheet with 4 states, each state containing 8 images.
var heroSprite = new SpriteSheet(4,8, 200, "hero");

GameState.prototype.HandleEvent = function(event){
	if (event.keyCode == KB_SPACE) {	// Pressing "enter"
		if (this.hero.canRun){
			this.hero.isRunning = true;
			this.hero.canRun = false; // boolean saying 
			this.runTimer.Start();
		}
	}
}

GameState.prototype.Update = function (modifier) {
	var animate = false;
	// Running management
	if (this.hero.isRunning == true){
		this.hero.speed = this.hero.defaultSpeed * 2;
		if (this.runTimer.Elapsed () > this.runDuration){
			this.hero.isRunning = false;
			this.waitTimer.Start();
		}
	}
	else{
		this.hero.speed = this.hero.defaultSpeed;
		if (this.hero.canRun == false){
			if(this.waitTimer.Elapsed () > this.runWaitingTime){
				this.hero.canRun = true;
			}
		}
	}
	var newpos = {
		x:this.hero.x,
		y:this.hero.y
	};
	if (KB_UP in gameEngine.keysDown) {
		newpos.y -=  this.hero.speed * modifier;
		heroSprite.SetState (1);
		animate = true;
	}
	if (KB_DOWN in gameEngine.keysDown) {
		newpos.y +=  this.hero.speed * modifier;
		heroSprite.SetState (0);
		animate = true;
	}
	if (KB_LEFT in gameEngine.keysDown) {
		newpos.x -= this.hero.speed * modifier;
		heroSprite.SetState (2);
		animate = true;
	}
	if (KB_RIGHT in gameEngine.keysDown) {
		newpos.x += this.hero.speed * modifier;
		heroSprite.SetState (3);
		animate = true;
	}
	if (this.collideWorld ({x:this.hero.x, y:newpos.y, w: 32, h: 32}) == false)
	{
				this.hero.y = newpos.y;
	}
	if (this.collideWorld ({x:newpos.x, y:this.hero.y, w: 32, h: 32}) == false)
	{
		this.hero.x = newpos.x;
	}
	
	if (KB_ESCAPE in gameEngine.keysDown) {
		gameEngine.ChangeState("menu");
	}
	
	// Very basic viewport management: when we get closer to the edge, move the viewport
	if (this.hero.x +32 < this.viewport.x + (GAME_WIDTH * this.scrollingRatio))
		this.viewport.x -= this.hero.speed * modifier;
	if (this.hero.x > (this.viewport.x + GAME_WIDTH) - (GAME_WIDTH * this.scrollingRatio))
		this.viewport.x += this.hero.speed * modifier;
	if (this.hero.y +32 < this.viewport.y + (GAME_HEIGHT * this.scrollingRatio))
		this.viewport.y -= this.hero.speed * modifier;
	if (this.hero.y> (this.viewport.y + GAME_HEIGHT) - (GAME_HEIGHT * this.scrollingRatio))
		this.viewport.y += this.hero.speed * modifier;
	
	heroSprite.SetAnimated(animate);
	heroSprite.Animate();
	// Are they touching?
	if (
		this.hero.x <= (this.target.x + 32)
		&& this.target.x <= (this.hero.x + 32)
		&& this.hero.y <= (this.target.y + 32)
		&& this.target.y <= (this.hero.y + 32)
	) {
		this.Reset();
		++this.monstersCaught;
		bullet_sound.play();
		gameEngine.effects.push ( new FadeEffect ("rgb(255, 255, 255)", 0.3, false) );
	}
};

GameState.prototype.collideWorld = function (player){
	var isColliding = false;
	var ratio = 0.2; // We want 20% off
	var ow, oh, dw, dh
	for (var key in this.obstacles){
		var currObstacle = this.obstacles[key];
		ow = currObstacle.w; // obstacle width
		oh = currObstacle.h;
		dw = ratio * ow;
		dh = ratio * oh;
		
		if (intersects (player, {x: currObstacle.x + dw, y: currObstacle.y + dh, w:(1-2*ratio)*ow, h:(1-2*ratio)*oh}))
		{
			isColliding = true;
		}
	}

	return isColliding;
}

var intersects = function (a,b){
	var res = false;

	if (a.x + a.w > b.x
		&& a.x <= (b.x + b.w)
		&& a.y + a.h > b.y
		&& a.y <= (b.y + b.h)
		)
		{
			res = true;
		}
		
	return res;
}

// Draw everything
GameState.prototype.Draw = function () {
	if (g_DataCache.done())
	{
		// this.viewport.DrawSprite ("background", 0, 0, gameEngine.canvas.width, gameEngine.canvas.height);
		this.DrawWorld();
		heroSprite.Draw(g_DataCache, this.viewport, this.hero.x, this.hero.y);
		// this.viewport.DrawSprite ("monster", this.monster.x, this.monster.y, 32, 32);
	}
	
	this.DrawHUD();
};

GameState.prototype.IsOverlappingWorld = function(item){
	var res = false;
	for (obst in this.obstacles){
		if (intersects (item, this.obstacles[obst]))
		{
			res = true;
		}
	}

	return res;
}

GameState.prototype.generateRandomPosition = function (w, h){
	var curr = {};
	do {
		curr.x = rnd (0, WORLD_WIDTH);
		curr.y = rnd (0, WORLD_HEIGHT);
		curr.w = w;
		curr.h = h;
	}while (this.IsOverlappingWorld (curr));
	return curr;
}

GameState.prototype.CreateWorld = function () {
	this.target.x = rnd (0, WORLD_WIDTH);
	this.target.y = rnd (0, WORLD_HEIGHT)

	for (var i = 0; i < this.nbObstacles; i=i+1){
		var curr = this.generateRandomPosition(128, 128);
		
		this.obstacles[i] = curr;
	}
}

GameState.prototype.DrawWorld = function () {
	this.viewport.DrawRect(this.target.x, this.target.y, 32,32, "rgb(0, 200, 0)");
	for (var i = 0; i < this.nbObstacles; i=i+1){
		this.viewport.DrawSprite ("tree", this.obstacles[i].x, this.obstacles[i].y, 128, 128);
	}
	// 
}

GameState.prototype.DrawHUD = function ()
{
	this.DrawRunningInfos ();
	this.DrawCompass ();
}

GameState.prototype.DrawRunningInfos = function (){
	if (this.hero.isRunning){
		g_Screen.drawText ("Timer : " + this.runTimer.Elapsed().toFixed(2), 32, 50, "rgb(0, 250, 250)", "24px Helvetica");
		var ratio = this.runTimer.Elapsed () / this.runDuration;
		var MAX_WIDTH = 200;
		g_Screen.drawRect (10 + MAX_WIDTH, 10, -ratio * MAX_WIDTH, 20, "rgb (128, 128, 128)");
	}else if (this.hero.canRun == false){
		g_Screen.drawText ("Timer : " + this.waitTimer.Elapsed().toFixed(2), 32, 50, "rgb(0, 250, 250)", "24px Helvetica");
		var ratio = this.waitTimer.Elapsed () / this.runDuration;
		var MAX_WIDTH = 200;
		g_Screen.drawRect (10 + MAX_WIDTH, 10, ratio * MAX_WIDTH, 20, "rgb (128, 128, 128)");
	}
	
}

GameState.prototype.DrawCompass = function () {
	// Position of the compass
	var s = 80;
	var margin = 0.25;
	var x0 = GAME_WIDTH - (1 + margin)*s; // upper left corner
	var y0 = margin * s;
	
	var px = this.target.x - this.hero.x;
	var py = this.target.y - this.hero.y;
	
	var len = Math.sqrt (px*px + py*py);
	px = (0.4 * s) * (px / len);
	py = (0.4 * s) *(py / len);
	
	g_Screen.drawRect(x0, y0, s, s, "rgb(0, 250, 250)");
	g_Screen.drawText ("Distance : " + (len*0.1).toFixed (2), 32, 32, "rgb(0, 250, 250)", "24px Helvetica");
	g_Screen.drawLine (x0 + s/2, y0 + s/2, px + x0 + s/2, py + y0 + s/2, "rgb(255, 0, 0)");
};



// Reset the game when the player catches a monster
GameState.prototype.Reset = function () {
	// Throw the monster somewhere on the screen randomly
	this.monster.x = 32 + (Math.random() * (gameEngine.canvas.width - 64));
	this.monster.y = 32 + (Math.random() * (gameEngine.canvas.height - 64));
	
	this.CreateWorld();
	
	this.hero = {
		defaultSpeed: 128,
		speed: 128, // movement in pixels per second
		run: true,
		isRunning:false,
		canRun: true
	};
	
	var heroPos = this.generateRandomPosition(32,32);
	
	this.hero.x = heroPos.x;
	this.hero.y = heroPos.y;
	
	this.viewport.x = this.hero.x;	
	this.viewport.y = this.hero.y;
	this.target = this.generateRandomPosition(32,32);
};
















///////////////////////////////////////////////////////////////////////////////
// Menu state
///////////////////////////////////////////////////////////////////////////////
MenuState = function() {}

MenuState.prototype = {
	activeItem : 0,
	menuItems : [
		"Play",
		// "Options",
		"Credit",
	]
}

MenuState.prototype.Update = function (modifier) {
	// The event handling is done in the keypress event
};
	
MenuState.prototype.Draw = function(){
	// Background
	g_Screen.drawRect (0,0, GAME_WIDTH, GAME_HEIGHT, "#d0e7f9");
	
	// Display the Title
	g_Screen.drawText ("LD23 - Don't forget to find a title", 32,32, "rgb(0, 250, 250)", "26px Helvetica");
	// g_Screen.drawText ("Cache : " + g_DataCache.queue.length, 32,64, "rgb(0, 250, 250)", "26px Helvetica");
	
	// Display the menu
	for (i = 0; i < this.menuItems.length; i++)
	{
		var str = this.menuItems[i];
		var col = "red";
		
		if (this.activeItem == i){
			col = "green";
			str = "[ " + this.menuItems[i] + " ]";
		}
		g_Screen.drawCenterText (str, GAME_WIDTH/2, GAME_HEIGHT/2 + 50 * (i), col, "30pt Calibri");
	}
}

MenuState.prototype.HandleEvent = function(event){
	if (event.keyCode == KB_ENTER) {	// Pressing "enter"
		if (this.activeItem == 0){
			gameEngine.ChangeState("game");
			// currState = 1;
			gameEngine.effects.push ( new FadeEffect ("rgb(255, 255, 255)", 0.3, false) );
		}
		else if (this.activeItem == 2)
		{
			// currState = 2;
			gameEngine.ChangeState("credit");
			creditState.Init();
			gameEngine.effects.push ( new FadeEffect ("rgb(255, 255, 255)", 0.3, false) );
		}
	}
	if (event.keyCode == KB_UP) { // Player holding up
		bullet_sound.play();
		this.activeItem = (this.activeItem-1);
		if (this.activeItem < 0)
			this.activeItem = this.menuItems.length-1;
	}
	if (event.keyCode == KB_DOWN) { // Player holding down
		bullet_sound.play();
		this.activeItem = (this.activeItem + 1) % (this.menuItems.length);
	}
}


///////////////////////////////////////////////////////////////////////////////
// Game state
///////////////////////////////////////////////////////////////////////////////
CreditState = function(){
	this.timer = new Timer();
}

CreditState.prototype = {
	pos : GAME_HEIGHT - 100,
	active:false
}

CreditState.prototype.Init = function (){
	this.active = true;
	this.timer.Start();
}

CreditState.prototype.Update = function (dt) {
	if (KB_ESCAPE in gameEngine.keysDown) {
		gameEngine.ChangeState("menu");
		this.active = false;
	}
}

CreditState.prototype.Draw = function () {
	g_Screen.drawCenterText ("Yay !", GAME_WIDTH/2, this.pos - this.timer.Elapsed()*0.001*20, "rgb(0, 250, 250)", "24px Helvetica");
	g_Screen.drawText ("" + this.timer.ChronoString(), 100, 100, "rgb(0, 250, 250)", "24px Helvetica");
}


///////////////////////////////////////////////////////////////////////////////
// Our application
// Initialization of the global variables (the different states + the engine)
// and execution of the game
///////////////////////////////////////////////////////////////////////////////
var gameEngine = new K2DEngine({
	width: GAME_WIDTH,
	height : GAME_HEIGHT,
	datacache:g_DataCache,
	stateAfterLoading : "menu"
});

var g_Screen = new Screen (gameEngine);

var menuState = new MenuState();
var gameState = new GameState();
// gameState.Reset();
var creditState = new CreditState();

gameEngine.states = {
		menu:menuState,
		game:gameState,
		credit:creditState
	};

gameEngine.Init();