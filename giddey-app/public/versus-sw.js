// Giddey Versus service worker — makes the installed app open offline.
// Pages: network first (so updates land), falling back to the cache.
// Build assets (/_next/static, hashed): cache first.
// Headshots and everything else: serve from cache, refresh in the background.
const VERSION = 'v1';
const PAGES = `versus-pages-${VERSION}`;
const ASSETS = `versus-assets-${VERSION}`;
const IMAGES = `versus-img-${VERSION}`;
const PRECACHE = ['/versus', '/versus.html', '/versus.webmanifest', '/versus-icons/icon-192.png', '/versus-icons/icon-512.png', '/logo.png'];

self.addEventListener('install', event => {
	event.waitUntil(
		caches.open(PAGES).then(cache => Promise.all(PRECACHE.map(url => cache.add(url).catch(() => undefined)))).then(() => self.skipWaiting()),
	);
});

self.addEventListener('activate', event => {
	const keep = [PAGES, ASSETS, IMAGES];
	event.waitUntil(
		caches
			.keys()
			.then(keys => Promise.all(keys.filter(k => k.startsWith('versus-') && !keep.includes(k)).map(k => caches.delete(k))))
			.then(() => self.clients.claim()),
	);
});

async function networkFirst(request) {
	const cache = await caches.open(PAGES);
	try {
		const res = await fetch(request);
		if (res.ok) cache.put(request, res.clone());
		return res;
	} catch {
		return (await cache.match(request, { ignoreSearch: true })) || (await cache.match('/versus')) || (await cache.match('/versus.html')) || Response.error();
	}
}

async function cacheFirst(request, name) {
	const cache = await caches.open(name);
	const hit = await cache.match(request);
	if (hit) return hit;
	const res = await fetch(request);
	if (res.ok || res.type === 'opaque') cache.put(request, res.clone());
	return res;
}

async function staleWhileRevalidate(request, name) {
	const cache = await caches.open(name);
	const hit = await cache.match(request);
	const fresh = fetch(request)
		.then(res => {
			if (res.ok || res.type === 'opaque') cache.put(request, res.clone());
			return res;
		})
		.catch(() => hit || Response.error());
	return hit || fresh;
}

self.addEventListener('fetch', event => {
	const { request } = event;
	if (request.method !== 'GET') return;
	const url = new URL(request.url);
	if (request.mode === 'navigate') return event.respondWith(networkFirst(request));
	if (url.origin === location.origin && url.pathname.startsWith('/_next/static/')) return event.respondWith(cacheFirst(request, ASSETS));
	if (request.destination === 'image') return event.respondWith(staleWhileRevalidate(request, IMAGES));
	if (url.origin === location.origin) return event.respondWith(staleWhileRevalidate(request, ASSETS));
});
