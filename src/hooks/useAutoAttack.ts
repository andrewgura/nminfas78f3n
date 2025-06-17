// src/hooks/useAutoAttack.ts
import { useState, useCallback, useEffect } from "react";
import { autoAttackSystem } from "../services/AutoAttackSystem";
import { useEventBus } from "./useEventBus";

export function useAutoAttack() {
  const [target, setTarget] = useState<any | null>(autoAttackSystem.getCurrentTarget());
  const [isActive, setIsActive] = useState<boolean>(autoAttackSystem.isActive());
  const [lastAttackTime, setLastAttackTime] = useState<number>(0);
  const [currentCooldown, setCurrentCooldown] = useState<number>(2000); // Default 2 seconds

  // Keep track of cool effect when attacking
  const [isAttackAnimating, setIsAttackAnimating] = useState<boolean>(false);

  // Listen for target selection
  useEventBus("target.selected", (data) => {
    if (data?.target) {
      setTarget(data.target);
      setIsActive(true);
    }
  });

  // Listen for target cleared
  useEventBus("target.cleared", () => {
    setTarget(null);
    setIsActive(false);
  });

  // Listen for attack performed
  useEventBus("player.attack.performed", (data) => {
    if (data) {
      setLastAttackTime(Date.now());

      // Update current cooldown from the attack event
      if (data.attackCooldown) {
        setCurrentCooldown(data.attackCooldown);
      }

      // Trigger attack animation effect
      setIsAttackAnimating(true);
      setTimeout(() => setIsAttackAnimating(false), 300);
    }
  });

  // Listen for attack speed updates (when equipment changes)
  useEventBus("player.attackSpeed.updated", (data) => {
    if (data?.attackCooldown) {
      setCurrentCooldown(data.attackCooldown);
    }
  });

  // Update cooldown when component mounts and periodically
  useEffect(() => {
    const updateCooldown = () => {
      const newCooldown = autoAttackSystem.getCurrentAttackCooldown();
      setCurrentCooldown(newCooldown);
    };

    // Initial update
    updateCooldown();

    // Update every second to keep it fresh
    const interval = setInterval(updateCooldown, 1000);

    return () => clearInterval(interval);
  }, []);

  // Wrapper function to set target
  const selectTarget = useCallback((monster: any) => {
    autoAttackSystem.setTarget(monster);
  }, []);

  // Wrapper function to clear target
  const clearTarget = useCallback(() => {
    autoAttackSystem.clearTarget();
  }, []);

  // Toggle auto-attack on/off
  const toggleAutoAttack = useCallback(() => {
    if (isActive) {
      clearTarget();
    } else if (target) {
      selectTarget(target);
    }
  }, [isActive, target, clearTarget, selectTarget]);

  // Get attack information
  const getAttackInfo = useCallback(() => {
    return {
      weaponType: autoAttackSystem.getCurrentWeaponType(),
      isOnCooldown: Date.now() - lastAttackTime < currentCooldown,
      cooldownPercentage: getCooldownPercentage(),
      attackCooldown: currentCooldown,
    };
  }, [lastAttackTime, currentCooldown]);

  // Calculate cooldown percentage
  const getCooldownPercentage = useCallback(() => {
    const now = Date.now();
    const elapsed = now - lastAttackTime;

    if (elapsed >= currentCooldown) return 0;
    return Math.floor((elapsed / currentCooldown) * 100);
  }, [lastAttackTime, currentCooldown]);

  return {
    target,
    isActive,
    isAttackAnimating,
    currentCooldown,
    selectTarget,
    clearTarget,
    toggleAutoAttack,
    getAttackInfo,
  };
}
