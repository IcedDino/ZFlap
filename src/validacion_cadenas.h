#ifndef VALIDACION_CADENA_H
#define VALIDACION_CADENA_H

#include <string>
#include <vector>
#include <set>

// This header assumes a "Transition.h" file exists which defines the Transition class.
// Make sure you have this file and it defines the 'getNextStates' method.
#include "Transition.h"

/**
 * @brief Valida una cadena en el autómata y devuelve los estados finales alcanzados.
 * @param t Las transiciones del autómata.
 * @param estadoInicial El estado inicial del autómata.
 * @param cadena La cadena a validar.
 * @return Un conjunto de strings con los estados finales alcanzados después de procesar la cadena.
 */
std::set<std::string> validarCadena(const Transition &t,
                                    const std::string &estadoInicial,
                                    const std::string &cadena);

/**
 * @brief Verifica si una cadena es aceptada por el autómata.
 * @param t Transiciones del autómata.
 * @param estadoInicial Estado inicial del autómata.
 * @param estadosFinales Conjunto de estados de aceptación.
 * @param cadena Cadena a verificar.
 * @return true si la cadena es aceptada, false en caso contrario.
 */
bool esAceptada(const Transition &t,
                const std::string &estadoInicial,
                const std::set<std::string> &estadosFinales,
                const std::string &cadena);

/**
 * @brief Genera todas las cadenas aceptadas hasta una longitud máxima.
 * @param t Transiciones del autómata.
 * @param estadoInicial Estado inicial del autómata.
 * @param estadosFinales Conjunto de estados de aceptación.
 * @param alfabeto Vector con los símbolos del alfabeto.
 * @param longitudMaxima Longitud máxima de las cadenas a generar.
 * @return Un vector con todas las cadenas aceptadas.
 */
std::vector<std::string> generarCadenasAceptadas(const Transition &t,
                                                   const std::string &estadoInicial,
                                                   const std::set<std::string> &estadosFinales,
                                                   const std::vector<char> &alfabeto,
                                                   int longitudMaxima);

/**
 * @brief Genera todas las combinaciones posibles limitando la exploración de ciclos.
 * @param t Transiciones del autómata.
 * @param estadoInicial Estado inicial del autómata.
 * @param estadosFinales Conjunto de estados de aceptación.
 * @param alfabeto Vector con los símbolos del alfabeto.
 * @param longitudMaxima Longitud máxima de las cadenas.
 * @param limiteCiclos Límite de veces que se puede visitar un mismo estado en una ruta.
 * @return Un vector con las cadenas aceptadas encontradas.
 */
std::vector<std::string> generarCadenasConLimite(const Transition &t,
                                                   const std::string &estadoInicial,
                                                   const std::set<std::string> &estadosFinales,
                                                   const std::vector<char> &alfabeto,
                                                   int longitudMaxima,
                                                   int limiteCiclos = 2);

#endif // VALIDACION_CADENA_H