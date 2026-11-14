
(() => {
  'use strict';
  const byId = id => document.getElementById(id);
  const overlay = byId('invite-overlay'), panel = byId('invite-panel');
  const image = byId('invite-card-image'), placeholder = byId('invite-placeholder');
  const status = byId('invite-status'), frame = byId('invite-card-frame');
  const saveButton = byId('invite-save'), shareButton = byId('invite-share');
  const retryButton = byId('invite-retry'), profileButton = byId('invite-personalize');
  const homeButton = byId('invite-home-open'), closeButton = byId('invite-close');
  const serif = '"Noto Serif SC", "STKaiti", "KaiTi", "Songti SC", "SimSun", serif';
  let hooks = {}, returnFocus = null, backToTasks = false, serial = 0;
  let card = null, qr = null, profile = null, busy = false, action = false, sdk = null;
  let capabilities = Object.create(null);

  function isOpen() { return !overlay.hidden; }
  function setStatus(message) { status.textContent = message; }
  function controls() {
    const ready = !!card && !busy && !action;
    saveButton.setAttribute('aria-disabled', String(!ready));
    saveButton.tabIndex = ready ? 0 : -1;
    shareButton.disabled = !ready;
    profileButton.disabled = !ready || typeof sdk?.getUserProfile !== 'function';
    profileButton.textContent = profile ? '更新我的昵称头像' : '使用我的昵称头像';
    retryButton.disabled = busy || action;
    frame.setAttribute('aria-busy', String(busy));
    if (ready) saveButton.href = card.dataUrl;
    else saveButton.removeAttribute('href');
  }
  function deadline(work, ms, message) {
    let timer;
    return Promise.race([
      Promise.resolve(work),
      new Promise((_, reject) => { timer = setTimeout(() => reject(new Error(message)), ms); })
    ]).finally(() => clearTimeout(timer));
  }
  function waitForSdk() {
    if (window.toy) return Promise.resolve(window.toy);
    return new Promise((resolve, reject) => {
      const script = byId('bilibili-toy-sdk');
      let timer;
      const clean = () => { clearTimeout(timer); script?.removeEventListener('load', loaded); script?.removeEventListener('error', failed); };
      const loaded = () => { clean(); window.toy ? resolve(window.toy) : reject(new Error('sdk')); };
      const failed = () => { clean(); reject(new Error('sdk')); };
      script?.addEventListener('load', loaded, {once:true});
      script?.addEventListener('error', failed, {once:true});
      timer = setTimeout(failed, 7000);
    });
  }
  async function supported(api, name) {
    if (typeof api?.[name] !== 'function') return false;
    if (typeof api.isSupport !== 'function') return true;
    try { return await deadline(api.isSupport(name), 5000, 'support') === true; }
    catch (_) { return false; }
  }
  function loadImage(src) {
    return new Promise((resolve, reject) => {
      const img = new Image();
      const timer = setTimeout(() => { img.onload = img.onerror = null; img.src = ''; reject(new Error('image')); }, 7000);
      if (!src.startsWith('data:')) img.crossOrigin = 'anonymous';
      img.onload = () => { clearTimeout(timer); resolve(img); };
      img.onerror = () => { clearTimeout(timer); reject(new Error('image')); };
      img.src = src;
    });
  }
  function roundRect(ctx, x, y, w, h, r) {
    ctx.beginPath();ctx.moveTo(x+r,y);ctx.arcTo(x+w,y,x+w,y+h,r);
    ctx.arcTo(x+w,y+h,x,y+h,r);ctx.arcTo(x,y+h,x,y,r);ctx.arcTo(x,y,x+w,y,r);ctx.closePath();
  }
  function sword(ctx, x, y, scale, rotation, color) {
    ctx.save();ctx.translate(x,y);ctx.rotate(rotation);ctx.scale(scale,scale);
    ctx.fillStyle=color;ctx.beginPath();ctx.moveTo(0,-75);ctx.lineTo(10,-47);ctx.lineTo(6,30);ctx.lineTo(-6,30);ctx.lineTo(-10,-47);ctx.closePath();ctx.fill();
    ctx.fillRect(-24,30,48,5);ctx.fillRect(-4,35,8,28);ctx.beginPath();ctx.arc(0,66,6,0,Math.PI*2);ctx.fill();
    ctx.strokeStyle='#fff9dc';ctx.lineWidth=1;ctx.beginPath();ctx.moveTo(0,-61);ctx.lineTo(0,25);ctx.stroke();ctx.restore();
  }
  function text(ctx, value, x, y, size, color, weight = 400, maxWidth = 760) {
    ctx.textAlign='center';ctx.fillStyle=color;
    const characters = Array.from(value);
    let label = characters.join(''), fontSize = size;
    ctx.font=weight+' '+fontSize+'px '+serif;
    while(ctx.measureText(label).width>maxWidth && fontSize>size*.78) { fontSize-=1;ctx.font=weight+' '+fontSize+'px '+serif; }
    while(ctx.measureText(label).width>maxWidth && characters.length) { characters.pop();label=characters.join('')+'…'; }
    ctx.fillText(label,x,y);
  }
  async function compose(qrImage, user) {
    let avatar = null;
    if (typeof user?.avatar === 'string' && user.avatar) {
      try {
        const src = new URL(user.avatar, location.href).href;
        if (/^https:\/\//.test(src) || /^data:image\/(png|jpeg|webp);base64,/.test(src)) avatar = await loadImage(src);
      } catch (_) { /* CORS/permission failures fall back to the sword seal, without tainting the canvas. */ }
    }
    const canvas=document.createElement('canvas');canvas.width=900;canvas.height=1200;
    const ctx=canvas.getContext('2d');
    if(!ctx)throw new Error('canvas');
    const background=ctx.createLinearGradient(0,0,900,1200);background.addColorStop(0,'#fffaf0');background.addColorStop(1,'#e9f3eb');
    ctx.fillStyle=background;ctx.fillRect(0,0,900,1200);
    ctx.strokeStyle='#adc9b7';ctx.lineWidth=2;roundRect(ctx,17,17,866,1166,38);ctx.stroke();
    ctx.strokeStyle='#d8dfcc';ctx.lineWidth=1;roundRect(ctx,25,25,850,1150,33);ctx.stroke();
    ctx.save();ctx.beginPath();ctx.arc(746,127,91,0,Math.PI*2);ctx.fillStyle='#ecdfb5';ctx.fill();
    ctx.beginPath();ctx.arc(772,105,82,0,Math.PI*2);ctx.fillStyle='#f9f8ec';ctx.fill();ctx.restore();
    sword(ctx,711,203,.94,.48,'#aac4ad');sword(ctx,776,231,.7,.48,'#c7d4ba');
    ctx.textAlign='left';ctx.fillStyle='#294a3a';ctx.font='700 68px '+serif;ctx.fillText('青元剑诀',65,118);
    ctx.fillStyle='#6e917b';ctx.font='19px Georgia, serif';ctx.fillText('Q I N G Y U A N  ·  S W O R D  A R T S',69,157);
    ctx.fillStyle='#bba266';ctx.fillRect(69,183,73,3);
    ctx.fillStyle='#6c8c76';ctx.font='24px '+serif;ctx.fillText('一纸剑帖 · 与君共赴青元',69,223);
    ctx.save();ctx.shadowColor='#356a4b18';ctx.shadowBlur=28;ctx.shadowOffsetY=12;ctx.fillStyle='#ffffff';roundRect(ctx,61,270,778,824,35);ctx.fill();ctx.restore();
    ctx.beginPath();ctx.arc(450,351,65,0,Math.PI*2);ctx.fillStyle='#eaf2e5';ctx.fill();
    ctx.save();ctx.beginPath();ctx.arc(450,351,57,0,Math.PI*2);ctx.clip();
    if(avatar){
      const side=Math.min(avatar.naturalWidth,avatar.naturalHeight);
      ctx.drawImage(avatar,(avatar.naturalWidth-side)/2,(avatar.naturalHeight-side)/2,side,side,393,294,114,114);
    }else sword(ctx,450,351,.6,.32,'#4f8b6b');
    ctx.restore();
    const nickname=typeof user?.nickname==='string' && user.nickname.trim() ? Array.from(user.nickname.trim()).slice(0,40).join('') : '一位青元道友';
    text(ctx,nickname,450,452,31,'#539074',600,670);
    text(ctx,'邀你来玩「青元剑诀」',450,514,45,'#263f32',700,710);
    text(ctx,'御剑乘风 · 一起共赴仙途',450,563,28,'#7c897c',400,710);
    ctx.save();ctx.shadowColor='#2b60481c';ctx.shadowBlur=22;ctx.shadowOffsetY=6;ctx.fillStyle='#fff';roundRect(ctx,214,595,472,451,27);ctx.fill();ctx.restore();
    // 384 px SDK image, drawn 1:1 with additional white space. No logo covers the QR modules.
    ctx.imageSmoothingEnabled=false;ctx.drawImage(qrImage,258,619,384,384);ctx.imageSmoothingEnabled=true;
    text(ctx,'哔哩哔哩扫一扫 · 即刻御剑',450,1070,25,'#568e75',600,700);
    text(ctx,'邀一位道友，同赏万剑归宗',450,1148,24,'#7b8e7c',400,750);
    const dataUrl=canvas.toDataURL('image/png');
    const blob=await new Promise((resolve,reject)=>canvas.toBlob(value=>value?resolve(value):reject(new Error('blob')),'image/png'));
    return {dataUrl,blob};
  }
  function invitePath() {
    // A receipt provider may supply a Toy-relative invitation path; its verification remains independent of sharing.
    const provider=window.QingyuanInvitationBridge;
    if(typeof provider?.getInvitePath==='function')return provider.getInvitePath();
    const match=location.pathname.match(/^\/toy\/[^/]+\/(.*)$/);
    return match?.[1] || 'index.html';
  }
  function showCard(next) {
    card=next;image.src=next.dataUrl;image.hidden=false;placeholder.hidden=true;
    setStatus('邀请卡准备好了，保存或分享给好友吧。');
  }
  function requestProfileFromClick() {
    const api=window.toy || sdk;
    if(typeof api?.getUserProfile!=='function')return null;
    try{
      // Keep this call in the invitation click itself; awaiting QR/SDK work first loses the user gesture.
      return deadline(api.getUserProfile(),30000,'profile').then(
        user=>({user:{nickname:user?.nickname,avatar:user?.avatar}}),
        ()=>({user:null})
      );
    }catch(_){return Promise.resolve({user:null});}
  }
  async function generate(profileRequest=null) {
    if(busy)return;
    const ticket=++serial;busy=true;action=false;card=null;qr=null;
    image.hidden=true;image.removeAttribute('src');placeholder.hidden=false;
    byId('invite-placeholder-text').textContent='正在生成当前 Toy 的邀请二维码…';
    setStatus(profileRequest?'请在 B站 弹窗中确认昵称头像授权；取消后也能生成普通邀请卡。':'正在生成邀请卡，请稍候。');controls();
    try{
      const api=await waitForSdk();
      if(ticket!==serial)return;
      sdk=api;
      const names=['getQrCode','saveImageToAlbum','sharePicture','share'];
      const support=await Promise.all(names.map(name=>supported(api,name)));
      if(ticket!==serial)return;
      capabilities=Object.fromEntries(names.map((name,i)=>[name,support[i]]));
      if(!capabilities.getQrCode)throw new Error('unsupported');
      const path=await deadline(invitePath(),7000,'path');
      if(ticket!==serial)return;
      const result=await deadline(api.getQrCode({path,size:384}),12000,'qrcode');
      if(ticket!==serial)return;
      // Official contract: base64 is the PNG data URL; url is the encoded Toy link, not an image URL.
      if(!/^data:image\/png;base64,[A-Za-z0-9+/=\s]+$/.test(result?.base64 || ''))throw new Error('image');
      const url=new URL(result.url);
      if(url.protocol!=='https:' || !/(^|\.)bilibili\.com$/i.test(url.hostname) || !/^\/toy\/[^/]+\//.test(url.pathname))throw new Error('url');
      const qrImage=await loadImage(result.base64);
      if(!qrImage.naturalWidth || qrImage.naturalWidth!==qrImage.naturalHeight)throw new Error('image');
      const resultProfile=profileRequest ? await profileRequest : null;
      if(ticket!==serial)return;
      const next=await compose(qrImage,resultProfile?.user || profile);
      if(ticket!==serial)return;
      if(resultProfile?.user)profile=resultProfile.user;
      qr={image:qrImage,url:result.url,path};showCard(next);
      if(profileRequest && !resultProfile?.user)setStatus('已生成普通邀请卡，仍可保存和分享；也可点击“使用我的昵称头像”重新授权。');
    }catch(_){
      if(ticket!==serial)return;
      byId('invite-placeholder-text').textContent='请在已发布的 B站 Toy 页面中打开后生成。网络恢复后可点击“重新生成”。';
      setStatus('邀请卡暂时无法生成，请确认已在 B站 Toy 中打开，再重试。');
    }finally{
      if(ticket===serial){busy=false;controls();}
    }
  }
  function open() {
    if(isOpen())return;
    returnFocus=document.activeElement;backToTasks=window.QingyuanUnlocks?.isOpen===true;
    overlay.hidden=false;homeButton.setAttribute('aria-expanded','true');
    window.QingyuanUnlocks?.close(false);window.QingyuanAuthorPromo?.close(false);
    hooks.onOpen?.();closeButton.focus({preventScroll:true});
    const profileRequest=profile ? null : requestProfileFromClick();
    if(card){
      if(profileRequest)void personalize(profileRequest);
      else{setStatus('邀请卡准备好了，保存或分享给好友吧。');controls();}
    }else void generate(profileRequest);
  }
  function close(restoreFocus=true) {
    if(!isOpen())return;
    ++serial;busy=false;action=false;overlay.hidden=true;homeButton.setAttribute('aria-expanded','false');
    hooks.onClose?.();
    if(restoreFocus && backToTasks)window.QingyuanUnlocks?.open('inspect');
    if(restoreFocus)(returnFocus?.isConnected && !returnFocus.closest('[hidden]') ? returnFocus : homeButton).focus?.({preventScroll:true});
    backToTasks=false;controls();
  }
  async function personalize(profileRequest=null) {
    if(!card || busy || action)return;
    const request=profileRequest || requestProfileFromClick();
    if(!request)return;
    const ticket=serial;action=true;setStatus('确认授权后，将昵称和头像放入邀请卡。');controls();
    try{
      const result=await request;
      const user=result?.user;
      if(!user)throw new Error('profile');
      if(ticket!==serial)return;
      const next=await compose(qr.image,user);
      if(ticket!==serial)return;
      // Deliberately retain only presentation fields. toyOpenId is not needed for QR generation or exports.
      profile=user;showCard(next);
    }catch(_){if(ticket===serial)setStatus('未获取到昵称头像，仍可保存和分享当前邀请卡。');}
    finally{if(ticket===serial){action=false;controls();}}
  }
  function isCancelled(error) {
    return error?.name==='AbortError' || /cancel|canceled|cancelled|取消/i.test(String(error?.type || '')+' '+String(error?.message || ''));
  }
  async function save(event) {
    if(!card || busy || action){event.preventDefault();return;}
    if(!capabilities.saveImageToAlbum){setStatus('已发起图片下载；手机也可长按邀请卡保存。');return;}
    event.preventDefault();const ticket=serial;action=true;controls();
    try{
      await deadline(sdk.saveImageToAlbum({base64Data:card.dataUrl,hintMsg:'保存青元剑诀邀请卡，发送给好友一起御剑'}),30000,'save');
      if(ticket===serial)setStatus('邀请卡已保存到相册，可以发送给好友了。');
    }catch(error){if(ticket===serial)setStatus(isCancelled(error)?'已取消保存，邀请卡仍可长按保存。':'未能保存到相册，请长按上方邀请卡保存。');}
    finally{if(ticket===serial){action=false;controls();}}
  }
  async function copyText(value) {
    try{if(navigator.clipboard?.writeText){await navigator.clipboard.writeText(value);return true;}}catch(_){}
    const input=document.createElement('textarea');input.value=value;input.readOnly=true;
    input.style.cssText='position:fixed;left:-9999px;top:0;user-select:text;-webkit-user-select:text;';panel.appendChild(input);
    let copied=false;
    try{input.select();input.setSelectionRange(0,value.length);copied=document.execCommand('copy')===true;}catch(_){}
    finally{input.remove();if(isOpen())shareButton.focus({preventScroll:true});}
    return copied;
  }
  async function share() {
    if(!card || busy || action)return;
    const ticket=serial;action=true;controls();
    try{
      if(capabilities.sharePicture){
        await deadline(sdk.sharePicture({base64Data:card.dataUrl}),30000,'share');
        if(ticket===serial)setStatus('分享面板已关闭；邀请成功后可回任务页刷新进度。');
        return;
      }
      if(typeof File==='function' && typeof navigator.canShare==='function' && typeof navigator.share==='function'){
        const file=new File([card.blob],'青元剑诀-邀请卡.png',{type:'image/png'});
        if(navigator.canShare({files:[file]})){
          await navigator.share({files:[file],title:'青元剑诀 · 邀请你一起御剑'});
          if(ticket===serial)setStatus('分享操作已完成，可回任务页查看邀请进度。');return;
        }
      }
      if(typeof ClipboardItem==='function' && typeof navigator.clipboard?.write==='function'){
        try{
          await navigator.clipboard.write([new ClipboardItem({'image/png':card.blob})]);
          if(ticket===serial)setStatus('邀请卡图片已复制，去聊天窗口粘贴发送给好友吧。');return;
        }catch(_){}
      }
      if(capabilities.share){
        await deadline(sdk.share({path:qr.path}),30000,'share');
        if(ticket===serial)setStatus('分享面板已关闭，也可保存邀请卡发送给好友。');return;
      }
      const copied=await copyText(qr.url);
      if(ticket===serial)setStatus(copied?'邀请链接已复制，可以粘贴分享；图片可点“保存邀请卡”。':'当前环境无法复制，请保存邀请卡后发送给好友。');
    }catch(error){if(ticket===serial)setStatus(isCancelled(error)?'已取消分享，邀请卡仍可保存或再次分享。':'暂时无法分享，请保存邀请卡后发送给好友。');}
    finally{if(ticket===serial){action=false;controls();}}
  }
  homeButton.addEventListener('click',event=>{event.stopPropagation();open();});
  closeButton.addEventListener('click',()=>close());
  overlay.addEventListener('click',event=>{if(event.target===overlay)close();});
  retryButton.addEventListener('click',()=>{void generate();});
  profileButton.addEventListener('click',()=>{void personalize();});
  saveButton.addEventListener('click',event=>{void save(event);});
  shareButton.addEventListener('click',()=>{void share();});
  window.addEventListener('keydown',event=>{
    if(!isOpen())return;
    event.stopImmediatePropagation();
    if(event.key==='Escape'){event.preventDefault();close();return;}
    if(event.key==='Tab'){
      const items=[...panel.querySelectorAll('button:not([disabled]),a[href]')].filter(node=>!node.closest('[hidden]') && node.getAttribute('aria-disabled')!=='true');
      const first=items[0],last=items.at(-1),active=document.activeElement;
      if(!first){event.preventDefault();panel.focus();return;}
      if(!panel.contains(active)){event.preventDefault();(event.shiftKey?last:first).focus();}
      else if(event.shiftKey && active===first){event.preventDefault();last.focus();}
      else if(!event.shiftKey && active===last){event.preventDefault();first.focus();}
    }
  },{capture:true});
  window.QingyuanInvitation=Object.freeze({open,close,get isOpen(){return isOpen();},setHooks(next){hooks=next||{};if(isOpen())hooks.onOpen?.();}});
  controls();
})();

    
