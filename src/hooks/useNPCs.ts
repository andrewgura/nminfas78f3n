import { useState } from "react";
import { useEventBus } from "./useEventBus";

export function useNPCs() {
  const [npcs, setNPCs] = useState<Record<string, any>>({});
  const [activeDialogs, setActiveDialogs] = useState<Record<string, any>>({});
  const [activeShops, setActiveShops] = useState<string[]>([]);

  // Listen for NPC creation
  useEventBus("npc.created", (data) => {
    if (data?.id) {
      setNPCs((prev) => ({
        ...prev,
        [data.id]: {
          id: data.id,
          name: data.name,
          isMerchant: data.isMerchant,
          position: data.position,
        },
      }));
    }
  });

  // Listen for NPC destruction
  useEventBus("npc.destroyed", (data) => {
    if (data?.id) {
      setNPCs((prev) => {
        const newNPCs = { ...prev };
        delete newNPCs[data.id];
        return newNPCs;
      });

      // Remove from active dialogs if present
      setActiveDialogs((prev) => {
        const newDialogs = { ...prev };
        delete newDialogs[data.id];
        return newDialogs;
      });

      // Remove from active shops
      setActiveShops((prev) => prev.filter((id) => id !== data.id));
    }
  });

  // Listen for dialog start
  useEventBus("npc.dialog.started", (data) => {
    if (data?.npcId) {
      setActiveDialogs((prev) => ({
        ...prev,
        [data.npcId]: {
          npcName: data.npcName,
          dialog: data.dialog,
          currentLine: data.currentLine,
        },
      }));
    }
  });

  // Listen for dialog advancement
  useEventBus("npc.dialog.advanced", (data) => {
    if (data?.npcId) {
      setActiveDialogs((prev) => ({
        ...prev,
        [data.npcId]: {
          ...prev[data.npcId],
          currentLine: data.currentLine,
          text: data.text,
        },
      }));
    }
  });

  // Listen for dialog end
  useEventBus("npc.dialog.ended", (data) => {
    if (data?.npcId) {
      setActiveDialogs((prev) => {
        const newDialogs = { ...prev };
        delete newDialogs[data.npcId];
        return newDialogs;
      });
    }
  });

  // Listen for shop opening
  useEventBus("shop.open", (data) => {
    if (data?.npcId) {
      setActiveShops((prev) => [...prev, data.npcId]);
    }
  });

  // Listen for shop closing
  useEventBus("shop.close", (data) => {
    if (data?.npcId) {
      setActiveShops((prev) => prev.filter((id) => id !== data.npcId));
    }
  });

  return {
    npcs: Object.values(npcs),
    activeDialogs: Object.keys(activeDialogs).map((id) => ({
      npcId: id,
      ...activeDialogs[id],
    })),
    activeShops,
    getNPCById: (id: string) => npcs[id],
    getMerchants: () => Object.values(npcs).filter((npc) => npc.isMerchant),
    hasActiveDialog: () => Object.keys(activeDialogs).length > 0,
    hasActiveShop: () => activeShops.length > 0,
  };
}
