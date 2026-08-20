/**
 * @file Transition.cpp
 * @brief Implementation of the Transition class
 * @author ZFlap Project
 * @version 1.0.0
 * @date 2024
 */

#include "Transition.h"
#include <algorithm>

void Transition::addTransition(const std::string &from, char symbol, const std::string &to) {
    // Add the destination state to the vector of destinations for this state-symbol pair
    // If the key doesn't exist, it will be created automatically
    delta[{from, symbol}].push_back(to);
}

void Transition::clear() {
    delta.clear();
}

std::vector<std::string> Transition::getNextStates(const std::string &from, char symbol) const {
    auto it = delta.find({from, symbol});
    if (it != delta.end()) {
        return it->second;
    }
    return {};
}

void Transition::removeTransition(const std::string &from, char symbol, const std::string &to) {
    auto it = delta.find({from, symbol});
    if (it == delta.end()) return;
    auto &vec = it->second;
    auto pos = std::find(vec.begin(), vec.end(), to);
    if (pos != vec.end()) {
        vec.erase(pos);
    }
    if (vec.empty()) {
        delta.erase(it);
    }
}

void Transition::removeAllFrom(const std::string &state) {
    for (auto it = delta.begin(); it != delta.end(); ) {
        if (it->first.state == state) {
            it = delta.erase(it);
        } else {
            ++it;
        }
    }
}

void Transition::removeAllTo(const std::string &state) {
    for (auto it = delta.begin(); it != delta.end(); ) {
        auto &vec = it->second;
        vec.erase(std::remove(vec.begin(), vec.end(), state), vec.end());
        if (vec.empty()) {
            it = delta.erase(it);
        } else {
            ++it;
        }
    }
}

size_t Transition::getCount() const {
    size_t count = 0;
    for (const auto &[key, vec] : delta) {
        count += vec.size();
    }
    return count;
}

std::vector<std::tuple<std::string, char, std::string>> Transition::getAllTransitions() const {
    std::vector<std::tuple<std::string, char, std::string>> result;
    for (const auto &[key, vec] : delta) {
        for (const auto &to : vec) {
            result.emplace_back(key.state, key.symbol, to);
        }
    }
    return result;
}

