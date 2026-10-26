// ===== ADMIN.JS COMPLETO - DNH - BASEADO NO SEU admin.html ORIGINAL =====
let sb = null;
let currentSlug = 'dnh';
let currentShop = null;
let currentAdmin = null;
let editingServId = null;
let editingEstId = null;
let editingFuncId = null;
let editingBookId = null;
let editingMovId = null;
let selectedHora = '';
let estoqueVisible = true;
let finVisible = false;

function $id(id){ return document.getElementById(id); }
function toast(msg){
  let t = $id('toast');
  if(!t){ t=document.createElement('div'); t.id='toast'; t.className='toast'; document.body.appendChild(t); }
  t.textContent = msg; t.classList.add('show');
  setTimeout(()=> t.classList.remove('show'), 3000);
}
function fmtMoney(v){ return 'R$ ' + Number(v||0).toFixed(2).replace('.',','); }
function onlyDigits(s){ return String(s||'').replace(/\D/g,''); }
function getSlug(){
  const p = location.pathname.split('/').filter(Boolean);
  // /barbeariafulano/admin.html -> barbeariafulano | /admin.html -> dnh
  if(p.length >= 2) return p[0];
  if(p.length === 1 && !p[0].includes('.html')) return p[0];
  return localStorage.getItem('dnh_slug') || 'dnh';
}
function showLoader(hide){
  const l = $id('appLoader');
  if(l) l.classList.toggle('hidden', !!hide);
}
function openModal(id){ const m=$id(id); if(m) m.classList.add('show'); }
function closeModal(id){ const m=$id(id); if(m) m.classList.remove('show'); }
document.querySelectorAll('[data-close-modal]').forEach(b=> b.addEventListener('click', ()=> closeModal(b.dataset.closeModal)));

// ===== INIT =====
document.addEventListener('DOMContentLoaded', async ()=>{
  currentSlug = getSlug();
  localStorage.setItem('dnh_slug', currentSlug);
  if($id('slugDisplay')) $id('slugDisplay').textContent = currentSlug;
  if($id('barberSlug')) $id('barberSlug').textContent = currentSlug;

  // Supabase
  try{
    if(window.supabase && window.DNH_CONFIG){
      sb = window.supabase.createClient(window.DNH_CONFIG.supabaseUrl, window.DNH_CONFIG.supabaseAnonKey);
      window.sb = sb;
    }
  }catch(e){ console.log(e); }

  // Carrega barbearia
  if(sb){
    const {data} = await sb.from('barbershops').select('*').eq('slug', currentSlug).single();
    if(data){
      currentShop = data;
      if($id('barberName')) $id('barberName').textContent = (data.name||'BARBEARIA').toUpperCase();
      if($id('shopNameLogin')) $id('shopNameLogin').textContent = (data.name||'BARBEARIA').toUpperCase();
      if(data.logo_url){
        ['logoSidebar','logoLogin','logoDash'].forEach(i=>{ const el=$id(i); if(el) el.src=data.logo_url; });
      }
    }
  }

  // Navegação lateral
  document.querySelectorAll('.nav button').forEach(btn=>{
    btn.addEventListener('click', ()=>{
      document.querySelectorAll('.nav button').forEach(b=> b.classList.remove('active'));
      btn.classList.add('active');
      document.querySelectorAll('.page').forEach(p=> p.classList.remove('active'));
      const pg = $id('page-'+btn.dataset.page);
      if(pg) pg.classList.add('active');
      $id('sidebar')?.classList.remove('open');
      $id('overlay')?.classList.remove('show');
      if(btn.dataset.page==='clientes') carregarAniversariantes();
      if(btn.dataset.page==='dashboard') carregarDashboard();
    });
  });

  $id('btnHamburger')?.addEventListener('click', ()=>{
    $id('sidebar').classList.toggle('open'); $id('overlay').classList.toggle('show');
  });
  $id('overlay')?.addEventListener('click', ()=>{
    $id('sidebar').classList.remove('open'); $id('overlay').classList.remove('show');
  });

  // Login
  $id('btnAdminLogin')?.addEventListener('click', loginAdmin);
  $id('adminPass')?.addEventListener('keydown', e=>{ if(e.key==='Enter') loginAdmin(); });
  $id('btnLogoutAdmin')?.addEventListener('click', ()=>{
    localStorage.removeItem('dnh_admin');
    location.reload();
  });

  // Verifica sessão
  const saved = localStorage.getItem('dnh_admin');
  if(saved){
    try{ currentAdmin = JSON.parse(saved); }catch(e){}
  }
  if(currentAdmin){
    mostrarApp();
  } else {
    $id('authAdmin').classList.add('ready');
    showLoader(true);
  }

  bindEvents();
});

async function loginAdmin(){
  const email = $id('adminEmail').value.trim();
  const pass = $id('adminPass').value;
  if(!email || !pass) return toast('Preencha e-mail e senha');
  if(!sb) return toast('Erro de conexão Supabase');
  const {data, error} = await sb.auth.signInWithPassword({email, password: pass});
  if(error) return toast('Login inválido: '+error.message);
  currentAdmin = {email, id: data.user.id};
  localStorage.setItem('dnh_admin', JSON.stringify(currentAdmin));
  if($id('adminEmailDisplay')) $id('adminEmailDisplay').textContent = email;
  mostrarApp();
}

function mostrarApp(){
  $id('authAdmin').style.display='none';
  $id('appAdmin').classList.remove('hidden');
  showLoader(true);
  if(currentAdmin && $id('adminEmailDisplay')) $id('adminEmailDisplay').textContent = currentAdmin.email;
  carregarTudo();
}

async function carregarTudo(){
  await Promise.all([
    carregarDashboard(),
    carregarAgendaAdmin(),
    carregarServicos(),
    carregarEstoque(),
    carregarFuncionarios(),
    carregarFinanceiro(),
    carregarSettings(),
    carregarAniversariantes(),
    carregarCatalogoSelects()
  ]);
}

function bindEvents(){
  $id('btnFiltrarAgenda')?.addEventListener('click', carregarDashboard);
  $id('btnAgendarCliente')?.addEventListener('click', agendarCliente);
  $id('btnAddServico')?.addEventListener('click', addServico);
  $id('btnSaveEditServ')?.addEventListener('click', salvarEditServ);
  $id('btnAddCatalog')?.addEventListener('click', addCatalog);
  $id('btnAddEntrada')?.addEventListener('click', addEntrada);
  $id('btnRetirar')?.addEventListener('click', retirarEstoque);
  $id('btnToggleEstoque')?.addEventListener('click', ()=>{ estoqueVisible=!estoqueVisible; $id('listaEstoque').style.display = estoqueVisible?'block':'none'; });
  $id('btnFiltrarEst')?.addEventListener('click', carregarMovimentos);
  $id('btnLimparEst')?.addEventListener('click', ()=>{ $id('estFiltroInicio').value=''; $id('estFiltroFim').value=''; carregarMovimentos(); });
  $id('btnSaveEditEst')?.addEventListener('click', salvarEditEst);
  $id('btnSaveEditMov')?.addEventListener('click', salvarEditMov);
  $id('btnAddFunc')?.addEventListener('click', addFunc);
  $id('btnSaveEditFunc')?.addEventListener('click', salvarEditFunc);
  $id('comPeriodo')?.addEventListener('change', e=>{ $id('comCustomBox').style.display = e.target.value==='custom'?'grid':'none'; if(e.target.value!=='custom') calcularComissao(); });
  $id('btnCalcularCom')?.addEventListener('click', calcularComissao);
  $id('btnPagarComissao')?.addEventListener('click', pagarComissao);
  $id('btnLancarManualTop')?.addEventListener('click', ()=> $id('formLancarManual').classList.toggle('hidden'));
  $id('btnAddFinanceiro')?.addEventListener('click', addFinanceiro);
  $id('btnFiltrarFin')?.addEventListener('click', carregarFinanceiro);
  $id('btnToggleFin')?.addEventListener('click', ()=>{ finVisible=!finVisible; $id('listaFinanceiro').classList.toggle('hidden', !finVisible); });
  $id('btnLimparFin')?.addEventListener('click', ()=>{ $id('finInicio').value=''; $id('finFim').value=''; carregarFinanceiro(); });
  $id('btnGraficoFin')?.addEventListener('click', ()=>{ $id('graficoWrap').classList.toggle('hidden'); desenharGrafico(); });
  $id('saveSettings')?.addEventListener('click', salvarSettings);
  $id('btnSaveEditBook')?.addEventListener('click', salvarEditBook);
  $id('agData')?.addEventListener('change', carregarHorarios);
  $id('agFuncionario')?.addEventListener('change', carregarHorarios);
  $id('agServico')?.addEventListener('change', carregarHorarios);
  $id('retiradaProduto')?.addEventListener('change', atualizarRetiradaInfo);
  $id('buscaCliente')?.addEventListener('input', carregarAniversariantes);
  const hoje = new Date().toISOString().slice(0,10);
  if($id('agData')) $id('agData').value = hoje;
  if($id('estEntradaData')) $id('estEntradaData').value = hoje;
  if($id('retiradaData')) $id('retiradaData').value = hoje;
  if($id('finData')) $id('finData').value = hoje;
}

// ===== DASHBOARD =====
async function carregarDashboard(){
  if(!sb) return;
  const hoje = new Date().toISOString().slice(0,10);
  if($id('dashDate')) $id('dashDate').textContent = new Date().toLocaleDateString('pt-BR');
  const {data:bookings=[]} = await sb.from('bookings').select('*, services(name,price)').eq('slug', currentSlug).eq('date', hoje);
  const pagos = bookings.filter(b=> b.status==='paid' || b.payment_status==='paid');
  const receita = pagos.reduce((s,b)=> s + Number(b.price||b.services?.price||0), 0);
  if($id('dashHoje')) $id('dashHoje').textContent = bookings.length;
  if($id('dashClientes')) $id('dashClientes').textContent = new Set(bookings.map(b=>b.phone)).size;
  if($id('dashReceita')) $id('dashReceita').textContent = fmtMoney(receita);
  if($id('dashTicket')) $id('dashTicket').textContent = fmtMoney(bookings.length? receita/bookings.length : 0);
  if($id('todayAgenda')) $id('todayAgenda').innerHTML = bookings.map(b=> `<div class="list-row"><div><b>${b.time||''} - ${b.customer_name||b.name||''}</b><br><small>${b.services?.name||''} - ${b.employee_name||b.barber||''}</small></div><span>${b.status||''}</span></div>`).join('') || 'Nenhum atendimento hoje';
  // Estoque alerta
  const {data:estoque=[]} = await sb.from('stock').select('*').eq('slug', currentSlug);
  const baixo = estoque.filter(e=> Number(e.quantity||0) <= Number(e.min_quantity||e.min||5));
  if($id('dashEstoque')) $id('dashEstoque').innerHTML = baixo.map(e=> `<div>⚠️ ${e.name} - ${e.quantity} restantes</div>`).join('') || 'Estoque OK ✅';
  // Filtro intervalo
  const ini = $id('filtroInicio')?.value; const fim = $id('filtroFim')?.value;
  if(ini && fim){
    let q = sb.from('bookings').select('*').eq('slug', currentSlug).gte('date', ini).lte('date', fim);
    const {data:fil=[]} = await q;
    const rec = fil.filter(b=> b.status==='paid').reduce((s,b)=> s+Number(b.price||0),0);
    if($id('filtroResultado')) $id('filtroResultado').innerHTML = `<b>${fil.length}</b> atendimentos • Receita: <b>${fmtMoney(rec)}</b>`;
  }
  carregarAniversariantes();
}

// ===== AGENDA =====
async function carregarAgendaAdmin(){
  if(!sb) return;
  const {data:funcs=[]} = await sb.from('employees').select('*').eq('slug', currentSlug);
  const {data:servs=[]} = await sb.from('services').select('*').eq('slug', currentSlug);
  if($id('agFuncionario')) $id('agFuncionario').innerHTML = funcs.map(f=> `<option value="${f.id}">${f.name}</option>`).join('');
  if($id('agServico')) $id('agServico').innerHTML = servs.map(s=> `<option value="${s.id}">${s.name} - ${fmtMoney(s.price)}</option>`).join('');
  if($id('editBookFunc')) $id('editBookFunc').innerHTML = funcs.map(f=> `<option value="${f.id}">${f.name}</option>`).join('');
  if($id('editBookServ')) $id('editBookServ').innerHTML = servs.map(s=> `<option value="${s.id}">${s.name}</option>`).join('');
  carregarHorarios();
  const {data:bookings=[]} = await sb.from('bookings').select('*, services(name)').eq('slug', currentSlug).order('date',{ascending:false}).limit(50);
  if($id('adminAgendaList')) $id('adminAgendaList').innerHTML = bookings.map(b=> `<div class="list-row"><div><b>${b.date} ${b.time||''} - ${b.customer_name||b.name}</b><br><small>${b.services?.name||''} • ${b.phone||''} • ${b.status||''}</small></div><div style="display:flex;gap:6px"><button class="btn small" onclick="marcarPago('${b.id}')">✅ Pago</button><button class="btn small" onclick="editarBooking('${b.id}')">✏️</button><button class="btn small danger" onclick="excluirBooking('${b.id}')">🗑️</button></div></div>`).join('') || 'Sem agendamentos';
}
async function carregarHorarios(){
  if(!sb) return;
  const data = $id('agData')?.value; const funcId = $id('agFuncionario')?.value;
  if(!data || !funcId) return;
  const {data:bookings=[]} = await sb.from('bookings').select('time').eq('slug', currentSlug).eq('date', data).eq('employee_id', funcId).neq('status','cancelled');
  const ocupados = new Set(bookings.map(b=>b.time));
  const horarios = [];
  let start = 8*60, end = 18*60, interval = Number(currentShop?.interval_minutes||30);
  // tenta pegar do shop
  if(currentShop?.start_time) start = parseInt(currentShop.start_time.split(':')[0])*60 + parseInt(currentShop.start_time.split(':')[1]);
  if(currentShop?.end_time) end = parseInt(currentShop.end_time.split(':')[0])*60 + parseInt(currentShop.end_time.split(':')[1]);
  for(let m=start; m<end; m+=interval){
    const h = String(Math.floor(m/60)).padStart(2,'0')+':'+String(m%60).padStart(2,'0');
    horarios.push(h);
  }
  if($id('agHoraGrid')) $id('agHoraGrid').innerHTML = horarios.map(h=>{
    const occ = ocupados.has(h);
    const sel = selectedHora===h ? 'background:var(--gold);color:#000;' : '';
    return `<button type="button" ${occ?'disabled':''} onclick="selecionarHora('${h}', this)" style="padding:10px;border-radius:8px;border:1px solid var(--border);background:${occ?'#2a1515':'#0a0e1a'};color:${occ?'#666':'#fff'};cursor:${occ?'not-allowed':'pointer'};${sel}">${h}</button>`;
  }).join('');
}
function selecionarHora(h, el){
  selectedHora = h;
  document.querySelectorAll('#agHoraGrid button').forEach(b=> b.style.background='#0a0e1a');
  if(el) el.style.background='var(--gold)';
}
async function agendarCliente(){
  const date = $id('agData').value, employee_id = $id('agFuncionario').value, service_id = $id('agServico').value;
  const name = $id('agClienteNome').value.trim(), phone = $id('agClientePhone').value.trim(), obs = $id('agObs').value.trim();
  if(!date || !employee_id || !service_id || !name || !phone || !selectedHora) return toast('Preencha tudo e escolha horário');
  const {data:serv} = await sb.from('services').select('*').eq('id', service_id).single();
  const {data:func} = await sb.from('employees').select('*').eq('id', employee_id).single();
  const {error} = await sb.from('bookings').insert([{slug: currentSlug, date, time: selectedHora, employee_id, employee_name: func?.name||'', service_id, customer_name: name, name, phone, obs, notes: obs, price: serv?.price||0, status: 'pending'}]);
  if(error) return toast('Erro: '+error.message);
  // Salva cliente também na tabela customers (para aniversariante)
  await sb.from('customers').upsert({slug: currentSlug, name, phone}, {onConflict:'slug,phone'}).then(()=>{});
  toast('Agendado! ✅'); selectedHora=''; $id('agClienteNome').value=''; $id('agClientePhone').value=''; $id('agObs').value='';
  carregarDashboard(); carregarAgendaAdmin();
}
async function marcarPago(id){
  await sb.from('bookings').update({status:'paid', payment_status:'paid'}).eq('id', id);
  toast('Marcado como pago ✅'); carregarDashboard(); carregarAgendaAdmin(); carregarFinanceiro();
}
async function excluirBooking(id){
  if(!confirm('Excluir agendamento?')) return;
  await sb.from('bookings').delete().eq('id', id);
  carregarDashboard(); carregarAgendaAdmin();
}
async function editarBooking(id){
  editingBookId = id;
  const {data:b} = await sb.from('bookings').select('*').eq('id', id).single();
  if(!b) return;
  $id('editBookData').value = b.date; $id('editBookHora').value = b.time;
  $id('editBookCliente').value = b.customer_name||b.name||''; $id('editBookPhone').value = b.phone||'';
  $id('editBookObs').value = b.obs||b.notes||''; $id('editBookFunc').value = b.employee_id||''; $id('editBookServ').value = b.service_id||'';
  openModal('editBookingModal');
}
async function salvarEditBook(){
  await sb.from('bookings').update({date: $id('editBookData').value, time: $id('editBookHora').value, customer_name: $id('editBookCliente').value, name: $id('editBookCliente').value, phone: $id('editBookPhone').value, obs: $id('editBookObs').value, employee_id: $id('editBookFunc').value, service_id: $id('editBookServ').value}).eq('id', editingBookId);
  closeModal('editBookingModal'); toast('Salvo ✅'); carregarAgendaAdmin(); carregarDashboard();
}

// ===== SERVIÇOS =====
async function carregarServicos(){
  if(!sb) return;
  const {data=[]} = await sb.from('services').select('*').eq('slug', currentSlug).order('name');
  if($id('listaServicos')) $id('listaServicos').innerHTML = data.map(s=> `<div class="list-row"><div><b>${s.name}</b><br><small>${fmtMoney(s.price)} • ${s.duration||s.duration_minutes||30} min</small></div><div style="display:flex;gap:6px"><button class="btn small" onclick="editarServ('${s.id}','${s.name}',${s.price},${s.duration||s.duration_minutes||30})">✏️</button><button class="btn small danger" onclick="excluirServ('${s.id}')">🗑️</button></div></div>`).join('') || 'Sem serviços';
}
async function addServico(){
  const name = $id('servNome').value.trim(); const price = parseFloat($id('servPreco').value); const dur = parseInt($id('servDuracao').value)||30;
  if(!name || !price) return toast('Preencha nome e preço');
  const {error} = await sb.from('services').insert([{slug: currentSlug, name, price, duration: dur, duration_minutes: dur}]);
  if(error) return toast(error.message);
  $id('servNome').value=''; $id('servPreco').value=''; toast('Serviço adicionado ✅'); carregarServicos(); carregarAgendaAdmin();
}
function editarServ(id, nome, preco, dur){
  editingServId = id; $id('editServNome').value=nome; $id('editServPreco').value=preco; $id('editServDuracao').value=dur; openModal('editServModal');
}
async function salvarEditServ(){
  await sb.from('services').update({name: $id('editServNome').value, price: parseFloat($id('editServPreco').value), duration: parseInt($id('editServDuracao').value), duration_minutes: parseInt($id('editServDuracao').value)}).eq('id', editingServId);
  closeModal('editServModal'); toast('Salvo ✅'); carregarServicos();
}
async function excluirServ(id){
  if(!confirm('Excluir serviço?')) return;
  await sb.from('services').delete().eq('id', id); carregarServicos();
}

// ===== ESTOQUE =====
async function carregarCatalogoSelects(){
  if(!sb) return;
  const {data=[]} = await sb.from('stock_catalog').select('*').eq('slug', currentSlug).order('name');
  const opts = data.map(c=> `<option value="${c.name}">${c.name}</option>`).join('');
  if($id('estEntradaProduto')) $id('estEntradaProduto').innerHTML = opts || '<option value="">Cadastre um produto no catálogo</option>';
  if($id('retiradaProduto')) $id('retiradaProduto').innerHTML = opts;
  if($id('estFiltroProduto')) $id('estFiltroProduto').innerHTML = '<option value="">Todos produtos</option>'+opts;
}
async function addCatalog(){
  const name = $id('newCatalogName').value.trim().toLowerCase();
  if(!name) return toast('Digite o nome');
  const {error} = await sb.from('stock_catalog').insert([{slug: currentSlug, name}]);
  if(error) return toast(error.message);
  $id('newCatalogName').value=''; toast('Salvo no catálogo ✅'); carregarCatalogoSelects();
}
async function carregarEstoque(){
  if(!sb) return;
  const {data=[]} = await sb.from('stock').select('*').eq('slug', currentSlug).order('name');
  if($id('listaEstoque')) $id('listaEstoque').innerHTML = data.map(e=> `<div class="list-row ${Number(e.quantity||0) <= Number(e.min_quantity||5) ? 'estoque-alerta' : ''}"><div><b>${e.name}</b><br><small>Qtd: ${e.quantity} • Mín: ${e.min_quantity||e.min||5} • Custo: ${fmtMoney(e.cost||e.unit_cost||0)}</small></div><button class="btn small" onclick="editarEst('${e.id}','${e.name}',${e.quantity},${e.min_quantity||5},${e.cost||0},'${e.category||''}')">✏️</button></div>`).join('') || 'Estoque vazio';
  carregarMovimentos();
}
async function addEntrada(){
  const produto = $id('estEntradaProduto').value; const qtd = parseFloat($id('estEntradaQtd').value); const custo = parseFloat($id('estEntradaCusto').value)||0; const dataCompra = $id('estEntradaData').value; const forn = $id('estEntradaForn').value;
  if(!produto || !qtd || !dataCompra) return toast('Preencha produto, qtd e data');
  const {data:atual} = await sb.from('stock').select('*').eq('slug', currentSlug).eq('name', produto).single();
  if(atual) await sb.from('stock').update({quantity: Number(atual.quantity)+qtd, cost: custo||atual.cost}).eq('id', atual.id);
  else await sb.from('stock').insert([{slug: currentSlug, name: produto, quantity: qtd, min_quantity: 5, cost: custo, category: ''}]);
  await sb.from('stock_movements').insert([{slug: currentSlug, product: produto, product_name: produto, type: 'entrada', quantity: qtd, cost: custo, date: dataCompra, supplier: forn, obs: forn}]);
  toast('Compra registrada ✅'); carregarEstoque(); $id('estEntradaQtd').value='';
}
async function atualizarRetiradaInfo(){
  const prod = $id('retiradaProduto').value;
  const {data} = await sb.from('stock').select('*').eq('slug', currentSlug).eq('name', prod).single();
  if($id('retiradaInfo')) $id('retiradaInfo').textContent = data ? `Saldo atual: ${data.quantity}` : '';
}
async function retirarEstoque(){
  const produto = $id('retiradaProduto').value; const qtd = parseFloat($id('retiradaQtd').value); const dataUso = $id('retiradaData').value; const motivo = $id('retiradaMotivo').value;
  if(!produto || !qtd || !dataUso) return toast('Preencha tudo');
  const {data:atual} = await sb.from('stock').select('*').eq('slug', currentSlug).eq('name', produto).single();
  if(!atual || Number(atual.quantity) < qtd) return toast('Saldo insuficiente');
  await sb.from('stock').update({quantity: Number(atual.quantity)-qtd}).eq('id', atual.id);
  await sb.from('stock_movements').insert([{slug: currentSlug, product: produto, product_name: produto, type: 'saida', quantity: qtd, date: dataUso, reason: motivo, motivo, obs: motivo}]);
  toast('Saída registrada ✅'); carregarEstoque(); $id('retiradaQtd').value='';
}
function editarEst(id, nome, qtd, min, custo, cat){
  editingEstId=id; $id('editEstNome').value=nome; $id('editEstQtd').value=qtd; $id('editEstMin').value=min; $id('editEstCusto').value=custo; $id('editEstCat').value=cat; openModal('editEstModal');
}
async function salvarEditEst(){
  await sb.from('stock').update({quantity: parseFloat($id('editEstQtd').value), min_quantity: parseFloat($id('editEstMin').value), cost: parseFloat($id('editEstCusto').value), category: $id('editEstCat').value}).eq('id', editingEstId);
  closeModal('editEstModal'); toast('Salvo ✅'); carregarEstoque();
}
async function carregarMovimentos(){
  if(!sb) return;
  let q = sb.from('stock_movements').select('*').eq('slug', currentSlug).order('date',{ascending:false}).limit(100);
  const ini = $id('estFiltroInicio')?.value; const fim = $id('estFiltroFim')?.value; const prod = $id('estFiltroProduto')?.value;
  if(ini) q = q.gte('date', ini); if(fim) q = q.lte('date', fim); if(prod) q = q.eq('product', prod);
  const {data=[]} = await q;
  if($id('listaMovimentos')) $id('listaMovimentos').innerHTML = data.map(m=> `<div class="list-row"><div><b>${m.type==='entrada'?'🟢':'🔴'} ${m.product||m.product_name} - ${m.quantity}</b><br><small>${m.date} • ${m.supplier||m.reason||m.obs||''}</small></div><button class="btn small" onclick="editarMov('${m.id}','${m.product||m.product_name}','${m.type}',${m.quantity},'${m.date}',${m.cost||0},'${m.supplier||m.reason||''}')">✏️</button></div>`).join('') || 'Sem movimentos';
}
function editarMov(id, prod, tipo, qtd, data, custo, obs){
  editingMovId=id; $id('editMovProduto').value=prod; $id('editMovTipo').value=tipo; $id('editMovQtd').value=qtd; $id('editMovData').value=data; $id('editMovCusto').value=custo; $id('editMovObs').value=obs; openModal('editMovModal');
}
async function salvarEditMov(){
  await sb.from('stock_movements').update({type: $id('editMovTipo').value, quantity: parseFloat($id('editMovQtd').value), date: $id('editMovData').value, cost: parseFloat($id('editMovCusto').value), supplier: $id('editMovObs').value, obs: $id('editMovObs').value}).eq('id', editingMovId);
  closeModal('editMovModal'); toast('Movimentação atualizada ✅ - Ajuste o saldo manualmente se precisar'); carregarEstoque();
}

// ===== FUNCIONÁRIOS =====
async function carregarFuncionarios(){
  if(!sb) return;
  const {data=[]} = await sb.from('employees').select('*').eq('slug', currentSlug).order('name');
  if($id('listaFuncionarios')) $id('listaFuncionarios').innerHTML = data.map(f=> `<div class="list-row"><div><b>${f.name}</b><br><small>${f.phone} • ${f.role||f.funcao||'barbeiro'} • ${f.commission_percent||f.commission||50}${f.commission_type==='fixed'?' R$ fixo':'%'}</small></div><div style="display:flex;gap:6px"><button class="btn small" onclick="editarFunc('${f.id}','${f.name}','${f.phone}','${f.role||'barbeiro'}','${f.start_time||'08:00'}','${f.end_time||'18:00'}',${f.commission_percent||f.commission||50},'${f.commission_type||'percent'}','${f.email||''}')">✏️</button><button class="btn small danger" onclick="excluirFunc('${f.id}')">🗑️</button></div></div>`).join('') || 'Sem funcionários';
  if($id('comBarbeiro')) $id('comBarbeiro').innerHTML = data.map(f=> `<option value="${f.id}">${f.name}</option>`).join('');
}
async function addFunc(){
  const name = $id('funcNome').value.trim(); const phone = $id('funcPhone').value.trim();
  if(!name || !phone) return toast('Preencha nome e telefone');
  const {error} = await sb.from('employees').insert([{slug: currentSlug, name, phone, role: $id('funcFuncao').value, funcao: $id('funcFuncao').value, start_time: $id('funcInicio').value, end_time: $id('funcFim').value, email: $id('funcEmail').value, commission_percent: parseFloat($id('funcComissao').value)||50, commission: parseFloat($id('funcComissao').value)||50, commission_type: $id('funcComissaoTipo').value}]);
  if(error) return toast(error.message);
  toast('Funcionário cadastrado ✅'); $id('funcNome').value=''; $id('funcPhone').value=''; carregarFuncionarios(); carregarAgendaAdmin();
}
function editarFunc(id, nome, phone, funcao, ini, fim, com, tipo, email){
  editingFuncId=id; $id('editFuncNome').value=nome; $id('editFuncPhone').value=phone; $id('editFuncFuncao').value=funcao; $id('editFuncInicio').value=ini; $id('editFuncFim').value=fim; $id('editFuncComissao').value=com; $id('editFuncComissaoTipo').value=tipo; $id('editFuncEmail').value=email; openModal('editFuncModal');
}
async function salvarEditFunc(){
  await sb.from('employees').update({name: $id('editFuncNome').value, phone: $id('editFuncPhone').value, role: $id('editFuncFuncao').value, start_time: $id('editFuncInicio').value, end_time: $id('editFuncFim').value, commission_percent: parseFloat($id('editFuncComissao').value), commission: parseFloat($id('editFuncComissao').value), commission_type: $id('editFuncComissaoTipo').value, email: $id('editFuncEmail').value}).eq('id', editingFuncId);
  closeModal('editFuncModal'); toast('Salvo ✅'); carregarFuncionarios();
}
async function excluirFunc(id){
  if(!confirm('Excluir funcionário?')) return;
  await sb.from('employees').delete().eq('id', id); carregarFuncionarios();
}

// ===== COMISSÕES =====
function getPeriodo(){
  const p = $id('comPeriodo').value; const hoje = new Date();
  if(p==='hoje') return {ini: hoje.toISOString().slice(0,10), fim: hoje.toISOString().slice(0,10)};
  if(p==='semana'){ const d = new Date(hoje); d.setDate(hoje.getDate()-7); return {ini: d.toISOString().slice(0,10), fim: hoje.toISOString().slice(0,10)}; }
  if(p==='quinzena'){ const d = new Date(hoje); d.setDate(hoje.getDate()-15); return {ini: d.toISOString().slice(0,10), fim: hoje.toISOString().slice(0,10)}; }
  if(p==='mes') return {ini: hoje.toISOString().slice(0,7)+'-01', fim: hoje.toISOString().slice(0,10)};
  return {ini: $id('comInicio').value, fim: $id('comFim').value};
}
let comissaoAtual = null;
async function calcularComissao(){
  if(!sb) return;
  const barbeiroId = $id('comBarbeiro').value; const {ini, fim} = getPeriodo();
  if(!barbeiroId || !ini || !fim) return;
  const {data:func} = await sb.from('employees').select('*').eq('id', barbeiroId).single();
  const {data:books=[]} = await sb.from('bookings').select('*, services(price)').eq('slug', currentSlug).eq('employee_id', barbeiroId).gte('date', ini).lte('date', fim).eq('status','paid');
  const total = books.reduce((s,b)=> s+Number(b.price||b.services?.price||0),0);
  let comissao = 0;
  if(func?.commission_type==='fixed') comissao = books.length * Number(func.commission_percent||func.commission||0);
  else comissao = total * (Number(func?.commission_percent||func?.commission||50)/100);
  comissaoAtual = {employee_id: barbeiroId, employee_name: func?.name, ini, fim, total, comissao, qtd: books.length};
  if($id('comResumo')) $id('comResumo').innerHTML = `<div class="grid-3"><div class="metric-card"><small>ATENDIMENTOS</small><b>${books.length}</b></div><div class="metric-card"><small>FATURAMENTO</small><b>${fmtMoney(total)}</b></div><div class="metric-card"><small>COMISSÃO</small><b style="color:var(--gold)">${fmtMoney(comissao)}</b></div></div>`;
  if($id('listaComissoes')) $id('listaComissoes').innerHTML = books.map(b=> `<div class="list-row"><div><b>${b.date} ${b.time||''} - ${b.customer_name||b.name}</b><br><small>${fmtMoney(b.price||0)}</small></div></div>`).join('') || 'Sem atendimentos pagos no período';
  if($id('btnPagarComissao')) $id('btnPagarComissao').style.display='block';
  carregarPagamentos();
}
async function pagarComissao(){
  if(!comissaoAtual) return;
  const {error} = await sb.from('commission_payments').insert([{slug: currentSlug, employee_id: comissaoAtual.employee_id, employee_name: comissaoAtual.employee_name, start_date: comissaoAtual.ini, end_date: comissaoAtual.fim, total: comissaoAtual.total, commission: comissaoAtual.comissao, amount: comissaoAtual.comissao, paid_at: new Date().toISOString()}]);
  if(error) return toast(error.message);
  toast('Comissão marcada como paga ✅'); carregarPagamentos();
}
async function carregarPagamentos(){
  if(!sb) return;
  const {data=[]} = await sb.from('commission_payments').select('*').eq('slug', currentSlug).order('paid_at',{ascending:false}).limit(20);
  if($id('listaPagamentos')) $id('listaPagamentos').innerHTML = data.map(p=> `<div class="list-row"><div><b>${p.employee_name} - ${fmtMoney(p.commission||p.amount)}</b><br><small>${p.start_date} até ${p.end_date}</small></div></div>`).join('') || 'Nenhum pagamento ainda';
}

// ===== FINANCEIRO =====
async function carregarFinanceiro(){
  if(!sb) return;
  let q = sb.from('finance').select('*').eq('slug', currentSlug).order('date',{ascending:false}).limit(100);
  const ini = $id('finInicio')?.value; const fim = $id('finFim')?.value;
  if(ini) q = q.gte('date', ini); if(fim) q = q.lte('date', fim);
  const {data=[]} = await q;
  const ent = data.filter(f=> f.type==='income').reduce((s,f)=> s+Number(f.amount||f.value||0),0);
  const sai = data.filter(f=> f.type==='expense').reduce((s,f)=> s+Number(f.amount||f.value||0),0);
  if($id('finResumo')) $id('finResumo').innerHTML = `<div class="metric-card"><small>ENTRADAS</small><b style="color:#4ade80">${fmtMoney(ent)}</b></div><div class="metric-card"><small>SAÍDAS</small><b style="color:#f87171">${fmtMoney(sai)}</b></div><div class="metric-card"><small>LUCRO</small><b style="color:var(--gold)">${fmtMoney(ent-sai)}</b></div>`;
  if($id('listaFinanceiro')) $id('listaFinanceiro').innerHTML = data.map(f=> `<div class="list-row"><div><b>${f.type==='income'?'🟢':'🔴'} ${f.description||f.desc||f.category} - ${fmtMoney(f.amount||f.value)}</b><br><small>${f.date} • ${f.category||''} • ${f.payment_method||f.form||''}</small></div><button class="btn small danger" onclick="excluirFin('${f.id}')">🗑️</button></div>`).join('') || 'Sem lançamentos';
  window._finData = data;
}
async function addFinanceiro(){
  const valor = parseFloat($id('finValor').value); const data = $id('finData').value || new Date().toISOString().slice(0,10);
  if(!valor) return toast('Preencha valor');
  const {error} = await sb.from('finance').insert([{slug: currentSlug, type: $id('finTipo').value, amount: valor, value: valor, date: data, category: $id('finCategoria').value, payment_method: $id('finForma').value, form: $id('finForma').value, description: $id('finDesc').value, desc: $id('finDesc').value}]);
  if(error) return toast(error.message);
  toast('Lançado ✅'); $id('formLancarManual').classList.add('hidden'); carregarFinanceiro();
}
async function excluirFin(id){
  if(!confirm('Excluir lançamento?')) return;
  await sb.from('finance').delete().eq('id', id); carregarFinanceiro();
}
function desenharGrafico(){
  const canvas = $id('finChart'); if(!canvas) return;
  const ctx = canvas.getContext('2d'); const data = window._finData||[];
  ctx.clearRect(0,0,canvas.width,canvas.height);
  const porDia = {};
  data.forEach(f=>{ porDia[f.date] = (porDia[f.date]||0) + (f.type==='income'? Number(f.amount||0) : -Number(f.amount||0)); });
  const dias = Object.keys(porDia).sort().slice(-15);
  const max = Math.max(1, ...dias.map(d=> Math.abs(porDia[d])));
  ctx.fillStyle='#d4af37'; ctx.font='12px Inter';
  dias.forEach((d,i)=>{
    const h = Math.abs(porDia[d])/max*200;
    const x = 20 + i*50; const y = 280 - h;
    ctx.fillStyle = porDia[d]>=0 ? '#4ade80' : '#f87171';
    ctx.fillRect(x, y, 30, h);
    ctx.fillStyle='#fff'; ctx.fillText(d.slice(5), x, 300);
  });
  if($id('graficoLegenda')) $id('graficoLegenda').textContent = 'Verde = lucro do dia, Vermelho = prejuízo';
}

// ===== SETTINGS =====
async function carregarSettings(){
  if(!currentShop) return;
  if($id('setName')) $id('setName').value = currentShop.name||'';
  if($id('setWhatsapp')) $id('setWhatsapp').value = currentShop.whatsapp||currentShop.phone||'';
  if($id('setLogoUrl')) $id('setLogoUrl').value = currentShop.logo_url||'';
  if($id('setStart')) $id('setStart').value = currentShop.start_time||'08:00';
  if($id('setEnd')) $id('setEnd').value = currentShop.end_time||'18:00';
  if($id('setInterval')) $id('setInterval').value = currentShop.interval_minutes||30;
  if($id('setLunchStart')) $id('setLunchStart').value = currentShop.lunch_start||'12:00';
  if($id('setLunchEnd')) $id('setLunchEnd').value = currentShop.lunch_end||'13:00';
  // Dias da semana
  const dias = ['Dom','Seg','Ter','Qua','Qui','Sex','Sáb'];
  const abertos = currentShop.working_days || [0,1,2,3,4,5,6];
  if($id('weeklyBox')) $id('weeklyBox').innerHTML = dias.map((d,i)=> `<label style="margin-right:12px"><input type="checkbox" class="dia-semana" value="${i}" ${abertos.includes(i)?'checked':''}> ${d}</label>`).join('');
  if($id('logoPreview') && currentShop.logo_url){ $id('logoPreview').src=currentShop.logo_url; $id('logoPreview').style.display='block'; }
}
async function salvarSettings(){
  const dias = Array.from(document.querySelectorAll('.dia-semana:checked')).map(c=> parseInt(c.value));
  let logoUrl = $id('setLogoUrl').value;
  const file = $id('setLogoFile').files[0];
  if(file && sb){
    const path = `${currentSlug}/${Date.now()}_${file.name}`;
    const {error:upErr} = await sb.storage.from('logos').upload(path, file);
    if(!upErr){
      const {data} = sb.storage.from('logos').getPublicUrl(path);
      logoUrl = data.publicUrl;
    }
  }
  const payload = {name: $id('setName').value, whatsapp: $id('setWhatsapp').value, phone: $id('setWhatsapp').value, logo_url: logoUrl, start_time: $id('setStart').value, end_time: $id('setEnd').value, interval_minutes: parseInt($id('setInterval').value)||30, lunch_start: $id('setLunchStart').value, lunch_end: $id('setLunchEnd').value, working_days: dias};
  const {error} = await sb.from('barbershops').update(payload).eq('slug', currentSlug);
  if(error) return toast(error.message);
  toast('Salvo ✅'); currentShop = {...currentShop, ...payload};
}

// ===== CLIENTES / ANIVERSARIANTES - SÓ ADIÇÃO =====
async function carregarAniversariantes(){
  try{
    const client = sb || (window.supabase ? window.supabase.createClient(window.DNH_CONFIG.supabaseUrl, window.DNH_CONFIG.supabaseAnonKey) : null);
    if(!client) return;
    const {data:clientes=[]} = await client.from('customers').select('*').eq('slug', currentSlug);
    const elTotal = document.getElementById('totalClientes');
    if(elTotal) elTotal.textContent = clientes.length;
    const hoje = new Date(); const mesHoje = hoje.getMonth()+1; const diaHoje = hoje.getDate();
    const comNasc = clientes.filter(c=>c.birthdate);
    const doMes = comNasc.filter(c=> (new Date(c.birthdate+'T12:00:00').getMonth()+1)===mesHoje );
    const deHoje = doMes.filter(c=> new Date(c.birthdate+'T12:00:00').getDate()===diaHoje);
    doMes.sort((a,b)=> new Date(a.birthdate).getDate() - new Date(b.birthdate).getDate());
    const elMes = document.getElementById('totalAniversarioMes');
    if(elMes) elMes.textContent = doMes.length;
    const elLista = document.getElementById('listaAniversarioMes');
    if(elLista) elLista.innerHTML = doMes.map(c=>{
      const d = new Date(c.birthdate+'T12:00:00');
      const ehHoje = d.getDate()===diaHoje ? ' <b style="color:var(--gold)">- HOJE 🎉</b>' : '';
      const msg = encodeURIComponent(`Fala ${c.name}! Aqui é da Barbearia! Parabéns pelo seu dia! 🎂✂️ Passa aqui essa semana que você tem 20% DE DESCONTO DE ANIVERSARIANTE! Quer agendar?`);
      return `• ${c.name} - ${String(d.getDate()).padStart(2,'0')}/${String(d.getMonth()+1).padStart(2,'0')} - ${c.phone} <a href="https://wa.me/55${String(c.phone).replace(/\D/g,'')}?text=${msg}" target="_blank" style="color:#25D366">WhatsApp</a>${ehHoje}`;
    }).join('<br>') || 'Nenhum esse mês';
    if(deHoje.length>0){
      const card = document.getElementById('cardAniversario');
      if(card){
        card.style.display='block';
        document.getElementById('listaAniversarioHoje').innerHTML = deHoje.map(c=>`🎉 <b>${c.name}</b> - ${c.phone} - faz aniversário hoje!`).join('<br>');
        document.getElementById('botoesAniversarioHoje').innerHTML = deHoje.map(c=>{
          const msg = encodeURIComponent(`Fala ${c.name}! Aqui é da Barbearia! Parabéns pelo seu dia! 🎂 Hoje você tem 20% DE DESCONTO DE ANIVERSARIANTE, quer aproveitar e agendar seu corte?`);
          return `<a href="https://wa.me/55${String(c.phone).replace(/\D/g,'')}?text=${msg}" target="_blank" style="display:inline-block;margin:6px 6px 0 0;background:#25D366;color:#fff;padding:8px 12px;border-radius:8px;text-decoration:none;font-weight:700">WhatsApp ${c.name}</a>`;
        }).join('');
      }
    }
    const lista = document.getElementById('listaClientes');
    if(lista){
      const filtro = (document.getElementById('buscaCliente')?.value||'').toLowerCase();
      const filtrados = filtro ? clientes.filter(c=>c.name.toLowerCase().includes(filtro)||String(c.phone).includes(filtro)) : clientes;
      lista.innerHTML = filtrados.map(c=>{
        const d=c.birthdate?new Date(c.birthdate+'T12:00:00'):null;
        const nasc=d?`${String(d.getDate()).padStart(2,'0')}/${String(d.getMonth()+1).padStart(2,'0')}/${d.getFullYear()}`:'—';
        return `<div class="list-row"><div><b>${c.name}</b><br><small>${c.phone} • Nasc: ${nasc}</small></div><a href="https://wa.me/55${String(c.phone).replace(/\D/g,'')}" target="_blank"><button class="btn small">WhatsApp</button></a></div>`;
      }).join('') || 'Nenhum cliente ainda';
    }
  }catch(e){ console.log('aniversariantes', e); }
}
