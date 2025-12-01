#include "TM.h"
#include <iostream>
#include <algorithm>
#include <sstream> // Para tapeToString

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
    for (int i = 0; i < tape.size(); ++i) {
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
    // Si el cabezal se mueve a la izquierda del inicio lógico de la cinta
    if (headPosition < 0) {
        tape.insert(tape.begin(), blankSymbol);
        tapeOffset++; // El inicio lógico se mueve una posición a la derecha en el vector
        headPosition = 0; // El cabezal ahora está en la nueva posición 0
    }
    // Si el cabezal se mueve a la derecha del final lógico de la cinta
    else if (headPosition >= (int)tape.size()) {
        tape.push_back(blankSymbol);
    }
}

bool TM::accepts(const std::string &input, std::vector<TM_Step> *outPath, int maxSteps) {
    // Configuración inicial
    Config currentConfig;
    currentConfig.state = initialState;
    currentConfig.tape.assign(input.begin(), input.end());
    currentConfig.headPosition = 0;
    currentConfig.tapeOffset = 0; // Inicialmente, el inicio lógico de la cinta está en tape[0]

    // Asegurarse de que la cinta no esté vacía si la entrada es vacía
    if (currentConfig.tape.empty()) {
        currentConfig.tape.push_back(blankSymbol);
    }

    vector<TM_Step> pathSoFar;
    vector<TM_Step> resultPath;
    int stepsRemaining = maxSteps;

    bool found = simulate(currentConfig, pathSoFar, resultPath, stepsRemaining);

    if (found) {
        if (outPath) *outPath = resultPath;
    }
    return found;
}

bool TM::simulate(Config current,
                  vector<TM_Step> &pathSoFar,
                  vector<TM_Step> &resultPath,
                  int &stepsRemaining) {
    if (stepsRemaining-- <= 0) {
        // cout << "Max steps reached, halting simulation." << endl;
        return false; // Prevenir loops infinitos
    }

    // Condición de aceptación: si el estado actual es final
    if (finalStates.count(current.state)) {
        resultPath = pathSoFar;
        return true;
    }

    // Obtener el símbolo bajo el cabezal
    char currentSymbol = blankSymbol;
    if (current.headPosition >= 0 && current.headPosition < (int)current.tape.size()) {
        currentSymbol = current.tape[current.headPosition];
    } else {
        // Si el cabezal está fuera de los límites actuales, se considera que lee el símbolo blanco
        // La función expandTape se encargará de añadirlo si se escribe o se mueve hacia allí.
    }

    // Buscar una transición aplicable
    for (const auto &t : transitions) {
        bool readMatches = (t.readSymbol == currentSymbol) || (t.readSymbol == '\0' && currentSymbol == blankSymbol);
        if (t.fromState == current.state && readMatches) {
            // Encontrada una transición aplicable (asumiendo MT determinista por ahora)

            Config nextConfig = current;
            TM_Step step;

            step.fromState = current.state;
            step.readSymbol = currentSymbol;

            // 1. Escribir el símbolo
            nextConfig.tape[nextConfig.headPosition] = (t.writeSymbol == '\0' ? blankSymbol : t.writeSymbol);
            step.writeSymbol = t.writeSymbol;

            // 2. Mover el cabezal
            if (t.moveDirection == TM_MoveDirection::LEFT) {
                nextConfig.headPosition--;
            } else if (t.moveDirection == TM_MoveDirection::RIGHT) {
                nextConfig.headPosition++;
            }
            // Si es STAY, headPosition no cambia

            // Expandir la cinta si es necesario después del movimiento
            expandTape(nextConfig.tape, nextConfig.headPosition, nextConfig.tapeOffset);

            // 3. Cambiar de estado
            nextConfig.state = t.toState;
            step.toState = t.toState;
            step.moveDirection = t.moveDirection;

            // Registrar el paso
            step.tapeSnapshot = tapeToString(nextConfig.tape, nextConfig.headPosition, blankSymbol);
            step.headPosition = nextConfig.headPosition; // La posición del cabezal en el snapshot

            pathSoFar.push_back(step);

            // Llamada recursiva para el siguiente paso
            if (simulate(nextConfig, pathSoFar, resultPath, stepsRemaining)) {
                return true; // Si se encontró una ruta de aceptación, propagar
            }

            // Backtrack (si no se encontró una ruta de aceptación por este camino)
            pathSoFar.pop_back();
        }
    }

    return false; // No se encontraron transiciones aplicables o no lleva a un estado de aceptación
}
