libxm.js
========

An emscripten port of [libxm](https://github.com/Artefact2/libxm) with most
features enabled and simple visualisation gfx. Builds a standalone HTML file,
**18925 bytes** after gzip. Loads modules from user supplied files, or directly
from The Mod Archive.

Released under the WTFPL license, version 2.

**[See a live demo here.](https://artefact2.github.io/libxm.js/)**

Building
========

* Clone this repository and fetch the submodules

* Apply the patch below in `libxm/` to work around emscripten's slightly
  different libc

```diff
diff --git i/src/CMakeLists.txt w/src/CMakeLists.txt
index c9e6144..244bb86 100644
--- i/src/CMakeLists.txt
+++ w/src/CMakeLists.txt
@@ -25,9 +25,8 @@ set_target_properties(xm PROPERTIES
 # Bump this when breaking public ABI
 set_target_properties(xm PROPERTIES SOVERSION 9)

-find_library(MATH_LIBRARY m REQUIRED)
 target_include_directories(xm SYSTEM PUBLIC ${CMAKE_CURRENT_BINARY_DIR})
-target_link_libraries(xm PRIVATE xm_common ${MATH_LIBRARY})
+target_link_libraries(xm PRIVATE xm_common m)

 function(option_and_define name description default_value)
 	option(${name} ${description} ${default_value})
diff --git i/src/load.c w/src/load.c
index ab20707..185b6e7 100644
--- i/src/load.c
+++ w/src/load.c
@@ -1684,7 +1684,7 @@ static bool xm_prescan_s3m(const char* restrict moddata,
 		if(x >= 16) continue;
 		used_channels |= (uint16_t)1 << x;
 	}
-	out->num_channels = (uint8_t)stdc_count_ones(used_channels);
+	out->num_channels = (uint8_t)__builtin_popcount(used_channels);

 	out->samples_data_length = 0;
 	for(uint8_t i = 0; i < out->num_instruments; ++i) {
diff --git i/src/xm_internal.h w/src/xm_internal.h
index 8441e48..83d80f0 100644
--- i/src/xm_internal.h
+++ w/src/xm_internal.h
@@ -11,7 +11,6 @@
 #include <string.h>
 #include <stdckdint.h>
 #include <stddef.h>
-#include <stdbit.h>

 #define POINTER_SIZE (UINTPTR_MAX == UINT64_MAX ? 8 : 4)
```

* Run `make` and view `frontend/index.html` in your browser
