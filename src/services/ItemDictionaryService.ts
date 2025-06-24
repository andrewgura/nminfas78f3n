import { ItemData, ItemCategory, ItemSets, ItemType } from "@/types";
import { eventBus } from "../utils/EventBus";

// ITEM_DATA import moved to internal service
const ITEM_DATA: Record<string, ItemData> = {
  // Melee Weapons
  sword1: {
    id: "sword1",
    name: "Iron Sword",
    category: ItemCategory.WEAPON_MELEE,
    type: ItemType.WEAPON,
    weaponType: "melee",
    power: 2,
    armor: 2,
    weight: 10,
    description: "A simple but reliable iron sword. Standard issue for new adventurers.",
    texture: "commoner-sword",
    attackSpeed: 1000,
    isTwoHanded: false,
    rarity: "common",
    sellValue: 10,
  },

  fireSword: {
    id: "fireSword",
    name: "Fire Sword",
    category: ItemCategory.WEAPON_MELEE,
    type: ItemType.WEAPON,
    weaponType: "melee",
    power: 4,
    armor: 2,
    weight: 10,
    description: "A magical sword engulfed in flames. Deal bonus magic damage",
    texture: "fire-sword",
    isTwoHanded: false,
    rarity: "common",
    sellValue: 10,
  },

  boneClub: {
    id: "boneClub",
    name: "Bone Club",
    category: ItemCategory.WEAPON_MELEE,
    type: ItemType.WEAPON,
    weaponType: "melee",
    power: 2,
    armor: 2,
    weight: 10,
    description: "Fashioned out of a femur bone.",
    set: ItemSets.SKELETAL_SET,
    setBonus: {
      melee: 1,
    },
    texture: "bone-club",
    isTwoHanded: false,
    rarity: "common",
    sellValue: 10,
  },

  greatSword: {
    id: "greatSword",
    name: "Great Sword",
    category: ItemCategory.WEAPON_MELEE,
    type: ItemType.WEAPON,
    weaponType: "melee",
    power: 3,
    armor: 2,
    weight: 10,
    description: "A two-handed sword that deals heavy damage.",
    texture: "great-sword",
    isTwoHanded: true,
    rarity: "common",
    sellValue: 10,
  },

  // Magic Weapons
  woodenStaff: {
    id: "woodenStaff",
    name: "Wooden Staff",
    category: ItemCategory.WEAPON_MAGIC,
    type: ItemType.WEAPON,
    weaponType: "magic",
    power: 2,
    armor: 2,
    weight: 10,
    description: "A simple wooden staff for casting spells.",
    texture: "wooden-staff",
    isTwoHanded: true,
    rarity: "common",
    sellValue: 10,
    moveSpeed: 500,
  },

  boneWand: {
    id: "boneWand",
    name: "Bone Wand",
    category: ItemCategory.WEAPON_MAGIC,
    type: ItemType.WEAPON,
    weaponType: "magic",
    power: 2,
    armor: 2,
    weight: 10,
    description: "Fashioned out of a tibia bone.",
    set: ItemSets.SKELETAL_SET,
    setBonus: {
      magic: 1,
    },
    texture: "bone-wand",
    isTwoHanded: false,
    rarity: "common",
    sellValue: 10,
  },

  // Ranged Weapons
  twigBow: {
    id: "twigBow",
    name: "Twig Bow",
    category: ItemCategory.WEAPON_RANGED,
    type: ItemType.WEAPON,
    weaponType: "archery",
    power: 2,
    armor: 2,
    weight: 10,
    description: "A simple bow made from flexible twigs.",
    texture: "twig-bow",
    isTwoHanded: true,
    rarity: "common",
    sellValue: 10,
  },

  throwableSkull: {
    id: "throwableSkull",
    name: "Throwable Skull",
    category: ItemCategory.WEAPON_RANGED,
    type: ItemType.WEAPON,
    weaponType: "archery",
    power: 2,
    armor: 2,
    weight: 10,
    description: "Chuck it as hard as you want, it always comes back.",
    set: ItemSets.SKELETAL_SET,
    setBonus: {
      archery: 1,
    },
    texture: "throwable-skull",
    rarity: "common",
    sellValue: 10,
  },

  // shields + offhands
  boneShield: {
    id: "boneShield",
    name: "Bone Shield",
    category: ItemCategory.SHIELD,
    type: ItemType.OFFHAND,
    armor: 3,
    weight: 10,
    description: "Wooden shield plated with bones",
    set: ItemSets.SKELETAL_SET,
    setBonus: {
      armor: 1,
    },
    texture: "bone-shield",
    rarity: "common",
    sellValue: 10,
  },

  // Chests
  skeletalArmor: {
    id: "skeletalArmor",
    name: "Skeletal Armor",
    category: ItemCategory.ARMOR,
    type: ItemType.ARMOR,
    armor: 1,
    set: ItemSets.SKELETAL_SET,
    setBonus: {
      health: 20,
    },
    weight: 10,
    description: "A cheap coat encased in skeletal ribs.",
    texture: "skeletal-armor",
    rarity: "common",
    sellValue: 10,
  },

  // Trinkets
  boneCharm: {
    id: "boneCharm",
    name: "Bone Charm",
    category: ItemCategory.TRINKET,
    type: ItemType.TRINKET,
    armor: 1,
    set: ItemSets.SKELETAL_SET,
    setBonus: {
      manaRegen: 1,
      healthRegen: 1,
    },
    bonusSkills: ["boneSpike"],
    weight: 10,
    description: "Bone charm",
    texture: "bone-charm",
    rarity: "common",
    sellValue: 10,
  },

  // Helmets
  skullCap: {
    id: "skullCap",
    name: "Skull Cap",
    category: ItemCategory.HELMET,
    type: ItemType.HELMET,
    armor: 1,
    set: ItemSets.SKELETAL_SET,
    setBonus: {
      mana: 20,
    },
    weight: 10,
    description: "A hollowed out skull.",
    texture: "skull-cap",
    rarity: "common",
    sellValue: 10,
  },

  // Amulets
  skeletalMedallion: {
    id: "skeletalMedallion",
    name: "Skeletal Medallion",
    category: ItemCategory.AMULET,
    type: ItemType.AMULET,
    armor: 2,
    set: ItemSets.SKELETAL_SET,
    setBonus: {
      moveSpeed: 200,
    },
    weight: 10,
    description: "skeletalMedallion",
    texture: "skeletal-medallion",
    rarity: "common",
    sellValue: 10,
  },

  // PRODUCTS
  shinySkull: {
    id: "shinySkull",
    name: "Shiny Skull",
    type: ItemType.PRODUCT,
    category: ItemCategory.PRODUCT,
    weight: 10,
    stackable: true,
    description: "A shiny skull",
    texture: "shiny-skull",
  },

  // FOOD
  eggs: {
    id: "eggs",
    name: "Eggs",
    type: ItemType.FOOD,
    category: ItemCategory.FOOD,
    weight: 2,
    texture: "eggs",
    hpRegen: 1,
    mpRegen: 3,
    stackable: true,
  },
  chickenLegs: {
    id: "chickenLegs",
    name: "Chicken Legs",
    type: ItemType.FOOD,
    category: ItemCategory.FOOD,
    weight: 2,
    texture: "chicken-legs",
    hpRegen: 3,
    mpRegen: 1,
    stackable: true,
  },
  dirtyFish: {
    id: "dirtyFish",
    name: "Dirty Fish",
    type: ItemType.FOOD,
    category: ItemCategory.FOOD,
    weight: 2,
    texture: "dirty-fish",
    hpRegen: 2,
    mpRegen: 2,
    stackable: true,
  },

  goldCoins: {
    id: "goldCoins",
    name: "Gold Coins",
    type: ItemType.PRODUCT,
    category: ItemCategory.CURRENCY,
    weight: 0.1,
    stackable: true,
    description: "Shiny gold coins used as currency throughout the realm",
    texture: "gold-coins",
    sellValue: 1,
  },
};

// Define interface for the class
export interface IItemDictionary {
  getItem(itemId: string): ItemData | null;
  getItemName(itemId: string): string;
  getItemType(itemId: string): string;
  getWeaponType(itemId: string): string | null;
  getItemTexture(itemId: string): string;
  canEquipInSlot(itemId: string, slotType: string): boolean;
  getItemsByCategory(category: ItemCategory): ItemData[];
  getAllWeapons(): ItemData[];
  getAllItems(): Record<string, ItemData>;
  getItemsBySet(setType: string): ItemData[];
}

class ItemDictionaryService {
  private itemDatabase: Record<string, ItemData> = {};

  constructor() {
    this.itemDatabase = { ...ITEM_DATA };
  }

  getItem(itemId: string): ItemData | null {
    return this.itemDatabase[itemId] || null;
  }

  getItemType(itemId: string): string {
    return this.itemDatabase[itemId]?.type || "misc";
  }

  getWeaponType(itemId: string): string | null {
    const item = this.getItem(itemId);
    return item?.weaponType || null;
  }

  getItemTexture(itemId: string): string {
    return this.itemDatabase[itemId]?.texture || "item-placeholder";
  }

  canEquipInSlot(itemId: string, slotType: string): boolean {
    const itemType = this.getItemType(itemId);
    return itemType === slotType;
  }

  getItemsByCategory(category: ItemCategory): ItemData[] {
    return Object.values(this.itemDatabase).filter((item) => item.category === category);
  }

  getAllWeapons(): ItemData[] {
    return Object.values(this.itemDatabase).filter((item) => item.type === ItemType.WEAPON);
  }

  getAllItems(): Record<string, ItemData> {
    return { ...this.itemDatabase };
  }

  getItemsBySet(setType: string): ItemData[] {
    return Object.values(this.itemDatabase).filter((item) => item.set === setType);
  }

  // Helper method to get folder path for item icons
  getItemFolder(item: ItemData): string {
    const categoryToFolderMap: Record<string, string> = {
      weapon_melee: "melee-weapons",
      weapon_magic: "magic",
      weapon_ranged: "ranged",
      armor: "chest",
      shield: "offhand",
      helmet: "helmet",
      amulet: "necklace",
      trinket: "trinket",
      food: "food",
      product: "products",
      currency: "valuables",
      material: "valuables",
      consumable: "valuables",
      quest: "valuables",
    };

    return categoryToFolderMap[item.category!];
  }
}

// Create a singleton instance
export const ItemDictionary = new ItemDictionaryService();
