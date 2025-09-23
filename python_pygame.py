import pygame, sys, random, math
pygame.init()
W, H = 1024, 640
screen = pygame.display.set_mode((W,H))
clock = pygame.time.Clock()

def rnd(a,b): return random.uniform(a,b)
def rndi(a,b): return random.randint(a,b)

class Player:
    def __init__(self):
        self.w, self.h = 28,28
        self.x = W/2 - self.w/2
        self.y = H/2 - self.h/2
        self.vx = 0; self.vy = 0
        self.speed = 280
        self.lives = 3
        self.score = 0
        self.inv = 0
    def rect(self): return pygame.Rect(self.x,self.y,self.w,self.h)
    def update(self, dt, keys):
        ax = 0; ay = 0
        if keys[pygame.K_w]: ay -= 1
        if keys[pygame.K_s]: ay += 1
        if keys[pygame.K_a]: ax -= 1
        if keys[pygame.K_d]: ax += 1
        l = math.hypot(ax,ay) or 1
        self.vx = (ax/l)*self.speed; self.vy = (ay/l)*self.speed
        self.x += self.vx*dt; self.y += self.vy*dt
        self.x = max(2,min(self.x,W-self.w-2))
        self.y = max(2,min(self.y,H-self.h-2))
        if self.inv>0: self.inv -= dt
    def draw(self,surf):
        c=(126,242,184) if self.inv<=0 else (200,200,200)
        pygame.draw.rect(surf, c, (self.x,self.y,self.w,self.h))

class Bullet:
    def __init__(self,x,y,vx,vy,owner):
        self.x,self.y = x,y; self.vx, self.vy = vx,vy
        self.w,self.h = 12,12; self.owner = owner; self.life = 2.2
    def rect(self): return pygame.Rect(self.x,self.y,self.w,self.h)
    def update(self,dt):
        self.x += self.vx*dt; self.y += self.vy*dt; self.life -= dt
    def draw(self,surf):
        pygame.draw.ellipse(surf,(255,217,90),(self.x,self.y,self.w,self.h))

player = Player()
bullets = []
enemies = []
pickups = []
spawn_timer = 0

def spawn_enemy():
    edge = rndi(0,3)
    if edge==0: x = rnd(20,W-20); y = -40
    elif edge==1: x = rnd(20,W-20); y = H+40
    elif edge==2: x = -40; y = rnd(20,H-20)
    else: x = W+40; y = rnd(20,H-20)
    enemies.append([x,y,26,26,'basic',1])

def spawn_pickup():
    x = rnd(64,W-64); y = rnd(64,H-64)
    pickups.append([x,y,18,18,30])

for _ in range(3): spawn_enemy()
for _ in range(4): spawn_pickup()

running = True
while running:
    dt = clock.tick(60)/1000.0
    for ev in pygame.event.get():
        if ev.type==pygame.QUIT: running=False
        if ev.type==pygame.MOUSEBUTTONDOWN and ev.button==1:
            mx,my = pygame.mouse.get_pos()
            angle = math.atan2(my - (player.y+player.h/2), mx - (player.x+player.w/2))
            bx = player.x + player.w/2 + math.cos(angle)*(player.w/2+6)
            by = player.y + player.h/2 + math.sin(angle)*(player.h/2+6)
            bullets.append(Bullet(bx,by,math.cos(angle)*620, math.sin(angle)*620,'player'))
    keys = pygame.key.get_pressed()
    player.update(dt, keys)

    # update bullets
    for b in bullets: b.update(dt)
    bullets = [b for b in bullets if b.life>0 and -50<b.x<W+50 and -50<b.y<H+50]

    # update enemies simple
    for e in enemies:
        dx = (player.x+player.w/2) - (e[0]+e[2]/2)
        dy = (player.y+player.h/2) - (e[1]+e[3]/2)
        d = math.hypot(dx,dy) or 1
        if d < 300:
            e[0] += (dx/d)*110*dt
            e[1] += (dy/d)*110*dt
        else:
            ang = random.random()*6.28
            e[0] += math.cos(ang)*40*dt
            e[1] += math.sin(ang)*40*dt

    # collisions
    # bullets vs enemies
    for b in bullets:
        for e in enemies:
            br = pygame.Rect(b.x,b.y,b.w,b.h)
            er = pygame.Rect(e[0],e[1],e[2],e[3])
            if br.colliderect(er) and b.owner=='player':
                try:
                    bullets.remove(b)
                except:
                    pass
                try:
                    enemies.remove(e)
                    player.score += 6
                except:
                    pass

    # player vs pickups
    pr = player.rect()
    for p in pickups:
        r = pygame.Rect(p[0],p[1],p[2],p[3])
        if pr.colliderect(r):
            try:
                pickups.remove(p)
                player.score += 8
            except:
                pass

    # spawn logic
    spawn_timer -= dt
    if spawn_timer <= 0:
        if len(enemies) < 6: spawn_enemy()
        if random.random() < 0.35: spawn_pickup()
        spawn_timer = rnd(1.0, 2.0)

    # draw
    screen.fill((7,17,26))
    for x in range(0,W,32): pygame.draw.line(screen,(255,255,255,12),(x,0),(x,H))
    for y in range(0,H,32): pygame.draw.line(screen,(255,255,255,12),(0,y),(W,y))

    for b in bullets: b.draw(screen)
    for e in enemies: pygame.draw.rect(screen,(255,100,100),(e[0],e[1],e[2],e[3]))
    for p in pickups: pygame.draw.ellipse(screen,(102,217,255),(p[0],p[1],p[2],p[3]))
    player.draw(screen)

    # HUD
    font = pygame.font.SysFont(None, 24)
    surf = font.render(f"Score: {player.score}  Lives: {player.lives}", True, (200,200,200))
    screen.blit(surf, (8,8))

    pygame.display.flip()

pygame.quit()
sys.exit()