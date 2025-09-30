//
// Created by jaquy on 29/09/2025.
//

#include "Alfabeto.h"
#include <set>
#include <sstream>
#include <stdexcept>

using namespace std;

vector<char> guardarAbecedario(const string &entrada) {
    vector<char> abecedario;
    set<char> verificador; // Para evitar duplicados

    // Verificar que empiece con '(' y termine con ')'
    if (entrada.size() < 3 || entrada.front() != '(' || entrada.back() != ')') {
        throw invalid_argument("Error: el alfabeto debe estar entre parentesis ( ).");
    }

    // Extraer la parte interna (sin paréntesis)
    string contenido = entrada.substr(1, entrada.size() - 2);
    stringstream ss(contenido);
    string simbolo;

    while (getline(ss, simbolo, ',')) {
        // Cada símbolo debe ser un solo caracter
        if (simbolo.size() != 1) {
            throw invalid_argument("Error: cada simbolo debe ser un caracter individual.");
        }

        char c = simbolo[0];

        // Verificar duplicados
        if (verificador.count(c)) {
            throw invalid_argument("Error: simbolo duplicado en el alfabeto.");
        }

        verificador.insert(c);
        abecedario.push_back(c);
    }

    // Verificar que no esté vacío
    if (abecedario.empty()) {
        throw invalid_argument("Error: el alfabeto no puede estar vacio.");
    }

    return abecedario;
}
