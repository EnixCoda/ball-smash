import { createBackground } from "./background";
import { createGame } from "./core";

const button = document.querySelector("button");
const container: HTMLElement | null = document.querySelector(".container");

let interval: number;
let game: ReturnType<typeof createGame>;
let background: ReturnType<typeof createBackground>;

if (button) {
  button.addEventListener("click", () => {
    if (!game) {
      game = createGame({
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

              const autoPlay = process.env.NODE_ENV !== "production";
              if (autoPlay) {
                interval = setInterval(() => {
                  game.dropBall();
                }, 500);
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

      if (!background) {
        background = createBackground();
        background.start();
      }
    }

    game.start();
  });
}
