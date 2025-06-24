import { MonsterDictionary } from "./MonsterDictionaryService";

export class MonsterAnimationSystem {
  /**
   * Creates animations for all monster types
   * @param scene The scene where animations will be created
   */
  static createAnimations(scene: Phaser.Scene): void {
    try {
      // Get all monster IDs from MonsterDictionary
      const monsterData = MonsterDictionary.getAllMonsters();
      const monsterIds = Object.keys(monsterData);

      // Create animations for each monster
      monsterIds.forEach((monsterId) => {
        this.createMonsterAnimations(scene, monsterId);
      });
    } catch (error) {
      console.error("Error in MonsterAnimationSystem.createAnimations:", error);
    }
  }

  /**
   * Creates animations for a specific monster type
   * @param scene The scene where animations will be created
   * @param monsterId The monster ID to create animations for
   */
  private static createMonsterAnimations(scene: Phaser.Scene, monsterId: string): void {
    try {
      // Skip if animations already exist
      if (scene.anims.exists(`${monsterId}-idle-down`)) {
        return;
      }

      // Get monster data
      const monster = MonsterDictionary.getMonster(monsterId);
      if (!monster) return;

      // Get sprite size from monster data
      const spriteSize = monster.spriteSize || 64; // Default to 64 if not specified

      // Create animations for each direction
      const directions = ["down", "left", "up", "right"];

      directions.forEach((direction) => {
        // Idle animation - single frame
        scene.anims.create({
          key: `${monsterId}-idle-${direction}`,
          frames: [{ key: monsterId, frame: this.getBaseFrameForDirection(direction, spriteSize) }],
          frameRate: 10,
          repeat: -1,
        });

        // Walking animation - 4 frames pattern
        scene.anims.create({
          key: `${monsterId}-walk-${direction}`,
          frames: scene.anims.generateFrameNumbers(monsterId, {
            frames: this.getWalkFramesForDirection(direction, spriteSize),
          }),
          frameRate: 10,
          repeat: -1,
        });
      });
    } catch (error) {
      console.error(`Error creating animations for monster ${monsterId}:`, error);
    }
  }

  /**
   * Gets the base frame index for a specific direction
   * @param direction Direction to face
   * @param spriteSize Size of sprite (32 or 64)
   */
  private static getBaseFrameForDirection(direction: string, spriteSize: number = 64): number {
    // For 32x32 sprites, frames are arranged differently
    if (spriteSize === 32) {
      switch (direction) {
        case "down":
          return 0;
        case "left":
          return 3;
        case "up":
          return 6;
        case "right":
          return 9;
        default:
          return 0;
      }
    }

    // Default 64x64 layout
    switch (direction) {
      case "down":
        return 0;
      case "left":
        return 6;
      case "up":
        return 12;
      case "right":
        return 18;
      default:
        return 0;
    }
  }

  /**
   * Gets the walking animation frames for a specific direction
   * @param direction Direction to face
   * @param spriteSize Size of sprite (32 or 64)
   */
  private static getWalkFramesForDirection(direction: string, spriteSize: number = 64): number[] {
    const baseFrame = this.getBaseFrameForDirection(direction, spriteSize);

    if (spriteSize === 32) {
      // For 32x32 sprites (typically 3 frames per direction)
      return [baseFrame, baseFrame + 1, baseFrame + 2, baseFrame + 1];
    }

    // For 64x64 sprites (standard layout)
    return [baseFrame + 2, baseFrame, baseFrame + 4, baseFrame];
  }

  /**
   * Play animation on a monster based on its state
   * @param monster The monster sprite
   * @param monsterType The type of monster
   * @param direction The facing direction ('up', 'down', 'left', 'right')
   * @param isMoving Whether the monster is moving
   * @param spriteSize Size of sprite (32 or 64) - used to determine frame layouts
   */
  static playAnimation(
    monster: Phaser.Physics.Arcade.Sprite,
    monsterType: string,
    direction: string = "down",
    isMoving: boolean = false,
    spriteSize: number = 64
  ): void {
    try {
      // Determine animation key based on state
      const animKey = isMoving
        ? `${monsterType}-walk-${direction}`
        : `${monsterType}-idle-${direction}`;

      // Only play animation if it exists and is not already playing
      if (
        monster.scene.anims.exists(animKey) &&
        (!monster.anims.isPlaying || monster.anims.currentAnim?.key !== animKey)
      ) {
        monster.anims.play(animKey, true);
      }
    } catch (error) {
      console.error("Error in MonsterAnimationSystem.playAnimation:", error);
    }
  }
}
