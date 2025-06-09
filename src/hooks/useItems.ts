import { useState, useEffect } from "react";
import { useEventBus } from "./useEventBus";

export function useItems() {
  const [items, setItems] = useState<Record<string, any>>({});
  const [nearbyItems, setNearbyItems] = useState<Record<string, any>>({});
  const [highlightedItems, setHighlightedItems] = useState<string[]>([]);
  const [hoveredItem, setHoveredItem] = useState<string | null>(null);

  // Listen for item creation
  useEventBus("item.created", (data) => {
    if (data?.id) {
      setItems((prev) => ({
        ...prev,
        [data.id]: {
          id: data.id,
          templateId: data.templateId,
          name: data.name,
          isSetItem: data.isSetItem,
          setType: data.setType,
          bonusStats: data.bonusStats,
          position: data.position,
        },
      }));
    }
  });

  // Listen for item destruction
  useEventBus("item.destroyed", (data) => {
    if (data?.id) {
      setItems((prev) => {
        const newItems = { ...prev };
        delete newItems[data.id];
        return newItems;
      });

      // Also remove from nearby if present
      setNearbyItems((prev) => {
        const newItems = { ...prev };
        delete newItems[data.id];
        return newItems;
      });

      // Remove from highlighted items
      setHighlightedItems((prev) => prev.filter((id) => id !== data.id));

      // Clear hovered item if this was it
      if (hoveredItem === data.id) {
        setHoveredItem(null);
      }
    }
  });

  // Listen for item highlighting
  useEventBus("item.highlighted", (data) => {
    if (data?.id) {
      setHighlightedItems((prev) => [...prev, data.id]);
    }
  });

  // Listen for item unhighlighting
  useEventBus("item.unhighlighted", (data) => {
    if (data?.id) {
      setHighlightedItems((prev) => prev.filter((id) => id !== data.id));
    }
  });

  // Listen for nearby item notifications
  useEventBus("player.item.nearby", (data) => {
    if (data?.itemId) {
      if (data.action === "added") {
        setNearbyItems((prev) => ({
          ...prev,
          [data.itemId]: { id: data.itemId, name: data.itemName },
        }));
      } else if (data.action === "removed") {
        setNearbyItems((prev) => {
          const newItems = { ...prev };
          delete newItems[data.itemId];
          return newItems;
        });
      }
    }
  });

  // Listen for item hover start
  useEventBus("item.hover.start", (data) => {
    if (data?.id) {
      setHoveredItem(data.id);
    }
  });

  // Listen for item hover end
  useEventBus("item.hover.end", (data) => {
    if (data?.id && hoveredItem === data.id) {
      setHoveredItem(null);
    }
  });

  return {
    items,
    nearbyItems: Object.values(nearbyItems),
    highlightedItems,
    hoveredItem: hoveredItem ? items[hoveredItem] : null,
    getNearbyItemCount: () => Object.keys(nearbyItems).length,
    getItemById: (id: string) => items[id],
  };
}
