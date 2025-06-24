import { AnimationStrategy } from "./AnimationStrategy";

// Import all ability strategies
import { EnergyWaveAbility } from "./abilities/EnergyWave";
import { WhirlwindAbility } from "./abilities/Whirlwind";
import { FireballAbility } from "./abilities/Fireball";
import { SwordSlashAbility } from "./abilities/SwordSlash";
import { FireWallAbility } from "./abilities/FireWall";
import { BashAbility } from "./abilities/Bash";
import { FocusAbility } from "./abilities/Focus";
import { PowerShotAbility } from "./abilities/PowerShot";
import { RainOfArrowsAbility } from "./abilities/RainOfArrows";
import { BoneSpikeAbility } from "./abilities/BoneSpike";

// Import strategies for animation types
import { DirectionalStrategy } from "./strategies/DirectionalStrategy";
import { ExpandingStrategy } from "./strategies/ExpandingStrategy";
import { ProjectileStrategy } from "./strategies/ProjectileStrategy";
import { TileGridStrategy } from "./strategies/TileGridStrategy";

/**
 * Centralizes all ability implementations and provides access to them
 */
export class AbilityRegistry {
  private static strategies: Record<string, AnimationStrategy> = {};

  /**
   * Initialize the ability registry with all ability strategies
   */
  static initialize(): void {
    try {
      // Clear the strategies first in case this gets called multiple times
      this.strategies = {};

      // Register specific ability implementations
      this.register("energyWave", new EnergyWaveAbility());
      this.register("whirlwind", new WhirlwindAbility());
      this.register("fireball", new FireballAbility());
      this.register("swordSlash", new SwordSlashAbility());
      this.register("fireWall", new FireWallAbility());
      this.register("bash", new BashAbility());
      this.register("powerShot", new PowerShotAbility());
      this.register("focus", new FocusAbility());
      this.register("rainOfArrows", new RainOfArrowsAbility());
      this.register("boneSpike", new BoneSpikeAbility());

      // Register general animation type strategies
      // These will be used as fallbacks when no specific ability strategy exists
      this.register("directional", new DirectionalStrategy());
      this.register("expanding", new ExpandingStrategy());
      this.register("projectile", new ProjectileStrategy());
      this.register("piercingProjectile", new PowerShotAbility());
      this.register("tileGrid", new TileGridStrategy());
      this.register("buff", new FocusAbility());
      this.register("tileBasedEnergyWave", new EnergyWaveAbility());
      this.register("rainOfArrows", new RainOfArrowsAbility());
    } catch (error) {
      console.error("Error initializing AbilityRegistry:", error);
    }
  }

  /**
   * Register a new ability strategy
   */
  static register(name: string, strategy: AnimationStrategy): void {
    if (this.strategies[name]) {
      console.warn(`AbilityRegistry: Overwriting existing strategy for '${name}'`);
    }
    this.strategies[name] = strategy;
  }

  /**
   * Get a strategy by name
   */
  static getStrategy(name: string): AnimationStrategy {
    const strategy = this.strategies[name];
    if (!strategy) {
      console.warn(`AbilityRegistry: No strategy found for '${name}', using fallback`);
      // Return a default fallback strategy if needed
      return this.strategies["directional"] || Object.values(this.strategies)[0];
    }
    return strategy;
  }

  /**
   * Check if a strategy exists
   */
  static hasStrategy(name: string): boolean {
    return !!this.strategies[name];
  }

  /**
   * Get all registered strategy names
   */
  static getStrategyNames(): string[] {
    return Object.keys(this.strategies);
  }
}
