cmake_minimum_required(VERSION 3.21)
project(libxmjs LANGUAGES C)
set(CMAKE_C_STANDARD 23)
set(CMAKE_INTERPROCEDURAL_OPTIMIZATION TRUE)

set(XM_SAMPLE_RATE "44100" CACHE STRING "" FORCE)
set(XM_LOOPING_TYPE "0" CACHE STRING "" FORCE)
set(XM_RAMPING OFF CACHE BOOL "" FORCE)
set(XM_LINEAR_INTERPOLATION OFF CACHE BOOL "" FORCE)
set(XM_VERBOSE OFF CACHE BOOL "" FORCE)
set(BUILD_SHARED_LIBS OFF CACHE BOOL "" FORCE)

add_subdirectory(../libxm/src libxm_build)

add_library(xmjs xmjs.c)
target_link_libraries(xmjs PRIVATE xm_common)
target_link_libraries(xmjs PUBLIC xm)
