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
  const CLOSE_CLEANUP_DELAY_MS = 340;
  const hostElement = host ?? root.parentElement;
  let closeCleanupTimeout = null;
  const state = {
    activePlanet: null,
    activeMoons: [],
    activeStar: null,
    activeStarSurface: null,
    active3D: null,
    moonDebugSettings: {
      shadowOffset: 111,
    },
    parallaxX: 0,
    parallaxY: 0,
    isOpen: false,
  };

  function open(planet) {
    if (!planet) {
      return;
    }

    cancelCloseCleanup();
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
    cancelCloseCleanup();
    state.isOpen = false;
    state.activePlanet = null;
    setOpenPlanetData?.(null);
    hostElement?.classList.remove("planet-screen-open");
    root.classList.remove("visible");
    root.setAttribute("aria-hidden", "true");
    closeCleanupTimeout = window.setTimeout(() => {
      closeCleanupTimeout = null;
      state.activeStar = null;
      state.activeMoons = [];
      state.activeStarSurface = null;
      dispose3D();
      clearRendered();
    }, CLOSE_CLEANUP_DELAY_MS);
  }

  function cancelCloseCleanup() {
    if (closeCleanupTimeout === null) {
      return;
    }

    window.clearTimeout(closeCleanupTimeout);
    closeCleanupTimeout = null;
  }

  function clearRendered() {
    root
      .querySelectorAll(".planet-screen__layer, .planet-screen__title, .planet-screen__moon-label, .planet-screen__star-hover-glow")
      .forEach((element) => element.remove());
  }

  function updateParallax(clientX, clientY) {
    const offsetX = (clientX / window.innerWidth - 0.5) * 34;
    const offsetY = (clientY / window.innerHeight - 0.5) * 24;
    state.parallaxX = offsetX;
    state.parallaxY = offsetY;
    root.style.setProperty("--planet-screen-parallax-x", `${offsetX}px`);
    root.style.setProperty("--planet-screen-parallax-y", `${offsetY}px`);
    updateGlow(clientX, clientY, offsetX, offsetY);
    updateMoonDecorations(offsetX, offsetY);
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
    state.activeStar.element.style.left = `${glowX}px`;
    state.activeStar.element.style.top = `${glowY}px`;
    state.activeStar.element.style.opacity = (proximity * 0.32).toFixed(3);
    state.activeStar.element.style.transform =
      `translate(-50%, -50%) scale(${(0.92 + proximity * 0.22).toFixed(3)})`;
  }

  function updateMoonDecorations(parallaxX = 0, parallaxY = 0) {
    if (!state.activeStar || !state.activeMoons?.length) {
      return;
    }

    const starDepth = state.activeStar.depth;
    const starX = state.activeStar.x + parallaxX * starDepth;
    const starY = state.activeStar.y + parallaxY * starDepth;

    for (const moon of state.activeMoons) {
      const moonX = moon.x + parallaxX * moon.depth;
      const moonY = moon.y + parallaxY * moon.depth;
      const toStarX = starX - moonX;
      const toStarY = starY - moonY;
      const distance = Math.hypot(toStarX, toStarY) || 1;
      const lightDirectionX = toStarX / distance;
      const lightDirectionY = toStarY / distance;
      const lightX = 50 + lightDirectionX * 34;
      const lightY = 50 + lightDirectionY * 34;
      const shadowOffset = state.moonDebugSettings?.shadowOffset ?? 111;
      const shadowX = 50 + lightDirectionX * shadowOffset;
      const shadowY = 50 + lightDirectionY * shadowOffset;
      const rimContact = state.activeStar.radius + moon.radius - distance;
      const rimStrength = state.activeStar.isBlackHole
        ? 0
        : Math.max(0, Math.min(1, (rimContact + moon.radius * 0.16) / (moon.radius * 0.72)));

      moon.element.style.setProperty("--moon-light-x", `${lightX.toFixed(2)}%`);
      moon.element.style.setProperty("--moon-light-y", `${lightY.toFixed(2)}%`);
      moon.element.style.setProperty("--moon-shadow-x", `${shadowX.toFixed(2)}%`);
      moon.element.style.setProperty("--moon-shadow-y", `${shadowY.toFixed(2)}%`);
      moon.element.style.setProperty("--moon-rim-opacity", rimStrength.toFixed(3));
    }
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
