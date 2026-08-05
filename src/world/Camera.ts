import type { Container } from "pixi.js";

export default class Camera {
    x = 0;
    y = 0;

    // quanto da distância player→mouse a câmera avança (0 = player, 1 = mouse)
    private readonly lookAheadFactor = 0.3;
    // suavização do movimento (mais baixo = mais suave)
    private readonly smoothing = 0.1;

    constructor(
        private readonly stage: Container,
        private screenWidth: number,
        private screenHeight: number
    ) {}

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
        // alvo fica entre o player e o mouse
        const targetX =
            playerCenterX +
            (worldMouseX - playerCenterX) * this.lookAheadFactor;
        const targetY =
            playerCenterY +
            (worldMouseY - playerCenterY) * this.lookAheadFactor;

        // lerp independente de framerate
        const factor = 1 - Math.pow(1 - this.smoothing, dt);
        this.x += (targetX - this.x) * factor;
        this.y += (targetY - this.y) * factor;

        // aplicar offset no stage: o "mundo" se move no sentido oposto à câmera
        this.stage.x = Math.round(this.screenWidth / 2 - this.x);
        this.stage.y = Math.round(this.screenHeight / 2 - this.y);
    }

    // converte coordenada de tela → coordenada de mundo
    screenToWorldX(screenX: number): number {
        return screenX - this.stage.x;
    }

    screenToWorldY(screenY: number): number {
        return screenY - this.stage.y;
    }

    // snap imediato sem suavização (usado na inicialização)
    snapTo(worldX: number, worldY: number): void {
        this.x = worldX;
        this.y = worldY;
        this.stage.x = Math.round(this.screenWidth / 2 - this.x);
        this.stage.y = Math.round(this.screenHeight / 2 - this.y);
    }

    get viewLeft(): number {
        return this.x - this.screenWidth / 2;
    }

    get viewRight(): number {
        return this.x + this.screenWidth / 2;
    }
}
