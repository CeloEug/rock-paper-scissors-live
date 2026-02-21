import { useRef, useCallback, useEffect, useState } from "react";
import WebcamView, { type WebcamHandle } from "./WebcamView";
import { useTeachableModel } from "@/hooks/useTeachableModel";
import {
  useGameLogic,
  CHOICE_EMOJI,
  CHOICE_LABEL,
  type GamePhase,
} from "@/hooks/useGameLogic";
import type { GameChoice } from "@/hooks/useTeachableModel";

const RESULT_TEXT: Record<string, { text: string; color: string }> = {
  win: { text: "VOCÊ GANHOU! 🎉", color: "text-primary" },
  lose: { text: "VOCÊ PERDEU! 😵", color: "text-destructive" },
  draw: { text: "EMPATE! 🤝", color: "text-accent" },
};

export default function GameArena() {
  const webcamRef = useRef<WebcamHandle>(null);
  const { loadModel, isLoading, isReady, error, getTopPrediction } =
    useTeachableModel();
  const {
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
  } = useGameLogic();

  const [liveChoice, setLiveChoice] = useState<GameChoice>("idle");
  const predictionLoopRef = useRef<number | null>(null);

  // Load model on mount
  useEffect(() => {
    loadModel();
  }, [loadModel]);

  // Continuous prediction loop for live feedback
  useEffect(() => {
    if (!isReady) return;

    let running = true;
    const loop = async () => {
      if (!running) return;
      const video = webcamRef.current?.getVideo();
      if (video && video.readyState >= 2) {
        const choice = await getTopPrediction(video);
        setLiveChoice(choice);
      }
      predictionLoopRef.current = requestAnimationFrame(loop);
    };

    predictionLoopRef.current = requestAnimationFrame(loop);

    return () => {
      running = false;
      if (predictionLoopRef.current) {
        cancelAnimationFrame(predictionLoopRef.current);
      }
    };
  }, [isReady, getTopPrediction]);

  const handleCapture = useCallback(async () => {
    const video = webcamRef.current?.getVideo();
    if (!video) {
      resolveRound("idle");
      return;
    }

    // Take a few readings and pick the most common
    const readings: GameChoice[] = [];
    for (let i = 0; i < 5; i++) {
      const choice = await getTopPrediction(video);
      readings.push(choice);
      await new Promise((r) => setTimeout(r, 100));
    }

    // Most common non-idle choice, or idle
    const counts: Record<string, number> = {};
    for (const r of readings) {
      counts[r] = (counts[r] || 0) + 1;
    }
    
    let best: GameChoice = "idle";
    let bestCount = 0;
    for (const [choice, count] of Object.entries(counts)) {
      if (choice !== "idle" && count > bestCount) {
        best = choice as GameChoice;
        bestCount = count;
      }
    }
    
    // If no non-idle choice got at least 2 votes, use idle
    if (bestCount < 2) best = "idle";

    resolveRound(best);
  }, [getTopPrediction, resolveRound]);

  const handlePlay = useCallback(() => {
    startRound(handleCapture);
  }, [startRound, handleCapture]);

  // Don't block on error - show UI with retry option

  return (
    <div className="min-h-screen game-gradient flex flex-col items-center px-4 py-6 gap-6">
      {/* Header */}
      <header className="text-center">
        <h1 className="text-4xl md:text-5xl font-display text-primary text-glow tracking-wide">
          PEDRA PAPEL TESOURA
        </h1>
        <p className="text-muted-foreground mt-1 text-sm font-body">
          Mostre seu gesto na webcam e desafie o computador!
        </p>
      </header>

      {/* Scoreboard */}
      <div className="flex items-center gap-8">
        <ScoreCard label="VOCÊ" value={score.player} variant="player" />
        <div className="text-muted-foreground font-display text-xl">VS</div>
        <ScoreCard label="CPU" value={score.computer} variant="cpu" />
      </div>

      {/* Main game area */}
      <div className="flex flex-col md:flex-row items-center gap-8">
        {/* Player side */}
        <div className="flex flex-col items-center gap-3">
          <span className="text-sm font-bold text-muted-foreground uppercase tracking-widest">
            Você
          </span>
          <WebcamView ref={webcamRef} />
          {/* Live detection badge */}
          {isReady && phase !== "result" && (
            <LiveBadge choice={liveChoice} />
          )}
          {phase === "result" && (
            <ChoiceBadge choice={playerChoice} />
          )}
        </div>

        {/* Center: countdown / VS / result */}
        <div className="flex flex-col items-center justify-center min-w-[120px] min-h-[120px]">
          {phase === "countdown" && <CountdownDisplay count={countdown} />}
          {phase === "capture" && (
            <div className="animate-pulse text-primary font-display text-xl">
              ANALISANDO...
            </div>
          )}
          {phase === "result" && result && (
            <div
              className={`font-display text-2xl text-center animate-bounce-in ${RESULT_TEXT[result].color}`}
            >
              {RESULT_TEXT[result].text}
            </div>
          )}
          {phase === "waiting" && (
            <div className="text-6xl animate-pulse-glow">⚔️</div>
          )}
        </div>

        {/* Computer side */}
        <div className="flex flex-col items-center gap-3">
          <span className="text-sm font-bold text-muted-foreground uppercase tracking-widest">
            CPU
          </span>
          <div className="w-[320px] h-[320px] rounded-2xl bg-card border-2 border-border flex items-center justify-center">
            {phase === "countdown" && (
              <span className="text-8xl animate-shake">🤖</span>
            )}
            {phase === "capture" && (
              <span className="text-8xl animate-pulse">🤔</span>
            )}
            {phase === "result" && (
              <span
                className="text-8xl animate-bounce-in"
                key={`cpu-${roundNumber}`}
              >
                {CHOICE_EMOJI[computerChoice]}
              </span>
            )}
            {phase === "waiting" && (
              <span className="text-8xl opacity-40">🤖</span>
            )}
          </div>
          {phase === "result" && <ChoiceBadge choice={computerChoice} />}
        </div>
      </div>

      {/* Action buttons */}
      <div className="flex flex-col items-center gap-3 mt-2">
        {error && (
          <div className="text-center mb-2">
            <p className="text-destructive text-sm mb-2">Erro ao carregar modelo: {error}</p>
            <button
              onClick={loadModel}
              className="px-6 py-3 rounded-xl font-display text-lg bg-destructive text-destructive-foreground 
                         hover:opacity-90 transition-all active:scale-95"
            >
              TENTAR NOVAMENTE
            </button>
          </div>
        )}
        <div className="flex gap-4">
          {!error && (phase === "waiting" || phase === "result") && (
            <button
              onClick={handlePlay}
              disabled={isLoading || !isReady}
              className="px-8 py-4 rounded-xl font-display text-xl bg-primary text-primary-foreground 
                         hover:opacity-90 transition-all glow-primary disabled:opacity-30 
                         disabled:cursor-not-allowed active:scale-95"
            >
              {isLoading
                ? "Carregando modelo..."
                : !isReady
                ? "Preparando..."
                : roundNumber === 0
                ? "JOGAR! 🎮"
                : "JOGAR DE NOVO! 🔄"}
            </button>
          )}
          {roundNumber > 0 && phase !== "countdown" && phase !== "capture" && (
            <button
              onClick={resetGame}
              className="px-6 py-4 rounded-xl font-display text-lg bg-muted text-muted-foreground 
                         hover:bg-muted/80 transition-all active:scale-95"
            >
              ZERAR
            </button>
          )}
        </div>
      </div>

      {/* Instructions */}
      {phase === "waiting" && roundNumber === 0 && isReady && (
        <div className="max-w-md text-center text-muted-foreground text-sm mt-2 space-y-1">
          <p>
            Clique em <strong className="text-primary">JOGAR</strong> e mostre{" "}
            <strong>pedra</strong> 🪨, <strong>papel</strong> 📄 ou{" "}
            <strong>tesoura</strong> ✂️ na webcam quando o countdown terminar!
          </p>
        </div>
      )}
    </div>
  );
}

function ScoreCard({
  label,
  value,
  variant,
}: {
  label: string;
  value: number;
  variant: "player" | "cpu";
}) {
  return (
    <div
      className={`flex flex-col items-center px-6 py-3 rounded-xl border ${
        variant === "player"
          ? "border-primary/30 bg-primary/5"
          : "border-secondary/30 bg-secondary/5"
      }`}
    >
      <span className="text-xs font-bold text-muted-foreground uppercase tracking-wider">
        {label}
      </span>
      <span
        className={`text-3xl font-display ${
          variant === "player" ? "text-primary" : "text-secondary"
        }`}
      >
        {value}
      </span>
    </div>
  );
}

function CountdownDisplay({ count }: { count: number }) {
  return (
    <div
      key={count}
      className="text-7xl font-display text-accent animate-countdown-pop"
    >
      {count}
    </div>
  );
}

function ChoiceBadge({ choice }: { choice: GameChoice }) {
  return (
    <div className="flex items-center gap-2 px-4 py-2 rounded-lg bg-card border border-border">
      <span className="text-2xl">{CHOICE_EMOJI[choice]}</span>
      <span className="font-bold text-foreground text-sm">
        {CHOICE_LABEL[choice]}
      </span>
    </div>
  );
}

function LiveBadge({ choice }: { choice: GameChoice }) {
  return (
    <div className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-muted/50 border border-border/50">
      <span className="w-2 h-2 rounded-full bg-primary animate-pulse" />
      <span className="text-lg">{CHOICE_EMOJI[choice]}</span>
      <span className="text-xs text-muted-foreground">
        {CHOICE_LABEL[choice]}
      </span>
    </div>
  );
}
