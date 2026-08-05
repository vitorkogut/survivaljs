import type { Container } from "pixi.js";

// classe base para todas as entidades do jogo.
// `abstract` = nao pode ser instanciada direto, so herdada.
export default abstract class Entity {
    // toda entidade precisa ter algo desenhavel na tela.
    // como e' abstract, o TS obriga cada subclasse a fornecer isso.
    abstract readonly view: Container;

    // marcado por quem quiser: o World recolhe no fim do frame.
    // nunca remova a entidade no meio do loop -- isso corrompe a iteracao.
    dead = false;

    // avanca a logica da entidade. dt = delta time em frames.
    update(_dt: number): void {}

    // sincroniza o estado da entidade com o que aparece na tela.
    draw(): void {}

    // solta os recursos de GPU e sai do grafo de cena.
    // `children: true` leva os filhos junto (ex: a arma pendurada no player).
    destroy(): void {
        this.view.removeFromParent();
        this.view.destroy({ children: true });
    }
}
