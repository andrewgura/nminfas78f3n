import { Ability } from "@/types";
import { eventBus } from "../utils/EventBus";

// Define a proper interface for the class
export interface IAbilityDictionary {
  getAbility(abilityId: string): Ability | null;
  getAbilitiesForWeaponType(weaponType: string, slot: string): Ability[];
  getAbilitiesForSkill(skillId: string): Ability[];
  getAnimationType(abilityId: string): string;
}

class AbilityDictionaryService implements IAbilityDictionary {
  private abilityDatabase: Record<string, Ability> = {};

  constructor() {
    this.initializeAbilities();
  }

  private initializeAbilities(): void {
    try {
      // 1h melee
      this.abilityDatabase.swordSlash = {
        id: "swordSlash",
        name: "Sword Slash",
        description: "A basic sword attack that deals damage to enemies in front of you.",
        icon: "assets/abilities/sword-slash.png",
        cooldown: 1,
        damage: 2,
        weaponType: "weapon",
        requiredWeapon: "melee",
        skillId: "meleeWeapons",
        range: 60,
        animationType: "directional",
        animationConfig: {
          arcAngle: Math.PI / 2, // 90 degrees arc
          effectDuration: 300,
          lineWidth: 3,
        },
      };

      this.abilityDatabase.whirlwind = {
        id: "whirlwind",
        name: "Whirlwind",
        description: "Spin around with your sword, damaging all nearby enemies.",
        icon: "assets/abilities/whirlwind.png",
        cooldown: 1,
        damage: 1,
        weaponType: "weapon",
        requiredWeapon: "melee",
        skillId: "meleeWeapons",
        areaSize: 100,
        animationType: "tileGrid",
        animationConfig: {
          gridSize: 5, // 5x5 grid (player + 2 tiles in each direction)
          effectDuration: 800,
          particleCount: 10,
        },
      };

      // 2h melee
      this.abilityDatabase.bash = {
        id: "bash",
        name: "Bash",
        description: "A powerful strike that stuns enemies directly in front of you.",
        icon: "assets/abilities/bash.png",
        cooldown: 1,
        damage: 3,
        weaponType: "weapon",
        requiredWeapon: "melee",
        skillId: "meleeWeapons",
        minSkillLevel: 2,
        range: 40,
        animationType: "directional",
        animationConfig: {
          arcAngle: Math.PI / 4, // 45 degrees arc
          effectDuration: 400,
          lineWidth: 5,
          particleColors: [0xffcc00, 0xff9900],
        },
      };

      // Fireball spell (for mages)
      this.abilityDatabase.fireball = {
        id: "fireball",
        name: "Fireball",
        description:
          "Launch a ball of fire that travels in a straight line, exploding on impact with enemies or obstacles.",
        icon: "assets/abilities/fireball.png",
        cooldown: 1,
        damage: 3,
        weaponType: "weapon",
        requiredWeapon: "magic",
        skillId: "magic",
        range: 250,
        areaSize: 64,
        animationType: "projectile",
        animationConfig: {
          projectileSpeed: 250,
          explosionRadius: 64,
          particleColors: [0xff0000, 0xff7700, 0xffff00],
          effectDuration: 1000,
        },
      };

      // Ice Nova (for mages)
      this.abilityDatabase.iceNova = {
        id: "iceNova",
        name: "Ice Nova",
        description: "Create an expanding ring of ice that damages and slows enemies.",
        icon: "assets/abilities/ice_nova.png",
        cooldown: 1,
        damage: 2,
        weaponType: "weapon",
        requiredWeapon: "magic",
        skillId: "magic",
        areaSize: 128,
        animationType: "expanding",
        animationConfig: {
          expansionTime: 500,
          ringWidth: 8,
          startRadius: 32,
          endRadius: 128,
          particleColors: [0xaaddff, 0x00aaff, 0xffffff],
          effectDuration: 1200,
        },
      };

      // Fire Wall ability
      this.abilityDatabase.fireWall = {
        id: "fireWall",
        name: "Fire Wall",
        description:
          "Create a wall of fire that damages enemies passing through it every 0.5 seconds.",
        icon: "assets/abilities/firewall.png",
        cooldown: 1, // Increased cooldown to balance continuous damage
        damage: 1, // Damage per tick (every 0.5 seconds)
        weaponType: "weapon",
        requiredWeapon: "magic",
        skillId: "magic",
        minSkillLevel: 2,
        range: 120,
        animationType: "directional",
        animationConfig: {
          wallLength: 160, // Length of the wall
          wallWidth: 40, // Increased width for better hit detection
          effectDuration: 5000, // 5 seconds duration
          particleColors: [0xff4500, 0xff7f00, 0xffff00],
          lineWidth: 4,
          arcAngle: Math.PI / 6,
        },
      };

      // Energy Wave ability
      this.abilityDatabase.energyWave = {
        id: "energyWave",
        name: "Energy Wave",
        description:
          "Release a powerful wave of arcane energy that damages enemies in a cone in front of you.",
        icon: "assets/abilities/energy-wave.png",
        cooldown: 2,
        damage: 2,
        weaponType: "weapon",
        requiredWeapon: "magic",
        skillId: "magic",
        minSkillLevel: 3,
        range: 140,
        animationType: "tileBasedEnergyWave", // Use the new strategy
        animationConfig: {
          effectDuration: 800,
          patternType: "cone", // For future pattern variations
          particleColors: [0x00aaff, 0x0088ff, 0x66ccff], // Blue energy colors
        },
      };

      // 1. Power Shot - Fast piercing projectile
      this.abilityDatabase.powerShot = {
        id: "powerShot",
        name: "Power Shot",
        description: "Fire a high-velocity arrow that pierces through enemies in a straight line.",
        icon: "assets/abilities/power-shot.png",
        cooldown: 1,
        damage: 2,
        weaponType: "weapon",
        requiredWeapon: "archery",
        skillId: "archery",
        range: 384, // 12 tiles at 32px per tile
        animationType: "piercingProjectile", // New animation type for piercing projectiles
        animationConfig: {
          projectileSpeed: 500, // Faster than fireball
          effectDuration: 800,
          particleColors: [0xdddddd, 0xbbbbbb, 0xffffff], // Arrow-like colors
          piercing: true, // Indicates the projectile should pierce through enemies
        },
      };

      // 2. Focus - Buff ability
      this.abilityDatabase.focus = {
        id: "focus",
        name: "Focus",
        description: "Increase your attack speed for 10 seconds.",
        icon: "assets/abilities/focus.png",
        cooldown: 1,
        damage: 0, // No direct damage
        weaponType: "weapon",
        requiredWeapon: "archery",
        skillId: "archery",
        animationType: "buff",
        animationConfig: {
          effectDuration: 10000, // 10 seconds
          buffType: "attackSpeed",
          buffMultiplier: 1.5, // 50% faster attacks
          particleColors: [0xffdd00, 0xffaa00], // Gold/yellow for buffs
        },
      };

      // 3. Rain of Arrows - Area effect at cursor position
      this.abilityDatabase.rainOfArrows = {
        id: "rainOfArrows",
        name: "Rain of Arrows",
        description:
          "Create a storm of arrows at your target location, dealing damage to all enemies in the area.",
        icon: "assets/abilities/rain-of-arrows.png",
        cooldown: 1,
        damage: 1, // Damage per tick
        weaponType: "weapon",
        requiredWeapon: "archery",
        skillId: "archery",
        minSkillLevel: 2,
        range: 256, // Maximum distance from player to target
        areaSize: 128, // 4x4 tiles (32px per tile)
        animationType: "rainOfArrows", // Custom animation type
        animationConfig: {
          effectDuration: 5000, // 5 seconds total
          damageInterval: 500, // 0.5 seconds per tick
          particleColors: [0xdddddd, 0xbbbbbb, 0xaaaaaa], // Arrow-like colors
          areaSize: 128, // 4x4 tiles
          targetable: true, // Can be targeted with cursor
        },
      };

      //Bone Spike
      this.abilityDatabase.boneSpike = {
        id: "boneSpike",
        name: "Bone Spike",
        description:
          "Summons razor-sharp bone spikes at the target location, dealing more damage to enemies in the center.",
        icon: "assets/abilities/bone-spike.png",
        cooldown: 1.5,
        damage: 15, // Center damage (outer damage will be 70% of this)
        weaponType: "trinket", // Special type for item-granted abilities
        requiredWeapon: "any", // Can be used with any weapon type
        skillId: "magic", // Uses magic skill for progression
        range: 200,
        areaSize: 96, // 3x3 tiles
        animationType: "boneSpike",
        animationConfig: {
          effectDuration: 1500,
          pulseDelay: 700, // Delay before spike animation
          particleColors: [0xffffff, 0xf0f0f0, 0xe0e0e0],
        },
      };

      // Emit initialization event
      eventBus.emit("abilityDictionary.initialized", {
        count: Object.keys(this.abilityDatabase).length,
      });

      console.log(
        `AbilityDictionary initialized with ${Object.keys(this.abilityDatabase).length} abilities`
      );
    } catch (error) {
      console.error("Error initializing abilities:", error);
    }
  }

  getAbility(abilityId: string): Ability | null {
    return this.abilityDatabase[abilityId] || null;
  }

  getAbilitiesForWeaponType(weaponType: string, slot: string): Ability[] {
    try {
      return Object.values(this.abilityDatabase).filter((ability) => {
        return ability.weaponType === slot && ability.requiredWeapon === weaponType;
      });
    } catch (error) {
      console.error("Error getting abilities for weapon type:", error);
      return [];
    }
  }

  getAbilitiesForSkill(skillId: string): Ability[] {
    try {
      return Object.values(this.abilityDatabase).filter((ability) => {
        return ability.skillId === skillId;
      });
    } catch (error) {
      console.error("Error getting abilities for skill:", error);
      return [];
    }
  }

  getAnimationType(abilityId: string): string {
    try {
      const ability = this.getAbility(abilityId);
      return ability?.animationType || "none";
    } catch (error) {
      console.error("Error getting animation type:", error);
      return "none";
    }
  }

  getAllAbilities(): Ability[] {
    return Object.values(this.abilityDatabase);
  }
}

// Create a singleton instance
export const AbilityDictionary = new AbilityDictionaryService();
