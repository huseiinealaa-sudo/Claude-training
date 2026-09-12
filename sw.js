/* Service Worker — يجعل التطبيق يعمل كاملاً بلا إنترنت */
const V = "en-course-v2-24";
const CORE = [
  "./",
  "./English-A2-to-B2.html",
  "./assets/app.css",
  "./assets/app.js",
  "./content/course.json",
  "./content/phonetics.json",
  "./content/unit-01.json",
  "./content/unit-02.json",
  "./content/unit-03.json",
  "./content/unit-04.json",
  "./content/unit-05.json",
  "./content/unit-06.json",
  "./content/unit-07.json",
  "./content/unit-08.json",
  "./content/unit-09.json",
  "./content/unit-10.json",
  "./content/unit-11.json",
  "./content/unit-12.json",
  "./content/unit-13.json",
  "./content/unit-14.json",
  "./content/unit-15.json",
  "./content/unit-16.json",
  "./content/unit-17.json",
  "./content/unit-18.json",
  "./content/unit-19.json",
  "./content/unit-20.json",
  "./content/unit-21.json",
  "./content/unit-22.json",
  "./content/unit-23.json",
  "./content/unit-24.json",
  "./content/bank.json"
];

self.addEventListener("install", e => {
  e.waitUntil(
    caches.open(V)
      .then(c => Promise.allSettled(CORE.map(u => c.add(u))))
      .then(() => self.skipWaiting())
  );
});

self.addEventListener("activate", e => {
  e.waitUntil(
    caches.keys()
      .then(ks => Promise.all(ks.filter(k => k !== V).map(k => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

/* الشبكة أوّلاً ثمّ الذاكرة: يبقى المحتوى محدّثاً ويعمل دون اتّصال */
self.addEventListener("fetch", e => {
  const r = e.request;
  if (r.method !== "GET") return;
  if (new URL(r.url).origin !== location.origin) return;
  e.respondWith(
    fetch(r)
      .then(res => {
        const copy = res.clone();
        caches.open(V).then(c => c.put(r, copy)).catch(() => {});
        return res;
      })
      .catch(() => caches.match(r).then(m => m || caches.match("./English-A2-to-B2.html")))
  );
});
