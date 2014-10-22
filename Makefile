default: frontend/libxm.js frontend/libxm.js.mem

frontend/%: build/src/%
	cp -a $< $@

build/src/libxm.js: build/src/libxms.a
# TODO: automate the list of exported functions from xm.h
	emcc -O0 -s EXPORTED_FUNCTIONS="['_xm_create_context', '_xm_free_context', '_xm_generate_samples', '_xm_set_max_loop_count', '_xm_get_loop_count', '_xm_get_module_name', '_xm_get_tracker_name', '_xm_get_module_length', '_xm_get_number_of_patterns', '_xm_get_number_of_rows', '_xm_get_number_of_instruments', '_xm_get_number_of_samples', '_xm_get_playing_speed', '_xm_get_position']" $< -o $@

build/src/libxms.a:
	@cd build && make

build:
	@mkdir -p build
	@cd build && emconfigure cmake -D XM_DEBUG=1 ../libxm

clean:
	@cd build && make clean
	rm -f build/src/libxm.js

dist-clean:
	@rm -Rf build

.PHONY: default build dist-clean
