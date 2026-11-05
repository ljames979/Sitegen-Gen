function(root,SG){SG=SG||{};
    const hero=root.querySelector('.r-hero'), cv=root.querySelector('.r-cv'), ctx=cv.getContext('2d');
    const reduce=matchMedia('(prefers-reduced-motion: reduce)').matches;
    let W=1,H=1,D=1,raf=0,t=0,px=-1,py=-1;const P=[];
    function size(){const r=hero.getBoundingClientRect();D=Math.min(2,window.devicePixelRatio||1);W=Math.max(1,Math.round(r.width));H=Math.max(1,Math.round(r.height));cv.width=W*D;cv.height=H*D;ctx.setTransform(D,0,0,D,0,0);ctx.fillStyle='#0D0A08';ctx.fillRect(0,0,W,H);}
    function spawn(x,y,boost){P.push({x,y,vx:(Math.random()-.5)*.5,vy:-(0.7+Math.random()*1.5)*boost,life:0,max:140+Math.random()*170,r:1+Math.random()*2.2});if(P.length>950)P.shift();}
    function frame(){
      t+=0.016;
      ctx.globalCompositeOperation='source-over';ctx.fillStyle='rgba(13,10,8,0.17)';ctx.fillRect(0,0,W,H);
      const n=Math.max(2,Math.round(7*W/1280));
      for(let i=0;i<n;i++){const u=Math.random();spawn(W*(.5+(u-.5)*Math.abs(u-.5)*2.4+(Math.random()-.5)*.6),H+6,1);}
      if(px>=0)for(let i=0;i<4;i++)spawn(px+(Math.random()-.5)*30,py+(Math.random()-.5)*20,1.3);
      ctx.globalCompositeOperation='lighter';
      for(let i=P.length-1;i>=0;i--){const p=P[i];
        p.vx+=Math.sin(p.y*0.012+t*1.3+p.x*0.004)*0.035;p.vx*=0.985;p.x+=p.vx;p.y+=p.vy;p.life++;
        const k=p.life/p.max;if(k>=1||p.y<-30){P.splice(i,1);continue;}
        let col,a,r;
        if(k<.35){a=(1-k)*.7;col='255,'+((150-k*200)|0)+',40';r=p.r;}
        else if(k<.7){a=(1-k)*.55;col=((235-(k-.35)*280)|0)+','+((70-(k-.35)*60)|0)+',30';r=p.r*(1+k);}
        else{a=(1-k)*.12;col='150,130,115';r=p.r*(2+k*5);}
        ctx.fillStyle='rgba('+col+','+a.toFixed(3)+')';ctx.beginPath();ctx.arc(p.x,p.y,r,0,7);ctx.fill();
      }
      ctx.globalCompositeOperation='source-over';
      const g=ctx.createLinearGradient(0,H*.78,0,H);g.addColorStop(0,'rgba(255,90,20,0)');g.addColorStop(1,'rgba(255,90,20,.05)');ctx.fillStyle=g;ctx.fillRect(0,H*.78,W,H*.22);
    }
    function loop(){frame();raf=requestAnimationFrame(loop);}
    const move=e=>{const r=hero.getBoundingClientRect();px=e.clientX-r.left;py=e.clientY-r.top;};
    const leave=()=>{px=-1;};
    hero.addEventListener('pointermove',move);hero.addEventListener('pointerleave',leave);
    const ro=new ResizeObserver(()=>{size();if(reduce)for(let i=0;i<260;i++)frame();});ro.observe(hero);
    size(); if(reduce){for(let i=0;i<260;i++)frame();} else loop();
    return ()=>{cancelAnimationFrame(raf);ro.disconnect();hero.removeEventListener('pointermove',move);hero.removeEventListener('pointerleave',leave);};
  }
