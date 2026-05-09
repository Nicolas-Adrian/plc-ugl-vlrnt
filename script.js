const STORAGE_KEY = "valorant-bo5-scoreboard-state";
const CHANNEL_NAME = "valorant-bo5-scoreboard-channel";
const CLIENT_ID = `${Date.now()}-${Math.random().toString(16).slice(2)}`;
const APPS_SCRIPT_URL = String(window.SCOREBOARD_APPS_SCRIPT_URL || "").trim();

const DEFAULT_STATE = {
  leftName: "LOUD",
  rightName: "C9",
  leftRecord: "1-2",
  rightRecord: "1-2",
  leftScore: 1,
  rightScore: 5,
  leftSeries: 1,
  rightSeries: 0,
  round: 7,
  showSpike: true,
  scale: 100,
  leftLogo: "",
  rightLogo: ""
};

const STATE_KEYS = Object.keys(DEFAULT_STATE);
const isController = document.body.dataset.page === "controller";
const channel = "BroadcastChannel" in window ? new BroadcastChannel(CHANNEL_NAME) : null;
const pageProtocol = window.location ? window.location.protocol : "file:";
const pageHostname = window.location ? window.location.hostname : "";
const canUseServerSync = pageProtocol === "http:" || pageProtocol === "https:";
const hasAppsScriptSync = /^https?:\/\//.test(APPS_SCRIPT_URL);
const canUseLocalServerSync = canUseServerSync
  && !hasAppsScriptSync
  && ["localhost", "127.0.0.1", ""].includes(pageHostname);

const elements = {
  root: document.documentElement,
  leftNamePreview: document.querySelector("#leftNamePreview"),
  rightNamePreview: document.querySelector("#rightNamePreview"),
  leftRecordPreview: document.querySelector("#leftRecordPreview"),
  rightRecordPreview: document.querySelector("#rightRecordPreview"),
  leftScorePreview: document.querySelector("#leftScorePreview"),
  rightScorePreview: document.querySelector("#rightScorePreview"),
  leftLogoPreview: document.querySelector("#leftLogoPreview"),
  rightLogoPreview: document.querySelector("#rightLogoPreview"),
  leftLogoInitials: document.querySelector("#leftLogoInitials"),
  rightLogoInitials: document.querySelector("#rightLogoInitials"),
  leftSeriesPreview: document.querySelector("#leftSeriesPreview"),
  rightSeriesPreview: document.querySelector("#rightSeriesPreview"),
  roundPreview: document.querySelector("#roundPreview"),
  spikeMarker: document.querySelector("#spikeMarker"),
  leftNameInput: document.querySelector("#leftNameInput"),
  rightNameInput: document.querySelector("#rightNameInput"),
  leftRecordInput: document.querySelector("#leftRecordInput"),
  rightRecordInput: document.querySelector("#rightRecordInput"),
  leftScoreInput: document.querySelector("#leftScoreInput"),
  rightScoreInput: document.querySelector("#rightScoreInput"),
  leftLogoInput: document.querySelector("#leftLogoInput"),
  rightLogoInput: document.querySelector("#rightLogoInput"),
  leftSeriesInput: document.querySelector("#leftSeriesInput"),
  rightSeriesInput: document.querySelector("#rightSeriesInput"),
  roundInput: document.querySelector("#roundInput"),
  spikeToggleInput: document.querySelector("#spikeToggleInput"),
  scaleInput: document.querySelector("#scaleInput"),
  resetButton: document.querySelector("#resetButton")
};

function clamp(value, min, max) {
  const number = Number(value);
  if (Number.isNaN(number)) {
    return min;
  }

  return Math.min(Math.max(number, min), max);
}

function pickScoreboardState(source = {}) {
  const nextState = { ...DEFAULT_STATE };

  STATE_KEYS.forEach((key) => {
    if (Object.prototype.hasOwnProperty.call(source, key)) {
      nextState[key] = source[key];
    }
  });

  return nextState;
}

function normalizeState(nextState) {
  nextState.leftName = String(nextState.leftName || "").trim() || "LOUD";
  nextState.rightName = String(nextState.rightName || "").trim() || "C9";
  nextState.leftRecord = String(nextState.leftRecord || "");
  nextState.rightRecord = String(nextState.rightRecord || "");
  nextState.leftSeries = clamp(nextState.leftSeries, 0, 3);
  nextState.rightSeries = clamp(nextState.rightSeries, 0, 3);
  nextState.leftScore = clamp(nextState.leftScore, 0, 99);
  nextState.rightScore = clamp(nextState.rightScore, 0, 99);
  nextState.round = clamp(nextState.round, 1, 99);
  nextState.scale = clamp(nextState.scale, 70, 120);
  nextState.showSpike = Boolean(nextState.showSpike);
  nextState.leftLogo = String(nextState.leftLogo || "");
  nextState.rightLogo = String(nextState.rightLogo || "");
  return nextState;
}

function loadStoredState() {
  try {
    const rawState = localStorage.getItem(STORAGE_KEY);
    return rawState ? JSON.parse(rawState) : {};
  } catch (error) {
    console.warn("Nao foi possivel carregar o estado salvo.", error);
    return {};
  }
}

const state = normalizeState(pickScoreboardState(loadStoredState()));

function initialsFromName(name) {
  const cleanName = name.trim();
  if (!cleanName) {
    return "--";
  }

  return cleanName
    .split(/\s+/)
    .slice(0, 2)
    .map((word) => word[0])
    .join("")
    .toUpperCase();
}

function setText(element, value) {
  if (element) {
    element.textContent = value;
  }
}

function renderSeries(container, teamSide, amount) {
  if (!container) {
    return;
  }

  container.replaceChildren();

  for (let index = 1; index <= 3; index += 1) {
    const dot = document.createElement("button");
    dot.type = "button";
    dot.className = `series-dot${index <= amount ? " is-active" : ""}`;
    dot.setAttribute("aria-label", `${index} vitoria${index > 1 ? "s" : ""} da equipe ${teamSide === "left" ? state.leftName : state.rightName}`);

    if (isController) {
      dot.addEventListener("click", () => {
        state[`${teamSide}Series`] = state[`${teamSide}Series`] === index ? index - 1 : index;
        syncInputs();
        render();
        publishState();
      });
    } else {
      dot.tabIndex = -1;
    }

    container.append(dot);
  }
}

function setLogo(side, source) {
  const preview = elements[`${side}LogoPreview`];
  if (!preview) {
    return;
  }

  const frame = preview.parentElement;
  preview.src = source || "";

  if (frame) {
    frame.classList.toggle("has-image", Boolean(source));
  }
}

function render() {
  normalizeState(state);

  setText(elements.leftNamePreview, state.leftName);
  setText(elements.rightNamePreview, state.rightName);
  setText(elements.leftRecordPreview, state.leftRecord || "-");
  setText(elements.rightRecordPreview, state.rightRecord || "-");
  setText(elements.leftScorePreview, state.leftScore);
  setText(elements.rightScorePreview, state.rightScore);
  setText(elements.leftLogoInitials, initialsFromName(state.leftName));
  setText(elements.rightLogoInitials, initialsFromName(state.rightName));
  setText(elements.roundPreview, `ROUND ${state.round}`);

  if (elements.spikeMarker) {
    elements.spikeMarker.classList.toggle("is-visible", state.showSpike);
  }

  elements.root.style.setProperty("--overlay-width", `${Math.round(1140 * (state.scale / 100))}px`);

  setLogo("left", state.leftLogo);
  setLogo("right", state.rightLogo);
  renderSeries(elements.leftSeriesPreview, "left", state.leftSeries);
  renderSeries(elements.rightSeriesPreview, "right", state.rightSeries);
}

function syncInputs() {
  if (!isController) {
    return;
  }

  if (elements.leftNameInput) elements.leftNameInput.value = state.leftName;
  if (elements.rightNameInput) elements.rightNameInput.value = state.rightName;
  if (elements.leftRecordInput) elements.leftRecordInput.value = state.leftRecord;
  if (elements.rightRecordInput) elements.rightRecordInput.value = state.rightRecord;
  if (elements.leftScoreInput) elements.leftScoreInput.value = state.leftScore;
  if (elements.rightScoreInput) elements.rightScoreInput.value = state.rightScore;
  if (elements.leftSeriesInput) elements.leftSeriesInput.value = state.leftSeries;
  if (elements.rightSeriesInput) elements.rightSeriesInput.value = state.rightSeries;
  if (elements.roundInput) elements.roundInput.value = state.round;
  if (elements.spikeToggleInput) elements.spikeToggleInput.checked = state.showSpike;
  if (elements.scaleInput) elements.scaleInput.value = state.scale;
}

function createAppsScriptUrl(parameters = {}) {
  const url = new URL(APPS_SCRIPT_URL);
  Object.entries(parameters).forEach(([key, value]) => {
    url.searchParams.set(key, value);
  });

  return url.toString();
}

function requestAppsScriptState() {
  return new Promise((resolve, reject) => {
    const callbackName = `scoreboardState_${CLIENT_ID.replace(/[^A-Za-z0-9_]/g, "_")}_${Date.now()}`;
    const script = document.createElement("script");
    const timeout = window.setTimeout(() => {
      cleanup();
      reject(new Error("Limite esgotado ao buscar estado do Apps Script."));
    }, 8000);

    function cleanup() {
      window.clearTimeout(timeout);
      delete window[callbackName];
      script.remove();
    }

    window[callbackName] = (payload) => {
      cleanup();
      resolve(payload || {});
    };

    script.src = createAppsScriptUrl({
      action: "getState",
      callback: callbackName,
      t: String(Date.now())
    });
    script.onerror = () => {
      cleanup();
      reject(new Error("Nao foi possivel carregar o Apps Script."));
    };

    document.head.append(script);
  });
}

function postAppsScriptState(payload) {
  fetch(APPS_SCRIPT_URL, {
    method: "POST",
    mode: "no-cors",
    headers: { "Content-Type": "text/plain;charset=utf-8" },
    body: JSON.stringify({ state: payload })
  }).catch((error) => {
    console.warn("Nao foi possivel enviar o estado ao Apps Script.", error);
  });
}

function getPayload() {
  return { ...pickScoreboardState(state), sourceId: CLIENT_ID };
}

function publishState() {
  const payload = getPayload();

  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(payload));
  } catch (error) {
    console.warn("Nao foi possivel salvar o estado. Reduza o tamanho das logos.", error);
  }

  if (channel) {
    channel.postMessage(payload);
  }

  if (hasAppsScriptSync) {
    postAppsScriptState(payload);
    return;
  }

  if (canUseLocalServerSync) {
    fetch("/state", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload)
    }).catch((error) => {
      console.warn("Nao foi possivel enviar o estado ao servidor local.", error);
    });
  }
}

function updateAndPublish() {
  render();
  publishState();
}

function applyExternalState(nextState) {
  if (!nextState || Object.keys(nextState).length === 0 || nextState.sourceId === CLIENT_ID) {
    return;
  }

  Object.assign(state, normalizeState(pickScoreboardState(nextState)));
  render();
  syncInputs();
}

function bindTextInput(input, key) {
  if (!input) {
    return;
  }

  input.addEventListener("input", () => {
    state[key] = input.value;
    updateAndPublish();
  });
}

function bindNumberInput(input, key, min, max) {
  if (!input) {
    return;
  }

  input.addEventListener("input", () => {
    state[key] = clamp(input.value, min, max);
    updateAndPublish();
  });
}

function bindLogoInput(input, key) {
  if (!input) {
    return;
  }

  input.addEventListener("change", () => {
    const [file] = input.files;
    if (!file) {
      state[key] = "";
      updateAndPublish();
      return;
    }

    const reader = new FileReader();
    reader.addEventListener("load", () => {
      state[key] = reader.result;
      updateAndPublish();
    });
    reader.readAsDataURL(file);
  });
}

function bindControllerEvents() {
  bindTextInput(elements.leftNameInput, "leftName");
  bindTextInput(elements.rightNameInput, "rightName");
  bindTextInput(elements.leftRecordInput, "leftRecord");
  bindTextInput(elements.rightRecordInput, "rightRecord");
  bindNumberInput(elements.leftScoreInput, "leftScore", 0, 99);
  bindNumberInput(elements.rightScoreInput, "rightScore", 0, 99);
  bindNumberInput(elements.leftSeriesInput, "leftSeries", 0, 3);
  bindNumberInput(elements.rightSeriesInput, "rightSeries", 0, 3);
  bindNumberInput(elements.roundInput, "round", 1, 99);
  bindNumberInput(elements.scaleInput, "scale", 70, 120);
  bindLogoInput(elements.leftLogoInput, "leftLogo");
  bindLogoInput(elements.rightLogoInput, "rightLogo");

  if (elements.spikeToggleInput) {
    elements.spikeToggleInput.addEventListener("change", () => {
      state.showSpike = elements.spikeToggleInput.checked;
      updateAndPublish();
    });
  }

  if (elements.spikeMarker) {
    elements.spikeMarker.addEventListener("click", () => {
      state.showSpike = !state.showSpike;
      syncInputs();
      updateAndPublish();
    });
  }

  if (elements.resetButton) {
    elements.resetButton.addEventListener("click", () => {
      Object.assign(state, DEFAULT_STATE);
      if (elements.leftLogoInput) elements.leftLogoInput.value = "";
      if (elements.rightLogoInput) elements.rightLogoInput.value = "";
      syncInputs();
      updateAndPublish();
    });
  }
}

window.addEventListener("storage", (event) => {
  if (event.key !== STORAGE_KEY || !event.newValue) {
    return;
  }

  try {
    applyExternalState(JSON.parse(event.newValue));
  } catch (error) {
    console.warn("Nao foi possivel sincronizar o overlay.", error);
  }
});

if (channel) {
  channel.addEventListener("message", (event) => {
    applyExternalState(event.data);
  });
}

function startServerSync() {
  if (hasAppsScriptSync) {
    requestAppsScriptState()
      .then((nextState) => {
        if (nextState && Object.keys(nextState).length > 0) {
          applyExternalState(nextState);
        }
      })
      .catch((error) => {
        console.warn("Nao foi possivel buscar o estado do Apps Script.", error);
      });

    window.setInterval(() => {
      requestAppsScriptState()
        .then(applyExternalState)
        .catch((error) => {
          console.warn("Nao foi possivel atualizar pelo Apps Script.", error);
        });
    }, isController ? 2500 : 1000);
    return;
  }

  if (!canUseLocalServerSync) {
    return;
  }

  fetch("/state", { cache: "no-store" })
    .then((response) => response.json())
    .then((nextState) => {
      if (nextState && Object.keys(nextState).length > 0) {
        applyExternalState(nextState);
      }
    })
    .catch((error) => {
      console.warn("Nao foi possivel buscar o estado do servidor local.", error);
    });

  if ("EventSource" in window) {
    const source = new EventSource("/events");
    source.addEventListener("message", (event) => {
      try {
        applyExternalState(JSON.parse(event.data || "{}"));
      } catch (error) {
        console.warn("Nao foi possivel ler a sincronizacao ao vivo.", error);
      }
    });
  }
}

render();
startServerSync();

if (isController) {
  bindControllerEvents();
  syncInputs();

  if (!hasAppsScriptSync) {
    publishState();
  }
}
