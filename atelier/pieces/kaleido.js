function(root,SG){SG=SG||{};
    const scope=root.querySelector('.x-scope'), cv=root.querySelector('.x-cv'), ctx=cv.getContext('2d');
    const reduce=matchMedia('(prefers-reduced-motion: reduce)').matches;
    let S=1,D=1,raf=0,t=0,n=8,hue=0,drawing=false,last=null,idle=99;const A={a:0,r:.2,p:null};
    function clear(){ctx.globalCompositeOperation='source-over';ctx.fillStyle='#110D2E';ctx.fillRect(0,0,S,S);}
    function size(){const r=scope.getBoundingClientRect();D=Math.min(2,window.devicePixelRatio||1);S=Math.max(1,Math.round(r.width));cv.width=cv.height=S*D;ctx.setTransform(D,0,0,D,0,0);clear();A.p=null;}
    function seg(p0,p1,w){const c=S/2;ctx.save();ctx.translate(c,c);ctx.globalCompositeOperation='lighter';ctx.lineCap='round';ctx.lineWidth=w;ctx.strokeStyle='hsla('+(hue%360)+',95%,62%,.85)';
      for(let k=0;k<n;k++){ctx.save();ctx.rotate(k*2*Math.PI/n);for(let m=0;m<2;m++){ctx.beginPath();ctx.moveTo(p0[0],m?-p0[1]:p0[1]);ctx.lineTo(p1[0],m?-p1[1]:p1[1]);ctx.stroke();}ctx.restore();}ctx.restore();}
    function autoStep(){A.a+=.03+Math.sin(t*.7)*.02;A.r=.08+.36*(.5+.5*Math.sin(t*.43+Math.cos(t*.21)*2));const p=[Math.cos(A.a)*A.r*S,Math.sin(A.a*1.7)*A.r*S*.6];if(A.p)seg(A.p,p,2.6);A.p=p;hue+=.7;}
    function frame(){t+=.016;idle+=.016;ctx.globalCompositeOperation='source-over';ctx.fillStyle='rgba(17,13,46,0.03)';ctx.fillRect(0,0,S,S);if(!drawing&&idle>1.2)autoStep();}
    function loop(){frame();raf=requestAnimationFrame(loop);}
    const pos=e=>{const r=scope.getBoundingClientRect();return[e.clientX-r.left-r.width/2,e.clientY-r.top-r.height/2];};
    const down=e=>{drawing=true;scope.setPointerCapture(e.pointerId);last=pos(e);idle=0;};
    const move=e=>{if(!drawing)return;const p=pos(e);seg(last,p,6);last=p;hue+=2.2;idle=0;A.p=null;};
    const up=()=>{drawing=false;};
    const tools=root.querySelector('.x-tools');
    const tool=e=>{const b=e.target.closest('button');if(!b)return;if(b.classList.contains('x-clear')){clear();A.p=null;if(reduce)for(let i=0;i<500;i++){t+=.016;autoStep();}return;}n=+b.dataset.n;tools.querySelectorAll('[data-n]').forEach(x=>x.setAttribute('aria-pressed',String(x===b)));};
    scope.addEventListener('pointerdown',down);scope.addEventListener('pointermove',move);scope.addEventListener('pointerup',up);scope.addEventListener('pointercancel',up);tools.addEventListener('click',tool);
    const ro=new ResizeObserver(()=>{size();if(reduce)for(let i=0;i<500;i++){t+=.016;autoStep();}});ro.observe(scope);
    size(); if(reduce){for(let i=0;i<500;i++){t+=.016;autoStep();}} else loop();
    return ()=>{cancelAnimationFrame(raf);ro.disconnect();scope.removeEventListener('pointerdown',down);scope.removeEventListener('pointermove',move);scope.removeEventListener('pointerup',up);scope.removeEventListener('pointercancel',up);tools.removeEventListener('click',tool);};
  }
