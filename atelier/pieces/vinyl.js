function(root,SG){SG=SG||{};
    const cv=root.querySelector('.v-cv'), ctx=cv.getContext('2d'), arm=root.querySelector('.v-arm'), rpmEl=root.querySelector('.v-rpm');
    const reduce=matchMedia('(prefers-reduced-motion: reduce)').matches;
    const grooves=document.createElement('canvas'), gx=grooves.getContext('2d');
    const W0=2*Math.PI*(100/3)/60, TARGET=reduce?0:W0;
    let S=1,D=1,raf=0,th=0,w=TARGET,drag=false,lastA=0,lastT=0,prev=performance.now(),shown='';
    function size(){const r=cv.getBoundingClientRect();D=Math.min(2,window.devicePixelRatio||1);S=Math.max(1,Math.round(r.width));cv.width=cv.height=S*D;ctx.setTransform(D,0,0,D,0,0);
      grooves.width=grooves.height=S*D;gx.setTransform(D,0,0,D,0,0);const c=S/2,R=S*.47;
      gx.fillStyle='#0F0E0D';gx.beginPath();gx.arc(c,c,R,0,7);gx.fill();
      for(let r=R*.36;r<R*.985;r+=1.25){gx.strokeStyle='rgba(255,255,255,'+(0.02+0.03*Math.abs(Math.sin(r*.37))).toFixed(3)+')';gx.lineWidth=.6;gx.beginPath();gx.arc(c,c,r,0,7);gx.stroke();}
      [.55,.7,.84].forEach(k=>{gx.strokeStyle='rgba(0,0,0,.95)';gx.lineWidth=2.4;gx.beginPath();gx.arc(c,c,R*k,0,7);gx.stroke();});
      gx.strokeStyle='rgba(255,255,255,.14)';gx.lineWidth=1;gx.beginPath();gx.arc(c,c,R,0,7);gx.stroke();}
    function draw(){const c=S/2,R=S*.47;ctx.clearRect(0,0,S,S);
      ctx.save();ctx.shadowColor='rgba(0,0,0,.5)';ctx.shadowBlur=28;ctx.shadowOffsetY=12;ctx.fillStyle='#0F0E0D';ctx.beginPath();ctx.arc(c,c,R,0,7);ctx.fill();ctx.restore();
      ctx.save();ctx.translate(c,c);ctx.rotate(th);ctx.drawImage(grooves,-c,-c,S,S);
      ctx.fillStyle='#D9462B';ctx.beginPath();ctx.arc(0,0,R*.32,0,7);ctx.fill();
      ctx.fillStyle='#FFF4DE';ctx.beginPath();ctx.moveTo(0,0);ctx.arc(0,0,R*.32,-.22,.22);ctx.closePath();ctx.fill();
      ctx.fillStyle='#FFF4DE';ctx.textAlign='center';ctx.textBaseline='middle';
      ctx.font='500 '+Math.max(8,Math.round(R*.042))+'px "DM Mono", ui-monospace, monospace';
      const txt=(SG.ring||'33⅓ RPM · STEREO')+' · ';const step=Math.PI*2/txt.length;
      for(let i=0;i<txt.length;i++){ctx.save();ctx.rotate(i*step);ctx.translate(0,-R*.26);ctx.fillText(txt[i],0,0);ctx.restore();}
      ctx.font=Math.round(R*.11)+'px "Bagel Fat One", "Arial Black", sans-serif';ctx.fillText(SG.label||'',0,-R*.06);
      ctx.font='500 '+Math.max(8,Math.round(R*.04))+'px "DM Mono", ui-monospace, monospace';ctx.fillText(SG.sub||'',0,R*.07);
      ctx.fillStyle='#2A241D';ctx.beginPath();ctx.arc(0,0,R*.028,0,7);ctx.fill();
      ctx.restore();
      if(ctx.createConicGradient){const g=ctx.createConicGradient(-.7,c,c);g.addColorStop(0,'rgba(255,255,255,0)');g.addColorStop(.07,'rgba(255,255,255,.14)');g.addColorStop(.15,'rgba(255,255,255,0)');g.addColorStop(.5,'rgba(255,255,255,0)');g.addColorStop(.57,'rgba(255,255,255,.09)');g.addColorStop(.65,'rgba(255,255,255,0)');g.addColorStop(1,'rgba(255,255,255,0)');ctx.fillStyle=g;ctx.beginPath();ctx.arc(c,c,R,0,7);ctx.arc(c,c,R*.33,0,7,true);ctx.fill();}
    }
    function tick(){const now=performance.now(),dt=Math.min(.05,(now-prev)/1000);prev=now;
      if(!drag){w+=(TARGET-w)*.05;th+=w*dt;}
      draw();
      const rpm=w*60/(2*Math.PI),txt=Math.abs(rpm-100/3)<.6?'33⅓':(rpm<0?'−':'')+Math.abs(rpm).toFixed(0);
      if(txt!==shown){shown=txt;rpmEl.textContent=txt;}
      raf=requestAnimationFrame(tick);}
    const ang=e=>{const r=cv.getBoundingClientRect();return Math.atan2(e.clientY-r.top-r.height/2,e.clientX-r.left-r.width/2);};
    const pd=e=>{drag=true;cv.setPointerCapture(e.pointerId);lastA=ang(e);lastT=performance.now();arm.style.transform='rotate(-3deg)';};
    const pm=e=>{if(!drag)return;const a=ang(e),now=performance.now();let da=a-lastA;if(da>Math.PI)da-=2*Math.PI;if(da<-Math.PI)da+=2*Math.PI;th+=da;const dt=Math.max(.008,(now-lastT)/1000);w=w*.4+(da/dt)*.6;lastA=a;lastT=now;};
    const pu=()=>{drag=false;arm.style.transform='';};
    cv.addEventListener('pointerdown',pd);cv.addEventListener('pointermove',pm);cv.addEventListener('pointerup',pu);cv.addEventListener('pointercancel',pu);
    const ro=new ResizeObserver(()=>{size();draw();});ro.observe(cv);
    size(); tick();
    return ()=>{cancelAnimationFrame(raf);ro.disconnect();cv.removeEventListener('pointerdown',pd);cv.removeEventListener('pointermove',pm);cv.removeEventListener('pointerup',pu);cv.removeEventListener('pointercancel',pu);};
  }
