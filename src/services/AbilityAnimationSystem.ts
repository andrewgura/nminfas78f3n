// src/services/AbilityAnimationSystem.ts
import { eventBus } from "../utils/EventBus";
import { AbilityRegistry } from "../abilityAnimations/AbilityRegistry";
import { AbilityDictionary } from "../services/AbilityDictionaryService";
import { Ability } from "@/types";
import { PhaserSceneManager } from "./PhaserSceneManager";
import { GameScene } from "@/scenes/GameScene";

export class AbilityAnimationSystem {
  private activeAnimations: Map<string, Phaser.GameObjects.GameObject[]> = new Map();
  private animationsInProgress: Set<string> = new Set();
  private currentScene: Phaser.Scene | null = null;

  constructor() {
    // Initialize the ability registry
    AbilityRegistry.initialize();

    // Listen for scene changes to track the current scene more reliably
    eventBus.on("scene.switched", this.handleSceneChanged.bind(this));

    // Also listen for when game scene becomes ready
    eventBus.on("game.scene.ready", this.handleGameSceneReady.bind(this));
  }

  /**
   * Update our scene reference when the scene changes
   */
  private handleSceneChanged(scene: Phaser.Scene) {
    this.currentScene = scene;
    // Clean up animations when scene changes
    this.cleanupAnimations();
  }

  /**
   * Update our scene reference when game scene is ready
   */
  private handleGameSceneReady() {
    // Get the game scene directly to ensure we have a reference
    this.currentScene = PhaserSceneManager.getScene<GameScene>("game");
  }

  /**
   * Get the current active scene with fallback methods
   */
  private getActiveScene(): Phaser.Scene | null {
    // First try our cached scene reference
    if (this.currentScene && this.currentScene.scene.isActive()) {
      return this.currentScene;
    }

    // Next try the scene manager's current scene
    const managerScene = PhaserSceneManager.getCurrentScene();
    if (managerScene && managerScene.scene.isActive()) {
      this.currentScene = managerScene; // Update our reference
      return managerScene;
    }

    // Finally try to get the game scene specifically
    const gameScene = PhaserSceneManager.getScene<GameScene>("game");
    if (gameScene && gameScene.scene.isActive()) {
      this.currentScene = gameScene; // Update our reference
      return gameScene;
    }

    return null;
  }

  /**
   * Plays an ability animation based on the ability's animationType
   * @param abilityId The ID of the ability to play
   * @returns Promise that resolves when the animation is complete
   */
  async playAbilityAnimation(abilityId: string): Promise<boolean> {
    // Check if this animation is already in progress
    if (this.animationsInProgress.has(abilityId)) {
      return false;
    }
    this.animationsInProgress.add(abilityId);

    try {
      // Get the ability details first
      const ability = AbilityDictionary.getAbility(abilityId);
      if (!ability) {
        console.warn(`Unknown ability: ${abilityId}`);
        this.animationsInProgress.delete(abilityId);
        return false;
      }

      // Try to get the current scene with multiple methods and retry mechanism
      let scene = this.getActiveScene();
      let retryCount = 0;
      const maxRetries = 5; // Increase max retries
      const retryDelay = 100; // ms between retries

      while (!scene && retryCount < maxRetries) {
        // Wait a bit and retry
        await new Promise((resolve) => setTimeout(resolve, retryDelay));
        scene = this.getActiveScene();
        retryCount++;

        // On last retry, try one more desperate approach - get the game instance
        // and try to access the scene directly
        if (!scene && retryCount === maxRetries - 1) {
          const game = PhaserSceneManager.getGame();
          if (game) {
            // Try to find an active scene from the game instance
            const activeScenes = game.scene.scenes.filter((s) => s.scene.isActive());
            if (activeScenes.length > 0) {
              scene = activeScenes[0];
              this.currentScene = scene; // Update reference
            }
          }
        }
      }

      if (!scene) {
        console.warn(
          `Cannot play ability animation for ${ability.name}: scene not available after ${maxRetries} retries`
        );
        eventBus.emit("ui.message.show", `Unable to use ${ability.name} right now`);
        this.animationsInProgress.delete(abilityId);
        return false;
      }

      // Now we have a scene, get the player character
      const playerCharacter = (scene as any).playerCharacter;
      if (!playerCharacter) {
        console.warn(
          `Cannot play ability animation for ${ability.name}: player character not available`
        );
        eventBus.emit("ui.message.show", `Unable to use ${ability.name} right now`);
        this.animationsInProgress.delete(abilityId);
        return false;
      }

      // Get player position
      const { x, y } = playerCharacter;

      let strategy = null;

      // First, check if there's a direct match with the ability ID
      if (AbilityRegistry.hasStrategy(abilityId)) {
        strategy = AbilityRegistry.getStrategy(abilityId);
      }
      // Otherwise, use the animation type
      else if (ability.animationType && AbilityRegistry.hasStrategy(ability.animationType)) {
        strategy = AbilityRegistry.getStrategy(ability.animationType);
      } else {
        console.warn(`No animation strategy found for ability: ${ability.name} (${abilityId})`);
        this.animationsInProgress.delete(abilityId);
        return false;
      }

      // Play the animation
      if (strategy) {
        await strategy.play(scene, playerCharacter, ability, x, y, this.activeAnimations);

        // Display a message that the ability was used
        eventBus.emit("ui.message.show", `Used ${ability.name}`);

        this.animationsInProgress.delete(abilityId);
        return true;
      } else {
        console.error(`Strategy not found or invalid for ability: ${abilityId}`);
        this.animationsInProgress.delete(abilityId);
        return false;
      }
    } catch (error) {
      console.error(`Error playing animation for ${abilityId}:`, error);
      this.animationsInProgress.delete(abilityId);
      return false;
    }
  }

  /**
   * Updates ability animations to follow the player character
   */
  update(): void {
    const scene = this.getActiveScene();
    if (!scene) return;

    const playerCharacter = (scene as any).playerCharacter;
    if (!playerCharacter) return;

    // Update animation positions if player moves
    this.activeAnimations.forEach((objects, abilityId) => {
      const ability = AbilityDictionary.getAbility(abilityId);
      if (!ability) return;

      // Get the animation type
      const animationType = ability.animationType;

      // Get the strategy for this ability or animation type
      let strategy = null;
      if (AbilityRegistry.hasStrategy(abilityId)) {
        strategy = AbilityRegistry.getStrategy(abilityId);
      } else if (animationType && AbilityRegistry.hasStrategy(animationType)) {
        strategy = AbilityRegistry.getStrategy(animationType);
      }

      if (!strategy) return;

      // Get the object types that should follow player for this strategy
      const objectTypes = strategy.getObjectTypesForPositioning();
      if (objectTypes.length === 0) return;

      // Update positions of matching object types
      objects.forEach((obj) => {
        if (objectTypes.includes(obj.type)) {
          // Type assertion to get setPosition method
          (obj as unknown as { setPosition: (x: number, y: number) => void }).setPosition(
            playerCharacter.x,
            playerCharacter.y
          );
        }
      });
    });
  }

  /**
   * Cleans up all active animations
   */
  cleanupAnimations(): void {
    this.activeAnimations.forEach((objects) => {
      objects.forEach((obj) => {
        if (obj.active) {
          obj.destroy();
        }
      });
    });

    this.activeAnimations.clear();
  }

  /**
   * Clean up resources when component is destroyed
   */
  destroy(): void {
    this.cleanupAnimations();
    this.animationsInProgress.clear();

    // Remove event listeners
    eventBus.off("scene.switched", this.handleSceneChanged);
    eventBus.off("game.scene.ready", this.handleGameSceneReady);
  }
}

// Export singleton instance
export const abilityAnimationSystem = new AbilityAnimationSystem();
