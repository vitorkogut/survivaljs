import type Player from "../entities/Player.js";
import type { GameData } from "../data/DataLoader.js";

export default class HUD {
    private readonly container: HTMLDivElement;
    private readonly weaponName: HTMLElement;
    private readonly ammoInfo: HTMLElement;

    constructor() {
        this.container = document.createElement("div");
        this.container.id = "hud";
        this.container.innerHTML = `
            <div id="hud-weapon-section">
                <div id="hud-weapon-name">Pistol</div>
                <div id="hud-ammo-info">
                    <span id="hud-magazine">12</span>
                    <span id="hud-separator">/</span>
                    <span id="hud-reserve">60</span>
                </div>
            </div>
        `;

        const style = document.createElement("style");
        style.textContent = `
            #hud {
                position: fixed;
                bottom: 20px;
                left: 20px;
                z-index: 1000;
                font-family: 'Courier New', monospace;
                color: #00ff00;
                text-shadow: 0 0 10px #00ff00;
                user-select: none;
                pointer-events: none;
            }

            #hud-weapon-section {
                display: flex;
                flex-direction: column;
                gap: 8px;
            }

            #hud-weapon-name {
                font-size: 18px;
                font-weight: bold;
                letter-spacing: 2px;
            }

            #hud-ammo-info {
                font-size: 16px;
                display: flex;
                align-items: center;
                gap: 4px;
                letter-spacing: 1px;
            }

            #hud-magazine {
                color: #ffff00;
                font-weight: bold;
            }

            #hud-separator {
                color: #00ff00;
            }

            #hud-reserve {
                color: #00aa00;
            }
        `;

        document.head.appendChild(style);
        document.body.appendChild(this.container);

        this.weaponName = this.container.querySelector("#hud-weapon-name")!;
        this.ammoInfo = this.container.querySelector("#hud-ammo-info")!;
    }

    update(player: Player, gameData: GameData): void {
        const gun = player.current_gun;
        const ammoType = gameData.ammoTypes.get(gun.ammoTypeId);

        if (!ammoType) return;

        this.weaponName.textContent = gun.name;

        const magazine = gun.currentMagazine;
        const reserve = player.inventory.getAmmo(gun.ammoTypeId);

        this.ammoInfo.innerHTML = `
            <span id="hud-magazine">${magazine}</span>
            <span id="hud-separator">/</span>
            <span id="hud-reserve">${reserve}</span>
        `;

        if (gun.reloading) {
            this.weaponName.textContent = gun.name + " [RELOADING...]";
            this.weaponName.style.color = "#ff6600";
        } else {
            this.weaponName.style.color = "#00ff00";
        }

        if (gun.isEmpty && !gun.reloading) {
            this.ammoInfo.style.color = "#ff0000";
        } else {
            this.ammoInfo.style.color = "#00ff00";
        }
    }

    destroy(): void {
        this.container.remove();
    }
}
