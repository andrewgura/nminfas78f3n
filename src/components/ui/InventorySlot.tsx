import React, { useState, useRef, useEffect } from "react";
import { ItemData, ItemInstance } from "../../types";
import { ItemInstanceManager } from "@/utils/ItemInstanceManager";
import { ItemDictionary } from "@/services/ItemDictionaryService";
import ItemTooltip from "./tooltips/ItemTooltip";

interface InventorySlotProps {
  id: string;
  name: string;
  itemInstance?: ItemInstance;
  onDragStart: (e: React.DragEvent, slotId: string, itemInstanceId?: string) => void;
  onDragOver: (e: React.DragEvent) => void;
  onDrop: (e: React.DragEvent, slotId: string) => void;
  onClick?: (e: React.MouseEvent, slotId: string, itemInstanceId?: string) => void;
  onRightClick?: (e: React.MouseEvent, slotId: string, itemInstanceId?: string) => void;
  onDragEnter?: (e: React.DragEvent, slotId: string) => void;
  onDragLeave?: (e: React.DragEvent, slotId: string) => void;
  slotType?: string; // For equipment slots
  isValid?: boolean; // For drag-drop validation
}

const InventorySlot: React.FC<InventorySlotProps> = ({
  id,
  name,
  itemInstance,
  onDragStart,
  onDragOver,
  onDrop,
  onClick,
  onRightClick,
  onDragEnter,
  onDragLeave,
  slotType,
  isValid = true,
}) => {
  const [tooltipVisible, setTooltipVisible] = useState(false);
  const [isDragging, setIsDragging] = useState(false);
  const slotRef = useRef<HTMLDivElement>(null);

  // Handle right click
  const handleContextMenu = (e: React.MouseEvent) => {
    e.preventDefault();
    if (onRightClick && itemInstance) {
      onRightClick(e, id, itemInstance.instanceId);
    }
  };

  // Handle mouse click
  const handleClick = (e: React.MouseEvent) => {
    if (onClick) {
      onClick(e, id, itemInstance?.instanceId);
    }
  };

  const getCategoryFolder = (category?: string): string => {
    const categoryToFolderMap: Record<string, string> = {
      weapon_melee: "melee-weapons",
      weapon_magic: "magic",
      weapon_ranged: "ranged",
      armor: "chest",
      shield: "offhand",
      helmet: "helmet",
      amulet: "necklace",
      trinket: "trinket",
      food: "food",
      product: "products",
      currency: "valuables",
      material: "valuables",
      consumable: "valuables",
      quest: "valuables",
    };

    return category ? categoryToFolderMap[category] || "valuables" : "valuables";
  };

  // Get item data if slot has an item
  let itemData: ItemData | null = null;
  let itemImageUrl: string = "";

  if (itemInstance) {
    // Get combined stats from instance and template
    itemData = ItemInstanceManager.getCombinedStats(itemInstance);

    if (itemData && itemData.texture) {
      const folder = ItemDictionary.getItemFolder(itemData);
      itemImageUrl = `assets/equipment/${folder}/${itemData.texture}.png`;
    }
  }

  // Get quantity for display
  const quantity = itemInstance?.quantity || 1;
  const showQuantity = quantity > 1;

  // Global cleanup function for all drag validation classes
  const cleanupAllDragValidation = () => {
    document.querySelectorAll(".valid-target, .invalid-target").forEach((el) => {
      el.classList.remove("valid-target", "invalid-target");
    });
  };

  // Custom drag handler to handle drag to world
  const handleDragStart = (e: React.DragEvent) => {
    if (!itemInstance) return;

    setIsDragging(true);

    // Set data transfer with instanceId
    e.dataTransfer.setData("text/plain", itemInstance.instanceId);

    // Set custom drag image
    if (itemImageUrl && e.dataTransfer) {
      const img = new Image();
      img.src = itemImageUrl;
      img.width = 40;
      img.height = 40;

      // This ensures the image is loaded before setting as drag image
      if (img.complete) {
        e.dataTransfer.setDragImage(img, 20, 20);
      } else {
        img.onload = () => {
          e.dataTransfer.setDragImage(img, 20, 20);
        };
      }
    }

    // Call parent onDragStart
    onDragStart(e, id, itemInstance.instanceId);
  };

  // Handle drag end - ENHANCED cleanup
  const handleDragEnd = (e: React.DragEvent) => {
    setIsDragging(false);

    // Clean up all drag validation classes when drag ends
    cleanupAllDragValidation();
  };

  // Add global event listener for drop on canvas - REMOVED to prevent conflicts
  // The Inventory component handles all drops to the world
  useEffect(() => {
    if (!isDragging || !itemInstance) return;

    // Only handle drag over to prevent default behavior
    const handleGlobalDragOver = (e: DragEvent) => {
      e.preventDefault();
    };

    // Add listeners when dragging starts
    document.addEventListener("dragover", handleGlobalDragOver);

    return () => {
      document.removeEventListener("dragover", handleGlobalDragOver);
    };
  }, [isDragging, itemInstance]);

  // Enhanced cleanup on component unmount or when dragging changes
  useEffect(() => {
    // Cleanup when component unmounts or when drag state changes
    return () => {
      if (isDragging) {
        cleanupAllDragValidation();
      }
    };
  }, [isDragging]);

  // Determine slot class names
  const slotClassNames = [
    "item-slot",
    !itemInstance ? "empty" : "",
    slotType ? `slot-type-${slotType}` : "",
    !isValid ? "invalid-target" : "",
    // Only add item-set-piece class without modifying background
    itemData?.set ? "item-set-piece" : "",
    // Only add item-with-bonus if it has bonuses AND is not a set item
    itemInstance?.bonusStats && Object.keys(itemInstance.bonusStats).length > 0 && !itemData?.set
      ? "item-with-bonus"
      : "",
    itemData?.type === "product" ? "product-item" : "",
  ]
    .filter(Boolean)
    .join(" ");

  // Handle mouse enter to show tooltip
  const handleMouseEnter = (e: React.MouseEvent) => {
    if (!itemInstance) return;

    setTooltipVisible(true);
  };

  // Handle mouse leave to hide tooltip
  const handleMouseLeave = () => {
    setTooltipVisible(false);
  };

  return (
    <>
      <div
        ref={slotRef}
        id={id}
        className={slotClassNames}
        data-slot-name={name}
        data-slot-type={slotType}
        data-item-id={itemInstance?.instanceId || ""}
        draggable={!!itemInstance}
        onDragStart={handleDragStart}
        onDragEnd={handleDragEnd}
        onDragOver={onDragOver}
        onDrop={(e) => onDrop(e, id)}
        onDragEnter={onDragEnter ? (e) => onDragEnter(e, id) : undefined}
        onDragLeave={onDragLeave ? (e) => onDragLeave(e, id) : undefined}
        onClick={handleClick}
        onContextMenu={handleContextMenu}
        onMouseEnter={handleMouseEnter}
        onMouseLeave={handleMouseLeave}
        style={
          itemInstance
            ? {
                backgroundImage: itemImageUrl ? `url(${itemImageUrl})` : "none",
                backgroundSize: "contain",
                backgroundRepeat: "no-repeat",
                backgroundPosition: "center",
                backgroundColor: "#1a1612",
                position: "relative",
              }
            : {}
        }
      >
        {/* Quantity display for stackable items */}
        {showQuantity && (
          <div
            style={{
              position: "absolute",
              bottom: "2px",
              right: "2px",
              backgroundColor: "rgba(0, 0, 0, 0.8)",
              color: "#fff",
              fontSize: "10px",
              fontWeight: "bold",
              padding: "1px 3px",
              borderRadius: "2px",
              lineHeight: "1",
              textShadow: "1px 1px 1px rgba(0, 0, 0, 0.8)",
              pointerEvents: "none",
              zIndex: 10,
            }}
          >
            {quantity}
          </div>
        )}
      </div>

      {/* Render the tooltip component */}
      <ItemTooltip itemInstance={itemInstance} visible={tooltipVisible} />
    </>
  );
};

export default InventorySlot;
