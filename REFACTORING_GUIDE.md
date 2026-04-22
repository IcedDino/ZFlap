9`2# ZFlap Refactoring Guide: Core Logic Separation

## Problem Statement

During the initial development, core automaton logic was embedded directly in GUI classes (`AutomatonEditor` and `MainWindow`). This created several issues:

1. **Cannot use automaton logic without Qt/GUI** - The entire validation and state management is locked inside GUI widgets
2. **Cannot test independently** - Core algorithms can't be unit tested without instantiating GUI components
3. **Cannot reuse in CLI tools** - If you wanted a command-line automaton validator, you'd need to extract and duplicate logic
4. **Violates Single Responsibility Principle** - GUI classes handle both presentation AND business logic

## Solution: AutomatonModel Class

We've created a new **`AutomatonModel`** class in `src/core/` that:
- Owns all automaton state (states, transitions, alphabet, etc.)
- Provides all business logic operations (validation, generation, type detection)
- Is **completely independent** of Qt and GUI code
- Can be used in CLI tools, tests, backend services, or any other context

## New Architecture

### Before Refactoring
```
AutomatonEditor (GUI)
├── Manages all state
├── Validates strings
├── Generates strings
├── Detects DFA vs NFA
├── Saves/loads files
└── Also does rendering
```

### After Refactoring
```
AutomatonModel (Core)          AutomatonEditor (GUI)
├── Manages all state     →   ├── Visualizes automaton
├── Validates strings     →   ├── Handles user input
├── Generates strings     →   ├── Updates display
├── Detects DFA vs NFA    →   └── Delegates logic to model
└── Independent of GUI
```

## AutomatonModel API

### State Management
```cpp
AutomatonModel model(AutomatonType::FiniteAutomaton);

// Add/remove states
model.addState("q0");
model.removeState("q1");
model.setInitialState("q0");
model.addFinalState("q2");

// Query states
bool exists = model.hasState("q0");
auto states = model.getStates();
auto finalStates = model.getFinalStates();
```

### Alphabet Management
```cpp
// Define alphabet
model.addSymbol('a');
model.addSymbol('b');
model.setAlphabet({'a', 'b', 'c'});

// Query alphabet
bool inAlphabet = model.isInAlphabet('a');
auto alphabet = model.getAlphabet();
```

### Transitions
```cpp
// Add transitions
model.addTransition("q0", 'a', "q1");
model.addTransition("q1", 'b', "q2");

// Query transitions
auto nextStates = model.getNextStates("q0", 'a');
```

### Validation (Core Logic!)
```cpp
// Validate a string - NO GUI REQUIRED!
ValidationResult result = model.validate("aaab");
if (result.accepted) {
    std::cout << "String accepted!" << std::endl;
    for (const auto& state : result.reachedStates) {
        std::cout << "Reached: " << state << std::endl;
    }
}
```

### String Generation (Core Logic!)
```cpp
// Generate accepted strings - NO GUI REQUIRED!
auto accepted = model.generateAcceptedStrings(5);
for (const auto& str : accepted) {
    std::cout << str << std::endl;
}
```

### Type Detection (Core Logic!)
```cpp
// Determine automaton type - NO GUI REQUIRED!
AutomatonClassification classification = model.classify();
bool isDFA = model.isDeterministic();
bool hasEpsilon = model.hasEpsilonTransitions();
std::string reason = model.getNonDeterminismReason();
```

## How to Use in GUI (Next Step)

The AutomatonEditor class should be refactored to:

1. **Own an `AutomatonModel` instance** instead of managing state directly
2. **Delegate all logic operations** to the model
3. **Only handle visualization and user interaction**

### Example Refactoring Pattern

#### Before (Logic in GUI):
```cpp
// In AutomatonEditor.cpp
void AutomatonEditor::onInstantValidateClicked() {
    QString chain = chainInput->text();
    
    // PROBLEM: Core logic embedded in GUI method
    rebuildTransitionHandler();
    std::string startState = initialState->getName().toStdString();
    auto finalStatesSet = getFinalStates();
    
    bool accepted = esAceptada(transitionHandler, startState, 
                               finalStatesSet, chain.toStdString());
    
    // Update UI
    if (accepted) {
        resultLabel->setText("ACCEPTED");
    } else {
        resultLabel->setText("REJECTED");
    }
}
```

#### After (Logic in Model):
```cpp
// In AutomatonEditor.cpp
void AutomatonEditor::onInstantValidateClicked() {
    QString chain = chainInput->text();
    
    // SOLUTION: Delegate to model
    ValidationResult result = automatonModel->validate(chain.toStdString());
    
    // Only handle UI updates
    if (result.accepted) {
        resultLabel->setText("ACCEPTED");
    } else {
        resultLabel->setText("REJECTED");
    }
}
```

## Benefits

### 1. Testability
```cpp
// You can now write unit tests WITHOUT Qt!
TEST(AutomatonModelTest, ValidateString) {
    AutomatonModel model;
    model.addState("q0");
    model.setInitialState("q0");
    model.addFinalState("q0");
    
    ValidationResult result = model.validate("");
    EXPECT_TRUE(result.accepted);
}
```

### 2. Reusability in CLI Tools
```cpp
// examples/automaton_example.cpp
int main(int argc, char** argv) {
    AutomatonModel model;
    // Load from file, validate strings, etc.
    // NO GUI REQUIRED!
    
    ValidationResult result = model.validate(argv[1]);
    std::cout << (result.accepted ? "ACCEPTED" : "REJECTED") << std::endl;
    return 0;
}
```

### 3. Backend Services
```cpp
// Could be used in a web service
class AutomatonService {
    AutomatonModel model;
    
public:
    json validateString(const std::string& input) {
        ValidationResult result = model.validate(input);
        return {
            {"accepted", result.accepted},
            {"states", result.reachedStates},
            {"message", result.message}
        };
    }
};
```

## Remaining Work

The AutomatonModel foundation is complete. The next steps are:

### High Priority
1. **Refactor AutomatonEditor to use AutomatonModel**
   - Replace `transitionHandler` member with `automatonModel`
   - Remove `rebuildTransitionHandler()` method
   - Delegate all operations to model

2. **Create AutomatonSerializer** for file I/O
   - Move save/load logic from AutomatonEditor
   - Support .zflap format
   - Independent of GUI

3. **Extract symbol validation**
   - Create TransitionValidator class
   - Move validation from GUI event handlers

### Medium Priority
4. **Extract lexer logic from MainWindow**
   - Create LexicalAnalyzer class
   - Separate pattern matching from GUI

5. **Improve Transition class**
   - Add bulk deletion methods
   - Add transition counting
   - Support state renaming

### Low Priority
6. **Integrate with existing Automaton class**
   - Consider merging or replacing Automaton.h/cpp
   - Ensure consistency across codebase

## Migration Path

To migrate existing GUI code:

1. **Add AutomatonModel member** to AutomatonEditor
2. **Keep existing code working** initially
3. **Gradually replace** direct state access with model methods
4. **Remove old code** once model is fully integrated
5. **Add tests** for the now-testable logic

## Example Usage

See `examples/automaton_example.cpp` for a complete working example of using AutomatonModel without any GUI.

## Files Added

- `src/core/AutomatonModel.h` - Core automaton model class header
- `src/core/AutomatonModel.cpp` - Implementation
- `examples/automaton_example.cpp` - Standalone example
- `REFACTORING_GUIDE.md` - This document

## Architecture Diagram

```
┌─────────────────────────────────────────────────────┐
│                   Application Layer                  │
│  ┌──────────────────┐  ┌────────────────────────┐  │
│  │  Qt GUI          │  │  CLI Tools             │  │
│  │  AutomatonEditor │  │  Batch Processors      │  │
│  │  MainWindow      │  │  Testing Framework     │  │
│  └────────┬─────────┘  └──────────┬─────────────┘  │
└───────────┼────────────────────────┼────────────────┘
            │                        │
            └────────────┬───────────┘
                         │ uses
                         ▼
┌─────────────────────────────────────────────────────┐
│              Core Business Logic Layer               │
│  ┌──────────────────────────────────────────────┐  │
│  │          AutomatonModel                      │  │
│  │  • State management                          │  │
│  │  • Transition management                     │  │
│  │  • String validation                         │  │
│  │  • String generation                         │  │
│  │  • Type detection (DFA/NFA)                  │  │
│  │  • Independent of Qt/GUI                     │  │
│  └──────────┬───────────────────────────────────┘  │
│             │ uses                                   │
│  ┌──────────▼──────────┐  ┌────────────────────┐  │
│  │  Transition         │  │  StringValidation  │  │
│  │  PDA                │  │  Alphabet          │  │
│  │  TM                 │  │  Serialization     │  │
│  └─────────────────────┘  └────────────────────┘  │
└─────────────────────────────────────────────────────┘
```

## Questions?

This is a significant architectural improvement that makes your core automaton logic:
- **Testable** - Write unit tests without Qt
- **Reusable** - Use in CLI, web services, etc.
- **Maintainable** - Clear separation of concerns
- **Professional** - Follows industry best practices

The foundation is laid. Now the GUI code can be gradually refactored to use this clean API.
