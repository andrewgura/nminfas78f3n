// ============================================================================
// CENTRALIZED DAMAGE & DAMAGE REDUCTION FORMULAS
// ============================================================================

import {
  PlayerCharacterEquipment,
  PlayerCharacterSkills,
  MonsterData,
  MonsterAttackType,
} from "@/types";
import { ItemInstanceManager } from "@/utils/ItemInstanceManager";

/**
 * Centralized damage calculation formulas for the game.
 * All damage and damage reduction calculations should use these functions
 * to ensure consistency and easy balance adjustments.
 */
export class DamageFormulas {
  // ============================================================================
  // PLAYER DAMAGE CALCULATIONS
  // ============================================================================

  /**
   * Calculate player auto attack damage
   * Formula: (Power × 0.75) + (Skill Value × 0.15) + (Player Level × 0.10)
   *
   * @param equipment Player's equipment
   * @param skills Player's skills (will be cast to proper type)
   * @param weaponType Type of weapon equipped ("melee", "archery", "magic")
   * @returns Final auto attack damage
   */
  static calculatePlayerAutoAttackDamage(
    equipment: PlayerCharacterEquipment,
    skills: any, // Accept any to handle the store's generic skills type
    weaponType: string
  ): number {
    const totalPower = this.calculateTotalPower(equipment);
    const skillValue = this.getSkillValueForWeaponType(skills, weaponType);
    const playerLevel = skills.playerLevel?.level || 1;

    const powerComponent = totalPower * 0.75;
    const skillComponent = skillValue * 0.15;
    const levelComponent = playerLevel * 0.1;

    const totalDamage = powerComponent + skillComponent + levelComponent;
    return Math.max(1, Math.round(totalDamage));
  }

  /**
   * Calculate player ability damage
   * Formula: Base Ability Damage + (Power × 0.75) + (Skill Value × 0.15) + (Player Level × 0.10)
   *
   * @param baseDamage Base damage from the ability
   * @param equipment Player's equipment
   * @param skills Player's skills (will be cast to proper type)
   * @param weaponType Type of weapon/skill ("melee", "archery", "magic")
   * @returns Final ability damage
   */
  static calculatePlayerAbilityDamage(
    baseDamage: number,
    equipment: PlayerCharacterEquipment,
    skills: any, // Accept any to handle the store's generic skills type
    weaponType: string
  ): number {
    const totalPower = this.calculateTotalPower(equipment);
    const skillValue = this.getSkillValueForWeaponType(skills, weaponType);
    const playerLevel = skills.playerLevel?.level || 1;

    const powerComponent = totalPower * 0.75;
    const skillComponent = skillValue * 0.15;
    const levelComponent = playerLevel * 0.1;

    const bonusDamage = powerComponent + skillComponent + levelComponent;
    const totalDamage = baseDamage + bonusDamage;

    return Math.max(1, Math.round(totalDamage));
  }

  // ============================================================================
  // MONSTER DAMAGE CALCULATIONS
  // ============================================================================

  /**
   * Calculate monster attack damage
   * Formula: Base Monster Damage + (Monster Level × 0.5)
   *
   * @param baseDamage Monster's base damage
   * @param monsterLevel Monster's level (default 1)
   * @returns Final monster damage
   */
  static calculateMonsterDamage(baseDamage: number, monsterLevel: number = 1): number {
    const levelBonus = monsterLevel * 0.5;
    const totalDamage = baseDamage + levelBonus;

    return Math.max(1, Math.round(totalDamage));
  }

  // ============================================================================
  // DAMAGE REDUCTION CALCULATIONS
  // ============================================================================

  /**
   * Calculate player damage reduction
   * Formula: (Total Armor × 0.75) + (Shield Skill × 0.15) + (Player Level × 0.10)
   *
   * @param equipment Player's equipment
   * @param skills Player's skills (will be cast to proper type)
   * @returns Damage reduction amount
   */
  static calculatePlayerDamageReduction(
    equipment: PlayerCharacterEquipment,
    skills: any // Accept any to handle the store's generic skills type
  ): number {
    const totalArmor = this.calculateTotalArmor(equipment);
    const hasShieldEquipped = equipment.shield !== null;
    const shieldSkill = skills.shield?.level || 1;
    const playerLevel = skills.playerLevel?.level || 1;

    const armorComponent = totalArmor * 0.75;
    const shieldComponent = hasShieldEquipped ? shieldSkill * 0.15 : 0;
    const levelComponent = playerLevel * 0.1;

    const totalReduction = armorComponent + shieldComponent + levelComponent;
    return Math.round(totalReduction);
  }

  /**
   * Calculate monster damage reduction
   * Formula: Monster Armor × 0.5
   *
   * @param monsterArmor Monster's armor value
   * @returns Damage reduction amount
   */
  static calculateMonsterDamageReduction(monsterArmor: number): number {
    const reduction = monsterArmor * 0.5;
    return Math.round(reduction);
  }

  // ============================================================================
  // FINAL DAMAGE APPLICATION
  // ============================================================================

  /**
   * Apply damage reduction to incoming damage
   * Magic damage bypasses all armor reduction
   *
   * @param incomingDamage Raw damage amount
   * @param damageReduction Calculated damage reduction
   * @param isMagicDamage Whether this is magic damage (bypasses armor)
   * @returns Final damage after reduction (minimum 1)
   */
  static applyDamageReduction(
    incomingDamage: number,
    damageReduction: number,
    isMagicDamage: boolean = false
  ): number {
    // Magic damage bypasses all armor
    if (isMagicDamage) {
      return Math.max(1, incomingDamage);
    }

    const finalDamage = incomingDamage - damageReduction;
    return Math.max(1, finalDamage); // Always deal at least 1 damage
  }

  // ============================================================================
  // HELPER FUNCTIONS
  // ============================================================================

  /**
   * Calculate total power from all equipped items
   */
  static calculateTotalPower(equipment: PlayerCharacterEquipment): number {
    let totalPower = 0;

    Object.values(equipment).forEach((itemInstance) => {
      if (!itemInstance) return;

      const itemData = ItemInstanceManager.getCombinedStats(itemInstance);
      if (itemData?.power) {
        totalPower += itemData.power;
      }
    });

    return totalPower;
  }

  /**
   * Calculate total armor from all equipped items
   */
  static calculateTotalArmor(equipment: PlayerCharacterEquipment): number {
    let totalArmor = 0;

    Object.values(equipment).forEach((itemInstance) => {
      if (!itemInstance) return;

      const itemData = ItemInstanceManager.getCombinedStats(itemInstance);
      if (itemData?.armor) {
        totalArmor += itemData.armor;
      }
    });

    return totalArmor;
  }

  /**
   * Get skill value based on weapon type
   */
  static getSkillValueForWeaponType(skills: any, weaponType: string): number {
    switch (weaponType.toLowerCase()) {
      case "melee":
        return skills.meleeWeapons?.level || 1;
      case "archery":
        return skills.archery?.level || 1;
      case "magic":
        return skills.magic?.level || 1;
      default:
        return 1;
    }
  }

  /**
   * Get weapon type from equipped weapon
   */
  static getEquippedWeaponType(equipment: PlayerCharacterEquipment): string {
    if (!equipment.weapon) return "melee";

    const weaponData = ItemInstanceManager.getCombinedStats(equipment.weapon);
    return weaponData?.weaponType || "melee";
  }

  /**
   * Determine if attack is magic damage based on attack type or ability
   */
  static isMagicDamage(attackType?: MonsterAttackType | string, abilitySkillId?: string): boolean {
    // Check monster attack type
    if (attackType === MonsterAttackType.Magic || attackType === "magic") {
      return true;
    }

    // Check ability skill type
    if (abilitySkillId === "magic") {
      return true;
    }

    return false;
  }

  // ============================================================================
  // CONVENIENCE FUNCTIONS FOR COMPLETE DAMAGE CALCULATIONS
  // ============================================================================

  /**
   * Calculate final damage dealt by player auto attack
   */
  static calculatePlayerAutoAttackFinalDamage(
    equipment: PlayerCharacterEquipment,
    skills: any,
    targetArmor: number
  ): number {
    const weaponType = this.getEquippedWeaponType(equipment);
    const rawDamage = this.calculatePlayerAutoAttackDamage(equipment, skills, weaponType);
    const damageReduction = this.calculateMonsterDamageReduction(targetArmor);

    return this.applyDamageReduction(rawDamage, damageReduction, false);
  }

  /**
   * Calculate final damage dealt by player ability
   */
  static calculatePlayerAbilityFinalDamage(
    baseDamage: number,
    equipment: PlayerCharacterEquipment,
    skills: any,
    abilitySkillId: string,
    targetArmor: number
  ): number {
    const weaponType = this.getWeaponTypeFromSkillId(abilitySkillId);
    const rawDamage = this.calculatePlayerAbilityDamage(baseDamage, equipment, skills, weaponType);
    const isMagic = this.isMagicDamage(undefined, abilitySkillId);
    const damageReduction = this.calculateMonsterDamageReduction(targetArmor);

    return this.applyDamageReduction(rawDamage, damageReduction, isMagic);
  }

  /**
   * Calculate final damage taken by player
   */
  static calculatePlayerDamageTaken(
    incomingDamage: number,
    equipment: PlayerCharacterEquipment,
    skills: any,
    isMagicDamage: boolean = false
  ): number {
    if (isMagicDamage) {
      return Math.max(1, incomingDamage);
    }

    const damageReduction = this.calculatePlayerDamageReduction(equipment, skills);
    return this.applyDamageReduction(incomingDamage, damageReduction, isMagicDamage);
  }

  /**
   * Convert skill ID to weapon type (NOW PUBLIC)
   */
  static getWeaponTypeFromSkillId(skillId: string): string {
    switch (skillId) {
      case "meleeWeapons":
        return "melee";
      case "archery":
        return "archery";
      case "magic":
        return "magic";
      default:
        return "melee";
    }
  }
}
