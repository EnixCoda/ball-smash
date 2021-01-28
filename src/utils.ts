import Matter, { Engine, Events } from "matter-js";

export function sleep(duration: number) {
  return new Promise((resolve) => setTimeout(resolve, duration));
}

// not working properly in codesandbox
// export function assert<T>(subject: T | null | undefined): asserts subject is T {
//   if (subject === null || subject === undefined) throw new Error();
// }

export function withLock() {}

export function createLinearTimer(
  duration: number,
  getTime = () => Date.now()
) {
  const start = getTime();
  let stopped = false;
  function checkTime() {
    const timePast = getTime() - start;
    if (timePast > duration) stopped = true;
    return timePast;
  }
  return {
    getProgress: () => {
      if (stopped) return 1;
      return checkTime() / duration;
    },
    hasStopped: () => {
      if (stopped) return true;
      checkTime();
      return stopped;
    },
  };
}

export const linear = (start: number, end: number, progress: number) =>
  start + (end - start) * progress;

export const multipleLines = (steps: [number, number][], progress: number) => {
  let i;
  for (i = 1; i < steps.length - 1; i++) {
    if (progress < steps[i][0]) break;
  }
  return linear(
    steps[i - 1][1],
    steps[i][1],
    (progress - steps[i - 1][0]) / (steps[i][0] - steps[i - 1][0])
  );
};

export function animate(
  engine: Matter.Engine,
  callback: (e: Matter.IEventTimestamped<Engine>) => void,
  shouldStop: () => boolean
) {
  return new Promise((resolve) => {
    const update = (e: Matter.IEventTimestamped<Engine>): void => {
      callback(e);
      if (shouldStop()) {
        resolve(void 0);
        Events.off(engine, "beforeUpdate", update);
      }
    };
    Events.on(engine, "beforeUpdate", update);
  });
}

export function watchGravity(
  callback: (alpha: number, beta: number, gamma: number) => void
) {
  window.addEventListener("deviceorientation", (e) => {
    let alpha = e.alpha || 0;
    let beta = (e.beta || 0) % 180;
    beta = 1 - Math.abs(90 - Math.abs(beta)) / 90;
    beta = Math.max(beta, 0.5);

    let gamma = (e.gamma || 0) / 90;

    callback(alpha, beta, gamma);
  });
}

export async function setupGravity() {
  try {
    const response = await window.DeviceMotionEvent.requestPermission();
    return response === "granted";
  } catch (err) {
    return true;
  }
}

export function guardX(x: number, width: number, radius: number) {
  if (x < radius) return radius;
  else if (x > width - radius) return width - radius;
  return x;
}
