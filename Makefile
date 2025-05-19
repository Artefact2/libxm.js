default: frontend/libxm.js frontend/xm/index.txt
	cp -a build/libxm.wasm frontend/libxm.wasm

frontend/xm/index.txt: $(shell find frontend/xm -type f -iname "*.xm")
	find frontend/xm -type f -iname "*.xm" -printf "%f\n" | sort > $@

frontend/%: build/%
	cp -a $< $@

build/libxm.js: build/libxm.a
# TODO: automate the list of exported functions from xm.h
	emcc --no-entry -O3 -s EXPORTED_FUNCTIONS="['_malloc', '_free', '_XM_PRESCAN_DATA_SIZE', '_xm_prescan_module', '_xm_size_for_context', '_xm_create_context', '_xm_generate_samples', '_xm_mute_channel', '_xm_mute_instrument', '_xm_get_module_name', '_xm_get_tracker_name', '_xm_get_number_of_channels', '_xm_get_number_of_instruments', '_xm_get_position', '_xm_get_latest_trigger_of_instrument', '_xm_get_latest_trigger_of_channel', '_xm_is_channel_active', '_xm_get_instrument_of_channel', '_xm_get_frequency_of_channel', '_xm_get_volume_of_channel', '_xm_get_panning_of_channel']" -s EXTRA_EXPORTED_RUNTIME_METHODS="['getValue', 'writeArrayToMemory', 'AsciiToString']" $< -o $@

build/libxm.a: build
	@make -C build

build:
	@mkdir -p $@
	@emcmake cmake -Slibxm/src -B$@ -DBUILD_SHARED_LIBS=OFF -DCMAKE_BUILD_TYPE=Release -DXM_LINEAR_INTERPOLATION=OFF -DXM_RAMPING=OFF

clean:
	@cd build && make clean
	rm -f build/libxm.js

dist-clean:
	@rm -Rf build

.PHONY: default build dist-clean
