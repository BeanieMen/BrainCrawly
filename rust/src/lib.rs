use std::collections::HashMap;

use wasm_bindgen::prelude::*;

const TAPE_SIZE: usize = 30_000;

fn filter_code(source: &str) -> Vec<char> {
    source
        .chars()
        .filter(|token| matches!(token, '>' | '<' | '+' | '-' | '.' | ',' | '[' | ']'))
        .collect()
}

fn build_bracket_map(code: &[char]) -> Result<HashMap<usize, usize>, String> {
    let mut brackets = HashMap::new();
    let mut stack = Vec::new();

    for (index, token) in code.iter().enumerate() {
        match token {
            '[' => stack.push(index),
            ']' => {
                let matching_open = stack
                    .pop()
                    .ok_or_else(|| format!("Unmatched ']' at instruction {}", index + 1))?;

                brackets.insert(matching_open, index);
                brackets.insert(index, matching_open);
            }
            _ => {}
        }
    }

    if let Some(unmatched_open) = stack.pop() {
        return Err(format!("Unmatched '[' at instruction {}", unmatched_open + 1));
    }

    Ok(brackets)
}

#[wasm_bindgen]
pub fn interpret(source: &str, input: &str) -> String {
    let code = filter_code(source);

    if code.is_empty() {
        return String::new();
    }

    let brackets = match build_bracket_map(&code) {
        Ok(brackets) => brackets,
        Err(error) => return error,
    };

    let mut tape = vec![0u8; TAPE_SIZE];
    let mut pointer = 0usize;
    let mut pc = 0usize;
    let mut input_bytes = input.bytes();
    let mut output = String::new();

    while pc < code.len() {
        match code[pc] {
            '>' => {
                if pointer < TAPE_SIZE - 1 {
                    pointer += 1;
                }
            }
            '<' => {
                if pointer > 0 {
                    pointer -= 1;
                }
            }
            '+' => {
                tape[pointer] = tape[pointer].wrapping_add(1);
            }
            '-' => {
                tape[pointer] = tape[pointer].wrapping_sub(1);
            }
            '.' => {
                output.push(char::from(tape[pointer]));
            }
            ',' => {
                tape[pointer] = input_bytes.next().unwrap_or(0);
            }
            '[' => {
                if tape[pointer] == 0 {
                    let Some(jump_target) = brackets.get(&pc) else {
                        return format!("Missing matching ']' for instruction {}", pc + 1);
                    };

                    pc = *jump_target;
                }
            }
            ']' => {
                if tape[pointer] != 0 {
                    let Some(jump_target) = brackets.get(&pc) else {
                        return format!("Missing matching '[' for instruction {}", pc + 1);
                    };

                    pc = *jump_target;
                }
            }
            _ => {}
        }

        pc += 1;
    }

    output
}