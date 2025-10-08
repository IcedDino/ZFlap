/**
 * @file Transition.cpp
 * @brief Implementation of the Transition class
 * @author ZFlap Project
 * @version 1.0.0
 * @date 2024
 */

#include "Transition.h"

void Transition::addTransition(const std::string &from, char symbol, const std::string &to) {
    // Add the destination state to the vector of destinations for this state-symbol pair
    // If the key doesn't exist, it will be created automatically
    delta[{from, symbol}].push_back(to);
}

void Transition::clear() {
    delta.clear();
}

std::vector<std::string> Transition::       getNextStates(const std::string &from, char symbol) const {
    // Look up the transition in the hash map
    auto it = delta.find({from, symbol});
    
    // If transition exists, return the vector of destination states
    if (it != delta.end()) {
        return it->second;
    }
    
    // If no transition exists, return empty vector
    return {};
}

