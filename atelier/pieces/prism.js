function(root,SG){SG=SG||{};
    const hero=root.querySelector('.o-hero'), cv=root.querySelector('.o-cv'), ctx=cv.getContext('2d');
    const reduce=matchMedia('(prefers-reduced-motion: reduce)').matches;
    const SPEC=['#FF4D5A','#FF8A3D','#FFD84A','#5EE38C','#3FC4FF','#4F7BFF','#9A5CFF'];
    const hexA=(h,a)=>{const n=parseInt(h.slice(1),16);return 'rgba('+(n>>16)+','+((n>>8)&255)+','+(n&255)+','+a+')';};
    const lerp=(a,b,k)=>[a[0]+(b[0]-a[0])*k,a[1]+(b[1]-a[1])*k];
    let W=1,H=1,D=1,raf=0,t=0,my=.5,tmy=.5,mx=.5,tmx=.5;const dust=[];
    function size(){const r=hero.getBoundingClientRect();D=Math.min(2,window.devicePixelRatio||1);W=Math.max(1,Math.round(r.width));H=Math.max(1,Math.round(r.height));cv.width=W*D;cv.height=H*D;ctx.setTransform(D,0,0,D,0,0);dust.length=0;for(let i=0;i<80;i++)dust.push({x:Math.random()*W,y:Math.random()*H,v:.1+Math.random()*.3,p:Math.random()*6.28});}
    function frame(){
      t+=.016;my+=(tmy-my)*.05;mx+=(tmx-mx)*.05;
      ctx.globalCompositeOperation='source-over';ctx.globalAlpha=1;
      ctx.fillStyle='#0B0C10';ctx.fillRect(0,0,W,H);
      const narrow=W<760, cx=narrow?W*.64:W*.68, cy=narrow?H*.8:H*.5, R=Math.min(W,H)*(narrow?.15:.2);
      const vg=ctx.createRadialGradient(cx,cy,0,cx,cy,Math.max(W,H)*.6);vg.addColorStop(0,'rgba(60,64,90,.35)');vg.addColorStop(1,'rgba(11,12,16,0)');ctx.fillStyle=vg;ctx.fillRect(0,0,W,H);
      const rot=(my-.5)*.55+Math.sin(t*.4)*.03;
      const v=[0,1,2].map(i=>{const a=-Math.PI/2+i*2*Math.PI/3+rot;return[cx+Math.cos(a)*R,cy+Math.sin(a)*R];});
      const pin=lerp(v[2],v[0],.55), pout=lerp(v[0],v[1],.5);
      const src=[-10,narrow?H*.96:H*(.66+(my-.5)*.3)];
      ctx.globalCompositeOperation='lighter';
      const bg=ctx.createLinearGradient(src[0],src[1],pin[0],pin[1]);bg.addColorStop(0,'rgba(255,255,255,0)');bg.addColorStop(.55,'rgba(255,255,255,.22)');bg.addColorStop(1,'rgba(255,255,255,.95)');
      [[18,.05],[8,.12],[2.2,1]].forEach(([w,a])=>{ctx.globalAlpha=a;ctx.strokeStyle=bg;ctx.lineWidth=w;ctx.beginPath();ctx.moveTo(src[0],src[1]);ctx.lineTo(pin[0],pin[1]);ctx.stroke();});
      ctx.globalAlpha=.55;ctx.strokeStyle='#FFFFFF';ctx.lineWidth=2.4;ctx.beginPath();ctx.moveTo(pin[0],pin[1]);ctx.lineTo(pout[0],pout[1]);ctx.stroke();ctx.globalAlpha=1;
      const base=Math.atan2(pin[1]-src[1],pin[0]-src[0])+.38+rot*.6+(mx-.5)*.12, spread=.42, L=Math.hypot(W,H)*1.2;
      SPEC.forEach((c,i)=>{const a=base+(i/6-.5)*spread, d=spread/13;
        const g=ctx.createLinearGradient(pout[0],pout[1],pout[0]+Math.cos(a)*W*.75,pout[1]+Math.sin(a)*W*.75);g.addColorStop(0,hexA(c,.85));g.addColorStop(.4,hexA(c,.35));g.addColorStop(1,hexA(c,0));
        ctx.fillStyle=g;ctx.beginPath();ctx.moveTo(pout[0],pout[1]);ctx.lineTo(pout[0]+Math.cos(a-d)*L,pout[1]+Math.sin(a-d)*L);ctx.lineTo(pout[0]+Math.cos(a+d)*L,pout[1]+Math.sin(a+d)*L);ctx.closePath();ctx.fill();});
      dust.forEach(p=>{if(!reduce){p.y-=p.v;p.x+=Math.sin(t+p.p)*.2;if(p.y<0)p.y=H;}ctx.fillStyle='rgba(255,255,255,'+(.12+.12*Math.sin(t*2+p.p)).toFixed(3)+')';ctx.fillRect(p.x,p.y,1.4,1.4);});
      ctx.globalCompositeOperation='source-over';
      const pg=ctx.createLinearGradient(v[2][0],v[2][1],v[1][0],v[0][1]);pg.addColorStop(0,'rgba(255,255,255,.13)');pg.addColorStop(1,'rgba(255,255,255,.03)');
      ctx.fillStyle=pg;ctx.beginPath();ctx.moveTo(v[0][0],v[0][1]);ctx.lineTo(v[1][0],v[1][1]);ctx.lineTo(v[2][0],v[2][1]);ctx.closePath();ctx.fill();
      ctx.strokeStyle='rgba(255,255,255,.6)';ctx.lineWidth=1.3;ctx.stroke();
      const e1=lerp(v[2],v[0],.12),e2=lerp(v[2],v[0],.42);ctx.strokeStyle='rgba(255,255,255,.95)';ctx.lineWidth=2;ctx.beginPath();ctx.moveTo(e1[0],e1[1]);ctx.lineTo(e2[0],e2[1]);ctx.stroke();
    }
    function loop(){frame();raf=requestAnimationFrame(loop);}
    const move=e=>{const r=hero.getBoundingClientRect();tmy=Math.min(1,Math.max(0,(e.clientY-r.top)/r.height));tmx=Math.min(1,Math.max(0,(e.clientX-r.left)/r.width));};
    hero.addEventListener('pointermove',move);
    const ro=new ResizeObserver(()=>{size();frame();});ro.observe(hero);
    size(); if(reduce)frame(); else loop();
    const range=root.querySelector('.o-range'),out=root.querySelector('.o-out'),chart=root.querySelector('.o-snellen'),badge=root.querySelector('.o-badge');
    function lens(){if(!range)return;const v=+range.value/100,res=1.75-v;chart.style.setProperty('--b',(res*2.4).toFixed(2)+'px');out.textContent=(v===0?'0.00':'−'+v.toFixed(2))+' D';badge.hidden=res>0.01;}
    if(range){range.addEventListener('input',lens);lens();}
    return ()=>{cancelAnimationFrame(raf);ro.disconnect();hero.removeEventListener('pointermove',move);if(range)range.removeEventListener('input',lens);};
  }
