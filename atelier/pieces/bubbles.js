function(root,SG){SG=SG||{};
    const hero=root.querySelector('.q-hero'), cv=root.querySelector('.q-cv'), ctx=cv.getContext('2d'), cnt=root.querySelector('.q-count');
    const reduce=matchMedia('(prefers-reduced-motion: reduce)').matches;
    let W=1,H=1,D=1,raf=0,t=0,px=-999,py=-999,B=[],pops=[],popped=0;
    const make=y=>{const r=8+Math.random()*Math.random()*58;return{x:Math.random()*W,y:y!==undefined?y:H+r+Math.random()*H*.4,r,vy:.25+Math.random()*.5+(60-r)*.004,ph:Math.random()*6.28,rot:Math.random()*6.28,vx:0};};
    function size(){const r=hero.getBoundingClientRect();D=Math.min(2,window.devicePixelRatio||1);W=Math.max(1,Math.round(r.width));H=Math.max(1,Math.round(r.height));cv.width=W*D;cv.height=H*D;ctx.setTransform(D,0,0,D,0,0);B=[];const n=Math.round(Math.min(46,W/28));for(let i=0;i<n;i++)B.push(make(Math.random()*H));}
    function bubble(b){const r=b.r;ctx.save();ctx.translate(b.x,b.y);
      const f=ctx.createRadialGradient(-r*.3,-r*.3,r*.1,0,0,r);f.addColorStop(0,'rgba(255,255,255,.06)');f.addColorStop(.82,'rgba(255,255,255,.04)');f.addColorStop(1,'rgba(255,255,255,.32)');ctx.fillStyle=f;ctx.beginPath();ctx.arc(0,0,r,0,7);ctx.fill();
      ctx.rotate(b.rot);const g=ctx.createLinearGradient(-r,-r,r,r);g.addColorStop(0,'rgba(255,79,163,.6)');g.addColorStop(.35,'rgba(255,230,120,.55)');g.addColorStop(.65,'rgba(80,220,255,.6)');g.addColorStop(1,'rgba(160,120,255,.6)');
      ctx.strokeStyle=g;ctx.lineWidth=Math.max(1.2,r*.06);ctx.beginPath();ctx.arc(0,0,r*.96,0,7);ctx.stroke();ctx.rotate(-b.rot);
      ctx.fillStyle='rgba(255,255,255,.85)';ctx.beginPath();ctx.ellipse(-r*.38,-r*.42,r*.22,r*.12,-.7,0,7);ctx.fill();
      ctx.fillStyle='rgba(255,255,255,.45)';ctx.beginPath();ctx.ellipse(r*.42,r*.44,r*.08,r*.05,-.7,0,7);ctx.fill();ctx.restore();}
    function frame(){
      t+=.016;ctx.clearRect(0,0,W,H);
      for(const b of B){
        if(!reduce){b.y-=b.vy;b.x+=Math.sin(t*1.2+b.ph)*.35+b.vx;b.vx*=.94;b.rot+=.006;
          const dx=b.x-px,dy=b.y-py,d=Math.hypot(dx,dy)||1,R=b.r+70;if(d<R){const k=(R-d)/R;b.vx+=dx/d*k*1.1;b.y+=dy/d*k*1.1;}
          if(b.y<-b.r-12)Object.assign(b,make());}
        bubble(b);}
      pops=pops.filter(p=>p.t<1);
      pops.forEach(p=>{p.t+=reduce?1:.06;const e=p.t;ctx.strokeStyle='rgba(255,255,255,'+(1-e)+')';ctx.lineWidth=2;ctx.beginPath();ctx.arc(p.x,p.y,p.r*(1+e*.5),0,7);ctx.stroke();
        ctx.fillStyle='rgba(255,255,255,'+(1-e)+')';for(let i=0;i<10;i++){const a=i*.628+p.r;ctx.beginPath();ctx.arc(p.x+Math.cos(a)*p.r*(1+e*1.1),p.y+Math.sin(a)*p.r*(1+e*1.1)+e*e*20,2.4*(1-e)+.6,0,7);ctx.fill();}});
    }
    function loop(){frame();raf=requestAnimationFrame(loop);}
    const pos=e=>{const r=hero.getBoundingClientRect();return[e.clientX-r.left,e.clientY-r.top];};
    const move=e=>{[px,py]=pos(e);};
    const leave=()=>{px=-999;py=-999;};
    const click=e=>{if(e.target.closest('a,button'))return;const[x,y]=pos(e);let best=null,bd=1e9;B.forEach(b=>{const d=Math.hypot(b.x-x,b.y-y);if(d<b.r+8&&d<bd){bd=d;best=b;}});
      if(best){pops.push({x:best.x,y:best.y,r:best.r,t:0});Object.assign(best,make());popped++;cnt.textContent=popped;if(reduce)frame();}};
    hero.addEventListener('pointermove',move);hero.addEventListener('pointerleave',leave);hero.addEventListener('click',click);
    const ro=new ResizeObserver(()=>{size();frame();});ro.observe(hero);
    size(); if(reduce)frame(); else loop();
    return ()=>{cancelAnimationFrame(raf);ro.disconnect();hero.removeEventListener('pointermove',move);hero.removeEventListener('pointerleave',leave);hero.removeEventListener('click',click);};
  }
