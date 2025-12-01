cmake_minimum_required(VERSION 3.14)
project(ZFlap VERSION 1.0.0)

# ---------------- Configuración de compilador ----------------
set(CMAKE_CXX_STANDARD 17)
set(CMAKE_CXX_STANDARD_REQUIRED ON)

# ---------------- Encontrar Flex (con soporte para Windows/MSYS2) ----------------
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

# ---------------- Generar Lexer con Flex ----------------
set(LEXER_L_FILE ${CMAKE_CURRENT_SOURCE_DIR}/src/Lexer.l)
set(LEXER_CPP_FILE ${CMAKE_CURRENT_BINARY_DIR}/src/Lexer.cpp)

file(MAKE_DIRECTORY ${CMAKE_CURRENT_BINARY_DIR}/src)

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

# ---------------- Biblioteca compartida ----------------
add_library(zflap_lib
        src/MainWindow.cpp
        src/MainWindow.h
        src/AutomatonEditor.cpp
        src/AutomatonEditor.h
        src/AlphabetSelector.cpp
        src/AlphabetSelector.h
        src/Transition.cpp
        src/TM.cpp
        src/TM.h
        src/validacion_cadenas.cpp
        src/validacion_cadenas.h
        src/AdP.cpp
        src/AdP.h
        ${LEXER_CPP_FILE} 
)

target_include_directories(zflap_lib PUBLIC src ${CMAKE_CURRENT_BINARY_DIR}/src)

# ---------------- GoogleTest ----------------
find_package(GTest QUIET)
if(GTest_FOUND)
    add_executable(test_transition test/test_transition.cpp)
    target_link_libraries(test_transition PRIVATE zflap_lib GTest::gtest GTest::gtest_main)
    add_executable(test_tm test/test_tm.cpp)
    target_link_libraries(test_tm PRIVATE zflap_lib GTest::gtest GTest::gtest_main)
    add_executable(test_pda test/test_pda.cpp)
    target_link_libraries(test_pda PRIVATE zflap_lib GTest::gtest GTest::gtest_main)
endif()

# ---------------- Qt6 Widgets ----------------
find_package(Qt6 REQUIRED COMPONENTS Widgets)
target_link_libraries(zflap_lib PUBLIC Qt6::Widgets)

# ---------------- Ejecutable principal ----------------
add_executable(zflap src/main.cpp)
target_link_libraries(zflap PRIVATE zflap_lib Qt6::Widgets)
