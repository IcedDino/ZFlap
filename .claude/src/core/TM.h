#ifndef ZFLAP_TM_H
#define ZFLAP_TM_H

#include <string>
#include <vector>
#include <set>
#include <optional>
#include <map>

// Head movement direction.
enum class TM_MoveDirection {
    LEFT,
    RIGHT,
    STAY
};

// Represents a single TM transition:
// (fromState, readSymbol) -> (toState, writeSymbol, moveDirection)
struct TM_Transition {
    std::string fromState;
    char readSymbol;
    std::string toState;
    char writeSymbol;
    TM_MoveDirection moveDirection;

    bool operator<(const TM_Transition& other) const {
        if (fromState  != other.fromState)  return fromState  < other.fromState;
        if (readSymbol != other.readSymbol) return readSymbol < other.readSymbol;
        if (toState    != other.toState)    return toState    < other.toState;
        if (writeSymbol!= other.writeSymbol)return writeSymbol< other.writeSymbol;
        return moveDirection < other.moveDirection;
    }
};

// Describes one step of a TM execution.
struct TM_Step {
    std::string fromState;
    std::string toState;
    char readSymbol;
    char writeSymbol;
    TM_MoveDirection moveDirection;
    std::string tapeSnapshot; // tape contents with head position marked by brackets
    int headPosition;         // 0-indexed head position in the snapshot
};

class TM {
public:
    TM(const std::string &initialState, char blankSymbol);

    void addTransition(const TM_Transition &t);
    void addFinalState(const std::string &s);

    // Simulates the TM and returns true if the input is accepted.
    // maxSteps prevents infinite loops.
    // If accepted, outPath is filled with the sequence of execution steps.
    bool accepts(const std::string &input, std::vector<TM_Step> *outPath = nullptr, int maxSteps = 100000);

    // Returns the step at index i from a previously computed path, or nullopt if out of range.
    std::optional<TM_Step> getStepFromPath(const std::vector<TM_Step> &path, size_t i) const;

    // Returns a human-readable tape string with the head position wrapped in brackets.
    static std::string tapeToString(const std::vector<char> &tape, int headPos, char blank);

    const std::vector<TM_Transition>& getTransitions() const { return transitions; }
    char getBlankSymbol() const { return blankSymbol; }

private:
    std::string initialState;
    char blankSymbol;
    std::vector<TM_Transition> transitions;
    std::set<std::string> finalStates;

    // Simulation configuration.
    struct Config {
        std::string state;
        std::vector<char> tape;
        int headPosition; // logical 0-indexed position
        int tapeOffset;   // offset of logical position 0 within the physical vector
    };

    // Expands the tape when the head moves beyond either end.
    void expandTape(std::vector<char> &tape, int &headPosition, int &tapeOffset);

    // Recursive simulation; builds an acceptance path when one is found.
    bool simulate(Config current,
                  std::vector<TM_Step> &pathSoFar,
                  std::vector<TM_Step> &resultPath,
                  int &stepsRemaining);
};

#endif // ZFLAP_TM_H
