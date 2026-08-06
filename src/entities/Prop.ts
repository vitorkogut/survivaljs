import Body from "./Body.js";
import type { MaterialData } from "../data/DataLoader.js";

export default class Prop extends Body {
    readonly material: MaterialData;
    readonly mass: number;
    readonly friction = 0.85;
    readonly angularFriction = 0.88;
    readonly maxHp: number;
    hp: number;

    // props começam estáticos; física só ativa após receberem impacto
    activated = false;
    override gravity = false;

    rotation = 0;
    angularVelocity = 0;

    constructor(
        x: number,
        y: number,
        width: number,
        height: number,
        material: MaterialData
    ) {
        super(x, y, width, height, material.color);
        this.material = material;
        this.mass = Math.max((material.density * width * height) / 1000, 5);
        this.maxHp = this.hpForMaterial(material.id);
        this.hp = this.maxHp;

        this.view.pivot.set(width / 2, height / 2);
    }

    // AABB efetivo do retângulo rotacionado
    private get effectiveHalfW(): number {
        const cos = Math.abs(Math.cos(this.rotation));
        const sin = Math.abs(Math.sin(this.rotation));
        return (this.width / 2) * cos + (this.height / 2) * sin;
    }

    private get effectiveHalfH(): number {
        const cos = Math.abs(Math.cos(this.rotation));
        const sin = Math.abs(Math.sin(this.rotation));
        return (this.width / 2) * sin + (this.height / 2) * cos;
    }

    private get centerX(): number { return this.x + this.width / 2; }
    private get centerY(): number { return this.y + this.height / 2; }

    override get colX(): number { return this.centerX - this.effectiveHalfW; }
    override get colY(): number { return this.centerY - this.effectiveHalfH; }
    override get colRight(): number { return this.centerX + this.effectiveHalfW; }
    override get colBottom(): number { return this.centerY + this.effectiveHalfH; }

    private hpForMaterial(id: string): number {
        switch (id) {
            case "wood":  return 25;
            case "metal": return 50;
            default:      return Infinity; // terreno é indestrutível
        }
    }

    takeDamage(amount: number): void {
        if (this.maxHp === Infinity) return;
        this.hp = Math.max(0, this.hp - amount);
        if (this.hp <= 0) this.dead = true;
    }

    applyImpact(
        projectileVx: number,
        projectileVy: number,
        hitX: number,
        hitY: number
    ): void {
        this.activated = true;
        this.gravity = true;
        const force = 0.5;

        this.vx += (projectileVx * force) / this.mass;
        this.vy += (projectileVy * force) / this.mass;

        const rx = hitX - this.centerX;
        const ry = hitY - this.centerY;
        const torque = rx * projectileVy - ry * projectileVx;

        const inertia =
            (this.mass * (this.width * this.width + this.height * this.height)) / 12;
        this.angularVelocity += (torque * force) / Math.max(inertia, 10);
    }

    override update(dt: number): void {
        if (!this.activated) return;
        super.update(dt);

        this.vx *= this.friction;
        if (Math.abs(this.vx) < 0.01) this.vx = 0;

        // gravidade angular: quando no chão, tombar para a orientação estável mais próxima
        if (this.grounded) {
            const stableAngle = Math.round(this.rotation / (Math.PI / 2)) * (Math.PI / 2);
            const diff = stableAngle - this.rotation;
            this.angularVelocity += diff * 0.08;
            // fricção extra no chão para assentar rápido
            this.angularVelocity *= 0.92;
        }

        this.rotation += this.angularVelocity * dt;
        this.angularVelocity *= this.angularFriction;
        if (Math.abs(this.angularVelocity) < 0.001) this.angularVelocity = 0;

        // snap para o ângulo estável quando quase parado
        if (this.grounded && Math.abs(this.angularVelocity) === 0) {
            const stableAngle = Math.round(this.rotation / (Math.PI / 2)) * (Math.PI / 2);
            if (Math.abs(this.rotation - stableAngle) < 0.05) {
                this.rotation = stableAngle;
            }
        }
    }

    override draw(): void {
        this.view.position.set(this.centerX, this.centerY);
        this.view.rotation = this.rotation;
    }
}
