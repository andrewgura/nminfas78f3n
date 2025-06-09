import { useState, useEffect, useCallback } from "react";
import { useGameStore } from "@/stores/gameStore";
import { useEventBus } from "./useEventBus";

export function useEntitySystem() {
  const [entities, setEntities] = useState<Record<string, any>>({});
  const [components, setComponents] = useState<Record<string, string[]>>({});

  // Listen for entity creation events
  useEventBus("entity.created", (data) => {
    if (data?.id) {
      setEntities((prev) => ({
        ...prev,
        [data.id]: { id: data.id, type: data.type },
      }));

      // Initialize empty component array for this entity
      setComponents((prev) => ({
        ...prev,
        [data.id]: [],
      }));
    }
  });

  // Listen for entity destruction events
  useEventBus("entity.destroyed", (data) => {
    if (data?.id) {
      setEntities((prev) => {
        const newEntities = { ...prev };
        delete newEntities[data.id];
        return newEntities;
      });

      setComponents((prev) => {
        const newComponents = { ...prev };
        delete newComponents[data.id];
        return newComponents;
      });
    }
  });

  // Listen for component added events
  useEventBus("component.added", (data) => {
    if (data?.entityId && data?.componentType) {
      setComponents((prev) => {
        const entityComponents = prev[data.entityId] || [];
        return {
          ...prev,
          [data.entityId]: [...entityComponents, data.componentType],
        };
      });
    }
  });

  // Listen for component removed events
  useEventBus("component.removed", (data) => {
    if (data?.entityId && data?.componentType) {
      setComponents((prev) => {
        const entityComponents = prev[data.entityId] || [];
        return {
          ...prev,
          [data.entityId]: entityComponents.filter((c) => c !== data.componentType),
        };
      });
    }
  });

  // Get entities by type
  const getEntitiesByType = useCallback(
    (type: string) => {
      return Object.values(entities).filter((entity) => entity.type === type);
    },
    [entities]
  );

  // Get entities with component
  const getEntitiesWithComponent = useCallback(
    (componentType: string) => {
      return Object.entries(components)
        .filter(([_, componentTypes]) => componentTypes.includes(componentType))
        .map(([entityId]) => entities[entityId])
        .filter(Boolean);
    },
    [entities, components]
  );

  return {
    entities,
    getEntitiesByType,
    getEntitiesWithComponent,
  };
}
