import "./styles.css";
import * as THREE from "three";
import {
  GRAVITY_BASE_VALUES,
  MENU_MUSIC_TRACK,
  MAX_SELECTION_FADING_SEGMENTS,
  MAX_SELECTION_POINTS,
  MAX_SELECTION_SEGMENTS,
  MOON_SIZE_NAMES,
  MUSIC_TRACKS,
  PLANET_SIZE_NAMES,
  PLANET_STAGE_CONTENT_RADIUS,
  PLANET_STAGE_HEIGHT,
  PLANET_STAGE_WIDTH,
  STAR_TEMPERATURE_RANGES,
  ZONE_DATA,
} from "./constants.js";
import {
  createAdjacency,
  createLinks,
  createNodes,
  createOuterLinks,
  createStarName,
} from "./graph/generate.js";
import { createPlanetNameService } from "./planet/names.js";
import { GAS_GIANT_WINDOW_TEXTURE_HEIGHT, createGasGiantTexture } from "./planet/gasGiantTexture.js";
import { createPlanetTexture } from "./planet/planetTexture.js";
import { createPlanetRotationState } from "./planet/rotation.js";
import { createPlanetScreenController } from "./screens/planetScreen.js";
import { createSystemScreenController } from "./screens/systemScreen.js";
import { RADIO_CHATTER_FEED_MACHINE } from "./audio/ambientMachines.js";
import { createAudioMixer } from "./audio/audioMixer.js";
import { openColorPicker } from "./ui/colorPicker.js";
import { createMusicPlayer } from "./ui/musicPlayer.js";
import { hexToRgba, lightenHexColor } from "./utils/color.js";
import { easeOutCubic, smoothstep } from "./utils/math.js";
import { createRandom } from "./utils/random.js";
import {
  clearTextureRuntimeCache,
  getRetainedCanvasTexture,
  releaseCanvasTexture,
  retainCanvasTexture,
} from "./utils/textureCache.js";
import femaleFleetCommanderNamesRaw from "../1000_female_names_latin.txt?raw";
import maleFleetCommanderNamesRaw from "../1000_male_names_latin.txt?raw";
import fleetCommanderSurnamesRaw from "../1000_surnames_latin.txt?raw";

const params = new URLSearchParams(window.location.search);
const SEED = params.get("seed") || "nebulum";
const MENU_DEFAULT_SEED = "nebulum";
const APP_LAUNCH_PARAM = "nebulumApp";
const START_AFTER_SEED_STORAGE_KEY = "nebulum:start-after-seed";
const START_AFTER_SAVE_STATE_STORAGE_KEY = "nebulum:start-after-save-state";
const START_AFTER_RUNTIME_SESSION_STORAGE_KEY = "nebulum:start-after-runtime-session";
const AUDIO_SETTINGS_STORAGE_KEY = "nebulum:audio-settings";
const GAME_UI_SETTINGS_STORAGE_KEY = "nebulum:game-ui-settings";
const WINDOW_SETTINGS_STORAGE_KEY = "nebulum:window-settings";
const PWA_INSTALL_STORAGE_KEY = "nebulum:pwa-installed";
const LEGACY_SAVE_STORAGE_KEY = "nebulum:saves";
const SAVE_STORAGE_KEY = "nebulum:saves:v2";
const SAVE_INDEX_STORAGE_KEY = "nebulum:saves:index:v1";
const SAVE_FILE_STORAGE_PREFIX = "nebulum:saves:file:";
const SAVE_FOLDER_NAME = "saves";
const RUNTIME_SESSION_STORAGE_KEY = "nebulum:runtime-session";
const DEFAULT_TURN_NUMBER = 1;
const DEFAULT_PLAYER_ID = "player-1";
const FLEET_SYSTEM_MOVES_PER_TURN = 4;
const FLEET_LINK_MOVES_PER_TURN = 2;
const FLEET_ACTION_GRID_COLUMNS = 3;
const FLEET_ACTION_GRID_ROWS = 3;
const FLEET_SYSTEM_SLOT_COUNT = 8;
const FLEET_SYSTEM_OUTER_SLOT_COUNT = 10;
const FLEET_SYSTEM_MARKER_WIDTH = 38;
const FLEET_SYSTEM_MARKER_HEIGHT = 16;
const FLEET_SYSTEM_MARKER_STACK_GAP = 18;
const FLEET_LINK_JUMP_DELAY_MS = 1000;
const FLEET_LINK_JUMP_EFFECT_MS = 620;
const FLEET_COMMANDER_MALE_NAMES = parseNameDictionary(maleFleetCommanderNamesRaw, ["Alex"]);
const FLEET_COMMANDER_FEMALE_NAMES = parseNameDictionary(femaleFleetCommanderNamesRaw, ["Alex"]);
const FLEET_COMMANDER_SURNAMES = parseNameDictionary(fleetCommanderSurnamesRaw, ["Vega"]);
const UI_HOVER_SOUND = "ui.hover.quiet";
const UI_MENU_CLICK_SOUND = "ui.menu.click";
const UI_BASE_CLICK_SOUND = "ui.base.click";
const UI_CANCEL_CLICK_SOUND = "ui.cancel.click";
const UI_SCROLL_CLICK_SOUND = "ui.scroll.click";
const UI_TURN_SOUND = "ui.turn";
const FLEET_VOICE_COMMON_SOUNDS = [
  "/Sounds/IngameUI/FleetVoices/NebFleetSelect.mp3",
];
const FLEET_VOICE_FEMALE_SOUNDS = [
  "/Sounds/IngameUI/FleetVoices/NebFemaleFleetSelect7.mp3",
  "/Sounds/IngameUI/FleetVoices/NebFemFleetSelect1.mp3",
  "/Sounds/IngameUI/FleetVoices/NebFemFleetSelect2.mp3",
  "/Sounds/IngameUI/FleetVoices/NebFemFleetSelect3.mp3",
  "/Sounds/IngameUI/FleetVoices/NebFemFleetSelect4.mp3",
  "/Sounds/IngameUI/FleetVoices/NebFemFleetSelect5.mp3",
  "/Sounds/IngameUI/FleetVoices/NebFemFleetSelect6.mp3",
  ...FLEET_VOICE_COMMON_SOUNDS,
];
const FLEET_VOICE_MALE_SOUNDS = [
  "/Sounds/IngameUI/FleetVoices/NebMaleFleetSelect1.mp3",
  "/Sounds/IngameUI/FleetVoices/NebMaleFleetSelect2.mp3",
  "/Sounds/IngameUI/FleetVoices/NebMaleFleetSelect3.mp3",
  "/Sounds/IngameUI/FleetVoices/NebMaleFleetSelect4.mp3",
  "/Sounds/IngameUI/FleetVoices/NebMaleFleetSelect5.mp3",
  "/Sounds/IngameUI/FleetVoices/NebMaleFleetSelect6.mp3",
  ...FLEET_VOICE_COMMON_SOUNDS,
];
const FLEET_VOICE_SOUNDS = [
  ...FLEET_VOICE_FEMALE_SOUNDS,
  ...FLEET_VOICE_MALE_SOUNDS.filter((sound) => !FLEET_VOICE_FEMALE_SOUNDS.includes(sound)),
];
const FLEET_MOVE_SOUNDS = [
  "/Sounds/IngameUI/FleetMove/NebFleetMove1.mp3",
  "/Sounds/IngameUI/FleetMove/NebFleetMove2.mp3",
  "/Sounds/IngameUI/FleetMove/NebFleetMove3.mp3",
  "/Sounds/IngameUI/FleetMove/NebFleetMove4.mp3",
  "/Sounds/IngameUI/FleetMove/NebFleetMove5.mp3",
];
const FLEET_LINK_JUMP_SOUND = "/Sounds/IngameUI/FleetMove/NebLinkJump.mp3";
const UI_SOUNDS = {
  [UI_HOVER_SOUND]: "/Sounds/UI/NebHoverQuiet.mp3",
  [UI_MENU_CLICK_SOUND]: "/Sounds/UI/NebMenuClick.mp3",
  [UI_BASE_CLICK_SOUND]: "/Sounds/UI/NebBaseClick.mp3",
  [UI_CANCEL_CLICK_SOUND]: "/Sounds/UI/NebCancelClick.mp3",
  [UI_SCROLL_CLICK_SOUND]: "/Sounds/UI/Neb.ScrollClick.mp3",
  [UI_TURN_SOUND]: "/Sounds/IngameUI/Neb.Turn.mp3",
};
const UI_HOVER_SOUND_SELECTOR = [
  ".start-menu__button",
  ".menu-dialog__button",
  ".new-game__scenario-current",
  ".new-game__scenario-dropdown",
  ".new-game__scenario-item",
  ".new-game__mode-toggle",
  ".new-game__government-current",
  ".new-game__government-dropdown",
  ".new-game__government-item",
  ".new-game__inline-button",
  ".new-game__faction-card",
  ".new-game__faction-government-current",
  ".new-game__faction-government-item",
  ".menu-save-list__item",
  ".game-menu-button",
  ".game-breadcrumb-button",
  ".game-ui-panel__button",
  ".sign-turn-button",
  ".system-planet-menu__button",
].join(",");
const UI_MENU_CLICK_SOUND_SELECTOR = [
  ".start-menu__button",
  ".menu-dialog__button",
  ".new-game__scenario-current",
  ".new-game__scenario-dropdown",
  ".new-game__scenario-item",
  ".new-game__mode-toggle",
  ".new-game__government-current",
  ".new-game__government-dropdown",
  ".new-game__government-item",
  ".new-game__inline-button",
  ".new-game__faction-card",
  ".new-game__faction-government-current",
  ".new-game__faction-government-item",
  ".menu-save-list__item",
].join(",");
const UI_SCROLL_CLICK_SOUND_SELECTOR = [
  ".music-track-item",
  ".new-game__scenario-item",
  ".new-game__government-item",
  ".new-game__faction-government-item",
].join(",");
const UI_BASE_CLICK_SOUND_SELECTOR = [
  ".new-game__scenario-current",
  ".new-game__scenario-dropdown",
  ".new-game__scenario-item",
  ".new-game__mode-toggle",
  ".new-game__government-current",
  ".new-game__government-dropdown",
  ".new-game__government-item",
  ".new-game__faction-color",
  ".new-game__faction-card",
  ".new-game__faction-government-current",
  ".system-planet-menu__button",
].join(",");
const MENU_ENVIRONMENT_AUDIO_CHANNEL = "menuEnvironment";
const LEGACY_ENVIRONMENT_AUDIO_CHANNEL = "environment";
const NEBULUM_LOCAL_PORTS = Array.from({ length: 11 }, (_, index) => 4173 + index);
const DEFAULT_SKY_GRADIENT_COLORS = ["#27648f", "#000000", "#884d26", "#000000"];
const FOG_SELECTION_GROUP_KEY = "__nebulum_fog__";
const FOG_SELECTION_COLOR = "#000000";
const FOG_SELECTION_OPACITY = 0.18;
const PLANET_WATER_TAG_CHANCE = 0.5;
const ATMOSPHERE_TAGS = ["THIN ATMOSPHERE", "ATMOSPHERE", "DENSE ATMOSPHERE"];
const ATMOSPHERE_TEMPERATURE_MULTIPLIERS = {
  "THIN ATMOSPHERE": [1, 1.2],
  "ATMOSPHERE": [1.2, 1.8],
  "DENSE ATMOSPHERE": [1.8, 3],
};
const TIDAL_COMBINE_MAX_TEMPERATURE = 4000;
let glowTexture = null;
let linkPulseTexture = null;
let blackHoleDiskTexture = null;
let blackHoleDiskMaterial = null;
const runtimeLoadingOverlay = document.querySelector("#runtime-loading-overlay");
const startMenu = document.querySelector("#start-menu");
const menuNewGame = document.querySelector("#menu-new-game");
const menuLoadGame = document.querySelector("#menu-load-game");
const menuSettings = document.querySelector("#menu-settings");
const menuExit = document.querySelector("#menu-exit");
const menuStatus = document.querySelector("#menu-status");
const seedDialog = document.querySelector("#seed-dialog");
const menuSeedInput = document.querySelector("#menu-seed-input");
const menuSeedConfirm = document.querySelector("#menu-seed-confirm");
const menuSeedCancel = document.querySelector("#menu-seed-cancel");
const menuSessionMode = document.querySelector("#menu-session-mode");
const menuScenarioCurrent = document.querySelector("#menu-scenario-current");
const menuScenarioDropdown = document.querySelector("#menu-scenario-dropdown");
const menuScenarioListBackdrop = document.querySelector("#menu-scenario-list-backdrop");
const menuScenarioList = document.querySelector("#menu-scenario-list");
const menuScenarioScrollbar = document.querySelector("#menu-scenario-scrollbar");
const menuScenarioScrollbarThumb = document.querySelector("#menu-scenario-scrollbar-thumb");
const menuScenarioImage = document.querySelector("#menu-scenario-image");
const menuScenarioText = document.querySelector("#menu-scenario-text");
const menuFactionCount = document.querySelector("#menu-faction-count");
const menuFactionLimit = document.querySelector("#menu-faction-limit");
const menuPlayerFactionName = document.querySelector("#menu-player-faction-name");
const menuPlayerFactionColor = document.querySelector("#menu-player-faction-color");
const menuGovernmentCurrent = document.querySelector("#menu-government-current");
const menuGovernmentDropdown = document.querySelector("#menu-government-dropdown");
const menuGovernmentList = document.querySelector("#menu-government-list");
const menuGovernmentImage = document.querySelector("#menu-government-image");
const menuGovernmentText = document.querySelector("#menu-government-text");
const menuFactionGrid = document.querySelector("#menu-faction-grid");
const menuNewGameApply = document.querySelector("#menu-new-game-apply");
const loadDialog = document.querySelector("#load-dialog");
const menuSaveList = document.querySelector("#menu-save-list");
const menuLoadSave = document.querySelector("#menu-load-save");
const menuDeleteSave = document.querySelector("#menu-delete-save");
const menuLoadClose = document.querySelector("#menu-load-close");
const settingsDialog = document.querySelector("#settings-dialog");
const menuMasterVolume = document.querySelector("#menu-master-volume");
const menuEnvironmentVolume = document.querySelector("#menu-environment-volume");
const menuMusicEnabled = document.querySelector("#menu-music-enabled");
const menuShowMusicPlayer = document.querySelector("#menu-show-music-player");
const menuBorderlessWindow = document.querySelector("#menu-borderless-window");
const menuOpenEditor = document.querySelector("#menu-open-editor");
const menuSettingsClose = document.querySelector("#menu-settings-close");
const gameMenuButton = document.querySelector("#game-menu-button");
const gameMenuDialog = document.querySelector("#game-menu-dialog");
const gameSaveGame = document.querySelector("#game-save-game");
const gameMainMenu = document.querySelector("#game-main-menu");
const gameSettings = document.querySelector("#game-settings");
const gameSaveDialog = document.querySelector("#game-save-dialog");
const gameSaveList = document.querySelector("#game-save-list");
const gameSaveAdd = document.querySelector("#game-save-add");
const gameSaveConfirm = document.querySelector("#game-save-confirm");
const gameDeleteSave = document.querySelector("#game-delete-save");
const gameSaveClose = document.querySelector("#game-save-close");
const gameSettingsDialog = document.querySelector("#game-settings-dialog");
const gameMasterVolume = document.querySelector("#game-master-volume");
const gameEnvironmentVolume = document.querySelector("#game-environment-volume");
const gameMenuMusicEnabled = document.querySelector("#game-menu-music-enabled");
const gameShowMusicPlayer = document.querySelector("#game-show-music-player");
const gameSpaceGradientSetting = document.querySelector("#game-space-gradient-setting");
const gameSpaceGradientEnabled = document.querySelector("#game-space-gradient-enabled");
const gameBorderlessWindow = document.querySelector("#game-borderless-window");
const gameSettingsClose = document.querySelector("#game-settings-close");
const signTurnButton = document.querySelector("#sign-turn-button");
const turnOrderTrack = document.querySelector("#turn-order-track");
const fleetActionPanel = document.querySelector("#fleet-action-panel");
const gameBreadcrumbStarmap = document.querySelector("#game-breadcrumb-starmap");
const gameBreadcrumbSystem = document.querySelector("#game-breadcrumb-system");
const gameBreadcrumbOrbit = document.querySelector("#game-breadcrumb-orbit");
const gameBreadcrumbButtons = [
  gameBreadcrumbStarmap,
  gameBreadcrumbSystem,
  gameBreadcrumbOrbit,
].filter(Boolean);
const sceneCanvas = document.querySelector("#scene");
const starLabels = document.querySelector("#star-labels");
const hoverNameWrap = document.querySelector("#hover-name-wrap");
const hoverName = document.querySelector("#hover-name");
const hoverPanel = document.querySelector("#hover-panel");
const tooltipType = document.querySelector("#tooltip-type");
const tooltipPlanets = document.querySelector("#tooltip-planets");
const seedInput = document.querySelector("#seed-input");
const regenerateButton = document.querySelector("#regenerate-button");
const currentColorSwatch = document.querySelector("#current-color-swatch");
const currentColorValue = document.querySelector("#current-color-value");
const usedColors = document.querySelector("#used-colors");
const clearButton = document.querySelector("#clear-button");
const editorSaveButton = document.querySelector("#editor-save-button");
const maskToolToggle = document.querySelector("#mask-tool-toggle");
const skyGradientColorsElement = document.querySelector("#sky-gradient-colors");
const starWindow = document.querySelector("#star-window");
const systemGlow = document.querySelector("#system-glow");
const systemStars = document.querySelector("#system-stars");
const starSystem = document.querySelector("#star-system");
const systemStarLayer = document.querySelector("#system-star-layer");
const systemParticles = document.querySelector("#system-particles");
const systemHoverNameWrap = document.querySelector("#system-hover-name-wrap");
const systemHoverName = document.querySelector("#system-hover-name");
const systemHoverPanel = document.querySelector("#system-hover-panel");
const systemTooltipBody = document.querySelector("#system-tooltip-body");
const systemTitle = document.querySelector("#system-title");
const backToStarmapButton = document.querySelector("#back-to-starmap");
const toggleTidalZone = document.querySelector("#toggle-tidal-zone");
const toggleHzZone = document.querySelector("#toggle-hz-zone");
const planetWindow = document.querySelector("#planet-window");
const planetWindowClose = document.querySelector("#planet-window-close");
const planetWindowTitle = document.querySelector("#planet-window-title");
const planetWindowSize = document.querySelector("#planet-window-size");
const planetWindowStage = document.querySelector("#planet-window-stage");
const planetWindowLore = document.querySelector("#planet-window-lore");
const planetWindowDivider = document.querySelector("#planet-window-divider");
const planetWindowTags = document.querySelector("#planet-window-tags");
const planetLinkPath = document.querySelector("#planet-link-path");
const planetScreen = document.querySelector("#planet-screen");
const planetScreenBackStarmap = document.querySelector("#planet-screen-back-starmap");
const planetScreenBackSystem = document.querySelector("#planet-screen-back-system");
const objectDetailScreen = document.querySelector("#object-detail-screen");
const objectDetailTexture = document.querySelector("#object-detail-texture");
const objectDetailBackStarmap = document.querySelector("#object-detail-back-starmap");
const objectDetailBackSystem = document.querySelector("#object-detail-back-system");
const objectDetailBackOrbit = document.querySelector("#object-detail-back-orbit");
const systemTransitionOverlay = document.createElement("div");
systemTransitionOverlay.className = "system-transition-overlay";
starWindow.append(systemTransitionOverlay);
const planetEntryOverlay = document.createElement("div");
planetEntryOverlay.className = "planet-entry-overlay";
planetEntryOverlay.innerHTML = `
  <div class="planet-entry-card" aria-hidden="true">
    <div class="planet-entry-name"></div>
    <div class="planet-entry-line"></div>
    <div class="planet-entry-type"></div>
  </div>
`;
starWindow.append(planetEntryOverlay);
const graphEntryOverlay = document.createElement("div");
graphEntryOverlay.className = "graph-entry-overlay";
document.querySelector("#app").append(graphEntryOverlay);
const objectDetailEntryOverlay = document.createElement("div");
objectDetailEntryOverlay.className = "object-detail-entry-overlay";
document.querySelector("#app").append(objectDetailEntryOverlay);
const systemPlanetMenu = document.createElement("div");
systemPlanetMenu.className = "system-planet-menu";
systemPlanetMenu.hidden = true;
systemPlanetMenu.setAttribute("aria-hidden", "true");
starWindow.append(systemPlanetMenu);

const NEW_GAME_BASIC_SCENARIO_ID = "basic";
const NEW_GAME_DEFAULT_FACTION_COUNT = 4;
const NEW_GAME_MAX_SIDE_COUNT = 16;
const NEW_GAME_FACTION_RENDER_LIMIT = NEW_GAME_MAX_SIDE_COUNT;
const NEW_GAME_DEFAULT_PLAYER_FACTION_NAME = "Wanderers";
const NEW_GAME_DEFAULT_PLAYER_FACTION_COLOR = "#00e1ff";
const NEW_GAME_MODE_HOTSEAT = "hotseat";
const NEW_GAME_MODE_ONLINE = "online";
const NEW_GAME_DEFAULT_GOVERNMENT_ID = "company";
const NEW_GAME_GOVERNMENTS = {
  company: {
    id: "company",
    label: "COMPANY",
    image: "/pics/governments/COMPANY.png",
    text: "A company provides a set of rules and confident management of resources between planets while preserving the autonomy of local administrations. This is the most common form of governance across the vast expanse of humanity.",
  },
  monarcy: {
    id: "monarcy",
    label: "MONARCY",
    image: "/pics/governments/MONARCY.png",
    text: "A monarchy is power. Your power. You can do anything as long as your people obey you. All your planets belong to you personally. Local currencies are your money. Every forest, ocean, mountain, gas giant, and star within your borders — all of it is yours. If you can manage to keep it.",
  },
  community: {
    id: "community",
    label: "COMMUNITY",
    image: "/pics/governments/COMMUNITY.png",
    text: "This is anarchy. You are more of an administrator and a conduit for the will of the people. What kind of loyalty are we even talking about here? It is less a unified state and more a group of communities that have joined together simply to avoid being swept away by some stronger player. You will have to work with whatever the people are willing to give you.",
  },
  raiders: {
    id: "raiders",
    label: "RAIDERS",
    image: "/pics/governments/RAIDERS.png",
    text: "Raiders do not need planets. They need what planets produce. Well, technically, you do need one planet. Preferably somewhere your enemies will never find it.\n\nPillage is your way of life. Steal and take everything you can get your hands on. Find yourself a hidden corner of the galaxy, establish your own personal Tortuga, and live free!",
  },
};
const NEW_GAME_SCENARIOS = {
  basic: {
    id: "basic",
    label: "BASIC",
    image: "/pics/scenarios/basic.png",
    text: "Welcome to the new Nebulum: empty and unexplored. Of course, the history of humanity is vast, and perhaps people have been here before at some point, but certainly not in the present day. All paths are open, and no one knows what awaits you in this constellation.\n\nYour fleet, your people, and the technologies you brought with you from wherever you came from into this new Nebulum are the only things you have. The first thing you must do is find a planet you can call home.\n\nComplete freedom. No one lays claim to this region of space except you and others like you: fleets of cosmic wanderers drifting through wormholes, hoping that one day they will look out upon their vast space empire.",
    maxFactions: (seed) => getBasicScenarioFactionLimit(seed),
  },
  homeworld: {
    id: "homeworld",
    label: "HOMEWORLD",
    image: "/pics/scenarios/homeworld.png",
    text: "You have lived here for a long time. Your home is what it is. The truth is, you never had the means to build a spaceport and reach the stars.\nAt last, you have succeeded.\nNow you can look up with pride at the tiny sparks of spacecraft above: the ships of your first fleet.\n\nYour native Nebulum... who else dwells here? Others like you, fragments of humanity forgotten on wretched planets? Or were some more fortunate? The time has come to find out. The time has come to call the entire Nebulum your home, not just one tiny point on the map.\n\nOr at least to try.",
    maxFactions: () => Infinity,
  },
};

let isStartMenuOpen = true;
let isAppExited = false;
let isEditorMode = false;
let isGameRuntimeReady = false;
let animationFrameId = null;
let menuAnimationFrameId = null;
let menuMusicFadeFrame = null;
let isReturningToMainMenu = false;
let audioSettings = readAudioSettings();
let gameUiSettings = readGameUiSettings();
let windowSettings = readWindowSettings();
let audioMixer = null;
let menuEnvironmentMachine = null;
let isMenuEnvironmentAudioEnabled = false;
let deferredInstallPrompt = null;
let pwaMenuAction = isNebulumAppWindow() ? "exit" : "install";
let borderlessBoundsSyncTimer = null;
let lastBorderlessBoundsSyncAt = 0;
let ignoreBorderlessKeySyncUntil = 0;
let activeUiHoverSoundElement = null;
let fleetMoveSoundDeck = [];
let lastFleetMoveSound = null;
let selectedMenuSaveIndex = -1;
let selectedGameSaveIndex = -1;
let isAddingGameSave = false;
let gameSaveDraftName = "";
let pendingStartGameState = null;
let pendingRuntimeSession = null;
let currentGameState = createEmptyGameState();
let selectedFleetId = null;
let activeSystemFleetAnchors = [];
let activeSystemPlanetMenuPlanet = null;
let fleetMarkerPositions = new Map();
let fleetMarkerAnimations = new Map();
let systemFleetAnchorDriftSpecs = new Map();
let pendingFleetLinkJumpIds = new Set();
let fleetLinkJumpTimers = new Map();
let fleetMovementSerial = 0;
let suppressFleetMarkerAnimation = false;
let starmapFleetMarkerElements = new Map();
let starmapFleetMarkerPositions = new Map();
let starmapFleetMarkerAnimations = new Map();
let pendingStarmapFleetMarkerPaths = new Map();
let systemDecorTrailLayer = null;
let systemDecorTrailRandom = null;
let systemDecorTrailSerial = 0;
let systemDecorTrails = [];
let systemDecorTrailSchedules = new Map();
let shouldStartGameAfterInit = false;
let isRuntimeSessionRedirecting = false;
let runtimeLoadingHideTimer = null;
let lastGameNavigationUiKey = "";
let selectedNewGameScenarioId = NEW_GAME_BASIC_SCENARIO_ID;
let newGameFactionCount = NEW_GAME_DEFAULT_FACTION_COUNT;
let newGamePlayerFactionName = NEW_GAME_DEFAULT_PLAYER_FACTION_NAME;
let newGamePlayerFactionColor = NEW_GAME_DEFAULT_PLAYER_FACTION_COLOR;
let selectedNewGamePlayerSideIndex = 0;
let selectedNewGameSideIndex = 0;
let pendingNewGameFactionNameFocusIndex = null;
let newGameSessionMode = NEW_GAME_MODE_HOTSEAT;
let selectedNewGameGovernmentId = NEW_GAME_DEFAULT_GOVERNMENT_ID;
let newGameAppliedState = null;
let isNewGameSetupDirty = true;
let newGameSideConfigs = [];
let newGameSideConfigSeed = "";
let menuScene = null;
let menuCamera = null;
let menuSky = null;
let menuGroup = null;
let menuPlane = null;
let menuPlaneTexture = null;
let menuPlaneCanvas = null;
let menuPlaneContext = null;
let menuBackgroundTarget = null;
let menuCompositeScene = null;
let menuCompositeCamera = null;
let menuCompositeMaterial = null;
let menuCompositeQuad = null;
let menuStars = null;
let menuStarLinks = null;
let menuStarPoints = [];
let menuStarTrailIndices = [];
let menuStarPilots = [];
let menuStarPilotSerial = 0;
let menuStarGlowTexture = null;
let menuActiveButton = null;
let menuButtonRects = [];
let menuRotationTargetX = 0;
let menuRotationTargetY = 0;
let menuStarsRotationTargetX = 0;
let menuStarsRotationTargetY = 0;
let menuLastFrameTime = performance.now();
const menuRaycaster = new THREE.Raycaster();
const menuPointer = new THREE.Vector2();
const MENU_TEXTURE_WIDTH = 1440;
const MENU_TEXTURE_HEIGHT = 1020;
const MENU_PLANE_WIDTH = 7.2;
const MENU_PLANE_HEIGHT = 5.1;
const MENU_STAR_LINK_COLOR = 0xbfeaff;
const MENU_STAR_LINK_MAX_DISTANCE = 5.8;
const MENU_STAR_LINK_MIN_DISTANCE = 1.35;
const MENU_STAR_LINK_SPEED_SCALE = 5;
const MENU_STAR_LINK_TRAIL_DEPTH = 5;
const MENU_STAR_PILOT_INITIAL_COUNT = 3;
const MENU_STAR_PILOT_MIN_COUNT = 5;
const MENU_STAR_PILOT_MAX_COUNT = 10;
const MENU_STAR_PILOT_BRANCH_CHANCE = 0.32;
const MENU_STAR_PILOT_STOP_CHANCE = 0.13;
const MENU_BUTTON_BLUR_MAX_RECTS = 8;
const SVG_NAMESPACE = "http://www.w3.org/2000/svg";

const renderer = new THREE.WebGLRenderer({
  canvas: sceneCanvas,
  antialias: true,
  alpha: true,
});
const menuMusicAudio = new Audio(`/Music/${encodeURIComponent(MENU_MUSIC_TRACK)}`);
menuMusicAudio.loop = true;
menuMusicAudio.preload = "auto";
menuMusicAudio.volume = getMenuMusicVolume();
renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
renderer.setClearColor(0x000000, 0);
renderer.outputColorSpace = THREE.SRGBColorSpace;
renderer.autoClear = false;
sceneCanvas.addEventListener("webglcontextlost", (event) => {
  event.preventDefault();
  if (isAppExited) {
    return;
  }
  document.body.classList.add("webgl-context-lost");
  window.setTimeout(() => window.location.reload(), 400);
});
sceneCanvas.addEventListener("webglcontextrestored", () => {
  if (isAppExited) {
    return;
  }
  window.location.reload();
});

let scene = null;
let camera = null;
const INITIAL_CAMERA_DISTANCE = 12;
const MIN_CAMERA_DISTANCE = 7.2;
const MAX_CAMERA_DISTANCE = 20;

let graphRoot = null;
let ambient = null;
let keyLight = null;
let planetNameService = null;
let planetNameAssignments = new Map();
let nodes = [];
let links = [];
let outerLinks = [];
let adjacency = new Map();
const nodeMeshes = [];
const labelElements = [];
const hitTargets = [];
const raycaster = new THREE.Raycaster();
const screenHitProjection = new THREE.Vector3();
const starLabelProjection = new THREE.Vector3();
const pointer = new THREE.Vector2(10, 10);
const lastClientPointer = new THREE.Vector2(window.innerWidth / 2, window.innerHeight / 2);
const rotationVelocity = new THREE.Vector2(0, 0);
const targetRotation = new THREE.Euler(-0.18, 0.36, 0, "YXZ");
let linkPulse = null;

let isDragging = false;
let activeGraphPointerId = null;
let lastPointer = new THREE.Vector2();
let pointerDownPosition = new THREE.Vector2();
let hoveredNode = null;
let currentMaskColor = "#00e1ff";
let isMaskToolEnabled = false;
let isPlanetEntryTransitioning = false;
let planetEntryTransitionToken = 0;
const gasGiantTextureLayers = new Set();
const planetSurfaceRotationLayers = new Set();
const SYSTEM_PLANET_ROTATION_DISPLAY_SCALE = 3.14;
const PLANET_ENTRY_MIN_OVERLAY_MS = 1500;
const PLANET_ENTRY_ZOOM_MS = 520;
const PLANET_ENTRY_FADE_MS = 420;
const SYSTEM_ORBIT_STAR_EDGE_GAP_CAP = 96;
const OBJECT_DETAIL_SURFACE_WORLD_WIDTH = 2;
const OBJECT_DETAIL_LIGHT_Z = 1.28;
const OBJECT_DETAIL_LIGHT_INTENSITY = 3.71;
const OBJECT_DETAIL_LIGHT_ANGLE_DEGREES = 25;
const OBJECT_DETAIL_LIGHT_PENUMBRA = 0.2;
const OBJECT_DETAIL_AMBIENT_INTENSITY = 0.08;
const OBJECT_DETAIL_AMBIENT_NO_LIGHT_INTENSITY = 1.6;
const OBJECT_DETAIL_DISPLACEMENT_SCALE = 0.3;
const OBJECT_DETAIL_CLOUD_HEIGHT = 0.270;
const OBJECT_DETAIL_HEX_GRID_HEIGHT = OBJECT_DETAIL_CLOUD_HEIGHT - 0.008;
const OBJECT_DETAIL_CITY_SURFACE_OFFSET = 0.004;
const OBJECT_DETAIL_HEX_GRID_TEXTURE_WIDTH = 2048;
const OBJECT_DETAIL_HEX_GRID_TEXTURE_HEIGHT = 1024;
const OBJECT_DETAIL_CLOUD_ALPHA_TEST = 0.03;
const OBJECT_DETAIL_CLOUD_CYCLE_SECONDS = 180;
const OBJECT_DETAIL_GAS_GIANT_CLOUD_CYCLE_SECONDS = OBJECT_DETAIL_CLOUD_CYCLE_SECONDS / 3;
const OBJECT_DETAIL_GAS_GIANT_TEXTURE_CYCLE_SECONDS = OBJECT_DETAIL_CLOUD_CYCLE_SECONDS * 3;
const OBJECT_DETAIL_CLOUD_SHADOW_STRENGTH = 0.38;
const OBJECT_DETAIL_CLOUD_SHADOW_DARKEN = 0.48;
const OBJECT_DETAIL_CLOUD_SHADOW_OFFSET_U = 0.035;
const OBJECT_DETAIL_CLOUD_SHADOW_OFFSET_V = -0.018;
const OBJECT_DETAIL_CAMERA_HALF_WIDTH = 1.15;
const OBJECT_DETAIL_CAMERA_HALF_HEIGHT = 0.575;
const OBJECT_DETAIL_CURSOR_CLEAR_RADIUS = 0.184;
const OBJECT_DETAIL_CURSOR_CLEAR_FEATHER = 0.12;
const OBJECT_DETAIL_CURSOR_LIGHT_INTENSITY = OBJECT_DETAIL_LIGHT_INTENSITY;
const OBJECT_DETAIL_CURSOR_LIGHT_ANGLE_DEGREES = 12;
const OBJECT_DETAIL_CURSOR_LIGHT_PENUMBRA = 0.62;
const OBJECT_DETAIL_CURSOR_LIGHT_FADE_IN_SPEED = 1.8;
const OBJECT_DETAIL_CURSOR_LIGHT_FADE_OUT_SPEED = 7.5;
const OBJECT_DETAIL_OPTION_FADE_SPEED = 3.2;
const OBJECT_DETAIL_RENDER_EPSILON = 0.0005;
const OBJECT_DETAIL_LIGHT_MAX_CHANNEL = 1.08;
const OBJECT_DETAIL_CURSOR_LIGHT_MIN_PROXIMITY = 0.16;
const OBJECT_DETAIL_TINT_LIGHT_INTENSITY = 0.34;
const OBJECT_DETAIL_TINT_LIGHT_ANGLE_DEGREES = OBJECT_DETAIL_LIGHT_ANGLE_DEGREES;
const OBJECT_DETAIL_TINT_LIGHT_PENUMBRA = 0.72;
const OBJECT_DETAIL_TINT_RING_WIDTH = 0;
const OBJECT_DETAIL_TINT_RING_SOFTNESS = 0.106;
const OBJECT_DETAIL_TINT_RING_BLEND = 0.39;
const OBJECT_DETAIL_TINT_RING_RADIUS_SCALE = 0.695;
const OBJECT_DETAIL_LIGHT_FALLBACK_DAY_SECONDS = 24;
const OBJECT_DETAIL_LIGHT_WRAP_MARGIN = 0.9;
const OBJECT_DETAIL_OBSERVED_DEFAULT_WIDTH_PERCENT = 89;
const OBJECT_DETAIL_OBSERVED_DEFAULT_HEIGHT_PERCENT = 95;
const OBJECT_DETAIL_HOVER_WIDTH_PERCENT = 87;
const OBJECT_DETAIL_HOVER_HEIGHT_PERCENT = 87;
const OBJECT_DETAIL_DAY_MARKER_EDGE_FADE = 0.02;
const OBJECT_DETAIL_EMISSIVE_BLOOM_STRENGTH = 2;
const OBJECT_DETAIL_EMISSIVE_BLOOM_TARGET_SCALE = 0.5;
const OBJECT_DETAIL_EMISSIVE_NOISE_SCALE = 20;
const OBJECT_DETAIL_EMISSIVE_NOISE_SPEED = 0.030;
const OBJECT_DETAIL_EMISSIVE_NOISE_BLACK_STOP = 0.16;
const OBJECT_DETAIL_EMISSIVE_NOISE_WHITE_STOP = 1;
const OBJECT_DETAIL_EMISSIVE_NOISE_OCTAVES = 3;
const OBJECT_DETAIL_BUILD_MENU_OPTIONS = [
  { id: "town", label: "T" },
  { id: "powerstation", label: "P" },
  { id: "mining", label: "M" },
  { id: "laboratory", label: "L" },
  { id: "spaceport", label: "S" },
  { id: "radar", label: "R" },
  { id: "base", label: "B" },
  { id: "terraforming", label: "TF" },
];
const OBJECT_DETAIL_DEMOLISH_MENU_OPTIONS = [
  { id: "demolish", label: "X" },
];
const OBJECT_DETAIL_BUILD_MENU_ANIMATION_SPEED = 5.6;
const OBJECT_DETAIL_HEX_WATER_SAMPLE_GRID = 7;
const OBJECT_DETAIL_HEX_WATER_LIMIT = 0.5;
const OBJECT_DETAIL_CITY_MIN_PIXEL_SIZE = 3;
const OBJECT_DETAIL_CITY_STAGE_MIN = 1;
const OBJECT_DETAIL_CITY_STAGE_MAX = 10;
const OBJECT_DETAIL_CITY_STAGE_THRESHOLDS = [
  0.07,
  0.13,
  0.21,
  0.31,
  0.42,
  0.54,
  0.66,
  0.78,
  0.9,
  1.01,
];
const OBJECT_DETAIL_CITY_ROAD_CUT_THRESHOLD = 0.66;
const OBJECT_DETAIL_CITY_FOUNDATION_MARGIN_CELLS = 9;
const OBJECT_DETAIL_CITY_FOUNDATION_GROWTH_MARGIN = 0.05;
const OBJECT_DETAIL_CITY_FOUNDATION_EDGE_WIDTH = 0.16;
const OBJECT_DETAIL_CITY_NIGHT_SURFACE_OFFSET = OBJECT_DETAIL_CITY_SURFACE_OFFSET + 0.0015;
const OBJECT_DETAIL_CITY_NIGHT_LIGHT_CHANCE = 0.12;
const OBJECT_DETAIL_CITY_NIGHT_ORANGE_STRIP_CHANCE = 0.24;
const OBJECT_DETAIL_CITY_NIGHT_EMISSIVE_INTENSITY = 2.55;
const OBJECT_DETAIL_CITY_NIGHT_DAY_RADIUS_SCALE = 1.03;
const OBJECT_DETAIL_CITY_SEED_HASH = hashObjectDetailSeedString(SEED);
let activeSystemStar = null;
let activeSystemStarSurface = null;
let tooltipTypingTimeout = null;
let tooltipTypingInterval = null;
let tooltipClearTimeout = null;
let tooltipTypingToken = 0;
let hoveredSystemBody = null;
let isTidalZoneVisible = false;
let isHzZoneVisible = false;
let activeZoneElements = [];
let isPlanetWindowOpen = false;
let openPlanetData = null;
let objectDetailOrbitPlanet = null;
let activeObjectDetail = null;
let isObjectDetailOpen = false;
let objectDetailToken = 0;
let objectDetail3D = null;
let objectDetailDayMarkers = [];
let objectDetailHexAnimationFrame = null;
const objectDetailOptions = {
  light: true,
  clouds: true,
  borders: true,
};
let isDraggingPlanetWindow = false;
const planetWindowOffset = { x: 0, y: 0 };
const planetWindowDragStart = { x: 0, y: 0, offsetX: 0, offsetY: 0 };
let systemTooltipTypingTimeout = null;
let systemTooltipTypingInterval = null;
let systemTooltipClearTimeout = null;
let systemTooltipTypingToken = 0;
let lastFrameTime = performance.now();
let skyRandomVersion = 0;
let skyMesh = null;
let targetCameraDistance = INITIAL_CAMERA_DISTANCE;
const skyGradientColors = [...DEFAULT_SKY_GRADIENT_COLORS];
const nodeColors = new Map();
const nodeAnimationProgress = new Map();
const edgeAnimationProgress = new Map();
const edgeAnimationOrigins = new Map();
const nodeExitAnimations = new Map();
const edgeExitAnimations = new Map();
let selectionOverlay = null;
const selectionScreenSize = new THREE.Vector2();
let systemGlowLayer = null;
const lastSystemParallax = {
  clientX: NaN,
  clientY: NaN,
  systemOffsetX: NaN,
  systemOffsetY: NaN,
};
const lastSystemGlow = {
  centerX: NaN,
  centerY: NaN,
  radius: NaN,
  color: "",
  intensity: NaN,
};
const selectionProjectionScratch = {
  vector: new THREE.Vector3(),
  startWorld: new THREE.Vector3(),
  endWorld: new THREE.Vector3(),
  startCamera: new THREE.Vector3(),
  endCamera: new THREE.Vector3(),
  clipped: new THREE.Vector3(),
  projected: new THREE.Vector4(),
  startScreen: new THREE.Vector2(),
  endScreen: new THREE.Vector2(),
};
let planetScreenRenderer = null;
let planetScreenRendererPromise = null;
let systemScreenController = null;
let musicPlayerController = null;
let planetScreenController = null;

initStartMenu();
if (!isRuntimeSessionRedirecting) {
  initStartMenuScene();
  resize();
  if (shouldStartGameAfterInit) {
    queueMicrotask(() => startGameFromMenu());
  } else {
    startMenuAnimationLoop();
  }
}

window.addEventListener("resize", onWindowResize);
window.addEventListener("beforeunload", () => {
  if (!isStartMenuOpen && !isRuntimeSessionRedirecting) {
    showRuntimeLoadingOverlay();
  }
});
window.addEventListener("pagehide", () => {
  persistRuntimeSession();
  stopMenuEnvironmentMachine();
});
document.addEventListener("keydown", (event) => {
  const key = event.key.toLowerCase();
  const isReloadKey = event.key === "F5" || ((event.ctrlKey || event.metaKey) && key === "r");
  if (isReloadKey && !isStartMenuOpen && !isRuntimeSessionRedirecting) {
    showRuntimeLoadingOverlay();
  }
}, { capture: true });
document.addEventListener("pointermove", onPointerMove, { capture: true });
document.addEventListener("pointerdown", onSystemPlanetMenuOutsidePointerDown, { capture: true });
starWindow.addEventListener("pointerdown", onSystemBlankFleetSelectionPointerDown);
sceneCanvas.addEventListener("pointerdown", onPointerDown);
sceneCanvas.addEventListener("wheel", onWheel, { passive: false });
window.addEventListener("pointerup", onPointerUp);
window.addEventListener("pointercancel", onPointerUp);
window.addEventListener("blur", cancelGraphDrag);
sceneCanvas.addEventListener("lostpointercapture", cancelGraphDrag);
document.addEventListener("pointerdown", releaseStaleGraphCapture, { capture: true });

function initializeNebulumRuntime() {
  if (isGameRuntimeReady) {
    return;
  }

  disposeStartMenuScene();
  isGameRuntimeReady = true;

  glowTexture = createNodeGlowTexture();
  linkPulseTexture = createLinkPulseTexture();
  blackHoleDiskTexture = createBlackHoleDiskTexture();
  blackHoleDiskMaterial = new THREE.SpriteMaterial({
    map: blackHoleDiskTexture,
    color: 0x000000,
    transparent: true,
    opacity: 1,
    depthWrite: false,
    depthTest: false,
    blending: THREE.NormalBlending,
  });

  scene = new THREE.Scene();
  scene.fog = new THREE.FogExp2(0x050506, 0.045);

  camera = new THREE.PerspectiveCamera(44, window.innerWidth / window.innerHeight, 0.1, 100);
  camera.position.set(0, 0, INITIAL_CAMERA_DISTANCE);
  targetCameraDistance = camera.position.z;

  graphRoot = new THREE.Group();
  scene.add(graphRoot);

  ambient = new THREE.AmbientLight(0xffffff, 0.14);
  scene.add(ambient);

  keyLight = new THREE.PointLight(0xffffff, 1.8, 28);
  keyLight.position.set(4, 5, 8);
  scene.add(keyLight);

  const rand = createRandom(SEED);
  const nameRand = createRandom(`${SEED}:names`);
  planetNameService = createPlanetNameService({ seed: SEED });
  nodes = createNodes(rand).map((node) => ({
    ...node,
    name: createStarName(nameRand),
  }));
  planetNameAssignments = planetNameService.createPlanetNameAssignments(nodes);
  links = createLinks(nodes);
  outerLinks = createOuterLinks(nodes, createRandom(`${SEED}:outer-links`));
  adjacency = createAdjacency(links, nodes);
  linkPulse = createLinkPulse(createRandom(`${SEED}:link-pulse`));
  systemDecorTrailRandom = createRandom(`${SEED}:system-decor-trails`);
  systemDecorTrailSerial = 0;
  systemDecorTrailSchedules.clear();
  selectionOverlay = createSelectionOverlay();
  systemGlowLayer = createSystemGlowLayer();

  systemScreenController = createSystemScreenController({ root: starWindow });
  musicPlayerController = createMusicPlayer({
    tracks: MUSIC_TRACKS,
    canDragInSystem: () => isGameRuntimeReady && !isStartMenuOpen && !isAppExited,
  });
  planetScreenController = createPlanetScreenController({
    root: planetScreen,
    getPointer: () => ({ x: lastClientPointer.x, y: lastClientPointer.y }),
    onBeforeOpen: () => {
      setSystemHover(null);
      closePlanetWindow();
    },
    render: (planet) => {
      if (planetScreenRenderer) {
        planetScreenRenderer.render(planet);
        return;
      }
      renderPlanetScreenLoadFallback(planet);
      loadPlanetScreenRenderer()
        .then((rendererModule) => {
          if (!planetScreenController?.isOpen?.() || planetScreenController.state.activePlanet !== planet) {
            return;
          }
          rendererModule.render(planet);
          planetScreenController.updateParallax(lastClientPointer.x, lastClientPointer.y);
        })
        .catch((error) => {
          console.warn("Planet screen module deferred render failed", error);
        });
    },
    renderFallback: (planet) => {
      if (planetScreenRenderer) {
        planetScreenRenderer.renderFallback(planet);
        return;
      }
      renderPlanetScreenLoadFallback(planet);
    },
    dispose3D: () => {
      planetScreenRenderer?.dispose3D();
    },
    drawStarSurface: drawSystemStarSurface,
    update3D: (surface, deltaSeconds, now) => {
      planetScreenRenderer?.update3D(surface, deltaSeconds, now);
    },
    setOpenPlanetData: (planet) => {
      openPlanetData = planet;
    },
  });

  initPanel();
  musicPlayerController.init();
  musicPlayerController.setMasterVolume(audioSettings.masterVolume);
  musicPlayerController.ensureSystemPosition();
  musicPlayerController.resumeInitialPlayback();
  buildSky(createRandom(`${SEED}:sky`));
  buildLocalSpaceStars(createRandom(`${SEED}:local-space`));
  buildLinks(links);
  buildOuterLinks(outerLinks);
  buildNodes(nodes);
  graphRoot.add(linkPulse.sprite);
  syncVisibleSystemOwnershipColors();
  resize();
  renderStarmapFrame();
}

function initStartMenu() {
  if (!startMenu) {
    isStartMenuOpen = false;
    return;
  }

  document.body.classList.add("start-menu-open");
  menuSeedInput.value = MENU_DEFAULT_SEED;
  clearLegacySaves();
  initRuntimeStartupState();

  menuNewGame.addEventListener("click", () => {
    resetNewGameDialog();
    openMenuDialog(seedDialog, menuSeedInput);
  });
  menuLoadGame.addEventListener("click", openLoadGameDialog);
  menuSettings.addEventListener("click", openSettingsDialog);
  menuExit.addEventListener("click", runStartMenuSystemAction);
  gameMenuButton.addEventListener("click", openGameMenuDialog);
  gameSaveGame.addEventListener("click", openGameSaveDialog);
  gameMainMenu.addEventListener("click", returnToMainMenu);
  gameSettings.addEventListener("click", openGameSettingsDialog);
  gameSaveAdd.addEventListener("click", addGameSaveDraft);
  gameSaveConfirm.addEventListener("click", saveCurrentGameToSelectedSlot);
  gameDeleteSave.addEventListener("click", deleteSelectedGameSave);
  gameSaveClose.addEventListener("click", closeGameDialogs);
  gameSettingsClose.addEventListener("click", closeGameDialogs);
  gameBreadcrumbStarmap?.addEventListener("click", navigateGameBreadcrumbToStarmap);
  gameBreadcrumbSystem?.addEventListener("click", navigateGameBreadcrumbToSystem);
  gameBreadcrumbOrbit?.addEventListener("click", navigateGameBreadcrumbToOrbit);
  signTurnButton?.addEventListener("click", signCurrentTurn);
  startMenu.addEventListener("pointermove", onStartMenuPointerMove);
  startMenu.addEventListener("pointerleave", clearStartMenuPointer);
  startMenu.addEventListener("click", onStartMenuClick);
  startMenu.addEventListener("pointerdown", playMenuMusic, { once: true });
  menuSeedConfirm.addEventListener("click", confirmNewGameSeed);
  menuSeedCancel.addEventListener("click", closeMenuDialogs);
  menuScenarioCurrent.addEventListener("click", (event) => {
    event.stopPropagation();
    setNewGameScenarioDropdownOpen(menuScenarioList.hidden);
  });
  menuScenarioDropdown.addEventListener("click", (event) => {
    event.stopPropagation();
    setNewGameScenarioDropdownOpen(menuScenarioList.hidden);
  });
  menuScenarioList.addEventListener("scroll", updateNewGameScenarioScrollbar);
  menuScenarioScrollbar.addEventListener("pointerdown", onNewGameScenarioScrollbarPointerDown);
  menuSessionMode.addEventListener("click", toggleNewGameSessionMode);
  menuFactionCount.addEventListener("input", () => {
    newGameFactionCount = parseFactionCount(menuFactionCount.value);
    markNewGameSetupDirty();
    renderNewGameDialog();
  });
  menuPlayerFactionName.addEventListener("input", () => {
    newGamePlayerFactionName = menuPlayerFactionName.value;
    markNewGameSetupDirty();
    renderNewGameFactionGrid(newGameFactionCount);
    updateNewGameActions();
  });
  menuPlayerFactionColor.addEventListener("click", () => {
    openColorPicker(menuPlayerFactionColor, newGamePlayerFactionColor, (color) => {
      newGamePlayerFactionColor = color;
      markNewGameSetupDirty();
      updateNewGamePlayerFactionColor();
      renderNewGameFactionGrid(newGameFactionCount);
      updateNewGameActions();
    });
  });
  menuGovernmentCurrent.addEventListener("click", (event) => {
    event.stopPropagation();
    setNewGameGovernmentDropdownOpen(menuGovernmentList.hidden);
  });
  menuGovernmentDropdown.addEventListener("click", (event) => {
    event.stopPropagation();
    setNewGameGovernmentDropdownOpen(menuGovernmentList.hidden);
  });
  menuNewGameApply.addEventListener("click", applyOnlineNewGameSetup);
  menuSeedInput.addEventListener("input", () => {
    markNewGameSetupDirty();
    renderNewGameDialog();
  });
  menuSeedInput.addEventListener("keydown", (event) => {
    if (event.key === "Enter") {
      confirmNewGameSeed();
    }
  });
  menuLoadClose.addEventListener("click", closeMenuDialogs);
  menuLoadSave.addEventListener("click", loadSelectedMenuSave);
  menuDeleteSave.addEventListener("click", deleteSelectedMenuSave);
  menuSettingsClose.addEventListener("click", closeMenuDialogs);
  menuOpenEditor.addEventListener("click", openEditorFromMenu);
  menuMasterVolume.addEventListener("input", updateAudioSettingsFromMenu);
  menuEnvironmentVolume.addEventListener("input", updateAudioSettingsFromMenu);
  menuMusicEnabled.addEventListener("change", updateAudioSettingsFromMenu);
  menuShowMusicPlayer.addEventListener("change", updateAudioSettingsFromMenu);
  menuBorderlessWindow.addEventListener("change", updateWindowSettingsFromMenu);
  gameMasterVolume.addEventListener("input", updateAudioSettingsFromMenu);
  gameEnvironmentVolume.addEventListener("input", updateAudioSettingsFromMenu);
  gameMenuMusicEnabled.addEventListener("change", updateAudioSettingsFromMenu);
  gameShowMusicPlayer.addEventListener("change", updateAudioSettingsFromMenu);
  gameSpaceGradientEnabled.addEventListener("change", updateGameUiSettingsFromMenu);
  gameBorderlessWindow.addEventListener("change", updateWindowSettingsFromMenu);
  initAudioMixer();
  initUiHoverSounds();
  initUiClickSounds();
  initPwaMenuAction();

  seedDialog.addEventListener("pointerdown", (event) => {
    if (event.target === seedDialog) {
      setNewGameScenarioDropdownOpen(false);
      setNewGameGovernmentDropdownOpen(false);
    }
  });
  loadDialog.addEventListener("pointerdown", (event) => {
    if (event.target === loadDialog) {
      closeMenuDialogs();
    }
  });
  settingsDialog.addEventListener("pointerdown", (event) => {
    if (event.target === settingsDialog) {
      closeMenuDialogs();
    }
  });
  document.addEventListener("pointerdown", (event) => {
    if (
      menuScenarioList.hidden ||
      menuScenarioList.contains(event.target) ||
      menuScenarioScrollbar.contains(event.target) ||
      menuScenarioCurrent.contains(event.target) ||
      menuScenarioDropdown.contains(event.target)
    ) {
      return;
    }
    setNewGameScenarioDropdownOpen(false);
  });
  document.addEventListener("pointerdown", (event) => {
    if (
      menuGovernmentList.hidden ||
      menuGovernmentList.contains(event.target) ||
      menuGovernmentCurrent.contains(event.target) ||
      menuGovernmentDropdown.contains(event.target)
    ) {
      return;
    }
    setNewGameGovernmentDropdownOpen(false);
  });
  gameMenuDialog.addEventListener("pointerdown", (event) => {
    if (event.target === gameMenuDialog) {
      closeGameDialogs();
    }
  });
  gameSaveDialog.addEventListener("pointerdown", (event) => {
    if (event.target === gameSaveDialog) {
      closeGameDialogs();
    }
  });
  gameSettingsDialog.addEventListener("pointerdown", (event) => {
    if (event.target === gameSettingsDialog) {
      closeGameDialogs();
    }
  });
  window.addEventListener("keydown", (event) => {
    if (event.key === "F11") {
      syncBorderlessWindowFromManualToggle(event);
      return;
    }
    if (event.key !== "Escape") {
      return;
    }
    if (isStartMenuOpen) {
      closeMenuDialogs();
      return;
    }
    closeGameDialogs();
  }, { capture: true });

  syncSettingsDialog();
  syncWindowSettingsFromServer();
  initNewGameScenarioDropdown();
  initNewGameGovernmentDropdown();
  resetNewGameDialog();
  applyAudioSettings();
  applyWindowSettings();
  startMenuEnvironmentMachine();
  playMenuMusic();
}

function initStartMenuScene() {
  if (!startMenu) {
    return;
  }

  document.body.classList.add("menu-scene-active");
  menuScene = new THREE.Scene();
  menuCamera = new THREE.PerspectiveCamera(38, window.innerWidth / window.innerHeight, 0.1, 80);
  menuCamera.position.set(0, 0, 9);

  menuSky = new THREE.Mesh(
    new THREE.SphereGeometry(36, 32, 16),
    createSkyGradientMaterial(
      createRandom(`${SEED}:menu-sky`),
      DEFAULT_SKY_GRADIENT_COLORS,
      createMenuSkyAnchorUniforms(),
    ),
  );
  menuSky.renderOrder = -10;
  menuScene.add(menuSky);

  menuGroup = new THREE.Group();
  menuScene.add(menuGroup);

  menuPlaneCanvas = document.createElement("canvas");
  menuPlaneCanvas.width = MENU_TEXTURE_WIDTH;
  menuPlaneCanvas.height = MENU_TEXTURE_HEIGHT;
  menuPlaneContext = menuPlaneCanvas.getContext("2d");
  menuPlaneTexture = new THREE.CanvasTexture(menuPlaneCanvas);
  menuPlaneTexture.colorSpace = THREE.SRGBColorSpace;
  menuPlaneTexture.anisotropy = Math.min(renderer.capabilities.getMaxAnisotropy(), 8);

  const menuPlaneMaterial = new THREE.MeshBasicMaterial({
    map: menuPlaneTexture,
    transparent: true,
    depthWrite: false,
    depthTest: true,
  });
  const menuPlaneGeometry = new THREE.PlaneGeometry(MENU_PLANE_WIDTH, MENU_PLANE_HEIGHT);
  menuPlane = new THREE.Mesh(menuPlaneGeometry, menuPlaneMaterial);
  menuGroup.add(menuPlane);

  menuStars = createStartMenuStarField();
  menuStars.renderOrder = 0;
  menuScene.add(menuStars);
  menuStarLinks = new THREE.Group();
  menuStarLinks.renderOrder = 1;
  menuScene.add(menuStarLinks);
  menuStarGlowTexture = createNodeGlowTexture();
  resetStartMenuStarPilots();
  initStartMenuComposite();

  updateMenuPlaneTexture();
  document.fonts?.ready.then(updateMenuPlaneTexture).catch(() => {});
}

function initPwaMenuAction() {
  syncPwaMenuAction();

  window.addEventListener("beforeinstallprompt", (event) => {
    if (isNebulumAppWindow()) {
      return;
    }

    event.preventDefault();
    deferredInstallPrompt = event;
    setPwaMenuAction("install");
  });
  window.addEventListener("appinstalled", () => {
    deferredInstallPrompt = null;
    localStorage.setItem(PWA_INSTALL_STORAGE_KEY, "true");
    syncPwaMenuAction();
  });

  if (!isNebulumAppWindow()) {
    window.setTimeout(() => {
      if (!deferredInstallPrompt && pwaMenuAction === "install") {
        setPwaMenuAction("open");
      }
    }, 1200);
  }
}

function isPwaStandalone() {
  return (
    window.matchMedia("(display-mode: standalone)").matches ||
    window.matchMedia("(display-mode: fullscreen)").matches ||
    window.navigator.standalone === true
  );
}

function isNebulumAppWindow() {
  return isPwaStandalone() || params.get(APP_LAUNCH_PARAM) === "1";
}

function syncPwaMenuAction() {
  setPwaMenuAction(isNebulumAppWindow() ? "exit" : readPwaInstalledFlag() ? "open" : "install");
}

function setPwaMenuAction(action) {
  const nextAction = isNebulumAppWindow() ? "exit" : action;
  if (pwaMenuAction === nextAction) {
    updateMenuExitButtonLabel();
    return;
  }

  pwaMenuAction = nextAction;
  updateMenuExitButtonLabel();
  updateMenuPlaneTexture();
}

function updateMenuExitButtonLabel() {
  menuExit.textContent = getStartMenuSystemActionLabel();
}

function getStartMenuSystemActionLabel() {
  if (isNebulumAppWindow()) {
    return "EXIT";
  }
  return pwaMenuAction === "open" ? "OPEN PWA" : "INSTALL PWA";
}

function getStartMenuSystemActionId() {
  return isNebulumAppWindow() ? "exit" : "pwa";
}

function readPwaInstalledFlag() {
  return localStorage.getItem(PWA_INSTALL_STORAGE_KEY) === "true";
}

async function runStartMenuSystemAction() {
  if (isNebulumAppWindow()) {
    await exitNebulum();
    return;
  }

  if (pwaMenuAction === "open") {
    await openPwaFromBrowser();
    return;
  }

  await installPwaFromMenu();
}

async function installPwaFromMenu() {
  if (isNebulumAppWindow()) {
    await exitNebulum();
    return;
  }

  if (!deferredInstallPrompt) {
    setPwaMenuAction("open");
    await openPwaFromBrowser();
    return;
  }

  deferredInstallPrompt.prompt();
  const choice = await deferredInstallPrompt.userChoice.catch(() => null);
  deferredInstallPrompt = null;
  if (choice?.outcome === "accepted") {
    localStorage.setItem(PWA_INSTALL_STORAGE_KEY, "true");
    setPwaMenuAction("open");
    await openPwaFromBrowser();
    return;
  }

  setPwaMenuAction("install");
}

async function openPwaFromBrowser() {
  if (await postOpenPwaRequest("/api/open-pwa")) {
    return true;
  }

  for (const url of getLocalOpenPwaUrls()) {
    if (await postOpenPwaRequest(url)) {
      return true;
    }
  }

  return false;
}

async function closePwaWindowFromApp() {
  if (await postOpenPwaRequest("/api/exit-pwa")) {
    return true;
  }

  for (const url of getLocalPwaUrls("/api/exit-pwa")) {
    if (await postOpenPwaRequest(url)) {
      return true;
    }
  }

  window.close();
  return false;
}

async function postOpenPwaRequest(url) {
  try {
    const response = await fetch(url, {
      method: "POST",
      cache: "no-store",
    });
    return response.ok;
  } catch {
    return false;
  }
}

function getLocalOpenPwaUrls() {
  return getLocalPwaUrls("/api/open-pwa");
}

function getLocalPwaUrls(pathname) {
  const currentOrigin = window.location.origin;
  return NEBULUM_LOCAL_PORTS
    .map((port) => `http://127.0.0.1:${port}${pathname}`)
    .filter((url) => !url.startsWith(`${currentOrigin}/`));
}

function initStartMenuComposite() {
  const pixelRatio = Math.min(window.devicePixelRatio, 2);
  const width = Math.max(1, Math.floor(window.innerWidth * pixelRatio));
  const height = Math.max(1, Math.floor(window.innerHeight * pixelRatio));
  menuBackgroundTarget = new THREE.WebGLRenderTarget(width, height, {
    depthBuffer: true,
    stencilBuffer: false,
  });
  menuBackgroundTarget.texture.colorSpace = THREE.SRGBColorSpace;

  menuCompositeCamera = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1);
  menuCompositeScene = new THREE.Scene();
  menuCompositeMaterial = new THREE.ShaderMaterial({
    uniforms: {
      tDiffuse: { value: menuBackgroundTarget.texture },
      resolution: { value: new THREE.Vector2(width, height) },
      rectCount: { value: 0 },
      blurRects: {
        value: Array.from({ length: MENU_BUTTON_BLUR_MAX_RECTS }, () => new THREE.Vector4()),
      },
    },
    vertexShader: `
      varying vec2 vUv;
      void main() {
        vUv = uv;
        gl_Position = vec4(position.xy, 0.0, 1.0);
      }
    `,
    fragmentShader: `
      uniform sampler2D tDiffuse;
      uniform vec2 resolution;
      uniform int rectCount;
      uniform vec4 blurRects[${MENU_BUTTON_BLUR_MAX_RECTS}];
      varying vec2 vUv;

      float rectMask(vec2 uv, vec4 rect) {
        vec2 feather = vec2(10.0) / resolution;
        float left = smoothstep(rect.x, rect.x + feather.x, uv.x);
        float right = 1.0 - smoothstep(rect.z - feather.x, rect.z, uv.x);
        float bottom = smoothstep(rect.y, rect.y + feather.y, uv.y);
        float top = 1.0 - smoothstep(rect.w - feather.y, rect.w, uv.y);
        return left * right * bottom * top;
      }

      vec4 sampleBlur(vec2 uv) {
        vec2 texel = 1.0 / resolution;
        vec4 color = texture2D(tDiffuse, uv) * 0.18;
        color += texture2D(tDiffuse, uv + texel * vec2(-5.0, 0.0)) * 0.07;
        color += texture2D(tDiffuse, uv + texel * vec2(5.0, 0.0)) * 0.07;
        color += texture2D(tDiffuse, uv + texel * vec2(0.0, -5.0)) * 0.07;
        color += texture2D(tDiffuse, uv + texel * vec2(0.0, 5.0)) * 0.07;
        color += texture2D(tDiffuse, uv + texel * vec2(-3.0, -3.0)) * 0.09;
        color += texture2D(tDiffuse, uv + texel * vec2(3.0, -3.0)) * 0.09;
        color += texture2D(tDiffuse, uv + texel * vec2(-3.0, 3.0)) * 0.09;
        color += texture2D(tDiffuse, uv + texel * vec2(3.0, 3.0)) * 0.09;
        color += texture2D(tDiffuse, uv + texel * vec2(-1.5, 0.0)) * 0.085;
        color += texture2D(tDiffuse, uv + texel * vec2(1.5, 0.0)) * 0.085;
        color += texture2D(tDiffuse, uv + texel * vec2(0.0, -1.5)) * 0.085;
        color += texture2D(tDiffuse, uv + texel * vec2(0.0, 1.5)) * 0.085;
        return color;
      }

      void main() {
        vec4 base = texture2D(tDiffuse, vUv);
        float mask = 0.0;
        for (int index = 0; index < ${MENU_BUTTON_BLUR_MAX_RECTS}; index += 1) {
          if (index >= rectCount) {
            break;
          }
          mask = max(mask, rectMask(vUv, blurRects[index]));
        }
        if (mask <= 0.001) {
          discard;
        }
        vec4 blurred = sampleBlur(vUv);
        gl_FragColor = vec4(blurred.rgb, mask);
      }
    `,
    transparent: true,
    depthWrite: false,
    depthTest: false,
  });
  menuCompositeQuad = new THREE.Mesh(new THREE.PlaneGeometry(2, 2), menuCompositeMaterial);
  menuCompositeScene.add(menuCompositeQuad);
}

function createStartMenuStarField() {
  const random = createRandom("nebulum:start-menu-stars");
  const starCount = 900;
  const positions = new Float32Array(starCount * 3);
  const colors = new Float32Array(starCount * 3);
  const color = new THREE.Color();
  const points = [];

  for (let index = 0; index < starCount; index += 1) {
    const radius = 6 + random() * 14;
    const angle = random() * Math.PI * 2;
    const height = (random() - 0.5) * 11;
    const depth = -2 - random() * 24;
    positions[index * 3] = Math.cos(angle) * radius;
    positions[index * 3 + 1] = height + Math.sin(angle * 0.7) * 0.8;
    positions[index * 3 + 2] = depth;
    points.push(new THREE.Vector3(
      positions[index * 3],
      positions[index * 3 + 1],
      positions[index * 3 + 2],
    ));

    const warmth = random();
    color.setRGB(
      0.42 + random() * 0.36,
      0.48 + random() * 0.34,
      0.58 + random() * 0.36,
    );
    color.lerp(new THREE.Color(1, 0.82, 0.58), warmth * 0.16);
    colors[index * 3] = color.r;
    colors[index * 3 + 1] = color.g;
    colors[index * 3 + 2] = color.b;
  }

  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute("position", new THREE.BufferAttribute(positions, 3));
  geometry.setAttribute("color", new THREE.BufferAttribute(colors, 3));

  const material = new THREE.PointsMaterial({
    size: 0.035,
    sizeAttenuation: true,
    vertexColors: true,
    transparent: true,
    opacity: 0.78,
    depthWrite: false,
    blending: THREE.AdditiveBlending,
  });

  menuStarPoints = points;
  menuStarTrailIndices = points
    .map((point, index) => ({ index, point }))
    .filter(({ point }) => Math.abs(point.x) < 8.5 && Math.abs(point.y) < 4.6 && point.z > -20)
    .map(({ index }) => index);
  return new THREE.Points(geometry, material);
}

function resetStartMenuStarPilots() {
  const source = getStartMenuTrailSource();
  const starts = [];
  menuStarPilotSerial = 0;
  menuStarPilots = Array.from({ length: MENU_STAR_PILOT_INITIAL_COUNT }, (_, index) => {
    const random = createRandom(`nebulum:start-menu-link-trail:${index}`);
    const currentIndex = chooseStartMenuPilotStart(source, random, starts);
    starts.push(currentIndex);
    return createStartMenuPilot({
      currentIndex,
      random,
      spawnDelay: (0.12 + index * 0.22 + random() * 0.35) * MENU_STAR_LINK_SPEED_SCALE,
    });
  });
}

function createStartMenuPilot({ currentIndex, previousIndex = null, random, spawnDelay }) {
  menuStarPilotSerial += 1;
  const glow = createStartMenuPilotGlow();
  glow.position.copy(menuStarPoints[currentIndex] ?? new THREE.Vector3());
  menuStarLinks.add(glow);
  return {
    active: true,
    currentIndex,
    glow,
    id: menuStarPilotSerial,
    previousIndex,
    random,
    segments: [],
    sourceIndex: currentIndex,
    spawnDelay,
  };
}

function getStartMenuTrailSource() {
  return menuStarTrailIndices.length > 1 ? menuStarTrailIndices : menuStarPoints.map((_, index) => index);
}

function chooseStartMenuPilotStart(source, random, starts) {
  let bestIndex = source[Math.floor(random() * Math.max(1, source.length))] ?? 0;
  let bestDistance = -Infinity;

  for (let attempt = 0; attempt < 90; attempt += 1) {
    const candidateIndex = source[Math.floor(random() * source.length)] ?? bestIndex;
    const candidate = menuStarPoints[candidateIndex];
    const nearestDistance = starts.length === 0
      ? Infinity
      : Math.min(...starts.map((index) => candidate.distanceTo(menuStarPoints[index])));
    if (nearestDistance > 5.2) {
      return candidateIndex;
    }
    if (nearestDistance > bestDistance) {
      bestDistance = nearestDistance;
      bestIndex = candidateIndex;
    }
  }

  return bestIndex;
}

function createStartMenuPilotGlow() {
  const material = new THREE.SpriteMaterial({
    map: menuStarGlowTexture,
    color: MENU_STAR_LINK_COLOR,
    transparent: true,
    opacity: 0.52,
    depthWrite: false,
    depthTest: true,
    blending: THREE.AdditiveBlending,
  });
  const sprite = new THREE.Sprite(material);
  sprite.scale.set(0.46, 0.46, 1);
  sprite.renderOrder = 2;
  return sprite;
}

function updateStartMenuStarTrail(deltaSeconds) {
  if (!menuStarLinks || menuStarPoints.length < 2) {
    return;
  }

  const pilotCount = menuStarPilots.length;
  for (let index = 0; index < pilotCount; index += 1) {
    const pilot = menuStarPilots[index];
    if (pilot.active) {
      pilot.spawnDelay -= deltaSeconds;
    }
    if (pilot.active && pilot.spawnDelay <= 0) {
      spawnStartMenuStarLink(pilot);
      pilot.spawnDelay = (0.48 + pilot.random() * 0.34) * MENU_STAR_LINK_SPEED_SCALE;
    }

    updateStartMenuPilotGlow(pilot);
    updateStartMenuPilotSegments(pilot, deltaSeconds);
  }

  for (let index = menuStarPilots.length - 1; index >= 0; index -= 1) {
    const pilot = menuStarPilots[index];
    if (!pilot.active && pilot.segments.length === 0) {
      menuStarPilots.splice(index, 1);
    }
  }

  while (
    countActiveStartMenuPilots() < MENU_STAR_PILOT_MIN_COUNT
    && countActiveStartMenuPilots() < MENU_STAR_PILOT_MAX_COUNT
  ) {
    spawnStartMenuPilotAtRandom();
  }
}

function countActiveStartMenuPilots() {
  return menuStarPilots.reduce((count, pilot) => count + (pilot.active ? 1 : 0), 0);
}

function spawnStartMenuPilotAtRandom() {
  const source = getStartMenuTrailSource();
  const random = createRandom(`nebulum:start-menu-link-trail:${menuStarPilotSerial + 1}`);
  const starts = menuStarPilots
    .filter((pilot) => pilot.active)
    .map((pilot) => pilot.currentIndex);
  const currentIndex = chooseStartMenuPilotStart(source, random, starts);
  menuStarPilots.push(createStartMenuPilot({
    currentIndex,
    random,
    spawnDelay: (0.24 + random() * 0.56) * MENU_STAR_LINK_SPEED_SCALE,
  }));
}

function updateStartMenuPilotGlow(pilot) {
  if (!pilot.active) {
    return;
  }

  const glowPoint = menuStarPoints[pilot.sourceIndex ?? pilot.currentIndex];
  if (!glowPoint || !pilot.glow) {
    return;
  }

  pilot.glow.position.copy(glowPoint);
  const pulse = 0.92 + Math.sin(performance.now() * 0.004 + pilot.currentIndex) * 0.08;
  pilot.glow.scale.setScalar(0.46 * pulse);
  pilot.glow.material.opacity = 0.48 + (pulse - 0.92) * 0.8;
}

function updateStartMenuPilotSegments(pilot, deltaSeconds) {
  scheduleInactiveStartMenuPilotRetraction(pilot);

  for (let index = pilot.segments.length - 1; index >= 0; index -= 1) {
    const segment = pilot.segments[index];
    segment.elapsed += deltaSeconds;
    const position = segment.line.geometry.attributes.position;

    if (segment.retracting) {
      segment.retractElapsed += deltaSeconds;
      const retractProgress = easeOutCubic(Math.min(1, segment.retractElapsed / segment.retractSeconds));
      segment.scratchStart.copy(segment.retractStart).lerp(segment.retractTo, retractProgress);
      segment.scratchEnd.copy(segment.retractEnd).lerp(segment.retractTo, retractProgress);
      position.setXYZ(0, segment.scratchStart.x, segment.scratchStart.y, segment.scratchStart.z);
      position.setXYZ(1, segment.scratchEnd.x, segment.scratchEnd.y, segment.scratchEnd.z);
      segment.opacity = Math.max(0, segment.opacity - (deltaSeconds * 0.4) / MENU_STAR_LINK_SPEED_SCALE);
      if (retractProgress >= 1) {
        segment.opacity = 0;
      }
    } else {
      const progress = easeOutCubic(Math.min(1, segment.elapsed / segment.growSeconds));
      segment.scratchEnd.copy(segment.start).lerp(segment.end, progress);
      position.setXYZ(0, segment.start.x, segment.start.y, segment.start.z);
      position.setXYZ(1, segment.scratchEnd.x, segment.scratchEnd.y, segment.scratchEnd.z);
      segment.opacity = THREE.MathUtils.lerp(segment.opacity, 0.52, 0.12);
    }

    position.needsUpdate = true;
    segment.line.material.opacity = segment.opacity;

    if (segment.opacity <= 0.01) {
      disposeStartMenuStarLink(segment);
      pilot.segments.splice(index, 1);
    }
  }
}

function scheduleInactiveStartMenuPilotRetraction(pilot) {
  if (pilot.active || pilot.segments.some((segment) => segment.retracting)) {
    return;
  }

  const oldestReadySegment = pilot.segments.find((segment) => (
    !segment.retracting
    && segment.elapsed >= segment.growSeconds + 0.4 * MENU_STAR_LINK_SPEED_SCALE
  ));
  if (oldestReadySegment) {
    retractStartMenuStarLink(oldestReadySegment, oldestReadySegment.end);
  }
}

function spawnStartMenuStarLink(pilot) {
  if (!pilot?.active || menuStarPoints.length < 2) {
    return;
  }

  const startIndex = pilot.currentIndex;
  const start = menuStarPoints[startIndex];
  const activeSegments = pilot.segments.filter((segment) => !segment.retracting);
  if (activeSegments.length >= MENU_STAR_LINK_TRAIL_DEPTH) {
    retractStartMenuStarLink(activeSegments[0], activeSegments[0].end);
  }

  const endIndex = chooseStartMenuLinkTarget(pilot, startIndex);
  if (endIndex === startIndex) {
    stopStartMenuPilot(pilot);
    return;
  }
  const targetHasOutgoingLink = hasStartMenuOutgoingLink(endIndex);
  const end = menuStarPoints[endIndex];
  pilot.previousIndex = startIndex;
  pilot.currentIndex = endIndex;
  pilot.sourceIndex = startIndex;

  const positions = new Float32Array([
    start.x, start.y, start.z,
    start.x, start.y, start.z,
  ]);
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute("position", new THREE.BufferAttribute(positions, 3));
  const material = new THREE.LineBasicMaterial({
    color: MENU_STAR_LINK_COLOR,
    transparent: true,
    opacity: 0,
    depthWrite: false,
    depthTest: true,
    blending: THREE.AdditiveBlending,
  });
  const line = new THREE.Line(geometry, material);
  line.frustumCulled = false;
  line.renderOrder = 1;
  menuStarLinks.add(line);
  pilot.segments.push({
    elapsed: 0,
    end,
    endIndex,
    growSeconds: 0.42 * MENU_STAR_LINK_SPEED_SCALE,
    line,
    opacity: 0,
    retractElapsed: 0,
    retractEnd: new THREE.Vector3(),
    retractSeconds: 0.5 * MENU_STAR_LINK_SPEED_SCALE,
    retractStart: new THREE.Vector3(),
    retractTo: new THREE.Vector3(),
    retracting: false,
    scratchEnd: new THREE.Vector3(),
    scratchStart: new THREE.Vector3(),
    start,
    startIndex,
  });

  if (targetHasOutgoingLink || pilot.random() < MENU_STAR_PILOT_STOP_CHANCE) {
    stopStartMenuPilot(pilot);
    return;
  }

  if (countActiveStartMenuPilots() < MENU_STAR_PILOT_MAX_COUNT && pilot.random() < MENU_STAR_PILOT_BRANCH_CHANCE) {
    const branchRandom = createRandom(`nebulum:start-menu-link-trail:${menuStarPilotSerial + 1}`);
    menuStarPilots.push(createStartMenuPilot({
      currentIndex: endIndex,
      previousIndex: startIndex,
      random: branchRandom,
      spawnDelay: (0.5 + branchRandom() * 0.38) * MENU_STAR_LINK_SPEED_SCALE,
    }));
  }
}

function hasStartMenuOutgoingLink(starIndex) {
  return menuStarPilots.some((pilot) => pilot.segments.some((segment) => (
    !segment.retracting && segment.startIndex === starIndex
  )));
}

function stopStartMenuPilot(pilot) {
  if (!pilot?.active) {
    return;
  }

  pilot.active = false;
  if (pilot.glow) {
    menuStarLinks.remove(pilot.glow);
    pilot.glow.material.dispose();
    pilot.glow = null;
  }
}

function retractStartMenuStarLink(segment, target) {
  if (segment.retracting) {
    return;
  }

  const position = segment.line.geometry.attributes.position;
  segment.retractStart.set(position.getX(0), position.getY(0), position.getZ(0));
  segment.retractEnd.set(position.getX(1), position.getY(1), position.getZ(1));
  segment.retractTo.copy(target);
  segment.retractElapsed = 0;
  segment.retracting = true;
}

function chooseStartMenuLinkTarget(pilot, startIndex) {
  const random = pilot.random;
  const start = menuStarPoints[startIndex];
  const source = getStartMenuTrailSource();
  const occupiedTargets = getStartMenuOutgoingTargets(startIndex);
  let bestIndex = startIndex;
  let bestScore = Infinity;

  for (let attempt = 0; attempt < 96; attempt += 1) {
    const candidateIndex = source[Math.floor(random() * source.length)];
    if (
      candidateIndex === startIndex
      || candidateIndex === pilot.previousIndex
      || occupiedTargets.has(candidateIndex)
    ) {
      continue;
    }

    const distance = start.distanceTo(menuStarPoints[candidateIndex]);
    if (distance < MENU_STAR_LINK_MIN_DISTANCE || distance > MENU_STAR_LINK_MAX_DISTANCE) {
      continue;
    }

    const score = Math.abs(distance - 2.8) + random() * 0.55;
    if (score < bestScore) {
      bestScore = score;
      bestIndex = candidateIndex;
    }
  }

  if (bestIndex !== startIndex) {
    return bestIndex;
  }

  const fallback = source.find((index) => (
    index !== startIndex
    && index !== pilot.previousIndex
    && !occupiedTargets.has(index)
  ));
  return fallback ?? startIndex;
}

function getStartMenuOutgoingTargets(startIndex) {
  const targets = new Set();
  for (const pilot of menuStarPilots) {
    for (const segment of pilot.segments) {
      if (!segment.retracting && segment.startIndex === startIndex) {
        targets.add(segment.endIndex);
      }
    }
  }
  return targets;
}

function disposeStartMenuStarLink(segment) {
  menuStarLinks?.remove(segment.line);
  segment.line.geometry.dispose();
  segment.line.material.dispose();
}

function updateMenuPlaneTexture() {
  if (!menuPlaneContext || !menuPlaneTexture) {
    return;
  }

  const ctx = menuPlaneContext;
  ctx.clearRect(0, 0, MENU_TEXTURE_WIDTH, MENU_TEXTURE_HEIGHT);

  const centerX = MENU_TEXTURE_WIDTH / 2;
  const activeId = menuActiveButton?.id ?? null;
  ctx.save();
  ctx.shadowColor = "rgba(255, 255, 255, 0.36)";
  ctx.shadowBlur = 22;
  ctx.fillStyle = "rgba(255, 255, 255, 0.96)";
  ctx.font = '212px "Wire One", "League Gothic", sans-serif';
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.fillText("NEBULUM", centerX, 268);
  ctx.restore();

  menuButtonRects = [
    { id: "new", label: "NEW GAME", x: 555, y: 450, width: 330, height: 42 },
    { id: "load", label: "LOAD GAME", x: 555, y: 508, width: 330, height: 42 },
    { id: "settings", label: "SETTINGS", x: 555, y: 566, width: 330, height: 42 },
    { id: "lore", label: "LORE", x: 555, y: 624, width: 330, height: 42 },
    { id: getStartMenuSystemActionId(), label: getStartMenuSystemActionLabel(), x: 555, y: 682, width: 330, height: 42 },
  ];

  for (const button of menuButtonRects) {
    const isActive = button.id === activeId;
    ctx.save();
    ctx.fillStyle = isActive ? "rgba(16, 16, 18, 0.66)" : "rgba(10, 10, 11, 0.48)";
    ctx.shadowColor = "rgba(0, 0, 0, 0.36)";
    ctx.shadowBlur = 10;
    drawMenuButtonRect(ctx, button.x, button.y, button.width, button.height, 5);
    ctx.fill();

    ctx.shadowBlur = isActive ? 6 : 0;
    ctx.fillStyle = "#ffffff";
    ctx.font = '400 16px "Albert Sans", sans-serif';
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillText(button.label, centerX, button.y + button.height / 2 + 0.5);
    ctx.restore();
  }

  const status = menuStatus.textContent.trim();
  if (status) {
    ctx.save();
    ctx.fillStyle = "rgba(255, 255, 255, 0.46)";
    ctx.font = '500 18px "Albert Sans", sans-serif';
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillText(status, centerX, 744);
    ctx.restore();
  }

  menuPlaneTexture.needsUpdate = true;
  renderStartMenuScene();
}

function drawMenuButtonRect(ctx, x, y, width, height, radius) {
  const r = Math.min(radius, width / 2, height / 2);
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.lineTo(x + width - r, y);
  ctx.quadraticCurveTo(x + width, y, x + width, y + r);
  ctx.lineTo(x + width, y + height - r);
  ctx.quadraticCurveTo(x + width, y + height, x + width - r, y + height);
  ctx.lineTo(x + r, y + height);
  ctx.quadraticCurveTo(x, y + height, x, y + height - r);
  ctx.lineTo(x, y + r);
  ctx.quadraticCurveTo(x, y, x + r, y);
  ctx.closePath();
}

function startMenuAnimationLoop() {
  if (isAppExited || !isStartMenuOpen || !menuScene || menuAnimationFrameId !== null) {
    return;
  }

  menuLastFrameTime = performance.now();
  menuAnimationFrameId = requestAnimationFrame(animateStartMenu);
}

function stopMenuAnimationLoop() {
  if (menuAnimationFrameId === null) {
    return;
  }

  cancelAnimationFrame(menuAnimationFrameId);
  menuAnimationFrameId = null;
}

function animateStartMenu() {
  menuAnimationFrameId = null;
  if (isAppExited || !isStartMenuOpen || !menuScene) {
    return;
  }

  const now = performance.now();
  const deltaSeconds = Math.min(0.05, (now - menuLastFrameTime) / 1000);
  menuLastFrameTime = now;

  if (menuGroup) {
    menuGroup.rotation.x = THREE.MathUtils.lerp(menuGroup.rotation.x, menuRotationTargetX, 0.1);
    menuGroup.rotation.y = THREE.MathUtils.lerp(menuGroup.rotation.y, menuRotationTargetY, 0.1);
  }
  if (menuStars) {
    menuStars.rotation.x = THREE.MathUtils.lerp(menuStars.rotation.x, menuStarsRotationTargetX, 0.08);
    menuStars.rotation.y = THREE.MathUtils.lerp(menuStars.rotation.y, menuStarsRotationTargetY, 0.08);
  }
  if (menuStarLinks) {
    menuStarLinks.rotation.x = THREE.MathUtils.lerp(menuStarLinks.rotation.x, menuStarsRotationTargetX, 0.08);
    menuStarLinks.rotation.y = THREE.MathUtils.lerp(menuStarLinks.rotation.y, menuStarsRotationTargetY, 0.08);
  }
  updateStartMenuStarTrail(deltaSeconds);

  renderStartMenuScene();
  menuAnimationFrameId = requestAnimationFrame(animateStartMenu);
}

function isStartMenuMotionActive() {
  const epsilon = 0.0006;
  return (
    Math.abs((menuGroup?.rotation.x ?? 0) - menuRotationTargetX) > epsilon ||
    Math.abs((menuGroup?.rotation.y ?? 0) - menuRotationTargetY) > epsilon ||
    Math.abs((menuStars?.rotation.x ?? 0) - menuStarsRotationTargetX) > epsilon ||
    Math.abs((menuStars?.rotation.y ?? 0) - menuStarsRotationTargetY) > epsilon
  );
}

function renderStartMenuScene() {
  if (!menuScene || !menuCamera || isGameRuntimeReady || isAppExited) {
    return;
  }

  if (!menuBackgroundTarget || !menuCompositeScene || !menuCompositeCamera || !menuCompositeMaterial) {
    renderer.clear(true, true, true);
    renderer.render(menuScene, menuCamera);
    return;
  }

  updateStartMenuBlurRects();

  const previousAutoClear = renderer.autoClear;
  const previousRenderTarget = renderer.getRenderTarget();
  const wasMenuGroupVisible = menuGroup?.visible ?? true;
  const wasMenuSkyVisible = menuSky?.visible ?? true;
  const wasMenuStarsVisible = menuStars?.visible ?? true;
  const wasMenuStarLinksVisible = menuStarLinks?.visible ?? true;

  if (menuGroup) {
    menuGroup.visible = false;
  }
  renderer.autoClear = true;
  renderer.setRenderTarget(menuBackgroundTarget);
  renderer.clear(true, true, true);
  renderer.render(menuScene, menuCamera);

  renderer.setRenderTarget(null);
  renderer.autoClear = true;
  renderer.clear(true, true, true);
  renderer.render(menuScene, menuCamera);
  renderer.autoClear = false;
  renderer.render(menuCompositeScene, menuCompositeCamera);

  if (menuGroup) {
    menuGroup.visible = wasMenuGroupVisible;
  }

  if (menuSky) {
    menuSky.visible = false;
  }
  if (menuStars) {
    menuStars.visible = false;
  }
  if (menuStarLinks) {
    menuStarLinks.visible = false;
  }

  renderer.clearDepth();
  renderer.render(menuScene, menuCamera);

  if (menuSky) {
    menuSky.visible = wasMenuSkyVisible;
  }
  if (menuStars) {
    menuStars.visible = wasMenuStarsVisible;
  }
  if (menuStarLinks) {
    menuStarLinks.visible = wasMenuStarLinksVisible;
  }
  renderer.autoClear = previousAutoClear;
  renderer.setRenderTarget(previousRenderTarget);
}

function updateStartMenuBlurRects() {
  if (!menuCompositeMaterial || !menuPlane || !menuCamera) {
    return;
  }

  const rectUniforms = menuCompositeMaterial.uniforms.blurRects.value;
  const rects = menuButtonRects.slice(0, MENU_BUTTON_BLUR_MAX_RECTS);
  menuPlane.updateMatrixWorld(true);
  menuCamera.updateMatrixWorld(true);

  for (let index = 0; index < rectUniforms.length; index += 1) {
    if (index >= rects.length) {
      rectUniforms[index].set(0, 0, 0, 0);
      continue;
    }

    const rect = projectMenuButtonRect(rects[index]);
    rectUniforms[index].copy(rect);
  }
  menuCompositeMaterial.uniforms.rectCount.value = rects.length;
}

function projectMenuButtonRect(button, padding = 0) {
  const left = Math.max(0, button.x - padding);
  const right = Math.min(MENU_TEXTURE_WIDTH, button.x + button.width + padding);
  const top = Math.max(0, button.y - padding);
  const bottom = Math.min(MENU_TEXTURE_HEIGHT, button.y + button.height + padding);
  const corners = [
    menuTexturePointToPlaneVector(left, top),
    menuTexturePointToPlaneVector(right, top),
    menuTexturePointToPlaneVector(right, bottom),
    menuTexturePointToPlaneVector(left, bottom),
  ];

  let minX = 1;
  let minY = 1;
  let maxX = 0;
  let maxY = 0;
  for (const corner of corners) {
    corner.applyMatrix4(menuPlane.matrixWorld).project(menuCamera);
    const x = corner.x * 0.5 + 0.5;
    const y = corner.y * 0.5 + 0.5;
    minX = Math.min(minX, x);
    minY = Math.min(minY, y);
    maxX = Math.max(maxX, x);
    maxY = Math.max(maxY, y);
  }

  return new THREE.Vector4(
    THREE.MathUtils.clamp(minX, 0, 1),
    THREE.MathUtils.clamp(minY, 0, 1),
    THREE.MathUtils.clamp(maxX, 0, 1),
    THREE.MathUtils.clamp(maxY, 0, 1),
  );
}

function menuTexturePointToPlaneVector(x, y) {
  return new THREE.Vector3(
    (x / MENU_TEXTURE_WIDTH - 0.5) * MENU_PLANE_WIDTH,
    (0.5 - y / MENU_TEXTURE_HEIGHT) * MENU_PLANE_HEIGHT,
    0,
  );
}

function resizeStartMenuScene(width = window.innerWidth, height = window.innerHeight) {
  if (!menuScene || !menuCamera || !menuGroup) {
    return;
  }

  const pixelRatio = Math.min(window.devicePixelRatio, 2);
  renderer.setPixelRatio(pixelRatio);
  renderer.setSize(width, height, false);
  menuCamera.aspect = width / height;
  menuCamera.updateProjectionMatrix();

  const visibleHeight = 2 * menuCamera.position.z * Math.tan(THREE.MathUtils.degToRad(menuCamera.fov / 2));
  const visibleWidth = visibleHeight * menuCamera.aspect;
  const targetWidth = Math.min(MENU_PLANE_WIDTH, visibleWidth * 1.42);
  const targetHeight = Math.min(MENU_PLANE_HEIGHT, visibleHeight * 0.84);
  const scale = Math.min(targetWidth / MENU_PLANE_WIDTH, targetHeight / MENU_PLANE_HEIGHT);
  menuGroup.scale.setScalar(scale);
  resizeStartMenuComposite(width, height, pixelRatio);
  renderStartMenuScene();
}

function resizeStartMenuComposite(width, height, pixelRatio = Math.min(window.devicePixelRatio, 2)) {
  if (!menuBackgroundTarget || !menuCompositeMaterial) {
    return;
  }

  const targetWidth = Math.max(1, Math.floor(width * pixelRatio));
  const targetHeight = Math.max(1, Math.floor(height * pixelRatio));
  menuBackgroundTarget.setSize(targetWidth, targetHeight);
  menuCompositeMaterial.uniforms.resolution.value.set(targetWidth, targetHeight);
}

function onStartMenuPointerMove(event) {
  if (!isStartMenuOpen || !menuScene || !startMenu.contains(event.target)) {
    return;
  }

  if (event.target instanceof Element && event.target.closest(".menu-dialog__surface")) {
    return;
  }

  const rect = sceneCanvas.getBoundingClientRect();
  const pointerX = ((event.clientX - rect.left) / rect.width) * 2 - 1;
  const pointerY = -(((event.clientY - rect.top) / rect.height) * 2 - 1);
  menuRotationTargetY = THREE.MathUtils.clamp(pointerX * 0.11, -0.12, 0.12);
  menuRotationTargetX = THREE.MathUtils.clamp(-pointerY * 0.075, -0.085, 0.085);
  menuStarsRotationTargetY = THREE.MathUtils.clamp(pointerX * 0.045, -0.05, 0.05);
  menuStarsRotationTargetX = THREE.MathUtils.clamp(-pointerY * 0.032, -0.038, 0.038);
  startMenuAnimationLoop();

  const nextButton = getStartMenuButtonAt(event.clientX, event.clientY);
  if (nextButton?.id !== menuActiveButton?.id) {
    if (nextButton) {
      playUiHoverSound();
    }
    menuActiveButton = nextButton;
    updateMenuPlaneTexture();
  }
}

function clearStartMenuPointer() {
  menuRotationTargetX = 0;
  menuRotationTargetY = 0;
  menuStarsRotationTargetX = 0;
  menuStarsRotationTargetY = 0;
  startMenuAnimationLoop();
  if (menuActiveButton) {
    menuActiveButton = null;
    updateMenuPlaneTexture();
  }
}

function onStartMenuClick(event) {
  if (!isStartMenuOpen || !menuScene || isStartMenuDialogOpen()) {
    return;
  }

  if (event.target instanceof Element && event.target.closest(".menu-dialog__surface")) {
    return;
  }

  const button = getStartMenuButtonAt(event.clientX, event.clientY);
  if (!button) {
    return;
  }

  event.preventDefault();
  if (!(event.target instanceof Element) || !event.target.closest(UI_MENU_CLICK_SOUND_SELECTOR)) {
    playUiMenuClickSound();
  }
  if (button.id === "new") {
    resetNewGameDialog();
    openMenuDialog(seedDialog, menuSeedInput);
    return;
  }
  if (button.id === "load") {
    openLoadGameDialog();
    return;
  }
  if (button.id === "settings") {
    openSettingsDialog();
    return;
  }
  if (button.id === "lore") {
    return;
  }
  if (button.id === "exit" || button.id === "pwa") {
    runStartMenuSystemAction();
  }
}

function getStartMenuButtonAt(clientX, clientY) {
  const hit = getStartMenuPlaneHit(clientX, clientY);
  if (!hit) {
    return null;
  }

  return menuButtonRects.find((button) => (
    hit.x >= button.x &&
    hit.x <= button.x + button.width &&
    hit.y >= button.y &&
    hit.y <= button.y + button.height
  )) ?? null;
}

function getStartMenuPlaneHit(clientX, clientY) {
  if (!menuPlane || !menuCamera) {
    return null;
  }

  const rect = sceneCanvas.getBoundingClientRect();
  menuPointer.set(
    ((clientX - rect.left) / rect.width) * 2 - 1,
    -(((clientY - rect.top) / rect.height) * 2 - 1),
  );
  menuRaycaster.setFromCamera(menuPointer, menuCamera);
  const hit = menuRaycaster.intersectObject(menuPlane, false)[0];
  if (!hit?.uv) {
    return null;
  }

  return {
    x: hit.uv.x * MENU_TEXTURE_WIDTH,
    y: (1 - hit.uv.y) * MENU_TEXTURE_HEIGHT,
  };
}

function setMenuStatus(status) {
  menuStatus.textContent = status;
  updateMenuPlaneTexture();
}

function disposeStartMenuScene() {
  stopMenuAnimationLoop();
  document.body.classList.remove("menu-scene-active");
  menuActiveButton = null;
  menuButtonRects = [];

  if (menuSky) {
    menuSky.geometry.dispose();
    menuSky.material.dispose();
    menuSky = null;
  }
  if (menuPlane) {
    menuPlane.geometry.dispose();
    menuPlane.material.map?.dispose();
    menuPlane.material.dispose();
    menuPlane = null;
  }
  if (menuCompositeQuad) {
    menuCompositeQuad.geometry.dispose();
    menuCompositeScene?.remove(menuCompositeQuad);
    menuCompositeQuad = null;
  }
  if (menuCompositeMaterial) {
    menuCompositeMaterial.dispose();
    menuCompositeMaterial = null;
  }
  if (menuBackgroundTarget) {
    menuBackgroundTarget.dispose();
    menuBackgroundTarget = null;
  }
  menuCompositeScene = null;
  menuCompositeCamera = null;
  if (menuStars) {
    menuStars.geometry.dispose();
    menuStars.material.dispose();
    menuStars = null;
  }
  if (menuStarLinks) {
    for (const pilot of menuStarPilots) {
      for (const segment of pilot.segments) {
        disposeStartMenuStarLink(segment);
      }
      if (pilot.glow) {
        menuStarLinks.remove(pilot.glow);
        pilot.glow.material.dispose();
        pilot.glow = null;
      }
    }
    menuStarLinks.clear();
    menuStarLinks = null;
  }
  menuStarGlowTexture?.dispose();
  menuStarGlowTexture = null;
  menuStarPoints = [];
  menuStarTrailIndices = [];
  menuStarPilots = [];
  menuStarPilotSerial = 0;
  menuScene?.clear();
  menuScene = null;
  menuCamera = null;
  menuGroup = null;
  menuPlaneTexture = null;
  menuPlaneCanvas = null;
  menuPlaneContext = null;
}

function openMenuDialog(dialog, focusTarget = null) {
  menuActiveButton = null;
  updateMenuPlaneTexture();
  closeMenuDialogs();
  dialog.hidden = false;
  window.requestAnimationFrame(() => {
    focusTarget?.focus();
    focusTarget?.select?.();
  });
}

function closeMenuDialogs() {
  setNewGameScenarioDropdownOpen(false);
  seedDialog.hidden = true;
  loadDialog.hidden = true;
  settingsDialog.hidden = true;
}

function isStartMenuDialogOpen() {
  return !seedDialog.hidden || !loadDialog.hidden || !settingsDialog.hidden;
}

function openGameMenuDialog() {
  if (isStartMenuOpen || isAppExited) {
    return;
  }

  closeGameDialogs();
  pauseGameInteractions();
  gameMenuDialog.hidden = false;
  window.requestAnimationFrame(() => gameSaveGame.focus());
}

function openGameSaveDialog() {
  if (isStartMenuOpen || isAppExited) {
    return;
  }

  closeGameDialogs();
  pauseGameInteractions();
  renderGameSaveDialog();
  gameSaveDialog.hidden = false;
  window.requestAnimationFrame(() => gameSaveAdd.focus());
}

function openGameSettingsDialog() {
  if (isStartMenuOpen || isAppExited) {
    return;
  }

  closeGameDialogs();
  pauseGameInteractions();
  syncSettingsDialog();
  gameSettingsDialog.hidden = false;
  window.requestAnimationFrame(() => gameMasterVolume.focus());
}

function closeGameDialogs() {
  gameMenuDialog.hidden = true;
  gameSaveDialog.hidden = true;
  gameSettingsDialog.hidden = true;
  selectedGameSaveIndex = -1;
  isAddingGameSave = false;
  gameSaveDraftName = "";
}

function isGameDialogOpen() {
  return !gameMenuDialog.hidden || !gameSaveDialog.hidden || !gameSettingsDialog.hidden;
}

function pauseGameInteractions() {
  cancelGraphDrag();
  clearGraphHover();
  setSystemHover(null);
}

function navigateGameBreadcrumbToStarmap() {
  if (!isGameBreadcrumbEnabled(gameBreadcrumbStarmap)) {
    return;
  }

  closeStarWindow();
  updateGameNavigationUi(true);
}

function navigateGameBreadcrumbToSystem() {
  if (!isGameBreadcrumbEnabled(gameBreadcrumbSystem)) {
    return;
  }

  if (isObjectDetailOpen) {
    returnToStarSystemFromObjectDetail();
    return;
  }
  if (planetScreenController?.isOpen?.()) {
    returnToStarSystemFromPlanet();
  }
}

function navigateGameBreadcrumbToOrbit() {
  if (!isGameBreadcrumbEnabled(gameBreadcrumbOrbit) || !isObjectDetailOpen) {
    return;
  }

  returnToOrbitFromObjectDetail();
}

function signCurrentTurn() {
  if (isStartMenuOpen || isEditorMode || isGameDialogOpen()) {
    return;
  }

  currentGameState = advanceGameTurnState(currentGameState);
  clearSelectedFleetIfInactive();
  renderFleetActionPanel();
  autosaveCurrentTurnState();
  renderTurnOrderUi();
  refreshSystemGateAccess();
  refreshSystemPlanetAccess();
  rerenderActiveSystemFleetMarkers();
  refreshOwnershipVisualsAfterGameStateChange();
  enforceCurrentViewExplorationAccess();
  persistRuntimeSession();
}

function advanceGameTurnState(gameState) {
  const state = normalizeGameState(gameState);
  const sideCount = getGameStateSideCount(state);
  if (sideCount <= 0) {
    return normalizeGameState({
      ...state,
      turn: getGameTurnNumber(state) + 1,
    });
  }

  const activeSideIndex = normalizeTurnSideIndex(state.activeSideIndex, sideCount);
  const completedSideIndices = new Set(normalizeCompletedSideIndices(state.completedSideIndices, sideCount));
  completedSideIndices.add(activeSideIndex);

  if (completedSideIndices.size >= sideCount) {
    return normalizeGameState({
      ...state,
      turn: getGameTurnNumber(state) + 1,
      activeSideIndex: 0,
      completedSideIndices: [],
    });
  }

  return normalizeGameState({
    ...state,
    activeSideIndex: getNextPendingSideIndex(activeSideIndex, completedSideIndices, sideCount),
    completedSideIndices: Array.from(completedSideIndices),
  });
}

function getNextPendingSideIndex(activeSideIndex, completedSideIndices, sideCount) {
  for (let offset = 1; offset <= sideCount; offset += 1) {
    const index = (activeSideIndex + offset) % sideCount;
    if (!completedSideIndices.has(index)) {
      return index;
    }
  }
  return 0;
}

function autosaveCurrentTurnState() {
  const timestamp = new Date().toISOString();
  const state = serializeCurrentGameState();
  const saves = readMenuSaves();
  const activeFileName = state.saveFileName;
  const existingIndex = activeFileName
    ? saves.findIndex((save) => save.fileName === activeFileName)
    : -1;

  if (existingIndex >= 0) {
    const previousSave = saves[existingIndex];
    const save = createGameSaveFromState(previousSave.name, previousSave.seed, state, timestamp, previousSave);
    saves[existingIndex] = save;
    currentGameState = normalizeGameState(save.gameState);
    writeMenuSaves(saves);
    return;
  }

  const seed = state.setup?.seed ?? SEED;
  const save = createGameSaveFromState(`${seed} AUTOSAVE`, seed, state, timestamp);
  saves.push(save);
  currentGameState = normalizeGameState(save.gameState);
  writeMenuSaves(saves);
}

function isGameBreadcrumbEnabled(button) {
  return Boolean(button && button.getAttribute("aria-disabled") !== "true");
}

function updateGameNavigationUi(force = false) {
  if (!gameBreadcrumbButtons.length) {
    return;
  }

  const view = getCurrentRuntimeView();
  const canGoStarmap = view === "system" || view === "planet" || view === "detail";
  const canGoSystem = (view === "planet" || view === "detail") && Boolean(systemScreenController?.state?.activeNode);
  const canGoOrbit = view === "detail" && Boolean(objectDetailOrbitPlanet);
  const key = [
    view,
    canGoStarmap ? 1 : 0,
    canGoSystem ? 1 : 0,
    canGoOrbit ? 1 : 0,
  ].join(":");
  if (!force && key === lastGameNavigationUiKey) {
    return;
  }
  lastGameNavigationUiKey = key;

  setGameBreadcrumbState(gameBreadcrumbStarmap, canGoStarmap);
  setGameBreadcrumbState(gameBreadcrumbSystem, canGoSystem);
  setGameBreadcrumbState(gameBreadcrumbOrbit, canGoOrbit);
}

function setGameBreadcrumbState(button, isEnabled) {
  if (!button) {
    return;
  }

  button.setAttribute("aria-disabled", String(!isEnabled));
  button.tabIndex = isEnabled ? 0 : -1;
}

function renderTurnOrderUi() {
  if (!turnOrderTrack) {
    return;
  }

  const state = normalizeGameState(currentGameState);
  const sides = getGameStateSides(state);
  turnOrderTrack.replaceChildren();
  turnOrderTrack.hidden = sides.length === 0;
  turnOrderTrack.classList.toggle("turn-order-track--full", sides.length >= NEW_GAME_MAX_SIDE_COUNT);
  turnOrderTrack.style.setProperty("--turn-side-count", String(Math.max(1, sides.length)));
  if (sides.length === 0) {
    turnOrderTrack.removeAttribute("aria-label");
    return;
  }

  const activeSideIndex = normalizeTurnSideIndex(state.activeSideIndex, sides.length);
  const completedSideIndices = new Set(normalizeCompletedSideIndices(state.completedSideIndices, sides.length));
  sides.forEach((side, index) => {
    const token = document.createElement("span");
    const isCompleted = completedSideIndices.has(index);
    token.className = "turn-order-token";
    token.classList.toggle("turn-order-token--active", index === activeSideIndex);
    token.classList.toggle("turn-order-token--completed", isCompleted);
    token.style.setProperty("--turn-side-color", normalizeCssColor(side.color, createNewGameSideColor(index, state.setup?.seed ?? SEED)));
    token.title = `${side.name} - ${isCompleted ? "SIGNED" : index === activeSideIndex ? "ACTIVE" : "WAITING"}`;
    token.setAttribute("aria-label", token.title);
    turnOrderTrack.append(token);
  });
  turnOrderTrack.setAttribute(
    "aria-label",
    `Turn ${getGameTurnNumber(state)}, active side ${activeSideIndex + 1} of ${sides.length}`,
  );
}

function normalizeCssColor(value, fallback = "#ffffff") {
  const normalized = String(value ?? "").trim();
  return normalized || fallback;
}

function initAudioMixer() {
  if (audioMixer) {
    return;
  }

  audioMixer = createAudioMixer({
    masterVolume: audioSettings.masterVolume,
    channels: {
      ui: 0.72,
      ambient: 1,
      [MENU_ENVIRONMENT_AUDIO_CHANNEL]: 0,
      [LEGACY_ENVIRONMENT_AUDIO_CHANNEL]: 0,
    },
    sounds: UI_SOUNDS,
  });
  audioMixer.setChannelEnabled(MENU_ENVIRONMENT_AUDIO_CHANNEL, false);
  audioMixer.setChannelEnabled(LEGACY_ENVIRONMENT_AUDIO_CHANNEL, false);
  audioMixer.preload(UI_HOVER_SOUND);
  audioMixer.preload(UI_MENU_CLICK_SOUND);
  audioMixer.preload(UI_BASE_CLICK_SOUND);
  audioMixer.preload(UI_CANCEL_CLICK_SOUND);
  audioMixer.preload(UI_SCROLL_CLICK_SOUND);
  audioMixer.preload(UI_TURN_SOUND);
  audioMixer.preloadAll([
    ...FLEET_VOICE_SOUNDS,
    ...FLEET_MOVE_SOUNDS,
    FLEET_LINK_JUMP_SOUND,
  ]);
  if (isNebulumAppWindow()) {
    audioMixer.unlock();
  }
  document.addEventListener("pointerdown", unlockAudioMixer, { capture: true });
  document.addEventListener("keydown", unlockAudioMixer, { capture: true });
}

function initUiHoverSounds() {
  document.addEventListener("pointerover", onUiHoverSoundPointerOver, { capture: true });
  document.addEventListener("pointerout", onUiHoverSoundPointerOut, { capture: true });
}

function initUiClickSounds() {
  document.addEventListener("pointerdown", onUiClickSoundPointerDown, { capture: true });
}

function unlockAudioMixer() {
  audioMixer?.unlock();
}

function onUiHoverSoundPointerOver(event) {
  const target = getUiHoverSoundTarget(event);
  if (!target || target === activeUiHoverSoundElement) {
    return;
  }

  if (event.relatedTarget instanceof Node && target.contains(event.relatedTarget)) {
    return;
  }

  activeUiHoverSoundElement = target;
  playUiHoverSound();
}

function onUiHoverSoundPointerOut(event) {
  const target = getUiHoverSoundTarget(event);
  if (!target || target !== activeUiHoverSoundElement) {
    return;
  }

  if (event.relatedTarget instanceof Node && target.contains(event.relatedTarget)) {
    return;
  }

  activeUiHoverSoundElement = null;
}

function getUiHoverSoundTarget(event) {
  if (!(event.target instanceof Element)) {
    return null;
  }

  const target = event.target.closest(UI_HOVER_SOUND_SELECTOR);
  if (!target || target.disabled || target.hidden || target.getAttribute("aria-disabled") === "true") {
    return null;
  }
  return target;
}

function playUiHoverSound() {
  audioMixer?.play(UI_HOVER_SOUND, {
    channel: "ui",
    volume: 0.82,
  });
}

function onUiClickSoundPointerDown(event) {
  const target = getUiButtonClickSoundTarget(event);
  if (!target) {
    return;
  }

  if (target.matches(".fleet-action-button--ping")) {
    return;
  }

  if (target.matches(UI_SCROLL_CLICK_SOUND_SELECTOR)) {
    playUiScrollClickSound();
    return;
  }

  if (target === signTurnButton) {
    playUiTurnSound();
    return;
  }

  if (target.matches(UI_BASE_CLICK_SOUND_SELECTOR)) {
    playUiBaseClickSound();
    return;
  }

  if (isCancelButton(target)) {
    playUiCancelClickSound();
    return;
  }

  if (isIngameUiClickTarget(target)) {
    playUiBaseClickSound();
    return;
  }

  playUiMenuClickSound();
}

function getUiButtonClickSoundTarget(event) {
  if (!(event.target instanceof Element)) {
    return null;
  }

  const target = event.target.closest("button");
  if (!target || target.disabled || target.hidden || target.getAttribute("aria-disabled") === "true") {
    return null;
  }
  return target;
}

function isCancelButton(target) {
  const label = target.textContent.trim().toUpperCase();
  return label === "CANCEL" || label === "CLOSE";
}

function isIngameUiClickTarget(target) {
  return !isStartMenuOpen || !target.closest("#start-menu");
}

function playUiMenuClickSound() {
  audioMixer?.play(UI_MENU_CLICK_SOUND, {
    channel: "ui",
    volume: 0.88,
  });
}

function playUiBaseClickSound() {
  audioMixer?.play(UI_BASE_CLICK_SOUND, {
    channel: "ui",
    volume: 0.86,
  });
}

function playUiCancelClickSound() {
  audioMixer?.play(UI_CANCEL_CLICK_SOUND, {
    channel: "ui",
    volume: 0.9,
  });
}

function playUiScrollClickSound() {
  audioMixer?.play(UI_SCROLL_CLICK_SOUND, {
    channel: "ui",
    volume: 0.84,
  });
}

function playUiTurnSound() {
  audioMixer?.play(UI_TURN_SOUND, {
    channel: "ui",
    volume: 0.92,
  });
}

function playRandomFleetVoiceSound(fleet) {
  playRandomIngameSound(getFleetVoiceSounds(fleet), {
    volume: 0.9,
  });
}

function getFleetVoiceSounds(fleet) {
  if (fleet?.commander?.gender === "female") {
    return FLEET_VOICE_FEMALE_SOUNDS;
  }
  if (fleet?.commander?.gender === "male") {
    return FLEET_VOICE_MALE_SOUNDS;
  }
  return FLEET_VOICE_SOUNDS;
}

function playRandomFleetMoveSound() {
  const sound = getNextFleetMoveSound();
  if (!sound) {
    return;
  }
  audioMixer?.play(sound, {
    channel: "ui",
    volume: 0.82,
  });
}

function playFleetLinkJumpSound() {
  audioMixer?.play(FLEET_LINK_JUMP_SOUND, {
    channel: "ui",
    volume: 0.88,
  });
}

function playRandomIngameSound(sounds, options = {}) {
  if (!audioMixer || !Array.isArray(sounds) || sounds.length === 0) {
    return;
  }

  const sound = sounds[Math.floor(Math.random() * sounds.length)];
  audioMixer.play(sound, {
    channel: "ui",
    ...options,
  });
}

function getNextFleetMoveSound() {
  if (FLEET_MOVE_SOUNDS.length === 0) {
    return null;
  }

  if (fleetMoveSoundDeck.length === 0) {
    fleetMoveSoundDeck = shuffleAudioDeck(FLEET_MOVE_SOUNDS);
    if (
      fleetMoveSoundDeck.length > 1 &&
      lastFleetMoveSound &&
      fleetMoveSoundDeck[0] === lastFleetMoveSound
    ) {
      [fleetMoveSoundDeck[0], fleetMoveSoundDeck[1]] = [fleetMoveSoundDeck[1], fleetMoveSoundDeck[0]];
    }
  }

  lastFleetMoveSound = fleetMoveSoundDeck.shift() ?? null;
  return lastFleetMoveSound;
}

function shuffleAudioDeck(sounds) {
  const deck = sounds.slice();
  for (let index = deck.length - 1; index > 0; index -= 1) {
    const swapIndex = Math.floor(Math.random() * (index + 1));
    [deck[index], deck[swapIndex]] = [deck[swapIndex], deck[index]];
  }
  return deck;
}

function startMenuEnvironmentMachine() {
  if (!audioMixer || menuEnvironmentMachine || !isStartMenuOpen || isAppExited || shouldStartGameAfterInit) {
    return;
  }

  isMenuEnvironmentAudioEnabled = true;
  audioMixer.setChannelEnabled(MENU_ENVIRONMENT_AUDIO_CHANNEL, true);
  audioMixer.setChannelVolume(MENU_ENVIRONMENT_AUDIO_CHANNEL, getEnvironmentChannelVolume());
  menuEnvironmentMachine = audioMixer.createAmbientMachine(
    RADIO_CHATTER_FEED_MACHINE.id,
    RADIO_CHATTER_FEED_MACHINE,
  );
  menuEnvironmentMachine.start();
}

function stopMenuEnvironmentMachine() {
  isMenuEnvironmentAudioEnabled = false;
  audioMixer?.setChannelVolume(MENU_ENVIRONMENT_AUDIO_CHANNEL, 0);
  audioMixer?.setChannelVolume(LEGACY_ENVIRONMENT_AUDIO_CHANNEL, 0);
  audioMixer?.setChannelEnabled(MENU_ENVIRONMENT_AUDIO_CHANNEL, false);
  audioMixer?.setChannelEnabled(LEGACY_ENVIRONMENT_AUDIO_CHANNEL, false);
  if (menuEnvironmentMachine) {
    menuEnvironmentMachine.stop();
    menuEnvironmentMachine = null;
  }
  audioMixer?.stopAmbientMachine(RADIO_CHATTER_FEED_MACHINE.id);
  audioMixer?.stopChannel(MENU_ENVIRONMENT_AUDIO_CHANNEL);
  audioMixer?.stopChannel(LEGACY_ENVIRONMENT_AUDIO_CHANNEL);
}

function enforceNoMenuEnvironmentAudioInGame() {
  if (isStartMenuOpen || !audioMixer) {
    return;
  }
  stopMenuEnvironmentMachine();
}

function getEnvironmentChannelVolume() {
  if (
    !isMenuEnvironmentAudioEnabled
    || !isStartMenuOpen
    || isAppExited
    || shouldStartGameAfterInit
    || document.body.classList.contains("game-running")
  ) {
    return 0;
  }
  return audioSettings.environmentVolume;
}

function openSettingsDialog() {
  syncSettingsDialog();
  openMenuDialog(settingsDialog, menuMasterVolume);
}

function readAudioSettings() {
  try {
    const settings = JSON.parse(localStorage.getItem(AUDIO_SETTINGS_STORAGE_KEY) || "{}");
    return {
      masterVolume: THREE.MathUtils.clamp(Number(settings.masterVolume ?? 1), 0, 1),
      environmentVolume: THREE.MathUtils.clamp(Number(settings.environmentVolume ?? 0.35), 0, 1),
      menuMusicEnabled: settings.menuMusicEnabled !== false,
      showMusicPlayer: settings.showMusicPlayer !== false,
    };
  } catch {
    return {
      masterVolume: 1,
      environmentVolume: 0.35,
      menuMusicEnabled: true,
      showMusicPlayer: true,
    };
  }
}

function readGameUiSettings() {
  try {
    const settings = JSON.parse(localStorage.getItem(GAME_UI_SETTINGS_STORAGE_KEY) || "{}");
    return {
      spaceGradientVisible: settings.spaceGradientVisible === true,
    };
  } catch {
    return {
      spaceGradientVisible: false,
    };
  }
}

function readWindowSettings() {
  try {
    const settings = JSON.parse(localStorage.getItem(WINDOW_SETTINGS_STORAGE_KEY) || "{}");
    return {
      borderlessWindow: settings.borderlessWindow === true,
    };
  } catch {
    return {
      borderlessWindow: false,
    };
  }
}

function writeAudioSettings() {
  localStorage.setItem(AUDIO_SETTINGS_STORAGE_KEY, JSON.stringify(audioSettings));
}

function writeGameUiSettings() {
  localStorage.setItem(GAME_UI_SETTINGS_STORAGE_KEY, JSON.stringify(gameUiSettings));
}

function syncSettingsDialog() {
  const volume = String(audioSettings.masterVolume);
  for (const volumeInput of [menuMasterVolume, gameMasterVolume]) {
    volumeInput.value = volume;
    volumeInput.style.setProperty("--settings-vol-frac", volume);
  }
  const environmentVolume = String(audioSettings.environmentVolume);
  for (const environmentInput of [menuEnvironmentVolume, gameEnvironmentVolume]) {
    environmentInput.value = environmentVolume;
    environmentInput.style.setProperty("--settings-vol-frac", environmentVolume);
  }
  for (const musicToggle of [menuMusicEnabled, gameMenuMusicEnabled]) {
    musicToggle.checked = audioSettings.menuMusicEnabled;
  }
  for (const playerToggle of [menuShowMusicPlayer, gameShowMusicPlayer]) {
    playerToggle.checked = audioSettings.showMusicPlayer;
  }
  gameSpaceGradientEnabled.checked = gameUiSettings.spaceGradientVisible;
  gameSpaceGradientSetting.hidden = isEditorMode;
  for (const windowToggle of [menuBorderlessWindow, gameBorderlessWindow]) {
    windowToggle.checked = windowSettings.borderlessWindow;
  }
}

function updateAudioSettingsFromMenu(event) {
  const source = event?.target;
  const volume = source === gameMasterVolume
    ? Number(gameMasterVolume.value)
    : source === menuMasterVolume
      ? Number(menuMasterVolume.value)
      : audioSettings.masterVolume;
  const environmentVolume = source === gameEnvironmentVolume
    ? Number(gameEnvironmentVolume.value)
    : source === menuEnvironmentVolume
      ? Number(menuEnvironmentVolume.value)
      : audioSettings.environmentVolume;
  const menuMusicEnabledValue = source === gameMenuMusicEnabled
    ? gameMenuMusicEnabled.checked
    : source === menuMusicEnabled
      ? menuMusicEnabled.checked
      : audioSettings.menuMusicEnabled;
  const showMusicPlayerValue = source === gameShowMusicPlayer
    ? gameShowMusicPlayer.checked
    : source === menuShowMusicPlayer
      ? menuShowMusicPlayer.checked
      : audioSettings.showMusicPlayer;

  audioSettings = {
    masterVolume: THREE.MathUtils.clamp(volume, 0, 1),
    environmentVolume: THREE.MathUtils.clamp(environmentVolume, 0, 1),
    menuMusicEnabled: menuMusicEnabledValue,
    showMusicPlayer: showMusicPlayerValue,
  };
  syncSettingsDialog();
  writeAudioSettings();
  applyAudioSettings();
}

function updateGameUiSettingsFromMenu() {
  gameUiSettings = {
    spaceGradientVisible: gameSpaceGradientEnabled.checked,
  };
  syncSettingsDialog();
  writeGameUiSettings();
  applyGameUiSettings();
}

function applyAudioSettings() {
  menuMusicAudio.volume = getMenuMusicVolume();
  audioMixer?.setMasterVolume(audioSettings.masterVolume);
  audioMixer?.setChannelVolume(MENU_ENVIRONMENT_AUDIO_CHANNEL, getEnvironmentChannelVolume());
  audioMixer?.setChannelVolume(LEGACY_ENVIRONMENT_AUDIO_CHANNEL, 0);
  musicPlayerController?.setMasterVolume(audioSettings.masterVolume);
  applyMusicPlayerVisibility();
  if (!audioSettings.menuMusicEnabled) {
    menuMusicAudio.pause();
    return;
  }
  if (isStartMenuOpen && !isAppExited) {
    playMenuMusic();
  }
}

function applyMusicPlayerVisibility() {
  document.body.classList.toggle("music-player-hidden", !audioSettings.showMusicPlayer);
  if (!audioSettings.showMusicPlayer) {
    musicPlayerController?.closeDropdown();
    musicPlayerController?.cancelDrag();
  }
}

function applyGameUiSettings() {
  document.body.classList.toggle(
    "space-gradient-visible",
    !isEditorMode && gameUiSettings.spaceGradientVisible,
  );
}

async function syncWindowSettingsFromServer() {
  try {
    const response = await fetch("/api/window-settings", { cache: "no-store" });
    if (!response.ok) {
      return;
    }

    const settings = await response.json();
    windowSettings = {
      borderlessWindow: settings.borderlessWindow === true,
    };
    localStorage.setItem(WINDOW_SETTINGS_STORAGE_KEY, JSON.stringify(windowSettings));
    syncSettingsDialog();
    applyWindowSettings();
  } catch {}
}

function updateWindowSettingsFromMenu(event) {
  const source = event?.target;
  const borderlessWindow = source === gameBorderlessWindow
    ? gameBorderlessWindow.checked
    : source === menuBorderlessWindow
      ? menuBorderlessWindow.checked
      : windowSettings.borderlessWindow;

  setBorderlessWindowSetting(borderlessWindow, { applyNow: true });
}

function syncBorderlessWindowFromManualToggle(event) {
  if (event.repeat || !isStandaloneWindowShell() || performance.now() < ignoreBorderlessKeySyncUntil) {
    return;
  }

  setBorderlessWindowSetting(!windowSettings.borderlessWindow, { applyNow: false });
}

function setBorderlessWindowSetting(borderlessWindow, { applyNow = false } = {}) {
  if (applyNow) {
    ignoreBorderlessKeySyncUntil = performance.now() + 2000;
  }
  windowSettings = { borderlessWindow };
  syncSettingsDialog();
  writeWindowSettings({ applyNow });
}

function writeWindowSettings({ applyNow = false } = {}) {
  localStorage.setItem(WINDOW_SETTINGS_STORAGE_KEY, JSON.stringify(windowSettings));
  fetch("/api/window-settings", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ ...windowSettings, applyNow }),
    keepalive: true,
  }).catch(() => {});
}

function applyWindowSettings() {
  scheduleBorderlessWindowBoundsSync();
}

function onWindowResize() {
  resize();
  scheduleBorderlessWindowBoundsSync();
}

function scheduleBorderlessWindowBoundsSync() {
  if (!shouldSyncBorderlessWindowBounds()) {
    return;
  }

  if (borderlessBoundsSyncTimer !== null) {
    clearTimeout(borderlessBoundsSyncTimer);
  }
  borderlessBoundsSyncTimer = window.setTimeout(syncBorderlessWindowBounds, 180);
}

function shouldSyncBorderlessWindowBounds() {
  if (!isStandaloneWindowShell()) {
    return false;
  }

  const screenWidth = window.screen?.width || window.screen?.availWidth || 0;
  const screenHeight = window.screen?.height || window.screen?.availHeight || 0;
  if (!screenWidth || !screenHeight) {
    return false;
  }

  const outerWidth = window.outerWidth || window.innerWidth;
  const outerHeight = window.outerHeight || window.innerHeight;
  return outerWidth < screenWidth - 24 || outerHeight < screenHeight - 48;
}

function isStandaloneWindowShell() {
  if (isPwaStandalone()) {
    return true;
  }

  const outerWidth = window.outerWidth || 0;
  const outerHeight = window.outerHeight || 0;
  const innerWidth = window.innerWidth || 0;
  const innerHeight = window.innerHeight || 0;
  if (!outerWidth || !outerHeight || !innerWidth || !innerHeight) {
    return false;
  }

  return Math.abs(outerWidth - innerWidth) <= 24 && Math.abs(outerHeight - innerHeight) <= 48;
}

function syncBorderlessWindowBounds() {
  borderlessBoundsSyncTimer = null;
  if (!shouldSyncBorderlessWindowBounds()) {
    return;
  }

  const now = performance.now();
  if (now - lastBorderlessBoundsSyncAt < 900) {
    scheduleBorderlessWindowBoundsSync();
    return;
  }
  lastBorderlessBoundsSyncAt = now;

  fetch("/api/window-bounds", {
    method: "POST",
    keepalive: true,
  }).catch(() => {});
}

function getMenuMusicVolume() {
  return 0.62 * audioSettings.masterVolume;
}

function initNewGameScenarioDropdown() {
  menuScenarioList.replaceChildren();
  Object.values(NEW_GAME_SCENARIOS).forEach((scenario) => {
    const item = document.createElement("button");
    item.className = "new-game__scenario-item";
    item.type = "button";
    item.dataset.scenarioId = scenario.id;
    item.textContent = scenario.label;
    item.addEventListener("click", () => {
      setNewGameScenario(scenario.id);
      setNewGameScenarioDropdownOpen(false);
    });
    menuScenarioList.append(item);
  });
}

function initNewGameGovernmentDropdown() {
  menuGovernmentList.replaceChildren();
  Object.values(NEW_GAME_GOVERNMENTS).forEach((government) => {
    const item = document.createElement("button");
    item.className = "new-game__government-item";
    item.type = "button";
    item.dataset.governmentId = government.id;
    item.textContent = government.label;
    item.addEventListener("click", () => {
      setNewGameGovernment(government.id);
      setNewGameGovernmentDropdownOpen(false);
    });
    menuGovernmentList.append(item);
  });
}

function resetNewGameDialog() {
  selectedNewGameScenarioId = NEW_GAME_BASIC_SCENARIO_ID;
  menuSeedInput.value = MENU_DEFAULT_SEED;
  newGamePlayerFactionName = NEW_GAME_DEFAULT_PLAYER_FACTION_NAME;
  newGamePlayerFactionColor = NEW_GAME_DEFAULT_PLAYER_FACTION_COLOR;
  selectedNewGamePlayerSideIndex = 0;
  selectedNewGameSideIndex = 0;
  pendingNewGameFactionNameFocusIndex = null;
  newGameSessionMode = NEW_GAME_MODE_HOTSEAT;
  selectedNewGameGovernmentId = NEW_GAME_DEFAULT_GOVERNMENT_ID;
  newGameAppliedState = null;
  isNewGameSetupDirty = true;
  newGameFactionCount = getClampedNewGameFactionCount(
    NEW_GAME_DEFAULT_FACTION_COUNT,
    getNewGameScenarioMaxFactions(NEW_GAME_SCENARIOS[selectedNewGameScenarioId], MENU_DEFAULT_SEED),
  );
  newGameSideConfigs = createNewGameSideConfigs(newGameFactionCount, MENU_DEFAULT_SEED);
  newGameSideConfigSeed = MENU_DEFAULT_SEED;
  renderNewGameDialog();
}

function setNewGameScenario(scenarioId) {
  if (!NEW_GAME_SCENARIOS[scenarioId]) {
    return;
  }

  selectedNewGameScenarioId = scenarioId;
  markNewGameSetupDirty();
  renderNewGameDialog();
}

function toggleNewGameSessionMode() {
  newGameSessionMode = newGameSessionMode === NEW_GAME_MODE_ONLINE
    ? NEW_GAME_MODE_HOTSEAT
    : NEW_GAME_MODE_ONLINE;
  markNewGameSetupDirty();
  renderNewGameDialog();
}

function setNewGameGovernment(governmentId) {
  if (!NEW_GAME_GOVERNMENTS[governmentId]) {
    return;
  }

  selectedNewGameGovernmentId = governmentId;
  markNewGameSetupDirty();
  renderNewGameDialog();
}

function setNewGameGovernmentDropdownOpen(isOpen) {
  menuGovernmentList.hidden = !isOpen;
  menuGovernmentCurrent.setAttribute("aria-expanded", String(isOpen));
  menuGovernmentDropdown.setAttribute("aria-expanded", String(isOpen));
}

function setNewGameScenarioDropdownOpen(isOpen) {
  menuScenarioList.hidden = !isOpen;
  menuScenarioListBackdrop.hidden = !isOpen;
  menuScenarioScrollbar.hidden = !isOpen;
  menuScenarioCurrent.setAttribute("aria-expanded", String(isOpen));
  menuScenarioDropdown.setAttribute("aria-expanded", String(isOpen));
  if (isOpen) {
    requestAnimationFrame(updateNewGameScenarioScrollbar);
  }
}

function renderNewGameDialog() {
  const scenario = NEW_GAME_SCENARIOS[selectedNewGameScenarioId] ?? NEW_GAME_SCENARIOS[NEW_GAME_BASIC_SCENARIO_ID];
  const seed = getNewGameSeed();
  const maxFactions = getNewGameScenarioMaxFactions(scenario, seed);
  newGameFactionCount = getClampedNewGameFactionCount(newGameFactionCount, maxFactions);
  syncNewGameSideConfigs(newGameFactionCount, seed);
  selectedNewGamePlayerSideIndex = THREE.MathUtils.clamp(selectedNewGamePlayerSideIndex, 0, Math.max(0, newGameFactionCount - 1));
  selectedNewGameSideIndex = THREE.MathUtils.clamp(selectedNewGameSideIndex, 0, Math.max(0, newGameFactionCount - 1));

  menuScenarioCurrent.textContent = scenario.label;
  menuScenarioImage.src = scenario.image;
  menuScenarioImage.alt = scenario.label;
  menuScenarioText.textContent = scenario.text;
  renderNewGameModeToggle();
  renderNewGameGovernment();
  menuFactionCount.value = String(newGameFactionCount);
  menuPlayerFactionName.value = newGamePlayerFactionName;
  updateNewGamePlayerFactionColor();
  if (Number.isFinite(maxFactions)) {
    menuFactionCount.max = String(maxFactions);
    menuFactionLimit.textContent = `MAX ${maxFactions}`;
  } else {
    menuFactionCount.removeAttribute("max");
    menuFactionLimit.textContent = "NO LIMIT";
  }
  updateNewGameScenarioListUi();
  updateNewGameGovernmentListUi();
  updateNewGameActions();
  renderNewGameFactionGrid(newGameFactionCount);
}

function renderNewGameModeToggle() {
  const isOnline = newGameSessionMode === NEW_GAME_MODE_ONLINE;
  menuSessionMode.classList.toggle("new-game__mode-toggle--online", isOnline);
  menuSessionMode.setAttribute("aria-pressed", String(isOnline));
}

function renderNewGameGovernment() {
  const government = NEW_GAME_GOVERNMENTS[selectedNewGameGovernmentId]
    ?? NEW_GAME_GOVERNMENTS[NEW_GAME_DEFAULT_GOVERNMENT_ID];
  menuGovernmentCurrent.textContent = government.label;
  if (government.image) {
    menuGovernmentImage.textContent = "";
    menuGovernmentImage.style.setProperty("--new-game-government-image", `url("${government.image}")`);
    menuGovernmentImage.classList.add("new-game__government-image--filled");
  } else {
    menuGovernmentImage.textContent = government.label;
    menuGovernmentImage.style.removeProperty("--new-game-government-image");
    menuGovernmentImage.classList.remove("new-game__government-image--filled");
  }
  menuGovernmentText.textContent = government.text;
}

function updateNewGameActions() {
  const scenario = NEW_GAME_SCENARIOS[selectedNewGameScenarioId] ?? NEW_GAME_SCENARIOS[NEW_GAME_BASIC_SCENARIO_ID];
  const isOnline = newGameSessionMode === NEW_GAME_MODE_ONLINE;
  const canStart = isNewGameScenarioStartable(scenario);
  menuNewGameApply.hidden = !isOnline;
  menuNewGameApply.disabled = !isOnline || !canStart || !isNewGameSetupDirty;
  menuSeedConfirm.disabled = !canStart || (isOnline && (!newGameAppliedState || isNewGameSetupDirty));
}

function markNewGameSetupDirty() {
  isNewGameSetupDirty = true;
  newGameAppliedState = null;
}

function updateNewGamePlayerFactionColor() {
  menuPlayerFactionColor.style.color = newGamePlayerFactionColor;
  menuPlayerFactionColor.setAttribute("aria-label", `Faction border color ${newGamePlayerFactionColor}`);
}

function updateNewGameScenarioListUi() {
  menuScenarioList.querySelectorAll(".new-game__scenario-item").forEach((item) => {
    item.classList.toggle("active", item.dataset.scenarioId === selectedNewGameScenarioId);
  });
  updateNewGameScenarioScrollbar();
}

function updateNewGameGovernmentListUi() {
  menuGovernmentList.querySelectorAll(".new-game__government-item").forEach((item) => {
    item.classList.toggle("active", item.dataset.governmentId === selectedNewGameGovernmentId);
  });
}

function updateNewGameScenarioScrollbar() {
  if (menuScenarioList.hidden) {
    return;
  }

  const visibleHeight = menuScenarioList.clientHeight;
  const scrollHeight = menuScenarioList.scrollHeight;
  const canScroll = scrollHeight > visibleHeight + 1;
  menuScenarioListBackdrop.style.height = `${menuScenarioList.offsetHeight}px`;
  menuScenarioScrollbar.hidden = !canScroll;
  if (!canScroll) {
    return;
  }

  const scrollMargin = 3;
  menuScenarioScrollbar.style.height = `${menuScenarioList.offsetHeight}px`;
  const thumbHeight = Math.max(28, (visibleHeight / scrollHeight) * visibleHeight);
  const maxThumbTop = visibleHeight - thumbHeight - scrollMargin * 2;
  const maxScrollTop = scrollHeight - visibleHeight;
  const thumbTop = scrollMargin + (maxScrollTop > 0 ? (menuScenarioList.scrollTop / maxScrollTop) * maxThumbTop : 0);
  menuScenarioScrollbarThumb.style.height = `${thumbHeight}px`;
  menuScenarioScrollbarThumb.style.transform = `translateY(${thumbTop}px)`;
}

function onNewGameScenarioScrollbarPointerDown(event) {
  event.preventDefault();
  event.stopPropagation();
  menuScenarioScrollbar.setPointerCapture?.(event.pointerId);

  const scrollbarRect = menuScenarioScrollbar.getBoundingClientRect();
  const thumbRect = menuScenarioScrollbarThumb.getBoundingClientRect();
  const grabOffset = event.clientY >= thumbRect.top && event.clientY <= thumbRect.bottom
    ? event.clientY - thumbRect.top
    : thumbRect.height / 2;

  const moveThumb = (clientY) => {
    const scrollMargin = 3;
    const visibleHeight = menuScenarioList.clientHeight;
    const scrollHeight = menuScenarioList.scrollHeight;
    const thumbHeight = menuScenarioScrollbarThumb.offsetHeight;
    const maxThumbTop = visibleHeight - thumbHeight - scrollMargin * 2;
    const maxScrollTop = scrollHeight - visibleHeight;
    const thumbTop = THREE.MathUtils.clamp(clientY - scrollbarRect.top - grabOffset - scrollMargin, 0, maxThumbTop);
    menuScenarioList.scrollTop = maxThumbTop > 0 ? (thumbTop / maxThumbTop) * maxScrollTop : 0;
  };

  const onMove = (moveEvent) => moveThumb(moveEvent.clientY);
  const onUp = (upEvent) => {
    menuScenarioScrollbar.releasePointerCapture?.(upEvent.pointerId);
    window.removeEventListener("pointermove", onMove);
    window.removeEventListener("pointerup", onUp);
    window.removeEventListener("pointercancel", onUp);
  };

  moveThumb(event.clientY);
  window.addEventListener("pointermove", onMove);
  window.addEventListener("pointerup", onUp);
  window.addEventListener("pointercancel", onUp);
}

function renderNewGameFactionGrid(factionCount) {
  menuFactionGrid.replaceChildren();
  const visibleCount = Math.min(factionCount, NEW_GAME_FACTION_RENDER_LIMIT);
  for (let index = 0; index < visibleCount; index += 1) {
    const side = getNewGameRenderedSide(index);
    const isSelected = index === selectedNewGameSideIndex;
    const isPlayer = index === selectedNewGamePlayerSideIndex;
    const card = document.createElement("div");
    card.className = "new-game__faction-card";
    card.classList.toggle("new-game__faction-card--player", isPlayer);
    card.classList.toggle("new-game__faction-card--selected", isSelected);
    card.style.setProperty("--side-color", side.color);
    card.tabIndex = 0;
    card.setAttribute("role", "button");
    card.setAttribute("aria-pressed", String(isSelected));
    const title = isSelected
      ? createNewGameFactionNameInput(index, side.name)
      : createNewGameFactionTitle(side.name);
    const meta = createNewGameFactionGovernmentControl(index, side.government, { isPlayer, isSelected });
    card.append(title, meta);
    const selectCard = () => {
      selectedNewGameSideIndex = index;
      pendingNewGameFactionNameFocusIndex = index;
      renderNewGameFactionGrid(newGameFactionCount);
    };
    card.addEventListener("pointerdown", (event) => {
      if (isNewGameFactionInteractiveTarget(event.target)) {
        return;
      }
      event.preventDefault();
      selectCard();
    });
    card.addEventListener("click", (event) => {
      if (isNewGameFactionInteractiveTarget(event.target)) {
        return;
      }
      selectCard();
    });
    card.addEventListener("keydown", (event) => {
      if (event.key !== "Enter" && event.key !== " ") {
        return;
      }
      event.preventDefault();
      selectCard();
    });
    menuFactionGrid.append(card);
  }

  if (visibleCount < factionCount) {
    const overflow = document.createElement("div");
    overflow.className = "new-game__faction-card new-game__faction-card--overflow";
    overflow.textContent = `+${factionCount - visibleCount}`;
    menuFactionGrid.append(overflow);
  }
}

function isNewGameFactionInteractiveTarget(target) {
  return target instanceof Element
    && Boolean(target.closest(".new-game__faction-card-name-input, .new-game__faction-government"));
}

function createNewGameFactionTitle(name) {
  const title = document.createElement("span");
  title.className = "new-game__faction-card-title";
  title.textContent = name;
  return title;
}

function createNewGameFactionNameInput(index, name) {
  const input = document.createElement("input");
  input.className = "new-game__faction-card-name-input";
  input.type = "text";
  input.value = name;
  input.autocomplete = "off";
  input.spellcheck = false;
  input.setAttribute("aria-label", "Faction name");
  input.addEventListener("click", (event) => event.stopPropagation());
  input.addEventListener("pointerdown", (event) => event.stopPropagation());
  input.addEventListener("keydown", (event) => {
    event.stopPropagation();
    if (event.key === "Enter") {
      input.blur();
    }
  });
  input.addEventListener("input", () => {
    setNewGameSideName(index, input.value);
    markNewGameSetupDirty();
    updateNewGameActions();
  });
  input.addEventListener("blur", () => {
    renderNewGameFactionGrid(newGameFactionCount);
  });
  if (pendingNewGameFactionNameFocusIndex === index) {
    pendingNewGameFactionNameFocusIndex = null;
    requestAnimationFrame(() => {
      if (selectedNewGameSideIndex === index && document.contains(input)) {
        input.focus();
        input.setSelectionRange(input.value.length, input.value.length);
      }
    });
  }
  return input;
}

function createNewGameFactionGovernmentControl(index, governmentId, { isPlayer, isSelected }) {
  if (isPlayer || !isSelected) {
    const meta = document.createElement("span");
    meta.className = "new-game__faction-card-meta";
    meta.textContent = getNewGameGovernmentLabel(governmentId);
    return meta;
  }

  const wrapper = document.createElement("span");
  wrapper.className = "new-game__faction-government";

  const current = document.createElement("button");
  current.className = "new-game__faction-government-current";
  current.type = "button";
  current.textContent = getNewGameGovernmentLabel(governmentId);
  current.setAttribute("aria-expanded", "false");

  const list = document.createElement("span");
  list.className = "new-game__faction-government-list";
  list.hidden = true;

  getNewGameGovernmentIds().forEach((id) => {
    const item = document.createElement("button");
    item.className = "new-game__faction-government-item";
    item.type = "button";
    item.textContent = getNewGameGovernmentLabel(id);
    item.classList.toggle("active", id === governmentId);
    item.addEventListener("pointerdown", (event) => {
      event.preventDefault();
      event.stopPropagation();
      setNewGameSideGovernment(index, id);
      markNewGameSetupDirty();
      renderNewGameFactionGrid(newGameFactionCount);
      updateNewGameActions();
    });
    item.addEventListener("keydown", (event) => {
      if (event.key !== "Enter" && event.key !== " ") {
        return;
      }
      event.preventDefault();
      event.stopPropagation();
      setNewGameSideGovernment(index, id);
      markNewGameSetupDirty();
      renderNewGameFactionGrid(newGameFactionCount);
      updateNewGameActions();
    });
    item.addEventListener("click", (event) => {
      event.stopPropagation();
    });
    list.append(item);
  });

  const toggleList = () => {
    const shouldOpen = list.hidden;
    list.hidden = !shouldOpen;
    current.setAttribute("aria-expanded", String(shouldOpen));
  };
  current.addEventListener("pointerdown", (event) => {
    event.preventDefault();
    event.stopPropagation();
    toggleList();
  });
  current.addEventListener("keydown", (event) => {
    if (event.key !== "Enter" && event.key !== " ") {
      return;
    }
    event.preventDefault();
    event.stopPropagation();
    toggleList();
  });
  current.addEventListener("click", (event) => {
    event.stopPropagation();
  });
  wrapper.addEventListener("click", (event) => event.stopPropagation());
  wrapper.append(current, list);
  return wrapper;
}

function setNewGameSideName(index, name) {
  if (index === selectedNewGamePlayerSideIndex) {
    newGamePlayerFactionName = name;
    menuPlayerFactionName.value = name;
    return;
  }

  ensureNewGameSideConfig(index).name = name;
}

function setNewGameSideGovernment(index, governmentId) {
  if (!NEW_GAME_GOVERNMENTS[governmentId]) {
    return;
  }
  if (index === selectedNewGamePlayerSideIndex) {
    selectedNewGameGovernmentId = governmentId;
    return;
  }

  ensureNewGameSideConfig(index).government = governmentId;
}

function getNewGameRenderedSide(index) {
  if (index === selectedNewGamePlayerSideIndex) {
    return {
      name: getNewGamePlayerFactionDisplayName(),
      color: newGamePlayerFactionColor,
      government: selectedNewGameGovernmentId,
    };
  }

  const side = newGameSideConfigs[index] ?? createNewGameSideConfig(index, getNewGameSeed());
  return {
    name: side.name.trim() || `SIDE ${index + 1}`,
    color: side.color,
    government: side.government,
  };
}

function getNewGameGovernmentIds() {
  return Object.keys(NEW_GAME_GOVERNMENTS);
}

function getNewGameGovernmentLabel(governmentId) {
  return NEW_GAME_GOVERNMENTS[governmentId]?.label
    ?? NEW_GAME_GOVERNMENTS[NEW_GAME_DEFAULT_GOVERNMENT_ID].label;
}

function getNewGamePlayerFactionDisplayName() {
  return newGamePlayerFactionName.trim() || NEW_GAME_DEFAULT_PLAYER_FACTION_NAME;
}

function syncNewGameSideConfigs(count, seed) {
  if (newGameSideConfigSeed !== seed) {
    newGameSideConfigs = createNewGameSideConfigs(count, seed);
    newGameSideConfigSeed = seed;
    return;
  }

  if (newGameSideConfigs.length > count) {
    newGameSideConfigs.length = count;
  }

  for (let index = newGameSideConfigs.length; index < count; index += 1) {
    newGameSideConfigs.push(createNewGameSideConfig(index, seed));
  }
}

function createNewGameSideConfigs(count, seed) {
  return Array.from({ length: count }, (_, index) => createNewGameSideConfig(index, seed));
}

function createNewGameSideConfig(index, seed) {
  return {
    name: `SIDE ${index + 1}`,
    color: createNewGameSideColor(index, seed),
    government: createNewGameSideGovernment(index, seed),
  };
}

function ensureNewGameSideConfig(index) {
  while (newGameSideConfigs.length <= index) {
    newGameSideConfigs.push(createNewGameSideConfig(newGameSideConfigs.length, getNewGameSeed()));
  }
  return newGameSideConfigs[index];
}

function createNewGameSideGovernment(index, seed) {
  const governmentIds = getNewGameGovernmentIds();
  const random = createRandom(`${seed}:new-game-side-government:${index}`);
  return governmentIds[Math.floor(random() * governmentIds.length)] ?? NEW_GAME_DEFAULT_GOVERNMENT_ID;
}

function createNewGameSideColor(index, seed) {
  const random = createRandom(`${seed}:new-game-side:${index}`);
  const hue = Math.floor(random() * 360);
  const saturation = 58 + Math.floor(random() * 30);
  const lightness = 48 + Math.floor(random() * 18);
  return hslToHexColor(hue, saturation, lightness);
}

function hslToHexColor(hue, saturation, lightness) {
  const s = saturation / 100;
  const l = lightness / 100;
  const c = (1 - Math.abs(2 * l - 1)) * s;
  const x = c * (1 - Math.abs(((hue / 60) % 2) - 1));
  const m = l - c / 2;
  const [r, g, b] = hue < 60
    ? [c, x, 0]
    : hue < 120
      ? [x, c, 0]
      : hue < 180
        ? [0, c, x]
        : hue < 240
          ? [0, x, c]
          : hue < 300
            ? [x, 0, c]
            : [c, 0, x];
  return `#${[r, g, b].map((channel) => Math.round((channel + m) * 255).toString(16).padStart(2, "0")).join("")}`;
}

function getNewGameSeed() {
  return menuSeedInput.value.trim() || MENU_DEFAULT_SEED;
}

function getNewGameScenarioMaxFactions(scenario, seed) {
  const scenarioMax = typeof scenario.maxFactions === "function" ? scenario.maxFactions(seed) : Infinity;
  return Number.isFinite(scenarioMax)
    ? Math.min(NEW_GAME_MAX_SIDE_COUNT, scenarioMax)
    : NEW_GAME_MAX_SIDE_COUNT;
}

function isNewGameScenarioStartable(scenario) {
  return scenario?.canStart !== false;
}

function getBasicScenarioFactionLimit(seed) {
  const previewNodes = createNodes(createRandom(seed));
  return createOuterLinks(previewNodes, createRandom(`${seed}:outer-links`)).length;
}

function getClampedNewGameFactionCount(value, maxFactions) {
  const minimum = 1;
  const parsed = parseFactionCount(value);
  if (Number.isFinite(maxFactions)) {
    return THREE.MathUtils.clamp(parsed, minimum, Math.max(minimum, maxFactions));
  }
  return Math.max(minimum, parsed);
}

function parseFactionCount(value) {
  const parsed = Number.parseInt(value, 10);
  return Number.isFinite(parsed) ? parsed : 1;
}

function confirmNewGameSeed() {
  const scenario = NEW_GAME_SCENARIOS[selectedNewGameScenarioId] ?? NEW_GAME_SCENARIOS[NEW_GAME_BASIC_SCENARIO_ID];
  if (!isNewGameScenarioStartable(scenario)) {
    return;
  }

  const nextSeed = menuSeedInput.value.trim() || MENU_DEFAULT_SEED;
  const isOnline = newGameSessionMode === NEW_GAME_MODE_ONLINE;
  if (isOnline) {
    if (!newGameAppliedState || isNewGameSetupDirty) {
      updateNewGameActions();
      return;
    }
    startGameWithSeed(nextSeed, newGameAppliedState);
    return;
  }

  startGameWithSeed(nextSeed, createNewGameInitialGameState());
}

function applyOnlineNewGameSetup() {
  const scenario = NEW_GAME_SCENARIOS[selectedNewGameScenarioId] ?? NEW_GAME_SCENARIOS[NEW_GAME_BASIC_SCENARIO_ID];
  if (newGameSessionMode !== NEW_GAME_MODE_ONLINE || !isNewGameScenarioStartable(scenario)) {
    return;
  }

  const timestamp = new Date().toISOString();
  const initialState = createNewGameInitialGameState();
  const saveName = createNewGameInitialSaveName(initialState.setup);
  const save = createGameSaveFromState(saveName, initialState.setup.seed, initialState, timestamp);
  initialState.saveFileName = save.fileName;
  save.gameState = normalizeGameState(initialState);
  upsertMenuSave(save);
  newGameAppliedState = normalizeGameState(initialState);
  isNewGameSetupDirty = false;
  renderNewGameDialog();
}

function createNewGameInitialSaveName(setup) {
  return `${String(setup?.seed ?? MENU_DEFAULT_SEED).trim() || MENU_DEFAULT_SEED} INITIAL`;
}

function createNewGameInitialGameState() {
  const setup = collectNewGameSetupState();
  const initialProgress = createInitialGameProgressState(setup);
  return normalizeGameState({
    turn: DEFAULT_TURN_NUMBER,
    playerId: setup.playerId,
    setup,
    fleets: initialProgress.fleets,
    exploration: initialProgress.exploration,
    objectDetails: {},
  });
}

function collectNewGameSetupState() {
  const scenario = NEW_GAME_SCENARIOS[selectedNewGameScenarioId] ?? NEW_GAME_SCENARIOS[NEW_GAME_BASIC_SCENARIO_ID];
  const seed = getNewGameSeed();
  const sideCount = Math.min(NEW_GAME_MAX_SIDE_COUNT, newGameFactionCount);
  const sides = Array.from({ length: sideCount }, (_, index) => {
    const rendered = getNewGameRenderedSide(index);
    return {
      id: `side-${index + 1}`,
      index,
      name: rendered.name,
      color: rendered.color,
      government: rendered.government,
      isPlayer: index === selectedNewGamePlayerSideIndex,
    };
  });

  return {
    version: 1,
    seed,
    scenarioId: scenario.id,
    scenarioLabel: scenario.label,
    mode: newGameSessionMode,
    playerId: DEFAULT_PLAYER_ID,
    playerSideId: sides[selectedNewGamePlayerSideIndex]?.id ?? "side-1",
    sides,
    createdAt: new Date().toISOString(),
  };
}

function openEditorFromMenu() {
  startGameFromMenu({ editorMode: true });
}

function startGameWithSeed(nextSeed, gameState = null) {
  stopMenuEnvironmentMachine();
  if (nextSeed === SEED) {
    seedInput.value = nextSeed;
    startGameFromMenu({ editorMode: false, gameState });
    return;
  }

  disposeAudioMixerForNavigation();
  const url = new URL(window.location.href);
  url.searchParams.set("seed", nextSeed);
  url.searchParams.delete("multiplier");
  rememberStartAfterSeed(nextSeed, gameState);
  window.location.href = url.toString();
}

function disposeAudioMixerForNavigation() {
  stopMenuEnvironmentMachine();
  audioMixer?.dispose();
  audioMixer = null;
  menuEnvironmentMachine = null;
  activeUiHoverSoundElement = null;
}

function rememberStartAfterSeed(seed, gameState = null) {
  try {
    sessionStorage.setItem(START_AFTER_SEED_STORAGE_KEY, seed);
    sessionStorage.removeItem(START_AFTER_RUNTIME_SESSION_STORAGE_KEY);
    if (gameState) {
      sessionStorage.setItem(START_AFTER_SAVE_STATE_STORAGE_KEY, JSON.stringify(normalizeGameState(gameState)));
    } else {
      sessionStorage.removeItem(START_AFTER_SAVE_STATE_STORAGE_KEY);
    }
  } catch {}
}

function consumeStartAfterSeedFlag() {
  try {
    const pendingSeed = sessionStorage.getItem(START_AFTER_SEED_STORAGE_KEY);
    const pendingStateRaw = sessionStorage.getItem(START_AFTER_SAVE_STATE_STORAGE_KEY);
    sessionStorage.removeItem(START_AFTER_SEED_STORAGE_KEY);
    sessionStorage.removeItem(START_AFTER_SAVE_STATE_STORAGE_KEY);
    if (pendingSeed === SEED && pendingStateRaw) {
      pendingStartGameState = normalizeGameState(JSON.parse(pendingStateRaw));
    }
    return pendingSeed === SEED;
  } catch {
    pendingStartGameState = null;
    return false;
  }
}

function initRuntimeStartupState() {
  const shouldStartAfterSeed = consumeStartAfterSeedFlag();
  const runtimeSession = consumePendingRuntimeSession();
  if (shouldStartAfterSeed) {
    if (shouldResumeRuntimeSession(runtimeSession)) {
      showRuntimeLoadingOverlay({ immediate: true });
      pendingRuntimeSession = runtimeSession;
      pendingStartGameState = normalizeGameState(runtimeSession.gameState);
    }
    shouldStartGameAfterInit = true;
    return;
  }

  const storedRuntimeSession = runtimeSession ?? readRuntimeSession();
  if (!shouldResumeRuntimeSession(storedRuntimeSession)) {
    persistRuntimeSession("menu");
    hideRuntimeLoadingOverlay({ delayMs: 0 });
    return;
  }

  if (storedRuntimeSession.seed !== SEED) {
    showRuntimeLoadingOverlay({ immediate: true });
    rememberStartAfterSeed(storedRuntimeSession.seed, storedRuntimeSession.gameState);
    rememberPendingRuntimeSession(storedRuntimeSession);
    redirectToSeed(storedRuntimeSession.seed);
    return;
  }

  showRuntimeLoadingOverlay({ immediate: true });
  pendingRuntimeSession = storedRuntimeSession;
  pendingStartGameState = normalizeGameState(storedRuntimeSession.gameState);
  shouldStartGameAfterInit = true;
}

function shouldResumeRuntimeSession(session) {
  return Boolean(
    session &&
    session.view !== "menu" &&
    session.seed,
  );
}

function redirectToSeed(seed) {
  isRuntimeSessionRedirecting = true;
  disposeAudioMixerForNavigation();
  const url = new URL(window.location.href);
  url.searchParams.set("seed", seed);
  url.searchParams.delete("multiplier");
  window.location.href = url.toString();
}

function rememberPendingRuntimeSession(session) {
  try {
    sessionStorage.setItem(
      START_AFTER_RUNTIME_SESSION_STORAGE_KEY,
      JSON.stringify(normalizeRuntimeSession(session)),
    );
  } catch {}
}

function consumePendingRuntimeSession() {
  try {
    const raw = sessionStorage.getItem(START_AFTER_RUNTIME_SESSION_STORAGE_KEY);
    sessionStorage.removeItem(START_AFTER_RUNTIME_SESSION_STORAGE_KEY);
    return normalizeRuntimeSession(JSON.parse(raw || "null"));
  } catch {
    return null;
  }
}

function readRuntimeSession() {
  try {
    return normalizeRuntimeSession(JSON.parse(localStorage.getItem(RUNTIME_SESSION_STORAGE_KEY) || "null"));
  } catch {
    return null;
  }
}

function writeRuntimeSession(session) {
  try {
    localStorage.setItem(RUNTIME_SESSION_STORAGE_KEY, JSON.stringify(normalizeRuntimeSession(session)));
  } catch {}
}

function normalizeRuntimeSession(session) {
  if (!session || typeof session !== "object") {
    return null;
  }

  const seed = String(session.seed ?? "").trim();
  if (!seed) {
    return null;
  }

  const view = normalizeRuntimeView(session.view);
  const gameState = normalizeGameState(session.gameState ?? session.state);
  return {
    version: 1,
    seed,
    view,
    editorMode: session.editorMode === true,
    systemId: normalizeRuntimeNullableString(session.systemId),
    planetKey: normalizeRuntimeNullableString(session.planetKey),
    detailKey: normalizeRuntimeNullableString(session.detailKey),
    gameState,
    turn: gameState.turn,
    playerId: gameState.playerId,
    updatedAt: String(session.updatedAt ?? new Date().toISOString()),
  };
}

function normalizeRuntimeView(view) {
  const value = String(view ?? "menu");
  return ["menu", "editor", "starmap", "system", "planet", "detail"].includes(value)
    ? value
    : "menu";
}

function normalizeRuntimeNullableString(value) {
  return value === null || value === undefined
    ? null
    : String(value);
}

function showRuntimeLoadingOverlay({ immediate = false } = {}) {
  if (runtimeLoadingHideTimer !== null) {
    window.clearTimeout(runtimeLoadingHideTimer);
    runtimeLoadingHideTimer = null;
  }

  document.documentElement.classList.add("runtime-restore-loading");
  if (!runtimeLoadingOverlay) {
    return;
  }

  runtimeLoadingOverlay.setAttribute("aria-hidden", "false");
  runtimeLoadingOverlay.classList.remove("runtime-loading-overlay--hiding");
  runtimeLoadingOverlay.classList.add("runtime-loading-overlay--visible");
  if (!immediate) {
    runtimeLoadingOverlay.style.removeProperty("transition");
    return;
  }

  runtimeLoadingOverlay.style.setProperty("transition", "none");
  void runtimeLoadingOverlay.offsetWidth;
  requestAnimationFrame(() => {
    runtimeLoadingOverlay.style.removeProperty("transition");
  });
}

function hideRuntimeLoadingOverlay({ delayMs = 80 } = {}) {
  if (runtimeLoadingHideTimer !== null) {
    window.clearTimeout(runtimeLoadingHideTimer);
    runtimeLoadingHideTimer = null;
  }

  const hide = () => {
    document.documentElement.classList.remove("runtime-restore-loading");
    if (!runtimeLoadingOverlay) {
      return;
    }

    runtimeLoadingOverlay.setAttribute("aria-hidden", "true");
    runtimeLoadingOverlay.classList.remove("runtime-loading-overlay--visible");
    runtimeLoadingOverlay.classList.add("runtime-loading-overlay--hiding");
    window.setTimeout(() => {
      runtimeLoadingOverlay.classList.remove("runtime-loading-overlay--hiding");
    }, 280);
  };

  if (delayMs > 0) {
    runtimeLoadingHideTimer = window.setTimeout(() => {
      runtimeLoadingHideTimer = null;
      hide();
    }, delayMs);
    return;
  }

  hide();
}

function persistRuntimeSession(viewOverride = null) {
  if (isRuntimeSessionRedirecting) {
    return;
  }

  const session = createRuntimeSessionSnapshot(viewOverride);
  if (session) {
    writeRuntimeSession(session);
  }
}

function createRuntimeSessionSnapshot(viewOverride = null) {
  const view = normalizeRuntimeView(viewOverride ?? getCurrentRuntimeView());
  const gameState = isGameRuntimeReady
    ? serializeCurrentGameState()
    : normalizeGameState(currentGameState);
  const activeNode = systemScreenController?.state?.activeNode ?? null;
  const activePlanet = getActiveRuntimePlanet();
  const activeDetail = activeObjectDetail ?? objectDetail3D?.hexGrid?.detail ?? null;
  const systemId = view === "menu"
    ? null
    : normalizeRuntimeNullableString(
      activeNode?.id ?? activePlanet?.systemId ?? activeDetail?.systemId,
    );

  return {
    version: 1,
    seed: SEED,
    view,
    editorMode: isEditorMode,
    systemId,
    planetKey: view === "planet" || view === "detail"
      ? getRuntimeObjectKey(activePlanet)
      : null,
    detailKey: view === "detail"
      ? getRuntimeObjectKey(activeDetail)
      : null,
    gameState,
    turn: gameState.turn,
    playerId: gameState.playerId,
    updatedAt: new Date().toISOString(),
  };
}

function getCurrentRuntimeView() {
  if (isStartMenuOpen || !isGameRuntimeReady) {
    return "menu";
  }
  if (isObjectDetailOpen) {
    return "detail";
  }
  if (planetScreenController?.isOpen?.()) {
    return "planet";
  }
  if (systemScreenController?.isOpen?.()) {
    return "system";
  }
  return isEditorMode ? "editor" : "starmap";
}

function getActiveRuntimePlanet() {
  return objectDetailOrbitPlanet
    ?? planetScreenController?.state?.activePlanet
    ?? openPlanetData
    ?? null;
}

function getRuntimeObjectKey(object) {
  return getObjectDetailStateKey(object) || null;
}

function playMenuMusic() {
  if (isAppExited || !isStartMenuOpen || !audioSettings.menuMusicEnabled) {
    return;
  }

  if (menuMusicFadeFrame !== null) {
    cancelAnimationFrame(menuMusicFadeFrame);
    menuMusicFadeFrame = null;
  }
  menuMusicAudio.volume = getMenuMusicVolume();
  menuMusicAudio.play().catch(() => {});
}

function fadeOutMenuMusic(durationMs = 900) {
  if (menuMusicFadeFrame !== null) {
    cancelAnimationFrame(menuMusicFadeFrame);
    menuMusicFadeFrame = null;
  }

  if (menuMusicAudio.paused) {
    return Promise.resolve();
  }

  const startVolume = menuMusicAudio.volume;
  const startedAt = performance.now();
  return new Promise((resolve) => {
    const tick = (now) => {
      const progress = THREE.MathUtils.clamp((now - startedAt) / durationMs, 0, 1);
      menuMusicAudio.volume = startVolume * (1 - progress);
      if (progress < 1) {
        menuMusicFadeFrame = requestAnimationFrame(tick);
        return;
      }

      menuMusicFadeFrame = null;
      menuMusicAudio.pause();
      menuMusicAudio.currentTime = 0;
      menuMusicAudio.volume = getMenuMusicVolume();
      resolve();
    };
    menuMusicFadeFrame = requestAnimationFrame(tick);
  });
}

async function returnToMainMenu() {
  if (isReturningToMainMenu || isStartMenuOpen) {
    return;
  }

  isReturningToMainMenu = true;
  closeGameDialogs();
  stopAnimationLoop();
  persistRuntimeSession("menu");
  isRuntimeSessionRedirecting = true;
  await musicPlayerController?.fadeOutStop(650);
  try {
    sessionStorage.removeItem(START_AFTER_SEED_STORAGE_KEY);
    sessionStorage.removeItem(START_AFTER_SAVE_STATE_STORAGE_KEY);
    sessionStorage.removeItem(START_AFTER_RUNTIME_SESSION_STORAGE_KEY);
  } catch {}

  const url = new URL(window.location.href);
  url.searchParams.delete("seed");
  url.searchParams.delete("multiplier");
  window.location.href = url.toString();
}

function startGameFromMenu({ editorMode = false, gameState = null } = {}) {
  if (!isStartMenuOpen) {
    return;
  }

  const runtimeSessionToRestore = pendingRuntimeSession;
  pendingRuntimeSession = null;
  isEditorMode = runtimeSessionToRestore?.editorMode ?? editorMode;
  currentGameState = normalizeGameState(gameState ?? pendingStartGameState ?? runtimeSessionToRestore?.gameState);
  selectedFleetId = null;
  renderFleetActionPanel();
  activeSystemFleetAnchors = [];
  fleetMarkerPositions.clear();
  starmapFleetMarkerPositions.clear();
  pendingStarmapFleetMarkerPaths.clear();
  cancelFleetMarkerAnimations();
  cancelStarmapFleetMarkerAnimations();
  pendingStartGameState = null;
  closeMenuDialogs();
  setMenuStatus("STARTING");
  fadeOutMenuMusic();
  stopMenuEnvironmentMachine();
  stopMenuAnimationLoop();
  isStartMenuOpen = false;
  document.body.classList.remove("start-menu-open");
  document.body.classList.add("game-running");
  document.body.classList.toggle("editor-mode", isEditorMode);
  applyGameUiSettings();
  renderTurnOrderUi();
  startMenu.classList.add("start-menu--hidden");
  startMenu.setAttribute("aria-hidden", "true");
  initializeNebulumRuntime();
  lastFrameTime = performance.now();
  if (runtimeSessionToRestore) {
    showRuntimeLoadingOverlay({ immediate: true });
    restoreRuntimeSessionView(runtimeSessionToRestore)
      .catch((error) => {
        console.error("Runtime session restore failed", error);
        renderStarmapFrame();
        persistRuntimeSession(isEditorMode ? "editor" : "starmap");
      })
      .finally(() => {
        hideRuntimeLoadingOverlay({ delayMs: 0 });
      });
  } else {
    hideRuntimeLoadingOverlay({ delayMs: 0 });
    renderStarmapFrame();
    persistRuntimeSession(isEditorMode ? "editor" : "starmap");
  }
  updateGameNavigationUi(true);
  startAnimationLoop();
}

async function restoreRuntimeSessionView(session) {
  const normalized = normalizeRuntimeSession(session);
  if (!normalized) {
    renderStarmapFrame();
    persistRuntimeSession(isEditorMode ? "editor" : "starmap");
    return;
  }

  if (normalized.view === "editor" || normalized.view === "starmap") {
    renderStarmapFrame();
    persistRuntimeSession(normalized.view);
    return;
  }

  const activeNode = getRuntimeNodeById(normalized.systemId);
  if (!activeNode || !isSystemAccessibleForActiveSide(activeNode)) {
    renderStarmapFrame();
    persistRuntimeSession(isEditorMode ? "editor" : "starmap");
    return;
  }

  const restoresNestedScreen = normalized.view === "planet" || normalized.view === "detail";
  restoreSystemScreen(activeNode);
  if (restoresNestedScreen) {
    starWindow.classList.add("planet-screen-open");
  }
  if (normalized.view === "system") {
    persistRuntimeSession("system");
    return;
  }

  const activePlanet = findRenderedSystemPlanetByKey(normalized.planetKey);
  if (!activePlanet || !isPlanetAccessibleForActiveSide(activePlanet)) {
    starWindow.classList.remove("planet-screen-open");
    persistRuntimeSession("system");
    return;
  }

  await restorePlanetScreenFromSession(activePlanet, { persist: normalized.view === "planet" });
  if (normalized.view === "planet") {
    return;
  }

  restoreObjectDetailScreenFromSession(activePlanet, normalized.detailKey);
}

function getRuntimeNodeById(systemId) {
  if (!systemId) {
    return null;
  }
  return nodes.find((node) => String(node.id) === String(systemId)) ?? null;
}

function restoreSystemScreen(node) {
  cancelPlanetEntryTransition();
  closePlanetWindow();
  planetScreenController.close();
  closeObjectDetailScreen({ preserveTransitionOverlay: true });
  openStarWindow(node);
  updateSystemParallax(lastClientPointer.x, lastClientPointer.y, true);
  snapPlanetScreenHidden();
  snapObjectDetailHidden();
}

function findRenderedSystemPlanetByKey(planetKey) {
  if (!planetKey) {
    return null;
  }

  const hits = starSystem.querySelectorAll(".system-planet-hit");
  for (const hit of hits) {
    const planet = hit.userData?.planet;
    if (getRuntimeObjectKey(planet) === planetKey) {
      return planet;
    }
  }
  return null;
}

async function restorePlanetScreenFromSession(planet, { persist = true, preserveEntryOverlay = false } = {}) {
  try {
    await loadPlanetScreenRenderer();
  } catch (error) {
    console.error("Planet screen module failed to load", error);
  }

  if (preserveEntryOverlay) {
    planetEntryTransitionToken += 1;
    isPlanetEntryTransitioning = false;
    starWindow.classList.remove("planet-entry-moving");
    starWindow.style.setProperty("--planet-entry-scale", "1");
  } else {
    cancelPlanetEntryTransition();
  }
  closePlanetWindow();
  planetScreen.style.removeProperty("opacity");
  planetScreen.style.setProperty("transition", "none");
  resetTransitionSurfaces();
  planetScreenController.open(planet);
  void planetScreen.offsetWidth;
  await nextAnimationFrame();
  planetScreen.style.removeProperty("transition");
  if (planetScreenController?.isOpen?.() && planetScreenController.state.activePlanet === planet) {
    planetScreenController.resize();
  }
  planetScreenController.updateParallax(lastClientPointer.x, lastClientPointer.y);
  if (persist) {
    persistRuntimeSession("planet");
  }
}

function restoreObjectDetailScreenFromSession(planet, detailKey) {
  const detail = findRenderedPlanetDetailByKey(detailKey);
  if (!detail) {
    persistRuntimeSession("planet");
    return;
  }

  objectDetailOrbitPlanet = planet;
  activeObjectDetail = detail;
  isObjectDetailOpen = true;
  objectDetailOptions.light = true;
  objectDetailOptions.clouds = true;
  objectDetailOptions.borders = true;
  starWindow.classList.add("object-detail-open");
  const detailToken = ++objectDetailToken;
  cancelPlanetEntryTransition();
  closePlanetWindow();
  planetScreenController.close();
  resetTransitionSurfaces();
  objectDetailEntryOverlay.classList.remove("active", "leaving");
  objectDetailEntryOverlay.style.setProperty("--surface-entry-alpha", "0");
  renderObjectDetailContent(detail);
  objectDetailScreen.style.removeProperty("opacity");
  objectDetailScreen.style.removeProperty("transition");
  objectDetailScreen.classList.add("visible");
  objectDetailScreen.setAttribute("aria-hidden", "false");
  persistRuntimeSession("detail");
  scheduleObjectDetailTextureUpgrade(detail, detailToken);
}

function findRenderedPlanetDetailByKey(detailKey) {
  const hits = planetScreen.querySelectorAll(".planet-screen__object-hit");
  let firstDetail = null;
  for (const hit of hits) {
    const detail = hit.userData?.detail;
    if (!detail) {
      continue;
    }
    firstDetail ??= detail;
    if (detailKey && getRuntimeObjectKey(detail) === detailKey) {
      return detail;
    }
  }
  return detailKey ? null : firstDetail;
}

function openLoadGameDialog() {
  renderLoadGameDialog();
  openMenuDialog(loadDialog);
}

function renderLoadGameDialog() {
  const saves = readMenuSaves();
  selectedMenuSaveIndex = -1;
  menuSaveList.replaceChildren();

  if (saves.length === 0) {
    const empty = document.createElement("div");
    empty.className = "menu-save-list__empty";
    empty.textContent = "NO SAVES";
    menuSaveList.append(empty);
    updateMenuSaveActions();
    return;
  }

  saves.forEach((save, index) => {
    const button = createSaveListItem(save, index);
    button.addEventListener("click", () => {
      selectedMenuSaveIndex = index;
      updateMenuSaveSelection();
    });
    menuSaveList.append(button);
  });
  updateMenuSaveActions();
}

function updateMenuSaveSelection() {
  const items = menuSaveList.querySelectorAll(".menu-save-list__item");
  items.forEach((item, index) => {
    item.classList.toggle("selected", index === selectedMenuSaveIndex);
    item.setAttribute("aria-selected", String(index === selectedMenuSaveIndex));
  });
  updateMenuSaveActions();
}

function updateMenuSaveActions() {
  const hasSelection = selectedMenuSaveIndex >= 0;
  menuLoadSave.disabled = !hasSelection;
  menuDeleteSave.disabled = !hasSelection;
}

function clearLegacySaves() {
  try {
    localStorage.removeItem(LEGACY_SAVE_STORAGE_KEY);
  } catch {}
}

function readMenuSaves() {
  const indexedSaves = readIndexedMenuSaves();
  if (indexedSaves) {
    return indexedSaves;
  }

  try {
    const saves = JSON.parse(localStorage.getItem(SAVE_STORAGE_KEY) || "[]");
    const legacySaves = Array.isArray(saves) ? saves.map(normalizeSave).filter(Boolean) : [];
    if (legacySaves.length > 0) {
      writeMenuSaves(legacySaves);
      return readIndexedMenuSaves() ?? legacySaves;
    }
    return [];
  } catch {
    return [];
  }
}

function writeMenuSaves(saves) {
  const previousIndex = readSaveIndex();
  previousIndex.forEach((entry) => {
    if (entry?.fileName) {
      localStorage.removeItem(getSaveFileStorageKey(entry.fileName));
    }
  });

  const normalizedSaves = prepareSavesForWrite(saves);
  const index = normalizedSaves.map((save) => ({
    id: save.id,
    name: save.name,
    seed: save.seed,
    fileName: save.fileName,
    path: save.path,
    createdAt: save.createdAt,
    updatedAt: save.updatedAt,
    turn: getSaveTurnNumber(save),
  }));

  normalizedSaves.forEach((save) => {
    localStorage.setItem(getSaveFileStorageKey(save.fileName), JSON.stringify(save));
  });
  localStorage.setItem(SAVE_INDEX_STORAGE_KEY, JSON.stringify(index));
}

function readIndexedMenuSaves() {
  if (localStorage.getItem(SAVE_INDEX_STORAGE_KEY) === null) {
    return null;
  }

  return readSaveIndex()
    .map((entry, index) => {
      try {
        const raw = localStorage.getItem(getSaveFileStorageKey(entry.fileName));
        return normalizeSave(raw ? JSON.parse(raw) : entry, index);
      } catch {
        return normalizeSave(entry, index);
      }
    })
    .filter(Boolean);
}

function readSaveIndex() {
  try {
    const index = JSON.parse(localStorage.getItem(SAVE_INDEX_STORAGE_KEY) || "[]");
    return Array.isArray(index) ? index : [];
  } catch {
    return [];
  }
}

function prepareSavesForWrite(saves) {
  const usedFileNames = new Set();
  return saves
    .map(normalizeSave)
    .filter(Boolean)
    .map((save) => {
      const fileName = createUniqueSaveFileName(save.name, usedFileNames);
      const path = `${SAVE_FOLDER_NAME}/${fileName}`;
      const gameState = normalizeGameState({
        ...save.gameState,
        saveFileName: fileName,
      });
      return {
        ...save,
        fileName,
        path,
        gameState,
      };
    });
}

function getSaveFileStorageKey(fileName) {
  return `${SAVE_FILE_STORAGE_PREFIX}${SAVE_FOLDER_NAME}/${fileName}`;
}

function createUniqueSaveFileName(name, usedFileNames) {
  const base = sanitizeSaveFileBase(name);
  let fileName = `${base}.json`;
  let index = 2;
  while (usedFileNames.has(fileName.toLowerCase())) {
    fileName = `${base} ${index}.json`;
    index += 1;
  }
  usedFileNames.add(fileName.toLowerCase());
  return fileName;
}

function sanitizeSaveFileBase(name) {
  const base = String(name ?? "SAVE")
    .trim()
    .replace(/[<>:"/\\|?*\u0000-\u001f]/g, "-")
    .replace(/\s+/g, " ")
    .replace(/[. ]+$/g, "");
  return base || "SAVE";
}

function upsertMenuSave(save) {
  const normalized = normalizeSave(save);
  if (!normalized) {
    return;
  }

  const saves = readMenuSaves();
  const fileName = createUniqueSaveFileName(normalized.name, new Set());
  const existingIndex = saves.findIndex((entry) => (
    entry.fileName === fileName || entry.name.toUpperCase() === normalized.name.toUpperCase()
  ));
  if (existingIndex >= 0) {
    saves[existingIndex] = {
      ...normalized,
      id: saves[existingIndex].id,
      createdAt: saves[existingIndex].createdAt,
    };
  } else {
    saves.push(normalized);
  }
  writeMenuSaves(saves);
}

function loadSelectedMenuSave() {
  const save = readMenuSaves()[selectedMenuSaveIndex];
  if (!save?.seed) {
    return;
  }

  startGameWithSeed(save.seed, createGameStateForSaveLoad(save));
}

function deleteSelectedMenuSave() {
  const saves = readMenuSaves();
  if (selectedMenuSaveIndex < 0 || selectedMenuSaveIndex >= saves.length) {
    return;
  }

  saves.splice(selectedMenuSaveIndex, 1);
  writeMenuSaves(saves);
  renderLoadGameDialog();
}

function renderGameSaveDialog() {
  const saves = readMenuSaves();
  gameSaveList.replaceChildren();

  if (saves.length === 0 && !isAddingGameSave) {
    const empty = document.createElement("div");
    empty.className = "menu-save-list__empty";
    empty.textContent = "NO SAVES";
    gameSaveList.append(empty);
    updateGameSaveActions();
    return;
  }

  saves.forEach((save, index) => {
    const button = createSaveListItem(save, index);
    button.addEventListener("click", () => {
      selectedGameSaveIndex = index;
      isAddingGameSave = false;
      gameSaveDraftName = "";
      renderGameSaveDialog();
    });
    gameSaveList.append(button);
  });

  if (isAddingGameSave) {
    const draft = document.createElement("label");
    draft.className = "menu-save-list__draft selected";

    const input = document.createElement("input");
    input.className = "menu-save-list__input";
    input.type = "text";
    input.autocomplete = "off";
    input.value = gameSaveDraftName;
    input.addEventListener("input", () => {
      gameSaveDraftName = input.value;
    });
    input.addEventListener("keydown", (event) => {
      if (event.key === "Enter") {
        saveCurrentGameToSelectedSlot();
      }
    });

    draft.append(input);
    gameSaveList.append(draft);
    window.requestAnimationFrame(() => {
      input.focus();
      input.select();
    });
  }

  updateGameSaveSelection();
}

function addGameSaveDraft() {
  const saves = readMenuSaves();
  isAddingGameSave = true;
  selectedGameSaveIndex = -1;
  gameSaveDraftName = createDefaultSaveName(saves);
  renderGameSaveDialog();
}

function saveCurrentGameToSelectedSlot() {
  const saves = readMenuSaves();
  const now = new Date().toISOString();

  if (isAddingGameSave) {
    const save = createCurrentGameSave(gameSaveDraftName, now);
    saves.push(save);
    writeMenuSaves(saves);
    isAddingGameSave = false;
    selectedGameSaveIndex = saves.length - 1;
    gameSaveDraftName = "";
    renderGameSaveDialog();
    return;
  }

  if (selectedGameSaveIndex < 0 || selectedGameSaveIndex >= saves.length) {
    return;
  }

  saves[selectedGameSaveIndex] = createCurrentGameSave(saves[selectedGameSaveIndex].name, now, saves[selectedGameSaveIndex]);
  writeMenuSaves(saves);
  renderGameSaveDialog();
}

function deleteSelectedGameSave() {
  const saves = readMenuSaves();
  if (selectedGameSaveIndex < 0 || selectedGameSaveIndex >= saves.length) {
    return;
  }

  saves.splice(selectedGameSaveIndex, 1);
  writeMenuSaves(saves);
  selectedGameSaveIndex = -1;
  isAddingGameSave = false;
  gameSaveDraftName = "";
  renderGameSaveDialog();
}

function updateGameSaveSelection() {
  const items = gameSaveList.querySelectorAll(".menu-save-list__item");
  items.forEach((item, index) => {
    item.classList.toggle("selected", index === selectedGameSaveIndex);
    item.setAttribute("aria-selected", String(index === selectedGameSaveIndex));
  });
  updateGameSaveActions();
}

function updateGameSaveActions() {
  const hasSelection = selectedGameSaveIndex >= 0;
  gameSaveAdd.hidden = isAddingGameSave;
  gameSaveConfirm.hidden = !isAddingGameSave && !hasSelection;
  gameSaveConfirm.disabled = !isAddingGameSave && !hasSelection;
  gameDeleteSave.disabled = isAddingGameSave || !hasSelection;
}

function createSaveListItem(save, index) {
  const button = document.createElement("button");
  button.className = "menu-save-list__item";
  button.type = "button";
  button.role = "option";

  const name = document.createElement("span");
  name.className = "menu-save-list__name";
  name.textContent = getSaveDisplayName(save, index);

  const turn = document.createElement("span");
  turn.className = "menu-save-list__meta";
  turn.textContent = `TURN ${getSaveTurnNumber(save)}`;

  const date = document.createElement("span");
  date.className = "menu-save-list__meta";
  date.textContent = `DATE ${formatSaveCreatedAt(save)}`;

  button.append(name, turn, date);
  return button;
}

function getSaveDisplayName(save, index) {
  return save.name || save.seed || `SAVE ${index + 1}`;
}

function getSaveTurnNumber(save) {
  const turn = Number.parseInt(save?.gameState?.turn ?? DEFAULT_TURN_NUMBER, 10);
  return Number.isFinite(turn) && turn >= DEFAULT_TURN_NUMBER ? turn : DEFAULT_TURN_NUMBER;
}

function formatSaveCreatedAt(save) {
  const date = new Date(save?.createdAt ?? save?.updatedAt ?? Date.now());
  if (Number.isNaN(date.getTime())) {
    return "UNKNOWN";
  }

  const pad = (value) => String(value).padStart(2, "0");
  return [
    `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`,
    `${pad(date.getHours())}:${pad(date.getMinutes())}`,
  ].join(" ");
}

function normalizeSave(save, index = 0) {
  if (!save || typeof save !== "object") {
    return null;
  }

  const seed = String(save.seed ?? "").trim();
  if (!seed) {
    return null;
  }

  const name = String(save.name ?? "").trim() || `SAVE ${index + 1}`;
  const now = new Date().toISOString();
  const fileName = String(save.fileName ?? "").trim() || createUniqueSaveFileName(name, new Set());
  return {
    id: String(save.id ?? createSaveId()),
    version: Number(save.version ?? 3),
    name,
    seed,
    fileName,
    path: String(save.path ?? `${SAVE_FOLDER_NAME}/${fileName}`),
    createdAt: String(save.createdAt ?? save.updatedAt ?? now),
    updatedAt: String(save.updatedAt ?? now),
    gameState: normalizeGameState({
      ...(save.gameState ?? save.state),
      saveFileName: fileName,
    }),
  };
}

function createCurrentGameSave(name, timestamp, previousSave = null) {
  const trimmedName = String(name ?? "").trim() || createDefaultSaveName(readMenuSaves());
  return createGameSaveFromState(trimmedName, SEED, serializeCurrentGameState(), timestamp, previousSave);
}

function createGameSaveFromState(name, seed, gameState, timestamp, previousSave = null) {
  const trimmedName = String(name ?? "").trim() || createDefaultSaveName(readMenuSaves());
  const fileName = previousSave?.fileName ?? createUniqueSaveFileName(trimmedName, new Set());
  return {
    id: previousSave?.id ?? createSaveId(),
    version: 3,
    name: trimmedName,
    seed,
    fileName,
    path: `${SAVE_FOLDER_NAME}/${fileName}`,
    createdAt: previousSave?.createdAt ?? timestamp,
    updatedAt: timestamp,
    gameState: normalizeGameState({
      ...gameState,
      saveFileName: fileName,
    }),
  };
}

function createDefaultSaveName(saves) {
  const usedNames = new Set(saves.map((save) => save.name.toUpperCase()));
  let index = saves.length + 1;
  while (usedNames.has(`SAVE ${index}`)) {
    index += 1;
  }
  return `SAVE ${index}`;
}

function createSaveId() {
  return globalThis.crypto?.randomUUID?.() ?? `${Date.now()}-${Math.random().toString(36).slice(2)}`;
}

function parseNameDictionary(raw, fallback = []) {
  const names = String(raw ?? "")
    .split(/\r?\n/)
    .map((line) => line.replace(/^\uFEFF/, "").trim())
    .filter(Boolean);
  return names.length > 0 ? names : fallback.slice();
}

function createRuntimeRandomValue() {
  const cryptoApi = globalThis.crypto;
  if (cryptoApi?.getRandomValues) {
    const values = new Uint32Array(1);
    cryptoApi.getRandomValues(values);
    return values[0] / 0x100000000;
  }
  return Math.random();
}

function getRuntimeRandomInt(minValue, maxValue) {
  const min = Math.ceil(minValue);
  const max = Math.floor(maxValue);
  if (max < min) {
    return min;
  }
  return min + Math.floor(createRuntimeRandomValue() * (max - min + 1));
}

function getRuntimeRandomChoice(items, fallback = "") {
  if (!Array.isArray(items) || items.length === 0) {
    return fallback;
  }
  return items[getRuntimeRandomInt(0, items.length - 1)] ?? fallback;
}

function createFleetCommander() {
  const gender = createRuntimeRandomValue() < 0.5 ? "female" : "male";
  const givenNames = gender === "female"
    ? FLEET_COMMANDER_FEMALE_NAMES
    : FLEET_COMMANDER_MALE_NAMES;
  const givenName = () => getRuntimeRandomChoice(givenNames, "Alex");
  const surname = () => getRuntimeRandomChoice(FLEET_COMMANDER_SURNAMES, "Vega");
  const roll = createRuntimeRandomValue();
  let name;

  if (roll < 0.7) {
    name = `${givenName()} ${surname()}`;
  } else if (roll < 0.85) {
    name = `${givenName()} ${givenName()} ${givenName()}`;
  } else if (roll < 0.9) {
    name = `${givenName()}-${givenName()} ${surname()}`;
  } else if (roll < 0.95) {
    name = `${givenName()} ${formatRomanNumeral(getRuntimeRandomInt(1, 20))} ${surname()}`;
  } else {
    name = givenName();
  }

  return {
    gender,
    name: normalizeFleetCommanderName(name),
  };
}

function normalizeFleetCommander(commander) {
  const isObjectSource = commander && typeof commander === "object";
  const source = isObjectSource ? commander : {};
  const fallbackName = isObjectSource ? "" : commander;
  const name = normalizeFleetCommanderName(source.name ?? source.fullName ?? fallbackName);
  const gender = source.gender === "female" || source.gender === "male"
    ? source.gender
    : null;

  if (!name) {
    return createFleetCommander();
  }

  return {
    gender: gender ?? "unknown",
    name,
  };
}

function normalizeFleetCommanderName(value) {
  const name = String(value ?? "").replace(/\s+/g, " ").trim();
  return /^\[object object\]$/i.test(name) || /^object object$/i.test(name)
    ? ""
    : name;
}

function getFleetCommanderSource(fleet) {
  if (fleet?.commander && typeof fleet.commander === "object") {
    return fleet.commander;
  }

  return {
    name: fleet?.commanderName ?? fleet?.commanderFullName,
    gender: fleet?.commanderGender,
  };
}

function createEmptyGameState() {
  return {
    turn: DEFAULT_TURN_NUMBER,
    activeSideIndex: 0,
    completedSideIndices: [],
    playerId: DEFAULT_PLAYER_ID,
    saveFileName: null,
    setup: null,
    fleets: [],
    exploration: createEmptyExplorationState(),
    objectDetails: {},
  };
}

function normalizeGameState(gameState) {
  const normalized = createEmptyGameState();
  if (!gameState || typeof gameState !== "object") {
    return normalized;
  }

  normalized.turn = getGameTurnNumber(gameState);
  normalized.playerId = String(gameState.playerId ?? gameState.player ?? DEFAULT_PLAYER_ID).trim()
    || DEFAULT_PLAYER_ID;
  normalized.saveFileName = gameState.saveFileName === null || gameState.saveFileName === undefined
    ? null
    : String(gameState.saveFileName).trim() || null;
  normalized.setup = normalizeNewGameSetupState(gameState.setup ?? gameState.initialSetup);
  const sideCount = getGameStateSideCount(normalized);
  normalized.activeSideIndex = normalizeTurnSideIndex(
    gameState.activeSideIndex ?? gameState.currentSideIndex ?? gameState.sideIndex,
    sideCount,
  );
  normalized.completedSideIndices = normalizeCompletedSideIndices(
    gameState.completedSideIndices ?? gameState.completedSides ?? gameState.signedSideIndices,
    sideCount,
  ).filter((index) => index !== normalized.activeSideIndex);
  normalized.fleets = normalizeGameFleets(
    gameState.fleets ?? gameState.ships,
    normalized.setup,
    normalized.turn,
    normalized.activeSideIndex,
  );
  normalized.exploration = normalizeGameExploration(
    gameState.exploration ?? gameState.explored,
    normalized.setup,
    normalized.fleets,
  );

  const objectDetails = gameState.objectDetails && typeof gameState.objectDetails === "object"
    ? gameState.objectDetails
    : {};
  for (const [detailKey, detailState] of Object.entries(objectDetails)) {
    const buildings = serializeObjectDetailBuildings(
      normalizeObjectDetailBuildings(detailState?.buildings, detailState?.towns, detailState?.cityStage),
    );
    if (buildings.length > 0) {
      normalized.objectDetails[detailKey] = { buildings };
    }
  }
  return normalized;
}

function createEmptyExplorationState() {
  return {
    systems: {},
    planets: {},
    planetViews: {},
    visitedPlanetViews: [],
    links: {},
  };
}

function createInitialGameProgressState(setup) {
  const progress = {
    fleets: [],
    exploration: createEmptyExplorationState(),
  };
  const normalizedSetup = normalizeNewGameSetupState(setup);
  if (normalizedSetup?.scenarioId !== NEW_GAME_BASIC_SCENARIO_ID) {
    return progress;
  }

  const starts = createBasicScenarioFleetStarts(normalizedSetup.seed);
  if (starts.length === 0) {
    return progress;
  }

  const random = createRandom(`${normalizedSetup.seed}:basic-fleet-starts`);
  const shuffledStarts = shuffleSeeded(starts, random);
  const sides = getGameStateSides({ setup: normalizedSetup });
  sides.forEach((side, index) => {
    const start = shuffledStarts[index % shuffledStarts.length];
    const fleetId = `fleet-${side.id}-1`;
    progress.fleets.push({
      id: fleetId,
      ownerSideId: side.id,
      creationNumber: 1,
      name: `${side.name} FLEET`,
      commander: createFleetCommander(),
      location: {
        type: "wormhole",
        systemId: start.systemId,
        wormholeKey: start.wormholeKey,
      },
    });
    appendExplorationValue(progress.exploration.systems, side.id, start.systemId);
  });

  return progress;
}

function createBasicScenarioFleetStarts(seed) {
  const previewNodes = createNodes(createRandom(seed));
  return createOuterLinks(previewNodes, createRandom(`${seed}:outer-links`))
    .map((link) => ({
      systemId: String(link.parentId),
      wormholeKey: createOuterLinkKey(link),
    }));
}

function createOuterLinkKey(link) {
  if (!link) {
    return "";
  }
  const end = link.end ?? {};
  return [
    link.parentId,
    Number(end.x ?? 0).toFixed(4),
    Number(end.y ?? 0).toFixed(4),
    Number(end.z ?? 0).toFixed(4),
  ].map((part) => encodeURIComponent(String(part))).join(":");
}

function shuffleSeeded(items, random) {
  const result = items.slice();
  for (let index = result.length - 1; index > 0; index -= 1) {
    const swapIndex = Math.floor(random() * (index + 1));
    [result[index], result[swapIndex]] = [result[swapIndex], result[index]];
  }
  return result;
}

function normalizeGameFleets(fleets, setup, turn = DEFAULT_TURN_NUMBER, activeSideIndex = 0) {
  if (!Array.isArray(fleets)) {
    return [];
  }

  const sides = getGameStateSides({ setup });
  const sideIds = new Set(sides.map((side) => side.id));
  const normalized = fleets
    .map((fleet, index) => {
      if (!fleet || typeof fleet !== "object") {
        return null;
      }

      const requestedSideIndex = Number.parseInt(fleet.ownerSideIndex ?? fleet.sideIndex ?? index, 10);
      const fallbackSide = Number.isFinite(requestedSideIndex)
        ? sides[THREE.MathUtils.clamp(requestedSideIndex, 0, Math.max(0, sides.length - 1))]
        : sides[0];
      const ownerSideId = String(fleet.ownerSideId ?? fleet.sideId ?? fallbackSide?.id ?? "").trim();
      if (!ownerSideId || !sideIds.has(ownerSideId)) {
        return null;
      }

      const location = normalizeFleetLocation(fleet.location ?? fleet);
      if (!location) {
        return null;
      }

      const sideIndex = sides.findIndex((side) => side.id === ownerSideId);
      const id = String(fleet.id ?? `fleet-${ownerSideId}-${index + 1}`).trim() || `fleet-${ownerSideId}-${index + 1}`;
      return {
        id,
        ownerSideId,
        ownerSideIndex: sideIndex >= 0 ? sideIndex : 0,
        name: String(fleet.name ?? `${sides[sideIndex]?.name ?? "SIDE"} FLEET`).trim() || "FLEET",
        commander: normalizeFleetCommander(getFleetCommanderSource(fleet)),
        creationNumber: normalizeFleetCreationNumber(fleet.creationNumber ?? fleet.number ?? fleet.serial),
        location,
        movement: normalizeFleetMovement(fleet.movement, turn, activeSideIndex),
      };
    })
    .filter(Boolean);
  assignFleetCreationNumbers(normalized);
  return normalized;
}

function normalizeFleetCreationNumber(value) {
  const parsed = Number.parseInt(value, 10);
  return Number.isFinite(parsed) && parsed > 0
    ? parsed
    : null;
}

function assignFleetCreationNumbers(fleets) {
  const usedBySide = new Map();
  const nextBySide = new Map();
  for (const fleet of fleets) {
    const sideId = fleet.ownerSideId;
    if (!usedBySide.has(sideId)) {
      usedBySide.set(sideId, new Set());
      nextBySide.set(sideId, 1);
    }
    const used = usedBySide.get(sideId);
    if (fleet.creationNumber && !used.has(fleet.creationNumber)) {
      used.add(fleet.creationNumber);
      nextBySide.set(sideId, Math.max(nextBySide.get(sideId), fleet.creationNumber + 1));
      continue;
    }
    fleet.creationNumber = null;
  }

  for (const fleet of fleets) {
    if (fleet.creationNumber) {
      continue;
    }
    const sideId = fleet.ownerSideId;
    const used = usedBySide.get(sideId);
    let nextNumber = nextBySide.get(sideId) ?? 1;
    while (used.has(nextNumber)) {
      nextNumber += 1;
    }
    fleet.creationNumber = nextNumber;
    used.add(nextNumber);
    nextBySide.set(sideId, nextNumber + 1);
  }
}

function createDefaultFleetMovement(turn = DEFAULT_TURN_NUMBER, activeSideIndex = 0) {
  return {
    turn: getGameTurnNumber({ turn }),
    activeSideIndex: normalizeTurnSideIndex(activeSideIndex, Math.max(1, getGameStateSideCount(currentGameState))),
    system: FLEET_SYSTEM_MOVES_PER_TURN,
    link: FLEET_LINK_MOVES_PER_TURN,
  };
}

function normalizeFleetMovement(movement, turn = DEFAULT_TURN_NUMBER, activeSideIndex = 0) {
  const normalizedTurn = getGameTurnNumber({ turn });
  const normalizedActiveSideIndex = Number.isFinite(Number(activeSideIndex))
    ? Number.parseInt(activeSideIndex, 10)
    : 0;
  const sourceTurn = Number.parseInt(movement?.turn ?? movement?.turnNumber, 10);
  const sourceActiveSideIndex = Number.parseInt(
    movement?.activeSideIndex ?? movement?.sideIndex ?? movement?.currentSideIndex,
    10,
  );

  if (sourceTurn !== normalizedTurn || sourceActiveSideIndex !== normalizedActiveSideIndex) {
    return {
      turn: normalizedTurn,
      activeSideIndex: normalizedActiveSideIndex,
      system: FLEET_SYSTEM_MOVES_PER_TURN,
      link: FLEET_LINK_MOVES_PER_TURN,
    };
  }

  return {
    turn: normalizedTurn,
    activeSideIndex: normalizedActiveSideIndex,
    system: clampFleetMovementValue(movement?.system ?? movement?.systemMoves, FLEET_SYSTEM_MOVES_PER_TURN),
    link: clampFleetMovementValue(movement?.link ?? movement?.linkMoves, FLEET_LINK_MOVES_PER_TURN),
  };
}

function clampFleetMovementValue(value, maxValue) {
  const parsed = Number.parseInt(value, 10);
  return Number.isFinite(parsed)
    ? THREE.MathUtils.clamp(parsed, 0, maxValue)
    : maxValue;
}

function normalizeFleetLocation(location) {
  if (!location || typeof location !== "object") {
    return null;
  }

  const systemId = normalizeRuntimeNullableString(
    location.systemId ?? location.nodeId ?? location.parentId,
  );
  if (!systemId) {
    return null;
  }

  const type = String(location.type ?? "system").trim().toLowerCase();
  if (type === "planet") {
    const planetKey = normalizeRuntimeNullableString(location.planetKey ?? location.objectKey ?? location.key);
    const slotIndex = normalizeFleetSlotIndex(location.slotIndex ?? location.slot);
    return planetKey
      ? { type: "planet", systemId, planetKey, slotIndex }
      : { type: "system", systemId };
  }

  if (type === "wormhole") {
    const wormholeKey = normalizeRuntimeNullableString(location.wormholeKey ?? location.key);
    return wormholeKey
      ? { type: "wormhole", systemId, wormholeKey }
      : { type: "system", systemId };
  }

  if (type === "link") {
    const targetSystemId = normalizeRuntimeNullableString(location.targetSystemId ?? location.targetId);
    return targetSystemId
      ? { type: "link", systemId, targetSystemId }
      : { type: "system", systemId };
  }

  return { type: "system", systemId };
}

function normalizeFleetSlotIndex(value) {
  const parsed = Number.parseInt(value, 10);
  return Number.isFinite(parsed)
    ? THREE.MathUtils.clamp(parsed, 0, FLEET_SYSTEM_SLOT_COUNT - 1)
    : null;
}

function normalizeGameExploration(exploration, setup, fleets) {
  const normalized = createEmptyExplorationState();
  const sides = getGameStateSides({ setup });
  const sideIds = new Set(sides.map((side) => side.id));
  normalizeExplorationBucket(exploration?.systems, sideIds, normalized.systems);
  normalizeExplorationBucket(exploration?.planets, sideIds, normalized.planets);
  normalizeExplorationBucket(exploration?.planetViews, sideIds, normalized.planetViews);
  normalizeExplorationBucket(exploration?.links, sideIds, normalized.links);
  normalizeExplorationList(exploration?.visitedPlanetViews, normalized.visitedPlanetViews);

  for (const fleet of fleets) {
    appendExplorationValue(normalized.systems, fleet.ownerSideId, fleet.location.systemId);
    if (fleet.location.type === "planet" && fleet.location.planetKey) {
      appendExplorationValue(normalized.planets, fleet.ownerSideId, fleet.location.planetKey);
    }
  }

  return normalized;
}

function normalizeExplorationBucket(source, sideIds, target) {
  if (!source || typeof source !== "object") {
    return;
  }

  for (const [sideId, values] of Object.entries(source)) {
    const normalizedSideId = String(sideId).trim();
    if (!sideIds.has(normalizedSideId) || !Array.isArray(values)) {
      continue;
    }

    values.forEach((value) => {
      appendExplorationValue(target, normalizedSideId, value);
    });
  }
}

function appendExplorationValue(bucket, sideId, value) {
  const normalizedSideId = String(sideId ?? "").trim();
  const normalizedValue = normalizeRuntimeNullableString(value);
  if (!normalizedSideId || !normalizedValue) {
    return;
  }

  if (!Array.isArray(bucket[normalizedSideId])) {
    bucket[normalizedSideId] = [];
  }
  if (!bucket[normalizedSideId].includes(normalizedValue)) {
    bucket[normalizedSideId].push(normalizedValue);
  }
}

function getGameTurnNumber(gameState) {
  const turn = Number.parseInt(gameState?.turn ?? gameState?.turnNumber ?? DEFAULT_TURN_NUMBER, 10);
  return Number.isFinite(turn) && turn >= DEFAULT_TURN_NUMBER
    ? turn
    : DEFAULT_TURN_NUMBER;
}

function getGameStateSides(gameState) {
  return Array.isArray(gameState?.setup?.sides)
    ? gameState.setup.sides.slice(0, NEW_GAME_MAX_SIDE_COUNT)
    : [];
}

function getGameStateSideCount(gameState) {
  return getGameStateSides(gameState).length;
}

function normalizeTurnSideIndex(value, sideCount) {
  if (sideCount <= 0) {
    return 0;
  }

  const index = Number.parseInt(value ?? 0, 10);
  return Number.isFinite(index)
    ? THREE.MathUtils.clamp(index, 0, sideCount - 1)
    : 0;
}

function normalizeCompletedSideIndices(value, sideCount) {
  if (sideCount <= 0) {
    return [];
  }

  const source = Array.isArray(value) ? value : [];
  return Array.from(new Set(source
    .map((index) => Number.parseInt(index, 10))
    .filter((index) => Number.isFinite(index) && index >= 0 && index < sideCount)));
}

function getActiveGameSide(gameState = currentGameState) {
  const state = gameState ?? createEmptyGameState();
  const sides = getGameStateSides(state);
  if (sides.length === 0) {
    return null;
  }
  return sides[normalizeTurnSideIndex(state.activeSideIndex, sides.length)] ?? null;
}

function getActiveGameSideId(gameState = currentGameState) {
  return getActiveGameSide(gameState)?.id ?? null;
}

function getGameSideById(sideId, gameState = currentGameState) {
  const normalizedSideId = String(sideId ?? "").trim();
  if (!normalizedSideId) {
    return null;
  }
  return getGameStateSides(gameState).find((side) => side.id === normalizedSideId) ?? null;
}

function getSideColorById(sideId, gameState = currentGameState) {
  const side = getGameSideById(sideId, gameState);
  if (!side) {
    return "#ffffff";
  }
  const fallback = createNewGameSideColor(side.index ?? 0, gameState?.setup?.seed ?? SEED);
  return normalizeCssColor(side.color, fallback);
}

function shouldEnforceExploration() {
  return !isEditorMode &&
    getGameStateSideCount(currentGameState) > 0 &&
    Array.isArray(currentGameState.fleets) &&
    currentGameState.fleets.length > 0;
}

function getExplorationValues(kind, sideId, gameState = currentGameState) {
  const bucket = gameState?.exploration?.[kind];
  const values = bucket?.[sideId];
  return new Set(Array.isArray(values) ? values.map((value) => String(value)) : []);
}

function isSystemExploredForSide(systemId, sideId, gameState = currentGameState) {
  const normalizedSystemId = normalizeRuntimeNullableString(systemId);
  if (!normalizedSystemId || !sideId) {
    return false;
  }
  return getExplorationValues("systems", sideId, gameState).has(normalizedSystemId);
}

function isSystemAccessibleForActiveSide(nodeOrId) {
  if (!shouldEnforceExploration()) {
    return true;
  }

  const systemId = normalizeRuntimeNullableString(nodeOrId?.id ?? nodeOrId);
  return isSystemExploredForSide(systemId, getActiveGameSideId(), currentGameState);
}

function getPlanetExplorationKey(planet) {
  return getRuntimeObjectKey(planet);
}

function isPlanetExploredForSide(planetOrKey, sideId, gameState = currentGameState) {
  const planetKey = typeof planetOrKey === "string"
    ? planetOrKey
    : getPlanetExplorationKey(planetOrKey);
  if (!planetKey || !sideId) {
    return false;
  }
  return getExplorationValues("planets", sideId, gameState).has(planetKey);
}

function isPlanetAccessibleForActiveSide(planetOrKey) {
  if (!shouldEnforceExploration()) {
    return true;
  }
  return isPlanetExploredForSide(planetOrKey, getActiveGameSideId(), currentGameState);
}

function normalizeExplorationList(source, target) {
  if (!Array.isArray(source) || !Array.isArray(target)) {
    return;
  }
  source.forEach((value) => appendUniqueExplorationListValue(target, value));
}

function appendUniqueExplorationListValue(target, value) {
  const normalizedValue = normalizeRuntimeNullableString(value);
  if (!Array.isArray(target) || !normalizedValue || target.includes(normalizedValue)) {
    return;
  }
  target.push(normalizedValue);
}

function hasVisitedPlanetViewForSide(planetOrKey, sideId, gameState = currentGameState) {
  const planetKey = typeof planetOrKey === "string"
    ? planetOrKey
    : getPlanetExplorationKey(planetOrKey);
  if (!planetKey || !sideId) {
    return false;
  }
  return getExplorationValues("planetViews", sideId, gameState).has(planetKey);
}

function hasVisitedPlanetViewForActiveSide(planetOrKey) {
  const planetKey = typeof planetOrKey === "string"
    ? planetOrKey
    : getPlanetExplorationKey(planetOrKey);
  if (!planetKey) {
    return false;
  }
  if (Array.isArray(currentGameState?.exploration?.visitedPlanetViews) &&
    currentGameState.exploration.visitedPlanetViews.includes(planetKey)) {
    return true;
  }
  return hasVisitedPlanetViewForSide(planetKey, getActiveGameSideId(), currentGameState);
}

function markPlanetViewVisitedForActiveSide(planetOrKey) {
  const sideId = getActiveGameSideId();
  const planetKey = typeof planetOrKey === "string"
    ? planetOrKey
    : getPlanetExplorationKey(planetOrKey);
  if (!planetKey) {
    return;
  }
  if (!currentGameState.exploration || typeof currentGameState.exploration !== "object") {
    currentGameState.exploration = createEmptyExplorationState();
  }
  if (!Array.isArray(currentGameState.exploration.visitedPlanetViews)) {
    currentGameState.exploration.visitedPlanetViews = [];
  }
  appendUniqueExplorationListValue(currentGameState.exploration.visitedPlanetViews, planetKey);
  if (sideId) {
    markExploredForSide(sideId, { planetViewKey: planetKey });
  }
}

function markExploredForSide(sideId, {
  systemId = null,
  planetKey = null,
  planetViewKey = null,
  linkKey = null,
} = {}) {
  const normalizedSideId = String(sideId ?? "").trim();
  if (!normalizedSideId) {
    return;
  }

  if (!currentGameState.exploration || typeof currentGameState.exploration !== "object") {
    currentGameState.exploration = createEmptyExplorationState();
  }
  if (!currentGameState.exploration.systems) {
    currentGameState.exploration.systems = {};
  }
  if (!currentGameState.exploration.planets) {
    currentGameState.exploration.planets = {};
  }
  if (!currentGameState.exploration.planetViews) {
    currentGameState.exploration.planetViews = {};
  }
  if (!currentGameState.exploration.links) {
    currentGameState.exploration.links = {};
  }
  if (!Array.isArray(currentGameState.exploration.visitedPlanetViews)) {
    currentGameState.exploration.visitedPlanetViews = [];
  }

  appendExplorationValue(currentGameState.exploration.systems, normalizedSideId, systemId);
  appendExplorationValue(currentGameState.exploration.planets, normalizedSideId, planetKey);
  appendExplorationValue(currentGameState.exploration.planetViews, normalizedSideId, planetViewKey);
  appendExplorationValue(currentGameState.exploration.links, normalizedSideId, linkKey);
}

function getObjectDetailStateByKey(detailKey, gameState = currentGameState) {
  const normalizedKey = normalizeRuntimeNullableString(detailKey);
  return normalizedKey && gameState?.objectDetails
    ? gameState.objectDetails[normalizedKey] ?? null
    : null;
}

function getVisiblePlanetOwnership(planetOrKey, gameState = currentGameState) {
  const planetKey = typeof planetOrKey === "string"
    ? planetOrKey
    : getPlanetExplorationKey(planetOrKey);
  if (!planetKey) {
    return null;
  }

  return getDominantVisibleOwnershipForDetailKey(planetKey, gameState);
}

function getPlanetOwnership(planetOrKey, gameState = currentGameState) {
  const planetKey = typeof planetOrKey === "string"
    ? planetOrKey
    : getPlanetExplorationKey(planetOrKey);
  if (!planetKey) {
    return null;
  }

  const detailState = getObjectDetailStateByKey(planetKey, gameState);
  if (!detailState) {
    return null;
  }

  return getDominantOwnership(getObjectDetailOwnershipCounts(detailState), gameState);
}

function getDominantVisibleOwnershipForDetailKey(detailKey, gameState = currentGameState) {
  const detailState = getObjectDetailStateByKey(detailKey, gameState);
  if (!detailState) {
    return null;
  }

  const activeSideId = getActiveGameSideId(gameState);
  const isPlanetExplored = isPlanetExploredForSide(detailKey, activeSideId, gameState);
  return getDominantOwnership(
    getObjectDetailOwnershipCounts(detailState, (ownerSideId) => (
      ownerSideId === activeSideId || isPlanetExplored
    )),
    gameState,
  );
}

function getVisibleSystemOwnership(systemId, gameState = currentGameState) {
  const normalizedSystemId = normalizeRuntimeNullableString(systemId);
  if (!normalizedSystemId || !gameState?.objectDetails) {
    return null;
  }

  const ownershipCounts = new Map();
  for (const [detailKey, detailState] of Object.entries(gameState.objectDetails)) {
    if (getObjectDetailStateKeySystemId(detailKey) !== normalizedSystemId) {
      continue;
    }
    const visibleOwnership = getDominantVisibleOwnershipForDetailKey(detailKey, gameState);
    if (!visibleOwnership) {
      continue;
    }
    ownershipCounts.set(
      visibleOwnership.sideId,
      (ownershipCounts.get(visibleOwnership.sideId) ?? 0) + visibleOwnership.count,
    );
  }

  return getDominantOwnership(ownershipCounts, gameState);
}

function getObjectDetailOwnershipCounts(detailState, isOwnerVisible = () => true) {
  const ownershipCounts = new Map();
  const buildings = normalizeObjectDetailBuildings(detailState?.buildings, detailState?.towns, detailState?.cityStage);
  for (const building of buildings.values()) {
    const ownerSideId = normalizeObjectDetailOwnerSideId(building.ownerSideId);
    if (!ownerSideId || !isOwnerVisible(ownerSideId)) {
      continue;
    }
    ownershipCounts.set(ownerSideId, (ownershipCounts.get(ownerSideId) ?? 0) + 1);
  }
  return ownershipCounts;
}

function getDominantOwnership(ownershipCounts, gameState = currentGameState) {
  if (!ownershipCounts || ownershipCounts.size === 0) {
    return null;
  }

  const activeSideId = getActiveGameSideId(gameState);
  let bestSideId = null;
  let bestCount = -1;
  for (const [sideId, count] of ownershipCounts) {
    if (count > bestCount || (count === bestCount && sideId === activeSideId)) {
      bestSideId = sideId;
      bestCount = count;
    }
  }

  if (!bestSideId) {
    return null;
  }

  return {
    sideId: bestSideId,
    side: getGameSideById(bestSideId, gameState),
    color: getSideColorById(bestSideId, gameState),
    count: bestCount,
  };
}

function getObjectDetailStateKeySystemId(detailKey) {
  const firstPart = String(detailKey ?? "").split(":")[0] ?? "";
  try {
    return decodeURIComponent(firstPart);
  } catch {
    return firstPart;
  }
}

function syncVisibleSystemOwnershipColors() {
  if (isEditorMode || !isGameRuntimeReady || nodes.length === 0) {
    return;
  }

  const desiredColors = new Map();
  for (const node of nodes) {
    const ownership = getVisibleSystemOwnership(node.id);
    if (ownership?.color) {
      desiredColors.set(node.id, ownership.color);
    }
  }

  for (const [nodeId, currentColor] of Array.from(nodeColors.entries())) {
    const nextColor = desiredColors.get(nodeId);
    if (nextColor === currentColor) {
      desiredColors.delete(nodeId);
      continue;
    }
    startNodeExitAnimation(nodeId, currentColor);
    nodeColors.delete(nodeId);
    nodeAnimationProgress.delete(nodeId);
    removeEdgeAnimationsForNode(nodeId);
  }

  for (const [nodeId, color] of desiredColors) {
    nodeColors.set(nodeId, color);
    nodeAnimationProgress.set(nodeId, 0);
    addEdgeAnimationsForNode(nodeId, color);
  }
}

function refreshOwnershipVisualsAfterGameStateChange() {
  syncVisibleSystemOwnershipColors();
  refreshSystemOwnershipVisuals();
  updateStarmapFleetMarkers();
}

function getFleetById(fleetId, gameState = currentGameState) {
  const normalizedFleetId = String(fleetId ?? "").trim();
  if (!normalizedFleetId) {
    return null;
  }
  return gameState?.fleets?.find((fleet) => fleet.id === normalizedFleetId) ?? null;
}

function isFleetControlledByActiveSide(fleet, gameState = currentGameState) {
  return Boolean(fleet && fleet.ownerSideId === getActiveGameSideId(gameState));
}

function formatFleetCreationNumber(fleet) {
  const number = normalizeFleetCreationNumber(fleet?.creationNumber);
  return number
    ? formatRomanNumeral(number)
    : "";
}

function formatRomanNumeral(value) {
  const number = Number.parseInt(value, 10);
  if (!Number.isFinite(number) || number <= 0) {
    return "";
  }
  if (number > 3999) {
    return String(number);
  }

  const parts = [
    [1000, "M"],
    [900, "CM"],
    [500, "D"],
    [400, "CD"],
    [100, "C"],
    [90, "XC"],
    [50, "L"],
    [40, "XL"],
    [10, "X"],
    [9, "IX"],
    [5, "V"],
    [4, "IV"],
    [1, "I"],
  ];
  let remaining = number;
  let result = "";
  for (const [arabic, roman] of parts) {
    while (remaining >= arabic) {
      result += roman;
      remaining -= arabic;
    }
  }
  return result;
}

function getSelectedFleet() {
  const fleet = getFleetById(selectedFleetId);
  return isFleetControlledByActiveSide(fleet) && !pendingFleetLinkJumpIds.has(fleet.id)
    ? fleet
    : null;
}

function getVisibleFleetsForSystem(systemId) {
  const activeSideId = getActiveGameSideId();
  const normalizedSystemId = normalizeRuntimeNullableString(systemId);
  if (!activeSideId || !normalizedSystemId) {
    return [];
  }

  const hasActiveFleetInSystem = currentGameState.fleets.some((fleet) => (
    fleet.ownerSideId === activeSideId &&
    fleet.location?.systemId === normalizedSystemId
  ));
  return currentGameState.fleets.filter((fleet) => (
    fleet.location?.systemId === normalizedSystemId &&
    (fleet.ownerSideId === activeSideId || hasActiveFleetInSystem)
  )).sort(compareVisibleFleets(activeSideId));
}

function compareVisibleFleets(activeSideId) {
  return (left, right) => {
    const leftActive = left.ownerSideId === activeSideId ? 0 : 1;
    const rightActive = right.ownerSideId === activeSideId ? 0 : 1;
    if (leftActive !== rightActive) {
      return leftActive - rightActive;
    }
    return String(left.name).localeCompare(String(right.name));
  };
}

function selectFleet(fleetId) {
  const fleet = getFleetById(fleetId);
  if (!isFleetControlledByActiveSide(fleet) || pendingFleetLinkJumpIds.has(fleet.id)) {
    return false;
  }

  const willSelect = selectedFleetId !== fleet.id;
  selectedFleetId = willSelect ? fleet.id : null;
  if (willSelect) {
    playRandomFleetVoiceSound(fleet);
  }
  rerenderActiveSystemFleetMarkers();
  updateStarmapFleetMarkers();
  renderFleetActionPanel();
  return true;
}

function clearSelectedFleetIfInactive() {
  if (!selectedFleetId || getSelectedFleet()) {
    return;
  }
  selectedFleetId = null;
  renderFleetActionPanel();
}

function clearSelectedFleet() {
  if (!selectedFleetId) {
    return;
  }
  selectedFleetId = null;
  rerenderActiveSystemFleetMarkers();
  updateStarmapFleetMarkers();
  renderFleetActionPanel();
}

function ensureFleetMovementForCurrentTurn(fleet) {
  if (!fleet) {
    return createDefaultFleetMovement(currentGameState.turn, currentGameState.activeSideIndex);
  }

  fleet.movement = normalizeFleetMovement(
    fleet.movement,
    currentGameState.turn,
    currentGameState.activeSideIndex,
  );
  return fleet.movement;
}

function consumeFleetMovement(fleet, kind, amount = 1) {
  const movement = ensureFleetMovementForCurrentTurn(fleet);
  const key = kind === "link" ? "link" : "system";
  const cost = Math.max(1, Number.parseInt(amount, 10) || 1);
  if ((movement[key] ?? 0) < cost) {
    renderFleetActionPanel();
    return false;
  }

  movement[key] -= cost;
  renderFleetActionPanel();
  return true;
}

function renderFleetActionPanel() {
  if (!fleetActionPanel) {
    return;
  }

  const fleet = getSelectedFleet();
  fleetActionPanel.replaceChildren();
  if (!fleet || isStartMenuOpen || isEditorMode) {
    fleetActionPanel.hidden = true;
    return;
  }

  const movement = ensureFleetMovementForCurrentTurn(fleet);
  const infoPanel = createFleetActionInfoPanel(fleet, movement);
  const actionGrid = document.createElement("div");
  actionGrid.className = "fleet-action-panel__actions";
  const slotCount = FLEET_ACTION_GRID_COLUMNS * FLEET_ACTION_GRID_ROWS;
  for (let index = 0; index < slotCount; index += 1) {
    const button = document.createElement("button");
    button.className = "fleet-action-button";
    button.type = "button";
    if (index === 0) {
      button.classList.add("fleet-action-button--ping");
      button.textContent = "PING";
      button.setAttribute("aria-label", "Ping selected fleet");
      button.addEventListener("click", (event) => {
        event.stopPropagation();
        pingSelectedFleet();
      });
    } else {
      button.disabled = true;
      button.setAttribute("aria-label", "Fleet action slot");
    }
    actionGrid.append(button);
  }
  fleetActionPanel.append(infoPanel, actionGrid);
  fleetActionPanel.hidden = false;
}

function createFleetActionInfoPanel(fleet, movement) {
  const panel = document.createElement("div");
  panel.className = "fleet-action-panel__info";

  const title = document.createElement("div");
  title.className = "fleet-action-panel__fleet-title";
  const fleetNumber = formatFleetCreationNumber(fleet);
  title.textContent = `${fleetNumber ? `${fleetNumber} ` : ""}FLEET`;

  const commander = document.createElement("div");
  commander.className = "fleet-action-panel__commander";
  const commanderText = document.createElement("div");
  commanderText.className = "fleet-action-panel__commander-text";
  const commanderName = document.createElement("div");
  commanderName.className = "fleet-action-panel__commander-name";
  commanderName.textContent = fleet.commander?.name ?? "UNASSIGNED";
  const commanderRole = document.createElement("div");
  commanderRole.className = "fleet-action-panel__commander-role";
  commanderRole.textContent = "FLEET COMMANDER";
  commanderText.append(commanderName, commanderRole);
  const portrait = document.createElement("div");
  portrait.className = "fleet-action-panel__portrait";
  commander.append(portrait, commanderText);

  const limits = document.createElement("div");
  limits.className = "fleet-action-panel__limits";
  limits.append(
    createFleetActionLimitRow("FUEL", movement.system, FLEET_SYSTEM_MOVES_PER_TURN, "fuel"),
    createFleetActionLimitRow("HYPER", movement.link, FLEET_LINK_MOVES_PER_TURN, "hyper"),
  );

  panel.append(title, commander, limits);
  return panel;
}

function createFleetActionLimitRow(labelText, value, maxValue, kind) {
  const row = document.createElement("div");
  row.className = "fleet-action-panel__limit-row";
  const label = document.createElement("div");
  label.className = "fleet-action-panel__limit-label";
  label.textContent = labelText;
  const dots = document.createElement("div");
  dots.className = `fleet-action-panel__limit-dots fleet-action-panel__limit-dots--${kind}`;
  const remaining = THREE.MathUtils.clamp(Number.parseInt(value, 10) || 0, 0, maxValue);
  for (let index = 0; index < maxValue; index += 1) {
    const dot = document.createElement("span");
    dot.className = "fleet-action-panel__limit-dot";
    dot.classList.toggle("is-available", index < remaining);
    dots.append(dot);
  }
  row.append(label, dots);
  return row;
}

function pingSelectedFleet() {
  const fleet = getSelectedFleet();
  if (!fleet) {
    return false;
  }

  playRandomFleetVoiceSound(fleet);
  const marker = getVisibleFleetMarkerElement(fleet.id);
  if (marker) {
    startFleetMarkerPing(marker);
  }
  return true;
}

function getVisibleFleetMarkerElement(fleetId) {
  if (!systemScreenController.isOpen()) {
    const starmapMarker = getStarmapFleetMarkerElement(fleetId);
    if (starmapMarker?.isConnected && !starmapMarker.classList.contains("hidden")) {
      return starmapMarker;
    }
  }

  const systemMarker = getSystemFleetMarkerElement(fleetId);
  if (systemMarker?.isConnected && !systemMarker.classList.contains("hidden")) {
    return systemMarker;
  }

  const starmapMarker = getStarmapFleetMarkerElement(fleetId);
  if (starmapMarker?.isConnected && !starmapMarker.classList.contains("hidden")) {
    return starmapMarker;
  }

  return null;
}

function startFleetMarkerPing(marker) {
  for (let index = 0; index < 2; index += 1) {
    const ring = document.createElement("span");
    ring.className = "fleet-marker-ping-ring";
    ring.classList.toggle("fleet-marker-ping-ring--delayed", index === 1);
    marker.append(ring);
    ring.addEventListener("animationend", () => ring.remove(), { once: true });
  }
}

function moveSelectedFleetToPlanet(planet) {
  const fleet = getSelectedFleet();
  const planetKey = getPlanetExplorationKey(planet);
  if (!fleet) {
    return false;
  }
  if (!planet?.systemId || !planetKey || !consumeFleetMovement(fleet, "system")) {
    return true;
  }

  playRandomFleetMoveSound();
  updateFleetLocation(fleet.id, {
    type: "planet",
    systemId: planet.systemId,
    planetKey,
  });
  markExploredForSide(fleet.ownerSideId, {
    systemId: planet.systemId,
    planetKey,
  });
  selectedFleetId = null;
  finalizeFleetStateChange();
  return true;
}

function moveSelectedFleetToSystem(systemId) {
  const fleet = getSelectedFleet();
  const normalizedSystemId = normalizeRuntimeNullableString(systemId);
  if (!fleet) {
    return false;
  }
  if (!normalizedSystemId || !consumeFleetMovement(fleet, "link")) {
    return true;
  }

  playRandomFleetMoveSound();
  const activeSystemId = normalizeRuntimeNullableString(systemScreenController?.state?.activeNode?.id);
  updateFleetLocation(fleet.id, {
    type: "system",
    systemId: normalizedSystemId,
  });
  markExploredForSide(fleet.ownerSideId, { systemId: normalizedSystemId });
  if (activeSystemId && activeSystemId !== normalizedSystemId) {
    selectedFleetId = null;
  }
  finalizeFleetStateChange();
  return true;
}

function commandSelectedFleetToLink(systemId, targetSystemId) {
  const fleet = getSelectedFleet();
  const normalizedSystemId = normalizeRuntimeNullableString(systemId);
  const normalizedTargetSystemId = normalizeRuntimeNullableString(targetSystemId);
  if (!fleet || !normalizedSystemId || !normalizedTargetSystemId) {
    return false;
  }

  const isAlreadyAtLink = fleet.location?.type === "link" &&
    fleet.location.systemId === normalizedSystemId &&
    fleet.location.targetSystemId === normalizedTargetSystemId;
  if (isAlreadyAtLink) {
    if (!consumeFleetMovement(fleet, "link")) {
      return true;
    }
    startFleetLinkJump(fleet.id, normalizedSystemId, normalizedTargetSystemId);
    return true;
  }

  if (!consumeFleetMovement(fleet, "system")) {
    return true;
  }
  playRandomFleetMoveSound();
  updateFleetLocation(fleet.id, {
    type: "link",
    systemId: normalizedSystemId,
    targetSystemId: normalizedTargetSystemId,
  });
  markExploredForSide(fleet.ownerSideId, { systemId: normalizedSystemId });
  finalizeFleetStateChange();
  return true;
}

function commandSelectedFleetToStarmapSystem(targetSystemId) {
  const fleet = getSelectedFleet();
  if (!fleet) {
    return false;
  }

  const startSystemId = normalizeRuntimeNullableString(fleet.location?.systemId);
  const normalizedTargetSystemId = normalizeRuntimeNullableString(targetSystemId);
  if (!startSystemId || !normalizedTargetSystemId) {
    return true;
  }
  if (startSystemId === normalizedTargetSystemId) {
    return true;
  }

  const path = findSystemPath(startSystemId, normalizedTargetSystemId);
  if (!path || path.length < 2) {
    return true;
  }

  const linkCost = path.length - 1;
  if (!consumeFleetMovement(fleet, "link", linkCost)) {
    return true;
  }

  playRandomFleetMoveSound();
  pendingStarmapFleetMarkerPaths.set(fleet.id, path);
  const previousSystemId = path[path.length - 2] ?? startSystemId;
  updateFleetLocation(fleet.id, {
    type: "link",
    systemId: normalizedTargetSystemId,
    targetSystemId: previousSystemId,
  });
  for (let index = 0; index < path.length; index += 1) {
    markExploredForSide(fleet.ownerSideId, { systemId: path[index] });
    if (index > 0) {
      markExploredForSide(fleet.ownerSideId, {
        linkKey: getSystemLinkExplorationKey(path[index - 1], path[index]),
      });
    }
  }
  selectedFleetId = null;
  finalizeFleetStateChange();
  return true;
}

function startFleetLinkJump(fleetId, systemId, targetSystemId) {
  const fleet = getFleetById(fleetId);
  if (!fleet || pendingFleetLinkJumpIds.has(fleet.id)) {
    return;
  }

  pendingFleetLinkJumpIds.add(fleet.id);
  playFleetLinkJumpSound();
  renderFleetActionPanel();
  rerenderActiveSystemFleetMarkers();

  startSystemFleetLinkJumpEffect(fleet.id, () => {
    pendingFleetLinkJumpIds.delete(fleet.id);
    fleetLinkJumpTimers.delete(fleet.id);
    const currentFleet = getFleetById(fleet.id);
    if (!currentFleet) {
      finalizeFleetStateChange();
      return;
    }

    updateFleetLocation(currentFleet.id, {
      type: "link",
      systemId: targetSystemId,
      targetSystemId: systemId,
    });
    markExploredForSide(currentFleet.ownerSideId, { systemId: targetSystemId });
    selectedFleetId = null;
    finalizeFleetStateChange();
  });
}

function startSystemFleetLinkJumpEffect(fleetId, onFinish) {
  const previousTimers = fleetLinkJumpTimers.get(fleetId);
  if (previousTimers) {
    window.clearTimeout(previousTimers.collapseTimer);
    window.clearTimeout(previousTimers.finishTimer);
  }

  const marker = getSystemFleetMarkerElement(fleetId);
  if (marker) {
    marker.disabled = true;
    marker.setAttribute("aria-disabled", "true");
    marker.classList.add("system-fleet-marker--link-jump-pending");
  }

  const collapseTimer = window.setTimeout(() => {
    const activeMarker = getSystemFleetMarkerElement(fleetId) ?? marker;
    if (!activeMarker?.isConnected) {
      return;
    }

    if (!activeMarker.querySelector(".system-fleet-marker__jump-ring")) {
      const ring = document.createElement("span");
      ring.className = "system-fleet-marker__jump-ring";
      activeMarker.append(ring);
    }
    void activeMarker.offsetWidth;
    activeMarker.classList.add("system-fleet-marker--link-jump");
  }, FLEET_LINK_JUMP_DELAY_MS);

  const finishTimer = window.setTimeout(() => {
    onFinish();
  }, FLEET_LINK_JUMP_DELAY_MS + FLEET_LINK_JUMP_EFFECT_MS);

  fleetLinkJumpTimers.set(fleetId, { collapseTimer, finishTimer });
}

function getSystemFleetMarkerElement(fleetId) {
  const normalizedFleetId = String(fleetId ?? "");
  return Array.from(starSystem.querySelectorAll(".system-fleet-marker"))
    .find((marker) => marker.dataset.fleetId === normalizedFleetId) ?? null;
}

function getStarmapFleetMarkerElement(fleetId) {
  const normalizedFleetId = String(fleetId ?? "");
  return starmapFleetMarkerElements.get(normalizedFleetId) ?? null;
}

function clearFleetLinkJumpTimers() {
  for (const timers of fleetLinkJumpTimers.values()) {
    window.clearTimeout(timers.collapseTimer);
    window.clearTimeout(timers.finishTimer);
  }
  fleetLinkJumpTimers.clear();
  pendingFleetLinkJumpIds.clear();
}

function findSystemPath(startSystemId, targetSystemId) {
  const start = Number.parseInt(startSystemId, 10);
  const target = Number.parseInt(targetSystemId, 10);
  if (!Number.isFinite(start) || !Number.isFinite(target)) {
    return null;
  }
  if (start === target) {
    return [String(start)];
  }

  const queue = [start];
  const previous = new Map([[start, null]]);
  for (let queueIndex = 0; queueIndex < queue.length; queueIndex += 1) {
    const current = queue[queueIndex];
    for (const neighbor of adjacency.get(current) ?? []) {
      if (previous.has(neighbor)) {
        continue;
      }
      previous.set(neighbor, current);
      if (neighbor === target) {
        return reconstructSystemPath(previous, start, target);
      }
      queue.push(neighbor);
    }
  }
  return null;
}

function reconstructSystemPath(previous, start, target) {
  const path = [];
  let current = target;
  while (current !== null && current !== undefined) {
    path.push(String(current));
    if (current === start) {
      return path.reverse();
    }
    current = previous.get(current);
  }
  return null;
}

function getSystemLinkExplorationKey(systemA, systemB) {
  const a = String(systemA);
  const b = String(systemB);
  return Number(a) <= Number(b) ? `${a}:${b}` : `${b}:${a}`;
}

function moveSelectedFleetToWormhole(systemId, wormholeKey) {
  const fleet = getSelectedFleet();
  const normalizedSystemId = normalizeRuntimeNullableString(systemId);
  const normalizedWormholeKey = normalizeRuntimeNullableString(wormholeKey);
  if (!fleet) {
    return false;
  }
  if (!normalizedSystemId || !normalizedWormholeKey || !consumeFleetMovement(fleet, "system")) {
    return true;
  }

  playRandomFleetMoveSound();
  updateFleetLocation(fleet.id, {
    type: "wormhole",
    systemId: normalizedSystemId,
    wormholeKey: normalizedWormholeKey,
  });
  markExploredForSide(fleet.ownerSideId, { systemId: normalizedSystemId });
  finalizeFleetStateChange();
  return true;
}

function updateFleetLocation(fleetId, location) {
  const fleet = getFleetById(fleetId);
  if (!fleet) {
    return;
  }
  const previousAnchorKey = getFleetLocationAnchorKey(fleet.location);
  const nextLocation = normalizeFleetLocation(location) ?? fleet.location;
  const nextAnchorKey = getFleetLocationAnchorKey(nextLocation);
  if (
    nextLocation?.type === "planet" &&
    (nextLocation.slotIndex === null || previousAnchorKey !== nextAnchorKey)
  ) {
    nextLocation.slotIndex = createFleetPlanetSlotIndex(fleet.id, nextLocation);
  }
  fleet.location = nextLocation;
}

function createFleetPlanetSlotIndex(fleetId, location) {
  const random = createRandom([
    SEED,
    "fleet-slot",
    fleetId,
    location?.systemId,
    location?.planetKey,
    getGameTurnNumber(currentGameState),
    currentGameState.activeSideIndex,
    ++fleetMovementSerial,
  ].join(":"));
  return Math.floor(random() * FLEET_SYSTEM_SLOT_COUNT);
}

function finalizeFleetStateChange() {
  currentGameState = normalizeGameState(currentGameState);
  clearSelectedFleetIfInactive();
  refreshSystemGateAccess();
  refreshSystemPlanetAccess();
  rerenderActiveSystemFleetMarkers();
  refreshOwnershipVisualsAfterGameStateChange();
  renderFleetActionPanel();
  persistRuntimeSession();
}

function refreshSystemGateAccess() {
  if (!systemScreenController?.isOpen?.()) {
    return;
  }

  starSystem.querySelectorAll(".system-jump[data-target-system-id]").forEach((gate) => {
    const targetNode = getRuntimeNodeById(gate.dataset.targetSystemId);
    const isAccessible = isSystemAccessibleForActiveSide(targetNode);
    gate.classList.toggle("system-jump--locked", !isAccessible);
    gate.setAttribute("aria-disabled", String(!isAccessible));
  });
}

function refreshSystemPlanetAccess() {
  if (!systemScreenController?.isOpen?.()) {
    return;
  }

  starSystem.querySelectorAll(".system-planet-hit").forEach((hitTarget) => {
    const planet = hitTarget.userData?.planet;
    hitTarget.classList.toggle("system-planet-hit--locked", !isPlanetAccessibleForActiveSide(planet));
  });
}

function enforceCurrentViewExplorationAccess() {
  if (!shouldEnforceExploration()) {
    return;
  }

  const activeNode = systemScreenController?.state?.activeNode ?? null;
  if (activeNode && !isSystemAccessibleForActiveSide(activeNode)) {
    closeStarWindow();
    updateGameNavigationUi(true);
    return;
  }

  const activePlanet = getActiveRuntimePlanet();
  if (activePlanet && !isPlanetAccessibleForActiveSide(activePlanet)) {
    if (isObjectDetailOpen) {
      returnToOrbitFromObjectDetail();
      return;
    }
    if (planetScreenController?.isOpen?.()) {
      returnToStarSystemFromPlanet();
    }
  }
}

function normalizeNewGameSetupState(setup) {
  if (!setup || typeof setup !== "object") {
    return null;
  }

  const seed = String(setup.seed ?? MENU_DEFAULT_SEED).trim() || MENU_DEFAULT_SEED;
  const scenarioId = String(setup.scenarioId ?? NEW_GAME_BASIC_SCENARIO_ID).trim() || NEW_GAME_BASIC_SCENARIO_ID;
  const mode = setup.mode === NEW_GAME_MODE_ONLINE ? NEW_GAME_MODE_ONLINE : NEW_GAME_MODE_HOTSEAT;
  const sidesSource = Array.isArray(setup.sides) ? setup.sides.slice(0, NEW_GAME_MAX_SIDE_COUNT) : [];
  const sides = sidesSource.map((side, index) => ({
    id: String(side?.id ?? `side-${index + 1}`),
    index,
    name: String(side?.name ?? `SIDE ${index + 1}`).trim() || `SIDE ${index + 1}`,
    color: String(side?.color ?? createNewGameSideColor(index, seed)),
    government: NEW_GAME_GOVERNMENTS[side?.government]
      ? side.government
      : NEW_GAME_DEFAULT_GOVERNMENT_ID,
    isPlayer: side?.isPlayer === true,
  }));

  return {
    version: 1,
    seed,
    scenarioId,
    scenarioLabel: String(setup.scenarioLabel ?? NEW_GAME_SCENARIOS[scenarioId]?.label ?? scenarioId).trim(),
    mode,
    playerId: String(setup.playerId ?? DEFAULT_PLAYER_ID).trim() || DEFAULT_PLAYER_ID,
    playerSideId: String(setup.playerSideId ?? sides.find((side) => side.isPlayer)?.id ?? "side-1"),
    sides,
    createdAt: String(setup.createdAt ?? new Date().toISOString()),
  };
}

function createGameStateForSaveLoad(save) {
  return normalizeGameState({
    ...save.gameState,
    saveFileName: save.fileName,
  });
}

function serializeCurrentGameState() {
  syncActiveObjectDetailToGameState();
  return normalizeGameState(currentGameState);
}

async function exitNebulum() {
  if (isAppExited) {
    return;
  }

  isAppExited = true;
  isStartMenuOpen = true;
  stopAnimationLoop();
  closeMenuDialogs();
  closeGameDialogs();
  stopMenuEnvironmentMachine();
  startMenu.classList.remove("start-menu--hidden");
  startMenu.classList.add("start-menu--shutdown");
  startMenu.setAttribute("aria-hidden", "false");
  document.body.classList.add("start-menu-open");
  setMenuStatus("CLOSING");
  await fadeOutMenuMusic(400);
  audioMixer?.dispose();
  audioMixer = null;
  menuEnvironmentMachine = null;

  disposeNebulumRuntime();
  await clearTextureRuntimeCache();

  menuStatus.textContent = "PROCESS CLOSED";
  window.setTimeout(() => {
    closePwaWindowFromApp();
  }, 0);
}

function initPanel() {
  seedInput.value = SEED;
  updateCurrentColorUi();
  updateUsedColorsUi();
  updateMaskToolUi();
  renderSkyGradientControls();

  regenerateButton.addEventListener("click", regenerateFromSeedInput);
  seedInput.addEventListener("keydown", (event) => {
    if (event.key === "Enter") {
      regenerateFromSeedInput();
    }
  });

  currentColorSwatch.addEventListener("click", (event) => {
    event.stopPropagation();
    openColorPicker(currentColorSwatch, currentMaskColor, (color) => {
      currentMaskColor = color;
      updateCurrentColorUi();
    });
  });

  maskToolToggle.addEventListener("click", () => {
    isMaskToolEnabled = !isMaskToolEnabled;
    updateMaskToolUi();
  });

  backToStarmapButton.addEventListener("click", closeStarWindow);

  toggleTidalZone.addEventListener("click", () => {
    isTidalZoneVisible = !isTidalZoneVisible;
    toggleTidalZone.setAttribute("aria-pressed", String(isTidalZoneVisible));
    for (const { el, zone } of activeZoneElements) {
      if (zone === "tidal") el.classList.toggle("visible", isTidalZoneVisible);
    }
  });

  toggleHzZone.addEventListener("click", () => {
    isHzZoneVisible = !isHzZoneVisible;
    toggleHzZone.setAttribute("aria-pressed", String(isHzZoneVisible));
    for (const { el, zone } of activeZoneElements) {
      if (zone === "hz") el.classList.toggle("visible", isHzZoneVisible);
    }
  });

  planetScreenBackSystem.addEventListener("click", returnToStarSystemFromPlanet);
  planetScreenBackStarmap.addEventListener("click", () => {
    planetScreenController.close();
    closeObjectDetailScreen();
    closeStarWindow();
  });
  objectDetailBackSystem.addEventListener("click", returnToStarSystemFromObjectDetail);
  objectDetailBackStarmap.addEventListener("click", () => {
    closeObjectDetailScreen();
    planetScreenController.close();
    closeStarWindow();
  });
  objectDetailBackOrbit.addEventListener("click", returnToOrbitFromObjectDetail);
  objectDetailScreen.addEventListener("pointermove", updateObjectDetailCursorInteraction);
  objectDetailScreen.addEventListener("pointerleave", clearObjectDetailCursorInteraction);
  objectDetailTexture.addEventListener("click", onObjectDetailTextureClick);

  planetWindowClose.addEventListener("click", closePlanetWindow);

  window.addEventListener("keydown", (event) => {
    if (event.key === "Escape" && isObjectDetailOpen) {
      returnToOrbitFromObjectDetail();
      return;
    }
    if (event.key === "Escape" && planetScreenController.isOpen()) {
      planetScreenController.close();
      persistRuntimeSession("system");
      return;
    }
    if (event.key === "Escape" && isPlanetWindowOpen) {
      closePlanetWindow();
      return;
    }
    if (event.key === "Escape" && systemScreenController.isOpen()) {
      closeStarWindow();
    }
  });

  document.addEventListener("pointerdown", (event) => {
    if (!isPlanetWindowOpen) {
      return;
    }
    if (planetWindow.contains(event.target)) {
      return;
    }
    if (event.target instanceof Element &&
        event.target.closest(".system-planet-hit, .music-player")) {
      return;
    }
    closePlanetWindow();
  });

  planetWindow.addEventListener("pointerdown", (event) => {
    if (event.target !== planetWindow) {
      return;
    }
    event.preventDefault();
    isDraggingPlanetWindow = true;
    planetWindow.classList.add("dragging");
    planetWindow.setPointerCapture(event.pointerId);
    planetWindowDragStart.x = event.clientX;
    planetWindowDragStart.y = event.clientY;
    planetWindowDragStart.offsetX = planetWindowOffset.x;
    planetWindowDragStart.offsetY = planetWindowOffset.y;
  });

  planetWindow.addEventListener("pointermove", (event) => {
    if (!isDraggingPlanetWindow) {
      return;
    }
    planetWindowOffset.x = planetWindowDragStart.offsetX + (event.clientX - planetWindowDragStart.x);
    planetWindowOffset.y = planetWindowDragStart.offsetY + (event.clientY - planetWindowDragStart.y);
    planetWindow.style.setProperty("--pw-x", `${planetWindowOffset.x}px`);
    planetWindow.style.setProperty("--pw-y", `${planetWindowOffset.y}px`);
  });

  const endPlanetWindowDrag = (event) => {
    if (!isDraggingPlanetWindow) {
      return;
    }
    isDraggingPlanetWindow = false;
    planetWindow.classList.remove("dragging");
    if (planetWindow.hasPointerCapture(event.pointerId)) {
      planetWindow.releasePointerCapture(event.pointerId);
    }
  };
  planetWindow.addEventListener("pointerup", endPlanetWindowDrag);
  planetWindow.addEventListener("pointercancel", endPlanetWindowDrag);

  clearButton.addEventListener("click", () => {
    nodeColors.clear();
    nodeAnimationProgress.clear();
    edgeAnimationProgress.clear();
    edgeAnimationOrigins.clear();
    nodeExitAnimations.clear();
    edgeExitAnimations.clear();
    updateUsedColorsUi();
  });
  editorSaveButton.addEventListener("click", () => {});

}

function updateMaskToolUi() {
  maskToolToggle.classList.toggle("active", isMaskToolEnabled);
  maskToolToggle.textContent = isMaskToolEnabled ? "On" : "Off";
  maskToolToggle.setAttribute("aria-pressed", String(isMaskToolEnabled));
}

function renderSkyGradientControls() {
  skyGradientColorsElement.replaceChildren();

  for (let index = 0; index < 4; index += 1) {
    const wrapper = document.createElement("div");
    wrapper.className = "gradient-color-wrap";
    const color = skyGradientColors[index] || null;

    const input = document.createElement("button");
    input.className = color ? "gradient-color" : "gradient-color gradient-color--empty";
    input.type = "button";
    input.title = color ? `Space gradient color ${index + 1}` : "Add space gradient color";

    if (color) {
      input.style.color = color;
      input.addEventListener("click", (event) => {
        event.stopPropagation();
        openColorPicker(input, color, (nextColor) => {
          skyGradientColors[index] = nextColor;
          input.style.color = nextColor;
          updateSkyTexture();
        });
      });
    } else {
      input.addEventListener("click", () => addSkyGradientColorAt(index));
    }

    wrapper.append(input);

    if (color) {
      const removeButton = document.createElement("button");
      removeButton.className = "gradient-remove";
      removeButton.type = "button";
      removeButton.textContent = "x";
      removeButton.title = "Remove color";
      removeButton.addEventListener("click", () => {
        skyGradientColors[index] = null;
        renderSkyGradientControls();
        updateSkyTexture();
      });
      wrapper.append(removeButton);
    }

    skyGradientColorsElement.append(wrapper);
  }

  const regenButton = document.createElement("button");
  regenButton.className = "gradient-regen";
  regenButton.type = "button";
  regenButton.title = "Regenerate space gradient";
  regenButton.textContent = "R";
  regenButton.addEventListener("click", regenerateSkyGradient);
  skyGradientColorsElement.append(regenButton);
}

function addSkyGradientColorAt(index) {
  if (index < 0 || index >= 4) {
    return;
  }

  skyGradientColors[index] = "#070812";
  renderSkyGradientControls();
  updateSkyTexture();
}

function regenerateSkyGradient() {
  skyRandomVersion += 1;
  updateSkyTexture();
}

function regenerateFromSeedInput() {
  const nextSeed = seedInput.value.trim() || "nebulum";
  const url = new URL(window.location.href);
  url.searchParams.set("seed", nextSeed);
  url.searchParams.delete("multiplier");
  window.location.href = url.toString();
}

function updateCurrentColorUi() {
  currentColorSwatch.style.color = currentMaskColor;
  currentColorValue.textContent = currentMaskColor;
}

function updateUsedColorsUi() {
  usedColors.replaceChildren();

  for (const color of getUsedMaskColors()) {
    const button = document.createElement("button");
    button.className = "used-color";
    button.type = "button";
    button.title = color;
    button.style.color = color;
    button.addEventListener("click", () => {
      currentMaskColor = color;
      updateCurrentColorUi();
    });
    usedColors.append(button);
  }
}

function getUsedMaskColors() {
  return Array.from(new Set(nodeColors.values())).sort();
}

function buildNodes(points) {
  const geometry = new THREE.SphereGeometry(1, 24, 16);
  const hitGeometry = new THREE.SphereGeometry(1, 16, 10);
  const hitMaterial = new THREE.MeshBasicMaterial({
    transparent: true,
    opacity: 0,
    depthWrite: false,
  });

  for (const node of points) {
    const material = new THREE.MeshStandardMaterial({
      color: node.coreColor,
      emissive: node.coreColor,
      emissiveIntensity: node.blackCore ? 0.1 : 5.8 * node.glowBoost,
      roughness: 0.1,
      metalness: 0,
      transparent: false,
      depthWrite: true,
    });
    const mesh = new THREE.Mesh(geometry, material);
    mesh.position.copy(node.position);
    mesh.scale.setScalar(node.size);
    mesh.userData.node = node;
    mesh.renderOrder = node.blackCore ? 8 : 0;

    const glow = createNodeGlow(node);

    mesh.userData.glow = glow;
    nodeMeshes.push(mesh);
    graphRoot.add(mesh);
    graphRoot.add(glow);
    labelElements.push(createStarLabel(node));

    if (node.blackCore) {
      const disk = new THREE.Sprite(blackHoleDiskMaterial);
      disk.position.copy(node.position);
      disk.scale.setScalar(node.size * 3.1);
      disk.renderOrder = 40;
      graphRoot.add(disk);
    }

    const hitTarget = new THREE.Mesh(hitGeometry, hitMaterial);
    hitTarget.position.copy(node.position);
    hitTarget.scale.setScalar(node.size * 6.2);
    hitTarget.userData.node = node;
    hitTarget.userData.visual = mesh;
    hitTargets.push(hitTarget);
    graphRoot.add(hitTarget);
  }
}

function createStarLabel(node) {
  const label = document.createElement("div");
  label.className = "star-label";
  label.textContent = node.name;
  starLabels.append(label);
  return label;
}

function buildLinks(edges) {
  const positions = new Float32Array(edges.length * 6);
  edges.forEach((edge, index) => {
    const start = nodes[edge.a].position;
    const end = nodes[edge.b].position;
    positions.set([start.x, start.y, start.z, end.x, end.y, end.z], index * 6);
  });

  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute("position", new THREE.BufferAttribute(positions, 3));

  const material = new THREE.LineBasicMaterial({
    color: 0xffffff,
    transparent: true,
    opacity: 0.46,
    blending: THREE.AdditiveBlending,
  });

  const lineSegments = new THREE.LineSegments(geometry, material);
  graphRoot.add(lineSegments);

  const halo = new THREE.LineSegments(
    geometry.clone(),
    new THREE.LineBasicMaterial({
      color: 0xffffff,
      transparent: true,
      opacity: 0.12,
      blending: THREE.AdditiveBlending,
    }),
  );
  halo.scale.setScalar(1.004);
  graphRoot.add(halo);
}

function buildOuterLinks(edges) {
  if (edges.length === 0) {
    return;
  }

  const positions = new Float32Array(edges.length * 6);
  const alphas = new Float32Array(edges.length * 2);

  edges.forEach((edge, index) => {
    positions.set(
      [
        edge.start.x,
        edge.start.y,
        edge.start.z,
        edge.end.x,
        edge.end.y,
        edge.end.z,
      ],
      index * 6,
    );
    alphas.set([edge.opacity, 0], index * 2);
  });

  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute("position", new THREE.BufferAttribute(positions, 3));
  geometry.setAttribute("alpha", new THREE.BufferAttribute(alphas, 1));

  const material = new THREE.ShaderMaterial({
    uniforms: {
      opacity: { value: 1 },
    },
    vertexShader: `
      attribute float alpha;
      varying float vAlpha;

      void main() {
        vAlpha = alpha;
        gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
      }
    `,
    fragmentShader: `
      uniform float opacity;
      varying float vAlpha;

      void main() {
        gl_FragColor = vec4(vec3(1.0), vAlpha * opacity);
      }
    `,
    transparent: true,
    depthWrite: false,
    blending: THREE.AdditiveBlending,
  });

  const lineSegments = new THREE.LineSegments(geometry, material);
  graphRoot.add(lineSegments);

  const halo = new THREE.LineSegments(
    geometry.clone(),
    material.clone(),
  );
  halo.material.transparent = true;
  halo.material.depthWrite = false;
  halo.material.blending = THREE.AdditiveBlending;
  halo.material.uniforms.opacity.value = 0.28;
  halo.scale.setScalar(1.004);
  graphRoot.add(halo);
}

function buildSky(random) {
  skyMesh = new THREE.Mesh(
    new THREE.SphereGeometry(42, 160, 96),
    createSkyGradientMaterial(random),
  );
  skyMesh.renderOrder = -10;
  graphRoot.add(skyMesh);

  const starCount = 1800;
  const radius = 39;
  const positions = new Float32Array(starCount * 3);
  const colors = new Float32Array(starCount * 3);
  const sizes = new Float32Array(starCount);

  for (let index = 0; index < starCount; index += 1) {
    const theta = random() * Math.PI * 2;
    const phi = Math.acos(2 * random() - 1);
    const starRadius = radius + (random() - 0.5) * 4;
    const offset = index * 3;
    const brightness = 0.58 + random() * random() * 0.42;

    positions[offset] = Math.sin(phi) * Math.cos(theta) * starRadius;
    positions[offset + 1] = Math.cos(phi) * starRadius;
    positions[offset + 2] = Math.sin(phi) * Math.sin(theta) * starRadius;
    colors[offset] = brightness;
    colors[offset + 1] = brightness;
    colors[offset + 2] = brightness;
    sizes[index] = random() > 0.9 ? 2.1 : 1.25 + random() * 0.45;
  }

  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute("position", new THREE.BufferAttribute(positions, 3));
  geometry.setAttribute("color", new THREE.BufferAttribute(colors, 3));
  geometry.setAttribute("size", new THREE.BufferAttribute(sizes, 1));

  const material = new THREE.ShaderMaterial({
    uniforms: {
      pixelRatio: { value: Math.min(window.devicePixelRatio, 2) },
    },
    vertexShader: `
      uniform float pixelRatio;
      attribute float size;
      attribute vec3 color;
      varying vec3 vColor;

      void main() {
        vColor = color;
        vec4 mvPosition = modelViewMatrix * vec4(position, 1.0);
        gl_Position = projectionMatrix * mvPosition;
        gl_PointSize = size * pixelRatio;
      }
    `,
    fragmentShader: `
      varying vec3 vColor;

      void main() {
        vec2 point = gl_PointCoord - vec2(0.5);
        float distanceFromCenter = length(point);
        if (distanceFromCenter > 0.5) {
          discard;
        }
        float alpha = smoothstep(0.5, 0.16, distanceFromCenter);
        gl_FragColor = vec4(vColor, alpha);
      }
    `,
    transparent: true,
    depthWrite: false,
    depthTest: false,
    blending: THREE.AdditiveBlending,
  });

  const pixelStars = new THREE.Points(geometry, material);
  pixelStars.frustumCulled = false;
  pixelStars.renderOrder = -9;
  pixelStars.userData.isSkyPixels = true;
  graphRoot.add(pixelStars);
}

function createSkyGradientMaterial(
  random,
  activeSkyColors = getActiveSkyGradientColors(),
  skyAnchors = createSkyAnchorUniforms(random),
) {
  const material = new THREE.ShaderMaterial({
    uniforms: {
      skyColors: { value: createSkyColorUniforms(activeSkyColors) },
      skyColorCount: { value: activeSkyColors.length },
      skyAnchors: { value: skyAnchors },
    },
    vertexShader: `
      varying vec3 vDirection;

      void main() {
        vDirection = normalize(position);
        gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
      }
    `,
    fragmentShader: `
      uniform vec3 skyColors[4];
      uniform int skyColorCount;
      uniform vec3 skyAnchors[8];
      varying vec3 vDirection;

      void main() {
        vec3 direction = normalize(vDirection);
        vec3 color = vec3(0.0015);
        float totalWeight = 0.0001;

        for (int i = 0; i < 4; i += 1) {
          if (i >= skyColorCount) {
            break;
          }

          vec3 anchorA = normalize(skyAnchors[i * 2]);
          vec3 anchorB = normalize(skyAnchors[i * 2 + 1]);
          float lobeA = pow(max(dot(direction, anchorA) * 0.5 + 0.5, 0.0), 3.1);
          float lobeB = pow(max(dot(direction, anchorB) * 0.5 + 0.5, 0.0), 4.7) * 0.72;
          float weight = 0.12 + lobeA + lobeB;
          color += skyColors[i] * weight;
          totalWeight += weight;
        }

        color /= totalWeight;
        float wave = sin(dot(direction, skyAnchors[6]) * 5.2 + dot(direction, skyAnchors[7]) * 2.1);
        color *= 0.94 + wave * 0.035;

        gl_FragColor = vec4(color, 1.0);
      }
    `,
    side: THREE.BackSide,
    depthWrite: false,
    depthTest: false,
    fog: false,
  });
  material.toneMapped = false;
  return material;
}

function getActiveSkyGradientColors() {
  const colors = skyGradientColors.filter(Boolean);
  return colors.length > 0 ? colors : ["#050914"];
}

function createSkyColorUniforms(activeSkyColors = getActiveSkyGradientColors()) {
  const colors = activeSkyColors;
  return Array.from({ length: 4 }, (_, index) => {
    const color = new THREE.Color(colors[Math.min(index, colors.length - 1)]);
    return new THREE.Vector3(color.r, color.g, color.b);
  });
}

function createSkyAnchorUniforms(random) {
  return Array.from({ length: 8 }, () => {
    const theta = random() * Math.PI * 2;
    const z = random() * 2 - 1;
    const radius = Math.sqrt(Math.max(0, 1 - z * z));
    return new THREE.Vector3(Math.cos(theta) * radius, z, Math.sin(theta) * radius);
  });
}

function createMenuSkyAnchorUniforms() {
  return [
    new THREE.Vector3(-0.82, 0.62, -1),
    new THREE.Vector3(-0.58, 0.88, -1),
    new THREE.Vector3(-0.05, 0.05, -1),
    new THREE.Vector3(0.18, -0.16, -1),
    new THREE.Vector3(0.82, -0.62, -1),
    new THREE.Vector3(0.58, -0.88, -1),
    new THREE.Vector3(0.72, 0.48, -1),
    new THREE.Vector3(-0.72, -0.48, -1),
  ].map((anchor) => anchor.normalize());
}

function updateSkyTexture() {
  if (!skyMesh) {
    return;
  }

  skyMesh.material.dispose();
  skyMesh.material = createSkyGradientMaterial(createRandom(`${SEED}:sky:${skyRandomVersion}`));
}

function buildLocalSpaceStars(random) {
  const starCount = 520;
  const minRadius = 7.2;
  const maxRadius = 18;
  const positions = new Float32Array(starCount * 3);
  const brightnesses = new Float32Array(starCount);
  const sizes = new Float32Array(starCount);

  for (let index = 0; index < starCount; index += 1) {
    const theta = random() * Math.PI * 2;
    const phi = Math.acos(2 * random() - 1);
    const radius = minRadius + random() * (maxRadius - minRadius);
    const offset = index * 3;

    positions[offset] = Math.sin(phi) * Math.cos(theta) * radius;
    positions[offset + 1] = Math.cos(phi) * radius;
    positions[offset + 2] = Math.sin(phi) * Math.sin(theta) * radius;
    brightnesses[index] = 0.38 + random() * random() * 0.48;
    sizes[index] = 1 + Math.pow(random(), 2.4) * 2;
  }

  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute("position", new THREE.BufferAttribute(positions, 3));
  geometry.setAttribute("brightness", new THREE.BufferAttribute(brightnesses, 1));
  geometry.setAttribute("size", new THREE.BufferAttribute(sizes, 1));

  const material = new THREE.ShaderMaterial({
    uniforms: {
      pixelRatio: { value: Math.min(window.devicePixelRatio, 2) },
    },
    vertexShader: `
      uniform float pixelRatio;
      attribute float brightness;
      attribute float size;
      varying float vBrightness;

      void main() {
        vBrightness = brightness;
        vec4 mvPosition = modelViewMatrix * vec4(position, 1.0);
        gl_Position = projectionMatrix * mvPosition;
        gl_PointSize = size * pixelRatio;
      }
    `,
    fragmentShader: `
      varying float vBrightness;

      void main() {
        gl_FragColor = vec4(vec3(vBrightness), 0.72);
      }
    `,
    transparent: true,
    depthWrite: false,
    depthTest: false,
    blending: THREE.AdditiveBlending,
  });

  const localStars = new THREE.Points(geometry, material);
  localStars.frustumCulled = false;
  localStars.renderOrder = -8;
  localStars.userData.isSkyPixels = true;
  graphRoot.add(localStars);
}

function createNodeGlow(node) {
  const glow = new THREE.Sprite(
    new THREE.SpriteMaterial({
      map: glowTexture,
      color: node.glowColor,
      transparent: true,
      opacity: node.blackCore ? 0.82 : Math.min(1, node.glowBoost),
      depthWrite: false,
      depthTest: false,
      blending: THREE.AdditiveBlending,
    }),
  );
  glow.position.copy(node.position);
  glow.scale.setScalar(node.size * 44 * node.glowScaleBoost);
  glow.userData.baseScale = node.size * 44 * node.glowScaleBoost;
  return glow;
}

function createNodeGlowTexture() {
  const size = 256;
  const canvas = document.createElement("canvas");
  canvas.width = size;
  canvas.height = size;
  const context = canvas.getContext("2d");
  const image = context.createImageData(size, size);
  const center = size / 2;

  for (let y = 0; y < size; y += 1) {
    for (let x = 0; x < size; x += 1) {
      const dx = (x + 0.5 - center) / center;
      const dy = (y + 0.5 - center) / center;
      const distance = Math.sqrt(dx * dx + dy * dy);
      const coreEdge = 0.075;
      const index = (y * size + x) * 4;

      if (distance > 1) {
        image.data[index + 3] = 0;
        continue;
      }

      const core = smoothstep(coreEdge + 0.008, coreEdge - 0.008, distance) * 0.72;
      const rim = Math.exp(-Math.abs(distance - coreEdge) * 54) * 0.54;
      const falloff =
        Math.max(0, Math.log(1 + (1 - distance) * 7) / Math.log(8)) *
        Math.exp(-distance * 3.6) *
        0.28;
      const alpha = Math.min(1, core + rim + falloff);

      image.data[index] = 255;
      image.data[index + 1] = 255;
      image.data[index + 2] = 255;
      image.data[index + 3] = Math.round(alpha * 255);
    }
  }

  context.putImageData(image, 0, 0);
  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  return texture;
}

function createLinkPulseTexture() {
  const size = 96;
  const canvas = document.createElement("canvas");
  canvas.width = size;
  canvas.height = size;
  const context = canvas.getContext("2d");
  const gradient = context.createRadialGradient(48, 48, 0, 48, 48, 48);
  gradient.addColorStop(0, "rgba(255,255,255,1)");
  gradient.addColorStop(0.18, "rgba(255,255,255,0.72)");
  gradient.addColorStop(1, "rgba(255,255,255,0)");
  context.fillStyle = gradient;
  context.fillRect(0, 0, size, size);

  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  return texture;
}

function createLinkPulse(random) {
  const sprite = new THREE.Sprite(
    new THREE.SpriteMaterial({
      map: linkPulseTexture,
      color: 0xffffff,
      transparent: true,
      opacity: 0,
      depthWrite: false,
      depthTest: false,
      blending: THREE.AdditiveBlending,
    }),
  );
  sprite.scale.setScalar(0.14);
  sprite.renderOrder = 6;

  return {
    sprite,
    random,
    edge: null,
    elapsed: 0,
    duration: 0.85,
    wait: 0.2 + random() * 0.8,
  };
}

function getPopulatedSystemIds(gameState = currentGameState) {
  const populatedSystemIds = new Set();
  if (!gameState?.objectDetails) {
    return populatedSystemIds;
  }

  for (const [detailKey, detailState] of Object.entries(gameState.objectDetails)) {
    const buildings = normalizeObjectDetailBuildings(detailState?.buildings, detailState?.towns, detailState?.cityStage);
    if (buildings.size === 0) {
      continue;
    }
    const systemId = getObjectDetailStateKeySystemId(detailKey);
    if (systemId) {
      populatedSystemIds.add(systemId);
    }
  }

  return populatedSystemIds;
}

function getLinkPulseEligibleLinks() {
  const populatedSystemIds = getPopulatedSystemIds();
  if (populatedSystemIds.size < 2) {
    return [];
  }

  return links.filter((link) => {
    const fromId = normalizeRuntimeNullableString(nodes[link.a]?.id ?? link.a);
    const toId = normalizeRuntimeNullableString(nodes[link.b]?.id ?? link.b);
    return populatedSystemIds.has(fromId) && populatedSystemIds.has(toId);
  });
}

function updateLinkPulse(deltaSeconds) {
  if (links.length === 0) {
    return;
  }

  if (!linkPulse.edge) {
    linkPulse.wait -= deltaSeconds;
    linkPulse.sprite.material.opacity = 0;

    if (linkPulse.wait <= 0) {
      const eligibleLinks = getLinkPulseEligibleLinks();
      if (eligibleLinks.length === 0) {
        linkPulse.wait = 0.9 + linkPulse.random() * 1.4;
        return;
      }
      linkPulse.edge = eligibleLinks[Math.floor(linkPulse.random() * eligibleLinks.length)];
      linkPulse.elapsed = 0;
      linkPulse.duration = 0.55 + linkPulse.random() * 0.7;
    }
    return;
  }

  linkPulse.elapsed += deltaSeconds;
  const progress = Math.min(1, linkPulse.elapsed / linkPulse.duration);
  const start = nodes[linkPulse.edge.a].position;
  const end = nodes[linkPulse.edge.b].position;
  linkPulse.sprite.position.copy(start).lerp(end, progress);
  linkPulse.sprite.material.opacity = Math.sin(progress * Math.PI) * 0.92;

  if (progress >= 1) {
    linkPulse.edge = null;
    linkPulse.wait = 0.2 + linkPulse.random() * 0.8;
    linkPulse.sprite.material.opacity = 0;
  }
}

function createBlackHoleDiskTexture() {
  const size = 96;
  const canvas = document.createElement("canvas");
  canvas.width = size;
  canvas.height = size;
  const context = canvas.getContext("2d");
  context.clearRect(0, 0, size, size);
  context.beginPath();
  context.arc(size / 2, size / 2, size * 0.44, 0, Math.PI * 2);
  context.fillStyle = "rgba(0,0,0,1)";
  context.fill();

  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  return texture;
}

function createSelectionOverlay() {
  const pointUniforms = Array.from(
    { length: MAX_SELECTION_POINTS },
    () => new THREE.Vector2(-10000, -10000),
  );
  const pointRadiusUniforms = Array.from({ length: MAX_SELECTION_POINTS }, () => 0);
  const segmentStartUniforms = Array.from(
    { length: MAX_SELECTION_SEGMENTS },
    () => new THREE.Vector2(-10000, -10000),
  );
  const segmentEndUniforms = Array.from(
    { length: MAX_SELECTION_SEGMENTS },
    () => new THREE.Vector2(-10000, -10000),
  );
  const fadingSegmentStartUniforms = Array.from(
    { length: MAX_SELECTION_FADING_SEGMENTS },
    () => new THREE.Vector2(-10000, -10000),
  );
  const fadingSegmentEndUniforms = Array.from(
    { length: MAX_SELECTION_FADING_SEGMENTS },
    () => new THREE.Vector2(-10000, -10000),
  );
  const fadingSegmentProgressUniforms = Array.from(
    { length: MAX_SELECTION_FADING_SEGMENTS },
    () => 0,
  );

  const overlayScene = new THREE.Scene();
  const overlayCamera = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1);
  const material = new THREE.ShaderMaterial({
    uniforms: {
      resolution: { value: new THREE.Vector2(1, 1) },
      points: { value: pointUniforms },
      pointRadii: { value: pointRadiusUniforms },
      segmentStarts: { value: segmentStartUniforms },
      segmentEnds: { value: segmentEndUniforms },
      fadingSegmentStarts: { value: fadingSegmentStartUniforms },
      fadingSegmentEnds: { value: fadingSegmentEndUniforms },
      fadingSegmentProgresses: { value: fadingSegmentProgressUniforms },
      pointCount: { value: 0 },
      segmentCount: { value: 0 },
      fadingSegmentCount: { value: 0 },
      nodeRadius: { value: 31 },
      tubeRadius: { value: 16 },
      strokeWidth: { value: 1 },
      glowWidth: { value: 5 },
      opacity: { value: 0.36 },
      color: { value: new THREE.Color(0x00e1ff) },
      strokeColor: { value: new THREE.Color(0x80f0ff) },
      strokeStrength: { value: 1 },
      glowStrength: { value: 1 },
    },
    vertexShader: `
      varying vec2 vUv;

      void main() {
        vUv = uv;
        gl_Position = vec4(position.xy, 0.0, 1.0);
      }
    `,
    fragmentShader: `
      #define MAX_POINTS ${MAX_SELECTION_POINTS}
      #define MAX_SEGMENTS ${MAX_SELECTION_SEGMENTS}
      #define MAX_FADING_SEGMENTS ${MAX_SELECTION_FADING_SEGMENTS}

      uniform vec2 resolution;
      uniform vec2 points[MAX_POINTS];
      uniform float pointRadii[MAX_POINTS];
      uniform vec2 segmentStarts[MAX_SEGMENTS];
      uniform vec2 segmentEnds[MAX_SEGMENTS];
      uniform vec2 fadingSegmentStarts[MAX_FADING_SEGMENTS];
      uniform vec2 fadingSegmentEnds[MAX_FADING_SEGMENTS];
      uniform float fadingSegmentProgresses[MAX_FADING_SEGMENTS];
      uniform int pointCount;
      uniform int segmentCount;
      uniform int fadingSegmentCount;
      uniform float nodeRadius;
      uniform float tubeRadius;
      uniform float strokeWidth;
      uniform float glowWidth;
      uniform float opacity;
      uniform vec3 color;
      uniform vec3 strokeColor;
      uniform float strokeStrength;
      uniform float glowStrength;

      float circleSdf(vec2 pixel, vec2 center, float radius) {
        return length(pixel - center) - radius;
      }

      float capsuleSdf(vec2 pixel, vec2 start, vec2 end, float radius) {
        vec2 segment = end - start;
        float segmentLength = dot(segment, segment);
        if (segmentLength < 0.001) {
          return circleSdf(pixel, start, radius);
        }
        float t = clamp(dot(pixel - start, segment) / segmentLength, 0.0, 1.0);
        vec2 closest = start + segment * t;
        return length(pixel - closest) - radius;
      }

      vec2 capsuleDistanceAndT(vec2 pixel, vec2 start, vec2 end, float radius) {
        vec2 segment = end - start;
        float segmentLength = dot(segment, segment);
        if (segmentLength < 0.001) {
          return vec2(circleSdf(pixel, start, radius), 0.0);
        }
        float t = clamp(dot(pixel - start, segment) / segmentLength, 0.0, 1.0);
        vec2 closest = start + segment * t;
        return vec2(length(pixel - closest) - radius, t);
      }

      void main() {
        vec2 pixel = gl_FragCoord.xy;
        float distanceToSelection = 100000.0;
        float fadingFill = 0.0;
        float fadingStroke = 0.0;
        float fadingGlow = 0.0;

        for (int index = 0; index < MAX_POINTS; index += 1) {
          if (index >= pointCount) {
            break;
          }
          distanceToSelection = min(
            distanceToSelection,
            circleSdf(pixel, points[index], pointRadii[index])
          );
        }

        for (int index = 0; index < MAX_SEGMENTS; index += 1) {
          if (index >= segmentCount) {
            break;
          }
          distanceToSelection = min(
            distanceToSelection,
            capsuleSdf(pixel, segmentStarts[index], segmentEnds[index], tubeRadius)
          );
        }

        for (int index = 0; index < MAX_FADING_SEGMENTS; index += 1) {
          if (index >= fadingSegmentCount) {
            break;
          }

          vec2 distanceAndT = capsuleDistanceAndT(
            pixel,
            fadingSegmentStarts[index],
            fadingSegmentEnds[index],
            tubeRadius
          );
          float distanceToFading = distanceAndT.x;
          float t = distanceAndT.y;
          float segmentProgress = fadingSegmentProgresses[index];
          float growMask = smoothstep(1.0 - segmentProgress - 0.08, 1.0 - segmentProgress, t);
          float fade = (1.0 - smoothstep(0.25, 1.0, t)) * growMask;

          fadingFill = max(fadingFill, step(distanceToFading, 0.0) * fade);
          fadingStroke = max(
            fadingStroke,
            step(abs(distanceToFading), strokeWidth) *
            step(0.001, abs(distanceToFading)) *
            fade
          );
          fadingGlow = max(
            fadingGlow,
            smoothstep(glowWidth, strokeWidth, distanceToFading) *
            step(strokeWidth, distanceToFading) *
            fade
          );
        }

        float fillMask = step(distanceToSelection, 0.0);
        float strokeMask =
          step(abs(distanceToSelection), strokeWidth) *
          step(0.001, abs(distanceToSelection));
        float glowMask =
          smoothstep(glowWidth, strokeWidth, distanceToSelection) *
          step(strokeWidth, distanceToSelection);
        float combinedFill = max(fillMask, fadingFill);
        float baseBoundaryVisible = 1.0 - smoothstep(0.001, 0.88, fadingFill);
        float fadingBoundaryVisible = 1.0 - fillMask;
        float combinedStroke = max(
          strokeMask * baseBoundaryVisible,
          fadingStroke * fadingBoundaryVisible
        ) * strokeStrength;
        float combinedGlow = max(
          glowMask * baseBoundaryVisible,
          fadingGlow * fadingBoundaryVisible
        ) * glowStrength;
        float glowAlpha = combinedGlow * 0.42;
        float alpha = max(max(combinedFill * opacity, glowAlpha), combinedStroke);

        if (alpha <= 0.001) {
          discard;
        }

        vec3 finalColor = mix(color, strokeColor, max(combinedStroke, combinedGlow * 0.58));
        gl_FragColor = vec4(finalColor, alpha);
      }
    `,
    transparent: true,
    depthTest: false,
    depthWrite: false,
  });

  const quad = new THREE.Mesh(new THREE.PlaneGeometry(2, 2), material);
  overlayScene.add(quad);

  return {
    scene: overlayScene,
    camera: overlayCamera,
    material,
    points: pointUniforms,
    pointRadii: pointRadiusUniforms,
    segmentStarts: segmentStartUniforms,
    segmentEnds: segmentEndUniforms,
    fadingSegmentStarts: fadingSegmentStartUniforms,
    fadingSegmentEnds: fadingSegmentEndUniforms,
    fadingSegmentProgresses: fadingSegmentProgressUniforms,
  };
}

function createSystemGlowLayer() {
  const glowRenderer = new THREE.WebGLRenderer({
    canvas: systemGlow,
    alpha: true,
    antialias: false,
    powerPreference: "high-performance",
  });
  glowRenderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
  glowRenderer.setClearColor(0x000000, 0);
  glowRenderer.outputColorSpace = THREE.SRGBColorSpace;

  const glowScene = new THREE.Scene();
  const glowCamera = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1);
  const glowMaterial = new THREE.ShaderMaterial({
    uniforms: {
      resolution: { value: new THREE.Vector2(1, 1) },
      starCenter: { value: new THREE.Vector2(0, 0) },
      starRadius: { value: 1 },
      glowColor: { value: new THREE.Color(1, 1, 1) },
      intensity: { value: 1 },
    },
    vertexShader: `
      varying vec2 vUv;

      void main() {
        vUv = uv;
        gl_Position = vec4(position.xy, 0.0, 1.0);
      }
    `,
    fragmentShader: `
      uniform vec2 resolution;
      uniform vec2 starCenter;
      uniform float starRadius;
      uniform vec3 glowColor;
      uniform float intensity;
      varying vec2 vUv;

      void main() {
        vec2 pixel = vec2(vUv.x * resolution.x, (1.0 - vUv.y) * resolution.y);
        float distanceToCenter = length(pixel - starCenter);
        float signedDistance = distanceToCenter - starRadius;
        float edgeDistance = abs(signedDistance);
        float edgeCore = exp(-edgeDistance * 0.034) * 0.34;
        float outerFalloff = log(1.0 + max(signedDistance, 0.0) * 0.018) / log(4.2);
        outerFalloff = (1.0 - clamp(outerFalloff, 0.0, 1.0)) * exp(-max(signedDistance, 0.0) * 0.0026) * 0.34;
        float innerFalloff = exp(-max(-signedDistance, 0.0) * 0.008) * 0.12;
        float edgeRim = exp(-edgeDistance * 0.105) * 0.28;
        float fadeLimit = resolution.x * 0.75;
        float linearDistanceFade = clamp(1.0 - max(signedDistance, 0.0) / max(fadeLimit, 1.0), 0.0, 1.0);
        float alpha = clamp((edgeCore + edgeRim + outerFalloff + innerFalloff) * intensity * linearDistanceFade, 0.0, 0.78);

        if (alpha <= 0.001) {
          discard;
        }

        gl_FragColor = vec4(glowColor * (0.62 + intensity * 0.24), alpha);
      }
    `,
    transparent: true,
    depthWrite: false,
    depthTest: false,
    blending: THREE.AdditiveBlending,
  });
  glowMaterial.toneMapped = false;
  const glowGeometry = new THREE.PlaneGeometry(2, 2);
  const glowQuad = new THREE.Mesh(glowGeometry, glowMaterial);
  glowScene.add(glowQuad);

  return {
    renderer: glowRenderer,
    material: glowMaterial,
    scene: glowScene,
    camera: glowCamera,
    resize(width, height) {
      const pixelRatio = Math.min(window.devicePixelRatio, 2);
      glowRenderer.setPixelRatio(pixelRatio);
      glowRenderer.setSize(width, height, false);
      glowMaterial.uniforms.resolution.value.set(width * pixelRatio, height * pixelRatio);
    },
    render({ centerX, centerY, radius, color, intensity }) {
      const pixelRatio = Math.min(window.devicePixelRatio, 2);
      glowMaterial.uniforms.starCenter.value.set(centerX * pixelRatio, centerY * pixelRatio);
      glowMaterial.uniforms.starRadius.value = radius * pixelRatio;
      glowMaterial.uniforms.glowColor.value.set(color);
      glowMaterial.uniforms.intensity.value = intensity;
      glowRenderer.render(glowScene, glowCamera);
    },
    dispose() {
      glowGeometry.dispose();
      glowMaterial.dispose();
      glowScene.remove(glowQuad);
      glowRenderer.dispose();
      glowRenderer.forceContextLoss();
    },
  };
}

function onPointerDown(event) {
  if (
    isAppExited ||
    isStartMenuOpen ||
    !isGameRuntimeReady ||
    event.button !== 0 ||
    systemScreenController.isOpen() ||
    systemScreenController.isGraphEntering() ||
    isStarmapFleetMovementLocked()
  ) {
    return;
  }

  isDragging = true;
  activeGraphPointerId = event.pointerId;
  lastPointer.set(event.clientX, event.clientY);
  pointerDownPosition.set(event.clientX, event.clientY);
  sceneCanvas.classList.add("dragging");
  sceneCanvas.setPointerCapture(event.pointerId);
}

function onPointerUp(event) {
  if (activeGraphPointerId !== event.pointerId) {
    return;
  }

  if (event.type === "pointercancel") {
    cancelGraphDrag(event);
    return;
  }

  const clickDistance = Math.hypot(
    event.clientX - pointerDownPosition.x,
    event.clientY - pointerDownPosition.y,
  );
  cancelGraphDrag(event);
  if (clickDistance < 5) {
    const wasHandled = selectNodeAt(event.clientX, event.clientY);
    if (!wasHandled) {
      clearSelectedFleet();
    }
  }
}

function onSystemBlankFleetSelectionPointerDown(event) {
  if (
    event.button !== 0 ||
    !selectedFleetId ||
    isStartMenuOpen ||
    !isGameRuntimeReady ||
    isGameDialogOpen() ||
    !systemScreenController.isOpen()
  ) {
    return;
  }

  const target = event.target instanceof Element ? event.target : null;
  if (!target || isFleetSelectionPreservingTarget(target)) {
    return;
  }

  clearSelectedFleet();
}

function isFleetSelectionPreservingTarget(target) {
  return Boolean(target.closest([
    ".system-fleet-marker",
    ".starmap-fleet-marker",
    ".fleet-action-panel",
    ".system-planet-hit",
    ".system-jump",
    ".system-planet-menu",
    ".game-bottom-ui",
    ".music-player",
    "button",
    "input",
    "select",
    "textarea",
    "a",
    "[role=\"button\"]",
  ].join(",")));
}

function releaseStaleGraphCapture(event) {
  if (!isGameRuntimeReady) {
    return;
  }

  if (event.target === sceneCanvas) {
    return;
  }

  if (activeGraphPointerId !== null || isDragging) {
    cancelGraphDrag();
  }

  if (!systemScreenController.isOpen()) {
    forceCloseViewOverlays();
  }
}

function cancelGraphDrag(event) {
  const pointerId = event?.pointerId ?? activeGraphPointerId;
  isDragging = false;
  activeGraphPointerId = null;
  sceneCanvas.classList.remove("dragging");
  if (pointerId !== null && pointerId !== undefined && sceneCanvas.hasPointerCapture(pointerId)) {
    sceneCanvas.releasePointerCapture(pointerId);
  }
}

function onPointerMove(event) {
  if (isAppExited) {
    return;
  }

  if (isStartMenuOpen) {
    lastClientPointer.set(event.clientX, event.clientY);
    return;
  }

  if (!isGameRuntimeReady) {
    return;
  }

  if (isGameDialogOpen()) {
    pauseGameInteractions();
    return;
  }

  if (isDragging && event.buttons !== undefined && (event.buttons & 1) === 0) {
    cancelGraphDrag(event);
  }

  if (isDragging && isStarmapFleetMovementLocked()) {
    cancelGraphDrag(event);
    rotationVelocity.set(0, 0);
  }

  lastClientPointer.set(event.clientX, event.clientY);
  pointer.x = (event.clientX / window.innerWidth) * 2 - 1;
  pointer.y = -(event.clientY / window.innerHeight) * 2 + 1;
  updateSystemParallax(event.clientX, event.clientY);

  if (isDragging) {
    const deltaX = event.clientX - lastPointer.x;
    const deltaY = event.clientY - lastPointer.y;
    targetRotation.y += deltaX * 0.006;
    targetRotation.x += deltaY * 0.006;
    targetRotation.x = THREE.MathUtils.clamp(targetRotation.x, -1.15, 1.15);
    rotationVelocity.set(deltaY * 0.00035, deltaX * 0.00035);
    lastPointer.set(event.clientX, event.clientY);
  }

  positionTooltip(event.clientX, event.clientY);
}

function forceCloseViewOverlays() {
  if (!starWindow.classList.contains("visible") &&
      !planetScreen.classList.contains("visible") &&
      !document.body.classList.contains("system-open")) {
    return;
  }

  planetScreenController.close();
  cancelPlanetEntryTransition();
  systemScreenController.setTransitioning(false);
  starWindow.classList.remove("visible", "system-transitioning", "planet-entry-moving");
  starWindow.setAttribute("aria-hidden", "true");
  document.body.classList.remove("system-open");
  setSystemTransitionOffset(0, 0);
  setSystemTransitionOverlay(0);
}

function onWheel(event) {
  if (
    isAppExited ||
    isStartMenuOpen ||
    !isGameRuntimeReady ||
    isGameDialogOpen() ||
    systemScreenController.isOpen() ||
    isStarmapFleetMovementLocked()
  ) {
    return;
  }

  event.preventDefault();
  const zoomFactor = Math.exp(event.deltaY * 0.0012);
  targetCameraDistance = THREE.MathUtils.clamp(
    targetCameraDistance * zoomFactor,
    MIN_CAMERA_DISTANCE,
    MAX_CAMERA_DISTANCE,
  );
}

function updateHover() {
  if (isGameDialogOpen()) {
    clearGraphHover();
    return;
  }

  const nextHover = getNodeHit()?.userData.visual ?? null;

  if (hoveredNode === nextHover) {
    return;
  }

  if (hoveredNode) {
    hoveredNode.material.emissiveIntensity = hoveredNode.userData.node.blackCore
      ? 0.1
      : 5.8 * hoveredNode.userData.node.glowBoost;
    hoveredNode.scale.setScalar(hoveredNode.userData.node.size);
    hoveredNode.userData.glow.scale.setScalar(hoveredNode.userData.glow.userData.baseScale);
    hoveredNode.userData.glow.material.opacity = 0.82;
  }

  const previousHoveredNode = hoveredNode;
  const isNewHoveredStar =
    Boolean(nextHover) &&
    (!previousHoveredNode ||
      previousHoveredNode.userData.node.id !== nextHover.userData.node.id);
  const isReturningDuringExit = Boolean(nextHover && tooltipClearTimeout);
  const useFastEnter = isNewHoveredStar && (Boolean(previousHoveredNode) || isReturningDuringExit);

  hoveredNode = nextHover;
  hoverNameWrap.classList.toggle("fast-enter", useFastEnter);
  hoverPanel.classList.toggle("fast-enter", useFastEnter);
  hoverNameWrap.classList.toggle("visible", Boolean(hoveredNode));
  hoverPanel.classList.toggle("visible", Boolean(hoveredNode));
  hoverNameWrap.setAttribute("aria-hidden", hoveredNode ? "false" : "true");
  hoverPanel.setAttribute("aria-hidden", hoveredNode ? "false" : "true");

  if (hoveredNode) {
    clearTooltipContentCleanup();
    hoverName.textContent = hoveredNode.userData.node.name;
  }

  scheduleTooltipTypewriter(hoveredNode?.userData.node ?? null, useFastEnter);

  if (hoveredNode) {
    hoveredNode.material.emissiveIntensity = hoveredNode.userData.node.blackCore
      ? 0.18
      : 8.6 * hoveredNode.userData.node.glowBoost;
    hoveredNode.scale.setScalar(hoveredNode.userData.node.size);
    hoveredNode.userData.glow.scale.setScalar(hoveredNode.userData.glow.userData.baseScale);
    hoveredNode.userData.glow.material.opacity = 0.96;
  }
}

function clearGraphHover() {
  if (!hoveredNode) {
    return;
  }

  hoveredNode.material.emissiveIntensity = hoveredNode.userData.node.blackCore
    ? 0.1
    : 5.8 * hoveredNode.userData.node.glowBoost;
  hoveredNode.scale.setScalar(hoveredNode.userData.node.size);
  hoveredNode.userData.glow.scale.setScalar(hoveredNode.userData.glow.userData.baseScale);
  hoveredNode.userData.glow.material.opacity = 0.82;
  hoveredNode = null;
  hoverNameWrap.classList.remove("visible", "fast-enter");
  hoverPanel.classList.remove("visible", "fast-enter");
  hoverNameWrap.setAttribute("aria-hidden", "true");
  hoverPanel.setAttribute("aria-hidden", "true");
  scheduleTooltipTypewriter(null);
}

function scheduleTooltipTypewriter(node, immediate = false) {
  tooltipTypingToken += 1;
  const token = tooltipTypingToken;
  clearTooltipTyping();
  hoverPanel.classList.remove("typing", "typed");

  if (!node) {
    scheduleTooltipContentCleanup();
    return;
  }

  tooltipType.textContent = "";
  tooltipPlanets.textContent = "";
  const typeText = node.starType.toUpperCase();
  const planetsText = node.planets > 0 ? `${node.planets} PLANETS` : "";
  hoverPanel.classList.toggle("has-planets", Boolean(planetsText));
  const typewriterDelay = immediate ? 340 : 1580;
  tooltipTypingTimeout = window.setTimeout(() => {
    if (token !== tooltipTypingToken) {
      return;
    }

    hoverPanel.classList.add("typing");
    const fullText = planetsText ? `${typeText}\n${planetsText}` : typeText;
    let index = 0;

    tooltipTypingInterval = window.setInterval(() => {
      if (token !== tooltipTypingToken) {
        clearTooltipTyping();
        return;
      }

      index += 1;
      const typed = fullText.slice(0, index);
      const [typeLine = "", typedPlanetsLine] = typed.split("\n");
      const planetsLine = typedPlanetsLine ?? (planetsText ? "\u00a0" : "");
      tooltipType.textContent = typeLine;
      tooltipPlanets.textContent = planetsLine;

      if (index >= fullText.length) {
        clearTooltipTyping();
        hoverPanel.classList.remove("typing");
        hoverPanel.classList.add("typed");
      }
    }, 28);
  }, typewriterDelay);
}

function scheduleTooltipContentCleanup() {
  clearTooltipContentCleanup();
  tooltipClearTimeout = window.setTimeout(() => {
    hoverName.textContent = "";
    tooltipType.textContent = "";
    tooltipPlanets.textContent = "";
    hoverPanel.classList.remove("has-planets");
    tooltipClearTimeout = null;
  }, 560);
}

function clearTooltipContentCleanup() {
  if (tooltipClearTimeout) {
    window.clearTimeout(tooltipClearTimeout);
    tooltipClearTimeout = null;
  }
}

function clearTooltipTyping() {
  if (tooltipTypingTimeout) {
    window.clearTimeout(tooltipTypingTimeout);
    tooltipTypingTimeout = null;
  }
  if (tooltipTypingInterval) {
    window.clearInterval(tooltipTypingInterval);
    tooltipTypingInterval = null;
  }
}

function setSystemHover(body) {
  if (isGameDialogOpen()) {
    body = null;
  }

  if (isPlanetWindowOpen) {
    body = null;
  }

  if (hoveredSystemBody === body) {
    return;
  }

  if (hoveredSystemBody?.userData?.label) {
    hoveredSystemBody.userData.label.classList.remove("hidden");
  }

  const previousHoveredBody = hoveredSystemBody;
  const isNewHoveredBody =
    Boolean(body) &&
    (!previousHoveredBody ||
      previousHoveredBody.dataset.name !== body.dataset.name);
  const isReturningDuringExit = Boolean(body && systemTooltipClearTimeout);
  const useFastEnter = isNewHoveredBody && (Boolean(previousHoveredBody) || isReturningDuringExit);

  hoveredSystemBody = body;
  systemHoverNameWrap.classList.toggle("fast-enter", useFastEnter);
  systemHoverPanel.classList.toggle("fast-enter", useFastEnter);
  systemHoverNameWrap.classList.toggle("visible", Boolean(hoveredSystemBody));
  systemHoverPanel.classList.toggle("visible", Boolean(hoveredSystemBody));
  systemHoverNameWrap.setAttribute("aria-hidden", hoveredSystemBody ? "false" : "true");
  systemHoverPanel.setAttribute("aria-hidden", hoveredSystemBody ? "false" : "true");
  applySystemHoverOwnershipColor(hoveredSystemBody);

  if (hoveredSystemBody) {
    clearSystemTooltipContentCleanup();
    systemHoverName.textContent = hoveredSystemBody.dataset.name;
    hoveredSystemBody.userData?.label?.classList.add("hidden");
  }

  scheduleSystemTooltipTypewriter(hoveredSystemBody, useFastEnter);
}

function applySystemHoverOwnershipColor(body = hoveredSystemBody) {
  const ownershipColor = body?.dataset?.ownershipColor ?? "";
  if (ownershipColor) {
    systemHoverNameWrap.style.setProperty("--system-hover-owner-color", ownershipColor);
    systemHoverPanel.style.setProperty("--system-hover-owner-color", ownershipColor);
    return;
  }

  systemHoverNameWrap.style.removeProperty("--system-hover-owner-color");
  systemHoverPanel.style.removeProperty("--system-hover-owner-color");
}

function scheduleSystemTooltipTypewriter(body, immediate = false) {
  systemTooltipTypingToken += 1;
  const token = systemTooltipTypingToken;
  clearSystemTooltipTyping();
  systemHoverPanel.classList.remove("typing", "typed");

  if (!body) {
    scheduleSystemTooltipContentCleanup();
    return;
  }

  systemTooltipBody.replaceChildren();
  const lines = [body.dataset.kind];

  if (body.dataset.planets !== undefined) {
    const planets = Number(body.dataset.planets);
    if (planets > 0) {
      lines.push(`${planets} ${planets === 1 ? "PLANET" : "PLANETS"}`);
    }
  } else {
    const tags = body.dataset.tags
      ? body.dataset.tags.split("|").filter(Boolean)
      : [];
    lines.push(...tags);

    if (body.dataset.gravity) {
      lines.push(`g: ${body.dataset.gravity}`);
    }

    if (body.dataset.temperature) {
      lines.push(`t: ${body.dataset.temperature}\u00b0C`);
    }

    if (body.dataset.dayCycle) {
      lines.push(`D: ${body.dataset.dayCycle}h`);
    }
  }

  const typewriterDelay = immediate ? 340 : 1580;
  systemTooltipTypingTimeout = window.setTimeout(() => {
    if (token !== systemTooltipTypingToken) {
      return;
    }

    systemHoverPanel.classList.add("typing");
    const fullText = lines.join("\n");
    let index = 0;

    systemTooltipTypingInterval = window.setInterval(() => {
      if (token !== systemTooltipTypingToken) {
        clearSystemTooltipTyping();
        return;
      }

      index += 1;
      const typedLines = fullText.slice(0, index).split("\n");
      systemTooltipBody.replaceChildren(...typedLines.map((line, lineIndex) => {
        const element = document.createElement("div");
        element.className = lineIndex === 0 ? "tooltip__line tooltip__line--primary" : "tooltip__line";
        element.textContent = line || "\u00a0";
        return element;
      }));

      if (index >= fullText.length) {
        clearSystemTooltipTyping();
        systemHoverPanel.classList.remove("typing");
        systemHoverPanel.classList.add("typed");
      }
    }, 28);
  }, typewriterDelay);
}

function clearSystemHover() {
  if (hoveredSystemBody?.userData?.label) {
    hoveredSystemBody.userData.label.classList.remove("hidden");
  }
  hoveredSystemBody = null;
  systemHoverNameWrap.classList.remove("visible", "fast-enter");
  systemHoverPanel.classList.remove("visible", "fast-enter", "typing", "typed");
  systemHoverNameWrap.setAttribute("aria-hidden", "true");
  systemHoverPanel.setAttribute("aria-hidden", "true");
  scheduleSystemTooltipContentCleanup();
}

function scheduleSystemTooltipContentCleanup() {
  clearSystemTooltipContentCleanup();
  systemTooltipClearTimeout = window.setTimeout(() => {
    systemHoverName.textContent = "";
    systemTooltipBody.replaceChildren();
    systemTooltipClearTimeout = null;
  }, 560);
}

function clearSystemTooltipContentCleanup() {
  if (systemTooltipClearTimeout) {
    window.clearTimeout(systemTooltipClearTimeout);
    systemTooltipClearTimeout = null;
  }
}

function clearSystemTooltipTyping() {
  if (systemTooltipTypingTimeout) {
    window.clearTimeout(systemTooltipTypingTimeout);
    systemTooltipTypingTimeout = null;
  }
  if (systemTooltipTypingInterval) {
    window.clearInterval(systemTooltipTypingInterval);
    systemTooltipTypingInterval = null;
  }
}

function selectNodeAt(clientX, clientY) {
  if (systemScreenController.isGraphEntering()) {
    return true;
  }

  pointer.x = (clientX / window.innerWidth) * 2 - 1;
  pointer.y = -(clientY / window.innerHeight) * 2 + 1;

  const hit = getNodeHit() ?? getScreenNodeHit(clientX, clientY);
  if (!hit) {
    return false;
  }

  if (!isMaskToolEnabled && commandSelectedFleetToStarmapSystem(hit.userData.node.id)) {
    return true;
  }

  if (!isMaskToolEnabled) {
    if (!isSystemAccessibleForActiveSide(hit.userData.node)) {
      return true;
    }
    startGraphToSystemTransition(hit.userData.node, clientX, clientY);
    return true;
  }

  const nodeId = hit.userData.node.id;
  const nodeColor = nodeColors.get(nodeId);

  if (nodeColor === currentMaskColor) {
    startNodeExitAnimation(nodeId, nodeColor);
    nodeColors.delete(nodeId);
    nodeAnimationProgress.delete(nodeId);
    removeEdgeAnimationsForNode(nodeId);
  } else {
    if (nodeColor) {
      startNodeExitAnimation(nodeId, nodeColor);
    } else {
      nodeExitAnimations.delete(nodeId);
    }
    nodeColors.set(nodeId, currentMaskColor);
    nodeAnimationProgress.set(nodeId, 0);
    addEdgeAnimationsForNode(nodeId, currentMaskColor);
  }

  updateUsedColorsUi();
  return true;
}

function startGraphToSystemTransition(node, clientX, clientY) {
  if (systemScreenController.isGraphEntering() || systemScreenController.isOpen()) {
    return;
  }
  if (!isSystemAccessibleForActiveSide(node)) {
    return;
  }

  systemScreenController.setGraphEntering(true);
  cancelGraphDrag();
  rotationVelocity.set(0, 0);
  hoveredNode = null;
  hoverNameWrap.classList.remove("visible", "fast-enter");
  hoverPanel.classList.remove("visible", "fast-enter", "typing", "typed", "has-planets");
  scheduleTooltipContentCleanup();

  const centerX = clientX;
  const centerY = clientY;
  const diveDuration = 860;
  const revealDuration = 920;
  const startedAt = performance.now();

  graphEntryOverlay.style.setProperty("--entry-alpha", "0");
  graphEntryOverlay.classList.add("active");
  document.body.classList.add("graph-entry-moving");
  lockSystemPointer(sceneCanvas);
  setGraphEntryMotion(0, 0, 1, 0);

  const animateEntry = (now) => {
    const elapsed = now - startedAt;

    if (elapsed < diveDuration) {
      const progress = THREE.MathUtils.clamp(elapsed / diveDuration, 0, 1);
      const speedCurve = Math.pow(progress, 2.35);
      const darkCurve = Math.pow(progress, 1.22);
      graphEntryOverlay.style.setProperty("--entry-alpha", `${darkCurve}`);
      setGraphEntryMotion(
        (window.innerWidth / 2 - centerX) * speedCurve,
        (window.innerHeight / 2 - centerY) * speedCurve,
        1 + speedCurve * 9,
        speedCurve * 5,
        centerX,
        centerY,
      );
      requestAnimationFrame(animateEntry);
      return;
    }

    graphEntryOverlay.style.setProperty("--entry-alpha", "1");
    openStarWindow(node);
    updateSystemParallax(centerX, centerY, true);
    setGraphEntryMotion(0, 0, 1, 0);
    document.body.classList.remove("graph-entry-moving");

    const targetStarX = activeSystemStar.x;
    const entryOffsetX = window.innerWidth / 2 - targetStarX;
    setSystemTransitionOffset(entryOffsetX, 0);
    updateSystemGlow(centerX, centerY, entryOffsetX, 0);
    const revealStartedAt = performance.now();
    const animateReveal = (revealNow) => {
      const progress = THREE.MathUtils.clamp((revealNow - revealStartedAt) / revealDuration, 0, 1);
      const eased = easeOutCubic(progress);
      const offsetX = entryOffsetX * (1 - eased);
      setSystemTransitionOffset(offsetX, 0);
      updateSystemGlow(centerX, centerY, offsetX, 0);
      graphEntryOverlay.style.setProperty("--entry-alpha", `${1 - eased}`);

      if (progress < 1) {
        requestAnimationFrame(animateReveal);
        return;
      }

      setSystemTransitionOffset(0, 0);
      graphEntryOverlay.classList.remove("active");
      graphEntryOverlay.style.setProperty("--entry-alpha", "0");
      systemScreenController.setGraphEntering(false);
      updateSystemParallax(centerX, centerY);
      releaseSystemPointerLock();
    };

    requestAnimationFrame(animateReveal);
  };

  requestAnimationFrame(animateEntry);
}

function setGraphEntryMotion(x, y, scale, blur, originX = window.innerWidth / 2, originY = window.innerHeight / 2) {
  document.body.style.setProperty("--graph-entry-x", `${x}px`);
  document.body.style.setProperty("--graph-entry-y", `${y}px`);
  document.body.style.setProperty("--graph-entry-scale", String(scale));
  document.body.style.setProperty("--graph-entry-blur", `${blur}px`);
  document.body.style.setProperty("--graph-entry-origin-x", `${originX}px`);
  document.body.style.setProperty("--graph-entry-origin-y", `${originY}px`);
}

function openStarWindow(node) {
  systemScreenController.open(node);
  musicPlayerController.ensureSystemPosition();
  setSystemTransitionOffset(0, 0);
  setSystemTransitionOverlay(0);
  cancelGraphDrag();
  rotationVelocity.set(0, 0);
  targetRotation.set(graphRoot.rotation.x, graphRoot.rotation.y, graphRoot.rotation.z);
  sceneCanvas.classList.remove("dragging");
  hoveredNode = null;
  hoverNameWrap.classList.remove("visible", "fast-enter");
  hoverPanel.classList.remove("visible", "fast-enter", "typing", "typed", "has-planets");
  scheduleTooltipContentCleanup();
  renderStarSystem(node);
  renderSystemStars(node);
  renderSystemParticles(node);
  updateSystemGlow(window.innerWidth / 2, window.innerHeight / 2, 0, 0);
  preloadPlanetScreenRenderer();
  updateGameNavigationUi(true);
  persistRuntimeSession("system");
}

function closeStarWindow() {
  cancelPlanetEntryTransition();
  closeSystemPlanetMenu();
  captureSystemFleetMarkerPositions();
  cancelFleetMarkerAnimations();
  resetSystemDecorTrails();
  systemScreenController.close();
  musicPlayerController.cancelDrag();
  musicPlayerController.closeDropdown();
  setSystemTransitionOffset(0, 0);
  setSystemTransitionOverlay(0);
  releaseSystemPointerLock();
  planetScreenController.close();
  closeObjectDetailScreen({ preserveTransitionOverlay: true });
  closePlanetWindow();
  activeSystemStar = null;
  activeSystemStarSurface = null;
  gasGiantTextureLayers.clear();
  planetSurfaceRotationLayers.clear();
  clearSystemHover();
  systemStars.replaceChildren();
  systemStarLayer.replaceChildren();
  systemParticles.replaceChildren();
  activeSystemFleetAnchors = [];
  pointer.set(10, 10);
  updateGameNavigationUi(true);
  persistRuntimeSession(isEditorMode ? "editor" : "starmap");
}

function disposeNebulumRuntime() {
  disposeStartMenuScene();
  isEditorMode = false;
  document.body.classList.remove("game-running", "editor-mode", "space-gradient-visible");
  if (!isGameRuntimeReady) {
    renderer.dispose();
    renderer.forceContextLoss();
    sceneCanvas.width = 1;
    sceneCanvas.height = 1;
    return;
  }

  cancelGraphDrag();
  cancelPlanetEntryTransition();
  cancelFleetMarkerAnimations();
  clearFleetLinkJumpTimers();
  closeStarWindow();
  planetScreenController.close();
  closeObjectDetailScreen({ preserveTransitionOverlay: true });
  closePlanetWindow();
  planetScreenRenderer?.dispose3D();
  planetScreenRenderer = null;
  planetScreenRendererPromise = null;
  disposeObjectDetail3D();
  musicPlayerController.stop();

  starLabels.replaceChildren();
  systemStars.replaceChildren();
  starSystem.replaceChildren();
  systemStarLayer.replaceChildren();
  systemParticles.replaceChildren();
  labelElements.length = 0;
  starmapFleetMarkerElements.clear();
  activeSystemFleetAnchors = [];
  fleetMarkerPositions.clear();
  fleetLinkJumpTimers.clear();
  pendingFleetLinkJumpIds.clear();
  selectedFleetId = null;
  nodeMeshes.length = 0;
  hitTargets.length = 0;

  disposeThreeObjectTree(scene);
  disposeThreeObjectTree(selectionOverlay.scene);
  scene.clear();
  selectionOverlay.scene.clear();
  systemGlowLayer.dispose();
  renderer.dispose();
  renderer.forceContextLoss();
  glowTexture?.dispose();
  linkPulseTexture?.dispose();
  blackHoleDiskTexture?.dispose();
  blackHoleDiskMaterial?.dispose();
  sceneCanvas.width = 1;
  sceneCanvas.height = 1;
  systemGlow.width = 1;
  systemGlow.height = 1;
  isGameRuntimeReady = false;
}

function disposeThreeObjectTree(root) {
  const geometries = new Set();
  const materials = new Set();
  const textures = new Set();

  root.traverse((object) => {
    if (object.geometry && !geometries.has(object.geometry)) {
      geometries.add(object.geometry);
      object.geometry.dispose();
    }
    disposeThreeMaterial(object.material, materials, textures);
  });
}

function disposeThreeMaterial(material, materials, textures) {
  if (!material) {
    return;
  }

  if (Array.isArray(material)) {
    for (const item of material) {
      disposeThreeMaterial(item, materials, textures);
    }
    return;
  }

  if (materials.has(material)) {
    return;
  }

  materials.add(material);
  for (const value of Object.values(material)) {
    if (value?.isTexture && !textures.has(value)) {
      textures.add(value);
      value.dispose();
    }
  }
  material.dispose();
}

function cancelPlanetEntryTransition() {
  planetEntryTransitionToken += 1;
  isPlanetEntryTransitioning = false;
  starWindow.classList.remove("planet-entry-moving");
  planetEntryOverlay.classList.remove("active", "leaving");
  planetEntryOverlay.style.setProperty("--planet-entry-alpha", "0");
  starWindow.style.setProperty("--planet-entry-scale", "1");
}

async function loadPlanetScreenRenderer() {
  if (planetScreenRenderer) {
    return planetScreenRenderer;
  }

  if (!planetScreenRendererPromise) {
    planetScreenRendererPromise = import("./screens/planetScreenRenderer.js")
      .then(({ createPlanetScreenRenderer }) => {
        planetScreenRenderer = createPlanetScreenRenderer({
          root: planetScreen,
          controller: planetScreenController,
          seed: SEED,
          createSystemStarSurface,
          drawSystemStarSurface,
          onOpenObjectDetail: openObjectDetailFromPlanetView,
        });
        return planetScreenRenderer;
      })
      .catch((error) => {
        planetScreenRendererPromise = null;
        throw error;
      });
  }

  return planetScreenRendererPromise;
}

function preloadPlanetScreenRenderer() {
  loadPlanetScreenRenderer().catch((error) => {
    console.warn("Planet screen module preload failed", error);
  });
}

function renderPlanetScreenLoadFallback(planet) {
  planetScreenController.state.activeStar = null;
  planetScreenController.state.activeStarSurface = null;
  planetScreenController.clearRendered();

  const title = document.createElement("div");
  title.className = "planet-screen__title";
  title.textContent = planet.name;
  planetScreen.append(title);
}

async function returnToStarSystemFromPlanet() {
  const activeNode = systemScreenController.state.activeNode;
  if (!activeNode) {
    closeStarWindow();
    return;
  }

  if (planetScreenController.state.activePlanet) {
    markPlanetViewVisitedForActiveSide(planetScreenController.state.activePlanet);
  }
  cancelPlanetEntryTransition();
  await runPlanetScreenZoomOutTransition({
    originX: window.innerWidth / 2,
    originY: window.innerHeight / 2,
  });
  planetScreenController.close();
  closePlanetWindow();
  systemScreenController.open(activeNode);
  musicPlayerController.ensureSystemPosition();
  setSystemTransitionOffset(0, 0);
  setSystemTransitionOverlay(0);
  renderStarSystem(activeNode);
  renderSystemStars(activeNode);
  renderSystemParticles(activeNode);
  updateSystemGlow(window.innerWidth / 2, window.innerHeight / 2, 0, 0);
  updateSystemParallax(lastClientPointer.x, lastClientPointer.y, true);
  preloadPlanetScreenRenderer();
  updateGameNavigationUi(true);
  snapPlanetScreenHidden();
  await revealObjectDetailEntryOverlay(300);
  persistRuntimeSession("system");
}

async function openObjectDetailFromPlanetView(
  detail,
  clientX = window.innerWidth / 2,
  clientY = window.innerHeight / 2,
  { keepPlanetEntryOverlayUntilZoom = false } = {},
) {
  if (!detail || !openPlanetData) {
    return;
  }
  if (!isPlanetAccessibleForActiveSide(openPlanetData)) {
    return;
  }

  objectDetailOrbitPlanet = openPlanetData;
  activeObjectDetail = detail;
  isObjectDetailOpen = true;
  objectDetailOptions.light = true;
  objectDetailOptions.clouds = true;
  objectDetailOptions.borders = true;
  starWindow.classList.add("object-detail-open");
  const detailToken = ++objectDetailToken;
  if (!keepPlanetEntryOverlayUntilZoom) {
    cancelPlanetEntryTransition();
  }
  closePlanetWindow();
  disposeObjectDetail3D();
  objectDetailTexture.replaceChildren();
  objectDetailDayMarkers = [];
  objectDetailTexture.style.backgroundImage = "none";

  const origin = getObjectDetailEntryOrigin(detail, clientX, clientY);
  planetScreen.style.setProperty("--surface-entry-origin-x", `${origin.x}px`);
  planetScreen.style.setProperty("--surface-entry-origin-y", `${origin.y}px`);
  planetScreen.style.setProperty("--surface-entry-scale", "1");
  objectDetailEntryOverlay.classList.add("active");
  objectDetailEntryOverlay.style.setProperty("--surface-entry-alpha", "0");

  await nextAnimationFrame();
  if (!isObjectDetailOpen || detailToken !== objectDetailToken) {
    return;
  }

  planetScreen.classList.add("surface-entry-moving");
  planetScreen.style.setProperty("--surface-entry-scale", "7");
  objectDetailEntryOverlay.style.setProperty("--surface-entry-alpha", "1");
  if (keepPlanetEntryOverlayUntilZoom) {
    cancelPlanetEntryTransition();
  }

  await delay(420);
  if (!isObjectDetailOpen || detailToken !== objectDetailToken) {
    return;
  }

  planetScreenController.close();

  await nextAnimationFrame();
  if (!isObjectDetailOpen || detailToken !== objectDetailToken) {
    return;
  }

  renderObjectDetailContent(detail);
  objectDetailScreen.style.removeProperty("opacity");
  objectDetailScreen.style.removeProperty("transition");
  objectDetailScreen.classList.add("visible");
  objectDetailScreen.setAttribute("aria-hidden", "false");

  await nextAnimationFrame();
  if (!isObjectDetailOpen || detailToken !== objectDetailToken) {
    return;
  }

  resetTransitionSurfaces();
  objectDetailEntryOverlay.style.setProperty("--surface-entry-alpha", "0");
  await delay(240);
  if (!isObjectDetailOpen || detailToken !== objectDetailToken) {
    return;
  }

  objectDetailEntryOverlay.classList.remove("active");
  persistRuntimeSession("detail");
  scheduleObjectDetailTextureUpgrade(detail, detailToken);
}

function getObjectDetailEntryOrigin(detail, clientX, clientY) {
  if (detail.kind === "PLANET" || detail.kind === "GAS GIANT") {
    return {
      x: window.innerWidth / 2,
      y: window.innerHeight,
    };
  }

  return {
    x: THREE.MathUtils.clamp(clientX, 0, window.innerWidth),
    y: THREE.MathUtils.clamp(clientY, 0, window.innerHeight),
  };
}

function scheduleObjectDetailTextureUpgrade(detail, detailToken) {
  if (!detail?.createTexture) {
    return;
  }

  const runUpgrade = () => {
    if (!isObjectDetailOpen || detailToken !== objectDetailToken) {
      return;
    }

    const texture = detail.createTexture();
    if (!isObjectDetailOpen || detailToken !== objectDetailToken || !texture) {
      return;
    }

    if (typeof texture === "string") {
      detail.textureUrl = texture;
    } else {
      detail.textureUrl = texture.url ?? detail.textureUrl;
      detail.textureCanvas = texture.canvas ?? detail.textureCanvas;
      detail.waterMaskCanvas = detail.kind === "PLANET"
        ? texture.specularCanvas ?? detail.waterMaskCanvas ?? null
        : null;
      detail.cloudCanvas = texture.cloudCanvas ?? detail.cloudCanvas;
      detail.textureMode = texture.textureMode ?? detail.textureMode;
      detail.bumpCanvas = detail.kind === "MOON"
        ? null
        : texture.bumpCanvas ?? detail.bumpCanvas;
      detail.emissiveCanvas = detail.kind === "MOON"
        ? texture.emissiveCanvas ?? detail.emissiveCanvas ?? null
        : texture.emissiveCanvas ?? detail.emissiveCanvas;
    }
    renderObjectDetailContent(detail);
  };

  if ("requestIdleCallback" in window) {
    window.requestIdleCallback(runUpgrade, { timeout: 900 });
    return;
  }

  window.setTimeout(runUpgrade, 360);
}

function renderObjectDetailContent(detail) {
  activeObjectDetail = detail;
  const runtimeState = captureObjectDetailRuntimeState();
  disposeObjectDetail3D();
  objectDetailTexture.replaceChildren();
  objectDetailDayMarkers = [];
  objectDetailTexture.style.backgroundImage = "none";
  if (runtimeState) {
    detail.objectDetailRuntimeState = runtimeState;
  }
  applySavedObjectDetailState(detail);

  if ((detail.kind === "PLANET" || detail.kind === "GAS GIANT" || detail.kind === "MOON") && detail.textureCanvas) {
    renderObjectDetailPlanetSurface(detail);
    renderObjectDetailFrame(detail);
    return;
  }

  objectDetailTexture.style.backgroundImage = detail.textureUrl ?? "none";
  renderObjectDetailFlatHexGrid(detail);
  renderObjectDetailFrame(detail);
}

function captureObjectDetailRuntimeState() {
  if (!objectDetail3D) {
    return null;
  }
  return {
    lightStartedAt: objectDetail3D.lightStartedAt,
    lightMix: objectDetail3D.lightMix,
    targetLightMix: objectDetail3D.targetLightMix,
    cloudMix: objectDetail3D.cloudMix,
    targetCloudMix: objectDetail3D.targetCloudMix,
    optionMixUpdatedAt: objectDetail3D.optionMixUpdatedAt,
    cursorLightIntensity: objectDetail3D.cursorLightIntensity,
    cursorEffectMix: objectDetail3D.cursorEffectMix,
    cursorLightUpdatedAt: objectDetail3D.cursorLightUpdatedAt,
  };
}

function getObjectDetailStateKey(detail) {
  if (!detail) {
    return "";
  }
  return [
    detail.systemId ?? "system",
    detail.kind ?? "object",
    detail.name ?? "unnamed",
  ].map((part) => encodeURIComponent(String(part))).join(":");
}

function getLegacyObjectDetailStateKey(detail) {
  if (!detail?.systemId) {
    return "";
  }
  return [
    "system",
    detail.kind ?? "object",
    detail.name ?? "unnamed",
  ].map((part) => encodeURIComponent(String(part))).join(":");
}

function applySavedObjectDetailState(detail) {
  const detailKey = getObjectDetailStateKey(detail);
  const legacyDetailKey = getLegacyObjectDetailStateKey(detail);
  const savedDetailState = currentGameState.objectDetails[detailKey]
    ?? currentGameState.objectDetails[legacyDetailKey];
  if (!savedDetailState) {
    return;
  }
  if (!currentGameState.objectDetails[detailKey] && legacyDetailKey) {
    currentGameState.objectDetails[detailKey] = savedDetailState;
    delete currentGameState.objectDetails[legacyDetailKey];
  }

  const currentState = detail.objectDetailHexState ?? {};
  detail.objectDetailHexState = {
    ...currentState,
    buildings: normalizeObjectDetailBuildings(savedDetailState.buildings, savedDetailState.towns, savedDetailState.cityStage),
  };
}

function syncObjectDetailBuildingsToGameState(detail) {
  const detailKey = getObjectDetailStateKey(detail);
  if (!detailKey) {
    return;
  }

  if (!currentGameState.objectDetails) {
    currentGameState.objectDetails = {};
  }
  const buildings = serializeObjectDetailBuildings(detail.objectDetailHexState?.buildings);
  if (buildings.length === 0) {
    delete currentGameState.objectDetails[detailKey];
    return;
  }

  currentGameState.objectDetails[detailKey] = { buildings };
}

function syncActiveObjectDetailToGameState() {
  if (!objectDetail3D?.hexGrid?.detail) {
    return;
  }
  syncObjectDetailBuildingsToGameState(objectDetail3D.hexGrid.detail);
}

function renderObjectDetailFrame(detail) {
  const frame = document.createElement("div");
  frame.className = "object-detail-screen__frame";
  frame.style.color = detail.starGlowColor ?? "rgba(255, 255, 255, 0.92)";

  const topLine = document.createElement("div");
  topLine.className = "object-detail-screen__line object-detail-screen__line--top";
  const markerLayer = document.createElement("div");
  markerLayer.className = "object-detail-screen__marker-layer";
  for (let index = 0; index < 2; index += 1) {
    const marker = document.createElement("div");
    marker.className = `object-detail-screen__day-marker${detail.starBlackCore ? " black-hole" : ""}`;
    marker.innerHTML = `
      <span class="object-detail-screen__day-marker-mask"></span>
      <span class="object-detail-screen__day-marker-glow"></span>
      <svg class="object-detail-screen__day-marker-triangle" viewBox="0 0 9 7" aria-hidden="true">
        <path d="M1 1 L4.5 6 L8 1 Z" />
      </svg>
    `;
    markerLayer.append(marker);
    objectDetailDayMarkers.push(marker);
  }

  const bottomLine = document.createElement("div");
  bottomLine.className = "object-detail-screen__line object-detail-screen__line--bottom";
  const title = document.createElement("div");
  title.className = "object-detail-screen__body-title";
  title.textContent = detail.name ?? "";
  const info = createObjectDetailInfo(detail);
  const controls = createObjectDetailOptionControls();

  frame.append(topLine, markerLayer, bottomLine, title, info, controls);
  objectDetailTexture.append(frame);
  updateObjectDetailObservedBounds();
  updateObjectDetailFrame();
}

function createObjectDetailOptionControls() {
  const controls = document.createElement("div");
  controls.className = "object-detail-screen__options";
  controls.append(
    createObjectDetailOptionControl("LIGHT", "light"),
    createObjectDetailOptionControl("CLOUDS", "clouds"),
    createObjectDetailOptionControl("BORDERS", "borders"),
  );
  return controls;
}

function createObjectDetailOptionControl(labelText, optionKey) {
  const row = document.createElement("label");
  row.className = "object-detail-screen__option";
  const label = document.createElement("span");
  label.className = "object-detail-screen__option-label";
  label.textContent = labelText;
  const button = document.createElement("button");
  button.className = "object-detail-screen__option-button";
  button.type = "button";
  button.dataset.option = optionKey;
  button.setAttribute("aria-label", labelText);
  button.setAttribute("aria-pressed", String(Boolean(objectDetailOptions[optionKey])));
  button.addEventListener("click", (event) => {
    event.preventDefault();
    event.stopPropagation();
    setObjectDetailOption(optionKey, !objectDetailOptions[optionKey]);
  });
  row.append(label, button);
  return row;
}

function setObjectDetailOption(optionKey, isEnabled) {
  objectDetailOptions[optionKey] = Boolean(isEnabled);
  objectDetailTexture
    .querySelectorAll(`.object-detail-screen__option-button[data-option="${optionKey}"]`)
    .forEach((button) => {
      button.setAttribute("aria-pressed", String(Boolean(isEnabled)));
    });
  if (objectDetail3D) {
    objectDetail3D.targetLightMix = objectDetailOptions.light ? 1 : 0;
    objectDetail3D.targetCloudMix = objectDetailOptions.clouds ? 1 : 0;
    if (optionKey === "borders" && objectDetail3D.hexGrid) {
      redrawObjectDetailHexGrid(objectDetail3D.hexGrid);
      renderObjectDetail3D();
    }
  }
}

function createObjectDetailInfo(detail) {
  const info = document.createElement("div");
  info.className = "object-detail-screen__info";

  const columns = [
    [
      ["ATMO", formatObjectDetailAtmosphere(detail.atmosphere)],
      ["WATER", formatObjectDetailWater(detail.waterPosition)],
      ["GRAVITY", formatObjectDetailGravity(detail.gravity)],
    ],
    [
      ["DAY CYCLE", formatObjectDetailDayCycle(detail.dayCycleSeconds)],
      ["DAY TEMP", formatObjectDetailTemperature(detail.temperature)],
      ["NIGHT TEMP", formatObjectDetailTemperature(detail.temperature)],
    ],
  ];

  for (const rows of columns) {
    const column = document.createElement("dl");
    column.className = "object-detail-screen__info-column";
    for (const [labelText, valueText] of rows) {
      const row = document.createElement("div");
      row.className = "object-detail-screen__info-row";
      const label = document.createElement("dt");
      label.textContent = labelText;
      const value = document.createElement("dd");
      value.textContent = valueText;
      row.append(label, value);
      column.append(row);
    }
    info.append(column);
  }

  return info;
}

function formatObjectDetailAtmosphere(atmosphere) {
  if (atmosphere === "THIN ATMOSPHERE") {
    return "THIN";
  }
  if (atmosphere === "ATMOSPHERE") {
    return "STANDART";
  }
  if (atmosphere === "DENSE ATMOSPHERE") {
    return "DENSE";
  }
  return "NONE";
}

function formatObjectDetailWater(waterPosition) {
  if (!Number.isFinite(waterPosition) || waterPosition <= 0) {
    return "NONE";
  }
  return `${Math.round(waterPosition * 100)}%`;
}

function formatObjectDetailGravity(gravity) {
  if (!Number.isFinite(gravity)) {
    return "NONE";
  }
  return `${gravity.toFixed(2).replace(/\.?0+$/, "")}g`;
}

function formatObjectDetailDayCycle(dayCycleSeconds) {
  if (!Number.isFinite(dayCycleSeconds)) {
    return "\u221e";
  }
  return `${dayCycleSeconds.toFixed(1).replace(/\.0$/, "")}h`;
}

function formatObjectDetailTemperature(temperature) {
  if (!Number.isFinite(temperature)) {
    return "NONE";
  }
  return `${Math.round(temperature)}\u00b0C`;
}

function updateObjectDetailObservedBounds() {
  const rect = objectDetailTexture.getBoundingClientRect();
  if (rect.width <= 0 || rect.height <= 0) {
    return null;
  }

  const bounds = getObjectDetailBoundRect(
    rect,
    OBJECT_DETAIL_OBSERVED_DEFAULT_WIDTH_PERCENT,
    OBJECT_DETAIL_OBSERVED_DEFAULT_HEIGHT_PERCENT,
  );

  objectDetailTexture.style.setProperty("--object-detail-observed-left", `${bounds.left}px`);
  objectDetailTexture.style.setProperty("--object-detail-observed-top", `${bounds.top}px`);
  objectDetailTexture.style.setProperty("--object-detail-observed-right", `${rect.width - bounds.right}px`);
  objectDetailTexture.style.setProperty("--object-detail-observed-bottom", `${rect.height - bounds.bottom}px`);
  objectDetailScreen.style.setProperty("--object-detail-observed-left", `${bounds.left}px`);
  objectDetailScreen.style.setProperty("--object-detail-observed-right", `${rect.width - bounds.right}px`);
  return bounds;
}

function updateObjectDetailHoverBounds(rect = objectDetailTexture.getBoundingClientRect()) {
  if (rect.width <= 0 || rect.height <= 0) {
    return null;
  }

  return getObjectDetailBoundRect(
    rect,
    OBJECT_DETAIL_HOVER_WIDTH_PERCENT,
    OBJECT_DETAIL_HOVER_HEIGHT_PERCENT,
  );
}

function getObjectDetailBoundRect(rect, widthPercent, heightPercent) {
  const rawBounds = objectDetail3D
    ? getObjectDetailProjectedSurfaceBounds(rect, widthPercent, heightPercent)
    : {
      left: 0,
      top: 0,
      right: rect.width,
      bottom: rect.height,
    };
  const left = THREE.MathUtils.clamp(
    Math.max(rawBounds.left, -rect.left),
    0,
    rect.width,
  );
  const right = THREE.MathUtils.clamp(
    Math.min(rawBounds.right, window.innerWidth - rect.left),
    left,
    rect.width,
  );
  const top = THREE.MathUtils.clamp(
    Math.max(rawBounds.top, -rect.top),
    0,
    rect.height,
  );
  const bottom = THREE.MathUtils.clamp(
    Math.min(rawBounds.bottom, window.innerHeight - rect.top),
    top,
    rect.height,
  );
  return {
    left,
    top,
    right,
    bottom,
    width: Math.max(1, right - left),
    height: Math.max(1, bottom - top),
  };
}

function getObjectDetailProjectedSurfaceBounds(rect, widthPercent, heightPercent) {
  const width = rect.width * widthPercent / 100;
  const height = rect.height * heightPercent / 100;
  const left = (rect.width - width) / 2;
  const right = left + width;
  const top = (rect.height - height) / 2;
  const bottom = top + height;
  return { left, top, right, bottom };
}

function renderObjectDetailFlatHexGrid(detail) {
  const canvas = document.createElement("canvas");
  canvas.className = "object-detail-screen__hex-overlay";
  canvas.width = OBJECT_DETAIL_HEX_GRID_TEXTURE_WIDTH;
  canvas.height = OBJECT_DETAIL_HEX_GRID_TEXTURE_HEIGHT;
  const hexes = drawObjectDetailHexGrid(canvas, detail.bodySizeRank);
  canvas.objectDetailHexes = hexes;
  canvas.dataset.hexCount = String(hexes.length);
  objectDetailTexture.append(canvas);
}

function closeObjectDetailScreen({ preserveTransitionOverlay = false, keepSystemHidden = false } = {}) {
  isObjectDetailOpen = false;
  objectDetailToken += 1;
  activeObjectDetail = null;
  if (!keepSystemHidden) {
    starWindow.classList.remove("object-detail-open");
  }
  disposeObjectDetail3D();
  if (!preserveTransitionOverlay) {
    objectDetailEntryOverlay.classList.remove("active");
    objectDetailEntryOverlay.style.setProperty("--surface-entry-alpha", "0");
    planetScreen.classList.remove("surface-entry-moving");
    planetScreen.style.setProperty("--surface-entry-scale", "1");
    objectDetailScreen.classList.remove("object-detail-exit-moving");
    objectDetailScreen.style.setProperty("--object-detail-exit-scale", "1");
  }
  objectDetailScreen.classList.remove("visible");
  objectDetailScreen.setAttribute("aria-hidden", "true");
  objectDetailTexture.replaceChildren();
  objectDetailDayMarkers = [];
  objectDetailTexture.style.backgroundImage = "none";
}

function getObjectDetailEmissiveCanvas(detail) {
  if (!detail?.emissiveCanvas) {
    return null;
  }
  return detail.textureMode === "molten"
    ? createFeatheredObjectDetailEmissiveCanvas(detail.emissiveCanvas)
    : detail.emissiveCanvas;
}

function createFeatheredObjectDetailEmissiveCanvas(sourceCanvas) {
  const width = sourceCanvas.width;
  const height = sourceCanvas.height;
  const featherPixels = Math.max(2, Math.round(width / 512));
  const sourceContext = sourceCanvas.getContext("2d", { willReadFrequently: true });
  const source = sourceContext.getImageData(0, 0, width, height);
  const maskCanvas = document.createElement("canvas");
  maskCanvas.width = width;
  maskCanvas.height = height;
  const maskContext = maskCanvas.getContext("2d");
  const mask = maskContext.createImageData(width, height);
  for (let offset = 0; offset < source.data.length; offset += 4) {
    const luminance = source.data[offset] * 0.2126
      + source.data[offset + 1] * 0.7152
      + source.data[offset + 2] * 0.0722;
    const value = luminance > 0.5 ? 255 : 0;
    mask.data[offset] = 255;
    mask.data[offset + 1] = 255;
    mask.data[offset + 2] = 255;
    mask.data[offset + 3] = value;
  }
  maskContext.putImageData(mask, 0, 0);

  const featherCanvas = document.createElement("canvas");
  featherCanvas.width = width;
  featherCanvas.height = height;
  const featherContext = featherCanvas.getContext("2d", { willReadFrequently: true });
  featherContext.filter = `blur(${featherPixels}px)`;
  featherContext.drawImage(maskCanvas, -width, 0, width, height);
  featherContext.drawImage(maskCanvas, 0, 0, width, height);
  featherContext.drawImage(maskCanvas, width, 0, width, height);
  featherContext.filter = "none";
  const feather = featherContext.getImageData(0, 0, width, height);

  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  const context = canvas.getContext("2d");
  const image = context.createImageData(width, height);
  for (let offset = 0; offset < source.data.length; offset += 4) {
    const edgeAlpha = feather.data[offset + 3] / 255;
    image.data[offset] = source.data[offset] * edgeAlpha;
    image.data[offset + 1] = source.data[offset + 1] * edgeAlpha;
    image.data[offset + 2] = source.data[offset + 2] * edgeAlpha;
    image.data[offset + 3] = 255;
  }
  context.putImageData(image, 0, 0);
  return canvas;
}

function renderObjectDetailPlanetSurface(detail) {
  const now = performance.now();
  const runtimeState = detail.objectDetailRuntimeState ?? {};
  const canvas = document.createElement("canvas");
  canvas.className = "object-detail-screen__canvas";
  objectDetailTexture.append(canvas);

  const renderer3D = new THREE.WebGLRenderer({
    canvas,
    alpha: true,
    antialias: true,
    powerPreference: "high-performance",
  });
  renderer3D.setPixelRatio(Math.min(window.devicePixelRatio, 1.5));
  renderer3D.outputColorSpace = THREE.SRGBColorSpace;
  renderer3D.shadowMap.enabled = true;
  renderer3D.shadowMap.type = THREE.PCFSoftShadowMap;

  const scene3D = new THREE.Scene();
  const camera3D = new THREE.OrthographicCamera(
    -OBJECT_DETAIL_CAMERA_HALF_WIDTH,
    OBJECT_DETAIL_CAMERA_HALF_WIDTH,
    OBJECT_DETAIL_CAMERA_HALF_HEIGHT,
    -OBJECT_DETAIL_CAMERA_HALF_HEIGHT,
    0.01,
    20,
  );
  camera3D.position.set(0, 0, 3);
  camera3D.lookAt(0, 0, 0);
  const ambientLight = new THREE.AmbientLight(0xffffff, OBJECT_DETAIL_AMBIENT_INTENSITY);
  scene3D.add(ambientLight);

  const colorMapRef = retainObjectDetailCanvasTexture(detail.textureCanvas, renderer3D, true);
  const colorMap = getRetainedCanvasTexture(colorMapRef);

  const heightMapRef = detail.bumpCanvas
    ? retainObjectDetailCanvasTexture(detail.bumpCanvas, renderer3D, false)
    : null;
  const heightMap = getRetainedCanvasTexture(heightMapRef);
  const objectDetailEmissiveCanvas = getObjectDetailEmissiveCanvas(detail);
  const emissiveMapRef = objectDetailEmissiveCanvas
    ? retainObjectDetailCanvasTexture(
      objectDetailEmissiveCanvas,
      renderer3D,
      true,
      objectDetailEmissiveCanvas === detail.emissiveCanvas,
    )
    : null;
  const emissiveMap = getRetainedCanvasTexture(emissiveMapRef);
  const cloudMapRef = detail.cloudCanvas
    ? retainObjectDetailCanvasTexture(detail.cloudCanvas, renderer3D, true)
    : null;
  const cloudMap = getRetainedCanvasTexture(cloudMapRef);

  const hasDisplacement = Boolean(heightMap);
  const geometry = hasDisplacement
    ? new THREE.PlaneGeometry(2, 1, 512, 256)
    : new THREE.PlaneGeometry(2, 1, 1, 1);
  const material = new THREE.MeshStandardMaterial({
    map: colorMap,
    displacementMap: heightMap ?? undefined,
    displacementScale: hasDisplacement ? OBJECT_DETAIL_DISPLACEMENT_SCALE : 0,
    displacementBias: hasDisplacement ? -0.035 : 0,
    emissive: emissiveMap ? 0xffffff : 0x000000,
    emissiveMap: emissiveMap ?? undefined,
    emissiveIntensity: emissiveMap ? 0.59 : 0,
    roughness: 0.86,
    metalness: 0,
  });
  applyObjectDetailSurfaceEffects(material, cloudMap ?? colorMap, Boolean(cloudMap));
  const mesh = new THREE.Mesh(geometry, material);
  mesh.receiveShadow = true;
  scene3D.add(mesh);

  const hexGrid = createObjectDetailHexGrid(detail, renderer3D, {
    surfaceGeometry: geometry,
    heightMap,
    hasDisplacement,
  });
  scene3D.add(hexGrid.cityMesh);
  scene3D.add(hexGrid.cityNightMesh);
  scene3D.add(hexGrid.mesh);

  const cloudGeometry = cloudMap ? new THREE.PlaneGeometry(2, 1, 1, 1) : null;
  const cloudMaterial = cloudMap
    ? new THREE.MeshStandardMaterial({
      map: cloudMap,
      transparent: true,
      opacity: objectDetailOptions.clouds ? 1 : 0,
      alphaTest: OBJECT_DETAIL_CLOUD_ALPHA_TEST,
      depthWrite: false,
      roughness: 0.9,
      metalness: 0,
    })
    : null;
  if (cloudMaterial) {
    applyObjectDetailCloudClear(cloudMaterial, detail.starGlowColor, Boolean(detail.atmosphere));
  }
  const cloudDepthMaterial = cloudMap
    ? new THREE.MeshDepthMaterial({
      map: cloudMap,
      alphaTest: OBJECT_DETAIL_CLOUD_ALPHA_TEST,
      depthPacking: THREE.RGBADepthPacking,
    })
    : null;
  let cloudMesh = null;
  if (cloudGeometry && cloudMaterial && cloudDepthMaterial) {
    cloudMesh = new THREE.Mesh(cloudGeometry, cloudMaterial);
    cloudMesh.position.z = OBJECT_DETAIL_CLOUD_HEIGHT;
    cloudMesh.castShadow = true;
    cloudMesh.receiveShadow = false;
    cloudMesh.customDepthMaterial = cloudDepthMaterial;
    cloudMesh.renderOrder = 2;
    scene3D.add(cloudMesh);
  }
  const bloomResources = emissiveMap
    ? createObjectDetailEmissiveBloomResources(renderer3D, emissiveMap)
    : null;

  const lightDaySeconds = detail.dayCycleSeconds === Infinity
    ? Infinity
    : Number.isFinite(detail.dayCycleSeconds)
      ? Math.max(0.001, detail.dayCycleSeconds)
      : OBJECT_DETAIL_LIGHT_FALLBACK_DAY_SECONDS;
  const spotStartXs = detail.kind === "MOON"
    ? [-OBJECT_DETAIL_SURFACE_WORLD_WIDTH, 0]
    : lightDaySeconds === Infinity
      ? [-0.94, 0.94]
      : [-1, 1];
  const spotLights = spotStartXs.map((startX) => {
    const target = new THREE.Object3D();
    target.position.set(startX, 0, 0);
    scene3D.add(target);

    const light = new THREE.SpotLight(
      0xffffff,
      OBJECT_DETAIL_LIGHT_INTENSITY,
      8,
      THREE.MathUtils.degToRad(OBJECT_DETAIL_LIGHT_ANGLE_DEGREES),
      OBJECT_DETAIL_LIGHT_PENUMBRA,
      0.8,
    );
    light.position.set(startX, 0, OBJECT_DETAIL_LIGHT_Z);
    light.target = target;
    light.castShadow = true;
    light.shadow.mapSize.set(1024, 1024);
    light.shadow.bias = -0.00008;
    light.shadow.normalBias = 0.015;
    scene3D.add(light);

    const tintLight = new THREE.SpotLight(
      new THREE.Color(detail.starGlowColor ?? "#ffffff"),
      0,
      8,
      THREE.MathUtils.degToRad(OBJECT_DETAIL_TINT_LIGHT_ANGLE_DEGREES),
      OBJECT_DETAIL_TINT_LIGHT_PENUMBRA,
      0.8,
    );
    tintLight.position.set(startX, 0, OBJECT_DETAIL_LIGHT_Z);
    tintLight.target = target;
    tintLight.castShadow = false;
    scene3D.add(tintLight);
    return { light, tintLight, target, startX };
  });

  const cursorTarget = new THREE.Object3D();
  cursorTarget.position.set(0, 0, 0);
  scene3D.add(cursorTarget);
  const cursorLight = new THREE.SpotLight(
    0xffffff,
    0,
    8,
    THREE.MathUtils.degToRad(OBJECT_DETAIL_CURSOR_LIGHT_ANGLE_DEGREES),
    OBJECT_DETAIL_CURSOR_LIGHT_PENUMBRA,
    0.8,
  );
  cursorLight.position.set(0, 0, OBJECT_DETAIL_LIGHT_Z);
  cursorLight.target = cursorTarget;
  cursorLight.castShadow = false;
  scene3D.add(cursorLight);

  objectDetail3D = {
    renderer: renderer3D,
    scene: scene3D,
    camera: camera3D,
    geometry,
    material,
    colorMap,
    colorMapRef,
    heightMap,
    heightMapRef,
    emissiveMap,
    emissiveMapRef,
    isGasGiant: detail.kind === "GAS GIANT",
    hexGrid,
    cloudMap,
    cloudMapRef,
    cloudGeometry,
    cloudMaterial,
    cloudDepthMaterial,
    cloudMesh,
    bloomResources,
    ambientLight,
    spotLights,
    cursorLight,
    cursorTarget,
    cursorLightIntensity: runtimeState.cursorLightIntensity ?? 0,
    cursorEffectMix: runtimeState.cursorEffectMix ?? 0,
    cursorLightUpdatedAt: runtimeState.cursorLightUpdatedAt ?? now,
    lightMix: runtimeState.lightMix ?? (objectDetailOptions.light ? 1 : 0),
    targetLightMix: runtimeState.targetLightMix ?? (objectDetailOptions.light ? 1 : 0),
    cloudMix: runtimeState.cloudMix ?? (objectDetailOptions.clouds ? 1 : 0),
    targetCloudMix: runtimeState.targetCloudMix ?? (objectDetailOptions.clouds ? 1 : 0),
    optionMixUpdatedAt: runtimeState.optionMixUpdatedAt ?? now,
    optionMixApplied: false,
    lightMotionApplied: false,
    cursor: {
      active: false,
      uv: new THREE.Vector2(0.5, 0.5),
      world: new THREE.Vector2(0, 0),
      clearRadius: OBJECT_DETAIL_CURSOR_CLEAR_RADIUS,
      clearFeather: OBJECT_DETAIL_CURSOR_CLEAR_FEATHER,
    },
    lightStartedAt: runtimeState.lightStartedAt ?? now,
    lightDaySeconds,
    bodyTextureCycleSeconds: detail.kind === "GAS GIANT"
      ? OBJECT_DETAIL_GAS_GIANT_TEXTURE_CYCLE_SECONDS
      : Infinity,
    cloudCycleSeconds: detail.kind === "GAS GIANT"
      ? OBJECT_DETAIL_GAS_GIANT_CLOUD_CYCLE_SECONDS
      : OBJECT_DETAIL_CLOUD_CYCLE_SECONDS,
  };

  resizeObjectDetail3D();
  updateObjectDetailLightMotion(performance.now());
  renderObjectDetail3D();
}

function retainObjectDetailCanvasTexture(canvas, renderer3D, srgb = true, keepIdle = true) {
  return retainCanvasTexture(canvas, renderer3D, {
    keepIdle,
    srgb,
    wrapS: THREE.RepeatWrapping,
    wrapT: THREE.ClampToEdgeWrapping,
  });
}

function resizeObjectDetail3D() {
  if (!objectDetail3D) {
    return;
  }

  const rect = objectDetailTexture.getBoundingClientRect();
  const width = Math.max(1, Math.round(rect.width));
  const height = Math.max(1, Math.round(rect.height));
  objectDetail3D.renderer.setSize(width, height, false);
  objectDetail3D.camera.updateProjectionMatrix();
  resizeObjectDetailBloomResources(objectDetail3D, width, height);
  updateObjectDetailObservedBounds();
  updateObjectDetailHoverBounds();
}

function renderObjectDetail3D() {
  if (!objectDetail3D) {
    return;
  }

  objectDetail3D.renderer.render(objectDetail3D.scene, objectDetail3D.camera);
  renderObjectDetailEmissiveBloom(objectDetail3D, performance.now());
}

function createObjectDetailEmissiveBloomResources(renderer3D, emissiveMap) {
  const targetOptions = {
    minFilter: THREE.LinearFilter,
    magFilter: THREE.LinearFilter,
    format: THREE.RGBAFormat,
    depthBuffer: false,
    stencilBuffer: false,
  };
  const targetA = new THREE.WebGLRenderTarget(1, 1, targetOptions);
  const targetB = new THREE.WebGLRenderTarget(1, 1, targetOptions);
  targetA.texture.colorSpace = THREE.SRGBColorSpace;
  targetB.texture.colorSpace = THREE.SRGBColorSpace;

  const bloomScene = new THREE.Scene();
  const bloomMaterial = createObjectDetailEmissiveBloomMaterial(emissiveMap);
  const bloomGeometry = new THREE.PlaneGeometry(2, 1, 1, 1);
  bloomScene.add(new THREE.Mesh(bloomGeometry, bloomMaterial));

  const postCamera = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1);
  const blurMaterial = new THREE.ShaderMaterial({
    uniforms: {
      inputTexture: { value: targetA.texture },
      direction: { value: new THREE.Vector2(1, 0) },
      resolution: { value: new THREE.Vector2(1, 1) },
    },
    vertexShader: `
      varying vec2 vUv;
      void main() {
        vUv = uv;
        gl_Position = vec4(position.xy, 0.0, 1.0);
      }
    `,
    fragmentShader: `
      uniform sampler2D inputTexture;
      uniform vec2 direction;
      uniform vec2 resolution;
      varying vec2 vUv;
      void main() {
        vec2 stepSize = direction / resolution;
        vec4 color = texture2D(inputTexture, vUv) * 0.227027;
        color += texture2D(inputTexture, vUv + stepSize * 1.384615) * 0.316216;
        color += texture2D(inputTexture, vUv - stepSize * 1.384615) * 0.316216;
        color += texture2D(inputTexture, vUv + stepSize * 3.230769) * 0.070270;
        color += texture2D(inputTexture, vUv - stepSize * 3.230769) * 0.070270;
        gl_FragColor = color;
      }
    `,
    depthWrite: false,
    depthTest: false,
  });
  const blurScene = new THREE.Scene();
  blurScene.add(new THREE.Mesh(new THREE.PlaneGeometry(2, 2), blurMaterial));

  const compositeMaterial = new THREE.ShaderMaterial({
    uniforms: {
      inputTexture: { value: targetA.texture },
    },
    vertexShader: `
      varying vec2 vUv;
      void main() {
        vUv = uv;
        gl_Position = vec4(position.xy, 0.0, 1.0);
      }
    `,
    fragmentShader: `
      uniform sampler2D inputTexture;
      varying vec2 vUv;
      void main() {
        vec4 bloom = texture2D(inputTexture, vUv);
        gl_FragColor = vec4(bloom.rgb, bloom.a);
      }
    `,
    transparent: true,
    depthWrite: false,
    depthTest: false,
    blending: THREE.AdditiveBlending,
  });
  const compositeScene = new THREE.Scene();
  compositeScene.add(new THREE.Mesh(new THREE.PlaneGeometry(2, 2), compositeMaterial));

  return {
    renderer: renderer3D,
    targetA,
    targetB,
    bloomScene,
    bloomGeometry,
    bloomMaterial,
    blurScene,
    blurMaterial,
    compositeScene,
    compositeCamera: postCamera,
    compositeMaterial,
  };
}

function createObjectDetailEmissiveBloomMaterial(emissiveMap) {
  return new THREE.ShaderMaterial({
    uniforms: {
      emissiveMap: { value: emissiveMap },
      emissiveTime: { value: performance.now() * 0.001 },
      emissiveNoiseScale: { value: OBJECT_DETAIL_EMISSIVE_NOISE_SCALE },
      emissiveNoiseSpeed: { value: OBJECT_DETAIL_EMISSIVE_NOISE_SPEED },
      emissiveNoiseBlackStop: { value: OBJECT_DETAIL_EMISSIVE_NOISE_BLACK_STOP },
      emissiveNoiseWhiteStop: { value: OBJECT_DETAIL_EMISSIVE_NOISE_WHITE_STOP },
      emissiveNoiseOctaves: { value: OBJECT_DETAIL_EMISSIVE_NOISE_OCTAVES },
      emissiveBloomStrength: { value: OBJECT_DETAIL_EMISSIVE_BLOOM_STRENGTH },
    },
    vertexShader: `
      varying vec2 vUv;
      void main() {
        vUv = uv;
        gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
      }
    `,
    fragmentShader: `
      uniform sampler2D emissiveMap;
      uniform float emissiveTime;
      uniform float emissiveNoiseScale;
      uniform float emissiveNoiseSpeed;
      uniform float emissiveNoiseBlackStop;
      uniform float emissiveNoiseWhiteStop;
      uniform float emissiveNoiseOctaves;
      uniform float emissiveBloomStrength;
      varying vec2 vUv;
      float emissiveHash(vec2 point) {
        return fract(sin(dot(point, vec2(41.31, 289.17))) * 19341.1415);
      }
      float emissiveNoise(vec2 uvPoint, vec2 frequency) {
        vec2 point = uvPoint * frequency;
        vec2 cell = floor(point);
        vec2 local = smoothstep(vec2(0.0), vec2(1.0), fract(point));
        vec2 cell00 = mod(cell, frequency);
        vec2 cell10 = mod(cell + vec2(1.0, 0.0), frequency);
        vec2 cell01 = mod(cell + vec2(0.0, 1.0), frequency);
        vec2 cell11 = mod(cell + vec2(1.0, 1.0), frequency);
        float a = emissiveHash(cell00);
        float b = emissiveHash(cell10);
        float c = emissiveHash(cell01);
        float d = emissiveHash(cell11);
        return mix(mix(a, b, local.x), mix(c, d, local.x), local.y);
      }
      float emissiveOctaveNoise(vec2 uvPoint) {
        float total = 0.0;
        float amplitude = 1.0;
        float amplitudeTotal = 0.0;
        for (int octave = 0; octave < 8; octave += 1) {
          if (float(octave) >= emissiveNoiseOctaves) {
            break;
          }
          float octaveScale = pow(2.0, float(octave));
          total += emissiveNoise(uvPoint, vec2(emissiveNoiseScale * octaveScale, emissiveNoiseScale * octaveScale * 0.5)) * amplitude;
          amplitudeTotal += amplitude;
          amplitude *= 0.5;
        }
        return total / max(0.0001, amplitudeTotal);
      }
      float emissiveNoiseMask(vec2 uvPoint) {
        float blackStop = clamp(emissiveNoiseBlackStop, 0.0, 1.0);
        float whiteStop = max(blackStop + 0.001, clamp(emissiveNoiseWhiteStop, 0.0, 1.0));
        return smoothstep(blackStop, whiteStop, emissiveOctaveNoise(uvPoint));
      }
      void main() {
        vec3 emissive = texture2D(emissiveMap, vUv).rgb;
        vec2 emissiveUv = vec2(fract(vUv.x + emissiveTime * emissiveNoiseSpeed), vUv.y);
        float noiseMask = emissiveNoiseMask(emissiveUv);
        float mask = max(max(emissive.r, emissive.g), emissive.b);
        float alpha = clamp(mask * emissiveBloomStrength * noiseMask, 0.0, 1.0);
        if (alpha < 0.001) {
          discard;
        }
        gl_FragColor = vec4(emissive * emissiveBloomStrength * noiseMask, alpha);
      }
    `,
    transparent: true,
    depthWrite: false,
    depthTest: false,
    blending: THREE.AdditiveBlending,
    toneMapped: false,
  });
}

function resizeObjectDetailBloomResources(detail3D, width, height) {
  const bloom = detail3D.bloomResources;
  if (!bloom) {
    return;
  }
  const pixelRatio = Math.min(window.devicePixelRatio, 1.5);
  const targetWidth = Math.max(1, Math.ceil(width * pixelRatio * OBJECT_DETAIL_EMISSIVE_BLOOM_TARGET_SCALE));
  const targetHeight = Math.max(1, Math.ceil(height * pixelRatio * OBJECT_DETAIL_EMISSIVE_BLOOM_TARGET_SCALE));
  bloom.targetA.setSize(targetWidth, targetHeight);
  bloom.targetB.setSize(targetWidth, targetHeight);
  bloom.blurMaterial.uniforms.resolution.value.set(targetWidth, targetHeight);
}

function renderObjectDetailEmissiveBloom(detail3D, now) {
  const bloom = detail3D.bloomResources;
  if (!bloom) {
    return;
  }
  bloom.bloomMaterial.uniforms.emissiveTime.value = now * 0.001;
  const renderer3D = detail3D.renderer;
  renderer3D.setRenderTarget(bloom.targetA);
  renderer3D.clear(true, true, true);
  renderer3D.render(bloom.bloomScene, detail3D.camera);

  bloom.blurMaterial.uniforms.inputTexture.value = bloom.targetA.texture;
  bloom.blurMaterial.uniforms.direction.value.set(1, 0);
  renderer3D.setRenderTarget(bloom.targetB);
  renderer3D.clear(true, true, true);
  renderer3D.render(bloom.blurScene, bloom.compositeCamera);

  bloom.blurMaterial.uniforms.inputTexture.value = bloom.targetB.texture;
  bloom.blurMaterial.uniforms.direction.value.set(0, 1);
  renderer3D.setRenderTarget(bloom.targetA);
  renderer3D.clear(true, true, true);
  renderer3D.render(bloom.blurScene, bloom.compositeCamera);

  bloom.blurMaterial.uniforms.inputTexture.value = bloom.targetA.texture;
  bloom.blurMaterial.uniforms.direction.value.set(1, 0);
  renderer3D.setRenderTarget(bloom.targetB);
  renderer3D.clear(true, true, true);
  renderer3D.render(bloom.blurScene, bloom.compositeCamera);

  bloom.blurMaterial.uniforms.inputTexture.value = bloom.targetB.texture;
  bloom.blurMaterial.uniforms.direction.value.set(0, 1);
  renderer3D.setRenderTarget(bloom.targetA);
  renderer3D.clear(true, true, true);
  renderer3D.render(bloom.blurScene, bloom.compositeCamera);

  renderer3D.setRenderTarget(null);
  renderer3D.autoClear = false;
  renderer3D.render(bloom.compositeScene, bloom.compositeCamera);
  renderer3D.autoClear = true;
}

function updateObjectDetailCursorInteraction(event) {
  if (!objectDetail3D?.cursor || !isObjectDetailOpen) {
    return;
  }

  const hit = getObjectDetailSurfacePointerHit(event);
  if (!hit) {
    return;
  }

  const { rawU, rawScreenV, insideHoverZone } = hit;
  const shaderU = THREE.MathUtils.clamp(rawU, 0, 1);
  const shaderScreenV = THREE.MathUtils.clamp(rawScreenV, 0, 1);
  const textureV = 1 - shaderScreenV;
  const worldX = (rawU - 0.5) * OBJECT_DETAIL_SURFACE_WORLD_WIDTH;
  const worldY = 0.5 - rawScreenV;
  objectDetail3D.cursor.active = insideHoverZone;
  objectDetail3D.cursor.uv.set(shaderU, textureV);
  objectDetail3D.cursor.world.set(worldX, worldY);
  updateObjectDetailHexHover(hit);
  updateObjectDetailCursorLight(performance.now());
  updateObjectDetailCursorUniforms();
  renderObjectDetail3D();
}

function clearObjectDetailCursorInteraction() {
  if (!objectDetail3D?.cursor) {
    return;
  }

  objectDetail3D.cursor.active = false;
  updateObjectDetailHexHover(null);
  updateObjectDetailCursorLight(performance.now());
  updateObjectDetailCursorUniforms();
  renderObjectDetail3D();
}

function getObjectDetailSurfacePointerHit(event) {
  if (!objectDetail3D?.hexGrid) {
    return null;
  }

  const rect = objectDetailTexture.getBoundingClientRect();
  const bounds = updateObjectDetailHoverBounds(rect);
  if (rect.width <= 0 || rect.height <= 0 || !bounds) {
    return null;
  }

  const left = rect.left + bounds.left;
  const top = rect.top + bounds.top;
  const rawU = (event.clientX - left) / bounds.width;
  const rawScreenV = (event.clientY - top) / bounds.height;
  const insideHoverZone = rawU >= 0 && rawU <= 1 && rawScreenV >= 0 && rawScreenV <= 1;
  const canvasX = THREE.MathUtils.clamp(rawU, 0, 1) * objectDetail3D.hexGrid.canvas.width;
  const canvasY = THREE.MathUtils.clamp(rawScreenV, 0, 1) * objectDetail3D.hexGrid.canvas.height;
  const hex = insideHoverZone
    ? findObjectDetailHexAt(objectDetail3D.hexGrid, canvasX, canvasY)
    : null;

  return {
    rawU,
    rawScreenV,
    insideHoverZone,
    canvasX,
    canvasY,
    hex,
  };
}

function updateObjectDetailHexHover(hit) {
  const hexGrid = objectDetail3D?.hexGrid;
  if (!hexGrid) {
    return;
  }

  const nextAddress = hit?.hex?.address ?? null;
  if (hexGrid.state.hoverAddress === nextAddress) {
    return;
  }

  hexGrid.state.hoverAddress = nextAddress;
}

function findObjectDetailHexAt(hexGrid, canvasX, canvasY) {
  return hexGrid.hexes.find((hex) => isPointInObjectDetailHex(canvasX, canvasY, hex)) ?? null;
}

function onObjectDetailTextureClick(event) {
  if (!objectDetail3D?.hexGrid || !isObjectDetailOpen) {
    return;
  }

  if (event.target instanceof Element && event.target.closest("button, .object-detail-screen__options")) {
    return;
  }

  const hit = getObjectDetailSurfacePointerHit(event);
  if (!hit?.insideHoverZone) {
    return;
  }

  const option = getObjectDetailBuildMenuOptionAt(objectDetail3D.hexGrid, hit.canvasX, hit.canvasY);
  if (option) {
    const hex = getObjectDetailHexByAddress(objectDetail3D.hexGrid, objectDetail3D.hexGrid.state.menuAddress);
    if (hex) {
      handleObjectDetailBuildMenuOptionClick(objectDetail3D.hexGrid, hex, option);
    }
    return;
  }

  if (!hit.hex) {
    return;
  }

  handleObjectDetailHexClick(hit);
}

function handleObjectDetailHexClick(hit) {
  const hexGrid = objectDetail3D.hexGrid;
  const { state } = hexGrid;
  if (state.menuAddress === hit.hex.address && state.menuTarget > 0) {
    closeObjectDetailBuildMenu(hexGrid);
    return;
  }

  openObjectDetailBuildMenu(hexGrid, hit.hex);
}

function getObjectDetailBuildMenuOptionAt(hexGrid, canvasX, canvasY) {
  const { state } = hexGrid;
  if (!state.menuAddress || state.menuProgress < 0.72) {
    return null;
  }

  const hex = getObjectDetailHexByAddress(hexGrid, state.menuAddress);
  if (!hex) {
    return null;
  }

  return getObjectDetailBuildMenuLayout(hexGrid, hex, easeOutCubic(state.menuProgress))
    .find((option) => Math.hypot(canvasX - option.x, canvasY - option.y) <= option.radius) ?? null;
}

function handleObjectDetailBuildMenuOptionClick(hexGrid, hex, option) {
  if (option.id === "demolish") {
    removeObjectDetailBuilding(hexGrid, hex);
    return;
  }

  if (option.id !== "town" || getObjectDetailBuilding(hexGrid.state, hex.address)) {
    return;
  }

  if (getObjectDetailHexWaterRatio(hexGrid, hex) > OBJECT_DETAIL_HEX_WATER_LIMIT) {
    return;
  }

  setObjectDetailBuilding(hexGrid, hex.address, createObjectDetailTownBuilding(hex.address));
  markObjectDetailCityLayerDirty(hexGrid);
  syncObjectDetailBuildingsToGameState(hexGrid.detail);
  refreshOwnershipVisualsAfterGameStateChange();
  persistRuntimeSession("detail");
  closeObjectDetailBuildMenu(hexGrid);
  redrawObjectDetailHexGrid(hexGrid);
  renderObjectDetail3D();
}

function removeObjectDetailBuilding(hexGrid, hex) {
  const building = getObjectDetailBuilding(hexGrid.state, hex.address);
  if (!building || !isObjectDetailBuildingControlledByActiveSide(building)) {
    return;
  }

  deleteObjectDetailBuilding(hexGrid, hex.address);
  markObjectDetailCityLayerDirty(hexGrid);
  syncObjectDetailBuildingsToGameState(hexGrid.detail);
  refreshOwnershipVisualsAfterGameStateChange();
  persistRuntimeSession("detail");
  closeObjectDetailBuildMenu(hexGrid);
  redrawObjectDetailHexGrid(hexGrid);
  renderObjectDetail3D();
}

function openObjectDetailBuildMenu(hexGrid, hex) {
  const state = hexGrid.state;
  if (state.menuAddress !== hex.address) {
    state.menuProgress = 0;
  }
  state.menuAddress = hex.address;
  state.menuTarget = 1;
  state.menuUpdatedAt = performance.now();
  scheduleObjectDetailHexGridAnimation();
}

function closeObjectDetailBuildMenu(hexGrid) {
  const state = hexGrid.state;
  state.menuTarget = 0;
  state.menuUpdatedAt = performance.now();
  scheduleObjectDetailHexGridAnimation();
}

function scheduleObjectDetailHexGridAnimation() {
  if (objectDetailHexAnimationFrame !== null) {
    return;
  }
  objectDetailHexAnimationFrame = requestAnimationFrame(updateObjectDetailHexGridAnimation);
}

function updateObjectDetailHexGridAnimation(now) {
  objectDetailHexAnimationFrame = null;
  const hexGrid = objectDetail3D?.hexGrid;
  if (!hexGrid) {
    return;
  }

  const state = hexGrid.state;
  const previous = state.menuProgress;
  const deltaSeconds = Math.max(0, (now - (state.menuUpdatedAt ?? now)) / 1000);
  const step = deltaSeconds * OBJECT_DETAIL_BUILD_MENU_ANIMATION_SPEED;
  state.menuProgress = state.menuTarget > previous
    ? Math.min(state.menuTarget, previous + step)
    : Math.max(state.menuTarget, previous - step);
  state.menuUpdatedAt = now;

  if (state.menuTarget === 0 && state.menuProgress <= 0.001) {
    state.menuProgress = 0;
    state.menuAddress = null;
  }

  redrawObjectDetailHexGrid(hexGrid);
  renderObjectDetail3D();

  if (Math.abs(state.menuProgress - state.menuTarget) > 0.001) {
    scheduleObjectDetailHexGridAnimation();
  }
}

function cancelObjectDetailHexGridAnimation() {
  if (objectDetailHexAnimationFrame === null) {
    return;
  }
  cancelAnimationFrame(objectDetailHexAnimationFrame);
  objectDetailHexAnimationFrame = null;
}

function updateObjectDetailCursorLight(now = performance.now()) {
  if (!objectDetail3D?.cursorLight || !objectDetail3D?.cursorTarget || !objectDetail3D?.cursor) {
    return false;
  }

  const { active, world } = objectDetail3D.cursor;
  const x = world.x;
  const y = world.y;
  objectDetail3D.cursorLight.position.set(x, y, OBJECT_DETAIL_LIGHT_Z);
  objectDetail3D.cursorTarget.position.set(x, y, 0);
  const lightMix = THREE.MathUtils.clamp(objectDetail3D.lightMix ?? 1, 0, 1);
  const targetIntensity = active
    ? OBJECT_DETAIL_CURSOR_LIGHT_INTENSITY * getObjectDetailCursorLightProximityMultiplier(world) * lightMix
    : 0;
  const previous = objectDetail3D.cursorLightUpdatedAt ?? now;
  const deltaSeconds = Math.max(0, (now - previous) / 1000);
  const fadeSpeed = active
    ? OBJECT_DETAIL_CURSOR_LIGHT_FADE_IN_SPEED
    : OBJECT_DETAIL_CURSOR_LIGHT_FADE_OUT_SPEED;
  const smoothing = 1 - Math.exp(-fadeSpeed * deltaSeconds);
  const previousIntensity = objectDetail3D.cursorLightIntensity ?? 0;
  const previousEffectMix = objectDetail3D.cursorEffectMix ?? 0;
  objectDetail3D.cursorLightIntensity = THREE.MathUtils.lerp(
    previousIntensity,
    targetIntensity,
    smoothing,
  );
  objectDetail3D.cursorEffectMix = THREE.MathUtils.lerp(
    previousEffectMix,
    active ? 1 : 0,
    smoothing,
  );
  objectDetail3D.cursorLight.intensity = objectDetail3D.cursorLightIntensity;
  objectDetail3D.cursorLightUpdatedAt = now;
  return (
    Math.abs(objectDetail3D.cursorLightIntensity - previousIntensity) > OBJECT_DETAIL_RENDER_EPSILON ||
    Math.abs(objectDetail3D.cursorEffectMix - previousEffectMix) > OBJECT_DETAIL_RENDER_EPSILON
  );
}

function getObjectDetailCursorLightProximityMultiplier(world) {
  if (!objectDetail3D?.spotLights?.length) {
    return 1;
  }

  const daySpotRadius = OBJECT_DETAIL_LIGHT_Z * Math.tan(THREE.MathUtils.degToRad(OBJECT_DETAIL_LIGHT_ANGLE_DEGREES));
  const nearestFactor = objectDetail3D.spotLights.reduce((factor, item) => {
    const distance = Math.hypot(world.x - item.target.position.x, world.y - item.target.position.y);
    const proximity = 1 - THREE.MathUtils.smoothstep(distance, daySpotRadius * 0.25, daySpotRadius);
    return Math.max(factor, proximity);
  }, 0);
  return THREE.MathUtils.lerp(1, OBJECT_DETAIL_CURSOR_LIGHT_MIN_PROXIMITY, nearestFactor);
}

function updateObjectDetailLightMotion(now) {
  if (!objectDetail3D?.spotLights) {
    return false;
  }

  const optionChanged = updateObjectDetailOptionMixes(now);
  const elapsedSeconds = (now - objectDetail3D.lightStartedAt) / 1000;
  const speed = Number.isFinite(objectDetail3D.lightDaySeconds)
    ? OBJECT_DETAIL_SURFACE_WORLD_WIDTH / objectDetail3D.lightDaySeconds
    : 0;
  const hasMovingLight = speed !== 0;
  const shouldUpdateLightPositions = hasMovingLight || !objectDetail3D.lightMotionApplied;
  if (shouldUpdateLightPositions) {
    for (const item of objectDetail3D.spotLights) {
      const x = wrapObjectDetailLightX(item.startX + elapsedSeconds * speed);
      item.light.position.set(x, 0, OBJECT_DETAIL_LIGHT_Z);
      item.tintLight.position.set(x, 0, OBJECT_DETAIL_LIGHT_Z);
      item.target.position.set(x, 0, 0);
    }
    objectDetail3D.lightMotionApplied = true;
  }
  const cursorChanged = updateObjectDetailCursorLight(now);
  const hasBodyTextureMotion = Number.isFinite(objectDetail3D.bodyTextureCycleSeconds);
  const hasCloudTextureMotion = Boolean(objectDetail3D.cloudMap);
  if (hasBodyTextureMotion) {
    const bodyPhase = elapsedSeconds / objectDetail3D.bodyTextureCycleSeconds;
    objectDetail3D.colorMap.offset.x = ((bodyPhase % 1) + 1) % 1;
  }
  if (hasCloudTextureMotion) {
    const cloudCycleSeconds = Number.isFinite(objectDetail3D.cloudCycleSeconds)
      ? objectDetail3D.cloudCycleSeconds
      : OBJECT_DETAIL_CLOUD_CYCLE_SECONDS;
    const cloudPhase = elapsedSeconds / cloudCycleSeconds;
    objectDetail3D.cloudMap.offset.x = ((cloudPhase % 1) + 1) % 1;
  }
  const cityNightChanged = updateObjectDetailCityNightUniforms(now);
  const needsRender =
    optionChanged ||
    cursorChanged ||
    shouldUpdateLightPositions ||
    hasBodyTextureMotion ||
    hasCloudTextureMotion ||
    cityNightChanged ||
    Boolean(objectDetail3D.bloomResources);

  if (!needsRender) {
    return false;
  }

  updateObjectDetailSurfaceEffectUniforms();
  if (shouldUpdateLightPositions) {
    updateObjectDetailFrame();
  }
  return true;
}

function updateObjectDetailFrame() {
  const markers = objectDetailDayMarkers;
  if (!markers.length || !objectDetail3D?.spotLights?.length) {
    return;
  }

  objectDetail3D.spotLights.forEach((item, index) => {
    const marker = markers[index];
    if (!marker) {
      return;
    }
    const relative = (item.target.position.x + OBJECT_DETAIL_SURFACE_WORLD_WIDTH / 2) / OBJECT_DETAIL_SURFACE_WORLD_WIDTH;
    const edgeScale = Math.min(
      THREE.MathUtils.smoothstep(relative, 0, OBJECT_DETAIL_DAY_MARKER_EDGE_FADE),
      1 - THREE.MathUtils.smoothstep(relative, 1 - OBJECT_DETAIL_DAY_MARKER_EDGE_FADE, 1),
    );
    marker.style.left = `${THREE.MathUtils.clamp(relative, 0, 1) * 100}%`;
    marker.style.visibility = relative >= 0 && relative <= 1 ? "visible" : "hidden";
    marker.style.setProperty("--object-detail-day-marker-edge-scale", String(edgeScale));
  });
}

function updateObjectDetailOptionMixes(now = performance.now()) {
  if (!objectDetail3D) {
    return false;
  }

  const previous = objectDetail3D.optionMixUpdatedAt ?? now;
  const deltaSeconds = Math.max(0, (now - previous) / 1000);
  const smoothing = 1 - Math.exp(-OBJECT_DETAIL_OPTION_FADE_SPEED * deltaSeconds);
  const previousLightMix = objectDetail3D.lightMix ?? 1;
  const previousCloudMix = objectDetail3D.cloudMix ?? 1;
  objectDetail3D.lightMix = THREE.MathUtils.lerp(
    previousLightMix,
    objectDetail3D.targetLightMix ?? 1,
    smoothing,
  );
  objectDetail3D.cloudMix = THREE.MathUtils.lerp(
    previousCloudMix,
    objectDetail3D.targetCloudMix ?? 1,
    smoothing,
  );
  objectDetail3D.optionMixUpdatedAt = now;

  const lightMix = THREE.MathUtils.clamp(objectDetail3D.lightMix, 0, 1);
  const cloudMix = THREE.MathUtils.clamp(objectDetail3D.cloudMix, 0, 1);
  objectDetail3D.ambientLight.intensity = THREE.MathUtils.lerp(
    OBJECT_DETAIL_AMBIENT_NO_LIGHT_INTENSITY,
    OBJECT_DETAIL_AMBIENT_INTENSITY,
    lightMix,
  );
  for (const item of objectDetail3D.spotLights) {
    item.light.intensity = OBJECT_DETAIL_LIGHT_INTENSITY * lightMix;
  }
  updateObjectDetailTintLightProperties(lightMix);
  if (objectDetail3D.cloudMaterial) {
    objectDetail3D.cloudMaterial.opacity = cloudMix;
  }
  if (objectDetail3D.cloudMesh) {
    objectDetail3D.cloudMesh.visible = cloudMix > 0.01;
    objectDetail3D.cloudMesh.castShadow = cloudMix > 0.04;
  }

  const changed =
    !objectDetail3D.optionMixApplied ||
    Math.abs(objectDetail3D.lightMix - previousLightMix) > OBJECT_DETAIL_RENDER_EPSILON ||
    Math.abs(objectDetail3D.cloudMix - previousCloudMix) > OBJECT_DETAIL_RENDER_EPSILON ||
    Math.abs(objectDetail3D.lightMix - (objectDetail3D.targetLightMix ?? 1)) > OBJECT_DETAIL_RENDER_EPSILON ||
    Math.abs(objectDetail3D.cloudMix - (objectDetail3D.targetCloudMix ?? 1)) > OBJECT_DETAIL_RENDER_EPSILON;
  objectDetail3D.optionMixApplied = true;
  return changed;
}

function updateObjectDetailTintLightProperties(lightMix = THREE.MathUtils.clamp(objectDetail3D?.lightMix ?? 1, 0, 1)) {
  if (!objectDetail3D?.spotLights) {
    return;
  }

  for (const item of objectDetail3D.spotLights) {
    item.tintLight.intensity = 0;
  }
  updateObjectDetailTintShaderUniforms(lightMix);
}

function updateObjectDetailTintShaderUniforms(lightMix = THREE.MathUtils.clamp(objectDetail3D?.lightMix ?? 1, 0, 1)) {
  if (!objectDetail3D?.spotLights?.length) {
    return;
  }

  const positions = objectDetail3D.spotLights
    .slice(0, 2)
    .map((item) => item.target.position);
  for (const shader of [
    objectDetail3D.material?.userData.detailSurfaceEffectShader,
    objectDetail3D.cloudMaterial?.userData.detailCloudClearShader,
  ]) {
    if (!shader?.uniforms?.detailTintLightPositions) {
      continue;
    }
    positions.forEach((position, index) => {
      shader.uniforms.detailTintLightPositions.value[index].set(position.x, position.y);
    });
    shader.uniforms.detailTintLightCount.value = positions.length;
    shader.uniforms.detailTintRadius.value = OBJECT_DETAIL_LIGHT_Z
      * Math.tan(THREE.MathUtils.degToRad(OBJECT_DETAIL_LIGHT_ANGLE_DEGREES))
      * OBJECT_DETAIL_TINT_RING_RADIUS_SCALE;
    shader.uniforms.detailTintWidth.value = OBJECT_DETAIL_TINT_RING_WIDTH;
    shader.uniforms.detailTintSoftness.value = OBJECT_DETAIL_TINT_RING_SOFTNESS;
    shader.uniforms.detailTintIntensity.value = OBJECT_DETAIL_TINT_LIGHT_INTENSITY * lightMix;
    shader.uniforms.detailTintBlend.value = OBJECT_DETAIL_TINT_RING_BLEND;
  }
}

function wrapObjectDetailLightX(x) {
  const rightEdge = OBJECT_DETAIL_SURFACE_WORLD_WIDTH / 2 + OBJECT_DETAIL_LIGHT_WRAP_MARGIN;
  const wrapSpan = OBJECT_DETAIL_SURFACE_WORLD_WIDTH * 2;
  let wrapped = x;
  while (wrapped > rightEdge) {
    wrapped -= wrapSpan;
  }
  return wrapped;
}

function applyObjectDetailCityNightMaterialEffects(material) {
  material.onBeforeCompile = (shader) => {
    shader.uniforms.detailCityNightTime = { value: 0 };
    shader.uniforms.detailCityNightLightPositions = { value: [new THREE.Vector2(-1, 0), new THREE.Vector2(1, 0)] };
    shader.uniforms.detailCityNightLightCount = { value: 0 };
    shader.uniforms.detailCityNightLightRadius = {
      value: OBJECT_DETAIL_LIGHT_Z
        * Math.tan(THREE.MathUtils.degToRad(OBJECT_DETAIL_LIGHT_ANGLE_DEGREES))
        * OBJECT_DETAIL_CITY_NIGHT_DAY_RADIUS_SCALE,
    };
    shader.uniforms.detailCityNightLightMix = { value: 1 };
    shader.uniforms.detailCityNightIntensity = { value: OBJECT_DETAIL_CITY_NIGHT_EMISSIVE_INTENSITY };
    shader.vertexShader = shader.vertexShader
      .replace(
        "#include <common>",
        `#include <common>
varying vec2 vDetailCityNightUv;
`,
      )
      .replace(
        "#include <uv_vertex>",
        `#include <uv_vertex>
vDetailCityNightUv = uv;
`,
      );
    shader.fragmentShader = shader.fragmentShader
      .replace(
        "#include <common>",
        `#include <common>
uniform float detailCityNightTime;
uniform vec2 detailCityNightLightPositions[2];
uniform float detailCityNightLightCount;
uniform float detailCityNightLightRadius;
uniform float detailCityNightLightMix;
uniform float detailCityNightIntensity;
varying vec2 vDetailCityNightUv;

float getDetailCityNightHash(vec2 point) {
  return fract(sin(dot(point, vec2(127.1, 311.7))) * 43758.5453123);
}
`,
      )
      .replace(
        "#include <dithering_fragment>",
        `vec2 detailCityNightWorldPosition = vec2((vDetailCityNightUv.x - 0.5) * ${OBJECT_DETAIL_SURFACE_WORLD_WIDTH.toFixed(1)}, vDetailCityNightUv.y - 0.5);
float detailCityNightDay = 0.0;
for (int index = 0; index < 2; index += 1) {
  if (float(index) >= detailCityNightLightCount) {
    break;
  }
  float lightDistance = distance(detailCityNightWorldPosition, detailCityNightLightPositions[index]);
  float daySpot = 1.0 - smoothstep(detailCityNightLightRadius * 0.42, detailCityNightLightRadius, lightDistance);
  detailCityNightDay = max(detailCityNightDay, daySpot);
}
float detailCityNightMix = smoothstep(0.2, 0.82, 1.0 - detailCityNightDay * detailCityNightLightMix) * detailCityNightLightMix;
float detailCityNightRedSignal = smoothstep(0.58, 0.95, gl_FragColor.r)
  * (1.0 - smoothstep(0.18, 0.36, gl_FragColor.g))
  * (1.0 - smoothstep(0.14, 0.34, gl_FragColor.b));
float detailCityNightBlueSignal = smoothstep(0.5, 0.95, gl_FragColor.b)
  * (1.0 - smoothstep(0.2, 0.48, gl_FragColor.r));
float detailCityNightPhase = getDetailCityNightHash(vDetailCityNightUv * vec2(1801.0, 997.0));
float detailCityNightRedSpeed = mix(0.42, 1.55, getDetailCityNightHash(vDetailCityNightUv * vec2(613.0, 337.0)));
float detailCityNightBlueSpeed = mix(0.18, 0.86, getDetailCityNightHash(vDetailCityNightUv * vec2(271.0, 941.0)));
float detailCityNightRedPulse = 0.5 + 0.5 * sin(detailCityNightTime * detailCityNightRedSpeed + detailCityNightPhase * 6.2831853);
float detailCityNightBluePulse = 0.5 + 0.5 * sin(detailCityNightTime * detailCityNightBlueSpeed + detailCityNightPhase * 12.5663706);
float detailCityNightFlicker = 1.0;
detailCityNightFlicker = mix(detailCityNightFlicker, mix(0.32, 1.18, detailCityNightRedPulse), detailCityNightRedSignal);
detailCityNightFlicker = mix(detailCityNightFlicker, mix(0.28, 1.32, detailCityNightBluePulse), detailCityNightBlueSignal);
float detailCityNightAlpha = gl_FragColor.a * detailCityNightMix * detailCityNightFlicker;
gl_FragColor.rgb *= detailCityNightIntensity * detailCityNightMix * detailCityNightFlicker;
gl_FragColor.a = detailCityNightAlpha;
#include <dithering_fragment>`,
      );
    material.userData.detailCityNightShader = shader;
  };
}

function updateObjectDetailCityNightUniforms(now = performance.now()) {
  const hexGrid = objectDetail3D?.hexGrid;
  const shader = hexGrid?.cityNightMaterial?.userData.detailCityNightShader;
  if (!shader) {
    return false;
  }

  shader.uniforms.detailCityNightTime.value = now * 0.001;
  shader.uniforms.detailCityNightLightMix.value = THREE.MathUtils.clamp(objectDetail3D.lightMix ?? 1, 0, 1);
  shader.uniforms.detailCityNightLightRadius.value = OBJECT_DETAIL_LIGHT_Z
    * Math.tan(THREE.MathUtils.degToRad(OBJECT_DETAIL_LIGHT_ANGLE_DEGREES))
    * OBJECT_DETAIL_CITY_NIGHT_DAY_RADIUS_SCALE;
  const positions = objectDetail3D.spotLights
    .slice(0, 2)
    .map((item) => item.target.position);
  positions.forEach((position, index) => {
    shader.uniforms.detailCityNightLightPositions.value[index].set(position.x, position.y);
  });
  shader.uniforms.detailCityNightLightCount.value = positions.length;
  shader.uniforms.detailCityNightIntensity.value = OBJECT_DETAIL_CITY_NIGHT_EMISSIVE_INTENSITY;
  return Boolean(hexGrid.cityNightLayerHasLights);
}

function createObjectDetailHexGrid(detail, renderer3D, surfaceOptions = {}) {
  const canvas = document.createElement("canvas");
  canvas.width = OBJECT_DETAIL_HEX_GRID_TEXTURE_WIDTH;
  canvas.height = OBJECT_DETAIL_HEX_GRID_TEXTURE_HEIGHT;
  const cityLayerCanvas = document.createElement("canvas");
  cityLayerCanvas.width = canvas.width;
  cityLayerCanvas.height = canvas.height;
  const cityNightLayerCanvas = document.createElement("canvas");
  cityNightLayerCanvas.width = canvas.width;
  cityNightLayerCanvas.height = canvas.height;
  const hexes = createObjectDetailHexes(canvas, detail.bodySizeRank);
  const state = getObjectDetailHexState(detail);
  resetObjectDetailHexWaterCache(detail, state);

  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.anisotropy = Math.min(8, renderer3D.capabilities.getMaxAnisotropy());
  texture.needsUpdate = true;

  const cityTexture = new THREE.CanvasTexture(cityLayerCanvas);
  cityTexture.colorSpace = THREE.SRGBColorSpace;
  cityTexture.anisotropy = Math.min(8, renderer3D.capabilities.getMaxAnisotropy());
  cityTexture.magFilter = THREE.NearestFilter;
  cityTexture.minFilter = THREE.NearestFilter;
  cityTexture.needsUpdate = true;

  const cityNightTexture = new THREE.CanvasTexture(cityNightLayerCanvas);
  cityNightTexture.colorSpace = THREE.SRGBColorSpace;
  cityNightTexture.anisotropy = Math.min(8, renderer3D.capabilities.getMaxAnisotropy());
  cityNightTexture.magFilter = THREE.NearestFilter;
  cityNightTexture.minFilter = THREE.NearestFilter;
  cityNightTexture.needsUpdate = true;

  const geometry = new THREE.PlaneGeometry(2, 1, 1, 1);
  const material = new THREE.MeshBasicMaterial({
    map: texture,
    transparent: true,
    depthWrite: false,
    depthTest: true,
    toneMapped: false,
  });
  const mesh = new THREE.Mesh(geometry, material);
  mesh.position.z = OBJECT_DETAIL_HEX_GRID_HEIGHT;
  mesh.renderOrder = 1.2;
  const cityGeometry = surfaceOptions.surfaceGeometry?.clone() ?? new THREE.PlaneGeometry(2, 1, 1, 1);
  const cityMaterial = new THREE.MeshLambertMaterial({
    map: cityTexture,
    displacementMap: surfaceOptions.heightMap ?? undefined,
    displacementScale: surfaceOptions.hasDisplacement ? OBJECT_DETAIL_DISPLACEMENT_SCALE : 0,
    displacementBias: surfaceOptions.hasDisplacement ? -0.035 : 0,
    transparent: true,
    alphaTest: 0.01,
    depthWrite: false,
    depthTest: true,
    polygonOffset: true,
    polygonOffsetFactor: -1,
    polygonOffsetUnits: -1,
    toneMapped: false,
  });
  const cityMesh = new THREE.Mesh(cityGeometry, cityMaterial);
  cityMesh.position.z = OBJECT_DETAIL_CITY_SURFACE_OFFSET;
  cityMesh.renderOrder = 1;
  cityMesh.receiveShadow = true;
  const cityNightGeometry = surfaceOptions.surfaceGeometry?.clone() ?? new THREE.PlaneGeometry(2, 1, 1, 1);
  const cityNightMaterial = new THREE.MeshStandardMaterial({
    color: 0x000000,
    map: cityNightTexture,
    emissive: 0xffffff,
    emissiveMap: cityNightTexture,
    emissiveIntensity: 1,
    displacementMap: surfaceOptions.heightMap ?? undefined,
    displacementScale: surfaceOptions.hasDisplacement ? OBJECT_DETAIL_DISPLACEMENT_SCALE : 0,
    displacementBias: surfaceOptions.hasDisplacement ? -0.035 : 0,
    transparent: true,
    alphaTest: 0.01,
    depthWrite: false,
    depthTest: true,
    blending: THREE.AdditiveBlending,
    polygonOffset: true,
    polygonOffsetFactor: -2,
    polygonOffsetUnits: -2,
    toneMapped: false,
    roughness: 1,
    metalness: 0,
  });
  applyObjectDetailCityNightMaterialEffects(cityNightMaterial);
  const cityNightMesh = new THREE.Mesh(cityNightGeometry, cityNightMaterial);
  cityNightMesh.position.z = OBJECT_DETAIL_CITY_NIGHT_SURFACE_OFFSET;
  cityNightMesh.renderOrder = 1.1;
  cityNightMesh.receiveShadow = false;
  const hexGrid = {
    canvas,
    cityLayerCanvas,
    cityTexture,
    cityGeometry,
    cityMaterial,
    cityMesh,
    cityNightLayerCanvas,
    cityNightTexture,
    cityNightGeometry,
    cityNightMaterial,
    cityNightMesh,
    cityNightLayerHasLights: false,
    cityLayerDirty: true,
    texture,
    geometry,
    material,
    mesh,
    hexes,
    state,
    detail,
    waterSampleData: null,
  };
  canvas.objectDetailHexes = hexes;
  canvas.dataset.hexCount = String(hexes.length);
  redrawObjectDetailHexGrid(hexGrid);
  return hexGrid;
}

function createObjectDetailHexes(canvas, bodySizeRank = 12) {
  const width = canvas.width;
  const height = canvas.height;
  const rank = THREE.MathUtils.clamp(Math.round(bodySizeRank), 0, 12);
  const columns = 7 + rank * 2;
  const horizontalPadding = width * 0.006;
  const hexRadius = (width - horizontalPadding * 2) / (1.5 * (columns - 1) + 2);
  const hexHeight = Math.sqrt(3) * hexRadius;
  const hexHalfHeight = hexHeight / 2;
  const horizontalStep = hexRadius * 1.5;
  const verticalStep = hexHeight;
  const rows = Math.max(1, Math.floor((height - hexHeight) / verticalStep) + 1);
  const startX = horizontalPadding + hexRadius;
  const gridHeight = hexHeight + Math.max(0, rows - 1) * verticalStep;
  const startY = hexHalfHeight + Math.max(0, (height - gridHeight) / 2);
  const hexes = [];

  for (let column = 0; column < columns; column += 1) {
    const centerX = startX + column * horizontalStep;
    const columnOffset = column % 2 === 0 ? 0 : verticalStep / 2;
    for (let row = 0; row < rows; row += 1) {
      const centerY = startY + row * verticalStep + columnOffset;
      if (!isObjectDetailHexFullyVisible(centerX, centerY, hexRadius, hexHalfHeight, width, height)) {
        continue;
      }
      const address = `${column}:${row}`;
      hexes.push({
        address,
        column,
        row,
        x: centerX / width,
        y: centerY / height,
        px: centerX,
        py: centerY,
        radius: hexRadius,
        halfHeight: hexHalfHeight,
      });
    }
  }
  return hexes;
}

function drawObjectDetailHexGrid(canvas, bodySizeRank = 12) {
  const hexes = createObjectDetailHexes(canvas, bodySizeRank);
  const context = canvas.getContext("2d");
  context.clearRect(0, 0, canvas.width, canvas.height);
  setObjectDetailHexStrokeStyle(context);
  for (const hex of hexes) {
    drawObjectDetailHex(context, hex.px, hex.py, hex.radius);
  }
  return hexes;
}

function setObjectDetailHexStrokeStyle(context) {
  context.lineJoin = "round";
  context.lineCap = "round";
  context.strokeStyle = "rgba(226, 226, 226, 0.34)";
  context.lineWidth = 1.15;
  context.shadowColor = "transparent";
  context.shadowBlur = 0;
}

function drawObjectDetailHex(context, centerX, centerY, radius) {
  context.beginPath();
  for (let index = 0; index < 6; index += 1) {
    const angle = THREE.MathUtils.degToRad(60 * index);
    const x = centerX + Math.cos(angle) * radius;
    const y = centerY + Math.sin(angle) * radius;
    if (index === 0) {
      context.moveTo(x, y);
    } else {
      context.lineTo(x, y);
    }
  }
  context.closePath();
  context.stroke();
}

function isObjectDetailHexFullyVisible(centerX, centerY, radius, halfHeight, width, height) {
  return centerX - radius >= 0
    && centerX + radius <= width
    && centerY - halfHeight >= 0
    && centerY + halfHeight <= height;
}

function getObjectDetailHexState(detail) {
  const state = detail.objectDetailHexState ?? {};
  const legacyCityStage = state.cityStage;
  state.buildings = normalizeObjectDetailBuildings(state.buildings, state.towns, legacyCityStage);
  delete state.cityStage;
  state.towns = getObjectDetailTownAddressSet(state.buildings);
  state.waterRatios = state.waterRatios instanceof Map ? state.waterRatios : new Map();
  state.cityPlacements = normalizeObjectDetailCityPlacements(state.cityPlacements);
  state.hoverAddress = state.hoverAddress ?? null;
  state.menuAddress = state.menuAddress ?? null;
  state.menuProgress = Number.isFinite(state.menuProgress) ? state.menuProgress : 0;
  state.menuTarget = Number.isFinite(state.menuTarget) ? state.menuTarget : 0;
  state.menuUpdatedAt = Number.isFinite(state.menuUpdatedAt) ? state.menuUpdatedAt : performance.now();
  detail.objectDetailHexState = state;
  return state;
}

function normalizeObjectDetailBuildings(buildings, legacyTowns = null, legacyStage = null) {
  const normalized = new Map();
  const addBuilding = (address, building) => {
    const normalizedBuilding = normalizeObjectDetailBuilding(address, building, legacyStage);
    if (normalizedBuilding) {
      normalized.set(normalizedBuilding.address, normalizedBuilding);
    }
  };

  if (buildings instanceof Map) {
    buildings.forEach((building, address) => addBuilding(address, building));
  } else if (Array.isArray(buildings)) {
    buildings.forEach((entry) => {
      if (Array.isArray(entry)) {
        addBuilding(entry[0], entry[1]);
      } else {
        addBuilding(entry?.address, entry);
      }
    });
  } else if (buildings && typeof buildings === "object") {
    Object.entries(buildings).forEach(([address, building]) => addBuilding(address, building));
  }

  const legacyTownAddresses = legacyTowns instanceof Set
    ? Array.from(legacyTowns)
    : Array.isArray(legacyTowns)
      ? legacyTowns
      : [];
  legacyTownAddresses.forEach((address) => {
    if (!normalized.has(address)) {
      normalized.set(address, createObjectDetailTownBuilding(address, legacyStage));
    }
  });

  return normalized;
}

function normalizeObjectDetailBuilding(address, building, fallbackStage = null) {
  const normalizedAddress = String(building?.address ?? address ?? "").trim();
  if (!normalizedAddress) {
    return null;
  }

  const type = String(building?.type ?? "town").trim().toLowerCase();
  const ownerSideId = normalizeObjectDetailOwnerSideId(
    building?.ownerSideId ?? building?.owner ?? building?.sideId ?? building?.state?.ownerSideId,
  );
  if (type === "town") {
    return {
      address: normalizedAddress,
      type: "town",
      ownerSideId,
      name: String(building?.name ?? "New Town"),
      population: Math.max(0, Math.floor(Number(building?.population ?? 0))),
      state: normalizeObjectDetailBuildingState(building, fallbackStage),
    };
  }

  return {
    address: normalizedAddress,
    type,
    ownerSideId,
    state: normalizeObjectDetailBuildingState(building, fallbackStage),
  };
}

function normalizeObjectDetailOwnerSideId(value) {
  const ownerSideId = String(value ?? "").trim();
  return ownerSideId || null;
}

function normalizeObjectDetailBuildingState(building, fallbackStage = null) {
  const source = building?.state && typeof building.state === "object"
    ? building.state
    : building;
  return {
    stage: normalizeObjectDetailCityStage(
      source?.stage ?? source?.cityStage ?? source?.state ?? fallbackStage ?? OBJECT_DETAIL_CITY_STAGE_MIN,
    ),
  };
}

function serializeObjectDetailBuildings(buildings) {
  return Array.from(normalizeObjectDetailBuildings(buildings).values())
    .map((building) => ({ ...building }));
}

function getObjectDetailTownAddressSet(buildings) {
  return new Set(
    Array.from(buildings.values())
      .filter((building) => building.type === "town")
      .map((building) => building.address),
  );
}

function getObjectDetailBuilding(state, address) {
  return state.buildings instanceof Map ? state.buildings.get(address) ?? null : null;
}

function isObjectDetailBuildingControlledByActiveSide(building) {
  const ownerSideId = normalizeObjectDetailOwnerSideId(building?.ownerSideId);
  return Boolean(ownerSideId && ownerSideId === getActiveGameSideId());
}

function createObjectDetailTownBuilding(address, stage = OBJECT_DETAIL_CITY_STAGE_MIN, ownerSideId = getActiveGameSideId()) {
  return {
    address,
    type: "town",
    ownerSideId: normalizeObjectDetailOwnerSideId(ownerSideId),
    name: "New Town",
    population: 0,
    state: {
      stage: normalizeObjectDetailCityStage(stage),
    },
  };
}

function setObjectDetailBuilding(hexGrid, address, building) {
  const normalized = normalizeObjectDetailBuilding(address, building);
  if (!normalized) {
    return;
  }

  if (!normalized.ownerSideId) {
    normalized.ownerSideId = getActiveGameSideId();
  }
  hexGrid.state.buildings.set(normalized.address, normalized);
  hexGrid.state.towns = getObjectDetailTownAddressSet(hexGrid.state.buildings);
}

function deleteObjectDetailBuilding(hexGrid, address) {
  hexGrid.state.buildings.delete(address);
  hexGrid.state.towns = getObjectDetailTownAddressSet(hexGrid.state.buildings);
}

function resetObjectDetailHexWaterCache(detail, state) {
  const waterCacheKey = [
    detail.textureCanvas?.width ?? 0,
    detail.textureCanvas?.height ?? 0,
    detail.waterMaskCanvas?.width ?? 0,
    detail.waterMaskCanvas?.height ?? 0,
    detail.waterPosition ?? 0,
    detail.freezeWater ? "ice" : "water",
  ].join(":");
  if (state.waterCacheKey === waterCacheKey) {
    return;
  }

  state.waterCacheKey = waterCacheKey;
  state.waterRatios = new Map();
  state.cityPlacements = new Map();
}

function redrawObjectDetailHexGrid(hexGrid) {
  if (!hexGrid?.canvas) {
    return;
  }

  const { canvas, hexes } = hexGrid;
  const context = canvas.getContext("2d");
  context.clearRect(0, 0, canvas.width, canvas.height);
  context.imageSmoothingEnabled = false;
  redrawObjectDetailCityLayer(hexGrid);

  const ownedHexOwners = getObjectDetailOwnedHexOwnerMap(hexGrid);
  drawObjectDetailOwnedHexFills(context, hexGrid, ownedHexOwners);
  setObjectDetailHexStrokeStyle(context);
  drawObjectDetailHexGridLines(context, hexes, ownedHexOwners);
  drawObjectDetailOwnedHexBoundaries(context, hexGrid, ownedHexOwners);

  drawObjectDetailBuildMenu(context, hexGrid);
  if (hexGrid.texture) {
    hexGrid.texture.needsUpdate = true;
  }
}

function getObjectDetailOwnedHexOwnerMap(hexGrid) {
  const ownerByAddress = new Map();
  if (!objectDetailOptions.borders) {
    return ownerByAddress;
  }

  for (const hex of hexGrid.hexes) {
    const building = getObjectDetailBuilding(hexGrid.state, hex.address);
    const ownerSideId = normalizeObjectDetailOwnerSideId(building?.ownerSideId);
    if (!ownerSideId) {
      continue;
    }
    ownerByAddress.set(hex.address, ownerSideId);
  }
  return ownerByAddress;
}

function drawObjectDetailOwnedHexFills(context, hexGrid, ownerByAddress) {
  if (!ownerByAddress?.size) {
    return;
  }

  for (const [ownerSideId, hexes] of getObjectDetailOwnedHexGroups(hexGrid, ownerByAddress)) {
    const ownerColor = getSideColorById(ownerSideId);
    context.save();
    context.beginPath();
    for (const hex of hexes) {
      appendObjectDetailHexPath(context, hex.px, hex.py, hex.radius);
    }
    context.fillStyle = hexToRgba(ownerColor, 0.08);
    context.fill();
    context.restore();
  }
}

function drawObjectDetailOwnedHexBoundaries(context, hexGrid, ownerByAddress) {
  if (!ownerByAddress?.size) {
    return;
  }

  for (const [ownerSideId, hexes] of getObjectDetailOwnedHexGroups(hexGrid, ownerByAddress)) {
    const ownerColor = getSideColorById(ownerSideId);
    let hasBoundary = false;
    context.save();
    context.beginPath();
    for (const hex of hexes) {
      for (let edgeIndex = 0; edgeIndex < 6; edgeIndex += 1) {
        const neighborAddress = getObjectDetailNeighborAddress(hex, edgeIndex);
        if (ownerByAddress.get(neighborAddress) === ownerSideId) {
          continue;
        }
        appendObjectDetailHexEdgePath(context, hex, edgeIndex);
        hasBoundary = true;
      }
    }
    if (!hasBoundary) {
      context.restore();
      continue;
    }
    context.strokeStyle = hexToRgba(ownerColor, 0.82);
    context.lineWidth = Math.max(1.6, hexes[0].radius * 0.045);
    context.lineJoin = "round";
    context.lineCap = "round";
    context.shadowColor = hexToRgba(ownerColor, 0.36);
    context.shadowBlur = Math.max(4, hexes[0].radius * 0.1);
    context.stroke();
    context.restore();
  }
}

function getObjectDetailOwnedHexGroups(hexGrid, ownerByAddress) {
  const groups = new Map();
  for (const hex of hexGrid.hexes) {
    const ownerSideId = ownerByAddress.get(hex.address);
    if (!ownerSideId) {
      continue;
    }
    if (!groups.has(ownerSideId)) {
      groups.set(ownerSideId, []);
    }
    groups.get(ownerSideId).push(hex);
  }
  return groups;
}

function drawObjectDetailHexGridLines(context, hexes, ownerByAddress = new Map()) {
  context.beginPath();
  for (const hex of hexes) {
    const ownerSideId = ownerByAddress.get(hex.address);
    const skippedEdges = [];
    for (let edgeIndex = 0; edgeIndex < 6; edgeIndex += 1) {
      const neighborAddress = getObjectDetailNeighborAddress(hex, edgeIndex);
      skippedEdges[edgeIndex] = Boolean(ownerSideId && ownerByAddress.get(neighborAddress) === ownerSideId);
    }
    if (!skippedEdges.some(Boolean)) {
      appendObjectDetailHexPath(context, hex.px, hex.py, hex.radius);
      continue;
    }

    for (let edgeIndex = 0; edgeIndex < 6; edgeIndex += 1) {
      if (!skippedEdges[edgeIndex]) {
        appendObjectDetailHexEdgePath(context, hex, edgeIndex);
      }
    }
  }
  context.stroke();
}

function getObjectDetailNeighborAddress(hex, edgeIndex) {
  const isOddColumn = hex.column % 2 === 1;
  switch (edgeIndex) {
    case 0:
      return `${hex.column + 1}:${hex.row + (isOddColumn ? 1 : 0)}`;
    case 1:
      return `${hex.column}:${hex.row + 1}`;
    case 2:
      return `${hex.column - 1}:${hex.row + (isOddColumn ? 1 : 0)}`;
    case 3:
      return `${hex.column - 1}:${hex.row - (isOddColumn ? 0 : 1)}`;
    case 4:
      return `${hex.column}:${hex.row - 1}`;
    case 5:
      return `${hex.column + 1}:${hex.row - (isOddColumn ? 0 : 1)}`;
    default:
      return "";
  }
}

function appendObjectDetailHexEdgePath(context, hex, edgeIndex) {
  const startAngle = THREE.MathUtils.degToRad(60 * edgeIndex);
  const endAngle = THREE.MathUtils.degToRad(60 * ((edgeIndex + 1) % 6));
  context.moveTo(
    hex.px + Math.cos(startAngle) * hex.radius,
    hex.py + Math.sin(startAngle) * hex.radius,
  );
  context.lineTo(
    hex.px + Math.cos(endAngle) * hex.radius,
    hex.py + Math.sin(endAngle) * hex.radius,
  );
}

function redrawObjectDetailCityLayer(hexGrid) {
  if (!hexGrid?.cityLayerCanvas || !hexGrid.cityLayerDirty) {
    return;
  }

  const { cityLayerCanvas, hexes, state } = hexGrid;
  const context = cityLayerCanvas.getContext("2d");
  context.clearRect(0, 0, cityLayerCanvas.width, cityLayerCanvas.height);
  context.imageSmoothingEnabled = false;
  const nightContext = hexGrid.cityNightLayerCanvas?.getContext("2d") ?? null;
  if (nightContext) {
    nightContext.clearRect(0, 0, hexGrid.cityNightLayerCanvas.width, hexGrid.cityNightLayerCanvas.height);
    nightContext.imageSmoothingEnabled = false;
  }
  const townDrawItems = [];
  let hasNightLights = false;
  for (const hex of hexes) {
    if (getObjectDetailBuilding(state, hex.address)?.type === "town") {
      const drawData = getObjectDetailTownDrawData(hex, hexGrid);
      if (drawData) {
        townDrawItems.push({ hex, drawData });
      }
    }
  }
  for (const { hex, drawData } of townDrawItems) {
    drawObjectDetailTownFoundation(context, hex, hexGrid, drawData);
  }
  for (const { hex, drawData } of townDrawItems) {
    hasNightLights = drawObjectDetailTownPixels(context, nightContext, hex, hexGrid, drawData) || hasNightLights;
  }
  if (hexGrid.cityTexture) {
    hexGrid.cityTexture.needsUpdate = true;
  }
  if (hexGrid.cityNightTexture) {
    hexGrid.cityNightTexture.needsUpdate = true;
  }
  hexGrid.cityNightLayerHasLights = hasNightLights;
  hexGrid.cityLayerDirty = false;
}

function markObjectDetailCityLayerDirty(hexGrid) {
  if (hexGrid) {
    hexGrid.cityLayerDirty = true;
  }
}

function traceObjectDetailHexPath(context, centerX, centerY, radius) {
  context.beginPath();
  appendObjectDetailHexPath(context, centerX, centerY, radius);
}

function appendObjectDetailHexPath(context, centerX, centerY, radius) {
  for (let index = 0; index < 6; index += 1) {
    const angle = THREE.MathUtils.degToRad(60 * index);
    const x = centerX + Math.cos(angle) * radius;
    const y = centerY + Math.sin(angle) * radius;
    if (index === 0) {
      context.moveTo(x, y);
    } else {
      context.lineTo(x, y);
    }
  }
  context.closePath();
}

function drawObjectDetailBuildMenu(context, hexGrid) {
  const { state } = hexGrid;
  const progress = THREE.MathUtils.clamp(state.menuProgress, 0, 1);
  if (!state.menuAddress || progress <= 0.001) {
    return;
  }

  const hex = getObjectDetailHexByAddress(hexGrid, state.menuAddress);
  if (!hex) {
    return;
  }

  const hasBuilding = Boolean(getObjectDetailBuilding(state, hex.address));
  const isBlocked = !hasBuilding && getObjectDetailHexWaterRatio(hexGrid, hex) > OBJECT_DETAIL_HEX_WATER_LIMIT;
  const easedProgress = easeOutCubic(progress);
  for (const option of getObjectDetailBuildMenuLayout(hexGrid, hex, easedProgress)) {
    drawObjectDetailBuildMenuOption(context, option, {
      alpha: progress,
      blocked: isBlocked,
      clickable: isObjectDetailMenuOptionClickable(hexGrid, hex, option, isBlocked),
    });
  }
}

function getObjectDetailBuildMenuLayout(hexGrid, hex, progress = 1) {
  const options = getObjectDetailRadialMenuOptions(hexGrid, hex);
  const distance = hex.radius * 0.78 * progress;
  const radius = Math.max(9, Math.min(15, hex.radius * 0.18));
  return options.map((option, index) => {
    const angle = -Math.PI / 2 + index * (Math.PI * 2 / options.length);
    return {
      ...option,
      x: hex.px + Math.cos(angle) * distance,
      y: hex.py + Math.sin(angle) * distance,
      radius,
    };
  });
}

function getObjectDetailRadialMenuOptions(hexGrid, hex) {
  return getObjectDetailBuilding(hexGrid.state, hex.address)
    ? OBJECT_DETAIL_DEMOLISH_MENU_OPTIONS
    : OBJECT_DETAIL_BUILD_MENU_OPTIONS;
}

function isObjectDetailMenuOptionClickable(hexGrid, hex, option, isBlocked) {
  const building = getObjectDetailBuilding(hexGrid.state, hex.address);
  const hasBuilding = Boolean(building);
  if (option.id === "demolish") {
    return hasBuilding && isObjectDetailBuildingControlledByActiveSide(building);
  }
  if (isBlocked || hasBuilding) {
    return false;
  }
  return option.id === "town";
}

function drawObjectDetailBuildMenuOption(context, option, { alpha, blocked, clickable }) {
  context.save();
  context.globalAlpha = alpha;
  context.shadowBlur = 0;
  context.beginPath();
  context.arc(option.x, option.y, option.radius, 0, Math.PI * 2);
  context.fillStyle = clickable
    ? "rgba(255, 255, 255, 0.14)"
    : "rgba(5, 5, 6, 0.74)";
  context.strokeStyle = blocked
    ? "rgba(255, 80, 80, 0.86)"
    : clickable
      ? "rgba(255, 255, 255, 0.9)"
      : "rgba(255, 255, 255, 0.32)";
  context.lineWidth = Math.max(1, option.radius * 0.08);
  context.fill();
  context.stroke();

  context.fillStyle = blocked
    ? "rgba(255, 96, 96, 0.88)"
    : clickable
      ? "rgba(255, 255, 255, 0.94)"
      : "rgba(255, 255, 255, 0.42)";
  context.font = `${Math.max(9, Math.round(option.radius * (option.label.length > 1 ? 0.74 : 0.86)))}px "Albert Sans", sans-serif`;
  context.textAlign = "center";
  context.textBaseline = "middle";
  context.fillText(option.label, option.x, option.y + 0.5);

  if (blocked) {
    const crossRadius = option.radius * 0.46;
    context.strokeStyle = "rgba(255, 52, 52, 0.95)";
    context.lineWidth = Math.max(1.4, option.radius * 0.12);
    context.beginPath();
    context.moveTo(option.x - crossRadius, option.y - crossRadius);
    context.lineTo(option.x + crossRadius, option.y + crossRadius);
    context.moveTo(option.x + crossRadius, option.y - crossRadius);
    context.lineTo(option.x - crossRadius, option.y + crossRadius);
    context.stroke();
  }
  context.restore();
}

function getObjectDetailTownDrawData(hex, hexGrid) {
  const sampleData = getObjectDetailWaterSampleData(hexGrid);
  const building = getObjectDetailBuilding(hexGrid.state, hex.address);
  const cityStage = getObjectDetailBuildingCityStage(building);
  const unit = Math.max(OBJECT_DETAIL_CITY_MIN_PIXEL_SIZE, Math.round(hex.radius / 26));
  const placement = getObjectDetailCityPlacementCenter(hexGrid, hex, sampleData);
  if (!placement) {
    return null;
  }

  const cityHex = { ...hex, px: placement.x, py: placement.y };
  return {
    cityHex,
    cityStage,
    maxGrowthDistance: getObjectDetailCityMaxGrowthDistance(hex, cityHex),
    sampleData,
    unit,
  };
}

function drawObjectDetailTownFoundation(context, hex, hexGrid, drawData) {
  const { cityHex, cityStage, maxGrowthDistance, sampleData, unit } = drawData;
  const margin = OBJECT_DETAIL_CITY_FOUNDATION_MARGIN_CELLS * unit;
  const foundationRadius = hex.radius * 1.72 + margin;
  const minX = Math.floor((cityHex.px - foundationRadius) / unit) * unit;
  const maxX = Math.ceil((cityHex.px + foundationRadius) / unit) * unit;
  const minY = Math.floor((cityHex.py - foundationRadius) / unit) * unit;
  const maxY = Math.ceil((cityHex.py + foundationRadius) / unit) * unit;

  context.save();
  context.shadowBlur = 0;
  context.globalCompositeOperation = "source-over";

  for (let y = minY; y <= maxY; y += unit) {
    for (let x = minX; x <= maxX; x += unit) {
      const centerX = x + unit * 0.5;
      const centerY = y + unit * 0.5;
      if (sampleData && isObjectDetailWaterSample(sampleData, hexGrid, centerX, centerY)) {
        continue;
      }

      const foundation = getObjectDetailCityFoundationMask(
        cityHex,
        hex,
        centerX,
        centerY,
        maxGrowthDistance,
        cityStage,
      );
      if (foundation.mask <= 0) {
        continue;
      }

      const cellX = Math.floor(centerX / unit);
      const cellY = Math.floor(centerY / unit);
      if (foundation.edge > 0 && getObjectDetailSurfaceCityRoadMask(cellX, cellY) <= OBJECT_DETAIL_CITY_ROAD_CUT_THRESHOLD) {
        continue;
      }

      drawObjectDetailCityFoundationPixel(context, x, y, unit, cellX, cellY, foundation.mask);
    }
  }

  context.restore();
}

function drawObjectDetailTownPixels(context, nightContext, hex, hexGrid, drawData) {
  const { cityHex, cityStage, maxGrowthDistance, sampleData, unit } = drawData;
  const minX = Math.floor((hex.px - hex.radius) / unit) * unit;
  const maxX = Math.ceil((hex.px + hex.radius) / unit) * unit;
  const minY = Math.floor((hex.py - hex.halfHeight) / unit) * unit;
  const maxY = Math.ceil((hex.py + hex.halfHeight) / unit) * unit;
  let hasNightLights = false;

  context.save();
  context.shadowBlur = 0;
  context.globalCompositeOperation = "source-over";
  traceObjectDetailHexPath(context, hex.px, hex.py, hex.radius);
  context.clip();

  for (let y = minY; y <= maxY; y += unit) {
    for (let x = minX; x <= maxX; x += unit) {
      const centerX = x + unit * 0.5;
      const centerY = y + unit * 0.5;
      if (!isPointInObjectDetailHex(centerX, centerY, hex)) {
        continue;
      }
      if (sampleData && isObjectDetailWaterSample(sampleData, hexGrid, centerX, centerY)) {
        continue;
      }

      const mask = getObjectDetailCityMask(cityHex, hex, centerX, centerY, maxGrowthDistance, cityStage);
      if (mask <= 0) {
        continue;
      }

      const cellX = Math.floor(centerX / unit);
      const cellY = Math.floor(centerY / unit);
      if (getObjectDetailSurfaceCityRoadMask(cellX, cellY) > OBJECT_DETAIL_CITY_ROAD_CUT_THRESHOLD) {
        continue;
      }

      drawObjectDetailCityPixel(context, x, y, unit, cellX, cellY, mask);
      if (nightContext) {
        hasNightLights = drawObjectDetailCityNightLight(nightContext, x, y, unit, cellX, cellY, mask) || hasNightLights;
      }
    }
  }

  context.restore();
  return hasNightLights;
}

function normalizeObjectDetailCityPlacements(cityPlacements) {
  if (cityPlacements instanceof Map) {
    return cityPlacements;
  }

  if (Array.isArray(cityPlacements)) {
    return new Map(cityPlacements);
  }

  return new Map(Object.entries(cityPlacements ?? {}));
}

function getObjectDetailCityPlacementCenter(hexGrid, hex, sampleData) {
  const cached = hexGrid.state.cityPlacements.get(hex.address);
  if (cached && Number.isFinite(cached.x) && Number.isFinite(cached.y)) {
    return cached;
  }

  const placement = createObjectDetailCityPlacement(hexGrid, hex, sampleData);
  if (placement) {
    hexGrid.state.cityPlacements.set(hex.address, placement);
  }
  return placement;
}

function createObjectDetailCityPlacement(hexGrid, hex, sampleData) {
  for (let index = 0; index < 18; index += 1) {
    const angle = hashObjectDetailCityCell(hex.column, hex.row, 1601 + index) * Math.PI * 2;
    const distance = hex.radius * (0.08 + hashObjectDetailCityCell(hex.row, hex.column, 1701 + index) * 0.54);
    const x = hex.px + Math.cos(angle) * distance;
    const y = hex.py + Math.sin(angle) * distance * 0.86;
    if (!isPointInObjectDetailHex(x, y, hex)) {
      continue;
    }
    if (sampleData && isObjectDetailWaterSample(sampleData, hexGrid, x, y)) {
      continue;
    }
    return { x, y };
  }

  const scanStep = hex.radius * 0.14;
  for (let yIndex = -3; yIndex <= 3; yIndex += 1) {
    for (let xIndex = -3; xIndex <= 3; xIndex += 1) {
      const x = hex.px + xIndex * scanStep;
      const y = hex.py + yIndex * scanStep;
      if (!isPointInObjectDetailHex(x, y, hex)) {
        continue;
      }
      if (sampleData && isObjectDetailWaterSample(sampleData, hexGrid, x, y)) {
        continue;
      }

      return { x, y };
    }
  }

  return null;
}

function drawObjectDetailCityPixel(context, x, y, unit, cellX, cellY, mask) {
  const toneNoise = hashObjectDetailCityCell(cellX, cellY, 73);
  const tone = Math.floor(42 + toneNoise * 82 + mask * 18);
  context.fillStyle = `rgb(${tone}, ${tone}, ${tone})`;
  context.fillRect(
    Math.round(x),
    Math.round(y),
    Math.max(1, Math.round(unit)),
    Math.max(1, Math.round(unit)),
  );
}

function drawObjectDetailCityFoundationPixel(context, x, y, unit, cellX, cellY, mask) {
  const toneNoise = hashObjectDetailCityCell(cellX, cellY, 83);
  const tone = Math.floor(18 + toneNoise * 42 + mask * 10);
  context.fillStyle = `rgb(${tone}, ${tone}, ${tone})`;
  context.fillRect(
    Math.round(x),
    Math.round(y),
    Math.max(1, Math.round(unit)),
    Math.max(1, Math.round(unit)),
  );
}

function drawObjectDetailCityNightLight(context, x, y, unit, cellX, cellY, mask) {
  const chance = OBJECT_DETAIL_CITY_NIGHT_LIGHT_CHANCE * THREE.MathUtils.clamp(mask + 0.15, 0.25, 1.15);
  if (hashObjectDetailCityCell(cellX, cellY, 3101) > chance) {
    return false;
  }

  const colorRoll = hashObjectDetailCityCell(cellX, cellY, 3103);
  const colorJitter = hashObjectDetailCityCell(cellX, cellY, 3105);
  let red = 255;
  let green = Math.floor(154 + colorJitter * 82);
  let blue = Math.floor(46 + hashObjectDetailCityCell(cellX, cellY, 3107) * 46);
  let alpha = Math.floor(145 + hashObjectDetailCityCell(cellX, cellY, 3109) * 80);
  let canStrip = true;

  if (colorRoll < 0.018) {
    red = Math.floor(76 + colorJitter * 34);
    green = Math.floor(132 + hashObjectDetailCityCell(cellX, cellY, 3111) * 48);
    blue = 255;
    alpha = Math.floor(130 + hashObjectDetailCityCell(cellX, cellY, 3113) * 78);
    canStrip = false;
  } else if (colorRoll < 0.075) {
    red = 255;
    green = Math.floor(38 + colorJitter * 42);
    blue = Math.floor(28 + hashObjectDetailCityCell(cellX, cellY, 3115) * 24);
    alpha = Math.floor(126 + hashObjectDetailCityCell(cellX, cellY, 3117) * 74);
    canStrip = false;
  }

  const drawX = Math.round(x + hashObjectDetailCityCell(cellX, cellY, 3121) * Math.max(1, unit - 1));
  const drawY = Math.round(y + hashObjectDetailCityCell(cellX, cellY, 3123) * Math.max(1, unit - 1));
  context.fillStyle = `rgba(${red}, ${green}, ${blue}, ${(alpha / 255).toFixed(3)})`;

  if (canStrip && hashObjectDetailCityCell(cellX, cellY, 3125) < OBJECT_DETAIL_CITY_NIGHT_ORANGE_STRIP_CHANCE) {
    const length = 2 + Math.floor(hashObjectDetailCityCell(cellX, cellY, 3127) * Math.max(1, unit));
    if (hashObjectDetailCityCell(cellX, cellY, 3129) < 0.5) {
      context.fillRect(drawX, drawY, Math.max(2, length), 1);
    } else {
      context.fillRect(drawX, drawY, 1, Math.max(2, length));
    }
    return true;
  }

  context.fillRect(drawX, drawY, 1, 1);
  return true;
}

function getObjectDetailBuildingCityStage(building) {
  return normalizeObjectDetailCityStage(building?.state?.stage ?? building?.stage);
}

function normalizeObjectDetailCityStage(stage) {
  return THREE.MathUtils.clamp(
    Number.isFinite(stage) ? Math.round(stage) : OBJECT_DETAIL_CITY_STAGE_MIN,
    OBJECT_DETAIL_CITY_STAGE_MIN,
    OBJECT_DETAIL_CITY_STAGE_MAX,
  );
}

function getObjectDetailCityMaxGrowthDistance(hex, cityHex) {
  let distance = 1;
  for (let index = 0; index < 6; index += 1) {
    const angle = THREE.MathUtils.degToRad(60 * index);
    const cornerX = hex.px + Math.cos(angle) * hex.radius;
    const cornerY = hex.py + Math.sin(angle) * hex.radius;
    distance = Math.max(distance, Math.hypot(cornerX - cityHex.px, cornerY - cityHex.py));
  }
  return distance;
}

function getObjectDetailCityMask(hex, originalHex, x, y, maxGrowthDistance, stage) {
  if (stage >= OBJECT_DETAIL_CITY_STAGE_MAX) {
    return 1;
  }

  const requiredGrowth = getObjectDetailCityRequiredGrowth(hex, originalHex, x, y, maxGrowthDistance);
  const growth = getObjectDetailCityStageThreshold(stage);
  if (requiredGrowth > growth) {
    return 0;
  }

  return THREE.MathUtils.clamp(0.45 + (growth - requiredGrowth) * 0.8, 0.35, 1);
}

function getObjectDetailCityFoundationMask(hex, originalHex, x, y, maxGrowthDistance, stage) {
  const growth = getObjectDetailCityStageThreshold(stage);
  const requiredGrowth = getObjectDetailCityRequiredGrowth(hex, originalHex, x, y, maxGrowthDistance);
  const footprint = getObjectDetailCityFoundationFootprint(hex, originalHex, x, y);
  const margin = OBJECT_DETAIL_CITY_FOUNDATION_GROWTH_MARGIN + footprint.margin;
  if (requiredGrowth > growth + margin || footprint.mask <= 0) {
    return { mask: 0, edge: 0 };
  }

  const edge = requiredGrowth > growth || footprint.edge > 0 ? 1 : 0;
  return {
    mask: THREE.MathUtils.clamp((0.52 + (growth + margin - requiredGrowth) * 0.8) * footprint.mask, 0.34, 1),
    edge,
  };
}

function getObjectDetailCityFoundationFootprint(hex, originalHex, x, y) {
  const dx = x - hex.px;
  const dy = y - hex.py;
  const distance = Math.hypot(dx, dy);
  const angle = Math.atan2(dy, dx);
  const normalizedDistance = distance / Math.max(1, originalHex.radius);
  const directionA = Math.cos(angle * 5.0 + hashObjectDetailCityCell(originalHex.column, originalHex.row, 4101) * Math.PI * 2);
  const directionB = Math.sin(angle * 9.0 + hashObjectDetailCityCell(originalHex.row, originalHex.column, 4103) * Math.PI * 2);
  const coarse = hashObjectDetailCityCell(
    Math.floor((x + directionA * 17) / 29),
    Math.floor((y + directionB * 17) / 29),
    4111,
  ) - 0.5;
  const medium = hashObjectDetailCityCell(Math.floor(x / 13), Math.floor(y / 13), 4117) - 0.5;
  const fine = hashObjectDetailCityCell(Math.floor(x / 5), Math.floor(y / 5), 4121) - 0.5;
  const radial = directionA * 0.13 + directionB * 0.09 + coarse * 0.24 + medium * 0.12 + fine * 0.05;
  const edgeLimit = 1.04 + radial;
  const outerLimit = edgeLimit + OBJECT_DETAIL_CITY_FOUNDATION_EDGE_WIDTH;
  if (normalizedDistance > outerLimit) {
    return { mask: 0, edge: 0, margin: 0 };
  }

  const edge = normalizedDistance > edgeLimit ? 1 : 0;
  return {
    mask: edge ? 1 - THREE.MathUtils.smoothstep(edgeLimit, outerLimit, normalizedDistance) * 0.45 : 1,
    edge,
    margin: Math.max(0, edgeLimit - 0.95) * 0.1,
  };
}

function getObjectDetailCityRequiredGrowth(hex, originalHex, x, y, maxGrowthDistance) {
  const dx = x - hex.px;
  const dy = y - hex.py;
  const originDistance = Math.hypot(dx, dy);
  const originNorm = originDistance / Math.max(1, maxGrowthDistance);
  const centerDistance = Math.hypot(x - originalHex.px, y - originalHex.py);
  const centerNorm = THREE.MathUtils.clamp(centerDistance / originalHex.radius, 0, 1.25);
  const centerVectorX = originalHex.px - hex.px;
  const centerVectorY = originalHex.py - hex.py;
  const centerVectorLength = Math.hypot(centerVectorX, centerVectorY);
  const pointVectorLength = Math.max(1, originDistance);
  const centerDirection = centerVectorLength > 0.001
    ? THREE.MathUtils.clamp(
      (dx * centerVectorX + dy * centerVectorY) / (pointVectorLength * centerVectorLength),
      -1,
      1,
    )
    : 0;
  const coarse = hashObjectDetailCityCell(Math.floor(x / 11), Math.floor(y / 11), 503) - 0.5;
  const fine = hashObjectDetailCityCell(Math.floor(x / 5), Math.floor(y / 5), 509) - 0.5;
  const irregularity = coarse * 0.2 + fine * 0.12;
  const centerBias = Math.max(0, centerDirection) * (0.16 + (1 - centerNorm) * 0.1);
  return Math.max(
    0,
    originNorm + centerNorm * 0.12 + Math.max(0, -centerDirection) * 0.1 - centerBias + irregularity,
  );
}

function getObjectDetailCityStageThreshold(stage) {
  const index = normalizeObjectDetailCityStage(stage) - OBJECT_DETAIL_CITY_STAGE_MIN;
  return OBJECT_DETAIL_CITY_STAGE_THRESHOLDS[index] ?? OBJECT_DETAIL_CITY_STAGE_THRESHOLDS[0];
}

function getObjectDetailSurfaceCityRoadMask(cellX, cellY) {
  if (isObjectDetailHorizontalRoadCell(cellX, cellY)) {
    return 1;
  }
  if (isObjectDetailVerticalRoadCell(cellX, cellY)) {
    return 1;
  }
  if (isObjectDetailDiagonalRoadCell(cellX, cellY, 1)) {
    return 1;
  }
  if (isObjectDetailDiagonalRoadCell(cellX, cellY, -1)) {
    return 1;
  }
  return 0;
}

function isObjectDetailHorizontalRoadCell(cellX, cellY) {
  if (!isObjectDetailRoadLineActive(cellY, 2201, 0.34)) {
    return false;
  }
  return isObjectDetailFiniteRoadSegment(cellY, cellX, 2211, 5, 12, 2, 6, 0.9);
}

function isObjectDetailVerticalRoadCell(cellX, cellY) {
  if (!isObjectDetailRoadLineActive(cellX, 2301, 0.34)) {
    return false;
  }
  return isObjectDetailFiniteRoadSegment(cellX, cellY, 2311, 5, 12, 2, 6, 0.9);
}

function isObjectDetailDiagonalRoadCell(cellX, cellY, direction) {
  const lineKey = direction > 0 ? cellX + cellY : cellX - cellY;
  if (!isObjectDetailRoadLineActive(lineKey, direction > 0 ? 2401 : 2501, 0.22)) {
    return false;
  }
  return isObjectDetailFiniteRoadSegment(lineKey, cellX, direction > 0 ? 2411 : 2511, 4, 10, 3, 7, 0.78);
}

function isObjectDetailRoadLineActive(lineKey, salt, chance) {
  return hashObjectDetailCityCell(lineKey, salt, salt + 17) < chance;
}

function isObjectDetailFiniteRoadSegment(lineKey, along, salt, minSegment, maxSegment, minGap, maxGap, chance) {
  const segmentLength = minSegment + Math.floor(hashObjectDetailCityCell(lineKey, 0, salt) * (maxSegment - minSegment + 1));
  const gapLength = minGap + Math.floor(hashObjectDetailCityCell(lineKey, 0, salt + 1) * (maxGap - minGap + 1));
  const period = Math.max(1, segmentLength + gapLength);
  const offset = Math.floor(hashObjectDetailCityCell(lineKey, 0, salt + 2) * period);
  const shiftedAlong = along + offset;
  const segmentIndex = Math.floor(shiftedAlong / period);
  if (hashObjectDetailCityCell(lineKey, segmentIndex, salt + 3) > chance) {
    return false;
  }
  return getPositiveObjectDetailModulo(shiftedAlong, period) < segmentLength;
}

function getPositiveObjectDetailModulo(value, divisor) {
  return ((value % divisor) + divisor) % divisor;
}

function hashObjectDetailSeedString(seed) {
  let hash = 2166136261;
  for (let index = 0; index < seed.length; index += 1) {
    hash ^= seed.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }
  return hash >>> 0;
}

function hashObjectDetailCityCell(x, y, salt = 0) {
  let hash = Math.imul((x ^ OBJECT_DETAIL_CITY_SEED_HASH) ^ 0x9e3779b9, 0x85ebca6b);
  hash ^= Math.imul(y ^ 0xc2b2ae35, 0x27d4eb2d);
  hash ^= Math.imul(salt ^ 0x165667b1, 0x9e3779b1);
  hash ^= hash >>> 16;
  hash = Math.imul(hash, 0x7feb352d);
  hash ^= hash >>> 15;
  hash = Math.imul(hash, 0x846ca68b);
  hash ^= hash >>> 16;
  return (hash >>> 0) / 4294967295;
}

function getObjectDetailHexByAddress(hexGrid, address) {
  return hexGrid.hexes.find((hex) => hex.address === address) ?? null;
}

function getObjectDetailHexWaterRatio(hexGrid, hex) {
  const { state } = hexGrid;
  if (state.waterRatios.has(hex.address)) {
    return state.waterRatios.get(hex.address);
  }

  const ratio = computeObjectDetailHexWaterRatio(hexGrid, hex);
  state.waterRatios.set(hex.address, ratio);
  return ratio;
}

function computeObjectDetailHexWaterRatio(hexGrid, hex) {
  const detail = hexGrid.detail;
  if (detail.kind !== "PLANET" || !(detail.waterPosition > 0)) {
    return 0;
  }

  const sampleData = getObjectDetailWaterSampleData(hexGrid);
  if (!sampleData) {
    return 0;
  }

  let sampleCount = 0;
  let waterCount = 0;
  const sampleSteps = OBJECT_DETAIL_HEX_WATER_SAMPLE_GRID;
  for (let yIndex = 0; yIndex < sampleSteps; yIndex += 1) {
    const y = hex.py - hex.halfHeight + (hex.halfHeight * 2 * yIndex) / Math.max(1, sampleSteps - 1);
    for (let xIndex = 0; xIndex < sampleSteps; xIndex += 1) {
      const x = hex.px - hex.radius + (hex.radius * 2 * xIndex) / Math.max(1, sampleSteps - 1);
      if (!isPointInObjectDetailHex(x, y, hex)) {
        continue;
      }
      sampleCount += 1;
      if (isObjectDetailWaterSample(sampleData, hexGrid, x, y)) {
        waterCount += 1;
      }
    }
  }

  return sampleCount > 0 ? waterCount / sampleCount : 0;
}

function getObjectDetailWaterSampleData(hexGrid) {
  if (hexGrid.waterSampleData !== null) {
    return hexGrid.waterSampleData;
  }

  const detail = hexGrid.detail;
  if (!detail.textureCanvas) {
    hexGrid.waterSampleData = null;
    return null;
  }

  const textureContext = detail.textureCanvas.getContext("2d", { willReadFrequently: true });
  const textureImage = textureContext.getImageData(0, 0, detail.textureCanvas.width, detail.textureCanvas.height);
  const waterImage = detail.waterMaskCanvas
    ? detail.waterMaskCanvas
      .getContext("2d", { willReadFrequently: true })
      .getImageData(0, 0, detail.waterMaskCanvas.width, detail.waterMaskCanvas.height)
    : null;
  hexGrid.waterSampleData = {
    textureImage,
    textureWidth: detail.textureCanvas.width,
    textureHeight: detail.textureCanvas.height,
    waterImage,
    waterWidth: detail.waterMaskCanvas?.width ?? 0,
    waterHeight: detail.waterMaskCanvas?.height ?? 0,
  };
  return hexGrid.waterSampleData;
}

function isObjectDetailWaterSample(sampleData, hexGrid, canvasX, canvasY) {
  const u = THREE.MathUtils.clamp(canvasX / hexGrid.canvas.width, 0, 1);
  const v = THREE.MathUtils.clamp(canvasY / hexGrid.canvas.height, 0, 1);
  const textureX = Math.min(sampleData.textureWidth - 1, Math.max(0, Math.floor(u * sampleData.textureWidth)));
  const textureY = Math.min(sampleData.textureHeight - 1, Math.max(0, Math.floor(v * sampleData.textureHeight)));
  const textureOffset = (textureY * sampleData.textureWidth + textureX) * 4;
  const textureData = sampleData.textureImage.data;

  if (sampleData.waterImage) {
    const waterX = Math.min(sampleData.waterWidth - 1, Math.max(0, Math.floor(u * sampleData.waterWidth)));
    const waterY = Math.min(sampleData.waterHeight - 1, Math.max(0, Math.floor(v * sampleData.waterHeight)));
    const waterOffset = (waterY * sampleData.waterWidth + waterX) * 4;
    if (sampleData.waterImage.data[waterOffset] < 128) {
      return false;
    }
    return !isObjectDetailIceLikePixel(textureData, textureOffset);
  }

  return isObjectDetailLikelyWaterPixel(textureData, textureOffset);
}

function isObjectDetailIceLikePixel(data, offset) {
  const red = data[offset];
  const green = data[offset + 1];
  const blue = data[offset + 2];
  const max = Math.max(red, green, blue);
  const min = Math.min(red, green, blue);
  const luminance = red * 0.2126 + green * 0.7152 + blue * 0.0722;
  return luminance > 154 && (max - min < 58 || (blue >= red && blue >= green && luminance > 184));
}

function isObjectDetailLikelyWaterPixel(data, offset) {
  const red = data[offset];
  const green = data[offset + 1];
  const blue = data[offset + 2];
  const max = Math.max(red, green, blue);
  const min = Math.min(red, green, blue);
  const luminance = red * 0.2126 + green * 0.7152 + blue * 0.0722;
  if (isObjectDetailIceLikePixel(data, offset)) {
    return false;
  }
  return blue > red * 1.08 && blue >= green * 0.88 && max - min > 18 && luminance < 176;
}

function isPointInObjectDetailHex(x, y, hex) {
  let inside = false;
  let previousX = hex.px + Math.cos(THREE.MathUtils.degToRad(300)) * hex.radius;
  let previousY = hex.py + Math.sin(THREE.MathUtils.degToRad(300)) * hex.radius;
  for (let index = 0; index < 6; index += 1) {
    const angle = THREE.MathUtils.degToRad(60 * index);
    const currentX = hex.px + Math.cos(angle) * hex.radius;
    const currentY = hex.py + Math.sin(angle) * hex.radius;
    if (((currentY > y) !== (previousY > y)) &&
      x < ((previousX - currentX) * (y - currentY)) / (previousY - currentY) + currentX) {
      inside = !inside;
    }
    previousX = currentX;
    previousY = currentY;
  }
  return inside;
}

function createObjectDetailTintUniforms(tintColor) {
  return {
    detailTintColor: { value: new THREE.Color(tintColor ?? "#ffffff") },
    detailTintLightPositions: { value: [new THREE.Vector2(-1, 0), new THREE.Vector2(1, 0)] },
    detailTintLightCount: { value: 0 },
    detailTintRadius: {
      value: OBJECT_DETAIL_LIGHT_Z
        * Math.tan(THREE.MathUtils.degToRad(OBJECT_DETAIL_LIGHT_ANGLE_DEGREES))
        * OBJECT_DETAIL_TINT_RING_RADIUS_SCALE,
    },
    detailTintWidth: { value: OBJECT_DETAIL_TINT_RING_WIDTH },
    detailTintSoftness: { value: OBJECT_DETAIL_TINT_RING_SOFTNESS },
    detailTintIntensity: { value: OBJECT_DETAIL_TINT_LIGHT_INTENSITY },
    detailTintBlend: { value: OBJECT_DETAIL_TINT_RING_BLEND },
  };
}

function getObjectDetailTintShaderHeader() {
  return `
uniform vec3 detailTintColor;
uniform vec2 detailTintLightPositions[2];
uniform float detailTintLightCount;
uniform float detailTintRadius;
uniform float detailTintWidth;
uniform float detailTintSoftness;
uniform float detailTintIntensity;
uniform float detailTintBlend;

float getDetailTintRing(vec2 worldPosition) {
  float ring = 0.0;
  for (int index = 0; index < 2; index += 1) {
    if (float(index) >= detailTintLightCount) {
      break;
    }
    float distanceToLight = distance(worldPosition, detailTintLightPositions[index]);
    float inner = smoothstep(
      detailTintRadius - detailTintWidth - detailTintSoftness,
      detailTintRadius - detailTintWidth,
      distanceToLight
    );
    float outer = 1.0 - smoothstep(
      detailTintRadius,
      detailTintRadius + detailTintSoftness,
      distanceToLight
    );
    ring = max(ring, inner * outer);
  }
  return clamp(ring * detailTintIntensity, 0.0, 1.0);
}

vec3 applyDetailTintRing(vec3 baseColor, vec2 worldPosition) {
  float ring = getDetailTintRing(worldPosition);
  vec3 tinted = mix(baseColor, baseColor + detailTintColor * detailTintBlend, ring);
  return tinted;
}
`;
}

function applyObjectDetailSurfaceEffects(material, cloudMap, hasCloudShadow) {
  material.onBeforeCompile = (shader) => {
    shader.uniforms.detailCloudShadowMap = { value: cloudMap };
    shader.uniforms.detailHasCloudShadow = { value: hasCloudShadow ? 1 : 0 };
    shader.uniforms.detailCloudShadowTextureOffset = { value: new THREE.Vector2(0, 0) };
    shader.uniforms.detailCloudShadowOffset = {
      value: new THREE.Vector2(OBJECT_DETAIL_CLOUD_SHADOW_OFFSET_U, OBJECT_DETAIL_CLOUD_SHADOW_OFFSET_V),
    };
    shader.uniforms.detailCloudShadowStrength = { value: OBJECT_DETAIL_CLOUD_SHADOW_STRENGTH };
    shader.uniforms.detailCloudShadowDarken = { value: OBJECT_DETAIL_CLOUD_SHADOW_DARKEN };
    shader.uniforms.detailCursorUv = { value: new THREE.Vector2(0.5, 0.5) };
    shader.uniforms.detailCursorActive = { value: 0 };
    shader.uniforms.detailCursorClearRadius = { value: OBJECT_DETAIL_CURSOR_CLEAR_RADIUS };
    shader.uniforms.detailCursorClearFeather = { value: OBJECT_DETAIL_CURSOR_CLEAR_FEATHER };
    shader.uniforms.detailLightMaxChannel = { value: OBJECT_DETAIL_LIGHT_MAX_CHANNEL };
    shader.vertexShader = shader.vertexShader
      .replace(
        "#include <common>",
        `#include <common>
varying vec2 vDetailCloudShadowUv;
`,
      )
      .replace(
        "#include <project_vertex>",
        `vDetailCloudShadowUv = uv;
#include <project_vertex>`,
      );
    shader.fragmentShader = shader.fragmentShader
      .replace(
        "#include <common>",
        `#include <common>
uniform sampler2D detailCloudShadowMap;
uniform float detailHasCloudShadow;
uniform vec2 detailCloudShadowTextureOffset;
uniform vec2 detailCloudShadowOffset;
uniform float detailCloudShadowStrength;
uniform float detailCloudShadowDarken;
uniform vec2 detailCursorUv;
uniform float detailCursorActive;
uniform float detailCursorClearRadius;
uniform float detailCursorClearFeather;
uniform float detailLightMaxChannel;
varying vec2 vDetailCloudShadowUv;
`,
      )
      .replace(
        "#include <dithering_fragment>",
        `vec2 detailAspectUv = vec2((vDetailCloudShadowUv.x - detailCursorUv.x) * 2.0, vDetailCloudShadowUv.y - detailCursorUv.y);
float detailCursorDistance = length(detailAspectUv);
float detailCursorClear = mix(1.0, smoothstep(detailCursorClearRadius, detailCursorClearRadius + detailCursorClearFeather, detailCursorDistance), detailCursorActive);
float detailCloudShadowAlpha = texture2D(detailCloudShadowMap, vDetailCloudShadowUv + detailCloudShadowTextureOffset + detailCloudShadowOffset).a * detailCursorClear;
float detailCloudShadow = clamp(detailCloudShadowAlpha * detailCloudShadowStrength * detailHasCloudShadow, 0.0, 1.0);
gl_FragColor.rgb = mix(gl_FragColor.rgb, gl_FragColor.rgb * detailCloudShadowDarken, detailCloudShadow);
float detailLightMax = max(max(gl_FragColor.r, gl_FragColor.g), gl_FragColor.b);
if (detailLightMax > detailLightMaxChannel) {
  gl_FragColor.rgb *= detailLightMaxChannel / detailLightMax;
}
#include <dithering_fragment>`,
      );
    material.userData.detailSurfaceEffectShader = shader;
    updateObjectDetailSurfaceEffectUniforms();
  };
}

function applyObjectDetailCloudClear(material, tintColor, hasAtmosphereTint) {
  material.onBeforeCompile = (shader) => {
    Object.assign(shader.uniforms, createObjectDetailTintUniforms(tintColor));
    shader.uniforms.detailHasAtmosphereTint = { value: hasAtmosphereTint ? 1 : 0 };
    shader.uniforms.detailCursorUv = { value: new THREE.Vector2(0.5, 0.5) };
    shader.uniforms.detailCursorActive = { value: 0 };
    shader.uniforms.detailCursorClearRadius = { value: OBJECT_DETAIL_CURSOR_CLEAR_RADIUS };
    shader.uniforms.detailCursorClearFeather = { value: OBJECT_DETAIL_CURSOR_CLEAR_FEATHER };
    shader.vertexShader = shader.vertexShader
      .replace(
        "#include <common>",
        `#include <common>
varying vec2 vDetailCursorCloudUv;`,
      )
      .replace(
        "#include <uv_vertex>",
        `#include <uv_vertex>
vDetailCursorCloudUv = uv;`,
      );
    shader.fragmentShader = shader.fragmentShader
      .replace(
        "#include <common>",
        `#include <common>
uniform vec2 detailCursorUv;
uniform float detailCursorActive;
uniform float detailCursorClearRadius;
uniform float detailCursorClearFeather;
uniform float detailHasAtmosphereTint;
varying vec2 vDetailCursorCloudUv;
${getObjectDetailTintShaderHeader()}`,
      )
      .replace(
        "#include <alphatest_fragment>",
        `vec2 detailCursorCloudAspectUv = vec2((vDetailCursorCloudUv.x - detailCursorUv.x) * 2.0, vDetailCursorCloudUv.y - detailCursorUv.y);
float detailCursorCloudDistance = length(detailCursorCloudAspectUv);
float detailCursorCloudKeep = mix(1.0, smoothstep(detailCursorClearRadius, detailCursorClearRadius + detailCursorClearFeather, detailCursorCloudDistance), detailCursorActive);
diffuseColor.a *= detailCursorCloudKeep;
#include <alphatest_fragment>`,
      )
      .replace(
        "#include <dithering_fragment>",
        `vec2 detailTintCloudWorldPosition = vec2((vDetailCursorCloudUv.x - 0.5) * ${OBJECT_DETAIL_SURFACE_WORLD_WIDTH.toFixed(1)}, vDetailCursorCloudUv.y - 0.5);
gl_FragColor.rgb = mix(gl_FragColor.rgb, applyDetailTintRing(gl_FragColor.rgb, detailTintCloudWorldPosition), detailHasAtmosphereTint);
#include <dithering_fragment>`,
      );
    material.userData.detailCloudClearShader = shader;
    updateObjectDetailCursorUniforms();
  };
}

function updateObjectDetailSurfaceEffectUniforms() {
  const shader = objectDetail3D?.material?.userData.detailSurfaceEffectShader;
  if (!shader || !objectDetail3D?.spotLights?.length) {
    return;
  }

  shader.uniforms.detailCloudShadowTextureOffset.value.set(objectDetail3D.cloudMap?.offset.x ?? 0, 0);
  shader.uniforms.detailCloudShadowStrength.value = OBJECT_DETAIL_CLOUD_SHADOW_STRENGTH
    * THREE.MathUtils.clamp(objectDetail3D.cloudMix ?? 1, 0, 1);
  updateObjectDetailTintShaderUniforms();
  updateObjectDetailCursorUniforms();
}

function updateObjectDetailCursorUniforms() {
  if (!objectDetail3D?.cursor) {
    return;
  }

  const { uv, clearRadius, clearFeather } = objectDetail3D.cursor;
  const activeMix = objectDetail3D.cursorEffectMix ?? 0;
  for (const shader of [
    objectDetail3D.material?.userData.detailSurfaceEffectShader,
    objectDetail3D.cloudMaterial?.userData.detailCloudClearShader,
  ]) {
    if (!shader) {
      continue;
    }
    shader.uniforms.detailCursorActive.value = activeMix;
    shader.uniforms.detailCursorUv.value.copy(uv);
    shader.uniforms.detailCursorClearRadius.value = clearRadius;
    shader.uniforms.detailCursorClearFeather.value = clearFeather;
  }
}

function disposeObjectDetail3D() {
  if (!objectDetail3D) {
    return;
  }

  cancelObjectDetailHexGridAnimation();
  objectDetail3D.geometry.dispose();
  objectDetail3D.material.dispose();
  releaseCanvasTexture(objectDetail3D.colorMapRef);
  releaseCanvasTexture(objectDetail3D.heightMapRef);
  releaseCanvasTexture(objectDetail3D.emissiveMapRef);
  objectDetail3D.hexGrid?.texture.dispose();
  objectDetail3D.hexGrid?.geometry.dispose();
  objectDetail3D.hexGrid?.material.dispose();
  objectDetail3D.hexGrid?.cityTexture.dispose();
  objectDetail3D.hexGrid?.cityGeometry.dispose();
  objectDetail3D.hexGrid?.cityMaterial.dispose();
  objectDetail3D.hexGrid?.cityNightTexture.dispose();
  objectDetail3D.hexGrid?.cityNightGeometry.dispose();
  objectDetail3D.hexGrid?.cityNightMaterial.dispose();
  releaseCanvasTexture(objectDetail3D.cloudMapRef);
  objectDetail3D.cloudGeometry?.dispose();
  objectDetail3D.cloudMaterial?.dispose();
  objectDetail3D.cloudDepthMaterial?.dispose();
  objectDetail3D.bloomResources?.targetA.dispose();
  objectDetail3D.bloomResources?.targetB.dispose();
  objectDetail3D.bloomResources?.bloomGeometry.dispose();
  objectDetail3D.bloomResources?.bloomMaterial.dispose();
  objectDetail3D.bloomResources?.blurMaterial.dispose();
  objectDetail3D.bloomResources?.compositeMaterial.dispose();
  objectDetail3D.renderer.dispose();
  objectDetail3D.renderer.forceContextLoss();
  objectDetail3D.renderer.domElement = null;
  objectDetail3D = null;
}

async function returnToOrbitFromObjectDetail() {
  const planet = objectDetailOrbitPlanet;
  if (!planet) {
    closeObjectDetailScreen();
    return;
  }

  persistRuntimeSession("planet");
  await runObjectDetailZoomOutTransition();
  closeObjectDetailScreen({ preserveTransitionOverlay: true, keepSystemHidden: true });

  try {
    await loadPlanetScreenRenderer();
  } catch (error) {
    console.error("Planet screen module failed to load", error);
  }
  planetScreenController.open(planet);
  starWindow.classList.remove("object-detail-open");
  planetScreenController.updateParallax(lastClientPointer.x, lastClientPointer.y);
  resetTransitionSurfaces();
  snapObjectDetailHidden();
  await revealObjectDetailEntryOverlay(260);
  persistRuntimeSession("planet");
}

async function returnToStarSystemFromObjectDetail() {
  const activeNode = systemScreenController.state.activeNode;
  if (!activeNode) {
    closeObjectDetailScreen();
    closeStarWindow();
    return;
  }

  cancelPlanetEntryTransition();
  await runObjectDetailZoomOutTransition();
  closeObjectDetailScreen({ preserveTransitionOverlay: true });
  planetScreenController.close();
  closePlanetWindow();
  systemScreenController.open(activeNode);
  musicPlayerController.ensureSystemPosition();
  setSystemTransitionOffset(0, 0);
  setSystemTransitionOverlay(0);
  renderStarSystem(activeNode);
  renderSystemStars(activeNode);
  renderSystemParticles(activeNode);
  updateSystemGlow(window.innerWidth / 2, window.innerHeight / 2, 0, 0);
  updateSystemParallax(lastClientPointer.x, lastClientPointer.y, true);
  preloadPlanetScreenRenderer();
  updateGameNavigationUi(true);
  resetTransitionSurfaces();
  snapObjectDetailHidden();
  snapPlanetScreenHidden();
  await revealObjectDetailEntryOverlay(260);
  persistRuntimeSession("system");
}

async function runPlanetScreenZoomOutTransition({ originX, originY }) {
  planetScreen.style.setProperty("--surface-entry-origin-x", `${originX}px`);
  planetScreen.style.setProperty("--surface-entry-origin-y", `${originY}px`);
  planetScreen.style.setProperty("--surface-entry-scale", "1");
  objectDetailEntryOverlay.classList.add("active");
  objectDetailEntryOverlay.style.setProperty("--surface-entry-alpha", "0");
  await nextAnimationFrame();
  planetScreen.classList.add("surface-entry-moving");
  planetScreen.style.setProperty("--surface-entry-scale", "0.08");
  objectDetailEntryOverlay.style.setProperty("--surface-entry-alpha", "1");
  await delay(500);
}

async function runObjectDetailZoomOutTransition() {
  objectDetailScreen.style.setProperty("--object-detail-exit-scale", "1");
  objectDetailEntryOverlay.classList.add("active");
  objectDetailEntryOverlay.style.setProperty("--surface-entry-alpha", "0");
  await nextAnimationFrame();
  objectDetailScreen.classList.add("object-detail-exit-moving");
  objectDetailScreen.style.setProperty("--object-detail-exit-scale", "0.08");
  objectDetailEntryOverlay.style.setProperty("--surface-entry-alpha", "1");
  await delay(500);
}

async function revealObjectDetailEntryOverlay(duration = 360) {
  await nextAnimationFrame();
  objectDetailEntryOverlay.style.setProperty("--surface-entry-alpha", "0");
  await delay(duration);
  objectDetailEntryOverlay.classList.remove("active");
  planetScreen.style.removeProperty("opacity");
  planetScreen.style.removeProperty("transition");
  objectDetailScreen.style.removeProperty("opacity");
  objectDetailScreen.style.removeProperty("transition");
}

function resetTransitionSurfaces() {
  planetScreen.classList.remove("surface-entry-moving");
  planetScreen.style.setProperty("--surface-entry-scale", "1");
  objectDetailScreen.classList.remove("object-detail-exit-moving");
  objectDetailScreen.style.setProperty("--object-detail-exit-scale", "1");
}

function snapObjectDetailHidden() {
  objectDetailScreen.style.transition = "none";
  objectDetailScreen.style.opacity = "0";
  objectDetailScreen.classList.remove("visible");
  void objectDetailScreen.offsetWidth;
}

function snapPlanetScreenHidden() {
  planetScreen.style.transition = "none";
  planetScreen.style.opacity = "0";
  planetScreen.classList.remove("surface-entry-moving");
  planetScreen.style.setProperty("--surface-entry-scale", "1");
  void planetScreen.offsetWidth;
}

function renderSystemStars(node) {
  systemStars.replaceChildren();
  const random = createRandom(`${SEED}:system-stars:${node.id}`);
  const width = window.innerWidth;
  const height = window.innerHeight;
  const overscan = 96;
  const starCount = 160;

  for (let index = 0; index < starCount; index += 1) {
    const star = document.createElement("span");
    const depth = random();
    const size = depth > 0.92 ? 2 : 1;
    star.className = "system-bg-star";
    star.style.left = `${random() * (width + overscan * 2)}px`;
    star.style.top = `${random() * (height + overscan * 2)}px`;
    star.style.width = `${size}px`;
    star.style.height = `${size}px`;
    star.style.opacity = `${0.22 + random() * 0.58}`;
    star.style.setProperty("--depth", `${0.25 + depth * 0.75}`);
    systemStars.append(star);
  }
}

function renderSystemParticles(node) {
  systemParticles.replaceChildren();
  const random = createRandom(`${SEED}:system-particles:${node.id}`);
  const width = window.innerWidth;
  const height = window.innerHeight;
  const overscan = 128;
  const particleCount = 95;

  for (let index = 0; index < particleCount; index += 1) {
    const particle = document.createElement("span");
    const depth = random();
    const size = 1 + random() * 1.4;
    particle.className = "system-particle";
    particle.style.left = `${random() * (width + overscan * 2)}px`;
    particle.style.top = `${random() * (height + overscan * 2)}px`;
    particle.style.width = `${size}px`;
    particle.style.height = `${size}px`;
    particle.style.opacity = `${0.16 + random() * 0.34}`;
    particle.style.setProperty("--depth", `${0.45 + depth * 0.75}`);
    systemParticles.append(particle);
  }
}

function updateSystemParallax(clientX, clientY, force = false) {
  if (!isGameRuntimeReady || !systemScreenController?.isOpen()) {
    return;
  }

  if (!force && isPlanetEntryTransitioning) {
    return;
  }

  if (planetScreenController.isOpen()) {
    planetScreenController.updateParallax(clientX, clientY);
    return;
  }

  if (!force && (systemScreenController.isTransitioning() || systemScreenController.isGraphEntering())) {
    return;
  }

  const offsetX = (clientX / window.innerWidth - 0.5) * -30;
  const offsetY = (clientY / window.innerHeight - 0.5) * -20;
  const systemOffsetX = (clientX / window.innerWidth - 0.5) * -34;
  const systemOffsetY = (clientY / window.innerHeight - 0.5) * -20;
  const particleOffsetX = (clientX / window.innerWidth - 0.5) * 42;
  const particleOffsetY = (clientY / window.innerHeight - 0.5) * 28;

  if (
    !force &&
    lastSystemParallax.clientX === clientX &&
    lastSystemParallax.clientY === clientY &&
    lastSystemParallax.systemOffsetX === systemOffsetX &&
    lastSystemParallax.systemOffsetY === systemOffsetY
  ) {
    if (hoveredSystemBody) {
      positionSystemTooltip(clientX, clientY);
    }
    return;
  }

  lastSystemParallax.clientX = clientX;
  lastSystemParallax.clientY = clientY;
  lastSystemParallax.systemOffsetX = systemOffsetX;
  lastSystemParallax.systemOffsetY = systemOffsetY;

  positionSystemTooltip(clientX, clientY);
  systemStars.style.setProperty("--parallax-x", `${offsetX}px`);
  systemStars.style.setProperty("--parallax-y", `${offsetY}px`);
  systemParticles.style.setProperty("--particle-parallax-x", `${particleOffsetX}px`);
  systemParticles.style.setProperty("--particle-parallax-y", `${particleOffsetY}px`);
  starSystem.style.setProperty("--system-parallax-x", `${systemOffsetX}px`);
  starSystem.style.setProperty("--system-parallax-y", `${systemOffsetY}px`);
  systemStarLayer.style.setProperty("--system-parallax-x", `${systemOffsetX}px`);
  systemStarLayer.style.setProperty("--system-parallax-y", `${systemOffsetY}px`);
  updateSystemGlow(clientX, clientY, systemOffsetX, systemOffsetY);
}

function resetSystemParallaxCache() {
  lastSystemParallax.clientX = NaN;
  lastSystemParallax.clientY = NaN;
  lastSystemParallax.systemOffsetX = NaN;
  lastSystemParallax.systemOffsetY = NaN;
}

function updateSystemGlow(clientX, clientY, systemOffsetX = 0, systemOffsetY = 0) {
  if (!activeSystemStar) {
    return;
  }

  const glowX = activeSystemStar.x + systemOffsetX;
  const glowY = activeSystemStar.y + systemOffsetY;
  const distanceToCenter = Math.hypot(clientX - glowX, clientY - glowY);
  const distanceToEdge = Math.max(0, distanceToCenter - activeSystemStar.radius);
  const rightEdgeX = glowX + activeSystemStar.radius;
  const falloffRadius = Math.max(260, window.innerWidth * 0.75 - rightEdgeX);
  const proximity = 1 - THREE.MathUtils.clamp(distanceToEdge / falloffRadius, 0, 1);
  const intensity = proximity * 1.72;

  if (
    lastSystemGlow.centerX === glowX &&
    lastSystemGlow.centerY === glowY &&
    lastSystemGlow.radius === activeSystemStar.radius &&
    lastSystemGlow.color === activeSystemStar.glowColor &&
    lastSystemGlow.intensity === intensity
  ) {
    return;
  }

  lastSystemGlow.centerX = glowX;
  lastSystemGlow.centerY = glowY;
  lastSystemGlow.radius = activeSystemStar.radius;
  lastSystemGlow.color = activeSystemStar.glowColor;
  lastSystemGlow.intensity = intensity;

  systemGlowLayer.render({
    centerX: glowX,
    centerY: glowY,
    radius: activeSystemStar.radius,
    color: activeSystemStar.glowColor,
    intensity,
  });
}

function resetSystemGlowCache() {
  lastSystemGlow.centerX = NaN;
  lastSystemGlow.centerY = NaN;
  lastSystemGlow.radius = NaN;
  lastSystemGlow.color = "";
  lastSystemGlow.intensity = NaN;
}

function renderStarSystem(node) {
  closeSystemPlanetMenu();
  captureSystemFleetMarkerPositions();
  cancelFleetMarkerAnimations();
  starSystem.replaceChildren();
  resetSystemDecorTrails();
  systemStarLayer.replaceChildren();
  activeSystemFleetAnchors = [];
  resetSystemParallaxCache();
  resetSystemGlowCache();
  gasGiantTextureLayers.clear();
  planetSurfaceRotationLayers.clear();
  clearSystemHover();
  planetScreenController.close();
  closePlanetWindow();
  systemTitle.textContent = `${node.name} SYSTEM`;

  const width = window.innerWidth;
  const height = window.innerHeight;
  const centerY = height / 2;
  const random = createRandom(`${SEED}:system:${node.id}`);
  const starRadius = getSystemStarRadius(node, height, random);
  const starX = -starRadius * 0.8;
  activeSystemStar = {
    x: starX,
    y: centerY,
    radius: starRadius,
    glowColor: node.glowColor,
  };
  activeSystemFleetAnchors.push({
    anchorKey: "system",
    type: "system",
    systemId: String(node.id),
    x: Math.max(22, starX + starRadius + 22),
    y: centerY - Math.min(72, starRadius * 0.32),
    radius: 14,
  });
  const star = document.createElement("div");
  star.className = "system-star";
  star.classList.toggle("black-hole", Boolean(node.blackCore));
  star.style.width = `${starRadius * 2}px`;
  star.style.height = `${starRadius * 2}px`;
  star.style.left = `${starX - starRadius}px`;
  star.style.top = `${centerY - starRadius}px`;
  star.style.color = node.glowColor;
  star.style.setProperty("--star-edge-blend", `${Math.min(60, starRadius * 0.28)}px`);
  const starBackground = node.blackCore
    ? "radial-gradient(circle at center, #000 0 100%)"
    : `radial-gradient(circle at center, #fff 0 42%, ${node.coreColor} 52%, ${node.glowColor} 66%, rgba(255,255,255,0.2) 82%, rgba(255,255,255,0) 100%)`;
  const starFill = document.createElement("span");
  starFill.className = "system-star__fill";
  starFill.style.background = starBackground;
  star.append(starFill);
  activeSystemStarSurface = null;
  if (!node.blackCore) {
    const starSurface = createSystemStarSurface(node, starRadius);
    star.append(starSurface.canvas);
    activeSystemStarSurface = starSurface;
    drawSystemStarSurface(starSurface, performance.now());
  }
  systemStarLayer.append(star);

  const orbitLayer = createSystemOrbitLayer(width, height);
  const orbitItems = [];
  starSystem.append(orbitLayer);

  const starEdgeOrbit = starRadius + Math.min(starRadius * 0.12, SYSTEM_ORBIT_STAR_EDGE_GAP_CAP);
  const minOrbit = Math.max(starEdgeOrbit, -starX + 96);
  const maxOrbit = Math.max(minOrbit + 80, width - starX - 84);
  const orbitRadii = createSystemOrbitRadii(node.planets, minOrbit, maxOrbit, random);

  const occupiedPlanets = [];
  for (let index = 0; index < node.planets; index += 1) {
    const orbitRadius = orbitRadii[index];
    const safeVertical = Math.max(24, centerY - 58);
    const maxAngle = Math.min(0.78, Math.asin(Math.min(0.9, safeVertical / orbitRadius)));
    const angle = (random() * 2 - 1) * maxAngle * 0.94;
    const planetSizeIndex = Math.floor(random() * 10);
    const isAsteroidBelt = random() < 0.05;

    if (isAsteroidBelt) {
      const belt = createAsteroidBelt(random, orbitRadius);
      const beltElement = document.createElement("div");
      beltElement.className = "system-asteroid-belt";
      beltElement.style.width = `${belt.outerRadius * 2}px`;
      beltElement.style.height = `${belt.outerRadius * 2}px`;
      beltElement.style.left = `${starX - belt.outerRadius}px`;
      beltElement.style.top = `${centerY - belt.outerRadius}px`;
      beltElement.style.background = belt.background;
      starSystem.append(beltElement);
      continue;
    }

    orbitItems.push({
      centerX: starX,
      centerY,
      radius: orbitRadius,
      planetAngle: angle,
    });

    const planetRadius = getSystemPlanetRadius(planetSizeIndex);
    const planetX = starX + Math.cos(angle) * orbitRadius;
    const planetY = centerY + Math.sin(angle) * orbitRadius;
    occupiedPlanets.push({ x: planetX, y: planetY, radius: planetRadius });
    const planetKind = createPlanetKind(random, planetSizeIndex);
    const gasGiantTextureSeed = `${SEED}:gas-giant:${node.id}:${index}`;
    const gasGiantTexture = planetKind.label === "GAS GIANT"
      ? createGasGiantTexture(gasGiantTextureSeed)
      : null;
    const zoneInfo = ZONE_DATA[node.starType];
    const orbitFraction = (orbitRadius - minOrbit) / (maxOrbit - minOrbit) * 100;
    const isTidallyLocked = zoneInfo && orbitFraction <= zoneInfo.tidalLock;
    const accretionDisk = createAccretionDisk(random, planetRadius, planetSizeIndex);
    const moonSystem = createMoonSystem({
      random,
      planetX,
      planetY,
      planetRadius,
      planetSizeIndex,
      accretionDisk,
      starX,
      centerY,
      starRadius,
    });

    if (accretionDisk) {
      const disk = createAccretionDiskElement(
        accretionDisk,
        Math.atan2(planetY - centerY, planetX - starX),
        planetRadius * 2,
      );
      disk.className = "system-accretion-disk";
      const diskSize = Number.parseFloat(disk.style.width);
      disk.style.left = `${planetX - diskSize / 2}px`;
      disk.style.top = `${planetY - diskSize / 2}px`;
      starSystem.append(disk);
    }

    const toStarLength = Math.hypot(starX - planetX, centerY - planetY) || 1;
    const starDirX = (starX - planetX) / toStarLength;
    const starDirY = (centerY - planetY) / toStarLength;
    const planetName = planetNameAssignments.get(node.id)?.[index] ?? planetNameService.createDefaultPlanetName(node.name, index);
    const planetGravity = createGravityValue({
      kind: planetKind.label,
      sizeIndex: planetSizeIndex,
      seed: `${SEED}:gravity:${node.id}:${planetName}`,
    });
    const basePlanetTemperature = createBaseTemperatureValue({
      starType: node.starType,
      orbitFraction,
      seed: `${SEED}:temperature:${node.id}`,
    });
    const planetSurfaceTags = planetKind.label === "PLANET"
      ? createPlanetSurfaceTags({
        seed: `${SEED}:planet-tags:${node.id}:${planetName}`,
        temperature: basePlanetTemperature,
      })
      : { tags: [], hasWater: false, atmosphere: null, temperature: basePlanetTemperature };
    const planetTemperature = planetSurfaceTags.temperature;
    const planetTextureParams = planetKind.label === "PLANET"
      ? createPlanetTextureParams({
        seed: `${SEED}:planet-texture-params:${node.id}:${planetName}`,
        temperature: planetTemperature,
        hasWater: planetSurfaceTags.hasWater,
        atmosphere: planetSurfaceTags.atmosphere,
        tidallyLocked: Boolean(isTidallyLocked),
      })
      : null;
    const planetTextureSeed = `${SEED}:planet-texture:${node.id}:${planetName}`;
    const planetTexture = planetKind.label === "PLANET"
      ? createPlanetTexture(planetTextureSeed, undefined, planetTextureParams)
      : null;
    const planetRotation = createPlanetRotationState({
      seed: SEED,
      systemId: node.id,
      planetName,
      tidallyLocked: Boolean(isTidallyLocked),
    });
    const planetUnlockedRotation = createPlanetRotationState({
      seed: SEED,
      systemId: node.id,
      planetName,
      tidallyLocked: false,
    });

    const planet = document.createElement("div");
    planet.className = "system-planet";
    planet.style.width = `${planetRadius * 2}px`;
    planet.style.height = `${planetRadius * 2}px`;
    planet.style.left = `${planetX - planetRadius}px`;
    planet.style.top = `${planetY - planetRadius}px`;
    planet.append(createPlanetGlow(planetRadius, starDirX, starDirY));
    planet.append(createPlanetSurface(
      planetKind.background,
      gasGiantTexture,
      planetTexture,
      planetRadius,
      starDirX,
      starDirY,
      false,
      Boolean(isTidallyLocked),
      {
        rotation: planetRotation,
        cloudRotation: planetUnlockedRotation,
      },
    ));
    starSystem.append(planet);

    renderMoons({ ...moonSystem, starDirX, starDirY });

    const constructionRadius = getPlanetConstructionRadius(planetRadius, accretionDisk, moonSystem);
    const moonNames = planetNameService.getMoonNames(node.id, index, planetName, moonSystem.moonCount);
    const label = document.createElement("div");
    label.className = "system-planet-label";
    label.textContent = planetName;
    label.style.left = `${planetX}px`;
    label.style.top = `${planetY - constructionRadius - 9}px`;
    starSystem.append(label);

    const hitTargetRadius = Math.max(constructionRadius, planetRadius + 10);
    const hitTarget = document.createElement("div");
    hitTarget.className = "system-planet-hit";
    hitTarget.style.width = `${hitTargetRadius * 2}px`;
    hitTarget.style.height = `${hitTargetRadius * 2}px`;
    hitTarget.style.left = `${planetX - hitTargetRadius}px`;
    hitTarget.style.top = `${planetY - hitTargetRadius}px`;
    hitTarget.dataset.name = planetName;
    hitTarget.dataset.kind = planetKind.label;
    hitTarget.dataset.hasDisk = accretionDisk ? "true" : "false";
    hitTarget.dataset.moons = String(moonSystem.moonCount);
    hitTarget.dataset.radius = String(planetRadius);
    hitTarget.dataset.tidallyLocked = isTidallyLocked ? "true" : "false";
    hitTarget.dataset.gravity = formatGravityValue(planetGravity);
    hitTarget.dataset.temperature = formatTemperatureValue(planetTemperature);
    hitTarget.dataset.dayCycle = formatDayCycleValue(planetRotation.period);
    hitTarget.dataset.tags = planetSurfaceTags.tags.join("|");
    const planetInfo = {
      name: planetName,
      kind: planetKind.label,
      background: planetKind.background,
      gasGiantTexture,
      gasGiantTextureSeed: gasGiantTexture ? gasGiantTextureSeed : null,
      planetTexture,
      planetTextureSeed,
      sizeIndex: planetSizeIndex,
      element: planet,
      radius: planetRadius,
      orbitRadius,
      minOrbit,
      maxOrbit,
      systemStarRadius: starRadius,
      systemStarColor: node.glowColor,
      systemStarCoreColor: node.coreColor,
      systemStarBlackCore: Boolean(node.blackCore),
      systemId: node.id,
      gravity: planetGravity,
      temperature: planetTemperature,
      tags: planetSurfaceTags.tags,
      surfaceTextureParams: planetTextureParams,
      dayCycleSeconds: planetRotation.period,
      // Window scale excludes the accretion disk so a planet with a large disk
      // is not shrunk; the disk is allowed to overflow the stage instead.
      extentRadius: accretionDisk
        ? planetRadius
        : getPlanetConstructionRadius(planetRadius, null, moonSystem),
      starDirX,
      starDirY,
      accretionDisk,
      diskShadowAngle: Math.atan2(planetY - centerY, planetX - starX),
      moonCount: moonSystem.moonCount,
      moonOrbitRadius: moonSystem.orbitRadius,
      moonList: moonSystem.moons.map((moon, moonIndex) => ({
        dx: moon.x - planetX,
        dy: moon.y - planetY,
        radius: moon.radius,
        sizeIndex: moon.sizeIndex,
        sizeName: getMoonSizeLabel(moon),
        gravity: createGravityValue({
          kind: "MOON",
          sizeIndex: moon.sizeIndex,
          seed: `${SEED}:gravity:${node.id}:${planetName}:moon:${moonIndex}`,
        }),
        name: moonNames[moonIndex] ?? planetNameService.createDefaultPlanetName(planetName, moonIndex),
      })),
      hasDisk: Boolean(accretionDisk),
      tidallyLocked: Boolean(isTidallyLocked),
      lore: createPlanetLore(createRandom(`${SEED}:planet-lore:${node.id}:${index}`)),
    };
    hitTarget.userData = { label, planet: planetInfo };
    const planetKey = getPlanetExplorationKey(planetInfo);
    applySystemPlanetOwnershipVisuals(hitTarget, label, planetKey);
    hitTarget.classList.toggle("system-planet-hit--locked", !isPlanetAccessibleForActiveSide(planetInfo));
    activeSystemFleetAnchors.push({
      anchorKey: `planet:${planetKey}`,
      type: "planet",
      systemId: String(node.id),
      planetKey,
      x: planetX,
      y: planetY,
      slotRadius: getSystemFleetAnchorDistance(planetRadius),
      radius: planetRadius,
    });
    hitTarget.addEventListener("pointerenter", (event) => {
      if (isGameDialogOpen()) {
        return;
      }
      positionSystemTooltip(event.clientX, event.clientY);
      setSystemHover(hitTarget);
    });
    hitTarget.addEventListener("pointermove", (event) => {
      if (isGameDialogOpen()) {
        return;
      }
      positionSystemTooltip(event.clientX, event.clientY);
    });
    hitTarget.addEventListener("pointerleave", () => {
      if (hoveredSystemBody === hitTarget) {
        setSystemHover(null);
      }
    });
    hitTarget.addEventListener("click", (event) => {
      if (isGameDialogOpen()) {
        event.stopPropagation();
        return;
      }
      event.stopPropagation();
      lastClientPointer.set(event.clientX, event.clientY);
      if (moveSelectedFleetToPlanet(planetInfo)) {
        return;
      }
      if (!isPlanetAccessibleForActiveSide(planetInfo)) {
        return;
      }
      if (hasVisitedPlanetViewForActiveSide(planetInfo)) {
        showSystemPlanetMenu(planetInfo, event.clientX, event.clientY);
        return;
      }
      startPlanetEntryTransition(planetInfo, event.clientX, event.clientY);
    });
    starSystem.append(hitTarget);
  }

  drawSystemOrbits(orbitLayer, orbitItems);
  renderSystemZones(node, starX, centerY, minOrbit, maxOrbit);
  renderSystemJumps({
    node,
    starX,
    centerY,
    width,
    height,
    starRadius,
    minOrbit,
    maxOrbit,
    orbitRadii,
    occupiedPlanets,
    random,
    fleetAnchors: activeSystemFleetAnchors,
  });
  renderSystemFleetMarkers(node, activeSystemFleetAnchors);
}

function refreshSystemOwnershipVisuals() {
  if (!systemScreenController?.isOpen?.()) {
    return;
  }

  starSystem.querySelectorAll(".system-planet-hit").forEach((hitTarget) => {
    const planet = hitTarget.userData?.planet;
    const label = hitTarget.userData?.label;
    const planetKey = getPlanetExplorationKey(planet);
    applySystemPlanetOwnershipVisuals(hitTarget, label, planetKey);
  });
  applySystemHoverOwnershipColor();
}

function applySystemPlanetOwnershipVisuals(hitTarget, label, planetKey) {
  const ownership = getVisiblePlanetOwnership(planetKey);
  if (ownership?.color) {
    hitTarget.dataset.ownershipColor = ownership.color;
    hitTarget.dataset.ownerSideId = ownership.sideId;
    if (label) {
      label.style.color = ownership.color;
      label.style.textShadow = `0 0 10px ${hexToRgba(ownership.color, 0.32)}`;
    }
    return;
  }

  delete hitTarget.dataset.ownershipColor;
  delete hitTarget.dataset.ownerSideId;
  if (label) {
    label.style.removeProperty("color");
    label.style.removeProperty("text-shadow");
  }
}

function renderSystemZones(node, starX, centerY, minOrbit, maxOrbit) {
  activeZoneElements = [];
  const zoneInfo = ZONE_DATA[node.starType];
  if (!zoneInfo) return;

  const span = maxOrbit - minOrbit;

  if (zoneInfo.tidalLock > 0) {
    const tidalRadius = minOrbit + span * (zoneInfo.tidalLock / 100);
    const el = document.createElement("div");
    el.className = "system-zone system-zone--tidal";
    if (isTidalZoneVisible) el.classList.add("visible");
    el.style.width = `${tidalRadius * 2}px`;
    el.style.height = `${tidalRadius * 2}px`;
    el.style.left = `${starX - tidalRadius}px`;
    el.style.top = `${centerY - tidalRadius}px`;
    starSystem.append(el);
    activeZoneElements.push({ el, zone: "tidal" });
  }

  if (zoneInfo.hzInner !== null && zoneInfo.hzOuter !== null) {
    const hzOuterRadius = minOrbit + span * (zoneInfo.hzOuter / 100);
    const hzInnerRadius = minOrbit + span * (zoneInfo.hzInner / 100);
    const innerPct = (hzInnerRadius / hzOuterRadius) * 100;
    const hzEl = document.createElement("div");
    hzEl.className = "system-zone system-zone--hz";
    if (isHzZoneVisible) hzEl.classList.add("visible");
    hzEl.style.width = `${hzOuterRadius * 2}px`;
    hzEl.style.height = `${hzOuterRadius * 2}px`;
    hzEl.style.left = `${starX - hzOuterRadius}px`;
    hzEl.style.top = `${centerY - hzOuterRadius}px`;
    hzEl.style.setProperty("--hz-inner-pct", `${innerPct}%`);
    starSystem.append(hzEl);
    activeZoneElements.push({ el: hzEl, zone: "hz" });
  }
}

function createPlanetLore(random) {
  const pick = (list) => list[Math.floor(random() * list.length)];
  const openings = [
    "Charted by long-range survey drones,",
    "First catalogued during the deep-sky census,",
    "Known to old star-charts only as a faint smudge,",
    "Whispered about in the logs of passing freighters,",
    "Lost for centuries, then rediscovered by accident,",
    "Marked on every navigator's map with quiet caution,",
    "Named after a captain who never returned,",
    "Beyond the reach of the early colony beacons,",
  ];
  const bodies = [
    "this world turns through a slow, patient dark.",
    "it carries scars from an age no record remembers.",
    "its surface hums with storms older than the colonies.",
    "it drifts in silence, indifferent to the ships above.",
    "the planet keeps a climate no instrument fully trusts.",
    "it holds a horizon that has swallowed many expeditions.",
    "its gravity pulls at more than just stone and ice.",
    "the world wears a sky the colour of cooling iron.",
  ];
  const closers = [
    "Few who orbit it leave entirely unchanged.",
    "Settlers speak of it with equal parts dread and longing.",
    "Its true name, they say, was never written down.",
    "What it guards beneath the clouds remains unmeasured.",
    "Light behaves strangely here, and so do travellers.",
    "It waits, as it has always waited.",
    "Survey crews still argue over what they saw.",
    "The maps mark it simply, and warmly, as home.",
  ];
  return `${pick(openings)} ${pick(bodies)} ${pick(closers)}`;
}

function getPlanetSizeLabel(planet) {
  const names = PLANET_SIZE_NAMES[planet.kind] ?? [];
  const sizeName = names[planet.sizeIndex] ?? "";
  return `${sizeName} ${planet.kind}`.trim().toUpperCase();
}

function getMoonSizeLabel(moon) {
  return (MOON_SIZE_NAMES[moon.sizeIndex] ?? "moon").toUpperCase();
}

function createGravityValue({ kind, sizeIndex, seed }) {
  const baseValues = GRAVITY_BASE_VALUES[kind] ?? [];
  const baseGravity = baseValues[sizeIndex] ?? 1;
  const maxShift = getGravityMaxShift(kind, sizeIndex);
  const random = createRandom(seed);
  const gravity = baseGravity + (random() * 2 - 1) * maxShift;

  return Math.max(0.01, Number(gravity.toFixed(2)));
}

function getGravityMaxShift(kind, sizeIndex) {
  if (kind === "GAS GIANT") {
    return sizeIndex < 5 ? 0.2 : 0.4;
  }

  if (kind === "PLANET") {
    return sizeIndex < 2 ? 0.2 : 1;
  }

  if (kind === "MOON") {
    return 0.2;
  }

  return 0;
}

function formatGravityValue(gravity) {
  return gravity.toFixed(2).replace(/\.?0+$/, "");
}

function formatDayCycleValue(period) {
  if (!Number.isFinite(period)) {
    return "\u221e";
  }

  return period.toFixed(1).replace(/\.0$/, "");
}

function createPlanetSurfaceTags({ seed, temperature }) {
  const random = createRandom(seed);
  const atmosphereRoll = random();
  const atmosphere = atmosphereRoll < 0.4
    ? null
    : ATMOSPHERE_TAGS[Math.min(ATMOSPHERE_TAGS.length - 1, Math.floor((atmosphereRoll - 0.4) / 0.2))];
  const adjustedTemperature = applyAtmosphereTemperature({
    atmosphere,
    temperature,
    seed: `${seed}:atmosphere-temperature`,
  });
  const hasWater = adjustedTemperature <= 100 && random() < PLANET_WATER_TAG_CHANCE;
  const tags = [];
  if (hasWater) {
    tags.push("WATER");
  }
  if (atmosphere) {
    tags.push(atmosphere);
  }

  return { tags, hasWater, atmosphere, temperature: adjustedTemperature };
}

function applyAtmosphereTemperature({ atmosphere, temperature, seed }) {
  const multiplierRange = ATMOSPHERE_TEMPERATURE_MULTIPLIERS[atmosphere];
  if (!multiplierRange) {
    return temperature;
  }

  const random = createRandom(seed);
  const multiplier = THREE.MathUtils.lerp(multiplierRange[0], multiplierRange[1], random());
  if (temperature < 0) {
    return temperature / multiplier;
  }

  return temperature * multiplier;
}

function createPlanetTextureParams({ seed, temperature, hasWater, atmosphere, tidallyLocked }) {
  const waterRandom = createRandom(`${seed}:water`);
  const atmosphereRandom = createRandom(`${seed}:atmosphere`);
  const textureMode = tidallyLocked && temperature >= 0
    ? temperature > TIDAL_COMBINE_MAX_TEMPERATURE
      ? "molten"
      : "tidal-combine"
    : "default";
  const hotAndDry = temperature > 100;
  const forceDryTexture = textureMode !== "default";
  const waterPosition = hasWater && !hotAndDry && !forceDryTexture
    ? 0.3 + waterRandom() * 0.4
    : 0;
  const iceCaps = hasWater && !hotAndDry && !forceDryTexture
    ? createTemperatureIceCaps(temperature)
    : 0;
  const cloudAlpha = createAtmosphereCloudAlpha(atmosphere, atmosphereRandom);
  const freezeWater = hasWater && !atmosphere && !hotAndDry && !forceDryTexture;

  return {
    waterPosition,
    iceCaps,
    cloudAlpha,
    freezeWater,
    textureMode,
    hasWater,
  };
}

function createTemperatureIceCaps(temperature) {
  if (temperature > 100) {
    return 0;
  }

  if (temperature >= 0) {
    return THREE.MathUtils.lerp(5, 1, temperature / 100);
  }

  return THREE.MathUtils.lerp(5, 55, THREE.MathUtils.clamp(-temperature / 100, 0, 1));
}

function createAtmosphereCloudAlpha(atmosphere, random) {
  if (atmosphere === "THIN ATMOSPHERE") {
    return 0.5 + random() * 0.05;
  }
  if (atmosphere === "ATMOSPHERE") {
    return 0.4 + random() * 0.1;
  }
  if (atmosphere === "DENSE ATMOSPHERE") {
    return 0.25 + random() * 0.15;
  }

  return null;
}

function createBaseTemperatureValue({ starType, orbitFraction, seed }) {
  const zoneInfo = ZONE_DATA[starType];
  if (!zoneInfo || zoneInfo.hzInner === null || zoneInfo.hzOuter === null) {
    return -272;
  }

  const habitableSpan = zoneInfo.hzOuter - zoneInfo.hzInner;
  if (habitableSpan <= 0) {
    return -272;
  }

  if (orbitFraction >= zoneInfo.hzInner) {
    const temperature = 100 - ((orbitFraction - zoneInfo.hzInner) / habitableSpan) * 100;
    return Math.max(-272, Math.round(temperature));
  }

  const starEdgeTemperature = createStarEdgeTemperature(starType, seed);
  const innerRatio = THREE.MathUtils.clamp(orbitFraction / zoneInfo.hzInner, 0, 1);
  const temperature = THREE.MathUtils.lerp(starEdgeTemperature, 100, innerRatio);

  return Math.round(temperature);
}

function createStarEdgeTemperature(starType, seed) {
  const range = STAR_TEMPERATURE_RANGES[starType];
  if (!range) {
    return 100;
  }

  const random = createRandom(seed);
  return range[0] + random() * (range[1] - range[0]);
}

function formatTemperatureValue(temperature) {
  return String(Math.round(temperature));
}

async function startPlanetEntryTransition(planet, clientX, clientY) {
  if (!planet || isPlanetEntryTransitioning || planetScreenController.isOpen() || systemScreenController.isTransitioning()) {
    return;
  }
  if (!isPlanetAccessibleForActiveSide(planet)) {
    return;
  }

  markPlanetViewVisitedForActiveSide(planet);
  closeSystemPlanetMenu();
  isPlanetEntryTransitioning = true;
  const transitionToken = ++planetEntryTransitionToken;
  const rendererPromise = loadPlanetScreenRenderer();
  lastClientPointer.set(clientX, clientY);
  clearSystemHover();
  closePlanetWindow();
  setPlanetEntryOverlayContent(planet);
  starWindow.style.setProperty("--planet-entry-origin-x", `${clientX}px`);
  starWindow.style.setProperty("--planet-entry-origin-y", `${clientY}px`);
  starWindow.style.setProperty("--planet-entry-scale", "1");
  planetEntryOverlay.classList.add("active");
  planetEntryOverlay.style.setProperty("--planet-entry-alpha", "0");
  const minOverlayVisiblePromise = delay(PLANET_ENTRY_MIN_OVERLAY_MS);

  await nextAnimationFrame();
  if (transitionToken !== planetEntryTransitionToken) {
    return;
  }

  starWindow.classList.add("planet-entry-moving");
  starWindow.style.setProperty("--planet-entry-scale", "9");
  planetEntryOverlay.style.setProperty("--planet-entry-alpha", "1");

  await delay(PLANET_ENTRY_ZOOM_MS);
  if (transitionToken !== planetEntryTransitionToken) {
    return;
  }

  try {
    await rendererPromise;
  } catch (error) {
    console.error("Planet screen module failed to load", error);
  }

  planetScreen.style.removeProperty("opacity");
  planetScreen.style.removeProperty("transition");
  planetScreenController.open(planet);
  await nextAnimationFrame();
  if (transitionToken !== planetEntryTransitionToken) {
    return;
  }

  await nextAnimationFrame();
  if (transitionToken !== planetEntryTransitionToken) {
    return;
  }

  await minOverlayVisiblePromise;
  if (transitionToken !== planetEntryTransitionToken) {
    return;
  }

  planetEntryOverlay.classList.add("leaving");
  planetEntryOverlay.style.setProperty("--planet-entry-alpha", "0");
  await delay(PLANET_ENTRY_FADE_MS);
  if (transitionToken !== planetEntryTransitionToken) {
    return;
  }

  planetEntryOverlay.classList.remove("active", "leaving");
  starWindow.classList.remove("planet-entry-moving");
  starWindow.style.setProperty("--planet-entry-scale", "1");
  isPlanetEntryTransitioning = false;
  planetScreenController.updateParallax(lastClientPointer.x, lastClientPointer.y);
  persistRuntimeSession("planet");
}

function setPlanetEntryOverlayContent(planet) {
  planetEntryOverlay.querySelector(".planet-entry-name").textContent = planet?.name ?? "";
  planetEntryOverlay.querySelector(".planet-entry-type").textContent = getPlanetEntryTypeLabel(planet);
}

function getPlanetEntryTypeLabel(body) {
  if (!body) {
    return "";
  }
  if (body.entryType) {
    return String(body.entryType).toUpperCase();
  }
  if (body.kind === "MOON") {
    return getMoonSizeLabel(body);
  }
  return getPlanetSizeLabel(body);
}

function showPlanetEntryLoadingOverlay(body) {
  setPlanetEntryOverlayContent(body);
  starWindow.classList.remove("planet-entry-moving");
  starWindow.style.setProperty("--planet-entry-scale", "1");
  planetEntryOverlay.classList.remove("leaving");
  planetEntryOverlay.classList.add("active");
  planetEntryOverlay.style.setProperty("--planet-entry-alpha", "1");
}

async function hidePlanetEntryLoadingOverlay() {
  if (!planetEntryOverlay.classList.contains("active")) {
    return;
  }

  planetEntryOverlay.classList.add("leaving");
  planetEntryOverlay.style.setProperty("--planet-entry-alpha", "0");
  await delay(PLANET_ENTRY_FADE_MS);
  planetEntryOverlay.classList.remove("active", "leaving");
}

function delay(ms) {
  return new Promise((resolve) => window.setTimeout(resolve, ms));
}

function nextAnimationFrame() {
  return new Promise((resolve) => requestAnimationFrame(resolve));
}

function openPlanetWindow(planet) {
  if (!planet) {
    return;
  }

  // Keep the window where it is when swapping to another planet; only recentre
  // it when opening fresh.
  const wasOpen = isPlanetWindowOpen;
  isPlanetWindowOpen = true;
  openPlanetData = planet;
  setSystemHover(null);

  if (!wasOpen) {
    planetWindowOffset.x = 0;
    planetWindowOffset.y = 0;
    planetWindow.style.setProperty("--pw-x", "0px");
    planetWindow.style.setProperty("--pw-y", "0px");
  }

  planetWindowTitle.textContent = planet.name;
  planetWindowSize.textContent = getPlanetSizeLabel(planet);
  planetWindowLore.textContent = planet.lore;
  renderPlanetStage(planet);

  const tags = [];
  if (planet.tidallyLocked) {
    tags.push("TIDALLY LOCKED");
  }
  if (planet.hasDisk) {
    tags.push("ACCRETION DISK");
  }
  planetWindowTags.replaceChildren(...tags.map((text) => {
    const tag = document.createElement("span");
    tag.className = "planet-window__tag";
    tag.textContent = text;
    return tag;
  }));
  planetWindowDivider.classList.toggle("empty", tags.length === 0);

  planetWindow.classList.add("visible");
  planetWindow.setAttribute("aria-hidden", "false");
}

function renderPlanetStage(planet) {
  planetWindowStage.replaceChildren();

  const center = PLANET_STAGE_WIDTH / 2;
  const displayPlanetRadius = THREE.MathUtils.clamp(planet.radius * 2.18, 24, 58);
  const visibleMoonCount = Math.min(planet.moonList.length, 3);
  const orbitGap = 30;
  const moonOrbitRadii = planet.moonList
    .slice(0, visibleMoonCount)
    .map((moon, index) => displayPlanetRadius + orbitGap * (index + 1) + THREE.MathUtils.clamp(moon.radius * 0.9, 2, 5));
  const diskScale = displayPlanetRadius / planet.radius;
  const farMoonOrbit = moonOrbitRadii.at(-1) ?? displayPlanetRadius;
  const scaledDisk = planet.accretionDisk
    ? createPlanetWindowDiskGeometry(planet.accretionDisk, diskScale, farMoonOrbit)
    : null;
  const diskOuterRadius = scaledDisk?.outerRadius ?? 0;
  const lowerExtent = Math.max(
    displayPlanetRadius,
    moonOrbitRadii.at(-1) ?? 0,
    diskOuterRadius > 0 ? diskOuterRadius : 0,
  );
  const upperExtent = displayPlanetRadius;
  const totalExtent = upperExtent + lowerExtent;
  const planetY = THREE.MathUtils.clamp(
    (PLANET_STAGE_HEIGHT - totalExtent) / 2 + upperExtent,
    upperExtent + 8,
    PLANET_STAGE_HEIGHT - lowerExtent - 8,
  );

  const planetElement = document.createElement("div");
  planetElement.className = "planet-window__planet";
  planetElement.style.width = `${displayPlanetRadius * 2}px`;
  planetElement.style.height = `${displayPlanetRadius * 2}px`;
  planetElement.style.left = `${center - displayPlanetRadius}px`;
  planetElement.style.top = `${planetY - displayPlanetRadius}px`;
  planetElement.append(createPlanetGlow(displayPlanetRadius, planet.starDirX, planet.starDirY));
  const displayGasGiantTexture = planet.gasGiantTextureSeed
    ? createGasGiantTexture(planet.gasGiantTextureSeed, GAS_GIANT_WINDOW_TEXTURE_HEIGHT)
    : planet.gasGiantTexture;
  const displayPlanetRotation = createPlanetRotationState({
    seed: SEED,
    systemId: planet.systemId,
    planetName: planet.name,
    tidallyLocked: planet.tidallyLocked,
  });
  planetElement.append(createPlanetSurface(
    planet.background,
    displayGasGiantTexture,
    null,
    displayPlanetRadius,
    planet.starDirX,
    planet.starDirY,
    true,
    false,
    {
      rotation: displayPlanetRotation,
    },
  ));
  planetWindowStage.append(planetElement);

  const caption = document.createElement("div");
  caption.className = "planet-window__caption";
  caption.style.left = `${Math.min(center + displayPlanetRadius + 12, PLANET_STAGE_WIDTH - 96)}px`;
  caption.style.top = `${Math.max(10, planetY - displayPlanetRadius * 0.42)}px`;
  caption.innerHTML = `
    <div class="planet-window__caption-name"></div>
    <div class="planet-window__caption-size"></div>
  `;
  caption.querySelector(".planet-window__caption-name").textContent = planet.name;
  caption.querySelector(".planet-window__caption-size").textContent = getPlanetSizeLabel(planet);
  planetWindowStage.append(caption);

  for (const [index, moon] of planet.moonList.slice(0, visibleMoonCount).entries()) {
    const moonRadius = THREE.MathUtils.clamp(moon.radius * 2.18, 2.6, 6.2);
    const orbitRadius = moonOrbitRadii[index];
    const angle = Math.PI / 2 + (index - (visibleMoonCount - 1) / 2) * 0.18;
    const orbit = document.createElement("div");
    orbit.className = "planet-window__moon-orbit";
    orbit.style.width = `${orbitRadius * 2}px`;
    orbit.style.height = `${orbitRadius * 2}px`;
    orbit.style.left = `${center}px`;
    orbit.style.top = `${planetY}px`;
    planetWindowStage.append(orbit);

    const moonElement = document.createElement("div");
    moonElement.className = "planet-window__moon";
    moonElement.style.width = `${moonRadius * 2}px`;
    moonElement.style.height = `${moonRadius * 2}px`;
    moonElement.style.left = `${center + Math.cos(angle) * orbitRadius - moonRadius}px`;
    moonElement.style.top = `${planetY + Math.sin(angle) * orbitRadius - moonRadius}px`;
    planetWindowStage.append(moonElement);
  }

  if (scaledDisk) {
    const disk = createAccretionDiskElement(
      scaledDisk,
      planet.diskShadowAngle,
      displayPlanetRadius * 2,
    );
    disk.className = "planet-window__disk planet-window__disk--bottom";
    const diskSize = Number.parseFloat(disk.style.width);
    disk.style.left = `${center - diskSize / 2}px`;
    disk.style.top = `${planetY - diskSize / 2}px`;
    planetWindowStage.append(disk);
  }
}

function createPlanetWindowDiskGeometry(accretionDisk, diskScale, farMoonOrbit) {
  const originalInner = accretionDisk.innerRadius * diskScale;
  const originalThickness = Math.max(8, (accretionDisk.outerRadius - accretionDisk.innerRadius) * diskScale);
  const minInnerRadius = farMoonOrbit + 38;
  const maxOuterRadius = PLANET_STAGE_HEIGHT - 18;
  const targetInnerRadius = Math.max(originalInner, minInnerRadius);
  const availableThickness = Math.max(8, maxOuterRadius - targetInnerRadius);
  const compressedThickness = Math.max(8, Math.min(originalThickness * 0.46, availableThickness));
  const innerRadius = Math.min(targetInnerRadius, maxOuterRadius - compressedThickness);
  const outerRadius = innerRadius + compressedThickness;
  const cutRadii = accretionDisk.cutRadii
    .map((cutRadius) => {
      const t = THREE.MathUtils.clamp(
        (cutRadius - accretionDisk.innerRadius) /
          Math.max(1, accretionDisk.outerRadius - accretionDisk.innerRadius),
        0,
        1,
      );
      return innerRadius + t * compressedThickness;
    })
    .filter((cutRadius) => cutRadius > innerRadius + 1.4 && cutRadius < outerRadius - 1.4);

  return {
    innerRadius,
    outerRadius,
    cutRadii,
  };
}

function updatePlanetLink() {
  if (!isPlanetWindowOpen || !openPlanetData?.element) {
    planetLinkPath.setAttribute("d", "");
    return;
  }

  const planetRect = openPlanetData.element.getBoundingClientRect();
  const planetCenterX = planetRect.left + planetRect.width / 2;
  const planetCenterY = planetRect.top + planetRect.height / 2;
  const planetRadius = planetRect.width / 2;

  const windowRect = planetWindow.getBoundingClientRect();
  const windowCenterX = windowRect.left + windowRect.width / 2;
  const windowCenterY = windowRect.top + windowRect.height / 2;

  // Unit vector from the planet centre toward the window centre.
  const toWindowX = windowCenterX - planetCenterX;
  const toWindowY = windowCenterY - planetCenterY;
  const distance = Math.hypot(toWindowX, toWindowY) || 1;
  const dirX = toWindowX / distance;
  const dirY = toWindowY / distance;

  // Start: nearest point on the planet — its edge toward the window centre.
  const startX = planetCenterX + dirX * planetRadius;
  const startY = planetCenterY + dirY * planetRadius;

  // End: nearest point on the window frame, modelled as a rounded rectangle so
  // the attachment point and its normal rotate smoothly around the corners.
  const cornerRadius = Math.min(30, windowRect.width / 2, windowRect.height / 2);
  const skeletonX = THREE.MathUtils.clamp(
    planetCenterX,
    windowRect.left + cornerRadius,
    windowRect.right - cornerRadius,
  );
  const skeletonY = THREE.MathUtils.clamp(
    planetCenterY,
    windowRect.top + cornerRadius,
    windowRect.bottom - cornerRadius,
  );
  let normalX = planetCenterX - skeletonX;
  let normalY = planetCenterY - skeletonY;
  const normalLength = Math.hypot(normalX, normalY);
  if (normalLength < 0.001) {
    normalX = -dirX;
    normalY = -dirY;
  } else {
    normalX /= normalLength;
    normalY /= normalLength;
  }
  const endX = skeletonX + normalX * cornerRadius;
  const endY = skeletonY + normalY * cornerRadius;

  // Bezier arms scale with the gap the curve actually spans, so a window held
  // close to the planet produces a short, untangled line.
  const span = Math.hypot(endX - startX, endY - startY);
  const arm = Math.min(span * 0.42, 220);
  const control1X = startX + dirX * arm;
  const control1Y = startY + dirY * arm;
  const control2X = endX + normalX * arm;
  const control2Y = endY + normalY * arm;

  planetLinkPath.setAttribute(
    "d",
    `M ${startX.toFixed(1)} ${startY.toFixed(1)} C ${control1X.toFixed(1)} ${control1Y.toFixed(1)}, ${control2X.toFixed(1)} ${control2Y.toFixed(1)}, ${endX.toFixed(1)} ${endY.toFixed(1)}`,
  );
}

function closePlanetWindow() {
  if (!isPlanetWindowOpen) {
    return;
  }

  isPlanetWindowOpen = false;
  openPlanetData = null;
  isDraggingPlanetWindow = false;
  planetWindow.classList.remove("visible", "dragging");
  planetWindow.setAttribute("aria-hidden", "true");
  planetLinkPath.setAttribute("d", "");
}

function renderSystemJumps({
  node,
  starX,
  centerY,
  width,
  height,
  starRadius,
  minOrbit,
  maxOrbit,
  orbitRadii,
  occupiedPlanets,
  random,
  fleetAnchors = [],
}) {
  const neighbors = Array.from(adjacency.get(node.id) ?? [])
    .map((id) => nodes[id])
    .sort((left, right) => left.name.localeCompare(right.name));
  const gateRadius = getSystemPlanetRadius(0);

  neighbors.forEach((neighbor, index) => {
    const position = createSystemJumpPosition({
      index,
      count: neighbors.length,
      starX,
      centerY,
      width,
      height,
      starRadius,
      minOrbit,
      maxOrbit,
      orbitRadii,
      occupiedPlanets,
      gateRadius,
      random,
    });
    const directionLength = Math.max(1, Math.hypot(position.x - starX, position.y - centerY));
    const stepX = ((position.x - starX) / directionLength) * 10;
    const stepY = ((position.y - centerY) / directionLength) * 10;
    const anchorDirectionX = stepX / 10;
    const anchorDirectionY = stepY / 10;
    const anchorDistance = getSystemFleetAnchorDistance(gateRadius);
    const gate = createSystemGate({
      className: "system-jump",
      labelText: `TO ${neighbor.name}`,
      radius: gateRadius,
      x: position.x,
      y: position.y,
      stepX,
      stepY,
    });
    gate.classList.toggle("system-jump--locked", !isSystemAccessibleForActiveSide(neighbor));
    gate.setAttribute("aria-disabled", String(!isSystemAccessibleForActiveSide(neighbor)));
    gate.dataset.targetSystemId = String(neighbor.id);
    gate.dataset.kind = neighbor.starType;
    gate.dataset.planets = String(neighbor.planets);
    fleetAnchors.push({
      anchorKey: `link:${neighbor.id}`,
      type: "link",
      systemId: String(node.id),
      targetSystemId: String(neighbor.id),
      x: position.x,
      y: position.y,
      slotRadius: anchorDistance,
      radius: gateRadius,
      alignX: getSystemFleetMarkerAlignX(anchorDirectionX),
    });
    gate.addEventListener("click", (event) => {
      event.stopPropagation();
      if (commandSelectedFleetToLink(node.id, neighbor.id)) {
        return;
      }
      if (!isSystemAccessibleForActiveSide(neighbor)) {
        return;
      }
      startSystemJumpTransition(neighbor, stepX / 10, stepY / 10, gate, event.clientX, event.clientY);
    });
    starSystem.append(gate);
  });

  const wormholes = outerLinks
    .filter((link) => link.parentId === node.id)
    .sort((left, right) => left.end.lengthSq() - right.end.lengthSq());

  wormholes.forEach((link, index) => {
    const position = createSystemWormholePosition({
      index,
      count: wormholes.length,
      starX,
      centerY,
      width,
      height,
      minOrbit,
      maxOrbit,
      occupiedPlanets,
      gateRadius: 6,
      random,
    });
    const directionLength = Math.max(1, Math.hypot(position.x - starX, position.y - centerY));
    const stepX = ((position.x - starX) / directionLength) * 14;
    const stepY = ((position.y - centerY) / directionLength) * 14;
    const anchorDirectionX = stepX / 14;
    const anchorDirectionY = stepY / 14;
    const anchorDistance = getSystemFleetAnchorDistance(6);
    const gate = createSystemGate({
      className: "system-jump system-jump--wormhole",
      labelText: "WORMHOLE",
      radius: 6,
      x: position.x,
      y: position.y,
      stepX,
      stepY,
      echoCount: 12,
    });
    const wormholeKey = createOuterLinkKey(link);
    gate.dataset.wormholeKey = wormholeKey;
    fleetAnchors.push({
      anchorKey: `wormhole:${wormholeKey}`,
      type: "wormhole",
      systemId: String(node.id),
      wormholeKey,
      x: position.x,
      y: position.y,
      slotRadius: anchorDistance,
      radius: 6,
      alignX: getSystemFleetMarkerAlignX(anchorDirectionX),
    });
    gate.querySelectorAll(".system-jump__echo").forEach((ring, ringIndex) => {
      const index = ringIndex + 1;
      const progress = (index - 1) / 11;
      // First ring offset by 15px; each subsequent gap grows by 3px.
      const ringDistance = (n) => (n <= 0 ? 0 : 1.5 * n * n + 8.5 * n + 5);
      const distance = ringDistance(index);
      const exitDistance = ringDistance(index - 1);
      const channel = Math.round(255 * (1 - progress));
      ring.style.setProperty("--wormhole-x", `${(stepX / 14) * distance}px`);
      ring.style.setProperty("--wormhole-y", `${(stepY / 14) * distance}px`);
      ring.style.setProperty("--wormhole-exit-x", `${(stepX / 14) * exitDistance}px`);
      ring.style.setProperty("--wormhole-exit-y", `${(stepY / 14) * exitDistance}px`);
      ring.style.setProperty("--wormhole-size", `${index * 2}px`);
      ring.style.setProperty("--wormhole-blur", `${0.1 + progress * 7.9}px`);
      ring.style.setProperty("--wormhole-alpha", `${0.28 + (index / 12) * 0.72}`);
      ring.style.setProperty("--wormhole-color", `rgba(255, ${channel}, ${channel}, ${0.34 + progress * 0.66})`);
      ring.style.transitionDelay = `${(index - 1) * 42}ms`;
    });
    gate.type = "button";
    gate.tabIndex = -1;
    gate.addEventListener("click", (event) => {
      event.stopPropagation();
      moveSelectedFleetToWormhole(node.id, wormholeKey);
    });
    starSystem.append(gate);
  });
}

function rerenderActiveSystemFleetMarkers() {
  const activeNode = systemScreenController?.state?.activeNode ?? null;
  if (!activeNode || !systemScreenController?.isOpen?.()) {
    return;
  }
  renderSystemFleetMarkers(activeNode, activeSystemFleetAnchors);
}

function renderSystemFleetMarkers(node, anchors = []) {
  starSystem.querySelectorAll(".system-fleet-marker").forEach((marker) => {
    captureSystemFleetMarkerPosition(marker);
    cancelFleetMarkerAnimation(marker.dataset.fleetId);
    marker.remove();
  });
  if (!node) {
    return;
  }

  const fleets = getVisibleFleetsForSystem(node.id);
  const anchorSlotStates = new Map();
  fleets.forEach((fleet) => {
    const anchor = getFleetSystemAnchor(fleet, anchors);
    if (!anchor) {
      return;
    }

    const marker = createSystemFleetMarker(fleet);
    marker.dataset.systemId = String(node.id);
    marker.dataset.anchorKey = anchor.anchorKey;
    const targetPosition = getSystemFleetMarkerTargetPosition(fleet, anchor, node, anchorSlotStates);
    marker.userData = { ...(marker.userData ?? {}), fleetTargetPosition: targetPosition };
    const previousPosition = fleetMarkerPositions.get(fleet.id);
    const shouldAnimate = shouldAnimateFleetMarker(previousPosition, targetPosition);
    marker.style.left = `${Math.round(shouldAnimate ? previousPosition.left : targetPosition.left)}px`;
    marker.style.top = `${Math.round(shouldAnimate ? previousPosition.top : targetPosition.top)}px`;
    starSystem.append(marker);
    if (shouldAnimate) {
      animateFleetMarker(marker, fleet, previousPosition, targetPosition);
    } else {
      setFleetMarkerStoredPosition(fleet.id, targetPosition);
    }
  });
}

function updateSystemFleetMarkerDrift(now) {
  if (!systemScreenController?.isOpen?.() || planetScreenController.isOpen() || isObjectDetailOpen) {
    return;
  }

  starSystem.querySelectorAll(".system-fleet-marker").forEach((marker) => {
    if (
      marker.classList.contains("system-fleet-marker--moving") ||
      marker.classList.contains("system-fleet-marker--link-jump")
    ) {
      return;
    }

    const target = marker.userData?.fleetTargetPosition;
    if (!target?.useAnchorDrift) {
      return;
    }

    const visualTarget = getSystemFleetMarkerVisualTarget(target, now);
    marker.style.left = `${visualTarget.left.toFixed(2)}px`;
    marker.style.top = `${visualTarget.top.toFixed(2)}px`;
    setFleetMarkerStoredPosition(marker.dataset.fleetId, visualTarget);
  });
}

function getSystemDecorTrailRandom() {
  if (!systemDecorTrailRandom) {
    systemDecorTrailRandom = createRandom(`${SEED}:system-decor-trails`);
  }
  return systemDecorTrailRandom();
}

function resetSystemDecorTrails() {
  systemDecorTrailLayer?.remove();
  systemDecorTrailLayer = null;
  systemDecorTrails = [];
  systemDecorTrailSchedules.clear();
}

function ensureSystemDecorTrailLayer() {
  if (systemDecorTrailLayer?.isConnected && systemDecorTrailLayer.parentElement === starSystem) {
    systemDecorTrailLayer.setAttribute("viewBox", `0 0 ${window.innerWidth} ${window.innerHeight}`);
    return systemDecorTrailLayer;
  }

  const layer = document.createElementNS(SVG_NAMESPACE, "svg");
  layer.classList.add("system-decor-trail-layer");
  layer.setAttribute("aria-hidden", "true");
  layer.setAttribute("viewBox", `0 0 ${window.innerWidth} ${window.innerHeight}`);
  systemDecorTrailLayer = layer;
  starSystem.append(layer);
  return layer;
}

function getSystemElementCenter(element) {
  const left = Number.parseFloat(element.style.left);
  const top = Number.parseFloat(element.style.top);
  const width = Number.parseFloat(element.style.width) || element.offsetWidth;
  const height = Number.parseFloat(element.style.height) || element.offsetHeight;
  if (![left, top, width, height].every(Number.isFinite)) {
    return null;
  }
  return {
    x: left + width / 2,
    y: top + height / 2,
  };
}

function getSystemDecorTrailTargets() {
  const targets = [];

  starSystem.querySelectorAll(".system-planet-hit").forEach((element) => {
    const planetKey = getPlanetExplorationKey(element.userData?.planet) || element.dataset.name || "";
    const ownership = getPlanetOwnership(planetKey);
    if (!ownership) {
      return;
    }

    const center = getSystemElementCenter(element);
    if (!center) {
      return;
    }
    targets.push({
      ...center,
      key: `planet:${planetKey || targets.length}`,
      type: "planet",
      color: "#ffffff",
    });
  });

  starSystem.querySelectorAll(".system-jump[data-target-system-id]:not(.system-jump--locked)").forEach((element) => {
    const center = getSystemElementCenter(element);
    if (!center) {
      return;
    }
    targets.push({
      ...center,
      key: `gate:${element.dataset.targetSystemId || targets.length}`,
      type: "gate",
      color: "#bfeaff",
    });
  });

  return targets;
}

function createSystemDecorTrailSpawnDelayMs() {
  return (1 + getSystemDecorTrailRandom() * 9) * 1000;
}

function createSystemDecorTrail(from, to) {
  const random = getSystemDecorTrailRandom;
  const dx = to.x - from.x;
  const dy = to.y - from.y;
  const distance = Math.hypot(dx, dy);
  if (distance < 36) {
    return null;
  }

  const normalX = -dy / distance;
  const normalY = dx / distance;
  const bendDirection = random() < 0.5 ? -1 : 1;
  const bend = distance * (0.14 + random() * 0.24) * bendDirection;
  const drift = Math.min(72, distance * 0.16);
  const controlX = (from.x + to.x) / 2 + normalX * bend + (random() - 0.5) * drift;
  const controlY = (from.y + to.y) / 2 + normalY * bend + (random() - 0.5) * drift;
  const durationMs = Math.round((620 + distance * (0.44 + random() * 0.22)) * 4);
  const trailElement = document.createElementNS(SVG_NAMESPACE, "g");
  const gradientId = `system-decor-trail-gradient-${++systemDecorTrailSerial}`;
  const routeGradientId = `system-decor-route-gradient-${systemDecorTrailSerial}`;
  const defs = document.createElementNS(SVG_NAMESPACE, "defs");
  const gradient = document.createElementNS(SVG_NAMESPACE, "linearGradient");
  gradient.setAttribute("id", gradientId);
  gradient.setAttribute("gradientUnits", "userSpaceOnUse");
  [
    ["0%", "0"],
    ["28%", "0.12"],
    ["72%", "0.48"],
    ["100%", "0.9"],
  ].forEach(([offset, opacity]) => {
    const stop = document.createElementNS(SVG_NAMESPACE, "stop");
    stop.setAttribute("offset", offset);
    stop.setAttribute("stop-color", "#ffffff");
    stop.setAttribute("stop-opacity", opacity);
    gradient.append(stop);
  });
  defs.append(gradient);

  const routeGradient = document.createElementNS(SVG_NAMESPACE, "linearGradient");
  routeGradient.setAttribute("id", routeGradientId);
  routeGradient.setAttribute("gradientUnits", "userSpaceOnUse");
  [
    ["0%", "0"],
    ["9%", "1"],
    ["91%", "1"],
    ["100%", "0"],
  ].forEach(([offset, opacity]) => {
    const stop = document.createElementNS(SVG_NAMESPACE, "stop");
    stop.setAttribute("offset", offset);
    stop.setAttribute("stop-color", "#ffffff");
    stop.setAttribute("stop-opacity", opacity);
    routeGradient.append(stop);
  });
  defs.append(routeGradient);

  const routePath = document.createElementNS(SVG_NAMESPACE, "path");
  routePath.classList.add("system-decor-trail__route");
  routePath.style.stroke = `url(#${routeGradientId})`;

  const path = document.createElementNS(SVG_NAMESPACE, "path");
  path.classList.add("system-decor-trail__trace");
  path.style.stroke = `url(#${gradientId})`;

  const head = document.createElementNS(SVG_NAMESPACE, "circle");
  head.classList.add("system-decor-trail__head");
  head.setAttribute("r", (1.35 + random() * 0.45).toFixed(2));

  trailElement.classList.add("system-decor-trail");
  trailElement.append(defs, routePath, path, head);
  const trail = {
    element: trailElement,
    routePath,
    path,
    head,
    gradient,
    routeGradient,
    start: { x: from.x, y: from.y },
    control: { x: controlX, y: controlY },
    end: { x: to.x, y: to.y },
    startedAt: performance.now(),
    durationMs,
    tailLength: 0.17 + random() * 0.06,
    routeFadeMs: 1000,
  };
  updateSystemDecorTrailElement(trail, trail.startedAt);
  return trail;
}

function getSystemDecorTrailPoint(trail, progress) {
  const t = THREE.MathUtils.clamp(progress, 0, 1);
  const inverse = 1 - t;
  return {
    x: inverse * inverse * trail.start.x + 2 * inverse * t * trail.control.x + t * t * trail.end.x,
    y: inverse * inverse * trail.start.y + 2 * inverse * t * trail.control.y + t * t * trail.end.y,
  };
}

function buildSystemDecorTrailSegmentPath(trail, progress) {
  const fromProgress = Math.max(0, progress - trail.tailLength);
  const sampleCount = 7;
  const commands = [];
  for (let index = 0; index <= sampleCount; index += 1) {
    const t = fromProgress + (progress - fromProgress) * (index / sampleCount);
    const point = getSystemDecorTrailPoint(trail, t);
    commands.push(`${index === 0 ? "M" : "L"} ${point.x.toFixed(1)} ${point.y.toFixed(1)}`);
  }
  return commands.join(" ");
}

function buildSystemDecorRoutePath(trail, progress) {
  const startProgress = 0.035;
  const endProgress = Math.min(0.965, Math.max(startProgress, progress));
  if (endProgress <= startProgress) {
    const point = getSystemDecorTrailPoint(trail, startProgress);
    return `M ${point.x.toFixed(1)} ${point.y.toFixed(1)}`;
  }

  const sampleCount = 18;
  const commands = [];
  for (let index = 0; index <= sampleCount; index += 1) {
    const t = startProgress + (endProgress - startProgress) * (index / sampleCount);
    const point = getSystemDecorTrailPoint(trail, t);
    commands.push(`${index === 0 ? "M" : "L"} ${point.x.toFixed(1)} ${point.y.toFixed(1)}`);
  }
  return commands.join(" ");
}

function updateSystemDecorTrailElement(trail, now) {
  const elapsedMs = now - trail.startedAt;
  const rawProgress = THREE.MathUtils.clamp(elapsedMs / trail.durationMs, 0, 1);
  const progress = smoothstep(0, 1, rawProgress);
  const headPoint = getSystemDecorTrailPoint(trail, progress);
  const tailPoint = getSystemDecorTrailPoint(trail, Math.max(0, progress - trail.tailLength));
  const opacity =
    smoothstep(0, 0.08, rawProgress) *
    (1 - smoothstep(0.82, 1, rawProgress));
  const routeEndProgress = rawProgress >= 1 ? 1 : progress;
  const routeStartPoint = getSystemDecorTrailPoint(trail, 0.035);
  const routeEndPoint = getSystemDecorTrailPoint(trail, 0.965);
  const routeHoldProgress = THREE.MathUtils.clamp((elapsedMs - trail.durationMs) / trail.routeFadeMs, 0, 1);
  const routeOpacity = rawProgress < 1 ? 1 : 1 - smoothstep(0, 1, routeHoldProgress);

  trail.routePath.setAttribute("d", buildSystemDecorRoutePath(trail, routeEndProgress));
  trail.routePath.style.opacity = String(0.05 * routeOpacity);
  trail.routeGradient.setAttribute("x1", routeStartPoint.x.toFixed(1));
  trail.routeGradient.setAttribute("y1", routeStartPoint.y.toFixed(1));
  trail.routeGradient.setAttribute("x2", routeEndPoint.x.toFixed(1));
  trail.routeGradient.setAttribute("y2", routeEndPoint.y.toFixed(1));
  trail.path.setAttribute("d", buildSystemDecorTrailSegmentPath(trail, progress));
  trail.path.style.opacity = String(0.78 * opacity);
  trail.gradient.setAttribute("x1", tailPoint.x.toFixed(1));
  trail.gradient.setAttribute("y1", tailPoint.y.toFixed(1));
  trail.gradient.setAttribute("x2", headPoint.x.toFixed(1));
  trail.gradient.setAttribute("y2", headPoint.y.toFixed(1));
  trail.head.setAttribute("cx", headPoint.x.toFixed(1));
  trail.head.setAttribute("cy", headPoint.y.toFixed(1));
  trail.head.style.opacity = String(0.96 * opacity);

  return elapsedMs < trail.durationMs + trail.routeFadeMs;
}

function spawnSystemDecorTrail(from, targets) {
  if (!from || targets.length < 2) {
    return;
  }

  const availableTargets = targets.filter((target) => target.key !== from.key);
  if (availableTargets.length === 0) {
    return;
  }

  const toIndex = Math.floor(getSystemDecorTrailRandom() * availableTargets.length);
  const to = availableTargets[toIndex];
  const trail = createSystemDecorTrail(from, to);
  if (!trail) {
    return;
  }

  const layer = ensureSystemDecorTrailLayer();
  systemDecorTrails.push(trail);
  layer.append(trail.element);
}

function syncSystemDecorTrailSchedules(targets, now) {
  const visibleKeys = new Set(targets.map((target) => target.key));
  for (const key of Array.from(systemDecorTrailSchedules.keys())) {
    if (!visibleKeys.has(key)) {
      systemDecorTrailSchedules.delete(key);
    }
  }

  for (const target of targets) {
    if (systemDecorTrailSchedules.has(target.key)) {
      continue;
    }
    systemDecorTrailSchedules.set(target.key, now + createSystemDecorTrailSpawnDelayMs());
  }
}

function updateSystemDecorTrails(now) {
  if (!systemScreenController?.isOpen?.() || planetScreenController.isOpen() || isObjectDetailOpen) {
    return;
  }

  for (let index = systemDecorTrails.length - 1; index >= 0; index -= 1) {
    const trail = systemDecorTrails[index];
    if (updateSystemDecorTrailElement(trail, now)) {
      continue;
    }
    trail.element.remove();
    systemDecorTrails.splice(index, 1);
  }

  const targets = getSystemDecorTrailTargets();
  if (targets.length < 2) {
    systemDecorTrailSchedules.clear();
    return;
  }

  syncSystemDecorTrailSchedules(targets, now);
  for (const target of targets) {
    const nextSpawnAt = systemDecorTrailSchedules.get(target.key);
    if (!Number.isFinite(nextSpawnAt) || now < nextSpawnAt) {
      continue;
    }
    spawnSystemDecorTrail(target, targets);
    systemDecorTrailSchedules.set(target.key, now + createSystemDecorTrailSpawnDelayMs());
  }
}

function getSystemFleetMarkerTargetPosition(fleet, anchor, node, anchorSlotStates) {
  const state = getSystemFleetAnchorSlotState(anchorSlotStates, anchor.anchorKey);
  if (shouldUseSystemFleetAnchorRings(anchor)) {
    const slot = resolveFleetAnchorSlot(fleet, anchor, state);
    const target = getFleetAnchorSlotTarget(anchor, slot, node);
    return getSystemFleetMarkerVisualTarget(target, performance.now());
  }

  if (anchor.type !== "planet") {
    const useIndex = state.stackIndex++;
    const offsetY = (useIndex - Math.max(0, state.stackIndex - 1) / 2) * FLEET_SYSTEM_MARKER_STACK_GAP;
    const position = getSystemFleetMarkerTopLeft({
      x: anchor.x,
      y: anchor.y + offsetY,
      alignX: anchor.alignX,
    });
    return {
      systemId: String(node.id),
      anchorKey: anchor.anchorKey,
      left: position.left,
      top: position.top,
    };
  }

  const slot = resolveFleetAnchorSlot(fleet, anchor, state);
  const target = getFleetAnchorSlotTarget(anchor, slot, node);
  return getSystemFleetMarkerVisualTarget(target, performance.now());
}

function shouldUseSystemFleetAnchorRings(anchor) {
  return anchor?.type === "planet" || anchor?.type === "link" || anchor?.type === "wormhole";
}

function getSystemFleetAnchorSlotState(anchorSlotStates, anchorKey) {
  if (!anchorSlotStates.has(anchorKey)) {
    anchorSlotStates.set(anchorKey, {
      usedInnerSlots: new Set(),
      usedOuterSlots: new Set(),
      overflowIndex: 0,
      stackIndex: 0,
    });
  }
  return anchorSlotStates.get(anchorKey);
}

function resolveFleetAnchorSlot(fleet, anchor, state) {
  const preferredSlot = normalizeFleetSlotIndex(fleet.location?.slotIndex)
    ?? createFallbackFleetPlanetSlotIndex(fleet, anchor);
  for (let offset = 0; offset < FLEET_SYSTEM_SLOT_COUNT; offset += 1) {
    const candidate = (preferredSlot + offset) % FLEET_SYSTEM_SLOT_COUNT;
    if (!state.usedInnerSlots.has(candidate)) {
      state.usedInnerSlots.add(candidate);
      return { ring: 0, index: candidate };
    }
  }

  const outerPreferredSlot = createFallbackFleetOuterSlotIndex(fleet, anchor);
  for (let offset = 0; offset < FLEET_SYSTEM_OUTER_SLOT_COUNT; offset += 1) {
    const candidate = (outerPreferredSlot + offset) % FLEET_SYSTEM_OUTER_SLOT_COUNT;
    if (!state.usedOuterSlots.has(candidate)) {
      state.usedOuterSlots.add(candidate);
      return { ring: 1, index: candidate };
    }
  }

  const overflowIndex = state.overflowIndex++;
  return {
    ring: 2 + Math.floor(overflowIndex / FLEET_SYSTEM_OUTER_SLOT_COUNT),
    index: overflowIndex % FLEET_SYSTEM_OUTER_SLOT_COUNT,
  };
}

function createFallbackFleetPlanetSlotIndex(fleet, anchor) {
  const random = createRandom([
    SEED,
    "fleet-slot-fallback",
    fleet?.id,
    anchor?.systemId,
    anchor?.planetKey,
  ].join(":"));
  return Math.floor(random() * FLEET_SYSTEM_SLOT_COUNT);
}

function createFallbackFleetOuterSlotIndex(fleet, anchor) {
  const random = createRandom([
    SEED,
    "fleet-outer-slot-fallback",
    fleet?.id,
    anchor?.systemId,
    anchor?.anchorKey,
  ].join(":"));
  return Math.floor(random() * FLEET_SYSTEM_OUTER_SLOT_COUNT);
}

function getFleetAnchorSlotTarget(anchor, slot, node) {
  const slotCount = slot.ring === 0 ? FLEET_SYSTEM_SLOT_COUNT : FLEET_SYSTEM_OUTER_SLOT_COUNT;
  const angleOffset = slot.ring === 0
    ? -Math.PI / 2
    : -Math.PI / 2 + Math.PI / slotCount;
  const angle = angleOffset + slot.index * (Math.PI * 2 / slotCount);
  return {
    systemId: String(node.id),
    anchorKey: anchor.anchorKey,
    anchorX: Number(anchor.x) || 0,
    anchorY: Number(anchor.y) || 0,
    slotAngle: angle,
    slotRadius: getFleetAnchorSlotRadius(anchor, slot.ring),
    driftKey: `${node.id}:${anchor.anchorKey}`,
    useAnchorDrift: true,
  };
}

function getFleetAnchorSlotRadius(anchor, ring) {
  const radius = Number(anchor.slotRadius) || Number(anchor.radius) || 18;
  const ringGap = Math.max(22, Math.min(54, radius * 0.24));
  return radius + ringGap * ring;
}

function getSystemFleetAnchorDriftSpec(driftKey) {
  const key = String(driftKey ?? "anchor");
  if (!systemFleetAnchorDriftSpecs.has(key)) {
    const random = createRandom(`${SEED}:fleet-anchor-drift:${key}`);
    systemFleetAnchorDriftSpecs.set(key, {
      phase: random() * Math.PI * 2,
      periodMs: 52000 + random() * 36000,
      wobblePhaseX: random() * Math.PI * 2,
      wobblePhaseY: random() * Math.PI * 2,
      wobblePeriodX: 9000 + random() * 9000,
      wobblePeriodY: 11000 + random() * 11000,
      wobbleX: 3 + random() * 4,
      wobbleY: 2.5 + random() * 3.5,
    });
  }
  return systemFleetAnchorDriftSpecs.get(key);
}

function getSystemFleetAnchorDrift(driftKey, now) {
  const spec = getSystemFleetAnchorDriftSpec(driftKey);
  const time = Number(now) || 0;
  return {
    angle: spec.phase + (time / spec.periodMs) * Math.PI * 2,
    x: Math.sin(time / spec.wobblePeriodX + spec.wobblePhaseX) * spec.wobbleX,
    y: Math.sin(time / spec.wobblePeriodY + spec.wobblePhaseY) * spec.wobbleY,
  };
}

function getSystemFleetMarkerVisualTarget(target, now) {
  if (!target?.useAnchorDrift) {
    return target;
  }

  const drift = getSystemFleetAnchorDrift(target.driftKey, now);
  const angle = target.slotAngle + drift.angle;
  const point = {
    x: target.anchorX + drift.x + Math.cos(angle) * target.slotRadius,
    y: target.anchorY + drift.y + Math.sin(angle) * target.slotRadius,
    alignX: Math.cos(angle),
  };
  return {
    ...target,
    ...getSystemFleetMarkerTopLeft(point),
  };
}

function getLiveSystemFleetMarkerTarget(target, now) {
  return target?.useAnchorDrift ? getSystemFleetMarkerVisualTarget(target, now) : target;
}

function getSystemFleetMarkerTopLeft(point) {
  const alignX = THREE.MathUtils.clamp(Number(point?.alignX) || 0, -1, 1);
  const x = Number(point?.x) || 0;
  const y = Number(point?.y) || 0;
  const left = x - FLEET_SYSTEM_MARKER_WIDTH / 2 + alignX * FLEET_SYSTEM_MARKER_WIDTH / 2;

  return {
    left,
    top: y - FLEET_SYSTEM_MARKER_HEIGHT / 2,
  };
}

function getSystemFleetMarkerAlignX(value) {
  const normalized = Number(value) || 0;
  if (normalized < -0.35) {
    return -1;
  }
  if (normalized > 0.35) {
    return 1;
  }
  return 0;
}

function getSystemFleetAnchorDistance(radius) {
  const normalizedRadius = Math.max(1, Number(radius) || 1);
  const baseDistance = Math.max(normalizedRadius * 3, FLEET_SYSTEM_MARKER_WIDTH * 0.75);
  return baseDistance * (2 / 3);
}

function getFleetMarkerIdleDelay(fleet) {
  const source = String(fleet?.id ?? "");
  let hash = 0;
  for (let index = 0; index < source.length; index += 1) {
    hash = ((hash << 5) - hash + source.charCodeAt(index)) | 0;
  }
  return `${-((Math.abs(hash) % 780) / 100).toFixed(2)}s`;
}

function shouldAnimateFleetMarker(previousPosition, targetPosition) {
  if (suppressFleetMarkerAnimation || !previousPosition || !targetPosition) {
    return false;
  }
  if (previousPosition.systemId !== targetPosition.systemId) {
    return false;
  }

  return Math.hypot(
    previousPosition.left - targetPosition.left,
    previousPosition.top - targetPosition.top,
  ) > 6;
}

function captureSystemFleetMarkerPositions() {
  starSystem.querySelectorAll(".system-fleet-marker").forEach(captureSystemFleetMarkerPosition);
}

function captureSystemFleetMarkerPosition(marker) {
  if (!marker?.dataset?.fleetId) {
    return;
  }

  const left = Number.parseFloat(marker.style.left);
  const top = Number.parseFloat(marker.style.top);
  if (!Number.isFinite(left) || !Number.isFinite(top)) {
    return;
  }

  setFleetMarkerStoredPosition(marker.dataset.fleetId, {
    systemId: marker.dataset.systemId ?? normalizeRuntimeNullableString(systemScreenController?.state?.activeNode?.id),
    anchorKey: marker.dataset.anchorKey ?? "",
    left,
    top,
  });
}

function setFleetMarkerStoredPosition(fleetId, position) {
  const normalizedFleetId = String(fleetId ?? "").trim();
  if (!normalizedFleetId || !position) {
    return;
  }

  fleetMarkerPositions.set(normalizedFleetId, {
    systemId: String(position.systemId ?? ""),
    anchorKey: String(position.anchorKey ?? ""),
    left: Number(position.left) || 0,
    top: Number(position.top) || 0,
  });
}

function animateFleetMarker(marker, fleet, from, to) {
  cancelFleetMarkerAnimation(fleet.id);
  const movement = createFleetMovement(from, to, fleet.id);
  const startedAt = performance.now();
  marker.classList.add("system-fleet-marker--moving");

  const tick = (now) => {
    if (!marker.isConnected) {
      cancelFleetMarkerAnimation(fleet.id);
      return;
    }

    const progress = THREE.MathUtils.clamp((now - startedAt) / movement.duration, 0, 1);
    const easedProgress = easeFleetMovement(progress);
    const liveTarget = getLiveSystemFleetMarkerTarget(to, now);
    const liveEnd = { x: liveTarget.left, y: liveTarget.top };
    const liveEndOffset = {
      x: liveEnd.x - movement.end.x,
      y: liveEnd.y - movement.end.y,
    };
    const liveControlB = {
      x: movement.controlB.x + liveEndOffset.x,
      y: movement.controlB.y + liveEndOffset.y,
    };
    const point = getCubicBezierPoint(
      movement.start,
      movement.controlA,
      liveControlB,
      liveEnd,
      easedProgress,
    );
    marker.style.left = `${point.x.toFixed(2)}px`;
    marker.style.top = `${point.y.toFixed(2)}px`;
    setFleetMarkerStoredPosition(fleet.id, {
      ...to,
      left: point.x,
      top: point.y,
    });

    if (progress < 1) {
      const frameId = requestAnimationFrame(tick);
      fleetMarkerAnimations.set(fleet.id, { frameId, marker });
      return;
    }

    marker.style.left = `${liveTarget.left.toFixed(2)}px`;
    marker.style.top = `${liveTarget.top.toFixed(2)}px`;
    marker.classList.remove("system-fleet-marker--moving");
    setFleetMarkerStoredPosition(fleet.id, liveTarget);
    fleetMarkerAnimations.delete(fleet.id);
  };

  const frameId = requestAnimationFrame(tick);
  fleetMarkerAnimations.set(fleet.id, { frameId, marker });
}

function createFleetMovement(from, to, fleetId) {
  const start = { x: from.left, y: from.top };
  const end = { x: to.left, y: to.top };
  const dx = end.x - start.x;
  const dy = end.y - start.y;
  const length = Math.max(1, Math.hypot(dx, dy));
  const baseAngle = Math.atan2(dy, dx);
  const random = createRandom([
    SEED,
    "fleet-move",
    fleetId,
    ++fleetMovementSerial,
    from.anchorKey,
    to.anchorKey,
    Math.round(start.x),
    Math.round(start.y),
    Math.round(end.x),
    Math.round(end.y),
  ].join(":"));
  const side = random() < 0.5 ? -1 : 1;
  const bendA = THREE.MathUtils.degToRad(4 + random() * 21) * side;
  const bendB = THREE.MathUtils.degToRad(4 + random() * 21) * side;
  const shoulder = length * 0.25;

  return {
    start,
    end,
    controlA: {
      x: start.x + Math.cos(baseAngle + bendA) * shoulder,
      y: start.y + Math.sin(baseAngle + bendA) * shoulder,
    },
    controlB: {
      x: end.x - Math.cos(baseAngle + bendB) * shoulder,
      y: end.y - Math.sin(baseAngle + bendB) * shoulder,
    },
    duration: getFleetMovementDuration(length),
  };
}

function getFleetMovementDuration(length) {
  return THREE.MathUtils.clamp(720 + length * 4.6, 860, 3600);
}

function easeFleetMovement(progress) {
  const accelerationShare = 0.34;
  const cruiseShare = 0.32;
  const decelerationShare = 0.34;
  const accelerationDistance = 0.25;
  const cruiseDistance = 0.5;
  const decelerationDistance = 0.25;

  if (progress < accelerationShare) {
    const localProgress = progress / accelerationShare;
    return accelerationDistance * localProgress * localProgress * localProgress;
  }

  if (progress < accelerationShare + cruiseShare) {
    const localProgress = (progress - accelerationShare) / cruiseShare;
    return accelerationDistance + cruiseDistance * localProgress;
  }

  const localProgress = (progress - accelerationShare - cruiseShare) / decelerationShare;
  return accelerationDistance +
    cruiseDistance +
    decelerationDistance * (1 - Math.pow(1 - localProgress, 3));
}

function getCubicBezierPoint(start, controlA, controlB, end, progress) {
  const inverse = 1 - progress;
  const inverseSquared = inverse * inverse;
  const progressSquared = progress * progress;
  const startWeight = inverseSquared * inverse;
  const controlAWeight = 3 * inverseSquared * progress;
  const controlBWeight = 3 * inverse * progressSquared;
  const endWeight = progressSquared * progress;
  return {
    x: start.x * startWeight + controlA.x * controlAWeight + controlB.x * controlBWeight + end.x * endWeight,
    y: start.y * startWeight + controlA.y * controlAWeight + controlB.y * controlBWeight + end.y * endWeight,
  };
}

function cancelFleetMarkerAnimation(fleetId) {
  const normalizedFleetId = String(fleetId ?? "").trim();
  const animation = fleetMarkerAnimations.get(normalizedFleetId);
  if (!animation) {
    return;
  }

  cancelAnimationFrame(animation.frameId);
  animation.marker?.classList?.remove("system-fleet-marker--moving");
  fleetMarkerAnimations.delete(normalizedFleetId);
}

function cancelFleetMarkerAnimations() {
  for (const fleetId of Array.from(fleetMarkerAnimations.keys())) {
    cancelFleetMarkerAnimation(fleetId);
  }
}

function getFleetSystemAnchor(fleet, anchors) {
  const location = fleet?.location;
  if (!location) {
    return null;
  }

  const anchorKey = getFleetLocationAnchorKey(location);
  return anchors.find((anchor) => anchor.anchorKey === anchorKey)
    ?? anchors.find((anchor) => anchor.anchorKey === "system")
    ?? null;
}

function getFleetLocationAnchorKey(location) {
  if (location?.type === "planet" && location.planetKey) {
    return `planet:${location.planetKey}`;
  }
  if (location?.type === "wormhole" && location.wormholeKey) {
    return `wormhole:${location.wormholeKey}`;
  }
  if (location?.type === "link" && location.targetSystemId) {
    return `link:${location.targetSystemId}`;
  }
  return "system";
}

function createSystemFleetMarker(fleet) {
  const marker = document.createElement("button");
  const isControlled = isFleetControlledByActiveSide(fleet);
  const isLinkJumpPending = pendingFleetLinkJumpIds.has(fleet.id);
  marker.className = "system-fleet-marker";
  marker.type = "button";
  marker.dataset.fleetId = fleet.id;
  marker.dataset.ownerSideId = fleet.ownerSideId;
  marker.classList.toggle("system-fleet-marker--foreign", !isControlled);
  marker.classList.toggle("system-fleet-marker--selected", selectedFleetId === fleet.id);
  marker.classList.toggle("system-fleet-marker--link-jump-pending", isLinkJumpPending);
  marker.disabled = isLinkJumpPending;
  marker.tabIndex = isControlled && !isLinkJumpPending ? 0 : -1;
  marker.style.setProperty("--fleet-color", getSideColorById(fleet.ownerSideId));
  marker.style.setProperty("--fleet-idle-delay", getFleetMarkerIdleDelay(fleet));
  marker.setAttribute("aria-label", fleet.name);

  const stripe = document.createElement("span");
  stripe.className = "system-fleet-marker__stripe";
  const icon = document.createElement("img");
  icon.className = "system-fleet-marker__icon";
  icon.src = "/MainUI/Fleet_marker.svg";
  icon.alt = "";
  const number = document.createElement("span");
  number.className = "system-fleet-marker__number";
  number.textContent = formatFleetCreationNumber(fleet);
  marker.append(stripe, icon, number);
  marker.addEventListener("click", (event) => {
    event.stopPropagation();
    if (isGameDialogOpen() || !isControlled) {
      return;
    }
    selectFleet(fleet.id);
  });
  return marker;
}

function createSystemGate({ className, labelText, radius, x, y, stepX, stepY, echoCount = 5 }) {
  const gate = document.createElement("button");
  gate.className = className;
  gate.type = "button";
  gate.style.width = `${radius * 2}px`;
  gate.style.height = `${radius * 2}px`;
  gate.style.left = `${x - radius}px`;
  gate.style.top = `${y - radius}px`;
  gate.style.setProperty("--jump-step-x", `${stepX}px`);
  gate.style.setProperty("--jump-step-y", `${stepY}px`);
  gate.dataset.name = labelText;
  gate.dataset.radius = String(radius);

  const label = document.createElement("span");
  label.className = "system-jump__label";
  label.textContent = labelText;
  gate.append(label);

  for (let ringIndex = 1; ringIndex <= echoCount; ringIndex += 1) {
    const ring = document.createElement("span");
    ring.className = `system-jump__echo system-jump__echo--${ringIndex}`;
    gate.append(ring);
  }

  gate.userData = { label };
  gate.addEventListener("pointerenter", (event) => {
    if (isGameDialogOpen()) {
      return;
    }
    positionSystemTooltip(event.clientX, event.clientY);
    if (gate.classList.contains("system-jump--wormhole")) {
      startWormholeHover(gate, echoCount);
    } else {
      gate.classList.add("active");
      setSystemHover(gate);
    }
  });
  gate.addEventListener("pointermove", (event) => {
    if (isGameDialogOpen()) {
      return;
    }
    positionSystemTooltip(event.clientX, event.clientY);
  });
  gate.addEventListener("pointerleave", () => {
    if (gate.classList.contains("system-jump--wormhole")) {
      endWormholeHover(gate, echoCount);
    } else {
      gate.classList.remove("active");
      if (hoveredSystemBody === gate) {
        setSystemHover(null);
      }
    }
  });

  return gate;
}

function startWormholeHover(gate, echoCount) {
  clearWormholeTimers(gate);
  gate.userData.hovering = true;
  gate.userData.enterStartedAt = performance.now();
  gate.userData.enterDuration = (echoCount - 1) * 42 + 190;
  gate.classList.remove("exiting");
  gate.querySelectorAll(".system-jump__echo").forEach((ring, ringIndex) => {
    ring.style.transitionDelay = `${ringIndex * 42}ms`;
  });
  gate.classList.add("active");
}

function endWormholeHover(gate, echoCount) {
  gate.userData.hovering = false;
  clearWormholeTimers(gate);

  const elapsed = performance.now() - (gate.userData.enterStartedAt ?? 0);
  const wait = Math.max(0, (gate.userData.enterDuration ?? 0) - elapsed);
  gate.userData.exitTimer = window.setTimeout(() => {
    gate.querySelectorAll(".system-jump__echo").forEach((ring, ringIndex) => {
      ring.style.transitionDelay = `${(echoCount - ringIndex - 1) * 42}ms`;
    });
    gate.classList.add("exiting");
    gate.classList.remove("active");
    gate.userData.cleanupTimer = window.setTimeout(() => {
      if (!gate.userData.hovering) {
        gate.classList.remove("exiting");
        gate.querySelectorAll(".system-jump__echo").forEach((ring, ringIndex) => {
          ring.style.transitionDelay = `${ringIndex * 42}ms`;
        });
      }
    }, echoCount * 42 + 220);
  }, wait);
}

function clearWormholeTimers(gate) {
  if (gate.userData.exitTimer) {
    window.clearTimeout(gate.userData.exitTimer);
    gate.userData.exitTimer = null;
  }
  if (gate.userData.cleanupTimer) {
    window.clearTimeout(gate.userData.cleanupTimer);
    gate.userData.cleanupTimer = null;
  }
}

function createSystemWormholePosition({
  index,
  count,
  starX,
  centerY,
  height,
  minOrbit,
  maxOrbit,
  occupiedPlanets,
  gateRadius,
  random,
}) {
  const span = Math.max(1, maxOrbit - minOrbit);
  const countOffset = count > 1 ? index / (count - 1) : random();
  let fallback = null;

  for (let attempt = 0; attempt < 16; attempt += 1) {
    const radius = minOrbit + span * THREE.MathUtils.clamp(
      0.16 + ((countOffset + random() * 0.18 + attempt * 0.09) % 1) * 0.68,
      0,
      1,
    );
    const upper = random() < 0.5;
    const bandMin = upper ? 42 : height * 0.67;
    const bandMax = upper ? height * 0.33 : height - 42;
    const y = THREE.MathUtils.clamp(
      bandMin + random() * Math.max(1, bandMax - bandMin) + (count > 1 ? (index / Math.max(1, count - 1) - 0.5) * 24 : 0),
      42,
      height - 42,
    );
    const position = { x: starX + radius, y };
    fallback ??= position;

    if (!isSystemGateOnPlanet(position, occupiedPlanets, gateRadius)) {
      return position;
    }
  }

  return fallback;
}

function createSystemJumpPosition({
  index,
  count,
  starX,
  centerY,
  width,
  height,
  starRadius,
  minOrbit,
  maxOrbit,
  orbitRadii,
  occupiedPlanets,
  gateRadius,
  random,
}) {
  let fallback = null;

  for (let attempt = 0; attempt < 18; attempt += 1) {
    const radius = createSystemJumpRadius({
      index,
      count,
      starRadius,
      minOrbit,
      maxOrbit,
      orbitRadii,
      random,
      attempt,
    });
    const x = THREE.MathUtils.clamp(starX + radius, 54, width - 54);
    const upper = random() < 0.5;
    const bandMin = upper ? 42 : height * 0.67;
    const bandMax = upper ? height * 0.33 : height - 42;
    const stagger = count > 1 ? (index / Math.max(1, count - 1) - 0.5) * 34 : 0;
    const y = THREE.MathUtils.clamp(bandMin + random() * Math.max(1, bandMax - bandMin) + stagger, 42, height - 42);
    const position = { x, y };
    fallback ??= position;

    if (!isSystemGateOnPlanet(position, occupiedPlanets, gateRadius)) {
      return position;
    }
  }

  return fallback;
}

function createSystemJumpRadius({
  index,
  count,
  starRadius,
  minOrbit,
  maxOrbit,
  orbitRadii,
  random,
  attempt,
}) {
  if (orbitRadii.length >= 2) {
    const slot = Math.floor((random() + attempt * 0.37) * (orbitRadii.length - 1)) % (orbitRadii.length - 1);
    return THREE.MathUtils.lerp(orbitRadii[slot], orbitRadii[slot + 1], 0.28 + random() * 0.44);
  }

  if (orbitRadii.length === 1) {
    const inner = Math.max(starRadius * 1.18, minOrbit * 0.78);
    return THREE.MathUtils.lerp(inner, orbitRadii[0], 0.35 + random() * 0.46);
  }

  const span = Math.max(1, maxOrbit - minOrbit);
  const countOffset = count > 1 ? index / (count - 1) : random();
  const seededOffset = (countOffset + random() * 0.22 + attempt * 0.13) % 1;
  return minOrbit + span * THREE.MathUtils.clamp(0.08 + seededOffset * 0.84, 0, 1);
}

function isSystemGateOnPlanet(position, occupiedPlanets, gateRadius) {
  return occupiedPlanets.some((planet) => (
    Math.hypot(position.x - planet.x, position.y - planet.y) < planet.radius + gateRadius + 4
  ));
}

function startSystemJumpTransition(targetNode, directionX, directionY, gate, clientX, clientY) {
  if (systemScreenController.isTransitioning() || !systemScreenController.isOpen()) {
    return;
  }
  if (!isSystemAccessibleForActiveSide(targetNode)) {
    return;
  }

  systemScreenController.setTransitioning(true);
  gate?.classList.add("jumping");
  clearSystemHover();
  lockSystemPointer();

  const length = Math.max(1, Math.hypot(directionX, directionY));
  const unitX = directionX / length;
  const unitY = directionY / length;
  const travel = Math.max(window.innerWidth, window.innerHeight) * 1.08;
  const exitX = unitX * travel;
  const exitY = unitY * travel;
  const chargeDuration = 220;
  const departDuration = 720;
  const arriveDuration = 920;
  const startedAt = performance.now();

  setSystemTransitionOffset(0, 0);
  setSystemTransitionOverlay(0);

  const animateTransition = (now) => {
    const elapsed = now - startedAt;

    if (elapsed < chargeDuration) {
      requestAnimationFrame(animateTransition);
      return;
    }

    const departElapsed = elapsed - chargeDuration;
    if (departElapsed < departDuration) {
      const progress = THREE.MathUtils.clamp(departElapsed / departDuration, 0, 1);
      const speedCurve = Math.pow(progress, 2.55);
      const blackCurve = Math.pow(progress, 1.35);
      const offsetX = -exitX * speedCurve;
      const offsetY = -exitY * speedCurve;
      setSystemTransitionOffset(offsetX, offsetY);
      updateSystemGlow(clientX, clientY, offsetX, offsetY);
      setSystemTransitionOverlay(blackCurve);
      requestAnimationFrame(animateTransition);
      return;
    }

    setSystemTransitionOverlay(1);
    renderStarSystem(targetNode);
    renderSystemStars(targetNode);
    renderSystemParticles(targetNode);
    preloadPlanetScreenRenderer();
    systemScreenController.setActiveNode(targetNode);
    setSystemTransitionOffset(exitX, exitY);
    updateSystemGlow(clientX, clientY, exitX, exitY);

    const arriveStartedAt = performance.now();
    const animateArrival = (arrivalNow) => {
      const progress = THREE.MathUtils.clamp((arrivalNow - arriveStartedAt) / arriveDuration, 0, 1);
      const eased = 1 - Math.pow(1 - progress, 3.1);
      const offsetX = exitX * (1 - eased);
      const offsetY = exitY * (1 - eased);
      setSystemTransitionOffset(offsetX, offsetY);
      setSystemTransitionOverlay(1 - eased);
      updateSystemGlow(clientX, clientY, offsetX, offsetY);

      if (progress < 1) {
        requestAnimationFrame(animateArrival);
        return;
      }

      setSystemTransitionOffset(0, 0);
      setSystemTransitionOverlay(0);
      systemScreenController.setTransitioning(false);
      updateSystemParallax(clientX, clientY);
      releaseSystemPointerLock();
      persistRuntimeSession("system");
    };

    requestAnimationFrame(animateArrival);
  };

  requestAnimationFrame(animateTransition);
}

function lockSystemPointer(element = starWindow) {
  document.body.classList.add("transition-pointer-frozen");
  void element;
}

function releaseSystemPointerLock() {
  document.body.classList.remove("transition-pointer-frozen");
  if (document.pointerLockElement && document.exitPointerLock) {
    document.exitPointerLock();
  }
}

function setSystemTransitionOffset(x, y) {
  starWindow.style.setProperty("--system-transition-x", `${x}px`);
  starWindow.style.setProperty("--system-transition-y", `${y}px`);
}

function setSystemTransitionOverlay(opacity) {
  systemTransitionOverlay.style.opacity = String(THREE.MathUtils.clamp(opacity, 0, 1));
}

function updateSystemPlanetRotationLayers(deltaSeconds, now) {
  if (!systemScreenController.isOpen() ||
    (gasGiantTextureLayers.size === 0 && planetSurfaceRotationLayers.size === 0)) {
    return;
  }

  for (const layer of gasGiantTextureLayers) {
    if (!layer.isConnected || layer.dataset.staticTexture === "true") {
      gasGiantTextureLayers.delete(layer);
      continue;
    }

    const tileWidth = layer.gasGiantTileWidth || 1;
    const phase = getSystemTextureDriftPhase(
      layer.planetRotation,
      now * 0.001,
      layer.textureSpeedMultiplier || 1,
    );
    const angle = layer.gasGiantAngle || 0;
    layer.style.backgroundPosition = `${(-phase * tileWidth).toFixed(2)}px center`;
    layer.style.transform = `translate3d(-50%, -50%, 0) rotate(${angle}rad)`;
  }

  for (const layer of planetSurfaceRotationLayers) {
    if (!layer.isConnected) {
      planetSurfaceRotationLayers.delete(layer);
      continue;
    }

    const angle = getSystemPlanetRotationDisplayPhase(layer.planetRotation, now * 0.001) * Math.PI * 2;
    layer.style.transform = `rotate(${angle.toFixed(5)}rad)`;
  }
}

function getSystemPlanetRotationDisplayPhase(rotation, elapsedSeconds) {
  return getScaledPlanetRotationPhase(rotation, elapsedSeconds, SYSTEM_PLANET_ROTATION_DISPLAY_SCALE);
}

function getSystemTextureDriftPhase(rotation, elapsedSeconds, speedMultiplier = 1) {
  return getScaledPlanetRotationPhase(
    rotation,
    elapsedSeconds,
    SYSTEM_PLANET_ROTATION_DISPLAY_SCALE * speedMultiplier,
  );
}

function getScaledPlanetRotationPhase(rotation, elapsedSeconds, scale = 1) {
  if (!rotation || rotation.turnsPerSecond === 0) {
    return rotation?.initialOffset ?? 0;
  }

  const phase = rotation.initialOffset + elapsedSeconds * rotation.turnsPerSecond * scale;
  return ((phase % 1) + 1) % 1;
}

function getSystemPlanetRadius(sizeIndex) {
  return 4 + sizeIndex * ((27 - 4) / 9);
}

function createSystemStarSurface(node, starRadius, options = {}) {
  const pixelRatio = Math.min(window.devicePixelRatio, 2);
  const displaySize = starRadius * 2;
  const overscan = 12;
  const canvasSize = displaySize + overscan * 2;
  const edgeScale = options.edgeScale ?? 1;
  const noise = createSystemStarSurfaceNoise(`${SEED}:system-surface:${node.id}`, starRadius, edgeScale);
  const canvas = document.createElement("canvas");
  canvas.className = "system-star__surface";
  canvas.width = Math.ceil(canvasSize * pixelRatio);
  canvas.height = Math.ceil(canvasSize * pixelRatio);
  canvas.style.left = `${-overscan}px`;
  canvas.style.top = `${-overscan}px`;
  canvas.style.width = `${canvasSize}px`;
  canvas.style.height = `${canvasSize}px`;

  return {
    canvas,
    context: canvas.getContext("2d"),
    displaySize,
    canvasSize,
    overscan,
    pixelRatio,
    coreColor: node.coreColor,
    glowColor: node.glowColor,
    edgeScale,
    noise,
    renderCache: createSystemStarSurfaceRenderCache(starRadius, edgeScale, noise),
  };
}

function createSystemStarSurfaceNoise(seed, radius, edgeScale = 1) {
  const random = createRandom(seed);
  const circumference = Math.PI * 2 * radius;
  const layers = [
    createLoopingNoiseLayer(random, circumference, 5.2 * edgeScale, 64, 0.46),
    createLoopingNoiseLayer(random, circumference, 2.7 * edgeScale, 72, 0.34),
    createLoopingNoiseLayer(random, circumference, 1.45 * edgeScale, 80, 0.2),
  ];

  return { layers };
}

function createSystemStarSurfaceRenderCache(radius, edgeScale, noise) {
  const pointCount = Math.max(1800, Math.min(7200, Math.ceil(radius * 7.5)));
  const sampleCount = pointCount + 1;
  const cosines = new Float32Array(sampleCount);
  const sines = new Float32Array(sampleCount);
  const layerSamples = noise.layers.map((layer) => ({
    spatialBase: new Uint32Array(sampleCount),
    spatialNext: new Uint32Array(sampleCount),
    spatialBlend: new Float32Array(sampleCount),
    layer,
  }));

  for (let index = 0; index < sampleCount; index += 1) {
    const angleRatio = index / pointCount;
    const angle = angleRatio * Math.PI * 2;
    cosines[index] = Math.cos(angle);
    sines[index] = Math.sin(angle);

    for (const sample of layerSamples) {
      const spatialPosition = angleRatio * sample.layer.spatialCells;
      const spatialBase = Math.floor(spatialPosition) % sample.layer.spatialCells;
      sample.spatialBase[index] = spatialBase;
      sample.spatialNext[index] = (spatialBase + 1) % sample.layer.spatialCells;
      sample.spatialBlend[index] = smoothNoiseStep(spatialPosition - Math.floor(spatialPosition));
    }
  }

  return {
    pointCount,
    sampleCount,
    cosines,
    sines,
    layerSamples,
    timeSamples: layerSamples.map((sample) => ({
      sample,
      row: 0,
      nextRow: 0,
      timeBlend: 0,
      timeBase: -1,
      timeNext: -1,
      topValues: new Float32Array(sampleCount),
      bottomValues: new Float32Array(sampleCount),
    })),
    weightTotal: noise.layers.reduce((total, layer) => total + layer.weight, 0),
  };
}

function createLoopingNoiseLayer(random, circumference, cellPx, timeCells, weight) {
  const spatialCells = Math.max(96, Math.min(4096, Math.round(circumference / cellPx)));
  const values = new Float32Array(spatialCells * timeCells);

  for (let index = 0; index < values.length; index += 1) {
    values[index] = random() * 2 - 1;
  }

  return { spatialCells, timeCells, weight, values };
}

function smoothNoiseStep(value) {
  return value * value * (3 - 2 * value);
}

function updateSystemStarSurfaceTimeSamples(cache, timeRatio) {
  for (const timeSample of cache.timeSamples) {
    const { layer } = timeSample.sample;
    const timePosition = timeRatio * layer.timeCells;
    const timeBase = Math.floor(timePosition) % layer.timeCells;
    const timeNext = (timeBase + 1) % layer.timeCells;
    timeSample.row = timeBase * layer.spatialCells;
    timeSample.nextRow = timeNext * layer.spatialCells;
    timeSample.timeBlend = smoothNoiseStep(timePosition - Math.floor(timePosition));
    if (timeSample.timeBase === timeBase && timeSample.timeNext === timeNext) {
      continue;
    }

    timeSample.timeBase = timeBase;
    timeSample.timeNext = timeNext;
    updateSystemStarSurfaceSpatialCache(timeSample);
  }
}

function updateSystemStarSurfaceSpatialCache(timeSample) {
  const { sample, row, nextRow, topValues, bottomValues } = timeSample;
  const { layer, spatialBase, spatialNext, spatialBlend } = sample;

  for (let index = 0; index < topValues.length; index += 1) {
    const baseIndex = spatialBase[index];
    const nextIndex = spatialNext[index];
    const blend = spatialBlend[index];
    const topStart = layer.values[row + baseIndex];
    const topEnd = layer.values[row + nextIndex];
    const bottomStart = layer.values[nextRow + baseIndex];
    const bottomEnd = layer.values[nextRow + nextIndex];
    topValues[index] = (topStart + (topEnd - topStart) * blend) * layer.weight;
    bottomValues[index] = (bottomStart + (bottomEnd - bottomStart) * blend) * layer.weight;
  }
}

function sampleCachedSystemStarSurfaceNoise(cache, index) {
  let value = 0;

  for (const timeSample of cache.timeSamples) {
    const top = timeSample.topValues[index];
    const bottom = timeSample.bottomValues[index];
    value += top + (bottom - top) * timeSample.timeBlend;
  }

  return value / cache.weightTotal;
}

function drawSystemStarSurface(surface, now) {
  const { context, canvasSize, displaySize, overscan, pixelRatio } = surface;
  const center = canvasSize / 2;
  const radius = displaySize / 2;
  const timeRatio = (now % 34200) / 34200;
  const renderCache = surface.renderCache;
  const edgeScale = surface.edgeScale ?? 1;
  const amplitude = THREE.MathUtils.clamp(2.5 * edgeScale, 0.28, 6);
  const innerBlend = THREE.MathUtils.clamp(60 * edgeScale, 1, 110);
  const outerReach = THREE.MathUtils.clamp(3 * edgeScale, 0.35, 7.2);
  const innerRadius = Math.max(0, radius - innerBlend);
  const gradientInnerRadius = Math.max(0, radius - innerBlend);
  const gradientOuterRadius = Math.max(gradientInnerRadius + 0.1, radius + outerReach);

  context.setTransform(pixelRatio, 0, 0, pixelRatio, 0, 0);
  context.clearRect(0, 0, canvasSize, canvasSize);
  context.beginPath();
  updateSystemStarSurfaceTimeSamples(renderCache, timeRatio);

  for (let index = 0; index < renderCache.sampleCount; index += 1) {
    const wave = sampleCachedSystemStarSurfaceNoise(renderCache, index);
    const pointRadius = radius + outerReach + wave * amplitude;
    const x = center + renderCache.cosines[index] * pointRadius;
    const y = center + renderCache.sines[index] * pointRadius;

    if (index === 0) {
      context.moveTo(x, y);
    } else {
      context.lineTo(x, y);
    }
  }

  context.closePath();
  context.arc(center, center, innerRadius, Math.PI * 2, 0, true);
  const edgeGradient = context.createRadialGradient(
    center,
    center,
    gradientInnerRadius,
    center,
    center,
    gradientOuterRadius,
  );
  edgeGradient.addColorStop(0, "rgba(255,255,255,0)");
  edgeGradient.addColorStop(0.32, hexToRgba(surface.glowColor, 0.12));
  edgeGradient.addColorStop(0.62, hexToRgba(surface.glowColor, 0.34));
  edgeGradient.addColorStop(0.84, hexToRgba(surface.glowColor, 0.7));
  edgeGradient.addColorStop(1, surface.glowColor);
  context.fillStyle = edgeGradient;
  context.fill("evenodd");
}

function createSystemOrbitLayer(width, height) {
  const overscan = 180;
  const pixelRatio = Math.min(window.devicePixelRatio, 2);
  const canvas = document.createElement("canvas");
  canvas.className = "system-orbit-layer";
  canvas.dataset.overscan = String(overscan);
  canvas.width = Math.ceil((width + overscan * 2) * pixelRatio);
  canvas.height = Math.ceil((height + overscan * 2) * pixelRatio);
  canvas.style.left = `${-overscan}px`;
  canvas.style.top = `${-overscan}px`;
  canvas.style.width = `${width + overscan * 2}px`;
  canvas.style.height = `${height + overscan * 2}px`;
  return canvas;
}

function drawSystemOrbits(canvas, orbitItems) {
  const context = canvas.getContext("2d");
  const pixelRatio = Math.min(window.devicePixelRatio, 2);
  const overscan = Number(canvas.dataset.overscan) || 0;
  const width = canvas.width / pixelRatio;
  const height = canvas.height / pixelRatio;

  context.setTransform(pixelRatio, 0, 0, pixelRatio, 0, 0);
  context.clearRect(0, 0, width, height);
  context.lineWidth = 1;
  context.lineCap = "round";

  for (const orbit of orbitItems) {
    drawNoisyOrbit(context, orbit, overscan, width, height);
  }

  for (const orbit of orbitItems) {
    drawCleanOrbitSegment(context, orbit, overscan);
  }
}

function drawNoisyOrbit(context, orbit, overscan, width, height) {
  const centerX = orbit.centerX + overscan;
  const centerY = orbit.centerY + overscan;
  const step = Math.max(0.0025, 3.6 / orbit.radius);

  for (let angle = 0; angle < Math.PI * 2; angle += step) {
    const nextAngle = Math.min(Math.PI * 2, angle + step);
    const middleAngle = (angle + nextAngle) / 2;
    const x = centerX + Math.cos(middleAngle) * orbit.radius;
    const y = centerY + Math.sin(middleAngle) * orbit.radius;

    if (x < -12 || x > width + 12 || y < -12 || y > height + 12) {
      continue;
    }

    const largeNoise =
      0.5 +
      0.5 * Math.sin(x * 0.0061 + y * 0.0037 + Math.sin(y * 0.0022) * 2.4);
    const fineNoise = Math.sin(x * 0.085 + y * 0.22) * Math.sin(x * 0.19 - y * 0.073);
    const fineCut = fineNoise > 0.82 ? 0 : 1;
    const alpha = 0.34 * (0.5 + largeNoise * 0.5) * fineCut;

    if (alpha <= 0.01) {
      continue;
    }

    context.strokeStyle = `rgba(255,255,255,${alpha.toFixed(3)})`;
    context.beginPath();
    context.arc(centerX, centerY, orbit.radius, angle, nextAngle);
    context.stroke();
  }
}

function drawCleanOrbitSegment(context, orbit, overscan) {
  const centerX = orbit.centerX + overscan;
  const centerY = orbit.centerY + overscan;
  const span = 0.18;
  const pieces = 32;

  for (let index = 0; index < pieces; index += 1) {
    const startT = index / pieces;
    const endT = (index + 1) / pieces;
    const middleT = (startT + endT) / 2;
    const fade = Math.sin(middleT * Math.PI);
    const startAngle = orbit.planetAngle - span + startT * span * 2;
    const endAngle = orbit.planetAngle - span + endT * span * 2;

    context.strokeStyle = `rgba(255,255,255,${(0.46 * fade).toFixed(3)})`;
    context.beginPath();
    context.arc(centerX, centerY, orbit.radius, startAngle, endAngle);
    context.stroke();
  }
}

function createPlanetKind(random, sizeIndex) {
  const planetChances = [1, 0.95, 0.9, 0.85, 0.6, 0.15, 0.07, 0.03, 0.02, 0];
  const isPlanet = random() < planetChances[sizeIndex];

  if (isPlanet) {
    const lightness = 66 + random() * 18;
    return {
      label: "PLANET",
      background: `radial-gradient(circle at 38% 34%, hsl(0 0% ${Math.min(96, lightness + 18)}%) 0 24%, hsl(0 0% ${lightness}%) 56%, hsl(0 0% ${Math.max(32, lightness - 24)}%) 100%)`,
    };
  }

  const hue = Math.floor(random() * 360);
  const saturation = 18 + random() * 18;
  const lightness = 74 + random() * 12;
  return {
    label: "GAS GIANT",
    background: `radial-gradient(circle at 38% 34%, hsl(${hue} ${saturation}% ${Math.min(96, lightness + 14)}%) 0 22%, hsl(${hue} ${saturation}% ${lightness}%) 52%, hsl(${hue} ${Math.max(8, saturation - 8)}% ${Math.max(48, lightness - 22)}%) 100%)`,
  };
}

function applyGasGiantTexture(element, texture, displayRadius, isStatic = false, starDirX = -1, starDirY = 0, rotation = null) {
  element.style.background = "transparent";
  const isWindowSurface = element.classList.contains("planet-window__planet") ||
    element.classList.contains("planet-window__surface");
  element.classList.add(
    "gas-giant-surface",
    isWindowSurface ? "planet-window__planet--gas-giant" : "system-planet--gas-giant",
  );

  const textureLayer = document.createElement("span");
  textureLayer.className = "gas-giant-texture";
  const driftLayer = document.createElement("span");
  driftLayer.className = "gas-giant-texture__drift";
  driftLayer.style.setProperty("--gas-giant-texture", texture.url);
  const tileWidth = isWindowSurface ? texture.width : displayRadius * 4;
  driftLayer.style.setProperty("--gas-giant-tile-width", `${tileWidth}px`);
  driftLayer.style.setProperty(
    "--gas-giant-tile-height",
    `${isWindowSurface ? texture.height : displayRadius * 2}px`,
  );
  const angle = Math.atan2(starDirY, starDirX);
  driftLayer.style.setProperty("--gas-giant-angle", `${angle}rad`);
  driftLayer.dataset.staticTexture = isStatic ? "true" : "false";
  driftLayer.gasGiantTileWidth = tileWidth;
  driftLayer.gasGiantAngle = angle;
  driftLayer.planetRotation = rotation;
  const phase = getSystemPlanetRotationDisplayPhase(rotation, performance.now() * 0.001);
  driftLayer.style.backgroundPosition = `${(-phase * tileWidth).toFixed(2)}px center`;
  if (isStatic || rotation?.turnsPerSecond === 0) {
    driftLayer.classList.add("gas-giant-texture__drift--static");
    driftLayer.style.transform = `translate3d(-50%, -50%, 0) rotate(${angle}rad)`;
  } else {
    gasGiantTextureLayers.add(driftLayer);
  }
  textureLayer.append(driftLayer);
  element.append(textureLayer);

  const highlight = document.createElement("span");
  highlight.className = "gas-giant-highlight";
  element.append(highlight);
}

const PLANET_CLOUD_SYSTEM_SPEED_MULTIPLIER = 1.15;

function applyPlanetTexture(
  element,
  texture,
  displayRadius,
  isStatic = false,
  starDirX = -1,
  starDirY = 0,
  rotation = null,
  cloudRotation = rotation,
) {
  element.style.background = "transparent";
  const angle = Math.atan2(starDirY, starDirX);
  const tileWidth = displayRadius * 4;
  const tileHeight = displayRadius * 2;
  const isTidalCombineTexture = texture.textureMode === "tidal-combine";

  element.append(createPlanetTextureLayer({
    className: "planet-texture",
    textureUrl: texture.url,
    tileWidth,
    tileHeight,
    angle,
    isStatic: isStatic || isTidalCombineTexture,
    rotation: isTidalCombineTexture ? null : rotation,
    speedMultiplier: 1,
    initialPhase: isTidalCombineTexture ? 0.5 : null,
  }));

  if (texture.cloudUrl) {
    element.append(createPlanetTextureLayer({
      className: "planet-texture planet-texture--cloud",
      textureUrl: texture.cloudUrl,
      tileWidth,
      tileHeight,
      angle,
      isStatic: false,
      rotation: cloudRotation,
      speedMultiplier: PLANET_CLOUD_SYSTEM_SPEED_MULTIPLIER,
    }));
  }

  const highlight = document.createElement("span");
  highlight.className = "planet-texture-highlight";
  element.append(highlight);
}

function createPlanetTextureLayer({
  className,
  textureUrl,
  tileWidth,
  tileHeight,
  angle,
  isStatic,
  rotation,
  speedMultiplier,
  initialPhase = null,
}) {
  const textureLayer = document.createElement("span");
  textureLayer.className = className;
  const driftLayer = document.createElement("span");
  driftLayer.className = "planet-texture__drift";
  driftLayer.style.setProperty("--gas-giant-texture", textureUrl);
  driftLayer.style.setProperty("--gas-giant-tile-width", `${tileWidth}px`);
  driftLayer.style.setProperty("--gas-giant-tile-height", `${tileHeight}px`);
  driftLayer.style.setProperty("--gas-giant-angle", `${angle}rad`);
  driftLayer.dataset.staticTexture = isStatic ? "true" : "false";
  driftLayer.gasGiantTileWidth = tileWidth;
  driftLayer.gasGiantAngle = angle;
  driftLayer.planetRotation = rotation;
  driftLayer.textureSpeedMultiplier = speedMultiplier;
  const phase = Number.isFinite(initialPhase)
    ? initialPhase
    : getSystemTextureDriftPhase(rotation, performance.now() * 0.001, speedMultiplier);
  driftLayer.style.backgroundPosition = `${(-phase * tileWidth).toFixed(2)}px center`;
  if (isStatic || rotation?.turnsPerSecond === 0) {
    driftLayer.classList.add("planet-texture__drift--static");
    driftLayer.style.transform = `translate3d(-50%, -50%, 0) rotate(${angle}rad)`;
  } else {
    gasGiantTextureLayers.add(driftLayer);
  }
  textureLayer.append(driftLayer);
  return textureLayer;
}

function createPlanetSurface(
  background,
  gasGiantTexture,
  planetTexture,
  radius,
  starDirX,
  starDirY,
  isWindow = false,
  isTextureStatic = false,
  options = {},
) {
  const surface = document.createElement("div");
  surface.className = isWindow ? "planet-window__surface" : "system-planet__surface";
  if (gasGiantTexture) {
    applyGasGiantTexture(surface, gasGiantTexture, radius, isTextureStatic, starDirX, starDirY, options.rotation);
  } else if (planetTexture) {
    applyPlanetTexture(surface, planetTexture, radius, isTextureStatic, starDirX, starDirY, options.rotation, options.cloudRotation);
  } else {
    surface.append(createPlanetSurfaceFill(background, options.rotation));
  }
  if (options.innerLightColor) {
    surface.append(createPlanetInnerLight(radius, starDirX, starDirY, options.innerLightColor));
  }
  surface.append(createPlanetShadow(radius, starDirX, starDirY, options));
  return surface;
}

function createPlanetSurfaceFill(background, rotation = null) {
  const fill = document.createElement("span");
  fill.className = "system-planet__surface-fill";
  fill.style.background = background;
  fill.planetRotation = rotation;
  const angle = getSystemPlanetRotationDisplayPhase(rotation, performance.now() * 0.001) * Math.PI * 2;
  fill.style.transform = `rotate(${angle.toFixed(5)}rad)`;
  if (rotation?.turnsPerSecond !== 0) {
    planetSurfaceRotationLayers.add(fill);
  } else {
    fill.classList.add("system-planet__surface-fill--static");
  }
  return fill;
}

// Light circle offset toward the star; shadow width on axis equals this offset,
// so 2R/5 leaves a shadow ~1/5 of the disc with a concave (curved) edge.
const PLANET_SHADOW_OFFSET = 2 / 5;

function createPlanetShadow(radius, starDirX, starDirY, options = {}) {
  // The circle is a sphere: cast a concave (crescent) shadow opposite the star,
  // modelled as a soft multiply overlay rather than a solid cutout.
  const overscan = Math.max(2.5, Math.min(5, radius * 0.08));
  const center = radius + overscan;
  const lightOffset = radius * (options.shadowOffset ?? (PLANET_SHADOW_OFFSET + 0.12));
  const lightCx = center + starDirX * lightOffset;
  const lightCy = center + starDirY * lightOffset;
  const blur = Math.max(radius * (options.shadowBlurScale ?? 0.68), 5.2);

  const shadow = document.createElement("div");
  shadow.className = "system-planet-shadow";
  shadow.style.width = `${center * 2}px`;
  shadow.style.height = `${center * 2}px`;
  shadow.style.left = `${-overscan}px`;
  shadow.style.top = `${-overscan}px`;
  const shadowAlpha = options.shadowAlpha ?? 0.82;
  shadow.style.background =
    `radial-gradient(circle at ${lightCx.toFixed(2)}px ${lightCy.toFixed(2)}px, ` +
    `rgba(0, 0, 0, 0) ${(radius - blur * 0.92).toFixed(2)}px, ` +
    `rgba(0, 0, 0, ${shadowAlpha}) ${(radius + blur * 0.48).toFixed(2)}px)`;
  return shadow;
}

function createPlanetScreenPlanetGlow(radius, starDirX, starDirY, color) {
  const outerExtent = Math.max(3, Math.min(8, radius * 0.018));
  const glow = document.createElement("div");
  glow.className = "planet-screen__planet-glow";
  glow.style.width = `${(radius + outerExtent) * 2}px`;
  glow.style.height = `${(radius + outerExtent) * 2}px`;
  glow.style.left = `${-outerExtent}px`;
  glow.style.top = `${-outerExtent}px`;
  glow.style.color = color;
  glow.style.background =
    `radial-gradient(circle, ` +
    `rgba(255,255,255,0) ${(radius - outerExtent * 0.9).toFixed(2)}px, ` +
    `currentColor ${(radius - outerExtent * 0.25).toFixed(2)}px, ` +
    `currentColor ${(radius + 0.9).toFixed(2)}px, ` +
    `rgba(255,255,255,0) ${(radius + outerExtent).toFixed(2)}px)`;

  const maskRadius = radius + outerExtent;
  const maskOffset = radius * 0.82 + outerExtent;
  const maskCx = maskRadius + starDirX * maskOffset;
  const maskCy = maskRadius + starDirY * maskOffset;
  const soft = Math.max(radius * 0.22, 8);
  const maskImage =
    `radial-gradient(circle at ${maskCx.toFixed(2)}px ${maskCy.toFixed(2)}px, ` +
    `#000 ${(radius - soft).toFixed(2)}px, ` +
    `rgba(0,0,0,0) ${(radius + soft).toFixed(2)}px)`;
  glow.style.maskImage = maskImage;
  glow.style.webkitMaskImage = maskImage;
  return glow;
}

function createPlanetInnerLight(radius, starDirX, starDirY, color) {
  const light = document.createElement("div");
  light.className = "system-planet-inner-light";
  const lightCx = 50 + starDirX * 34;
  const lightCy = 50 + starDirY * 34;
  light.style.color = color;
  light.style.background =
    `radial-gradient(circle at ${lightCx.toFixed(2)}% ${lightCy.toFixed(2)}%, ` +
    `color-mix(in srgb, currentColor 72%, white) 0 12%, ` +
    `color-mix(in srgb, currentColor 44%, transparent) 34%, ` +
    `color-mix(in srgb, currentColor 14%, transparent) 58%, ` +
    `rgba(255,255,255,0) 84%)`;
  return light;
}

function createPlanetGlow(radius, starDirX, starDirY) {
  // Rim glow, sized relative to the planet, masked off on the shadowed side so
  // the planet only glows where it is lit. The glow peaks exactly at the rim
  // (no gap) and the mask circle shares the shadow's terminator.
  const glowExtent = Math.max(radius * 0.72, 4);

  const glow = document.createElement("div");
  glow.className = "system-planet-glow";
  glow.style.width = `${(radius + glowExtent) * 2}px`;
  glow.style.height = `${(radius + glowExtent) * 2}px`;
  glow.style.left = `${-glowExtent}px`;
  glow.style.top = `${-glowExtent}px`;
  const innerFeather = Math.max(3.6, radius * 0.26);
  const innerMid = Math.max(1.8, radius * 0.13);
  glow.style.background =
    `radial-gradient(circle, ` +
    `rgba(255, 255, 255, 0) ${(radius - innerFeather).toFixed(2)}px, ` +
    `rgba(255, 255, 255, 0.07) ${(radius - innerMid).toFixed(2)}px, ` +
    `rgba(255, 255, 255, 0.18) ${(radius - 1.1).toFixed(2)}px, ` +
    `rgba(255, 255, 255, 0.3) ${(radius + 0.15).toFixed(2)}px, ` +
    `rgba(255, 255, 255, 0.09) ${(radius + glowExtent * 0.48).toFixed(2)}px, ` +
    `rgba(255, 255, 255, 0) ${(radius + glowExtent).toFixed(2)}px)`;

  // Mask circle: same terminator as the shadow, with a soft falloff. This keeps
  // the raised glow as a concave crescent instead of a full halo over the planet.
  const maskRadius = radius + glowExtent;
  const maskOffset = radius * PLANET_SHADOW_OFFSET + glowExtent;
  const maskCx = maskRadius + starDirX * maskOffset;
  const maskCy = maskRadius + starDirY * maskOffset;
  const maskTerminatorRadius = radius + glowExtent * 0.24;
  const soft = Math.max(radius * 0.2, glowExtent * 0.5, 3.2);
  const maskImage =
    `radial-gradient(circle at ${maskCx.toFixed(2)}px ${maskCy.toFixed(2)}px, ` +
    `#000 ${(maskTerminatorRadius - soft).toFixed(2)}px, ` +
    `rgba(0, 0, 0, 0) ${(maskTerminatorRadius + soft).toFixed(2)}px)`;
  glow.style.maskImage = maskImage;
  glow.style.webkitMaskImage = maskImage;
  return glow;
}

function createAsteroidBelt(random, orbitRadius) {
  const halfWidth = 8 + random() * 22;
  const innerRadius = Math.max(1, orbitRadius - halfWidth);
  const outerRadius = orbitRadius + halfWidth;
  const cuts = 2 + Math.floor(random() * 6);
  const stops = [
    "transparent 0",
    `transparent ${innerRadius - 1}px`,
    `rgba(255,255,255,0.12) ${innerRadius}px`,
  ];

  for (let index = 0; index < cuts; index += 1) {
    const cutRadius = innerRadius + 2 + random() * Math.max(1, halfWidth * 2 - 4);
    stops.push(`rgba(255,255,255,0.12) ${cutRadius - 0.8}px`);
    stops.push(`transparent ${cutRadius - 0.2}px`);
    stops.push(`transparent ${cutRadius + 0.8}px`);
    stops.push(`rgba(255,255,255,0.12) ${cutRadius + 1.4}px`);
  }

  stops.push(`rgba(255,255,255,0.12) ${outerRadius}px`);
  stops.push(`transparent ${outerRadius + 1}px`);

  return {
    outerRadius,
    background: `radial-gradient(circle at center, ${stops.join(", ")})`,
  };
}

function createAccretionDisk(random, planetRadius, sizeIndex) {
  const chances = [0.02, 0.03, 0.04, 0.05, 0.06, 0.1, 0.15, 0.25, 0.35, 0.4];
  if (random() >= chances[sizeIndex]) {
    return null;
  }

  const innerRadius = planetRadius + 1 + random() * Math.max(1, planetRadius - 1);
  const thickness = planetRadius * 0.5 + random() * planetRadius * 2.5;
  const outerRadius = innerRadius + thickness;
  const cuts = Math.floor(random() * 4);
  const cutRadii = [];
  const bandCount = 1 + Math.floor(random() * 5);
  const bandRadii = [];

  for (let index = 0; index < cuts; index += 1) {
    cutRadii.push(innerRadius + 2 + random() * Math.max(1, thickness - 4));
  }

  for (let index = 0; index < bandCount; index += 1) {
    bandRadii.push({
      radius: innerRadius + 1 + random() * Math.max(1, thickness - 2),
      width: 0.8 + random() * 1.7,
      alpha: 0.1 + random() * 0.18,
    });
  }

  cutRadii.sort((a, b) => a - b);
  bandRadii.sort((a, b) => a.radius - b.radius);

  return {
    innerRadius,
    outerRadius,
    cutRadii,
    bandRadii,
    moonOrbitRadius: innerRadius + thickness / 2,
  };
}

function createAccretionDiskElement(accretionDisk, shadowAngle, shadowWidth, includeShadow = true, cutWidthScale = 1) {
  const size = Math.ceil(accretionDisk.outerRadius * 2 + 2);
  const pixelRatio = Math.min(window.devicePixelRatio, 2);
  const canvas = document.createElement("canvas");
  canvas.width = Math.ceil(size * pixelRatio);
  canvas.height = Math.ceil(size * pixelRatio);
  canvas.style.width = `${size}px`;
  canvas.style.height = `${size}px`;

  const context = canvas.getContext("2d");
  context.scale(pixelRatio, pixelRatio);

  const center = size / 2;
  const gradient = context.createRadialGradient(center, center, 0, center, center, accretionDisk.outerRadius + 1);
  let lastStop = 0;
  const addStop = (radius, color) => {
    const stop = Math.max(
      lastStop,
      THREE.MathUtils.clamp(radius / (accretionDisk.outerRadius + 1), 0, 1),
    );
    gradient.addColorStop(stop, color);
    lastStop = stop;
  };

  addStop(0, "rgba(255,255,255,0)");
  addStop(accretionDisk.innerRadius - 0.8, "rgba(255,255,255,0)");
  addStop(accretionDisk.innerRadius, "rgba(255,255,255,0.2)");

  const cutHalfWidth = Math.max(0.8, cutWidthScale * 0.8);
  for (const cutRadius of accretionDisk.cutRadii) {
    addStop(cutRadius - cutHalfWidth, "rgba(255,255,255,0.2)");
    addStop(cutRadius - cutHalfWidth * 0.25, "rgba(255,255,255,0)");
    addStop(cutRadius + cutHalfWidth, "rgba(255,255,255,0)");
    addStop(cutRadius + cutHalfWidth * 1.75, "rgba(255,255,255,0.2)");
  }

  addStop(accretionDisk.outerRadius, "rgba(255,255,255,0.2)");
  addStop(accretionDisk.outerRadius + 1, "rgba(255,255,255,0)");

  context.fillStyle = gradient;
  context.fillRect(0, 0, size, size);
  if (includeShadow) {
    context.save();
    context.globalCompositeOperation = "destination-out";
    context.translate(center, center);
    context.rotate(shadowAngle);
    context.fillStyle = "rgba(0,0,0,1)";
    context.fillRect(0, -shadowWidth / 2, accretionDisk.outerRadius * 1.8, shadowWidth);
    context.restore();
  }

  return canvas;
}

function createMoonSystem({
  random,
  planetX,
  planetY,
  planetRadius,
  planetSizeIndex,
  accretionDisk,
  starX,
  centerY,
  starRadius,
}) {
  const roll = random();
  const moonCount = roll < 0.5 ? 0 : roll < 0.8 ? 1 : roll < 0.9 ? 2 : roll < 0.95 ? 3 : 0;
  const smallOrbitBonus = [5, 4, 3][planetSizeIndex] ?? 0;
  const orbitRadius = accretionDisk
    ? accretionDisk.moonOrbitRadius
    : planetRadius * (1.35 + random() * 0.65) + smallOrbitBonus;
  const moons = [];

  if (moonCount === 0) {
    return { moonCount, orbitRadius, moons, planetX, planetY };
  }

  const startAngle = random() * Math.PI * 2;
  const moonSizes = [1.2, 1.6, 2];
  const placedMoons = [];

  for (let index = 0; index < moonCount; index += 1) {
    const sector = (Math.PI * 2) / moonCount;
    const moonSizeIndex = Math.floor(random() * moonSizes.length);
    const moonRadius = moonSizes[moonSizeIndex];
    const angle = pickSafeMoonAngle({
      random,
      baseAngle: startAngle + sector * index,
      sector,
      planetX,
      planetY,
      orbitRadius,
      moonRadius,
      placedMoons,
      starX,
      centerY,
      starRadius,
    });
    const moonX = planetX + Math.cos(angle) * orbitRadius;
    const moonY = planetY + Math.sin(angle) * orbitRadius;
    placedMoons.push({ x: moonX, y: moonY, radius: moonRadius });
    moons.push({ x: moonX, y: moonY, radius: moonRadius, sizeIndex: moonSizeIndex });
  }

  return { moonCount, orbitRadius, moons, planetX, planetY };
}

function renderMoons({ moonCount, orbitRadius, moons, planetX, planetY, starDirX, starDirY }) {
  if (moonCount === 0) {
    return;
  }

  const orbit = document.createElement("div");
  orbit.className = "system-moon-orbit";
  orbit.style.width = `${orbitRadius * 2}px`;
  orbit.style.height = `${orbitRadius * 2}px`;
  orbit.style.left = `${planetX - orbitRadius}px`;
  orbit.style.top = `${planetY - orbitRadius}px`;
  starSystem.append(orbit);

  for (const moonItem of moons) {
    const moon = document.createElement("div");
    moon.className = "system-moon";
    moon.style.width = `${moonItem.radius * 2}px`;
    moon.style.height = `${moonItem.radius * 2}px`;
    moon.style.left = `${moonItem.x - moonItem.radius}px`;
    moon.style.top = `${moonItem.y - moonItem.radius}px`;
    starSystem.append(moon);
  }
}

function getPlanetConstructionRadius(planetRadius, accretionDisk, moonSystem) {
  const moonRadius = moonSystem.moons.reduce((maxRadius, moon) => Math.max(maxRadius, moon.radius), 0);
  return Math.max(
    planetRadius,
    accretionDisk?.outerRadius ?? 0,
    moonSystem.moonCount > 0 ? moonSystem.orbitRadius + moonRadius + 2 : 0,
  );
}

function pickSafeMoonAngle({
  random,
  baseAngle,
  sector,
  planetX,
  planetY,
  orbitRadius,
  moonRadius,
  placedMoons,
  starX,
  centerY,
  starRadius,
}) {
  const fallbackAngles = [0, -0.42, 0.42, -0.78, 0.78];
  for (let attempt = 0; attempt < 80; attempt += 1) {
    const angle = baseAngle + (random() - 0.5) * sector * 0.72;
    if (isSafeMoonPosition(angle)) {
      return angle;
    }
  }

  for (const angle of fallbackAngles) {
    if (isSafeMoonPosition(angle)) {
      return angle;
    }
  }

  return 0;

  function isSafeMoonPosition(angle) {
    const moonX = planetX + Math.cos(angle) * orbitRadius;
    const moonY = planetY + Math.sin(angle) * orbitRadius;
    const starDistance = Math.hypot(moonX - starX, moonY - centerY);
    const insideStar = starDistance < starRadius + moonRadius + 14;
    const outsideViewport =
      moonX < moonRadius + 8 ||
      moonX > window.innerWidth - moonRadius - 8 ||
      moonY < moonRadius + 8 ||
      moonY > window.innerHeight - moonRadius - 8;
    const hitsMoon = placedMoons.some((moon) => (
      Math.hypot(moonX - moon.x, moonY - moon.y) < moonRadius + moon.radius + 4
    ));

    return !insideStar && !outsideViewport && !hitsMoon;
  }
}

function createSystemOrbitRadii(count, minOrbit, maxOrbit, random) {
  if (count <= 0) {
    return [];
  }

  const span = maxOrbit - minOrbit;
  const slack = THREE.MathUtils.clamp((13 - count) / 12, 0, 1);

  if (count === 1) {
    const inset = span * slack * 0.18;
    return [THREE.MathUtils.lerp(minOrbit + inset, maxOrbit - inset, random())];
  }

  const minGap = Math.min(74, span / (count - 1) * 0.58);
  const startInset = random() * span * slack * 0.24;
  const endInset = random() * span * slack * 0.2;
  let startOrbit = minOrbit + startInset;
  let endOrbit = maxOrbit - endInset;
  const minRequiredSpan = minGap * (count - 1);

  if (endOrbit - startOrbit < minRequiredSpan) {
    const midpoint = (startOrbit + endOrbit) / 2;
    startOrbit = Math.max(minOrbit, midpoint - minRequiredSpan / 2);
    endOrbit = Math.min(maxOrbit, startOrbit + minRequiredSpan);
    startOrbit = Math.max(minOrbit, endOrbit - minRequiredSpan);
  }

  const usableSpan = endOrbit - startOrbit;
  const remaining = Math.max(0, usableSpan - minGap * (count - 1));
  const weights = Array.from({ length: count - 1 }, () => 0.55 + random() * 1.35);
  const totalWeight = weights.reduce((sum, weight) => sum + weight, 0);
  const radii = [startOrbit];

  for (let index = 0; index < weights.length; index += 1) {
    const extraGap = totalWeight > 0 ? (remaining * weights[index]) / totalWeight : 0;
    radii.push(radii[index] + minGap + extraGap);
  }

  return radii;
}

function getSystemStarRadius(node, height, random) {
  const typeScale = {
    "Neutron Star": 0.12,
    "Red Dwarf": 0.2,
    "Orange Dwarf": 0.24,
    "Orange Star": 0.36,
    "Yellow Star": 0.44,
    "Yellow-White Star": 0.52,
    "White Star": 0.76,
    "Blue Star": 0.9,
    "Blue Giant": 1.34,
    "Red Giant": 1.46,
    "Blue Supergiant": 2.42,
    "Red Supergiant": 3,
    "Strange Star": 3,
  };
  const normalizedSize = THREE.MathUtils.clamp((node.size - 0.018) / (0.046 - 0.018), 0, 1);
  const scale = typeScale[node.starType] ?? THREE.MathUtils.lerp(0.2, 3, normalizedSize);
  const jitter = 0.9 + random() * 0.2;
  return THREE.MathUtils.clamp(height * scale * jitter, height * 0.2, height * 3);
}

function startNodeExitAnimation(nodeId, color) {
  nodeExitAnimations.set(nodeId, { color, progress: 1 });

  for (const neighborId of adjacency.get(nodeId)) {
    if (nodeColors.get(neighborId) !== color) {
      continue;
    }

    const key = getEdgeAnimationKey(color, nodeId, neighborId);
    edgeExitAnimations.set(key, {
      color,
      a: nodeId,
      b: neighborId,
      origin: neighborId,
      progress: 1,
    });
    edgeAnimationProgress.delete(key);
    edgeAnimationOrigins.delete(key);
  }
}

function addEdgeAnimationsForNode(nodeId, color) {
  for (const neighborId of adjacency.get(nodeId)) {
    if (nodeColors.get(neighborId) !== color) {
      continue;
    }

    const key = getEdgeAnimationKey(color, nodeId, neighborId);
    edgeAnimationProgress.set(key, 0);
    edgeAnimationOrigins.set(key, neighborId);
  }
}

function removeEdgeAnimationsForNode(nodeId) {
  for (const key of Array.from(edgeAnimationProgress.keys())) {
    if (key.includes(`:${nodeId}:`) || key.endsWith(`:${nodeId}`)) {
      edgeAnimationProgress.delete(key);
      edgeAnimationOrigins.delete(key);
    }
  }
}

function getEdgeAnimationKey(color, a, b) {
  const low = Math.min(a, b);
  const high = Math.max(a, b);
  return `${color}:${low}:${high}`;
}

function updateSelectionAnimations() {
  for (const [nodeId, progress] of nodeAnimationProgress) {
    nodeAnimationProgress.set(nodeId, Math.min(1, progress + 0.055));
  }

  for (const [key, progress] of edgeAnimationProgress) {
    edgeAnimationProgress.set(key, Math.min(1, progress + 0.055));
  }

  for (const [nodeId, animation] of nodeExitAnimations) {
    animation.progress = Math.max(0, animation.progress - 0.065);
    if (animation.progress <= 0) {
      nodeExitAnimations.delete(nodeId);
    }
  }

  for (const [key, animation] of edgeExitAnimations) {
    animation.progress = Math.max(0, animation.progress - 0.065);
    if (animation.progress <= 0) {
      edgeExitAnimations.delete(key);
    }
  }
}

function getNodeHit() {
  raycaster.setFromCamera(pointer, camera);
  return raycaster.intersectObjects(hitTargets, false)[0]?.object ?? null;
}

function getScreenNodeHit(clientX, clientY) {
  graphRoot.updateMatrixWorld(true);
  camera.updateMatrixWorld(true);

  let bestIndex = -1;
  let bestDistance = Infinity;

  for (let index = 0; index < nodes.length; index += 1) {
    screenHitProjection.copy(nodes[index].position).applyMatrix4(graphRoot.matrixWorld).project(camera);

    if (screenHitProjection.z < -1 || screenHitProjection.z > 1) {
      continue;
    }

    const screenX = (screenHitProjection.x * 0.5 + 0.5) * window.innerWidth;
    const screenY = (-screenHitProjection.y * 0.5 + 0.5) * window.innerHeight;
    const distance = Math.hypot(clientX - screenX, clientY - screenY);

    if (distance < bestDistance) {
      bestDistance = distance;
      bestIndex = index;
    }
  }

  if (bestIndex === -1 || bestDistance > 18) {
    return null;
  }

  return {
    userData: {
      node: nodes[bestIndex],
      visual: nodeMeshes[bestIndex],
    },
  };
}

function updateSelectionOverlay(color, selectedNodeItems, visibleEdges, fadingEdges, options = {}) {
  const material = selectionOverlay.material;
  const pointCount = Math.min(selectedNodeItems.length, MAX_SELECTION_POINTS);
  const segmentCount = Math.min(visibleEdges.length, MAX_SELECTION_SEGMENTS);
  const fadingSegmentCount = Math.min(fadingEdges.length, MAX_SELECTION_FADING_SEGMENTS);
  const pixelRatio = Math.min(window.devicePixelRatio, 2);
  const zoomScale = INITIAL_CAMERA_DISTANCE / camera.position.z;
  const hasStroke = options.stroke !== false;
  const hasGlow = options.glow !== false;

  renderer.getDrawingBufferSize(selectionScreenSize);
  material.uniforms.resolution.value.copy(selectionScreenSize);
  material.uniforms.nodeRadius.value = 31 * pixelRatio * zoomScale;
  material.uniforms.tubeRadius.value = 16 * pixelRatio * zoomScale;
  material.uniforms.strokeWidth.value = Math.max(1, 1 * pixelRatio * zoomScale);
  material.uniforms.glowWidth.value = 5 * pixelRatio * zoomScale;
  material.uniforms.opacity.value = Number.isFinite(options.opacity)
    ? options.opacity
    : 0.36;
  material.uniforms.pointCount.value = pointCount;
  material.uniforms.segmentCount.value = segmentCount;
  material.uniforms.fadingSegmentCount.value = fadingSegmentCount;
  material.uniforms.color.value.set(color);
  material.uniforms.strokeColor.value.copy(lightenHexColor(color, 0.5));
  material.uniforms.strokeStrength.value = hasStroke ? 1 : 0;
  material.uniforms.glowStrength.value = hasGlow ? 1 : 0;

  graphRoot.updateMatrixWorld(true);
  camera.updateMatrixWorld(true);

  for (let index = 0; index < MAX_SELECTION_POINTS; index += 1) {
    if (index < pointCount) {
      const nodeItem = selectedNodeItems[index];
      projectNodeToScreen(nodeItem.id, selectionOverlay.points[index]);
      selectionOverlay.pointRadii[index] =
        material.uniforms.nodeRadius.value * easeOutCubic(nodeItem.progress);
    } else {
      selectionOverlay.points[index].set(-10000, -10000);
      selectionOverlay.pointRadii[index] = 0;
    }
  }

  for (let index = 0; index < MAX_SELECTION_SEGMENTS; index += 1) {
    if (index < segmentCount) {
      const edge = visibleEdges[index];
      const origin = edge.origin;
      const progress = easeOutCubic(edge.progress);
      const startPoint = projectNodeToScreen(edge.a, selectionProjectionScratch.startScreen);
      const endPoint = projectNodeToScreen(edge.b, selectionProjectionScratch.endScreen);

      if (origin === edge.a) {
        selectionOverlay.segmentStarts[index].copy(startPoint);
        selectionOverlay.segmentEnds[index].copy(startPoint).lerp(endPoint, progress);
      } else if (origin === edge.b) {
        selectionOverlay.segmentStarts[index].copy(endPoint);
        selectionOverlay.segmentEnds[index].copy(endPoint).lerp(startPoint, progress);
      } else {
        selectionOverlay.segmentStarts[index].copy(startPoint);
        selectionOverlay.segmentEnds[index].copy(endPoint);
      }
    } else {
      selectionOverlay.segmentStarts[index].set(-10000, -10000);
      selectionOverlay.segmentEnds[index].set(-10000, -10000);
    }
  }

  for (let index = 0; index < MAX_SELECTION_FADING_SEGMENTS; index += 1) {
    if (index < fadingSegmentCount) {
      const edge = fadingEdges[index];
      if (!projectSegmentToScreen(
        edge.start,
        edge.end,
        selectionOverlay.fadingSegmentStarts[index],
        selectionOverlay.fadingSegmentEnds[index],
      )) {
        selectionOverlay.fadingSegmentStarts[index].set(-10000, -10000);
        selectionOverlay.fadingSegmentEnds[index].set(-10000, -10000);
        selectionOverlay.fadingSegmentProgresses[index] = 0;
        continue;
      }

      selectionOverlay.fadingSegmentProgresses[index] = easeOutCubic(edge.progress);
    } else {
      selectionOverlay.fadingSegmentStarts[index].set(-10000, -10000);
      selectionOverlay.fadingSegmentEnds[index].set(-10000, -10000);
      selectionOverlay.fadingSegmentProgresses[index] = 0;
    }
  }
}

function getSelectionGroups() {
  const groups = new Map();
  const fogGroup = getFogSelectionGroup();
  if (fogGroup) {
    groups.set(FOG_SELECTION_GROUP_KEY, fogGroup);
  }

  for (const [nodeId, color] of nodeColors) {
    if (!groups.has(color)) {
      groups.set(color, { nodes: [], edges: [], fadingEdges: [] });
    }
    groups.get(color).nodes.push({
      id: nodeId,
      progress: nodeAnimationProgress.get(nodeId) ?? 1,
    });
  }

  for (const [nodeId, animation] of nodeExitAnimations) {
    if (!groups.has(animation.color)) {
      groups.set(animation.color, { nodes: [], edges: [], fadingEdges: [] });
    }
    groups.get(animation.color).nodes.push({
      id: nodeId,
      progress: animation.progress,
    });
  }

  for (const link of links) {
    const startColor = nodeColors.get(link.a);
    if (startColor && startColor === nodeColors.get(link.b)) {
      const key = getEdgeAnimationKey(startColor, link.a, link.b);
      groups.get(startColor).edges.push({
        ...link,
        origin: edgeAnimationOrigins.get(key),
        progress: edgeAnimationProgress.get(key) ?? 1,
      });
    }
  }

  for (const link of outerLinks) {
    const color = nodeColors.get(link.parentId);
    if (!color) {
      continue;
    }

    groups.get(color).fadingEdges.push({
      ...link,
      progress: nodeAnimationProgress.get(link.parentId) ?? 1,
    });
  }

  for (const [nodeId, animation] of nodeExitAnimations) {
    if (!groups.has(animation.color)) {
      groups.set(animation.color, { nodes: [], edges: [], fadingEdges: [] });
    }

    for (const link of outerLinks) {
      if (link.parentId !== nodeId) {
        continue;
      }

      groups.get(animation.color).fadingEdges.push({
        ...link,
        progress: animation.progress,
      });
    }
  }

  for (const animation of edgeExitAnimations.values()) {
    if (!groups.has(animation.color)) {
      groups.set(animation.color, { nodes: [], edges: [], fadingEdges: [] });
    }
    groups.get(animation.color).edges.push(animation);
  }

  return groups;
}

function getFogSelectionGroup() {
  if (!shouldEnforceExploration() || !isGameRuntimeReady || isEditorMode) {
    return null;
  }

  const activeSideId = getActiveGameSideId();
  if (!activeSideId) {
    return null;
  }

  const exploredSystems = getExplorationValues("systems", activeSideId);
  const fogNodeIds = new Set();
  const fogNodes = [];
  for (const node of nodes) {
    const nodeId = String(node.id);
    if (exploredSystems.has(nodeId)) {
      continue;
    }
    fogNodeIds.add(node.id);
    fogNodes.push({ id: node.id, progress: 1 });
  }

  if (fogNodes.length === 0) {
    return null;
  }

  return {
    color: FOG_SELECTION_COLOR,
    nodes: fogNodes,
    edges: links
      .filter((link) => fogNodeIds.has(link.a) && fogNodeIds.has(link.b))
      .map((link) => ({ ...link, progress: 1, origin: null })),
    fadingEdges: [],
    opacity: FOG_SELECTION_OPACITY,
    stroke: false,
    glow: false,
  };
}

function hasSelectionOverlayActivity() {
  return (
    Boolean(getFogSelectionGroup()) ||
    nodeColors.size > 0 ||
    nodeAnimationProgress.size > 0 ||
    edgeAnimationProgress.size > 0 ||
    nodeExitAnimations.size > 0 ||
    edgeExitAnimations.size > 0
  );
}

function projectNodeToScreen(nodeId, target) {
  return projectVectorToScreen(nodes[nodeId].position, target);
}

function projectVectorToScreen(vector, target) {
  const projected = selectionProjectionScratch.vector
    .copy(vector)
    .applyMatrix4(graphRoot.matrixWorld)
    .project(camera);
  return target.set(
    (projected.x * 0.5 + 0.5) * selectionScreenSize.x,
    (projected.y * 0.5 + 0.5) * selectionScreenSize.y,
  );
}

function projectSegmentToScreen(start, end, targetStart, targetEnd) {
  const { startWorld, endWorld, startCamera, endCamera, clipped } = selectionProjectionScratch;
  startWorld.copy(start).applyMatrix4(graphRoot.matrixWorld);
  endWorld.copy(end).applyMatrix4(graphRoot.matrixWorld);
  startCamera.copy(startWorld).applyMatrix4(camera.matrixWorldInverse);
  endCamera.copy(endWorld).applyMatrix4(camera.matrixWorldInverse);
  const nearZ = -camera.near;
  const startVisible = startCamera.z <= nearZ;
  const endVisible = endCamera.z <= nearZ;

  if (!startVisible && !endVisible) {
    return false;
  }

  if (startVisible !== endVisible) {
    const t = (nearZ - startCamera.z) / (endCamera.z - startCamera.z);
    clipped.copy(startCamera).lerp(endCamera, THREE.MathUtils.clamp(t, 0, 1));

    if (startVisible) {
      endCamera.copy(clipped);
    } else {
      startCamera.copy(clipped);
    }
  }

  projectCameraSpaceToScreen(startCamera, targetStart);
  projectCameraSpaceToScreen(endCamera, targetEnd);
  return true;
}

function projectCameraSpaceToScreen(cameraSpacePoint, target) {
  const projected = selectionProjectionScratch.projected.set(
    cameraSpacePoint.x,
    cameraSpacePoint.y,
    cameraSpacePoint.z,
    1,
  ).applyMatrix4(camera.projectionMatrix);
  const inverseW = 1 / projected.w;
  const x = projected.x * inverseW;
  const y = projected.y * inverseW;

  return target.set(
    (x * 0.5 + 0.5) * selectionScreenSize.x,
    (y * 0.5 + 0.5) * selectionScreenSize.y,
  );
}

function updateStarLabels() {
  graphRoot.updateMatrixWorld(true);
  camera.updateMatrixWorld(true);

  const width = window.innerWidth;
  const height = window.innerHeight;
  const projected = starLabelProjection;

  for (let index = 0; index < nodes.length; index += 1) {
    const node = nodes[index];
    const label = labelElements[index];
    projected.copy(node.position).applyMatrix4(graphRoot.matrixWorld).project(camera);

    const visible =
      projected.z > -1 &&
      projected.z < 1 &&
      projected.x > -1.08 &&
      projected.x < 1.08 &&
      projected.y > -1.08 &&
      projected.y < 1.08;
    const x = (projected.x * 0.5 + 0.5) * width;
    const y = (-projected.y * 0.5 + 0.5) * height - 10;

    label.style.left = `${x}px`;
    label.style.top = `${y}px`;
    label.classList.toggle("hidden", !visible || hoveredNode?.userData.node.id === node.id);
  }
  updateStarmapFleetMarkers();
}

function updateStarmapFleetMarkers() {
  if (!starLabels || !isGameRuntimeReady || isStartMenuOpen) {
    return;
  }

  const activeSideId = getActiveGameSideId();
  if (!activeSideId) {
    for (const marker of starmapFleetMarkerElements.values()) {
      hideStarmapFleetMarker(marker);
    }
    return;
  }

  const activeFleetSystemIds = new Set(currentGameState.fleets
    .filter((fleet) => fleet.ownerSideId === activeSideId)
    .map((fleet) => String(fleet.location?.systemId ?? ""))
    .filter(Boolean));
  const fleets = currentGameState.fleets
    .filter((fleet) => fleet.ownerSideId === activeSideId || activeFleetSystemIds.has(String(fleet.location?.systemId)))
    .sort(compareVisibleFleets(activeSideId));

  const visibleFleetIds = new Set(fleets.map((fleet) => String(fleet.id)));
  for (const [fleetId, marker] of starmapFleetMarkerElements) {
    if (!visibleFleetIds.has(fleetId) && !starmapFleetMarkerAnimations.has(fleetId)) {
      hideStarmapFleetMarker(marker);
    }
  }

  const systemMarkerUseCount = new Map();
  for (const fleet of fleets) {
    const marker = getOrCreateStarmapFleetMarker(fleet.id);
    const targetPosition = getStarmapFleetMarkerTargetPosition(fleet, systemMarkerUseCount);
    if (!targetPosition) {
      hideStarmapFleetMarker(marker);
      continue;
    }

    const previousPosition = starmapFleetMarkerPositions.get(fleet.id);
    const isAnimating = starmapFleetMarkerAnimations.has(fleet.id);
    const pendingPath = pendingStarmapFleetMarkerPaths.get(fleet.id);
    const shouldAnimate = targetPosition.visible &&
      !pendingPath &&
      shouldAnimateStarmapFleetMarker(previousPosition, targetPosition);
    marker.dataset.fleetId = fleet.id;
    if (!isAnimating) {
      const startPosition = shouldAnimate || pendingPath
        ? previousPosition ?? getStarmapFleetMarkerPathPosition(pendingPath?.[0] ?? targetPosition.systemId) ?? targetPosition
        : targetPosition;
      marker.style.left = `${Math.round(startPosition.left)}px`;
      marker.style.top = `${Math.round(startPosition.top)}px`;
    }
    marker.style.setProperty("--fleet-color", getSideColorById(fleet.ownerSideId));
    marker.style.setProperty("--fleet-idle-delay", getFleetMarkerIdleDelay(fleet));
    marker.querySelector(".starmap-fleet-marker__number").textContent = formatFleetCreationNumber(fleet);
    marker.classList.toggle("starmap-fleet-marker--foreign", fleet.ownerSideId !== activeSideId);
    marker.classList.toggle("starmap-fleet-marker--selected", selectedFleetId === fleet.id);
    marker.classList.toggle("hidden", !targetPosition.visible);
    marker.tabIndex = fleet.ownerSideId === activeSideId && targetPosition.visible ? 0 : -1;
    marker.setAttribute("aria-label", fleet.name);
    if (pendingPath && targetPosition.visible && !isAnimating) {
      pendingStarmapFleetMarkerPaths.delete(fleet.id);
      const pathStartPosition = previousPosition ?? getStarmapFleetMarkerPathPosition(pendingPath[0]);
      if (pathStartPosition) {
        animateStarmapFleetMarkerPath(marker, fleet, pathStartPosition, pendingPath, targetPosition);
      } else {
        setStarmapFleetMarkerStoredPosition(fleet.id, targetPosition);
      }
    } else if (pendingPath && !targetPosition.visible && !isAnimating) {
      pendingStarmapFleetMarkerPaths.delete(fleet.id);
      setStarmapFleetMarkerStoredPosition(fleet.id, targetPosition);
    } else if (shouldAnimate && !isAnimating) {
      animateStarmapFleetMarker(marker, fleet, previousPosition, targetPosition);
    } else if (!isAnimating) {
      setStarmapFleetMarkerStoredPosition(fleet.id, targetPosition);
    }
  }
}

function getOrCreateStarmapFleetMarker(fleetId) {
  const normalizedFleetId = String(fleetId ?? "").trim();
  let marker = starmapFleetMarkerElements.get(normalizedFleetId);
  if (marker) {
    return marker;
  }

  marker = document.createElement("button");
  marker.className = "starmap-fleet-marker hidden";
  marker.type = "button";
  marker.dataset.fleetId = normalizedFleetId;
  marker.innerHTML = '<span class="starmap-fleet-marker__stripe"></span><img class="starmap-fleet-marker__icon" src="/MainUI/Fleet_marker.svg" alt=""><span class="starmap-fleet-marker__number"></span>';
  marker.addEventListener("click", (event) => {
    event.preventDefault();
    event.stopPropagation();
    const fleet = getFleetById(marker.dataset.fleetId);
    if (isFleetControlledByActiveSide(fleet)) {
      selectFleet(fleet.id);
    }
  });
  starLabels.append(marker);
  starmapFleetMarkerElements.set(normalizedFleetId, marker);
  return marker;
}

function hideStarmapFleetMarker(marker) {
  marker.classList.add("hidden");
  marker.tabIndex = -1;
  marker.removeAttribute("aria-label");
}

function getStarmapFleetMarkerTargetPosition(fleet, systemMarkerUseCount) {
  const systemKey = normalizeRuntimeNullableString(fleet?.location?.systemId);
  if (!systemKey) {
    return null;
  }

  const useIndex = systemMarkerUseCount.get(systemKey) ?? 0;
  systemMarkerUseCount.set(systemKey, useIndex + 1);
  return getStarmapFleetMarkerPathPosition(systemKey, useIndex);
}

function getStarmapFleetMarkerPathPosition(systemId, useIndex = 0) {
  const systemKey = normalizeRuntimeNullableString(systemId);
  const node = getRuntimeNodeById(systemKey);
  if (!node) {
    return null;
  }

  starLabelProjection.copy(node.position).applyMatrix4(graphRoot.matrixWorld).project(camera);
  const visible =
    starLabelProjection.z > -1 &&
    starLabelProjection.z < 1 &&
    starLabelProjection.x > -1.08 &&
    starLabelProjection.x < 1.08 &&
    starLabelProjection.y > -1.08 &&
    starLabelProjection.y < 1.08;
  const x = (starLabelProjection.x * 0.5 + 0.5) * window.innerWidth;
  const y = (-starLabelProjection.y * 0.5 + 0.5) * window.innerHeight;
  return {
    systemId: systemKey,
    anchorKey: `starmap:${systemKey}`,
    left: x - 8,
    top: y + (useIndex - 0.5) * 11,
    visible,
  };
}

function shouldAnimateStarmapFleetMarker(previousPosition, targetPosition) {
  if (suppressFleetMarkerAnimation || !previousPosition || !targetPosition) {
    return false;
  }
  if (previousPosition.anchorKey === targetPosition.anchorKey) {
    return false;
  }
  return Math.hypot(
    previousPosition.left - targetPosition.left,
    previousPosition.top - targetPosition.top,
  ) > 6;
}

function setStarmapFleetMarkerStoredPosition(fleetId, position) {
  const normalizedFleetId = String(fleetId ?? "").trim();
  if (!normalizedFleetId || !position) {
    return;
  }
  starmapFleetMarkerPositions.set(normalizedFleetId, {
    systemId: String(position.systemId ?? ""),
    anchorKey: String(position.anchorKey ?? ""),
    left: Number(position.left) || 0,
    top: Number(position.top) || 0,
  });
}

function animateStarmapFleetMarker(marker, fleet, from, to) {
  cancelStarmapFleetMarkerAnimation(fleet.id);
  const movement = createFleetMovement(from, to, fleet.id);
  const startedAt = performance.now();
  marker.classList.add("starmap-fleet-marker--moving");

  const tick = (now) => {
    if (!marker.isConnected) {
      cancelStarmapFleetMarkerAnimation(fleet.id);
      return;
    }

    const progress = THREE.MathUtils.clamp((now - startedAt) / movement.duration, 0, 1);
    const easedProgress = easeFleetMovement(progress);
    const point = getCubicBezierPoint(
      movement.start,
      movement.controlA,
      movement.controlB,
      movement.end,
      easedProgress,
    );
    marker.style.left = `${point.x.toFixed(2)}px`;
    marker.style.top = `${point.y.toFixed(2)}px`;
    setStarmapFleetMarkerStoredPosition(fleet.id, {
      ...to,
      left: point.x,
      top: point.y,
    });

    if (progress < 1) {
      const frameId = requestAnimationFrame(tick);
      starmapFleetMarkerAnimations.set(fleet.id, { frameId, marker });
      return;
    }

    marker.style.left = `${Math.round(to.left)}px`;
    marker.style.top = `${Math.round(to.top)}px`;
    marker.classList.remove("starmap-fleet-marker--moving");
    setStarmapFleetMarkerStoredPosition(fleet.id, to);
    starmapFleetMarkerAnimations.delete(fleet.id);
  };

  const frameId = requestAnimationFrame(tick);
  starmapFleetMarkerAnimations.set(fleet.id, { frameId, marker });
}

function animateStarmapFleetMarkerPath(marker, fleet, from, path, finalTargetPosition) {
  cancelStarmapFleetMarkerAnimation(fleet.id);
  const normalizedPath = Array.isArray(path)
    ? path.map((systemId) => normalizeRuntimeNullableString(systemId)).filter(Boolean)
    : [];
  const segmentTargets = normalizedPath
    .slice(1)
    .map((systemId, index, systems) => {
      const isFinalSegment = index === systems.length - 1;
      return isFinalSegment
        ? finalTargetPosition
        : getStarmapFleetMarkerPathPosition(systemId);
    })
    .filter(Boolean);

  if (segmentTargets.length === 0) {
    marker.style.left = `${Math.round(finalTargetPosition.left)}px`;
    marker.style.top = `${Math.round(finalTargetPosition.top)}px`;
    setStarmapFleetMarkerStoredPosition(fleet.id, finalTargetPosition);
    return;
  }

  animateStarmapFleetMarkerPathSegment(marker, fleet, from, segmentTargets, 0);
}

function animateStarmapFleetMarkerPathSegment(marker, fleet, from, segmentTargets, segmentIndex) {
  const to = segmentTargets[segmentIndex];
  if (!to) {
    marker.classList.remove("starmap-fleet-marker--moving");
    starmapFleetMarkerAnimations.delete(fleet.id);
    return;
  }

  const movement = createFleetMovement(from, to, `${fleet.id}:starmap:${segmentIndex}`);
  const startedAt = performance.now();
  marker.classList.add("starmap-fleet-marker--moving");

  const tick = (now) => {
    if (!marker.isConnected) {
      cancelStarmapFleetMarkerAnimation(fleet.id);
      return;
    }

    const progress = THREE.MathUtils.clamp((now - startedAt) / movement.duration, 0, 1);
    const easedProgress = easeFleetMovement(progress);
    const liveTarget = getLiveSystemFleetMarkerTarget(to, now);
    const liveEnd = { x: liveTarget.left, y: liveTarget.top };
    const liveEndOffset = {
      x: liveEnd.x - movement.end.x,
      y: liveEnd.y - movement.end.y,
    };
    const liveControlB = {
      x: movement.controlB.x + liveEndOffset.x,
      y: movement.controlB.y + liveEndOffset.y,
    };
    const point = getCubicBezierPoint(
      movement.start,
      movement.controlA,
      liveControlB,
      liveEnd,
      easedProgress,
    );
    marker.style.left = `${point.x.toFixed(2)}px`;
    marker.style.top = `${point.y.toFixed(2)}px`;
    setStarmapFleetMarkerStoredPosition(fleet.id, {
      ...to,
      left: point.x,
      top: point.y,
    });

    if (progress < 1) {
      const frameId = requestAnimationFrame(tick);
      starmapFleetMarkerAnimations.set(fleet.id, { frameId, marker });
      return;
    }

    marker.style.left = `${Math.round(to.left)}px`;
    marker.style.top = `${Math.round(to.top)}px`;
    setStarmapFleetMarkerStoredPosition(fleet.id, to);
    if (segmentIndex < segmentTargets.length - 1) {
      animateStarmapFleetMarkerPathSegment(marker, fleet, to, segmentTargets, segmentIndex + 1);
      return;
    }

    marker.classList.remove("starmap-fleet-marker--moving");
    starmapFleetMarkerAnimations.delete(fleet.id);
  };

  const frameId = requestAnimationFrame(tick);
  starmapFleetMarkerAnimations.set(fleet.id, { frameId, marker });
}

function cancelStarmapFleetMarkerAnimation(fleetId) {
  const normalizedFleetId = String(fleetId ?? "").trim();
  const animation = starmapFleetMarkerAnimations.get(normalizedFleetId);
  if (!animation) {
    return;
  }
  cancelAnimationFrame(animation.frameId);
  animation.marker?.classList?.remove("starmap-fleet-marker--moving");
  starmapFleetMarkerAnimations.delete(normalizedFleetId);
  pendingStarmapFleetMarkerPaths.delete(normalizedFleetId);
}

function cancelStarmapFleetMarkerAnimations() {
  for (const fleetId of Array.from(starmapFleetMarkerAnimations.keys())) {
    cancelStarmapFleetMarkerAnimation(fleetId);
  }
}

function isStarmapFleetMovementLocked() {
  return starmapFleetMarkerAnimations.size > 0;
}

function positionTooltip(clientX, clientY) {
  positionHoverElements(clientX, clientY, hoverNameWrap, hoverPanel);
}

function positionSystemTooltip(clientX, clientY) {
  const radiusOffset = hoveredSystemBody ? Number(hoveredSystemBody.dataset.radius) + 2 : 0;
  positionHoverElements(clientX, clientY, systemHoverNameWrap, systemHoverPanel, radiusOffset);
}

function onSystemPlanetMenuOutsidePointerDown(event) {
  if (systemPlanetMenu.hidden) {
    return;
  }
  const target = event.target instanceof Element ? event.target : null;
  if (target && (systemPlanetMenu.contains(target) || target.closest(".system-planet-hit"))) {
    return;
  }
  closeSystemPlanetMenu();
}

function showSystemPlanetMenu(planet, clientX, clientY) {
  if (!planet) {
    return;
  }

  activeSystemPlanetMenuPlanet = planet;
  systemPlanetMenu.replaceChildren();
  systemPlanetMenu.append(
    createSystemPlanetMenuButton("TO ORBIT", () => {
      closeSystemPlanetMenu();
      startPlanetEntryTransition(planet, clientX, clientY);
    }),
    createSystemPlanetMenuButton(`TO ${planet.name}`, () => {
      openSystemPlanetDetailFromMenu(planet, getObjectDetailStateKey({
        systemId: planet.systemId,
        kind: planet.kind,
        name: planet.name,
      }), clientX, clientY, planet);
    }),
    ...planet.moonList.slice(0, 3).map((moon) => {
      const moonEntryTarget = {
        ...moon,
        kind: "MOON",
        entryType: moon.sizeName ?? getMoonSizeLabel(moon),
      };
      return createSystemPlanetMenuButton(`TO ${moon.name}`, () => {
        openSystemPlanetDetailFromMenu(planet, getObjectDetailStateKey({
          systemId: planet.systemId,
          kind: "MOON",
          name: moon.name,
        }), clientX, clientY, moonEntryTarget);
      });
    }),
  );
  systemPlanetMenu.hidden = false;
  systemPlanetMenu.setAttribute("aria-hidden", "false");
  positionSystemPlanetMenu(clientX, clientY);
  requestAnimationFrame(() => {
    if (!systemPlanetMenu.hidden && activeSystemPlanetMenuPlanet === planet) {
      positionSystemPlanetMenu(clientX, clientY);
    }
  });
}

function createSystemPlanetMenuButton(label, onClick) {
  const button = document.createElement("button");
  button.className = "system-planet-menu__button";
  button.type = "button";
  button.textContent = label;
  button.addEventListener("click", (event) => {
    event.preventDefault();
    event.stopPropagation();
    onClick();
  });
  return button;
}

function positionSystemPlanetMenu(clientX, clientY) {
  const menuWidth = systemPlanetMenu.offsetWidth || 160;
  const menuHeight = systemPlanetMenu.offsetHeight || 36;
  const left = THREE.MathUtils.clamp(clientX - menuWidth / 2, 12, window.innerWidth - menuWidth - 12);
  const top = THREE.MathUtils.clamp(clientY + 16, 12, window.innerHeight - menuHeight - 12);
  systemPlanetMenu.style.left = `${left}px`;
  systemPlanetMenu.style.top = `${top}px`;
}

function closeSystemPlanetMenu() {
  activeSystemPlanetMenuPlanet = null;
  systemPlanetMenu.hidden = true;
  systemPlanetMenu.setAttribute("aria-hidden", "true");
  systemPlanetMenu.replaceChildren();
}

async function openSystemPlanetDetailFromMenu(planet, detailKey, clientX, clientY, entryTarget = planet) {
  if (!planet || !isPlanetAccessibleForActiveSide(planet)) {
    closeSystemPlanetMenu();
    return;
  }

  closeSystemPlanetMenu();
  showPlanetEntryLoadingOverlay(entryTarget);
  markPlanetViewVisitedForActiveSide(planet);
  await restorePlanetScreenFromSession(planet, {
    persist: false,
    preserveEntryOverlay: true,
  });
  await nextAnimationFrame();
  const detail = findRenderedPlanetDetailByKey(detailKey);
  if (!detail) {
    await hidePlanetEntryLoadingOverlay();
    persistRuntimeSession("planet");
    return;
  }
  await openObjectDetailFromPlanetView(detail, clientX, clientY, {
    keepPlanetEntryOverlayUntilZoom: true,
  });
}

function positionHoverElements(clientX, clientY, nameElement, panelElement, verticalOffset = 0) {
  const nameWidth = nameElement.offsetWidth || 120;
  const panelHeight = panelElement.offsetHeight || 63;
  const panelWidth = panelElement.offsetWidth || 112;
  const centeredNameX = THREE.MathUtils.clamp(clientX, nameWidth / 2 + 12, window.innerWidth - nameWidth / 2 - 12);
  const centeredPanelX = THREE.MathUtils.clamp(clientX, panelWidth / 2 + 12, window.innerWidth - panelWidth / 2 - 12);
  const nameTop = THREE.MathUtils.clamp(clientY - 62 - verticalOffset, 12, window.innerHeight - 24);
  const panelTop = THREE.MathUtils.clamp(clientY + 10 + verticalOffset, 12, window.innerHeight - panelHeight - 12);

  nameElement.style.left = `${centeredNameX}px`;
  nameElement.style.top = `${nameTop}px`;
  panelElement.style.left = `${centeredPanelX}px`;
  panelElement.style.top = `${panelTop}px`;
}

function resize() {
  if (isAppExited) {
    return;
  }

  const width = window.innerWidth;
  const height = window.innerHeight;
  if (!isGameRuntimeReady) {
    resizeStartMenuScene(width, height);
    return;
  }

  const pixelRatio = Math.min(window.devicePixelRatio, 2);
  camera.aspect = width / height;
  camera.updateProjectionMatrix();
  renderer.setSize(width, height, false);
  systemGlowLayer?.resize(width, height);
  const didResizePlanetScreen = planetScreenController.resize();
  if (
    !didResizePlanetScreen &&
    !isObjectDetailOpen &&
    systemScreenController.isOpen() &&
    systemScreenController.state.activeNode
  ) {
    suppressFleetMarkerAnimation = true;
    try {
      renderStarSystem(systemScreenController.state.activeNode);
    } finally {
      suppressFleetMarkerAnimation = false;
    }
    renderSystemStars(systemScreenController.state.activeNode);
    renderSystemParticles(systemScreenController.state.activeNode);
    updateSystemGlow(width / 2, height / 2, 0, 0);
  }
  graphRoot.traverse((object) => {
    if (object.userData.isSkyPixels) {
      object.material.uniforms.pixelRatio.value = pixelRatio;
    }
  });
  if (isGameRuntimeReady && !isStartMenuOpen) {
    musicPlayerController.ensureSystemPosition();
  }
  resizeObjectDetail3D();
  renderObjectDetail3D();
  musicPlayerController.updateScrollbar();
  if (isStartMenuOpen && !systemScreenController.isOpen()) {
    renderStarmapFrame();
  }
}

function startAnimationLoop() {
  if (isAppExited || isStartMenuOpen || !isGameRuntimeReady || animationFrameId !== null) {
    return;
  }

  lastFrameTime = performance.now();
  animationFrameId = requestAnimationFrame(animate);
}

function stopAnimationLoop() {
  if (animationFrameId === null) {
    return;
  }

  cancelAnimationFrame(animationFrameId);
  animationFrameId = null;
}

function renderStarmapFrame() {
  if (isAppExited || !isGameRuntimeReady || systemScreenController.isOpen()) {
    return;
  }

  renderer.clear(true, true, true);
  renderer.render(scene, camera);
  renderer.clearDepth();

  if (hasSelectionOverlayActivity()) {
    for (const [color, group] of getSelectionGroups()) {
      updateSelectionOverlay(group.color ?? color, group.nodes, group.edges, group.fadingEdges, group);
      renderer.render(selectionOverlay.scene, selectionOverlay.camera);
    }
  }
}

function animate() {
  animationFrameId = null;
  if (isAppExited || isStartMenuOpen || !isGameRuntimeReady) {
    return;
  }

  enforceNoMenuEnvironmentAudioInGame();
  animationFrameId = requestAnimationFrame(animate);
  const now = performance.now();
  const deltaSeconds = Math.min(0.05, (now - lastFrameTime) / 1000);
  lastFrameTime = now;
  updateGameNavigationUi();

  if (isGameDialogOpen()) {
    pauseGameInteractions();
    return;
  }

  if (!systemScreenController.isOpen()) {
    updateHover();
    updateStarLabels();
    updateSelectionAnimations();
    updateLinkPulse(deltaSeconds);

    if (isStarmapFleetMovementLocked()) {
      cancelGraphDrag();
      rotationVelocity.set(0, 0);
      targetCameraDistance = camera.position.z;
      targetRotation.x = graphRoot.rotation.x;
      targetRotation.y = graphRoot.rotation.y;
      targetRotation.z = graphRoot.rotation.z;
    } else {
      camera.position.z = THREE.MathUtils.lerp(camera.position.z, targetCameraDistance, 0.14);
      graphRoot.rotation.x = THREE.MathUtils.lerp(graphRoot.rotation.x, targetRotation.x, 0.08);
      graphRoot.rotation.y = THREE.MathUtils.lerp(graphRoot.rotation.y, targetRotation.y, 0.08);
      graphRoot.rotation.z = Math.sin(performance.now() * 0.00012) * 0.025;

      if (!isDragging) {
        targetRotation.x += rotationVelocity.x;
        targetRotation.y += rotationVelocity.y;
        rotationVelocity.multiplyScalar(0.95);
      }
    }
  } else if (!planetScreenController.isOpen() && !isObjectDetailOpen && activeSystemStarSurface) {
    drawSystemStarSurface(activeSystemStarSurface, now);
  }

  if (systemScreenController.isOpen() && !planetScreenController.isOpen() && !isObjectDetailOpen) {
    updateSystemParallax(lastClientPointer.x, lastClientPointer.y);
    updateSystemFleetMarkerDrift(now);
    updateSystemDecorTrails(now);
  }

  planetScreenController.tick(now, deltaSeconds);

  if (updateObjectDetailLightMotion(now)) {
    renderObjectDetail3D();
  }

  if (!planetScreenController.isOpen() && !isObjectDetailOpen) {
    updateSystemPlanetRotationLayers(deltaSeconds, now);
  }

  if (isPlanetWindowOpen) {
    updatePlanetLink();
  }

  renderStarmapFrame();
}
