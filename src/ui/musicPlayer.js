import * as THREE from "three";

export function createMusicPlayer({ tracks, canDragInSystem }) {
  const musicPrevButton = document.querySelector("#music-prev");
  const musicPlayButton = document.querySelector("#music-play");
  const musicPlayIcon = document.querySelector("#music-play-icon");
  const musicNextButton = document.querySelector("#music-next");
  const musicModeButton = document.querySelector("#music-mode");
  const musicModeIcon = document.querySelector("#music-mode-icon");
  const musicVolume = document.querySelector("#music-volume");
  const musicTrackCurrent = document.querySelector("#music-track-current");
  const musicDropdownButton = document.querySelector("#music-dropdown");
  const musicPlayer = document.querySelector(".music-player");
  const musicTrackListBackdrop = document.querySelector("#music-track-list-backdrop");
  const musicTrackList = document.querySelector("#music-track-list");
  const musicTrackScrollbar = document.querySelector("#music-track-scrollbar");
  const musicTrackScrollbarThumb = document.querySelector("#music-track-scrollbar-thumb");

  let musicTrackIndex = 0;
  let musicMode = "order";
  let systemMusicPlayerPosition = null;
  let isDraggingMusicPlayer = false;
  const musicPlayerDragOffset = new THREE.Vector2();
  const musicAudio = new Audio();
  musicAudio.preload = "metadata";

  function init() {
    if (!musicTrackList || tracks.length === 0) {
      return;
    }

    tracks.forEach((file, index) => {
      const item = document.createElement("button");
      item.className = "music-track-item";
      item.type = "button";
      item.textContent = getMusicTrackTitle(file);
      item.addEventListener("click", () => {
        setMusicTrack(index, !musicAudio.paused);
        setMusicDropdownOpen(false);
      });
      musicTrackList.append(item);
    });

    musicAudio.volume = Number(musicVolume.value);
    musicVolume.style.setProperty("--vol-frac", musicVolume.value);
    setMusicTrack(0, false);

    musicPrevButton.addEventListener("click", () => playAdjacentTrack(-1));
    musicNextButton.addEventListener("click", () => playAdjacentTrack(1));
    musicPlayButton.addEventListener("click", toggleMusicPlayback);
    musicModeButton.addEventListener("click", cycleMusicMode);
    musicDropdownButton.addEventListener("click", (event) => {
      event.stopPropagation();
      setMusicDropdownOpen(musicTrackList.hidden);
    });
    musicTrackCurrent.addEventListener("click", (event) => {
      event.stopPropagation();
      setMusicDropdownOpen(musicTrackList.hidden);
    });
    musicVolume.addEventListener("input", () => {
      musicAudio.volume = Number(musicVolume.value);
      musicVolume.style.setProperty("--vol-frac", musicVolume.value);
    });
    musicTrackCurrent.addEventListener("pointerdown", (event) => {
      seekMusicFromTrackButton(event);
    });
    musicTrackCurrent.addEventListener("pointermove", (event) => {
      if (event.buttons === 1) {
        seekMusicFromTrackButton(event);
      }
    });
    musicTrackList.addEventListener("scroll", updateMusicTrackScrollbar);
    musicTrackScrollbar?.addEventListener("pointerdown", onMusicScrollbarPointerDown);
    musicPlayer?.addEventListener("pointerdown", onMusicPlayerPointerDown);

    musicAudio.addEventListener("play", updateMusicPlayButton);
    musicAudio.addEventListener("pause", updateMusicPlayButton);
    musicAudio.addEventListener("loadedmetadata", updateMusicProgress);
    musicAudio.addEventListener("timeupdate", updateMusicProgress);
    musicAudio.addEventListener("ended", handleMusicEnded);
    document.addEventListener("pointerdown", (event) => {
      if (
        musicTrackList.hidden ||
        musicTrackList.contains(event.target) ||
        musicTrackScrollbar?.contains(event.target) ||
        musicDropdownButton.contains(event.target) ||
        musicTrackCurrent.contains(event.target)
      ) {
        return;
      }
      setMusicDropdownOpen(false);
    });
  }

  function setMusicTrack(index, shouldPlay) {
    musicTrackIndex = THREE.MathUtils.euclideanModulo(index, tracks.length);
    const file = tracks[musicTrackIndex];
    musicAudio.src = `/Music/${encodeURIComponent(file)}`;
    musicTrackCurrent.textContent = getMusicTrackTitle(file);
    updateMusicTrackListUi();
    musicTrackCurrent.style.setProperty("--music-progress", "0%");

    if (shouldPlay) {
      musicAudio.play().catch(() => {});
    }

    updateMusicPlayButton();
  }

  function toggleMusicPlayback() {
    if (musicAudio.paused) {
      musicAudio.play().catch(() => {});
    } else {
      musicAudio.pause();
    }
  }

  function playAdjacentTrack(direction) {
    if (musicMode === "shuffle") {
      playRandomTrack();
      return;
    }

    setMusicTrack(musicTrackIndex + direction, !musicAudio.paused);
  }

  function handleMusicEnded() {
    if (musicMode === "repeat") {
      musicAudio.currentTime = 0;
      musicAudio.play().catch(() => {});
      return;
    }

    if (musicMode === "shuffle") {
      playRandomTrack();
      return;
    }

    setMusicTrack(musicTrackIndex + 1, true);
  }

  function playRandomTrack() {
    if (tracks.length <= 1) {
      setMusicTrack(0, true);
      return;
    }

    let nextIndex = musicTrackIndex;
    while (nextIndex === musicTrackIndex) {
      nextIndex = Math.floor(Math.random() * tracks.length);
    }
    setMusicTrack(nextIndex, true);
  }

  function cycleMusicMode() {
    musicMode = musicMode === "order" ? "repeat" : musicMode === "repeat" ? "shuffle" : "order";
    const icons = {
      order: "/Musplayer/order.svg",
      repeat: "/Musplayer/repeat.svg",
      shuffle: "/Musplayer/shuffle.svg",
    };
    musicModeIcon.src = icons[musicMode];
    musicModeButton.dataset.mode = musicMode;
  }

  function updateMusicPlayButton() {
    musicPlayIcon.src = musicAudio.paused ? "/Musplayer/play.svg" : "/Musplayer/pause.svg";
    musicPlayIcon.classList.toggle("music-button__icon--play", musicAudio.paused);
  }

  function updateMusicProgress() {
    if (!Number.isFinite(musicAudio.duration) || musicAudio.duration <= 0) {
      return;
    }

    musicTrackCurrent.style.setProperty("--music-progress", `${(musicAudio.currentTime / musicAudio.duration) * 100}%`);
  }

  function getMusicTrackTitle(file) {
    return file.replace(/\.mp3$/i, "").replace(/^\d+\.\s*/, "");
  }

  function setMusicDropdownOpen(isOpen) {
    musicTrackList.hidden = !isOpen;
    if (musicTrackListBackdrop) {
      musicTrackListBackdrop.hidden = !isOpen;
    }
    if (musicTrackScrollbar) {
      musicTrackScrollbar.hidden = !isOpen;
    }
    musicDropdownButton.setAttribute("aria-expanded", isOpen ? "true" : "false");
    if (isOpen) {
      requestAnimationFrame(updateMusicTrackScrollbar);
    }
  }

  function updateMusicTrackListUi() {
    musicTrackList.querySelectorAll(".music-track-item").forEach((item, index) => {
      item.classList.toggle("active", index === musicTrackIndex);
    });
    updateMusicTrackScrollbar();
  }

  function updateMusicTrackScrollbar() {
    if (!musicTrackList || !musicTrackScrollbar || !musicTrackScrollbarThumb || musicTrackList.hidden) {
      return;
    }

    const visibleHeight = musicTrackList.clientHeight;
    const scrollHeight = musicTrackList.scrollHeight;
    const canScroll = scrollHeight > visibleHeight + 1;
    if (musicTrackListBackdrop) {
      musicTrackListBackdrop.style.height = `${musicTrackList.offsetHeight}px`;
    }
    musicTrackScrollbar.hidden = !canScroll;
    if (!canScroll) {
      return;
    }

    const scrollMargin = 3;
    musicTrackScrollbar.style.height = `${musicTrackList.offsetHeight}px`;
    const thumbHeight = Math.max(28, (visibleHeight / scrollHeight) * visibleHeight);
    const maxThumbTop = visibleHeight - thumbHeight - scrollMargin * 2;
    const maxScrollTop = scrollHeight - visibleHeight;
    const thumbTop = scrollMargin + (maxScrollTop > 0 ? (musicTrackList.scrollTop / maxScrollTop) * maxThumbTop : 0);
    musicTrackScrollbarThumb.style.height = `${thumbHeight}px`;
    musicTrackScrollbarThumb.style.transform = `translateY(${thumbTop}px)`;
  }

  function onMusicPlayerPointerDown(event) {
    if (!canDragInSystem() || !musicPlayer || event.button !== 0) {
      return;
    }

    if (event.target.closest("button, input, .music-track-list, .music-track-scrollbar")) {
      return;
    }

    event.preventDefault();
    isDraggingMusicPlayer = true;
    setMusicDropdownOpen(false);
    const rect = musicPlayer.getBoundingClientRect();
    musicPlayerDragOffset.set(event.clientX - rect.left, event.clientY - rect.top);
    musicPlayer.setPointerCapture?.(event.pointerId);

    const onMove = (moveEvent) => {
      if (!isDraggingMusicPlayer) {
        return;
      }
      setSystemMusicPlayerPosition(
        moveEvent.clientX - musicPlayerDragOffset.x,
        moveEvent.clientY - musicPlayerDragOffset.y
      );
    };
    const onUp = (upEvent) => {
      isDraggingMusicPlayer = false;
      musicPlayer.releasePointerCapture?.(upEvent.pointerId);
      window.removeEventListener("pointermove", onMove);
      window.removeEventListener("pointerup", onUp);
      window.removeEventListener("pointercancel", onUp);
    };

    window.addEventListener("pointermove", onMove);
    window.addEventListener("pointerup", onUp);
    window.addEventListener("pointercancel", onUp);
  }

  function setSystemMusicPlayerPosition(left, top) {
    if (!musicPlayer) {
      return;
    }

    const width = musicPlayer.offsetWidth || 214;
    const height = musicPlayer.offsetHeight || 78;
    const clampedLeft = THREE.MathUtils.clamp(left, 0, Math.max(0, window.innerWidth - width));
    const clampedTop = THREE.MathUtils.clamp(top, 0, Math.max(0, window.innerHeight - height));
    systemMusicPlayerPosition = { left: clampedLeft, top: clampedTop };
    musicPlayer.style.setProperty("--system-player-left", `${clampedLeft}px`);
    musicPlayer.style.setProperty("--system-player-top", `${clampedTop}px`);
  }

  function ensureSystemMusicPlayerPosition() {
    if (!musicPlayer) {
      return;
    }

    if (!systemMusicPlayerPosition) {
      const left = 18;
      const top = 18 + 30 + 14;
      setSystemMusicPlayerPosition(left, top);
      return;
    }

    setSystemMusicPlayerPosition(systemMusicPlayerPosition.left, systemMusicPlayerPosition.top);
  }

  function onMusicScrollbarPointerDown(event) {
    if (!musicTrackList || !musicTrackScrollbar || !musicTrackScrollbarThumb) {
      return;
    }

    event.preventDefault();
    event.stopPropagation();
    musicTrackScrollbar.setPointerCapture?.(event.pointerId);

    const scrollbarRect = musicTrackScrollbar.getBoundingClientRect();
    const thumbRect = musicTrackScrollbarThumb.getBoundingClientRect();
    const grabOffset = event.clientY >= thumbRect.top && event.clientY <= thumbRect.bottom
      ? event.clientY - thumbRect.top
      : thumbRect.height / 2;

    const moveThumb = (clientY) => {
      const scrollMargin = 3;
      const visibleHeight = musicTrackList.clientHeight;
      const scrollHeight = musicTrackList.scrollHeight;
      const thumbHeight = musicTrackScrollbarThumb.offsetHeight;
      const maxThumbTop = visibleHeight - thumbHeight - scrollMargin * 2;
      const maxScrollTop = scrollHeight - visibleHeight;
      const thumbTop = THREE.MathUtils.clamp(clientY - scrollbarRect.top - grabOffset - scrollMargin, 0, maxThumbTop);
      musicTrackList.scrollTop = maxThumbTop > 0 ? (thumbTop / maxThumbTop) * maxScrollTop : 0;
    };

    const onMove = (moveEvent) => moveThumb(moveEvent.clientY);
    const onUp = (upEvent) => {
      musicTrackScrollbar.releasePointerCapture?.(upEvent.pointerId);
      window.removeEventListener("pointermove", onMove);
      window.removeEventListener("pointerup", onUp);
      window.removeEventListener("pointercancel", onUp);
    };

    moveThumb(event.clientY);
    window.addEventListener("pointermove", onMove);
    window.addEventListener("pointerup", onUp);
    window.addEventListener("pointercancel", onUp);
  }

  function seekMusicFromTrackButton(event) {
    if (!Number.isFinite(musicAudio.duration) || musicAudio.duration <= 0) {
      return;
    }

    const rect = musicTrackCurrent.getBoundingClientRect();
    const progress = THREE.MathUtils.clamp((event.clientX - rect.left) / rect.width, 0, 1);
    musicAudio.currentTime = progress * musicAudio.duration;
    musicTrackCurrent.style.setProperty("--music-progress", `${progress * 100}%`);
  }

  return {
    init,
    closeDropdown: () => setMusicDropdownOpen(false),
    cancelDrag: () => {
      isDraggingMusicPlayer = false;
    },
    ensureSystemPosition: ensureSystemMusicPlayerPosition,
    updateScrollbar: updateMusicTrackScrollbar,
  };
}
