import Body from "./Body.js";
import Gun from "./Gun.js";
import type Player from "./Player.js";
import type { GunData } from "../data/DataLoader.js";
import type { ProjectileStats } from "./projectiles/Projectile.js";

type PickupKind =
    | { type: "weapon"; gunData: GunData; projectileStats: ProjectileStats }
    | { type: "ammo"; ammoTypeId: string; amount: number }
    | { type: "health"; amount: number };

export default class Pickup extends Body {
    override gravity = true;
    readonly pickupKind: PickupKind;

    constructor(x: number, y: number, kind: PickupKind) {
        const color =
            kind.type === "weapon" ? kind.gunData.color :
            kind.type === "health" ? 0x4caf50 :
            0xffd700;
        const size = kind.type === "health" ? 18 : 22;
        super(x, y, size, size, color);
        this.pickupKind = kind;
        this.view.alpha = 0.9;
    }

    tryPickup(player: Player): boolean {
        if (!this.intersects(player)) return false;
        if (this.pickupKind.type === "weapon") {
            const gun = new Gun(this.pickupKind.gunData, this.pickupKind.projectileStats);
            player.addGun(gun);
        } else if (this.pickupKind.type === "ammo") {
            player.inventory.addAmmo(this.pickupKind.ammoTypeId, this.pickupKind.amount);
        } else {
            player.hp = Math.min(player.maxHp, player.hp + this.pickupKind.amount);
        }
        this.dead = true;
        return true;
    }
}
