#include <iostream>
#include <vector>
#include <chrono>
#include <thread>
#include <cmath>
#include <cstdlib>
#include <algorithm>

static const int SCREEN_W = 80;
static const int SCREEN_H = 24;

struct Vec2 { int x, y; };
struct Entity { Vec2 pos; char icon; bool dead=false; };

struct Player : public Entity {
    Player() { pos={SCREEN_W/2, SCREEN_H/2}; icon='@'; }
};

struct Bullet : public Entity {
    Vec2 vel;
    Bullet(int x,int y,int vx,int vy) { pos={x,y}; vel={vx,vy}; icon='*'; }
    void update() { pos.x += vel.x; pos.y += vel.y; if(pos.x<0||pos.x>=SCREEN_W||pos.y<0||pos.y>=SCREEN_H) dead=true; }
};

struct World {
    Player player;
    std::vector<Bullet> bullets;

    void update() {
        for(auto &b: bullets) b.update();
        bullets.erase(
            std::remove_if(bullets.begin(), bullets.end(),
                           [](Bullet &b){ return b.dead; }),
            bullets.end()
        );

    }

    void draw() {
        std::vector<std::string> screen(SCREEN_H,std::string(SCREEN_W,' '));
        screen[player.pos.y][player.pos.x] = player.icon;
        for(auto &b: bullets) if(b.pos.y>=0 && b.pos.y<SCREEN_H && b.pos.x>=0 && b.pos.x<SCREEN_W) screen[b.pos.y][b.pos.x]=b.icon;

        std::cout << "\033[H"; // move cursor to top-left
        for(auto &line : screen) std::cout << line << "\n";
        std::cout.flush();
    }

    void fire() { bullets.push_back(Bullet(player.pos.x,player.pos.y,1,0)); }
};

int main() {
    World world;
    auto last = std::chrono::high_resolution_clock::now();
    bool running=true;
    std::cout << "\033[2J"; // clear terminal

    while(running) {
        auto now = std::chrono::high_resolution_clock::now();
        double dt = std::chrono::duration<double>(now-last).count();
        last = now;

        // simple input
        if(std::rand()%10<1) world.fire(); // automatic bullets for demo

        world.update();
        world.draw();

        std::this_thread::sleep_for(std::chrono::milliseconds(50)); // ~20 FPS
    }
}