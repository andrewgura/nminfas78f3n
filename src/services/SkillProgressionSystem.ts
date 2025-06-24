import { eventBus } from "../utils/EventBus";
import { useGameStore } from "../stores/gameStore";
import {
  updateSkillWithExperience,
  SKILL_PROGRESSION,
  calculatePointsForNextLevel,
} from "../utils/SkillProgressionFormula";
import { DamageEvent } from "../types";

class SkillProgressionSystemService {
  // Maps weapon types to skill IDs
  private readonly WEAPON_SKILL_MAP: Record<string, string> = {
    melee: "meleeWeapons",
    archery: "archery",
    magic: "magic",
  };

  constructor() {
    this.initialize();
  }

  initialize(): void {
    // Subscribe to damage events
    eventBus.on("damage.dealt", this.handleDamageDealt.bind(this));
  }

  /**
   * Handles damage dealt events to award skill points
   */
  handleDamageDealt(event?: DamageEvent): void {
    try {
      // Skip processing if no data or invalid data
      if (!event) return;

      // Determine which skill to update based on weapon type
      const skillId = this.WEAPON_SKILL_MAP[event.weaponType];
      if (!skillId) return;

      // Award 1 skill point for each successful hit
      const pointsToAward = this.calculatePointsToAward(event);

      // Award skill points to the appropriate weapon skill
      this.awardSkillPoints(skillId, pointsToAward);
    } catch (error) {
      console.error("Error in handleDamageDealt:", error);
    }
  }

  /**
   * Calculate points to award based on damage event
   */
  private calculatePointsToAward(event: DamageEvent): number {
    // Basic calculation - can be enhanced with formulas based on damage amount, target type, etc.
    let basePoints = 1;

    // Extra points for ability usage vs auto attack
    if (event.source === "ability") {
      basePoints += 1;
    }

    // Scale points with damage (slightly)
    const damageBonus = Math.floor(event.damage / 10);

    return basePoints + damageBonus;
  }

  /**
   * Awards skill points to a specific skill using the formula-based system
   */
  awardSkillPoints(skillId: string, points: number): void {
    try {
      const store = useGameStore.getState();

      // Get the current skill data
      let currentSkill = store.playerCharacter.skills[skillId];
      if (!currentSkill) {
        // Initialize if not found
        const basePoints =
          SKILL_PROGRESSION.BASE_POINTS[skillId as keyof typeof SKILL_PROGRESSION.BASE_POINTS] ||
          15;
        currentSkill = {
          level: 1,
          experience: 0,
          maxExperience: basePoints,
        };
      }

      // Calculate total accumulated experience so far
      const totalExp = this.calculateTotalSkillExperience(skillId, currentSkill);

      // Add the new points to get new total experience
      const newTotalExp = totalExp + points;

      // Calculate new level and experience distribution
      const { level, currentExp, expForNextLevel } = this.calculateLevelAndExpFromTotal(
        skillId,
        newTotalExp
      );

      // Update skill in store
      store.updateSkill(skillId, currentExp);
    } catch (error) {
      console.error("Error in awardSkillPoints:", error);
    }
  }

  /**
   * Helper function to calculate total accumulated experience for a skill
   */
  private calculateTotalSkillExperience(skillId: string, skill: any): number {
    try {
      let totalExp = 0;

      // Add experience needed for all previous levels
      for (let level = 1; level < skill.level; level++) {
        totalExp += calculatePointsForNextLevel(skillId, level);
      }

      // Add current progress toward next level
      totalExp += skill.experience;

      return totalExp;
    } catch (error) {
      console.error("Error in calculateTotalSkillExperience:", error);
      return 0;
    }
  }

  /**
   * Helper function to calculate level and experience distribution from total experience
   */
  private calculateLevelAndExpFromTotal(
    skillId: string,
    totalExp: number
  ): {
    level: number;
    currentExp: number;
    expForNextLevel: number;
  } {
    try {
      let level = 1;
      let remainingExp = totalExp;

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
    } catch (error) {
      console.error("Error in calculateLevelAndExpFromTotal:", error);
      return { level: 1, currentExp: 0, expForNextLevel: 15 };
    }
  }

  /**
   * Direct method to add skill points to a specific skill
   */
  addSkillPoints(skillId: string, points: number): void {
    this.awardSkillPoints(skillId, points);
  }

  dispose(): void {
    // Clean up event listeners
    eventBus.off("damage.dealt", this.handleDamageDealt);
  }
}

// Create and export singleton instance
export const skillProgressionSystem = new SkillProgressionSystemService();
