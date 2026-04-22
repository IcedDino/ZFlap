# ZFlap - Automaton Visualization and Simulation

## Overview

ZFlap is a C++17 desktop application for finite automaton theory education and visualization. It provides both a graphical Qt6-based interface and a reusable core library for working with:
- **Finite Automata** (DFA/NFA)
- **Pushdown Automata** (PDA)
- **Turing Machines** (TM)
- **Lexical and Syntactic Analyzers**

## Recent Architecture Improvements

The codebase has been significantly refactored to separate core automaton logic from GUI code:
- ✅ Clean directory structure (`src/core/`, `src/gui/`, `src/utils/`)
- ✅ New `AutomatonModel` class - use automaton logic **without Qt**
- ✅ Consistent English naming (no more mixed languages)
- ✅ Testable core logic independent of GUI
- 📖 See [ARCHITECTURE_IMPROVEMENTS.md](ARCHITECTURE_IMPROVEMENTS.md) for details
- 📖 See [REFACTORING_GUIDE.md](REFACTORING_GUIDE.md) for migration guide

## Features

### GUI Application
- **Visual Automaton Editor**: Drag-and-drop state and transition creation
- **Multiple Automaton Types**: Switch between FA, PDA, and TM
- **String Validation**: Test if strings are accepted
- **String Generation**: Generate accepted strings up to specified length
- **Step-by-Step Simulation**: Visualize automaton execution
- **File I/O**: Save and load automaton definitions
- **Lexical Analysis**: Static lexical analyzer for Java-like syntax

### Core Library (New!)
- **AutomatonModel Class**: Complete automaton logic **independent of Qt**
- **Validation API**: Validate strings programmatically
- **Generation API**: Generate accepted strings
- **Type Detection**: Automatically classify as DFA/NFA/PDA/TM
- **Reusable**: Use in CLI tools, tests, backend services
- **Testable**: Full unit testing without GUI dependencies

## Project Structure

```
ZFlap/
├── src/
│   ├── core/           # Core automaton logic (Qt-independent)
│   │   ├── AutomatonModel.{h,cpp}   # NEW: Main model class
│   │   ├── Transition.{h,cpp}       # Transition function
│   │   ├── Automaton.{h,cpp}        # FA implementation
│   │   ├── PDA.{h,cpp}              # Pushdown Automaton
│   │   └── TM.{h,cpp}               # Turing Machine
│   ├── gui/            # Qt6 GUI components
│   │   ├── MainWindow.{h,cpp}
│   │   ├── AutomatonEditor.{h,cpp}
│   │   └── AlphabetSelector.{h,cpp}
│   ├── utils/          # Utility functions
│   │   ├── StringValidation.{h,cpp}
│   │   ├── Alphabet.{h,cpp}
│   │   └── Lexer.{l,h}
│   └── main.cpp
├── test/               # Unit tests
├── examples/           # Usage examples
└── docs/              # Documentation
```

## Usage Example

### Using AutomatonModel (No GUI Required!)

```cpp
#include "core/AutomatonModel.h"

// Create a DFA that accepts strings ending in "ab"
AutomatonModel automaton(AutomatonType::FiniteAutomaton);

// Add states
automaton.addState("q0");
automaton.addState("q1");
automaton.addState("q2");

// Configure automaton
automaton.setInitialState("q0");
automaton.addFinalState("q2");
automaton.setAlphabet({'a', 'b'});

// Add transitions
automaton.addTransition("q0", 'a', "q1");
automaton.addTransition("q1", 'b', "q2");
// ... more transitions ...

// Validate strings (NO GUI NEEDED!)
ValidationResult result = automaton.validate("aab");
if (result.accepted) {
    std::cout << "String accepted!" << std::endl;
}

// Generate accepted strings (NO GUI NEEDED!)
auto strings = automaton.generateAcceptedStrings(5);
for (const auto& s : strings) {
    std::cout << s << std::endl;
}

// Classify automaton type (NO GUI NEEDED!)
bool isDFA = automaton.isDeterministic();
AutomatonClassification type = automaton.classify();
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
