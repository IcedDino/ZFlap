#ifndef ALPHABET_H
#define ALPHABET_H

#include <vector>
#include <string>

/**
 * @brief Parses and validates an automaton alphabet in the format (a,b,c,...).
 *
 * Rules:
 *  - Must start with '(' and end with ')'.
 *  - Each symbol must be a single character (surrounding whitespace is trimmed).
 *  - Duplicates are not allowed.
 *  - Cannot be empty.
 *
 * @param input String containing the alphabet.
 * @return Vector of symbol characters.
 * @throws std::invalid_argument if the format is invalid.
 */
std::vector<char> parseAlphabet(const std::string &input);

#endif // ALPHABET_H
