/* Author: Romain "Artefact2" Dalmaso <artefact2@gmail.com> */

/* This program is free software. It comes without any warranty, to the
 * extent permitted by applicable law. You can redistribute it and/or
 * modify it under the terms of the Do What The Fuck You Want To Public
 * License, Version 2, as published by Sam Hocevar. See
 * http://sam.zoy.org/wtfpl/COPYING for more details. */

"use strict";

Module['onRuntimeInitialized'] = function() {
	var AUDIO_BUFFER_LENGTH = 4096;
	var XM_BUFFER_LENGTH = 256;
	var RATE = 48000;
	var MAX_XMDATA = 256;

	var audioContext = new AudioContext();
	var buffers = [
		audioContext.createBuffer(2, AUDIO_BUFFER_LENGTH, RATE),
		audioContext.createBuffer(2, AUDIO_BUFFER_LENGTH, RATE),
	];

	var LATENCY_COMP = RATE * (audioContext.outputLatency | audioContext.baseLatency | 0.25) + AUDIO_BUFFER_LENGTH;

	var playing = false;
	var needsResync = true;
	var t0 = 0; /* Sync point in audio ctx */
	var s0 = 0; /* Sync point in xm ctx */
	var amp = 1.0;
	var clip = false;

	var xmActions = [];
	var cFloatArray = Module['_malloc'](2 * XM_BUFFER_LENGTH * 4);
	var prescanData = Module['_malloc'](Module['_XM_PRESCAN_DATA_SIZE']);
	var moduleContext = null;
	var cSamplesPtr = Module['_malloc'](4);

	const dinstruments = document.getElementById('instruments');
	const dchannels = document.getElementById('channels');
	const dvolumes = document.getElementById('volumes');
	const dfrequencies = document.getElementById('frequencies');
	const mtitle = document.getElementById('mtitle');
	let ninsts = 0, nchans = 0;
	const ielements = [];
	const celements = [];
	const velements = [];
	const felements = [];
	const xmdata = [];

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
		reader.onloadend = function() {
			runXmContextAction(function() {
				if(moduleContext !== null) {
					Module['_free'](moduleContext);
					moduleContext = null;
				}

				var view = new Int8Array(reader.result);
				var moduleStringBuffer = Module['_malloc'](view.length);
				Module['writeArrayToMemory'](view, moduleStringBuffer);
				var ret = Module['_xm_prescan_module'](moduleStringBuffer, view.length, prescanData);

				if(ret === 1) {
					moduleContext = Module['_malloc'](Module['_xm_size_for_context'](prescanData));
					Module['_xm_create_context'](moduleContext, prescanData, moduleStringBuffer, view.length, RATE);
				}

                                Module['_free'](moduleStringBuffer);
			});

			if(moduleContext === null) {
				failure();
				return;
			}

			success();
		};
		reader.readAsArrayBuffer(file);
	};

	var fillBuffer = function(buffer) {
		var l = buffer.getChannelData(0);
		var r = buffer.getChannelData(1);

		for(var off = 0; off < AUDIO_BUFFER_LENGTH; off += XM_BUFFER_LENGTH) {
			Module['_xm_generate_samples'](moduleContext, cFloatArray, XM_BUFFER_LENGTH);
			for(var j = 0; j < XM_BUFFER_LENGTH; ++j) {
				l[off+j] = Module['getValue'](cFloatArray + 8 * j, 'float') * amp;
				r[off+j] = Module['getValue'](cFloatArray + 8 * j + 4, 'float') * amp;
				if(!clip && (l[j] < -1.0 || l[j] > 1.0 || r[j] < -1.0 || r[j] > 1.0)) {
					clip = true;
				}
			}

			var xmd = {};

			Module['_xm_get_position'](moduleContext, null, null, null, cSamplesPtr);
			xmd.sampleCount = Module['getValue'](cSamplesPtr, 'i64');

			xmd.instruments = [];
			for(var j = 1; j <= ninsts; ++j) {
				xmd.instruments.push({
					latestTrigger: Module['_xm_get_latest_trigger_of_instrument'](moduleContext, j),
				});
			}

			xmd.channels = [];
			for(var j = 1; j <= nchans; ++j) {
				xmd.channels.push({
					active: Module['_xm_is_channel_active'](moduleContext, j),
					latestTrigger: Module['_xm_get_latest_trigger_of_channel'](moduleContext, j),
					volume: Module['_xm_get_volume_of_channel'](moduleContext, j),
					panning: Module['_xm_get_panning_of_channel'](moduleContext, j),
					frequency: Module['_xm_get_frequency_of_channel'](moduleContext, j),
					instrument: Module['_xm_get_instrument_of_channel'](moduleContext, j),
				});
			}

			xmdata.push(xmd);
			if(xmd.length >= MAX_XMDATA) xmdata.shift();
		}
	};

	var setupSources = function() {
		var makeSourceGenerator = function(index, start) {
			return function() {
				var s = audioContext.createBufferSource();
				s.onended = makeSourceGenerator(index, start + 2 * AUDIO_BUFFER_LENGTH);
				s.buffer = buffers[index];
				s.connect(audioContext.destination);

				if(moduleContext !== null) {
					runXmContextAction(function() {
						if(needsResync) {
							t0 = start;
							Module['_xm_get_position'](moduleContext, null, null, null, cSamplesPtr);
							s0 = Module['getValue'](cSamplesPtr, 'i64');
							needsResync = false;
						}
						fillBuffer(s.buffer);
					});
				} else {
					var l = s.buffer.getChannelData(0);
					var r = s.buffer.getChannelData(1);
					for(var i = 0; i < AUDIO_BUFFER_LENGTH; ++i) {
						l[i] = r[i] = 0.0;
					}
				}

				s.start(start / RATE);
			};
		};

		var t = RATE * audioContext.currentTime + AUDIO_BUFFER_LENGTH;
		runXmContextAction(function() {
			Module['_xm_get_position'](moduleContext, null, null, null, cSamplesPtr);
			s0 = Module['getValue'](cSamplesPtr, 'i64');
		});

		(makeSourceGenerator(0, t))();
		(makeSourceGenerator(1, t + AUDIO_BUFFER_LENGTH))();
	};

	var pause = function() {
		audioContext.suspend();
		playing = false;
	};

	var resume = function() {
		audioContext.resume();
		playing = true;
	}

	document.getElementById('nojs').remove();
	const form = document.createElement('form');
	form.setAttribute('id', 'actions');
	form.onsubmit = function(e) { e.preventDefault(); };

	const gminus = document.createElement('button');
	gminus.innerText = 'Volume -';
	gminus.setAttribute('title', 'Lower gain by 1 dB');

	const gplus = document.createElement('button');
	gplus.innerText = 'Volume +';
	gplus.setAttribute('title', 'Increase gain by 1 dB (MAY CREATE CLIPPING)');

	var ulabel = document.createElement('label');
	ulabel.innerText = 'Load .XM';
	ulabel.setAttribute('title', 'Load .XM module…');
	ulabel.setAttribute('for', 'iupload');

	var input = document.createElement('input');
	input.setAttribute('type', 'file');
	input.setAttribute('id', 'iupload');

	var ppb = document.createElement('button');
	ppb.innerText = 'Play/Pause';
	ppb.setAttribute('title', 'Play/Pause');
	ppb.classList.add('blinkred');

	form.append(gminus, gplus, ulabel, input, ppb);
	document.body.append(form);

	form.onselectstart = function() {
		return false;
	};

	gminus.onclick = function() {
		amp /= 1.25892541179;
		clip = false;
	};

	gplus.onclick = function() {
		amp *= 1.25892541179;
	};

	var realLoadModule = function(file) {
		loadModule(file, function() {
			amp = 1.0;
			clip = false;
			needsResync = true;
			dinstruments.replaceChildren();
			dchannels.replaceChildren();
			dvolumes.replaceChildren();
			dfrequencies.replaceChildren();
			xmdata.splice(0, xmdata.length);

			ninsts = Module['_xm_get_number_of_instruments'](moduleContext);
			nchans = Module['_xm_get_number_of_channels'](moduleContext);

			for(var i = 0; i < ninsts; ++i) {
				dinstruments.append(ielements[i] = document.createElement('div'));
				ielements[i].setAttribute('style', 'background-color: hsl(' + (360 * i / ninsts) + ', 100%, 40%); opacity: 0;');
			}

			for(var j = 0; j < nchans; ++j) {
				dchannels.append(celements[j] = document.createElement('div'));
				dvolumes.append(velements[2 * j] = document.createElement('div'));
				dvolumes.append(velements[2 * j + 1] = document.createElement('div'));
				velements[2*j].setAttribute('style', 'width: ' + (50 / nchans) + '%; left: ' + (100 * j / nchans) + '%; height: 0em;');
				velements[2*j+1].setAttribute('style', 'width: ' + (50 / nchans) + '%; left: ' + (100 * j / nchans + 50 / nchans) + '%; height: 0em;');

				dfrequencies.append(felements[j] = document.createElement('div'));
				felements[j].setAttribute('style', 'width: ' + (100 / nchans) + '%; left: ' + (100 * j / nchans) + '%; opacity: 0;');
			}

			mtitle.innerText = Module['AsciiToString'](Module['_xm_get_module_name'](moduleContext)).trim() + "\n" + Module['AsciiToString'](Module['_xm_get_tracker_name'](moduleContext)).trim() + "\n\n";
			for(var i = 1; i <= ninsts; ++i) {
				var iname = Module['AsciiToString'](Module['_xm_get_instrument_name'](moduleContext, i));
				mtitle.append(iname + " ".repeat(22-iname.length) + "\n");
			}
		}, function() {
			alert('An error happened while loading the module, check the console for more info.');
		});
	};

	input.onchange = function() {
		realLoadModule(input.files[0]);
	};

	ppb.onclick = function(e) {
                ppb.classList.remove('blinkred');
		if(playing === true) {
			pause();
		} else {
			resume();
		}
	};

	dinstruments.onclick = function(e) {
		const div = e.target.closest('div');
		if(!dinstruments.contains(div)) return;
		div.classList.toggle('muted');

		runXmContextAction(function() {
			if(moduleContext === null) return;
			Module['_xm_mute_instrument'](moduleContext, Array.prototype.indexOf.call(dinstruments.children, div)+1, div.classList.contains('muted'));
		});
	};

	dchannels.onclick = function(e) {
		const div = e.target.closest('div');
		if(!dchannels.contains(div)) return;
		div.classList.toggle('muted');

		runXmContextAction(function() {
			if(moduleContext === null) return;
			Module['_xm_mute_channel'](moduleContext, Array.prototype.indexOf.call(dchannels.children, div)+1, div.classList.contains('muted'));
		});
	};

	document.getElementById('mods').onclick = function(e) {
		e.preventDefault();
		if(e.target.getAttribute('href') === null) return;

                const xhr = new XMLHttpRequest();
		xhr.open('GET', e.target.getAttribute('href'));
		xhr.responseType = 'blob';
		xhr.onload = function() {
			if(this.status !== 200) return;
			realLoadModule(this.response);
		};
		xhr.send();
	};

        const mods = document.querySelectorAll('ul#mods a');
	const n = window.location.hash.length >= 2
	      ? parseInt(window.location.hash.substring(1))
	      : Math.floor(Math.random() * mods.length);
	mods[n].click();

	const notes = [
		'A-', 'A#', 'B-', 'C-', 'C#', 'D-',
		'D#', 'E-', 'F-', 'F#', 'G-', 'G#',
	];
	const render = function() {
		requestAnimationFrame(render);
		if(xmdata.length === 0) return;

		var target = RATE * audioContext.currentTime - t0 - LATENCY_COMP;
		while(xmdata.length >= 2 && xmdata[0].sampleCount - s0 < target && xmdata[1].sampleCount - s0 < target) {
			xmdata.shift();
		}

		var xmd = xmdata[0];

		for(var i = 0; i < ninsts; ++i) {
			var dist = Number(xmd.sampleCount - xmd.instruments[i].latestTrigger) / RATE;

			ielements[i].style['opacity'] = Math.min(1.0, Math.max(0.0, 1.0 - 2.0 * dist));
		}

		for(var j = 0; j < nchans; ++j) {
			var dist = Number((xmd.sampleCount - xmd.channels[j].latestTrigger)) / RATE;

			celements[j].style['background-color'] = 'hsl(' + (360 * (xmd.channels[j].instrument - 1) / ninsts) + ', 100%, ' + (75.0 + 50.0 * dist) + '%)';
			celements[j].innerText = xmd.channels[j].active && xmd.channels[j].volume > .01 ? notes[Math.round(12.0 * Math.log(xmd.channels[j].frequency / 440.0) / Math.log(2)) % 12] + Math.floor(Math.log(xmd.channels[j].frequency) / Math.log(2) - 10) : '';

			velements[2*j].style['height'] = xmd.channels[j].active ? (5.0 * xmd.channels[j].volume * (1.0 - xmd.channels[j].panning)) + 'em' : '0em';
			velements[2*j+1].style['height'] = xmd.channels[j].active ?  (5.0 * xmd.channels[j].volume * xmd.channels[j].panning) + 'em' : '0em';

			velements[2*j+1].style['background-color'] = velements[2*j].style['background-color'] = 'hsl(' + (360 * (xmd.channels[j].instrument - 1) / ninsts) + ', 100%, 40%)';

			felements[j].style['opacity'] = xmd.channels[j].active ? xmd.channels[j].volume : '0';
			felements[j].style['bottom'] = (15.0 * (Math.log(xmd.channels[j].frequency) / Math.log(2.0) - 13.0)) + '%';
			felements[j].style['background-color'] = 'hsl(' + (360 * (xmd.channels[j].instrument - 1) / ninsts) + ', 100%, 40%)';
		}

		gplus.classList.toggle('clip', clip);
	};

	setupSources();
	requestAnimationFrame(render);
};
