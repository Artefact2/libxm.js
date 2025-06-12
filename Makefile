default: frontend/index.html

frontend/index.html: build/libxmjs.a build/libxm_build/libxm.a libxm.js build/shell.html
	emcc --pre-js libxm.js --shell-file build/shell.html -flto -Oz --closure 1 -sENVIRONMENT=web -sSINGLE_FILE=1 -sEXPORTED_FUNCTIONS="['_a', '_b', '_n', '_xm_mute_channel', '_xm_mute_instrument', '_xm_get_latest_trigger_of_instrument', '_xm_get_latest_trigger_of_channel', '_xm_is_channel_active', '_xm_get_instrument_of_channel', '_xm_get_frequency_of_channel', '_xm_get_volume_of_channel', '_xm_get_panning_of_channel']" build/libxmjs.a build/libxm_build/libxm.a -o $@ || (rm -f $@; exit 1)
	sed -i -e 's/<!doctypehtml>/<!doctype html>/' $@ || (rm -f $@; exit 1)

build/shell.css: shell.css
	npx clean-css-cli -o $@ $<

build/shell.html: shell.html build/shell.css
	sed -e '/{{{ STYLE }}}/{r build/shell.css' -e 'd}' $< > $@ || (rm -f $@; exit 1)

build/libxmjs.a: build
	make -C build xmjs

build/libxm_build/libxm.a: build
	make -C build xm

build:
	mkdir -p $@
	emcmake cmake -Ssrc -B$@ -DCMAKE_BUILD_TYPE=MinSizeRel

clean:
	cd build && make clean
	rm -f build/shell.css build/shell.html frontend/index.html

dist-clean:
	rm -Rf build

.PHONY: default build dist-clean
