import Body from "./Body.js";

// Bloco puramente visual: parece uma parede mas não tem colisão,
// não bloqueia projéteis e não bloqueia LOS de inimigos.
export default class BackdropBlock extends Body {
    override gravity = false;

    constructor(
        x: number,
        y: number,
        width: number,
        height: number,
        color: number,
        alpha: number
    ) {
        super(x, y, width, height, color);
        this.view.alpha = alpha;
    }
}
