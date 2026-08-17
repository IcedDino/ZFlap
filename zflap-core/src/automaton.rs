use std::collections::HashSet;

use serde::Serialize;

use crate::pda::{Pda, PdaTransition};
use crate::tm::{Tm, TmTransition};
use crate::transition::Transition;
use crate::validation;

#[derive(Clone, Debug, PartialEq)]
pub enum AutomatonType {
    FiniteAutomaton,
    StackAutomaton,
    TuringMachine,
}

#[derive(Clone, Debug, PartialEq, Serialize)]
pub enum AutomatonClassification {
    Dfa,
    Nfa,
    NfaWithEpsilon,
    Pda,
    TuringMachine,
    Empty,
}

#[derive(Clone, Debug, Serialize)]
pub struct ValidationResult {
    pub accepted: bool,
    pub reached_states: Vec<String>, // Vec for serde compatibility
    pub message: String,
}

#[derive(Clone, Debug)]
pub struct AutomatonModel {
    pub name: String,
    pub automaton_type: AutomatonType,
    pub states: HashSet<String>,
    pub initial_state: Option<String>,
    pub final_states: HashSet<String>,
    pub alphabet: Vec<char>,
    pub transitions: Transition,
    pub pda: Option<Pda>,
    pub tm: Option<Tm>,
}

impl AutomatonModel {
    pub fn new(name: String) -> Self {
        Self {
            name,
            automaton_type: AutomatonType::FiniteAutomaton,
            states: HashSet::new(),
            initial_state: None,
            final_states: HashSet::new(),
            alphabet: Vec::new(),
            transitions: Transition::new(),
            pda: None,
            tm: None,
        }
    }

    // ── State management ────────────────────────────────────────────────────

    pub fn add_state(&mut self, state: String) {
        self.states.insert(state);
    }

    pub fn remove_state(&mut self, state: &str) {
        self.states.remove(state);
        if self.initial_state.as_deref() == Some(state) {
            self.initial_state = None;
        }
        self.final_states.remove(state);
        self.transitions.remove_all_from(state);
        self.transitions.remove_all_to(state);
    }

    pub fn rename_state(&mut self, old: &str, new: String) {
        if !self.states.contains(old) {
            return;
        }
        self.states.remove(old);
        self.states.insert(new.clone());

        if self.initial_state.as_deref() == Some(old) {
            self.initial_state = Some(new.clone());
        }
        if self.final_states.remove(old) {
            self.final_states.insert(new.clone());
        }

        let all = self.transitions.get_all();
        self.transitions.clear();
        for (from, sym, to) in all {
            let f = if from == old { new.clone() } else { from };
            let t = if to == old { new.clone() } else { to };
            self.transitions.add(f, sym, t);
        }
    }

    pub fn set_initial_state(&mut self, state: String) {
        self.initial_state = Some(state);
    }

    pub fn add_final_state(&mut self, state: String) {
        self.final_states.insert(state.clone());
        if let Some(pda) = &mut self.pda {
            pda.add_final_state(state.clone());
        }
        if let Some(tm) = &mut self.tm {
            tm.add_final_state(state);
        }
    }

    pub fn remove_final_state(&mut self, state: &str) {
        self.final_states.remove(state);
        if let Some(pda) = &mut self.pda {
            pda.remove_final_state(state);
        }
        if let Some(tm) = &mut self.tm {
            tm.remove_final_state(state);
        }
    }

    // ── Alphabet ─────────────────────────────────────────────────────────────

    pub fn set_alphabet(&mut self, alphabet: Vec<char>) {
        self.alphabet = alphabet;
    }

    pub fn add_symbol(&mut self, c: char) {
        if !self.alphabet.contains(&c) {
            self.alphabet.push(c);
        }
    }

    pub fn remove_symbol(&mut self, c: char) {
        self.alphabet.retain(|&s| s != c);
    }

    // ── Type ──────────────────────────────────────────────────────────────────

    pub fn set_type(&mut self, t: AutomatonType) {
        self.automaton_type = t;
    }

    // ── FA transitions ────────────────────────────────────────────────────────

    pub fn add_transition(&mut self, from: String, symbol: char, to: String) {
        self.transitions.add(from, symbol, to);
    }

    pub fn remove_transition(&mut self, from: &str, symbol: char, to: &str) {
        self.transitions.remove(from, symbol, to);
    }

    // ── PDA ──────────────────────────────────────────────────────────────────

    pub fn init_pda(&mut self, initial_stack_symbol: char) {
        let initial = self.initial_state.clone().unwrap_or_default();
        let mut pda = Pda::new(initial, initial_stack_symbol);
        for s in &self.final_states {
            pda.add_final_state(s.clone());
        }
        self.pda = Some(pda);
        self.automaton_type = AutomatonType::StackAutomaton;
    }

    pub fn add_pda_transition(&mut self, t: PdaTransition) {
        if let Some(pda) = &mut self.pda {
            pda.add_transition(t);
        }
    }

    // ── TM ───────────────────────────────────────────────────────────────────

    pub fn init_tm(&mut self, blank_symbol: char) {
        let initial = self.initial_state.clone().unwrap_or_default();
        let mut tm = Tm::new(initial, blank_symbol);
        for s in &self.final_states {
            tm.add_final_state(s.clone());
        }
        self.tm = Some(tm);
        self.automaton_type = AutomatonType::TuringMachine;
    }

    pub fn add_tm_transition(&mut self, t: TmTransition) {
        if let Some(tm) = &mut self.tm {
            tm.add_transition(t);
        }
    }

    // ── Validation ────────────────────────────────────────────────────────────

    pub fn validate(&self, input: &str) -> ValidationResult {
        match self.automaton_type {
            AutomatonType::FiniteAutomaton => {
                let initial = match &self.initial_state {
                    Some(s) => s,
                    None => {
                        return ValidationResult {
                            accepted: false,
                            reached_states: vec![],
                            message: "No initial state set".into(),
                        }
                    }
                };
                let reached = validation::validate_string(&self.transitions, initial, input);
                let accepted = reached.iter().any(|s| self.final_states.contains(s));
                let mut states: Vec<String> = reached.into_iter().collect();
                states.sort();
                ValidationResult {
                    accepted,
                    reached_states: states,
                    message: if accepted { "Accepted".into() } else { "Rejected".into() },
                }
            }
            AutomatonType::StackAutomaton => match &self.pda {
                None => ValidationResult {
                    accepted: false,
                    reached_states: vec![],
                    message: "PDA not initialized".into(),
                },
                Some(pda) => {
                    let (accepted, _) = pda.accepts(input, 100_000);
                    ValidationResult {
                        accepted,
                        reached_states: vec![],
                        message: if accepted { "Accepted".into() } else { "Rejected".into() },
                    }
                }
            },
            AutomatonType::TuringMachine => match &self.tm {
                None => ValidationResult {
                    accepted: false,
                    reached_states: vec![],
                    message: "TM not initialized".into(),
                },
                Some(tm) => {
                    let (accepted, _) = tm.accepts(input, 100_000);
                    ValidationResult {
                        accepted,
                        reached_states: vec![],
                        message: if accepted { "Accepted".into() } else { "Rejected".into() },
                    }
                }
            },
        }
    }

    // ── Generation ────────────────────────────────────────────────────────────

    pub fn generate_accepted_strings(&self, max_length: usize) -> Vec<String> {
        if self.automaton_type != AutomatonType::FiniteAutomaton {
            return vec![];
        }
        let initial = match &self.initial_state {
            Some(s) => s,
            None => return vec![],
        };
        validation::generate_accepted_strings(
            &self.transitions,
            initial,
            &self.final_states,
            &self.alphabet,
            max_length,
        )
    }

    // ── Classification ────────────────────────────────────────────────────────

    pub fn classify(&self) -> AutomatonClassification {
        match self.automaton_type {
            AutomatonType::TuringMachine => AutomatonClassification::TuringMachine,
            AutomatonType::StackAutomaton => AutomatonClassification::Pda,
            AutomatonType::FiniteAutomaton => {
                if self.states.is_empty() {
                    return AutomatonClassification::Empty;
                }
                if self.transitions.has_epsilon() {
                    return AutomatonClassification::NfaWithEpsilon;
                }
                if self.transitions.is_deterministic() {
                    AutomatonClassification::Dfa
                } else {
                    AutomatonClassification::Nfa
                }
            }
        }
    }

    pub fn is_deterministic(&self) -> bool {
        self.transitions.is_deterministic()
    }

    pub fn has_epsilon_transitions(&self) -> bool {
        self.transitions.has_epsilon()
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_dfa_classification() {
        let mut m = AutomatonModel::new("test".into());
        m.add_state("q0".into());
        m.add_state("q1".into());
        m.set_initial_state("q0".into());
        m.add_final_state("q1".into());
        m.set_alphabet(vec!['a', 'b']);
        m.add_transition("q0".into(), 'a', "q1".into());
        assert_eq!(m.classify(), AutomatonClassification::Dfa);
    }

    #[test]
    fn test_validate_fa() {
        let mut m = AutomatonModel::new("test".into());
        m.add_state("q0".into());
        m.add_state("q1".into());
        m.set_initial_state("q0".into());
        m.add_final_state("q1".into());
        m.add_transition("q0".into(), 'a', "q1".into());

        assert!(m.validate("a").accepted);
        assert!(!m.validate("b").accepted);
        assert!(!m.validate("").accepted);
    }

    #[test]
    fn test_rename_state() {
        let mut m = AutomatonModel::new("test".into());
        m.add_state("q0".into());
        m.add_state("q1".into());
        m.set_initial_state("q0".into());
        m.add_final_state("q1".into());
        m.add_transition("q0".into(), 'a', "q1".into());

        m.rename_state("q0", "start".into());
        assert!(m.states.contains("start"));
        assert!(!m.states.contains("q0"));
        assert_eq!(m.initial_state.as_deref(), Some("start"));
        assert!(m.validate("a").accepted);
    }
}
