#!/bin/sh
# Rebuilds index.html (the installable app) from artifact.html (the page published as a Claude artifact).
set -e
cd "$(dirname "$0")"
{
cat <<'HEAD'
<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1,viewport-fit=cover">
<meta name="description" content="Scoring for The Masters, Summer Series, Skins Major and New Year Major.">
<meta name="theme-color" content="#1d6a3d">
<meta name="apple-mobile-web-app-capable" content="yes">
<meta name="mobile-web-app-capable" content="yes">
<meta name="apple-mobile-web-app-status-bar-style" content="black-translucent">
<meta name="apple-mobile-web-app-title" content="Majors">
<link rel="manifest" href="manifest.webmanifest">
<link rel="icon" href="icons/icon.svg" type="image/svg+xml">
<link rel="apple-touch-icon" href="icons/apple-touch-icon.png">
<style>:root{color-scheme:light;box-sizing:border-box;padding-top:env(safe-area-inset-top,0px);padding-bottom:env(safe-area-inset-bottom,0px)}body{margin:0;font:14px -apple-system,BlinkMacSystemFont,sans-serif}img{max-width:100%}[hidden]{display:none!important}</style>
<script src="firebase-config.js"></script>
<script src="https://www.gstatic.com/firebasejs/10.12.2/firebase-app-compat.js"></script>
<script src="https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore-compat.js"></script>
<script src="sync.js"></script>
</head>
<body>
HEAD
cat artifact.html
cat <<'TAIL'
<div class="wrap" id="clubbar" hidden style="padding-block:0 24px"><p class="note"><span id="clubtext"></span> <button class="btn small" id="clubchange" style="margin-left:6px">Change</button></p></div>
<div id="join" hidden style="position:fixed;inset:0;z-index:20;background:var(--bg);overflow:auto">
  <div class="wrap" style="padding-block:max(48px,env(safe-area-inset-top,0px)) 32px">
    <h2>Join your club</h2>
    <section class="card stack">
      <p style="margin:0">Enter the club code you all agreed. Everyone using the same code sees the same scores, live.</p>
      <div class="field"><label for="joincode">Club code</label><input type="text" id="joincode" autocapitalize="none" autocomplete="off" spellcheck="false"></div>
      <p class="note warn" id="joinerr" hidden style="margin:0">Use at least 6 letters, numbers or dashes.</p>
      <div class="actions" style="margin:0"><button class="btn primary" id="joingo">Join</button><button class="btn" id="joinlocal">Use on this phone only</button></div>
    </section>
  </div>
</div>
<script>
(function () {
  const club = window.majorsClub;
  if (!club) return;
  const code = club.get();
  if (code) {
    document.getElementById('clubbar').hidden = false;
    document.getElementById('clubtext').textContent = 'Club code: ' + code + '.';
    document.getElementById('clubchange').onclick = () => { club.set(''); location.reload(); };
    return;
  }
  try { if (sessionStorage.getItem('majors-tour-local')) return; } catch (e) {}
  document.getElementById('join').hidden = false;
  document.getElementById('joingo').onclick = () => {
    const v = document.getElementById('joincode').value.trim().toLowerCase().replace(/\s+/g, '-');
    if (!/^[a-z0-9-]{6,60}$/.test(v)) { document.getElementById('joinerr').hidden = false; return; }
    club.set(v); location.reload();
  };
  document.getElementById('joinlocal').onclick = () => { try { sessionStorage.setItem('majors-tour-local', '1'); } catch (e) {} document.getElementById('join').hidden = true; };
})();
if ('serviceWorker' in navigator) window.addEventListener('load', () => navigator.serviceWorker.register('sw.js').catch(() => {}));
</script>
</body>
</html>
TAIL
} > index.html
