import { ItemDictionary } from "@/services/ItemDictionaryService";
import { Component } from "../Component";
import { Monster } from "../Monster";
import { ItemDrop } from "@/types";
import { eventBus } from "@/utils/EventBus";

export class MonsterDropComponent extends Component {
  private possibleDrops: ItemDrop[] = [];

  constructor(entity: Monster, drops: ItemDrop[]) {
    super(entity);
    this.possibleDrops = drops;
  }

  get monster(): Monster {
    return this.entity as Monster;
  }

  setPossibleDrops(drops: ItemDrop[]): void {
    this.possibleDrops = drops;

    // Emit drops updated event
    eventBus.emit("monster.drops.updated", {
      id: this.entity.id,
      drops: this.possibleDrops,
    });
  }

  processDrops(x: number, y: number): void {
    try {
      // No drops if empty
      if (this.possibleDrops.length === 0) return;

      // Check if any item dropped
      let droppedItems = 0;
      const drops: Array<{ itemId: string; quantity: number }> = [];

      // Process each possible drop
      this.possibleDrops.forEach((drop) => {
        // Calculate if the item drops based on chance
        if (Math.random() < drop.chance) {
          // Get the game scene
          const gameScene = this.entity.scene as any;

          // Determine quantity for this drop
          const minQuantity = drop.minQuantity || 1;
          const maxQuantity = drop.maxQuantity || 1;
          const quantity =
            Math.floor(Math.random() * (maxQuantity - minQuantity + 1)) + minQuantity;

          // Spawn the item(s)
          if (gameScene.spawnItem) {
            // Adjust position for multiple different drops
            const offsetX = droppedItems > 0 ? Math.random() * 20 - 10 : 0;
            const offsetY = droppedItems > 0 ? Math.random() * 20 - 10 : 0;

            // For stackable items (like gold), create ONE item with the full quantity
            const itemData = ItemDictionary.getItem(drop.itemId);
            if (itemData?.stackable) {
              // Create a single item with the correct quantity
              const item = gameScene.spawnItem(
                drop.itemId,
                x + offsetX,
                y + offsetY,
                undefined, // instanceId
                undefined, // bonusStats
                quantity // quantity - this is the key fix!
              );

              if (item) {
                drops.push({
                  itemId: item.templateId,
                  quantity: quantity, // Record the actual quantity dropped
                });
              }
            } else {
              // For non-stackable items, create individual items
              for (let i = 0; i < quantity; i++) {
                const itemX = x + offsetX + (i > 0 ? Math.random() * 10 - 5 : 0);
                const itemY = y + offsetY + (i > 0 ? Math.random() * 10 - 5 : 0);

                const item = gameScene.spawnItem(drop.itemId, itemX, itemY);

                if (item) {
                  drops.push({
                    itemId: item.templateId,
                    quantity: 1,
                  });
                }
              }
            }

            droppedItems += 1; // Count the drop type, not individual items
          }
        }
      });

      // Emit drops processed event if any items were dropped
      if (drops.length > 0) {
        eventBus.emit("monster.drops.processed", {
          id: this.entity.id,
          monsterType: this.monster.monsterType,
          monsterName: this.monster.monsterName,
          position: { x, y },
          drops: drops,
        });
      }
    } catch (error) {
      console.error(`Error processing drops for monster ${this.entity.id}:`, error);
      eventBus.emit("error.monster.drops", {
        id: this.entity.id,
        error,
      });
    }
  }
}
