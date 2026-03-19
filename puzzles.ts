export interface Puzzle {
  question: string;
  answer: string;
  reward: { score: number; potion?: boolean };
  penalty: { hp: number };
}

const ANSWERS: Record<string, string[]> = {
  "10": ["10", "ten"],
  "42": ["42", "forty-two"],
  "keyboard": ["keyboard", "piano"],
  "right": ["right", "r", "3"],
  "middle": ["middle", "m", "2"],
  "13": ["13", "thirteen"],
};

export const PUZZLES: Puzzle[] = [
  {
    question: "What comes next? 2, 4, 6, 8, ?",
    answer: "10",
    reward: { score: 10, potion: true },
    penalty: { hp: 2 },
  },
  {
    question: "What is 7 x 6?",
    answer: "42",
    reward: { score: 10 },
    penalty: { hp: 2 },
  },
  {
    question: "What has keys but no locks?",
    answer: "keyboard",
    reward: { score: 15, potion: true },
    penalty: { hp: 2 },
  },
  {
    question: "Three doors: Left says 'treasure', Middle says 'left lies', Right says 'middle lies'. Which leads to safety? (left/middle/right)",
    answer: "right",
    reward: { score: 15 },
    penalty: { hp: 3 },
  },
  {
    question: "What comes next? 1, 1, 2, 3, 5, 8, ?",
    answer: "13",
    reward: { score: 12 },
    penalty: { hp: 2 },
  },
];

function normalize(input: string): string {
  return input.trim().toLowerCase().replace(/[^a-z0-9]/g, "");
}

export function checkAnswer(puzzle: Puzzle, userInput: string): boolean {
  const normalized = normalize(userInput);
  const accepted = ANSWERS[puzzle.answer] ?? [puzzle.answer.toLowerCase()];
  return accepted.some((a) => normalize(a) === normalized);
}

export function getRandomPuzzle(): Puzzle {
  return PUZZLES[Math.floor(Math.random() * PUZZLES.length)];
}
