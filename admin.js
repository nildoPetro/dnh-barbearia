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
// ========== MÓDULO 3 - SERVIÇOS - CÓDIGO REAL ==========
let servicos = lerLocal('servicos');

function toggleCombo(){
  const isCombo = document.getElementById('servCombo').checked;
  document.getElementById('boxCombo').style.display = isCombo ? 'block' : 'none';
  if(isCombo) renderComboServicos();
}

function renderComboServicos(){
  const el=document.getElementById('listaComboServicos');
  if(!el) return;
  const atualId=document.getElementById('servId').value;
  // Só mostra serviços que NÃO são combo, pra não fazer combo dentro de combo
  const simples=servicos.filter(s=> !s.isCombo && s.id!==atualId);
  if(simples.length===0){ el.innerHTML='<p style="color:#A1A1AA;font-size:13px">Cadastre primeiro serviços simples pra montar combo.</p>'; return; }
  el.innerHTML='';
  simples.forEach(s=>{
    const div=document.createElement('div');
    div.style.cssText='display:flex;gap:8px;align-items:center;padding:8px 0;border-bottom:1px solid #3A3A44';
    div.innerHTML=`<input type="checkbox" value="${s.id}" class="chkCombo" onchange="atualizarDuracaoCombo()" style="width:20px;height:20px;accent-color:#FACC15"><span style="flex:1;font-size:14px">${s.nome}</span><small style="color:#A1A1AA">${s.duracao} min - R$ ${s.preco}</small>`;
    el.appendChild(div);
  });
}

function atualizarDuracaoCombo(){
  let total=0;
  document.querySelectorAll('.chkCombo:checked').forEach(c=>{
    const s=servicos.find(x=>x.id===c.value);
    if(s) total+=Number(s.duracao||0);
  });
  document.getElementById('infoComboDuracao').textContent='Duração total: '+total+' min';
  // Se for combo, já joga a soma na Duração
  document.getElementById('servDuracao').value = total || '';
}

function renderServBarbeiros(selecionados=[]){
  const el=document.getElementById('listaServBarbeiros');
  if(!el) return;
  if(typeof funcionarios==='undefined' || funcionarios.length===0){
    el.innerHTML='<p style="color:#A1A1AA;font-size:13px">Cadastre funcionários no Módulo 2 primeiro.</p>'; return;
  }
  el.innerHTML='';
  funcionarios.forEach(f=>{
    const div=document.createElement('div');
    div.style.cssText='display:flex;gap:8px;align-items:center;padding:6px 0';
    div.innerHTML=`<input type="checkbox" value="${f.id}" class="chkBarbServ" ${selecionados.includes(f.id)?'checked':''} style="width:20px;height:20px;accent-color:#FACC15"><span style="font-size:14px">${f.nome} - ${f.funcao}</span>`;
    el.appendChild(div);
  });
}

function salvarServico(){
  const nome=document.getElementById('servNome').value.trim();
  const preco=document.getElementById('servPreco').value;
  const duracao=document.getElementById('servDuracao').value;
  const isCombo=document.getElementById('servCombo').checked;
  const ativo=document.getElementById('servAtivo').value==='true';
  const id=document.getElementById('servId').value;

  if(!nome || !preco || !duracao){
    document.getElementById('erroServ').style.display='block'; return;
  }
  document.getElementById('erroServ').style.display='none';

  let comboIds=[];
  if(isCombo){
    comboIds=[...document.querySelectorAll('.chkCombo:checked')].map(c=>c.value);
    if(comboIds.length===0){ alert('Combo precisa ter pelo menos 2 serviços marcados.'); return; }
  }

  const barbeiros=[...document.querySelectorAll('.chkBarbServ:checked')].map(c=>c.value);

  const dados={ id: id || Date.now().toString(), nome, preco:Number(preco), duracao:Number(duracao), isCombo, comboIds, barbeiros, ativo };

  if(id){ servicos=servicos.map(s=> s.id===id ? dados : s); }
  else { servicos.push(dados); }

  salvarLocal('servicos', servicos);
  limparFormServ();
  listarServicos();
}

function listarServicos(){
  const el=document.getElementById('listaServicos');
  if(!el) return;
  const busca=(document.getElementById('buscaServ')?.value || '').toLowerCase();
  const lista=servicos.filter(s=> s.nome.toLowerCase().includes(busca));
  if(lista.length===0){ el.innerHTML='<p style="color:#A1A1AA;text-align:center">Nenhum serviço ainda.</p>'; return; }
  el.innerHTML='';
  lista.forEach(s=>{
    let extra='';
    if(s.isCombo){
      const nomes=s.comboIds.map(cid=>{
        const ach=servicos.find(x=>x.id===cid); return ach?ach.nome:'?';
      }).join(' + ');
      extra=`<br><span class="tag">COMBO</span> <small>${nomes}</small>`;
    }
    let barbTxt='';
    if(s.barbeiros && s.barbeiros.length>0){
      barbTxt='<br><small>Fazem: '+ s.barbeiros.map(bid=>{
        const f=(typeof funcionarios!=='undefined'?funcionarios.find(x=>x.id===bid):null); return f?f.nome:'?';
      }).join(', ') +'</small>';
    } else { barbTxt='<br><small>Todos os barbeiros fazem</small>'; }

    const div=document.createElement('div');
    div.className='item-lista';
    div.style.opacity = s.ativo ? '1' : '0.55';
    div.innerHTML=`<div><b>${s.nome}</b> ${s.isCombo?'<span class="tag">COMBO</span>':''} ${s.ativo?'':'<small> - INATIVO</small>'}<br><small>R$ ${s.preco} - ${s.duracao} min - ${s.ativo?'Ativo':'Inativo'}</small>${extra}${barbTxt}</div>
    <div class="acoes">
      <button class="btn-sec" onclick="editarServico('${s.id}')">Editar</button>
      <button class="btn-sec" onclick="toggleAtivoServ('${s.id}')">${s.ativo?'Desativar':'Ativar'}</button>
      <button class="btn-danger" onclick="excluirServico('${s.id}')">Excluir</button>
    </div>`;
    el.appendChild(div);
  });
}

function editarServico(id){
  const s=servicos.find(x=>x.id===id); if(!s) return;
  document.getElementById('servId').value=s.id;
  document.getElementById('servNome').value=s.nome;
  document.getElementById('servPreco').value=s.preco;
  document.getElementById('servDuracao').value=s.duracao;
  document.getElementById('servCombo').checked=s.isCombo;
  document.getElementById('servAtivo').value= s.ativo ? 'true':'false';
  toggleCombo();
  renderServBarbeiros(s.barbeiros||[]);
  if(s.isCombo){
    setTimeout(()=>{
      document.querySelectorAll('.chkCombo').forEach(c=>{
        if(s.comboIds.includes(c.value)) c.checked=true;
      });
      atualizarDuracaoCombo();
    },50);
  }
  document.getElementById('btnCancelarServ').style.display='block';
  document.querySelector('#tela-servicos .btn-save').textContent='💾 Salvar Alterações';
  window.scrollTo(0,0);
}

function cancelarEdicaoServ(){ limparFormServ(); }
function limparFormServ(){
  ['servId','servNome','servPreco','servDuracao'].forEach(i=> document.getElementById(i).value='');
  document.getElementById('servCombo').checked=false;
  document.getElementById('boxCombo').style.display='none';
  document.getElementById('servAtivo').value='true';
  document.getElementById('btnCancelarServ').style.display='none';
  const btn=document.querySelector('#tela-servicos .btn-save'); if(btn) btn.textContent='💾 Cadastrar Serviço';
  renderServBarbeiros();
}
function toggleAtivoServ(id){
  servicos=servicos.map(s=> s.id===id ? {...s, ativo:!s.ativo} : s);
  salvarLocal('servicos', servicos);
  listarServicos();
}
function excluirServico(id){
  if(!confirm('Excluir esse serviço?')) return;
  servicos=servicos.filter(s=>s.id!==id);
  salvarLocal('servicos', servicos);
  listarServicos();
}

renderServBarbeiros();
listarServicos();

// ==================================================
// ========== MÓDULO 4 - CLIENTES - JS AQUI ==========
// ==================================================
// ========== MÓDULO 4 - CLIENTES - CÓDIGO REAL ==========
let clientes = lerLocal('clientes');

function salvarCliente(){
  const nome=document.getElementById('cliNome').value.trim();
  const tel=document.getElementById('cliTelefone').value.trim();
  const email=document.getElementById('cliEmail').value.trim();
  const nasc=document.getElementById('cliNasc').value;
  const obs=document.getElementById('cliObs').value.trim();
  const bloqueado=document.getElementById('cliBloqueado').value==='true';
  const id=document.getElementById('cliId').value;

  if(!nome || !tel){
    document.getElementById('erroCli').style.display='block'; return;
  }
  document.getElementById('erroCli').style.display='none';

  // Não deixa duplicar telefone, a não ser que seja o mesmo cliente editando
  const duplicado=clientes.find(c=> c.telefone===tel && c.id!==id);
  if(duplicado){ alert('Já existe um cliente com esse telefone: '+duplicado.nome); return; }

  const dados={ id: id || Date.now().toString(), nome, telefone:tel, email, nasc, obs, bloqueado, criadoEm: new Date().toISOString() };

  if(id){ clientes=clientes.map(c=> c.id===id ? {...dados, criadoEm: c.criadoEm} : c); }
  else { clientes.push(dados); }

  salvarLocal('clientes', clientes);
  limparFormCli();
  listarClientes();
}

function listarClientes(){
  const el=document.getElementById('listaClientes');
  if(!el) return;
  const busca=(document.getElementById('buscaCli')?.value || '').toLowerCase();
  const lista=clientes.filter(c=> c.nome.toLowerCase().includes(busca) || c.telefone.includes(busca));
  if(lista.length===0){ el.innerHTML='<p style="color:#A1A1AA;text-align:center">Nenhum cliente ainda.</p>'; return; }
  el.innerHTML='';
  lista.forEach(c=>{
    // Histórico vem da Agenda (Módulo 6) quando tiver agendamento
    let agendamentos=[];
    try{ agendamentos = lerLocal('agendamentos').filter(a=> a.clienteId===c.id || a.telefone===c.telefone); }catch(e){}
    let totalGasto=0;
    agendamentos.forEach(a=>{ if(a.status==='concluido') totalGasto+=Number(a.preco||0); });

    const div=document.createElement('div');
    div.className='item-lista';
    div.style.opacity = c.bloqueado ? '0.55' : '1';
    div.innerHTML=`<div><b>${c.nome}</b> ${c.bloqueado?'<span class="tag" style="background:#EF4444;color:#fff">BLOQUEADO</span>':''}<br>
    <small>${c.telefone} ${c.email?' - '+c.email:''}</small><br>
    <small>${agendamentos.length} agendamentos | Gasto: R$ ${totalGasto.toFixed(2)} ${c.obs?' | Obs: '+c.obs:''}</small></div>
    <div class="acoes">
      <button class="btn-sec" onclick="verHistoricoCli('${c.id}')">Histórico</button>
      <button class="btn-sec" onclick="editarCliente('${c.id}')">Editar</button>
      <button class="btn-sec" onclick="toggleBloqueioCli('${c.id}')">${c.bloqueado?'Desbloquear':'Bloquear'}</button>
      <button class="btn-danger" onclick="excluirCliente('${c.id}')">Excluir</button>
    </div>`;
    el.appendChild(div);
  });
}

function editarCliente(id){
  const c=clientes.find(x=>x.id===id); if(!c) return;
  document.getElementById('cliId').value=c.id;
  document.getElementById('cliNome').value=c.nome;
  document.getElementById('cliTelefone').value=c.telefone;
  document.getElementById('cliEmail').value=c.email||'';
  document.getElementById('cliNasc').value=c.nasc||'';
  document.getElementById('cliObs').value=c.obs||'';
  document.getElementById('cliBloqueado').value= c.bloqueado ? 'true':'false';
  document.getElementById('btnCancelarCli').style.display='block';
  document.querySelector('#tela-clientes .btn-save').textContent='💾 Salvar Alterações';
  window.scrollTo(0,0);
}
function cancelarEdicaoCli(){ limparFormCli(); }
function limparFormCli(){
  ['cliId','cliNome','cliTelefone','cliEmail','cliNasc','cliObs'].forEach(i=> document.getElementById(i).value='');
  document.getElementById('cliBloqueado').value='false';
  document.getElementById('btnCancelarCli').style.display='none';
  const btn=document.querySelector('#tela-clientes .btn-save'); if(btn) btn.textContent='💾 Cadastrar Cliente';
}
function toggleBloqueioCli(id){
  clientes=clientes.map(c=> c.id===id ? {...c, bloqueado:!c.bloqueado} : c);
  salvarLocal('clientes', clientes);
  listarClientes();
}
function excluirCliente(id){
  if(!confirm('Excluir esse cliente? O histórico dele também some.')) return;
  clientes=clientes.filter(c=>c.id!==id);
  salvarLocal('clientes', clientes);
  listarClientes();
}
function verHistoricoCli(id){
  const c=clientes.find(x=>x.id===id); if(!c) return;
  let agendamentos=[];
  try{ agendamentos = lerLocal('agendamentos').filter(a=> a.clienteId===c.id || a.telefone===c.telefone); }catch(e){}
  document.getElementById('boxHistoricoCli').style.display='block';
  document.getElementById('nomeHistoricoCli').textContent=c.nome;
  const box=document.getElementById('conteudoHistoricoCli');
  if(agendamentos.length===0){
    box.innerHTML='<p style="color:#A1A1AA">Nenhum agendamento ainda. Quando agendar no Módulo 6, aparece aqui.</p>';
    return;
  }
  box.innerHTML='';
  agendamentos.slice().reverse().forEach(a=>{
    const d=document.createElement('div');
    d.style.cssText='background:#23232B;border:1px solid #3A3A44;border-radius:10px;padding:10px;margin-bottom:8px';
    d.innerHTML=`<b>${a.servicoNome||'Serviço'}</b><br><small>${a.data||''} ${a.hora||''} - ${a.barbeiroNome||''} - ${a.status||''} - R$ ${a.preco||0}</small>`;
    box.appendChild(d);
  });
  window.scrollTo(0,0);
}
function fecharHistoricoCli(){ document.getElementById('boxHistoricoCli').style.display='none'; }

listarClientes();

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
