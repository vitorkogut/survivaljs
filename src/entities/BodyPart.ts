import { Graphics } from "pixi.js";

export interface BodyPartConfig {
    readonly name: string;
    readonly x: number; // offset relativo ao torso
    readonly y: number;
    readonly width: number;
    readonly height: number;
    readonly color: number;
}

export default class BodyPart {
    readonly name: string;
    readonly view: Graphics;
    readonly x: number;
    readonly y: number;
    readonly width: number;
    readonly height: number;

    constructor(config: BodyPartConfig) {
        this.name = config.name;
        this.x = config.x;
        this.y = config.y;
        this.width = config.width;
        this.height = config.height;

        this.view = new Graphics()
            .rect(0, 0, config.width, config.height)
            .fill(config.color);
    }

    // AABB em coordenadas de mundo (dado que o player está em x,y)
    getWorldAABB(playerX: number, playerY: number) {
        const worldX = playerX + this.x;
        const worldY = playerY + this.y;
        return {
            x: worldX,
            y: worldY,
            width: this.width,
            height: this.height,
            right: worldX + this.width,
            bottom: worldY + this.height,
        };
    }

    // check se um ponto intersecta essa parte
    contains(x: number, y: number, playerX: number, playerY: number): boolean {
        const aabb = this.getWorldAABB(playerX, playerY);
        return x >= aabb.x && x < aabb.right && y >= aabb.y && y < aabb.bottom;
    }
}
