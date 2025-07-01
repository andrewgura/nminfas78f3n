import { create } from "zustand";
import { subscribeWithSelector } from "zustand/middleware";
import {
  PlayerCharacterEquipment,
  ItemInstance,
  ItemBonusStats,
  SetCollectionData,
  Quest,
} from "../types";

import { ItemInstanceManager } from "../utils/ItemInstanceManager";
import { ItemDictionary } from "../services/ItemDictionaryService";
import { eventBus } from "../utils/EventBus";
import {
  SKILL_PROGRESSION,
  calculatePointsForNextLevel,
  calculateLevelFromExperience,
} from "@/utils/SkillProgressionFormula";

// SIMPLIFIED: Calculate stats interface with single move speed
export interface CalculatedStats {
  // Total stats including base + equipment + skills
  totalHealth: number;
  totalMana: number;
  totalPower: number;
  totalArmor: number;
  totalMoveSpeed: number; // SIMPLIFIED: Single move speed value (base 250)
  totalAttackSpeed: number;
  totalHealthRegen: number;
  totalManaRegen: number;
  totalCapacity: number;

  // Equipment bonuses only
  equipmentBonuses: {
    health: number;
    mana: number;
    power: number;
    armor: number;
    moveSpeed: number;
    attackSpeed: number;
    healthRegen: number;
    manaRegen: number;
    capacity: number;
    melee: number;
  };
}

// Define the store state structure
export interface GameState {
  // Player properties
  playerCharacter: {
    health: number;
    maxHealth: number;
    lastAttackTime: number;
    experience: number;
    equipment: PlayerCharacterEquipment;
    inventory: ItemInstance[];
    skills: {
      [key: string]: {
        level: number;
        experience: number;
        maxExperience: number;
      };
    };
    gold: number;
    maxCapacity: number;
    currentCapacity: number;
    teleportPosition?: { x: number; y: number };
  };

  // Calculated stats
  calculatedStats: CalculatedStats;

  // Game state
  quests: {
    active: Quest[];
    completed: Quest[];
  };

  // UI state
  inputFocused: boolean;

  // Collection state
  setCollections: SetCollectionData;

  // Map state
  currentMap: string;

  // System references
  systems?: Record<string, any>;

  // Methods
  registerSystem: (name: string, system: any) => void;
  updatePlayerMap: (mapKey: string) => void;
  updatePlayerHealth: (health: number) => void;
  updatePlayerMaxHealth: (maxHealth: number) => void;
  updatePlayerExperience: (experience: number) => void;
  updatePlayerLevel: (level: number) => void;
  setPlayerCharacterEquipment: (equipment: PlayerCharacterEquipment, source?: string) => void;
  setInputFocused: (focused: boolean) => void;
  updateSetCollections: (collections: SetCollectionData) => void;
  updateSkill: (skillId: string, newExperience: number) => void;
  getItemInstanceById: (instanceId: string) => ItemInstance | undefined;
  addItemInstanceToInventory: (itemInstance: ItemInstance) => boolean;
  removeItemInstanceFromInventory: (instanceId: string, quantity?: number) => boolean;
  updatePlayerGold: (amount: number) => void;
  updatePlayerMaxCapacity: (amount: number) => void;
  updatePlayerCurrentCapacity: (amount: number) => void;
  recalculateStats: () => void;
}

// Helper functions for calculating stats
const calculateEquipmentBonuses = (equipment: PlayerCharacterEquipment) => {
  const bonuses = {
    health: 0,
    mana: 0,
    power: 0,
    armor: 0,
    moveSpeed: 0,
    attackSpeed: 0,
    healthRegen: 0,
    manaRegen: 0,
    capacity: 0,
    melee: 0,
  };

  // Track equipped sets for set bonuses
  const equippedSets: Record<string, ItemInstance[]> = {};

  Object.values(equipment).forEach((itemInstance) => {
    if (!itemInstance) return;

    // Get combined stats (base + bonuses) - this already includes bonusStats
    const itemData = ItemInstanceManager.getCombinedStats(itemInstance);
    if (itemData) {
      bonuses.power += itemData.power || 0;
      bonuses.armor += itemData.armor || 0;
      bonuses.healthRegen += itemData.hpRegen || 0;
      bonuses.manaRegen += itemData.mpRegen || 0;
      bonuses.health += itemData.health || 0;
      bonuses.mana += itemData.mana || 0;
      bonuses.moveSpeed += itemData.moveSpeed || 0;
      bonuses.attackSpeed += itemData.attackSpeed || 0;
      bonuses.capacity += itemData.capacity || 0;
      bonuses.melee += itemData.melee || 0;

      // Track sets - store the actual item instances
      if (itemData.set) {
        if (!equippedSets[itemData.set]) {
          equippedSets[itemData.set] = [];
        }
        equippedSets[itemData.set].push(itemInstance);
      }
    }
  });

  // Apply set bonuses for sets with 2+ pieces
  Object.entries(equippedSets).forEach(([setName, items]) => {
    if (items.length >= 2) {
      // Apply set bonus from each equipped set piece
      items.forEach((item) => {
        const itemData = ItemInstanceManager.getCombinedStats(item);
        if (itemData?.setBonus) {
          bonuses.power += itemData.setBonus.power || 0;
          bonuses.armor += itemData.setBonus.armor || 0;
          bonuses.health += itemData.setBonus.health || 0;
          bonuses.mana += itemData.setBonus.mana || 0;
          bonuses.moveSpeed += itemData.setBonus.moveSpeed || 0;
          bonuses.attackSpeed += itemData.setBonus.attackSpeed || 0;
          bonuses.healthRegen += itemData.setBonus.healthRegen || 0;
          bonuses.manaRegen += itemData.setBonus.manaRegen || 0;
          bonuses.capacity += itemData.setBonus.capacity || 0;
          bonuses.melee += itemData.setBonus.melee || 0;
        }
      });
    }
  });

  return bonuses;
};

// SIMPLIFIED: Calculate total stats with much cleaner move speed
const calculateTotalStats = (playerCharacter: any, equipmentBonuses: any): CalculatedStats => {
  const skills = playerCharacter.skills;

  // Base values from skills and player stats
  const baseHealth = playerCharacter.maxHealth;
  const baseMana = (skills.mana?.level || 10) * 10;
  const basePower = 0;
  const baseArmor = 0;
  const baseCapacity = playerCharacter.maxCapacity;
  const baseHealthRegen = skills.healthRegen?.level || 1;
  const baseManaRegen = skills.manaRegen?.level || 1;
  const baseAttackSpeed = skills.attackSpeed?.level || 1;

  // SIMPLIFIED: Move speed calculation
  const baseMoveSpeed = 250; // Base player move speed
  const moveSpeedSkillLevel = skills.moveSpeed?.level || 1;
  const skillBonus = moveSpeedSkillLevel - 1; // Each level above 1 adds +1
  const totalMoveSpeed = Math.max(50, baseMoveSpeed + skillBonus + equipmentBonuses.moveSpeed);

  return {
    totalHealth: baseHealth + equipmentBonuses.health,
    totalMana: baseMana + equipmentBonuses.mana,
    totalPower: basePower + equipmentBonuses.power,
    totalArmor: baseArmor + equipmentBonuses.armor,
    totalMoveSpeed: totalMoveSpeed, // Single value for both display and movement
    totalAttackSpeed: baseAttackSpeed + equipmentBonuses.attackSpeed,
    totalHealthRegen: baseHealthRegen + equipmentBonuses.healthRegen,
    totalManaRegen: baseManaRegen + equipmentBonuses.manaRegen,
    totalCapacity: baseCapacity + equipmentBonuses.capacity,
    equipmentBonuses,
  };
};

// SIMPLIFIED: Initial calculated stats with base 250 move speed
const initialCalculatedStats: CalculatedStats = {
  totalHealth: 100,
  totalMana: 100,
  totalPower: 0,
  totalArmor: 0,
  totalMoveSpeed: 325, // Base move speed of 250
  totalAttackSpeed: 1,
  totalHealthRegen: 1,
  totalManaRegen: 1,
  totalCapacity: 40,
  equipmentBonuses: {
    health: 0,
    mana: 0,
    power: 0,
    armor: 0,
    moveSpeed: 0,
    attackSpeed: 0,
    healthRegen: 0,
    manaRegen: 0,
    capacity: 0,
    melee: 0,
  },
};

// Initial state
const initialState = {
  playerCharacter: {
    health: 100,
    maxHealth: 100,
    lastAttackTime: 0,
    experience: 0,
    equipment: {
      weapon: null,
      shield: null,
      trinket: null,
      helmet: null,
      amulet: null,
      armor: null,
    } as PlayerCharacterEquipment,
    inventory: [
      ItemInstanceManager.createItemInstance("sword1"),
      ItemInstanceManager.createItemInstance("greatSword", { power: 1 }),
      ItemInstanceManager.createItemInstance("woodenStaff"),
      ItemInstanceManager.createItemInstance("twigBow"),
      ItemInstanceManager.createItemInstance("boneClub"),
      ItemInstanceManager.createItemInstance("boneCharm"),
      ItemInstanceManager.createItemInstance("skullCap"),
      ItemInstanceManager.createItemInstance("skeletalMedallion"),
      ItemInstanceManager.createItemInstance("boneShield"),
      ItemInstanceManager.createItemInstance("skeletalArmor"),
      ItemInstanceManager.createFoodInstance("eggs", 5),
      ItemInstanceManager.createFoodInstance("chickenLegs", 3),
      ItemInstanceManager.createFoodInstance("dirtyFish", 2),
      ItemInstanceManager.createProductInstance("shinySkull", 2),
    ],
    skills: {
      // Main combat skills
      playerLevel: { level: 1, experience: 0, maxExperience: 100 },
      meleeWeapons: { level: 1, experience: 0, maxExperience: 15 },
      archery: { level: 1, experience: 0, maxExperience: 15 },
      magic: { level: 1, experience: 0, maxExperience: 15 },
      shield: { level: 1, experience: 0, maxExperience: 20 },

      // Additional skills
      power: { level: 1, experience: 0, maxExperience: 15 },
      armor: { level: 1, experience: 0, maxExperience: 20 },

      // Regeneration skills
      healthRegen: { level: 1, experience: 0, maxExperience: 15 },
      manaRegen: { level: 1, experience: 0, maxExperience: 15 },

      // Movement and speed skills
      moveSpeed: { level: 1, experience: 0, maxExperience: 15 },
      attackSpeed: { level: 1, experience: 0, maxExperience: 15 },

      // Utility skills
      capacity: { level: 1, experience: 0, maxExperience: 15 },
      mana: { level: 10, experience: 0, maxExperience: 15 },
    },
    gold: 100,
    maxCapacity: 40,
    currentCapacity: 10,
  },
  calculatedStats: initialCalculatedStats,
  quests: {
    active: [],
    completed: [],
  },
  inputFocused: false,
  setCollections: {},
  currentMap: "game-map",
  systems: {},
};

// Create the store
export const useGameStore = create<GameState>()(
  subscribeWithSelector((set, get) => ({
    ...initialState,

    // Register a system
    registerSystem: (name, system) => {
      set((state) => ({
        systems: {
          ...state.systems,
          [name]: system,
        },
      }));
    },

    // Map methods
    updatePlayerMap: (mapKey) => {
      set({ currentMap: mapKey });
      eventBus.emit("player.map.changed", mapKey);
    },

    // Player health methods
    updatePlayerHealth: (health) => {
      set((state) => ({
        playerCharacter: {
          ...state.playerCharacter,
          health,
        },
      }));
      eventBus.emit("playerCharacter.health.changed", health);
    },

    updatePlayerMaxHealth: (maxHealth) => {
      set((state) => ({
        playerCharacter: {
          ...state.playerCharacter,
          maxHealth,
        },
      }));
      eventBus.emit("playerCharacter.maxHealth.changed", maxHealth);
    },

    // Experience and level
    updatePlayerExperience: (experience) => {
      set((state) => ({
        playerCharacter: {
          ...state.playerCharacter,
          experience,
        },
      }));
      eventBus.emit("playerCharacter.experience.changed", experience);
    },

    updatePlayerLevel: (level) => {
      set((state) => {
        const updatedSkills = {
          ...state.playerCharacter.skills,
          playerLevel: {
            ...state.playerCharacter.skills.playerLevel,
            level,
          },
        };

        const newState = {
          playerCharacter: {
            ...state.playerCharacter,
            skills: updatedSkills,
          },
        };

        // Recalculate stats
        const equipmentBonuses = calculateEquipmentBonuses(state.playerCharacter.equipment);
        const calculatedStats = calculateTotalStats(newState.playerCharacter, equipmentBonuses);

        eventBus.emit("playerCharacter.level.changed", level);
        eventBus.emit("player.stats.updated", calculatedStats);

        return {
          ...newState,
          calculatedStats,
        };
      });
    },

    // SIMPLIFIED: Equipment - handles ItemInstance with simplified move speed events
    setPlayerCharacterEquipment: (equipment, source = "system") => {
      set((state) => {
        const newState = {
          playerCharacter: {
            ...state.playerCharacter,
            equipment,
          },
        };

        // Recalculate stats after equipment change
        const equipmentBonuses = calculateEquipmentBonuses(equipment);
        const calculatedStats = calculateTotalStats(newState.playerCharacter, equipmentBonuses);

        eventBus.emit("equipment.changed", { equipment, source });
        eventBus.emit("player.stats.updated", calculatedStats);
        // SIMPLIFIED: Single move speed event
        eventBus.emit("player.moveSpeed.updated", calculatedStats.totalMoveSpeed);

        return {
          ...newState,
          calculatedStats,
        };
      });
    },

    // Input focus
    setInputFocused: (inputFocused) => {
      set({ inputFocused });
      eventBus.emit("input.focused", inputFocused);
    },

    // Set collections
    updateSetCollections: (setCollections) => {
      set({ setCollections });
      eventBus.emit("setCollections.updated", setCollections);
    },

    // Skills
    updateSkill: (skillId, newExperience) => {
      set((state) => {
        const skills = { ...state.playerCharacter.skills };

        if (!skills[skillId]) {
          const basePoints =
            SKILL_PROGRESSION.BASE_POINTS[skillId as keyof typeof SKILL_PROGRESSION.BASE_POINTS] ||
            15;

          skills[skillId] = {
            level: 1,
            experience: 0,
            maxExperience: basePoints,
          };
        }

        const skill = skills[skillId];
        const oldLevel = skill.level;

        if (skillId === "playerLevel") {
          skill.experience = newExperience;
          skill.maxExperience = calculatePointsForNextLevel(skillId, skill.level);
        } else {
          let totalExp = 0;
          for (let level = 1; level < skill.level; level++) {
            totalExp += calculatePointsForNextLevel(skillId, level);
          }
          totalExp += skill.experience;

          const newTotalExp = totalExp + (newExperience - skill.experience);
          const { level, currentExp, expForNextLevel } = calculateLevelFromExperience(
            skillId,
            newTotalExp
          );

          skill.level = level;
          skill.experience = currentExp;
          skill.maxExperience = expForNextLevel;
        }

        const newState = {
          playerCharacter: {
            ...state.playerCharacter,
            skills,
          },
        };

        // Recalculate stats after skill change
        const equipmentBonuses = calculateEquipmentBonuses(state.playerCharacter.equipment);
        const calculatedStats = calculateTotalStats(newState.playerCharacter, equipmentBonuses);

        eventBus.emit("playerCharacter.skill.updated", {
          skillId,
          level: skill.level,
          experience: skill.experience,
          maxExperience: skill.maxExperience,
          leveledUp: skill.level > oldLevel,
        });

        if (skillId === "playerLevel" && skill.level !== oldLevel) {
          eventBus.emit("playerCharacter.level.changed", skill.level);
        }

        eventBus.emit("player.stats.updated", calculatedStats);

        return {
          ...newState,
          calculatedStats,
        };
      });
    },

    // Inventory methods with stacking support
    getItemInstanceById: (instanceId) => {
      const state = get();

      const inventoryItem = state.playerCharacter.inventory.find(
        (item) => item.instanceId === instanceId
      );
      if (inventoryItem) return inventoryItem;

      const equipment = state.playerCharacter.equipment;
      for (const slotItem of Object.values(equipment)) {
        if (slotItem && slotItem.instanceId === instanceId) {
          return slotItem;
        }
      }

      return undefined;
    },

    addItemInstanceToInventory: (itemInstance) => {
      const state = get();
      const itemData = ItemDictionary.getItem(itemInstance.templateId);

      if (itemData?.stackable) {
        const existingItemIndex = state.playerCharacter.inventory.findIndex(
          (item) => item.templateId === itemInstance.templateId
        );

        if (existingItemIndex !== -1) {
          const newInventory = [...state.playerCharacter.inventory];
          const existingItem = newInventory[existingItemIndex];
          const currentQuantity = existingItem.quantity || 1;
          const addingQuantity = itemInstance.quantity || 1;

          newInventory[existingItemIndex] = {
            ...existingItem,
            quantity: currentQuantity + addingQuantity,
          };

          set((state) => ({
            playerCharacter: {
              ...state.playerCharacter,
              inventory: newInventory,
            },
          }));

          eventBus.emit("inventory.updated", null);
          return true;
        }
      }

      const newItem = {
        ...itemInstance,
        quantity: itemInstance.quantity || 1,
      };

      set((state) => ({
        playerCharacter: {
          ...state.playerCharacter,
          inventory: [...state.playerCharacter.inventory, newItem],
        },
      }));

      eventBus.emit("inventory.updated", null);
      return true;
    },

    removeItemInstanceFromInventory: (instanceId, quantity = 1) => {
      const state = get();
      const inventory = [...state.playerCharacter.inventory];
      const itemIndex = inventory.findIndex((item) => item.instanceId === instanceId);

      if (itemIndex === -1) return false;

      const item = inventory[itemIndex];
      const currentQuantity = item.quantity || 1;

      if (currentQuantity <= quantity) {
        inventory.splice(itemIndex, 1);
      } else {
        inventory[itemIndex] = {
          ...item,
          quantity: currentQuantity - quantity,
        };
      }

      set((state) => ({
        playerCharacter: {
          ...state.playerCharacter,
          inventory,
        },
      }));

      eventBus.emit("inventory.updated", null);
      return true;
    },

    // Player stats
    updatePlayerGold: (goldValue: number, isAdditive: boolean = false) => {
      set((state) => {
        const newGold = isAdditive
          ? Math.max(0, state.playerCharacter.gold + goldValue)
          : Math.max(0, goldValue);

        return {
          playerCharacter: {
            ...state.playerCharacter,
            gold: newGold,
          },
        };
      });

      const currentGold = get().playerCharacter.gold;
      eventBus.emit("playerCharacter.gold.changed", currentGold);
    },

    updatePlayerMaxCapacity: (amount) => {
      set((state) => ({
        playerCharacter: {
          ...state.playerCharacter,
          maxCapacity: Math.max(0, state.playerCharacter.maxCapacity + amount),
        },
      }));
    },

    updatePlayerCurrentCapacity: (amount) => {
      set((state) => ({
        playerCharacter: {
          ...state.playerCharacter,
          currentCapacity: Math.max(0, state.playerCharacter.currentCapacity + amount),
        },
      }));
    },

    // SIMPLIFIED: Recalculate stats manually with simplified move speed events
    recalculateStats: () => {
      set((state) => {
        const equipmentBonuses = calculateEquipmentBonuses(state.playerCharacter.equipment);
        const calculatedStats = calculateTotalStats(state.playerCharacter, equipmentBonuses);

        eventBus.emit("player.stats.updated", calculatedStats);
        // SIMPLIFIED: Single move speed event
        eventBus.emit("player.moveSpeed.updated", calculatedStats.totalMoveSpeed);

        return {
          calculatedStats,
        };
      });
    },
  }))
);
