#include "StringValidation.h"
#include <queue>
#include <map>
#include <set>

using namespace std;

// BFS exploration node: tracks current state and position in the input string.
struct ExplorationState {
    string state;
    int position;

    bool operator<(const ExplorationState &other) const {
        if (state != other.state) return state < other.state;
        return position < other.position;
    }
};

set<string> validateString(const Transition &t,
                            const string &initialState,
                            const string &input) {
    set<string> reachedStates;
    set<ExplorationState> visited;
    queue<ExplorationState> q;

    q.push({initialState, 0});
    visited.insert({initialState, 0});

    while (!q.empty()) {
        ExplorationState current = q.front();
        q.pop();

        // Processed the entire input — this state was reached.
        if (current.position == (int)input.size()) {
            reachedStates.insert(current.state);
            continue;
        }

        char symbol = input[current.position];
        vector<string> next = t.getNextStates(current.state, symbol);

        for (const string &nextState : next) {
            ExplorationState node = {nextState, current.position + 1};
            if (visited.find(node) == visited.end()) {
                visited.insert(node);
                q.push(node);
            }
        }
    }

    return reachedStates;
}

bool isAccepted(const Transition &t,
                const string &initialState,
                const set<string> &finalStates,
                const string &input) {
    set<string> reached = validateString(t, initialState, input);
    for (const string &state : reached) {
        if (finalStates.count(state) > 0) return true;
    }
    return false;
}

vector<string> generateAcceptedStrings(const Transition &t,
                                        const string &initialState,
                                        const set<string> &finalStates,
                                        const vector<char> &alphabet,
                                        int maxLength) {
    vector<string> accepted;
    queue<pair<string, string>> q; // (current state, string built so far)

    if (finalStates.count(initialState) > 0) {
        accepted.push_back("");
    }

    q.push({initialState, ""});

    while (!q.empty()) {
        auto [currentState, current] = q.front();
        q.pop();

        if ((int)current.size() >= maxLength) continue;

        for (char symbol : alphabet) {
            vector<string> next = t.getNextStates(currentState, symbol);
            for (const string &nextState : next) {
                string newString = current + symbol;
                if (finalStates.count(nextState) > 0) {
                    accepted.push_back(newString);
                }
                if ((int)newString.size() < maxLength) {
                    q.push({nextState, newString});
                }
            }
        }
    }

    return accepted;
}

vector<string> generateStringsWithLimit(const Transition &t,
                                         const string &initialState,
                                         const set<string> &finalStates,
                                         const vector<char> &alphabet,
                                         int maxLength,
                                         int cycleLimit) {
    vector<string> accepted;

    struct Node {
        string state;
        string built;
        map<string, int> visits;
    };

    queue<Node> q;

    if (finalStates.count(initialState) > 0) {
        accepted.push_back("");
    }

    Node start;
    start.state = initialState;
    start.built = "";
    start.visits[initialState] = 1;
    q.push(start);

    while (!q.empty()) {
        Node current = q.front();
        q.pop();

        if ((int)current.built.size() >= maxLength) continue;

        for (char symbol : alphabet) {
            vector<string> next = t.getNextStates(current.state, symbol);
            for (const string &nextState : next) {
                Node node;
                node.state = nextState;
                node.built = current.built + symbol;
                node.visits = current.visits;
                node.visits[nextState]++;

                if (node.visits[nextState] > cycleLimit) continue;

                if (finalStates.count(nextState) > 0) {
                    accepted.push_back(node.built);
                }

                if ((int)node.built.size() < maxLength) {
                    q.push(node);
                }
            }
        }
    }

    return accepted;
}
