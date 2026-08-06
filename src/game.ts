import type { Application } from "pixi.js";
import World from "./world/World.js";
import Camera from "./world/Camera.js";
import Player from "./entities/Player.js";
import InputManager from "./input/InputManager.js";
import HUD from "./ui/HUD.js";
import TerrainGenerator from "./world/TerrainGenerator.js";
import Enemy from "./entities/Enemy.js";
import { loadGameData } from "./data/DataLoader.js";
import type { GameData } from "./data/DataLoader.js";

export default class Game {
    readonly world: World;
    readonly input: InputManager;
    private readonly hud: HUD;
    private readonly gameData: GameData;
    private readonly terrainGenerator: TerrainGenerator;
    private readonly camera: Camera;
    private readonly app: Application;
    private inventoryOpen = false;

    private constructor(app: Application, gameData: GameData) {
        this.app = app;
        this.gameData = gameData;
        this.input = new InputManager(app.canvas);
        this.world = new World(app.stage, gameData);
        this.hud = new HUD();
        this.terrainGenerator = new TerrainGenerator(gameData);
        this.camera = new Camera(
            app.stage,
            app.screen.width,
            app.screen.height,
            app.canvas
        );

        this.world.player = this.world.add(
            new Player(200, 200, 50, 100, this.input, this.world, gameData)
        );

        // snap da câmera no player antes de gerar terreno
        const p = this.world.player;
        this.camera.snapTo(p.x + p.width / 2, p.y + p.height / 2);

        // gerar terreno inicial com range amplo
        this.generateTerrain();

        app.renderer.on("resize", () => {
            this.camera.resize(app.screen.width, app.screen.height);
        });
    }

    static async create(app: Application): Promise<Game> {
        const gameData = await loadGameData();
        return new Game(app, gameData);
    }

    private generateTerrain(): void {
        const range = Math.max(this.app.screen.width, 1600) + 400;
        const terrain = this.terrainGenerator.generateChunksAround(
            this.camera.x,
            range
        );
        for (const d of terrain.decor) this.world.addDecor(d);
        for (const block of terrain.blocks) this.world.add(block);
        for (const prop of terrain.props) this.world.add(prop);

        const player = this.world.player;
        if (player) {
            for (const spawn of terrain.enemySpawns) {
                if (Math.random() < 0.5) continue;
                this.world.add(new Enemy(spawn.x, spawn.y, player, this.world, this.gameData));
            }
        }
    }

    update(dt: number): void {
        const player = this.world.player;

        // converter mouse de tela → mundo ANTES do update das entidades
        // usa a câmera do frame anterior (padrão em jogos)
        if (player) {
            this.input.worldMouseX = this.camera.screenToWorldX(
                this.input.mouseX
            );
            this.input.worldMouseY = this.camera.screenToWorldY(
                this.input.mouseY
            );
        }

        if (player && this.input.isPressed("inventory")) {
            this.inventoryOpen = !this.inventoryOpen;
        }

        if (player && this.input.isPressed("spawnEnemy")) {
            this.world.add(
                new Enemy(
                    this.input.worldMouseX,
                    this.input.worldMouseY,
                    player,
                    this.world,
                    this.gameData
                )
            );
        }

        this.world.update(dt);

        if (player) {
            const playerCenterX = player.x + player.width / 2;
            const playerCenterY = player.y + player.height / 2;

            this.camera.update(
                dt,
                playerCenterX,
                playerCenterY,
                this.input.worldMouseX,
                this.input.worldMouseY
            );

            this.world.cull(
                this.camera.viewLeft,
                this.camera.viewTop,
                this.camera.viewRight,
                this.camera.viewBottom
            );

            this.generateTerrain();
            this.hud.update(player, this.gameData, this.inventoryOpen);
        }

        this.input.endFrame();
    }
}
