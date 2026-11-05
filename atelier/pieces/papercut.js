function(root,SG){SG=SG||{};
    const hero=root.querySelector('.c-hero');
    if(matchMedia('(prefers-reduced-motion: reduce)').matches) return function(){};
    let tx=0,ty=0,x=0,y=0,raf=0;
    const mv=e=>{const r=hero.getBoundingClientRect();tx=((e.clientX-r.left)/r.width-.5)*2;ty=((e.clientY-r.top)/r.height-.5)*2;};
    const lv=()=>{tx=0;ty=0;};
    hero.addEventListener('pointermove',mv);hero.addEventListener('pointerleave',lv);
    function loop(){x+=(tx-x)*.06;y+=(ty-y)*.06;hero.style.setProperty('--mx',x.toFixed(3));hero.style.setProperty('--my',y.toFixed(3));raf=requestAnimationFrame(loop);}
    loop();
    return ()=>{cancelAnimationFrame(raf);hero.removeEventListener('pointermove',mv);hero.removeEventListener('pointerleave',lv);};
  }
