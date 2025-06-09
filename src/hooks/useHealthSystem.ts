import { useCallback, useState } from "react";
import { healthSystem } from "../services/HealthSystem";
import { useGameStore } from "../stores/gameStore";
import { useEventBus } from "./useEventBus";

export function useHealthSystem() {
  // Get health data from store
  const health = useGameStore((state) => state.playerCharacter.health);
  const maxHealth = useGameStore((state) => state.playerCharacter.maxHealth);

  // State for damage animation
  const [isFlashing, setIsFlashing] = useState(false);

  // Subscribe to damage events
  useEventBus("playerCharacter.damage.taken", () => {
    setIsFlashing(true);
    // Reset after animation duration
    setTimeout(() => setIsFlashing(false), 300);
  });

  // Calculate health percentage
  const healthPercentage = Math.max(0, Math.min(100, (health / maxHealth) * 100));

  // Apply damage wrapper
  const takeDamage = useCallback((amount: number, source: string = "default") => {
    healthSystem.applyDamage(amount, source);
  }, []);

  // Apply healing wrapper
  const heal = useCallback((amount: number, source: string = "default") => {
    healthSystem.applyHealing(amount, source);
  }, []);

  // Resurrect player wrapper
  const resurrect = useCallback((healthPercentage: number = 25) => {
    healthSystem.resurrectPlayer(healthPercentage);
  }, []);

  // Determine health color based on percentage
  const getHealthColor = useCallback(() => {
    if (healthPercentage > 60) return "#2ecc71"; // Green
    if (healthPercentage > 30) return "#f39c12"; // Orange
    return "#e74c3c"; // Red
  }, [healthPercentage]);

  return {
    health,
    maxHealth,
    healthPercentage,
    isFlashing,
    takeDamage,
    heal,
    resurrect,
    getHealthColor,
    isDead: health <= 0,
  };
}
