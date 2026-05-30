"use client";

import { AnimatePresence, LayoutGroup, motion } from "framer-motion";
import React, { ChangeEvent, MouseEvent, useEffect, useRef, useState } from "react";

import initWasm, { interpret as interpretWithWasm } from "../interpreter/crawly_wasm.js";

const BF_TOKENS = "><+-.,[]";
const TAPE_SIZE = 30000;
const HISTORY_LIMIT = 8;
const DEFAULT_SPEED = 180;
const DEFAULT_PROGRAM = "+++[>+++++<-]>.>++++++++[<++++++>-]<.";
const DEFAULT_INPUT = "";

let wasmInitPromise: Promise<void> | null = null;

function ensureWasm(): Promise<void> {
  if (!wasmInitPromise) {
    wasmInitPromise = initWasm().then(() => undefined);
  }

  return wasmInitPromise;
}

async function runWasm(program: string, input: string): Promise<string> {
  await ensureWasm();
  return interpretWithWasm(program, input);
}

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
type WasmTone = "idle" | "ready" | "error";

const SAMPLE_PROGRAMS: SampleProgram[] = [
  {
    id: "hello-world",
    label: "Hello, World!",
    program:
      "++++++++++[>+++++++>++++++++++>+++>+<<<<-]>.>++.+++++++..+++.>++.<<+++++++++++++++.>.+++.------.--------.>+.>.",
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

const PAGE_STYLES = `
  :root {
    color-scheme: light;
    --cream: #fff8ed;
    --paper: #fffdfa;
    --ink: #26313d;
    --muted: #6b7280;
    --line: #ead9c5;
    --rose: #ff8fa3;
    --rose-dark: #c94f6a;
    --mint: #4fc7a1;
    --mint-soft: #dff8ee;
    --blue: #5f8fd7;
    --honey: #f5bd4f;
    --shadow: 0 18px 48px rgba(82, 57, 36, 0.14);
  }

  * { box-sizing: border-box; }

  html, body { min-height: 100%; }

  body {
    margin: 0;
    color: var(--ink);
    background:
      linear-gradient(90deg, rgba(38, 49, 61, 0.04) 1px, transparent 1px),
      linear-gradient(rgba(38, 49, 61, 0.04) 1px, transparent 1px),
      linear-gradient(135deg, #fff7eb 0%, #f4fff8 42%, #f7f2ff 100%);
    background-size: 28px 28px, 28px 28px, auto;
    font-family: var(--font-montserrat), "Segoe UI", sans-serif;
    overflow-x: hidden;
  }

  button, textarea, input { font: inherit; }
  button { border: 0; cursor: pointer; }
  button:disabled { cursor: not-allowed; opacity: 0.62; }
  textarea { resize: vertical; }

  .page {
    min-height: 100vh;
    padding: 28px 18px 36px;
  }

  .hero {
    width: min(1180px, 100%);
    margin: 0 auto 18px;
    display: grid;
    grid-template-columns: auto minmax(0, 1fr);
    gap: 18px;
    align-items: center;
  }

  .cat-mark {
    position: relative;
    width: 86px;
    aspect-ratio: 1;
    border: 3px solid #2e3640;
    border-radius: 8px;
    background: linear-gradient(135deg, #ffd6dd 0 48%, #dff8ee 48% 100%);
    box-shadow: var(--shadow);
    transform: rotate(-2deg);
  }

  .cat-mark::before,
  .cat-mark::after {
    content: "";
    position: absolute;
    top: -17px;
    width: 31px;
    height: 31px;
    border: 3px solid #2e3640;
    border-bottom: 0;
    border-right: 0;
    background: #ffd6dd;
  }

  .cat-mark::before { left: 9px; transform: rotate(45deg); }
  .cat-mark::after { right: 9px; transform: rotate(45deg); background: #dff8ee; }
  .cat-mark span, .cat-mark span::before, .cat-mark span::after { position: absolute; content: ""; }
  .cat-mark span { inset: 0; }

  .cat-mark span::before {
    left: 22px;
    top: 32px;
    width: 9px;
    height: 9px;
    border-radius: 50%;
    background: #26313d;
    box-shadow: 32px 0 0 #26313d, 16px 18px 0 -2px #26313d;
  }

  .cat-mark span::after {
    left: 20px;
    right: 20px;
    top: 56px;
    height: 10px;
    border-bottom: 3px solid #26313d;
    border-radius: 0 0 999px 999px;
  }

  .eyebrow, .panel-kicker, .field span, .stat-card span, .helper-text { letter-spacing: 0; }

  .eyebrow {
    margin: 0 0 5px;
    color: var(--rose-dark);
    font-size: 0.78rem;
    font-weight: 800;
    text-transform: uppercase;
  }

  .hero h1 {
    margin: 0;
    font-size: clamp(2.3rem, 5vw, 4.7rem);
    line-height: 0.96;
  }

  .hero p:last-child {
    max-width: 760px;
    margin: 8px 0 0;
    color: #53606c;
    line-height: 1.65;
  }

  .workspace {
    width: min(1180px, 100%);
    margin: 0 auto;
    display: grid;
    grid-template-columns: minmax(320px, 390px) minmax(0, 1fr);
    gap: 14px;
    align-items: start;
  }

  .panel, .section, .stat-card, .history-item, .output-box, .wasm-result,
  .textarea, .code-strip, .tape-shell, .cell-face, .empty-state {
    border-radius: 8px;
  }

  .panel {
    border: 2px solid #2e3640;
    background: rgba(255, 253, 250, 0.92);
    box-shadow: var(--shadow);
    overflow: hidden;
  }

  .cat-card { position: relative; }

  .cat-card::before {
    content: "";
    position: absolute;
    inset: 0;
    pointer-events: none;
    background-image:
      linear-gradient(90deg, rgba(38, 49, 61, 0.035) 1px, transparent 1px),
      linear-gradient(rgba(38, 49, 61, 0.035) 1px, transparent 1px);
    background-size: 18px 18px;
    opacity: 0.55;
  }

  .panel > * { position: relative; }
  .panel-header { padding: 18px 18px 0; }

  .panel-kicker {
    margin: 0 0 4px;
    color: var(--mint);
    font-size: 0.75rem;
    font-weight: 900;
    text-transform: uppercase;
  }

  .panel-header h2, .section h3 { margin: 0; }
  .panel-header h2 { font-size: 1.35rem; }
  .panel-body { padding: 16px 18px 18px; }

  .stack, .visual-body, .playback-section, .output-stack {
    display: grid;
    gap: 12px;
  }

  .section {
    border: 1px solid var(--line);
    background: rgba(255, 255, 255, 0.72);
    padding: 14px;
  }

  .section-title-row, .visual-header {
    display: flex;
    align-items: flex-start;
    justify-content: space-between;
    gap: 12px;
  }

  .section-title-row { margin-bottom: 10px; }

  .helper-text {
    color: var(--muted);
    font-size: 0.78rem;
    line-height: 1.4;
  }

  .sample-row {
    display: flex;
    flex-wrap: wrap;
    justify-content: flex-end;
    gap: 6px;
  }

  .preset-pill, .primary-button, .secondary-button, .ghost-button {
    min-height: 40px;
    border-radius: 8px;
    font-weight: 900;
    transition: transform 140ms ease, box-shadow 140ms ease, background 140ms ease;
  }

  .preset-pill {
    min-height: 32px;
    padding: 7px 10px;
    border: 1px solid #f0c2cd;
    color: #873a4d;
    background: #fff0f4;
    font-size: 0.78rem;
  }

  .preset-pill:hover, .primary-button:hover, .secondary-button:hover, .ghost-button:hover {
    transform: translateY(-1px);
  }

  .field { display: grid; gap: 7px; }

  .field span, .stat-card span {
    color: var(--muted);
    font-size: 0.74rem;
    font-weight: 800;
    text-transform: uppercase;
  }

  .textarea {
    width: 100%;
    min-height: 134px;
    padding: 12px;
    border: 1px solid #ddc7ae;
    color: var(--ink);
    background: #fffdfa;
    outline: none;
    line-height: 1.55;
    font-family: "SFMono-Regular", Consolas, "Liberation Mono", Menlo, monospace;
    font-size: 0.92rem;
  }

  .textarea:focus {
    border-color: var(--mint);
    box-shadow: 0 0 0 4px rgba(79, 199, 161, 0.2);
  }

  .code-input { min-height: 190px; }

  .control-row {
    display: grid;
    grid-template-columns: repeat(3, minmax(0, 1fr));
    gap: 8px;
  }

  .primary-button {
    color: #1b302b;
    background: #8be8c5;
    box-shadow: 0 8px 0 #2e3640;
  }

  .secondary-button {
    color: #26313d;
    border: 2px solid #2e3640;
    background: #eaf2ff;
  }

  .ghost-button {
    color: #70470f;
    border: 2px solid #f0c367;
    background: #fff2c7;
  }

  .wasm-button { min-width: 118px; }
  input[type="range"] { width: 100%; accent-color: var(--rose); }

  .status {
    min-height: 1.4rem;
    margin: 0;
    color: var(--muted);
    font-size: 0.9rem;
    line-height: 1.45;
  }

  .status.positive, .wasm-result.ready span { color: #227958; }
  .status.error, .wasm-result.error span { color: #b23b55; }

  .stats-grid {
    display: grid;
    grid-template-columns: repeat(2, minmax(0, 1fr));
    gap: 8px;
  }

  .stat-card {
    border: 1px solid #d9c7b5;
    background: #fdf7ef;
    padding: 11px 12px;
  }

  .stat-card strong {
    display: block;
    margin-top: 5px;
    font-variant-numeric: tabular-nums;
  }

  .visual-panel { min-height: 100%; }

  .code-strip {
    display: flex;
    flex-wrap: wrap;
    gap: 7px;
    min-height: 88px;
    padding: 12px;
    border: 1px solid var(--line);
    background: #fffdfa;
  }

  .code-token {
    display: inline-grid;
    place-items: center;
    min-width: 34px;
    min-height: 34px;
    padding: 0 10px;
    border: 1px solid #ddc7ae;
    border-radius: 8px;
    background: #fff4df;
    font-weight: 900;
    user-select: none;
  }

  .code-token.active {
    color: #26313d;
    border-color: #2e3640;
    background: #ffd6dd;
    box-shadow: 0 5px 0 #2e3640;
  }

  .tape-section { display: grid; gap: 10px; }

  .tape-shell {
    min-height: 190px;
    padding: 12px;
    border: 1px solid var(--line);
    background: #f4fff8;
    overflow: hidden;
  }

  .tape-row {
    --visible-cells: 10;
    display: grid;
    grid-template-columns: repeat(var(--visible-cells), minmax(60px, 1fr));
    gap: 8px;
  }

  .cell {
    display: grid;
    gap: 7px;
    min-height: 136px;
    text-align: center;
  }

  .cell-face {
    position: relative;
    display: grid;
    place-items: center;
    min-height: 112px;
    padding: 12px 8px;
    border: 2px solid #ddc7ae;
    background: #fffdfa;
  }

  .cell.pointer .cell-face {
    border-color: #2e3640;
    background: #dff8ee;
    box-shadow: 0 8px 0 #2e3640;
  }

  .cell.pointer .cell-face::before {
    content: "^";
    position: absolute;
    top: 8px;
    right: 8px;
    color: var(--rose-dark);
    font-weight: 900;
  }

  .cell-value {
    display: grid;
    place-items: center;
    min-height: 62px;
    width: 100%;
  }

  .cell-value-digit {
    width: 100%;
    color: var(--ink);
    font-size: 1.45rem;
    font-weight: 900;
    font-variant-numeric: tabular-nums;
  }

  .cell-number {
    color: var(--muted);
    font-size: 0.72rem;
    font-weight: 800;
  }

  .bottom-grid {
    display: grid;
    grid-template-columns: minmax(0, 1fr) minmax(0, 1fr);
    gap: 12px;
  }

  .history-list {
    display: grid;
    gap: 7px;
    max-height: 242px;
    overflow: auto;
    padding-right: 4px;
  }

  .history-item {
    display: grid;
    gap: 4px;
    padding: 10px 12px;
    border: 1px solid var(--line);
    background: #fffdfa;
  }

  .history-item strong { font-size: 0.9rem; }

  .history-item span {
    color: var(--muted);
    font-size: 0.82rem;
    line-height: 1.45;
  }

  .output-box, .wasm-result pre {
    margin: 0;
    min-height: 90px;
    padding: 12px;
    border: 1px solid #ddc7ae;
    background: #26313d;
    color: #fffdfa;
    white-space: pre-wrap;
    word-break: break-word;
    line-height: 1.55;
    font-family: "SFMono-Regular", Consolas, "Liberation Mono", Menlo, monospace;
    font-size: 0.88rem;
  }

  .wasm-result {
    display: grid;
    gap: 8px;
    padding: 10px;
    border: 1px solid var(--line);
    background: #fff7fb;
  }

  .wasm-result span {
    color: var(--muted);
    font-size: 0.84rem;
    font-weight: 800;
  }

  .empty-inline, .empty-state {
    color: var(--muted);
    font-size: 0.9rem;
  }

  .empty-state {
    display: grid;
    place-items: center;
    min-height: 128px;
    padding: 16px;
    border: 1px dashed #d6bfa7;
    background: rgba(255, 253, 250, 0.72);
    text-align: center;
  }

  .compact-empty { min-height: 96px; }

  .tutorial-overlay {
    position: fixed;
    inset: 0;
    z-index: 20;
    display: grid;
    place-items: center;
    padding: 20px;
    background: rgba(38, 49, 61, 0.34);
  }

  .tutorial-modal {
    width: min(430px, 100%);
    border: 2px solid #2e3640;
    border-radius: 8px;
    background: #fffdfa;
    padding: 22px;
    box-shadow: var(--shadow);
  }

  .tutorial-modal h2 { margin: 0 0 8px; }
  .tutorial-modal p { color: var(--muted); line-height: 1.6; }

  .icon-close {
    float: right;
    width: 34px;
    height: 34px;
    border-radius: 8px;
    color: #26313d;
    background: #fff2c7;
    font-weight: 900;
  }

  .tutorial-footer, .dots {
    display: flex;
    align-items: center;
    gap: 8px;
  }

  .tutorial-footer { justify-content: space-between; }

  .dot {
    width: 28px;
    height: 8px;
    border-radius: 8px;
    background: #ead9c5;
  }

  .dot.active { background: var(--rose); }

  @media (max-width: 1060px) {
    .workspace { grid-template-columns: 1fr; }
    .bottom-grid { grid-template-columns: 1fr; }
  }

  @media (max-width: 720px) {
    .page { padding: 18px 12px 28px; }
    .hero { grid-template-columns: 1fr; }
    .cat-mark { width: 74px; }
    .section-title-row, .visual-header { flex-direction: column; }
    .sample-row { justify-content: flex-start; }
    .control-row, .stats-grid { grid-template-columns: 1fr; }
    .tape-row { grid-template-columns: repeat(var(--visible-cells), minmax(54px, 1fr)); }
  }
`;

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
    <div className="cell-value" aria-label={`Cell value ${value}`}>
      <AnimatePresence mode="wait" initial={false}>
        <motion.span
          key={value}
          className="cell-value-digit"
          initial={{ y: 22, opacity: 0, scale: 0.84 }}
          animate={{ y: 0, opacity: 1, scale: 1 }}
          exit={{ y: -22, opacity: 0, scale: 0.84 }}
          transition={{ type: "spring", stiffness: 620, damping: 34 }}
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
      className={`code-token${active ? " active" : ""}`}
      animate={active ? { scale: 1.05, y: -2 } : { scale: 1, y: 0 }}
      transition={{ type: "spring", stiffness: 600, damping: 32 }}
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
      className={`cell${cell.active ? " pointer" : ""}`}
      animate={cell.active ? { y: -4, scale: 1.03 } : { y: 0, scale: 1 }}
      transition={{ type: "spring", stiffness: 520, damping: 34 }}
    >
      <div className="cell-face">
        <CellValue value={cell.value} />
      </div>
      <span className="cell-number">cell {cell.index}</span>
    </motion.div>
  );
}

interface TutorialProps {
  onClose: () => void;
}

function Tutorial({ onClose }: TutorialProps): JSX.Element {
  const [slide, setSlide] = useState(0);
  const slides = [
    ["Paw the code", "Type Brainfuck or pick a sample. Only the eight classic symbols are executed."],
    ["Watch the tape", "Step through each instruction and follow the highlighted cell as values change."],
    ["Ask the WASM cat", "Use Full Run to send the same program to the Rust WebAssembly interpreter."],
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
      className="tutorial-overlay"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      onClick={onClose}
    >
      <motion.div
        className="tutorial-modal cat-card"
        initial={{ scale: 0.95, opacity: 0, y: 20 }}
        animate={{ scale: 1, opacity: 1, y: 0 }}
        exit={{ scale: 0.95, opacity: 0, y: 20 }}
        onClick={(event: MouseEvent) => event.stopPropagation()}
      >
        <button type="button" className="icon-close" onClick={onClose} aria-label="Close tutorial">
          x
        </button>
        <p className="panel-kicker">Tiny tutorial</p>
        <h2>{current[0]}</h2>
        <p>{current[1]}</p>
        <div className="tutorial-footer">
          <div className="dots" aria-label="Tutorial progress">
            {slides.map((item, index) => (
              <button
                key={item[0]}
                type="button"
                className={`dot${index === slide ? " active" : ""}`}
                onClick={() => setSlide(index)}
                aria-label={`Go to slide ${index + 1}`}
              />
            ))}
          </div>
          <button type="button" className="primary-button" onClick={next}>
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
  const [wasmStatus, setWasmStatus] = useState("WASM interpreter is warming up.");
  const [wasmTone, setWasmTone] = useState<WasmTone>("idle");
  const [wasmOutput, setWasmOutput] = useState("");
  const [history, setHistory] = useState<StepResult[]>([]);
  const [renderTick, setRenderTick] = useState(0);
  const [showTutorial, setShowTutorial] = useState(false);
  const [wasmBusy, setWasmBusy] = useState(false);
  const machineRef = useRef<BrainfuckMachine | null>(
    new BrainfuckMachine(DEFAULT_PROGRAM, DEFAULT_INPUT)
  );
  const tapeShellRef = useRef<HTMLElement>(null);
  const tapeWidth = useElementWidth(tapeShellRef);

  useEffect(() => {
    let cancelled = false;

    ensureWasm()
      .then(() => {
        const smokeOutput = interpretWithWasm("+++++[>+++++++++++++<-]>.", "");

        if (smokeOutput !== "A") {
          throw new Error("WASM interpreter connected, but the smoke test returned an unexpected result.");
        }

        if (!cancelled) {
          setWasmStatus("Rust WASM interpreter connected. Smoke test emitted A.");
          setWasmTone("ready");
        }
      })
      .catch((error: unknown) => {
        if (!cancelled) {
          setWasmStatus(error instanceof Error ? error.message : String(error));
          setWasmTone("error");
        }
      });

    if (window.localStorage.getItem("braincrawly_visited") !== "yes") {
      setShowTutorial(true);
      window.localStorage.setItem("braincrawly_visited", "yes");
    }

    return () => {
      cancelled = true;
    };
  }, []);

  const visibleCells = clamp(Math.floor((tapeWidth || 780) / 82), 7, 17);
  const machine = machineRef.current;
  const tapeWindow = machine?.getTapeWindow(visibleCells) ?? null;
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
    }

    setHistory([]);
    setRunning(false);
    setWasmOutput("");
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

  async function handleWasmRun(): Promise<void> {
    setWasmBusy(true);
    setWasmStatus("Rust WASM is running the full program.");
    setWasmTone("idle");

    try {
      const result = await runWasm(program, input);
      setWasmOutput(result);
      setWasmStatus("Full run completed in the Rust WASM interpreter.");
      setWasmTone("ready");
    } catch (error) {
      setWasmOutput("");
      setWasmStatus(error instanceof Error ? error.message : String(error));
      setWasmTone("error");
    } finally {
      setWasmBusy(false);
    }
  }

  return (
    <main className="page">
      <style>{PAGE_STYLES}</style>
      <AnimatePresence>{showTutorial && <Tutorial onClose={() => setShowTutorial(false)} />}</AnimatePresence>

      <section className="hero">
        <div className="cat-mark" aria-hidden="true">
          <span />
        </div>
        <p className="eyebrow">Brainfuck step visualizer</p>
        <h1>BrainCrawly</h1>
        <p>
          A cozy single-page workbench for poking at Brainfuck, watching the tape,
          and asking the Rust WASM interpreter for the final answer.
        </p>
      </section>

      <section className="workspace">
        <aside className="panel controls-panel cat-card">
          <div className="panel-header">
            <p className="panel-kicker">Controls</p>
            <h2>Code nest</h2>
          </div>

          <div className="panel-body stack">
            <section className="section">
              <div className="section-title-row">
                <h3>Program</h3>
                <div className="sample-row">
                  {SAMPLE_PROGRAMS.map((sample) => (
                    <button
                      key={sample.id}
                      type="button"
                      className="preset-pill"
                      onClick={() => loadSample(sample)}
                    >
                      {sample.label}
                    </button>
                  ))}
                </div>
              </div>
              <label className="field">
                <span>Source code</span>
                <textarea
                  className="textarea code-input"
                  value={program}
                  onChange={handleProgramChange}
                  spellCheck="false"
                  rows={9}
                />
              </label>
            </section>

            <section className="section">
              <h3>Input</h3>
              <label className="field">
                <span>Bytes consumed by comma instructions</span>
                <textarea
                  className="textarea"
                  value={input}
                  onChange={handleInputChange}
                  spellCheck="false"
                  rows={3}
                  placeholder="meow"
                />
              </label>
            </section>

            <section className="section playback-section">
              <div className="section-title-row">
                <h3>Playback</h3>
                <span className="helper-text">{speed} ms per step</span>
              </div>
              <input
                type="range"
                min="40"
                max="650"
                step="10"
                value={speed}
                onChange={(event) => setSpeed(Number(event.target.value))}
                aria-label="Step speed"
              />
              <div className="control-row">
                <button type="button" className="primary-button" onClick={handleStep}>
                  Step
                </button>
                <button type="button" className="secondary-button" onClick={handleRunToggle}>
                  {running ? "Pause" : "Run"}
                </button>
                <button type="button" className="ghost-button" onClick={handleReset}>
                  Reset
                </button>
              </div>
              <p className={`status ${statusTone}`}>{status}</p>
            </section>

            <section className="stats-grid">
              {stats.map(([label, value]) => (
                <motion.div key={label} className="stat-card" layout>
                  <span>{label}</span>
                  <strong>{value}</strong>
                </motion.div>
              ))}
            </section>
          </div>
        </aside>

        <section className="panel visual-panel cat-card">
          <div className="panel-header visual-header">
            <div>
              <p className="panel-kicker">Visualization</p>
              <h2>Live execution</h2>
            </div>
            <button
              type="button"
              className="secondary-button wasm-button"
              onClick={handleWasmRun}
              disabled={wasmBusy}
            >
              {wasmBusy ? "Running..." : "Full Run"}
            </button>
          </div>

          <div className="panel-body visual-body">
            <LayoutGroup>
              <section className="section code-section">
                <div className="section-title-row">
                  <h3>Code trace</h3>
                  <span className="helper-text">
                    {machine ? `instruction ${highlightedInstruction ?? 0}` : "waiting for valid code"}
                  </span>
                </div>
                <div className="code-strip" aria-label="Brainfuck code trace">
                  {codeTokens.length > 0 ? (
                    codeTokens.map((token, index) => (
                      <CodeToken
                        key={`${index}-${token}`}
                        token={token}
                        active={index === highlightedInstruction}
                      />
                    ))
                  ) : (
                    <span className="empty-inline">No executable instructions yet.</span>
                  )}
                </div>
              </section>

              <section ref={tapeShellRef} className="section tape-section">
                <div className="section-title-row">
                  <h3>Tape</h3>
                  <span className="helper-text">centered on the pointer</span>
                </div>
                <div className="tape-shell">
                  {machine && tapeWindow ? (
                    <div
                      className="tape-row"
                      style={{ "--visible-cells": visibleCells } as React.CSSProperties}
                    >
                      {tapeWindow.cells.map((cell) => (
                        <TapeCell key={cell.index} cell={cell} />
                      ))}
                    </div>
                  ) : (
                    <div className="empty-state">Fix the program to wake the tape.</div>
                  )}
                </div>
              </section>
            </LayoutGroup>

            <section className="bottom-grid">
              <section className="section">
                <div className="section-title-row">
                  <h3>Step log</h3>
                  <span className="helper-text">latest first</span>
                </div>
                <div className="history-list">
                  {history.length > 0 ? (
                    history.map((entry) => (
                      <motion.article
                        key={`${entry.steps}-${entry.executedPc}-${entry.op}`}
                        className="history-item"
                        initial={{ opacity: 0, x: 18 }}
                        animate={{ opacity: 1, x: 0 }}
                      >
                        <strong>
                          Step {entry.steps} · {entry.op ?? "done"} at pc {(entry.executedPc ?? -1) + 1}
                        </strong>
                        <span>{entry.note}</span>
                      </motion.article>
                    ))
                  ) : (
                    <div className="empty-state compact-empty">No steps yet.</div>
                  )}
                </div>
              </section>

              <section className="section">
                <div className="section-title-row">
                  <h3>Output</h3>
                  <span className="helper-text">stepped vs WASM</span>
                </div>
                <div className="output-stack">
                  <pre className="output-box" aria-live="polite">
                    {outputText.length > 0 ? outputText : "Step output appears here."}
                  </pre>
                  <div className={`wasm-result ${wasmTone}`}>
                    <span>{wasmStatus}</span>
                    <pre>{wasmOutput.length > 0 ? wasmOutput : "Full Run output appears here."}</pre>
                  </div>
                </div>
              </section>
            </section>
          </div>
        </section>
      </section>
    </main>
  );
}
