#include <gtest/gtest.h>
#include <string>
#include <vector>
#include <set>
#include <algorithm> // For std::sort

// Include the headers for the code we are testing
#include "Transition.h"
#include "validacion_cadenas.h"

// Helper function to compare two vectors of strings, ignoring element order.
// This makes tests robust against changes in the order of results.
void assertVectorsEqualUnordered(std::vector<std::string> actual, std::vector<std::string> expected) {
    std::sort(actual.begin(), actual.end());
    std::sort(expected.begin(), expected.end());
    ASSERT_EQ(actual, expected);
}


// A test fixture class to set up common objects (automata) for all tests.
class AutomataTest : public ::testing::Test {
protected:
    // We will define several automata to test different scenarios.

    // 1. Simple DFA that accepts only "ab"
    Transition dfa;
    std::string dfa_initial = "q0";
    std::set<std::string> dfa_final = {"q2"};
    std::vector<char> dfa_alphabet = {'a', 'b'};

    // 2. NFA that accepts strings like "ab", "aab", "aaab", etc. (a+b)
    Transition nfa;
    std::string nfa_initial = "q0";
    std::set<std::string> nfa_final = {"q2"};
    std::vector<char> nfa_alphabet = {'a', 'b'};

    // 3. Automaton with cycles that accepts strings ending in '1'
    Transition cycle_automaton;
    std::string cycle_initial = "S";
    std::set<std::string> cycle_final = {"A"};
    std::vector<char> cycle_alphabet = {'0', '1'};

    // 4. Automaton that accepts only the empty string ""
    Transition empty_string_automaton;
    std::string empty_initial = "q0";
    std::set<std::string> empty_final = {"q0"};
    std::vector<char> empty_alphabet = {'a'};

    // The SetUp() method is called before each test.
    void SetUp() override {
        // Automaton 1: Simple DFA for "ab"
        dfa.addTransition("q0", 'a', "q1");
        dfa.addTransition("q1", 'b', "q2");

        // Automaton 2: NFA for a+b
        nfa.addTransition("q0", 'a', "q0");
        nfa.addTransition("q0", 'a', "q1");
        nfa.addTransition("q1", 'b', "q2");

        // Automaton 3: Contains cycles
        cycle_automaton.addTransition("S", '0', "S");
        cycle_automaton.addTransition("S", '1', "A");
        cycle_automaton.addTransition("A", '0', "S");
        cycle_automaton.addTransition("A", '1', "A");

        // Automaton 4: Accepts empty string
        empty_string_automaton.addTransition("q0", 'a', "q1");
    }
};

// --- 🧪 Tests for validarCadena ---
// This function should return the set of states reached after processing a string.
//--------------------------------------------------------------------------------

TEST_F(AutomataTest, ValidarCadenaDFA_CorrectPath) {
    std::set<std::string> expected = {"q2"};
    EXPECT_EQ(validarCadena(dfa, dfa_initial, "ab"), expected);
}

TEST_F(AutomataTest, ValidarCadenaDFA_IncompletePath) {
    std::set<std::string> expected = {"q1"};
    EXPECT_EQ(validarCadena(dfa, dfa_initial, "a"), expected);
}

TEST_F(AutomataTest, ValidarCadenaDFA_InvalidPath) {
    std::set<std::string> expected = {}; // Empty set for invalid paths
    EXPECT_EQ(validarCadena(dfa, dfa_initial, "b"), expected);
    EXPECT_EQ(validarCadena(dfa, dfa_initial, "aba"), expected);
}

TEST_F(AutomataTest, ValidarCadenaNFA_MultipleEndStates) {
    // For string "a", the NFA can be in state q0 or q1
    std::set<std::string> expected = {"q0", "q1"};
    EXPECT_EQ(validarCadena(nfa, nfa_initial, "a"), expected);
}

TEST_F(AutomataTest, ValidarCadenaNFA_ReachesFinal) {
    // Path: q0 --a--> q0 --a--> q1 --b--> q2
    std::set<std::string> expected = {"q2"};
    EXPECT_EQ(validarCadena(nfa, nfa_initial, "aab"), expected);
}

TEST_F(AutomataTest, ValidarCadenaEmptyString) {
    // With an empty string, we should end up only in the initial state
    std::set<std::string> expected = {"q0"};
    EXPECT_EQ(validarCadena(dfa, dfa_initial, ""), expected);
}


// --- 🧪 Tests for esAceptada ---
// This function should return true if any reached state is a final state.
//--------------------------------------------------------------------------------

TEST_F(AutomataTest, EsAceptadaDFA_Accepts) {
    EXPECT_TRUE(esAceptada(dfa, dfa_initial, dfa_final, "ab"));
}

TEST_F(AutomataTest, EsAceptadaDFA_Rejects) {
    EXPECT_FALSE(esAceptada(dfa, dfa_initial, dfa_final, "a"));
    EXPECT_FALSE(esAceptada(dfa, dfa_initial, dfa_final, "b"));
    EXPECT_FALSE(esAceptada(dfa, dfa_initial, dfa_final, ""));
}

TEST_F(AutomataTest, EsAceptadaNFA_Accepts) {
    EXPECT_TRUE(esAceptada(nfa, nfa_initial, nfa_final, "ab"));
    EXPECT_TRUE(esAceptada(nfa, nfa_initial, nfa_final, "aab"));
}

TEST_F(AutomataTest, EsAceptadaNFA_Rejects) {
    EXPECT_FALSE(esAceptada(nfa, nfa_initial, nfa_final, "b"));
    EXPECT_FALSE(esAceptada(nfa, nfa_initial, nfa_final, "a")); // Reaches {q0, q1}, neither is final
}

TEST_F(AutomataTest, EsAceptadaEmptyString) {
    EXPECT_TRUE(esAceptada(empty_string_automaton, empty_initial, empty_final, ""));
    EXPECT_FALSE(esAceptada(empty_string_automaton, empty_initial, empty_final, "a"));
}


// --- 🧪 Tests for generarCadenasAceptadas ---
// This function generates all accepted strings up to a max length.
//--------------------------------------------------------------------------------

TEST_F(AutomataTest, GenerarCadenasDFA) {
    std::vector<std::string> expected = {"ab"};
    auto result = generarCadenasAceptadas(dfa, dfa_initial, dfa_final, dfa_alphabet, 3);
    assertVectorsEqualUnordered(result, expected);
}

TEST_F(AutomataTest, GenerarCadenasNFA) {
    std::vector<std::string> expected = {"ab", "aab", "aaab"};
    auto result = generarCadenasAceptadas(nfa, nfa_initial, nfa_final, nfa_alphabet, 4);
    assertVectorsEqualUnordered(result, expected);
}

TEST_F(AutomataTest, GenerarCadenasCycle) {
    std::vector<std::string> expected = {"1", "01", "11", "001", "011", "101", "111"};
    auto result = generarCadenasAceptadas(cycle_automaton, cycle_initial, cycle_final, cycle_alphabet, 3);
    assertVectorsEqualUnordered(result, expected);
}

TEST_F(AutomataTest, GenerarCadenasEmptyString) {
    std::vector<std::string> expected = {""};
    auto result = generarCadenasAceptadas(empty_string_automaton, empty_initial, empty_final, empty_alphabet, 2);
    assertVectorsEqualUnordered(result, expected);
}

TEST_F(AutomataTest, GenerarCadenasNoAcceptedStrings) {
    std::set<std::string> unreachable_final_state = {"q_unreachable"};
    auto result = generarCadenasAceptadas(dfa, dfa_initial, unreachable_final_state, dfa_alphabet, 5);
    ASSERT_TRUE(result.empty());
}


// --- 🧪 Tests for generarCadenasConLimite ---
// This function generates strings but limits path exploration to handle cycles.
//--------------------------------------------------------------------------------

TEST_F(AutomataTest, GenerarConLimiteDFA) {
    // Should behave identically to the unlimited version for a simple DFA.
    std::vector<std::string> expected = {"ab"};
    auto result = generarCadenasConLimite(dfa, dfa_initial, dfa_final, dfa_alphabet, 3, 2);
    assertVectorsEqualUnordered(result, expected);
}

TEST_F(AutomataTest, GenerarConLimiteCycle_Limit2) {
    // Cycle limit of 2 means a state can appear on a path at most twice.
    // e.g., S->0->S is okay, but S->0->S->0->S is not.
    std::vector<std::string> expected = {"1", "01", "11", "101", "011"};
    auto result = generarCadenasConLimite(cycle_automaton, cycle_initial, cycle_final, cycle_alphabet, 4, 2);
    assertVectorsEqualUnordered(result, expected);
}

TEST_F(AutomataTest, GenerarConLimiteCycle_Limit1) {
    // A cycle limit of 1 means a state cannot be revisited. Effectively, no cycles allowed.
    std::vector<std::string> expected = {"1"};
    auto result = generarCadenasConLimite(cycle_automaton, cycle_initial, cycle_final, cycle_alphabet, 4, 1);
    assertVectorsEqualUnordered(result, expected);
}