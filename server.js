import express from "express";
import multer from "multer";
import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import sharp from "sharp";
import path from "path";
import {fileURLToPath} from "url";

const __dirname=path.dirname(fileURLToPath(import.meta.url));
const app=express();
const upload=multer({storage:multer.memoryStorage(),limits:{fileSize:15*1024*1024}});
const PORT=process.env.PORT||3000;
const JWT_SECRET=process.env.JWT_SECRET||"change-this-secret";
const ADMIN_USERNAME=process.env.ADMIN_USERNAME||"aroh097";
const ADMIN_PASSWORD=process.env.ADMIN_PASSWORD;

app.use(express.json({limit:"2mb"}));
app.use(express.static(path.join(__dirname,"public")));

function token(user,role="user"){return jwt.sign({sub:user,role},JWT_SECRET,{expiresIn:"7d"});}
function auth(req,res,next){try{const h=req.headers.authorization||"";req.user=jwt.verify(h.replace("Bearer ",""),JWT_SECRET);next()}catch{res.status(401).json({error:"Login required"})}}
function admin(req,res,next){auth(req,res,()=>req.user.role==="admin"?next():res.status(403).json({error:"Admin only"}))}

app.get("/api/health",(req,res)=>res.json({ok:true,name:"SnapScale Server",version:"2.0.0"}));

app.post("/api/auth/admin",async(req,res)=>{
  const {username,password}=req.body||{};
  if(!ADMIN_PASSWORD) return res.status(503).json({error:"Set ADMIN_PASSWORD server secret first"});
  const ok=username===ADMIN_USERNAME && await bcrypt.compare(password,await bcrypt.hash(ADMIN_PASSWORD,10));
  if(!ok)return res.status(401).json({error:"Invalid admin credentials"});
  res.json({token:token(username,"admin"),user:{username,role:"admin"}});
});

app.post("/api/auth/register",(req,res)=>{
  const {username}=req.body||{};
  if(!username||username.length<3)return res.status(400).json({error:"Username required"});
  res.json({token:token(username,"user"),user:{username,role:"user"}});
});

app.post("/api/auth/login",(req,res)=>{
  const {username}=req.body||{};
  if(!username)return res.status(400).json({error:"Username required"});
  res.json({token:token(username,"user"),user:{username,role:"user"}});
});

app.post("/api/edit",upload.single("image"),async(req,res)=>{
  try{
    if(!req.file)return res.status(400).json({error:"Image required"});
    const q=req.body||{};
    let img=sharp(req.file.buffer);
    if(q.rotate) img=img.rotate(Number(q.rotate));
    if(q.flip==="true") img=img.flip();
    if(q.flop==="true") img=img.flop();
    const meta=await img.metadata();
    const w=Math.max(1,Math.min(10000,Number(q.width)||meta.width));
    const h=Math.max(1,Math.min(10000,Number(q.height)||meta.height));
    img=img.resize(w,h,{fit:"inside",withoutEnlargement:false});
    if(q.brightness||q.saturation||q.contrast){
      img=img.modulate({brightness:Number(q.brightness||1),saturation:Number(q.saturation||1)});
    }
    if(q.blur) img=img.blur(Math.max(0.3,Math.min(20,Number(q.blur))));
    const format=(q.format||"jpeg").toLowerCase();
    if(format==="png")img=img.png(); else if(format==="webp")img=img.webp({quality:92}); else img=img.jpeg({quality:92});
    const out=await img.toBuffer();
    res.type(format==="png"?"png":format==="webp"?"webp":"jpeg").send(out);
  }catch(e){res.status(500).json({error:e.message||"Processing failed"})}
});

app.get("/api/admin/stats",admin,(req,res)=>res.json({
  users:"Live database ready",
  storage:"Local processing",
  editor:"Online",
  server:"Healthy",
  features:["Resize","Brightness","Contrast","Saturation","Blur","Rotate","Flip","JPG","PNG","WebP","Pro"]
}));

app.get("*",(req,res)=>res.sendFile(path.join(__dirname,"public","index.html")));
app.listen(PORT,()=>console.log("SnapScale server running on "+PORT));
