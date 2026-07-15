const DEFAULT_CHANNELS = {
  ui: 0.72,
  ambient: 1,
};

export function createAudioMixer({
  masterVolume = 1,
  channels = DEFAULT_CHANNELS,
  sounds = {},
} = {}) {
  const AudioContextConstructor = window.AudioContext || window.webkitAudioContext;
  const context = AudioContextConstructor ? new AudioContextConstructor() : null;
  const buffers = new Map();
  const loading = new Map();
  const channelGains = new Map();
  const channelSources = new Map();
  const disabledChannels = new Set();
  const ambientMachines = new Map();
  let masterGain = null;

  if (context) {
    masterGain = context.createGain();
    masterGain.gain.value = clampVolume(masterVolume);
    masterGain.connect(context.destination);

    for (const [channel, volume] of Object.entries(channels)) {
      const gain = context.createGain();
      gain.gain.value = clampVolume(volume);
      gain.connect(masterGain);
      channelGains.set(channel, gain);
    }
  }

  function unlock() {
    if (!context || context.state !== "suspended") {
      return Promise.resolve();
    }
    return context.resume().catch(() => {});
  }

  function setMasterVolume(value) {
    if (!masterGain) {
      return;
    }
    masterGain.gain.value = clampVolume(value);
  }

  function setChannelVolume(channel, value) {
    const gain = getChannelGain(channel);
    if (!gain) {
      return;
    }
    gain.gain.value = disabledChannels.has(channel) ? 0 : clampVolume(value);
  }

  function setChannelEnabled(channel, enabled) {
    if (enabled) {
      disabledChannels.delete(channel);
      return;
    }

    disabledChannels.add(channel);
    setChannelVolume(channel, 0);
    stopChannel(channel);
  }

  function preload(name) {
    return loadBuffer(name).catch(() => null);
  }

  function preloadAll(names = Object.keys(sounds)) {
    return Promise.all(names.map(preload));
  }

  function play(name, {
    channel = "ui",
    volume = 1,
    playbackRate = 1,
    pan = 0,
    shouldPlay = null,
    onStart = null,
  } = {}) {
    if (!context) {
      return Promise.resolve(null);
    }

    return unlock()
      .then(() => {
        if (context.state !== "running" || disabledChannels.has(channel)) {
          return null;
        }
        return loadBuffer(name);
      })
      .then((buffer) => {
        if (!buffer || disabledChannels.has(channel) || (typeof shouldPlay === "function" && !shouldPlay())) {
          return null;
        }

        const source = context.createBufferSource();
        const gain = context.createGain();
        source.buffer = buffer;
        source.playbackRate.value = Math.max(0.01, Number(playbackRate) || 1);
        gain.gain.value = clampVolume(volume);
        const panner = createStereoPanner(context, pan);
        source.connect(panner ?? gain);
        if (panner) {
          panner.connect(gain);
        }
        gain.connect(getChannelGain(channel) ?? masterGain);
        const channelSourceSet = getChannelSourceSet(channel);
        channelSourceSet.add(source);
        source.addEventListener("ended", () => {
          channelSourceSet.delete(source);
          source.disconnect();
          panner?.disconnect();
          gain.disconnect();
        }, { once: true });
        if (typeof onStart === "function") {
          onStart(source);
        }
        if (disabledChannels.has(channel) || (typeof shouldPlay === "function" && !shouldPlay())) {
          channelSourceSet.delete(source);
          source.disconnect();
          panner?.disconnect();
          gain.disconnect();
          return null;
        }
        source.start();
        return source;
      })
      .catch(() => null);
  }

  function stopChannel(channel) {
    const sources = channelSources.get(channel);
    if (!sources) {
      return;
    }

    for (const source of sources) {
      try {
        source.stop();
      } catch {}
    }
    sources.clear();
  }

  function createAmbientMachine(id, {
    clips = [],
    channel = "ambient",
    streams = 1,
    volume = 1,
    initialDelayMs = 0,
    intervalMs = [4000, 9000],
    tracks = null,
    random = Math.random,
  } = {}) {
    stopAmbientMachine(id);
    const timers = new Set();
    const activeSources = new Set();
    let stopped = false;
    const trackStates = Array.isArray(tracks) && tracks.length > 0
      ? tracks.map((track) => createAmbientTrackState({
        clips: track.clips,
        channel: track.channel ?? channel,
        volume: track.volume ?? volume,
        pan: track.pan ?? 0,
        enabled: track.enabled ?? null,
        initialDelayMs: track.initialDelayMs ?? initialDelayMs,
        intervalMs: track.intervalMs ?? intervalMs,
        random,
      }))
      : Array.from({ length: Math.max(1, Math.floor(Number(streams) || 1)) }, () => createAmbientTrackState({
        clips,
        channel,
        volume,
        pan: 0,
        initialDelayMs,
        intervalMs,
        random,
      }));

    const machine = {
      start() {
        if (stopped || timers.size > 0 || trackStates.every((track) => track.clips.length === 0)) {
          return;
        }
        for (const track of trackStates) {
          if (track.clips.length > 0) {
            scheduleNext(track, getRandomInterval(track.initialDelayMs, random));
          }
        }
      },
      stop() {
        stopped = true;
        for (const timer of timers) {
          window.clearTimeout(timer);
        }
        timers.clear();
        for (const source of activeSources) {
          try {
            source.stop();
          } catch {}
        }
        activeSources.clear();
      },
    };

    function scheduleNext(track, delay) {
      if (stopped) {
        return;
      }

      const timer = window.setTimeout(() => {
        timers.delete(timer);
        if (!isAmbientTrackEnabled(track)) {
          scheduleNext(track, getRandomInterval(track.intervalMs, random));
          return;
        }
        const clip = getNextAmbientTrackClip(track);
        if (!clip) {
          scheduleNext(track, getRandomInterval(track.intervalMs, random));
          return;
        }
        play(clip, {
          channel: track.channel,
          volume: track.volume,
          pan: getAmbientTrackPan(track),
          shouldPlay: () => !stopped,
          onStart: (source) => {
            if (stopped) {
              try {
                source.stop();
              } catch {}
              return;
            }
            activeSources.add(source);
          },
        }).then((source) => {
          if (!source) {
            if (!stopped) {
              scheduleNext(track, getRandomInterval(track.intervalMs, random));
            }
            return;
          }
          if (stopped) {
            try {
              source.stop();
            } catch {}
            return;
          }
          source.addEventListener("ended", () => {
            activeSources.delete(source);
            if (!stopped) {
              scheduleNext(track, getRandomInterval(track.intervalMs, random));
            }
          }, { once: true });
        });
      }, delay);
      timers.add(timer);
    }

    ambientMachines.set(id, machine);
    return machine;
  }

  function stopAmbientMachine(id) {
    const machine = ambientMachines.get(id);
    if (!machine) {
      return;
    }
    machine.stop();
    ambientMachines.delete(id);
  }

  function dispose() {
    for (const id of ambientMachines.keys()) {
      stopAmbientMachine(id);
    }
    buffers.clear();
    loading.clear();
    for (const channel of channelSources.keys()) {
      stopChannel(channel);
    }
    channelSources.clear();
    if (context) {
      context.close().catch(() => {});
    }
  }

  function getChannelGain(channel) {
    if (!context) {
      return null;
    }

    if (!channelGains.has(channel)) {
      const gain = context.createGain();
      gain.gain.value = 1;
      gain.connect(masterGain);
      channelGains.set(channel, gain);
    }
    return channelGains.get(channel);
  }

  function loadBuffer(name) {
    if (!context) {
      return Promise.resolve(null);
    }

    const url = sounds[name] ?? name;
    if (buffers.has(url)) {
      return Promise.resolve(buffers.get(url));
    }
    if (loading.has(url)) {
      return loading.get(url);
    }

    const request = fetch(url)
      .then((response) => {
        if (!response.ok) {
          throw new Error(`Unable to load audio: ${url}`);
        }
        return response.arrayBuffer();
      })
      .then((data) => context.decodeAudioData(data))
      .then((buffer) => {
        buffers.set(url, buffer);
        loading.delete(url);
        return buffer;
      })
      .catch((error) => {
        loading.delete(url);
        throw error;
      });
    loading.set(url, request);
    return request;
  }

  function getChannelSourceSet(channel) {
    if (!channelSources.has(channel)) {
      channelSources.set(channel, new Set());
    }
    return channelSources.get(channel);
  }

  return {
    unlock,
    preload,
    preloadAll,
    play,
    setMasterVolume,
    setChannelVolume,
    setChannelEnabled,
    stopChannel,
    createAmbientMachine,
    stopAmbientMachine,
    dispose,
  };
}

function clampVolume(value) {
  return Math.min(1, Math.max(0, Number(value) || 0));
}

function getRandomInterval(intervalMs, random) {
  if (typeof intervalMs === "function") {
    try {
      return getRandomInterval(intervalMs(), random);
    } catch {
      return 0;
    }
  }
  if (Array.isArray(intervalMs)) {
    const min = Number(intervalMs[0]) || 0;
    const max = Number(intervalMs[1]) || min;
    return min + Math.max(0, max - min) * random();
  }
  return Math.max(0, Number(intervalMs) || 0);
}

function createAmbientTrackState({
  clips = [],
  channel,
  volume,
  pan,
  enabled,
  initialDelayMs,
  intervalMs,
  random,
}) {
  return {
    clips: Array.isArray(clips) ? clips.filter(Boolean) : [],
    channel,
    volume,
    pan,
    enabled,
    initialDelayMs,
    intervalMs,
    random,
    playlist: [],
    panIndex: 0,
  };
}

function isAmbientTrackEnabled(track) {
  if (typeof track.enabled !== "function") {
    return track.enabled !== false;
  }
  try {
    return track.enabled() !== false;
  } catch {
    return false;
  }
}

function getNextAmbientTrackClip(track) {
  if (track.clips.length === 0) {
    return null;
  }
  if (track.playlist.length === 0) {
    track.playlist = shuffleAmbientClips(track.clips, track.random);
  }
  return track.playlist.shift() ?? null;
}

function shuffleAmbientClips(clips, random) {
  const shuffled = [...clips];
  for (let index = shuffled.length - 1; index > 0; index -= 1) {
    const nextIndex = Math.floor(random() * (index + 1));
    [shuffled[index], shuffled[nextIndex]] = [shuffled[nextIndex], shuffled[index]];
  }
  return shuffled;
}

function getAmbientTrackPan(track) {
  if (!Array.isArray(track.pan)) {
    return clampPan(track.pan);
  }
  if (track.pan.length === 0) {
    return 0;
  }
  const pan = track.pan[track.panIndex % track.pan.length];
  track.panIndex += 1;
  return clampPan(pan);
}

function createStereoPanner(context, pan) {
  if (typeof context.createStereoPanner !== "function") {
    return null;
  }
  const panner = context.createStereoPanner();
  panner.pan.value = clampPan(pan);
  return panner;
}

function clampPan(value) {
  return Math.min(1, Math.max(-1, Number(value) || 0));
}
