function(root,SG){SG=SG||{};
    const hero=root.querySelector('.n-hero'), cv=root.querySelector('.n-cv'), ctx=cv.getContext('2d');
    const reduce=matchMedia('(prefers-reduced-motion: reduce)').matches;
    const mk=(r,g,b)=>{const c=document.createElement('canvas');c.width=c.height=64;const x=c.getContext('2d');const gr=x.createRadialGradient(32,32,0,32,32,32);gr.addColorStop(0,'rgba('+r+','+g+','+b+',1)');gr.addColorStop(.5,'rgba('+r+','+g+','+b+',.45)');gr.addColorStop(1,'rgba('+r+','+g+','+b+',0)');x.fillStyle=gr;x.fillRect(0,0,64,64);return c;};
    const INK=mk(18,16,20), RED=mk(179,38,30);
    let W=1,H=1,D=1,raf=0,t=0,next=.4,down=false,clicks=0;const P=[];
    function size(){const r=hero.getBoundingClientRect();D=Math.min(2,window.devicePixelRatio||1);W=Math.max(1,Math.round(r.width));H=Math.max(1,Math.round(r.height));cv.width=W*D;cv.height=H*D;ctx.setTransform(D,0,0,D,0,0);ctx.clearRect(0,0,W,H);}
    function drop(x,y,n,red,spd){for(let i=0;i<n;i++){const a=Math.random()*6.283,s=Math.random()*spd;P.push({x,y,vx:Math.cos(a)*s,vy:Math.sin(a)*s*.6+Math.random()*.6,r:4+Math.random()*10,life:0,max:220+Math.random()*260,red:red&&Math.random()<.85,ph:Math.random()*6.28});}if(P.length>1600)P.splice(0,P.length-1600);}
    function frame(){
      t+=.016;
      if(t>next){next=t+2.2+Math.random()*1.6;const narrow=W<760;drop(W*(narrow?.15+Math.random()*.7:.38+Math.random()*.58),H*(narrow?.62+Math.random()*.3:.5+Math.random()*.42),60,Math.random()<.28,2.2);}
      ctx.globalAlpha=1;ctx.globalCompositeOperation='destination-out';ctx.fillStyle='rgba(0,0,0,0.022)';ctx.fillRect(0,0,W,H);ctx.globalCompositeOperation='source-over';
      for(let i=P.length-1;i>=0;i--){const p=P[i];
        p.vx+=Math.sin(p.y*.008+t*.6+p.ph)*.012;p.vy+=.006+Math.cos(p.x*.006-t*.4)*.006;p.vx*=.985;p.vy*=.985;p.x+=p.vx;p.y+=p.vy;p.life++;
        const k=p.life/p.max;if(k>=1){P.splice(i,1);continue;}
        const s=p.r*(1+k*7);ctx.globalAlpha=(1-k)*.05;ctx.drawImage(p.red?RED:INK,p.x-s,p.y-s,s*2,s*2);}
      ctx.globalAlpha=1;
    }
    function loop(){frame();raf=requestAnimationFrame(loop);}
    const pos=e=>{const r=hero.getBoundingClientRect();return[e.clientX-r.left,e.clientY-r.top];};
    const pd=e=>{if(e.target.closest('a,button'))return;down=true;clicks++;const[x,y]=pos(e);drop(x,y,70,clicks%4===0,2.6);if(reduce)for(let i=0;i<120;i++)frame();};
    const pm=e=>{if(!down||reduce)return;const[x,y]=pos(e);drop(x,y,5,false,.8);};
    const pu=()=>{down=false;};
    hero.addEventListener('pointerdown',pd);hero.addEventListener('pointermove',pm);window.addEventListener('pointerup',pu);
    const ro=new ResizeObserver(()=>{size();if(reduce){next=0;for(let i=0;i<500;i++)frame();}});ro.observe(hero);
    size(); if(reduce){for(let i=0;i<500;i++)frame();} else loop();
    return ()=>{cancelAnimationFrame(raf);ro.disconnect();hero.removeEventListener('pointerdown',pd);hero.removeEventListener('pointermove',pm);window.removeEventListener('pointerup',pu);};
  }
