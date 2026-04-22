#include <gtest/gtest.h>
#include "utils/Alphabet.h"
#include <stdexcept>

// ==================== Valid Input Tests ====================

TEST(AlphabetTest, ValidSingleCharacter) {
    auto result = parseAlphabet("(a)");
    ASSERT_EQ(result.size(), 1);
    EXPECT_EQ(result[0], 'a');
}

TEST(AlphabetTest, ValidMultipleCharacters) {
    auto result = parseAlphabet("(a,b,c)");
    ASSERT_EQ(result.size(), 3);
    EXPECT_EQ(result[0], 'a');
    EXPECT_EQ(result[1], 'b');
    EXPECT_EQ(result[2], 'c');
}

TEST(AlphabetTest, ValidWithNumbers) {
    auto result = parseAlphabet("(0,1,2)");
    ASSERT_EQ(result.size(), 3);
    EXPECT_EQ(result[0], '0');
    EXPECT_EQ(result[1], '1');
    EXPECT_EQ(result[2], '2');
}

TEST(AlphabetTest, ValidWithSpecialCharacters) {
    auto result = parseAlphabet("(!,@,#)");
    ASSERT_EQ(result.size(), 3);
    EXPECT_EQ(result[0], '!');
    EXPECT_EQ(result[1], '@');
    EXPECT_EQ(result[2], '#');
}

TEST(AlphabetTest, ValidMixedCharacters) {
    auto result = parseAlphabet("(a,1,@,z)");
    ASSERT_EQ(result.size(), 4);
    EXPECT_EQ(result[0], 'a');
    EXPECT_EQ(result[1], '1');
    EXPECT_EQ(result[2], '@');
    EXPECT_EQ(result[3], 'z');
}

TEST(AlphabetTest, ValidLargeAlphabet) {
    auto result = parseAlphabet("(a,b,c,d,e,f,g,h,i,j)");
    EXPECT_EQ(result.size(), 10);
}

// ==================== Invalid Format Tests ====================

TEST(AlphabetTest, MissingOpeningParenthesis) {
    EXPECT_THROW({ parseAlphabet("a,b,c)"); }, std::invalid_argument);
}

TEST(AlphabetTest, MissingClosingParenthesis) {
    EXPECT_THROW({ parseAlphabet("(a,b,c"); }, std::invalid_argument);
}

TEST(AlphabetTest, MissingBothParentheses) {
    EXPECT_THROW({ parseAlphabet("a,b,c"); }, std::invalid_argument);
}

TEST(AlphabetTest, EmptyString) {
    EXPECT_THROW({ parseAlphabet(""); }, std::invalid_argument);
}

TEST(AlphabetTest, OnlyParentheses) {
    EXPECT_THROW({ parseAlphabet("()"); }, std::invalid_argument);
}

TEST(AlphabetTest, OnlyOpeningParenthesis) {
    EXPECT_THROW({ parseAlphabet("("); }, std::invalid_argument);
}

// ==================== Multi-Character Symbol Tests ====================

TEST(AlphabetTest, MultiCharacterSymbol) {
    EXPECT_THROW({ parseAlphabet("(ab,c)"); }, std::invalid_argument);
}

TEST(AlphabetTest, MultiCharacterSymbolInMiddle) {
    EXPECT_THROW({ parseAlphabet("(a,bc,d)"); }, std::invalid_argument);
}

TEST(AlphabetTest, WordAsSymbol) {
    EXPECT_THROW({ parseAlphabet("(hello)"); }, std::invalid_argument);
}

TEST(AlphabetTest, EmptySymbolBetweenCommas) {
    EXPECT_THROW({ parseAlphabet("(a,,b)"); }, std::invalid_argument);
}

// ==================== Duplicate Tests ====================

TEST(AlphabetTest, DuplicateCharacter) {
    EXPECT_THROW({ parseAlphabet("(a,b,a)"); }, std::invalid_argument);
}

TEST(AlphabetTest, MultipleDuplicates) {
    EXPECT_THROW({ parseAlphabet("(a,a,a)"); }, std::invalid_argument);
}

TEST(AlphabetTest, DuplicateInLargeSet) {
    EXPECT_THROW({ parseAlphabet("(a,b,c,d,e,f,g,h,a)"); }, std::invalid_argument);
}

TEST(AlphabetTest, DuplicateNumbers) {
    EXPECT_THROW({ parseAlphabet("(0,1,2,1)"); }, std::invalid_argument);
}

// ==================== Whitespace Tests ====================

TEST(AlphabetTest, SpaceAsSymbol) {
    auto result = parseAlphabet("( )");
    ASSERT_EQ(result.size(), 1);
    EXPECT_EQ(result[0], ' ');
}

TEST(AlphabetTest, SpaceWithOtherSymbols) {
    auto result = parseAlphabet("(a, ,b)");
    ASSERT_EQ(result.size(), 3);
    EXPECT_EQ(result[0], 'a');
    EXPECT_EQ(result[1], ' ');
    EXPECT_EQ(result[2], 'b');
}

// ==================== Edge Cases ====================

TEST(AlphabetTest, BracketSymbols) {
    auto result = parseAlphabet("([,])");
    ASSERT_EQ(result.size(), 2);
    EXPECT_EQ(result[0], '[');
    EXPECT_EQ(result[1], ']');
}

TEST(AlphabetTest, PunctuationSymbols) {
    auto result = parseAlphabet("(;,.,-)");
    ASSERT_EQ(result.size(), 3);
    EXPECT_EQ(result[0], ';');
    EXPECT_EQ(result[1], '.');
    EXPECT_EQ(result[2], '-');
}

TEST(AlphabetTest, SingleCharacterAlphabet) {
    auto result = parseAlphabet("(x)");
    ASSERT_EQ(result.size(), 1);
    EXPECT_EQ(result[0], 'x');
}

TEST(AlphabetTest, BinaryAlphabet) {
    auto result = parseAlphabet("(0,1)");
    ASSERT_EQ(result.size(), 2);
    EXPECT_EQ(result[0], '0');
    EXPECT_EQ(result[1], '1');
}

// ==================== Error Message Tests ====================

TEST(AlphabetTest, EmptyAlphabetErrorMessage) {
    try {
        parseAlphabet("()");
        FAIL() << "Expected std::invalid_argument";
    } catch (const std::invalid_argument& e) {
        EXPECT_STREQ(e.what(), "Error: alphabet cannot be empty.");
    }
}

TEST(AlphabetTest, MissingParenthesesErrorMessage) {
    try {
        parseAlphabet("a,b,c");
        FAIL() << "Expected std::invalid_argument";
    } catch (const std::invalid_argument& e) {
        EXPECT_STREQ(e.what(), "Error: alphabet must be enclosed in parentheses ( ).");
    }
}

TEST(AlphabetTest, MultiCharacterSymbolErrorMessage) {
    try {
        parseAlphabet("(ab)");
        FAIL() << "Expected std::invalid_argument";
    } catch (const std::invalid_argument& e) {
        EXPECT_STREQ(e.what(), "Error: each symbol must be a single character.");
    }
}

TEST(AlphabetTest, DuplicateSymbolErrorMessage) {
    try {
        parseAlphabet("(a,a)");
        FAIL() << "Expected std::invalid_argument";
    } catch (const std::invalid_argument& e) {
        EXPECT_STREQ(e.what(), "Error: duplicate symbol in alphabet.");
    }
}
