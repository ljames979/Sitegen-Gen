function(root,SG){SG=SG||{};
    const hero=root.querySelector('.g-hero'), cv=root.querySelector('.g-cv'), ctx=cv.getContext('2d');
    const reduce=matchMedia('(prefers-reduced-motion: reduce)').matches;
    const off=document.createElement('canvas'), ox=off.getContext('2d');
    let W=1,H=1,cell=4,cw=1,ch=1,A=null,B=null,tex=null,img=null,raf=0,t=0,lx=-1,ly=-1;
    function size(){const r=hero.getBoundingClientRect();W=Math.max(1,Math.round(r.width));H=Math.max(1,Math.round(r.height));cell=W<760?5:4;cw=Math.ceil(W/cell);ch=Math.ceil(H/cell);
      A=new Float32Array(cw*ch);B=new Float32Array(cw*ch);off.width=cw;off.height=ch;img=ox.createImageData(cw,ch);cv.width=W;cv.height=H;
      tex=new Uint8ClampedArray(cw*ch*3);const T=Math.max(4,Math.round(22/cell)),lane=Math.floor(cw*.82);
      for(let y=0;y<ch;y++)for(let x=0;x<cw;x++){const i=(y*cw+x)*3,tx=Math.floor(x/T),ty=Math.floor(y/T),h=((tx*73856093)^(ty*19349663))>>>0,v=(h%100)/100,dk=1-.32*(y/ch);
        let r,g,b;if(x%T===0||y%T===0){r=96;g=196;b=222;}else{r=22+v*12;g=150+v*18;b=200+v*14;}
        if(Math.abs(x-lane)<T*.5&&y>ch*.12&&y<ch*.88){r=r*.45;g=g*.55;b=b*.75;}
        tex[i]=r*dk;tex[i+1]=g*dk;tex[i+2]=Math.min(255,b*dk+10);}}
    function drop(x,y,rad,amp){const cx=Math.floor(x/cell),cy=Math.floor(y/cell);for(let j=-rad;j<=rad;j++)for(let i=-rad;i<=rad;i++){const xx=cx+i,yy=cy+j;if(xx>0&&yy>0&&xx<cw-1&&yy<ch-1&&i*i+j*j<=rad*rad)A[yy*cw+xx]+=amp*(1-(i*i+j*j)/(rad*rad+1));}}
    function step(){for(let y=1;y<ch-1;y++){const o=y*cw;for(let x=1;x<cw-1;x++){const i=o+x;B[i]=((A[i-1]+A[i+1]+A[i-cw]+A[i+cw])*.5-B[i])*.984;}}const s=A;A=B;B=s;}
    function render(){const d=img.data;for(let y=1;y<ch-1;y++){for(let x=1;x<cw-1;x++){const i=y*cw+x,dx=A[i-1]-A[i+1],dy=A[i-cw]-A[i+cw];
        let sx=x+(dx*.03|0),sy=y+(dy*.03|0);if(sx<0)sx=0;else if(sx>=cw)sx=cw-1;if(sy<0)sy=0;else if(sy>=ch)sy=ch-1;
        const ti=(sy*cw+sx)*3,sh=(dx-dy)*.14,o=i*4,c=sh>26?(sh-26)*2.2:0;
        d[o]=tex[ti]+sh+c;d[o+1]=tex[ti+1]+sh+c;d[o+2]=tex[ti+2]+sh+c;d[o+3]=255;}}
      ox.putImageData(img,0,0);ctx.imageSmoothingEnabled=true;ctx.drawImage(off,0,0,W,H);}
    function frame(){t+=.016;if(Math.random()<.35)drop(Math.random()*W,Math.random()*H,1,70);step();render();}
    function loop(){frame();raf=requestAnimationFrame(loop);}
    const pos=e=>{const r=hero.getBoundingClientRect();return[e.clientX-r.left,e.clientY-r.top];};
    const move=e=>{if(reduce)return;const[x,y]=pos(e);if(lx>=0){const dist=Math.hypot(x-lx,y-ly),n=Math.min(6,Math.ceil(dist/(cell*3)));for(let k=1;k<=n;k++)drop(lx+(x-lx)*k/n,ly+(y-ly)*k/n,2,140);}lx=x;ly=y;};
    const leave=()=>{lx=-1;ly=-1;};
    const click=e=>{if(reduce||e.target.closest('a,button'))return;const[x,y]=pos(e);drop(x,y,4,900);};
    hero.addEventListener('pointermove',move);hero.addEventListener('pointerleave',leave);hero.addEventListener('click',click);
    const ro=new ResizeObserver(()=>{size();render();});ro.observe(hero);
    size(); if(reduce)render(); else loop();
    return ()=>{cancelAnimationFrame(raf);ro.disconnect();hero.removeEventListener('pointermove',move);hero.removeEventListener('pointerleave',leave);hero.removeEventListener('click',click);};
  }
