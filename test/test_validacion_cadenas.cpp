#include <gtest/gtest.h>
#include <string>
#include <vector>
#include <set>
#include <algorithm>

#include "core/Transition.h"
#include "utils/StringValidation.h"

// Helper: compare two vectors ignoring order.
static void assertVectorsEqualUnordered(std::vector<std::string> actual,
                                        std::vector<std::string> expected) {
    std::sort(actual.begin(), actual.end());
    std::sort(expected.begin(), expected.end());
    ASSERT_EQ(actual, expected);
}

// Test fixture with several automata pre-built.
class StringValidationTest : public ::testing::Test {
protected:
    // 1. Simple DFA that accepts only "ab"
    Transition dfa;
    std::string dfa_initial = "q0";
    std::set<std::string> dfa_final = {"q2"};
    std::vector<char> dfa_alphabet = {'a', 'b'};

    // 2. NFA that accepts a+b (strings "ab", "aab", "aaab", …)
    Transition nfa;
    std::string nfa_initial = "q0";
    std::set<std::string> nfa_final = {"q2"};
    std::vector<char> nfa_alphabet = {'a', 'b'};

    // 3. Automaton with cycles that accepts strings ending in '1'
    Transition cycle_automaton;
    std::string cycle_initial = "S";
    std::set<std::string> cycle_final = {"A"};
    std::vector<char> cycle_alphabet = {'0', '1'};

    // 4. Automaton whose initial state is also final (accepts the empty string)
    Transition empty_string_automaton;
    std::string empty_initial = "q0";
    std::set<std::string> empty_final = {"q0"};
    std::vector<char> empty_alphabet = {'a'};

    void SetUp() override {
        dfa.addTransition("q0", 'a', "q1");
        dfa.addTransition("q1", 'b', "q2");

        nfa.addTransition("q0", 'a', "q0");
        nfa.addTransition("q0", 'a', "q1");
        nfa.addTransition("q1", 'b', "q2");

        cycle_automaton.addTransition("S", '0', "S");
        cycle_automaton.addTransition("S", '1', "A");
        cycle_automaton.addTransition("A", '0', "S");
        cycle_automaton.addTransition("A", '1', "A");

        empty_string_automaton.addTransition("q0", 'a', "q1");
    }
};

// ===================== validateString =====================

TEST_F(StringValidationTest, ValidateString_DFA_CorrectPath) {
    std::set<std::string> expected = {"q2"};
    EXPECT_EQ(validateString(dfa, dfa_initial, "ab"), expected);
}

TEST_F(StringValidationTest, ValidateString_DFA_IncompletePath) {
    std::set<std::string> expected = {"q1"};
    EXPECT_EQ(validateString(dfa, dfa_initial, "a"), expected);
}

TEST_F(StringValidationTest, ValidateString_DFA_InvalidPath) {
    std::set<std::string> expected = {};
    EXPECT_EQ(validateString(dfa, dfa_initial, "b"),   expected);
    EXPECT_EQ(validateString(dfa, dfa_initial, "aba"), expected);
}

TEST_F(StringValidationTest, ValidateString_NFA_MultipleEndStates) {
    std::set<std::string> expected = {"q0", "q1"};
    EXPECT_EQ(validateString(nfa, nfa_initial, "a"), expected);
}

TEST_F(StringValidationTest, ValidateString_NFA_ReachesFinal) {
    std::set<std::string> expected = {"q2"};
    EXPECT_EQ(validateString(nfa, nfa_initial, "aab"), expected);
}

TEST_F(StringValidationTest, ValidateString_EmptyInput) {
    std::set<std::string> expected = {"q0"};
    EXPECT_EQ(validateString(dfa, dfa_initial, ""), expected);
}

// ===================== isAccepted =====================

TEST_F(StringValidationTest, IsAccepted_DFA_Accepts) {
    EXPECT_TRUE(isAccepted(dfa, dfa_initial, dfa_final, "ab"));
}

TEST_F(StringValidationTest, IsAccepted_DFA_Rejects) {
    EXPECT_FALSE(isAccepted(dfa, dfa_initial, dfa_final, "a"));
    EXPECT_FALSE(isAccepted(dfa, dfa_initial, dfa_final, "b"));
    EXPECT_FALSE(isAccepted(dfa, dfa_initial, dfa_final, ""));
}

TEST_F(StringValidationTest, IsAccepted_NFA_Accepts) {
    EXPECT_TRUE(isAccepted(nfa, nfa_initial, nfa_final, "ab"));
    EXPECT_TRUE(isAccepted(nfa, nfa_initial, nfa_final, "aab"));
}

TEST_F(StringValidationTest, IsAccepted_NFA_Rejects) {
    EXPECT_FALSE(isAccepted(nfa, nfa_initial, nfa_final, "b"));
    EXPECT_FALSE(isAccepted(nfa, nfa_initial, nfa_final, "a"));
}

TEST_F(StringValidationTest, IsAccepted_EmptyString) {
    EXPECT_TRUE( isAccepted(empty_string_automaton, empty_initial, empty_final, ""));
    EXPECT_FALSE(isAccepted(empty_string_automaton, empty_initial, empty_final, "a"));
}

// ===================== generateAcceptedStrings =====================

TEST_F(StringValidationTest, GenerateAcceptedStrings_DFA) {
    std::vector<std::string> expected = {"ab"};
    auto result = generateAcceptedStrings(dfa, dfa_initial, dfa_final, dfa_alphabet, 3);
    assertVectorsEqualUnordered(result, expected);
}

TEST_F(StringValidationTest, GenerateAcceptedStrings_NFA) {
    std::vector<std::string> expected = {"ab", "aab", "aaab"};
    auto result = generateAcceptedStrings(nfa, nfa_initial, nfa_final, nfa_alphabet, 4);
    assertVectorsEqualUnordered(result, expected);
}

TEST_F(StringValidationTest, GenerateAcceptedStrings_Cycle) {
    std::vector<std::string> expected = {"1", "01", "11", "001", "011", "101", "111"};
    auto result = generateAcceptedStrings(cycle_automaton, cycle_initial, cycle_final, cycle_alphabet, 3);
    assertVectorsEqualUnordered(result, expected);
}

TEST_F(StringValidationTest, GenerateAcceptedStrings_EmptyString) {
    std::vector<std::string> expected = {""};
    auto result = generateAcceptedStrings(empty_string_automaton, empty_initial, empty_final, empty_alphabet, 2);
    assertVectorsEqualUnordered(result, expected);
}

TEST_F(StringValidationTest, GenerateAcceptedStrings_UnreachableFinal) {
    std::set<std::string> unreachable = {"q_unreachable"};
    auto result = generateAcceptedStrings(dfa, dfa_initial, unreachable, dfa_alphabet, 5);
    ASSERT_TRUE(result.empty());
}

// ===================== generateStringsWithLimit =====================

TEST_F(StringValidationTest, GenerateStringsWithLimit_DFA) {
    std::vector<std::string> expected = {"ab"};
    auto result = generateStringsWithLimit(dfa, dfa_initial, dfa_final, dfa_alphabet, 3, 2);
    assertVectorsEqualUnordered(result, expected);
}

TEST_F(StringValidationTest, GenerateStringsWithLimit_Cycle_Limit2) {
    std::vector<std::string> expected = {"1", "01", "11", "101", "011"};
    auto result = generateStringsWithLimit(cycle_automaton, cycle_initial, cycle_final, cycle_alphabet, 4, 2);
    assertVectorsEqualUnordered(result, expected);
}

TEST_F(StringValidationTest, GenerateStringsWithLimit_Cycle_Limit1) {
    std::vector<std::string> expected = {"1"};
    auto result = generateStringsWithLimit(cycle_automaton, cycle_initial, cycle_final, cycle_alphabet, 4, 1);
    assertVectorsEqualUnordered(result, expected);
}
