
      async function initQingyuanToy() {
        const startup=window.QingyuanLoading;
        await startup?.step(62,'正在唤醒御剑灵力…');
        function smoothstep(edge0, edge1, x) {
          const t = THREE.MathUtils.clamp((x - edge0) / (edge1 - edge0), 0.0, 1.0);
          return t * t * (3.0 - 2.0 * t);
        }

        // The app has its own logical viewport. CSS rotation is available even
        // in embedded/iOS browsers that reject native orientation locking.
        const appStage=document.getElementById('app-stage');
        const toyBridge=window.QingyuanToyBridge;
        const unlocks=window.QingyuanUnlocks;
        const formationUnlockFeature=Object.freeze({DAGENG:'dageng',THUNDER_DRAGON:'dragon',GIANT:'giant',LOTUS:'lotus'});
        const APP_VIEW={width:1,height:1,physicalWidth:1,physicalHeight:1,offsetX:0,offsetY:0,rotation:0,requested:'auto'};
        let orientationRequestSerial=0;
        function measureAppViewport(){
          const visual=window.visualViewport;
          const containerState=toyBridge.state;
          const width=Math.max(1,Math.round(containerState?.viewport.width||visual?.width||window.innerWidth));
          const height=Math.max(1,Math.round(containerState?.viewport.height||visual?.height||window.innerHeight));
          const physicalLandscape=width>=height;
          const landscape=APP_VIEW.requested==='auto'?physicalLandscape:APP_VIEW.requested==='landscape';
          APP_VIEW.physicalWidth=width;APP_VIEW.physicalHeight=height;
          APP_VIEW.offsetX=containerState?0:visual?.offsetLeft||0;APP_VIEW.offsetY=containerState?0:visual?.offsetTop||0;
          APP_VIEW.rotation=landscape===physicalLandscape?0:landscape?90:-90;
          APP_VIEW.width=APP_VIEW.rotation?height:width;APP_VIEW.height=APP_VIEW.rotation?width:height;
          appStage.style.width=APP_VIEW.width+'px';appStage.style.height=APP_VIEW.height+'px';
          appStage.style.left=(APP_VIEW.offsetX+width/2)+'px';appStage.style.top=(APP_VIEW.offsetY+height/2)+'px';
          appStage.style.transform='translate(-50%, -50%) rotate('+APP_VIEW.rotation+'deg)';
          appStage.style.setProperty('--app-width',APP_VIEW.width+'px');appStage.style.setProperty('--app-height',APP_VIEW.height+'px');
          appStage.classList.toggle('is-landscape',landscape);appStage.classList.toggle('is-portrait',!landscape);
          if(containerState){
            const safe=containerState.safeArea;
            const sides=APP_VIEW.rotation===90?[safe.right,safe.bottom,safe.left,safe.top]:
              APP_VIEW.rotation===-90?[safe.left,safe.top,safe.right,safe.bottom]:
              [safe.top,safe.right,safe.bottom,safe.left];
            ['top','right','bottom','left'].forEach((side,i)=>appStage.style.setProperty('--app-safe-'+side,sides[i]+'px'));
          }
          const button=document.getElementById('screen-orientation-button');
          button.textContent=appStage.classList.contains('mobile-layout')?(landscape?'↻ 竖屏':'↻ 横屏'):(landscape?'↻ 切换竖屏':'↻ 切换横屏');
          button.setAttribute('aria-label',landscape?'切换为手机竖屏':'切换为手机横屏');
        }
        function toAppPoint(clientX,clientY){
          const x=clientX-APP_VIEW.offsetX-APP_VIEW.physicalWidth/2,y=clientY-APP_VIEW.offsetY-APP_VIEW.physicalHeight/2;
          const angle=APP_VIEW.rotation*Math.PI/180,c=Math.cos(angle),s=Math.sin(angle);
          return {x:c*x+s*y+APP_VIEW.width/2,y:-s*x+c*y+APP_VIEW.height/2};
        }
        function resizeAppViewport(){
          stopWebcamDrag();
          measureAppViewport();camera.aspect=APP_VIEW.width/APP_VIEW.height;camera.updateProjectionMatrix();
          inspectionCamera.aspect=camera.aspect;inspectionCamera.updateProjectionMatrix();renderer.setSize(APP_VIEW.width,APP_VIEW.height);
          resetTouchPinch();syncCameraOrientation();
          const device=toyBridge.state?.deviceType;
          const mobileLayout=device==='phone'||device==='tablet'||isMobile||APP_VIEW.width<768;
          appStage.classList.toggle('mobile-layout',mobileLayout);
          document.getElementById('screen-orientation-button').hidden=!mobileLayout;
          if(typeof syncRenderPerformance==='function')syncRenderPerformance();
        }
        async function tryNativeOrientation(target,serial){
          if(toyBridge.canControlContainer){
            try{await toyBridge.setContainerMode({orientation:target,immersive:target==='landscape'});}
            catch(error){console.warn('Toy orientation request failed:',error);}
            // A request resolving is not a state acknowledgement. Layout follows actual viewport notifications.
            if(serial===orientationRequestSerial)resizeAppViewport();
            return;
          }
          if(toyBridge.sdkAvailable||toyBridge.isPlatformPage)return;
          const orientation=window.screen?.orientation;if(typeof orientation?.lock!=='function')return;
          try{
            const root=document.documentElement,request=root?.requestFullscreen||root?.webkitRequestFullscreen;
            if(!document.fullscreenElement&&!document.webkitFullscreenElement&&request){
              try{await request.call(root);}catch(_){/* Keep the working CSS viewport. */}
            }
            if(serial!==orientationRequestSerial)return;
            await orientation.lock(target);
          }catch(_){/* Sandboxed viewers and unsupported locks use CSS rotation. */}
          finally{if(serial===orientationRequestSerial)resizeAppViewport();}
        }
        measureAppViewport();

        const isMobile =
          /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent) ||
          APP_VIEW.width < 768;
        appStage.classList.toggle('mobile-layout',isMobile);

        // Shared sculpting helpers. Deterministic details, no external assets.
        let craftSeed = 72419;
        function craftRandom() {
          craftSeed = (Math.imul(craftSeed, 1664525) + 1013904223) >>> 0;
          return craftSeed / 4294967296;
        }

        function createStudioEnvironment() {
          const faces = [];
          for (let i = 0; i < 6; i++) {
            const canvas = document.createElement('canvas');
            canvas.width = canvas.height = 128;
            const ctx = canvas.getContext('2d');
            const g = ctx.createLinearGradient(0, 0, 0, 128);
            g.addColorStop(0, '#92aec6');
            g.addColorStop(0.35, '#465f74');
            g.addColorStop(0.52, '#182738');
            g.addColorStop(0.72, '#2d291f');
            g.addColorStop(1, '#070d15');
            ctx.fillStyle = g; ctx.fillRect(0, 0, 128, 128);
            if (i !== 3) {
              const strip = ctx.createLinearGradient(6, 0, 52, 0);
              strip.addColorStop(0, 'rgba(210,227,245,0)');
              strip.addColorStop(.5, 'rgba(210,227,245,.75)');
              strip.addColorStop(1, 'rgba(210,227,245,0)');
              ctx.fillStyle = strip; ctx.fillRect(6, 10, 46, 75);
            }
            faces.push(canvas);
          }
          const texture = new THREE.CubeTexture(faces);
          texture.encoding = THREE.sRGBEncoding;
          texture.needsUpdate = true;
          return texture;
        }

        function batchStaticModel(root, preserve = [], physicalOnly = false) {
          root.updateMatrixWorld(true);
          const inverseRoot = new THREE.Matrix4().copy(root.matrixWorld).invert();
          const batches = new Map(), removals = [];
          function visit(node) {
            if (preserve.includes(node)) return;
            if (node.isMesh && !node.isInstancedMesh && !Array.isArray(node.material)
                && (!physicalOnly || !node.material.isShaderMaterial)) {
              const material = node.material;
              const geometry = node.geometry.clone();
              geometry.applyMatrix4(new THREE.Matrix4().multiplyMatrices(inverseRoot, node.matrixWorld));
              const g = geometry.index ? geometry.toNonIndexed() : geometry;
              if (!g.attributes.normal) g.computeVertexNormals();
              if (!batches.has(material.uuid)) batches.set(material.uuid, {material, p:[], n:[], uv:[], colors:[], hasColor:false});
              const batch = batches.get(material.uuid);
              const p = g.attributes.position, n = g.attributes.normal, uv = g.attributes.uv, color = g.attributes.color;
              for (let k = 0; k < p.count; k++) {
                batch.p.push(p.getX(k), p.getY(k), p.getZ(k));
                batch.n.push(n.getX(k), n.getY(k), n.getZ(k));
                batch.uv.push(uv ? uv.getX(k) : 0, uv ? uv.getY(k) : 0);
                batch.colors.push(color ? color.getX(k) : 1, color ? color.getY(k) : 1, color ? color.getZ(k) : 1);
              }
              batch.hasColor ||= !!color;
              if (g !== geometry) g.dispose();
              geometry.dispose();
              removals.push(node);
            } else {
              [...node.children].forEach(visit);
            }
          }
          [...root.children].forEach(visit);
          removals.forEach(node => {node.parent.remove(node); node.geometry.dispose();});
          batches.forEach(batch => {
            const geometry = new THREE.BufferGeometry();
            geometry.setAttribute('position', new THREE.Float32BufferAttribute(batch.p, 3));
            geometry.setAttribute('normal', new THREE.Float32BufferAttribute(batch.n, 3));
            geometry.setAttribute('uv', new THREE.Float32BufferAttribute(batch.uv, 2));
            if (batch.hasColor) geometry.setAttribute('color', new THREE.Float32BufferAttribute(batch.colors, 3));
            geometry.computeBoundingSphere();
            const mesh = new THREE.Mesh(geometry, batch.material);
            mesh.name = '雕刻细节合批';
            mesh.castShadow = !batch.material.transparent;
            mesh.receiveShadow = !batch.material.transparent;
            root.add(mesh);
          });
          return root;
        }

        function craftTube(points, radius, material, segments = 12, radial = 6) {
          const curve = new THREE.CatmullRomCurve3(points.map(p => p.isVector3 ? p : new THREE.Vector3(...p)));
          return new THREE.Mesh(new THREE.TubeGeometry(curve, segments, radius, radial, false), material);
        }

        function createChippedRockGeometry(radius) {
          const geo=new THREE.SphereGeometry(radius,isMobile?32:64,isMobile?24:44),p=geo.attributes.position;
          for(let k=0;k<p.count;k++){
            const x=p.getX(k),y=p.getY(k),z=p.getZ(k);
            const rough=1+Math.sin(x*.67+y*.43-z*.32)*.09+Math.sin(y*1.6-z*.72)*.045+Math.cos(x*2.1+z)*.025;
            p.setXYZ(k,x*rough,y*rough,z*rough);
          }
          geo.computeVertexNormals();return geo;
        }

        function createManeTuftGeometry(width, height) {
          const geo=new THREE.PlaneGeometry(width,height,4,12),p=geo.attributes.position,uv=geo.attributes.uv;
          for(let k=0;k<p.count;k++){
            const t=uv.getY(k),across=uv.getX(k);
            p.setXYZ(k,(across-.5)*width*Math.pow(Math.sin(t*Math.PI)*.94+.06,.6),t*height,-t*t*height*.25);
            uv.setXY(k,t,across);
          }
          geo.computeVertexNormals();return geo;
        }

        function createArmorScaleGeometry() {
          const outline = [[0,-.50],[-.31,-.43],[-.48,-.16],[-.49,.14],[-.32,.42],[0,.65],[.32,.42],[.49,.14],[.48,-.16],[.31,-.43]];
          const p = [], uv = [], indices = [];
          for (let ring = 0; ring < 3; ring++) {
            const k = [1,.76,.35][ring], height = [0,.095,.155][ring];
            outline.forEach(([x,z]) => {p.push(x*k,height,z*k);uv.push(x*k+.5,z*k*.8+.45);});
          }
          p.push(0,.18,0); uv.push(.5,.45);
          for (let ring = 0; ring < 2; ring++) for (let j=0;j<10;j++) {
            const a=ring*10+j,b=ring*10+(j+1)%10,c=a+10,d=b+10;
            indices.push(a,c,b,b,c,d);
          }
          for (let j=0;j<10;j++) indices.push(20+j,30,20+(j+1)%10);
          const g = new THREE.BufferGeometry();
          g.setAttribute('position',new THREE.Float32BufferAttribute(p,3));
          g.setAttribute('uv',new THREE.Float32BufferAttribute(uv,2));
          g.setIndex(indices); g.computeVertexNormals();
          // Outline order is clockwise in XZ, yielding outward +Y normals.
          if (g.attributes.normal.getY(30)<0) {
            for(let k=0;k<indices.length;k+=3){const t=indices[k+1];indices[k+1]=indices[k+2];indices[k+2]=t;}
            g.setIndex(indices);g.computeVertexNormals();
          }
          return g;
        }

        function beveledBox(width, height, depth, bevel = .04) {
          const shape = new THREE.Shape();
          shape.moveTo(-width/2,-height/2);shape.lineTo(width/2,-height/2);
          shape.lineTo(width/2,height/2);shape.lineTo(-width/2,height/2);shape.closePath();
          const geo = new THREE.ExtrudeGeometry(shape,{depth,bevelEnabled:true,bevelSize:bevel,bevelThickness:bevel,bevelSegments:2,steps:1,curveSegments:1});
          geo.translate(0,0,-depth/2);return geo;
        }


        const CONFIG = {
          mainSwordCount: 72,       // 72把本命青竹蜂云剑主剑
          shadowsPerMain: 4,        // 每把主剑分化4道半透明淡绿剑影
          shadowSwordCount: 288,    // 共288道剑影
          swordCount: 360,          // 合共360口飞剑组成大庚剑阵
          pathHistoryLength: 680,   // 加长轨迹队列容量以支撑更修长的剑流
          maxSpeed: 38,             // 巡航基础速度（给剑流留出自然的加速段）
          navigationSpeed: 32,      // 三维巡航速度；Shift 加速至两倍
          sprintSpeed: 86,          // 疾行追击速度（保留冲刺感，减少瞬移感）
          steerForce: 112,          // 转向牵引力（让剑身有可见的弧线与惯性）
          flightBank: 0.56,         // 高速转弯时的剑身侧倾幅度
          followHeadLag: 2.1,        // 领头剑也沿轨迹取样，避免少数剑直接贴住鼠标
          followTrailSpacing: 3.05,   // 增大主剑的轨迹层间距，让剑流呼吸更开阔
          shadowTrailLag: 6.8,        // 剑影相对主剑的额外滞后
          followWidthMultiplier: 0.86, // 轻微扩大横向层次，保留每口剑的可见轮廓
          followLengthMultiplier: 1.58, // 延长纵向取样间隔，让剑与剑之间更松弛
          followSpeedMultiplier: 1.5,   // 剑影分光飞行速度提高50%
          separationDist: 2.6,
          separationForce: 5.6,
          noiseScale: 0.28,
          noiseStrength: 1.0,
          shieldRadius: 24,
          shieldOrbitSpeed: 2.2,
          lotusRadius: 28,
          lotusRotateSpeed: 0.42,
          dagengRadius: 30,
          dagengHeight: 22,
          dagengRotateSpeed: 0.22,
        };

        // 阵盘先显形，飞剑延续原有惯性并分批入阵；二者不共享到位判定。
        const LOTUS_TIMING = Object.freeze({
          discReveal: 0.60,
          swordLaunch: 0.10,
          swordFlight: 2.00,
          swordStagger: 0.28,
          shadowStagger: 0.045,
          inertiaDamping: 1.40,
        });
        const LOTUS_ASSEMBLY_END = LOTUS_TIMING.swordLaunch + LOTUS_TIMING.swordFlight
          + LOTUS_TIMING.swordStagger + CONFIG.shadowsPerMain * LOTUS_TIMING.shadowStagger;

        // 先引剑入阵，临近阵位再逐口融合；巨剑随实际汇入的剑数长大。
        const GIANT_TIMING = Object.freeze({
          launch: .10,
          flight: 1.75,
          groupStagger: .045,
          swordStagger: .055,
          shadowStagger: .018,
          inertiaDamping: 1.80,
        });
        const GIANT_ASSEMBLY_END = GIANT_TIMING.launch + GIANT_TIMING.flight
          + 7 * GIANT_TIMING.groupStagger + 8 * GIANT_TIMING.swordStagger
          + CONFIG.shadowsPerMain * GIANT_TIMING.shadowStagger;

        const STATE = {
          gestureMode: 'DRAGON',
          lastMode: 'DRAGON',
          swordFingerMode: 'DRAGON', // 记录剑指当前绑定的招式：'DRAGON' 或 'THUNDER_DRAGON'
          modeStartTime: 0,
          controlMode: 'MOUSE', // 默认键鼠立即可控，可随时切换 HAND
          isTracking: true,
          showWebcam: true,
          inspectMode: false,
          lightningAmount: 2.0,
          lightTransparency: .85,
          spinRPM: 24,
          swordQiEnabled: false,
          zoomFactor: 1,
          breathHeld: false,
          splitEnabled: false,
          retainMainSwordsWhenSplitOff: false, // 关闭分光后保留72把主剑，或仅保留一把本命剑
          lightningEnabled: false, // 未解锁的开关默认关闭；解锁后也由玩家自行开启
          pointerNDC: new THREE.Vector2(0, 0),
          prevPointerNDC: new THREE.Vector2(0, 0),
          targetPosition: new THREE.Vector3(0, 0, 0),
          prevTargetPosition: new THREE.Vector3(0, 0, 0),
          dragonSpeed: 0,
          stationaryWeight: 1.0,
          dragonStreamProgress: 0.0, // 0.0 = 归一成单把本命剑，1.0 = 完全展开为浩瀚剑流
          orbitEnergy: 0.0,          // 飞行积蓄的惯性势能，决定急停时飞过头的距离与环绕半径
          orbitSpinDir: 1.0,         // 飞过头后的盘旋环绕旋向（+1 或 -1）
          motionIdleTime: Infinity, // 输入短暂间隔不会触发停止与惯性释放
          wasStationary: true,       // 用于捕捉“刚停下”的单帧，给剑流一次惯性释放
          inertiaRelease: 0.0,       // 0 = 已进入收束，1 = 刚停止移动
          lastMovingSpeed: 0.0,      // 停止前的输入速度，用来估算释放冲量
          inertiaDirection: new THREE.Vector3(1, 0, 0),
          zoomOffset: 0,
          pathHistory: Array.from({ length: CONFIG.pathHistoryLength }, (_, idx) =>
            new THREE.Vector3(-idx * 0.52, Math.sin(idx * 0.15) * 0.6, 0)
          ),
          lastDirection: new THREE.Vector3(1, 0, 0),
          keys: { left: false, KeyQ: false, KeyE: false, KeyR: false, KeyT: false, KeyF: false },
          flight: {
            offset: new THREE.Vector3(),
            velocity: new THREE.Vector3(),
            delta: new THREE.Vector3(),
            keys: new Set(),
          },
          look: {
            yaw:0,pitch:0,currentYaw:0,currentPitch:0,
            pendingAngle:0,frameAngle:0,dragging:false,dragButton:-1,centered:false,
            lastX:0,lastY:0,requesting:false,wantLock:false,wasLocked:false,ignoreEscapeUntil:0,
          },
          manualPinnedMode: null,
        };

        // 剑流飞舞使用上传的原始录音，短音按飞行节奏衔接，避免叠加旧剑风与挥剑采样。
        // 素材与许可见 qingyuan-sfx-bank.credits；运行时只播放采样，不产生提示音式振荡声。
        function createSwordAudio() {
          const clamp=(v,min=0,max=1)=>Math.max(min,Math.min(max,v));
          const toggle=document.getElementById('toggle-sound-btn'),slider=document.getElementById('sound-volume');
          const output=document.getElementById('sound-volume-value'),status=document.getElementById('sound-status');
          const voices=new Set(),targets=new WeakMap(),buffers=new Map();
          const userCastModes=new Set(['DAGENG','SHIELD','LOTUS']);
          const sustainedFormationModes=new Set(['DAGENG','SHIELD']);
          let context=null,master=null,dry=null,castBus=null,layers=null,enabled=false,volume=.65;
          let paused=false,focused=true,unavailable=false,cues=[],cueIndex=0;
          let moving=false,breathing=false;
          let nextSwish=0,nextOrbit=0,nextFormationClash=0,formationSoundUntil=0;
          try {
            const saved=JSON.parse(localStorage.getItem('qingyuan-sound-v1')||'null');
            // 每次打开都保持静音，仅恢复音量；旧的开启偏好不自动开启声音。
            if(saved&&Number.isFinite(saved.volume))volume=clamp(saved.volume);
          }catch(_){}
          function save(){try{localStorage.setItem('qingyuan-sound-v1',JSON.stringify({volume}));}catch(_){}}
          function syncUI(){
            const muted=!enabled||volume===0;
            toggle.textContent=unavailable?'音效不可用':muted?'音效：关':'音效：开';
            toggle.classList.toggle('sound-muted',muted);toggle.setAttribute('aria-pressed',String(!muted));
            toggle.setAttribute('aria-label',muted?'开启仙侠舞剑音效':'静音所有招式音效');
            toggle.title=muted?'点击开启仙侠舞剑音效':'剑流掠空与三式剑阵 · 使用上传音频；点击静音';
            toggle.disabled=slider.disabled=unavailable;
            slider.value=Math.round(volume*100);output.textContent=Math.round(volume*100)+'%';
            status.textContent=unavailable?'此浏览器暂不支持音效，可继续御剑。':muted?'音效已关闭，点击“音效：关”开启':context?.state==='running'?'随剑而鸣 · 飞剑掠空':'首次点击画面或按键，启用仙侠舞剑音效';
          }
          function target(param,value,seconds=.08){
            if(targets.has(param)&&Math.abs(targets.get(param)-value)<.0001)return;
            targets.set(param,value);param.setTargetAtTime(value,context.currentTime,seconds);
          }
          function audible(){return !unavailable&&context?.state==='running'&&enabled&&volume>0&&!paused&&focused&&!document.hidden;}
          function updateMaster(){if(master)target(master.gain,enabled&&!paused&&focused&&!document.hidden?Math.pow(volume,.95)*.8:0,.025);}
          function stopVoices(match=null){
            for(const voice of [...voices]){
              if(match&&voice.bus!==match&&voice.category!==match)continue;
              voice.gain.gain.cancelScheduledValues(context.currentTime);
              voice.gain.gain.setTargetAtTime(0,context.currentTime,.018);
              try{voice.source.stop(context.currentTime+.085);}catch(_){}
            }
          }
          function newCastBus(){
            if(castBus){
              const old=castBus;stopVoices(old);old.gain.setTargetAtTime(0,context.currentTime,.025);
              if(![...voices].some(v=>v.bus===old))old.disconnect();
            }
            castBus=context.createGain();castBus.connect(dry);
          }
          function unpackSamples(){
            const bank=JSON.parse(document.getElementById('qingyuan-sfx-bank').textContent);
            const inflate=window.fflate||globalThis.fflate;
            if(!inflate?.gunzipSync)throw new Error('Embedded audio decoder unavailable');
            for(const [name,clip]of Object.entries(bank.clips)){
              const binary=atob(clip.data),packed=new Uint8Array(binary.length);
              for(let i=0;i<binary.length;i++)packed[i]=binary.charCodeAt(i);
              const bytes=inflate.gunzipSync(packed),pcm=new DataView(bytes.buffer,bytes.byteOffset,bytes.byteLength);
              if(bytes.byteLength!==clip.frames*clip.channels*2)throw new Error('Invalid embedded sound: '+name);
              const buffer=context.createBuffer(clip.channels,clip.frames,clip.sampleRate||bank.sampleRate);
              for(let c=0;c<clip.channels;c++){
                const data=buffer.getChannelData(c);
                for(let i=0;i<clip.frames;i++)data[i]=pcm.getInt16((i*clip.channels+c)*2,true)/32768;
              }
              buffers.set(name,buffer);
            }
          }
          function continuous(name,cutoff=9000){
            const source=context.createBufferSource(),filter=context.createBiquadFilter(),gain=context.createGain();
            const pan=context.createStereoPanner?context.createStereoPanner():context.createGain();
            source.buffer=buffers.get(name);source.loop=true;filter.type='lowpass';filter.frequency.value=cutoff;
            gain.gain.value=0;source.connect(filter);filter.connect(gain);gain.connect(pan);pan.connect(dry);source.start();
            return{source,filter,gain,pan};
          }
          function initialize(){
            const AudioContextClass=window.AudioContext||window.webkitAudioContext;
            if(!AudioContextClass)throw new Error('Web Audio unavailable');
            context=new AudioContextClass({latencyHint:'interactive'});
            master=context.createGain();master.gain.value=0;dry=context.createGain();dry.connect(master);
            const limiter=context.createDynamicsCompressor();
            limiter.threshold.value=-12;limiter.knee.value=12;limiter.ratio.value=4;
            limiter.attack.value=.003;limiter.release.value=.23;
            master.connect(limiter);limiter.connect(context.destination);
            unpackSamples();
            layers={breath:continuous('breath_loop',10500)};
            newCastBus();context.addEventListener('statechange',syncUI);updateMaster();
          }
          async function unlock(){
            focused=true;if(!enabled||unavailable||document.hidden)return;
            try{
              if(!context)initialize();updateMaster();
              if(context.state!=='running')await context.resume();
              if(context.state==='running'){
                const source=context.createBufferSource();source.buffer=context.createBuffer(1,1,context.sampleRate);
                source.connect(context.destination);source.onended=()=>source.disconnect();source.start();
              }
            }catch(_){if(!layers){unavailable=true;void context?.close().catch(()=>{});}}
            finally{syncUI();}
          }
          function play(name,{gain=.6,rate=1,pan=0,endPan=pan,delay=0,duration=0,category='cast',offset=0}={}){
            if(!audible()||voices.size>=32)return;
            const buffer=buffers.get(name);if(!buffer)return;
            rate=clamp(rate,.45,1.7);offset=clamp(offset,0,Math.max(0,buffer.duration-.04));
            const length=Math.min(duration||Infinity,(buffer.duration-offset)/rate);
            const start=context.currentTime+Math.max(0,delay),finish=start+length;
            const source=context.createBufferSource(),level=context.createGain();
            const panner=context.createStereoPanner?context.createStereoPanner():context.createGain();
            source.buffer=buffer;source.playbackRate.value=rate;
            level.gain.setValueAtTime(0,start);level.gain.linearRampToValueAtTime(gain,start+.006);
            level.gain.setValueAtTime(gain,Math.max(start+.006,finish-.09));level.gain.linearRampToValueAtTime(0,finish);
            if(panner.pan){panner.pan.setValueAtTime(clamp(pan,-.85,.85),start);panner.pan.linearRampToValueAtTime(clamp(endPan,-.85,.85),start+Math.min(.55,length));}
            source.connect(level);level.connect(panner);panner.connect(castBus);
            const item={source,gain:level,bus:castBus,category};voices.add(item);
            source.onended=()=>{
              source.disconnect();level.disconnect();panner.disconnect();voices.delete(item);
              if(item.bus!==castBus&&![...voices].some(v=>v.bus===item.bus))item.bus.disconnect();
            };
            source.start(start,offset);source.stop(finish+.012);
          }
          function swipe(gain=.35,speed=.5,pan=0){
            // 完整播放本次上传的掠空录音；补偿较高原始响度，轻微变速与横向掠过。
            play('flight_user',{gain:gain*.5,rate:.96+clamp(speed)*.10,pan:pan-.22,endPan:pan+.22,category:'flight'});
          }
          function formation(mode,previous='DRAGON'){
            cueIndex=0;moving=breathing=false;formationSoundUntil=nextOrbit=nextFormationClash=0;
            // 各剑阵起手使用对应上传录音，展开音效完整播放一次。
            cues=mode==='GIANT'?Array.from({length:8},(_,i)=>[
                GIANT_TIMING.launch+GIANT_TIMING.flight+i*GIANT_TIMING.groupStagger+8*GIANT_TIMING.swordStagger,
                ()=>play('giant_merge',{gain:.27,rate:.78+i*.035,pan:(i/7-.5)*1.4})
              ]).concat([[GIANT_ASSEMBLY_END,()=>play('giant_lock',{gain:.85})]])
              :mode==='THUNDER_DRAGON'?[[.42,()=>play('thunder_hit',{gain:.35,rate:.85})]]:[];
            if(!audible()){cueIndex=cues.length;return;}
            newCastBus();target(layers.breath.gain.gain,0,.05);
            const userCast=userCastModes.has(mode);
            const entries={LOTUS:'formation_user',SHIELD:'formation_user',DAGENG:'dageng_open_user',GIANT:'giant_gather',THUNDER_DRAGON:'dragon_call'};
            if(userCast){
              formationSoundUntil=context.currentTime+buffers.get(entries[mode]).duration;
            }
            nextSwish=context.currentTime+.2;
            nextOrbit=nextFormationClash=formationSoundUntil;
            if(entries[mode])play(entries[mode],{gain:userCast?.9:mode==='THUNDER_DRAGON'?.75:.72,category:userCast?'formation':'cast'});
            else{
              swipe(.34,.15,0);
              if(previous==='THUNDER_DRAGON')play('breath_release',{gain:.28});
            }
          }
          function update(state,modeTime,isStationary){
            if(!audible())return;
            const now=context.currentTime,mode=state.gestureMode;
            const casting=userCastModes.has(mode)&&now<formationSoundUntil;
            while(cueIndex<cues.length&&modeTime>=cues[cueIndex][0]){
              const [at,action]=cues[cueIndex++];if(modeTime-at<.35)action();
            }
            const speed=clamp(state.dragonSpeed/85),flow=mode==='DRAGON',inMotion=flow&&!isStationary;
            const split=state.splitEnabled?1:state.retainMainSwordsWhenSplitOff?.65:.38;
            const density=state.lightningEnabled?clamp(state.lightningAmount/2,0,1.4):0,p=clamp(state.pointerNDC.x,-.7,.7);
            if(inMotion&&!moving)nextSwish=now;
            moving=inMotion;
            // 剑流仍在空中收束时逐渐减弱，完全归剑后停止触发。
            const flightEnergy=inMotion?1:clamp(state.dragonStreamProgress);
            if(flow&&flightEnergy>.12&&now>=nextSwish){
              swipe((.34+.16*speed)*split*flightEnergy,speed,p);
              const flightLength=buffers.get('flight_user').duration/(.96+speed*.10);
              nextSwish=now+flightLength*(.55+(1-speed)*.30);
            }
            // 只有大庚与剑盾展开后持续飞剑掠空与碰撞；切换招式由施法总线淡出旧声。
            if(sustainedFormationModes.has(mode)&&!casting){
              if(now>=nextOrbit){
                const orbitSpeed=mode==='SHIELD'?.25:.1;
                swipe(.22,orbitSpeed,Math.sin(now*1.7)*.7);
                nextOrbit=now+buffers.get('flight_user').duration/(.96+orbitSpeed*.10)*.85;
              }
              if(now>=nextFormationClash){
                const pan=Math.sin(now*.8)*.35;
                play('formation_user',{gain:mode==='DAGENG'?.46:.38,pan,endPan:-pan,category:'clash'});
                nextFormationClash=now+buffers.get('formation_user').duration;
              }
            }
            const wantsBreath=mode==='THUNDER_DRAGON'&&state.breathHeld&&density>0;
            target(layers.breath.gain.gain,wantsBreath?.64*Math.min(1.2,density):0,wantsBreath?.045:.07);
            target(layers.breath.source.playbackRate,.88+Math.min(1.4,density)*.13,.1);
            if(wantsBreath!==breathing){
              if(wantsBreath)play('breath_start',{gain:.82,category:'breath'});
              else if(breathing){stopVoices('breath');play('breath_release',{gain:.6});}
              breathing=wantsBreath;
            }
          }
          function effect(kind,on){
            if(!audible())return;
            if(kind==='lightning')play(on?'thunder_hit':'breath_release',{gain:on?.65:.3});
            else if(kind==='split')swipe(on?.4:.28,on?.45:.1,0);
            else if(kind==='qi')play(on?'qi_on':'recall',{gain:on?.4:.25,rate:on?1:1.3});
          }
          function silenceLayers(){if(layers)for(const layer of Object.values(layers))target(layer.gain.gain,0,.025);}
          function setPaused(value){
            paused=!!value;
            if(context){silenceLayers();if(paused){stopVoices();cueIndex=cues.length;moving=breathing=false;}}
            updateMaster();
          }
          function loseFocus(){
            focused=false;moving=breathing=false;cueIndex=cues.length;
            if(context){stopVoices();silenceLayers();updateMaster();void context.suspend().catch(()=>{});}
          }
          const gesture=event=>{if(event.isTrusted&&(context?.state!=='running'||!focused))void unlock();};
          for(const event of ['pointerdown','touchend','keydown'])window.addEventListener(event,gesture,{capture:true,passive:true});
          window.addEventListener('blur',loseFocus);
          window.addEventListener('focus',()=>{silenceLayers();if(context)void unlock();});
          document.addEventListener('visibilitychange',()=>{if(document.hidden)loseFocus();else if(context){silenceLayers();void unlock();}});
          window.addEventListener('pagehide',loseFocus);window.addEventListener('pageshow',()=>{if(context){silenceLayers();void unlock();}});
          toggle.addEventListener('click',event=>{
            event.stopPropagation();enabled=!enabled||volume===0;if(enabled&&volume===0)volume=.65;
            if(!enabled&&context){stopVoices();silenceLayers();moving=breathing=false;cueIndex=cues.length;}
            save();syncUI();updateMaster();if(enabled)void unlock();
          });
          slider.addEventListener('input',()=>{
            volume=clamp(Number(slider.value)/100);
            if(volume===0&&context){stopVoices();silenceLayers();cueIndex=cues.length;moving=breathing=false;}
            save();syncUI();updateMaster();if(enabled&&volume>0)void unlock();
          });
          syncUI();return{formation,update,effect,setPaused};
        }
        const swordAudio=createSwordAudio();

        document.getElementById('sword-count-label').textContent =
          `${CONFIG.mainSwordCount}主剑 · ${CONFIG.shadowSwordCount}剑影 (共${CONFIG.swordCount}剑)`;

        const container = document.getElementById('canvas-container');
        await startup?.step(68,'正在铺展月下山河…');
        const scene = new THREE.Scene();
        scene.background = new THREE.Color('#07101f');
        scene.fog = new THREE.FogExp2('#0e1c33', 0.00072);

        const camera = new THREE.PerspectiveCamera(66, APP_VIEW.width / APP_VIEW.height, 0.03, 6000);
        camera.position.set(0, 8, 68);

        const renderer = new THREE.WebGLRenderer({ antialias: true, powerPreference: 'high-performance' });
        renderer.setSize(APP_VIEW.width, APP_VIEW.height);
        renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, isMobile ? 1.35 : 1.8));
        renderer.outputEncoding = THREE.sRGBEncoding;
        renderer.toneMapping = THREE.ACESFilmicToneMapping;
        renderer.toneMappingExposure = 1.04;
        renderer.shadowMap.enabled = !isMobile;
        renderer.shadowMap.type = THREE.PCFSoftShadowMap;
        scene.environment = createStudioEnvironment();
        container.appendChild(renderer.domElement);

        // 暗水印直接合成进 WebGL 画面；四角 DOM 明水印隐藏后仍有画面署名。
        // 低透明度重复文字用于辅助溯源，不依赖联网或额外素材。
        const copyrightOwner = 'B站：灰森森森';
        const copyrightTile = document.createElement('canvas');
        copyrightTile.width = 512;
        copyrightTile.height = 256;
        const copyrightContext = copyrightTile.getContext('2d');
        copyrightContext.fillStyle = '#ffffff';
        copyrightContext.font = '20px "Microsoft YaHei", "PingFang SC", sans-serif';
        copyrightContext.textAlign = 'center';
        copyrightContext.textBaseline = 'middle';
        for (const [x, y] of [[128, 64], [384, 192]]) {
          copyrightContext.save();
          copyrightContext.translate(x, y);
          copyrightContext.rotate(-Math.PI / 7);
          copyrightContext.fillText(copyrightOwner, 0, 0);
          copyrightContext.restore();
        }
        const copyrightSignatureTexture = new THREE.CanvasTexture(copyrightTile);
        copyrightSignatureTexture.name = copyrightOwner;
        copyrightSignatureTexture.wrapS = copyrightSignatureTexture.wrapT = THREE.RepeatWrapping;
        copyrightSignatureTexture.minFilter = copyrightSignatureTexture.magFilter = THREE.LinearFilter;
        copyrightSignatureTexture.generateMipmaps = false;
        const copyrightScene = new THREE.Scene();
        copyrightScene.name = '青元剑诀 · 版权暗水印';
        copyrightScene.userData.copyright = copyrightOwner;
        const copyrightCamera = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 2);
        const copyrightSignature = new THREE.Mesh(
          new THREE.PlaneGeometry(2, 2),
          new THREE.MeshBasicMaterial({
            map: copyrightSignatureTexture, transparent: true, opacity: .008,
            depthTest: false, depthWrite: false, toneMapped: false, fog: false
          })
        );
        copyrightSignature.position.z = -1;
        copyrightSignature.frustumCulled = false;
        copyrightScene.add(copyrightSignature);
        let copyrightRepeatKey='';
        function renderCopyrightWatermark() {
          const repeatKey=APP_VIEW.width+'x'+APP_VIEW.height;
          if(repeatKey!==copyrightRepeatKey){
            copyrightSignatureTexture.repeat.set(APP_VIEW.width / 512, APP_VIEW.height / 256);
            copyrightRepeatKey=repeatKey;
          }
          renderer.render(copyrightScene, copyrightCamera);
        }
        let renderQuality = isMobile ? 'balanced' : 'ultra';
        const qualityBtn = document.createElement('button');
        qualityBtn.className = 'gold-btn';
        qualityBtn.textContent = renderQuality === 'ultra' ? '画质 · 精致' : '画质 · 流畅';
        qualityBtn.title = '切换渲染画质，模型细节保持不变';
        qualityBtn.setAttribute('aria-label', '切换渲染画质');
        const qualityWindow=document.createElement('div');qualityWindow.id='quality-window';qualityWindow.className='quality-window quality-switch';
        qualityWindow.appendChild(qualityBtn);appStage.appendChild(qualityWindow);
        qualityBtn.addEventListener('click', () => {
          renderQuality = renderQuality === 'ultra' ? 'balanced' : 'ultra';
          qualityBtn.textContent = renderQuality === 'ultra' ? '画质 · 精致' : '画质 · 流畅';
          syncRenderPerformance(true);
        });
        function syncRenderPerformance(force=false){
          const fullscreenActive=!!(document.fullscreenElement||document.webkitFullscreenElement||toyBridge.state?.immersive);
          const handPerformance=fullscreenActive&&STATE.controlMode==='HAND';
          const viewportPixels=Math.max(1,APP_VIEW.width*APP_VIEW.height);
          // Fullscreen itself can multiply the drawing buffer by several times;
          // hand tracking adds a second GPU/CPU workload on top of it.
          const ratioCap=fullscreenActive?(isMobile?0.95:1.10):(renderQuality==='ultra'?1.8:1.0);
          const pixelBudget=fullscreenActive?(isMobile?1.55e6:2.8e6):Infinity;
          const budgetRatio=Number.isFinite(pixelBudget)?Math.sqrt(pixelBudget/viewportPixels):Infinity;
          const ratio=Math.max(.70,Math.min(window.devicePixelRatio||1,ratioCap,budgetRatio));
          if(force||Math.abs(renderer.getPixelRatio()-ratio)>.01)renderer.setPixelRatio(ratio);
          const shadows=renderQuality==='ultra'&&!fullscreenActive;
          if(force||renderer.shadowMap.enabled!==shadows){
            renderer.shadowMap.enabled=shadows;renderer.shadowMap.needsUpdate=true;
          }
          if(fullscreenActive!==performanceMode){
            performanceMode=fullscreenActive;
            if(!fullscreenActive)lastPerformanceFrameTime=0;
          }
          handPerformanceMode=handPerformance;
        }
        renderer.domElement.addEventListener('webglcontextlost', (event) => {
          event.preventDefault();
          document.getElementById('mode-desc').textContent = '图形连接已暂停，请刷新页面恢复';
        });

        // 背景重制：月照青元。实体岩峰、古建与栈道均为可绕行的三维网格。
        // 程序化材质随文件打包，不依赖在线贴图或模型服务。
        const ambientLight = new THREE.HemisphereLight('#93aed0', '#0d141d', .50);
        const moonDirLight = new THREE.DirectionalLight('#c9ddf6', 1.55);
        moonDirLight.position.set(-180,240,150);
        moonDirLight.castShadow=!isMobile;
        moonDirLight.shadow.mapSize.set(2048,2048);
        Object.assign(moonDirLight.shadow.camera,{left:-150,right:150,top:150,bottom:-150,near:1,far:980});
        moonDirLight.shadow.bias=-.0003;moonDirLight.shadow.normalBias=.06;
        const rimDirLight=new THREE.DirectionalLight('#668ebc',.50);rimDirLight.position.set(180,75,-260);
        const jadePointLight=new THREE.PointLight('#53e1ba',.75,75);jadePointLight.position.set(0,10,15);
        scene.add(ambientLight,moonDirLight,rimDirLight,jadePointLight);
        const envGroup=new THREE.Group();envGroup.name='月照青元 · 山水实景';const ENV_SCALE=1.45;envGroup.scale.setScalar(ENV_SCALE);scene.add(envGroup);
        const envDummy=new THREE.Object3D();
        const skyUniforms={uTime:{value:0}};
        const waterUniforms={uTime:{value:0}};
        const cloudSeaUniforms={uTime:{value:0}};
        const mountainUniforms={uTime:{value:0},uMoonDir:{value:new THREE.Vector3(-.55,.77,.33).normalize()}};
        const colorOutput=`\n#include <tonemapping_fragment>\n#include <encodings_fragment>\n`;
        const noiseGLSL=`
          float hash(vec2 p){return fract(sin(dot(p,vec2(127.1,311.7)))*43758.5453);}
          float noise(vec2 p){vec2 i=floor(p),f=fract(p);f=f*f*(3.-2.*f);
            return mix(mix(hash(i),hash(i+vec2(1,0)),f.x),mix(hash(i+vec2(0,1)),hash(i+vec2(1,1)),f.x),f.y);}
          float fbm(vec2 p){float v=0.,a=.52;for(int i=0;i<5;i++){v+=a*noise(p);p=mat2(.8,-.6,.6,.8)*p*2.03+13.7;a*=.49;}return v;}
        `;
        const skyDome=new THREE.Mesh(new THREE.SphereGeometry(2400,40,24),new THREE.ShaderMaterial({
          uniforms:skyUniforms,side:THREE.BackSide,depthWrite:false,
          vertexShader:`varying vec3 vDir;void main(){vDir=position;gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.);}`,
          fragmentShader:`varying vec3 vDir;uniform float uTime;${noiseGLSL}
            void main(){vec3 d=normalize(vDir);float h=max(d.y,0.);
              vec3 col=mix(vec3(.074,.112,.180),vec3(.007,.015,.034),smoothstep(0.,.60,h));
              vec3 md=normalize(vec3(-260,330,-650));float ml=max(dot(d,md),0.);
              vec2 uv=d.xz/(max(.06,d.y)+.28)*2.2+vec2(uTime*.0018,0.);
              float n=fbm(uv),fine=fbm(uv*3.7);
              float cloud=smoothstep(.45,.68,n*.76+fine*.24)*smoothstep(0.,.10,h);
              float edge=smoothstep(.42,.55,n)*(1.-smoothstep(.54,.68,n));
              vec3 cc=mix(vec3(.020,.033,.060),vec3(.15,.21,.29),fine);
              cc+=vec3(.19,.23,.29)*edge*pow(ml,6.);
              col=mix(col,cc,cloud*.84);col+=vec3(.1,.15,.23)*pow(ml,36.)*.45;
              gl_FragColor=vec4(col,1.);${colorOutput}}
          `}));scene.add(skyDome);

        const starCount=1600,starGeo=new THREE.BufferGeometry(),starPos=[],starCol=[];
        for(let i=0;i<starCount;i++){const a=craftRandom()*Math.PI*2,h=.15+craftRandom()*.8,r=1900;
          starPos.push(Math.cos(a)*r*Math.sqrt(1-h*h),r*h,Math.sin(a)*r*Math.sqrt(1-h*h));
          const b=.35+craftRandom()*.45;starCol.push(b*.8,b*.9,b);}
        starGeo.setAttribute('position',new THREE.Float32BufferAttribute(starPos,3));
        starGeo.setAttribute('color',new THREE.Float32BufferAttribute(starCol,3));
        const starField=new THREE.Points(starGeo,new THREE.PointsMaterial({size:1.05,vertexColors:true,transparent:true,opacity:.52,depthWrite:false}));scene.add(starField);
        const moonGroup=new THREE.Group();moonGroup.name='满月与月晕';moonGroup.position.set(-260,330,-650);
        const moonMesh=new THREE.Mesh(new THREE.SphereGeometry(54,64,40),new THREE.ShaderMaterial({
          vertexShader:`varying vec3 vN;void main(){vN=normal;gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.);}`,
          fragmentShader:`varying vec3 vN;${noiseGLSL}
            void main(){vec2 p=vN.xy;float mare=fbm(p*3.+vec2(1.1,5.3));float dust=fbm(p*43.);
              float cr=0.;for(int j=0;j<12;j++){float f=float(j);vec2 c=vec2(hash(vec2(f,3.)),hash(vec2(f,7.)))*1.8-.9;
                float r=.025+hash(vec2(f,11.))*.095;float d=length(p-c)/r;
                cr+=exp(-pow((d-.9)*7.,2.))*.12-exp(-d*d*3.)*.10;}
              vec3 col=mix(vec3(.32,.41,.53),vec3(.76,.83,.90),smoothstep(.32,.66,mare));
              col*=.89+dust*.16+cr;col*=.74+.26*sqrt(max(vN.z,0.));gl_FragColor=vec4(col,1.);${colorOutput}}
          `}));moonGroup.add(moonMesh);
        function softDiscMaterial(color,strength=.25){return new THREE.ShaderMaterial({
          uniforms:{uColor:{value:new THREE.Color(color)},uStrength:{value:strength}},transparent:true,depthWrite:false,blending:THREE.AdditiveBlending,
          vertexShader:`varying vec2 vUv;void main(){vUv=uv;gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.);}`,
          fragmentShader:`varying vec2 vUv;uniform vec3 uColor;uniform float uStrength;void main(){float r=length(vUv-.5)*2.;float a=exp(-r*r*5.)*(1.-smoothstep(.45,1.,r));gl_FragColor=vec4(uColor,a*uStrength);}`});}
        const moonGlow=new THREE.Mesh(new THREE.PlaneGeometry(330,330),softDiscMaterial('#8fb4e0',.24));
        moonGlow.position.z=-2;moonGroup.add(moonGlow);const moonHaloOuter=new THREE.Mesh(new THREE.PlaneGeometry(820,820),softDiscMaterial('#5d7ca8',.10));moonHaloOuter.position.z=-4;moonGroup.add(moonHaloOuter);scene.add(moonGroup);

        // Seamless cliff texture: vertical erosion, mineral layers, fissures and grain.
        function createRockRelief(){
          const c=document.createElement('canvas');c.width=c.height=1024;const ctx=c.getContext('2d'),im=ctx.createImageData(1024,1024);
          const lattice=new Float32Array(128*128);for(let i=0;i<lattice.length;i++)lattice[i]=craftRandom();
          function n(x,y,px=128,py=128){const ix=Math.floor(x),iy=Math.floor(y);let a=x-ix,b=y-iy;a=a*a*(3-2*a);b=b*b*(3-2*b);
            const at=(xx,yy)=>lattice[((xx%px)&127)+(((yy%py)&127)<<7)];return (at(ix,iy)*(1-a)+at(ix+1,iy)*a)*(1-b)+(at(ix,iy+1)*(1-a)+at(ix+1,iy+1)*a)*b;}
          for(let y=0;y<1024;y++)for(let x=0;x<1024;x++){
            const warp=n(x/128,y/128,8,8)*9,macro=n(x/32+warp,y/256,32,4),mid=n(x/8+warp,y/64,128,16),fine=n(x/2,y/8);
            const fissure=Math.pow(Math.max(0,1-Math.abs(mid-.46)*13),7);
            const strata=n(x/128,y/4,8,128),grain=n(x,y);const h=Math.max(0,Math.min(1,macro*.54+mid*.25+fine*.1+strata*.11-fissure*.17));
            const k=(y*1024+x)*4;im.data[k]=h*255;im.data[k+1]=Math.max(0,1-fissure*.85)*255;im.data[k+2]=(strata*.7+grain*.3)*255;im.data[k+3]=255;
          }
          ctx.putImageData(im,0,0);const t=new THREE.CanvasTexture(c);t.wrapS=t.wrapT=THREE.RepeatWrapping;t.anisotropy=Math.min(8,renderer.capabilities.getMaxAnisotropy());return t;
        }
        mountainUniforms.uRock={value:createRockRelief()};
        function createCliffShaderMaterial(instanced=false){return new THREE.ShaderMaterial({
          uniforms:mountainUniforms,extensions:{derivatives:true},
          vertexShader:`varying vec3 vP;varying vec3 vN;void main(){
            mat4 m=modelMatrix;
            #ifdef USE_INSTANCING
              m=m*instanceMatrix;
            #endif
            vec3 lens=vec3(dot(m[0].xyz,m[0].xyz),dot(m[1].xyz,m[1].xyz),dot(m[2].xyz,m[2].xyz));
            vN=normalize(mat3(m)*(normal/lens));vec4 p=m*vec4(position,1.);vP=p.xyz;gl_Position=projectionMatrix*viewMatrix*p;}`,
          fragmentShader:`varying vec3 vP;varying vec3 vN;uniform sampler2D uRock;uniform vec3 uMoonDir;uniform float uCanopyLight;uniform vec3 uCanopyCenter;${noiseGLSL}
            void main(){vec3 N=normalize(vN);vec3 w=pow(abs(N),vec3(5.));w/=max(dot(w,vec3(1.)),.001);
              vec3 tex=texture2D(uRock,vP.zy*vec2(.026,.014)).rgb*w.x+texture2D(uRock,vP.xz*.026).rgb*w.y+texture2D(uRock,vP.xy*vec2(.026,.014)).rgb*w.z;
              float h=tex.r*.9+tex.b*.08;
              vec3 dx=dFdx(vP),dy=dFdy(vP),r1=cross(dy,N),r2=cross(N,dx);float det=dot(dx,r1);
              vec3 grad=sign(det)*(dFdx(h)*r1+dFdy(h)*r2);
              N=normalize(abs(det)*N-grad*.95);
              float diff=max(dot(N,uMoonDir),0.);float grain=texture2D(uRock,vP.xy*.39+vP.z*.11).r;
              vec3 base=mix(vec3(.014,.021,.032),vec3(.098,.120,.148),smoothstep(.16,.82,tex.r));
              base*=.63+tex.g*.37;float moss=smoothstep(.48,.92,vN.y)*smoothstep(.32,.64,tex.r);
              base=mix(base,vec3(.035,.058,.045),moss*.72);
              vec3 col=base*(.26+diff*1.52);col+=vec3(.075,.10,.14)*pow(diff,5.)*grain*.30;
              vec3 V=normalize(cameraPosition-vP);float spec=pow(max(dot(reflect(-uMoonDir,N),V),0.),28.);
              col+=vec3(.15,.21,.29)*spec*.24*tex.g;
              float warm=exp(-length(vP-vec3(149,90,-325))*.085)+exp(-length(vP-vec3(138,25,-189))*.085)+exp(-length(vP-vec3(-42,-20,0))*.14)+exp(-length(vP-vec3(301,139,-447))*.09)+exp(-length(vP-vec3(-128,138,-145))*.09)+exp(-length(vP-vec3(15,81,-374))*.09)+exp(-length(vP-vec3(87,78,-522))*.085)+exp(-length(vP-vec3(-87,107,-508))*.085);
              col+=vec3(.18,.073,.018)*warm*.35;
              vec3 toCanopy=uCanopyCenter-vP;float field=1.-smoothstep(380.,500.,length(toCanopy.xz));
              float bounce=(.22+.78*max(dot(N,normalize(toCanopy)),0.))*field*uCanopyLight;
              col+=vec3(.035,.21,.135)*bounce*(.55+tex.r*.45);
              col+=vec3(.13,.09,.025)*exp(-length(toCanopy.xz)*.012)*bounce;
              float depth=max(length(vP-cameraPosition)-85.,0.);float haze=1.-exp(-depth*mix(.00125,.00062,uCanopyLight));
              float baseMist=(1.-smoothstep(-100.,-20.,vP.y))*.7;
              vec3 fog=mix(vec3(.075,.11,.17),vec3(.15,.20,.28),clamp(-vP.y*.012,0.,1.));
              col=mix(col,fog,clamp(haze+baseMist*(1.-haze),0.,.92));
              gl_FragColor=vec4(col,1.);${colorOutput}}
          `});}
        const terrainShaderMat=createCliffShaderMaterial(),instancedCliffMat=createCliffShaderMaterial(true);
        function createPeakGeometry(seed=0,detail=1,plateau=false){
          const radial=detail?64:26,levels=detail?80:30,p=[],uv=[],idx=[];
          for(let j=0;j<=levels;j++)for(let i=0;i<=radial;i++){
            const t=j/levels,a=i/radial*Math.PI*2;
            const flute=Math.sin(a*5+seed+t*.7)*.16+Math.sin(a*9-seed*.7+t*1.9)*.09+Math.sin(a*17+t*7+seed)*.032;
            const fracture=Math.abs(Math.sin(a*11-t*1.8+seed))*.04;
            const shelf=Math.pow(Math.max(0,Math.sin(t*41+Math.sin(a*3+seed))),12)*.028;
            const profile=.93-.25*smoothstep(.10,.60,t)-.12*smoothstep(.82,1,t);
            const summit=plateau?1:.20+.80*Math.sqrt(1-smoothstep(.68,1,t));
            const radius=(profile+flute+fracture+shelf)*summit*(1+.025*Math.sin(t*98+a*7));
            const crown=plateau?0:smoothstep(.83,1,t)*(.045*Math.sin(a*3+seed)+.026*Math.cos(a*7+seed));
            p.push(Math.cos(a)*radius+Math.sin(seed)*t*t*.15,t+crown,Math.sin(a)*radius+Math.cos(seed)*t*t*.1);uv.push(i/radial,t);
            if(j<levels&&i<radial){const k=j*(radial+1)+i;idx.push(k,k+radial+1,k+1,k+1,k+radial+1,k+radial+2);}
          }
          const cap=p.length/3;p.push(Math.sin(seed)*.15,plateau?1:1.015,Math.cos(seed)*.1);uv.push(.5,1);
          for(let i=0;i<radial;i++)idx.push(levels*(radial+1)+i,cap,levels*(radial+1)+i+1);
          const g=new THREE.BufferGeometry();g.setAttribute('position',new THREE.Float32BufferAttribute(p,3));g.setAttribute('uv',new THREE.Float32BufferAttribute(uv,2));g.setIndex(idx);g.computeVertexNormals();return g;
        }
        // A deliberate near/middle/far layout leaves an open valley for the swords.
        const keyPeakDefs=[
          {x:137,y:-74,z:-290,rx:28,ry:244,rz:23,rot:.2},
          {x:172,y:-76,z:-302,rx:22,ry:230,rz:24,rot:1.4},
          {x:110,y:-74,z:-282,rx:18,ry:217,rz:19,rot:2.1},
          {x:116,y:-70,z:-238,rx:38,ry:133,rz:25,rot:.5},
          {x:84,y:-70,z:-226,rx:18,ry:132,rz:21,rot:2.4},
          {x:157,y:-70,z:-225,rx:22,ry:107,rz:20,rot:1.5},
          {x:96,y:-65,z:-136,rx:26,ry:83,rz:19,rot:.6},
          {x:72,y:-65,z:-128,rx:13,ry:68,rz:14,rot:2.7},
          {x:37,y:-65,z:-137,rx:10,ry:69,rz:12,rot:1.1},
          {x:43,y:-65,z:-171,rx:10,ry:103,rz:12,rot:.2},
          {x:54,y:-70,z:-207,rx:9,ry:104,rz:10,rot:1.3},
          {x:140,y:-70,z:-180,rx:10,ry:100,rz:12,rot:2.3},
          {x:176,y:-68,z:-173,rx:22,ry:102,rz:23,rot:.5},
          {x:126,y:-64,z:-70,rx:28,ry:49,rz:24,rot:2.1},
          {x:102,y:-65,z:-62,rx:13,ry:40,rz:12,rot:1.8},
          {x:-86,y:-65,z:-66,rx:27,ry:166,rz:24,rot:2.4},
          {x:-113,y:-65,z:-96,rx:29,ry:190,rz:25,rot:.7},
          {x:-140,y:-65,z:-140,rx:25,ry:164,rz:25,rot:1.2},
          {x:-48,y:-65,z:-99,rx:12,ry:86,rz:12,rot:2.5},
          {x:-65,y:-65,z:-158,rx:15,ry:91,rz:13,rot:.6},
          {x:-14,y:-65,z:-204,rx:13,ry:99,rz:12,rot:1.9},
          {x:12,y:-65,z:-280,rx:15,ry:126,rz:13,rot:2.8},
          {x:-114,y:-75,z:-300,rx:20,ry:135,rz:16,rot:.3},
          {x:60,y:-70,z:-360,rx:16,ry:130,rz:14,rot:.9},
          {x:-60,y:-72,z:-350,rx:15,ry:150,rz:13,rot:1.8},
          {x:208,y:-72,z:-308,rx:17,ry:172,rz:15,rot:2.6},
          {x:228,y:-70,z:-252,rx:12,ry:112,rz:11,rot:.4},
          {x:10,y:-68,z:-258,rx:11,ry:128,rz:10,rot:2.2},
          {x:-152,y:-70,z:-152,rx:14,ry:150,rz:13,rot:1.1},
          {x:-180,y:-72,z:-210,rx:16,ry:132,rz:14,rot:2.9},
          {x:-38,y:-68,z:-228,rx:10,ry:118,rz:10,rot:1.6},
          {x:250,y:-74,z:-360,rx:19,ry:142,rz:16,rot:1.9},
          {x:-232,y:-74,z:-330,rx:18,ry:146,rz:15,rot:.6},
          {x:150,y:-72,z:-380,rx:15,ry:118,rz:13,rot:2.5},
          {x:-130,y:-70,z:-260,rx:12,ry:124,rz:11,rot:1.3},
          {x:96,y:-70,z:-420,rx:13,ry:105,rz:12,rot:.7},
          {x:-20,y:-70,z:-330,rx:9,ry:96,rz:9,rot:2.4}
        ];
        const peakMeshes=[],terrainProxies=[];
        const terrainQueryMaterial=new THREE.MeshBasicMaterial({side:THREE.DoubleSide});
        function makePeakBatch(defs,seed,detail){const mesh=new THREE.InstancedMesh(createPeakGeometry(seed,detail),instancedCliffMat,defs.length);mesh.name=detail?'断崖主峰':'远山层峦';
          defs.forEach((p,i)=>{envDummy.position.set(p.x,p.y,p.z);envDummy.rotation.set(0,p.rot||0,0);envDummy.scale.set(p.rx,p.ry,p.rz);envDummy.updateMatrix();mesh.setMatrixAt(i,envDummy.matrix);});
          mesh.geometry.computeBoundingBox();
          defs.forEach(p=>{const proxy=new THREE.Mesh(mesh.geometry,terrainQueryMaterial);proxy.position.set(p.x,p.y,p.z);proxy.rotation.y=p.rot||0;proxy.scale.set(p.rx,p.ry,p.rz);proxy.updateMatrixWorld(true);terrainProxies.push({mesh:proxy,bounds:mesh.geometry.boundingBox.clone().applyMatrix4(proxy.matrixWorld)});});
          mesh.instanceMatrix.needsUpdate=true;mesh.frustumCulled=false;envGroup.add(mesh);peakMeshes.push(mesh);return mesh;}
        for(let v=0;v<4;v++)makePeakBatch(keyPeakDefs.filter((_,i)=>i%4===v),v*1.73,1);
        const peaksInstanced=peakMeshes[0];
        const farDefs=[];
        for(let i=0;i<190;i++){
          const z=-300-(i%7)*128-craftRandom()*95,x=(craftRandom()-.5)*(900+Math.abs(z)*.8);
          if(x>65&&x<205&&z>-380)continue;
          const depth=1+Math.abs(z)*.0013,rx=(5.5+craftRandom()*12)*depth;
          farDefs.push({x,y:-86,z,rx,ry:(46+craftRandom()*96)*depth,rz:rx*(.65+craftRandom()*.45),rot:craftRandom()*6.28});
        }
        for(let v=0;v<4;v++)makePeakBatch(farDefs.filter((_,i)=>i%4===v),v*2.3+1,0);
        // Smaller vertical fins break the cylindrical silhouette of the hero cliffs.
        const fins=[];
        keyPeakDefs.forEach((p,i)=>{for(let j=0;j<4;j++){
          const a=(j/4+i*.61)*Math.PI*2,r=.70;
          fins.push({x:p.x+Math.cos(a)*p.rx*r,y:p.y,z:p.z+Math.sin(a)*p.rz*r,rx:p.rx*(.21+craftRandom()*.11),ry:p.ry*(.67+craftRandom()*.22),rz:p.rz*.29,rot:a});
        }});makePeakBatch(fins,4.7,0);

        // Slate tiles, weathered bronze, dark timber and restrained paper-window light.
        function makeSurface(kind){const c=document.createElement('canvas');c.width=c.height=512;const ctx=c.getContext('2d');
          ctx.fillStyle=kind==='roof'?'#707981':'#939b9d';ctx.fillRect(0,0,512,512);
          if(kind==='roof'){for(let x=0;x<512;x+=32){const g=ctx.createLinearGradient(x,0,x+32,0);g.addColorStop(0,'#252d35');g.addColorStop(.33,'#a6adb3');g.addColorStop(.8,'#626d76');g.addColorStop(1,'#303b45');ctx.fillStyle=g;ctx.fillRect(x,0,32,512);
              for(let y=0;y<512;y+=48){ctx.fillStyle='#303842';ctx.fillRect(x,y,32,4);ctx.fillStyle='#9aa4ad';ctx.fillRect(x,y+4,32,2);}}
          }else {for(let k=0;k<16000;k++){const v=60+Math.floor(craftRandom()*150);ctx.fillStyle=`rgba(${v},${v+3},${v+5},.23)`;ctx.fillRect(craftRandom()*512,craftRandom()*512,1+craftRandom()*3,1+craftRandom()*2);}
            ctx.strokeStyle='#36434b';ctx.lineWidth=1.2;for(let k=0;k<18;k++){let x=craftRandom()*512,y=craftRandom()*512;ctx.beginPath();ctx.moveTo(x,y);for(let j=0;j<7;j++){x+=craftRandom()*30-10;y+=craftRandom()*25;ctx.lineTo(x,y);}ctx.stroke();}}
          const t=new THREE.CanvasTexture(c);t.wrapS=t.wrapT=THREE.RepeatWrapping;t.anisotropy=Math.min(8,renderer.capabilities.getMaxAnisotropy());return t;}
        const roofRelief=makeSurface('roof'),stoneRelief=makeSurface('stone');roofRelief.repeat.set(2,2);stoneRelief.repeat.set(1,1);
        const palaceRoofMat=new THREE.MeshStandardMaterial({color:'#26343c',bumpMap:roofRelief,bumpScale:.095,roughness:.58,metalness:.18,side:THREE.DoubleSide,envMapIntensity:.42});
        const palaceGoldRidgeMat=new THREE.MeshStandardMaterial({color:'#9b7c43',metalness:.65,roughness:.52,envMapIntensity:.45});
        const palacePillarMat=new THREE.MeshStandardMaterial({color:'#302826',roughness:.84});
        const stoneTerraceMat=new THREE.MeshStandardMaterial({color:'#66717b',map:stoneRelief,bumpMap:stoneRelief,bumpScale:.20,roughness:.92});
        const stoneDarkMat=new THREE.MeshStandardMaterial({color:'#343f48',map:stoneRelief,bumpMap:stoneRelief,bumpScale:.2,roughness:.92});
        const wallMat=new THREE.MeshStandardMaterial({color:'#67635b',roughness:.96});
        const lanternGlowMat=new THREE.MeshBasicMaterial({color:'#ffc06a'});
        const warmHaloMat=softDiscMaterial('#e8963c',.13);
        const winCanvas=document.createElement('canvas');winCanvas.width=256;winCanvas.height=128;{
          const ctx=winCanvas.getContext('2d'),g=ctx.createLinearGradient(0,0,0,128);g.addColorStop(0,'#7e4827');g.addColorStop(.45,'#efb05c');g.addColorStop(1,'#a16c36');ctx.fillStyle=g;ctx.fillRect(0,0,256,128);
          ctx.fillStyle='#282322';for(let x=0;x<=256;x+=32){ctx.fillRect(x,0,4,128);for(let y=8;y<120;y+=30){ctx.save();ctx.translate(x+17,y+12);ctx.rotate(Math.PI/4);ctx.strokeStyle='#433426';ctx.lineWidth=2;ctx.strokeRect(-7,-7,14,14);ctx.restore();}}
          for(let y=0;y<=128;y+=32)ctx.fillRect(0,y,256,3);ctx.fillRect(0,0,256,6);ctx.fillRect(0,122,256,6);
        }
        const latticeWinTex=new THREE.CanvasTexture(winCanvas);latticeWinTex.encoding=THREE.sRGBEncoding;
        const palaceWindowMat=new THREE.MeshBasicMaterial({map:latticeWinTex,color:'#d9a877',toneMapped:false});
        function box(parent,w,h,d,x,y,z,mat=stoneTerraceMat,bevel=0){const mesh=new THREE.Mesh(bevel?beveledBox(w,h,d,bevel):new THREE.BoxGeometry(w,h,d),mat);mesh.position.set(x,y,z);parent.add(mesh);return mesh;}
        function rod(parent,a,b,r,mat=stoneTerraceMat,r2=r){const va=new THREE.Vector3(...a),vb=new THREE.Vector3(...b),mid=va.clone().add(vb).multiplyScalar(.5);const mesh=new THREE.Mesh(new THREE.CylinderGeometry(r2,r,va.distanceTo(vb),8),mat);mesh.position.copy(mid);mesh.quaternion.setFromUnitVectors(new THREE.Vector3(0,1,0),vb.sub(va).normalize());parent.add(mesh);return mesh;}
        // Revised architecture: open terrace gates, fitted rock foundations and
        // terrain-aware stairs share the same deck datum in environment space.
        const carvedTimberMat=new THREE.MeshStandardMaterial({color:'#49382d',roughness:.77});
        const lacquerMat=new THREE.MeshStandardMaterial({color:'#24464a',metalness:.15,roughness:.52});
        const roofUndersideMat=new THREE.MeshStandardMaterial({color:'#232a2b',roughness:.91,side:THREE.DoubleSide});
        const doorMat=new THREE.MeshStandardMaterial({color:'#182a2d',roughness:.72});
        const refinedWindowMat=new THREE.MeshStandardMaterial({map:latticeWinTex,color:'#c7ab7c',emissive:'#e3a14c',emissiveMap:latticeWinTex,emissiveIntensity:.62,roughness:.86});
        function roofPoint(x,z,w,d,h){
          const nx=Math.abs(x)/(w*.5),nz=Math.abs(z)/(d*.5),hip=Math.max(nz,Math.max(0,(nx-.42)/.58));
          const corner=Math.pow(nx*nz,3);
          return new THREE.Vector3(x*(1+corner*.055),Math.pow(Math.max(0,1-hip),1.65)*h+Math.pow(Math.max(nx,nz),6)*h*.14+corner*h*.23,z*(1+corner*.055));
        }
        function createCurvedChineseRoofGeo(w,d,h,opening=null){
          const xs=Array.from({length:41},(_,k)=>(k/40-.5)*w),zs=Array.from({length:29},(_,k)=>(k/28-.5)*d);
          if(opening){xs.push(-opening.w/2,opening.w/2);zs.push(-opening.d/2,opening.d/2);xs.sort((a,b)=>a-b);zs.sort((a,b)=>a-b);}
          const p=[],uv=[],idx=[],nx=xs.length;
          for(const z of zs)for(const x of xs){const v=roofPoint(x,z,w,d,h);p.push(v.x,v.y,v.z);uv.push(x/w+.5,z/d+.5);}
          for(let j=0;j<zs.length-1;j++)for(let i=0;i<nx-1;i++){
            if(opening&&Math.abs((xs[i]+xs[i+1])*.5)<opening.w/2&&Math.abs((zs[j]+zs[j+1])*.5)<opening.d/2)continue;
            const a=j*nx+i;idx.push(a,a+nx,a+1,a+1,a+nx,a+nx+1);
          }
          const g=new THREE.BufferGeometry();g.setAttribute('position',new THREE.Float32BufferAttribute(p,3));g.setAttribute('uv',new THREE.Float32BufferAttribute(uv,2));g.setIndex(idx);g.computeVertexNormals();return g;
        }
        function addRoof(group,w,d,h,y,opening=null){
          const roofGeo=createCurvedChineseRoofGeo(w,d,h,opening),mesh=new THREE.Mesh(roofGeo,palaceRoofMat);mesh.position.y=y;group.add(mesh);
          const soffit=new THREE.Mesh(roofGeo.clone(),roofUndersideMat);soffit.position.y=y-.13;group.add(soffit);
          const count=isMobile?22:36;
          for(let j=0;j<=count;j++){
            const x=(j/count-.5)*w;
            for(const side of [-1,1]){
              const from=opening&&Math.abs(x)<opening.w/2?opening.d/2:0,arr=[];
              for(let k=0;k<=12;k++){const p=roofPoint(x,side*(from+(d/2-from)*k/12),w,d,h);p.y+=y+.04;arr.push(p);}
              group.add(craftTube(arr,.038,palaceRoofMat,12,5));
              const e=arr[arr.length-1];
              rod(group,[e.x,e.y-.10,e.z-side*.20],[e.x,e.y-.10,e.z+side*.06],.063,palaceRoofMat);
              if(j%2===0)rod(group,[e.x*.93,e.y-.22,e.z*.83],[e.x,e.y-.22,e.z],.046,carvedTimberMat);
            }
          }
          if(!opening){
            group.add(craftTube([[-w*.245,y+h+.03,0],[0,y+h+.09,0],[w*.245,y+h+.03,0]],.105,palaceGoldRidgeMat,18,7));
            for(const side of [-1,1]){
              group.add(craftTube([[side*w*.23,y+h+.06,0],[side*w*.27,y+h+.24,0],[side*w*.28,y+h+.63,0],[side*w*.255,y+h+.76,0]],.08,palaceGoldRidgeMat,12,6));
              const pearl=new THREE.Mesh(new THREE.SphereGeometry(.115,10,7),palaceGoldRidgeMat);pearl.position.set(side*w*.255,y+h+.77,0);group.add(pearl);
            }
          }
          for(const sx of [-1,1])for(const sz of [-1,1]){
            const arr=[];
            for(let k=0;k<=14;k++){
              const t=k/14,ix=opening?opening.w/(2*w):.21,iz=opening?opening.d/d:0;
              const p=roofPoint(sx*(ix+(.5-ix)*t)*w,sz*(iz+(1-iz)*t)*d*.5,w,d,h);p.y+=y+.075;arr.push(p);
            }
            group.add(craftTube(arr,.075,palaceGoldRidgeMat,18,6));
            const e=arr[arr.length-1];group.add(craftTube([e,[e.x+sx*.18,e.y+.20,e.z+sz*.12],[e.x+sx*.30,e.y+.51,e.z+sz*.23]],.048,palaceGoldRidgeMat,9,5));
          }
          // Four continuous fascia edges also close the roof thickness at the hips.
          for(let axis=0;axis<2;axis++)for(const side of [-1,1])for(let layer=0;layer<2;layer++){
            const arr=[];for(let k=0;k<=36;k++){
              const t=k/36-.5,p=roofPoint(axis?side*w/2:t*w,axis?t*d:side*d/2,w,d,h);p.y+=y-layer*.15;arr.push(p);
            }
            group.add(craftTube(arr,layer?.065:.055,layer?carvedTimberMat:palaceGoldRidgeMat,36,5));
          }
          return mesh;
        }
        function railing(group,a,b,height=.96,interval=1.85){
          const va=new THREE.Vector3(...a),vb=new THREE.Vector3(...b),length=va.distanceTo(vb);if(length<.18)return;
          const n=Math.max(1,Math.ceil(length/interval));
          for(let k=0;k<=n;k++){
            const v=va.clone().lerp(vb,k/n);
            box(group,.18,height,.18,v.x,v.y+height*.5,v.z,stoneTerraceMat,.018);
            box(group,.28,.10,.28,v.x,v.y+height+.025,v.z,stoneTerraceMat,.025);
          }
          for(const h of [.30,.79])rod(group,[a[0],a[1]+height*h,a[2]],[b[0],b[1]+height*h,b[2]],.052,stoneTerraceMat);
          for(let k=0;k<n;k++){
            const v=va.clone().lerp(vb,(k+.5)/n);
            box(group,.10,height*.39,.10,v.x,v.y+height*.53,v.z,stoneTerraceMat,.012);
          }
        }
        function plaque(label){
          const c=document.createElement('canvas');c.width=512;c.height=128;const ctx=c.getContext('2d');
          ctx.fillStyle='#172e31';ctx.fillRect(0,0,512,128);ctx.strokeStyle='#a58a52';ctx.lineWidth=5;ctx.strokeRect(7,7,498,114);ctx.lineWidth=1;ctx.strokeRect(17,17,478,94);
          ctx.fillStyle='#e2cca0';ctx.font='bold 70px "STKaiti","KaiTi",serif';ctx.textAlign='center';ctx.textBaseline='middle';ctx.fillText(label,256,68);
          const t=new THREE.CanvasTexture(c);t.encoding=THREE.sRGBEncoding;return new THREE.MeshBasicMaterial({map:t,color:'#c5b58e'});
        }
        function addHangingLantern(group,x,y,z,s=1){
          rod(group,[x,y+.35*s,z],[x,y+.82*s,z],.018*s,palaceGoldRidgeMat);
          const lamp=new THREE.Mesh(new THREE.SphereGeometry(.19*s,10,8),lanternGlowMat);lamp.scale.y=1.38;lamp.position.set(x,y,z);group.add(lamp);
          for(const dy of [-.25,.25])box(group,.29*s,.055*s,.29*s,x,y+dy*s,z,palaceGoldRidgeMat,.025*s);
          rod(group,[x,y-.28*s,z],[x,y-.52*s,z],.016*s,palaceGoldRidgeMat);
        }
        function createImmortalPavilion(width,depth,tiers=2,label='青元阁'){
          const g=new THREE.Group();g.name=label;g.userData.architecture=true;
          const hw=width*.84,hd=depth*.91,floorY=2.4,gate=Math.min(1.7,width*.17),sideGateZ=depth*.58,sideGate=.95;
          box(g,width*1.63,1.13,depth*1.76,0,.565,0,stoneDarkMat,.09);
          box(g,width*1.68,.25,depth*1.82,0,1.24,0,stoneTerraceMat,.07);
          box(g,width*1.55,.75,depth*1.68,0,1.72,0,stoneDarkMat,.05);
          box(g,width*1.68,.30,depth*1.82,0,2.23,0,stoneTerraceMat,.045);
          box(g,width*1.62,.04,depth*1.76,0,2.39,0,stoneTerraceMat);
          railing(g,[-hw,floorY,-hd],[hw,floorY,-hd]);
          for(const s of [-1,1]){
            railing(g,[s*hw,floorY,-hd],[s*hw,floorY,sideGateZ-sideGate]);
            railing(g,[s*hw,floorY,sideGateZ+sideGate],[s*hw,floorY,hd]);
          }
          railing(g,[-hw,floorY,hd],[-gate,floorY,hd]);railing(g,[gate,floorY,hd],[hw,floorY,hd]);
          // Nine fitted risers meet a clear front gate; no rail crosses the entrance.
          const entranceRun=3.2,steps=12;
          for(let k=0;k<steps;k++){
            const top=.1+(floorY-.1)*(k+1)/steps;
            box(g,gate*2-.10,top+.04,entranceRun/steps+.008,0,(top-.04)/2,hd+entranceRun-(k+.5)*entranceRun/steps,stoneTerraceMat,.013);
          }
          for(const s of [-1,1])railing(g,[s*gate,.10,hd+entranceRun],[s*gate,floorY,hd],.78,1.5);
          for(let i=-3;i<=3;i++)box(g,.018,.009,depth*1.65,i*width*.205,floorY+.006,0,stoneDarkMat);
          for(let i=-3;i<=3;i++)box(g,width*1.55,.009,.018,0,floorY+.007,i*depth*.23,stoneDarkMat);
          let y=floorY;
          for(let tier=0;tier<tiers;tier++){
            const scale=Math.pow(.76,tier),w=width*scale,d=depth*scale,h=tier?3.10:3.85,wx=w*.39,wz=d*.38;
            box(g,w*.81,.22,d*.79,0,y+.11,0,carvedTimberMat,.035);
            box(g,w*.78,h-.20,d*.76,0,y+h*.5,0,wallMat,.015);
            const bays=w>11?5:3,bayW=w*.74/bays;
            for(const side of [-1,1])for(let j=0;j<bays;j++){
              const x=(j-(bays-1)/2)*bayW,isDoor=side===1&&j===(bays-1)/2;
              const panelH=isDoor?h*.77:h*.59,py=y+(isDoor?panelH*.5+.09:h*.50);
              box(g,bayW*.84,panelH,.065,x,py,side*(wz+.04),isDoor?doorMat:refinedWindowMat);
              for(const dx of [-.45,.45])box(g,.065,panelH+.12,.09,x+dx*bayW,py,side*(wz+.07),carvedTimberMat,.012);
              for(const dy of [-.5,.5])box(g,bayW*.95,.075,.09,x,py+dy*panelH,side*(wz+.07),carvedTimberMat,.012);
              if(isDoor){
                box(g,.055,panelH,.09,x,py,side*(wz+.09),palaceGoldRidgeMat);
                for(const dx of [-.18,.18]){const ring=new THREE.Mesh(new THREE.TorusGeometry(.075,.014,5,12),palaceGoldRidgeMat);ring.position.set(x+dx*bayW,py-.13,side*(wz+.11));g.add(ring);}
              }else{
                for(let m=-1;m<=1;m++)box(g,.033,panelH-.08,.035,x+m*bayW*.21,py,side*(wz+.087),carvedTimberMat);
                box(g,bayW*.81,.035,.035,x,py-.13,side*(wz+.09),carvedTimberMat);
              }
            }
            for(const side of [-1,1])for(let j=0;j<3;j++){
              const z=(j-1)*d*.23;box(g,.065,h*.59,d*.205,side*(wx+.04),y+h*.50,z,refinedWindowMat);
              for(const dz of [-.113,.113])box(g,.10,h*.64,.065,side*(wx+.07),y+h*.50,z+dz*d,carvedTimberMat,.01);
              for(const dy of [-.31,.31])box(g,.10,.07,d*.23,side*(wx+.07),y+h*(.5+dy),z,carvedTimberMat,.01);
            }
            const cols=w>11?6:4;
            for(const side of [-1,1])for(let j=0;j<=cols;j++){
              const x=(j/cols-.5)*w*.98,z=side*d*.50,r=.13*scale+.035;
              rod(g,[x,y+.17,z],[x,y+h-.08,z],r,carvedTimberMat,r*.86);
              box(g,r*2.8,.17,r*2.8,x,y+.085,z,stoneTerraceMat,.025);
              for(const yy of [y+.24,y+h-.48])rod(g,[x,yy,z],[x,yy+.06,z],r*1.08,palaceGoldRidgeMat);
              // Alternating transverse arms make a readable three-layer dougong.
              for(let b=0;b<3;b++){
                box(g,(.39+b*.19)*scale,.13,.26*scale,x,y+h-.42+b*.145,z,lacquerMat,.018);
                box(g,.23*scale,.13,(.43+b*.25)*scale,x,y+h-.35+b*.145,z,carvedTimberMat,.018);
              }
            }
            for(const side of [-1,1]){
              box(g,w*1.06,.22,.24,0,y+h-.13,side*d*.5,carvedTimberMat,.025);
              box(g,w*1.03,.10,.11,0,y+h-.34,side*d*.51,lacquerMat,.015);
              box(g,.24,.22,d,side*w*.49,y+h-.13,0,carvedTimberMat,.025);
              box(g,w*.97,.035,.035,0,y+h-.42,side*d*.52,palaceGoldRidgeMat);
            }
            if(tier){
              box(g,w*1.16,.20,d*1.18,0,y-.08,0,carvedTimberMat,.04);
              for(const side of [-1,1])railing(g,[-w*.54,y,side*d*.54],[w*.54,y,side*d*.54],.65,1.7);
            }
            const rh=2.15*scale,hasUpper=tier<tiers-1;
            addRoof(g,w*1.43,d*1.53,rh,y+h,hasUpper?{w:w*.76*.83,d:d*.76*.81}:null);
            for(const sx of [-1,1])for(const sz of [-1,1])addHangingLantern(g,sx*w*.46,y+h-.96,sz*d*.50,.88*scale);
            if(!tier){
              const sign=new THREE.Mesh(new THREE.PlaneGeometry(width*.30,.76),plaque(label));sign.position.set(0,y+h-.59,depth*.527);g.add(sign);
              box(g,width*.31,.045,.12,0,y+h-.17,depth*.525,palaceGoldRidgeMat,.015);
            }
            const nextY=y+h+rh*.62;
            if(hasUpper)box(g,w*.76*.83,1.42,d*.76*.81,0,nextY-.65,0,carvedTimberMat,.012);
            y=nextY;
          }
          g.userData.deckY=floorY;return g;
        }
        const terrainRay=new THREE.Raycaster(),terrainHeightCache=new Map();
        function terrainHeight(x,z){
          const key=x.toFixed(2)+','+z.toFixed(2);if(terrainHeightCache.has(key))return terrainHeightCache.get(key);
          terrainRay.set(new THREE.Vector3(x,600,z),new THREE.Vector3(0,-1,0));let height=-90;
          for(const entry of terrainProxies){
            if(x<entry.bounds.min.x||x>entry.bounds.max.x||z<entry.bounds.min.z||z>entry.bounds.max.z)continue;
            const hits=[];entry.mesh.raycast(terrainRay,hits);for(const hit of hits)height=Math.max(height,hit.point.y);
          }
          terrainHeightCache.set(key,height);return height;
        }
        const pavilionPlacements=[
          {x:111,y:61,z:-226,w:19,d:12,tiers:2,rot:-.15,label:'青元殿'},
          {x:83,y:59,z:-219,w:11,d:9,tiers:1,rot:.10,label:'听雪阁'},
          {x:142,y:57,z:-218,w:12,d:9,tiers:1,rot:-.25,label:'藏剑阁'},
          {x:96,y:17,z:-132,w:15,d:10,tiers:2,rot:-.18,label:'凌云阁'},
          {x:74,y:3,z:-127,w:8,d:7,tiers:1,rot:.13,label:'问道亭'},
          {x:37,y:3,z:-135,w:6,d:6,tiers:1,rot:.20,label:'望月亭'},
          {x:176,y:32,z:-172,w:13,d:9,tiers:2,rot:-.30,label:'归鹤楼'},
          {x:127,y:-16,z:-69,w:12,d:9,tiers:1,rot:-.40,label:'松风院'},
          {x:109,y:-22,z:-56,w:6,d:6,tiers:1,rot:.10,label:'云台亭'},
          {x:208,y:96,z:-308,w:11,d:8,tiers:2,rot:.35,label:'摘星楼'},
          {x:226,y:38,z:-250,w:7,d:6,tiers:1,rot:-.50,label:'听涛亭'},
          {x:10,y:56,z:-258,w:9,d:7,tiers:1,rot:.15,label:'揽月台'},
          {x:-152,y:78,z:-150,w:9,d:7,tiers:1,rot:.60,label:'栖霞馆'},
          {x:-113,y:124,z:-96,w:7,d:6,tiers:1,rot:-.35,label:'松涛居'},
          {x:60,y:54,z:-360,w:8,d:6,tiers:1,rot:.20,label:'云深庵'},
          {x:-60,y:74,z:-350,w:8,d:6,tiers:1,rot:-.60,label:'寒灯庵'},
          {x:-178,y:60,z:-208,w:8,d:7,tiers:1,rot:.90,label:'望瀑轩'}
        ];
        function sitePoint(p,x,y,z){return new THREE.Vector3(x,y,z).applyAxisAngle(new THREE.Vector3(0,1,0),p.rot).add(new THREE.Vector3(p.x,p.y,p.z));}
        function createFittedFoundation(p){
          const count=20,positions=[],uv=[],indices=[],rings=[[-25,.86],[-15,1.08],[-5,1.025],[-.04,1]],hw=p.w*.83,hd=p.d*.90;
          for(let ring=0;ring<rings.length;ring++)for(let k=0;k<count;k++){
            const a=k/count*Math.PI*2,shape=1/Math.max(Math.abs(Math.cos(a)),Math.abs(Math.sin(a))),jag=ring===3?1:1+.065*Math.sin(k*3.9+p.x);
            positions.push(Math.cos(a)*shape*hw*rings[ring][1]*jag,rings[ring][0],Math.sin(a)*shape*hd*rings[ring][1]*jag);uv.push(k/count,ring/3);
            if(ring<rings.length-1){const i=ring*count+k,n=ring*count+(k+1)%count;indices.push(i,i+count,n,n,i+count,n+count);}
          }
          const cap=positions.length/3;positions.push(0,-.04,0);uv.push(.5,1);
          for(let k=0;k<count;k++)indices.push(3*count+k,cap,3*count+(k+1)%count);
          const geo=new THREE.BufferGeometry();geo.setAttribute('position',new THREE.Float32BufferAttribute(positions,3));geo.setAttribute('uv',new THREE.Float32BufferAttribute(uv,2));geo.setIndex(indices);geo.computeVertexNormals();
          const mesh=new THREE.Mesh(geo,terrainShaderMat);mesh.position.set(p.x,p.y,p.z);mesh.rotation.y=p.rot;mesh.name=p.label+' · 嵌岩台基';envGroup.add(mesh);return mesh;
        }
        // Clip actual terrain triangles against the oriented courtyard footprint.
        // Narrow ridges between sample points therefore cannot emerge through a floor.
        function terrainTopInFootprint(site,halfWidth,halfDepth,offsetZ=0){
          const frame=new THREE.Matrix4().makeRotationY(site.rot);frame.setPosition(site.x,0,site.z);
          const inverse=frame.clone().invert(),bounds=new THREE.Box3();
          for(const sx of [-1,1])for(const sz of [-1,1])bounds.expandByPoint(new THREE.Vector3(sx*halfWidth,0,offsetZ+sz*halfDepth).applyMatrix4(frame));
          const xmin=-halfWidth,xmax=halfWidth,zmin=offsetZ-halfDepth,zmax=offsetZ+halfDepth;let top=-90;
          function clip(poly,axis,limit,sign){
            if(!poly.length)return poly;const result=[];let a=poly[poly.length-1],da=(limit-a[axis])*sign;
            for(const b of poly){
              const db=(limit-b[axis])*sign;
              if((da>=0)!==(db>=0)){const t=da/(da-db);result.push([a[0]+(b[0]-a[0])*t,a[1]+(b[1]-a[1])*t,a[2]+(b[2]-a[2])*t]);}
              if(db>=0)result.push(b);a=b;da=db;
            }
            return result;
          }
          for(const entry of terrainProxies){
            if(entry.bounds.max.x<bounds.min.x||entry.bounds.min.x>bounds.max.x||entry.bounds.max.z<bounds.min.z||entry.bounds.min.z>bounds.max.z)continue;
            const geometry=entry.mesh.geometry,position=geometry.attributes.position,index=geometry.index,matrix=new THREE.Matrix4().multiplyMatrices(inverse,entry.mesh.matrixWorld),e=matrix.elements,transformed=[];
            for(let i=0;i<position.count;i++){
              const x=position.getX(i),y=position.getY(i),z=position.getZ(i);
              transformed.push([e[0]*x+e[4]*y+e[8]*z+e[12],e[1]*x+e[5]*y+e[9]*z+e[13],e[2]*x+e[6]*y+e[10]*z+e[14]]);
            }
            const count=index?index.count:position.count;
            for(let i=0;i<count;i+=3){
              const a=transformed[index?index.array[i]:i],b=transformed[index?index.array[i+1]:i+1],c=transformed[index?index.array[i+2]:i+2];
              if(Math.max(a[1],b[1],c[1])<=top||Math.max(a[0],b[0],c[0])<xmin||Math.min(a[0],b[0],c[0])>xmax||Math.max(a[2],b[2],c[2])<zmin||Math.min(a[2],b[2],c[2])>zmax)continue;
              let poly=[a,b,c];poly=clip(poly,0,xmin,-1);poly=clip(poly,0,xmax,1);poly=clip(poly,2,zmin,-1);poly=clip(poly,2,zmax,1);
              for(const p of poly)top=Math.max(top,p[1]);
            }
          }
          return top;
        }
        for(const p of pavilionPlacements){
          const top=Math.max(terrainTopInFootprint(p,p.w*.86,p.d*.94),terrainTopInFootprint(p,Math.min(1.7,p.w*.17)+.24,1.6,p.d*.91+1.6));
          p.y=Math.max(p.y,top+.75);p.deckY=p.y+2.4;
          const g=createImmortalPavilion(p.w,p.d,p.tiers,p.label);g.position.set(p.x,p.y,p.z);g.rotation.y=p.rot;envGroup.add(g);
          createFittedFoundation(p);
        }
        const mountainRoutes=[],routeGroup=new THREE.Group();routeGroup.name='依山石阶 · 连廊与石拱';envGroup.add(routeGroup);
        function sitePort(index,side){
          const p=pavilionPlacements[index],front=side==='front',sign=side==='left'?-1:1;
          const point=front?sitePoint(p,0,.1,p.d*.91+3.2):sitePoint(p,sign*p.w*.84,2.4,p.d*.58);
          const outward=new THREE.Vector3(front?0:sign,0,front?1:0).applyAxisAngle(new THREE.Vector3(0,1,0),p.rot);
          return {point,outward};
        }
        function routeOffsets(points,i,width){
          const a=points[Math.max(0,i-1)],b=points[Math.min(points.length-1,i+1)],d=b.clone().sub(a);d.y=0;d.normalize();
          return new THREE.Vector3(d.z,0,-d.x).multiplyScalar(width*.46);
        }
        function addRouteArch(a,b,width){
          const dx=b.x-a.x,dz=b.z-a.z,length=Math.hypot(dx,dz);if(length<9)return;
          const n=Math.ceil(length/.95),depth=Math.min(10,length*.23),side=new THREE.Vector3(dz,0,-dx).normalize().multiplyScalar(width*.37);
          for(let k=0;k<n;k++){
            const t0=k/n,t1=(k+1)/n,p=a.clone().lerp(b,t0),q=a.clone().lerp(b,t1);
            p.y-=.70+depth*(1-Math.sin(Math.PI*t0));q.y-=.70+depth*(1-Math.sin(Math.PI*t1));
            for(const sign of [-1,1]){
              const mid=p.clone().add(q).multiplyScalar(.5).addScaledVector(side,sign),dir=q.clone().sub(p),stone=box(routeGroup,.40,.49,dir.length()+.035,mid.x,mid.y,mid.z,stoneDarkMat,.015);
              stone.rotation.set(-Math.atan2(dir.y,Math.hypot(dir.x,dir.z)),Math.atan2(dir.x,dir.z),0,'YXZ');
            }
          }
        }
        function buildMountainRoute(label,knots,width=2.7,bridge=false,woodRail=false,parent=routeGroup){
          const points=[];
          for(let j=0;j<knots.length-1;j++){
            const a=knots[j],b=knots[j+1],length=Math.hypot(b.x-a.x,b.z-a.z),n=Math.max(1,Math.ceil(length/.90));
            for(let k=0;k<n;k++){
              const t=k/n,p=a.clone().lerp(b,t);p.userData={knot:k===0};points.push(p);
            }
          }
          points.push(knots[knots.length-1].clone());
          const startY=points[0].y,endY=points[points.length-1].y;
          for(let i=0;i<points.length;i++){
            const p=points[i],side=routeOffsets(points,i,width),clearance=.58;
            let floor=terrainHeight(p.x,p.z);
            for(const sign of [-1,1])floor=Math.max(floor,terrainHeight(p.x+side.x*sign*1.15,p.z+side.z*sign*1.15));
            p.y=Math.max(p.y,floor+clearance);
          }
          // A bounded grade spreads a rise across neighboring treads instead of
          // leaving a tall slab or an isolated step at a rock seam.
          const grade=.62;
          for(let i=1;i<points.length;i++){const d=Math.hypot(points[i].x-points[i-1].x,points[i].z-points[i-1].z);points[i].y=Math.max(points[i].y,points[i-1].y-grade*d);}
          for(let i=points.length-2;i>=0;i--){const d=Math.hypot(points[i].x-points[i+1].x,points[i].z-points[i+1].z);points[i].y=Math.max(points[i].y,points[i+1].y-grade*d);}
          const endpointError=Math.max(points[0].y-startY,points[points.length-1].y-endY);
          // Ports are exact architectural joints, never adjustable route samples.
          points[0].y=startY;points[points.length-1].y=endY;
          const g=new THREE.Group();g.name=label;parent.add(g);let railDistance=0,supportDistance=0;
          const railNodes=[];
          for(let i=0;i<points.length-1;i++){
            const a=points[i],b=points[i+1],dx=b.x-a.x,dz=b.z-a.z,run=Math.hypot(dx,dz),rise=b.y-a.y,angle=Math.atan2(dx,dz),n=Math.max(1,Math.ceil(run/.64),Math.ceil(Math.abs(rise)/.18));
            for(let k=0;k<n;k++){
              const t=(k+.5)/n,p=a.clone().lerp(b,t),top=a.y+rise*(rise>=0?(k+1)/n:k/n),thick=.25+Math.abs(rise)/n;
              const step=box(g,width,thick,run/n+.016,p.x,top-thick*.5,p.z,stoneTerraceMat,.012);step.rotation.y=angle;
              const nose=box(g,width-.04,.035,.055,p.x,top+.012,p.z,stoneDarkMat);nose.rotation.y=angle;
            }
            const beam=box(g,width*.88,.30,Math.hypot(run,rise)+.025,(a.x+b.x)/2,(a.y+b.y)/2-.34,(a.z+b.z)/2,stoneDarkMat);
            beam.rotation.set(-Math.atan2(rise,run),angle,0,'YXZ');
            railDistance+=run;supportDistance+=run;
            if(i===0||railDistance>=2.0||a.userData?.knot){railNodes.push({p:a.clone(),side:routeOffsets(points,i,width)});railDistance=0;}
            if(supportDistance>7){
              supportDistance=0;const floor=terrainHeight(a.x,a.z),drop=a.y-floor;
              if(drop>1.2&&drop<25){
                box(g,.48,drop-.55,.48,a.x,floor+(drop-.55)/2,a.z,stoneDarkMat,.025);
                const side=routeOffsets(points,i,width);
                for(const sign of [-1,1])rod(g,[a.x,a.y-Math.min(3.2,drop*.65),a.z],[a.x+side.x*sign,a.y-.42,a.z+side.z*sign],.095,carvedTimberMat);
              }
            }
            const incoming=i?points[i].clone().sub(points[i-1]).setY(0).normalize():null;
            const outgoing=b.clone().sub(a).setY(0).normalize();
            if(a.userData?.knot&&i>0&&incoming.dot(outgoing)<.95){
              const landing=new THREE.Mesh(new THREE.CylinderGeometry(width*.58,width*.57,.33,16),stoneTerraceMat);landing.position.set(a.x,a.y-.165,a.z);g.add(landing);
            }
          }
          railNodes.push({p:points[points.length-1].clone(),side:routeOffsets(points,points.length-1,width)});
          const railMat=woodRail?palacePillarMat:stoneTerraceMat,railH=woodRail?1.28:1.02;
          for(let i=0;i<railNodes.length;i++)for(const sign of [-1,1]){
            const {p,side}=railNodes[i],x=p.x+side.x*sign,z=p.z+side.z*sign;
            box(g,.15,railH,.15,x,p.y+railH*.5,z,railMat,.016);box(g,.25,.10,.25,x,p.y+railH+.02,z,railMat,.022);
            if(i<railNodes.length-1){
              const next=railNodes[i+1],q=next.p.clone().addScaledVector(next.side,sign);
              for(const h of [.36,.84])rod(g,[x,p.y+railH*h,z],[q.x,q.y+railH*h,q.z],.047,railMat);
            }
            if(i%7===3&&!woodRail)addHangingLantern(g,x,p.y+.75,z,.62);
          }
          if(bridge)for(let i=0;i<knots.length-1;i++)addRouteArch(knots[i],knots[i+1],width);
          mountainRoutes.push({name:label,points,width,endpointError});return g;
        }
        function connectSites(label,from,fromSide,to,toSide,via=[],bridge=false,width=2.7){
          const a=sitePort(from,fromSide),b=sitePort(to,toSide),stub=2.5;
          const knots=[a.point,a.point.clone().addScaledVector(a.outward,stub),...via.map(v=>new THREE.Vector3(v[0],v[2]??0,v[1])),b.point.clone().addScaledVector(b.outward,stub),b.point];
          const distances=[0];for(let i=1;i<knots.length;i++)distances.push(distances[i-1]+Math.hypot(knots[i].x-knots[i-1].x,knots[i].z-knots[i-1].z));
          for(let i=2;i<knots.length-2;i++)if(via[i-2][2]===undefined)knots[i].y=THREE.MathUtils.lerp(a.point.y,b.point.y,distances[i]/distances[distances.length-1]);
          return buildMountainRoute(label,knots,width,bridge);
        }
        connectSites('青元殿 · 听雪石廊',1,'right',0,'left',[[97,-204]],false,2.6);
        connectSites('青元殿 · 藏剑石廊',0,'right',2,'left',[[130,-201]],false,2.8);
        connectSites('望月 · 问道石拱桥',5,'right',4,'left',[],true,2.5);
        connectSites('问道 · 凌云折阶',4,'right',3,'left',[[87,-115],[83,-103],[74,-108],[78,-116]],false,2.7);
        connectSites('云台 · 松风石阶',8,'right',7,'left',[[117,-45],[127,-48]],false,2.6);
        connectSites('凌云 · 青元登山阶',3,'front',0,'front',[[107,-105,27.5],[123,-119,35.5],[121,-142,39],[119,-167,45],[89,-178,49],[88,-196,56],[112,-201,64]],false,2.8);
        connectSites('凌云 · 归鹤云桥',3,'right',6,'left',[[128,-118],[149,-141]],true,2.8);
        connectSites('归鹤 · 听涛云桥',6,'right',10,'front',[[207,-194],[229,-222]],true,2.6);
        connectSites('藏剑 · 摘星盘山阶',2,'right',9,'front',[[171,-205],[201,-228],[228,-265],[229,-290]],false,2.7);
        connectSites('松涛 · 栖霞折阶',13,'left',12,'front',[[-132,-78],[-156,-102],[-174,-126]],false,2.6);
        connectSites('栖霞 · 望瀑石桥',12,'left',16,'front',[[-178,-154],[-198,-182]],true,2.6);

        // Foreground approach: all treads use the path's local transverse axis.
        const fgCliffGroup=new THREE.Group();fgCliffGroup.name='近景松崖与石阶';envGroup.add(fgCliffGroup);
        function rockChunk(x,y,z,sx,sy,sz,seed){
          const m=new THREE.Mesh(createPeakGeometry(seed,0,true),terrainShaderMat);m.position.set(x,y,z);m.scale.set(sx,sy,sz);m.rotation.y=seed;fgCliffGroup.add(m);
          m.updateMatrix();m.geometry.computeBoundingBox();const proxy=new THREE.Mesh(m.geometry,terrainQueryMaterial);proxy.matrixAutoUpdate=false;proxy.matrixWorld.copy(m.matrix);
          terrainProxies.push({mesh:proxy,bounds:m.geometry.boundingBox.clone().applyMatrix4(m.matrix)});return m;
        }
        function pathPoint(t){return new THREE.Vector3(-17-t*31+Math.sin(t*3.4)*1.8,-25+t*22,27-t*52);}
        for(let i=0;i<15;i++){
          const t=i/14,p=pathPoint(t);rockChunk(p.x,p.y-25,p.z,7.6+craftRandom()*1.3,22,7+craftRandom()*1.4,i*.67);
        }
        rockChunk(-76,-70,-18,18,115,17,1.3);rockChunk(-45,-60,-32,9,54,11,2.1);terrainHeightCache.clear();
        buildMountainRoute('松崖登山石阶',Array.from({length:15},(_,i)=>pathPoint(i/14)),6.4,false,true,fgCliffGroup);
        const foregroundRoute=mountainRoutes[mountainRoutes.length-1];
        function foregroundPathAt(t,offset=0){
          const f=THREE.MathUtils.clamp(t,0,1)*(foregroundRoute.points.length-1),i=Math.min(Math.floor(f),foregroundRoute.points.length-2);
          const p=foregroundRoute.points[i].clone().lerp(foregroundRoute.points[i+1],f-i),side=routeOffsets(foregroundRoute.points,i,2).normalize();return p.addScaledVector(side,offset);
        }
        function createStoneLantern(x,y,z,scale=1){const g=new THREE.Group();g.position.set(x,y,z);g.scale.setScalar(scale);
          box(g,1.3,.35,1.3,0,.18,0,stoneDarkMat,.07);box(g,.85,.3,.85,0,.50,0,stoneTerraceMat,.04);
          rod(g,[0,.65,0],[0,2.7,0],.31,stoneDarkMat,.24);box(g,1.15,.24,1.15,0,2.77,0,stoneTerraceMat,.04);
          box(g,.78,1,.78,0,3.38,0,palaceWindowMat);for(const sx of [-1,1])for(const sz of [-1,1])box(g,.09,1.15,.09,sx*.42,3.38,sz*.42,stoneDarkMat);
          addRoof(g,1.85,1.85,.72,3.92);const h=new THREE.Mesh(new THREE.PlaneGeometry(5,5),warmHaloMat);h.position.set(0,3.4,.5);g.add(h);
          const light=new THREE.PointLight('#ffa64e',1.6,22,2);light.position.y=3.35;g.add(light);return g;}
        for(const [t,s]of [[.40,1.15],[.78,.82]]){const p=foregroundPathAt(t,4.35);fgCliffGroup.add(createStoneLantern(p.x,p.y-.05,p.z,s));}

        const trunkMat=new THREE.MeshStandardMaterial({color:'#514a42',roughness:.94,bumpMap:stoneRelief,bumpScale:.13});
        const needleMat=new THREE.MeshStandardMaterial({color:'#627063',vertexColors:true,roughness:.93,side:THREE.DoubleSide});
        function taperedBranch(points,r0,r1){const curve=new THREE.CatmullRomCurve3(points.map(p=>new THREE.Vector3(...p))),g=new THREE.TubeGeometry(curve,18,1,7,false),p=g.attributes.position,uv=g.attributes.uv;
          for(let i=0;i<p.count;i++){const t=uv.getX(i),c=curve.getPointAt(t),r=r0+(r1-r0)*Math.pow(t,.8);p.setXYZ(i,c.x+(p.getX(i)-c.x)*r,c.y+(p.getY(i)-c.y)*r,c.z+(p.getZ(i)-c.z)*r);}g.computeVertexNormals();return new THREE.Mesh(g,trunkMat);}
        function createAncientPine(scale=1,reach=1,detail=1){const g=new THREE.Group();g.scale.setScalar(scale);
          const sign=Math.sign(reach),trunk=[[0,0,0],[.18*reach,.85,.02],[.44*reach,1.7,.12],[1.05*reach,2.60,.05],[1.70*reach,3.25,-.15],[2.4*reach,3.65,-.12]];
          g.add(taperedBranch(trunk,.30,.035));
          for(let k=0;k<5;k++){const a=k/5*Math.PI*2;g.add(taperedBranch([[.10,.48,0],[Math.cos(a)*.65,.10,Math.sin(a)*.6],[Math.cos(a)*1.25,-.10,Math.sin(a)*.95]],.13,.018));}
          const pads=[[-.65*sign,2.5,.1,1.25,.95],[.72*reach,3.45,-.4,1.6,1.15],[2.3*reach,3.8,-.2,1.75,1.05],[3.4*reach,3.35,.30,1.35,.90],[1.75*reach,2.8,.75,1.30,.90],[.15*reach,2.0,-.65,1.1,.75]];
          const p=[],col=[];
          for(const [x,y,z,rx,rz]of pads){
            g.add(taperedBranch([[.45*reach,1.55,0],[x*.55,y-.25,z*.7],[x,y,z]],.115,.018));
            const clusters=detail?(isMobile?55:96):32;
            for(let k=0;k<clusters;k++){
              const a=craftRandom()*Math.PI*2,r=Math.sqrt(craftRandom()),xx=x+Math.cos(a)*r*rx,zz=z+Math.sin(a)*r*rz,yy=y+(1-r)*.27+craftRandom()*.16;
              const c=.20+craftRandom()*.30;
              for(let j=0;j<7;j++){const an=a+j/7*Math.PI*2,len=.14+craftRandom()*.23,dx=Math.cos(an),dz=Math.sin(an),w=.025;
                p.push(xx-dz*w,yy,zz+dx*w,xx+dx*len,yy+.10+craftRandom()*.10,zz+dz*len,xx+dz*w,yy,zz-dx*w);
                for(let n=0;n<3;n++)col.push(c*.77,c,c*.84);}
              if(k%16===0)g.add(taperedBranch([[x,y-.08,z],[xx,yy-.03,zz]],.024,.004));
            }
          }
          const geo=new THREE.BufferGeometry();geo.setAttribute('position',new THREE.Float32BufferAttribute(p,3));geo.setAttribute('color',new THREE.Float32BufferAttribute(col,3));geo.computeVertexNormals();g.add(new THREE.Mesh(geo,needleMat));return g;}
        const framingPineTopLeft=createAncientPine(6.8,1.1);framingPineTopLeft.position.set(-63,44,-14);framingPineTopLeft.rotation.y=-.35;fgCliffGroup.add(framingPineTopLeft);
        const pinePlacements=[[-45,-7,-32,3.5,1],[-70,48,-60,4.3,1],[-109,111,-99,3,-1],[-78,37,-78,3.4,1],[-58,-14,-18,2.2,1],[-47,17,-96,2.3,-1],[-14,28,-203,2.2,1],
          [41,4,-136,1.5,-1],[69,-2,-126,2,-1],[104,61,-230,2.4,-1],[143,57,-219,2.4,1],[132,156,-287,2.7,1],[175,135,-300,2,-1],[111,124,-280,2,1],[104,17,-131,2,-1],[119,-25,-61,3.2,-1],[136,-25,-66,2.8,1],[174,31,-175,2.2,1],[-112,45,-296,2,1],[206,101,-306,2.3,1],[229,44,-251,1.8,-1],[12,61,-257,1.9,1],[-150,83,-149,2.1,-1],[-90,100,-99,1.8,1],[58,59,-358,1.7,-1],[-62,79,-348,1.7,1],[-180,65,-207,1.9,-1],[250,77,-358,2.2,1],[-232,79,-328,2.1,-1]];
        const architecturalBounds=pavilionPlacements.map(p=>{
          const bounds=new THREE.Box3();
          for(const sx of [-1,1])for(const sz of [-1,1]){
            bounds.expandByPoint(sitePoint(p,sx*p.w*.81,.15,sz*p.d*.85));
            bounds.expandByPoint(sitePoint(p,sx*p.w*.81,17,sz*p.d*.85));
          }
          return bounds;
        });
        function landscapePineClear(tree){
          tree.updateMatrixWorld(true);const bounds=new THREE.Box3().setFromObject(tree);
          if(architecturalBounds.some(b=>b.intersectsBox(bounds)))return false;
          for(const route of mountainRoutes)for(const q of route.points){
            const r=route.width*.5+.3;
            if(q.x+r>bounds.min.x&&q.x-r<bounds.max.x&&q.z+r>bounds.min.z&&q.z-r<bounds.max.z&&q.y+2.7>bounds.min.y&&q.y-.25<bounds.max.y)return false;
          }
          return true;
        }
        for(const [x,y,z,s,dir]of pinePlacements){
          const tree=createAncientPine(s,dir,s>3);tree.position.set(x,y,z);tree.rotation.y=craftRandom()*.8-.4;
          const ground=terrainHeight(x,z);if(ground>-70)tree.position.y=ground-.08;
          if(!landscapePineClear(tree)){
            let best=null,bestCost=Infinity;
            for(const radius of [7,12,18,24])for(let k=0;k<16;k++){
              const angle=k/16*Math.PI*2,qx=x+Math.cos(angle)*radius,qz=z+Math.sin(angle)*radius,qy=terrainHeight(qx,qz);
              if(qy<Math.max(-64,y-34)||qy>y+28)continue;
              tree.position.set(qx,qy-.08,qz);
              if(!landscapePineClear(tree))continue;
              const cost=radius+Math.abs(qy-y)*.45;if(cost<bestCost){bestCost=cost;best=tree.position.clone();}
            }
            if(!best)continue;tree.position.copy(best);
          }
          envGroup.add(tree);
        }
        // Rock-edge moss, grasses and loose chips add scale to the near path.
        const mossMat=new THREE.MeshStandardMaterial({color:'#53624d',roughness:1,side:THREE.DoubleSide});
        const mossP=[];
        for(let k=0;k<260;k++){const t=craftRandom(),p=foregroundPathAt(t,(craftRandom()<.5?-1:1)*(3.7+craftRandom()*1.3)),x=p.x,z=p.z,y=p.y-.20;
          for(let j=0;j<4;j++){const a=craftRandom()*6.28,h=.13+craftRandom()*.45,dx=Math.cos(a)*.18,dz=Math.sin(a)*.18;mossP.push(x-.025,y,z,x+dx,y+h,z+dz,x+.025,y,z);}}
        const mossGeo=new THREE.BufferGeometry();mossGeo.setAttribute('position',new THREE.Float32BufferAttribute(mossP,3));mossGeo.computeVertexNormals();fgCliffGroup.add(new THREE.Mesh(mossGeo,mossMat));

        // Water ribbons split into flowing strands; mist at the foot joins the cloud sea.
        const waterfallMat=new THREE.ShaderMaterial({uniforms:waterUniforms,transparent:true,depthWrite:false,side:THREE.DoubleSide,
          vertexShader:`varying vec2 vUv;varying vec3 vP;void main(){vUv=uv;vec4 p=modelMatrix*vec4(position,1.);vP=p.xyz;gl_Position=projectionMatrix*viewMatrix*p;}`,
          fragmentShader:`varying vec2 vUv;varying vec3 vP;uniform float uTime;${noiseGLSL}
            void main(){float t=1.-vUv.y;float turbulence=noise(vec2(vUv.x*21.,vUv.y*4.+uTime*2.1));
              float strands=pow(noise(vec2(vUv.x*53.+turbulence*2.,vUv.y*6.+uTime*3.8)),1.4);
              float core=exp(-pow((vUv.x-.5)*3.4,2.));float edge=smoothstep(0.,.15,vUv.x)*(1.-smoothstep(.85,1.,vUv.x));
              float fade=smoothstep(0.,.07,vUv.y)*(1.-smoothstep(.97,1.,vUv.y));
              float foam=smoothstep(.63,.99,t)*noise(vec2(vUv.x*17.,vUv.y*12.+uTime));
              vec3 col=mix(vec3(.13,.23,.36),vec3(.63,.75,.85),strands*.72+foam*.3);
              float a=edge*fade*(.17+strands*.65+core*.15);float haze=1.-exp(-length(cameraPosition-vP)*.0013);col=mix(col,vec3(.15,.21,.29),haze);
              gl_FragColor=vec4(col,a);${colorOutput}}
          `});
        const waterfallConfigs=[{x:111,y:26,z:-204,w:9,h:70},{x:121,y:105,z:-266,w:3,h:74},{x:95,y:-8,z:-111,w:5,h:45},{x:78,y:-18,z:-109,w:2.5,h:30},{x:-77,y:12,z:-49,w:5.8,h:111},{x:-108,y:50,z:-76,w:4,h:97},{x:123,y:-40,z:-45,w:3.4,h:39},{x:60,y:18,z:-352,w:3.6,h:78},{x:-60,y:34,z:-342,w:3,h:86},{x:206,y:52,z:-297,w:3.2,h:88},{x:-176,y:26,z:-198,w:2.8,h:64}];
        for(const wf of waterfallConfigs){const g=new THREE.PlaneGeometry(wf.w,wf.h,10,48),p=g.attributes.position,uv=g.attributes.uv;
          for(let k=0;k<p.count;k++){const t=1-uv.getY(k),s=uv.getX(k)-.5;p.setXYZ(k,p.getX(k)*(1+t*.42)+Math.sin(t*10+wf.x)*.22,p.getY(k),Math.pow(t,2)*3.1+Math.sin(s*18+t*4)*.12);}
          g.computeVertexNormals();const m=new THREE.Mesh(g,waterfallMat);m.position.set(wf.x,wf.y,wf.z);m.name='分股飞瀑';envGroup.add(m);}
        const cloudSeaMat=new THREE.ShaderMaterial({uniforms:cloudSeaUniforms,transparent:true,depthWrite:false,side:THREE.DoubleSide,
          vertexShader:`varying vec3 vP;varying float vBillow;uniform float uTime;${noiseGLSL}
            void main(){vec3 p=position;vBillow=noise(p.xy*.028+vec2(uTime*.012,0.));p.z+=vBillow*6.;vec4 w=modelMatrix*vec4(p,1.);vP=w.xyz;gl_Position=projectionMatrix*viewMatrix*w;}`,
          fragmentShader:`varying vec3 vP;varying float vBillow;uniform float uTime;${noiseGLSL}
            void main(){vec2 p=vP.xz*.018+vec2(uTime*.007,-uTime*.003);float a=fbm(p),b=fbm(p*2.8+a*.8);
              float billow=smoothstep(.24,.78,a*.68+b*.32);float crest=smoothstep(.47,.76,a*.65+vBillow*.35);
              vec3 col=mix(vec3(.038,.058,.098),vec3(.145,.195,.275),billow);col=mix(col,vec3(.32,.39,.50),crest*.62);
              float curve=vP.x+22.-sin(vP.z*.024)*25.;float vein=exp(-curve*curve*.0015)*(1.-smoothstep(-300.,-95.,vP.z))*smoothstep(-600.,-200.,vP.z);
              float curve2=vP.x-120.+sin(vP.z*.017+2.1)*46.;float vein2=exp(-curve2*curve2*.0011)*(1.-smoothstep(-460.,-140.,vP.z))*smoothstep(-900.,-260.,vP.z);
              float curve3=vP.x+210.-sin(vP.z*.021+4.4)*38.;float vein3=exp(-curve3*curve3*.0013)*(1.-smoothstep(-420.,-120.,vP.z))*smoothstep(-860.,-280.,vP.z);
              col+=vec3(.012,.065,.10)*vein*(1.-crest);col+=vec3(.022,.115,.175)*vein2*(1.-crest);col+=vec3(.017,.085,.150)*vein3*(1.-crest);
              float fade=1.-smoothstep(1350.,2200.,length(vP.xz));float nearFade=1.-smoothstep(-4.,45.,vP.z);
              float alpha=(.60+billow*.36)*fade*nearFade;gl_FragColor=vec4(col,alpha);${colorOutput}}
          `});
        const cloudSeaUpper=new THREE.Mesh(new THREE.PlaneGeometry(3800,3800,isMobile?96:176,isMobile?96:176),cloudSeaMat);
        cloudSeaUpper.rotation.x=-Math.PI/2;cloudSeaUpper.position.set(0,-38,-520);cloudSeaUpper.name='流动云海上层';envGroup.add(cloudSeaUpper);
        const cloudSeaLower=new THREE.Mesh(new THREE.PlaneGeometry(3800,3800,80,80),cloudSeaMat);cloudSeaLower.rotation.x=-Math.PI/2;cloudSeaLower.position.set(0,-57,-520);envGroup.add(cloudSeaLower);
        // Soft billboards form low, irregular banks between the actual rock columns.
        const mistBankMat=new THREE.ShaderMaterial({uniforms:cloudSeaUniforms,transparent:true,depthWrite:false,
          vertexShader:`varying vec2 vUv;varying float vSeed;varying vec3 vP;void main(){vUv=uv;vec4 c=modelMatrix*instanceMatrix*vec4(0,0,0,1.);vSeed=fract(c.x*.037+c.z*.023);
            float sx=length(instanceMatrix[0].xyz),sy=length(instanceMatrix[1].xyz);vec4 mv=viewMatrix*c;mv.xy+=position.xy*vec2(sx,sy);vP=c.xyz;gl_Position=projectionMatrix*mv;}`,
          fragmentShader:`varying vec2 vUv;varying float vSeed;varying vec3 vP;uniform float uTime;${noiseGLSL}
            void main(){vec2 p=(vUv-.5)*2.;float n=fbm(vUv*4.5+vec2(vSeed*20.+uTime*.009,0.));float d=length(p*vec2(.86,1.1));
              float edge=1.-smoothstep(.28+n*.25,.83+n*.18,d);float billow=smoothstep(.20,.75,n);
              float a=edge*(.10+billow*.29);vec3 col=mix(vec3(.080,.12,.18),vec3(.32,.39,.49),billow);col+=vec3(.03,.04,.05)*(1.-vUv.y);
              gl_FragColor=vec4(col,a);${colorOutput}}
          `});
        const mistBankPlacements=[];
        for(let i=0;i<120;i++){const z=-55-(i%12)*88-craftRandom()*40,x=(craftRandom()-.5)*(340+Math.abs(z)*1.35);mistBankPlacements.push({x,y:-28+craftRandom()*15,z,sx:(60+craftRandom()*130)*ENV_SCALE,sy:(12+craftRandom()*22)*ENV_SCALE});}
        for(const w of waterfallConfigs)mistBankPlacements.push({x:w.x,y:w.y-w.h*.5+2,z:w.z+5,sx:w.w*4*ENV_SCALE,sy:12*ENV_SCALE});
        const mistBanksInstanced=new THREE.InstancedMesh(new THREE.PlaneGeometry(1,1),mistBankMat,mistBankPlacements.length);
        mistBankPlacements.forEach((p,i)=>{envDummy.position.set(p.x,p.y,p.z);envDummy.rotation.set(0,0,0);envDummy.scale.set(p.sx,p.sy,1);envDummy.updateMatrix();mistBanksInstanced.setMatrixAt(i,envDummy.matrix);});mistBanksInstanced.frustumCulled=false;envGroup.add(mistBanksInstanced);
        const spiritCount=240,spiritGeo=new THREE.BufferGeometry(),spiritArr=new Float32Array(spiritCount*3);
        for(let i=0;i<spiritCount;i++){spiritArr[i*3]=(craftRandom()-.5)*460;spiritArr[i*3+1]=(craftRandom()-.5)*150;spiritArr[i*3+2]=-40-craftRandom()*420;}
        spiritGeo.setAttribute('position',new THREE.BufferAttribute(spiritArr,3));
        const spiritPoints=new THREE.Points(spiritGeo,new THREE.PointsMaterial({size:.19,color:'#c5d8e7',transparent:true,opacity:.33,depthWrite:false}));scene.add(spiritPoints);
        batchStaticModel(envGroup,[],true);


        // 4. 72把青竹蜂云主剑与288道透明淡绿剑影建模
        function appendGeometry(targetPositions, targetUvs, srcGeo, uMin, uMax, vMin, vMax) {
          const nonIdx = srcGeo.index ? srcGeo.toNonIndexed() : srcGeo;
          const posArr = nonIdx.attributes.position.array;
          const uvAttr = nonIdx.attributes.uv;
          const count = posArr.length / 3;
          for (let i = 0; i < count; i++) {
            targetPositions.push(posArr[i * 3], posArr[i * 3 + 1], posArr[i * 3 + 2]);
            if (targetUvs) {
              const u0 = uvAttr ? uvAttr.getX(i) : 0.5;
              const v0 = uvAttr ? uvAttr.getY(i) : 0.5;
              targetUvs.push(THREE.MathUtils.lerp(uMin, uMax, u0), THREE.MathUtils.lerp(vMin, vMax, v0));
            }
          }
        }

        const SWORD_REFERENCE_IMAGE="data:image/jpeg;base64,/9j/4AAQSkZJRgABAQAAAQABAAD/4gHYSUNDX1BST0ZJTEUAAQEAAAHIAAAAAAQwAABtbnRyUkdCIFhZWiAH4AABAAEAAAAAAABhY3NwAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAQAA9tYAAQAAAADTLQAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAlkZXNjAAAA8AAAACRyWFlaAAABFAAAABRnWFlaAAABKAAAABRiWFlaAAABPAAAABR3dHB0AAABUAAAABRyVFJDAAABZAAAAChnVFJDAAABZAAAAChiVFJDAAABZAAAAChjcHJ0AAABjAAAADxtbHVjAAAAAAAAAAEAAAAMZW5VUwAAAAgAAAAcAHMAUgBHAEJYWVogAAAAAAAAb6IAADj1AAADkFhZWiAAAAAAAABimQAAt4UAABjaWFlaIAAAAAAAACSgAAAPhAAAts9YWVogAAAAAAAA9tYAAQAAAADTLXBhcmEAAAAAAAQAAAACZmYAAPKnAAANWQAAE9AAAApbAAAAAAAAAABtbHVjAAAAAAAAAAEAAAAMZW5VUwAAACAAAAAcAEcAbwBvAGcAbABlACAASQBuAGMALgAgADIAMAAxADb/2wBDAAEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQH/2wBDAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQH/wAARCAFsBSgDASIAAhEBAxEB/8QAHwABAAAGAwEBAAAAAAAAAAAAAAUGBwgJCgIDBAEL/8QAURAAAQMDAwMCBAIHBQUFBAgHAQACAwQFEQYHEgghMRNBCRQiURVhCiMycYGRoRZCsdHwFyRSweEYJTOi8RkmNUMaNDZEU2KCgycoVGRzkqT/xAAdAQEAAgMBAQEBAAAAAAAAAAAAAgMBBAUGBwgJ/8QAVBEAAQMCBAQDAwcIBgYHCAMAAQACEQMhBAUxQQYSUWEHE3EigZEUIzKhsdHwFRYXJEJSYsElM0NE4fEIJjRTVIJFRlVWY3KSGDU2ZIOiwtKTlLP/2gAMAwEAAhEDEQA/AN/hEREREREREREREREREREREREREREREREREREREREREREREREREREREREREREREREREREREREREREREREREREREREREREREREREREREREREREREREREREREREREREREREREREREREREREREREREREREREREREREREREREREREREREREREREREREREREREREREREREREREREREREREREREREREREREREREREREREREREREREREREREREREREREREREREREREREREREREREREREREREREREREREREREREREREREREREREREREREREREREREREREREREREREREREREREREREREREREREREREREREREREREREREREREREREREREREREREREREREREREREREREREREREREREREREREREREREREREREREREREREREREREREREREREREREREREREREREREREREREREREREREREREREREREREREREREREREREREREREREREREREREREREREREREREREREREREREREREREREREREREREREREREREREREREREREREREREREREREREREREREREREREREREREREREREREREREREREREREREREREREREREREREREREREREREREREREREREREREREREREREREREREREREREREREREREREREREREREREREREREREREREREREREREREREREREREREREREREREREREREREREREREREREREREREREREREREREREREREREREREREREREREREREREREREREREREREREREREREREREREREREREREREREREREREREREREREREREREREREREREREREREREREREREREREREREREREREREREREREREREREREREREREREREREREREREREREREREREREREREREREREREREREREREREREREREREREREREREREREREREREREREREREREREREREREREREREREREREREREREREREREREREREREREREREREREREREREREREREREREREREREREREREREREREREREREREREREREREREREREREREREREREREREREREREREREREREREREREREREREREREREREREREREREREREREREREREREREREREREREREREREREREREREREREREREREREREREREREREREREREREREREREREREREREREREREREREREREREREREREREREREREREREREREREREREREREREREREREREREREREREREREREREREREREREREREREREREREREREREREREREREREREREREREREREREREREREREREREREREREREREREREREREREREREREREREREREREREREREREREREREREREREREREREREREREREREREREREREREREREREREREREREREREREREREREREREREREREREREREREREREREREREREREREREREREREREREREREREREREREREREREREREREREREREREREREREREREREREREREREREREREREREREREREREREREREREREREREREREREREREREREREREREREREREREREREREREREREREREREREREREREREREREREREREREREREREREREREREREREREREREREREREREREREREREREREREREREREREREREREREREREREREREREREREREREREREREREREREREREREREREREREREREREREREREREREREREREREREREREREREREREREREREREREREREREREREREREREREREREREREREREREREREREREREREREREREREREREREREREREREREREREREREREREREREREREREREREREREREREREREREREREREREREREREREREREREREREREREREREREREREREREREREREREREREREREREREREREREREREREREREREREREREREREREREREREREREREREREREREREREREREREREREREREREREREREREREREREREREREREREREREREREREREREREREREREREREREREREREREREREREREREREREREREREREREREREREREREREREREREREREREREREREREREREREREREREREREREREXwkDyfKIvqL5kZ45GSMgZGSB5OPOPzQuaPLgMYzkgYz48/f2RF9RPPhERERERERERERERERERERERERERERERERERERERERERERERERERERERERERERERERERERERERERERERERERERERERERERERERERERERERERERERERERERERERERERERERERERERERERERERERERERERERERERERERERERERERERERERERERERERERERERERERERERERERERERERERERERERERERERERERERERERERERERERERERERERERERERERERERERERERERERERERERERERERERERERERERERERERERERERERERERERERERERERERERCQBk9gFZf1J9f3ST0o3Cis++e8umNFXmvhdPTWuaoNdXiNj3xn16OgE9RTPD2nDJ443EFrsYc0m8uZ7Y4ZHvxxYxz3Z8YY0uP+C/LI+PTpJ2/vxMt7rnbKaSporVfTZ4HBhkYZ32yzziVga0lrBl7TyAJOfIxnYw1FtZ5a4kANJtE2E77dVwc/4iy/hzDU8VmNUU6VSq2kCSAS5xAAE73+xbpmpv0jz4WllbMyi3yl1Jd4jKKe3W7SmrKR1TBC8sqJYbjUWN9I5scjWtLA4ueXAt8d8MnVV+lm0to6jtI6B6VNuI9Z7Sw3jSTNWayvTaOd19o7nLQSXu3WeCsit1Zaq22sfWUHzVTDURmoDZo43MbxOsNo3o81TL02WffnSlHbNw9LWqS42jcvTdHR1DtTbWVouFe2huMPzXy8EtqdbbfNdK1lsZcZec0IJZLyiVoezeyd/u10vtTb7c5x0/eJr9NI2FzhBQiqnuEb5cYMUklMwPcH8XNIIe1rgWjz+UZoMwxeLwryznoOcwCm64LTo8RIMQYOoIImYG1nuOfleT4XNKTWubiXUizn+iadQAg27OG/U9F+z9tJryn3S2u273JpaKS3U2vdFaa1fBb5pI5paGHUVnpLrHSSyxNbHI+nZVCJz2Na15aXNaAQFUHkM4z3/j7K0vohnrHdH/Tg+qf6kp2Z2z45PiJ2kbOGDvnOGkfxwVdgwHOfYf1XZIgkdFv0Khq0KNUiDUpseR3c0H+a7URFhWoiIiIiIiIiIiIiIiIiIiIiIiIiIiIiIiIiIiIiIiIiIiIiIiIiIiIiIiIiIiIiIiIiIiIiIiIiIiIiIiIiIiIiIiIiIiIiIiIiIiIiIiIiIiIiIiIiIiIiIiIiIiIiIiIiIiIiIiIiIiIiIiIiIiIiIiIiIiIiIiIiIiIiIiIiIiIiIiIiIiIiIiIiIiIiIiIiIiIiIiIiIiIiIiIiIiIiIiIiIiIiIiIiIiIiIiIiIiIiIiIiIiIiIiIiIiIiIiIiIiIiIiIiIiIiIiIiIiIiIiIiIiIiIiIiIiIiIiIiIiIiIiIiIiIiIiIiIiKFXyR0NnukrO7o7fWPbnxybTSkZ/iAtFTbTazSu+u9PW9uRr2wUt1vNm3nFhoal0ZlbRxv0lZ6tsIc54c2IuHqO7F2Xdu3Zb0ep5HRacv0rAS6KzXSRoAyS5lBUOaAPuSBj960jPh+aqu2otF9cWoLpZ6y2Xa49SRqZn1kPpufFBo+kpWyYcXD0cQsy4Ad8fcrcwT2tqwXAEtfAm59nb8WXwHx7puq5Fl7YcWHMaQIaSLh1Igkgjc2vsbdba+nnTFi0ZpnpivGmLnddP3rTUe7FZqzbOjbRmj6mNN0+51ZLV2itp545nVboaVsGm4xT1NqeI3lgk5H1RSHaDbDbSC+/EIm0LYqe1Uz6a2XSgt/pjjYLjqnT+pLndbEz65DGbfXyuoZWB8ha+n4tkdjkbtNo9vaLVXSLsnvhT2TUFfuh0h3PdbXWzTTSGOy7n3+h3Kv2p6bRElTBM2WsqLtc2soIaOKCQytge0kFuDbb0zz0tNpfrRvE00kt61jc9Pat1LDUNaya1X7U1s1Deb1p5zGkemyw3GuqrU1jmtka2ma2RvPIXyng4zxdnvzhI560NgAAt5SOV0kkwTJLQAdJvH0rjyo5nhhk1cEDkweEggkHmFNoj3QN9JkRdb2PRVTy03SN06QTgCaDZvbOCUDOA+LSlnY8AHvgEe/f2V16th6NnCbpc2IJALHbX6H4Dv9LWaatZYPbsBjH9fzueX0x/0netvTb6l6TKXF+V5c46uwWGPxos179UREUV0EREREREREREREREREREREREREREREREREREREREREREREREREREREREREREREREREREREREREREREREREREREREREREREREREREREREREREREREREREREREREREREREREREREREREREREREREREUeZvUfj/P7ehRF8yPuP5hcXYI7EefuF14P5fzH+azIO/4t94+KLvRcW/sj/PPv+S+kgeSgIOhBRfUXDkSQG47/AHz+a5DPvj+Gf+ayo8wOgJ7xZfUTP+sFfCfIGMj75RZJj8XPovqLjkju4tA/LOV8LwPHf+n/ACRBfY+hF1zRcA/JxjH55/6LmsSBuPxH3j7VlERFjnbIEiToPVERcQ8H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IiIiIiIiIiIiIiIiIiIiIiIiIiIiIiIiIiIiIiIiIiIiIiIiIiIiIiIiIiIiIiIiIiIiIiIiIiIiIiIiIiIiIiIiIiIiIiIiIiIuLvGcZx3xkDP8T+//ANfC02/0hToE6n92t19P7rbG7XXDc6x3Kx1UV0jstZb6Gpt1zdWymKmnbXVMb5nPpYWyiSKIxhrw0u5A53IpW8o3NyRkeR5HfyP9eF1+m2Qs9T6/T7gOAILh/eIOe/5/ZSa4t5gP2m8p9CQf5LSx2X4bMaTaOKZ5lNr21AJiHN0Mr8o6wbXdROwmgtP6U3p2E3ctl9251LHqexUtjtldcYq+OGsrLk6wVU1qt9xglorjNVR/MxOkjheWASOGBjGjuFrfdK4buatv+u9Da807U6gudrnpIrppPUNI2loYQ8UtO6Sa3tYRT08kUWWua3DOwAwB+06+kp5g9s8EcjXji5r2NcOJzlv7iPPhW+7odJ/TjvLUevujs7ojXEgYI3Ov1qbVFzA1rW5Iez9hrQGgYGB9wvMUckweBzSvmoaflFdr2c5J5WB5bMARrAJ6R7lsZhRpY3KqWVGn81TDQBzRMRy6NMcvYX6hSX0FOjb0Y9NDhP6xl2T20mcfTkicx82jrK4xPZIA4Pa48XZA75GBhXeMPt9zn+n/AEUA0xpbT+jtP2vS+mLRR2PT1ioKS2We00EfpUdvoKCBlPR0tNHk8IaeCKOONuThrGjJwo6AOJPuD/l/mvSNMtB1kAz1SiwUqDKcGabGtHSGCB3uB06LuRdcfv8Aw/5rsWVNpkT7kRERSREREREREREREREREREREREREREREREREREREREREREREREREREREREREREREREREREREREREREREREREREREREREREREREREREREREREREREREREREREREREREREREREREREREREREREREREREREREREREREREREREREREREREREREREREREREREREREREREREREREREREREREREREREREREREREREREREREREREREREREREREREREREREREREREREREREREREREREREREREREREREREREREREREREREREREREREREREREREQjPYr4GgeAvqIiL4Wg+QvqKLmNeIcAR0KIvmABjHZfUUtNETAHgAIiIkAaCEREREREREREREREREREREREREREREREREREREREREREREREREREREREREREREREREREREREREREREREREREREREREREREREREREREREREREREREREREREREREREREREREREREREREREREREREREREREREREREREREREREREREREREREREREREREREREREREREREREREREREREREREREREREREREREREREREREREREREREREREREREREREREREREREREREREREREREREREREREREREREREREREREREREREREREREREREREREREREREREREREREREREREREREREREREREREREREREREREREREREREREREREREREREREREREREREREREREREREREREREREREREREREREREREREREREREREREREREREREREREREREREREREREREREREREREREREREREREREREREREREREREREREREREREREREREREREREREREREREREREREREREREREREREREREREREREREREREREREREREREREREREREREREREREREREREREREREREREREREREREREREREREREREREREREREREREREREREREREREREREREREREREREREREREREREREREREREREREREREREREREREREREREREREREREREREREREREREREREREREREREREREREREREREREREREREREREREREREREREREREREREREREREREREREREREREREREREREREREREREREREREREREREREREREREREREREREREREREREREREREREREREREREREREREREREREREREREREREREREREREREREREREREREREREREREREREREREREREREREREREREREREREREREREREREREREREREREREREREREREREREREREREREREREREREREREREREREREREREREREREREREREREREREREREREREREREREREREREREREREREREREREREREREREREREREREREREREREREREREREREREREREREREREREREREREREREREREREREREREREREREREREREREREREREREREREREREREREREREREREREREREREREREREREREREREREREREREREREREREREREREREREREREREREREREREREREREREREREREREREREREREREREREREREREREREREREREREREQX+v6jCIiIiIiIiIiIiIiIiIiIiIiIiIiIiIiIiIiIiIiIiIiIiIiIiIiIiIiIiIiIiIiIiIiIiIiIiIiIiIiIiIiIiIiIiIiIiIiIiIiIiIiIiIiIiIiIiIiIiIiIiIiIiIiIiIiIiIiIiL/2Q==";
        const SWORD_TRACE=[[68,193.8,198.2],[69,193.8,199.2],[70,192.8,199.2],[71,192.8,199.2],[72,192.8,199.2],[73,191.8,200.2],[74,191.8,200.2],[75,191.8,200.2],[76,191.8,201.2],[77,191.8,201.2],[78,190.8,201.2],[79,190.8,202.2],[80,190.8,202.2],[81,189.8,202.2],[82,189.8,202.2],[83,189.8,203.2],[84,189.8,203.2],[85,188.8,203.2],[86,188.8,204.2],[87,188.8,204.2],[88,188.8,204.2],[89,187.8,204.2],[90,187.8,205.2],[91,187.8,205.2],[92,187.8,205.2],[93,187.8,205.2],[94,187.8,206.2],[95,187.8,206.2],[96,186.8,206.2],[97,186.8,206.2],[98,186.8,207.2],[99,186.8,207.2],[100,185.8,207.2],[101,185.8,207.2],[102,184.8,208.2],[103,184.8,208.2],[104,185.8,208.2],[105,184.8,208.2],[106,183.8,209.2],[107,183.8,209.2],[108,183.8,209.2],[109,183.8,209.2],[110,183.8,210.2],[111,183.8,210.2],[112,183.8,210.2],[113,183.8,210.2],[114,183.8,211.2],[115,182.8,211.2],[116,182.8,211.2],[117,182.8,211.2],[118,181.8,211.2],[119,181.8,212.2],[120,181.8,212.2],[121,181.8,212.2],[122,181.8,212.2],[123,181.8,212.2],[124,180.8,212.2],[125,180.8,213.2],[126,180.8,213.2],[127,180.8,213.2],[128,180.8,213.2],[129,180.8,214.2],[130,180.8,214.2],[131,180.8,214.2],[132,178.8,214.2],[133,178.8,214.2],[134,178.8,214.2],[135,179.8,215.2],[136,179.8,215.2],[137,179.8,215.2],[138,179.8,215.2],[139,178.8,215.2],[140,178.8,216.2],[141,178.8,216.2],[142,178.8,216.2],[143,178.8,216.2],[144,178.8,216.2],[145,178.8,216.2],[146,178.8,216.2],[147,177.8,217.2],[148,177.8,217.2],[149,177.8,217.2],[150,177.8,218.2],[151,174.8,218.2],[152,177.8,218.2],[153,174.8,218.2],[154,174.8,218.2],[155,174.8,218.2],[156,177.8,218.2],[157,177.8,219.2],[158,177.8,219.2],[159,177.8,220.2],[160,177.8,220.2],[161,173.8,220.2],[162,173.8,220.2],[163,173.8,220.2],[164,173.8,220.2],[165,173.8,220.2],[166,173.8,220.2],[167,173.8,220.2],[168,173.8,220.2],[169,173.8,221.2],[170,173.8,221.2],[171,173.8,221.2],[172,172.8,221.2],[173,172.8,221.2],[174,172.8,221.2],[175,172.8,221.2],[176,172.8,221.2],[177,172.8,221.2],[178,173.8,222.2],[179,175.8,222.2],[180,175.8,222.2],[181,175.8,222.2],[182,171.8,222.2],[183,171.8,222.2],[184,171.8,222.2],[185,171.8,222.2],[186,171.8,222.2],[187,171.8,222.2],[188,171.8,222.2],[189,171.8,223.2],[190,171.8,223.2],[191,171.8,223.2],[192,171.8,223.2],[193,171.8,223.2],[194,171.8,223.2],[195,171.8,223.2],[196,171.8,223.2],[197,170.8,223.2],[198,170.8,223.2],[199,170.8,223.2],[200,170.8,223.2],[201,170.8,223.2],[202,170.8,223.2],[203,170.8,223.2],[204,170.8,223.2],[205,170.8,223.2],[206,170.8,223.2],[207,171.8,223.2],[208,171.8,224.2],[209,170.8,224.2],[210,170.8,224.2],[211,170.8,224.2],[212,170.8,224.2],[213,171.8,224.2],[214,171.8,224.2],[215,171.8,224.2],[216,171.8,224.2],[217,171.8,224.2],[218,171.8,224.2],[219,171.8,224.2],[220,171.8,224.2],[221,170.8,224.2],[222,170.8,224.2],[223,170.8,224.2],[224,170.8,224.2],[225,170.8,224.2],[226,170.8,224.2],[227,170.8,224.2],[228,170.8,224.2],[229,170.8,224.2],[230,169.8,224.2],[231,169.8,223.2],[232,169.8,224.2],[233,169.8,224.2],[234,169.8,224.2],[235,169.8,224.2],[236,170.8,224.2],[237,170.8,224.2],[238,170.8,224.2],[239,169.8,224.2],[240,169.8,224.2],[241,169.8,224.2],[242,170.8,224.2],[243,170.8,224.2],[244,169.8,224.2],[245,169.8,224.2],[246,170.8,224.2],[247,170.8,224.2],[248,170.8,224.2],[249,169.8,224.2],[250,169.8,224.2],[251,169.8,224.2],[252,169.8,224.2],[253,169.8,224.2],[254,169.8,224.2],[255,169.8,224.2],[256,169.8,224.2],[257,169.8,224.2],[258,169.8,224.2],[259,169.8,224.2],[260,169.8,224.2],[261,169.8,224.2],[262,170.8,224.2],[263,170.8,224.2],[264,170.8,224.2],[265,170.8,224.2],[266,170.8,224.2],[267,169.8,224.2],[268,169.8,224.2],[269,169.8,224.2],[270,169.8,224.2],[271,169.8,224.2],[272,170.8,224.2],[273,170.8,224.2],[274,170.8,224.2],[275,170.8,224.2],[276,170.8,224.2],[277,170.8,224.2],[278,169.8,225.2],[279,169.8,225.2],[280,169.8,225.2],[281,169.8,225.2],[282,169.8,225.2],[283,169.8,225.2],[284,169.8,225.2],[285,169.8,225.2],[286,169.8,225.2],[287,170.8,225.2],[288,170.8,225.2],[289,169.8,225.2],[290,169.8,225.2],[291,169.8,225.2],[292,169.8,225.2],[293,169.8,225.2],[294,169.8,225.2],[295,170.8,225.2],[296,169.8,225.2],[297,169.8,225.2],[298,169.8,225.2],[299,169.8,225.2],[300,169.8,225.2],[301,169.8,225.2],[302,169.8,225.2],[303,169.8,225.2],[304,169.8,225.2],[305,169.8,225.2],[306,169.8,225.2],[307,169.8,225.2],[308,169.8,225.2],[309,170.8,225.2],[310,170.8,225.2],[311,170.8,225.2],[312,170.8,225.2],[313,169.8,225.2],[314,169.8,225.2],[315,169.8,225.2],[316,169.8,225.2],[317,169.8,225.2],[318,169.8,225.2],[319,169.8,225.2],[320,169.8,225.2],[321,169.8,225.2],[322,169.8,225.2],[323,169.8,225.2],[324,169.8,225.2],[325,169.8,225.2],[326,169.8,225.2],[327,169.8,225.2],[328,169.8,225.2],[329,169.8,225.2],[330,169.8,225.2],[331,169.8,225.2],[332,169.8,225.2],[333,169.8,225.2],[334,169.8,225.2],[335,169.8,225.2],[336,169.8,226.2],[337,169.8,226.2],[338,169.8,226.2],[339,169.8,226.2],[340,169.8,225.2],[341,169.8,225.2],[342,169.8,225.2],[343,169.8,226.2],[344,169.8,226.2],[345,169.8,226.2],[346,169.8,226.2],[347,169.8,226.2],[348,169.8,226.2],[349,169.8,226.2],[350,169.8,226.2],[351,169.8,226.2],[352,169.8,226.2],[353,169.8,226.2],[354,169.8,226.2],[355,169.8,226.2],[356,169.8,226.2],[357,170.8,226.2],[358,169.8,226.2],[359,169.8,226.2],[360,170.8,225.2],[361,169.8,225.2],[362,169.8,226.2],[363,169.8,226.2],[364,169.8,226.2],[365,169.8,225.2],[366,169.8,226.2],[367,169.8,226.2],[368,169.8,226.2],[369,169.8,226.2],[370,169.8,226.2],[371,169.8,227.2],[372,169.8,227.2],[373,169.8,226.2],[374,169.8,226.2],[375,169.8,226.2],[376,169.8,226.2],[377,168.8,226.2],[378,168.8,226.2],[379,169.8,226.2],[380,169.8,226.2],[381,169.8,226.2],[382,169.8,226.2],[383,169.8,226.2],[384,169.8,226.2],[385,169.8,226.2],[386,169.8,226.2],[387,169.8,227.2],[388,169.8,227.2],[389,169.8,227.2],[390,169.8,227.2],[391,168.8,227.2],[392,168.8,227.2],[393,168.8,227.2],[394,168.8,227.2],[395,168.8,227.2],[396,168.8,227.2],[397,168.8,227.2],[398,168.8,227.2],[399,168.8,227.2],[400,168.8,227.2],[401,168.8,227.2],[402,168.8,227.2],[403,168.8,227.2],[404,168.8,227.2],[405,168.8,227.2],[406,168.8,227.2],[407,168.8,227.2],[408,168.8,227.2],[409,168.8,227.2],[410,168.8,227.2],[411,168.8,227.2],[412,168.8,227.2],[413,167.8,227.2],[414,168.8,227.2],[415,168.8,227.2],[416,168.8,227.2],[417,169.8,227.2],[418,169.8,227.2],[419,168.8,227.2],[420,168.8,227.2],[421,169.8,227.2],[422,169.8,227.2],[423,168.8,227.2],[424,168.8,227.2],[425,168.8,227.2],[426,168.8,227.2],[427,168.8,227.2],[428,168.8,227.2],[429,168.8,227.2],[430,168.8,227.2],[431,168.8,228.2],[432,168.8,228.2],[433,168.8,228.2],[434,168.8,227.2],[435,168.8,227.2],[436,168.8,227.2],[437,168.8,228.2],[438,167.8,228.2],[439,167.8,228.2],[440,167.8,228.2],[441,167.8,228.2],[442,168.8,228.2],[443,168.8,228.2],[444,167.8,228.2],[445,168.8,228.2],[446,168.8,228.2],[447,168.8,228.2],[448,168.8,228.2],[449,168.8,228.2],[450,168.8,228.2],[451,168.8,228.2],[452,167.8,228.2],[453,167.8,228.2],[454,167.8,228.2],[455,168.8,228.2],[456,168.8,228.2],[457,168.8,228.2],[458,168.8,228.2],[459,168.8,227.2],[460,168.8,228.2],[461,168.8,228.2],[462,168.8,228.2],[463,168.8,228.2],[464,168.8,228.2],[465,168.8,228.2],[466,168.8,228.2],[467,168.8,228.2],[468,168.8,228.2],[469,168.8,228.2],[470,168.8,228.2],[471,168.8,228.2],[472,167.8,228.2],[473,167.8,228.2],[474,167.8,228.2],[475,167.8,228.2],[476,167.8,228.2],[477,167.8,228.2],[478,168.8,228.2],[479,168.8,228.2],[480,167.8,228.2],[481,167.8,228.2],[482,167.8,228.2],[483,167.8,228.2],[484,167.8,228.2],[485,167.8,228.2],[486,167.8,228.2],[487,167.8,228.2],[488,167.8,228.2],[489,167.8,228.2],[490,167.8,228.2],[491,167.8,228.2],[492,167.8,228.2],[493,167.8,228.2],[494,168.8,228.2],[495,168.8,228.2],[496,168.8,228.2],[497,168.8,228.2],[498,168.8,228.2],[499,167.8,228.2],[500,167.8,228.2],[501,167.8,228.2],[502,167.8,228.2],[503,167.8,228.2],[504,167.8,229.2],[505,166.8,229.2],[506,167.8,229.2],[507,167.8,229.2],[508,167.8,229.2],[509,167.8,229.2],[510,167.8,229.2],[511,167.8,229.2],[512,167.8,228.2],[513,167.8,229.2],[514,167.8,229.2],[515,166.8,229.2],[516,166.8,229.2],[517,166.8,229.2],[518,167.8,229.2],[519,167.8,229.2],[520,167.8,229.2],[521,167.8,229.2],[522,167.8,229.2],[523,167.8,229.2],[524,167.8,229.2],[525,168.8,229.2],[526,168.8,229.2],[527,168.8,229.2],[528,166.8,229.2],[529,166.8,229.2],[530,166.8,229.2],[531,166.8,229.2],[532,166.8,229.2],[533,166.8,229.2],[534,166.8,229.2],[535,166.8,229.2],[536,166.8,229.2],[537,166.8,229.2],[538,166.8,230.2],[539,167.8,230.2],[540,167.8,230.2],[541,166.8,230.2],[542,166.8,229.2],[543,166.8,229.2],[544,166.8,229.2],[545,166.8,229.2],[546,166.8,229.2],[547,166.8,229.2],[548,166.8,230.2],[549,166.8,230.2],[550,166.8,230.2],[551,166.8,230.2],[552,166.8,230.2],[553,166.8,230.2],[554,166.8,229.2],[555,166.8,230.2],[556,166.8,230.2],[557,166.8,230.2],[558,166.8,230.2],[559,166.8,230.2],[560,166.8,230.2],[561,166.8,230.2],[562,166.8,230.2],[563,166.8,230.2],[564,166.8,230.2],[565,166.8,230.2],[566,166.8,230.2],[567,166.8,230.2],[568,166.8,230.2],[569,166.8,230.2],[570,166.8,230.2],[571,166.8,230.2],[572,166.8,230.2],[573,166.8,230.2],[574,166.8,230.2],[575,165.8,230.2],[576,165.8,230.2],[577,165.8,230.2],[578,165.8,230.2],[579,165.8,230.2],[580,166.8,230.2],[581,166.8,230.2],[582,166.8,230.2],[583,165.8,230.2],[584,165.8,230.2],[585,165.8,230.2],[586,165.8,230.2],[587,165.8,230.2],[588,165.8,230.2],[589,165.8,230.2],[590,165.8,230.2],[591,165.8,230.2],[592,165.8,230.2],[593,165.8,230.2],[594,165.8,230.2],[595,165.8,230.2],[596,166.8,230.2],[597,166.8,230.2],[598,166.8,230.2],[599,166.8,230.2],[600,166.8,230.2],[601,166.8,230.2],[602,166.8,230.2],[603,166.8,231.2],[604,166.8,231.2],[605,165.8,231.2],[606,165.8,230.2],[607,165.8,230.2],[608,165.8,230.2],[609,165.8,231.2],[610,165.8,231.2],[611,165.8,231.2],[612,165.8,231.2],[613,165.8,231.2],[614,165.8,231.2],[615,165.8,231.2],[616,165.8,230.2],[617,165.8,231.2],[618,165.8,231.2],[619,165.8,231.2],[620,165.8,231.2],[621,165.8,231.2],[622,165.8,231.2],[623,165.8,231.2],[624,165.8,231.2],[625,165.8,231.2],[626,165.8,230.2],[627,165.8,231.2],[628,165.8,231.2],[629,164.8,232.2],[630,165.8,231.2],[631,165.8,231.2],[632,165.8,231.2],[633,165.8,231.2],[634,165.8,231.2],[635,165.8,231.2],[636,165.8,231.2],[637,165.8,231.2],[638,165.8,231.2],[639,164.8,232.2],[640,164.8,232.2],[641,164.8,232.2],[642,164.8,231.2],[643,164.8,231.2],[644,165.8,231.2],[645,164.8,231.2],[646,164.8,231.2],[647,164.8,232.2],[648,165.8,231.2],[649,165.8,231.2],[650,165.8,232.2],[651,165.8,232.2],[652,165.8,232.2],[653,165.8,232.2],[654,165.8,232.2],[655,165.8,231.2],[656,164.8,232.2],[657,164.8,232.2],[658,164.8,232.2],[659,164.8,232.2],[660,164.8,232.2],[661,164.8,232.2],[662,165.8,232.2],[663,165.8,232.2],[664,165.8,232.2],[665,165.8,232.2],[666,164.8,232.2],[667,164.8,232.2],[668,164.8,232.2],[669,164.8,232.2],[670,164.8,232.2],[671,164.8,232.2],[672,164.8,232.2],[673,164.8,232.2],[674,164.8,232.2],[675,164.8,232.2],[676,164.8,232.2],[677,165.8,232.2],[678,164.8,232.2],[679,164.8,232.2],[680,164.8,232.2],[681,164.8,232.2],[682,164.8,232.2],[683,164.8,232.2],[684,164.8,232.2],[685,165.8,232.2],[686,164.8,232.2],[687,164.8,232.2],[688,164.8,232.2],[689,164.8,232.2],[690,164.8,232.2],[691,164.8,232.2],[692,164.8,232.2],[693,164.8,232.2],[694,164.8,232.2],[695,164.8,232.2],[696,164.8,232.2],[697,164.8,232.2],[698,164.8,232.2],[699,164.8,232.2],[700,164.8,232.2],[701,164.8,232.2],[702,164.8,232.2],[703,164.8,232.2],[704,164.8,232.2],[705,164.8,232.2],[706,164.8,232.2],[707,164.8,232.2],[708,164.8,232.2],[709,164.8,232.2],[710,164.8,232.2],[711,164.8,232.2],[712,164.8,232.2],[713,164.8,232.2],[714,164.8,232.2],[715,164.8,232.2],[716,164.8,232.2],[717,164.8,233.2],[718,164.8,232.2],[719,164.8,233.2],[720,164.8,233.2],[721,164.8,232.2],[722,164.8,232.2],[723,164.8,232.2],[724,164.8,232.2],[725,164.8,232.2],[726,164.8,233.2],[727,164.8,233.2],[728,163.8,233.2],[729,163.8,233.2],[730,163.8,233.2],[731,163.8,233.2],[732,163.8,233.2],[733,163.8,233.2],[734,163.8,233.2],[735,163.8,233.2],[736,163.8,233.2],[737,163.8,233.2],[738,163.8,233.2],[739,162.8,233.2],[740,162.8,233.2],[741,163.8,233.2],[742,163.8,233.2],[743,163.8,233.2],[744,163.8,233.2],[745,163.8,233.2],[746,163.8,233.2],[747,163.8,233.2],[748,163.8,233.2],[749,163.8,233.2],[750,163.8,233.2],[751,162.8,233.2],[752,163.8,234.2],[753,163.8,234.2],[754,163.8,233.2],[755,163.8,233.2],[756,162.8,233.2],[757,162.8,234.2],[758,162.8,234.2],[759,162.8,234.2],[760,162.8,234.2],[761,162.8,234.2],[762,163.8,234.2],[763,163.8,234.2],[764,162.8,234.2],[765,162.8,234.2],[766,162.8,234.2],[767,162.8,234.2],[768,162.8,234.2],[769,162.8,234.2],[770,162.8,234.2],[771,162.8,234.2],[772,163.8,234.2],[773,163.8,234.2],[774,163.8,234.2],[775,163.8,234.2],[776,162.8,234.2],[777,163.8,234.2],[778,163.8,234.2],[779,163.8,234.2],[780,162.8,234.2],[781,162.8,234.2],[782,162.8,234.2],[783,162.8,234.2],[784,162.8,234.2],[785,162.8,234.2],[786,162.8,234.2],[787,163.8,234.2],[788,163.8,234.2],[789,162.8,234.2],[790,162.8,234.2],[791,162.8,235.2],[792,162.8,235.2],[793,162.8,235.2],[794,162.8,234.2],[795,162.8,235.2],[796,162.8,235.2],[797,162.8,234.2],[798,162.8,234.2],[799,162.8,234.2],[800,162.8,235.2],[801,162.8,235.2],[802,162.8,235.2],[803,162.8,235.2],[804,162.8,235.2],[805,162.8,235.2],[806,163.8,234.2],[807,163.8,235.2],[808,162.8,235.2],[809,162.8,235.2],[810,162.8,235.2],[811,162.8,235.2],[812,162.8,235.2],[813,162.8,235.2],[814,162.8,235.2],[815,162.8,235.2],[816,162.8,235.2],[817,162.8,235.2],[818,162.8,235.2],[819,162.8,235.2],[820,162.8,235.2],[821,162.8,235.2],[822,162.8,235.2],[823,162.8,235.2],[824,162.8,235.2],[825,162.8,235.2],[826,161.8,235.2],[827,162.8,235.2],[828,161.8,235.2],[829,161.8,235.2],[830,161.8,235.2],[831,161.8,235.2],[832,161.8,235.2],[833,161.8,235.2],[834,161.8,235.2],[835,161.8,235.2],[836,161.8,235.2],[837,161.8,235.2],[838,161.8,235.2],[839,161.8,235.2],[840,162.8,235.2],[841,161.8,235.2],[842,161.8,235.2],[843,161.8,235.2],[844,161.8,235.2],[845,161.8,235.2],[846,161.8,235.2],[847,162.8,235.2],[848,162.8,235.2],[849,162.8,235.2],[850,162.8,235.2],[851,162.8,235.2],[852,161.8,235.2],[853,161.8,235.2],[854,161.8,235.2],[855,161.8,235.2],[856,161.8,235.2],[857,161.8,235.2],[858,161.8,235.2],[859,161.8,235.2],[860,161.8,235.2],[861,161.8,235.2],[862,161.8,235.2],[863,161.8,235.2],[864,161.8,235.2],[865,161.8,235.2],[866,161.8,235.2],[867,161.8,235.2],[868,161.8,235.2],[869,161.8,236.2],[870,160.8,236.2],[871,160.8,236.2],[872,160.8,236.2],[873,161.8,236.2],[874,161.8,236.2],[875,161.8,236.2],[876,161.8,236.2],[877,161.8,236.2],[878,161.8,236.2],[879,160.8,236.2],[880,160.8,236.2],[881,161.8,236.2],[882,161.8,236.2],[883,161.8,235.2],[884,161.8,235.2],[885,161.8,235.2],[886,161.8,236.2],[887,161.8,235.2],[888,161.8,235.2],[889,161.8,236.2],[890,161.8,236.2],[891,161.8,236.2],[892,160.8,236.2],[893,160.8,236.2],[894,160.8,236.2],[895,161.8,236.2],[896,160.8,236.2],[897,160.8,236.2],[898,160.8,236.2],[899,160.8,236.2],[900,160.8,236.2],[901,160.8,236.2],[902,160.8,236.2],[903,160.8,236.2],[904,160.8,236.2],[905,161.8,236.2],[906,161.8,236.2],[907,160.8,236.2],[908,160.8,236.2],[909,160.8,236.2],[910,160.8,236.2],[911,160.8,236.2],[912,160.8,236.2],[913,160.8,236.2],[914,160.8,236.2],[915,160.8,236.2],[916,160.8,236.2],[917,161.8,235.2],[918,161.8,235.2],[919,162.8,235.2],[920,162.8,234.2],[921,163.8,233.2],[922,164.8,232.2],[923,164.8,232.2],[924,164.8,232.2],[925,165.8,231.2],[926,165.8,231.2],[927,166.8,230.2],[928,166.8,230.2],[929,166.8,230.2],[930,166.8,230.2],[931,166.8,230.2],[932,166.8,230.2],[933,166.8,230.2],[934,166.8,229.2],[935,166.8,230.2],[936,166.8,230.2],[937,164.8,230.2],[938,164.8,231.2],[939,164.8,232.2],[940,164.8,232.2],[941,163.8,232.2],[942,162.8,233.2],[943,162.8,234.2],[944,161.8,235.2],[945,160.8,235.2],[946,159.8,236.2],[947,158.8,238.2],[948,157.8,239.2],[949,154.8,241.2],[950,149.8,243.2],[951,148.8,246.2],[952,130.8,249.2],[953,123.8,265.2],[954,120.8,273.2],[955,119.8,276.2],[956,118.8,276.2],[957,118.8,277.2],[958,118.8,277.2],[959,118.8,277.2],[960,118.8,277.2],[961,118.8,277.2],[962,118.8,278.2],[963,118.8,278.2],[964,118.8,278.2],[965,117.8,278.2],[966,117.8,278.2],[967,117.8,278.2],[968,117.8,278.2],[969,117.8,278.2],[970,116.8,278.2],[971,116.8,279.2],[972,115.8,279.2],[973,115.8,279.2],[974,115.8,279.2],[975,116.8,279.2],[976,116.8,279.2],[977,163.8,257.2],[978,165.8,231.2],[979,173.8,223.2],[980,174.8,221.2],[981,175.8,220.2],[982,175.8,220.2],[983,175.8,220.2],[984,175.8,220.2],[985,174.8,220.2],[986,174.8,220.2],[987,174.8,221.2],[988,174.8,221.2],[989,174.8,221.2],[990,174.8,221.2],[991,174.8,221.2],[992,174.8,220.2],[993,175.8,220.2],[994,176.8,219.2],[995,177.8,218.2],[996,176.8,218.2],[997,175.8,219.2],[998,175.8,219.2],[999,175.8,219.2],[1000,176.8,219.2],[1001,176.8,219.2],[1002,177.8,218.2],[1003,177.8,217.2],[1004,177.8,217.2],[1005,177.8,217.2],[1006,178.8,217.2],[1007,178.8,217.2],[1008,178.8,217.2],[1009,179.8,217.2],[1010,179.8,217.2],[1011,179.8,216.2],[1012,179.8,216.2],[1013,179.8,216.2],[1014,179.8,217.2],[1015,179.8,217.2],[1016,178.8,217.2],[1017,178.8,217.2],[1018,178.8,217.2],[1019,178.8,217.2],[1020,179.8,217.2],[1021,179.8,217.2],[1022,179.8,217.2],[1023,179.8,217.2],[1024,179.8,217.2],[1025,179.8,217.2],[1026,179.8,216.2],[1027,179.8,216.2],[1028,179.8,216.2],[1029,179.8,217.2],[1030,179.8,217.2],[1031,179.8,217.2],[1032,179.8,217.2],[1033,178.8,217.2],[1034,178.8,217.2],[1035,178.8,217.2],[1036,178.8,217.2],[1037,178.8,217.2],[1038,178.8,217.2],[1039,178.8,217.2],[1040,178.8,217.2],[1041,178.8,217.2],[1042,179.8,217.2],[1043,179.8,216.2],[1044,179.8,216.2],[1045,179.8,216.2],[1046,178.8,217.2],[1047,178.8,217.2],[1048,178.8,217.2],[1049,178.8,217.2],[1050,178.8,217.2],[1051,178.8,217.2],[1052,178.8,217.2],[1053,178.8,217.2],[1054,178.8,217.2],[1055,178.8,217.2],[1056,178.8,217.2],[1057,178.8,217.2],[1058,179.8,217.2],[1059,179.8,217.2],[1060,179.8,217.2],[1061,179.8,217.2],[1062,178.8,217.2],[1063,178.8,217.2],[1064,178.8,217.2],[1065,178.8,217.2],[1066,179.8,217.2],[1067,179.8,217.2],[1068,179.8,217.2],[1069,179.8,217.2],[1070,179.8,217.2],[1071,178.8,217.2],[1072,178.8,217.2],[1073,178.8,217.2],[1074,178.8,217.2],[1075,178.8,217.2],[1076,179.8,217.2],[1077,179.8,217.2],[1078,179.8,217.2],[1079,179.8,217.2],[1080,179.8,217.2],[1081,178.8,217.2],[1082,179.8,217.2],[1083,179.8,217.2],[1084,179.8,217.2],[1085,179.8,217.2],[1086,179.8,217.2],[1087,179.8,217.2],[1088,179.8,217.2],[1089,179.8,217.2],[1090,179.8,217.2],[1091,179.8,217.2],[1092,179.8,217.2],[1093,179.8,217.2],[1094,179.8,217.2],[1095,179.8,217.2],[1096,179.8,217.2],[1097,179.8,217.2],[1098,179.8,217.2],[1099,179.8,217.2],[1100,179.8,217.2],[1101,179.8,217.2],[1102,179.8,217.2],[1103,179.8,217.2],[1104,179.8,217.2],[1105,179.8,217.2],[1106,178.8,217.2],[1107,178.8,217.2],[1108,178.8,217.2],[1109,179.8,217.2],[1110,179.8,217.2],[1111,179.8,217.2],[1112,179.8,217.2],[1113,179.8,217.2],[1114,178.8,218.2],[1115,177.8,218.2],[1116,177.8,219.2],[1117,177.8,219.2],[1118,177.8,219.2],[1119,176.8,220.2],[1120,175.8,220.2],[1121,175.8,221.2],[1122,175.8,221.2],[1123,175.8,221.2],[1124,177.8,219.2],[1125,177.8,219.2],[1126,177.8,219.2],[1127,177.8,219.2],[1128,176.8,220.2],[1129,175.8,221.2],[1130,175.8,221.2],[1131,175.8,221.2],[1132,176.8,220.2],[1133,176.8,220.2],[1134,177.8,220.2],[1135,177.8,220.2],[1136,177.8,219.2],[1137,177.8,219.2],[1138,177.8,219.2],[1139,178.8,219.2],[1140,178.8,218.2],[1141,179.8,218.2],[1142,179.8,217.2],[1143,179.8,217.2],[1144,179.8,217.2],[1145,179.8,218.2],[1146,179.8,218.2],[1147,179.8,218.2],[1148,179.8,218.2],[1149,179.8,218.2],[1150,179.8,218.2],[1151,179.8,218.2],[1152,179.8,218.2],[1153,179.8,218.2],[1154,179.8,218.2],[1155,179.8,218.2],[1156,179.8,218.2],[1157,179.8,218.2],[1158,179.8,218.2],[1159,179.8,217.2],[1160,179.8,217.2],[1161,179.8,218.2],[1162,179.8,218.2],[1163,179.8,218.2],[1164,179.8,218.2],[1165,179.8,218.2],[1166,179.8,218.2],[1167,179.8,218.2],[1168,179.8,218.2],[1169,179.8,218.2],[1170,179.8,218.2],[1171,179.8,218.2],[1172,179.8,218.2],[1173,179.8,218.2],[1174,179.8,218.2],[1175,179.8,217.2],[1176,179.8,217.2],[1177,179.8,217.2],[1178,179.8,217.2],[1179,179.8,218.2],[1180,179.8,218.2],[1181,179.8,218.2],[1182,179.8,218.2],[1183,179.8,218.2],[1184,179.8,218.2],[1185,179.8,218.2],[1186,179.8,218.2],[1187,179.8,218.2],[1188,179.8,218.2],[1189,179.8,218.2],[1190,179.8,218.2],[1191,179.8,218.2],[1192,179.8,218.2],[1193,179.8,218.2],[1194,179.8,218.2],[1195,179.8,218.2],[1196,179.8,218.2],[1197,179.8,218.2],[1198,179.8,218.2],[1199,179.8,218.2],[1200,179.8,218.2],[1201,179.8,218.2],[1202,179.8,218.2],[1203,179.8,218.2],[1204,179.8,218.2],[1205,179.8,218.2],[1206,179.8,218.2],[1207,179.8,218.2],[1208,179.8,217.2],[1209,179.8,218.2],[1210,179.8,218.2],[1211,179.8,219.2],[1212,179.8,219.2],[1213,179.8,219.2],[1214,179.8,219.2],[1215,179.8,219.2],[1216,179.8,219.2],[1217,179.8,219.2],[1218,179.8,219.2],[1219,178.8,219.2],[1220,178.8,219.2],[1221,179.8,219.2],[1222,179.8,218.2],[1223,179.8,218.2],[1224,178.8,218.2],[1225,178.8,219.2],[1226,177.8,219.2],[1227,177.8,220.2],[1228,177.8,220.2],[1229,177.8,220.2],[1230,177.8,220.2],[1231,177.8,220.2],[1232,177.8,221.2],[1233,176.8,222.2],[1234,176.8,222.2],[1235,175.8,222.2],[1236,175.8,222.2],[1237,174.8,223.2],[1238,174.8,223.2],[1239,174.8,224.2],[1240,174.8,224.2],[1241,174.8,224.2],[1242,172.8,224.2],[1243,172.8,225.2],[1244,171.8,227.2],[1245,170.8,227.2],[1246,169.8,228.2],[1247,169.8,228.2],[1248,168.8,229.2],[1249,166.8,231.2],[1250,165.8,232.2],[1251,164.8,233.2],[1252,162.8,235.2],[1253,162.8,236.2],[1254,161.8,236.2],[1255,161.8,236.2],[1256,162.8,236.2],[1257,162.8,235.2],[1258,163.8,235.2],[1259,162.8,235.2],[1260,162.8,235.2],[1261,161.8,236.2],[1262,161.8,236.2],[1263,162.8,236.2],[1264,163.8,234.2],[1265,164.8,233.2],[1266,167.8,231.2],[1267,168.8,229.2],[1268,174.8,227.2],[1269,184.8,216.2],[1270,189.8,211.2]];
        const SWORD_IMAGE_SIZE=[1320, 364];

        // Front/back UVs project the supplied reference itself. The silhouette
        // uses sampled image contours, while the thin cross section is real 3D.
        const SWORD_PIXELS=(950-64)/3.09;
        const swordZFromPixel=x=>.36+(950-x)/SWORD_PIXELS;
        function swordTraceAt(px) {
          const index=THREE.MathUtils.clamp(Math.round(px)-SWORD_TRACE[0][0],0,SWORD_TRACE.length-1);
          const sample=SWORD_TRACE[index];
          if(px<935&&px>76){
            let top=0,bottom=0,weight=0;
            for(let d=-3;d<=3;d++){const row=SWORD_TRACE[Math.max(0,Math.min(SWORD_TRACE.length-1,index+d))],w=4-Math.abs(d);top+=row[1]*w;bottom+=row[2]*w;weight+=w;}
            return {top:top/weight,bottom:bottom/weight};
          }
          return {top:sample[1],bottom:sample[2]};
        }
        function swordPhotoUV(x,z) {
          const px=THREE.MathUtils.clamp(950-(z-.36)*SWORD_PIXELS,70,1268);
          const trace=swordTraceAt(px);
          const row=THREE.MathUtils.clamp(198-x*SWORD_PIXELS,trace.top+.45,trace.bottom-.45);
          return [px/SWORD_IMAGE_SIZE[0],1-row/SWORD_IMAGE_SIZE[1]];
        }
        async function createSwordReferenceTexture() {
          const image=await new Promise((resolve,reject)=>{
            const img=new Image();img.onload=()=>resolve(img);img.onerror=()=>reject(new Error('剑纹载入失败'));img.src=SWORD_REFERENCE_IMAGE;
          });
          const canvas=document.createElement('canvas');canvas.width=image.width;canvas.height=image.height;
          canvas.getContext('2d').drawImage(image,0,0);
          const tex=new THREE.CanvasTexture(canvas);tex.encoding=THREE.sRGBEncoding;tex.anisotropy=8;
          return tex;
        }
        function createMainBladeGeometry() {
          const positions=[],uvs=[],indices=[],sections=[];
          // Include the eight visible bamboo nodes rather than inventing an
          // engraved motif or thick, rounded blade.
          const nodePixels=[174,235,310,390,478,577,686,797];
          const samples=new Set([64,70,72,944,946]);
          for(let px=76;px<=942;px+=isMobile?9:5)samples.add(px);
          nodePixels.forEach(px=>[-4,-2,0,2,4].forEach(d=>samples.add(px+d)));
          [...samples].sort((a,b)=>b-a).forEach(px=>{
            const {top,bottom}=swordTraceAt(Math.max(70,px));
            const center=(198-(top+bottom)/2)/SWORD_PIXELS;
            const half=px===64?0:Math.max(.001,(bottom-top)/SWORD_PIXELS*.5);
            const t=(946-px)/(946-64);
            const node=nodePixels.reduce((sum,n)=>sum+Math.exp(-Math.pow((px-n)/2.5,2)),0);
            sections.push({z:swordZFromPixel(px),center,half,thickness:(.0105+node*.0022)*(1-smoothstep(.90,1,t))});
          });
          const fractions=[-1,-.86,-.69,-.35,0,.35,.69,.86,1];
          const relief=[0,.23,.42,.80,1,.80,.42,.23,0];
          for(const side of [-1,1]){
            const offset=positions.length/3;
            sections.forEach(sec=>fractions.forEach((f,k)=>{
              const x=sec.center+f*sec.half;
              positions.push(x,side*sec.thickness*relief[k],sec.z);uvs.push(...swordPhotoUV(x,sec.z));
            }));
            for(let row=0;row<sections.length-1;row++)for(let col=0;col<fractions.length-1;col++){
              const a=offset+row*fractions.length+col,b=a+1,c=a+fractions.length,d=c+1;
              if(side>0)indices.push(a,c,b,b,c,d);else indices.push(a,b,c,b,d,c);
            }
          }
          const geo=new THREE.BufferGeometry();geo.setAttribute('position',new THREE.Float32BufferAttribute(positions,3));
          geo.setAttribute('uv',new THREE.Float32BufferAttribute(uvs,2));geo.setIndex(indices);geo.computeVertexNormals();return geo;
        }
        function createMainHiltGeometry() {
          const positions=[],uvs=[],indices=[];
          const radial=isMobile?24:40;
          const samples=new Set([944,946,948,950,952,954,956,957,960,963,966,969,972,974,976,978,980,984,1266,1268,1270]);
          for(let px=986;px<=1264;px+=3)samples.add(px);
          const xs=[...samples].sort((a,b)=>b-a);
          xs.forEach(px=>{
            const trace=swordTraceAt(Math.min(px,1268));
            const center=(198-(trace.top+trace.bottom)/2)/SWORD_PIXELS;
            const radius=Math.max(.001,(trace.bottom-trace.top)*.5/SWORD_PIXELS)*(px>=1270?.88:1);
            const guard=px>=950&&px<=978;
            const thickness=guard?.025:Math.min(.052,radius*.66);
            for(let j=0;j<=radial;j++){
              const a=j/radial*Math.PI*2,x=center+Math.cos(a)*radius;
              positions.push(x,Math.sin(a)*thickness,swordZFromPixel(px));uvs.push(...swordPhotoUV(x,swordZFromPixel(px)));
            }
          });
          for(let row=0;row<xs.length-1;row++)for(let j=0;j<radial;j++){
            const a=row*(radial+1)+j,b=a+1,c=a+radial+1,d=c+1;indices.push(a,b,c,b,d,c);
          }
          // Close the jade pommel, keeping the reference's small flared cap.
          const end=positions.length/3;positions.push(0,0,swordZFromPixel(1270));uvs.push(...swordPhotoUV(0,swordZFromPixel(1264)));
          for(let j=0;j<radial;j++)indices.push(end,j+1,j);
          const geo=new THREE.BufferGeometry();geo.setAttribute('position',new THREE.Float32BufferAttribute(positions,3));
          geo.setAttribute('uv',new THREE.Float32BufferAttribute(uvs,2));geo.setIndex(indices);geo.computeVertexNormals();return geo;
        }

        function createShadowSwordGeometry() {
          // Separate light-sword anatomy: nearly flat transparent blade,
          // luminous circular guard, simple banded translucent handle.
          const p=[],n=[],uv=[],parts=[];
          function add(g,part){
            const flat=g.index?g.toNonIndexed():g;
            const a=flat.attributes.position,b=flat.attributes.normal,c=flat.attributes.uv;
            for(let k=0;k<a.count;k++){p.push(a.getX(k),a.getY(k),a.getZ(k));n.push(b.getX(k),b.getY(k),b.getZ(k));uv.push(c?c.getX(k):0,c?c.getY(k):0);parts.push(part);}
            if(flat!==g)flat.dispose();g.dispose();
          }
          const bp=[],bu=[],bi=[];const rows=18,cols=4;
          for(const side of [-1,1]){
            const offset=bp.length/3;
            for(let row=0;row<=rows;row++){
              const t=row/rows,z=.34+t*3.11;
              const width=t<.84?THREE.MathUtils.lerp(.139,.094,t/.84):.094*Math.max(0,(1-t)/.16);
              for(let col=0;col<=cols;col++){
                const u=col/cols;bp.push((u*2-1)*width,side*.007*(1-Math.abs(u*2-1))*(1-t*.65),z);bu.push(u,t);
              }
            }
            for(let row=0;row<rows;row++)for(let col=0;col<cols;col++){
              const a=offset+row*(cols+1)+col,b=a+1,c=a+cols+1,d=c+1;
              if(side>0)bi.push(a,c,b,b,c,d);else bi.push(a,b,c,b,d,c);
            }
          }
          const blade=new THREE.BufferGeometry();blade.setAttribute('position',new THREE.Float32BufferAttribute(bp,3));
          blade.setAttribute('uv',new THREE.Float32BufferAttribute(bu,2));blade.setIndex(bi);blade.computeVertexNormals();add(blade,0);
          const guard=new THREE.CylinderGeometry(.285,.285,.045,32,1);guard.rotateX(Math.PI/2);guard.scale(1,.37,1);guard.translate(0,0,.27);add(guard,1);
          const rim=new THREE.TorusGeometry(.283,.005,4,32);rim.scale(1,.37,1);rim.translate(0,0,.288);add(rim,1);
          const handle=new THREE.CylinderGeometry(.057,.052,.71,12,4);handle.rotateX(Math.PI/2);handle.scale(1,.72,1);handle.translate(0,0,-.114);add(handle,2);
          for(let k=0;k<5;k++){
            const ring=new THREE.TorusGeometry(.059,.004,4,16);ring.scale(1,.72,1);ring.translate(0,0,.17-k*.145);add(ring,2);
          }
          const pommel=new THREE.CylinderGeometry(.09,.052,.085,16,1);pommel.rotateX(Math.PI/2);pommel.scale(1,.72,1);pommel.translate(0,0,-.54);add(pommel,3);
          const geo=new THREE.BufferGeometry();geo.setAttribute('position',new THREE.Float32BufferAttribute(p,3));
          geo.setAttribute('normal',new THREE.Float32BufferAttribute(n,3));geo.setAttribute('uv',new THREE.Float32BufferAttribute(uv,2));
          geo.setAttribute('aSpiritPart',new THREE.Float32BufferAttribute(parts,1));return geo;
        }
        await startup?.step(78,'正在凝聚剑光…');
        const mainBladeTex=await createSwordReferenceTexture(),mainHiltTex=mainBladeTex;
        const bladeGeo=createMainBladeGeometry(),hiltGeo=createMainHiltGeometry(),shadowSwordGeo=createShadowSwordGeometry();
        const bladeMat=new THREE.MeshPhysicalMaterial({map:mainBladeTex,color:'#ffffff',emissive:'#ffffff',emissiveMap:mainBladeTex,
          emissiveIntensity:.04,roughness:.36,metalness:.40,clearcoat:.48,clearcoatRoughness:.25,envMapIntensity:.44,side:THREE.DoubleSide});
        const hiltMat=new THREE.MeshPhysicalMaterial({map:mainHiltTex,color:'#ffffff',emissive:'#ffffff',emissiveMap:mainHiltTex,
          emissiveIntensity:.025,roughness:.40,metalness:.34,clearcoat:.45,envMapIntensity:.42});


        // The second reference is light, not a second opaque metal sword.
        // A low-opacity jade volume and a separate thin edge glow leave the
        // scene visible through the center of the blade.
        const shadowUniforms={uTime:{value:0},uOpacityBoost:{value:1},uLightning:{value:1},uTransparency:{value:.85}};
        const spiritSeeds=new Float32Array(CONFIG.shadowSwordCount);
        for(let i=0;i<spiritSeeds.length;i++)spiritSeeds[i]=(i*.61803398875)%1;
        shadowSwordGeo.setAttribute('aSpiritSeed',new THREE.InstancedBufferAttribute(spiritSeeds,1));
        const spiritVertexShader=`
          attribute float aSpiritPart;attribute float aSpiritSeed;
          varying vec2 vUv;varying vec3 vNormal;varying vec3 vViewPosition;
          varying vec3 vLocalPos;varying float vPart;varying float vSeed;
          void main(){
            vUv=uv;vPart=aSpiritPart;vSeed=aSpiritSeed;vLocalPos=position;
            vec4 mv=modelViewMatrix*instanceMatrix*vec4(position,1.0);
            vViewPosition=-mv.xyz;vNormal=normalize(normalMatrix*mat3(instanceMatrix)*normal);
            gl_Position=projectionMatrix*mv;
          }
        `;
        const spiritGlowVertexShader=`
          attribute float aSpiritPart;attribute float aSpiritSeed;
          varying vec2 vUv;varying vec3 vNormal;varying vec3 vViewPosition;
          varying vec3 vLocalPos;varying float vPart;varying float vSeed;
          void main(){
            vUv=uv;vPart=aSpiritPart;vSeed=aSpiritSeed;vLocalPos=position;
            vec3 shell=position;
            if(aSpiritPart<.5){
              shell.x+=(uv.x*2.0-1.0)*.012*(1.0-smoothstep(.94,1.0,uv.y));
              shell.z+=smoothstep(.93,1.0,uv.y)*.010;
            }else if(aSpiritPart<1.5){shell.xy*=1.055;}
            else{shell.xy*=1.065;}
            vec4 mv=modelViewMatrix*instanceMatrix*vec4(shell,1.0);
            vViewPosition=-mv.xyz;vNormal=normalize(normalMatrix*mat3(instanceMatrix)*normal);
            gl_Position=projectionMatrix*mv;
          }
        `;
        const spiritSurfaceFunctions=`
          varying vec2 vUv;varying vec3 vNormal;varying vec3 vViewPosition;
          varying vec3 vLocalPos;varying float vPart;varying float vSeed;
          uniform float uTime;uniform float uOpacityBoost;uniform float uTransparency;
          float rim(){return pow(1.0-abs(dot(normalize(vNormal),normalize(vViewPosition))),2.6);}
          float outline(){
            if(vPart<.5){
              float wx=clamp(fwidth(vUv.x)*1.15,.005,.060),wy=clamp(fwidth(vUv.y)*1.15,.0005,.015);
              float sides=1.0-smoothstep(wx*.25,wx*1.65,min(vUv.x,1.0-vUv.x));
              float ends=1.0-smoothstep(wy*.25,wy*1.65,min(vUv.y,1.0-vUv.y));
              return max(sides,ends*.85);
            }
            if(vPart<1.5){float r=length(vec2(vLocalPos.x/.285,vLocalPos.y/.106));return max(rim()*.48,1.0-smoothstep(.012,.085,abs(r-1.0)));}
            if(vPart<2.5)return max(rim()*.70,pow(.5+.5*cos((vLocalPos.z-.17)*43.3323),28.0)*.70);
            return rim()*.85;
          }
          float spiritHash(vec2 p){return fract(sin(dot(p,vec2(127.1,311.7)))*43758.5453);}
          float spiritNoise(vec2 p){
            vec2 i=floor(p),f=fract(p);f=f*f*(3.0-2.0*f);
            return mix(mix(spiritHash(i),spiritHash(i+vec2(1,0)),f.x),mix(spiritHash(i+vec2(0,1)),spiritHash(i+vec2(1,1)),f.x),f.y);
          }
          vec3 spiritTexture(){
            float stream=vLocalPos.z*5.8-uTime*.60+vSeed*19.0;
            float jade=spiritNoise(vec2(stream*.45,vSeed*37.0));
            float bend=sin(stream*.80+vSeed*11.0)*.080+(jade-.5)*.12;
            float lane=(vUv.x+bend)*3.4,dist=abs(fract(lane)-.5);
            float w=max(fwidth(lane)*.80,.018);
            float vein=1.0-smoothstep(w*.30,w*1.60,dist);
            float grain=spiritNoise(vec2(vUv.x*24.0,vLocalPos.z*37.0)+vSeed*29.0);
            float ribs=pow(.5+.5*sin(vLocalPos.z*24.0+(vUv.x-.5)*9.0-uTime*.80+jade*3.0),14.0);
            return vec3(jade,vein,ribs*.65+grain*.35);
          }
        `;
        const shadowMat=new THREE.ShaderMaterial({uniforms:shadowUniforms,vertexShader:spiritVertexShader,
          fragmentShader:spiritSurfaceFunctions+`
            void main(){
              float edge=outline(),f=rim();vec3 detail=spiritTexture();
              vec3 jade=mix(vec3(.055,.52,.44),vec3(.47,1.0,.90),.20+detail.x*.48+f*.12);
              jade+=vec3(.10,.24,.20)*detail.z*.20;
              float alpha=pow(max(0.0,1.0-uTransparency),1.05)*(.55+detail.x*.35+detail.z*.18+f*.12+edge*.08);
              alpha*=gl_FrontFacing?1.0:.42;
              gl_FragColor=vec4(jade,min(1.0,alpha*uOpacityBoost));
            }
          `,transparent:true,depthWrite:false,blending:THREE.NormalBlending,side:THREE.DoubleSide,extensions:{derivatives:true}});
        const spiritGlowMat=new THREE.ShaderMaterial({uniforms:shadowUniforms,vertexShader:spiritGlowVertexShader,
          fragmentShader:spiritSurfaceFunctions+`
            void main(){
              float edge=outline();vec3 detail=spiritTexture();
              float sweep=exp(-pow((fract(vLocalPos.z*.28-uTime*.28+vSeed)-.5)*9.0,2.0));
              float volume=vPart<.5?pow(max(0.0,sin(vUv.x*3.14159265)),.60)*(.140+detail.x*.080+sweep*.045):vPart<1.5?.085:.040;
              float etching=detail.y*(.085+sweep*.14)+detail.z*.035;
              float alpha=(edge*(.76+sweep*.18)+etching+volume)*uOpacityBoost;
              alpha*=clamp(pow(max(0.0,1.0-uTransparency)/.15,.65),0.0,2.5);
              alpha*=gl_FrontFacing?1.0:.58;
              vec3 jade=vec3(.30,.95,.84),gold=mix(vec3(1.0,.62,.08),vec3(1.0,.92,.30),smoothstep(.45,.95,edge));
              float goldMask=clamp(edge*.98+detail.y*(.18+sweep*.18),0.0,1.0);
              vec3 col=mix(jade,gold,goldMask);
              if(alpha<.002)discard;gl_FragColor=vec4(col,min(.96,alpha));
            }
          `,transparent:true,depthWrite:false,blending:THREE.AdditiveBlending,side:THREE.DoubleSide,extensions:{derivatives:true}});


        const bladeInstanced = new THREE.InstancedMesh(bladeGeo, bladeMat, CONFIG.mainSwordCount);
        const hiltInstanced = new THREE.InstancedMesh(hiltGeo, hiltMat, CONFIG.mainSwordCount);
        const shadowInstanced = new THREE.InstancedMesh(shadowSwordGeo, shadowMat, CONFIG.shadowSwordCount);
        bladeInstanced.frustumCulled = false; hiltInstanced.frustumCulled = false; shadowInstanced.frustumCulled = false;
        scene.add(bladeInstanced); scene.add(hiltInstanced); scene.add(shadowInstanced);
        bladeInstanced.name='参考图青竹剑身';hiltInstanced.name='参考图直护手与竹节握柄';shadowInstanced.name='通透剑光';
        const shadowGlowInstanced=new THREE.InstancedMesh(shadowSwordGeo,spiritGlowMat,CONFIG.shadowSwordCount);
        shadowGlowInstanced.name='剑光纤细边缘辉光';shadowGlowInstanced.frustumCulled=false;
        shadowGlowInstanced.instanceMatrix=shadowInstanced.instanceMatrix;scene.add(shadowGlowInstanced);

        const swordPositions = [];
        const swordVelocities = [];
        const swordScales = new Float32Array(CONFIG.swordCount);
        const swordPhases = new Float32Array(CONFIG.swordCount);
        const swordSpeedTargets = new Float32Array(CONFIG.swordCount);
        const swordBanks = new Float32Array(CONFIG.swordCount);
        const swordUpVectors=Array.from({length:CONFIG.swordCount},()=>new THREE.Vector3(0,0,1));
        const swordFacingRotations=Array.from({length:CONFIG.swordCount},()=>new THREE.Quaternion());
        const swordFacingReady=new Uint8Array(CONFIG.swordCount);
        const lotusEntryPositions = Array.from({length: CONFIG.swordCount}, () => new THREE.Vector3());
        const lotusEntryVelocities = Array.from({length: CONFIG.swordCount}, () => new THREE.Vector3());
        const lotusEntryScales = new Float32Array(CONFIG.swordCount);
        let lotusEntryCaptured = false;
        const giantEntryPositions = Array.from({length: CONFIG.swordCount}, () => new THREE.Vector3());
        const giantEntryVelocities = Array.from({length: CONFIG.swordCount}, () => new THREE.Vector3());
        const giantEntryScales = new Float32Array(CONFIG.swordCount);
        const giantEntryRotations = Array.from({length: CONFIG.swordCount}, () => new THREE.Quaternion());
        const giantAnchors = Array.from({length: 8}, () => new THREE.Vector3());
        const giantGroupGrowth = new Float32Array(8);
        const giantEntryMatrix = new THREE.Matrix4(), giantEntryScale = new THREE.Vector3();
        const giantEntryPosition = new THREE.Vector3(), giantPoseRotation = new THREE.Quaternion();
        function giantLaunchTime(parentIndex, isMain, shadowSlot) {
          return GIANT_TIMING.launch + Math.floor(parentIndex / 9) * GIANT_TIMING.groupStagger
            + (parentIndex % 9) * GIANT_TIMING.swordStagger
            + (isMain ? 0 : (shadowSlot + 1) * GIANT_TIMING.shadowStagger);
        }
        function giantFlightProgress(parentIndex, isMain, shadowSlot, elapsed) {
          return THREE.MathUtils.clamp((elapsed - giantLaunchTime(parentIndex, isMain, shadowSlot)) / GIANT_TIMING.flight, 0, 1);
        }
        function updateGiantAssembly(time, elapsed, center) {
          for (let group = 0; group < 8; group++) {
            const angle = group / 8 * Math.PI * 2 + time * .32;
            giantAnchors[group].set(center.x + Math.cos(angle) * 24.5,
              center.y + 15.5 + Math.sin(time * 1.8 + group * .8) * 1.4,
              center.z + Math.sin(angle) * 24.5);
            let gathered = 0;
            for (let sub = 0; sub < 9; sub++) {
              gathered += smoothstep(.82, 1, giantFlightProgress(group * 9 + sub, true, -1, elapsed));
            }
            giantGroupGrowth[group] = smoothstep(.10, 1, gathered / 9);
          }
        }
        for (let i = 0; i < CONFIG.swordCount; i++) {
          swordPositions.push(new THREE.Vector3((Math.random() - 0.5) * 26, (Math.random() - 0.5) * 18, (Math.random() - 0.5) * 12));
          swordVelocities.push(new THREE.Vector3());
          swordScales[i] = STATE.splitEnabled || i===0 || (STATE.retainMainSwordsWhenSplitOff && i<CONFIG.mainSwordCount) ? 1.0 : 0.0;
          // 固定相位让每把剑拥有轻微不同的呼吸与摆动，避免整齐得像一条硬直线。
          swordPhases[i] = ((i * 0.61803398875) % 1.0) * Math.PI * 2.0;
          swordSpeedTargets[i] = CONFIG.maxSpeed;
        }

        // Camera-facing filaments with subpixel hot cores, a soft corona,
        // short-lived branching leaders and tiny charged motes.
        const swordLightningUniforms={uTime:{value:0},uResolution:{value:new THREE.Vector2(APP_VIEW.width,APP_VIEW.height)},
          uPixelRatio:{value:renderer.getPixelRatio()},uStrength:{value:1},uSplit:{value:1},uDensity:{value:2},uGiant:{value:0}};
        function createFilamentMaterial(uniforms,instanced=true){
          if(!uniforms.uTint)uniforms.uTint={value:new THREE.Vector3(1,1,1)};
          return new THREE.ShaderMaterial({uniforms,defines:instanced?{BOLT_INSTANCED:''}:{},
            vertexShader:`
              attribute vec3 aPrev;attribute vec3 aNext;attribute float aWidth;attribute float aSeed;attribute float aKind;
              #ifdef BOLT_INSTANCED
                attribute float aSwordRole;attribute float aInstanceSeed;attribute float aBirth;
              #endif
              uniform float uTime;uniform vec2 uResolution;uniform float uPixelRatio;uniform float uDensity;uniform float uSplit;
              #ifdef BOLT_INSTANCED
                attribute vec4 aFlow;
              #endif
              varying vec2 vUv;varying float vSeed;varying float vKind;varying float vRole;varying float vFade;varying float vPopulation;varying float vDensity;varying float vProminence;varying float vFamily;varying float vAlong;
              float hash(float n){return fract(sin(n*127.13+311.7)*43758.5453);}
              float noise(float x){float i=floor(x),f=fract(x);f=f*f*(3.0-2.0*f);return mix(hash(i),hash(i+1.0),f);}
              vec3 electrify(vec3 p,float seed,vec4 flow){
                #ifdef BOLT_INSTANCED
                  if(aKind>.5)return p;
                  vec3 q=p-aFlow.xyz;float reach=length(q);
                  q.xy=mat2(flow.y,flow.x,-flow.x,flow.y)*q.xy;
                  float crawl=abs(q.z)*4.8+q.x*.65+q.y*.40;
                  float n1=noise(crawl-flow.z)-.5;
                  float n2=noise(crawl*1.71-flow.z*.73+37.0)-.5;
                  float burst=clamp(uDensity*.25,0.0,1.0);
                  float amplitude=mix(.035,.075,flow.w)*mix(.55,1.95,burst*burst)*smoothstep(0.0,.45,reach);
                  vec3 animated=aFlow.xyz+q+vec3(n1,n2,(n1-n2)*.14)*amplitude*1.25;
                  // 同一滑块同时增多雷丝并扩大放电包络；共享形变场使短叉始终连着主丝。
                  float fan=sin(clamp(abs(q.z)/4.1,0.0,1.0)*3.14159265);
                  float spread=1.10*burst*burst*(.70+.30*hash(aFlow.w+9.0));
                  animated.xy+=vec2(flow.y,flow.x)*fan*spread;
                  // 巨剑保留纵向雷光，横向包络随实际剑身尺寸平滑收束。
                  float giant=smoothstep(4.0,14.0,length(instanceMatrix[0].xyz));
                  animated.xy*=mix(1.0,.78,giant);
                  return animated;
                #else
                  float phase=seed*17.3+uTime*(.8+hash(seed+4.0));
                  return p+vec3(noise(p.z*.6+phase)-.5,noise(p.x*.7-phase*.83+19.0)-.5,0.0)*.055*(1.0-aKind);
                #endif
              }
              void main(){
                float seed=aSeed,scale=1.0;vRole=1.0;vPopulation=1.0;vDensity=1.0;vProminence=0.0;vFamily=seed;vAlong=uv.y;
                mat4 local=modelViewMatrix;
                #ifdef BOLT_INSTANCED
                  local=modelViewMatrix*instanceMatrix;seed+=aInstanceSeed*11.0;vRole=aSwordRole;
                  scale=length(instanceMatrix[0].xyz);
                  float giant=smoothstep(4.0,14.0,scale);
                  vDensity=min(6.0,uDensity*mix(1.0,1.45,giant));
                  if(vRole<.5)vDensity*=.65;
                  vPopulation=smoothstep(aBirth,aBirth+.12,vDensity);vProminence=smoothstep(4.0,5.9,aWidth);
                #endif
                vUv=uv;vSeed=seed;vKind=aKind;vFade=smoothstep(.015,.40,scale);
                if(vPopulation<.001||vFade<.001||(vRole<.5&&uSplit<.5)){gl_Position=vec4(2.0,2.0,2.0,1.0);return;}
                vec4 flow=vec4(0.0,1.0,0.0,0.0);
                #ifdef BOLT_INSTANCED
                  float family=aFlow.w+aInstanceSeed*197.0;
                  vFamily=family;
                  float tier=floor(aFlow.w/17.37+.001);
                  float span=tier<.5?4.02:1.30+(1.0+mod(tier-1.0,3.0))*.66;
                  vAlong=abs(position.z-aFlow.z)/span;
                  float rate=.85+hash(family+17.0)*.95,flowSign=hash(family+31.0)<.5?-1.0:1.0;
                  float phase=hash(family+7.0)*6.2831853;
                  float orbit=uTime*(.05+hash(family+83.0)*.12)*flowSign+phase+(noise(uTime*rate*.35+family)-.5)*.25;
                  flow=vec4(sin(orbit),cos(orbit),uTime*rate*flowSign+family*3.7,step(15.0,aFlow.w));
                #endif
                vec3 p=electrify(position,seed,flow),prev=electrify(aPrev,seed,flow),next=electrify(aNext,seed,flow);
                vec4 clip=projectionMatrix*local*vec4(p,1.0);
                vec4 pa=projectionMatrix*local*vec4(prev,1.0),pb=projectionMatrix*local*vec4(next,1.0);
                vec2 direction=(pb.xy/max(.001,pb.w)-pa.xy/max(.001,pa.w))*uResolution;
                if(dot(direction,direction)<.001)direction=vec2(0.0,1.0);
                vec2 perpendicular=normalize(vec2(-direction.y,direction.x));
                if(aKind>.5)perpendicular=vec2(1.0,0.0);
                float pixels=aWidth*uPixelRatio*clamp(sqrt(max(.001,scale)),.65,2.2);
                #ifdef BOLT_INSTANCED
                  float projectedWidth=aWidth*.024*scale*projectionMatrix[1][1]*uResolution.y/(2.0*max(.15,abs(clip.w)));
                  projectedWidth*=mix(.72,1.18,clamp(uDensity*.25,0.0,1.0));
                  float filamentFloor=mix(1.0,1.8,smoothstep(3.0,5.4,aWidth));
                  pixels=max(filamentFloor*uPixelRatio,projectedWidth)*(vRole>.5?1.0:.72);
                #endif
                clip.xy+=perpendicular*(uv.x*2.0-1.0)*pixels*2.0/uResolution*clip.w;
                if(aKind>.5)clip.y+=(uv.y*2.0-1.0)*pixels*2.0/uResolution.y*clip.w;
                vUv=uv;vSeed=seed;vKind=aKind;vFade=smoothstep(.015,.40,scale);
                gl_Position=clip;
              }
            `,
            fragmentShader:`
              uniform float uTime;uniform float uStrength;uniform float uSplit;uniform float uDensity;uniform float uGiant;uniform vec3 uTint;
              varying vec2 vUv;varying float vSeed;varying float vKind;varying float vRole;varying float vFade;varying float vPopulation;varying float vDensity;varying float vProminence;varying float vFamily;varying float vAlong;
              float hash(float n){return fract(sin(n*127.13+311.7)*43758.5453);}
              void main(){
                float role=vRole>.5?1.0:(.44-.20*uGiant)*uSplit;
                float d=abs(vUv.x*2.0-1.0),alpha=0.0;
                vec3 color;
                if(vKind<.5){
                  float direction=hash(vSeed+13.0)<.5?-1.0:1.0;
                  float speed=.70+hash(vSeed+3.1)*1.8;
                  float phase=fract(uTime*speed*direction+hash(vSeed+2.7));
                  float leader=exp(-pow((fract(vUv.y-phase+.5)-.5)*7.8,2.0));
                  float echo=exp(-pow((fract(vUv.y+uTime*(.4+hash(vSeed+19.0))+.5+vSeed*.13)-.5)*11.0,2.0));
                  float tail=0.0;
                  #ifdef BOLT_INSTANCED
                    // 主丝与分支共用放电前锋；亮光沿主丝抵达分叉后继续向支线传递。
                    float front=fract(uTime*(.44+hash(vFamily+3.1)*.66)+hash(vFamily+2.7));
                    float offset=fract(vAlong-front+.5)-.5;
                    leader=exp(-pow(offset*13.0,2.0));
                    tail=exp(-pow((offset+.11)*6.5,2.0));
                    echo=exp(-pow((fract(vAlong-uTime*(.23+hash(vFamily+19.0)*.24)+hash(vFamily+31.0)+.5)-.5)*16.0,2.0));
                  #endif
                  float discharge=.28+.72*pow(.5+.5*sin(uTime*(8.0+hash(vSeed)*13.0)+vSeed*9.3),2.0);
                  float tips=smoothstep(0.0,.045,vUv.y)*(1.0-smoothstep(.93,1.0,vUv.y));
                  float corona=exp(-d*d*4.3)*.21;
                  float core=exp(-d*d*45.0)*.88+exp(-d*d*180.0)*.40;
                  alpha=(corona+core)*(.32+leader*.78+echo*.24)*(.54+discharge*.46)*tips;
                  #ifdef BOLT_INSTANCED
                    float burst=clamp(uDensity*.25,0.0,1.0);
                    corona=exp(-d*d*4.0)*.26;
                    core=exp(-d*d*48.0)*.98+exp(-d*d*180.0)*.48;
                    alpha=(corona+core)*(.20+leader*1.10+tail*.34+echo*.24)*(.78+discharge*.22)*tips;
                    alpha*=mix(.78,1.28,burst)*(1.0+leader*leader*burst*.35);
                  #endif
                  color=mix(vec3(1.0,.40,.018),vec3(1.0,.94,.67),exp(-d*d*35.0));
                  #ifdef BOLT_INSTANCED
                    color=mix(vec3(1.0,.64,.16),vec3(1.0,.995,.86),exp(-d*d*32.0));
                  #endif
                }else{
                  float r=length(vUv-.5)*2.0;
                  float life=pow(.5+.5*sin(uTime*3.5+vSeed*19.0),12.0);
                  alpha=exp(-r*r*6.5)*life*.65;color=vec3(1.0,.89,.47);
                }
                alpha*=uStrength*role*vFade*vPopulation;
                #ifdef BOLT_INSTANCED
                  alpha*=mix(max(.40,.78/sqrt(max(1.0,vDensity)))*mix(1.0,.78,uGiant),.84,vProminence);
                  // 支线沿放电前锋明灭；数量阈值渐开时，支线从根部向末梢显现。
                  float branch=1.0-smoothstep(.10,.45,vProminence);
                  float branchPulse=pow(.5+.5*sin(uTime*(2.8+hash(vSeed+41.0)*3.0)+vSeed*7.1),2.0);
                  float familyFront=fract(uTime*(.44+hash(vFamily+3.1)*.66)+hash(vFamily+2.7));
                  float propagation=exp(-pow((fract(vAlong-familyFront+.5)-.5)*9.0,2.0));
                  alpha*=mix(1.0,.58+.42*max(propagation,branchPulse*.60),branch);
                  alpha*=mix(1.0,1.0-smoothstep(vPopulation,vPopulation+.10,vUv.y),branch);
                #endif
                if(alpha<.002)discard;gl_FragColor=vec4(color*uTint,min(.96,alpha));
              }
            `,transparent:true,depthWrite:false,blending:THREE.AdditiveBlending,side:THREE.DoubleSide});
        }
        function buildFilamentGeometry(bolts,motes=0){
          const p=[],previous=[],next=[],uv=[],width=[],seed=[],kind=[],birth=[],flow=[];
          function vertex(point,prev,nxt,u,v,w,s,k,b=0,group=[0,0,0,0]){p.push(...point);previous.push(...prev);next.push(...nxt);uv.push(u,v);width.push(w);seed.push(s);kind.push(k);birth.push(b);flow.push(...group);}
          bolts.forEach((bolt,index)=>{
            const pts=bolt.points;
            const group=[...(bolt.flowRoot??pts[0]),bolt.flowSeed??bolt.seed??index];
            for(let j=0;j<pts.length-1;j++){
              const a=pts[j],b=pts[j+1],prev=pts[Math.max(0,j-1)],nxt=pts[Math.min(pts.length-1,j+2)];
              const t0=j/(pts.length-1),t1=(j+1)/(pts.length-1),w=bolt.width??3.6;
              [[a,prev,b,0,t0],[a,prev,b,1,t0],[b,a,nxt,1,t1],[a,prev,b,0,t0],[b,a,nxt,1,t1],[b,a,nxt,0,t1]].forEach(v=>vertex(...v,w*(1-(bolt.taper??0)*v[4]),bolt.seed??index,0,bolt.birth??0,group));
            }
          });
          for(let k=0;k<motes;k++){
            const z=-.40+craftRandom()*3.9,a=craftRandom()*Math.PI*2,r=.08+craftRandom()*.16;
            const point=[Math.cos(a)*r,Math.sin(a)*r,z],moteWidth=1.1+craftRandom()*.7;
            for(const [u,v] of [[0,0],[1,0],[1,1],[0,0],[1,1],[0,1]])vertex(point,point,point,u,v,moteWidth,k+77,1);
          }
          const geo=new THREE.BufferGeometry();
          for(const [name,values,size] of [['position',p,3],['aPrev',previous,3],['aNext',next,3],['uv',uv,2],['aWidth',width,1],['aSeed',seed,1],['aKind',kind,1],['aBirth',birth,1],['aFlow',flow,4]])geo.setAttribute(name,new THREE.Float32BufferAttribute(values,size));
          return geo;
        }
        function thunderNoise(seed){const n=Math.sin(seed*127.13+311.7)*43758.5453;return n-Math.floor(n);}
        function thunderPath(start,end,seed,roughness=.19,depth=5){
          const a=start.isVector3?start.clone():new THREE.Vector3(...start),b=end.isVector3?end.clone():new THREE.Vector3(...end);
          const tangent=b.clone().sub(a),length=tangent.length();tangent.normalize();
          const axis=new THREE.Vector3(Math.abs(tangent.y)>.94?1:0,Math.abs(tangent.y)>.94?0:1,0);
          const N=new THREE.Vector3().crossVectors(tangent,axis).normalize(),B=new THREE.Vector3().crossVectors(tangent,N).normalize();
          let points=[a,b];
          for(let level=0;level<depth;level++){
            const next=[points[0]],displacement=length*roughness*Math.pow(.47,level);
            for(let j=0;j<points.length-1;j++){
              const mid=points[j].clone().lerp(points[j+1],.5);
              mid.addScaledVector(N,(thunderNoise(seed+level*73+j*7)-.5)*2*displacement)
                 .addScaledVector(B,(thunderNoise(seed+level*91+j*11+17)-.5)*1.35*displacement);
              next.push(mid,points[j+1]);
            }
            points=next;
          }
          return points.map(p=>[p.x,p.y,p.z]);
        }
        function flowingThunderPath(start,end,seed,time,roughness=.19,depth=5){
          const clock=time*(.70+thunderNoise(seed+17)*1.25)+thunderNoise(seed+41)*19;
          const epoch=Math.floor(clock),f=clock-epoch,t=f*f*(3-2*f);
          const from=thunderPath(start,end,seed+epoch*31.7,roughness,depth),to=thunderPath(start,end,seed+(epoch+1)*31.7,roughness,depth);
          for(let j=0;j<from.length;j++)for(let axis=0;axis<3;axis++)from[j][axis]+=(to[j][axis]-from[j][axis])*t;
          return from;
        }
        function swordThunderPath(start,end,seed,roughness=.05){
          const points=thunderPath(start,end,seed,roughness,5);
          return points.map((p,j)=>j===0||j===points.length-1?p:p.map((v,k)=>v*.80+(points[j-1][k]+points[j+1][k])*.10));
        }
        function swordThunderFork(points,index,seed,length){
          const anchor=new THREE.Vector3(...points[index]);
          const tangent=new THREE.Vector3(...points[index+1]).sub(new THREE.Vector3(...points[index-1])).normalize();
          const side=new THREE.Vector3(Math.cos(seed*2.399),Math.sin(seed*2.399),0);
          side.addScaledVector(tangent,-side.dot(tangent)).normalize();
          const angle=(18+thunderNoise(seed+23)*12)*Math.PI/180;
          const direction=tangent.clone().multiplyScalar(Math.cos(angle)).addScaledVector(side,Math.sin(angle));
          const end=anchor.clone().addScaledVector(direction,length);
          const controlA=anchor.clone().addScaledVector(tangent,length*.34);
          const controlB=end.clone().addScaledVector(direction,-length*.27);
          const across=new THREE.Vector3().crossVectors(tangent,side).normalize();
          const fork=[];
          for(let j=0;j<=12;j++){
            const t=j/12,s=1-t;
            const point=anchor.clone().multiplyScalar(s*s*s).addScaledVector(controlA,3*s*s*t)
              .addScaledVector(controlB,3*s*t*t).addScaledVector(end,t*t*t);
            const envelope=Math.pow(Math.sin(t*Math.PI),2);
            point.addScaledVector(side,(thunderNoise(seed+j*2.31)-.5)*length*.10*envelope)
              .addScaledVector(across,(thunderNoise(seed+j*3.17+19)-.5)*length*.055*envelope);
            fork.push(point.toArray());
          }
          return fork;
        }
        function createSwordLightningGeometry(){
          const bolts=[];
          // 每根主丝预置多处小角度支叉，数量滑块逐级点亮更多支线。
          for(let pack=0;pack<6;pack++)for(let strand=0;strand<2;strand++){
            const level=pack===0?0:1+(pack-1)%3,seed=pack*17.37+strand*5.19;
            const angle=seed*2.399,direction=strand?-1:1,reach=1.30+level*.66;
            const radius=.27+level*.13;
            const root=pack===0?[strand?-.14:.14,-.035,-.50]:[
              .12*Math.cos(angle),.08*Math.sin(angle),direction>0?-.30+thunderNoise(seed)*.65:3.60-thunderNoise(seed)*.65];
            const end=pack===0?[strand?-.06:.06,.025,3.52]:[
              Math.cos(angle+direction*.30)*radius,
              Math.sin(angle+direction*.30)*radius*.66,
              root[2]+direction*reach];
            const points=swordThunderPath(root,end,seed,pack===0?.070:.070+level*.010);
            const parentBirth=pack+.025+strand*.17;
            bolts.push({points,seed,width:pack===0?5.2:5.0+level*.35,birth:parentBirth});
            const forkCount=pack===0?(isMobile?5:7):(isMobile?3:4);
            for(let fork=0;fork<forkCount;fork++){
              const rank=fork/Math.max(1,forkCount-1),forkSeed=seed+29+fork*13.11;
              const slot=(fork*(forkCount%3===0?2:3))%forkCount;
              const index=3+Math.floor((slot+.25+thunderNoise(forkSeed+51)*.40)/forkCount*(points.length-7));
              const length=(.32+level*.05+thunderNoise(forkSeed+91)*.42)*(1-rank*.30);
              const birth=THREE.MathUtils.lerp(parentBirth+.10,Math.max(3.85,parentBirth+.65),rank);
              bolts.push({points:swordThunderFork(points,index,forkSeed,length),seed:forkSeed+3,
                flowRoot:root,flowSeed:seed,
                width:3.30+level*.12-rank*.18,taper:.74,birth});
            }
          }
          const geo=buildFilamentGeometry(bolts,isMobile?6:10);
          const roles=new Float32Array(CONFIG.swordCount),phases=new Float32Array(CONFIG.swordCount);
          for(let i=0;i<CONFIG.swordCount;i++){roles[i]=i<CONFIG.mainSwordCount?1:0;phases[i]=(i*.61803398875)%1;}
          geo.setAttribute('aSwordRole',new THREE.InstancedBufferAttribute(roles,1));
          geo.setAttribute('aInstanceSeed',new THREE.InstancedBufferAttribute(phases,1));return geo;
        }
        const swordLightningGeo=createSwordLightningGeometry(),swordLightningMat=createFilamentMaterial(swordLightningUniforms,true);
        const swordLightningInstanced=new THREE.InstancedMesh(swordLightningGeo,swordLightningMat,CONFIG.swordCount);
        swordLightningInstanced.name='辟邪神雷·贴剑游丝与顺流短叉';swordLightningInstanced.frustumCulled=false;scene.add(swordLightningInstanced);
        // Retain the old animation interfaces, without drawing coarse lines.
        const lightningGeo=new THREE.BufferGeometry();lightningGeo.setAttribute('position',new THREE.BufferAttribute(new Float32Array(0),3));
        const lightningLines=new THREE.Group();lightningLines.visible=false;

        function electricDensity(boost=1){return STATE.lightningEnabled?THREE.MathUtils.clamp(STATE.lightningAmount*boost,0,4):0;}
        function makeFXUniforms(tint=new THREE.Vector3(1,1,1)){
          return {uTime:{value:0},uResolution:{value:new THREE.Vector2(APP_VIEW.width,APP_VIEW.height)},
            uPixelRatio:{value:renderer.getPixelRatio()},uStrength:{value:0},uSplit:{value:1},uTint:{value:tint}};
        }
        function updateFXUniforms(uniforms,time,strength){
          const ratio=renderer.getPixelRatio();uniforms.uTime.value=time;uniforms.uStrength.value=strength;
          uniforms.uPixelRatio.value=ratio;uniforms.uResolution.value.set(APP_VIEW.width*ratio,APP_VIEW.height*ratio);
        }
        function makeArcBatch(name,maxSegments,uniforms,parent){
          const geo=new THREE.BufferGeometry(),capacity=maxSegments*6;
          for(const [key,size]of [['position',3],['aPrev',3],['aNext',3],['uv',2],['aWidth',1],['aSeed',1],['aKind',1]])
            geo.setAttribute(key,new THREE.BufferAttribute(new Float32Array(capacity*size),size).setUsage(THREE.DynamicDrawUsage));
          geo.setDrawRange(0,0);
          const mesh=new THREE.Mesh(geo,createFilamentMaterial(uniforms,false));mesh.name=name;mesh.frustumCulled=false;parent.add(mesh);
          let cursor=0;const attrs=geo.attributes;
          function put(point,previous,next,u,v,width,seed){
            const k=cursor++,p=point.isVector3?[point.x,point.y,point.z]:point,
              a=previous.isVector3?[previous.x,previous.y,previous.z]:previous,b=next.isVector3?[next.x,next.y,next.z]:next;
            for(let c=0;c<3;c++){attrs.position.array[k*3+c]=p[c];attrs.aPrev.array[k*3+c]=a[c];attrs.aNext.array[k*3+c]=b[c];}
            attrs.uv.array[k*2]=u;attrs.uv.array[k*2+1]=v;attrs.aWidth.array[k]=width;attrs.aSeed.array[k]=seed;attrs.aKind.array[k]=0;
          }
          return {mesh,geometry:geo,uniforms,begin(){cursor=0;},
            add(points,width,seed,count=points.length){
              for(let j=0;j<count-1&&cursor+6<=capacity;j++){
                const a=points[j],b=points[j+1],prev=points[Math.max(0,j-1)],next=points[Math.min(count-1,j+2)],t=j/(count-1),q=(j+1)/(count-1);
                put(a,prev,b,0,t,width,seed);put(a,prev,b,1,t,width,seed);put(b,a,next,1,q,width,seed);
                put(a,prev,b,0,t,width,seed);put(b,a,next,1,q,width,seed);put(b,a,next,0,q,width,seed);
              }
            },end(){geo.setDrawRange(0,cursor);mesh.visible=cursor>0&&uniforms.uStrength.value>.001;
              Object.values(attrs).forEach(a=>a.needsUpdate=true);},get segments(){return cursor/6;}};
        }
        function radialGlowMaterial(color){
          return new THREE.ShaderMaterial({uniforms:{uOpacity:{value:0},uColor:{value:new THREE.Color(color)},uTime:{value:0}},
            vertexShader:`varying vec2 vUv;void main(){vUv=uv;gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.0);}`,
            fragmentShader:`varying vec2 vUv;uniform float uOpacity;uniform vec3 uColor;uniform float uTime;
              void main(){float r=length(vUv-.5)*2.0;float aura=exp(-r*r*5.0)*.38+exp(-r*r*36.0)*.85;
                float alpha=aura*(1.0-smoothstep(.7,1.0,r))*uOpacity;if(alpha<.002)discard;gl_FragColor=vec4(uColor,alpha);}`,
            transparent:true,depthWrite:false,blending:THREE.AdditiveBlending,side:THREE.DoubleSide});
        }


        // A separate GPU-driven sheath of advected mist, drifting motes and
        // fine twisting filaments. Both sword families use their actual final
        // instance matrices, including their local-axis roll and giant scale.
        const swordSpinAngles=new Float32Array(CONFIG.swordCount);
        const swordSpinRates=new Float32Array(CONFIG.swordCount);
        for(let i=0;i<CONFIG.swordCount;i++){
          swordSpinAngles[i]=thunderNoise(i*13.19+21)*Math.PI*2;
          swordSpinRates[i]=(.84+thunderNoise(i*7.17+77)*.32)*(thunderNoise(i*11.37+41)>.26?1:-1);
        }
        const swordQiUniforms={uTime:{value:0},uOpacity:{value:1},uSplit:{value:1},uResolution:{value:new THREE.Vector2(APP_VIEW.width,APP_VIEW.height)}};
        function createSwordQiGeometry(count,role,firstIndex=0){
          const positions=[],uvs=[],kinds=[],seeds=[],along=[],indices=[];
          function vertex(x,y,z,u,v,kind,seed,t){positions.push(x,y,z);uvs.push(u,v);kinds.push(kind);seeds.push(seed);along.push(t);}
          function quad(kind,seed,t){const b=positions.length/3;for(const [u,v]of [[0,0],[1,0],[0,1],[1,1]])vertex(0,0,0,u,v,kind,seed,t);indices.push(b,b+1,b+2,b+2,b+1,b+3);}
          for(let k=0;k<(isMobile?12:20);k++)quad(0,thunderNoise(k*17.13+9),thunderNoise(k*23.71+4));
          for(let k=0;k<(isMobile?16:28);k++)quad(1,thunderNoise(k*27.31+19),thunderNoise(k*19.23+91));
          for(let lane=0;lane<4;lane++){
            const b=positions.length/3,steps=isMobile?18:26,seed=thunderNoise(lane*13.17+161);
            for(let j=0;j<=steps;j++)for(let side=0;side<2;side++)vertex(0,0,0,side,j/steps,2,seed,j/steps);
            for(let j=0;j<steps;j++){const a=b+j*2;indices.push(a,a+1,a+2,a+2,a+1,a+3);}
          }
          const geo=new THREE.BufferGeometry();geo.setAttribute('position',new THREE.Float32BufferAttribute(positions,3));geo.setAttribute('uv',new THREE.Float32BufferAttribute(uvs,2));
          geo.setAttribute('aQiKind',new THREE.Float32BufferAttribute(kinds,1));geo.setAttribute('aQiSeed',new THREE.Float32BufferAttribute(seeds,1));geo.setAttribute('aAlong',new THREE.Float32BufferAttribute(along,1));geo.setIndex(indices);
          const roles=new Float32Array(count).fill(role),phase=new Float32Array(count);
          for(let i=0;i<count;i++)phase[i]=thunderNoise((i+firstIndex)*19.71+73);
          geo.setAttribute('aQiRole',new THREE.InstancedBufferAttribute(roles,1));geo.setAttribute('aQiPhase',new THREE.InstancedBufferAttribute(phase,1));return geo;
        }
        const swordQiVertex=`
          attribute float aQiKind;attribute float aQiSeed;attribute float aAlong;attribute float aQiRole;attribute float aQiPhase;
          uniform float uTime;uniform float uSplit;uniform vec2 uResolution;
          varying vec2 vUv;varying float vKind;varying float vSeed;varying float vLife;varying float vVisible;
          float hash(float n){return fract(sin(n*127.13+311.7)*43758.5453);}
          void main(){
            vUv=uv;vKind=aQiKind;float seed=aQiSeed+aQiPhase*31.0;vSeed=seed;
            float scale=length(instanceMatrix[0].xyz);vVisible=smoothstep(.012,.15,scale)*(aQiRole>.5?1.0:uSplit);
            if(vVisible<.001){gl_Position=vec4(2,2,2,1);return;}
            mat4 local=modelViewMatrix*instanceMatrix;
            float speed=.13+hash(seed+19.0)*.17,direction=hash(seed+83.0)>.22?1.0:-1.0;
            float life=fract(aAlong+uTime*speed*direction+aQiPhase);float t=life;
            if(aQiKind>1.5)t=aAlong;
            vLife=aQiKind>1.5?pow(max(0.0,sin(t*3.14159265)),.55):pow(max(0.0,sin(life*3.14159265)),.75);
            float angle=seed*6.2831853+uTime*(.28+hash(seed+41.0)*.52)*direction+sin(t*7.0-uTime*(.6+hash(seed+2.0)))*.72;
            float radius=(.14+hash(seed+7.0)*.16)*(1.0-t*.40);
            if(aQiKind>1.5)radius=.11+hash(seed+7.0)*.13+sin(t*3.14159265)*.08;
            vec3 p=vec3(cos(angle)*radius,sin(angle)*radius,-.60+t*4.48);
            p.xy+=vec2(sin(t*13.0+seed+uTime*.8),cos(t*9.0+seed-uTime*.7))*.035;
            vec4 view=local*vec4(p,1.0);
            vec2 axis=(local*vec4(0,0,1,0)).xy;if(dot(axis,axis)<.0001)axis=vec2(0,1);axis=normalize(axis);
            vec2 across=vec2(axis.y,-axis.x),corner=uv-.5;
            float pixelWorld=max(.00001,-view.z*2.0/(projectionMatrix[1][1]*uResolution.y));
            if(aQiKind<.5){
              float width=(.44+hash(seed+4.0)*.38)*scale;
              float lengthwise=(.78+hash(seed+9.0)*.68)*scale;
              view.xy+=across*corner.x*width+axis*corner.y*lengthwise;
            }else if(aQiKind<1.5){
              float size=max((.018+hash(seed+4.0)*.040)*scale,pixelWorld*.85);
              view.xy+=vec2(corner.x,corner.y)*size*2.0;
            }else{
              float width=max((.009+hash(seed+13.0)*.010)*scale,pixelWorld*.65);
              view.xy+=across*corner.x*width*2.0;
            }
            gl_Position=projectionMatrix*view;
          }`;
        const swordQiFragment=`
          uniform float uTime;uniform float uOpacity;
          varying vec2 vUv;varying float vKind;varying float vSeed;varying float vLife;varying float vVisible;
          float hash(vec2 p){return fract(sin(dot(p,vec2(127.1,311.7)))*43758.5453);}
          float noise(vec2 p){vec2 i=floor(p),f=fract(p);f=f*f*(3.0-2.0*f);return mix(mix(hash(i),hash(i+vec2(1,0)),f.x),mix(hash(i+vec2(0,1)),hash(i+vec2(1,1)),f.x),f.y);}
          float fbm(vec2 p){return noise(p)*.57+noise(p*2.03+7.1)*.29+noise(p*4.13+13.7)*.14;}
          void main(){
            vec2 p=(vUv-.5)*2.0;float alpha=0.0;vec3 color=vec3(.17,.91,.66);
            if(vKind<.5){
              vec2 q=vUv*3.5+vec2(vSeed*13.1,-uTime*(.48+fract(vSeed)*.38));
              float n=fbm(q+vec2(fbm(q*.8+uTime*.12),fbm(q*.8-uTime*.13))*.75);
              float edge=length(p*vec2(1.0,.86))+(n-.5)*.45;
              float cloud=(1.0-smoothstep(.14,1.02,edge))*smoothstep(.26,.79,n);
              float wisps=pow(max(0.0,noise(vec2(p.x*8.0+sin(p.y*4.0+vSeed),p.y*2.4-uTime*.6+vSeed))),2.3);
              alpha=cloud*(.31+wisps*.32);color=mix(vec3(.065,.51,.38),vec3(.42,.98,.80),n);
            }else if(vKind<1.5){
              alpha=exp(-dot(p,p)*7.5)*(.45+.32*sin(uTime*(1.4+fract(vSeed)*2.0)+vSeed*17.0));
              color=fract(vSeed*7.73)>.83?vec3(1.0,.90,.56):vec3(.56,1.0,.82);
            }else{
              float thread=exp(-p.x*p.x*5.2);
              float pulse=.35+.65*exp(-pow((fract(vUv.y*.85-uTime*(.31+fract(vSeed)*.2)+vSeed)-.5)*5.0,2.0));
              alpha=thread*pulse*.53;color=mix(vec3(.14,.86,.61),vec3(.73,1.0,.88),pulse*.65);
            }
            alpha*=vLife*vVisible*uOpacity;if(alpha<.002)discard;gl_FragColor=vec4(color,alpha);
          }`;
        function createSwordQiMaterial(uniforms){return new THREE.ShaderMaterial({uniforms,vertexShader:swordQiVertex,fragmentShader:swordQiFragment,transparent:true,depthWrite:false,side:THREE.DoubleSide,blending:THREE.AdditiveBlending});}
        const swordQiMaterial=createSwordQiMaterial(swordQiUniforms);
        const swordQiGroup=new THREE.Group();swordQiGroup.name='流云剑气·剑身与剑光';scene.add(swordQiGroup);
        const mainSwordQi=new THREE.InstancedMesh(createSwordQiGeometry(CONFIG.mainSwordCount,1),swordQiMaterial,CONFIG.mainSwordCount);
        const spiritSwordQi=new THREE.InstancedMesh(createSwordQiGeometry(CONFIG.shadowSwordCount,0,CONFIG.mainSwordCount),swordQiMaterial,CONFIG.shadowSwordCount);
        mainSwordQi.name='本命剑·流云光丝与微尘';spiritSwordQi.name='通透剑光·流云光丝与微尘';
        mainSwordQi.instanceMatrix=bladeInstanced.instanceMatrix;spiritSwordQi.instanceMatrix=shadowInstanced.instanceMatrix;
        for(const mesh of [mainSwordQi,spiritSwordQi]){mesh.frustumCulled=false;mesh.renderOrder=4;swordQiGroup.add(mesh);}
        function updateSwordQi(time,isDragon){
          swordQiGroup.visible=STATE.swordQiEnabled&&!isDragon;spiritSwordQi.visible=STATE.splitEnabled;
          swordQiUniforms.uTime.value=time;swordQiUniforms.uSplit.value=STATE.splitEnabled?1:0;
          swordQiUniforms.uResolution.value.set(APP_VIEW.width,APP_VIEW.height);
        }


        // 6. 大庚剑阵
        const dagengGroup = new THREE.Group();
        scene.add(dagengGroup);

        const magicCircleUniforms = { uTime: { value: 0 }, uPatternTime: { value: 0 }, uOpacity: { value: 0 }, uDeploy: { value: 0 } };
        const mainCircleMesh = new THREE.Mesh(
          new THREE.PlaneGeometry(1, 1),
          new THREE.ShaderMaterial({
            uniforms: magicCircleUniforms,
            vertexShader: `varying vec2 vUv; void main() { vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }`,
            fragmentShader: `
              varying vec2 vUv;
              uniform float uPatternTime; uniform float uOpacity; uniform float uDeploy;
              void main() {
                vec2 p = vUv - vec2(0.5);
                float r = length(p);
                if (r > 0.5) discard;
                float deployRadius = uDeploy * 0.54;
                float revealMask = smoothstep(deployRadius + 0.03, deployRadius - 0.04, r);
                float shockwave = smoothstep(0.035, 0.0, abs(r - deployRadius)) * (1.0 - smoothstep(0.82, 1.0, uDeploy)) * 2.6;
                float a = atan(p.y, p.x);
                float coreGlow = exp(-r * 9.5) * 1.35;
                float goldRing1 = smoothstep(0.006, 0.0, abs(r - 0.12));
                float goldRing2 = smoothstep(0.008, 0.0, abs(r - 0.21));
                float innerRune = smoothstep(0.018, 0.0, abs(r - 0.165)) * step(0.15, sin(a * 24.0 - uPatternTime * 2.5) * sin(r * 160.0));
                float rays16 = pow(max(0.0, cos(a * 16.0 + uPatternTime * 0.4)), 18.0) * smoothstep(0.04, 0.12, r) * smoothstep(0.42, 0.16, r);
                float rays8 = pow(max(0.0, cos(a * 8.0 - uPatternTime * 0.2)), 28.0) * smoothstep(0.05, 0.15, r) * smoothstep(0.48, 0.22, r);
                float thornWave = sin(a * 20.0 + uPatternTime * 2.2) * 0.009 + cos(a * 36.0 - uPatternTime * 3.0) * 0.005;
                float jadeRing1 = smoothstep(0.011, 0.0, abs(r - 0.34 + thornWave));
                float jadeRing2 = smoothstep(0.009, 0.0, abs(r - 0.44 - thornWave * 0.7));
                float jadeOuter = smoothstep(0.005, 0.0, abs(r - 0.475));
                float jadeRunes = smoothstep(0.025, 0.0, abs(r - 0.39)) * step(0.2, sin(a * 48.0 + uPatternTime * 1.5) * cos(r * 200.0 + a * 6.0));
                float jadeNodes = pow(max(0.0, cos(a * 12.0 - uPatternTime * 0.8)), 32.0) * smoothstep(0.035, 0.0, abs(r - 0.34));
                float jadeMist = exp(-pow((r - 0.38) * 11.0, 2.0)) * 0.42;
                vec3 goldCol = vec3(1.0, 0.85, 0.28) * (coreGlow + goldRing1 * 1.6 + goldRing2 * 1.4 + innerRune * 1.3 + (rays16 + rays8) * 1.4 + shockwave * 0.9);
                vec3 jadeCol = vec3(0.15, 1.0, 0.68) * (jadeRing1 * 1.7 + jadeRing2 * 1.5 + jadeOuter * 1.1 + jadeRunes * 1.3 + jadeNodes * 2.0 + jadeMist + shockwave * 1.2);
                vec3 finalCol = (goldCol + jadeCol) * revealMask;
                float alpha = clamp((coreGlow * 0.85 + goldRing1 + goldRing2 + innerRune + rays16 * 0.8 + rays8 * 0.7 + jadeRing1 + jadeRing2 + jadeOuter + jadeRunes + jadeNodes + jadeMist * 0.7 + shockwave), 0.0, 1.0) * revealMask * uOpacity;
                gl_FragColor = vec4(finalCol, alpha);
              }
            `,
            transparent: true, side: THREE.DoubleSide, depthWrite: false, blending: THREE.AdditiveBlending,
          })
        );
        mainCircleMesh.rotation.x = -Math.PI / 2;
        mainCircleMesh.scale.set(68, 68, 1);
        dagengGroup.add(mainCircleMesh);

        const DAGENG_LAYOUT = Object.freeze({
          height:216, floor:-78, mainScale:560, subScale:132, orbitRadius:266,
          curtainRadius:338, centerDepth:-145, aimLift:34,
          subDeployStart:.62, subDeployDuration:.72,
          mainSpinSpeed:.022, subSpinSpeed:.055, orbitSpeed:.021,
        });
        const subCircleConfigs = Array.from({length:4},(_,idx)=>({
          phase:idx*Math.PI/2,scale:DAGENG_LAYOUT.subScale,
        }));
        function getDagengDiscHeight(time,center){
          return center.y+DAGENG_LAYOUT.height+Math.sin(time*1.25)*.75;
        }

        const subCircleMat = new THREE.ShaderMaterial({
          uniforms: magicCircleUniforms,
          vertexShader: `varying vec2 vUv; void main() { vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }`,
          fragmentShader: `
            varying vec2 vUv;
            uniform float uPatternTime; uniform float uOpacity;
            void main() {
              vec2 p = vUv - vec2(0.5);
              float r = length(p);
              if (r > 0.5) discard;
              float a = atan(p.y, p.x);
              float outerJade1 = smoothstep(0.012, 0.0, abs(r - 0.46));
              float outerJade2 = smoothstep(0.008, 0.0, abs(r - 0.36));
              float runeBand = smoothstep(0.032, 0.0, abs(r - 0.41)) * step(0.1, sin(a * 28.0 + uPatternTime * 2.0) * cos(r * 190.0));
              float innerGoldRing = smoothstep(0.012, 0.0, abs(r - 0.23 + sin(a * 8.0 - uPatternTime * 3.0) * 0.012));
              float innerSpokes = pow(max(0.0, cos(a * 6.0 + uPatternTime)), 16.0) * smoothstep(0.04, 0.1, r) * smoothstep(0.26, 0.18, r);
              float centerDot = exp(-r * 14.0) * 0.9;
              vec3 col = vec3(0.1, 1.0, 0.68) * (outerJade1 * 1.6 + outerJade2 * 1.3 + runeBand * 1.4) + vec3(1.0, 0.84, 0.25) * (innerGoldRing * 1.7 + innerSpokes * 1.4 + centerDot);
              float alpha = clamp(outerJade1 + outerJade2 + runeBand * 0.9 + innerGoldRing + innerSpokes + centerDot * 0.7, 0.0, 1.0) * uOpacity;
              gl_FragColor = vec4(col, alpha);
            }
          `,
          transparent: true, side: THREE.DoubleSide, depthWrite: false, blending: THREE.AdditiveBlending,
        });

        const subCircleMeshes = subCircleConfigs.map((cfg) => {
          const m = new THREE.Mesh(new THREE.PlaneGeometry(1, 1), subCircleMat);
          m.scale.set(cfg.scale, cfg.scale, 1);
          dagengGroup.add(m);
          return { mesh: m, cfg };
        });

        function getSubCircleState(idx, time, centerTarget, orbitTime = time) {
          const cfg = subCircleConfigs[idx];
          // 默认从阵盘下方观察：XZ 正向公转为逆时针，局部 Z 正向自转为顺时针。
          const orbitAng = cfg.phase + orbitTime * DAGENG_LAYOUT.orbitSpeed;
          return {
            x: centerTarget.x + Math.cos(orbitAng) * DAGENG_LAYOUT.orbitRadius,
            y: getDagengDiscHeight(time,centerTarget),
            z: centerTarget.z + Math.sin(orbitAng) * DAGENG_LAYOUT.orbitRadius,
            orbitAng,
            cfg,
          };
        }

        const threadCount = 90;
        const threadGeo = new THREE.BufferGeometry();
        const threadPositions = new Float32Array(threadCount * 6);
        const threadData = [];
        for (let i = 0; i < threadCount; i++) {
          const ang = Math.random() * Math.PI * 2;
          const rad = 3 + Math.sqrt(Math.random()) * 31;
          const topY = 17.5 - Math.random() * 5;
          const len = 8 + Math.random() * 18;
          threadData.push({ ang, rad, topY, len, phase: Math.random() * Math.PI * 2 });
        }
        threadGeo.setAttribute('position', new THREE.BufferAttribute(threadPositions, 3));
        const threadMat = new THREE.LineBasicMaterial({ color: 0x55ffbe, transparent: true, opacity: 0, blending: THREE.AdditiveBlending });
        const threadLines = new THREE.LineSegments(threadGeo, threadMat);
        threadLines.visible=false;

        const shieldOrbMesh = new THREE.Mesh(
          new THREE.IcosahedronGeometry(CONFIG.shieldRadius * 0.94, 3),
          new THREE.MeshBasicMaterial({ color: 0x00ffa2, transparent: true, opacity: 0, wireframe: true, blending: THREE.AdditiveBlending })
        );
        scene.add(shieldOrbMesh);

        // 8. 莲花剑阵 · 原画级重构（中央金色阵盘 + 外围剑与剑影放射环绕）
        const lotusDiscUniforms = { uTime: { value: 0 }, uOpacity: { value: 0 }, uDeploy: { value: 0 } };
        const lotusDiscMesh = new THREE.Mesh(
          new THREE.PlaneGeometry(1, 1),
          new THREE.ShaderMaterial({
            uniforms: lotusDiscUniforms,
            vertexShader: `varying vec2 vUv; void main() { vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }`,
            fragmentShader: `
              varying vec2 vUv;
              uniform float uTime; uniform float uOpacity; uniform float uDeploy;
              void main() {
                vec2 p = vUv - vec2(0.5);
                float r = length(p);
                if (r > 0.5) discard;
                float deployR = uDeploy * 0.52;
                float reveal = smoothstep(deployR + 0.03, deployR - 0.02, r);
                float a = atan(p.y, p.x);
                float innerSun = exp(-r * 24.0) * 1.9;
                float coreRing = smoothstep(0.005, 0.0, abs(r - 0.042));
                float coreJadeHalo = smoothstep(0.012, 0.0, abs(r - 0.056)) * 0.9;
                float bodyMask = smoothstep(0.0045, 0.0015, abs(p.x)) * smoothstep(0.016, 0.006, abs(p.y + 0.002));
                float headMask = smoothstep(0.0045, 0.0015, length(p - vec2(0.0, 0.014)));
                float figureSilhouette = clamp(bodyMask + headMask, 0.0, 1.0);
                float darkPlate = smoothstep(0.24, 0.21, r) * smoothstep(0.042, 0.055, r);
                float gRing1 = smoothstep(0.0045, 0.0, abs(r - 0.078));
                float gRing2 = smoothstep(0.0055, 0.0, abs(r - 0.118));
                float gRing3 = smoothstep(0.0065, 0.0, abs(r - 0.158));
                float gRing4 = smoothstep(0.0060, 0.0, abs(r - 0.195));
                float gRingOuter = smoothstep(0.0075, 0.0, abs(r - 0.228));
                float gearTrack1 = smoothstep(0.014, 0.0, abs(r - 0.098)) * step(0.15, sin(a * 16.0 + uTime * 1.6));
                float gearTrack2 = smoothstep(0.015, 0.0, abs(r - 0.138)) * step(0.0, cos(a * 24.0 - uTime * 1.2));
                float runeBand = smoothstep(0.014, 0.0, abs(r - 0.212)) * step(0.12, sin(a * 48.0 + uTime * 2.0) * cos(r * 260.0 + a * 8.0));
                float spokes12 = pow(max(0.0, cos(a * 6.0 - uTime * 0.45)), 26.0) * smoothstep(0.042, 0.07, r) * smoothstep(0.235, 0.19, r);
                float spokes36 = pow(max(0.0, cos(a * 18.0 + uTime * 0.25)), 32.0) * smoothstep(0.075, 0.10, r) * smoothstep(0.228, 0.16, r);
                float hiltDockGlow = exp(-pow((r - 0.242) * 28.0, 2.0)) * 0.95;
                float jadeInnerRim = smoothstep(0.008, 0.0, abs(r - 0.182)) * 0.75;
                float outerRadialBeams = pow(max(0.0, cos(a * 36.0 - uTime * 0.3)), 10.0) * exp(-pow((r - 0.34) * 8.5, 2.0)) * 0.65;
                float shockwaveRing = smoothstep(0.006, 0.0, abs(r - 0.44 - sin(uTime * 2.2) * 0.012)) * 0.45;
                float goldenMist = exp(-pow((r - 0.29) * 6.5, 2.0)) * 0.32;
                float goldMask = gRing1 * 1.5 + gRing2 * 1.4 + gRing3 * 1.5 + gRing4 * 1.3 + gRingOuter * 1.7 + gearTrack1 * 0.95 + gearTrack2 * 0.85 + runeBand * 1.35 + spokes12 * 1.65 + spokes36 * 0.9 + shockwaveRing + goldenMist;
                vec3 goldCol = vec3(1.0, 0.88, 0.36) * goldMask;
                vec3 coreCol = vec3(0.95, 1.0, 0.92) * (innerSun + coreRing * 1.8);
                vec3 jadeCol = vec3(0.22, 1.0, 0.74) * (coreJadeHalo + jadeInnerRim + hiltDockGlow + outerRadialBeams);
                vec3 darkBgCol = vec3(0.04, 0.05, 0.03) * darkPlate;
                vec3 finalCol = darkBgCol + goldCol + coreCol + jadeCol;
                finalCol = mix(finalCol, vec3(0.02, 0.04, 0.03), figureSilhouette * 0.92);
                float brightAlpha = clamp(innerSun + coreRing + goldMask * 0.9 + hiltDockGlow + outerRadialBeams + jadeInnerRim, 0.0, 1.0);
                float totalAlpha = max(darkPlate * 0.78, brightAlpha) * reveal * uOpacity;
                gl_FragColor = vec4(finalCol * reveal, totalAlpha);
              }
            `,
            transparent: true, side: THREE.DoubleSide, depthWrite: false,
          })
        );
        lotusDiscMesh.visible = false;
        scene.add(lotusDiscMesh);

        // ============================================================================
        // Five suspended seal discs: mint rune rings, dimensional jade rims,
        // intricate gold cores, and sword curtains under each subarray.
        magicCircleUniforms.uLightning={value:1};magicCircleUniforms.uDensity={value:2};magicCircleUniforms.uSub={value:0};
        const sealFragmentShader=`
          varying vec2 vUv;uniform float uTime;uniform float uOpacity;uniform float uDeploy;
          uniform float uLightning;uniform float uDensity;uniform float uSub;
          float hash(float n){return fract(sin(n*91.7+17.13)*43758.54);}
          float line(float d,float w){return 1.0-smoothstep(w*.35,w,d);}
          void main(){
            vec2 p=vUv-.5;float r=length(p),a=atan(p.y,p.x);if(r>.5)discard;
            float reveal=1.0-smoothstep(uDeploy*.54-.025,uDeploy*.54+.025,r);
            float rings=line(abs(r-.469),.0072)+line(abs(r-.443),.0055)+line(abs(r-.349),.0048);
            float halo=exp(-pow((r-.458)*40.0,2.0))*.42+exp(-pow((r-.349)*53.0,2.0))*.18;
            float coreRings=line(abs(r-.102),.0040)+line(abs(r-.197),.0046)+line(abs(r-.236),.0030);
            float spokes=pow(max(0.0,cos(a*mix(16.0,8.0,uSub)+uTime*.15)),30.0)
              *smoothstep(.04,.13,r)*(1.0-smoothstep(.23,.31,r));
            float star=line(abs(abs(p.x)+abs(p.y)-.15),.0025)+line(abs(max(abs(p.x),abs(p.y))-.116),.0020);
            float teeth=pow(max(0.0,cos(a*32.0-uTime*.25)),25.0)*line(abs(r-.273),.018);
            float wave=sin(r*93.0+sin(a*13.0-uTime*1.6)*2.0+sin(a*31.0+uTime*2.0))*.010;
            float rays=line(abs(sin(a*11.0+wave*38.0+sin(r*41.0-uTime*5.0)*.18))*r,.0045);
            float sector=floor((a+3.14159265)/6.2831853*24.0);
            float populated=step(hash(sector+floor(uTime*2.3)),min(1.0,uDensity*.30));
            float discharge=rays*smoothstep(.025,.07,r)*(1.0-smoothstep(.34,.43,r))*populated*uLightning;
            float opening=line(abs(r-uDeploy*.49),.018)*(1.0-smoothstep(.8,1.0,uDeploy));
            vec3 jade=vec3(.20,1.0,.77),gold=vec3(1.0,.83,.29);
            vec3 color=jade*(rings*1.35+halo+teeth*.5)+gold*(coreRings*1.3+spokes*.85+star*.52+discharge*1.5);
            color+=vec3(1.0,.96,.72)*exp(-r*55.0)*(.45+uLightning*.55)+jade*opening*1.5;
            float alpha=clamp(rings+halo+coreRings+spokes*.6+star*.4+teeth*.4+discharge+opening,0.0,1.0)*uOpacity*reveal;
            if(alpha<.003)discard;gl_FragColor=vec4(color,alpha);
          }
        `;
        mainCircleMesh.material.fragmentShader=sealFragmentShader;mainCircleMesh.material.needsUpdate=true;
        subCircleMat.fragmentShader=sealFragmentShader;subCircleMat.uniforms={...magicCircleUniforms,uSub:{value:1}};subCircleMat.needsUpdate=true;
        function makeSealRuneTexture(){
          const size=isMobile?1024:2048,c=document.createElement('canvas');c.width=c.height=size;
          const ctx=c.getContext('2d'),mid=size/2;
          ctx.clearRect(0,0,size,size);ctx.strokeStyle='rgba(192,255,235,.92)';ctx.lineWidth=size*.0010;
          for(const r of [.390,.431,.454]){ctx.beginPath();ctx.arc(mid,mid,size*r,0,Math.PI*2);ctx.stroke();}
          // Draw every sigil from strokes, so the seal stays complete offline
          // even on devices without Chinese calligraphic fonts installed.
          const sigils=[
            [[0,-.5,0,.5],[-.36,-.32,.36,-.32],[-.32,.18,0,.40,.32,.18]],
            [[-.3,-.5,.3,-.5,.3,.25,0,.5,-.3,.25,-.3,-.5],[0,-.3,0,.35],[-.2,0,.2,0]],
            [[-.3,-.45,.3,-.45,0,-.1,0,.5],[-.36,.08,.36,.08],[-.27,.30,.27,.30]],
            [[0,-.5,0,.5],[-.30,-.32,0,-.1,.30,-.32],[-.32,.15,0,.40,.32,.15]],
            [[-.32,-.5,-.32,.5,.32,.5,.32,-.5],[0,-.4,0,.35],[-.32,-.08,.32,-.08]],
            [[-.34,-.4,.05,-.4,.05,-.1,.34,-.1,.34,.3,-.15,.5],[-.28,.12,.12,.12],[-.15,-.5,-.15,.4]],
            [[-.32,-.35,0,-.5,.32,-.35,.32,.35,0,.5,-.32,.35,-.32,-.35],[-.18,-.1,.18,.1],[-.18,.1,.18,-.1]],
            [[-.3,-.5,.3,-.5],[0,-.5,0,.5],[-.3,-.12,.3,-.12],[-.32,.5,0,.22,.32,.5]],
          ];
          ctx.strokeStyle='rgba(210,255,239,.97)';ctx.lineWidth=size*.00125;ctx.lineCap='round';ctx.lineJoin='round';
          for(let k=0;k<72;k++){
            const a=k/72*Math.PI*2;ctx.save();ctx.translate(mid+Math.cos(a)*size*.411,mid+Math.sin(a)*size*.411);
            ctx.rotate(a+Math.PI/2);
            for(const stroke of sigils[(k*5+Math.floor(k/9))%sigils.length]){
              ctx.beginPath();ctx.moveTo(stroke[0]*size*.021,stroke[1]*size*.021);
              for(let j=2;j<stroke.length;j+=2)ctx.lineTo(stroke[j]*size*.021,stroke[j+1]*size*.021);ctx.stroke();
            }
            ctx.restore();
          }
          // Twelve double-hook cloud motifs join the outer ring to the core.
          ctx.lineWidth=size*.0011;
          for(let k=0;k<12;k++){
            const a=k/12*Math.PI*2;ctx.save();ctx.translate(mid,mid);ctx.rotate(a);
            ctx.beginPath();ctx.moveTo(size*.282,0);ctx.lineTo(size*.315,0);ctx.lineTo(size*.324,size*.012);
            ctx.lineTo(size*.315,size*.019);ctx.lineTo(size*.305,size*.010);ctx.stroke();ctx.restore();
          }
          const tex=new THREE.CanvasTexture(c);tex.anisotropy=8;return tex;
        }
        const runeTex=makeSealRuneTexture();
        const sealRuneMat=new THREE.MeshBasicMaterial({map:runeTex,color:'#b8ffdf',transparent:true,opacity:0,depthWrite:false,side:THREE.DoubleSide,blending:THREE.AdditiveBlending});
        const sealJadeMat=new THREE.MeshBasicMaterial({color:'#8affd6',transparent:true,opacity:0,depthWrite:false,blending:THREE.AdditiveBlending});
        const sealGoldMat=new THREE.MeshBasicMaterial({color:'#ffe08b',transparent:true,opacity:0,depthWrite:false,blending:THREE.AdditiveBlending});
        const sealRuneMeshes=[];
        for(const disc of [mainCircleMesh,...subCircleMeshes.map(x=>x.mesh)]){
          const rune=new THREE.Mesh(new THREE.PlaneGeometry(1,1),sealRuneMat);rune.position.z=.035;disc.add(rune);sealRuneMeshes.push(rune);
          for(const [radius,tube,mat]of [[.469,.0026,sealJadeMat],[.443,.0018,sealJadeMat],[.236,.0014,sealGoldMat],[.102,.0015,sealGoldMat]]){
            const ring=new THREE.Mesh(new THREE.TorusGeometry(radius,tube,6,isMobile?96:160),mat);ring.position.z=.02;disc.add(ring);
          }
        }
        function makeSpellMotes(name,count,parent,color){
          const geometry=new THREE.PlaneGeometry(1,1),seeds=new Float32Array(count);
          for(let k=0;k<count;k++)seeds[k]=thunderNoise(k*3.17+9)*71;
          geometry.setAttribute('aMoteSeed',new THREE.InstancedBufferAttribute(seeds,1));
          const uniforms={uTime:{value:0},uOpacity:{value:0},uColor:{value:new THREE.Color(color)}};
          const material=new THREE.ShaderMaterial({uniforms,vertexShader:`
            attribute float aMoteSeed;varying vec2 vUv;varying float vSeed;
            void main(){vUv=uv;vSeed=aMoteSeed;gl_Position=projectionMatrix*modelViewMatrix*instanceMatrix*vec4(position,1.0);}
          `,fragmentShader:`
            varying vec2 vUv;varying float vSeed;uniform float uTime;uniform float uOpacity;uniform vec3 uColor;
            void main(){vec2 p=(vUv-.5)*2.0;float r=length(p);
              float pulse=.30+.70*pow(.5+.5*sin(uTime*(1.8+fract(vSeed)*2.0)+vSeed),2.0);
              float aura=exp(-r*r*6.0)*.68+exp(-r*r*48.0)*.90;
              float crossGlow=(exp(-abs(p.x)*42.0)*exp(-abs(p.y)*6.0)+exp(-abs(p.y)*42.0)*exp(-abs(p.x)*6.0))*.30;
              float alpha=(aura+crossGlow)*pulse*uOpacity*(1.0-smoothstep(.72,1.0,r));
              if(alpha<.003)discard;gl_FragColor=vec4(uColor,alpha);
            }
          `,transparent:true,depthWrite:false,blending:THREE.AdditiveBlending,side:THREE.DoubleSide});
          const mesh=new THREE.InstancedMesh(geometry,material,count);mesh.name=name;mesh.frustumCulled=false;parent.add(mesh);
          return {mesh,uniforms,count};
        }
        const sealAuraMat=new THREE.ShaderMaterial({uniforms:{uTime:magicCircleUniforms.uTime,uOpacity:magicCircleUniforms.uOpacity},
          vertexShader:`varying vec2 vUv;void main(){vUv=uv;gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.0);}`,
          fragmentShader:`varying vec2 vUv;uniform float uTime;uniform float uOpacity;
            void main(){vec2 p=(vUv-.5)*2.0;float r=length(p),a=atan(p.y,p.x);
              float ring=exp(-pow((r-.79)*16.0,2.0))*.38+exp(-pow((r-.58)*20.0,2.0))*.13;
              float mist=exp(-r*r*3.4)*(.065+.025*sin(a*9.0-uTime*.48+r*18.0));
              float alpha=(ring+mist)*uOpacity*(1.0-smoothstep(.92,1.0,r));if(alpha<.003)discard;
              gl_FragColor=vec4(mix(vec3(.11,1.0,.68),vec3(.63,1.0,.83),ring),alpha);
            }`,transparent:true,depthWrite:false,blending:THREE.AdditiveBlending,side:THREE.DoubleSide});
        for(const disc of [mainCircleMesh,...subCircleMeshes.map(item=>item.mesh)]){
          const aura=new THREE.Mesh(new THREE.PlaneGeometry(1.18,1.18),sealAuraMat);aura.name='阵盘·厚环灵光';aura.position.z=-.035;disc.add(aura);
        }
        const sealMotes=makeSpellMotes('五阵灵珠·绕盘流辉',80,dagengGroup,'#c7ffe1'),sealMoteDummy=new THREE.Object3D();
        function updateSealMotes(time,alpha){
          sealMotes.uniforms.uTime.value=time;sealMotes.uniforms.uOpacity.value=alpha*.92;
          sealMotes.mesh.visible=alpha>.01;
          const discs=[mainCircleMesh,...subCircleMeshes.map(item=>item.mesh)];
          discs.forEach((disc,index)=>{
            disc.updateMatrixWorld(true);
            for(let k=0;k<16;k++){
              const i=index*16+k,a=k/16*Math.PI*2+time*(.18+index*.018),r=.445+Math.sin(k*1.3+time*.45)*.006;
              sealMoteDummy.position.set(Math.cos(a)*r,Math.sin(a)*r,.028).applyMatrix4(disc.matrixWorld);
              sealMoteDummy.quaternion.copy(camera.quaternion);sealMoteDummy.scale.setScalar(disc.scale.x<.1?0:index?1.15:2.05);
              sealMoteDummy.updateMatrix();sealMotes.mesh.setMatrixAt(i,sealMoteDummy.matrix);
            }
          });sealMotes.mesh.instanceMatrix.needsUpdate=true;
        }

        // 大庚剑阵：以山门为尺度的青金天幕，所有光效仍使用真实世界坐标。
        // 主阵保留巨剑术原材质，切招时分别使用各自的阵盘。
        const legacyMainSealMaterial=mainCircleMesh.material;
        const canopyFragmentShader=`
          varying vec2 vUv;
          uniform float uTime;uniform float uOpacity;uniform float uDeploy;
          uniform float uLightning;uniform float uDensity;uniform float uSub;
          float cHash(vec2 p){return fract(sin(dot(p,vec2(127.1,311.7)))*43758.5453);}
          float cNoise(vec2 p){vec2 i=floor(p),f=fract(p);f=f*f*(3.0-2.0*f);
            return mix(mix(cHash(i),cHash(i+vec2(1,0)),f.x),mix(cHash(i+vec2(0,1)),cHash(i+1.0),f.x),f.y);}
          float cLine(float d,float w){float aa=max(fwidth(d)*.75,.00018);return 1.0-smoothstep(w,w+aa,d);}
          void main(){
            vec2 p=vUv-.5;float r=length(p),a=atan(p.y,p.x);if(r>.5)discard;
            float reveal=1.0-smoothstep(uDeploy*.545-.018,uDeploy*.545+.018,r);
            float drift=uTime*.42;
            float turbulence=cNoise(p*92.0+vec2(drift,-drift*.7));
            float warp=sin(a*23.0+sin(a*9.0-drift)*1.6)*.0024+(turbulence-.5)*.005;
            float outer=cLine(abs(r-.468-warp),.0011)+cLine(abs(r-.447+warp*.7),.00075);
            float middle=cLine(abs(r-.349-warp*1.3),.0010)+cLine(abs(r-.322+warp*.5),.0007)*.7;
            float halo=exp(-pow((r-.468-warp)*115.0,2.0))*.33+exp(-pow((r-.447+warp*.7)*160.0,2.0))*.15
              +exp(-pow((r-.342)*65.0,2.0))*.24;
            float coronaDistance=abs(r-.255-warp*1.6-sin(a*17.0+drift)*.007);
            float corona=cLine(coronaDistance,.0017)+exp(-coronaDistance*170.0)*.34;
            float inner=cLine(abs(r-.167+warp*1.4),.0011)+cLine(abs(r-.095-warp*.6),.0009);
            float angular=a*mix(13.0,7.0,uSub)+sin(r*67.0-drift*2.0)*.66+sin(a*7.0+r*23.0+drift)*.55;
            float vein=cLine(abs(sin(angular))*r,.0013);
            float fork=cLine(abs(sin(angular*1.97+sin(r*137.0+a*3.0)*.75))*r,.00065);
            float crack=abs(turbulence-.51);
            float network=(cLine(crack,.030)+exp(-crack*30.0)*.32)*smoothstep(.04,.09,r)*(1.0-smoothstep(.28,.39,r));
            float live=.70+.30*sin(drift*3.0+a*5.0+r*47.0);
            float lightning=uLightning*min(1.4,.35+uDensity*.26);
            float branches=(vein+fork*.48)*smoothstep(.025,.075,r)*(1.0-smoothstep(.31,.455,r))*lightning;
            float goldWeb=(corona+inner*.8+network*.90*lightning+branches)*live;
            float jadeWeb=outer+middle*.85+branches*smoothstep(.24,.44,r)*.65;
            float core=exp(-r*r*42.0)*(.14+lightning*.16);
            float hot=exp(-r*r*1700.0)*.75;
            float vapor=(.025+cNoise(p*18.0-drift*.14)*.035)*exp(-r*r*6.0);
            float opening=cLine(abs(r-uDeploy*.49),.004)*(1.0-smoothstep(.78,1.0,uDeploy));
            vec3 jade=vec3(.30,1.0,.70),gold=vec3(1.0,.84,.34);
            vec3 color=jade*(jadeWeb*1.45+halo*1.8+vapor+opening)+gold*(goldWeb*1.8+core*2.0)+vec3(1.0,.97,.73)*hot;
            float alpha=clamp(jadeWeb+goldWeb+halo+core+hot+vapor+opening,0.0,.94)*reveal*uOpacity;
            if(alpha<.002)discard;gl_FragColor=vec4(color,alpha);
          }
        `;
        const dagengDiscMaterial=new THREE.ShaderMaterial({uniforms:magicCircleUniforms,
          vertexShader:legacyMainSealMaterial.vertexShader,fragmentShader:canopyFragmentShader,
          extensions:{derivatives:true},transparent:true,depthWrite:false,side:THREE.DoubleSide,blending:THREE.AdditiveBlending});
        subCircleMat.fragmentShader=canopyFragmentShader;subCircleMat.extensions.derivatives=true;subCircleMat.needsUpdate=true;

        const dagengFieldCenter=new THREE.Vector3();
        const canopyVolumeGroup=new THREE.Group();canopyVolumeGroup.name='大庚天幕·山门结界';dagengGroup.add(canopyVolumeGroup);
        const canopyUniforms={uTime:{value:0},uOpacity:{value:0},uDeploy:{value:0}};
        const canopyWall=new THREE.Mesh(new THREE.CylinderGeometry(1,1,1,isMobile?128:224,1,true),
          new THREE.ShaderMaterial({uniforms:canopyUniforms,
            vertexShader:`varying vec2 vUv;void main(){vUv=uv;gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.0);}`,
            fragmentShader:`varying vec2 vUv;uniform float uTime;uniform float uOpacity;uniform float uDeploy;
              float hash(float n){return fract(sin(n*127.1+17.7)*43758.54);}
              void main(){
                float column=floor(vUv.x*224.0),seed=hash(column),x=fract(vUv.x*224.0);
                float thread=exp(-pow((x-.5)*30.0,2.0))*(.14+seed*.24);
                float fall=fract(vUv.y+uTime*(.055+seed*.075)+seed);
                float stream=exp(-pow((fall-.5)*19.0,2.0));
                float rays=pow(max(0.0,sin(vUv.x*6.2831853*19.0+.8)),26.0)*.022;
                float lengthMask=smoothstep(seed*.38,seed*.38+.12,vUv.y);
                float edge=smoothstep(0.0,.14,vUv.y)*(1.0-smoothstep(.92,1.0,vUv.y));
                float deploy=smoothstep(1.0-uDeploy-.08,1.0-uDeploy+.08,vUv.y);
                float alpha=(thread*(.16+stream*1.5)+rays)*edge*lengthMask*deploy*uOpacity;
                if(alpha<.002)discard;
                gl_FragColor=vec4(mix(vec3(.07,.72,.50),vec3(.62,1.0,.85),stream),alpha);
              }`,transparent:true,depthWrite:false,side:THREE.DoubleSide,blending:THREE.AdditiveBlending}));
        canopyWall.name='环山剑气·垂天流光';canopyVolumeGroup.add(canopyWall);

        // 单次绘制的落星。前后景均在同一结界内，山峰会遮挡远处光尘。
        const canopyDustCount=isMobile?440:1000,canopyDustGeo=new THREE.BufferGeometry();
        const canopyDustPositions=new Float32Array(canopyDustCount*3),canopyDustSeeds=new Float32Array(canopyDustCount);
        for(let k=0;k<canopyDustCount;k++){
          const seed=thunderNoise(k*7.1+397),a=k*2.39996323,r=Math.sqrt(seed)*DAGENG_LAYOUT.curtainRadius;
          canopyDustPositions.set([Math.cos(a)*r,thunderNoise(k*3.17+51),Math.sin(a)*r],k*3);
          canopyDustSeeds[k]=thunderNoise(k*1.7+777);
        }
        canopyDustGeo.setAttribute('position',new THREE.BufferAttribute(canopyDustPositions,3));
        canopyDustGeo.setAttribute('aSeed',new THREE.BufferAttribute(canopyDustSeeds,1));
        const canopyDustMaterial=new THREE.ShaderMaterial({uniforms:canopyUniforms,
          vertexShader:`attribute float aSeed;uniform float uTime;uniform float uOpacity;uniform float uDeploy;
            varying float vAlpha;varying float vSeed;
            void main(){vSeed=aSeed;vec3 p=position;
              float h=fract(p.y-uTime*(.011+aSeed*.021));p.y=-78.0+h*294.0;
              p.x+=sin(uTime*.12+aSeed*37.0)*2.0;
              vec4 mv=modelViewMatrix*vec4(p,1.0);gl_Position=projectionMatrix*mv;
              gl_PointSize=clamp((450.0+aSeed*650.0)/max(1.0,-mv.z),1.0,4.0);
              vAlpha=smoothstep(0.0,.10,h)*(1.0-smoothstep(.92,1.0,h))*uOpacity*uDeploy*(.22+aSeed*.6);}
          `,
          fragmentShader:`varying float vAlpha;varying float vSeed;
            void main(){float r=length(gl_PointCoord-.5)*2.0;float glow=exp(-r*r*5.0);
              float alpha=glow*(1.0-smoothstep(.65,1.0,r))*vAlpha;
              if(alpha<.003)discard;gl_FragColor=vec4(mix(vec3(.37,1.0,.75),vec3(1.0,.96,.73),step(.88,vSeed)),alpha);}`,
          transparent:true,depthWrite:false,blending:THREE.AdditiveBlending});
        const canopyDust=new THREE.Points(canopyDustGeo,canopyDustMaterial);canopyDust.frustumCulled=false;
        canopyDust.name='结界落星·千点灵尘';canopyVolumeGroup.add(canopyDust);

        const hangingBeamUniforms={uTime:canopyUniforms.uTime,uOpacity:{value:0}};
        const hangingBeamGeo=new THREE.PlaneGeometry(1,1),hangingBeamSeeds=new Float32Array(CONFIG.mainSwordCount);
        for(let k=0;k<CONFIG.mainSwordCount;k++)hangingBeamSeeds[k]=thunderNoise(k+71);
        hangingBeamGeo.setAttribute('aSeed',new THREE.InstancedBufferAttribute(hangingBeamSeeds,1));
        const hangingBeams=new THREE.InstancedMesh(hangingBeamGeo,new THREE.ShaderMaterial({uniforms:hangingBeamUniforms,
          vertexShader:`attribute float aSeed;varying vec2 vUv;varying float vSeed;
            void main(){vUv=uv;vSeed=aSeed;gl_Position=projectionMatrix*modelViewMatrix*instanceMatrix*vec4(position,1.0);}`,
          fragmentShader:`varying vec2 vUv;varying float vSeed;uniform float uTime;uniform float uOpacity;
            void main(){float x=abs(vUv.x-.5)*2.0;
              float thread=exp(-x*x*150.0)+exp(-x*x*9.0)*.12;
              float flow=exp(-pow((fract(vUv.y+uTime*.19+vSeed)-.5)*12.0,2.0));
              float alpha=thread*(.18+flow*.68)*smoothstep(0.0,.05,vUv.y)*(1.0-smoothstep(.86,1.0,vUv.y))*uOpacity;
              if(alpha<.002)discard;gl_FragColor=vec4(vec3(.30,1.0,.75),alpha);}`,
          transparent:true,depthWrite:false,side:THREE.DoubleSide,blending:THREE.AdditiveBlending}),CONFIG.mainSwordCount);
        hangingBeams.name='七十二主剑·接天剑气';hangingBeams.frustumCulled=false;dagengGroup.add(hangingBeams);
        const hangingBeamDummy=new THREE.Object3D();

        const canopyLight=new THREE.PointLight('#6affc7',0,690,1.5);canopyLight.name='大庚阵·山门青光';scene.add(canopyLight);
        mountainUniforms.uCanopyLight={value:0};mountainUniforms.uCanopyCenter={value:new THREE.Vector3()};
        function updateDagengCanopy(time,modeTime,center,isActive){
          const alpha=isActive?magicCircleOpacity:0;
          mainCircleMesh.material=isActive?dagengDiscMaterial:legacyMainSealMaterial;
          const deploy=isActive?smoothstep(.78,2.9,modeTime):0;
          canopyUniforms.uTime.value=time;canopyUniforms.uOpacity.value=alpha*.80;canopyUniforms.uDeploy.value=deploy;
          canopyVolumeGroup.visible=alpha>.01;
          canopyVolumeGroup.position.copy(center);
          canopyWall.position.y=(DAGENG_LAYOUT.height+DAGENG_LAYOUT.floor)/2;
          canopyWall.scale.set(DAGENG_LAYOUT.curtainRadius, DAGENG_LAYOUT.height-DAGENG_LAYOUT.floor, DAGENG_LAYOUT.curtainRadius);
          canopyWall.rotation.y=time*.008;
          hangingBeams.visible=alpha>.01;hangingBeamUniforms.uOpacity.value=alpha*deploy*.80;
          for(let k=0;k<CONFIG.mainSwordCount;k++){
            const sword=swordPositions[k],top=center.y+DAGENG_LAYOUT.height;
            const bottom=Math.min(top-1,sword.y+8),height=Math.max(1,top-bottom);
            hangingBeamDummy.position.set(sword.x,(top+bottom)/2,sword.z);
            hangingBeamDummy.lookAt(camera.position.x,hangingBeamDummy.position.y,camera.position.z);
            hangingBeamDummy.scale.set(1.1+(k%3)*.35,height,1);hangingBeamDummy.updateMatrix();
            hangingBeams.setMatrixAt(k,hangingBeamDummy.matrix);
          }
          hangingBeams.instanceMatrix.needsUpdate=true;
          canopyLight.position.set(center.x,center.y+155,center.z);
          canopyLight.intensity=alpha*deploy*2.8;
          mountainUniforms.uCanopyLight.value=alpha*deploy;
          mountainUniforms.uCanopyCenter.value.set(center.x,center.y+DAGENG_LAYOUT.height,center.z);
        }


        const dagengMainAura=new THREE.InstancedMesh(shadowSwordGeo,spiritGlowMat,CONFIG.mainSwordCount);
        dagengMainAura.name='大庚主剑·青光外衣';dagengMainAura.instanceMatrix=bladeInstanced.instanceMatrix;dagengMainAura.frustumCulled=false;dagengMainAura.visible=false;dagengGroup.add(dagengMainAura);
        const fieldGoldUniforms=makeFXUniforms(),fieldJadeUniforms=makeFXUniforms(new THREE.Vector3(1.05,1.0,.90));
        const fieldGoldArcs=makeArcBatch('大庚阵·金雷贯枢',isMobile?1200:2400,fieldGoldUniforms,dagengGroup);
        const fieldJadeArcs=makeArcBatch('大庚阵·四象青雷',isMobile?1600:3200,fieldJadeUniforms,dagengGroup);
        const silkUniforms=makeFXUniforms(new THREE.Vector3(1.2,1.02,.72));
        const goldenSwordSilks=makeArcBatch('金色剑丝·万剑绞杀',isMobile?1200:2000,silkUniforms,dagengGroup);
        const castShock=new THREE.Mesh(new THREE.TorusGeometry(1,.012,8,160),new THREE.MeshBasicMaterial({color:'#b2ffe0',transparent:true,opacity:0,depthWrite:false,blending:THREE.AdditiveBlending}));
        castShock.rotation.x=-Math.PI/2;dagengGroup.add(castShock);
        const fieldPoints=Array.from({length:33},()=>new THREE.Vector3());
        // Three broad volumes surround the seals, instead of five tight
        // bunches directly under them. Each echo has its own height and orbit.
        function getDagengSwordPlacement(index,isMain,echoSlot,time,center,out){
          const band=Math.floor(index/24),rank=index%24,echo=isMain?0:echoSlot+1;
          const angle=rank/24*Math.PI*2+band*.14+time*.021+echo*.059;
          const spread=isMain?0:(echoSlot-1.5)*9;
          const radius=(band===0?122+(rank%3)*31:band===1?226+(rank%3)*25:294+(rank%3)*14)+spread;
          const height=band===0?153+Math.sin(angle*2)*23:band===1?73+Math.sin(angle*3+1)*51:-7+Math.sin(angle*2)*27;
          out.set(center.x+Math.cos(angle)*radius,
            center.y+height+(isMain?0:(echoSlot-1.5)*23),
            center.z+Math.sin(angle)*radius*(band===0?.87:.96));
          return out;
        }

        const silkMatrix=new THREE.Matrix4(),silkSource=new THREE.Vector3(),silkTarget=new THREE.Vector3(),silkControl=new THREE.Vector3();
        function readSilkEmitter(index,out){
          if(index<CONFIG.mainSwordCount)bladeInstanced.getMatrixAt(index,silkMatrix);
          else shadowInstanced.getMatrixAt(index-CONFIG.mainSwordCount,silkMatrix);
          return out.set(index%2?.10:-.10,0,1.65+(index%7)*.21).applyMatrix4(silkMatrix);
        }
        const silkFragmentShader=`
          uniform float uTime;uniform float uStrength;uniform vec3 uTint;
          varying vec2 vUv;varying float vSeed;
          void main(){
            float d=abs(vUv.x*2.0-1.0);
            float beat=.045+.955*pow(.5+.5*sin(uTime*(111.0+fract(vSeed*.71)*47.0)+vSeed*13.1),3.0);
            float sweep=.30+.70*exp(-pow((fract(vUv.y-uTime*(7.0+fract(vSeed)*5.0)+vSeed*.137)-.5)*6.0,2.0));
            float base=clamp((exp(-d*d*420.0)*.94+exp(-d*d*48.0)*.14)*sweep,0.0,.99);
            // Reduce remaining transparency by 20%, without filling the quad.
            float alpha=(1.0-(1.0-base)*.80)*(1.0-smoothstep(.40,.90,d))*beat;
            alpha*=smoothstep(0.0,.025,vUv.y)*(1.0-smoothstep(.95,1.0,vUv.y))*uStrength;
            if(alpha<.004)discard;
            vec3 gold=mix(vec3(1.0,.52,.035),vec3(1.0,.96,.63),exp(-d*d*100.0));
            gl_FragColor=vec4(gold*uTint,min(.98,alpha));
          }
        `;
        goldenSwordSilks.mesh.material.fragmentShader=silkFragmentShader;goldenSwordSilks.mesh.material.needsUpdate=true;
        const grindingShardCount=isMobile?64:112;
        const grindingShards=new THREE.InstancedMesh(new THREE.ConeGeometry(.045,.85,3),
          new THREE.MeshBasicMaterial({color:'#ffe7a2',transparent:true,opacity:0,depthWrite:false,blending:THREE.AdditiveBlending}),grindingShardCount);
        grindingShards.name='绞切余芒·碎金飞屑';grindingShards.frustumCulled=false;dagengGroup.add(grindingShards);
        const shardDummy=new THREE.Object3D();
        function updateCuttingSilks(time,modeTime,center,alpha){
          const deployed=smoothstep(1.15,3.10,modeTime),count=STATE.splitEnabled?(isMobile?84:132):(isMobile?60:96);
          updateFXUniforms(silkUniforms,time,alpha*.56*deployed);
          for(let k=0;k<count;k++){
            const mainLines=72,index=k<mainLines?k:
              CONFIG.mainSwordCount+((k-mainLines)*4)%CONFIG.shadowSwordCount;
            readSilkEmitter(index,silkSource);
            const epoch=Math.floor(time*(9.5+thunderNoise(k+53)*6.0)+k*.17),opposite=(index%72+25+(epoch%19))%72;
            readSilkEmitter(opposite,silkTarget);
            const spin=time*(7.8+thunderNoise(k+8)*4.5)+k*2.399;
            silkControl.set(center.x+Math.cos(spin)*(34+k%7*7),center.y+57+Math.sin(spin*.73+k)*58,
              center.z+Math.sin(spin)*(40+k%4*11));
            if(k%3===2)silkTarget.lerp(silkControl,.46);
            for(let j=0;j<9;j++){
              const f=j/8,a=(1-f)*(1-f),b=2*(1-f)*f,c=f*f;
              fieldPoints[j].copy(silkSource).multiplyScalar(a).addScaledVector(silkControl,b).addScaledVector(silkTarget,c);
            }
            goldenSwordSilks.add(fieldPoints,.76+k%4*.085,k*.23+239,9);
          }
          grindingShards.visible=deployed>.01&&alpha>.01;grindingShards.material.opacity=alpha*deployed*.70;
          for(let k=0;k<grindingShardCount;k++){
            const phase=(time*(1.5+k%4*.13)+k*.61803398875)%1,a=k*2.399+time*7.8,r=7+phase*24;
            shardDummy.position.set(center.x+Math.cos(a)*r,center.y-2+Math.sin(k*1.7)*14+phase*8,center.z+Math.sin(a)*r*.72);
            shardDummy.rotation.set(a*1.3,a,a*.7);shardDummy.scale.setScalar(Math.sin(phase*Math.PI)*(.45+k%3*.2));
            shardDummy.updateMatrix();grindingShards.setMatrixAt(k,shardDummy.matrix);
          }
          grindingShards.instanceMatrix.needsUpdate=true;
        }

        function updateDagengSpectacle(time,modeTime,delta,center,isActive){
          const alpha=isActive?magicCircleOpacity:0;
          updateSealMotes(time,magicCircleOpacity);
          sealRuneMat.opacity=magicCircleOpacity*(isActive?.76:.98);sealJadeMat.opacity=magicCircleOpacity*(isActive?.30:.76);sealGoldMat.opacity=magicCircleOpacity*(isActive?.38:.79);
          // 大庚阵的符文随阵盘整体自转，避免叠加反向纹理旋转。
          sealRuneMeshes.forEach((mesh,k)=>mesh.rotation.z=isActive?0:time*(k?-.045:.035));
          const density=electricDensity(isActive?1.55:1);
          magicCircleUniforms.uLightning.value=STATE.lightningEnabled?1:0;magicCircleUniforms.uDensity.value=density;
          dagengMainAura.visible=isActive&&STATE.splitEnabled&&modeTime>.65;
          const shockPhase=THREE.MathUtils.clamp((modeTime-.48)/1.55,0,1);
          castShock.visible=isActive&&modeTime>.48&&modeTime<2.03;
          castShock.position.set(center.x,center.y+DAGENG_LAYOUT.height,center.z);castShock.scale.setScalar(24+shockPhase*310);
          castShock.material.opacity=castShock.visible?Math.sin(shockPhase*Math.PI)*.65:0;
          document.getElementById('cast-flash').style.opacity=isActive&&modeTime>.48&&modeTime<1.2?String(Math.sin((modeTime-.48)/.72*Math.PI)*.32):'0';
          updateFXUniforms(fieldGoldUniforms,time,alpha*1.2);updateFXUniforms(fieldJadeUniforms,time,alpha*1.1);
          updateFXUniforms(silkUniforms,time,alpha*.95);
          fieldGoldArcs.begin();fieldJadeArcs.begin();goldenSwordSilks.begin();grindingShards.visible=false;
          if(isActive&&modeTime>.48){
            const deploy=smoothstep(.48,1.45,modeTime),top=mainCircleMesh.position.y;
            if(density>0){
              const inner=Math.ceil(density*9);
              for(let k=0;k<inner;k++){
                const a=k*2.399+time*(.08+thunderNoise(k+4)*.20)*(k%2?1:-1),r=mainCircleMesh.scale.x*(.055+k%5*.027);
                for(let j=0;j<17;j++){
                  const f=j/16,angle=a+Math.sin(j*4.31+k+time*3)*.075*Math.sin(f*Math.PI);
                  fieldPoints[j].set(center.x+Math.cos(angle)*r*f,top+.6+Math.sin(j*5.7+k+time*4)*1.4,center.z+Math.sin(angle)*r*f);
                }
                fieldGoldArcs.add(fieldPoints,5+k%3,k*.37+151,17);
              }
              for(let k=0;k<Math.ceil(density*4);k++){
                const base=k*2.399+time*(.06+thunderNoise(k+2)*.15)*(k%2?1:-1),radius=mainCircleMesh.scale.x*(.334+(k%4)*.038);
                for(let j=0;j<21;j++){
                  const f=j/20,a=base+f*.80,r=radius+Math.sin(j*5.33+k+time*5)*2.6;
                  fieldPoints[j].set(center.x+Math.cos(a)*r,top+.18+Math.cos(j*3.2+k)*.13,center.z+Math.sin(a)*r);
                }
                fieldJadeArcs.add(fieldPoints,5.4,k*.57+160,21);
              }
              for(let k=0;k<Math.ceil(density*5);k++){
                const a=k*2.399+time*.018,r=96+(k%5)*38;
                const from=new THREE.Vector3(center.x+Math.cos(a)*r,top,center.z+Math.sin(a)*r);
                const to=new THREE.Vector3(center.x+Math.cos(a+.07)*r,top-42-(k%4)*19,center.z+Math.sin(a+.07)*r);
                fieldGoldArcs.add(flowingThunderPath(from,to,k*7.1+171,time,.055,4),2.4+k%3*.6,k*.51+171);
              }
              for(let sub=0;sub<4;sub++){
                const subMesh=subCircleMeshes[sub].mesh;
                const angle=Math.atan2(subMesh.position.z-center.z,subMesh.position.x-center.x);
                const links=Math.max(1,Math.ceil(density*2));
                for(let k=0;k<links;k++){
                  const a=angle+k*.16,start=new THREE.Vector3(center.x+Math.cos(a)*mainCircleMesh.scale.x*.34,top,center.z+Math.sin(a)*mainCircleMesh.scale.x*.34);
                  const end=subMesh.position.clone();
                  fieldJadeArcs.add(flowingThunderPath(start,end,sub*31+k*4.7+193,time,.04,4),5.5,sub*4+k*.61+193);
                }
              }
            }
            // Sources are read from this frame's actual sword matrices.
            updateCuttingSilks(time,modeTime,center,alpha);
          }
          fieldGoldArcs.end();fieldJadeArcs.end();goldenSwordSilks.end();
        }

        // Rebuilt from the reference's concentric gilt wheel: double inscribed
        // rim, long radial channels, eight stepped seals, and a jade/gold iris.
        // The relief is actual beveled geometry; no screenshot is used as a face.
        lotusDiscMesh.name='莲华·镂金重轮阵盘';
        lotusDiscMesh.material.dispose();
        lotusDiscMesh.material=new THREE.ShaderMaterial({uniforms:lotusDiscUniforms,
          vertexShader:`varying vec2 vUv;void main(){vUv=uv;gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.0);}`,
          fragmentShader:`
            varying vec2 vUv;uniform float uTime;uniform float uOpacity;uniform float uDeploy;
            float ring(float r,float radius,float width){return exp(-pow((r-radius)/width,2.0));}
            void main(){
              vec2 p=vUv-.5;float r=length(p),a=atan(p.y,p.x);if(r>.496)discard;
              float reveal=1.0-smoothstep(uDeploy*.53-.018,uDeploy*.53+.018,r);
              float rims=ring(r,.476,.0034)*.38+ring(r,.454,.0024)*.28;
              float crowns=ring(r,.389,.0050)*.18+ring(r,.273,.0056)*.34+ring(r,.146,.0048)*.46;
              float jade=ring(r,.119,.011)*.47+exp(-r*r*105.0)*.15;
              float sun=exp(-r*r*1900.0)*1.35+exp(-r*r*520.0)*.42;
              float sector=floor((a+3.14159265)/6.2831853*84.0);
              float seed=fract(sin(sector*91.731+13.12)*43758.5453);
              float travel=.16+fract(uTime*(.075+seed*.08)+seed)*.235;
              float veins=pow(abs(cos((a+3.14159265)*42.0)),46.0)*ring(r,travel,.013)*.13;
              float veil=exp(-pow((r-.31)*5.8,2.0))*.037;
              vec3 color=vec3(1.0,.76,.28)*(rims+crowns+veins+veil)+vec3(.36,1.0,.57)*jade+vec3(1.0,.98,.72)*sun;
              float alpha=clamp(rims+crowns+jade+sun+veins+veil,0.0,1.0)*uOpacity*reveal;
              if(alpha<.003)discard;gl_FragColor=vec4(color,alpha);
            }`,transparent:true,depthWrite:false,side:THREE.DoubleSide,blending:THREE.AdditiveBlending});
        lotusDiscMesh.renderOrder=10;
        const lotusReliefGroup=new THREE.Group();lotusReliefGroup.name='莲华·八枢镂金浮雕';lotusDiscMesh.add(lotusReliefGroup);
        const lotusGoldMat=new THREE.ShaderMaterial({uniforms:{uOpacity:{value:0}},
          vertexShader:`varying float vShade;void main(){vShade=.70+.30*abs(normal.z);gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.0);}`,
          fragmentShader:`varying float vShade;uniform float uOpacity;void main(){gl_FragColor=vec4(vec3(1.0,.83,.36)*vShade,uOpacity);}`,
          transparent:true,opacity:0,depthWrite:false,side:THREE.DoubleSide,blending:THREE.AdditiveBlending});
        const lotusReliefMat=new THREE.ShaderMaterial({uniforms:{uOpacity:{value:0}},vertexColors:true,
          vertexShader:`varying vec3 vGold;void main(){vGold=color;gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.0);}`,
          fragmentShader:`varying vec3 vGold;uniform float uOpacity;void main(){gl_FragColor=vec4(vGold*vec3(1.0,.92,.73),uOpacity);}`,
          transparent:true,opacity:0,depthWrite:false,side:THREE.DoubleSide});
        const lotusEngraveMat=new THREE.MeshBasicMaterial({color:'#0c3225',transparent:true,opacity:0,depthWrite:false,side:THREE.DoubleSide});
        const lotusGlassMat=new THREE.MeshBasicMaterial({color:'#103b2a',transparent:true,opacity:0,depthWrite:false,side:THREE.DoubleSide});
        const lotusBacking=new THREE.Mesh(new THREE.RingGeometry(.143,.403,isMobile?96:160),lotusGlassMat);
        lotusBacking.name='莲华·半透碧玉衬底';lotusBacking.position.z=.012;lotusBacking.renderOrder=11;lotusReliefGroup.add(lotusBacking);
        const lotusTAU=Math.PI*2;
        function lotusPolar(radius,angle){return [Math.cos(angle)*radius,Math.sin(angle)*radius];}
        function lotusLocal(x,r,angle){return [Math.cos(angle)*r-Math.sin(angle)*x,Math.sin(angle)*r+Math.cos(angle)*x];}
        function lotusArc(radius,start,end,steps=12){return Array.from({length:steps+1},(_,i)=>lotusPolar(radius,start+(end-start)*i/steps));}
        // Six vertices across each section make a raised, beveled gold ribbon.
        // All strokes are batched into one geometry, including the side faces.
        function makeLotusRelief(strokes,material,name,beveled=true){
          const positions=[],colors=[],indices=[];
          const cross=beveled?[[-.50,0,.24,.16,.045],[-.50,.050,.62,.39,.11],[-.33,.110,1,.86,.49],[.33,.110,1,.91,.64],[.50,.050,.74,.51,.17],[.50,0,.24,.16,.045]]:[[-.5,0,1,1,1],[.5,0,1,1,1]];
          for(const stroke of strokes){
            const points=stroke.points,base=positions.length/3,sections=cross.length;
            for(let j=0;j<points.length;j++){
              const previous=points[Math.max(0,j-1)],next=points[Math.min(points.length-1,j+1)];
              let dx=next[0]-previous[0],dy=next[1]-previous[1],length=Math.hypot(dx,dy)||1;dx/=length;dy/=length;
              for(const [offset,height,r,g,b]of cross){positions.push(points[j][0]-dy*offset*stroke.width,points[j][1]+dx*offset*stroke.width,(stroke.z||.08)+height*(stroke.height||1));colors.push(r,g,b);}
              if(j)for(let k=0;k<sections-1;k++){const a=base+(j-1)*sections+k,b=a+sections;indices.push(a,b,a+1,a+1,b,b+1);}
            }
          }
          const geometry=new THREE.BufferGeometry();geometry.setAttribute('position',new THREE.Float32BufferAttribute(positions,3));geometry.setAttribute('color',new THREE.Float32BufferAttribute(colors,3));geometry.setIndex(indices);geometry.computeVertexNormals();geometry.computeBoundingSphere();
          const mesh=new THREE.Mesh(geometry,material);mesh.name=name;mesh.renderOrder=beveled?14:12;lotusReliefGroup.add(mesh);return mesh;
        }
        const lotusChannelStrokes=[],lotusReliefStrokes=[],lotusSealStrokes=[];
        for(let i=0;i<84;i++){
          const angle=i/84*lotusTAU,variation=(Math.sin(i*5.17)+1)*.5;
          const inner=.160+(i%3)*.0035,outer=.384+variation*.009;
          const local=[[-.0102,outer],[-.0094,.352],[-.0073,.282],[-.0050,.215],[-.0037,inner+.009]];
          for(let j=0;j<=8;j++){const t=j/8*Math.PI;local.push([-.0037*Math.cos(t),inner+.009-.007*Math.sin(t)]);}
          local.push([.0050,.215],[.0073,.282],[.0094,.352],[.0102,outer]);
          lotusReliefStrokes.push({points:local.map(p=>lotusLocal(p[0],p[1],angle)),width:.00165+(i%4===0?.0003:0),z:.08,height:.67});
          lotusChannelStrokes.push({points:[lotusLocal(0,inner+.009,angle),lotusLocal(0,outer,angle)],width:.0090,z:.049});
          if(i%2===0)lotusReliefStrokes.push({points:lotusArc(.365+(i%3)*.007,angle-.018,angle+.018,5),width:.0021,z:.10,height:.62});
        }
        // Hooked outer register, interrupted like the reference's seal writing.
        for(let i=0;i<48;i++){
          const angle=i/48*lotusTAU,step=lotusTAU/48;
          const points=[lotusPolar(.346,angle-step*.30),lotusPolar(.382,angle-step*.30),...lotusArc(.382,angle-step*.30,angle+step*.13,4),lotusPolar(.398,angle+step*.13),...lotusArc(.398,angle+step*.13,angle+step*.37,3)];
          lotusReliefStrokes.push({points,width:.00235,z:.13,height:.8});
          if(i%3!==1)lotusReliefStrokes.push({points:[lotusPolar(.405,angle),lotusPolar(.436,angle)],width:.0011,z:.095,height:.45});
        }
        for(let i=0;i<8;i++){
          const angle=i/8*lotusTAU,flip=i%2?-1:1;
          const spine=[[-.003,.150],[-.003,.207],[-.016,.218],[-.016,.237],[.006,.237],[.006,.276],[.022,.289],[.022,.311],[-.004,.311],[-.004,.399]];
          lotusSealStrokes.push({points:spine.map(p=>lotusLocal(p[0]*flip,p[1],angle)),width:.0115,z:.26,height:1.55});
          for(const [r,x,w]of [[.187,-.010,.032],[.253,.006,.047],[.331,.001,.045],[.377,-.008,.039]]){
            lotusSealStrokes.push({points:[lotusLocal((x-w/2)*flip,r,angle),lotusLocal((x+w/2)*flip,r,angle),lotusLocal((x+w/2)*flip,r+.014,angle)],width:.0066,z:.265,height:1.1});
          }
          lotusSealStrokes.push({points:[lotusLocal(-.004,.401,angle),lotusLocal(-.004,.449,angle)],width:.0026,z:.22,height:.75});
          lotusSealStrokes.push({points:lotusArc(.422,angle-.028,angle+.028,6),width:.0028,z:.23,height:.75});
        }
        makeLotusRelief(lotusChannelStrokes,lotusEngraveMat,'莲华·八十四道镂空暗槽',false);
        const lotusChannelRelief=makeLotusRelief(lotusReliefStrokes,lotusReliefMat,'莲华·八十四脉回钩金纹');
        const lotusSealRelief=makeLotusRelief(lotusSealStrokes,lotusReliefMat,'莲华·八方阶篆金枢');
        const lotusGlowCanvas=document.createElement('canvas');lotusGlowCanvas.width=lotusGlowCanvas.height=isMobile?1024:2048;
        const lotusGlowCtx=lotusGlowCanvas.getContext('2d'),lotusGlowSize=lotusGlowCanvas.width;
        lotusGlowCtx.translate(lotusGlowSize/2,lotusGlowSize/2);lotusGlowCtx.scale(lotusGlowSize,-lotusGlowSize);
        lotusGlowCtx.strokeStyle='#ffd374';lotusGlowCtx.lineCap='round';lotusGlowCtx.lineJoin='round';
        lotusGlowCtx.shadowColor='#ffc247';lotusGlowCtx.shadowBlur=isMobile?4:8;
        for(const stroke of [...lotusReliefStrokes,...lotusSealStrokes]){
          lotusGlowCtx.globalAlpha=stroke.width>.004?.85:.36;lotusGlowCtx.lineWidth=stroke.width*1.35;
          lotusGlowCtx.beginPath();stroke.points.forEach((p,j)=>j?lotusGlowCtx.lineTo(...p):lotusGlowCtx.moveTo(...p));lotusGlowCtx.stroke();
        }
        const lotusGlowTex=new THREE.CanvasTexture(lotusGlowCanvas);
        const lotusGlowMat=new THREE.MeshBasicMaterial({map:lotusGlowTex,color:'#ffd369',transparent:true,opacity:0,side:THREE.DoubleSide,depthWrite:false,blending:THREE.AdditiveBlending});
        const lotusGlowMesh=new THREE.Mesh(new THREE.PlaneGeometry(1,1),lotusGlowMat);lotusGlowMesh.name='莲华·篆纹溢金柔光';lotusGlowMesh.position.z=.10;lotusGlowMesh.renderOrder=13;lotusReliefGroup.add(lotusGlowMesh);
        for(const [radius,width,z]of [[.476,.0015,.14],[.454,.0013,.14],[.429,.00065,.11],[.401,.0010,.14],[.389,.0013,.22],[.281,.00085,.20],[.273,.0030,.27],[.151,.0020,.28],[.142,.0028,.30],[.131,.0011,.30]]){
          const ring=new THREE.Mesh(new THREE.TorusGeometry(radius,width,8,isMobile?128:224),lotusGoldMat);ring.name='莲华·重轮金箍';ring.position.z=z;ring.scale.z=32;ring.renderOrder=13;lotusReliefGroup.add(ring);
        }
        // Each rim glyph has its own branching strokes; the band stays legible
        // at a distance without reusing the much larger Dageng rune texture.
        const lotusRuneCanvas=document.createElement('canvas');lotusRuneCanvas.width=lotusRuneCanvas.height=isMobile?1024:2048;
        const lotusRuneCtx=lotusRuneCanvas.getContext('2d'),lotusRuneSize=lotusRuneCanvas.width;
        lotusRuneCtx.translate(lotusRuneSize/2,lotusRuneSize/2);lotusRuneCtx.scale(lotusRuneSize,lotusRuneSize);
        lotusRuneCtx.strokeStyle='#ffe7aa';lotusRuneCtx.lineCap='round';lotusRuneCtx.lineJoin='round';
        const lotusGlyphs=[[[[-.35,-.38],[-.35,.36],[.28,.36]],[[.26,-.36],[.26,.06],[-.30,.06]],[[.04,-.38],[.04,-.14]]],[[[-.36,-.35],[.36,-.35],[.36,.32]],[[.01,-.35],[.01,.39]],[[-.35,.04],[.30,.04]],[[-.35,.04],[-.35,.32]]],[[[-.34,.35],[-.34,-.34],[.32,-.34]],[[.31,-.06],[-.05,-.06],[-.05,.35],[.31,.35]]],[[[-.30,-.36],[.28,-.36],[.28,-.02],[-.31,-.02],[-.31,.33],[.30,.33]],[[0,-.32],[0,.36]]],[[[-.34,-.36],[-.34,.35],[.05,.35],[.05,-.35],[.35,-.35]],[[.05,.03],[.35,.03],[.35,.35]]],[[[-.35,-.35],[.35,-.35]],[[0,-.35],[0,.35]],[[.35,-.06],[-.34,-.06],[-.34,.34],[.34,.34]]]];
        for(let i=0;i<72;i++){
          const a=i/72*lotusTAU;lotusRuneCtx.save();lotusRuneCtx.rotate(a);lotusRuneCtx.translate(0,.465);lotusRuneCtx.scale(.018,.016);lotusRuneCtx.lineWidth=.085;
          for(const stroke of lotusGlyphs[(i*5+Math.floor(i/7))%lotusGlyphs.length]){lotusRuneCtx.beginPath();stroke.forEach((p,j)=>j?lotusRuneCtx.lineTo(...p):lotusRuneCtx.moveTo(...p));lotusRuneCtx.stroke();}
          if(i%3===0){lotusRuneCtx.beginPath();lotusRuneCtx.moveTo(.44,-.25);lotusRuneCtx.lineTo(.44,.20);lotusRuneCtx.stroke();}lotusRuneCtx.restore();
        }
        const lotusRuneTex=new THREE.CanvasTexture(lotusRuneCanvas);lotusRuneTex.anisotropy=4;
        const lotusRuneMat=new THREE.MeshBasicMaterial({map:lotusRuneTex,color:'#ffe9b1',transparent:true,opacity:0,side:THREE.DoubleSide,depthWrite:false,blending:THREE.AdditiveBlending});
        const lotusRunes=new THREE.Mesh(new THREE.PlaneGeometry(1,1),lotusRuneMat);lotusRunes.name='莲华·七十二篆文外环';lotusRunes.position.z=.34;lotusRunes.renderOrder=15;lotusDiscMesh.add(lotusRunes);
        const lotusIris=new THREE.Group();lotusIris.name='莲华·碧玉光核虹膜';lotusDiscMesh.add(lotusIris);
        const lotusJadeMat=new THREE.MeshBasicMaterial({color:'#8cffb1',transparent:true,opacity:0,side:THREE.DoubleSide,depthWrite:false,blending:THREE.AdditiveBlending});
        const irisStrokes=[];for(let i=0;i<88;i++){const a=i/88*lotusTAU;irisStrokes.push({points:[lotusPolar(.081,a),lotusPolar(.121,a+.010)],width:.00095,z:.38});}
        const irisMesh=makeLotusRelief(irisStrokes,lotusJadeMat,'莲华·八十八道碧光齿',false);lotusIris.add(irisMesh);
        for(const r of [.076,.124]){const ring=new THREE.Mesh(new THREE.TorusGeometry(r,.0014,8,isMobile?96:160),lotusJadeMat);ring.position.z=.39;ring.scale.z=22;ring.renderOrder=15;lotusIris.add(ring);}
        const lotusHeartMat=new THREE.MeshBasicMaterial({color:'#fff5bd',transparent:true,opacity:0,depthWrite:false});
        const lotusHeart=new THREE.Mesh(new THREE.SphereGeometry(.037,isMobile?20:32,16),lotusHeartMat);lotusHeart.name='莲华·青金灵核';lotusHeart.position.z=.48;lotusHeart.scale.z=29;lotusHeart.renderOrder=16;lotusDiscMesh.add(lotusHeart);
        const lotusHeartHalo=new THREE.Mesh(new THREE.SphereGeometry(.052,24,16),lotusJadeMat);lotusHeartHalo.position.z=.45;lotusHeartHalo.scale.z=22;lotusHeartHalo.renderOrder=15;lotusDiscMesh.add(lotusHeartHalo);
        const lotusCoreLight=new THREE.Mesh(new THREE.PlaneGeometry(.32,.32),new THREE.ShaderMaterial({uniforms:lotusDiscUniforms,
          vertexShader:`varying vec2 vUv;void main(){vUv=uv;gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.0);}`,
          fragmentShader:`varying vec2 vUv;uniform float uTime;uniform float uOpacity;void main(){
            vec2 p=(vUv-.5)*.32;float r=length(p),a=atan(p.y,p.x);
            float core=exp(-r*r*1550.0),halo=exp(-r*r*280.0)*.72;
            float rays=pow(abs(cos(a*3.0+sin(a*2.0)*.4-uTime*.08)),28.0)*exp(-r*24.0)*.34;
            float cross=exp(-abs(p.x)*950.0-abs(p.y)*30.0)*.22+exp(-abs(p.y)*1000.0-abs(p.x)*28.0)*.22;
            float alpha=(core+halo+rays+cross)*uOpacity*(1.0-smoothstep(.12,.16,r));if(alpha<.002)discard;
            gl_FragColor=vec4(mix(vec3(.76,1.0,.39),vec3(1.0,.94,.60),smoothstep(.018,.08,r)),alpha);
          }`,transparent:true,side:THREE.DoubleSide,depthWrite:false,blending:THREE.AdditiveBlending}));
        lotusCoreLight.name='莲华·灵核流光';lotusCoreLight.position.z=1.9;lotusCoreLight.renderOrder=17;lotusDiscMesh.add(lotusCoreLight);
        const lotusEffectsGroup=new THREE.Group();lotusEffectsGroup.name='千叶剑莲·金轮灵光';scene.add(lotusEffectsGroup);
        const lotusAuraUniforms={uTime:lotusDiscUniforms.uTime,uOpacity:lotusDiscUniforms.uOpacity};
        const lotusAuraMat=new THREE.ShaderMaterial({uniforms:lotusAuraUniforms,
          vertexShader:`varying vec2 vUv;void main(){vUv=uv;gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.0);}`,
          fragmentShader:`varying vec2 vUv;uniform float uTime;uniform float uOpacity;
            void main(){vec2 p=(vUv-.5)*2.0;float r=length(p),a=atan(p.y,p.x);
              float haze=exp(-pow((r-.68)*7.0,2.0))*.16+exp(-r*r*5.5)*.07;
              float rays=pow(max(0.0,cos(a*24.0+sin(a*7.0)*.8+uTime*.14)),42.0)*exp(-pow((r-.58)*4.8,2.0))*.30;
              float rim=exp(-pow((r-.90)*64.0,2.0))*.19;
              float alpha=(haze+rays+rim)*uOpacity*(1.0-smoothstep(.94,1.0,r));if(alpha<.003)discard;
              gl_FragColor=vec4(mix(vec3(.30,1.0,.66),vec3(1.0,.83,.31),smoothstep(.30,.92,r)),alpha);
            }`,transparent:true,side:THREE.DoubleSide,depthWrite:false,blending:THREE.AdditiveBlending});
        const lotusHalo=new THREE.Mesh(new THREE.PlaneGeometry(1,1),lotusAuraMat);lotusHalo.name='莲华·金青流霞';lotusEffectsGroup.add(lotusHalo);
        const lotusMotes=makeSpellMotes('莲华·流金星尘',isMobile?112:192,lotusEffectsGroup,'#fff1b0'),lotusMoteDummy=new THREE.Object3D();
        const lotusMainAura=new THREE.InstancedMesh(shadowSwordGeo,spiritGlowMat,CONFIG.mainSwordCount);
        lotusMainAura.name='千叶剑莲·主剑青光';lotusMainAura.instanceMatrix=bladeInstanced.instanceMatrix;lotusMainAura.frustumCulled=false;lotusEffectsGroup.add(lotusMainAura);
        function getLotusSwordPlacement(index,isMain,slot,time,center,out){
          const n=thunderNoise(index*7.31+slot*11.7+23),base=index/72*Math.PI*2+time*.115;
          const angle=base+(isMain?0:(slot-1.5)*.017)+(n-.5)*.024;
          const radius=isMain?22.1+(index%3)*2.5+n*2.7:24.0+slot*3.4+n*4.1+Math.sin(index*1.7)*1.0;
          const depth=isMain?(thunderNoise(index+3)-.5)*3.2:(slot-1.5)*1.55+(n-.5)*2.1;
          return out.set(center.x+Math.cos(angle)*radius,center.y+Math.sin(angle)*radius,center.z+depth+Math.sin(time*(.65+n*.3)+index)*.20);
        }
        function updateLotusSpectacle(time,center,opacity,isActive,formationProgress=1){
          const detailProgress=isActive?formationProgress:1;
          lotusEffectsGroup.visible=opacity>.01;lotusMainAura.visible=isActive&&(STATE.splitEnabled||STATE.retainMainSwordsWhenSplitOff)&&detailProgress>.01;
          const reveal=THREE.MathUtils.smoothstep(lotusDiscUniforms.uDeploy.value,.10,.88),faceOpacity=opacity*reveal;
          lotusGoldMat.opacity=faceOpacity*.80;lotusGoldMat.uniforms.uOpacity.value=lotusGoldMat.opacity;
          lotusRuneMat.opacity=faceOpacity*.95;lotusReliefMat.opacity=faceOpacity;lotusReliefMat.uniforms.uOpacity.value=faceOpacity;lotusGlowMat.opacity=faceOpacity*.64;
          lotusEngraveMat.opacity=faceOpacity*.64;lotusGlassMat.opacity=faceOpacity*.17;
          lotusJadeMat.opacity=faceOpacity*.46;lotusHeartMat.opacity=faceOpacity*.96;
          lotusRunes.rotation.z=time*.012;lotusIris.rotation.z=-time*.10;
          const pulse=1+Math.sin(time*2.1)*.035;lotusHeart.scale.set(pulse,pulse,29*pulse);lotusHeartHalo.scale.set(pulse,pulse,22*pulse);
          lotusHalo.position.set(center.x,center.y,center.z-1);lotusHalo.scale.setScalar(126);lotusHalo.rotation.z=-time*.018;
          lotusMotes.uniforms.uTime.value=time;lotusMotes.uniforms.uOpacity.value=opacity*.77*THREE.MathUtils.lerp(.25,1,detailProgress);
          for(let k=0;k<lotusMotes.count;k++){
            const seed=thunderNoise(k*13.1+9),phase=(time*(.14+seed*.20)+seed*13)%1;
            const a=k*2.399+time*(.025+thunderNoise(k+7)*.05),r=21+seed*39;
            lotusMoteDummy.position.set(center.x+Math.cos(a)*r,center.y+Math.sin(a)*r-(phase-.5)*9,center.z+(seed-.5)*9);
            lotusMoteDummy.quaternion.copy(camera.quaternion);lotusMoteDummy.scale.setScalar((.40+seed*.85)*Math.sin(phase*Math.PI));
            lotusMoteDummy.updateMatrix();lotusMotes.mesh.setMatrixAt(k,lotusMoteDummy.matrix);
          }
          lotusMotes.mesh.instanceMatrix.needsUpdate=true;
        }


        // 9. 神雷化形 · 辟邪神雷金龙 3D 建模与着色器系统（参照原画图1 & 图2）
        // ============================================================================
        const thunderDragonGroup = new THREE.Group();
        thunderDragonGroup.visible = false;
        scene.add(thunderDragonGroup);

        const dragonLight = new THREE.PointLight('#ffae19', 0, 160);
        thunderDragonGroup.add(dragonLight);


        // Gold metal needs neutral reflections: the shared night environment
        // and jade/cyan lights otherwise cast green highlights on the scales.
        // This rig renders only in the dragon pass; all albedo colors stay intact.
        const DRAGON_RENDER_LAYER=2;
        const dragonColorRig=new THREE.Group();dragonColorRig.name='金龙专属中性暖光';scene.add(dragonColorRig);
        const dragonColorAmbient=new THREE.HemisphereLight('#fff1da','#4a3520',.88);
        const dragonColorKey=new THREE.DirectionalLight('#fff0d4',1.75);dragonColorKey.position.set(-36,54,48);
        const dragonColorFill=new THREE.DirectionalLight('#ffffff',.52);dragonColorFill.position.set(42,14,24);
        const dragonColorRim=new THREE.DirectionalLight('#ffcc76',.78);dragonColorRim.position.set(24,38,-42);
        dragonColorRig.add(dragonColorAmbient,dragonColorKey,dragonColorFill,dragonColorRim,
          dragonColorKey.target,dragonColorFill.target,dragonColorRim.target);
        function createDragonNeutralEnvironment(){
          const faces=[];
          for(let face=0;face<6;face++){
            const canvas=document.createElement('canvas');canvas.width=canvas.height=128;
            const ctx=canvas.getContext('2d'),gradient=ctx.createLinearGradient(0,0,0,128);
            // Grayscale cards retain the existing metallic gold without adding hue.
            for(const [offset,color]of [[0,'#b0b0b0'],[.35,'#777777'],[.52,'#292929'],[.72,'#565656'],[1,'#121212']])
              gradient.addColorStop(offset,color);
            ctx.fillStyle=gradient;ctx.fillRect(0,0,128,128);
            if(face!==3){
              const strip=ctx.createLinearGradient(6,0,52,0);
              strip.addColorStop(0,'rgba(225,225,225,0)');strip.addColorStop(.5,'rgba(225,225,225,.68)');
              strip.addColorStop(1,'rgba(225,225,225,0)');ctx.fillStyle=strip;ctx.fillRect(6,10,46,75);
            }
            faces.push(canvas);
          }
          const texture=new THREE.CubeTexture(faces);texture.encoding=THREE.sRGBEncoding;texture.needsUpdate=true;return texture;
        }
        const dragonNeutralEnvironment=createDragonNeutralEnvironment();
        function configureDragonRenderLayers(){
          // The scene's shared lights retain their original layers and colors.
          thunderDragonGroup.traverse(node=>node.layers.set(DRAGON_RENDER_LAYER));
          dragonColorRig.traverse(node=>node.layers.set(DRAGON_RENDER_LAYER));
        }
        function renderWorldLayers(){
          const background=scene.background,environment=scene.environment,fog=scene.fog;
          try{
            renderer.clear();camera.layers.set(0);renderer.render(scene,camera);
            // 大庚阵与山门共用深度，远处的剑光会被山峰与楼阁遮挡。
            if(STATE.gestureMode!=='DAGENG')renderer.clearDepth();
            scene.background=null;camera.layers.set(1);renderer.render(scene,camera);
            if(thunderDragonGroup.visible){
              renderer.clearDepth();camera.layers.set(DRAGON_RENDER_LAYER);
              scene.environment=dragonNeutralEnvironment;scene.fog=null;
              renderer.render(scene,camera);
            }
          }finally{
            scene.background=background;scene.environment=environment;scene.fog=fog;camera.layers.set(0);
          }
          renderCopyrightWatermark();
        }

        const DRAGON_SPINE_NODES = isMobile ? 144 : 224; // 加长龙身骨骼节点数
        const DRAGON_RADIAL_SEGS = isMobile ? 40 : 64;
        const dragonSpine = Array.from({ length: DRAGON_SPINE_NODES }, (_, idx) => new THREE.Vector3(0, -idx * 0.65, 0));
        const dragonSpineTangents = Array.from({ length: DRAGON_SPINE_NODES }, () => new THREE.Vector3(0, 1, 0));
        const dragonSpineNormals = Array.from({ length: DRAGON_SPINE_NODES }, () => new THREE.Vector3(0, 0, 1));
        const dragonSpineBinormals = Array.from({ length: DRAGON_SPINE_NODES }, () => new THREE.Vector3(1, 0, 0));

        function getDragonRadiusAt(t) {
          if (t < 0.05) return THREE.MathUtils.lerp(1.62, 1.42, t / 0.05);
          if (t < 0.18) return THREE.MathUtils.lerp(1.42, 2.15, (t - 0.05) / 0.13);
          if (t < 0.62) return THREE.MathUtils.lerp(2.15, 1.72, (t - 0.18) / 0.44);
          if (t < 0.90) return THREE.MathUtils.lerp(1.72, 0.56, (t - 0.62) / 0.28);
          return THREE.MathUtils.lerp(0.56, 0.10, (t - 0.90) / 0.10);
        }

        const dragonUniforms = {
          uTime: { value: 0 },
          uOpacity: { value: 0 },
        };

        // The skin writes depth and carries real lighting. Only the restrained
        // lightning veins glow, leaving the sculpted silhouette readable.
        const dragonBodyMat = new THREE.ShaderMaterial({
          uniforms:dragonUniforms,transparent:true,depthWrite:true,
          blending:THREE.NormalBlending,side:THREE.DoubleSide,
          vertexShader:`
            varying vec2 vUv;varying vec3 vNormal;varying vec3 vWorldPos;
            void main(){vUv=uv;vec4 wp=modelMatrix*vec4(position,1.0);vWorldPos=wp.xyz;
              vNormal=normalize(mat3(modelMatrix)*normal);gl_Position=projectionMatrix*viewMatrix*wp;}
          `,
          fragmentShader:`
            varying vec2 vUv;varying vec3 vNormal;varying vec3 vWorldPos;
            uniform float uTime;uniform float uOpacity;
            float hash(vec2 p){return fract(sin(dot(p,vec2(127.1,311.7)))*43758.5453);}
            void main(){
              vec3 N=normalize(vNormal),V=normalize(cameraPosition-vWorldPos);
              vec3 L=normalize(vec3(-.48,.68,.38)),H=normalize(L+V);
              float diffuse=max(0.0,dot(N,L));float rim=pow(1.0-abs(dot(N,V)),2.6);
              float rows=vUv.y*188.0;
              vec2 st=vec2(vUv.x*20.0+mod(floor(rows),2.0)*.5,rows);
              vec2 f=fract(st)-.5;
              float cell=abs(f.x)*.86+abs(f.y)*.68;
              float seam=smoothstep(.43,.49,cell)*(1.0-smoothstep(.51,.57,cell));
              float belly=1.0-smoothstep(.13,.23,abs(vUv.x-.5));
              float groove=pow(abs(sin(vUv.y*188.0*3.14159265)),22.0);
              float pat=mix(seam,groove,belly);
              float variation=hash(floor(st));
              vec3 base=mix(vec3(.22,.095,.025),vec3(.56,.31,.075),variation*.45+.25);
              base=mix(base,vec3(.57,.36,.115),belly*.52);
              vec3 col=base*(.38+diffuse*.85);
              col+=vec3(1.0,.78,.35)*pow(max(0.0,dot(N,H)),48.0)*.7;
              float energy=.7+.3*sin(vUv.y*32.0-uTime*3.4);
              col+=vec3(.85,.38,.045)*pat*energy*.42;
              col+=vec3(.54,.31,.09)*rim*.45;
              float bolt=pow(max(0.0,sin(vUv.y*73.0+sin(vUv.x*57.0+uTime*2.0)*2.0)),38.0)
                 *pow(max(0.0,sin(vUv.x*29.0-vUv.y*57.0+uTime*1.4)),12.0);
              col+=vec3(1.0,.65,.19)*bolt*.9;
              gl_FragColor=vec4(col,uOpacity);
              #include <tonemapping_fragment>
              #include <encodings_fragment>
            }
          `,
        });


        // 龙躯动态网格构建
        const bodyVertCount = (DRAGON_SPINE_NODES) * (DRAGON_RADIAL_SEGS + 1);
        const dragonBodyGeo = new THREE.BufferGeometry();
        const dragonBodyPositions = new Float32Array(bodyVertCount * 3);
        const dragonBodyNormals = new Float32Array(bodyVertCount * 3);
        const dragonBodyUvs = new Float32Array(bodyVertCount * 2);
        const dragonBodyIndices = [];

        for (let i = 0; i < DRAGON_SPINE_NODES; i++) {
          const v = i / (DRAGON_SPINE_NODES - 1);
          for (let j = 0; j <= DRAGON_RADIAL_SEGS; j++) {
            const u = j / DRAGON_RADIAL_SEGS;
            const idx = i * (DRAGON_RADIAL_SEGS + 1) + j;
            dragonBodyUvs[idx * 2] = u;
            dragonBodyUvs[idx * 2 + 1] = v;
            if (i < DRAGON_SPINE_NODES - 1 && j < DRAGON_RADIAL_SEGS) {
              const a = idx;
              const b = idx + 1;
              const c = idx + (DRAGON_RADIAL_SEGS + 1);
              const d = idx + (DRAGON_RADIAL_SEGS + 1) + 1;
              dragonBodyIndices.push(a, b, d, a, d, c);
            }
          }
        }
        dragonBodyGeo.setAttribute('position', new THREE.BufferAttribute(dragonBodyPositions, 3));
        dragonBodyGeo.setAttribute('normal', new THREE.BufferAttribute(dragonBodyNormals, 3));
        dragonBodyGeo.setAttribute('uv', new THREE.BufferAttribute(dragonBodyUvs, 2));
        dragonBodyGeo.setIndex(dragonBodyIndices);

        const dragonBodyMesh = new THREE.Mesh(dragonBodyGeo, dragonBodyMat);
        dragonBodyMesh.frustumCulled = false;
        thunderDragonGroup.add(dragonBodyMesh);

        // 背部与颈部飘逸金鬃着色器（还原图1、图2浓密飘逸的狮鬃状金毛）
        const dragonManeMat = new THREE.ShaderMaterial({
          uniforms: dragonUniforms,
          transparent: true,
          depthWrite: false,
          blending: THREE.AdditiveBlending,
          side: THREE.DoubleSide,
          vertexShader: `
            varying vec2 vUv;
            void main() {
              vUv = uv;
              gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
            }
          `,
          fragmentShader: `
            varying vec2 vUv;
            uniform float uTime;
            uniform float uOpacity;
            float hash(vec2 p) { return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
            float noise(vec2 p) {
              vec2 i = floor(p), f = fract(p);
              f = f * f * (3.0 - 2.0 * f);
              return mix(mix(hash(i), hash(i + vec2(1.0, 0.0)), f.x),
                         mix(hash(i + vec2(0.0, 1.0)), hash(i + vec2(1.0, 1.0)), f.x), f.y);
            }
            void main() {
              // 丝缕状金鬃毛发纹理
              float strands = noise(vec2(vUv.y * 85.0 - uTime * 6.0, vUv.x * 6.0)) * 0.65 +
                              noise(vec2(vUv.y * 160.0 + uTime * 9.0, vUv.x * 12.0)) * 0.35;
              float tipFade = pow(1.0 - vUv.x, 1.45);
              float rootGlow = smoothstep(0.25, 0.0, vUv.x);
              float hairMask = smoothstep(0.22, 0.78, strands + rootGlow * 0.45) * tipFade;

              vec3 baseAmber = vec3(0.85, 0.45, 0.08);
              vec3 brightMane = vec3(0.88, 0.61, 0.20);
              vec3 sparkWhite = vec3(1.0, 0.98, 0.82);

              vec3 col = mix(baseAmber, brightMane, strands);
              col = mix(col, sparkWhite, rootGlow * 0.65);
              float alpha = hairMask * 0.22 * uOpacity;
              if (alpha < 0.02) discard;
              gl_FragColor = vec4(col, alpha);
            }
          `,
        });


        // Separate, curved locks replace the continuous sheet-like mane.
        // Every lock has three crossed ribbons and the original amber shader.
        function createDragonLockGeometry(seed=0) {
          const p=[],uv=[],ix=[],steps=12;
          for(let ribbon=0;ribbon<3;ribbon++){
            const angle=ribbon*Math.PI/3,base=p.length/3;
            for(let j=0;j<=steps;j++){
              const t=j/steps,spread=Math.pow(Math.sin(Math.PI*t)*.96+.04,.68)*(1-t*.72);
              const drift=Math.sin(t*5.0+seed)*t*t*.15;
              for(let side=0;side<2;side++){
                const w=(side-.5)*spread;
                p.push(w*Math.cos(angle)+drift,t+w*Math.sin(angle)*.28,-t*t*.90+Math.sin(t*3.1+seed)*t*.12);
                uv.push(t,side+ribbon*.27);
              }
              if(j<steps){const k=base+j*2;ix.push(k,k+1,k+3,k,k+3,k+2);}
            }
          }
          const g=new THREE.BufferGeometry();g.setAttribute('position',new THREE.Float32BufferAttribute(p,3));
          g.setAttribute('uv',new THREE.Float32BufferAttribute(uv,2));g.setIndex(ix);g.computeVertexNormals();return g;
        }
        const dragonLockGeo=createDragonLockGeometry(.7);
        const dragonFurMat=dragonManeMat.clone();
        dragonFurMat.uniforms=dragonUniforms;
        dragonFurMat.vertexShader=`varying vec2 vUv;
          void main(){vUv=uv;vec4 p=vec4(position,1.0);
            #ifdef USE_INSTANCING
              p=instanceMatrix*p;
            #endif
            gl_Position=projectionMatrix*modelViewMatrix*p;}`;
        const DRAGON_FUR_COUNT=isMobile?480:960;
        const dragonFur=new THREE.InstancedMesh(dragonLockGeo,dragonFurMat,DRAGON_FUR_COUNT);
        dragonFur.name='分束立体金鬃·颈鬃背鬃与流苏尾';dragonFur.frustumCulled=false;
        dragonFur.instanceMatrix.setUsage(THREE.DynamicDrawUsage);thunderDragonGroup.add(dragonFur);
        const dragonFurSlots=Array.from({length:DRAGON_FUR_COUNT},(_,k)=>{
          const h=thunderNoise(k*7.19+312),q=thunderNoise(k*3.37+19);
          const t=k%5<2?.006+h*.225:k%5===2?.815+h*.184:.03+h*.94;
          const neck=t<.24,tail=t>.81;
          return {t,angle:(q-.5)*(neck?4.2:tail?5.3:1.65),
            length:(neck?3.2+h*2.6:tail?2.4+h*4.6:1.1+h*1.4),width:.12+q*.30,phase:k*2.399};
        });
        const furDummy=new THREE.Object3D(),furBasis=new THREE.Matrix4();
        const furC=new THREE.Vector3(),furT=new THREE.Vector3(),furB=new THREE.Vector3(),furN=new THREE.Vector3();
        const furOut=new THREE.Vector3(),furAcross=new THREE.Vector3();
        function updateDragonFur(time){
          for(let k=0;k<DRAGON_FUR_COUNT;k++){
            const slot=dragonFurSlots[k],sample=slot.t*(DRAGON_SPINE_NODES-1),i=Math.min(DRAGON_SPINE_NODES-2,Math.floor(sample)),f=sample-i;
            furC.lerpVectors(dragonSpine[i],dragonSpine[i+1],f);
            furT.lerpVectors(dragonSpineTangents[i],dragonSpineTangents[i+1],f).normalize();
            furB.lerpVectors(dragonSpineBinormals[i],dragonSpineBinormals[i+1],f).projectOnPlane(furT).normalize();
            furN.crossVectors(furT,furB).normalize();
            const a=slot.angle+Math.sin(time*2.2-slot.t*13+slot.phase)*.13;
            furOut.copy(furN).multiplyScalar(Math.cos(a)).addScaledVector(furB,Math.sin(a));
            furAcross.copy(furB).multiplyScalar(Math.cos(a)).addScaledVector(furN,-Math.sin(a));
            furBasis.makeBasis(furAcross,furOut,furT);furDummy.quaternion.setFromRotationMatrix(furBasis);
            furDummy.position.copy(furC).addScaledVector(furOut,getDragonRadiusAt(slot.t)*dragonOpacity*1.04);
            const flutter=1+Math.sin(time*3.4-slot.t*21+slot.phase)*.12;
            furDummy.scale.set(slot.width*dragonOpacity,slot.length*dragonOpacity*flutter,slot.length*dragonOpacity);
            furDummy.updateMatrix();dragonFur.setMatrixAt(k,furDummy.matrix);
          }
          dragonFur.instanceMatrix.needsUpdate=true;
        }

        // 龙头、龙角与龙爪的高光材质
        const dragonHornMat = new THREE.MeshStandardMaterial({
          color: '#b07827',
          emissive: '#e78c13',
          emissiveIntensity: 0.13,
          envMapIntensity: 1.2,
          roughness: 0.32,
          metalness: 0.82,
        });
        const dragonHeadArmorMat = new THREE.MeshStandardMaterial({
          color: '#d8a04a',
          emissive: '#eea42a',
          emissiveIntensity: 0.16,
          envMapIntensity: 1.25,
          roughness: 0.26,
          metalness: 0.75,
        });
        const dragonToothMat = new THREE.MeshPhysicalMaterial({
          color: '#f8e3b2', roughness: 0.28, metalness: 0.12,
          clearcoat: 0.35, emissive: '#d99736', emissiveIntensity: 0.08,
        });
        const dragonEyeMat = new THREE.MeshBasicMaterial({
          color: '#ffd65d',
        });

        function createDragonSkinMaps() {
          const c=document.createElement('canvas'),b=document.createElement('canvas');
          c.width=b.width=768;c.height=b.height=768;
          const ctx=c.getContext('2d'),bump=b.getContext('2d');
          ctx.fillStyle='#69421c';ctx.fillRect(0,0,768,768);bump.fillStyle='#282828';bump.fillRect(0,0,768,768);
          for(let row=-1;row<25;row++)for(let col=-1;col<19;col++){
            const x=col*44+(row%2)*22,y=row*33;
            for(const [target,relief] of [[ctx,false],[bump,true]]){
              const g=target.createLinearGradient(x,y,x+5,y+40);
              if(relief){g.addColorStop(0,'#676767');g.addColorStop(.35,'#d2d2d2');g.addColorStop(1,'#555555');}
              else{g.addColorStop(0,'#9a672a');g.addColorStop(.35,'#d4a950');g.addColorStop(1,'#82531d');}
              target.fillStyle=g;target.beginPath();target.moveTo(x-20,y);target.quadraticCurveTo(x-23,y+18,x,y+40);target.quadraticCurveTo(x+23,y+18,x+20,y);target.closePath();target.fill();
              target.lineWidth=relief?1.5:1;target.strokeStyle=relief?'#e5e5e5':'#efd18a';target.stroke();
            }
          }
          const map=new THREE.CanvasTexture(c),relief=new THREE.CanvasTexture(b);
          map.encoding=THREE.sRGBEncoding;map.wrapS=map.wrapT=relief.wrapS=relief.wrapT=THREE.RepeatWrapping;
          map.anisotropy=relief.anisotropy=8;return {map,relief};
        }
        const dragonSkinMaps=createDragonSkinMaps();
        const dragonSkinMat=new THREE.MeshPhysicalMaterial({map:dragonSkinMaps.map,bumpMap:dragonSkinMaps.relief,bumpScale:.11,
          color:'#e8c178',roughness:.35,metalness:.54,clearcoat:.3,clearcoatRoughness:.27,
          envMapIntensity:1.05,emissive:'#e2911b',emissiveIntensity:.055});
        const armorScaleGeo=createRefinedDragonScaleGeometry();
        const carvedGoldMat=new THREE.MeshPhysicalMaterial({color:'#d0932f',roughness:.38,metalness:.78,clearcoat:.20,
          envMapIntensity:.82,emissive:'#f4aa27',emissiveIntensity:.07,side:THREE.DoubleSide});
        const darkMouthMat=new THREE.MeshStandardMaterial({color:'#21100d',roughness:.7,emissive:'#8e300b',emissiveIntensity:.08});
        const irisDarkMat=new THREE.MeshStandardMaterial({color:'#110d08',roughness:.22,metalness:.25});


        // All new geometry reuses the original skin, gold, horn and tooth
        // materials. No palette, exposure or lighting settings are changed.
        function createRefinedDragonScaleGeometry(){
          const outline=[[0,-.66],[-.20,-.53],[-.38,-.30],[-.48,-.03],[-.43,.24],[-.26,.43],
            [0,.51],[.26,.43],[.43,.24],[.48,-.03],[.38,-.30],[.20,-.53]];
          const p=[],uv=[],indices=[],rings=[1,.88,.66,.36,.10],heights=[0,.035,.115,.172,.205],m=outline.length;
          for(let r=0;r<rings.length;r++)for(const [x,z]of outline){
            const ridge=(1-Math.abs(x)/.5)*.045*(r===0?0:1);
            p.push(x*rings[r],heights[r]+ridge,z*rings[r]);uv.push(x*rings[r]+.5,z*rings[r]*.8+.5);
          }
          for(let r=0;r<rings.length-1;r++)for(let j=0;j<m;j++){
            const a=r*m+j,b=r*m+(j+1)%m,c=a+m,d=b+m;indices.push(a,c,b,b,c,d);
          }
          const c=p.length/3;p.push(0,.255,-.04);uv.push(.5,.47);
          for(let j=0;j<m;j++)indices.push((rings.length-1)*m+j,c,(rings.length-1)*m+(j+1)%m);
          const g=new THREE.BufferGeometry();g.setAttribute('position',new THREE.Float32BufferAttribute(p,3));
          g.setAttribute('uv',new THREE.Float32BufferAttribute(uv,2));g.setIndex(indices);g.computeVertexNormals();
          if(g.attributes.normal.getY(c)<0){for(let k=0;k<indices.length;k+=3){const a=indices[k+1];indices[k+1]=indices[k+2];indices[k+2]=a;}g.setIndex(indices);g.computeVertexNormals();}
          return g;
        }

        function sculptDragonTube(points,radius,segments=22,radial=10,fluting=0,tip=.003){
          const curve=new THREE.CatmullRomCurve3(points.map(p=>p.isVector3?p.clone():new THREE.Vector3(...p)),false,'centripetal');
          const frames=curve.computeFrenetFrames(segments,false),p=[],uv=[],ix=[];
          for(let j=0;j<=segments;j++){
            const t=j/segments,c=curve.getPointAt(t),N=frames.normals[j],B=frames.binormals[j];
            const r=tip+radius*Math.pow(1-t,.79)*(1+Math.sin(t*Math.PI)*.13);
            for(let k=0;k<=radial;k++){
              const a=k/radial*Math.PI*2,ridge=1+fluting*(Math.cos(a*5)+Math.sin(t*63)*.24+Math.sin(t*111+a*3)*.16);
              const v=c.clone().addScaledVector(N,Math.cos(a)*r*ridge).addScaledVector(B,Math.sin(a)*r*ridge);
              p.push(v.x,v.y,v.z);uv.push(k/radial,t);
              if(j<segments&&k<radial){const q=j*(radial+1)+k;ix.push(q,q+1,q+radial+2,q,q+radial+2,q+radial+1);}
            }
          }
          // Close both ends so the horns and talons remain solid from any angle.
          for(const end of [0,1]){
            const c=curve.getPointAt(end),center=p.length/3;p.push(c.x,c.y,c.z);uv.push(.5,end);
            const base=end?segments*(radial+1):0;
            for(let k=0;k<radial;k++)end?ix.push(center,base+k,base+k+1):ix.push(center,base+k+1,base+k);
          }
          const g=new THREE.BufferGeometry();g.setAttribute('position',new THREE.Float32BufferAttribute(p,3));
          g.setAttribute('uv',new THREE.Float32BufferAttribute(uv,2));g.setIndex(ix);g.computeVertexNormals();return g;
        }
        function dragonTube(parent,points,radius,material,segments=22,radial=10,fluting=0){
          const mesh=new THREE.Mesh(sculptDragonTube(points,radius,segments,radial,fluting),material);parent.add(mesh);return mesh;
        }
        function createSculptedHornSegment(rTop,rBot,height,curveX=0,curveZ=0){
          return sculptDragonTube([[0,0,0],[curveX*.18,height*.40,curveZ*.18],[curveX*.62,height*.78,curveZ*.62],
            [curveX,height,curveZ]],rBot,isMobile?14:24,isMobile?8:12,.12,rTop);
        }
        function createDragonLoft(sections,segments=40,radial=32){
          const p=[],uv=[],ix=[];
          for(let j=0;j<=segments;j++){
            const t=j/segments,q=t*(sections.length-1),i=Math.min(sections.length-2,Math.floor(q)),f=q-i;
            const w=f*f*(3-2*f),a=sections[i],b=sections[i+1];
            const z=THREE.MathUtils.lerp(a[0],b[0],f),width=THREE.MathUtils.lerp(a[1],b[1],w),
              top=THREE.MathUtils.lerp(a[2],b[2],w),bottom=THREE.MathUtils.lerp(a[3],b[3],w);
            for(let k=0;k<=radial;k++){
              const u=k/radial,ang=u*Math.PI*2,c=Math.cos(ang);
              p.push(Math.sin(ang)*width,c>=0?c*top:c*bottom,z);uv.push(u,t);
              if(j<segments&&k<radial){const n=j*(radial+1)+k;ix.push(n,n+radial+1,n+1,n+1,n+radial+1,n+radial+2);}
            }
          }
          for(const end of [0,1]){
            const center=p.length/3;p.push(0,0,sections[end?sections.length-1:0][0]);uv.push(.5,end);
            const base=end?segments*(radial+1):0;
            for(let k=0;k<radial;k++)end?ix.push(center,base+k+1,base+k):ix.push(center,base+k,base+k+1);
          }
          const g=new THREE.BufferGeometry();g.setAttribute('position',new THREE.Float32BufferAttribute(p,3));
          g.setAttribute('uv',new THREE.Float32BufferAttribute(uv,2));g.setIndex(ix);g.computeVertexNormals();return g;
        }
        function dragonPlate(parent,x,y,z,sx,sz,rx=0,rz=0,material=carvedGoldMat){
          const plate=new THREE.Mesh(armorScaleGeo,material);plate.position.set(x,y,z);
          plate.rotation.set(rx,0,rz);plate.scale.set(sx,Math.max(.22,sx*.85),sz);parent.add(plate);return plate;
        }
        const dragonHeadGroup=new THREE.Group();dragonHeadGroup.name='金雷神龙·精雕龙首';thunderDragonGroup.add(dragonHeadGroup);
        function buildDragonHead(){
          const skullGeo=new THREE.SphereGeometry(1,isMobile?32:48,isMobile?24:32),sp=skullGeo.attributes.position;
          for(let k=0;k<sp.count;k++){
            const x=sp.getX(k),y=sp.getY(k),z=sp.getZ(k),temple=1+.10*Math.sin(z*3.2+y*1.7);
            sp.setXYZ(k,x*1.62*temple,y*(y>0?1.03:.74),z*2.04);
          }
          skullGeo.computeVertexNormals();const skull=new THREE.Mesh(skullGeo,dragonSkinMat);skull.position.set(0,.60,-.12);dragonHeadGroup.add(skull);
          const muzzle=new THREE.Mesh(createDragonLoft([[-.05,1.34,.63,.38],[1.2,1.25,.72,.20],
            [2.4,.98,.56,.15],[3.6,.86,.45,.13],[4.65,.98,.53,.16],[5.10,.76,.36,.12]],isMobile?36:52),dragonSkinMat);
          muzzle.position.y=.22;dragonHeadGroup.add(muzzle);
          for(let row=0;row<10;row++){
            const z=.25+row*.43,width=.70-row*.039;
            dragonPlate(dragonHeadGroup,0,1.49-row*.09,z,width,.63,-.10,0,dragonHeadArmorMat);
            for(const side of [-1,1])dragonPlate(dragonHeadGroup,side*width*.73,1.35-row*.082,z-.12,width*.67,.58,-.12,side*-.58);
          }
          // Small fitted nasal scales break up the broad muzzle surface.
          const snoutProfile=[[1.0,1.26,.71],[2.4,.98,.56],[3.6,.86,.45],[4.70,.97,.51]];
          for(let row=0;row<12;row++){
            const z=1.0+row*.324;let index=0;
            while(index<snoutProfile.length-2&&z>snoutProfile[index+1][0])index++;
            const a=snoutProfile[index],b=snoutProfile[index+1],f=THREE.MathUtils.clamp((z-a[0])/(b[0]-a[0]),0,1);
            const width=THREE.MathUtils.lerp(a[1],b[1],f),height=THREE.MathUtils.lerp(a[2],b[2],f);
            for(let col=-2;col<=2;col++){
              const x=col*.29,angle=Math.asin(x/width);
              dragonPlate(dragonHeadGroup,x,.24+Math.cos(angle)*height,z,.32,.43,-.08,-angle);
            }
            for(const side of [-1,1])for(let band=0;band<3;band++){
              const y=.20+band*.16,angle=Math.acos(THREE.MathUtils.clamp((y-.22)/height,-.9,.9));
              dragonPlate(dragonHeadGroup,side*(Math.sin(angle)*width+.015),y,z-.12,.26,.41,-.04,-side*angle);
            }
          }
          for(const side of [-1,1]){
            const nose=new THREE.Mesh(new THREE.SphereGeometry(1,28,18),dragonHornMat);nose.scale.set(.57,.32,.49);nose.position.set(side*.51,.58,4.82);dragonHeadGroup.add(nose);
            const nostril=new THREE.Mesh(new THREE.SphereGeometry(1,24,16),darkMouthMat);nostril.scale.set(.235,.125,.10);nostril.position.set(side*.60,.64,5.16);nostril.rotation.y=side*.40;dragonHeadGroup.add(nostril);
            dragonTube(dragonHeadGroup,[[side*.25,.71,5.04],[side*.52,.85,4.98],[side*.83,.74,4.77]],.075,dragonHeadArmorMat,16,8);
            dragonTube(dragonHeadGroup,[[side*1.27,.22,1.15],[side*1.11,.15,2.7],[side*.87,.18,4.75]],.085,dragonHeadArmorMat,28,8);
            // Recessed almond-shaped eyes, slit pupils and overlapping lids.
            const socket=new THREE.Mesh(new THREE.SphereGeometry(1,24,16),darkMouthMat);socket.scale.set(.25,.34,.67);socket.position.set(side*1.42,.95,1.20);dragonHeadGroup.add(socket);
            const eye=new THREE.Mesh(new THREE.SphereGeometry(1,32,24),dragonEyeMat);eye.scale.set(.18,.215,.49);eye.position.set(side*1.56,.98,1.28);eye.rotation.x=-.17;dragonHeadGroup.add(eye);
            const pupil=new THREE.Mesh(new THREE.SphereGeometry(1,20,16),irisDarkMat);pupil.scale.set(.055,.187,.055);pupil.position.set(side*1.735,.99,1.34);pupil.rotation.x=-.17;dragonHeadGroup.add(pupil);
            const glint=new THREE.Mesh(new THREE.SphereGeometry(.038,10,8),dragonToothMat);glint.position.set(side*1.75,1.07,1.43);dragonHeadGroup.add(glint);
            dragonTube(dragonHeadGroup,[[side*1.32,1.12,1.88],[side*1.66,1.25,1.34],[side*1.68,1.16,.67]],.10,dragonHeadArmorMat,22,9);
            dragonTube(dragonHeadGroup,[[side*1.40,.85,1.78],[side*1.64,.76,1.25],[side*1.60,.85,.73]],.065,dragonHeadArmorMat,20,8);
            dragonTube(dragonHeadGroup,[[side*1.04,1.25,1.85],[side*1.53,1.53,.94],[side*1.94,1.83,-.20],[side*2.01,2.0,-1.05]],.30,dragonHornMat,26,12,.15);
            dragonTube(dragonHeadGroup,[[side*1.53,.37,1.15],[side*1.94,.60,.30],[side*2.50,1.10,-1.23]],.32,dragonHeadArmorMat,24,10,.10);
            for(let row=0;row<8;row++)for(let col=0;col<5;col++){
              const a=.32+col*.29,x=side*(1.28+Math.sin(a)*.40),y=.52+Math.cos(a)*.53-row*.035,z=.58-row*.28+col*.04;
              dragonPlate(dragonHeadGroup,x,y,z,.30,.49,.13,side*(-Math.PI/2+.12));
            }
            for(let k=0;k<6;k++){
              const root=[side*(1.45+k*.11),.36-k*.13,.10-k*.28];
              dragonTube(dragonHeadGroup,[root,[side*(2.35+k*.13),.65-k*.14,-1.16-k*.28],
                [side*(2.80+k*.13),1.02-k*.12,-2.13-k*.34]],.23-k*.02,dragonHornMat,20,9,.15);
            }
          }
          const palate=new THREE.Mesh(new THREE.SphereGeometry(1,28,18),darkMouthMat);palate.scale.set(.91,.115,1.94);palate.position.set(0,.055,2.97);dragonHeadGroup.add(palate);
          const lowerJawGroup=new THREE.Group();lowerJawGroup.position.set(0,-.38,.52);lowerJawGroup.rotation.x=.46;
          dragonHeadGroup.add(lowerJawGroup);dragonHeadGroup.userData.lowerJaw=lowerJawGroup;
          const jaw=new THREE.Mesh(createDragonLoft([[0,1.12,.13,.44],[1.15,1.10,.11,.40],[2.75,.85,.08,.31],
            [4.2,.70,.08,.25],[4.56,.47,.07,.16]],36,28),dragonSkinMat);jaw.position.y=-.15;lowerJawGroup.add(jaw);
          const floor=new THREE.Mesh(new THREE.SphereGeometry(1,28,18),darkMouthMat);floor.scale.set(.80,.085,1.78);floor.position.set(0,-.02,2.31);lowerJawGroup.add(floor);
          for(const side of [-1,1]){
            dragonTube(lowerJawGroup,[[side*1.04,-.04,.48],[side*.94,-.04,2.2],[side*.60,-.025,4.32]],.075,dragonHeadArmorMat,24,8);
            for(let k=0;k<11;k++){
              const z=1.18+k*.345,x=THREE.MathUtils.lerp(1.16,.75,k/10),length=k===8?1.08:k===4?.78:.38+(k%3)*.07;
              dragonTube(dragonHeadGroup,[[side*x,.10,z],[side*(x-.02),.10-length*.58,z+.03],
                [side*(x-.075),.10-length,z-.14]],k===8?.17:.085,dragonToothMat,14,8);
              const lz=.72+k*.345,lx=THREE.MathUtils.lerp(1.02,.62,k/10),len=k===9?.90:.34+(k%3)*.055;
              dragonTube(lowerJawGroup,[[side*lx,-.03,lz],[side*(lx-.02),len*.6,lz+.02],
                [side*(lx-.07),len,lz-.12]],k===9?.15:.075,dragonToothMat,14,8);
            }
            for(let k=0;k<8;k++)dragonPlate(lowerJawGroup,side*(.80-k*.024),-.32,1.05+k*.39,.29,.48,.12,side*2.0);
          }
          for(let k=0;k<6;k++){
            const x=(k-2.5)*.22;
            dragonTube(dragonHeadGroup,[[x,.13,4.91],[x*.98,-.17,4.97],[x*.95,-.38,4.91]],.065,dragonToothMat,10,7);
            dragonTube(lowerJawGroup,[[x*.82,-.03,4.35],[x*.82,.19,4.40],[x*.76,.33,4.35]],.055,dragonToothMat,10,7);
          }
          // Swept, fluted antlers form a jagged crown with real branch junctions.
          for(const side of [-1,1]){
            dragonTube(dragonHeadGroup,[[side*1.04,1.35,-.20],[side*1.42,2.45,-.83],
              [side*1.94,4.2,-1.63],[side*2.30,5.86,-2.54],[side*2.55,7.02,-3.32]],.50,dragonHornMat,isMobile?34:48,14,.16);
            for(let k=0;k<6;k++){
              const y=2.0+k*.68,x=1.31+k*.17,z=-.57-k*.34,flip=k%2?-1:1;
              dragonTube(dragonHeadGroup,[[side*x,y,z],[side*(x+flip*.28),y+.82,z-.33],
                [side*(x+flip*(1.03+k*.025)),y+1.65-(k%2)*.17,z-.92-(k%3)*.17]],.205-k*.014,dragonHornMat,22,10,.22);
            }
            dragonTube(dragonHeadGroup,[[side*1.30,1.53,-.12],[side*1.70,2.85,-.96],
              [side*2.16,4.48,-1.92],[side*2.45,6.10,-2.72]],.014,dragonHeadArmorMat,34,5);
            dragonTube(dragonHeadGroup,[[side*.47,1.39,.52],[side*.65,2.6,.05],[side*.91,3.91,-.81],
              [side*1.18,4.86,-1.40]],.28,dragonHeadArmorMat,30,12,.13);
            for(let k=0;k<4;k++)dragonPlate(dragonHeadGroup,side*(1.0+k*.08),1.42+k*.17,-.28-k*.19,.42,.58,-.22,side*-.22);
          }
          for(let k=0;k<4;k++)dragonTube(dragonHeadGroup,[[0,1.42,1.1-k*.52],[0,2.03-k*.09,.77-k*.55],
            [0,2.80-k*.17,.28-k*.68]],.19-k*.023,dragonHornMat,18,10,.13);
          // A dense halo of individually swept locks; each has a distinct tip.
          const lockBasis=new THREE.Matrix4(),out=new THREE.Vector3(),across=new THREE.Vector3();
          for(let layer=0;layer<4;layer++)for(let k=0;k<(isMobile?24:36);k++){
            const count=isMobile?24:36,a=k/count*Math.PI*2+layer*.19,r=1.26+layer*.16;
            const lock=new THREE.Mesh(dragonLockGeo,dragonManeMat);
            out.set(Math.sin(a),Math.cos(a),0);across.set(Math.cos(a),-Math.sin(a),0);
            lockBasis.makeBasis(across,out,new THREE.Vector3(0,0,1));lock.quaternion.setFromRotationMatrix(lockBasis);
            lock.position.set(out.x*r,.48+out.y*r,-.70-layer*.46);
            const length=3.0+thunderNoise(k*7.1+layer*23)*3.8;
            lock.scale.set(.32+thunderNoise(k+layer*61)*.35,length,length*1.05);dragonHeadGroup.add(lock);
            if(k%3===0)dragonTube(dragonHeadGroup,[[out.x*r,.48+out.y*r,-.8-layer*.4],
              [out.x*(r+length*.35),.48+out.y*(r+length*.35),-1.5-layer*.4],
              [out.x*(r+length*.66),.48+out.y*(r+length*.66),-3.8-layer*.5]],.021,carvedGoldMat,14,5);
          }
          for(let k=0;k<(isMobile?28:48);k++){
            const x=(k/((isMobile?28:48)-1)-.5)*1.55,len=1.6+thunderNoise(k*9.2)*1.6;
            dragonTube(lowerJawGroup,[[x,-.40,3.75-Math.abs(x)*.32],[x*1.1,-1.1,3.0],
              [x*1.35,-len,1.72]],.024,carvedGoldMat,16,5);
          }
        }
        buildDragonHead();
        batchStaticModel(dragonHeadGroup.userData.lowerJaw);
        batchStaticModel(dragonHeadGroup,[dragonHeadGroup.userData.lowerJaw]);

        // 两条飘逸长龙须（动态顶点随风摆动）
        const WHISKER_PTS = isMobile ? 36 : 56;
        const whiskerCurves = [-1, 1].map(() => {
          const geo = new THREE.BufferGeometry();
          geo.setAttribute('position', new THREE.BufferAttribute(new Float32Array(WHISKER_PTS * 3), 3));
          const line = new THREE.Line(
            geo,
            new THREE.LineBasicMaterial({ color: '#ffe680', transparent: true, opacity: 0.9 })
          );
          line.frustumCulled = false;
          thunderDragonGroup.add(line);
          return geo;
        });


        // Muscular forearms, scaled knuckles and three long hooked talons.
        function createDragonLimb(side,hind=false){
          const limb=new THREE.Group();limb.name=hind?'后肢·钩爪':'前肢·钩爪';
          const shoulder=new THREE.Vector3(side*1.28,-.22,-.10),elbow=new THREE.Vector3(side*2.66,-1.37,-.63),
            wrist=new THREE.Vector3(side*3.18,-3.01,1.10);
          dragonTube(limb,[shoulder,[side*2.20,-.75,-.36],elbow],hind?.65:.55,dragonSkinMat,24,12);
          dragonTube(limb,[elbow,[side*2.85,-2.36,.30],wrist],.40,dragonSkinMat,24,12);
          const joint=new THREE.Mesh(new THREE.SphereGeometry(1,24,16),dragonSkinMat);joint.position.copy(elbow);joint.scale.set(.58,.59,.61);limb.add(joint);
          const palm=new THREE.Mesh(new THREE.SphereGeometry(1,28,18),dragonSkinMat);palm.position.copy(wrist);palm.scale.set(.66,.36,.75);limb.add(palm);
          for(let bone=0;bone<2;bone++)for(let row=0;row<11;row++){
            const t=row/10,a=bone?elbow:shoulder,b=bone?wrist:elbow,p=new THREE.Vector3().lerpVectors(a,b,t);
            for(let col=-1;col<=1;col++)dragonPlate(limb,p.x+col*.25,p.y+.04,p.z+.35,.34,.45,Math.PI/2-.28,side*-.22);
          }
          for(let k=0;k<4;k++)dragonTube(limb,[[elbow.x+side*.20,elbow.y+.40-k*.23,elbow.z-.14],
            [elbow.x+side*.66,elbow.y+.32-k*.23,elbow.z-.70],
            [elbow.x+side*(1.0+k*.12),elbow.y+.62-k*.25,elbow.z-1.20-k*.16]],.18-k*.017,dragonHornMat,18,9,.12);
          for(let toe=0;toe<4;toe++){
            const thumb=toe===3,spread=thumb?side*.91:(toe-1)*.49;
            const root=wrist.clone().add(new THREE.Vector3(thumb?side*.47:(toe-1)*.31,-.04,.26));
            const knuckle=root.clone().add(new THREE.Vector3(spread*.64,-.25,thumb?.25:.82));
            const tip=root.clone().add(new THREE.Vector3(spread,-.50,thumb?.60:1.52-Math.abs(toe-1)*.14));
            dragonTube(limb,[root,knuckle,tip],thumb?.15:.19,dragonSkinMat,18,9);
            for(let row=0;row<5;row++){
              const p=new THREE.Vector3().lerpVectors(root,tip,row/5);
              dragonPlate(limb,p.x,p.y+.15,p.z,.23,.30,.10,0,dragonHeadArmorMat);
            }
            const length=thumb?.86:1.25+(toe===1?.15:0);
            dragonTube(limb,[tip,tip.clone().add(new THREE.Vector3(spread*.10,-.30,length*.47)),
              tip.clone().add(new THREE.Vector3(-spread*.10,-length*.79,length*.73))],thumb?.14:.19,dragonToothMat,22,10,.035);
            dragonTube(limb,[root.clone().add(new THREE.Vector3(0,.15,0)),knuckle.clone().add(new THREE.Vector3(0,.15,0)),
              tip.clone().add(new THREE.Vector3(0,.09,-.09))],.024,dragonHeadArmorMat,16,5);
          }
          return batchStaticModel(limb);
        }

        const dragonLimbs = [
          { group: createDragonLimb(-1), spineIdx: Math.round((DRAGON_SPINE_NODES - 1) * 0.14), side: -1 },
          { group: createDragonLimb(1), spineIdx: Math.round((DRAGON_SPINE_NODES - 1) * 0.14), side: 1 },
          { group: createDragonLimb(-1,true), spineIdx: Math.round((DRAGON_SPINE_NODES - 1) * 0.56), side: -1 },
          { group: createDragonLimb(1,true), spineIdx: Math.round((DRAGON_SPINE_NODES - 1) * 0.56), side: 1 },
        ];
        dragonLimbs.forEach((l) => thunderDragonGroup.add(l.group));

        // 雷龙周身舒展金白闪电弧（精简龙头电弧并放缓律动，突显威严龙头细节）
        const DRAGON_BOLT_SEGMENTS = 160;
        const dragonBoltGeo = new THREE.BufferGeometry();
        const dragonBoltPositions = new Float32Array(DRAGON_BOLT_SEGMENTS * 6);
        const dragonBoltColors = new Float32Array(DRAGON_BOLT_SEGMENTS * 6);
        for (let i = 0; i < DRAGON_BOLT_SEGMENTS; i++) {
          const isWhiteCore = i % 3 === 0;
          dragonBoltColors[i * 6] = 1.0;
          dragonBoltColors[i * 6 + 1] = isWhiteCore ? 0.99 : 0.92;
          dragonBoltColors[i * 6 + 2] = isWhiteCore ? 0.92 : 0.45;
          dragonBoltColors[i * 6 + 3] = 1.0;
          dragonBoltColors[i * 6 + 4] = 0.78;
          dragonBoltColors[i * 6 + 5] = 0.15;
        }
        dragonBoltGeo.setAttribute('position', new THREE.BufferAttribute(dragonBoltPositions, 3));
        dragonBoltGeo.setAttribute('color', new THREE.BufferAttribute(dragonBoltColors, 3));
        const dragonBoltLines = new THREE.LineSegments(
          dragonBoltGeo,
          new THREE.LineBasicMaterial({
            vertexColors: true,
            transparent: true,
            opacity: 0.92,
            blending: THREE.AdditiveBlending,
          })
        );
        dragonBoltLines.frustumCulled = false;
        thunderDragonGroup.add(dragonBoltLines);

        // 雷龙周身飘散的金色雷火粒子
        const DRAGON_SPARK_COUNT = 380;
        const dragonSparkGeo = new THREE.BufferGeometry();
        const dragonSparkPositions = new Float32Array(DRAGON_SPARK_COUNT * 3);
        const dragonSparkOffsets = Array.from({ length: DRAGON_SPARK_COUNT }, () => ({
          spineT: Math.random(),
          ang: Math.random() * Math.PI * 2,
          rad: 1.6 + Math.random() * 5.2,
          speed: 0.35 + Math.random() * 0.75,
          phase: Math.random() * Math.PI * 2,
        }));
        dragonSparkGeo.setAttribute('position', new THREE.BufferAttribute(dragonSparkPositions, 3));
        const dragonSparkPoints = new THREE.Points(
          dragonSparkGeo,
          new THREE.PointsMaterial({
            size: 0.55,
            color: '#ffeb85',
            transparent: true,
            opacity: 0.88,
            blending: THREE.AdditiveBlending,
          })
        );
        dragonSparkPoints.frustumCulled = false;
        thunderDragonGroup.add(dragonSparkPoints);

        const dragonFilamentUniforms=makeFXUniforms(new THREE.Vector3(1.08,1.02,.92));
        const dragonArcs=makeArcBatch('辟邪神雷·全身游雷与分叉电冠',isMobile?6500:11000,dragonFilamentUniforms,thunderDragonGroup);
        const dragonFilamentGeo=dragonArcs.geometry,dragonFilamentMesh=dragonArcs.mesh;
        dragonBoltLines.visible=false;
        const moteCanvas=document.createElement('canvas');moteCanvas.width=moteCanvas.height=48;
        const moteCtx=moteCanvas.getContext('2d'),moteGradient=moteCtx.createRadialGradient(24,24,0,24,24,24);
        moteGradient.addColorStop(0,'rgba(255,255,255,1)');moteGradient.addColorStop(.15,'rgba(255,255,255,.95)');
        moteGradient.addColorStop(.42,'rgba(255,255,255,.3)');moteGradient.addColorStop(1,'rgba(255,255,255,0)');
        moteCtx.fillStyle=moteGradient;moteCtx.fillRect(0,0,48,48);
        dragonSparkPoints.material.map=new THREE.CanvasTexture(moteCanvas);dragonSparkPoints.material.depthWrite=false;
        dragonSparkPoints.material.size=.36;

        const dragonArcPoints=Array.from({length:113},()=>new THREE.Vector3());
        const arcCenter=new THREE.Vector3(),arcB=new THREE.Vector3(),arcN=new THREE.Vector3();
        function pointOnDragon(t,angle,radiusMultiplier,out,clearance=0){
          const sample=THREE.MathUtils.clamp(t,0,1)*(DRAGON_SPINE_NODES-1),i=Math.min(DRAGON_SPINE_NODES-2,Math.floor(sample)),f=sample-i;
          arcCenter.lerpVectors(dragonSpine[i],dragonSpine[i+1],f);
          arcB.lerpVectors(dragonSpineBinormals[i],dragonSpineBinormals[i+1],f).normalize();
          arcN.lerpVectors(dragonSpineNormals[i],dragonSpineNormals[i+1],f).normalize();
          const r=(getDragonRadiusAt(t)*radiusMultiplier+clearance)*dragonOpacity;
          return out.copy(arcCenter).addScaledVector(arcB,Math.cos(angle)*r).addScaledVector(arcN,Math.sin(angle)*r);
        }
        function updateDragonFilaments(time,opacity){
          const density=electricDensity();updateFXUniforms(dragonFilamentUniforms,time,opacity*1.22);dragonArcs.begin();
          if(density>0){
            const activity=Math.min(1,density),surfaceCount=Math.ceil((isMobile?3:5)+density*2),outerCount=Math.ceil(2+density*1.5);
            // Fine lightning follows the scale surface over the complete body.
            for(let k=0;k<surfaceCount;k++){
              for(let j=0;j<113;j++){
                const t=j/112,a=k*2.399+t*(19+k%3*3)-time*(.30+k*.047)*(k%2?1:-1)
                  +Math.sin(j*2.7+k*5+time*5)*.17;
                pointOnDragon(t,a,1.11,dragonArcPoints[j],.045+Math.sin(j*3.1+k+time*4)*.035);
              }
              dragonArcs.add(dragonArcPoints,(2.8+k%3*.65)*activity,k*.73+3,113);
            }
            // Larger jagged helices wrap around both sides, including the tail.
            for(let k=0;k<outerCount;k++){
              for(let j=0;j<97;j++){
                const t=j/96,a=k*2.399+t*22+Math.sin(t*53+k*3+time*2)*.26-time*(k%2?-.37:.31);
                pointOnDragon(t,a,1.30,dragonArcPoints[j],.50+Math.abs(Math.sin(t*39+k+time))*1.05);
              }
              dragonArcs.add(dragonArcPoints,(4.9+density*.48+k%2*.9)*activity,k*.91+17,97);
            }
            const bins=isMobile?18:28,discharges=Math.ceil(bins*(.65+density*.37));
            for(let k=0;k<discharges;k++){
              // Stratification guarantees coverage rather than random empty gaps.
              const t=.005+(k+.35)/discharges*.987,angle=k*2.399+time*.26;
              const root=pointOnDragon(t,angle,1.15,new THREE.Vector3(),.18);
              const node=Math.min(DRAGON_SPINE_NODES-1,Math.floor(t*(DRAGON_SPINE_NODES-1)));
              const radial=arcB.clone().multiplyScalar(Math.cos(angle)).addScaledVector(arcN,Math.sin(angle));
              const reach=(1.5+density*.55+thunderNoise(k*7.7+5)*3.6)*opacity;
              const end=root.clone().addScaledVector(radial,reach).addScaledVector(dragonSpineTangents[node],(thunderNoise(k+13)-.5)*reach*2.0);
              const path=flowingThunderPath(root,end,k*5.31,time*1.4,.22,4);
              dragonArcs.add(path,(4.8+density*.8+k%3*.6)*activity,k*.47+31);
              for(let fork=0;fork<2;fork++){
                const anchor=new THREE.Vector3(...path[5+fork*4]);
                const tip=anchor.clone().addScaledVector(radial,reach*(.22+fork*.11))
                  .addScaledVector(dragonSpineTangents[node],(fork?1:-1)*reach*.48);
                dragonArcs.add(flowingThunderPath(anchor,tip,k+fork*17,time*1.3,.25,3),(2.8+density*.40)*activity,k*.51+fork+69);
              }
            }
            // Crown arcs begin at the horns and stay behind the eye and muzzle.
            for(let k=0;k<6;k++){
              const side=k%2?-1:1,root=new THREE.Vector3(side*(1.5+(k%3)*.36),3.1+(k%3)*1.45,-1.15-(k%3)*.52).applyMatrix4(dragonHeadGroup.matrixWorld);
              const tip=root.clone().addScaledVector(dragonSpineBinormals[0],side*(2.0+density*.62))
                .addScaledVector(dragonSpineNormals[0],1.0+k%3*.65).addScaledVector(dragonSpineTangents[0],-2.4-k%3*.4);
              dragonArcs.add(flowingThunderPath(root,tip,k*3.1,time,.18,4),(4.2+density*.6)*activity,k*.68+113);
            }
            // Electricity coils round every wrist, then forks from the talons.
            dragonLimbs.forEach((limb,index)=>{
              limb.group.updateMatrixWorld(true);
              for(let k=0;k<3;k++){
                for(let j=0;j<17;j++){
                  const t=j/16,a=t*Math.PI*3+k*2.1+time*1.5;
                  dragonArcPoints[j].set(limb.side*(2.55+t*.70)+Math.cos(a)*.58,-1.4-t*1.7+Math.sin(a)*.42,-.40+t*1.75).applyMatrix4(limb.group.matrixWorld);
                }
                dragonArcs.add(dragonArcPoints,3.9*activity,149+index*7+k,17);
              }
              for(let k=0;k<3;k++){
                const root=new THREE.Vector3(limb.side*3.18+(k-1)*.61,-3.8,3.10).applyMatrix4(limb.group.matrixWorld);
                const tip=root.clone().addScaledVector(dragonSpineTangents[limb.spineIdx],1.5+density*.6)
                  .addScaledVector(dragonSpineBinormals[limb.spineIdx],(k-1)*1.1);
                dragonArcs.add(flowingThunderPath(root,tip,173+index*13+k,time,.21,3),3.6*activity,173+index*13+k);
              }
            });
            for(let k=0;k<8;k++){
              const t=.91+(k%4)*.028,a=k*2.399+time*.7,root=pointOnDragon(t,a,1.2,new THREE.Vector3(),.3);
              const tip=root.clone().addScaledVector(dragonSpineTangents[DRAGON_SPINE_NODES-2],-3.8-(k%3)*.7)
                .addScaledVector(arcB,Math.cos(a)*2.6).addScaledVector(arcN,Math.sin(a)*2.6);
              dragonArcs.add(flowingThunderPath(root,tip,229+k,time,.20,4),3.8*activity,229+k);
            }
          }
          dragonArcs.end();dragonSparkGeo.setDrawRange(0,Math.round(DRAGON_SPARK_COUNT*Math.min(1,density/1.8)));
          dragonSparkPoints.material.opacity=opacity*Math.min(.92,density*.5);
        }

        // Hold right mouse to aim the head and discharge an actual stream of
        // branching thunder from the mouth; release, blur, or leave dragon mode
        // to stop. All three attack layers obey the master lightning switch.
        const dragonBreathGroup=new THREE.Group();dragonBreathGroup.name='龙息攻击';dragonBreathGroup.visible=false;
        thunderDragonGroup.add(dragonBreathGroup);
        const breathUniforms=makeFXUniforms(new THREE.Vector3(1.18,1.12,1.04));
        const breathArcs=makeArcBatch('龙息·万钧雷霆洪流',isMobile?1600:2600,breathUniforms,dragonBreathGroup);
        const muzzleGlow=new THREE.Mesh(new THREE.PlaneGeometry(1,1),radialGlowMaterial('#fff1ae'));dragonBreathGroup.add(muzzleGlow);
        const impactGlow=new THREE.Mesh(new THREE.PlaneGeometry(1,1),radialGlowMaterial('#ffdb7d'));dragonBreathGroup.add(impactGlow);
        const aimRay=new THREE.Vector3(),aimPoint=new THREE.Vector3(),muzzle=new THREE.Vector3(),attackDirection=new THREE.Vector3(),attackB=new THREE.Vector3(),attackN=new THREE.Vector3();
        const attackMatrix=new THREE.Matrix4(),attackQuaternion=new THREE.Quaternion();
        let dragonBreathPower=0;
        const dragonBreathAnchor=new THREE.Vector3();
        function beginDragonBreath(){
          if(STATE.gestureMode!=='THUNDER_DRAGON'||!STATE.lightningEnabled)return;
          if(!STATE.breathHeld)dragonBreathAnchor.copy(STATE.targetPosition);
          STATE.breathHeld=true;
        }
        function getDragonAimPoint(){
          aimRay.set(STATE.pointerNDC.x,STATE.pointerNDC.y,.5).unproject(camera).sub(camera.position).normalize();
          const denominator=aimRay.dot(viewPlaneNormal);
          const distance=Math.abs(denominator)>.00001
            ? (viewLocalAim.copy(STATE.flight.offset).add(viewOrigin).sub(camera.position).dot(viewPlaneNormal)-145)/denominator : 180;
          return aimPoint.copy(camera.position).addScaledVector(aimRay,Math.max(40,distance));
        }
        function aimDragonHead(dtRatio){
          if(!STATE.breathHeld||!STATE.lightningEnabled||STATE.gestureMode!=='THUNDER_DRAGON')return;
          attackDirection.copy(getDragonAimPoint()).sub(dragonHeadGroup.position).normalize();
          attackB.crossVectors(dragonSpineNormals[0],attackDirection).normalize();
          if(attackB.lengthSq()<.1)attackB.set(1,0,0);
          attackN.crossVectors(attackDirection,attackB).normalize();
          attackMatrix.makeBasis(attackB,attackN,attackDirection);attackQuaternion.setFromRotationMatrix(attackMatrix);
          dragonHeadGroup.quaternion.slerp(attackQuaternion,1-Math.pow(.12,dtRatio));
        }
        function breathLightningPath(start,end,seed,time,roughness=.045){
          // 分形中点偏移形成有棱角的雷击折线，短促重击换形，不绕轴旋转。
          const tick=time*13+thunderNoise(seed+7)*11,epoch=Math.floor(tick);
          const blend=smoothstep(0,.22,tick-epoch);
          const before=thunderPath(start,end,seed+(epoch-1)*37.31,roughness,5);
          const after=thunderPath(start,end,seed+epoch*37.31,roughness,5);
          for(let j=0;j<after.length;j++)for(let axis=0;axis<3;axis++){
            after[j][axis]=THREE.MathUtils.lerp(before[j][axis],after[j][axis],blend);
          }
          return after;
        }
        function updateDragonBreath(time,delta,isDragon){
          if(!isDragon||!STATE.lightningEnabled)STATE.breathHeld=false;
          const density=electricDensity(),wanted=isDragon&&STATE.breathHeld&&density>0;
          dragonBreathPower=THREE.MathUtils.lerp(dragonBreathPower,wanted?1:0,1-Math.pow(wanted?.65:.48,delta*60));
          dragonBreathGroup.visible=isDragon&&density>0&&dragonBreathPower>.015;
          const button=document.getElementById('dragon-breath-btn');button.classList.toggle('firing',!!wanted);
          breathArcs.begin();updateFXUniforms(breathUniforms,time,dragonBreathPower*(1.35+Math.min(3,density)*.19));
          if(!dragonBreathGroup.visible||density<=0){breathArcs.end();return;}
          dragonHeadGroup.updateMatrixWorld(true);muzzle.set(0,-.20,5.05).applyMatrix4(dragonHeadGroup.matrixWorld);
          attackDirection.copy(getDragonAimPoint()).sub(muzzle).normalize();
          const length=(92+Math.min(4,density)*13)*smoothstep(0,.60,dragonBreathPower);
          attackB.crossVectors(attackDirection,new THREE.Vector3(0,1,0)).normalize();if(attackB.lengthSq()<.1)attackB.set(1,0,0);
          attackN.crossVectors(attackB,attackDirection).normalize();
          const end=muzzle.clone().addScaledVector(attackDirection,length);
          // 多道同等醒目的粗主雷从龙口齐发，向前张开成宽阔雷潮。
          // 每股雷保持独立的锯齿与落点；横向布局不随时间绕轴旋转。
          const beamCount=Math.min(isMobile?10:14,4+Math.ceil(density*2.5));
          const fanRadius=(5.5+density*2.3)*dragonBreathPower;
          const mainPaths=[],beamEnds=[];
          for(let k=0;k<beamCount;k++){
            const angle=k*2.3999632297+.31;
            const radius=k===0?0:fanRadius*Math.sqrt(k/(beamCount-1));
            const tip=end.clone().addScaledVector(attackB,Math.cos(angle)*radius)
              .addScaledVector(attackN,Math.sin(angle)*radius*.82)
              .addScaledVector(attackDirection,k===0?0:(thunderNoise(k+57)-.5)*length*.12);
            const seed=91+k*19.7;
            const path=breathLightningPath(muzzle,tip,seed,time,.032+thunderNoise(k+13)*.027+density*.004);
            const width=(k===0?22:14+thunderNoise(k+31)*7)*(.90+Math.min(4,density)*.08);
            mainPaths.push(path);beamEnds.push(tip);
            breathArcs.add(path,width,seed);
          }
          // 长支流从各股主雷中段劈出，填满雷潮的外缘。
          for(let k=0;k<Math.ceil(beamCount*.60);k++){
            const lane=k%beamCount,seed=719+k*29.3,index=9+(k*5)%11;
            const root=new THREE.Vector3(...mainPaths[lane][index]);
            const angle=k*2.3999632297+.9;
            const tip=beamEnds[lane].clone().addScaledVector(attackB,Math.cos(angle)*fanRadius*.55)
              .addScaledVector(attackN,Math.sin(angle)*fanRadius*.55);
            breathArcs.add(breathLightningPath(root,tip,seed,time,.052),6.5+thunderNoise(seed)*3,seed);
          }
          // 密集短叉分别扎根各道主雷，分批爆闪并向外炸开。
          const forks=beamCount*2+Math.ceil(density*(isMobile?7:10));
          for(let k=0;k<forks;k++){
            const tick=time*(7+thunderNoise(k+71)*3)+thunderNoise(k+17)*23;
            const epoch=Math.floor(tick),life=tick-epoch;
            if(life>.78)continue;
            const seed=211+k*23.17+epoch*17.3;
            const lane=k%beamCount;
            const index=4+Math.floor(thunderNoise(k*13.17+epoch*.37+17)*25);
            const root=new THREE.Vector3(...mainPaths[lane][index]);
            const angle=thunderNoise(seed+13)*Math.PI*2;
            const reach=(6+density*1.6+thunderNoise(seed+23)*10)*(.65+index/32*.35);
            const side=attackB.clone().multiplyScalar(Math.cos(angle)).addScaledVector(attackN,Math.sin(angle));
            const tip=root.clone().addScaledVector(attackDirection,reach*(.35+thunderNoise(seed+37)*.5))
              .addScaledVector(side,reach);
            const branch=thunderPath(root,tip,seed,.14,isMobile?3:4);
            const flash=smoothstep(0,.07,life)*(1-smoothstep(.40,.78,life));
            breathArcs.add(branch,(3.8+thunderNoise(seed+41)*2.5)*flash,seed);
            if(k%3===0&&density>1.2){
              const splitRoot=new THREE.Vector3(...branch[Math.floor(branch.length*.56)]);
              const splitTip=splitRoot.clone().addScaledVector(attackDirection,reach*.30)
                .addScaledVector(side,reach*.35).addScaledVector(attackN,(thunderNoise(seed+59)-.5)*reach*.8);
              breathArcs.add(thunderPath(splitRoot,splitTip,seed+61,.17,3),2.6*flash,seed+61);
            }
          }
          const impactEpoch=Math.floor(time*11);
          for(let k=0;k<beamCount+Math.ceil(density*4);k++){
            const seed=397+k*31.7+impactEpoch*19.1,angle=thunderNoise(seed)*Math.PI*2;
            const root=beamEnds[k%beamCount];
            const reach=4.5+thunderNoise(seed+7)*(5+density*2);
            const tip=root.clone().addScaledVector(attackB,Math.cos(angle)*reach)
              .addScaledVector(attackN,Math.sin(angle)*reach)
              .addScaledVector(attackDirection,(thunderNoise(seed+29)-.35)*reach);
            breathArcs.add(thunderPath(root,tip,seed,.18,3),4+thunderNoise(seed+43)*2,seed);
          }
          const impactFlash=Math.pow(.5+.5*Math.sin(time*31),8);
          breathArcs.end();muzzleGlow.position.copy(muzzle);muzzleGlow.quaternion.copy(camera.quaternion);muzzleGlow.scale.setScalar(10+dragonBreathPower*(4+density*.6));
          muzzleGlow.material.uniforms.uOpacity.value=dragonBreathPower;
          impactGlow.position.copy(end);impactGlow.quaternion.copy(camera.quaternion);impactGlow.scale.setScalar((18+density*4.5)*(1+impactFlash*.10));
          impactGlow.material.uniforms.uOpacity.value=dragonBreathPower*(.85+impactFlash*.30);
          if(dragonHeadGroup.userData.lowerJaw)dragonHeadGroup.userData.lowerJaw.rotation.x+=dragonBreathPower*.24;
        }


        // Genuine overlapping scale plates, belly lamellae and dorsal spines.
        // Instancing retains individual 3D relief with only three draw calls.
        const ARMOR_ROWS=isMobile?128:208,ARMOR_COLS=isMobile?18:24;
        const armorSlots=[];
        for(let row=0;row<ARMOR_ROWS;row++)for(let col=0;col<ARMOR_COLS;col++){
          const theta=(col+(row%2)*.5)/ARMOR_COLS*Math.PI*2;
          if(Math.cos(theta)>.73)continue; // Continuous belly plates below.
          armorSlots.push({row,theta});
        }
        const armorFrames=Array.from({length:ARMOR_ROWS},(_,row)=>({
          t:.018+(row/(ARMOR_ROWS-1))*.969,
          center:new THREE.Vector3(),N:new THREE.Vector3(),B:new THREE.Vector3(),T:new THREE.Vector3(),radius:1,spacing:1,
        }));
        const dragonScaleInstances=new THREE.InstancedMesh(armorScaleGeo,carvedGoldMat,armorSlots.length);
        dragonScaleInstances.name='层叠立体龙鳞';dragonScaleInstances.frustumCulled=false;
        dragonScaleInstances.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
        const tint=new THREE.Color();
        armorSlots.forEach((slot,index)=>{
          tint.setHSL(.092+craftRandom()*.018,.55+craftRandom()*.17,.44+craftRandom()*.16);
          dragonScaleInstances.setColorAt(index,tint);
        });
        thunderDragonGroup.add(dragonScaleInstances);


        const bellyGeo=new THREE.PlaneGeometry(1,1,isMobile?16:24,8);bellyGeo.rotateX(-Math.PI/2);
        const bp=bellyGeo.attributes.position;
        for(let k=0;k<bp.count;k++){
          const u=bp.getX(k)*2,v=bp.getZ(k)*2,a=u*1.10;
          const bevel=Math.pow(Math.abs(v),10)*.025;
          bp.setXYZ(k,Math.sin(a)*.575,(Math.cos(a)-1)*.55+.035-bevel,
            v*.50+(1-Math.abs(u))*.105);
        }
        bellyGeo.computeVertexNormals();

        const bellyMat=new THREE.MeshPhysicalMaterial({color:'#c99438',roughness:.38,metalness:.69,
          envMapIntensity:.85,emissive:'#d59026',emissiveIntensity:.06,side:THREE.DoubleSide});
        const bellyCount=Math.round(ARMOR_ROWS*.82);
        const dragonBellyInstances=new THREE.InstancedMesh(bellyGeo,bellyMat,bellyCount);
        dragonBellyInstances.name='分节腹甲';dragonBellyInstances.frustumCulled=false;
        dragonBellyInstances.instanceMatrix.setUsage(THREE.DynamicDrawUsage);thunderDragonGroup.add(dragonBellyInstances);

        const spineCount=Math.floor(ARMOR_ROWS/3),tailSpineCount=36;
        const dorsalGeo=createSculptedHornSegment(.012,.20,1,0,-.62);
        const dragonDorsalInstances=new THREE.InstancedMesh(dorsalGeo,dragonHornMat,spineCount+tailSpineCount);
        dragonDorsalInstances.name='龙脊骨棘与尾冠';dragonDorsalInstances.frustumCulled=false;
        dragonDorsalInstances.instanceMatrix.setUsage(THREE.DynamicDrawUsage);thunderDragonGroup.add(dragonDorsalInstances);

        const armorDummy=new THREE.Object3D(),armorBasis=new THREE.Matrix4();
        const radialNormal=new THREE.Vector3(),across=new THREE.Vector3(),negativeT=new THREE.Vector3();
        function updateDragonArmor(time) {
          for(const frame of armorFrames){
            const sample=frame.t*(DRAGON_SPINE_NODES-1),i=Math.min(DRAGON_SPINE_NODES-2,Math.floor(sample)),f=sample-i;
            frame.center.lerpVectors(dragonSpine[i],dragonSpine[i+1],f);
            frame.T.lerpVectors(dragonSpineTangents[i],dragonSpineTangents[i+1],f).normalize();
            frame.B.lerpVectors(dragonSpineBinormals[i],dragonSpineBinormals[i+1],f).projectOnPlane(frame.T).normalize();
            frame.N.crossVectors(frame.T,frame.B).normalize();
            frame.radius=getDragonRadiusAt(frame.t)*dragonOpacity;
            frame.spacing=Math.max(.14,Math.min(1.75,dragonSpine[i].distanceTo(dragonSpine[i+1])*(DRAGON_SPINE_NODES-1)/ARMOR_ROWS));
          }
          for(let index=0;index<armorSlots.length;index++){
            const {row,theta}=armorSlots[index],frame=armorFrames[row],sn=Math.sin(theta),cs=Math.cos(theta),r=frame.radius;
            radialNormal.copy(frame.B).multiplyScalar(sn).addScaledVector(frame.N,-cs).normalize();
            across.copy(frame.B).multiplyScalar(cs).addScaledVector(frame.N,sn).normalize();
            negativeT.copy(frame.T).negate();
            armorBasis.makeBasis(across,radialNormal,negativeT);
            armorDummy.quaternion.setFromRotationMatrix(armorBasis);
            armorDummy.position.copy(frame.center).addScaledVector(frame.B,sn*r*1.045)
              .addScaledVector(frame.N,-cs*r*(cs>0?.84:1.085));
            armorDummy.scale.set(Math.max(.025,2*Math.PI*r/ARMOR_COLS*1.20),Math.max(.02,r*.35),frame.spacing*1.42*dragonOpacity);
            armorDummy.updateMatrix();dragonScaleInstances.setMatrixAt(index,armorDummy.matrix);
          }
          for(let k=0;k<bellyCount;k++){
            const frame=armorFrames[Math.round(k/(bellyCount-1)*(ARMOR_ROWS-1))],r=frame.radius;
            radialNormal.copy(frame.N).negate();negativeT.copy(frame.T).negate();
            armorBasis.makeBasis(frame.B,radialNormal,negativeT);armorDummy.quaternion.setFromRotationMatrix(armorBasis);
            armorDummy.position.copy(frame.center).addScaledVector(frame.N,-r*.875);
            armorDummy.scale.set(r*1.58,r*1.40,frame.spacing*1.04*ARMOR_ROWS/bellyCount*dragonOpacity);
            armorDummy.updateMatrix();dragonBellyInstances.setMatrixAt(k,armorDummy.matrix);
          }
          for(let k=0;k<spineCount+tailSpineCount;k++){
            const tail=k>=spineCount;
            const frame=tail?armorFrames[ARMOR_ROWS-1-Math.floor((k-spineCount)/3)*2]:armorFrames[Math.min(ARMOR_ROWS-1,k*3)];
            const angle=tail?((k-spineCount)%3-1)*.95:0;
            radialNormal.copy(frame.N).multiplyScalar(Math.cos(angle)).addScaledVector(frame.B,Math.sin(angle));
            across.copy(frame.B).multiplyScalar(Math.cos(angle)).addScaledVector(frame.N,-Math.sin(angle));
            armorBasis.makeBasis(across,radialNormal,frame.T);armorDummy.quaternion.setFromRotationMatrix(armorBasis);
            armorDummy.position.copy(frame.center).addScaledVector(radialNormal,frame.radius*1.04);
            const h=tail?1.9+(k%3)*.36:1.35+Math.pow(1-frame.t,2)*1.3;
            armorDummy.scale.set(Math.max(.16,frame.radius*.62),h*dragonOpacity,(tail?2.0:1.4)*dragonOpacity);
            armorDummy.updateMatrix();dragonDorsalInstances.setMatrixAt(k,armorDummy.matrix);
          }
          dragonScaleInstances.instanceMatrix.needsUpdate=true;
          dragonBellyInstances.instanceMatrix.needsUpdate=true;
          dragonDorsalInstances.instanceMatrix.needsUpdate=true;
        }

        // Tapered whisker tubes keep their thickness when the camera moves.
        const WHISKER_RADIAL=isMobile?7:9;
        const whiskerTubes=[-1,1].map(()=>{
          const geometry=new THREE.BufferGeometry(),positions=new Float32Array(WHISKER_PTS*(WHISKER_RADIAL+1)*3),normals=new Float32Array(positions.length),indices=[];
          for(let i=0;i<WHISKER_PTS-1;i++)for(let j=0;j<WHISKER_RADIAL;j++){
            const a=i*(WHISKER_RADIAL+1)+j,b=a+1,c=a+WHISKER_RADIAL+1,d=c+1;indices.push(a,b,c,b,d,c);
          }
          geometry.setAttribute('position',new THREE.BufferAttribute(positions,3).setUsage(THREE.DynamicDrawUsage));
          geometry.setAttribute('normal',new THREE.BufferAttribute(normals,3));geometry.setIndex(indices);
          const mesh=new THREE.Mesh(geometry,carvedGoldMat);mesh.frustumCulled=false;thunderDragonGroup.add(mesh);return geometry;
        });
        const wt=new THREE.Vector3(),wn=new THREE.Vector3(),wb=new THREE.Vector3(),wup=new THREE.Vector3(0,1,0);
        function updateWhiskerTube(index,points) {
          const geo=whiskerTubes[index],p=geo.attributes.position.array,n=geo.attributes.normal.array;
          for(let i=0;i<WHISKER_PTS;i++){
            const ia=Math.max(0,i-1)*3,ib=Math.min(WHISKER_PTS-1,i+1)*3;
            wt.set(points[ib]-points[ia],points[ib+1]-points[ia+1],points[ib+2]-points[ia+2]).normalize();
            if(wt.lengthSq()<.1)wt.set(0,0,1);
            wup.set(Math.abs(wt.y)>.95?1:0,Math.abs(wt.y)>.95?0:1,0);
            wb.crossVectors(wt,wup).normalize();wn.crossVectors(wb,wt).normalize();
            const radius=(.075*Math.pow(1-i/(WHISKER_PTS-1),.85)+.006)*dragonOpacity;
            for(let j=0;j<=WHISKER_RADIAL;j++){
              const a=j/WHISKER_RADIAL*Math.PI*2,cs=Math.cos(a),sn=Math.sin(a),offset=(i*(WHISKER_RADIAL+1)+j)*3;
              const nx=wn.x*cs+wb.x*sn,ny=wn.y*cs+wb.y*sn,nz=wn.z*cs+wb.z*sn;
              p[offset]=points[i*3]+nx*radius;p[offset+1]=points[i*3+1]+ny*radius;p[offset+2]=points[i*3+2]+nz*radius;
              n[offset]=nx;n[offset+1]=ny;n[offset+2]=nz;
            }
          }
          geo.attributes.position.needsUpdate=true;geo.attributes.normal.needsUpdate=true;
        }



        // DRAGON_SPINE_TRANSITION_START
        // Keep the last valid casting location when a hand leaves the camera.
        // Losing input is a stop, rather than a new command to fly to the origin.
        function getUntrackedTarget(){
          return STATE.gestureMode==='THUNDER_DRAGON'&&STATE.breathHeld?dragonBreathAnchor:STATE.targetPosition;
        }
        const dragonGoalSpine=Array.from({length:DRAGON_SPINE_NODES},()=>new THREE.Vector3());
        const dragonCoilSpine=Array.from({length:DRAGON_SPINE_NODES},()=>new THREE.Vector3());
        const dragonSegmentLimits=new Float32Array(DRAGON_SPINE_NODES);
        const dragonSpineStep=new THREE.Vector3();
        let dragonCoilWeight=STATE.stationaryWeight,dragonSpineReady=false;
        function updateDragonSpine(time,delta,dtRatio,currentTarget){
          const damp=a=>1-Math.pow(1-a,dtRatio);
          // The dragon has its own gradual recovery, independent of the faster
          // sword absorption animation driven by STATE.stationaryWeight.
          if(!dragonSpineReady)dragonCoilWeight=STATE.stationaryWeight;
          else dragonCoilWeight=THREE.MathUtils.lerp(dragonCoilWeight,STATE.stationaryWeight,damp(.065));
          const coilWeight=THREE.MathUtils.clamp(dragonCoilWeight,0,1),count=DRAGON_SPINE_NODES-1;
          for(let i=0;i<DRAGON_SPINE_NODES;i++){
            const t=i/count,sample=Math.min(t*293.25,STATE.pathHistory.length-2),a=Math.floor(sample),f=sample-a;
            const from=STATE.pathHistory[a]||currentTarget,to=STATE.pathHistory[a+1]||from;
            const goal=dragonGoalSpine[i];goal.lerpVectors(from,to,f);
            goal.x+=Math.sin(time*4.2-t*15.5)*(.45+t*3.6);
            goal.y+=Math.cos(time*3.6-t*12.0)*(.35+t*2.1);
            const coil=dragonCoilSpine[i];
            coil.set(currentTarget.x+Math.sin(t*Math.PI*3.35-.35)*(15.5*Math.sin(t*Math.PI*.88)+5.5)+Math.sin(time*1.6-t*6)*1.1,
              currentTarget.y+18-t*44+Math.sin(t*Math.PI*2.8)*4.5+Math.cos(time*1.5+t*4.5)*.85,
              currentTarget.z+Math.cos(t*Math.PI*3.35-.35)*(8.5+t*6.5)-3);
            goal.lerp(coil,coilWeight);
            if(i>0){
              // Bounds come from the intended moving/idle proportions, never
              // from a possibly stretched previous frame or a broken trail.
              const moveSpacing=(160+80*t)/count,coilSpacing=coil.distanceTo(dragonCoilSpine[i-1]);
              dragonSegmentLimits[i]=THREE.MathUtils.lerp(moveSpacing,coilSpacing,coilWeight)*1.08;
            }
          }
          const follow=damp(.35);
          for(let i=0;i<DRAGON_SPINE_NODES;i++){
            if(!dragonSpineReady){dragonSpine[i].copy(dragonGoalSpine[i]);continue;}
            // Apply the same interpolation to every node. Limiting only the
            // head made the body overtake it and left the dragon behind input.
            // The distance projection below protects the neck without input lag.
            dragonSpineStep.copy(dragonGoalSpine[i]).sub(dragonSpine[i]).multiplyScalar(follow);
            dragonSpine[i].add(dragonSpineStep);
          }
          // A head-anchored distance projection guarantees a bounded segment
          // length on every frame, including stops, resumes and dropped frames.
          for(let i=1;i<DRAGON_SPINE_NODES;i++){
            dragonSpineStep.copy(dragonSpine[i]).sub(dragonSpine[i-1]);
            const limit=dragonSegmentLimits[i],lengthSq=dragonSpineStep.lengthSq();
            if(lengthSq>limit*limit)dragonSpine[i].copy(dragonSpine[i-1]).addScaledVector(dragonSpineStep,limit/Math.sqrt(lengthSq));
          }
          dragonSpineReady=true;
        }
        // DRAGON_SPINE_TRANSITION_END

        // 更新辟邪神雷金龙骨骼、蒙皮网格、龙须、四爪与雷电弧
        let dragonOpacity = 0;
        function updateThunderDragon(time, delta, dtRatio, currentTarget, isActive) {
          const damp = (alphaAt60) => 1 - Math.pow(1 - alphaAt60, dtRatio);
          dragonOpacity = THREE.MathUtils.lerp(dragonOpacity, isActive ? 1.0 : 0.0, damp(isActive ? 0.16 : 0.12));
          thunderDragonGroup.visible = dragonOpacity > 0.01;
          if (!thunderDragonGroup.visible) {
            dragonLight.intensity = 0;
            dragonSpineReady=false;
            return;
          }

          dragonUniforms.uTime.value = time;
          dragonUniforms.uOpacity.value = dragonOpacity;
          dragonLight.intensity = dragonOpacity * (1.8 + Math.sin(time * 3.0) * 0.18);

          updateDragonSpine(time,delta,dtRatio,currentTarget);

          dragonLight.position.copy(dragonSpine[0]);
          dragonColorRig.position.copy(currentTarget);


          // Parallel transport keeps the belly, scales and mane continuous.
          const frameT=new THREE.Vector3(),frameB=new THREE.Vector3(),frameN=new THREE.Vector3(),transport=new THREE.Quaternion();
          const priorT=new THREE.Vector3(),priorB=new THREE.Vector3();
          for(let i=0;i<DRAGON_SPINE_NODES;i++){
            frameT.copy(dragonSpine[Math.max(0,i-1)]).sub(dragonSpine[Math.min(DRAGON_SPINE_NODES-1,i+1)]);
            if(frameT.lengthSq()<1e-6)frameT.set(0,1,0);else frameT.normalize();
            if(i===0){
              frameB.crossVectors(new THREE.Vector3(0,1,.25).normalize(),frameT);
              if(frameB.lengthSq()<.01)frameB.copy(dragonSpineBinormals[0]).projectOnPlane(frameT);
              if(frameB.lengthSq()<.001)frameB.set(1,0,0).projectOnPlane(frameT);
              frameB.normalize();
            }else{
              transport.setFromUnitVectors(priorT,frameT);frameB.copy(priorB).applyQuaternion(transport).projectOnPlane(frameT).normalize();
            }
            frameN.crossVectors(frameT,frameB).normalize();
            dragonSpineTangents[i].copy(frameT);dragonSpineBinormals[i].copy(frameB);dragonSpineNormals[i].copy(frameN);
            priorT.copy(frameT);priorB.copy(frameB);
          }

          // 3. 更新连续龙躯蒙皮网格与三层立体背鳍金鬃顶点
          const posArr = dragonBodyGeo.attributes.position.array;
          const normArr = dragonBodyGeo.attributes.normal.array;

          for (let i = 0; i < DRAGON_SPINE_NODES; i++) {
            const t = i / (DRAGON_SPINE_NODES - 1);
            const center = dragonSpine[i];
            const N = dragonSpineNormals[i];
            const B = dragonSpineBinormals[i];
            const T = dragonSpineTangents[i];
            const baseR = getDragonRadiusAt(t) * dragonOpacity;

            for (let j = 0; j <= DRAGON_RADIAL_SEGS; j++) {
              const u = j / DRAGON_RADIAL_SEGS;
              const theta = (u - 0.5) * Math.PI * 2.0;
              const cosA = Math.cos(theta);
              const sinA = Math.sin(theta);

              const bellyFlatten = cosA > 0 ? 0.82 : 1.08;
              const rx = sinA * baseR * 1.04;
              const ry = -cosA * baseR * bellyFlatten;

              const vx = center.x + B.x * rx + N.x * ry;
              const vy = center.y + B.y * rx + N.y * ry;
              const vz = center.z + B.z * rx + N.z * ry;

              const nx = B.x * sinA - N.x * cosA;
              const ny = B.y * sinA - N.y * cosA;
              const nz = B.z * sinA - N.z * cosA;

              const vIdx = (i * (DRAGON_RADIAL_SEGS + 1) + j) * 3;
              posArr[vIdx] = vx;
              posArr[vIdx + 1] = vy;
              posArr[vIdx + 2] = vz;
              normArr[vIdx] = nx;
              normArr[vIdx + 1] = ny;
              normArr[vIdx + 2] = nz;
            }

          }
          dragonBodyGeo.attributes.position.needsUpdate = true;
          dragonBodyGeo.attributes.normal.needsUpdate = true;
          updateDragonArmor(time);
          updateDragonFur(time);

          // 4. 更新龙头姿态、咆哮下颚开合与飘逸长龙须
          const headPos = dragonSpine[0];
          const headT = dragonSpineTangents[0];
          const headN = dragonSpineNormals[0];
          const headB = dragonSpineBinormals[0];

          dragonHeadGroup.position.copy(headPos);
          dragonHeadGroup.scale.setScalar(1.26 * dragonOpacity);
          const headMat = new THREE.Matrix4().makeBasis(headB, headN, headT);
          dragonHeadGroup.quaternion.setFromRotationMatrix(headMat);
          aimDragonHead(dtRatio);
          dragonHeadGroup.updateMatrixWorld();

          if (dragonHeadGroup.userData.lowerJaw) {
            dragonHeadGroup.userData.lowerJaw.rotation.x = 0.46 + Math.sin(time * 2.8) * 0.08;
          }

          // 更新左右两条修长动态龙须
          [-1, 1].forEach((side, wIdx) => {
            const wArr = whiskerCurves[wIdx].attributes.position.array;
            const startWorld = new THREE.Vector3(side * .86, .45, 4.48)
              .applyMatrix4(dragonHeadGroup.matrixWorld);
            for (let k = 0; k < WHISKER_PTS; k++) {
              const kt = k / (WHISKER_PTS - 1);
              const spineRef = dragonSpine[Math.min(DRAGON_SPINE_NODES - 1, Math.floor(kt * (DRAGON_SPINE_NODES-1)*.15))];

              const spread=side*(4.8+kt*6.2),lift=1.2-kt*2.2;
              const waveB=Math.sin(time*3.2-kt*6.5+wIdx)*kt*1.25;
              const waveN=Math.cos(time*2.8-kt*5.5)*kt*.85;
              const end=spineRef.clone().addScaledVector(headB,spread).addScaledVector(headN,lift);
              const point=startWorld.clone().lerp(end,kt).addScaledVector(headB,waveB).addScaledVector(headN,waveN);
              wArr[k*3]=point.x;wArr[k*3+1]=point.y;wArr[k*3+2]=point.z;
            }
            whiskerCurves[wIdx].attributes.position.needsUpdate = true;
            updateWhiskerTube(wIdx, wArr);
          });

          // 5. 更新四只龙爪位置与姿态
          dragonLimbs.forEach((limb, idx) => {
            const sIdx = limb.spineIdx;
            const cPos = dragonSpine[sIdx];
            const cT = dragonSpineTangents[sIdx];
            const cN = dragonSpineNormals[sIdx];
            const cB = dragonSpineBinormals[sIdx];
            limb.group.position.copy(cPos);
            limb.group.scale.setScalar((idx < 2 ? 1.08 : 0.98) * dragonOpacity);
            const limbMat = new THREE.Matrix4().makeBasis(cB, cN, cT);
            limb.group.quaternion.setFromRotationMatrix(limbMat);
          });


          // Fine surface currents and larger surrounding discharges share
          // the original lightning switch, quantity slider and color shader.
          updateDragonFilaments(time,dragonOpacity);

          // 更新金色雷火粒子
          const spPosArr = dragonSparkGeo.attributes.position.array;
          for (let i = 0; i < DRAGON_SPARK_COUNT; i++) {
            const info = dragonSparkOffsets[i];
            const nIdx = Math.min(DRAGON_SPINE_NODES - 1, Math.floor(info.spineT * DRAGON_SPINE_NODES));
            const spinePt = dragonSpine[nIdx];
            const a = info.ang + time * info.speed;
            const r = info.rad * (0.78 + 0.28 * Math.sin(time * 2.0 + info.phase));
            spPosArr[i * 3] = spinePt.x + Math.cos(a) * r;
            spPosArr[i * 3 + 1] = spinePt.y + Math.sin(a) * r + ((time * 2.2 + info.phase) % 4.0);
            spPosArr[i * 3 + 2] = spinePt.z + Math.sin(a * 0.8 + info.phase) * r;
          }
          dragonSparkGeo.attributes.position.needsUpdate = true;
        }

        // UI 文本与状态同步
        const FORMATION_META = {
          DRAGON: {
            title: '剑影分光 · 疾',
            desc: '移动引剑分光化作浩瀚剑流，静止时万剑归一凝为本命青竹剑',
            color: '#00ffa2',
          },
          LOTUS: {
            title: '莲花剑阵 · 启',
            desc: '镂金阵盘先展，飞剑依次归位成莲；剑阵开启期间阵盘随指引持续流转',
            color: '#ffdf70',
          },
          SHIELD: {
            title: '青元剑盾 · 御',
            desc: '72主剑与288剑影交织成十二层纬线剑环，正反交错旋转护体',
            color: '#70e2ff',
          },
          DAGENG: {
            title: '大庚剑阵 · 镇',
            desc: '青金天幕笼罩山门，四象阵盘环天流转，三百六十飞剑垂落成幕，金雷贯阵',
            color: '#ffe066',
          },
          GIANT: {
            title: '巨剑术 · 凝',
            desc: '剑流分八路逐渐汇聚，每9口主剑依次融合，凝成8柄擎天巨剑，剑锋朝下环阵缓旋',
            color: '#ffd24c',
          },
          THUNDER_DRAGON: {
            title: '神雷化形 · 敕',
            desc: '辟邪神雷凝聚九天金龙；按住鼠标右键吐雷，移动鼠标瞄准',
            color: '#ffbe2e',
          },
        };

        let toastTimer = null;
        function showSkillToast(msg) {
          const toastEl = document.getElementById('skill-toast');
          if (!toastEl) return;
          toastEl.textContent = msg;
          toastEl.classList.add('show');
          if (toastTimer) clearTimeout(toastTimer);
          toastTimer = setTimeout(() => {
            toastEl.classList.remove('show');
          }, 2400);
        }

        function updateHUD() {
          const meta = FORMATION_META[STATE.gestureMode] || FORMATION_META.DRAGON;
          const modeTitleEl = document.getElementById('mode-title');
          const modeDescEl = document.getElementById('mode-desc');
          const centerTitleEl = document.getElementById('center-title');
          const swordCountLabel = document.getElementById('sword-count-label');
          const splitRetainBtn = document.getElementById('toggle-split-retain-btn');
          const splitRetainText = document.getElementById('split-retain-btn-text');
          const retainMain = STATE.retainMainSwordsWhenSplitOff;

          modeTitleEl.textContent = STATE.gestureMode==='DRAGON'&&!STATE.splitEnabled?'青竹御剑 · 凝':meta.title;
          modeTitleEl.style.color = meta.color;
          document.getElementById('dragon-breath-btn').style.display=STATE.gestureMode==='THUNDER_DRAGON'?'block':'none';
          modeDescEl.textContent = STATE.gestureMode==='DRAGON'&&!STATE.splitEnabled
            ? (retainMain
              ? `分光已关闭，${CONFIG.mainSwordCount}把本命主剑随指御行；按 G 或点击开关恢复剑影`
              : '分光已关闭，一柄本命青竹剑随指御行；按 G 或点击开关恢复分光')
            : meta.desc;
          centerTitleEl.style.color = meta.color;

          if (STATE.gestureMode === 'THUNDER_DRAGON') {
            swordCountLabel.textContent = '万剑归隐 · 辟邪金龙现世';
          } else {
            swordCountLabel.textContent = STATE.splitEnabled?`${CONFIG.mainSwordCount}主剑 · ${CONFIG.shadowSwordCount}道通透剑光`
              : STATE.gestureMode==='DRAGON'
                ? (retainMain ? `${CONFIG.mainSwordCount}主剑 · 剑影分光已关闭` : '独剑御行 · 剑影分光已关闭')
                : `${CONFIG.mainSwordCount}主剑 · 剑影分光已关闭`;
          }

          splitRetainBtn.classList.toggle('active', retainMain);
          splitRetainBtn.setAttribute('aria-pressed', String(retainMain));
          splitRetainText.textContent = retainMain ? `关后：${CONFIG.mainSwordCount}主剑` : '关后：单剑';
          splitRetainBtn.title = retainMain
            ? `剑影分光关闭时保留${CONFIG.mainSwordCount}口主剑；点击切换为仅保留一把飞剑`
            : `剑影分光关闭时仅保留一把飞剑；点击切换为保留${CONFIG.mainSwordCount}口主剑`;

          document.querySelectorAll('.formation-pill').forEach((btn) => {
            btn.classList.toggle('active', btn.dataset.mode === STATE.gestureMode);
            btn.setAttribute('aria-pressed',String(btn.dataset.mode===STATE.gestureMode));
          });
        }

        function setFormationMode(newMode, isManualPin = false) {
          const required=formationUnlockFeature[newMode];
          if(required&&!unlocks.has(required))return false;
          // 只有在【辟邪神雷】开启的情况下才能使用“神雷化形”
          if (newMode === 'THUNDER_DRAGON' && !STATE.lightningEnabled) {
            showSkillToast('⚡ 需先开启【辟邪神雷】方可施展【神雷化形】');
            return;
          }
          if (isManualPin) {
            if (newMode === 'THUNDER_DRAGON') {
              STATE.swordFingerMode = 'THUNDER_DRAGON';
              STATE.manualPinnedMode = 'THUNDER_DRAGON';
            } else if (newMode === 'DRAGON') {
              STATE.swordFingerMode = 'DRAGON';
              STATE.manualPinnedMode = null;
            } else {
              STATE.manualPinnedMode = newMode;
            }
          }
          if(newMode!=='THUNDER_DRAGON')STATE.breathHeld=false;
          if (STATE.gestureMode !== newMode) {
            STATE.gestureMode = newMode;
            updateHUD();
          }
        }

        function toggleManualFormation(mode){
          const required=formationUnlockFeature[mode];
          if(STATE.gestureMode!==mode&&required&&!unlocks.require(required))return;
          if(mode==='THUNDER_DRAGON'&&!STATE.lightningEnabled&&!unlocks.has('lightning')){unlocks.require('lightning');return;}
          if(mode==='THUNDER_DRAGON'&&!STATE.lightningEnabled){showSkillToast('⚡ 需先开启【辟邪神雷】方可施展【神雷化形】');return;}
          const next=mode==='DRAGON'||STATE.gestureMode===mode?'DRAGON':mode;
          STATE.keys.left=false;STATE.swordFingerMode=next==='THUNDER_DRAGON'?'THUNDER_DRAGON':'DRAGON';
          setFormationMode(next,true);
        }
        function toggleThunderDragonMode(){toggleManualFormation('THUNDER_DRAGON');}
        document.querySelectorAll('.formation-pill').forEach(btn=>{
          btn.addEventListener('click',event=>{event.stopPropagation();toggleManualFormation(btn.dataset.mode);});
        });

        const fxPanel=document.getElementById('fx-panel');fxPanel.open=false;
        const amountSlider=document.getElementById('lightning-amount'),transparencySlider=document.getElementById('spirit-transparency');
        amountSlider.addEventListener('input',()=>{
          STATE.lightningAmount=THREE.MathUtils.clamp(Number(amountSlider.value)||0,0,400)/100;
          document.getElementById('lightning-amount-value').textContent=Math.round(STATE.lightningAmount*100)+'%';
        });
        transparencySlider.addEventListener('input',()=>{
          STATE.lightTransparency=THREE.MathUtils.clamp(Number(transparencySlider.value)||0,0,100)/100;
          document.getElementById('spirit-transparency-value').textContent=Math.round(STATE.lightTransparency*100)+'%';
        });
        const spinSlider=document.getElementById('sword-spin-speed');
        spinSlider.addEventListener('input',()=>{
          STATE.spinRPM=THREE.MathUtils.clamp(Number(spinSlider.value)||0,0,120);
          document.getElementById('sword-spin-value').textContent=STATE.spinRPM+' 转/分';
        });
        const qiToggle=document.getElementById('toggle-sword-qi');
        qiToggle.addEventListener('click',event=>{
          event.stopPropagation();if(!STATE.swordQiEnabled&&!unlocks.require('qi'))return;STATE.swordQiEnabled=!STATE.swordQiEnabled;
          swordAudio.effect('qi',STATE.swordQiEnabled);
          qiToggle.classList.toggle('active',STATE.swordQiEnabled);qiToggle.setAttribute('aria-pressed',String(STATE.swordQiEnabled));
          document.getElementById('sword-qi-text').textContent=STATE.swordQiEnabled?'流云剑气：开':'流云剑气：关';
          swordQiGroup.visible=STATE.swordQiEnabled&&STATE.gestureMode!=='THUNDER_DRAGON';
        });
        document.getElementById('reset-view').addEventListener('click',event=>{event.stopPropagation();resetCameraView();});
        const breathButton=document.getElementById('dragon-breath-btn');
        function stopDragonBreath(){STATE.breathHeld=false;}
        breathButton.addEventListener('pointerdown',event=>{
          event.preventDefault();event.stopPropagation();
          if(STATE.gestureMode==='THUNDER_DRAGON'&&STATE.lightningEnabled){beginDragonBreath();breathButton.setPointerCapture?.(event.pointerId);}
        });
        for(const event of ['pointerup','pointercancel','lostpointercapture'])breathButton.addEventListener(event,stopDragonBreath);
        window.addEventListener('blur',stopDragonBreath);window.addEventListener('pointerup',stopDragonBreath);
        window.addEventListener('pointercancel',stopDragonBreath);
        document.addEventListener('visibilitychange',()=>{if(document.hidden)stopDragonBreath();});
        window.addEventListener('contextmenu',event=>{
          if(isInterfaceTarget(event.target))return;
          if(STATE.gestureMode==='THUNDER_DRAGON'&&!event.target.closest('.fx-panel, .hud-plaque, .webcam-panel, .formation-bar'))event.preventDefault();
        });
        const toggleSplitBtn=document.getElementById('toggle-split-btn');
        function toggleSwordSplit(){
          if(!STATE.splitEnabled&&!unlocks.require('split'))return;
          STATE.splitEnabled=!STATE.splitEnabled;
          swordAudio.effect('split',STATE.splitEnabled);
          toggleSplitBtn.classList.toggle('active',STATE.splitEnabled);
          toggleSplitBtn.setAttribute('aria-pressed',String(STATE.splitEnabled));
          document.getElementById('split-btn-text').textContent=STATE.splitEnabled?'剑影分光：开':'剑影分光：关';
          if(!STATE.splitEnabled){STATE.dragonStreamProgress=0;STATE.inertiaRelease=0;}
          showSkillToast(STATE.splitEnabled
            ? '剑影分光已开启 · 72主剑与288道剑光'
            : (STATE.retainMainSwordsWhenSplitOff ? `剑影分光已关闭 · 保留${CONFIG.mainSwordCount}口主剑` : '剑影分光已关闭 · 仅保留一把飞剑'));
          updateHUD();
        }
        toggleSplitBtn.addEventListener('click',event=>{event.stopPropagation();toggleSwordSplit();});
        const toggleSplitRetainBtn=document.getElementById('toggle-split-retain-btn');
        toggleSplitRetainBtn.addEventListener('click',event=>{
          event.stopPropagation();if(!unlocks.require('split'))return;
          STATE.retainMainSwordsWhenSplitOff=!STATE.retainMainSwordsWhenSplitOff;
          if(!STATE.splitEnabled){STATE.dragonStreamProgress=STATE.retainMainSwordsWhenSplitOff?1:0;STATE.inertiaRelease=0;}
          showSkillToast(STATE.retainMainSwordsWhenSplitOff
            ? `分光关闭时将保留${CONFIG.mainSwordCount}口主剑`
            : '分光关闭时将仅保留一把飞剑');
          updateHUD();
        });

        const toggleLightningBtn = document.getElementById('toggle-lightning-btn');
        const lightningBtnText = document.getElementById('lightning-btn-text');
        const thunderDragonPill = document.getElementById('thunder-dragon-pill');
        function updateLightningUI() {
          toggleLightningBtn.classList.toggle('active', STATE.lightningEnabled);
          toggleLightningBtn.setAttribute('aria-pressed',String(STATE.lightningEnabled));
          lightningBtnText.textContent = STATE.lightningEnabled ? '辟邪神雷：开' : '辟邪神雷：关';
          if (thunderDragonPill) {
            thunderDragonPill.classList.toggle('disabled-skill', !STATE.lightningEnabled);
          }
          // 若关闭辟邪神雷时正在使用“神雷化形”，立即散去雷龙切回“剑影分光”
          if (!STATE.lightningEnabled) {
            if (STATE.swordFingerMode === 'THUNDER_DRAGON') {
              STATE.swordFingerMode = 'DRAGON';
            }
            if (STATE.manualPinnedMode === 'THUNDER_DRAGON') {
              STATE.manualPinnedMode = null;
            }
            if (STATE.gestureMode === 'THUNDER_DRAGON') {
              setFormationMode('DRAGON');
            }
          }
        }
        toggleLightningBtn.addEventListener('click', (e) => {
          e.stopPropagation();if(!STATE.lightningEnabled&&!unlocks.require('lightning'))return;
          STATE.lightningEnabled = !STATE.lightningEnabled;
          swordAudio.effect('lightning',STATE.lightningEnabled);
          updateLightningUI();
        });

        function syncModeFromKeys(){
          if(STATE.controlMode!=='MOUSE')return;
          setFormationMode(STATE.manualPinnedMode||((STATE.swordFingerMode==='THUNDER_DRAGON'&&STATE.lightningEnabled)?'THUNDER_DRAGON':'DRAGON'));
        }

        const viewRotation=new THREE.Quaternion(),viewEuler=new THREE.Euler(0,0,0,'YXZ');
        const viewPlaneNormal=new THREE.Vector3(0,0,1),viewWorldLook=new THREE.Vector3(),viewLocalAim=new THREE.Vector3();
        const viewOrigin=new THREE.Vector3(),viewCenterScreen=new THREE.Vector3();
        const viewUp=new THREE.Vector3(0,1,0),viewInverse=new THREE.Quaternion();
        const freeLookButton=document.getElementById('toggle-free-look'),lookReticle=document.getElementById('look-reticle');
        function isLookLocked(){return document.pointerLockElement===renderer.domElement;}
        function updateLookUI(){
          const active=isLookLocked(),dragging=STATE.look.dragging;
          const label=active?'退出自由视角 · V / Esc':'自由视角 · V';
          if(freeLookButton.textContent!==label)freeLookButton.textContent=label;
          if(freeLookButton.getAttribute('aria-pressed')!==String(active))freeLookButton.setAttribute('aria-pressed',String(active));
          const cursor=STATE.inspectMode?'grab':dragging?'grabbing':active?'none':'';
          if(renderer.domElement.style.cursor!==cursor)renderer.domElement.style.cursor=cursor;
          lookReticle.hidden=!(active||dragging)||STATE.inspectMode;
          lookReticle.style.left=((STATE.pointerNDC.x+1)*APP_VIEW.width*.5)+'px';
          lookReticle.style.top=((1-STATE.pointerNDC.y)*APP_VIEW.height*.5)+'px';
        }
        function stopLookDrag(){STATE.look.dragging=false;STATE.look.dragButton=-1;updateLookUI();}
        function releaseLookControl(){
          STATE.look.requesting=false;STATE.look.wantLock=false;STATE.look.pendingAngle=0;STATE.look.frameAngle=0;
          stopLookDrag();
          if(isLookLocked()){
            STATE.look.ignoreEscapeUntil=performance.now()+350;
            try{document.exitPointerLock?.();}catch(_){}
          }
        }
        function lookLockUnavailable(){
          const requested=STATE.look.requesting;STATE.look.requesting=false;STATE.look.wantLock=false;updateLookUI();
          if(requested)showSkillToast('当前环境未锁定鼠标：按住中键，或 Alt+左键拖动，同样可以360°转身。');
        }
        function toggleFreeLook(){
          if(STATE.inspectMode||isInteractionOverlayOpen())return;
          if(isLookLocked()||STATE.look.requesting){releaseLookControl();return;}
          STATE.look.requesting=true;STATE.look.wantLock=true;
          if(typeof renderer.domElement.requestPointerLock!=='function'){lookLockUnavailable();return;}
          try{const request=renderer.domElement.requestPointerLock();request?.catch?.(lookLockUnavailable);}
          catch(_){lookLockUnavailable();}
        }
        function rotateLookBy(dx,dy){
          if(!Number.isFinite(dx)||!Number.isFinite(dy))return;
          // Yaw remains unbounded: crossing +/-180 degrees never snaps back.
          STATE.look.yaw-=dx*.0032;
          STATE.look.pitch=THREE.MathUtils.clamp(STATE.look.pitch-dy*.0028,-Math.PI/2+.06,Math.PI/2-.06);
          STATE.look.pendingAngle+=Math.hypot(dx*.0032,dy*.0028);
        }
        function recenterLookPivot(){
          // Rebase only the view coordinates. Sword positions, flight position
          // and the current camera pose all remain at the same world location.
          const pivot=STATE.breathHeld&&STATE.gestureMode==='THUNDER_DRAGON'?dragonBreathAnchor:STATE.targetPosition;
          const origin=pivot.clone().sub(STATE.flight.offset);
          const shift=origin.clone().sub(viewOrigin).applyQuaternion(viewInverse.copy(viewRotation).invert());
          viewOrigin.copy(origin);smoothCamPos.sub(shift);smoothLookAt.sub(shift);smoothTarget.set(0,0,0);
          STATE.look.centered=true;applyLookCamera();
        }
        function beginLookDrag(event){
          recenterLookPivot();
          const p=toAppPoint(event.clientX,event.clientY);
          STATE.look.dragging=true;STATE.look.dragButton=event.button;STATE.look.lastX=p.x;STATE.look.lastY=p.y;
          event.preventDefault();updateLookUI();
        }
        function updateLookControl(delta){
          const look=STATE.look,alpha=1-Math.exp(-20*delta);
          look.frameAngle=look.pendingAngle;look.pendingAngle=0;
          look.currentYaw=THREE.MathUtils.lerp(look.currentYaw,look.yaw,alpha);
          look.currentPitch=THREE.MathUtils.lerp(look.currentPitch,look.pitch,alpha);
        }
        function applyLookCamera(){
          const offset=smoothCamPos.clone().sub(smoothLookAt);
          const elevation=Math.atan2(offset.y,Math.hypot(offset.x,offset.z)),limit=Math.PI/2-.06;
          const pitch=THREE.MathUtils.clamp(STATE.look.currentPitch,elevation-limit,elevation+limit);
          viewEuler.set(pitch,STATE.look.currentYaw,0,'YXZ');viewRotation.setFromEuler(viewEuler);
          viewPlaneNormal.set(0,0,1).applyQuaternion(viewRotation);
          camera.position.copy(smoothCamPos).applyQuaternion(viewRotation).add(STATE.flight.offset).add(viewOrigin);
          camera.up.copy(viewUp).applyQuaternion(viewRotation);
          viewWorldLook.copy(smoothLookAt).applyQuaternion(viewRotation).add(STATE.flight.offset).add(viewOrigin);
          camera.lookAt(viewWorldLook);camera.updateMatrixWorld();
          if(STATE.look.centered){
            viewCenterScreen.copy(STATE.flight.offset).add(viewOrigin).project(camera);
            STATE.pointerNDC.set(viewCenterScreen.x,viewCenterScreen.y);
            STATE.prevPointerNDC.copy(STATE.pointerNDC);
          }
          updateLookUI();
        }
        function resetCameraView(){
          STATE.zoomFactor=1;
          STATE.look.yaw=Math.round(STATE.look.currentYaw/(Math.PI*2))*Math.PI*2;
          STATE.look.pitch=0;
        }
        freeLookButton.addEventListener('click',event=>{event.stopPropagation();toggleFreeLook();});
        document.addEventListener('pointerlockchange',()=>{
          const locked=isLookLocked(),look=STATE.look;
          if(look.wasLocked&&!locked)look.ignoreEscapeUntil=performance.now()+350;
          look.wasLocked=locked;look.requesting=false;
          if(locked&&(!look.wantLock||STATE.inspectMode||isInteractionOverlayOpen()||document.hidden)){releaseLookControl();return;}
          if(locked)recenterLookPivot();
          else look.wantLock=false;
          stopLookDrag();
        });
        document.addEventListener('pointerlockerror',lookLockUnavailable);
        document.addEventListener('mouseleave',()=>{if(!isLookLocked())stopLookDrag();});
        window.addEventListener('auxclick',event=>{if(event.button===1&&!isInterfaceTarget(event.target))event.preventDefault();});
        const unprojectVec = new THREE.Vector3();
        const rayDirVec = new THREE.Vector3();

        function isFollowingFormation(mode){return mode==='DAGENG'||mode==='GIANT'||mode==='LOTUS';}
        function projectPointerToWorld(){
          camera.updateMatrixWorld();
          unprojectVec.set(STATE.pointerNDC.x, STATE.pointerNDC.y, 0.5).unproject(camera);
          rayDirVec.copy(unprojectVec).sub(camera.position).normalize();
          // Rotate the aiming plane with the view; side/rear views remain finite.
          const denominator=rayDirVec.dot(viewPlaneNormal);
          const distToPlane=Math.abs(denominator)>1e-5
            ? viewLocalAim.copy(STATE.flight.offset).add(viewOrigin).sub(camera.position).dot(viewPlaneNormal)/denominator : 0;
          if(distToPlane<=0||!Number.isFinite(distToPlane))return;
          const worldPos = camera.position.clone().addScaledVector(rayDirVec, distToPlane);
          STATE.targetPosition.copy(worldPos);
        }

        function updateTargetFromScreenXY(clientX,clientY){
          const point=toAppPoint(clientX,clientY);updateTargetFromLocalXY(point.x,point.y);
        }
        function updateTargetFromLocalXY(clientX,clientY){
          if(!isLookLocked()&&!STATE.look.dragging)STATE.look.centered=false;
          const ndcX = THREE.MathUtils.clamp((clientX / APP_VIEW.width) * 2 - 1, -1, 1);
          const ndcY = THREE.MathUtils.clamp(-(clientY / APP_VIEW.height) * 2 + 1, -1, 1);
          STATE.pointerNDC.set(ndcX, ndcY);
          // Input events only update coordinates; the animation frame projects
          // the latest point once, after the camera has reached its current pose.
        }

        const STREAM_STEP_DIST = 0.52;
        const streamSampleAnchor=STATE.pathHistory[0].clone();
        STATE.pathHistory.pop();STATE.pathHistory.splice(1,0,streamSampleAnchor.clone());
        let streamSampleFraction=0;
        function pushPathPoint(pos,dtRatio=1){
          const diff=pos.clone().sub(streamSampleAnchor),distance=diff.length();
          if(distance>.0001){
            const alpha=1-Math.pow(1-.35,dtRatio);
            STATE.lastDirection.lerp(diff.clone().divideScalar(distance),alpha).normalize();
          }
          const steps=Math.floor(distance/STREAM_STEP_DIST),retained=Math.min(STATE.pathHistory.length-1,steps);
          if(steps){
            // Keep a separate cursor: settling the visible tail must never move
            // the origin used to measure the next fixed-distance sample.
            for(let s=steps-retained+1;s<=steps;s++){
              const sample=streamSampleAnchor.clone().addScaledVector(diff,s*STREAM_STEP_DIST/distance);
              STATE.pathHistory.pop();STATE.pathHistory.splice(1,0,sample);
            }
            streamSampleAnchor.addScaledVector(diff,steps*STREAM_STEP_DIST/distance);
          }
          streamSampleFraction=THREE.MathUtils.clamp(streamSampleAnchor.distanceTo(pos)/STREAM_STEP_DIST,0,1);
          STATE.pathHistory[0].copy(pos);
        }
        function interpolateStreamPath(index,fraction,out){
          const history=STATE.pathHistory,a=history[index],b=history[index+1];
          const before=history[Math.max(0,index-1)],after=history[Math.min(history.length-1,index+2)],t=fraction,t2=t*t,t3=t2*t;
          // Catmull-Rom has a continuous tangent across samples. Per-segment
          // smoothstep forced the speed to zero at every boundary.
          for(const axis of ['x','y','z'])out[axis]=.5*(2*a[axis]+(-before[axis]+b[axis])*t+(2*before[axis]-5*a[axis]+4*b[axis]-after[axis])*t2+(-before[axis]+3*a[axis]-3*b[axis]+after[axis])*t3);
        }
        function updatePathChain(targetPos,dtRatio,streamMoving=false){
          STATE.pathHistory[0].copy(targetPos);
          // Recorded world-space samples remain still while steering. Only an
          // idle stream contracts toward its head during the existing recovery.
          if(streamMoving)return;
          const segSpacing=.50,followAlpha=1-Math.pow(1-.58,dtRatio),settleAlpha=1-Math.pow(1-.11,dtRatio);
          for(let k=1;k<STATE.pathHistory.length;k++){
            const previous=STATE.pathHistory[k-1],point=STATE.pathHistory[k],distance=point.distanceTo(previous);
            if(distance>segSpacing){const desired=previous.clone().lerp(point,segSpacing/distance);point.lerp(desired,followAlpha);}
            else if(distance>.002)point.lerp(previous,settleAlpha);
          }
        }

        // A pinch owns both fingers until they are all released. It changes only
        // camera distance, so it cannot steer swords or rotate the inspection.
        const touchNavigation={pinching:false,suppressSingle:false,ids:[],distance:0,inspection:false,ignoreMouseUntil:0};
        function resetTouchPinch(){
          if(touchNavigation.pinching)touchNavigation.suppressSingle=true;
          touchNavigation.pinching=false;touchNavigation.ids=[];touchNavigation.distance=0;
        }
        function zoomViewBy(factor){
          if(!Number.isFinite(factor)||factor<=0)return;
          if(STATE.inspectMode)inspectionOrbit.radius=THREE.MathUtils.clamp(inspectionOrbit.radius*factor,1.4,18);
          else STATE.zoomFactor=THREE.MathUtils.clamp(STATE.zoomFactor*factor,.85/lastBaseViewDistance,1800/lastBaseViewDistance);
        }
        function handlePinch(event){
          const touches=Array.from(event.touches||[]);
          if(touches.length<2)return false;
          if(!touchNavigation.pinching){
            if(isInteractionOverlayOpen()||touches.some(t=>isInterfaceTarget(t.target||event.target)))return false;
            touchNavigation.pinching=true;touchNavigation.suppressSingle=true;
            touchNavigation.ids=[touches[0].identifier,touches[1].identifier];touchNavigation.distance=0;
            touchNavigation.inspection=STATE.inspectMode;touchNavigation.ignoreMouseUntil=performance.now()+650;stopInspectionDrag();stopLookDrag();
          }
          let pair=touchNavigation.ids.map(id=>touches.find(t=>t.identifier===id));
          if(pair.some(t=>!t)||touchNavigation.inspection!==STATE.inspectMode){
            pair=touches.slice(0,2);touchNavigation.ids=pair.map(t=>t.identifier);touchNavigation.distance=0;touchNavigation.inspection=STATE.inspectMode;
          }
          const distance=Math.hypot(pair[0].clientX-pair[1].clientX,pair[0].clientY-pair[1].clientY);
          if(distance>=12&&touchNavigation.distance>=12)zoomViewBy(touchNavigation.distance/distance);
          touchNavigation.distance=distance;event.preventDefault();return true;
        }
        function handleTouchStart(event){
          if(isInterfaceTarget(event.target)||isInteractionOverlayOpen()||Array.from(event.touches).some(touch=>isInterfaceTarget(touch.target))){
            cancelTouchNavigation();return;
          }
          if(handlePinch(event))return;
          if(touchNavigation.suppressSingle||event.touches.length!==1||isInterfaceTarget(event.target)||isInteractionOverlayOpen())return;
          const touch=event.touches[0];
          if(STATE.inspectMode)startInspectionDrag(touch.clientX,touch.clientY);
          else if(STATE.controlMode==='MOUSE')updateTargetFromScreenXY(touch.clientX,touch.clientY);
          else return;
          event.preventDefault();
        }
        function handleTouchMove(event){
          if(isInterfaceTarget(event.target)||isInteractionOverlayOpen()||Array.from(event.touches).some(touch=>isInterfaceTarget(touch.target))){
            cancelTouchNavigation();return;
          }
          if(handlePinch(event))return;
          if(touchNavigation.suppressSingle){event.preventDefault();return;}
          if(event.touches.length!==1||isInterfaceTarget(event.target)||isInteractionOverlayOpen())return;
          const touch=event.touches[0];
          if(STATE.inspectMode)dragInspection(touch.clientX,touch.clientY);
          else if(STATE.controlMode==='MOUSE')updateTargetFromScreenXY(touch.clientX,touch.clientY);
          else return;
          event.preventDefault();
        }
        function handleTouchEnd(event){
          if(isInterfaceTarget(event.target)||isInteractionOverlayOpen()){
            cancelTouchNavigation();return;
          }
          const consumed=touchNavigation.pinching||touchNavigation.suppressSingle;
          if(event.touches.length<2){touchNavigation.pinching=false;touchNavigation.distance=0;touchNavigation.ids=[];}
          if(event.touches.length===0)touchNavigation.suppressSingle=false;
          stopInspectionDrag();if(consumed){touchNavigation.ignoreMouseUntil=performance.now()+400;event.preventDefault();}
        }
        window.addEventListener('touchstart',handleTouchStart,{passive:false});
        window.addEventListener('touchmove',handleTouchMove,{passive:false});
        window.addEventListener('touchend',handleTouchEnd,{passive:false});
        window.addEventListener('touchcancel',handleTouchEnd,{passive:false});
        function cancelTouchNavigation(){
          resetTouchPinch();touchNavigation.suppressSingle=false;stopInspectionDrag();
        }
        window.addEventListener('blur',cancelTouchNavigation);
        window.addEventListener('pagehide',cancelTouchNavigation);
        document.addEventListener('visibilitychange',()=>{if(document.hidden)cancelTouchNavigation();});

        window.addEventListener('mousemove',(e)=>{
          if(performance.now()<touchNavigation.ignoreMouseUntil)return;
          if(isLookLocked()){
            if(STATE.inspectMode||isInteractionOverlayOpen()){releaseLookControl();return;}
            const a=APP_VIEW.rotation*Math.PI/180,c=Math.cos(a),s=Math.sin(a),dx=e.movementX||0,dy=e.movementY||0;
            rotateLookBy(c*dx+s*dy,-s*dx+c*dy);return;
          }
          if(STATE.look.dragging){
            const mask=STATE.look.dragButton===1?4:1;
            if(!(e.buttons&mask)){stopLookDrag();return;}
            const p=toAppPoint(e.clientX,e.clientY);
            rotateLookBy(p.x-STATE.look.lastX,p.y-STATE.look.lastY);STATE.look.lastX=p.x;STATE.look.lastY=p.y;return;
          }
          if(isInterfaceTarget(e.target))return;
          if(STATE.inspectMode){if(!e.target.closest('.inspection-ui'))dragInspection(e.clientX,e.clientY);return;}
          if(e.target.closest('.fx-panel'))return;
          if (STATE.controlMode !== 'MOUSE') return;
          updateTargetFromScreenXY(e.clientX, e.clientY);
        });

        window.addEventListener('mousedown',(e)=>{
          if(performance.now()<touchNavigation.ignoreMouseUntil)return;
          if(isInterfaceTarget(e.target))return;
          if(STATE.inspectMode){
            if(e.button===0&&!e.target.closest('.inspection-ui')){e.preventDefault();startInspectionDrag(e.clientX,e.clientY);}return;
          }
          if(e.button===1||(e.button===0&&e.altKey)){beginLookDrag(e);return;}
          if(e.button===2&&STATE.gestureMode==='THUNDER_DRAGON'&&STATE.lightningEnabled&&!e.target.closest('.fx-panel, .hud-plaque, .webcam-panel, .formation-bar')){
            e.preventDefault();beginDragonBreath();return;
          }
        });

        window.addEventListener('mouseup',(e)=>{
          if(STATE.look.dragging&&e.button===STATE.look.dragButton){stopLookDrag();return;}
          if(STATE.inspectMode){stopInspectionDrag();return;}
          if(e.button===2)STATE.breathHeld=false;
          if(e.button===0)STATE.keys.left=false;
        });

        const keyboardFormations={KeyQ:'LOTUS',KeyR:'SHIELD',KeyE:'DAGENG',KeyT:'GIANT',KeyF:'THUNDER_DRAGON'};
        const flightCodes=new Set(['KeyW','KeyA','KeyS','KeyD','Space','ControlLeft','ControlRight',
          'ArrowUp','ArrowDown','ArrowLeft','ArrowRight',
          'Numpad8','Numpad2','Numpad4','Numpad6','Numpad9','Numpad3','PageUp','PageDown','ShiftLeft','ShiftRight']);
        const flightIntent=new THREE.Vector3(),flightPrevious=new THREE.Vector3();
        const flightBoundsMin=new THREE.Vector3(-1250,-190,-1750),flightBoundsMax=new THREE.Vector3(1250,470,760);
        const moonFlightBase=moonGroup.position.clone(),jadeFlightBase=jadePointLight.position.clone();
        const flightPositionLabel=document.getElementById('flight-position');
        function flightFieldFocused(target){return !!target?.closest?.('input, textarea, select, [contenteditable="true"]');}
        function clearFlightInput(){STATE.flight.keys.clear();STATE.flight.velocity.set(0,0,0);STATE.flight.delta.set(0,0,0);}
        function handleFlightKeyDown(event){
          if(!flightCodes.has(event.code)||STATE.inspectMode||isInteractionOverlayOpen()||flightFieldFocused(event.target))return false;
          // Physical Numpad codes also work when Num Lock turns 8/2/4/6 into arrows.
          STATE.flight.keys.add(event.code);
          if(!event.code.startsWith('Shift'))event.preventDefault();
          return true;
        }
        function updateFlightNavigation(delta){
          const flight=STATE.flight;flight.delta.set(0,0,0);
          if(document.hidden||STATE.inspectMode||isInteractionOverlayOpen()){clearFlightInput();return;}
          const held=(...codes)=>codes.some(code=>flight.keys.has(code));
          flightIntent.set(
            Number(held('KeyD','ArrowRight','Numpad6'))-Number(held('KeyA','ArrowLeft','Numpad4')),
            Number(held('Space','PageUp','Numpad9'))-Number(held('ControlLeft','ControlRight','PageDown','Numpad3')),
            Number(held('KeyS','ArrowDown','Numpad2'))-Number(held('KeyW','ArrowUp','Numpad8')));
          // WASD/arrows follow the camera heading; Space/Ctrl control world altitude.
          flightIntent.applyAxisAngle(viewUp,STATE.look.currentYaw);
          const moving=flightIntent.lengthSq()>0;
          if(moving)flightIntent.normalize().multiplyScalar(CONFIG.navigationSpeed*(held('ShiftLeft','ShiftRight')?2:1));
          // Analytic acceleration/braking keeps travel consistent at different frame rates.
          const response=moving?12:18,decay=Math.exp(-response*delta),integral=(1-decay)/response;
          flight.delta.copy(flight.velocity).sub(flightIntent).multiplyScalar(integral).addScaledVector(flightIntent,delta);
          flight.velocity.sub(flightIntent).multiplyScalar(decay).add(flightIntent);
          flightPrevious.copy(flight.offset);flight.offset.add(flight.delta);
          for(const axis of ['x','y','z']){
            const value=flight.offset[axis];flight.offset[axis]=THREE.MathUtils.clamp(value,flightBoundsMin[axis],flightBoundsMax[axis]);
            if(value!==flight.offset[axis]||(!moving&&Math.abs(flight.velocity[axis])<.001))flight.velocity[axis]=0;
          }
          flight.delta.copy(flight.offset).sub(flightPrevious);
          if(!STATE.isTracking)STATE.targetPosition.add(flight.delta);
          if(STATE.breathHeld)dragonBreathAnchor.add(flight.delta);
          if(flightPositionLabel){
            const label=`空间坐标 X ${Math.round(flight.offset.x)} · Y ${Math.round(flight.offset.y)} · Z ${Math.round(flight.offset.z)}`;
            if(flightPositionLabel.textContent!==label)flightPositionLabel.textContent=label;
          }
        }
        window.addEventListener('keydown',e=>{
          if(handleGameGuideKey(e))return;
          if(e.metaKey||e.altKey)return;
          if(e.code==='Escape'&&(isLookLocked()||STATE.look.dragging||STATE.look.requesting||performance.now()<STATE.look.ignoreEscapeUntil)){
            e.preventDefault();releaseLookControl();return;
          }
          if(handleFlightKeyDown(e))return;
          // Handle flight first so Ctrl can lower altitude while WASD/Space/Shift stay usable.
          if(e.ctrlKey)return;
          if(e.repeat)return;
          if(e.code==='Escape'&&closeUiVisibilityMenu()){e.preventDefault();return;}
          if(e.code==='KeyH'){e.preventDefault();toggleInspection();return;}
          if(STATE.inspectMode)return;
          if(e.target.closest('textarea, select, [contenteditable="true"], input:not([type="range"])'))return;
          if(e.code==='KeyV'){e.preventDefault();toggleFreeLook();return;}
          if(e.code==='KeyC'){e.preventDefault();resetCameraView();return;}
          if(e.code==='KeyG'){toggleSwordSplit();return;}
          const keyboardEffectToggles={
            Digit1:()=>toggleSwordSplit(),
            Digit2:()=>toggleLightningBtn.click(),
            Digit3:()=>qiToggle.click(),
            Digit4:()=>toggleSplitRetainBtn.click(),
          };
          if(keyboardEffectToggles[e.code]){
            e.preventDefault();keyboardEffectToggles[e.code]();return;
          }
          if(STATE.controlMode!=='MOUSE'){
            if(e.code==='KeyF')toggleThunderDragonMode();return;
          }
          if(e.code==='Escape'){toggleManualFormation('DRAGON');return;}
          if(keyboardFormations[e.code]){
            e.preventDefault();STATE.keys[e.code]=true;toggleManualFormation(keyboardFormations[e.code]);
          }
        });
        window.addEventListener('keyup',e=>{STATE.flight.keys.delete(e.code);if(e.code in STATE.keys)STATE.keys[e.code]=false;});
        window.addEventListener('blur',()=>{clearFlightInput();releaseLookControl();for(const key of Object.keys(STATE.keys))STATE.keys[key]=false;});
        document.addEventListener('visibilitychange',()=>{if(document.hidden){clearFlightInput();releaseLookControl();}});
        document.addEventListener('focusin',e=>{if(flightFieldFocused(e.target))clearFlightInput();});

        window.addEventListener(
          'wheel',
          (e) => {
            if(isInterfaceTarget(e.target))return;
            if(STATE.inspectMode){e.preventDefault();zoomViewBy(Math.exp(e.deltaY*.0013));return;}
            if(e.target.closest('.fx-panel'))return;
            e.preventDefault();
            const wheelDelta=e.deltaY*(e.deltaMode===1?16:e.deltaMode===2?APP_VIEW.height:1);
            zoomViewBy(Math.exp(THREE.MathUtils.clamp(wheelDelta*.0018,-1.5,1.5)));
          },
          { passive: false }
        );

        window.addEventListener('resize',resizeAppViewport);
        window.addEventListener('orientationchange',resizeAppViewport);
        window.visualViewport?.addEventListener('resize',resizeAppViewport);
        window.screen?.orientation?.addEventListener('change',resizeAppViewport);
        document.addEventListener('fullscreenchange',resizeAppViewport);
        document.addEventListener('webkitfullscreenchange',resizeAppViewport);

        let performanceMode=false,handPerformanceMode=false,lastPerformanceFrameTime=0;
        const webcamPanel = document.getElementById('camera-window');
        const webcamBox = document.getElementById('webcam-box');
        const webcamSizeSlider = document.getElementById('webcam-size');
        const webcamSizeValue = document.getElementById('webcam-size-value');
        function updateWebcamSize() {
          webcamPanel.style.setProperty('--webcam-scale', String(webcamSizeSlider.valueAsNumber / 100));
          webcamSizeValue.value = webcamSizeSlider.value + '%';
        }
        webcamSizeSlider.addEventListener('input', updateWebcamSize);
        updateWebcamSize();

        let webcamPress = null;
        let skipWebcamStatusClick = false;
        function stopWebcamDrag(event) {
          const press = webcamPress;
          if (!press || (event?.pointerId !== undefined && event.pointerId !== press.id)) return;
          webcamPress = null;
          clearTimeout(press.timer);
          webcamPanel.classList.remove('is-dragging');
          if (press.target.hasPointerCapture(press.id)) press.target.releasePointerCapture(press.id);
        }
        webcamBox.addEventListener('pointerdown', event => {
          if (!event.isPrimary || event.button !== 0 || webcamPress) return;
          const start = toAppPoint(event.clientX, event.clientY);
          const press = {id: event.pointerId, target: event.target, start, offset: null};
          // Capture on the original target so a short tap still opens camera diagnostics.
          press.target.setPointerCapture(press.id);
          webcamPress = press;
          skipWebcamStatusClick = false;
          press.timer = setTimeout(() => {
            if (!webcamBox.offsetWidth || isInteractionOverlayOpen()) {
              stopWebcamDrag();
              return;
            }
            const rect = webcamPanel.getBoundingClientRect();
            const center = toAppPoint(rect.left + rect.width / 2, rect.top + rect.height / 2);
            press.offset = {
              x: start.x - center.x + webcamPanel.offsetWidth / 2,
              y: start.y - center.y + webcamPanel.offsetHeight / 2,
            };
            skipWebcamStatusClick = true;
            webcamPanel.classList.add('is-dragging');
          }, 2000);
        });
        webcamBox.addEventListener('pointermove', event => {
          const press = webcamPress;
          if (!press || event.pointerId !== press.id) return;
          const point = toAppPoint(event.clientX, event.clientY);
          if (!press.offset) {
            if (Math.hypot(point.x - press.start.x, point.y - press.start.y) > 8) {
              clearTimeout(press.timer);
              skipWebcamStatusClick = true;
            }
            return;
          }
          webcamPanel.style.setProperty('--webcam-x', (point.x - press.offset.x) + 'px');
          webcamPanel.style.setProperty('--webcam-y', (point.y - press.offset.y) + 'px');
        });
        for (const event of ['pointerup', 'pointercancel', 'lostpointercapture']) {
          webcamBox.addEventListener(event, stopWebcamDrag);
        }
        webcamBox.addEventListener('contextmenu', event => event.preventDefault());
        window.addEventListener('blur', stopWebcamDrag);
        window.addEventListener('pagehide', stopWebcamDrag);
        document.addEventListener('visibilitychange', () => { if (document.hidden) stopWebcamDrag(); });

        // The camera preview is hidden/restored through the window controls;
        // the underlying hand-tracking session keeps running.

        // Camera permission, video playback and the local recognition engine
        // are separate stages. Failed/cancelled starts never poison retries.
        let handLandmarker=null,handTrackingInitPromise=null,handModelBuildPromise=null;
        let cameraStream=null,handSessionSerial=0,handDelegate='',forceHandCPU=false;
        let handAssetsPromise=null,lastHandInference=0,handRecovering=false;
        const videoEl=document.getElementById('webcam-video'),webcamCanvas=document.getElementById('webcam-canvas');
        const webcamCtx=webcamCanvas.getContext('2d'),webcamStatusEl=document.getElementById('webcam-status');
        const trackingLabelEl=document.getElementById('tracking-label'),toggleControlBtn=document.getElementById('toggle-control-btn');
        const gestureWindow=[],GESTURE_WINDOW_SIZE=6;
        const smoothedHandScreen={x:APP_VIEW.width*.5,y:APP_VIEW.height*.5,initialized:false};
        const webcamFrame=document.getElementById('webcam-frame'),webcamFrameCtx=webcamFrame.getContext('2d');
        const cameraInputCanvas=document.createElement('canvas'),cameraInputCtx=cameraInputCanvas.getContext('2d');
        const cameraPresentation={layout:null,key:'',lastFrameTime:-1,lastConstraintKey:'',pending:null,applying:false};
        function cameraVideoConstraints(){
          const landscape=APP_VIEW.width>=APP_VIEW.height;
          let width=landscape?640:480,height=landscape?480:640;
          if(Math.abs(APP_VIEW.rotation)%180){const swap=width;width=height;height=swap;}
          return {facingMode:{ideal:'user'},width:{ideal:width},height:{ideal:height},aspectRatio:{ideal:width/height},frameRate:{ideal:24,max:30}};
        }
        // The browser owns sensor orientation. Compensate only the app's CSS
        // rotation, with the selfie mirror applied BEFORE that compensation.
        // ParentRotation * InverseRotation * Mirror = Mirror (never vertical).
        function cameraFrameLayout(sourceWidth,sourceHeight,rotation,boxWidth,boxHeight,pixelRatio=1){
          const quarterTurn=Math.abs(rotation)%180!==0,orientedWidth=quarterTurn?sourceHeight:sourceWidth,orientedHeight=quarterTurn?sourceWidth:sourceHeight;
          const inputScale=Math.min(1,(handPerformanceMode?480:640)/Math.max(orientedWidth,orientedHeight));
          const inputWidth=Math.max(1,Math.round(orientedWidth*inputScale)),inputHeight=Math.max(1,Math.round(orientedHeight*inputScale));
          const width=Math.max(1,Math.round(boxWidth*pixelRatio)),height=Math.max(1,Math.round(boxHeight*pixelRatio));
          const coverScale=Math.max(width/inputWidth,height/inputHeight);
          return {width,height,inputWidth,inputHeight,angle:-rotation*Math.PI/180,drawWidth:sourceWidth*inputScale,drawHeight:sourceHeight*inputScale,
            coverScale,offsetX:(width-inputWidth*coverScale)/2,offsetY:(height-inputHeight*coverScale)/2,cssWidth:boxWidth,cssHeight:boxHeight};
        }
        function cameraPreviewLandmarks(landmarks,layout){
          return landmarks.map(p=>({...p,x:(p.x*layout.inputWidth*layout.coverScale+layout.offsetX)/layout.width,
            y:(p.y*layout.inputHeight*layout.coverScale+layout.offsetY)/layout.height,
            z:(p.z||0)*layout.inputWidth*layout.coverScale/layout.width}));
        }
        function cameraPreviewBoxSize(){
          const style=window.getComputedStyle(webcamBox);
          return {width:Math.max(1,webcamBox.clientWidth||parseFloat(style.width)||(isMobile?118:164)),
            height:Math.max(1,webcamBox.clientHeight||parseFloat(style.height)||(isMobile?(APP_VIEW.width>=APP_VIEW.height?72:88):124))};
        }
        function clearCameraOrientationHistory(){
          lastVideoTime=-1;lastHandInference=0;gestureWindow.length=0;smoothedHandScreen.initialized=false;
          webcamCtx.clearRect(0,0,webcamCanvas.width,webcamCanvas.height);
        }
        function syncCameraOrientation(){
          const key=(APP_VIEW.width>=APP_VIEW.height?'landscape':'portrait')+':'+APP_VIEW.rotation;
          if(cameraPresentation.key!==key){
            cameraPresentation.key=key;cameraPresentation.lastFrameTime=-1;clearCameraOrientationHistory();
          }
          const track=cameraStream?.getVideoTracks?.()[0];if(!track||track.readyState==='ended')return;
          const constraints=cameraVideoConstraints(),constraintKey=constraints.width.ideal+'x'+constraints.height.ideal;
          if(cameraPresentation.lastConstraintKey===constraintKey)return;
          cameraPresentation.lastConstraintKey=constraintKey;
          cameraPresentation.pending={track,constraints};
          if(!cameraPresentation.applying)void applyPendingCameraConstraints();
        }
        async function applyPendingCameraConstraints(){
          cameraPresentation.applying=true;
          try{
            while(cameraPresentation.pending){
              const request=cameraPresentation.pending;cameraPresentation.pending=null;
              if(!cameraStream?.getVideoTracks?.().includes(request.track))continue;
              try{await request.track.applyConstraints?.(request.constraints);}
              catch(_){/* The oriented canvas also works with a camera's native size. */}
              if(cameraStream?.getVideoTracks?.().includes(request.track)){
                cameraPresentation.lastFrameTime=-1;clearCameraOrientationHistory();
              }
            }
          }finally{cameraPresentation.applying=false;}
        }
        function renderCameraFrame(){
          if(!cameraStream||videoEl.readyState<2||!videoEl.videoWidth||!videoEl.videoHeight)return null;
          const box=cameraPreviewBoxSize(),ratio=Math.min(handPerformanceMode?1.5:3,Math.max(1,window.devicePixelRatio||1));
          const layout=cameraFrameLayout(videoEl.videoWidth,videoEl.videoHeight,APP_VIEW.rotation,box.width,box.height,ratio);
          const sourceKey=[videoEl.videoWidth,videoEl.videoHeight,APP_VIEW.rotation,layout.inputWidth,layout.inputHeight].join(':');
          if(cameraPresentation.sourceKey!==sourceKey){
            cameraPresentation.sourceKey=sourceKey;cameraPresentation.lastFrameTime=-1;
            cameraInputCanvas.width=layout.inputWidth;cameraInputCanvas.height=layout.inputHeight;
            clearCameraOrientationHistory();
          }
          if (cameraPresentation.layout?.width !== layout.width || cameraPresentation.layout?.height !== layout.height) {
            webcamFrame.width = webcamCanvas.width = layout.width;
            webcamFrame.height = webcamCanvas.height = layout.height;
            cameraPresentation.lastFrameTime = -1;
          }
          cameraPresentation.layout=layout;
          if(cameraPresentation.lastFrameTime!==videoEl.currentTime){
            cameraInputCtx.save();
            try{
              cameraInputCtx.setTransform(1,0,0,1,0,0);cameraInputCtx.clearRect(0,0,layout.inputWidth,layout.inputHeight);
              cameraInputCtx.translate(layout.inputWidth/2,layout.inputHeight/2);
              cameraInputCtx.rotate(layout.angle);cameraInputCtx.scale(-1,1);
              cameraInputCtx.drawImage(videoEl,-layout.drawWidth/2,-layout.drawHeight/2,layout.drawWidth,layout.drawHeight);
            }finally{cameraInputCtx.restore();}
            // Recognition retains the complete camera view. The preview uses one
            // centered cover crop; its skeleton uses exactly that same crop.
            webcamFrameCtx.save();
            try{
              webcamFrameCtx.setTransform(1,0,0,1,0,0);webcamFrameCtx.clearRect(0,0,layout.width,layout.height);
              webcamFrameCtx.drawImage(cameraInputCanvas,layout.offsetX,layout.offsetY,layout.inputWidth*layout.coverScale,layout.inputHeight*layout.coverScale);
            }finally{webcamFrameCtx.restore();}
            cameraPresentation.lastFrameTime=videoEl.currentTime;
          }
          return cameraInputCanvas;
        }
        videoEl.addEventListener('resize',()=>{cameraPresentation.lastFrameTime=-1;clearCameraOrientationHistory();syncCameraOrientation();});
        videoEl.addEventListener('loadedmetadata',syncCameraOrientation);
        const cameraDiagnostic={stage:'idle',title:'摄像头尚未开启',detail:'点击“开启手势”并允许使用摄像头。普通御剑可直接用鼠标或触屏操作。',code:'',technical:''};
        function cameraError(code,message){const e=new Error(message);e.cameraCode=code;return e;}
        function cameraPolicyAllowed(){
          try{const p=document.permissionsPolicy||document.featurePolicy;return p?.allowsFeature?p.allowsFeature('camera'):null;}catch(_){return null;}
        }
        function refreshCameraDiagnostic(){
          const put=(id,text)=>{const el=document.getElementById(id);if(el)el.textContent=text;};
          put('camera-diagnostic-title',cameraDiagnostic.title);put('camera-diagnostic-detail',cameraDiagnostic.detail);
          put('camera-context-state',toyBridge.sdkAvailable?'B站 Toy · 平台摄像头授权':toyBridge.isPlatformPage?'B站 Toy · 等待 SDK 连接':window.isSecureContext===false?'当前页面不是安全页面':'普通浏览器 · 安全访问检查');
          const allowed=cameraPolicyAllowed();put('camera-policy-state',toyBridge.sdkAvailable?'由 B站 授权弹窗与系统相机权限确认':toyBridge.isPlatformPage?'等待 B站 摄像头授权组件加载':allowed===false?'当前预览未开放摄像头':allowed===true?'当前页面允许申请摄像头':'由浏览器确认访问权限');
          put('camera-stream-state',cameraStream?.getVideoTracks?.().some(t=>t.readyState==='live')?'摄像头已开启':'摄像头未开启');
          put('camera-model-state',handLandmarker?'手势识别已就绪 · '+(handDelegate==='CPU'?'兼容模式':'加速模式'):cameraDiagnostic.stage==='model'?'识别组件正在准备':'资源已随包附带 · 支持备用下载');
          put('camera-error-code',cameraDiagnostic.code||'无');put('camera-technical-detail',cameraDiagnostic.technical||'尚无错误记录');
          const stop=document.getElementById('camera-stop-button');if(stop)stop.disabled=STATE.controlMode!=='HAND'&&!cameraStream;
        }
        function setCameraStatus(stage,title,detail,shortText){
          Object.assign(cameraDiagnostic,{stage,title,detail});
          webcamStatusEl.textContent=shortText||title;refreshCameraDiagnostic();
        }
        function resetMouseControl(){
          STATE.controlMode='MOUSE';STATE.isTracking=true;
          toggleControlBtn.textContent='开启手势控制';trackingLabelEl.textContent='法诀御剑 · 灵枢已启';
          gestureWindow.length=0;smoothedHandScreen.initialized=false;
        }
        function stopCameraCapture(){
          const stream=cameraStream;cameraStream=null;
          cameraPresentation.pending=null;cameraPresentation.lastConstraintKey='';cameraPresentation.lastFrameTime=-1;cameraPresentation.sourceKey='';
          if(stream)void toyBridge.stopMedia(stream);
          try{videoEl.pause();}catch(_){}videoEl.srcObject=null;webcamCtx.clearRect(0,0,webcamCanvas.width,webcamCanvas.height);webcamFrameCtx.clearRect(0,0,webcamFrame.width,webcamFrame.height);cameraInputCtx.clearRect(0,0,cameraInputCanvas.width,cameraInputCanvas.height);
        }
        function stopHandTracking(message='已关闭手势与摄像头，可继续使用鼠标或触屏。'){
          ++handSessionSerial;handTrackingInitPromise=null;stopCameraCapture();resetMouseControl();
          syncRenderPerformance();
          setCameraStatus('idle','摄像头已关闭',message,'键鼠/触控 · 点此检测摄像头');
        }
        function explainCameraError(error,stage){
          let code=error.cameraCode||error.name||'UNKNOWN',title='手势识别暂时不可用',detail='可以重试；普通御剑仍可用鼠标或触屏。';
          if(code==='BusinessDenied'){title='已取消 B站 摄像头授权';detail='如需手势御剑，请点“重新开启手势”并确认 B站 的摄像头使用授权；也可继续触控御剑。';}
          else if(code==='TOY_CAMERA_UNSUPPORTED'||error.type==='unsupported'){title='当前环境不支持 Toy 摄像头';detail='请更新 B站 App 后重新打开 Toy，或继续使用键鼠和触控御剑。';}
          else if(code==='TOY_SDK_UNAVAILABLE'){title='B站 连接尚未就绪';detail='请检查网络并重新打开当前 Toy，再点击“开启手势控制”。键鼠和触控仍可使用。';}
          else if(code==='CAMERA_CANCELLED'){title='摄像头申请已取消';detail='返回游戏后可重新点击“开启手势控制”。';}
          else if(code==='INSECURE_CONTEXT'){title='当前页面不是安全页面';detail='请使用浏览器访问游戏的 HTTPS 网页。普通 HTTP、部分附件预览或无来源页面无法申请摄像头。';}
          else if(code==='CAMERA_POLICY'){title='当前页面的摄像头访问受限';detail=toyBridge.isPlatformPage?'请检查网络并重新打开 B站 Toy，让平台摄像头授权组件完成加载后重试。':'当前嵌入页面未开放摄像头访问，请从游戏的正式入口打开；网页宿主需要允许摄像头访问。';}
          else if(code==='CAMERA_API'){title='当前浏览器没有提供摄像头入口';detail='请在手机系统设置中允许浏览器使用相机，再用 Safari 或 Chrome 打开游戏的 HTTPS 网页；不要使用只读文件预览。';}
          else if(['NotAllowedError','PermissionDeniedError','SecurityError'].includes(code)&&['camera','video'].includes(stage)){
            if(stage==='video'){title='摄像头视频播放被阻止';detail='请点“重新开启手势”，并在浏览器中允许播放摄像头画面。';}
            else{title='未获得摄像头授权';detail=toyBridge.sdkAvailable?'请在系统设置中允许 B站 使用相机，并在 B站 的摄像头授权提示中确认，再点“重新开启手势”。':'请在地址栏的网站权限、手机系统的浏览器相机权限中允许访问，再点“重新开启手势”。';}
          }
          else if(code==='NotFoundError'||code==='DevicesNotFoundError'){title='没有找到可用摄像头';detail='请确认设备有可用相机，或解除相机禁用后重试。';}
          else if(code==='NotReadableError'||code==='TrackStartError'||code==='AbortError'){title='摄像头被占用或暂时无法启动';detail='请关闭正在使用相机的应用、网页或通话，然后重试；必要时重新打开浏览器。';}
          else if(code==='OverconstrainedError'){title='摄像头参数不受支持';detail='已尝试普通视频模式。请换用系统浏览器或确认相机可用后重试。';}
          else if(code==='VIDEO_TIMEOUT'){title='摄像头尚未输出画面';detail='请恢复摄像头窗口、检查相机权限和占用情况，再重新开启手势。';}
          else if(code==='CAMERA_ENDED'){title='摄像头已被系统停止';detail='切回游戏后，点“重新开启手势”重新连接相机。';}
          else if(code==='LOCAL_ASSET'||stage==='assets'){code='LOCAL_ASSET';title='手势识别资源加载失败';detail=location.protocol==='file:'?'请从 B站 Toy 页面开启手势控制，或使用本地预览服务。':'游戏包和备用地址中的识别资源均未能读取，请检查网络后重试。详细错误中可查看失败网址。';}
          else if(stage==='model'||stage==='inference'){code=stage==='model'?'MODEL_INIT':'MODEL_INFERENCE';title='识别组件初始化或运行失败';detail='已启用兼容处理。请重试或更换系统浏览器；若预览限制了识别组件，请使用游戏的 HTTPS 网页。';}
          return{code,title,detail};
        }
        function reportCameraFailure(error,stage,serial){
          if(serial!==handSessionSerial)return false;
          const issue=explainCameraError(error,stage);cameraDiagnostic.code=issue.code;cameraDiagnostic.technical='['+stage+'] '+(error.name||'Error')+': '+(error.message||String(error));
          ++handSessionSerial;stopCameraCapture();resetMouseControl();syncRenderPerformance();
          setCameraStatus('error',issue.title,issue.detail,issue.title+' · 点此检测');
          console.warn('Hand tracking:',stage,issue.code,error);return false;
        }
        // Original MediaPipe assets, stored in their native binary formats.
        const HAND_ASSET_PATHS=Object.freeze({
          'hand-wasm-simd':'./assets/hand/vision_wasm_internal.wasm',
          'hand-wasm-basic':'./assets/hand/vision_wasm_nosimd_internal.wasm',
          'hand-model-data':'./assets/hand/hand_landmarker.bin'
        });
        const HAND_ASSET_LINKS=Object.freeze({
          'hand-wasm-simd':'hand-wasm-simd-resource',
          'hand-wasm-basic':'hand-wasm-basic-resource',
          'hand-model-data':'hand-model-resource'
        });
        const HAND_ASSET_INTEGRITY=Object.freeze({
          'hand-wasm-simd':{size:9207793,sha256:'e3945f005e918f1176335b045fb7747eac1856579b077e7c3da5167b42d8a008'},
          'hand-wasm-basic':{size:9074428,sha256:'d832736bedf673d506454a54162bb9330daf149194691997485d8e46aed48f45'},
          'hand-model-data':{size:7819105,sha256:'fbc2a30080c3c557093b5ddfc334698132eb341044ccee322ccf8bcf3607cde1'}
        });
        const HAND_ASSET_FALLBACKS=Object.freeze({
          'hand-wasm-simd':[
            'https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@0.10.9/wasm/vision_wasm_internal.wasm',
            'https://unpkg.com/@mediapipe/tasks-vision@0.10.9/wasm/vision_wasm_internal.wasm'],
          'hand-wasm-basic':[
            'https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@0.10.9/wasm/vision_wasm_nosimd_internal.wasm',
            'https://unpkg.com/@mediapipe/tasks-vision@0.10.9/wasm/vision_wasm_nosimd_internal.wasm'],
          'hand-model-data':[
            'https://storage.googleapis.com/mediapipe-models/hand_landmarker/hand_landmarker/float16/1/hand_landmarker.task']
        });
        async function readHandAsset(url,id,remote,retry){
          const controller=new AbortController();
          const timer=setTimeout(()=>controller.abort(),remote?25000:8000);
          try{
            const response=await fetch(url,{credentials:remote?'omit':'same-origin',signal:controller.signal,cache:retry?'reload':'default'});
            if(!response.ok)throw new Error('HTTP '+response.status);
            const bytes=new Uint8Array(await response.arrayBuffer());
            const expected=HAND_ASSET_INTEGRITY[id];
            if(bytes.length!==expected.size)throw new Error('Resource size mismatch: '+bytes.length);
            if(!window.crypto?.subtle)throw new Error('Resource integrity check requires a secure context');
            const digest=new Uint8Array(await window.crypto.subtle.digest('SHA-256',bytes));
            const hash=Array.from(digest,b=>b.toString(16).padStart(2,'0')).join('');
            if(hash!==expected.sha256)throw new Error('Resource SHA-256 mismatch');
            return{bytes,url};
          }finally{clearTimeout(timer);}
        }
        async function loadHandAsset(id){
          const relative=HAND_ASSET_PATHS[id];
          if(!relative)throw new Error('Unknown hand asset: '+id);
          const urls=[];
          const add=url=>{if(!urls.includes(url))urls.push(url);};
          // Read the HTML reference first: Toy can rewrite it to a hosted asset URL.
          // A srcdoc document's baseURI can point at the host page, not the game ZIP.
          const link=document.getElementById(HAND_ASSET_LINKS[id]);
          if(link?.getAttribute('href'))add(link.href);
          if(id==='hand-model-data'){
            const binaryLink=document.getElementById('hand-model-binary-resource');
            if(binaryLink?.getAttribute('href'))add(binaryLink.href);
          }
          const appSource=document.getElementById('qingyuan-app')?.src;
          if(appSource&&/^https?:/.test(appSource)){
            const appURL=new URL(appSource);
            if(/\/assets\/js\/[^/]+$/.test(appURL.pathname)){
              add(new URL(relative,new URL('../../',appURL)).href);
              if(id==='hand-model-data')add(new URL('./assets/hand/hand_landmarker.bin',new URL('../../',appURL)).href);
            }
          }
          add(new URL(relative,document.baseURI).href);
          if(id==='hand-model-data')add(new URL('./assets/hand/hand_landmarker.bin',document.baseURI).href);
          const localCount=urls.length;
          for(const url of HAND_ASSET_FALLBACKS[id])add(url);
          const failures=[];
          for(const [index,url] of urls.entries()){
            if(!/^https?:/.test(url)){failures.push('Unsupported resource URL: '+url);continue;}
            const remote=index>=localCount;
            for(let attempt=0;attempt<(remote?1:2);attempt++){
              try{
                if(attempt)await new Promise(resolve=>setTimeout(resolve,300));
                return await readHandAsset(url,id,remote,attempt>0);
              }catch(error){
                if(attempt===(remote?0:1))failures.push(url+' ('+(error.message||String(error))+')');
              }
            }
          }
          throw cameraError('LOCAL_ASSET','Hand asset request failed: '+id+'; '+failures.join('; '));
        }
        function loadLocalHandAssets(){
          if(handAssetsPromise)return handAssetsPromise;
          const work=(async()=>{
            const simd=await window.QingyuanVision.FilesetResolver.isSimdSupported();
            const [wasm,model]=await Promise.all([loadHandAsset(simd?'hand-wasm-simd':'hand-wasm-basic'),loadHandAsset('hand-model-data')]);
            return{wasm:wasm.bytes,model:model.bytes,simd,wasmPath:wasm.url};
          })();
          handAssetsPromise=work;work.catch(()=>{if(handAssetsPromise===work)handAssetsPromise=null;});return work;
        }
        async function buildLocalHandLandmarker(delegate,assets){
          // MediaPipe 0.10.9 receives binary buffers loaded from this Toy's assets.
          // Camera frames stay in the local recognition pipeline.
          window.ModuleFactory=assets.simd?window.QingyuanHandWasmSIMD:window.QingyuanHandWasmBasic;
          window.Module={wasmBinary:assets.wasm};
          return window.QingyuanVision.HandLandmarker.createFromOptions({wasmLoaderPath:'',wasmBinaryPath:new URL(assets.wasmPath,document.baseURI).href},{
            baseOptions:{modelAssetBuffer:assets.model,delegate},canvas:document.createElement('canvas'),runningMode:'VIDEO',numHands:1,
            minHandDetectionConfidence:.5,minHandPresenceConfidence:.5,minTrackingConfidence:.5
          });
        }
        function loadHandLandmarker(){
          if(handLandmarker)return Promise.resolve(handLandmarker);
          if(handModelBuildPromise)return handModelBuildPromise;
          const work=(async()=>{
            const assets=await loadLocalHandAssets();let model;
            const delegates=isMobile||forceHandCPU?['CPU']:['GPU','CPU'];
            for(const delegate of delegates){
              try{model=await buildLocalHandLandmarker(delegate,assets);handDelegate=delegate;break;}
              catch(error){if(delegate===delegates.at(-1))throw error;console.warn('Hand GPU unavailable, trying CPU:',error);}
            }
            handLandmarker=model;return model;
          })();
          handModelBuildPromise=work;work.finally(()=>{if(handModelBuildPromise===work)handModelBuildPromise=null;}).catch(()=>{});return work;
        }
        function waitForCameraFrame(){
          if(videoEl.readyState>=2&&videoEl.videoWidth>0)return Promise.resolve();
          return new Promise((resolve,reject)=>{
            const cleanup=()=>{clearTimeout(timer);videoEl.removeEventListener('loadeddata',ready);videoEl.removeEventListener('canplay',ready);};
            const ready=()=>{if(videoEl.readyState>=2&&videoEl.videoWidth>0){cleanup();resolve();}};
            const timer=setTimeout(()=>{cleanup();reject(cameraError('VIDEO_TIMEOUT','No camera frame received.'));},10000);
            videoEl.addEventListener('loadeddata',ready);videoEl.addEventListener('canplay',ready);
          });
        }
        function ensureHandTracking(){
          if(handTrackingInitPromise)return handTrackingInitPromise;
          const serial=++handSessionSerial;
          const work=(async()=>{
            let stage='camera',permissionNotice;
            try{
              cameraDiagnostic.code='';cameraDiagnostic.technical='';
              setCameraStatus('camera','正在申请摄像头权限',toyBridge.sdkAvailable?'请确认 B站 的摄像头使用授权，并允许系统相机权限。可切回触控取消。':'请在浏览器弹窗中选择允许。可切回触控取消。');
              permissionNotice=setTimeout(()=>{if(serial===handSessionSerial)setCameraStatus('camera','等待摄像头授权','请检查 B站 或浏览器的摄像头授权弹窗；可点摄像头状态查看排障步骤。');},15000);
              const stream=await toyBridge.requestCamera(cameraVideoConstraints());
              clearTimeout(permissionNotice);
              if(serial!==handSessionSerial){void toyBridge.stopMedia(stream);return false;}
              cameraStream=stream;videoEl.muted=true;videoEl.playsInline=true;videoEl.setAttribute('playsinline','');videoEl.srcObject=stream;
              if(appStage.classList.contains('mobile-layout'))setUiWindowVisible('camera-window',true);
              for(const track of stream.getVideoTracks())track.addEventListener('ended',()=>{if(serial===handSessionSerial)reportCameraFailure(cameraError('CAMERA_ENDED','Camera track ended.'),'camera',serial);});
              stage='video';await videoEl.play();await waitForCameraFrame();syncCameraOrientation();renderCameraFrame();
              if(serial!==handSessionSerial)return false;
              stage='assets';setCameraStatus('model','摄像头已开启，正在准备识别','优先读取游戏包内的组件，缺失时尝试备用下载；首次准备可能需要一些时间。');
              await loadLocalHandAssets();if(serial!==handSessionSerial)return false;
              stage='model';await loadHandLandmarker();if(serial!==handSessionSerial)return false;
              lastVideoTime=-1;lastHandInference=0;gestureWindow.length=0;smoothedHandScreen.initialized=false;
              toggleControlBtn.textContent='关闭手势控制';
              setCameraStatus('ready','摄像头与手势识别已就绪','请将一只完整手掌放在镜头前，并保持手形片刻。','手势已开启 · 点此查看状态');
              return true;
            }catch(error){clearTimeout(permissionNotice);return reportCameraFailure(error,stage,serial);}
          })();
          handTrackingInitPromise=work;work.finally(()=>{if(handTrackingInitPromise===work)handTrackingInitPromise=null;}).catch(()=>{});return work;
        }
        async function startHandTracking(){
          if(!unlocks.require('hand'))return false;
          STATE.controlMode='HAND';STATE.isTracking=false;toggleControlBtn.textContent='取消手势连接';trackingLabelEl.textContent='神识感应 · 正在连接...';
          syncRenderPerformance();
          return ensureHandTracking();
        }
        toggleControlBtn.addEventListener('click',()=>{
          if(STATE.controlMode==='HAND'){stopHandTracking();syncModeFromKeys();}else void startHandTracking();
        });
        document.addEventListener('visibilitychange',()=>{if(document.hidden&&(cameraStream||STATE.controlMode==='HAND'))stopHandTracking('页面切到后台，摄像头已停止。返回后可重新开启手势。');});
        window.addEventListener('pagehide',()=>stopHandTracking());
        async function recoverHandInference(error){
          if(handRecovering)return;const serial=handSessionSerial;
          if(handDelegate!=='GPU'){
            try{handLandmarker?.close();}catch(_){}handLandmarker=null;handModelBuildPromise=null;
            reportCameraFailure(error,'inference',serial);return;
          }
          handRecovering=true;forceHandCPU=true;try{handLandmarker?.close();}catch(_){}handLandmarker=null;
          setCameraStatus('model','正在切换兼容识别模式','画面会继续运行，请保持手掌在镜头前。');
          try{await loadHandLandmarker();if(serial===handSessionSerial)setCameraStatus('ready','兼容识别模式已就绪','请将完整手掌放到镜头前。');}
          catch(next){reportCameraFailure(next,'inference',serial);}finally{handRecovering=false;}
        }


        // 优化后的精准手势识别算法（含巨剑术八字诀手势识别）
        function classifyHandGesture(lm) {
          const dist2D = (a, b) => Math.hypot(a.x - b.x, a.y - b.y);
          const dist3DWeighted = (a, b) => Math.hypot(a.x - b.x, a.y - b.y, (a.z - b.z) * 0.4);
          const getAngle = (p1, p2, p3) => {
            const v1x = p1.x - p2.x, v1y = p1.y - p2.y, v1z = (p1.z - p2.z) * 0.45;
            const v2x = p3.x - p2.x, v2y = p3.y - p2.y, v2z = (p3.z - p2.z) * 0.45;
            const dot = v1x * v2x + v1y * v2y + v1z * v2z;
            const m1 = Math.hypot(v1x, v1y, v1z);
            const m2 = Math.hypot(v2x, v2y, v2z);
            return (Math.acos(THREE.MathUtils.clamp(dot / (m1 * m2 + 1e-6), -1, 1)) * 180) / Math.PI;
          };

          const wrist = lm[0];
          const palmSize = Math.max(0.05, dist2D(wrist, lm[9]));

          const isExtended = [false, false, false, false, false];
          const isCurled = [false, false, false, false, false];

          const thumbAngle = getAngle(lm[1], lm[2], lm[4]);
          const thumbToPinkyMcp = dist2D(lm[4], lm[17]) / palmSize;
          const thumbToIndexMcp = dist2D(lm[4], lm[5]) / palmSize;
          const thumbToIndexPip = dist2D(lm[4], lm[6]) / palmSize;
          isExtended[0] = thumbAngle > 136 && thumbToPinkyMcp > 0.98 && (thumbToIndexMcp > 0.50 || thumbToIndexPip > 0.68);
          isCurled[0] = (thumbToIndexMcp < 0.42 && thumbToIndexPip < 0.55) || thumbAngle < 124;

          for (let idx = 1; idx <= 4; idx++) {
            const mcp = lm[idx * 4 + 1], pip = lm[idx * 4 + 2], dip = lm[idx * 4 + 3], tip = lm[idx * 4 + 4];
            const pipAngle = getAngle(mcp, pip, dip);
            const fullAngle = getAngle(mcp, pip, tip);
            const dTip = dist3DWeighted(tip, wrist), dPip = dist3DWeighted(pip, wrist), dMcp = dist3DWeighted(mcp, wrist);
            isExtended[idx] = fullAngle > 138 && pipAngle > 135 && dTip > dPip * 1.08 && dTip > dMcp * 1.22;
            isCurled[idx] = fullAngle < 122 || dTip < dPip * 1.02;
          }

          const [thumb, index, middle, ring, pinky] = isExtended;
          const mainExtendedCount = (index ? 1 : 0) + (middle ? 1 : 0) + (ring ? 1 : 0) + (pinky ? 1 : 0);
          const curledMainCount = (isCurled[1] ? 1 : 0) + (isCurled[2] ? 1 : 0) + (isCurled[3] ? 1 : 0) + (isCurled[4] ? 1 : 0);
          const pinchDist = dist2D(lm[4], lm[8]) / palmSize;
          const isOkSeal = pinchDist < 0.36 && middle && ring && pinky;

          // 1. 大庚剑阵：食指+小指结印 或 OK手势
          if ((index && pinky && !middle && !ring) || isOkSeal) {
            return 'DAGENG';
          }

          // 2. 巨剑术：参照图片手势（大拇指与食指伸直张开呈 L 型/八字诀，其余三指收拢）
          const isThumbIndexL = thumb && index && !middle && !ring && !pinky && (isCurled[2] || isCurled[3]) && thumbToIndexPip > 0.65;
          if (isThumbIndexL) {
            return 'GIANT';
          }

          // 3. 剑影分光：食指+中指并拢剑指，或收起大拇指单食指
          if ((index && middle && !ring && !pinky) || (!thumb && index && !middle && !ring && !pinky && (isCurled[3] || isCurled[4]))) {
            return 'DRAGON';
          }

          // 4. 青元剑盾：握拳（四指收拢）
          if (mainExtendedCount === 0 && curledMainCount >= 3) {
            return 'SHIELD';
          }

          // 5. 莲花剑阵：五指张开
          if (mainExtendedCount === 4) {
            return 'LOTUS';
          }

          return null;
        }

        const HAND_CONNECTIONS = [
          [0, 1], [1, 2], [2, 3], [3, 4],
          [0, 5], [5, 6], [6, 7], [7, 8],
          [5, 9], [9, 10], [10, 11], [11, 12],
          [9, 13], [13, 14], [14, 15], [15, 16],
          [13, 17], [17, 18], [18, 19], [19, 20], [0, 17],
        ];

        function drawHandSkeleton(lm, modeColor) {
          const w = webcamCanvas.width, h = webcamCanvas.height;
          webcamCtx.clearRect(0, 0, w, h);
          webcamCtx.strokeStyle = modeColor || '#00ffa2';
          const drawScale=w/(cameraPresentation.layout?.cssWidth||164);
          webcamCtx.lineWidth = 1.4*drawScale;
          webcamCtx.beginPath();
          for (const [a, b] of HAND_CONNECTIONS) {
            webcamCtx.moveTo(lm[a].x * w, lm[a].y * h);
            webcamCtx.lineTo(lm[b].x * w, lm[b].y * h);
          }
          webcamCtx.stroke();
          webcamCtx.fillStyle = '#fff6cc';
          for (let i = 0; i < lm.length; i++) {
            webcamCtx.beginPath();
            webcamCtx.arc(lm[i].x * w, lm[i].y * h, (i % 4 === 0 ? 2.6 : 1.8)*drawScale, 0, Math.PI * 2);
            webcamCtx.fill();
          }
        }

        let lastVideoTime = -1;
        function pollHandTracking() {
          const frame=renderCameraFrame();
          if(!frame||touchNavigation.pinching||touchNavigation.suppressSingle||STATE.controlMode!=='HAND'||!handLandmarker||videoEl.readyState<2||handRecovering||cameraDiagnostic.stage!=='ready'||isInteractionOverlayOpen())return;
          const stamp=performance.now();
          const handInterval=handPerformanceMode?(handDelegate==='CPU'?80:55):(handDelegate==='CPU'?50:33);
          if(stamp-lastHandInference<handInterval)return;
          lastHandInference=stamp;
          if (videoEl.currentTime === lastVideoTime) return;
          lastVideoTime = videoEl.currentTime;

          let res;
          try{res=handLandmarker.detectForVideo(frame,stamp);}catch(error){void recoverHandInference(error);return;}
          if (res.landmarks && res.landmarks.length > 0) {
            STATE.isTracking = true;
            const inputLandmarks=res.landmarks[0];
            const lm=cameraPreviewLandmarks(inputLandmarks,cameraPresentation.layout);
            const aspect=frame.width/frame.height;
            const metricLandmarks=inputLandmarks.map(p=>({x:p.x*aspect,y:p.y,z:(p.z||0)*aspect}));
            let rawGesture = classifyHandGesture(metricLandmarks);
            // 当处于剑指手势时，根据当前剑指绑定模式（神雷化形 或 剑影分光）操控
            if (rawGesture === 'DRAGON' && STATE.swordFingerMode === 'THUNDER_DRAGON' && STATE.lightningEnabled) {
              rawGesture = 'THUNDER_DRAGON';
            }
            if (rawGesture) {
              gestureWindow.push(rawGesture);
              if (gestureWindow.length > GESTURE_WINDOW_SIZE) gestureWindow.shift();
              const counts = {}; let bestGesture = STATE.gestureMode; let maxVotes = 0;
              for (const g of gestureWindow) {
                counts[g] = (counts[g] || 0) + 1;
                if (counts[g] > maxVotes) { maxVotes = counts[g]; bestGesture = g; }
              }
              if (maxVotes >= 3 && bestGesture !== STATE.gestureMode) {
                if (bestGesture !== 'THUNDER_DRAGON') STATE.manualPinnedMode = null;
                setFormationMode(bestGesture);
              }
            }
            const activeMeta = FORMATION_META[STATE.gestureMode] || FORMATION_META.DRAGON;
            drawHandSkeleton(lm, activeMeta.color);
            trackingLabelEl.textContent = '神识锁定 · 人剑合一';
            webcamStatusEl.textContent = `神识已锁：${activeMeta.title}`;

            let normX, normY;
            if (STATE.gestureMode === 'DRAGON' || STATE.gestureMode === 'THUNDER_DRAGON') {
              normX = lm[8].x * 0.7 + lm[12].x * 0.3;
              normY = lm[8].y * 0.7 + lm[12].y * 0.3;
            } else {
              normX = (lm[0].x + lm[5].x + lm[9].x + lm[17].x) * 0.25;
              normY = (lm[0].y + lm[5].y + lm[9].y + lm[17].y) * 0.25;
            }
            const expandedX = THREE.MathUtils.clamp((normX - 0.5) * 1.55 + 0.5, 0, 1);
            const expandedY = THREE.MathUtils.clamp((normY - 0.5) * 1.55 + 0.5, 0, 1);
            const rawX = expandedX * APP_VIEW.width;
            const rawY = expandedY * APP_VIEW.height;

            if (!smoothedHandScreen.initialized) {
              smoothedHandScreen.x = rawX; smoothedHandScreen.y = rawY; smoothedHandScreen.initialized = true;
            } else {
              const moveDelta = Math.hypot(rawX - smoothedHandScreen.x, rawY - smoothedHandScreen.y);
              const alpha = THREE.MathUtils.clamp(0.18 + (moveDelta / 120) * 0.45, 0.18, 0.68);
              smoothedHandScreen.x = THREE.MathUtils.lerp(smoothedHandScreen.x, rawX, alpha);
              smoothedHandScreen.y = THREE.MathUtils.lerp(smoothedHandScreen.y, rawY, alpha);
            }
            updateTargetFromLocalXY(smoothedHandScreen.x, smoothedHandScreen.y);
          } else {
            STATE.isTracking = false;
            gestureWindow.length = 0;
            smoothedHandScreen.initialized = false;
            webcamCtx.clearRect(0, 0, webcamCanvas.width, webcamCanvas.height);
            trackingLabelEl.textContent = '神识感应 · 请于阵前挥手';
            webcamStatusEl.textContent = '未检测到手掌 · 请将手置于镜头前';
          }
        }

        await startup?.step(90,'正在准备招式与操控…');
        let startupFramePresented=false;
        const clock = new THREE.Clock();
        const dummy = new THREE.Object3D();
        const defaultUp = new THREE.Vector3(0, 1, 0);
        const smoothCamPos = new THREE.Vector3(0, 6, 68);
        const smoothLookAt = new THREE.Vector3(0, 0, 0);
        const smoothTarget = new THREE.Vector3(0, 0, 0);
        const dagengAnchorTarget = new THREE.Vector3(0, 0, 0);
        let smoothZoom = 66;
        let lastBaseViewDistance = 66;
        let magicCircleOpacity = 0;
        let lotusDiscOpacity = 0;
        let lotusFormationProgress = 0;

        function animate(frameNow=performance.now()) {
          requestAnimationFrame(animate);
          if(performanceMode){
            const minFrameInterval=handPerformanceMode?1000/30:1000/45;
            if(frameNow-lastPerformanceFrameTime<minFrameInterval)return;
            lastPerformanceFrameTime=frameNow;
          }

          // 帧率独立的时间间隔计算，彻底解决高刷屏下飞剑飞行过快的问题
          const rawDelta = clock.getDelta();
          const delta = Math.min(rawDelta, 0.05);
          if(STATE.inspectMode){inspectionPausedTime+=rawDelta;renderInspection(clock.elapsedTime,delta);return;}
          const time=clock.elapsedTime-inspectionPausedTime;
          const dtRatio = delta * 60;
          const damp = (alphaAt60) => 1 - Math.pow(1 - alphaAt60, dtRatio);

          pollHandTracking();
          updateLookControl(delta);
          updateFlightNavigation(delta);

          shadowUniforms.uTime.value = time;
          shadowUniforms.uTransparency.value=STATE.lightTransparency;
          shadowUniforms.uOpacityBoost.value = STATE.gestureMode === 'LOTUS' ? 1.50 + Math.sin(time * 2.7) * 0.10 : 0.95 + Math.sin(time * 6.0) * 0.12;
          shadowUniforms.uLightning.value = STATE.lightningEnabled ? 1.0 : 0.0;
          swordLightningUniforms.uTime.value = time;
          const boltPixelRatio=renderer.getPixelRatio();
          swordLightningUniforms.uPixelRatio.value=boltPixelRatio;
          swordLightningUniforms.uResolution.value.set(APP_VIEW.width*boltPixelRatio,APP_VIEW.height*boltPixelRatio);
          swordLightningUniforms.uSplit.value=STATE.splitEnabled?1:0;
          const targetLightningDensity=electricDensity();
          swordLightningUniforms.uDensity.value=targetLightningDensity===0?0:
            THREE.MathUtils.lerp(swordLightningUniforms.uDensity.value,targetLightningDensity,damp(.14));
          swordLightningUniforms.uGiant.value=STATE.gestureMode==='GIANT'?1:0;
          swordLightningUniforms.uStrength.value=STATE.lightningEnabled?(STATE.gestureMode==='DAGENG'?1.35:1.08):0;
          swordLightningGeo.setDrawRange(0,STATE.lightningAmount>0?swordLightningGeo.attributes.position.count:0);
          const electricStatus=STATE.lightningEnabled?'雷电已开启 · 数值越高越炸裂':'雷电已关闭 · 金色剑丝仍运转';
          if(document.getElementById('fx-status').textContent!==electricStatus)document.getElementById('fx-status').textContent=electricStatus;
          bladeMat.emissiveIntensity = STATE.lightningEnabled ? .045 + Math.sin(time*3.0)*.008 : .025;
          skyUniforms.uTime.value = time;
          waterUniforms.uTime.value = time;
          cloudSeaUniforms.uTime.value = time;
          mountainUniforms.uTime.value = time;

          starField.rotation.y = time * 0.003;
          const spArr = spiritGeo.attributes.position.array;
          for (let i = 0; i < spiritCount; i++) {
            spArr[i * 3 + 1] += Math.sin(time + i) * 0.015 * dtRatio;
            if (spArr[i * 3 + 1] > 45) spArr[i * 3 + 1] = -45;
          }
          spiritGeo.attributes.position.needsUpdate = true;

          if (STATE.gestureMode !== STATE.lastMode) {
            const previousMode=STATE.lastMode;
            STATE.lastMode = STATE.gestureMode;
            swordAudio.formation(STATE.gestureMode,previousMode);
            STATE.modeStartTime = time;
            if(STATE.gestureMode==='LOTUS'){
              // 起点来自上一帧；首帧也推进一个时间步，避免切招时丢失一帧位移。
              STATE.modeStartTime-=delta;
              swordPositions.forEach((position,index)=>{
                lotusEntryPositions[index].copy(position);
                lotusEntryVelocities[index].copy(swordVelocities[index]);
                lotusEntryScales[index]=swordScales[index];
              });
              lotusEntryCaptured=true;
              lotusFormationProgress=0;
              lotusDiscOpacity=0;
              lotusDiscUniforms.uDeploy.value=0;
            }else if(previousMode==='LOTUS'){
              lotusEntryCaptured=false;
            }
            if(STATE.gestureMode==='GIANT'){
              STATE.modeStartTime-=delta;
              swordPositions.forEach((position,index)=>{
                giantEntryPositions[index].copy(position);
                giantEntryVelocities[index].copy(swordVelocities[index]);
                giantEntryScales[index]=swordScales[index];
                const mesh=index<CONFIG.mainSwordCount?bladeInstanced:shadowInstanced;
                mesh.getMatrixAt(index<CONFIG.mainSwordCount?index:index-CONFIG.mainSwordCount,giantEntryMatrix);
                if(swordScales[index]>.00001)giantEntryMatrix.decompose(giantEntryPosition,giantEntryRotations[index],giantEntryScale);
                else giantEntryRotations[index].identity();
              });
            }
            if(isFollowingFormation(STATE.gestureMode)){
              projectPointerToWorld();
              dagengAnchorTarget.copy(STATE.targetPosition);
            }
          }
          const modeTime = time - STATE.modeStartTime;

          // 先更新相机位置与朝向矩阵，确保随后鼠标射线投射出的 3D 世界坐标与当前屏幕光标零误差对齐
          const isDageng=STATE.gestureMode==='DAGENG',isGiantCamera=STATE.gestureMode==='GIANT',isLotusCamera=STATE.gestureMode==='LOTUS',isGrandCast=isDageng||isGiantCamera,isLargeFormation=isGrandCast||isLotusCamera;
          const giantFraming=isGiantCamera?smoothstep(.18,GIANT_ASSEMBLY_END,modeTime):0;
          const targetFogDensity = isDageng ? 0.00060 : 0.0011;
          scene.fog.density = THREE.MathUtils.lerp(scene.fog.density, targetFogDensity, damp(0.04));

          const roamRangeX = isDageng ? 156 : 112;
          const roamRangeY = isDageng ? 72 : 52;
          const roamTargetX = STATE.isTracking&&!STATE.look.centered ? STATE.pointerNDC.x * roamRangeX : 0;
          const roamTargetY = STATE.isTracking&&!STATE.look.centered ? STATE.pointerNDC.y * roamRangeY : 0;
          const isDragonCamera=STATE.gestureMode==='THUNDER_DRAGON';
          viewInverse.copy(viewRotation).invert();
          viewLocalAim.copy(STATE.targetPosition).sub(STATE.flight.offset).sub(viewOrigin).applyQuaternion(viewInverse);
          // Aim holds the current view. Tracking loss reframes the last valid
          // world position instead of sending the camera back to the origin.
          const cameraAnchor=isDragonCamera&&STATE.breathHeld?smoothTarget
            :!STATE.isTracking?new THREE.Vector3(viewLocalAim.x/(isLargeFormation?1:1.15),viewLocalAim.y,0)
            :new THREE.Vector3(roamTargetX,roamTargetY,0);
          smoothTarget.lerp(cameraAnchor,damp(isDageng?.08:.085));

          let dagengCamZoom = 116;
          let dagengCamY = smoothTarget.y + 2.0;
          let dagengLookY = smoothTarget.y + 2.5;
          let camShakeX = 0;
          let camShakeY = 0;

          if (isDageng) {
            if (modeTime < 0.65) {
              const p1 = modeTime / 0.65;
              const easeP1 = p1 * p1 * (3 - 2 * p1);
              dagengCamZoom = THREE.MathUtils.lerp(78, 112, easeP1);
              dagengCamY = THREE.MathUtils.lerp(smoothTarget.y-8,smoothTarget.y-14,easeP1);
              dagengLookY = THREE.MathUtils.lerp(smoothTarget.y+10,smoothTarget.y+38,easeP1);
            } else {
              const pullOutProgress = THREE.MathUtils.clamp((modeTime - 0.65) / 3.2, 0, 1);
              const easePullOut = 1 - Math.pow(1 - pullOutProgress, 3);
              dagengCamZoom=THREE.MathUtils.lerp(112,isMobile?Math.max(430,350/camera.aspect):400,easePullOut);
              dagengCamY=THREE.MathUtils.lerp(smoothTarget.y-14,smoothTarget.y-35,easePullOut);
              dagengLookY=THREE.MathUtils.lerp(smoothTarget.y+38,smoothTarget.y+55,easePullOut);
              if (modeTime < 2.2) {
                const shakeDecay = Math.exp(-(modeTime - 0.65) * 6.5);
                camShakeX = Math.sin(time * 65.0) * 0.6 * shakeDecay;
                camShakeY = Math.cos(time * 58.0) * 0.6 * shakeDecay;
              }
            }
          }

          let closeUpZoom = 64;
          if (STATE.gestureMode === 'SHIELD') closeUpZoom = 72;
          else if(isLotusCamera)closeUpZoom=isMobile?Math.max(104,102/camera.aspect):104;
          else if(isGiantCamera)closeUpZoom=THREE.MathUtils.lerp(68,isMobile?Math.max(112+electricDensity()*22,180/camera.aspect):112+electricDensity()*22,giantFraming);
          else if(STATE.gestureMode==='THUNDER_DRAGON')closeUpZoom=THREE.MathUtils.lerp(72,64,STATE.stationaryWeight)+Math.max(0,electricDensity()-1)*6;
          else closeUpZoom = THREE.MathUtils.lerp(68, 54, STATE.stationaryWeight);

          const desiredFov=isDageng?62:66;
          if(Math.abs(camera.fov-desiredFov)>.01){camera.fov=THREE.MathUtils.lerp(camera.fov,desiredFov,damp(.07));camera.updateProjectionMatrix();}
          const baseZoom = isDageng ? dagengCamZoom : closeUpZoom;
          // Dolly the entire camera offset, including its elevated angle.
          // Scaling only camera.z left the oblique formations impossible to inspect.
          const zoomLerpSpeed=damp(.13);
          const desiredLookAt=new THREE.Vector3(isLargeFormation?smoothTarget.x:smoothTarget.x*1.15,
            isDageng?dagengLookY:isGiantCamera?smoothTarget.y-15*giantFraming:smoothTarget.y,isDageng?-125:0);
          const viewOffset=new THREE.Vector3((isLargeFormation?smoothTarget.x:smoothTarget.x*.92)+camShakeX,
            (isDageng?dagengCamY:isGiantCamera?smoothTarget.y+THREE.MathUtils.lerp(3,-8,giantFraming):isLotusCamera?smoothTarget.y+2:smoothTarget.y*.85+3)+camShakeY,baseZoom).sub(desiredLookAt);
          lastBaseViewDistance=viewOffset.length();
          const finalDistance=THREE.MathUtils.clamp(lastBaseViewDistance*STATE.zoomFactor,.85,1800);
          smoothZoom=THREE.MathUtils.lerp(smoothZoom,finalDistance,zoomLerpSpeed);
          const desiredCamPos=desiredLookAt.clone().addScaledVector(viewOffset.normalize(),smoothZoom);
          // The camera rig and aiming plane share the same XYZ translation.
          // Local zoom/formation framing remains independent of world travel.
          smoothCamPos.lerp(desiredCamPos,zoomLerpSpeed);
          smoothLookAt.lerp(desiredLookAt,zoomLerpSpeed);applyLookCamera();
          skyDome.position.copy(STATE.flight.offset);starField.position.copy(STATE.flight.offset);
          moonGroup.position.copy(moonFlightBase).add(STATE.flight.offset);
          jadePointLight.position.copy(jadeFlightBase).add(STATE.flight.offset);


          let currentTarget = STATE.targetPosition;
          if (!STATE.isTracking) {
            currentTarget = getUntrackedTarget();
          } else {
            projectPointerToWorld();
            if(isLargeFormation){
              // Both mouse and hand updates continuously move the entire cast.
              dagengAnchorTarget.lerp(STATE.targetPosition,damp(.24));
              currentTarget=dagengAnchorTarget;
            } else {
              currentTarget=STATE.breathHeld&&STATE.gestureMode==='THUNDER_DRAGON'?dragonBreathAnchor:STATE.targetPosition;
            }
          }
          dagengFieldCenter.copy(currentTarget);
          dagengFieldCenter.y-=DAGENG_LAYOUT.aimLift;dagengFieldCenter.z+=DAGENG_LAYOUT.centerDepth;


          // 真实键盘位移也会唤醒剑流；相机平滑本身不计入输入速度。
          const ndcDeltaX = STATE.pointerNDC.x - STATE.prevPointerNDC.x;
          const ndcDeltaY = STATE.pointerNDC.y - STATE.prevPointerNDC.y;
          const ndcDist=STATE.breathHeld&&STATE.gestureMode==='THUNDER_DRAGON'?0:Math.hypot(ndcDeltaX,ndcDeltaY);
          STATE.prevPointerNDC.copy(STATE.pointerNDC);

          const moveVec = STATE.targetPosition.clone().sub(STATE.prevTargetPosition);
          STATE.prevTargetPosition.copy(STATE.targetPosition);

          const flightDistance=STATE.flight.delta.length();
          const lookDistance=STATE.look.frameAngle>0?moveVec.length():0;
          if(flightDistance>1e-5||lookDistance>1e-5){
            const direction=moveVec.lengthSq()>1e-8?moveVec:STATE.flight.delta;
            STATE.lastDirection.lerp(direction.clone().normalize(),damp(.45)).normalize();
          } else if (ndcDist > 0.0015) {
            const crossZ = STATE.lastDirection.x * ndcDeltaY - STATE.lastDirection.y * ndcDeltaX;
            if (Math.abs(crossZ) > 0.0004) {
              STATE.orbitSpinDir = crossZ >= 0 ? 1.0 : -1.0;
            }
            const dir2D = new THREE.Vector3(ndcDeltaX, ndcDeltaY, 0).normalize();
            STATE.lastDirection.lerp(dir2D, damp(0.45)).normalize();
          } else if (moveVec.lengthSq() > 0.01 && ndcDist > 0.0005) {
            STATE.lastDirection.lerp(moveVec.clone().normalize(), damp(0.35)).normalize();
          }

          const instSpeed = Math.max(ndcDist*140,flightDistance,lookDistance)/Math.max(delta,.001);
          STATE.dragonSpeed = THREE.MathUtils.lerp(STATE.dragonSpeed, instSpeed, damp(ndcDist>.0008||flightDistance>1e-5||lookDistance>1e-5?.42:.28));

          const inputEpsilon=STATE.controlMode==='MOUSE'?1e-5:.0005;
          const hasSteeringInput=ndcDist>inputEpsilon||flightDistance>1e-5||lookDistance>1e-5;
          STATE.motionIdleTime=hasSteeringInput?0:STATE.motionIdleTime+delta;
          // Mouse report rate and display refresh rate are independent. Missing
          // one report is not a stop; wait for a short, genuinely quiet interval.
          const isStationary=STATE.motionIdleTime>=.14&&STATE.dragonSpeed<1.4;
          const justStopped = isStationary && !STATE.wasStationary;
          if (!isStationary) {
            // 移动时快速积蓄飞剑惯性势能
            const speedNorm = THREE.MathUtils.clamp(STATE.dragonSpeed / 18.0, 0.25, 1.0);
            STATE.orbitEnergy = THREE.MathUtils.lerp(STATE.orbitEnergy, speedNorm, damp(0.25));
            STATE.lastMovingSpeed = THREE.MathUtils.lerp(
              STATE.lastMovingSpeed,
              THREE.MathUtils.clamp(STATE.dragonSpeed, 0.0, 72.0),
              damp(0.22)
            );
            STATE.inertiaRelease = 0.0;
          } else if (STATE.dragonStreamProgress < 0.05) {
            STATE.orbitEnergy = THREE.MathUtils.lerp(STATE.orbitEnergy, 0.35, damp(0.08));
          }

          if (justStopped) {
            // 锁存停止瞬间的方向，后面的剑先沿这条方向释放惯性，再进入原有回收轨道。
            STATE.inertiaDirection.copy(STATE.lastDirection).normalize();
            STATE.inertiaRelease = 1.0;
          } else if (isStationary) {
            STATE.inertiaRelease = Math.max(0.0, STATE.inertiaRelease - delta * 1.8);
          }
          STATE.wasStationary = isStationary;
          if(!STATE.breathHeld&&STATE.gestureMode!=='DAGENG'&&STATE.gestureMode!=='GIANT')pushPathPoint(currentTarget,dtRatio);
          updatePathChain(currentTarget,dtRatio,!isStationary);

          // 移动时瞬间唤醒剑流响应，停下时进入“惯性飞过头 -> 盘旋环绕 -> 万剑归一”三段式收束
          STATE.stationaryWeight = THREE.MathUtils.lerp(
            STATE.stationaryWeight,
            isStationary ? 1.0 : 0.0,
            damp(isStationary ? 0.14 : 0.45)
          );
          const retainMainStream = STATE.gestureMode === 'DRAGON'
            && !STATE.splitEnabled
            && STATE.retainMainSwordsWhenSplitOff;
          const targetStreamProgress = retainMainStream ? 1.0 : (isStationary || !STATE.splitEnabled ? 0.0 : 1.0);
          const streamTransitionSpeed = isStationary ? 0.46 : 4.2;
          STATE.dragonStreamProgress = THREE.MathUtils.clamp(
            STATE.dragonStreamProgress + (targetStreamProgress - STATE.dragonStreamProgress) * delta * streamTransitionSpeed * 2.0,
            0.0,
            1.0
          );

          swordAudio.update(STATE,modeTime,isStationary);

          const cutsceneBanner = document.getElementById('dageng-cutscene-banner');
          const cutsceneStageText = document.getElementById('cutscene-stage-text');
          if (STATE.gestureMode === 'DAGENG' && modeTime < 2.35) {
            if (modeTime > 0.08 && modeTime < 2.05) {
              cutsceneBanner.classList.add('show');
              if (modeTime < 0.65) cutsceneStageText.textContent = '✦ 第一式 · 凝剑冲霄 ✦';
              else if (modeTime < 1.35) cutsceneStageText.textContent = '✦ 第二式 · 四象分枢 ✦';
              else cutsceneStageText.textContent = '✦ 第三式 · 万剑垂天 ✦';
            } else {
              cutsceneBanner.classList.remove('show');
            }
          } else {
            cutsceneBanner.classList.remove('show');
          }

          const lArr = lightningGeo.attributes.position.array;
          let lIdx = 0;
          let minX = Infinity, maxX = -Infinity, minY = Infinity, maxY = -Infinity;
          let sumX = 0, sumY = 0, sumZ = 0;
          if(STATE.gestureMode==='GIANT')updateGiantAssembly(time,modeTime,currentTarget);

          for (let i = 0; i < CONFIG.swordCount; i++) {
            const pos = swordPositions[i];
            const vel = swordVelocities[i];
            const target = new THREE.Vector3();

            const isMainSword = i < CONFIG.mainSwordCount;
            const parentMainIdx = isMainSword ? i : (i - CONFIG.mainSwordCount) % CONFIG.mainSwordCount;
            const shadowSlot = isMainSword ? -1 : Math.floor((i - CONFIG.mainSwordCount) / CONFIG.mainSwordCount);
            let dragonLocalStreamT = 1.0;
            let lotusFinalTarget = null;
            let lotusPoseProgress = 1.0;
            let giantFlightT = 0.0, giantAbsorb = 0.0;

            if (STATE.gestureMode === 'SHIELD') {
              const totalLayers = 12;
              const layerIdx = i % totalLayers;
              const idxInLayer = Math.floor(i / totalLayers);
              const countInLayer = Math.ceil(CONFIG.swordCount / totalLayers);
              const lat = ((layerIdx + 0.5) / totalLayers - 0.5) * Math.PI * 0.86;
              const ringR = Math.cos(lat) * CONFIG.shieldRadius * (isMainSword ? 1.0 : 1.04);
              const yOff = Math.sin(lat) * CONFIG.shieldRadius;
              const dir = layerIdx % 2 === 0 ? 1 : -1;
              const lon = (idxInLayer / countInLayer) * Math.PI * 2 + time * CONFIG.shieldOrbitSpeed * dir;

              const localVec = new THREE.Vector3(Math.cos(lon) * ringR, yOff, Math.sin(lon) * ringR);
              localVec.applyAxisAngle(new THREE.Vector3(1, 0, 0), Math.PI * 0.15);
              target.copy(currentTarget).add(localVec);
            } else if(STATE.gestureMode==='LOTUS'){
              lotusFinalTarget=new THREE.Vector3();
              getLotusSwordPlacement(parentMainIdx,isMainSword,shadowSlot,time,currentTarget,lotusFinalTarget);
              // 阵盘显形时继续惯性滑行，再以连续的起始速度接入各自的入阵弧线。
              const launchTime=LOTUS_TIMING.swordLaunch
                + parentMainIdx/Math.max(1,CONFIG.mainSwordCount-1)*LOTUS_TIMING.swordStagger
                + (isMainSword?0:(shadowSlot+1)*LOTUS_TIMING.shadowStagger);
              const launchPosition=lotusEntryCaptured?lotusEntryPositions[i]:pos;
              const entryVelocity=lotusEntryCaptured?lotusEntryVelocities[i]:vel;
              const coastTime=Math.min(Math.max(0,modeTime),launchTime);
              const coastDecay=Math.exp(-LOTUS_TIMING.inertiaDamping*coastTime);
              const coastDistance=(1-coastDecay)/LOTUS_TIMING.inertiaDamping;
              const flightStart=launchPosition.clone().addScaledVector(entryVelocity,coastDistance);
              const flightT=THREE.MathUtils.clamp((modeTime-launchTime)/LOTUS_TIMING.swordFlight,0,1);
              lotusPoseProgress=flightT*flightT*(3-2*flightT);
              target.lerpVectors(flightStart,lotusFinalTarget,lotusPoseProgress);
              // Hermite 起始切线衔接滑行速度，末端切线与阵位运动一致，避免停下再启动。
              const tangentWeight=flightT*(1-flightT)*(1-flightT)*LOTUS_TIMING.swordFlight;
              target.addScaledVector(entryVelocity,coastDecay*tangentWeight);
              const launchArc=Math.pow(Math.sin(flightT*Math.PI),2)*(isMainSword?2.8:3.6);
              target.y+=launchArc;
            } else if(STATE.gestureMode==='DAGENG'){
              if(modeTime<.65){
                const a=parentMainIdx/72*Math.PI*6+time*5.5+(isMainSword?0:shadowSlot*.35),r=(isMainSword?2.2:3.8+shadowSlot)*(1-modeTime*.5);
                target.set(currentTarget.x+Math.cos(a)*r,currentTarget.y+parentMainIdx/72*24-4+modeTime*22,currentTarget.z+Math.sin(a)*r);
              }else{
                getDagengSwordPlacement(parentMainIdx,isMainSword,shadowSlot,time,dagengFieldCenter,target);
                const deploy=smoothstep(.65,2.20,modeTime);
                target.lerp(new THREE.Vector3(dagengFieldCenter.x,dagengFieldCenter.y+DAGENG_LAYOUT.height,dagengFieldCenter.z),1-deploy);
              }
            } else if (STATE.gestureMode === 'GIANT') {
              const giantIdx = Math.floor(parentMainIdx / 9);
              const subInGiant = parentMainIdx % 9;
              const launchTime=giantLaunchTime(parentMainIdx,isMainSword,shadowSlot);
              giantFlightT=giantFlightProgress(parentMainIdx,isMainSword,shadowSlot,modeTime);
              giantAbsorb=smoothstep(.82,1,giantFlightT);
              const coastTime=Math.min(Math.max(0,modeTime),launchTime);
              const coastDecay=Math.exp(-GIANT_TIMING.inertiaDamping*coastTime);
              const flightStart=giantEntryPositions[i].clone().addScaledVector(giantEntryVelocities[i],
                (1-coastDecay)/GIANT_TIMING.inertiaDamping);
              const approach=giantAnchors[giantIdx].clone();
              const angle=subInGiant/9*Math.PI*2+giantIdx*.67+(isMainSword?0:(shadowSlot+1)*.31);
              const spread=(isMainSword?4.6:5.8+shadowSlot*.45)*(1-smoothstep(.55,1,giantFlightT));
              if(subInGiant!==0||!isMainSword){
                approach.x+=Math.cos(angle)*spread;
                approach.z+=Math.sin(angle)*spread;
                approach.y+=(4-subInGiant)*.8*(1-giantAbsorb);
              }
              const travel=giantFlightT*giantFlightT*(3-2*giantFlightT);
              target.lerpVectors(flightStart,approach,travel);
              target.addScaledVector(giantEntryVelocities[i],coastDecay*giantFlightT
                *(1-giantFlightT)*(1-giantFlightT)*GIANT_TIMING.flight);
              const arc=Math.pow(Math.sin(giantFlightT*Math.PI),2);
              target.x+=Math.cos(angle+.8)*arc*(3+subInGiant*.35);
              target.z+=Math.sin(angle+.8)*arc*(3+subInGiant*.35);
              target.y+=arc*(3.2+(isMainSword?0:1.2));
            } else {
              // 剑影分光：动则紧随鼠标分光化流，停则惯性飞过头并围绕光标盘旋环绕后再万剑归一
              const rankNorm = THREE.MathUtils.clamp((parentMainIdx + (isMainSword ? 0 : (shadowSlot + 1) * 4.2)) / 92.0, 0.0, 1.0);
              dragonLocalStreamT = smoothstep(rankNorm * 0.24, 0.76 + rankNorm * 0.24, STATE.dragonStreamProgress);

              const movingTarget = new THREE.Vector3();
              const inertDir = STATE.lastDirection.clone().normalize();
              const inertRight = new THREE.Vector3(-inertDir.y, inertDir.x, 0);
              if (inertRight.lengthSq() < 0.001) inertRight.set(1, 0, 0);
              inertRight.normalize();
              const inertUp = new THREE.Vector3().crossVectors(inertDir, inertRight).normalize();

              let streamDir = inertDir.clone();
              let streamRight = inertRight.clone();
              let streamUp = inertUp.clone();

              // 移动阶段所有剑都沿同一条历史轨迹取样，只用层间距制造前后节奏。
              // 只有回收刚开始时保留第一把主剑的当前位置作为惯性锚点，避免改变现有回收观感。
              const useRecoveryAnchor = isStationary && parentMainIdx === 0 && isMainSword;
              if (useRecoveryAnchor) {
                movingTarget.copy(currentTarget);
              } else {
                const trailHeadLag = isStationary ? 0.0 : CONFIG.followHeadLag;
                const trailSpacing = isStationary ? 2.55 : CONFIG.followTrailSpacing;
                const shadowLagBase = isStationary ? 5.4 : CONFIG.shadowTrailLag;
                const trailLengthScale = isStationary ? 1.0 : CONFIG.followLengthMultiplier;
                const shadowTrailLag = isMainSword
                  ? 0
                  : (shadowSlot + 1) * shadowLagBase + (parentMainIdx % 3) * (isStationary ? 1.65 : 1.35);
                const activeStreamScale = isStationary ? 1.0 : Math.max(0.35, dragonLocalStreamT);
                const floatIdx = Math.min((trailHeadLag + (parentMainIdx * trailSpacing + shadowTrailLag) * trailLengthScale) * activeStreamScale, STATE.pathHistory.length - 2);

                // Compensate for the uncommitted head fraction. Inserting a
                // sample then leaves the sampled world position continuous.
                const sampleIdx=Math.min(floatIdx<=streamSampleFraction
                  ?floatIdx/Math.max(streamSampleFraction,.00001)
                  :floatIdx+1-streamSampleFraction,STATE.pathHistory.length-2);
                const idxA = Math.floor(sampleIdx);
                const idxB = idxA + 1;
                const frac = sampleIdx - idxA;
                const ptA = STATE.pathHistory[idxA] || currentTarget;
                const ptB = STATE.pathHistory[idxB] || ptA;
                interpolateStreamPath(idxA,frac,movingTarget);

                const ptAhead = STATE.pathHistory[Math.max(0, idxA - 2)] || currentTarget;
                const ptBehind = STATE.pathHistory[Math.min(STATE.pathHistory.length - 1, idxB + 2)] || ptB;
                streamDir = ptAhead.clone().sub(ptBehind);
                if (streamDir.lengthSq() < 0.001) streamDir.copy(inertDir);
                else streamDir.normalize();

                streamRight.set(-streamDir.y, streamDir.x, 0);
                if (streamRight.lengthSq() < 0.001) streamRight.set(1, 0, 0);
                streamRight.normalize();
                streamUp.crossVectors(streamDir, streamRight).normalize();

                const splitBurst = isStationary ? 0.0 : Math.sin(dragonLocalStreamT * Math.PI) * 0.65;

                if (isMainSword) {
                  // 收窄主剑流横向半径，保留原有螺旋飞行节奏。
                  const headTaper = THREE.MathUtils.clamp(parentMainIdx / 6.0, 0.25, 1.0);
                  const streamAngle = parentMainIdx * 2.39996 - time * 2.1 + parentMainIdx * 0.15 + swordPhases[i] * 0.18;
                  const mainStreamRad = ((0.90 + (parentMainIdx % 4) * 0.42) * headTaper + splitBurst) * (0.88 + 0.22 * Math.sin(time * 1.8 - parentMainIdx * 0.2)) * CONFIG.followWidthMultiplier;
                  const offsetRight = Math.cos(streamAngle) * mainStreamRad;
                  const offsetUp = Math.sin(streamAngle) * mainStreamRad * 0.78;
                  movingTarget.addScaledVector(streamRight, offsetRight);
                  movingTarget.addScaledVector(streamUp, offsetUp);
                } else {
                  // 剑光外翼同步收窄，保持纵向波动。
                  const headTaper = THREE.MathUtils.clamp((parentMainIdx + 2) / 7.0, 0.42, 1.0);
                  const wingDirection = shadowSlot % 2 === 0 ? 1 : -1;
                  const wingAngle = parentMainIdx * 2.39996 + shadowSlot * (Math.PI * 0.5) + time * 1.65 * wingDirection + swordPhases[i] * 0.16 + Math.sin(time * 1.8 + parentMainIdx * 0.4) * 0.35;
                  const shadowStreamRad = ((2.45 + shadowSlot * 0.82 + Math.sin(time * 2.2 + i * 0.37 + swordPhases[i]) * 0.48) * headTaper + splitBurst * 1.3) * CONFIG.followWidthMultiplier;
                  const alongStreamWave = Math.sin(time * 2.5 + shadowSlot * 1.5 + parentMainIdx + swordPhases[i]) * 1.55;
                  const offsetRight = Math.cos(wingAngle) * shadowStreamRad;
                  const offsetUp = Math.sin(wingAngle) * shadowStreamRad * 0.72;
                  movingTarget.addScaledVector(streamRight, offsetRight);
                  movingTarget.addScaledVector(streamUp, offsetUp);
                  movingTarget.addScaledVector(streamDir, alongStreamWave);
                }

                // 剑流在高速时带一点不同步的升沉，形成“御风”感，停下时自然消失。
                const flowEnergy = THREE.MathUtils.clamp(STATE.dragonSpeed / 18.0, 0.0, 1.0);
                const flowBob = Math.sin(time * 2.35 + swordPhases[i]) * (0.08 + flowEnergy * 0.18) * CONFIG.followWidthMultiplier;
                // 两层低幅微波让剑流边缘有细小的错相起伏，增加层次但不改变剑模。
                const microWeave = (Math.sin(time * 4.25 + parentMainIdx * 0.73 + swordPhases[i]) * 0.12
                  + Math.sin(time * 8.10 - parentMainIdx * 0.18 + swordPhases[i] * 1.7) * 0.045)
                  * (0.24 + flowEnergy * 0.76) * CONFIG.followWidthMultiplier;
                const microSway = Math.cos(time * 3.10 + parentMainIdx * 0.41 + swordPhases[i])
                  * (0.055 + flowEnergy * 0.09) * CONFIG.followWidthMultiplier;
                movingTarget.addScaledVector(streamUp, flowBob + microWeave);
                movingTarget.addScaledVector(streamRight, microSway);
              }

              const idleHoverBob = Math.sin(time * 2.0) * 0.38;
              const singleSwordTarget = new THREE.Vector3(currentTarget.x, currentTarget.y + idleHoverBob, currentTarget.z);

              if (!isStationary) {
                // 鼠标移动时：全体从同一条轨迹展开，前后差异只来自采样层级。
                const wakeupT = smoothstep(0.02, 0.36, STATE.dragonStreamProgress);
                target.lerpVectors(singleSwordTarget, movingTarget, wakeupT);
              } else {
                // 鼠标停下时：先沿惯性飞过头（Fly-Past），再绕光标高速盘旋环绕（Orbit Swirl），最后收束归一
                const orbitProgress = 1.0 - dragonLocalStreamT; // 0.0(刚停下) -> 1.0(归一完成)
                const energy = Math.max(0.45, STATE.orbitEnergy);

                // 1. 惯性飞过头偏移：在刚停下阶段冲过鼠标光标前方
                const flyPastEnv = Math.sin(THREE.MathUtils.clamp(orbitProgress / 0.55, 0.0, 1.0) * Math.PI);
                const flyPastDist = (6.5 + 8.5 * energy) * flyPastEnv;

                // 2. 盘旋环绕轨道：围绕光标旋转 1.6 圈并螺旋收束半径
                const swirlEnv = Math.sin(Math.pow(orbitProgress, 0.78) * Math.PI);
                const orbitRadius = (5.2 + 9.2 * energy + (isMainSword ? 0 : (shadowSlot + 1) * 0.75)) * swirlEnv;
                const totalSwirlAngle = orbitProgress * Math.PI * 3.35 - rankNorm * Math.PI * 1.45 + (isMainSword ? 0 : shadowSlot * 0.22);

                const cosO = Math.cos(totalSwirlAngle);
                const sinO = Math.sin(totalSwirlAngle) * STATE.orbitSpinDir;

                const orbitTarget = singleSwordTarget.clone()
                  .addScaledVector(inertDir, flyPastDist + cosO * orbitRadius)
                  .addScaledVector(inertRight, sinO * orbitRadius * 0.92)
                  .addScaledVector(inertUp, Math.sin(totalSwirlAngle * 2.0 + parentMainIdx * 0.3) * orbitRadius * 0.28);

                // 从流线轨迹平滑切入飞过头盘旋轨道，并在末端归入单剑
                const enterOrbitBlend = smoothstep(0.0, 0.22, orbitProgress);
                const mergeFinalBlend = smoothstep(0.78, 0.98, orbitProgress);
                target.lerpVectors(movingTarget, orbitTarget, enterOrbitBlend);
                target.lerp(singleSwordTarget, mergeFinalBlend);
              }
            }

            const isDagengCutscene = STATE.gestureMode === 'DAGENG' && modeTime < 2.2;
            const isGiantMode = STATE.gestureMode === 'GIANT';
            const isDragonFollow = STATE.gestureMode === 'DRAGON';
            const distToTarget = target.distanceTo(pos);

            if (isDragonFollow && justStopped) {
              // 目标点会在这一帧开始进入回收轨道，但剑本身先获得停止瞬间的真实冲量。
              // 前排略强、后排略柔，保证整条剑流一起飞过头而不是前排原地刹停。
              const releaseDir = STATE.inertiaDirection;
              const releaseRight = new THREE.Vector3(-releaseDir.y, releaseDir.x, 0);
              const releaseSpeed = THREE.MathUtils.clamp(
                STATE.lastMovingSpeed * 0.56 + STATE.orbitEnergy * 30.0,
                22.0,
                96.0
              );
              const releaseRank = THREE.MathUtils.clamp(
                (parentMainIdx + (isMainSword ? 0 : (shadowSlot + 1) * 4.2)) / 92.0,
                0.0,
                1.0
              );
              const releaseScale = 1.0 - releaseRank * 0.16;
              vel.addScaledVector(releaseDir, releaseSpeed * releaseScale);
              vel.addScaledVector(releaseRight, Math.sin(swordPhases[i]) * releaseSpeed * 0.08 * releaseScale);
            }

            let speed = STATE.gestureMode === 'SHIELD' || isDagengCutscene
              ? CONFIG.sprintSpeed * (isDagengCutscene ? 1.15 : 0.95)
              : isGiantMode
                ? CONFIG.sprintSpeed * 1.4
                : isDragonFollow || STATE.gestureMode === 'DAGENG'
                  ? CONFIG.sprintSpeed
                  : CONFIG.maxSpeed;
            if (distToTarget > 3.0 && !isDagengCutscene) {
              // 远距离追击仍会加速，但给加速度留出缓冲，避免剑群突然拉成直线。
              speed = Math.max(speed, CONFIG.sprintSpeed + Math.min(126, (distToTarget - 3.0) * 2.8));
            }
            const flightSpeedMultiplier = isDragonFollow ? CONFIG.followSpeedMultiplier : 1.0;
            speed *= flightSpeedMultiplier;

            const speedEase = isDragonFollow ? (isStationary ? 0.08 : 0.16) : 0.18;
            swordSpeedTargets[i] = THREE.MathUtils.lerp(swordSpeedTargets[i], speed, damp(speedEase));
            const cruiseSpeed = swordSpeedTargets[i];
            const desired = target.clone().sub(pos);
            const d = desired.length();
            const slowRadius = STATE.gestureMode === 'DAGENG'
              ? (isDagengCutscene ? 3.2 : 6.0)
              : isGiantMode
                ? 3.5
                : isDragonFollow
                  ? (isStationary ? 3.8 : 2.6)
                  : 8.0;
            if (d > 0) {
              desired.normalize();
              const arrivalT = d < slowRadius ? smoothstep(0.0, 1.0, d / slowRadius) : 1.0;
              // 平滑减速让剑尖在目标附近自然收势，不会突然刹停。
              desired.multiplyScalar(cruiseSpeed * arrivalT);

              // 在剑影分光模式下，当飞剑高速逼近目标或急转弯时注入切向回旋力，强化弧线盘旋质感
              if (isDragonFollow && d > 0.35 && d < 18.0 && vel.lengthSq() > 36.0) {
                const tangentDir = new THREE.Vector3(-desired.y * STATE.orbitSpinDir, desired.x * STATE.orbitSpinDir, 0).normalize();
                const swirlStrength = isStationary
                  ? smoothstep(0.08, 0.65, dragonLocalStreamT) * 0.42
                  : 0.16;
                desired.addScaledVector(tangentDir, cruiseSpeed * swirlStrength);
              }
            }

            // 转向力控制：移动时紧咬鼠标，停下时保留一小段可见的弧线惯性。
            const steer = desired.sub(vel);
            const distBoost = isDragonFollow ? 1.0 + Math.min(2.2, distToTarget * 0.08) : 1.0;
            const releaseBrakeT = isDragonFollow && isStationary ? 1.0 - STATE.inertiaRelease : 1.0;
            const stationarySteerFactor = THREE.MathUtils.lerp(0.24, 0.95, releaseBrakeT);
            const steerFactor = STATE.gestureMode === 'SHIELD' || isDagengCutscene
              ? 2.2
              : isGiantMode
                ? 3.0
                : STATE.gestureMode === 'DAGENG'
                  ? 1.5
                  : isDragonFollow
                    ? (isStationary ? stationarySteerFactor : 1.45 * distBoost)
                    : 1.1;
            // 速度提高后按平方同步增强牵引，维持转弯半径并减少快速移鼠时的掉队。
            steer.clampLength(0, CONFIG.steerForce * steerFactor * flightSpeedMultiplier * flightSpeedMultiplier * delta);
            vel.add(steer);

            // 停止后的前半段保留速度，随后再逐渐增加阻力，让飞过头和回收自然衔接。
            const dragBase = isDragonFollow && isStationary
              ? THREE.MathUtils.lerp(0.985, 0.96, releaseBrakeT)
              : 0.996;
            vel.multiplyScalar(Math.pow(dragBase, dtRatio));
            const speedCap = Math.max(0.2, cruiseSpeed * (isDragonFollow ? 1.18 : 1.10));
            vel.clampLength(0, speedCap);

            if (i > 0 && STATE.gestureMode === 'DRAGON' && dragonLocalStreamT > 0.15) {
              const prev = swordPositions[i - 1];
              const diff = pos.clone().sub(prev);
              const sepD = diff.length();
              if (sepD < CONFIG.separationDist && sepD > 0.01) {
                vel.add(diff.normalize().multiplyScalar(CONFIG.separationForce * delta * dragonLocalStreamT));
              }
            }

            if(STATE.gestureMode==='LOTUS'||isGiantMode){
              // 从惯性滑行、汇聚入阵到稳定跟随始终使用同一条连续轨迹。
              vel.subVectors(target,pos).divideScalar(Math.max(delta,0.0001));
              pos.copy(target);
            }else{
              pos.add(vel.clone().multiplyScalar(delta));
            }

            // 用当前速度与目标方向的夹角估算转弯，给剑身一个缓慢的侧倾。
            // 侧倾只作用于剑影分光，其他阵法仍保持原有的几何朝向。
            if (isDragonFollow) {
              const bankForward = vel.lengthSq() > 0.16 ? vel.clone().normalize() : STATE.lastDirection.clone().normalize();
              const bankAim = target.clone().sub(pos);
              if (bankAim.lengthSq() > 0.001) bankAim.normalize();
              const turnCross = bankForward.x * bankAim.y - bankForward.y * bankAim.x;
              const bankSpeedT = THREE.MathUtils.clamp(vel.length() / CONFIG.sprintSpeed, 0.0, 1.0);
              const bankTarget = THREE.MathUtils.clamp(turnCross * (0.95 + bankSpeedT * 0.8), -1.0, 1.0);
              swordBanks[i] = THREE.MathUtils.lerp(swordBanks[i], bankTarget, damp(isStationary ? 0.10 : 0.18));
            } else {
              swordBanks[i] = THREE.MathUtils.lerp(swordBanks[i], 0.0, damp(0.14));
            }

            // 移动时保持统一的轨迹延迟；静止盘旋接近尾声时平滑收束归入单把本命剑
            if (isDragonFollow) {
              if (isStationary && dragonLocalStreamT < 0.16) {
                pos.lerp(target, damp((1.0 - dragonLocalStreamT / 0.16) * 0.35));
              }
            } else if(STATE.gestureMode==='DAGENG'&&modeTime>2.20){
              pos.lerp(target,damp(.13));vel.multiplyScalar(Math.pow(.82,dtRatio));
            }

            dummy.position.copy(pos);

            minX = Math.min(minX, pos.x); maxX = Math.max(maxX, pos.x);
            minY = Math.min(minY, pos.y); maxY = Math.max(maxY, pos.y);
            sumX += pos.x; sumY += pos.y; sumZ += pos.z;

            let lookTarget;
            if (STATE.gestureMode === 'SHIELD') {
              if (modeTime < 0.55) {
                lookTarget = currentTarget;
              } else {
                const normal = pos.clone().sub(currentTarget).normalize();
                dummy.up.copy(normal);
                const totalLayers = 12;
                const direction = (i % totalLayers) % 2 === 0 ? 1 : -1;
                const tilt = Math.PI * 0.15;
                const sphereNorth = new THREE.Vector3(0, 1, 0).applyAxisAngle(new THREE.Vector3(1, 0, 0), tilt);
                const tangent = new THREE.Vector3().crossVectors(sphereNorth, normal).normalize();
                if (direction === -1) tangent.negate();
                if (tangent.lengthSq() < 0.01) tangent.set(1, 0, 0);
                lookTarget = pos.clone().add(tangent);
              }
            } else if (STATE.gestureMode === 'LOTUS') {
              const outward = new THREE.Vector3(pos.x - currentTarget.x, pos.y - currentTarget.y, 0).normalize();
              if (outward.lengthSq() < 0.001) outward.set(1, 0, 0);
              outward.z=(thunderNoise(parentMainIdx*3.7+shadowSlot+19)-.5)*.17;
              const flightDir=vel.lengthSq()>.16?vel.clone().normalize():STATE.lastDirection.clone().normalize();
              const blendedDir=flightDir.lerp(outward.normalize(),lotusPoseProgress).normalize();
              const flightUp=new THREE.Vector3(0,0,1).lerp(defaultUp,THREE.MathUtils.clamp(vel.length()/CONFIG.sprintSpeed,0,1));
              dummy.up.copy(flightUp.lerp(new THREE.Vector3(0,0,1),lotusPoseProgress).normalize());
              lookTarget=pos.clone().add(blendedDir);
            } else if(STATE.gestureMode==='DAGENG'){
              dummy.up.set(0,0,1);lookTarget=pos.clone().add(new THREE.Vector3(0,-1,0));
            } else if (STATE.gestureMode === 'GIANT') {
              const giantIdx = Math.floor(parentMainIdx / 9);
              const baseAngle = (giantIdx / 8) * Math.PI * 2 + time * 0.32;
              const pose=smoothstep(.48,.97,giantFlightT);
              const flightDir=vel.lengthSq()>.04?vel.clone().normalize():STATE.lastDirection.clone();
              const direction=flightDir.lerp(new THREE.Vector3(0,-1,0),pose);
              if(direction.lengthSq()<.001)direction.set(0,-1,0);
              direction.normalize();
              dummy.up.set(0,0,1).lerp(new THREE.Vector3(Math.cos(baseAngle),0,Math.sin(baseAngle)),pose);
              if(dummy.up.lengthSq()<.001)dummy.up.set(1,0,0);
              lookTarget=pos.clone().add(direction);
            } else {
              // 飞行与飞过头盘旋环绕期间剑尖始终顺着切线飞行方向，仅在最后归宗合一瞬间竖直立起
              const flightDir = vel.length() > 0.25 ? vel.clone().normalize() : STATE.lastDirection.clone().normalize();
              const idleUpDir = new THREE.Vector3(Math.sin(time * 1.6) * 0.035, 1.0, Math.cos(time * 1.4) * 0.025).normalize();
              const alignToFlightT = isStationary ? smoothstep(0.02, 0.20, dragonLocalStreamT) : 1.0;
              const blendedDir = idleUpDir.lerp(flightDir, alignToFlightT).normalize();
              // Transport the previous up vector instead of forcing world-up.
              // A vertical flight direction must not make lookAt singular.
              const flightUp=swordUpVectors[i];
              flightUp.addScaledVector(blendedDir,-flightUp.dot(blendedDir));
              if(flightUp.lengthSq()<.0001){
                flightUp.copy(viewPlaneNormal).addScaledVector(blendedDir,-viewPlaneNormal.dot(blendedDir));
                if(flightUp.lengthSq()<.0001){flightUp.set(0,1,0);if(Math.abs(blendedDir.y)>.9)flightUp.set(1,0,0);flightUp.addScaledVector(blendedDir,-flightUp.dot(blendedDir));}
              }
              flightUp.normalize();
              const bankAngle = -swordBanks[i] * CONFIG.flightBank * (0.35 + Math.min(1.0, vel.length() / CONFIG.sprintSpeed));
              dummy.up.copy(flightUp).applyAxisAngle(blendedDir, bankAngle).normalize();
              lookTarget = pos.clone().add(blendedDir);
            }
            dummy.lookAt(lookTarget);
            if(isDragonFollow){
              const facing=swordFacingRotations[i];
              if(!swordFacingReady[i]){facing.copy(dummy.quaternion);swordFacingReady[i]=1;}
              else{
                const angle=facing.angleTo(dummy.quaternion),turn=Math.min(8*delta,angle*(1-Math.exp(-22*delta)));
                facing.rotateTowards(dummy.quaternion,turn);
              }
              dummy.quaternion.copy(facing);
            }else swordFacingReady[i]=0;
            swordSpinAngles[i]=(swordSpinAngles[i]+delta*STATE.spinRPM*Math.PI/30*swordSpinRates[i])%(Math.PI*2);
            dummy.rotateZ(swordSpinAngles[i]);
            if(STATE.gestureMode==='GIANT'){
              giantPoseRotation.copy(dummy.quaternion);
              dummy.quaternion.slerpQuaternions(giantEntryRotations[i],giantPoseRotation,smoothstep(0,.26,giantFlightT));
            }

            let targetScale = isMainSword ? 1.15 : 0.96;
            if (STATE.gestureMode === 'DRAGON') {
              if (i === 0) targetScale = THREE.MathUtils.lerp(2.1, 1.25, smoothstep(0.0, 0.25, dragonLocalStreamT));
              else if (isMainSword) {
                const absorbMask = isStationary ? smoothstep(0.01, 0.12, dragonLocalStreamT) : 1.0;
                targetScale = THREE.MathUtils.lerp(0.001, 1.15, absorbMask);
              } else if (parentMainIdx === 0 && shadowSlot === 0) {
                targetScale = THREE.MathUtils.lerp(0.001,0.98,smoothstep(.02,.18,dragonLocalStreamT));
              } else {
                const absorbMask = isStationary ? smoothstep(0.02, 0.14, dragonLocalStreamT) : 1.0;
                targetScale = THREE.MathUtils.lerp(0.001, 0.96, absorbMask);
              }
            } else if (STATE.gestureMode === 'GIANT') {
              const subInGiant = parentMainIdx % 9;
              const growth=giantGroupGrowth[Math.floor(parentMainIdx/9)];
              const gatherScale=THREE.MathUtils.lerp(giantEntryScales[i],isMainSword?1.15:.96,smoothstep(0,.65,giantFlightT));
              if(subInGiant===0&&(isMainSword||shadowSlot===0)){
                targetScale=THREE.MathUtils.lerp(gatherScale,isMainSword?16.0:16.6,growth);
              }else{
                targetScale=THREE.MathUtils.lerp(gatherScale,.001,giantAbsorb);
              }
            } else if (STATE.gestureMode === 'DAGENG') {
              if (parentMainIdx < 8) targetScale = isMainSword ? 2.1 : 1.55;
              else if (parentMainIdx >= 8 && parentMainIdx < 24) {
                const inSubMainIdx = Math.floor((parentMainIdx - 8) / 4);
                targetScale = isMainSword ? (inSubMainIdx === 0 ? 2.65 : 1.65) : 1.25 + (shadowSlot % 2) * 0.18;
              } else {
                targetScale = isMainSword ? 1.55 + (parentMainIdx % 3) * 0.22 : 1.12 + (shadowSlot % 3) * 0.16;
              }
            } else if (STATE.gestureMode === 'LOTUS') {
              const petal=thunderNoise(parentMainIdx*7.31+shadowSlot*11.7+23);
              const lotusScaleT=lotusPoseProgress;
              const lotusScale=isMainSword?2.4+petal*1.7:2.45+petal*1.85+shadowSlot*.10;
              targetScale=THREE.MathUtils.lerp(lotusEntryCaptured?lotusEntryScales[i]:(isMainSword?1.15:.96),lotusScale,lotusScaleT);
            }

            if(STATE.gestureMode==='DRAGON'&&!STATE.splitEnabled){
              targetScale=STATE.retainMainSwordsWhenSplitOff?(isMainSword?1.15:0.0):(i===0?2.1:0.0);
            }
            if(STATE.gestureMode==='DAGENG')targetScale=isMainSword?3.3+(parentMainIdx%4)*.38:2.2+shadowSlot*.24;
            const scaleLerpRate = !STATE.splitEnabled && STATE.gestureMode==='DRAGON' ? .30 : .08;
            swordScales[i] = STATE.gestureMode==='GIANT'?targetScale:THREE.MathUtils.lerp(swordScales[i], targetScale, damp(scaleLerpRate));
            const sc = swordScales[i];

            const curtain=STATE.gestureMode==='DAGENG'?smoothstep(.60,1.60,modeTime):0;
            dummy.scale.set(sc*(1+curtain*.10),sc*(1+curtain*.10),sc*(1+curtain*1.30));
            dummy.updateMatrix();

            if (isMainSword) {
              bladeInstanced.setMatrixAt(i, dummy.matrix);
              hiltInstanced.setMatrixAt(i, dummy.matrix);
            } else {
              shadowInstanced.setMatrixAt(i - CONFIG.mainSwordCount, dummy.matrix);
            }

            if(STATE.lightningEnabled)swordLightningInstanced.setMatrixAt(i,dummy.matrix);
          }

          if (STATE.gestureMode === 'LOTUS') {
            // 入阵只向前推进，鼠标移动造成的跟随距离不会让已组成的剑阵回退。
            const timeReady=THREE.MathUtils.smoothstep(modeTime,LOTUS_TIMING.swordLaunch,LOTUS_ASSEMBLY_END);
            lotusFormationProgress=Math.max(lotusFormationProgress,timeReady);
          } else if (STATE.gestureMode !== 'LOTUS') {
            lotusFormationProgress=THREE.MathUtils.lerp(lotusFormationProgress,0,damp(.08));
          }

          const isThunderDragonMode = STATE.gestureMode === 'THUNDER_DRAGON';
          updateSwordQi(time,isThunderDragonMode);

          // 使用“神雷化形”时，所有 360 把飞剑与剑上雷电全部隐藏，只留辟邪神雷金龙
          bladeInstanced.visible = !isThunderDragonMode;
          hiltInstanced.visible = !isThunderDragonMode;
          shadowInstanced.visible = !isThunderDragonMode && STATE.splitEnabled;
          shadowGlowInstanced.visible=shadowInstanced.visible;

          if (!isThunderDragonMode) {
            bladeInstanced.instanceMatrix.needsUpdate = true;
            hiltInstanced.instanceMatrix.needsUpdate = true;
            shadowInstanced.instanceMatrix.needsUpdate = true;
          }

          if (STATE.lightningEnabled && STATE.lightningAmount>0 && !isThunderDragonMode) {
            swordLightningInstanced.visible = true;
            swordLightningInstanced.instanceMatrix.needsUpdate = true;
            while (lIdx < lArr.length) lArr[lIdx++] = 0;
            lightningGeo.attributes.position.needsUpdate = true;
            lightningLines.visible = false;
          } else {
            swordLightningInstanced.visible = false;
            lightningLines.visible = false;
          }

          // 更新“神雷化形”辟邪神雷金龙
          updateThunderDragon(time, delta, dtRatio, currentTarget, isThunderDragonMode);
          updateDragonBreath(time,delta,isThunderDragonMode);

          const isLotusActive = STATE.gestureMode === 'LOTUS';
          lotusDiscOpacity = THREE.MathUtils.lerp(lotusDiscOpacity, isLotusActive ? 1.0 : 0.0, damp(isLotusActive ? 0.12 : 0.08));
          lotusDiscMesh.visible = isLotusActive || lotusDiscOpacity > 0.01;
          if (lotusDiscMesh.visible) {
            // 阵盘只受招式开关与自己的展开时间控制；关闭时保留当前展开程度并淡出。
            const discFormationT = isLotusActive
              ? 1-Math.pow(1-THREE.MathUtils.clamp(modeTime/LOTUS_TIMING.discReveal,0,1),3)
              : lotusDiscUniforms.uDeploy.value;
            lotusDiscUniforms.uTime.value = time;
            lotusDiscUniforms.uOpacity.value = lotusDiscOpacity;
            lotusDiscUniforms.uDeploy.value = discFormationT;
            const discScale = THREE.MathUtils.lerp(14,48,discFormationT) + Math.sin(time * 2.4) * 0.6;
            lotusDiscMesh.position.set(currentTarget.x, currentTarget.y, currentTarget.z - 0.15);
            lotusDiscMesh.scale.set(discScale, discScale, 1);
            lotusDiscMesh.rotation.set(Math.sin(time * 0.9) * 0.04, Math.cos(time * 0.8) * 0.04, -time * 0.055);
          }

          updateLotusSpectacle(time,currentTarget,lotusDiscOpacity,isLotusActive,lotusFormationProgress);

          const isDagengActive = STATE.gestureMode === 'DAGENG';
          const isGiantActive = STATE.gestureMode === 'GIANT';
          const showCircleSystem = isDagengActive || isGiantActive;
          const targetCircleOpacity = isDagengActive ? (modeTime < 0.48 ? 0.15 : 1.0) : isGiantActive ? .95*smoothstep(.20,1.65,modeTime) : 0.0;
          magicCircleOpacity = THREE.MathUtils.lerp(magicCircleOpacity, targetCircleOpacity, damp(showCircleSystem ? 0.12 : 0.06));
          const deployProgress = isDagengActive ? THREE.MathUtils.clamp((modeTime - 0.45) / 0.95, 0.05, 1.0) : isGiantActive ? smoothstep(.18,GIANT_ASSEMBLY_END-.25,modeTime) : 1.0;

          magicCircleUniforms.uTime.value = time;
          // 大庚阵的纹样由盘体带动；巨剑术保留原有纹样流转。
          magicCircleUniforms.uPatternTime.value = isDagengActive ? 0 : time;
          magicCircleUniforms.uOpacity.value = magicCircleOpacity;
          magicCircleUniforms.uDeploy.value = 1 - Math.pow(1 - deployProgress, 3);
          dagengGroup.visible = magicCircleOpacity > 0.01;

          if (dagengGroup.visible) {
            if (isGiantActive) {
              const giantCircleScale = THREE.MathUtils.lerp(16, 64, 1 - Math.pow(1 - deployProgress, 3));
              const breatheScale = giantCircleScale + Math.sin(time * 2.0) * 1.5;
              mainCircleMesh.position.set(currentTarget.x, currentTarget.y + 4.5, currentTarget.z);
              mainCircleMesh.scale.set(breatheScale, breatheScale, 1);
              mainCircleMesh.rotation.x = -Math.PI / 2 + Math.sin(time * 0.8) * 0.04;
              mainCircleMesh.rotation.y = Math.cos(time * 0.8) * 0.04;
              mainCircleMesh.rotation.z = -time * 0.32;

              subCircleMeshes.forEach(({ mesh }) => { mesh.scale.set(0.001, 0.001, 1); });

              threadMat.opacity = magicCircleOpacity * 0.28;
              const tArr = threadGeo.attributes.position.array;
              for (let i = 0; i < threadCount; i++) {
                const td = threadData[i];
                const curAng = td.ang + time * 0.25;
                const radWave = (td.rad * 0.68 + Math.sin(time * 1.6 + td.phase) * 0.8) * deployProgress;
                const tx = currentTarget.x + Math.cos(curAng) * radWave;
                const tz = currentTarget.z + Math.sin(curAng) * radWave;
                const yTop = currentTarget.y + 12.0 + Math.sin(time * 2.0 + td.phase) * 1.5;
                const yBot = yTop - td.len * 0.85;
                tArr[i * 6] = tx; tArr[i * 6 + 1] = yTop; tArr[i * 6 + 2] = tz;
                tArr[i * 6 + 3] = tx; tArr[i * 6 + 4] = yBot; tArr[i * 6 + 5] = tz;
              }
              threadGeo.attributes.position.needsUpdate = true;
            } else {
              const mainScaleFactor = isDagengActive ? THREE.MathUtils.lerp(18, DAGENG_LAYOUT.mainScale, 1 - Math.pow(1 - deployProgress, 3)) : DAGENG_LAYOUT.mainScale;
              const mainBreathe = mainScaleFactor + Math.sin(time * 1.6) * 2.2 * deployProgress;
              const apexY = getDagengDiscHeight(time,dagengFieldCenter);

              mainCircleMesh.position.set(dagengFieldCenter.x, apexY, dagengFieldCenter.z);
              mainCircleMesh.scale.set(mainBreathe, mainBreathe, 1);
              mainCircleMesh.rotation.x=-Math.PI/2;
              mainCircleMesh.rotation.y=0;
              mainCircleMesh.rotation.z = time * DAGENG_LAYOUT.mainSpinSpeed;

              // 四阵共用同一公转相位：同高、等半径，始终相隔九十度。
              const subOrbitTime=Math.max(0,modeTime-DAGENG_LAYOUT.subDeployStart-DAGENG_LAYOUT.subDeployDuration);
              subCircleMeshes.forEach(({ mesh, cfg }, idx) => {
                const subState = getSubCircleState(idx, time, dagengFieldCenter, subOrbitTime);
                const subFlyT = isDagengActive ? THREE.MathUtils.clamp((modeTime-DAGENG_LAYOUT.subDeployStart)/DAGENG_LAYOUT.subDeployDuration,0,1) : 1.0;
                const easeSubFly = 1 - Math.pow(1 - subFlyT, 3);
                const curX = THREE.MathUtils.lerp(dagengFieldCenter.x, subState.x, easeSubFly);
                const curY = THREE.MathUtils.lerp(apexY, subState.y, easeSubFly);
                const curZ = THREE.MathUtils.lerp(dagengFieldCenter.z, subState.z, easeSubFly);
                const subBreathe = cfg.scale * easeSubFly;

                mesh.position.set(curX, curY, curZ);
                mesh.scale.set(Math.max(0.01, subBreathe), Math.max(0.01, subBreathe), 1);
                mesh.rotation.x=-Math.PI/2;
                mesh.rotation.y=0;
                mesh.rotation.z = time * DAGENG_LAYOUT.subSpinSpeed;
              });

              const threadDropT = isDagengActive ? THREE.MathUtils.clamp((modeTime - 0.85) / 0.9, 0, 1) : 1.0;
              threadMat.opacity = magicCircleOpacity * threadDropT * (0.34 + Math.sin(time * 3.0) * 0.08);
              const tArr = threadGeo.attributes.position.array;
              for (let i = 0; i < threadCount; i++) {
                const td = threadData[i];
                const curAng = td.ang + time * 0.12;
                const radWave = (td.rad + Math.sin(time * 1.4 + td.phase) * 1.1) * deployProgress;
                const tx = currentTarget.x + Math.cos(curAng) * radWave;
                const tz = currentTarget.z + Math.sin(curAng) * radWave;
                const flowY = Math.sin(time * 2.2 + td.phase) * 2.4;
                const yTop = currentTarget.y + td.topY + flowY;
                const curLen = td.len * threadDropT * (0.85 + Math.sin(time * 1.8 + i) * 0.15);
                const yBot = yTop - curLen;
                const swayX = Math.sin(time * 1.5 + td.phase) * 0.7 * threadDropT;
                const swayZ = Math.cos(time * 1.5 + td.phase) * 0.7 * threadDropT;
                tArr[i * 6] = tx; tArr[i * 6 + 1] = yTop; tArr[i * 6 + 2] = tz;
                tArr[i * 6 + 3] = tx + swayX; tArr[i * 6 + 4] = yBot; tArr[i * 6 + 5] = tz + swayZ;
              }
              threadGeo.attributes.position.needsUpdate = true;
            }
          }

          updateDagengCanopy(time,modeTime,dagengFieldCenter,isDagengActive);
          updateDagengSpectacle(time,modeTime,delta,isDagengActive?dagengFieldCenter:currentTarget,isDagengActive);
          const targetShieldOp = STATE.gestureMode === 'SHIELD' ? 0.14 : 0;
          shieldOrbMesh.material.opacity = THREE.MathUtils.lerp(shieldOrbMesh.material.opacity, targetShieldOp, damp(0.08));
          shieldOrbMesh.visible = shieldOrbMesh.material.opacity > 0.01;
          shieldOrbMesh.position.lerp(currentTarget, damp(0.25));
          shieldOrbMesh.rotation.y = time * 0.3;

          renderWorldLayers();
          if(!startupFramePresented){startupFramePresented=true;void startup?.ready();}
        }

        // An independent camera and scene keep the casting pose intact while
        // the viewer turns the real sword geometry through every angle.
        const inspectionScene=new THREE.Scene();inspectionScene.background=new THREE.Color('#0a1019');
        const inspectionCamera=new THREE.PerspectiveCamera(42,APP_VIEW.width/APP_VIEW.height,.015,80);
        const inspectionOrbit={yaw:.12,pitch:.08,radius:6.7,dragging:false,lastX:0,lastY:0,subject:'main'};
        const inspectionTarget=new THREE.Vector3(0,2.30,0);let inspectionPausedTime=0;
        inspectionScene.add(new THREE.HemisphereLight('#d6f0ff','#353023',1.0));
        const inspectionKey=new THREE.DirectionalLight('#fff0d4',1.65);inspectionKey.position.set(3,6,5);inspectionScene.add(inspectionKey);
        const inspectionFill=new THREE.DirectionalLight('#b1dbff',.95);inspectionFill.position.set(-4,2,3);inspectionScene.add(inspectionFill);
        const inspectionRim=new THREE.DirectionalLight('#7affcd',1.7);inspectionRim.position.set(2,5,-4);inspectionScene.add(inspectionRim);
        const inspectionMain=new THREE.Group();inspectionMain.position.y=.85;inspectionMain.rotation.x=-Math.PI/2;
        const inspectionBladeMat=bladeMat.clone(),inspectionHiltMat=hiltMat.clone();
        inspectionBladeMat.emissiveIntensity=.025;inspectionHiltMat.emissiveIntensity=.018;
        const inspectionBlade=new THREE.Mesh(bladeGeo,inspectionBladeMat),inspectionHilt=new THREE.Mesh(hiltGeo,inspectionHiltMat);
        inspectionBlade.name='赏析·原始青竹剑身';inspectionHilt.name='赏析·原始竹节剑柄';inspectionMain.add(inspectionBlade,inspectionHilt);inspectionScene.add(inspectionMain);
        const inspectionSpirit=new THREE.Group();inspectionSpirit.position.y=.85;inspectionSpirit.rotation.x=-Math.PI/2;inspectionSpirit.visible=false;
        const inspectionSpiritVolume=new THREE.InstancedMesh(shadowSwordGeo,shadowMat,1),inspectionSpiritGlow=new THREE.InstancedMesh(shadowSwordGeo,spiritGlowMat,1);
        const inspectionIdentity=new THREE.Matrix4();inspectionSpiritVolume.setMatrixAt(0,inspectionIdentity);inspectionSpiritGlow.setMatrixAt(0,inspectionIdentity);
        inspectionSpirit.add(inspectionSpiritVolume,inspectionSpiritGlow);inspectionScene.add(inspectionSpirit);
        const inspectionQiUniforms={uTime:{value:0},uOpacity:{value:1},uSplit:{value:1},uResolution:{value:new THREE.Vector2(APP_VIEW.width,APP_VIEW.height)}};
        const inspectionQiMaterial=createSwordQiMaterial(inspectionQiUniforms);
        const inspectionMainQi=new THREE.InstancedMesh(createSwordQiGeometry(1,1),inspectionQiMaterial,1);
        const inspectionSpiritQi=new THREE.InstancedMesh(createSwordQiGeometry(1,0,72),inspectionQiMaterial,1);
        inspectionMainQi.setMatrixAt(0,inspectionIdentity);inspectionSpiritQi.setMatrixAt(0,inspectionIdentity);
        inspectionMain.add(inspectionMainQi);inspectionSpirit.add(inspectionSpiritQi);
        inspectionMainQi.frustumCulled=inspectionSpiritQi.frustumCulled=false;
        // Share the filament vertices, while keeping inspection instances, draw ranges and uniforms independent of combat.
        const inspectionLightningUniforms=THREE.UniformsUtils.clone(swordLightningUniforms);
        const inspectionLightningMaterial=createFilamentMaterial(inspectionLightningUniforms,true);
        function createInspectionLightning(role,phase){
          const geometry=new THREE.BufferGeometry();
          for(const [name,attribute] of Object.entries(swordLightningGeo.attributes)){
            if(name!=='aSwordRole'&&name!=='aInstanceSeed')geometry.setAttribute(name,attribute);
          }
          geometry.setAttribute('aSwordRole',new THREE.InstancedBufferAttribute(new Float32Array([role]),1));
          geometry.setAttribute('aInstanceSeed',new THREE.InstancedBufferAttribute(new Float32Array([phase]),1));
          geometry.setDrawRange(0,geometry.attributes.position.count);
          const lightning=new THREE.InstancedMesh(geometry,inspectionLightningMaterial,1);
          lightning.name=role?'赏析·青竹本命剑辟邪神雷':'赏析·通透剑光辟邪神雷';
          lightning.setMatrixAt(0,inspectionIdentity);lightning.instanceMatrix.needsUpdate=true;
          lightning.frustumCulled=false;lightning.visible=false;return lightning;
        }
        const inspectionMainLightning=createInspectionLightning(1,0);
        const inspectionSpiritLightning=createInspectionLightning(0,.61803398875);
        inspectionMain.add(inspectionMainLightning);inspectionSpirit.add(inspectionSpiritLightning);
        const inspectionBase=new THREE.Mesh(new THREE.CylinderGeometry(.43,.54,.14,64),
          new THREE.MeshPhysicalMaterial({color:'#172a30',metalness:.72,roughness:.32,clearcoat:.6}));
        inspectionBase.position.y=.10;inspectionScene.add(inspectionBase);
        const inspectionRing=new THREE.Mesh(new THREE.TorusGeometry(.47,.008,8,96),
          new THREE.MeshBasicMaterial({color:'#6ad7ac',transparent:true,opacity:.45,depthWrite:false,blending:THREE.AdditiveBlending}));
        inspectionRing.rotation.x=-Math.PI/2;inspectionRing.position.y=.18;inspectionScene.add(inspectionRing);
        function stopInspectionDrag(){inspectionOrbit.dragging=false;renderer.domElement.style.cursor=STATE.inspectMode?'grab':'';}
        function startInspectionDrag(x,y){const p=toAppPoint(x,y);x=p.x;y=p.y;inspectionOrbit.dragging=true;inspectionOrbit.lastX=x;inspectionOrbit.lastY=y;renderer.domElement.style.cursor='grabbing';}
        function dragInspection(x,y){
          if(!inspectionOrbit.dragging)return;
          const point=toAppPoint(x,y);x=point.x;y=point.y;
          inspectionOrbit.yaw-=(x-inspectionOrbit.lastX)*.008;
          inspectionOrbit.pitch=THREE.MathUtils.clamp(inspectionOrbit.pitch+(y-inspectionOrbit.lastY)*.008,-1.53,1.53);
          inspectionOrbit.lastX=x;inspectionOrbit.lastY=y;
        }
        function setInspectionSubject(subject){
          inspectionOrbit.subject=subject;inspectionMain.visible=subject==='main';inspectionSpirit.visible=subject==='spirit';
          document.getElementById('inspection-name').textContent=subject==='main'?'青竹本命剑':'通透剑光';
          for(const type of ['main','spirit']){
            const button=document.getElementById('inspect-'+type);button.classList.toggle('active',subject===type);button.setAttribute('aria-pressed',String(subject===type));
          }
        }
        function toggleInspection(force){
          const enabled=typeof force==='boolean'?force:!STATE.inspectMode;
          if(enabled===STATE.inspectMode)return;
          if(enabled&&!unlocks.require('inspect'))return;
          if (enabled) stopWebcamDrag();
          swordAudio.setPaused(enabled||isInteractionOverlayOpen());
          STATE.inspectMode=enabled;STATE.breathHeld=false;STATE.keys.left=false;clearFlightInput();releaseLookControl();stopInspectionDrag();
          document.body.classList.toggle('inspection-mode',enabled);document.getElementById('inspection-overlay').hidden=!enabled;
          document.getElementById('inspect-entry').setAttribute('aria-pressed',String(enabled));
          document.getElementById('cast-flash').style.opacity='0';
          if(enabled){setInspectionSubject(inspectionOrbit.subject);renderer.domElement.style.touchAction='none';}
          else{renderer.domElement.style.touchAction='';updateHUD();}
        }
        function renderInspection(time,delta){
          if(!inspectionOrbit.dragging){const roll=delta*STATE.spinRPM*Math.PI/30;inspectionMain.rotateZ(roll);inspectionSpirit.rotateZ(roll);}
          inspectionMainQi.visible=inspectionSpiritQi.visible=STATE.swordQiEnabled;
          inspectionQiUniforms.uTime.value=time;inspectionQiUniforms.uResolution.value.set(APP_VIEW.width,APP_VIEW.height);
          const inspectionLightningDensity=electricDensity();
          inspectionMainLightning.visible=inspectionSpiritLightning.visible=inspectionLightningDensity>0;
          updateFXUniforms(inspectionLightningUniforms,time,inspectionLightningDensity>0?1.08:0);
          inspectionLightningUniforms.uDensity.value=inspectionLightningDensity;
          inspectionLightningUniforms.uSplit.value=1;inspectionLightningUniforms.uGiant.value=0;
          const aspect=APP_VIEW.width/APP_VIEW.height;
          if(inspectionCamera.aspect!==aspect){inspectionCamera.aspect=aspect;inspectionCamera.updateProjectionMatrix();}
          const r=inspectionOrbit.radius,cp=Math.cos(inspectionOrbit.pitch);
          inspectionCamera.position.set(inspectionTarget.x+Math.sin(inspectionOrbit.yaw)*cp*r,
            inspectionTarget.y+Math.sin(inspectionOrbit.pitch)*r,inspectionTarget.z+Math.cos(inspectionOrbit.yaw)*cp*r);
          inspectionCamera.lookAt(inspectionTarget);inspectionCamera.updateMatrixWorld(true);
          shadowUniforms.uTime.value=time;shadowUniforms.uOpacityBoost.value=1;
          shadowUniforms.uTransparency.value=STATE.lightTransparency;
          renderer.clear();renderer.render(inspectionScene,inspectionCamera);
          renderCopyrightWatermark();
        }
        document.getElementById('inspect-entry').addEventListener('click',event=>{event.stopPropagation();toggleInspection(true);});
        document.getElementById('inspect-close').addEventListener('click',()=>toggleInspection(false));
        document.getElementById('inspect-main').addEventListener('click',()=>setInspectionSubject('main'));
        document.getElementById('inspect-spirit').addEventListener('click',()=>setInspectionSubject('spirit'));
        window.addEventListener('blur',stopInspectionDrag);window.addEventListener('pointercancel',stopInspectionDrag);
        window.addEventListener('pointerup',stopInspectionDrag);
        document.addEventListener('visibilitychange',()=>{if(document.hidden)stopInspectionDrag();});


        // Visibility belongs to the interface, independently of spell state,
        // render quality, camera tracking and the active inspection scene.
        const uiWindowDefinitions=[
          ['status-window','御剑状态','combat'],['camera-window','摄像头','combat'],
          ['quality-window','画质选择','combat'],['fx-panel','灵力调节','combat'],
          ['formation-window','招式面板','combat'],['dageng-cutscene-banner','施法横幅','combat'],
          ['skill-toast','提示消息','combat'],['inspection-info-window','赏剑信息','inspect'],
          ['inspection-controls-window','赏剑操作','inspect']
        ];
        const uiWindowRegistry=new Map();
        const uiVisibilityButton=document.getElementById('ui-visibility-button');
        const uiVisibilityMenu=document.getElementById('ui-visibility-menu');
        const uiWindowList=document.getElementById('ui-window-list');
        const mobileStatusToggle=document.getElementById('mobile-status-toggle');
        function setMobileStatusExpanded(expanded){
          document.getElementById('status-window').classList.toggle('mobile-details-open',expanded);
          mobileStatusToggle.setAttribute('aria-expanded',String(expanded));
          mobileStatusToggle.textContent=expanded?'收起详情 ▴':'任务 / 详情 ▾';
        }
        mobileStatusToggle.addEventListener('click',()=>setMobileStatusExpanded(mobileStatusToggle.getAttribute('aria-expanded')!=='true'));
        // Native scrolling follows physical axes in some rotated WebViews.
        // Map the spell strip swipe through the same logical viewport as gameplay.
        const mobileFormationBar=document.getElementById('formation-bar');
        let formationSwipe=null;
        mobileFormationBar.addEventListener('touchstart',event=>{
          formationSwipe=null;
          if(!APP_VIEW.rotation||event.touches.length!==1)return;
          const touch=event.touches[0],point=toAppPoint(touch.clientX,touch.clientY);
          formationSwipe={id:touch.identifier,x:point.x,y:point.y,left:mobileFormationBar.scrollLeft,moved:false};
        },{passive:true});
        mobileFormationBar.addEventListener('touchmove',event=>{
          if(!formationSwipe)return;
          if(event.touches.length!==1){formationSwipe=null;return;}
          const touch=Array.from(event.touches).find(t=>t.identifier===formationSwipe.id);if(!touch)return;
          const point=toAppPoint(touch.clientX,touch.clientY),dx=formationSwipe.x-point.x;
          if(!formationSwipe.moved&&Math.abs(dx)<6)return;
          formationSwipe.moved=true;event.preventDefault();
          mobileFormationBar.scrollLeft=formationSwipe.left+dx;
        },{passive:false});
        mobileFormationBar.addEventListener('touchend',event=>{if(formationSwipe?.moved)event.preventDefault();formationSwipe=null;},{passive:false});
        mobileFormationBar.addEventListener('touchcancel',()=>{formationSwipe=null;},{passive:true});
        function isInterfaceTarget(target){return !!target?.closest?.('.invite-overlay, .unlock-overlay, .author-promo-overlay, .game-guide-overlay, .ui-manager, .window-hide-button, .hud-plaque, .webcam-panel, .bottom-dock, .quality-switch, .fx-panel, .inspection-ui, #skill-toast, #dageng-cutscene-banner');}
        function setUiWindowVisible(id,visible){
          const item=uiWindowRegistry.get(id);if(!item)return;
          if (id === 'camera-window' && !visible) stopWebcamDrag();
          item.element.classList.toggle('ui-window-hidden',!visible);
          item.option.setAttribute('aria-pressed',String(visible));
          item.status.textContent=visible?'显示':'隐藏';
        }
        function setUiMenuOpen(open,focusLauncher=false){
          if(open&&appStage.classList.contains('mobile-layout'))setMobileStatusExpanded(false);
          uiVisibilityMenu.hidden=!open;uiVisibilityButton.setAttribute('aria-expanded',String(open));
          if(focusLauncher)uiVisibilityButton.focus();
        }
        function closeUiVisibilityMenu(){
          if(uiVisibilityMenu.hidden)return false;
          setUiMenuOpen(false,true);return true;
        }
        for(const [id,name,context]of uiWindowDefinitions){
          const element=document.getElementById(id);
          const option=document.createElement('button');option.type='button';option.className='ui-window-option';
          option.dataset.context=context;option.setAttribute('aria-pressed','true');option.setAttribute('aria-controls',id);
          const label=document.createElement('span');label.textContent=name;
          const status=document.createElement('span');status.className='ui-window-status';status.textContent='显示';
          option.appendChild(label);option.appendChild(status);uiWindowList.appendChild(option);
          uiWindowRegistry.set(id,{element,option,status});
          option.addEventListener('click',event=>{event.stopPropagation();setUiWindowVisible(id,element.classList.contains('ui-window-hidden'));});
          const hide=id==='camera-window'?document.getElementById('toggle-webcam-btn'):document.createElement('button');
          hide.type='button';hide.className='window-hide-button';hide.textContent='−';
          hide.title='隐藏'+name+'窗口';hide.setAttribute('aria-label',hide.title);hide.setAttribute('aria-controls',id);
          if(id!=='camera-window'){
            const host=id==='fx-panel'?document.getElementById('fx-window-heading'):element;host.appendChild(hide);
          }
          hide.addEventListener('click',event=>{
            event.preventDefault();event.stopPropagation();setUiWindowVisible(id,false);uiVisibilityButton.focus();
          });
        }
        if(appStage.classList.contains('mobile-layout')){
          for(const id of ['camera-window','quality-window','fx-panel'])setUiWindowVisible(id,false);
        }
        uiVisibilityButton.addEventListener('click',event=>{event.stopPropagation();setUiMenuOpen(uiVisibilityMenu.hidden);});
        document.getElementById('ui-menu-close').addEventListener('click',()=>setUiMenuOpen(false,true));
        document.getElementById('ui-show-all').addEventListener('click',()=>{
          for(const [id]of uiWindowRegistry)setUiWindowVisible(id,true);setUiMenuOpen(false,true);
        });
        document.getElementById('ui-hide-all').addEventListener('click',()=>{
          for(const [id]of uiWindowRegistry)setUiWindowVisible(id,false);setUiMenuOpen(false,true);
        });
        window.addEventListener('pointerdown',event=>{
          if(!uiVisibilityMenu.hidden&&!event.target.closest('.ui-manager'))setUiMenuOpen(false);
        });


        const gameGuideOverlay=document.getElementById('game-guide-overlay'),gameGuidePanel=document.getElementById('game-guide-panel');
        function isInteractionOverlayOpen(){return !gameGuideOverlay.hidden||window.QingyuanAuthorPromo.isOpen||window.QingyuanUnlocks?.isOpen===true||window.QingyuanInvitation?.isOpen===true;}
        function openGameGuide(section='guide-start'){
          swordAudio.setPaused(true);STATE.breathHeld=false;
          clearFlightInput();
          releaseLookControl();
          cancelTouchNavigation();
          setUiMenuOpen(false);gameGuideOverlay.hidden=false;refreshCameraDiagnostic();
          document.getElementById('game-guide-close').focus();
          if(section==='guide-start')document.getElementById('game-guide-content').scrollTop=0;
          else document.getElementById(section)?.scrollIntoView({block:'start'});
        }
        function closeGameGuide(){window.QingyuanPrivateUnlock?.close?.();gameGuideOverlay.hidden=true;swordAudio.setPaused(STATE.inspectMode||isInteractionOverlayOpen());uiVisibilityButton.focus();}
        function handleGameGuideKey(event){
          if(event.code==='F1'){event.preventDefault();if(!event.repeat)openGameGuide();return true;}
          if(!isInteractionOverlayOpen())return false;
          if(event.code==='Escape'){event.preventDefault();closeGameGuide();}
          else if(event.code==='Tab'){
            const items=Array.from(gameGuidePanel.querySelectorAll('button:not([disabled]),a[href],summary,[tabindex="0"]'));
            const first=items[0],last=items.at(-1);
            if(event.shiftKey&&document.activeElement===first){event.preventDefault();last?.focus();}
            else if(!event.shiftKey&&document.activeElement===last){event.preventDefault();first?.focus();}
          }
          return true;
        }
        document.getElementById('ui-open-guide').addEventListener('click',()=>openGameGuide());
        document.getElementById('ui-camera-help').addEventListener('click',()=>openGameGuide('guide-camera'));
        webcamStatusEl.addEventListener('click', event => {
          if (!event.detail || !skipWebcamStatusClick) openGameGuide('guide-camera');
        });
        document.getElementById('game-guide-close').addEventListener('click',closeGameGuide);
        gameGuideOverlay.addEventListener('click',event=>{if(event.target===gameGuideOverlay)closeGameGuide();});
        document.getElementById('camera-retry-button').addEventListener('click',()=>{
          if(STATE.controlMode==='HAND')stopHandTracking();void startHandTracking();
        });
        document.getElementById('camera-stop-button').addEventListener('click',()=>{stopHandTracking();syncModeFromKeys();});
        refreshCameraDiagnostic();
        window.QingyuanAuthorPromo.setHooks({
          onOpen(){
            gameGuideOverlay.hidden=true;
            swordAudio.setPaused(true);
            STATE.breathHeld=false;
            clearFlightInput();
            releaseLookControl();
            cancelTouchNavigation();
            setUiMenuOpen(false);
          },
          onClose(){swordAudio.setPaused(STATE.inspectMode||isInteractionOverlayOpen());}
        });


        window.QingyuanInvitation.setHooks({
          onOpen(){
            gameGuideOverlay.hidden=true;swordAudio.setPaused(true);STATE.breathHeld=false;
            clearFlightInput();releaseLookControl();cancelTouchNavigation();setUiMenuOpen(false);
            for(const key of Object.keys(STATE.keys))STATE.keys[key]=false;
          },
          onClose(){swordAudio.setPaused(STATE.inspectMode||isInteractionOverlayOpen());}
        });

        unlocks.setHooks({
          onOpen(){
            gameGuideOverlay.hidden=true;swordAudio.setPaused(true);STATE.breathHeld=false;
            clearFlightInput();releaseLookControl();cancelTouchNavigation();setUiMenuOpen(false);
            for(const key of Object.keys(STATE.keys))STATE.keys[key]=false;
          },
          onClose(){swordAudio.setPaused(STATE.inspectMode||isInteractionOverlayOpen());},
          isActive(id){
            const modes={dageng:'DAGENG',dragon:'THUNDER_DRAGON',giant:'GIANT',lotus:'LOTUS'};
            if(modes[id])return STATE.gestureMode===modes[id];
            return {inspect:STATE.inspectMode,lightning:STATE.lightningEnabled,qi:STATE.swordQiEnabled,
              split:STATE.splitEnabled,fx:fxPanel.open&&!fxPanel.classList.contains('ui-window-hidden'),hand:STATE.controlMode==='HAND'}[id]===true;
          },
          activate(id){
            const modes={dageng:'DAGENG',dragon:'THUNDER_DRAGON',giant:'GIANT',lotus:'LOTUS'};
            if(modes[id]){toggleManualFormation(modes[id]);return;}
            if(id==='inspect'){toggleInspection();return;}
            if(id==='lightning'){toggleLightningBtn.click();return;}
            if(id==='qi'){qiToggle.click();return;}
            if(id==='split'){toggleSplitBtn.click();return;}
            if(id==='hand'){if(STATE.controlMode==='HAND')stopHandTracking();else void startHandTracking();return;}
            if(id==='fx'){
              if(!unlocks.require('fx'))return;
              const wasOpen=fxPanel.open&&!fxPanel.classList.contains('ui-window-hidden');
              setUiWindowVisible('fx-panel',true);fxPanel.open=!wasOpen;
            }
          },
          onChange(){
            if(!unlocks.has('lightning'))STATE.lightningEnabled=false;
            if(!unlocks.has('qi'))STATE.swordQiEnabled=false;
            if(!unlocks.has('split'))STATE.splitEnabled=false;
            if(!unlocks.has('fx'))fxPanel.open=false;
            if(!unlocks.has('hand')&&STATE.controlMode==='HAND')stopHandTracking();
            if(!unlocks.has('inspect')&&STATE.inspectMode)toggleInspection(false);
            if(formationUnlockFeature[STATE.gestureMode]&&!unlocks.has(formationUnlockFeature[STATE.gestureMode]))setFormationMode('DRAGON',true);
            qiToggle.classList.toggle('active',STATE.swordQiEnabled);qiToggle.setAttribute('aria-pressed',String(STATE.swordQiEnabled));
            document.getElementById('sword-qi-text').textContent=STATE.swordQiEnabled?'流云剑气：开':'流云剑气：关';
            toggleSplitBtn.classList.toggle('active',STATE.splitEnabled);toggleSplitBtn.setAttribute('aria-pressed',String(STATE.splitEnabled));
            document.getElementById('split-btn-text').textContent=STATE.splitEnabled?'剑影分光：开':'剑影分光：关';
            updateLightningUI();updateHUD();
          }
        });

        const orientationButton=document.getElementById('screen-orientation-button');
        orientationButton.addEventListener('click',event=>{
          event.preventDefault();event.stopPropagation();
          APP_VIEW.requested=APP_VIEW.width>=APP_VIEW.height?'portrait':'landscape';
          const serial=++orientationRequestSerial;resizeAppViewport();
          void tryNativeOrientation(APP_VIEW.requested,serial);
        });
        resizeAppViewport();
        toyBridge.subscribeContainer(()=>{resizeAppViewport();refreshCameraDiagnostic();});
        void toyBridge.connect().then(()=>refreshCameraDiagnostic());

        const spiritModelRoots=[bladeInstanced,hiltInstanced,shadowInstanced,shadowGlowInstanced,swordLightningInstanced,
          lightningLines,thunderDragonGroup,dagengGroup,lotusDiscMesh,lotusEffectsGroup,shieldOrbMesh,swordQiGroup];
        spiritModelRoots.forEach(root=>root.traverse(node=>node.layers.set(1)));
        scene.traverse(node=>{if(node.isLight)node.layers.enable(1);});
        configureDragonRenderLayers();
        renderer.autoClear=false;
        renderer.shadowMap.autoUpdate=false;
        renderer.shadowMap.needsUpdate=true;
        updateHUD();
        await startup?.step(97,'正在点亮初始画面…');
        animate();
      }
      function launchQingyuanToy(){
        void initQingyuanToy().catch(error=>{
          console.error('Qingyuan initialization failed:',error);
          window.QingyuanLoading?.fail(error,'画面初始化失败，请重新加载，或更新 B站 App 后重试。');
          const status=document.getElementById('mode-desc');
          if(status)status.textContent='画面初始化失败，请重新打开页面，或更新 B站 App 后重试。';
        });
      }
      // The game remains usable with keyboard/touch even if the SDK CDN is slow or unavailable.
      if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',launchQingyuanToy,{once:true});
      else launchQingyuanToy();
    
