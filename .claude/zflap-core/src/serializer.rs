use crate::automaton::{AutomatonModel, AutomatonType};
use crate::pda::{Pda, PdaTransition};
use crate::tm::{Direction, Tm, TmTransition};

const EPSILON_CHAR: &str = "ε";

pub fn save(model: &AutomatonModel) -> Result<String, String> {
    let mut lines: Vec<String> = Vec::new();

    lines.push("# ZFlap Automaton File v2.0".into());
    lines.push(format!("Automaton: {}", model.name));

    let alpha: String = model
        .alphabet
        .iter()
        .map(|c| c.to_string())
        .collect::<Vec<_>>()
        .join(" ");
    lines.push(format!("Alphabet: {}", alpha));

    let type_str = match model.automaton_type {
        AutomatonType::FiniteAutomaton => "FiniteAutomaton",
        AutomatonType::StackAutomaton => "StackAutomaton",
        AutomatonType::TuringMachine => "TuringMachine",
    };
    lines.push(format!("Type: {}", type_str));

    if let (AutomatonType::StackAutomaton, Some(pda)) =
        (&model.automaton_type, &model.pda)
    {
        lines.push(format!("InitialStackSymbol: {}", pda.initial_stack_symbol));
    }
    if let (AutomatonType::TuringMachine, Some(tm)) =
        (&model.automaton_type, &model.tm)
    {
        lines.push(format!("BlankSymbol: {}", tm.blank_symbol));
    }

    lines.push(String::new());
    lines.push("[States]".into());
    lines.push("# name,initial,final".into());

    let mut states: Vec<&String> = model.states.iter().collect();
    states.sort();
    for s in states {
        let init = (model.initial_state.as_deref() == Some(s.as_str())) as u8;
        let fin = model.final_states.contains(s.as_str()) as u8;
        lines.push(format!("{},{},{}", s, init, fin));
    }

    lines.push(String::new());
    lines.push("[Transitions]".into());

    match &model.automaton_type {
        AutomatonType::FiniteAutomaton => {
            lines.push("# from,to,symbol".into());
            let mut trans = model.transitions.get_all();
            trans.sort_by(|a, b| a.0.cmp(&b.0).then(a.1.cmp(&b.1)).then(a.2.cmp(&b.2)));
            for (from, sym, to) in &trans {
                let sym_str = if *sym == '\0' {
                    EPSILON_CHAR.to_string()
                } else {
                    sym.to_string()
                };
                lines.push(format!("{},{},{}", from, to, sym_str));
            }
        }
        AutomatonType::StackAutomaton => {
            lines.push("# from,to,input,pop,push".into());
            if let Some(pda) = &model.pda {
                for t in pda.get_transitions() {
                    let inp = t.input.map(|c| c.to_string()).unwrap_or_else(|| EPSILON_CHAR.to_string());
                    let pop = t.pop.map(|c| c.to_string()).unwrap_or_else(|| EPSILON_CHAR.to_string());
                    let push = if t.push.is_empty() { EPSILON_CHAR.to_string() } else { t.push.clone() };
                    lines.push(format!("{},{},{},{},{}", t.from, t.to, inp, pop, push));
                }
            }
        }
        AutomatonType::TuringMachine => {
            lines.push("# from,to,read,write,direction".into());
            if let Some(tm) = &model.tm {
                for t in tm.get_transitions() {
                    let dir = match t.direction {
                        Direction::Left => "L",
                        Direction::Right => "R",
                        Direction::Stay => "S",
                    };
                    lines.push(format!("{},{},{},{},{}", t.from_state, t.to_state, t.read_symbol, t.write_symbol, dir));
                }
            }
        }
    }

    Ok(lines.join("\n"))
}

pub fn load(content: &str) -> Result<AutomatonModel, String> {
    let mut name = String::new();
    let mut alphabet: Vec<char> = Vec::new();
    let mut automaton_type = AutomatonType::FiniteAutomaton;
    let mut initial_stack_symbol = 'Z';
    let mut blank_symbol = 'B';
    let mut raw_states: Vec<(String, bool, bool)> = Vec::new();
    let mut fa_trans: Vec<(String, String, char)> = Vec::new();
    let mut pda_trans: Vec<PdaTransition> = Vec::new();
    let mut tm_trans: Vec<TmTransition> = Vec::new();

    #[derive(PartialEq)]
    enum Section { Header, States, Transitions }
    let mut section = Section::Header;

    for line in content.lines() {
        let line = line.trim();
        if line.is_empty() || line.starts_with('#') {
            continue;
        }

        if line == "[States]" {
            section = Section::States;
            continue;
        }
        if line == "[Transitions]" {
            section = Section::Transitions;
            continue;
        }

        match section {
            Section::Header => {
                if let Some(v) = line.strip_prefix("Automaton: ") {
                    name = v.to_string();
                } else if let Some(v) = line.strip_prefix("Alphabet: ") {
                    alphabet = v.split_whitespace()
                        .filter_map(|s| s.chars().next())
                        .collect();
                } else if let Some(v) = line.strip_prefix("Type: ") {
                    automaton_type = match v {
                        "FiniteAutomaton" => AutomatonType::FiniteAutomaton,
                        "StackAutomaton" => AutomatonType::StackAutomaton,
                        "TuringMachine" => AutomatonType::TuringMachine,
                        other => return Err(format!("Unknown automaton type: {}", other)),
                    };
                } else if let Some(v) = line.strip_prefix("InitialStackSymbol: ") {
                    initial_stack_symbol = v.chars().next()
                        .ok_or("Empty InitialStackSymbol")?;
                } else if let Some(v) = line.strip_prefix("BlankSymbol: ") {
                    blank_symbol = v.chars().next()
                        .ok_or("Empty BlankSymbol")?;
                }
            }
            Section::States => {
                let p: Vec<&str> = line.splitn(3, ',').collect();
                if p.len() < 3 {
                    return Err(format!("Invalid state line: {}", line));
                }
                raw_states.push((p[0].to_string(), p[1] == "1", p[2] == "1"));
            }
            Section::Transitions => {
                match automaton_type {
                    AutomatonType::FiniteAutomaton => {
                        let p: Vec<&str> = line.splitn(3, ',').collect();
                        if p.len() < 3 {
                            return Err(format!("Invalid FA transition: {}", line));
                        }
                        let sym = if p[2] == EPSILON_CHAR { '\0' } else {
                            p[2].chars().next().ok_or_else(|| format!("Empty symbol in: {}", line))?
                        };
                        fa_trans.push((p[0].to_string(), p[1].to_string(), sym));
                    }
                    AutomatonType::StackAutomaton => {
                        let p: Vec<&str> = line.splitn(5, ',').collect();
                        if p.len() < 5 {
                            return Err(format!("Invalid PDA transition: {}", line));
                        }
                        let input = if p[2] == EPSILON_CHAR { None } else {
                            Some(p[2].chars().next().ok_or_else(|| format!("Empty input in: {}", line))?)
                        };
                        let pop = if p[3] == EPSILON_CHAR { None } else {
                            Some(p[3].chars().next().ok_or_else(|| format!("Empty pop in: {}", line))?)
                        };
                        let push = if p[4] == EPSILON_CHAR { String::new() } else { p[4].to_string() };
                        pda_trans.push(PdaTransition {
                            from: p[0].to_string(), to: p[1].to_string(),
                            input, pop, push,
                        });
                    }
                    AutomatonType::TuringMachine => {
                        let p: Vec<&str> = line.splitn(5, ',').collect();
                        if p.len() < 5 {
                            return Err(format!("Invalid TM transition: {}", line));
                        }
                        let dir = match p[4] {
                            "L" => Direction::Left,
                            "R" => Direction::Right,
                            "S" => Direction::Stay,
                            other => return Err(format!("Unknown direction: {}", other)),
                        };
                        tm_trans.push(TmTransition {
                            from_state: p[0].to_string(), to_state: p[1].to_string(),
                            read_symbol: p[2].chars().next().ok_or_else(|| format!("Empty read in: {}", line))?,
                            write_symbol: p[3].chars().next().ok_or_else(|| format!("Empty write in: {}", line))?,
                            direction: dir,
                        });
                    }
                }
            }
        }
    }

    let mut model = AutomatonModel::new(name);
    model.automaton_type = automaton_type.clone();
    model.alphabet = alphabet;

    let mut initial_name: Option<String> = None;
    let mut final_names: Vec<String> = Vec::new();

    for (state, is_init, is_final) in &raw_states {
        model.add_state(state.clone());
        if *is_init {
            model.set_initial_state(state.clone());
            initial_name = Some(state.clone());
        }
        if *is_final {
            model.add_final_state(state.clone());
            final_names.push(state.clone());
        }
    }

    match automaton_type {
        AutomatonType::FiniteAutomaton => {
            for (from, to, sym) in fa_trans {
                model.add_transition(from, sym, to);
            }
        }
        AutomatonType::StackAutomaton => {
            let init = initial_name.unwrap_or_default();
            let mut pda = Pda::new(init, initial_stack_symbol);
            for s in &final_names {
                pda.add_final_state(s.clone());
            }
            for t in pda_trans {
                pda.add_transition(t);
            }
            model.pda = Some(pda);
        }
        AutomatonType::TuringMachine => {
            let init = initial_name.unwrap_or_default();
            let mut tm = Tm::new(init, blank_symbol);
            for s in &final_names {
                tm.add_final_state(s.clone());
            }
            for t in tm_trans {
                tm.add_transition(t);
            }
            model.tm = Some(tm);
        }
    }

    Ok(model)
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_roundtrip_fa() {
        let mut m = AutomatonModel::new("test_fa".into());
        m.add_state("q0".into());
        m.add_state("q1".into());
        m.set_initial_state("q0".into());
        m.add_final_state("q1".into());
        m.set_alphabet(vec!['a', 'b']);
        m.add_transition("q0".into(), 'a', "q1".into());

        let saved = save(&m).unwrap();
        let loaded = load(&saved).unwrap();

        assert_eq!(loaded.name, "test_fa");
        assert!(loaded.states.contains("q0"));
        assert!(loaded.states.contains("q1"));
        assert_eq!(loaded.initial_state.as_deref(), Some("q0"));
        assert!(loaded.final_states.contains("q1"));
        assert!(loaded.validate("a").accepted);
        assert!(!loaded.validate("b").accepted);
    }
}
