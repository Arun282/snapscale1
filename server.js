import express from "express";
import multer from "multer";
import crypto from "crypto";
import jwt from "jsonwebtoken";
import sharp from "sharp";
import path from "path";
import fs from "fs";
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
const clamp=(v,a,b)=>Math.max(a,Math.min(b,v));

app.get("/api/health",(req,res)=>res.json({ok:true,name:"SnapScale Server",version:"4.0.1",advancedEditor:true,processing:"sharp",online:true,ai:false}));
app.post("/api/auth/admin",(req,res)=>{const {username,password}=req.body||{};if(username!==ADMIN_USERNAME||!verifyAdmin(password))return res.status(401).json({error:"Invalid admin credentials"});res.json({token:token(username,"admin"),user:{username,role:"admin"}})});
app.post("/api/auth/register",(req,res)=>{const {username}=req.body||{};if(!username||username.length<3)return res.status(400).json({error:"Username required"});res.json({token:token(username,"user"),user:{username,role:"user"}})});
app.post("/api/auth/login",(req,res)=>{const {username}=req.body||{};if(!username)return res.status(400).json({error:"Username required"});res.json({token:token(username,"user"),user:{username,role:"user"}})});

app.post("/api/edit",upload.single("image"),async(req,res)=>{
 try{
  if(!req.file)return res.status(400).json({error:"Image required"});
  const q=req.body||{},meta=await sharp(req.file.buffer).metadata();
  let img=sharp(req.file.buffer);
  const rotate=n(q.rotate,0);if(rotate)img=img.rotate(rotate);
  if(q.flip==="true")img=img.flip();
  if(q.flop==="true")img=img.flop();
  let w=clamp(n(q.width,meta.width),1,10000),h=clamp(n(q.height,meta.height),1,10000);
  const targets={"1080p":[1920,1080],"2K":[2560,1440],"4K":[3840,2160]};
  if(targets[String(q.resolution||"")]){w=targets[q.resolution][0];h=targets[q.resolution][1]}
  img=img.resize({width:w,height:h,fit:"inside",position:"centre",withoutEnlargement:false});
  const brightness=clamp(n(q.brightness,1),.1,3),exposure=clamp(n(q.exposure,0),-100,100),saturation=clamp(n(q.saturation,1),0,3),contrast=clamp(n(q.contrast,1),.1,3),vibrance=clamp(n(q.vibrance,1),0,3);
  img=img.modulate({brightness:brightness*Math.pow(2,exposure/100),saturation:saturation*vibrance}).linear(contrast,128*(1-contrast));
  const highlights=clamp(n(q.highlights,0),-100,100),shadows=clamp(n(q.shadows,0),-100,100),whites=clamp(n(q.whites,0),-100,100),blacks=clamp(n(q.blacks,0),-100,100);
  img=img.linear(1+(highlights+whites)*.0015,(shadows-blacks)*.55);
  const fade=clamp(n(q.fade,0),0,100);if(fade)img=img.linear(1-fade/500,fade*.5).modulate({saturation:1-fade/250});
  const temp=clamp(n(q.temperature,0),-100,100),tint=clamp(n(q.tint,0),-100,100);
  if(temp>5)img=img.tint("#fff2dc");else if(temp<-5)img=img.tint("#dcecff");
  if(tint>8)img=img.tint("#f2dcff");else if(tint<-8)img=img.tint("#dcfff0");
  const filter=String(q.filter||"none"),hue=clamp(n(q.hue,0),-180,180);
  if(filter==="mono")img=img.grayscale();if(filter==="vintage")img=img.modulate({saturation:.72,brightness:1.04}).tint("#e9d1a0");if(filter==="retro")img=img.modulate({saturation:.82,brightness:1.06}).tint("#f0b77b");if(filter==="warm")img=img.tint("#ffe2bd");if(filter==="cool")img=img.tint("#cfe4ff");if(hue)img=img.modulate({hue});
  const sharpness=clamp(n(q.sharpness,0),0,10),clarity=clamp(n(q.clarity,0),0,100),blur=clamp(n(q.blur,0),0,20);
  if(sharpness)img=img.sharpen({sigma:clamp(.6+sharpness*.35,.6,3)});if(clarity)img=img.sharpen({sigma:1,flat:1,jagged:2});if(blur)img=img.blur(blur);
  if(q.duotone==="true")img=img.grayscale().tint(q.duo1||"#1b1033");
  const outline=clamp(n(q.outline,0),0,30),shadow=clamp(n(q.shadow,0),0,30),glow=clamp(n(q.glow,0),0,30);
  if(outline||shadow||glow){const pad=Math.max(outline,shadow,glow)*2+8;img=img.extend({top:pad,bottom:pad,left:pad,right:pad,background:{r:0,g:0,b:0,alpha:shadow?.28:0}})}
  if(q.vignette==="true"){const v=clamp(n(q.vignetteAmount,45),0,100)/100;const svg='<svg width="'+w+'" height="'+h+'" xmlns="http://www.w3.org/2000/svg"><defs><radialGradient id="g"><stop offset="55%" stop-color="black" stop-opacity="0"/><stop offset="100%" stop-color="black" stop-opacity="'+v+'"/></radialGradient></defs><rect width="100%" height="100%" fill="url(#g)"/></svg>';img=img.composite([{input:Buffer.from(svg),blend:"multiply"}])}
  const f=String(q.format||"jpeg").toLowerCase(),quality=clamp(n(q.quality,90),10,100);
  if(f==="png")img=img.png({compressionLevel:6});else if(f==="webp")img=img.webp({quality});else img=img.jpeg({quality,mozjpeg:quality>=85});
  res.type(f==="png"?"png":f==="webp"?"webp":"jpeg").send(await img.toBuffer());
 }catch(e){res.status(500).json({error:e.message||"Processing failed"})}
});

app.get("/api/admin/stats",admin,(req,res)=>res.json({server:"Healthy",editor:"Online",auth:"JWT",storage:"Local processing",ai:"Disabled by design",features:["Canvas Layers","Text","Stickers","Shapes","Drawing","Eraser","Crop","Aspect Ratio","Resize","Rotate","Flip","Perspective UI","Straighten UI","Background Color","Manual Cutout","Manual Brush","Opacity","Lock","Duplicate","50-step Undo/Redo","Zoom","Brightness","Contrast","Highlights","Shadows","Whites","Blacks","Temperature","Tint","Vibrance","Saturation","Sharpness","Clarity","Fade","Exposure","Hue","Vintage","Retro","Mono","Warm","Cool","Blur","Noise","Glow","Drop Shadow","Outline","Frames","JPG","PNG","WebP","Quality","4K Export","Pro"]}));

app.get("*",(req,res)=>{
 const p=path.join(__dirname,"public","index.html");
 fs.readFile(p,"utf8",(err,html)=>{
  if(err)return res.status(500).send("SnapScale unavailable");
  const injected=html.replace("</body>","<script src=\"/editor-engine.js\"></script></body>");
  res.type("html").send(injected);
 });
});
app.listen(PORT,()=>console.log("SnapScale server running on "+PORT));
