/* Author: Romain "Artefact2" Dalmaso <artefact2@gmail.com> */

/* This program is free software. It comes without any warranty, to the
 * extent permitted by applicable law. You can redistribute it and/or
 * modify it under the terms of the Do What The Fuck You Want To Public
 * License, Version 2, as published by Sam Hocevar. See
 * http://sam.zoy.org/wtfpl/COPYING for more details. */

$(function() {

	var _BUFLEN = 6000;
	var _RATE = 48000;
	var _BUFTIME = _BUFLEN / _RATE;

	var audioContext = new (window.AudioContext || window.webkitAudioContext)();
	var buffers = [
		audioContext.createBuffer(2, _BUFLEN, _RATE),
		audioContext.createBuffer(2, _BUFLEN, _RATE),
	];
	var sources = [ null, null ];
	var playing = null;

	var xmActions = [];
	var cFloatArray = Module._malloc(2 * _BUFLEN * 4);
	var moduleContextPtr = Module._malloc(4);
	var moduleContext = null;

	var runXmContextAction = function(action) {
		if(xmActions.length > 0) {
			xmActions.push(action);
			return;
		}

		xmActions.push(action);

		while(xmActions.length > 0) {
			(xmActions.shift())();
		}
	};
	
	var loadModule = function(file, success, failure) {
		var reader = new FileReader();
		reader.onload = function() {
			runXmContextAction(function() {
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
					moduleContext = null;
					playing = false;
				} else {
					moduleContext = getValue(moduleContextPtr, '*');
				}
			})

			if(moduleContext === null) {
				failure();
				return;
			}

			success();
		};
		reader.readAsArrayBuffer(file);
	};

	var play = function() {
		var makeSourceGenerator = function(index, startTime, interval) {
			if(playing === false) {
				return function() {
					sources[index] = null;
				};
			}
			
			return function() {
				var s = audioContext.createBufferSource();
				s.onended = makeSourceGenerator(index, startTime + interval, interval);
				s.buffer = buffers[index];
				s.connect(audioContext.destination);
				sources[index] = s;

				var l = s.buffer.getChannelData(0);
				var r = s.buffer.getChannelData(1);

				runXmContextAction(function() {
					Module._xm_generate_samples(moduleContext, cFloatArray, _BUFLEN);
					for(var j = 0; j < _BUFLEN; ++j) {
						l[j] = Module.getValue(cFloatArray + 8 * j, 'float');
						r[j] = Module.getValue(cFloatArray + 8 * j + 4, 'float');
					}
				});

				s.start(startTime);
			};
		};
		
		playing = true;
		var t = audioContext.currentTime + _BUFTIME;
		(makeSourceGenerator(0, t, 2 * _BUFTIME))();
		(makeSourceGenerator(1, t + _BUFTIME, 2 * _BUFTIME))();
	};

	var pause = function() {
		playing = false;
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
		loadModule(input.get(0).files[0], function() {
			mname.text(Pointer_stringify(Module._xm_get_module_name(moduleContext)));
			mtracker.text(Pointer_stringify(Module._xm_get_tracker_name(moduleContext)));
			if(playing === null) {
				ppb.prop('disabled', false).click();
			}
		}, function() {
			mname.text('Broken module. Check the console for more info.');
			mtracker.text('');
			ppb.prop('disabled', true);
		});
	});

	ppb.click(function() {
		if(playing === true) {
			pause();
			ppb.text('► Play');
		} else {
			play();
			ppb.text('⏸ Pause');
		}
	});

	ppb.prop('disabled', true);

	form.append(label, input);
	pform.append(ppb);
	player.append(mname, mtracker, pform);
	$("p.modules").before(form, player);
});
