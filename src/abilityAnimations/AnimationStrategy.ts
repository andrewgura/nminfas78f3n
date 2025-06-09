import { PlayerCharacter } from "@/entities/PlayerCharacter";
import { Ability } from "@/types";

export interface AnimationStrategy {
  /**
   * Plays the animation for the ability
   * @param scene The current game scene
   * @param playerCharacter The player character
   * @param ability The ability being used
   * @param x The x position to play the animation at
   * @param y The y position to play the animation at
   * @returns A promise that resolves when the animation is complete
   */
  play(
    scene: Phaser.Scene,
    playerCharacter: PlayerCharacter,
    ability: Ability,
    x: number,
    y: number,
    activeAnimations: Map<string, Phaser.GameObjects.GameObject[]>
  ): Promise<void>;

  /**
   * Gets the GameObject types that this strategy can handle for position updates
   */
  getObjectTypesForPositioning(): string[];
}
