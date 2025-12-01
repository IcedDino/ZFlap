//
// Created by Jovany Flores on 01/12/25.
//

#ifndef ZFLAP_TM_H
#define ZFLAP_TM_H

#include <string>
#include <vector>
#include <set>
#include <optional>
#include <map>

// Enum para la dirección del movimiento del cabezal
enum class TM_MoveDirection {
    LEFT,
    RIGHT,
    STAY
};

// Representa una transición de la Máquina de Turing:
// (fromState, readSymbol) -> (toState, writeSymbol, moveDirection)
struct TM_Transition {
    std::string fromState;
    char readSymbol;
    std::string toState;
    char writeSymbol;
    TM_MoveDirection moveDirection;

    // Para facilitar la búsqueda en un map o set si fuera necesario
    bool operator<(const TM_Transition& other) const {
        if (fromState != other.fromState) return fromState < other.fromState;
        if (readSymbol != other.readSymbol) return readSymbol < other.readSymbol;
        if (toState != other.toState) return toState < other.toState;
        if (writeSymbol != other.writeSymbol) return writeSymbol < other.writeSymbol;
        return moveDirection < other.moveDirection;
    }
};

// Estructura para describir un paso de la ejecución de la MT
struct TM_Step {
    std::string fromState;
    std::string toState;
    char readSymbol;
    char writeSymbol;
    TM_MoveDirection moveDirection;
    std::string tapeSnapshot; // Representación textual de la cinta
    int headPosition;         // Posición del cabezal en la cinta (0-indexed)
};

class TM {
public:
    TM(const std::string &initialState, char blankSymbol);

    void addTransition(const TM_Transition &t);
    void addFinalState(const std::string &s);

    // Simula la MT para ver si acepta la cadena de entrada.
    // maxSteps previene loops infinitos.
    // Si acepta, devuelve true y opcionalmente llena `path` con la secuencia de pasos.
    bool accepts(const std::string &input, std::vector<TM_Step> *outPath = nullptr, int maxSteps = 100000);

    // Si ya obtuviste una ruta (path) por accepts(..., &path), usa esta función
    // para iterar/mostrar paso a paso en la interfaz. Devuelve el TM_Step en `i` (si existe).
    std::optional<TM_Step> getStepFromPath(const std::vector<TM_Step> &path, size_t i) const;

    // Representación textual de la cinta, útil para tu GUI
    static std::string tapeToString(const std::vector<char> &tape, int headPos, char blank);

private:
    std::string initialState;
    char blankSymbol;
    std::vector<TM_Transition> transitions;
    std::set<std::string> finalStates;

    // Estructura de configuración para el DFS (o simulación iterativa)
    struct Config {
        std::string state;
        std::vector<char> tape;
        int headPosition; // 0-indexed, relativo al inicio lógico de la cinta
        int tapeOffset;   // Desplazamiento del inicio lógico de la cinta respecto al vector real
    };

    // Función auxiliar para expandir la cinta si el cabezal se mueve fuera de los límites actuales
    void expandTape(std::vector<char> &tape, int &headPosition, int &tapeOffset);

    // DFS interna que construye el path (si encuentra aceptación)
    // Para una MT determinista, esto podría ser un simple bucle.
    // Para una MT no determinista (si se decide implementar), sería un DFS.
    bool simulate(Config current,
                  std::vector<TM_Step> &pathSoFar,
                  std::vector<TM_Step> &resultPath,
                  int &stepsRemaining);
};

#endif // ZFLAP_TM_H
