#include <math.h>
#include <stdlib.h>

double clampd(double v, double a, double b) {
    if (v < a) return a;
    if (v > b) return b;
    return v;
}

double dist2d(double ax, double ay, double bx, double by) {
    double dx = ax - bx;
    double dy = ay - by;
    return sqrt(dx*dx + dy*dy);
}

/* Simple AABB intersection */
int aabb_intersect(double ax, double ay, double aw, double ah, double bx, double by, double bw, double bh) {
    return !(ax+aw < bx || ax > bx+bw || ay+ah < by || ay > by+bh);
}