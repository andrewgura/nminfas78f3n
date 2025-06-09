import { SkillData } from "../types";

/**
 * Constants for the skill progression formula
 * Uses a linear growth model: points = basePoints * (1 + growthFactor * (level - 1))
 */
export const SKILL_PROGRESSION = {
  // Base points needed for level 2
  BASE_POINTS: {
    playerLevel: 100,
    meleeWeapons: 15,
    archery: 15,
    magic: 15,
    defense: 20,
  },
  // Growth factor - lower means faster progression
  GROWTH_FACTOR: {
    playerLevel: 0.5, // 50% increase per level
    meleeWeapons: 0.3, // 30% increase per level
    archery: 0.3, // Same as melee weapons
    magic: 0.3, // Same as melee weapons
    defense: 0.35, // Slightly slower than combat skills
  },
  // Maximum skill level achievable
  MAX_LEVEL: 100,
};

/**
 * Calculates points needed to reach the next level for a skill
 * @param skillId The skill identifier
 * @param level The current level (points needed for level+1)
 * @returns Experience points needed for the next level
 */
export function calculatePointsForNextLevel(skillId: string, level: number): number {
  // Get base points for the skill (or default to 15)
  const basePoints =
    SKILL_PROGRESSION.BASE_POINTS[skillId as keyof typeof SKILL_PROGRESSION.BASE_POINTS] || 15;

  // Get growth factor for the skill (or default to 0.3)
  const growthFactor =
    SKILL_PROGRESSION.GROWTH_FACTOR[skillId as keyof typeof SKILL_PROGRESSION.GROWTH_FACTOR] || 0.3;

  // Formula: basePoints * (1 + growthFactor * (level - 1))
  const points = Math.floor(basePoints * (1 + growthFactor * (level - 1)));

  return points;
}

/**
 * Calculates total experience needed to reach a specific level from level 1
 * @param skillId The skill identifier
 * @param targetLevel The target level to reach
 * @returns Total accumulated experience needed
 */
export function calculateTotalExperienceForLevel(skillId: string, targetLevel: number): number {
  let totalExp = 0;

  // Sum experience needed for each level
  for (let level = 1; level < targetLevel; level++) {
    totalExp += calculatePointsForNextLevel(skillId, level);
  }

  return totalExp;
}

/**
 * Calculates skill level and experience based on total accumulated experience
 * @param skillId The skill identifier
 * @param totalExperience Total accumulated experience
 * @returns Object with level, current experience toward next level, and points needed for next level
 */
export function calculateLevelFromExperience(
  skillId: string,
  totalExperience: number
): {
  level: number;
  currentExp: number;
  expForNextLevel: number;
} {
  let level = 1;
  let remainingExp = totalExperience;

  // Keep advancing level while we have enough experience
  while (level < SKILL_PROGRESSION.MAX_LEVEL) {
    const expNeeded = calculatePointsForNextLevel(skillId, level);

    if (remainingExp < expNeeded) {
      break;
    }

    remainingExp -= expNeeded;
    level++;
  }

  // Calculate experience needed for next level
  const expForNextLevel =
    level < SKILL_PROGRESSION.MAX_LEVEL ? calculatePointsForNextLevel(skillId, level) : 0;

  return {
    level,
    currentExp: remainingExp,
    expForNextLevel,
  };
}

/**
 * Updates a skill with new experience points, checking for level-ups
 * @param skill Current skill data
 * @param skillId The skill identifier
 * @param experienceGained New experience points gained
 * @returns Updated skill data and whether a level-up occurred
 */
export function updateSkillWithExperience(
  skill: SkillData,
  skillId: string,
  experienceGained: number
): {
  updatedSkill: SkillData;
  leveledUp: boolean;
} {
  const oldLevel = skill.level;

  // Calculate total accumulated experience
  const totalPreviousExp =
    calculateTotalExperienceForLevel(skillId, skill.level) + skill.experience;
  const totalNewExp = totalPreviousExp + experienceGained;

  // Get new level from total experience
  const { level, currentExp, expForNextLevel } = calculateLevelFromExperience(skillId, totalNewExp);

  // Determine if a level-up occurred
  const leveledUp = level > oldLevel;

  // Create updated skill object
  const updatedSkill: SkillData = {
    level,
    experience: currentExp,
    maxExperience: expForNextLevel,
  };

  return {
    updatedSkill,
    leveledUp,
  };
}

/**
 * Generates an experience table for a skill up to a specific level
 * This is useful for debugging or UI displays showing progression
 * @param skillId The skill identifier
 * @param maxLevel Maximum level to calculate
 * @returns Table of level and experience requirements
 */
export function generateExperienceTable(
  skillId: string,
  maxLevel: number = 20
): Array<{
  level: number;
  expForLevel: number;
  totalExp: number;
}> {
  const table = [];

  // First level requires 0 experience
  table.push({
    level: 1,
    expForLevel: 0,
    totalExp: 0,
  });

  // Calculate for remaining levels
  for (let level = 2; level <= maxLevel; level++) {
    const expForLevel = calculatePointsForNextLevel(skillId, level - 1);
    const totalExp = calculateTotalExperienceForLevel(skillId, level);

    table.push({
      level,
      expForLevel,
      totalExp,
    });
  }

  return table;
}
