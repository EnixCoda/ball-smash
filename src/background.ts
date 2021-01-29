import {
  Bodies,
  Composite,
  Composites,
  Engine,
  Render,
  Runner,
  World,
} from "matter-js";
import { getConfig } from "./configs";
import { animate, setupGravity, watchGravity } from "./utils";

const engine = Engine.create({});
const world = engine.world;

export function createBackground() {
  const configs = getConfig();
  const { width, height } = configs.render;

  const render = Render.create({
    element: document.querySelector("#gravity") as HTMLElement,
    engine,
    options: configs.render,
  });

  let even = 0;
  const stack = Composites.stack(
    -width / 2,
    -height / 2,
    16,
    1,
    0,
    0,
    (x: number, y: number) =>
      Bodies.rectangle(x, y, width / 8, height * 2, {
        isStatic: true,
        isSensor: true,
        render: {
          zIndex: -1,
          fillStyle:
            even++ & 1
              ? configs.colors.backgroundColor
              : configs.colors.lightBackgroundColor,
        } as any,
      })
  );
  World.add(world, stack);

  animate(
    engine,
    () => {
      const currentAngle = Math.atan(-world.gravity.x / world.gravity.y);
      const delta = currentAngle - stack.bodies[0].angle;

      if (delta !== 0)
        Composite.rotate(stack, delta, {
          x: width / 2,
          y: height / 2,
        });
    },
    () => false
  );

  let enabled = false;
  const switchGravity = document.querySelector(".switch-gravity");
  if (switchGravity) {
    switchGravity.addEventListener("click", async () => {
      if (enabled) enabled = false;
      else enabled = await setupGravity();
    });
  }
  watchGravity((alpha, beta, gamma) => {
    if (enabled) {
      engine.world.gravity.y = beta;
      engine.world.gravity.x = gamma;
    }
  });

  const runner = Runner.create();

  function start() {
    Render.run(render);
    Runner.run(runner, engine);
  }

  function stop() {
    Render.stop(render);
    Runner.stop(runner);
  }
  return { start, stop };
}
