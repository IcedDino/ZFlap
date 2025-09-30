//
// Created by jaquy on 29/09/2025.
//

#ifndef ZFLAP_ALFABETO_H
#define ZFLAP_ALFABETO_H
#include <vector>
#include <string>

/**
 * @brief Guarda y valida un abecedario de un autómata.
 *
 * El abecedario debe ingresarse en el formato (a,b,c,...).
 * - Debe iniciar con '(' y terminar con ')'.
 * - Cada símbolo debe ser un solo caracter.
 * - No se permiten duplicados.
 * - No puede estar vacío.
 *
 * @param entrada Cadena que contiene el abecedario en formato válido.
 * @return std::vector<char> Vector con los símbolos del abecedario.
 * @throws std::invalid_argument Si el abecedario no cumple con las reglas.
 */
std::vector<char> guardarAbecedario(const std::string &entrada);

#endif
