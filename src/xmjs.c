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

/* Load context into c. If loading fails, sets c to 0. */
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
	c = xm_create_context((void*)c, p, moddata, UINT32_MAX, RATE);
}
