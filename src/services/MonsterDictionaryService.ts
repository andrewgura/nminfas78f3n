import { MonsterData, ItemDrop, MonsterCategory, MonsterAttackType } from "@/types";
import { eventBus } from "../utils/EventBus";

// MONSTER_DATA import moved to internal service
const MONSTER_DATA: Record<string, MonsterData> = {
  "decayed-skeleton": {
    id: "decayed-skeleton",
    name: "Decayed Skeleton",
    category: MonsterCategory.UNDEAD,
    sprite: "assets/sprites/skeleton.png",
    health: 12,
    maxHealth: 12,
    speed: 150,
    experience: 40,
    damage: 10,
    armor: 10,
    drops: [{ itemId: "sword1", chance: 0.75 }],
    isAggressive: true,
    attackType: MonsterAttackType.Melee,
    runawayPercent: 0,
    description: "A decayed Skeleton.",
    color: 0xb0e0e6,
    scale: 1,
  },

  // Dark Elf Category
  "dark-elf-mage": {
    id: "dark-elf-mage",
    name: "Dark Elf Mage",
    category: MonsterCategory.DARK_ELF,
    sprite: "assets/sprites/skeleton.png",
    health: 12,
    maxHealth: 12,
    speed: 100,
    experience: 40,
    damage: 10,
    armor: 10,
    drops: [{ itemId: "sword1", chance: 0.75 }],
    abilities: ["fireball"],
    isAggressive: true,
    attackType: MonsterAttackType.Magic,
    runawayPercent: 20,
    description: "A skilled practitioner of dark magic from the underground cities.",
  },

  "dark-elf-knight": {
    id: "dark-elf-knight",
    name: "Dark Elf Knight",
    category: MonsterCategory.DARK_ELF,
    sprite: "assets/sprites/skeleton.png",
    health: 25,
    maxHealth: 25,
    speed: 80,
    experience: 60,
    damage: 15,
    armor: 20,
    drops: [
      { itemId: "greatSword", chance: 0.5 },
      { itemId: "sword1", chance: 0.8 },
    ],
    abilities: ["swordSlash"],
    isAggressive: true,
    attackType: MonsterAttackType.Melee,
    runawayPercent: 0,
    description: "A powerful warrior from the dark elf realm, skilled in melee combat.",
  },

  "dark-elf-archer": {
    id: "dark-elf-archer",
    name: "Dark Elf Archer",
    category: MonsterCategory.DARK_ELF,
    sprite: "assets/sprites/skeleton.png",
    health: 15,
    maxHealth: 15,
    speed: 110,
    experience: 50,
    damage: 12,
    armor: 8,
    drops: [{ itemId: "twigBow", chance: 0.4 }],
    abilities: ["powerShot"],
    isAggressive: true,
    attackType: MonsterAttackType.Ranged,
    runawayPercent: 30,
    description: "A nimble archer who prefers to attack from a distance.",
  },
};

class MonsterDictionaryService {
  private monsters: Record<string, MonsterData> = {};

  constructor() {
    this.initialize();
  }

  private initialize(): void {
    try {
      // Register all monsters from the data
      Object.values(MONSTER_DATA).forEach((monster) => {
        this.registerMonster(monster);
      });

      // Emit initialization event
      eventBus.emit("monsterDictionary.initialized", {
        count: Object.keys(this.monsters).length,
      });

      console.log(
        `MonsterDictionary initialized with ${Object.keys(this.monsters).length} monsters`
      );
    } catch (error) {
      console.error("Error initializing monster dictionary:", error);
    }
  }

  registerMonster(data: MonsterData): void {
    try {
      // Validate required fields
      if (!data.id || !data.name) {
        console.error("Invalid monster data: missing required fields", data);
        return;
      }

      // Add the monster to the dictionary
      this.monsters[data.id] = data;
    } catch (error) {
      console.error("Error registering monster:", error);
    }
  }

  getMonster(id: string): MonsterData | null {
    try {
      return this.monsters[id] || null;
    } catch (error) {
      console.error("Error getting monster:", error);
      return null;
    }
  }

  getMonsterNames(): string[] {
    try {
      return Object.values(this.monsters).map((monster) => monster.name);
    } catch (error) {
      console.error("Error getting monster names:", error);
      return [];
    }
  }

  getMonsterIds(): string[] {
    try {
      return Object.keys(this.monsters);
    } catch (error) {
      console.error("Error getting monster IDs:", error);
      return [];
    }
  }

  getMonstersByCategory(category: MonsterCategory): MonsterData[] {
    try {
      return Object.values(this.monsters).filter((monster) => monster.category === category);
    } catch (error) {
      console.error("Error getting monsters by category:", error);
      return [];
    }
  }

  getDrops(monsterId: string): ItemDrop[] {
    try {
      const monster = this.getMonster(monsterId);
      return monster?.drops || [];
    } catch (error) {
      console.error("Error getting monster drops:", error);
      return [];
    }
  }

  getHealth(monsterId: string): number {
    try {
      const monster = this.getMonster(monsterId);
      return monster?.health || 100;
    } catch (error) {
      console.error("Error getting monster health:", error);
      return 100;
    }
  }

  getMaxHealth(monsterId: string): number {
    try {
      const monster = this.getMonster(monsterId);
      return monster?.maxHealth || 100;
    } catch (error) {
      console.error("Error getting monster max health:", error);
      return 100;
    }
  }

  // Combat properties
  getAttackType(monsterId: string): string {
    try {
      const monster = this.getMonster(monsterId);
      return monster?.attackType || "melee";
    } catch (error) {
      console.error("Error getting monster attack type:", error);
      return "melee";
    }
  }

  isAggressive(monsterId: string): boolean {
    try {
      const monster = this.getMonster(monsterId);
      return monster?.isAggressive || false;
    } catch (error) {
      console.error("Error getting monster aggression:", error);
      return false;
    }
  }

  getRunawayPercent(monsterId: string): number {
    try {
      const monster = this.getMonster(monsterId);
      return monster?.runawayPercent || 0;
    } catch (error) {
      console.error("Error getting monster runaway percent:", error);
      return 0;
    }
  }

  // Get all monsters
  getAllMonsters(): Record<string, MonsterData> {
    return { ...this.monsters };
  }

  // Get experience reward
  getExperienceReward(monsterId: string): number {
    try {
      const monster = this.getMonster(monsterId);
      return monster?.experience || 0;
    } catch (error) {
      console.error("Error getting monster experience reward:", error);
      return 0;
    }
  }
}

// Create a singleton instance
export const MonsterDictionary = new MonsterDictionaryService();

// Export a simplified array of monsters for backward compatibility
export const Monsters = Object.values(MONSTER_DATA).map((monster) => ({
  name: monster.name,
  sprite: monster.sprite,
}));
