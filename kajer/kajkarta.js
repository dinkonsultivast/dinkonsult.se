/* Ritar en enkel SVG karta över älvrummet med kajerna som punkter. Används av undersidorna. */
(function(){
  function dec(s){let i=0,la=0,lo=0;const o=[];while(i<s.length){const v=[];for(let k=0;k<2;k++){let r=0,sh=0,b;do{b=s.charCodeAt(i++)-63;r|=(b&31)<<sh;sh+=5}while(b>=32);v.push(r&1?~(r>>1):r>>1)}la+=v[0];lo+=v[1];o.push([la/1e4,lo/1e4])}return o}
  const NS="http://www.w3.org/2000/svg";
  function el(n,a,p){const e=document.createElementNS(NS,n);for(const k in a)e.setAttribute(k,a[k]);if(p)p.appendChild(e);return e}
  window.Kajkarta=function(svg,data,opt){
    opt=opt||{};
    const B=opt.bounds||{w:11.889,e:11.997,s:57.6885,n:57.7235};
    const kx=Math.cos(57.705*Math.PI/180),W=1000,H=Math.round(W*(B.n-B.s)/((B.e-B.w)*kx));
    svg.setAttribute("viewBox",`0 0 ${W} ${H}`);svg.setAttribute("class","kmap");svg.setAttribute("role","img");
    const X=lo=>(lo-B.w)/(B.e-B.w)*W,Y=la=>(B.n-la)/(B.n-B.s)*H;
    const path=pts=>pts.map((p,i)=>(i?"L":"M")+X(p[1]).toFixed(1)+" "+Y(p[0]).toFixed(1)).join("");
    const g=el("g",{},svg);
    for(const s of data.vec.W){const p=dec(s.slice(1));el("path",{d:path(p)+"Z",class:s[0]==="o"?"w":"l"},g)}
    for(const k of ["p","t","m"])for(const s of data.vec.R[k])el("path",{d:path(dec(s)),class:"r"},g);
    for(const s of data.vec.P)el("path",{d:path(dec(s)),class:"p"},g);
    const areas=[["HISINGEN",57.7135,11.928],["MAJORNA",57.6935,11.932],["CENTRUM",57.7025,11.975],["ERIKSBERG",57.7035,11.906],["LINDHOLMEN",57.7105,11.94],["FRIHAMNEN",57.7195,11.953],["RINGÖN",57.7228,11.976],["GULLBERGSVASS",57.7108,11.986]];
    if(opt.areas!==false)for(const a of areas){const t=el("text",{x:X(a[2]),y:Y(a[1]),class:"area","text-anchor":"middle"},g);t.textContent=a[0]}
    const dots={},labels=el("g",{},svg),dg=el("g",{},svg);
    for(const k of data.kajer){if(k.lon<B.w||k.lon>B.e||k.lat<B.s||k.lat>B.n)continue;
      const c=el("circle",{cx:X(k.lon),cy:Y(k.lat),r:9},dg);const t=el("title",{},c);t.textContent=k.id+" "+k.namn;dots[k.id]={c,k}}
    return {
      W,H,X,Y,
      paint(fn,lab){
        labels.innerHTML="";
        for(const id in dots){const {c,k}=dots[id];const s=fn(k)||{};c.style.fill=s.fill||"var(--muted)";c.setAttribute("r",s.r||8);c.style.opacity=s.op==null?1:s.op}
        for(const L of (lab||[])){const d=dots[L.id];if(!d)continue;const x=+d.c.getAttribute("cx"),y=+d.c.getAttribute("cy");
          const t=el("text",{x:x+(L.dx||14),y:y+(L.dy||-12),class:"lbl","text-anchor":L.anchor||"start"},labels);t.textContent=L.text}
      }
    };
  };
  window.KajTema=function(){
    let v="auto";try{v=localStorage.getItem("kajatlas-tema")||"auto"}catch(e){}
    function apply(x){if(x==="auto")document.documentElement.removeAttribute("data-theme");else document.documentElement.setAttribute("data-theme",x);document.querySelectorAll("#themebar button").forEach(b=>b.setAttribute("aria-pressed",b.dataset.t===x))}
    apply(v);document.querySelectorAll("#themebar button").forEach(b=>b.onclick=()=>{apply(b.dataset.t);try{localStorage.setItem("kajatlas-tema",b.dataset.t)}catch(e){}});
  };
})();
