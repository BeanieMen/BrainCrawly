"use client";

import { AnimatePresence, LayoutGroup, motion } from "framer-motion";
import { useEffect, useRef, useState } from "react";

import {
  BrainfuckMachine,
  DEFAULT_INPUT,
  DEFAULT_PROGRAM,
  SAMPLE_PROGRAMS,
} from "../lib/brainfuck";

const HISTORY_LIMIT = 8;
const DEFAULT_SPEED = 180;

function clamp(value, min, max) {
  return Math.min(max, Math.max(min, value));
}

function useElementWidth(ref) {
  const [width, setWidth] = useState(0);

  useEffect(() => {
    const element = ref.current;

    if (!element) {
      return undefined;
    }

    const updateWidth = (nextWidth) => {
      setWidth(nextWidth);
    };

    updateWidth(element.getBoundingClientRect().width);

    const observer = new ResizeObserver((entries) => {
      const entry = entries[0];

      if (entry) {
        updateWidth(entry.contentRect.width);
      }
    });

    observer.observe(element);

    return () => observer.disconnect();
  }, [ref]);

  return width;
}

function formatStatusCount(count) {
  return count.toString().padStart(2, "0");
}

function CellValue({ value }) {
  return (
    <div className="cell-value" aria-label={`Cell value ${value}`}>
      <AnimatePresence mode="wait" initial={false}>
        <motion.span
          key={value}
          className="cell-value-digit"
          initial={{ y: 26, opacity: 0, scale: 0.78, filter: "blur(4px)" }}
          animate={{ y: 0, opacity: 1, scale: 1, filter: "blur(0px)" }}
          exit={{ y: -26, opacity: 0, scale: 0.78, filter: "blur(4px)" }}
          transition={{ type: "spring", stiffness: 640, damping: 34, mass: 0.7 }}
        >
          {value}
        </motion.span>
      </AnimatePresence>
    </div>
  );
}

function CodeToken({ token, active }) {
  return (
    <motion.span
      layout
      className={`code-token${active ? " active" : ""}`}
      animate={active ? { scale: 1.04, y: -2 } : { scale: 1, y: 0 }}
      transition={{ type: "spring", stiffness: 600, damping: 32 }}
    >
      {token}
    </motion.span>
  );
}

function TapeCell({ cell, active }) {
  return (
    <motion.div
      layout
      className={`cell${active ? " pointer" : ""}`}
      animate={active ? { y: -4, scale: 1.03 } : { y: 0, scale: 1 }}
      transition={{ type: "spring", stiffness: 520, damping: 34 }}
    >
      <div className="cell-face">
        <CellValue value={cell.value} />
      </div>
      <span className="cell-number">{cell.index}</span>
    </motion.div>
  );
}

export default function Page() {
  const [program, setProgram] = useState(DEFAULT_PROGRAM);
  const [input, setInput] = useState(DEFAULT_INPUT);
  const [running, setRunning] = useState(false);
  const [speed, setSpeed] = useState(DEFAULT_SPEED);
  const [status, setStatus] = useState("Ready to load the sample program.");
  const [statusTone, setStatusTone] = useState("neutral");
  const [history, setHistory] = useState([]);
  const [renderTick, setRenderTick] = useState(0);

  const machineRef = useRef(new BrainfuckMachine(DEFAULT_PROGRAM, DEFAULT_INPUT));
  const tapeShellRef = useRef(null);
  const tapeWidth = useElementWidth(tapeShellRef);

  const visibleCells = clamp(Math.floor((tapeWidth || 780) / 78), 7, 19);
  const machine = machineRef.current;
  const tapeWindow = machine ? machine.getTapeWindow(visibleCells) : null;
  const codeTokens = Array.from(program).filter((token) => "><+-.,[]".includes(token));
  const highlightedInstruction = machine?.lastExecutedPc ?? machine?.pc ?? null;
  const outputText = machine?.output ?? "";

  function rerender() {
    setRenderTick((value) => value + 1);
  }

  function loadMachine(nextProgram, nextInput, message = "Program loaded.") {
    try {
      machineRef.current = new BrainfuckMachine(nextProgram, nextInput);
      setHistory([]);
      setStatus(message);
      setStatusTone("neutral");
    } catch (error) {
      machineRef.current = null;
      setHistory([]);
      setStatus(error instanceof Error ? error.message : String(error));
      setStatusTone("error");
    }

    setRunning(false);
    rerender();
  }

  function advanceOneStep() {
    const currentMachine = machineRef.current;

    if (!currentMachine) {
      setStatus("Load a valid program before stepping.");
      setStatusTone("error");
      return { advanced: false, done: true };
    }

    if (currentMachine.done) {
      setStatus("Program complete.");
      setStatusTone("neutral");
      return { advanced: false, done: true };
    }

    const step = currentMachine.step();

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

  function handleProgramChange(event) {
    const nextProgram = event.target.value;
    setProgram(nextProgram);
    loadMachine(nextProgram, input, "Program reloaded.");
  }

  function handleInputChange(event) {
    const nextInput = event.target.value;
    setInput(nextInput);
    loadMachine(program, nextInput, "Input reloaded.");
  }

  function handleReset() {
    loadMachine(program, input, "Reset to the beginning.");
  }

  function handleStep() {
    setRunning(false);
    advanceOneStep();
  }

  function handleRunToggle() {
    const currentMachine = machineRef.current;

    if (!currentMachine) {
      setStatus("Load a valid program first.");
      setStatusTone("error");
      return;
    }

    if (currentMachine.done) {
      loadMachine(program, input, "Restarted from the beginning.");
      setRunning(true);
      return;
    }

    const nextRunning = !running;
    setRunning(nextRunning);
    setStatus(nextRunning ? "Running one instruction at a time." : "Paused.");
    setStatusTone("neutral");
  }

  function loadSample(sample) {
    setProgram(sample.program);
    setInput(sample.input);
    loadMachine(sample.program, sample.input, `Loaded ${sample.label}.`);
  }

  const stats = [
    { label: "Steps", value: machine ? formatStatusCount(machine.steps) : "--" },
    { label: "Pointer", value: machine ? formatStatusCount(machine.pointer) : "--" },
    { label: "PC", value: machine ? formatStatusCount(machine.pc) : "--" },
    { label: "Visible cells", value: formatStatusCount(visibleCells) },
  ];

  return (
    <div className="page">
      <main className="shell">
        <motion.section
          className="hero"
          initial={{ opacity: 0, y: 18 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, ease: [0.22, 1, 0.36, 1] }}
        >
          <p className="eyebrow">Brainfuck step visualizer</p>
          <h1 className="title">BrainCrawly</h1>
          <p className="subtitle">
            Step through code one instruction at a time, watch the tape shift like a slot
            machine, and inspect output as the program runs.
          </p>
        </motion.section>

        <section className="workspace">
          <motion.aside
            className="panel controls-panel"
            initial={{ opacity: 0, y: 18 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.65, delay: 0.06, ease: [0.22, 1, 0.36, 1] }}
          >
            <div className="panel-header">
              <p className="panel-kicker">Controls</p>
            </div>

            <div className="panel-body stack">
              <section className="section">
                <div className="section-title-row">
                  <h3 className="section-title">Program</h3>
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
                    className="textarea"
                    value={program}
                    onChange={handleProgramChange}
                    spellCheck="false"
                    rows={10}
                  />
                </label>
              </section>

              <section className="section">
                <h3 className="section-title">Input</h3>
                <label className="field">
                  <span>Bytes consumed by , instructions</span>
                  <textarea
                    className="textarea input-area"
                    value={input}
                    onChange={handleInputChange}
                    spellCheck="false"
                    rows={4}
                    placeholder="BrainCrawly"
                  />
                </label>
              </section>

              <section className="section playback-section">
                <h3 className="section-title">Playback</h3>

                <div className="slider-row">
                  <div className="slider-meta">
                    <span>Step speed</span>
                    <strong>{speed} ms</strong>
                  </div>
                  <input
                    type="range"
                    min="40"
                    max="650"
                    step="10"
                    value={speed}
                    onChange={(event) => setSpeed(Number(event.target.value))}
                  />
                </div>

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
                {stats.map((stat) => (
                  <motion.div key={stat.label} className="stat-card" layout>
                    <span>{stat.label}</span>
                    <strong>{stat.value}</strong>
                  </motion.div>
                ))}
              </section>
            </div>
          </motion.aside>

          <motion.section
            className="panel visual-panel"
            initial={{ opacity: 0, y: 18 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.7, delay: 0.12, ease: [0.22, 1, 0.36, 1] }}
          >
            <div className="panel-header visual-header">
              <div>
                <p className="panel-kicker">Visualization</p>
                <h2>Live execution</h2>
              </div>
            
            </div>

            <div className="panel-body visual-body">
              <LayoutGroup>
                <section className="section code-section">
                  <div className="section-title-row">
                    <h3 className="section-title">Code trace</h3>
                    <span className="helper-text">
                      {machine ? `highlighting instruction ${highlightedInstruction ?? 0}` : "waiting for a valid program"}
                    </span>
                  </div>

                  <div className="code-strip" aria-label="Brainfuck code trace">
                    {codeTokens.length > 0 ? (
                      codeTokens.map((token, index) => (
                        <CodeToken key={`${index}-${token}`} token={token} active={index === highlightedInstruction} />
                      ))
                    ) : (
                      <span className="empty-inline">No executable Brainfuck instructions yet.</span>
                    )}
                  </div>
                </section>

                <section ref={tapeShellRef} className="section tape-section">
                  <div className="section-title-row tape-title-row">
                    <div>
                      <h3 className="section-title">Tape</h3>
                      <span className="helper-text">
                        {machine ? `showing ${visibleCells} cells centered on the pointer` : "load valid code to reveal the tape"}
                      </span>
                    </div>
             
                  </div>

                  <div className="tape-shell">
                    {machine && tapeWindow ? (
                      <div
                        className="tape-row"
                        style={{ "--visible-cells": visibleCells }}
                      >
                        {tapeWindow.cells.map((cell) => (
                          <TapeCell key={cell.index} cell={cell} active={cell.active} />
                        ))}
                      </div>
                    ) : (
                      <div className="empty-state">
                        Fix the program to animate the tape and instruction pointer.
                      </div>
                    )}
                  </div>
                </section>
              </LayoutGroup>

              <section className="bottom-grid">
                <section className="section history-section">
                  <div className="section-title-row">
                    <h3 className="section-title">Step log</h3>
                    <span className="helper-text">latest instruction first</span>
                  </div>

                  <div className="history-list">
                    {history.length > 0 ? (
                      history.map((entry) => (
                        <motion.article
                          key={`${entry.steps}-${entry.executedPc}-${entry.op}`}
                          className="history-item"
                          initial={{ opacity: 0, x: 24, scale: 0.98 }}
                          animate={{ opacity: 1, x: 0, scale: 1 }}
                          transition={{ duration: 0.35, ease: [0.22, 1, 0.36, 1] }}
                        >
                          <strong>
                            Step {entry.steps} · {entry.op ?? "done"} at pc {entry.executedPc + 1}
                          </strong>
                          <span>{entry.note}</span>
                        </motion.article>
                      ))
                    ) : (
                      <div className="empty-state compact-empty">No steps yet.</div>
                    )}
                  </div>
                </section>

                <section className="section output-section">
                  <div className="section-title-row">
                    <h3 className="section-title">Output</h3>
                    <span className="helper-text">bytes emitted by . instructions</span>
                  </div>

                  <pre className="output-box" aria-live="polite">
                    {outputText.length > 0 ? outputText : "Output will appear here after execution."}
                  </pre>
                </section>
              </section>
            </div>
          </motion.section>
        </section>
      </main>
    </div>
  );
}