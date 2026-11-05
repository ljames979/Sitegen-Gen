function(root,SG){SG=SG||{};
    const hero=root.querySelector('.e-hero'), cv=root.querySelector('.e-cv'), ctx=cv.getContext('2d');
    const clock=root.querySelector('.e-clock'), rv=root.querySelector('.e-reserve'), rvT=root.querySelector('.e-rv'), wind=root.querySelector('.e-wind');
    const reduce=matchMedia('(prefers-reduced-motion: reduce)').matches;
    let W=1,H=1,D=1,U=1,raf=0,th=0,power=.7,drag=false,lx=0,lastS='',lastP='',prev=performance.now(),G=null;const t0=performance.now();
    function size(){const r=hero.getBoundingClientRect();D=Math.min(2,window.devicePixelRatio||1);W=Math.max(1,Math.round(r.width));H=Math.max(1,Math.round(r.height));cv.width=W*D;cv.height=H*D;ctx.setTransform(D,0,0,D,0,0);
      const narrow=W<760;U=narrow?W*.075:Math.min(W*.046,H*.08);const m=U*.2;
      const A={x:narrow?W*.62:W*.76,y:narrow?H*.76:H*.44,n:48,m,s:5},phAB=2.45,phBC=1.15;
      const rA=A.n*m/2,B={n:18,m,s:4},C={n:30,m,s:5},rB=B.n*m/2,rC=C.n*m/2;
      B.x=A.x+Math.cos(phAB)*(rA+rB);B.y=A.y+Math.sin(phAB)*(rA+rB);C.x=B.x+Math.cos(phBC)*(rB+rC);C.y=B.y+Math.sin(phBC)*(rB+rC);
      G={A,B,C,phAB,phBC,bal:{x:narrow?W*.2:W*.9,y:narrow?H*.92:H*.84,r:U*1.4}};}
    function teeth(cx,cy,n,m,ang){const r=n*m/2,ro=r+m,rr=r-1.25*m,p=Math.PI*2/n;ctx.beginPath();for(let i=0;i<n;i++){const a=ang+i*p;[[rr,a-p*.5],[rr,a-p*.3],[ro,a-p*.15],[ro,a+p*.15],[rr,a+p*.3]].forEach(([rad,an],k)=>{const x=cx+Math.cos(an)*rad,y=cy+Math.sin(an)*rad;(i===0&&k===0)?ctx.moveTo(x,y):ctx.lineTo(x,y);});}ctx.closePath();}
    function gear(g,ang){const r=g.n*g.m/2;teeth(g.x,g.y,g.n,g.m,ang);const gr=ctx.createRadialGradient(g.x-r*.35,g.y-r*.35,r*.1,g.x,g.y,r*1.15);gr.addColorStop(0,'#EDD08C');gr.addColorStop(.55,'#C9A35A');gr.addColorStop(1,'#7E6029');ctx.fillStyle=gr;ctx.fill();ctx.strokeStyle='rgba(50,34,8,.7)';ctx.lineWidth=1;ctx.stroke();
      const ri=r*.8,rh=r*.26;ctx.fillStyle='#141412';for(let k=0;k<g.s;k++){const a0=ang+k*2*Math.PI/g.s+.16,a1=ang+(k+1)*2*Math.PI/g.s-.16;ctx.beginPath();ctx.arc(g.x,g.y,ri,a0,a1);ctx.arc(g.x,g.y,rh,a1-.05,a0+.05,true);ctx.closePath();ctx.fill();}
      ctx.strokeStyle='rgba(255,236,190,.22)';ctx.beginPath();ctx.arc(g.x,g.y,ri,0,7);ctx.stroke();
      ctx.fillStyle='#8E6E32';ctx.beginPath();ctx.arc(g.x,g.y,rh*.8,0,7);ctx.fill();jewel(g.x,g.y,Math.max(4,r*.08));}
    function jewel(x,y,r){ctx.fillStyle='#C9A35A';ctx.beginPath();ctx.arc(x,y,r*1.7,0,7);ctx.fill();const jg=ctx.createRadialGradient(x-r*.3,y-r*.3,0,x,y,r);jg.addColorStop(0,'#FF6E8E');jg.addColorStop(.6,'#B0103A');jg.addColorStop(1,'#5A0620');ctx.fillStyle=jg;ctx.beginPath();ctx.arc(x,y,r,0,7);ctx.fill();}
    function frame(){
      const now=performance.now(),dt=Math.min(.05,(now-prev)/1000);prev=now;
      if(!reduce){power=Math.max(0,power-dt*.006);th+=dt*(.08+power*.3);}
      ctx.fillStyle='#111110';ctx.fillRect(0,0,W,H);
      const {A,B,C,phAB,phBC,bal}=G,rA=A.n*A.m/2;
      ctx.save();ctx.beginPath();ctx.arc(A.x,A.y,rA*1.9,0,7);ctx.fillStyle='#181816';ctx.fill();ctx.clip();
      ctx.strokeStyle='rgba(241,234,219,.035)';ctx.lineWidth=10;for(let s=-rA*2;s<rA*2;s+=22){ctx.beginPath();ctx.moveTo(A.x+s-rA*2,A.y-rA*2);ctx.lineTo(A.x+s+rA*2,A.y+rA*2);ctx.stroke();}ctx.restore();
      ctx.strokeStyle='rgba(201,163,90,.25)';ctx.lineWidth=1;ctx.beginPath();ctx.arc(A.x,A.y,rA*1.9,0,7);ctx.stroke();
      [[.5,1.75],[2.2,1.8],[4.1,1.7]].forEach(([a,k])=>{const x=A.x+Math.cos(a)*rA*k,y=A.y+Math.sin(a)*rA*k;ctx.fillStyle='#8E8A80';ctx.beginPath();ctx.arc(x,y,U*.16,0,7);ctx.fill();ctx.strokeStyle='#333';ctx.lineWidth=2;ctx.beginPath();ctx.moveTo(x-U*.1,y);ctx.lineTo(x+U*.1,y);ctx.stroke();});
      const thA=th, thB=phAB+Math.PI-Math.PI/B.n-(A.n/B.n)*(thA-phAB), thC=phBC+Math.PI-Math.PI/C.n-(B.n/C.n)*(thB-phBC);
      gear(C,thC);gear(B,thB);gear(A,thA);
      const tt=(now-t0)/1000,amp=reduce?0:(.5+power*.9),ab=amp*Math.sin(tt*2*Math.PI*1.6);
      ctx.save();ctx.translate(bal.x,bal.y);
      ctx.strokeStyle='rgba(205,214,224,.75)';ctx.lineWidth=1;ctx.beginPath();for(let a=0;a<Math.PI*14;a+=.08){const k=a/(Math.PI*14),rad=bal.r*(.08+.72*k),an=a+ab*(1-k);const x=Math.cos(an)*rad,y=Math.sin(an)*rad;a?ctx.lineTo(x,y):ctx.moveTo(x,y);}ctx.stroke();
      ctx.rotate(ab);ctx.strokeStyle='#C9A35A';ctx.lineWidth=U*.16;ctx.beginPath();ctx.arc(0,0,bal.r,0,7);ctx.stroke();
      ctx.lineWidth=U*.09;ctx.beginPath();ctx.moveTo(-bal.r,0);ctx.lineTo(bal.r,0);ctx.stroke();
      ctx.fillStyle='#EDD08C';for(let i=0;i<12;i++){const a=i*Math.PI/6;ctx.beginPath();ctx.arc(Math.cos(a)*bal.r,Math.sin(a)*bal.r,U*.07,0,7);ctx.fill();}
      ctx.restore();jewel(bal.x,bal.y,Math.max(4,U*.12));
      const d=new Date(),s=String(d.getHours()).padStart(2,'0')+':'+String(d.getMinutes()).padStart(2,'0')+':'+String(d.getSeconds()).padStart(2,'0');if(s!==lastS){lastS=s;clock.textContent=s;}
      const p=Math.round(power*48)+' h';if(p!==lastP){lastP=p;rvT.textContent=p;rv.style.setProperty('--v',power.toFixed(3));}
    }
    function loop(){frame();raf=requestAnimationFrame(loop);}
    const down=e=>{if(e.target.closest('a,button,.e-panel'))return;drag=true;lx=e.clientX;};
    const move=e=>{if(!drag)return;const dx=Math.abs(e.clientX-lx);lx=e.clientX;power=Math.min(1,power+dx*.0015);th+=dx*.004;if(reduce)frame();};
    const up=()=>{drag=false;};
    const windUp=()=>{power=Math.min(1,power+.15);if(reduce)frame();};
    hero.addEventListener('pointerdown',down);window.addEventListener('pointermove',move);window.addEventListener('pointerup',up);wind.addEventListener('click',windUp);
    const ro=new ResizeObserver(()=>{size();frame();});ro.observe(hero);
    size(); frame(); if(!reduce) loop(); const iv=reduce?setInterval(frame,1000):0;
    return ()=>{cancelAnimationFrame(raf);clearInterval(iv);ro.disconnect();hero.removeEventListener('pointerdown',down);window.removeEventListener('pointermove',move);window.removeEventListener('pointerup',up);wind.removeEventListener('click',windUp);};
  }
