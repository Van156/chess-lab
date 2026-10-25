import type { DrillKind } from "./questions";

export type GuideSection = {
  id: string;
  title: string;
  /** One sentence shown under the title. */
  summary: string;
  bullets: readonly string[];
};

export type PlanWeek = {
  week: number;
  focus: string;
  /** What to practise each day. */
  daily: string;
  /** Drills that train this week's focus; empty when the week is played away from the drills. */
  drills: readonly DrillKind[];
};

/** Static training guide: ideas to memorise and techniques to practise. */
export const GUIDE_SECTIONS: readonly GuideSection[] = [
  {
    id: "square-colours",
    title: "Square colours",
    summary: "Knowing the colour of any square instantly is the base of every other skill.",
    bullets: [
      "a1 is dark and h1 is light: the light square is on your right in the corner (light on the right).",
      "Parity rule: number the files a=1 to h=8 and add the rank number. An even sum is a dark square, an odd sum is a light one (a1: 1+1=2, dark; h1: 8+1=9, light).",
      "Each queen starts on a square of her own colour: the white queen on d1 (light), the black queen on d8 (dark).",
      "Squares on the d- and e-files alternate colour against their neighbours, so d1 and e1 have opposite colours, as do d8 and e8.",
      "Memorise the board by diagonals rather than square by square: every square on a diagonal shares its colour.",
    ],
  },
  {
    id: "diagonals",
    title: "Diagonals to memorise",
    summary: "Bishops, queens and many tactics live on a handful of lines.",
    bullets: [
      "Long diagonals: a1-h8 (dark squares) and h1-a8 (light squares).",
      "Bishop lines from the back rank: c1-h6 and f1-a6 for White, c8-h3 and f8-a3 for Black.",
      "a2-g8 points at f7, Black's weak point; the mirror line a7-g1 points at f2.",
      "h2-b8 starts at the castled king's pawn and runs through g3, f4 and e5.",
      "b1-h7 is the classic attacking line behind Bxh7+, with a bishop on d3 and a queen or knight in support.",
    ],
  },
  {
    id: "knight-geometry",
    title: "Knight geometry",
    summary: "A knight is easy to lose track of: learn its rhythm.",
    bullets: [
      "A knight changes square colour on every move, so it reaches a square of its own colour in an even number of moves and the other colour in an odd number.",
      "From a square, a neighbour next to it on a file or rank (b1 to b2) takes 3 moves; a diagonal neighbour (b1 to c2) takes 2.",
      "The exception is the corner: a1 to its diagonal neighbour b2 takes 4 moves, and the farthest trip on the board, a1 to h8, takes 6.",
      "A knight in the centre (d4, e4, d5, e5) controls 8 squares; on the rim it controls 4 or fewer, so keep it off the edge.",
      "An outpost is a square an enemy pawn can no longer attack, ideally one of your own pawns protects it: d5 and e5 for White, d4 and e4 for Black.",
    ],
  },
  {
    id: "landmarks",
    title: "Landmarks and anchors",
    summary: "Fixed reference squares give your mental board something to hang pieces on.",
    bullets: [
      "The centre squares d4, e4, d5 and e5 are the most contested; most openings fight for them.",
      "f2 and f7 are the weak points at the start of the game: only the king guards them.",
      "The castled king sits on g1 or g8 (short castling) or on c1 or c8 (long castling).",
      "Pushing a pawn to h3 or h6 makes luft: an escape square on h2 or h7 that avoids back-rank mates.",
      "Anchor your openings: play the same first moves into the same few squares so that their positions become familiar images.",
    ],
  },
  {
    id: "mating-patterns",
    title: "Mating patterns to visualise",
    summary: "Common mates make it easier to see where pieces must stand.",
    bullets: [
      "Back-rank mate: a rook or queen checks along the first or eighth rank while the king's own pawns block its escape.",
      "Greek gift: a bishop sacrifice on h7 (Bxh7+) followed by Ng5+ and Qh5 against a castled king.",
      "Smothered mate: a knight checks a king in the corner that is boxed in by its own pieces, often finishing with Nf7#.",
      "Anastasia's mate: a knight and a rook or queen trap a king on the edge, with the king's own pawn blocking one flight square.",
      "Arabian mate: a rook and a knight mate a king in the corner, the rook on the seventh rank and the knight two squares away.",
      "Boden's mate: two bishops on criss-crossing diagonals mate a king on c8 or c1, boxed in by its own pieces.",
      "Ladder mate: two rooks give check on alternate ranks and push the king to the edge.",
      "King and queen against king: restrict the king with the queen a knight's move away, then bring your king to help.",
    ],
  },
  {
    id: "techniques",
    title: "Techniques",
    summary: "Habits that keep the position in your head, move after move.",
    bullets: [
      "Say every move aloud with full coordinates, for example knight from g1 to f3, rather than the shorthand Nf3.",
      "Keep a running piece inventory and recite it every 5 moves: where each piece stands, for both sides.",
      "Visualise lines and relations (what attacks what, which files are open), not a photograph of the board.",
      "Replay short famous games from the notation alone, such as Morphy's Opera Game (Paris, 1858).",
      "Play your own repertoire lines blindfold before you play them over the board.",
      "Solve mate-in-1 and mate-in-2 problems from a piece list instead of a diagram.",
      "Play an engine or a friend blindfold with a peek budget, and let that budget shrink as you improve.",
      "Review every peek: each one marks something you lost track of, so train that area next.",
      "Short daily sessions beat long weekly ones.",
    ],
  },
];

/** A progressive four-week plan that links the guide to the drills. */
export const TRAINING_PLAN: readonly PlanWeek[] = [
  {
    week: 1,
    focus: "Square colours and coordinates",
    daily: "10 minutes a day",
    drills: ["square_colour", "coordinates"],
  },
  {
    week: 2,
    focus: "Diagonals and knight distance",
    daily: "10 to 15 minutes a day",
    drills: ["diagonals", "knight_distance"],
  },
  {
    week: 3,
    focus: "Replay famous games and your repertoire lines from notation",
    daily: "One short game or line a day",
    drills: [],
  },
  {
    week: 4,
    focus: "Play blindfold with a shrinking peek budget",
    daily: "One game a day, fewer peeks each time",
    drills: [],
  },
];
