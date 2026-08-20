mod alphabet;
mod automaton;
mod pda;
mod serializer;
mod tm;
mod transition;
mod validation;

use automaton::{AutomatonModel, AutomatonType};
use pda::PdaTransition;
use serde::Serialize;
use tm::{Direction, TmTransition};
use wasm_bindgen::prelude::*;

#[wasm_bindgen(start)]
pub fn init() {
    #[cfg(feature = "console_error_panic_hook")]
    console_error_panic_hook::set_once();
}

// ── Helper types for JS serialization ─────────────────────────────────────────

#[derive(Serialize)]
struct TransitionInfo {
    from: String,
    symbol: String,
    to: String,
}

// ── Public WASM API ────────────────────────────────────────────────────────────

#[wasm_bindgen]
pub struct Automaton {
    inner: AutomatonModel,
}

#[wasm_bindgen]
impl Automaton {
    #[wasm_bindgen(constructor)]
    pub fn new(name: &str) -> Automaton {
        Automaton {
            inner: AutomatonModel::new(name.to_string()),
        }
    }

    // ── State management ────────────────────────────────────────────────────

    pub fn add_state(&mut self, state: &str) {
        self.inner.add_state(state.to_string());
    }

    pub fn remove_state(&mut self, state: &str) {
        self.inner.remove_state(state);
    }

    pub fn rename_state(&mut self, old: &str, new_name: &str) {
        self.inner.rename_state(old, new_name.to_string());
    }

    pub fn set_initial_state(&mut self, state: &str) {
        self.inner.set_initial_state(state.to_string());
    }

    pub fn add_final_state(&mut self, state: &str) {
        self.inner.add_final_state(state.to_string());
    }

    pub fn remove_final_state(&mut self, state: &str) {
        self.inner.remove_final_state(state);
    }

    pub fn get_states(&self) -> JsValue {
        let mut states: Vec<&String> = self.inner.states.iter().collect();
        states.sort();
        serde_wasm_bindgen::to_value(&states).unwrap_or(JsValue::NULL)
    }

    pub fn get_initial_state(&self) -> String {
        self.inner.initial_state.clone().unwrap_or_default()
    }

    pub fn get_final_states(&self) -> JsValue {
        let mut states: Vec<&String> = self.inner.final_states.iter().collect();
        states.sort();
        serde_wasm_bindgen::to_value(&states).unwrap_or(JsValue::NULL)
    }

    // ── Alphabet ─────────────────────────────────────────────────────────────

    /// Parses alphabet string in the format "(a,b,c)".
    pub fn set_alphabet(&mut self, input: &str) -> Result<(), JsValue> {
        let symbols = alphabet::parse_alphabet(input).map_err(|e| JsValue::from_str(&e))?;
        self.inner.set_alphabet(symbols);
        Ok(())
    }

    /// Adds a single symbol. Pass a one-character string.
    pub fn add_symbol(&mut self, symbol: &str) -> Result<(), JsValue> {
        let c = symbol.chars().next().ok_or_else(|| JsValue::from_str("Empty symbol"))?;
        self.inner.add_symbol(c);
        Ok(())
    }

    pub fn remove_symbol(&mut self, symbol: &str) -> Result<(), JsValue> {
        let c = symbol.chars().next().ok_or_else(|| JsValue::from_str("Empty symbol"))?;
        self.inner.remove_symbol(c);
        Ok(())
    }

    pub fn get_alphabet(&self) -> JsValue {
        let syms: Vec<String> = self.inner.alphabet.iter().map(|c| c.to_string()).collect();
        serde_wasm_bindgen::to_value(&syms).unwrap_or(JsValue::NULL)
    }

    // ── Automaton type ────────────────────────────────────────────────────────

    /// Valid values: "FiniteAutomaton", "StackAutomaton", "TuringMachine"
    pub fn set_type(&mut self, t: &str) -> Result<(), JsValue> {
        let typ = parse_type(t)?;
        self.inner.set_type(typ);
        Ok(())
    }

    pub fn get_type(&self) -> String {
        match self.inner.automaton_type {
            AutomatonType::FiniteAutomaton => "FiniteAutomaton".into(),
            AutomatonType::StackAutomaton => "StackAutomaton".into(),
            AutomatonType::TuringMachine => "TuringMachine".into(),
        }
    }

    // ── FA transitions ────────────────────────────────────────────────────────

    /// `symbol`: single character, or "" / "ε" for epsilon.
    pub fn add_transition(&mut self, from: &str, symbol: &str, to: &str) {
        let sym = parse_symbol(symbol);
        self.inner.add_transition(from.to_string(), sym, to.to_string());
    }

    pub fn remove_transition(&mut self, from: &str, symbol: &str, to: &str) {
        let sym = parse_symbol(symbol);
        self.inner.remove_transition(from, sym, to);
    }

    /// Returns an array of `{ from, symbol, to }` objects.
    pub fn get_transitions(&self) -> JsValue {
        let infos: Vec<TransitionInfo> = self
            .inner
            .transitions
            .get_all()
            .into_iter()
            .map(|(from, sym, to)| TransitionInfo {
                from,
                symbol: if sym == '\0' { "ε".to_string() } else { sym.to_string() },
                to,
            })
            .collect();
        serde_wasm_bindgen::to_value(&infos).unwrap_or(JsValue::NULL)
    }

    // ── PDA ───────────────────────────────────────────────────────────────────

    /// Call after `set_initial_state` and `add_final_state`.
    pub fn init_pda(&mut self, initial_stack_symbol: &str) -> Result<(), JsValue> {
        let c = initial_stack_symbol.chars().next()
            .ok_or_else(|| JsValue::from_str("Empty initial stack symbol"))?;
        self.inner.init_pda(c);
        Ok(())
    }

    /// `input`: single char or "" for epsilon.
    /// `pop`:   single char or "" for no-pop.
    /// `push`:  string to push (top char is first); "" for epsilon push.
    pub fn add_pda_transition(
        &mut self,
        from: &str,
        to: &str,
        input: &str,
        pop: &str,
        push: &str,
    ) {
        let t = PdaTransition {
            from: from.to_string(),
            to: to.to_string(),
            input: input.chars().next(),
            pop: pop.chars().next(),
            push: push.to_string(),
        };
        self.inner.add_pda_transition(t);
    }

    // ── TM ────────────────────────────────────────────────────────────────────

    /// Call after `set_initial_state` and `add_final_state`.
    pub fn init_tm(&mut self, blank_symbol: &str) -> Result<(), JsValue> {
        let c = blank_symbol.chars().next()
            .ok_or_else(|| JsValue::from_str("Empty blank symbol"))?;
        self.inner.init_tm(c);
        Ok(())
    }

    /// `direction`: "L", "R", or "S".
    pub fn add_tm_transition(
        &mut self,
        from: &str,
        to: &str,
        read: &str,
        write: &str,
        direction: &str,
    ) -> Result<(), JsValue> {
        let r = read.chars().next().ok_or_else(|| JsValue::from_str("Empty read symbol"))?;
        let w = write.chars().next().ok_or_else(|| JsValue::from_str("Empty write symbol"))?;
        let dir = parse_direction(direction)?;
        self.inner.add_tm_transition(TmTransition {
            from_state: from.to_string(),
            to_state: to.to_string(),
            read_symbol: r,
            write_symbol: w,
            direction: dir,
        });
        Ok(())
    }

    // ── Validation ────────────────────────────────────────────────────────────

    /// Returns `{ accepted: bool, reached_states: string[], message: string }`.
    pub fn validate(&self, input: &str) -> JsValue {
        let result = self.inner.validate(input);
        serde_wasm_bindgen::to_value(&result).unwrap_or(JsValue::NULL)
    }

    // ── Classification & info ─────────────────────────────────────────────────

    /// Returns one of: "Dfa", "Nfa", "NfaWithEpsilon", "Pda", "TuringMachine", "Empty".
    pub fn classify(&self) -> String {
        format!("{:?}", self.inner.classify())
    }

    pub fn is_deterministic(&self) -> bool {
        self.inner.is_deterministic()
    }

    pub fn has_epsilon_transitions(&self) -> bool {
        self.inner.has_epsilon_transitions()
    }

    pub fn get_name(&self) -> String {
        self.inner.name.clone()
    }

    pub fn set_name(&mut self, name: &str) {
        self.inner.name = name.to_string();
    }

    // ── String generation ─────────────────────────────────────────────────────

    /// Returns an array of accepted strings up to `max_length`. FA only.
    pub fn generate_accepted_strings(&self, max_length: usize) -> JsValue {
        let strings = self.inner.generate_accepted_strings(max_length);
        serde_wasm_bindgen::to_value(&strings).unwrap_or(JsValue::NULL)
    }

    // ── Serialization ─────────────────────────────────────────────────────────

    pub fn save(&self) -> Result<String, JsValue> {
        serializer::save(&self.inner).map_err(|e| JsValue::from_str(&e))
    }

    pub fn load(content: &str) -> Result<Automaton, JsValue> {
        let model = serializer::load(content).map_err(|e| JsValue::from_str(&e))?;
        Ok(Automaton { inner: model })
    }
}

// ── Standalone utility ─────────────────────────────────────────────────────────

/// Parses an alphabet string like "(a,b,c)" and returns an array of single-char strings.
#[wasm_bindgen]
pub fn parse_alphabet(input: &str) -> Result<JsValue, JsValue> {
    let syms = alphabet::parse_alphabet(input).map_err(|e| JsValue::from_str(&e))?;
    let strings: Vec<String> = syms.iter().map(|c| c.to_string()).collect();
    Ok(serde_wasm_bindgen::to_value(&strings).unwrap_or(JsValue::NULL))
}

// ── Internal helpers ───────────────────────────────────────────────────────────

fn parse_symbol(s: &str) -> char {
    match s {
        "" | "ε" => '\0',
        other => other.chars().next().unwrap_or('\0'),
    }
}

fn parse_direction(s: &str) -> Result<Direction, JsValue> {
    match s {
        "L" | "Left" => Ok(Direction::Left),
        "R" | "Right" => Ok(Direction::Right),
        "S" | "Stay" => Ok(Direction::Stay),
        other => Err(JsValue::from_str(&format!("Unknown direction: {}", other))),
    }
}

fn parse_type(s: &str) -> Result<AutomatonType, JsValue> {
    match s {
        "FiniteAutomaton" => Ok(AutomatonType::FiniteAutomaton),
        "StackAutomaton" => Ok(AutomatonType::StackAutomaton),
        "TuringMachine" => Ok(AutomatonType::TuringMachine),
        other => Err(JsValue::from_str(&format!("Unknown automaton type: {}", other))),
    }
}
