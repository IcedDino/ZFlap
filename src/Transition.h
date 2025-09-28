#ifndef TRANSITION_H
#define TRANSITION_H

#include <string>
#include <unordered_map>
#include <vector>

struct TransKey {
	std::string state;
	char symbol;
	bool operator==(const TransKey &other) const {
		return state == other.state && symbol == other.symbol;
	}
};

struct KeyHash {
	size_t operator()(const TransKey &k) const {
		return std::hash<std::string>()(k.state) ^ std::hash<char>()(k.symbol);
	}
};

class Transition {
private:
	std::unordered_map<TransKey, std::vector<std::string>, KeyHash> delta;
public:
	void addTransition(const std::string &from, char symbol, const std::string &to);
	std::vector<std::string> getNextStates(const std::string &from, char symbol) const;
};

#endif
