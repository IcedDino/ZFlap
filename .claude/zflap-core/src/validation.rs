use std::collections::{HashMap, HashSet, VecDeque};

use crate::transition::{Transition, EPSILON};

/// BFS over (state, input_position) pairs. Returns the set of states reachable
/// after consuming all of `input`, including states reachable via epsilon transitions.
pub fn validate_string(t: &Transition, initial_state: &str, input: &str) -> HashSet<String> {
    let chars: Vec<char> = input.chars().collect();
    let mut queue: VecDeque<(String, usize)> = VecDeque::new();
    let mut visited: HashSet<(String, usize)> = HashSet::new();
    let mut reached: HashSet<String> = HashSet::new();

    queue.push_back((initial_state.to_string(), 0));

    while let Some((state, pos)) = queue.pop_front() {
        if !visited.insert((state.clone(), pos)) {
            continue;
        }

        // Epsilon transitions — don't advance input position
        for next in t.get_next_states(&state, EPSILON) {
            queue.push_back((next, pos));
        }

        if pos == chars.len() {
            reached.insert(state);
        } else {
            for next in t.get_next_states(&state, chars[pos]) {
                queue.push_back((next, pos + 1));
            }
        }
    }

    reached
}

pub fn is_accepted(
    t: &Transition,
    initial_state: &str,
    final_states: &HashSet<String>,
    input: &str,
) -> bool {
    validate_string(t, initial_state, input)
        .iter()
        .any(|s| final_states.contains(s))
}

/// BFS string generation up to `max_length`. Limits cycles to `CYCLE_LIMIT`
/// visits of any state per path to avoid infinite loops.
pub fn generate_accepted_strings(
    t: &Transition,
    initial_state: &str,
    final_states: &HashSet<String>,
    alphabet: &[char],
    max_length: usize,
) -> Vec<String> {
    const CYCLE_LIMIT: usize = 2;

    // Queue item: (current_state, built_string, per-path visit counts)
    type VisitMap = HashMap<String, usize>;
    let mut queue: VecDeque<(String, String, VisitMap)> = VecDeque::new();
    let mut result: Vec<String> = Vec::new();

    let mut init_visits = VisitMap::new();
    init_visits.insert(initial_state.to_string(), 1);
    queue.push_back((initial_state.to_string(), String::new(), init_visits));

    while let Some((state, current, visits)) = queue.pop_front() {
        if final_states.contains(&state) && !result.contains(&current) {
            result.push(current.clone());
        }

        if current.len() >= max_length {
            continue;
        }

        for &sym in alphabet {
            for next in t.get_next_states(&state, sym) {
                let count = visits.get(&next).copied().unwrap_or(0);
                if count < CYCLE_LIMIT {
                    let mut new_visits = visits.clone();
                    *new_visits.entry(next.clone()).or_insert(0) += 1;
                    let mut new_str = current.clone();
                    new_str.push(sym);
                    queue.push_back((next, new_str, new_visits));
                }
            }
        }
    }

    result
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::transition::Transition;

    fn simple_dfa() -> (Transition, HashSet<String>) {
        // Accepts strings ending with 'a': q0 -a-> q1 (final), q1 -b-> q0
        let mut t = Transition::new();
        t.add("q0".into(), 'a', "q1".into());
        t.add("q1".into(), 'b', "q0".into());
        let finals: HashSet<String> = ["q1".to_string()].into();
        (t, finals)
    }

    #[test]
    fn test_accepts_simple() {
        let (t, finals) = simple_dfa();
        assert!(is_accepted(&t, "q0", &finals, "a"));
        assert!(is_accepted(&t, "q0", &finals, "aba"));
        assert!(!is_accepted(&t, "q0", &finals, "ab"));
        assert!(!is_accepted(&t, "q0", &finals, ""));
    }

    #[test]
    fn test_generate() {
        let (t, finals) = simple_dfa();
        let strings = generate_accepted_strings(&t, "q0", &finals, &['a', 'b'], 4);
        assert!(strings.contains(&"a".to_string()));
        assert!(strings.contains(&"aba".to_string()));
        assert!(!strings.contains(&"ab".to_string()));
    }
}
