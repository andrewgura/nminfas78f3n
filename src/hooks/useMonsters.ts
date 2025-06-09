import { useState } from "react";
import { useEventBus } from "./useEventBus";

export function useMonsters() {
  const [monsters, setMonsters] = useState<Record<string, any>>({});
  const [activeMonsters, setActiveMonsters] = useState<string[]>([]);
  const [combatTargets, setCombatTargets] = useState<string[]>([]);

  // Listen for monster creation
  useEventBus("monster.created", (data) => {
    if (data?.id) {
      setMonsters((prev) => ({
        ...prev,
        [data.id]: {
          id: data.id,
          type: data.type,
          name: data.name,
          health: data.health,
          maxHealth: data.maxHealth,
          position: data.position,
          isAggressive: data.isAggressive,
        },
      }));

      setActiveMonsters((prev) => [...prev, data.id]);
    }
  });

  // Listen for monster death
  useEventBus("monster.died", (data) => {
    if (data?.type) {
      // Find the monster by type and remove it
      const monsterId = Object.keys(monsters).find(
        (id) =>
          monsters[id].type === data.type &&
          monsters[id].position?.x === data.x &&
          monsters[id].position?.y === data.y
      );

      if (monsterId) {
        setMonsters((prev) => {
          const newMonsters = { ...prev };
          delete newMonsters[monsterId];
          return newMonsters;
        });

        setActiveMonsters((prev) => prev.filter((id) => id !== monsterId));
        setCombatTargets((prev) => prev.filter((id) => id !== monsterId));
      }
    }
  });

  // Listen for monster damage
  useEventBus("monster.damage", (data) => {
    if (data?.id) {
      setMonsters((prev) => {
        if (!prev[data.id]) return prev;

        return {
          ...prev,
          [data.id]: {
            ...prev[data.id],
            health: data.currentHealth,
          },
        };
      });
    }
  });

  // Listen for combat target selection
  useEventBus("target.selected", (data) => {
    if (data?.target?.id) {
      setCombatTargets((prev) => [...prev, data.target.id]);
    }
  });

  // Listen for combat target clearing
  useEventBus("target.cleared", (data) => {
    if (data?.previousTarget?.id) {
      setCombatTargets((prev) => prev.filter((id) => id !== data.previousTarget.id));
    }
  });

  return {
    monsters: Object.values(monsters),
    activeMonsters: activeMonsters.map((id) => monsters[id]).filter(Boolean),
    combatTargets: combatTargets.map((id) => monsters[id]).filter(Boolean),
    getMonsterById: (id: string) => monsters[id],
    getMonstersByType: (type: string) =>
      Object.values(monsters).filter((monster) => monster.type === type),
    getActiveMonsterCount: () => activeMonsters.length,
  };
}
