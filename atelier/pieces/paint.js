function(root,SG){SG=SG||{};
    const hero=root.querySelector('.h-hero'), cv=root.querySelector('.h-cv'), ctx=cv.getContext('2d');
    const reduce=matchMedia('(prefers-reduced-motion: reduce)').matches;
    const chips=[...root.querySelectorAll('.h-chip')], em=root.querySelector('.h-h1 em'), logo=root.querySelector('.h-logo i');
    let W=1,H=1,D=1,raf=0,t=0,next=0,count=0,col='#2F6F5E',strokes=[],drag=null;
    const rgb=h=>{const n=parseInt(h.slice(1),16);return[n>>16,(n>>8)&255,n&255];};
    const cl=v=>Math.max(0,Math.min(255,v|0));
    const brush=()=>({rgb:rgb(col),br:Array.from({length:22},(_,i)=>({o:i/21-.5,a:.12+Math.random()*.35,j:Math.random()*2-1,dl:(Math.random()-.5)*34}))});
    function size(){const r=hero.getBoundingClientRect();D=Math.min(2,window.devicePixelRatio||1);W=Math.max(1,Math.round(r.width));H=Math.max(1,Math.round(r.height));cv.width=W*D;cv.height=H*D;ctx.setTransform(D,0,0,D,0,0);ctx.fillStyle='#F3EFE8';ctx.fillRect(0,0,W,H);strokes.forEach(s=>{s.p=0;});count=0;}
    function seg(s,p0,p1,w,taper){let nx=-(p1[1]-p0[1]),ny=p1[0]-p0[0];const l=Math.hypot(nx,ny)||1;nx/=l;ny/=l;const ww=w*taper;
      ctx.lineCap='butt';ctx.strokeStyle='rgba('+s.rgb.join(',')+','+(.72*taper).toFixed(3)+')';ctx.lineWidth=ww*.82;ctx.beginPath();ctx.moveTo(p0[0],p0[1]);ctx.lineTo(p1[0],p1[1]);ctx.stroke();
      ctx.lineCap='round';s.br.forEach(b=>{const o=b.o*ww;ctx.strokeStyle='rgba('+cl(s.rgb[0]+b.dl)+','+cl(s.rgb[1]+b.dl)+','+cl(s.rgb[2]+b.dl)+','+(b.a*(.6+.4*taper)).toFixed(3)+')';ctx.lineWidth=Math.max(1,ww/14);ctx.beginPath();ctx.moveTo(p0[0]+nx*o+b.j,p0[1]+ny*o+b.j);ctx.lineTo(p1[0]+nx*o+b.j,p1[1]+ny*o+b.j);ctx.stroke();});}
    const pt=(s,u)=>{const a=1-u;return[a*a*s.x0+2*a*u*s.cx+u*u*s.x1,a*a*s.y0+2*a*u*s.cy+u*u*s.y1];};
    function spawn(){const narrow=W<860;const x0=narrow?W*(.05+Math.random()*.3):W*(.42+Math.random()*.25),y0=narrow?H*(.6+Math.random()*.15):H*(.18+Math.random()*.55),L=(narrow?.6:.35+Math.random()*.2)*W,a=(Math.random()-.5)*.3,x1=Math.min(W+40,x0+Math.cos(a)*L),y1=y0+Math.sin(a)*L;
      strokes.push(Object.assign(brush(),{x0,y0,x1,y1,cx:(x0+x1)/2+(Math.random()-.5)*60,cy:(y0+y1)/2+(Math.random()-.5)*60,w:narrow?40+Math.random()*40:55+Math.random()*60,p:0,sp:.012+Math.random()*.01}));count++;}
    function frame(){t+=.016;
      if(t>next){next=t+1.1+Math.random()*.8;spawn();}
      if(count>40){ctx.fillStyle='rgba(243,239,232,0.012)';ctx.fillRect(0,0,W,H);}
      strokes=strokes.filter(s=>s.p<1);
      strokes.forEach(s=>{const u0=s.p,u1=Math.min(1,u0+s.sp);seg(s,pt(s,u0),pt(s,u1),s.w,Math.min(1,u1*6,(1-u0)*5+.25));s.p=u1;});}
    function loop(){frame();raf=requestAnimationFrame(loop);}
    const pos=e=>{const r=hero.getBoundingClientRect();return[e.clientX-r.left,e.clientY-r.top];};
    const down=e=>{if(e.target.closest('a,button,label,input,select'))return;drag=Object.assign(brush(),{last:pos(e)});};
    const move=e=>{if(!drag)return;const p=pos(e);seg(drag,drag.last,p,W<860?44:70,1);drag.last=p;};
    const up=()=>{drag=null;};
    const pick=e=>{const b=e.target.closest('.h-chip');if(!b)return;col=b.dataset.c;chips.forEach(c=>c.setAttribute('aria-pressed',String(c===b)));em.style.color=col;logo.style.background=col;root.querySelectorAll('.h-step b').forEach(x=>x.style.background=col);if(reduce){spawn();const s=strokes[strokes.length-1];while(s.p<1){const u0=s.p,u1=Math.min(1,u0+.02);seg(s,pt(s,u0),pt(s,u1),s.w,Math.min(1,u1*6,(1-u0)*5+.25));s.p=u1;}}else next=0;};
    hero.addEventListener('pointerdown',down);hero.addEventListener('pointermove',move);window.addEventListener('pointerup',up);hero.addEventListener('click',pick);
    const ro=new ResizeObserver(()=>{size();if(reduce)for(let i=0;i<5;i++){spawn();const s=strokes[strokes.length-1];while(s.p<1){const u0=s.p,u1=Math.min(1,u0+.02);seg(s,pt(s,u0),pt(s,u1),s.w,Math.min(1,u1*6,(1-u0)*5+.25));s.p=u1;}}});ro.observe(hero);
    size(); if(!reduce){for(let i=0;i<3;i++)spawn();loop();}
    return ()=>{cancelAnimationFrame(raf);ro.disconnect();hero.removeEventListener('pointerdown',down);hero.removeEventListener('pointermove',move);window.removeEventListener('pointerup',up);hero.removeEventListener('click',pick);};
  }
