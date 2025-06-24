import { eventBus } from "../utils/EventBus";

// Interface for shop items
export interface ShopItem {
  itemId: string;
  price: number;
}

// Interface for NPC data
export interface NPCData {
  id: string;
  name: string;
  texture: string;
  dialog: string[];
  isMerchant?: boolean;
  shopItems?: ShopItem[];
  interactionRadius?: number;
}

// NPC_DATA moved to internal service
const NPC_DATA: Record<string, NPCData> = {
  "merchant-aldee": {
    id: "merchant-aldee",
    name: "Al Dee",
    texture: "playerCharacter", // Reusing playerCharacter texture for now
    dialog: [
      "Hello there! I'm Al Dee, the finest merchant in these parts.",
      "I have wares from across the realm!",
      "What can I interest you in today?",
    ],
    isMerchant: true,
    shopItems: [
      { itemId: "greatSword", price: 50 },
      { itemId: "twigBow", price: 40 },
      { itemId: "woodenStaff", price: 45 },
      { itemId: "boneShield", price: 35 },
    ],
    interactionRadius: 160, // 5 tiles at 32px per tile
  },
};

class NPCServicel {
  private npcs: Record<string, NPCData> = {};

  constructor() {
    this.initialize();
  }

  private initialize(): void {
    try {
      // Load NPCs from data
      Object.values(NPC_DATA).forEach((npc) => {
        this.registerNPC(npc);
      });

      // Emit initialization event
      eventBus.emit("npcService.initialized", {
        count: Object.keys(this.npcs).length,
      });
    } catch (error) {
      console.error("Error initializing NPC service:", error);
    }
  }

  private registerNPC(npc: NPCData): void {
    if (!npc.id) {
      console.error("Invalid NPC data: missing id", npc);
      return;
    }
    this.npcs[npc.id] = npc;
  }

  getNPC(npcId: string): NPCData | null {
    return this.npcs[npcId] || null;
  }

  getAllNPCIds(): string[] {
    return Object.keys(this.npcs);
  }

  getMerchants(): NPCData[] {
    return Object.values(this.npcs).filter((npc) => npc.isMerchant);
  }

  getShopItems(npcId: string): ShopItem[] {
    const npc = this.getNPC(npcId);
    return npc?.shopItems || [];
  }

  updateDialog(npcId: string, newDialog: string[]): boolean {
    const npc = this.npcs[npcId];
    if (!npc) return false;

    npc.dialog = newDialog;

    // Emit update event
    eventBus.emit("npc.dialog.updated", {
      npcId,
      dialog: newDialog,
    });

    return true;
  }

  addShopItem(npcId: string, itemId: string, price: number): boolean {
    const npc = this.npcs[npcId];
    if (!npc || !npc.isMerchant) return false;

    // Initialize shop items array if it doesn't exist
    if (!npc.shopItems) {
      npc.shopItems = [];
    }

    // Check if item already exists in shop
    const existingItem = npc.shopItems.find((item) => item.itemId === itemId);
    if (existingItem) {
      // Update price of existing item
      existingItem.price = price;
    } else {
      // Add new item
      npc.shopItems.push({ itemId, price });
    }

    // Emit update event
    eventBus.emit("npc.shop.updated", {
      npcId,
      shopItems: npc.shopItems,
    });

    return true;
  }

  removeShopItem(npcId: string, itemId: string): boolean {
    const npc = this.npcs[npcId];
    if (!npc || !npc.isMerchant || !npc.shopItems) return false;

    // Filter out the item
    const initialLength = npc.shopItems.length;
    npc.shopItems = npc.shopItems.filter((item) => item.itemId !== itemId);

    // Check if item was removed
    if (npc.shopItems.length < initialLength) {
      // Emit update event
      eventBus.emit("npc.shop.updated", {
        npcId,
        shopItems: npc.shopItems,
      });
      return true;
    }

    return false;
  }

  startDialog(npcId: string): void {
    const npc = this.getNPC(npcId);
    if (!npc) return;

    // Emit dialog started event
    eventBus.emit("npc.dialog.started", {
      npcId,
      npcName: npc.name,
      dialog: npc.dialog,
    });
  }

  openShop(npcId: string): void {
    const npc = this.getNPC(npcId);
    if (!npc || !npc.isMerchant) return;

    // Emit shop opened event
    eventBus.emit("shop.open", {
      npcId,
      npcName: npc.name,
      shopItems: npc.shopItems || [],
    });
  }
}

// Create and export singleton instance
export const NPCService = new NPCServicel();
