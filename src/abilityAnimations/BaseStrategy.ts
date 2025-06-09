import { AnimationStrategy } from "./AnimationStrategy";
import { Monster } from "@/entities/Monster";
import { PlayerCharacter } from "@/entities/PlayerCharacter";
import { Ability } from "@/types";
import { eventBus } from "@/utils/EventBus";

/**
 * Base strategy class with common functionality for ability strategies
 */
export abstract class BaseStrategy implements AnimationStrategy {
  // Default tile size in pixels
  protected readonly TILE_SIZE = 32;

  /**
   * Abstract method that must be implemented by all ability strategies
   */
  abstract play(
    scene: Phaser.Scene,
    playerCharacter: PlayerCharacter,
    ability: Ability,
    x: number,
    y: number,
    activeAnimations: Map<string, Phaser.GameObjects.GameObject[]>
  ): Promise<void>;

  /**
   * Returns empty array by default - override if needed
   */
  getObjectTypesForPositioning(): string[] {
    return []; // Default implementation
  }

  /**
   * Converts the tile pattern to world positions
   * @returns Array of world positions for each affected tile
   */
  protected convertPatternToWorldPositions(
    pattern: number[][],
    playerTileX: number,
    playerTileY: number,
    tileSize: number = this.TILE_SIZE
  ): { x: number; y: number }[] {
    try {
      const worldPositions: { x: number; y: number }[] = [];

      pattern.forEach(([xOffset, yOffset]) => {
        const tileX = playerTileX + xOffset;
        const tileY = playerTileY + yOffset;

        // Convert tile coordinates to world coordinates (center of the tile)
        const worldX = tileX * tileSize + tileSize / 2;
        const worldY = tileY * tileSize + tileSize / 2;

        worldPositions.push({ x: worldX, y: worldY });
      });

      return worldPositions;
    } catch (error) {
      console.error("Error in BaseStrategy.convertPatternToWorldPositions:", error);
      return [];
    }
  }

  /**
   * Creates debug visualization of tile positions
   */
  protected createDebugVisualization(
    scene: Phaser.Scene,
    positions: { x: number; y: number }[],
    tileSize: number = this.TILE_SIZE
  ): Phaser.GameObjects.Graphics {
    try {
      const debugGraphics = scene.add.graphics();
      debugGraphics.lineStyle(1, 0xff0000, 0.7);

      positions.forEach((pos) => {
        debugGraphics.strokeRect(pos.x - tileSize / 2, pos.y - tileSize / 2, tileSize, tileSize);
      });

      return debugGraphics;
    } catch (error) {
      console.error("Error in BaseStrategy.createDebugVisualization:", error);
      return scene.add.graphics(); // Return empty graphics object on error
    }
  }

  /**
   * Applies damage to monsters located in the affected tiles
   * @returns Number of monsters hit
   */
  protected applyDamageToMonstersInTiles(
    scene: Phaser.Scene,
    tilePositions: { x: number; y: number }[],
    damage: number,
    debug: boolean = false
  ): number {
    try {
      const gameScene = scene as any;
      if (!gameScene.monsters) return 0;

      const monsters = gameScene.monsters.getChildren() as Monster[];
      let hitCount = 0;

      // For each monster, check if it's in any of the affected tiles
      monsters.forEach((monster) => {
        if (!monster.active) return;

        // Get the monster's tile position
        const monsterTileX = Math.floor(monster.x / this.TILE_SIZE);
        const monsterTileY = Math.floor(monster.y / this.TILE_SIZE);

        // Check if this monster's tile is in any of our affected positions
        const isInAffectedTile = tilePositions.some((pos) => {
          const posTileX = Math.floor(pos.x / this.TILE_SIZE);
          const posTileY = Math.floor(pos.y / this.TILE_SIZE);
          return posTileX === monsterTileX && posTileY === monsterTileY;
        });

        if (debug) {
          console.log(
            `Monster at (${monster.x}, ${monster.y}) -> tile (${monsterTileX}, ${monsterTileY}): hit=${isInAffectedTile}`
          );
        }

        if (isInAffectedTile) {
          // Monster is in an affected tile - apply damage
          if (monster.takeDamage) {
            monster.takeDamage(damage);
            this.showDamageEffect(scene, monster, damage);
            hitCount++;

            // Visual feedback for hits
            this.createHitEffect(scene, monster);
          }
        }
      });

      return hitCount;
    } catch (error) {
      console.error("Error in BaseStrategy.applyDamageToMonstersInTiles:", error);
      return 0;
    }
  }

  /**
   * Applies damage to monsters within a circular area
   * @returns Number of monsters hit
   */
  protected applyDamageInCircle(
    scene: Phaser.Scene,
    centerX: number,
    centerY: number,
    radius: number,
    damage: number,
    excludeMonster: Monster | null = null,
    debug: boolean = false
  ): number {
    try {
      const gameScene = scene as any;
      if (!gameScene.monsters) return 0;

      const monsters = gameScene.monsters.getChildren() as Monster[];
      let hitCount = 0;

      // Check each monster for distance from center
      monsters.forEach((monster) => {
        if (!monster.active) return;

        // Skip excluded monster
        if (excludeMonster && monster === excludeMonster) return;

        // Calculate distance from explosion center to monster
        const distance = Phaser.Math.Distance.Between(centerX, centerY, monster.x, monster.y);

        if (distance <= radius) {
          // Apply damage with falloff based on distance
          const falloff = 1 - distance / radius;
          const actualDamage = Math.max(1, Math.floor(damage * falloff));

          if (monster.takeDamage) {
            if (debug) {
              console.log(
                `Circle damage to monster at distance ${distance.toFixed(1)}, applying ${actualDamage} damage`
              );
            }
            monster.takeDamage(actualDamage);
            this.showDamageEffect(scene, monster, actualDamage);
            hitCount++;

            // Visual feedback for hits
            this.createHitEffect(scene, monster);
          }
        }
      });

      return hitCount;
    } catch (error) {
      console.error("Error in BaseStrategy.applyDamageInCircle:", error);
      return 0;
    }
  }

  /**
   * Get facing angle from player character
   * All ability implementations should use this instead of implementing their own
   */
  protected getFacingAngle(character: PlayerCharacter): number {
    try {
      const facing = character.facing || "down";
      switch (facing) {
        case "up":
          return -Math.PI / 2;
        case "right":
          return 0;
        case "down":
          return Math.PI / 2;
        case "left":
          return Math.PI;
        default:
          return 0;
      }
    } catch (error) {
      console.error("Error in BaseStrategy.getFacingAngle:", error);
      return 0;
    }
  }

  /**
   * Applies damage to monsters along a line (useful for piercing shots)
   * @returns Number of monsters hit
   */
  protected applyDamageInLine(
    scene: Phaser.Scene,
    startX: number,
    startY: number,
    endX: number,
    endY: number,
    width: number,
    damage: number,
    hitMonsters: Set<Monster> = new Set(),
    debug: boolean = false
  ): number {
    try {
      const gameScene = scene as any;
      if (!gameScene.monsters) return 0;

      const monsters = gameScene.monsters.getChildren() as Monster[];
      let hitCount = 0;

      monsters.forEach((monster) => {
        if (!monster.active || hitMonsters.has(monster)) return;

        // Distance from monster to line segment
        const distance = this.distanceToLine(monster.x, monster.y, startX, startY, endX, endY);

        if (distance <= width / 2 + 16) {
          // Adding monster radius
          if (monster.takeDamage) {
            if (debug) {
              console.log(
                `Line damage to monster at distance ${distance.toFixed(1)} from line, damage: ${damage}`
              );
            }
            monster.takeDamage(damage);
            this.showDamageEffect(scene, monster, damage);
            hitCount++;
            hitMonsters.add(monster);

            // Visual feedback for hits
            this.createHitEffect(scene, monster);
          }
        }
      });

      return hitCount;
    } catch (error) {
      console.error("Error in BaseStrategy.applyDamageInLine:", error);
      return 0;
    }
  }

  /**
   * Calculates the distance from a point to a line segment
   */
  protected distanceToLine(
    px: number,
    py: number,
    x1: number,
    y1: number,
    x2: number,
    y2: number
  ): number {
    try {
      // Line length squared
      const l2 = Math.pow(x2 - x1, 2) + Math.pow(y2 - y1, 2);
      if (l2 === 0) return Math.sqrt(Math.pow(px - x1, 2) + Math.pow(py - y1, 2)); // Point

      // Project point onto line
      const t = Math.max(0, Math.min(1, ((px - x1) * (x2 - x1) + (py - y1) * (y2 - y1)) / l2));

      // Get nearest point on line segment
      const projX = x1 + t * (x2 - x1);
      const projY = y1 + t * (y2 - y1);

      // Return distance to nearest point
      return Math.sqrt(Math.pow(px - projX, 2) + Math.pow(py - projY, 2));
    } catch (error) {
      console.error("Error in BaseStrategy.distanceToLine:", error);
      return Number.MAX_VALUE; // Return a large distance on error
    }
  }

  /**
   * Creates a visual effect when a monster is hit
   */
  protected createHitEffect(scene: Phaser.Scene, monster: Monster): void {
    try {
      const hitEffect = scene.add.circle(monster.x, monster.y, 20, 0x00aaff, 0.6);
      hitEffect.setDepth(7);
      scene.tweens.add({
        targets: hitEffect,
        alpha: 0,
        scale: 1.5,
        duration: 300,
        onComplete: () => {
          hitEffect.destroy();
        },
      });
    } catch (error) {
      console.error("Error in BaseStrategy.createHitEffect:", error);
    }
  }

  /**
   * Shows damage number above the target
   */
  protected showDamageEffect(scene: Phaser.Scene, target: any, damage: number): void {
    try {
      // Create damage text
      const text = scene.add.text(target.x, target.y - 20, `-${damage}`, {
        fontFamily: "Arial",
        fontSize: "16px",
        color: "#ff0000",
        stroke: "#000000",
        strokeThickness: 3,
      });

      text.setOrigin(0.5);
      text.setDepth(100);

      // Animate the text rising and fading
      scene.tweens.add({
        targets: text,
        y: target.y - 50,
        alpha: 0,
        duration: 1000,
        onComplete: () => {
          text.destroy();
        },
      });
    } catch (error) {
      console.error("Error in BaseStrategy.showDamageEffect:", error);
    }
  }

  /**
   * Rotates the pattern based on the player's facing direction
   */
  protected rotatePattern(pattern: number[][], facing: string): number[][] {
    try {
      // If facing up, no rotation needed (base pattern)
      if (facing === "up") return pattern;

      return pattern.map(([x, y]) => {
        // Apply rotation based on facing direction
        switch (facing) {
          case "right":
            // 90° clockwise: (x,y) -> (y,-x)
            return [y, -x];
          case "down":
            // 180°: (x,y) -> (-x,-y)
            return [-x, -y];
          case "left":
            // 90° counter-clockwise: (x,y) -> (-y,x)
            return [-y, x];
          default:
            return [x, y];
        }
      });
    } catch (error) {
      console.error("Error in BaseStrategy.rotatePattern:", error);
      return pattern; // Return original pattern on error
    }
  }

  /**
   * Creates cleanup timer for animations
   */
  protected setupCleanupTimer(
    scene: Phaser.Scene,
    effectDuration: number,
    gameObjects: Phaser.GameObjects.GameObject[],
    activeAnimations: Map<string, Phaser.GameObjects.GameObject[]>,
    abilityId: string,
    onCleanup?: () => void
  ): void {
    scene.time.delayedCall(effectDuration, () => {
      gameObjects.forEach((obj) => {
        if (obj.active) obj.destroy();
      });
      activeAnimations.delete(abilityId);

      if (onCleanup) {
        onCleanup();
      }
    });
  }

  /**
   * Gets the mouse position in world coordinates - useful for targeted abilities
   */
  protected getMouseWorldPosition(scene: Phaser.Scene): { x: number; y: number } | null {
    try {
      const pointer = scene.input.activePointer;
      if (!pointer) return null;

      // Convert screen coordinates to world coordinates
      return {
        x: pointer.worldX,
        y: pointer.worldY,
      };
    } catch (error) {
      console.error("Error getting mouse position:", error);
      return null;
    }
  }
}
