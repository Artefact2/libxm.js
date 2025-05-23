default: frontend/index.html frontend/xm/index.txt

frontend/xm/index.txt: $(shell find frontend/xm -type f -iname "*.xm")
	find frontend/xm -type f -iname "*.xm" -printf "%f\n" | sort > $@

frontend/index.html: build/libxm.a libxm.js build/shell.html
	emcc --pre-js libxm.js --shell-file build/shell.html -flto -Oz -sENVIRONMENT=web -sMALLOC=emmalloc -sSINGLE_FILE=1 -sEXPORTED_FUNCTIONS="['_malloc', '_free', '_XM_PRESCAN_DATA_SIZE', '_xm_prescan_module', '_xm_size_for_context', '_xm_create_context', '_xm_generate_samples', '_xm_mute_channel', '_xm_mute_instrument', '_xm_get_module_name', '_xm_get_tracker_name', '_xm_get_instrument_name', '_xm_get_number_of_channels', '_xm_get_number_of_instruments', '_xm_get_position', '_xm_get_latest_trigger_of_instrument', '_xm_get_latest_trigger_of_channel', '_xm_is_channel_active', '_xm_get_instrument_of_channel', '_xm_get_frequency_of_channel', '_xm_get_volume_of_channel', '_xm_get_panning_of_channel']" -sEXPORTED_RUNTIME_METHODS="['getValue', 'writeArrayToMemory', 'AsciiToString']" $< -o $@
	sed -i -e 's/<!doctypehtml>/<!doctype html>/' $@

build/shell.css: shell.css
	npx clean-css-cli -o $@ $<

build/shell.html: shell.html build/shell.css
	sed -e '/{{{ STYLE }}}/{r build/shell.css' -e 'd}' $< > $@ || (rm -f $@; exit 1)

build/libxm.a: build
	@make -C build

build:
	@mkdir -p $@
	@emcmake cmake -Slibxm/src -B$@ -DBUILD_SHARED_LIBS=OFF -DCMAKE_BUILD_TYPE=MinSizeRel -DXM_DEFENSIVE=OFF -DXM_LINEAR_INTERPOLATION=OFF -DXM_RAMPING=OFF

clean:
	@cd build && make clean
	rm -f build/shell.css build/shell.html frontend/index.html

dist-clean:
	@rm -Rf build

.PHONY: default build dist-clean
