/* Author: Romain "Artefact2" Dalmaso <artefact2@gmail.com> */

/* This program is free software. It comes without any warranty, to the
 * extent permitted by applicable law. You can redistribute it and/or
 * modify it under the terms of the Do What The Fuck You Want To Public
 * License, Version 2, as published by Sam Hocevar. See
 * http://sam.zoy.org/wtfpl/COPYING for more details. */

$(function() {

	var _BUFLEN = 48000 / 30;
	var _RATE = 48000;
	var _BUFTIME = _BUFLEN / _RATE;

	var audioContext = new (window.AudioContext || window.webkitAudioContext)();
	var buffers = [
		audioContext.createBuffer(2, _BUFLEN, _RATE),
		audioContext.createBuffer(2, _BUFLEN, _RATE),
	];
	var sources = [ null, null ];
	var playing = null;
	var amp = 1.0;
	var clip = false;

	var xmActions = [];
	var cFloatArray = Module._malloc(2 * _BUFLEN * 4);
	var moduleContextPtr = Module._malloc(4);
	var moduleContext = null;
	var cSamplesPtr = Module._malloc(8);

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
						l[j] = Module.getValue(cFloatArray + 8 * j, 'float') * amp;
						r[j] = Module.getValue(cFloatArray + 8 * j + 4, 'float') * amp;
						if(!clip && (l[j] < -1.0 || l[j] > 1.0 || r[j] < -1.0 || r[j] > 1.0)) {
							clip = true;
						}
					}

					Module._xm_get_position(moduleContext, null, null, null, cSamplesPtr);
					var cs = Module.getValue(cSamplesPtr, 'i64');

					for(var j = 1; j <= ninsts; ++j) {
						itriggers[j] = cs - Module._xm_get_latest_trigger_of_instrument(moduleContext, j);
					}
					for(var j = 1; j <= nchans; ++j) {
						cdata[j] = Module._xm_is_channel_active(moduleContext, j) ? [
							Module._xm_get_volume_of_channel(moduleContext, j),
							Module._xm_get_frequency_of_channel(moduleContext, j),
							Module._xm_get_instrument_of_channel(moduleContext, j),
						] : [ 0.0, 440.0, 1 ];
					}
					hasdata = true;
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
	form.prop('id', 'actions');
	form.submit(function(e) { e.preventDefault(); });

	var gminus = $(document.createElement('label'));
	gminus.text('🕩');
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
	ppb.text('►');
	ppb.prop('title', 'Play/Pause');

	ppb.prop('disabled', true);
	form.append(gminus, gplus, ulabel, input, ppb);
	$("body").append(form);

	var dinstruments = $("div#instruments");
	var dchannels = $("div#channels");
	var ninsts = 0, nchans = 0;
	var ielements = [];
	var celements = [];
	var itriggers = [], cdata = [];
	var hasdata = false;
	var mtitle = $("p#mtitle");

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
			dinstruments.empty();
			dchannels.empty();
			instinner = [];
			chaninner = [];

			ninsts = Module._xm_get_number_of_instruments(moduleContext);
			nchans = Module._xm_get_number_of_channels(moduleContext);

			for(var i = 1; i <= ninsts; ++i) {
				dinstruments.append(
					ielements[i] = $(document.createElement('div')).css({
						'background-color': 'hsl(' + (360 * (i-1) / ninsts) + ', 100%, 40%)'
					})
				);
			}

			for(var j = 1; j <= nchans; ++j) {
				dchannels.append(
					celements[j] = $(document.createElement('div')).css({
						top: (1-j) * .5 + 'em',
					})
				);
			}

			mtitle.text("Currently playing: " + Pointer_stringify(Module._xm_get_module_name(moduleContext)));
			
			if(playing === null) {
				ppb.prop('disabled', false).click();
			}
		}, function() {
			alert('Broken module. Check the console for more info.');
			ppb.prop('disabled', true);
		});
	};

	input.change(function() {
		realLoadModule(input.get(0).files[0]);
	});

	ppb.click(function() {
		if(ppb.prop('disabled')) {
			ulabel.click();
			return;
		}
		
		if(playing === true) {
			pause();
			ppb.text('►');
		} else {
			play();
			ppb.text('⏸');
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

							a.parent().parent().children('li.playing').removeClass('playing');
							realLoadModule(this.response);
							a.parent().addClass('playing');
						};
						xhr.send();
					})
			);

			ul.append(li);
		}
	};
	xhri.send();

	var freqoffset = Math.log(440 * Math.pow(2, 5));
	var octamp = 10 / Math.log(2);
	var dloop = function() {
		if(clip != gplus.hasClass('clip')) gplus.toggleClass('clip');

		if(hasdata) {
			for(var i = 1; i <= ninsts; ++i) {
				ielements[i].css('opacity', 1.0 - Math.min(1.0, itriggers[i] / 24000));
			}
			for(var j = 1; j <= nchans; ++j) {
				celements[j].css({
					opacity: cdata[j][0],
					left: (50 + octamp * (Math.log(cdata[j][1]) - freqoffset)) + '%',
					'background-color': 'hsl(' + (360 * (cdata[j][2]-1) / ninsts) + ', 100%, 40%)'
				});
			}
		}

		requestAnimationFrame(dloop);
	};
	requestAnimationFrame(dloop);
});
