pub fn parse_alphabet(input: &str) -> Result<Vec<char>, String> {
    let trimmed = input.trim();
    if !trimmed.starts_with('(') || !trimmed.ends_with(')') {
        return Err("Alphabet must be enclosed in parentheses, e.g. (a,b,c)".to_string());
    }
    let inner = &trimmed[1..trimmed.len() - 1];
    if inner.trim().is_empty() {
        return Ok(vec![]);
    }
    let mut symbols = Vec::new();
    for token in inner.split(',') {
        let sym = token.trim();
        let mut chars = sym.chars();
        let c = chars
            .next()
            .ok_or_else(|| "Empty symbol token".to_string())?;
        if chars.next().is_some() {
            return Err(format!("Symbol '{}' must be a single character", sym));
        }
        if symbols.contains(&c) {
            return Err(format!("Duplicate symbol '{}'", c));
        }
        symbols.push(c);
    }
    Ok(symbols)
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_basic() {
        assert_eq!(parse_alphabet("(a,b,c)").unwrap(), vec!['a', 'b', 'c']);
    }

    #[test]
    fn test_empty() {
        assert_eq!(parse_alphabet("()").unwrap(), vec![]);
    }

    #[test]
    fn test_duplicate() {
        assert!(parse_alphabet("(a,a)").is_err());
    }

    #[test]
    fn test_multi_char_symbol() {
        assert!(parse_alphabet("(ab,c)").is_err());
    }

    #[test]
    fn test_missing_parens() {
        assert!(parse_alphabet("a,b").is_err());
    }
}
