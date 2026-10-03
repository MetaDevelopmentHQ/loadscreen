/**
 * MetaDev Loadscreen · effects.js
 *
 * Lightweight particle effects for scheduled themes. Each particle is a single
 * DOM node animated purely with CSS keyframes (see `fx-*` in css/stage.css),
 * so the main thread does no work once the effect is mounted.
 *
 * Positions use the same seeded generator as the design files, which keeps the
 * look deterministic: the editor preview and the real screen match exactly.
 */

const HEART_PATH = 'M12 21l-1.5-1.4C5 14.7 2 12 2 8.5 2 5.4 4.4 3 7.5 3c1.7 0 3.4.8 4.5 2.1C13.1 3.8 14.8 3 16.5 3 19.6 3 22 5.4 22 8.5c0 3.5-3 6.2-8.5 11.1L12 21z';

/**
 * Particle recipes. `make(r, ctx)` receives three random numbers in [0,1)
 * and returns the node. Counts and timings come from the design files.
 */
const RECIPES = {
  confetti: {
    count: 80,
    seed: 23,
    colors: ['#F5B544', '#FFFFFF'],
    make([ra, rb, rc], { color, width }) {
      const duration = 8 + rc * 8;
      return particle('div', {
        top: '-20px',
        left: `${Math.round(ra * width)}px`,
        width: `${6 + Math.round(rc * 6)}px`,
        height: `${3 + Math.round(rb * 4)}px`,
        borderRadius: '1px',
        background: color,
        opacity: '0.85',
        animation: `fx-fall ${duration.toFixed(1)}s linear ${(-rb * duration).toFixed(1)}s infinite`,
      });
    },
  },

  hearts: {
    count: 40,
    seed: 31,
    colors: ['#FF6B9A', '#FF3B5C', '#FFC2D4'],
    make([ra, rb, rc], { color, width }) {
      const duration = 12 + rc * 10;
      const size = 12 + Math.round(rc * 16);
      const node = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
      node.setAttribute('viewBox', '0 0 24 24');
      node.setAttribute('width', size);
      node.setAttribute('height', size);
      node.setAttribute('aria-hidden', 'true');
      node.innerHTML = `<path fill="${color}" d="${HEART_PATH}"></path>`;
      Object.assign(node.style, {
        position: 'absolute',
        top: '-30px',
        left: `${Math.round(ra * (width - 20))}px`,
        opacity: (0.45 + rb * 0.4).toFixed(2),
        animation: `fx-sway-heart ${duration.toFixed(1)}s ease-in-out ${(-rb * duration).toFixed(1)}s infinite`,
      });
      return node;
    },
  },

  snow: {
    count: 90,
    seed: 11,
    colors: ['#FFFFFF'],
    make([ra, rb, rc], { color, width }) {
      const duration = 10 + rc * 10;
      const size = 2 + Math.round(rc * 4);
      return particle('div', {
        top: '-20px',
        left: `${Math.round(ra * width)}px`,
        width: `${size}px`,
        height: `${size}px`,
        borderRadius: '50%',
        background: color,
        opacity: (0.35 + rc * 0.5).toFixed(2),
        animation: `fx-snow ${duration.toFixed(1)}s linear ${(-rb * duration).toFixed(1)}s infinite`,
      });
    },
  },

  leaves: {
    count: 45,
    seed: 37,
    colors: ['#E8833A', '#C2501F', '#F2B544', '#8A4B1C'],
    make([ra, rb, rc], { color, width }) {
      const duration = 11 + rc * 9;
      const size = 6 + Math.round(rc * 8);
      return particle('div', {
        top: '-30px',
        left: `${Math.round(ra * (width - 20))}px`,
        width: `${size}px`,
        height: `${size}px`,
        borderRadius: '80% 0 80% 0',
        background: color,
        opacity: (0.45 + rc * 0.45).toFixed(2),
        animation: `fx-sway ${duration.toFixed(1)}s ease-in-out ${(-rb * duration).toFixed(1)}s infinite`,
      });
    },
  },

  embers: {
    count: 70,
    seed: 37,
    colors: ['#FF8A1F', '#B15CFF', '#FFB347'],
    make([ra, rb, rc], { color, width, height }) {
      const duration = 7 + rc * 7;
      const size = 3 + Math.round(rb * 6);
      return particle('div', {
        top: `${height + 10}px`,
        left: `${Math.round(ra * (width - 20))}px`,
        width: `${size}px`,
        height: `${size}px`,
        borderRadius: '50%',
        background: color,
        boxShadow: `0 0 8px ${color}`,
        animation: `fx-rise ${duration.toFixed(1)}s linear ${(-rb * duration).toFixed(1)}s infinite`,
      });
    },
  },
};

export const EFFECT_TYPES = ['none', ...Object.keys(RECIPES)];

function particle(tag, style) {
  const node = document.createElement(tag);
  node.style.position = 'absolute';
  Object.assign(node.style, style);
  return node;
}

/** Linear congruential generator used by the design files. */
function seededRandom(seed) {
  let state = seed;
  return () => {
    state = (state * 9301 + 49297) % 233280;
    return state / 233280;
  };
}

export function prefersReducedMotion() {
  try {
    return window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  } catch {
    return false;
  }
}

/**
 * Fills `container` with particles. Returns the number of particles created.
 *
 * @param {HTMLElement} container  Absolutely positioned layer covering the stage
 * @param {{type:string, colors?:string[], density?:number}} effect
 * @param {{width:number, height:number}} size  Stage size in design pixels
 */
export function mountEffect(container, effect, { width, height }) {
  container.replaceChildren();
  const recipe = RECIPES[effect?.type];
  if (!recipe || prefersReducedMotion()) return 0;

  const colors = effect.colors?.length ? effect.colors : recipe.colors;
  // Scale the count with the stage width so ultrawide screens are not sparse.
  const count = Math.round(recipe.count * (effect.density ?? 1) * Math.max(1, width / 1920));
  const random = seededRandom(recipe.seed);
  const fragment = document.createDocumentFragment();

  container.style.setProperty('--fx-travel', `${height + 40}px`);
  for (let i = 0; i < count; i += 1) {
    const r = [random(), random(), random()];
    fragment.appendChild(recipe.make(r, { color: colors[i % colors.length], width, height }));
  }
  container.appendChild(fragment);
  return count;
}
