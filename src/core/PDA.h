#ifndef ZFLAP_PDA_H
#define ZFLAP_PDA_H

#include <string>
#include <vector>
#include <set>
#include <stack>
#include <functional>
#include <optional>

// Represents a single PDA transition:
// (fromState, input, pop) -> (toState, push)
// - input == '\0' means epsilon (do not consume a symbol)
// - pop   == '\0' means no pop  (uncommon in traditional PDAs)
// - push  == ""   means epsilon push (push nothing)
struct PDA_Transition {
    std::string from;
    char input;       // input symbol; '\0' = epsilon
    char pop;         // symbol to pop; '\0' = no pop
    std::string push; // string to push (first char ends up deepest); "" = no push
    std::string to;
};

// Describes one step along an acceptance path.
struct PDA_Step {
    std::string fromState;
    std::string toState;
    char consumed;           // symbol consumed ('\0' if epsilon)
    char popped;             // symbol popped ('\0' if none)
    std::string pushed;      // string pushed ("" if none)
    std::string stackSnapshot; // stack contents after this step (top at left)
    int inputIndex;          // index into the input string after this step
};

class PDA {
public:
    PDA(const std::string &initialState, char initialStackSymbol);

    void addTransition(const PDA_Transition &t);
    void addFinalState(const std::string &s);

    // Returns true if the automaton accepts the input string (non-deterministic DFS).
    // maxSteps prevents infinite loops caused by epsilon cycles.
    // If accepted, outPath is filled with the sequence of steps leading to acceptance.
    bool accepts(const std::string &input, std::vector<PDA_Step> *outPath = nullptr, int maxSteps = 100000);

    // Returns the step at index i from a previously computed path, or nullopt if out of range.
    std::optional<PDA_Step> getStepFromPath(const std::vector<PDA_Step> &path, size_t i) const;

    // Returns a string representation of the stack with the top element first.
    static std::string stackToString(const std::stack<char> &s);

    const std::vector<PDA_Transition>& getTransitions() const { return transitions; }
    char getInitialStackSymbol() const { return initialStackSymbol; }

private:
    std::string initialState;
    char initialStackSymbol;
    std::vector<PDA_Transition> transitions;
    std::set<std::string> finalStates;

    // DFS configuration node.
    struct Config {
        std::string state;
        int inputIndex;
        std::stack<char> stack;
    };

    // Recursive DFS that builds an acceptance path when one is found.
    bool dfs_find(const std::string &input,
                  Config current,
                  std::vector<PDA_Step> &pathSoFar,
                  std::vector<PDA_Step> &resultPath,
                  int &stepsRemaining);
};

#endif // ZFLAP_PDA_H
