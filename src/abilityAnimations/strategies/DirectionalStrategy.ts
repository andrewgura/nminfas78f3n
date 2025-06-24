import { AnimationStrategy } from "../AnimationStrategy";
import { PlayerCharacter } from "@/entities/PlayerCharacter";
import { Ability } from "@/types";
import { BaseStrategy } from "../BaseStrategy";

export class DirectionalStrategy extends BaseStrategy implements AnimationStrategy {
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
      const effectDuration = config.effectDuration || 300;
      const damage = ability.damage || 10;

      // Special handling for fire wall ability - redirect to the specific ability's strategy
      if (ability.id === "fireWall") {
        // This should no longer be needed as the registry should route to FireWallAbility directly
        console.warn(
          "DirectionalStrategy: fireWall ability should use FireWallAbility strategy directly"
        );
        return Promise.resolve();
      } else {
        // Calculate the direction the player is facing
        const facingAngle = this.getFacingAngle(playerCharacter);

        // Calculate affected tiles based on facing direction
        const affectedTiles = this.getAffectedTiles(playerCharacter, facingAngle, 32);

        // Create visual effects for each affected tile
        affectedTiles.forEach((tile) => {
          // Create tile highlight
          const highlight = scene.add.rectangle(tile.x, tile.y, 32, 32, 0xffffff, 0.3);
          highlight.setDepth(5);
          gameObjects.push(highlight);

          // Add some particles
          const particles = scene.add.circle(tile.x, tile.y, 4, 0xffffff, 0.7);
          particles.setDepth(6);
          gameObjects.push(particles);

          // Animate the effects
          scene.tweens.add({
            targets: [highlight, particles],
            alpha: 0,
            scale: { from: 1, to: 1.2 },
            duration: effectDuration,
            ease: "Sine.easeOut",
          });
        });

        // Apply damage to monsters in the affected tiles
        if (damage > 0) {
          const hitCount = this.applyDamageToMonstersInTiles(scene, affectedTiles, damage, false);
        }
      }

      // Store active animation objects
      activeAnimations.set(ability.id, gameObjects);

      // Set up cleanup timer for standard abilities
      scene.time.delayedCall(effectDuration, () => {
        gameObjects.forEach((obj) => obj.destroy());
        activeAnimations.delete(ability.id);
      });

      // Return a promise that resolves when the animation completes
      return new Promise((resolve) => {
        scene.time.delayedCall(effectDuration, resolve);
      });
    } catch (error) {
      console.error("Error in DirectionalStrategy.play:", error);
      return Promise.resolve();
    }
  }

  private getAffectedTiles(
    playerCharacter: PlayerCharacter,
    facingAngle: number,
    tileSize: number
  ): Array<{ x: number; y: number }> {
    try {
      const tiles: Array<{ x: number; y: number }> = [];
      const centerX = playerCharacter.x;
      const centerY = playerCharacter.y;

      // Calculate the base tile position in front of the player
      const baseTileX = centerX + Math.cos(facingAngle) * tileSize;
      const baseTileY = centerY + Math.sin(facingAngle) * tileSize;

      // Add the center tile
      tiles.push({
        x: baseTileX,
        y: baseTileY,
      });

      // Add tiles to the left and right of the base tile
      const perpAngle = facingAngle + Math.PI / 2;
      const offset = tileSize;

      // Left tile
      tiles.push({
        x: baseTileX + Math.cos(perpAngle) * offset,
        y: baseTileY + Math.sin(perpAngle) * offset,
      });

      // Right tile
      tiles.push({
        x: baseTileX + Math.cos(perpAngle) * -offset,
        y: baseTileY + Math.sin(perpAngle) * -offset,
      });

      return tiles;
    } catch (error) {
      console.error("Error in DirectionalStrategy.getAffectedTiles:", error);
      return [];
    }
  }

  getObjectTypesForPositioning(): string[] {
    return [];
  }
}
