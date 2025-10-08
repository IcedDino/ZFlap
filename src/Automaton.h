#ifndef AUTOMATON_H
#define AUTOMATON_H

#include <string>
#include <set>
#include <map>
#include <vector>
#include "Transition.h"

class Automaton {
private:
    Transition delta;
    std::string estadoInicial;
    std::set<std::string> estadosFinales;
    int maxRepeticiones = 3;

    void dfs(const std::string &estado, std::string cadena,
             std::map<std::pair<std::string,char>,int> &contador,
             int maxLongitud, std::set<std::string> &aceptadas);

public:
    Automaton(const std::string &inicial, const std::set<std::string> &finales, const Transition &trans);

    std::set<std::string> generarCadenasAceptadas(int maxLongitud);
    bool validarCadena(const std::string &cadena, int maxLongitud);

    // Nueva función
    void guardarAutomata(const std::string &ruta,
                         const std::vector<char> &alfabeto,
                         const std::set<std::string> &estados) const;
};

#endif
