import { useState, useCallback, useRef } from "react";
import type { GameChoice } from "./useTeachableModel";

export type GameResult = "win" | "lose" | "draw" | null;
export type GamePhase = "waiting" | "countdown" | "capture" | "result";

const CHOICES: GameChoice[] = ["rock", "paper", "scisors"];

function getComputerChoice(): GameChoice {
  return CHOICES[Math.floor(Math.random() * CHOICES.length)];
}

function getResult(player: GameChoice, computer: GameChoice): GameResult {
  if (player === "idle") return "lose";
  if (player === computer) return "draw";
  if (
    (player === "rock" && computer === "scisors") ||
    (player === "paper" && computer === "rock") ||
    (player === "scisors" && computer === "paper")
  ) {
    return "win";
  }
  return "lose";
}

export function useGameLogic() {
  const [phase, setPhase] = useState<GamePhase>("waiting");
  const [countdown, setCountdown] = useState(3);
  const [playerChoice, setPlayerChoice] = useState<GameChoice>("idle");
  const [computerChoice, setComputerChoice] = useState<GameChoice>("idle");
  const [result, setResult] = useState<GameResult>(null);
  const [score, setScore] = useState({ player: 0, computer: 0 });
  const [roundNumber, setRoundNumber] = useState(0);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const startRound = useCallback(
    (onCapture: () => void) => {
      setPhase("countdown");
      setResult(null);
      setPlayerChoice("idle");
      setComputerChoice("idle");

      let count = 3;
      setCountdown(count);

      timerRef.current = setInterval(() => {
        count--;
        if (count > 0) {
          setCountdown(count);
        } else {
          if (timerRef.current) clearInterval(timerRef.current);
          setPhase("capture");
          onCapture();
        }
      }, 1000);
    },
    []
  );

  const resolveRound = useCallback(
    (playerPick: GameChoice) => {
      const compPick = getComputerChoice();
      const roundResult = getResult(playerPick, compPick);

      setPlayerChoice(playerPick);
      setComputerChoice(compPick);
      setResult(roundResult);
      setPhase("result");
      setRoundNumber((r) => r + 1);

      if (roundResult === "win") {
        setScore((s) => ({ ...s, player: s.player + 1 }));
      } else if (roundResult === "lose") {
        setScore((s) => ({ ...s, computer: s.computer + 1 }));
      }
    },
    []
  );

  const resetGame = useCallback(() => {
    setPhase("waiting");
    setCountdown(3);
    setPlayerChoice("idle");
    setComputerChoice("idle");
    setResult(null);
    setScore({ player: 0, computer: 0 });
    setRoundNumber(0);
  }, []);

  return {
    phase,
    countdown,
    playerChoice,
    computerChoice,
    result,
    score,
    roundNumber,
    startRound,
    resolveRound,
    resetGame,
  };
}

export const CHOICE_EMOJI: Record<GameChoice, string> = {
  idle: "😴",
  rock: "🪨",
  paper: "📄",
  scisors: "✂️",
};

export const CHOICE_LABEL: Record<GameChoice, string> = {
  idle: "Nada",
  rock: "Pedra",
  paper: "Papel",
  scisors: "Tesoura",
};
