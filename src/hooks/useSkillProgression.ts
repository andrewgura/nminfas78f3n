import { useState, useCallback } from "react";
import { useGameStore } from "../stores/gameStore";
import { useEventBus } from "./useEventBus";
import { skillProgressionSystem } from "@/services/SkillProgressionSystem";

export function useSkillProgression() {
  const playerSkills = useGameStore((state) => state.playerCharacter.skills);
  const [levelUpAnimations, setLevelUpAnimations] = useState<Record<string, boolean>>({});

  // Listen for skill updates
  useEventBus("playerCharacter.skill.updated", (data) => {
    if (data?.leveledUp) {
      // Trigger level-up animation
      setLevelUpAnimations((prev) => ({
        ...prev,
        [data.skillId]: true,
      }));

      // Clear animation after delay
      setTimeout(() => {
        setLevelUpAnimations((prev) => ({
          ...prev,
          [data.skillId]: false,
        }));
      }, 2000);
    }
  });

  // Add skill points directly
  const addSkillPoints = useCallback((skillId: string, points: number) => {
    skillProgressionSystem.addSkillPoints(skillId, points);
  }, []);

  // Get skill level considering equipment bonuses
  const getEffectiveSkillLevel = useCallback(
    (skillId: string): number => {
      const equipment = useGameStore.getState().playerCharacter.equipment;
      const baseLevel = playerSkills[skillId]?.level || 1;

      // Calculate bonuses from equipment
      let bonus = 0;
      Object.values(equipment).forEach((item) => {
        if (!item) return;

        if (item.bonusStats) {
          // Direct skill bonus
          const directBonus = item.bonusStats[skillId];
          if (directBonus) bonus += directBonus;

          // Or mapped stat bonus
          const mappedStat = getMappedStatForSkill(skillId);
          if (mappedStat && item.bonusStats[mappedStat]) {
            bonus += item.bonusStats[mappedStat];
          }
        }
      });

      return baseLevel + bonus;
    },
    [playerSkills]
  );

  // Format skill name for display
  const getSkillName = useCallback((skillId: string): string => {
    const skillNames: Record<string, string> = {
      playerLevel: "Level",
      meleeWeapons: "Melee Weapons",
      archery: "Archery",
      magic: "Magic",
      shield: "Shield",
    };
    return skillNames[skillId] || skillId;
  }, []);

  // Get description for a skill
  const getSkillDescription = useCallback((skillId: string, level: number): string => {
    const bonus = level * 5;
    const descriptions: Record<string, string> = {
      playerLevel: `+${bonus}% to all attributes`,
      meleeWeapons: `+${bonus}% damage with melee weapons`,
      archery: `+${bonus}% damage with bows and crossbows`,
      magic: `+${bonus}% magic damage and effect`,
      shield: `+${bonus}% damage reduction from all sources`,
    };
    return descriptions[skillId] || `+${bonus}% effectiveness`;
  }, []);

  return {
    playerSkills,
    addSkillPoints,
    getEffectiveSkillLevel,
    getSkillName,
    getSkillDescription,
    isLevelingUp: (skillId: string) => levelUpAnimations[skillId] || false,
  };
}

// Helper function to map skill ID to related stat
function getMappedStatForSkill(skillId: string): string | null {
  const skillToStatMap: Record<string, string> = {
    meleeWeapons: "melee",
    archery: "archery",
    magic: "magic",
    shield: "armor",
    playerLevel: "health",
  };
  return skillToStatMap[skillId] || null;
}
