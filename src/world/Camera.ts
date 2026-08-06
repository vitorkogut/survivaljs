import type { Container } from "pixi.js";

export default class Camera {
    x = 0;
    y = 0;
    zoom = 1;

    private readonly lookAheadFactor = 0.5;
    private readonly smoothing = 0.1;
    private readonly maxPlayerOffsetFactor = 0.42;
    private readonly minZoom = 0.25;
    private readonly maxZoom = 3;

    constructor(
        private readonly stage: Container,
        private screenWidth: number,
        private screenHeight: number,
        canvas?: HTMLCanvasElement
    ) {
        canvas?.addEventListener("wheel", this.onWheel, { passive: false });
    }

    private readonly onWheel = (event: WheelEvent): void => {
        event.preventDefault();
        const factor = event.deltaY < 0 ? 1.1 : 1 / 1.1;
        this.zoom = Math.max(this.minZoom, Math.min(this.maxZoom, this.zoom * factor));
    };

    resize(width: number, height: number): void {
        this.screenWidth = width;
        this.screenHeight = height;
    }

    update(
        dt: number,
        playerCenterX: number,
        playerCenterY: number,
        worldMouseX: number,
        worldMouseY: number
    ): void {
        const rawTargetX =
            playerCenterX +
            (worldMouseX - playerCenterX) * this.lookAheadFactor;
        const rawTargetY =
            playerCenterY +
            (worldMouseY - playerCenterY) * this.lookAheadFactor;

        const maxOffsetX = (this.screenWidth / this.zoom) * this.maxPlayerOffsetFactor;
        const maxOffsetY = (this.screenHeight / this.zoom) * this.maxPlayerOffsetFactor;
        const targetX = Math.max(playerCenterX - maxOffsetX, Math.min(playerCenterX + maxOffsetX, rawTargetX));
        const targetY = Math.max(playerCenterY - maxOffsetY, Math.min(playerCenterY + maxOffsetY, rawTargetY));

        const factor = 1 - Math.pow(1 - this.smoothing, dt);
        this.x += (targetX - this.x) * factor;
        this.y += (targetY - this.y) * factor;

        this.applyTransform();
    }

    private applyTransform(): void {
        this.stage.scale.set(this.zoom);
        this.stage.x = Math.round(this.screenWidth / 2 - this.x * this.zoom);
        this.stage.y = Math.round(this.screenHeight / 2 - this.y * this.zoom);
    }

    screenToWorldX(screenX: number): number {
        return (screenX - this.stage.x) / this.zoom;
    }

    screenToWorldY(screenY: number): number {
        return (screenY - this.stage.y) / this.zoom;
    }

    snapTo(worldX: number, worldY: number): void {
        this.x = worldX;
        this.y = worldY;
        this.applyTransform();
    }

    get viewLeft(): number { return this.x - this.screenWidth / (2 * this.zoom); }
    get viewRight(): number { return this.x + this.screenWidth / (2 * this.zoom); }
    get viewTop(): number { return this.y - this.screenHeight / (2 * this.zoom); }
    get viewBottom(): number { return this.y + this.screenHeight / (2 * this.zoom); }
}
