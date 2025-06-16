import { AnimationStrategy } from "./AnimationStrategy";
import { Monster } from "@/entities/Monster";
import { PlayerCharacter } from "@/entities/PlayerCharacter";
import { Ability } from "@/types";
import { DamageFormulas } from "@/utils/formulas";
import { useGameStore } from "@/stores/gameStore";
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
   * Apply ability damage to a single monster using new damage formulas
   */
  protected applyAbilityDamageToMonster(
    monster: Monster,
    ability: Ability,
    debug: boolean = false
  ): void {
    try {
      if (!monster.active || !monster.takeDamage) return;

      // Get player state for damage calculation
      const store = useGameStore.getState();
      const equipment = store.playerCharacter.equipment;
      const skills = store.playerCharacter.skills;

      // Calculate final damage using our formulas
      const finalDamage = DamageFormulas.calculatePlayerAbilityFinalDamage(
        ability.damage || 0,
        equipment,
        skills, // This now accepts 'any' type
        ability.skillId || "meleeWeapons",
        monster.armor // This should now work since we added armor property
      );

      // Determine if this is magic damage
      const isMagicDamage = DamageFormulas.isMagicDamage(undefined, ability.skillId);

      if (debug) {
        console.log(
          `Ability ${ability.id} dealing ${finalDamage} damage to monster (magic: ${isMagicDamage})`
        );
      }

      // Apply damage to monster
      monster.takeDamage(finalDamage, isMagicDamage);

      // Show damage effect
      this.showDamageEffect(monster.scene, monster, finalDamage);

      // Award skill experience
      this.awardSkillExperience(ability.skillId || "meleeWeapons", finalDamage);
    } catch (error) {
      console.error("Error applying ability damage to monster:", error);
    }
  }

  /**
   * Award skill experience for dealing damage
   */
  private awardSkillExperience(skillId: string, damage: number): void {
    try {
      const store = useGameStore.getState();
      const currentExp = store.playerCharacter.skills[skillId]?.experience || 0;
      const expGained = Math.max(1, Math.floor(damage * 0.3));

      store.updateSkill(skillId, currentExp + expGained);
    } catch (error) {
      console.error("Error awarding skill experience:", error);
    }
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

      debugGraphics.setDepth(10);
      return debugGraphics;
    } catch (error) {
      console.error("Error in BaseStrategy.createDebugVisualization:", error);
      return scene.add.graphics(); // Return empty graphics object on error
    }
  }

  /**
   * Applies damage to monsters located in the affected tiles using new damage formulas
   * @returns Number of monsters hit
   */
  protected applyDamageToMonstersInTiles(
    scene: Phaser.Scene,
    tilePositions: { x: number; y: number }[],
    ability: Ability,
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
          // Monster is in an affected tile - apply damage using new formula
          this.applyAbilityDamageToMonster(monster, ability, debug);
          hitCount++;

          // Visual feedback for hits
          this.createHitEffect(scene, monster);
        }
      });

      return hitCount;
    } catch (error) {
      console.error("Error in BaseStrategy.applyDamageToMonstersInTiles:", error);
      return 0;
    }
  }

  /**
   * Applies damage to monsters within a circular area using new damage formulas
   * @returns Number of monsters hit
   */
  protected applyDamageInCircle(
    scene: Phaser.Scene,
    centerX: number,
    centerY: number,
    radius: number,
    ability: Ability,
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
          if (debug) {
            console.log(`Circle damage to monster at distance ${distance.toFixed(1)}`);
          }

          // Apply damage using new formula
          this.applyAbilityDamageToMonster(monster, ability, debug);
          hitCount++;

          // Visual feedback for hits
          this.createHitEffect(scene, monster);
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
   * Applies damage to monsters along a line (useful for piercing shots) using new damage formulas
   * @returns Number of monsters hit
   */
  protected applyDamageInLine(
    scene: Phaser.Scene,
    startX: number,
    startY: number,
    endX: number,
    endY: number,
    width: number,
    ability: Ability,
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
          if (debug) {
            console.log(`Line damage to monster at distance ${distance.toFixed(1)} from line`);
          }

          // Apply damage using new formula
          this.applyAbilityDamageToMonster(monster, ability, debug);
          hitCount++;
          hitMonsters.add(monster);

          // Visual feedback for hits
          this.createHitEffect(scene, monster);
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
   * Fixed rotation method for patterns (more reliable)
   */
  protected rotatePatternFixed(pattern: number[][], facing: string): number[][] {
    try {
      // If facing up, no rotation needed (base pattern)
      if (facing === "up") return pattern;

      return pattern.map(([x, y]) => {
        // Apply rotation based on facing direction
        switch (facing) {
          case "right":
            // 90° clockwise: (x,y) -> (-y,x)
            return [-y, x];
          case "down":
            // 180°: (x,y) -> (-x,-y)
            return [-x, -y];
          case "left":
            // 90° counter-clockwise: (x,y) -> (y,-x)
            return [y, -x];
          default:
            return [x, y];
        }
      });
    } catch (error) {
      console.error("Error in BaseStrategy.rotatePatternFixed:", error);
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
    try {
      scene.time.delayedCall(effectDuration, () => {
        // Clean up game objects
        gameObjects.forEach((obj) => {
          if (obj && obj.active) {
            obj.destroy();
          }
        });

        // Remove from active animations
        activeAnimations.delete(abilityId);

        // Call optional cleanup callback
        if (onCleanup) {
          onCleanup();
        }
      });
    } catch (error) {
      console.error("Error in BaseStrategy.setupCleanupTimer:", error);
    }
  }

  /**
   * Get mouse world position for abilities that target cursor
   */
  protected getMouseWorldPosition(scene: Phaser.Scene): { x: number; y: number } | null {
    try {
      const input = scene.input;
      if (!input.activePointer) return null;

      const camera = scene.cameras.main;
      const worldX = input.activePointer.worldX;
      const worldY = input.activePointer.worldY;

      return { x: worldX, y: worldY };
    } catch (error) {
      console.error("Error in BaseStrategy.getMouseWorldPosition:", error);
      return null;
    }
  }

  /**
   * Generate area tiles in a grid pattern
   */
  protected generateAreaTiles(
    centerX: number,
    centerY: number,
    width: number,
    height: number
  ): { x: number; y: number }[] {
    try {
      const tiles: { x: number; y: number }[] = [];
      const halfWidth = Math.floor(width / 2);
      const halfHeight = Math.floor(height / 2);

      for (let x = -halfWidth; x <= halfWidth; x++) {
        for (let y = -halfHeight; y <= halfHeight; y++) {
          tiles.push({
            x: centerX + x * this.TILE_SIZE,
            y: centerY + y * this.TILE_SIZE,
          });
        }
      }

      return tiles;
    } catch (error) {
      console.error("Error in BaseStrategy.generateAreaTiles:", error);
      return [];
    }
  }

  /**
   * Create tile highlights for visual effects
   */
  protected createTileHighlights(
    scene: Phaser.Scene,
    positions: { x: number; y: number }[],
    duration: number,
    config: any,
    gameObjects: Phaser.GameObjects.GameObject[]
  ): void {
    try {
      const colors = config.particleColors || [0xff0000, 0xff7700, 0xffff00];

      positions.forEach((pos) => {
        // Create tile highlight
        const highlight = scene.add.rectangle(
          pos.x,
          pos.y,
          this.TILE_SIZE,
          this.TILE_SIZE,
          colors[0],
          0.4
        );
        highlight.setDepth(5);
        gameObjects.push(highlight);

        // Animate the highlight
        scene.tweens.add({
          targets: highlight,
          alpha: 0,
          scale: 1.2,
          duration: duration,
          ease: "Sine.easeOut",
        });
      });
    } catch (error) {
      console.error("Error in BaseStrategy.createTileHighlights:", error);
    }
  }
}
