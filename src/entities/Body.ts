import { Graphics } from "pixi.js";
import Entity from "./Entity.js";

export const GRAVITY_FORCE = 0.6;

export default class Body extends Entity {
    x: number;
    y: number;
    readonly width: number;
    height: number;

    vx = 0;
    vy = 0;

    gravity = true;
    grounded = false;
    touchingWallLeft = false;
    touchingWallRight = false;

    gravityScale = 1;

    override readonly view: Graphics;

    constructor(x: number, y: number, width: number, height: number, color = 0xffffff) {
        super();

        this.x = x;
        this.y = y;
        this.width = width;
        this.height = height;

        this.view = new Graphics().rect(0, 0, width, height).fill(color);
        this.view.position.set(x, y);
    }

    get right(): number {
        return this.x + this.width;
    }

    get bottom(): number {
        return this.y + this.height;
    }

    // limites de colisão — subclasses com rotação sobrescrevem estes
    get colX(): number { return this.x; }
    get colY(): number { return this.y; }
    get colRight(): number { return this.x + this.width; }
    get colBottom(): number { return this.y + this.height; }

    applyGravity(dt: number): void {
        if (this.gravity) {
            this.vy += GRAVITY_FORCE * this.gravityScale * dt;
        }
    }

    integrateX(dt: number): void {
        this.touchingWallLeft = false;
        this.touchingWallRight = false;
        this.x += this.vx * dt;
    }

    integrateY(dt: number): void {
        this.y += this.vy * dt;
    }

    override draw(): void {
        this.view.position.set(this.x, this.y);
    }

    intersects(other: Body): boolean {
        return (
            this.colX < other.colRight &&
            this.colRight > other.colX &&
            this.colY < other.colBottom &&
            this.colBottom > other.colY
        );
    }
}
