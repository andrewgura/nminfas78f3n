import { useState } from "react";
import { MonsterDictionary } from "../services/MonsterDictionaryService";
import { useEventBus } from "./useEventBus";
import { MonsterData, MonsterCategory, ItemDrop } from "../types";

export function useMonsterDictionary() {
  const [monstersById, setMonstersById] = useState<Record<string, MonsterData>>({});

  // Listen for initialization events
  useEventBus("monsterDictionary.initialized", () => {
    setMonstersById(MonsterDictionary.getAllMonsters());
  });

  // Get a monster by ID
  const getMonster = (monsterId: string): MonsterData | null => {
    return MonsterDictionary.getMonster(monsterId);
  };

  // Get all monster names
  const getMonsterNames = (): string[] => {
    return MonsterDictionary.getMonsterNames();
  };

  // Get all monster IDs
  const getMonsterIds = (): string[] => {
    return MonsterDictionary.getMonsterIds();
  };

  // Get monsters by category
  const getMonstersByCategory = (category: MonsterCategory): MonsterData[] => {
    return MonsterDictionary.getMonstersByCategory(category);
  };

  // Get monster drops
  const getDrops = (monsterId: string): ItemDrop[] => {
    return MonsterDictionary.getDrops(monsterId);
  };

  // Get monster health
  const getHealth = (monsterId: string): number => {
    return MonsterDictionary.getHealth(monsterId);
  };

  // Get monster max health
  const getMaxHealth = (monsterId: string): number => {
    return MonsterDictionary.getMaxHealth(monsterId);
  };

  // Get monster attack type
  const getAttackType = (monsterId: string): string => {
    return MonsterDictionary.getAttackType(monsterId);
  };

  // Check if monster is aggressive
  const isAggressive = (monsterId: string): boolean => {
    return MonsterDictionary.isAggressive(monsterId);
  };

  // Get monster runaway percent
  const getRunawayPercent = (monsterId: string): number => {
    return MonsterDictionary.getRunawayPercent(monsterId);
  };

  // Get experience reward
  const getExperienceReward = (monsterId: string): number => {
    return MonsterDictionary.getExperienceReward(monsterId);
  };

  // Group monsters by category for UI display
  const getMonstersByCategories = (): Record<string, MonsterData[]> => {
    const result: Record<string, MonsterData[]> = {};

    Object.values(monstersById).forEach((monster) => {
      if (monster.category) {
        if (!result[monster.category]) {
          result[monster.category] = [];
        }
        result[monster.category].push(monster);
      } else {
        if (!result["uncategorized"]) {
          result["uncategorized"] = [];
        }
        result["uncategorized"].push(monster);
      }
    });

    return result;
  };

  return {
    monstersById,
    getMonster,
    getMonsterNames,
    getMonsterIds,
    getMonstersByCategory,
    getDrops,
    getHealth,
    getMaxHealth,
    getAttackType,
    isAggressive,
    getRunawayPercent,
    getExperienceReward,
    getMonstersByCategories,
    allMonsters: Object.values(monstersById),
  };
}
