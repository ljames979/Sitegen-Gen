function(root,SG){SG=SG||{};
    const hero=root.querySelector('.f-hero'), cv=root.querySelector('.f-cv'), ctx=cv.getContext('2d');
    const reduce=matchMedia('(prefers-reduced-motion: reduce)').matches;
    const bg=document.createElement('canvas'), bx=bg.getContext('2d');
    const spr=document.createElement('canvas');spr.width=spr.height=64;const sx=spr.getContext('2d');
    const rg=sx.createRadialGradient(32,32,0,32,32,32);rg.addColorStop(0,'rgba(255,250,215,1)');rg.addColorStop(.16,'rgba(255,230,130,.95)');rg.addColorStop(.42,'rgba(255,205,90,.28)');rg.addColorStop(1,'rgba(255,205,90,0)');sx.fillStyle=rg;sx.fillRect(0,0,64,64);
    let W=1,H=1,D=1,raf=0,t=0,px=-999,py=-999,flies=[],seed=7;
    const rnd=()=>{seed=(seed*16807)%2147483647;return seed/2147483647;};
    function scene(){
      seed=7;bg.width=W*D;bg.height=H*D;bx.setTransform(D,0,0,D,0,0);
      const g=bx.createLinearGradient(0,0,0,H);g.addColorStop(0,'#081422');g.addColorStop(.5,'#12304A');g.addColorStop(.74,'#1D3D47');g.addColorStop(1,'#0C1F19');bx.fillStyle=g;bx.fillRect(0,0,W,H);
      for(let i=0;i<140;i++){const big=rnd()<.1;bx.fillStyle='rgba(244,234,210,'+(.2+rnd()*.6).toFixed(2)+')';bx.fillRect(rnd()*W,rnd()*H*.5,big?1.7:1,big?1.7:1);}
      const mx=W*.84,my=H*.14;const mg=bx.createRadialGradient(mx,my,0,mx,my,170);mg.addColorStop(0,'rgba(244,234,210,.32)');mg.addColorStop(1,'rgba(244,234,210,0)');bx.fillStyle=mg;bx.fillRect(mx-170,my-170,340,340);bx.fillStyle='#F4EAD2';bx.beginPath();bx.arc(mx,my,30,0,7);bx.fill();
      const cols=['#183A3A','#10291F','#07150E'],gys=[.74,.84,.96],sps=[72,98,132],rrs=[30,44,62];
      for(let L=0;L<3;L++){const gy=H*gys[L],sp=sps[L]*(W<760?.75:1),rr=rrs[L]*(W<760?.75:1);
        const hz=bx.createLinearGradient(0,gy-60,0,gy);hz.addColorStop(0,'rgba(140,175,180,0)');hz.addColorStop(1,'rgba(140,175,180,.07)');bx.fillStyle=hz;bx.fillRect(0,gy-60,W,60);
        bx.fillStyle=cols[L];
        for(let x=-sp;x<W+sp;x+=sp){const cx=x+rnd()*sp*.4,r=rr*(.85+rnd()*.3),th=rr*.5;
          bx.fillStyle=cols[L];bx.fillRect(cx-r*.08,gy-th,r*.16,th+2);
          for(let k=0;k<6;k++){const a=k/6*Math.PI*2;bx.beginPath();bx.arc(cx+Math.cos(a)*r*.45,gy-th-r*.7+Math.sin(a)*r*.32,r*(.48+rnd()*.12),0,7);bx.fill();}
          bx.beginPath();bx.arc(cx,gy-th-r*.8,r*.6,0,7);bx.fill();
          if(L>0){const n=L===2?6:3;for(let k=0;k<n;k++){bx.fillStyle=L===2?'rgba(232,137,43,.8)':'rgba(232,137,43,.35)';bx.beginPath();bx.arc(cx+(rnd()-.5)*r*1.3,gy-th-r*.7+(rnd()-.5)*r*.8,L===2?2.8:2,0,7);bx.fill();}}
        }
        bx.fillStyle=cols[L];bx.fillRect(0,gy,W,H-gy);
      }
    }
    function makeFlies(){flies=[];const n=Math.round(Math.min(110,W/11));for(let i=0;i<n;i++)flies.push({x:Math.random()*W,y:H*(.35+Math.random()*.62),a:Math.random()*6.28,s:.2+Math.random()*.5,f:.6+Math.random()*1.4,p:Math.random()*6.28,z:Math.random()});}
    function size(){const r=hero.getBoundingClientRect();D=Math.min(2,window.devicePixelRatio||1);W=Math.max(1,Math.round(r.width));H=Math.max(1,Math.round(r.height));cv.width=W*D;cv.height=H*D;scene();makeFlies();}
    function frame(){
      t+=0.016;
      ctx.setTransform(1,0,0,1,0,0);ctx.drawImage(bg,0,0);ctx.setTransform(D,0,0,D,0,0);
      ctx.globalCompositeOperation='lighter';
      for(const f of flies){
        if(!reduce){f.a+=Math.sin(t*.7+f.p)*.04;f.x+=Math.cos(f.a)*f.s;f.y+=Math.sin(f.a)*f.s*.6;
          if(px>-900){const dx=px-f.x,dy=py-f.y;if(dx*dx+dy*dy<200*200){f.x+=dx*.004;f.y+=dy*.004;}}
          if(f.x<-20)f.x=W+20;if(f.x>W+20)f.x=-20;if(f.y<H*.32){f.y=H*.32;f.a=-f.a;}if(f.y>H){f.y=H;f.a=-f.a;}}
        const b=Math.max(0,Math.sin(t*f.f+f.p)),al=reduce?.6:.12+.88*b*b*b,sz=10+f.z*24;
        ctx.globalAlpha=al;ctx.drawImage(spr,f.x-sz/2,f.y-sz/2,sz,sz);
      }
      ctx.globalAlpha=1;ctx.globalCompositeOperation='source-over';
    }
    function loop(){frame();raf=requestAnimationFrame(loop);}
    const move=e=>{const r=hero.getBoundingClientRect();px=e.clientX-r.left;py=e.clientY-r.top;};
    const leave=()=>{px=-999;};
    hero.addEventListener('pointermove',move);hero.addEventListener('pointerleave',leave);
    const ro=new ResizeObserver(()=>{size();frame();});ro.observe(hero);
    size(); if(reduce)frame(); else loop();
    return ()=>{cancelAnimationFrame(raf);ro.disconnect();hero.removeEventListener('pointermove',move);hero.removeEventListener('pointerleave',leave);};
  }
