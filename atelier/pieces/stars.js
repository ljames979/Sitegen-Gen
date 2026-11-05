function(root,SG){SG=SG||{};
    const hero=root.querySelector('.y-hero'), cv=root.querySelector('.y-cv'), ctx=cv.getContext('2d');
    const reduce=matchMedia('(prefers-reduced-motion: reduce)').matches;
    const syn=29.530588853, ref=Date.UTC(2000,0,6,18,14), age=(((Date.now()-ref)/864e5)%syn+syn)%syn, ph=age/syn, k=Math.cos(2*Math.PI*ph), illum=Math.round((1-k)/2*100);
    const NAMES=[[1.84,'New moon'],[5.53,'Waxing crescent'],[9.22,'First quarter'],[12.91,'Waxing gibbous'],[16.61,'Full moon'],[20.3,'Waning gibbous'],[23.99,'Last quarter'],[27.68,'Waning crescent'],[99,'New moon']];
    const rx=(Math.abs(k)*20).toFixed(2);
    const yLit=root.querySelector('.y-lit');if(yLit)yLit.setAttribute('d',ph<.5?'M24 4 A20 20 0 0 1 24 44 A'+rx+' 20 0 0 '+(k>0?0:1)+' 24 4Z':'M24 4 A20 20 0 0 0 24 44 A'+rx+' 20 0 0 '+(k>0?1:0)+' 24 4Z');
    const next=new Date(Date.now()+(syn-age)*864e5).toLocaleDateString('en-US',{month:'long',day:'numeric'});
    if(root.querySelector('.y-phase'))root.querySelector('.y-phase').textContent=NAMES.find(n=>age<n[0])[1]+' · '+illum+'% lit';
    if(root.querySelector('.y-moon-note'))root.querySelector('.y-moon-note').textContent=(illum<25?'Dark skies tonight. Faint stars and the Milky Way come out after dusk. ':illum>75?'A bright moon tonight, great for a night hike. Faint stars wash out. ':'A partial moon. Stargaze after it sets for the darkest sky. ')+'Next new moon: '+next+'.';
    const CONS=[
      {n:'Big Dipper',s:'Best in spring',p:[[0,.2],[.17,.25],[.3,.32],[.45,.38],[.47,.62],[.76,.7],[.76,.4]],e:[[0,1],[1,2],[2,3],[3,4],[4,5],[5,6],[6,3]]},
      {n:'Orion',s:'Best in winter',p:[[.42,0],[.2,.17],[.66,.2],[.36,.5],[.45,.48],[.54,.46],[.3,.86],[.72,.8]],e:[[0,1],[0,2],[1,3],[2,5],[3,4],[4,5],[3,6],[5,7]]},
      {n:'Cassiopeia',s:'Best in fall',p:[[0,.25],[.25,.62],[.47,.32],[.72,.66],[1,.28]],e:[[0,1],[1,2],[2,3],[3,4]]},
      {n:'Scorpius',s:'Best in summer',p:[[.04,.14],[.12,0],[.2,.12],[.3,.3],[.36,.46],[.42,.62],[.5,.78],[.62,.9],[.76,.93],[.86,.85],[.88,.72]],e:[[0,3],[1,3],[2,3],[3,4],[4,5],[5,6],[6,7],[7,8],[8,9],[9,10]]}];
    const bg=document.createElement('canvas'), bx=bg.getContext('2d');
    let W=1,H=1,D=1,raf=0,t=0,px=-999,py=-999,tw=[],boxes=[],shoot=null,nextShoot=3;
    let seed=11;const rnd=()=>{seed=(seed*16807)%2147483647;return seed/2147483647;};
    function size(){const r=hero.getBoundingClientRect();D=Math.min(2,window.devicePixelRatio||1);W=Math.max(1,Math.round(r.width));H=Math.max(1,Math.round(r.height));cv.width=W*D;cv.height=H*D;ctx.setTransform(D,0,0,D,0,0);
      const narrow=W<760;
      if(narrow){const S=W*.5;boxes=[[W*.06,H*.03,S*.9,S*.45],[W*.3,H*.14,S*.45,S*.6],[W*.58,H*.05,S*.7,S*.35],[W*.55,H*.8,S*.6,S*.35]];}
      else{const S=Math.min(W*.4,H*.42);boxes=[[W*.6,H*.07,S*1.05,S*.55],[W*.8,H*.3,S*.5,S*.8],[W*.52,H*.38,S*.55,S*.3],[W*.58,H*.6,S*.7,S*.45]];}
      seed=11;bg.width=W*D;bg.height=H*D;bx.setTransform(D,0,0,D,0,0);
      const g=bx.createLinearGradient(0,0,0,H);g.addColorStop(0,'#05071A');g.addColorStop(.6,'#0F1540');g.addColorStop(.9,'#1C1F4A');g.addColorStop(1,'#2A2148');bx.fillStyle=g;bx.fillRect(0,0,W,H);
      for(let i=0;i<2200;i++){const u=rnd(),x=u*W,y=H*.95-u*H*.9+(rnd()-.5)*H*.22*(1-Math.abs(u-.5));bx.fillStyle='rgba(242,235,221,'+(rnd()*.18).toFixed(3)+')';bx.fillRect(x,y,1,1);}
      for(let i=0;i<6;i++){const u=.15+i*.14,x=u*W,y=H*.95-u*H*.9;const mg=bx.createRadialGradient(x,y,0,x,y,W*.12);mg.addColorStop(0,'rgba(170,160,220,.07)');mg.addColorStop(1,'rgba(170,160,220,0)');bx.fillStyle=mg;bx.fillRect(x-W*.12,y-W*.12,W*.24,W*.24);}
      for(let i=0;i<500;i++){bx.fillStyle='rgba(242,235,221,'+(.15+rnd()*.5).toFixed(2)+')';bx.fillRect(rnd()*W,rnd()*H*.85,rnd()<.08?1.6:1,rnd()<.08?1.6:1);}
      const fire=bx.createRadialGradient(W*.88,H,0,W*.88,H,H*.4);fire.addColorStop(0,'rgba(244,184,96,.35)');fire.addColorStop(1,'rgba(244,184,96,0)');bx.fillStyle=fire;bx.fillRect(0,H*.5,W,H*.5);
      bx.fillStyle='#04060F';bx.beginPath();bx.moveTo(0,H);let x=0;while(x<W+20){const h=H*(.06+rnd()*.07),w=10+rnd()*18;bx.lineTo(x,H-H*.04);bx.lineTo(x+w/2,H-h-H*.04);bx.lineTo(x+w,H-H*.04);x+=w*(.6+rnd()*.6);}bx.lineTo(W,H);bx.closePath();bx.fill();
      bx.fillRect(0,H-H*.045,W,H*.045);
      [[.78,26],[.84,34],[.9,24]].forEach(([u,s])=>{const tx=W*u,ty=H-H*.04;bx.fillStyle='#120E14';bx.beginPath();bx.moveTo(tx-s,ty);bx.lineTo(tx,ty-s*1.1);bx.lineTo(tx+s,ty);bx.closePath();bx.fill();bx.fillStyle='rgba(244,184,96,.75)';bx.beginPath();bx.moveTo(tx-s*.22,ty);bx.lineTo(tx,ty-s*.5);bx.lineTo(tx+s*.22,ty);bx.closePath();bx.fill();});
      tw=[];for(let i=0;i<140;i++)tw.push([Math.random()*W,Math.random()*H*.8,Math.random()*6.28,.5+Math.random()*1.5]);}
    function frame(){
      t+=.016;ctx.setTransform(1,0,0,1,0,0);ctx.drawImage(bg,0,0);ctx.setTransform(D,0,0,D,0,0);
      tw.forEach(s=>{const a=reduce?.6:.35+.65*Math.abs(Math.sin(t*s[3]+s[2]));ctx.fillStyle='rgba(242,235,221,'+a.toFixed(2)+')';ctx.fillRect(s[0],s[1],1.5,1.5);});
      CONS.forEach((c,ci)=>{const [ox,oy,w,h]=boxes[ci];const pts=c.p.map(([x,y])=>[ox+x*w,oy+y*h]);
        const hot=px>-900&&pts.some(([x,y])=>Math.hypot(x-px,y-py)<90);
        ctx.strokeStyle=hot?'rgba(244,184,96,.95)':'rgba(242,235,221,.22)';ctx.lineWidth=hot?1.6:1;ctx.beginPath();c.e.forEach(([a,b])=>{ctx.moveTo(pts[a][0],pts[a][1]);ctx.lineTo(pts[b][0],pts[b][1]);});ctx.stroke();
        pts.forEach(([x,y])=>{const r=hot?3.4:2.2;const g=ctx.createRadialGradient(x,y,0,x,y,r*4);g.addColorStop(0,hot?'rgba(255,230,180,.9)':'rgba(242,235,221,.6)');g.addColorStop(1,'rgba(242,235,221,0)');ctx.fillStyle=g;ctx.beginPath();ctx.arc(x,y,r*4,0,7);ctx.fill();ctx.fillStyle='#FFFFFF';ctx.beginPath();ctx.arc(x,y,r*.6,0,7);ctx.fill();});
        if(hot){const top=pts.reduce((a,b)=>b[1]<a[1]?b:a);ctx.fillStyle='#F4B860';ctx.font='20px "Young Serif", Georgia, serif';ctx.textAlign='center';ctx.fillText(c.n,top[0],top[1]-18);ctx.fillStyle='rgba(242,235,221,.7)';ctx.font='600 11px Karla, sans-serif';ctx.fillText(c.s.toUpperCase(),top[0],top[1]-4);}});
      if(!reduce){if(!shoot&&t>nextShoot){shoot={x:W*(.3+Math.random()*.6),y:H*(.05+Math.random()*.25),t:0};nextShoot=t+5+Math.random()*5;}
        if(shoot){shoot.t+=.02;const e=shoot.t,x=shoot.x-e*260,y=shoot.y+e*130;const g=ctx.createLinearGradient(x,y,x+90,y-45);g.addColorStop(0,'rgba(255,255,255,'+(1-e)+')');g.addColorStop(1,'rgba(255,255,255,0)');ctx.strokeStyle=g;ctx.lineWidth=1.6;ctx.beginPath();ctx.moveTo(x,y);ctx.lineTo(x+90,y-45);ctx.stroke();if(e>=1)shoot=null;}}
    }
    function loop(){frame();raf=requestAnimationFrame(loop);}
    const move=e=>{const r=hero.getBoundingClientRect();px=e.clientX-r.left;py=e.clientY-r.top;if(reduce)frame();};
    const leave=()=>{px=-999;py=-999;if(reduce)frame();};
    hero.addEventListener('pointermove',move);hero.addEventListener('pointerdown',move);hero.addEventListener('pointerleave',leave);
    const ro=new ResizeObserver(()=>{size();frame();});ro.observe(hero);
    size(); if(reduce)frame(); else loop();
    return ()=>{cancelAnimationFrame(raf);ro.disconnect();hero.removeEventListener('pointermove',move);hero.removeEventListener('pointerdown',move);hero.removeEventListener('pointerleave',leave);};
  }
