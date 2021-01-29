import pic1 from "../pics/1.png";
import pic10 from "../pics/10.png";
import pic11 from "../pics/11.png";
import pic2 from "../pics/2.png";
import pic3 from "../pics/3.png";
import pic4 from "../pics/4.png";
import pic5 from "../pics/5.png";
import pic6 from "../pics/6.png";
import pic7 from "../pics/7.png";
import pic8 from "../pics/8.png";
import pic9 from "../pics/9.png";
import bubble1 from "../pics/bubble-1.png";
import bubble10 from "../pics/bubble-10.png";
import bubble2 from "../pics/bubble-2.png";
import bubble3 from "../pics/bubble-3.png";
import bubble4 from "../pics/bubble-4.png";
import bubble5 from "../pics/bubble-5.png";
import bubble6 from "../pics/bubble-6.png";
import bubble7 from "../pics/bubble-7.png";
import bubble8 from "../pics/bubble-8.png";
import bubble9 from "../pics/bubble-9.png";
import juice1 from "../pics/juice-1.png";
import juice10 from "../pics/juice-10.png";
import juice2 from "../pics/juice-2.png";
import juice3 from "../pics/juice-3.png";
import juice4 from "../pics/juice-4.png";
import juice5 from "../pics/juice-5.png";
import juice6 from "../pics/juice-6.png";
import juice7 from "../pics/juice-7.png";
import juice8 from "../pics/juice-8.png";
import juice9 from "../pics/juice-9.png";
import piece1 from "../pics/piece-1.png";
import piece10 from "../pics/piece-10.png";
import piece2 from "../pics/piece-2.png";
import piece3 from "../pics/piece-3.png";
import piece4 from "../pics/piece-4.png";
import piece5 from "../pics/piece-5.png";
import piece6 from "../pics/piece-6.png";
import piece7 from "../pics/piece-7.png";
import piece8 from "../pics/piece-8.png";
import piece9 from "../pics/piece-9.png";

export { default as ground } from "../pics/ground.png";
export { default as topLinePic } from "../pics/top-line.png";

export const ballPics = [
  [pic1, bubble1, juice1, piece1],
  [pic2, bubble2, juice2, piece2],
  [pic3, bubble3, juice3, piece3],
  [pic4, bubble4, juice4, piece4],
  [pic5, bubble5, juice5, piece5],
  [pic6, bubble6, juice6, piece6],
  [pic7, bubble7, juice7, piece7],
  [pic8, bubble8, juice8, piece8],
  [pic9, bubble9, juice9, piece9],
  [pic10, bubble10, juice10, piece10],
  [pic11, "", "", ""],
].map(([original, bubble, juice, piece]) => ({
  original,
  bubble,
  juice,
  piece,
}));
