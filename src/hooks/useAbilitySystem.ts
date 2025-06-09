// src/hooks/useAbilitySystem.ts
import { useState, useEffect, useCallback } from "react";
import { useEventBus } from "./useEventBus";
import { abilitySystem } from "../services/AbilitySystem";
import { Ability } from "@/types";

export function useAbilitySystem() {
  const [activeAbilities, setActiveAbilities] = useState<Record<number, Ability>>(
    abilitySystem.getActiveAbilities()
  );
  const [currentWeaponType, setCurrentWeaponType] = useState<string | null>(
    abilitySystem.getCurrentWeaponType()
  );
  const [cooldowns, setCooldowns] = useState<Record<number, { end: number; duration: number }>>({});

  // Listen for abilities updates
  useEventBus("abilities.updated", (data) => {
    if (data) {
      setActiveAbilities(data);
    }
  });

  // Listen for cooldown start events
  useEventBus("ability.cooldown.start", (data) => {
    if (data && data.slotIndex !== undefined && data.duration) {
      setCooldowns((prev) => ({
        ...prev,
        [data.slotIndex]: {
          end: Date.now() + data.duration * 1000,
          duration: data.duration * 1000,
        },
      }));
    }
  });

  // Update cooldowns periodically
  useEffect(() => {
    const updateCooldowns = () => {
      const now = Date.now();
      let cooldownsChanged = false;

      const updatedCooldowns = { ...cooldowns };

      Object.entries(updatedCooldowns).forEach(([slotIndexStr, cooldownData]) => {
        const slotIndex = parseInt(slotIndexStr);
        if (now >= cooldownData.end) {
          delete updatedCooldowns[slotIndex];
          cooldownsChanged = true;
        }
      });

      if (cooldownsChanged) {
        setCooldowns(updatedCooldowns);
      }
    };

    const interval = setInterval(updateCooldowns, 100);
    return () => clearInterval(interval);
  }, [cooldowns]);

  // Listen for weapon type changes
  useEventBus("weaponType.changed", (data) => {
    if (data?.newType) {
      setCurrentWeaponType(data.newType);
    }
  });

  // Activate ability method
  const activateAbility = useCallback((slotIndex: number) => {
    abilitySystem.activateAbility(slotIndex);
  }, []);

  // Check if an ability is on cooldown
  const isAbilityOnCooldown = useCallback(
    (slotIndex: number): boolean => {
      return Boolean(cooldowns[slotIndex] && Date.now() < cooldowns[slotIndex].end);
    },
    [cooldowns]
  );

  // Get cooldown percentage for an ability
  const getAbilityCooldownPercentage = useCallback(
    (slotIndex: number): number => {
      if (!cooldowns[slotIndex] || Date.now() >= cooldowns[slotIndex].end) {
        return 0;
      }

      const timeLeft = cooldowns[slotIndex].end - Date.now();
      const percentage = (timeLeft / cooldowns[slotIndex].duration) * 100;
      return Math.max(0, Math.min(100, percentage));
    },
    [cooldowns]
  );

  // Get cooldown remaining in seconds
  const getCooldownRemaining = useCallback(
    (slotIndex: number): number => {
      if (!cooldowns[slotIndex] || Date.now() >= cooldowns[slotIndex].end) return 0;
      return Math.ceil((cooldowns[slotIndex].end - Date.now()) / 1000);
    },
    [cooldowns]
  );

  return {
    activeAbilities,
    currentWeaponType,
    activateAbility,
    isAbilityOnCooldown,
    getAbilityCooldownPercentage,
    getCooldownRemaining,
  };
}
