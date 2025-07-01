// src/components/ui/GameItemTooltip.tsx
// Replace the existing GameItemTooltip.tsx with this updated version

import React, { useState, useEffect } from "react";
import { useEventBus } from "../../hooks/useEventBus";
import { ItemCategory } from "../../types";
import { ItemInstanceManager } from "../../utils/ItemInstanceManager";
import ItemTooltip from "./tooltips/ItemTooltip";
import GoldTooltip from "./tooltips/GoldTooltip";

const GameItemTooltip: React.FC = () => {
  const [tooltipData, setTooltipData] = useState<{
    visible: boolean;
    itemInstance?: any;
    isGold?: boolean;
  }>({
    visible: false,
    itemInstance: undefined,
    isGold: false,
  });

  // Listen for tooltip show/hide events
  useEventBus("item.world.tooltip.show", (data) => {
    if (data) {
      // Check if this is a gold/currency item
      const itemData = ItemInstanceManager.getCombinedStats(data.itemInstance);
      const isGoldItem =
        data.itemInstance.templateId === "goldCoins" ||
        itemData?.category === ItemCategory.CURRENCY;

      setTooltipData({
        visible: true,
        itemInstance: data.itemInstance,
        isGold: isGoldItem,
      });
    }
  });

  useEventBus("item.world.tooltip.hide", () => {
    setTooltipData((prev) => ({ ...prev, visible: false }));
  });

  // Hide tooltip when mouse leaves the game area or window loses focus
  useEffect(() => {
    const handleMouseLeave = () => {
      setTooltipData((prev) => ({ ...prev, visible: false }));
    };

    const handleWindowBlur = () => {
      setTooltipData((prev) => ({ ...prev, visible: false }));
    };

    // Add event listeners
    document.addEventListener("mouseleave", handleMouseLeave);
    window.addEventListener("blur", handleWindowBlur);

    return () => {
      document.removeEventListener("mouseleave", handleMouseLeave);
      window.removeEventListener("blur", handleWindowBlur);
    };
  }, []);

  // Render the appropriate tooltip based on item type
  if (tooltipData.isGold) {
    return <GoldTooltip itemInstance={tooltipData.itemInstance} visible={tooltipData.visible} />;
  }

  return <ItemTooltip itemInstance={tooltipData.itemInstance} visible={tooltipData.visible} />;
};

export default GameItemTooltip;
