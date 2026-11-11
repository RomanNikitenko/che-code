/**********************************************************************
 * Copyright (c) 2026 Red Hat, Inc.
 *
 * This program and the accompanying materials are made
 * available under the terms of the Eclipse Public License 2.0
 * which is available at https://www.eclipse.org/legal/epl-2.0/
 *
 * SPDX-License-Identifier: EPL-2.0
 ***********************************************************************/
/* eslint-disable header/header */

/*
 * TEMPORARY DIAGNOSTICS — title bar / status bar "inactive" state investigation.
 * See .vscode/window-title-regression/ (Problem 2). Not meant to be merged.
 *
 * Usage (browser devtools console of the workbench page):
 *   copy(__cheFocusDump())          -> copies the whole log as text (paste into a file)
 *   __cheFocusLog                   -> raw entries
 *   __cheFocusState()               -> current focus snapshot
 *   localStorage.setItem('che-focus-force-active', 'true'); location.reload()
 *                                   -> enables fix variant A (title bar + status bar never inactive)
 *   localStorage.removeItem('che-focus-force-active'); location.reload()
 *                                   -> back to upstream behaviour
 *
 * NOTE: while the cursor is in devtools, document.hasFocus() is false. Reproduce with devtools
 * closed (or at least not focused), then open devtools and dump the log.
 */

const MAX_ENTRIES = 3000;

interface ICheFocusEntry {
	seq: number;
	t: number;
	tag: string;
	data?: Record<string, unknown>;
	snap: Record<string, unknown>;
}

const entries: ICheFocusEntry[] = [];
let seq = 0;

function hasDom(): boolean {
	return typeof window !== 'undefined' && typeof document !== 'undefined';
}

function describeElement(el: Element | null | undefined): string {
	if (!el) {
		return String(el);
	}
	if (el === document.body) {
		return 'BODY';
	}
	const tag = el.tagName;
	const id = el.id ? `#${el.id}` : '';
	const cls = typeof el.className === 'string' && el.className ? `.${el.className.trim().split(/\s+/).slice(0, 3).join('.')}` : '';
	return `${tag}${id}${cls}`.slice(0, 80);
}

export function cheFocusSnapshot(): Record<string, unknown> {
	if (!hasDom()) {
		return {};
	}
	let titlebarInactive: boolean | undefined;
	try {
		titlebarInactive = document.querySelector('.part.titlebar')?.classList.contains('inactive');
	} catch {
		// ignore
	}
	return {
		docHasFocus: document.hasFocus(),
		visibility: document.visibilityState,
		activeElement: describeElement(document.activeElement),
		titlebarInactive
	};
}

export function cheFocusLog(tag: string, data?: Record<string, unknown>): void {
	if (!hasDom()) {
		return;
	}
	const entry: ICheFocusEntry = {
		seq: ++seq,
		t: Math.round(performance.now()),
		tag,
		data,
		snap: cheFocusSnapshot()
	};
	entries.push(entry);
	if (entries.length > MAX_ENTRIES) {
		entries.shift();
	}
	console.log('[che-focus]', entry.seq, entry.t, tag, JSON.stringify(data ?? {}), JSON.stringify(entry.snap));
}

let forceActiveCache: boolean | undefined;

/** Fix variant A toggle: `localStorage['che-focus-force-active'] === 'true'` (read once per page load). */
export function cheFocusForceActive(): boolean {
	if (forceActiveCache === undefined) {
		try {
			forceActiveCache = hasDom() && window.localStorage.getItem('che-focus-force-active') === 'true';
		} catch {
			forceActiveCache = false;
		}
	}
	return forceActiveCache;
}

/** Short stack (useful even in minified builds to tell call sites apart). */
export function cheFocusStack(): string {
	const stack = new Error().stack ?? '';
	return stack.split('\n').slice(2, 7).map(l => l.trim()).join(' <- ').slice(0, 600);
}

function installRawListeners(): void {
	if (!hasDom()) {
		return;
	}
	const target = window as unknown as Record<string, unknown>;
	if (target['__cheFocusLog']) {
		return; // already installed (e.g. module evaluated twice)
	}
	target['__cheFocusLog'] = entries;
	target['__cheFocusState'] = cheFocusSnapshot;
	target['__cheFocusDump'] = () => entries.map(e =>
		`${e.seq}\t${e.t}\t${e.tag}\t${JSON.stringify(e.data ?? {})}\t${JSON.stringify(e.snap)}`
	).join('\n');

	const describeTarget = (e: Event) => e.target === window ? 'window' : e.target === document ? 'document' : describeElement(e.target as Element);

	// Raw window-level events (capture phase sees element focus/blur too)
	window.addEventListener('focus', e => cheFocusLog('raw.focus', { target: describeTarget(e) }), true);
	window.addEventListener('blur', e => cheFocusLog('raw.blur', { target: describeTarget(e) }), true);
	document.addEventListener('visibilitychange', () => cheFocusLog('raw.visibilitychange'));
	window.addEventListener('pageshow', () => cheFocusLog('raw.pageshow'));
	window.addEventListener('pagehide', () => cheFocusLog('raw.pagehide'));
	// Clicks: which element the user clicked (capture, before any handler can stop it)
	window.addEventListener('mousedown', e => cheFocusLog('raw.mousedown', { target: describeTarget(e) }), true);
	window.addEventListener('mouseup', e => cheFocusLog('raw.mouseup', { target: describeTarget(e), defaultPrevented: e.defaultPrevented }), true);

	cheFocusLog('debug.installed', {
		forceActive: cheFocusForceActive(),
		url: location.pathname,
		inIframe: (() => { try { return window.self !== window.top; } catch { return 'cross-origin-parent'; } })(),
		readyState: document.readyState
	});
}

installRawListeners();
