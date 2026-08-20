use std::collections::HashSet;

use serde::Serialize;

#[derive(Clone, Debug, PartialEq, Serialize)]
pub enum Direction {
    Left,
    Right,
    Stay,
}

#[derive(Clone, Debug)]
pub struct TmTransition {
    pub from_state: String,
    pub to_state: String,
    pub read_symbol: char,
    pub write_symbol: char,
    pub direction: Direction,
}

#[derive(Clone, Debug, Serialize)]
pub struct TmStep {
    pub from_state: String,
    pub to_state: String,
    pub read_symbol: char,
    pub write_symbol: char,
    pub direction: Direction,
    pub tape_snapshot: String,
    pub head_position: i32,
}

#[derive(Clone, Debug)]
struct TmConfig {
    state: String,
    tape: Vec<char>,
    head: i32,
    offset: i32, // tape[head + offset] is the current cell
}

#[derive(Clone, Debug)]
pub struct Tm {
    initial_state: String,
    pub blank_symbol: char,
    final_states: HashSet<String>,
    transitions: Vec<TmTransition>,
}

impl Tm {
    pub fn new(initial_state: String, blank_symbol: char) -> Self {
        Self {
            initial_state,
            blank_symbol,
            final_states: HashSet::new(),
            transitions: Vec::new(),
        }
    }

    pub fn add_transition(&mut self, t: TmTransition) {
        self.transitions.push(t);
    }

    pub fn add_final_state(&mut self, state: String) {
        self.final_states.insert(state);
    }

    pub fn remove_final_state(&mut self, state: &str) {
        self.final_states.remove(state);
    }

    /// Returns (accepted, execution path). Deterministic simulation.
    pub fn accepts(&self, input: &str, max_steps: usize) -> (bool, Vec<TmStep>) {
        let tape: Vec<char> = if input.is_empty() {
            vec![self.blank_symbol]
        } else {
            input.chars().collect()
        };

        let mut config = TmConfig {
            state: self.initial_state.clone(),
            tape,
            head: 0,
            offset: 0,
        };

        let mut path = Vec::new();

        for _ in 0..max_steps {
            if self.final_states.contains(&config.state) {
                return (true, path);
            }

            self.ensure_capacity(&mut config);
            let idx = (config.head + config.offset) as usize;
            let read = config.tape[idx];

            let trans = self
                .transitions
                .iter()
                .find(|t| t.from_state == config.state && t.read_symbol == read);

            let trans = match trans {
                Some(t) => t.clone(),
                None => return (false, path),
            };

            config.tape[idx] = trans.write_symbol;

            path.push(TmStep {
                from_state: config.state.clone(),
                to_state: trans.to_state.clone(),
                read_symbol: trans.read_symbol,
                write_symbol: trans.write_symbol,
                direction: trans.direction.clone(),
                tape_snapshot: tape_snapshot(&config.tape, config.head, config.offset),
                head_position: config.head,
            });

            config.state = trans.to_state;

            match trans.direction {
                Direction::Left => config.head -= 1,
                Direction::Right => config.head += 1,
                Direction::Stay => {}
            }
        }

        (false, path) // max steps exceeded
    }

    fn ensure_capacity(&self, cfg: &mut TmConfig) {
        while cfg.head + cfg.offset < 0 {
            cfg.tape.insert(0, self.blank_symbol);
            cfg.offset += 1;
        }
        while (cfg.head + cfg.offset) as usize >= cfg.tape.len() {
            cfg.tape.push(self.blank_symbol);
        }
    }

    pub fn get_transitions(&self) -> &[TmTransition] {
        &self.transitions
    }
}

fn tape_snapshot(tape: &[char], head: i32, offset: i32) -> String {
    let mut s = String::new();
    for (i, &c) in tape.iter().enumerate() {
        if i as i32 == head + offset {
            s.push('[');
            s.push(c);
            s.push(']');
        } else {
            s.push(c);
        }
    }
    s
}

#[cfg(test)]
mod tests {
    use super::*;

    /// Builds a TM for a^n b^n using a marking strategy.
    fn anbn_tm() -> Tm {
        // States: q0 (scan right for a), q1 (scan right for b),
        //         q2 (scan left to restart), qf (accept)
        // Symbols: a, b, X (marked a), Y (marked b), B (blank)
        let mut tm = Tm::new("q0".into(), 'B');
        tm.add_final_state("qf".into());

        // q0: find leftmost unmarked 'a', mark it X, go right
        tm.add_transition(TmTransition { from_state: "q0".into(), to_state: "q1".into(), read_symbol: 'a', write_symbol: 'X', direction: Direction::Right });
        // q0: skip over X and Y
        tm.add_transition(TmTransition { from_state: "q0".into(), to_state: "q0".into(), read_symbol: 'X', write_symbol: 'X', direction: Direction::Right });
        tm.add_transition(TmTransition { from_state: "q0".into(), to_state: "q0".into(), read_symbol: 'Y', write_symbol: 'Y', direction: Direction::Right });
        // q0: all a's matched, only Y's left before blank -> accept
        tm.add_transition(TmTransition { from_state: "q0".into(), to_state: "qf".into(), read_symbol: 'B', write_symbol: 'B', direction: Direction::Stay });

        // q1: scan right past a's and Y's to find the leftmost unmarked 'b'
        tm.add_transition(TmTransition { from_state: "q1".into(), to_state: "q1".into(), read_symbol: 'a', write_symbol: 'a', direction: Direction::Right });
        tm.add_transition(TmTransition { from_state: "q1".into(), to_state: "q1".into(), read_symbol: 'Y', write_symbol: 'Y', direction: Direction::Right });
        // q1: mark 'b' as Y, go left
        tm.add_transition(TmTransition { from_state: "q1".into(), to_state: "q2".into(), read_symbol: 'b', write_symbol: 'Y', direction: Direction::Left });

        // q2: scan left back to the beginning (past a's, Y's, X's)
        tm.add_transition(TmTransition { from_state: "q2".into(), to_state: "q2".into(), read_symbol: 'a', write_symbol: 'a', direction: Direction::Left });
        tm.add_transition(TmTransition { from_state: "q2".into(), to_state: "q2".into(), read_symbol: 'Y', write_symbol: 'Y', direction: Direction::Left });
        tm.add_transition(TmTransition { from_state: "q2".into(), to_state: "q2".into(), read_symbol: 'X', write_symbol: 'X', direction: Direction::Left });
        // q2: reached leftmost cell (B or start of tape), go right to q0
        tm.add_transition(TmTransition { from_state: "q2".into(), to_state: "q0".into(), read_symbol: 'B', write_symbol: 'B', direction: Direction::Right });

        tm
    }

    #[test]
    fn test_anbn_accepts() {
        let tm = anbn_tm();
        assert!(tm.accepts("ab", 10_000).0);
        assert!(tm.accepts("aabb", 10_000).0);
        assert!(tm.accepts("aaabbb", 10_000).0);
    }

    #[test]
    fn test_anbn_rejects() {
        let tm = anbn_tm();
        assert!(!tm.accepts("aab", 10_000).0);
        assert!(!tm.accepts("abb", 10_000).0);
        assert!(!tm.accepts("ba", 10_000).0);
    }
}
