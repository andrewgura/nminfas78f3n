import { Component } from "../Component";
import { NPC } from "../NPC";
import { eventBus } from "@/utils/EventBus";
import { useGameStore } from "@/stores/gameStore";

export class NPCDialogComponent extends Component {
  private dialogLines: string[] = [];
  private currentLineIndex: number = 0;
  private dialogContainer: HTMLElement | null = null;
  private isDialogActive: boolean = false;
  private keyPressListener: ((event: KeyboardEvent) => void) | null = null;

  constructor(entity: NPC, dialogLines: string[] = []) {
    super(entity);
    this.dialogLines = dialogLines.length > 0 ? dialogLines : ["Hello, adventurer!"];
  }

  get npc(): NPC {
    return this.entity as NPC;
  }

  initialize(): void {
    try {
      this.createDialogElements();
      super.initialize();
    } catch (error) {
      console.error("Error in NPCDialogComponent.initialize:", error);
      eventBus.emit("error.component", {
        entityId: this.entity.id,
        componentId: "NPCDialogComponent",
        error,
      });
    }
  }

  private createDialogElements(): void {
    try {
      // Remove any existing dialog container
      const existingDialog = document.getElementById(`dialog-${this.npc.id}`);
      if (existingDialog) {
        existingDialog.remove();
      }

      // Create dialog container
      this.dialogContainer = document.createElement("div");
      this.dialogContainer.id = `dialog-${this.npc.id}`;
      this.dialogContainer.className = "npc-dialog-container";

      // Set styles for the dialog
      Object.assign(this.dialogContainer.style, {
        position: "fixed",
        bottom: "150px",
        left: "50%",
        transform: "translateX(-50%)",
        width: "80%",
        maxWidth: "600px",
        backgroundColor: "rgba(0, 0, 0, 0.8)",
        border: "2px solid #664f33",
        borderRadius: "5px",
        padding: "15px",
        color: "#fff",
        fontSize: "16px",
        display: "none",
        zIndex: "1000",
        boxShadow: "0 4px 8px rgba(0, 0, 0, 0.5)",
      });

      // Create header with NPC name
      const nameContainer = document.createElement("div");
      nameContainer.className = "npc-dialog-name";
      Object.assign(nameContainer.style, {
        color: "#ffcc00",
        fontSize: "18px",
        fontWeight: "bold",
        marginBottom: "10px",
      });
      nameContainer.textContent = this.npc.npcName;

      // Create div for the dialog text
      const textContainer = document.createElement("div");
      textContainer.className = "npc-dialog-text";

      // Create instruction text
      const instruction = document.createElement("div");
      instruction.className = "npc-dialog-instruction";
      Object.assign(instruction.style, {
        marginTop: "15px",
        fontSize: "14px",
        color: "#aaa",
        textAlign: "center",
      });
      instruction.textContent = "Press Space to continue";

      // Add all elements to the dialog container
      this.dialogContainer.appendChild(nameContainer);
      this.dialogContainer.appendChild(textContainer);
      this.dialogContainer.appendChild(instruction);

      // Add to document body
      document.body.appendChild(this.dialogContainer);
    } catch (error) {
      console.error("Error in NPCDialogComponent.createDialogElements:", error);
      eventBus.emit("error.dialog.create", {
        entityId: this.entity.id,
        npcId: this.npc.id,
        error,
      });
    }
  }

  startDialog(): void {
    try {
      if (this.isDialogActive) return;

      // Create or ensure dialog elements exist
      if (!this.dialogContainer) {
        this.createDialogElements();
      }

      // Reset to first line
      this.currentLineIndex = 0;

      // Show the dialog
      if (this.dialogContainer) {
        this.dialogContainer.style.display = "block";

        // Update the text
        const textElement = this.dialogContainer.querySelector(".npc-dialog-text");
        if (textElement) {
          textElement.textContent = this.dialogLines[this.currentLineIndex];
        }

        // Set dialog as active
        this.isDialogActive = true;

        // Mark input as focused to prevent player movement
        useGameStore.getState().setInputFocused(true);

        // Set up event listener for continuing dialog
        this.keyPressListener = this.handleKeyPress.bind(this);
        document.addEventListener("keydown", this.keyPressListener);

        // Emit dialog started event
        eventBus.emit("npc.dialog.started", {
          npcId: this.npc.id,
          npcName: this.npc.npcName,
          dialog: this.dialogLines,
          currentLine: this.currentLineIndex,
        });
      }
    } catch (error) {
      console.error("Error in NPCDialogComponent.startDialog:", error);
      eventBus.emit("error.dialog.start", {
        entityId: this.entity.id,
        npcId: this.npc.id,
        error,
      });
    }
  }

  private handleKeyPress(event: KeyboardEvent): void {
    try {
      // Check for space key
      if (event.code === "Space" || event.key === " ") {
        event.preventDefault();
        this.advanceDialog();
      }

      // Allow Escape key to close dialog
      if (event.code === "Escape" || event.key === "Escape") {
        event.preventDefault();
        this.closeDialog();
      }
    } catch (error) {
      console.error("Error in NPCDialogComponent.handleKeyPress:", error);
      eventBus.emit("error.dialog.keypress", {
        entityId: this.entity.id,
        npcId: this.npc.id,
        error,
      });
    }
  }

  private advanceDialog(): void {
    try {
      // Move to next line
      this.currentLineIndex++;

      // Check if we've reached the end
      if (this.currentLineIndex >= this.dialogLines.length) {
        this.closeDialog();
        return;
      }

      // Update the text
      if (this.dialogContainer) {
        const textElement = this.dialogContainer.querySelector(".npc-dialog-text");
        if (textElement) {
          textElement.textContent = this.dialogLines[this.currentLineIndex];
        }
      }

      // Emit dialog advanced event
      eventBus.emit("npc.dialog.advanced", {
        npcId: this.npc.id,
        npcName: this.npc.npcName,
        currentLine: this.currentLineIndex,
        text: this.dialogLines[this.currentLineIndex],
      });
    } catch (error) {
      console.error("Error in NPCDialogComponent.advanceDialog:", error);
      eventBus.emit("error.dialog.advance", {
        entityId: this.entity.id,
        npcId: this.npc.id,
        error,
      });
    }
  }

  closeDialog(): void {
    try {
      // Hide the dialog
      if (this.dialogContainer) {
        this.dialogContainer.style.display = "none";
      }

      // Set dialog as inactive
      this.isDialogActive = false;

      // Release input focus
      useGameStore.getState().setInputFocused(false);

      // Remove event listener
      if (this.keyPressListener) {
        document.removeEventListener("keydown", this.keyPressListener);
        this.keyPressListener = null;
      }

      // Emit dialog ended event
      eventBus.emit("npc.dialog.ended", {
        npcId: this.npc.id,
        npcName: this.npc.npcName,
      });
    } catch (error) {
      console.error("Error in NPCDialogComponent.closeDialog:", error);
      eventBus.emit("error.dialog.close", {
        entityId: this.entity.id,
        npcId: this.npc.id,
        error,
      });
    }
  }

  setDialogLines(dialogLines: string[]): void {
    if (dialogLines.length > 0) {
      this.dialogLines = dialogLines;

      // Emit dialog updated event
      eventBus.emit("npc.dialog.updated", {
        npcId: this.npc.id,
        npcName: this.npc.npcName,
        dialog: this.dialogLines,
      });
    }
  }

  addDialogLine(line: string): void {
    this.dialogLines.push(line);

    // Emit dialog line added event
    eventBus.emit("npc.dialog.lineAdded", {
      npcId: this.npc.id,
      npcName: this.npc.npcName,
      line: line,
      totalLines: this.dialogLines.length,
    });
  }

  isActive(): boolean {
    return this.isDialogActive;
  }

  destroy(): void {
    try {
      // Close any active dialog
      if (this.isDialogActive) {
        this.closeDialog();
      }

      // Remove dialog container
      if (this.dialogContainer) {
        this.dialogContainer.remove();
        this.dialogContainer = null;
      }

      // Remove any event listeners
      if (this.keyPressListener) {
        document.removeEventListener("keydown", this.keyPressListener);
        this.keyPressListener = null;
      }

      super.destroy();
    } catch (error) {
      console.error("Error in NPCDialogComponent.destroy:", error);
      eventBus.emit("error.dialog.destroy", {
        entityId: this.entity.id,
        npcId: this.npc.id,
        error,
      });
    }
  }
}
