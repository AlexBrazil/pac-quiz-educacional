const fs = require("fs");
const path = require("path");
const vm = require("vm");

const baseDir = __dirname;

function createAudioElement() {
  const listeners = { canplaythrough: [], error: [], ended: [] };
  const element = {
    currentTime: 0,
    paused: true,
    play() {
      this.paused = false;
      listeners.ended.slice().forEach((fn) => fn());
    },
    pause() {
      this.paused = true;
    },
    addEventListener(event, handler) {
      if (listeners[event]) {
        listeners[event].push(handler);
      }
    },
    removeEventListener(event, handler) {
      if (listeners[event]) {
        const idx = listeners[event].indexOf(handler);
        if (idx >= 0) {
          listeners[event].splice(idx, 1);
        }
      }
    },
    setAttribute(name, value) {
      this[name] = value;
      if (name === "src") {
        setImmediate(() => {
          listeners.canplaythrough.slice().forEach((fn) =>
            fn({ loaded: 1, total: 1 })
          );
        });
      }
    }
  };
  return element;
}

function createCanvasElement() {
  const ctx = {
    fillStyle: "#000",
    strokeStyle: "#000",
    lineWidth: 1,
    lineCap: "round",
    font: "12px sans-serif",
    beginPath() {},
    moveTo() {},
    lineTo() {},
    quadraticCurveTo() {},
    stroke() {},
    closePath() {},
    fill() {},
    fillRect() {},
    arc() {},
    drawImage() {},
    fillText() {},
    measureText(text) {
      return { width: String(text).length * 8 };
    }
  };
  return {
    width: 0,
    height: 0,
    style: {},
    getContext() {
      return ctx;
    },
    setAttribute(name, value) {
      this[name] = value;
    }
  };
}

class FakeImage {
  constructor() {
    this._src = "";
    this.onload = null;
    this.onerror = null;
  }
  set src(value) {
    this._src = value;
    setImmediate(() => {
      if (this.onload) {
        this.onload();
      }
    });
  }
  get src() {
    return this._src;
  }
}

const elements = {};
const createHudElement = () => ({
  textContent: "",
  innerHTML: "",
  setAttribute() {},
  removeAttribute() {},
  appendChild() {},
  style: {}
});

const pacmanEl = {
  offsetWidth: 380,
  innerHTML: "",
  children: [],
  appendChild(child) {
    this.children.push(child);
  }
};

elements["pacman"] = pacmanEl;
elements["question-text"] = createHudElement();
elements["feedback-text"] = createHudElement();
elements["life-counter"] = createHudElement();
elements["score-counter"] = createHudElement();
elements["streak-counter"] = createHudElement();
elements["phase-counter"] = createHudElement();
elements["power-timer"] = createHudElement();

const domListeners = {};

const document = {
  addEventListener(event, handler) {
    domListeners[event] = handler;
  },
  removeEventListener() {},
  getElementById(id) {
    return elements[id] || null;
  },
  createElement(tag) {
    if (tag === "canvas") {
      return createCanvasElement();
    }
    if (tag === "audio") {
      return createAudioElement();
    }
    return createHudElement();
  }
};

const localStorage = {};

function fetchJSON(relativePath) {
  const fullPath = path.join(baseDir, relativePath);
  return new Promise((resolve) => {
    setImmediate(() => {
      try {
        const text = fs.readFileSync(fullPath, "utf8");
        resolve({
          ok: true,
          status: 200,
          json: () => Promise.resolve(JSON.parse(text))
        });
      } catch (err) {
        resolve({
          ok: false,
          status: 404,
          json: () => Promise.reject(err)
        });
      }
    });
  });
}

const context = {
  console,
  window: {},
  document,
  localStorage,
  Image: FakeImage,
  Modernizr: {
    canvas: true,
    localstorage: true,
    audio: { ogg: true, mp3: true }
  },
  Math,
  JSON,
  parseInt,
  isNaN,
  setTimeout(fn) {
    fn();
    return 0;
  },
  clearTimeout() {},
  setInterval(fn) {
    for (let i = 0; i < 5; i += 1) {
      fn();
    }
    return 0;
  },
  clearInterval() {},
  Promise,
  fetch: (resource) => fetchJSON(resource),
  URL
};

context.window = context;
context.window.setTimeout = context.setTimeout;
context.window.setInterval = context.setInterval;
context.window.clearTimeout = context.clearTimeout;
context.window.clearInterval = context.clearInterval;
context.window.localStorage = localStorage;
context.window.fetch = context.fetch;

const sandbox = vm.createContext(context);

const filesToLoad = [
  path.join(baseDir, "config/maze-layout.js"),
  path.join(baseDir, "config/maze-walls.js"),
  path.join(baseDir, "script.js")
];

filesToLoad.forEach((filePath) => {
  const code = fs.readFileSync(filePath, "utf8");
  vm.runInContext(code, sandbox, { filename: filePath });
});

if (domListeners.DOMContentLoaded) {
  domListeners.DOMContentLoaded();
}

setTimeout(() => {
  console.log("Question HUD:", elements["question-text"].textContent);
  console.log("Feedback HUD:", elements["feedback-text"].textContent);
  console.log("Smoke test completed.");
}, 0);

setTimeout(() => process.exit(0), 5);
