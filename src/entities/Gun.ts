import { Graphics, Assets } from "pixi.js";
import { sound } from '@pixi/sound';
import Entity from "./Entity.js";
import type Body from "./Body.js";
import Projectile from "./projectiles/Projectile.js";
import type { ProjectileStats } from "./projectiles/Projectile.js";
import type { GunData } from "../data/DataLoader.js";

export default class Gun extends Entity {
    override readonly view: Graphics;
    readonly name: string;
    readonly ammoTypeId: string;
    readonly magazineSize: number;
    readonly reloadTimeMs: number;

    private readonly barrelLength: number;
    private readonly projectileStats: ProjectileStats;

    angle = 0;
    firerate = 0;
    recoil_force = 0;
    last_shot_time = 0;
    should_render = true;
    time_to_recenter_ms = 500;
    angle_modifier = 0.0;
    sound_path = "";

    currentMagazine: number;
    reloading = false;
    private reloadStartTime = 0;

    constructor(data: GunData, projectileStats: ProjectileStats) {
        super();
        this.name = data.name;
        this.barrelLength = data.width;
        this.ammoTypeId = data.ammoType;
        this.firerate = data.firerate;
        this.recoil_force = data.recoilForce;
        this.magazineSize = data.magazineSize;
        this.reloadTimeMs = data.reloadTimeMs;
        this.currentMagazine = data.magazineSize;
        this.projectileStats = projectileStats;
        this.sound_path = data.soundPath;

        this.view = new Graphics()
            .rect(0, -data.height / 2, data.width, data.height)
            .fill(data.color);

        Assets.load(this.sound_path);
        sound.add(this.sound_path, this.sound_path);
    }

    attachTo(host: Body, offsetX: number, offsetY: number): void {
        this.view.position.set(offsetX, offsetY);
        host.view.addChild(this.view);
    }

    aimAt(dx: number, dy: number): void {
        this.angle = Math.atan2(dy, dx);
    }

    hide(): void {
        this.view.visible = false;
        this.should_render = false;
    }

    show(): void {
        this.view.visible = true;
        this.should_render = true;
    }

    get canFire(): boolean {
        return (
            !this.reloading &&
            this.currentMagazine > 0 &&
            this.last_shot_time + 1000 / this.firerate < performance.now()
        );
    }

    get isEmpty(): boolean {
        return this.currentMagazine <= 0;
    }

    fire(gripX: number, gripY: number): Projectile | null {
        if (!this.canFire) return null;

        const muzzleX = gripX + Math.cos(this.angle) * this.barrelLength;
        const muzzleY = gripY + Math.sin(this.angle) * this.barrelLength;

        const projectile = new Projectile(
            muzzleX,
            muzzleY,
            this.angle + this.angle_modifier,
            this.projectileStats
        );

        this.currentMagazine--;

        if (this.last_shot_time + this.time_to_recenter_ms < performance.now()) {
            this.angle_modifier = 0.0;
        } else {
            if (Math.cos(this.angle) > 0) {
                this.angle_modifier -= this.recoil_force;
            } else {
                this.angle_modifier += this.recoil_force;
            }
        }

        this.last_shot_time = performance.now();
        sound.play(this.sound_path);
        return projectile;
    }

    startReload(): boolean {
        if (this.reloading || this.currentMagazine === this.magazineSize) return false;
        this.reloading = true;
        this.reloadStartTime = performance.now();
        return true;
    }

    finishReload(ammoAvailable: number): number {
        if (!this.reloading) return 0;
        if (performance.now() < this.reloadStartTime + this.reloadTimeMs) return 0;

        const needed = this.magazineSize - this.currentMagazine;
        const toLoad = Math.min(needed, ammoAvailable);
        this.currentMagazine += toLoad;
        this.reloading = false;
        return toLoad;
    }

    override update(_dt: number): void {
        if (this.last_shot_time + this.time_to_recenter_ms < performance.now()) {
            this.angle_modifier = 0.0;
        }
    }

    override draw(): void {
        this.view.rotation = this.angle + this.angle_modifier;
        this.view.scale.y = Math.abs(this.angle) > Math.PI / 2 ? -1 : 1;
    }
}
