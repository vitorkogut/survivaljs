export type GameAction = "moveLeft" | "moveRight" | "jump" | "crouch" | "shoot" | "switchGun" | "reload" | "spawnEnemy" | "inventory";

const KEY_BINDINGS: Readonly<Record<string, GameAction>> = {
    ArrowLeft: "moveLeft",
    KeyA: "moveLeft",
    ArrowRight: "moveRight",
    KeyD: "moveRight",
    Space: "jump",
    ArrowUp: "jump",
    KeyW: "jump",
    KeyQ: "switchGun",
    KeyR: "reload",
    KeyE: "inventory",
    ControlLeft: "crouch",
    ControlRight: "crouch",
    KeyH: "spawnEnemy",
};

const MOUSE_BINDINGS: Readonly<Record<number, GameAction>> = {
    0: "shoot",
};

export default class InputManager {
    private readonly held = new Set<GameAction>();
    private readonly pressed = new Set<GameAction>();

    // coordenadas de tela (relativas ao canvas)
    mouseX = 0;
    mouseY = 0;

    // coordenadas de mundo (atualizadas pelo Game com o offset da câmera)
    worldMouseX = 0;
    worldMouseY = 0;

    constructor(
        private readonly canvas: HTMLCanvasElement,
        private readonly target: Window = window
    ) {
        this.target.addEventListener("keydown", this.onKeyDown);
        this.target.addEventListener("keyup", this.onKeyUp);
        this.target.addEventListener("pointermove", this.onPointerMove);
        this.target.addEventListener("pointerdown", this.onPointerDown);
        this.target.addEventListener("pointerup", this.onPointerUp);
    }

    private readonly onKeyDown = (event: KeyboardEvent): void => {
        const action = KEY_BINDINGS[event.code];
        if (action === undefined) return;

        event.preventDefault();

        if (!event.repeat) {
            this.pressed.add(action);
        }
        this.held.add(action);
    };

    private readonly onKeyUp = (event: KeyboardEvent): void => {
        const action = KEY_BINDINGS[event.code];
        if (action === undefined) return;

        this.held.delete(action);
    };

    private readonly onPointerMove = (event: PointerEvent): void => {
        const bounds = this.canvas.getBoundingClientRect();
        this.mouseX = event.clientX - bounds.left;
        this.mouseY = event.clientY - bounds.top;
    };

    private readonly onPointerDown = (event: PointerEvent): void => {
        const action = MOUSE_BINDINGS[event.button];
        if (action === undefined) return;

        this.pressed.add(action);
        this.held.add(action);
    };

    private readonly onPointerUp = (event: PointerEvent): void => {
        const action = MOUSE_BINDINGS[event.button];
        if (action === undefined) return;

        this.held.delete(action);
    };

    isHeld(action: GameAction): boolean {
        return this.held.has(action);
    }

    isPressed(action: GameAction): boolean {
        return this.pressed.has(action);
    }

    axis(negative: GameAction, positive: GameAction): number {
        return Number(this.isHeld(positive)) - Number(this.isHeld(negative));
    }

    endFrame(): void {
        this.pressed.clear();
    }

    destroy(): void {
        this.target.removeEventListener("keydown", this.onKeyDown);
        this.target.removeEventListener("keyup", this.onKeyUp);
        this.target.removeEventListener("pointermove", this.onPointerMove);
        this.target.removeEventListener("pointerdown", this.onPointerDown);
        this.target.removeEventListener("pointerup", this.onPointerUp);
    }
}
