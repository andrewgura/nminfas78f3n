// src/types/index.ts
/**
 * Global types file containing all type definitions for the game
 */

// ======================================================
// System Management Types
// ======================================================

/**
 * Common interface for all systems and components
 */
export interface SystemManager {
  initialize(): Promise<void>;
  destroy(): void;
}

/**
 * Enum for system initialization states
 */
export enum SystemState {
  UNINITIALIZED = "uninitialized",
  INITIALIZING = "initializing",
  INITIALIZED = "initialized",
  ERROR = "error",
}

// ======================================================
// Item Types
// ======================================================

/**
 * Item Categories
 */
export enum ItemCategory {
  WEAPON_MELEE = "weapon_melee",
  WEAPON_MAGIC = "weapon_magic",
  WEAPON_RANGED = "weapon_ranged",
  ARMOR = "armor",
  SHIELD = "shield",
  HELMET = "helmet",
  AMULET = "amulet",
  TRINKET = "trinket",
  CONSUMABLE = "consumable",
  FOOD = "food",
  MATERIAL = "material",
  PRODUCT = "product",
  CURRENCY = "currency",
  QUEST = "quest",
}

// Sets

export enum ItemSets {
  SKELETAL_SET = "skeletal",
}

export interface SetCollectionData {
  [setType: string]: {
    [slotType: string]: string;
  };
}

/**
 * Base item data type
 */

export interface ItemSetBonuses {
  armor?: number;
  health?: number;
  mana?: number;
  melee?: number;
  magic?: number;
  archery?: number;
  shield?: number;
  moveSpeed?: number;
  attackSpeed?: number;
  healthRegen?: number;
  manaRegen?: number;
  capacity?: number;
  regen?: number;
  power?: number;
}

export interface ItemBonusStats {
  power?: number;
  armor?: number;
  magic?: number;
  strength?: number;
  health?: number;
  mana?: number;
  melee?: number;
  archery?: number;
  shield?: number;
  moveSpeed?: number;
  healthRegen?: number;
  manaRegen?: number;
  capacity?: number;
  regen?: number;
}

export interface ItemInstance {
  templateId: string; // Reference to original item template
  instanceId: string; // Unique ID for this specific item
  bonusStats?: ItemBonusStats; // Optional random bonus stats
  quantity?: number; // For stackable items
}

export interface ItemData {
  // Core properties
  id: string;
  name: string;
  type: ItemType;
  category?: ItemCategory;
  bonusSkills?: string[];
  sellValue?: number;
  stackable?: boolean;

  // Display properties
  description?: string;
  texture?: string;
  icon?: string;
  rarity?: string;

  // Set properties
  set?: ItemSets;
  setBonus?: ItemSetBonuses;

  // Weapon properties
  weaponType?: string;
  isTwoHanded?: boolean;

  // Stats
  power?: number;
  armor?: number;
  melee?: number;
  magic?: number;
  strength?: number;
  hpRegen?: number;
  mpRegen?: number;
  capacity?: number;
  attackSpeed?: number;
  health?: number;
  mana?: number;
  moveSpeed?: number;

  // Physical properties
  weight: number;
}

// ======================================================
// Monster Types
// ======================================================

/**
 * Monster categories for organization
 */
export enum MonsterCategory {
  DARK_ELF = "dark_elf",
  UNDEAD = "undead",
  BEAST = "beast",
  ELEMENTAL = "elemental",
  HUMAN = "human",
  DEMON = "demon",
}

/**
 * Item drop data
 */
export interface ItemDrop {
  itemId: string;
  chance: number; // 0-1, representing drop chance percentage
  minQuantity?: number; // Minimum quantity to drop (default 1)
  maxQuantity?: number; // Maximum quantity to drop (default 1)
}

/**
 * Monster data structure
 */

export enum MonsterAttackType {
  Melee = "melee",
  Ranged = "ranged",
  Magic = "magic",
}

export interface MonsterData {
  id: string;
  name: string;
  category?: MonsterCategory; // Monster category for organization
  sprite: string;
  health: number;
  maxHealth: number;
  speed: number;
  experience: number; // Experience awarded when defeated
  damage?: number; // Base damage
  armor: number;
  drops: ItemDrop[]; // Array of possible item drops
  abilities?: string[]; // IDs of abilities this monster can use
  isAggressive?: boolean; // Whether the monster is aggressive by default
  attackType?: MonsterAttackType; // "melee", "ranged", or "magic"
  runawayPercent?: number; // Health percentage at which monster tries to run away
  description?: string; // Monster description/lore
  spriteSize?: 32 | 64;
  scale?: number;
  color?: string;
}

/**
 * Monster death event data
 */
export interface MonsterDeathEvent {
  type: string;
  name: string;
  x: number;
  y: number;
  experience: number;
}

// ======================================================
// Character & Equipment Types
// ======================================================

/**
 * Equipment related types
 */

export enum ItemType {
  WEAPON = "weapon",
  OFFHAND = "offhand",
  ARMOR = "armor",
  HELMET = "helmet",
  AMULET = "amulet",
  TRINKET = "trinket",
  FOOD = "food",
  PRODUCT = "product",
}

// UPDATED: Equipment now stores ItemInstance instead of ItemData to preserve bonuses
export interface PlayerCharacterEquipment {
  weapon: ItemInstance | null;
  shield: ItemInstance | null;
  trinket: ItemInstance | null;
  helmet: ItemInstance | null;
  amulet: ItemInstance | null;
  armor: ItemInstance | null;
}

export interface EquipmentChangedEvent {
  equipment: PlayerCharacterEquipment;
  source: string;
}

/**
 * Skill data structure
 */
export interface SkillData {
  level: number;
  experience: number;
  maxExperience: number;
}

/**
 * Player character skills
 */
export interface PlayerCharacterSkills {
  playerLevel: SkillData;
  meleeWeapons: SkillData;
  archery: SkillData;
  magic: SkillData;
  [key: string]: SkillData;
}

/**
 * Player character state
 */
export interface PlayerCharacterState {
  health: number;
  maxHealth: number;
  lastAttackTime: number;
  experience: number;
  equipment: PlayerCharacterEquipment;
  inventory: ItemInstance[];
  skills: PlayerCharacterSkills;
  gold: number;
  maxCapacity: number;
  currentCapacity: number;
  teleportPosition?: { x: number; y: number };
}

// ======================================================
// Quest Types
// ======================================================

/**
 * Quest objective data
 */
export interface QuestObjective {
  id: string;
  description: string;
  completed: boolean;
}

/**
 * Quest data structure
 */
export interface Quest {
  id: string;
  title: string;
  description: string;
  objectives: QuestObjective[];
  completed: boolean;
}

/**
 * Quest state storage
 */
export interface QuestState {
  active: Quest[];
  completed: Quest[];
}

// ======================================================
// Ability & Combat Types
// ======================================================

/**
 * Damage event data for skill progression
 */

export interface Ability {
  id: string;
  name: string;
  description: string;
  icon: string;
  cooldown: number;
  damage: number;
  weaponType: string;
  requiredWeapon: string;
  skillId?: string;
  minSkillLevel?: number;
  range?: number;
  areaOfEffect?: boolean;
  areaSize?: number;
  // New property for animation type
  animationType: string;
  // Optional animation config
  animationConfig?: Record<string, any>;
}

export interface DamageEvent {
  source: string; // 'autoAttack' or 'ability'
  abilityId?: string; // Only present for ability damage
  weaponType: string; // 'melee', 'archery', or 'magic'
  targetType: string; // 'monster'
  targetId: string; // monster type
  damage: number;
}

/**
 * Skill update event data
 */
export interface SkillUpdatedEvent {
  skillId: string;
  level: number;
  experience: number;
  maxExperience: number;
  leveledUp: boolean;
}

// ======================================================
// Game State Types
// ======================================================

/**
 * Complete game state data
 */
export interface GameStateData {
  playerCharacter: PlayerCharacterState;
  quests: QuestState;
  inputFocused: boolean;
  setCollections?: SetCollectionData;
}

export interface ErrorData {
  error: Error;
  context: string;
  timestamp: number;
  handled: boolean;
}

//
// Quests
//

export interface Quest {
  id: string;
  title: string;
  description: string;
  objectives: Array<{
    id: string;
    description: string;
    completed: boolean;
  }>;
  completed: boolean;
}
