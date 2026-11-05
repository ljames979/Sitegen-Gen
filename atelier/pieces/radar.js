function(root,SG){SG=SG||{};
    const hero=root.querySelector('.w-hero'), cv=root.querySelector('.w-cv'), ctx=cv.getContext('2d'), read=root.querySelector('.w-read');
    const reduce=matchMedia('(prefers-reduced-motion: reduce)').matches;
    const now=new Date(),y=now.getFullYear(),s0=new Date(y,5,1),s1=new Date(y,10,30,23,59);let n,l;
    if(now<s0){n=Math.ceil((s0-now)/864e5);l='days until hurricane season';}else if(now<=s1){n=Math.ceil((s1-now)/864e5);l='days left in hurricane season';}else{n=Math.ceil((new Date(y+1,5,1)-now)/864e5);l='days until next season';}
    root.querySelector('.w-days').textContent=n;root.querySelector('.w-days-l').textContent=l;
    let W=1,H=1,D=1,raf=0,t=0,sweep=1.2,px=-1,py=-1,cx=0,cy=0,R=1;
    const cells=[];for(let i=0;i<10;i++)cells.push({x:-.95+Math.random()*1.5,y:-.7+Math.random()*1.4,r:.04+Math.random()*.08,k:Math.random(),b:Array.from({length:7},()=>[(Math.random()-.5)*1.5,(Math.random()-.5)*1.5,.4+Math.random()*.7])});
    const SPOTS=[[0,0],[.02,-.18],[-.72,.12],[-.42,.14],[.62,.22],[.4,-.6]];const cities=(SG.places||[]).slice(0,6).map((n,i)=>[String(n).toUpperCase(),SPOTS[i][0],SPOTS[i][1]]);
    const DIRS=['N','NNE','NE','ENE','E','ESE','SE','SSE','S','SSW','SW','WSW','W','WNW','NW','NNW'];
    function size(){const r=hero.getBoundingClientRect();D=Math.min(2,window.devicePixelRatio||1);W=Math.max(1,Math.round(r.width));H=Math.max(1,Math.round(r.height));cv.width=W*D;cv.height=H*D;ctx.setTransform(D,0,0,D,0,0);
      if(W<760){cx=W*.5;cy=H*.8;R=Math.min(W*.44,H*.2);}else{cx=W*.7;cy=H*.55;R=Math.min(H*.4,W*.27);}}
    const P=(x,y)=>[cx+x*R,cy+y*R];
    function glow(x,y){const a=Math.atan2(y,x);const d=((sweep-a)%(Math.PI*2)+Math.PI*2)%(Math.PI*2);return .14+.86*Math.exp(-d*1.3);}
    function frame(){
      t+=.016;if(!reduce)sweep=(sweep+.017)%(Math.PI*2);
      ctx.fillStyle='#050B08';ctx.fillRect(0,0,W,H);
      const bg=ctx.createRadialGradient(cx,cy,0,cx,cy,R*1.6);bg.addColorStop(0,'rgba(20,70,45,.45)');bg.addColorStop(1,'rgba(5,11,8,0)');ctx.fillStyle=bg;ctx.fillRect(0,0,W,H);
      ctx.save();ctx.beginPath();ctx.arc(cx,cy,R,0,7);ctx.clip();
      ctx.fillStyle='rgba(8,26,17,.85)';ctx.fillRect(cx-R,cy-R,R*2,R*2);
      ctx.setLineDash([3,5]);ctx.lineWidth=1.2;ctx.strokeStyle='rgba(92,255,157,.35)';
      let a=P(.5,-1.1),b=P(.55,.3),c=P(.95,1.1);ctx.beginPath();ctx.moveTo(a[0],a[1]);ctx.quadraticCurveTo(b[0],b[1],c[0],c[1]);ctx.stroke();
      a=P(-1.1,-.55);b=P(-.72,.25);c=P(-.5,1.1);ctx.beginPath();ctx.moveTo(a[0],a[1]);ctx.quadraticCurveTo(b[0],b[1],c[0],c[1]);ctx.stroke();ctx.setLineDash([]);
      ctx.fillStyle='rgba(92,255,157,.35)';ctx.font='600 10px Oxanium, sans-serif';ctx.textAlign='center';let q=P(.86,-.15);ctx.fillText('ATLANTIC',q[0],q[1]);q=P(-.94,.55);ctx.fillText('GULF',q[0],q[1]);
      cells.forEach(cl=>{if(!reduce){cl.x+=.00028;cl.y-=.00012;if(cl.x>1.15){cl.x=-1.15;cl.y=-.7+Math.random()*1.4;}}
        const gl=glow(cl.x,cl.y);
        cl.b.forEach(bb=>{const p=P(cl.x+bb[0]*cl.r,cl.y+bb[1]*cl.r),rr=cl.r*R*bb[2];
          ctx.fillStyle='rgba(92,255,157,'+(.32*gl).toFixed(3)+')';ctx.beginPath();ctx.arc(p[0],p[1],rr,0,7);ctx.fill();
          if(cl.k>.35){ctx.fillStyle='rgba(255,194,61,'+(.5*gl).toFixed(3)+')';ctx.beginPath();ctx.arc(p[0],p[1],rr*.55,0,7);ctx.fill();}
          if(cl.k>.72){ctx.fillStyle='rgba(255,90,77,'+(.7*gl).toFixed(3)+')';ctx.beginPath();ctx.arc(p[0],p[1],rr*.25,0,7);ctx.fill();}});});
      const hx=.86,hy=.6,hg=glow(hx,hy),hc=P(hx,hy);
      for(let arm=0;arm<3;arm++)for(let s=0;s<70;s++){const an=s*.11+arm*2.094-t*.7,rad=(.02+s*.0042)*R;ctx.fillStyle='rgba(255,194,61,'+((1-s/70)*.75*hg).toFixed(3)+')';ctx.beginPath();ctx.arc(hc[0]+Math.cos(an)*rad,hc[1]+Math.sin(an)*rad,2.2+s*.06,0,7);ctx.fill();}
      ctx.fillStyle='#050B08';ctx.beginPath();ctx.arc(hc[0],hc[1],R*.022,0,7);ctx.fill();
      for(let i=0;i<46;i++){const a0=sweep-i*.018;ctx.fillStyle='rgba(92,255,157,'+(.24*(1-i/46)).toFixed(3)+')';ctx.beginPath();ctx.moveTo(cx,cy);ctx.arc(cx,cy,R,a0-.019,a0);ctx.closePath();ctx.fill();}
      ctx.strokeStyle='rgba(160,255,200,.95)';ctx.lineWidth=1.6;ctx.beginPath();ctx.moveTo(cx,cy);ctx.lineTo(cx+Math.cos(sweep)*R,cy+Math.sin(sweep)*R);ctx.stroke();
      ctx.strokeStyle='rgba(92,255,157,.22)';ctx.lineWidth=1;
      for(let i=1;i<=4;i++){ctx.beginPath();ctx.arc(cx,cy,R*i/4,0,7);ctx.stroke();}
      ctx.beginPath();ctx.moveTo(cx-R,cy);ctx.lineTo(cx+R,cy);ctx.moveTo(cx,cy-R);ctx.lineTo(cx,cy+R);ctx.stroke();
      ctx.fillStyle='rgba(92,255,157,.5)';ctx.font='500 10px Oxanium, sans-serif';ctx.textAlign='left';
      for(let i=1;i<=4;i++)ctx.fillText((i*25)+' MI',cx+4,cy-R*i/4+12);
      ctx.textAlign='center';
      cities.forEach(([nm,x,y],i)=>{const p=P(x,y);ctx.fillStyle=i?'rgba(230,245,236,.85)':'#FFC23D';ctx.beginPath();ctx.arc(p[0],p[1],i?2.6:4,0,7);ctx.fill();if(!i){ctx.strokeStyle='rgba(255,194,61,.6)';ctx.beginPath();ctx.arc(p[0],p[1],9,0,7);ctx.stroke();}ctx.fillStyle=i?'rgba(230,245,236,.7)':'#FFC23D';ctx.font='600 10px Oxanium, sans-serif';ctx.fillText(nm,p[0],p[1]-10);});
      q=P(.6,.4);ctx.fillStyle='rgba(255,194,61,'+(.4+.6*hg).toFixed(2)+')';
      ctx.restore();
      ctx.strokeStyle='rgba(92,255,157,.55)';ctx.lineWidth=1.5;ctx.beginPath();ctx.arc(cx,cy,R,0,7);ctx.stroke();
      for(let i=0;i<72;i++){const an=i*Math.PI/36,l=i%9===0?10:4;ctx.strokeStyle='rgba(92,255,157,.4)';ctx.beginPath();ctx.moveTo(cx+Math.cos(an)*R,cy+Math.sin(an)*R);ctx.lineTo(cx+Math.cos(an)*(R+l),cy+Math.sin(an)*(R+l));ctx.stroke();}
      ctx.fillStyle='rgba(92,255,157,.75)';ctx.font='700 12px Oxanium, sans-serif';[['N',0,-1],['E',1,0],['S',0,1],['W',-1,0]].forEach(([s,x,y])=>ctx.fillText(s,cx+x*(R+24),cy+y*(R+24)+4));
      if(px>=0){const dx=px-cx,dy=py-cy,dd=Math.hypot(dx,dy);if(dd<=R){ctx.strokeStyle='rgba(92,255,157,.5)';ctx.setLineDash([2,4]);ctx.beginPath();ctx.moveTo(cx,cy);ctx.lineTo(px,py);ctx.stroke();ctx.setLineDash([]);ctx.beginPath();ctx.arc(px,py,8,0,7);ctx.stroke();
        const brg=Math.round((Math.atan2(dx,-dy)*180/Math.PI+360)%360),mi=Math.round(dd/R*100);read.hidden=false;read.style.left=px+'px';read.style.top=py+'px';read.textContent=DIRS[Math.round(brg/22.5)%16]+' '+String(brg).padStart(3,'0')+'°'+(cities.length?' FROM '+cities[0][0]:'');}else read.hidden=true;}
    }
    function loop(){frame();raf=requestAnimationFrame(loop);}
    const move=e=>{const r=hero.getBoundingClientRect();px=e.clientX-r.left;py=e.clientY-r.top;if(reduce)frame();};
    const leave=()=>{px=-1;read.hidden=true;if(reduce)frame();};
    hero.addEventListener('pointermove',move);hero.addEventListener('pointerleave',leave);
    const ro=new ResizeObserver(()=>{size();frame();});ro.observe(hero);
    size(); if(reduce)frame(); else loop();
    return ()=>{cancelAnimationFrame(raf);ro.disconnect();hero.removeEventListener('pointermove',move);hero.removeEventListener('pointerleave',leave);};
  }
