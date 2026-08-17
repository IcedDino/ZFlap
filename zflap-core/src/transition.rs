use std::collections::HashMap;

/// Epsilon transition marker — same convention as the C++ `'\0'`.
pub const EPSILON: char = '\0';

#[derive(Clone, Debug, Default)]
pub struct Transition {
    // (from_state, symbol) -> [to_states]
    delta: HashMap<(String, char), Vec<String>>,
}

impl Transition {
    pub fn new() -> Self {
        Self::default()
    }

    pub fn add(&mut self, from: String, symbol: char, to: String) {
        let dests = self.delta.entry((from, symbol)).or_default();
        if !dests.contains(&to) {
            dests.push(to);
        }
    }

    pub fn remove(&mut self, from: &str, symbol: char, to: &str) {
        let key = (from.to_string(), symbol);
        if let Some(dests) = self.delta.get_mut(&key) {
            dests.retain(|s| s != to);
            if dests.is_empty() {
                self.delta.remove(&key);
            }
        }
    }

    pub fn remove_all_from(&mut self, state: &str) {
        self.delta.retain(|(from, _), _| from != state);
    }

    pub fn remove_all_to(&mut self, state: &str) {
        for dests in self.delta.values_mut() {
            dests.retain(|s| s != state);
        }
        self.delta.retain(|_, dests| !dests.is_empty());
    }

    pub fn get_next_states(&self, from: &str, symbol: char) -> Vec<String> {
        self.delta
            .get(&(from.to_string(), symbol))
            .cloned()
            .unwrap_or_default()
    }

    /// Returns every (from, symbol, to) triple.
    pub fn get_all(&self) -> Vec<(String, char, String)> {
        let mut out = Vec::new();
        for ((from, sym), dests) in &self.delta {
            for to in dests {
                out.push((from.clone(), *sym, to.clone()));
            }
        }
        out
    }

    pub fn count(&self) -> usize {
        self.delta.values().map(|v| v.len()).sum()
    }

    pub fn clear(&mut self) {
        self.delta.clear();
    }

    pub fn is_deterministic(&self) -> bool {
        self.delta
            .iter()
            .filter(|((_, sym), _)| *sym != EPSILON)
            .all(|(_, dests)| dests.len() <= 1)
    }

    pub fn has_epsilon(&self) -> bool {
        self.delta.keys().any(|(_, sym)| *sym == EPSILON)
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_add_get() {
        let mut t = Transition::new();
        t.add("q0".into(), 'a', "q1".into());
        assert_eq!(t.get_next_states("q0", 'a'), vec!["q1"]);
    }

    #[test]
    fn test_nfa_multiple_destinations() {
        let mut t = Transition::new();
        t.add("q0".into(), 'a', "q1".into());
        t.add("q0".into(), 'a', "q2".into());
        assert!(!t.is_deterministic());
        let dests = t.get_next_states("q0", 'a');
        assert_eq!(dests.len(), 2);
    }

    #[test]
    fn test_remove() {
        let mut t = Transition::new();
        t.add("q0".into(), 'a', "q1".into());
        t.remove("q0", 'a', "q1");
        assert!(t.get_next_states("q0", 'a').is_empty());
    }
}
