#ifndef ALFABETO_H
#define ALFABETO_H

#include <vector>
#include <string>

/**
 * @brief Guarda y valida un abecedario de autómata en formato (a,b,c,...).
 *
 * Reglas:
 *  - Debe comenzar con '(' y terminar con ')'.
 *  - Cada símbolo debe ser un solo caracter (se permite espacio alrededor, se recorta).
 *  - No se permiten duplicados.
 *  - No puede estar vacío.
 *
 * @param entrada Cadena con el abecedario.
 * @return std::vector<char> Vector con los símbolos.
 * @throws std::invalid_argument Si el formato no es válido.
 */
std::vector<char> guardarAbecedario(const std::string &entrada);

#endif // ALFABETO_H
