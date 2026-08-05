import type { AmmoTypeData } from "../data/DataLoader.js";

export default class Inventory {
    private readonly ammo = new Map<string, number>();

    constructor(ammoTypes: ReadonlyMap<string, AmmoTypeData>) {
        for (const [id, data] of ammoTypes) {
            this.ammo.set(id, data.startingAmount);
        }
    }

    getAmmo(ammoTypeId: string): number {
        return this.ammo.get(ammoTypeId) ?? 0;
    }

    addAmmo(ammoTypeId: string, amount: number): void {
        this.ammo.set(ammoTypeId, this.getAmmo(ammoTypeId) + amount);
    }

    consumeAmmo(ammoTypeId: string, amount: number): boolean {
        const current = this.getAmmo(ammoTypeId);
        if (current < amount) return false;
        this.ammo.set(ammoTypeId, current - amount);
        return true;
    }
}
