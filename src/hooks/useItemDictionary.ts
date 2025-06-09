import { useState } from "react";
import { ItemDictionary } from "../services/ItemDictionaryService";
import { useEventBus } from "./useEventBus";
import { ItemData, ItemCategory, ItemType } from "../types";

export function useItemDictionary() {
  const [itemsById, setItemsById] = useState<Record<string, ItemData>>({});

  // Listen for initialization events
  useEventBus("itemDictionary.initialized", () => {
    setItemsById(ItemDictionary.getAllItems());
  });

  // Get an item by ID
  const getItem = (itemId: string): ItemData | null => {
    return ItemDictionary.getItem(itemId);
  };

  // Get item name
  const getItemName = (itemId: string): string => {
    return ItemDictionary.getItemName(itemId);
  };

  // Get item type
  const getItemType = (itemId: string): string => {
    return ItemDictionary.getItemType(itemId);
  };

  // Get weapon type
  const getWeaponType = (itemId: string): string | null => {
    return ItemDictionary.getWeaponType(itemId);
  };

  // Check if item can be equipped in slot
  const canEquipInSlot = (itemId: string, slotType: string): boolean => {
    return ItemDictionary.canEquipInSlot(itemId, slotType);
  };

  // Get items by category
  const getItemsByCategory = (category: ItemCategory): ItemData[] => {
    return ItemDictionary.getItemsByCategory(category);
  };

  // Get all weapons
  const getAllWeapons = (): ItemData[] => {
    return ItemDictionary.getAllWeapons();
  };

  // Get items by set
  const getItemsBySet = (setType: string): ItemData[] => {
    return ItemDictionary.getItemsBySet(setType);
  };

  // Get folder path for item icons
  const getItemFolder = (item: ItemData): string => {
    return ItemDictionary.getItemFolder(item);
  };

  // Get image URL for an item
  const getItemImageUrl = (item: ItemData): string => {
    if (!item || !item.texture) return "";
    const folder = getItemFolder(item);
    return `assets/equipment/${folder}/${item.texture}.png`;
  };

  // Get all categories with item counts
  const getCategoriesWithCounts = (): Record<string, number> => {
    const counts: Record<string, number> = {};

    Object.values(itemsById).forEach((item) => {
      if (item.category) {
        counts[item.category] = (counts[item.category] || 0) + 1;
      }
    });

    return counts;
  };

  return {
    itemsById,
    getItem,
    getItemName,
    getItemType,
    getWeaponType,
    canEquipInSlot,
    getItemsByCategory,
    getAllWeapons,
    getItemsBySet,
    getItemFolder,
    getItemImageUrl,
    getCategoriesWithCounts,
    allItems: Object.values(itemsById),
  };
}
