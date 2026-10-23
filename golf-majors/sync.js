// Live sync for the installed app: a small Firebase Firestore adapter exposing the same calls the
// app uses with Claude's database (doc/collection, set/update/delete, onSnapshot).
// Everything lives under clubs/<club code>/, so only phones that know the code see your data.
(function () {
  const KEY = 'majors-tour-club';
  const getClub = () => { try { return localStorage.getItem(KEY) || ''; } catch (e) { return ''; } };
  const setClub = (c) => { try { if (c) localStorage.setItem(KEY, c); else localStorage.removeItem(KEY); } catch (e) {} };
  const cfg = window.MAJORS_FIREBASE_CONFIG;
  if (!cfg || !cfg.apiKey) return; // no Firebase yet: the app stays on-this-phone only

  const club = getClub();
  window.majorsClub = { get: getClub, set: setClub };
  if (!club) return;
  window.majorsDbLabel = `Live: synced with everyone using club code “${club}”.`;

  window.majorsDb = async function () {
    if (typeof firebase === 'undefined') return null;
    if (!firebase.apps.length) firebase.initializeApp(cfg);
    const fs = firebase.firestore();
    try { await fs.enablePersistence({ synchronizeTabs: true }); } catch (e) {}
    const base = fs.collection('clubs').doc(club);
    const wrapSnap = (s) => ({ id: s.id, exists: s.exists, data: () => s.data(), metadata: s.metadata });
    const wrapDoc = (ref) => ({
      id: ref.id,
      path: ref.path,
      get: () => ref.get().then(wrapSnap),
      set: (d) => ref.set(d),
      // the app's update() deep-merges nested objects; Firestore does that with set(..., {merge: true})
      update: (d) => ref.set(d, { merge: true }),
      delete: () => ref.delete(),
      onSnapshot: (next, err) => ref.onSnapshot((s) => next(wrapSnap(s)), err),
    });
    return {
      doc: (path) => { const [c, d] = path.split('/'); return wrapDoc(base.collection(c).doc(d)); },
      collection: (name) => ({
        onSnapshot: (next, err) => base.collection(name).onSnapshot(
          (qs) => next({ docs: qs.docs.map(wrapSnap), size: qs.size, empty: qs.empty, metadata: qs.metadata }), err),
      }),
    };
  };
})();
