function(root,SG){SG=SG||{};
    const hero=root.querySelector('.b-hero'), cv=root.querySelector('.b-cv'), ctx=cv.getContext('2d');
    const reduce=matchMedia('(prefers-reduced-motion: reduce)').matches;
    const PAL=[['#E8A0A0','#C97272'],['#EE8A6A','#C9583D'],['#EDB95A','#C98E2E'],['#B6A5DD','#8A78BE'],['#F3CFC9','#DFA59C'],['#D4637A','#A23F56']];
    const KINDS=['daisy','cosmos','rose','tulip','pom'];
    let W=0,H=0,D=1,raf=0,flowers=[];const t0=performance.now();
    const now=()=>reduce?1000:(performance.now()-t0)/1000;
    const rand=(a,b)=>a+Math.random()*(b-a), pick=a=>a[Math.floor(Math.random()*a.length)];
    const ease=x=>1-Math.pow(1-x,3);
    function make(bx,tx,ty,start){return{bx,tx,ty,cx:bx+rand(-60,60),start,dur:rand(1.8,2.8),kind:pick(KINDS),pal:pick(PAL),s:rand(.8,1.25),ph:rand(0,6.28),rot:rand(0,6.28),lf:Math.random()<.5?1:-1};}
    function seed(){flowers=[];const narrow=W<760,n=narrow?9:16,T=now();
      for(let i=0;i<n;i++){const k=i/(n-1);const bx=narrow?rand(0,W):W*(.44+.56*k)+rand(-20,20);const ty=narrow?H*rand(.62,.88):H*rand(.2,.72);flowers.push(make(bx,bx+rand(-50,50),ty,T+.15+i*.11));}
      if(!narrow)for(let i=0;i<4;i++){const bx=W*rand(.02,.36);flowers.push(make(bx,bx+rand(-30,30),H*rand(.82,.92),T+.6+i*.2));}}
    function size(){const r=hero.getBoundingClientRect();D=Math.min(2,window.devicePixelRatio||1);const nw=Math.max(1,Math.round(r.width)),nh=Math.max(1,Math.round(r.height));const big=Math.abs(nw-W)>60||Math.abs(nh-H)>60;W=nw;H=nh;cv.width=W*D;cv.height=H*D;ctx.setTransform(D,0,0,D,0,0);if(big)seed();}
    function q(f,u,sw){const x0=f.bx,y0=H+12,x2=f.tx+sw,y2=f.ty,x1=f.cx+sw*.4,y1=(H+f.ty)/2,a=1-u;return[a*a*x0+2*a*u*x1+u*u*x2,a*a*y0+2*a*u*y1+u*u*y2];}
    function petals(n,len,wid,col,stroke){for(let i=0;i<n;i++){ctx.rotate(Math.PI*2/n);ctx.beginPath();ctx.ellipse(len/2,0,len/2,wid,0,0,7);ctx.fillStyle=col;ctx.fill();if(stroke){ctx.strokeStyle=stroke;ctx.lineWidth=.8;ctx.stroke();}}}
    function head(f,x,y,s,T){ctx.save();ctx.translate(x,y);const wob=Math.sin(T*.6+f.ph)*.05;ctx.rotate(f.kind==='tulip'?wob:f.rot+wob);ctx.scale(s,s);const c=f.pal[0],d=f.pal[1];
      if(f.kind==='daisy'){petals(18,26,4.2,'#FBF6EC','rgba(46,42,36,.2)');ctx.fillStyle='#E8B04A';ctx.beginPath();ctx.arc(0,0,6.5,0,7);ctx.fill();}
      else if(f.kind==='cosmos'){petals(8,30,9,c,'rgba(46,42,36,.12)');ctx.fillStyle='#E8B04A';ctx.beginPath();ctx.arc(0,0,6,0,7);ctx.fill();}
      else if(f.kind==='rose'){for(let i=0;i<7;i++){const r=24-i*3.2;ctx.rotate(.7);ctx.fillStyle=i%2?c:d;ctx.beginPath();ctx.ellipse(i*.6,0,r,r*.86,0,0,7);ctx.fill();}}
      else if(f.kind==='tulip'){ctx.fillStyle=d;ctx.beginPath();ctx.ellipse(-8,-14,10,20,-.35,0,7);ctx.fill();ctx.beginPath();ctx.ellipse(8,-14,10,20,.35,0,7);ctx.fill();ctx.fillStyle=c;ctx.beginPath();ctx.ellipse(0,-12,10,22,0,0,7);ctx.fill();}
      else{for(let i=0;i<46;i++){const a=i*2.39996,r=Math.sqrt(i/46)*20;ctx.fillStyle=i%3?c:d;ctx.beginPath();ctx.arc(Math.cos(a)*r,Math.sin(a)*r,3.2,0,7);ctx.fill();}}
      ctx.restore();}
    function draw(T){ctx.clearRect(0,0,W,H);
      for(const f of flowers){const g=Math.max(0,Math.min(1,(T-f.start)/f.dur));if(g<=0)continue;const e=ease(g),sw=Math.sin(T*.9+f.ph)*7*e;
        ctx.strokeStyle='#6E8460';ctx.lineWidth=2.2*f.s;ctx.lineCap='round';ctx.beginPath();
        for(let i=0;i<=28;i++){const p=q(f,i/28*e,sw);i?ctx.lineTo(p[0],p[1]):ctx.moveTo(p[0],p[1]);}ctx.stroke();
        [[.32,1],[.55,-1]].forEach(([u,side])=>{const lg=Math.min(1,Math.max(0,(e-u)/.2));if(!lg)return;const p=q(f,u,sw),p2=q(f,u+.01,sw);const ang=Math.atan2(p2[1]-p[1],p2[0]-p[0]);ctx.save();ctx.translate(p[0],p[1]);ctx.rotate(ang+side*f.lf);ctx.fillStyle='#93A983';ctx.beginPath();ctx.ellipse(15*f.s*lg,0,15*f.s*lg,5*f.s*lg,0,0,7);ctx.fill();ctx.strokeStyle='rgba(46,42,36,.25)';ctx.lineWidth=.8;ctx.beginPath();ctx.moveTo(0,0);ctx.lineTo(28*f.s*lg,0);ctx.stroke();ctx.restore();});
        const hg=(e-.82)/.18;if(hg>0){const p=q(f,e,sw);head(f,p[0],p[1],f.s*ease(Math.min(1,hg)),T);}
      }}
    function loop(){draw(now());raf=requestAnimationFrame(loop);}
    const click=e=>{if(e.target.closest('a,button'))return;const r=hero.getBoundingClientRect();const x=e.clientX-r.left,y=e.clientY-r.top;flowers.push(make(x+rand(-30,30),x,y,now()));if(flowers.length>70)flowers.splice(0,1);if(reduce)draw(now());};
    hero.addEventListener('click',click);
    const ro=new ResizeObserver(()=>{size();draw(now());});ro.observe(hero);
    size(); if(reduce)draw(now()); else loop();
    return ()=>{cancelAnimationFrame(raf);ro.disconnect();hero.removeEventListener('click',click);};
  }
