//
// Created by Jovany Flores on 01/12/25.
//

#ifndef ZFLAP_ADP_H
#define ZFLAP_ADP_H

#include <string>
#include <vector>
#include <set>
#include <stack>
#include <functional>
#include <optional>

// Representa una transición del PDA:
// (fromState, inputSymbol, popSymbol) -> (toState, pushString)
// - inputSymbol = '\0' significa epsilon (no consumir símbolo)
// - popSymbol = '\0' significa epsilon (no pop)  <-- normalmente usamos un símbolo real para pop (ej 'A' o 'Z')
// - pushString puede ser "" para epsilon, o una secuencia (la primera char será el top cuando push se hace correctamente)
struct PDA_Transition {
    std::string from;
    char input;        // símbolo de entrada, '\0' -> epsilon
    char pop;          // símbolo a desapilar, '\0' -> no pop (raro en PDAs tradicionales)
    std::string push;  // cadena a "push" (primer char será el tope más a la derecha), "" -> epsilon (nada)
    std::string to;
};

struct PDA_Step { // describe un paso de la ruta de aceptación
    std::string fromState;
    std::string toState;
    char consumed;        // símbolo consumido ('\0' si epsilon)
    char popped;          // símbolo desapilado ('\0' si nada)
    std::string pushed;   // cadena empujada ("" si nada)
    std::string stackSnapshot; // representación textual de la pila después del paso (top a la izquierda)
    int inputIndex;       // índice en la cadena de entrada después del paso (posición siguiente a la consumida)
};

class PDA {
public:
    PDA(const std::string &initialState, char initialStackSymbol);

    void addTransition(const PDA_Transition &t);
    void addFinalState(const std::string &s);

    // Busca si la cadena es aceptada (non-deterministic DFS).
    // maxSteps evita loops infinitos (por ejemplo con epsilon-cycles).
    // Si acepta, devuelve true y opcionalmente llena `path` con la secuencia de pasos que llevan a la aceptación.
    bool accepts(const std::string &input, std::vector<PDA_Step> *outPath = nullptr, int maxSteps = 100000);

    // Si ya obtuviste una ruta (path) por accepts(..., &path), usa esta función
    // para iterar/mostrar paso a paso en la interfaz. Devuelve el PDA_Step en `i` (si existe).
    std::optional<PDA_Step> getStepFromPath(const std::vector<PDA_Step> &path, size_t i) const;

    // Representación textual de la pila (top al inicio), util para tu GUI
    static std::string stackToString(const std::stack<char> &s);

private:
    std::string initialState;
    char initialStackSymbol;
    std::vector<PDA_Transition> transitions;
    std::set<std::string> finalStates;

    // Estructura de configuración usada por DFS
    struct Config {
        std::string state;
        int inputIndex; // posición en la cadena de entrada (0..n)
        std::stack<char> stack;
    };

    // DFS interna que construye el path (si encuentra aceptación)
    bool dfs_find(const std::string &input,
                  Config current,
                  std::vector<PDA_Step> &pathSoFar,
                  std::vector<PDA_Step> &resultPath,
                  int &stepsRemaining);
};

#endif // PDA_H
