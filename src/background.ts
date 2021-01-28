import Matter, {
  Runner,
  Engine,
  World,
  Render,
  Bodies,
  Composite,
  Composites
} from "matter-js";
import { animate, setupGravity, watchGravity } from "./utils";
import { configs } from "./configs";

const engine = Engine.create({});
const world = engine.world;

const render = Render.create({
  element: document.querySelector("#gravity") as HTMLElement,
  engine,
  options: {
    width: configs.width,
    height: configs.height,
    wireframes: configs.wireframes,
    pixelRatio: devicePixelRatio,
    background: "transparent",
    wireframeBackground: "transparent"
  } as any
});

let even = 0;
const stack = Composites.stack(
  -configs.width / 2,
  -configs.height / 2,
  16,
  1,
  0,
  0,
  (x: number, y: number) =>
    Bodies.rectangle(x, y, configs.width / 8, configs.height * 2, {
      isStatic: true,
      isSensor: true,
      render: {
        zIndex: -1,
        fillStyle:
          even++ & 1
            ? configs.colors.backgroundColor
            : configs.colors.lightBackgroundColor
      } as any
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
        x: configs.width / 2,
        y: configs.height / 2
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

export function start() {
  Render.run(render);
  Runner.run(runner, engine);
}

export function stop() {
  Render.stop(render);
  Runner.stop(runner);
}
