// ===== BASE =====
function lerLocal(chave){ try{ return JSON.parse(localStorage.getItem(chave)) || []; }catch(e){ return []; } }
function salvarLocal(chave, dados){ localStorage.setItem(chave, JSON.stringify(dados)); }
function trocarTela(id, btn){
  const tela=document.getElementById('tela-'+id);
  if(!tela){ console.log('Tela não achada: '+id); return; }
  document.querySelectorAll('.tela').forEach(t=>t.classList.remove('ativa'));
  tela.classList.add('ativa');
  // Sincroniza menu lateral + menu de baixo pelo data-menu, sem usar índice
  document.querySelectorAll('[data-menu]').forEach(b=>b.classList.remove('ativo'));
  document.querySelectorAll('[data-menu="'+id+'"]').forEach(b=>b.classList.add('ativo'));
  if(id==='dashboard') atualizarDashboard();
  if(id==='agenda'){ carregarBarbeirosAgenda(); listarAgenda(); }
  if(id==='financeiro'){ carregarSelectsFin(); listarFinanceiro(); listarPendentesFin(); }
  if(id==='servicos') renderServBarbeiros();
  window.scrollTo(0,0);
}
function hojeISO(){ const d=new Date(); return d.getFullYear()+'-'+String(d.getMonth()+1).padStart(2,'0')+'-'+String(d.getDate()).padStart(2,'0'); }
function fmtBRL(v){ return 'R$ '+Number(v||0).toFixed(2).replace('.',','); }

// ===== MÓDULO 1 - CONFIG =====
const nomesDias=['Domingo','Segunda','Terça','Quarta','Quinta','Sexta','Sábado'];
function renderDiasConfig(){
  const el=document.getElementById('cfgDias'); if(!el) return;
  const cfg=JSON.parse(localStorage.getItem('configBarbearia')||'null');
  el.innerHTML='';
  nomesDias.forEach((nome,i)=>{
    const d = cfg && cfg.dias && cfg.dias[i] ? cfg.dias[i] : {ativo: i!==0, abre:'09:00', fecha:'19:00'};
    const div=document.createElement('div'); div.className='dia-row';
    div.innerHTML=`<b>${nome}</b><input type="time" id="diaAbre${i}" value="${d.abre}"><input type="time" id="diaFecha${i}" value="${d.fecha}"><label style="display:flex;gap:6px;align-items:center"><input type="checkbox" id="diaAtivo${i}" ${d.ativo?'checked':''} style="width:20px">Aberto</label>`;
    el.appendChild(div);
  });
}
function carregarConfig(){
  const cfg=JSON.parse(localStorage.getItem('configBarbearia')||'null');
  if(!cfg){ renderDiasConfig(); return; }
  document.getElementById('cfgNome').value=cfg.nome||'';
  document.getElementById('cfgTelefone').value=cfg.telefone||'';
  document.getElementById('cfgEndereco').value=cfg.endereco||'';
  document.getElementById('cfgIntervalo').value=cfg.intervalo||30;
  document.getElementById('cfgAntecedencia').value=cfg.antecedencia||1;
  document.getElementById('cfgAlmocoInicio').value=cfg.almocoInicio||'12:00';
  document.getElementById('cfgAlmocoFim').value=cfg.almocoFim||'13:00';
  document.getElementById('nomeHeader').textContent='💈 '+(cfg.nome||'Barbearia');
  renderDiasConfig();
}
function salvarConfig(){
  const dias=[];
  for(let i=0;i<7;i++){ dias.push({ativo:document.getElementById('diaAtivo'+i).checked, abre:document.getElementById('diaAbre'+i).value, fecha:document.getElementById('diaFecha'+i).value}); }
  const cfg={ nome:document.getElementById('cfgNome').value.trim(), telefone:document.getElementById('cfgTelefone').value.trim(), endereco:document.getElementById('cfgEndereco').value.trim(), intervalo:document.getElementById('cfgIntervalo').value, antecedencia:document.getElementById('cfgAntecedencia').value, almocoInicio:document.getElementById('cfgAlmocoInicio').value, almocoFim:document.getElementById('cfgAlmocoFim').value, dias };
  localStorage.setItem('configBarbearia', JSON.stringify(cfg));
  document.getElementById('nomeHeader').textContent='💈 '+(cfg.nome||'Barbearia');
  alert('Configurações salvas!');
}

// ===== MÓDULO 2 - FUNCIONÁRIOS =====
let funcionarios = lerLocal('funcionarios');
let funcoesSalvas = lerLocal('funcoesSalvas');
if(funcoesSalvas.length===0){ funcoesSalvas=['Barbeiro','Auxiliar','Recepcionista','Gerente']; }
function atualizarDatalistFuncoes(){ const dl=document.getElementById('listaFuncoes'); if(!dl) return; dl.innerHTML=''; funcoesSalvas.forEach(f=>{ const o=document.createElement('option'); o.value=f; dl.appendChild(o); }); }
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
  if(!nome || !tel || !/^\d{4,6}$/.test(pin) || !funcao){ document.getElementById('erroFunc').style.display='block'; return; }
  document.getElementById('erroFunc').style.display='none';
  if(!funcoesSalvas.includes(funcao)){ funcoesSalvas.push(funcao); salvarLocal('funcoesSalvas', funcoesSalvas); atualizarDatalistFuncoes(); }
  const dados={ id: id || Date.now().toString(), nome, telefone:tel, email, funcao, inicio, fim, comissao, tipoComissao, pix, tipoPix, pin };
  if(id){ funcionarios = funcionarios.map(f=> f.id===id ? dados : f); } else { funcionarios.push(dados); }
  salvarLocal('funcionarios', funcionarios); limparFormFunc(); listarFuncionarios();
}
function listarFuncionarios(){
  const el=document.getElementById('listaFuncionarios'); if(!el) return;
  const busca=(document.getElementById('buscaFunc')?.value || '').toLowerCase();
  const lista=funcionarios.filter(f=> f.nome.toLowerCase().includes(busca));
  if(lista.length===0){ el.innerHTML='<p style="color:#A1A1AA;text-align:center">Nenhum funcionário ainda.</p>'; return; }
  el.innerHTML='';
  lista.forEach(f=>{
    const div=document.createElement('div'); div.className='item-lista';
    div.innerHTML=`<div><b>${f.nome}</b><br><small>${f.telefone} - ${f.funcao} - ${f.comissao || 0}${f.tipoComissao}</small><br><small>${f.pix ? 'Pix: '+f.pix : 'Sem Pix'} | ${f.inicio} às ${f.fim}</small></div><div class="acoes"><button class="btn-sec" onclick="editarFuncionario('${f.id}')">Editar</button><button class="btn-sec" onclick="redefinirPIN('${f.id}')">Redefinir PIN</button><button class="btn-danger" onclick="excluirFuncionario('${f.id}')">Excluir</button></div>`;
    el.appendChild(div);
  });
}
function editarFuncionario(id){
  const f=funcionarios.find(x=>x.id===id); if(!f) return;
  document.getElementById('funcId').value=f.id; document.getElementById('funcNome').value=f.nome; document.getElementById('funcTelefone').value=f.telefone; document.getElementById('funcEmail').value=f.email||''; document.getElementById('funcFuncao').value=f.funcao; document.getElementById('funcInicio').value=f.inicio; document.getElementById('funcFim').value=f.fim; document.getElementById('funcComissao').value=f.comissao; document.getElementById('funcTipoComissao').value=f.tipoComissao; document.getElementById('funcPix').value=f.pix||''; document.getElementById('funcTipoPix').value=f.tipoPix||'Celular'; document.getElementById('funcPIN').value=f.pin;
  document.getElementById('btnCancelarFunc').style.display='block'; document.querySelector('#tela-funcionarios .btn-save').textContent='💾 Salvar Alterações'; trocarTela('funcionarios', document.querySelectorAll('nav button')[2]); window.scrollTo(0,0);
}
function cancelarEdicaoFunc(){ limparFormFunc(); }
function limparFormFunc(){
  ['funcId','funcNome','funcTelefone','funcEmail','funcFuncao','funcComissao','funcPix','funcPIN'].forEach(id=> document.getElementById(id).value='');
  document.getElementById('funcInicio').value='09:00'; document.getElementById('funcFim').value='19:00'; document.getElementById('btnCancelarFunc').style.display='none';
  const btn=document.querySelector('#tela-funcionarios .btn-save'); if(btn) btn.textContent='💾 Cadastrar Funcionário';
}
function redefinirPIN(id){ const novo=prompt('Digite o novo PIN (4 a 6 dígitos, só números):'); if(!novo) return; if(!/^\d{4,6}$/.test(novo.trim())){ alert('PIN inválido.'); return; } funcionarios=funcionarios.map(f=> f.id===id ? {...f, pin:novo.trim()} : f); salvarLocal('funcionarios', funcionarios); alert('PIN redefinido!'); }
function excluirFuncionario(id){ if(!confirm('Excluir esse funcionário?')) return; funcionarios=funcionarios.filter(f=>f.id!==id); salvarLocal('funcionarios', funcionarios); listarFuncionarios(); }

// ===== MÓDULO 3 - SERVIÇOS =====
let servicos = lerLocal('servicos');
function toggleCombo(){ const isCombo=document.getElementById('servCombo').checked; document.getElementById('boxCombo').style.display=isCombo?'block':'none'; if(isCombo) renderComboServicos(); }
function renderComboServicos(){
  const el=document.getElementById('listaComboServicos'); if(!el) return;
  const atualId=document.getElementById('servId').value;
  const simples=servicos.filter(s=> !s.isCombo && s.id!==atualId);
  if(simples.length===0){ el.innerHTML='<p style="color:#A1A1AA;font-size:13px">Cadastre primeiro serviços simples pra montar combo.</p>'; return; }
  el.innerHTML=''; simples.forEach(s=>{ const div=document.createElement('div'); div.style.cssText='display:flex;gap:8px;align-items:center;padding:8px 0;border-bottom:1px solid #3A3A44'; div.innerHTML=`<input type="checkbox" value="${s.id}" class="chkCombo" onchange="atualizarDuracaoCombo()" style="width:20px;height:20px;accent-color:#FACC15"><span style="flex:1;font-size:14px">${s.nome}</span><small style="color:#A1A1AA">${s.duracao} min - R$ ${s.preco}</small>`; el.appendChild(div); });
}
function atualizarDuracaoCombo(){ let total=0; document.querySelectorAll('.chkCombo:checked').forEach(c=>{ const s=servicos.find(x=>x.id===c.value); if(s) total+=Number(s.duracao||0); }); document.getElementById('infoComboDuracao').textContent='Duração total: '+total+' min'; document.getElementById('servDuracao').value=total||''; }
function renderServBarbeiros(selecionados=[]){
  const el=document.getElementById('listaServBarbeiros'); if(!el) return;
  if(!funcionarios || funcionarios.length===0){ el.innerHTML='<p style="color:#A1A1AA;font-size:13px">Cadastre funcionários no Módulo 2 primeiro.</p>'; return; }
  el.innerHTML=''; funcionarios.forEach(f=>{ const div=document.createElement('div'); div.style.cssText='display:flex;gap:8px;align-items:center;padding:6px 0'; div.innerHTML=`<input type="checkbox" value="${f.id}" class="chkBarbServ" ${selecionados.includes(f.id)?'checked':''} style="width:20px;height:20px;accent-color:#FACC15"><span style="font-size:14px">${f.nome} - ${f.funcao}</span>`; el.appendChild(div); });
}
function salvarServico(){
  const nome=document.getElementById('servNome').value.trim(); const preco=document.getElementById('servPreco').value; const duracao=document.getElementById('servDuracao').value; const isCombo=document.getElementById('servCombo').checked; const ativo=document.getElementById('servAtivo').value==='true'; const id=document.getElementById('servId').value;
  if(!nome || !preco || !duracao){ document.getElementById('erroServ').style.display='block'; return; }
  document.getElementById('erroServ').style.display='none';
  let comboIds=[]; if(isCombo){ comboIds=[...document.querySelectorAll('.chkCombo:checked')].map(c=>c.value); if(comboIds.length===0){ alert('Combo precisa ter pelo menos 2 serviços marcados.'); return; } }
  const barbeiros=[...document.querySelectorAll('.chkBarbServ:checked')].map(c=>c.value);
  const dados={ id: id || Date.now().toString(), nome, preco:Number(preco), duracao:Number(duracao), isCombo, comboIds, barbeiros, ativo };
  if(id){ servicos=servicos.map(s=> s.id===id ? dados : s); } else { servicos.push(dados); }
  salvarLocal('servicos', servicos); limparFormServ(); listarServicos();
}
function listarServicos(){
  const el=document.getElementById('listaServicos'); if(!el) return;
  const busca=(document.getElementById('buscaServ')?.value || '').toLowerCase();
  const lista=servicos.filter(s=> s.nome.toLowerCase().includes(busca));
  if(lista.length===0){ el.innerHTML='<p style="color:#A1A1AA;text-align:center">Nenhum serviço ainda.</p>'; return; }
  el.innerHTML=''; lista.forEach(s=>{
    let extra=''; if(s.isCombo){ const nomes=s.comboIds.map(cid=>{ const ach=servicos.find(x=>x.id===cid); return ach?ach.nome:'?'; }).join(' + '); extra=`<br><span class="tag">COMBO</span> <small>${nomes}</small>`; }
    let barbTxt=''; if(s.barbeiros && s.barbeiros.length>0){ barbTxt='<br><small>Fazem: '+ s.barbeiros.map(bid=>{ const f=funcionarios.find(x=>x.id===bid); return f?f.nome:'?'; }).join(', ') +'</small>'; } else { barbTxt='<br><small>Todos os barbeiros fazem</small>'; }
    const div=document.createElement('div'); div.className='item-lista'; div.style.opacity=s.ativo?'1':'0.55';
    div.innerHTML=`<div><b>${s.nome}</b> ${s.isCombo?'<span class="tag">COMBO</span>':''} ${s.ativo?'':'<small> - INATIVO</small>'}<br><small>R$ ${s.preco} - ${s.duracao} min - ${s.ativo?'Ativo':'Inativo'}</small>${extra}${barbTxt}</div><div class="acoes"><button class="btn-sec" onclick="editarServico('${s.id}')">Editar</button><button class="btn-sec" onclick="toggleAtivoServ('${s.id}')">${s.ativo?'Desativar':'Ativar'}</button><button class="btn-danger" onclick="excluirServico('${s.id}')">Excluir</button></div>`;
    el.appendChild(div);
  });
}
function editarServico(id){
  const s=servicos.find(x=>x.id===id); if(!s) return;
  document.getElementById('servId').value=s.id; document.getElementById('servNome').value=s.nome; document.getElementById('servPreco').value=s.preco; document.getElementById('servDuracao').value=s.duracao; document.getElementById('servCombo').checked=s.isCombo; document.getElementById('servAtivo').value=s.ativo?'true':'false';
  toggleCombo(); renderServBarbeiros(s.barbeiros||[]);
  if(s.isCombo){ setTimeout(()=>{ document.querySelectorAll('.chkCombo').forEach(c=>{ if(s.comboIds.includes(c.value)) c.checked=true; }); atualizarDuracaoCombo(); },50); }
  document.getElementById('btnCancelarServ').style.display='block'; document.querySelector('#tela-servicos .btn-save').textContent='💾 Salvar Alterações'; window.scrollTo(0,0);
}
function cancelarEdicaoServ(){ limparFormServ(); }
function limparFormServ(){ ['servId','servNome','servPreco','servDuracao'].forEach(i=> document.getElementById(i).value=''); document.getElementById('servCombo').checked=false; document.getElementById('boxCombo').style.display='none'; document.getElementById('servAtivo').value='true'; document.getElementById('btnCancelarServ').style.display='none'; const btn=document.querySelector('#tela-servicos .btn-save'); if(btn) btn.textContent='💾 Cadastrar Serviço'; renderServBarbeiros(); }
function toggleAtivoServ(id){ servicos=servicos.map(s=> s.id===id ? {...s, ativo:!s.ativo} : s); salvarLocal('servicos', servicos); listarServicos(); }
function excluirServico(id){ if(!confirm('Excluir esse serviço?')) return; servicos=servicos.filter(s=>s.id!==id); salvarLocal('servicos', servicos); listarServicos(); }

// ===== MÓDULO 4 - CLIENTES =====
let clientes = lerLocal('clientes');
function salvarCliente(){
  const nome=document.getElementById('cliNome').value.trim(); const tel=document.getElementById('cliTelefone').value.trim(); const email=document.getElementById('cliEmail').value.trim(); const nasc=document.getElementById('cliNasc').value; const obs=document.getElementById('cliObs').value.trim(); const bloqueado=document.getElementById('cliBloqueado').value==='true'; const id=document.getElementById('cliId').value;
  if(!nome || !tel){ document.getElementById('erroCli').style.display='block'; return; }
  document.getElementById('erroCli').style.display='none';
  const duplicado=clientes.find(c=> c.telefone===tel && c.id!==id); if(duplicado){ alert('Já existe um cliente com esse telefone: '+duplicado.nome); return; }
  const dados={ id: id || Date.now().toString(), nome, telefone:tel, email, nasc, obs, bloqueado, criadoEm:new Date().toISOString() };
  if(id){ clientes=clientes.map(c=> c.id===id ? {...dados, criadoEm:c.criadoEm} : c); } else { clientes.push(dados); }
  salvarLocal('clientes', clientes); limparFormCli(); listarClientes();
}
function listarClientes(){
  const el=document.getElementById('listaClientes'); if(!el) return;
  const busca=(document.getElementById('buscaCli')?.value || '').toLowerCase();
  const lista=clientes.filter(c=> c.nome.toLowerCase().includes(busca) || c.telefone.includes(busca));
  if(lista.length===0){ el.innerHTML='<p style="color:#A1A1AA;text-align:center">Nenhum cliente ainda.</p>'; return; }
  el.innerHTML=''; lista.forEach(c=>{
    let agendamentos=[]; try{ agendamentos=lerLocal('agendamentos').filter(a=> a.clienteId===c.id || a.telefone===c.telefone); }catch(e){}
    let totalGasto=0; agendamentos.forEach(a=>{ if(a.status==='concluido') totalGasto+=Number(a.preco||0); });
    const div=document.createElement('div'); div.className='item-lista'; div.style.opacity=c.bloqueado?'0.55':'1';
    div.innerHTML=`<div><b>${c.nome}</b> ${c.bloqueado?'<span class="tag" style="background:#EF4444;color:#fff">BLOQUEADO</span>':''}<br><small>${c.telefone} ${c.email?' - '+c.email:''}</small><br><small>${agendamentos.length} agendamentos | Gasto: R$ ${totalGasto.toFixed(2)} ${c.obs?' | Obs: '+c.obs:''}</small></div><div class="acoes"><button class="btn-sec" onclick="verHistoricoCli('${c.id}')">Histórico</button><button class="btn-sec" onclick="editarCliente('${c.id}')">Editar</button><button class="btn-sec" onclick="toggleBloqueioCli('${c.id}')">${c.bloqueado?'Desbloquear':'Bloquear'}</button><button class="btn-danger" onclick="excluirCliente('${c.id}')">Excluir</button></div>`;
    el.appendChild(div);
  });
}
function editarCliente(id){ const c=clientes.find(x=>x.id===id); if(!c) return; document.getElementById('cliId').value=c.id; document.getElementById('cliNome').value=c.nome; document.getElementById('cliTelefone').value=c.telefone; document.getElementById('cliEmail').value=c.email||''; document.getElementById('cliNasc').value=c.nasc||''; document.getElementById('cliObs').value=c.obs||''; document.getElementById('cliBloqueado').value=c.bloqueado?'true':'false'; document.getElementById('btnCancelarCli').style.display='block'; document.querySelector('#tela-clientes .btn-save').textContent='💾 Salvar Alterações'; window.scrollTo(0,0); }
function cancelarEdicaoCli(){ limparFormCli(); }
function limparFormCli(){ ['cliId','cliNome','cliTelefone','cliEmail','cliNasc','cliObs'].forEach(i=> document.getElementById(i).value=''); document.getElementById('cliBloqueado').value='false'; document.getElementById('btnCancelarCli').style.display='none'; const btn=document.querySelector('#tela-clientes .btn-save'); if(btn) btn.textContent='💾 Cadastrar Cliente'; }
function toggleBloqueioCli(id){ clientes=clientes.map(c=> c.id===id ? {...c, bloqueado:!c.bloqueado} : c); salvarLocal('clientes', clientes); listarClientes(); }
function excluirCliente(id){ if(!confirm('Excluir esse cliente?')) return; clientes=clientes.filter(c=>c.id!==id); salvarLocal('clientes', clientes); listarClientes(); }
function verHistoricoCli(id){ const c=clientes.find(x=>x.id===id); if(!c) return; let agendamentos=[]; try{ agendamentos=lerLocal('agendamentos').filter(a=> a.clienteId===c.id || a.telefone===c.telefone); }catch(e){} document.getElementById('boxHistoricoCli').style.display='block'; document.getElementById('nomeHistoricoCli').textContent=c.nome; const box=document.getElementById('conteudoHistoricoCli'); if(agendamentos.length===0){ box.innerHTML='<p style="color:#A1A1AA">Nenhum agendamento ainda.</p>'; return; } box.innerHTML=''; agendamentos.slice().reverse().forEach(a=>{ const d=document.createElement('div'); d.style.cssText='background:#23232B;border:1px solid #3A3A44;border-radius:10px;padding:10px;margin-bottom:8px'; d.innerHTML=`<b>${a.servicoNome||'Serviço'}</b><br><small>${a.data||''} ${a.hora||''} - ${a.barbeiroNome||''} - ${a.status||''} - R$ ${a.preco||0}</small>`; box.appendChild(d); }); window.scrollTo(0,0); }
function fecharHistoricoCli(){ document.getElementById('boxHistoricoCli').style.display='none'; }

// ===== MÓDULO 5 - ESTOQUE =====
let estoque = lerLocal('estoque');
let filtroEstAtual='todos';
let categoriasEstSalvas = lerLocal('categoriasEstSalvas'); if(categoriasEstSalvas.length===0){ categoriasEstSalvas=['Pomada','Shampoo','Condicionador','Lâmina','Navalha','Óleo','Balm','Outros']; }
function atualizarDatalistCategoriasEst(){ const dl=document.getElementById('listaCategoriasEst'); if(!dl) return; dl.innerHTML=''; categoriasEstSalvas.forEach(c=>{ const o=document.createElement('option'); o.value=c; dl.appendChild(o); }); }
function salvarEstoque(){
  const nome=document.getElementById('estNome').value.trim(); const categoria=document.getElementById('estCategoria').value.trim(); const unidade=document.getElementById('estUnidade').value; const qtd=document.getElementById('estQtd').value; const minimo=document.getElementById('estMinimo').value; const preco=document.getElementById('estPreco').value; const obs=document.getElementById('estObs').value.trim(); const id=document.getElementById('estId').value;
  if(!nome || !categoria || qtd==='' || minimo===''){ document.getElementById('erroEst').style.display='block'; return; }
  document.getElementById('erroEst').style.display='none';
  if(!categoriasEstSalvas.includes(categoria)){ categoriasEstSalvas.push(categoria); salvarLocal('categoriasEstSalvas', categoriasEstSalvas); atualizarDatalistCategoriasEst(); }
  const dados={ id: id || Date.now().toString(), nome, categoria, unidade, qtd:Number(qtd), minimo:Number(minimo), preco:Number(preco||0), obs };
  if(id){ estoque=estoque.map(e=> e.id===id ? dados : e); } else { estoque.push(dados); }
  salvarLocal('estoque', estoque); limparFormEst(); listarEstoque();
}
function listarEstoque(){
  const el=document.getElementById('listaEstoque'); if(!el) return;
  const busca=(document.getElementById('buscaEst')?.value || '').toLowerCase();
  let lista=estoque.filter(e=> e.nome.toLowerCase().includes(busca) || e.categoria.toLowerCase().includes(busca));
  if(filtroEstAtual==='baixo') lista=lista.filter(e=> e.qtd <= e.minimo && e.qtd>0);
  if(filtroEstAtual==='zerado') lista=lista.filter(e=> e.qtd===0);
  const baixo=estoque.filter(e=> e.qtd <= e.minimo); const boxAlerta=document.getElementById('alertaEst');
  if(boxAlerta){ if(baixo.length===0) boxAlerta.innerHTML='<p style="color:#22C55E;font-size:13px">✅ Estoque ok.</p>'; else boxAlerta.innerHTML=`<div style="background:#3A1A1A;border:1px solid #7F1D1D;border-radius:10px;padding:10px;font-size:13px;color:#FCA5A5">⚠️ ${baixo.length} produto(s) abaixo do mínimo: ${baixo.map(b=>b.nome).join(', ')}</div>`; }
  if(lista.length===0){ el.innerHTML='<p style="color:#A1A1AA;text-align:center">Nenhum produto nesse filtro.</p>'; return; }
  el.innerHTML=''; lista.forEach(e=>{
    const status=e.qtd===0?'<span class="tag" style="background:#EF4444;color:#fff">ZERADO</span>':e.qtd<=e.minimo?'<span class="tag" style="background:#F59E0B;color:#111">ABAIXO DO MÍNIMO</span>':'<span class="tag" style="background:#22C55E;color:#fff">OK</span>';
    const div=document.createElement('div'); div.className='item-lista';
    div.innerHTML=`<div><b>${e.nome}</b> ${status}<br><small>${e.categoria} - ${e.unidade} ${e.obs?' - '+e.obs:''}</small><br><small>Qtd: <b>${e.qtd}</b> | Mínimo: ${e.minimo} | Preço: R$ ${e.preco.toFixed(2)}</small></div><div class="acoes"><button class="btn-sec" onclick="ajustarEst('${e.id}',1)">+1</button><button class="btn-sec" onclick="ajustarEst('${e.id}',-1)">-1</button><button class="btn-sec" onclick="editarEstoque('${e.id}')">Editar</button><button class="btn-danger" onclick="excluirEstoque('${e.id}')">Excluir</button></div>`;
    el.appendChild(div);
  });
}
function filtrarEst(tipo,btn){ filtroEstAtual=tipo; document.querySelectorAll('#tela-estoque .btn-sec').forEach(b=>{b.style.background='#23232B';b.style.color='#fff'}); if(btn){ btn.style.background='#FACC15'; btn.style.color='#111'; } listarEstoque(); }
function ajustarEst(id,delta){ estoque=estoque.map(e=>{ if(e.id!==id) return e; let novo=e.qtd+delta; if(novo<0) novo=0; return {...e, qtd:novo}; }); salvarLocal('estoque', estoque); listarEstoque(); }
function editarEstoque(id){ const e=estoque.find(x=>x.id===id); if(!e) return; document.getElementById('estId').value=e.id; document.getElementById('estNome').value=e.nome; document.getElementById('estCategoria').value=e.categoria; document.getElementById('estUnidade').value=e.unidade; document.getElementById('estQtd').value=e.qtd; document.getElementById('estMinimo').value=e.minimo; document.getElementById('estPreco').value=e.preco; document.getElementById('estObs').value=e.obs||''; document.getElementById('btnCancelarEst').style.display='block'; document.querySelector('#tela-estoque .btn-save').textContent='💾 Salvar Alterações'; window.scrollTo(0,0); }
function cancelarEdicaoEst(){ limparFormEst(); }
function limparFormEst(){ ['estId','estNome','estCategoria','estQtd','estMinimo','estPreco','estObs'].forEach(i=> document.getElementById(i).value=''); document.getElementById('estUnidade').value='Unidade'; document.getElementById('btnCancelarEst').style.display='none'; const btn=document.querySelector('#tela-estoque .btn-save'); if(btn) btn.textContent='💾 Cadastrar Produto'; }
function excluirEstoque(id){ if(!confirm('Excluir esse produto?')) return; estoque=estoque.filter(e=>e.id!==id); salvarLocal('estoque', estoque); listarEstoque(); }

// ===== MÓDULO 6 - AGENDA =====
let agendamentos = lerLocal('agendamentos');
let filtroAgendaAtual='todos';
function getConfigAgenda(){ try{ return JSON.parse(localStorage.getItem('configBarbearia')) || null; }catch(e){ return null; } }
function buscarClienteAgenda(){
  const busca=document.getElementById('agClienteBusca').value.trim().toLowerCase(); const box=document.getElementById('listaBuscaCliente');
  if(!busca){ box.style.display='none'; return; }
  const achados=clientes.filter(c=> c.nome.toLowerCase().includes(busca) || c.telefone.includes(busca));
  if(achados.length===0){ box.innerHTML='<p style="padding:10px;color:#A1A1AA">Nenhum cliente. <b onclick="criarClienteRapido()" style="color:#FACC15;cursor:pointer">cadastrar rápido aqui</b></p>'; box.style.display='block'; return; }
  box.innerHTML=''; achados.forEach(c=>{ const div=document.createElement('div'); div.style.cssText='padding:10px;border-bottom:1px solid #3A3A44;cursor:pointer'+(c.bloqueado?'opacity:.5':''); div.innerHTML=`<b>${c.nome}</b> ${c.bloqueado?'<span class="tag" style="background:#EF4444;color:#fff">BLOQUEADO</span>':''}<br><small>${c.telefone}</small>`; div.onclick=()=> selecionarClienteAgenda(c.id); box.appendChild(div); }); box.style.display='block';
}
function selecionarClienteAgenda(id){ const c=clientes.find(x=>x.id===id); if(!c) return; if(c.bloqueado){ alert('Cliente bloqueado! Desbloqueie no Módulo 4.'); return; } document.getElementById('agClienteId').value=c.id; document.getElementById('agClienteBusca').value=c.nome; document.getElementById('listaBuscaCliente').style.display='none'; const box=document.getElementById('clienteSelecionado'); box.style.display='block'; box.innerHTML=`✅ <b>${c.nome}</b> - ${c.telefone} <button onclick="limparClienteAgenda()" style="background:none;border:0;color:#EF4444;cursor:pointer">✕ trocar</button>`; }
function limparClienteAgenda(){ document.getElementById('agClienteId').value=''; document.getElementById('agClienteBusca').value=''; document.getElementById('clienteSelecionado').style.display='none'; }
function criarClienteRapido(){ const nome=document.getElementById('agClienteBusca').value.trim(); if(!nome) return; const tel=prompt('Telefone do cliente '+nome+':'); if(!tel) return; const novo={ id: Date.now().toString(), nome, telefone:tel, email:'', nasc:'', obs:'', bloqueado:false, criadoEm:new Date().toISOString() }; clientes.push(novo); salvarLocal('clientes', clientes); selecionarClienteAgenda(novo.id); listarClientes(); }
function carregarBarbeirosAgenda(){ const sel=document.getElementById('agBarbeiro'); if(!sel) return; const atual=sel.value; sel.innerHTML='<option value="">Selecione o barbeiro</option>'; funcionarios.forEach(f=>{ const o=document.createElement('option'); o.value=f.id; o.textContent=f.nome+' - '+f.funcao; sel.appendChild(o); }); if(atual) sel.value=atual; }
function atualizarServicosAgenda(){ const barbId=document.getElementById('agBarbeiro').value; const sel=document.getElementById('agServico'); if(!sel) return; sel.innerHTML='<option value="">Selecione o serviço</option>'; servicos.filter(s=> s.ativo).forEach(s=>{ if(s.barbeiros && s.barbeiros.length>0 && !s.barbeiros.includes(barbId)) return; const o=document.createElement('option'); o.value=s.id; o.textContent=s.nome+' - R$ '+s.preco+' - '+s.duracao+' min'+(s.isCombo?' [COMBO]':''); sel.appendChild(o); }); atualizarInfoServico(); gerarHorariosAgenda(); }
function atualizarInfoServico(){ const id=document.getElementById('agServico').value; const s=servicos.find(x=>x.id===id); const el=document.getElementById('infoServico'); if(!s){ el.textContent=''; return; } el.textContent=`${s.nome} | R$ ${s.preco} | Duração: ${s.duracao} min ${s.isCombo?'| COMBO':''}`; gerarHorariosAgenda(); }
function gerarHorariosAgenda(){
  const dataVal=document.getElementById('agData').value; const sel=document.getElementById('agHora'); const barbId=document.getElementById('agBarbeiro').value; const servId=document.getElementById('agServico').value;
  if(!dataVal || !barbId){ sel.innerHTML='<option value="">Escolha barbeiro e data</option>'; return; }
  const cfg=getConfigAgenda(); const data=new Date(dataVal+'T12:00:00'); const diaSemana=data.getDay();
  let abre='09:00', fecha='19:00', intervalo=30, almocoI='12:00', almocoF='13:00', ativo=true;
  if(cfg){ const d=cfg.dias?cfg.dias[diaSemana]:null; if(d){ abre=d.abre; fecha=d.fecha; ativo=d.ativo; } if(cfg.intervalo) intervalo=Number(cfg.intervalo)||30; almocoI=cfg.almocoInicio||almocoI; almocoF=cfg.almocoFim||almocoF; }
  const func=funcionarios.find(f=>f.id===barbId); if(func){ if(func.inicio) abre=func.inicio; if(func.fim) fecha=func.fim; }
  if(!ativo){ sel.innerHTML='<option value="">Barbearia fechada nesse dia</option>'; return; }
  const serv=servicos.find(s=>s.id===servId); const duracao=serv?Number(serv.duracao):intervalo;
  const slots=[]; let [h,m]=abre.split(':').map(Number); const [fh,fm]=fecha.split(':').map(Number); const fimMin=fh*60+fm; let cur=h*60+m; const [ah,am]=almocoI.split(':').map(Number); const [bh,bm]=almocoF.split(':').map(Number); const almI=ah*60+am, almF=bh*60+bm;
  const ocupados=agendamentos.filter(a=> a.data===dataVal && a.barbeiroId===barbId && a.status!=='cancelado' && a.id!==document.getElementById('agId').value);
  function conflita(inicioMin,dur){ if(inicioMin<almF && inicioMin+dur>almI) return true; for(let a of ocupados){ const [ah2,am2]=a.hora.split(':').map(Number); const aIni=ah2*60+am2; const aDur=Number(a.duracao||30); if(inicioMin<aIni+aDur && inicioMin+dur>aIni) return true; } return false; }
  while(cur+duracao<=fimMin){ if(!conflita(cur,duracao)){ const hh=String(Math.floor(cur/60)).padStart(2,'0'); const mm=String(cur%60).padStart(2,'0'); slots.push(hh+':'+mm); } cur+=intervalo; }
  if(slots.length===0){ sel.innerHTML='<option value="">Sem horário livre</option>'; return; }
  const atual=sel.value; sel.innerHTML='<option value="">Selecione o horário</option>'+slots.map(s=>`<option value="${s}">${s}</option>`).join(''); if(atual && slots.includes(atual)) sel.value=atual;
}
function salvarAgendamento(){
  const clienteId=document.getElementById('agClienteId').value; const barbId=document.getElementById('agBarbeiro').value; const servId=document.getElementById('agServico').value; const data=document.getElementById('agData').value; const hora=document.getElementById('agHora').value; const obs=document.getElementById('agObs').value.trim(); const id=document.getElementById('agId').value;
  if(!clienteId || !barbId || !servId || !data || !hora){ document.getElementById('erroAg').style.display='block'; return; }
  document.getElementById('erroAg').style.display='none';
  const cli=clientes.find(c=>c.id===clienteId); const barb=funcionarios.find(f=>f.id===barbId); const serv=servicos.find(s=>s.id===servId); if(!cli || !barb || !serv){ alert('Dados inválidos'); return; }
  const dados={ id: id || Date.now().toString(), clienteId, clienteNome:cli.nome, telefone:cli.telefone, barbeiroId:barbId, barbeiroNome:barb.nome, servicoId:servId, servicoNome:serv.nome, preco:serv.preco, duracao:serv.duracao, data, hora, obs, status:'agendado', criadoEm:new Date().toISOString() };
  if(id){ const antigo=agendamentos.find(a=>a.id===id); dados.status=antigo?antigo.status:'agendado'; agendamentos=agendamentos.map(a=> a.id===id ? dados : a); } else { agendamentos.push(dados); }
  salvarLocal('agendamentos', agendamentos); limparFormAg(); listarAgenda(); alert('Agendado! '+cli.nome+' - '+serv.nome+' - '+data+' às '+hora);
}
function listarAgenda(){
  const el=document.getElementById('listaAgenda'); if(!el) return;
  const dataFiltro=document.getElementById('agDataFiltro').value || hojeISO(); document.getElementById('agDataFiltro').value=dataFiltro;
  let lista=agendamentos.filter(a=> a.data===dataFiltro); if(filtroAgendaAtual!=='todos') lista=lista.filter(a=> a.status===filtroAgendaAtual); lista.sort((a,b)=> a.hora.localeCompare(b.hora));
  if(lista.length===0){ el.innerHTML='<p style="color:#A1A1AA;text-align:center">Nenhum agendamento nesse dia.</p>'; return; }
  el.innerHTML=''; lista.forEach(a=>{ const cor=a.status==='concluido'?'#22C55E':a.status==='cancelado'?'#EF4444':'#FACC15'; const div=document.createElement('div'); div.className='item-lista'; div.style.borderLeft='4px solid '+cor; div.innerHTML=`<div><b>${a.hora} - ${a.clienteNome}</b><br><small>${a.servicoNome} - ${a.barbeiroNome} - ${a.duracao} min - R$ ${a.preco}</small><br><small>Status: ${a.status} ${a.obs?' - '+a.obs:''}</small></div><div class="acoes">${a.status==='agendado'?`<button class="btn-sec" onclick="concluirAg('${a.id}')">Concluir</button><button class="btn-sec" onclick="editarAg('${a.id}')">Editar</button><button class="btn-danger" onclick="cancelarAg('${a.id}')">Cancelar</button>`:''}${a.status==='cancelado'?`<button class="btn-sec" onclick="reativarAg('${a.id}')">Reativar</button>`:''}${a.status==='concluido'?`<small style="color:#22C55E">✅ Lançar no Financeiro</small>`:''}</div>`; el.appendChild(div); });
}
function filtrarAgendaDia(tipo,btn){ filtroAgendaAtual=tipo; document.querySelectorAll('#tela-agenda .btn-sec').forEach(b=>{b.style.background='#23232B';b.style.color='#fff'}); if(btn){ btn.style.background='#FACC15'; btn.style.color='#111'; } listarAgenda(); }
function concluirAg(id){ agendamentos=agendamentos.map(a=> a.id===id ? {...a, status:'concluido'} : a); salvarLocal('agendamentos', agendamentos); listarAgenda(); }
function cancelarAg(id){ if(!confirm('Cancelar esse agendamento?')) return; agendamentos=agendamentos.map(a=> a.id===id ? {...a, status:'cancelado'} : a); salvarLocal('agendamentos', agendamentos); listarAgenda(); }
function reativarAg(id){ agendamentos=agendamentos.map(a=> a.id===id ? {...a, status:'agendado'} : a); salvarLocal('agendamentos', agendamentos); listarAgenda(); }
function editarAg(id){ const a=agendamentos.find(x=>x.id===id); if(!a) return; document.getElementById('agId').value=a.id; document.getElementById('agClienteId').value=a.clienteId; document.getElementById('agClienteBusca').value=a.clienteNome; const box=document.getElementById('clienteSelecionado'); box.style.display='block'; box.innerHTML=`✅ <b>${a.clienteNome}</b> - ${a.telefone}`; carregarBarbeirosAgenda(); document.getElementById('agBarbeiro').value=a.barbeiroId; atualizarServicosAgenda(); setTimeout(()=>{ document.getElementById('agServico').value=a.servicoId; document.getElementById('agData').value=a.data; gerarHorariosAgenda(); setTimeout(()=>{ document.getElementById('agHora').value=a.hora; },50); document.getElementById('agObs').value=a.obs||''; },50); document.getElementById('btnCancelarAg').style.display='block'; document.querySelector('#tela-agenda .btn-save').textContent='💾 Salvar Alterações'; window.scrollTo(0,0); }
function cancelarEdicaoAg(){ limparFormAg(); }
function limparFormAg(){ ['agId','agClienteId','agClienteBusca','agServico','agData','agHora','agObs'].forEach(i=>{ const el=document.getElementById(i); if(el) el.value=''; }); document.getElementById('clienteSelecionado').style.display='none'; document.getElementById('btnCancelarAg').style.display='none'; const btn=document.querySelector('#tela-agenda .btn-save'); if(btn) btn.textContent='💾 Agendar'; carregarBarbeirosAgenda(); }

// ===== MÓDULO 7 - FINANCEIRO =====
let financeiro = lerLocal('financeiro');
let filtroFinAtual='todos';
let categoriasFinSalvas = lerLocal('categoriasFinSalvas'); if(categoriasFinSalvas.length===0){ categoriasFinSalvas=['Corte','Barba','Combo','Produto','Aluguel','Luz','Água','Internet','Material','Comissão','Outros']; }
function atualizarCategoriasFin(){ const tipo=document.getElementById('finTipo').value; const dl=document.getElementById('listaCatFin'); if(!dl) return; dl.innerHTML=''; const cats=tipo==='entrada'?['Corte','Barba','Combo','Produto','Outros']:['Aluguel','Luz','Água','Internet','Material','Comissão','Outros']; [...new Set([...cats, ...categoriasFinSalvas])].forEach(c=>{ const o=document.createElement('option'); o.value=c; dl.appendChild(o); }); }
function carregarSelectsFin(){ const selF=document.getElementById('finFuncionario'); if(selF){ selF.innerHTML='<option value="">Nenhum / Barbearia</option>'; funcionarios.forEach(f=>{ const o=document.createElement('option'); o.value=f.id; o.textContent=f.nome+' - '+f.funcao; selF.appendChild(o); }); } const selA=document.getElementById('finAgendamento'); if(selA){ selA.innerHTML='<option value="">Nenhum</option>'; agendamentos.filter(a=>a.status==='concluido').slice().reverse().slice(0,50).forEach(a=>{ const o=document.createElement('option'); o.value=a.id; o.textContent=a.data+' '+a.hora+' - '+a.clienteNome+' - '+a.servicoNome+' - R$ '+a.preco; selA.appendChild(o); }); } }
function salvarFinanceiro(){
  const tipo=document.getElementById('finTipo').value; const desc=document.getElementById('finDesc').value.trim(); const valor=document.getElementById('finValor').value; const data=document.getElementById('finData').value; const categoria=document.getElementById('finCategoria').value.trim(); const forma=document.getElementById('finForma').value; const funcId=document.getElementById('finFuncionario').value; const agId=document.getElementById('finAgendamento').value; const id=document.getElementById('finId').value;
  if(!desc || !valor || !data){ document.getElementById('erroFin').style.display='block'; return; }
  document.getElementById('erroFin').style.display='none';
  if(categoria && !categoriasFinSalvas.includes(categoria)){ categoriasFinSalvas.push(categoria); salvarLocal('categoriasFinSalvas', categoriasFinSalvas); }
  const funcNome=funcId ? (funcionarios.find(f=>f.id===funcId)?.nome||'') : '';
  const dados={ id: id || Date.now().toString(), tipo, desc, valor:Number(valor), data, categoria:categoria||'Outros', forma, funcId, funcNome, agId };
  if(id){ financeiro=financeiro.map(f=> f.id===id ? dados : f); } else { financeiro.push(dados); }
  salvarLocal('financeiro', financeiro); limparFormFin(); listarFinanceiro(); listarPendentesFin();
}
function listarFinanceiro(){
  const el=document.getElementById('listaFinanceiro'); if(!el) return;
  const busca=(document.getElementById('buscaFin')?.value || '').toLowerCase(); const de=document.getElementById('finDe')?.value; const ate=document.getElementById('finAte')?.value;
  let lista=financeiro.filter(f=> f.desc.toLowerCase().includes(busca) || (f.categoria||'').toLowerCase().includes(busca));
  if(filtroFinAtual!=='todos') lista=lista.filter(f=> f.tipo===filtroFinAtual); if(de) lista=lista.filter(f=> f.data>=de); if(ate) lista=lista.filter(f=> f.data<=ate); lista.sort((a,b)=> b.data.localeCompare(a.data));
  let ent=0, sai=0; lista.forEach(f=>{ if(f.tipo==='entrada') ent+=Number(f.valor); else sai+=Number(f.valor); });
  document.getElementById('finEntradas').textContent=fmtBRL(ent); document.getElementById('finSaidas').textContent=fmtBRL(sai); const saldoEl=document.getElementById('finSaldo'); saldoEl.textContent=fmtBRL(ent-sai); saldoEl.style.color=(ent-sai)>=0?'#22C55E':'#EF4444';
  if(lista.length===0){ el.innerHTML='<p style="color:#A1A1AA;text-align:center">Nenhum lançamento.</p>'; return; }
  el.innerHTML=''; lista.forEach(f=>{ const div=document.createElement('div'); div.className='item-lista'; div.style.borderLeft='4px solid '+(f.tipo==='entrada'?'#22C55E':'#EF4444'); div.innerHTML=`<div><b>${f.desc}</b><br><small>${f.data} - ${f.categoria} - ${f.forma} ${f.funcNome?' - '+f.funcNome:''}</small></div><div style="text-align:right"><b style="color:${f.tipo==='entrada'?'#22C55E':'#EF4444'}">${f.tipo==='entrada'?'+':'-'} ${fmtBRL(f.valor)}</b><br><div class="acoes" style="margin-top:6px"><button class="btn-sec" onclick="editarFin('${f.id}')">Editar</button><button class="btn-danger" onclick="excluirFin('${f.id}')">Excluir</button></div></div>`; el.appendChild(div); });
}
function listarPendentesFin(){ const el=document.getElementById('listaPendenteFin'); if(!el) return; const concluidos=agendamentos.filter(a=>a.status==='concluido'); const ja=new Set(financeiro.filter(f=>f.agId).map(f=>f.agId)); const pend=concluidos.filter(a=> !ja.has(a.id)); if(pend.length===0){ el.innerHTML='<p style="color:#22C55E;font-size:13px">✅ Tudo lançado.</p>'; return; } el.innerHTML=''; pend.slice().reverse().forEach(a=>{ const div=document.createElement('div'); div.style.cssText='background:#23232B;border:1px solid #3A3A44;border-radius:10px;padding:10px;margin-bottom:8px;display:flex;justify-content:space-between;gap:8px;align-items:center'; div.innerHTML=`<div><b>${a.clienteNome}</b><br><small>${a.data} ${a.hora} - ${a.servicoNome} - ${a.barbeiroNome} - R$ ${a.preco}</small></div><button class="btn-sec" onclick="lancarAgendamentoFin('${a.id}')">Lançar</button>`; el.appendChild(div); }); }
function lancarAgendamentoFin(agId){ const a=agendamentos.find(x=>x.id===agId); if(!a) return; document.getElementById('finTipo').value='entrada'; document.getElementById('finDesc').value=a.servicoNome+' - '+a.clienteNome; document.getElementById('finValor').value=a.preco; document.getElementById('finData').value=a.data; document.getElementById('finCategoria').value='Corte'; document.getElementById('finFuncionario').value=a.barbeiroId||''; document.getElementById('finAgendamento').value=a.id; atualizarCategoriasFin(); window.scrollTo(0,0); alert('Preenchido! É só apertar Lançar.'); }
function filtrarFin(tipo,btn){ filtroFinAtual=tipo; document.querySelectorAll('#tela-financeiro .btn-sec').forEach(b=>{b.style.background='#23232B';b.style.color='#fff'}); if(btn){ btn.style.background='#FACC15'; btn.style.color='#111'; } listarFinanceiro(); }
function limparFiltroFin(){ document.getElementById('finDe').value=''; document.getElementById('finAte').value=''; document.getElementById('buscaFin').value=''; filtroFinAtual='todos'; listarFinanceiro(); }
function editarFin(id){ const f=financeiro.find(x=>x.id===id); if(!f) return; document.getElementById('finId').value=f.id; document.getElementById('finTipo').value=f.tipo; document.getElementById('finDesc').value=f.desc; document.getElementById('finValor').value=f.valor; document.getElementById('finData').value=f.data; document.getElementById('finCategoria').value=f.categoria; document.getElementById('finForma').value=f.forma; document.getElementById('finFuncionario').value=f.funcId||''; document.getElementById('finAgendamento').value=f.agId||''; atualizarCategoriasFin(); document.getElementById('btnCancelarFin').style.display='block'; document.querySelector('#tela-financeiro .btn-save').textContent='💾 Salvar Alterações'; window.scrollTo(0,0); }
function cancelarEdicaoFin(){ limparFormFin(); }
function limparFormFin(){ ['finId','finDesc','finValor','finCategoria'].forEach(i=> document.getElementById(i).value=''); document.getElementById('finTipo').value='entrada'; document.getElementById('finData').value=hojeISO(); document.getElementById('finForma').value='Dinheiro'; document.getElementById('finFuncionario').value=''; document.getElementById('finAgendamento').value=''; document.getElementById('btnCancelarFin').style.display='none'; const btn=document.querySelector('#tela-financeiro .btn-save'); if(btn) btn.textContent='💾 Lançar'; atualizarCategoriasFin(); }
function excluirFin(id){ if(!confirm('Excluir esse lançamento?')) return; financeiro=financeiro.filter(f=>f.id!==id); salvarLocal('financeiro', financeiro); listarFinanceiro(); listarPendentesFin(); }

// ===== MÓDULO 8 - DASHBOARD =====
function atualizarDashboard(){
  const hoje=hojeISO(); const mesAtual=hoje.slice(0,7);
  const ags=agendamentos; const fins=financeiro;
  const hojeEl=document.getElementById('dashHojeTxt'); if(hojeEl) hojeEl.textContent=new Date(hoje+'T12:00:00').toLocaleDateString('pt-BR',{day:'2-digit',month:'long',year:'numeric'});
  const hojeConcluidos=ags.filter(a=> a.data===hoje && a.status==='concluido');
  const fatHoje=hojeConcluidos.reduce((s,a)=> s+Number(a.preco||0),0);
  document.getElementById('dashFatHoje').textContent=fmtBRL(fatHoje); document.getElementById('dashQtdHoje').textContent=hojeConcluidos.length+' atendimentos concluídos';
  const hojeAgendados=ags.filter(a=> a.data===hoje && a.status==='agendado'); document.getElementById('dashAgHojeTxt').textContent=hojeAgendados.length+' agendados hoje';
  const finsMes=fins.filter(f=> (f.data||'').slice(0,7)===mesAtual); let entMes=0, saiMes=0; finsMes.forEach(f=>{ if(f.tipo==='entrada') entMes+=Number(f.valor); else saiMes+=Number(f.valor); });
  const mesConcluidos=ags.filter(a=> (a.data||'').slice(0,7)===mesAtual && a.status==='concluido'); const fatMesEstimado=mesConcluidos.reduce((s,a)=> s+Number(a.preco||0),0); const fatMes=Math.max(entMes, fatMesEstimado);
  document.getElementById('dashFatMes').textContent=fmtBRL(fatMes); document.getElementById('dashQtdMes').textContent=mesConcluidos.length+' atendimentos no mês';
  const saldoEl=document.getElementById('dashSaldoMes'); saldoEl.textContent=fmtBRL(entMes-saiMes); saldoEl.style.color=(entMes-saiMes)>=0?'#22C55E':'#EF4444';
  document.getElementById('dashTotalCli').textContent=clientes.length; document.getElementById('dashTotalServ').textContent=servicos.filter(s=>s.ativo).length+' ativos';
  const baixo=estoque.filter(e=> e.qtd <= e.minimo); document.getElementById('dashEstBaixo').textContent=baixo.length+' produtos';
  const proxEl=document.getElementById('dashProximos');
  if(hojeAgendados.length===0) proxEl.innerHTML='<p style="color:#A1A1AA">Nenhum agendamento pra hoje.</p>'; else { proxEl.innerHTML=''; hojeAgendados.sort((a,b)=> a.hora.localeCompare(b.hora)).slice(0,5).forEach(a=>{ const d=document.createElement('div'); d.style.cssText='background:#23232B;border:1px solid #3A3A44;border-radius:10px;padding:10px;margin-bottom:8px;display:flex;justify-content:space-between;gap:8px'; d.innerHTML=`<div><b>${a.hora} - ${a.clienteNome}</b><br><small>${a.servicoNome} - ${a.barbeiroNome} - R$ ${a.preco}</small></div><span class="tag">${a.status}</span>`; proxEl.appendChild(d); }); }
  const alEl=document.getElementById('dashAlertas'); let alertas=[];
  if(baixo.length>0) alertas.push(`⚠️ <b>${baixo.length} produto(s) abaixo do mínimo:</b> ${baixo.map(b=>b.nome).join(', ')}`);
  const pendFin=ags.filter(a=> a.status==='concluido' && !fins.find(f=> f.agId===a.id)); if(pendFin.length>0) alertas.push(`💰 <b>${pendFin.length} agendamento(s) concluído(s) sem lançamento no caixa</b>`);
  if(hojeAgendados.length>0) alertas.push(`📅 <b>${hojeAgendados.length} agendamento(s) hoje</b> - próximo às ${hojeAgendados.sort((a,b)=>a.hora.localeCompare(b.hora))[0].hora}`);
  if(alertas.length===0) alertas.push('✅ Tudo certo, nenhum alerta.');
  alEl.innerHTML=alertas.map(a=>`<div style="background:#23232B;border:1px solid #3A3A44;border-radius:10px;padding:10px;margin-bottom:8px;font-size:14px">${a}</div>`).join('');
  const rankEl=document.getElementById('dashRanking');
  if(mesConcluidos.length===0) rankEl.innerHTML='<p style="color:#A1A1AA">Nenhum atendimento concluído esse mês ainda.</p>'; else { const porBarb={}; mesConcluidos.forEach(a=>{ if(!porBarb[a.barbeiroId]) porBarb[a.barbeiroId]={ nome:a.barbeiroNome, total:0, qtd:0 }; porBarb[a.barbeiroId].total+=Number(a.preco||0); porBarb[a.barbeiroId].qtd++; }); const lista=Object.values(porBarb).sort((a,b)=> b.total-a.total); const max=Math.max(...lista.map(x=>x.total),1); rankEl.innerHTML=''; lista.forEach((b,i)=>{ const func=funcionarios.find(f=>f.nome===b.nome); let comissaoTxt=''; if(func && func.comissao){ const com=func.tipoComissao==='%' ? b.total*Number(func.comissao)/100 : Number(func.comissao)*b.qtd; comissaoTxt=` | Comissão est: ${fmtBRL(com)}`; } const d=document.createElement('div'); d.style.cssText='margin-bottom:12px'; d.innerHTML=`<div style="display:flex;justify-content:space-between;font-size:14px"><b>${i+1}º ${b.nome}</b><span>${fmtBRL(b.total)} - ${b.qtd} atend.${comissaoTxt}</span></div><div style="background:#23232B;height:10px;border-radius:6px;margin-top:4px;overflow:hidden"><div style="width:${Math.round(b.total/max*100)}%;height:100%;background:#FACC15;border-radius:6px"></div></div>`; rankEl.appendChild(d); }); }
  const topEl=document.getElementById('dashTopServ');
  if(mesConcluidos.length===0) topEl.innerHTML='<p style="color:#A1A1AA">Nenhum serviço esse mês ainda.</p>'; else { const porServ={}; mesConcluidos.forEach(a=>{ if(!porServ[a.servicoNome]) porServ[a.servicoNome]={qtd:0,total:0}; porServ[a.servicoNome].qtd++; porServ[a.servicoNome].total+=Number(a.preco||0); }); const lista=Object.entries(porServ).sort((a,b)=> b[1].qtd-a[1].qtd).slice(0,5); topEl.innerHTML=lista.map(([nome,d],i)=>`<div style="display:flex;justify-content:space-between;padding:8px 0;border-bottom:1px solid #3A3A44;font-size:14px"><span><b>${i+1}º</b> ${nome}</span><span>${d.qtd}x - ${fmtBRL(d.total)}</span></div>`).join(''); }
}

// ===== INICIALIZAÇÃO =====
carregarConfig();
atualizarDatalistFuncoes(); listarFuncionarios();
renderServBarbeiros(); listarServicos();
listarClientes();
atualizarDatalistCategoriasEst(); listarEstoque();
if(document.getElementById('agData')) document.getElementById('agData').value=hojeISO();
if(document.getElementById('agDataFiltro')) document.getElementById('agDataFiltro').value=hojeISO();
carregarBarbeirosAgenda(); listarAgenda();
if(document.getElementById('finData')) document.getElementById('finData').value=hojeISO();
atualizarCategoriasFin(); carregarSelectsFin(); listarFinanceiro(); listarPendentesFin();
atualizarDashboard();
