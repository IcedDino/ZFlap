#include "Transition.h"

void Transition::addTransition(const std::string &from, char symbol, const std::string &to) {
	delta[{from, symbol}].push_back(to);
}

std::vector<std::string> Transition::getNextStates(const std::string &from, char symbol) const{
	auto it = delta.find({from, symbol});
	if (it != delta.end()) {
		return it->second;
	}
	return {};
}

