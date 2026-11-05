import type { DrillKind } from "./questions";

/** Icon keys the guide maps to lucide icons. */
export type GuideIcon =
  | "colours"
  | "diagonals"
  | "knight"
  | "anchor"
  | "piece-list"
  | "checks"
  | "moves"
  | "mate"
  | "techniques";

/** A piece on a guide diagram, as a FEN letter: upper case for White, lower case for Black. */
export type DiagramPiece = { square: string; piece: string };

/** `danger` draws the arrow in the destructive colour (a check); the default is the mint accent. */
export type DiagramArrow = { from: string; to: string; tone?: "accent" | "danger" };

/** A small board illustration. Squares are algebraic (`"e4"`); White is at the bottom. */
export type GuideDiagram = {
  highlights?: readonly string[];
  /** Squares marked in the destructive colour, e.g. a king in check. */
  dangerHighlights?: readonly string[];
  arrows?: readonly DiagramArrow[];
  pieces?: readonly DiagramPiece[];
  /** Shown under the board and used as its accessible name. */
  caption: string;
};

export type GuideSection = {
  id: string;
  title: string;
  icon: GuideIcon;
  /** One sentence shown under the title. */
  summary: string;
  /** One memorable line to memorise, shown as a highlighted callout. */
  takeaway: string;
  bullets: readonly string[];
  diagram?: GuideDiagram;
  /** Drills that train this section; empty when no drill covers it. */
  drills: readonly DrillKind[];
};

export type PlanWeek = {
  week: number;
  focus: string;
  /** What to practise each day. */
  daily: string;
  /** Minutes of practice a day. */
  minutes: number;
  /** One measurable target for the end of the week. */
  goal: string;
  /** Drills that train this week's focus; empty when the week is played away from the drills. */
  drills: readonly DrillKind[];
};

/** Static training guide: ideas to memorise and techniques to practise. */
export const GUIDE_SECTIONS: readonly GuideSection[] = [
  {
    id: "square-colours",
    title: "Square colours",
    icon: "colours",
    summary: "Knowing the colour of any square instantly is the base of every other skill.",
    takeaway: "Light on the right. Even sum is dark, odd sum is light.",
    bullets: [
      "a1 is dark and h1 is light: the light square is on your right in the corner (light on the right).",
      "Parity rule: number the files a=1 to h=8 and add the rank number. An even sum is a dark square, an odd sum is a light one (a1: 1+1=2, dark; h1: 8+1=9, light).",
      "Each queen starts on a square of her own colour: the white queen on d1 (light), the black queen on d8 (dark).",
      "Squares on the d- and e-files alternate colour against their neighbours, so d1 and e1 have opposite colours, as do d8 and e8.",
      "Memorise the board by diagonals rather than square by square: every square on a diagonal shares its colour.",
    ],
    diagram: {
      highlights: ["a1", "h1", "d1", "d8"],
      caption:
        "a1 is dark and h1 is light. Each queen starts on her own colour: d1 light, d8 dark.",
    },
    drills: ["square_colour", "coordinates"],
  },
  {
    id: "diagonals",
    title: "Diagonals to memorise",
    icon: "diagonals",
    summary: "Bishops, queens and many tactics live on a handful of lines.",
    takeaway: "Learn the board as lines, not squares.",
    bullets: [
      "Long diagonals: a1-h8 (dark squares) and h1-a8 (light squares).",
      "Bishop lines from the back rank: c1-h6 and f1-a6 for White, c8-h3 and f8-a3 for Black.",
      "a2-g8 points at f7, Black's weak point; the mirror line a7-g1 points at f2.",
      "h2-b8 starts at the castled king's pawn and runs through g3, f4 and e5.",
      "b1-h7 is the classic attacking line behind Bxh7+, with a bishop on d3 and a queen or knight in support.",
    ],
    diagram: {
      arrows: [
        { from: "a1", to: "h8" },
        { from: "h1", to: "a8" },
      ],
      caption: "The long diagonals: a1-h8 runs on dark squares, h1-a8 on light squares.",
    },
    drills: ["diagonals", "same_diagonal"],
  },
  {
    id: "knight-geometry",
    title: "Knight geometry",
    icon: "knight",
    summary: "A knight is easy to lose track of: learn its rhythm.",
    takeaway: "Every knight move changes colour.",
    bullets: [
      "A knight changes square colour on every move, so it reaches a square of its own colour in an even number of moves and the other colour in an odd number.",
      "From a square, a neighbour next to it on a file or rank (b1 to b2) takes 3 moves; a diagonal neighbour (b1 to c2) takes 2.",
      "The exception is the corner: a1 to its diagonal neighbour b2 takes 4 moves, and the farthest trip on the board, a1 to h8, takes 6.",
      "A knight in the centre (d4, e4, d5, e5) controls 8 squares; on the rim it controls 4 or fewer, so keep it off the edge.",
      "An outpost is a square an enemy pawn can no longer attack, ideally one of your own pawns protects it: d5 and e5 for White, d4 and e4 for Black.",
    ],
    diagram: {
      pieces: [{ square: "d4", piece: "N" }],
      highlights: ["b3", "b5", "c2", "c6", "e2", "e6", "f3", "f5"],
      caption:
        "A knight on d4, a dark square, reaches eight squares, and every one of them is light.",
    },
    drills: ["knight_distance"],
  },
  {
    id: "landmarks",
    title: "Landmarks and anchors",
    icon: "anchor",
    summary: "Fixed reference squares give your mental board something to hang pieces on.",
    takeaway: "Hang every piece on a square you already know.",
    bullets: [
      "The centre squares d4, e4, d5 and e5 are the most contested; most openings fight for them.",
      "f2 and f7 are the weak points at the start of the game: only the king guards them.",
      "The castled king sits on g1 or g8 (short castling) or on c1 or c8 (long castling).",
      "Pushing a pawn to h3 or h6 makes luft: an escape square on h2 or h7 that avoids back-rank mates.",
      "Anchor your openings: play the same first moves into the same few squares so that their positions become familiar images.",
    ],
    diagram: {
      highlights: ["d4", "e4", "d5", "e5", "f2", "f7", "g1", "g8"],
      caption:
        "The four centre squares, the weak points f2 and f7, and the castled kings on g1 and g8.",
    },
    drills: ["coordinates"],
  },
  {
    id: "piece-lists",
    title: "Reading piece lists",
    icon: "piece-list",
    summary: "A position given as a list becomes a picture when you build it in a fixed order.",
    takeaway: "Kings first, then pawns, then pieces.",
    bullets: [
      "Place both kings first: they anchor the picture and tell you at once which side has castled.",
      "Then build the pawn structure for both sides, file by file from a to h. Pawns change slowly, so they are the frame everything else hangs on.",
      "Add the pieces last, heaviest first: queens, rooks, bishops, then knights.",
      "Group what you read by area rather than by piece, for example the white kingside: Kg1, Rf1, pawns on f2, g2 and h2.",
      "Say the list aloud once while you read it, then again without looking. If a square will not come back, rebuild from the king outwards.",
      "Name the colour of each bishop's square: a bishop on a light square can never reach a dark one.",
    ],
    diagram: {
      pieces: [
        { square: "g1", piece: "K" },
        { square: "f1", piece: "R" },
        { square: "c4", piece: "B" },
        { square: "f2", piece: "P" },
        { square: "g2", piece: "P" },
        { square: "h2", piece: "P" },
        { square: "g8", piece: "k" },
        { square: "d8", piece: "q" },
        { square: "f7", piece: "p" },
        { square: "g7", piece: "p" },
        { square: "h7", piece: "p" },
      ],
      caption:
        "White: Kg1, Rf1, Bc4, pawns f2, g2, h2. Black: Kg8, Qd8, pawns f7, g7, h7. Kings first, then pawns, then pieces.",
    },
    drills: ["check_detection", "mate_in_one"],
  },
  {
    id: "checks-and-lines",
    title: "Checks and lines",
    icon: "checks",
    summary: "To find a check, look out from the king instead of searching every attacker.",
    takeaway: "Scan the king's eight lines, then its knight squares.",
    bullets: [
      "Start from the king: scan its eight lines, up and down the file, along the rank both ways and out along both diagonals.",
      "On each line, stop at the first piece you meet. An enemy rook or queen on a file or rank gives check, as does an enemy bishop or queen on a diagonal.",
      "Any piece in between blocks the line, whatever its colour.",
      "Then look at the knight squares, up to eight squares a knight's move away. Knights jump, so nothing blocks them.",
      "Pawns check from one square diagonally in front of the king: a white king on e4 is checked by a black pawn on d5 or f5.",
      "Discovered check: a piece steps off a line and uncovers a rook, bishop or queen behind it. If the piece that moves also gives check, it is double check and only a king move escapes.",
    ],
    diagram: {
      pieces: [
        { square: "e8", piece: "k" },
        { square: "b5", piece: "B" },
        { square: "e1", piece: "K" },
      ],
      arrows: [{ from: "b5", to: "e8" }],
      highlights: ["c7", "d6", "f6", "g7"],
      caption:
        "Bb5 checks the king on e8 along the diagonal. A knight would check from c7, d6, f6 or g7.",
    },
    drills: ["check_detection"],
  },
  {
    id: "following-moves",
    title: "Following moves",
    icon: "moves",
    summary: "Each move changes only a few squares; update those and the rest stays put.",
    takeaway: "Every move empties one square and fills another.",
    bullets: [
      "Picture both squares of every move: the one the piece leaves and the one it lands on.",
      "Track the piece that moved, then ask what it now attacks and which line its old square has opened.",
      "A capture changes two things at once: the capturing piece leaves its square empty and the captured piece leaves the board. Take it out of your inventory straight away.",
      "En passant is the one capture that lands on an empty square: after exd6 e.p. the black pawn disappears from d5.",
      "Castling moves two pieces. O-O puts the king on g1 and the rook on f1 (g8 and f8 for Black); O-O-O puts the king on c1 and the rook on d1 (c8 and d8).",
      "Promotion swaps one piece for another: the pawn leaves the board and a new piece, usually a queen, stands on the last rank.",
    ],
    diagram: {
      pieces: [
        { square: "f7", piece: "B" },
        { square: "e8", piece: "k" },
      ],
      arrows: [{ from: "c4", to: "f7" }],
      highlights: ["c4"],
      caption:
        "Bxf7+: the bishop leaves c4 empty, the black pawn on f7 leaves the board, and the king on e8 is in check.",
    },
    drills: ["position_recall"],
  },
  {
    id: "mating-patterns",
    title: "Mating patterns to visualise",
    icon: "mate",
    summary: "Common mates make it easier to see where pieces must stand.",
    takeaway: "Learn the picture once, then find it from the list.",
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
    diagram: {
      pieces: [
        { square: "g8", piece: "k" },
        { square: "f7", piece: "p" },
        { square: "g7", piece: "p" },
        { square: "h7", piece: "p" },
        { square: "e8", piece: "R" },
        { square: "g1", piece: "K" },
      ],
      arrows: [{ from: "e1", to: "e8" }],
      caption:
        "Back-rank mate: Re8#. The king's own pawns on f7, g7 and h7 take away every escape.",
    },
    drills: ["mate_in_one"],
  },
  {
    id: "techniques",
    title: "Techniques",
    icon: "techniques",
    summary: "Habits that keep the position in your head, move after move.",
    takeaway: "Say it aloud, recite the inventory, review every peek.",
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
    drills: [],
  },
];

/** A progressive six-week plan that introduces every drill, then moves to full blindfold games. */
export const TRAINING_PLAN: readonly PlanWeek[] = [
  {
    week: 1,
    focus: "Square colours and coordinates",
    daily: "Two rounds of each drill. Say every answer aloud before you type it.",
    minutes: 10,
    goal: "90% on Square colour at Level 2",
    drills: ["square_colour", "coordinates"],
  },
  {
    week: 2,
    focus: "Diagonals and shared diagonals",
    daily: "Trace the long diagonals from memory, then drill.",
    minutes: 15,
    goal: "90% on Shared diagonal at Level 2",
    drills: ["diagonals", "same_diagonal"],
  },
  {
    week: 3,
    focus: "Knight distance and checks",
    daily: "One round of each drill. Build every piece list kings first.",
    minutes: 15,
    goal: "90% on Check spotter at Level 2",
    drills: ["knight_distance", "check_detection"],
  },
  {
    week: 4,
    focus: "Following moves",
    daily: "Follow openings from their moves alone, square by square.",
    minutes: 15,
    goal: "80% on Move memory at Level 2",
    drills: ["position_recall"],
  },
  {
    week: 5,
    focus: "Mate in one and famous games from notation",
    daily: "A round of mates, then replay one short famous game without a board.",
    minutes: 20,
    goal: "Replay the Opera Game from notation without a peek",
    drills: ["mate_in_one"],
  },
  {
    week: 6,
    focus: "Full blindfold games with a peek budget",
    daily: "One game against an engine or a friend, with fewer peeks each time.",
    minutes: 30,
    goal: "Finish a game with three peeks or fewer",
    drills: [],
  },
];
