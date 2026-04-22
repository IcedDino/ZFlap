#include "AutomatonSerializer.h"
#include <fstream>
#include <sstream>

static std::string trim(const std::string& s) {
    size_t start = s.find_first_not_of(" \t\r\n");
    if (start == std::string::npos) return "";
    size_t end = s.find_last_not_of(" \t\r\n");
    return s.substr(start, end - start + 1);
}

static std::vector<std::string> split(const std::string& s, char delim) {
    std::vector<std::string> parts;
    std::stringstream ss(s);
    std::string token;
    while (std::getline(ss, token, delim)) {
        parts.push_back(trim(token));
    }
    return parts;
}

std::string AutomatonSerializer::encodeSymbol(char c) {
    if (c == '\0') return "ε";
    return std::string(1, c);
}

char AutomatonSerializer::decodeSymbol(const std::string& s) {
    if (s.empty() || s == "ε") return '\0';
    return s.at(0);
}

AutomatonSerializer::Result AutomatonSerializer::save(const AutomatonModel& model,
                                                       const std::string& filePath) {
    std::ofstream out(filePath);
    if (!out.is_open()) {
        return {false, "Cannot open file for writing: " + filePath};
    }

    out << "# ZFlap Automaton File v2.0\n";
    out << "Automaton: " << model.getName() << "\n";

    out << "Alphabet:";
    for (char c : model.getAlphabet()) {
        out << " " << c;
    }
    out << "\n";

    out << "Type: ";
    switch (model.getType()) {
        case AutomatonType::FiniteAutomaton: out << "FiniteAutomaton\n"; break;
        case AutomatonType::StackAutomaton:  out << "StackAutomaton\n";  break;
        case AutomatonType::TuringMachine:   out << "TuringMachine\n";   break;
    }

    if (model.getType() == AutomatonType::StackAutomaton && model.getPDA()) {
        // initial stack symbol is embedded in PDA; expose via a header field
        // We can't easily extract it without adding a getter to PDA, so we skip it here.
        // The GUI serializer already handles this via pdaInitialStackSymbol.
    }

    out << "\n[States]\n";
    out << "# name, initial, final\n";
    for (const auto& state : model.getStates()) {
        bool isInitial = (state == model.getInitialState());
        bool isFinal   = model.isFinalState(state);
        out << state << "," << (isInitial ? 1 : 0) << "," << (isFinal ? 1 : 0) << "\n";
    }

    out << "\n[Transitions]\n";
    AutomatonType t = model.getType();
    if (t == AutomatonType::FiniteAutomaton) {
        out << "# from, to, symbol\n";
        for (const auto& [from, sym, to] : model.getTransitionHandler().getAllTransitions()) {
            out << from << "," << to << "," << encodeSymbol(sym) << "\n";
        }
    } else if (t == AutomatonType::StackAutomaton && model.getPDA()) {
        out << "# from, to, input, pop, push\n";
        for (const auto& trans : model.getPDA()->getTransitions()) {
            out << trans.from << "," << trans.to << ","
                << encodeSymbol(trans.input) << ","
                << encodeSymbol(trans.pop) << ","
                << (trans.push.empty() ? "ε" : trans.push) << "\n";
        }
    } else if (t == AutomatonType::TuringMachine && model.getTM()) {
        out << "# from, to, read, write, direction\n";
        for (const auto& trans : model.getTM()->getTransitions()) {
            char dir = 'S';
            if (trans.moveDirection == TM_MoveDirection::LEFT)  dir = 'L';
            if (trans.moveDirection == TM_MoveDirection::RIGHT) dir = 'R';
            out << trans.fromState << "," << trans.toState << ","
                << encodeSymbol(trans.readSymbol) << ","
                << encodeSymbol(trans.writeSymbol) << ","
                << dir << "\n";
        }
    }

    return {true, ""};
}

AutomatonSerializer::Result AutomatonSerializer::load(AutomatonModel& model,
                                                       const std::string& filePath) {
    std::ifstream in(filePath);
    if (!in.is_open()) {
        return {false, "Cannot open file: " + filePath};
    }

    model.clear();

    std::string section;
    std::string line;
    AutomatonType loadedType = AutomatonType::FiniteAutomaton;
    char pdaInitialStack = 'Z';

    while (std::getline(in, line)) {
        line = trim(line);
        if (line.empty() || line[0] == '#') continue;

        if (line.rfind("Automaton:", 0) == 0) {
            model.setName(trim(line.substr(10)));
        } else if (line.rfind("Alphabet:", 0) == 0) {
            std::string symbols = trim(line.substr(9));
            for (char c : symbols) {
                if (c != ' ') model.addSymbol(c);
            }
        } else if (line.rfind("Type:", 0) == 0) {
            std::string typeStr = trim(line.substr(5));
            if (typeStr == "StackAutomaton")  loadedType = AutomatonType::StackAutomaton;
            else if (typeStr == "TuringMachine") loadedType = AutomatonType::TuringMachine;
            else loadedType = AutomatonType::FiniteAutomaton;
            model.setType(loadedType);
        } else if (line.rfind("InitialStackSymbol:", 0) == 0) {
            std::string sym = trim(line.substr(19));
            if (!sym.empty()) pdaInitialStack = sym[0];
        } else if (line == "[States]") {
            section = "States";
        } else if (line == "[Transitions]") {
            section = "Transitions";
            // Initialize PDA/TM now that states and type are known
            if (loadedType == AutomatonType::StackAutomaton) {
                try { model.initializePDA(pdaInitialStack); } catch (...) {}
            } else if (loadedType == AutomatonType::TuringMachine) {
                try { model.initializeTM('_'); } catch (...) {}
            }
        } else if (section == "States") {
            auto parts = split(line, ',');
            if (parts.size() < 3) continue;
            model.addState(parts[0]);
            if (parts[1] == "1") {
                try { model.setInitialState(parts[0]); } catch (...) {}
            }
            if (parts[2] == "1") {
                try { model.addFinalState(parts[0]); } catch (...) {}
            }
        } else if (section == "Transitions") {
            auto parts = split(line, ',');
            if (loadedType == AutomatonType::FiniteAutomaton) {
                if (parts.size() < 3) continue;
                char sym = decodeSymbol(parts[2]);
                try { model.addTransition(parts[0], sym, parts[1]); } catch (...) {}
            } else if (loadedType == AutomatonType::StackAutomaton) {
                if (parts.size() < 5) continue;
                PDA_Transition t;
                t.from  = parts[0];
                t.to    = parts[1];
                t.input = decodeSymbol(parts[2]);
                t.pop   = decodeSymbol(parts[3]);
                t.push  = (parts[4] == "ε") ? "" : parts[4];
                try { model.addPDATransition(t); } catch (...) {}
            } else if (loadedType == AutomatonType::TuringMachine) {
                if (parts.size() < 5) continue;
                char dir = parts[4].empty() ? 'S' : parts[4][0];
                try {
                    model.addTMTransition(parts[0], decodeSymbol(parts[2]),
                                          parts[1], decodeSymbol(parts[3]), dir);
                } catch (...) {}
            }
        }
    }

    return {true, ""};
}
