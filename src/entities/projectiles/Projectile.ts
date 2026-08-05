import Body from "../Body.js";

export interface ProjectileStats {
    readonly width: number;
    readonly height: number;
    readonly color: number;
    readonly speed: number;
    readonly lifetimeSeconds: number;
    readonly gravityScale: number;
    readonly damageMultiplier: number;
}

export default class Projectile extends Body {
    readonly lifetimeSeconds: number;
    readonly damageMultiplier: number;
    owner: Body | null = null;
    private ageSeconds = 0;

    constructor(x: number, y: number, angle: number, stats: ProjectileStats) {
        super(
            x - stats.width / 2,
            y - stats.height / 2,
            stats.width,
            stats.height,
            stats.color
        );

        this.gravityScale = stats.gravityScale;
        this.lifetimeSeconds = stats.lifetimeSeconds;
        this.damageMultiplier = stats.damageMultiplier;

        this.vx = Math.cos(angle) * stats.speed;
        this.vy = Math.sin(angle) * stats.speed;
    }

    override update(dt: number): void {
        super.update(dt);

        this.ageSeconds += dt / 60;

        if (this.ageSeconds >= this.lifetimeSeconds) {
            this.dead = true;
        }
    }
}
