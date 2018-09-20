/* Author: Romain "Artefact2" Dalmaso <artefact2@gmail.com> */

/* This program is free software. It comes without any warranty, to the
 * extent permitted by applicable law. You can redistribute it and/or
 * modify it under the terms of the Do What The Fuck You Want To Public
 * License, Version 2, as published by Sam Hocevar. See
 * http://sam.zoy.org/wtfpl/COPYING for more details. */

$(function() {

	var AUDIO_BUFFER_LENGTH = 4096;
	var XM_BUFFER_LENGTH = 256;
	var RATE = 48000;
	var MAX_XMDATA = 256;

	var audioContext = new AudioContext();
	var buffers = [
		audioContext.createBuffer(2, AUDIO_BUFFER_LENGTH, RATE),
		audioContext.createBuffer(2, AUDIO_BUFFER_LENGTH, RATE),
	];

	var LATENCY_COMP = RATE * (audioContext.outputLatency | audioContext.baseLatency | 0.25)
		- RATE / 60;
	
	var playing = true;
	var needsResync = true;
	var t0 = 0; /* Sync point in audio ctx */
	var s0 = 0; /* Sync point in xm ctx */
	var amp = 1.0;
	var clip = false;

	var xmActions = [];
	var cFloatArray = Module._malloc(2 * XM_BUFFER_LENGTH * 4);
	var moduleContextPtr = Module._malloc(4);
	var moduleContext = null;
	var cSamplesPtr = Module._malloc(8);

	var dinstruments = $("div#instruments");
	var dchannels = $("div#channels");
	var dvolumes = $("div#volumes");
	var dfrequencies = $("div#frequencies");
	var mtitle = $("p#mtitle");
	var ninsts = 0, nchans = 0;
	var ielements = [];
	var celements = [];
	var velements = [];
	var felements = [];
	var xmdata = [];

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
				hasdata = false;
				
				if(moduleContext !== null) {
					Module._xm_free_context(moduleContext);
					moduleContext = null;
				}

				var view = new Int8Array(reader.result);
				var moduleStringBuffer = Module._malloc(view.length);
				Module.writeArrayToMemory(view, moduleStringBuffer);
				var ret = Module._xm_create_context(
					moduleContextPtr, moduleStringBuffer, RATE
				);
				Module._free(moduleStringBuffer);

				if(ret !== 0) {
					moduleContext = null;
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

	var fillBuffer = function(buffer) {
		var l = buffer.getChannelData(0);
		var r = buffer.getChannelData(1);
		
		for(var off = 0; off < AUDIO_BUFFER_LENGTH; off += XM_BUFFER_LENGTH) {
			Module._xm_generate_samples(moduleContext, cFloatArray, XM_BUFFER_LENGTH);
			for(var j = 0; j < XM_BUFFER_LENGTH; ++j) {
				l[off+j] = Module.getValue(cFloatArray + 8 * j, 'float') * amp;
				r[off+j] = Module.getValue(cFloatArray + 8 * j + 4, 'float') * amp;
				if(!clip && (l[j] < -1.0 || l[j] > 1.0 || r[j] < -1.0 || r[j] > 1.0)) {
					clip = true;
				}
			}

			var xmd = {};
			
			Module._xm_get_position(moduleContext, null, null, null, cSamplesPtr);
			xmd.sampleCount = Module.getValue(cSamplesPtr, 'i64');

			xmd.instruments = [];
			for(var j = 1; j <= ninsts; ++j) {
				xmd.instruments.push({
					latestTrigger: Module._xm_get_latest_trigger_of_instrument(moduleContext, j),
				});
			}

			xmd.channels = [];
			for(var j = 1; j <= nchans; ++j) {
				xmd.channels.push({
					active: Module._xm_is_channel_active(moduleContext, j),
					latestTrigger: Module._xm_get_latest_trigger_of_channel(moduleContext, j),
					volume: Module._xm_get_volume_of_channel(moduleContext, j),
					panning: Module._xm_get_panning_of_channel(moduleContext, j),
					frequency: Module._xm_get_frequency_of_channel(moduleContext, j),
					instrument: Module._xm_get_instrument_of_channel(moduleContext, j),
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
							Module._xm_get_position(moduleContext, null, null, null, cSamplesPtr);
							s0 = Module.getValue(cSamplesPtr, 'i64');
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
			Module._xm_get_position(moduleContext, null, null, null, cSamplesPtr);
			s0 = Module.getValue(cSamplesPtr, 'i64');
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

	$("p#nojs").remove();
	var form = $(document.createElement('form'));
	form.prop('id', 'actions');
	form.submit(function(e) { e.preventDefault(); });

	var gminus = $(document.createElement('label'));
	gminus.text('🔉');
	gminus.prop('title', 'Lower gain by 1 dB');

	var gplus = $(document.createElement('label'));
	gplus.text('🔊');
	gplus.prop('title', 'Increase gain by 1 dB (MAY CREATE CLIPPING)');

	var ulabel = $(document.createElement('label'));
	ulabel.text('📂');
	ulabel.prop('title', 'Load .XM module…');
	ulabel.prop('for', 'iupload');
	ulabel.attr('for', 'iupload');
	
	var input = $(document.createElement('input'));
	input.prop('type', 'file');
	input.prop('id', 'iupload');

	var ppb = $(document.createElement('label'));
	ppb.text('⏯');
	ppb.prop('title', 'Play/Pause');

	form.append(gminus, gplus, ulabel, input, ppb);
	$("body").append(form);

	form.on('selectstart', function() {
		return false;
	});

	gminus.click(function() {
		amp /= 1.25892541179;
		clip = false;
	});

	gplus.click(function() {
		amp *= 1.25892541179;
	});

	var realLoadModule = function(file) {
		loadModule(file, function() {
			amp = 1.0;
			clip = false;
			needsResync = true;
			dinstruments.empty();
			dchannels.empty();
			dvolumes.empty();
			dfrequencies.empty();
			xmdata.splice(0, xmdata.length);

			ninsts = Module._xm_get_number_of_instruments(moduleContext);
			nchans = Module._xm_get_number_of_channels(moduleContext);

			for(var i = 0; i < ninsts; ++i) {
				dinstruments.append(
					ielements[i] = $(document.createElement('div')).css({
						'background-color': 'hsl(' + (360 * i / ninsts) + ', 100%, 40%)',
						opacity: '0',
					})
				);
			}

			for(var j = 0; j < nchans; ++j) {
				dchannels.append(
					celements[j] = $(document.createElement('div'))
				);

				dvolumes.append(
					velements[2 * j] = $(document.createElement('div')).css({
						width: (50 / nchans) + '%',
						left: (100 * j / nchans) + '%',
						height: '0em',
					}),
					velements[2 * j + 1] = $(document.createElement('div')).css({
						width: (50 / nchans) + '%',
						left: (100 * j / nchans + 50 / nchans) + '%',
						height: '0em',
					})
				);

				dfrequencies.append(
					felements[j] = $(document.createElement('div')).css({
						width: (100 / nchans) + '%',
						left: (100 * j / nchans) + '%',
					})
				);
			}

			mtitle.text("Currently playing: " + Pointer_stringify(Module._xm_get_module_name(moduleContext)));
		}, function() {
			alert('Broken module. Check the console for more info.');
		});
	};

	input.change(function() {
		realLoadModule(input.get(0).files[0]);
	});

	ppb.click(function() {		
		if(playing === true) {
			pause();
		} else {
			resume();
		}
	});

	dinstruments.on('click', 'div', function() {
		var d = $(this);
		d.toggleClass('muted');

		runXmContextAction(function() {
			if(moduleContext === null) return;
			Module._xm_mute_instrument(moduleContext, d.index()+1, d.hasClass('muted'));
		});
	});

	dchannels.on('click', 'div', function() {
		var d = $(this);
		d.toggleClass('muted');

		runXmContextAction(function() {
			if(moduleContext === null) return;
			Module._xm_mute_channel(moduleContext, d.index()+1, d.hasClass('muted'));
		});
	});


	var xhri = new XMLHttpRequest();
	xhri.open('GET', './xm/index.txt');
	xhri.responseType = 'text';
	xhri.onload = function() {
		if(this.status !== 200) return;

		var s = $("footer > p > small");
		s.append(document.createElement('br'));
		s.append('Or load one of these:');
		var ul = $(document.createElement('ul'));
		s.append(ul);

		var xms = this.responseText.split("\n");
		var li, l = xms.length - 1;
		for(var i = 0; i < l; ++i) {
			li = $(document.createElement('li'));
			li.append(
				$(document.createElement('a'))
					.text(xms[i])
					.prop('href', './xm/' + xms[i])
					.on('click', function(e) {
						e.preventDefault();

						var a = $(this);
						var xhr = new XMLHttpRequest();
						xhr.open('GET', a.prop('href'));
						xhr.responseType = 'blob';
						xhr.onload = function() {
							if(this.status !== 200) return;
							realLoadModule(this.response);
						};
						xhr.send();
					})
			);

			ul.append(li);
		}

		setTimeout(function() {
			var mods = ul.find('a');
			var n = window.location.hash.length >= 2 ? parseInt(window.location.hash.substring(1)) : Math.floor(Math.random() * mods.length);
			mods.eq(n).click();
		}, 250);
	};
	xhri.send();

	var notes = [
		'A-', 'A#', 'B-', 'C-', 'C#', 'D-', 'D#', 'E-', 'F-', 'F#', 'G-', 'G#',
	];
	var render = function() {
		requestAnimationFrame(render);
		if(xmdata.length === 0) return;

		var target = RATE * audioContext.currentTime - t0 - LATENCY_COMP;
		while(xmdata.length >= 2 && xmdata[0].sampleCount - s0 < target && xmdata[1].sampleCount - s0 < target) {
			xmdata.shift();
		}

		var xmd = xmdata[0];

		for(var i = 0; i < ninsts; ++i) {
			var dist = (xmd.sampleCount - xmd.instruments[i].latestTrigger) / RATE;
			ielements[i].css({
				opacity: Math.min(1.0, Math.max(0.0, 1.0 - 2.0 * dist)),
			});
		}
		
		for(var j = 0; j < nchans; ++j) {
			var dist = (xmd.sampleCount - xmd.channels[j].latestTrigger) / RATE;
			
			celements[j].css({
				'background-color': 'hsl(' + (360 * (xmd.channels[j].instrument - 1) / ninsts) + ', 100%, ' + (75.0 + 50.0 * dist) + '%)',
			}).text(
				xmd.channels[j].active && xmd.channels[j].volume > .01 ?
					notes[Math.round(12.0 * Math.log(xmd.channels[j].frequency / 440.0) / Math.log(2)) % 12]
					+ Math.floor(Math.log(xmd.channels[j].frequency) / Math.log(2) - 10)
					:
					''
			);

			velements[2 * j].css({
				height: xmd.channels[j].active ? (5.0 * xmd.channels[j].volume * (1.0 - xmd.channels[j].panning)) + 'em' : '0em',
				'background-color': 'hsl(' + (360 * (xmd.channels[j].instrument - 1) / ninsts) + ', 100%, 40%)',
			});
			velements[2 * j + 1].css({
				height: xmd.channels[j].active ?  (5.0 * xmd.channels[j].volume * xmd.channels[j].panning) + 'em' : '0em',
				'background-color': 'hsl(' + (360 * (xmd.channels[j].instrument - 1) / ninsts) + ', 100%, 40%)',
			});

			felements[j].css({
				opacity: xmd.channels[j].active ? xmd.channels[j].volume : '0',
				bottom: (15.0 * (Math.log(xmd.channels[j].frequency) / Math.log(2.0) - 13.0)) + '%',
				'background-color': 'hsl(' + (360 * (xmd.channels[j].instrument - 1) / ninsts) + ', 100%, 40%)',
			});
		}

		if(clip != gplus.hasClass('clip')) gplus.toggleClass('clip');
	};
	
	setupSources();
	requestAnimationFrame(render);
});
