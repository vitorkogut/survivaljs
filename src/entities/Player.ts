import { Graphics } from "pixi.js";
import Body from "./Body.js";
import Gun from "./Gun.js";
import BodyPart from "./BodyPart.js";
import Inventory from "./Inventory.js";
import type InputManager from "../input/InputManager.js";
import type World from "../world/World.js";
import type { GameData } from "../data/DataLoader.js";

const MOVE_SPEED = 4;
const CROUCH_SPEED = 2;
const JUMP_FORCE = 12;
const CLIMB_SPEED = 4;

export default class Player extends Body {
    readonly guns: Gun[] = [];
    readonly inventory: Inventory;
    readonly bodyParts: BodyPart[] = [];
    current_gun: Gun;
    current_gun_index = 0;
    crouching = false;
    readonly maxHp = 120;
    hp = 120;
    private readonly standingHeight: number;
    private readonly hpBar: Graphics;
    private readonly hpBarBg: Graphics;

    constructor(
        x: number,
        y: number,
        width: number,
        height: number,
        private readonly input: InputManager,
        private readonly world: World,
        gameData: GameData
    ) {
        super(x, y, width, height, 0x4fc3f7);

        this.standingHeight = height;
        this.inventory = new Inventory(gameData.ammoTypes);

        // Criar as partes do corpo
        // O torso é o "root" em (0, 0), com tamanho 50x60
        this.bodyParts.push(
            new BodyPart({
                name: "head",
                x: 8,
                y: -25,
                width: 34,
                height: 24,
                color: 0xffccaa, // skin tone
            }),
            new BodyPart({
                name: "torso",
                x: 5,
                y: 0,
                width: 40,
                height: 40,
                color: 0x4fc3f7, // azul claro (mesmo da cor original)
            }),
            new BodyPart({
                name: "left_arm",
                x: -8,
                y: 5,
                width: 15,
                height: 35,
                color: 0xffccaa, // skin tone
            }),
            new BodyPart({
                name: "right_arm",
                x: 43,
                y: 5,
                width: 15,
                height: 35,
                color: 0xffccaa, // skin tone
            }),
            new BodyPart({
                name: "left_leg",
                x: 10,
                y: 40,
                width: 15,
                height: 40,
                color: 0x333333, // calça escura
            }),
            new BodyPart({
                name: "right_leg",
                x: 25,
                y: 40,
                width: 15,
                height: 40,
                color: 0x333333, // calça escura
            })
        );

        // Adicionar visuals das partes ao container do player
        for (const part of this.bodyParts) {
            this.view.addChild(part.view);
            part.view.position.set(part.x, part.y);
        }

        const startIndex = Math.floor(Math.random() * gameData.guns.length);
        const startGunData = gameData.guns[startIndex]!;
        const startAmmo = gameData.ammoTypes.get(startGunData.ammoType)!;
        this.guns.push(new Gun(startGunData, startAmmo.projectile));
        this.current_gun = this.equip(this.guns[0]!);

        this.hpBarBg = new Graphics().rect(0, 0, width, 6).fill(0x333333);
        this.hpBar = new Graphics().rect(0, 0, width, 6).fill(0x4caf50);
        this.hpBarBg.position.set(0, height + 10);
        this.hpBar.position.set(0, height + 10);
        this.view.addChild(this.hpBarBg);
        this.view.addChild(this.hpBar);
    }

    addGun(gun: Gun): void {
        if (this.guns.some(g => g.name === gun.name)) {
            this.inventory.addAmmo(gun.ammoTypeId, gun.magazineSize * 2);
            gun.view.destroy();
            return;
        }
        this.guns.push(gun);
    }

    private equip(gun: Gun): Gun {
        this.current_gun = gun;
        gun.attachTo(this, this.width / 2, this.height / 3);
        return gun;
    }

    getBodyPart(name: string): BodyPart | undefined {
        return this.bodyParts.find((part) => part.name === name);
    }

    override update(_dt: number): void {
        const wantCrouch = this.input.isHeld("crouch") && this.grounded;

        if (wantCrouch && !this.crouching) {
            this.crouching = true;
            const diff = this.standingHeight - this.standingHeight / 2;
            this.y += diff;
            this.height = this.standingHeight / 2;
            this.applyCrouchVisuals();
        } else if (!wantCrouch && this.crouching) {
            this.crouching = false;
            const diff = this.standingHeight - this.standingHeight / 2;
            this.y -= diff;
            this.height = this.standingHeight;
            this.applyStandVisuals();
        }

        const speed = this.crouching ? CROUCH_SPEED : MOVE_SPEED;
        this.vx = this.input.axis("moveLeft", "moveRight") * speed;

        if (this.grounded && this.input.isPressed("jump") && !this.crouching) {
            this.vy = -JUMP_FORCE;
            this.grounded = false;
        }

        // Escalar: empurra contra parede no ar segurando espaço → sobe
        const climbingLeft  = this.touchingWallLeft  && this.input.isHeld("moveLeft");
        const climbingRight = this.touchingWallRight && this.input.isHeld("moveRight");
        if (!this.grounded && (climbingLeft || climbingRight) && this.input.isHeld("jump")) {
            this.vy = -CLIMB_SPEED;
        }

        if (this.input.isPressed("switchGun")) {
            const total_guns = this.guns.length;
            if (this.current_gun_index + 1 < total_guns) {
                this.current_gun_index++;
            } else {
                this.current_gun_index = 0;
            }
            this.current_gun.hide();
            this.equip(this.guns[this.current_gun_index]!);
            this.current_gun.show();
        }

        if (this.input.isPressed("reload")) {
            this.current_gun.startReload();
        }

        if (this.current_gun.isEmpty && !this.current_gun.reloading) {
            this.current_gun.startReload();
        }

        const consumed = this.current_gun.finishReload(
            this.inventory.getAmmo(this.current_gun.ammoTypeId)
        );
        if (consumed > 0) {
            this.inventory.consumeAmmo(this.current_gun.ammoTypeId, consumed);
        }

        this.aimCurrentGun();

        if (this.input.isHeld("shoot")) {
            this.shoot();
        }

        this.current_gun.update(_dt);
    }

    private get gripX(): number {
        return this.x + this.current_gun.view.x;
    }

    private get gripY(): number {
        return this.y + this.current_gun.view.y;
    }

    private aimCurrentGun(): void {
        const dx = this.input.worldMouseX - this.gripX;
        const dy = this.input.worldMouseY - this.gripY;
        this.current_gun.aimAt(dx, dy);

        // trocar arma de mão baseado na mira
        this.updateGunHand();
    }

    private updateGunHand(): void {
        const isPointingLeft = Math.abs(this.current_gun.angle) > Math.PI / 2;
        const gunY = this.crouching ? 10 : 20;

        if (isPointingLeft) {
            this.current_gun.view.position.set(0, gunY);
        } else {
            this.current_gun.view.position.set(50, gunY);
        }
    }

    private applyCrouchVisuals(): void {
        for (const part of this.bodyParts) {
            part.view.position.y = part.y * 0.5;
            part.view.scale.y = 0.5;
        }
    }

    private applyStandVisuals(): void {
        for (const part of this.bodyParts) {
            part.view.position.y = part.y;
            part.view.scale.y = 1;
        }
    }

    private shoot(): void {
        for (const projectile of this.current_gun.fire(this.gripX, this.gripY)) {
            projectile.owner = this;
            this.world.add(projectile);
        }
    }

    takeDamage(amount: number): void {
        this.hp = Math.max(0, this.hp - amount);
        if (this.hp <= 0) this.dead = true;
    }

    override draw(): void {
        super.draw();
        this.current_gun.draw();

        const ratio = this.hp / this.maxHp;
        this.hpBar.scale.x = ratio;
        this.hpBar.tint = ratio > 0.5 ? 0x4caf50 : ratio > 0.25 ? 0xff9800 : 0xf44336;
    }
}
