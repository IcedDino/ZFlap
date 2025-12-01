#include "AdP.h"
#include <iostream>
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
    // queremos mostrar top al inicio -> copiamos temporalmente
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
    // Config inicial
    Config start;
    start.state = initialState;
    start.inputIndex = 0;
    start.stack = std::stack<char>();
    start.stack.push(initialStackSymbol);

    vector<PDA_Step> pathSoFar;
    vector<PDA_Step> resultPath;
    int stepsRemaining = maxSteps;

    bool found = dfs_find(input, start, pathSoFar, resultPath, stepsRemaining);

    if (found) {
        if (outPath) *outPath = resultPath;
    }
    return found;
}

bool PDA::dfs_find(const std::string &input,
                   Config current,
                   vector<PDA_Step> &pathSoFar,
                   vector<PDA_Step> &resultPath,
                   int &stepsRemaining) {
    if (stepsRemaining-- <= 0) return false; // prevenimos loops infinitos

    // Aceptación por estado final (y opcionalmente pila vacía si tu definición la requiere)
    if ((int)current.inputIndex == (int)input.size() && finalStates.count(current.state)) {
        // Construimos resultPath = pathSoFar (ya contiene snapshots)
        resultPath = pathSoFar;
        return true;
    }

    // Recorremos todas las transiciones posibles desde current.state
    for (const auto &t : transitions) {
        if (t.from != current.state) continue;

        // Checamos si el input coincide (o es epsilon)
        bool inputMatches = false;
        if (t.input == '\0') {
            inputMatches = true; // epsilon
        } else {
            if (current.inputIndex < (int)input.size() && input[current.inputIndex] == t.input)
                inputMatches = true;
        }
        if (!inputMatches) continue;

        // Checamos pop: si se debe desapilar un símbolo (t.pop != '\0')
        std::stack<char> newStack = current.stack;
        char popped = '\0';
        if (t.pop != '\0') {
            if (newStack.empty()) continue; // no se puede pop
            if (newStack.top() != t.pop) continue; // tope no coincide
            popped = newStack.top();
            newStack.pop();
        }

        // Push (la cadena push se aplica como: se empuja la cadena de derecha a izquierda
        // de tal forma que el primer char de push quede más abajo y el último char sea top)
        if (!t.push.empty()) {
            // empujar en orden: primero char 0 será más abajo -> debemos empujar de derecha a izquierda
            for (auto it = t.push.rbegin(); it != t.push.rend(); ++it) {
                newStack.push(*it);
            }
        }

        // Preparar la estructura de paso para el registro
        PDA_Step step;
        step.fromState = current.state;
        step.toState = t.to;
        step.consumed = (t.input == '\0') ? '\0' : t.input;
        step.popped = popped;
        step.pushed = t.push;
        // inputIndex después del paso:
        step.inputIndex = current.inputIndex + ((t.input == '\0') ? 0 : 1);
        step.stackSnapshot = stackToString(newStack);

        // Nueva configuración
        Config next;
        next.state = t.to;
        next.inputIndex = step.inputIndex;
        next.stack = newStack;

        // Agregamos el paso a pathSoFar
        pathSoFar.push_back(step);

        // DFS recursiva
        if (dfs_find(input, next, pathSoFar, resultPath, stepsRemaining)) {
            return true; // si encontró una ruta, propagamos true y dejamos resultPath listo
        }

        // backtrack
        pathSoFar.pop_back();
    }

    return false;
}
