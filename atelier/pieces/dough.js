function(root,SG){SG=SG||{};
    const hero=root.querySelector('.d-hero'), cv=root.querySelector('.d-cv'), ctx=cv.getContext('2d');
    const reduce=matchMedia('(prefers-reduced-motion: reduce)').matches;
    const off=document.createElement('canvas'), ox=off.getContext('2d');
    let W=1,H=1,F=4,w=1,h=1,img=null,raf=0,t=0,px=-999,py=-999,bx=-999,by=-999,blobs=[];
    function size(){const r=hero.getBoundingClientRect();W=Math.max(1,Math.round(r.width));H=Math.max(1,Math.round(r.height));F=W<760?5:4;w=Math.ceil(W/F);h=Math.ceil(H/F);off.width=w;off.height=h;img=ox.createImageData(w,h);cv.width=W;cv.height=H;
      const narrow=W<760,n=narrow?7:9;blobs=[];
      for(let i=0;i<n;i++)blobs.push({x:narrow?Math.random()*w:w*(.52+Math.random()*.46),y:narrow?h*(.68+Math.random()*.3):h*(.14+Math.random()*.82),r:(narrow?9:11)+Math.random()*(narrow?9:13),ph:Math.random()*6.28,s:.3+Math.random()*.5});}
    function frame(){
      t+=.016;
      const B=blobs.map(b=>[b.x+Math.sin(t*.25*b.s+b.ph)*6,b.y+Math.cos(t*.2*b.s+b.ph)*4,Math.pow(b.r*(1+.07*Math.sin(t*.5+b.ph)),2),b.r]);
      if(px>-900){if(bx<-900){bx=px/F;by=py/F;}bx+=(px/F-bx)*.08;by+=(py/F-by)*.08;B.push([bx,by,Math.pow(W<760?14:20,2),0]);}
      const d=img.data;
      for(let y=0;y<h;y++){for(let x=0;x<w;x++){let f=0;for(let k=0;k<B.length;k++){const dx=x-B[k][0],dy=y-B[k][1];f+=B[k][2]/(dx*dx+dy*dy+1);}
        const i=(y*w+x)*4,hs=((x*73856093)^(y*19349663))>>>0;
        if(f>1){const e=Math.min(1,(f-1)/.7);let r=196+(244-196)*e,g=128+(223-128)*e,b=64+(184-64)*e;if(hs%61===0){r=255;g=251;b=242;}else if(hs%89===0){r-=18;g-=16;b-=12;}d[i]=r;d[i+1]=g;d[i+2]=b;d[i+3]=255;}
        else if(f>.68){const a=(f-.68)/.32;d[i]=70;d[i+1]=44;d[i+2]=24;d[i+3]=a*a*80;}
        else{if(hs%173===0){d[i]=255;d[i+1]=255;d[i+2]=255;d[i+3]=150;}else d[i+3]=0;}}}
      ox.putImageData(img,0,0);ctx.clearRect(0,0,W,H);ctx.imageSmoothingEnabled=true;ctx.drawImage(off,0,0,W,H);
      ctx.lineCap='round';
      B.forEach(b=>{if(b[3]<17)return;const x=b[0]*F,y=b[1]*F,r=b[3]*F;ctx.strokeStyle='rgba(150,88,36,.55)';ctx.lineWidth=4;ctx.beginPath();ctx.arc(x-r*.12,y+r*.25,r*.5,-2.5,-.75);ctx.stroke();ctx.strokeStyle='rgba(255,246,228,.55)';ctx.lineWidth=2;ctx.beginPath();ctx.arc(x-r*.12,y+r*.25-3,r*.5,-2.4,-.85);ctx.stroke();});
    }
    function loop(){frame();raf=requestAnimationFrame(loop);}
    const move=e=>{const r=hero.getBoundingClientRect();px=e.clientX-r.left;py=e.clientY-r.top;if(reduce)frame();};
    const leave=()=>{px=-999;bx=-999;if(reduce)frame();};
    hero.addEventListener('pointermove',move);hero.addEventListener('pointerleave',leave);
    const ro=new ResizeObserver(()=>{size();frame();});ro.observe(hero);
    size(); if(reduce)frame(); else loop();
    return ()=>{cancelAnimationFrame(raf);ro.disconnect();hero.removeEventListener('pointermove',move);hero.removeEventListener('pointerleave',leave);};
  }
