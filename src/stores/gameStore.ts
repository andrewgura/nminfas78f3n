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

// Define the store state structure
export interface GameState {
  // Player properties
  playerCharacter: {
    health: number;
    maxHealth: number;
    lastAttackTime: number;
    experience: number;
    equipment: PlayerCharacterEquipment; // Now stores ItemInstance instead of ItemData
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

  // Chest state
  openedChests: {
    [chestId: string]: number; // Timestamp when opened
  };

  // System references - this allows Phaser scenes to access services
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
  isChestOpen: (chestId: string) => boolean;
  setChestOpen: (chestId: string) => void;
}

// Initial state
const initialState = {
  playerCharacter: {
    health: 2000,
    maxHealth: 2000,
    lastAttackTime: 0,
    experience: 0,
    equipment: {
      weapon: null,
      shield: null,
      trinket: null,
      helmet: null,
      amulet: null,
      armor: null,
    } as PlayerCharacterEquipment, // Now properly typed for ItemInstance
    inventory: [
      // Using item instances instead of just template IDs
      ItemInstanceManager.createItemInstance("sword1"),
      ItemInstanceManager.createItemInstance("greatSword", { power: 1 }), // Great Sword with +1 power
      ItemInstanceManager.createItemInstance("woodenStaff"),
      ItemInstanceManager.createItemInstance("twigBow"),
      ItemInstanceManager.createItemInstance("boneClub"),
      ItemInstanceManager.createItemInstance("boneCharm"),
      ItemInstanceManager.createItemInstance("skullCap"),
      ItemInstanceManager.createItemInstance("skeletalMedallion"),
      ItemInstanceManager.createItemInstance("boneShield"),
      ItemInstanceManager.createItemInstance("skeletalArmor"),
      // Add some food items with quantity
      ItemInstanceManager.createFoodInstance("eggs", 5),
      ItemInstanceManager.createFoodInstance("chickenLegs", 3),
      ItemInstanceManager.createFoodInstance("dirtyFish", 2),
      ItemInstanceManager.createProductInstance("shinySkull", 2),
    ],
    skills: {
      playerLevel: { level: 1, experience: 0, maxExperience: 100 },
      meleeWeapons: { level: 1, experience: 0, maxExperience: 15 },
      archery: { level: 1, experience: 0, maxExperience: 15 },
      magic: { level: 1, experience: 0, maxExperience: 15 },
      shield: { level: 1, experience: 0, maxExperience: 20 },
    },
    gold: 100,
    maxCapacity: 40,
    currentCapacity: 10,
  },
  quests: {
    active: [],
    completed: [],
  },
  inputFocused: false,
  setCollections: {},
  currentMap: "game-map",
  openedChests: {},
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
        // Update the playerLevel skill
        const updatedSkills = {
          ...state.playerCharacter.skills,
          playerLevel: {
            ...state.playerCharacter.skills.playerLevel,
            level,
          },
        };

        return {
          playerCharacter: {
            ...state.playerCharacter,
            skills: updatedSkills,
          },
        };
      });
      eventBus.emit("playerCharacter.level.changed", level);
    },

    // Equipment - UPDATED to handle ItemInstance
    setPlayerCharacterEquipment: (equipment, source = "system") => {
      set((state) => ({
        playerCharacter: {
          ...state.playerCharacter,
          equipment, // equipment is now PlayerCharacterEquipment with ItemInstance
        },
      }));
      eventBus.emit("equipment.changed", { equipment, source });
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
          // Initialize the skill if it doesn't exist
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

        // Different handling based on skill type
        if (skillId === "playerLevel") {
          // For player level, directly set the experience value
          skill.experience = newExperience;

          // Make sure maxExperience is correct
          skill.maxExperience = calculatePointsForNextLevel(skillId, skill.level);
        } else {
          // For other skills, handle as incremental experience
          // Calculate total experience so far
          let totalExp = 0;
          for (let level = 1; level < skill.level; level++) {
            totalExp += calculatePointsForNextLevel(skillId, level);
          }
          totalExp += skill.experience;

          // Add new experience
          const newTotalExp = totalExp + (newExperience - skill.experience);

          // Calculate new level and experience
          const { level, currentExp, expForNextLevel } = calculateLevelFromExperience(
            skillId,
            newTotalExp
          );

          // Update the skill
          skill.level = level;
          skill.experience = currentExp;
          skill.maxExperience = expForNextLevel;
        }

        // Emit skill updated event
        eventBus.emit("playerCharacter.skill.updated", {
          skillId,
          level: skill.level,
          experience: skill.experience,
          maxExperience: skill.maxExperience,
          leveledUp: skill.level > oldLevel,
        });

        // Check for player level change
        if (skillId === "playerLevel" && skill.level !== oldLevel) {
          eventBus.emit("playerCharacter.level.changed", skill.level);
        }

        return {
          playerCharacter: {
            ...state.playerCharacter,
            skills,
          },
        };
      });
    },

    // Inventory methods with stacking support
    getItemInstanceById: (instanceId) => {
      const state = get();

      // Check inventory first
      const inventoryItem = state.playerCharacter.inventory.find(
        (item) => item.instanceId === instanceId
      );
      if (inventoryItem) return inventoryItem;

      // Check equipment
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

      // Check if item is stackable
      if (itemData?.stackable) {
        // Find existing stack of the same item
        const existingItemIndex = state.playerCharacter.inventory.findIndex(
          (item) => item.templateId === itemInstance.templateId
        );

        if (existingItemIndex !== -1) {
          // Add to existing stack
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

      // Add as new item (set quantity to 1 if not specified)
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
      const inventory = state.playerCharacter.inventory;
      const index = inventory.findIndex((item) => item.instanceId === instanceId);

      if (index !== -1) {
        const item = inventory[index];
        const currentQuantity = item.quantity || 1;

        if (currentQuantity > quantity) {
          // Reduce quantity
          const newInventory = [...inventory];
          newInventory[index] = {
            ...item,
            quantity: currentQuantity - quantity,
          };

          set((state) => ({
            playerCharacter: {
              ...state.playerCharacter,
              inventory: newInventory,
            },
          }));
        } else {
          // Remove item completely
          set((state) => ({
            playerCharacter: {
              ...state.playerCharacter,
              inventory: [...inventory.slice(0, index), ...inventory.slice(index + 1)],
            },
          }));
        }

        eventBus.emit("inventory.updated", null);
        return true;
      }
      return false;
    },

    // Resources
    updatePlayerGold: (gold) => {
      set((state) => ({
        playerCharacter: {
          ...state.playerCharacter,
          gold,
        },
      }));
      eventBus.emit("playerCharacter.gold.changed", gold);
    },

    updatePlayerMaxCapacity: (maxCapacity) => {
      set((state) => ({
        playerCharacter: {
          ...state.playerCharacter,
          maxCapacity,
        },
      }));
      eventBus.emit("playerCharacter.capacity.changed", maxCapacity);
    },

    updatePlayerCurrentCapacity: (currentCapacity) => {
      set((state) => ({
        playerCharacter: {
          ...state.playerCharacter,
          currentCapacity,
        },
      }));
      eventBus.emit("playerCharacter.currentCapacity.changed", currentCapacity);
    },

    // Chest methods
    isChestOpen: (chestId) => {
      return !!get().openedChests[chestId];
    },

    setChestOpen: (chestId) => {
      set((state) => ({
        openedChests: {
          ...state.openedChests,
          [chestId]: Date.now(),
        },
      }));
      eventBus.emit("chest.opened", chestId);
    },
  }))
);
