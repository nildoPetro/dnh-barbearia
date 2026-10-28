// ==================================================
// admin.js - ARQUIVO ÚNICO DE FUNÇÕES - NÃO CRIAR OUTRO
// Cada módulo tem seu lugar marcado. Só colar dentro do lugar certo.
// ==================================================

// ========== JS GLOBAL - NÃO MEXER ==========
function trocarTela(nome, btn){
  document.querySelectorAll('.tela').forEach(t=>t.classList.remove('ativa'));
  document.getElementById('tela-'+nome).classList.add('ativa');
  document.querySelectorAll('nav button').forEach(b=>b.classList.remove('active'));
  if(btn) btn.classList.add('active');
  window.scrollTo(0,0);
}

function salvarLocal(chave, dados){
  localStorage.setItem(chave, JSON.stringify(dados));
}
function lerLocal(chave){
  try{ return JSON.parse(localStorage.getItem(chave)) || []; }
  catch(e){ return []; }
}

// ==================================================
// ========== MÓDULO 1 - CONFIGURAÇÕES - JS AQUI ==========
// ==================================================
let intervaloSelecionado = 30;
const diasSemana = [
  {nome:'Domingo',ativo:false,abre:'09:00',fecha:'18:00'},
  {nome:'Segunda',ativo:false,abre:'09:00',fecha:'19:00'},
  {nome:'Terça',ativo:true,abre:'09:00',fecha:'19:00'},
  {nome:'Quarta',ativo:true,abre:'09:00',fecha:'19:00'},
  {nome:'Quinta',ativo:true,abre:'09:00',fecha:'19:00'},
  {nome:'Sexta',ativo:true,abre:'09:00',fecha:'19:00'},
  {nome:'Sábado',ativo:true,abre:'09:00',fecha:'18:00'},
];

function renderDias(){
  const el = document.getElementById('dias');
  if(!el) return;
  el.innerHTML='';
  diasSemana.forEach((d,i)=>{
    const div=document.createElement('div');
    div.style.cssText='display:flex;align-items:center;gap:10px;background:#23232B;border:1px solid #3A3A44;border-radius:12px;padding:10px;margin-bottom:8px;'+(d.ativo?'':'opacity:.45');
    div.innerHTML=`<input type="checkbox" ${d.ativo?'checked':''} onchange="toggleDia(${i},this.checked)" style="width:22px;height:22px;accent-color:#FACC15">
    <b style="width:80px">${d.nome}</b>
    <div style="flex:1;display:grid;grid-template-columns:1fr 1fr;gap:8px"><div><span style="font-size:11px;color:#A1A1AA">Abre</span><input type="time" value="${d.abre}" ${d.ativo?'':'disabled'} onchange="diasSemana[${i}].abre=this.value"></div><div><span style="font-size:11px;color:#A1A1AA">Fecha</span><input type="time" value="${d.fecha}" ${d.ativo?'':'disabled'} onchange="diasSemana[${i}].fecha=this.value"></div></div>`;
    el.appendChild(div);
  });
}
function toggleDia(i,c){ diasSemana[i].ativo=c; renderDias(); }
function setIntervalo(v,btn){
  document.querySelectorAll('#boxIntervalos button').forEach(b=>{b.style.background='#23232B';b.style.color='#fff'});
  btn.style.background='#FACC15';btn.style.color='#111';
  intervaloSelecionado=v;
  document.getElementById('boxOutro').style.display = v==='outro' ? 'block' : 'none';
}
function salvarConfig(){
  const whats=document.getElementById('whats').value.trim();
  if(!whats){ document.getElementById('erroWhats').style.display='block'; return; }
  document.getElementById('erroWhats').style.display='none';
  let intervaloFinal = intervaloSelecionado==='outro' ? document.getElementById('intervaloOutro').value : intervaloSelecionado;
  const dados={ nome:document.getElementById('nome').value, whats, telefone:document.getElementById('telefone').value, endereco:document.getElementById('endereco').value, tipoPix:document.getElementById('tipoPix').value, pix:document.getElementById('pix').value, intervalo:intervaloFinal, almocoInicio:document.getElementById('almocoInicio').value, almocoFim:document.getElementById('almocoFim').value, dias:diasSemana };
  salvarLocal('configBarbearia', dados);
  document.getElementById('msgOk').style.display='block';
  setTimeout(()=>document.getElementById('msgOk').style.display='none',2000);
}

// Logo - Módulo 1
const fileLogo = document.getElementById('fileLogo');
if(fileLogo){
  fileLogo.addEventListener('change', e=>{
    const f=e.target.files[0]; if(!f) return;
    const img=document.getElementById('previewLogo'); img.src=URL.createObjectURL(f); img.style.display='block';
  });
}
renderDias();

// ==================================================
// ========== MÓDULO 2 - FUNCIONÁRIOS - JS AQUI ==========
// ==================================================
// AQUI ENTRA O CÓDIGO DO MÓDULO 2 - NÃO COLAR FORA DAQUI
// Exemplo do que vai entrar aqui:
// function salvarFuncionario(){}
// function listarFuncionarios(){}
// function redefinirPIN(){}

// ==================================================
// ========== MÓDULO 3 - SERVIÇOS - JS AQUI ==========
// ==================================================
// AQUI ENTRA O CÓDIGO DO MÓDULO 3 - NÃO COLAR FORA DAQUI

// ==================================================
// ========== MÓDULO 4 - CLIENTES - JS AQUI ==========
// ==================================================
// AQUI ENTRA O CÓDIGO DO MÓDULO 4 - NÃO COLAR FORA DAQUI

// ==================================================
// ========== MÓDULO 5 - ESTOQUE - JS AQUI ==========
// ==================================================
// AQUI ENTRA O CÓDIGO DO MÓDULO 5 - NÃO COLAR FORA DAQUI

// ==================================================
// ========== MÓDULO 6 - AGENDA - JS AQUI ==========
// ==================================================
// AQUI ENTRA O CÓDIGO DO MÓDULO 6 - NÃO COLAR FORA DAQUI

// ==================================================
// ========== MÓDULO 7 - FINANCEIRO - JS AQUI ==========
// ==================================================
// AQUI ENTRA O CÓDIGO DO MÓDULO 7 - NÃO COLAR FORA DAQUI

// ==================================================
// ========== MÓDULO 8 - DASHBOARD - JS AQUI ==========
// ==================================================
// AQUI ENTRA O CÓDIGO DO MÓDULO 8 - NÃO COLAR FORA DAQUI

// ==================================================
// ========== MÓDULO 9 - LOGIN - JS AQUI ==========
// ==================================================
// AQUI ENTRA O CÓDIGO DO MÓDULO 9 - NÃO COLAR FORA DAQUI
