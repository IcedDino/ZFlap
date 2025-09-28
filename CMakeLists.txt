cmake_minimum_required(VERSION 3.10)
project(ZFlap)

set(CMAKE_CXX_STANDARD 17)

# Include src folder for headers
include_directories(src)

# Find GoogleTest
set(GTEST_ROOT "/opt/homebrew/opt/googletest")
set(CMAKE_PREFIX_PATH ${GTEST_ROOT})
find_package(GTest REQUIRED)
include_directories(${GTEST_INCLUDE_DIRS})

# Build test executable for Transition module
add_executable(test_transition test/test_transition.cpp src/Transition.cpp)

# Link with gtest and gtest_main
target_link_libraries(test_transition GTest::gtest GTest::gtest_main)

