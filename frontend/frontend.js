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

	var play = $(document.createElement('button'));
	play.text('► Play');

	var stop = $(document.createElement('button'));
	stop.text('■ Stop');

	input.change(function() {
		var file = input.get(0).files[0];
		var reader = new FileReader();
		reader.onload = function() {
			if(!stop.prop('disabled')) stop.click();

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
				mname.text('Broken module. Check the console for more info.');
				mtracker.text('');
				play.prop('disabled', true);
				stop.prop('disabled', true);
				return;
			}

			moduleContext = getValue(moduleContextPtr, '*');

			mname.text(Pointer_stringify(Module._xm_get_module_name(moduleContext)));
			mtracker.text(Pointer_stringify(Module._xm_get_tracker_name(moduleContext)));
			stop.prop('disabled', true);
			play.prop('disabled', false).click();
		};
		reader.readAsArrayBuffer(file);
	});

	play.click(function() {
		play.prop('disabled', true);
		stop.prop('disabled', false);

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
	});

	stop.click(function() {
		clearTimeout(timeout);

		/* XXX: this is awful */
		audioBufferSource.stop();
		if(prevABS !== null) prevABS.stop();
		if(prevPrevABS !== null) prevPrevABS.stop();

		play.prop('disabled', false);
		stop.prop('disabled', true);
	});

	play.prop('disabled', true);
	stop.prop('disabled', true);

	form.append(label, input);
	pform.append(play, stop);
	player.append(mname, mtracker, pform);
	$("p#modules").before(form, player);

});
