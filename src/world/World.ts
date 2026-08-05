import type { Container } from "pixi.js";
import { sound } from "@pixi/sound";
import Entity from "../entities/Entity.js";
import Body from "../entities/Body.js";
import Block from "../entities/Block.js";
import Prop from "../entities/Prop.js";
import Projectile from "../entities/projectiles/Projectile.js";
import type BodyPart from "../entities/BodyPart.js";
import Player from "../entities/Player.js";
import Enemy from "../entities/Enemy.js";

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

    constructor(private readonly root: Container) {}

    add<T extends Entity>(entity: T): T {
        this.entities.push(entity);
        this.root.addChild(entity.view);
        return entity;
    }

    update(dt: number): void {
        for (const entity of [...this.entities]) {
            entity.update(dt);
        }

        this.simulate(dt);

        for (const entity of this.entities) {
            entity.draw();
        }

        this.removeDead();
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

        for (const e of this.entities) {
            if (e instanceof Block) blocks.push(e);
            else if (e instanceof Prop) props.push(e);
            else if (e instanceof Projectile) projectiles.push(e);
            else if (e instanceof Enemy) enemies.push(e);
        }

        // 1. Props: física + colisão com blocos estáticos
        for (const prop of props) {
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

        // 2b. Enemies: física + colisão com blocos e props
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

        this.playImpactSound(block.material.soundPath, projectile.x, projectile.y);
    }

    private onProjectileHitProp(projectile: Projectile, prop: Prop): void {
        prop.applyImpact(projectile.vx, projectile.vy, projectile.x, projectile.y);
        projectile.dead = true;

        this.playImpactSound(prop.material.soundPath, projectile.x, projectile.y);
    }

    private playImpactSound(soundPath: string, x: number, y: number): void {
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
            } else if (body.vx < 0) {
                body.x = solid.colRight - (body.colX - body.x);
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
