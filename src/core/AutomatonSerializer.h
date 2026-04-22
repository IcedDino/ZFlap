#ifndef AUTOMATON_SERIALIZER_H
#define AUTOMATON_SERIALIZER_H

#include <string>
#include "AutomatonModel.h"

/**
 * @brief Serializes and deserializes AutomatonModel to/from the .zflap file format.
 *
 * This class is Qt-independent — it uses only standard C++ I/O, so it works in
 * CLI tools, unit tests, and backend services without a GUI.
 *
 * File format (plain text, v2.0):
 *   # ZFlap Automaton File v2.0
 *   Automaton: <name>
 *   Alphabet: <chars separated by spaces>
 *   Type: FiniteAutomaton | StackAutomaton | TuringMachine
 *   [InitialStackSymbol: <char>]    (PDA only)
 *
 *   [States]
 *   # name, initial, final
 *   <name>,<initial:0|1>,<final:0|1>
 *
 *   [Transitions]
 *   FA:  <from>,<to>,<symbol|ε>
 *   PDA: <from>,<to>,<input|ε>,<pop|ε>,<push|ε>
 *   TM:  <from>,<to>,<read>,<write>,<L|R|S>
 */
class AutomatonSerializer {
public:
    struct Result {
        bool ok = false;
        std::string error;
    };

    // Save model to a file. Returns {true,""} on success, {false, reason} on failure.
    static Result save(const AutomatonModel& model, const std::string& filePath);

    // Load model from a file. Returns {true,""} on success, {false, reason} on failure.
    static Result load(AutomatonModel& model, const std::string& filePath);

private:
    static std::string encodeSymbol(char c);
    static char decodeSymbol(const std::string& s);
};

#endif // AUTOMATON_SERIALIZER_H
