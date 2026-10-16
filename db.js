// تسجيل الزيارات ونتائج الطلاب في قاعدة بيانات الخادم (Railway).
// إذا لم يتوفر الخادم يعمل الموقع عاديًا وتُحفظ النتائج على الجهاز فقط.
(function(){
  const cfg = window.APP_CONFIG || {};
  const onPages = /\.github\.io$/.test(location.hostname) || location.protocol === "file:";
  const API = (cfg.API_URL || (onPages ? "" : location.origin)).replace(/\/+$/, "");
  const enabled = !!API;

  function visitorId(){
    const k = "khuwaildiya-visitor";
    try{
      let v = localStorage.getItem(k);
      if(!v){ v = (crypto.randomUUID ? crypto.randomUUID() : Date.now().toString(36)+Math.random().toString(36).slice(2)); localStorage.setItem(k, v); }
      return v;
    }catch(e){ return "anon"; }
  }
  const VID = visitorId();

  async function post(path, row){
    if(!enabled) return false;
    try{
      const r = await fetch(API + path, {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify(row), keepalive: true
      });
      return r.ok;
    }catch(e){ return false; }
  }
  const cut = (v, n) => v == null ? null : String(v).slice(0, n);

  window.DB = {
    enabled, api: API,
    visitorId: VID,
    logEvent(event, o = {}){
      return post("/api/visits", {
        visitor_id: VID, event,
        name: cut(o.name, 60), mode: cut(o.mode, 20),
        details: o.details || null,
        page: cut(location.pathname, 200),
        referrer: cut(document.referrer, 300),
        user_agent: cut(navigator.userAgent, 300),
        lang: cut(navigator.language, 20),
        screen: `${screen.width}x${screen.height}`
      });
    },
    saveAttempt(a){
      return post("/api/attempts", {
        client_id: cut(a.id, 60), visitor_id: VID,
        name: cut(a.name || "طالب", 60),
        units: a.units || [], correct: a.correct|0, total: a.total|0, pct: a.pct|0,
        by_topic: a.byTopic || {}
      });
    }
  };
})();
