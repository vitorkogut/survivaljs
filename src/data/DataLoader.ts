import type { ProjectileStats } from "../entities/projectiles/Projectile.js";

const BASE = import.meta.env.BASE_URL;

export interface AmmoTypeData {
    readonly id: string;
    readonly name: string;
    readonly startingAmount: number;
    readonly projectile: ProjectileStats;
}

export interface GunData {
    readonly id: string;
    readonly name: string;
    readonly width: number;
    readonly height: number;
    readonly color: number;
    readonly ammoType: string;
    readonly firerate: number;
    readonly recoilForce: number;
    readonly magazineSize: number;
    readonly reloadTimeMs: number;
    readonly soundPath: string;
}

export interface MaterialData {
    readonly id: string;
    readonly name: string;
    readonly color: number;
    readonly density: number;
    readonly soundPath: string;
}

interface RawAmmoEntry {
    id: string;
    name: string;
    startingAmount: number;
    projectile: {
        width: number;
        height: number;
        color: string;
        speed: number;
        lifetimeSeconds: number;
        gravityScale: number;
        damageMultiplier: number;
    };
}

interface RawGunEntry {
    id: string;
    name: string;
    width: number;
    height: number;
    color: string;
    ammoType: string;
    firerate: number;
    recoilForce: number;
    magazineSize: number;
    reloadTimeMs: number;
    soundPath: string;
}

interface RawMaterialEntry {
    id: string;
    name: string;
    color: string;
    density: number;
    soundPath: string;
}

export interface GameData {
    readonly ammoTypes: ReadonlyMap<string, AmmoTypeData>;
    readonly guns: readonly GunData[];
    readonly materials: ReadonlyMap<string, MaterialData>;
}

function parseColor(hex: string): number {
    return Number(hex);
}

export async function loadGameData(): Promise<GameData> {
    const [rawAmmo, rawGuns, rawMaterials] = await Promise.all([
    fetch(`${BASE}data/ammo.json`).then((r) => r.json() as Promise<RawAmmoEntry[]>),
    fetch(`${BASE}data/guns.json`).then((r) => r.json() as Promise<RawGunEntry[]>),
    fetch(`${BASE}data/materials.json`).then((r) => r.json() as Promise<RawMaterialEntry[]>),
]);

    const ammoTypes = new Map<string, AmmoTypeData>();
    for (const entry of rawAmmo) {
        ammoTypes.set(entry.id, {
            id: entry.id,
            name: entry.name,
            startingAmount: entry.startingAmount,
            projectile: {
                width: entry.projectile.width,
                height: entry.projectile.height,
                color: parseColor(entry.projectile.color),
                speed: entry.projectile.speed,
                lifetimeSeconds: entry.projectile.lifetimeSeconds,
                gravityScale: entry.projectile.gravityScale,
                damageMultiplier: entry.projectile.damageMultiplier,
            },
        });
    }

    const guns: GunData[] = rawGuns.map((entry) => ({
        id: entry.id,
        name: entry.name,
        width: entry.width,
        height: entry.height,
        color: parseColor(entry.color),
        ammoType: entry.ammoType,
        firerate: entry.firerate,
        recoilForce: entry.recoilForce,
        magazineSize: entry.magazineSize,
        reloadTimeMs: entry.reloadTimeMs,
        soundPath: entry.soundPath,
    }));

    const materials = new Map<string, MaterialData>();
    for (const entry of rawMaterials) {
        materials.set(entry.id, {
            id: entry.id,
            name: entry.name,
            color: parseColor(entry.color),
            density: entry.density,
            soundPath: BASE + entry.soundPath,
        });
    }

    return { ammoTypes, guns, materials };
}
