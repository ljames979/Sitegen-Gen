function(root,SG){SG=SG||{};
    const hero=root.querySelector('.m-hero'), cv=root.querySelector('.m-cv'), ctx=cv.getContext('2d');
    const reduce=matchMedia('(prefers-reduced-motion: reduce)').matches;
    const MAT=[null,{c:[[227,201,142],[214,186,128],[238,216,162]],slip:1},{c:[[150,148,140],[178,174,164],[118,116,110]],slip:.75},{c:[[107,63,34],[132,82,44],[84,48,26]],slip:.3},{c:[[183,169,154],[150,140,128],[208,198,184]],slip:.55}];
    const off=document.createElement('canvas'), ox=off.getContext('2d');
    let W=1,H=1,cell=5,gw=1,gh=1,g=null,v=null,img=null,raf=0,t=0,mat=1,pouring=false,px=0,py=0,chutes=[];
    function size(){const r=hero.getBoundingClientRect();W=Math.max(1,Math.round(r.width));H=Math.max(1,Math.round(r.height));cell=W<860?6:5;gw=Math.ceil(W/cell);gh=Math.ceil(H/cell);g=new Uint8Array(gw*gh);v=new Uint8Array(gw*gh);off.width=gw;off.height=gh;img=ox.createImageData(gw,gh);cv.width=W;cv.height=H;t=0;
      chutes=W<860?[{x:.25,m:1},{x:.55,m:2},{x:.85,m:3}]:[{x:.62,m:1},{x:.76,m:2},{x:.9,m:3}];}
    function pour(x,y,m,r,n){const cx=Math.floor(x/cell),cy=Math.floor(y/cell);for(let k=0;k<n;k++){const a=Math.random()*6.283,d=Math.random()*r,xx=cx+Math.round(Math.cos(a)*d),yy=cy+Math.round(Math.sin(a)*d);if(xx>=0&&yy>=0&&xx<gw&&yy<gh){const i=yy*gw+xx;if(!g[i]){g[i]=m;v[i]=(Math.random()*3)|0;}}}}
    function step(){for(let y=gh-2;y>=0;y--){const flip=(y+((t*60)|0))&1;for(let k=0;k<gw;k++){const x=flip?k:gw-1-k,i=y*gw+x,m=g[i];if(!m)continue;const b=i+gw;
        if(!g[b]){g[b]=m;v[b]=v[i];g[i]=0;continue;}
        if(Math.random()<MAT[m].slip){const d=Math.random()<.5?-1:1;for(const dd of[d,-d]){const nx=x+dd;if(nx<0||nx>=gw)continue;const j=b+dd;if(!g[j]&&!g[i+dd]){g[j]=m;v[j]=v[i];g[i]=0;break;}}}}}}
    function render(){const d=img.data;for(let i=0;i<gw*gh;i++){const m=g[i],o=i*4;if(m){const c=MAT[m].c[v[i]];d[o]=c[0];d[o+1]=c[1];d[o+2]=c[2];d[o+3]=255;}else d[o+3]=0;}
      ox.putImageData(img,0,0);ctx.clearRect(0,0,W,H);ctx.imageSmoothingEnabled=false;ctx.drawImage(off,0,0,W,H);
      if(t<16||reduce)chutes.forEach(c=>{const x=c.x*W,y=H*.13;ctx.fillStyle='#2A2620';ctx.beginPath();ctx.moveTo(x-34,y-22);ctx.lineTo(x+34,y-22);ctx.lineTo(x+8,y);ctx.lineTo(x-8,y);ctx.closePath();ctx.fill();});}
    function frame(){t+=.016;if(t<16)chutes.forEach(c=>pour(c.x*W,H*.13+8,c.m,2,7));if(pouring)pour(px,py,mat,3,10);step();render();}
    function loop(){frame();raf=requestAnimationFrame(loop);}
    const pos=e=>{const r=hero.getBoundingClientRect();px=e.clientX-r.left;py=e.clientY-r.top;};
    const down=e=>{if(e.target.closest('a,button,input,select,label'))return;pouring=true;pos(e);if(reduce){for(let i=0;i<40;i++){pour(px,py,mat,3,10);step();}render();}};
    const move=e=>{if(!pouring)return;pos(e);if(reduce){pour(px,py,mat,3,10);for(let i=0;i<10;i++)step();render();}};
    const up=()=>{pouring=false;};
    const pick=e=>{const b=e.target.closest('.m-mat');if(!b)return;if(b.classList.contains('m-reset')){g.fill(0);t=99;render();return;}mat=+b.dataset.m;root.querySelectorAll('.m-mat[data-m]').forEach(x=>x.setAttribute('aria-pressed',String(x===b)));};
    hero.addEventListener('pointerdown',down);hero.addEventListener('pointermove',move);window.addEventListener('pointerup',up);hero.addEventListener('click',pick);
    const pre=()=>{for(let i=0;i<700;i++){t+=.016;if(t<16)chutes.forEach(c=>pour(c.x*W,H*.13+8,c.m,1.2,3));step();}render();};
    const ro=new ResizeObserver(()=>{size();if(reduce)pre();else render();});ro.observe(hero);
    size(); if(reduce)pre(); else loop();
    return ()=>{cancelAnimationFrame(raf);ro.disconnect();hero.removeEventListener('pointerdown',down);hero.removeEventListener('pointermove',move);window.removeEventListener('pointerup',up);hero.removeEventListener('click',pick);};
  }
