#ifndef STRING_VALIDATION_H
#define STRING_VALIDATION_H

#include <string>
#include <vector>
#include <set>

#include "core/Transition.h"

/**
 * @brief Simulates the automaton on the given input and returns all states reached
 *        after consuming the entire string.
 * @param t          Transition function of the automaton.
 * @param initialState  Starting state.
 * @param input      String to process.
 * @return Set of states reachable after processing every character.
 */
std::set<std::string> validateString(const Transition &t,
                                     const std::string &initialState,
                                     const std::string &input);

/**
 * @brief Returns true if the automaton accepts the given input string.
 * @param t          Transition function.
 * @param initialState  Starting state.
 * @param finalStates   Set of accepting states.
 * @param input      String to test.
 */
bool isAccepted(const Transition &t,
                const std::string &initialState,
                const std::set<std::string> &finalStates,
                const std::string &input);

/**
 * @brief Generates all strings accepted by the automaton up to a maximum length.
 * @param t          Transition function.
 * @param initialState  Starting state.
 * @param finalStates   Set of accepting states.
 * @param alphabet   Alphabet symbols.
 * @param maxLength  Maximum string length to explore.
 * @return Vector of accepted strings.
 */
std::vector<std::string> generateAcceptedStrings(const Transition &t,
                                                  const std::string &initialState,
                                                  const std::set<std::string> &finalStates,
                                                  const std::vector<char> &alphabet,
                                                  int maxLength);

/**
 * @brief Like generateAcceptedStrings but limits how many times any single state
 *        may appear on an exploration path, preventing unbounded cycle traversal.
 * @param cycleLimit  Maximum visits to any one state per path (default 2).
 */
std::vector<std::string> generateStringsWithLimit(const Transition &t,
                                                   const std::string &initialState,
                                                   const std::set<std::string> &finalStates,
                                                   const std::vector<char> &alphabet,
                                                   int maxLength,
                                                   int cycleLimit = 2);

#endif // STRING_VALIDATION_H
