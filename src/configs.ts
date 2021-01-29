const debugViz = false;

export const getConfig = () => ({
  standardViewSize: 960,
  render: {
    width: innerWidth,
    height: innerHeight,
    pixelRatio: devicePixelRatio,
    background: "transparent",
    wireframeBackground: "transparent",
    wireframes: debugViz,
    showSleeping: false,
    showVelocity: debugViz,
  },
  blockMergingWhenGrowing: false,
  shrinkDuration: 128,
  mergeDuration: 128,
  ballGrowDuration: 256,
  pauseBeforeMerge: 64,
  dropBallFreezeTime: 256,
  ballOptions: {
    friction: 8,
    frictionAir: 1 / 64,
    frictionStatic: 1,
    restitution: 1 / 16,
  },
  constraintOptions: {},
  constraintVisible: false,
  textureScale: 1.01,
  colors: {
    backgroundColor: "#ffe89e",
    lightBackgroundColor: "#fff8ae",
    groundColor: "#7b5439",
    lightGroundColor: "#b68a52",
  },
});
