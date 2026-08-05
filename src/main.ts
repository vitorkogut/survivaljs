import { Application } from "pixi.js";
import Game from "./game.js";

const app = new Application();
await app.init({
    resizeTo: window,
    background: "#222"
});
document.body.appendChild(app.canvas);

const game = await Game.create(app);

app.ticker.add((ticker) => {
    game.update(ticker.deltaTime);
});
