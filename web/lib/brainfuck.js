const TAPE_SIZE = 30000;
const VALID_INSTRUCTIONS = new Set([">", "<", "+", "-", ".", ",", "[", "]"]);
const TEXT_ENCODER = new TextEncoder();

export const DEFAULT_PROGRAM = "++++++++[>++++++++<-]>+.";
export const DEFAULT_INPUT = "";

export const SAMPLE_PROGRAMS = [
  {
    id: "multiply",
    label: "Classic multiply",
    program: DEFAULT_PROGRAM,
    input: DEFAULT_INPUT,
  },
  {
    id: "echo",
    label: "Echo input",
    program: ", [.,]".replace(/\s+/g, ""),
    input: "BrainCrawly",
  },
];

function buildBracketMap(code) {
  const brackets = new Map();
  const stack = [];

  code.forEach((token, index) => {
    if (token === "[") {
      stack.push(index);
      return;
    }

    if (token === "]") {
      const matchingOpen = stack.pop();

      if (matchingOpen === undefined) {
        throw new Error(`Unmatched ']' at instruction ${index + 1}`);
      }

      brackets.set(matchingOpen, index);
      brackets.set(index, matchingOpen);
    }
  });

  if (stack.length > 0) {
    throw new Error(`Unmatched '[' at instruction ${stack.pop() + 1}`);
  }

  return brackets;
}

function describeByte(byte) {
  if (byte === 0) {
    return "0 (\\0)";
  }

  if (byte === 9) {
    return `${byte} (\\t)`;
  }

  if (byte === 10) {
    return `${byte} (\\n)`;
  }

  if (byte === 13) {
    return `${byte} (\\r)`;
  }

  const char = String.fromCharCode(byte);

  if (byte >= 32 && byte <= 126) {
    return `${byte} ('${char.replace(/'/g, "\\'")}')`;
  }

  return String(byte);
}

function describeEmittedChar(byte) {
  if (byte === 0) {
    return "\\0";
  }

  if (byte === 9) {
    return "\\t";
  }

  if (byte === 10) {
    return "\\n";
  }

  if (byte === 13) {
    return "\\r";
  }

  const char = String.fromCharCode(byte);

  if (byte >= 32 && byte <= 126) {
    return `'${char.replace(/'/g, "\\'")}'`;
  }

  return `byte ${byte}`;
}

export class BrainfuckMachine {
  constructor(source, input = "") {
    this.source = source;
    this.inputText = input;
    this.code = Array.from(source).filter((token) => VALID_INSTRUCTIONS.has(token));
    this.brackets = buildBracketMap(this.code);
    this.inputBytes = TEXT_ENCODER.encode(input);
    this.reset();
  }

  reset() {
    this.tape = new Uint8Array(TAPE_SIZE);
    this.pointer = 0;
    this.pc = 0;
    this.steps = 0;
    this.inputIndex = 0;
    this.output = "";
    this.done = this.code.length === 0;
    this.lastExecutedPc = null;
    this.lastNote = this.done ? "Program complete." : "Ready to run.";
  }

  step() {
    if (this.done) {
      this.lastNote = "Program complete.";

      return {
        executedPc: this.pc,
        op: null,
        pointer: this.pointer,
        cellBefore: this.tape[this.pointer],
        cellAfter: this.tape[this.pointer],
        note: this.lastNote,
        steps: this.steps,
        output: this.output,
        done: true,
        nextPc: this.pc,
      };
    }

    const executedPc = this.pc;
    const op = this.code[executedPc];
    const cellBefore = this.tape[this.pointer];
    let nextPc = executedPc + 1;
    let note = "";

    switch (op) {
      case ">":
        if (this.pointer < TAPE_SIZE - 1) {
          this.pointer += 1;
        }

        note = `Moved pointer to cell ${this.pointer}.`;
        break;

      case "<":
        if (this.pointer > 0) {
          this.pointer -= 1;
        }

        note = `Moved pointer to cell ${this.pointer}.`;
        break;

      case "+":
        this.tape[this.pointer] = (this.tape[this.pointer] + 1) & 0xff;
        note = `Cell ${this.pointer} rose from ${cellBefore} to ${this.tape[this.pointer]}.`;
        break;

      case "-":
        this.tape[this.pointer] = (this.tape[this.pointer] + 255) & 0xff;
        note = `Cell ${this.pointer} fell from ${cellBefore} to ${this.tape[this.pointer]}.`;
        break;

      case ".": {
        const emittedByte = this.tape[this.pointer];
        this.output += String.fromCharCode(emittedByte);
        note = `Emitted ${describeEmittedChar(emittedByte)} from cell ${this.pointer}.`;
        break;
      }

      case ",": {
        const nextByte =
          this.inputIndex < this.inputBytes.length
            ? this.inputBytes[this.inputIndex]
            : 0;

        if (this.inputIndex < this.inputBytes.length) {
          this.inputIndex += 1;
        }

        this.tape[this.pointer] = nextByte;
        note = `Read ${describeByte(nextByte)} into cell ${this.pointer}.`;
        break;
      }

      case "[":
        if (this.tape[this.pointer] === 0) {
          const jumpTarget = this.brackets.get(executedPc);

          if (jumpTarget === undefined) {
            throw new Error(`Missing matching ']' for instruction ${executedPc + 1}`);
          }

          nextPc = jumpTarget + 1;
          note = `Cell ${this.pointer} was 0, skipped to instruction ${nextPc}.`;
        } else {
          note = `Cell ${this.pointer} was non-zero, entered loop.`;
        }
        break;

      case "]":
        if (this.tape[this.pointer] !== 0) {
          const jumpTarget = this.brackets.get(executedPc);

          if (jumpTarget === undefined) {
            throw new Error(`Missing matching '[' for instruction ${executedPc + 1}`);
          }

          nextPc = jumpTarget + 1;
          note = `Cell ${this.pointer} was non-zero, jumped back to instruction ${nextPc}.`;
        } else {
          note = `Cell ${this.pointer} was 0, loop finished.`;
        }
        break;

      default:
        note = `Ignored ${op}.`;
    }

    this.steps += 1;
    this.pc = nextPc;
    this.lastExecutedPc = executedPc;
    this.lastNote = note;
    this.done = this.pc >= this.code.length;

    return {
      executedPc,
      op,
      pointer: this.pointer,
      cellBefore,
      cellAfter: this.tape[this.pointer],
      note,
      steps: this.steps,
      output: this.output,
      done: this.done,
      nextPc: this.pc,
    };
  }

  getTapeWindow(visibleCount) {
    const count = Math.max(1, Math.min(visibleCount, TAPE_SIZE));
    let start = Math.max(0, this.pointer - Math.floor(count / 2));

    if (start + count > TAPE_SIZE) {
      start = TAPE_SIZE - count;
    }

    return {
      start,
      end: start + count - 1,
      cells: Array.from({ length: count }, (_, offset) => {
        const index = start + offset;

        return {
          index,
          value: this.tape[index],
          active: index === this.pointer,
        };
      }),
    };
  }
}
