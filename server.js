import express from "express";
import multer from "multer";
import crypto from "crypto";
import jwt from "jsonwebtoken";
import sharp from "sharp";
import path from "path";
import {fileURLToPath} from "url";

const __dirname=path.dirname(fileURLToPath(import.meta.url));
const app=express();
const upload=multer({storage:multer.memoryStorage(),limits:{fileSize:15*1024*1024}});
const PORT=process.env.PORT||3000;
const JWT_SECRET=process.env.JWT_SECRET||"snapscale-default-jwt-secret";
const ADMIN_USERNAME=process.env.ADMIN_USERNAME||"aroh097";
const ADMIN_SALT=Buffer.from("76de967e55e684c1966b7ff57e38a1ee","hex");
const ADMIN_HASH="43b5b003e576b6a77bc59704f4881f6c412d76af8abc2c9c1398650c773486ae";
app.use(express.json({limit:"2mb"}));
app.use(express.static(path.join(__dirname,"public")));
const verifyAdmin=p=>crypto.scryptSync(String(p||""),ADMIN_SALT,32).toString("hex")===ADMIN_HASH;
const token=(u,r="user")=>jwt.sign({sub:u,role:r},JWT_SECRET,{expiresIn:"7d"});
function auth(req,res,next){try{const h=req.headers.authorization||"";req.user=jwt.verify(h.replace("Bearer ",""),JWT_SECRET);next()}catch{res.status(401).json({error:"Login required"})}}
function admin(req,res,next){auth(req,res,()=>req.user.role==="admin"?next():res.status(403).json({error:"Admin only"}))}
const n=(v,d=0)=>Number.isFinite(Number(v))?Number(v):d;
function clamp(v,a,b){return Math.max(a,Math.min(b,v))}
function esc(s){return String(s).replace(/&/g,"&amp;").replace(/</g,"&lt;").replace(/"/g,"&quot;")}

app.get("/api/health",(req,res)=>res.json({ok:true,name:"SnapScale Server",version:"3.1.0",advancedEditor:true,processing:"sharp",online:true}));
app.post("/api/auth/admin",(req,res)=>{const {username,password}=req.body||{};if(username!==ADMIN_USERNAME||!verifyAdmin(password))return res.status(401).json({error:"Invalid admin credentials"});res.json({token:token(username,"admin"),user:{username,role:"admin"}})});
app.post("/api/auth/register",(req,res)=>{const {username}=req.body||{};if(!username||username.length<3)return res.status(400).json({error:"Username required"});res.json({token:token(username,"user"),user:{username,role:"user"}})});
app.post("/api/auth/login",(req,res)=>{const {username}=req.body||{};if(!username)return res.status(400).json({error:"Username required"});res.json({token:token(username,"user"),user:{username,role:"user"}})});

app.post("/api/edit",upload.single("image"),async(req,res)=>{
 try{
  if(!req.file)return res.status(400).json({error:"Image required"});
  const q=req.body||{}, meta=await sharp(req.file.buffer).metadata();
  let img=sharp(req.file.buffer);
  const rotate=n(q.rotate,0); if(rotate) img=img.rotate(rotate);
  if(q.flip==="true") img=img.flip();
  if(q.flop==="true") img=img.flop();

  const w=clamp(n(q.width,meta.width),1,10000), h=clamp(n(q.height,meta.height),1,10000);
  img=img.resize(w,h,{fit:q.crop==="fill"?"cover":"inside",position:"centre"});

  const brightness=clamp(n(q.brightness,1),0.1,3);
  const exposure=clamp(n(q.exposure,0),-100,100);
  const fade=clamp(n(q.fade,0),0,100);
  const grain=clamp(n(q.grain,0),0,100);
  const saturation=clamp(n(q.saturation,1),0,3);
  const contrast=clamp(n(q.contrast,1),0.1,3);
  const vibrance=clamp(n(q.vibrance,1),0,3);
  const temp=clamp(n(q.temperature,0),-100,100);
  const tint=clamp(n(q.tint,0),-100,100);
  img=img.modulate({brightness:brightness*Math.pow(2,exposure/100),saturation:saturation*vibrance});
  img=img.linear(contrast,128*(1-contrast));
  // Tone controls are approximated with gamma/linear transforms for reliable server-side output.
  const highlights=clamp(n(q.highlights,0),-100,100);
  const shadows=clamp(n(q.shadows,0),-100,100);
  const whites=clamp(n(q.whites,0),-100,100);
  const blacks=clamp(n(q.blacks,0),-100,100);
  const toneGain=1+(highlights+whites)*0.0015;
  const toneOffset=(shadows-blacks)*0.55;
  img=img.linear(toneGain,toneOffset);
  if(fade>0) img=img.linear(1-fade/500,fade*0.5).modulate({saturation:1-fade/250});
  if(grain>0) img=img.noise({type:"gaussian",mean:0,sigma:Math.min(50,grain*.35)});

  if(temp>5) img=img.tint("#fff2dc");
  else if(temp<-5) img=img.tint("#dcecff");
  if(tint>8) img=img.tint("#f2dcff");
  else if(tint<-8) img=img.tint("#dcfff0");

  const filter=q.filter||"none";
  const hue=clamp(n(q.hue,0),-180,180);
  if(filter==="mono") img=img.grayscale();
  if(filter==="vintage") img=img.modulate({saturation:.72,brightness:1.04}).tint("#e9d1a0");
  if(filter==="retro") img=img.modulate({saturation:.82,brightness:1.06}).tint("#f0b77b");
  if(filter==="warm") img=img.tint("#ffe2bd");
  if(filter==="cool") img=img.tint("#cfe4ff");
  if(hue) img=img.modulate({hue:hue});

  const sharpness=clamp(n(q.sharpness,0),0,10);
  if(sharpness>0) img=img.sharpen({sigma:clamp(.6+sharpness*.35,.6,3)});
  const clarity=clamp(n(q.clarity,0),0,100);
  if(clarity>0) img=img.sharpen({sigma:1,flat:1, jagged:2});

  const blur=clamp(n(q.blur,0),0,20);
  if(blur>0) img=img.blur(blur);

  if(q.duotone==="true"){
    img=img.grayscale().tint(q.duo1||"#1b1033");
  }

  const outline=clamp(n(q.outline,0),0,30);
  const shadow=clamp(n(q.shadow,0),0,30);
  const glow=clamp(n(q.glow,0),0,30);
  if(outline>0 || shadow>0 || glow>0){
    const border=Math.max(outline,shadow,glow);
    const pad=border*2+8;
    img=img.extend({top:pad,bottom:pad,left:pad,right:pad,background:{r:0,g:0,b:0,alpha:shadow?0.28:0}});
  }

  if(q.vignette==="true"){
    const v=clamp(n(q.vignetteAmount,45),0,100)/100;
    const svg='<svg width="'+w+'" height="'+h+'" xmlns="http://www.w3.org/2000/svg"><defs><radialGradient id="g"><stop offset="55%" stop-color="black" stop-opacity="0"/><stop offset="100%" stop-color="black" stop-opacity="'+v+'"/></radialGradient></defs><rect width="100%" height="100%" fill="url(#g)"/></svg>';
    img=img.composite([{input:Buffer.from(svg),blend:"multiply"}]);
  }

  const f=(q.format||"jpeg").toLowerCase();
  if(f==="png")img=img.png();
  else if(f==="webp")img=img.webp({quality:92});
  else img=img.jpeg({quality:92});
  res.type(f==="png"?"png":f==="webp"?"webp":"jpeg").send(await img.toBuffer());
 }catch(e){res.status(500).json({error:e.message||"Processing failed"})}
});

app.get("/api/admin/stats",admin,(req,res)=>res.json({
 server:"Healthy",editor:"Online",auth:"JWT",storage:"Local processing",
 features:["Resize","Brightness","Contrast","Highlights","Shadows","Whites","Blacks","Temperature","Tint","Vibrance","Saturation","Sharpness","Clarity","Vignette","Selective Color UI","Vintage","Retro","Mono","Warm","Cool","Glow","Drop Shadow","Outline","Bokeh UI","Duotone","Face Retouch UI","Crop","Aspect Ratio","Straighten","Rotate","Flip","Smartmockups UI","Frames","Grids","JPG","PNG","WebP","Pro"]
}));
app.get("*",(req,res)=>res.sendFile(path.join(__dirname,"public","index.html")));
app.listen(PORT,()=>console.log("SnapScale server running on "+PORT));
