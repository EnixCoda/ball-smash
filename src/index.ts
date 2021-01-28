import { start as startBackground } from "./background";
import { createGame } from "./core";

const button = document.querySelector("button");
const container: HTMLElement | null = document.querySelector(".container");

let interval: number;
const game = createGame({
  onStatusUpdate(status) {
    switch (status) {
      case "stopping": {
        clearInterval(interval);
        break;
      }
      case "running": {
        if (container) {
          container.style.display = "none";
        }

        const autoPlay = false;
        if (autoPlay) {
          interval = setInterval(() => {
            game.dropBall();
          }, 1000);
        }

        break;
      }
      case "end": {
        if (container) {
          container.style.display = "";
        }
      }
    }
  },
});

if (button) {
  button.addEventListener("click", () => {
    startBackground();

    game.start();
  });
}
