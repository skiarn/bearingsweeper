import type { Route } from "./+types/home";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Button } from "~/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "~/components/ui/card";

type BearingType = "good" | "bad";

type Bearing = {
  id: number;
  type: BearingType;
  x: number;
  y: number;
  variant: 0 | 1 | 2;
  spinSeconds: number;
};

type Difficulty = "easy" | "normal" | "hard";

type DifficultySettings = {
  label: string;
  baseSpeed: number;
  speedRamp: number;
  baseSpawnEvery: number;
  spawnRamp: number;
  minSpawnEvery: number;
  wrongPickPenalty: number;
  missPenalty: number;
};

const DIFFICULTY_SETTINGS: Record<Difficulty, DifficultySettings> = {
  easy: {
    label: "Easy",
    baseSpeed: 12,
    speedRamp: 1.25,
    baseSpawnEvery: 1.35,
    spawnRamp: 0.018,
    minSpawnEvery: 0.55,
    wrongPickPenalty: 12,
    missPenalty: 8,
  },
  normal: {
    label: "Normal",
    baseSpeed: 16,
    speedRamp: 1.7,
    baseSpawnEvery: 1.1,
    spawnRamp: 0.025,
    minSpawnEvery: 0.35,
    wrongPickPenalty: 18,
    missPenalty: 12,
  },
  hard: {
    label: "Hard",
    baseSpeed: 20,
    speedRamp: 2.2,
    baseSpawnEvery: 0.9,
    spawnRamp: 0.032,
    minSpawnEvery: 0.23,
    wrongPickPenalty: 24,
    missPenalty: 16,
  },
};

const clamp = (value: number, min: number, max: number) => Math.min(max, Math.max(min, value));

export function meta({}: Route.MetaArgs) {
  return [
    { title: "Bearing Factory Panic!" },
    { name: "description", content: "Sort good and bad bearings before machine vibration reaches 100%." },
  ];
}

export default function Home() {
  const [running, setRunning] = useState(false);
  const [score, setScore] = useState(0);
  const [vibration, setVibration] = useState(0);
  const [elapsedSeconds, setElapsedSeconds] = useState(0);
  const [bearings, setBearings] = useState<Bearing[]>([]);
  const [draggingId, setDraggingId] = useState<number | null>(null);
  const [difficulty, setDifficulty] = useState<Difficulty>("normal");

  const arenaRef = useRef<HTMLDivElement | null>(null);
  const animationFrameRef = useRef<number | null>(null);
  const lastFrameRef = useRef<number | null>(null);
  const spawnAccumulatorRef = useRef(0);
  const nextBearingIdRef = useRef(1);

  const bearingsRef = useRef<Bearing[]>([]);
  const elapsedRef = useRef(0);
  const vibrationRef = useRef(0);
  const draggingIdRef = useRef<number | null>(null);

  const gameOver = vibration >= 100;
  const settings = DIFFICULTY_SETTINGS[difficulty as Difficulty];

  useEffect(() => {
    bearingsRef.current = bearings;
  }, [bearings]);

  useEffect(() => {
    elapsedRef.current = elapsedSeconds;
  }, [elapsedSeconds]);

  useEffect(() => {
    vibrationRef.current = vibration;
  }, [vibration]);

  useEffect(() => {
    draggingIdRef.current = draggingId;
  }, [draggingId]);

  const increaseVibration = useCallback((amount: number) => {
    if (amount <= 0) {
      return;
    }

    setVibration((prev) => {
      const next = clamp(prev + amount, 0, 100);
      if (next >= 100) {
        setRunning(false);
      }
      return next;
    });
  }, []);

  const spawnBearing = useCallback(() => {
    const type: BearingType = Math.random() < 0.55 ? "good" : "bad";
    const variant = Math.floor(Math.random() * 3) as 0 | 1 | 2;
    const newBearing: Bearing = {
      id: nextBearingIdRef.current,
      type,
      x: 50,
      y: 6,
      variant,
      spinSeconds: 1.05 + Math.random() * 0.95,
    };
    nextBearingIdRef.current += 1;
    setBearings((prev) => [...prev, newBearing]);
  }, []);

  const resolveSort = useCallback((bearing: Bearing, direction: "left" | "right") => {
    const correct =
      (bearing.type === "good" && direction === "left") ||
      (bearing.type === "bad" && direction === "right");

    setBearings((prev) => prev.filter((item) => item.id !== bearing.id));
    if (correct) {
      setScore((prev) => prev + 1);
    } else {
      increaseVibration(settings.wrongPickPenalty);
    }
  }, [increaseVibration, settings.wrongPickPenalty]);

  const startGame = useCallback(() => {
    if (animationFrameRef.current) {
      cancelAnimationFrame(animationFrameRef.current);
      animationFrameRef.current = null;
    }
    lastFrameRef.current = null;
    spawnAccumulatorRef.current = 0;
    nextBearingIdRef.current = 1;

    setScore(0);
    setVibration(0);
    setElapsedSeconds(0);
    setBearings([]);
    setDraggingId(null);
    setRunning(true);
  }, []);

  useEffect(() => {
    if (!running || gameOver) {
      if (animationFrameRef.current) {
        cancelAnimationFrame(animationFrameRef.current);
        animationFrameRef.current = null;
      }
      return;
    }

    const tick = (timestamp: number) => {
      if (lastFrameRef.current == null) {
        lastFrameRef.current = timestamp;
      }

      const deltaMs = timestamp - lastFrameRef.current;
      lastFrameRef.current = timestamp;
      const delta = Math.min(deltaMs / 1000, 0.1);

      setElapsedSeconds((prev) => prev + delta);

      const speed = settings.baseSpeed + elapsedRef.current * settings.speedRamp;
      let misses = 0;

      setBearings((prev) => {
        const next: Bearing[] = [];

        for (const bearing of prev) {
          const isDragging = draggingIdRef.current === bearing.id;
          const newY = isDragging ? bearing.y : bearing.y + speed * delta;

          if (newY >= 95) {
            misses += 1;
            continue;
          }

          next.push({ ...bearing, y: newY });
        }

        return next;
      });

      if (misses > 0) {
        increaseVibration(misses * settings.missPenalty);
      }

      spawnAccumulatorRef.current += delta;
      const spawnEvery = Math.max(
        settings.minSpawnEvery,
        settings.baseSpawnEvery - elapsedRef.current * settings.spawnRamp,
      );
      while (spawnAccumulatorRef.current >= spawnEvery) {
        spawnAccumulatorRef.current -= spawnEvery;
        spawnBearing();
      }

      if (vibrationRef.current < 100) {
        animationFrameRef.current = requestAnimationFrame(tick);
      }
    };

    animationFrameRef.current = requestAnimationFrame(tick);
    return () => {
      if (animationFrameRef.current) {
        cancelAnimationFrame(animationFrameRef.current);
        animationFrameRef.current = null;
      }
    };
  }, [
    gameOver,
    increaseVibration,
    running,
    settings.baseSpeed,
    settings.baseSpawnEvery,
    settings.minSpawnEvery,
    settings.missPenalty,
    settings.spawnRamp,
    settings.speedRamp,
    spawnBearing,
  ]);

  const updateDraggedBearingPosition = useCallback((clientX: number) => {
    if (draggingIdRef.current == null || !arenaRef.current) {
      return;
    }

    const rect = arenaRef.current.getBoundingClientRect();
    if (rect.width <= 0) {
      return;
    }

    const xPercent = clamp(((clientX - rect.left) / rect.width) * 100, 6, 94);
    const targetId = draggingIdRef.current;
    setBearings((prev) =>
      prev.map((bearing) =>
        bearing.id === targetId ? { ...bearing, x: xPercent } : bearing,
      ),
    );
  }, []);

  const releaseDraggedBearing = useCallback(() => {
    const targetId = draggingIdRef.current;
    if (targetId == null) {
      return;
    }

    const bearing = bearingsRef.current.find((item) => item.id === targetId);
    setDraggingId(null);

    if (!bearing) {
      return;
    }

    if (bearing.x <= 34) {
      resolveSort(bearing, "left");
      return;
    }

    if (bearing.x >= 66) {
      resolveSort(bearing, "right");
    }
  }, [resolveSort]);

  const sortByButton = useCallback((direction: "left" | "right") => {
    if (!running || gameOver || bearingsRef.current.length === 0) {
      return;
    }

    const candidate = [...bearingsRef.current].sort((a, b) => b.y - a.y)[0];
    if (candidate) {
      resolveSort(candidate, direction);
    }
  }, [gameOver, resolveSort, running]);

  const speedLabel = useMemo(() => {
    const value = 1 + elapsedSeconds * (settings.speedRamp / 60);
    return `${value.toFixed(2)}x`;
  }, [elapsedSeconds, settings.speedRamp]);

  return (
    <div className="min-h-screen bg-[linear-gradient(140deg,#081f1d_0%,#143f39_45%,#1f2937_100%)] p-4 md:p-6 lg:p-10">
      <Card className="mx-auto w-full max-w-5xl border-emerald-300/20 bg-slate-950/70 text-slate-100 shadow-[0_24px_60px_rgba(0,0,0,0.4)] backdrop-blur">
        <CardHeader className="space-y-3">
          <CardTitle className="text-center text-3xl font-black tracking-tight text-emerald-200 md:text-4xl">
            Bearing Factory Panic!
          </CardTitle>
          <CardDescription className="text-center text-base text-emerald-50/90">
            Sort good bearings left and bad bearings right before the line overloads.
          </CardDescription>
        </CardHeader>

        <CardContent className="space-y-5">
          <div className="rounded-md border border-slate-300/20 bg-slate-900/55 p-3">
            <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-slate-300/90">Difficulty</p>
            <div className="grid grid-cols-3 gap-2">
              {(Object.keys(DIFFICULTY_SETTINGS) as Difficulty[]).map((option) => {
                const isActive = option === difficulty;
                return (
                  <Button
                    key={option}
                    type="button"
                    variant="outline"
                    className={`border-slate-300/35 text-slate-100 hover:bg-slate-700/60 ${
                      isActive ? "bg-slate-200/20" : "bg-slate-800/45"
                    }`}
                    onClick={() => setDifficulty(option)}
                  >
                    {DIFFICULTY_SETTINGS[option].label}
                  </Button>
                );
              })}
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3 text-sm md:grid-cols-4">
            <div className="rounded-md border border-emerald-300/25 bg-emerald-500/10 p-3">
              <p className="text-emerald-100/80">Score</p>
              <p className="text-2xl font-bold text-emerald-200">{score}</p>
            </div>
            <div className="rounded-md border border-sky-300/25 bg-sky-500/10 p-3">
              <p className="text-sky-100/80">Conveyor Speed</p>
              <p className="text-2xl font-bold text-sky-200">{speedLabel}</p>
            </div>
            <div className="rounded-md border border-amber-300/25 bg-amber-500/10 p-3">
              <p className="text-amber-100/80">Vibration</p>
              <p className="text-2xl font-bold text-amber-200">{vibration}%</p>
            </div>
            <div className="rounded-md border border-fuchsia-300/25 bg-fuchsia-500/10 p-3">
              <p className="text-fuchsia-100/80">On Belt</p>
              <p className="text-2xl font-bold text-fuchsia-200">{bearings.length}</p>
            </div>
          </div>

          <div className="h-3 overflow-hidden rounded-full border border-amber-300/35 bg-slate-900">
            <div
              className="h-full bg-[linear-gradient(90deg,#22c55e_0%,#facc15_55%,#ef4444_100%)] transition-all duration-200"
              style={{ width: `${vibration}%` }}
            />
          </div>

          <div
            ref={arenaRef}
            className="relative h-[430px] touch-none overflow-hidden rounded-2xl border border-slate-200/15 bg-[radial-gradient(circle_at_top,_rgba(20,184,166,0.22),rgba(15,23,42,0.95)_55%)]"
            onPointerMove={(event) => {
              if (!running || gameOver) {
                return;
              }
              updateDraggedBearingPosition(event.clientX);
            }}
            onPointerUp={releaseDraggedBearing}
            onPointerCancel={releaseDraggedBearing}
            onPointerLeave={releaseDraggedBearing}
          >
            <div className="pointer-events-none absolute inset-y-4 left-1/2 w-40 -translate-x-1/2 rounded-xl border border-dashed border-slate-300/20 bg-white/5" />
            <div className="pointer-events-none absolute inset-y-6 left-1/2 w-28 -translate-x-1/2 rounded-xl bg-[radial-gradient(circle_at_center,#cbd5e140_0_8px,transparent_8px_18px)] bg-[length:100%_28px] opacity-70" />

            <div className="absolute bottom-4 left-4 rounded-lg border border-emerald-300/40 bg-emerald-500/15 px-3 py-2 text-sm font-semibold text-emerald-200">
              GOOD - LEFT
            </div>
            <div className="absolute bottom-4 right-4 rounded-lg border border-rose-300/40 bg-rose-500/15 px-3 py-2 text-sm font-semibold text-rose-200">
              BAD - RIGHT
            </div>

            {bearings.map((bearing) => {
              const isGood = bearing.type === "good";
              const outerFill = bearing.variant === 0 ? "#d0d0d0" : bearing.variant === 1 ? "#c5c8cc" : "#b9bfc7";
              const innerFill = bearing.variant === 0 ? "#e6e6e6" : bearing.variant === 1 ? "#dbdee2" : "#d2d7de";
              const rollerFill = bearing.variant === 0 ? "#cccccc" : bearing.variant === 1 ? "#bcc4cf" : "#aeb8c5";

              return (
                <button
                  key={bearing.id}
                  type="button"
                  className={`absolute z-10 h-12 w-12 -translate-x-1/2 -translate-y-1/2 rounded-full border border-slate-100/50 bg-[radial-gradient(circle_at_30%_28%,#f8fafc_0%,#cbd5e1_24%,#7c8aa0_62%,#475569_100%)] shadow-[0_8px_18px_rgba(0,0,0,0.45)] transition-transform active:scale-95 motion-safe:animate-[spin_var(--spin)_linear_infinite] ${
                    isGood ? "ring-1 ring-emerald-300/40" : "ring-1 ring-rose-300/45"
                  } ${draggingId === bearing.id ? "scale-125" : ""}`}
                  style={{
                    left: `${bearing.x}%`,
                    top: `${bearing.y}%`,
                    ["--spin" as "--spin"]: `${bearing.spinSeconds}s`,
                  }}
                  onPointerDown={(event) => {
                    if (!running || gameOver) {
                      return;
                    }
                    event.preventDefault();
                    setDraggingId(bearing.id);
                    updateDraggedBearingPosition(event.clientX);
                  }}
                  aria-label={`${isGood ? "Good" : "Bad"} bearing`}
                >
                  <svg
                    className="pointer-events-none absolute inset-[3px]"
                    viewBox="0 0 200 200"
                    xmlns="http://www.w3.org/2000/svg"
                    aria-hidden="true"
                  >
                    <circle cx="100" cy="100" r="90" fill={outerFill} stroke="#555" strokeWidth="8" />
                    <circle cx="100" cy="100" r="45" fill={innerFill} stroke="#555" strokeWidth="6" />

                    <g fill={rollerFill} stroke="#444" strokeWidth="4">
                      <circle cx="100" cy="20" r="12" />
                      <circle cx="150" cy="50" r="12" />
                      <circle cx="175" cy="100" r="12" />
                      <circle cx="150" cy="150" r="12" />
                      <circle cx="100" cy="175" r="12" />
                      <circle cx="50" cy="150" r="12" />
                      <circle cx="25" cy="100" r="12" />
                      <circle cx="50" cy="50" r="12" />
                    </g>
                  </svg>

                  {isGood ? (
                    <span className="pointer-events-none absolute bottom-[7px] right-[7px] h-2 w-2 rounded-full bg-emerald-300 shadow-[0_0_6px_rgba(110,231,183,0.8)]" />
                  ) : (
                    <>
                      <span className="pointer-events-none absolute bottom-[6px] right-[6px] h-2.5 w-2.5 rounded-full bg-rose-400/90 shadow-[0_0_6px_rgba(251,113,133,0.75)]" />
                      <span className="pointer-events-none absolute left-[8px] top-[22px] h-[2px] w-4 rotate-[-18deg] bg-rose-200/85" />
                    </>
                  )}
                </button>
              );
            })}

            {(!running || gameOver) && (
              <div className="absolute inset-0 z-20 flex flex-col items-center justify-center bg-slate-950/70 p-6 text-center backdrop-blur-sm">
                <h2 className="text-2xl font-extrabold text-emerald-200 md:text-3xl">
                  {gameOver ? "Machine Failure" : "Ready for Shift"}
                </h2>
                <p className="mt-3 max-w-lg text-slate-200/90">
                  Drag bearings while they move. Good goes left, bad goes right. Wrong picks add vibration.
                </p>
                {gameOver && (
                  <p className="mt-2 text-amber-200">
                    Final score: <span className="font-bold">{score}</span>
                  </p>
                )}
                <Button className="mt-5 bg-emerald-500 text-emerald-950 hover:bg-emerald-400" onClick={startGame}>
                  {gameOver ? "Restart Factory" : "Start Game"}
                </Button>
              </div>
            )}
          </div>

          <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
            <Button
              type="button"
              variant="outline"
              className="border-emerald-300/40 bg-emerald-500/10 text-emerald-100 hover:bg-emerald-500/20"
              onClick={() => sortByButton("left")}
              disabled={!running || gameOver}
            >
              Sort Left
            </Button>
            <Button
              type="button"
              className="bg-sky-500 text-sky-950 hover:bg-sky-400"
              onClick={startGame}
            >
              Reset Run
            </Button>
            <Button
              type="button"
              variant="outline"
              className="border-rose-300/40 bg-rose-500/10 text-rose-100 hover:bg-rose-500/20"
              onClick={() => sortByButton("right")}
              disabled={!running || gameOver}
            >
              Sort Right
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
