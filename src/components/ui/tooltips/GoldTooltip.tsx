// src/components/ui/GoldTooltip.tsx
import { ItemInstance } from "@/types";
import { ItemInstanceManager } from "@/utils/ItemInstanceManager";
import React from "react";

interface GoldTooltipProps {
  itemInstance?: ItemInstance;
  visible: boolean;
}

const GoldTooltip: React.FC<GoldTooltipProps> = ({ itemInstance, visible }) => {
  if (!visible || !itemInstance) return null;

  // Get item data
  const itemData = ItemInstanceManager.getCombinedStats(itemInstance);

  // Get quantity (default to 1 if not specified)
  const quantity = itemInstance.quantity || 1;

  // Get image URL
  const getImageUrl = (): string => {
    if (!itemData?.texture) return "";
    return `assets/equipment/valuables/${itemData.texture}.png`;
  };

  // Calculate positioning (same as regular tooltip but simpler)
  const getTooltipStyle = () => {
    return {
      display: visible ? "block" : "none",
      position: "fixed" as const,
      zIndex: 2000,
      pointerEvents: "none" as const,
      right: 235, // Positioned to avoid sidebar
      bottom: 30,
    };
  };

  return (
    <div className="gold-tooltip" style={getTooltipStyle()}>
      <div className="gold-tooltip-content">
        <div className="gold-tooltip-header">
          <div className="gold-tooltip-image-container">
            <img src={getImageUrl()} alt={itemData.name} className="gold-tooltip-image" />
          </div>
          <div className="gold-tooltip-info">
            <div className="gold-tooltip-name">{itemData.name}</div>
            <div className="gold-tooltip-quantity">{quantity > 1 ? `×${quantity}` : "×1"}</div>
          </div>
        </div>
        <div className="gold-tooltip-instruction">Press E to pick up</div>
      </div>
    </div>
  );
};

export default GoldTooltip;
