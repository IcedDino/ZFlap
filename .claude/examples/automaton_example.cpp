/**
 * @file automaton_example.cpp
 * @brief Example demonstrating how to use AutomatonModel independently of GUI
 * 
 * This example shows how the refactored core logic can be used:
 * - In command-line tools
 * - In unit tests
 * - In backend services
 * - Without any Qt/GUI dependencies
 */

#include "core/AutomatonModel.h"
#include <iostream>
#include <string>

int main() {
    // Create a simple DFA that accepts strings ending in "ab"
    // Alphabet: {a, b}
    // States: q0 (initial), q1, q2 (final)
    // Transitions:
    //   q0 --a--> q1
    //   q0 --b--> q0
    //   q1 --a--> q1
    //   q1 --b--> q2
    //   q2 --a--> q1
    //   q2 --b--> q0
    
    AutomatonModel automaton(AutomatonType::FiniteAutomaton);
    automaton.setName("Strings ending in 'ab'");
    
    // Add states
    automaton.addState("q0");
    automaton.addState("q1");
    automaton.addState("q2");
    
    // Set initial and final states
    automaton.setInitialState("q0");
    automaton.addFinalState("q2");
    
    // Define alphabet
    automaton.addSymbol('a');
    automaton.addSymbol('b');
    
    // Add transitions
    automaton.addTransition("q0", 'a', "q1");
    automaton.addTransition("q0", 'b', "q0");
    automaton.addTransition("q1", 'a', "q1");
    automaton.addTransition("q1", 'b', "q2");
    automaton.addTransition("q2", 'a', "q1");
    automaton.addTransition("q2", 'b', "q0");
    
    // Classify automaton
    AutomatonClassification classification = automaton.classify();
    std::cout << "Automaton: " << automaton.getName() << std::endl;
    std::cout << "Classification: ";
    switch (classification) {
        case AutomatonClassification::DFA:
            std::cout << "DFA (Deterministic Finite Automaton)" << std::endl;
            break;
        case AutomatonClassification::NFA:
            std::cout << "NFA (Non-deterministic Finite Automaton)" << std::endl;
            break;
        case AutomatonClassification::NFA_WITH_EPSILON:
            std::cout << "NFA with epsilon transitions" << std::endl;
            break;
        default:
            std::cout << "Other" << std::endl;
    }
    
    std::cout << "\nStatistics:" << std::endl;
    std::cout << "  States: " << automaton.getStateCount() << std::endl;
    std::cout << "  Alphabet size: " << automaton.getAlphabetSize() << std::endl;
    std::cout << "  Deterministic: " << (automaton.isDeterministic() ? "Yes" : "No") << std::endl;
    
    // Test some strings
    std::vector<std::string> testStrings = {
        "ab",      // Should accept
        "aab",     // Should accept  
        "bab",     // Should accept
        "abab",    // Should accept
        "a",       // Should reject
        "b",       // Should reject
        "aba",     // Should reject
        "ba"       // Should reject
    };
    
    std::cout << "\nValidation Results:" << std::endl;
    for (const auto& str : testStrings) {
        ValidationResult result = automaton.validate(str);
        std::cout << "  \"" << str << "\": " 
                  << (result.accepted ? "ACCEPTED" : "REJECTED") 
                  << std::endl;
    }
    
    // Generate accepted strings
    std::cout << "\nGenerated accepted strings (up to length 5):" << std::endl;
    auto accepted = automaton.generateAcceptedStrings(5);
    for (const auto& str : accepted) {
        std::cout << "  \"" << (str.empty() ? "ε" : str) << "\"" << std::endl;
    }
    
    return 0;
}
