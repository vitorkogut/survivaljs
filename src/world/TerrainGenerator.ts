import Block from "../entities/Block.js";
import Prop from "../entities/Prop.js";
import type { GameData, MaterialData } from "../data/DataLoader.js";

function seededRandom(seed: number): number {
    const x = Math.sin(seed) * 1000000;
    return x - Math.floor(x);
}

export interface GeneratedTerrain {
    readonly blocks: Block[];
    readonly props: Prop[];
}

export default class TerrainGenerator {
    private readonly generatedColumns = new Set<number>();
    private readonly generatedFillChunks = new Set<number>();
    private readonly generatedPropZones = new Set<number>();

    private readonly columnWidth = 20;
    private readonly fillChunkWidth = 160;
    private readonly propZoneWidth = 300;
    private readonly fillDepth = 400;

    private readonly grassMat: MaterialData;
    private readonly dirtMat: MaterialData;
    private readonly stoneMat: MaterialData;
    private readonly woodMat: MaterialData;
    private readonly metalMat: MaterialData;

    private readonly grassHeight = 12;
    private readonly dirtHeight = 60;

    constructor(gameData: GameData) {
        this.grassMat = gameData.materials.get("grass")!;
        this.dirtMat = gameData.materials.get("dirt")!;
        this.stoneMat = gameData.materials.get("stone")!;
        this.woodMat = gameData.materials.get("wood")!;
        this.metalMat = gameData.materials.get("metal")!;
    }

    generateChunksAround(centerX: number, visibilityRange: number = 1600): GeneratedTerrain {
        const blocks: Block[] = [];
        const props: Prop[] = [];

        // camadas de superfície em resolução alta (20px)
        const minCol = Math.floor((centerX - visibilityRange) / this.columnWidth);
        const maxCol = Math.floor((centerX + visibilityRange) / this.columnWidth);

        for (let col = minCol; col <= maxCol; col++) {
            if (this.generatedColumns.has(col)) continue;
            this.generatedColumns.add(col);

            const x = col * this.columnWidth;
            const surfaceY = this.surfaceHeight(x);

            blocks.push(
                new Block(x, surfaceY, this.columnWidth, this.grassHeight, this.grassMat)
            );
            blocks.push(
                new Block(x, surfaceY + this.grassHeight, this.columnWidth, this.dirtHeight, this.dirtMat)
            );
        }

        // preenchimento profundo em resolução baixa (160px)
        const minFill = Math.floor((centerX - visibilityRange) / this.fillChunkWidth);
        const maxFill = Math.floor((centerX + visibilityRange) / this.fillChunkWidth);

        for (let chunk = minFill; chunk <= maxFill; chunk++) {
            if (this.generatedFillChunks.has(chunk)) continue;
            this.generatedFillChunks.add(chunk);

            const chunkX = chunk * this.fillChunkWidth;

            let minSurfaceY = Infinity;
            for (let x = chunkX; x < chunkX + this.fillChunkWidth; x += this.columnWidth) {
                const sy = this.surfaceHeight(x);
                if (sy < minSurfaceY) minSurfaceY = sy;
            }

            const fillTop = minSurfaceY + this.grassHeight + this.dirtHeight;
            blocks.push(
                new Block(chunkX, fillTop, this.fillChunkWidth, this.fillDepth, this.stoneMat)
            );
        }

        // props (caixas e barris) a cada zona
        const minProp = Math.floor((centerX - visibilityRange) / this.propZoneWidth);
        const maxProp = Math.floor((centerX + visibilityRange) / this.propZoneWidth);

        for (let zone = minProp; zone <= maxProp; zone++) {
            if (this.generatedPropZones.has(zone)) continue;
            this.generatedPropZones.add(zone);

            const zoneProps = this.generateProps(zone);
            props.push(...zoneProps);
        }

        return { blocks, props };
    }

    private generateProps(zoneIndex: number): Prop[] {
        const props: Prop[] = [];
        const zoneStartX = zoneIndex * this.propZoneWidth;

        const rand1 = seededRandom(zoneIndex * 13 + 7);
        const rand2 = seededRandom(zoneIndex * 17 + 3);
        const rand3 = seededRandom(zoneIndex * 23 + 11);

        // ~60% de chance de ter pelo menos um prop
        if (rand1 < 0.4) return props;

        // caixa de madeira
        const crateX = zoneStartX + Math.floor(rand2 * this.propZoneWidth);
        const crateSurfaceY = this.surfaceHeight(crateX);
        const crateSize = 35 + Math.floor(seededRandom(zoneIndex * 29) * 15);
        props.push(
            new Prop(crateX, crateSurfaceY - crateSize, crateSize, crateSize, this.woodMat)
        );

        // ~40% de chance de um barril de metal também
        if (rand3 > 0.6) {
            const barrelX = zoneStartX + Math.floor(seededRandom(zoneIndex * 31 + 5) * this.propZoneWidth);
            const barrelSurfaceY = this.surfaceHeight(barrelX);
            props.push(
                new Prop(barrelX, barrelSurfaceY - 50, 30, 50, this.metalMat)
            );
        }

        return props;
    }

    private surfaceHeight(worldX: number): number {
        const baseLevel = 400;
        return (
            baseLevel +
            Math.sin(worldX * 0.002 + 1.3) * 210 +
            Math.sin(worldX * 0.006 + 2.7) * 50 +
            Math.sin(worldX * 0.015 + 0.5) * 20
        );
    }
}
