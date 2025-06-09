// src/services/AbilitySystem.ts
import { eventBus } from "../utils/EventBus";
import { AbilityDictionary } from "../services/AbilityDictionaryService";
import { abilityAnimationSystem } from "./AbilityAnimationSystem";
import { ItemDictionary } from "./ItemDictionaryService";
import { Ability, PlayerCharacterEquipment } from "@/types";
import { useGameStore } from "@/stores/gameStore";

class AbilitySystemService {
  private activeAbilities: Record<number, Ability> = {};
  private abilityCooldowns: Record<string, number> = {}; // Tracks end time of cooldowns
  private currentWeaponType: string | null = null;

  constructor() {
    // Subscribe to equipment change events
    eventBus.on("equipment.changed", this.handleEquipmentChanged.bind(this));
    eventBus.on("playerCharacter.skill.updated", this.handleSkillUpdate.bind(this));
    eventBus.on("ability.activate", this.handleAbilityActivation.bind(this));
    eventBus.on("ability.setForSlot", this.handleSetAbilityForSlot.bind(this));
  }

  /**
   * Event handler for equipment changes
   */
  handleEquipmentChanged(data: any): void {
    if (!data?.equipment) return;

    this.updateAbilitiesForEquipment(data.equipment);
  }

  /**
   * Event handler for skill updates
   */
  handleSkillUpdate(data: any): void {
    if (!data) return;

    // Refresh abilities to see if new ones are available due to skill level
    const playerCharacter = useGameStore.getState().playerCharacter;
    if (playerCharacter?.equipment) {
      this.updateAbilitiesForEquipment(playerCharacter.equipment);
    }
  }

  /**
   * Handle ability activation requests
   */
  handleAbilityActivation(data: any): void {
    if (!data || typeof data.slotIndex !== "number") return;

    this.activateAbility(data.slotIndex);
  }

  /**
   * Updates available abilities based on equipped items
   */
  updateAbilitiesForEquipment(equipment: PlayerCharacterEquipment): void {
    // Handle the case where equipment is null or undefined
    if (!equipment) {
      // Clear all active abilities
      this.activeAbilities = {};
      this.updateActionBar();
      this.currentWeaponType = null;
      return;
    }

    // Determine if user has any weapon equipped
    const hasWeaponEquipped = equipment && equipment.weapon && equipment.weapon.templateId;

    // Determine the current weapon type
    let weaponType = null;
    if (hasWeaponEquipped) {
      weaponType = equipment.weapon?.templateId
        ? ItemDictionary.getWeaponType(equipment.weapon.templateId)
        : null;
    }
    // Check if weapon type has changed
    const weaponTypeChanged =
      this.currentWeaponType !== null && this.currentWeaponType !== weaponType;

    // Update stored weapon type
    this.currentWeaponType = weaponType;

    // Create a map of default ability assignments for weapon abilities
    const defaultAbilities: Record<number, Ability> = {};

    // Get default abilities for the current weapon type
    if (weaponType === "melee") {
      this.getDefaultMeleeAbilities(defaultAbilities);
    } else if (weaponType === "magic") {
      this.getDefaultMagicAbilities(defaultAbilities);
    } else if (weaponType === "archery") {
      this.getDefaultArcheryAbilities(defaultAbilities);
    }

    // Get bonus abilities from equipped items
    const bonusAbilities = this.getBonusAbilitiesFromEquipment(equipment);

    // Track which abilities are from item bonuses so we don't remove them
    const bonusAbilityIds = bonusAbilities.map((ability) => ability.id);

    // Create a map of current abilities we want to keep
    const abilitiesToKeep: Record<number, Ability> = {};

    // Keep bonus abilities that are currently assigned to a slot
    Object.entries(this.activeAbilities).forEach(([slot, ability]) => {
      if (bonusAbilityIds.includes(ability.id)) {
        // This is a bonus ability, keep it regardless of weapon change
        abilitiesToKeep[parseInt(slot)] = ability;
      }
    });

    // If weapon type changed, reset weapon abilities but keep bonus abilities
    if (weaponTypeChanged) {
      // Reset active abilities but preserve bonus abilities
      this.activeAbilities = { ...abilitiesToKeep };

      // Add the default abilities for the new weapon type in empty slots
      for (const [slot, ability] of Object.entries(defaultAbilities)) {
        const slotNum = parseInt(slot);
        if (!this.activeAbilities[slotNum]) {
          this.activeAbilities[slotNum] = ability;
        }
      }
    } else {
      // Maintain existing assignments, update empty slots
      for (const [slot, ability] of Object.entries(defaultAbilities)) {
        const slotNum = parseInt(slot);
        if (
          !this.activeAbilities[slotNum] ||
          // Replace abilities if they're not bonus abilities
          (!bonusAbilityIds.includes(this.activeAbilities[slotNum].id) &&
            !this.activeAbilities[slotNum])
        ) {
          this.activeAbilities[slotNum] = ability;
        }
      }
    }

    // Update the action bar immediately
    this.updateActionBar();

    // If weapon type changed, notify the user
    if (weaponTypeChanged) {
      eventBus.emit("ui.message.show", `Abilities updated for ${weaponType} weapon`);
    }
  }

  /**
   * Gets bonus abilities from equipped items
   */
  private getBonusAbilitiesFromEquipment(equipment: PlayerCharacterEquipment): Ability[] {
    const bonusAbilities: Ability[] = [];

    // Check each equipment slot
    Object.values(equipment).forEach((itemInstance) => {
      if (!itemInstance) return;

      // Get template data to access bonusSkills
      const itemData = ItemDictionary.getItem(itemInstance.templateId);

      // Check for bonusSkills from the template data
      if (itemData && itemData.bonusSkills && Array.isArray(itemData.bonusSkills)) {
        itemData.bonusSkills.forEach((abilityId: string) => {
          const ability = AbilityDictionary.getAbility(abilityId);
          if (ability) {
            bonusAbilities.push(ability);
          }
        });
      }
    });

    return bonusAbilities;
  }

  /**
   * Gets default abilities for melee weapons
   */
  private getDefaultMeleeAbilities(abilityMap: Record<number, Ability>): void {
    // First ability is swordSlash
    const swordSlash = AbilityDictionary.getAbility("swordSlash");
    if (swordSlash) {
      abilityMap[1] = swordSlash;
    }

    // Second ability is whirlwind
    const whirlwind = AbilityDictionary.getAbility("whirlwind");
    if (whirlwind) {
      abilityMap[2] = whirlwind;
    }

    // Third ability is bash
    const bash = AbilityDictionary.getAbility("bash");
    if (bash) {
      abilityMap[3] = bash;
    }
  }

  /**
   * Gets default abilities for archery weapons
   */
  private getDefaultArcheryAbilities(abilityMap: Record<number, Ability>): void {
    // First ability is Power Shot
    const powerShot = AbilityDictionary.getAbility("powerShot");
    if (powerShot) {
      abilityMap[1] = powerShot;
    }

    // Second ability is focus
    const focus = AbilityDictionary.getAbility("focus");
    if (focus) {
      abilityMap[2] = focus;
    }

    // Third ability is Rain of Arrows
    const rainOfArrows = AbilityDictionary.getAbility("rainOfArrows");
    if (rainOfArrows) {
      abilityMap[3] = rainOfArrows;
    }
  }

  /**
   * Gets default abilities for magic weapons
   */
  private getDefaultMagicAbilities(abilityMap: Record<number, Ability>): void {
    // First ability is fireball
    const fireball = AbilityDictionary.getAbility("fireball");
    if (fireball) {
      abilityMap[1] = fireball;
    }

    // Second ability is Energy Wave
    const energyWave = AbilityDictionary.getAbility("energyWave");
    if (energyWave) {
      abilityMap[2] = energyWave;
    }

    // Third ability is Fire Wall
    const fireWall = AbilityDictionary.getAbility("fireWall");
    if (fireWall) {
      abilityMap[3] = fireWall;
    }
  }

  /**
   * Sets a specific ability for a specific action bar slot
   * @param slotIndex The slot index (1-3)
   * @param ability The ability to assign
   */
  setAbilityForSlot(slotIndex: number, ability: Ability): void {
    if (slotIndex >= 1 && slotIndex <= 3) {
      this.activeAbilities[slotIndex] = ability;
      this.updateActionBar();
    }
  }

  /**
   * Updates the action bar UI to show current abilities
   */
  updateActionBar(): void {
    // Emit updated abilities event for React components
    eventBus.emit("abilities.updated", { ...this.activeAbilities });

    // Update action slot icons
    for (let i = 1; i <= 3; i++) {
      const ability = this.activeAbilities[i];
      if (ability) {
        eventBus.emit("ability.activated", {
          slotIndex: i,
          abilityId: ability.id,
          iconPath: ability.icon,
        });
      }
    }
  }

  /**
   * Activate ability in a specific slot
   */
  activateAbility(index: number): void {
    const ability = this.activeAbilities[index];
    if (!ability) return;

    // Check if ability is on cooldown
    const now = Date.now();
    if (this.abilityCooldowns[ability.id] && this.abilityCooldowns[ability.id] > now) {
      // Calculate remaining cooldown time in seconds
      const remainingCooldown = Math.ceil((this.abilityCooldowns[ability.id] - now) / 1000);
      eventBus.emit(
        "ui.message.show",
        `${ability.name} is on cooldown for ${remainingCooldown} more seconds.`
      );
      return;
    }

    // Get the current weapon type for the skill progression event
    const equipment = useGameStore.getState().playerCharacter.equipment;
    // Fix: Get weapon type from ItemDictionary using templateId
    const weaponType = equipment.weapon?.templateId
      ? ItemDictionary.getWeaponType(equipment.weapon.templateId)
      : "melee"; // Default to melee

    // Play the ability animation
    abilityAnimationSystem.playAbilityAnimation(ability.id).then((success) => {
      if (success) {
        // Start cooldown
        this.abilityCooldowns[ability.id] = now + ability.cooldown * 1000;

        // Emit cooldown start event for UI
        eventBus.emit("ability.cooldown.start", {
          slotIndex: index,
          duration: ability.cooldown,
        });

        // Emit damage event for skill progression
        eventBus.emit("damage.dealt", {
          source: "ability",
          abilityId: ability.id,
          weaponType: weaponType,
          targetType: "monster",
          targetId: "unknown", // We don't know which monster was hit
          damage: ability.damage,
        });

        // Emit ability activated event
        eventBus.emit("ability.activated", {
          slotIndex: index,
          abilityId: ability.id,
        });
      }
    });
  }

  handleSetAbilityForSlot(data: any): void {
    if (!data || !data.slotIndex || !data.ability) return;

    // Set the ability for the slot
    this.setAbilityForSlot(data.slotIndex, data.ability);

    // Emit event to update UI components
    eventBus.emit("ability.activated", {
      slotIndex: data.slotIndex,
      abilityId: data.ability.id,
      iconPath: data.ability.icon,
    });
  }

  /**
   * Check if the system is active
   */
  isActive(): boolean {
    return true;
  }

  /**
   * Get current active abilities
   */
  getActiveAbilities(): Record<number, Ability> {
    return { ...this.activeAbilities };
  }

  /**
   * Get current weapon type
   */
  getCurrentWeaponType(): string | null {
    return this.currentWeaponType;
  }

  /**
   * Updates the system - called each frame
   */
  update(): void {
    // Update the animation system
    abilityAnimationSystem.update();

    // Check and clear expired cooldowns
    const now = Date.now();
    Object.keys(this.abilityCooldowns).forEach((abilityId) => {
      if (this.abilityCooldowns[abilityId] <= now) {
        delete this.abilityCooldowns[abilityId];
      }
    });
  }

  /**
   * Clean up resources
   */
  destroy(): void {
    // Remove event listeners
    eventBus.off("equipment.changed", this.handleEquipmentChanged);
    eventBus.off("playerCharacter.skill.updated", this.handleSkillUpdate);
    eventBus.off("ability.activate", this.handleAbilityActivation);
  }
}

// Create and export singleton instance
export const abilitySystem = new AbilitySystemService();
