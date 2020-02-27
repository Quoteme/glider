var c = document.getElementById("canvas");
var ctx = c.getContext("2d");
var tc = document.getElementById("tmpC");
var tctx = tc.getContext("2d");

// KEYS
var key={
	"x" :			false,
	" " :			false,
	"ArrowUp":		false,
	"ArrowLeft":	false,
	"ArrowRight":	false,
}
window.addEventListener("keydown",	(e)=>{ key[e.key]=true; if(e.key=="f"){fullscreen(document.getElementById("canvas"));}});
window.addEventListener("keyup",	(e)=>{ key[e.key]=false });

// COLORS:
const clrbg  = window.getComputedStyle(document.documentElement).getPropertyValue('--bg');
const clrfg  = window.getComputedStyle(document.documentElement).getPropertyValue('--fg');
const clrhl1 = window.getComputedStyle(document.documentElement).getPropertyValue('--hl1');
const clrhl2 = window.getComputedStyle(document.documentElement).getPropertyValue('--hl2');
const clrhl3 = window.getComputedStyle(document.documentElement).getPropertyValue('--hl3');
const clralt = window.getComputedStyle(document.documentElement).getPropertyValue('--alt');

// important constants
const m=1;
const km=1000*m;

// list of entities
var cam	= {
	"x": 0,
	"y": 0,
	"zoom": 2
}
var e	= [];
var cl	= new Array(100);
var bl	= [];
var map	= new GameMap(3000, 1200);
e.push(new Plane(
	Math.random()*map.width,
	Math.random()*map.height,
	clrfg
));
// generate enemies
for (var i=0; i<50; i++) {
	e.push(new Plane(
		Math.random()*map.width,
		Math.random()*(map.height-map.waterLevel)+map.waterLevel,
		clralt,
		[],
		"Red Devils"
	))
}
for (var i=0; i<50; i++) {
	e.push(new Plane(
		Math.random()*map.width,
		Math.random()*(map.height-map.waterLevel)+map.waterLevel,
		"#64e8e4",
		[],
		"Blue Bullies"
	))
}

// create different guildes that attack each other
for (var i=0, len=cl.length; i<len; i++) {
	cl[i]=new Cloud(
		Math.random()*map.width,
		-Math.random()*map.height-map.waterLevel,
		Math.random()*100
	)
}

ctx.shadowOffsetX=2;
ctx.shadowOffsetY=2;
ctx.shadowBlur=2;
ctx.shadowColor="rgba(0, 0, 0, 0.5)";

function GameMap(width,height){
	// create a new map
	this.width	=	width *m;
	this.height	=	height *m;
	this.gravity=	{
						down: -0.1 *m,
						left: 0.0 *m
					}
	this.waterLevel = 30;
	this.skyLevel = height-30;
	this.drag=0.996;
}

function Plane(x=0,y=0, color=clralt,enemies=[],guilde){
	// create new planes
	this.id=Math.round(Math.random()*100000);
	this.guilde					= guilde;
	this.color = color;
	this.npc=true;
	this.thrustTime				=0;
	this.x=x*m;
	this.y=y*m;
	this.minSpeed				= 5;
	this.fireLoadTime			= 1.5;
	this.fireLoadTimeCrnt		= 0;
	this.healingTime			= 20;
	this.healingTimeCrnt		= 0;
	this.maxHealth				= 30;
	this.health = this.maxHealth;
	// ai stuff
	this.fov = {
		"start"	: Math.PI/3,
		"end"	: Math.PI*2-Math.PI/3,
		"length": 225,
	}
	this.enemies = enemies;
	this.targetEnemy;
	this.attackAngleMargin = Math.PI/3;
	this.size=10;
	this.velocity={
		// meters per second
		"speed": 0 *m,
		"motion": Math.PI/2,
	}
	this.thrust = (t) => 0.1+Math.sqrt(t/100);
	this.rotLeft = (x)=>{
		this.velocity.motion += x;
	}
	this.rotRight = (x)=>{
		this.velocity.motion -= x;
	}
	this.step=(ms)=>{
		// replenish the ability to fire bullets and heal
		this.fireLoadTimeCrnt+=ms*0.01;
		this.healingTimeCrnt+=ms*0.01;

		if( this.healingTimeCrnt>this.healingTime && this.health<this.maxHealth )
			this.health+=2*0.01*ms
		// this is the change in position the entity makes in "ms" milliseconds
		// reset the motion between 0 and 2PI
		this.velocity.motion = (this.velocity.motion+2*Math.PI)%(Math.PI*2);
		// drag calculation
		this.velocity.speed*=map.drag;
		if (this.velocity.speed<this.minSpeed) {
			this.velocity.speed=this.minSpeed;
		}
		// update the (x,y) coordinate
		this.x += (this.velocity.speed*Math.cos(this.velocity.motion))*(0.01*ms)+map.gravity.left*ms;
		this.y += (this.velocity.speed*Math.sin(this.velocity.motion))*(0.01*ms)+map.gravity.down*ms;
		// add wind effects
		this.x+=windX(this.x,this.y,performance.now()*0.01);
		this.y+=windY(this.x,this.y,performance.now()*0.01);
	}
	this.draw=()=>{
		ctx.fillStyle=this.color;
		triag(this.x,this.y,this.velocity.motion,this.size);
		triag(this.x-map.width,this.y,this.velocity.motion,this.size);
		triag(this.x+map.width,this.y,this.velocity.motion,this.size);
	}
	this.damage=(dmg)=>{
		this.healingTimeCrnt=0;
		this.health-=dmg;
		if(this.health<=0){
			// remove plane from entity array
			var ind = e.findIndex( i => i.id==this.id );
			e.splice(ind,1);
//			e.push(
//				Math.random()*map.width,
//				Math.random()*map.height,
//				clralt,
//				e[0].id
//			)
		}
	}
	this.fire=()=>{
		this.healingTimeCrnt=0;
		// do not fire if the plane is not ready yet
		if(this.fireLoadTimeCrnt<this.fireLoadTime)
			return;
		else
			this.fireLoadTimeCrnt=0;
		// Bullet (owner,x=0,y=0,exp=10,dmg=1, motion=0,speed=10){
		bl.push( new Bullet(
			this.id,				// owner
			this.guilde,
			this.x, this.y,			// position
			40,						// epiration
			10,						// damage
			this.velocity.motion,	// motion/direction
			this.velocity.speed+20,	// speed
		))
	}
	this.ai=(dt)=>{
		if(!this.npc)
			return;

		// filter all the planes which are inside the fov
		const spotted = e.filter( i=>{
			const inDistance = Math.hypot( i.x-this.x,i.y-this.y ) < this.fov.length;
			var angle = Math.atan2( i.y-this.y,i.x-this.x );
			if( angle<0 ){
				angle=2*Math.PI-angle;
			}
			const inAngle = (this.fov.start+this.velocity.motion)%(Math.PI*2) < angle < (this.fov.end+this.velocity.motion)%(Math.PI*2);
			return inDistance && inAngle;
		});
		// this is a list of all enemies which are in the view of this plane
		const spottedEnemies = spotted.filter( i=>this.enemies.indexOf(i.id)!=-1 || this.guilde!=i.guilde );

		if(spottedEnemies.length>0){
			// set one of the enemies as a target
			if (e.findIndex(i=>i.id==this.targetEnemy)!=-1)
				this.tagetEnemy = undefined;
			if(this.targetEnemy==undefined)
				this.targetEnemy = spottedEnemies[Math.floor(spottedEnemies.length*Math.random())].id;
			// follow the target
			var indOfTgt = e.findIndex( j => j.id==this.targetEnemy );
			if (indOfTgt==-1)
				return;
			var angleToTgt = ( Math.atan2(e[indOfTgt].y-this.y, e[indOfTgt].x-this.x)+2*Math.PI )%(Math.PI*2);
			if( this.velocity.motion<angleToTgt )
				this.rotLeft(0.1);
			if( this.velocity.motion>angleToTgt )
				this.rotRight(0.1);
			// attack the target
			if( this.attackAngleMargin < angleToTgt < this.attackAngleMargin )
				this.fire();
		}else{
			this.targetEnemy = undefined;
		}

		this.velocity.speed=20;
	}
	this.collision=()=>{
		if(this.y<map.waterLevel){
			if( this.velocity.motion>Math.PI/2 && this.velocity.motion<Math.PI*(3/2) ){
				this.velocity.motion -= 0.1;//Math.cos(elem.velocity.motion)*0.25;
			}else{
				this.velocity.motion += 0.1;//Math.cos(elem.velocity.motion)*0.25;
			}
			this.y+=1;
		}
		if(this.y>map.skyLevel){
			if( this.velocity.motion>Math.PI/2 && this.velocity.motion<Math.PI*(3/2) ){
				this.velocity.motion += 0.1;//Math.cos(elem.velocity.motion)*0.25;
			}else{
				this.velocity.motion -= 0.1;//Math.cos(elem.velocity.motion)*0.25;
			}
		}
	}
}

const triag=(x,y,angle,s)=>{
	ctx.beginPath();
	ctx.moveTo(
		(x-cam.x+	s*Math.cos(-angle))*(1/cam.zoom),
		(-y-cam.y+	s*Math.sin(-angle))*(1/cam.zoom)
	)
	ctx.lineTo(
		(x-cam.x+	s*Math.cos(-angle+Math.PI*(3/4)))*(1/cam.zoom),
		(-y-cam.y+	s*Math.sin(-angle+Math.PI*(3/4)))*(1/cam.zoom)
	)
	ctx.lineTo(
		(x-cam.x+	s*Math.cos(-angle-Math.PI*(3/4)))*(1/cam.zoom),
		(-y-cam.y+	s*Math.sin(-angle-Math.PI*(3/4)))*(1/cam.zoom)
	)
	ctx.fill();
}

function Cloud (x=0,y=0,z=0){
	this.x=x;
	this.y=y;
	this.z=z;
	this.id=Math.floor(Math.random()*4);
	this.img=new Image();
	this.img.src=`img/cloud_${this.id}.png`;
	this.step=(ms)=>{
		//this.x+=0.1*ms*0.01;
		this.x+=windX(this.x,this.y,performance.now()*0.01);
		this.y+=windY(this.x,this.y,performance.now()*0.01);

		this.x=this.x%map.width;
		if(this.x<0)
			this.x+=map.width;
	}
	this.draw=()=>{
		ctx.globalCompositeOperation = "lighten";
		ctx.drawImage(
			this.img,
			((this.x-cam.x)*(250/(250+this.z)))*(1/cam.zoom),
			((this.y-cam.y)*(250/(250+this.z)))*(1/cam.zoom),
			this.img.width*(1/cam.zoom),
			this.img.height*(1/cam.zoom),
		);
		ctx.drawImage(
			this.img,
			((this.x-map.width-cam.x)*(250/(250+this.z)))*(1/cam.zoom),
			((this.y-cam.y)*(250/(250+this.z)))*(1/cam.zoom),
			this.img.width*(1/cam.zoom),
			this.img.height*(1/cam.zoom),
		);
		ctx.drawImage(
			this.img,
			((this.x+map.width-cam.x)*(250/(250+this.z)))*(1/cam.zoom),
			((this.y-cam.y)*(250/(250+this.z)))*(1/cam.zoom),
			this.img.width*(1/cam.zoom),
			this.img.height*(1/cam.zoom),
		);
		ctx.globalCompositeOperation = "source-over";
	}
}

function Bullet (owner,ownerGuilde,x=0,y=0,exp=10,dmg=1, motion=0,speed=10){
	this.id=Math.round(Math.random()*1000000);
	this.ownerGuilde=ownerGuilde;
	this.owner=owner;
	this.x=x;
	this.y=y;
	this.expiration=exp;
	this.time=0;
	this.dmg=dmg;
	this.size=10;
	this.velocity={
		"speed":speed,
		"motion":motion
	}
	this.draw=()=>{
		ctx.fillStyle=clrhl1;
		ctx.fillRect(
			(this.x-cam.x)*(1/cam.zoom),
			(-this.y-cam.y)*(1/cam.zoom),
			this.size*(1/cam.zoom),
			this.size*(1/cam.zoom)
		)
		ctx.fillRect(
			(this.x-map.width-cam.x)*(1/cam.zoom),
			(-this.y-cam.y)*(1/cam.zoom),
			this.size*(1/cam.zoom),
			this.size*(1/cam.zoom)
		)
		ctx.fillRect(
			(this.x+map.width-cam.x)*(1/cam.zoom),
			(-this.y-cam.y)*(1/cam.zoom),
			this.size*(1/cam.zoom),
			this.size*(1/cam.zoom)
		)
	}
	this.step=(ms)=>{
		this.x += (this.velocity.speed*Math.cos(this.velocity.motion))*(0.01*ms)+map.gravity.left*ms;
		this.y += (this.velocity.speed*Math.sin(this.velocity.motion))*(0.01*ms)+map.gravity.down*ms;
	}
	this.collision=(entities)=>{
		// detect all collisions
		var cls = entities.filter( i => i.x-i.size/2<this.x+this.size/2 && i.x+i.size/2>this.x-this.size/2 && i.y-i.size/2<this.y+this.size/2 && i.y+i.size/2>this.y-this.size/2 && this.owner!=i.id );
		// give damage to all the colliding entities
		cls.map( i =>{
			var ind = e.findIndex( j => j.id==i.id );
			if( e[ind].guilde!=this.ownerGuilde || e[ind].guilde==undefined){
				e[ind].damage(this.dmg);
				var bl_ind = bl.findIndex( j => j.id==this.id );
				bl.splice(bl_ind,1);
			}
		});
	}
}

const windX = (x,y,t) => 0.2;
const windY = (x,y,t) => -Math.sin(x/30+t/10000)/20;

const controls = (entity,deltaTime)=>{
	if(key[" "]||key["x"]){
		// fire a bullet
		e[0].fire();
	}
	if(key["ArrowUp"]){
		e[0].thrustTime+=deltaTime*0.01;
		entity.velocity.speed+=entity.thrust(e[0].thrustTime);
	}else{
		e[0].thrustTime=0;
	}
	if(key["ArrowLeft"]){
		entity.rotLeft(0.05);
	}
	if(key["ArrowRight"]){
		entity.rotRight(0.05);
	}
}

const guiDraw = ()=>{
	ctx.fillStyle="#000000";
	ctx.fillText(`${Math.round(e[0].velocity.speed)} m/h | pos:(${Math.round(e[0].x)},${Math.round(e[0].y)}) wind: y=${Math.round(windY(e[0].x,e[0].y,performance.now())*100)/100}\nplanes: ${e.length}`, 10, 10);
	ctx.beginPath();
	ctx.moveTo(20,30);
	ctx.lineTo(20+10*Math.cos(e[0].velocity.motion),30+10*-Math.sin(e[0].velocity.motion));
	ctx.stroke();
	ctx.fillStyle=clrhl3;
	ctx.fillRect(0,c.height-10,60,6);
	ctx.fillStyle=clrfg;
	ctx.fillRect(0,c.height-10,60*(e[0].health/e[0].maxHealth),6);
}

const fullscreen=(el)=>{
	if(el.webkitRequestFullScreen) {
        el.webkitRequestFullScreen();
    }
    else {
        el.mozRequestFullScreen();
    }
}

// lastTime = time of the last time the update was executes
var lastTime = performance.now();
// difference in milliseconds since last update
var deltaTime = 0;

const update = ()=>{
	// clear screen
	ctx.clearRect(0,0,c.width,c.height);
	// update thr delta time
	deltaTime = performance.now()-lastTime;
	//
	// set the first plane in the array to be the player
	if(e.length>0){
		e[0].color = clrfg;
		e[0].guilde = undefined;
		e[0].npc=false;
		e.map( i=>{
			if( i.enemies.indexOf(e[0].id)==-1 )
				i.enemies.push(e[0].id);
		})
	}
	//
	// draw the clouds
	cl.forEach( elem=>{
		elem.draw();
		elem.step(deltaTime);
	});

	// player controls
	controls(e[0],deltaTime);
	// update camera
	cam.x = e[0].x-(c.width/2)*(cam.zoom);
	cam.y = -e[0].y-(c.height/2)*(cam.zoom);
	// draw/update all bullets
	bl.forEach( (elem,i)=>{
		elem.time+=deltaTime*0.01;
		if(elem.time>elem.expiration){
			bl.splice(i,1);
		}
		elem.draw();
		elem.step(deltaTime);
		elem.collision(e);
	});
	// update all entities
	e.forEach( elem=>{
		elem.step(deltaTime);
		elem.draw();
		elem.ai();
		// loop the map around after reaching the map limit
		elem.x = elem.x>0?elem.x % map.width:map.width;
		// give damage and move the plane back up when hitting the water
		elem.collision();
	});

	// draw the water
	ctx.fillStyle=clrhl2;
	ctx.fillRect(
		0,
		(-map.waterLevel-cam.y)*(1/cam.zoom),
		c.width,
		(c.height-cam.y)*(1/cam.zoom),
	);
	// draw the sky
	ctx.fillRect(
		0,
		(-map.skyLevel+2*(map.height-map.skyLevel)-cam.y-c.height)*(1/cam.zoom),
		c.width,
		(-map.skyLevel+2*(map.height-map.skyLevel)-cam.y)*(1/cam.zoom),
	);

	guiDraw();

	//
	lastTime = performance.now();
	requestAnimationFrame(update);
}
update();
