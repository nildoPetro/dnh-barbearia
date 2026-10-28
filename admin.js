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
// ========== MÓDULO 2 - FUNCIONÁRIOS - CÓDIGO REAL ==========
let funcionarios = lerLocal('funcionarios');
let funcoesSalvas = lerLocal('funcoesSalvas');
if(funcoesSalvas.length===0){ funcoesSalvas=['Barbeiro','Auxiliar','Recepcionista','Gerente']; }

function atualizarDatalistFuncoes(){
  const dl=document.getElementById('listaFuncoes');
  if(!dl) return;
  dl.innerHTML='';
  funcoesSalvas.forEach(f=>{
    const o=document.createElement('option'); o.value=f; dl.appendChild(o);
  });
}

function salvarFuncionario(){
  const nome=document.getElementById('funcNome').value.trim();
  const tel=document.getElementById('funcTelefone').value.trim();
  const email=document.getElementById('funcEmail').value.trim();
  const funcao=document.getElementById('funcFuncao').value.trim();
  const inicio=document.getElementById('funcInicio').value;
  const fim=document.getElementById('funcFim').value;
  const comissao=document.getElementById('funcComissao').value;
  const tipoComissao=document.getElementById('funcTipoComissao').value;
  const pix=document.getElementById('funcPix').value.trim();
  const tipoPix=document.getElementById('funcTipoPix').value;
  const pin=document.getElementById('funcPIN').value.trim();
  const id=document.getElementById('funcId').value;

  if(!nome || !tel || !/^\d{4,6}$/.test(pin) || !funcao){
    document.getElementById('erroFunc').style.display='block';
    return;
  }
  document.getElementById('erroFunc').style.display='none';

  // Salva função nova pra usar depois, sem duplicar
  if(!funcoesSalvas.includes(funcao)){
    funcoesSalvas.push(funcao);
    salvarLocal('funcoesSalvas', funcoesSalvas);
    atualizarDatalistFuncoes();
  }

  const dados={ id: id || Date.now().toString(), nome, telefone:tel, email, funcao, inicio, fim, comissao, tipoComissao, pix, tipoPix, pin };

  if(id){
    funcionarios = funcionarios.map(f=> f.id===id ? dados : f);
  } else {
    funcionarios.push(dados);
  }
  salvarLocal('funcionarios', funcionarios);
  limparFormFunc();
  listarFuncionarios();
}

function listarFuncionarios(){
  const el=document.getElementById('listaFuncionarios');
  if(!el) return;
  const busca=(document.getElementById('buscaFunc')?.value || '').toLowerCase();
  const lista=funcionarios.filter(f=> f.nome.toLowerCase().includes(busca));
  if(lista.length===0){ el.innerHTML='<p style="color:#A1A1AA;text-align:center">Nenhum funcionário ainda.</p>'; return; }
  el.innerHTML='';
  lista.forEach(f=>{
    const div=document.createElement('div');
    div.className='item-lista';
    div.innerHTML=`<div><b>${f.nome}</b><br><small>${f.telefone} - ${f.funcao} - ${f.comissao || 0}${f.tipoComissao}</small><br><small>${f.pix ? 'Pix: '+f.pix : 'Sem Pix'} | ${f.inicio} às ${f.fim}</small></div>
    <div class="acoes">
      <button class="btn-sec" onclick="editarFuncionario('${f.id}')">Editar</button>
      <button class="btn-sec" onclick="redefinirPIN('${f.id}')">Redefinir PIN</button>
      <button class="btn-danger" onclick="excluirFuncionario('${f.id}')">Excluir</button>
    </div>`;
    el.appendChild(div);
  });
}

function editarFuncionario(id){
  const f=funcionarios.find(x=>x.id===id); if(!f) return;
  document.getElementById('funcId').value=f.id;
  document.getElementById('funcNome').value=f.nome;
  document.getElementById('funcTelefone').value=f.telefone;
  document.getElementById('funcEmail').value=f.email||'';
  document.getElementById('funcFuncao').value=f.funcao;
  document.getElementById('funcInicio').value=f.inicio;
  document.getElementById('funcFim').value=f.fim;
  document.getElementById('funcComissao').value=f.comissao;
  document.getElementById('funcTipoComissao').value=f.tipoComissao;
  document.getElementById('funcPix').value=f.pix||'';
  document.getElementById('funcTipoPix').value=f.tipoPix||'Celular';
  document.getElementById('funcPIN').value=f.pin;
  document.getElementById('btnCancelarFunc').style.display='block';
  document.querySelector('.btn-save').textContent='💾 Salvar Alterações';
  trocarTela('funcionarios', document.querySelectorAll('nav button')[2]);
  window.scrollTo(0,0);
}

function cancelarEdicaoFunc(){ limparFormFunc(); }

function limparFormFunc(){
  ['funcId','funcNome','funcTelefone','funcEmail','funcFuncao','funcComissao','funcPix','funcPIN'].forEach(id=> document.getElementById(id).value='');
  document.getElementById('funcInicio').value='09:00';
  document.getElementById('funcFim').value='19:00';
  document.getElementById('btnCancelarFunc').style.display='none';
  const btn=document.querySelector('#tela-funcionarios .btn-save'); if(btn) btn.textContent='💾 Cadastrar Funcionário';
}

function redefinirPIN(id){
  const novo=prompt('Digite o novo PIN (4 a 6 dígitos, só números):');
  if(!novo) return;
  if(!/^\d{4,6}$/.test(novo.trim())){ alert('PIN inválido. Tem que ser 4 a 6 dígitos só números.'); return; }
  funcionarios=funcionarios.map(f=> f.id===id ? {...f, pin:novo.trim()} : f);
  salvarLocal('funcionarios', funcionarios);
  alert('PIN redefinido com sucesso!');
}

function excluirFuncionario(id){
  if(!confirm('Excluir esse funcionário?')) return;
  funcionarios=funcionarios.filter(f=>f.id!==id);
  salvarLocal('funcionarios', funcionarios);
  listarFuncionarios();
}

atualizarDatalistFuncoes();
listarFuncionarios();

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
