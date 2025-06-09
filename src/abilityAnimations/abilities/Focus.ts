import { BaseStrategy } from "../BaseStrategy";
import { Ability } from "@/types";
import { PlayerCharacter } from "@/entities/PlayerCharacter";
import { eventBus } from "../../utils/EventBus";

export class FocusAbility extends BaseStrategy {
  // Store the original attack cooldown to restore it later
  private originalAttackCooldown: number | null = null;

  async play(
    scene: Phaser.Scene,
    playerCharacter: PlayerCharacter,
    ability: Ability,
    x: number,
    y: number,
    activeAnimations: Map<string, Phaser.GameObjects.GameObject[]>
  ): Promise<void> {
    if (!scene || !playerCharacter) return;

    try {
      const gameObjects: Phaser.GameObjects.GameObject[] = [];
      const config = ability.animationConfig || {};
      const effectDuration = config.effectDuration || 10000; // 10 seconds
      const buffMultiplier = config.buffMultiplier || 1.5; // 50% attack speed increase
      const debug = config.debug || false;

      if (debug) {
        console.log(
          `Focus ability activated - Duration: ${effectDuration}ms, Multiplier: ${buffMultiplier}x`
        );
      }

      // Create visual effects
      this.createBuffEffects(scene, playerCharacter, effectDuration, config, gameObjects);

      // Apply the buff effect
      this.applyBuff(playerCharacter, buffMultiplier);

      // Create an easily visible visual indicator that remains during the buff
      const buffIndicator = this.createBuffIndicator(scene, playerCharacter);
      gameObjects.push(buffIndicator);

      // Store active animation objects
      activeAnimations.set(ability.id, gameObjects);

      // Show a message to the player
      eventBus.emit("ui.message.show", "Focus activated: Attack speed increased for 10 seconds!");

      // Set up a timer to remove the buff after duration - using BaseStrategy's cleanup method
      this.setupCleanupTimer(
        scene,
        effectDuration,
        gameObjects,
        activeAnimations,
        ability.id,
        () => {
          // Remove the buff
          this.removeBuff(playerCharacter, buffMultiplier);

          // Show end message
          eventBus.emit("ui.message.show", "Focus effect ended.");

          if (debug) {
            console.log("Focus buff removed");
          }
        }
      );

      // Return a promise that resolves immediately since we've set up the duration timer
      return Promise.resolve();
    } catch (error) {
      console.error("Error in FocusAbility.play:", error);
      return Promise.resolve();
    }
  }

  /**
   * Creates visual effects for the buff
   */
  protected createBuffEffects(
    scene: Phaser.Scene,
    playerCharacter: PlayerCharacter,
    duration: number,
    config: Record<string, any>,
    gameObjects: Phaser.GameObjects.GameObject[]
  ): void {
    try {
      // Get config values or use defaults
      const particleColors = config.particleColors || [0xffdd00, 0xffaa00]; // Gold/yellow for buffs
      const particleCount = 20;

      // Create a pulsing circle effect
      const circle = scene.add.circle(
        playerCharacter.x,
        playerCharacter.y,
        32,
        particleColors[0],
        0.3
      );
      circle.setDepth(5);
      gameObjects.push(circle);

      // Animate the circle expanding
      scene.tweens.add({
        targets: circle,
        scale: { from: 0.5, to: 2 },
        alpha: { from: 0.3, to: 0 },
        duration: 800,
        ease: "Sine.Out",
        onComplete: () => {
          circle.destroy();
        },
      });

      // Create particles that spiral around the player
      for (let i = 0; i < particleCount; i++) {
        const angle = (i / particleCount) * Math.PI * 2;
        const distance = 20 + Math.random() * 15;
        const particleX = playerCharacter.x + Math.cos(angle) * distance;
        const particleY = playerCharacter.y + Math.sin(angle) * distance;

        // Choose random color from the particle colors
        const color = particleColors[Math.floor(Math.random() * particleColors.length)];

        const particle = scene.add.circle(particleX, particleY, 3, color, 0.8);
        particle.setDepth(6);
        gameObjects.push(particle);

        // Animate the particle to spiral inward
        scene.tweens.add({
          targets: particle,
          x: playerCharacter.x,
          y: playerCharacter.y,
          scale: { from: 1, to: 0.2 },
          alpha: { from: 0.8, to: 0 },
          duration: 600 + Math.random() * 400,
          ease: "Sine.In",
          onUpdate: (tween) => {
            // Make particle spiral as it moves inward
            const progress = tween.getValue();
            const newAngle = angle + progress * Math.PI * 3; // Add rotation
            const newDistance = distance * (1 - progress); // Decrease distance
            particle.x = playerCharacter.x + Math.cos(newAngle) * newDistance;
            particle.y = playerCharacter.y + Math.sin(newAngle) * newDistance;
          },
          onComplete: () => {
            particle.destroy();
          },
        });
      }
    } catch (error) {
      console.error("Error in FocusAbility.createBuffEffects:", error);
    }
  }

  /**
   * Creates a buff indicator that follows the player
   */
  protected createBuffIndicator(
    scene: Phaser.Scene,
    playerCharacter: PlayerCharacter
  ): Phaser.GameObjects.Container {
    try {
      // Create a container for the indicator
      const container = scene.add.container(playerCharacter.x, playerCharacter.y);
      container.setDepth(10);

      // Create orbiting particles
      const particleCount = 3;
      const orbitRadius = 20;
      const particles: Phaser.GameObjects.GameObject[] = [];

      for (let i = 0; i < particleCount; i++) {
        const angle = (i / particleCount) * Math.PI * 2;
        const particleX = Math.cos(angle) * orbitRadius;
        const particleY = Math.sin(angle) * orbitRadius;

        const particle = scene.add.circle(particleX, particleY, 4, 0xffdd00, 0.8);
        container.add(particle);
        particles.push(particle);
      }

      // Create rotation animation
      scene.tweens.add({
        targets: container,
        angle: 360,
        duration: 3000,
        repeat: -1,
        ease: "Linear",
      });

      // Add update function to follow player
      const updateEvent = scene.time.addEvent({
        delay: 16,
        callback: () => {
          if (playerCharacter.active && container.active) {
            container.x = playerCharacter.x;
            container.y = playerCharacter.y - 20; // Position above player
          } else {
            updateEvent.remove();
          }
        },
        callbackScope: this,
        loop: true,
      });

      // Store the update event on the container for cleanup
      (container as any).updateEvent = updateEvent;

      return container;
    } catch (error) {
      console.error("Error in FocusAbility.createBuffIndicator:", error);
      // Return a minimal container as fallback
      return scene.add.container(playerCharacter.x, playerCharacter.y);
    }
  }

  /**
   * Applies the buff effect to the player
   */
  protected applyBuff(playerCharacter: PlayerCharacter, buffMultiplier: number): void {
    try {
      // Emit an event to notify other systems about the attack speed change
      eventBus.emit("playerCharacter.attackSpeed.changed", buffMultiplier);

      // Directly update the AutoAttackSystem cooldown if available
      const autoAttackSystem = (window as any).autoAttackSystem;
      if (autoAttackSystem && autoAttackSystem.attackCooldown) {
        // Store the original cooldown value to restore it later
        this.originalAttackCooldown = autoAttackSystem.attackCooldown;
        // Apply the buff by reducing the cooldown
        autoAttackSystem.attackCooldown /= buffMultiplier;
      }

      // Store the buff on playerCharacter for other systems to check
      (playerCharacter as any).hasFocusBuff = true;
    } catch (error) {
      console.error("Error in FocusAbility.applyBuff:", error);
    }
  }

  /**
   * Removes the buff effect from the player
   */
  protected removeBuff(playerCharacter: PlayerCharacter, buffMultiplier: number): void {
    try {
      // Emit an event to notify other systems that the buff has ended
      eventBus.emit("playerCharacter.attackSpeed.changed", 1);

      // Reset the AutoAttackSystem cooldown if available
      const autoAttackSystem = (window as any).autoAttackSystem;
      if (autoAttackSystem && this.originalAttackCooldown !== null) {
        // Restore the original cooldown value
        autoAttackSystem.attackCooldown = this.originalAttackCooldown;
        this.originalAttackCooldown = null;
      }

      // Remove the buff flag from playerCharacter
      (playerCharacter as any).hasFocusBuff = false;
    } catch (error) {
      console.error("Error in FocusAbility.removeBuff:", error);
    }
  }

  getObjectTypesForPositioning(): string[] {
    return ["container"]; // Container needs to follow player
  }
}
