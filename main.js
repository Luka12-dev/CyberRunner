const canvas = document.getElementById('game-canvas');
const ctx = canvas.getContext('2d', { alpha: false });

const UI = {
  score: document.getElementById('score'),
  lives: document.getElementById('lives'),
  level: document.getElementById('level'),
  btnStart: document.getElementById('btn-start'),
  btnPause: document.getElementById('btn-pause'),
  vol: document.getElementById('vol'),
};

const WIDTH = canvas.width;
const HEIGHT = canvas.height;

function clamp(v, a, b) { return Math.max(a, Math.min(b, v)); }
function rand(min, max) { return Math.random() * (max - min) + min; }
function randInt(min, max) { return Math.floor(rand(min, max+1)); }
function dist(ax, ay, bx, by) { return Math.hypot(ax-bx, ay-by); }
function now() { return performance.now(); }

const Input = {
  keys: new Set(),
  mouse: { x:0, y:0, down:false },
};
window.addEventListener('keydown', e => { Input.keys.add(e.key); });
window.addEventListener('keyup', e => { Input.keys.delete(e.key); });
canvas.addEventListener('mousemove', e => {
  const r = canvas.getBoundingClientRect();
  Input.mouse.x = (e.clientX - r.left) * (canvas.width / r.width);
  Input.mouse.y = (e.clientY - r.top) * (canvas.height / r.height);
});
canvas.addEventListener('mousedown', e => { Input.mouse.down = true; });
canvas.addEventListener('mouseup', e => { Input.mouse.down = false; });

const AudioEngine = {
  volume: 0.5,
  beep(freq=440, dur=0.06) {
    try {
      if(!this.ctx) {
        this.ctx = new (window.AudioContext || window.webkitAudioContext)();
      }
      const o = this.ctx.createOscillator();
      const g = this.ctx.createGain();
      o.type = 'sawtooth';
      o.frequency.value = freq;
      g.gain.value = this.volume * 0.06;
      o.connect(g); g.connect(this.ctx.destination);
      o.start();
      o.stop(this.ctx.currentTime + dur);
    } catch(e) {}
  }
};
UI.vol.addEventListener('input', e => { AudioEngine.volume = parseFloat(e.target.value); });

const CONFIG = {
  playerSpeed: 280,
  bulletSpeed: 620,
  enemySpeed: 110,
  spawnMargin: 36,
  tileSize: 32,
  maxParticles: 600,
  DEBUG: false,
};

class Entity {
  constructor(x=0,y=0,w=16,h=16) {
    this.x = x; this.y = y; this.w = w; this.h = h;
    this.vx = 0; this.vy = 0;
    this.dead = false;
    this.tags = new Set();
  }
  update(dt) {}
  draw(ctx) {}
  intersects(other) {
    return !(this.x+this.w < other.x || this.x > other.x+other.w || this.y+this.h < other.y || this.y > other.y+other.h);
  }
}

class Player extends Entity {
  constructor(x,y) {
    super(x,y,28,28);
    this.speed = CONFIG.playerSpeed;
    this.color = '#7ef2b8';
    this.shootCooldown = 0;
    this.lives = 3;
    this.score = 0;
    this.invuln = 0;
  }
  update(dt, world) {
    // movement
    let ax = 0, ay = 0;
    if (Input.keys.has('w') || Input.keys.has('ArrowUp')) ay -= 1;
    if (Input.keys.has('s') || Input.keys.has('ArrowDown')) ay += 1;
    if (Input.keys.has('a') || Input.keys.has('ArrowLeft')) ax -= 1;
    if (Input.keys.has('d') || Input.keys.has('ArrowRight')) ax += 1;
    // normalize
    const len = Math.hypot(ax, ay) || 1;
    this.vx = (ax/len) * this.speed;
    this.vy = (ay/len) * this.speed;
    this.x += this.vx * dt;
    this.y += this.vy * dt;
    // clamp to world bounds
    this.x = clamp(this.x, 2, world.w - this.w - 2);
    this.y = clamp(this.y, 2, world.h - this.h - 2);
    // shooting towards mouse
    this.shootCooldown -= dt;
    if (Input.mouse.down && this.shootCooldown <= 0) {
      const aimX = Input.mouse.x;
      const aimY = Input.mouse.y;
      const angle = Math.atan2(aimY - (this.y + this.h/2), aimX - (this.x + this.w/2));
      const bx = this.x + this.w/2 + Math.cos(angle) * (this.w/2 + 6);
      const by = this.y + this.h/2 + Math.sin(angle) * (this.h/2 + 6);
      const b = new Bullet(bx, by, Math.cos(angle) * CONFIG.bulletSpeed, Math.sin(angle) * CONFIG.bulletSpeed, 'player');
      world.spawn(b);
      this.shootCooldown = 0.12;
      AudioEngine.beep(900, 0.03);
    }
    if (this.invuln > 0) this.invuln -= dt;
  }
  draw(ctx) {
    ctx.save();
    ctx.translate(this.x + this.w/2, this.y + this.h/2);
    // pulsate when invulnerable
    const pulse = (this.invuln > 0) ? 1 + Math.sin(now()/60)/6 : 1;
    ctx.scale(pulse, pulse);
    ctx.fillStyle = this.color;
    roundRect(ctx, -this.w/2, -this.h/2, this.w, this.h, 6);
    ctx.fill();
    ctx.restore();
    // face towards mouse
    if (CONFIG.DEBUG) {
      ctx.fillStyle = 'rgba(255,255,255,0.1)';
      ctx.fillRect(this.x-1, this.y-1, this.w+2, this.h+2);
    }
  }
}

class Bullet extends Entity {
  constructor(x,y,vx,vy,owner='enemy') {
    super(x-6,y-6,12,12);
    this.vx = vx; this.vy = vy;
    this.owner = owner;
    this.life = 2.2;
    this.color = owner === 'player' ? '#ffd95a' : '#ff6b6b';
    this.tags.add('bullet');
  }
  update(dt, world) {
    this.x += this.vx * dt;
    this.y += this.vy * dt;
    this.life -= dt;
    if (this.life <= 0) this.dead = true;
    // if out of bounds -> die
    if (this.x < -50 || this.x > world.w + 50 || this.y < -50 || this.y > world.h + 50) this.dead = true;
  }
  draw(ctx) {
    ctx.fillStyle = this.color;
    ctx.beginPath();
    ctx.arc(this.x + this.w/2, this.y + this.h/2, this.w/2, 0, Math.PI*2);
    ctx.fill();
  }
}

class Enemy extends Entity {
  constructor(x,y,type='basic') {
    super(x,y,26,26);
    this.type = type;
    this.color = (type==='charger')? '#ff9f43' : '#ff6b6b';
    this.speed = CONFIG.enemySpeed * (type==='charger'?1.4:1);
    this.health = (type==='tank')? 3 : 1;
    this.fireCooldown = rand(0.5, 1.6);
    this.patrolAngle = rand(0, Math.PI*2);
    this.tags.add('enemy');
    this.target = null;
  }
  update(dt, world) {
    const player = world.player;
    if(!player) return;
    // Simple AI: if near, move towards player; else patrol
    const dx = (player.x + player.w/2) - (this.x + this.w/2);
    const dy = (player.y + player.h/2) - (this.y + this.h/2);
    const d = Math.hypot(dx, dy);
    if (d < 300) {
      // pursue
      this.vx = (dx/d) * this.speed;
      this.vy = (dy/d) * this.speed;
      // shoot occasionally if in range
      if (d < 420) {
        this.fireCooldown -= dt;
        if (this.fireCooldown <= 0) {
          const angle = Math.atan2(dy, dx);
          const bx = this.x + this.w/2 + Math.cos(angle) * (this.w/2 + 6);
          const by = this.y + this.h/2 + Math.sin(angle) * (this.h/2 + 6);
          const b = new Bullet(bx, by, Math.cos(angle) * (CONFIG.bulletSpeed*0.72), Math.sin(angle) * (CONFIG.bulletSpeed*0.72), 'enemy');
          world.spawn(b);
          this.fireCooldown = rand(0.6, 1.6);
        }
      }
    } else {
      // patrol
      this.patrolAngle += dt * 0.8;
      this.vx = Math.cos(this.patrolAngle) * (this.speed * 0.6);
      this.vy = Math.sin(this.patrolAngle) * (this.speed * 0.6);
    }
    // apply movement
    this.x += this.vx * dt;
    this.y += this.vy * dt;
    // keep within bounds
    if (this.x < 8) this.x = 8;
    if (this.y < 8) this.y = 8;
    if (this.x > world.w - this.w - 8) this.x = world.w - this.w - 8;
    if (this.y > world.h - this.h - 8) this.y = world.h - this.h - 8;
  }
  draw(ctx) {
    ctx.save();
    ctx.translate(this.x + this.w/2, this.y + this.h/2);
    const scale = 1 + Math.sin(now()/150 + (this.x+this.y)/50)*0.03;
    ctx.scale(scale, scale);
    ctx.fillStyle = this.color;
    roundRect(ctx, -this.w/2, -this.h/2, this.w, this.h, 4);
    ctx.fill();
    ctx.restore();
    if (CONFIG.DEBUG) {
      ctx.strokeStyle = 'rgba(255,255,255,0.06)';
      ctx.strokeRect(this.x, this.y, this.w, this.h);
    }
  }
}

class Pickup extends Entity {
  constructor(x,y) {
    super(x,y,18,18);
    this.color = '#66d9ff';
    this.tags.add('pickup');
    this.angle = rand(0,Math.PI*2);
    this.ttl = 30;
  }
  update(dt) {
    this.angle += dt * 3.2;
    this.ttl -= dt;
    if (this.ttl <= 0) this.dead = true;
  }
  draw(ctx) {
    ctx.save();
    ctx.translate(this.x + this.w/2, this.y + this.h/2);
    ctx.rotate(this.angle);
    ctx.fillStyle = this.color;
    ctx.beginPath();
    ctx.ellipse(0,0,this.w/2, this.h/2, 0, 0, Math.PI*2);
    ctx.fill();
    ctx.restore();
  }
}

class Particle extends Entity {
  constructor(x,y,vx,vy,life=0.6,color='#fff',size=4) {
    super(x-size/2,y-size/2,size,size);
    this.vx = vx; this.vy = vy;
    this.life = life;
    this.color = color;
    this.age = 0;
  }
  update(dt) {
    this.age += dt;
    this.x += this.vx * dt;
    this.y += this.vy * dt;
    if (this.age >= this.life) this.dead = true;
  }
  draw(ctx) {
    const t = clamp(1 - (this.age / this.life), 0, 1);
    ctx.globalAlpha = t;
    roundRect(ctx, this.x, this.y, this.w, this.h, 2);
    ctx.fillStyle = this.color;
    ctx.fill();
    ctx.globalAlpha = 1;
  }
}

class World {
  constructor(w,h) {
    this.w = w; this.h = h;
    this.entities = [];
    this.toSpawn = [];
    this.player = null;
    this.level = 1;
    this.time = 0;
    this.paused = false;
    this.spawnTimer = 0;
    this.particles = [];
    this.maxEnemies = 6;
  }
  spawn(e) { this.toSpawn.push(e); }
  init() {
    // clear and spawn player
    this.entities = [];
    this.player = new Player(this.w/2 - 14, this.h/2 - 14);
    this.entities.push(this.player);
    // spawn initial pickups and enemies
    for (let i=0;i<4;i++) this.spawnRandomPickup();
    for (let i=0;i<Math.min(3, this.level+1); i++) this.spawnRandomEnemy();
    this.time = 0;
    this.spawnTimer = 0;
    this.maxEnemies = 4 + Math.floor(this.level * 1.2);
  }
  spawnRandomEnemy() {
    const edge = randInt(0,3);
    let x,y;
    if (edge===0) { x = rand(20, this.w-20); y = -40; }
    if (edge===1) { x = rand(20, this.w-20); y = this.h+40; }
    if (edge===2) { x = -40; y = rand(20, this.h-20); }
    if (edge===3) { x = this.w+40; y = rand(20, this.h-20); }
    const types = ['basic','charger','tank'];
    const t = types[randInt(0, types.length-1)];
    const e = new Enemy(x,y,t);
    this.spawn(e);
  }
  spawnRandomPickup() {
    const x = rand(64, this.w-64);
    const y = rand(64, this.h-64);
    const p = new Pickup(x,y);
    this.spawn(p);
  }
  spawnParticles(x,y,count=12,color='#fff') {
    for (let i=0;i<count;i++) {
      const ang = rand(0, Math.PI*2);
      const sp = rand(40, 260);
      const vx = Math.cos(ang) * sp;
      const vy = Math.sin(ang) * sp;
      const pt = new Particle(x, y, vx, vy, rand(0.3,1.0), color, randInt(2,8));
      this.particles.push(pt);
    }
    // trim
    if (this.particles.length > CONFIG.maxParticles) {
      this.particles.splice(0, this.particles.length - CONFIG.maxParticles);
    }
  }
  update(dt) {
    if (this.paused) return;
    this.time += dt;
    // spawn queued entities
    if (this.toSpawn.length) {
      for (const e of this.toSpawn) this.entities.push(e);
      this.toSpawn.length = 0;
    }
    // dynamic spawning of enemies and pickups
    this.spawnTimer -= dt;
    if (this.spawnTimer <= 0) {
      // spawn enemy if fewer than max
      const enemyCount = this.entities.filter(e => e.tags.has('enemy')).length;
      if (enemyCount < this.maxEnemies) {
        this.spawnRandomEnemy();
      }
      // occasionally spawn pickups
      if (Math.random() < 0.4) this.spawnRandomPickup();
      this.spawnTimer = rand(1.0, 2.0);
    }
    // update entities
    for (const e of this.entities) {
      if (!e.dead) {
        e.update(dt, this);
      }
    }
    // update particles
    for (const p of this.particles) {
      if (!p.dead) p.update(dt);
    }
    // collisions:
    this.checkCollisions();
    // sweep dead
    this.entities = this.entities.filter(e => !e.dead);
    this.particles = this.particles.filter(p => !p.dead);
    // level progression
    if (this.player.score >= 40 + (this.level*30)) {
      this.levelUp();
    }
  }
  levelUp() {
    this.level += 1;
    this.player.score = 0;
    this.maxEnemies += 2;
    this.spawnTimer = 0.25;
    // reward pickups
    for (let i=0;i<4;i++) this.spawnRandomPickup();
    AudioEngine.beep(1400, 0.08);
  }
  checkCollisions() {
    const ents = this.entities;
    const len = ents.length;
    for (let i=0;i<len;i++) {
      const a = ents[i];
      if (a.dead) continue;
      // bullets vs others
      if (a.tags.has('bullet')) {
        for (let j=0;j<len;j++) {
          const b = ents[j];
          if (b === a || b.dead) continue;
          // bullet owned by player hits enemy
          if (a.owner === 'player' && b.tags.has('enemy') && a.intersects(b)) {
            b.health -= 1;
            a.dead = true;
            this.spawnParticles(a.x + a.w/2, a.y + a.h/2, 8, '#ffd95a');
            if (b.health <= 0) {
              b.dead = true;
              this.player.score += 6;
              this.spawnParticles(b.x + b.w/2, b.y + b.h/2, 18, '#ff6b6b');
              // possible pickup drop
              if (Math.random() < 0.3) this.spawnRandomPickup();
            }
          }
          // bullet owned by enemy hits player
          if (a.owner === 'enemy' && b === this.player && a.intersects(b)) {
            a.dead = true;
            if (this.player.invuln <= 0) {
              this.player.lives -= 1;
              this.player.invuln = 1.4;
              this.spawnParticles(this.player.x + this.player.w/2, this.player.y + this.player.h/2, 20, '#66d9ff');
              AudioEngine.beep(220, 0.08);
              if (this.player.lives <= 0) {
                this.player.dead = true;
                this.onPlayerDeath();
              }
            }
          }
        }
      }
      // player vs pickups
      if (a === this.player) {
        for (let j=0;j<len;j++) {
          const b = ents[j];
          if (b === a || b.dead) continue;
          if (b.tags.has('pickup') && a.intersects(b)) {
            b.dead = true;
            this.player.score += 8;
            this.player.lives = clamp(this.player.lives + 0, 0, 5); // pickups give score but not direct life, changeable
            this.spawnParticles(b.x + b.w/2, b.y + b.h/2, 14, '#66d9ff');
            AudioEngine.beep(1200, 0.06);
          }
          // player touches enemy
          if (b.tags.has('enemy') && a.intersects(b)) {
            if (this.player.invuln <= 0) {
              this.player.lives -= 1;
              this.player.invuln = 1.2;
              this.spawnParticles(this.player.x + this.player.w/2, this.player.y + this.player.h/2, 24, '#ff9f43');
              if (this.player.lives <= 0) {
                this.player.dead = true;
                this.onPlayerDeath();
              }
            }
          }
        }
      }
    }
  }
  onPlayerDeath() {
    // simple game over: pause and show restart hint
    this.paused = true;
    // spawn explosion
    this.spawnParticles(this.player.x + this.player.w/2, this.player.y + this.player.h/2, 80, '#ff7b7b');
    UI.btnStart.textContent = 'Restart';
  }
  draw(ctx) {
    // background grid
    drawGrid(ctx, this.w, this.h);
    // Entities sorted by y for simple layering
    const arr = this.entities.slice().sort((a,b) => (a.y + a.h) - (b.y + b.h));
    for (const e of arr) e.draw(ctx);
    // draw particles
    for (const p of this.particles) p.draw(ctx);
    // debug
    if (CONFIG.DEBUG) {
      ctx.fillStyle = '#fff';
      ctx.fillText(`Entities: ${this.entities.length}`, 10, 18);
    }
  }
}

function roundRect(ctx, x, y, w, h, r) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
}

function drawGrid(ctx, w, h) {
  const ts = CONFIG.tileSize;
  ctx.fillStyle = '#07111a';
  ctx.fillRect(0,0,w,h);
  ctx.strokeStyle = 'rgba(255,255,255,0.02)';
  ctx.lineWidth = 1;
  for (let x=0;x<w;x+=ts) {
    ctx.beginPath(); ctx.moveTo(x,0); ctx.lineTo(x,h); ctx.stroke();
  }
  for (let y=0;y<h;y+=ts) {
    ctx.beginPath(); ctx.moveTo(0,y); ctx.lineTo(w,y); ctx.stroke();
  }
}

const world = new World(WIDTH, HEIGHT);
let lastT = now();
let accumulator = 0;

function gameTick() {
  const t = now();
  let dt = (t - lastT) / 1000;
  lastT = t;
  dt = clamp(dt, 0, 0.05);
  if (!world.paused) {
    world.update(dt);
  }
  // render
  ctx.clearRect(0,0,WIDTH,HEIGHT);
  world.draw(ctx);
  // UI sync
  UI.score.textContent = `Score: ${Math.floor(world.player?.score || 0)}`;
  UI.lives.textContent = `Lives: ${world.player?.lives ?? 0}`;
  UI.level.textContent = `Level: ${world.level}`;
  requestAnimationFrame(gameTick);
}

UI.btnStart.addEventListener('click', () => {
  world.init();
  world.paused = false;
  UI.btnStart.textContent = 'Restart';
});
UI.btnPause.addEventListener('click', () => {
  world.paused = !world.paused;
  UI.btnPause.textContent = world.paused ? 'Unpause' : 'Pause';
});
canvas.addEventListener('contextmenu', e => e.preventDefault());

// auto-start on load
window.addEventListener('load', () => {
  world.init();
  lastT = now();
  requestAnimationFrame(gameTick);
});

window.addEventListener('keydown', e => {
  if (e.key === 'F1') {
    CONFIG.DEBUG = !CONFIG.DEBUG;
  } else if (e.key === 'F2') {
    saveState();
  } else if (e.key === 'F3') {
    loadState();
  }
});

function saveState() {
  const state = {
    player: { x: world.player.x, y: world.player.y, lives: world.player.lives },
    level: world.level,
    score: world.player.score
  };
  localStorage.setItem('cyber-runner-save', JSON.stringify(state));
  console.log('Saved state', state);
}
function loadState() {
  const s = localStorage.getItem('cyber-runner-save');
  if (!s) return;
  try {
    const state = JSON.parse(s);
    world.init();
    world.player.x = state.player.x;
    world.player.y = state.player.y;
    world.player.lives = state.player.lives;
    world.level = state.level;
    world.player.score = state.score;
    console.log('Loaded state', state);
  } catch(e) {
    console.warn('Failed to load state', e);
  }
}

(function polyRAF() {
  if (!window.requestAnimationFrame) {
    window.requestAnimationFrame = function(cb) { return setTimeout(() => cb(performance.now()), 1000/60); };
  }
})();