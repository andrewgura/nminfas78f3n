// src/hooks/useAbilityInterface.ts
import { useState, useCallback, useEffect } from "react";
import { useEventBus, useEmitEvent } from "./useEventBus";
import { Ability } from "@/types";
import { AbilityDictionary } from "../services/AbilityDictionaryService";
import { ItemDictionary } from "../services/ItemDictionaryService";
import { useGameStore } from "../stores/gameStore";

export function useAbilityInterface() {
  const [visible, setVisible] = useState(false);
  const [draggedAbility, setDraggedAbility] = useState<Ability | null>(null);
  const [actionBarAbilities, setActionBarAbilities] = useState<Record<number, string>>({});
  const [lastWeaponType, setLastWeaponType] = useState<string | null>(null);
  const { playerCharacter } = useGameStore();
  const emitEvent = useEmitEvent();

  // Initialize action bar abilities
  useEffect(() => {
    updateActionBarAbilities();
  }, []);

  // Listen for ability activation events
  useEventBus("ability.activated", (data) => {
    if (data) {
      updateActionBarAbilities();
    }
  });

  // Listen for equipment changes
  useEventBus("equipment.changed", (data) => {
    if (data && data.equipment) {
      updateAbilitiesForEquipment(data.equipment);
    }
  });

  // Toggle visibility
  const toggleInterface = useCallback(() => {
    setVisible((prev) => {
      const newState = !prev;

      if (newState) {
        updateAbilitiesForEquipment(playerCharacter.equipment);
        updateActionBarAbilities();
        emitEvent("ui.message.show", "Drag abilities to action bar slots. Press O to close.");
      }

      emitEvent("abilities.visibility.changed", newState);
      return newState;
    });
  }, [playerCharacter.equipment, emitEvent]);

  useEffect(() => {
    const handleKeyPress = (e: KeyboardEvent) => {
      if (e.key.toLowerCase() === "o") {
        toggleInterface();
      }
    };

    window.addEventListener("keydown", handleKeyPress);
    return () => window.removeEventListener("keydown", handleKeyPress);
  }, [toggleInterface]);

  // Update abilities based on equipped items
  const updateAbilitiesForEquipment = useCallback(
    (equipment: any) => {
      // Determine weapon type from equipment
      let weaponType = "none";

      // Check if user has any weapon equipped
      const hasWeaponEquipped = equipment && equipment.weapon && equipment.weapon.id;

      if (hasWeaponEquipped) {
        if (equipment.weapon?.weaponType) {
          weaponType = equipment.weapon.weaponType;
        } else if (equipment.weapon?.id) {
          // Try to get weapon type from item dictionary
          const itemWeaponType = ItemDictionary.getWeaponType(equipment.weapon.id);
          if (itemWeaponType) {
            weaponType = itemWeaponType;
          }
        }
      }

      // Check if weapon type has changed
      if (lastWeaponType !== null && lastWeaponType !== weaponType) {
        // Notify of weapon type change
        emitEvent("weaponType.changed", {
          oldType: lastWeaponType,
          newType: weaponType,
        });
      }

      // Update last weapon type
      setLastWeaponType(weaponType);
    },
    [lastWeaponType, emitEvent]
  );

  // Update action bar abilities
  const updateActionBarAbilities = useCallback(() => {
    // Get currently active abilities from the system
    // For now, we'll use default abilities as a fallback
    const testAbilities: Record<number, string> = {
      0: "swordSlash",
      1: "fireball",
      2: "powerShot",
    };

    setActionBarAbilities(testAbilities);
  }, []);

  // Handle ability drag start
  const handleAbilityDragStart = useCallback((e: React.DragEvent, ability: Ability) => {
    setDraggedAbility(ability);
    e.dataTransfer.effectAllowed = "move";
    e.dataTransfer.setData("text/plain", ability.id);
  }, []);

  // Handle ability drop onto action bar
  const handleAbilityDrop = useCallback(
    (e: React.DragEvent, slotIndex: number) => {
      e.preventDefault();

      if (draggedAbility) {
        // Update local state
        setActionBarAbilities((prev) => ({
          ...prev,
          [slotIndex]: draggedAbility.id,
        }));

        // Emit event to update the ability system
        emitEvent("ability.setForSlot", {
          slotIndex: slotIndex + 1, // Convert to 1-based indexing for ability system
          ability: draggedAbility,
        });

        setDraggedAbility(null);
      }
    },
    [draggedAbility, emitEvent]
  );

  // Get mock abilities for a weapon type
  const getMockAbilities = useCallback((weaponType: string): Ability[] => {
    const abilityMapping: Record<string, string[]> = {
      melee: ["swordSlash", "whirlwind", "bash"],
      magic: ["fireball", "energyWave", "fireWall"],
      archery: ["powerShot", "focus", "rainOfArrows"],
    };

    const abilityIds = abilityMapping[weaponType] || [];
    return abilityIds
      .map((id) => AbilityDictionary.getAbility(id))
      .filter((ability) => ability !== null) as Ability[];
  }, []);

  // Get weapon type from equipment
  const getWeaponType = useCallback((): string => {
    const equipment = playerCharacter.equipment;

    if (equipment.weapon) {
      // Use templateId instead of id
      if (equipment.weapon.templateId) {
        const weaponType = ItemDictionary.getWeaponType(equipment.weapon.templateId);
        if (weaponType) return weaponType;
      }
    }

    return "none";
  }, [playerCharacter.equipment]);

  // Get bonus abilities from equipment
  const getBonusAbilities = useCallback((): Record<string, Ability[]> => {
    const bonusAbilities: Record<string, Ability[]> = {};
    const equipment = playerCharacter.equipment;

    // Check equipment for items with bonusSkills
    Object.entries(equipment).forEach(([slot, itemInstance]) => {
      if (!itemInstance) return;

      // Get the template data using templateId
      const itemData = ItemDictionary.getItem(itemInstance.templateId);

      // Check for bonusSkills on the template data
      if (itemData && itemData.bonusSkills && Array.isArray(itemData.bonusSkills)) {
        // For each bonus skill, try to get the ability
        itemData.bonusSkills.forEach((abilityId: string) => {
          const ability = AbilityDictionary.getAbility(abilityId);
          if (ability) {
            // Use the item name as the key
            const itemName = itemData.name || "Unknown Item";

            // Initialize array if it doesn't exist
            if (!bonusAbilities[itemName]) {
              bonusAbilities[itemName] = [];
            }

            // Add the ability to the array
            bonusAbilities[itemName].push(ability);
          }
        });
      }
    });

    return bonusAbilities;
  }, [playerCharacter.equipment]);

  return {
    visible,
    toggleInterface,
    actionBarAbilities,
    draggedAbility,
    handleAbilityDragStart,
    handleAbilityDrop,
    getMockAbilities,
    getWeaponType,
    getBonusAbilities,
  };
}
