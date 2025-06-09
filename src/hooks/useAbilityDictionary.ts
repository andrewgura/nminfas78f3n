import { useState, useEffect } from "react";
import { AbilityDictionary } from "../services/AbilityDictionaryService";
import { useEventBus } from "./useEventBus";
import { Ability } from "../types";

export function useAbilityDictionary() {
  const [abilities, setAbilities] = useState<Record<string, Ability>>({});

  // Listen for initialization events
  useEventBus("abilityDictionary.initialized", () => {
    // Get all abilities and update state
    const allAbilities = AbilityDictionary.getAllAbilities().reduce((acc, ability) => {
      acc[ability.id] = ability;
      return acc;
    }, {} as Record<string, Ability>);

    setAbilities(allAbilities);
  });

  // Get an ability by ID
  const getAbility = (abilityId: string): Ability | null => {
    return AbilityDictionary.getAbility(abilityId);
  };

  // Get abilities for a specific weapon type
  const getAbilitiesForWeaponType = (weaponType: string, slot: string = "weapon"): Ability[] => {
    return AbilityDictionary.getAbilitiesForWeaponType(weaponType, slot);
  };

  // Get abilities for a specific skill
  const getAbilitiesForSkill = (skillId: string): Ability[] => {
    return AbilityDictionary.getAbilitiesForSkill(skillId);
  };

  // Get animation type for an ability
  const getAnimationType = (abilityId: string): string => {
    return AbilityDictionary.getAnimationType(abilityId);
  };

  // Group abilities by weapon type for UI display
  const getAbilitiesByWeaponType = (): Record<string, Ability[]> => {
    const result: Record<string, Ability[]> = {
      melee: [],
      magic: [],
      archery: [],
      any: [],
    };

    Object.values(abilities).forEach((ability) => {
      if (ability.requiredWeapon && result[ability.requiredWeapon]) {
        result[ability.requiredWeapon].push(ability);
      } else {
        result.any.push(ability);
      }
    });

    return result;
  };

  // Get all unique ability types for filtering
  const getAbilityTypes = (): string[] => {
    const types = new Set<string>();

    Object.values(abilities).forEach((ability) => {
      if (ability.animationType) {
        types.add(ability.animationType);
      }
    });

    return Array.from(types);
  };

  return {
    abilities,
    getAbility,
    getAbilitiesForWeaponType,
    getAbilitiesForSkill,
    getAnimationType,
    getAbilitiesByWeaponType,
    getAbilityTypes,
  };
}
