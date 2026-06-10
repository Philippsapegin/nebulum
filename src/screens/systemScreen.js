export function createSystemScreenController({ root, body = document.body }) {
  const state = {
    activeNode: null,
    isGraphEntering: false,
    isOpen: false,
    isTransitioning: false,
  };

  function open(node) {
    state.activeNode = node;
    state.isOpen = true;
    state.isTransitioning = false;
    body.classList.add("system-open");
    root.classList.remove("system-transitioning");
    root.classList.add("visible");
    root.setAttribute("aria-hidden", "false");
  }

  function close() {
    state.activeNode = null;
    state.isOpen = false;
    state.isTransitioning = false;
    body.classList.remove("system-open");
    root.classList.remove("visible", "system-transitioning", "planet-entry-moving");
    root.setAttribute("aria-hidden", "true");
  }

  function setGraphEntering(isGraphEntering) {
    state.isGraphEntering = isGraphEntering;
  }

  function setTransitioning(isTransitioning) {
    state.isTransitioning = isTransitioning;
    root.classList.toggle("system-transitioning", isTransitioning);
  }

  return {
    close,
    isGraphEntering: () => state.isGraphEntering,
    isOpen: () => state.isOpen,
    isTransitioning: () => state.isTransitioning,
    open,
    setActiveNode: (node) => {
      state.activeNode = node;
    },
    setGraphEntering,
    setTransitioning,
    state,
  };
}
