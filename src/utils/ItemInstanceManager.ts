import { v4 as uuidv4 } from "uuid";
import { ItemData, ItemInstance, ItemBonusStats } from "../types";
import { ItemDictionary } from "../services/ItemDictionaryService";

export class ItemInstanceManager {
  // Create a new item instance from a template ID
  static createItemInstance(
    templateId: string,
    bonusStats?: ItemBonusStats,
    quantity?: number
  ): ItemInstance {
    try {
      const itemData = ItemDictionary.getItem(templateId);

      return {
        templateId,
        instanceId: `${templateId}_${uuidv4().slice(0, 8)}`,
        bonusStats,
        quantity: quantity || (itemData?.stackable ? 1 : undefined), // Only set quantity for stackable items
      };
    } catch (error) {
      console.error("Error creating item instance:", error);
      // Create a basic instance as fallback
      return {
        templateId,
        instanceId: templateId,
        quantity: quantity || 1,
      };
    }
  }

  // Generate a random item with random bonuses
  static createRandomInstance(templateId: string, quantity?: number): ItemInstance {
    try {
      const template = ItemDictionary.getItem(templateId);
      if (!template) return this.createItemInstance(templateId, undefined, quantity);

      const bonusStats: ItemBonusStats = {};

      // Generate bonuses based on item type
      if (template.type === "weapon") {
        // Weapons might get damage bonuses
        if (Math.random() < 0.4) {
          bonusStats.power = Math.floor(Math.random() * 3) + 1; // +1 to +3 power
        }
      } else if (template.type === "armor" || template.type === "helmet") {
        // Armor items might get armor bonuses
        if (Math.random() < 0.4) {
          bonusStats.armor = Math.floor(Math.random() * 2) + 1; // +1 to +2 armor
        }
      }

      // Any item might get generic bonuses
      if (Math.random() < 0.2) {
        bonusStats.strength = Math.floor(Math.random() * 2) + 1; // +1 to +2 strength
      }

      return this.createItemInstance(templateId, bonusStats, quantity);
    } catch (error) {
      console.error("Error creating random item instance:", error);
      return this.createItemInstance(templateId, undefined, quantity);
    }
  }

  static createProductInstance(templateId: string, quantity: number = 1): ItemInstance {
    try {
      const itemData = ItemDictionary.getItem(templateId);

      if (!itemData) {
        console.warn(`Item ${templateId} not found in dictionary`);
        return this.createItemInstance(templateId, undefined, quantity);
      }

      if (itemData.type !== "product") {
        console.warn(`Item ${templateId} is not a product item`);
      }

      if (!itemData.stackable) {
        console.warn(`Product item ${templateId} is not stackable`);
      }

      return this.createItemInstance(templateId, undefined, quantity);
    } catch (error) {
      console.error("Error creating product instance:", error);
      return this.createItemInstance(templateId, undefined, quantity);
    }
  }

  // Create a food item with specified quantity
  static createFoodInstance(templateId: string, quantity: number = 1): ItemInstance {
    try {
      const itemData = ItemDictionary.getItem(templateId);

      if (!itemData || !itemData.stackable) {
        console.warn(`Item ${templateId} is not stackable food`);
      }

      return this.createItemInstance(templateId, undefined, quantity);
    } catch (error) {
      console.error("Error creating food instance:", error);
      return this.createItemInstance(templateId, undefined, quantity);
    }
  }

  // Get template data combined with instance bonuses
  static getCombinedStats(itemInstance: ItemInstance): ItemData {
    try {
      const template = ItemDictionary.getItem(itemInstance.templateId);
      if (!template) return {} as ItemData;

      // Clone the template
      const combined = { ...template };

      // Apply bonuses if they exist
      if (itemInstance.bonusStats) {
        if (itemInstance.bonusStats.power) {
          combined.power = (combined.power || 0) + itemInstance.bonusStats.power;
        }
        if (itemInstance.bonusStats.armor) {
          combined.armor = (combined.armor || 0) + itemInstance.bonusStats.armor;
        }
        if (itemInstance.bonusStats.magic) {
          combined.magic = (combined.magic || 0) + itemInstance.bonusStats.magic;
        }
        if (itemInstance.bonusStats.strength) {
          combined.strength = (combined.strength || 0) + itemInstance.bonusStats.strength;
        }
      }

      return combined;
    } catch (error) {
      console.error("Error getting combined stats:", error);
      return ItemDictionary.getItem(itemInstance.templateId) || ({} as ItemData);
    }
  }

  // Get display name for item instance including bonuses and quantity
  static getDisplayName(itemInstance: ItemInstance): string {
    try {
      const template = ItemDictionary.getItem(itemInstance.templateId);
      if (!template) return "Unknown Item";

      const baseName = template.name;
      const quantity = itemInstance.quantity || 1;

      // For stackable items, show quantity if > 1
      if (template.stackable && quantity > 1) {
        return `${baseName} x${quantity}`;
      }

      return baseName;
    } catch (error) {
      console.error("Error getting display name:", error);
      const template = ItemDictionary.getItem(itemInstance.templateId);
      return template ? template.name : "Unknown Item";
    }
  }

  // Get total weight for an item instance (accounting for quantity)
  static getTotalWeight(itemInstance: ItemInstance): number {
    try {
      const template = ItemDictionary.getItem(itemInstance.templateId);
      if (!template || !template.weight) return 0;

      const quantity = itemInstance.quantity || 1;
      return template.weight * quantity;
    } catch (error) {
      console.error("Error getting total weight:", error);
      return 0;
    }
  }
}
