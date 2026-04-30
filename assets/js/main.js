const prefersReducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
let modelViewerPromise;

document.documentElement.classList.add("reveal-ready");

document.addEventListener("DOMContentLoaded", () => {
  setCurrentYear();
  setActiveNav();
  setupRevealAnimations();
  setupIntroMotion();
  setupModelLoaders();
});

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
