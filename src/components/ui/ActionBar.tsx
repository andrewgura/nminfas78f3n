// src/components/ui/ActionBar.tsx
import React, { useState, useEffect } from "react";
import { useGameStore } from "../../stores/gameStore";
import { useEventBus, useEmitEvent } from "../../hooks/useEventBus";
import { useAbilitySystem } from "../../hooks/useAbilitySystem";
import { AbilityDictionary } from "../../services/AbilityDictionaryService";

interface ActionSlotProps {
  index: number;
  keybind: string;
  onSelect: (index: number) => void;
  isActive: boolean;
  onCooldown: boolean;
  cooldownRemaining?: number;
  iconPath?: string;
  onDrop: (e: React.DragEvent) => void;
  isUltimate?: boolean;
}

const ActionSlot: React.FC<ActionSlotProps> = ({
  index,
  keybind,
  onSelect,
  isActive,
  onCooldown,
  cooldownRemaining,
  iconPath,
  onDrop,
  isUltimate = false,
}) => {
  // Handle dragover to allow dropping
  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    e.currentTarget.classList.add("valid-target");
  };

  // Remove highlight when drag leaves
  const handleDragLeave = (e: React.DragEvent) => {
    e.currentTarget.classList.remove("valid-target");
  };

  return (
    <div
      className={`action-slot ${isActive ? "action-slot-active" : ""} ${onCooldown ? "on-cooldown" : ""} ${isUltimate ? "ultimate-ability" : ""}`}
      data-slot-index={index}
      onClick={() => onSelect(index)}
      onDragOver={handleDragOver}
      onDragLeave={handleDragLeave}
      onDrop={(e) => {
        e.preventDefault();
        e.currentTarget.classList.remove("valid-target");
        onDrop(e);
      }}
    >
      <div
        className="action-slot-icon"
        style={
          iconPath
            ? { backgroundImage: `url("${iconPath}")`, backgroundColor: "#1a1612" }
            : { backgroundColor: "#2a2018" }
        }
      />
      {onCooldown && cooldownRemaining && (
        <div
          className="action-slot-cooldown"
          style={{
            display: "flex",
            background: `conic-gradient(
              transparent ${(1 - cooldownRemaining / 100) * 360}deg, 
              rgba(0, 0, 0, 0.7) ${(1 - cooldownRemaining / 100) * 360}deg
            )`,
          }}
        >
          {Math.ceil(cooldownRemaining)}
        </div>
      )}
      <div className="action-slot-keybind">{keybind}</div>
    </div>
  );
};

const ActionBar: React.FC = () => {
  const [selectedSlot, setSelectedSlot] = useState<number>(-1);
  const [slotAbilities, setSlotAbilities] = useState<Record<number, string>>({});
  const [slotIcons, setSlotIcons] = useState<Record<number, string>>({});
  const { playerCharacter } = useGameStore();
  const inputFocused = useGameStore((state) => state.inputFocused);
  const emitEvent = useEmitEvent();

  const { activeAbilities, isAbilityOnCooldown, getCooldownRemaining, activateAbility } =
    useAbilitySystem();

  // Listen for ability activation events
  useEventBus("ability.activated", (data) => {
    if (data && data.slotIndex !== undefined) {
      if (data.iconPath) {
        setSlotIcons((prev) => ({
          ...prev,
          [data.slotIndex - 1]: data.iconPath,
        }));
      }

      if (data.abilityId) {
        setSlotAbilities((prev) => ({
          ...prev,
          [data.slotIndex - 1]: data.abilityId,
        }));
      }
    }
  });

  // Listen for ability removal events
  useEventBus("ability.removeFromSlot", (data) => {
    if (data && data.slotIndex !== undefined) {
      setSlotAbilities((prev) => {
        const newAbilities = { ...prev };
        delete newAbilities[data.slotIndex - 1];
        return newAbilities;
      });

      setSlotIcons((prev) => {
        const newIcons = { ...prev };
        delete newIcons[data.slotIndex - 1];
        return newIcons;
      });
    }
  });

  // Handle key presses for action bar
  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (inputFocused) return;

      // Check for number keys 1-4
      if (event.key >= "1" && event.key <= "4") {
        const index = parseInt(event.key) - 1;
        selectActionSlot(index);
        event.preventDefault();
      }
    };

    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, [inputFocused]);

  const selectActionSlot = (index: number) => {
    // Check cooldown
    if (isAbilityOnCooldown(index)) {
      emitEvent("ui.message.show", "Ability is on cooldown!");
      return;
    }

    // Clear previous selection
    if (selectedSlot !== -1) {
      setSelectedSlot(-1);
    }

    // Set new selection
    setSelectedSlot(index);

    // Emit ability activation event
    emitEvent("ability.activate", { slotIndex: index + 1 });
  };

  // Handle ability drops from AbilityInterface
  const handleDrop = (index: number) => (e: React.DragEvent) => {
    e.preventDefault();

    try {
      // Get the dropped ability ID
      const abilityId = e.dataTransfer.getData("text/ability-id");

      if (!abilityId) return;

      // Get the ability data
      const ability = AbilityDictionary.getAbility(abilityId);
      if (!ability) return;

      // Check if this ability is already on the action bar
      let existingSlotIndex = -1;
      Object.entries(slotAbilities).forEach(([slotIdx, id]) => {
        if (id === abilityId) {
          existingSlotIndex = parseInt(slotIdx);
        }
      });

      // Check what's currently in the target slot
      const targetSlotAbility = slotAbilities[index];

      // Case 1: The ability is already on the bar, and we're moving to an empty slot
      if (existingSlotIndex !== -1 && !targetSlotAbility) {
        // Remove from old slot
        const newSlotAbilities = { ...slotAbilities };
        const newSlotIcons = { ...slotIcons };

        delete newSlotAbilities[existingSlotIndex];
        delete newSlotIcons[existingSlotIndex];

        // Add to new slot
        newSlotAbilities[index] = abilityId;
        newSlotIcons[index] = ability.icon;

        setSlotAbilities(newSlotAbilities);
        setSlotIcons(newSlotIcons);

        // Update ability system
        emitEvent("ability.setForSlot", {
          slotIndex: index + 1,
          abilityId: abilityId,
          ability: ability,
          iconPath: ability.icon,
        });

        // If it was in another slot, clear that slot
        if (existingSlotIndex !== -1) {
          emitEvent("ability.removeFromSlot", {
            slotIndex: existingSlotIndex + 1,
          });
        }

        emitEvent("ui.message.show", `Moved ${ability.name} to slot ${index + 1}`);
      }
      // Case 2: The ability is already on the bar, and we're moving to an occupied slot (swap)
      else if (existingSlotIndex !== -1 && targetSlotAbility) {
        // Get target slot's ability
        const targetAbility = AbilityDictionary.getAbility(targetSlotAbility);
        if (!targetAbility) return;

        // Swap abilities
        const newSlotAbilities = { ...slotAbilities };
        const newSlotIcons = { ...slotIcons };

        newSlotAbilities[existingSlotIndex] = targetSlotAbility;
        newSlotIcons[existingSlotIndex] = targetAbility.icon;

        newSlotAbilities[index] = abilityId;
        newSlotIcons[index] = ability.icon;

        setSlotAbilities(newSlotAbilities);
        setSlotIcons(newSlotIcons);

        // Update ability system for both slots
        emitEvent("ability.setForSlot", {
          slotIndex: index + 1,
          abilityId: abilityId,
          ability: ability,
          iconPath: ability.icon,
        });

        emitEvent("ability.setForSlot", {
          slotIndex: existingSlotIndex + 1,
          abilityId: targetSlotAbility,
          ability: targetAbility,
          iconPath: targetAbility.icon,
        });

        emitEvent(
          "ui.message.show",
          `Swapped abilities between slots ${existingSlotIndex + 1} and ${index + 1}`
        );
      }
      // Case 3: The ability is not on the bar yet
      else if (existingSlotIndex === -1) {
        const newSlotAbilities = { ...slotAbilities };
        const newSlotIcons = { ...slotIcons };

        // If target slot has an ability
        if (targetSlotAbility) {
          // We just overwrite it since the ability isn't elsewhere on the bar
          newSlotAbilities[index] = abilityId;
          newSlotIcons[index] = ability.icon;
        } else {
          // Empty slot, just add it
          newSlotAbilities[index] = abilityId;
          newSlotIcons[index] = ability.icon;
        }

        setSlotAbilities(newSlotAbilities);
        setSlotIcons(newSlotIcons);

        // Update ability system
        emitEvent("ability.setForSlot", {
          slotIndex: index + 1,
          abilityId: abilityId,
          ability: ability,
          iconPath: ability.icon,
        });

        emitEvent("ui.message.show", `Assigned ${ability.name} to slot ${index + 1}`);
      }
    } catch (error) {
      console.error("Error handling ability drop:", error);
      emitEvent("ui.error.show", "Failed to assign ability");
    }
  };

  return (
    <div className="action-bar-container">
      {/* Action Slots */}
      <div className="action-slots-wrapper">
        {[0, 1, 2].map((index) => (
          <ActionSlot
            key={index}
            index={index}
            keybind={(index + 1).toString()}
            onSelect={selectActionSlot}
            isActive={selectedSlot === index}
            onCooldown={isAbilityOnCooldown(index)}
            cooldownRemaining={getCooldownRemaining(index)}
            iconPath={slotIcons[index]}
            onDrop={handleDrop(index)}
          />
        ))}

        {/* Ultimate Ability Slot */}
        <ActionSlot
          key={3}
          index={3}
          keybind="4"
          onSelect={selectActionSlot}
          isActive={selectedSlot === 3}
          onCooldown={isAbilityOnCooldown(3)}
          cooldownRemaining={getCooldownRemaining(3)}
          iconPath={slotIcons[3]}
          onDrop={handleDrop(3)}
          isUltimate={true}
        />
      </div>
    </div>
  );
};

export default ActionBar;
