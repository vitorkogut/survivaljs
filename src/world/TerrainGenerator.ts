import Block from "../entities/Block.js";
import Prop from "../entities/Prop.js";
import BackdropBlock from "../entities/BackdropBlock.js";
import type { GameData, MaterialData, StructureData } from "../data/DataLoader.js";

export interface EnemySpawn {
    readonly x: number;
    readonly y: number;
}

export interface GeneratedTerrain {
    readonly blocks: Block[];
    readonly props: Prop[];
    readonly decor: BackdropBlock[];
    readonly enemySpawns: EnemySpawn[];
}

interface FlatZone {
    readonly x: number;
    readonly right: number;
    readonly anchorY: number;
}

export default class TerrainGenerator {
    private readonly generatedColumns = new Set<number>();
    private readonly generatedFillChunks = new Set<number>();
    private readonly generatedPropZones = new Set<number>();
    private readonly generatedStructureZones = new Set<number>();

    // zonas planas criadas pelas estruturas — consultadas ao gerar colunas de terreno
    private readonly flatZones: FlatZone[] = [];

    private readonly columnWidth = 20;
    private readonly fillChunkWidth = 160;
    private readonly propZoneWidth = 300;
    private readonly structureZoneWidth = 2800;
    private readonly fillDepth = 400;

    // margem de terreno plano ao redor de cada estrutura (em px)
    private readonly flatMargin = 400;
    private readonly flatTransition = 400;

    private readonly materials: ReadonlyMap<string, MaterialData>;
    private readonly structures: readonly StructureData[];

    private readonly grassMat: MaterialData;
    private readonly dirtMat: MaterialData;
    private readonly stoneMat: MaterialData;
    private readonly woodMat: MaterialData;
    private readonly metalMat: MaterialData;

    private readonly grassHeight = 12;
    private readonly dirtHeight = 60;

    private readonly seed: number;

    constructor(gameData: GameData, seed: number = Math.random() * 99999) {
        this.materials = gameData.materials;
        this.structures = gameData.structures;
        this.seed = seed;

        this.grassMat = gameData.materials.get("grass")!;
        this.dirtMat = gameData.materials.get("dirt")!;
        this.stoneMat = gameData.materials.get("stone")!;
        this.woodMat = gameData.materials.get("wood")!;
        this.metalMat = gameData.materials.get("metal")!;
    }

    generateChunksAround(centerX: number, visibilityRange: number = 1600): GeneratedTerrain {
        const blocks: Block[] = [];
        const props: Prop[] = [];
        const decor: BackdropBlock[] = [];
        const enemySpawns: EnemySpawn[] = [];

        // ── 1. Estruturas PRIMEIRO para que flatZones existam antes das colunas ──
        const minStruct = Math.floor((centerX - visibilityRange) / this.structureZoneWidth);
        const maxStruct = Math.floor((centerX + visibilityRange) / this.structureZoneWidth);

        for (let zone = minStruct; zone <= maxStruct; zone++) {
            if (this.generatedStructureZones.has(zone)) continue;
            this.generatedStructureZones.add(zone);

            // zona 0: player nasce aqui, sem estrutura
            if (zone === 0) continue;

            const result = this.placeStructure(zone);
            blocks.push(...result.blocks);
            props.push(...result.props);
            decor.push(...result.decor);
            enemySpawns.push(...result.enemySpawns);
        }

        // ── 2. Colunas de superfície (usa effectiveSurfaceHeight para ficar plano sob estruturas) ──
        const minCol = Math.floor((centerX - visibilityRange) / this.columnWidth);
        const maxCol = Math.floor((centerX + visibilityRange) / this.columnWidth);

        for (let col = minCol; col <= maxCol; col++) {
            if (this.generatedColumns.has(col)) continue;
            this.generatedColumns.add(col);

            const x = col * this.columnWidth;
            const surfaceY = this.effectiveSurfaceHeight(x);

            blocks.push(new Block(x, surfaceY, this.columnWidth, this.grassHeight, this.grassMat));
            blocks.push(new Block(x, surfaceY + this.grassHeight, this.columnWidth, this.dirtHeight, this.dirtMat));
        }

        // ── 3. Preenchimento profundo ──
        const minFill = Math.floor((centerX - visibilityRange) / this.fillChunkWidth);
        const maxFill = Math.floor((centerX + visibilityRange) / this.fillChunkWidth);

        for (let chunk = minFill; chunk <= maxFill; chunk++) {
            if (this.generatedFillChunks.has(chunk)) continue;
            this.generatedFillChunks.add(chunk);

            const chunkX = chunk * this.fillChunkWidth;
            let minSurfaceY = Infinity;
            for (let x = chunkX; x < chunkX + this.fillChunkWidth; x += this.columnWidth) {
                const sy = this.effectiveSurfaceHeight(x);
                if (sy < minSurfaceY) minSurfaceY = sy;
            }

            const fillTop = minSurfaceY + this.grassHeight + this.dirtHeight;
            blocks.push(new Block(chunkX, fillTop, this.fillChunkWidth, this.fillDepth, this.stoneMat));
        }

        // ── 4. Props soltos (caixas e barris) ──
        const minProp = Math.floor((centerX - visibilityRange) / this.propZoneWidth);
        const maxProp = Math.floor((centerX + visibilityRange) / this.propZoneWidth);

        for (let zone = minProp; zone <= maxProp; zone++) {
            if (this.generatedPropZones.has(zone)) continue;
            this.generatedPropZones.add(zone);

            props.push(...this.generateLooseProps(zone));
        }

        return { blocks, props, decor, enemySpawns };
    }

    private placeStructure(zoneIndex: number): GeneratedTerrain {
        if (this.structures.length === 0) return { blocks: [], props: [], decor: [], enemySpawns: [] };

        const skipRand = TerrainGenerator.rng(zoneIndex * 97 + 31 + this.seed);
        if (skipRand < 0.15) return { blocks: [], props: [], decor: [], enemySpawns: [] };

        const rand = TerrainGenerator.rng(zoneIndex * 41 + 19 + this.seed);
        const def = this.structures[Math.floor(rand * this.structures.length)]!;

        const zoneStartX = zoneIndex * this.structureZoneWidth;
        const margin = 150;
        const maxOffset = Math.max(0, this.structureZoneWidth - def.width - margin * 2);
        const offsetRand = TerrainGenerator.rng(zoneIndex * 53 + 7 + this.seed);
        const anchorX = zoneStartX + margin + Math.floor(offsetRand * maxOffset);

        // anchorY amostrado no centro — usa surfaceHeight (ainda sem flat zone desta estrutura)
        const anchorY = this.surfaceHeight(anchorX + def.width / 2);

        // registra zona plana para que colunas de terreno fiquem niveladas aqui
        this.flatZones.push({
            x: anchorX - this.flatMargin,
            right: anchorX + def.width + this.flatMargin,
            anchorY,
        });

        const blocks: Block[] = [];
        const props: Prop[] = [];
        const decor: BackdropBlock[] = [];
        const enemySpawns: EnemySpawn[] = [];

        for (const b of def.blocks) {
            const mat = this.materials.get(b.material) ?? this.stoneMat;
            blocks.push(new Block(
                anchorX + b.x,
                anchorY - b.y - b.height,
                b.width,
                b.height,
                mat
            ));
        }

        for (const p of def.props) {
            const mat = this.materials.get(p.material) ?? this.woodMat;
            props.push(new Prop(
                anchorX + p.x,
                anchorY - p.y - p.height,
                p.width,
                p.height,
                mat
            ));
        }

        for (const e of def.enemies) {
            // y no JSON = altura dos pés acima do solo; inimigo tem 100px de altura
            enemySpawns.push({
                x: anchorX + e.x,
                y: anchorY - e.y - 100,
            });
        }

        for (const d of def.decor) {
            const color = Number(d.color);
            decor.push(new BackdropBlock(
                anchorX + d.x,
                anchorY - d.y - d.height,
                d.width,
                d.height,
                color,
                d.alpha
            ));
        }

        return { blocks, props, decor, enemySpawns };
    }

    private isInFlatZone(worldX: number): boolean {
        return this.flatZones.some(z => worldX >= z.x && worldX < z.right);
    }

    private generateLooseProps(zoneIndex: number): Prop[] {
        const props: Prop[] = [];
        const zoneStartX = zoneIndex * this.propZoneWidth;

        const rand1 = TerrainGenerator.rng(zoneIndex * 13 + 7 + this.seed);
        const rand2 = TerrainGenerator.rng(zoneIndex * 17 + 3 + this.seed);
        const rand3 = TerrainGenerator.rng(zoneIndex * 23 + 11 + this.seed);

        if (rand1 < 0.4) return props;

        const crateX = zoneStartX + Math.floor(rand2 * this.propZoneWidth);
        if (!this.isInFlatZone(crateX)) {
            const crateY = this.effectiveSurfaceHeight(crateX);
            const crateSize = 35 + Math.floor(TerrainGenerator.rng(zoneIndex * 29 + this.seed) * 15);
            props.push(new Prop(crateX, crateY - crateSize, crateSize, crateSize, this.woodMat));
        }

        if (rand3 > 0.6) {
            const barrelX = zoneStartX + Math.floor(TerrainGenerator.rng(zoneIndex * 31 + 5 + this.seed) * this.propZoneWidth);
            if (!this.isInFlatZone(barrelX)) {
                const barrelY = this.effectiveSurfaceHeight(barrelX);
                props.push(new Prop(barrelX, barrelY - 50, 30, 50, this.metalMat));
            }
        }

        return props;
    }

    // Retorna a altura efetiva do terreno em worldX:
    // - dentro de uma flat zone → anchorY constante
    // - na faixa de transição → lerp suave entre anchorY e onda
    // - fora → onda pura
    private effectiveSurfaceHeight(worldX: number): number {
        let closestZone: FlatZone | null = null;
        let closestDist = Infinity;

        for (const zone of this.flatZones) {
            if (worldX >= zone.x && worldX < zone.right) {
                return zone.anchorY;
            }
            const dist = worldX < zone.x
                ? zone.x - worldX
                : worldX - zone.right;
            if (dist < closestDist) {
                closestDist = dist;
                closestZone = zone;
            }
        }

        const wave = this.surfaceHeight(worldX);

        if (closestZone !== null && closestDist < this.flatTransition) {
            const t = closestDist / this.flatTransition;
            // ease-out: começa plano perto da estrutura, vai para onda gradualmente
            const blend = t * t;
            return closestZone.anchorY + (wave - closestZone.anchorY) * blend;
        }

        return wave;
    }

    private static rng(seed: number): number {
        const x = Math.sin(seed) * 1000000;
        return x - Math.floor(x);
    }

    private surfaceHeight(worldX: number): number {
        // seed-derived phase offsets so each run produces a different landscape
        const p1 = TerrainGenerator.rng(this.seed * 1.1 + 1) * Math.PI * 2;
        const p2 = TerrainGenerator.rng(this.seed * 1.7 + 2) * Math.PI * 2;
        const p3 = TerrainGenerator.rng(this.seed * 2.3 + 3) * Math.PI * 2;
        const amp = 55 + TerrainGenerator.rng(this.seed * 0.9 + 5) * 40;
        const baseLevel = 400;
        return (
            baseLevel +
            Math.sin(worldX * 0.002 + p1) * amp +
            Math.sin(worldX * 0.006 + p2) * 20 +
            Math.sin(worldX * 0.015 + p3) * 10
        );
    }
}
