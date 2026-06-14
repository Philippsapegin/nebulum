export function createPlanetScreenController({
  root,
  host,
  getPointer,
  onBeforeOpen,
  render,
  renderFallback,
  dispose3D,
  drawStarSurface,
  update3D,
  setOpenPlanetData,
}) {
  const hostElement = host ?? root.parentElement;
  const state = {
    activePlanet: null,
    activeStar: null,
    activeStarSurface: null,
    active3D: null,
    isOpen: false,
  };

  function open(planet) {
    if (!planet) {
      return;
    }

    onBeforeOpen?.();
    hostElement?.classList.add("planet-screen-open");

    try {
      render(planet);
    } catch (error) {
      console.error("Planet screen render failed", error);
      renderFallback(planet);
    }

    state.activePlanet = planet;
    state.isOpen = true;
    setOpenPlanetData?.(planet);
    root.classList.add("visible");
    root.setAttribute("aria-hidden", "false");
    const pointer = getPointer();
    updateParallax(pointer.x, pointer.y);
  }

  function close() {
    state.isOpen = false;
    state.activePlanet = null;
    setOpenPlanetData?.(null);
    hostElement?.classList.remove("planet-screen-open");
    state.activeStar = null;
    state.activeStarSurface = null;
    dispose3D();
    root.classList.remove("visible");
    root.setAttribute("aria-hidden", "true");
    clearRendered();
  }

  function clearRendered() {
    root
      .querySelectorAll(".planet-screen__layer, .planet-screen__title")
      .forEach((element) => element.remove());
  }

  function updateParallax(clientX, clientY) {
    const offsetX = (clientX / window.innerWidth - 0.5) * 34;
    const offsetY = (clientY / window.innerHeight - 0.5) * 24;
    root.style.setProperty("--planet-screen-parallax-x", `${offsetX}px`);
    root.style.setProperty("--planet-screen-parallax-y", `${offsetY}px`);
    updateGlow(clientX, clientY, offsetX, offsetY);
  }

  function updateGlow(clientX, clientY, parallaxX = 0, parallaxY = 0) {
    if (!state.activeStar?.element) {
      return;
    }

    const depth = state.activeStar.depth;
    const glowX = state.activeStar.x + parallaxX * depth;
    const glowY = state.activeStar.y + parallaxY * depth;
    const distanceToCenter = Math.hypot(clientX - glowX, clientY - glowY);
    const distanceToEdge = Math.max(0, distanceToCenter - state.activeStar.radius);
    const rightEdgeX = glowX + state.activeStar.radius;
    const falloffRadius = Math.max(780, (window.innerWidth * 0.75 - rightEdgeX) * 3);
    const proximity = 1 - Math.max(0, Math.min(1, distanceToEdge / falloffRadius));
    state.activeStar.element.style.opacity = (proximity * 0.32).toFixed(3);
    state.activeStar.element.style.transform =
      `translate(-50%, -50%) scale(${(0.92 + proximity * 0.22).toFixed(3)})`;
  }

  function tick(now, deltaSeconds) {
    if (!state.isOpen) {
      return;
    }

    if (state.activeStarSurface) {
      drawStarSurface(state.activeStarSurface, now);
    }
    if (state.active3D) {
      try {
        update3D(state.active3D, deltaSeconds, now);
      } catch (error) {
        console.error("Planet screen 3D update failed", error);
        dispose3D();
      }
    }
  }

  function resize() {
    if (!state.isOpen || !state.activePlanet) {
      return false;
    }

    try {
      render(state.activePlanet);
    } catch (error) {
      console.error("Planet screen resize render failed", error);
      renderFallback(state.activePlanet);
    }

    root.classList.add("visible");
    root.setAttribute("aria-hidden", "false");
    const pointer = getPointer();
    updateParallax(pointer.x, pointer.y);
    return true;
  }

  return {
    clearRendered,
    close,
    isOpen: () => state.isOpen,
    open,
    resize,
    state,
    tick,
    updateParallax,
  };
}
