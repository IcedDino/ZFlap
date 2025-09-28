/**
 * @file Transition.h
 * @brief Header file for the Transition class and related structures
 * @author ZFlap Project
 * @version 1.0.0
 * @date 2024
 */

#ifndef TRANSITION_H
#define TRANSITION_H

#include <string>
#include <unordered_map>
#include <vector>

/**
 * @brief Structure representing a transition key for finite automaton
 * 
 * This structure combines a state and an input symbol to form a unique key
 * for looking up transitions in the transition function delta.
 */
struct TransKey {
    std::string state;  ///< The source state of the transition
    char symbol;        ///< The input symbol that triggers the transition
    
    /**
     * @brief Equality operator for TransKey
     * @param other The other TransKey to compare with
     * @return true if both state and symbol are equal, false otherwise
     */
    bool operator==(const TransKey &other) const {
        return state == other.state && symbol == other.symbol;
    }
};

/**
 * @brief Hash function for TransKey to enable use in unordered_map
 * 
 * This structure provides a custom hash function for TransKey objects,
 * combining the hash values of the state string and symbol character.
 */
struct KeyHash {
    /**
     * @brief Hash function operator
     * @param k The TransKey to hash
     * @return A hash value for the given TransKey
     */
    size_t operator()(const TransKey &k) const {
        return std::hash<std::string>()(k.state) ^ std::hash<char>()(k.symbol);
    }
};

/**
 * @brief Class representing the transition function of a finite automaton
 * 
 * The Transition class implements a transition function delta that maps
 * (state, symbol) pairs to sets of destination states. This supports both
 * deterministic finite automata (DFA) and non-deterministic finite automata (NFA).
 * 
 * @note This implementation allows multiple transitions from the same state-symbol pair,
 * making it suitable for NFA representation.
 */
class Transition {
private:
    std::unordered_map<TransKey, std::vector<std::string>, KeyHash> delta; ///< The transition function mapping (state, symbol) -> {destinations}

public:
    /**
     * @brief Add a transition to the automaton
     * 
     * Adds a transition from the given state with the given symbol to the
     * specified destination state. Multiple transitions from the same
     * state-symbol pair are allowed (NFA support).
     * 
     * @param from The source state of the transition
     * @param symbol The input symbol that triggers the transition
     * @param to The destination state of the transition
     * 
     * @note If the same transition is added multiple times, it will be stored
     * multiple times in the destination vector.
     */
    void addTransition(const std::string &from, char symbol, const std::string &to);
    
    /**
     * @brief Get all possible next states for a given state-symbol pair
     * 
     * Returns a vector containing all destination states that can be reached
     * from the given state with the given input symbol.
     * 
     * @param from The source state
     * @param symbol The input symbol
     * @return A vector of destination states. Returns an empty vector if no
     *         transition exists for the given state-symbol pair.
     * 
     * @note The order of states in the returned vector is not guaranteed to be
     *       consistent across calls, as it depends on the internal hash map ordering.
     */
    std::vector<std::string> getNextStates(const std::string &from, char symbol) const;
};

#endif
