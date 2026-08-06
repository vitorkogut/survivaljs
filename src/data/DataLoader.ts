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
    readonly reloadSoundPath: string;
    readonly enemyUsable: boolean;
    readonly pelletCount: number;
    readonly spreadDeg: number;
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
    reloadSoundPath: string;
    enemyUsable?: boolean;
    pelletCount?: number;
    spreadDeg?: number;
}

interface RawMaterialEntry {
    id: string;
    name: string;
    color: string;
    density: number;
    soundPath: string;
}

export interface StructureElementData {
    readonly x: number;
    readonly y: number;
    readonly width: number;
    readonly height: number;
    readonly material: string;
}

export interface StructureEnemyData {
    readonly x: number;
    readonly y: number;
}

export interface StructureDecorData {
    readonly x: number;
    readonly y: number;
    readonly width: number;
    readonly height: number;
    readonly color: string;
    readonly alpha: number;
}

export interface StructureData {
    readonly id: string;
    readonly name: string;
    readonly width: number;
    readonly blocks: readonly StructureElementData[];
    readonly props: readonly StructureElementData[];
    readonly enemies: readonly StructureEnemyData[];
    readonly decor: readonly StructureDecorData[];
}

export interface GameData {
    readonly ammoTypes: ReadonlyMap<string, AmmoTypeData>;
    readonly guns: readonly GunData[];
    readonly materials: ReadonlyMap<string, MaterialData>;
    readonly structures: readonly StructureData[];
}

function parseColor(hex: string): number {
    return Number(hex);
}

export async function loadGameData(): Promise<GameData> {
    const [rawAmmo, rawGuns, rawMaterials, structures] = await Promise.all([
        fetch(`${BASE}data/ammo.json`).then((r) => r.json() as Promise<RawAmmoEntry[]>),
        fetch(`${BASE}data/guns.json`).then((r) => r.json() as Promise<RawGunEntry[]>),
        fetch(`${BASE}data/materials.json`).then((r) => r.json() as Promise<RawMaterialEntry[]>),
        fetch(`${BASE}data/structures.json`).then((r) => r.json() as Promise<StructureData[]>),
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
        reloadSoundPath: entry.reloadSoundPath,
        enemyUsable: entry.enemyUsable ?? false,
        pelletCount: entry.pelletCount ?? 1,
        spreadDeg: entry.spreadDeg ?? 0,
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

    return { ammoTypes, guns, materials, structures };
}
