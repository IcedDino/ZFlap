#include "PDA.h"
#include <algorithm>

using namespace std;

PDA::PDA(const std::string &initialState, char initialStackSymbol)
    : initialState(initialState), initialStackSymbol(initialStackSymbol) {}

void PDA::addTransition(const PDA_Transition &t) {
    transitions.push_back(t);
}

void PDA::addFinalState(const std::string &s) {
    finalStates.insert(s);
}

string PDA::stackToString(const stack<char> &s) {
    stack<char> tmp = s;
    string out;
    while (!tmp.empty()) {
        out.push_back(tmp.top());
        tmp.pop();
    }
    return out; // top..bottom
}

optional<PDA_Step> PDA::getStepFromPath(const vector<PDA_Step> &path, size_t i) const {
    if (i >= path.size()) return nullopt;
    return path[i];
}

bool PDA::accepts(const std::string &input, std::vector<PDA_Step> *outPath, int maxSteps) {
    Config start;
    start.state = initialState;
    start.inputIndex = 0;
    start.stack = std::stack<char>();
    start.stack.push(initialStackSymbol);

    vector<PDA_Step> pathSoFar;
    vector<PDA_Step> resultPath;
    int stepsRemaining = maxSteps;

    bool found = dfs_find(input, start, pathSoFar, resultPath, stepsRemaining);
    if (found && outPath) *outPath = resultPath;
    return found;
}

bool PDA::dfs_find(const std::string &input,
                   Config current,
                   vector<PDA_Step> &pathSoFar,
                   vector<PDA_Step> &resultPath,
                   int &stepsRemaining) {
    if (stepsRemaining-- <= 0) return false; // guard against infinite epsilon cycles

    // Accept if all input consumed and in a final state.
    if ((int)current.inputIndex == (int)input.size() && finalStates.count(current.state)) {
        resultPath = pathSoFar;
        return true;
    }

    for (const auto &t : transitions) {
        if (t.from != current.state) continue;

        // Check whether the input symbol matches (or is epsilon).
        bool inputMatches = (t.input == '\0') ||
                            (current.inputIndex < (int)input.size() &&
                             input[current.inputIndex] == t.input);
        if (!inputMatches) continue;

        // Check and perform pop.
        std::stack<char> newStack = current.stack;
        char popped = '\0';
        if (t.pop != '\0') {
            if (newStack.empty() || newStack.top() != t.pop) continue;
            popped = newStack.top();
            newStack.pop();
        }

        // Perform push: the first character of push ends up deepest,
        // so we push in reverse order.
        for (auto it = t.push.rbegin(); it != t.push.rend(); ++it) {
            newStack.push(*it);
        }

        PDA_Step step;
        step.fromState   = current.state;
        step.toState     = t.to;
        step.consumed    = t.input;
        step.popped      = popped;
        step.pushed      = t.push;
        step.inputIndex  = current.inputIndex + (t.input == '\0' ? 0 : 1);
        step.stackSnapshot = stackToString(newStack);

        Config next;
        next.state      = t.to;
        next.inputIndex = step.inputIndex;
        next.stack      = newStack;

        pathSoFar.push_back(step);
        if (dfs_find(input, next, pathSoFar, resultPath, stepsRemaining)) return true;
        pathSoFar.pop_back();
    }

    return false;
}
