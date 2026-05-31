"use client";

import { AnimatePresence, LayoutGroup, motion } from "framer-motion";
import React, { ChangeEvent, MouseEvent, useEffect, useMemo, useRef, useState } from "react";

const BF_TOKENS = "><+-.,[]";
const TAPE_SIZE = 30000;
const HISTORY_LIMIT = 8;
const DEFAULT_SPEED = 60;
const HELLO_WORLD_PROGRAM =
  ">++++++++[<+++++++++>-]<.>++++[<+++++++>-]<+.+++++++..+++.>>++++++[<+++++++>-]<+\n+.------------.>++++++[<+++++++++>-]<+.<.+++.------.--------.>>>++++[<++++++++>-]\n<+.";
const DEFAULT_PROGRAM = "+++[>+++++<-]>.>++++++++[<++++++>-]<.";
const DEFAULT_INPUT = "";

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

function formatCount(count: number): string {
  return count.toString().padStart(2, "0");
}

function useElementWidth(ref: React.RefObject<HTMLElement>): number {
  const [width, setWidth] = useState(0);

  useEffect(() => {
    const element = ref.current;

    if (!element) {
      return undefined;
    }

    setWidth(element.getBoundingClientRect().width);

    const observer = new ResizeObserver((entries) => {
      const entry = entries[0];

      if (entry) {
        setWidth(entry.contentRect.width);
      }
    });

    observer.observe(element);

    return () => observer.disconnect();
  }, [ref]);

  return width;
}

interface SampleProgram {
  id: string;
  label: string;
  program: string;
  input: string;
}

interface TapeCellState {
  index: number;
  value: number;
  active: boolean;
}

interface TapeWindow {
  cells: TapeCellState[];
}

interface StepResult {
  steps: number;
  done: boolean;
  note: string;
  op: string | null;
  executedPc: number | null;
}

type StatusTone = "neutral" | "positive" | "error";

const SAMPLE_PROGRAMS: SampleProgram[] = [
  {
    id: "hello-world",
    label: "Hello, World!",
    program: HELLO_WORLD_PROGRAM,
    input: "",
  },
  {
    id: "echo",
    label: "Echo",
    program: ",[.,]",
    input: "meow",
  },
  {
    id: "tiny-count",
    label: "Tiny Counter",
    program: "+++++[>++++++++++<-]>.+.+.",
    input: "",
  },
];

class BrainfuckMachine {
  code: string[];
  bracketMap: Map<number, number>;
  tape: Uint8Array;
  pointer: number;
  pc: number;
  steps: number;
  output: string;
  inputIndex: number;
  done: boolean;
  lastExecutedPc: number | null;

  constructor(program: string, readonly input: string) {
    this.code = Array.from(program).filter((token) => BF_TOKENS.includes(token));

    if (this.code.length === 0) {
      throw new Error("Program contains no Brainfuck instructions.");
    }

    this.bracketMap = this.buildBracketMap();
    this.tape = new Uint8Array(TAPE_SIZE);
    this.pointer = 0;
    this.pc = 0;
    this.steps = 0;
    this.output = "";
    this.inputIndex = 0;
    this.done = false;
    this.lastExecutedPc = null;
  }

  private buildBracketMap(): Map<number, number> {
    const brackets = new Map<number, number>();
    const stack: number[] = [];

    this.code.forEach((token, index) => {
      if (token === "[") {
        stack.push(index);
      }

      if (token === "]") {
        const openIndex = stack.pop();

        if (openIndex === undefined) {
          throw new Error(`Unmatched ']' at instruction ${index + 1}.`);
        }

        brackets.set(openIndex, index);
        brackets.set(index, openIndex);
      }
    });

    const openIndex = stack.pop();

    if (openIndex !== undefined) {
      throw new Error(`Unmatched '[' at instruction ${openIndex + 1}.`);
    }

    return brackets;
  }

  step(): StepResult {
    if (this.done) {
      return {
        steps: this.steps,
        done: true,
        note: "Program complete.",
        op: null,
        executedPc: this.pc,
      };
    }

    if (this.pc >= this.code.length) {
      this.done = true;

      return {
        steps: this.steps,
        done: true,
        note: "End of program reached.",
        op: null,
        executedPc: Math.max(0, this.pc - 1),
      };
    }

    const instruction = this.code[this.pc];
    let note = "";
    this.lastExecutedPc = this.pc;

    switch (instruction) {
      case ">":
        this.pointer = Math.min(TAPE_SIZE - 1, this.pointer + 1);
        note = `Pointer padded right to cell ${this.pointer}.`;
        break;
      case "<":
        this.pointer = Math.max(0, this.pointer - 1);
        note = `Pointer tiptoed left to cell ${this.pointer}.`;
        break;
      case "+":
        this.tape[this.pointer] = (this.tape[this.pointer] + 1) & 0xff;
        note = `Cell ${this.pointer} curled up to ${this.tape[this.pointer]}.`;
        break;
      case "-":
        this.tape[this.pointer] = (this.tape[this.pointer] - 1) & 0xff;
        note = `Cell ${this.pointer} settled down to ${this.tape[this.pointer]}.`;
        break;
      case ".":
        this.output += String.fromCharCode(this.tape[this.pointer]);
        note = `Printed ASCII ${this.tape[this.pointer]} from cell ${this.pointer}.`;
        break;
      case ",":
        if (this.inputIndex < this.input.length) {
          this.tape[this.pointer] = this.input.charCodeAt(this.inputIndex);
          note = `Read '${this.input[this.inputIndex]}' into cell ${this.pointer}.`;
          this.inputIndex++;
        } else {
          this.tape[this.pointer] = 0;
          note = `Input bowl is empty, so cell ${this.pointer} became 0.`;
        }
        break;
      case "[":
        if (this.tape[this.pointer] === 0) {
          this.pc = this.bracketMap.get(this.pc) ?? this.pc;
          note = "Skipped the loop because the current cell is 0.";
        } else {
          note = "Entered the loop because the current cell has a value.";
        }
        break;
      case "]":
        if (this.tape[this.pointer] !== 0) {
          this.pc = this.bracketMap.get(this.pc) ?? this.pc;
          note = "Looped back because the current cell is still awake.";
        } else {
          note = "Exited the loop because the current cell is 0.";
        }
        break;
      default:
        note = "Ignored a non-Brainfuck token.";
    }

    this.pc++;
    this.steps++;

    return {
      steps: this.steps,
      done: this.done,
      note,
      op: instruction,
      executedPc: this.lastExecutedPc,
    };
  }

  getTapeWindow(visibleCells: number): TapeWindow {
    const halfWindow = Math.floor(visibleCells / 2);
    const startIndex = Math.max(0, this.pointer - halfWindow);
    const endIndex = Math.min(TAPE_SIZE, startIndex + visibleCells);
    const cells: TapeCellState[] = [];

    for (let index = startIndex; index < endIndex; index++) {
      cells.push({
        index,
        value: this.tape[index],
        active: index === this.pointer,
      });
    }

    return { cells };
  }
}

interface CellValueProps {
  value: number;
}

function CellValue({ value }: CellValueProps): JSX.Element {
  return (
    <div className="flex min-h-[62px] w-full items-center justify-center" aria-label={`Cell value ${value}`}>
      <AnimatePresence mode="wait" initial={false}>
        <motion.span
          key={value}
          className="w-full text-center text-[1.45rem] font-black tabular-nums text-[#26313d]"
          initial={{ y: 22, opacity: 0, scale: 0.84 }}
          animate={{ y: 0, opacity: 1, scale: 1 }}
          exit={{ y: -22, opacity: 0, scale: 0.84 }}
          transition={{ type: "tween", duration: 0.12, ease: "easeOut" }}
        >
          {value}
        </motion.span>
      </AnimatePresence>
    </div>
  );
}

interface CodeTokenProps {
  token: string;
  active: boolean;
}

function CodeToken({ token, active }: CodeTokenProps): JSX.Element {
  return (
    <motion.span
      layout
      className={`inline-grid min-h-[34px] min-w-[34px] place-items-center rounded-lg border px-2 text-sm font-black ${
        active
          ? "border-[#2e3640] bg-[#ffd6dd] text-[#26313d] shadow-[0_5px_0_#2e3640]"
          : "border-[#ddc7ae] bg-[#fff4df] text-[#26313d]"
      }`}
      animate={active ? { scale: 1.05, y: -2 } : { scale: 1, y: 0 }}
      transition={{ type: "tween", duration: 0.1, ease: "easeOut" }}
    >
      {token}
    </motion.span>
  );
}

interface TapeCellProps {
  cell: TapeCellState;
}

function TapeCell({ cell }: TapeCellProps): JSX.Element {
  return (
    <motion.div
      layout
      className="grid min-h-[136px] gap-2 text-center"
      animate={cell.active ? { y: -4, scale: 1.03 } : { y: 0, scale: 1 }}
      transition={{ type: "tween", duration: 0.12, ease: "easeOut" }}
    >
      <div
        className={`relative grid min-h-[112px] place-items-center rounded-lg border-2 px-2 ${
          cell.active
            ? "border-[#2e3640] bg-[#dff8ee] shadow-[0_8px_0_#2e3640]"
            : "border-[#ddc7ae] bg-[#fffdfa]"
        }`}
      >
        {cell.active ? (
          <span className="absolute right-2 top-2 text-sm font-black text-[#c94f6a]">^</span>
        ) : null}
        <CellValue value={cell.value} />
      </div>
      <span className="text-xs font-extrabold uppercase text-[#6b7280]">cell {cell.index}</span>
    </motion.div>
  );
}

interface TutorialProps {
  onClose: () => void;
}

function Tutorial({ onClose }: TutorialProps): JSX.Element {
  const [slide, setSlide] = useState(0);
  const slides = [
    ["Meet BrainCrawly", "This is a step-by-step Brainfuck visualizer. You can move slowly and watch the tape react."],
    ["What is Brainfuck?", "Brainfuck is a tiny language with 8 commands that manipulate a tape of byte cells."],
    ["The tape", "Each cell holds a value 0-255. The pointer moves left and right across the tape."],
    ["Pointer moves", "Use > to move right and < to move left. The highlighted cell is the current pointer."],
    ["Value changes", "+ increments the current cell, - decrements it, and values wrap around 0-255."],
    ["Input and output", ". outputs the current cell as ASCII. , reads the next input byte into the cell."],
    ["Loops", "[ and ] create loops. When the current cell is 0, the loop skips ahead."],
    ["Step visualizer", "Use Step to advance one instruction. Run will keep stepping at your chosen speed."],
    ["Editing resets", "Any edit reloads the program, resets the tape to zeros, and clears the step log."],
    ["Hello, World!", HELLO_WORLD_PROGRAM],
  ] as const;
  const current = slides[slide];
  const isLast = slide === slides.length - 1;

  function next(): void {
    if (isLast) {
      onClose();
      return;
    }

    setSlide((value) => value + 1);
  }

  return (
    <motion.div
      className="fixed inset-0 z-20 grid place-items-center bg-[#26313d]/40 p-4"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      onClick={onClose}
    >
      <motion.div
        className="w-full max-w-md rounded-lg border-2 border-[#2e3640] bg-[#fffdfa] p-5 shadow-[0_18px_48px_rgba(82,57,36,0.14)]"
        initial={{ scale: 0.95, opacity: 0, y: 20 }}
        animate={{ scale: 1, opacity: 1, y: 0 }}
        exit={{ scale: 0.95, opacity: 0, y: 20 }}
        onClick={(event: MouseEvent) => event.stopPropagation()}
      >
        <button
          type="button"
          className="float-right grid h-9 w-9 place-items-center rounded-lg bg-[#fff2c7] text-sm font-black text-[#26313d]"
          onClick={onClose}
          aria-label="Close tutorial"
        >
          x
        </button>
        <p className="text-xs font-extrabold uppercase text-[#4fc7a1]">Tiny tutorial</p>
        <h2 className="mt-2 text-lg font-bold text-[#26313d]">{current[0]}</h2>
        {current[0] === "Hello, World!" ? (
          <pre className="mt-3 max-h-48 overflow-auto rounded-lg border border-[#ddc7ae] bg-[#26313d] p-3 text-xs leading-relaxed text-[#fffdfa]">
            {current[1]}
          </pre>
        ) : (
          <p className="mt-2 text-sm leading-relaxed text-[#6b7280]">{current[1]}</p>
        )}
        <div className="mt-5 flex items-center justify-between gap-3">
          <div className="flex items-center gap-2" aria-label="Tutorial progress">
            {slides.map((item, index) => (
              <button
                key={item[0]}
                type="button"
                className={`h-2 w-7 rounded-full transition ${
                  index === slide ? "bg-[#ff8fa3]" : "bg-[#ead9c5]"
                }`}
                onClick={() => setSlide(index)}
                aria-label={`Go to slide ${index + 1}`}
              />
            ))}
          </div>
          <button
            type="button"
            className="rounded-lg bg-[#8be8c5] px-4 py-2 text-sm font-black text-[#1b302b] shadow-[0_6px_0_#2e3640]"
            onClick={next}
          >
            {isLast ? "Start" : "Next"}
          </button>
        </div>
      </motion.div>
    </motion.div>
  );
}

export default function Page(): JSX.Element {
  const [program, setProgram] = useState(DEFAULT_PROGRAM);
  const [input, setInput] = useState(DEFAULT_INPUT);
  const [running, setRunning] = useState(false);
  const [speed, setSpeed] = useState(DEFAULT_SPEED);
  const [status, setStatus] = useState("Ready for a careful little step.");
  const [statusTone, setStatusTone] = useState<StatusTone>("neutral");
  const [history, setHistory] = useState<StepResult[]>([]);
  const [renderTick, setRenderTick] = useState(0);
  const [showTutorial, setShowTutorial] = useState(true);
  const [fallbackTapeSeed, setFallbackTapeSeed] = useState(0);
  const machineRef = useRef<BrainfuckMachine | null>(
    new BrainfuckMachine(DEFAULT_PROGRAM, DEFAULT_INPUT)
  );
  const tapeShellRef = useRef<HTMLElement>(null);
  const tapeWidth = useElementWidth(tapeShellRef);

  useEffect(() => {
    return () => undefined;
  }, []);

  const visibleCells = clamp(Math.floor((tapeWidth || 780) / 82), 7, 17);
  const machine = machineRef.current;
  const tapeWindow = machine?.getTapeWindow(visibleCells) ?? null;
  const fallbackTape = useMemo(() => {
    const cells = Array.from({ length: visibleCells }, (_, index) => ({
      index,
      value: 0,
      active: index === 0,
    }));

    return { cells } as TapeWindow;
  }, [visibleCells, fallbackTapeSeed]);
  const codeTokens = Array.from(program).filter((token) => BF_TOKENS.includes(token));
  const highlightedInstruction = machine?.lastExecutedPc ?? machine?.pc ?? null;
  const outputText = machine?.output ?? "";
  const stats = [
    ["Steps", machine ? formatCount(machine.steps) : "--"],
    ["Pointer", machine ? formatCount(machine.pointer) : "--"],
    ["PC", machine ? formatCount(machine.pc) : "--"],
    ["Cells", formatCount(visibleCells)],
  ] as const;

  function rerender(): void {
    setRenderTick((value) => value + 1);
  }

  function loadMachine(nextProgram: string, nextInput: string, message: string): void {
    try {
      machineRef.current = new BrainfuckMachine(nextProgram, nextInput);
      setStatus(message);
      setStatusTone("neutral");
    } catch (error) {
      machineRef.current = null;
      setStatus(error instanceof Error ? error.message : String(error));
      setStatusTone("error");
      setFallbackTapeSeed((value) => value + 1);
    }

    setHistory([]);
    setRunning(false);
    rerender();
  }

  function advanceOneStep(): { advanced: boolean; done: boolean } {
    const current = machineRef.current;

    if (!current) {
      setStatus("Fix the program before stepping.");
      setStatusTone("error");
      return { advanced: false, done: true };
    }

    if (current.done) {
      setStatus("Program complete.");
      setStatusTone("neutral");
      return { advanced: false, done: true };
    }

    const step = current.step();

    setHistory((currentHistory) => [step, ...currentHistory].slice(0, HISTORY_LIMIT));
    setStatus(step.done ? `${step.note} Program complete.` : step.note);
    setStatusTone("positive");
    rerender();

    return { advanced: true, done: step.done };
  }

  useEffect(() => {
    if (!running) {
      return undefined;
    }

    const timeout = window.setTimeout(() => {
      const result = advanceOneStep();

      if (!result.advanced || result.done) {
        setRunning(false);
      }
    }, speed);

    return () => window.clearTimeout(timeout);
  }, [running, speed, renderTick]);

  function handleProgramChange(event: ChangeEvent<HTMLTextAreaElement>): void {
    const nextProgram = event.target.value;
    setProgram(nextProgram);
    loadMachine(nextProgram, input, "Program tucked in and reloaded.");
  }

  function handleInputChange(event: ChangeEvent<HTMLTextAreaElement>): void {
    const nextInput = event.target.value;
    setInput(nextInput);
    loadMachine(program, nextInput, "Input bowl refreshed.");
  }

  function loadSample(sample: SampleProgram): void {
    setProgram(sample.program);
    setInput(sample.input);
    loadMachine(sample.program, sample.input, `Loaded ${sample.label}.`);
  }

  function handleReset(): void {
    loadMachine(program, input, "Reset to the first instruction.");
  }

  function handleStep(): void {
    setRunning(false);
    advanceOneStep();
  }

  function handleRunToggle(): void {
    const current = machineRef.current;

    if (!current) {
      setStatus("Load a valid program first.");
      setStatusTone("error");
      return;
    }

    if (current.done) {
      loadMachine(program, input, "Restarted from the beginning.");
      setRunning(true);
      return;
    }

    setRunning((value) => !value);
    setStatus(running ? "Paused." : "Running one soft paw-step at a time.");
    setStatusTone("neutral");
  }

  const statusToneClass =
    statusTone === "positive"
      ? "text-[#227958]"
      : statusTone === "error"
        ? "text-[#b23b55]"
        : "text-[#6b7280]";

  return (
    <main className="min-h-screen px-4 pb-9 pt-7 md:px-6">
      <AnimatePresence>{showTutorial && <Tutorial onClose={() => setShowTutorial(false)} />}</AnimatePresence>

      <section className="mx-auto mb-4 w-full max-w-5xl">
        <h1 className="text-[clamp(2.8rem,6.2vw,5.6rem)] font-black leading-[0.96] tracking-tight text-[#26313d]">
          BrainCrwaly
        </h1>
      </section>

      <section className="mx-auto grid w-full max-w-5xl gap-4 lg:grid-cols-[minmax(320px,390px)_minmax(0,1fr)]">
        <aside className="rounded-lg border-2 border-[#2e3640] bg-[#fffdfa]/90 shadow-[0_18px_48px_rgba(82,57,36,0.14)]">
          <div className="px-4 pb-0 pt-5">
            <p className="text-xs font-extrabold uppercase text-[#4fc7a1]">Controls</p>
            <h2 className="mt-1 text-xl font-bold text-[#26313d]">Code nest</h2>
          </div>

          <div className="grid gap-3 p-4">
            <section className="grid gap-3 rounded-lg border border-[#ead9c5] bg-white/70 p-3.5">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <h3 className="text-lg font-semibold text-[#26313d]">Program</h3>
                <div className="flex flex-wrap justify-end gap-2">
                  {SAMPLE_PROGRAMS.map((sample) => (
                    <button
                      key={sample.id}
                      type="button"
                      className="rounded-lg border border-[#f0c2cd] bg-[#fff0f4] px-3 py-1 text-xs font-black text-[#873a4d] transition hover:-translate-y-0.5"
                      onClick={() => loadSample(sample)}
                    >
                      {sample.label}
                    </button>
                  ))}
                </div>
              </div>
              <label className="grid gap-2">
                <span className="text-xs font-extrabold uppercase text-[#6b7280]">Source code</span>
                <textarea
                  className="min-h-[190px] w-full rounded-lg border border-[#ddc7ae] bg-[#fffdfa] p-3 font-mono text-sm leading-relaxed text-[#26313d] outline-none focus:border-[#4fc7a1] focus:ring-4 focus:ring-[#4fc7a1]/20"
                  value={program}
                  onChange={handleProgramChange}
                  spellCheck="false"
                  rows={9}
                />
              </label>
            </section>

            <section className="grid gap-2 rounded-lg border border-[#ead9c5] bg-white/70 p-3.5">
              <h3 className="text-lg font-semibold text-[#26313d]">Input</h3>
              <label className="grid gap-2">
                <span className="text-xs font-extrabold uppercase text-[#6b7280]">
                  Bytes consumed by comma instructions
                </span>
                <textarea
                  className="min-h-[96px] w-full rounded-lg border border-[#ddc7ae] bg-[#fffdfa] p-3 font-mono text-sm leading-relaxed text-[#26313d] outline-none focus:border-[#4fc7a1] focus:ring-4 focus:ring-[#4fc7a1]/20"
                  value={input}
                  onChange={handleInputChange}
                  spellCheck="false"
                  rows={3}
                  placeholder="meow"
                />
              </label>
            </section>

            <section className="grid gap-3 rounded-lg border border-[#ead9c5] bg-white/70 p-3.5">
              <div className="flex flex-wrap items-start justify-between gap-2">
                <h3 className="text-lg font-semibold text-[#26313d]">Playback</h3>
                <span className="text-xs font-semibold uppercase text-[#6b7280]">{speed} ms per step</span>
              </div>
              <input
                type="range"
                min="10"
                max="300"
                step="10"
                value={speed}
                onChange={(event) => setSpeed(Number(event.target.value))}
                aria-label="Step speed"
                className="w-full accent-[#ff8fa3]"
              />
              <div className="grid gap-2 sm:grid-cols-3">
                <button
                  type="button"
                  className="rounded-lg bg-[#8be8c5] px-3 py-2 text-sm font-black text-[#1b302b] shadow-[0_6px_0_#2e3640] transition hover:-translate-y-0.5"
                  onClick={handleStep}
                >
                  Step
                </button>
                <button
                  type="button"
                  className="rounded-lg border-2 border-[#2e3640] bg-[#eaf2ff] px-3 py-2 text-sm font-black text-[#26313d] transition hover:-translate-y-0.5"
                  onClick={handleRunToggle}
                >
                  {running ? "Pause" : "Run"}
                </button>
                <button
                  type="button"
                  className="rounded-lg border-2 border-[#f0c367] bg-[#fff2c7] px-3 py-2 text-sm font-black text-[#70470f] transition hover:-translate-y-0.5"
                  onClick={handleReset}
                >
                  Reset
                </button>
              </div>
              <p className={`min-h-[1.4rem] text-sm ${statusToneClass}`}>{status}</p>
            </section>

            <section className="grid gap-2 sm:grid-cols-2">
              {stats.map(([label, value]) => (
                <motion.div
                  key={label}
                  className="rounded-lg border border-[#d9c7b5] bg-[#fdf7ef] p-3"
                  layout
                >
                  <span className="text-xs font-extrabold uppercase text-[#6b7280]">{label}</span>
                  <strong className="mt-1 block text-lg font-semibold tabular-nums text-[#26313d]">
                    {value}
                  </strong>
                </motion.div>
              ))}
            </section>
          </div>
        </aside>

        <section className="rounded-lg border-2 border-[#2e3640] bg-[#fffdfa]/90 shadow-[0_18px_48px_rgba(82,57,36,0.14)]">
          <div className="flex flex-wrap items-start justify-between gap-3 px-4 pb-0 pt-5">
            <div>
              <p className="text-xs font-extrabold uppercase text-[#4fc7a1]">Visualization</p>
              <h2 className="mt-1 text-xl font-bold text-[#26313d]">Live execution</h2>
            </div>
          </div>

          <div className="grid gap-3 p-4">
            <LayoutGroup>
              <section className="grid gap-3 rounded-lg border border-[#ead9c5] bg-white/70 p-3.5">
                <div className="flex flex-wrap items-start justify-between gap-2">
                  <h3 className="text-lg font-semibold text-[#26313d]">Code trace</h3>
                  <span className="text-xs font-semibold uppercase text-[#6b7280]">
                    {machine ? `instruction ${highlightedInstruction ?? 0}` : "waiting for valid code"}
                  </span>
                </div>
                <div className="flex min-h-[88px] flex-wrap gap-2 rounded-lg border border-[#ead9c5] bg-[#fffdfa] p-3">
                  {codeTokens.length > 0 ? (
                    codeTokens.map((token, index) => (
                      <CodeToken
                        key={`${index}-${token}`}
                        token={token}
                        active={index === highlightedInstruction}
                      />
                    ))
                  ) : (
                    <span className="text-sm text-[#6b7280]">No executable instructions yet.</span>
                  )}
                </div>
              </section>

              <section ref={tapeShellRef} className="grid gap-3 rounded-lg border border-[#ead9c5] bg-white/70 p-3.5">
                <div className="flex flex-wrap items-start justify-between gap-2">
                  <h3 className="text-lg font-semibold text-[#26313d]">Tape</h3>
                  <span className="text-xs font-semibold uppercase text-[#6b7280]">centered on the pointer</span>
                </div>
                <div className="min-h-[190px] overflow-hidden rounded-lg border border-[#ead9c5] bg-[#f4fff8] p-3">
                  <div
                    className="grid gap-2"
                    style={{ gridTemplateColumns: `repeat(${visibleCells}, minmax(60px, 1fr))` }}
                  >
                    {(machine && tapeWindow ? tapeWindow : fallbackTape).cells.map((cell) => (
                      <TapeCell key={cell.index} cell={cell} />
                    ))}
                  </div>
                </div>
              </section>
            </LayoutGroup>

            <section className="grid gap-3 lg:grid-cols-2">
              <section className="grid gap-3 rounded-lg border border-[#ead9c5] bg-white/70 p-3.5">
                <div className="flex flex-wrap items-start justify-between gap-2">
                  <h3 className="text-lg font-semibold text-[#26313d]">Step log</h3>
                  <span className="text-xs font-semibold uppercase text-[#6b7280]">latest first</span>
                </div>
                <div className="grid max-h-[242px] gap-2 overflow-auto pr-1">
                  {history.length > 0 ? (
                    history.map((entry) => (
                      <motion.article
                        key={`${entry.steps}-${entry.executedPc}-${entry.op}`}
                        className="grid gap-1 rounded-lg border border-[#ead9c5] bg-[#fffdfa] p-3"
                        initial={{ opacity: 0, x: 18 }}
                        animate={{ opacity: 1, x: 0 }}
                      >
                        <strong className="text-sm font-semibold text-[#26313d]">
                          Step {entry.steps} · {entry.op ?? "done"} at pc {(entry.executedPc ?? -1) + 1}
                        </strong>
                        <span className="text-xs leading-relaxed text-[#6b7280]">{entry.note}</span>
                      </motion.article>
                    ))
                  ) : (
                    <div className="grid min-h-[96px] place-items-center rounded-lg border border-dashed border-[#d6bfa7] bg-white/70 text-sm text-[#6b7280]">
                      No steps yet.
                    </div>
                  )}
                </div>
              </section>

              <section className="grid gap-3 rounded-lg border border-[#ead9c5] bg-white/70 p-3.5">
                <div className="flex flex-wrap items-start justify-between gap-2">
                  <h3 className="text-lg font-semibold text-[#26313d]">Output</h3>
                  <span className="text-xs font-semibold uppercase text-[#6b7280]">stepped output</span>
                </div>
                <div className="grid gap-3">
                  <pre className="min-h-[90px] rounded-lg border border-[#ddc7ae] bg-[#26313d] p-3 text-sm leading-relaxed text-[#fffdfa]">
                    {outputText.length > 0 ? outputText : "Step output appears here."}
                  </pre>
                </div>
              </section>
            </section>
          </div>
        </section>
      </section>
    </main>
  );
}
