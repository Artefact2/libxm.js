default: frontend/libxm.js frontend/libxm.js.mem frontend/xm/index.txt

frontend/xm/index.txt: $(shell find frontend/xm -type f -iname "*.xm")
	find frontend/xm -type f -iname "*.xm" -printf "%f\n" | sort > $@

frontend/%: build/src/%
	cp -a $< $@

build/src/libxm.js: build/src/libxms.a
# TODO: automate the list of exported functions from xm.h
	emcc -O2 -s EXPORTED_FUNCTIONS="['_xm_create_context', '_xm_create_context_safe', '_xm_free_context', '_xm_generate_samples', '_xm_set_max_loop_count', '_xm_get_loop_count', '_xm_mute_channel', '_xm_mute_instrument', '_xm_get_module_name', '_xm_get_tracker_name', '_xm_get_number_of_channels', '_xm_get_module_length', '_xm_get_number_of_patterns', '_xm_get_number_of_rows', '_xm_get_number_of_instruments', '_xm_get_number_of_samples', '_xm_get_playing_speed', '_xm_get_position', '_xm_get_latest_trigger_of_instrument', '_xm_get_latest_trigger_of_sample', '_xm_get_latest_trigger_of_channel', '_xm_is_channel_active', '_xm_get_instrument_of_channel', '_xm_get_frequency_of_channel', '_xm_get_volume_of_channel', '_xm_get_panning_of_channel']" $< -o $@

build/src/libxms.a: build
	@cd build && make

build:
	@mkdir -p build
	@cd build && emconfigure cmake -D XM_BUILD_SHARED_LIBS=OFF -D XM_BUILD_EXAMPLES=OFF ../libxm

clean:
	@cd build && make clean
	rm -f build/src/libxm.js

dist-clean:
	@rm -Rf build

.PHONY: default build dist-clean
