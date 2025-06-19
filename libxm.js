/* Author: Romain "Artefact2" Dalmaso <artefact2@gmail.com> */

/* This program is free software. It comes without any warranty, to the
 * extent permitted by applicable law. You can redistribute it and/or
 * modify it under the terms of the Do What The Fuck You Want To Public
 * License, Version 2, as published by Sam Hocevar. See
 * http://sam.zoy.org/wtfpl/COPYING for more details. */

"use strict";

const START = () => {
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

	const postLoadModule = () => {
		audioContextOffset = audioContext.currentTime;
		generated_buffers = 0;
		generated_samples = 0;

		dinstruments.replaceChildren();
		dchannels.replaceChildren();
		dvolumes.replaceChildren();
		dfrequencies.replaceChildren();
		xmdata.length = 0;

		nchans = Module['HEAPU8'][Module['_n']];
		ninsts = Module['HEAPU8'][Module['_n'] + 1];

		for(let i = 0; i < ninsts; ++i) {
			dinstruments.append(
				ielements[i] = document.createElement('div')
			);
			ielements[i].style['background'] =
				'hsl(' + (360 * i / ninsts) + ', 100%, 40%)';
		}

		for(let j = 0; j < nchans; ++j) {
			dchannels.append(
				celements[j] = document.createElement('div')
			);
			dvolumes.append(
				velements[2*j] = document.createElement('div')
			);
			dvolumes.append(
				velements[2*j+1] = document.createElement('div')
			);
			dfrequencies.append(
				felements[j] = document.createElement('div')
			);

                        velements[2*j].style['width'] =
				velements[2*j+1].style['width'] =
				(50 / nchans) + '%';
			felements[j].style['width'] = (100 / nchans) + '%';
			felements[j].style['left'] =
				velements[2*j].style['left'] =
				(100 * j / nchans) + '%';
			velements[2*j+1].style['left'] =
				(100 * j / nchans + 50 / nchans) + '%';
		}

		let it = '';
		/* Not perfect, but close to FT208 */
		const ft2cp = ""
		      + "\n\\×↓ä↑å⁰¹²³⁴⁵⁶ÄÅ" /* 0x */
		      + "⁷⁸⁹AöBCDEÖF½⬆⬇⬅➡" /* 1x */
		      + " !\"#$%&'()*+,-./" /* 2x */
		      + "0123456789:;<=>?" /* 3x */
		      + "©ABCDEFGHIJKLMNO" /* 4x */
		      + "PQRSTUVWXYZ[\\]|_" /* 5x */
		      + "`abcdefghijklmno" /* 6x */
		      + "pqrstuvwxyz{|}  " /* 7x */
		      + " \\×↓ä↑å⁰¹²³⁴⁵⁶ÄÅ" /* 8x */
		      + "⁷⁸⁹AöBCDEÖF½⬆⬇⬅➡" /* 9x */
		      + "ᴬᴮꟲᴰᴱꟳ  ()*+,-./" /* Ax */
		      + "0123456789:;<=>?" /* Bx */
		      + "©ABCDEFGHIJKLMNO" /* Cx */
		      + "PQRSTUVWXYZ[\\]|_" /* Dx */
		      + "`abcdefghijklmno" /* Ex */
		      + "pqrstuvwxyz{|}  " /* Fx */;
		let end = Module['_n'] + 6143;
		while(!Module['HEAPU8'][end]) --end;
		for(let i = Module['_n'] + 2;  i <= end; ++i) {
			it += ft2cp[Module['HEAPU8'][i]];
		}
		document.getElementById('it').innerText = it;
	};

	const loadModuleFile = file => {
		const reader = new FileReader();
		reader.onloadend = () => {
			const view = new Uint8Array(reader.result);
			if(view.length > 16 << 20) {
				ctx = 0;
			} else {
				Module['HEAPU8'].set(view, Module['_n'] + 6146);
				ctx = Module['_a']();
			}

			if(ctx === 0) {
				alert('An error happened while loading the module, check the console for more info.');
			} else {
				postLoadModule();
			}
		};
		reader.readAsArrayBuffer(file);
	};

	const fillBuffer = buffer => {
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

			let xmd = {};

			generated_samples += XM_BUFFER_LENGTH;
			xmd.sampleCount = generated_samples;

			xmd.instruments = [];
			for(let j = 1; j <= ninsts; ++j) {
				xmd.instruments.push({
					latestTrigger: Module['_xm_get_latest_trigger_of_instrument'](ctx, j),
				});
			}

			xmd.channels = [];
			for(let j = 1; j <= nchans; ++j) {
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

	const generate_buffer = () => {
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
	form.onsubmit = e => e.preventDefault();

	const gminus = document.createElement('button');
	gminus.innerText = 'Volume -';
	gminus.onclick = () => {
		gain_node.gain.value /= 1.26;
	};

	const gplus = document.createElement('button');
	gplus.innerText = 'Volume +';
	gplus.onclick = () => {
		gain_node.gain.value *= 1.26;
	};

	const ulabel = document.createElement('label');
	ulabel.innerText = 'Load XM/MOD';
	ulabel.setAttribute('for', 'z');

	const input = document.createElement('input');
	input.setAttribute('type', 'file');
	input.setAttribute('id', 'z');

	const ppb = document.createElement('button');
	ppb.innerText = 'Play/Pause';
	ppb.classList.add('br');

	form.append(gminus, gplus, ulabel, input, ppb);
	document.body.append(form);

	form.onselectstart = () => false;

	input.onchange = () => loadModuleFile(input.files[0]);

	ppb.onclick = e => {
		ppb.classList.remove('br');
		if(audioContext.state === "running") {
			audioContext.suspend();
		} else {
			audioContext.resume();
		}
	};

	dinstruments.onclick = e => {
		const div = e.target.closest('div');
		div.classList.toggle('m');
		Module['_xm_mute_instrument'](ctx, ielements.indexOf(div)+1, div.classList.contains('m'));
	};

	dchannels.onclick = e => {
		const div = e.target.closest('div');
		div.classList.toggle('m');
		Module['_xm_mute_channel'](ctx, celements.indexOf(div)+1, div.classList.contains('m'));
	};

	(window.onhashchange = () => {
		const id = Number(window.location.hash.substring(1));
		if(!id) return;
		fetch('https://api.modarchive.org/downloads.php?moduleid=' + id)
			.then(response => response.blob())
			.then(response => loadModuleFile(response));
	})();

	const render = () => {
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

		const xmd = xmdata[0];

		for(let i = 0; i < ninsts; ++i) {
			const dist = (xmd.sampleCount - xmd.instruments[i].latestTrigger) / RATE;

			ielements[i].style['opacity'] = Math.min(1.0, Math.max(0.0, 1.0 - 2.0 * dist));
		}

		for(let j = 0; j < nchans; ++j) {
			const dist = (xmd.sampleCount - xmd.channels[j].latestTrigger) / RATE;
			celements[j].style['background'] = 'hsl(' + (360 * (xmd.channels[j].instrument - 1) / ninsts) + ', 100%, ' + (75.0 + 50.0 * dist) + '%)';

			if(!xmd.channels[j].active) {
				celements[j].innerText = '';
				felements[j].style['opacity'] =
					velements[2*j].style['height'] =
					velements[2*j+1].style['height'] =
					0;
				continue;
			}

			celements[j].innerText = [ 'A-', 'A#', 'B-', 'C-', 'C#', 'D-', 'D#', 'E-', 'F-', 'F#', 'G-', 'G#' ][Math.round(12.0 * Math.log(xmd.channels[j].frequency / 440.0) / Math.log(2)) % 12] + Math.floor(Math.log(xmd.channels[j].frequency) / Math.log(2) - 10);

			velements[2*j].style['height'] = (5.0 * xmd.channels[j].volume * (1.0 - xmd.channels[j].panning)) + 'em';
			velements[2*j+1].style['height'] = (5.0 * xmd.channels[j].volume * xmd.channels[j].panning) + 'em';

			velements[2*j+1].style['background'] =
				velements[2*j].style['background'] =
				felements[j].style['background'] =
				'hsl(' + (360 * (xmd.channels[j].instrument - 1) / ninsts) + ', 100%, 40%)';

			felements[j].style['opacity'] = xmd.channels[j].volume;
			felements[j].style['bottom'] = (15.0 * (Math.log(xmd.channels[j].frequency) / Math.log(2.0) - 13.0)) + '%';
		}
	};
	render();
};

Module['onRuntimeInitialized'] = () => {
	if(document.readyState === "loading") {
		document.addEventListener("DOMContentLoaded", START);
	} else {
		START();
	}
};
