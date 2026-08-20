#ifndef AUTOMATON_MODEL_H
#define AUTOMATON_MODEL_H

#include <string>
#include <set>
#include <map>
#include <vector>
#include <optional>
#include "Transition.h"
#include "PDA.h"
#include "TM.h"

/**
 * @brief Enum representing the type of automaton
 */
enum class AutomatonType {
    FiniteAutomaton,
    StackAutomaton,  // PDA
    TuringMachine
};

/**
 * @brief Enum for automaton classification
 */
enum class AutomatonClassification {
    DFA,
    NFA,
    NFA_WITH_EPSILON,
    PDA,
    TM,
    EMPTY
};

/**
 * @brief Result of a validation operation
 */
struct ValidationResult {
    bool accepted;
    std::set<std::string> reachedStates;
    std::string message;
};

/**
 * @brief Core automaton model class - owns all automaton state and logic
 * 
 * This class is independent of GUI and can be used in CLI, tests, or any application.
 * It manages the complete state of an automaton and provides all business logic operations.
 */
class AutomatonModel {
public:
    AutomatonModel();
    explicit AutomatonModel(AutomatonType type);
    ~AutomatonModel();

    // === Type Management ===
    void setType(AutomatonType type);
    AutomatonType getType() const { return type; }
    AutomatonClassification classify() const;
    
    // === State Management ===
    void addState(const std::string& name);
    void removeState(const std::string& name);
    void renameState(const std::string& oldName, const std::string& newName);
    bool hasState(const std::string& name) const;
    std::set<std::string> getStates() const { return states; }
    
    void setInitialState(const std::string& name);
    std::string getInitialState() const { return initialState; }
    
    void addFinalState(const std::string& name);
    void removeFinalState(const std::string& name);
    bool isFinalState(const std::string& name) const;
    std::set<std::string> getFinalStates() const { return finalStates; }
    
    // === Alphabet Management ===
    void setAlphabet(const std::set<char>& alphabet);
    void addSymbol(char symbol);
    void removeSymbol(char symbol);
    std::set<char> getAlphabet() const { return alphabet; }
    std::vector<char> getAlphabetVector() const;
    bool isInAlphabet(char symbol) const;
    
    // === Transition Management (Finite Automaton) ===
    void addTransition(const std::string& from, char symbol, const std::string& to);
    void removeTransition(const std::string& from, char symbol, const std::string& to);
    void removeAllTransitionsFrom(const std::string& state);
    void removeAllTransitionsTo(const std::string& state);
    std::vector<std::string> getNextStates(const std::string& from, char symbol) const;
    const Transition& getTransitionHandler() const { return transitions; }
    
    // === PDA Operations ===
    void initializePDA(char initialStackSymbol);
    void addPDATransition(const PDA_Transition& trans);
    PDA* getPDA() { return pda; }
    const PDA* getPDA() const { return pda; }
    
    // === TM Operations ===
    void initializeTM(char blankSymbol);
    void addTMTransition(const std::string& from, char read, 
                        const std::string& to, char write, char direction);
    TM* getTM() { return tm; }
    const TM* getTM() const { return tm; }
    
    // === Validation ===
    ValidationResult validate(const std::string& input) const;
    std::vector<std::string> generateAcceptedStrings(int maxLength) const;
    std::vector<std::string> generateAcceptedStringsWithLimit(int maxLength, int cycleLimit) const;
    
    // === Type Detection ===
    bool isDeterministic() const;
    bool hasEpsilonTransitions() const;
    std::string getNonDeterminismReason() const;
    
    // === Utility ===
    void clear();
    bool isEmpty() const;
    std::string getName() const { return name; }
    void setName(const std::string& n) { name = n; }
    
    // === Statistics ===
    size_t getStateCount() const { return states.size(); }
    size_t getTransitionCount() const;
    size_t getAlphabetSize() const { return alphabet.size(); }

private:
    std::string name;
    AutomatonType type;
    
    // State information
    std::set<std::string> states;
    std::string initialState;
    std::set<std::string> finalStates;
    
    // Alphabet
    std::set<char> alphabet;
    
    // Transitions (for Finite Automata)
    Transition transitions;
    
    // Specialized automata
    PDA* pda;
    TM* tm;
    
    // Helper methods
    void cleanupSpecializedAutomata();
    bool isValidState(const std::string& name) const;
};

#endif // AUTOMATON_MODEL_H
