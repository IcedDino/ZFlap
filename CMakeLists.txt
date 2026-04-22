cmake_minimum_required(VERSION 3.14)
project(ZFlap VERSION 1.0.0)

# ---------------- Compiler settings ----------------
set(CMAKE_CXX_STANDARD 17)
set(CMAKE_CXX_STANDARD_REQUIRED ON)

# ---------------- Flex (with Windows/MSYS2 fallback) ----------------
if(WIN32)
    find_package(FLEX)
    if(NOT FLEX_FOUND)
        find_program(FLEX_EXECUTABLE NAMES flex
            PATHS "C:/msys64/usr/bin" "C:/msys64/mingw64/bin"
            NO_DEFAULT_PATH
        )
    endif()
else()
    find_package(FLEX REQUIRED)
endif()

if(NOT FLEX_EXECUTABLE)
    message(FATAL_ERROR "Flex is required, but was not found. Please install it or check your system's PATH.")
endif()

# ---------------- Generate Lexer with Flex ----------------
set(LEXER_L_FILE ${CMAKE_CURRENT_SOURCE_DIR}/src/utils/Lexer.l)
set(LEXER_CPP_FILE ${CMAKE_CURRENT_BINARY_DIR}/src/utils/Lexer.cpp)

file(MAKE_DIRECTORY ${CMAKE_CURRENT_BINARY_DIR}/src/utils)

add_custom_command(
    OUTPUT ${LEXER_CPP_FILE}
    COMMAND ${FLEX_EXECUTABLE} -o ${LEXER_CPP_FILE} ${LEXER_L_FILE}
    DEPENDS ${LEXER_L_FILE}
    COMMENT "Generating C++ lexer from ${LEXER_L_FILE}"
)

# ---------------- Qt: MOC, UIC, RCC ----------------
set(CMAKE_AUTOMOC ON)
set(CMAKE_AUTOUIC ON)
set(CMAKE_AUTORCC ON)

# ================================================================
# zflap_core — pure C++, zero Qt dependency
# All automaton logic, serialization, and utility functions.
# Tests link against this target, not zflap_lib.
# ================================================================
add_library(zflap_core STATIC
    # Core
    src/core/Transition.cpp
    src/core/Transition.h
    src/core/AutomatonModel.cpp
    src/core/AutomatonModel.h
    src/core/AutomatonSerializer.cpp
    src/core/AutomatonSerializer.h
    src/core/TM.cpp
    src/core/TM.h
    src/core/PDA.cpp
    src/core/PDA.h
    # Utils
    src/utils/Alphabet.cpp
    src/utils/Alphabet.h
    src/utils/StringValidation.cpp
    src/utils/StringValidation.h
)

target_include_directories(zflap_core PUBLIC
    ${CMAKE_CURRENT_SOURCE_DIR}/src
    ${CMAKE_CURRENT_BINARY_DIR}/src
)

# ================================================================
# zflap_lib — GUI layer; depends on zflap_core + Qt6
# ================================================================
find_package(Qt6 REQUIRED COMPONENTS Widgets)

add_library(zflap_lib
    # GUI
    src/gui/MainWindow.cpp
    src/gui/MainWindow.h
    src/gui/AutomatonEditor.cpp
    src/gui/AutomatonEditor.h
    src/gui/AlphabetSelector.cpp
    src/gui/AlphabetSelector.h
    src/gui/FlowLayout.h
    # Lexer (Qt GUI uses it)
    ${LEXER_CPP_FILE}
)

target_include_directories(zflap_lib PUBLIC
    ${CMAKE_CURRENT_SOURCE_DIR}/src
    ${CMAKE_CURRENT_BINARY_DIR}/src
)

target_link_libraries(zflap_lib PUBLIC zflap_core Qt6::Widgets)

# ================================================================
# GoogleTest — tests link against zflap_core (no Qt required)
# ================================================================
find_package(GTest QUIET)
if(NOT GTest_FOUND)
    include(FetchContent)
    FetchContent_Declare(
        googletest
        GIT_REPOSITORY https://github.com/google/googletest.git
        GIT_TAG        v1.14.0
    )
    set(gtest_force_shared_crt ON CACHE BOOL "" FORCE)
    set(BUILD_GMOCK OFF CACHE BOOL "" FORCE)
    FetchContent_MakeAvailable(googletest)
    set(GTest_FOUND TRUE)
endif()
if(GTest_FOUND)
    enable_testing()

    add_executable(test_transition test/test_transition.cpp)
    target_link_libraries(test_transition PRIVATE zflap_core GTest::gtest GTest::gtest_main)
    add_test(NAME test_transition COMMAND test_transition)

    add_executable(test_alfabeto test/test_alfabeto.cpp)
    target_link_libraries(test_alfabeto PRIVATE zflap_core GTest::gtest GTest::gtest_main)
    add_test(NAME test_alfabeto COMMAND test_alfabeto)

    add_executable(test_validacion_cadenas test/test_validacion_cadenas.cpp)
    target_link_libraries(test_validacion_cadenas PRIVATE zflap_core GTest::gtest GTest::gtest_main)
    add_test(NAME test_validacion_cadenas COMMAND test_validacion_cadenas)

    add_executable(test_pda test/test_pda.cpp)
    target_link_libraries(test_pda PRIVATE zflap_core GTest::gtest GTest::gtest_main)
    add_test(NAME test_pda COMMAND test_pda)

    add_executable(test_tm test/test_tm.cpp)
    target_link_libraries(test_tm PRIVATE zflap_core GTest::gtest GTest::gtest_main)
    add_test(NAME test_tm COMMAND test_tm)

    add_executable(test_automaton_model test/test_automaton_model.cpp)
    target_link_libraries(test_automaton_model PRIVATE zflap_core GTest::gtest GTest::gtest_main)
    add_test(NAME test_automaton_model COMMAND test_automaton_model)

    add_executable(test_serializer test/test_serializer.cpp)
    target_link_libraries(test_serializer PRIVATE zflap_core GTest::gtest GTest::gtest_main)
    add_test(NAME test_serializer COMMAND test_serializer)
endif()

# ================================================================
# Main executable
# ================================================================
add_executable(zflap src/main.cpp)
target_link_libraries(zflap PRIVATE zflap_lib Qt6::Widgets)

# ================================================================
# Examples (no Qt required)
# ================================================================
add_executable(automaton_example examples/automaton_example.cpp)
target_link_libraries(automaton_example PRIVATE zflap_core)
