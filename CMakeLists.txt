cmake_minimum_required(VERSION 3.14) # newer than 3.10 for better find_package
project(ZFlap VERSION 1.0.0)

set(CMAKE_CXX_STANDARD 20)
set(CMAKE_CXX_STANDARD_REQUIRED ON)

# ---------------- Qt MOC Settings ----------------
set(CMAKE_AUTOMOC ON)
set(CMAKE_AUTOUIC ON)
set(CMAKE_AUTORCC ON)

# ---------------- Shared Library ----------------
add_library(zflap_lib
        src/Transition.cpp
        src/MainWindow.cpp
        src/MainWindow.h
)

target_include_directories(zflap_lib PUBLIC src)

# ---------------- GoogleTest ----------------
# Allow system, vcpkg, or Homebrew installation
find_package(GTest QUIET)

if(NOT GTest_FOUND)
    message(STATUS "GoogleTest not found, try installing it:")
    if(WIN32)
        message(STATUS "  vcpkg install gtest")
    elseif(APPLE)
        message(STATUS "  brew install googletest")
    else()
        message(STATUS "  apt-get install libgtest-dev")
    endif()
    message(FATAL_ERROR "GoogleTest is required")
endif()

add_executable(test_transition test/test_transition.cpp)
target_link_libraries(test_transition PRIVATE zflap_lib GTest::gtest GTest::gtest_main)

if(MSVC)
    target_compile_options(test_transition PRIVATE /W4 /permissive-)
else()
    target_compile_options(test_transition PRIVATE -Wall -Wextra -pedantic)
endif()

# ---------------- Qt ----------------
# CMake will look in standard locations, vcpkg, or Homebrew automatically
find_package(Qt6 REQUIRED COMPONENTS Widgets)

# Link Qt to the library since MainWindow uses Qt
target_link_libraries(zflap_lib PUBLIC Qt6::Widgets)

add_executable(zflap src/main.cpp)
target_link_libraries(zflap PRIVATE zflap_lib Qt6::Widgets)

# ---------------- Doxygen ----------------
find_package(Doxygen QUIET)

if(DOXYGEN_FOUND)
    set(DOXYGEN_IN ${CMAKE_CURRENT_SOURCE_DIR}/Doxyfile)
    set(DOXYGEN_OUT ${CMAKE_CURRENT_BINARY_DIR}/docs)

    add_custom_target(docs
            COMMAND ${DOXYGEN_EXECUTABLE} ${DOXYGEN_IN}
            WORKING_DIRECTORY ${CMAKE_CURRENT_SOURCE_DIR}
            COMMENT "Generating API documentation with Doxygen"
            VERBATIM
    )

    file(MAKE_DIRECTORY ${DOXYGEN_OUT})

    install(DIRECTORY ${DOXYGEN_OUT}/
            DESTINATION share/doc/zflap
            OPTIONAL
    )
else()
    message(STATUS "Doxygen not found, skipping docs target")
endif()
