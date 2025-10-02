// Created by jaquy on 29/09/2025.

#include "Alfabeto.h"
#include <set>
#include <sstream>
#include <stdexcept>
#include <algorithm>
#include <cctype>

using namespace std;

// trim: quita espacios al inicio y al final
static string trim(const string &s) {
    size_t start = 0;
    while (start < s.size() && isspace(static_cast<unsigned char>(s[start]))) ++start;
    size_t end = s.size();
    while (end > start && isspace(static_cast<unsigned char>(s[end - 1]))) --end;
    return s.substr(start, end - start);
}

vector<char> guardarAbecedario(const string &entrada) {
    vector<char> abecedario;
    set<char> verificador; // Para evitar duplicados

    // Entrada completamente vacía -> error específico
    if (entrada.empty()) {
        throw invalid_argument("Error: el alfabeto no puede estar vacio.");
    }

    // Debe empezar con '(' y terminar con ')'
    if (entrada.front() != '(' || entrada.back() != ')') {
        throw invalid_argument("Error: el alfabeto debe estar entre parentesis ( ).");
    }

    // Extraer contenido entre paréntesis (puede ser " " o "" o "a, ,b", etc.)
    string contenido = entrada.substr(1, entrada.size() - 2);

    // Si el contenido es exactamente vacío => "()"
    if (contenido.empty()) {
        throw invalid_argument("Error: el alfabeto no puede estar vacio.");
    }

    stringstream ss(contenido);
    string simboloRaw;
    while (getline(ss, simboloRaw, ',')) {
        // Si hay un token vacío (p. ej. "(a,,b)") -> inválido
        if (simboloRaw.empty()) {
            throw invalid_argument("Error: cada simbolo debe ser un caracter individual.");
        }

        // trimmed = token sin espacios al inicio/fin
        string trimmed = trim(simboloRaw);

        char c; // caracter que representará el símbolo
        if (trimmed.size() == 1) {
            // caso normal: "a" o " b " -> trimmed == "b"
            c = trimmed[0];
        } else if (trimmed.empty()) {
            // significa que simboloRaw era sólo espacios.
            // aceptamos exactamente un espacio como símbolo: simboloRaw.size() == 1 -> símbolo ' '
            if (simboloRaw.size() == 1) {
                c = simboloRaw[0]; // será ' '
            } else {
                // múltiples espacios -> inválido (símbolo debe ser 1 caracter)
                throw invalid_argument("Error: cada simbolo debe ser un caracter individual.");
            }
        } else {
            // trimmed.size() > 1 => token multi-caracter (ej "ab" o " a b ")
            throw invalid_argument("Error: cada simbolo debe ser un caracter individual.");
        }

        // Verificar duplicados
        if (verificador.count(c)) {
            throw invalid_argument("Error: simbolo duplicado en el alfabeto.");
        }

        verificador.insert(c);
        abecedario.push_back(c);
    }

    if (abecedario.empty()) {
        throw invalid_argument("Error: el alfabeto no puede estar vacio.");
    }

    return abecedario;
}
