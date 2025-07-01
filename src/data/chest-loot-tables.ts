import { eventBus } from "@/utils/EventBus";

export interface LootEntry {
  itemId: string;
  chance: number;
  minQuantity?: number;
  maxQuantity?: number;
}

// Define all loot tables
export const CHEST_LOOT_TABLES: Record<string, LootEntry[]> = {
  "noob-cave-table-poor": [
    { itemId: "greatSword", chance: 0.8 },
    { itemId: "sword1", chance: 0.9 },
    { itemId: "goldCoins", chance: 1.0, minQuantity: 2, maxQuantity: 5 },
  ],
  default: [{ itemId: "goldCoins", chance: 1.0 }],
};

export class ChestLootTables {
  static generateLootFromTable(
    lootTableId: string,
    x: number,
    y: number,
    spawnFunction: (itemId: string, x: number, y: number, quantity?: number) => void
  ): void {
    try {
      // Get the table or use default if not found
      const table = CHEST_LOOT_TABLES[lootTableId] || CHEST_LOOT_TABLES.default;

      // Generate loot from the table
      table.forEach((item) => {
        // Check if item should drop based on chance
        if (Math.random() <= item.chance) {
          const offsetX = Math.random() * 30 - 15;
          const offsetY = Math.random() * 30 - 15;

          // Calculate quantity if specified
          let quantity = 1;
          if (item.minQuantity !== undefined && item.maxQuantity !== undefined) {
            quantity = Math.floor(
              Math.random() * (item.maxQuantity - item.minQuantity + 1) + item.minQuantity
            );
          } else if (item.minQuantity !== undefined) {
            // If only minQuantity is specified, use it as the fixed quantity
            quantity = item.minQuantity;
          }

          // Spawn the item WITH the calculated quantity
          spawnFunction(item.itemId, x + offsetX, y + offsetY, quantity);
        }
      });
    } catch (error) {
      console.error(`Error generating loot from table ${lootTableId}:`, error);
      eventBus.emit("error.loot.generate", { lootTableId, error });
    }
  }
}
