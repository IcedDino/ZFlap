cmake_minimum_required(VERSION 3.10)
project(ZFlap VERSION 1.0.0)

set(CMAKE_CXX_STANDARD 17)

# Build test executable for Transition module
add_executable(test_transition test/test_transition.cpp src/Transition.cpp)

# Add include directories for this target
target_include_directories(test_transition PRIVATE src)

# Find GoogleTest (user can override GTEST_ROOT)
set(GTEST_ROOT "" CACHE PATH "Path to GoogleTest installation")
if(GTEST_ROOT)
    set(CMAKE_PREFIX_PATH "${CMAKE_PREFIX_PATH};${GTEST_ROOT}")
endif()
find_package(GTest REQUIRED)

target_link_libraries(test_transition PRIVATE GTest::gtest GTest::gtest_main)

# Compiler warnings
if(MSVC)
    target_compile_options(test_transition PRIVATE /W4 /permissive-)
else()
    target_compile_options(test_transition PRIVATE -Wall -Wextra -pedantic)
endif()

# Doxygen
find_package(Doxygen REQUIRED)
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