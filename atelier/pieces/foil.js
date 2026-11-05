function(root,SG){SG=SG||{};
    const arch=root.querySelector('.j-arch'), cv=root.querySelector('.j-cv');
    const reduce=matchMedia('(prefers-reduced-motion: reduce)').matches;
    let gl=null,prog=null,uR,uT,uM,raf=0,mx=.45,my=.4,tmx=.45,tmy=.4;const t0=performance.now();
    try{gl=cv.getContext('webgl',{antialias:false,premultipliedAlpha:false});}catch(e){gl=null;}
    if(gl){
      const vs='attribute vec2 p;void main(){gl_Position=vec4(p,0.,1.);}';
      const fs='precision mediump float;uniform vec2 r;uniform float t;uniform vec2 m;'+
        'float h(vec2 p){return fract(sin(dot(p,vec2(127.1,311.7)))*43758.5453);}'+
        'float n(vec2 p){vec2 i=floor(p),f=fract(p);vec2 u=f*f*(3.-2.*f);return mix(mix(h(i),h(i+vec2(1.,0.)),u.x),mix(h(i+vec2(0.,1.)),h(i+vec2(1.,1.)),u.x),u.y);}'+
        'float fb(vec2 p){float v=0.,a=.5;for(int i=0;i<5;i++){v+=a*n(p);p=p*2.03+vec2(1.7,9.2);a*=.5;}return v;}'+
        'void main(){vec2 uv=gl_FragCoord.xy/r;vec2 p=uv*vec2(r.x/r.y,1.);vec2 d=m-.5;'+
        'float a=fb(p*2.+vec2(t*.04,-t*.03)+d*1.2);float b=fb(p*4.5+a*2.2-d*.8);'+
        'float k=a*1.5+b*.7+dot(uv-.5,d)*2.2+t*.025;'+
        'vec3 c=.6+.4*cos(6.2831*(k*vec3(1.,.93,.86)+vec3(0.,.33,.67)));c=mix(c,vec3(.98,.96,.93),.46);'+
        'vec2 g=floor(p*110.);vec2 fp=fract(p*110.)-.5;float fl=h(g);c+=step(.99,fl)*smoothstep(.42,0.,length(fp))*(.5+.5*sin(t*2.5+fl*50.+d.x*12.));'+
        'vec2 q=uv-m;c+=exp(-9.*dot(q,q))*.22;c*=.92+.08*smoothstep(0.,.6,uv.y);gl_FragColor=vec4(c,1.);}';
      const sh=(type,src)=>{const s=gl.createShader(type);gl.shaderSource(s,src);gl.compileShader(s);return gl.getShaderParameter(s,gl.COMPILE_STATUS)?s:null;};
      const a=sh(gl.VERTEX_SHADER,vs),b=sh(gl.FRAGMENT_SHADER,fs);
      if(a&&b){prog=gl.createProgram();gl.attachShader(prog,a);gl.attachShader(prog,b);gl.linkProgram(prog);if(!gl.getProgramParameter(prog,gl.LINK_STATUS))prog=null;}
      if(prog){gl.useProgram(prog);const buf=gl.createBuffer();gl.bindBuffer(gl.ARRAY_BUFFER,buf);gl.bufferData(gl.ARRAY_BUFFER,new Float32Array([-1,-1,1,-1,-1,1,1,1]),gl.STATIC_DRAW);const loc=gl.getAttribLocation(prog,'p');gl.enableVertexAttribArray(loc);gl.vertexAttribPointer(loc,2,gl.FLOAT,false,0,0);uR=gl.getUniformLocation(prog,'r');uT=gl.getUniformLocation(prog,'t');uM=gl.getUniformLocation(prog,'m');}
    }
    if(!prog)arch.classList.add('j-nogl');
    function size(){if(!prog)return;const r=arch.getBoundingClientRect(),dp=Math.min(1.5,window.devicePixelRatio||1);cv.width=Math.max(1,Math.round(r.width*dp));cv.height=Math.max(1,Math.round(r.height*dp));gl.viewport(0,0,cv.width,cv.height);}
    function draw(){if(!prog)return;mx+=(tmx-mx)*.05;my+=(tmy-my)*.05;gl.uniform2f(uR,cv.width,cv.height);gl.uniform1f(uT,reduce?8:(performance.now()-t0)/1000);gl.uniform2f(uM,mx,1-my);gl.drawArrays(gl.TRIANGLE_STRIP,0,4);}
    function loop(){draw();raf=requestAnimationFrame(loop);}
    const move=e=>{const r=arch.getBoundingClientRect();tmx=Math.min(1,Math.max(0,(e.clientX-r.left)/r.width));tmy=Math.min(1,Math.max(0,(e.clientY-r.top)/r.height));if(reduce){mx=tmx;my=tmy;draw();}};
    window.addEventListener('pointermove',move);
    const ro=new ResizeObserver(()=>{size();draw();});ro.observe(arch);
    size(); if(reduce||!prog)draw(); else loop();

    return ()=>{cancelAnimationFrame(raf);ro.disconnect();window.removeEventListener('pointermove',move);};
  }
