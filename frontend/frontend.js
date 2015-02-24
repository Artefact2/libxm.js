/* Author: Romain "Artefact2" Dalmaso <artefact2@gmail.com> */

/* This program is free software. It comes without any warranty, to the
 * extent permitted by applicable law. You can redistribute it and/or
 * modify it under the terms of the Do What The Fuck You Want To Public
 * License, Version 2, as published by Sam Hocevar. See
 * http://sam.zoy.org/wtfpl/COPYING for more details. */

$(function() {

	var _BUFLEN = 96000;
	var _RATE = 48000;

	var audioContext = new (window.AudioContext || window.webkitAudioContext)();
	var t0 = new Date().getTime() / 1000;
	var timeout = null;
	var audioBuffer = null;
	var audioBufferSource = null;
	var prevABS = null;
	var prevPrevABS = null;
	var cFloatArray = Module._malloc(2 * _BUFLEN * 4);
	var moduleContextPtr = Module._malloc(4);
	var moduleContext = null;
	var loopCount = 1;

	var loadModule = function(file, success, failure) {
		var reader = new FileReader();
		reader.onload = function() {
			if(moduleContext !== null) {
				Module._xm_free_context(moduleContext);
				moduleContext = null;
			}

			var view = new Int8Array(reader.result);
			var moduleStringBuffer = Module._malloc(view.length);
			Module.writeArrayToMemory(view, moduleStringBuffer);
			var ret = Module._xm_create_context(
				moduleContextPtr, moduleStringBuffer, _RATE
			);
			Module._free(moduleStringBuffer);

			if(ret !== 0) {
				failure();
				return;
			}

			moduleContext = getValue(moduleContextPtr, '*');
			success();
		};
		reader.readAsArrayBuffer(file);
	};

	var play = function() {
		var playNextBuffer = function(buflen, when) {
			audioBuffer = audioContext.createBuffer(2, buflen, _RATE);
			var l = audioBuffer.getChannelData(0);
			var r = audioBuffer.getChannelData(1);

			Module._xm_generate_samples(moduleContext, cFloatArray, buflen);
			for(var i = 0; i < buflen; ++i) {
				l[i] = Module.getValue(cFloatArray + 8 * i, 'float');
				r[i] = Module.getValue(cFloatArray + 8 * i + 4, 'float');
			}

			prevPrevABS = prevABS;
			prevABS = audioBufferSource;
			audioBufferSource = audioContext.createBufferSource();
			audioBufferSource.buffer = audioBuffer;
			audioBufferSource.connect(audioContext.destination);
			audioBufferSource.start(when);
		};

		var delta = new Date().getTime() / 1000 - t0 + 1;
		var bufferDuration = _BUFLEN / _RATE;
		var curTime = delta;

		/* First buffer is a bit wonky, use a shorter length */
		playNextBuffer(_BUFLEN / 4.0, curTime);
		curTime += bufferDuration / 4.0;

		var playBufferAndDelayNextBuffer = function() {
			var t = new Date().getTime();
			playNextBuffer(_BUFLEN, curTime);
			curTime += bufferDuration;
			t = new Date().getTime() - t;

			timeout = setTimeout(playBufferAndDelayNextBuffer, 1000 * bufferDuration - t);
		};

		playBufferAndDelayNextBuffer();
	};

	var pause = function() {
		if(timeout === null) return;
		
		clearTimeout(timeout);
		timeout = null;

		/* XXX: this is awful */
		audioBufferSource.stop();
		if(prevABS !== null) prevABS.stop();
		if(prevPrevABS !== null) prevPrevABS.stop();
	};

	$("p#nojs").remove();
	var form = $(document.createElement('form'));
	form.submit(function(e) { e.preventDefault(); });

	var label = $(document.createElement('label'));
	label.text('Upload your .xm file…');

	var input = $(document.createElement('input'));
	input.prop('type', 'file');

	var player = $(document.createElement('div'));
	var mname = $(document.createElement('pre'));
	var mtracker = $(document.createElement('pre'));

	var pform = $(document.createElement('form'));
	pform.submit(function(e) { e.preventDefault(); });

	var ppb = $(document.createElement('button'));
	ppb.text('► Play');

	input.change(function() {
		if(timeout !== null) {
			ppb.click();
		}
		
		loadModule(input.get(0).files[0], function() {
			mname.text(Pointer_stringify(Module._xm_get_module_name(moduleContext)));
			mtracker.text(Pointer_stringify(Module._xm_get_tracker_name(moduleContext)));
			ppb.prop('disabled', false).click();
		}, function() {
			mname.text('Broken module. Check the console for more info.');
			mtracker.text('');
			ppb.prop('disabled', true);
		});
	});

	ppb.click(function() {
		if(timeout === null) {
			play();
			ppb.text('⏸ Pause');
		} else {
			pause();
			ppb.text('► Play');
		}
	});

	ppb.prop('disabled', true);

	form.append(label, input);
	pform.append(ppb);
	player.append(mname, mtracker, pform);
	$("p.modules").before(form, player);

});
