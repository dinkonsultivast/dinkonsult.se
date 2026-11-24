/* Lås för projektavdelningen på dinkonsult.se.
   Sidorna ligger krypterade (AES-GCM 256, nyckel ur lösenordet via PBKDF2-SHA256).
   Utan lösenordet går innehållet inte att läsa, inte heller i repot. */
(function () {
  "use strict";
  var SALT = "7gDqcA15BlxZaOPBy0XuIg==";
  var VARV = 600000;
  var NYCKEL = "dkiv.projekt.nyckel";
  var INLOGG = "/projekt/";

  function b64tillBytes(s) {
    var bin = atob(s), u = new Uint8Array(bin.length);
    for (var i = 0; i < bin.length; i++) u[i] = bin.charCodeAt(i);
    return u;
  }
  function bytesTillB64(u) {
    var s = "";
    for (var i = 0; i < u.length; i += 0x8000) s += String.fromCharCode.apply(null, u.subarray(i, i + 0x8000));
    return btoa(s);
  }

  async function harled(losenord) {
    var bas = await crypto.subtle.importKey("raw", new TextEncoder().encode(losenord), "PBKDF2", false, ["deriveKey"]);
    return crypto.subtle.deriveKey(
      { name: "PBKDF2", salt: b64tillBytes(SALT), iterations: VARV, hash: "SHA-256" },
      bas, { name: "AES-GCM", length: 256 }, true, ["decrypt"]);
  }

  async function dekryptera(nyckel, paket) {
    var data = b64tillBytes(paket);
    var klar = await crypto.subtle.decrypt({ name: "AES-GCM", iv: data.subarray(0, 12) }, nyckel, data.subarray(12));
    var strom = new Blob([klar]).stream().pipeThrough(new DecompressionStream("gzip"));
    return new Response(strom).text();
  }

  function lasSparad() {
    try { return sessionStorage.getItem(NYCKEL) || localStorage.getItem(NYCKEL); } catch (e) { return null; }
  }
  async function sparadNyckel() {
    var r = lasSparad();
    if (!r) return null;
    return crypto.subtle.importKey("raw", b64tillBytes(r), "AES-GCM", false, ["decrypt"]);
  }
  async function spara(nyckel, kommIhag) {
    var r = bytesTillB64(new Uint8Array(await crypto.subtle.exportKey("raw", nyckel)));
    try {
      sessionStorage.setItem(NYCKEL, r);
      if (kommIhag) localStorage.setItem(NYCKEL, r); else localStorage.removeItem(NYCKEL);
    } catch (e) {}
  }
  function glom() {
    try { sessionStorage.removeItem(NYCKEL); localStorage.removeItem(NYCKEL); } catch (e) {}
  }
  function tillInloggning() {
    location.replace(INLOGG + "?till=" + encodeURIComponent(location.pathname + location.search + location.hash));
  }

  /* Används av varje låst sida. */
  async function oppnaSida(paket) {
    try {
      var nyckel = await sparadNyckel();
      if (!nyckel) return tillInloggning();
      var html = await dekryptera(nyckel, paket);
      document.open(); document.write(html); document.close();
    } catch (e) {
      glom(); tillInloggning();
    }
  }

  window.Las = {
    harled: harled, dekryptera: dekryptera, sparadNyckel: sparadNyckel,
    spara: spara, glom: glom, oppnaSida: oppnaSida
  };
})();
