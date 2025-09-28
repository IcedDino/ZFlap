cmake_minimum_required(VERSION 3.10)
project(ZFlap VERSION 1.0.0)

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

# Find Doxygen
find_package(Doxygen REQUIRED)

# Configure Doxygen
set(DOXYGEN_IN ${CMAKE_CURRENT_SOURCE_DIR}/Doxyfile)
set(DOXYGEN_OUT ${CMAKE_CURRENT_BINARY_DIR}/docs)

# Create custom target for documentation generation
add_custom_target(docs
    COMMAND ${DOXYGEN_EXECUTABLE} ${DOXYGEN_IN}
    WORKING_DIRECTORY ${CMAKE_CURRENT_SOURCE_DIR}
    COMMENT "Generating API documentation with Doxygen"
    VERBATIM
)

# Create docs directory
file(MAKE_DIRECTORY ${DOXYGEN_OUT})

# Optional: Install documentation
install(DIRECTORY ${DOXYGEN_OUT}/
    DESTINATION share/doc/zflap
    OPTIONAL
)

