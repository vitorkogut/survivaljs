import type Player from "../entities/Player.js";
import type { GameData } from "../data/DataLoader.js";

export default class HUD {
    private readonly container: HTMLDivElement;
    private readonly weaponName: HTMLElement;
    private readonly magazineSpan: HTMLElement;
    private readonly reserveSpan: HTMLElement;
    private readonly hpFill: HTMLElement;
    private readonly hpText: HTMLElement;
    private readonly inventoryPanel: HTMLDivElement;
    private readonly inventoryWeapons: HTMLElement;
    private readonly inventoryAmmo: HTMLElement;

    constructor() {
        this.container = document.createElement("div");
        this.container.id = "hud";
        this.container.innerHTML = `
            <div id="hud-hp-section">
                <div id="hud-hp-label">HP</div>
                <div id="hud-hp-bar-bg">
                    <div id="hud-hp-fill"></div>
                </div>
                <div id="hud-hp-text">120 / 120</div>
            </div>
            <div id="hud-weapon-section">
                <div id="hud-weapon-name">Pistol</div>
                <div id="hud-ammo-info">
                    <span id="hud-magazine">12</span>
                    <span id="hud-separator">/</span>
                    <span id="hud-reserve">60</span>
                </div>
            </div>
        `;

        const controlsPanel = document.createElement("div");
        controlsPanel.id = "hud-controls";
        controlsPanel.innerHTML = `
            <div class="hud-ctrl-row"><span class="hud-ctrl-key">A / D</span><span class="hud-ctrl-desc">Mover</span></div>
            <div class="hud-ctrl-row"><span class="hud-ctrl-key">W / Espaço</span><span class="hud-ctrl-desc">Pular</span></div>
            <div class="hud-ctrl-row"><span class="hud-ctrl-key">Ctrl</span><span class="hud-ctrl-desc">Agachar</span></div>
            <div class="hud-ctrl-row"><span class="hud-ctrl-key">Click</span><span class="hud-ctrl-desc">Atirar</span></div>
            <div class="hud-ctrl-row"><span class="hud-ctrl-key">R</span><span class="hud-ctrl-desc">Recarregar</span></div>
            <div class="hud-ctrl-row"><span class="hud-ctrl-key">Q</span><span class="hud-ctrl-desc">Trocar arma</span></div>
            <div class="hud-ctrl-row"><span class="hud-ctrl-key">E</span><span class="hud-ctrl-desc">Inventário</span></div>
            <div class="hud-ctrl-row"><span class="hud-ctrl-key">Aproximar</span><span class="hud-ctrl-desc">Pegar item</span></div>
        `;

        this.inventoryPanel = document.createElement("div");
        this.inventoryPanel.id = "hud-inventory";
        this.inventoryPanel.innerHTML = `
            <div id="hud-inv-title">[ INVENTORY ]</div>
            <div id="hud-inv-columns">
                <div id="hud-inv-weapons-col">
                    <div class="hud-inv-header">WEAPONS</div>
                    <div id="hud-inv-weapons"></div>
                </div>
                <div id="hud-inv-divider"></div>
                <div id="hud-inv-ammo-col">
                    <div class="hud-inv-header">AMMO</div>
                    <div id="hud-inv-ammo"></div>
                </div>
            </div>
            <div id="hud-inv-hint">[E] Close  [Q] Switch Weapon</div>
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
                display: flex;
                flex-direction: column;
                gap: 12px;
            }

            #hud-hp-section {
                display: flex;
                flex-direction: column;
                gap: 4px;
            }

            #hud-hp-label {
                font-size: 11px;
                letter-spacing: 3px;
                color: #00aa00;
            }

            #hud-hp-bar-bg {
                width: 180px;
                height: 10px;
                background: #001a00;
                border: 1px solid #00ff0055;
                border-radius: 2px;
                overflow: hidden;
            }

            #hud-hp-fill {
                height: 100%;
                width: 100%;
                background: #00ff00;
                transition: width 0.15s ease, background 0.3s ease;
                box-shadow: 0 0 6px #00ff00aa;
            }

            #hud-hp-text {
                font-size: 12px;
                color: #00cc00;
                letter-spacing: 1px;
            }

            #hud-weapon-section {
                display: flex;
                flex-direction: column;
                gap: 8px;
            }

            #hud-controls {
                position: fixed;
                top: 20px;
                right: 20px;
                z-index: 1000;
                font-family: 'Courier New', monospace;
                color: #00aa00;
                text-shadow: 0 0 6px #00ff0066;
                user-select: none;
                pointer-events: none;
                background: rgba(0,0,0,0.45);
                border: 1px solid #00ff0033;
                padding: 12px 16px;
                border-radius: 4px;
                display: flex;
                flex-direction: column;
                gap: 5px;
            }

            .hud-ctrl-row {
                display: flex;
                gap: 10px;
                align-items: center;
                font-size: 11px;
            }

            .hud-ctrl-key {
                color: #ffff00;
                text-shadow: 0 0 6px #ffff0088;
                min-width: 80px;
                text-align: right;
                letter-spacing: 1px;
            }

            .hud-ctrl-desc {
                color: #008800;
                letter-spacing: 1px;
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

            #hud-inventory {
                position: fixed;
                top: 50%;
                left: 50%;
                transform: translate(-50%, -50%);
                background: rgba(0, 0, 0, 0.82);
                border: 2px solid #00ff00;
                box-shadow: 0 0 24px #00ff0066, inset 0 0 12px #00220011;
                padding: 28px 36px;
                min-width: 480px;
                z-index: 2000;
                font-family: 'Courier New', monospace;
                color: #00ff00;
                text-shadow: 0 0 8px #00ff00;
                user-select: none;
                pointer-events: none;
            }

            #hud-inv-title {
                font-size: 20px;
                font-weight: bold;
                letter-spacing: 4px;
                text-align: center;
                margin-bottom: 20px;
                color: #00ff00;
            }

            #hud-inv-columns {
                display: flex;
                gap: 0;
                align-items: flex-start;
            }

            #hud-inv-weapons-col {
                flex: 1;
                padding-right: 20px;
            }

            #hud-inv-divider {
                width: 2px;
                background: #00ff0044;
                min-height: 100px;
                align-self: stretch;
            }

            #hud-inv-ammo-col {
                flex: 1;
                padding-left: 20px;
            }

            .hud-inv-header {
                font-size: 12px;
                letter-spacing: 3px;
                color: #00aa00;
                margin-bottom: 10px;
                border-bottom: 1px solid #00ff0033;
                padding-bottom: 4px;
            }

            .hud-inv-weapon-row {
                font-size: 14px;
                margin-bottom: 8px;
                letter-spacing: 1px;
                display: flex;
                gap: 8px;
                align-items: center;
            }

            .hud-inv-weapon-row.active {
                color: #ffff00;
                text-shadow: 0 0 8px #ffff00;
            }

            .hud-inv-weapon-cursor {
                width: 14px;
                flex-shrink: 0;
            }

            .hud-inv-weapon-mag {
                color: #00aa00;
                font-size: 12px;
                margin-left: auto;
            }

            .hud-inv-ammo-row {
                font-size: 13px;
                margin-bottom: 8px;
                letter-spacing: 1px;
                display: flex;
                justify-content: space-between;
                gap: 12px;
            }

            .hud-inv-ammo-id {
                color: #00cc00;
            }

            .hud-inv-ammo-count {
                color: #ffff00;
                font-weight: bold;
            }

            #hud-inv-hint {
                margin-top: 20px;
                font-size: 11px;
                letter-spacing: 2px;
                color: #006600;
                text-align: center;
                border-top: 1px solid #00ff0022;
                padding-top: 10px;
            }
        `;

        document.head.appendChild(style);
        document.body.appendChild(this.container);
        document.body.appendChild(controlsPanel);
        document.body.appendChild(this.inventoryPanel);

        this.weaponName = this.container.querySelector("#hud-weapon-name")!;
        this.magazineSpan = this.container.querySelector("#hud-magazine")!;
        this.reserveSpan = this.container.querySelector("#hud-reserve")!;
        this.hpFill = this.container.querySelector("#hud-hp-fill")!;
        this.hpText = this.container.querySelector("#hud-hp-text")!;
        this.inventoryWeapons = this.inventoryPanel.querySelector("#hud-inv-weapons")!;
        this.inventoryAmmo = this.inventoryPanel.querySelector("#hud-inv-ammo")!;

        this.inventoryPanel.style.display = "none";
    }

    update(player: Player, gameData: GameData, showInventory: boolean): void {
        // HP bar
        const hpRatio = Math.max(0, player.hp / player.maxHp);
        this.hpFill.style.width = `${hpRatio * 100}%`;
        this.hpFill.style.background = hpRatio > 0.5 ? "#00ff00" : hpRatio > 0.25 ? "#ff9900" : "#ff2200";
        this.hpFill.style.boxShadow = `0 0 6px ${hpRatio > 0.5 ? "#00ff00aa" : hpRatio > 0.25 ? "#ff9900aa" : "#ff2200aa"}`;
        this.hpText.textContent = `${Math.ceil(player.hp)} / ${player.maxHp}`;

        const gun = player.current_gun;
        const ammoType = gameData.ammoTypes.get(gun.ammoTypeId);

        if (!ammoType) return;

        this.magazineSpan.textContent = String(gun.currentMagazine);
        this.reserveSpan.textContent = String(player.inventory.getAmmo(gun.ammoTypeId));

        if (gun.reloading) {
            this.weaponName.textContent = gun.name + " [RELOADING...]";
            this.weaponName.style.color = "#ff6600";
        } else {
            this.weaponName.textContent = gun.name + " (Q)";
            this.weaponName.style.color = "#00ff00";
        }

        const ammoColor = gun.isEmpty && !gun.reloading ? "#ff0000" : "#00ff00";
        this.magazineSpan.style.color = gun.isEmpty ? "#ff0000" : "#ffff00";
        this.reserveSpan.style.color = ammoColor;

        // Inventory panel
        this.inventoryPanel.style.display = showInventory ? "block" : "none";

        if (showInventory) {
            // Weapons list
            let weaponsHtml = "";
            for (let i = 0; i < player.guns.length; i++) {
                const g = player.guns[i]!;
                const isActive = i === player.current_gun_index;
                const cursor = isActive ? "►" : " ";
                const reserveAmmo = player.inventory.getAmmo(g.ammoTypeId);
                weaponsHtml += `
                    <div class="hud-inv-weapon-row${isActive ? " active" : ""}">
                        <span class="hud-inv-weapon-cursor">${cursor}</span>
                        <span>${g.name}</span>
                        <span class="hud-inv-weapon-mag">${g.currentMagazine}/${reserveAmmo}</span>
                    </div>`;
            }
            this.inventoryWeapons.innerHTML = weaponsHtml;

            // Ammo list
            let ammoHtml = "";
            for (const [id, data] of gameData.ammoTypes) {
                const count = player.inventory.getAmmo(id);
                ammoHtml += `
                    <div class="hud-inv-ammo-row">
                        <span class="hud-inv-ammo-id">${data.name}</span>
                        <span class="hud-inv-ammo-count">${count}</span>
                    </div>`;
            }
            this.inventoryAmmo.innerHTML = ammoHtml;
        }
    }

    destroy(): void {
        this.container.remove();
        this.inventoryPanel.remove();
    }
}
