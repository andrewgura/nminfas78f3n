import React, { useState, useCallback, useEffect } from "react";
import { useGameStore } from "../../stores/gameStore";
import { useEmitEvent } from "../../hooks/useEventBus";
import InventorySlot from "./InventorySlot";
import { ItemInstance, ItemType } from "../../types";
import { ItemDictionary } from "../../services/ItemDictionaryService";
import { ItemInstanceManager } from "@/utils/ItemInstanceManager";
import { PhaserSceneManager } from "@/services/PhaserSceneManager";
import { GameScene } from "@/scenes/GameScene";

const Inventory: React.FC = () => {
  const {
    playerCharacter,
    getItemInstanceById,
    removeItemInstanceFromInventory,
    setPlayerCharacterEquipment,
    addItemInstanceToInventory,
  } = useGameStore();

  const [draggedItem, setDraggedItem] = useState<{
    sourceSlotId: string;
    itemInstanceId: string;
  } | null>(null);

  // Pagination state
  const [currentPage, setCurrentPage] = useState<number>(0);
  const SLOTS_PER_PAGE = 20;

  // Calculate total pages based on inventory capacity
  const totalPages = Math.ceil(playerCharacter.maxCapacity / SLOTS_PER_PAGE);

  // Minimization state
  const [minimized, setMinimized] = useState<boolean>(false);

  const emitEvent = useEmitEvent();

  // Equipment slots configuration - standardized naming
  const equipmentSlots = [
    { id: "helmet", name: "Helmet", type: "helmet", position: "0 0" },
    { id: "amulet", name: "Amulet", type: "amulet", position: "1 0" },
    { id: "trinket", name: "Trinket", type: "trinket", position: "2 0" },
    { id: "weapon", name: "Weapon", type: "weapon", position: "0 1" },
    { id: "armor", name: "Armor", type: "armor", position: "1 1" },
    { id: "offhand", name: "Offhand", type: "offhand", position: "2 1" }, // Standardized to "offhand"
  ];

  // Function to drop item into game world
  const dropItemToWorld = useCallback(
    (itemInstance: ItemInstance) => {
      if (!itemInstance) return false;

      // Get the game scene with proper casting
      const gameScene = PhaserSceneManager.getScene("game") as GameScene;
      if (!gameScene || !gameScene.playerCharacter) {
        emitEvent("ui.error.show", "Cannot drop item: game scene not available");
        return false;
      }

      // Get player position
      const playerX = gameScene.playerCharacter.x;
      const playerY = gameScene.playerCharacter.y;

      // Spawn item in the world at player's position
      const item = gameScene.spawnItem(
        itemInstance.templateId,
        playerX,
        playerY,
        itemInstance.instanceId,
        itemInstance.bonusStats
      );

      if (item) {
        // Determine if this item is from equipment or inventory
        const isFromEquipment = draggedItem && !draggedItem.sourceSlotId.startsWith("inv-");

        if (isFromEquipment) {
          // Remove from equipment
          const equipmentSlot = draggedItem!.sourceSlotId;
          const currentEquipment = { ...playerCharacter.equipment };
          currentEquipment[equipmentSlot as keyof typeof currentEquipment] = null;
          setPlayerCharacterEquipment(currentEquipment);
        } else {
          // Remove from inventory
          removeItemInstanceFromInventory(itemInstance.instanceId);
        }

        // Get proper item name
        const itemName = ItemInstanceManager.getDisplayName(itemInstance);

        // Show message
        emitEvent("ui.message.show", `You dropped ${itemName}.`);
        return true;
      }

      return false;
    },
    [
      removeItemInstanceFromInventory,
      setPlayerCharacterEquipment,
      playerCharacter.equipment,
      draggedItem,
      emitEvent,
    ]
  );

  // Set up document-level drop handler
  useEffect(() => {
    const handleDocumentDrop = (e: DragEvent) => {
      if (draggedItem && (e.target instanceof HTMLCanvasElement || e.target === document.body)) {
        e.preventDefault();

        // Get the dragged item
        const instance = getItemInstanceById(draggedItem.itemInstanceId);
        if (instance) {
          dropItemToWorld(instance);
          setDraggedItem(null);
        }
      }
    };

    const preventDefaultDragOver = (e: DragEvent) => {
      if (draggedItem) {
        e.preventDefault();
      }
    };

    // Add document listeners
    document.addEventListener("drop", handleDocumentDrop);
    document.addEventListener("dragover", preventDefaultDragOver);

    return () => {
      document.removeEventListener("drop", handleDocumentDrop);
      document.removeEventListener("dragover", preventDefaultDragOver);
    };
  }, [draggedItem, getItemInstanceById, dropItemToWorld]);

  // Get item instance for a slot
  const getItemInstanceForSlot = useCallback(
    (slotId: string): ItemInstance | undefined => {
      if (slotId.startsWith("inv-")) {
        // Inventory slot - get from inventory array by index
        const slotIndex = parseInt(slotId.replace("inv-", ""));
        const inventoryIndex = slotIndex + currentPage * SLOTS_PER_PAGE;
        return playerCharacter.inventory[inventoryIndex];
      } else {
        // Equipment slot - check if equipment has this item
        const equipment = playerCharacter.equipment;
        const slotKey = slotId as keyof typeof equipment;

        // Return the ItemInstance stored in equipment, convert null to undefined
        return equipment[slotKey] || undefined;
      }
    },
    [playerCharacter, currentPage, SLOTS_PER_PAGE]
  );

  // Check if an item can be equipped in a slot
  const canEquipInSlot = useCallback(
    (itemInstanceId: string, slotType: string): boolean => {
      const instance = getItemInstanceById(itemInstanceId);
      if (!instance) return false;

      return ItemDictionary.canEquipInSlot(instance.templateId, slotType);
    },
    [getItemInstanceById]
  );

  // Handle equipment of an item
  const equipItem = useCallback(
    (itemInstanceId: string, slotType: string): boolean => {
      try {
        const instance = getItemInstanceById(itemInstanceId);
        if (!instance) return false;

        // Verify the item can be equipped in this slot
        if (!canEquipInSlot(itemInstanceId, slotType)) {
          emitEvent("ui.message.show", `This item cannot be equipped in the ${slotType} slot.`);
          return false;
        }

        // Get current equipment
        const currentEquipment = { ...playerCharacter.equipment };

        // Store current equipped item to potentially move to inventory
        const currentEquippedItem = currentEquipment[slotType as keyof typeof currentEquipment];

        // Equip the new item (store the ItemInstance, not ItemData)
        currentEquipment[slotType as keyof typeof currentEquipment] = instance;

        // Update the equipment
        setPlayerCharacterEquipment(currentEquipment);

        // Remove the item from inventory
        if (!removeItemInstanceFromInventory(itemInstanceId)) {
          console.error("Failed to remove item from inventory");
          return false;
        }

        // If there was an item previously equipped, add it to inventory
        if (currentEquippedItem) {
          // Add to inventory - the ItemInstance is already preserved
          if (!addItemInstanceToInventory(currentEquippedItem)) {
            console.error("Failed to add previous item to inventory");
          }
        }

        // Get item name for message
        const itemName = ItemInstanceManager.getDisplayName(instance);
        emitEvent("ui.message.show", `Equipped ${itemName}`);
        return true;
      } catch (error) {
        console.error("Error equipping item:", error);
        emitEvent("ui.error.show", "Failed to equip item");
        return false;
      }
    },
    [
      playerCharacter,
      getItemInstanceById,
      canEquipInSlot,
      setPlayerCharacterEquipment,
      removeItemInstanceFromInventory,
      addItemInstanceToInventory,
      emitEvent,
    ]
  );

  // Handle drag start
  const handleDragStart = (e: React.DragEvent, slotId: string, itemInstanceId?: string) => {
    if (!itemInstanceId) return;

    setDraggedItem({
      sourceSlotId: slotId,
      itemInstanceId,
    });
  };

  // Handle drag over
  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
  };

  // Handle slot hover during drag
  const handleDragEnter = (e: React.DragEvent, slotId: string) => {
    e.preventDefault();

    if (!draggedItem) return;

    // Check if this is an equipment slot that needs validation
    if (!slotId.startsWith("inv-")) {
      const targetSlot = equipmentSlots.find((slot) => slot.id === slotId);
      if (targetSlot) {
        const isValid = canEquipInSlot(draggedItem.itemInstanceId, targetSlot.type);

        // Add class to target element based on validity
        const element = document.getElementById(slotId);
        if (element) {
          // First remove any existing classes to ensure clean state
          element.classList.remove("valid-target", "invalid-target");

          // Add the appropriate class
          if (isValid) {
            element.classList.add("valid-target");
          } else {
            element.classList.add("invalid-target");
          }
        }
      }
    } else {
      // Inventory slots are always valid targets
      const element = document.getElementById(slotId);
      if (element) {
        element.classList.remove("valid-target", "invalid-target");
        element.classList.add("valid-target");
      }
    }
  };

  // Remove highlighting when drag leaves
  const handleDragLeave = (e: React.DragEvent, slotId: string) => {
    e.preventDefault();

    const element = document.getElementById(slotId);
    if (element) {
      // Make sure to remove both classes
      element.classList.remove("valid-target");
      element.classList.remove("invalid-target");
    }
  };

  // GLOBAL cleanup function for drag validation classes
  const cleanupAllDragValidation = useCallback(() => {
    // Clean up ALL drag validation classes throughout the entire UI
    document.querySelectorAll(".valid-target, .invalid-target").forEach((el) => {
      el.classList.remove("valid-target", "invalid-target");
    });
  }, []);

  // Handle drop
  const handleDrop = (e: React.DragEvent, targetSlotId: string) => {
    e.preventDefault();

    // Always clean up all drag validation first
    cleanupAllDragValidation();

    // No dragged item or same slot
    if (!draggedItem || draggedItem.sourceSlotId === targetSlotId) {
      setDraggedItem(null);
      return;
    }

    // Get source item
    const sourceItem = getItemInstanceById(draggedItem.itemInstanceId);
    if (!sourceItem) {
      setDraggedItem(null);
      return;
    }

    // If target is an equipment slot
    if (!targetSlotId.startsWith("inv-")) {
      // Try to equip the item
      const targetSlot = equipmentSlots.find((slot) => slot.id === targetSlotId);
      if (targetSlot && canEquipInSlot(draggedItem.itemInstanceId, targetSlot.type)) {
        equipItem(draggedItem.itemInstanceId, targetSlot.type);
      } else {
        emitEvent(
          "ui.message.show",
          `This item cannot be equipped in the ${targetSlot?.name || ""} slot.`
        );
      }
    } else {
      // Target is an inventory slot

      // If source is equipment slot, handle un-equipping
      if (!draggedItem.sourceSlotId.startsWith("inv-")) {
        // Unequip the item from equipment to inventory
        const equipmentSlot = draggedItem.sourceSlotId;

        // Get the current equipment
        const currentEquipment = { ...playerCharacter.equipment };
        const currentItem = currentEquipment[equipmentSlot as keyof typeof currentEquipment];

        if (!currentItem) {
          setDraggedItem(null);
          return;
        }

        // Remove from equipment
        currentEquipment[equipmentSlot as keyof typeof currentEquipment] = null;

        // Update equipment
        setPlayerCharacterEquipment(currentEquipment);

        // Add to inventory - currentItem is already an ItemInstance
        if (addItemInstanceToInventory(currentItem)) {
          const itemName = ItemInstanceManager.getDisplayName(currentItem);
          emitEvent("ui.message.show", `Unequipped ${itemName}`);
        } else {
          emitEvent("ui.message.show", "No inventory space available");

          // Revert equipment change if couldn't add to inventory
          setPlayerCharacterEquipment({ ...playerCharacter.equipment });
        }
      } else {
        // Both source and target are inventory slots, swap them
        emitEvent("ui.message.show", `Swapped inventory items`);
        // TODO: Implement inventory swap logic
      }
    }

    setDraggedItem(null);
  };

  // Enhanced cleanup when drag ends (for any reason)
  useEffect(() => {
    const handleDragEndGlobal = () => {
      if (draggedItem) {
        cleanupAllDragValidation();
        setDraggedItem(null);
      }
    };

    // Listen for drag end on the document
    document.addEventListener("dragend", handleDragEndGlobal);
    document.addEventListener("drop", handleDragEndGlobal);

    return () => {
      document.removeEventListener("dragend", handleDragEndGlobal);
      document.removeEventListener("drop", handleDragEndGlobal);
    };
  }, [draggedItem, cleanupAllDragValidation]);

  // Handle right-click on item (for equipment)
  const handleItemRightClick = (e: React.MouseEvent, slotId: string, itemInstanceId?: string) => {
    if (!itemInstanceId) return;

    // If clicking on an inventory item, try to equip it
    if (slotId.startsWith("inv-")) {
      const instance = getItemInstanceById(itemInstanceId);
      if (!instance) return;

      // Get the item data
      const itemData = ItemInstanceManager.getCombinedStats(instance);
      if (!itemData) return;

      // Determine which slot to equip to
      let targetSlot = "";
      if (itemData.type === ItemType.WEAPON) targetSlot = "weapon";
      else if (itemData.type === ItemType.OFFHAND)
        targetSlot = "offhand"; // Standardized to "offhand"
      else if (itemData.type === ItemType.HELMET) targetSlot = "helmet";
      else if (itemData.type === ItemType.AMULET) targetSlot = "amulet";
      else if (itemData.type === ItemType.TRINKET) targetSlot = "trinket";
      else if (itemData.type === ItemType.ARMOR) targetSlot = "armor";

      if (targetSlot) {
        equipItem(itemInstanceId, targetSlot);
      } else {
        emitEvent("ui.message.show", `Don't know where to equip ${itemData.name}`);
      }
    }
    // If clicking on an equipped item, unequip it
    else {
      // Unequip the item from the equipment slot
      const equipmentSlot = slotId;

      // Get the current equipment
      const currentEquipment = { ...playerCharacter.equipment };
      const currentItem = currentEquipment[equipmentSlot as keyof typeof currentEquipment];

      if (!currentItem) return;

      // Remove from equipment
      currentEquipment[equipmentSlot as keyof typeof currentEquipment] = null;

      // Update equipment
      setPlayerCharacterEquipment(currentEquipment);

      // Add to inventory - currentItem is already an ItemInstance
      if (addItemInstanceToInventory(currentItem)) {
        const itemName = ItemInstanceManager.getDisplayName(currentItem);
        emitEvent("ui.message.show", `Unequipped ${itemName}`);
      } else {
        emitEvent("ui.message.show", "No inventory space available");

        // Revert equipment change if couldn't add to inventory
        setPlayerCharacterEquipment({ ...playerCharacter.equipment });
      }
    }
  };

  // Function to switch to the next page
  const handleNextPage = () => {
    if (currentPage < totalPages - 1) {
      setCurrentPage(currentPage + 1);
    }
  };

  // Function to switch to the previous page
  const handlePreviousPage = () => {
    if (currentPage > 0) {
      setCurrentPage(currentPage - 1);
    }
  };

  // Toggle minimize/maximize
  const toggleMinimize = () => {
    setMinimized(!minimized);
  };

  return (
    <div className="inventory-equipment-container">
      {/* Equipment Section */}
      <div className="equipment-container">
        <div className="ui-section-header-with-controls">
          <h3 className="ui-section-header">Equipment</h3>
          <div className="ui-window-controls">
            <button className="ui-window-control minimize-button" onClick={toggleMinimize}>
              {minimized ? "+" : "-"}
            </button>
          </div>
        </div>

        {!minimized && (
          <div className="equipment-slots-grid">
            {equipmentSlots.map((slot) => (
              <div
                key={slot.id}
                className="slot-container"
                style={{ gridArea: slot.position.replace(" ", " / ") }}
              >
                <InventorySlot
                  id={slot.id}
                  name={slot.name}
                  slotType={slot.type}
                  itemInstance={getItemInstanceForSlot(slot.id)}
                  onDragStart={handleDragStart}
                  onDragOver={handleDragOver}
                  onDragEnter={handleDragEnter}
                  onDragLeave={handleDragLeave}
                  onDrop={handleDrop}
                  onRightClick={handleItemRightClick}
                  isValid={
                    draggedItem ? canEquipInSlot(draggedItem.itemInstanceId, slot.type) : true
                  }
                />
                <div className="slot-name">{slot.name}</div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Inventory Section */}
      <div className="inventory-container">
        <div className="ui-section-header-with-controls">
          <h3 className="ui-section-header">Inventory</h3>
          <div className="ui-window-controls">
            <button className="ui-window-control minimize-button" onClick={toggleMinimize}>
              {minimized ? "+" : "-"}
            </button>
          </div>
        </div>

        {!minimized && (
          <>
            <div className="inventory-slots-grid">
              {Array.from({ length: SLOTS_PER_PAGE }).map((_, index) => {
                const slotId = `inv-${index}`;
                return (
                  <InventorySlot
                    key={slotId}
                    id={slotId}
                    name={`Slot ${index + 1}`}
                    itemInstance={getItemInstanceForSlot(slotId)}
                    onDragStart={handleDragStart}
                    onDragOver={handleDragOver}
                    onDragEnter={handleDragEnter}
                    onDragLeave={handleDragLeave}
                    onDrop={handleDrop}
                    onRightClick={handleItemRightClick}
                  />
                );
              })}
            </div>

            {/* Simple Inventory Navigation */}
            <div className="inventory-navigation">
              <button
                className={`inventory-nav-button ${currentPage === 0 ? "disabled" : ""}`}
                onClick={handlePreviousPage}
                disabled={currentPage === 0}
              >
                ←
              </button>

              <button
                className={`inventory-nav-button ${currentPage === totalPages - 1 ? "disabled" : ""}`}
                onClick={handleNextPage}
                disabled={currentPage === totalPages - 1}
              >
                →
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  );
};

export default Inventory;
