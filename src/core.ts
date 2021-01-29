import Matter, {
  Bodies,
  Body,
  Common,
  Engine,
  Events,
  Mouse,
  MouseConstraint,
  Render,
  Runner,
  World,
} from "matter-js";
import { configs } from "./configs";
import { ballPics, topLinePic } from "./pics";
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

const { width, height } = configs.render;
const size = Math.sqrt(width * height);
const viewScale = size / configs.standardViewSize;
const topLineY = size / 5;
const ballDropFrom = size / 10;
const stopSpeed = 0;
const groundHeight = height / 10;

type Status = "idle" | "running" | "stopping" | "end";

export function createGame({
  onStatusUpdate,
}: {
  onStatusUpdate(status: Status): void;
}) {
  const engine = Engine.create({
    positionIterations: 8,
    velocityIterations: 6,
    enableSleeping: false,
  });
  const world = engine.world;

  const renderApp = Render.create({
    element: document.querySelector("#app") as HTMLElement,
    engine,
    options: configs.render,
  });

  const collisionCategories = {
    disabled: 0,
  };

  // top line
  const topLinePicSize = {
    width: 711,
    height: 8,
  };
  const topLine = Bodies.rectangle(
    width / 2,
    topLineY,
    width,
    (width / topLinePicSize.width) * topLinePicSize.height,
    {
      isStatic: true,
      isSensor: true,
      render: {
        sprite: {
          texture: topLinePic,
          xScale: width / topLinePicSize.width,
          yScale: width / topLinePicSize.width,
        },
      },
    }
  );
  World.add(world, topLine);

  const lightGroundHeight = groundHeight / 10;
  // container
  World.add(world, [
    // top
    Bodies.rectangle(width / 2, -height / 2, width, height, {
      isStatic: true,
      friction: 0,
      render: { visible: false },
    }),
    // left
    Bodies.rectangle(-width / 2, height / 2, width, height, {
      isStatic: true,
      friction: 0,
      render: { visible: false },
    }),
    // right
    Bodies.rectangle(width + width / 2, height / 2, width, height, {
      isStatic: true,
      friction: 0,
      render: { visible: false },
    }),
    // ground
    Bodies.rectangle(width / 2, height, width, groundHeight * 2, {
      isStatic: true,
      render: { fillStyle: configs.colors.groundColor },
    }),
    Bodies.rectangle(
      width / 2,
      height - groundHeight + lightGroundHeight / 2,
      width,
      lightGroundHeight,
      {
        isStatic: true,
        isSensor: true,
        render: { fillStyle: configs.colors.lightGroundColor },
      }
    ),
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
    texture: string;
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
      radius: size / 2,
      texture: ballPics[i],
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
            texture: prototype.texture,
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
    return {
      onMerge(prototype: BallPrototype) {
        value += ballPrototypes.indexOf(prototype) + 1;
        onUpdate(value);
      },
      onShrink(prototype: BallPrototype) {
        value += ballPrototypes.indexOf(prototype) + 1;
        onUpdate(value);
      },
      reset() {
        value = 0;
        onUpdate(value);
      },
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
    blockMerging.delete(ball);
  }

  const blockMerging = new Set<Body>();

  function createBall(
    x: number,
    y: number,
    prototype: BallPrototype,
    options?: Matter.IBodyDefinition,
    grow = true
  ) {
    const timer = createLinearTimer(
      configs.ballGrowDuration,
      () => engine.timing.timestamp
    );

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
            texture: prototype.texture,
            xScale: viewScale * configs.textureScale * absoluteScale,
            yScale: viewScale * configs.textureScale * absoluteScale,
          },
        },
        density:
          ballPrototypes.indexOf(prototype) / ballPrototypes.length / 2 +
          1 / 128,
        ...configs.ballOptions,
        ...options,
      }
    );

    addBall(ball, prototype);

    if (grow) {
      (async () => {
        if (configs.blockMergingWhenGrowing) blockMerging.add(ball);
        await animate(
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
              sprite.xScale = viewScale * configs.textureScale * absoluteScale;
              sprite.yScale = viewScale * configs.textureScale * absoluteScale;
            }
          },
          () => timer.hasStopped()
        );
        if (configs.blockMergingWhenGrowing) blockMerging.delete(ball);
      })();
    }

    return ball;
  }

  let status: Status = "idle";

  async function mergeBalls(ballA: Body, ballB: Body) {
    if (status !== "running") return;

    const ballPrototype = ballsInView.get(ballA);
    if (!ballPrototype) return;
    if (ballsInView.get(ballB) !== ballPrototype) return;

    const prototypeAfterMerge =
      ballPrototypes[ballPrototypes.indexOf(ballPrototype) + 1];
    if (!prototypeAfterMerge) return;

    for (const ball of [ballA, ballB]) if (justDropped.has(ball)) return;
    for (const ball of [ballA, ballB]) if (blockMerging.has(ball)) return;
    for (const ball of [ballA, ballB]) blockMerging.add(ball);

    await sleep(configs.pauseBeforeMerge);
    if (status !== "running") {
      for (const ball of [ballA, ballB]) removeBall(ball);
      return;
    }

    const [mergeTo, mergeFrom] =
      ballA.position.y > ballB.position.y ? [ballA, ballB] : [ballB, ballA];

    removeBall(mergeFrom);

    // create a ball at the position of mergeFrom and move it to mergeTo with no collision
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

    const timer = createLinearTimer(
      configs.mergeDuration,
      () => engine.timing.timestamp
    );
    await animate(
      engine,
      () => {
        {
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
      },
      () => timer.hasStopped() || !ballsInView.has(dummyBall)
    );
    removeBall(dummyBall);
    removeBall(mergeTo);

    if (status === "running") {
      scoreControl.onMerge(prototypeAfterMerge);
      createBall(mergeTo.position.x, mergeTo.position.y, prototypeAfterMerge);
    }
  }

  let nextBall: Body;
  function createNextBall(x: number) {
    const ballPrototype =
      ballPrototypes[
        Math.floor(
          Common.random(
            0,
            Math.min(Math.sqrt(ballsInView.size), ballPrototypes.length / 2)
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

    // replace nextBall with updated collision filter
    removeBall(nextBall);

    const ball = createBall(
      nextBall.position.x,
      nextBall.position.y,
      prototype,
      {},
      false
    );
    justDropped.add(ball);

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

  const detectCollisionWithLabel = false;
  const onCollision = (e: Matter.IEventCollision<Engine>): void => {
    for (const { bodyA, bodyB } of e.pairs) {
      if (
        detectCollisionWithLabel
          ? bodyA.label === "Circle Body" && bodyB.label === "Circle Body"
          : ballsInView.has(bodyA) &&
            !bodyA.isStatic &&
            ballsInView.has(bodyB) &&
            !bodyB.isStatic
      ) {
        justDropped.delete(bodyB);
        justDropped.delete(bodyA);
      }

      mergeBalls(bodyA, bodyB);
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
    const timer = createLinearTimer(
      configs.shrinkDuration,
      () => engine.timing.timestamp
    );
    return animate(
      engine,
      () => {
        const prototype = ballsInView.get(ball);
        if (!prototype) return;

        const currentRadius = ball.circleRadius;
        if (!currentRadius) return;

        const absoluteScale = linear(1, 1 / 32, timer.getProgress());
        const relativeScale =
          (absoluteScale * prototype.radius) / currentRadius;
        Body.scale(ball, relativeScale, relativeScale);

        const { sprite } = ball.render;
        if (sprite) {
          sprite.xScale = viewScale * configs.textureScale * absoluteScale;
          sprite.yScale = viewScale * configs.textureScale * absoluteScale;
        }
      },
      () => timer.hasStopped()
    );
  }

  const freezeOnClear = true;
  async function clearBalls() {
    if (freezeOnClear) {
      for (const ball of Array.from(ballsInView.keys())) {
        Body.setStatic(ball, true);
      }
    }
    for (const ball of Array.from(ballsInView.keys())) {
      const prototype = ballsInView.get(ball);
      if (prototype) {
        scoreControl.onShrink(prototype);
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
    onStatusUpdate(status);
    await clearBalls();
    await sleep(100);
    stop();
  }

  detectGameOver1();

  return {
    dropBall,
    start,
    stop,
    gameOver,
  };

  function detectGameOver1() {
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
          .filter((ball) => ball.speed === 0 && ball.angularSpeed === 0)
          .filter(
            (ball) => ball.position.y - (ball.circleRadius || 0) < topLineY
          );
        // .filter(
        //   (ball) =>
        //     Math.abs(ball.velocity.x) + Math.abs(ball.velocity.y) <= stopSpeed
        // );
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
  }
}
