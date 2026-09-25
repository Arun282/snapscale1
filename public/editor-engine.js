(() => {
  const CDN = "https://cdn.jsdelivr.net/npm/fabric@6.7.1/dist/index.min.js";
  let fabricReady = false, canvas = null, baseImage = null, history = [], histPos = -1, drawing = false, cutoutMode = false, eraserMode = false;
  const $ = id => document.getElementById(id);
  const toast2 = m => window.toast ? window.toast(m) : console.log(m);

  function loadFabric(){
    if(window.fabric){ init(); return; }
    const s=document.createElement("script"); s.src=CDN; s.onload=()=>{fabricReady=true;init()}; s.onerror=()=>toast2("Editor library load failed");
    document.head.appendChild(s);
  }

  function init(){
    if(canvas || !$("stage")) return;
    const stage=$("stage"), old=$("preview");
    const wrap=document.createElement("div");
    wrap.id="canvasWrap";
    wrap.style.cssText="position:absolute;inset:18px;display:flex;align-items:center;justify-content:center;z-index:5;overflow:hidden;border-radius:12px;";
    const c=document.createElement("canvas"); c.id="fabricCanvas"; c.width=900; c.height=600;
    c.style.cssText="max-width:100%;max-height:100%;touch-action:none;";
    wrap.appendChild(c); stage.appendChild(wrap);
    if(old) old.style.display="none";
    canvas=new fabric.Canvas(c,{preserveObjectStacking:true,selection:true});
    canvas.on("object:modified",()=>pushHistory());
    canvas.on("path:created",()=>pushHistory());
    window.ssCanvas=canvas;
    resizeCanvas();
    window.addEventListener("resize",resizeCanvas);
  }

  function resizeCanvas(){
    if(!canvas)return;
    const st=$("stage"), w=Math.max(320,st.clientWidth-36), h=Math.max(260,st.clientHeight-36);
    const ar=baseImage ? (baseImage.width/baseImage.height) : 1.5;
    let cw=w,ch=w/ar;if(ch>h){ch=h;cw=h*ar}
    canvas.setDimensions({width:Math.round(cw),height:Math.round(ch)});
    canvas.requestRenderAll();
  }

  function pushHistory(){
    if(!canvas)return;
    const json=canvas.toJSON(["name","locked","role"]);
    history=history.slice(0,histPos+1); history.push(json);
    if(history.length>50)history.shift();
    histPos=history.length-1;
  }
  async function restore(i){
    if(i<0||i>=history.length||!canvas)return;
    histPos=i; await canvas.loadFromJSON(history[i]); canvas.requestRenderAll();
  }
  window.undo=()=>{if(histPos>0)restore(histPos-1).then(()=>toast2("Undo"))};
  window.redo=()=>{if(histPos<history.length-1)restore(histPos+1).then(()=>toast2("Redo"))};

  async function loadImage(file){
    if(!canvas)return;
    const url=URL.createObjectURL(file);
    const imgEl=new Image();
    imgEl.onload=async()=>{
      baseImage=imgEl;
      canvas.clear();
      const scale=Math.min(canvas.width/imgEl.width,canvas.height/imgEl.height);
      const img=new fabric.FabricImage(imgEl,{left:canvas.width/2,top:canvas.height/2,originX:"center",originY:"center",scaleX:scale,scaleY:scale,selectable:true,evented:true,name:"Background",role:"background"});
      canvas.add(img); canvas.sendObjectToBack(img); canvas.setActiveObject(img);
      canvas.backgroundColor="#101522";
      canvas.requestRenderAll(); history=[];histPos=-1;pushHistory();
      URL.revokeObjectURL(url);
      toast2("Photo loaded in professional editor");
    };
    imgEl.src=url;
  }

  function active(){return canvas&&canvas.getActiveObject()}
  function addText(){
    if(!canvas)return;
    const text=($("textValue")?.value||"SnapScale Text").trim();
    const o=new fabric.Textbox(text,{left:canvas.width/2-100,top:canvas.height/2-30,width:240,fontSize:Number($("fontSize")?.value||42),fill:$("textColor")?.value||"#ffffff",fontFamily:$("fontFamily")?.value||"Arial",fontWeight:$("bold")?.classList.contains("on")?"bold":"normal",shadow:"0 4px 12px rgba(0,0,0,.5)",editable:true,name:"Text"});
    canvas.add(o);canvas.setActiveObject(o);canvas.requestRenderAll();pushHistory();
  }
  function addShape(type){
    if(!canvas)return;
    let o;
    const fill=$("drawColor")?.value||"#ffd43b";
    if(type==="circle")o=new fabric.Circle({radius:55,fill,left:canvas.width/2-55,top:canvas.height/2-55});
    else if(type==="triangle")o=new fabric.Triangle({width:110,height:110,fill,left:canvas.width/2-55,top:canvas.height/2-55});
    else o=new fabric.Rect({width:140,height:90,fill,rx:12,ry:12,left:canvas.width/2-70,top:canvas.height/2-45});
    o.name="Shape";canvas.add(o);canvas.setActiveObject(o);pushHistory();
  }
  function addSticker(s){if(!canvas)return;const o=new fabric.Text(s,{left:canvas.width/2-25,top:canvas.height/2-25,fontSize:64,name:"Sticker"});canvas.add(o);canvas.setActiveObject(o);pushHistory();}
  function addPhoto(file){
    if(!canvas)return; const u=URL.createObjectURL(file); fabric.FabricImage.fromURL(u).then(img=>{img.set({left:canvas.width/2,top:canvas.height/2,originX:"center",originY:"center",scaleX:.35,scaleY:.35,name:"Photo Layer"});canvas.add(img);canvas.setActiveObject(img);pushHistory();URL.revokeObjectURL(u)});
  }

  function setFilter(type,value){
    const o=active() || baseImage; if(!o || o.type!=="image") return toast2("Select an image layer");
    const filters=[];
    if(type==="grayscale")filters.push(new fabric.filters.Grayscale());
    if(type==="sepia")filters.push(new fabric.filters.Sepia());
    if(type==="brightness")filters.push(new fabric.filters.Brightness({brightness:value}));
    if(type==="contrast")filters.push(new fabric.filters.Contrast({contrast:value}));
    if(type==="saturation")filters.push(new fabric.filters.Saturation({saturation:value}));
    if(type==="blur")filters.push(new fabric.filters.Blur({blur:value}));
    if(type==="noise")filters.push(new fabric.filters.Noise({noise:value}));
    if(type==="hue")filters.push(new fabric.filters.HueRotation({rotation:value}));
    o.filters=filters;o.applyFilters();canvas.requestRenderAll();pushHistory();
  }

  function applySelectedAdjust(id){
    const v=Number($(id)?.value||0); const o=active()||baseImage;
    if(!canvas||!o)return;
    if((active()?.type==="image") || baseImage){
      const map={brightness:["brightness",v],contrast:["contrast",v],saturation:["saturation",v],blur:["blur",v]};
      if(map[id])setFilter(map[id][0],map[id][1]);
    }
  }

  function exportCanvas(fmt="png"){
    if(!canvas)return;
    const quality=Number($("quality")?.value||90)/100;
    const data=canvas.toDataURL({format:fmt==="jpg"?"jpeg":fmt,quality, multiplier:1});
    const a=document.createElement("a");a.href=data;a.download="snapscale-"+Date.now()+"."+ (fmt==="jpeg"?"jpg":fmt);a.click();toast2("Exported "+fmt.toUpperCase());
  }

  function deleteActive(){const o=active();if(o&&o.selectable){canvas.remove(o);canvas.discardActiveObject();canvas.requestRenderAll();pushHistory();}}
  function duplicateActive(){const o=active();if(!o)return; o.clone().then(c=>{c.set({left:(c.left||0)+20,top:(c.top||0)+20});canvas.add(c);canvas.setActiveObject(c);pushHistory()})}
  function toggleLock(){const o=active();if(!o)return;o.lockMovementX=o.lockMovementY=o.lockScalingX=o.lockScalingY=o.lockRotation=!o.lockMovementX;o.locked=o.lockMovementX;canvas.requestRenderAll();pushHistory()}
  function setOpacity(v){const o=active();if(o){o.set("opacity",v);canvas.requestRenderAll();pushHistory()}}

  function startBrush(mode){
    if(!canvas)return;
    canvas.isDrawingMode=true; canvas.freeDrawingBrush=new fabric.PencilBrush(canvas);
    canvas.freeDrawingBrush.width=Number($("drawSize")?.value||8);
    canvas.freeDrawingBrush.color=$("drawColor")?.value||"#ffd43b";
    canvas.freeDrawingBrush.opacity=Number($("drawOpacity")?.value||100)/100;
    drawing=true; toast2(mode==="erase"?"Eraser ready":"Draw mode ready");
  }
  function stopBrush(){if(canvas){canvas.isDrawingMode=false;drawing=false}}

  window.toolAction=(name)=>{
    if(["Perspective","Straighten"].includes(name)){toast2(name+" tool: select the photo and use rotate/skew controls");return}
    if(name==="Blemish"||name==="Teeth"||name==="Eyes"||name==="Reshape"||name==="SkinTone"||name==="RedEye"||name==="Detail"){toast2("Manual retouch: select image, then adjust filters");return}
    if(name==="ManualBrush"){startBrush("cutout");return}
    if(name==="Eraser"){startBrush("erase");return}
    if(name==="Gradient"){if(canvas){canvas.backgroundColor="linear-gradient";toast2("Use background color for canvas");}return}
    toast2(name+" is not an AI function; this editor uses manual tools.");
  };

  const oldOpen=window.openTool;
  window.openTool=(id,btn)=>{
    if(oldOpen)oldOpen(id,btn);
    if(id==="text")stopBrush();
    if(id==="draw"){startBrush("draw")}
    if(id==="layers")stopBrush();
    if(id==="cutout")stopBrush();
  };

  window.aspect=(ratio)=>{
    if(!canvas)return;
    const [rw,rh]=ratio.split(":").map(Number);
    if(!rw||!rh)return;
    const currentW=canvas.width,currentH=canvas.height,currentAR=currentW/currentH,targetAR=rw/rh;
    let nw=currentW,nh=currentH;
    if(targetAR>currentAR) nw=currentH*targetAR; else nh=currentW/targetAR;
    canvas.setDimensions({width:Math.round(nw),height:Math.round(nh)});
    if(baseImage){
      const obj=canvas.getObjects().find(x=>x.role==="background");
      if(obj){obj.set({left:nw/2,top:nh/2});}
    }
    canvas.requestRenderAll();pushHistory();toast2("Canvas ratio "+ratio);
  };
  window.rotate=(deg)=>{const o=active();if(o){o.rotate((o.angle||0)+deg);canvas.requestRenderAll();pushHistory()}else toast2("Select an object/photo first")};
  window.toggle=(name)=>{
    if(name==="flip"){const o=active();if(o){o.set("flipY",!o.flipY);canvas.requestRenderAll();pushHistory()}}
    else if(name==="flop"){const o=active();if(o){o.set("flipX",!o.flipX);canvas.requestRenderAll();pushHistory()}}
    else if(name==="glow"){const o=active();if(o){o.set("shadow",new fabric.Shadow({color:"#ffd43b",blur:25,offsetX:0,offsetY:0}));canvas.requestRenderAll();pushHistory()}}
    else if(name==="bokeh"){const o=active();if(o?.type==="image")setFilter("blur",.15)}
    else if(name==="retouch"){const o=active();if(o?.type==="image")setFilter("brightness",.08)}
    else toast2(name+" ready");
  };
  window.filter=(f)=>{
    const map={mono:"grayscale",vintage:"sepia",retro:"saturation",warm:"sepia",cool:"hue"};
    const vals={grayscale:0,sepia:0.35,saturation:.2,hue:0.55};
    setFilter(map[f]||"contrast",vals[map[f]]??.1);
  };
  window.frameStyle=(x)=>{if(!canvas)return;const r=new fabric.Rect({left:2,top:2,width:canvas.width-4,height:canvas.height-4,fill:"transparent",stroke:x==="double"?"#ffd43b":"#ffffff",strokeWidth:x==="circle"?12:8,rx:x==="rounded"?30:0,ry:x==="rounded"?30:0,selectable:false,evented:false,name:"Frame"});canvas.add(r);canvas.bringObjectToFront(r);pushHistory();toast2(x+" frame added")};
  window.save=(fmt)=>exportCanvas(fmt);

  document.addEventListener("DOMContentLoaded",()=>{
    loadFabric();
    $("file")?.addEventListener("change",e=>{const f=e.target.files?.[0];if(f){loadImage(f);}});
    $("addPhotoInput")?.addEventListener("change",e=>{const f=e.target.files?.[0];if(f)addPhoto(f)});
    document.querySelectorAll("[onclick*='addSticker']").forEach(b=>b.addEventListener("click",()=>addSticker(b.dataset.sticker||"⭐")));
    document.querySelectorAll("[data-live]").forEach(el=>el.addEventListener("input",()=>applySelectedAdjust(el.id)));
    document.addEventListener("keydown",e=>{if(e.key==="Delete")deleteActive();if((e.ctrlKey||e.metaKey)&&e.key==="z"){e.preventDefault();undo()}if((e.ctrlKey||e.metaKey)&&e.key==="y"){e.preventDefault();redo()}});
    window.addText=addText;window.addShape=addShape;window.deleteActive=deleteActive;window.duplicateActive=duplicateActive;window.toggleLock=toggleLock;window.setOpacity=setOpacity;window.startBrush=startBrush;window.stopBrush=stopBrush;
  });
})();

/* SnapScale editor reliability patch v4.1 */
(() => {
  const $=id=>document.getElementById(id);
  const toast=m=>window.toast?window.toast(m):console.log(m);
  const getCanvas=()=>window.ssCanvas;
  function imageTarget(){const c=getCanvas();if(!c)return null;const a=c.getActiveObject();return a&&a.type==="image"?a:c.getObjects().find(o=>o.role==="background"&&o.type==="image")||null}
  function filterValue(id){
    const el=$(id); if(!el)return 0;
    const v=Number(el.value||0);
    if(id==="brightness"||id==="contrast"||id==="saturation"||id==="vibrance") return v-1;
    if(id==="exposure") return v/100;
    if(id==="blur") return v/100;
    if(id==="hue") return v/180;
    return v/100;
  }
  function applyAdjust(id){
    const c=getCanvas(),o=imageTarget(); if(!c||!o)return;
    const map={brightness:"brightness",contrast:"contrast",saturation:"saturation",vibrance:"saturation",blur:"blur",hue:"hue"};
    const type=map[id]; if(!type)return;
    let value=filterValue(id);
    if(id==="vibrance") value*=0.55;
    if(id==="blur") value=Math.min(.8,Math.max(0,value));
    if(id==="hue") value*=Math.PI;
    const F=window.fabric?.filters;if(!F)return;
    const classes={brightness:F.Brightness,contrast:F.Contrast,saturation:F.Saturation,blur:F.Blur,hue:F.HueRotation};
    const Cls=classes[type]; if(!Cls)return;
    o.filters=(o.filters||[]).filter(f=>!["Brightness","Contrast","Saturation","Blur","HueRotation"].includes(f?.type));
    if(Math.abs(value)>0.0001){
      const opts=type==="blur"?{blur:value}:type==="hue"?{rotation:value}:{[type]:value};
      o.filters.push(new Cls(opts));
    }
    o.applyFilters();c.requestRenderAll();
  }
  const oldFilter=window.filter;
  window.filter=(f)=>{
    const c=getCanvas(),o=imageTarget();if(!c||!o){toast("Upload photo first");return}
    const F=window.fabric.filters;
    const map={mono:[F.Grayscale,{}],vintage:[F.Sepia,{alpha:0.45}],retro:[F.Saturation,{saturation:.35}],warm:[F.Sepia,{alpha:.25}],cool:[F.HueRotation,{rotation:.55}]};
    const item=map[f];
    o.filters=(o.filters||[]).filter(x=>!["Grayscale","Sepia","Saturation","HueRotation"].includes(x?.type));
    if(item)o.filters.push(new item[0](item[1]));
    o.applyFilters();c.requestRenderAll(); if(window.pushHistory)window.pushHistory(); toast(f==="mono"?"Black & White":f+" applied");
  };
  window.renderPreview=()=>{const c=getCanvas();if(c){c.requestRenderAll();toast("Live preview updated")}};
  window.save=async(fmt)=>{
    const c=getCanvas();if(!c){toast("Editor not ready");return}
    const q=Number($("quality")?.value||90)/100;
    const format=fmt==="jpg"?"jpeg":fmt;
    const a=document.createElement("a");
    a.href=c.toDataURL({format,quality:q,multiplier:1});
    a.download="snapscale-"+Date.now()+"."+((format==="jpeg")?"jpg":format);
    a.click();toast("Export ready");
  };
  window.addText=window.addText||(()=>toast("Text tool loading…"));
  document.addEventListener("DOMContentLoaded",()=>{
    const ids=["brightness","contrast","saturation","vibrance","blur","hue","exposure"];
    ids.forEach(id=>$(id)?.addEventListener("input",()=>applyAdjust(id)));
    document.querySelectorAll("[data-live]").forEach(el=>{
      const id=el.id;
      el.addEventListener("input",()=>{const v=$(id+"V");if(v)v.textContent=el.value;});
    });
    setTimeout(()=>{const c=getCanvas();if(c)c.requestRenderAll()},700);
  });
})();
