function(root,SG){SG=SG||{};
    const bed=root.querySelector('.l-bed'), imp=root.querySelector('.l-imp'), btn=root.querySelector('.l-pull'), note=root.querySelector('.l-sheet small');
    const reduce=matchMedia('(prefers-reduced-motion: reduce)').matches;
    const PH=SG.phrases&&SG.phrases.length?SG.phrases:['HELLO THERE','THANK YOU','WITH LOVE'];
    let idx=0,count=1,busy=false,timer=0;
    function set(ph){
      const idx=ph.split('').map((ch,i)=>[ch,i]).reverse();const words=[];let cur=[];idx.forEach(([ch,i])=>{if(ch===' '){words.push(cur);cur=[];}else cur.push([ch,i]);});words.push(cur);
      bed.innerHTML=words.map(w=>'<span class="l-word">'+w.map(([ch,i])=>'<span class="l-b" data-i="'+i+'"><span>'+ch+'</span></span>').join('')+'</span>').join('<i class="l-sp"></i>')+'<div class="l-roller"></div>';
      imp.innerHTML=ph.split('').map((ch,i)=>ch===' '?'<span>&nbsp;</span>':'<span data-i="'+i+'" style="transform:rotate('+(Math.random()*2.4-1.2).toFixed(2)+'deg);opacity:'+(.8+Math.random()*.2).toFixed(2)+'">'+ch+'</span>').join('');
      imp.setAttribute('aria-label',ph);}
    set(PH[0]);
    const over=e=>{const b=e.target.closest('.l-b');if(!b)return;const s=imp.querySelector('[data-i="'+b.dataset.i+'"]');if(s)s.classList.add('hit');};
    const out=e=>{const b=e.target.closest('.l-b');if(!b)return;const s=imp.querySelector('[data-i="'+b.dataset.i+'"]');if(s)s.classList.remove('hit');};
    const tap=e=>{const b=e.target.closest('.l-b');if(!b)return;b.classList.add('down');const s=imp.querySelector('[data-i="'+b.dataset.i+'"]');if(s)s.classList.add('hit');setTimeout(()=>{b.classList.remove('down');if(s)s.classList.remove('hit');},350);};
    function pull(){if(busy)return;busy=true;idx=(idx+1)%PH.length;count++;
      const r=bed.querySelector('.l-roller');if(!reduce&&r)r.classList.add('go');
      timer=setTimeout(()=>{set(PH[idx]);note.textContent='Impression '+count;if(!reduce){imp.classList.add('wet');requestAnimationFrame(()=>requestAnimationFrame(()=>imp.classList.remove('wet')));}busy=false;},reduce?0:780);}
    bed.addEventListener('pointerover',over);bed.addEventListener('pointerout',out);bed.addEventListener('click',tap);btn.addEventListener('click',pull);
    return ()=>{clearTimeout(timer);bed.removeEventListener('pointerover',over);bed.removeEventListener('pointerout',out);bed.removeEventListener('click',tap);btn.removeEventListener('click',pull);};
  }
