import React, { useState, useEffect } from "react";
import { useGameStore } from "../../stores/gameStore";
import { useEventBus } from "../../hooks/useEventBus";

const Resources: React.FC = () => {
  const { playerCharacter } = useGameStore();

  // Health state
  const [currentHealth, setCurrentHealth] = useState(playerCharacter.health);
  const [maxHealth, setMaxHealth] = useState(playerCharacter.maxHealth);
  const [isHealthFlashing, setIsHealthFlashing] = useState(false);

  // Resource/Mana state
  const [currentResource, setCurrentResource] = useState(100);
  const [maxResource, setMaxResource] = useState(100);
  const [isResourceFlashing, setIsResourceFlashing] = useState(false);

  // Status states (would be connected to actual game state in a real implementation)
  const [inCombat, setInCombat] = useState(true);
  const [isFed, setIsFed] = useState(true);
  const [isBurning, setIsBurning] = useState(true);
  const [isPoisoned, setIsPoisoned] = useState(true);
  const [isSlowed, setIsSlowed] = useState(true);
  const [isExtraRegen, setIsExtraRegen] = useState(true);

  // Listen for health changes
  useEventBus("playerCharacter.health.changed", (health: number) => {
    // Flash red when health decreases
    if (health < currentHealth) {
      setIsHealthFlashing(true);
      setTimeout(() => setIsHealthFlashing(false), 300);
    }
    setCurrentHealth(health);
  });

  // Listen for max health changes
  useEventBus("playerCharacter.maxHealth.changed", (maxHealth: number) => {
    setMaxHealth(maxHealth);
  });

  // Mock resource regeneration (would be replaced with actual system)
  useEffect(() => {
    const interval = setInterval(() => {
      setCurrentResource((prev) => Math.min(maxResource, prev + 0.5));
    }, 1000);

    return () => clearInterval(interval);
  }, [maxResource]);

  // Calculate health percentage
  const healthPercentage = Math.max(0, Math.min(100, (currentHealth / maxHealth) * 100));

  // Calculate resource percentage
  const resourcePercentage = Math.max(0, Math.min(100, (currentResource / maxResource) * 100));

  // Determine health bar color class
  const getHealthColorClass = () => {
    if (healthPercentage > 90) return "health-bar-fill-high";
    if (healthPercentage > 60) return "health-bar-fill-high";
    if (healthPercentage > 35) return "health-bar-fill-medium";
    if (healthPercentage > 20) return "health-bar-fill-low";
    return "health-bar-fill-very-low";
  };

  return (
    <div className="resources-panel">
      {/* Health Bar */}
      <div className="resource-bar health-bar">
        <div
          className={`resource-bar-fill ${getHealthColorClass()} ${isHealthFlashing ? "health-flash" : ""}`}
          style={{ width: `${healthPercentage}%` }}
        />
        <div className="resource-bar-text">{`${Math.floor(currentHealth)}/${maxHealth}`}</div>
      </div>

      {/* Mana/Resource Bar */}
      <div className="resource-bar mana-bar">
        <div
          className={`resource-bar-fill mana-bar-fill ${isResourceFlashing ? "resource-flash" : ""}`}
          style={{ width: `${resourcePercentage}%` }}
        />
        <div className="resource-bar-text">{`${Math.floor(currentResource)}/${maxResource}`}</div>
      </div>

      {/* Status Bar */}
      <div className="status-bar">
        {inCombat && (
          <div className="status-icon in-combat" title="In Combat">
            ⚔️
          </div>
        )}
        {isFed && (
          <div className="status-icon is-fed" title="Well Fed">
            🍖
          </div>
        )}
        {isBurning && (
          <div className="status-icon is-burning" title="Burning">
            🔥
          </div>
        )}
        {isPoisoned && (
          <div className="status-icon is-poisoned" title="Poisoned">
            ☠️
          </div>
        )}
        {isSlowed && (
          <div className="status-icon is-slowed" title="Slowed">
            🐌
          </div>
        )}
        {isExtraRegen && (
          <div className="status-icon is-extra-regen" title="Extra Regeneration">
            💗
          </div>
        )}
      </div>
    </div>
  );
};

export default Resources;
