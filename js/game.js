// Heavily based on http://www.lostdecadegames.com/how-to-make-a-simple-html5-canvas-game/
var GAME_WIDTH = 600;
var GAME_HEIGHT = 480;

//Create a sound 
// /!\ Does not work in firefox
var bullet_sound = new Audio("sound/bullet.mp3");

g_DataCache = new DataCache();

var objToLoad = [
	"monster",
	"hero",
	"background",
	"tree"
];

g_DataCache.queue = objToLoad;

// Handles the mouse events
document.onmousemove = function (event){
	// alert("Hey");
}



///////////////////////////////////////////////////////////////////////////////
// Game state
///////////////////////////////////////////////////////////////////////////////
GameState = function(){
	this.viewport = new Viewport(gameEngine);
	this.context = gameEngine.context;
	this.runTimer = new Timer();
	this.obstacles 
}

GameState.prototype = {
	hero : {
		defaultSpeed: 128,
		speed: 128, // movement in pixels per second
		run: true,
		isRunning:false
	},
	scrollingRatio:0.3,
	monster : {},
	monstersCaught : 0,
	viewport:{},
	obstacles:{}
}

var rnd = function (mini, maxi){
	return mini + Math.floor(Math.random()*(maxi-mini));
}

// We want a spritesheet with 4 states, each state containing 8 images.
var heroSprite = new SpriteSheet(4,8, 200, "hero");

GameState.prototype.Update = function (modifier) {
	var animate = false;
	if (this.hero.isRunning == true){
		this.hero.speed = this.hero.defaultSpeed * 2;
	}
	else{
		this.hero.speed = this.hero.defaultSpeed;
	}
	
	if (KB_UP in gameEngine.keysDown) {
		this.hero.y -= this.hero.speed * modifier;
		heroSprite.SetState (1);
		animate = true;
	}
	if (KB_DOWN in gameEngine.keysDown) {
		this.hero.y += this.hero.speed * modifier;
		heroSprite.SetState (0);
		animate = true;
	}
	if (KB_LEFT in gameEngine.keysDown) {
		this.hero.x -= this.hero.speed * modifier;
		heroSprite.SetState (2);
		animate = true;
	}
	if (KB_RIGHT in gameEngine.keysDown) {
		this.hero.x += this.hero.speed * modifier;
		heroSprite.SetState (3);
		animate = true;
	}
	if (KB_ESCAPE in gameEngine.keysDown) {
		gameEngine.ChangeState("menu");
	}
	
	// Very basic viewport management: when we get closer to the edge, move the viewport
	if (this.hero.x < this.viewport.x + (GAME_WIDTH * this.scrollingRatio))
		this.viewport.x -= this.hero.speed * modifier;
	if (this.hero.x +32> (this.viewport.x + GAME_WIDTH) - (GAME_WIDTH * this.scrollingRatio))
		this.viewport.x += this.hero.speed * modifier;
	if (this.hero.y < this.viewport.y + (GAME_HEIGHT * this.scrollingRatio))
		this.viewport.y -= this.hero.speed * modifier;
	if (this.hero.y +32> (this.viewport.y + GAME_HEIGHT) - (GAME_HEIGHT * this.scrollingRatio))
		this.viewport.y += this.hero.speed * modifier;
	
	heroSprite.SetAnimated(animate);
	heroSprite.Animate();
	// Are they touching?
	if (
		this.hero.x <= (this.monster.x + 32)
		&& this.monster.x <= (this.hero.x + 32)
		&& this.hero.y <= (this.monster.y + 32)
		&& this.monster.y <= (this.hero.y + 32)
	) {
		this.Reset();
		++this.monstersCaught;
		bullet_sound.play();
		gameEngine.effects.push ( new FadeEffect ("rgb(255, 255, 255)", 0.3, false) );
	}
};

// Draw everything
GameState.prototype.Draw = function () {
	if (g_DataCache.done())
	{
		this.viewport.DrawSprite ("background", 0, 0, gameEngine.canvas.width, gameEngine.canvas.height);
		this.DrawWorld();
		
		this.viewport.DrawSprite ("tree", 128, 128, 128, 128);
		heroSprite.Draw(g_DataCache, this.viewport, this.hero.x, this.hero.y);
		this.viewport.DrawSprite ("monster", this.monster.x, this.monster.y, 32, 32);
	}

	// Score
	
	this.DrawCompass();
};

GameState.prototype.CreateWorld = function () {
	for (var i = 0; i < 4; i=i+1){
		var curr = ({
			x: rnd (0, GAME_WIDTH),
			y: rnd (0, GAME_HEIGHT)
		});
		
		this.obstacles[i] = curr;
	}

	//this.viewport.DrawSprite ("tree", 128, 128, 128, 128);
}

GameState.prototype.DrawWorld = function () {
	for (var i = 0; i < 4; i=i+1){
		this.viewport.DrawSprite ("tree", this.obstacles[i].x, this.obstacles[i].y, 128, 128);
	}
	// 
}

GameState.prototype.DrawCompass = function () {
	// Position of the compass
	var s = 80;
	var margin = 0.25;
	var x0 = GAME_WIDTH - (1 + margin)*s; // upper left corner
	var y0 = margin * s;
	
	var px = this.monster.x - this.hero.x;
	var py = this.monster.y - this.hero.y;
	var len = Math.sqrt (px*px + py*py);
	px = (0.4 * s) * (px / len);
	py = (0.4 * s) *(py / len);
	
	g_Screen.drawRect(x0, y0, s, s, "rgb(0, 250, 250)");
	g_Screen.drawText ("Distance : " + (len*0.1).toFixed (2), 32, 32, "rgb(0, 250, 250)", "24px Helvetica");
	g_Screen.drawLine (x0 + s/2, y0 + s/2, px + x0 + s/2, py + y0 + s/2, "rgb(255, 0, 0)");
	/*
	this.context.beginPath();
    this.context.moveTo(x0 + s/2, y0 + s/2);
    this.context.lineTo(px + x0 + s/2, py + y0 + s/2);
    this.context.closePath();
    this.context.stroke();*/
};



// Reset the game when the player catches a monster
GameState.prototype.Reset = function () {
	this.hero.x = gameEngine.canvas.width / 2;
	this.hero.y = gameEngine.canvas.height / 2;

	// Throw the monster somewhere on the screen randomly
	this.monster.x = 32 + (Math.random() * (gameEngine.canvas.width - 64));
	this.monster.y = 32 + (Math.random() * (gameEngine.canvas.height - 64));
	
	this.CreateWorld();
};
















///////////////////////////////////////////////////////////////////////////////
// Menu state
///////////////////////////////////////////////////////////////////////////////
MenuState = function() {}

MenuState.prototype = {
	activeItem : 0,
	menuItems : [
		"Play",
		"Options",
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
	g_Screen.drawText ("The Great Chase of the Goblins", 32,32, "rgb(0, 250, 250)", "26px Helvetica");
	g_Screen.drawText ("Cache : " + g_DataCache.queue.length, 32,64, "rgb(0, 250, 250)", "26px Helvetica");
	
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
var creditState = new CreditState();

gameEngine.states = {
		menu:menuState,
		game:gameState,
		credit:creditState
	};

gameEngine.Init();