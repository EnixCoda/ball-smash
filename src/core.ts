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
import { getConfig } from "./configs";
import { ballPics, topLinePic } from "./pics";
import {
  animate,
  createLinearTimer,
  guardX,
  linear,
  multipleLines,
  run,
  setupGravity,
  sleep,
  watchGravity,
} from "./utils";

type BallPrototype = {
  type: number;
  radius: number;
  texture: {
    original: string;
    bubble: string;
    juice: string;
    piece: string;
  };
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
].map((size, i) => ({
  type: i,
  radius: size / 2,
  texture: ballPics[i],
}));

type Step = "idle" | "running" | "stopping" | "end";

const collisionCategories = {
  disabled: 0,
};

export function createGame({
  onStatusUpdate: onStepUpdate,
}: {
  onStatusUpdate(step: Step): void;
}) {
  const state: {
    lockDropping: boolean;
    gravityEnabled: boolean;
    step: Step;
    justDropped: Set<Matter.Body>;
    ballsInView: Map<Body, BallPrototype>;
    blockMerging: Set<Body>;
  } = {
    lockDropping: false,
    step: "idle",
    justDropped: new Set<Matter.Body>(),
    ballsInView: new Map<Body, BallPrototype>(),
    blockMerging: new Set<Body>(),
    gravityEnabled: false,
  };

  function updateStep(step: Step) {
    state.step = step;
    onStepUpdate(step);
  }

  const configs = getConfig();
  const { width, height } = configs.render;
  const size = Math.sqrt(width * height);
  const viewScale = size / configs.standardViewSize;
  const topLineY = size / 5;
  const ballDropFrom = size / 10;
  const groundHeight = height / 10;

  const engine = Engine.create({
    positionIterations: 8,
    velocityIterations: 6,
    enableSleeping: false,
  });
  const { world } = engine;

  const renderApp = Render.create({
    element: document.querySelector("#app") as HTMLElement,
    engine,
    options: configs.render,
  });

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
  {
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
  }

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

  // prefetch texture
  {
    const createBallForTextureCache = (texture: string) => {
      return Bodies.circle(0, 0, 1, {
        isStatic: true,
        isSensor: true,
        render: {
          sprite: {
            texture: texture,
            xScale: 1,
            yScale: 1,
          },
          opacity: 0,
        },
      });
    };
    ballPrototypes.forEach((prototype) => {
      World.add(
        world,
        [
          prototype.texture.bubble,
          prototype.texture.juice,
          prototype.texture.original,
          prototype.texture.piece,
        ]
          .filter(Boolean)
          .map(createBallForTextureCache)
      );
    });
  }

  const scoreControl = run(() => {
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
    return createScoreControl((score) => {
      if (scoreElement) scoreElement.innerHTML = `${score}`;
    });
  });

  function addBall(ball: Matter.Body, prototype: BallPrototype) {
    World.add(world, ball);
    state.ballsInView.set(ball, prototype);
  }
  function removeBall(ball: Matter.Body) {
    state.justDropped.delete(ball);
    World.remove(world, ball);
    state.ballsInView.delete(ball);
    state.blockMerging.delete(ball);
  }

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

    const ball = Bodies.circle(x, y, prototype.radius * viewScale, {
      render: {
        sprite: {
          texture: prototype.texture.original,
          xScale: viewScale * configs.textureScale * absoluteScale,
          yScale: viewScale * configs.textureScale * absoluteScale,
        },
      },
      density:
        ballPrototypes.indexOf(prototype) / ballPrototypes.length / 2 + 1 / 128,
      ...configs.ballOptions,
      ...options,
    });

    addBall(ball, prototype);

    if (grow) {
      run(async () => {
        if (configs.blockMergingWhenGrowing) state.blockMerging.add(ball);
        await animate(
          engine,
          () => {
            if (!state.ballsInView.has(ball)) return;

            const currentRadius = ball.circleRadius;
            if (!currentRadius) return;

            const absoluteScale = getAbsoluteScale();

            const { sprite } = ball.render;
            if (sprite) {
              sprite.xScale = viewScale * configs.textureScale * absoluteScale;
              sprite.yScale = viewScale * configs.textureScale * absoluteScale;
            }
          },
          () => timer.hasStopped()
        );
        if (configs.blockMergingWhenGrowing) state.blockMerging.delete(ball);
      });
    }

    return ball;
  }

  async function mergeBalls(ballA: Body, ballB: Body) {
    if (state.step !== "running") return;

    const ballPrototype = state.ballsInView.get(ballA);
    if (!ballPrototype) return;
    if (state.ballsInView.get(ballB) !== ballPrototype) return;

    const prototypeAfterMerge =
      ballPrototypes[ballPrototypes.indexOf(ballPrototype) + 1];
    if (!prototypeAfterMerge) return;

    for (const ball of [ballA, ballB]) if (state.justDropped.has(ball)) return;
    for (const ball of [ballA, ballB]) if (state.blockMerging.has(ball)) return;
    for (const ball of [ballA, ballB]) state.blockMerging.add(ball);

    await sleep(configs.pauseBeforeMerge);
    if (state.step !== "running") {
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
      },
      false
    );
    state.blockMerging.add(dummyBall);

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
      () => timer.hasStopped() || !state.ballsInView.has(dummyBall)
    );
    removeBallAnimation(dummyBall.position, ballPrototype);
    removeBall(dummyBall);
    removeBall(mergeTo);

    if (state.step === "running") {
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
            Math.min(
              Math.sqrt(state.ballsInView.size),
              ballPrototypes.length / 2
            )
          )
        )
      ];

    const ballCircle = createBall(
      guardX(x, width, ballPrototype.radius * viewScale),
      ballDropFrom,
      ballPrototype,
      {
        isStatic: true,
        isSensor: true,
      }
    );

    nextBall = ballCircle;
  }

  let lastMouseX: number = width / 2;
  const moveNextBall = (): void => {
    const prototype = state.ballsInView.get(nextBall);
    if (!prototype) return;
    Body.setPosition(nextBall, {
      ...nextBall.position,
      x: guardX(lastMouseX, width, prototype.radius * viewScale),
    });
  };

  const dropBall = async () => {
    if (state.step !== "running") return;
    if (state.lockDropping) return;
    state.lockDropping = true;

    const prototype = state.ballsInView.get(nextBall);
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
    state.justDropped.add(ball);

    await sleep(configs.dropBallFreezeTime);
    if (state.step !== "running") return;

    createNextBall(lastMouseX);

    state.lockDropping = false;
  };

  const detectCollisionWithLabel = false;
  const onCollision = (e: Matter.IEventCollision<Engine>): void => {
    for (const { bodyA, bodyB } of e.pairs) {
      if (
        detectCollisionWithLabel
          ? bodyA.label === "Circle Body" && bodyB.label === "Circle Body"
          : state.ballsInView.has(bodyA) &&
            !bodyA.isStatic &&
            state.ballsInView.has(bodyB) &&
            !bodyB.isStatic
      ) {
        state.justDropped.delete(bodyB);
        state.justDropped.delete(bodyA);
      }

      mergeBalls(bodyA, bodyB);
    }
  };
  Events.on(engine, "collisionStart", onCollision);
  Events.on(engine, "collisionActive", onCollision);

  const switchGravity = document.querySelector(".switch-gravity");
  if (switchGravity) {
    switchGravity.addEventListener("click", async () => {
      if (state.gravityEnabled) state.gravityEnabled = false;
      else state.gravityEnabled = await setupGravity();
      switchGravity.innerHTML = state.gravityEnabled ? "🍎" : "🍏";
    });
  }
  watchGravity((alpha, beta, gamma) => {
    if (state.gravityEnabled) {
      engine.world.gravity.y = beta;
      engine.world.gravity.x = gamma;
    }
  });

  // show juice, pieces and bubbles around ball
  function removeBallAnimation(
    position: Matter.Vector,
    prototype: BallPrototype
  ) {
    const startPosition = { ...position };
    const timer = createLinearTimer(
      configs.shrinkAnimationDuration,
      () => engine.timing.timestamp
    );

    const getJuiceTextureScale = () =>
      (linear(1 / 4, 1, timer.getProgress()) * viewScale * prototype.radius) /
      32;

    const getJuiceOpacity = () =>
      multipleLines(
        [
          [0, 0],
          [1 / 4, 3 / 4],
          [1, 0],
        ],
        timer.getProgress()
      );

    const juice = Bodies.circle(startPosition.x, startPosition.y, 1, {
      isSensor: true,
      isStatic: true,
      render: {
        opacity: getJuiceOpacity(),
        sprite: {
          texture: prototype.texture.juice,
          xScale: getJuiceTextureScale(),
          yScale: getJuiceTextureScale(),
        },
      },
    });
    World.add(world, juice);

    const bubbles = Array(Math.floor(Math.random() * 4) + 4)
      .fill(null)
      .map(() => ({
        delay: 1 - Math.random() / 8,
        offset: {
          x: (Math.random() - 1 / 2) * 6 * prototype.radius * viewScale,
          y: (Math.random() - 1 / 2) * 6 * prototype.radius * viewScale,
        },
        bubble: Bodies.circle(
          startPosition.x,
          startPosition.y,
          prototype.radius * viewScale,
          {
            isSensor: true,
            isStatic: true,
            render: {
              sprite: {
                texture: prototype.texture.bubble,
                xScale: 1,
                yScale: 1,
              },
            },
          }
        ),
      }));
    bubbles.forEach(({ bubble }) => World.add(world, bubble));

    const getPieceOpacity = (delay: number) =>
      multipleLines(
        [
          [0, 0],
          [1 / 2, 3 / 4],
          [1, 0],
        ],
        timer.getProgress() * delay
      );

    const pieces = Array(Math.floor(Math.random() * 4) + 4)
      .fill(null)
      .map(() => {
        const scale = (Math.random() + 1 / 3) * viewScale;
        return {
          delay: 1 - Math.random() / 8,
          offset: {
            x: (Math.random() - 1 / 2) * 6 * prototype.radius * viewScale,
            y: (Math.random() - 1 / 2) * 6 * prototype.radius * viewScale,
          },
          piece: Bodies.circle(
            startPosition.x,
            startPosition.y,
            prototype.radius * viewScale,
            {
              isSensor: true,
              isStatic: true,
              angle: Math.random(),
              angularVelocity: Math.random() * 180,
              angularSpeed: Math.random(),
              torque: Math.random(),
              render: {
                opacity: (Math.random() + 1) / 3,
                sprite: {
                  texture: prototype.texture.piece,
                  xScale: scale,
                  yScale: scale,
                },
              },
            }
          ),
        };
      });
    pieces.forEach(({ piece }) => World.add(world, piece));

    return animate(
      engine,
      () => {
        {
          juice.render.opacity = getJuiceOpacity();
          const { sprite } = juice.render;
          if (sprite) {
            sprite.xScale = sprite.yScale = getJuiceTextureScale();
          }
        }

        {
          const progress = timer.getProgress();
          bubbles.forEach(({ bubble, offset, delay }) => {
            Body.setPosition(bubble, {
              x: startPosition.x + offset.x * progress * delay,
              y: startPosition.y + offset.y * progress * delay,
            });
            bubble.render.opacity = linear(1, 0, progress * delay);
          });
        }

        {
          const progress = timer.getProgress();
          pieces.forEach(({ piece, offset, delay }) => {
            Body.setPosition(piece, {
              x: startPosition.x + offset.x * progress * delay,
              y: startPosition.y + offset.y * progress * delay,
            });
            piece.render.opacity = getPieceOpacity(delay);
          });
        }
      },
      () => timer.hasStopped()
    ).then(() => {
      World.remove(world, juice);
      bubbles.forEach(({ bubble }) => World.remove(world, bubble));
      pieces.forEach(({ piece }) => World.remove(world, piece));
    });
  }

  function shrinkBall(ball: Matter.Body) {
    const timer = createLinearTimer(
      configs.shrinkDuration,
      () => engine.timing.timestamp
    );
    const prototype = state.ballsInView.get(ball);
    if (!prototype) return;

    removeBallAnimation(ball.position, prototype);

    return animate(
      engine,
      () => {
        const currentRadius = ball.circleRadius;
        if (!currentRadius) return;

        const absoluteScale = linear(1, 1 / 32, timer.getProgress());
        const relativeScale =
          (absoluteScale * prototype.radius * viewScale) / currentRadius;
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
      for (const ball of Array.from(state.ballsInView.keys())) {
        Body.setStatic(ball, true);
      }
    }
    for (const ball of Array.from(state.ballsInView.keys())) {
      const prototype = state.ballsInView.get(ball);
      if (prototype) {
        scoreControl.onShrink(prototype);
        await shrinkBall(ball);
        removeBall(ball);
      }
    }
  }

  Events.on(mouseConstraint, "mousemove", (e) => {
    lastMouseX = e.source.mouse.position.x;
    if (state.lockDropping) return;
    moveNextBall();
  });
  Events.on(mouseConstraint, "mouseup", (e) => {
    lastMouseX = e.source.mouse.position.x;
    moveNextBall();
    dropBall();
  });

  run(function detectGameOver() {
    animate(
      engine,
      async () => {
        if (state.step !== "running") return;
        const balls = Array.from(state.ballsInView.keys()).filter(
          (ball) => ball !== nextBall
        );
        const stoppedHighBalls = balls
          .filter((ball) => !state.blockMerging.has(ball))
          .filter((ball) => !state.justDropped.has(ball))
          .filter((ball) => ball.speed === 0 && ball.angularSpeed === 0)
          .filter(
            (ball) => ball.position.y - (ball.circleRadius || 0) < topLineY
          );
        if (stoppedHighBalls.length > 0) {
          const freezeHighBalls = false;
          if (freezeHighBalls) {
            stoppedHighBalls.forEach((b) => {
              state.ballsInView.delete(b);
              Body.setStatic(b, true);
            });
          }
          await gameOver();
        }
      },
      () => false
    );
  });

  const runner = Runner.create();

  function start() {
    scoreControl.reset();
    state.lockDropping = false;
    createNextBall(lastMouseX);
    Render.run(renderApp);
    Runner.run(runner, engine);
    updateStep("running");
  }

  function stop() {
    Render.stop(renderApp);
    Runner.stop(runner);
    updateStep("end");
  }

  async function gameOver() {
    updateStep("stopping");
    await clearBalls();
    await sleep(100);
    stop();
  }

  return {
    dropBall,
    start,
    stop,
    gameOver,
  };
}
