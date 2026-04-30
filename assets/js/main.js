const STORAGE_KEYS = {
  preset: "roscosmo-theme-preset",
  overrides: "roscosmo-theme-overrides",
};

const THEME_EXPORT_TOKENS = [
  "--bg",
  "--bg-deep",
  "--surface",
  "--surface-strong",
  "--surface-dark",
  "--text",
  "--text-light",
  "--muted",
  "--line",
  "--line-strong",
  "--accent",
  "--accent-2",
  "--accent-3",
  "--brand-blue",
  "--brand-cream",
  "--moss",
  "--sand",
  "--accent-dark",
  "--accent-soft",
  "--shadow",
  "--shadow-strong",
  "--radius-lg",
  "--radius-md",
  "--radius-sm",
  "--max-width",
  "--font-heading",
  "--font-body",
  "--page-wash",
  "--page-grid-image",
  "--page-grid-size",
  "--page-grid-mask",
  "--panel-glow",
  "--panel-hero",
  "--panel-accent",
  "--card-dark",
  "--card-dark-border",
  "--card-dark-border-hover",
  "--card-media-overlay",
  "--signal-wash",
  "--signal-line",
  "--media-frame",
  "--chip-bg",
  "--project-card-bg",
  "--model-bg",
  "--intro-bg",
  "--intro-grid-image",
  "--intro-grid-size",
  "--intro-panel-line",
  "--intro-panel-bg",
  "--intro-scanline",
  "--intro-orb-1",
  "--intro-orb-2",
  "--intro-orb-3",
];

const TYPOGRAPHY_PRESETS = {
  retro: {
    heading: '"Chakra Petch", "Segoe UI", sans-serif',
    body: '"Manrope", "Segoe UI", sans-serif',
  },
  technical: {
    heading: '"Space Grotesk", "Segoe UI", sans-serif',
    body: '"IBM Plex Sans", "Segoe UI", sans-serif',
  },
  editorial: {
    heading: '"Syne", "Segoe UI", sans-serif',
    body: '"Instrument Sans", "Segoe UI", sans-serif',
  },
};

const COLOR_TOKENS = [
  "--bg",
  "--text",
  "--muted",
  "--accent",
  "--accent-2",
  "--accent-3",
  "--brand-blue",
  "--brand-cream",
  "--surface-dark",
];
const STALE_GRADIENT_OVERRIDE_TOKENS = [
  "--panel-hero",
  "--panel-glow",
  "--card-dark",
  "--intro-panel-bg",
];
const prefersReducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
let modelViewerPromise;

document.documentElement.classList.add("reveal-ready");
restoreThemeState();

document.addEventListener("DOMContentLoaded", () => {
  setCurrentYear();
  setActiveNav();
  setupRevealAnimations();
  setupIntroMotion();
  setupHomeScene();
  setupLayeredScenes();
  setupModelLoaders();
  setupThemeLab();
});

function restoreThemeState() {
  try {
    const savedPreset = localStorage.getItem(STORAGE_KEYS.preset);
    const savedOverrides = readThemeOverrides();

    if (savedPreset) {
      document.documentElement.dataset.theme = savedPreset;
    }

    applyThemeOverrides(savedOverrides);
    syncDerivedAccentTokens();
  } catch (error) {
    console.warn("Theme preview could not be restored.", error);
  }
}

function setCurrentYear() {
  document.querySelectorAll("[data-year]").forEach((node) => {
    node.textContent = String(new Date().getFullYear());
  });
}

function setActiveNav() {
  const page = document.body.dataset.page;
  if (!page) {
    return;
  }

  document.querySelectorAll("[data-nav]").forEach((link) => {
    if (link.dataset.nav === page) {
      link.setAttribute("aria-current", "page");
    }
  });
}

function setupThemeLab() {
  const editor = document.querySelector("[data-theme-editor]");
  if (!editor) {
    refreshTokenLabels();
    return;
  }

  const presetSelect = editor.querySelector("[data-theme-preset]");
  const typeSelect = editor.querySelector("[data-type-preset]");
  const exportField = editor.querySelector("[data-theme-export]");
  const copyButton = editor.querySelector("[data-copy-theme]");
  const resetButton = editor.querySelector("[data-reset-overrides]");
  const clearButton = editor.querySelector("[data-clear-theme]");
  const status = editor.querySelector("[data-copy-status]");
  const radiusControl = editor.querySelector("[data-radius-control]");
  const widthControl = editor.querySelector("[data-width-control]");
  const radiusOutput = editor.querySelector("[data-radius-output]");
  const widthOutput = editor.querySelector("[data-width-output]");
  const tokenInputs = editor.querySelectorAll("[data-theme-token]");

  if (presetSelect) {
    presetSelect.value = document.documentElement.dataset.theme || "";

    presetSelect.addEventListener("change", () => {
      if (presetSelect.value) {
        document.documentElement.dataset.theme = presetSelect.value;
        localStorage.setItem(STORAGE_KEYS.preset, presetSelect.value);
      } else {
        document.documentElement.removeAttribute("data-theme");
        localStorage.removeItem(STORAGE_KEYS.preset);
      }

      clearThemeOverrides();
      syncDerivedAccentTokens();
      if (typeSelect) {
        syncTypographySelect(typeSelect);
      }
      syncThemeLabControls(editor);
      setLabStatus(status, "Preset updated. Manual overrides were cleared.");
    });
  }

  if (typeSelect) {
    typeSelect.addEventListener("change", () => {
      const preset = TYPOGRAPHY_PRESETS[typeSelect.value];
      if (!preset) {
        return;
      }

      document.documentElement.style.setProperty("--font-heading", preset.heading);
      document.documentElement.style.setProperty("--font-body", preset.body);
      persistThemeOverrides();
      syncThemeLabControls(editor);
      setLabStatus(status, "Typography pairing updated.");
    });
  }

  tokenInputs.forEach((input) => {
    input.addEventListener("input", () => {
      document.documentElement.style.setProperty(input.dataset.themeToken, input.value);
      if (input.dataset.themeToken === "--accent") {
        syncDerivedAccentTokens();
      }
      persistThemeOverrides();
      syncThemeLabControls(editor);
    });
  });

  if (radiusControl) {
    radiusControl.addEventListener("input", () => {
      const radius = Number(radiusControl.value);
      applyRadiusScale(radius);
      persistThemeOverrides();
      syncThemeLabControls(editor);
      radiusOutput.textContent = `${radius}px`;
    });
  }

  if (widthControl) {
    widthControl.addEventListener("input", () => {
      document.documentElement.style.setProperty("--max-width", `${widthControl.value}px`);
      persistThemeOverrides();
      syncThemeLabControls(editor);
      widthOutput.textContent = `${widthControl.value}px`;
    });
  }

  if (copyButton && exportField) {
    copyButton.addEventListener("click", async () => {
      const block = buildThemeExport();
      exportField.value = block;

      try {
        if (navigator.clipboard?.writeText) {
          await navigator.clipboard.writeText(block);
          setLabStatus(status, "Theme CSS copied to the clipboard.", "success");
        } else {
          exportField.focus();
          exportField.select();
          setLabStatus(status, "Clipboard access unavailable. The export block is selected.", "error");
        }
      } catch (error) {
        exportField.focus();
        exportField.select();
        setLabStatus(status, "Clipboard write failed. The export block is selected instead.", "error");
      }
    });
  }

  if (resetButton) {
    resetButton.addEventListener("click", () => {
      clearThemeOverrides();
      syncDerivedAccentTokens();
      syncThemeLabControls(editor);
      setLabStatus(status, "Manual overrides reset to the selected preset.");
    });
  }

  if (clearButton) {
    clearButton.addEventListener("click", () => {
      document.documentElement.removeAttribute("data-theme");
      localStorage.removeItem(STORAGE_KEYS.preset);
      clearThemeOverrides();
      syncDerivedAccentTokens();
      if (presetSelect) {
        presetSelect.value = "";
      }
      if (typeSelect) {
        syncTypographySelect(typeSelect);
      }
      syncThemeLabControls(editor);
      setLabStatus(status, "Returned to the repository default theme.");
    });
  }

  syncThemeLabControls(editor);
}

function syncThemeLabControls(editor) {
  const rootStyle = getComputedStyle(document.documentElement);

  editor.querySelectorAll("[data-theme-token]").forEach((input) => {
    const token = input.dataset.themeToken;
    input.value = toHex(rootStyle.getPropertyValue(token));
  });

  const radiusControl = editor.querySelector("[data-radius-control]");
  const widthControl = editor.querySelector("[data-width-control]");
  const radiusOutput = editor.querySelector("[data-radius-output]");
  const widthOutput = editor.querySelector("[data-width-output]");
  const exportField = editor.querySelector("[data-theme-export]");
  const typeSelect = editor.querySelector("[data-type-preset]");

  const radiusValue = Math.round(parseFloat(rootStyle.getPropertyValue("--radius-lg")) || 26);
  const widthValue = Math.round(parseFloat(rootStyle.getPropertyValue("--max-width")) || 1180);

  if (radiusControl) {
    radiusControl.value = String(radiusValue);
  }
  if (widthControl) {
    widthControl.value = String(widthValue);
  }
  if (radiusOutput) {
    radiusOutput.textContent = `${radiusValue}px`;
  }
  if (widthOutput) {
    widthOutput.textContent = `${widthValue}px`;
  }
  if (typeSelect) {
    syncTypographySelect(typeSelect);
  }
  if (exportField) {
    exportField.value = buildThemeExport();
  }

  refreshTokenLabels();
}

function syncTypographySelect(select) {
  const heading = normalizeFontValue(getComputedStyle(document.documentElement).getPropertyValue("--font-heading"));
  const body = normalizeFontValue(getComputedStyle(document.documentElement).getPropertyValue("--font-body"));

  const match = Object.entries(TYPOGRAPHY_PRESETS).find(([, preset]) => {
    return (
      normalizeFontValue(preset.heading) === heading &&
      normalizeFontValue(preset.body) === body
    );
  });

  select.value = match ? match[0] : "retro";
}

function buildThemeExport() {
  const rootStyle = getComputedStyle(document.documentElement);
  const preset = document.documentElement.dataset.theme || "repo-default";
  const lines = THEME_EXPORT_TOKENS.map((token) => {
    return `  ${token}: ${rootStyle.getPropertyValue(token).trim()};`;
  });

  return [`/* Preset: ${preset} */`, ":root {", ...lines, "}"].join("\n");
}

function refreshTokenLabels() {
  const rootStyle = getComputedStyle(document.documentElement);

  document.querySelectorAll("[data-token-label]").forEach((node) => {
    const token = node.dataset.tokenLabel;
    if (!token) {
      return;
    }
    node.textContent = toHex(rootStyle.getPropertyValue(token));
  });

  document.querySelectorAll("[data-token-computed]").forEach((node) => {
    const token = node.dataset.tokenComputed;
    if (!token) {
      return;
    }
    node.textContent = rootStyle.getPropertyValue(token).trim();
  });
}

function setLabStatus(statusNode, message, state = "") {
  if (!statusNode) {
    return;
  }

  statusNode.textContent = message;
  statusNode.dataset.state = state;
}

function applyRadiusScale(radius) {
  document.documentElement.style.setProperty("--radius-lg", `${radius}px`);
  document.documentElement.style.setProperty("--radius-md", `${Math.max(0, radius - 6)}px`);
  document.documentElement.style.setProperty("--radius-sm", `${Math.max(0, radius - 10)}px`);
}

function syncDerivedAccentTokens() {
  const accent = getComputedStyle(document.documentElement).getPropertyValue("--accent").trim();
  const accentDark = shadeHex(accent, -26);
  const accentSoft = hexToRgba(accent, 0.12);

  document.documentElement.style.setProperty("--accent-dark", accentDark);
  document.documentElement.style.setProperty("--accent-soft", accentSoft);
}

function readThemeOverrides() {
  try {
    const overrides = JSON.parse(localStorage.getItem(STORAGE_KEYS.overrides) || "{}");

    STALE_GRADIENT_OVERRIDE_TOKENS.forEach((token) => {
      delete overrides[token];
    });

    localStorage.setItem(STORAGE_KEYS.overrides, JSON.stringify(overrides));
    return overrides;
  } catch (error) {
    return {};
  }
}

function persistThemeOverrides() {
  const current = readThemeOverrides();
  const next = { ...current };

  COLOR_TOKENS.forEach((token) => {
    next[token] = getComputedStyle(document.documentElement).getPropertyValue(token).trim();
  });

  next["--accent-dark"] = getComputedStyle(document.documentElement).getPropertyValue("--accent-dark").trim();
  next["--accent-soft"] = getComputedStyle(document.documentElement).getPropertyValue("--accent-soft").trim();
  next["--radius-lg"] = getComputedStyle(document.documentElement).getPropertyValue("--radius-lg").trim();
  next["--radius-md"] = getComputedStyle(document.documentElement).getPropertyValue("--radius-md").trim();
  next["--radius-sm"] = getComputedStyle(document.documentElement).getPropertyValue("--radius-sm").trim();
  next["--max-width"] = getComputedStyle(document.documentElement).getPropertyValue("--max-width").trim();
  next["--font-heading"] = getComputedStyle(document.documentElement).getPropertyValue("--font-heading").trim();
  next["--font-body"] = getComputedStyle(document.documentElement).getPropertyValue("--font-body").trim();

  localStorage.setItem(STORAGE_KEYS.overrides, JSON.stringify(next));
}

function clearThemeOverrides() {
  localStorage.removeItem(STORAGE_KEYS.overrides);
  const tokens = [
    ...COLOR_TOKENS,
    "--accent-dark",
    "--accent-soft",
    "--radius-lg",
    "--radius-md",
    "--radius-sm",
    "--max-width",
    "--font-heading",
    "--font-body",
  ];

  tokens.forEach((token) => {
    document.documentElement.style.removeProperty(token);
  });
}

function applyThemeOverrides(overrides) {
  Object.entries(overrides || {}).forEach(([token, value]) => {
    document.documentElement.style.setProperty(token, value);
  });
}

function toHex(value) {
  const normalized = value.trim();
  if (!normalized) {
    return "#000000";
  }

  if (normalized.startsWith("#")) {
    return expandHex(normalized);
  }

  const match = normalized.match(/\d+(\.\d+)?/g);
  if (!match || match.length < 3) {
    return "#000000";
  }

  const [red, green, blue] = match.slice(0, 3).map((channel) => {
    return Math.max(0, Math.min(255, Math.round(Number(channel))));
  });

  return `#${[red, green, blue]
    .map((channel) => channel.toString(16).padStart(2, "0"))
    .join("")}`;
}

function expandHex(value) {
  const hex = value.replace("#", "").trim();
  if (hex.length === 3) {
    return `#${hex
      .split("")
      .map((char) => char + char)
      .join("")}`;
  }
  return `#${hex.slice(0, 6)}`;
}

function normalizeFontValue(value) {
  return value.replace(/\s+/g, " ").trim();
}

function hexToRgba(hex, alpha) {
  const normalized = expandHex(hex);
  const red = Number.parseInt(normalized.slice(1, 3), 16);
  const green = Number.parseInt(normalized.slice(3, 5), 16);
  const blue = Number.parseInt(normalized.slice(5, 7), 16);
  return `rgba(${red}, ${green}, ${blue}, ${alpha})`;
}

function shadeHex(hex, delta) {
  const normalized = expandHex(hex);
  const channels = [1, 3, 5].map((index) => {
    const channel = Number.parseInt(normalized.slice(index, index + 2), 16);
    return Math.max(0, Math.min(255, channel + delta));
  });

  return `#${channels.map((channel) => channel.toString(16).padStart(2, "0")).join("")}`;
}

function setupRevealAnimations() {
  const items = document.querySelectorAll("[data-reveal]");
  if (!items.length) {
    return;
  }

  if (prefersReducedMotion || !("IntersectionObserver" in window)) {
    items.forEach((item) => item.classList.add("is-visible"));
    return;
  }

  const observer = new IntersectionObserver(
    (entries) => {
      entries.forEach((entry) => {
        if (!entry.isIntersecting) {
          return;
        }

        entry.target.classList.add("is-visible");
        observer.unobserve(entry.target);
      });
    },
    {
      threshold: 0.18,
      rootMargin: "0px 0px -6% 0px",
    }
  );

  items.forEach((item) => observer.observe(item));
}

function setupIntroMotion() {
  const stage = document.querySelector("[data-intro-stage]");
  if (!stage || prefersReducedMotion) {
    return;
  }

  const movers = stage.querySelectorAll("[data-depth]");
  if (!movers.length) {
    return;
  }

  let frameId = 0;
  let pointerX = 0.5;
  let pointerY = 0.5;

  const render = () => {
    movers.forEach((element) => {
      const depth = Number(element.dataset.depth || "0");
      const shiftX = (pointerX - 0.5) * depth * 24;
      const shiftY = (pointerY - 0.5) * depth * 18;
      element.style.transform = `translate3d(${shiftX}px, ${shiftY}px, 0)`;
    });

    frameId = 0;
  };

  const requestRender = () => {
    if (!frameId) {
      frameId = window.requestAnimationFrame(render);
    }
  };

  stage.addEventListener("pointermove", (event) => {
    const bounds = stage.getBoundingClientRect();
    pointerX = (event.clientX - bounds.left) / bounds.width;
    pointerY = (event.clientY - bounds.top) / bounds.height;
    requestRender();
  });

  stage.addEventListener("pointerleave", () => {
    pointerX = 0.5;
    pointerY = 0.5;
    requestRender();
  });

  requestRender();
}

function setupHomeScene() {
  const stage = document.querySelector("[data-home-scene]");
  if (!stage) {
    return;
  }

  const targets = stage.querySelectorAll("[data-scene-target]");
  const panels = stage.querySelectorAll("[data-scene-panel]");
  const resetButtons = document.querySelectorAll("[data-scene-reset]");
  const validTargets = new Set(
    Array.from(targets)
      .map((node) => node.dataset.sceneTarget)
      .filter(Boolean)
  );

  const applyFocus = (target = "", syncHash = true) => {
    const focus = validTargets.has(target) ? target : "";
    stage.dataset.sceneFocus = focus;

    targets.forEach((node) => {
      node.setAttribute("aria-pressed", String(node.dataset.sceneTarget === focus));
    });

    panels.forEach((panel) => {
      panel.setAttribute("aria-hidden", String(panel.dataset.scenePanel !== focus));
    });

    resetButtons.forEach((button) => {
      button.hidden = !focus;
    });

    if (!syncHash) {
      return;
    }

    if (focus) {
      window.history.replaceState(null, "", `#${focus}`);
    } else if (window.location.hash) {
      window.history.replaceState(
        null,
        "",
        `${window.location.pathname}${window.location.search}`
      );
    }
  };

  targets.forEach((node) => {
    node.addEventListener("click", () => {
      const next = node.dataset.sceneTarget || "";
      applyFocus(stage.dataset.sceneFocus === next ? "" : next);
    });
  });

  stage.addEventListener("click", (event) => {
    const interactiveTarget = event.target.closest(
      "[data-scene-target], [data-scene-panel], [data-scene-reset], .scene-brand"
    );

    if (!interactiveTarget && stage.dataset.sceneFocus) {
      applyFocus("");
    }
  });

  resetButtons.forEach((button) => {
    button.addEventListener("click", () => applyFocus(""));
  });

  document.addEventListener("keydown", (event) => {
    if (event.key === "Escape") {
      applyFocus("");
    }
  });

  const hashTarget = window.location.hash.replace("#", "");
  applyFocus(hashTarget, false);

  if (prefersReducedMotion) {
    return;
  }

  const movers = stage.querySelectorAll("[data-depth]");
  if (!movers.length) {
    return;
  }

  const rangeX = Number(stage.dataset.depthRangeX || "16");
  const rangeY = Number(stage.dataset.depthRangeY || "12");
  let frameId = 0;
  let pointerX = 0.5;
  let pointerY = 0.5;

  const render = () => {
    movers.forEach((element) => {
      const depth = Number(element.dataset.depth || "0");
      const shiftX = (pointerX - 0.5) * depth * rangeX;
      const shiftY = (pointerY - 0.5) * depth * rangeY;
      element.style.setProperty("--depth-shift-x", `${shiftX.toFixed(2)}px`);
      element.style.setProperty("--depth-shift-y", `${shiftY.toFixed(2)}px`);
    });

    frameId = 0;
  };

  const requestRender = () => {
    if (!frameId) {
      frameId = window.requestAnimationFrame(render);
    }
  };

  stage.addEventListener("pointermove", (event) => {
    const bounds = stage.getBoundingClientRect();
    pointerX = (event.clientX - bounds.left) / bounds.width;
    pointerY = (event.clientY - bounds.top) / bounds.height;
    requestRender();
  });

  stage.addEventListener("pointerleave", () => {
    pointerX = 0.5;
    pointerY = 0.5;
    requestRender();
  });

  requestRender();
}

function setupLayeredScenes() {
  const scenes = document.querySelectorAll("[data-layered-scene]");
  if (!scenes.length) {
    return;
  }

  scenes.forEach((scene) => {
    bindLayeredSceneMotion(scene);
    loadLayeredScene(scene);
  });
}

function bindLayeredSceneMotion(scene) {
  if (prefersReducedMotion) {
    scene.style.setProperty("--scene-shift-x", "0");
    scene.style.setProperty("--scene-shift-y", "0");
    scene.style.setProperty("--scene-scroll", "0");
    return;
  }

  const rangeX = Number(scene.dataset.sceneRangeX || "24");
  const rangeY = Number(scene.dataset.sceneRangeY || "18");
  let pointerX = 0.5;
  let pointerY = 0.5;
  let scrollShift = 0;
  let frameId = 0;

  const render = () => {
    const shiftX = (pointerX - 0.5) * rangeX;
    const shiftY = (pointerY - 0.5) * rangeY;
    scene.style.setProperty("--scene-shift-x", shiftX.toFixed(2));
    scene.style.setProperty("--scene-shift-y", shiftY.toFixed(2));
    scene.style.setProperty("--scene-scroll", scrollShift.toFixed(2));
    frameId = 0;
  };

  const requestRender = () => {
    if (!frameId) {
      frameId = window.requestAnimationFrame(render);
    }
  };

  const updateScroll = () => {
    const bounds = scene.getBoundingClientRect();
    const sceneCenter = bounds.top + bounds.height / 2;
    const viewportCenter = window.innerHeight / 2;
    scrollShift = ((sceneCenter - viewportCenter) / window.innerHeight) * -8;
    requestRender();
  };

  scene.addEventListener("pointermove", (event) => {
    const bounds = scene.getBoundingClientRect();
    pointerX = (event.clientX - bounds.left) / bounds.width;
    pointerY = (event.clientY - bounds.top) / bounds.height;
    requestRender();
  });

  scene.addEventListener("pointerleave", () => {
    pointerX = 0.5;
    pointerY = 0.5;
    requestRender();
  });

  window.addEventListener("scroll", updateScroll, { passive: true });
  window.addEventListener("resize", updateScroll);
  updateScroll();
  requestRender();
}

async function loadLayeredScene(scene) {
  const metadataPath = scene.dataset.metadata;
  const stack = scene.querySelector("[data-layer-stack]");
  const poster = scene.querySelector("[data-layer-poster]");

  if (!metadataPath || !stack) {
    scene.dataset.layerState = "fallback";
    return;
  }

  try {
    const response = await fetch(metadataPath, { cache: "no-store" });
    if (!response.ok) {
      throw new Error(`metadata request failed with ${response.status}`);
    }

    const metadata = await response.json();
    const layers = normalizeLayerEntries(metadata);
    if (!layers.length) {
      scene.dataset.layerState = "fallback";
      return;
    }

    const metadataUrl = new URL(metadataPath, window.location.href);
    const stackNodes = await Promise.all(
      layers.map(async (layer) => {
        const image = document.createElement("img");
        image.className = "layered-object__layer";
        image.alt = "";
        image.decoding = "async";
        image.loading = "lazy";
        image.style.setProperty("--depth", String(layer.depth));
        image.src = resolveLayerSource(layer.file, metadataUrl);
        await waitForImage(image);
        return image;
      })
    );

    stack.replaceChildren(...stackNodes);
    stack.hidden = false;
    scene.dataset.layerState = "ready";

    if (poster) {
      poster.setAttribute("aria-hidden", "true");
    }
  } catch (error) {
    scene.dataset.layerState = "fallback";
  }
}

function normalizeLayerEntries(metadata) {
  const rawLayers = metadata.layers || metadata.slices || metadata.images || [];
  if (!Array.isArray(rawLayers) || !rawLayers.length) {
    return [];
  }

  return rawLayers
    .map((entry, index) => {
      if (typeof entry === "string") {
        return {
          file: entry,
          depth: (index + 1) / rawLayers.length,
        };
      }

      const file =
        entry.file ||
        entry.filename ||
        entry.src ||
        entry.path ||
        entry.image;

      if (!file) {
        return null;
      }

      const depth = Number(
        entry.depth ??
          entry.z ??
          entry.offset ??
          entry.distance ??
          (index + 1) / rawLayers.length
      );

      return {
        file,
        depth: Number.isFinite(depth) ? depth : (index + 1) / rawLayers.length,
      };
    })
    .filter(Boolean);
}

function resolveLayerSource(file, metadataUrl) {
  const normalized = file.replace(/\\/g, "/");

  if (/^(?:https?:|data:|blob:|\/)/.test(normalized)) {
    return normalized;
  }

  if (normalized.includes("/")) {
    return new URL(normalized, metadataUrl).toString();
  }

  return new URL(`layers/${normalized}`, metadataUrl).toString();
}

function waitForImage(image) {
  return new Promise((resolve, reject) => {
    if (image.complete) {
      if (image.naturalWidth > 0) {
        resolve();
      } else {
        reject(new Error("layer image failed to load"));
      }
      return;
    }

    image.addEventListener("load", () => resolve(), { once: true });
    image.addEventListener("error", () => reject(new Error("layer image failed to load")), {
      once: true,
    });
  });
}

function setupModelLoaders() {
  const shells = document.querySelectorAll("[data-model-shell]");
  if (!shells.length) {
    return;
  }

  shells.forEach((shell) => {
    const button = shell.querySelector("[data-load-model]");
    const stage = shell.querySelector("[data-model-stage]");
    const status = shell.querySelector("[data-model-status]");
    const modelSrc = shell.dataset.model;
    const posterSrc = shell.dataset.poster || "";
    const altText = shell.dataset.alt || "Interactive 3D preview";

    if (!button || !stage || !status) {
      return;
    }

    if (!modelSrc) {
      button.disabled = true;
      status.textContent = "Add a .glb file to enable the interactive preview.";
      return;
    }

    button.addEventListener("click", async () => {
      button.disabled = true;
      button.textContent = "Loading 3D model...";
      status.textContent = "Fetching the viewer library.";

      try {
        await ensureModelViewer();

        const viewer = document.createElement("model-viewer");
        viewer.className = "model-viewer";
        viewer.setAttribute("src", modelSrc);
        viewer.setAttribute("alt", altText);
        viewer.setAttribute("camera-controls", "");
        viewer.setAttribute("touch-action", "pan-y");
        viewer.setAttribute("shadow-intensity", "1");
        viewer.setAttribute("exposure", "1");
        viewer.setAttribute("interaction-prompt", "none");
        viewer.setAttribute("loading", "eager");

        if (posterSrc) {
          viewer.setAttribute("poster", posterSrc);
        }

        viewer.addEventListener("load", () => {
          button.hidden = true;
          status.textContent = "Interactive preview loaded.";
        });

        viewer.addEventListener("error", () => {
          button.disabled = false;
          button.textContent = "Load interactive 3D model";
          status.textContent =
            "The 3D file could not be loaded. Replace the placeholder model and try again.";
        });

        stage.replaceChildren(viewer);
        status.textContent = "Loading the selected 3D model.";
      } catch (error) {
        button.disabled = false;
        button.textContent = "Load interactive 3D model";
        status.textContent =
          "The viewer library could not be loaded. Check the hosted script path or connection.";
      }
    });
  });
}

function ensureModelViewer() {
  if (window.customElements.get("model-viewer")) {
    return Promise.resolve();
  }

  if (modelViewerPromise) {
    return modelViewerPromise;
  }

  modelViewerPromise = new Promise((resolve, reject) => {
    const script = document.createElement("script");
    script.type = "module";
    script.src = "https://unpkg.com/@google/model-viewer/dist/model-viewer.min.js";
    script.onload = () => resolve();
    script.onerror = () => {
      modelViewerPromise = undefined;
      reject(new Error("model-viewer failed to load"));
    };
    document.head.append(script);
  });

  return modelViewerPromise;
}
