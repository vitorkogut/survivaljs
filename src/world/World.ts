import { Container } from "pixi.js";
import { sound } from "@pixi/sound";
import Entity from "../entities/Entity.js";
import Body from "../entities/Body.js";
import Block from "../entities/Block.js";
import Prop from "../entities/Prop.js";
import BackdropBlock from "../entities/BackdropBlock.js";
import Projectile from "../entities/projectiles/Projectile.js";
import Pickup from "../entities/Pickup.js";

import type BodyPart from "../entities/BodyPart.js";
import Player from "../entities/Player.js";
import Enemy from "../entities/Enemy.js";
import type { GameData } from "../data/DataLoader.js";

const HITMARKER_SOUND = "sounds/hitmarker_2.mp3";

const BODY_PART_DAMAGE: Record<string, number> = {
    head: 40,
    torso: 10,
    left_arm: 15,
    right_arm: 15,
    left_leg: 10,
    right_leg: 10,
};

export default class World {
    readonly entities: Entity[] = [];
    player: Player | null = null;

    private readonly maxStepHeight = 20;

    // Sub-container dedicado ao decor: renderiza atrás de tudo que vai para root.
    // Dentro dele a ordem é preservada (backdrop antes, vegetação depois).
    private readonly decorRoot: Container;

    constructor(private readonly root: Container, private readonly gameData: GameData) {
        this.decorRoot = new Container();
        this.root.addChildAt(this.decorRoot, 0);
        sound.add(HITMARKER_SOUND, HITMARKER_SOUND);
    }

    add<T extends Entity>(entity: T): T {
        this.entities.push(entity);
        this.root.addChild(entity.view);
        return entity;
    }

    // Decor vai para decorRoot (sempre atrás de terreno/entidades).
    // Backdrops adicionados antes de vegetação → backdrop atrás, vegetação na frente.
    addDecor(entity: BackdropBlock): void {
        this.entities.push(entity);
        this.decorRoot.addChild(entity.view);
    }

    update(dt: number): void {
        for (const entity of [...this.entities]) {
            entity.update(dt);
        }

        this.simulate(dt);
        this.checkPickups();

        for (const entity of this.entities) {
            entity.draw();
        }

        this.removeDead();
    }

    // Oculta entidades fora da viewport para o PixiJS não renderizá-las.
    // Deve ser chamado após camera.update() a cada frame.
    cull(viewLeft: number, viewTop: number, viewRight: number, viewBottom: number): void {
        const margin = 300;
        const left = viewLeft - margin;
        const top = viewTop - margin;
        const right = viewRight + margin;
        const bottom = viewBottom + margin;

        for (const entity of this.entities) {
            if (!(entity instanceof Body)) continue;
            entity.view.visible =
                entity.right > left &&
                entity.x < right &&
                entity.bottom > top &&
                entity.y < bottom;
        }
    }

    private checkPickups(): void {
        if (!this.player || this.player.dead) return;
        for (const e of this.entities) {
            if (e instanceof Pickup && !e.dead) e.tryPickup(this.player);
        }
    }

    private removeDead(): void {
        for (let i = this.entities.length - 1; i >= 0; i--) {
            const entity = this.entities[i]!;
            if (!entity.dead) continue;

            entity.destroy();
            this.entities.splice(i, 1);
        }
    }

    private simulate(dt: number): void {
        const blocks: Block[] = [];
        const props: Prop[] = [];
        const projectiles: Projectile[] = [];
        const enemies: Enemy[] = [];

        // Raio de física centrado no player — expandido para cobrir todas as
        // entidades dinâmicas ativas, garantindo que blocos sob inimigos,
        // props e projéteis distantes ainda entrem na resolução de colisão.
        const physRange = 1600;
        const cx = this.player ? this.player.x + this.player.width / 2 : 0;
        const cy = this.player ? this.player.y + this.player.height / 2 : 0;

        let physMinX = cx - physRange;
        let physMaxX = cx + physRange;
        let physMinY = cy - physRange;
        let physMaxY = cy + physRange;

        for (const e of this.entities) {
            if (e instanceof Enemy || e instanceof Projectile ||
                (e instanceof Prop && e.activated)) {
                const ex = e.x;
                const ey = e.y;
                if (ex - 300 < physMinX) physMinX = ex - 300;
                if (ex + e.width + 300 > physMaxX) physMaxX = ex + e.width + 300;
                if (ey - 300 < physMinY) physMinY = ey - 300;
                if (ey + e.height + 600 > physMaxY) physMaxY = ey + e.height + 600;
            }
        }

        const pickups: Pickup[] = [];

        for (const e of this.entities) {
            if (e instanceof Block) {
                if (e.right > physMinX && e.x < physMaxX &&
                    e.bottom > physMinY && e.y < physMaxY) {
                    blocks.push(e);
                }
            } else if (e instanceof Prop) props.push(e);
            else if (e instanceof Projectile) projectiles.push(e);
            else if (e instanceof Enemy) enemies.push(e);
            else if (e instanceof Pickup) pickups.push(e);
        }

        // 1. Props: física + colisão com blocos estáticos (apenas os ativados)
        for (const prop of props) {
            if (!prop.activated) continue;

            prop.applyGravity(dt);

            prop.integrateX(dt);
            this.resolveX(prop, blocks);

            prop.grounded = false;
            prop.integrateY(dt);
            this.resolveY(prop, blocks);
        }

        // 2. Player: física + colisão com blocos E props
        if (this.player) {
            const playerSolids: Body[] = [...blocks, ...props];

            this.player.applyGravity(dt);

            this.player.integrateX(dt);
            this.resolveX(this.player, playerSolids);

            this.player.grounded = false;
            this.player.integrateY(dt);
            this.resolveY(this.player, playerSolids);
        }

        // 2b. Pickups: física + colisão com blocos
        for (const pickup of pickups) {
            pickup.applyGravity(dt);
            pickup.integrateX(dt);
            this.resolveX(pickup, blocks);
            pickup.grounded = false;
            pickup.integrateY(dt);
            this.resolveY(pickup, blocks);
        }

        // 2c. Enemies: física + colisão com blocos e props
        const enemySolids: Body[] = [...blocks, ...props];
        for (const enemy of enemies) {
            enemy.applyGravity(dt);

            enemy.integrateX(dt);
            this.resolveX(enemy, enemySolids);

            enemy.grounded = false;
            enemy.integrateY(dt);
            this.resolveY(enemy, enemySolids);
        }

        // 3. Projéteis: substeps para evitar tunneling em objetos pequenos
        for (const proj of projectiles) {
            proj.applyGravity(dt);

            const maxStep = 10;
            const speed = Math.max(Math.abs(proj.vx), Math.abs(proj.vy));
            const steps = Math.ceil((speed * dt) / maxStep);
            const subDt = dt / steps;

            for (let i = 0; i < steps && !proj.dead; i++) {
                proj.integrateX(subDt);
                this.checkProjectileCollisions(proj, blocks, props, enemies);
                if (proj.dead) break;

                proj.integrateY(subDt);
                this.checkProjectileCollisions(proj, blocks, props, enemies);
            }
        }
    }

    private checkProjectileCollisions(
        projectile: Projectile,
        blocks: readonly Block[],
        props: readonly Prop[],
        enemies: readonly Enemy[]
    ): void {
        for (const block of blocks) {
            if (!projectile.intersects(block)) continue;
            this.onProjectileHitBlock(projectile, block);
            return;
        }

        for (const prop of props) {
            if (!projectile.intersects(prop)) continue;
            this.onProjectileHitProp(projectile, prop);
            return;
        }

        if (this.player && !(projectile.owner instanceof Player)) {
            const hit = this.checkBodyPartHit(projectile, this.player, this.player.bodyParts);
            if (hit) {
                const dmg = (BODY_PART_DAMAGE[hit.name] ?? 10) * projectile.damageMultiplier;
                this.player.takeDamage(dmg);
                projectile.dead = true;
                return;
            }
        }

        for (const enemy of enemies) {
            if (projectile.owner === enemy) continue;
            const hit = this.checkBodyPartHit(projectile, enemy, enemy.bodyParts);
            if (hit) {
                const dmg = (BODY_PART_DAMAGE[hit.name] ?? 10) * projectile.damageMultiplier;
                enemy.takeDamage(dmg);
                projectile.dead = true;
                if (projectile.owner instanceof Player) {
                    sound.play(HITMARKER_SOUND, { volume: 0.6 });
                }
                return;
            }
        }
    }

    private checkBodyPartHit(
        projectile: Projectile,
        owner: Body,
        parts: readonly BodyPart[]
    ): BodyPart | null {
        const px = projectile.x + projectile.width / 2;
        const py = projectile.y + projectile.height / 2;

        for (const part of parts) {
            const wx = owner.x + part.view.position.x;
            const wy = owner.y + part.view.position.y;
            const wh = part.height * part.view.scale.y;

            if (px >= wx && px <= wx + part.width && py >= wy && py <= wy + wh) {
                return part;
            }
        }
        return null;
    }

    private onProjectileHitBlock(projectile: Projectile, block: Block): void {
        projectile.dead = true;

        this.playSpatialSound(block.material.soundPath, projectile.x, projectile.y);
    }

    private onProjectileHitProp(projectile: Projectile, prop: Prop): void {
        prop.applyImpact(projectile.vx, projectile.vy, projectile.x, projectile.y);
        prop.takeDamage(projectile.damageMultiplier * 10);
        projectile.dead = true;

        this.playSpatialSound(prop.material.soundPath, projectile.x, projectile.y);

        if (prop.dead) this.spawnPropLoot(prop);
    }

    private spawnPropLoot(prop: Prop): void {
        const cx = prop.x + prop.width / 2 - 11;
        const cy = prop.y - 20;

        if (Math.random() < 0.2) {
            const usable = this.gameData.guns.filter(g => !g.enemyUsable);
            const all = this.gameData.guns;
            const pool = usable.length > 0 ? usable : all;
            const gunData = pool[Math.floor(Math.random() * pool.length)]!;
            const ammoData = this.gameData.ammoTypes.get(gunData.ammoType)!;
            this.add(new Pickup(cx, cy, {
                type: "weapon",
                gunData,
                projectileStats: ammoData.projectile,
            }));
        } else {
            this.add(new Pickup(cx, cy, { type: "health", amount: 30 }));
        }
    }

    playSpatialSound(soundPath: string, x: number, y: number): void {
        if (!this.player) return;

        const dx = x - this.player.x;
        const dy = y - this.player.y;
        const distance = Math.sqrt(dx * dx + dy * dy);

        const maxDist = 5000;
        const fullVolDist = 200;
        const t = distance <= fullVolDist
            ? 0
            : (distance - fullVolDist) / (maxDist - fullVolDist);
        const volume = Math.max(0, (1 - t) * (1 - t)) * 0.25;

        if (volume <= 0) return;

        if (!sound.exists(soundPath)) {
            sound.add(soundPath, soundPath);
        }
        sound.play(soundPath, { volume });
    }

    // Retorna true se há um bloco ou prop bloqueando o caminho horizontal do body
    // na direção dada (+1 direita, -1 esquerda) que seja alto demais para ser pisado.
    isBlockedAhead(body: Body, direction: number): boolean {
        const probeW = 20;
        const probeX = direction > 0 ? body.colRight : body.colX - probeW;
        const probeYTop = body.colY + this.maxStepHeight + 1;
        const probeYBot = body.colBottom;
        if (probeYBot <= probeYTop) return false;
        for (const e of this.entities) {
            if (e === body) continue;
            if (!(e instanceof Block || e instanceof Prop)) continue;
            if (e.colRight <= probeX || e.colX >= probeX + probeW) continue;
            if (e.colBottom <= probeYTop || e.colY >= probeYBot) continue;
            return true;
        }
        return false;
    }

    // Retorna true se o segmento de (x1,y1) até (x2,y2) não é bloqueado por
    // blocos, props ou corpos de outros inimigos. Passa `shooter` para excluir
    // o próprio inimigo do teste.
    hasLineOfSight(x1: number, y1: number, x2: number, y2: number, shooter?: Enemy): boolean {
        for (const e of this.entities) {
            if (e === shooter) continue;
            if (e instanceof Block || e instanceof Prop) {
                if (this.segmentIntersectsAABB(x1, y1, x2, y2, e.colX, e.colY, e.colRight, e.colBottom))
                    return false;
            } else if (e instanceof Enemy) {
                if (this.segmentIntersectsAABB(x1, y1, x2, y2, e.x, e.y, e.x + e.width, e.y + e.height))
                    return false;
            }
        }
        return true;
    }

    // Liang-Barsky: interseção segmento vs AABB
    private segmentIntersectsAABB(
        x1: number, y1: number, x2: number, y2: number,
        left: number, top: number, right: number, bottom: number
    ): boolean {
        const dx = x2 - x1;
        const dy = y2 - y1;
        let tMin = 0;
        let tMax = 1;

        const clip = (p: number, q: number): boolean => {
            if (p === 0) return q >= 0;
            const t = q / p;
            if (p < 0) { if (t > tMax) return false; if (t > tMin) tMin = t; }
            else        { if (t < tMin) return false; if (t < tMax) tMax = t; }
            return true;
        };

        return clip(-dx, x1 - left) && clip(dx, right - x1) &&
               clip(-dy, y1 - top)  && clip(dy, bottom - y1);
    }

    private resolveX(body: Body, solids: readonly Body[]): void {
        for (const solid of solids) {
            if (!body.intersects(solid)) continue;

            const overlap = body.colBottom - solid.colY;

            if (overlap > 0 && overlap <= this.maxStepHeight && body.grounded) {
                body.y = solid.colY - (body.colBottom - body.y);
                body.grounded = true;
                continue;
            }

            if (body.vx > 0) {
                body.x = solid.colX - (body.colRight - body.x);
                body.touchingWallRight = true;
            } else if (body.vx < 0) {
                body.x = solid.colRight - (body.colX - body.x);
                body.touchingWallLeft = true;
            }
            body.vx = 0;
        }
    }

    private resolveY(body: Body, solids: readonly Body[]): void {
        for (const solid of solids) {
            if (!body.intersects(solid)) continue;

            if (body.vy > 0) {
                body.y = solid.colY - (body.colBottom - body.y);
                body.grounded = true;
            } else if (body.vy < 0) {
                body.y = solid.colBottom - (body.colY - body.y);
            }
            body.vy = 0;
        }
    }
}
