import { Graphics } from "pixi.js";
import Body from "./Body.js";
import Gun from "./Gun.js";
import BodyPart from "./BodyPart.js";
import type World from "../world/World.js";
import type Player from "./Player.js";
import type { GameData } from "../data/DataLoader.js";

const AGGRO_RANGE = 300;

export default class Enemy extends Body {
    readonly bodyParts: BodyPart[] = [];
    readonly gun: Gun;
    readonly maxHp = 60;
    hp = 60;
    private readonly world: World;
    private readonly hpBar: Graphics;
    private readonly hpBarBg: Graphics;

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
            new BodyPart({ name: "head", x: 8, y: -25, width: 34, height: 24, color: 0xffaaaa }),
            new BodyPart({ name: "torso", x: 5, y: 0, width: 40, height: 40, color: 0xe53935 }),
            new BodyPart({ name: "left_arm", x: -8, y: 5, width: 15, height: 35, color: 0xffaaaa }),
            new BodyPart({ name: "right_arm", x: 43, y: 5, width: 15, height: 35, color: 0xffaaaa }),
            new BodyPart({ name: "left_leg", x: 10, y: 40, width: 15, height: 40, color: 0x442222 }),
            new BodyPart({ name: "right_leg", x: 25, y: 40, width: 15, height: 40, color: 0x442222 })
        );

        for (const part of this.bodyParts) {
            this.view.addChild(part.view);
            part.view.position.set(part.x, part.y);
        }

        const gunData = gameData.guns[0]!;
        const ammo = gameData.ammoTypes.get(gunData.ammoType)!;
        this.gun = new Gun(gunData, ammo.projectile);
        this.gun.attachTo(this, this.width / 2, this.height / 3);
        this.gun.currentMagazine = this.gun.magazineSize;

        this.hpBarBg = new Graphics().rect(0, 0, 50, 6).fill(0x333333);
        this.hpBar = new Graphics().rect(0, 0, 50, 6).fill(0xe53935);
        this.hpBarBg.position.set(0, 110);
        this.hpBar.position.set(0, 110);
        this.view.addChild(this.hpBarBg);
        this.view.addChild(this.hpBar);
    }

    override update(dt: number): void {
        const dx = this.player.x + this.player.width / 2 - this.gripX;
        const dy = this.player.y + this.player.height / 2 - this.gripY;
        const dist = Math.sqrt(dx * dx + dy * dy);

        this.gun.aimAt(dx, dy);
        this.updateGunHand();

        if (dist <= AGGRO_RANGE && !this.player.dead) {
            if (this.gun.isEmpty) {
                this.gun.currentMagazine = this.gun.magazineSize;
            }
            const projectile = this.gun.fire(this.gripX, this.gripY);
            if (projectile) {
                projectile.owner = this;
                this.world.add(projectile);
            }
        }

        this.gun.update(dt);
    }

    private get gripX(): number {
        return this.x + this.gun.view.x;
    }

    private get gripY(): number {
        return this.y + this.gun.view.y;
    }

    private updateGunHand(): void {
        const isPointingLeft = Math.abs(this.gun.angle) > Math.PI / 2;
        if (isPointingLeft) {
            this.gun.view.position.set(0, 20);
        } else {
            this.gun.view.position.set(50, 20);
        }
    }

    takeDamage(amount: number): void {
        this.hp = Math.max(0, this.hp - amount);
        if (this.hp <= 0) this.dead = true;
    }

    override draw(): void {
        super.draw();
        this.gun.draw();

        const ratio = this.hp / this.maxHp;
        this.hpBar.scale.x = ratio;
        this.hpBar.tint = ratio > 0.5 ? 0xe53935 : ratio > 0.25 ? 0xff9800 : 0xf44336;
    }
}
