#include "TM.h"
#include <sstream>
#include <algorithm>

using namespace std;

TM::TM(const std::string &initialState, char blankSymbol)
    : initialState(initialState), blankSymbol(blankSymbol) {}

void TM::addTransition(const TM_Transition &t) {
    transitions.push_back(t);
}

void TM::addFinalState(const std::string &s) {
    finalStates.insert(s);
}

string TM::tapeToString(const vector<char> &tape, int headPos, char blank) {
    stringstream ss;
    for (int i = 0; i < (int)tape.size(); ++i) {
        if (i == headPos) {
            ss << "[" << tape[i] << "]";
        } else {
            ss << tape[i];
        }
    }
    return ss.str();
}

optional<TM_Step> TM::getStepFromPath(const vector<TM_Step> &path, size_t i) const {
    if (i >= path.size()) return nullopt;
    return path[i];
}

void TM::expandTape(vector<char> &tape, int &headPosition, int &tapeOffset) {
    if (headPosition < 0) {
        // Head moved left off the tape — prepend a blank cell.
        tape.insert(tape.begin(), blankSymbol);
        tapeOffset++;
        headPosition = 0;
    } else if (headPosition >= (int)tape.size()) {
        // Head moved right off the tape — append a blank cell.
        tape.push_back(blankSymbol);
    }
}

bool TM::accepts(const std::string &input, std::vector<TM_Step> *outPath, int maxSteps) {
    Config start;
    start.state = initialState;
    start.tape.assign(input.begin(), input.end());
    start.headPosition = 0;
    start.tapeOffset   = 0;

    if (start.tape.empty()) {
        start.tape.push_back(blankSymbol);
    }

    vector<TM_Step> pathSoFar;
    vector<TM_Step> resultPath;
    int stepsRemaining = maxSteps;

    bool found = simulate(start, pathSoFar, resultPath, stepsRemaining);
    if (found && outPath) *outPath = resultPath;
    return found;
}

bool TM::simulate(Config current,
                  vector<TM_Step> &pathSoFar,
                  vector<TM_Step> &resultPath,
                  int &stepsRemaining) {
    if (stepsRemaining-- <= 0) return false; // prevent infinite loops

    if (finalStates.count(current.state)) {
        resultPath = pathSoFar;
        return true;
    }

    // Read the symbol under the head; treat out-of-bounds as blank.
    char currentSymbol = blankSymbol;
    if (current.headPosition >= 0 && current.headPosition < (int)current.tape.size()) {
        currentSymbol = current.tape[current.headPosition];
    }

    for (const auto &t : transitions) {
        bool readMatches = (t.readSymbol == currentSymbol) ||
                           (t.readSymbol == '\0' && currentSymbol == blankSymbol);
        if (t.fromState != current.state || !readMatches) continue;

        Config next = current;
        TM_Step step;
        step.fromState   = current.state;
        step.readSymbol  = currentSymbol;

        // Write symbol.
        next.tape[next.headPosition] = (t.writeSymbol == '\0' ? blankSymbol : t.writeSymbol);
        step.writeSymbol = t.writeSymbol;

        // Move head.
        if      (t.moveDirection == TM_MoveDirection::LEFT)  next.headPosition--;
        else if (t.moveDirection == TM_MoveDirection::RIGHT) next.headPosition++;

        expandTape(next.tape, next.headPosition, next.tapeOffset);

        next.state       = t.toState;
        step.toState     = t.toState;
        step.moveDirection = t.moveDirection;
        step.tapeSnapshot  = tapeToString(next.tape, next.headPosition, blankSymbol);
        step.headPosition  = next.headPosition;

        pathSoFar.push_back(step);
        if (simulate(next, pathSoFar, resultPath, stepsRemaining)) return true;
        pathSoFar.pop_back();
    }

    return false;
}
