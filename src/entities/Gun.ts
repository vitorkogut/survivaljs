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

    angle = 0;
    currentMagazine: number;
    reloading = false;

    private readonly barrelLength: number;
    private readonly projectileStats: ProjectileStats;
    private readonly firerate: number;
    private readonly recoilForce: number;
    private readonly recentreMs: number;
    private readonly soundPath: string;
    private readonly reloadSoundPath: string;
    private readonly pelletCount: number;
    private readonly spreadRad: number;

    private angleModifier = 0;
    private lastShotTime = 0;
    private reloadStartTime = 0;

    constructor(data: GunData, projectileStats: ProjectileStats) {
        super();
        this.name = data.name;
        this.barrelLength = data.width;
        this.ammoTypeId = data.ammoType;
        this.firerate = data.firerate;
        this.recoilForce = data.recoilForce;
        this.magazineSize = data.magazineSize;
        this.reloadTimeMs = data.reloadTimeMs;
        this.currentMagazine = data.magazineSize;
        this.projectileStats = projectileStats;
        this.soundPath = data.soundPath;
        this.reloadSoundPath = data.reloadSoundPath;
        this.pelletCount = data.pelletCount;
        this.spreadRad = (data.spreadDeg * Math.PI) / 180;
        this.recentreMs = 500;

        this.view = new Graphics()
            .rect(0, -data.height / 2, data.width, data.height)
            .fill(data.color);

        Assets.load(this.soundPath);
        sound.add(this.soundPath, this.soundPath);
        Assets.load(this.reloadSoundPath);
        sound.add(this.reloadSoundPath, this.reloadSoundPath);
    }

    attachTo(host: Body, offsetX: number, offsetY: number): void {
        this.view.position.set(offsetX, offsetY);
        host.view.addChild(this.view);
    }

    aimAt(dx: number, dy: number): void {
        this.angle = Math.atan2(dy, dx);
    }

    hide(): void { this.view.visible = false; }
    show(): void { this.view.visible = true; }

    get canFire(): boolean {
        return (
            !this.reloading &&
            this.currentMagazine > 0 &&
            this.lastShotTime + 1000 / this.firerate < performance.now()
        );
    }

    get isEmpty(): boolean {
        return this.currentMagazine <= 0;
    }

    fire(gripX: number, gripY: number, volume = 0.5): Projectile[] {
        if (!this.canFire) return [];

        const now = performance.now();
        const muzzleX = gripX + Math.cos(this.angle) * this.barrelLength;
        const muzzleY = gripY + Math.sin(this.angle) * this.barrelLength;
        const baseAngle = this.angle + this.angleModifier;

        const projectiles: Projectile[] = [];
        for (let i = 0; i < this.pelletCount; i++) {
            const spread = this.pelletCount > 1
                ? (i / (this.pelletCount - 1) - 0.5) * this.spreadRad + (Math.random() - 0.5) * this.spreadRad * 0.4
                : 0;
            projectiles.push(new Projectile(muzzleX, muzzleY, baseAngle + spread, this.projectileStats));
        }

        this.currentMagazine--;

        if (now - this.lastShotTime > this.recentreMs) {
            this.angleModifier = 0;
        } else {
            this.angleModifier += Math.cos(this.angle) > 0 ? -this.recoilForce : this.recoilForce;
        }

        this.lastShotTime = now;
        sound.play(this.soundPath, { volume });
        return projectiles;
    }

    startReload(): boolean {
        if (this.reloading || this.currentMagazine === this.magazineSize) return false;
        this.reloading = true;
        this.reloadStartTime = performance.now();
        sound.play(this.reloadSoundPath, { volume: 0.6 });
        return true;
    }

    finishReload(ammoAvailable: number): number {
        if (!this.reloading) return 0;
        if (performance.now() < this.reloadStartTime + this.reloadTimeMs) return 0;

        const toLoad = Math.min(this.magazineSize - this.currentMagazine, ammoAvailable);
        this.currentMagazine += toLoad;
        this.reloading = false;
        return toLoad;
    }

    override update(_dt: number): void {
        if (performance.now() - this.lastShotTime > this.recentreMs) {
            this.angleModifier = 0;
        }
    }

    override draw(): void {
        this.view.rotation = this.angle + this.angleModifier;
        this.view.scale.y = Math.abs(this.angle) > Math.PI / 2 ? -1 : 1;
    }
}
