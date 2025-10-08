
// Created by jaquy on 30/09/2025.
//

#include <gtest/gtest.h>
#include "Alfabeto.h"
#include <stdexcept>

// ==================== Valid Input Tests ====================

TEST(AlfabetoTest, ValidSingleCharacter) {
    auto result = guardarAbecedario("(a)");
    ASSERT_EQ(result.size(), 1);
    EXPECT_EQ(result[0], 'a');
}

TEST(AlfabetoTest, ValidMultipleCharacters) {
    auto result = guardarAbecedario("(a,b,c)");
    ASSERT_EQ(result.size(), 3);
    EXPECT_EQ(result[0], 'a');
    EXPECT_EQ(result[1], 'b');
    EXPECT_EQ(result[2], 'c');
}

TEST(AlfabetoTest, ValidWithNumbers) {
    auto result = guardarAbecedario("(0,1,2)");
    ASSERT_EQ(result.size(), 3);
    EXPECT_EQ(result[0], '0');
    EXPECT_EQ(result[1], '1');
    EXPECT_EQ(result[2], '2');
}

TEST(AlfabetoTest, ValidWithSpecialCharacters) {
    auto result = guardarAbecedario("(!,@,#)");
    ASSERT_EQ(result.size(), 3);
    EXPECT_EQ(result[0], '!');
    EXPECT_EQ(result[1], '@');
    EXPECT_EQ(result[2], '#');
}

TEST(AlfabetoTest, ValidMixedCharacters) {
    auto result = guardarAbecedario("(a,1,@,z)");
    ASSERT_EQ(result.size(), 4);
    EXPECT_EQ(result[0], 'a');
    EXPECT_EQ(result[1], '1');
    EXPECT_EQ(result[2], '@');
    EXPECT_EQ(result[3], 'z');
}

TEST(AlfabetoTest, ValidLargeAlphabet) {
    auto result = guardarAbecedario("(a,b,c,d,e,f,g,h,i,j)");
    EXPECT_EQ(result.size(), 10);
}

// ==================== Invalid Format Tests ====================

TEST(AlfabetoTest, MissingOpeningParenthesis) {
    EXPECT_THROW({
        guardarAbecedario("a,b,c)");
    }, std::invalid_argument);
}

TEST(AlfabetoTest, MissingClosingParenthesis) {
    EXPECT_THROW({
        guardarAbecedario("(a,b,c");
    }, std::invalid_argument);
}

TEST(AlfabetoTest, MissingBothParentheses) {
    EXPECT_THROW({
        guardarAbecedario("a,b,c");
    }, std::invalid_argument);
}

TEST(AlfabetoTest, EmptyString) {
    EXPECT_THROW({
        guardarAbecedario("");
    }, std::invalid_argument);
}

TEST(AlfabetoTest, OnlyParentheses) {
    EXPECT_THROW({
        guardarAbecedario("()");
    }, std::invalid_argument);
}

TEST(AlfabetoTest, OnlyOpeningParenthesis) {
    EXPECT_THROW({
        guardarAbecedario("(");
    }, std::invalid_argument);
}

// ==================== Multi-Character Symbol Tests ====================

TEST(AlfabetoTest, MultiCharacterSymbol) {
    EXPECT_THROW({
        guardarAbecedario("(ab,c)");
    }, std::invalid_argument);
}

TEST(AlfabetoTest, MultiCharacterSymbolInMiddle) {
    EXPECT_THROW({
        guardarAbecedario("(a,bc,d)");
    }, std::invalid_argument);
}

TEST(AlfabetoTest, WordAsSymbol) {
    EXPECT_THROW({
        guardarAbecedario("(hello)");
    }, std::invalid_argument);
}

TEST(AlfabetoTest, EmptySymbolBetweenCommas) {
    EXPECT_THROW({
        guardarAbecedario("(a,,b)");
    }, std::invalid_argument);
}

// ==================== Duplicate Tests ====================

TEST(AlfabetoTest, DuplicateCharacter) {
    EXPECT_THROW({
        guardarAbecedario("(a,b,a)");
    }, std::invalid_argument);
}

TEST(AlfabetoTest, MultipleDuplicates) {
    EXPECT_THROW({
        guardarAbecedario("(a,a,a)");
    }, std::invalid_argument);
}

TEST(AlfabetoTest, DuplicateInLargeSet) {
    EXPECT_THROW({
        guardarAbecedario("(a,b,c,d,e,f,g,h,a)");
    }, std::invalid_argument);
}

TEST(AlfabetoTest, DuplicateNumbers) {
    EXPECT_THROW({
        guardarAbecedario("(0,1,2,1)");
    }, std::invalid_argument);
}

// ==================== Whitespace Tests ====================

TEST(AlfabetoTest, SpaceAsSymbol) {
    auto result = guardarAbecedario("( )");
    ASSERT_EQ(result.size(), 1);
    EXPECT_EQ(result[0], ' ');
}

TEST(AlfabetoTest, SpaceWithOtherSymbols) {
    auto result = guardarAbecedario("(a, ,b)");
    ASSERT_EQ(result.size(), 3);
    EXPECT_EQ(result[0], 'a');
    EXPECT_EQ(result[1], ' ');
    EXPECT_EQ(result[2], 'b');
}

// Note: If whitespace in symbols like "(a, b)" should be trimmed,
// additional tests would be needed. Current implementation treats
// " b" as a two-character symbol which would throw an error.

// ==================== Edge Cases ====================

TEST(AlfabetoTest, ParenthesisAsSymbol) {
    // Note: This might cause parsing issues depending on implementation
    // Testing if parentheses can be symbols themselves
    auto result = guardarAbecedario("([,])");
    ASSERT_EQ(result.size(), 2);
    EXPECT_EQ(result[0], '[');
    EXPECT_EQ(result[1], ']');
}

TEST(AlfabetoTest, CommaLikeCharacters) {
    auto result = guardarAbecedario("(;,.,-)");
    ASSERT_EQ(result.size(), 3);
    EXPECT_EQ(result[0], ';');
    EXPECT_EQ(result[1], '.');
    EXPECT_EQ(result[2], '-');
}

TEST(AlfabetoTest, SingleCharacterAlphabet) {
    auto result = guardarAbecedario("(x)");
    ASSERT_EQ(result.size(), 1);
    EXPECT_EQ(result[0], 'x');
}

TEST(AlfabetoTest, BinaryAlphabet) {
    auto result = guardarAbecedario("(0,1)");
    ASSERT_EQ(result.size(), 2);
    EXPECT_EQ(result[0], '0');
    EXPECT_EQ(result[1], '1');
}

// ==================== Error Message Tests ====================

TEST(AlfabetoTest, EmptyAlphabetErrorMessage) {
    try {
        guardarAbecedario("()");
        FAIL() << "Expected std::invalid_argument";
    } catch (const std::invalid_argument& e) {
        EXPECT_STREQ(e.what(), "Error: el alfabeto no puede estar vacio.");
    }
}

TEST(AlfabetoTest, MissingParenthesesErrorMessage) {
    try {
        guardarAbecedario("a,b,c");
        FAIL() << "Expected std::invalid_argument";
    } catch (const std::invalid_argument& e) {
        EXPECT_STREQ(e.what(), "Error: el alfabeto debe estar entre parentesis ( ).");
    }
}

TEST(AlfabetoTest, MultiCharacterSymbolErrorMessage) {
    try {
        guardarAbecedario("(ab)");
        FAIL() << "Expected std::invalid_argument";
    } catch (const std::invalid_argument& e) {
        EXPECT_STREQ(e.what(), "Error: cada simbolo debe ser un caracter individual.");
    }
}

TEST(AlfabetoTest, DuplicateSymbolErrorMessage) {
    try {
        guardarAbecedario("(a,a)");
        FAIL() << "Expected std::invalid_argument";
    } catch (const std::invalid_argument& e) {
        EXPECT_STREQ(e.what(), "Error: simbolo duplicado en el alfabeto.");
    }
}