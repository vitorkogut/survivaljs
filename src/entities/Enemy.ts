import { Graphics, Assets } from "pixi.js";
import { sound } from "@pixi/sound";
import Body from "./Body.js";
import Gun from "./Gun.js";
import BodyPart from "./BodyPart.js";
import Pickup from "./Pickup.js";
import type World from "../world/World.js";
import type Player from "./Player.js";
import type { GameData, GunData } from "../data/DataLoader.js";
import type { ProjectileStats } from "./projectiles/Projectile.js";

const DEATH_SOUNDS = ["sounds/stunstick_fleshhit1.wav", "sounds/stunstick_fleshhit2.wav"];
for (const s of DEATH_SOUNDS) {
    Assets.load(s);
    sound.add(s, s);
}

const AGGRO_RANGE = 1000;
const MOVE_SPEED = 1.8;
const JUMP_FORCE = 10;
const FIRE_COOLDOWN_MS = 1200;
const SEEK_STATE_DURATION_MS = 1800;

type SeekState = "walk" | "jump" | "crouch";

export default class Enemy extends Body {
    readonly bodyParts: BodyPart[] = [];
    readonly gun: Gun;
    readonly gunData: GunData;
    readonly projectileStats: ProjectileStats;
    readonly maxHp = 60;
    hp = 60;
    aggroed = false;

    private readonly world: World;
    private readonly hpBar: Graphics;
    private readonly hpBarBg: Graphics;
    private crouching = false;
    private seekState: SeekState = "walk";
    private seekStateTimer = 0;
    private jumpCooldown = 0;
    private lastShot = 0;
    private lootDropped = false;

    constructor(
        x: number,
        y: number,
        private readonly player: Player,
        world: World,
        gameData: GameData
    ) {
        super(x, y, 50, 100, 0xe53935);

        this.world = world;

        this.bodyParts.push(
            new BodyPart({ name: "head",      x: 8,  y: -25, width: 34, height: 24, color: 0xffaaaa }),
            new BodyPart({ name: "torso",     x: 5,  y: 0,   width: 40, height: 40, color: 0xe53935 }),
            new BodyPart({ name: "left_arm",  x: -8, y: 5,   width: 15, height: 35, color: 0xffaaaa }),
            new BodyPart({ name: "right_arm", x: 43, y: 5,   width: 15, height: 35, color: 0xffaaaa }),
            new BodyPart({ name: "left_leg",  x: 10, y: 40,  width: 15, height: 40, color: 0x442222 }),
            new BodyPart({ name: "right_leg", x: 25, y: 40,  width: 15, height: 40, color: 0x442222 })
        );

        for (const part of this.bodyParts) {
            this.view.addChild(part.view);
            part.view.position.set(part.x, part.y);
        }

        const usable = gameData.guns.filter(g => g.enemyUsable);
        const randGun = usable[Math.floor(Math.random() * usable.length)]!;
        const ammo = gameData.ammoTypes.get(randGun.ammoType)!;
        this.gunData = randGun;
        this.projectileStats = ammo.projectile;
        this.gun = new Gun(randGun, ammo.projectile);
        this.gun.attachTo(this, this.width / 2, this.height / 3);
        this.gun.currentMagazine = this.gun.magazineSize;

        this.hpBarBg = new Graphics().rect(0, 0, 50, 6).fill(0x333333);
        this.hpBar   = new Graphics().rect(0, 0, 50, 6).fill(0xe53935);
        this.repositionHpBar();
        this.view.addChild(this.hpBarBg);
        this.view.addChild(this.hpBar);
    }

    override update(dt: number): void {
        const playerCX = this.player.x + this.player.width / 2;
        const playerCY = this.player.y + this.player.height / 2;
        const dx = playerCX - this.gripX;
        const dy = playerCY - this.gripY;
        const dist = Math.sqrt(dx * dx + dy * dy);

        this.gun.aimAt(dx, dy);
        this.updateGunHand();

        const inRange = dist <= AGGRO_RANGE || this.aggroed;

        if (inRange && !this.player.dead) {
            if (this.gun.isEmpty) {
                this.gun.currentMagazine = this.gun.magazineSize;
            }

            const hasLOS = this.world.hasLineOfSight(this.gripX, this.gripY, playerCX, playerCY, this);

            if (hasLOS) {
                this.enterCombat();
                if (performance.now() > this.lastShot + FIRE_COOLDOWN_MS) {
                    const gunVolume = this.spatialVolume(dist);
                    for (const projectile of this.gun.fire(this.gripX, this.gripY, gunVolume)) {
                        projectile.owner = this;
                        this.world.add(projectile);
                    }
                    this.lastShot = performance.now();
                }
            } else {
                this.updateSeek(dx, dy);
            }
        } else {
            // Out of range and not aggroed — idle
            this.vx = 0;
            if (this.crouching) this.setCrouch(false);
        }

        this.gun.update(dt);
    }

    private enterCombat(): void {
        this.vx = 0;
        if (this.crouching) this.setCrouch(false);
        this.seekState = "walk";
    }

    private spatialVolume(dist: number): number {
        const maxDist = 4000;
        const fullVolDist = 250;
        const t = dist <= fullVolDist
            ? 0
            : (dist - fullVolDist) / (maxDist - fullVolDist);
        return Math.max(0, (1 - t) * (1 - t)) * 0.45;
    }

    private tryJumpObstacle(direction: number): void {
        if (this.grounded && performance.now() > this.jumpCooldown &&
            this.world.isBlockedAhead(this, direction)) {
            this.vy = -JUMP_FORCE;
            this.grounded = false;
            this.jumpCooldown = performance.now() + 1200;
        }
    }

    private updateSeek(dx: number, dy: number): void {
        const now = performance.now();
        const direction = dx > 0 ? 1 : -1;

        this.vx = direction * MOVE_SPEED;
        this.tryJumpObstacle(direction);

        if (now - this.seekStateTimer > SEEK_STATE_DURATION_MS) {
            this.seekStateTimer = now;
            const next: SeekState = this.seekState !== "walk" ? "walk" : dy < -80 ? "jump" : "crouch";
            this.seekState = next;
            this.setCrouch(next === "crouch");
        }

        if (this.seekState === "jump" && this.grounded && now > this.jumpCooldown) {
            this.vy = -JUMP_FORCE;
            this.grounded = false;
            this.jumpCooldown = now + 1200;
            this.seekState = "walk";
            this.seekStateTimer = now;
            this.setCrouch(false);
        }
    }

    private setCrouch(on: boolean): void {
        if (on === this.crouching) return;
        this.crouching = on;

        if (on) {
            this.y += 50;
            this.height = 50;
        } else {
            this.y -= 50;
            this.height = 100;
        }

        const scale = on ? 0.5 : 1;
        for (const part of this.bodyParts) {
            part.view.scale.y = scale;
            part.view.position.y = part.y * scale;
        }

        this.repositionHpBar();
    }

    private repositionHpBar(): void {
        this.hpBarBg?.position.set(0, this.height + 10);
        this.hpBar?.position.set(0, this.height + 10);
    }

    private get gripX(): number {
        return this.x + this.gun.view.x;
    }

    private get gripY(): number {
        return this.y + this.gun.view.y;
    }

    private updateGunHand(): void {
        const isPointingLeft = Math.abs(this.gun.angle) > Math.PI / 2;
        const gunY = this.crouching ? 5 : 20;
        this.gun.view.position.set(isPointingLeft ? 0 : 50, gunY);
    }

    takeDamage(amount: number): void {
        this.hp = Math.max(0, this.hp - amount);
        if (this.hp > 0) {
            this.aggroed = true;
        } else if (!this.dead) {
            this.dead = true;
            const deathSnd = DEATH_SOUNDS[Math.floor(Math.random() * DEATH_SOUNDS.length)]!;
            this.world.playSpatialSound(deathSnd, this.x + this.width / 2, this.y + this.height / 2);
            if (!this.lootDropped) {
                this.lootDropped = true;
                this.dropLoot();
            }
        }
    }

    private dropLoot(): void {
        const wx = new Pickup(this.x, this.y - 15, {
            type: "weapon",
            gunData: this.gunData,
            projectileStats: this.projectileStats,
        });
        this.world.add(wx);
        const ammoAmt = this.gun.magazineSize + Math.floor(Math.random() * this.gun.magazineSize * 2);
        const ax = new Pickup(this.x + 28, this.y - 15, {
            type: "ammo",
            ammoTypeId: this.gun.ammoTypeId,
            amount: ammoAmt,
        });
        this.world.add(ax);
    }

    override draw(): void {
        super.draw();
        this.gun.draw();

        const ratio = this.hp / this.maxHp;
        this.hpBar.scale.x = ratio;
        this.hpBar.tint = ratio > 0.5 ? 0xe53935 : ratio > 0.25 ? 0xff9800 : 0xf44336;
    }
}
