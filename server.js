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
app.use(express.json({limit:"2mb"})); app.use(express.static(path.join(__dirname,"public")));
const verifyAdmin=p=>crypto.scryptSync(String(p||""),ADMIN_SALT,32).toString("hex")===ADMIN_HASH;
const token=(u,r="user")=>jwt.sign({sub:u,role:r},JWT_SECRET,{expiresIn:"7d"});
function auth(req,res,next){try{const h=req.headers.authorization||"";req.user=jwt.verify(h.replace("Bearer ",""),JWT_SECRET);next()}catch{res.status(401).json({error:"Login required"})}}
function admin(req,res,next){auth(req,res,()=>req.user.role==="admin"?next():res.status(403).json({error:"Admin only"}))}
app.get("/api/health",(req,res)=>res.json({ok:true,name:"SnapScale Server",version:"2.1.0"}));
app.post("/api/auth/admin",(req,res)=>{const {username,password}=req.body||{};if(username!==ADMIN_USERNAME||!verifyAdmin(password))return res.status(401).json({error:"Invalid admin credentials"});res.json({token:token(username,"admin"),user:{username,role:"admin"}})});
app.post("/api/auth/register",(req,res)=>{const {username}=req.body||{};if(!username||username.length<3)return res.status(400).json({error:"Username required"});res.json({token:token(username,"user"),user:{username,role:"user"}})});
app.post("/api/auth/login",(req,res)=>{const {username}=req.body||{};if(!username)return res.status(400).json({error:"Username required"});res.json({token:token(username,"user"),user:{username,role:"user"}})});
app.post("/api/edit",upload.single("image"),async(req,res)=>{try{if(!req.file)return res.status(400).json({error:"Image required"});const q=req.body||{};let img=sharp(req.file.buffer);if(q.rotate)img=img.rotate(Number(q.rotate));if(q.flip==="true")img=img.flip();if(q.flop==="true")img=img.flop();const m=await img.metadata();const w=Math.max(1,Math.min(10000,Number(q.width)||m.width)),h=Math.max(1,Math.min(10000,Number(q.height)||m.height));img=img.resize(w,h,{fit:"inside"}).modulate({brightness:Number(q.brightness||1),saturation:Number(q.saturation||1)});if(q.blur&&Number(q.blur)>0)img=img.blur(Math.min(20,Number(q.blur)));const f=(q.format||"jpeg").toLowerCase();if(f==="png")img=img.png();else if(f==="webp")img=img.webp({quality:92});else img=img.jpeg({quality:92});res.type(f==="png"?"png":f==="webp"?"webp":"jpeg").send(await img.toBuffer())}catch(e){res.status(500).json({error:e.message||"Processing failed"})}});
app.get("/api/admin/stats",admin,(req,res)=>res.json({server:"Healthy",editor:"Online",auth:"JWT",storage:"Local processing",features:["Resize","Brightness","Contrast","Saturation","Blur","Rotate","Flip","JPG","PNG","WebP","Pro"]}));
app.get("*",(req,res)=>res.sendFile(path.join(__dirname,"public","index.html")));
app.listen(PORT,()=>console.log("SnapScale server running on "+PORT));