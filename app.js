import {db} from "./firebase.js";
import {ref,get,onValue,push,set,update,remove} from "https://www.gstatic.com/firebasejs/10.12.5/firebase-database.js";
const $=id=>document.getElementById(id);
let mode="login",user=null,profile=null,games={},filter="all",gamesUnsub=null,keysUnsub=null,controlMode="mobile",selectedGameId=null,theme={color:"#57e8ff",rgb:false};
const defaultKeys={add1:"a",remove1:"q",add2:"d",remove2:"e"};
let keyConfig={...defaultKeys};
const key=s=>s.trim().toLowerCase();
const valid=s=>/^[a-zA-Z0-9_-]{3,24}$/.test(s);
const validFullName=s=>/^[\\p{L}]+(?:[\\s'-][\\p{L}]+)+$/u.test(s.trim()) && s.trim().split(/\\s+/).length>=2;
const safe=s=>String(s??"").replace(/[&<>"']/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]));
function showError(msg){$("authError").textContent=msg}
function hexToRgb(hex){const value=hex.replace("#","");return {r:parseInt(value.slice(0,2),16)||0,g:parseInt(value.slice(2,4),16)||0,b:parseInt(value.slice(4,6),16)||0}}
function rgbToHex(r,g,b){return "#"+[r,g,b].map(v=>Math.max(0,Math.min(255,Number(v)||0)).toString(16).padStart(2,"0")).join("")}
function applyTheme(next){theme={...theme,...next};const rgb=hexToRgb(theme.color);document.documentElement.style.setProperty("--accent",theme.color);document.documentElement.style.setProperty("--accent-rgb",`${rgb.r}, ${rgb.g}, ${rgb.b}`);document.body.classList.toggle("rgb-mode",!!theme.rgb);const color=$("themeColor");if(color)color.value=theme.color;const hex=$("themeHex");if(hex)hex.textContent=theme.color.toUpperCase();["R","G","B"].forEach((channel,i)=>{const el=$("rgb"+channel);if(el)el.value=[rgb.r,rgb.g,rgb.b][i]});const toggle=$("rgbToggle");if(toggle)toggle.checked=!!theme.rgb;document.querySelectorAll("[data-theme-preset]").forEach(b=>b.classList.toggle("active",b.dataset.themePreset===theme.preset))}
function openTheme(){$("themePanel").classList.remove("hidden");applyTheme(theme)}
function closeTheme(){$("themePanel").classList.add("hidden")}
async function saveTheme(){if(!user)return;const msg=$("themeMsg");msg.textContent="Salvando...";try{await set(ref(db,`users/${user}/theme`),{color:theme.color,rgb:!!theme.rgb,updatedAt:Date.now()});msg.textContent="Visual salvo para este usuário.";setTimeout(()=>{msg.textContent=""},2600)}catch(e){msg.textContent="Não foi possível salvar agora."}}
$("openTheme").onclick=openTheme;$("closeTheme").onclick=closeTheme;$("saveTheme").onclick=saveTheme;$("themeColor").oninput=e=>{theme={...theme,color:e.target.value,preset:null};applyTheme(theme)};$("rgbToggle").onchange=e=>{theme={...theme,rgb:e.target.checked};applyTheme(theme)};
["R","G","B"].forEach(channel=>$("rgb"+channel).oninput=()=>{theme={...theme,color:rgbToHex($("rgbR").value,$("rgbG").value,$("rgbB").value),preset:null};applyTheme(theme)});
const themePresets={cyan:"#57e8ff",violet:"#a78bfa",lime:"#b7f34a",coral:"#ff7b87",gold:"#ffd166"};document.querySelectorAll("[data-theme-preset]").forEach(b=>b.onclick=()=>{theme={...theme,color:themePresets[b.dataset.themePreset],preset:b.dataset.themePreset};applyTheme(theme)});
function keyLabel(k){return k===" "?"Espaço":String(k||"").toUpperCase()}
function updateKeyboardHelp(){const el=$("keyboardHelp");if(el)el.innerHTML=`Teclas: <b>${keyLabel(keyConfig.add1)}</b> + ponto jogador 1 · <b>${keyLabel(keyConfig.remove1)}</b> − ponto jogador 1 · <b>${keyLabel(keyConfig.add2)}</b> + ponto jogador 2 · <b>${keyLabel(keyConfig.remove2)}</b> − ponto jogador 2. Clique em uma partida para selecioná-la.`}
const keyFields={add1:"keyAdd1",remove1:"keyRemove1",add2:"keyAdd2",remove2:"keyRemove2"};let capturingKey=null;
function prettyKey(k){if(k===" ")return "Espaço";if(String(k).length===1)return String(k).toUpperCase();return k}
function paintKeys(){Object.entries(keyFields).forEach(([name,id])=>{const el=$(id);if(el)el.value=prettyKey(keyConfig[name]||defaultKeys[name])})}
Object.entries(keyFields).forEach(([name,id])=>{const input=$(id);if(!input)return;input.onclick=()=>{capturingKey=name;input.value="Pressione a tecla...";input.classList.add("capturing")};input.onkeydown=e=>{if(capturingKey!==name)return;e.preventDefault();e.stopPropagation();if(["Control","Alt","Shift","Meta"].includes(e.key))return;keyConfig[name]=e.key.toLowerCase();capturingKey=null;input.classList.remove("capturing");paintKeys();updateKeyboardHelp()}});
$("saveKeys").onclick=async()=>{if(!user)return;const msg=$("keyMsg");if(new Set(Object.values(keyConfig)).size!==4){msg.textContent="Escolha quatro teclas diferentes.";return}try{await set(ref(db,`users/${user}/keyboard`),{...keyConfig,updatedAt:Date.now()});msg.textContent="Atalhos salvos na sua conta."}catch(e){msg.textContent="Erro ao salvar: "+(e.message||"tente novamente")}};
$("defaultKeys").onclick=()=>{keyConfig={...defaultKeys};paintKeys();updateKeyboardHelp();$("keyMsg").textContent="Padrão carregado. Clique em salvar para aplicar."};

$("switchAuth").onclick=()=>{mode=mode==="login"?"register":"login";$("authTitle").textContent=mode==="login"?"Entrar":"Criar conta";$("authDesc").textContent=mode==="login"?"Acesse sua conta para continuar.":"Escolha seu usuário e sua senha."; $("authBtn").textContent=mode==="login"?"Entrar":"Cadastrar";$("switchAuth").textContent=mode==="login"?"Criar conta":"Voltar para entrar";showError("")};
$("authBtn").onclick=async()=>{
 const username=$("username").value.trim(),password=$("password").value;showError("");
 if(!valid(username)){showError("Use de 3 a 24 caracteres: letras, números, _ ou -.");return}
 if(password.length<4){showError("A senha precisa ter pelo menos 4 caracteres.");return}
 const userRef=ref(db,"users/"+key(username));
 $("authBtn").disabled=true;
 try{
   const snap=await get(userRef);
   if(mode==="register"){
     if(snap.exists()){showError("Esse usuário já está cadastrado.");return}
     const account={username, password, role:"student",createdAt:Date.now()};
     await set(userRef,account); enter(account);
   }else{
     if(!snap.exists()||snap.val().password!==password){showError("Usuário ou senha incorretos.");return}
     enter(snap.val());
   }
 }catch(e){showError("Não foi possível acessar o banco. Confira se as regras públicas foram publicadas. ("+(e.message||"erro")+")")}
 finally{$("authBtn").disabled=false}
};
async function enter(account){
 user=key(account.username);profile=account;
 try{const themeSnap=await get(ref(db,`users/${user}/theme`));applyTheme({...theme, ...(themeSnap.val()||{})})}catch(e){applyTheme(theme)}
 $("authView").classList.add("hidden");$("mainView").classList.remove("hidden");
 $("welcome").textContent=account.username;$("roleLabel").textContent=account.role==="teacher"?"PAINEL DO PROFESSOR":"ÁREA DO ALUNO";
 const canControl=account.role==="teacher"||account.role==="admin";
 $("teacherCreate").classList.toggle("hidden",!canControl);
 $("controlMode").classList.toggle("hidden",!canControl);
 $("teacherKeySettings").classList.toggle("hidden",!canControl);
 $("keyboardHelp").classList.add("hidden");
 if(keysUnsub)keysUnsub();
 keysUnsub=canControl?onValue(ref(db,`users/${user}/keyboard`),snap=>{keyConfig={...defaultKeys,...(snap.val()||{})};paintKeys();updateKeyboardHelp()},err=>{$("keyMsg").textContent="Não foi possível carregar seus atalhos: "+(err.message||"erro")}):null;
 document.body.classList.toggle("desktop-controls",false);
 document.body.classList.toggle("mobile-controls",true);
 if(gamesUnsub)gamesUnsub();
 gamesUnsub=onValue(ref(db,"games"),snap=>{games=snap.val()||{};render()},err=>{$("games").innerHTML=`<div class="empty">Erro ao carregar partidas: ${safe(err.message)}</div>`});
}
$("logout").onclick=()=>{user=null;profile=null;if(gamesUnsub){gamesUnsub();gamesUnsub=null}if(keysUnsub){keysUnsub();keysUnsub=null}$("mainView").classList.add("hidden");$("authView").classList.remove("hidden");$("password").value="";showError("")};
document.querySelectorAll("[data-filter]").forEach(b=>b.onclick=()=>{filter=b.dataset.filter;document.querySelectorAll("[data-filter]").forEach(x=>x.classList.toggle("active",x===b));render()});
$("createGame").onclick=async()=>{
 let a=$("p1").value.trim(),b=$("p2").value.trim();$("createError").textContent="";
 if(!["teacher","admin"].includes(profile?.role)){ $("createError").textContent="Somente professores podem iniciar partidas.";return}
 if(!validFullName(a)||!validFullName(b)){$("createError").textContent="Digite o nome e sobrenome dos dois jogadores. Não use apelidos.";return}
 if(a.normalize("NFD").replace(/[\\u0300-\\u036f]/g,"").toLowerCase()===b.normalize("NFD").replace(/[\\u0300-\\u036f]/g,"").toLowerCase()){$("createError").textContent="Os jogadores precisam ser pessoas diferentes.";return}
 try{let r=push(ref(db,"games")),now=Date.now();await set(r,{title:$("gameTitle").value.trim()||`${a} x ${b}`,player1:a,player2:b,score1:0,score2:0,status:"live",teacherUsername:profile.username,createdAt:now,updatedAt:now});$("p1").value="";$("p2").value="";$("gameTitle").value=""}
 catch(e){$("createError").textContent="Falha ao salvar partida: "+e.message}
};
function render(){
 let arr=Object.entries(games).map(([id,g])=>({id,...g})).filter(g=>filter==="all"||(filter==="live"?g.status==="live":g.status==="finished")).sort((a,b)=>(b.updatedAt||0)-(a.updatedAt||0));
 let el=$("games");if(!arr.length){el.innerHTML='<div class="empty">Nenhuma partida encontrada.</div>';return}
 let canManage=["teacher","admin"].includes(profile?.role);
 el.innerHTML=arr.map(g=>{
return `<article class="game ${selectedGameId===g.id?"selected-game":""}" data-game-card="${g.id}"><div class="game-head"><div><div class="small">${safe(g.teacherUsername||"Professor")} · ${new Date(g.createdAt||Date.now()).toLocaleString("pt-BR")}</div><h3>${safe(g.title||"Partida")}</h3></div><span class="status ${g.status==="finished"?"done":""}">${g.status==="finished"?"FINALIZADO":"● AO VIVO"}</span></div><div class="score"><div class="player"><strong>${safe(g.player1)}</strong><div class="points">${g.score1||0}</div>${canManage&&g.status==="live"?`<div class="score-controls"><button class="btn secondary mobile-control" data-point="${g.id}:1">+ Ponto</button><button class="btn danger mobile-control" data-remove="${g.id}:1">− Ponto</button><span class="desktop-hint">A adiciona · Q remove</span></div>`:""}</div><div class="vs">×</div><div class="player"><strong>${safe(g.player2)}</strong><div class="points">${g.score2||0}</div>${canManage&&g.status==="live"?`<div class="score-controls"><button class="btn secondary mobile-control" data-point="${g.id}:2">+ Ponto</button><button class="btn danger mobile-control" data-remove="${g.id}:2">− Ponto</button><span class="desktop-hint">D adiciona · E remove</span></div>`:""}</div></div><div class="meta"><span>Professor: ${safe(g.teacherUsername||"")}</span><span>${g.status==="finished"?"Resultado final":"Em andamento"}</span></div>${canManage?`<div class="actions">${g.status==="live"?`<button class="btn good" data-end="${g.id}">Encerrar jogo</button>`:""}<button class="btn danger" data-delete="${g.id}">Excluir jogo</button></div>`:""}</article>`;
 }).join("");
 el.querySelectorAll("[data-game-card]").forEach(card=>card.onclick=(ev)=>{if(ev.target.closest("button"))return;selectedGameId=card.dataset.gameCard;render()});
 el.querySelectorAll("[data-point]").forEach(b=>b.onclick=()=>{let [id,n]=b.dataset.point.split(":");selectedGameId=id;addPoint(id,n)});
 el.querySelectorAll("[data-remove]").forEach(b=>b.onclick=()=>{let [id,n]=b.dataset.remove.split(":");selectedGameId=id;removePoint(id,n)});
 el.querySelectorAll("[data-end]").forEach(b=>b.onclick=()=>endGame(b.dataset.end));
 el.querySelectorAll("[data-delete]").forEach(b=>b.onclick=()=>deleteGame(b.dataset.delete));
}
async function addPoint(id,n){
 let g=games[id];if(!g||g.status!=="live"||!["teacher","admin"].includes(profile?.role))return;
 let keyName=n==="1"?"score1":"score2",now=Date.now();
 await update(ref(db,`games/${id}`),{[keyName]:(Number(g[keyName])||0)+1,updatedAt:now});
}
async function removePoint(id,n){
 let g=games[id];if(!g||g.status!=="live"||!["teacher","admin"].includes(profile?.role))return;
 let keyName=n==="1"?"score1":"score2",current=Number(g[keyName]||0);
 if(current<=0)return;
 await update(ref(db,`games/${id}`),{[keyName]:current-1,updatedAt:Date.now()});
}
document.querySelectorAll("[data-mode]").forEach(b=>b.onclick=()=>{
 controlMode=b.dataset.mode;
 document.querySelectorAll("[data-mode]").forEach(x=>x.classList.toggle("active",x===b));
 $("keyboardHelp").classList.toggle("hidden",controlMode!=="desktop");updateKeyboardHelp();
 document.body.classList.toggle("desktop-controls",controlMode==="desktop");
 document.body.classList.toggle("mobile-controls",controlMode==="mobile");
});
document.addEventListener("keydown",ev=>{
 if(!["teacher","admin"].includes(profile?.role)||controlMode!=="desktop"||!selectedGameId)return;
 if(["INPUT","TEXTAREA"].includes(document.activeElement?.tagName)||document.activeElement?.isContentEditable)return;
 const k=ev.key.toLowerCase();
 const action=Object.entries(keyConfig).find(([,configured])=>String(configured).toLowerCase()===k)?.[0];
 if(!action)return;
 ev.preventDefault();
 const g=games[selectedGameId];if(!g||g.status!=="live")return;
 if(action==="add1")addPoint(selectedGameId,1);
 else if(action==="remove1")removePoint(selectedGameId,1);
 else if(action==="add2")addPoint(selectedGameId,2);
 else if(action==="remove2")removePoint(selectedGameId,2);
});

async function endGame(id){if(["teacher","admin"].includes(profile?.role)&&confirm("Encerrar esta partida?"))await update(ref(db,"games/"+id),{status:"finished",finishedAt:Date.now(),updatedAt:Date.now()})}
async function deleteGame(id){if(["teacher","admin"].includes(profile?.role)&&confirm("Excluir esta partida e todo o histórico?"))await remove(ref(db,"games/"+id))}
