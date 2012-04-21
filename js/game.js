// Heavily based on http://www.lostdecadegames.com/how-to-make-a-simple-html5-canvas-game/
var GAME_WIDTH = 512;
var GAME_HEIGHT = 480;

//Create a sound 
// /!\ Does not work in firefox
var bullet_sound = new Audio("sound/bullet.mp3");

g_DataCache = new DataCache();

var objToLoad = [
	"monster",
	"hero",
	"background"
];

g_DataCache.queue = objToLoad;

// Handles the mouse events
document.onmousemove = function (event){
	// alert("Hey");
}

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
// Game state
///////////////////////////////////////////////////////////////////////////////
GameState = function(){
	this.viewport = new Viewport(gameEngine);
}

GameState.prototype = {
	hero : {
		speed: 128, // movement in pixels per second
	},
	monster : {},
	monstersCaught : 0,
	viewport:{}
}

// We want a spritesheet with 4 states, each state containing 8 images.
var heroSprite = new SpriteSheet(4,8, 200, "hero");

GameState.prototype.Update = function (modifier) {
	var animate = false;
	
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
	if (this.hero.x < this.viewport.x + 100)
		this.viewport.x -= this.hero.speed * modifier;
	if (this.hero.x +32> this.viewport.x + GAME_WIDTH - 100)
		this.viewport.x += this.hero.speed * modifier;
	if (this.hero.y < this.viewport.y + 100)
		this.viewport.y -= this.hero.speed * modifier;
	if (this.hero.y +32 > this.viewport.y + GAME_HEIGHT - 100)
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
	// if (g_DataCache.done())
	{
		this.viewport.DrawSprite ("background", 0, 0, gameEngine.canvas.width, gameEngine.canvas.height);
		heroSprite.Draw(g_DataCache, this.viewport, this.hero.x, this.hero.y);
		this.viewport.DrawSprite ("monster", this.monster.x, this.monster.y, 32, 32);
	}

	// Score
	g_Screen.drawText ("Goblins caught: " + this.monstersCaught, 32, 32, "rgb(0, 250, 250)", "24px Helvetica");
};

// Reset the game when the player catches a monster
GameState.prototype.Reset = function () {
	this.hero.x = gameEngine.canvas.width / 2;
	this.hero.y = gameEngine.canvas.height / 2;

	// Throw the monster somewhere on the screen randomly
	this.monster.x = 32 + (Math.random() * (gameEngine.canvas.width - 64));
	this.monster.y = 32 + (Math.random() * (gameEngine.canvas.height - 64));
};

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