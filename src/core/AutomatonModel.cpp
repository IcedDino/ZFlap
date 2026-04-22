#include "AutomatonModel.h"
#include "../utils/StringValidation.h"
#include <algorithm>
#include <stdexcept>

AutomatonModel::AutomatonModel() 
    : type(AutomatonType::FiniteAutomaton), pda(nullptr), tm(nullptr) {
}

AutomatonModel::AutomatonModel(AutomatonType t) 
    : type(t), pda(nullptr), tm(nullptr) {
}

AutomatonModel::~AutomatonModel() {
    cleanupSpecializedAutomata();
}

void AutomatonModel::cleanupSpecializedAutomata() {
    delete pda;
    delete tm;
    pda = nullptr;
    tm = nullptr;
}

// === Type Management ===

void AutomatonModel::setType(AutomatonType t) {
    type = t;
    // Clean up specialized automata when switching types
    if (type != AutomatonType::StackAutomaton && pda) {
        delete pda;
        pda = nullptr;
    }
    if (type != AutomatonType::TuringMachine && tm) {
        delete tm;
        tm = nullptr;
    }
}

AutomatonClassification AutomatonModel::classify() const {
    if (states.empty()) {
        return AutomatonClassification::EMPTY;
    }
    
    if (type == AutomatonType::StackAutomaton) {
        return AutomatonClassification::PDA;
    }
    
    if (type == AutomatonType::TuringMachine) {
        return AutomatonClassification::TM;
    }
    
    // For Finite Automata, determine DFA vs NFA
    if (hasEpsilonTransitions()) {
        return AutomatonClassification::NFA_WITH_EPSILON;
    }
    
    if (!isDeterministic()) {
        return AutomatonClassification::NFA;
    }
    
    return AutomatonClassification::DFA;
}

// === State Management ===

void AutomatonModel::addState(const std::string& name) {
    states.insert(name);
}

void AutomatonModel::removeState(const std::string& name) {
    states.erase(name);
    finalStates.erase(name);
    if (initialState == name) {
        initialState.clear();
    }
    removeAllTransitionsFrom(name);
    removeAllTransitionsTo(name);
}

void AutomatonModel::renameState(const std::string& oldName, const std::string& newName) {
    if (!hasState(oldName) || hasState(newName)) {
        return;
    }

    states.erase(oldName);
    states.insert(newName);

    if (initialState == oldName) {
        initialState = newName;
    }

    if (finalStates.count(oldName)) {
        finalStates.erase(oldName);
        finalStates.insert(newName);
    }

    // Rebuild all transitions that reference the old name.
    auto all = transitions.getAllTransitions();
    transitions.removeAllFrom(oldName);
    transitions.removeAllTo(oldName);
    for (const auto& [from, sym, to] : all) {
        std::string newFrom = (from == oldName) ? newName : from;
        std::string newTo   = (to   == oldName) ? newName : to;
        transitions.addTransition(newFrom, sym, newTo);
    }
}

bool AutomatonModel::hasState(const std::string& name) const {
    return states.count(name) > 0;
}

void AutomatonModel::setInitialState(const std::string& name) {
    if (!hasState(name)) {
        throw std::invalid_argument("State does not exist: " + name);
    }
    initialState = name;
}

void AutomatonModel::addFinalState(const std::string& name) {
    if (!hasState(name)) {
        throw std::invalid_argument("State does not exist: " + name);
    }
    finalStates.insert(name);
}

void AutomatonModel::removeFinalState(const std::string& name) {
    finalStates.erase(name);
}

bool AutomatonModel::isFinalState(const std::string& name) const {
    return finalStates.count(name) > 0;
}

// === Alphabet Management ===

void AutomatonModel::setAlphabet(const std::set<char>& a) {
    alphabet = a;
}

void AutomatonModel::addSymbol(char symbol) {
    alphabet.insert(symbol);
}

void AutomatonModel::removeSymbol(char symbol) {
    alphabet.erase(symbol);
    // Collect transitions using this symbol, then remove them.
    auto all = transitions.getAllTransitions();
    for (const auto& [from, sym, to] : all) {
        if (sym == symbol) {
            transitions.removeTransition(from, symbol, to);
        }
    }
}

std::vector<char> AutomatonModel::getAlphabetVector() const {
    return std::vector<char>(alphabet.begin(), alphabet.end());
}

bool AutomatonModel::isInAlphabet(char symbol) const {
    return alphabet.count(symbol) > 0;
}

// === Transition Management ===

void AutomatonModel::addTransition(const std::string& from, char symbol, const std::string& to) {
    if (!hasState(from) || !hasState(to)) {
        throw std::invalid_argument("Invalid state in transition");
    }
    transitions.addTransition(from, symbol, to);
}

void AutomatonModel::removeTransition(const std::string& from, char symbol, const std::string& to) {
    transitions.removeTransition(from, symbol, to);
}

void AutomatonModel::removeAllTransitionsFrom(const std::string& state) {
    transitions.removeAllFrom(state);
}

void AutomatonModel::removeAllTransitionsTo(const std::string& state) {
    transitions.removeAllTo(state);
}

std::vector<std::string> AutomatonModel::getNextStates(const std::string& from, char symbol) const {
    return transitions.getNextStates(from, symbol);
}

// === PDA Operations ===

void AutomatonModel::initializePDA(char initialStackSymbol) {
    if (pda) {
        delete pda;
    }
    if (initialState.empty()) {
        throw std::logic_error("Initial state must be set before initializing PDA");
    }
    pda = new PDA(initialState, initialStackSymbol);
    
    // Add final states to PDA
    for (const auto& state : finalStates) {
        pda->addFinalState(state);
    }
}

void AutomatonModel::addPDATransition(const PDA_Transition& trans) {
    if (!pda) {
        throw std::logic_error("PDA not initialized");
    }
    pda->addTransition(trans);
}

// === TM Operations ===

void AutomatonModel::initializeTM(char blankSymbol) {
    if (tm) {
        delete tm;
    }
    if (initialState.empty()) {
        throw std::logic_error("Initial state must be set before initializing TM");
    }
    
    tm = new TM(initialState, blankSymbol);
    
    // Add final states to TM
    for (const auto& state : finalStates) {
        tm->addFinalState(state);
    }
}

void AutomatonModel::addTMTransition(const std::string& from, char read, 
                                     const std::string& to, char write, char direction) {
    if (!tm) {
        throw std::logic_error("TM not initialized");
    }
    
    TM_Transition trans;
    trans.fromState = from;
    trans.readSymbol = read;
    trans.toState = to;
    trans.writeSymbol = write;
    
    // Convert char direction to enum
    if (direction == 'L' || direction == 'l') {
        trans.moveDirection = TM_MoveDirection::LEFT;
    } else if (direction == 'R' || direction == 'r') {
        trans.moveDirection = TM_MoveDirection::RIGHT;
    } else {
        trans.moveDirection = TM_MoveDirection::STAY;
    }
    
    tm->addTransition(trans);
}

// === Validation ===

ValidationResult AutomatonModel::validate(const std::string& input) const {
    ValidationResult result;
    
    if (initialState.empty()) {
        result.accepted = false;
        result.message = "No initial state defined";
        return result;
    }
    
    if (type == AutomatonType::FiniteAutomaton) {
        // Use StringValidation utility for FA
        result.reachedStates = validateString(transitions, initialState, input);
        
        // Check if any reached state is a final state
        for (const auto& state : result.reachedStates) {
            if (finalStates.count(state) > 0) {
                result.accepted = true;
                result.message = "String accepted";
                return result;
            }
        }
        
        result.accepted = false;
        result.message = "String rejected";
        
    } else if (type == AutomatonType::StackAutomaton && pda) {
        std::vector<PDA_Step> path;
        result.accepted = pda->accepts(input, &path);
        result.message = result.accepted ? "String accepted by PDA" : "String rejected by PDA";
        
    } else if (type == AutomatonType::TuringMachine && tm) {
        std::vector<TM_Step> steps;
        result.accepted = tm->accepts(input, &steps);
        result.message = result.accepted ? "String accepted by TM" : "String rejected by TM";
        
    } else {
        result.accepted = false;
        result.message = "Automaton not properly initialized";
    }
    
    return result;
}

std::vector<std::string> AutomatonModel::generateAcceptedStrings(int maxLength) const {
    if (type != AutomatonType::FiniteAutomaton) {
        return {}; // Only supported for FA currently
    }
    
    if (initialState.empty() || finalStates.empty()) {
        return {};
    }
    
    return ::generateAcceptedStrings(transitions, initialState, finalStates,
                                     getAlphabetVector(), maxLength);
}

std::vector<std::string> AutomatonModel::generateAcceptedStringsWithLimit(
    int maxLength, int cycleLimit) const {
    
    if (type != AutomatonType::FiniteAutomaton) {
        return {};
    }
    
    if (initialState.empty() || finalStates.empty()) {
        return {};
    }
    
    return generateStringsWithLimit(transitions, initialState, finalStates,
                                    getAlphabetVector(), maxLength, cycleLimit);
}

// === Type Detection ===

bool AutomatonModel::isDeterministic() const {
    if (type != AutomatonType::FiniteAutomaton) {
        return false; // PDA and TM are inherently non-deterministic in this implementation
    }
    
    // Check for multiple transitions from same (state, symbol) pair
    for (const auto& state : states) {
        for (char symbol : alphabet) {
            auto nextStates = transitions.getNextStates(state, symbol);
            if (nextStates.size() > 1) {
                return false;
            }
        }
    }
    
    return !hasEpsilonTransitions();
}

bool AutomatonModel::hasEpsilonTransitions() const {
    // Check if there are any epsilon (ε) transitions
    // Epsilon is typically represented as '\0' or a special character
    for (const auto& state : states) {
        auto nextStates = transitions.getNextStates(state, '\0');
        if (!nextStates.empty()) {
            return true;
        }
    }
    return false;
}

std::string AutomatonModel::getNonDeterminismReason() const {
    if (isDeterministic()) {
        return "Automaton is deterministic (DFA)";
    }
    
    if (hasEpsilonTransitions()) {
        return "Contains epsilon (ε) transitions";
    }
    
    // Find which state has multiple transitions
    for (const auto& state : states) {
        for (char symbol : alphabet) {
            auto nextStates = transitions.getNextStates(state, symbol);
            if (nextStates.size() > 1) {
                return "Multiple transitions from state '" + state + 
                       "' on symbol '" + std::string(1, symbol) + "'";
            }
        }
    }
    
    return "Non-deterministic (reason unknown)";
}

// === Utility ===

void AutomatonModel::clear() {
    states.clear();
    initialState.clear();
    finalStates.clear();
    alphabet.clear();
    transitions = Transition(); // Reset transitions
    cleanupSpecializedAutomata();
}

bool AutomatonModel::isEmpty() const {
    return states.empty();
}

size_t AutomatonModel::getTransitionCount() const {
    return transitions.getCount();
}

bool AutomatonModel::isValidState(const std::string& name) const {
    return !name.empty() && hasState(name);
}
