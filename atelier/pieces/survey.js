function(root,SG){SG=SG||{};
    const hero=root.querySelector('.z-hero'), cv=root.querySelector('.z-cv'), ctx=cv.getContext('2d'), elEl=root.querySelector('.z-elev'), brEl=root.querySelector('.z-brg');
    const reduce=matchMedia('(prefers-reduced-motion: reduce)').matches;
    const NX=64,NZ=44,Hm=new Float32Array(NX*NZ);let hi=0,hiI=0;
    for(let j=0;j<NZ;j++)for(let i=0;i<NX;i++){const u=i/(NX-1),v=j/(NZ-1);let h=.35*Math.exp(-((u-.68)**2+(v-.4)**2)/.03)+.22*Math.exp(-((u-.3)**2+(v-.62)**2)/.05)+.08*Math.sin(u*9+v*4)+.05*Math.sin(u*21-v*13)+.04*Math.cos(v*17+u*5)-.18*Math.exp(-((u-.45)**2+(v-.25)**2)/.02);Hm[j*NX+i]=h;if(h>hi){hi=h;hiI=j*NX+i;}}
    let mn=1e9,mx=-1e9;Hm.forEach(h=>{mn=Math.min(mn,h);mx=Math.max(mx,h);});for(let k=0;k<Hm.length;k++)Hm[k]=(Hm[k]-mn)/(mx-mn);
    const ELEV=h=>(58+h*34).toFixed(2);
    let W=1,H=1,D=1,raf=0,t=0,yaw=-.6,pitch=.95,ty=-.6,tp=.95,px=-1,py=-1,sx=new Float32Array(NX*NZ),sy=new Float32Array(NX*NZ),lastE='',lastB='';
    function size(){const r=hero.getBoundingClientRect();D=Math.min(2,window.devicePixelRatio||1);W=Math.max(1,Math.round(r.width));H=Math.max(1,Math.round(r.height));cv.width=W*D;cv.height=H*D;ctx.setTransform(D,0,0,D,0,0);}
    const COL=['rgba(46,111,115,.75)','rgba(98,170,160,.8)','rgba(159,211,199,.9)','rgba(255,170,90,.9)','rgba(255,122,26,1)'];
    function frame(){
      if(!reduce)t+=.016;yaw+=(ty+t*.04-yaw)*.05;pitch+=(tp-pitch)*.05;
      ctx.fillStyle='#0D1A1F';ctx.fillRect(0,0,W,H);
      const narrow=W<760,cx=narrow?W*.5:W*.66,cy=narrow?H*.76:H*.56,fov=Math.min(W*(narrow?1.1:.75),H*1.1),dist=2.3,cy_=Math.cos(yaw),sy_=Math.sin(yaw),cp=Math.cos(pitch),sp=Math.sin(pitch);
      for(let j=0;j<NZ;j++)for(let i=0;i<NX;i++){const k=j*NX+i,x=(i/(NX-1)-.5)*1.7,z=(j/(NZ-1)-.5)*1.15,y=-(Hm[k]-.4)*.42;const x1=x*cy_-z*sy_,z1=x*sy_+z*cy_;const y2=y*cp-z1*sp,z2=y*sp+z1*cp;const f=fov/(z2+dist);sx[k]=cx+x1*f;sy[k]=cy+y2*f;}
      const paths=COL.map(()=>new Path2D());
      const seg=(a,b)=>{const h=(Hm[a]+Hm[b])/2,c=Math.min(4,Math.floor(h*5));paths[c].moveTo(sx[a],sy[a]);paths[c].lineTo(sx[b],sy[b]);};
      for(let j=0;j<NZ;j++)for(let i=0;i<NX;i++){const k=j*NX+i;if(i<NX-1)seg(k,k+1);if(j<NZ-1)seg(k,k+NX);}
      ctx.lineWidth=1;paths.forEach((p,c)=>{ctx.strokeStyle=COL[c];ctx.stroke(p);});
      const bx=sx[hiI],by=sy[hiI];ctx.fillStyle='#FF7A1A';ctx.beginPath();ctx.moveTo(bx,by-14);ctx.lineTo(bx-8,by);ctx.lineTo(bx+8,by);ctx.closePath();ctx.fill();
      ctx.strokeStyle='rgba(255,122,26,.7)';ctx.beginPath();ctx.moveTo(bx,by-14);ctx.lineTo(bx,by-46);ctx.stroke();
      ctx.font='500 11px "Martian Mono", ui-monospace, monospace';ctx.fillStyle='#FF7A1A';ctx.textAlign='left';ctx.fillText('BM-112 · '+ELEV(1)+' FT',bx+8,by-40);
      let best=-1,bd=24*24;if(px>=0){for(let k=0;k<NX*NZ;k++){const dx=sx[k]-px,dy=sy[k]-py,d=dx*dx+dy*dy;if(d<bd){bd=d;best=k;}}}
      let e;if(best>=0){const x=sx[best],y=sy[best];ctx.strokeStyle='#EDF2EE';ctx.lineWidth=1;ctx.beginPath();ctx.moveTo(x-14,y);ctx.lineTo(x-4,y);ctx.moveTo(x+4,y);ctx.lineTo(x+14,y);ctx.moveTo(x,y-14);ctx.lineTo(x,y-4);ctx.moveTo(x,y+4);ctx.lineTo(x,y+14);ctx.stroke();ctx.fillStyle='#EDF2EE';ctx.fillText(ELEV(Hm[best])+' FT',x+12,y-10);e=ELEV(Hm[best])+' FT';}else e=ELEV(1)+' FT · BM';
      if(e!==lastE){lastE=e;elEl.textContent=e;}
      const b=Math.round(((-yaw*180/Math.PI)%360+360)%360)+'°';if(b!==lastB){lastB=b;brEl.textContent=b;}
    }
    function loop(){frame();raf=requestAnimationFrame(loop);}
    const move=e=>{const r=hero.getBoundingClientRect();px=e.clientX-r.left;py=e.clientY-r.top;ty=-.6+(px/r.width-.5)*1.4;tp=.75+(py/r.height)*.45;if(reduce){yaw=ty;pitch=tp;frame();}};
    const leave=()=>{px=-1;if(reduce)frame();};
    hero.addEventListener('pointermove',move);hero.addEventListener('pointerleave',leave);
    const ro=new ResizeObserver(()=>{size();frame();});ro.observe(hero);
    size(); if(reduce)frame(); else loop();
    return ()=>{cancelAnimationFrame(raf);ro.disconnect();hero.removeEventListener('pointermove',move);hero.removeEventListener('pointerleave',leave);};
  }
