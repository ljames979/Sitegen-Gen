function(root,SG){SG=SG||{};
    const hero=root.querySelector('.k-hero'), cv=root.querySelector('.k-cv'), ctx=cv.getContext('2d');
    const S=[...root.querySelectorAll('.k-word')].map(w=>[...w.querySelectorAll('.k-s')]);
    const ring=root.querySelector('.k-ring'), tEl=root.querySelector('.k-time'), lEl=root.querySelector('.k-round');
    const reduce=matchMedia('(prefers-reduced-motion: reduce)').matches;
    let W=1,H=1,D=1,raf=0,energy=0,lx=null,ly=null,rings=[],last='';
    const t0=performance.now(), c0=performance.now()-(2*240+13)*1000;
    function size(){const r=hero.getBoundingClientRect();D=Math.min(2,window.devicePixelRatio||1);W=Math.max(1,Math.round(r.width));H=Math.max(1,Math.round(r.height));cv.width=W*D;cv.height=H*D;ctx.setTransform(D,0,0,D,0,0);}
    const move=e=>{if(lx!==null){const v=Math.hypot(e.clientX-lx,e.clientY-ly);energy=Math.min(1.4,energy+v*.005);}lx=e.clientX;ly=e.clientY;};
    const hit=e=>{if(reduce||e.target.closest('a,button'))return;const r=hero.getBoundingClientRect();rings.push({x:e.clientX-r.left,y:e.clientY-r.top,t:0});energy=Math.min(1.6,energy+.9);};
    hero.addEventListener('pointermove',move);hero.addEventListener('pointerdown',hit);
    function frame(){
      const T=(performance.now()-t0)/1000;
      if(!reduce){energy*=.93;S.forEach((sl,w)=>sl.forEach((el,i)=>{const c=i-(sl.length-1)/2;const x=Math.sin(T*1.4+i*.8+w*2)*2.2+energy*(c*9+Math.sin(T*28+i*1.7)*16);el.style.transform='translateX('+x.toFixed(1)+'px)';}));}
      ctx.clearRect(0,0,W,H);
      rings=rings.filter(r=>r.t<1);
      rings.forEach(r=>{r.t+=.022;const e=1-Math.pow(1-r.t,3);ctx.lineWidth=6*(1-r.t)+1;ctx.strokeStyle='rgba(255,43,43,'+(1-r.t)+')';ctx.beginPath();ctx.arc(r.x,r.y,20+e*320,0,7);ctx.stroke();ctx.lineWidth=1.5;ctx.strokeStyle='rgba(242,239,233,'+((1-r.t)*.7)+')';ctx.beginPath();ctx.arc(r.x,r.y,10+e*200,0,7);ctx.stroke();});
      if(ring){const s=(performance.now()-c0)/1000,cyc=s%240,round=Math.floor(s/240)%8+1,work=cyc<180,left=Math.ceil(work?180-cyc:240-cyc);
      ring.style.setProperty('--p',(work?cyc/180:(cyc-180)/60).toFixed(4));
      const txt=Math.floor(left/60)+':'+String(left%60).padStart(2,'0');
      if(txt!==last){last=txt;tEl.textContent=txt;lEl.textContent=work?'Round '+round+' of 8':'Rest · 1 minute';ring.dataset.rest=String(!work);}}
      raf=requestAnimationFrame(frame);
    }
    const ro=new ResizeObserver(size);ro.observe(hero);
    size(); frame();
    return ()=>{cancelAnimationFrame(raf);ro.disconnect();hero.removeEventListener('pointermove',move);hero.removeEventListener('pointerdown',hit);};
  }
