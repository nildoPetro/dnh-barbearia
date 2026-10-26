// ===== ADMIN.JS COMPLETO FINAL V5 - NOMES REAIS DO SUPABASE =====
// professionals = funcionarios | product_catalog = catalogo | inventory = estoque
// inventory_movements = movimentos | cash_entries = financeiro | professional_payments = comissoes
// SEM coluna "desc" - desc e palavra reservada do Postgres e quebra o SQL
let sb=null, currentSlug='dnh', currentShop=null, currentAdmin=null;
let editingServId=null, editingEstId=null, editingFuncId=null, editingBookId=null, editingMovId=null, editingClienteId=null;
let selectedHora='', estoqueVisible=true, finVisible=false;
let cacheFuncionarios=[], cacheServicos=[];
function $id(id){return document.getElementById(id);}
function toast(m){let t=$id('toast'); if(!t){t=document.createElement('div'); t.id='toast'; t.className='toast'; document.body.appendChild(t);} t.textContent=m; t.classList.add('show'); setTimeout(()=>t.classList.remove('show'),3000);}
function fmtMoney(v){return 'R$ '+Number(v||0).toFixed(2).replace('.',',');}
function getSlug(){const p=location.pathname.split('/').filter(Boolean); if(p.length>=2) return p[0]; if(p.length===1&&!p[0].includes('.html')) return p[0]; return localStorage.getItem('dnh_slug')||'dnh';}
function openModal(id){$id(id)?.classList.add('show');}
function closeModal(id){$id(id)?.classList.remove('show');}

document.addEventListener('DOMContentLoaded', async ()=>{
  currentSlug=getSlug(); localStorage.setItem('dnh_slug',currentSlug);
  if($id('slugDisplay')) $id('slugDisplay').textContent=currentSlug;
  if($id('barberSlug')) $id('barberSlug').textContent=currentSlug;
  try{ if(window.supabase&&window.DNH_CONFIG){ sb=window.supabase.createClient(window.DNH_CONFIG.supabaseUrl, window.DNH_CONFIG.supabaseAnonKey); window.sb=sb; } }catch(e){ console.log(e); }
  if(sb){ const {data}=await sb.from('barbershops').select('*').eq('slug',currentSlug).single(); if(data){ currentShop=data; if($id('barberName')) $id('barberName').textContent=(data.name||'BARBEARIA').toUpperCase(); if($id('shopNameLogin')) $id('shopNameLogin').textContent=(data.name||'BARBEARIA').toUpperCase(); if(data.logo_url){['logoSidebar','logoLogin','logoDash'].forEach(i=>{const el=$id(i); if(el) el.src=data.logo_url;});} } }
  document.querySelectorAll('[data-close-modal]').forEach(b=>b.addEventListener('click',()=>closeModal(b.dataset.closeModal)));
  document.querySelectorAll('.nav button').forEach(btn=>{ btn.addEventListener('click',()=>{ document.querySelectorAll('.nav button').forEach(b=>b.classList.remove('active')); btn.classList.add('active'); document.querySelectorAll('.page').forEach(p=>p.classList.remove('active')); const pg=$id('page-'+btn.dataset.page); if(pg) pg.classList.add('active'); $id('sidebar')?.classList.remove('open'); $id('overlay')?.classList.remove('show'); if(btn.dataset.page==='clientes') carregarAniversariantes(); if(btn.dataset.page==='dashboard') carregarDashboard(); }); });
  $id('btnHamburger')?.addEventListener('click',()=>{$id('sidebar').classList.toggle('open'); $id('overlay').classList.toggle('show');});
  $id('overlay')?.addEventListener('click',()=>{$id('sidebar').classList.remove('open'); $id('overlay').classList.remove('show');});
  $id('btnAdminLogin')?.addEventListener('click',loginAdmin);
  $id('adminPass')?.addEventListener('keydown',e=>{if(e.key==='Enter') loginAdmin();});
  $id('btnLogoutAdmin')?.addEventListener('click',()=>{localStorage.removeItem('dnh_admin'); location.reload();});
  const saved=localStorage.getItem('dnh_admin'); if(saved){ try{currentAdmin=JSON.parse(saved);}catch(e){} }
  if(currentAdmin){ mostrarApp(); } else { $id('authAdmin').classList.add('ready'); $id('appLoader')?.classList.add('hidden'); }
  bindEvents();
});
async function loginAdmin(){
  const email=$id('adminEmail').value.trim(), pass=$id('adminPass').value;
  if(!email||!pass) return toast('Preencha e-mail e senha');
  if(!sb) return toast('Erro Supabase - confira config.js');
  const {data,error}=await sb.auth.signInWithPassword({email,password:pass});
  if(error) return toast('Login inválido: '+error.message);
  currentAdmin={email,id:data.user.id}; localStorage.setItem('dnh_admin',JSON.stringify(currentAdmin));
  if($id('adminEmailDisplay')) $id('adminEmailDisplay').textContent=email;
  mostrarApp();
}
function mostrarApp(){ $id('authAdmin').style.display='none'; $id('appAdmin').classList.remove('hidden'); $id('appLoader')?.classList.add('hidden'); if(currentAdmin&&$id('adminEmailDisplay')) $id('adminEmailDisplay').textContent=currentAdmin.email; carregarTudo(); }
async function carregarTudo(){ await carregarDashboard(); await carregarAgendaAdmin(); await carregarServicos(); await carregarEstoque(); await carregarFuncionarios(); await carregarFinanceiro(); await carregarSettings(); await carregarAniversariantes(); await carregarCatalogoSelects(); }
function bindEvents(){
  $id('btnFiltrarAgenda')?.addEventListener('click',filtrarDashboard);
  $id('btnAgendarCliente')?.addEventListener('click',agendarCliente);
  $id('btnAddServico')?.addEventListener('click',addServico);
  $id('btnSaveEditServ')?.addEventListener('click',salvarEditServ);
  $id('btnAddCatalog')?.addEventListener('click',addCatalog);
  $id('btnAddEntrada')?.addEventListener('click',addEntrada);
  $id('btnRetirar')?.addEventListener('click',retirarEstoque);
  $id('btnToggleEstoque')?.addEventListener('click',()=>{estoqueVisible=!estoqueVisible; if($id('listaEstoque')) $id('listaEstoque').style.display=estoqueVisible?'block':'none';});
  $id('btnFiltrarEst')?.addEventListener('click',carregarMovimentos);
  $id('btnLimparEst')?.addEventListener('click',()=>{if($id('estFiltroInicio'))$id('estFiltroInicio').value=''; if($id('estFiltroFim'))$id('estFiltroFim').value=''; carregarMovimentos();});
  $id('btnSaveEditEst')?.addEventListener('click',salvarEditEst);
  $id('btnSaveEditMov')?.addEventListener('click',salvarEditMov);
  $id('btnAddFunc')?.addEventListener('click',addFunc);
  $id('btnSaveEditFunc')?.addEventListener('click',salvarEditFunc);
  $id('comPeriodo')?.addEventListener('change',e=>{if($id('comCustomBox'))$id('comCustomBox').style.display=e.target.value==='custom'?'grid':'none'; if(e.target.value!=='custom') calcularComissao();});
  $id('btnCalcularCom')?.addEventListener('click',calcularComissao);
  $id('btnPagarComissao')?.addEventListener('click',pagarComissao);
  $id('btnLancarManualTop')?.addEventListener('click',()=> $id('formLancarManual')?.classList.toggle('hidden'));
  $id('btnAddFinanceiro')?.addEventListener('click',addFinanceiro);
  $id('btnFiltrarFin')?.addEventListener('click',carregarFinanceiro);
  $id('btnToggleFin')?.addEventListener('click',()=>{finVisible=!finVisible; $id('listaFinanceiro')?.classList.toggle('hidden',!finVisible);});
  $id('btnLimparFin')?.addEventListener('click',()=>{if($id('finInicio'))$id('finInicio').value=''; if($id('finFim'))$id('finFim').value=''; carregarFinanceiro();});
  $id('btnGraficoFin')?.addEventListener('click',()=>{$id('graficoWrap')?.classList.toggle('hidden'); desenharGrafico();});
  $id('saveSettings')?.addEventListener('click',salvarSettings);
  $id('btnSaveEditBook')?.addEventListener('click',salvarEditBook);
  $id('agData')?.addEventListener('change',carregarHorarios);
  $id('agFuncionario')?.addEventListener('change',carregarHorarios);
  $id('agServico')?.addEventListener('change',carregarHorarios);
  $id('retiradaProduto')?.addEventListener('change',atualizarRetiradaInfo);
  $id('buscaCliente')?.addEventListener('input',carregarAniversariantes);
  const hoje=new Date().toISOString().slice(0,10);
  if($id('agData')) $id('agData').value=hoje;
  if($id('estEntradaData')) $id('estEntradaData').value=hoje;
  if($id('retiradaData')) $id('retiradaData').value=hoje;
  if($id('finData')) $id('finData').value=hoje;
}
// ===== DASHBOARD =====
async function carregarDashboard(){
  if(!sb) return;
  const hoje=new Date().toISOString().slice(0,10);
  if($id('dashDate')) $id('dashDate').textContent=new Date().toLocaleDateString('pt-BR');
  const {data:bookings=[]}=await sb.from('bookings').select('*, services(name,price)').eq('slug',currentSlug).eq('date',hoje);
  const pagos=bookings.filter(b=>b.status==='paid'||b.payment_status==='paid');
  const receita=pagos.reduce((s,b)=>s+Number(b.price||b.services?.price||0),0);
  if($id('dashHoje')) $id('dashHoje').textContent=bookings.length;
  if($id('dashClientes')) $id('dashClientes').textContent=new Set(bookings.map(b=>b.phone)).size;
  if($id('dashReceita')) $id('dashReceita').textContent=fmtMoney(receita);
  if($id('dashTicket')) $id('dashTicket').textContent=fmtMoney(bookings.length?receita/bookings.length:0);
  if($id('todayAgenda')) $id('todayAgenda').innerHTML=bookings.map(b=>`<div class="list-row"><div><b>${b.time||''} - ${b.customer_name||b.name||''}</b><br><small>${b.services?.name||''} - ${b.employee_name||b.professional_name||''}</small></div><span>${b.status||''}</span></div>`).join('')||'Nenhum atendimento hoje';
  const {data:estoque=[]}=await sb.from('inventory').select('*').eq('slug',currentSlug);
  const baixo=estoque.filter(e=>Number(e.quantity||e.current_quantity||0)<=Number(e.min_quantity||e.min_stock||5));
  if($id('dashEstoque')) $id('dashEstoque').innerHTML=baixo.map(e=>`<div>⚠️ ${e.name||e.product_name} - ${e.quantity||e.current_quantity} restantes</div>`).join('')||'Estoque OK ✅';
  carregarAniversariantes();
}
async function filtrarDashboard(){
  const ini=$id('filtroInicio')?.value, fim=$id('filtroFim')?.value;
  if(!ini||!fim) return toast('Escolha início e fim');
  const {data:fil=[], error}=await sb.from('bookings').select('*').eq('slug',currentSlug).gte('date',ini).lte('date',fim);
  if(error) return toast(error.message);
  const rec=fil.filter(b=>b.status==='paid').reduce((s,b)=>s+Number(b.price||0),0);
  if($id('filtroResultado')) $id('filtroResultado').innerHTML=`<b>${fil.length}</b> atendimentos • Receita: <b>${fmtMoney(rec)}</b> • ${ini} até ${fim}`;
}
// ===== AGENDA =====
async function carregarAgendaAdmin(){
  if(!sb) return;
  const {data:funcs=[]}=await sb.from('professionals').select('*').eq('slug',currentSlug);
  cacheFuncionarios=funcs;
  const {data:servs=[]}=await sb.from('services').select('*').eq('slug',currentSlug);
  cacheServicos=servs;
  if($id('agFuncionario')) $id('agFuncionario').innerHTML=funcs.map(f=>`<option value="${f.id}">${f.name}</option>`).join('')||'<option value="">Cadastre um barbeiro em Funcionários</option>';
  if($id('agServico')) $id('agServico').innerHTML=servs.map(s=>`<option value="${s.id}">${s.name} - ${fmtMoney(s.price)}</option>`).join('')||'<option value="">Cadastre um serviço</option>';
  if($id('editBookFunc')) $id('editBookFunc').innerHTML=funcs.map(f=>`<option value="${f.id}">${f.name}</option>`).join('');
  if($id('editBookServ')) $id('editBookServ').innerHTML=servs.map(s=>`<option value="${s.id}">${s.name}</option>`).join('');
  await carregarHorarios();
  const {data:bookings=[]}=await sb.from('bookings').select('*, services(name)').eq('slug',currentSlug).order('date',{ascending:false}).limit(50);
  if($id('adminAgendaList')){
    $id('adminAgendaList').innerHTML=bookings.map(b=>`<div class="list-row"><div><b>${b.date} ${b.time||''} - ${b.customer_name||b.name}</b><br><small>${b.services?.name||''} • ${b.phone||''} • ${b.status||''}</small></div><div style="display:flex;gap:6px;flex-wrap:wrap"><button class="btn small" data-pago="${b.id}">✅ Pago</button><button class="btn small" data-edit-book="${b.id}">✏️</button><button class="btn small danger" data-del-book="${b.id}">🗑️</button></div></div>`).join('')||'Sem agendamentos';
    $id('adminAgendaList').querySelectorAll('[data-pago]').forEach(b=>b.addEventListener('click',()=>marcarPago(b.dataset.pago)));
    $id('adminAgendaList').querySelectorAll('[data-edit-book]').forEach(b=>b.addEventListener('click',()=>editarBooking(b.dataset.editBook)));
    $id('adminAgendaList').querySelectorAll('[data-del-book]').forEach(b=>b.addEventListener('click',()=>excluirBooking(b.dataset.delBook)));
  }
}
async function carregarHorarios(){
  if(!sb) return;
  const data=$id('agData')?.value, funcId=$id('agFuncionario')?.value;
  if(!data) return;
  let ocupados=new Set();
  if(funcId){ const {data:bk=[]}=await sb.from('bookings').select('time').eq('slug',currentSlug).eq('date',data).eq('professional_id',funcId).neq('status','cancelled'); if(bk.length===0){ const r2=await sb.from('bookings').select('time').eq('slug',currentSlug).eq('date',data).eq('employee_id',funcId).neq('status','cancelled'); ocupados=new Set((r2.data||[]).map(b=>b.time)); } else ocupados=new Set(bk.map(b=>b.time)); }
  const horarios=[]; let start=8*60, end=18*60, interval=Number(currentShop?.interval_minutes||30);
  if(currentShop?.start_time) start=parseInt(currentShop.start_time.split(':')[0])*60+parseInt(currentShop.start_time.split(':')[1]||0);
  if(currentShop?.end_time) end=parseInt(currentShop.end_time.split(':')[0])*60+parseInt(currentShop.end_time.split(':')[1]||0);
  for(let m=start;m<end;m+=interval){ horarios.push(String(Math.floor(m/60)).padStart(2,'0')+':'+String(m%60).padStart(2,'0'); }
  if($id('agHoraGrid')){
    $id('agHoraGrid').innerHTML=horarios.map(h=>{ const occ=ocupados.has(h); return `<button type="button" ${occ?'disabled':''} data-hora="${h}" style="padding:10px;border-radius:8px;border:1px solid var(--border);background:${occ?'#2a1515':'#0a0e1a'};color:${occ?'#666':'#fff'};cursor:${occ?'not-allowed':'pointer'};${selectedHora===h?'background:var(--gold);color:#000;':''}">${h}</button>`; }).join('');
    $id('agHoraGrid').querySelectorAll('[data-hora]').forEach(b=>b.addEventListener('click',()=>{ selectedHora=b.dataset.hora; $id('agHoraGrid').querySelectorAll('button').forEach(x=>{x.style.background='#0a0e1a'; x.style.color='#fff';}); b.style.background='var(--gold)'; b.style.color='#000'; }));
  }
}
async function agendarCliente(){
  const date=$id('agData').value, professional_id=$id('agFuncionario').value, service_id=$id('agServico').value;
  const name=$id('agClienteNome').value.trim(), phone=$id('agClientePhone').value.trim(), obs=$id('agObs').value.trim();
  if(!date||!service_id||!name||!phone||!selectedHora) return toast('Preencha tudo e escolha horário');
  const serv=cacheServicos.find(s=>String(s.id)===String(service_id))||{};
  const func=cacheFuncionarios.find(f=>String(f.id)===String(professional_id))||{};
  const {error}=await sb.from('bookings').insert([{slug:currentSlug,date,time:selectedHora,professional_id:professional_id||null,employee_name:func?.name||'',professional_name:func?.name||'',service_id,customer_name:name,name,phone,obs,notes:obs,price:serv?.price||0,status:'pending'}]);
  if(error) return toast('Erro: '+error.message);
  try{ await sb.from('customers').upsert({slug:currentSlug,name,phone},{onConflict:'slug,phone'}); }catch(e){}
  toast('Agendado! ✅'); selectedHora=''; $id('agClienteNome').value=''; $id('agClientePhone').value=''; $id('agObs').value='';
  carregarDashboard(); carregarAgendaAdmin();
}
async function marcarPago(id){ await sb.from('bookings').update({status:'paid',payment_status:'paid'}).eq('id',id); toast('Marcado como pago ✅'); carregarDashboard(); carregarAgendaAdmin(); carregarFinanceiro(); }
async function excluirBooking(id){ if(!confirm('Excluir agendamento?')) return; await sb.from('bookings').delete().eq('id',id); carregarDashboard(); carregarAgendaAdmin(); }
async function editarBooking(id){ editingBookId=id; const {data:b}=await sb.from('bookings').select('*').eq('id',id).single(); if(!b) return; $id('editBookData').value=b.date; $id('editBookHora').value=b.time; $id('editBookCliente').value=b.customer_name||b.name||''; $id('editBookPhone').value=b.phone||''; $id('editBookObs').value=b.obs||b.notes||''; $id('editBookFunc').value=b.professional_id||b.employee_id||''; $id('editBookServ').value=b.service_id||''; openModal('editBookingModal'); }
async function salvarEditBook(){ const {error}=await sb.from('bookings').update({date:$id('editBookData').value,time:$id('editBookHora').value,customer_name:$id('editBookCliente').value,name:$id('editBookCliente').value,phone:$id('editBookPhone').value,obs:$id('editBookObs').value,professional_id:$id('editBookFunc').value,employee_id:$id('editBookFunc').value,service_id:$id('editBookServ').value}).eq('id',editingBookId); if(error) return toast(error.message); closeModal('editBookingModal'); toast('Salvo ✅'); carregarAgendaAdmin(); carregarDashboard(); }
// ===== SERVIÇOS - CRUD =====
async function carregarServicos(){
  if(!sb) return;
  const {data=[],error}=await sb.from('services').select('*').eq('slug',currentSlug).order('name');
  if(error) return toast(error.message);
  cacheServicos=data;
  if($id('listaServicos')){
    $id('listaServicos').innerHTML=data.map(s=>`<div class="list-row"><div><b>${s.name}</b><br><small>${fmtMoney(s.price)} • ${s.duration||s.duration_minutes||30} min</small></div><div style="display:flex;gap:6px"><button class="btn small" data-edit-serv="${s.id}">✏️ Editar</button><button class="btn small danger" data-del-serv="${s.id}">🗑️ Excluir</button></div></div>`).join('')||'Sem serviços';
    $id('listaServicos').querySelectorAll('[data-edit-serv]').forEach(b=>b.addEventListener('click',()=>{ const s=data.find(x=>String(x.id)===b.dataset.editServ); if(s){ editingServId=s.id; $id('editServNome').value=s.name; $id('editServPreco').value=s.price; $id('editServDuracao').value=s.duration||s.duration_minutes||30; openModal('editServModal'); } }));
    $id('listaServicos').querySelectorAll('[data-del-serv]').forEach(b=>b.addEventListener('click',()=>excluirServ(b.dataset.delServ)));
  }
}
async function addServico(){
  const name=$id('servNome').value.trim(); const price=parseFloat($id('servPreco').value); const dur=parseInt($id('servDuracao').value)||30;
  if(!name||!price) return toast('Preencha nome e preço');
  const {error}=await sb.from('services').insert([{slug:currentSlug,name,price,duration:dur,duration_minutes:dur}]);
  if(error) return toast('Erro ao salvar: '+error.message);
  toast('Serviço adicionado ✅'); $id('servNome').value=''; $id('servPreco').value=''; carregarServicos(); carregarAgendaAdmin();
}
async function salvarEditServ(){ const {error}=await sb.from('services').update({name:$id('editServNome').value,price:parseFloat($id('editServPreco').value),duration:parseInt($id('editServDuracao').value),duration_minutes:parseInt($id('editServDuracao').value)}).eq('id',editingServId); if(error) return toast(error.message); closeModal('editServModal'); toast('Salvo ✅'); carregarServicos(); }
async function excluirServ(id){ if(!confirm('Excluir serviço?')) return; const {error}=await sb.from('services').delete().eq('id',id); if(error) return toast(error.message); toast('Excluído ✅'); carregarServicos(); }
// ===== ESTOQUE - product_catalog + inventory + inventory_movements =====
async function carregarCatalogoSelects(){
  if(!sb) return;
  const {data=[],error}=await sb.from('product_catalog').select('*').eq('slug',currentSlug).order('name');
  if(error){ console.log(error); return toast('Catálogo: '+error.message); }
  const opts=data.map(c=>`<option value="${c.name}">${c.name}</option>`).join('');
  if($id('estEntradaProduto')) $id('estEntradaProduto').innerHTML=opts||'<option value="">Cadastre um produto no catálogo</option>';
  if($id('retiradaProduto')) $id('retiradaProduto').innerHTML=opts||'<option value="">Cadastre um produto</option>';
  if($id('estFiltroProduto')) $id('estFiltroProduto').innerHTML='<option value="">Todos produtos</option>'+opts;
}
async function addCatalog(){
  const name=$id('newCatalogName').value.trim().toLowerCase();
  if(!name) return toast('Digite o nome');
  const {error}=await sb.from('product_catalog').insert([{slug:currentSlug,name}]);
  if(error) return toast('Erro catálogo: '+error.message);
  $id('newCatalogName').value=''; toast('Salvo no catálogo ✅'); carregarCatalogoSelects();
}
async function carregarEstoque(){
  if(!sb) return;
  const {data=[],error}=await sb.from('inventory').select('*').eq('slug',currentSlug).order('name');
  if(error) return toast('Estoque: '+error.message);
  if($id('listaEstoque')){
    $id('listaEstoque').innerHTML=data.map(e=>{ const qtd=e.quantity ?? e.current_quantity ?? 0; const min=e.min_quantity ?? e.min_stock ?? 5; const custo=e.cost ?? e.unit_cost ?? 0; return `<div class="list-row ${Number(qtd)<=Number(min)?'estoque-alerta':''}"><div><b>${e.name||e.product_name}</b><br><small>Qtd: ${qtd} • Mín: ${min} • Custo: ${fmtMoney(custo)}</small></div><button class="btn small" data-edit-est="${e.id}">✏️ Editar</button></div>`; }).join('')||'Estoque vazio';
    $id('listaEstoque').querySelectorAll('[data-edit-est]').forEach(b=>b.addEventListener('click',()=>{ const e=data.find(x=>String(x.id)===b.dataset.editEst); if(e){ editingEstId=e.id; $id('editEstNome').value=e.name||e.product_name; $id('editEstQtd').value=e.quantity??e.current_quantity??0; $id('editEstMin').value=e.min_quantity??e.min_stock??5; $id('editEstCusto').value=e.cost??e.unit_cost??0; $id('editEstCat').value=e.category||''; openModal('editEstModal'); } }));
  }
  carregarMovimentos();
}
async function addEntrada(){
  const produto=$id('estEntradaProduto').value; const qtd=parseFloat($id('estEntradaQtd').value); const custo=parseFloat($id('estEntradaCusto').value)||0; const dataCompra=$id('estEntradaData').value; const forn=$id('estEntradaForn').value;
  if(!produto||!qtd||!dataCompra) return toast('Preencha produto, qtd e data');
  const {data:atual}=await sb.from('inventory').select('*').eq('slug',currentSlug).eq('name',produto).single();
  if(atual){ const novaQtd=Number(atual.quantity??atual.current_quantity??0)+qtd; const {error}=await sb.from('inventory').update({quantity:novaQtd,current_quantity:novaQtd,cost:custo||atual.cost,unit_cost:custo||atual.unit_cost}).eq('id',atual.id); if(error) return toast(error.message); }
  else { const {error}=await sb.from('inventory').insert([{slug:currentSlug,name:produto,product_name:produto,quantity:qtd,current_quantity:qtd,min_quantity:5,min_stock:5,cost:custo,unit_cost:custo,category:''}]); if(error) return toast(error.message); }
  await sb.from('inventory_movements').insert([{slug:currentSlug,product:produto,product_name:produto,type:'entrada',quantity:qtd,cost:custo,unit_cost:custo,date:dataCompra,supplier:forn,obs:forn}]);
  toast('Compra registrada ✅'); carregarEstoque(); $id('estEntradaQtd').value='';
}
async function atualizarRetiradaInfo(){ const prod=$id('retiradaProduto').value; const {data}=await sb.from('inventory').select('*').eq('slug',currentSlug).eq('name',prod).single(); if($id('retiradaInfo')) $id('retiradaInfo').textContent=data?`Saldo atual: ${data.quantity??data.current_quantity}`:''; }
async function retirarEstoque(){
  const produto=$id('retiradaProduto').value; const qtd=parseFloat($id('retiradaQtd').value); const dataUso=$id('retiradaData').value; const motivo=$id('retiradaMotivo').value;
  if(!produto||!qtd||!dataUso) return toast('Preencha tudo');
  const {data:atual}=await sb.from('inventory').select('*').eq('slug',currentSlug).eq('name',produto).single();
  if(!atual) return toast('Produto sem saldo');
  const saldo=Number(atual.quantity??atual.current_quantity??0);
  if(saldo<qtd) return toast('Saldo insuficiente');
  const novaQtd=saldo-qtd;
  await sb.from('inventory').update({quantity:novaQtd,current_quantity:novaQtd}).eq('id',atual.id);
  await sb.from('inventory_movements').insert([{slug:currentSlug,product:produto,product_name:produto,type:'saida',quantity:qtd,date:dataUso,reason:motivo,motivo,obs:motivo}]);
  toast('Saída registrada ✅'); carregarEstoque(); $id('retiradaQtd').value='';
}
async function salvarEditEst(){ const {error}=await sb.from('inventory').update({quantity:parseFloat($id('editEstQtd').value),current_quantity:parseFloat($id('editEstQtd').value),min_quantity:parseFloat($id('editEstMin').value),min_stock:parseFloat($id('editEstMin').value),cost:parseFloat($id('editEstCusto').value),unit_cost:parseFloat($id('editEstCusto').value),category:$id('editEstCat').value}).eq('id',editingEstId); if(error) return toast(error.message); closeModal('editEstModal'); toast('Salvo ✅'); carregarEstoque(); }
async function carregarMovimentos(){
  if(!sb) return;
  let q=sb.from('inventory_movements').select('*').eq('slug',currentSlug).order('date',{ascending:false}).limit(100);
  const ini=$id('estFiltroInicio')?.value, fim=$id('estFiltroFim')?.value, prod=$id('estFiltroProduto')?.value;
  if(ini) q=q.gte('date',ini); if(fim) q=q.lte('date',fim); if(prod) q=q.eq('product',prod);
  const {data=[]}=await q;
  if($id('listaMovimentos')){ $id('listaMovimentos').innerHTML=data.map(m=>`<div class="list-row"><div><b>${m.type==='entrada'?'🟢':'🔴'} ${m.product||m.product_name} - ${m.quantity}</b><br><small>${m.date} • ${m.supplier||m.reason||m.obs||''}</small></div><button class="btn small" data-edit-mov="${m.id}">✏️</button></div>`).join('')||'Sem movimentos';
    $id('listaMovimentos').querySelectorAll('[data-edit-mov]').forEach(b=>b.addEventListener('click',()=>{ const m=data.find(x=>String(x.id)===b.dataset.editMov); if(m){ editingMovId=m.id; $id('editMovProduto').value=m.product||m.product_name; $id('editMovTipo').value=m.type; $id('editMovQtd').value=m.quantity; $id('editMovData').value=m.date; $id('editMovCusto').value=m.cost||0; $id('editMovObs').value=m.supplier||m.reason||''; openModal('editMovModal'); } }));
  }
}
async function salvarEditMov(){ const {error}=await sb.from('inventory_movements').update({type:$id('editMovTipo').value,quantity:parseFloat($id('editMovQtd').value),date:$id('editMovData').value,cost:parseFloat($id('editMovCusto').value),supplier:$id('editMovObs').value,obs:$id('editMovObs').value}).eq('id',editingMovId); if(error) return toast(error.message); closeModal('editMovModal'); toast('Movimentação atualizada ✅'); carregarEstoque(); }
// ===== FUNCIONÁRIOS - professionals =====
async function carregarFuncionarios(){
  if(!sb) return;
  const {data=[],error}=await sb.from('professionals').select('*').eq('slug',currentSlug).order('name');
  if(error) return toast('Funcionários: '+error.message);
  cacheFuncionarios=data;
  if($id('listaFuncionarios')){
    $id('listaFuncionarios').innerHTML=data.map(f=>`<div class="list-row"><div><b>${f.name}</b><br><small>${f.phone||''} • ${f.role||f.funcao||'barbeiro'} • ${f.commission_percent||f.commission||50}${f.commission_type==='fixed'?' R$ fixo':'%'}</small></div><div style="display:flex;gap:6px"><button class="btn small" data-edit-func="${f.id}">✏️ Editar</button><button class="btn small danger" data-del-func="${f.id}">🗑️ Excluir</button></div></div>`).join('')||'Sem funcionários';
    $id('listaFuncionarios').querySelectorAll('[data-edit-func]').forEach(b=>b.addEventListener('click',()=>{ const f=data.find(x=>String(x.id)===b.dataset.editFunc); if(f){ editingFuncId=f.id; $id('editFuncNome').value=f.name; $id('editFuncPhone').value=f.phone||''; $id('editFuncFuncao').value=f.role||f.funcao||'barbeiro'; $id('editFuncInicio').value=f.start_time||'08:00'; $id('editFuncFim').value=f.end_time||'18:00'; $id('editFuncComissao').value=f.commission_percent||f.commission||50; $id('editFuncComissaoTipo').value=f.commission_type||'percent'; $id('editFuncEmail').value=f.email||''; openModal('editFuncModal'); } }));
    $id('listaFuncionarios').querySelectorAll('[data-del-func]').forEach(b=>b.addEventListener('click',()=>excluirFunc(b.dataset.delFunc)));
  }
  if($id('comBarbeiro')) $id('comBarbeiro').innerHTML=data.map(f=>`<option value="${f.id}">${f.name}</option>`).join('')||'<option value="">Sem barbeiros - cadastre em Funcionários</option>';
}
async function addFunc(){
  const name=$id('funcNome').value.trim(), phone=$id('funcPhone').value.trim();
  if(!name||!phone) return toast('Preencha nome e telefone');
  const {error}=await sb.from('professionals').insert([{slug:currentSlug,name,phone,role:$id('funcFuncao').value,funcao:$id('funcFuncao').value,start_time:$id('funcInicio').value,end_time:$id('funcFim').value,email:$id('funcEmail').value,commission_percent:parseFloat($id('funcComissao').value)||50,commission:parseFloat($id('funcComissao').value)||50,commission_type:$id('funcComissaoTipo').value}]);
  if(error) return toast('Erro ao cadastrar: '+error.message);
  toast('Funcionário cadastrado ✅'); $id('funcNome').value=''; $id('funcPhone').value=''; carregarFuncionarios(); carregarAgendaAdmin();
}
async function salvarEditFunc(){ const {error}=await sb.from('professionals').update({name:$id('editFuncNome').value,phone:$id('editFuncPhone').value,role:$id('editFuncFuncao').value,start_time:$id('editFuncInicio').value,end_time:$id('editFuncFim').value,commission_percent:parseFloat($id('editFuncComissao').value),commission:parseFloat($id('editFuncComissao').value),commission_type:$id('editFuncComissaoTipo').value,email:$id('editFuncEmail').value}).eq('id',editingFuncId); if(error) return toast(error.message); closeModal('editFuncModal'); toast('Salvo ✅'); carregarFuncionarios(); }
async function excluirFunc(id){ if(!confirm('Excluir funcionário?')) return; const {error}=await sb.from('professionals').delete().eq('id',id); if(error) return toast(error.message); toast('Excluído ✅'); carregarFuncionarios(); }
// ===== COMISSÕES - professional_payments =====
function getPeriodo(){ const p=$id('comPeriodo').value; const hoje=new Date(); if(p==='hoje') return {ini:hoje.toISOString().slice(0,10),fim:hoje.toISOString().slice(0,10)}; if(p==='semana'){const d=new Date(hoje); d.setDate(hoje.getDate()-7); return {ini:d.toISOString().slice(0,10),fim:hoje.toISOString().slice(0,10)};} if(p==='quinzena'){const d=new Date(hoje); d.setDate(hoje.getDate()-15); return {ini:d.toISOString().slice(0,10),fim:hoje.toISOString().slice(0,10)};} if(p==='mes') return {ini:hoje.toISOString().slice(0,7)+'-01',fim:hoje.toISOString().slice(0,10)}; return {ini:$id('comInicio').value,fim:$id('comFim').value}; }
let comissaoAtual=null;
async function calcularComissao(){
  if(!sb) return; const barbeiroId=$id('comBarbeiro').value; const {ini,fim}=getPeriodo(); if(!barbeiroId||!ini||!fim) return toast('Escolha barbeiro e período');
  const func=cacheFuncionarios.find(f=>String(f.id)===String(barbeiroId))||{};
  const {data:books=[]}=await sb.from('bookings').select('*, services(price)').eq('slug',currentSlug).gte('date',ini).lte('date',fim).eq('status','paid');
  const filtrados=books.filter(b=>String(b.professional_id)===String(barbeiroId)||String(b.employee_id)===String(barbeiroId));
  const total=filtrados.reduce((s,b)=>s+Number(b.price||b.services?.price||0),0);
  let comissao=0; if(func?.commission_type==='fixed') comissao=filtrados.length*Number(func.commission_percent||func.commission||0); else comissao=total*(Number(func?.commission_percent||func?.commission||50)/100);
  comissaoAtual={professional_id:barbeiroId,employee_name:func?.name,professional_name:func?.name,ini,fim,total,comissao,qtd:filtrados.length};
  if($id('comResumo')) $id('comResumo').innerHTML=`<div class="grid-3"><div class="metric-card"><small>ATENDIMENTOS</small><b>${filtrados.length}</b></div><div class="metric-card"><small>FATURAMENTO</small><b>${fmtMoney(total)}</b></div><div class="metric-card"><small>COMISSÃO</small><b style="color:var(--gold)">${fmtMoney(comissao)}</b></div></div>`;
  if($id('listaComissoes')) $id('listaComissoes').innerHTML=filtrados.map(b=>`<div class="list-row"><div><b>${b.date} ${b.time||''} - ${b.customer_name||b.name}</b><br><small>${fmtMoney(b.price||0)}</small></div></div>`).join('')||'Sem atendimentos pagos no período';
  if($id('btnPagarComissao')) $id('btnPagarComissao').style.display='block';
  carregarPagamentos();
}
async function pagarComissao(){ if(!comissaoAtual) return; const {error}=await sb.from('professional_payments').insert([{slug:currentSlug,professional_id:comissaoAtual.professional_id,employee_id:comissaoAtual.employee_id,employee_name:comissaoAtual.employee_name,professional_name:comissaoAtual.employee_name,start_date:comissaoAtual.ini,end_date:comissaoAtual.fim,total:comissaoAtual.total,commission:comissaoAtual.comissao,amount:comissaoAtual.comissao,paid_at:new Date().toISOString()}]); if(error) return toast(error.message); toast('Comissão marcada como paga ✅'); carregarPagamentos(); }
async function carregarPagamentos(){ const {data=[]}=await sb.from('professional_payments').select('*').eq('slug',currentSlug).order('paid_at',{ascending:false}).limit(20); if($id('listaPagamentos')) $id('listaPagamentos').innerHTML=data.map(p=>`<div class="list-row"><div><b>${p.professional_name||p.employee_name} - ${fmtMoney(p.commission||p.amount)}</b><br><small>${p.start_date} até ${p.end_date}</small></div></div>`).join('')||'Nenhum pagamento ainda'; }
// ===== FINANCEIRO - cash_entries - SEM coluna desc =====
async function carregarFinanceiro(){
  if(!sb) return; let q=sb.from('cash_entries').select('*').eq('slug',currentSlug).order('date',{ascending:false}).limit(100); const ini=$id('finInicio')?.value, fim=$id('finFim')?.value; if(ini) q=q.gte('date',ini); if(fim) q=q.lte('date',fim);
  const {data=[],error}=await q; if(error) return toast('Financeiro: '+error.message);
  const ent=data.filter(f=>f.type==='income').reduce((s,f)=>s+Number(f.amount||f.value||0),0); const sai=data.filter(f=>f.type==='expense').reduce((s,f)=>s+Number(f.amount||f.value||0),0);
  if($id('finResumo')) $id('finResumo').innerHTML=`<div class="metric-card"><small>ENTRADAS</small><b style="color:#4ade80">${fmtMoney(ent)}</b></div><div class="metric-card"><small>SAÍDAS</small><b style="color:#f87171">${fmtMoney(sai)}</b></div><div class="metric-card"><small>LUCRO</small><b style="color:var(--gold)">${fmtMoney(ent-sai)}</b></div>`;
  if($id('listaFinanceiro')){ $id('listaFinanceiro').innerHTML=data.map(f=>`<div class="list-row"><div><b>${f.type==='income'?'🟢':'🔴'} ${f.description||f.category} - ${fmtMoney(f.amount||f.value)}</b><br><small>${f.date} • ${f.category||''} • ${f.payment_method||f.form||''}</small></div><button class="btn small danger" data-del-fin="${f.id}">🗑️</button></div>`).join('')||'Sem lançamentos'; $id('listaFinanceiro').querySelectorAll('[data-del-fin]').forEach(b=>b.addEventListener('click',()=>excluirFin(b.dataset.delFin))); }
  window._finData=data;
}
async function addFinanceiro(){ const valor=parseFloat($id('finValor').value); const data=$id('finData').value||new Date().toISOString().slice(0,10); if(!valor) return toast('Preencha valor'); const {error}=await sb.from('cash_entries').insert([{slug:currentSlug,type:$id('finTipo').value,amount:valor,value:valor,date:data,category:$id('finCategoria').value,payment_method:$id('finForma').value,form:$id('finForma').value,description:$id('finDesc').value}]); if(error) return toast(error.message); toast('Lançado ✅'); $id('formLancarManual')?.classList.add('hidden'); carregarFinanceiro(); }
async function excluirFin(id){ if(!confirm('Excluir lançamento?')) return; await sb.from('cash_entries').delete().eq('id',id); carregarFinanceiro(); }
function desenharGrafico(){ const canvas=$id('finChart'); if(!canvas) return; const ctx=canvas.getContext('2d'); const data=window._finData||[]; ctx.clearRect(0,0,canvas.width,canvas.height); const porDia={}; data.forEach(f=>{ porDia[f.date]=(porDia[f.date]||0)+(f.type==='income'?Number(f.amount||0):-Number(f.amount||0)); }); const dias=Object.keys(porDia).sort().slice(-15); const max=Math.max(1,...dias.map(d=>Math.abs(porDia[d]))); ctx.font='12px Inter'; dias.forEach((d,i)=>{ const h=Math.abs(porDia[d])/max*200; const x=20+i*50; const y=280-h; ctx.fillStyle=porDia[d]>=0?'#4ade80':'#f87171'; ctx.fillRect(x,y,30,h); ctx.fillStyle='#fff'; ctx.fillText(d.slice(5),x,300); }); if($id('graficoLegenda')) $id('graficoLegenda').textContent='Verde = lucro do dia, Vermelho = prejuízo'; }
// ===== SETTINGS =====
async function carregarSettings(){
  const diasNomes=['Dom','Seg','Ter','Qua','Qui','Sex','Sáb'];
  const abertos=currentShop?.working_days || [0,1,2,3,4,5,6];
  if($id('weeklyBox')) $id('weeklyBox').innerHTML=`<label style="font-size:10px;color:var(--text)">DIAS DE FUNCIONAMENTO</label><div style="margin-top:8px;display:flex;gap:10px;flex-wrap:wrap">${diasNomes.map((d,i)=>`<label style="display:flex;gap:6px;align-items:center"><input type="checkbox" class="dia-semana" value="${i}" ${abertos.includes(i)?'checked':''}> ${d}</label>`).join('')}</div>`;
  if(!currentShop) return;
  if($id('setName')) $id('setName').value=currentShop.name||'';
  if($id('setWhatsapp')) $id('setWhatsapp').value=currentShop.whatsapp||currentShop.phone||'';
  if($id('setLogoUrl')) $id('setLogoUrl').value=currentShop.logo_url||'';
  if($id('setStart')) $id('setStart').value=currentShop.start_time||'08:00';
  if($id('setEnd')) $id('setEnd').value=currentShop.end_time||'18:00';
  if($id('setInterval')) $id('setInterval').value=currentShop.interval_minutes||30;
  if($id('setLunchStart')) $id('setLunchStart').value=currentShop.lunch_start||'12:00';
  if($id('setLunchEnd')) $id('setLunchEnd').value=currentShop.lunch_end||'13:00';
  if($id('logoPreview')&&currentShop.logo_url){ $id('logoPreview').src=currentShop.logo_url; $id('logoPreview').style.display='block'; }
}
async function salvarSettings(){
  const dias=Array.from(document.querySelectorAll('.dia-semana:checked')).map(c=>parseInt(c.value));
  let logoUrl=$id('setLogoUrl').value;
  const file=$id('setLogoFile').files[0];
  if(file && sb){
    try{
      const path=`${currentSlug}/${Date.now()}_${file.name}`;
      const {error:upErr}=await sb.storage.from('logos').upload(path,file);
      if(!upErr){ const {data}=sb.storage.from('logos').getPublicUrl(path); logoUrl=data.publicUrl; }
      else { logoUrl=await new Promise(res=>{ const r=new FileReader(); r.onload=e=>res(e.target.result); r.readAsDataURL(file); }); toast('Logo salva (bucket logos não existe, mas vai aparecer)'); }
    }catch(e){ console.log(e); }
  }
  const payload={name:$id('setName').value,whatsapp:$id('setWhatsapp').value,phone:$id('setWhatsapp').value,logo_url:logoUrl,start_time:$id('setStart').value,end_time:$id('setEnd').value,interval_minutes:parseInt($id('setInterval').value)||30,lunch_start:$id('setLunchStart').value,lunch_end:$id('setLunchEnd').value,working_days:dias};
  const {error}=await sb.from('barbershops').update(payload).eq('slug',currentSlug);
  if(error) return toast('Erro ao salvar: '+error.message);
  toast('Salvo ✅'); currentShop={...currentShop,...payload};
  if(logoUrl && $id('logoPreview')){ $id('logoPreview').src=logoUrl; $id('logoPreview').style.display='block'; }
}
// ===== CLIENTES - CRUD =====
async function carregarAniversariantes(){
  try{
    const {data:clientes=[], error}=await sb.from('customers').select('*').eq('slug',currentSlug);
    if(error) return console.log(error);
    const elTotal=$id('totalClientes'); if(elTotal) elTotal.textContent=clientes.length;
    const hoje=new Date(); const mesHoje=hoje.getMonth()+1; const diaHoje=hoje.getDate();
    const comNasc=clientes.filter(c=>c.birthdate);
    const doMes=comNasc.filter(c=>(new Date(c.birthdate+'T12:00:00').getMonth()+1)===mesHoje);
    const deHoje=doMes.filter(c=>new Date(c.birthdate+'T12:00:00').getDate()===diaHoje);
    doMes.sort((a,b)=>new Date(a.birthdate).getDate()-new Date(b.birthdate).getDate());
    const elMes=$id('totalAniversarioMes'); if(elMes) elMes.textContent=doMes.length;
    const elLista=$id('listaAniversarioMes');
    if(elLista) elLista.innerHTML=doMes.map(c=>{ const d=new Date(c.birthdate+'T12:00:00'); const ehHoje=d.getDate()===diaHoje?' <b style="color:var(--gold)">- HOJE 🎉</b>':''; const msg=encodeURIComponent(`Fala ${c.name}! Aqui é da Barbearia! Parabéns pelo seu dia! 🎂 Passa aqui essa semana que você tem 20% DE DESCONTO DE ANIVERSARIANTE! Quer agendar?`); return `• ${c.name} - ${String(d.getDate()).padStart(2,'0')}/${String(d.getMonth()+1).padStart(2,'0')} - ${c.phone} <a href="https://wa.me/55${String(c.phone).replace(/\D/g,'')}?text=${msg}" target="_blank" style="color:#25D366">WhatsApp</a>${ehHoje}`; }).join('<br>')||'Nenhum esse mês';
    if(deHoje.length>0){ const card=$id('cardAniversario'); if(card){ card.style.display='block'; $id('listaAniversarioHoje').innerHTML=deHoje.map(c=>`🎉 <b>${c.name}</b> - ${c.phone} - faz aniversário hoje!`).join('<br>'); $id('botoesAniversarioHoje').innerHTML=deHoje.map(c=>{ const msg=encodeURIComponent(`Fala ${c.name}! Aqui é da Barbearia! Parabéns pelo seu dia! 🎂 Hoje você tem 20% DE DESCONTO DE ANIVERSARIANTE, quer aproveitar e agendar seu corte?`); return `<a href="https://wa.me/55${String(c.phone).replace(/\D/g,'')}?text=${msg}" target="_blank" style="display:inline-block;margin:6px 6px 0 0;background:#25D366;color:#fff;padding:8px 12px;border-radius:8px;text-decoration:none;font-weight:700">WhatsApp ${c.name}</a>`; }).join(''); } }
    const lista=$id('listaClientes');
    if(lista){
      const filtro=($id('buscaCliente')?.value||'').toLowerCase();
      const filtrados=filtro?clientes.filter(c=>c.name.toLowerCase().includes(filtro)||String(c.phone).includes(filtro)):clientes;
      lista.innerHTML=filtrados.map(c=>{ const d=c.birthdate?new Date(c.birthdate+'T12:00:00'):null; const nasc=d?`${String(d.getDate()).padStart(2,'0')}/${String(d.getMonth()+1).padStart(2,'0')}/${d.getFullYear()}`:'—'; return `<div class="list-row"><div><b>${c.name}</b><br><small>${c.phone} • Nasc: ${nasc}</small></div><div style="display:flex;gap:6px;flex-wrap:wrap"><a href="https://wa.me/55${String(c.phone).replace(/\D/g,'')}" target="_blank"><button class="btn small">WhatsApp</button></a><button class="btn small" data-edit-cli="${c.id}">✏️ Editar</button><button class="btn small danger" data-del-cli="${c.id}">🗑️</button></div></div>`; }).join('')||'Nenhum cliente ainda';
      lista.querySelectorAll('[data-edit-cli]').forEach(b=>b.addEventListener('click',()=>{ const c=clientes.find(x=>String(x.id)===b.dataset.editCli); if(!c) return; editingClienteId=c.id; const novoNome=prompt('Nome:',c.name); if(novoNome===null) return; const novoNasc=prompt('Data nascimento (AAAA-MM-DD):',c.birthdate||''); if(novoNasc===null) return; const novoPhone=prompt('Telefone:',c.phone); if(novoPhone===null) return; salvarClienteEdit(novoNome,novoNasc,novoPhone); }));
      lista.querySelectorAll('[data-del-cli]').forEach(b=>b.addEventListener('click',()=>excluirCliente(b.dataset.delCli)));
    }
  }catch(e){ console.log(e); }
}
async function salvarClienteEdit(nome,nasc,phone){ const {error}=await sb.from('customers').update({name:nome,birthdate:nasc||null,phone}).eq('id',editingClienteId); if(error) return toast(error.message); toast('Cliente atualizado ✅'); carregarAniversariantes(); }
async function excluirCliente(id){ if(!confirm('Excluir cliente?')) return; await sb.from('customers').delete().eq('id',id); carregarAniversariantes(); }
