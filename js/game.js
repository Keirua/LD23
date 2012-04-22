// Heavily based on http://www.lostdecadegames.com/how-to-make-a-simple-html5-canvas-game/
var GAME_WIDTH = 600;
var GAME_HEIGHT = 480;

var WORLD_WIDTH = 4000;
var WORLD_HEIGHT = 4000;
var NB_TREES = 100;
var FLOOR_SIZE = 32;

var START_AREA_SIZE = WORLD_WIDTH * 0.1; // 10 % of the total game area

var NB_TARGETS = 4; // The number of persons to rescue

var start_area = {
	x : WORLD_WIDTH/2 - START_AREA_SIZE/2,
	y : WORLD_HEIGHT/2 - START_AREA_SIZE/2,
	w : START_AREA_SIZE,
	h : START_AREA_SIZE,
};

//Create a sound 
// /!\ Does not work in firefox
/*
var target_found 	= new Audio("sound/bullet.mp3");
var starwars_sound 	= new Audio("sound/starwars.mp3");
var game_sound 		= new Audio("sound/soundtrack.mp3");*/

var starwars_sound = new buzz.sound(["sound/starwars.mp3",  "sound/starwars.ogg"], {
    preload: true,
    autoload: true,
    loop: false
});

var game_sound = new buzz.sound(["sound/soundtrack.mp3",  "sound/soundtrack.ogg"], {
    preload: true,
    autoload: true,
    loop: true
});
game_sound.setVolume (50);

var target_found = new buzz.sound(["sound/target_found.mp3"], {
    preload: true,
    autoload: true,
    loop: false
});


g_DataCache = new DataCache();

var objToLoad = [
	"monster",
	"hero",
	"crew",
	// "background",
	"tree",
	"floor_tileset",
	"spacecraft",
	// "enter_key",
	"space_key", // finally, I chose not to use it. Only 2 key is easier for the player to understand
	"arrow_keys",
];

g_DataCache.queue = objToLoad;

var rnd = function(from,to)
{
    return Math.floor(Math.random()*(to-from+1)+from);
}

// randomly returns +1 or -1
var rndsign = function (mini, maxi){
	return (Math.random()*1000 > 500) ? -1 : 1;
}

var MONSTER_PATH = 0; // monster currently following a path
var MONSTER_HUNT = 1; // monster is hunting the player, moving faster and stuff
var MONSTER_IDLE = 2; // monster is doing nothing 

Monster = function(){
	this.path = {};
	this.currStep = 0;
}

Monster.prototype = {
	x: 0, 
	y : 0,
	w : 32,
	h : 32,
	speed : 50,
	path : {},
	nbPoints : 0,
	currStep : 0,
	currState : MONSTER_IDLE // we will later see what to do with others states
}

// Generates a path that the monster will follow
Monster.prototype.generatePath = function(){
	var that = this;
	var prev = {
		x: that.x,
		y: that.y
	};
	
	that.path[0] = prev;
	
	var nb = rnd (10, 100);
	that.nbPoints = 1 + nb;
	
	var min_dist = 20, max_dist = 100;
	
	for (var i = 0; i < nb; i = i+1){
	
		var newpos = {};
		do{
			var dx = rnd (min_dist, max_dist) * rndsign();
			var dy = rnd (min_dist, max_dist) * rndsign();
			newpos.x = prev.x + rndsign() * dx;
			newpos.y = prev.y + rndsign() * dy;
		}while ((newpos.x < 0 && newpos.x > WORLD_WIDTH) && (newpos.y < 0 && newpos.x > WORLD_WIDTH));
		
		that.path[i+1] = newpos;
		
		prev = that.path[i+1];
	}
}

var vectorLength = function (v){
	return Math.sqrt (v.x * v.x + v.y * v.y);
}

var vectorNormalize = function (dir){
	var len = vectorLength(dir);
	if ( len < 0.01) 
		len = 0.01;
		var res = {
			x : dir.x / len,
			y : dir.y / len
			}
	return res;
}

Monster.prototype.update = function (dt){
	if (this.currState == MONSTER_PATH){
		var curr = this.path[this.currStep];
		var nextStep = ((this.currStep + 1) >= this.nbPoints) ? 0 : (this.currStep + 1);
		var next = this.path[nextStep];
		var dir = {
			x : next.x - this.x,
			y : next.y - this.y
		};
		var l = {
			x : next.x - this.x,
			y : next.y - this.y
		}
		
		dir = vectorNormalize (dir);
		
		this.x = this.x + dir.x * dt * this.speed;
		this.y = this.y + dir.y * dt * this.speed;
		
		if (vectorLength (l) < 10)
		{
			this.currStep = this.currStep +1;
			if (this.currStep  > this.nbPoints)
				this.currStep = 0;
		}
	}
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
	this.nbObstacles = NB_TREES;
	this.nbMonsters = NB_TREES;
	this.floor_tiles = {};
	this.foundEveryBody = false;
}

GameState.prototype = {
	hero : {
		defaultSpeed: 128,
		speed: 128, // movement in pixels per second
		run: true,
		isRunning:false,
		canRun: true
	},
	scrollingRatio:0.45,
	
	nbMonsters : 10,
	monsters : {},
	
	floor_tiles : {},
	
	runDuration: 2000, // How long one can run
	runWaitingTime: 2000, // when you are done running, how long you have to wait before being able to run again
	viewport:{},
	obstacles:{}, // stuff blocking the payer
	nbObstacles:10,
	target:{},		// where the player is supposed to go to
	
	targets_found:{},
	targets:{}
}


// We want a spritesheet with 4 states, each state containing 8 images.
var heroSprite = new SpriteSheet(4,8, 200, "hero");

GameState.prototype.HandleEvent = function(event){
	if (event.keyCode == KB_SPACE || event.keyCode == KB_ENTER) {	// Pressing "enter"
		if (this.hero.canRun){
			this.hero.isRunning = true;
			this.hero.canRun = false; // boolean saying 
			this.runTimer.Start();
		}
	}
}

GameState.prototype.UpdatePlayer = function (modifier){

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
		if (this.hero.y < 0){
			this.hero.y = WORLD_HEIGHT-this.hero.y;
			this.viewport.y  += WORLD_HEIGHT;
		}
		else if (this.hero.y > WORLD_HEIGHT){
			this.hero.y = WORLD_HEIGHT-this.hero.y;
			this.viewport.y  -= WORLD_HEIGHT;
		}	
	}
	if (this.collideWorld ({x:newpos.x, y:this.hero.y, w: 32, h: 32}) == false)
	{
		this.hero.x = newpos.x;
		if (this.hero.x < 0){
			this.hero.x = WORLD_WIDTH-this.hero.x;
			this.viewport.x  += WORLD_WIDTH;
		}
		else if (this.hero.x > WORLD_HEIGHT){
			this.hero.x = WORLD_WIDTH-this.hero.x;
			this.viewport.x  -= WORLD_WIDTH;
		}	
	}
	
	if (KB_ESCAPE in gameEngine.keysDown) {
		gameEngine.ChangeState("menu");
		game_sound.stop();
		starwars_sound.stop();
	}
	
	// check if the player didn't collide with an ennmy
	this.CheckDeathLogic();
	this.CheckTargetsLogic();
	
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
}

GameState.prototype.UpdateAI = function (modifier){
	for (key in this.monsters){
		this.monsters[key].update(modifier);
	}
}
		
GameState.prototype.CheckTargetsLogic = function(){
	var size = 32;
	if (this.foundEveryBody == false)
	{
		for (var t in this.targets){
			var target = this.targets[t];
			if (this.hero.x + size > target.x && this.hero.x < (target.x + size)
			&& this.hero.y + size > target.y && this.hero.y < (target.y + size)
			&& this.targets_found[t] == false)
			{
				this.targets_found[t] = true;
				
				target_found.play();
				gameEngine.effects.push ( new FadeEffect ("rgb(255, 255, 255)", 0.3, false) );
				gameEngine.ChangeState("cutscene");
				cutsceneState.nbFound = cutsceneState.nbFound + 1;
			}
		}
	}
	else
	{
		var target = {
			x : WORLD_WIDTH/2,
			y : WORLD_WIDTH/2
		};
		if (this.hero.x + size > target.x && this.hero.x < (target.x + 2*size)
			&& this.hero.y + size > target.y && this.hero.y < (target.y + 2*size))
		{
			gameEngine.ChangeState ("win");
		}
	}
}
		
GameState.prototype.CheckDeathLogic = function (modifier){
	for (key in this.monsters){
		var currMonster = this.monsters[key]
		// if (intersects (this.hero, currMonster) == true){
		/*
		if (RectA.X1 < RectB.X2 && RectA.X2 > RectB.X1 &&
    RectA.Y1 < RectB.Y2 && RectA.Y2 > RectB.Y1)*/
		var size = 32;
		if  (this.hero.x + 0.8*size > currMonster.x && this.hero.x < (currMonster.x + 0.8*size)
		&& this.hero.y + 0.8*size > currMonster.y && this.hero.y < (currMonster.y + 0.8*size)
		)
		{
			// Yep, like this. I could have a bit softer, but hey.
			gameEngine.ChangeState("death");
			cutsceneState.Reset();
		}
	}
}

GameState.prototype.Update = function (modifier) {
	this.UpdatePlayer (modifier);
	this.UpdateAI (modifier);
	
	// Are they touching?
	if (
		this.hero.x <= (this.target.x + 32)
		&& this.target.x <= (this.hero.x + 32)
		&& this.hero.y <= (this.target.y + 32)
		&& this.target.y <= (this.hero.y + 32)
	) {
		// this.Reset();
		// target_found.play();
		// gameEngine.effects.push ( new FadeEffect ("rgb(255, 255, 255)", 0.3, false) );
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
	if (intersects (item, start_area))
	{
		res = true;
	}
	else
	{
		for (obst in this.obstacles){
			if (intersects (item, this.obstacles[obst]))
			{
				res = true;
			}
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
	var i = 0;
	
	for (i = 0; i < this.nbObstacles; i=i+1){
		var curr = this.generateRandomPosition(128, 128);
		
		this.obstacles[i] = curr;
	}
	
	for (i = 0; i < this.nbMonsters; i=i+1){
		var curr = this.generateRandomPosition(32, 32);
		this.monsters[i] = new Monster ();
		this.monsters[i].x = curr.x;
		this.monsters[i].y = curr.y;
		
		this.monsters[i].generatePath();
		this.monsters[i].currState = MONSTER_PATH;
		
	}
	var target = this.generateRandomPosition (32, 32);
	
	
	for (i = 0; i < NB_TARGETS; i = i+1){
		this.targets_found[i] = false;
		this.targets[i] = {
			x : rnd (start_area.x, START_AREA_SIZE),
			y : rnd (start_area.y, START_AREA_SIZE)
		};
	}
	
	this.target.x = target.x
	this.target.y = target.y;
}

var clampBetweenZeroAnd = function(max, value){
	var res = value;
	do{
		res = res + max
	}while (res < 0);
	do{
		res = res - max
	}while (res > max);
	return res;
}

GameState.prototype.DrawFloor = function(){
	var sizex = Math.ceil(GAME_WIDTH/FLOOR_SIZE);
	var sizey = Math.ceil(GAME_HEIGHT/FLOOR_SIZE);
	var image = g_DataCache.getImage("floor_tileset");
	/*
	for (i = 0; i < sizex; i = i+1)
		for (j = 0; j < sizey; j = j+1)
		{
			var vx = clampBetweenZeroAnd(GAME_WIDTH, this.viewport.x);
			var vy = clampBetweenZeroAnd(GAME_HEIGHT, this.viewport.y);
			var xdiv = Math.floor((vx + i * FLOOR_SIZE) / FLOOR_SIZE);
			var ydiv = Math.floor((vy + j * FLOOR_SIZE) / FLOOR_SIZE);
			
			var id = this.floor_tiles[ydiv*sizey+xdiv];
			
			this.context.drawImage(image, id*sizex, 0, FLOOR_SIZE, FLOOR_SIZE, i * sizex, j*sizey, FLOOR_SIZE, FLOOR_SIZE);
		} */
}

GameState.prototype.DrawWorld = function () {
	this.DrawFloor ();
	
	this.viewport.DrawRect(this.target.x, this.target.y, 32,32, "rgb(0, 200, 0)");
	for (var i = 0; i < this.nbObstacles; i=i+1){
		this.viewport.DrawSprite ("tree", this.obstacles[i].x, this.obstacles[i].y, 128, 128);
		
		this.viewport.DrawSprite ("tree", this.obstacles[i].x + WORLD_WIDTH, this.obstacles[i].y, 128, 128);
		this.viewport.DrawSprite ("tree", this.obstacles[i].x - WORLD_WIDTH, this.obstacles[i].y, 128, 128);
		this.viewport.DrawSprite ("tree", this.obstacles[i].x, this.obstacles[i].y + WORLD_HEIGHT, 128, 128);
		this.viewport.DrawSprite ("tree", this.obstacles[i].x, this.obstacles[i].y - WORLD_HEIGHT, 128, 128);
	}
	for (var i = 0; i < this.nbMonsters; i=i+1){
		this.viewport.DrawSprite ("monster", this.monsters[i].x, this.monsters[i].y, 32, 32);
	}
	for (var key in this.targets){
		var target = this.targets[key];
		if (this.targets_found[key] == false){
			// this.viewport.DrawRect (target.x, target.y, 32, 32, "#FFFFFF" );
			this.viewport.DrawSprite ("crew", target.x, target.y, 32, 32);
		}
	}
	
	this.viewport.DrawSprite ("spacecraft", WORLD_WIDTH/2, WORLD_HEIGHT/2, 64,64);
	
}

GameState.prototype.DrawHUD = function ()
{
	this.DrawRunningInfos ();
	var px = this.hero.x.toFixed (2);
	var py = this.hero.y.toFixed (2);

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
	
	// need to find the closes target
	var bFound = false;
	var target = {};
	
	for (var t in this.targets){
		if (this.targets_found[t] == false){
			target = this.targets[t];
			bFound = true;
			break;
		}
	}
	if (bFound == false){
		target = {
			x : WORLD_WIDTH/2-32,
			y : WORLD_WIDTH/2-32
		}
		this.foundEveryBody = true;
	}
	
	var px = target.x - this.hero.x;
	var py = target.y - this.hero.y;
	
	var len = Math.sqrt (px*px + py*py);
	px = (0.4 * s) * (px / len);
	py = (0.4 * s) *(py / len);
	
	g_Screen.drawRect(x0, y0, s, s, "rgb(0, 250, 250)");
	g_Screen.drawText ("Distance : " + (len*0.1).toFixed (2), 32, 32, "rgb(0, 250, 250)", "24px Helvetica");
	g_Screen.drawLine (x0 + s/2, y0 + s/2, px + x0 + s/2, py + y0 + s/2, "rgb(255, 0, 0)");
};

// Reset the game when the player catches a monster
GameState.prototype.Reset = function () {
	this.CreateWorld();
	
	this.hero = {
		defaultSpeed: 128,
		speed: 128, // movement in pixels per second
		run: true,
		isRunning:false,
		canRun: true
	};
	
	// We want to make the play start in the middle of the game area
	var heroPos = {
		x : rnd (0, START_AREA_SIZE),
		y : rnd (0, START_AREA_SIZE),
	}
	
	this.hero.x = start_area.x + heroPos.x;
	this.hero.y = start_area.y + heroPos.y;
	
	this.viewport.x = this.hero.x;	
	this.viewport.y = this.hero.y;
	this.target = this.generateRandomPosition(32,32);
	
	this.foundEveryBody = false;
};

GameState.prototype.InitFloor = function(){
	var sizex = Math.ceil(GAME_WIDTH/FLOOR_SIZE);
	var sizey = Math.ceil(GAME_HEIGHT/FLOOR_SIZE);
	
	for (i = 0; i < sizex; i = i+1)
		for (j = 0; j < sizey; j = j+1)
		{
			var id = rnd (0, 8);
			this.floor_tiles [j * sizex + i] = id;
		}
}

GameState.prototype.Init = function () {
	this.Reset ();
	this.InitFloor ();
};

///////////////////////////////////////////////////////////////////////////////
// Win state
///////////////////////////////////////////////////////////////////////////////
WinState = function() {}

WinState.prototype = {
}

WinState.prototype.Update = function (modifier) {
};
	
WinState.prototype.Draw = function(){
	// Background
	g_Screen.drawRect (0,0, GAME_WIDTH, GAME_HEIGHT, "#d0e7f9");
	
	// Display the Title
	g_Screen.clear("rgb(0,0,0)");
	var col = "rgb(69, 69, 69)";
	
	g_Screen.drawCenterText ("You won", GAME_WIDTH/2, GAME_HEIGHT/2-100, col, "26px Helvetica");
	
	g_Screen.drawCenterText ("Press [enter] to reach the credit", GAME_WIDTH/2, GAME_HEIGHT/2 + 100, col, "26px Helvetica");
}

WinState.prototype.HandleEvent = function(event){
	if (event.keyCode == KB_SPACE || event.keyCode == KB_ENTER) {
		gameEngine.ChangeState("credit"); // 
		game_sound.stop();
	}
}


///////////////////////////////////////////////////////////////////////////////
// Cutscene state
///////////////////////////////////////////////////////////////////////////////
IntroState = function() {
	this.currScene = 0;
	this.timer = new Timer();
}

IntroState.prototype = {
	currScene : 0,
	pos : GAME_HEIGHT/2 - 100
}

IntroState.prototype.Init = function (modifier) {
	this.timer = new Timer ();
	this.timer.Start();
	starwars_sound.play();
};

IntroState.prototype.Update = function (modifier) {
};
	
IntroState.prototype.Draw = function(){
	// Background
	g_Screen.drawRect (0,0, GAME_WIDTH, GAME_HEIGHT, "#d0e7f9");
	
	// Display the Title
	g_Screen.clear("rgb(0,0,0)");
	var col = "rgb(69, 69, 69)";
	
	if (this.currScene == 0){
		this.DrawStarwarsScene();
	}
	else
	{
		g_Screen.drawCenterText ("Scene #" + this.currScene, GAME_WIDTH/2, GAME_HEIGHT/2, col, "26px Helvetica");
	}
	
	this.DrawIndications();
}

IntroState.prototype.DrawStarwarsScene = function(){
	var yoffset = this.pos - this.timer.Elapsed()*0.001*30;
	var col = "rgb(69, 69, 69)";
	var font = "26px Helvetica";

	g_Screen.drawCenterText ("A long time ago", GAME_WIDTH/2, yoffset, col, font);
	g_Screen.drawCenterText ("in a galaxy far far away", GAME_WIDTH/2, yoffset + 100, col, font);
	g_Screen.drawCenterText ("there was a terrible war", GAME_WIDTH/2, yoffset + 200, col, font);
	g_Screen.drawCenterText ("Well, actually, forget about that.", GAME_WIDTH/2, yoffset + 400, col, font);
	g_Screen.drawCenterText ("That's another story.", GAME_WIDTH/2, yoffset + 500, col, font);
	
	// if (yoffset < -400)
	if (this.timer.Elapsed () > 9000)
	{
		g_Screen.drawCenterText ("Hit [space] to continue", GAME_WIDTH/2, 400, col, font);
	}
}

IntroState.prototype.DrawIndications  = function(){
	var x = 2* GAME_WIDTH/3;
	var y =  GAME_HEIGHT-30;
	var text = "[Space] = next, [Enter] = skip";
	
	g_Screen.drawText (text, x, y, "#696969", "14px Helvetica");
	
	/*
	gameEngine.context.fillStyle = "rgb(69, 69, 69)";
	gameEngine.context.font = "14px Helvetica";
	gameEngine.context.textAlign = "left";
	gameEngine.context.textBaseline = "top";
	gameEngine.context.fillText(text, x, y);*/
}

IntroState.prototype.HandleEvent = function(event){
	if (event.keyCode == KB_SPACE) {
		this.currScene = this.currScene + 1;
		// gameEngine.effects.push ( new FadeEffect ("rgb(255, 255, 255)", 0.3, false) );
	}

	if (event.keyCode == KB_ENTER) {
		gameEngine.ChangeState("game");
		starwars_sound.stop();
		game_sound.play();
		
		gameEngine.effects.push ( new FadeEffect ("rgb(255, 255, 255)", 0.3, false) );
	}
	if (event.keyCode == KB_ESCAPE) {
		gameEngine.ChangeState("menu");
		gameEngine.effects.push ( new FadeEffect ("rgb(255, 255, 255)", 0.3, false) );
		game_sound.stop();
		starwars_sound.stop();
	}
	
}


///////////////////////////////////////////////////////////////////////////////
// Cutscene state
///////////////////////////////////////////////////////////////////////////////
CutsceneState = function() {
	this.nbFound = 0;
	this.timer = new Timer();
}

CutsceneState.prototype = {
	pos : GAME_HEIGHT - 100,
	active:false,
}

CutsceneState.prototype.Reset = function () {
	this.nbFound = 0;
};

CutsceneState.prototype.Update = function (modifier) {
};
	
CutsceneState.prototype.Draw = function(){
	// Background
	g_Screen.drawRect (0,0, GAME_WIDTH, GAME_HEIGHT, "#d0e7f9");
	
	// Display the Title
	g_Screen.clear("rgb(0,0,0)");
	var col = "rgb(69, 69, 69)";
	
	g_Screen.drawCenterText ("Cutscene 1", GAME_WIDTH/2, GAME_HEIGHT/2-100, col, "26px Helvetica");
	
	if (this.nbFound != NB_TARGETS){
		g_Screen.drawCenterText ("You found " + this.nbFound + "/" + NB_TARGETS + " persons", GAME_WIDTH/2, GAME_HEIGHT/2, col, "26px Helvetica");
	}
	else
	{
		g_Screen.drawCenterText ("You found everybody !", GAME_WIDTH/2, GAME_HEIGHT/2, col, "26px Helvetica");
		g_Screen.drawCenterText (" Now go back to the spacecraft !", GAME_WIDTH/2, GAME_HEIGHT/2 + 100, col, "26px Helvetica");
	}
	g_Screen.drawCenterText ("Press space to get back to the game", GAME_WIDTH/2, GAME_HEIGHT/2 + 200, col, "26px Helvetica");
	
}

CutsceneState.prototype.HandleEvent = function(event){
	if (event.keyCode == KB_SPACE) {
		gameEngine.ChangeState("game");
		gameEngine.effects.push ( new FadeEffect ("rgb(255, 255, 255)", 0.3, false) );
	}
}



///////////////////////////////////////////////////////////////////////////////
// Death state
///////////////////////////////////////////////////////////////////////////////
DeathState = function() {}

DeathState.prototype = {
}

DeathState.prototype.Update = function (modifier) {
};
	
DeathState.prototype.Draw = function(){
	// Background
	g_Screen.drawRect (0,0, GAME_WIDTH, GAME_HEIGHT, "#d0e7f9");
	
	// Display the Title
	g_Screen.clear("rgb(0,0,0)");
	var col = "rgb(69, 69, 69)";
	
	g_Screen.drawCenterText ("You died", GAME_WIDTH/2, GAME_HEIGHT/2-100, col, "26px Helvetica");
	
	g_Screen.drawCenterText ("It was very painful and you suffered a lot", GAME_WIDTH/2, GAME_HEIGHT/2, col, "26px Helvetica");
	
	g_Screen.drawCenterText ("Now press [enter] to do something better", GAME_WIDTH/2, GAME_HEIGHT/2 + 100, col, "26px Helvetica");
}

DeathState.prototype.HandleEvent = function(event){
	if (event.keyCode == KB_SPACE || event.keyCode == KB_ENTER) {
		gameEngine.ChangeState("menu");
		game_sound.stop();
	}
}



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
	
	var x = 200, y = 200;
	
	g_Screen.drawImage ("space_key", GAME_WIDTH/2 - x + 30,  GAME_HEIGHT/3 + y + 34, 136, 29);
	
	g_Screen.drawImage ("arrow_keys", GAME_WIDTH/2 + x - 100 - 30, GAME_HEIGHT/3 + y, 100, 63);
	
	g_Screen.drawCenterText ("Select/Run", GAME_WIDTH/2 - x + 100, GAME_HEIGHT/3 + y + 60, "black", "24pt Calibri");
	g_Screen.drawCenterText ("Move", GAME_WIDTH/2 + x - 80, GAME_HEIGHT/3 + y + 60, "black", "24pt Calibri");
}



MenuState.prototype.HandleEvent = function(event){
	if (event.keyCode == KB_SPACE || event.keyCode == KB_ENTER) {	// Pressing "enter"
		if (this.activeItem == 0){
			
			gameEngine.ChangeState("intro");
			introState.Init();	// restart the scene position
			gameState.Init();
			// currState = 1;
			gameEngine.effects.push ( new FadeEffect ("rgb(255, 255, 255)", 0.3, false) );
		}
		else if (this.activeItem == 1)
		{
			gameEngine.ChangeState("credit");
			creditState.Init();
			gameEngine.effects.push ( new FadeEffect ("rgb(255, 255, 255)", 0.3, false) );
		}
	}
	if (event.keyCode == KB_UP) { // Player holding up
		// target_found.play();
		this.activeItem = (this.activeItem-1);
		if (this.activeItem < 0)
			this.activeItem = this.menuItems.length-1;
	}
	if (event.keyCode == KB_DOWN) { // Player holding down
		// target_found.play();
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
}

CreditState.prototype.HandleEvent = function(event){
	if (event.keyCode == KB_SPACE || event.keyCode == KB_ENTER || event.keyCode == KB_ESCAPE) {
		gameEngine.ChangeState ("menu");
		this.active = false;
	}
}

CreditState.prototype.Draw = function () {
	var dx = GAME_WIDTH/2;
	var dy = this.pos - this.timer.Elapsed()*0.001*30;
	var col = "#696969";
	var text = [
	
		"Thanks for playing !",
		"",
		"Game realized by Keirua",
		"for Ludum Dare #23",
		"",
		"keirua@gmail.com / @clemkeirua on Twitter",
		"",
		"Tools :",
		"Code : HTML5/Javascript",
		"Images : Inkscape, Paint.Net",
		"Mental : Pizza, noodles, junk food",
		"Music : Audacity, Circuli",
		"",
		"Press [enter] to go back to the menu"
	];
	g_Screen.clear ("black");
	for (var id in text){
		var font = (id == 0 ? "64" : "24") + "px Helvetica";
		g_Screen.drawCenterText (text[id], dx, dy + id * 50, col, font);
	}
	if (this.timer.Elapsed() > 30000){
		g_Screen.drawCenterText ("Come one, it's over now,", dx, GAME_HEIGHT/2+100, col, "24px Helvetica");
		g_Screen.drawCenterText ("There's nothing to do here", dx, GAME_HEIGHT/2 + 150, col, "24px Helvetica");
	}
	
	// g_Screen.drawCenterText ("Yay !", GAME_WIDTH/2, this.pos - this.timer.Elapsed()*0.001*20, "rgb(0, 250, 250)", "24px Helvetica");
	
	// g_Screen.drawText ("" + this.timer.ChronoString(), 100, 100, "rgb(0, 250, 250)", "24px Helvetica");
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
var deathState = new DeathState();
var winState = new WinState();
var introState = new IntroState ();
var cutsceneState = new CutsceneState ();

gameEngine.states = {
		menu:menuState,
		game:gameState,
		credit:creditState,
		death:deathState,
		win:winState,
		cutscene:cutsceneState,
		intro:introState
	};

gameEngine.Init();