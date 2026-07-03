const CHATTER_BASE_PATH = "/Sounds/Ambient machine";

const CHATTER_1_CLIPS = createNumberedClips(`${CHATTER_BASE_PATH}/Chatter1`, "ch1", 18);
const CHATTER_2_CLIPS = createNumberedClips(`${CHATTER_BASE_PATH}/Chatter2`, "ch2", 19);

export const RADIO_CHATTER_FEED_MACHINE = {
  id: "radioChatterFeed",
  label: "Radio Chatter Feed",
  channel: "menuEnvironment",
  tracks: [
    {
      id: "ch1",
      clips: CHATTER_1_CLIPS,
      volume: 0.15,
      pan: [-0.92, 0.92],
      initialDelayMs: [1000, 8000],
      intervalMs: [10000, 20000],
    },
    {
      id: "ch2",
      clips: CHATTER_2_CLIPS,
      volume: 0.05,
      initialDelayMs: [1000, 8000],
      intervalMs: [3000, 7000],
    },
  ],
};

function createNumberedClips(basePath, prefix, count) {
  return Array.from(
    { length: count },
    (_, index) => `${basePath}/${prefix}-${String(index + 1).padStart(2, "0")}.mp3`,
  );
}
