export const configs = {
  standardViewSize: 960,
  width: window.innerWidth,
  height: window.innerHeight,
  wireframes: false,
  blockMergingWhenGrowing: false,
  textureScale: 1,
  shrinkDuration: 128,
  mergeDuration: 128,
  ballGrowDuration: 256,
  pauseBeforeMerge: 32,
  dropBallFreezeTime: 512,
  ballOptions: {
    friction: 8,
    frictionAir: 1 / 512,
    frictionStatic: 0,
    restitution: 1 / 8,
    slop: 0
  },
  constraintOptions: {
    // damping: 0.1,
    // stiffness: 0.2,
  },
  constraintVisible: false,
  colors: {
    backgroundColor: "#ffe89e",
    lightBackgroundColor: "#fff8ae",
    groundColor: "#7b5439"
  }
};
