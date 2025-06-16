import { useCallback } from "react";
import { useGameStore } from "@/stores/gameStore";
import { DamageFormulas } from "@/utils/formulas";
import { Ability } from "@/types";

export function useDamageCalculations() {
  const { playerCharacter } = useGameStore();

  const calculateAutoAttackDamage = useCallback(() => {
    const weaponType = DamageFormulas.getEquippedWeaponType(playerCharacter.equipment);
    return DamageFormulas.calculatePlayerAutoAttackDamage(
      playerCharacter.equipment,
      playerCharacter.skills, // This now accepts 'any' type
      weaponType
    );
  }, [playerCharacter]);

  const calculateAbilityDamage = useCallback(
    (ability: Ability) => {
      const weaponType = DamageFormulas.getWeaponTypeFromSkillId(ability.skillId || "meleeWeapons"); // Now public
      return DamageFormulas.calculatePlayerAbilityDamage(
        ability.damage || 0,
        playerCharacter.equipment,
        playerCharacter.skills, // This now accepts 'any' type
        weaponType
      );
    },
    [playerCharacter]
  );

  const calculateDamageReduction = useCallback(() => {
    return DamageFormulas.calculatePlayerDamageReduction(
      playerCharacter.equipment,
      playerCharacter.skills // This now accepts 'any' type
    );
  }, [playerCharacter]);

  return {
    calculateAutoAttackDamage,
    calculateAbilityDamage,
    calculateDamageReduction,
    totalPower: DamageFormulas.calculateTotalPower(playerCharacter.equipment),
    totalArmor: DamageFormulas.calculateTotalArmor(playerCharacter.equipment),
  };
}
