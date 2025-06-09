import React, { createContext, useContext, useState, useCallback } from "react";

interface UIState {
  activePanel: string | null;
  modalStack: string[];
}

interface UIContextValue {
  state: UIState;
  openPanel: (panelId: string) => void;
  closePanel: (panelId: string) => void;
  togglePanel: (panelId: string) => void;
  isOpen: (panelId: string) => boolean;
  openModal: (modalId: string) => void;
  closeModal: (modalId: string) => void;
  isModalOpen: (modalId: string) => boolean;
  getTopModal: () => string | null;
}

// Create context with default values
const UIContext = createContext<UIContextValue>({
  state: { activePanel: null, modalStack: [] },
  openPanel: () => {},
  closePanel: () => {},
  togglePanel: () => {},
  isOpen: () => false,
  openModal: () => {},
  closeModal: () => {},
  isModalOpen: () => false,
  getTopModal: () => null,
});

// Custom hook to use the UI context
export const useUIContext = () => useContext(UIContext);

// Provider component
export const UIProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [state, setState] = useState<UIState>({
    activePanel: null,
    modalStack: [],
  });

  // Open a sidebar panel (closes any other open panel)
  const openPanel = useCallback((panelId: string) => {
    setState((prev) => ({
      ...prev,
      activePanel: panelId,
    }));
  }, []);

  // Close a specific panel
  const closePanel = useCallback((panelId: string) => {
    setState((prev) => ({
      ...prev,
      activePanel: prev.activePanel === panelId ? null : prev.activePanel,
    }));
  }, []);

  // Toggle a panel (open if closed, close if open)
  const togglePanel = useCallback((panelId: string) => {
    setState((prev) => ({
      ...prev,
      activePanel: prev.activePanel === panelId ? null : panelId,
    }));
  }, []);

  // Check if a panel is open
  const isOpen = useCallback(
    (panelId: string) => {
      return state.activePanel === panelId;
    },
    [state.activePanel]
  );

  // Open a modal dialog (can have multiple stacked)
  const openModal = useCallback((modalId: string) => {
    setState((prev) => {
      // Remove if already in stack
      const filteredStack = prev.modalStack.filter((id) => id !== modalId);

      // Add to top of stack
      return {
        ...prev,
        modalStack: [...filteredStack, modalId],
      };
    });
  }, []);

  // Close a specific modal
  const closeModal = useCallback((modalId: string) => {
    setState((prev) => ({
      ...prev,
      modalStack: prev.modalStack.filter((id) => id !== modalId),
    }));
  }, []);

  // Check if a modal is open
  const isModalOpen = useCallback(
    (modalId: string) => {
      return state.modalStack.includes(modalId);
    },
    [state.modalStack]
  );

  // Get the topmost modal
  const getTopModal = useCallback(() => {
    return state.modalStack.length > 0 ? state.modalStack[state.modalStack.length - 1] : null;
  }, [state.modalStack]);

  // Create the context value
  const value = {
    state,
    openPanel,
    closePanel,
    togglePanel,
    isOpen,
    openModal,
    closeModal,
    isModalOpen,
    getTopModal,
  };

  return <UIContext.Provider value={value}>{children}</UIContext.Provider>;
};
