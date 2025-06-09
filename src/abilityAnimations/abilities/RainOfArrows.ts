import { BaseStrategy } from "../BaseStrategy";
import { Monster } from "@/entities/Monster";
import { PlayerCharacter } from "@/entities/PlayerCharacter";
import { Ability } from "@/types";
import { eventBus } from "@/utils/EventBus";

export class RainOfArrowsAbility extends BaseStrategy {
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
      const effectDuration = config.effectDuration || 5000; // 5 seconds
      const debug = config.debug || false;
      const damage = ability.damage || 8;
      const damageInterval = config.damageInterval || 500; // Apply damage every 0.5 seconds
      const areaSize = config.areaSize || 128; // 4x4 tile area (32px per tile)

      // Get the mouse position in world coordinates - using inherited method
      const mouseWorldPosition = this.getMouseWorldPosition(scene);

      // Default to position in front of player if mouse position is unavailable
      let targetX: number;
      let targetY: number;

      if (!mouseWorldPosition) {
        // Use a position in front of the player as a fallback
        const facingAngle = this.getFacingAngle(playerCharacter);
        const defaultDistance = 128; // 4 tiles in front
        targetX = playerCharacter.x + Math.cos(facingAngle) * defaultDistance;
        targetY = playerCharacter.y + Math.sin(facingAngle) * defaultDistance;

        eventBus.emit("ui.message.show", "Using position in front of player");
      } else {
        targetX = mouseWorldPosition.x;
        targetY = mouseWorldPosition.y;
      }

      if (debug) {
        console.log(`Rain of Arrows cast at target position: (${targetX}, ${targetY})`);
      }

      // Check range
      const maxRange = ability.range || 256; // Maximum cast range
      const distanceToTarget = Phaser.Math.Distance.Between(
        playerCharacter.x,
        playerCharacter.y,
        targetX,
        targetY
      );

      if (distanceToTarget > maxRange) {
        // Target is too far away
        eventBus.emit("ui.message.show", "Target is out of range");
        return Promise.resolve();
      }

      // Define the area as a 4x4 grid of tiles
      const tilePositions = this.generateAreaTiles(targetX, targetY, 4, 4);

      // Create the visual effect
      this.createRainOfArrowsEffect(
        scene,
        tilePositions,
        targetX,
        targetY,
        areaSize,
        effectDuration,
        config,
        gameObjects
      );

      // Create debug visualization if requested
      if (debug) {
        const debugGraphics = this.createDebugVisualization(scene, tilePositions);
        gameObjects.push(debugGraphics);
      }

      // Store active animation objects
      activeAnimations.set(ability.id, gameObjects);

      // Track affected monsters to avoid double-counting in console debug messages
      const affectedMonsters = new Set<Monster>();

      // Apply initial damage after a short delay
      scene.time.delayedCall(300, () => {
        const initialHitCount = this.applyDamageToMonstersInTiles(
          scene,
          tilePositions,
          damage,
          debug
        );

        if (debug) {
          console.log(`Rain of Arrows initial hit: ${initialHitCount} monsters`);
        }
      });

      // Set up recurring damage timer
      const damageTimerEvent = scene.time.addEvent({
        delay: damageInterval,
        callback: () => {
          const hitCount = this.applyDamageToMonstersInTiles(scene, tilePositions, damage, debug);

          if (debug && hitCount > 0) {
            console.log(`Rain of Arrows periodic damage: ${hitCount} monsters`);
          }
        },
        callbackScope: this,
        loop: true,
      });

      // Set up cleanup timer
      scene.time.delayedCall(effectDuration, () => {
        // Stop the damage timer
        damageTimerEvent.remove();

        // Clean up all game objects
        gameObjects.forEach((obj) => {
          if (obj.active) obj.destroy();
        });
        activeAnimations.delete(ability.id);

        if (debug) {
          console.log("Rain of Arrows effect ended");
        }
      });

      // Return a promise that resolves when the ability is successfully cast
      // We don't wait for the full duration since it's a persistent effect
      return Promise.resolve();
    } catch (error) {
      console.error("Error in RainOfArrowsAbility.play:", error);
      return Promise.resolve();
    }
  }

  /**
   * Generates an array of tile positions for the area of effect
   */
  private generateAreaTiles(
    centerX: number,
    centerY: number,
    widthInTiles: number,
    heightInTiles: number
  ): { x: number; y: number }[] {
    try {
      const tilePositions: { x: number; y: number }[] = [];

      // Calculate top-left corner of the area
      const startTileX = Math.floor(centerX / this.TILE_SIZE) - Math.floor(widthInTiles / 2);
      const startTileY = Math.floor(centerY / this.TILE_SIZE) - Math.floor(heightInTiles / 2);

      // Generate all tile positions in the area
      for (let y = 0; y < heightInTiles; y++) {
        for (let x = 0; x < widthInTiles; x++) {
          const tileX = startTileX + x;
          const tileY = startTileY + y;

          // Convert to world coordinates (center of the tile)
          const worldX = tileX * this.TILE_SIZE + this.TILE_SIZE / 2;
          const worldY = tileY * this.TILE_SIZE + this.TILE_SIZE / 2;

          tilePositions.push({ x: worldX, y: worldY });
        }
      }

      return tilePositions;
    } catch (error) {
      console.error("Error in RainOfArrowsAbility.generateAreaTiles:", error);
      // Return a fallback value of a 2x2 grid around the center
      return [
        { x: centerX - this.TILE_SIZE, y: centerY - this.TILE_SIZE },
        { x: centerX + this.TILE_SIZE, y: centerY - this.TILE_SIZE },
        { x: centerX - this.TILE_SIZE, y: centerY + this.TILE_SIZE },
        { x: centerX + this.TILE_SIZE, y: centerY + this.TILE_SIZE },
        { x: centerX, y: centerY },
      ];
    }
  }

  /**
   * Creates the visual effects for the Rain of Arrows ability
   */
  private createRainOfArrowsEffect(
    scene: Phaser.Scene,
    tilePositions: { x: number; y: number }[],
    centerX: number,
    centerY: number,
    areaSize: number,
    duration: number,
    config: Record<string, any>,
    gameObjects: Phaser.GameObjects.GameObject[]
  ): void {
    try {
      // Create area indicator
      const areaIndicator = scene.add.rectangle(
        centerX,
        centerY,
        areaSize,
        areaSize,
        0xdddddd,
        0.2
      );
      areaIndicator.setStrokeStyle(2, 0xdddddd, 0.5);
      areaIndicator.setDepth(4);
      gameObjects.push(areaIndicator);

      // Create initial arrow barrage effect
      this.createInitialBarrage(scene, centerX, centerY, areaSize, gameObjects);

      // Create persistent arrow effect
      this.createPersistentArrowEffect(scene, tilePositions, duration, gameObjects);
    } catch (error) {
      console.error("Error in RainOfArrowsAbility.createRainOfArrowsEffect:", error);
    }
  }

  private createInitialBarrage(
    scene: Phaser.Scene,
    centerX: number,
    centerY: number,
    areaSize: number,
    gameObjects: Phaser.GameObjects.GameObject[]
  ): void {
    try {
      // Add a dramatic area targeting effect first
      const targetingCircle = scene.add.circle(centerX, centerY, areaSize / 2, 0xdddddd, 0);
      targetingCircle.setStrokeStyle(2, 0xffffff, 1);
      targetingCircle.setDepth(5);
      gameObjects.push(targetingCircle);

      // Animate the targeting circle
      scene.tweens.add({
        targets: targetingCircle,
        scale: { from: 0.8, to: 1 },
        alpha: { from: 0.8, to: 0.2 },
        duration: 500,
        ease: "Sine.Out",
        onComplete: () => {
          // Add a flash when targeting completes
          const flash = scene.add.circle(centerX, centerY, areaSize / 2, 0xffffff, 0.4);
          flash.setDepth(6);
          gameObjects.push(flash);

          scene.tweens.add({
            targets: flash,
            scale: { from: 1, to: 1.2 },
            alpha: 0,
            duration: 300,
            ease: "Cubic.Out",
          });

          // Add crosshairs to show precision
          const crosshair = scene.add.graphics();
          crosshair.lineStyle(1, 0xffffff, 0.7);

          // Draw crosshair lines
          const size = areaSize * 0.6;
          crosshair.beginPath();
          crosshair.moveTo(centerX - size / 2, centerY);
          crosshair.lineTo(centerX + size / 2, centerY);
          crosshair.moveTo(centerX, centerY - size / 2);
          crosshair.lineTo(centerX, centerY + size / 2);
          crosshair.strokePath();
          crosshair.setDepth(6);
          gameObjects.push(crosshair);

          // Fade out crosshair gradually
          scene.tweens.add({
            targets: crosshair,
            alpha: 0,
            duration: 1000,
            ease: "Linear",
          });
        },
      });

      // Number of arrows in the initial barrage
      const arrowCount = 30;
      const halfSize = areaSize / 2;

      // Add a subtle camera shake
      scene.cameras.main.shake(600, 0.003);

      // Create arrow rain particles with staggered timing
      for (let i = 0; i < arrowCount; i++) {
        // Random position within area - circular distribution
        const angle = Math.random() * Math.PI * 2;
        const distance = Math.random() * halfSize * 0.9;
        const offsetX = Math.cos(angle) * distance;
        const offsetY = Math.sin(angle) * distance;

        // Start position (above the target area, with some horizontal variation)
        const startX = centerX + offsetX * 0.3;
        const startY = centerY + offsetY - 300 - Math.random() * 100;

        // End position (on the ground)
        const endX = centerX + offsetX;
        const endY = centerY + offsetY;

        // Random delay for each arrow
        const delay = 200 + Math.random() * 600;

        // Create an arrow with better visuals
        scene.time.delayedCall(delay, () => {
          // Create the arrow container
          const arrowContainer = scene.add.container(startX, startY);
          arrowContainer.setDepth(7);
          gameObjects.push(arrowContainer);

          // Create arrow shaft
          const shaft = scene.add.rectangle(0, 0, 2, 12, 0xbbbbbb, 1);

          // Create arrow head (triangle)
          const head = scene.add.triangle(
            0,
            -7, // position
            -2,
            0, // point 1
            0,
            -4, // point 2
            2,
            0, // point 3
            0xdddddd,
            1
          );

          // Create arrow fletching
          const fletching1 = scene.add.triangle(
            -2,
            4, // position
            0,
            0, // point 1
            -3,
            4, // point 2
            0,
            5, // point 3
            0xdddddd,
            0.9
          );

          const fletching2 = scene.add.triangle(
            2,
            4, // position
            0,
            0, // point 1
            3,
            4, // point 2
            0,
            5, // point 3
            0xdddddd,
            0.9
          );

          // Add all parts to the container
          arrowContainer.add([shaft, head, fletching1, fletching2]);

          // Set angle to point downward
          const arrowAngle = 90 + (Math.random() * 20 - 10);
          arrowContainer.setAngle(arrowAngle);

          // Create shadow that follows the arrow
          const shadow = scene.add.circle(endX, endY, 3, 0x000000, 0.3);
          shadow.setDepth(3);
          gameObjects.push(shadow);

          // Scale the shadow based on arrow height
          scene.tweens.add({
            targets: shadow,
            scale: { from: 0.2, to: 1 },
            alpha: { from: 0, to: 0.3 },
            duration: 300,
          });

          // Animate arrow falling with realism
          scene.tweens.add({
            targets: arrowContainer,
            x: endX,
            y: endY,
            duration: 300 + Math.random() * 100,
            ease: "Cubic.In",
            onComplete: () => {
              // Add impact effect
              this.createArrowImpact(scene, endX, endY, gameObjects);

              // Fade out shadow
              scene.tweens.add({
                targets: shadow,
                alpha: 0,
                duration: 200,
              });

              // Leave the arrow in the ground
              scene.tweens.add({
                targets: arrowContainer,
                y: endY - 5, // Stick up slightly from the ground
                delay: 1000 + Math.random() * 1000,
                duration: 500,
                ease: "Bounce.Out",
                onComplete: () => {
                  scene.tweens.add({
                    targets: arrowContainer,
                    alpha: 0,
                    duration: 500,
                    ease: "Sine.In",
                  });
                },
              });
            },
          });
        });
      }
    } catch (error) {
      console.error("Error in RainOfArrowsAbility.createInitialBarrage:", error);
    }
  }

  // Add a new method for arrow impact effects
  private createArrowImpact(
    scene: Phaser.Scene,
    x: number,
    y: number,
    gameObjects: Phaser.GameObjects.GameObject[]
  ): void {
    try {
      // Create impact flash
      const impact = scene.add.circle(x, y, 4, 0xffffff, 0.7);
      impact.setDepth(5);
      gameObjects.push(impact);

      // Animate impact
      scene.tweens.add({
        targets: impact,
        scale: { from: 0.7, to: 1.3 },
        alpha: 0,
        duration: 200,
        ease: "Quad.Out",
      });

      // Create dust particles
      for (let i = 0; i < 5; i++) {
        const angle = Math.random() * Math.PI * 2;
        const distance = 3 + Math.random() * 6;
        const dustX = x + Math.cos(angle) * distance;
        const dustY = y + Math.sin(angle) * distance;

        const dust = scene.add.circle(dustX, dustY, 1 + Math.random() * 2, 0xcccccc, 0.6);
        dust.setDepth(4);
        gameObjects.push(dust);

        // Animate dust particle
        scene.tweens.add({
          targets: dust,
          x: dustX + Math.cos(angle) * distance * 0.7,
          y: dustY + Math.sin(angle) * distance * 0.7 - 2, // Slight upward movement
          alpha: 0,
          scale: { from: 1, to: 1.5 },
          duration: 300 + Math.random() * 200,
          ease: "Quad.Out",
        });
      }
    } catch (error) {
      console.error("Error in RainOfArrowsAbility.createArrowImpact:", error);
    }
  }

  /**
   * Creates the persistent arrow effect that continues throughout the ability duration
   */
  private createPersistentArrowEffect(
    scene: Phaser.Scene,
    tilePositions: { x: number; y: number }[],
    duration: number,
    gameObjects: Phaser.GameObjects.GameObject[]
  ): void {
    try {
      // Create a container for all persistent effect elements
      const container = scene.add.container(0, 0);
      container.setDepth(5);
      gameObjects.push(container);

      // Create a subtle glow effect for each tile
      tilePositions.forEach((pos) => {
        const glow = scene.add.rectangle(
          pos.x,
          pos.y,
          this.TILE_SIZE - 4,
          this.TILE_SIZE - 4,
          0xeeeeee,
          0.15
        );
        container.add(glow);

        // Animate the glow pulsing
        scene.tweens.add({
          targets: glow,
          alpha: 0.05,
          yoyo: true,
          repeat: -1,
          duration: 1000 + Math.random() * 500,
          ease: "Sine.easeInOut",
        });

        // Add some arrows sticking out of the ground
        this.addGroundArrows(scene, pos.x, pos.y, container);
      });

      // Periodic arrow rain
      const arrowRainEvent = scene.time.addEvent({
        delay: 1500, // Every 1.5 seconds
        callback: () => {
          // Choose a random position from the affected tiles
          const randomIndex = Math.floor(Math.random() * tilePositions.length);
          const pos = tilePositions[randomIndex];

          // Create a small batch of arrows
          this.createSmallArrowBatch(scene, pos.x, pos.y, 5, container);
        },
        callbackScope: this,
        loop: true,
      });

      // Store the event on the container for cleanup
      (container as any).arrowRainEvent = arrowRainEvent;

      // Stop the event when the ability ends
      scene.time.delayedCall(duration - 100, () => {
        if (arrowRainEvent && arrowRainEvent.remove) {
          arrowRainEvent.remove();
        }
      });

      // Fade out the effect at the end
      scene.tweens.add({
        targets: container,
        alpha: 0,
        delay: duration - 500,
        duration: 500,
        ease: "Sine.easeIn",
      });
    } catch (error) {
      console.error("Error in RainOfArrowsAbility.createPersistentArrowEffect:", error);
    }
  }

  /**
   * Adds arrows sticking out of the ground in a tile
   */
  private addGroundArrows(
    scene: Phaser.Scene,
    x: number,
    y: number,
    container: Phaser.GameObjects.Container
  ): void {
    try {
      // Number of arrows per tile
      const arrowCount = 2 + Math.floor(Math.random() * 2);

      for (let i = 0; i < arrowCount; i++) {
        // Random position within tile
        const offsetX = (Math.random() * this.TILE_SIZE - this.TILE_SIZE / 2) * 0.8;
        const offsetY = (Math.random() * this.TILE_SIZE - this.TILE_SIZE / 2) * 0.8;

        // Create arrow
        const arrow = scene.add.rectangle(x + offsetX, y + offsetY, 4, 10, 0xdddddd, 0.7);

        // Random angle (slight variations)
        arrow.setAngle(80 + (Math.random() * 20 - 10));

        container.add(arrow);
      }
    } catch (error) {
      console.error("Error in RainOfArrowsAbility.addGroundArrows:", error);
    }
  }

  /**
   * Creates a small batch of arrows falling in a specific area
   */
  private createSmallArrowBatch(
    scene: Phaser.Scene,
    x: number,
    y: number,
    count: number,
    container: Phaser.GameObjects.Container
  ): void {
    try {
      for (let i = 0; i < count; i++) {
        // Random position within the tile
        const offsetX = (Math.random() * this.TILE_SIZE - this.TILE_SIZE / 2) * 0.8;
        const offsetY = (Math.random() * this.TILE_SIZE - this.TILE_SIZE / 2) * 0.8;

        // Start position (above the target)
        const startX = x + offsetX;
        const startY = y + offsetY - 100 - Math.random() * 50;

        // End position (on the ground)
        const endX = x + offsetX;
        const endY = y + offsetY;

        // Create arrow
        const arrow = scene.add.rectangle(startX, startY, 4, 10, 0xdddddd, 0.8);
        arrow.setAngle(75 + (Math.random() * 30 - 15));
        container.add(arrow);

        // Animate arrow falling
        scene.tweens.add({
          targets: arrow,
          x: endX,
          y: endY,
          duration: 200 + Math.random() * 100,
          ease: "Cubic.easeIn",
          onComplete: () => {
            // Create small impact effect
            const impact = scene.add.circle(endX, endY, 2, 0xffffff, 0.7);
            container.add(impact);

            // Fade out impact
            scene.tweens.add({
              targets: impact,
              alpha: 0,
              scale: 1.3,
              duration: 200,
              ease: "Sine.easeOut",
              onComplete: () => {
                impact.destroy();
              },
            });

            // Leave the arrow in the ground for a while
            scene.tweens.add({
              targets: arrow,
              alpha: 0,
              delay: 1000 + Math.random() * 500,
              duration: 300,
              onComplete: () => {
                arrow.destroy();
              },
            });
          },
        });
      }
    } catch (error) {
      console.error("Error in RainOfArrowsAbility.createSmallArrowBatch:", error);
    }
  }

  getObjectTypesForPositioning(): string[] {
    return []; // No objects need repositioning
  }
}
