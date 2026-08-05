import Body from "./Body.js";
import type { MaterialData } from "../data/DataLoader.js";

export default class Block extends Body {
    readonly material: MaterialData;
    override gravity = false;

    constructor(
        x: number,
        y: number,
        width: number,
        height: number,
        material: MaterialData
    ) {
        super(x, y, width, height, material.color);
        this.material = material;
    }
}
