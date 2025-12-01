#include <iostream>
#include <string>
#include <vector>
#include "libs/nlohmann/json.hpp"
#include "Automaton.h"
#include "Transition.h"

using json = nlohmann::json;

int main() {
    Automaton automaton;

    std::string line;
    while (std::getline(std::cin, line)) {
        json response;
        try {
            json command = json::parse(line);
            std::string action = command["action"];

            if (action == "create_automaton") {
                // Example: { "action": "create_automaton", "initial_state": "q0", "final_states": ["q1"] }
                std::string initial_state = command["initial_state"];
                std::set<std::string> final_states;
                for (const auto& state : command["final_states"]) {
                    final_states.insert(state);
                }
                automaton = Automaton(initial_state, final_states, Transition());
                response["status"] = "success";
                response["message"] = "Automaton created";
            } else if (action == "add_transition") {
                // Example: { "action": "add_transition", "from": "q0", "to": "q1", "symbol": "a" }
                std::string from = command["from"];
                std::string to = command["to"];
                char symbol = command["symbol"].get<std::string>()[0];
                automaton.getDelta().addTransition(from, symbol, to);
                response["status"] = "success";
                response["message"] = "Transition added";
            } else {
                response["status"] = "error";
                response["message"] = "Unknown action";
            }
        } catch (const std::exception& e) {
            response["status"] = "error";
            response["message"] = e.what();
        }

        std::cout << response.dump() << std::endl;
    }

    return 0;
}
