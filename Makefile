default: frontend/index.html

build/xm.html: $(shell find frontend/xm -type f -iname "*.xm")
	find frontend/xm -type f -iname "*.xm" -printf "<li><small><a href=\"./xm/%f\">%f</a></small></li>\n" | sort > $@ || (rm -f $@; exit 1)

frontend/index.html: build/libxmjs.a libxm.js build/shell.html
	emcc --pre-js libxm.js --shell-file build/shell.html -flto -Oz --closure 1 -sENVIRONMENT=web -sMALLOC=emmalloc -sSINGLE_FILE=1 -sEXPORTED_FUNCTIONS="['_malloc', '_free', '_a', '_s', '_n', '_xm_generate_samples', '_xm_mute_channel', '_xm_mute_instrument', '_xm_get_position', '_xm_get_latest_trigger_of_instrument', '_xm_get_latest_trigger_of_channel', '_xm_is_channel_active', '_xm_get_instrument_of_channel', '_xm_get_frequency_of_channel', '_xm_get_volume_of_channel', '_xm_get_panning_of_channel']" -sEXPORTED_RUNTIME_METHODS="['getValue', 'writeArrayToMemory', 'AsciiToString']" build/libxmjs.a build/libxm_build/libxm.a -o $@ || (rm -f $@; exit 1)
	sed -i -e 's/<!doctypehtml>/<!doctype html>/' $@ || (rm -f $@; exit 1)

build/shell.css: shell.css
	npx clean-css-cli -o $@ $<

build/shell.html: shell.html build/shell.css build/xm.html
	sed -e '/{{{ STYLE }}}/{r build/shell.css' -e 'd}' $< > $@ || (rm -f $@; exit 1)
	sed -i -e '/{{{ XMLIST }}}/{r build/xm.html' -e 'd}' $@ || (rm -f $@; exit 1)

build/libxmjs.a: build
	make -C build xmjs

build:
	mkdir -p $@
	emcmake cmake -Ssrc -B$@ -DCMAKE_BUILD_TYPE=MinSizeRel

clean:
	cd build && make clean
	rm -f build/shell.css build/shell.html build/xm.html frontend/index.html

dist-clean:
	rm -Rf build

.PHONY: default build dist-clean
