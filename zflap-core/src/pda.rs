use std::collections::HashSet;

use serde::Serialize;

#[derive(Clone, Debug)]
pub struct PdaTransition {
    pub from: String,
    pub to: String,
    pub input: Option<char>,  // None = epsilon
    pub pop: Option<char>,    // None = no pop required
    pub push: String,         // "" = push nothing (epsilon)
}

#[derive(Clone, Debug, Serialize)]
pub struct PdaStep {
    pub from_state: String,
    pub to_state: String,
    pub consumed: Option<char>,
    pub popped: Option<char>,
    pub pushed: String,
    pub stack_snapshot: String,
    pub input_index: usize,
}

#[derive(Clone, Debug)]
struct Config {
    state: String,
    input_index: usize,
    stack: Vec<char>,
}

#[derive(Clone, Debug)]
pub struct Pda {
    initial_state: String,
    pub initial_stack_symbol: char,
    final_states: HashSet<String>,
    transitions: Vec<PdaTransition>,
}

impl Pda {
    pub fn new(initial_state: String, initial_stack_symbol: char) -> Self {
        Self {
            initial_state,
            initial_stack_symbol,
            final_states: HashSet::new(),
            transitions: Vec::new(),
        }
    }

    pub fn add_transition(&mut self, t: PdaTransition) {
        self.transitions.push(t);
    }

    pub fn add_final_state(&mut self, state: String) {
        self.final_states.insert(state);
    }

    pub fn remove_final_state(&mut self, state: &str) {
        self.final_states.remove(state);
    }

    /// Returns (accepted, execution path). Uses DFS with backtracking.
    pub fn accepts(&self, input: &str, max_steps: usize) -> (bool, Vec<PdaStep>) {
        let chars: Vec<char> = input.chars().collect();
        let config = Config {
            state: self.initial_state.clone(),
            input_index: 0,
            stack: vec![self.initial_stack_symbol],
        };
        let mut path = Vec::new();
        let mut steps = 0usize;
        let found = self.dfs(&config, &chars, &mut path, max_steps, &mut steps);
        (found, path)
    }

    fn dfs(
        &self,
        config: &Config,
        input: &[char],
        path: &mut Vec<PdaStep>,
        max_steps: usize,
        steps: &mut usize,
    ) -> bool {
        if *steps >= max_steps {
            return false;
        }
        *steps += 1;

        if config.input_index == input.len() && self.final_states.contains(&config.state) {
            return true;
        }

        let top = config.stack.last().copied();

        for trans in &self.transitions {
            if trans.from != config.state {
                continue;
            }

            let input_ok = match trans.input {
                None => true,
                Some(c) => config.input_index < input.len() && input[config.input_index] == c,
            };
            if !input_ok {
                continue;
            }

            let pop_ok = match trans.pop {
                None => true,
                Some(c) => top == Some(c),
            };
            if !pop_ok {
                continue;
            }

            let mut new_stack = config.stack.clone();
            if trans.pop.is_some() {
                new_stack.pop();
            }
            // Push chars in reverse so the first char ends up on top
            for c in trans.push.chars().rev() {
                new_stack.push(c);
            }

            let new_index = if trans.input.is_some() {
                config.input_index + 1
            } else {
                config.input_index
            };

            path.push(PdaStep {
                from_state: config.state.clone(),
                to_state: trans.to.clone(),
                consumed: trans.input,
                popped: trans.pop,
                pushed: trans.push.clone(),
                stack_snapshot: stack_str(&new_stack),
                input_index: new_index,
            });

            let next = Config {
                state: trans.to.clone(),
                input_index: new_index,
                stack: new_stack,
            };

            if self.dfs(&next, input, path, max_steps, steps) {
                return true;
            }

            path.pop();
        }

        false
    }

    pub fn get_transitions(&self) -> &[PdaTransition] {
        &self.transitions
    }
}

fn stack_str(stack: &[char]) -> String {
    stack.iter().rev().collect()
}

#[cfg(test)]
mod tests {
    use super::*;

    /// Builds a PDA for a^n b^n (n >= 1).
    fn anbn_pda() -> Pda {
        // q0: push A for each 'a'
        // q1: pop A for each 'b'
        // q2: final
        // Stack alphabet: Z (bottom), A
        let mut pda = Pda::new("q0".into(), 'Z');
        pda.add_final_state("q2".into());

        // q0 on 'a', top=Z: push AZ (A on top of Z)
        pda.add_transition(PdaTransition {
            from: "q0".into(), to: "q0".into(),
            input: Some('a'), pop: Some('Z'), push: "AZ".into(),
        });
        // q0 on 'a', top=A: push AA
        pda.add_transition(PdaTransition {
            from: "q0".into(), to: "q0".into(),
            input: Some('a'), pop: Some('A'), push: "AA".into(),
        });
        // q0 -> q1 on 'b', top=A: pop A
        pda.add_transition(PdaTransition {
            from: "q0".into(), to: "q1".into(),
            input: Some('b'), pop: Some('A'), push: "".into(),
        });
        // q1 on 'b', top=A: pop A
        pda.add_transition(PdaTransition {
            from: "q1".into(), to: "q1".into(),
            input: Some('b'), pop: Some('A'), push: "".into(),
        });
        // q1 on epsilon, top=Z: go to q2
        pda.add_transition(PdaTransition {
            from: "q1".into(), to: "q2".into(),
            input: None, pop: Some('Z'), push: "Z".into(),
        });

        pda
    }

    #[test]
    fn test_anbn_accepts() {
        let pda = anbn_pda();
        assert!(pda.accepts("ab", 10_000).0);
        assert!(pda.accepts("aabb", 10_000).0);
        assert!(pda.accepts("aaabbb", 10_000).0);
    }

    #[test]
    fn test_anbn_rejects() {
        let pda = anbn_pda();
        assert!(!pda.accepts("aab", 10_000).0);
        assert!(!pda.accepts("abb", 10_000).0);
        assert!(!pda.accepts("", 10_000).0);
        assert!(!pda.accepts("ba", 10_000).0);
    }
}
