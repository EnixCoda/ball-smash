import Matter, {
  Bodies,
  Body,
  Common,
  Constraint,
  Engine,
  Events,
  Mouse,
  MouseConstraint,
  Render,
  Runner,
  World,
} from "matter-js";
import { configs } from "./configs";
import {
  animate,
  createLinearTimer,
  guardX,
  linear,
  multipleLines,
  setupGravity,
  sleep,
  watchGravity,
} from "./utils";

const { width, height } = configs;
const size = Math.sqrt(width * height);
const viewScale = size / configs.standardViewSize;
const topLineY = size / 5;
const ballDropFrom = size / 10;
const stopSpeed = 1;
const groundHeight = height / 10;

type Status = "idle" | "running" | "stopping" | "end";

export function createGame({
  onStatusUpdate,
}: {
  onStatusUpdate(status: Status): void;
}) {
  const engine = Engine.create({});
  const world = engine.world;

  const renderApp = Render.create({
    element: document.querySelector("#app") as HTMLElement,
    engine,
    options: {
      width,
      height,
      pixelRatio: devicePixelRatio,
      background: "transparent",
      wireframeBackground: "transparent",
      wireframes: configs.wireframes,
    } as any,
  });

  const collisionCategories = {
    disabled: 0,
  };

  // top line
  const topLine = Bodies.rectangle(
    width / 2,
    topLineY,
    width,
    (width / 711) * 8,
    {
      isStatic: true,
      isSensor: true,
      render: {
        sprite: {
          texture: "./pics/top-line.png",
          xScale: width / 711,
          yScale: width / 711,
        },
      },
    }
  );
  World.add(world, topLine);

  // container
  World.add(world, [
    // top
    Bodies.rectangle(width / 2, -height / 2, width, height, {
      isStatic: true,
      render: { visible: false },
    }),
    // left
    Bodies.rectangle(-width / 2, height / 2, width, height, {
      isStatic: true,
      render: { visible: false },
    }),
    // right
    Bodies.rectangle(width + width / 2, height / 2, width, height, {
      isStatic: true,
      render: { visible: false },
    }),
    // ground
    Bodies.rectangle(width / 2, height, width, groundHeight * 2, {
      isStatic: true,
      render: { fillStyle: configs.colors.groundColor },
    }),
  ]);

  const mouse = Mouse.create(renderApp.canvas);
  const mouseConstraint = MouseConstraint.create(engine, {
    mouse,
    // disable mouse interactions
    collisionFilter: {
      mask: collisionCategories.disabled,
    },
  });

  World.add(world, mouseConstraint);
  (renderApp as any).mouse = mouse;

  type BallPrototype = {
    type: number;
    radius: number;
  };

  const ballPrototypes: BallPrototype[] = [
    52,
    80,
    108,
    120,
    152,
    184,
    186,
    258,
    308,
    308,
    404,
  ]
    .map((size) => size * viewScale)
    .map((size, i) => ({
      type: i,
      radius: size / 2
    }));

  // prefetch texture
  ballPrototypes.forEach((prototype) => {
    World.add(
      world,
      Bodies.circle(0, 0, 1, {
        isStatic: true,
        collisionFilter: { mask: collisionCategories.disabled },
        render: {
          sprite: {
            texture: `./pics/${ballPrototypes.indexOf(prototype) + 1}.png`,
            xScale: 1,
            yScale: 1,
          },
          opacity: 0,
          },
      })
    );
  });

  const createScoreControl = (onUpdate: (score: number) => void) => {
    let value = 0;
    function onDrop(prototype: BallPrototype) {
      // value += ballPrototypes.indexOf(prototype) + 1;
      // onUpdate(value);
    }
    function onMerge(prototype: BallPrototype) {
      value += ballPrototypes.indexOf(prototype) + 1;
      onUpdate(value);
    }
    function onShrink(prototype: BallPrototype) {
      value += ballPrototypes.indexOf(prototype) + 1;
      onUpdate(value);
    }
    function reset() {
      value = 0;
      onUpdate(value);
    }

    return {
      onDrop,
      onMerge,
      onShrink,
      reset,
    };
  };
  const scoreElement = document.querySelector(".score");
  const scoreControl = createScoreControl((score) => {
    if (scoreElement) scoreElement.innerHTML = `${score}`;
  });

  const justDropped = new Set<Matter.Body>();
  const ballsInView = new Map<Body, BallPrototype>();
  function addBall(ball: Matter.Body, prototype: BallPrototype) {
    World.add(world, ball);
    ballsInView.set(ball, prototype);
  }
  function removeBall(ball: Matter.Body) {
    justDropped.delete(ball);
    World.remove(world, ball);
    ballsInView.delete(ball);
  }

  const blockMerging = new Set<Body>();

  function createBall(
    x: number,
    y: number,
    prototype: BallPrototype,
    options?: Matter.IBodyDefinition,
    grow = true
  ) {
    const timer = createLinearTimer(configs.ballGrowDuration);

    const onlyGrowVisually = true;
    const getAbsoluteScale = grow
      ? () =>
          multipleLines(
            [
              [0, 1 / 8],
              [3 / 4, 9 / 8],
              [1, 1],
            ],
            timer.getProgress()
          )
      : () => 1;
    const absoluteScale = getAbsoluteScale();

    const ball = Bodies.circle(
      x,
      y,
      prototype.radius * (onlyGrowVisually ? 1 : absoluteScale),
      {
        render: {
          sprite: {
            texture: `./pics/${ballPrototypes.indexOf(prototype) + 1}.png`,
            xScale: viewScale * absoluteScale,
            yScale: viewScale * absoluteScale,
          },
        },
        density: 1 / 512,
        ...configs.ballOptions,
        ...options,
      }
    );

    addBall(ball, prototype);

    if (grow) {
      if (configs.blockMergingWhenGrowing) blockMerging.add(ball);
      animate(
        engine,
        () => {
          if (!ballsInView.has(ball)) return;

          const currentRadius = ball.circleRadius;
          if (!currentRadius) return;

          const absoluteScale = getAbsoluteScale();
          if (!onlyGrowVisually) {
            const relativeScale =
              (Math.min(1, absoluteScale) * prototype.radius) / currentRadius;
            Body.scale(ball, relativeScale, relativeScale);
          }

          const { sprite } = ball.render;
          if (sprite) {
            sprite.xScale = viewScale * absoluteScale;
            sprite.yScale = viewScale * absoluteScale;
          }
        },
        () => timer.hasStopped()
      ).then(() => {
        if (configs.blockMergingWhenGrowing) blockMerging.delete(ball);
      });
    }

    return ball;
  }

  let status: Status = "idle";

  async function mergeBalls(ballA: Body, ballB: Body) {
    if (status !== "running") return;
    for (const ball of [ballA, ballB]) {
      if (blockMerging.has(ball)) return;
    }

    const ballPrototype = ballsInView.get(ballA);
    if (!ballPrototype) return;
    if (ballsInView.get(ballB) !== ballPrototype) return;

    const prototypeAfterMerge = ballPrototypes[ballPrototype.type + 1];
    if (!prototypeAfterMerge) return;

    for (const ball of [ballA, ballB]) {
      blockMerging.add(ball);
    }

    await sleep(configs.pauseBeforeMerge);

    const [mergeTo, mergeFrom] =
      ballA.position.y > ballB.position.y ? [ballA, ballB] : [ballB, ballA];

    // add constraint between balls, make it looks like one moves towards another
    const constraint = Constraint.create({
      bodyA: mergeFrom,
      bodyB: mergeTo,
      length: ballPrototype.radius * 2,
      render: {
        visible: configs.constraintVisible,
      },
      ...configs.constraintOptions,
    });
    World.add(world, constraint);
    mergeFrom.render.opacity = 0;

    const startPosition = mergeFrom.position;
    const dummyBall = createBall(
      startPosition.x,
      startPosition.y,
      ballPrototype,
      {
        isSensor: true,
        collisionFilter: {
          mask: collisionCategories.disabled,
        },
      },
      false
    );
    blockMerging.add(dummyBall);

    const timer = createLinearTimer(configs.mergeDuration);
    await animate(
      engine,
      () => {
        {
          const currentRadius = mergeFrom.circleRadius;
          if (currentRadius) {
            const x = linear(
              startPosition.x,
              mergeTo.position.x,
              timer.getProgress()
            );
            const y = linear(
              startPosition.y,
              mergeTo.position.y,
              timer.getProgress()
            );
            Body.setPosition(dummyBall, { x, y });
          }
        }

        {
          const currentRadius = mergeTo.circleRadius;
          if (currentRadius) {
            const absoluteScale = linear(1, 3 / 4, timer.getProgress());
            const relativeScale =
              (absoluteScale * ballPrototype.radius) / currentRadius;
            Body.scale(mergeTo, relativeScale, relativeScale);
          }
        }
      },
      () =>
        timer.hasStopped() ||
        !ballsInView.has(mergeFrom) ||
        !ballsInView.has(mergeTo)
    );

    scoreControl.onMerge(prototypeAfterMerge);

    blockMerging.add(dummyBall);
    removeBall(dummyBall);
    for (const ball of [ballA, ballB]) {
      blockMerging.delete(ball);
      removeBall(ball);
    }
    World.remove(world, constraint);

    createBall(mergeTo.position.x, mergeTo.position.y, prototypeAfterMerge);
  }

  let nextBall: Body;
  function createNextBall(x: number) {
    const ballPrototype =
      ballPrototypes[
        Math.floor(
          Common.random(
            0,
            Math.min(ballsInView.size, ballPrototypes.length / 2)
          )
        )
      ];

    const ballCircle = createBall(
      guardX(x, width, ballPrototype.radius),
      ballDropFrom,
      ballPrototype,
      {
        isStatic: true,
        collisionFilter: {
          mask: collisionCategories.disabled,
        },
      }
    );

    nextBall = ballCircle;
  }

  let lockDropping = false;

  let lastMouseX: number = width / 2;
  const moveNextBall = (): void => {
    const prototype = ballsInView.get(nextBall);
    if (!prototype) return;
    Body.setPosition(nextBall, {
      ...nextBall.position,
      x: guardX(lastMouseX, width, prototype.radius),
    });
  };
  Events.on(mouseConstraint, "mousemove", (e) => {
    lastMouseX = e.source.mouse.position.x;
    if (lockDropping) return;
    moveNextBall();
  });

  const dropBall = async () => {
    if (status !== "running") return;
    if (lockDropping) return;
    lockDropping = true;

    const prototype = ballsInView.get(nextBall);
    if (!prototype) return;
    scoreControl.onDrop(prototype);

    // replace nextBall with updated collision filter
    removeBall(nextBall);

    justDropped.add(
      createBall(nextBall.position.x, nextBall.position.y, prototype, {}, false)
    );

    await sleep(configs.dropBallFreezeTime);
    if (status !== "running") return;

    createNextBall(lastMouseX);

    lockDropping = false;
  };

  Events.on(mouseConstraint, "mouseup", (e) => {
    lastMouseX = e.source.mouse.position.x;
    moveNextBall();
    dropBall();
  });

  const onCollision = (e: Matter.IEventCollision<Engine>): void => {
    for (const p of e.pairs) {
      if (p.bodyA.label === "Circle Body" && p.bodyB.label === "Circle Body") {
        justDropped.delete(p.bodyA);
        justDropped.delete(p.bodyB);
      }
      mergeBalls(p.bodyA, p.bodyB);
    }
  };
  Events.on(engine, "collisionStart", onCollision);
  Events.on(engine, "collisionActive", onCollision);

  let gravityEnabled = false;
  const switchGravity = document.querySelector(".switch-gravity");
  if (switchGravity) {
    switchGravity.addEventListener("click", async () => {
      if (gravityEnabled) gravityEnabled = false;
      else gravityEnabled = await setupGravity();
      switchGravity.innerHTML = gravityEnabled ? "🍎" : "🍏";
    });
  }
  watchGravity((alpha, beta, gamma) => {
    if (gravityEnabled) {
      engine.world.gravity.y = beta;
      engine.world.gravity.x = gamma;
    }
  });

  function shrinkBall(ball: Matter.Body) {
    const timer = createLinearTimer(configs.shrinkDuration);
    return animate(
      engine,
      () => {
        const prototype = ballsInView.get(ball);
        if (!prototype) return;

        const currentRadius = ball.circleRadius;
        if (!currentRadius) return;

        const absoluteScale = linear(1, 0, timer.getProgress());
        const relativeScale =
          (Math.min(1, absoluteScale) * prototype.radius) / currentRadius;
        Body.scale(ball, relativeScale, relativeScale);

        const { sprite } = ball.render;
        if (sprite) {
          sprite.xScale = viewScale * absoluteScale;
          sprite.yScale = viewScale * absoluteScale;
        }
      },
      () => timer.hasStopped()
    );
  }

  const parallel = false;
  const freezeOnClear = true;
  async function clearBalls() {
    if (freezeOnClear) {
      for (const ball of Array.from(ballsInView.keys())) {
        Body.setStatic(ball, true);
      }
    }
    if (parallel) {
      return Promise.all(
        Array.from(ballsInView.keys()).map(async (ball) => {
          await shrinkBall(ball);
          const prototype = ballsInView.get(ball);
          if (prototype) scoreControl.onShrink(prototype);
          removeBall(ball);
        })
      );
    } else {
      for (const ball of Array.from(ballsInView.keys())) {
        await shrinkBall(ball);
        removeBall(ball);
      }
    }
  }

  const runner = Runner.create();

  function start() {
    scoreControl.reset();
    status = "running";
    lockDropping = false;
    createNextBall(lastMouseX);
    Render.run(renderApp);
    Runner.run(runner, engine);
    onStatusUpdate(status);
  }

  function stop() {
    status = "end";
    Render.stop(renderApp);
    Runner.stop(runner);
    onStatusUpdate(status);
  }

  async function gameOver() {
    status = "stopping";
    await clearBalls();
    await sleep(100);
    stop();
  }

  animate(
    engine,
    async () => {
      if (status !== "running") return;
      const balls = Array.from(ballsInView.keys()).filter(
        (ball) => ball !== nextBall
      );
      const stoppedHighBalls = balls
        .filter((ball) => !blockMerging.has(ball))
        .filter((ball) => !justDropped.has(ball))
        .filter(
          (ball) => ball.position.y - (ball.circleRadius || 0) < topLineY
        );
      // .filter(
      //   (ball) => Math.abs(ball.velocity.x * ball.velocity.y) < stopSpeed
      // )
      if (stoppedHighBalls.length > 0) {
        const freezeHighBalls = false;
        if (freezeHighBalls) {
          stoppedHighBalls.forEach((b) => {
            ballsInView.delete(b);
            Body.setStatic(b, true);
          });
        }
        await gameOver();
      }
    },
    () => false
  );

  return {
    dropBall,
    start,
    stop,
    gameOver,
  };
}
