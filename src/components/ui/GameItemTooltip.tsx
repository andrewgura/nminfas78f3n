import React, { useState, useEffect } from "react";
import { useEventBus } from "../../hooks/useEventBus";
import ItemTooltip from "./ItemTooltip";

const GameItemTooltip: React.FC = () => {
  const [tooltipData, setTooltipData] = useState<{
    visible: boolean;
    itemInstance?: any;
    position: { x: number; y: number };
  }>({
    visible: false,
    itemInstance: undefined,
    position: { x: 0, y: 0 },
  });

  // Listen for tooltip show/hide events
  useEventBus("item.world.tooltip.show", (data) => {
    if (data) {
      setTooltipData({
        visible: true,
        itemInstance: data.itemInstance,
        position: data.position || { x: window.innerWidth / 2, y: window.innerHeight / 2 },
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

  return (
    <ItemTooltip
      itemInstance={tooltipData.itemInstance}
      visible={tooltipData.visible}
      position={tooltipData.position}
    />
  );
};

export default GameItemTooltip;
