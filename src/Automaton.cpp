//
// Created by Isai Nuñez on 10/7/2025.
//
#include "Automaton.h"
#include <fstream>
#include <iostream>
#include <sstream>

using namespace std;

Automaton::Automaton(const string &inicial, const set<string> &finales, const Transition &trans)
    : estadoInicial(inicial), estadosFinales(finales), delta(trans) {}

void Automaton::dfs(const string &estado, string cadena,
                    map<pair<string,char>,int> &contador,
                    int maxLongitud, set<string> &aceptadas) {
    if (estadosFinales.count(estado))
        aceptadas.insert(cadena);

    if ((int)cadena.size() >= maxLongitud) return;

    for (char simbolo = 'a'; simbolo <= 'z'; simbolo++) {
        vector<string> siguientes = delta.getNextStates(estado, simbolo);
        for (const auto &sig : siguientes) {
            auto clave = make_pair(estado, simbolo);
            contador[clave]++;
            if (contador[clave] <= maxRepeticiones)
                dfs(sig, cadena + simbolo, contador, maxLongitud, aceptadas);
            contador[clave]--;
        }
    }
}

set<string> Automaton::generarCadenasAceptadas(int maxLongitud) {
    set<string> aceptadas;
    map<pair<string,char>,int> contador;
    dfs(estadoInicial, "", contador, maxLongitud, aceptadas);
    return aceptadas;
}

bool Automaton::validarCadena(const string &cadena, int maxLongitud) {
    set<string> aceptadas = generarCadenasAceptadas(maxLongitud);
    return aceptadas.count(cadena) > 0;
}

// ----------- NUEVA FUNCIÓN ---------------
void Automaton::guardarAutomata(const string &ruta,
                                const vector<char> &alfabeto,
                                const set<string> &estados) const {
    ofstream archivo(ruta);
    if (!archivo.is_open()) {
        cerr << "Error: no se pudo crear el archivo " << ruta << endl;
        return;
    }

    archivo << "# Automata ZFlap Project\n";
    archivo << "alphabet: (";
    for (size_t i = 0; i < alfabeto.size(); ++i) {
        archivo << alfabeto[i];
        if (i < alfabeto.size() - 1) archivo << ",";
    }
    archivo << ")\n";

    archivo << "states: (";
    size_t i = 0;
    for (const auto &st : estados) {
        archivo << st;
        if (i++ < estados.size() - 1) archivo << ",";
    }
    archivo << ")\n";

    archivo << "initial: " << estadoInicial << "\n";

    archivo << "finals: (";
    i = 0;
    for (const auto &f : estadosFinales) {
        archivo << f;
        if (i++ < estadosFinales.size() - 1) archivo << ",";
    }
    archivo << ")\n";

    archivo << "transitions:\n";
    // Para obtener las transiciones, usamos un truco: reescribimos el mapa delta
    for (char simbolo = 'a'; simbolo <= 'z'; simbolo++) {
        for (const auto &st : estados) {
            vector<string> destinos = delta.getNextStates(st, simbolo);
            for (const auto &dest : destinos) {
                archivo << st << "," << simbolo << "->" << dest << "\n";
            }
        }
    }

    archivo.close();
    cout << "Automata guardado correctamente en " << ruta << endl;
}
