import { Component } from "../Component";
import { Character } from "../Character";
import { useGameStore } from "@/stores/gameStore";
import { eventBus } from "@/utils/EventBus";
import { Item } from "../Item";
import { ItemDictionary } from "@/services/ItemDictionaryService";
import { ItemCategory } from "@/types";

export class PlayerItemInteractionComponent extends Component {
  private interactionZone: Phaser.GameObjects.Arc | null = null;
  private nearbyItems: Item[] = [];

  constructor(entity: Character) {
    super(entity);
  }

  initialize(): void {
    try {
      this.setupInteractionZone();

      // Register key handler
      this.entity.scene.input.keyboard?.on("keydown-E", this.handlePickupKeyPress, this);

      super.initialize();
    } catch (error) {
      console.error("Error initializing PlayerItemInteractionComponent:", error);
      eventBus.emit("error.component", {
        entityId: this.entity.id,
        componentId: "PlayerItemInteractionComponent",
        error,
      });
    }
  }

  setupInteractionZone(): void {
    try {
      this.interactionZone = this.entity.scene.add.circle(this.entity.x, this.entity.y, 60);
      this.entity.scene.physics.add.existing(this.interactionZone, true);
    } catch (error) {
      console.error("Error setting up interaction zone:", error);
      eventBus.emit("error.interaction.zone", {
        entityId: this.entity.id,
        error,
      });
    }
  }

  handlePickupKeyPress(): void {
    if (this.nearbyItems.length > 0) {
      this.pickupNearbyItem();
    }
  }

  update(time: number, delta: number): void {
    try {
      if (!this.isEnabled || (this.entity as Character).isDead) return;

      // Update interaction zone position
      if (this.interactionZone) {
        this.interactionZone.x = this.entity.x;
        this.interactionZone.y = this.entity.y;
      }

      this.checkForNearbyItems();
    } catch (error) {
      console.error("Error in PlayerItemInteractionComponent update:", error);
      eventBus.emit("error.component.update", {
        entityId: this.entity.id,
        componentId: "PlayerItemInteractionComponent",
        error,
      });
    }
  }

  checkForNearbyItems(): void {
    try {
      if (Math.random() < 0.05 && this.entity.scene) {
        const items = (this.entity.scene as any).items?.getChildren() || [];
        items.forEach((item: Item) => {
          const distance = Phaser.Math.Distance.Between(
            this.entity.x,
            this.entity.y,
            item.x,
            item.y
          );

          if (distance <= 60 && !this.nearbyItems.includes(item)) {
            this.addNearbyItem(item);
            if (item.highlightItem) item.highlightItem();
          }
        });
      }
    } catch (error) {
      console.error("Error checking for nearby items:", error);
      eventBus.emit("error.nearby.items", {
        entityId: this.entity.id,
        error,
      });
    }
  }

  addNearbyItem(item: Item): void {
    try {
      if (!this.nearbyItems.includes(item)) {
        this.nearbyItems.push(item);

        if (this.nearbyItems.length === 1) {
          eventBus.emit("ui.message.show", "Press E to pick up item");
          eventBus.emit("player.item.nearby", {
            itemId: item.instanceId,
            name: item.name,
            action: "added",
          });
        }
      }
    } catch (error) {
      console.error("Error adding nearby item:", error);
      eventBus.emit("error.add.nearby.item", {
        entityId: this.entity.id,
        itemId: item.instanceId,
        error,
      });
    }
  }

  removeNearbyItem(item: Item): void {
    try {
      const index = this.nearbyItems.indexOf(item);
      if (index !== -1) {
        this.nearbyItems.splice(index, 1);

        eventBus.emit("player.item.nearby", {
          itemId: item.instanceId,
          name: item.name,
          action: "removed",
        });
      }
    } catch (error) {
      console.error("Error removing nearby item:", error);
      eventBus.emit("error.remove.nearby.item", {
        entityId: this.entity.id,
        itemId: item.instanceId,
        error,
      });
    }
  }

  pickupNearbyItem(): void {
    try {
      if (this.nearbyItems.length > 0) {
        const item = this.nearbyItems[0];
        const store = useGameStore.getState();

        if (typeof store.addItemInstanceToInventory !== "function") {
          eventBus.emit("ui.message.show", "Inventory system not available");
          return;
        }

        if (item) {
          // Check if this is a gold/currency item
          const itemData = ItemDictionary.getItem(item.templateId);
          const isGoldItem =
            item.templateId === "goldCoins" || itemData?.category === ItemCategory.CURRENCY;

          if (isGoldItem) {
            // Handle gold pickup - add to player's gold count instead of inventory
            // Use the actual quantity from the item, not a hardcoded default!
            const goldAmount = item.quantity || 1; // Get the actual gold amount
            const currentGold = store.playerCharacter.gold;

            // Use the simpler method that just sets the new total
            store.updatePlayerGold(currentGold + goldAmount);

            // Remove the item from the world
            this.removeNearbyItem(item);
            item.destroy();

            // Show pickup message with actual amount
            eventBus.emit("ui.message.show", `Picked up ${goldAmount} gold`);
            eventBus.emit("player.gold.pickup", {
              amount: goldAmount,
              totalGold: currentGold + goldAmount,
            });
          } else {
            // Handle regular item pickup - add to inventory
            const added = store.addItemInstanceToInventory({
              templateId: item.templateId,
              instanceId: item.instanceId,
              bonusStats: item.bonusStats,
              quantity: item.quantity, // Make sure to include quantity for stackable items
            });

            if (added) {
              this.removeNearbyItem(item);
              item.destroy();

              eventBus.emit("ui.message.show", `Picked up ${item.name}`);
              eventBus.emit("player.item.pickup", {
                itemId: item.instanceId,
                name: item.name,
                templateId: item.templateId,
              });
            }
          }
        }
      } else {
        eventBus.emit("ui.message.show", "Nothing to pick up nearby");
      }
    } catch (error) {
      console.error("Error picking up item:", error);
      eventBus.emit("error.pickup.item", {
        entityId: this.entity.id,
        error,
      });
    }
  }

  destroy(): void {
    try {
      // Remove key handler
      this.entity.scene.input.keyboard?.off("keydown-E", this.handlePickupKeyPress, this);

      if (this.interactionZone) {
        this.interactionZone.destroy();
        this.interactionZone = null;
      }

      this.nearbyItems = [];

      super.destroy();
    } catch (error) {
      console.error("Error destroying PlayerItemInteractionComponent:", error);
      eventBus.emit("error.component.destroy", {
        entityId: this.entity.id,
        componentId: "PlayerItemInteractionComponent",
        error,
      });
    }
  }
}
