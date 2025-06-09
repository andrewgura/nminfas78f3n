import { Component } from "./Component";
import { Entity } from "../entities/Entity";
import { eventBus } from "@/utils/EventBus";

export class ComponentManager {
  private entity: Entity;
  private components: Map<string, Component> = new Map();

  constructor(entity: Entity) {
    this.entity = entity;
  }

  add<T extends Component>(componentType: string, component: T): T {
    try {
      this.components.set(componentType, component);
      component.initialize();

      // Emit component added event
      eventBus.emit("component.added", {
        entityId: this.entity.id,
        componentType,
        componentId: component.constructor.name,
      });

      return component;
    } catch (error) {
      console.error(`Error adding component ${componentType} to entity ${this.entity.id}:`, error);
      eventBus.emit("error.component.add", {
        entityId: this.entity.id,
        componentType,
        error,
      });
      return component;
    }
  }

  get<T extends Component>(componentType: string): T | undefined {
    return this.components.get(componentType) as T | undefined;
  }

  remove(componentType: string): boolean {
    try {
      const component = this.components.get(componentType);
      if (component) {
        component.destroy();
        const result = this.components.delete(componentType);

        // Emit component removed event
        eventBus.emit("component.removed", {
          entityId: this.entity.id,
          componentType,
        });

        return result;
      }
      return false;
    } catch (error) {
      console.error(
        `Error removing component ${componentType} from entity ${this.entity.id}:`,
        error
      );
      eventBus.emit("error.component.remove", {
        entityId: this.entity.id,
        componentType,
        error,
      });
      return false;
    }
  }

  update(time: number, delta: number): void {
    try {
      this.components.forEach((component) => {
        component.update(time, delta);
      });
    } catch (error) {
      console.error(`Error updating components for entity ${this.entity.id}:`, error);
      eventBus.emit("error.component.manager.update", {
        entityId: this.entity.id,
        error,
      });
    }
  }

  destroy(): void {
    try {
      this.components.forEach((component) => {
        component.destroy();
      });
      this.components.clear();

      // Emit component manager destroyed event
      eventBus.emit("component.manager.destroyed", {
        entityId: this.entity.id,
      });
    } catch (error) {
      console.error(`Error destroying components for entity ${this.entity.id}:`, error);
      eventBus.emit("error.component.manager.destroy", {
        entityId: this.entity.id,
        error,
      });
    }
  }
}
