#include <gtest/gtest.h>
#include "Transition.h"

// Test 1: Single DFA transition (basic)
TEST(TransitionTest, SingleTransition) {
    Transition t;
    t.addTransition("q0", 'a', "q1");
    auto result = t.getNextStates("q0", 'a');
    EXPECT_EQ(result.size(), 1);
    EXPECT_EQ(result[0], "q1");
}

// Test 2: Multiple NFA transitions from same state-symbol
TEST(TransitionTest, MultipleTransitionsSameSymbol) {
    Transition t;
    t.addTransition("q0", 'a', "q1");
    t.addTransition("q0", 'a', "q2");
    auto result = t.getNextStates("q0", 'a');
    EXPECT_EQ(result.size(), 2);
    EXPECT_TRUE((result[0] == "q1" && result[1] == "q2") ||
                (result[0] == "q2" && result[1] == "q1"));
}

// Test 3: Missing transition returns empty vector
TEST(TransitionTest, MissingTransition) {
    Transition t;
    t.addTransition("q0", 'a', "q1");
    auto result = t.getNextStates("q0", 'b'); // 'b' not defined
    EXPECT_TRUE(result.empty());
}

// Test 4: Multiple states and symbols, independent transitions
TEST(TransitionTest, DifferentStatesIndependentTransitions) {
    Transition t;
    t.addTransition("q0", 'a', "q1");
    t.addTransition("q1", 'b', "q2");
    t.addTransition("q2", 'c', "q3");

    auto r0 = t.getNextStates("q0", 'a');
    auto r1 = t.getNextStates("q1", 'b');
    auto r2 = t.getNextStates("q2", 'c');

    EXPECT_EQ(r0.size(), 1);
    EXPECT_EQ(r0[0], "q1");
    EXPECT_EQ(r1.size(), 1);
    EXPECT_EQ(r1[0], "q2");
    EXPECT_EQ(r2.size(), 1);
    EXPECT_EQ(r2[0], "q3");
}

// Test 5: Adding same transition multiple times
TEST(TransitionTest, DuplicateTransitions) {
    Transition t;
    t.addTransition("q0", 'a', "q1");
    t.addTransition("q0", 'a', "q1"); // duplicate
    auto result = t.getNextStates("q0", 'a');
    EXPECT_EQ(result.size(), 2); // should store both duplicates
    EXPECT_EQ(result[0], "q1");
    EXPECT_EQ(result[1], "q1");
}

// Test 6: Edge case with empty state and symbol
TEST(TransitionTest, EmptyStateOrSymbol) {
    Transition t;
    t.addTransition("", 'a', "q1");
    t.addTransition("q0", '\0', "q2"); // null char as symbol
    auto r1 = t.getNextStates("", 'a');
    auto r2 = t.getNextStates("q0", '\0');
    EXPECT_EQ(r1.size(), 1);
    EXPECT_EQ(r1[0], "q1");
    EXPECT_EQ(r2.size(), 1);
    EXPECT_EQ(r2[0], "q2");
}

// Test 7: Complex NFA chain
TEST(TransitionTest, NFAMultiplePaths) {
    Transition t;
    t.addTransition("q0", 'a', "q1");
    t.addTransition("q0", 'a', "q2");
    t.addTransition("q1", 'b', "q3");
    t.addTransition("q2", 'b', "q3");
    auto r0 = t.getNextStates("q0", 'a');
    auto r1 = t.getNextStates(r0[0], 'b');
    auto r2 = t.getNextStates(r0[1], 'b');
    EXPECT_EQ(r0.size(), 2);
    EXPECT_EQ(r1.size(), 1);
    EXPECT_EQ(r2.size(), 1);
    EXPECT_EQ(r1[0], "q3");
    EXPECT_EQ(r2[0], "q3");
}
