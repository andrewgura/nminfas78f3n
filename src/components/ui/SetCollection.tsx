import React, { useState, useEffect } from "react";
import { useGameStore } from "../../stores/gameStore";
import { useEventBus, useEmitEvent } from "../../hooks/useEventBus";
import { ItemSets, ItemData } from "@/types";
import { ItemDictionary } from "@/services/ItemDictionaryService";

interface SetSlot {
  slotType: string;
  name: string;
  position: string;
  weaponType?: string;
}

interface SetSlotProps {
  setType: ItemSets;
  slotInfo: SetSlot;
  itemId: string;
  isHighlighted: boolean;
  onDrop: (e: React.DragEvent, slotType: string) => void;
  onDragOver: (e: React.DragEvent, slotType: string) => void;
  onDragLeave: (e: React.DragEvent) => void;
}

const SetSlotComponent: React.FC<SetSlotProps> = ({
  setType,
  slotInfo,
  itemId,
  isHighlighted,
  onDrop,
  onDragOver,
  onDragLeave,
}) => {
  const isEmpty = !itemId;

  // Get item data and image if not empty
  let itemImageUrl = "";
  if (!isEmpty) {
    const itemData = ItemDictionary.getItem(itemId);
    if (itemData?.texture) {
      const folder = ItemDictionary.getItemFolder(itemData);
      itemImageUrl = `assets/equipment/${folder}/${itemData.texture}.png`;
    }
  }

  const slotClasses = `set-slot ${isEmpty ? "empty" : ""} ${isHighlighted ? "highlight-slot" : ""}`;

  return (
    <div className="set-slot-container" style={{ gridArea: slotInfo.position }}>
      <div
        className={slotClasses}
        data-set-type={setType}
        data-slot-type={slotInfo.slotType}
        data-weapon-type={slotInfo.weaponType || ""}
        data-item-id={itemId}
        onDragOver={(e) => onDragOver(e, slotInfo.slotType)}
        onDragLeave={onDragLeave}
        onDrop={(e) => onDrop(e, slotInfo.slotType)}
        style={{
          backgroundImage: itemImageUrl ? `url(${itemImageUrl})` : "none",
          backgroundSize: "contain",
          backgroundRepeat: "no-repeat",
          backgroundPosition: "center",
        }}
      />
      <div className="set-slot-name">{slotInfo.name}</div>
    </div>
  );
};

interface ConfirmDialogProps {
  isOpen: boolean;
  onConfirm: () => void;
  onCancel: () => void;
}

const ConfirmDialog: React.FC<ConfirmDialogProps> = ({ isOpen, onConfirm, onCancel }) => {
  if (!isOpen) return null;

  return (
    <div className="set-confirmation-overlay">
      <div className="set-confirmation-dialog">
        <div className="set-confirmation-title">Confirm Item Placement</div>
        <div className="set-confirmation-message">
          Warning, placing the item here will cause you to lose access to it.
        </div>
        <div className="set-confirmation-buttons">
          <button className="set-confirm-button" onClick={onConfirm}>
            Confirm
          </button>
          <button className="set-cancel-button" onClick={onCancel}>
            Cancel
          </button>
        </div>
      </div>
    </div>
  );
};

const SetCollection: React.FC = () => {
  const { setCollections, updateSetCollections, playerCharacter } = useGameStore();
  const [visible, setVisible] = useState(false);
  const [currentSetView, setCurrentSetView] = useState<ItemSets>(ItemSets.SKELETAL_SET);
  const [highlightedSlot, setHighlightedSlot] = useState<string | null>(null);
  const [confirmDialog, setConfirmDialog] = useState({
    isOpen: false,
    slotType: "",
    itemId: "",
  });
  const emitEvent = useEmitEvent();

  useEventBus("setCollection.toggle", (data: { visible: boolean }) => {
    setVisible(data.visible);
  });

  // Set slot definitions - these would vary per set
  const setSlotDefinitions: Record<string, SetSlot[]> = {
    [ItemSets.SKELETAL_SET]: [
      { slotType: "weapon", name: "1H Melee", position: "0 0", weaponType: "melee" },
      { slotType: "weapon", name: "1H Magic", position: "1 0", weaponType: "magic" },
      { slotType: "weapon", name: "Ranged", position: "2 0", weaponType: "archery" },
      { slotType: "shield", name: "Shield", position: "0 1" },
      { slotType: "armor", name: "Armor", position: "1 1" },
      { slotType: "helmet", name: "Helmet", position: "2 1" },
      { slotType: "trinket", name: "Trinket", position: "0 2" },
      { slotType: "amulet", name: "Amulet", position: "1 2" },
    ],
  };

  // Set bonus definitions with exact requirements from the screenshot
  const setBonusDefinitions: Record<
    string,
    Array<{ items: number; bonus: string; value: number }>
  > = {
    [ItemSets.SKELETAL_SET]: [
      { items: 2, bonus: "Melee", value: 1 },
      { items: 4, bonus: "Health", value: 50 },
      { items: 6, bonus: "Armor", value: 5 },
      { items: 8, bonus: "All Stats", value: 2 },
    ],
  };

  // Item-specific bonus definitions from ItemDictionaryService
  const itemBonusDefinitions: Record<string, { bonus: string; value: number }> = {
    boneClub: { bonus: "Melee", value: 1 },
    boneWand: { bonus: "Magic", value: 1 },
    throwableSkull: { bonus: "Archery", value: 1 },
    boneShield: { bonus: "Armor", value: 1 },
    skeletalArmor: { bonus: "Health", value: 20 },
    boneCharm: { bonus: "Regen", value: 2 },
    skullCap: { bonus: "Mana", value: 20 },
    skeletalMedallion: { bonus: "Move Speed", value: 200 },
  };

  // Toggle visibility when 'L' key is pressed
  useEffect(() => {
    const handleKeyPress = (e: KeyboardEvent) => {
      if (e.key.toLowerCase() === "l") {
        setVisible((prev) => !prev);

        // Emit appropriate message
        emitEvent(
          "ui.message.show",
          !visible ? "Set Collection opened. Press L to close." : "Set Collection closed."
        );

        // Emit visibility change event
        emitEvent("setCollection.visibility.changed", !visible);
      }
    };

    window.addEventListener("keydown", handleKeyPress);
    return () => window.removeEventListener("keydown", handleKeyPress);
  }, [visible, emitEvent]);

  // Close the collection
  const handleClose = () => {
    setVisible(false);
    emitEvent("ui.message.show", "Set Collection closed.");
    emitEvent("setCollection.visibility.changed", false);
  };

  // Change the current set view
  const handleSetChange = (setType: ItemSets) => {
    setCurrentSetView(setType);
  };

  // Handle drag over
  const handleDragOver = (e: React.DragEvent, slotType: string) => {
    e.preventDefault();

    // Get item data from dataTransfer
    const itemId = e.dataTransfer.getData("text/plain");
    if (!itemId) return;

    // Get item data
    const item = ItemDictionary.getItem(itemId);
    if (!item) return;

    // Check if the item is valid for this slot
    const isValidForSlot = ItemDictionary.canEquipInSlot(itemId, slotType);

    // If valid, highlight the slot
    if (isValidForSlot) {
      setHighlightedSlot(slotType);
    }
  };

  // Handle drag leave
  const handleDragLeave = (e: React.DragEvent) => {
    setHighlightedSlot(null);
  };

  // Handle drop
  const handleDrop = (e: React.DragEvent, slotType: string) => {
    e.preventDefault();
    setHighlightedSlot(null);

    // Get item data from dataTransfer
    const itemId = e.dataTransfer.getData("text/plain");
    if (!itemId) return;

    // Get item data
    const item = ItemDictionary.getItem(itemId);
    if (!item) return;

    // Check if the item is valid for this slot
    const isValidForSlot = ItemDictionary.canEquipInSlot(itemId, slotType);

    if (isValidForSlot) {
      // Show confirmation dialog
      setConfirmDialog({
        isOpen: true,
        slotType,
        itemId,
      });
    } else {
      emitEvent("ui.message.show", `This item cannot be placed in the ${slotType} slot.`);
    }
  };

  // Handle confirm dialog confirm
  const handleConfirmDialogConfirm = () => {
    const { slotType, itemId } = confirmDialog;

    // Add item to set
    const newCollections = { ...setCollections };
    if (!newCollections[currentSetView]) {
      newCollections[currentSetView] = {};
    }

    newCollections[currentSetView][slotType] = itemId;
    updateSetCollections(newCollections);

    // Get item name
    const item = ItemDictionary.getItem(itemId);
    if (item) {
      emitEvent(
        "ui.message.show",
        `Added ${item.name} to ${formatSetName(currentSetView)} collection.`
      );
    }

    // Close dialog
    setConfirmDialog({
      isOpen: false,
      slotType: "",
      itemId: "",
    });
  };

  // Handle confirm dialog cancel
  const handleConfirmDialogCancel = () => {
    setConfirmDialog({
      isOpen: false,
      slotType: "",
      itemId: "",
    });
  };

  // Get set bonuses
  const getSetBonuses = () => {
    // Count collected items
    const collectionItems = setCollections[currentSetView] || {};
    const collectedItems = Object.values(collectionItems).filter((id) => id !== "").length;
    const totalItems = setSlotDefinitions[currentSetView]?.length || 0;

    // Get set bonus definitions
    const bonuses = setBonusDefinitions[currentSetView] || [];

    // Return bonuses with activation status
    return bonuses.map((bonusInfo) => {
      const isActive = collectedItems >= bonusInfo.items;
      return {
        ...bonusInfo,
        isActive,
      };
    });
  };

  // Check if set is complete
  const isSetComplete = () => {
    const collectionItems = setCollections[currentSetView] || {};
    const collectedItems = Object.values(collectionItems).filter((id) => id !== "").length;
    const totalItems = setSlotDefinitions[currentSetView]?.length || 0;

    return collectedItems === totalItems;
  };

  // Format set name for display
  const formatSetName = (setType: string): string => {
    return setType
      .replace(/_/g, " ")
      .split(" ")
      .map((word) => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
      .join(" ");
  };

  // Format bonus type for display
  const formatBonusType = (bonusType: string): string => {
    const formatted = bonusType.replace(/([A-Z])/g, " $1");
    return formatted.charAt(0).toUpperCase() + formatted.slice(1);
  };

  if (!visible) {
    return null;
  }

  // Get data for current view
  const currentCollectionItems = setCollections[currentSetView] || {};

  // Count collected items
  const collectedItems = Object.values(currentCollectionItems).filter((id) => id !== "").length;
  const totalItems = setSlotDefinitions[currentSetView]?.length || 0;

  // Get set bonuses
  const setBonuses = getSetBonuses();

  return (
    <div className="set-collection-container">
      <div className="set-collection-header">
        <h2>Set Collection</h2>
        <button className="close-button" onClick={handleClose}>
          ✕
        </button>
      </div>

      <div className="set-tabs">
        {Object.values(ItemSets).map((setType) => (
          <div
            key={setType}
            className={`set-tab ${setType === currentSetView ? "active" : ""}`}
            data-set-type={setType}
            onClick={() => handleSetChange(setType as ItemSets)}
          >
            {formatSetName(setType)}
          </div>
        ))}
      </div>

      <div className="set-content">
        <div className="set-slots-panel">
          <div className="set-slots-grid">
            {setSlotDefinitions[currentSetView]?.map((slot) => (
              <SetSlotComponent
                key={`${currentSetView}-${slot.slotType}-${slot.position}`}
                setType={currentSetView}
                slotInfo={slot}
                itemId={currentCollectionItems[slot.slotType] || ""}
                isHighlighted={highlightedSlot === slot.slotType}
                onDrop={handleDrop}
                onDragOver={handleDragOver}
                onDragLeave={handleDragLeave}
              />
            ))}
          </div>
        </div>
      </div>

      <div className="set-bonuses-panel">
        <div className="set-bonuses-header">
          <div className="set-progress">
            Set Progress: {collectedItems}/{totalItems}
          </div>
        </div>

        <div className="set-bonuses-content">
          <div className="item-bonuses-list">
            {/* List each set item and its specific bonus */}
            {Object.entries(itemBonusDefinitions).map(([itemId, bonusInfo], index) => {
              const itemData = ItemDictionary.getItem(itemId);
              // Check if this item is already collected
              const isCollected = Object.values(currentCollectionItems).includes(itemId);

              return (
                <div
                  key={index}
                  className={`item-bonus ${isCollected ? "collected" : "not-collected"}`}
                >
                  <div className="item-bonus-icon">{isCollected ? "✓" : "○"}</div>
                  <div className="item-bonus-text">
                    {itemData?.name}: +{bonusInfo.value} {formatBonusType(bonusInfo.bonus)}
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        <div className="set-reward-section">
          <div className="set-reward-title">Complete Set Reward: Skeleton Outfit</div>
          <div className="set-reward-image">
            <img src="assets/outfit-preview/skeleton-outfit-preview.png" alt="Skeleton Outfit" />
          </div>
        </div>
      </div>

      {/* Confirmation Dialog */}
      <ConfirmDialog
        isOpen={confirmDialog.isOpen}
        onConfirm={handleConfirmDialogConfirm}
        onCancel={handleConfirmDialogCancel}
      />
    </div>
  );
};

export default SetCollection;
