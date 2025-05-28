/* Author: Romain "Artefact2" Dalmaso <artefact2@gmail.com> */

/* This program is free software. It comes without any warranty, to the
 * extent permitted by applicable law. You can redistribute it and/or
 * modify it under the terms of the Do What The Fuck You Want To Public
 * License, Version 2, as published by Sam Hocevar. See
 * http://sam.zoy.org/wtfpl/COPYING for more details. */

"use strict";

Module['onRuntimeInitialized'] = function() {
	const AUDIO_BUFFER_LENGTH = 4096;
	const XM_BUFFER_LENGTH = 256;
	const RATE = 44100;

	const audioContext = new AudioContext();
	/* audioContext.currentTime after module load */
	let audioContextOffset = 0;
	const gain_node = audioContext.createGain();
	gain_node.connect(audioContext.destination);
	const buffers = [
		audioContext.createBuffer(2, AUDIO_BUFFER_LENGTH, RATE),
		audioContext.createBuffer(2, AUDIO_BUFFER_LENGTH, RATE),
	];

	const LATENCY_COMP = RATE * (
		audioContext.outputLatency + audioContext.baseLatency
	) + AUDIO_BUFFER_LENGTH;

	var xmActions = [];
	let ctx = 0;
	let generated_buffers = 0;
	let generated_samples = 0;

	const dinstruments = document.getElementById('i');
	const dchannels = document.getElementById('c');
	const dvolumes = document.getElementById('v');
	const dfrequencies = document.getElementById('f');
	let ninsts = 0, nchans = 0;
	const ielements = [];
	const celements = [];
	const velements = [];
	const felements = [];
	const xmdata = [];

	var loadModule = function(file, success) {
		var reader = new FileReader();
		reader.onloadend = function() {
			const view = new Uint8Array(reader.result);
			if(view.length > 16 << 20) {
				ctx = 0;
			} else {
				Module['HEAPU8'].set(view, Module['_n'] + 6146);
				ctx = Module['_a']();
			}

			if(ctx === 0) {
				alert('An error happened while loading the module, check the console for more info.');
				return;
			}

			success();
		};
		reader.readAsArrayBuffer(file);
	};

	const fillBuffer = function(buffer) {
		const l = buffer.getChannelData(0);
		const r = buffer.getChannelData(1);

		if(ctx === 0) {
			l.fill(0);
			r.fill(0);
			return;
		}

		for(let off = 0; off < AUDIO_BUFFER_LENGTH; off += XM_BUFFER_LENGTH) {
			const cFloatArray = Module['_b']() / 4;
			l.set(Module['HEAPF32'].subarray(
				cFloatArray, cFloatArray + XM_BUFFER_LENGTH
			), off);
			r.set(Module['HEAPF32'].subarray(
				cFloatArray + XM_BUFFER_LENGTH,
				cFloatArray + 2 * XM_BUFFER_LENGTH
			), off);

			var xmd = {};

			generated_samples += XM_BUFFER_LENGTH;
			xmd.sampleCount = generated_samples;

			xmd.instruments = [];
			for(var j = 1; j <= ninsts; ++j) {
				xmd.instruments.push({
					latestTrigger: Module['_xm_get_latest_trigger_of_instrument'](ctx, j),
				});
			}

			xmd.channels = [];
			for(var j = 1; j <= nchans; ++j) {
				xmd.channels.push({
					active: Module['_xm_is_channel_active'](ctx, j),
					latestTrigger: Module['_xm_get_latest_trigger_of_channel'](ctx, j),
					volume: Module['_xm_get_volume_of_channel'](ctx, j),
					panning: Module['_xm_get_panning_of_channel'](ctx, j),
					frequency: Module['_xm_get_frequency_of_channel'](ctx, j),
					instrument: Module['_xm_get_instrument_of_channel'](ctx, j),
				});
			}

			xmdata.push(xmd);
		}
	};

	const generate_buffer = function() {
		const s = audioContext.createBufferSource();
		const index = generated_buffers % 2;
		s.onended = generate_buffer;
		s.buffer = buffers[index];
		s.connect(gain_node);
		fillBuffer(buffers[index]);
		s.start(audioContextOffset
			+ (generated_buffers++) * AUDIO_BUFFER_LENGTH / RATE);
	};
	generate_buffer();
	generate_buffer();

	document.getElementById('n').remove();
	const form = document.createElement('form');
	form.setAttribute('id', 'a');
	form.onsubmit = function(e) { e.preventDefault(); };

	const gminus = document.createElement('button');
	gminus.innerText = 'Volume -';
	gminus.setAttribute('title', 'Lower gain by 1 dB');
	gminus.onclick = function() {
		gain_node.gain.value /= 1.26;
	};

	const gplus = document.createElement('button');
	gplus.innerText = 'Volume +';
	gplus.setAttribute('title', 'Increase gain by 1 dB (MAY CREATE CLIPPING)');
	gplus.onclick = function() {
		gain_node.gain.value *= 1.26;
	};

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
	ppb.classList.add('br');

	form.append(gminus, gplus, ulabel, input, ppb);
	document.body.append(form);

	form.onselectstart = function() {
		return false;
	};

	var realLoadModule = function(file) {
		loadModule(file, function() {
			audioContextOffset = audioContext.currentTime;
			generated_buffers = 0;
			generated_samples = 0;

			dinstruments.replaceChildren();
			dchannels.replaceChildren();
			dvolumes.replaceChildren();
			dfrequencies.replaceChildren();
			xmdata.splice(0, xmdata.length);

			nchans = Module['HEAPU8'][Module['_n']];
			ninsts = Module['HEAPU8'][Module['_n'] + 1];

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

			for(let i = Module['_n'] + 2;; ++i) {
				if(Module['HEAPU8'][i] === 0) {
					document.getElementById('it').innerText = (new TextDecoder("ascii")).decode(Module['HEAPU8'].subarray(Module['_n'] + 2, i));
					break;
				}
			}
		});
	};

	input.onchange = function() {
		realLoadModule(input.files[0]);
	};

	ppb.onclick = function(e) {
		ppb.classList.remove('br');
		if(audioContext.state === "running") {
			audioContext.suspend();
		} else {
			audioContext.resume();
		}
	};

	dinstruments.onclick = function(e) {
		const div = e.target.closest('div');
		if(!dinstruments.contains(div)) return;
		div.classList.toggle('m');

		if(ctx === 0) return;
		Module['_xm_mute_instrument'](ctx, Array.prototype.indexOf.call(dinstruments.children, div)+1, div.classList.contains('m'));
	};

	dchannels.onclick = function(e) {
		const div = e.target.closest('div');
		if(!dchannels.contains(div)) return;
		div.classList.toggle('m');

		if(ctx === 0) return;
		Module['_xm_mute_channel'](ctx, Array.prototype.indexOf.call(dchannels.children, div)+1, div.classList.contains('m'));
	};

	document.getElementById('x').onclick = function(e) {
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

        const mods = document.querySelectorAll('#x a');
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

		const target = RATE *
		      (audioContext.currentTime - audioContextOffset)
		      - LATENCY_COMP;
		while(xmdata.length >= 2
		      && xmdata[0].sampleCount < target
		      && xmdata[1].sampleCount < target) {
			xmdata.shift();
		}

		var xmd = xmdata[0];

		for(var i = 0; i < ninsts; ++i) {
			var dist = (xmd.sampleCount - xmd.instruments[i].latestTrigger) / RATE;

			ielements[i].style['opacity'] = Math.min(1.0, Math.max(0.0, 1.0 - 2.0 * dist));
		}

		for(var j = 0; j < nchans; ++j) {
			var dist = (xmd.sampleCount - xmd.channels[j].latestTrigger) / RATE;

			celements[j].style['background-color'] = 'hsl(' + (360 * (xmd.channels[j].instrument - 1) / ninsts) + ', 100%, ' + (75.0 + 50.0 * dist) + '%)';
			celements[j].innerText = xmd.channels[j].active && xmd.channels[j].volume > .01 ? notes[Math.round(12.0 * Math.log(xmd.channels[j].frequency / 440.0) / Math.log(2)) % 12] + Math.floor(Math.log(xmd.channels[j].frequency) / Math.log(2) - 10) : '';

			velements[2*j].style['height'] = xmd.channels[j].active ? (5.0 * xmd.channels[j].volume * (1.0 - xmd.channels[j].panning)) + 'em' : '0em';
			velements[2*j+1].style['height'] = xmd.channels[j].active ?  (5.0 * xmd.channels[j].volume * xmd.channels[j].panning) + 'em' : '0em';

			velements[2*j+1].style['background-color'] = velements[2*j].style['background-color'] = 'hsl(' + (360 * (xmd.channels[j].instrument - 1) / ninsts) + ', 100%, 40%)';

			felements[j].style['opacity'] = xmd.channels[j].active ? xmd.channels[j].volume : '0';
			felements[j].style['bottom'] = (15.0 * (Math.log(xmd.channels[j].frequency) / Math.log(2.0) - 13.0)) + '%';
			felements[j].style['background-color'] = 'hsl(' + (360 * (xmd.channels[j].instrument - 1) / ninsts) + ', 100%, 40%)';
		}
	};

	requestAnimationFrame(render);
};
