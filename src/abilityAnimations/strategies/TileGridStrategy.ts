import { AnimationStrategy } from "../AnimationStrategy";
import { PlayerCharacter } from "@/entities/PlayerCharacter";
import { Ability } from "@/types";

export class TileGridStrategy implements AnimationStrategy {
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
      const effectDuration = config.effectDuration || 800;
      const tileSize = 32;

      // Get affected tiles in two layers
      const innerTiles = this.getInnerTiles(x, y, tileSize);
      const outerTiles = this.getOuterTiles(x, y, tileSize);

      // Create animations
      await this.createTileEffects(
        scene,
        [...innerTiles, ...outerTiles],
        gameObjects,
        effectDuration / 2,
        0
      );

      // Store active animation objects
      activeAnimations.set(ability.id, gameObjects);

      // Cleanup timer
      scene.time.delayedCall(effectDuration, () => {
        gameObjects.forEach((obj) => obj.destroy());
        activeAnimations.delete(ability.id);
      });

      return new Promise((resolve) => {
        scene.time.delayedCall(effectDuration, resolve);
      });
    } catch (error) {
      console.error("Error in TileGridStrategy.play:", error);
      return Promise.resolve();
    }
  }

  private getInnerTiles(
    centerX: number,
    centerY: number,
    tileSize: number
  ): Array<{ x: number; y: number }> {
    try {
      const tiles: Array<{ x: number; y: number }> = [];

      // Add the 8 surrounding tiles
      for (let dx = -1; dx <= 1; dx++) {
        for (let dy = -1; dy <= 1; dy++) {
          if (dx === 0 && dy === 0) continue; // Skip center tile
          tiles.push({
            x: centerX + dx * tileSize,
            y: centerY + dy * tileSize,
          });
        }
      }

      return tiles;
    } catch (error) {
      console.error("Error in TileGridStrategy.getInnerTiles:", error);
      return [];
    }
  }

  private getOuterTiles(
    centerX: number,
    centerY: number,
    tileSize: number
  ): Array<{ x: number; y: number }> {
    try {
      const tiles: Array<{ x: number; y: number }> = [];

      // Add tiles two steps away from center
      for (let dx = -2; dx <= 2; dx++) {
        for (let dy = -2; dy <= 2; dy++) {
          // Skip tiles that are part of the inner layer or the center
          if (Math.abs(dx) <= 1 && Math.abs(dy) <= 1) continue;

          tiles.push({
            x: centerX + dx * tileSize,
            y: centerY + dy * tileSize,
          });
        }
      }

      return tiles;
    } catch (error) {
      console.error("Error in TileGridStrategy.getOuterTiles:", error);
      return [];
    }
  }

  private async createTileEffects(
    scene: Phaser.Scene,
    tiles: Array<{ x: number; y: number }>,
    gameObjects: Phaser.GameObjects.GameObject[],
    duration: number,
    delay: number
  ): Promise<void> {
    try {
      // Wait for delay
      if (delay > 0) {
        await new Promise((resolve) => scene.time.delayedCall(delay, resolve));
      }

      tiles.forEach((tile) => {
        // Create tile highlight
        const highlight = scene.add.rectangle(tile.x, tile.y, 32, 32, 0xffffff, 0.3);
        highlight.setDepth(5);
        gameObjects.push(highlight);

        // Create particle effect
        const particle = scene.add.circle(tile.x, tile.y, 4, 0xffffff, 0.7);
        particle.setDepth(6);
        gameObjects.push(particle);

        // Animate the effects
        scene.tweens.add({
          targets: [highlight, particle],
          alpha: 0,
          scale: { from: 1, to: 1.2 },
          duration: duration,
          ease: "Sine.easeOut",
        });
      });

      return Promise.resolve();
    } catch (error) {
      console.error("Error in TileGridStrategy.createTileEffects:", error);
      return Promise.resolve();
    }
  }

  getObjectTypesForPositioning(): string[] {
    return [];
  }
}
