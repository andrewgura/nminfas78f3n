import { useState } from "react";
import { useEventBus } from "./useEventBus";

export function useCombat() {
  const [attacks, setAttacks] = useState<Record<string, any>>({});
  const [projectiles, setProjectiles] = useState<any[]>([]);
  const [impacts, setImpacts] = useState<any[]>([]);
  const [attackEffects, setAttackEffects] = useState<any[]>([]);

  // Listen for attack events
  useEventBus("monster.attack.hit", (data) => {
    if (data?.entityId) {
      setAttacks((prev) => ({
        ...prev,
        [data.entityId]: {
          timestamp: Date.now(),
          ...data,
        },
      }));

      // Clean up old attacks (keep only the last 10 seconds)
      setTimeout(() => {
        setAttacks((prev) => {
          const now = Date.now();
          const newAttacks = { ...prev };

          Object.entries(newAttacks).forEach(([id, attack]) => {
            if (now - attack.timestamp > 10000) {
              delete newAttacks[id];
            }
          });

          return newAttacks;
        });
      }, 10000);
    }
  });

  // Listen for projectile events
  useEventBus("monster.attack.projectile", (data) => {
    if (data) {
      const newProjectile = {
        id: `proj-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
        timestamp: Date.now(),
        ...data,
      };

      setProjectiles((prev) => [...prev, newProjectile]);

      // Clean up old projectiles after a delay
      setTimeout(() => {
        setProjectiles((prev) => prev.filter((p) => p.id !== newProjectile.id));
      }, 5000);
    }
  });

  // Listen for impact events
  useEventBus("monster.attack.impact", (data) => {
    if (data) {
      const newImpact = {
        id: `impact-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
        timestamp: Date.now(),
        ...data,
      };

      setImpacts((prev) => [...prev, newImpact]);

      // Clean up old impacts after a delay
      setTimeout(() => {
        setImpacts((prev) => prev.filter((i) => i.id !== newImpact.id));
      }, 2000);
    }
  });

  // Listen for attack effect events
  useEventBus("monster.attack.effect", (data) => {
    if (data) {
      const newEffect = {
        id: `effect-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
        timestamp: Date.now(),
        ...data,
      };

      setAttackEffects((prev) => [...prev, newEffect]);

      // Clean up old effects after a delay
      setTimeout(() => {
        setAttackEffects((prev) => prev.filter((e) => e.id !== newEffect.id));
      }, 2000);
    }
  });

  return {
    recentAttacks: Object.values(attacks),
    activeProjectiles: projectiles,
    activeImpacts: impacts,
    activeEffects: attackEffects,
    hasActiveEffects: projectiles.length > 0 || impacts.length > 0 || attackEffects.length > 0,
  };
}
