import { useState, useCallback, useEffect } from "react";
import { autoAttackSystem } from "../services/AutoAttackSystem";
import { useEventBus } from "./useEventBus";

export function useAutoAttack() {
  const [target, setTarget] = useState<any | null>(autoAttackSystem.getCurrentTarget());
  const [isActive, setIsActive] = useState<boolean>(autoAttackSystem.isActive());
  const [lastAttackTime, setLastAttackTime] = useState<number>(0);

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

      // Trigger attack animation effect
      setIsAttackAnimating(true);
      setTimeout(() => setIsAttackAnimating(false), 300);
    }
  });

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
      isOnCooldown: Date.now() - lastAttackTime < 1000, // Simple cooldown check
      cooldownPercentage: getCooldownPercentage(),
    };
  }, [lastAttackTime]);

  // Calculate cooldown percentage
  const getCooldownPercentage = useCallback(() => {
    const now = Date.now();
    const elapsed = now - lastAttackTime;
    const cooldown = 1000; // Simplified - would come from the system

    if (elapsed >= cooldown) return 0;
    return Math.floor((elapsed / cooldown) * 100);
  }, [lastAttackTime]);

  return {
    target,
    isActive,
    isAttackAnimating,
    selectTarget,
    clearTarget,
    toggleAutoAttack,
    getAttackInfo,
  };
}
