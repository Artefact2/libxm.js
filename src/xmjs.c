/* Author: Romain "Artefact2" Dalmaso <artefact2@gmail.com> */

/* This program is free software. It comes without any warranty, to the
 * extent permitted by applicable law. You can redistribute it and/or
 * modify it under the terms of the Do What The Fuck You Want To Public
 * License, Version 2, as published by Sam Hocevar. See
 * http://sam.zoy.org/wtfpl/COPYING for more details. */

#include <xm.h>
#include <stdlib.h>

/* The public symbols are relatively terse, because emscripten cannot mangle
   them. */

#define RATE 44100

xm_context_t* c = 0;
char s[24*256];

static char* strcpy(char* dst, const char* src) {
	while(*src) {
		*dst++ = *src++;
	}
	return dst;
}

/* Load context into c and module title/tracker name/instrument text into s.
   If loading fails, set c to 0. */
void a(const char* moddata) {
	if(c) {
		free(c);
		c = 0;
	}

	xm_prescan_data_t* p = alloca(XM_PRESCAN_DATA_SIZE);
	if(xm_prescan_module(moddata, UINT32_MAX, p) == false) {
		return;
	}

	c = malloc(xm_size_for_context(p));
	if(c == NULL) {
		c = 0;
		return;
	}
	c = xm_create_context((void*)c, p, moddata, UINT32_MAX, RATE);

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
}
