function(root,SG){SG=SG||{};
    const hero=root.querySelector('.u-hero'), cv=root.querySelector('.u-cv'), ctx=cv.getContext('2d');
    const reduce=matchMedia('(prefers-reduced-motion: reduce)').matches;
    let W=1,H=1,D=1,raf=0,t=0,mx=.45,tmx=.45;
    const lerp=(a,b,k)=>a+(b-a)*k;
    const mix=(c1,c2,k)=>'rgb('+c1.map((v,i)=>Math.round(lerp(v,c2[i],k))).join(',')+')';
    const BACK=[106,96,140], FRONT=[14,59,74], N=18;
    function size(){const r=hero.getBoundingClientRect();D=Math.min(2,window.devicePixelRatio||1);W=Math.max(1,Math.round(r.width));H=Math.max(1,Math.round(r.height));cv.width=W*D;cv.height=H*D;ctx.setTransform(D,0,0,D,0,0);}
    function frame(){
      t+=0.016; mx+=(tmx-mx)*0.04;
      const hz=H*(W<760?0.66:0.6), sx=W*(W<760?0.78:0.7);
      const g=ctx.createLinearGradient(0,0,0,hz);g.addColorStop(0,'#141A3A');g.addColorStop(.5,'#3F3567');g.addColorStop(.82,'#C9707A');g.addColorStop(1,'#F6B07F');
      ctx.fillStyle=g;ctx.fillRect(0,0,W,hz+2);
      const sg=ctx.createRadialGradient(sx,hz,0,sx,hz,Math.max(W,H)*.4);sg.addColorStop(0,'rgba(255,224,180,.9)');sg.addColorStop(.1,'rgba(255,200,150,.45)');sg.addColorStop(1,'rgba(255,160,120,0)');
      ctx.fillStyle=sg;ctx.fillRect(0,0,W,hz);
      ctx.fillStyle='#FFE6C2';ctx.beginPath();ctx.arc(sx,hz,46,Math.PI,0);ctx.fill();
      const swell=0.7+mx*0.8, step=Math.max(4,W/200);
      for(let i=0;i<N;i++){
        const k=i/(N-1), y0=hz+(H-hz)*Math.pow(k,1.7), amp=(1.5+k*k*26)*swell, wl=40+k*260, sp=0.6+k*0.9, ph=i*1.7;
        const ys=[];
        ctx.beginPath();ctx.moveTo(0,H);
        for(let x=0;x<=W+step;x+=step){const y=y0+Math.sin(x/wl+t*sp+ph)*amp+Math.sin(x/(wl*.37)-t*sp*1.3+ph)*amp*.25;ys.push([x,y]);ctx.lineTo(x,y);}
        ctx.lineTo(W+step,H);ctx.closePath();
        ctx.fillStyle=mix(BACK,FRONT,Math.pow(k,.6));ctx.fill();
        ctx.beginPath();ys.forEach((p,j)=>j?ctx.lineTo(p[0],p[1]):ctx.moveTo(p[0],p[1]));
        ctx.strokeStyle='rgba(255,226,196,'+(0.08+0.22*(1-k))+')';ctx.lineWidth=1+k*1.5;ctx.stroke();
        if(k>0.7){ctx.fillStyle='rgba(247,235,221,'+((k-.7)*1.5)+')';for(let j=0;j<ys.length;j+=3){const p=ys[j];if(Math.sin(p[0]/wl+t*sp+ph)<-0.6){ctx.beginPath();ctx.arc(p[0]+Math.sin(j+t)*3,p[1]-2,1+k*1.6,0,7);ctx.fill();}}}
      }
      ctx.globalCompositeOperation='lighter';
      for(let j=0;j<46;j++){const k=j/46,y=hz+4+Math.pow(k,1.5)*(H-hz)*.85,w=(14+k*120)*(0.5+0.5*Math.sin(t*3+j*1.9)),x=sx+Math.sin(t*1.3+j)*k*40-w/2;ctx.fillStyle='rgba(255,214,170,'+(0.35*(1-k))+')';ctx.fillRect(x,y,w,1.5+k*2);}
      ctx.globalCompositeOperation='source-over';
    }
    function loop(){frame();raf=requestAnimationFrame(loop);}
    const move=e=>{const r=hero.getBoundingClientRect();tmx=Math.min(1,Math.max(0,(e.clientX-r.left)/r.width));};
    hero.addEventListener('pointermove',move);
    const ro=new ResizeObserver(()=>{size();frame();});ro.observe(hero);
    size(); if(reduce){frame();} else loop();
    return ()=>{cancelAnimationFrame(raf);ro.disconnect();hero.removeEventListener('pointermove',move);};
  }
