
(() => {
  'use strict';
  const trigger=document.getElementById('private-unlock-trigger');
  const form=document.getElementById('private-unlock-form');
  const input=document.getElementById('private-unlock-input');
  const button=document.getElementById('private-unlock-submit');
  const status=document.getElementById('private-unlock-status');
  const unlocks=window.QingyuanUnlocks;
  if(!trigger||!form||!input||!button||!status||!unlocks)return;
  const expectedPassword='2464054180';
  let composing=false,activeTouch=null,lastTouchHandled=-Infinity;
  function showStatus(text,state=''){
    status.textContent=text;status.dataset.state=state;status.hidden=!text;
  }
  function closeInput(){
    form.hidden=true;trigger.setAttribute('aria-expanded','false');input.value='';
    input.removeAttribute('aria-invalid');input.blur();
  }
  trigger.addEventListener('click',event=>{
    event.preventDefault();event.stopPropagation();
    showStatus('');input.removeAttribute('aria-invalid');
    const opening=form.hidden;form.hidden=!opening;trigger.setAttribute('aria-expanded',String(opening));
    if(opening)requestAnimationFrame(()=>input.focus({preventScroll:true}));
  });
  function submitPassword(event){
    event?.preventDefault();event?.stopPropagation();
    if(composing||event?.isComposing){
      showStatus('请先完成密码输入，再点确认密码。','error');return;
    }
    const password=input.value.normalize('NFKC').replace(/[\s\u200B\uFEFF]/g,'');
    if(!password){
      input.setAttribute('aria-invalid','true');showStatus('请输入私测密码。','error');return;
    }
    if(password!==expectedPassword){
      input.value='';input.setAttribute('aria-invalid','true');
      showStatus('密码不正确，请重新输入。','error');return;
    }
    try{
      if(typeof unlocks.privateUnlock!=='function')throw new Error('Private unlock API unavailable');
      unlocks.privateUnlock();
      if(unlocks.isPrivateUnlocked!==true)throw new Error('Private unlock state was not updated');
      closeInput();
      showStatus('私测已解锁全部 10 项功能。关闭剑谱后，可点击需要的开关开启。','success');
    }catch(error){
      showStatus('解锁状态未能更新，请重新打开游戏后重试。','error');
      console.warn('Private unlock failed:',error);
    }
  }
  form.addEventListener('submit',submitPassword);
  button.addEventListener('click',event=>{
    event.preventDefault();event.stopPropagation();
    if(performance.now()-lastTouchHandled<800)return;
    submitPassword();
  });
  function finishTouch(event,x,y){
    const touch=activeTouch;activeTouch=null;
    event.preventDefault();event.stopPropagation();
    if(!touch)return;
    lastTouchHandled=performance.now();
    if(touch.cancelled||Math.hypot(x-touch.x,y-touch.y)>16)return;
    submitPassword();
  }
  if('PointerEvent' in window){
    button.addEventListener('pointerdown',event=>{
      if(event.pointerType==='mouse'||!event.isPrimary||event.button!==0)return;
      // Keep the keyboard from blurring the input and moving the button mid-tap.
      event.preventDefault();event.stopPropagation();
      activeTouch={id:event.pointerId,x:event.clientX,y:event.clientY,cancelled:false};
      try{button.setPointerCapture(event.pointerId);}catch(_){}
    });
    button.addEventListener('pointermove',event=>{
      if(activeTouch?.id===event.pointerId&&Math.hypot(event.clientX-activeTouch.x,event.clientY-activeTouch.y)>16)activeTouch.cancelled=true;
    });
    button.addEventListener('pointerup',event=>{
      if(activeTouch?.id===event.pointerId)finishTouch(event,event.clientX,event.clientY);
    });
    for(const type of ['pointercancel','lostpointercapture'])button.addEventListener(type,()=>{
      if(activeTouch)lastTouchHandled=performance.now();activeTouch=null;
    });
  }else{
    button.addEventListener('touchstart',event=>{
      if(event.touches.length!==1){activeTouch=null;return;}
      const touch=event.touches[0];event.preventDefault();event.stopPropagation();
      activeTouch={id:touch.identifier,x:touch.clientX,y:touch.clientY,cancelled:false};
    },{passive:false});
    button.addEventListener('touchmove',event=>{
      const touch=Array.from(event.touches).find(item=>item.identifier===activeTouch?.id);
      if(touch&&Math.hypot(touch.clientX-activeTouch.x,touch.clientY-activeTouch.y)>16)activeTouch.cancelled=true;
    },{passive:true});
    button.addEventListener('touchend',event=>{
      const touch=Array.from(event.changedTouches).find(item=>item.identifier===activeTouch?.id);
      if(touch)finishTouch(event,touch.clientX,touch.clientY);
    },{passive:false});
    button.addEventListener('touchcancel',()=>{
      if(activeTouch)lastTouchHandled=performance.now();activeTouch=null;
    });
  }
  input.addEventListener('compositionstart',()=>{composing=true;});
  input.addEventListener('compositionend',()=>{composing=false;});
  input.addEventListener('input',()=>{input.removeAttribute('aria-invalid');showStatus('');});
  input.addEventListener('keydown',event=>{
    if(composing||event.isComposing||event.keyCode===229)return;
    if(event.key==='Enter')submitPassword(event);
    else if(event.key==='Escape'){event.preventDefault();closeInput();showStatus('');trigger.focus({preventScroll:true});}
  });
  window.addEventListener('pagehide',()=>{
    activeTouch=null;unlocks.privateLock?.();closeInput();showStatus('');
  });
  window.QingyuanPrivateUnlock=Object.freeze({close(){activeTouch=null;closeInput();showStatus('');}});
})();
    
