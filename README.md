# ZFlap - Finite Automaton Transition System

## Overview

ZFlap is a C++ library that provides a flexible implementation of finite automaton transition systems. It supports both deterministic finite automata (DFA) and non-deterministic finite automata (NFA) through a unified interface.

## Features

- **Flexible Transition System**: Support for both DFA and NFA representations
- **Efficient Lookup**: Uses hash maps for O(1) average-case transition lookup
- **Multiple Destinations**: Allows multiple transitions from the same state-symbol pair (NFA support)
- **Modern C++**: Built with C++17 features and standard library containers
- **Comprehensive Testing**: Includes Google Test framework for unit testing

## Architecture

The library consists of three main components:

### TransKey Structure
A lightweight structure that combines a state and input symbol to form a unique key for transition lookup.

### KeyHash Structure
A custom hash function that enables the use of TransKey objects as keys in unordered_map containers.

### Transition Class
The main class that implements the transition function δ: Q × Σ → P(Q), where:
- Q is the set of states
- Σ is the input alphabet
- P(Q) is the power set of Q (set of all possible states)

## Usage Example

```cpp
#include "Transition.h"

// Create a transition system
Transition t;

// Add transitions (supports NFA)
t.addTransition("q0", 'a', "q1");
t.addTransition("q0", 'a', "q2");  // Multiple destinations from same state-symbol
t.addTransition("q1", 'b', "q3");
t.addTransition("q2", 'b', "q3");

// Query transitions
auto nextStates = t.getNextStates("q0", 'a');
// Returns: {"q1", "q2"}

auto noTransition = t.getNextStates("q0", 'c');
// Returns: {} (empty vector)
```

## Building the Project

The project uses CMake for building and includes Google Test for unit testing.

```bash
mkdir build
cd build
cmake ..
make
```

## Running Tests

```bash
./test_transition
```

## API Reference

### Transition Class

#### `void addTransition(const std::string &from, char symbol, const std::string &to)`
Adds a transition from the specified state with the given symbol to the destination state.

**Parameters:**
- `from`: Source state identifier
- `symbol`: Input symbol that triggers the transition
- `to`: Destination state identifier

#### `std::vector<std::string> getNextStates(const std::string &from, char symbol) const`
Retrieves all possible destination states for a given state-symbol pair.

**Parameters:**
- `from`: Source state identifier
- `symbol`: Input symbol

**Returns:**
- Vector of destination state identifiers
- Empty vector if no transition exists

## Design Decisions

1. **NFA Support**: The design allows multiple transitions from the same state-symbol pair, making it suitable for both DFA and NFA representations.

2. **Hash Map Storage**: Uses `std::unordered_map` for efficient O(1) average-case lookup performance.

3. **Vector Destinations**: Uses `std::vector` to store multiple destination states, allowing for easy iteration and modification.

4. **Custom Hash Function**: Implements a custom hash function for the TransKey structure to enable its use as a map key.

## Testing

The project includes comprehensive unit tests covering:
- Single transitions (DFA behavior)
- Multiple transitions from same state-symbol (NFA behavior)
- Missing transitions
- Independent transitions across different states
- Duplicate transition handling
- Edge cases with empty states and special characters

## Future Enhancements

- State validation and error handling
- Transition removal functionality
- Serialization/deserialization support
- Visualization tools for automaton graphs
- Integration with formal language theory algorithms

## License

This project is part of the ZFlap educational initiative for finite automaton implementation and study.
