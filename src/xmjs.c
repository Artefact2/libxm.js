/* Author: Romain "Artefact2" Dalmaso <artefact2@gmail.com> */

/* This program is free software. It comes without any warranty, to the
 * extent permitted by applicable law. You can redistribute it and/or
 * modify it under the terms of the Do What The Fuck You Want To Public
 * License, Version 2, as published by Sam Hocevar. See
 * http://sam.zoy.org/wtfpl/COPYING for more details. */

#include <xm.h>

/* The public symbols are relatively terse, because emscripten cannot mangle
   them. */

#define RATE 44100
#define XM_BUFFER_LENGTH 256

char m[16 << 20]; /* Module data, filled in libxm.js */
static char mempool[48 << 20]; /* Memory for xm_context_t */

float f[2 * XM_BUFFER_LENGTH]; /* Buffer for audio frames, read by libxm.js */
uint32_t l; /* Number of generated samples, used in libxm.js by
               xm_get_position() */

uint16_t n; /* Packed number of channels/instruments */
char s[24*256]; /* Formatted module/tracker/instrument text */

static char* strcpy(char* dst, const char* src) {
	while(*src) {
		*dst++ = *src++;
	}
	return dst;
}

/* Load context and return it, load channel/instrument count in n and module
   title/tracker name/instrument text into s. If loading fails, return 0. */
xm_context_t* a() {
	xm_prescan_data_t* p = (void*)
		(mempool + sizeof(mempool) - XM_PRESCAN_DATA_SIZE);
	if(xm_prescan_module(m, sizeof(m), p) == false) {
		return 0;
	}

	if(xm_size_for_context(p) > sizeof(mempool) - XM_PRESCAN_DATA_SIZE) {
		return 0;
	}

	xm_context_t* c =
		xm_create_context(mempool, p, m, sizeof(m), RATE);

	n = (uint16_t)(xm_get_number_of_channels(c) << 8)
		| xm_get_number_of_instruments(c);

	char* t = strcpy(s, xm_get_module_name(c));
	*t = '\n'; ++t;
	t = strcpy(t, xm_get_tracker_name(c));
	*t = '\n'; ++t;
	*t = '\n'; ++t;
	for(uint8_t i = 1; i <= xm_get_number_of_instruments(c); ++i) {
		t = strcpy(t, xm_get_instrument_name(c, i));
		*t = '\n'; ++t;
	}
	*t = '\0';

	return c;
}
